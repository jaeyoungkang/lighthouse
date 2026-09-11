import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("trackCanonicalEvent client bridge", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    Object.defineProperty(globalThis.navigator, "sendBeacon", {
      configurable: true,
      value: vi.fn(() => false),
    });
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@amplitude/unified");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("waits for configured SDK initialization before sending the first event identity", async () => {
    const initialization = createDeferred<undefined>();
    vi.doMock("@amplitude/unified", () => ({
      getDeviceId: vi.fn(() => "device-abc"),
      getSessionId: vi.fn(() => 1770000000000),
      initAll: vi.fn(() => initialization.promise),
    }));

    const { loadAmplitudeUnifiedModule } = await import("../amplitude-unified-client");
    const { trackCanonicalEvent } = await import("../client");

    trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user@example.com" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: { ownerPrincipalId: "principal-1" },
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(loadAmplitudeUnifiedModule()).resolves.not.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    initialization.resolve(undefined);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(parseAnalyticsRequestBody(init)).toMatchObject({
      name: "product.search_submitted",
      payload: {
        actor: { type: "user", id: "user@example.com" },
        deviceId: "device-abc",
        sessionId: 1770000000000,
      },
    });
  });

  it("sends once without SDK identity when configured initialization fails", async () => {
    vi.doMock("@amplitude/unified", () => ({
      getDeviceId: vi.fn(() => "uninitialized-device"),
      getSessionId: vi.fn(() => 1770000000000),
      initAll: vi.fn(() => Promise.reject(new Error("init failed"))),
    }));

    const { trackCanonicalEvent } = await import("../client");

    trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user@example.com" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: { ownerPrincipalId: "principal-1" },
    });

    const fetchMock = vi.mocked(fetch);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = parseAnalyticsRequestBody(init);
    expect(body.payload.deviceId).toBeUndefined();
    expect(body.payload.sessionId).toBeUndefined();
  });

  it("sends without SDK identity when Amplitude is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    vi.doMock("@amplitude/unified", () => ({
      getDeviceId: vi.fn(),
      getSessionId: vi.fn(),
      initAll: vi.fn(),
    }));

    const { trackCanonicalEvent } = await import("../client");

    trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user@example.com" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: { ownerPrincipalId: "principal-1" },
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [, init] = fetchMock.mock.calls[0];
    const body = parseAnalyticsRequestBody(init);
    expect(body.payload.deviceId).toBeUndefined();
    expect(body.payload.sessionId).toBeUndefined();
  });
});

type AnalyticsRequestBody = {
  name?: string;
  payload: {
    actor?: { type?: string; id?: string };
    deviceId?: string;
    sessionId?: number;
  };
};

function parseAnalyticsRequestBody(init: RequestInit | undefined): AnalyticsRequestBody {
  if (!init || typeof init.body !== "string") throw new Error("fetch body missing");
  return JSON.parse(init.body) as AnalyticsRequestBody;
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
