import type { NextResponse } from "next/server";
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
  type BoundedJsonBodyLimit,
} from "@/app/server/lib/bounded-json-body";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export type RouteJsonBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; response: NextResponse };

export async function readRouteJsonBody(
  request: Request,
  limit: BoundedJsonBodyLimit,
): Promise<RouteJsonBodyResult> {
  try {
    const body = await readBoundedJsonBody(request, limit);
    if (body === null) {
      return {
        ok: false,
        response: apiErrorResponse({
          status: 400,
          code: "API_INVALID_JSON",
          message: "invalid JSON body",
        }),
      };
    }
    return { ok: true, body };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        response: apiErrorResponse({
          status: 413,
          code: "API_REQUEST_BODY_TOO_LARGE",
          message: "request body is too large",
        }),
      };
    }
    throw error;
  }
}
