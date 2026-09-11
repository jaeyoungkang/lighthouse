import { truncateUtf8 } from "@/app/lib/utf8";

export const GAP_NETWORK_PROMPT_MAX_BYTES = 64 * 1024;
export const GAP_NETWORK_JUDGMENT_TIMEOUT_MS = 10_000;

export const GAP_NETWORK_PROMPT_TEXT_LIMITS = {
  queryBytes: 512,
  idBytes: 64,
  labelBytes: 128,
  conceptBytes: 64,
  titleBytes: 192,
  abstractBytes: 768,
  narrativeBytes: 320,
  domainLabelBytes: 160,
} as const;

export const GAP_NETWORK_OUTPUT_TOKEN_LIMITS = {
  hypothesis: 2_048,
  clusterNarrative: 1_024,
  gapNarrative: 12_288,
  domain: 256,
  contentNarrative: 4_096,
} as const;

type GapNetworkPromptKind = keyof typeof GAP_NETWORK_OUTPUT_TOKEN_LIMITS;
type GapNetworkPromptTextKind = keyof typeof GAP_NETWORK_PROMPT_TEXT_LIMITS;

function normalizePromptText(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function projectGapNetworkPromptText(value: string, kind: GapNetworkPromptTextKind): string {
  return truncateUtf8(normalizePromptText(value), GAP_NETWORK_PROMPT_TEXT_LIMITS[kind]);
}

export function projectGapNetworkFallbackText(value: string, maxChars: number): string {
  const byteBounded = truncateUtf8(normalizePromptText(value), maxChars * 4);
  return byteBounded.slice(0, maxChars).replace(/[\uD800-\uDBFF]$/u, "");
}

export function buildGapNetworkJudgmentBudget(kind: GapNetworkPromptKind, prompt: string) {
  return {
    timeoutMs: GAP_NETWORK_JUDGMENT_TIMEOUT_MS,
    maxInputBytes: GAP_NETWORK_PROMPT_MAX_BYTES,
    maxOutputTokens: GAP_NETWORK_OUTPUT_TOKEN_LIMITS[kind],
    usageMetadata: {
      phase: "gap-enrichment",
      mode: kind,
      promptChars: prompt.length,
    },
  } as const;
}
