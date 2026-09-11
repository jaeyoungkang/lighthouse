import type { SearchQueryClause } from "@/app/domain/search-query";

const BROAD_RESEARCH_LABELS = new Set([
  "artificial intelligence",
  "science",
  "scientific",
  "research",
  "study",
  "studies",
  "methods",
  "models",
  "systems",
  "learning",
  "discovery",
  "challenges",
  "opportunities",
]);

const BROAD_SINGLE_WORD_LABELS = new Set([
  "agents",
  "automation",
  "benchmarks",
  "evaluation",
  "memory",
  "methods",
  "models",
  "multimodal",
  "planning",
  "retrieval",
  "scientists",
  "verification",
]);

const AI_FOR_SCIENCE_BROAD_TOKENS = new Set([
  "agents",
  "agent",
  "artificial",
  "automation",
  "benchmarks",
  "discovery",
  "evaluation",
  "intelligence",
  "language",
  "large",
  "models",
  "model",
  "multimodal",
  "retrieval",
  "science",
  "scientific",
  "scientists",
  "verification",
]);

export interface ResearchTermQualityContext {
  queryTerms: Set<string>;
  queryTokens: Set<string>;
  isAiForScienceQuery: boolean;
}

function normalizeResearchTerm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tokenizeResearchTerm(value: string): string[] {
  return normalizeResearchTerm(value)
    .split(/[^a-z0-9+.-]+/g)
    .filter((token) => token.length > 0);
}

export function buildResearchTermQualityContext(
  query: string,
  queryClauses?: SearchQueryClause[],
): ResearchTermQualityContext {
  const queryTerms = new Set<string>();

  const addTerm = (value: string) => {
    const normalized = normalizeResearchTerm(value);
    if (normalized) {
      queryTerms.add(normalized);
    }
  };

  addTerm(query);
  for (const token of tokenizeResearchTerm(query)) {
    queryTerms.add(token);
  }

  for (const clause of queryClauses ?? []) {
    addTerm(clause.normalizedClause);
    for (const expansion of clause.derivedExpansions) {
      addTerm(expansion);
    }
  }

  const canonicalTokens = new Set([...queryTerms].flatMap((term) => tokenizeResearchTerm(term)));
  if (
    canonicalTokens.has("ai") ||
    (canonicalTokens.has("artificial") && canonicalTokens.has("intelligence"))
  ) {
    queryTerms.add("ai");
    queryTerms.add("artificial intelligence");
  }

  const queryTokens = new Set<string>();
  for (const term of queryTerms) {
    for (const token of tokenizeResearchTerm(term)) {
      queryTokens.add(token);
    }
  }

  return {
    queryTerms,
    queryTokens,
    isAiForScienceQuery:
      (queryTerms.has("ai") || queryTerms.has("artificial intelligence")) &&
      (queryTokens.has("science") || queryTokens.has("scientific")),
  };
}

export function isResearchLandscapeTerm(
  term: string,
  context: ResearchTermQualityContext,
): boolean {
  const normalized = normalizeResearchTerm(term);
  if (!normalized) {
    return false;
  }

  if (BROAD_RESEARCH_LABELS.has(normalized)) {
    return false;
  }

  if (context.queryTerms.has(normalized)) {
    return false;
  }

  const tokens = tokenizeResearchTerm(normalized);
  if (tokens.length === 0) {
    return false;
  }

  if (tokens.length === 1 && BROAD_SINGLE_WORD_LABELS.has(normalized)) {
    return false;
  }

  if (tokens.every((token) => context.queryTokens.has(token))) {
    return false;
  }

  if (
    context.isAiForScienceQuery &&
    tokens.every((token) => AI_FOR_SCIENCE_BROAD_TOKENS.has(token))
  ) {
    return false;
  }

  return true;
}
