import { cookies } from "next/headers";
import * as jwt from "jsonwebtoken";
import { JsonWebTokenError, TokenExpiredError, type JwtPayload } from "jsonwebtoken";
import * as moonlightSessionCookie from "@/app/server/auth/moonlight-scholar-session-cookie";

export const MOONLIGHT_SCHOLAR_SESSION_COOKIE =
  moonlightSessionCookie.MOONLIGHT_SCHOLAR_SESSION_COOKIE;
export const MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE =
  moonlightSessionCookie.MOONLIGHT_SCHOLAR_LOCAL_SESSION_COOKIE;
export const MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES =
  moonlightSessionCookie.MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES;
export const MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES =
  moonlightSessionCookie.MOONLIGHT_SCHOLAR_SESSION_CLEAR_COOKIE_NAMES;
export const MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS =
  moonlightSessionCookie.MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS;

export type MoonlightScholarUser = {
  readonly id: string;
  readonly email: string;
  readonly plan?: string;
  readonly isAdmin?: boolean;
};

type MoonlightScholarAuthConfig =
  | {
      readonly mode: "disabled";
    }
  | {
      readonly mode: "jwt";
      readonly jwtSecret: string;
      readonly issuer: string;
      readonly audience: string;
    };

type MoonlightScholarAuthErrorCode =
  | "MOONLIGHT_SCHOLAR_ORIGIN_INVALID"
  | "MOONLIGHT_SCHOLAR_AUTH_NOT_CONFIGURED"
  | "MOONLIGHT_SCHOLAR_TOKEN_EXPIRED"
  | "MOONLIGHT_SCHOLAR_TOKEN_INVALID"
  | "MOONLIGHT_SCHOLAR_TOKEN_MISSING";

export class MoonlightScholarAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code: MoonlightScholarAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MoonlightScholarAuthError";
  }
}

const DEFAULT_ISSUER = "moonlight";
const DEFAULT_AUDIENCE = "moonlight-scholar";

export function verifyMoonlightScholarBearerToken(
  authorizationHeader: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): MoonlightScholarUser {
  const config = loadMoonlightScholarAuthConfig(env);

  if (config.mode === "disabled") {
    throw new MoonlightScholarAuthError(
      503,
      "MOONLIGHT_SCHOLAR_AUTH_NOT_CONFIGURED",
      "Moonlight Scholar auth is not configured.",
    );
  }

  return verifyMoonlightScholarTokenWithConfig(parseBearerToken(authorizationHeader), config);
}

export function verifyMoonlightScholarToken(
  token: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): MoonlightScholarUser {
  const config = loadMoonlightScholarAuthConfig(env);

  if (config.mode === "disabled") {
    throw new MoonlightScholarAuthError(
      503,
      "MOONLIGHT_SCHOLAR_AUTH_NOT_CONFIGURED",
      "Moonlight Scholar auth is not configured.",
    );
  }

  return verifyMoonlightScholarTokenWithConfig(parseRawToken(token), config);
}

function verifyMoonlightScholarTokenWithConfig(
  token: string,
  config: Extract<MoonlightScholarAuthConfig, { readonly mode: "jwt" }>,
): MoonlightScholarUser {
  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      audience: config.audience,
      issuer: config.issuer,
    });

    return parseMoonlightScholarUser(payload);
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new MoonlightScholarAuthError(
        401,
        "MOONLIGHT_SCHOLAR_TOKEN_EXPIRED",
        "Moonlight Scholar token expired.",
      );
    }

    if (error instanceof JsonWebTokenError) {
      throw new MoonlightScholarAuthError(
        401,
        "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
        "Moonlight Scholar token invalid.",
      );
    }

    throw error;
  }
}

function loadMoonlightScholarAuthConfig(env: NodeJS.ProcessEnv): MoonlightScholarAuthConfig {
  const jwtSecret = env.MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET?.trim();

  if (!jwtSecret) {
    return { mode: "disabled" };
  }

  return {
    mode: "jwt",
    jwtSecret,
    issuer: parseRequiredString(
      env.MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER?.trim(),
      DEFAULT_ISSUER,
      "MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER",
    ),
    audience: parseRequiredString(
      env.MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE?.trim(),
      DEFAULT_AUDIENCE,
      "MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE",
    ),
  };
}

function parseBearerToken(authorizationHeader: string | null | undefined): string {
  if (authorizationHeader === undefined || authorizationHeader === null) {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
      "Moonlight Scholar bearer token required.",
    );
  }

  const [scheme, token, extra] = authorizationHeader.trim().split(/\s+/);

  if (scheme.toLowerCase() !== "bearer" || !token || extra) {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  return token;
}

function parseRawToken(token: string | null | undefined): string {
  if (token === undefined || token === null || token.trim() === "") {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_MISSING",
      "Moonlight Scholar bearer token required.",
    );
  }

  if (/\s/.test(token)) {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  return token;
}

function parseMoonlightScholarUser(payload: string | JwtPayload): MoonlightScholarUser {
  if (typeof payload === "string") {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  const rawId = payload.sub;
  const { email: rawEmail, isAdmin, plan } = payload;

  if (
    typeof rawId !== "string" ||
    rawId.trim() === "" ||
    typeof rawEmail !== "string" ||
    rawEmail.trim() === ""
  ) {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  const id = rawId.trim();
  const email = rawEmail.trim();

  if (plan !== undefined && (typeof plan !== "string" || plan.trim() === "")) {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  if (isAdmin !== undefined && typeof isAdmin !== "boolean") {
    throw new MoonlightScholarAuthError(
      401,
      "MOONLIGHT_SCHOLAR_TOKEN_INVALID",
      "Moonlight Scholar token invalid.",
    );
  }

  return {
    id,
    email,
    ...(typeof plan === "string" ? { plan: plan.trim() } : {}),
    ...(typeof isAdmin === "boolean" ? { isAdmin } : {}),
  };
}

export function assertSameOriginMoonlightScholarSessionRequest(
  requestUrl: string,
  origin: string | null,
): void {
  if (origin === null || origin.trim() === "" || origin !== new URL(requestUrl).origin) {
    throw new MoonlightScholarAuthError(
      403,
      "MOONLIGHT_SCHOLAR_ORIGIN_INVALID",
      "Moonlight Scholar session request origin invalid.",
    );
  }
}

export async function getMoonlightScholarSessionTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    for (const cookieName of MOONLIGHT_SCHOLAR_SESSION_COOKIE_NAMES) {
      const token = cookieStore.get(cookieName)?.value;
      if (token?.trim()) return token;
    }
  } catch {
    return null;
  }

  return null;
}

function parseRequiredString(value: string | undefined, fallback: string, name: string): string {
  const resolved = value ?? fallback;
  const trimmed = resolved.trim();

  if (trimmed === "") {
    throw new Error(`${name} is required.`);
  }

  return trimmed;
}
