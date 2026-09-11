/**
 * Library-grounded research — live anchor-set candidate blend.
 *
 * When a reader has a library context (coherent folder anchor sets), the search
 * pool is augmented with graph-neighbor candidates retrieved live from
 * Episteme 3 discovery, then ranked by library interest.
 * This is the live successor to the offline-precomputed neighborhood: the
 * anchor sets are still file-sourced, but the neighborhood/candidates are
 * resolved per request.
 *
 * Responsibility boundary: Episteme stays product-neutral (it only sees
 * E3 paper-reference `seeds` / `exclude` / caps). Light House owns the
 * folder→anchor/exclusion mapping here and the final ranking downstream. The
 * call is degrade-friendly — any E3 failure collapses to keyword-only search.
 *
 * @aspect aspect:library-grounded-research
 * @promise promise:search-results-fast-window
 * @check acceptance-check:search-results-fast-window-library-grounding-unavailable
 */
import type { MappedPaper } from "./search-service";
import type { LibraryContext } from "./library-context-source";
import { hydrateEpistemePapers } from "./episteme-literature";
import {
  lookupPaperNeighborhood,
  type LibraryNeighborhoodCandidate,
} from "./episteme-paper-neighborhood";
import { paperMatchesYearFilter } from "@/app/domain/search-year-range";
import { SEARCH_LIBRARY_NEAR_BAND_LIMIT } from "@/app/lib/constants";

export interface LibraryAnchorBlend {
  /** Blended result pool: keyword results ∪ hydrated graph candidates, deduped by paperId. */
  papers: MappedPaper[];
  /** Live paper id → E3 discovery fusion weight, for downstream projection. */
  neighborhood: Record<string, number>;
  /**
   * paperIds of the injected graph candidates that were NOT in the keyword pool
   * — graph candidates absent from the keyword result window. Interest ranking lets these
   * compete with keyword results; relevance excludes them. @aspect
   * aspect:library-grounded-research
   */
  injectedPaperIds: string[];
  /** True when E3 contributed a live neighborhood (candidates and/or projection). */
  blended: boolean;
}

export interface LibraryNeighborhoodLookupResult {
  /** corpusId → strongest default score across library folders. */
  neighborhood: Map<string, number>;
  /** corpusId → full candidate evidence from the same strongest folder result. */
  candidates: Map<string, LibraryNeighborhoodCandidate>;
  /**
   * `degraded` means at least one provider-backed folder lookup failed. An
   * empty `ready` result is an honest no-signal outcome.
   */
  providerStatus: "ready" | "degraded";
}

function toProviderPaperRefs(ids: readonly string[]): Array<string | number> {
  return ids.map((id) => (/^\d+$/u.test(id) ? Number(id) : id));
}

/**
 * Phase 1 — anchor-set neighborhood lookup. Depends only on the reader's local
 * folder anchors (`libraryContext.folders`), NOT on the keyword search results,
 * so the caller can run this concurrently with the keyword provider fetch
 * instead of after it. Returns a merged `corpus_id → strongest score` map
 * (empty when every anchor call degrades).
 */
export async function lookupLibraryNeighborhoodWithEvidence(params: {
  libraryContext: Pick<LibraryContext, "folders">;
  query?: string;
  candidateLimit: number;
  signal?: AbortSignal;
}): Promise<LibraryNeighborhoodLookupResult> {
  const { libraryContext, query, candidateLimit, signal } = params;

  // The reader already holds their library — never recommend their own papers back.
  const excludeCorpusIds = toProviderPaperRefs(
    libraryContext.folders.flatMap((folder) => folder.anchorCorpusIds),
  );

  // One bounded call per coherent anchor set (folder) keeps a multi-topic
  // library from collapsing onto its densest sub-topic. The calls run in
  // parallel and each degrades to null independently.
  const perFolder = await Promise.all(
    libraryContext.folders.map((folder) => {
      const corpusIds = toProviderPaperRefs(folder.anchorCorpusIds);
      if (corpusIds.length === 0) {
        return Promise.resolve({ attempted: false, candidates: null });
      }
      return lookupPaperNeighborhood({
        corpusIds,
        excludeCorpusIds,
        query,
        limit: candidateLimit,
        signal,
      }).then((candidates) => ({ attempted: true, candidates }));
    }),
  );

  // Merge across folders: dedup by corpus_id, keep the strongest score so a
  // candidate shared by several folders surfaces by its best anchor.
  const merged = new Map<string, number>();
  const candidates = new Map<string, LibraryNeighborhoodCandidate>();
  let providerStatus: LibraryNeighborhoodLookupResult["providerStatus"] = "ready";
  for (const outcome of perFolder) {
    if (outcome.attempted && outcome.candidates === null) {
      providerStatus = "degraded";
    }
    const list = outcome.candidates;
    if (!list) continue;
    for (const candidate of list) {
      const prev = merged.get(candidate.corpusId);
      if (prev === undefined || candidate.defaultScore > prev) {
        merged.set(candidate.corpusId, candidate.defaultScore);
        candidates.set(candidate.corpusId, candidate);
      }
    }
  }
  return { neighborhood: merged, candidates, providerStatus };
}

