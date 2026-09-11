import { getLighthouseDbFor, type RepositoryDbHandle } from "./db";

export type LlmUsageEventStatus = "success" | "empty" | "aborted";
export type LlmUsageEventMetadata = Record<string, string | number | boolean | null>;

export interface InsertLlmUsageEventUncheckedParams {
  occurredAt?: string;
  ownerPrincipalId?: string | null;
  action: string;
  status: LlmUsageEventStatus;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  costUsdMicros: number | null;
  priced: boolean;
  usageMeasured: boolean;
  durationMs?: number | null;
  metadata?: LlmUsageEventMetadata;
}

export interface LlmUsageEventRow {
  id: string;
  occurred_at: string;
  owner_principal_id: string | null;
  action: string;
  status: LlmUsageEventStatus;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_input_tokens: number;
  cost_usd_micros: number | null;
  priced: boolean;
  usage_measured: boolean;
  duration_ms: number | null;
  metadata: LlmUsageEventMetadata;
}

function normalizeInteger(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function toRow(params: InsertLlmUsageEventUncheckedParams): Record<string, unknown> {
  return {
    ...(params.occurredAt ? { occurred_at: params.occurredAt } : {}),
    owner_principal_id: params.ownerPrincipalId ?? null,
    action: params.action,
    status: params.status,
    model: params.model,
    input_tokens: normalizeInteger(params.inputTokens),
    output_tokens: normalizeInteger(params.outputTokens),
    total_tokens: normalizeInteger(params.totalTokens),
    reasoning_tokens: normalizeInteger(params.reasoningTokens),
    cached_input_tokens: normalizeInteger(params.cachedInputTokens),
    cost_usd_micros:
      params.costUsdMicros == null ? null : Math.max(0, Math.trunc(params.costUsdMicros)),
    priced: params.priced,
    usage_measured: params.usageMeasured,
    duration_ms: params.durationMs == null ? null : normalizeInteger(params.durationMs),
    metadata: params.metadata ?? {},
  };
}

export async function insertLlmUsageEventUnchecked(
  db: RepositoryDbHandle,
  params: InsertLlmUsageEventUncheckedParams,
): Promise<void> {
  const { error } = await getLighthouseDbFor(db).from("llm_usage_events").insert(toRow(params));
  if (error) throw error;
}
