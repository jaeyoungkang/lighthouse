import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT,
  SEARCH_RESULTS_INITIAL_VISIBLE_COUNT,
} from "./constants";

// @promise promise:search-results-fast-window
// @promise promise:search-nonascii-library-relevance
// @aspect aspect:library-grounded-research

export type SearchSortOption = "relevance" | "citationCount" | "year" | "yearAsc" | "interest";

const QUERY_TOKEN_STOPWORDS = new Set([
  "about",
  "across",
  "after",
  "against",
  "analysis",
  "and",
  "approach",
  "based",
  "between",
  "case",
  "data",
  "deep",
  "effect",
  "effects",
  "evaluation",
  "for",
  "from",
  "large",
  "language",
  "learning",
  "method",
  "methods",
  "model",
  "models",
  "paper",
  "research",
  "review",
  "study",
  "system",
  "systems",
  "the",
  "using",
  "with",
]);

const QUERY_CONSTRAINT_TOKEN_STOPWORDS = new Set([
  ...QUERY_TOKEN_STOPWORDS,
  "benchmark",
  "benchmarks",
  "bias",
  "chatgpt",
  "factuality",
  "fairness",
  "generation",
  "gpt",
  "hallucination",
  "llm",
  "llms",
  "mitigation",
  "nlp",
  "prompt",
  "safety",
  "studies",
  "survey",
  "surveys",
  "systematic",
]);

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

function cjkNgrams(segment: string): string[] {
  const chars = Array.from(segment);
  if (chars.length < 2) return [segment];

  const tokens = chars.length >= 3 ? [segment] : [];
  for (let index = 0; index <= chars.length - 2; index += 1) {
    tokens.push(chars.slice(index, index + 2).join(""));
  }
  return tokens;
}

export function hasCjkSearchCharacters(text: string): boolean {
  return /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);
}

