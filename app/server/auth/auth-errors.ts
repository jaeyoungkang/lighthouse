/**
 * 인증/인가 에러 계층.
 * route-guard에서 HTTP 응답으로 변환한다.
 */

import { t } from "@/app/i18n/message-access";

export class UnauthenticatedError extends Error {
  readonly code = "AUTH_UNAUTHENTICATED" as const;
  constructor(message = t("auth.label.auth-errors")) {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "AUTH_FORBIDDEN" as const;
  constructor(message = t("auth.error.auth-errors")) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly code = "AUTH_NOT_FOUND" as const;
  constructor(message = t("auth.error.auth-errors.2")) {
    super(message);
    this.name = "NotFoundError";
  }
}
