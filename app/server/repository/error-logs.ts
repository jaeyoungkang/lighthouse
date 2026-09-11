import { getRepositoryDbFor, type RepositoryDbHandle } from "./db";
import { sanitizeForDatabase, sanitizeText } from "./sanitize";
import { logError as writeLogError, logWarn } from "@/app/lib/runtime-log";
import { t } from "@/app/i18n/message-access";
import { sanitizeErrorLogMetadata } from "@/app/server/lib/error-log-metadata";

interface ErrorLogInput {
  userId?: string | null;
  documentId?: string | null;
  source: "server" | "client" | "llm" | "tool";
  category: "api_error" | "llm_fallback" | "tool_failure" | "client_error" | "memory_error";
  message: string;
  metadata?: Record<string, unknown>;
}

let hasWarnedAboutMissingErrorLogsTable = false;

export async function logError(
  db: RepositoryDbHandle | null | undefined,
  input: ErrorLogInput,
): Promise<void> {
  if (!db) {
    writeLogError("error-logs", t("common.label.error-logs.dbMissing"), { message: input.message });
    return;
  }

  try {
    const { error } = await getRepositoryDbFor(db)
      .from("error_logs")
      .insert({
        user_id: input.userId ?? null,
        document_id: input.documentId ?? null,
        source: input.source,
        category: input.category,
        message: sanitizeText(input.message),
        metadata: sanitizeForDatabase(sanitizeErrorLogMetadata(input.metadata ?? {})),
      });

    if (!error) return;

    if (error.code === "PGRST205") {
      if (!hasWarnedAboutMissingErrorLogsTable) {
        hasWarnedAboutMissingErrorLogsTable = true;
        logWarn("error-logs", t("common.label.error-logs.tableMissing"));
      }
      return;
    }

    writeLogError("error-logs", t("common.error.error-logs.saveFailed"), error);
  } catch (error: unknown) {
    writeLogError("error-logs", t("common.error.error-logs.saveFailed"), error);
  }
}
