/**
 * 검색 비즈니스 로직 — 순수 fetch + 변환만 담당.
 * DB 저장은 domain-access 계층에서 수행한다.
 */

// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-doi-exact-lookup

import type {
  SearchMetadata,
  CitationLineageMetadata,
  CreateResearchRoutePayloadParams,
  GraphNeighborsMetadata,
  SearchQueryClauseStat,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import {
  getReviewedAtForEpistemePaper,
  matchesEpistemePaperIdentity,
} from "@/app/lib/episteme-paper-ref";
import type { SearchQueryClause } from "@/app/domain/search-query";
import { paperMatchesYearFilter } from "@/app/domain/search-year-range";
import {
  allocateSearchClauseLimits,
  getResolvedSearchQueryClauses,
  parseSearchQueryClauses,
} from "@/app/lib/search-query";
import { extractArxivIdFromDoi, normalizeDoiSearchInput } from "@/app/lib/doi";
import { t } from "@/app/i18n/message-access";
import { normalizeSearchQueryClauses } from "./query-clause-normalization-service";
import { buildSearchResultsView } from "./search-results-view";
import {
  fetchEpistemeSearchWindow,
  hydrateEpistemePapers,
  lookupCitationLineageForPaper,
  lookupEpistemePaperByIdentifier,
  lookupGraphNeighborsForPaper,
  mapEpistemePaper,
} from "./episteme-literature";

const CITATION_LINEAGE_MAX_PAPERS = 40;

export { mapEpistemePaper };
export { lookupCitationLineageForPaper };
export { lookupGraphNeighborsForPaper };

export interface MappedPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  venue?: string | null;
  fieldsOfStudy?: string[] | null;
  citationCount: number;
  referenceCount?: number | null;
  url: string;
  authors: string[];
  openAccessPdf?: { url: string; status?: string | null } | null;
  openAccess?: PaperCore["openAccess"];
  source?: PaperCore["source"];
  doi?: string | null;
  externalIds?: Record<string, string | number | null> | null;
  referenceIds?: string[] | null;
  citationIds?: string[] | null;
  referenceAvailability?: PaperCore["referenceAvailability"];
  citationAvailability?: PaperCore["citationAvailability"];
}

export interface PaperLookupMatch extends MappedPaper {
  id: string;
  exactTitleMatch: boolean;
}

export interface PaperLookupResult {
  query: string;
  total: number;
  matches: PaperLookupMatch[];
}

interface ExactLookupMetadata {
  kind: "doi";
  value: string;
}

export {
  allocateSearchClauseLimits as allocateEpistemeClauseLimits,
  parseSearchQueryClauses as parseEpistemeSearchClauses,
};

interface ResolvedFetchClauses {
  queryClauses: SearchQueryClause[];
  effectiveClauses: string[];
}

export function buildDocumentPaper(
  paper: MappedPaper,
  reviewedAt?: Date,
): SearchMetadata["papers"][number] {
  return {
    paperId: paper.paperId,
    title: paper.title,
    abstract: paper.abstract,
    year: paper.year,
    venue: paper.venue ?? null,
    fieldsOfStudy: paper.fieldsOfStudy ?? null,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount ?? null,
    url: paper.url,
    authors: paper.authors.map((name) => ({ name })),
    openAccessPdf: paper.openAccessPdf ?? null,
    openAccess: paper.openAccess ?? null,
    source: paper.source ?? null,
    doi: paper.doi ?? null,
    externalIds: paper.externalIds ?? null,
    referenceIds: paper.referenceIds ?? null,
    citationIds: paper.citationIds ?? null,
    referenceAvailability: paper.referenceAvailability ?? null,
    citationAvailability: paper.citationAvailability ?? null,
    reviewed: reviewedAt != null,
    ...(reviewedAt ? { reviewedAt: reviewedAt.toISOString() } : {}),
  };
}

export function normalizeLookupTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim();
}

