/**
 * Progressive hydration — deferred enrichment of a search view that
 * the `/search` route execution committed lightweight (Episteme 3 search window:
 * title/year/venue/citation/url only, no abstract/authors/PDF). This hydrates
 * the committed paper refs via E3 batch hydration. Library-near blending belongs
 * only to the first visible reveal; hydration fills card details without
 * injecting/reordering late supplements or calling PaperNeighborhood.
 *
 * Cards stay stable: we hydrate the EXACT committed paper refs in their original
 * provider order (abstracts fill in), rather than re-running search which
 * could reshuffle the result set.
 *
 * @promise promise:search-results-fast-window
 * @aspect aspect:library-grounded-research
 * @check acceptance-check:search-results-fast-window-library-source-sync
 * @check acceptance-check:search-results-fast-window-library-grounding-unavailable
 */
import type {
  SearchGraphSupportPaperScore,
  SearchLibraryGraphSupportMetadata,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import type { SearchEnrichmentCommandV1 } from "@/app/domain/search-background-transport";
import {
  SEARCH_LIBRARY_ANCHOR_CANDIDATE_LIMIT,
  SEARCH_LIBRARY_NEAR_BAND_LIMIT,
} from "@/app/lib/constants";
import { paperMatchesYearFilter } from "@/app/domain/search-year-range";
import { canCompeteInLibraryInterestPool } from "@/app/lib/search-paper-sort";
import {
  indexByEpistemePaperIdentity,
  isEpisteme3PaperRef,
  lookupByEpistemePaperIdentity,
} from "@/app/lib/episteme-paper-ref";
import {
  isEpisteme3SearchPaperId,
  shouldRepairSearchHydrationMetadata,
} from "@/app/lib/search-hydration-state";
import { hydrateEpistemePapers } from "./episteme-literature";
import {
  blendNeighborhoodIntoPool,
  hydrateNeighborhoodSupplementBandWithOutcome,
  lookupLibraryNeighborhoodWithEvidence,
} from "./library-anchor-blend";
import { selectNeighborhoodSupplements } from "./library-neighborhood-discovery";
import type { LibraryNeighborhoodCandidate } from "./episteme-paper-neighborhood";
import {
  filterLibraryContextByAnchorPaperIds,
  getLibraryContextForUser,
  type LibraryContext,
  type LibraryContextUserSource,
} from "./library-context-source";
import { rankByLibraryInterest } from "./library-grounded-ranking";
import { normalizeLookupTitle, type MappedPaper } from "./search-service";

/** SearchMetadata paper (committed lightweight) → MappedPaper for the blend/rank pipeline. */
export function metadataPaperToMapped(paper: SearchMetadata["papers"][number]): MappedPaper {
  const {
    paperId,
    title,
    abstract,
    year,
    citationCount,
    url,
    authors,
    venue,
    fieldsOfStudy,
    referenceCount,
  } = paper;

  return {
    title,
    paperId,
    year,
    abstract,
    citationCount,
    url,
    authors: authors.map(({ name }) => name),
    fieldsOfStudy: fieldsOfStudy ?? null,
    venue: venue ?? null,
    referenceCount: referenceCount ?? null,
    openAccessPdf: paper.openAccessPdf ?? null,
    externalIds: paper.externalIds ?? null,
    doi: paper.doi ?? null,
    source: paper.source ?? null,
    openAccess: paper.openAccess ?? null,
    referenceAvailability: paper.referenceAvailability ?? null,
    referenceIds: paper.referenceIds ?? null,
    citationAvailability: paper.citationAvailability ?? null,
    citationIds: paper.citationIds ?? null,
  };
}

function mergeHydratedSearchCardDetails(
  committedPaper: SearchMetadata["papers"][number],
  hydratedPaper: MappedPaper,
): MappedPaper {
  return {
    ...hydratedPaper,
    paperId: committedPaper.paperId,
    title: committedPaper.title,
    year: committedPaper.year,
    citationCount: committedPaper.citationCount,
  };
}

export interface SearchHydrationResult {
  /** Hydrated committed pool, preserving first-reveal order unless legacy blend runs. */
  papers: MappedPaper[];
  total: number;
  /** Library interest summary for `metadata.libraryContext`, or undefined when no signal. */
  librarySummary: SearchMetadata["libraryContext"];
  /** True when the current library context was resolved, even if this query has no scored signal. */
  libraryContextAvailable: boolean;
  resolvedSort: SearchMetadata["sortOption"];
  /** First-reveal library graph evidence; absent on keyword-only/locked hydration. */
  graphSupport?: SearchLibraryGraphSupportMetadata;
}

export interface LibraryNeighborhoodPreflight {
  libraryContext: LibraryContext;
  neighborhood: Map<string, number>;
  neighborhoodCandidates: Map<string, LibraryNeighborhoodCandidate>;
  /** Current user's library E3 paper references used as discovery anchors. */
  anchorPaperIds: string[];
  /**
   * Supplement band hydrated inside the preflight chain, concurrently with the
   * keyword fetch — the post-join blend is then a pure computation with no new
   * provider round-trip. Empty when hydration degraded best-effort: nothing is
   * injected while the neighborhood projection is kept.
   */
  hydratedCandidates: MappedPaper[];
  /**
   * `degraded` preserves provider/hydration failure separately from an honest
   * empty neighborhood. Exact provider reasons remain server-only telemetry.
   */
  providerStatus?: "ready" | "degraded";
  /** Per-leg durations of the preflight chain, for the route timing log. */
  legDurationsMs?: {
    neighborhood: number;
    supplementHydration: number;
  };
}

export { shouldRepairSearchHydrationMetadata as shouldRepairSearchHydration };

/**
 * Versioned background transport seam. It hydrates every committed numeric id
 * without reconstructing the client SearchMetadata view model; callers return
 * only the hydrated subset as a delta and preserve missing cards client-side.
 */
export async function computeSearchHydrationPaperDelta(
  command: SearchEnrichmentCommandV1,
  signal?: AbortSignal,
): Promise<MappedPaper[]> {
  const libraryOnlyPaperIds = new Set(command.hydration.libraryOnlyPaperIds);
  const orderedCorpusIds = command.target.orderedPaperIds.filter(
    (paperId) => isEpisteme3SearchPaperId(paperId) && !libraryOnlyPaperIds.has(paperId),
  );
  if (orderedCorpusIds.length === 0) return [];

  const hydratedPapers = await hydrateEpistemePapers(orderedCorpusIds, signal);
  const hydratedById = indexByEpistemePaperIdentity(hydratedPapers);
  return command.target.orderedPaperIds.flatMap((paperId) => {
    const paper = lookupByEpistemePaperIdentity(hydratedById, paperId);
    // The delta is joined client-side by the committed snapshot identity. E3
    // may resolve a canonical uid to an S2-backed card, so preserve the input
    // identity after alias lookup instead of leaking the alternate alias.
    return paper ? [{ ...paper, paperId }] : [];
  });
}

interface LibraryNeighborhoodPreflightParams {
  userEmail: string;
  query: string;
  personalize: boolean;
  libraryPaperIds?: readonly string[];
  libraryContextUserSource?: LibraryContextUserSource;
  signal?: AbortSignal;
  onFailure?: () => void;
}

export async function resolveLibraryNeighborhoodPreflight(
  params: LibraryNeighborhoodPreflightParams,
): Promise<LibraryNeighborhoodPreflight | null> {
  try {
    return await resolveLibraryNeighborhoodPreflightUnchecked(params);
  } catch (error) {
    params.onFailure?.();
    throw error;
  }
}

async function resolveLibraryNeighborhoodPreflightUnchecked(
  params: LibraryNeighborhoodPreflightParams,
): Promise<LibraryNeighborhoodPreflight | null> {
  if (!params.personalize) return null;
  const libraryContext = filterLibraryContextByAnchorPaperIds(
    params.libraryContextUserSource
      ? await getLibraryContextForUser(params.userEmail, params.libraryContextUserSource)
      : await getLibraryContextForUser(params.userEmail),
    params.libraryPaperIds,
  );
  if (!libraryContext || libraryContext.folders.length === 0) return null;
  const neighborhoodStartedAt = Date.now();
  const {
    neighborhood,
    candidates: neighborhoodCandidates,
    providerStatus: neighborhoodProviderStatus,
  } = await lookupLibraryNeighborhoodWithEvidence({
    libraryContext,
    query: params.query,
    candidateLimit: SEARCH_LIBRARY_ANCHOR_CANDIDATE_LIMIT,
    signal: params.signal,
  });
  const neighborhoodMs = Date.now() - neighborhoodStartedAt;
  // Hydrate the top-band supplement candidates inside the same preflight chain,
  // right after the folder-merge — this does NOT wait for the keyword results,
  // so the `/papers/batch` round-trip overlaps the keyword fetch and the
  // post-join blend stays a pure computation. Best-effort: the band helper
  // degrades to [] on failure while the neighborhood keeps projecting.
  const hydrationStartedAt = Date.now();
  const hydrationOutcome =
    neighborhood.size > 0
      ? await hydrateNeighborhoodSupplementBandWithOutcome({
          neighborhood,
          signal: params.signal,
        })
      : { papers: [], providerStatus: "ready" as const };
  return {
    libraryContext,
    neighborhood,
    neighborhoodCandidates,
    anchorPaperIds: [
      ...new Set(
        libraryContext.folders
          .flatMap((folder) => folder.anchorCorpusIds)
          .filter(isEpisteme3PaperRef),
      ),
    ],
    hydratedCandidates: hydrationOutcome.papers,
    providerStatus:
      neighborhoodProviderStatus === "degraded" || hydrationOutcome.providerStatus === "degraded"
        ? "degraded"
        : "ready",
    legDurationsMs: {
      neighborhood: neighborhoodMs,
      supplementHydration: Date.now() - hydrationStartedAt,
    },
  };
}

/**
 * Pure post-join computation: projects a completed preflight (neighborhood +
 * prehydrated supplement band) onto the arrived keyword results. No I/O starts
 * from the keyword result or from this join.
 */
export function applyLibraryNeighborhoodToSearchResults(params: {
  keywordPapers: readonly MappedPaper[];
  providerTotal: number;
  query: string;
  year?: string;
  requestedSort?: SearchMetadata["sortOption"];
  preflight: LibraryNeighborhoodPreflight | null;
}): SearchHydrationResult | null {
  if (!params.preflight) return null;
  const keywordPapers = [...params.keywordPapers];
  // The preflight already hydrated the supplement band concurrently with the
  // keyword fetch, so this blend is a pure computation — no provider call.
  const blend = blendNeighborhoodIntoPool({
    keywordPapers,
    neighborhood: params.preflight.neighborhood,
    prehydratedCandidates: params.preflight.hydratedCandidates,
    year: params.year,
  });
  return buildSearchHydrationResult({
    keywordPapers,
    providerTotal: params.providerTotal,
    blend,
    libraryContext: params.preflight.libraryContext,
    requestedSort: params.requestedSort,
    query: params.query,
    year: params.year,
    graphEvidence: params.preflight,
  });
}

const COMBINED_QUERY_WEIGHT = 0.5;
const COMBINED_LIBRARY_WEIGHT = 0.5;
const LIBRARY_MAGNITUDE_WEIGHT = 0.7;
const LIBRARY_RANK_WEIGHT = 0.3;
const LIBRARY_SCORE_LOWER_QUANTILE = 0.05;
const LIBRARY_SCORE_UPPER_QUANTILE = 0.95;

function quantile(values: readonly number[], percentile: number): number {
  const sortedValues = [...values].sort((left, right) => left - right);
  const position = (sortedValues.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const lowerValue = sortedValues[lower] ?? 0;
  const upperValue = sortedValues[upper] ?? lowerValue;

  if (lower === upper) return lowerValue;
  return lowerValue + (upperValue - lowerValue) * (position - lower);
}

function normalizedRankScore(zeroBasedRank: number, total: number): number {
  return total > 0 ? (total - zeroBasedRank) / total : 0;
}

function robustMagnitudeScore(params: { value: number; lower: number; upper: number }): number {
  if (params.upper === params.lower) {
    return params.value > 0 ? 1 : 0;
  }
  return Math.min(1, Math.max(0, (params.value - params.lower) / (params.upper - params.lower)));
}

function buildCombinedInterestProjection(params: {
  keywordPapers: readonly MappedPaper[];
  combinedPapers: readonly MappedPaper[];
  neighborhood: ReadonlyMap<string, number>;
}): {
  interestWeights: Record<string, number>;
  combinedRankWeights: Record<string, number>;
  signalPresent: boolean;
} {
  const rankedLibraryRelations = params.combinedPapers
    .map((paper, index) => ({
      paperId: paper.paperId,
      index,
      neighborhoodWeight: params.neighborhood.get(paper.paperId) ?? 0,
    }))
    .filter((item) => item.neighborhoodWeight > 0)
    .sort(
      (left, right) =>
        right.neighborhoodWeight - left.neighborhoodWeight || left.index - right.index,
    );

  if (rankedLibraryRelations.length === 0) {
    return { interestWeights: {}, combinedRankWeights: {}, signalPresent: false };
  }

  const interestWeights = Object.fromEntries(
    rankedLibraryRelations.map((item, index) => [
      item.paperId,
      rankedLibraryRelations.length - index,
    ]),
  );
  const neighborhoodScores = rankedLibraryRelations.map((item) => item.neighborhoodWeight);
  const lowerMagnitude = quantile(neighborhoodScores, LIBRARY_SCORE_LOWER_QUANTILE);
  const upperMagnitude = quantile(neighborhoodScores, LIBRARY_SCORE_UPPER_QUANTILE);
  const combinedRankWeights: Record<string, number> = {};
  const addContribution = (paperId: string, contribution: number) => {
    combinedRankWeights[paperId] = (combinedRankWeights[paperId] ?? 0) + contribution;
  };

  params.keywordPapers.forEach((paper, index) => {
    addContribution(
      paper.paperId,
      COMBINED_QUERY_WEIGHT * normalizedRankScore(index, params.keywordPapers.length),
    );
  });
  rankedLibraryRelations.forEach((item, index) => {
    const magnitudeScore = robustMagnitudeScore({
      value: item.neighborhoodWeight,
      lower: lowerMagnitude,
      upper: upperMagnitude,
    });
    const rankScore = normalizedRankScore(index, rankedLibraryRelations.length);
    const relationScore =
      LIBRARY_MAGNITUDE_WEIGHT * magnitudeScore + LIBRARY_RANK_WEIGHT * rankScore;
    addContribution(item.paperId, COMBINED_LIBRARY_WEIGHT * relationScore);
  });

  return { interestWeights, combinedRankWeights, signalPresent: true };
}

/**
 * Current personalized-search projection. Keyword matches and a bounded set of
 * graph candidates absent from the keyword result window share one result pool. Keyword-provider rank
 * and query-aware library relation are normalized independently and contribute
 * at most 0.5 each. The relation axis combines robust Episteme default-score
 * magnitude with stable graph rank. The same graph relation produces the
 * library basis marker; no hidden citation source or fixed-slot interleave.
 */
export function applyLibraryContextToSearchResults(params: {
  keywordPapers: readonly MappedPaper[];
  providerTotal: number;
  query: string;
  year?: string;
  requestedSort?: SearchMetadata["sortOption"];
  preflight: LibraryNeighborhoodPreflight | null;
}): SearchHydrationResult | null {
  if (!params.preflight) return null;
  const keywordPapers = [...params.keywordPapers];
  const supplements = selectNeighborhoodSupplements({
    keywordPapers,
    neighborhood: params.preflight.neighborhood,
    prehydratedCandidates: params.preflight.hydratedCandidates,
    year: params.year,
  });
  const combinedPapers = [...keywordPapers, ...supplements.supplementPapers];
  const { interestWeights, combinedRankWeights, signalPresent } = buildCombinedInterestProjection({
    keywordPapers,
    combinedPapers,
    neighborhood: params.preflight.neighborhood,
  });

  return {
    papers: combinedPapers,
    total: params.providerTotal + supplements.supplementPapers.length,
    librarySummary: {
      folders: params.preflight.libraryContext.folders.map(({ name }) => ({ name })),
      signalPresent,
      interestWeights,
      combinedRankWeights,
      rankingMode: "combined_score",
      libraryOnlyPaperIds: supplements.supplementPapers.map((paper) => paper.paperId),
      ...(params.preflight.libraryContext.computedAt
        ? { computedAt: params.preflight.libraryContext.computedAt }
        : {}),
    },
    libraryContextAvailable: true,
    resolvedSort: params.requestedSort ?? (signalPresent ? "interest" : "relevance"),
  };
}

/**
 * Produces the hydrated, blended, ranked result pool for a lightweight search
 * document. Returns `null` when the document is not pending hydration, carries
 * no numeric corpus ids, or the provider successfully returns no papers. The
 * caller preserves the committed lightweight cards and records that empty
 * success as terminal. Provider failures and aborts reject so the background
 * caller can apply its bounded retry policy instead of mistaking a failed repair
 * for a successful empty hydration.
 */
export async function computeSearchHydration(
  metadata: SearchMetadata,
  _userEmail: string,
  signal?: AbortSignal,
  options?: { repairReady?: boolean },
): Promise<SearchHydrationResult | null> {
  const abstractHydration = metadata.abstractHydration;
  const canHydrate =
    abstractHydration?.status === "pending" ||
    (options?.repairReady === true && shouldRepairSearchHydrationMetadata(metadata));
  if (!canHydrate || !abstractHydration) return null;

  const libraryOnlyPaperIds = new Set(metadata.libraryContext?.libraryOnlyPaperIds ?? []);
  const orderedCorpusIds = metadata.papers.map((paper) => paper.paperId);
  const nativePaperIds = orderedCorpusIds.filter(
    (paperId) => isEpisteme3SearchPaperId(paperId) && !libraryOnlyPaperIds.has(paperId),
  );
  if (nativePaperIds.length === 0) return null;

  const hydratedKeyword = await hydrateEpistemePapers(nativePaperIds, signal);
  if (hydratedKeyword.length === 0) return null;
  const year = metadata.yearFilter;

  // Keep the original `/search` order; a paper that failed to hydrate falls back
  // to its committed lightweight form so the card list never shrinks.
  const hydratedById = indexByEpistemePaperIdentity(hydratedKeyword);
  const keywordPapers: MappedPaper[] = metadata.papers.map((paper) => {
    const hydratedPaper = lookupByEpistemePaperIdentity(hydratedById, paper.paperId);
    return hydratedPaper
      ? mergeHydratedSearchCardDetails(paper, hydratedPaper)
      : metadataPaperToMapped(paper);
  });

  // Library graph retrieval belongs exclusively to the co-equal first-reveal
  // preflight in executeSearchFromUrl. Background hydration may enrich the
  // already committed cards, but it never starts a late PaperNeighborhood call
  // or mutates the visible result membership/order.
  return buildSearchHydrationResult({
    keywordPapers,
    providerTotal: metadata.total,
    blend: null,
    libraryContext: null,
    existingLibrarySummary: metadata.libraryContext,
    existingLibraryContextAvailable: metadata.libraryContextAvailable === true,
    existingSort: metadata.sortOption,
    requestedSort: abstractHydration.requestedSort,
    query: metadata.query,
    year,
  });
}

function buildSearchHydrationResult(params: {
  keywordPapers: readonly MappedPaper[];
  providerTotal: number;
  blend: {
    papers: MappedPaper[];
    neighborhood: Record<string, number>;
    injectedPaperIds: string[];
    blended: boolean;
  } | null;
  libraryContext: LibraryContext | null;
  existingLibrarySummary?: SearchMetadata["libraryContext"];
  existingLibraryContextAvailable?: boolean;
  existingSort?: SearchMetadata["sortOption"];
  requestedSort?: SearchMetadata["sortOption"];
  query: string;
  year?: string;
  graphEvidence?: LibraryNeighborhoodPreflight;
}): SearchHydrationResult {
  const {
    providerTotal,
    blend,
    libraryContext,
    existingLibrarySummary,
    existingLibraryContextAvailable,
    existingSort,
    requestedSort,
  } = params;
  const keywordPapers = [...params.keywordPapers];
  const dedupedOutcome = buildHydratedBlendOutcome({
    keywordPapers,
    providerTotal,
    blend,
  });

  const ranking =
    blend?.blended && libraryContext !== null
      ? rankByLibraryInterest(dedupedOutcome.resultPapers, {
          neighborhood: blend.neighborhood,
          folders: libraryContext.folders,
        })
      : null;
  const hasInterestSignal = ranking !== null && ranking.matchedCount > 0;

  // Honest pool degrade: supplements injected but nothing scored → drop them.
  const resultPapers =
    blend?.blended && !hasInterestSignal ? keywordPapers : dedupedOutcome.resultPapers;
  const injectedPaperIds = hasInterestSignal ? dedupedOutcome.libraryOnlyPaperIds : [];

  const librarySummary: SearchMetadata["libraryContext"] =
    ranking !== null && ranking.matchedCount > 0
      ? {
          folders: ranking.folders,
          signalPresent: true,
          interestWeights: ranking.interestWeights,
          libraryOnlyPaperIds: injectedPaperIds,
          ...(libraryContext?.computedAt ? { computedAt: libraryContext.computedAt } : {}),
        }
      : existingLibrarySummary;

  // Mirror the original route: an explicit requested sort wins; otherwise default
  // to interest when a signal scores, else provider relevance.
  const resolvedSort: SearchMetadata["sortOption"] =
    requestedSort ?? existingSort ?? (hasInterestSignal ? "interest" : "relevance");
  const graphSupport = params.graphEvidence
    ? buildLibraryGraphSupport({
        preflight: params.graphEvidence,
        keywordPapers,
        resultPapers,
        libraryOnlyPaperIds: injectedPaperIds,
        dedupedLibraryOnlyPaperIds: dedupedOutcome.libraryOnlyPaperIds,
        preDedupeInjectedPaperIds: blend?.injectedPaperIds ?? [],
        hasInterestSignal,
        query: params.query,
        year: params.year,
      })
    : undefined;

  return {
    papers: resultPapers,
    total: blend?.blended && hasInterestSignal ? dedupedOutcome.resultTotal : providerTotal,
    librarySummary,
    libraryContextAvailable: libraryContext !== null || existingLibraryContextAvailable === true,
    resolvedSort,
    ...(graphSupport ? { graphSupport } : {}),
  };
}

function toGraphSupportPaperScore(
  candidate: LibraryNeighborhoodCandidate,
): SearchGraphSupportPaperScore {
  return {
    defaultScore: candidate.defaultScore,
    graphScore: candidate.graphScore,
    semanticScore: candidate.semanticScore,
    sharedCiters: candidate.sharedCiters,
    sharedRefs: candidate.sharedRefs,
    seedCount: candidate.seedCount,
    sources: candidate.sources,
  };
}

function buildLibraryGraphSupport(params: {
  preflight: LibraryNeighborhoodPreflight;
  keywordPapers: readonly MappedPaper[];
  resultPapers: readonly MappedPaper[];
  libraryOnlyPaperIds: readonly string[];
  dedupedLibraryOnlyPaperIds: readonly string[];
  preDedupeInjectedPaperIds: readonly string[];
  hasInterestSignal: boolean;
  query: string;
  year?: string;
}): SearchLibraryGraphSupportMetadata {
  const keywordIds = new Set(params.keywordPapers.map((paper) => paper.paperId));
  const libraryOnlyIds = new Set(params.libraryOnlyPaperIds);
  const samplePaperIds = params.resultPapers
    .map((paper) => paper.paperId)
    .filter((paperId) => params.preflight.neighborhoodCandidates.has(paperId));
  const paperScores = Object.fromEntries(
    samplePaperIds.flatMap((paperId) => {
      const candidate = params.preflight.neighborhoodCandidates.get(paperId);
      return candidate ? [[paperId, toGraphSupportPaperScore(candidate)] as const] : [];
    }),
  );
  const hydratedIds = new Set(params.preflight.hydratedCandidates.map((paper) => paper.paperId));
  const publicationYearFiltered = params.year
    ? params.preflight.hydratedCandidates.filter(
        (paper) =>
          !keywordIds.has(paper.paperId) && !paperMatchesYearFilter(paper.year, params.year),
      ).length
    : 0;
  const deferredByQueryRelevance = params.resultPapers.filter(
    (paper) =>
      libraryOnlyIds.has(paper.paperId) &&
      !canCompeteInLibraryInterestPool({
        paper: {
          ...paper,
          authors: paper.authors.map((name) => ({ name })),
        },
        query: params.query,
      }),
  ).length;

  return {
    version: 2,
    source: "episteme-paper-neighborhood",
    basis: "library_anchor_neighborhood",
    status: samplePaperIds.length > 0 ? "ready" : "empty",
    anchorPaperCount: params.preflight.anchorPaperIds.length,
    samplePaperIds,
    paperScores,
    candidateCounts: {
      providerReturned: params.preflight.neighborhoodCandidates.size,
      hydrated: hydratedIds.size,
      keywordOverlap: [...params.preflight.neighborhoodCandidates.keys()].filter((paperId) =>
        keywordIds.has(paperId),
      ).length,
      admittedSupplement: params.libraryOnlyPaperIds.length,
      deferredByQueryRelevance,
      filteredOut: {
        candidateCap: Math.max(
          0,
          params.preflight.neighborhoodCandidates.size - SEARCH_LIBRARY_NEAR_BAND_LIMIT,
        ),
        hydrationUnavailable: Math.max(
          0,
          Math.min(params.preflight.neighborhood.size, SEARCH_LIBRARY_NEAR_BAND_LIMIT) -
            hydratedIds.size,
        ),
        publicationYear: publicationYearFiltered,
        nonPositiveScore: params.hasInterestSignal ? 0 : params.dedupedLibraryOnlyPaperIds.length,
        titleFamilyDuplicate: Math.max(
          0,
          params.preDedupeInjectedPaperIds.length - params.dedupedLibraryOnlyPaperIds.length,
        ),
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

function buildHydratedBlendOutcome(params: {
  keywordPapers: readonly MappedPaper[];
  providerTotal: number;
  blend: {
    papers: MappedPaper[];
    injectedPaperIds: string[];
    blended: boolean;
  } | null;
}): {
  resultPapers: MappedPaper[];
  resultTotal: number;
  libraryOnlyPaperIds: string[];
} {
  const { keywordPapers, providerTotal, blend } = params;
  // The initial search route owns title-family dedup before it commits the
  // visible result snapshot. Background hydration must preserve every committed
  // id and its order, including legacy snapshots that already contain a title
  // collision. A live blend may append only supplements whose title family is
  // absent from the committed pool and earlier admitted supplements.
  const seenTitleFamilies = new Set(
    keywordPapers.map((paper) => normalizeLookupTitle(paper.title)).filter(Boolean),
  );
  const injectedIds = new Set(blend?.injectedPaperIds ?? []);
  const admittedSupplements = (blend?.blended ? blend.papers : []).filter((paper) => {
    if (!injectedIds.has(paper.paperId)) return false;
    const titleFamily = normalizeLookupTitle(paper.title);
    if (titleFamily && seenTitleFamilies.has(titleFamily)) return false;
    if (titleFamily) seenTitleFamilies.add(titleFamily);
    return true;
  });
  const resultPapers = blend?.blended
    ? [...keywordPapers, ...admittedSupplements]
    : [...keywordPapers];
  const survivingIds = new Set(resultPapers.map((paper) => paper.paperId));
  return {
    resultPapers,
    resultTotal: blend?.blended ? resultPapers.length : providerTotal,
    libraryOnlyPaperIds: (blend?.injectedPaperIds ?? []).filter((id) => survivingIds.has(id)),
  };
}
