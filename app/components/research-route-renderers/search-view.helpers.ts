import type { PaperCore } from "@/app/domain/paper";
import type { InlineAnalysisCache, SearchMetadata } from "@/app/domain/research-route-payload";

import { t } from "@/app/i18n/message-access";
import type { AnalysisProgressState } from "@/app/lib/inline-analysis";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import { type SearchFacetFilters } from "@/app/domain/search-facets";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";

export interface SearchFollowupSeedOptions {
  termSeed?: SearchMetadata["termSeed"];
  entry?: "term" | "position";
}

export interface FollowupActivationEvent {
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  button?: number;
}

export type SearchTermFollowupHandler = (
  term: string,
  seeds?: SearchFollowupSeedOptions,
  event?: FollowupActivationEvent,
) => void;

export interface GapNetworkOpenOptions {
  papers?: SearchMetadata["papers"];
}

export interface SearchViewResultHandlers {
  onQueryChange: (value: string) => void;
  onSortChange: (value: SearchSortOption) => void;
  onYearRangeApply: (value: string) => void;
  onOpenGapNetwork: (event?: FollowupActivationEvent, options?: GapNetworkOpenOptions) => void;
  onOpenCitationLineage: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onSearchTerm?: SearchTermFollowupHandler;
  onEnsurePaperVisible?: (paperIndex: number) => void;
  onLoadMore: () => void;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
}

export interface AnalysisStatusBadgeViewModel {
  label: string;
  className: string;
  showSpinner: boolean;
}

export interface ReviewedPaperPayload {
  paperId: string;
  title: string;
  url: string;
  authors: PaperCore["authors"];
  year: number | null;
  citationCount: number;
}

export interface SearchViewBodyViewModel {
  isEmpty: boolean;
  resultPapers: SearchMetadata["papers"];
  visiblePapers: SearchMetadata["papers"];
  resultCount: number;
  hasMorePapers: boolean;
  analyzedCount: number;
  runningCount: number;
  queuedCount: number;
  isAnalyzing: boolean;
}

export interface SearchResultBasisBadgeViewModel {
  label: string;
}

export function createReviewedIdSet(papers: SearchMetadata["papers"]): Set<string> {
  const ids = new Set<string>();

  for (const paper of papers) {
    if ("reviewed" in paper && paper.reviewed) {
      ids.add(paper.paperId);
    }
  }

  return ids;
}

export function buildSearchViewBodyViewModel(params: {
  metadata: SearchMetadata;
  visibleCount: number;
  sortOption?: SearchSortOption;
  yearFilter?: string;
  facetFilters?: SearchFacetFilters;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
}): SearchViewBodyViewModel {
  const progress = summarizeAnalysisProgress(params.analysisProgressMap);
  const sortedPapers = buildSearchResultPapers(params);

  return {
    isEmpty: params.metadata.papers.length === 0 && !params.metadata.query,
    resultPapers: sortedPapers,
    visiblePapers: sortedPapers.slice(0, params.visibleCount),
    resultCount: sortedPapers.length,
    hasMorePapers: params.visibleCount < sortedPapers.length,
    ...progress,
  };
}

export function buildSearchResultBasisBadge(params: {
  metadata: SearchMetadata;
  paper: SearchMetadata["papers"][number];
  /** Legacy call-site compatibility. Current badge meaning never depends on a user preference. */
  personalize?: boolean;
}): SearchResultBasisBadgeViewModel | null {
  if (params.metadata.exactLookup) {
    return null;
  }

  const libraryContext = params.metadata.libraryContext;
  const librarySignalActive = libraryContext?.signalPresent === true;
  const interestWeight = libraryContext?.interestWeights[params.paper.paperId];
  const hasLibraryProximity =
    librarySignalActive && typeof interestWeight === "number" && interestWeight > 0;

  return hasLibraryProximity
    ? { label: t("search.label.search-result-item.myResearchProximity") }
    : null;
}

export function formatSearchCompletionLabel(metadata: SearchMetadata): string {
  const fetchedCount = metadata.papers.length;
  const isMerged = metadata.totalMode === "merged" || (metadata.queryClauses?.length ?? 0) > 1;
  return isMerged
    ? t("search.label.search-view-helpers", { count: fetchedCount })
    : t("search.label.search-view-helpers.2", { value: fetchedCount });
}

export function getNextVisibleSearchResultCount(
  currentVisibleCount: number,
  totalPaperCount: number,
  pageSize = 10,
): number {
  return Math.min(currentVisibleCount + pageSize, totalPaperCount);
}

export function toggleReviewedPaperIds(
  reviewedIds: ReadonlySet<string>,
  paperId: string,
): Set<string> {
  const next = new Set(reviewedIds);
  if (next.has(paperId)) {
    next.delete(paperId);
    return next;
  }

  next.add(paperId);
  return next;
}

export function buildReviewedPaperPayload(paper: PaperCore): ReviewedPaperPayload {
  return {
    paperId: paper.paperId,
    title: paper.title,
    url: paper.url,
    authors: paper.authors,
    year: paper.year,
    citationCount: paper.citationCount,
  };
}

