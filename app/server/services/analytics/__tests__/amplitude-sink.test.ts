import { describe, expect, it, vi } from "vitest";

import type { CanonicalEvent } from "@/app/lib/analytics/canonical-event";
import { createAmplitudeAnalyticsSink } from "@/app/server/services/analytics/amplitude-sink";

const loadEnvConfig = vi.hoisted(() => vi.fn());

vi.mock("@next/env", () => ({
  loadEnvConfig,
}));

interface AmplitudeRequestBody {
  api_key: string;
  events: Array<{
    event_type: string;
    user_id?: string;
    device_id?: string;
    session_id?: number;
    insert_id?: string;
    time?: number;
    event_properties?: Record<string, unknown>;
  }>;
}

function parseAmplitudeRequestBody(init: RequestInit | undefined): AmplitudeRequestBody {
  if (!init || typeof init.body !== "string") {
    throw new Error("fetch init or body missing");
  }
  return JSON.parse(init.body) as AmplitudeRequestBody;
}

function emptyLoadedEnvConfig(): ReturnType<typeof loadEnvConfig> {
  return {
    combinedEnv: {},
    parsedEnv: {},
    loadedEnvFiles: [],
  };
}

function createEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    name: "product.search_submitted",
    version: 1,
    occurredAt: "2026-05-11T03:00:00.000Z",
    actor: { type: "user", id: "user-1@example.com" },
    deviceId: "device-abc",
    sessionId: 1770000000000,
    surface: "research-route",
    storyRefs: {
      experienceRef: "experience:research-and-discovery",
      momentRef: "moment:search-results-first-review",
      promiseRef: "promise:search-results-fast-window",
      aspectRefs: [],
      acceptanceCheckRefs: [],
      scenarioRefs: [],
    },
    trigger: {
      source: "client",
      phase: "requested",
      timing: "search task is enqueued",
    },
    subject: { ownerPrincipalId: "ws-1" },
    properties: { ownerPrincipalId: "ws-1" },
    privacy: { level: "behavior_metadata", allowExternalSinks: true },
    ...overrides,
  };
}

