"use client";

// @promise promise:search-results-fast-window
// @promise promise:search-failure-degraded-at-url
// @promise promise:search-empty-results-next-action
// @promise promise:search-results-suggest-english-terms
// @promise promise:gap-network-detection-from-search
// @promise promise:inline-analysis-auto-run
// @promise promise:research-route-cap-feedback
// @promise promise:search-query-route-transition
// @aspect aspect:user-facing-language-governance
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:paper-card-list-windowing
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:paper-card-action-loading-feedback
// @aspect aspect:search-first-url-model
// @aspect aspect:library-grounded-research
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-loading-visible
// @check acceptance-check:search-results-fast-window-year-distribution
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-post-search-layout-about
// @aspect aspect:document-content-width-governance
// @check acceptance-check:search-results-fast-window-doi-exact-lookup
// @check acceptance-check:search-results-fast-window-publication-year-range-filter
// @check acceptance-check:search-empty-results-next-action-distinct-state
// @check acceptance-check:search-results-fast-window-representative-filter
// @check acceptance-check:search-results-fast-window-personalization-opt-out
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set
// @check acceptance-check:inline-analysis-auto-run-exposed-card-start
// @check acceptance-check:inline-analysis-auto-run-visible-first-priority
// @check acceptance-check:search-results-suggest-english-terms-result-basis
// @check acceptance-check:search-results-suggest-english-terms-prefilled-search
// @check acceptance-check:search-results-suggest-english-terms-term-seed-preserved
// @check acceptance-check:research-route-cap-feedback-route-search-visible
// @check acceptance-check:search-query-route-transition-immediate-submit

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import {
  buildSearchFacetFilterKey,
  hasActiveSearchFacetFilters,
  normalizeSearchFacetFilters,
  type SearchFacetFilters,
} from "@/app/domain/search-facets";
import { normalizeYearRangeFilter } from "@/app/domain/search-year-range";
import { t } from "@/app/i18n/message-access";
import { buildQueryAnalyticsMetadata } from "@/app/lib/analytics/query-hash";
import { track } from "@/app/lib/track";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";
import {
  buildSearchResultBasisBadge,
  type FollowupActivationEvent,
  type SearchResultBasisBadgeViewModel,
  type SearchViewResultHandlers,
} from "./search-view.helpers";
import type { AnalysisProgressState, AnalysisResult } from "@/app/lib/inline-analysis";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import { SearchResultItem } from "./search-result-item";
import type { SearchResultCardAnalyticsContext } from "./search-result-analytics";
import { SearchResultsHeader } from "./search-results-header";
import {
  buildSearchResultsOverviewBlockFromMetadata,
  type SearchResultsOverviewTerm,
} from "@/app/components/research/search-results-overview-model";
import { selectRepresentativePapers } from "@/app/components/research/followup-reaction";
import { SearchResultsContentRail } from "./search-results-content-rail";
import { commitSearchResultsOverviewTerm } from "./search-results-overview-actions";
import { useSearchSpellingCorrectionRequest } from "./use-search-spelling-correction-request";
import type { SearchJourneyAnalyticsContext } from "@/app/components/research/search-followup-activation";
export { __resetSpellingCorrectionRequestTrackingForTests } from "./use-search-spelling-correction-request";
export {
  SearchViewEmptyState,
  SearchViewFailedState,
  SearchViewProcessingState,
} from "./search-view-states";

function buildYearRangeInputFromFilter(yearFilter: string): { from: string; to: string } {
  const normalized = normalizeYearRangeFilter(yearFilter);
  if (!normalized) return { from: "", to: "" };
  if (!normalized.includes("-")) {
    return { from: normalized, to: normalized };
  }
  const dashIndex = normalized.indexOf("-");
  return {
    from: normalized.slice(0, dashIndex),
    to: normalized.slice(dashIndex + 1),
  };
}

