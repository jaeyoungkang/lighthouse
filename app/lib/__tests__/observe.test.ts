import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const emitStructuredObservation = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/runtime-log", () => ({ emitStructuredObservation }));

async function loadServerObserve() {
  vi.resetModules();
  vi.stubGlobal("window", undefined);
  vi.stubEnv("EVIDENCE_LEDGER", "");
  return import("@/app/lib/observe");
}

describe("observe", () => {
  beforeEach(() => {
    emitStructuredObservation.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("emits server observations, suppresses orchestration noise, and contains sink failures", async () => {
    const { observe } = await loadServerObserve();
    const businessEntry = {
      timestamp: "2026-07-15T00:00:00.000Z",
      category: "business" as const,
      action: "test-observation",
      status: "success" as const,
    };

    observe(businessEntry);
    expect(emitStructuredObservation).toHaveBeenCalledWith(businessEntry);

    observe({ ...businessEntry, category: "orchestration" });
    expect(emitStructuredObservation).toHaveBeenCalledTimes(1);

    emitStructuredObservation.mockImplementation(() => {
      throw new Error("observation sink failed");
    });
    expect(() => {
      observe(businessEntry);
    }).not.toThrow();
  });

  it("records AI start and success without changing the authoritative result", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(145);
    const { withAIObservation } = await loadServerObserve();

    await expect(
      withAIObservation("test-ai-operation", { owner: "test" }, () =>
        Promise.resolve("authoritative-result"),
      ),
    ).resolves.toBe("authoritative-result");

    expect(emitStructuredObservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        category: "ai-call",
        action: "test-ai-operation",
        status: "start",
        metadata: { owner: "test" },
      }),
    );
    expect(emitStructuredObservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        category: "ai-call",
        action: "test-ai-operation",
        status: "success",
        duration: 45,
        metadata: { owner: "test" },
      }),
    );
  });

  it("records AI failure metadata and rethrows the original error", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(200).mockReturnValueOnce(230);
    const { withAIObservation } = await loadServerObserve();
    const failure = new Error("provider failed");

    await expect(
      withAIObservation("failed-ai-operation", { owner: "test" }, () => Promise.reject(failure)),
    ).rejects.toBe(failure);

    expect(emitStructuredObservation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: "ai-call",
        action: "failed-ai-operation",
        status: "fail",
        duration: 30,
        metadata: { owner: "test", error: "provider failed" },
      }),
    );
  });

  it("records API success and failure while preserving handler outcomes", async () => {
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(300)
      .mockReturnValueOnce(320)
      .mockReturnValueOnce(400)
      .mockReturnValueOnce(425);
    const { withAPIObservation } = await loadServerObserve();
    const request = { method: "POST" } as never;
    const response = new Response(null, { status: 204 }) as never;
    const successHandler = vi.fn(() => Promise.resolve(response));

    await expect(withAPIObservation("/api/test", successHandler)(request)).resolves.toBe(response);
    expect(emitStructuredObservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        category: "api",
        action: "/api/test",
        status: "start",
        metadata: { method: "POST" },
      }),
    );
    expect(emitStructuredObservation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        category: "api",
        action: "/api/test",
        status: "success",
        duration: 20,
        metadata: { method: "POST", statusCode: 204 },
      }),
    );

    emitStructuredObservation.mockClear();
    const failure = new Error("route failed");
    const failureHandler = vi.fn(() => Promise.reject(failure));
    await expect(withAPIObservation("/api/test", failureHandler)(request)).rejects.toBe(failure);
    expect(emitStructuredObservation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        category: "api",
        action: "/api/test",
        status: "start",
        metadata: { method: "POST" },
      }),
    );
    expect(emitStructuredObservation).toHaveBeenLastCalledWith(
      expect.objectContaining({
        category: "api",
        action: "/api/test",
        status: "fail",
        duration: 25,
        metadata: { method: "POST", error: "route failed" },
      }),
    );
  });

  it("suppresses all observations during an Evidence Ledger run", async () => {
    vi.resetModules();
    vi.stubGlobal("window", undefined);
    vi.stubEnv("EVIDENCE_LEDGER", "1");
    const { observe } = await import("@/app/lib/observe");

    observe({
      timestamp: "2026-07-15T00:00:00.000Z",
      category: "business",
      action: "ledger-observation",
      status: "success",
    });

    expect(emitStructuredObservation).not.toHaveBeenCalled();
  });
});
