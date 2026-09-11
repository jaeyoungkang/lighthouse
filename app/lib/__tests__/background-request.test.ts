import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS,
  fetchBackgroundRequest,
  waitForBackgroundRetry,
} from "@/app/lib/background-request";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchBackgroundRequest error bodies", () => {
  it("discards a non-success body unless a contract-aware caller opts in", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(Response.json({ error: "failed" }, { status: 500 })),
    ) as typeof fetch;

    const response = await fetchBackgroundRequest("/api/test", {}, "background request");

    expect(response.status).toBe(500);
    expect(response.body).toBeNull();
  });

  it("preserves a non-success body for stable API error parsing when requested", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(Response.json({ error: "failed" }, { status: 500 })),
    ) as typeof fetch;

    const response = await fetchBackgroundRequest("/api/test", {}, "background request", {
      preserveErrorBody: true,
    });

    await expect(response.json()).resolves.toEqual({ error: "failed" });
  });

  it("uses the bounded background silence budget and operation-specific timeout error", async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn(() => new Promise<Response>(() => undefined)) as typeof fetch;

    const request = fetchBackgroundRequest("/api/test", {}, "paper hydration");
    const rejection = expect(request).rejects.toMatchObject({
      name: "TimeoutError",
      message: "paper hydration stalled",
    });
    await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS - 1);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
  });

  it("waits for the retry delay when the owner remains active", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let settled = false;
    const waiting = waitForBackgroundRetry(controller.signal, 500).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waiting;
    expect(settled).toBe(true);
  });

  it("ends a retry wait immediately on owner cancellation and clears its timer", async () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const controller = new AbortController();
    const addEventListenerSpy = vi.spyOn(controller.signal, "addEventListener");
    const waiting = waitForBackgroundRetry(controller.signal, 500);

    controller.abort();

    await expect(waiting).resolves.toBeUndefined();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function), {
      once: true,
    });
  });

  it("does not schedule retry work for an already cancelled owner", async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const controller = new AbortController();
    controller.abort();

    await expect(waitForBackgroundRetry(controller.signal, 500)).resolves.toBeUndefined();
    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});