function tokenizeSearchText(text: string): string[] {
  const tokens: string[] = [];
  const normalizedText = text.toLowerCase();
  const tokenPattern =
    /[a-z0-9]+|[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu;

  for (const match of normalizedText.matchAll(tokenPattern)) {
    const segment = match[0];
    if (/^[a-z0-9]+$/.test(segment)) {
      if (segment.length >= 3) tokens.push(segment);
      continue;
    }
    tokens.push(...cjkNgrams(segment));
  }

  return uniqueTokens(tokens);
}

function selectFocusedQueryTokens(query: string): string[] {
  const tokens = tokenizeSearchText(query);
  const focusedTokens = tokens.filter((token) => !QUERY_TOKEN_STOPWORDS.has(token));
  return focusedTokens.length > 0 ? focusedTokens : tokens;
}

function selectFocusedCjkQueryAxes(query: string): string[][] {
  const axes: string[][] = [];
  const tokenPattern =
    /[a-z0-9]+|[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/giu;

  for (const match of query.toLowerCase().matchAll(tokenPattern)) {
    const segment = match[0];
    if (/^[a-z0-9]+$/.test(segment)) {
      if (segment.length >= 3 && !QUERY_TOKEN_STOPWORDS.has(segment)) {
        axes.push([segment]);
      }
      continue;
    }

    const tokens = cjkNgrams(segment).filter((token) => !QUERY_TOKEN_STOPWORDS.has(token));
    if (tokens.length > 0) axes.push(tokens);
  }

  return axes.length > 0 ? axes : [selectFocusedQueryTokens(query)];
}

function selectQueryConstraintTokens(query: string): string[] {
  return selectFocusedQueryTokens(query).filter(
    (token) => !QUERY_CONSTRAINT_TOKEN_STOPWORDS.has(token),
  );
}

function paperSearchText(paper: SearchMetadata["papers"][number]): string {
  return [
    paper.title,
    paper.abstract ?? "",
    paper.authors.map((author) => author.name).join(" "),
  ].join(" ");
}

function hasEnoughQueryOverlap(params: {
  paper: SearchMetadata["papers"][number];
  query?: string;
}): boolean {
  if (!params.query) {
    return true;
  }

  const queryTokens = selectFocusedQueryTokens(params.query);
  if (queryTokens.length === 0) {
    // Legacy snapshot compatibility only: pre-combined snapshots may still be
    // interpreted through the language-aware admission reader below. New
    // `combined_score` snapshots return before this path.
    // @check acceptance-check:search-nonascii-library-relevance-korean-overlap
    return !hasCjkSearchCharacters(params.query);
  }

  const paperTokens = new Set(tokenizeSearchText(paperSearchText(params.paper)));
  if (hasCjkSearchCharacters(params.query)) {
    const queryAxes = selectFocusedCjkQueryAxes(params.query);
    const matchedAxisCount = queryAxes.filter((axisTokens) =>
      axisTokens.some((token) => paperTokens.has(token)),
    ).length;
    const requiredAxes = queryAxes.length >= 5 ? 3 : queryAxes.length >= 3 ? 2 : queryAxes.length;
    return matchedAxisCount >= requiredAxes;
  }

  const matchedCount = queryTokens.filter((token) => paperTokens.has(token)).length;
  const requiredMatches = queryTokens.length >= 5 ? 3 : queryTokens.length >= 3 ? 2 : 1;
  return matchedCount >= requiredMatches;
}

function satisfiesQueryConstraint(params: {
  paper: SearchMetadata["papers"][number];
  query?: string;
}): boolean {
  if (!params.query) {
    return true;
  }

  const constraintTokens = selectQueryConstraintTokens(params.query);
  if (constraintTokens.length === 0) {
    return !hasCjkSearchCharacters(params.query);
  }

  const paperTokens = new Set(tokenizeSearchText(paperSearchText(params.paper)));
  return constraintTokens.some((token) => paperTokens.has(token));
}

export function canCompeteInLibraryInterestPool(params: {
  paper: SearchMetadata["papers"][number];
  query?: string;
}): boolean {
  return (
    hasEnoughQueryOverlap({
      paper: params.paper,
      query: params.query,
    }) &&
    satisfiesQueryConstraint({
      paper: params.paper,
      query: params.query,
    })
  );
}

function sortInterestBand(
  papers: SearchMetadata["papers"],
  weights: Record<string, number>,
): SearchMetadata["papers"] {
  return papers
    .map((paper, index) => ({ paper, index }))
    .sort(
      (left, right) =>
        (weights[right.paper.paperId] ?? 0) - (weights[left.paper.paperId] ?? 0) ||
        left.index - right.index,
    )
    .map(({ paper }) => paper);
}

// Legacy snapshot compatibility reader only. Pre-combined snapshots wove
// graph candidates absent from the keyword result window into the keyword `spine` under two
// structural bounds:
//   1. rank ceiling — no supplement occupies the first slot; the first card is
//      always a keyword-spine paper.
//   2. first-screen cap — at most SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT
//      supplements enter the initial result window WHEN the keyword spine can
//      fill it (spine length >= windowSize - cap). When keyword results are too
//      scarce to fill the window, the remaining first-screen slots are filled by
//      floor-passing (query-relevant) qualified supplements — never by deferred
//      ones, and rank 0 stays a keyword paper. So the window can exceed `cap`
//      supplements only with query-verified papers; the off-topic-domination
//      case never recurs.
// Deferred supplements (floor failures, incl. every supplement under an
// untokenizable query) always sort last. When there is no keyword spine at all
// (a query returned zero keyword results — a degraded state with nothing more
// relevant to show), both the ceiling and the cap are moot and we fall back to
// weight order.
// New `combined_score` snapshots return before this helper and never use fixed
// slots, a rank ceiling, or a CJK admission floor.
// @check acceptance-check:search-nonascii-library-relevance-korean-overlap
function interleaveLibrarySupplements(
  spine: SearchMetadata["papers"],
  qualified: SearchMetadata["papers"],
  deferred: SearchMetadata["papers"],
): SearchMetadata["papers"] {
  if (spine.length === 0) {
    return [...qualified, ...deferred];
  }

  const windowSize = SEARCH_RESULTS_INITIAL_VISIBLE_COUNT;
  const cap = SEARCH_LIBRARY_FIRST_SCREEN_SUPPLEMENT_LIMIT;
  const head: SearchMetadata["papers"] = [];
  let spineIndex = 0;
  let qualifiedIndex = 0;
  let supplementsInWindow = 0;

  while (
    head.length < windowSize &&
    (spineIndex < spine.length || qualifiedIndex < qualified.length)
  ) {
    const atSupplementSlot =
      head.length > 0 &&
      supplementsInWindow < cap &&
      qualifiedIndex < qualified.length &&
      head.length % 3 === 2;

    if (atSupplementSlot) {
      head.push(qualified[qualifiedIndex++]);
      supplementsInWindow += 1;
    } else if (spineIndex < spine.length) {
      head.push(spine[spineIndex++]);
    } else if (qualifiedIndex < qualified.length && supplementsInWindow < cap) {
      // Spine exhausted mid-window; backfill with remaining qualified supplements.
      // head.length > 0 here, so this never places a supplement at rank 0.
      head.push(qualified[qualifiedIndex++]);
      supplementsInWindow += 1;
    } else {
      break;
    }
  }

  return [...head, ...spine.slice(spineIndex), ...qualified.slice(qualifiedIndex), ...deferred];
}

// Sorts a caller-provided result set by the selected non-combined option. The
// input order remains the relevance order for relevance and interest.
function sortQueryBand(
  papers: SearchMetadata["papers"],
  sortOption: SearchSortOption,
): SearchMetadata["papers"] {
  if (sortOption === "relevance" || sortOption === "interest") {
    return papers;
  }
  return papers.slice().sort((left, right) => {
    if (sortOption === "citationCount") {
      if (right.citationCount !== left.citationCount) {
        return right.citationCount - left.citationCount;
      }
      return (right.year ?? -Infinity) - (left.year ?? -Infinity);
    }
    if (sortOption === "yearAsc") {
      if ((left.year ?? Infinity) !== (right.year ?? Infinity)) {
        return (left.year ?? Infinity) - (right.year ?? Infinity);
      }
      return right.citationCount - left.citationCount;
    }
    if ((right.year ?? -Infinity) !== (left.year ?? -Infinity)) {
      return (right.year ?? -Infinity) - (left.year ?? -Infinity);
    }
    return right.citationCount - left.citationCount;
  });
}

export function sortSearchPapers(
  papers: SearchMetadata["papers"],
  sortOption: SearchSortOption,
  interestWeights?: Record<string, number>,
  libraryOnlyPaperIds?: readonly string[],
  query?: string,
  rankingMode?: "combined_score",
): SearchMetadata["papers"] {
  if (rankingMode === "combined_score") {
    if (sortOption === "relevance") {
      const libraryOnly = new Set(libraryOnlyPaperIds ?? []);
      return papers.filter((paper) => !libraryOnly.has(paper.paperId));
    }
    if (sortOption === "interest") {
      return sortInterestBand(papers, interestWeights ?? {});
    }
    return sortQueryBand(papers, sortOption);
  }

  // Legacy snapshot compatibility only: metadata written before `combined_score`
  // can still carry library-only ids without an explicit ranking mode. Preserve
  // that stored snapshot's historical reader behavior. New searches always return
  // from the combined branch above and use one pool without fixed slots.
  // @aspect aspect:library-grounded-research
  // @check acceptance-check:search-nonascii-library-relevance-korean-overlap
  if (!libraryOnlyPaperIds || libraryOnlyPaperIds.length === 0) {
    if (sortOption !== "interest") return sortQueryBand(papers, sortOption);
    const weights = interestWeights ?? {};
    return sortInterestBand(papers, weights);
  }

  const weights = interestWeights ?? {};
  const libraryOnly = new Set(libraryOnlyPaperIds);
  const queryPapers = papers.filter((paper) => !libraryOnly.has(paper.paperId));

  if (sortOption === "relevance") {
    return queryPapers;
  }

  if (sortOption === "interest") {
    // Legacy snapshot compatibility only. This preserves the historical spine,
    // language-aware admission, and bounded interleave for already stored payloads;
    // it is not the writer policy for current searches.
    // @check acceptance-check:search-nonascii-library-relevance-korean-overlap
    const spine = sortInterestBand(
      papers.filter((paper) => !libraryOnly.has(paper.paperId)),
      weights,
    );
    const qualifiedSupplements = sortInterestBand(
      papers.filter(
        (paper) =>
          libraryOnly.has(paper.paperId) && canCompeteInLibraryInterestPool({ paper, query }),
      ),
      weights,
    );
    const deferredSupplements = sortInterestBand(
      papers.filter(
        (paper) =>
          libraryOnly.has(paper.paperId) && !canCompeteInLibraryInterestPool({ paper, query }),
      ),
      weights,
    );

    return interleaveLibrarySupplements(spine, qualifiedSupplements, deferredSupplements);
  }

  const libraryBand = papers
    .filter((paper) => libraryOnly.has(paper.paperId))
    .sort((l, r) => (weights[r.paperId] ?? 0) - (weights[l.paperId] ?? 0));

  return [...sortQueryBand(queryPapers, sortOption), ...libraryBand];
}

export function resolveDefaultSearchSortOption(metadata: SearchMetadata): SearchSortOption {
  if (metadata.sortOption) {
    return metadata.sortOption;
  }

  return "relevance";
}
