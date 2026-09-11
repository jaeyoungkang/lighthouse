import type { LanguageModelUsage } from "ai";

export interface NormalizedUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
}

interface GeminiUsageMetadataLike {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  responseTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
}

function normalizeTokenCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizeTotalTokens(params: {
  totalTokens?: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}): number {
  const normalizedTotal = normalizeTokenCount(params.totalTokens);
  if (normalizedTotal > 0) return normalizedTotal;
  return params.inputTokens + params.outputTokens + params.reasoningTokens;
}

export function normalizeOpenAiUsage(
  usage: LanguageModelUsage | null | undefined,
): NormalizedUsage {
  const inputTokens = normalizeTokenCount(usage?.inputTokens);
  const outputTokens = normalizeTokenCount(usage?.outputTokens);
  const reasoningTokens =
    usage == null ? 0 : normalizeTokenCount(usage.outputTokenDetails.reasoningTokens);
  const cachedInputTokens =
    usage == null ? 0 : normalizeTokenCount(usage.inputTokenDetails.cacheReadTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens: normalizeTotalTokens({
      totalTokens: usage?.totalTokens,
      inputTokens,
      outputTokens,
      reasoningTokens,
    }),
    reasoningTokens,
    cachedInputTokens,
  };
}

export function normalizeGeminiUsage(
  usage: GeminiUsageMetadataLike | null | undefined,
): NormalizedUsage {
  const inputTokens = normalizeTokenCount(usage?.promptTokenCount);
  const outputTokens = normalizeTokenCount(
    usage?.candidatesTokenCount ?? usage?.responseTokenCount,
  );
  const reasoningTokens = normalizeTokenCount(usage?.thoughtsTokenCount);
  const cachedInputTokens = normalizeTokenCount(usage?.cachedContentTokenCount);

  return {
    inputTokens,
    outputTokens,
    totalTokens: normalizeTotalTokens({
      totalTokens: usage?.totalTokenCount,
      inputTokens,
      outputTokens,
      reasoningTokens,
    }),
    reasoningTokens,
    cachedInputTokens,
  };
}

export function hasMeasuredUsage(usage: NormalizedUsage): boolean {
  return (
    usage.inputTokens > 0 ||
    usage.outputTokens > 0 ||
    usage.totalTokens > 0 ||
    usage.reasoningTokens > 0 ||
    usage.cachedInputTokens > 0
  );
}
