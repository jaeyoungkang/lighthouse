import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import type { SearchFacetFilters } from "@/app/domain/search-facets";
import {
  type SearchConditionUrlRejectionReason,
  validateSearchConditionUrl,
} from "@/app/lib/search-condition-url-budget";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set

// Client-side API route constants.
// Every hardcoded "/api/..." string in the client codebase should reference
// this module instead. Route handler files (app/api/.../route.ts) are excluded
// — they define the routes, they don't consume them.
// For dynamic routes, use the helper functions exported below.

export const API_ROUTES = {
  AUTH_MAGIC_LINK: "/api/auth/magic-link",
  AUTH_MOONLIGHT_SCHOLAR_SESSION: "/api/auth/moonlight-scholar/session",
  AUTH_SESSION_TOUCH: "/api/auth/session-touch",
  // The two paths below are Moonlight-host endpoints. They are resolved against
  // the Moonlight origin (NEXT_PUBLIC_MOONLIGHT_SCHOLAR_API_BASE_URL /
  // MOONLIGHT_SCHOLAR_API_BASE_URL), not served by this Next app.
  AUTH_MOONLIGHT_SCHOLAR_TOKEN: "/api/auth/moonlight-scholar-token",
  MOONLIGHT_SCHOLAR_LIBRARY_PAPERS: "/api/moonlight-scholar/library-papers",

  SEARCH_ENRICHMENT: "/api/search/enrichment",
  SEARCH_TERM_DISCOVERY: "/api/search/term-discovery",
  SEARCH_SPELLING_CORRECTION: "/api/search/spelling-correction",
  GRAPH_NEIGHBORS_HYDRATION: "/api/graph-neighbors/hydrate",
  GAP_REPORTS: "/api/gap-reports",
  GAP_REPORTS_STATUS: "/api/gap-reports/status",

  PAPERS_ANALYZE_INLINE: "/api/papers/analyze-inline",
  LIBRARY_CONTEXT_BOOTSTRAP: "/api/library-context/bootstrap",
  PAPERS_REVIEWED: "/api/papers/reviewed",

  ERRORS: "/api/errors",
  ANALYTICS_EVENTS: "/api/analytics-events",
} as const;

/** External Episteme 3 native API namespace, resolved against its configured origin. */
export const EPISTEME3_NATIVE_API_PREFIX = "/api/v3";

export const EPISTEME3_API_ROUTES = {
  SEARCH_PAPERS: `${EPISTEME3_NATIVE_API_PREFIX}/search/papers`,
  SEARCH_CAPABILITIES: `${EPISTEME3_NATIVE_API_PREFIX}/search/papers/capabilities`,
  PAPER_BY_REF: `${EPISTEME3_NATIVE_API_PREFIX}/papers/by-ref`,
  PAPER_BATCH: `${EPISTEME3_NATIVE_API_PREFIX}/papers/batch`,
  PAPER_DISCOVER: `${EPISTEME3_NATIVE_API_PREFIX}/papers/discover`,
  GRAPH_CITATIONS: `${EPISTEME3_NATIVE_API_PREFIX}/graph/citations`,
} as const;

/** `/api/gap-reports/${gapReportId}/reaction` */
export function gapReportReactionRoute(gapReportId: string): string {
  return `/api/gap-reports/${gapReportId}/reaction`;
}

/** `/api/gap-reports/${gapReportId}/enrichment-retry` */
export function gapReportEnrichmentRetryRoute(gapReportId: string): string {
  return `/api/gap-reports/${gapReportId}/enrichment-retry`;
}

/** `/api/route-ai-comments/generate/${viewId}` */
export function routeAiCommentGenerateRoute(viewId: string): string {
  return `/api/route-ai-comments/generate/${viewId}`;
}

type ResearchRoutePayloadRouteType = ResearchRoutePayload["type"];

export type ConditionRouteBuildResult =
  | { ok: true; route: string }
  | { ok: false; reason: SearchConditionUrlRejectionReason };

/** Durable gap reports keep their id URL. */
export function researchRoutePageRoute(
  documentId: string,
  type: ResearchRoutePayloadRouteType,
): string {
  return type === "gap_network" ? `/gap/${encodeURIComponent(documentId)}` : "/search";
}

export const GAP_OPENING_QUERY_VALUE = "1";

/** Product-owned route shown immediately while a detached gap report id is being reserved. */
export function gapOpeningRoute(): string {
  return `/gap?opening=${GAP_OPENING_QUERY_VALUE}`;
}

/**
 * Append loaded-result facet filters (`field`/`author`/`venue`/`hasPdf`) to a
 * search URL.
 */
function appendSearchFacetParams(
  searchParams: URLSearchParams,
  facetFilters: Partial<SearchFacetFilters> | undefined,
  normalize: boolean,
): void {
  for (const field of facetFilters?.fieldsOfStudy ?? []) {
    const value = normalize ? field.trim() : field;
    if (value) searchParams.append("field", value);
  }
  for (const author of facetFilters?.authors ?? []) {
    const value = normalize ? author.trim() : author;
    if (value) searchParams.append("author", value);
  }
  for (const venue of facetFilters?.venues ?? []) {
    const value = normalize ? venue.trim() : venue;
    if (value) searchParams.append("venue", value);
  }
  if (facetFilters?.hasPdf === true) searchParams.set("hasPdf", "true");
}

/** Submitting surface a `/search?q=` entry came from; the entry route emits the
    matching canonical submit event server-side. Absent on external entries
    (link, share, bookmark), which do not emit a submit event. */
