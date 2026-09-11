import type {
  SearchGraphSupportPaperScore,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import { getResolvedSearchQueryClauses } from "@/app/lib/search-query";

type SearchPaper = SearchMetadata["papers"][number];

const REPRESENTATIVE_CARD_LIMIT = 3;
const TITLE_FAMILY_TOKEN_LIMIT = 4;
const REPRESENTATIVE_MIN_FIT_SCORE = 2;
const REPRESENTATIVE_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "toward",
  "towards",
  "using",
  "with",
]);

function normalizeRepresentativeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenizeRepresentativeText(value: string): string[] {
  const normalized = normalizeRepresentativeText(value);
  if (!normalized) {
    return [];
  }

  return normalized
    .split(" ")
    .filter((token) => token.length > 1 || /[가-힣]/.test(token))
    .filter((token) => !REPRESENTATIVE_STOPWORDS.has(token));
}

function buildRepresentativeQueryTokenGroups(metadata: SearchMetadata): string[][] {
  return getResolvedSearchQueryClauses({
    query: metadata.query,
    queryClauses: metadata.queryClauses,
  })
    .map((clause) => tokenizeRepresentativeText(clause.normalizedClause))
    .filter((tokens) => tokens.length > 0);
}

function hasRepresentativeTitleMatch(title: string, queryTokenGroups: string[][]): boolean {
  if (queryTokenGroups.length === 0) {
    return false;
  }

  const normalizedTitle = normalizeRepresentativeText(title);

  return queryTokenGroups.some((tokens) => {
    const matchedTokenCount = Array.from(new Set(tokens)).filter((token) =>
      normalizedTitle.includes(token),
    ).length;

    if (tokens.length === 1) {
      return matchedTokenCount === 1;
    }

    return matchedTokenCount >= Math.min(2, tokens.length);
  });
}

function countTokenMatches(value: string, tokens: string[]): number {
  const normalized = normalizeRepresentativeText(value);
  if (!normalized) {
    return 0;
  }

  return Array.from(new Set(tokens)).filter((token) => normalized.includes(token)).length;
}

function scoreRepresentativeFit(paper: SearchPaper, queryTokenGroups: string[][]): number {
  if (queryTokenGroups.length === 0) {
    return REPRESENTATIVE_MIN_FIT_SCORE;
  }

  const abstract = typeof paper.abstract === "string" ? paper.abstract : "";
  let bestScore = 0;

  for (const tokens of queryTokenGroups) {
    const titleMatches = countTokenMatches(paper.title, tokens);
    const abstractMatches = countTokenMatches(abstract, tokens);
    const uniqueMatchCount = countTokenMatches(`${paper.title} ${abstract}`, tokens);
    if (uniqueMatchCount < Math.min(2, tokens.length)) {
      continue;
    }
    const directTitleBonus = hasRepresentativeTitleMatch(paper.title, [tokens]) ? 2 : 0;
    const score = titleMatches * 2 + abstractMatches + directTitleBonus;
    bestScore = Math.max(bestScore, score);
  }

  return bestScore;
}

function buildPaperFamilyKey(title: string): string {
  const titlePrefix = title.split(/[:|,\-]/)[0] ?? title;
  const tokens = tokenizeRepresentativeText(titlePrefix).slice(0, TITLE_FAMILY_TOKEN_LIMIT);
  if (tokens.length > 0) {
    return tokens.join(" ");
  }

  return normalizeRepresentativeText(titlePrefix) || normalizeRepresentativeText(title);
}

export function selectRepresentativePapers(metadata: SearchMetadata): SearchPaper[] {
  const queryTokenGroups = buildRepresentativeQueryTokenGroups(metadata);
  const graphScores = new Map(
    Object.entries(metadata.graphSupport?.paperScores ?? {}).filter(
      (entry): entry is [string, SearchGraphSupportPaperScore] => entry[1] !== undefined,
    ),
  );
  const fitPapers = metadata.papers
    .map((paper) => ({
      paper,
      fitScore: scoreRepresentativeFit(paper, queryTokenGroups),
    }))
    .filter((candidate) => candidate.fitScore >= REPRESENTATIVE_MIN_FIT_SCORE);
  const orderedCandidates = fitPapers
    .sort((left, right) => {
      if (right.fitScore !== left.fitScore) {
        return right.fitScore - left.fitScore;
      }
      const graphDiff =
        (graphScores.get(right.paper.paperId)?.defaultScore ?? 0) -
        (graphScores.get(left.paper.paperId)?.defaultScore ?? 0);
      if (graphDiff !== 0) {
        return graphDiff;
      }
      const citationDiff = right.paper.citationCount - left.paper.citationCount;
      if (citationDiff !== 0) {
        return citationDiff;
      }
      return left.paper.title.localeCompare(right.paper.title);
    })
    .map((candidate) => candidate.paper);
  const selected: SearchPaper[] = [];
  const seenFamilyKeys = new Set<string>();

  for (const paper of orderedCandidates) {
    const familyKey = buildPaperFamilyKey(paper.title);
    if (familyKey && seenFamilyKeys.has(familyKey)) {
      continue;
    }

    selected.push(paper);
    if (familyKey) {
      seenFamilyKeys.add(familyKey);
    }

    if (selected.length >= REPRESENTATIVE_CARD_LIMIT) {
      return selected;
    }
  }

  return selected;
}
