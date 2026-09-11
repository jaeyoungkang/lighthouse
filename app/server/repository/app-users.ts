import type { RepositoryDbHandle } from "./db";
import { getLighthouseDbFor, getRepositoryDbFor } from "./db";
import { parseSingleRow } from "./row-parsers";
import type { OnboardingResponses } from "@/app/domain/onboarding";
import { z } from "zod";
import { t } from "@/app/i18n/message-access";
import { normalizeEmail } from "@/app/lib/email";

// Re-exported for existing repository/auth importers; the pure util lives in
// `@/app/lib/email` so non-repository layers (e.g. services) can use it without
// crossing the services-should-be-pure boundary.
export { normalizeEmail };

export interface AppUser {
  id: string;
  email: string;
  createdAt: string;
  onboardingCompleted: boolean;
  onboardingResponses: OnboardingResponses | null;
}

export interface OwnerPrincipalBackfillResult {
  changed: boolean;
  previousPrincipalIds?: string[];
}

class OwnerPrincipalBackfillError extends Error {
  readonly previousPrincipalIds: string[];

  constructor(previousPrincipalIds: string[], cause: unknown) {
    super("owner principal backfill failed", { cause });
    this.name = "OwnerPrincipalBackfillError";
    this.previousPrincipalIds = previousPrincipalIds;
  }
}

interface AppUserRow {
  id: string;
  email: string;
  created_at: string;
  onboarding_completed: boolean;
  onboarding_responses: OnboardingResponses | null;
}

const onboardingResponsesSchema = z.object({
  role: z.string(),
  researchField: z.string(),
  narrativeStyle: z.string().optional(),
  agentName: z.string(),
  researchRole: z.string().optional(),
  coreExpectation: z.string().optional(),
  workApproach: z.string().optional(),
  userQuestion: z.string().optional(),
});

const appUserRowSchema = z.object({
  id: z.string(),
  email: z.string(),
  created_at: z.string(),
  onboarding_completed: z.boolean(),
  onboarding_responses: onboardingResponsesSchema.nullable(),
});

const agentNameRowSchema = z.object({
  agent_name: z.string().nullable(),
  onboarding_responses: onboardingResponsesSchema.nullable(),
});

const onboardingStatusRowSchema = z.object({
  onboarding_completed: z.boolean(),
  onboarding_responses: onboardingResponsesSchema.nullable(),
});

function toAppUser(row: AppUserRow): AppUser {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    onboardingCompleted: row.onboarding_completed,
    onboardingResponses: row.onboarding_responses,
  };
}

function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === "23505";
}

export async function ensureAppUser(
  db: RepositoryDbHandle,
  user: { id: string; email: string },
): Promise<AppUser> {
  const repositoryDb = getRepositoryDbFor(db);
  const normalizedEmail = normalizeEmail(user.email);
  const upsertResult = await repositoryDb
    .from("app_users")
    .upsert(
      {
        id: user.id,
        email: normalizedEmail,
      },
      { onConflict: "email" },
    )
    .select()
    .single();

  if (!upsertResult.error) {
    return toAppUser(parseSingleRow(appUserRowSchema, upsertResult.data, "app_users ensure"));
  }

  if (!isUniqueViolation(upsertResult.error)) {
    throw upsertResult.error;
  }

  const updateResult = await repositoryDb
    .from("app_users")
    .update({ email: normalizedEmail })
    .eq("id", user.id)
    .select()
    .single();

  if (updateResult.error) throw updateResult.error;
  return toAppUser(parseSingleRow(appUserRowSchema, updateResult.data, "app_users ensure"));
}

/** 이메일로 사용자 조회. 없으면 null. */
export async function getUserByEmail(
  db: RepositoryDbHandle,
  email: string,
): Promise<AppUser | null> {
  const normalized = normalizeEmail(email);
  const userResult = await getRepositoryDbFor(db)
    .from("app_users")
    .select("*")
    .eq("email", normalized)
    .single();

  if (userResult.error) {
    if (userResult.error.code === "PGRST116") return null;
    throw userResult.error;
  }

  return toAppUser(parseSingleRow(appUserRowSchema, userResult.data, "app_users get by email"));
}

/** 이메일로 사용자 조회 또는 생성. */
export async function getOrCreateUserByEmail(
  db: RepositoryDbHandle,
  email: string,
): Promise<AppUser> {
  const normalized = normalizeEmail(email);

  const existing = await getUserByEmail(db, normalized);
  if (existing) return existing;

  const upsertResult = await getRepositoryDbFor(db)
    .from("app_users")
    .upsert({ email: normalized }, { onConflict: "email" })
    .select()
    .single();

  if (upsertResult.error) throw upsertResult.error;
  return toAppUser(
    parseSingleRow(appUserRowSchema, upsertResult.data, "app_users get or create by email"),
  );
}

const ownerPrincipalLinkRowSchema = z.object({
  id: z.string(),
  principal_linked_at: z.string().nullable(),
  owner_principal_id: z.string().nullable().optional(),
});