/**
 * Drops title-family near-duplicates (same normalized title — e.g. punctuation
 * or trailing-period variants of the same paper that the provider returns as
 * separate corpus records) from a result pool, keeping the first (highest
 * provider-relevance) occurrence. Papers with an empty normalized title are
 * always kept (never collapsed together). Order is otherwise preserved.
 *
 * Accepted risk: the key is title-only, so two genuinely distinct works sharing
 * an identical normalized title (e.g. "Editorial", "Introduction", or two papers
 * both titled "Machine Learning") collapse to the first occurrence — a rare
 * false-positive we accept to keep punctuation/period variants of the same corpus
 * record from showing twice. Tightening the key (author/year) stays deferred
 * unless duplicate-title collisions prove material in real result sets.
 * @promise promise:search-results-fast-window
 * @check acceptance-check:search-results-fast-window-title-family-dedup
 */
export function dedupePapersByTitleFamily<T extends { title: string }>(papers: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const paper of papers) {
    const key = normalizeLookupTitle(paper.title);
    if (key.length > 0) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(paper);
  }
  return out;
}

function getLookupPriority(query: string, title: string): number {
  const normalizedQuery = normalizeLookupTitle(query);
  const normalizedTitle = normalizeLookupTitle(title);
  if (!normalizedQuery || !normalizedTitle) return 3;
  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedTitle.startsWith(normalizedQuery)) return 1;
  if (normalizedTitle.includes(normalizedQuery) || normalizedQuery.includes(normalizedTitle)) {
    return 2;
  }
  return 3;
}

function resolveFetchClauses(params: { query: string; offset?: number }): ResolvedFetchClauses {
  const normalizedQueryClauses = normalizeSearchQueryClauses(params.query);
  if (normalizedQueryClauses.length === 0) {
    return {
      queryClauses: [],
      effectiveClauses: [],
    };
  }

  if (params.offset && params.offset > 0) {
    return {
      queryClauses: [],
      effectiveClauses: [params.query.trim()],
    };
  }

  const queryClauses = getResolvedSearchQueryClauses({
    query: params.query,
    queryClauses: normalizedQueryClauses,
  });
  const effectiveClauses = queryClauses.map((clause) => clause.normalizedClause);

  return { queryClauses, effectiveClauses };
}

async function fetchEpistemeMultiQuery(params: {
  limit: number;
  year?: string;
  sort?: string;
  hydrate?: boolean;
  signal?: AbortSignal;
  queryClauses: SearchQueryClause[];
  effectiveClauses: string[];
}): Promise<{
  papers: MappedPaper[];
  total: number;
  totalMode: "merged";
  queryClauses: SearchQueryClause[];
  clauseStats: SearchQueryClauseStat[];
}> {
  const activeClauses = params.effectiveClauses.slice(
    0,
    Math.max(1, Math.min(params.effectiveClauses.length, params.limit)),
  );
  const scopedQueryClauses = params.queryClauses.slice(0, activeClauses.length);
  const limits = allocateSearchClauseLimits(params.limit, activeClauses.length, scopedQueryClauses);
  // 절별 fetch는 서로 독립이므로 동시에 시작한다. Promise.all은 clause 배열 순서를
  // 그대로 보존하고, 한 절이라도 실패하면 전체가 reject된다 — 순차 루프 시절의
  // fail-fast 의미(절 하나 실패 = 검색 전체 실패)와 동일하다. Episteme transport의
  // process-local admission/breaker가 병렬 호출을 한 경계에서 제한한다.
  const clauseResults = await Promise.all(
    activeClauses.map((clause, index) =>
      fetchEpistemeSingleQuery(
        {
          query: clause,
          limit: limits[index] ?? 1,
          offset: 0,
          year: params.year,
          sort: params.sort,
          hydrate: params.hydrate,
        },
        params.signal,
      ),
    ),
  );

  const papers = mergeEpistemeClauseResults({
    clauseResults,
    limit: params.limit,
    sort: params.sort,
  });
  const clauseStats: SearchQueryClauseStat[] = activeClauses.map((clause, index) => ({
    clause,
    role: scopedQueryClauses[index]?.role ?? "other",
    total: clauseResults[index]?.total ?? 0,
    fetched: clauseResults[index]?.papers.length ?? 0,
    providerWindow: {
      totalMode: clauseResults[index]?.totalMode,
      hasMore: clauseResults[index]?.paging?.hasMore ?? false,
      nextCursor: clauseResults[index]?.paging?.nextCursor,
      generation: clauseResults[index]?.source?.generation,
      completenessStatus: clauseResults[index]?.source?.completenessStatus,
      currencyState: clauseResults[index]?.source?.currencyState,
      totalCoverage: clauseResults[index]?.source?.totalCoverage,
    },
  }));

  return {
    papers,
    total: papers.length,
    totalMode: "merged",
    queryClauses: params.queryClauses,
    clauseStats,
  };
}

