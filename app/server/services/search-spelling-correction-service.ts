import { z } from "zod";
import { hasGeminiApiKey, GEMINI_LITE_MODEL } from "@/app/server/ai-generation/gemini";
import { executeJudgment } from "@/app/server/ai-generation/judgment";

const searchSpellingCorrectionSchema = z.object({
  correctedQuery: z.string().trim().min(1).nullable(),
});

function normalizeComparableQuery(query: string): string {
  return query.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function resolveSearchSpellingCorrection(
  query: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const trimmed = query.trim().replace(/\s+/g, " ");
  if (!trimmed || !hasGeminiApiKey()) {
    return null;
  }

  const result = await executeJudgment({
    label: "search-spelling-correction",
    model: GEMINI_LITE_MODEL,
    outputSchema: searchSpellingCorrectionSchema,
    onError: "fallback",
    fallbackValue: { correctedQuery: null },
    signal,
    prompt: `You correct academic search queries only when there is a clear spelling, spacing, casing, or typo problem.

Return JSON only:
{
  "correctedQuery": string | null
}

Rules:
- Preserve the user's intended academic topic.
- Do not broaden, translate, or add new concepts.
- If the query is already plausible, return null.
- Fix obvious typos such as "trasnformer" -> "transformer" or malformed spacing.

Query: ${JSON.stringify(trimmed)}`,
  });

  const corrected = result.correctedQuery?.trim().replace(/\s+/g, " ") ?? null;
  if (!corrected) {
    return null;
  }
  if (normalizeComparableQuery(corrected) === normalizeComparableQuery(trimmed)) {
    return null;
  }
  return corrected;
}