function normalizeYearRangeInputs(value: { from: string; to: string }): string {
  const from = value.from.trim();
  const to = value.to.trim();
  const candidate = from && to ? `${from}-${to}` : from ? `${from}-` : to ? `-${to}` : "";
  return normalizeYearRangeFilter(candidate) ?? candidate;
}

interface SearchResultCardViewModel {
  paper: SearchMetadata["papers"][number];
  analyticsContext: SearchResultCardAnalyticsContext;
  basisBadge: SearchResultBasisBadgeViewModel | null;
}

function buildSearchResultCardViewModels(params: {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  analyticsContext?: SearchJourneyAnalyticsContext;
  effectiveResultCount: number;
  metadata: SearchMetadata;
  queryHash: string;
  representativeVisiblePapers: SearchMetadata["papers"];
  sortOption: SearchSortOption;
  yearFilter: string;
}): SearchResultCardViewModel[] {
  return params.representativeVisiblePapers.map((paper, index) => ({
    paper,
    analyticsContext: {
      ownerPrincipalId: params.ownerPrincipalId,
      documentId: params.sourceSnapshotId,
      journeyContextId: params.analyticsContext?.journeyContextId ?? params.sourceSnapshotId,
      searchContextId: params.analyticsContext?.searchContextId ?? params.sourceSnapshotId,
      resultRank: index + 1,
      rankBucket: buildRankBucket(index + 1),
      totalResultCount: params.effectiveResultCount,
      visibleResultCount: params.representativeVisiblePapers.length,
      queryHash: params.queryHash,
      sort: params.sortOption,
      ...(params.yearFilter ? { yearFilter: params.yearFilter } : {}),
      sourceSurface: "search_results",
    },
    basisBadge: buildSearchResultBasisBadge({
      metadata: params.metadata,
      paper,
    }),
  }));
}

function buildRankBucket(resultRank: number): SearchResultCardAnalyticsContext["rankBucket"] {
  if (resultRank <= 3) return "top_3";
  if (resultRank <= 10) return "top_10";
  return "below_10";
}

function getRouteCommitFacetFilters(
  facetFilters: SearchFacetFilters,
): SearchFacetFilters | undefined {
  return hasActiveSearchFacetFilters(facetFilters) ? facetFilters : undefined;
}

function isReviewedSearchPaper(paper: PaperCore): boolean {
  return "reviewed" in paper && paper.reviewed === true;
}

interface SearchViewResultsStateProps extends SearchViewResultHandlers {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  analyticsContext?: SearchJourneyAnalyticsContext;
  documentTitle: string;
  metadata: SearchMetadata;
  query: string;
  sortOption: SearchSortOption;
  facetFilters?: SearchFacetFilters;
  /** Legacy render-fixture input; ignored by the unified result projection. */
  personalize?: boolean;
  /** Legacy render-fixture input; availability is represented by metadata. */
  libraryContextAvailable?: boolean;
  /** Legacy render-fixture callback; the unified projection never calls it. */
  onPersonalizeChange?: (value: boolean) => void;
  yearFilter: string;
  isSearching: boolean;
  isError: boolean;
  analyzedCount: number;
  runningCount: number;
  queuedCount: number;
  isAnalyzing: boolean;
  isCreatingGapNetwork: boolean;
  visiblePapers: SearchMetadata["papers"];
  reviewedIds?: ReadonlySet<string>;
  pendingReviewedPaperIds?: ReadonlySet<string>;
  resultCount?: number;
  hasMorePapers: boolean;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  onPaperExposed?: (paperId: string) => void;
  onToggleLibraryPaper?: (paper: PaperCore, context?: SearchResultCardAnalyticsContext) => void;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onRouteSearchCommit?: (params: RouteSearchCommitParams) => void;
  onViewFilterReplace?: (params: RouteSearchCommitParams) => void;
  graphNeighborsLoadingPaperId?: string | null;
  reactionSlot?: ReactNode;
}

