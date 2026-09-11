import { API_ROUTES } from "@/app/lib/api-routes";
import { linkSignals } from "@/app/server/lib/abort-utils";

export const MOONLIGHT_SCHOLAR_LIBRARY_OPERATION_TIMEOUT_MS = 5_000;

/**
 * Owns the absolute deadline for one logical Moonlight library load, including
 * every paginated request. The caller owns pagination and response mapping;
 * this transport boundary owns cancellation policy.
 */
export async function runWithMoonlightScholarLibraryDeadline<T>(params: {
  readonly operation: (signal: AbortSignal) => Promise<T>;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}): Promise<T> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, params.timeoutMs ?? MOONLIGHT_SCHOLAR_LIBRARY_OPERATION_TIMEOUT_MS);
  const linkedSignal = params.signal ? linkSignals(params.signal, timeoutController.signal) : null;
  const signal = linkedSignal?.signal ?? timeoutController.signal;

  try {
    return await params.operation(signal);
  } finally {
    linkedSignal?.cleanup();
    clearTimeout(timeoutId);
  }
}

export async function fetchMoonlightScholarLibraryPage(params: {
  readonly baseUrl: string;
  readonly token: string;
  readonly limit: number;
  readonly cursor: string | null;
  readonly signal?: AbortSignal;
  readonly fetchImpl?: typeof fetch;
}): Promise<Response> {
  const url = new URL(API_ROUTES.MOONLIGHT_SCHOLAR_LIBRARY_PAPERS, params.baseUrl);
  url.searchParams.set("limit", String(params.limit));
  if (params.cursor) url.searchParams.set("cursor", params.cursor);

  const fetchImpl = params.fetchImpl ?? fetch;
  return fetchImpl(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${params.token}`,
    },
    signal: params.signal,
    cache: "no-store",
  });
}
