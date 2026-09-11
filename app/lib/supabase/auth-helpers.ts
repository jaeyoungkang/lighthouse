import { tPublicClient as t } from "@/app/i18n/public-client-messages";

const SUPABASE_AUTH_COOKIE_PREFIX = "sb-";
const SUPABASE_AUTH_COOKIE_FRAGMENT = "-auth-token";
const SUPABASE_PKCE_VERIFIER_COOKIE_FRAGMENT = "-code-verifier";
const LOCAL_SUPABASE_HOSTS = new Set(["127.0.0.1", "localhost"]);
const LOCAL_AUTH_INBOX_URL = "http://127.0.0.1:54324";

export function isRefreshTokenNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "refresh_token_not_found"
  );
}

export function listSupabaseAuthCookieNames(cookies: ReadonlyArray<{ name: string }>): string[] {
  return cookies
    .filter(
      ({ name }) =>
        name.startsWith(SUPABASE_AUTH_COOKIE_PREFIX) &&
        name.includes(SUPABASE_AUTH_COOKIE_FRAGMENT) &&
        !name.includes(SUPABASE_PKCE_VERIFIER_COOKIE_FRAGMENT),
    )
    .map(({ name }) => name);
}

export function hasSupabaseAuthSessionCookie(cookies: ReadonlyArray<{ name: string }>): boolean {
  return listSupabaseAuthCookieNames(cookies).length > 0;
}

export function isLocalSupabaseUrl(url: string | undefined): boolean {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return LOCAL_SUPABASE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function getAuthEmailRestrictionMessage(supabaseUrl: string | undefined): string {
  if (isLocalSupabaseUrl(supabaseUrl)) {
    return t("auth.label.auth-helpers");
  }

  return t("auth.label.auth-helpers.2");
}

export function getLocalAuthInboxUrl(supabaseUrl: string | undefined): string | null {
  return isLocalSupabaseUrl(supabaseUrl) ? LOCAL_AUTH_INBOX_URL : null;
}

function applyRequestHost(url: URL, requestHost: string): void {
  const host = requestHost.split(",")[0]?.trim();
  if (!host) return;

  try {
    const parsedHost = new URL(`${url.protocol}//${host}`);
    url.hostname = parsedHost.hostname;
    url.port = parsedHost.port;
  } catch {
    url.host = host;
  }
}

function getForwardedHttpProtocol(forwardedProto?: string | null): "http:" | "https:" | null {
  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "http" || proto === "https" ? `${proto}:` : null;
}

export function buildEmailRedirectUrl(
  origin: string,
  requestHost?: string | null,
  forwardedProto?: string | null,
): string {
  try {
    const url = new URL(origin);

    if (requestHost) {
      applyRequestHost(url, requestHost);
    }

    const proto = getForwardedHttpProtocol(forwardedProto);
    if (proto) {
      url.protocol = proto;
    }

    return `${url.origin}/auth/confirm`;
  } catch {
    return `${origin}/auth/confirm`;
  }
}

export function buildAuthConfirmRedirectUrl(requestUrl: string): string | null {
  try {
    const url = new URL(requestUrl);

    if (!url.searchParams.has("code") || url.pathname === "/auth/confirm") {
      return null;
    }

    const redirectUrl = new URL("/auth/confirm", url.origin);
    url.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });

    return redirectUrl.toString();
  } catch {
    return null;
  }
}

export function buildAppRedirectUrl(
  requestUrl: string,
  nextPath: string,
  requestHost?: string | null,
  forwardedProto?: string | null,
): string {
  try {
    const url = new URL(requestUrl);

    if (requestHost) {
      applyRequestHost(url, requestHost);
    }

    const proto = getForwardedHttpProtocol(forwardedProto);
    if (proto) {
      url.protocol = proto;
    }

    if (!nextPath.startsWith("/") || (url.protocol !== "http:" && url.protocol !== "https:")) {
      return url.origin === "null" ? "/" : `${url.origin}/`;
    }

    const appOrigin = url.origin;
    const redirectUrl = new URL(nextPath, appOrigin);

    return redirectUrl.origin === appOrigin ? redirectUrl.toString() : `${appOrigin}/`;
  } catch {
    return "/";
  }
}
