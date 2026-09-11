import { describe, expect, it } from "vitest";
import {
  ApiResponseError,
  getApiErrorRetryDelayMs,
  isApiErrorRetryable,
  parseRetryAfterMs,
  readApiResponseError,
} from "@/app/lib/api-error-response";

describe("API response error parser", () => {
  it("uses stable server meaning instead of the user message as control flow", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: "다시 입력해 주세요.",
          code: "SEARCH_ENRICHMENT_INVALID",
          action: "correct-request",
          retryable: false,
        },
        { status: 400 },
      ),
      "search enrichment failed",
    );

    expect(error).toBeInstanceOf(ApiResponseError);
    expect(error).toMatchObject({
      status: 400,
      code: "SEARCH_ENRICHMENT_INVALID",
      action: "correct-request",
      retryable: false,
    });
    expect(isApiErrorRetryable(error)).toBe(false);
  });

  it("falls back to the status contract when an older response has no envelope", async () => {
    const error = await readApiResponseError(
      new Response(null, { status: 503 }),
      "graph hydration failed",
    );

    expect(error).toMatchObject({
      name: "ApiResponseError",
      message: "graph hydration failed: 503",
      status: 503,
      code: "API_SERVER_ERROR",
      action: "retry",
      retryable: true,
      retryAfterMs: null,
    });
    expect(getApiErrorRetryDelayMs(error, 500)).toBe(500);
  });

  it("lets a transient response explicitly stop retries while preserving metadata", async () => {
    const metadata = { requestId: "request-1" };
    const error = await readApiResponseError(
      Response.json(
        {
          error: "do not retry",
          code: "UPSTREAM_TERMINAL",
          action: "retry",
          retryable: false,
          retryAfterSeconds: 2,
          metadata,
        },
        { status: 503 },
      ),
      "request failed",
    );

    expect(error).toMatchObject({
      message: "do not retry",
      code: "UPSTREAM_TERMINAL",
      action: "stop",
      retryable: false,
      retryAfterMs: 2_000,
      metadata,
    });
  });

  it("does not let a conflicting 400 envelope opt the client into retrying", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: "try the same request again",
          code: "BROKEN_SERVER_HINT",
          action: "retry",
          retryable: true,
        },
        { status: 400 },
      ),
      "request failed",
    );

    expect(error).toMatchObject({
      action: "correct-request",
      retryable: false,
    });
  });

  it("reads the legacy Moonlight auth error object with stable top-level meaning", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: {
            code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
            message: "Moonlight Scholar token missing.",
          },
          code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
          action: "authenticate",
          retryable: false,
        },
        { status: 401 },
      ),
      "authentication failed",
    );

    expect(error).toMatchObject({
      message: "Moonlight Scholar token missing.",
      action: "authenticate",
      retryable: false,
    });
  });

  it("honors and caps Retry-After for bounded client backoff", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: "slow down",
          code: "API_RATE_LIMITED",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 120,
        },
        { status: 429, headers: { "Retry-After": "120" } },
      ),
      "request failed",
    );

    expect(getApiErrorRetryDelayMs(error, 500)).toBe(60_000);
  });

  it("preserves the admission lease window while keeping the generic retry cap", async () => {
    const headerError = await readApiResponseError(
      Response.json(
        {
          error: "another gap build is active",
          code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 70,
        },
        { status: 429, headers: { "Retry-After": "70" } },
      ),
      "request failed",
    );
    const bodyError = await readApiResponseError(
      Response.json(
        {
          error: "another gap build is active",
          code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 70,
        },
        { status: 429 },
      ),
      "request failed",
    );

    expect(headerError.retryAfterMs).toBe(70_000);
    expect(bodyError.retryAfterMs).toBe(70_000);
  });

  it.each([
    [null, 1_000, null],
    ["", 1_000, null],
    ["0", 1_000, 0],
    ["0.001", 1_000, 1],
    ["Infinity", 1_000, null],
    ["invalid", 1_000, null],
    ["Thu, 01 Jan 1970 00:00:00 GMT", 1_000, 0],
    ["Thu, 01 Jan 1970 00:00:03 GMT", 1_000, 2_000],
    ["Thu, 01 Jan 1970 01:00:00 GMT", 1_000, 60_000],
  ] as const)("parses bounded Retry-After value %s", (value, nowMs, expected) => {
    expect(parseRetryAfterMs(value, nowMs)).toBe(expected);
  });

  it("prefers the Retry-After header over the body and falls back to the caller delay", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: "slow down",
          code: "API_RATE_LIMITED",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 20,
        },
        { status: 429, headers: { "Retry-After": "3" } },
      ),
      "request failed",
    );

    expect(getApiErrorRetryDelayMs(error, 500)).toBe(3_000);
    expect(getApiErrorRetryDelayMs(new TypeError("network failed"), 500)).toBe(500);
    expect(getApiErrorRetryDelayMs(null, 500)).toBe(500);
  });

  it("preserves an explicit zero-second body retry delay", async () => {
    const error = await readApiResponseError(
      Response.json(
        {
          error: "retry now",
          code: "API_RATE_LIMITED",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 0,
        },
        { status: 429 },
      ),
      "request failed",
    );

    expect(error.retryAfterMs).toBe(0);
    expect(getApiErrorRetryDelayMs(error, 500)).toBe(0);
  });

  it("does not retry an owner cancellation but keeps transport loss retryable", () => {
    expect(isApiErrorRetryable(new DOMException("cancelled", "AbortError"))).toBe(false);
    expect(isApiErrorRetryable(new DOMException("invalid", "InvalidStateError"))).toBe(true);
    expect(isApiErrorRetryable(new TypeError("network failed"))).toBe(true);
  });
});
