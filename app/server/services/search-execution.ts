// @promise promise:search-url-restores-search
// @promise promise:search-results-fast-window
// @aspect aspect:first-paint-persistence-independence
// @check acceptance-check:search-results-fast-window-library-grounding-unavailable
// @check acceptance-check:search-results-fast-window-publication-year-range-filter

import type {
  ResearchRoutePayload,
  SearchLibraryGroundingOutcome,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { normalizeSearchFacetFilters } from "@/app/domain/search-facets";
import { normalizeYearRangeFilter } from "@/app/domain/search-year-range";
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";
import { SEARCH_DOCUMENT_FETCH_LIMIT } from "@/app/lib/constants";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import { buildSearchViewPayload, fetchEpistemePapers } from "@/app/server/services/search-service";
import {
  applyLibraryContextToSearchResults,
  resolveLibraryNeighborhoodPreflight,
  type LibraryNeighborhoodPreflight,
  type SearchHydrationResult,
} from "@/app/server/services/search-hydration";
import type { LibraryContextUserSource } from "@/app/server/services/library-context-source";
import {
  searchParamsFromRecord,
  validateSearchConditionUrl,
  type SearchConditionUrlValidation,
} from "@/app/lib/search-condition-url-budget";

export interface SearchExecutionUrlParams {
  q?: string | string[];
  sort?: string | string[];
  year?: string | string[];
  personalize?: string | string[];
  field?: string | string[];
  author?: string | string[];
  venue?: string | string[];
  hasPdf?: string | string[];
  lib?: string | string[];
  termSourceQuery?: string | string[];
  term?: string | string[];
  termType?: string | string[];
  termSupport?: string | string[];
  seedPaperId?: string | string[];
  seedPaperTitle?: string | string[];
  seedPaperYear?: string | string[];
  seedPaperUrl?: string | string[];
  seedPaperCitations?: string | string[];
  entry?: string | string[];
}

export interface SearchExecutionInput {
  canonicalKey: string;
  query: string;
  year?: string;
  sort?: SearchMetadata["sortOption"];
  providerSort?: Exclude<SearchSortOption, "interest">;
  facetFilters?: SearchMetadata["facetFilters"];
  personalize: boolean;
  libraryContextAvailable: boolean;
  termSeed?: SearchMetadata["termSeed"];
  seedPaper?: PaperCore;
}

export interface SearchExecutionResult {
  view: ResearchRoutePayload;
  executed: boolean;
  failed: boolean;
}

const SEARCH_SORT_OPTIONS = new Set<SearchSortOption>([
  "relevance",
  "citationCount",
  "year",
  "yearAsc",
  "interest",
]);

const TERM_SEED_CANDIDATE_TYPES = new Set(["direct", "broader", "narrower", "variant"]);

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allParams(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function appendCanonicalValues(
  searchParams: URLSearchParams,
  key: string,
  values: readonly string[],
): void {
  for (const value of values
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort()) {
    searchParams.append(key, value);
  }
}

function buildCanonicalSearchExecutionKey(input: Omit<SearchExecutionInput, "canonicalKey">) {
  const params = new URLSearchParams();
  params.set("q", input.query);
  if (input.sort && input.sort !== "relevance" && input.sort !== "interest") {
    params.set("sort", input.sort);
  }
  if (input.year) params.set("year", input.year);
  if (input.libraryContextAvailable) params.set("lib", "1");
  appendCanonicalValues(params, "field", input.facetFilters?.fieldsOfStudy ?? []);
  appendCanonicalValues(params, "author", input.facetFilters?.authors ?? []);
  appendCanonicalValues(params, "venue", input.facetFilters?.venues ?? []);
  if (input.facetFilters?.hasPdf) params.set("hasPdf", "true");
  if (input.termSeed) {
    params.set("termSourceQuery", input.termSeed.sourceQuery);
    params.set("term", input.termSeed.term);
    params.set("termType", input.termSeed.candidateType);
    params.set("termSupport", String(input.termSeed.supportCount));
  }
  if (input.seedPaper) {
    params.set("seedPaperId", input.seedPaper.paperId);
    params.set("seedPaperTitle", input.seedPaper.title);
    if (input.seedPaper.year != null) params.set("seedPaperYear", String(input.seedPaper.year));
    if (input.seedPaper.url) params.set("seedPaperUrl", input.seedPaper.url);
    params.set("seedPaperCitations", String(input.seedPaper.citationCount));
  }
  return params.toString();
}

function parseSearchEntrySeeds(
  params: SearchExecutionUrlParams,
): Pick<SearchExecutionInput, "seedPaper" | "termSeed"> {
  const termSourceQuery = firstParam(params.termSourceQuery);
  const term = firstParam(params.term);
  const termType = firstParam(params.termType);
  const termSupport = Number(firstParam(params.termSupport));
  if (termSourceQuery && term && termType && TERM_SEED_CANDIDATE_TYPES.has(termType)) {
    return {
      termSeed: {
        sourceQuery: termSourceQuery,
        term,
        candidateType: termType as NonNullable<SearchMetadata["termSeed"]>["candidateType"],
        supportCount: Number.isFinite(termSupport) ? termSupport : 0,
      },
    };
  }

  const seedPaperId = firstParam(params.seedPaperId);
  const seedPaperTitle = firstParam(params.seedPaperTitle);
  if (seedPaperId && seedPaperTitle) {
    const seedPaperYear = Number(firstParam(params.seedPaperYear));
    const seedPaperCitations = Number(firstParam(params.seedPaperCitations));
    return {
      seedPaper: {
        paperId: seedPaperId,
        title: seedPaperTitle,
        abstract: null,
        year: Number.isFinite(seedPaperYear) ? seedPaperYear : null,
        citationCount: Number.isFinite(seedPaperCitations) ? seedPaperCitations : 0,
        url: firstParam(params.seedPaperUrl) ?? "",
        authors: [],
      },
    };
  }

  return {};
}

export function buildSearchExecutionFromUrlParams(
  params: SearchExecutionUrlParams,
): SearchExecutionInput | null {
  if (!validateSearchExecutionUrlParams(params).ok) return null;
  const query = (firstParam(params.q) ?? "").trim();
  if (!query) return null;
  const sortParam = firstParam(params.sort);
  const parsedSort = SEARCH_SORT_OPTIONS.has(sortParam as SearchSortOption)
    ? (sortParam as SearchSortOption)
    : undefined;
  // `relevance` and `interest` were the two selectable basis projections.
  // Direct legacy URLs remain valid, but both now mean the unified default
  // projection. Only the current secondary sort controls survive as input.
  const sort = parsedSort === "relevance" || parsedSort === "interest" ? undefined : parsedSort;
  const year = normalizeYearRangeFilter(firstParam(params.year));
  const facetFilters = normalizeSearchFacetFilters({
    fieldsOfStudy: allParams(params.field),
    authors: allParams(params.author),
    venues: allParams(params.venue),
    hasPdf: firstParam(params.hasPdf) === "true",
  });
  const hasFacet =
    facetFilters.fieldsOfStudy.length > 0 ||
    facetFilters.authors.length > 0 ||
    facetFilters.venues.length > 0 ||
    facetFilters.hasPdf;
  const input = {
    query,
    ...(year ? { year } : {}),
    ...(sort ? { sort } : {}),
    ...(sort ? { providerSort: sort } : {}),
    ...(hasFacet ? { facetFilters } : {}),
    personalize: firstParam(params.personalize) !== "false",
    libraryContextAvailable: firstParam(params.lib) === "1",
    ...parseSearchEntrySeeds(params),
  } satisfies Omit<SearchExecutionInput, "canonicalKey">;
  return {
    ...input,
    canonicalKey: buildCanonicalSearchExecutionKey(input),
  };
}

export function validateSearchExecutionUrlParams(
  params: SearchExecutionUrlParams,
): SearchConditionUrlValidation {
  return validateSearchConditionUrl("search", searchParamsFromRecord("search", params));
}

function buildEphemeralDocument(params: {
  ownerPrincipalId: string;
  input: SearchExecutionInput;
  metadata: SearchMetadata;
  status: ResearchRoutePayload["status"];
}): ResearchRoutePayload {
  const now = new Date().toISOString();
  return {
    id: buildEphemeralSearchViewId(params.input.canonicalKey),
    type: "search",
    title: params.input.query,
    content: "",
    createdBy: "user",
    metadata: params.metadata,
    reaction: null,
    refs: [],
    ownerPrincipalId: params.ownerPrincipalId,
    status: params.status,
    version: 0,
    reactionVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function linkAbortSignal(signal: AbortSignal | undefined): AbortController {
  const controller = new AbortController();
  if (!signal) return controller;
  if (signal.aborted) {
    controller.abort();
    return controller;
  }
  signal.addEventListener(
    "abort",
    () => {
      controller.abort();
    },
    { once: true },
  );
  return controller;
}

async function resolveInternalReviewedPapersSource(): Promise<LibraryContextUserSource> {
  // @search-first-paint-allow live-library-preflight
  const { resolveMyReviewedPapersLibraryContextSource } =
    await import("@/app/server/domain-access/reviewed-paper-access");
  return resolveMyReviewedPapersLibraryContextSource();
}

function startLibraryNeighborhoodPreflight(params: {
  userEmail?: string;
  input: SearchExecutionInput;
  libraryContextUserSource: LibraryContextUserSource | null;
  signal?: AbortSignal;
  onFailure: () => void;
}): Promise<LibraryNeighborhoodPreflight | null> | null {
  const { input, userEmail, libraryContextUserSource } = params;
  if (!userEmail || !input.personalize || !libraryContextUserSource) return null;
  return resolveLibraryNeighborhoodPreflight({
    userEmail,
    query: input.query,
    personalize: input.personalize,
    libraryContextUserSource,
    signal: params.signal,
    onFailure: params.onFailure,
  }).catch(() => null);
}

function resolveLibraryGroundingOutcome(params: {
  input: SearchExecutionInput;
  librarySourceOutcome: "pending" | "ready" | "empty" | "failed" | "skipped";
  reviewedPaperCount: number;
  preflight: LibraryNeighborhoodPreflight | null;
  preflightThrew: boolean;
  applied: boolean;
}): SearchLibraryGroundingOutcome {
  if (!params.input.personalize) {
    return { requested: false, status: "not_requested" };
  }
  if (params.applied) {
    return { requested: true, status: "applied" };
  }
  const knownLibrarySource = params.reviewedPaperCount > 0 || params.input.libraryContextAvailable;
  const providerUnavailable =
    params.preflight?.providerStatus === "degraded" || params.preflightThrew;
  const sourceUnavailable = params.librarySourceOutcome === "failed";
  if (knownLibrarySource && (providerUnavailable || sourceUnavailable)) {
    return { requested: true, status: "unavailable" };
  }
  return { requested: true, status: "no_signal" };
}

function resolveLibraryPreflightStatus(
  preflight: LibraryNeighborhoodPreflight | null,
  threw: boolean,
): "ready" | "degraded" | "not_started" {
  if (threw) return "degraded";
  if (!preflight) return "not_started";
  return preflight.providerStatus ?? "ready";
}

function buildFailedSearchMetadata(input: SearchExecutionInput): SearchMetadata {
  return {
    type: "search",
    query: input.query,
    sortOption: input.sort ?? "relevance",
    ...(input.year ? { yearFilter: input.year } : {}),
    ...(input.facetFilters ? { facetFilters: input.facetFilters } : {}),
    ...(input.seedPaper ? { seedPaper: input.seedPaper } : {}),
    ...(input.termSeed ? { termSeed: input.termSeed } : {}),
    ...(input.libraryContextAvailable ? { libraryContextAvailable: true } : {}),
    libraryGrounding: input.personalize
      ? { requested: true, status: "no_signal" }
      : { requested: false, status: "not_requested" },
    papers: [],
    total: 0,
    totalMode: "not_computed",
  };
}

export function buildPendingSearchViewFromInput(params: {
  ownerPrincipalId: string;
  input: SearchExecutionInput;
}): ResearchRoutePayload {
  return buildEphemeralDocument({
    ownerPrincipalId: params.ownerPrincipalId,
    input: params.input,
    metadata: buildFailedSearchMetadata(params.input),
    status: "pending",
  });
}

/**
 * Structured per-search timing log — one line per search execution. Carries
 * only non-identifying values (lengths, counts, flags, durations); the raw
 * query string must never be logged. Logging is best-effort and must never
 * throw into the search path, including the failure path.
 */
function logSearchTiming(entry: Record<string, unknown>): void {
  try {
    console.info("[search-timing]", entry);
  } catch {
    // Timing telemetry must never break a search response.
  }
}

export async function executeSearchFromUrl(params: {
  ownerPrincipalId: string;
  userEmail?: string;
  input: SearchExecutionInput;
  signal?: AbortSignal;
}): Promise<SearchExecutionResult> {
  const ownerPrincipalId = params.ownerPrincipalId;
  // Preserve `personalize=false` as a validated legacy URL carrier, but do not
  // let it own current search identity or projection behavior.
  const input = params.input.personalize ? params.input : { ...params.input, personalize: true };
  const searchStartedAt = Date.now();
  const librarySourceStartedAt = Date.now();
  let librarySourceResolutionMs: number | null = null;
  let librarySourceOutcome: "pending" | "ready" | "empty" | "failed" | "skipped" =
    params.userEmail && input.personalize ? "pending" : "skipped";
  let reviewedPaperCount = 0;
  // Current owner-shaped library state and keyword retrieval are independent
  // first-payload inputs. Start both without awaiting either. The graph leg can
  // begin as soon as the library source resolves, while a source failure
  // remains an isolated keyword-only degradation.
  const libraryContextUserSourcePromise: Promise<LibraryContextUserSource | null> =
    params.userEmail && input.personalize
      ? resolveInternalReviewedPapersSource()
          .then((source) => {
            librarySourceResolutionMs = Date.now() - librarySourceStartedAt;
            reviewedPaperCount = source.reviewedPapers.length;
            librarySourceOutcome = reviewedPaperCount > 0 ? "ready" : "empty";
            return source;
          })
          .catch(() => {
            librarySourceResolutionMs = Date.now() - librarySourceStartedAt;
            librarySourceOutcome = "failed";
            return null;
          })
      : Promise.resolve(null);
  let preflightMs: number | null = null;
  let libraryPreflightThrew = false;
  const libraryPreflightAbort = linkAbortSignal(params.signal);
  const libraryPreflightPromise = libraryContextUserSourcePromise.then(
    (libraryContextUserSource) => {
      const preflightStartedAt = Date.now();
      const startedPreflightPromise = startLibraryNeighborhoodPreflight({
        userEmail: params.userEmail,
        input,
        libraryContextUserSource,
        signal: libraryPreflightAbort.signal,
        onFailure: () => {
          libraryPreflightThrew = true;
        },
      });
      if (!startedPreflightPromise) return null;
      return startedPreflightPromise.then((preflight) => {
        preflightMs = Date.now() - preflightStartedAt;
        return preflight;
      });
    },
  );
  try {
    const keywordFetchStartedAt = Date.now();
    const keywordFetchPromise = fetchEpistemePapers(
      {
        query: input.query,
        limit: SEARCH_DOCUMENT_FETCH_LIMIT,
        year: input.year,
        sort: input.providerSort,
        hydrate: false,
      },
      params.signal,
    );
    const [
      { papers, total, totalMode, queryClauses, clauseStats, exactLookup, paging, source },
      libraryPreflight,
    ] = await Promise.all([keywordFetchPromise, libraryPreflightPromise]);
    const keywordFetchMs = Date.now() - keywordFetchStartedAt;
    // Library preflight는 keyword fetch와 같은 첫 응답에서 join된다. 각 leg는
    // provider timeout과 upstream signal로 bounded이고, 실패하면 keyword-only로
    // degrade한다. 성공하면 bounded library neighbors가 같은 result pool에 합류한다.
    // @check acceptance-check:search-results-fast-window-library-interest-default
    // @check acceptance-check:search-results-fast-window-library-neighbor-combined-pool
    // @check acceptance-check:search-results-fast-window-library-first-response
    const libraryProjectionStartedAt = Date.now();
    // Pure computation over already-arrived inputs; an unexpected throw still
    // degrades to the keyword-only first payload instead of failing the search.
    const initialLibraryProjection = ((): SearchHydrationResult | null => {
      try {
        if (
          libraryPreflight?.providerStatus === "degraded" &&
          libraryPreflight.neighborhood.size === 0
        ) {
          return null;
        }
        const projection = applyLibraryContextToSearchResults({
          keywordPapers: papers,
          providerTotal: total,
          query: input.query,
          year: input.year,
          requestedSort: input.sort,
          preflight: libraryPreflight,
        });
        if (
          libraryPreflight?.providerStatus === "degraded" &&
          projection?.librarySummary?.signalPresent !== true
        ) {
          return null;
        }
        return projection;
      } catch {
        return null;
      }
    })();
    const libraryProjectionMs = Date.now() - libraryProjectionStartedAt;
    const shouldApplyInitialLibraryContext = initialLibraryProjection?.librarySummary !== undefined;
    const libraryGrounding = resolveLibraryGroundingOutcome({
      input,
      librarySourceOutcome,
      reviewedPaperCount,
      preflight: libraryPreflight,
      preflightThrew: libraryPreflightThrew,
      applied: initialLibraryProjection?.librarySummary?.signalPresent === true,
    });
    const initialLibraryContextAvailable =
      input.libraryContextAvailable ||
      libraryPreflight !== null ||
      shouldApplyInitialLibraryContext;
    const initialPapers = shouldApplyInitialLibraryContext
      ? initialLibraryProjection.papers
      : papers;
    const initialTotal = shouldApplyInitialLibraryContext ? initialLibraryProjection.total : total;
    const initialSortOption = shouldApplyInitialLibraryContext
      ? initialLibraryProjection.resolvedSort
      : input.sort;
    const payload = buildSearchViewPayload(
      ownerPrincipalId,
      input.query,
      initialPapers,
      initialTotal,
      "user",
      queryClauses,
      totalMode,
      clauseStats,
      ownerPrincipalId,
      new Map(),
      input.seedPaper,
      input.termSeed,
      undefined,
      initialSortOption,
      input.year,
      input.facetFilters,
      exactLookup,
      paging,
      source,
      {
        context: shouldApplyInitialLibraryContext
          ? initialLibraryProjection.librarySummary
          : undefined,
        available: initialLibraryContextAvailable,
        outcome: libraryGrounding,
      },
      exactLookup?.kind === "doi"
        ? undefined
        : {
            status: "pending",
            ...(input.sort ? { requestedSort: input.sort } : {}),
          },
    );
    const firstRevealMetadata = payload.metadata as SearchMetadata;
    logSearchTiming({
      outcome: "ready",
      queryLength: input.query.length,
      clauseCount: queryClauses.length,
      personalize: input.personalize,
      paperCount: initialPapers.length,
      libraryContextApplied: shouldApplyInitialLibraryContext,
      libraryGroundingStatus: libraryGrounding.status,
      libraryGraphMatched: Object.keys(
        initialLibraryProjection?.librarySummary?.interestWeights ?? {},
      ).length,
      libraryDiscoveryCount:
        initialLibraryProjection?.librarySummary?.libraryOnlyPaperIds?.length ?? 0,
      preflightResolved:
        libraryPreflight !== null && libraryPreflight.providerStatus !== "degraded",
      preflightStatus: resolveLibraryPreflightStatus(libraryPreflight, libraryPreflightThrew),
      librarySourceOutcome,
      reviewedPaperCount,
      librarySourceResolutionMs,
      keywordFetchMs,
      preflightMs,
      preflightNeighborhoodMs: libraryPreflight?.legDurationsMs?.neighborhood ?? null,
      preflightDiscoveryHydrationMs: libraryPreflight?.legDurationsMs?.supplementHydration ?? null,
      graphCandidatesReturned: libraryPreflight?.neighborhoodCandidates.size ?? 0,
      graphCandidatesHydrated: libraryPreflight?.hydratedCandidates.length ?? 0,
      libraryProjectionMs,
      totalMs: Date.now() - searchStartedAt,
    });
    return {
      view: buildEphemeralDocument({
        ownerPrincipalId,
        input,
        metadata: firstRevealMetadata,
        status: "ready",
      }),
      executed: true,
      failed: false,
    };
  } catch {
    libraryPreflightAbort.abort();
    logSearchTiming({
      outcome: "failed",
      queryLength: input.query.length,
      personalize: input.personalize,
      librarySourceOutcome,
      reviewedPaperCount,
      librarySourceResolutionMs,
      preflightMs,
      totalMs: Date.now() - searchStartedAt,
    });
    return {
      view: buildEphemeralDocument({
        ownerPrincipalId,
        input,
        metadata: buildFailedSearchMetadata(input),
        status: "failed",
      }),
      executed: false,
      failed: true,
    };
  }
}
