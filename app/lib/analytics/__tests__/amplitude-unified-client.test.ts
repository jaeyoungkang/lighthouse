import { afterEach, describe, expect, it, vi } from "vitest";

describe("amplitude unified lazy client", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@amplitude/unified");
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("retries the SDK import after a failed dynamic import", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    let attempts = 0;
    const initAll = vi.fn();

    vi.doMock("@amplitude/unified", () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("chunk failed");
      }
      return {
        getDeviceId: vi.fn(),
        getSessionId: vi.fn(),
        getUserId: vi.fn(),
        Identify: vi.fn(),
        identify: vi.fn(),
        initAll,
        reset: vi.fn(),
        track: vi.fn(),
      };
    });

    const { initializeAmplitudeUnifiedModule, loadAmplitudeUnifiedModule } =
      await import("../amplitude-unified-client");

    await expect(loadAmplitudeUnifiedModule()).resolves.toBeNull();
    await expect(initializeAmplitudeUnifiedModule()).resolves.not.toBeNull();

    expect(attempts).toBe(2);
    expect(initAll).toHaveBeenCalledWith("amplitude-key", {
      analytics: { defaultTracking: false },
      sessionReplay: { sampleRate: 0.1 },
    });
  });

  it("skips the SDK import when the public Amplitude key is not configured", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "");
    let attempts = 0;

    vi.doMock("@amplitude/unified", () => {
      attempts += 1;
      return {
        getDeviceId: vi.fn(),
        getSessionId: vi.fn(),
        getUserId: vi.fn(),
        Identify: vi.fn(),
        identify: vi.fn(),
        initAll: vi.fn(),
        reset: vi.fn(),
        track: vi.fn(),
      };
    });

    const {
      initializeAmplitudeUnifiedModule,
      loadAmplitudeUnifiedModule,
      readAmplitudeUnifiedModule,
    } = await import("../amplitude-unified-client");

    expect(readAmplitudeUnifiedModule()).toBeNull();
    await expect(loadAmplitudeUnifiedModule()).resolves.toBeNull();
    await expect(initializeAmplitudeUnifiedModule()).resolves.toBeNull();
    expect(attempts).toBe(0);
  });

  it("retries when initialization is the first caller after a failed dynamic import", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    let attempts = 0;
    const initAll = vi.fn();

    vi.doMock("@amplitude/unified", () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("chunk failed");
      }
      return {
        getDeviceId: vi.fn(),
        getSessionId: vi.fn(),
        getUserId: vi.fn(),
        Identify: vi.fn(),
        identify: vi.fn(),
        initAll,
        reset: vi.fn(),
        track: vi.fn(),
      };
    });

    const { initializeAmplitudeUnifiedModule } = await import("../amplitude-unified-client");

    await expect(initializeAmplitudeUnifiedModule()).resolves.toBeNull();
    await expect(initializeAmplitudeUnifiedModule()).resolves.not.toBeNull();

    expect(attempts).toBe(2);
    expect(initAll).toHaveBeenCalledTimes(1);
  });

  it("keeps reset safe before the SDK has loaded", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    const reset = vi.fn();

    vi.doMock("@amplitude/unified", () => ({
      getDeviceId: vi.fn(),
      getSessionId: vi.fn(),
      getUserId: vi.fn(),
      Identify: vi.fn(),
      identify: vi.fn(),
      initAll: vi.fn(),
      reset,
      track: vi.fn(),
    }));

    const { loadAmplitudeUnifiedModule, resetLoadedAmplitudeModule } =
      await import("../amplitude-unified-client");

    expect(() => {
      resetLoadedAmplitudeModule();
    }).not.toThrow();
    await expect(loadAmplitudeUnifiedModule()).resolves.not.toBeNull();
    resetLoadedAmplitudeModule();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("does not import or initialize the browser SDK on the server", async () => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    let attempts = 0;

    vi.doMock("@amplitude/unified", () => {
      attempts += 1;
      return {
        getDeviceId: vi.fn(),
        getSessionId: vi.fn(),
        getUserId: vi.fn(),
        Identify: vi.fn(),
        identify: vi.fn(),
        initAll: vi.fn(),
        reset: vi.fn(),
        track: vi.fn(),
      };
    });

    const {
      initializeAmplitudeUnifiedModule,
      loadAmplitudeUnifiedModule,
      readAmplitudeUnifiedModule,
    } = await import("../amplitude-unified-client");

    expect(readAmplitudeUnifiedModule()).toBeNull();
    await expect(loadAmplitudeUnifiedModule()).resolves.toBeNull();
    await expect(initializeAmplitudeUnifiedModule()).resolves.toBeNull();
    expect(attempts).toBe(0);
  });

  it("deduplicates concurrent loads and initializes a loaded module only once", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    let attempts = 0;
    const initAll = vi.fn(() => Promise.resolve());

    vi.doMock("@amplitude/unified", () => {
      attempts += 1;
      return {
        getDeviceId: vi.fn(),
        getSessionId: vi.fn(),
        getUserId: vi.fn(),
        Identify: vi.fn(),
        identify: vi.fn(),
        initAll,
        reset: vi.fn(),
        track: vi.fn(),
      };
    });

    const {
      initializeAmplitudeUnifiedModule,
      loadAmplitudeUnifiedModule,
      readAmplitudeUnifiedModule,
    } = await import("../amplitude-unified-client");

    const [first, second] = await Promise.all([
      initializeAmplitudeUnifiedModule(),
      initializeAmplitudeUnifiedModule(),
    ]);
    expect(first).toBe(second);
    expect(readAmplitudeUnifiedModule()).toBe(first);
    await expect(loadAmplitudeUnifiedModule()).resolves.toBe(first);
    await expect(initializeAmplitudeUnifiedModule()).resolves.toBe(first);
    expect(attempts).toBe(1);
    expect(initAll).toHaveBeenCalledTimes(1);
  });

  it("retries initialization after initAll rejects", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
    const initAll = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("init failed"))
      .mockResolvedValueOnce();

    vi.doMock("@amplitude/unified", () => ({
      getDeviceId: vi.fn(),
      getSessionId: vi.fn(),
      getUserId: vi.fn(),
      Identify: vi.fn(),
      identify: vi.fn(),
      initAll,
      reset: vi.fn(),
      track: vi.fn(),
    }));

    const { initializeAmplitudeUnifiedModule } = await import("../amplitude-unified-client");

    await expect(initializeAmplitudeUnifiedModule()).resolves.toBeNull();
    await expect(initializeAmplitudeUnifiedModule()).resolves.not.toBeNull();
    expect(initAll).toHaveBeenCalledTimes(2);
  });
});
