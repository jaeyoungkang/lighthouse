/**
 * Route 공통 에러 → HTTP Response 변환 유틸.
 */

import type { NextResponse } from "next/server";
import { UnauthenticatedError, ForbiddenError, NotFoundError } from "@/app/server/auth/auth-errors";
import { recordRouteGuardError } from "@/app/server/domain-access/error-access";
import { AppError } from "@/app/lib/app-error";
import { t } from "@/app/i18n/message-access";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

/**
 * guard/domain-access 에러를 HTTP 응답으로 변환한다.
 * 인증, body read/limit, admission은 적용하지 않으며 route handler가 명시적으로 소유한다.
 */
export function withRouteGuard<T extends unknown[]>(
  handler: (...args: T) => Promise<Response | NextResponse>,
) {
  return async (...args: T): Promise<Response | NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof UnauthenticatedError) {
        return apiErrorResponse({
          status: 401,
          code: "AUTH_UNAUTHENTICATED",
          message: err.message,
        });
      }
      if (err instanceof ForbiddenError) {
        return apiErrorResponse({
          status: 403,
          code: "AUTH_FORBIDDEN",
          message: err.message,
        });
      }
      if (err instanceof NotFoundError) {
        return apiErrorResponse({
          status: 404,
          code: "AUTH_NOT_FOUND",
          message: err.message,
        });
      }
      if (err instanceof AppError) {
        const entry = err.catalog;
        const message = t(entry.messageKey, err.metadata as Record<string, string | number>);
        const httpStatus = "httpStatus" in entry ? entry.httpStatus : undefined;
        return apiErrorResponse({
          status: httpStatus ?? 500,
          code: err.code,
          message,
          metadata: err.metadata,
          retryable: entry.retryable,
        });
      }
      await recordRouteGuardError(err);
      return apiErrorResponse({
        status: 500,
        code: "API_INTERNAL_ERROR",
        message: "internal server error",
      });
    }
  };
}
