import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  backfillOwnerPrincipalForEmail,
  ensureAppUser,
  upsertAppUserSnapshot,
} from "@/app/server/repository/app-users";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";

function buildAppUserRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    email: "user@example.com",
    created_at: "2026-04-09T00:00:00.000Z",
    onboarding_completed: false,
    onboarding_responses: null,
    ...overrides,
  };
}

function createDb(params: {
  upsertResult: { data: Record<string, unknown> | null; error: { code?: string } | null };
  updateResult?: { data: Record<string, unknown> | null; error: { code?: string } | null };
}) {
  const upsertSingle = vi.fn().mockResolvedValue(params.upsertResult);
  const updateSingle = vi
    .fn()
    .mockResolvedValue(params.updateResult ?? { data: buildAppUserRow(), error: null });
  const selectAfterUpsert = vi.fn().mockReturnValue({ single: upsertSingle });
  const selectAfterUpdate = vi.fn().mockReturnValue({ single: updateSingle });
  const eq = vi.fn().mockReturnValue({ select: selectAfterUpdate });
  const update = vi.fn().mockReturnValue({ eq });
  const upsert = vi.fn().mockReturnValue({ select: selectAfterUpsert });
  const from = vi.fn().mockReturnValue({ upsert, update });

  return {
    db: createRepositoryDbHandle({ from } as never),
    spies: {
      from,
      upsert,
      update,
      eq,
    },
  };
}

