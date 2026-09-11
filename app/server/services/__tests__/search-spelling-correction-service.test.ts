import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasGeminiApiKey } from "@/app/server/ai-generation/gemini";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import { resolveSearchSpellingCorrection } from "@/app/server/services/search-spelling-correction-service";

vi.mock("@/app/server/ai-generation/gemini", async () => {
  const actual = await vi.importActual("@/app/server/ai-generation/gemini");
  return {
    ...(actual as Record<string, unknown>),
    hasGeminiApiKey: vi.fn(() => false),
  };
});

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
}));

const mockedHasGeminiApiKey = vi.mocked(hasGeminiApiKey);
const mockedExecuteJudgment = vi.mocked(executeJudgment);

// promise:search-spelling-correction
// acceptance-check:search-spelling-correction-best-effort-silent-when-absent
describe("resolveSearchSpellingCorrection (best-effort, silent when absent)", () => {
  beforeEach(() => {
    mockedHasGeminiApiKey.mockReset();
    mockedExecuteJudgment.mockReset();
  });

  it("returns null without a Gemini key", async () => {
    mockedHasGeminiApiKey.mockReturnValue(false);

    const result = await resolveSearchSpellingCorrection("trasnformer");

    // Best-effort: no key means no suggestion and no LLM call is attempted.
    expect(result).toBeNull();
    expect(mockedExecuteJudgment).not.toHaveBeenCalled();
  });

  it("returns null when the corrected query normalizes to the original query", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValue({ correctedQuery: "Transformer" });

    // Same query up to whitespace/case normalization is not a real correction.
    const result = await resolveSearchSpellingCorrection("transformer");

    expect(result).toBeNull();
  });

  it("returns null when the corrector finds no clear typo", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValue({ correctedQuery: null });

    const result = await resolveSearchSpellingCorrection("graph neural network");

    expect(result).toBeNull();
  });

  it("returns null when the judgment fallback handles a timeout or failure", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValue({ correctedQuery: null });

    const result = await resolveSearchSpellingCorrection("trasnformer");

    expect(result).toBeNull();
    expect(mockedExecuteJudgment).toHaveBeenCalledWith(
      expect.objectContaining({
        onError: "fallback",
        fallbackValue: { correctedQuery: null },
      }),
    );
  });

  it("returns the corrected query for a clear typo", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValue({ correctedQuery: "transformer" });

    const result = await resolveSearchSpellingCorrection("trasnformer");

    expect(result).toBe("transformer");
  });
});
