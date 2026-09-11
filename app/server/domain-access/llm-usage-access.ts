import { logWarn } from "@/app/lib/runtime-log";
import type { LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import { hasMeasuredUsage, type NormalizedUsage } from "@/app/server/ai-generation/usage";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  insertLlmUsageEventUnchecked,
  type LlmUsageEventMetadata,
  type LlmUsageEventStatus,
} from "@/app/server/repository/llm-usage-events";

export interface LlmUsageEventMetadataInput {
  snapshotId?: string;
  snapshotKind?: string;
  trigger?: string;
  responseLength?: number;
  promptBytes?: number;
  maxInputBytes?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  phase?: string;
  paperCount?: number;
  promptChars?: number;
  promptPaperLimit?: number;
  promptAbstractChars?: number;
  mode?: string;
}

export interface RecordLlmUsageEventForTrustedAgentParams {
  db: RepositoryDbHandle;
  ownerPrincipalId?: string | null;
  action: string;
  status: LlmUsageEventStatus;
  model: string;
  usage: NormalizedUsage;
  costUsdMicros: number | null;
  priced: boolean;
  durationMs?: number | null;
  metadata?: LlmUsageEventMetadataInput;
}

function normalizeMetadataValue(value: string | number | undefined): string | number | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, 200) : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  return undefined;
}

function normalizeLlmUsageEventMetadata(
  metadata: LlmUsageEventMetadataInput | undefined,
): LlmUsageEventMetadata {
  if (!metadata) return {};
  const normalized: LlmUsageEventMetadata = {};
  const put = (key: string, value: string | number | undefined): void => {
    if (value !== undefined) normalized[key] = value;
  };

  put("snapshotId", normalizeMetadataValue(metadata.snapshotId));
  put("snapshotKind", normalizeMetadataValue(metadata.snapshotKind));
  put("trigger", normalizeMetadataValue(metadata.trigger));
  put("responseLength", normalizeMetadataValue(metadata.responseLength));
  put("promptBytes", normalizeMetadataValue(metadata.promptBytes));
  put("maxInputBytes", normalizeMetadataValue(metadata.maxInputBytes));
  put("maxOutputTokens", normalizeMetadataValue(metadata.maxOutputTokens));
  put("timeoutMs", normalizeMetadataValue(metadata.timeoutMs));
  put("phase", normalizeMetadataValue(metadata.phase));
  put("paperCount", normalizeMetadataValue(metadata.paperCount));
  put("promptChars", normalizeMetadataValue(metadata.promptChars));
  put("promptPaperLimit", normalizeMetadataValue(metadata.promptPaperLimit));
  put("promptAbstractChars", normalizeMetadataValue(metadata.promptAbstractChars));
  put("mode", normalizeMetadataValue(metadata.mode));

  return normalized;
}

async function recordLlmUsageEventForTrustedAgent(
  params: RecordLlmUsageEventForTrustedAgentParams,
): Promise<void> {
  await insertLlmUsageEventUnchecked(params.db, {
    ownerPrincipalId: params.ownerPrincipalId ?? null,
    action: params.action,
    status: params.status,
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    totalTokens: params.usage.totalTokens,
    reasoningTokens: params.usage.reasoningTokens,
    cachedInputTokens: params.usage.cachedInputTokens,
    costUsdMicros: params.costUsdMicros,
    priced: params.priced,
    usageMeasured: hasMeasuredUsage(params.usage),
    durationMs: params.durationMs ?? null,
    metadata: normalizeLlmUsageEventMetadata(params.metadata),
  });
}

export async function recordLlmUsageEventBestEffortForTrustedAgent(
  params: RecordLlmUsageEventForTrustedAgentParams,
): Promise<void> {
  try {
    await recordLlmUsageEventForTrustedAgent(params);
  } catch (error) {
    logWarn("llm-usage-events", "usage event insert failed", {
      ownerPrincipalId: params.ownerPrincipalId,
      action: params.action,
      model: params.model,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function createLlmJudgmentUsageLedgerForTrustedAgent(params: {
  db: RepositoryDbHandle;
  ownerPrincipalId?: string | null;
}): LLMJudgmentUsageLedger {
  return {
    record: (event) =>
      recordLlmUsageEventBestEffortForTrustedAgent({
        db: params.db,
        ownerPrincipalId: params.ownerPrincipalId ?? null,
        action: event.action,
        status: event.status,
        model: event.model,
        usage: event.usage,
        costUsdMicros: event.costUsdMicros,
        priced: event.priced,
        durationMs: event.durationMs,
        metadata: event.metadata,
      }),
  };
}