function mergeSortedClauseResults(params: {
  clauseResults: Array<{ papers: MappedPaper[] }>;
  limit: number;
  sort: string;
}): MappedPaper[] {
  const uniquePapers = new Map<string, MappedPaper>();

  for (const clauseResult of params.clauseResults) {
    for (const paper of clauseResult.papers) {
      const existing = uniquePapers.get(paper.paperId);
      if (!existing) {
        uniquePapers.set(paper.paperId, paper);
        continue;
      }

      if (
        (params.sort === "citationCount" && paper.citationCount > existing.citationCount) ||
        (params.sort === "year" && (paper.year ?? -Infinity) > (existing.year ?? -Infinity)) ||
        (params.sort === "yearAsc" && (paper.year ?? Infinity) < (existing.year ?? Infinity))
      ) {
        uniquePapers.set(paper.paperId, paper);
      }
    }
  }

  return [...uniquePapers.values()]
    .sort((left, right) => {
      if (params.sort === "citationCount") {
        return right.citationCount - left.citationCount;
      }
      if (params.sort === "yearAsc") {
        if ((left.year ?? Infinity) !== (right.year ?? Infinity)) {
          return (left.year ?? Infinity) - (right.year ?? Infinity);
        }
        return right.citationCount - left.citationCount;
      }
      return (right.year ?? -Infinity) - (left.year ?? -Infinity);
    })
    .slice(0, params.limit);
}

function mergeRoundRobinClauseResults(params: {
  clauseResults: Array<{ papers: MappedPaper[] }>;
  limit: number;
}): MappedPaper[] {
  const merged: MappedPaper[] = [];
  const seenPaperIds = new Set<string>();
  const offsets: number[] = Array.from({ length: params.clauseResults.length }, () => 0);

  while (merged.length < params.limit) {
    let progressed = false;

    for (let clauseIndex = 0; clauseIndex < params.clauseResults.length; clauseIndex++) {
      const papers = params.clauseResults[clauseIndex]?.papers ?? [];

      while (offsets[clauseIndex] < papers.length) {
        const nextOffset = offsets[clauseIndex];
        const paper = papers[nextOffset];
        offsets[clauseIndex] = nextOffset + 1;

        if (seenPaperIds.has(paper.paperId)) {
          continue;
        }

        seenPaperIds.add(paper.paperId);
        merged.push(paper);
        progressed = true;
        break;
      }

      if (merged.length >= params.limit) {
        break;
      }
    }

    if (!progressed) {
      break;
    }
  }

  return merged;
}

export function mergeEpistemeClauseResults(params: {
  clauseResults: Array<{ papers: MappedPaper[] }>;
  limit: number;
  sort?: string;
}): MappedPaper[] {
  const limit = Math.max(1, params.limit);
  const sort = params.sort ?? "relevance";

  if (sort !== "relevance") {
    return mergeSortedClauseResults({
      clauseResults: params.clauseResults,
      limit,
      sort,
    });
  }

  return mergeRoundRobinClauseResults({
    clauseResults: params.clauseResults,
    limit,
  });
}