describe("app users repository", () => {
  it("upserts app users by email so auth re-creation can reuse the same row", async () => {
    const { db, spies } = createDb({
      upsertResult: {
        data: buildAppUserRow({ id: "user-1", email: "test@corca.ai" }),
        error: null,
      },
    });

    const result = await ensureAppUser(db, {
      id: "user-1",
      email: " Test@Corca.AI ",
    });

    expect(spies.upsert).toHaveBeenCalledWith(
      {
        id: "user-1",
        email: "test@corca.ai",
      },
      { onConflict: "email" },
    );
    expect(result).toMatchObject({
      id: "user-1",
      email: "test@corca.ai",
    });
  });

  it("falls back to id-based email repair when the same user id already exists", async () => {
    const { db, spies } = createDb({
      upsertResult: {
        data: null,
        error: { code: "23505" },
      },
      updateResult: {
        data: buildAppUserRow({ id: "user-1", email: "renamed@corca.ai" }),
        error: null,
      },
    });

    const result = await ensureAppUser(db, {
      id: "user-1",
      email: "renamed@corca.ai",
    });

    expect(spies.update).toHaveBeenCalledWith({ email: "renamed@corca.ai" });
    expect(spies.eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toMatchObject({
      id: "user-1",
      email: "renamed@corca.ai",
    });
  });

  it("upserts a display snapshot without overwriting the authoritative owner link", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    const db = createRepositoryDbHandle({ from } as never);

    await upsertAppUserSnapshot(db, {
      email: " Pilot@Example.com ",
    });

    expect(from).toHaveBeenCalledWith("app_users");
    expect(upsert).toHaveBeenCalledWith(
      {
        email: "pilot@example.com",
        last_seen: expect.any(String) as string,
      },
      { onConflict: "email" },
    );
  });

  it("asks the RPC to verify residual rows even when the principal is already linked", async () => {
    const { db, spies } = createBackfillDb({
      row: {
        id: "user-1",
        principal_linked_at: "2026-06-29T00:00:00.000Z",
        owner_principal_id: "moonlight-user-1",
      },
      rpcData: [],
    });

    const result = await backfillOwnerPrincipalForEmail(db, {
      principal: "moonlight-user-1",
      email: "pilot@example.com",
    });

    expect(result).toEqual({ changed: false });
    expect(spies.maybeSingle).toHaveBeenCalled();
    expect(spies.rpc).toHaveBeenCalledWith("backfill_owner_principal_for_app_user", {
      p_user_id: "user-1",
      p_owner_principal_id: "moonlight-user-1",
    });
  });

  it("backfills NULL and migration-filled Supabase principal rows then stamps principal_linked_at", async () => {
    const { db, spies } = createBackfillDb({
      row: { id: "user-1", principal_linked_at: null, owner_principal_id: "user-1" },
    });

    const result = await backfillOwnerPrincipalForEmail(db, {
      principal: "moonlight-user-1",
      email: " Pilot@Example.com ",
    });

    expect(result).toEqual({ changed: true, previousPrincipalIds: ["user-1"] });
    expect(spies.selectEq).toHaveBeenCalledWith("email", "pilot@example.com");
    expect(spies.schema).toHaveBeenCalledWith("lighthouse");
    expect(spies.rpc).toHaveBeenCalledWith("backfill_owner_principal_for_app_user", {
      p_user_id: "user-1",
      p_owner_principal_id: "moonlight-user-1",
    });
  });

  it("preserves a concurrent no-op result from the atomic backfill RPC", async () => {
    const { db } = createBackfillDb({
      row: { id: "user-1", principal_linked_at: null, owner_principal_id: "user-1" },
      rpcData: [],
    });

    await expect(
      backfillOwnerPrincipalForEmail(db, {
        principal: "moonlight-user-1",
        email: "pilot@example.com",
      }),
    ).resolves.toEqual({ changed: false });
  });

  it("returns every prior cache identity reported during residual reconciliation", async () => {
    const { db } = createBackfillDb({
      row: {
        id: "user-1",
        principal_linked_at: "2026-06-29T00:00:00.000Z",
        owner_principal_id: "moonlight-user-new",
      },
      rpcData: ["moonlight-user-old", "user-1"],
    });

    await expect(
      backfillOwnerPrincipalForEmail(db, {
        principal: "moonlight-user-new",
        email: "pilot@example.com",
      }),
    ).resolves.toEqual({
      changed: true,
      previousPrincipalIds: ["moonlight-user-old", "user-1"],
    });
  });

  it("preserves every known cache identity when the atomic RPC rejects a principal mismatch", async () => {
    const { db } = createBackfillDb({
      row: {
        id: "user-1",
        principal_linked_at: "2026-06-29T00:00:00.000Z",
        owner_principal_id: "moonlight-user-old",
      },
      rpcError: { code: "PGRST500" },
    });

    await expect(
      backfillOwnerPrincipalForEmail(db, {
        principal: "moonlight-user-1",
        email: "pilot@example.com",
      }),
    ).rejects.toMatchObject({
      name: "OwnerPrincipalBackfillError",
      previousPrincipalIds: ["user-1", "moonlight-user-old"],
      cause: { code: "PGRST500" },
    });
  });

  it("pins collision reconciliation, residual verification, and service-role-only execution", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/00022_atomic_owner_principal_backfill.sql"),
      "utf8",
    );
    const smoke = readFileSync(
      path.join(process.cwd(), "scripts/architecture-fitness/owner-principal-backfill-smoke.sql"),
      "utf8",
    );
    const mismatchGuardIndex = sql.indexOf(
      "app user is already linked to a different owner principal",
    );
    const deleteIndex = sql.indexOf("delete from lighthouse.reviewed_papers as legacy");
    const reviewedUpdateIndex = sql.indexOf("update lighthouse.reviewed_papers as paper");
    const residualCheckIndex = sql.indexOf("reviewed paper owner backfill left legacy rows");
    const linkUpdateIndex = sql.indexOf("update public.app_users as app_user");

    expect(deleteIndex).toBeGreaterThan(-1);
    expect(mismatchGuardIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(mismatchGuardIndex);
    expect(reviewedUpdateIndex).toBeGreaterThan(deleteIndex);
    expect(residualCheckIndex).toBeGreaterThan(reviewedUpdateIndex);
    expect(linkUpdateIndex).toBeGreaterThan(residualCheckIndex);
    expect(sql).toContain("current.paper_id = legacy.paper_id");
    expect(sql).toContain("reviewed paper owner backfill left legacy rows");
    expect(sql).toContain("interaction event owner backfill left legacy rows");
    expect(sql).toContain("array_agg(distinct candidate.principal_id)");
    expect(sql).toContain("paper.owner_principal_id is distinct from p_owner_principal_id");
    expect(sql).toContain("app user is already linked to a different owner principal");
    expect(sql).toContain("reviewed paper owner backfill found a non-legacy principal");
    expect(sql).toContain("interaction event owner backfill found a non-legacy principal");
    expect(sql).toContain("paper.owner_principal_id = p_user_id::text");
    expect(sql).toContain("event.owner_principal_id = p_user_id::text");
    expect(sql).toContain("set lock_timeout = '3s'");
    expect(sql).toContain("set statement_timeout = '10s'");
    expect(sql).not.toContain("security definer");
    expect(sql).toMatch(
      /revoke all on function lighthouse\.backfill_owner_principal_for_app_user\(uuid, text\)[\s\S]*?from public, anon, authenticated;/,
    );
    expect(sql).toMatch(
      /grant execute on function lighthouse\.backfill_owner_principal_for_app_user\(uuid, text\)[\s\S]*?to service_role;/,
    );
    expect(smoke).toContain("'collision-paper', 'legacy collision'");
    expect(smoke).toContain("'distinct-paper', 'legacy distinct'");
    expect(smoke).toContain("'collision-paper', 'current collision'");
    expect(smoke).toContain("non-colliding reviewed paper was not moved");
    expect(smoke).toContain("same-principal repair did not move the stranded row");
    expect(smoke).toContain("principal mismatch was accepted");
    expect(smoke).toContain("principal mismatch changed the authoritative link");
    expect(smoke).toContain("non-legacy reviewed-paper owner was transferred");
    expect(smoke).toContain("non-legacy interaction owner was transferred");
    expect(smoke).toContain("fully reconciled owner principal backfill was not a no-op");
    expect(smoke).toContain("\\if :{?local_smoke}");
    expect(smoke).toContain("--set local_smoke=1");
    expect(smoke).toContain("rollback;");
  });
});

function createBackfillDb(params: {
  row: {
    id: string;
    principal_linked_at: string | null;
    owner_principal_id?: string | null;
  } | null;
  rpcData?: string[];
  rpcError?: { code: string };
}) {
  // app_users: select("id, principal_linked_at, owner_principal_id").eq("email", …).maybeSingle()
  const maybeSingle = vi.fn().mockResolvedValue({ data: params.row, error: null });
  const selectEq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: selectEq });

  const appUsersTable = { select };
  const from = vi.fn().mockReturnValue(appUsersTable);

  const rpc = vi.fn().mockResolvedValue({
    data: params.rpcData ?? ["user-1"],
    error: params.rpcError ?? null,
  });
  const schema = vi.fn().mockReturnValue({ rpc });

  const db = createRepositoryDbHandle({ from, schema } as never);
  return {
    db,
    spies: {
      from,
      select,
      selectEq,
      maybeSingle,
      schema,
      rpc,
    },
  };
}
