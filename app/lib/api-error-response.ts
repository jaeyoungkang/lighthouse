import {
  getApiErrorMeaningForStatus,
  isApiErrorResponseBody,
  type ApiErrorAction,
} from "@/app/domain/api-error-contract";

export const MAX_API_RETRY_AFTER_MS = 60_000;
const MAX_GAP_BUILD_ADMISSION_RETRY_AFTER_MS = 120_000;

export class ApiResponseError extends Error {
  readonly name = "ApiResponseError";

  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly action: ApiErrorAction,
    readonly retryable: boolean,
    readonly retryAfterMs: number | null,
    readonly metadata?: unknown,
  ) {
    super(message);
  }
}

export function parseRetryAfterMs(
  value: string | null,
  nowMs: number = Date.now(),
  maxRetryAfterMs: number = MAX_API_RETRY_AFTER_MS,
): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.ceil(seconds * 1_000), maxRetryAfterMs);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.min(Math.max(0, timestamp - nowMs), maxRetryAfterMs);
}

function parseBodyRetryAfterMs(value: unknown, maxRetryAfterMs: number): number | null {
  if (!Number.isSafeInteger(value) || Number(value) < 0) return null;
  return Math.min(Number(value) * 1_000, maxRetryAfterMs);
}

export async function readApiResponseError(
  response: Response,
  fallbackMessage: string,
): Promise<ApiResponseError> {
  const fallback = getApiErrorMeaningForStatus(response.status);
  const raw: unknown = await response.json().catch((): unknown => null);
  const body = isApiErrorResponseBody(raw) ? raw : null;
  const retryable = fallback.retryable ? (body?.retryable ?? true) : false;
  const action = fallback.retryable ? (retryable ? fallback.action : "stop") : fallback.action;
  const maxRetryAfterMs =
    body?.code === "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT"
      ? MAX_GAP_BUILD_ADMISSION_RETRY_AFTER_MS
      : MAX_API_RETRY_AFTER_MS;
  const retryAfterMs =
    parseRetryAfterMs(response.headers.get("Retry-After"), Date.now(), maxRetryAfterMs) ??
    parseBodyRetryAfterMs(body?.retryAfterSeconds, maxRetryAfterMs);
  const message =
    body == null
      ? `${fallbackMessage}: ${String(response.status)}`
      : typeof body.error === "string"
        ? body.error
        : body.error.message;
  return new ApiResponseError(
    message,
    response.status,
    body?.code ?? fallback.code,
    action,
    retryable,
    retryAfterMs,
    body?.metadata,
  );
}

export function isApiErrorRetryable(error: unknown): boolean {
  if (error instanceof ApiResponseError) return error.retryable;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return true;
}

export function getApiErrorRetryDelayMs(error: unknown, fallbackMs: number): number {
  if (error instanceof ApiResponseError && error.retryAfterMs != null) {
    return error.retryAfterMs;
  }
  return fallbackMs;
}
