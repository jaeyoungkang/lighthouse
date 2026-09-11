import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/app/lib/app-error";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/app/server/auth/auth-errors";
import { withRouteGuard } from "@/app/server/guards/route-guard";

const recordRouteGuardErrorMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/app/server/domain-access/error-access", () => ({
  recordRouteGuardError: recordRouteGuardErrorMock,
}));

describe("withRouteGuard API error contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives authentication failures a stable action without retry", async () => {
    const response = await withRouteGuard(() =>
      Promise.reject(new UnauthenticatedError("session expired")),
    )();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "session expired",
      code: "AUTH_UNAUTHENTICATED",
      action: "authenticate",
      retryable: false,
    });
  });

  it("gives authorization failures a stable action without retry", async () => {
    const response = await withRouteGuard(() =>
      Promise.reject(new ForbiddenError("access denied")),
    )();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "access denied",
      code: "AUTH_FORBIDDEN",
      action: "request-permission",
      retryable: false,
    });
    expect(recordRouteGuardErrorMock).not.toHaveBeenCalled();
  });

  it("gives missing resources a stable action without retry", async () => {
    const response = await withRouteGuard(() =>
      Promise.reject(new NotFoundError("resource missing")),
    )();

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "resource missing",
      code: "AUTH_NOT_FOUND",
      action: "clear-missing-state",
      retryable: false,
    });
    expect(recordRouteGuardErrorMock).not.toHaveBeenCalled();
  });

  it("preserves a non-retryable Error Catalog decision inside a 5xx envelope", async () => {
    const response = await withRouteGuard(() =>
      Promise.reject(new AppError("SEARCH_PARSE_FAILED")),
    )();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      code: "SEARCH_PARSE_FAILED",
      action: "stop",
      retryable: false,
    });
  });

  it("records an unexpected error and returns the stable transient envelope", async () => {
    const unexpected = new Error("database connection string must not leak");
    const response = await withRouteGuard(() => Promise.reject(unexpected))();

    expect(recordRouteGuardErrorMock).toHaveBeenCalledWith(unexpected);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "internal server error",
      code: "API_INTERNAL_ERROR",
      action: "retry",
      retryable: true,
    });
  });
});