export type SearchEntrySource =
  | "route-bar"
  | "empty-entry"
  | "requery"
  | "term"
  | "position"
  | "similar";

export interface SearchRoutePageParams {
  q?: string;
  sort?: string;
  year?: string;
  /** Legacy caller compatibility. The current URL builder intentionally ignores it. */
  personalize?: boolean;
  facetFilters?: Partial<SearchFacetFilters>;
  /** Client-known internal library availability; the server still resolves the
      current owner source for personalized search execution. */
  libraryContextAvailable?: boolean;
  entry?: SearchEntrySource;
  termSeed?: SearchMetadata["termSeed"];
  seedPaper?: PaperCore;
}

function searchRouteParams(params: SearchRoutePageParams, normalize: boolean): URLSearchParams {
  const searchParams = new URLSearchParams();
  const query = normalize ? params.q?.trim() : params.q;
  if (query) searchParams.set("q", query);
  if (params.sort && params.sort !== "interest" && params.sort !== "relevance") {
    searchParams.set("sort", params.sort);
  }
  const year = normalize ? params.year?.trim() : params.year;
  if (year) searchParams.set("year", year);
  appendSearchFacetParams(searchParams, params.facetFilters, normalize);
  if (params.libraryContextAvailable) searchParams.set("lib", "1");
  if (params.entry) searchParams.set("entry", params.entry);
  if (params.termSeed) {
    searchParams.set("termSourceQuery", params.termSeed.sourceQuery);
    searchParams.set("term", params.termSeed.term);
    searchParams.set("termType", params.termSeed.candidateType);
    searchParams.set("termSupport", String(params.termSeed.supportCount));
  }
  if (params.seedPaper) {
    // Identity + display context only; the abstract stays out of the URL. The
    // destination route keeps the slim seed as metadata.seedPaper.
    searchParams.set("seedPaperId", params.seedPaper.paperId);
    searchParams.set("seedPaperTitle", params.seedPaper.title);
    if (params.seedPaper.year !== null) {
      searchParams.set("seedPaperYear", String(params.seedPaper.year));
    }
    if (params.seedPaper.url) searchParams.set("seedPaperUrl", params.seedPaper.url);
    searchParams.set("seedPaperCitations", String(params.seedPaper.citationCount));
  }
  return searchParams;
}

/** `/search?q=...` — the canonical search execution URL. */
export function buildSearchRoutePageRoute(
  params: SearchRoutePageParams,
): ConditionRouteBuildResult {
  const rawValidation = validateSearchConditionUrl("search", searchRouteParams(params, false));
  if (!rawValidation.ok) return { ok: false, reason: rawValidation.reason };

  const searchParams = searchRouteParams(params, true);
  const validation = validateSearchConditionUrl("search", searchParams);
  return validation.ok
    ? { ok: true, route: validation.requestTarget }
    : { ok: false, reason: validation.reason };
}

function appendSeedPaperParams(searchParams: URLSearchParams, seedPaper: PaperCore): void {
  searchParams.set("seedPaperId", seedPaper.paperId);
  searchParams.set("seedPaperTitle", seedPaper.title);
  if (seedPaper.year !== null) searchParams.set("seedPaperYear", String(seedPaper.year));
  if (seedPaper.url) searchParams.set("seedPaperUrl", seedPaper.url);
  searchParams.set("seedPaperCitations", String(seedPaper.citationCount));
}

/** `/citation?seedPaperId=...` — Search-first citation lineage execution URL. */
export function buildCitationSeedPageRoute(seedPaper: PaperCore): ConditionRouteBuildResult {
  const searchParams = new URLSearchParams();
  appendSeedPaperParams(searchParams, seedPaper);
  const validation = validateSearchConditionUrl("citation", searchParams);
  return validation.ok
    ? { ok: true, route: validation.requestTarget }
    : { ok: false, reason: validation.reason };
}

/** `/similar?seedPaperId=...` — Search-first graph-neighbor execution URL. */
export function buildSimilarSeedPageRoute(seedPaper: PaperCore): ConditionRouteBuildResult {
  const searchParams = new URLSearchParams();
  appendSeedPaperParams(searchParams, seedPaper);
  const validation = validateSearchConditionUrl("similar", searchParams);
  return validation.ok
    ? { ok: true, route: validation.requestTarget }
    : { ok: false, reason: validation.reason };
}

/** Ephemeral research views replay their validated condition URL. */
export function buildResearchRoutePageRoute(
  document: Pick<ResearchRoutePayload, "id" | "type" | "metadata">,
): ConditionRouteBuildResult {
  if (document.type === "gap_network") {
    return { ok: true, route: `/gap/${encodeURIComponent(document.id)}` };
  }
  if (document.type === "search" && document.metadata.type === "search") {
    return buildSearchRoutePageRoute({
      q: document.metadata.query,
      sort: document.metadata.sortOption,
      year: document.metadata.yearFilter,
      facetFilters: document.metadata.facetFilters,
      libraryContextAvailable: document.metadata.libraryContextAvailable,
      termSeed: document.metadata.termSeed,
      seedPaper: document.metadata.seedPaper,
    });
  }
  if (document.type === "citation_lineage" && document.metadata.type === "citation_lineage") {
    return buildCitationSeedPageRoute(document.metadata.seedPaper);
  }
  if (document.type === "graph_neighbors" && document.metadata.type === "graph_neighbors") {
    return buildSimilarSeedPageRoute(document.metadata.seedPaper);
  }
  return { ok: false, reason: "invalid-value" };
}
