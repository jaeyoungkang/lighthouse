import { describe, expect, it } from "vitest";
import {
  API_ERROR_ACTIONS,
  getApiErrorMeaningForStatus,
  isApiErrorAction,
  isApiErrorResponseBody,
} from "@/app/domain/api-error-contract";

describe("API error contract", () => {
  it.each([
    [400, "API_BAD_REQUEST", "correct-request", false],
    [401, "API_UNAUTHENTICATED", "authenticate", false],
    [403, "API_FORBIDDEN", "request-permission", false],
    [404, "API_NOT_FOUND", "clear-missing-state", false],
    [409, "API_CONFLICT", "refresh-and-rebase", false],
    [410, "API_GONE", "clear-missing-state", false],
    [413, "API_PAYLOAD_TOO_LARGE", "reduce-request", false],
    [422, "API_UNPROCESSABLE", "correct-request", false],
    [429, "API_RATE_LIMITED", "wait-and-retry", true],
    [500, "API_SERVER_ERROR", "retry", true],
    [599, "API_SERVER_ERROR", "retry", true],
    [418, "API_HTTP_ERROR", "stop", false],
    [600, "API_HTTP_ERROR", "stop", false],
  ] as const)("maps status %s to its exact stable meaning", (status, code, action, retryable) => {
    expect(getApiErrorMeaningForStatus(status)).toEqual({ code, action, retryable });
  });

  it("keeps the action vocabulary closed", () => {
    expect(API_ERROR_ACTIONS).toEqual([
      "correct-request",
      "authenticate",
      "request-permission",
      "clear-missing-state",
      "refresh-and-rebase",
      "reduce-request",
      "wait-and-retry",
      "retry",
      "stop",
    ]);
    for (const action of API_ERROR_ACTIONS) expect(isApiErrorAction(action)).toBe(true);
    expect(isApiErrorAction("try-something")).toBe(false);
    expect(isApiErrorAction(1)).toBe(false);
  });

  it.each([
    {
      error: "bad request",
      code: "BAD",
      action: "correct-request",
      retryable: false,
    },
    {
      error: { code: "BAD", message: "bad request" },
      code: "BAD",
      action: "correct-request",
      retryable: false,
      metadata: { field: "query" },
      retryAfterSeconds: 0,
    },
  ])("accepts a complete string or object error envelope", (body) => {
    expect(isApiErrorResponseBody(body)).toBe(true);
  });

  it.each([
    null,
    "bad request",
    { error: "bad request" },
    { error: 1, code: "BAD", action: "stop", retryable: false },
    { error: { code: "BAD" }, code: "BAD", action: "stop", retryable: false },
    { error: { message: "bad" }, code: "BAD", action: "stop", retryable: false },
    { error: "bad", code: 1, action: "stop", retryable: false },
    { error: "bad", code: "BAD", action: "try-something", retryable: false },
    { error: "bad", code: "BAD", action: "stop", retryable: "false" },
    { error: "bad", code: "BAD", action: "stop", retryable: false, retryAfterSeconds: -1 },
    { error: "bad", code: "BAD", action: "stop", retryable: false, retryAfterSeconds: 1.5 },
    { error: "bad", code: "BAD", action: "stop", retryable: false, retryAfterSeconds: "1" },
  ])("rejects an incomplete or internally inconsistent envelope: %#", (body) => {
    expect(isApiErrorResponseBody(body)).toBe(false);
  });
});
