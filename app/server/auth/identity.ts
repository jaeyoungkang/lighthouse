/**
 * 사용자 식별 — Moonlight Scholar 세션을 우선하고 Supabase Auth를 legacy fallback으로 둔다.
 *
 * @promise promise:search-results-fast-window
 * @check acceptance-check:search-results-fast-window-session-principal-handoff
 */

import { cache } from "react";
import { cookies } from "next/headers";

import { createAdminClient, createClient } from "@/app/server/auth/supabase";
import {
  createRepositoryDbHandle,
  type RepositoryDbHandle,
} from "@/app/lib/supabase/repository-db-handle";
import {
  hasSupabaseAuthSessionCookie,
  isLocalSupabaseUrl,
  isRefreshTokenNotFoundError,
} from "@/app/lib/supabase/auth-helpers";
import { normalizeEmail } from "@/app/lib/email";
import { isInternalEmail } from "@/app/server/auth/access-policy";
import {
  resolveProductAccessForEmail,
  type ProductAccessDecision,
} from "@/app/server/domain-access/access-allowlist-access";
import { UnauthenticatedError } from "./auth-errors";
import {
  MoonlightScholarAuthError,
  getMoonlightScholarSessionTokenFromCookies,
  verifyMoonlightScholarToken,
} from "./moonlight-scholar-token";

export interface CurrentUser {
  /**
   * Owner principal id — the authenticated principal (Moonlight token sub /
   * Supabase user id), NOT an app_users row id. Ownership scoping queries key on
   * this via `owner_principal_id`.
   */
  id: string;
  email: string;
}

export type AuthSource = "supabase" | "moonlight_scholar";

type ResolveAuthOptions = {
  readonly signal?: AbortSignal;
};

function createAuthRepositoryDbHandle(): RepositoryDbHandle {
  return createRepositoryDbHandle(createAdminClient());
}

export async function resolveCurrentProductAccessForEmail(
  email: string,
): Promise<ProductAccessDecision> {
  const normalizedEmail = normalizeEmail(email);
  if (isInternalEmail(normalizedEmail)) return "allowed";

  try {
    return await resolveProductAccessForEmail(createAuthRepositoryDbHandle(), normalizedEmail);
  } catch {
    return "unavailable";
  }
}

async function hasCurrentRequestSupabaseAuthSessionCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return hasSupabaseAuthSessionCookie(cookieStore.getAll());
  } catch {
    return true;
  }
}

/** 현재 요청의 세션과 사용자를 해석한다. 없으면 null. */
async function resolveAuthUncached(options?: ResolveAuthOptions) {
  if (!(await hasCurrentRequestSupabaseAuthSessionCookie())) {
    return null;
  }

  const db = await createClient(options?.signal ? { signal: options.signal } : undefined);
  let user = null;
  let error = null;

  try {
    const result = await db.auth.getUser();
    user = result.data.user;
    error = result.error;
  } catch (authError) {
    if (isRefreshTokenNotFoundError(authError)) {
      return null;
    }
    throw authError;
  }

  if (error || !user || !user.email) {
    return null;
  }

  const email = normalizeEmail(user.email);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let repositoryDb: RepositoryDbHandle;
  try {
    repositoryDb = createAuthRepositoryDbHandle();
  } catch {
    return null;
  }
  if (
    !isLocalSupabaseUrl(supabaseUrl) &&
    (await resolveProductAccessForEmail(repositoryDb, email)) !== "allowed"
  ) {
    return null;
  }
  const principal = user.id; // Supabase session → Supabase user id is the principal

  return {
    db: repositoryDb,
    source: "supabase" as const,
    user: { id: principal, email } satisfies CurrentUser,
  };
}

export const resolveAuth = cache(resolveAuthUncached);

export type AuthContext = {
  readonly db: RepositoryDbHandle;
  readonly source: AuthSource;
  readonly user: CurrentUser;
};

async function resolveMoonlightScholarAuthUncached(): Promise<AuthContext | null> {
  const token = await getMoonlightScholarSessionTokenFromCookies();

  if (!token) {
    return null;
  }

  try {
    const moonlightUser = verifyMoonlightScholarToken(token);
    const email = normalizeEmail(moonlightUser.email);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let db: RepositoryDbHandle;
    try {
      db = createAuthRepositoryDbHandle();
    } catch {
      return null;
    }
    if (
      !isLocalSupabaseUrl(supabaseUrl) &&
      (await resolveProductAccessForEmail(db, email)) !== "allowed"
    ) {
      return null;
    }

    const principal = moonlightUser.id; // verified token sub is the principal

    return {
      db,
      source: "moonlight_scholar",
      user: { id: principal, email },
    } satisfies AuthContext;
  } catch (error) {
    if (error instanceof MoonlightScholarAuthError) {
      return null;
    }

    throw error;
  }
}

const resolveMoonlightScholarAuth = cache(resolveMoonlightScholarAuthUncached);

/** 현재 요청의 사용자를 해석한다. 없으면 null. */
export async function resolveCurrentUser(
  options?: ResolveAuthOptions,
): Promise<CurrentUser | null> {
  const moonlightAuth = await resolveMoonlightScholarAuth();
  if (moonlightAuth) return moonlightAuth.user;

  const auth = options?.signal ? await resolveAuth(options) : await resolveAuth();
  return auth?.user ?? null;
}

/** 현재 요청의 세션과 사용자를 반드시 반환. 없으면 UnauthenticatedError. */
export async function requireAuth() {
  const auth = await resolveAuth();
  if (!auth) throw new UnauthenticatedError();
  return auth;
}

export async function requireOwnerPrincipalAuth() {
  const moonlightAuth = await resolveMoonlightScholarAuth();
  if (moonlightAuth) return moonlightAuth;

  return requireAuth();
}

/** 현재 요청의 사용자를 반드시 반환. 없으면 UnauthenticatedError. */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await resolveCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}