async function fetchEpistemeSingleQuery(
  params: {
    query: string;
    limit: number;
    offset?: number;
    year?: string;
    sort?: string;
    hydrate?: boolean;
  },
  signal?: AbortSignal,
) {
  const result = await fetchEpistemeSearchWindow(params, signal);
  return {
    papers:
      params.sort && params.sort !== "relevance"
        ? mergeSortedClauseResults({
            clauseResults: [{ papers: result.papers }],
            limit: params.limit,
            sort: params.sort,
          })
        : result.papers,
    total: result.total,
    totalMode: result.totalMode,
    paging: result.paging,
    source: result.source,
  };
}

async function lookupEpistemePaperByDoi(
  doi: string,
  signal?: AbortSignal,
): Promise<MappedPaper | null> {
  const arxivId = extractArxivIdFromDoi(doi);
  if (arxivId) {
    const arxivPaper = await lookupEpistemePaperByIdentifier({ arxivId }, signal);
    if (arxivPaper) {
      return {
        ...arxivPaper,
        doi: arxivPaper.doi ?? doi,
        externalIds: {
          ...(arxivPaper.externalIds ?? {}),
          DOI: arxivPaper.externalIds?.DOI ?? doi,
        },
      };
    }
  }

  return lookupEpistemePaperByIdentifier({ doi }, signal);
}

/**
 * Episteme literature API 호출 → MappedPaper[] 반환.
 * Episteme search/lookup의 provider-neutral MappedPaper projection.
 */
export async function fetchEpistemePapers(
  params: {
    query: string;
    limit: number;
    offset?: number;
    year?: string;
    sort?: string;
    /**
     * When false, return the lightweight `/search` keyword window (no
     * abstract/authors/PDF) without the `/papers/batch` hydration round-trip —
     * progressive hydration commits this first. DOI exact-lookup ignores this
     * (it resolves a single fully-hydrated paper).
     */
    hydrate?: boolean;
  },
  signal?: AbortSignal,
): Promise<{
  papers: MappedPaper[];
  total: number;
  totalMode: NonNullable<SearchMetadata["totalMode"]>;
  paging?: SearchMetadata["paging"];
  source?: SearchMetadata["source"];
  queryClauses: SearchQueryClause[];
  clauseStats: SearchQueryClauseStat[];
  exactLookup?: ExactLookupMetadata;
}> {
  const normalizedDoi = params.offset ? null : normalizeDoiSearchInput(params.query);
  if (normalizedDoi) {
    const paper = await lookupEpistemePaperByDoi(normalizedDoi, signal);
    if (paper && paperMatchesYearFilter(paper.year, params.year)) {
      return {
        papers: [paper],
        total: 1,
        totalMode: "exact",
        paging: {
          limit: 1,
          offset: 0,
          returned: 1,
          total: 1,
          totalMode: "exact",
          hasMore: false,
          nextOffset: null,
        },
        source: paper.source ? { ...paper.source } : null,
        queryClauses: [],
        clauseStats: [],
        exactLookup: { kind: "doi", value: normalizedDoi },
      };
    }
  }
  const fallbackQuery = normalizedDoi ?? params.query;

  const { queryClauses, effectiveClauses } = resolveFetchClauses({
    query: fallbackQuery,
    offset: params.offset,
  });

  if (effectiveClauses.length === 0) {
    return {
      papers: [],
      total: 0,
      totalMode: "not_computed",
      queryClauses: [],
      clauseStats: [],
    };
  }

  if (effectiveClauses.length === 1) {
    const result = await fetchEpistemeSingleQuery(
      {
        ...params,
        query: effectiveClauses[0],
      },
      signal,
    );
    return {
      ...result,
      totalMode: result.totalMode ?? "exact",
      queryClauses,
      clauseStats: [],
    };
  }

  const result = await fetchEpistemeMultiQuery({
    limit: params.limit,
    year: params.year,
    sort: params.sort,
    hydrate: params.hydrate,
    signal,
    queryClauses,
    effectiveClauses,
  });
  return {
    ...result,
  };
}

