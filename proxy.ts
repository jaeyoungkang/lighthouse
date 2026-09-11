import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-session-principal-handoff
import {
  buildAuthConfirmRedirectUrl,
  hasSupabaseAuthSessionCookie as hasSupabaseAuthSessionCookieFromCookies,
  isRefreshTokenNotFoundError,
  listSupabaseAuthCookieNames,
} from "@/app/lib/supabase/auth-helpers";
import { MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES } from "@/app/server/auth/moonlight-scholar-session-cookie";

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[proxy] Missing ${name}`);
  }

  return value;
}

function createForwardResponse(request: NextRequest): NextResponse {
  return NextResponse.next({ request: { headers: request.headers } });
}

function clearStaleAuthCookies(request: NextRequest): NextResponse {
  const staleCookieNames = listSupabaseAuthCookieNames(request.cookies.getAll());
  staleCookieNames.forEach((name) => {
    request.cookies.delete(name);
  });

  const response = createForwardResponse(request);
  staleCookieNames.forEach((name) => {
    response.cookies.delete(name);
  });

  return response;
}

function hasSupabaseAuthSessionCookie(request: NextRequest): boolean {
  return hasSupabaseAuthSessionCookieFromCookies(request.cookies.getAll());
}

function hasMoonlightScholarSessionCookie(request: NextRequest): boolean {
  return MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES.some((cookieName) => {
    const cookie = request.cookies.get(cookieName);
    return typeof cookie?.value === "string" && cookie.value.trim().length > 0;
  });
}

function shouldBypassSupabaseSessionRefresh(request: NextRequest): boolean {
  const pathname = request.nextUrl.pathname;
  return (
    pathname === "/" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/analytics-events" ||
    pathname === "/api/errors"
  );
}

/**
 * Supabase Auth 세션 갱신 프록시.
 * Moonlight Scholar 세션이 없는 legacy Supabase 요청에서만 쿠키 기반 세션을 갱신한다.
 */
export async function proxy(request: NextRequest) {
  const authConfirmRedirectUrl = buildAuthConfirmRedirectUrl(request.url);
  if (authConfirmRedirectUrl) {
    return NextResponse.redirect(authConfirmRedirectUrl);
  }

  if (hasMoonlightScholarSessionCookie(request)) {
    return NextResponse.next();
  }

  if (shouldBypassSupabaseSessionRefresh(request)) {
    return NextResponse.next();
  }

  if (!hasSupabaseAuthSessionCookie(request)) {
    return NextResponse.next();
  }

  let supabaseResponse = createForwardResponse(request);

  const supabase = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = createForwardResponse(request);
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.getUser();
    if (isRefreshTokenNotFoundError(error)) {
      supabaseResponse = clearStaleAuthCookies(request);
    }
  } catch (error) {
    if (isRefreshTokenNotFoundError(error)) {
      supabaseResponse = clearStaleAuthCookies(request);
    } else {
      throw error;
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