export function formatPaperAuthors(authors: PaperCore["authors"], visibleLimit = 3): string {
  if (authors.length === 0) return "";

  const visibleAuthors = authors
    .slice(0, visibleLimit)
    .map((author) => author.name)
    .join(", ");

  return authors.length > visibleLimit
    ? t("search.label.search-view-helpers.6", {
        authors: visibleAuthors,
        count: authors.length - visibleLimit,
      })
    : visibleAuthors;
}

export function hasDirectPdfUrl(paper: Pick<PaperCore, "openAccessPdf">): boolean {
  const pdfUrl = paper.openAccessPdf?.url;
  return typeof pdfUrl === "string" && pdfUrl.trim().length > 0;
}

export function getDirectPdfUrl(paper: Pick<PaperCore, "openAccessPdf">): string | null {
  const pdfUrl = paper.openAccessPdf?.url.trim();
  return pdfUrl ? pdfUrl : null;
}

export function buildMoonlightFileUrl(originalUrl: string | null | undefined): string | null {
  const trimmedUrl = originalUrl?.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return null;
    }
  } catch {
    return null;
  }

  return `https://themoonlight.io/file?url=${encodeURIComponent(trimmedUrl)}`;
}

// Episteme paper 페이지의 공개 base. 서버가 paper.url을 항상 채우므로 이 fallback은
// url이 없는 non-corpus/edge 논문에서만 쓰인다. 서버 fallback과 같은 공개 설정을 쓴다.
const EPISTEME_PUBLIC_BASE = (
  process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE ?? "https://sah.borca.ai"
).replace(/\/+$/, "");

/**
 * 논문 카드 inspection의 원문 링크 destination. 서버가 만든 `paper.url`(open access
 * landing → DOI → arXiv → Episteme paper URL 체인)을 우선 사용하고, url이 없는
 * 논문은 corpus_id로 Episteme paper 페이지를 구성한다. Semantic Scholar 페이지 대신
 * 이 destination 체인을 사용한다.
 * @promise promise:search-results-fast-window
 * @check acceptance-check:search-results-fast-window-card-inspection
 */
export function buildPaperExternalUrl(paperId: string, paperUrl?: string | null): string {
  const trimmedPaperUrl = paperUrl?.trim();
  if (trimmedPaperUrl) {
    try {
      const parsedPaperUrl = new URL(trimmedPaperUrl);
      if (parsedPaperUrl.protocol === "https:" || parsedPaperUrl.protocol === "http:") {
        return trimmedPaperUrl;
      }
    } catch {
      // Fall through to the corpus-id-derived Episteme paper URL.
    }
  }

  const trimmedPaperId = paperId.trim();
  if (!trimmedPaperId) {
    return EPISTEME_PUBLIC_BASE;
  }
  return `${EPISTEME_PUBLIC_BASE}/papers/${encodeURIComponent(trimmedPaperId)}`;
}

export function getAnalysisStatusBadge(state: AnalysisProgressState): AnalysisStatusBadgeViewModel {
  switch (state) {
    case "queued":
      return {
        label: t("search.label.search-view-helpers.7"),
        className: "lh-chip",
        showSpinner: false,
      };
    case "running":
      return {
        label: t("search.label.search-view-helpers.8"),
        className: "lh-chip lh-chip-accent",
        showSpinner: true,
      };
    case "done":
      return {
        label: t("search.label.search-view-helpers.9"),
        className: "lh-chip text-success",
        showSpinner: false,
      };
    case "error":
      return {
        label: t("search.error.search-view-helpers.5"),
        className: "lh-chip lh-chip-accent text-error",
        showSpinner: false,
      };
  }
}

export function truncateLabel(text: string, maxLength = 60): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * promise:similar-papers-discovery AC2/AC5: 유사 논문 검색 쿼리 구성.
 * 인라인 분석이 있으면 제목 앞 5단어 + topics 상위 3개를 결합하고,
 * 없으면 제목 그대로 반환한다.
 */
export function buildSimilarPaperQuery(
  paper: PaperCore,
  inlineAnalysis?: InlineAnalysisCache,
): string {
  if (!inlineAnalysis) {
    return paper.title;
  }

  const titleWords = paper.title.split(/\s+/).slice(0, 5).join(" ");
  const topics = inlineAnalysis.analysis.semanticProfile.topics.slice(0, 3);

  if (topics.length === 0) {
    return paper.title;
  }

  return [titleWords, ...topics].join(", ");
}

export function summarizeAnalysisProgress(
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>,
): {
  analyzedCount: number;
  runningCount: number;
  queuedCount: number;
  isAnalyzing: boolean;
} {
  let analyzedCount = 0;
  let runningCount = 0;
  let queuedCount = 0;

  for (const state of analysisProgressMap.values()) {
    if (state === "done") analyzedCount += 1;
    else if (state === "running") runningCount += 1;
    else if (state === "queued") queuedCount += 1;
  }

  return {
    analyzedCount,
    runningCount,
    queuedCount,
    isAnalyzing: runningCount > 0 || queuedCount > 0,
  };
}
