import { NextResponse } from "next/server";
import {
  getApiErrorMeaningForStatus,
  type ApiErrorAction,
  type ApiErrorResponseBody,
} from "@/app/domain/api-error-contract";

export interface ApiErrorResponseOptions {
  status: number;
  code?: string;
  message: string;
  action?: ApiErrorAction;
  retryable?: boolean;
  retryAfterSeconds?: number;
  metadata?: unknown;
  extensions?: Record<string, unknown>;
  headers?: HeadersInit;
  preserveLegacyErrorObject?: boolean;
}

export function apiErrorResponse(
  options: ApiErrorResponseOptions,
): NextResponse<ApiErrorResponseBody & Record<string, unknown>> {
  const fallback = getApiErrorMeaningForStatus(options.status);
  const retryable = fallback.retryable ? (options.retryable ?? true) : false;
  const action = fallback.retryable
    ? (options.action ?? (retryable ? fallback.action : "stop"))
    : fallback.action;
  const retryAfterSeconds =
    options.retryAfterSeconds != null
      ? Math.max(0, Math.ceil(options.retryAfterSeconds))
      : undefined;
  const headers = new Headers(options.headers);
  if (retryAfterSeconds != null && !headers.has("Retry-After")) {
    headers.set("Retry-After", String(retryAfterSeconds));
  }
  return NextResponse.json(
    {
      ...options.extensions,
      error: options.preserveLegacyErrorObject
        ? {
            code: options.code ?? fallback.code,
            message: options.message,
          }
        : options.message,
      code: options.code ?? fallback.code,
      action,
      retryable,
      ...(options.metadata === undefined ? {} : { metadata: options.metadata }),
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    },
    {
      status: options.status,
      headers,
    },
  );
}