describe("createAmplitudeAnalyticsSink", () => {
  it("posts the declared vendor event with user_id, device_id, session_id, time, and event_properties to the HTTP V2 endpoint", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 200 }), { status: 200 })),
    );
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      endpoint: "https://amp.test/2/httpapi",
      fetchImpl,
    });

    const event = createEvent();
    await sink.capture("search_requested", event, { ownerPrincipalId: "ws-1" });

    const mocked = vi.mocked(fetchImpl);
    expect(mocked).toHaveBeenCalledTimes(1);
    const [url, init] = mocked.mock.calls[0];
    expect(url).toBe("https://amp.test/2/httpapi");
    if (!init) throw new Error("fetch init missing");
    const body = parseAmplitudeRequestBody(init);
    expect(init.method).toBe("POST");
    expect(body.api_key).toBe("test-key");
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      event_type: "search_requested",
      user_id: "user-1@example.com",
      device_id: "device-abc",
      session_id: 1770000000000,
      time: Date.parse(event.occurredAt),
      event_properties: { ownerPrincipalId: "ws-1" },
    });
    expect(body.events[0].insert_id).toEqual(
      expect.stringMatching(/^lighthouse:search_requested:[a-f0-9]{32}$/),
    );
  });

  it("emits device_id and session_id without user_id for anonymous replay matching", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 200 }), { status: 200 })),
    );
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      endpoint: "https://amp.test/2/httpapi",
      fetchImpl,
    });

    const event = createEvent({ actor: { type: "user" }, deviceId: "device-anon" });
    await sink.capture("search_requested", event, { ownerPrincipalId: "ws-1" });

    const mocked = vi.mocked(fetchImpl);
    const [, init] = mocked.mock.calls[0];
    const body = parseAmplitudeRequestBody(init);
    expect(body.events[0].user_id).toBeUndefined();
    expect(body.events[0].device_id).toBe("device-anon");
    expect(body.events[0].session_id).toBe(1770000000000);
  });

  it("skips vendor delivery when both user_id and device_id are unavailable", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 200 }), { status: 200 })),
    );
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      endpoint: "https://amp.test/2/httpapi",
      fetchImpl,
    });

    await sink.capture(
      "ai_comment_card_viewed",
      createEvent({ actor: { type: "user" }, deviceId: undefined }),
      { ownerPrincipalId: "ws-1" },
    );

    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
  });

  it("returns silently without calling fetch when no API key is configured", async () => {
    const fetchImpl: typeof fetch = vi.fn(() => Promise.resolve(new Response(null)));
    const sink = createAmplitudeAnalyticsSink({ apiKey: "", fetchImpl });

    await sink.capture("search_requested", createEvent(), {});

    expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
  });

  it("throws a sink error when the default API key is missing after local env loading", async () => {
    const originalNextPublicKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    const originalServerKey = process.env.AMPLITUDE_API_KEY;
    delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    delete process.env.AMPLITUDE_API_KEY;
    loadEnvConfig.mockReturnValueOnce(emptyLoadedEnvConfig());
    const fetchImpl: typeof fetch = vi.fn(() => Promise.resolve(new Response(null)));

    try {
      const sink = createAmplitudeAnalyticsSink({ fetchImpl });

      await expect(sink.capture("search_requested", createEvent(), {})).rejects.toThrow(
        /missing an API key/,
      );
      expect(vi.mocked(fetchImpl)).not.toHaveBeenCalled();
    } finally {
      if (originalNextPublicKey === undefined) delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
      else process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = originalNextPublicKey;
      if (originalServerKey === undefined) delete process.env.AMPLITUDE_API_KEY;
      else process.env.AMPLITUDE_API_KEY = originalServerKey;
      loadEnvConfig.mockReset();
    }
  });

  it("loads local env config before treating the default API key as missing", async () => {
    const originalNextPublicKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    const originalServerKey = process.env.AMPLITUDE_API_KEY;
    delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    delete process.env.AMPLITUDE_API_KEY;
    const loadEnvConfigImpl = (): ReturnType<typeof loadEnvConfig> => {
      process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = "loaded-test-key";
      return emptyLoadedEnvConfig();
    };
    loadEnvConfig.mockImplementationOnce(loadEnvConfigImpl);
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ code: 200 }), { status: 200 })),
    );

    try {
      const sink = createAmplitudeAnalyticsSink({
        endpoint: "https://amp.test/2/httpapi",
        fetchImpl,
      });
      await sink.capture("search_requested", createEvent(), {});

      expect(loadEnvConfig).toHaveBeenCalledWith(process.cwd());
      const [, init] = vi.mocked(fetchImpl).mock.calls[0];
      expect(parseAmplitudeRequestBody(init).api_key).toBe("loaded-test-key");
    } finally {
      if (originalNextPublicKey === undefined) delete process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
      else process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY = originalNextPublicKey;
      if (originalServerKey === undefined) delete process.env.AMPLITUDE_API_KEY;
      else process.env.AMPLITUDE_API_KEY = originalServerKey;
      loadEnvConfig.mockReset();
    }
  });

  it("throws a sink error when transient network delivery fails so the router can record it", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.reject(new AggregateError([new Error("connect ETIMEDOUT")], "network down")),
    );
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      fetchImpl,
      maxAttempts: 1,
    });

    await expect(sink.capture("search_requested", createEvent(), {})).rejects.toThrow(
      /network down/,
    );
  });

  it("normalizes timed-out AbortErrors into concise sink errors", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.reject(new DOMException("This operation was aborted", "AbortError")),
    );
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      fetchImpl,
      maxAttempts: 1,
      timeoutMs: 25,
    });

    await expect(sink.capture("search_requested", createEvent(), {})).rejects.toThrow(
      "Amplitude HTTP V2 sink timed out after 25ms while posting event search_requested",
    );
  });

  it("retries transient delivery failures with the same insert_id for dedupe", async () => {
    const fetchImpl: typeof fetch = vi
      .fn()
      .mockRejectedValueOnce(new AggregateError([new Error("connect ETIMEDOUT")], "network down"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 200 }), { status: 200 }));
    const sink = createAmplitudeAnalyticsSink({
      apiKey: "test-key",
      endpoint: "https://amp.test/2/httpapi",
      fetchImpl,
      retryDelayMs: 0,
    });

    await sink.capture("search_requested", createEvent(), {});

    const mocked = vi.mocked(fetchImpl);
    expect(mocked).toHaveBeenCalledTimes(2);
    const [, retryInit] = mocked.mock.calls[1];
    const retryBody = parseAmplitudeRequestBody(retryInit);
    expect(retryBody.events[0].insert_id).toMatch(/^lighthouse:search_requested:[a-f0-9]{32}$/);
  });

  it("throws a sink error when the HTTP V2 endpoint rejects the event so the router can record it", async () => {
    const fetchImpl: typeof fetch = vi.fn(() =>
      Promise.resolve(
        new Response('{"error":"Invalid field values on some events"}', { status: 400 }),
      ),
    );
    const sink = createAmplitudeAnalyticsSink({ apiKey: "test-key", fetchImpl });

    await expect(sink.capture("search_requested", createEvent(), {})).rejects.toThrow(
      /Amplitude HTTP V2 sink rejected event search_requested: 400 .*Invalid field values/,
    );
  });
});
