export const API_ERROR_ACTIONS = [
  "correct-request",
  "authenticate",
  "request-permission",
  "clear-missing-state",
  "refresh-and-rebase",
  "reduce-request",
  "wait-and-retry",
  "retry",
  "stop",
] as const;

export type ApiErrorAction = (typeof API_ERROR_ACTIONS)[number];

export interface ApiErrorMeaning {
  code: string;
  action: ApiErrorAction;
  retryable: boolean;
}

export interface ApiErrorResponseBody extends ApiErrorMeaning {
  error:
    | string
    | {
        code: string;
        message: string;
      };
  metadata?: unknown;
  retryAfterSeconds?: number;
}

const STATUS_ERROR_MEANINGS: Readonly<Partial<Record<number, ApiErrorMeaning>>> = {
  400: {
    code: "API_BAD_REQUEST",
    action: "correct-request",
    retryable: false,
  },
  401: {
    code: "API_UNAUTHENTICATED",
    action: "authenticate",
    retryable: false,
  },
  403: {
    code: "API_FORBIDDEN",
    action: "request-permission",
    retryable: false,
  },
  404: {
    code: "API_NOT_FOUND",
    action: "clear-missing-state",
    retryable: false,
  },
  409: {
    code: "API_CONFLICT",
    action: "refresh-and-rebase",
    retryable: false,
  },
  410: {
    code: "API_GONE",
    action: "clear-missing-state",
    retryable: false,
  },
  413: {
    code: "API_PAYLOAD_TOO_LARGE",
    action: "reduce-request",
    retryable: false,
  },
  422: {
    code: "API_UNPROCESSABLE",
    action: "correct-request",
    retryable: false,
  },
  429: {
    code: "API_RATE_LIMITED",
    action: "wait-and-retry",
    retryable: true,
  },
};

const TRANSIENT_SERVER_ERROR: ApiErrorMeaning = {
  code: "API_SERVER_ERROR",
  action: "retry",
  retryable: true,
};

const TERMINAL_HTTP_ERROR: ApiErrorMeaning = {
  code: "API_HTTP_ERROR",
  action: "stop",
  retryable: false,
};

export function getApiErrorMeaningForStatus(status: number): ApiErrorMeaning {
  const exact = STATUS_ERROR_MEANINGS[status];
  if (exact) return exact;
  if (status >= 500 && status <= 599) return TRANSIENT_SERVER_ERROR;
  return TERMINAL_HTTP_ERROR;
}

export function isApiErrorAction(value: unknown): value is ApiErrorAction {
  return typeof value === "string" && API_ERROR_ACTIONS.some((action) => action === value);
}

export function isApiErrorResponseBody(value: unknown): value is ApiErrorResponseBody {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Partial<ApiErrorResponseBody>;
  const hasErrorMessage =
    typeof candidate.error === "string" ||
    (candidate.error != null &&
      typeof candidate.error === "object" &&
      typeof candidate.error.code === "string" &&
      typeof candidate.error.message === "string");
  return (
    hasErrorMessage &&
    typeof candidate.code === "string" &&
    isApiErrorAction(candidate.action) &&
    typeof candidate.retryable === "boolean" &&
    (candidate.retryAfterSeconds === undefined ||
      (Number.isSafeInteger(candidate.retryAfterSeconds) && candidate.retryAfterSeconds >= 0))
  );
}
