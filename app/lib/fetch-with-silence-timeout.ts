export interface FetchWithSilenceTimeoutOptions {
  deadlineMs?: number;
  discardBodyOnNonOk?: boolean;
  timeoutMs: number;
  timeoutMessage: string;
  timeoutErrorName?: string;
}

function createTimeoutError(options: FetchWithSilenceTimeoutOptions): DOMException {
  return new DOMException(options.timeoutMessage, options.timeoutErrorName ?? "AbortError");
}

function toError(reason: unknown, fallbackMessage: string): Error {
  if (reason instanceof Error) return reason;
  return new DOMException(
    typeof reason === "string" && reason.length > 0 ? reason : fallbackMessage,
    "AbortError",
  );
}

function getAbortReason(signal: AbortSignal | undefined, fallbackMessage: string): Error {
  if (!signal?.aborted) return new DOMException(fallbackMessage, "AbortError");
  return toError(signal.reason, fallbackMessage);
}

function raceWithAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  fallbackMessage: string,
  resolveAbortReason: () => Error = () => getAbortReason(signal, fallbackMessage),
): Promise<T> {
  if (signal.aborted) return Promise.reject(resolveAbortReason());
  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener("abort", handleAbort);
      reject(resolveAbortReason());
    };
    signal.addEventListener("abort", handleAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", handleAbort);
        reject(signal.aborted ? resolveAbortReason() : toError(error, fallbackMessage));
      },
    );
  });
}

export async function fetchWithSilenceTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithSilenceTimeoutOptions,
): Promise<Response> {
  const upstreamSignal = init.signal ?? undefined;
  if (upstreamSignal?.aborted) {
    throw getAbortReason(upstreamSignal, options.timeoutMessage);
  }

  const controller = new AbortController();
  const abortReasonRef: { current: Error | null } = { current: null };
  let deadlineId: ReturnType<typeof setTimeout> | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = () => {
    if (deadlineId != null) {
      clearTimeout(deadlineId);
      deadlineId = null;
    }
    if (timeoutId != null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const resetTimer = () => {
    if (timeoutId != null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      abortReasonRef.current = createTimeoutError(options);
      controller.abort(abortReasonRef.current);
    }, options.timeoutMs);
  };

  const handleUpstreamAbort = () => {
    abortReasonRef.current = getAbortReason(upstreamSignal, options.timeoutMessage);
    controller.abort(abortReasonRef.current);
  };
  upstreamSignal?.addEventListener("abort", handleUpstreamAbort, { once: true });
  if (options.deadlineMs != null) {
    deadlineId = setTimeout(() => {
      abortReasonRef.current = createTimeoutError(options);
      controller.abort(abortReasonRef.current);
    }, options.deadlineMs);
  }
  resetTimer();

  try {
    const response = await raceWithAbort(
      globalThis.fetch(input, {
        ...init,
        signal: controller.signal,
      }),
      controller.signal,
      options.timeoutMessage,
      () => abortReasonRef.current ?? getAbortReason(controller.signal, options.timeoutMessage),
    );

    if (options.discardBodyOnNonOk && !response.ok) {
      clearTimers();
      upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
      if (response.body) {
        const discardReason = new DOMException("non-success response body discarded", "AbortError");
        const cancellation = response.body.cancel(discardReason);
        controller.abort(discardReason);
        void cancellation.catch(() => undefined);
      }
      return new Response(null, response);
    }

    if (!response.body) {
      clearTimers();
      upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
      return response;
    }
    const responseBody = response.body;
    const reader = responseBody.getReader();
    let readerReleased = false;

    const releaseReader = () => {
      if (readerReleased) return;
      readerReleased = true;
      reader.releaseLock();
    };

    return new Response(
      new ReadableStream<Uint8Array>({
        async pull(streamController) {
          try {
            resetTimer();
            const { done, value } = await raceWithAbort(
              reader.read(),
              controller.signal,
              options.timeoutMessage,
              () =>
                abortReasonRef.current ?? getAbortReason(controller.signal, options.timeoutMessage),
            );
            if (done) {
              clearTimers();
              releaseReader();
              streamController.close();
              upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
              return;
            }
            resetTimer();
            streamController.enqueue(value);
          } catch (error) {
            clearTimers();
            releaseReader();
            upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
            streamController.error(
              controller.signal.aborted
                ? (abortReasonRef.current ??
                    getAbortReason(controller.signal, options.timeoutMessage))
                : error,
            );
          }
        },
        async cancel(reason) {
          clearTimers();
          upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
          abortReasonRef.current = toError(reason, options.timeoutMessage);
          controller.abort(abortReasonRef.current);
          try {
            await reader.cancel(reason);
          } finally {
            releaseReader();
          }
        },
      }),
      response,
    );
  } catch (error) {
    clearTimers();
    upstreamSignal?.removeEventListener("abort", handleUpstreamAbort);
    if (controller.signal.aborted) {
      throw abortReasonRef.current ?? getAbortReason(controller.signal, options.timeoutMessage);
    }
    throw error;
  }
}
