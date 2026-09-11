import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
import type * as AnalyticsEventAccess from "@/app/server/domain-access/analytics-event-access";
import { __resetPublicTelemetryIngressForTests } from "@/app/server/operational/public-telemetry-ingress";

const { trackCanonicalEvent, resolveCurrentUser, afterMock, scheduledDrains } = vi.hoisted(() => ({
  trackCanonicalEvent: vi.fn(),
  resolveCurrentUser: vi.fn(),
  afterMock: vi.fn((cb: () => Promise<void>) => {
    scheduledDrains.push(cb);
  }),
  scheduledDrains: [] as Array<() => Promise<void>>,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof NextServer>();
  return { ...actual, after: afterMock };
});

vi.mock("@/app/server/domain-access/analytics-event-access", async (importOriginal) => {
  const actual = await importOriginal<typeof AnalyticsEventAccess>();
  return {
    ...actual,
    getAnalyticsEventRouterForTrustedServer: () => ({ trackCanonicalEvent }),
  };
});

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentUser,
}));

function request(body: unknown, source = "203.0.113.7"): Request {
  return new Request("https://lighthouse.example.com/api/analytics-events", {
    method: "POST",
    headers: { "x-forwarded-for": source },
    body: JSON.stringify(body),
  });
}

async function runScheduledDrains(): Promise<void> {
  const drains = scheduledDrains.splice(0);
  for (const drain of drains) {
    await drain();
  }
}

