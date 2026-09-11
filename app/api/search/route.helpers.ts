import type { SearchMetadata } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { dedupePapersByTitleFamily } from "@/app/server/services/search-service";

// Test-only verification module.
// reason: current Evidence Ledgers cite these pure transition and blend checks while no Route
// Handler imports this module; keeping the fixture does not make it a production entrypoint.
// owner: promise:search-query-route-transition and promise:search-results-fast-window evidence.
// reviewWhen: move or retire the cited route.helpers tests in the owning Evidence Ledgers.

export { filterLibraryContextByAnchorPaperIds } from "@/app/server/services/library-context-source";

/** A minimal blend shape: the deduped result pool plus the injected supplements. */
interface BlendLike<T> {
  /** Blended pool (keyword results ∪ hydrated graph candidates). */
  papers: T[];
  /** paperIds absent from the keyword result window and injected from graph retrieval. */
  injectedPaperIds: string[];
  /** True when e2 actually contributed a live neighborhood. */
  blended: boolean;
}

export interface BlendDedupOutcome<T> {
  /** Title-family-deduped result pool: the blended pool when blended, else keyword pool. */
  resultPapers: T[];
  /** Result total: deduped pool size when blended, else the provider-reported total. */
  resultTotal: number;
  /**
   * Injected library-near supplements that survived dedup. A candidate that was a
   * title-family duplicate of a keyword result is dropped by dedup (keyword papers
   * sort first) and filtered here, so it stays out in the blended result pool.
   * @aspect aspect:library-grounded-research
   */
  libraryOnlyPaperIds: string[];
  /** Count of surviving candidates absent from the keyword result window. */
  candidateCount: number;
}

/**
 * Post-blend result pipeline: title-family dedup → surviving-id set →
 * libraryOnlyPaperIds (injected supplements ∩ survivors) → candidateCount.
 *
 * Extracted as a pure helper so the dedup-and-survivor interaction is testable:
 * when an injected library-near candidate is a title-family duplicate of a
 * keyword paper, dedup keeps the keyword paper (higher provider relevance) and
 * the candidate must drop out of libraryOnlyPaperIds, shrinking candidateCount.
 *
 * @check acceptance-check:search-results-fast-window-title-family-dedup
 * @aspect aspect:library-grounded-research
 */
export function applyBlendDedupAndLibraryOnly<
  T extends { paperId: string; title: string },
>(params: {
  keywordPapers: readonly T[];
  providerTotal: number;
  blend: BlendLike<T> | null;
}): BlendDedupOutcome<T> {
  const { keywordPapers, providerTotal, blend } = params;
  const resultPapers = dedupePapersByTitleFamily(blend?.blended ? blend.papers : keywordPapers);
  const resultTotal = blend?.blended ? resultPapers.length : providerTotal;
  const survivingIds = new Set(resultPapers.map((paper) => paper.paperId));
  const libraryOnlyPaperIds = (blend?.injectedPaperIds ?? []).filter((id) => survivingIds.has(id));
  return {
    resultPapers,
    resultTotal,
    libraryOnlyPaperIds,
    candidateCount: libraryOnlyPaperIds.length,
  };
}

/**
 * Route-level query transitions commit a fresh result set into the current search
 * document while clearing reactions from the previous result context.
 */
export function buildSearchViewQueryTransitionPatch(params: {
  title: string;
  content: string;
  metadata: SearchMetadata;
}): {
  title: string;
  content: string;
  metadata: SearchMetadata;
  reaction: RouteAiComment | null;
  reactionHistory: RouteAiComment[];
} {
  return {
    title: params.title,
    content: params.content,
    metadata: params.metadata,
    reaction: null,
    reactionHistory: [],
  };
}
