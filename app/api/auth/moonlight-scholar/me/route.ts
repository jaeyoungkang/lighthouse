import { NextResponse, type NextRequest } from "next/server";

import {
  MoonlightScholarAuthError,
  verifyMoonlightScholarBearerToken,
} from "@/app/server/auth/moonlight-scholar-token";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { withRouteGuard } from "@/app/server/guards/route-guard";

export const runtime = "nodejs";
export const maxDuration = 15;

const guardedGET = withRouteGuard((request: NextRequest): Promise<NextResponse> => {
  try {
    const user = verifyMoonlightScholarBearerToken(request.headers.get("authorization"));

    return Promise.resolve(
      NextResponse.json({
        ok: true,
        user,
      }),
    );
  } catch (error) {
    if (error instanceof MoonlightScholarAuthError) {
      return Promise.resolve(
        apiErrorResponse({
          status: error.status,
          code: error.code,
          message: error.message,
          extensions: { ok: false },
          preserveLegacyErrorObject: true,
        }),
      );
    }

    return Promise.reject(
      error instanceof Error
        ? error
        : new Error("unknown Moonlight Scholar authentication failure", { cause: error }),
    );
  }
});

export async function GET(request: NextRequest): Promise<Response | NextResponse> {
  return guardedGET(request);
}
