import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithSilenceTimeout } from "@/app/lib/fetch-with-silence-timeout";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("fetchWithSilenceTimeout", () => {
  it("aborts when no server response arrives before the timeout", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal as AbortSignal | undefined;
          requestSignal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            },
            { once: true },
          );
        }),
    ) as typeof fetch;

    const request = fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "request stalled" },
    );

    expect(requestSignal?.aborted).toBe(false);
    const expectation = expect(request).rejects.toThrow(/request stalled|aborted/i);

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("settles at the deadline even when the transport ignores abort", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      return new Promise<Response>(() => undefined);
    }) as typeof fetch;

    const request = fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "abort-ignoring transport stalled" },
    );
    const expectation = expect(request).rejects.toThrow(/abort-ignoring transport stalled/i);

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("uses the configured timeout error name for internal timeouts", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal as AbortSignal | undefined;
          requestSignal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            },
            { once: true },
          );
        }),
    ) as typeof fetch;

    const request = fetchWithSilenceTimeout(
      "/api/test",
      {},
      {
        timeoutMs: 1000,
        timeoutMessage: "reaction stalled",
        timeoutErrorName: "TimeoutError",
      },
    );
    const expectation = expect(request).rejects.toMatchObject({
      name: "TimeoutError",
      message: "reaction stalled",
    });

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("aborts when response headers arrive but the body stops making progress", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          requestSignal?.addEventListener(
            "abort",
            () => {
              controller.error(new DOMException("The operation was aborted.", "AbortError"));
            },
            { once: true },
          );
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "body stalled" },
    );
    const read = response.text();

    expect(requestSignal?.aborted).toBe(false);
    const expectation = expect(read).rejects.toThrow(/body stalled|aborted/i);

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
  });

  it("settles a body read when the upstream reader ignores abort", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull: () => new Promise<void>(() => undefined),
          }),
          { status: 200 },
        ),
      );
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "abort-ignoring body stalled" },
    );
    const read = response.text();
    const expectation = expect(read).rejects.toThrow(/abort-ignoring body stalled/i);

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
    expect(requestSignal?.aborted).toBe(true);
  });
});

describe("fetchWithSilenceTimeout cleanup and streaming", () => {
  it("discards a non-success response body when the caller will only inspect status", async () => {
    const upstreamController = new AbortController();
    const removeEventListener = vi.spyOn(upstreamController.signal, "removeEventListener");
    const upstreamCancel = vi.fn();
    const upstreamResponse = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"error":"failed"}'));
        },
        cancel(reason) {
          upstreamCancel(reason);
        },
      }),
      { status: 500 },
    );
    globalThis.fetch = vi.fn(() => Promise.resolve(upstreamResponse)) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      { signal: upstreamController.signal },
      {
        discardBodyOnNonOk: true,
        timeoutMs: 1000,
        timeoutMessage: "body stalled",
      },
    );

    expect(response).toMatchObject({ status: 500, body: null });
    expect(upstreamCancel).toHaveBeenCalledOnce();
    expect(upstreamResponse.body?.locked).toBe(false);
    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("removes the upstream abort listener when the response has no body", async () => {
    const upstreamController = new AbortController();
    const removeEventListener = vi.spyOn(upstreamController.signal, "removeEventListener");
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    ) as typeof fetch;

    await expect(
      fetchWithSilenceTimeout(
        "/api/test",
        { signal: upstreamController.signal },
        { timeoutMs: 1000, timeoutMessage: "body stalled" },
      ),
    ).resolves.toMatchObject({ status: 204 });

    expect(removeEventListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("does not eagerly drain the upstream body before the wrapped body is pulled", async () => {
    let upstreamPulls = 0;
    globalThis.fetch = vi.fn(() => {
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            upstreamPulls += 1;
            controller.enqueue(new TextEncoder().encode(`chunk-${String(upstreamPulls)}`));
            if (upstreamPulls >= 3) {
              controller.close();
            }
          },
        },
        { highWaterMark: 0 },
      );
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "body stalled" },
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(upstreamPulls).toBeLessThan(3);

    const reader = response.body?.getReader();
    const chunk = await reader?.read();

    expect(new TextDecoder().decode(chunk?.value)).toMatch(/^chunk-/);

    await reader?.cancel("done");
  });

  it("cancels the upstream reader when the wrapped body is canceled", async () => {
    const upstreamCancel = vi.fn();
    globalThis.fetch = vi.fn(() => {
      const body = new ReadableStream<Uint8Array>({
        cancel(reason) {
          upstreamCancel(reason);
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "body stalled" },
    );

    await response.body?.cancel("consumer done");

    expect(upstreamCancel).toHaveBeenCalledWith("consumer done");
  });

  it("resets the body timeout when streamed chunks keep arriving", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    const chunks = ["a", "b"];
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      const body = new ReadableStream<Uint8Array>({
        pull(controller) {
          const next = chunks.shift();
          if (next == null) {
            controller.close();
            return;
          }
          controller.enqueue(new TextEncoder().encode(next));
        },
      });
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      { timeoutMs: 1000, timeoutMessage: "body stalled" },
    );
    const reader = response.body?.getReader();

    await expect(reader?.read()).resolves.toMatchObject({ done: false });
    await vi.advanceTimersByTimeAsync(999);
    await expect(reader?.read()).resolves.toMatchObject({ done: false });

    expect(requestSignal?.aborted).toBe(false);
    await reader?.cancel("done");
  });

  it("enforces an absolute deadline even while streamed chunks keep arriving", async () => {
    vi.useFakeTimers();
    let requestSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal | undefined;
      let chunk = 0;
      const body = new ReadableStream<Uint8Array>(
        {
          async pull(controller) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            controller.enqueue(new TextEncoder().encode(String((chunk += 1))));
          },
        },
        { highWaterMark: 0 },
      );
      return Promise.resolve(new Response(body, { status: 200 }));
    }) as typeof fetch;

    const response = await fetchWithSilenceTimeout(
      "/api/test",
      {},
      {
        deadlineMs: 1500,
        timeoutMs: 1000,
        timeoutMessage: "request deadline reached",
        timeoutErrorName: "TimeoutError",
      },
    );
    const reader = response.body?.getReader();

    const first = reader?.read();
    await vi.advanceTimersByTimeAsync(600);
    await expect(first).resolves.toMatchObject({ done: false });
    const second = reader?.read();
    await vi.advanceTimersByTimeAsync(600);
    await expect(second).resolves.toMatchObject({ done: false });
    const third = reader?.read();
    const deadline = expect(third).rejects.toThrow(/request deadline reached/i);
    await vi.advanceTimersByTimeAsync(300);

    await deadline;
    expect(requestSignal?.aborted).toBe(true);
  });
});
