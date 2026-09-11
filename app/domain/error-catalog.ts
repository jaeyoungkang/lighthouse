// Error catalog — 사용자에게 노출되는 모든 에러의 정의.
// messageKey는 i18n 메시지 맵 키를 참조한다 (패턴: {domain}.error.{qualifier}).

import type { MessageKey } from "@/app/i18n/messages";

// ─── 타입 ─────────────────────────────────────────────────

export type ErrorSeverity = "error" | "warn" | "info";

export type ErrorCategory =
  | "api_error"
  | "llm_fallback"
  | "tool_failure"
  | "client_error"
  | "memory_error"
  | "validation_error";

export type ErrorSource = "server" | "client" | "llm" | "tool";

export interface ErrorCatalogEntry {
  code: string;
  category: ErrorCategory;
  source: ErrorSource;
  messageKey: MessageKey;
  internalMessage: string;
  httpStatus?: number;
  severity: ErrorSeverity;
  retryable: boolean;
}

// ─── 카탈로그 ─────────────────────────────────────────────

export const ERROR_CATALOG = {
  // ── 검색 (search-service.ts) ──────────────────────────

  SEARCH_CONNECTION_FAILED: {
    code: "SEARCH_CONNECTION_FAILED",
    category: "api_error",
    source: "server",
    messageKey: "search.error.connectionFailed",
    internalMessage: "Search server connection failed",
    httpStatus: 502,
    severity: "error",
    retryable: true,
  },

  SEARCH_RATE_LIMITED: {
    code: "SEARCH_RATE_LIMITED",
    category: "api_error",
    source: "server",
    messageKey: "search.error.rateLimited",
    internalMessage: "Literature provider rate limit hit (429)",
    httpStatus: 429,
    severity: "warn",
    retryable: true,
  },

  SEARCH_SERVER_ERROR: {
    code: "SEARCH_SERVER_ERROR",
    category: "api_error",
    source: "server",
    messageKey: "search.error.serverError",
    internalMessage: "Literature provider non-OK response",
    httpStatus: 502,
    severity: "error",
    retryable: true,
  },

  SEARCH_PARSE_FAILED: {
    code: "SEARCH_PARSE_FAILED",
    category: "api_error",
    source: "server",
    messageKey: "search.error.parseFailed",
    internalMessage: "Literature provider response Zod validation failed",
    httpStatus: 502,
    severity: "error",
    retryable: false,
  },

  SEARCH_REQUEST_FAILED: {
    code: "SEARCH_REQUEST_FAILED",
    category: "client_error",
    source: "client",
    messageKey: "search.error.requestFailed",
    internalMessage: "Background search request failed",
    severity: "error",
    retryable: true,
  },

  // ── 인증/인가 (auth-errors.ts) ────────────────────────

  AUTH_UNAUTHENTICATED: {
    code: "AUTH_UNAUTHENTICATED",
    category: "client_error",
    source: "server",
    messageKey: "auth.error.unauthenticated",
    internalMessage: "Authentication required",
    httpStatus: 401,
    severity: "error",
    retryable: false,
  },

  AUTH_FORBIDDEN: {
    code: "AUTH_FORBIDDEN",
    category: "client_error",
    source: "server",
    messageKey: "auth.error.forbidden",
    internalMessage: "Access denied",
    httpStatus: 403,
    severity: "error",
    retryable: false,
  },

  AUTH_NOT_FOUND: {
    code: "AUTH_NOT_FOUND",
    category: "client_error",
    source: "server",
    messageKey: "auth.error.notFound",
    internalMessage: "Resource not found",
    httpStatus: 404,
    severity: "error",
    retryable: false,
  },

  // ── 이메일 검증 (EmailGate) ─────────

  AUTH_EMAIL_INVALID: {
    code: "AUTH_EMAIL_INVALID",
    category: "validation_error",
    source: "client",
    messageKey: "auth.error.emailInvalid",
    internalMessage: "Invalid email format",
    severity: "warn",
    retryable: false,
  },

  AUTH_EMAIL_RESTRICTED: {
    code: "AUTH_EMAIL_RESTRICTED",
    category: "validation_error",
    source: "client",
    messageKey: "auth.error.emailRestricted",
    internalMessage: "Email domain not allowed",
    severity: "warn",
    retryable: false,
  },

  // ── 매직링크 (request-magic-link.ts) ──────────────────

  AUTH_MAGIC_LINK_FAILED: {
    code: "AUTH_MAGIC_LINK_FAILED",
    category: "api_error",
    source: "server",
    messageKey: "auth.error.magicLinkFailed",
    internalMessage: "Magic link OTP request failed",
    severity: "error",
    retryable: true,
  },

  AUTH_NETWORK_ERROR: {
    code: "AUTH_NETWORK_ERROR",
    category: "client_error",
    source: "client",
    messageKey: "auth.error.networkError",
    internalMessage: "Network error during auth",
    severity: "error",
    retryable: true,
  },

  // ── 로그아웃 ────────────────────

  AUTH_SIGNOUT_FAILED: {
    code: "AUTH_SIGNOUT_FAILED",
    category: "client_error",
    source: "client",
    messageKey: "auth.error.signoutFailed",
    internalMessage: "Sign-out failed",
    severity: "error",
    retryable: true,
  },
} as const satisfies Record<string, ErrorCatalogEntry>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
