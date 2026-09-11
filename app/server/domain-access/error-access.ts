import { resolveAuth } from "@/app/server/auth/identity";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import { logError } from "@/app/server/repository/error-logs";

interface ClientErrorReportInput {
  message: string;
  metadata?: Record<string, unknown>;
}

export async function recordClientErrorReport({
  message,
  metadata,
}: ClientErrorReportInput): Promise<void> {
  const auth = await resolveAuth();
  if (!auth) return;

  await logError(auth.db, {
    userId: auth.user.id,
    source: "client",
    category: "client_error",
    message,
    metadata: metadata ?? {},
  });
}

export async function recordRouteGuardError(error: unknown): Promise<void> {
  await logError(null, {
    source: "server",
    category: "api_error",
    message: error instanceof Error ? error.message : "Unknown route guard error",
    metadata: {
      handler: "withRouteGuard",
      error: error instanceof Error ? { name: error.name, stack: error.stack } : String(error),
    },
  });
}

export async function recordRouteAiCommentGenerationErrorForTrustedAgent(params: {
  db: RepositoryDbHandle;
  userId?: string;
  snapshotId: string;
  snapshotKind: string;
  error: unknown;
}): Promise<void> {
  await logError(params.db, {
    userId: params.userId ?? null,
    source: "server",
    category: "api_error",
    message:
      params.error instanceof Error ? params.error.message : "route AI comment generation failed",
    metadata: {
      snapshotId: params.snapshotId,
      snapshotKind: params.snapshotKind,
      error:
        params.error instanceof Error
          ? { name: params.error.name, stack: params.error.stack }
          : String(params.error),
    },
  });
}