export async function lookupPaperCandidatesByTitle(
  title: string,
  limit: number,
  signal?: AbortSignal,
): Promise<PaperLookupResult> {
  const result = await fetchEpistemeSingleQuery(
    {
      query: title,
      limit: Math.max(limit * 3, limit),
      offset: 0,
      sort: "relevance",
    },
    signal,
  );

  const matches = result.papers
    .map((paper) => {
      const priority = getLookupPriority(title, paper.title);
      return {
        ...paper,
        id: paper.paperId,
        exactTitleMatch: priority === 0,
        _priority: priority,
      };
    })
    .sort((left, right) => {
      if (left._priority !== right._priority) {
        return left._priority - right._priority;
      }
      if (left.citationCount !== right.citationCount) {
        return right.citationCount - left.citationCount;
      }
      return (right.year ?? -Infinity) - (left.year ?? -Infinity);
    })
    .slice(0, limit)
    .map((paper) => {
      const { _priority, ...candidate } = paper;
      void _priority;
      return candidate;
    });

  return {
    query: title,
    total: matches.length,
    matches,
  };
}

/**
 * 라이브러리 grounding 입력: 컨텍스트(`context`), 사용 가능 여부(`available`),
 * 이번 검색 결과(`outcome`)를 한 묶음으로 전달한다.
 */
export interface LibraryGroundingInput {
  context?: SearchMetadata["libraryContext"];
  available?: boolean;
  outcome?: SearchMetadata["libraryGrounding"];
}

/**
 * MappedPaper[] → CreateResearchRoutePayloadParams 변환 (저장하지 않음).
 * domain-access에서 저장을 수행한다.
 */
