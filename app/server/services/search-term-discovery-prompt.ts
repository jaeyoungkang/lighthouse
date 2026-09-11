import type { SearchTermDiscoveryPaperV1 } from "@/app/domain/search-background-transport";
import {
  TERM_CANDIDATE_LLM_PAPER_LIMIT,
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_PROMPT_FIELD_CHARS,
} from "@/app/lib/constants";

export {
  TERM_CANDIDATE_LLM_PAPER_LIMIT,
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_PROMPT_FIELD_CHARS,
};

function truncatePromptField(value: string | null | undefined): string {
  return (value ?? "").slice(0, TERM_CANDIDATE_PROMPT_FIELD_CHARS);
}

export function buildLLMTermExtractionPrompt(params: {
  query: string;
  papers: SearchTermDiscoveryPaperV1[];
}): string {
  const serializedPapers = params.papers
    .slice(0, TERM_CANDIDATE_LLM_PAPER_LIMIT)
    .map((paper, index) => {
      const profile = paper.semanticProfile;
      return `[${String(index + 1)}]
paperId: ${paper.paperId}
title: ${truncatePromptField(paper.title)}
year: ${String(paper.year ?? "unknown")}
abstract: ${(paper.abstract ?? "").slice(0, TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS)}
semanticProfile:
- topics: ${truncatePromptField(profile?.topics)}
- method: ${truncatePromptField(profile?.method)}
- claim: ${truncatePromptField(profile?.claim)}
- finding: ${truncatePromptField(profile?.finding)}`;
    })
    .join("\n\n");

  return `You extract next-search research terms from a loaded academic search result sample.

User query: ${JSON.stringify(params.query)}

Loaded result sample:
${serializedPapers}

Return JSON only:
{
  "candidates": [
    {
      "term": "english lowercase search phrase",
      "supportPaperIds": ["paperId"],
      "rationale": "short reason"
    }
  ]
}

Rules:
- Extract 3-8 English terms the user can click for the next search.
- Prefer method/contribution noun-phrase families over repeated broad words.
- Good terms name the mechanism, contribution, protocol, dataset/task framing, interaction pattern, evaluation setup, or research axis.
- Do not return query-equivalent labels, broad field labels, or one-word generic labels.
- Avoid broad umbrella terms (for example verification, retrieval, multimodal, agents, benchmarks, large language models, artificial intelligence, science) unless they are part of a specific multi-word method/contribution phrase.
- Each supportPaperIds value must copy a paperId value exactly as printed after "paperId:". Never use the bracket sample number (like 3 for [3]).
- Use only the loaded result sample and semanticProfile text above. Do not invent papers or terms.
- Keep each term compact: 2-5 words, lowercase, no sentence punctuation.`;
}