describe("analytics events route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    __resetPublicTelemetryIngressForTests();
    scheduledDrains.length = 0;
    trackCanonicalEvent.mockResolvedValue({ ok: true });
    resolveCurrentUser.mockResolvedValue(null);
  });

  it("derives the authenticated user email instead of trusting a client actor id", async () => {
    resolveCurrentUser.mockResolvedValue({ id: "user-1", email: "pilot@example.com" });
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "product.researcher_prose_promises_page.clicked",
        payload: {
          actor: { type: "user", id: "spoof@example.net" },
          deviceId: "device-abc",
          sessionId: 1770000000000,
          subject: {},
          properties: { target: "promises" },
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(trackCanonicalEvent).not.toHaveBeenCalled();

    await runScheduledDrains();

    expect(trackCanonicalEvent).toHaveBeenCalledWith(
      "product.researcher_prose_promises_page.clicked",
      expect.objectContaining({
        actor: { type: "user", id: "pilot@example.com" },
        deviceId: "device-abc",
      }),
    );
  });

  it("strips client actor ids from anonymous user events", async () => {
    const { POST } = await import("../route");

    await POST(
      request({
        name: "product.researcher_prose_promises_page.clicked",
        payload: {
          actor: { type: "user", id: "spoof@example.net" },
          deviceId: "device-anon",
          sessionId: 1770000000001,
          subject: {},
          properties: { target: "promises" },
        },
      }),
    );

    expect(afterMock).toHaveBeenCalledTimes(1);
    await runScheduledDrains();

    expect(trackCanonicalEvent).toHaveBeenCalledWith(
      "product.researcher_prose_promises_page.clicked",
      expect.objectContaining({
        actor: { type: "user" },
        deviceId: "device-anon",
      }),
    );
  });

  it("does not schedule non-user actor payloads from the public route", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "governance.story_chain.synced",
        payload: {
          actor: { type: "system" },
          subject: {},
          properties: {},
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(trackCanonicalEvent).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does not schedule server-source user events from the public route", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "product.search_submitted",
        payload: {
          actor: { type: "user", id: "pilot@example.com" },
          subject: { ownerPrincipalId: "principal-1" },
          properties: {
            ownerPrincipalId: "principal-1",
            queryHash: "fnv1a32:test",
            queryLength: 12,
            sort: "relevance",
          },
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(trackCanonicalEvent).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[analytics-events] public route rejected non-client event:",
      "product.search_submitted",
    );
    consoleError.mockRestore();
  });

  it("does not call the router for malformed payloads", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const response = await POST(request({ name: "", payload: {} }));

    expect(response.status).toBe(204);
    expect(trackCanonicalEvent).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "[analytics-events] invalid canonical event payload:",
      expect.any(Array),
    );
    expect(afterMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("logs store and sink errors while keeping the fire-and-forget response", async () => {
    const storeError = new Error("readonly filesystem");
    const sinkError = new Error("Amplitude HTTP V2 sink is missing an API key");
    trackCanonicalEvent.mockResolvedValue({
      ok: true,
      storeError,
      sinkErrors: [sinkError],
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "product.researcher_prose_promises_page.clicked",
        payload: {
          actor: { type: "user", id: "pilot@example.com" },
          deviceId: "device-abc",
          sessionId: 1770000000000,
          subject: {},
          properties: { target: "promises" },
        },
      }),
    );

    expect(response.status).toBe(204);
    await runScheduledDrains();

    expect(consoleError).toHaveBeenCalledWith(
      "[analytics-events] canonical event store failed:",
      storeError,
    );
    expect(consoleError).toHaveBeenCalledWith("[analytics-events] canonical event sink failed:", [
      {
        name: "Error",
        message: "Amplitude HTTP V2 sink is missing an API key",
      },
    ]);
    consoleError.mockRestore();
  });

  it("summarizes sink AbortErrors without dumping raw DOMException details", async () => {
    const sinkError = new DOMException("This operation was aborted", "AbortError");
    trackCanonicalEvent.mockResolvedValue({
      ok: true,
      sinkErrors: [sinkError],
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "product.researcher_prose_promises_page.clicked",
        payload: {
          actor: { type: "user", id: "pilot@example.com" },
          deviceId: "device-abc",
          sessionId: 1770000000000,
          subject: {},
          properties: { target: "promises" },
        },
      }),
    );

    expect(response.status).toBe(204);
    await runScheduledDrains();

    expect(consoleError).toHaveBeenCalledWith("[analytics-events] canonical event sink failed:", [
      {
        name: "AbortError",
        message: "This operation was aborted",
      },
    ]);
    expect(consoleError).not.toHaveBeenCalledWith(
      "[analytics-events] canonical event sink failed:",
      [sinkError],
    );
    consoleError.mockRestore();
  });

  it("returns 204 before a pending canonical router drain settles", async () => {
    trackCanonicalEvent.mockReturnValue(new Promise(() => undefined));
    const { POST } = await import("../route");

    const response = await POST(
      request({
        name: "product.researcher_prose_promises_page.clicked",
        payload: {
          actor: { type: "user", id: "pilot@example.com" },
          deviceId: "device-abc",
          sessionId: 1770000000000,
          subject: {},
          properties: { target: "promises" },
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(trackCanonicalEvent).not.toHaveBeenCalled();
  });
});

describe("analytics events route ingress limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    __resetPublicTelemetryIngressForTests();
    scheduledDrains.length = 0;
    trackCanonicalEvent.mockResolvedValue({ ok: true });
    resolveCurrentUser.mockResolvedValue(null);
  });

  it("drops oversized events as 204 before resolving actor or scheduling a drain", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { POST } = await import("../route");
    const response = await POST(
      new Request("https://lighthouse.example.com/api/analytics-events", {
        method: "POST",
        body: "{}",
        headers: {
          "content-length": "65537",
          "x-forwarded-for": "203.0.113.7",
        },
      }),
    );

    expect(response.status).toBe(204);
    expect(resolveCurrentUser).not.toHaveBeenCalled();
    expect(trackCanonicalEvent).not.toHaveBeenCalled();
    expect(afterMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("drops repeated public analytics ingress over the source budget without scheduling a drain", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "60000");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { POST } = await import("../route");

    const payload = {
      name: "product.researcher_prose_promises_page.clicked",
      payload: {
        actor: { type: "user", id: "pilot@example.com" },
        deviceId: "device-abc",
        sessionId: 1770000000000,
        subject: {},
        properties: { target: "promises" },
      },
    };

    const first = await POST(request(payload, "198.51.100.7"));
    const second = await POST(request(payload, "198.51.100.7"));

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
    expect(afterMock).toHaveBeenCalledTimes(1);
    await runScheduledDrains();
    expect(trackCanonicalEvent).toHaveBeenCalledTimes(1);
    expect(consoleWarn).toHaveBeenCalledWith(
      "[analytics-events] public telemetry ingress dropped:",
      "rate-limit",
    );
    consoleWarn.mockRestore();
  });
});
