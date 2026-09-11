"use client";

// @promise promise:search-results-fast-window
// @promise promise:search-spelling-correction
// @promise promise:search-reaction-summarizes-terrain
// @promise promise:search-query-route-transition
// @promise promise:research-route-cap-feedback
// @promise promise:search-nonascii-library-relevance
// @aspect aspect:context-preserving-transitions
// @aspect aspect:immediate-navigation
// @aspect aspect:search-first-url-model
// @aspect aspect:document-content-width-governance
// @check acceptance-check:search-query-route-transition-immediate-submit
// @check acceptance-check:search-query-route-transition-browser-route-owned
// @check acceptance-check:search-nonascii-library-relevance-korean-overlap

import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";
import {
  getResearchRouteViewerPrincipalId,
  type ResearchRoutePayload,
  type SearchMetadata,
  type SearchResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import type { SearchResultCardAnalyticsContext } from "./search-result-analytics";
import type { SearchFacetFilters } from "@/app/domain/search-facets";
import { type SearchViewResultHandlers } from "./search-view.helpers";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import {
  SearchViewEmptyState,
  SearchViewFailedState,
  SearchViewProcessingState,
  SearchViewResultsState,
} from "./search-view-content";
import { useSearchViewController } from "./use-search-view-controller";
import type { useInlineAnalysis } from "./use-inline-analysis";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
import {
  runWithSearchActivationCleanup,
  useSearchFollowupActivation,
  useSearchJourneyAnalyticsContext,
  type SearchJourneyAnalyticsContext,
} from "@/app/components/research/search-followup-activation";
import {
  INITIAL_SEARCH_CONTENT_SHELL_CLASS,
  RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
} from "../research/research-route-layout.shared";
import { buildSearchResultWindowKey } from "./search-view-controller.helpers";
import { useSearchResultsViewedTracking } from "./search-results-viewed-analytics";
import { useLanguageAwareLibrarySupplementTracking } from "./search-language-aware-library-supplement-analytics";

interface SearchViewProps {
  document: ResearchRoutePayload;
  reactionSlot?: ReactNode;
}

function assertSearchViewPayload(
  document: ResearchRoutePayload,
): asserts document is SearchResearchRoutePayload {
  if (document.type !== "search") {
    throw new Error("SearchView requires a search route payload");
  }
}

interface SearchViewBodyProps extends SearchViewResultHandlers {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  analyticsContext: SearchJourneyAnalyticsContext;
  searchReady: boolean;
  documentTitle: string;
  metadata: SearchMetadata;
  query: string;
  sortOption: SearchSortOption;
  facetFilters?: SearchFacetFilters;
  libraryContextAvailable: boolean;
  yearFilter: string;
  isSearching: boolean;
  isError: boolean;
  isCreatingGapNetwork: boolean;
  analysisProgressMap: ReturnType<typeof useInlineAnalysis>["analysisProgressMap"];
  analysisMap: ReturnType<typeof useInlineAnalysis>["analysisMap"];
  isEmpty: boolean;
  visiblePapers: SearchMetadata["papers"];
  reviewedIds: ReadonlySet<string>;
  pendingReviewedPaperIds: ReadonlySet<string>;
  resultCount: number;
  hasMorePapers: boolean;
  analyzedCount: number;
  runningCount: number;
  queuedCount: number;
  isAnalyzing: boolean;
  onPaperExposed?: (paperId: string) => void;
  onToggleLibraryPaper: (paper: PaperCore, context?: SearchResultCardAnalyticsContext) => void;
  reactionSlot?: ReactNode;
}

function SearchViewBody({
  ownerPrincipalId,
  sourceSnapshotId,
  analyticsContext,
  searchReady,
  documentTitle,
  metadata,
  query,
  sortOption,
  facetFilters,
  libraryContextAvailable,
  yearFilter,
  isSearching,
  isError,
  isCreatingGapNetwork,
  analysisProgressMap,
  analysisMap,
  isEmpty,
  visiblePapers,
  reviewedIds,
  pendingReviewedPaperIds,
  resultCount,
  hasMorePapers,
  analyzedCount,
  runningCount,
  queuedCount,
  isAnalyzing,
  onPaperExposed,
  onToggleLibraryPaper,
  reactionSlot,
  onQueryChange,
  onSortChange,
  onYearRangeApply,
  onOpenGapNetwork,
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onSearchTerm,
  onEnsurePaperVisible,
  onLoadMore,
  citationLineageLoadingPaperId,
  graphNeighborsLoadingPaperId,
}: SearchViewBodyProps) {
  const router = useRouter();
  const { acceptConditionUrl, clearIfStillPending, reportConditionUrlRejected, startActivation } =
    useSearchFollowupActivation();
  useSearchResultsViewedTracking({
    ownerPrincipalId,
    sourceSnapshotId,
    analyticsContext,
    ready: searchReady,
    metadata,
    sortOption,
    yearFilter,
    effectiveResultCount: resultCount,
    visiblePapers,
  });
  useLanguageAwareLibrarySupplementTracking({
    ownerPrincipalId,
    sourceSnapshotId,
    metadata,
    sortOption,
    yearFilter,
    effectiveResultCount: resultCount,
    visiblePapers,
  });
  // An in-result re-search (new query, sort select, spelling correction) moves
  // IMMEDIATELY to the canonical `/search?q=` route (aspect:immediate-navigation);
  // that URL owns the next provider execution and browser history owns the return path.
  // @check acceptance-check:search-query-route-transition-browser-route-owned
  const handleRouteSearchCommit = (params: {
    q: string;
    sort: SearchSortOption;
    year: string;
    facetFilters?: Partial<SearchFacetFilters>;
  }) => {
    const query = params.q;
    if (!query.trim()) return;
    const route = buildSearchRoutePageRoute({
      q: query,
      sort: params.sort,
      year: params.year,
      libraryContextAvailable: libraryContextAvailable ? true : undefined,
      facetFilters: params.facetFilters,
      entry: "requery",
    });
    if (!route.ok) {
      reportConditionUrlRejected();
      return;
    }
    acceptConditionUrl();
    const activation = startActivation({ route: route.route, query: query.trim() });
    runWithSearchActivationCleanup({
      activation,
      clearIfStillPending,
      navigate: () => {
        router.push(route.route, { scroll: false });
      },
    });
  };
  // Loaded-result facets are URL-owned projections over the current result
  // window. They update the canonical `/search?q=` address as route condition
  // state without introducing a separate result-basis preference.
  // @check acceptance-check:search-results-fast-window-unified-result-projection
  // @check acceptance-check:search-results-fast-window-loaded-result-facet-filters
  const handleViewFilterReplace = (params: {
    q: string;
    sort: SearchSortOption;
    year: string;
    facetFilters?: Partial<SearchFacetFilters>;
  }) => {
    const route = buildSearchRoutePageRoute({
      q: params.q,
      sort: params.sort,
      year: params.year,
      libraryContextAvailable: libraryContextAvailable ? true : undefined,
      facetFilters: params.facetFilters,
    });
    if (!route.ok) {
      reportConditionUrlRejected();
      return;
    }
    acceptConditionUrl();
    window.history.replaceState(null, "", route.route);
  };

  if (isError) {
    return (
      <SearchViewFailedState
        query={query}
        onRetry={() => {
          router.refresh();
        }}
      />
    );
  }

  if (isSearching && visiblePapers.length === 0) {
    return <SearchViewProcessingState isError={isError} query={query} />;
  }

  return isEmpty ? (
    <SearchViewEmptyState isError={isError} libraryContextAvailable={libraryContextAvailable} />
  ) : (
    <SearchViewResultsState
      ownerPrincipalId={ownerPrincipalId}
      sourceSnapshotId={sourceSnapshotId}
      analyticsContext={analyticsContext}
      documentTitle={documentTitle}
      metadata={metadata}
      query={query}
      sortOption={sortOption}
      facetFilters={facetFilters}
      yearFilter={yearFilter}
      isSearching={isSearching}
      isError={isError}
      analyzedCount={analyzedCount}
      runningCount={runningCount}
      queuedCount={queuedCount}
      isAnalyzing={isAnalyzing}
      isCreatingGapNetwork={isCreatingGapNetwork}
      visiblePapers={visiblePapers}
      reviewedIds={reviewedIds}
      pendingReviewedPaperIds={pendingReviewedPaperIds}
      resultCount={resultCount}
      hasMorePapers={hasMorePapers}
      analysisProgressMap={analysisProgressMap}
      analysisMap={analysisMap}
      onQueryChange={onQueryChange}
      onSortChange={onSortChange}
      onYearRangeApply={onYearRangeApply}
      onOpenGapNetwork={onOpenGapNetwork}
      onOpenCitationLineage={onOpenCitationLineage}
      onOpenGraphNeighbors={onOpenGraphNeighbors}
      onRouteSearchCommit={handleRouteSearchCommit}
      onViewFilterReplace={handleViewFilterReplace}
      onFindSimilar={onFindSimilar}
      onSearchTerm={onSearchTerm}
      onToggleLibraryPaper={onToggleLibraryPaper}
      onEnsurePaperVisible={onEnsurePaperVisible}
      onLoadMore={onLoadMore}
      citationLineageLoadingPaperId={citationLineageLoadingPaperId}
      graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
      onPaperExposed={onPaperExposed}
      reactionSlot={reactionSlot}
    />
  );
}

function SearchViewView({
  document,
  reactionSlot,
}: {
  document: SearchResearchRoutePayload;
  reactionSlot?: ReactNode;
}) {
  const metadata = document.metadata;
  const analyticsContext = useSearchJourneyAnalyticsContext(document.id);
  const exposureCycleKey = buildInlineAnalysisCycleKey(document.id, metadata);
  const [exposedPaperState, setExposedPaperState] = useState<{
    cycleKey: string;
    paperIds: readonly string[];
  }>(() => ({ cycleKey: exposureCycleKey, paperIds: [] }));
  const exposedPaperIds =
    exposedPaperState.cycleKey === exposureCycleKey ? exposedPaperState.paperIds : [];
  const handlePaperExposed = useCallback(
    (paperId: string) => {
      setExposedPaperState((current) => {
        const currentPaperIds = current.cycleKey === exposureCycleKey ? current.paperIds : [];
        if (currentPaperIds.includes(paperId)) return current;
        return { cycleKey: exposureCycleKey, paperIds: [...currentPaperIds, paperId] };
      });
    },
    [exposureCycleKey],
  );
  const controller = useSearchViewController({ document, exposedPaperIds });
  const isInitialSearch = controller.bodyViewModel.isEmpty;

  return (
    <ResearchRouteRendererShell>
      <div
        className={
          isInitialSearch
            ? INITIAL_SEARCH_CONTENT_SHELL_CLASS
            : RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS
        }
      >
        <SearchViewBody
          ownerPrincipalId={getResearchRouteViewerPrincipalId(document)}
          sourceSnapshotId={document.id}
          analyticsContext={analyticsContext}
          searchReady={document.status === "ready"}
          documentTitle={document.title}
          metadata={controller.metadata}
          query={controller.query}
          sortOption={controller.sortOption}
          facetFilters={controller.facetFilters}
          libraryContextAvailable={controller.libraryContextAvailable}
          yearFilter={controller.yearFilter}
          isSearching={controller.isSearching}
          isError={controller.isError}
          isCreatingGapNetwork={controller.isCreatingGapNetwork}
          analysisProgressMap={controller.analysisProgressMap}
          analysisMap={controller.analysisMap}
          isEmpty={controller.bodyViewModel.isEmpty}
          visiblePapers={controller.bodyViewModel.visiblePapers}
          reviewedIds={controller.reviewedIds}
          pendingReviewedPaperIds={controller.pendingReviewedPaperIds}
          resultCount={controller.bodyViewModel.resultCount}
          hasMorePapers={controller.bodyViewModel.hasMorePapers}
          analyzedCount={controller.bodyViewModel.analyzedCount}
          runningCount={controller.bodyViewModel.runningCount}
          queuedCount={controller.bodyViewModel.queuedCount}
          isAnalyzing={controller.bodyViewModel.isAnalyzing}
          onPaperExposed={handlePaperExposed}
          reactionSlot={reactionSlot}
          onQueryChange={controller.handleQueryChange}
          onSortChange={controller.handleSortChange}
          onYearRangeApply={controller.handleYearRangeApply}
          onOpenGapNetwork={controller.handleOpenGapNetwork}
          onOpenCitationLineage={controller.handleOpenCitationLineage}
          onOpenGraphNeighbors={controller.handleOpenGraphNeighbors}
          onFindSimilar={controller.handleFindSimilar}
          onSearchTerm={controller.handleSearchTerm}
          onToggleLibraryPaper={controller.handleToggleLibraryPaper}
          onEnsurePaperVisible={controller.handleEnsurePaperVisible}
          onLoadMore={controller.handleLoadMore}
          citationLineageLoadingPaperId={controller.citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={controller.graphNeighborsLoadingPaperId}
        />
      </div>
    </ResearchRouteRendererShell>
  );
}

export function buildSearchViewViewKey(
  document: ResearchRoutePayload,
  metadata: SearchMetadata,
): string {
  return `${document.id}:${buildSearchResultWindowKey(metadata)}`;
}

export function SearchView({ document, reactionSlot }: SearchViewProps) {
  assertSearchViewPayload(document);
  const metadata = document.metadata;
  const controllerKey = buildSearchViewViewKey(document, metadata);

  return <SearchViewView key={controllerKey} document={document} reactionSlot={reactionSlot} />;
}
