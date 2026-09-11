import { ERROR_CATALOG, type ErrorCode } from "@/app/domain/error-catalog";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly metadata: Record<string, unknown>;

  constructor(code: ErrorCode, metadata?: Record<string, unknown>) {
    const entry = ERROR_CATALOG[code];
    super(entry.internalMessage);
    this.name = "AppError";
    this.code = code;
    this.metadata = metadata ?? {};
  }

  get catalog() {
    return ERROR_CATALOG[this.code];
  }
}
