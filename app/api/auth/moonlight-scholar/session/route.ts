import { NextResponse, type NextRequest } from "next/server";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-session-principal-handoff

import {
  MOONLIGHT_SCHOLAR_SESSION_COOKIE,
  MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES,
  MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS,
  MoonlightScholarAuthError,
  assertSameOriginMoonlightScholarSessionRequest,
  verifyMoonlightScholarToken,
} from "@/app/server/auth/moonlight-scholar-token";
import { scheduleAppUserSnapshot } from "@/app/server/auth/app-user-snapshot";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { z } from "zod";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const runtime = "nodejs";
export const maxDuration = 15;

const moonlightScholarSessionRequestSchema = z
  .object({
    token: z.string().trim().min(1).max(12_288),
  })
  .strict();

const guardedPOST = withRouteGuard(async (request: NextRequest): Promise<NextResponse> => {
  try {
    assertSameOriginMoonlightScholarSessionRequest(request.url, request.headers.get("origin"));
    const tokenResult = await readToken(request);
    if (!tokenResult.ok) return tokenResult.response;
    const token = tokenResult.token;
    const user = verifyMoonlightScholarToken(token);
    scheduleAppUserSnapshot({ principal: user.id, email: user.email, backfill: true });
    const response = NextResponse.json({
      ok: true,
      user,
    });

    response.cookies.set(MOONLIGHT_SCHOLAR_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    if (error instanceof MoonlightScholarAuthError) {
      return toAuthErrorResponse(error);
    }

    throw error;
  }
});

export async function POST(request: NextRequest): Promise<Response | NextResponse> {
  return guardedPOST(request);
}

export function DELETE(): NextResponse {
  const response = NextResponse.json({ ok: true });
  for (const cookieName of MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES) {
    response.cookies.set(cookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }
  return response;
}

async function readToken(
  request: NextRequest,
): Promise<{ ok: true; token: string } | { ok: false; response: NextResponse }> {
  const body = await readRouteJsonBody(
    request,
    getRouteBodyLimit("app/api/auth/moonlight-scholar/session/route.ts"),
  );
  if (!body.ok) return body;
  const parsed = moonlightScholarSessionRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    if (
      typeof body.body !== "object" ||
      body.body === null ||
      !("token" in body.body) ||
      typeof body.body.token !== "string"
    ) {
      return { ok: true, token: "" };
    }
    throw new MoonlightScholarAuthError(
      400,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }
  return { ok: true, token: parsed.data.token };
}

function toAuthErrorResponse(error: MoonlightScholarAuthError): NextResponse {
  return apiErrorResponse({
    status: error.status,
    code: error.code,
    message: error.message,
    extensions: { ok: false },
    preserveLegacyErrorObject: true,
  });
}
