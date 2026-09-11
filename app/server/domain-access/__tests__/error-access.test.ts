import { beforeEach, describe, expect, it, vi } from "vitest";

const { logError, resolveAuth } = vi.hoisted(() => ({
  logError: vi.fn(),
  resolveAuth: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveAuth,
}));

vi.mock("@/app/server/repository/error-logs", () => ({
  logError,
}));

describe("recordClientErrorReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logError.mockResolvedValue(undefined);
  });

  it("does not write unauthenticated public client error reports", async () => {
    resolveAuth.mockResolvedValue(null);
    const { recordClientErrorReport } = await import("../error-access");

    await recordClientErrorReport({
      message: "client exploded",
      metadata: { source: "test" },
    });

    expect(logError).not.toHaveBeenCalled();
  });

  it("records authenticated client error reports with the owner user id", async () => {
    resolveAuth.mockResolvedValue({
      db: "db",
      source: "moonlight_scholar",
      user: { id: "owner-1", email: "pilot@example.com" },
    });
    const { recordClientErrorReport } = await import("../error-access");

    await recordClientErrorReport({
      message: "client exploded",
      metadata: { source: "test" },
    });

    expect(logError).toHaveBeenCalledWith("db", {
      userId: "owner-1",
      source: "client",
      category: "client_error",
      message: "client exploded",
      metadata: { source: "test" },
    });
  });

  it("waits for the durable error log write before resolving", async () => {
    resolveAuth.mockResolvedValue({
      db: "db",
      source: "moonlight_scholar",
      user: { id: "owner-1", email: "pilot@example.com" },
    });
    let settleWrite: (() => void) | undefined;
    let resolved = false;
    logError.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        settleWrite = resolve;
      }),
    );
    const { recordClientErrorReport } = await import("../error-access");

    const reportPromise = recordClientErrorReport({ message: "client exploded" }).then(() => {
      resolved = true;
    });
    await Promise.resolve();

    expect(resolved).toBe(false);
    settleWrite?.();
    await reportPromise;

    expect(resolved).toBe(true);
  });

  it("keeps route-guard and route-comment error effects behind domain access", async () => {
    const { recordRouteAiCommentGenerationErrorForTrustedAgent, recordRouteGuardError } =
      await import("../error-access");
    const routeError = new Error("route failed");
    const commentError = new Error("comment failed");

    await recordRouteGuardError(routeError);
    await recordRouteAiCommentGenerationErrorForTrustedAgent({
      db: { source: "owner-db" } as never,
      userId: "owner-1",
      snapshotId: "snapshot-1",
      snapshotKind: "search",
      error: commentError,
    });

    expect(logError).toHaveBeenNthCalledWith(1, null, {
      source: "server",
      category: "api_error",
      message: "route failed",
      metadata: {
        handler: "withRouteGuard",
        error: { name: "Error", stack: routeError.stack },
      },
    });
    expect(logError).toHaveBeenNthCalledWith(
      2,
      { source: "owner-db" },
      {
        userId: "owner-1",
        source: "server",
        category: "api_error",
        message: "comment failed",
        metadata: {
          snapshotId: "snapshot-1",
          snapshotKind: "search",
          error: { name: "Error", stack: commentError.stack },
        },
      },
    );
  });
});
