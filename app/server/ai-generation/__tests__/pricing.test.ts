import { describe, expect, it } from "vitest";
import { computeCostUsdMicros } from "../pricing";

describe("LLM pricing", () => {
  it("computes Gemini Flash Lite cost in integer micro USD", () => {
    expect(
      computeCostUsdMicros("gemini-3.1-flash-lite", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        reasoningTokens: 0,
        totalTokens: 2_000_000,
        cachedInputTokens: 0,
      }),
    ).toBe(1_750_000);
  });

  it("prices Gemini reasoning tokens as output tokens for cost visibility", () => {
    expect(
      computeCostUsdMicros("gemini-3-flash-preview", {
        inputTokens: 500_000,
        outputTokens: 100_000,
        reasoningTokens: 100_000,
        totalTokens: 700_000,
        cachedInputTokens: 0,
      }),
    ).toBe(850_000);
  });

  it("returns null for models without an explicit price", () => {
    expect(
      computeCostUsdMicros("gpt-5-mini", {
        inputTokens: 100,
        outputTokens: 50,
        reasoningTokens: 0,
        totalTokens: 150,
        cachedInputTokens: 0,
      }),
    ).toBeNull();
  });

  it("does not charge zero or negative provider token counts", () => {
    const base = {
      inputTokens: 0,
      outputTokens: -1,
      reasoningTokens: 0,
      totalTokens: 0,
      cachedInputTokens: 0,
    };

    expect(computeCostUsdMicros("gemini-3.1-flash-lite", base)).toBe(0);
  });
});