export function buildSearchViewPayload(
  ownerPrincipalId: string,
  query: string,
  mappedPapers: MappedPaper[],
  total: number,
  createdBy: "user" | "agent",
  queryClauses?: SearchQueryClause[],
  totalMode?: SearchMetadata["totalMode"],
  clauseStats?: SearchQueryClauseStat[],
  userId?: string,
  reviewedMap?: Map<string, Date>,
  seedPaper?: PaperCore,
  termSeed?: SearchMetadata["termSeed"],
  spellingCorrection?: SearchMetadata["spellingCorrection"],
  sortOption?: SearchMetadata["sortOption"],
  yearFilter?: string,
  facetFilters?: SearchMetadata["facetFilters"],
  exactLookup?: SearchMetadata["exactLookup"],
  paging?: SearchMetadata["paging"],
  source?: SearchMetadata["source"],
  libraryGrounding?: LibraryGroundingInput,
  abstractHydration?: SearchMetadata["abstractHydration"],
): CreateResearchRoutePayloadParams {
  const filteredPapers = seedPaper
    ? mappedPapers.filter((paper) => !matchesEpistemePaperIdentity(paper, seedPaper.paperId))
    : mappedPapers;
  const removedCount = mappedPapers.length - filteredPapers.length;
  const adjustedTotal = Math.max(filteredPapers.length, total - removedCount);
  const doc = buildSearchResultsView(
    filteredPapers,
    t("search.label.search-service.3", { query }),
    "search",
  );

  const reviewed = reviewedMap ?? new Map<string, Date>();

  const metadata: SearchMetadata = {
    type: "search",
    query,
    sortOption: sortOption ?? "relevance",
    ...(yearFilter ? { yearFilter } : {}),
    ...(facetFilters ? { facetFilters } : {}),
    ...(spellingCorrection ? { spellingCorrection } : {}),
    ...(exactLookup ? { exactLookup } : {}),
    ...(seedPaper ? { seedPaper } : {}),
    ...(termSeed ? { termSeed } : {}),
    ...(queryClauses && queryClauses.length > 0 ? { queryClauses } : {}),
    papers: filteredPapers.map((paper) =>
      buildDocumentPaper(paper, getReviewedAtForEpistemePaper(paper, reviewed)),
    ),
    total: adjustedTotal,
    ...(totalMode ? { totalMode } : {}),
    ...(paging ? { paging: { ...paging, returned: filteredPapers.length } } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(clauseStats && clauseStats.length > 0 ? { clauseStats } : {}),
    ...(libraryGrounding?.context ? { libraryContext: libraryGrounding.context } : {}),
    ...(libraryGrounding?.available ? { libraryContextAvailable: true } : {}),
    ...(libraryGrounding?.outcome ? { libraryGrounding: libraryGrounding.outcome } : {}),
  };
  // 연구 용어 추출은 검색 응답을 막지 않는다. 여기서는 pending으로만 커밋하고,
  // 실제 LLM 추출은 background task가 POST /api/search/term-discovery로 닫는다.
  metadata.englishTermDiscovery = { status: "pending" };

  // Progressive hydration: when committed from the lightweight E3 search projection,
  // mark pending so a background task fills abstracts/authors/PDF without changing
  // the single result pool's membership or order. Absent on fully-hydrated commits
  // (DOI exact-lookup).
  if (abstractHydration) {
    metadata.abstractHydration = abstractHydration;
  }

  return {
    ownerPrincipalId,
    type: "search",
    title: doc.title,
    content: doc.content,
    createdBy,
    metadata,
  };
}

/**
 * Episteme Paper Batch API로 corpus_id 목록에 대한 메타데이터를 가져온다.
 * 최대 CITATION_LINEAGE_MAX_PAPERS편, citationCount desc 정렬.
 */
export async function lookupPapersByIds(
  ids: string[],
  signal?: AbortSignal,
): Promise<MappedPaper[]> {
  if (ids.length === 0) return [];

  const corpusIds = ids.filter((id) => /^\d+$/.test(id) || /^pap_/i.test(id)).slice(0, 50);
  if (corpusIds.length === 0) return [];

  const papers = (await hydrateEpistemePapers(corpusIds, signal))
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, CITATION_LINEAGE_MAX_PAPERS);

  return papers;
}

/**
 * 인용 계보 view payload를 만든다.
 * type: "citation_lineage", seedPaper 필수.
 */
export interface GraphNeighborPayloadInput {
  coCited: Array<{ paper: MappedPaper; shared: number }>;
  coupled: Array<{ paper: MappedPaper; shared: number }>;
  coCitedAvailability?: PaperCore["citationAvailability"];
  coupledAvailability?: PaperCore["citationAvailability"];
}

/**
 * `lookupGraphNeighborsForPaper` 결과를 문서 payload 입력으로 변환한다.
 * coCited/coupled 축의 {paperId, shared} 항목을 byId 맵으로 실제 paper에 매핑하고,
 * 매핑된 paper가 있는 항목만 남긴다. graph_neighbors route가 이 입력을 소유한다.
 */
export function buildGraphNeighborPayloadFromLookup(gn: {
  papers: MappedPaper[];
  coCited: Array<{ paperId: string; shared: number }>;
  coupled: Array<{ paperId: string; shared: number }>;
  coCitedAvailability?: PaperCore["citationAvailability"];
  coupledAvailability?: PaperCore["citationAvailability"];
}): { graphNeighbors: GraphNeighborPayloadInput; graphNeighborPapers: MappedPaper[] } {
  const byId = new Map(gn.papers.map((paper) => [paper.paperId, paper] as const));
  const toEntries = (axis: Array<{ paperId: string; shared: number }>) =>
    axis
      .map((entry) => {
        const paper = byId.get(entry.paperId);
        return paper ? { paper, shared: entry.shared } : null;
      })
      .filter((entry): entry is { paper: MappedPaper; shared: number } => entry !== null);
  return {
    graphNeighbors: {
      coCited: toEntries(gn.coCited),
      coupled: toEntries(gn.coupled),
      coCitedAvailability: gn.coCitedAvailability,
      coupledAvailability: gn.coupledAvailability,
    },
    graphNeighborPapers: gn.papers,
  };
}

