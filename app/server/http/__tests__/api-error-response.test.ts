import { describe, expect, it } from "vitest";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

describe("apiErrorResponse", () => {
  it("preserves the error field and adds stable non-retryable request meaning", async () => {
    const response = apiErrorResponse({
      status: 422,
      code: "GAP_REACTION_REJECTED",
      message: "gap reaction is not valid for the current report",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "gap reaction is not valid for the current report",
      code: "GAP_REACTION_REJECTED",
      action: "correct-request",
      retryable: false,
    });
  });

  it("carries the same bounded backoff in the body and Retry-After header", async () => {
    const response = apiErrorResponse({
      status: 429,
      message: "request limit exceeded",
      retryAfterSeconds: 12.1,
    });

    expect(response.headers.get("Retry-After")).toBe("13");
    await expect(response.json()).resolves.toMatchObject({
      code: "API_RATE_LIMITED",
      action: "wait-and-retry",
      retryable: true,
      retryAfterSeconds: 13,
    });
  });

  it("does not invent backoff and preserves caller-owned header and body values", async () => {
    const withoutBackoff = apiErrorResponse({
      status: 429,
      message: "request limit exceeded",
    });
    const withCallerHeader = apiErrorResponse({
      status: 429,
      message: "request limit exceeded",
      retryAfterSeconds: 12,
      headers: { "Retry-After": "30" },
    });

    expect(withoutBackoff.headers.has("Retry-After")).toBe(false);
    expect(withCallerHeader.headers.get("Retry-After")).toBe("30");
    await expect(withCallerHeader.json()).resolves.toMatchObject({
      retryAfterSeconds: 12,
    });
  });

  it("lets a non-retryable catalog error stop a default 5xx retry", async () => {
    const response = apiErrorResponse({
      status: 502,
      code: "SEARCH_PARSE_FAILED",
      message: "provider response was invalid",
      retryable: false,
    });

    await expect(response.json()).resolves.toMatchObject({
      action: "stop",
      retryable: false,
    });
  });

  it("does not let a caller make a correctable request error retryable", async () => {
    const response = apiErrorResponse({
      status: 400,
      message: "bad request",
      action: "retry",
      retryable: true,
    });

    await expect(response.json()).resolves.toMatchObject({
      action: "correct-request",
      retryable: false,
    });
  });

  it("preserves a legacy nested error while adding stable top-level meaning", async () => {
    const response = apiErrorResponse({
      status: 401,
      code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
      message: "Moonlight Scholar token missing.",
      preserveLegacyErrorObject: true,
    });

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
        message: "Moonlight Scholar token missing.",
      },
      code: "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
      action: "authenticate",
      retryable: false,
    });
  });

  it("preserves structured metadata for contract-aware callers", async () => {
    const response = apiErrorResponse({
      status: 409,
      message: "state changed",
      metadata: { currentRevision: 7 },
    });

    await expect(response.json()).resolves.toMatchObject({
      metadata: { currentRevision: 7 },
    });
  });
});
