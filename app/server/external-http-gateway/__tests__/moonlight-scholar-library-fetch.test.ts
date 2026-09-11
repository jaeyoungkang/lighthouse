import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MOONLIGHT_SCHOLAR_LIBRARY_OPERATION_TIMEOUT_MS,
  runWithMoonlightScholarLibraryDeadline,
} from "@/app/server/external-http-gateway/moonlight-scholar-library-fetch";

afterEach(() => {
  vi.useRealTimers();
});

describe("runWithMoonlightScholarLibraryDeadline", () => {
  it("aborts the whole logical library load at the gateway-owned absolute deadline", async () => {
    vi.useFakeTimers();
    let operationSignal: AbortSignal | undefined;

    const request = runWithMoonlightScholarLibraryDeadline({
      operation: (signal) => {
        operationSignal = signal;
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Moonlight library deadline", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(MOONLIGHT_SCHOLAR_LIBRARY_OPERATION_TIMEOUT_MS - 1);
    expect(operationSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await rejection;
    expect(operationSignal?.aborted).toBe(true);
  });

  it("links caller cancellation while the operation is active", async () => {
    vi.useFakeTimers();
    const upstream = new AbortController();
    let operationSignal: AbortSignal | undefined;

    const request = runWithMoonlightScholarLibraryDeadline({
      signal: upstream.signal,
      operation: (signal) => {
        operationSignal = signal;
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Caller cancelled", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    upstream.abort();

    await rejection;
    expect(operationSignal?.aborted).toBe(true);
  });

  it("clears caller linkage and the deadline after a completed operation", async () => {
    vi.useFakeTimers();
    const upstream = new AbortController();
    let operationSignal: AbortSignal | undefined;

    await expect(
      runWithMoonlightScholarLibraryDeadline({
        signal: upstream.signal,
        operation: (signal) => {
          operationSignal = signal;
          return Promise.resolve("completed");
        },
      }),
    ).resolves.toBe("completed");

    upstream.abort();
    await vi.runAllTimersAsync();
    expect(operationSignal?.aborted).toBe(false);
  });

  it("honors an explicit absolute deadline instead of replacing it with the default", async () => {
    vi.useFakeTimers();
    let operationSignal: AbortSignal | undefined;

    const request = runWithMoonlightScholarLibraryDeadline({
      timeoutMs: 25,
      operation: (signal) => {
        operationSignal = signal;
        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => {
              reject(new DOMException("Custom deadline", "AbortError"));
            },
            { once: true },
          );
        });
      },
    });
    const rejection = expect(request).rejects.toMatchObject({ name: "AbortError" });

    await vi.advanceTimersByTimeAsync(24);
    expect(operationSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
  });
});