/**
 * Supplement-band hydration — hydrates the top `SEARCH_LIBRARY_NEAR_BAND_LIMIT`
 * neighborhood candidates by weight via `/papers/batch`. This function alone
 * owns the band cap, and the cap is applied BEFORE keyword dedup: the band is
 * selected without knowing the keyword pool, so the blend's later overlap
 * removal can under-fill the band and candidates ranked past the cap are never
 * backfilled. Depending only on the neighborhood lets the route preflight run
 * this concurrently with the keyword provider fetch. Best-effort: hydration
 * failure degrades to an empty band so the live neighborhood still projects.
 */
export async function hydrateNeighborhoodSupplementBand(params: {
  neighborhood: ReadonlyMap<string, number>;
  signal?: AbortSignal;
}): Promise<MappedPaper[]> {
  return (await hydrateNeighborhoodSupplementBandWithOutcome(params)).papers;
}

export async function hydrateNeighborhoodSupplementBandWithOutcome(params: {
  neighborhood: ReadonlyMap<string, number>;
  signal?: AbortSignal;
}): Promise<{ papers: MappedPaper[]; providerStatus: "ready" | "degraded" }> {
  const candidateIds = [...params.neighborhood.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, SEARCH_LIBRARY_NEAR_BAND_LIMIT)
    .map(([id]) => id);
  if (candidateIds.length === 0) return { papers: [], providerStatus: "ready" };
  try {
    return {
      papers: await hydrateEpistemePapers(candidateIds, params.signal),
      providerStatus: "ready",
    };
  } catch {
    return { papers: [], providerStatus: "degraded" };
  }
}

/**
 * Phase 2 — blend a pre-fetched neighborhood and its prehydrated supplement
 * band into the keyword pool. Needs the keyword results (to dedup the
 * supplements against them), so it runs after the keyword fetch — but it is a
 * pure computation with no provider round-trip: keyword-pool overlap removal →
 * neighborhood-weight order → year admission. The band cap belongs to
 * `hydrateNeighborhoodSupplementBand` and was applied before this dedup, so
 * removing overlaps can under-fill the band without backfilling ranks past the
 * cap. Degrades to keyword-only (`blended: false`) when the neighborhood is
 * empty.
 */
export function blendNeighborhoodIntoPool(params: {
  keywordPapers: MappedPaper[];
  neighborhood: Map<string, number>;
  /**
   * Supplement band hydrated upstream (route preflight or legacy repair
   * hydration), concurrently with or before the keyword results. An empty band
   * (hydration failed best-effort) injects nothing while the neighborhood
   * projection is kept.
   */
  prehydratedCandidates: readonly MappedPaper[];
  /**
   * Publication-year range of the active search (`YYYY-YYYY` / `YYYY-` /
   * `-YYYY` / `YYYY`). A year-constrained search must not inject graph
   * supplements outside the range — they would be hidden from the result list
   * by the client-side year filter while still polluting the year-distribution
   * widget and the reaction input pool.
   * @check acceptance-check:search-results-fast-window-publication-year-range-filter
   */
  year?: string;
}): LibraryAnchorBlend {
  const { keywordPapers, neighborhood, prehydratedCandidates, year } = params;

  // Every folder call failed or returned nothing → degrade to keyword-only.
  if (neighborhood.size === 0) {
    return { papers: keywordPapers, neighborhood: {}, injectedPaperIds: [], blended: false };
  }

  // Supplements are the prehydrated band candidates not already in the keyword
  // pool, in neighborhood-weight order. These keyword-window-absent candidates compete
  // in the default interest ranking. The full `merged` neighborhood still
  // projects onto the keyword pool regardless of supplement admission.
  const keywordIds = new Set(keywordPapers.map((paper) => paper.paperId));
  const supplements = prehydratedCandidates
    .filter((paper) => !keywordIds.has(paper.paperId))
    .sort(
      (left, right) =>
        (neighborhood.get(right.paperId) ?? 0) - (neighborhood.get(left.paperId) ?? 0),
    );
  // Year-constrained searches admit only in-range supplements (papers without
  // a year are dropped too, matching the client-side result filter).
  const admitted = year
    ? supplements.filter((paper) => paperMatchesYearFilter(paper.year, year))
    : supplements;

  return {
    papers: [...keywordPapers, ...admitted],
    neighborhood: Object.fromEntries(neighborhood),
    injectedPaperIds: admitted.map((paper) => paper.paperId),
    blended: true,
  };
}