/**
 * 표시/운영용 app_users 스냅샷만 갱신한다(이메일 기준). Ownership link를 나타내는
 * owner_principal_id/principal_linked_at은 backfill RPC만 갱신한다. auth hot-path를 막지
 * 않도록 호출자에게 throw하지 않는다 — 실패는 삼킨다.
 */
export async function upsertAppUserSnapshot(
  adminDb: RepositoryDbHandle,
  input: { email: string },
): Promise<void> {
  const normalizedEmail = normalizeEmail(input.email);
  await getRepositoryDbFor(adminDb).from("app_users").upsert(
    {
      email: normalizedEmail,
      last_seen: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
}

/**
 * Moonlight 사전 존재 rows의 owner_principal_id를 lazy backfill한다.
 * RPC가 app-user legacy rows와 부분 완료 상태를 reconcile한다. 이미 연결된
 * principal과 다른 token subject는 email continuity만으로 승계 권한을 인정하지 않고 거부한다.
 */
export async function backfillOwnerPrincipalForEmail(
  adminDb: RepositoryDbHandle,
  input: { principal: string; email: string },
): Promise<OwnerPrincipalBackfillResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const repositoryDb = getRepositoryDbFor(adminDb);

  const rowResult = await repositoryDb
    .from("app_users")
    .select("id, principal_linked_at, owner_principal_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (rowResult.error) throw rowResult.error;
  if (!rowResult.data) return { changed: false };

  const row = ownerPrincipalLinkRowSchema.parse(rowResult.data);
  try {
    const lighthouseDb = getLighthouseDbFor(adminDb);
    const result = await lighthouseDb.rpc("backfill_owner_principal_for_app_user", {
      p_user_id: row.id,
      p_owner_principal_id: input.principal,
    });
    if (result.error) throw result.error;
    const previousPrincipalIds = z.array(z.string()).parse(result.data);
    return previousPrincipalIds.length > 0
      ? { changed: true, previousPrincipalIds }
      : { changed: false };
  } catch (error) {
    const previousPrincipalIds = [
      row.id,
      ...(row.owner_principal_id && row.owner_principal_id !== input.principal
        ? [row.owner_principal_id]
        : []),
    ];
    throw new OwnerPrincipalBackfillError([...new Set(previousPrincipalIds)], error);
  }
}

// 아래 온보딩 fn들의 `userId`는 app_users.id(스냅샷 PK)이지 owner principal이 아니다.
// 현재 live 호출자가 없는 dormant 코드다. 재사용 시 반드시 email로 principal을 먼저 해석한다.
/** 온보딩 응답과 에이전트 이름을 저장한다. 완료 플래그는 별도 write에서 처리한다. */
export async function saveOnboardingResponses(
  db: RepositoryDbHandle,
  userId: string,
  responses: OnboardingResponses,
): Promise<void> {
  const { error } = await getRepositoryDbFor(db)
    .from("app_users")
    .update({
      onboarding_responses: responses,
      agent_name: responses.agentName,
    })
    .eq("id", userId);

  if (error) throw error;
}

/** 온보딩 완료 플래그를 찍는다. Search-first 연구 route 진입 준비가 끝나면 호출한다. */
export async function markOnboardingCompleted(
  db: RepositoryDbHandle,
  userId: string,
): Promise<void> {
  const { error } = await getRepositoryDbFor(db)
    .from("app_users")
    .update({ onboarding_completed: true })
    .eq("id", userId);
  if (error) throw error;
}

/** 에이전트 이름 조회 (agent_name → onboarding_responses.agentName → "연구 동료" fallback) */
export async function getAgentName(db: RepositoryDbHandle, userId: string): Promise<string> {
  const agentNameResult = await getRepositoryDbFor(db)
    .from("app_users")
    .select("agent_name, onboarding_responses")
    .eq("id", userId)
    .single();

  if (agentNameResult.error) return t("common.label.app-users");

  const row = parseSingleRow(agentNameRowSchema, agentNameResult.data, "app_users get agent name");
  return row.agent_name || row.onboarding_responses?.agentName || t("common.label.app-users");
}

/** 사용자의 온보딩 완료 여부 조회 */
export async function getOnboardingStatus(
  db: RepositoryDbHandle,
  userId: string,
): Promise<{
  completed: boolean;
  responses: OnboardingResponses | null;
}> {
  const onboardingStatusResult = await getRepositoryDbFor(db)
    .from("app_users")
    .select("onboarding_completed, onboarding_responses")
    .eq("id", userId)
    .single();

  if (onboardingStatusResult.error) throw onboardingStatusResult.error;

  const row = parseSingleRow(
    onboardingStatusRowSchema,
    onboardingStatusResult.data,
    "app_users get onboarding status",
  );

  return {
    completed: row.onboarding_completed,
    responses: row.onboarding_responses,
  };
}
