// Mint synthetic first-session identities for the load smoke. Each user presents
// a self-signed HS256 JWT as the `lighthouse_moonlight_scholar_session` cookie;
// the server re-verifies it on every request, so no `/session` POST is needed.
//
// Auth contract verified against app/server/auth/moonlight-scholar-token.ts and
// the signMoonlightScholarToken helper in
// app/api/auth/moonlight-scholar/session/__tests__/route.test.ts.

import * as jwt from "jsonwebtoken";

/** Cookie name the server reads — see MOONLIGHT_SCHOLAR_SESSION_COOKIE. */
const SESSION_COOKIE = "lighthouse_moonlight_scholar_session";

/** Token lifetime (seconds). Mirrors MOONLIGHT_SCHOLAR_SESSION_MAX_AGE_SECONDS (15 min). */
const TOKEN_TTL_SECONDS = 900;

const DEFAULT_ISSUER = "moonlight";
const DEFAULT_AUDIENCE = "moonlight-scholar";

export interface AuthConfig {
  secret: string;
  issuer: string;
  audience: string;
}

export interface MintedSession {
  cookie: string;
  email: string;
  subject: string;
}

function readNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (trimmed === undefined || trimmed === "") return undefined;
  return trimmed;
}

/**
 * Resolve the JWT signing config from env, matching the server's expectations.
 * Fails fast with a clear message when the secret is unset (server would return
 * 503 MOONLIGHT_SCHOLAR_AUTH_NOT_CONFIGURED for every request otherwise).
 */
export function loadAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const secret = readNonEmpty(env.MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET);
  if (secret === undefined) {
    throw new Error(
      "MOONLIGHT_SCHOLAR_AUTH_JWT_SECRET is not set. Run via `npm run load-smoke` " +
        "(it loads .env.local with `tsx --env-file=.env.local`) and ensure the secret " +
        "matches the running server's value, or the server rejects every request (503).",
    );
  }
  return {
    secret,
    issuer: readNonEmpty(env.MOONLIGHT_SCHOLAR_AUTH_TOKEN_ISSUER) ?? DEFAULT_ISSUER,
    audience: readNonEmpty(env.MOONLIGHT_SCHOLAR_AUTH_TOKEN_AUDIENCE) ?? DEFAULT_AUDIENCE,
  };
}

/**
 * Mint a distinct identity for user `index`. The `@corca.ai` domain passes the
 * email allowlist (isInternalEmail), and a local Supabase URL bypasses it anyway.
 */
export function mintUserCookie(config: AuthConfig, index: number): MintedSession {
  const subject = `loadtest-user-${String(index)}`;
  const email = `loadtest-${String(index)}@corca.ai`;
  const token = jwt.sign({ email, plan: "pro", isAdmin: false }, config.secret, {
    algorithm: "HS256",
    audience: config.audience,
    issuer: config.issuer,
    expiresIn: TOKEN_TTL_SECONDS,
    subject,
  });
  return { cookie: `${SESSION_COOKIE}=${token}`, email, subject };
}