function ExposedSearchResultItem({
  onPaperExposed,
  paperId,
  children,
}: {
  onPaperExposed?: (paperId: string) => void;
  paperId: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const exposedRef = useRef(false);

  useEffect(() => {
    if (!onPaperExposed || exposedRef.current) return;
    const element = ref.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      exposedRef.current = true;
      onPaperExposed(paperId);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (exposedRef.current || !entries.some((entry) => entry.isIntersecting)) return;
      exposedRef.current = true;
      onPaperExposed(paperId);
      observer.disconnect();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [onPaperExposed, paperId]);

  return <div ref={ref}>{children}</div>;
}

interface RouteSearchCommitParams {
  q: string;
  sort: SearchSortOption;
  year: string;
  facetFilters?: Partial<SearchFacetFilters>;
}

function useSearchConditionCommitHandlers(params: {
  query: string;
  sortOption: SearchSortOption;
  facetFilters: SearchFacetFilters;
  yearFilter: string;
  isSearching: boolean;
  yearRangeInputs: { from: string; to: string };
  setLastSyncedYearFilter: (value: string) => void;
  onRouteSearchCommit?: (commitParams: RouteSearchCommitParams) => void;
  onViewFilterReplace?: (commitParams: RouteSearchCommitParams) => void;
  onYearRangeApply: (value: string) => void;
  onSortChange: (value: SearchSortOption) => void;
}) {
  const commitRouteSearch = (commitParams: RouteSearchCommitParams): boolean => {
    if (!params.onRouteSearchCommit) return false;
    params.onRouteSearchCommit(commitParams);
    return true;
  };
  const handleSearchSubmit = () => {
    if (params.isSearching) return;
    const nextQuery = params.query;
    if (nextQuery.trim().length === 0) return;
    const nextFilter = normalizeYearRangeInputs(params.yearRangeInputs);
    if (
      commitRouteSearch({
        q: nextQuery,
        sort: params.sortOption,
        year: nextFilter,
        facetFilters: getRouteCommitFacetFilters(params.facetFilters),
      })
    ) {
      return;
    }
    if (nextFilter !== params.yearFilter) {
      params.setLastSyncedYearFilter(nextFilter);
      params.onYearRangeApply(nextFilter);
    }
  };

  const handleSortSelect = (nextSortOption: SearchSortOption) => {
    const nextFilter = normalizeYearRangeInputs(params.yearRangeInputs);
    if (
      commitRouteSearch({
        q: params.query,
        sort: nextSortOption,
        year: nextFilter,
        facetFilters: getRouteCommitFacetFilters(params.facetFilters),
      })
    ) {
      return;
    }
    params.onSortChange(nextSortOption);
  };

  return { handleSearchSubmit, handleSortSelect };
}

export function patchActiveSearchFacetFilters(params: {
  activeExecutionId: string | null;
  facetFilters: SearchFacetFilters;
  sourceSnapshotId: string;
  patchCurrentView: ReturnType<typeof useResearchRouteStore.getState>["patchCurrentView"];
}): void {
  if (!params.activeExecutionId) return;
  const currentView = useResearchRouteStore.getState().currentView;
  if (currentView?.id !== params.sourceSnapshotId || currentView.type !== "search") return;
  params.patchCurrentView(
    {
      ...currentView,
      metadata: { ...currentView.metadata, facetFilters: params.facetFilters },
      updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, new Date().toISOString()),
    },
    params.activeExecutionId,
  );
}

export function SearchViewResultsState(props: SearchViewResultsStateProps) {
  const {
    ownerPrincipalId,
    sourceSnapshotId,
    analyticsContext,
    metadata,
    query,
    sortOption,
    facetFilters,
    yearFilter,
    isSearching,
    isError,
    analyzedCount,
    runningCount,
    queuedCount,
    isAnalyzing,
    isCreatingGapNetwork,
    visiblePapers,
    reviewedIds,
    pendingReviewedPaperIds,
    resultCount,
    hasMorePapers,
    analysisProgressMap,
    analysisMap,
    onPaperExposed,
    onToggleLibraryPaper,
    graphNeighborsLoadingPaperId,
    onSortChange,
    onYearRangeApply,
    onOpenCitationLineage,
    onOpenGapNetwork,
    onOpenGraphNeighbors,
    onRouteSearchCommit,
    onViewFilterReplace,
    onFindSimilar,
    onSearchTerm,
    onEnsurePaperVisible = () => undefined,
    onLoadMore,
    citationLineageLoadingPaperId,
    reactionSlot,
  } = props;
  const [highlightedPaperId, setHighlightedPaperId] = useState<string | null>(null);
  const [showRepresentativeOnly, setShowRepresentativeOnly] = useState(false);
  const effectiveResultCount = resultCount ?? metadata.papers.length;
  const normalizedFacetFilters = useMemo(
    () => normalizeSearchFacetFilters(facetFilters),
    [facetFilters],
  );
  const isHydratingSearchDetails = metadata.abstractHydration?.status === "pending";
  const patchCurrentView = useResearchRouteStore((state) => state.patchCurrentView);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const [yearRangeInputs, setYearRangeInputs] = useState(() =>
    buildYearRangeInputFromFilter(yearFilter),
  );
  const [lastSyncedYearFilter, setLastSyncedYearFilter] = useState(yearFilter);
  const inlineAnalysisTotal = analyzedCount + runningCount + queuedCount;
  const showInlineAnalysisStatus = isAnalyzing && inlineAnalysisTotal > 0;
  const overviewBlock = useMemo(
    () => buildSearchResultsOverviewBlockFromMetadata(metadata),
    [metadata],
  );
  const representativePaperIds = useMemo(
    () => new Set(selectRepresentativePapers(metadata).map((paper) => paper.paperId)),
    [metadata],
  );
  const visibleRepresentativeCount = useMemo(
    () => visiblePapers.filter((paper) => representativePaperIds.has(paper.paperId)).length,
    [representativePaperIds, visiblePapers],
  );
  const representativeVisiblePapers = useMemo(
    () =>
      showRepresentativeOnly
        ? visiblePapers.filter((paper) => representativePaperIds.has(paper.paperId))
        : visiblePapers,
    [representativePaperIds, showRepresentativeOnly, visiblePapers],
  );
  const gapNetworkSourcePapers = useMemo(
    () =>
      buildSearchResultPapers({
        metadata,
        sortOption,
        yearFilter,
        facetFilters: normalizedFacetFilters,
      }),
    [metadata, normalizedFacetFilters, sortOption, yearFilter],
  );
  const canOpenGapNetwork = gapNetworkSourcePapers.length > 0;
  const resultCardViewModels = useMemo(
    () =>
      buildSearchResultCardViewModels({
        ownerPrincipalId,
        sourceSnapshotId,
        analyticsContext,
        effectiveResultCount,
        metadata,
        queryHash: buildQueryAnalyticsMetadata(metadata.query).queryHash,
        representativeVisiblePapers,
        sortOption,
        yearFilter,
      }),
    [
      ownerPrincipalId,
      analyticsContext,
      effectiveResultCount,
      metadata,
      representativeVisiblePapers,
      sortOption,
      sourceSnapshotId,
      yearFilter,
    ],
  );
  if (lastSyncedYearFilter !== yearFilter) {
    setLastSyncedYearFilter(yearFilter);
    setYearRangeInputs(buildYearRangeInputFromFilter(yearFilter));
  }
  const { handleSearchSubmit, handleSortSelect } = useSearchConditionCommitHandlers({
    query,
    sortOption,
    facetFilters: normalizedFacetFilters,
    yearFilter,
    isSearching,
    yearRangeInputs,
    setLastSyncedYearFilter,
    onRouteSearchCommit,
    onViewFilterReplace,
    onYearRangeApply,
    onSortChange,
  });
  const commitFacetFilters = (nextFilters: SearchFacetFilters) => {
    const normalizedNextFilters = normalizeSearchFacetFilters(nextFilters);
    if (
      buildSearchFacetFilterKey(normalizedNextFilters) ===
      buildSearchFacetFilterKey(metadata.facetFilters)
    ) {
      return;
    }
    patchActiveSearchFacetFilters({
      activeExecutionId,
      facetFilters: normalizedNextFilters,
      sourceSnapshotId,
      patchCurrentView,
    });
    onViewFilterReplace?.({
      q: query,
      sort: sortOption,
      year: yearFilter,
      facetFilters: getRouteCommitFacetFilters(normalizedNextFilters),
    });
  };
  const toggleFacetValue = (key: "fieldsOfStudy" | "authors" | "venues", value: string) => {
    const current = normalizedFacetFilters[key];
    commitFacetFilters({
      ...normalizedFacetFilters,
      [key]: current.includes(value)
        ? current.filter((entry) => entry !== value)
        : [...current, value],
    });
  };
  const setHasPdfFacet = (hasPdf: boolean) => {
    commitFacetFilters({ ...normalizedFacetFilters, hasPdf });
  };
  const handleOverviewSearchTerm = (
    candidate: SearchResultsOverviewTerm,
    event?: FollowupActivationEvent,
  ) => {
    commitSearchResultsOverviewTerm({
      candidate,
      ownerPrincipalId,
      documentId: sourceSnapshotId,
      query: metadata.query,
      candidateSource: metadata.englishTermDiscovery?.source,
      sourceResearchRouteKind: "search",
      onSearchTerm,
      event,
    });
  };
  // Applying the corrected query commits through the route-owned `/search?q=`
  // execution model the main search bar uses, so the top route input and URL
  // reflect the corrected query and browser history (not an in-app restore) owns
  // the return path.
  // @check acceptance-check:search-spelling-correction-corrected-apply-route-owned
  const handleApplySpellingCorrection = (correctedQuery: string) => {
    const nextQuery = correctedQuery.trim();
    if (!nextQuery || isSearching || !onRouteSearchCommit) return;
    track({
      type: "spelling_correction",
      data: {
        ownerPrincipalId: ownerPrincipalId,
        documentId: sourceSnapshotId,
        query: metadata.query,
        correctedQuery: nextQuery,
      },
    });
    onRouteSearchCommit({
      q: correctedQuery,
      sort: sortOption,
      year: yearFilter,
      facetFilters: getRouteCommitFacetFilters(normalizedFacetFilters),
    });
  };
  useSearchSpellingCorrectionRequest({
    isSearching,
    metadata,
    activeExecutionId,
    patchCurrentView,
    sourceSnapshotId,
  });

  useEffect(() => {
    const handleRevealPaper = (event: Event) => {
      const detail = (event as CustomEvent<{ documentId?: string; paperId?: string }>).detail;
      const { documentId, paperId } = detail;
      if (documentId !== sourceSnapshotId || typeof paperId !== "string" || paperId.length === 0) {
        return;
      }
      const paperIndex = metadata.papers.findIndex((paper) => paper.paperId === paperId);
      if (paperIndex < 0) {
        return;
      }
      onEnsurePaperVisible(paperIndex);
      setHighlightedPaperId(paperId);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const owner = window.document.querySelector<HTMLElement>(
            `[data-doc-id="${sourceSnapshotId}"]`,
          );
          const target = owner?.querySelector<HTMLElement>(`[data-paper-id="${paperId}"]`) ?? null;
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    };
    window.addEventListener("lighthouse:reveal-paper", handleRevealPaper);
    return () => {
      window.removeEventListener("lighthouse:reveal-paper", handleRevealPaper);
    };
  }, [metadata.papers, onEnsurePaperVisible, sourceSnapshotId]);
  useEffect(() => {
    if (!highlightedPaperId) return;
    const timeoutId = window.setTimeout(() => {
      setHighlightedPaperId(null);
    }, 2200);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedPaperId]);

  const resultsColumn = (
    <div className="min-w-0" data-testid="search-results-list-column">
      {isError && (
        <p className="lh-type-metadata text-error mb-4">
          {t("search.error.search-view-content.requestFailed")}
        </p>
      )}
      <SearchResultsHeader
        metadata={metadata}
        sortOption={sortOption}
        facetFilters={normalizedFacetFilters}
        yearFilter={yearFilter}
        resultCount={effectiveResultCount}
        isSearching={isSearching}
        query={query}
        yearRangeInputs={yearRangeInputs}
        onYearRangeInputsChange={setYearRangeInputs}
        onSearchSubmit={handleSearchSubmit}
        onSortSelect={handleSortSelect}
        onToggleFacetValue={toggleFacetValue}
        onToggleHasPdf={setHasPdfFacet}
        showInlineAnalysisStatus={showInlineAnalysisStatus}
        analyzedCount={analyzedCount}
        inlineAnalysisTotal={inlineAnalysisTotal}
        onApplySpellingCorrection={handleApplySpellingCorrection}
        isCreatingGapNetwork={isCreatingGapNetwork}
        representativeCount={visibleRepresentativeCount}
        showRepresentativeOnly={showRepresentativeOnly}
        onToggleRepresentativeOnly={setShowRepresentativeOnly}
        onOpenGapNetwork={
          canOpenGapNetwork
            ? (event) => {
                onOpenGapNetwork(event, { papers: gapNetworkSourcePapers });
              }
            : undefined
        }
        reactionSlot={reactionSlot}
        overviewBlock={overviewBlock}
        onOverviewSearchTerm={handleOverviewSearchTerm}
      />
      <div className="space-y-3">
        {effectiveResultCount === 0 && !isSearching && !isError && (
          <section
            className="border-border-subtle bg-surface-panel rounded-lh-md border px-5 py-6"
            data-testid="search-view-no-results"
            role="status"
          >
            <h2 className="lh-type-section-title text-text-strong">
              {t("search.label.search-view-content.noResults.title")}
            </h2>
            <p className="lh-type-reading-body lh-tone-secondary mt-2">
              {t("search.label.search-view-content.noResults.body")}
            </p>
          </section>
        )}
        {resultCardViewModels.map(({ paper, analyticsContext, basisBadge }, index) => (
          <ExposedSearchResultItem
            key={paper.paperId}
            paperId={paper.paperId}
            onPaperExposed={onPaperExposed}
          >
            <SearchResultItem
              paper={paper}
              isLast={index === resultCardViewModels.length - 1}
              analyticsContext={analyticsContext}
              analysisState={analysisProgressMap.get(paper.paperId)}
              analysisResult={analysisMap.get(paper.paperId)}
              isCitationLineageLoading={citationLineageLoadingPaperId === paper.paperId}
              isGraphNeighborsLoading={graphNeighborsLoadingPaperId === paper.paperId}
              isHighlighted={highlightedPaperId === paper.paperId}
              isHydratingDetails={isHydratingSearchDetails}
              isRepresentative={representativePaperIds.has(paper.paperId)}
              basisBadge={basisBadge}
              isInLibrary={reviewedIds?.has(paper.paperId) ?? isReviewedSearchPaper(paper)}
              isLibraryActionPending={pendingReviewedPaperIds?.has(paper.paperId) ?? false}
              onToggleLibrary={onToggleLibraryPaper}
              onOpenCitationLineage={onOpenCitationLineage}
              onOpenGraphNeighbors={onOpenGraphNeighbors}
              onFindSimilar={onFindSimilar}
              onSearchTerm={onSearchTerm}
            />
          </ExposedSearchResultItem>
        ))}
        {hasMorePapers && !showRepresentativeOnly && (
          <div className="pt-4">
            <button
              type="button"
              onClick={() => {
                onLoadMore();
              }}
              className="lh-control lh-type-control-label border-border-subtle bg-surface-panel rounded-lh-sm w-full border px-4 py-3"
            >
              {t("search.label.search-view-content.loadMore", {
                visible: visiblePapers.length,
                total: effectiveResultCount,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return <SearchResultsContentRail resultsColumn={resultsColumn} />;
}
