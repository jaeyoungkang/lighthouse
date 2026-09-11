import { fetchWithSilenceTimeout } from "@/app/lib/fetch-with-silence-timeout";

/** Client allowance for 60-second background route budgets plus response handoff overhead. */
export const BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS = 65_000;

export function fetchBackgroundRequest(
  input: RequestInfo | URL,
  init: RequestInit,
  operation: string,
  options: { preserveErrorBody?: boolean } = {},
): Promise<Response> {
  return fetchWithSilenceTimeout(input, init, {
    discardBodyOnNonOk: !options.preserveErrorBody,
    timeoutMs: BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS,
    timeoutMessage: `${operation} stalled`,
    timeoutErrorName: "TimeoutError",
  });
}

export function waitForBackgroundRetry(signal: AbortSignal, delayMs: number): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const timeout = globalThis.setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
  });
}
