import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  createAdminClient: vi.fn(() => ({ source: "admin-client" })),
  createRepositoryDbHandle: vi.fn(() => ({ source: "repository-handle" })),
  upsertAppUserSnapshot: vi.fn(),
  backfillOwnerPrincipalForEmail: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));

vi.mock("@/app/server/auth/supabase", () => ({
  createAdminClient: mocks.createAdminClient,
}));

vi.mock("@/app/lib/supabase/repository-db-handle", () => ({
  createRepositoryDbHandle: mocks.createRepositoryDbHandle,
}));

vi.mock("@/app/server/repository/app-users", () => ({
  upsertAppUserSnapshot: mocks.upsertAppUserSnapshot,
  backfillOwnerPrincipalForEmail: mocks.backfillOwnerPrincipalForEmail,
}));

function getScheduledRun(): () => Promise<void> {
  const run = mocks.after.mock.calls.at(-1)?.[0];
  if (typeof run !== "function") throw new Error("expected an after() callback");
  return run;
}

describe("app user snapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertAppUserSnapshot.mockResolvedValue(undefined);
    mocks.backfillOwnerPrincipalForEmail.mockResolvedValue({ changed: false });
  });

  it("upserts the snapshot and reconciles ownership in response-tail work", async () => {
    mocks.backfillOwnerPrincipalForEmail.mockResolvedValue({
      changed: true,
      previousPrincipalIds: ["supabase-user-1", "moonlight-user-old"],
    });
    const { scheduleAppUserSnapshot } = await import("../app-user-snapshot");

    scheduleAppUserSnapshot({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
      backfill: true,
    });
    await getScheduledRun()();

    expect(mocks.upsertAppUserSnapshot).toHaveBeenCalledWith(
      { source: "repository-handle" },
      { email: "pilot@example.com" },
    );
    expect(mocks.backfillOwnerPrincipalForEmail).toHaveBeenCalledWith(
      { source: "repository-handle" },
      { principal: "moonlight-user-1", email: "pilot@example.com" },
    );
  });

  it("skips owner reconciliation when backfill is disabled", async () => {
    const { scheduleAppUserSnapshot } = await import("../app-user-snapshot");

    scheduleAppUserSnapshot({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
    });
    await getScheduledRun()();

    expect(mocks.upsertAppUserSnapshot).toHaveBeenCalledOnce();
    expect(mocks.backfillOwnerPrincipalForEmail).not.toHaveBeenCalled();
  });

  it("keeps response-tail snapshot and backfill failures best-effort", async () => {
    mocks.upsertAppUserSnapshot.mockRejectedValue(new Error("snapshot unavailable"));
    mocks.backfillOwnerPrincipalForEmail.mockRejectedValue(new Error("link stamp failed"));
    const { scheduleAppUserSnapshot } = await import("../app-user-snapshot");

    scheduleAppUserSnapshot({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
      backfill: true,
    });
    await expect(getScheduledRun()()).resolves.toBeUndefined();
    expect(mocks.upsertAppUserSnapshot).toHaveBeenCalledOnce();
    expect(mocks.backfillOwnerPrincipalForEmail).toHaveBeenCalledOnce();
  });
});