export function buildCitationLineageViewPayload(
  ownerPrincipalId: string,
  seedPaper: PaperCore,
  mappedPapers: MappedPaper[],
  reviewedMap: Map<string, Date> | undefined,
  referenceIds: string[],
  citationIds: string[],
  availability?: {
    referenceAvailability?: PaperCore["referenceAvailability"];
    citationAvailability?: PaperCore["citationAvailability"];
  },
): Extract<CreateResearchRoutePayloadParams, { type: "citation_lineage" }> {
  const sourceLabel = t("search.label.search-service.citationLineage", { title: seedPaper.title });
  const doc = buildSearchResultsView(mappedPapers, sourceLabel, "citation_lineage");

  const reviewed = reviewedMap ?? new Map<string, Date>();
  const metadata: CitationLineageMetadata = {
    type: "citation_lineage",
    seedPaper,
    referenceIds,
    citationIds,
    papers: mappedPapers.map((paper) =>
      buildDocumentPaper(paper, getReviewedAtForEpistemePaper(paper, reviewed)),
    ),
    total: mappedPapers.length,
    referenceAvailability: availability?.referenceAvailability ?? null,
    citationAvailability: availability?.citationAvailability ?? null,
  };

  return {
    ownerPrincipalId,
    type: "citation_lineage",
    title: doc.title,
    content: doc.content,
    createdBy: "user",
    metadata,
  };
}

/**
 * 그래프 인접 문서 payload를 만든다.
 * type: "graph_neighbors", seedPaper 필수. citation_lineage와 달리 직접 인용 축은
 * 두지 않고 그래프 관계(co-cited / coupled) 두 축만 노출한다.
 */
export function buildGraphNeighborsViewPayload(
  ownerPrincipalId: string,
  seedPaper: PaperCore,
  mappedPapers: MappedPaper[],
  reviewedMap: Map<string, Date> | undefined,
  graphNeighbors: GraphNeighborPayloadInput,
  graphLoadFailed?: boolean,
  options?: {
    cardDataHydration?: GraphNeighborsMetadata["cardDataHydration"];
  },
): Extract<CreateResearchRoutePayloadParams, { type: "graph_neighbors" }> {
  const sourceLabel = t("search.label.search-service.graphNeighbors", { title: seedPaper.title });
  const doc = buildSearchResultsView(mappedPapers, sourceLabel, "graph_neighbors");

  const reviewed = reviewedMap ?? new Map<string, Date>();
  const toNeighborEntry = (entry: { paper: MappedPaper; shared: number }) => ({
    shared: entry.shared,
    paper: buildDocumentPaper(entry.paper, getReviewedAtForEpistemePaper(entry.paper, reviewed)),
  });

  const metadata: GraphNeighborsMetadata = {
    type: "graph_neighbors",
    seedPaper,
    papers: mappedPapers.map((paper) =>
      buildDocumentPaper(paper, getReviewedAtForEpistemePaper(paper, reviewed)),
    ),
    total: mappedPapers.length,
    coCited: graphNeighbors.coCited.map(toNeighborEntry),
    coupled: graphNeighbors.coupled.map(toNeighborEntry),
    coCitedAvailability: graphNeighbors.coCitedAvailability ?? null,
    coupledAvailability: graphNeighbors.coupledAvailability ?? null,
    ...(graphLoadFailed ? { graphLoadFailed: true } : {}),
    ...(options?.cardDataHydration ? { cardDataHydration: options.cardDataHydration } : {}),
  };

  return {
    ownerPrincipalId,
    type: "graph_neighbors",
    title: doc.title,
    content: doc.content,
    createdBy: "user",
    metadata,
  };
}
