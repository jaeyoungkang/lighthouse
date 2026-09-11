import type { NormalizedUsage } from "./usage";

interface ModelPrice {
  inputUsdMicrosPerMillionTokens: number;
  outputUsdMicrosPerMillionTokens: number;
}

// Gemini API Standard paid pricing checked on 2026-07-08:
// https://ai.google.dev/gemini-api/docs/pricing
export const MODEL_PRICES: Partial<Record<string, ModelPrice>> = {
  "gemini-3.1-flash-lite": {
    inputUsdMicrosPerMillionTokens: 250_000,
    outputUsdMicrosPerMillionTokens: 1_500_000,
  },
  "gemini-3-flash-preview": {
    inputUsdMicrosPerMillionTokens: 500_000,
    outputUsdMicrosPerMillionTokens: 3_000_000,
  },
  // https://developers.openai.com/api/docs/models/gpt-5.4-mini (2026-07-30)
  "gpt-5.4-mini": {
    inputUsdMicrosPerMillionTokens: 750_000,
    outputUsdMicrosPerMillionTokens: 4_500_000,
  },
  "gpt-5.4-mini-2026-03-17": {
    inputUsdMicrosPerMillionTokens: 750_000,
    outputUsdMicrosPerMillionTokens: 4_500_000,
  },
};

function computeMicrosForTokens(tokens: number, usdMicrosPerMillionTokens: number): number {
  if (tokens <= 0) return 0;
  return Math.round((tokens * usdMicrosPerMillionTokens) / 1_000_000);
}

export function computeCostUsdMicros(model: string, usage: NormalizedUsage): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;

  const billableOutputTokens = usage.outputTokens + usage.reasoningTokens;
  return (
    computeMicrosForTokens(usage.inputTokens, price.inputUsdMicrosPerMillionTokens) +
    computeMicrosForTokens(billableOutputTokens, price.outputUsdMicrosPerMillionTokens)
  );
}
