import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthenticatedError } from "@/app/server/auth/auth-errors";

const { requireOwnerPrincipalAuthMock, scheduleAppUserSnapshotMock } = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
  scheduleAppUserSnapshotMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/auth/app-user-snapshot", () => ({
  scheduleAppUserSnapshot: scheduleAppUserSnapshotMock,
}));

describe("auth session-touch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("schedules a Moonlight snapshot and lazy backfill for existing authenticated sessions", async () => {
    requireOwnerPrincipalAuthMock.mockResolvedValue({
      source: "moonlight_scholar",
      user: {
        id: "moonlight-user-1",
        email: "pilot@example.com",
      },
    });

    const { POST } = await import("../route");
    const response = await POST();

    expect(response.status).toBe(204);
    expect(scheduleAppUserSnapshotMock).toHaveBeenCalledWith({
      principal: "moonlight-user-1",
      email: "pilot@example.com",
      backfill: true,
    });
  });

  it("schedules a Supabase snapshot without Moonlight backfill", async () => {
    requireOwnerPrincipalAuthMock.mockResolvedValue({
      source: "supabase",
      user: {
        id: "supabase-user-1",
        email: "reader@example.com",
      },
    });

    const { POST } = await import("../route");
    const response = await POST();

    expect(response.status).toBe(204);
    expect(scheduleAppUserSnapshotMock).toHaveBeenCalledWith({
      principal: "supabase-user-1",
      email: "reader@example.com",
      backfill: false,
    });
  });

  it("does not surface auth failures as client-visible errors", async () => {
    requireOwnerPrincipalAuthMock.mockRejectedValue(new UnauthenticatedError());

    const { POST } = await import("../route");
    const response = await POST();

    expect(response.status).toBe(204);
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });

  it("records unexpected auth resolver failures and returns a stable error", async () => {
    const error = new Error("auth resolver exploded");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    requireOwnerPrincipalAuthMock.mockRejectedValue(error);

    const { POST } = await import("../route");

    const response = await POST();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "internal server error",
      code: "API_INTERNAL_ERROR",
      action: "retry",
      retryable: true,
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[auth session-touch] failed to resolve authenticated session:",
      error,
    );
    expect(scheduleAppUserSnapshotMock).not.toHaveBeenCalled();
  });
});
