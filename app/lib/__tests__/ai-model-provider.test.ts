import { describe, expect, it } from "vitest";

import { getOpenAiModelId, isOpenAiModel } from "@/app/lib/ai-model-provider";

describe("ai-model-provider", () => {
  it.each([
    "gpt-5-mini",
    "o3-mini",
    "chatgpt-4o-latest",
    "ft:gpt-4o-mini-2024-07-18:org:judge:abc123",
    "FT:GPT-5-MINI:org:judge:abc123",
  ])("classifies direct OpenAI model id %s", (model) => {
    expect(isOpenAiModel(model)).toBe(true);
    expect(getOpenAiModelId(model)).toBe(model);
  });

  it("normalizes provider-qualified OpenAI model ids before gateway routing", () => {
    expect(isOpenAiModel("openai/gpt-5-mini")).toBe(true);
    expect(getOpenAiModelId("openai/gpt-5-mini")).toBe("gpt-5-mini");
    expect(getOpenAiModelId("  openai/gpt-5-mini  ")).toBe("gpt-5-mini");
  });

  it.each(["gemini-3-flash-preview", "models/gemini-3-flash-preview", "claude-opus-4-7"])(
    "does not classify non-OpenAI model id %s",
    (model) => {
      expect(isOpenAiModel(model)).toBe(false);
      expect(getOpenAiModelId(model)).toBeNull();
    },
  );
});
