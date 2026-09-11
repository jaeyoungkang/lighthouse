import { describe, expect, it } from "vitest";
import { hasMeasuredUsage, normalizeGeminiUsage, normalizeOpenAiUsage } from "../usage";

describe("normalized LLM usage", () => {
  it("normalizes AI SDK OpenAI usage into canonical token fields", () => {
    expect(
      normalizeOpenAiUsage({
        inputTokens: 100,
        inputTokenDetails: {
          noCacheTokens: 80,
          cacheReadTokens: 20,
          cacheWriteTokens: undefined,
        },
        outputTokens: 40,
        outputTokenDetails: {
          textTokens: 30,
          reasoningTokens: 10,
        },
        totalTokens: 175,
      }),
    ).toEqual({
      inputTokens: 100,
      outputTokens: 40,
      totalTokens: 175,
      reasoningTokens: 10,
      cachedInputTokens: 20,
    });
  });

  it("normalizes missing OpenAI usage to zero token fields", () => {
    const usage = normalizeOpenAiUsage(undefined);

    expect(usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    });
    expect(hasMeasuredUsage(usage)).toBe(false);
  });

  it("normalizes Gemini usage metadata and falls back to summed totals", () => {
    expect(
      normalizeGeminiUsage({
        promptTokenCount: 200,
        candidatesTokenCount: 50,
        thoughtsTokenCount: 25,
        cachedContentTokenCount: 30,
      }),
    ).toEqual({
      inputTokens: 200,
      outputTokens: 50,
      totalTokens: 275,
      reasoningTokens: 25,
      cachedInputTokens: 30,
    });
  });

  it("treats missing or invalid provider counts as zero", () => {
    expect(
      normalizeGeminiUsage({
        promptTokenCount: Number.NaN,
        candidatesTokenCount: -3,
        totalTokenCount: undefined,
      }),
    ).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    });
    expect(normalizeGeminiUsage(null)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    });
  });

  it("uses Gemini responseTokenCount when candidatesTokenCount is absent", () => {
    expect(normalizeGeminiUsage({ responseTokenCount: 7 })).toMatchObject({
      outputTokens: 7,
      totalTokens: 7,
    });
  });

  it.each(["inputTokens", "outputTokens", "totalTokens", "reasoningTokens", "cachedInputTokens"])(
    "treats a positive %s value as measured usage",
    (field) => {
      const usage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        [field]: 1,
      };

      expect(hasMeasuredUsage(usage)).toBe(true);
    },
  );

  it("does not treat negative-only usage as measured", () => {
    expect(
      hasMeasuredUsage({
        inputTokens: -1,
        outputTokens: -1,
        totalTokens: -1,
        reasoningTokens: -1,
        cachedInputTokens: -1,
      }),
    ).toBe(false);
  });
});
