"use client";

// @promise promise:search-results-fast-window

import type {
  SearchMetadata,
  SearchResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import type { SearchResultCardAnalyticsContext } from "./search-result-analytics";
import type { SearchFacetFilters } from "@/app/domain/search-facets";
import { useFindSimilarHandler, useSearchTermHandler } from "./search-view-followup-handlers";
import { useSearchKnowledgeMapHandlers } from "./search-view-knowledge-map";
import type {
  FollowupActivationEvent,
  SearchViewBodyViewModel,
  SearchTermFollowupHandler,
} from "./search-view.helpers";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import {
  useSearchViewUiState,
  useSearchViewStoreBindings,
  useSearchRequestHandlers,
  useReviewedPaperHandler,
} from "./use-search-view-controller.shared";
import { useCitationLineageHandler, useGraphNeighborsHandler } from "./use-graph-neighbors-handler";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";

interface UseSearchViewControllerParams {
  document: SearchResearchRoutePayload;
  exposedPaperIds?: readonly string[];
}

interface SearchViewControllerResult {
  metadata: SearchMetadata;
  query: string;
  sortOption: SearchSortOption;
  facetFilters: SearchFacetFilters;
  libraryContextAvailable: boolean;
  yearFilter: string;
  isSearching: boolean;
  isError: boolean;
  visibleCount: number;
  isCreatingGapNetwork: boolean;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId: string | null;
  analysisProgressMap: ReturnType<typeof useSearchViewUiState>["analysisProgressMap"];
  analysisMap: ReturnType<typeof useSearchViewUiState>["analysisMap"];
  bodyViewModel: SearchViewBodyViewModel;
  reviewedIds: ReadonlySet<string>;
  pendingReviewedPaperIds: ReadonlySet<string>;
  handleQueryChange: (value: string) => void;
  handleSortChange: (value: SearchSortOption) => void;
  handleYearRangeApply: (value: string) => void;
  handleOpenGapNetwork: (event?: FollowupActivationEvent) => void;
  handleOpenCitationLineage: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  handleOpenGraphNeighbors: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  handleFindSimilar: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  handleSearchTerm: SearchTermFollowupHandler;
  handleToggleLibraryPaper: (paper: PaperCore, context?: SearchResultCardAnalyticsContext) => void;
  handleEnsurePaperVisible: (paperIndex: number) => void;
  handleLoadMore: () => void;
}

export function useSearchViewController({
  document,
  exposedPaperIds = [],
}: UseSearchViewControllerParams): SearchViewControllerResult {
  const metadata = document.metadata;
  const seededLibraryAvailable = useLibraryAvailabilityStore((store) => store.available);
  const documentStore = useSearchViewStoreBindings(document, metadata);
  const state = useSearchViewUiState(
    document,
    metadata,
    exposedPaperIds,
    documentStore.patchCurrentView,
  );
  const searchHandlers = useSearchRequestHandlers({
    document,
    metadata,
    sortOption: state.sortOption,
    yearFilter: state.yearFilter,
    isSearching: state.isSearching,
    setSortOption: state.setSortOption,
    setYearFilter: state.setYearFilter,
  });
  const citationLineageHandler = useCitationLineageHandler({
    sourceDocumentId: document.id,
    ownerPrincipalId: document.ownerPrincipalId,
  });
  const graphNeighborsHandler = useGraphNeighborsHandler({
    sourceDocumentId: document.id,
    emitSystemEvent: documentStore.emitSystemEvent,
  });
  const handleFindSimilar = useFindSimilarHandler({
    documentId: document.id,
    ownerPrincipalId: document.ownerPrincipalId,
    metadata,
  });
  const handleSearchTerm = useSearchTermHandler();
  const handleToggleLibraryPaper = useReviewedPaperHandler({
    ownerPrincipalId: document.ownerPrincipalId,
    documentId: document.id,
    emitSystemEvent: documentStore.emitSystemEvent,
    reviewedIdsRef: state.reviewedIdsRef,
    setReviewedIds: state.setReviewedIds,
    pendingReviewedPaperIdsRef: state.pendingReviewedPaperIdsRef,
    setPendingReviewedPaperIds: state.setPendingReviewedPaperIds,
  });
  const knowledgeMapHandlers = useSearchKnowledgeMapHandlers({
    document,
    metadata,
    resultPapers: state.bodyViewModel.resultPapers,
    resultCount: state.bodyViewModel.resultCount,
    setVisibleCount: state.setVisibleCount,
  });

  return {
    analysisMap: state.analysisMap,
    analysisProgressMap: state.analysisProgressMap,
    bodyViewModel: state.bodyViewModel,
    handleLoadMore: knowledgeMapHandlers.handleLoadMore,
    handleOpenGapNetwork: knowledgeMapHandlers.handleOpenGapNetwork,

    handleOpenCitationLineage: (paper, event) => {
      return citationLineageHandler.handleOpenCitationLineage(paper, event);
    },
    handleOpenGraphNeighbors: (paper, event) => {
      return graphNeighborsHandler.handleOpenGraphNeighbors(paper, event);
    },
    handleFindSimilar,
    handleQueryChange: state.setQuery,
    handleSortChange: searchHandlers.handleSortChange,
    handleSearchTerm,
    handleToggleLibraryPaper,
    handleEnsurePaperVisible: (paperIndex) => {
      state.setVisibleCount((current) => Math.max(current, paperIndex + 1));
    },
    handleYearRangeApply: searchHandlers.handleYearRangeApply,
    isCreatingGapNetwork: knowledgeMapHandlers.isCreatingGapNetwork,

    citationLineageLoadingPaperId: citationLineageHandler.citationLineageLoadingPaperId,
    graphNeighborsLoadingPaperId: graphNeighborsHandler.graphNeighborsLoadingPaperId,
    isError: state.isError,
    isSearching: state.isSearching,
    metadata,
    query: state.query,
    reviewedIds: state.reviewedIds,
    pendingReviewedPaperIds: state.pendingReviewedPaperIds,
    sortOption: state.sortOption,
    facetFilters: state.facetFilters,
    libraryContextAvailable: metadata.libraryContextAvailable ?? seededLibraryAvailable,
    visibleCount: state.visibleCount,
    yearFilter: state.yearFilter,
  };
}
