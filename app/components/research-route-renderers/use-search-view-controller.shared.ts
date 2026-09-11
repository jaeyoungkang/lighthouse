// @promise promise:search-results-fast-window
// @promise promise:search-query-route-transition
// @promise promise:search-result-library-add
// @promise promise:inline-analysis-auto-run
// @aspect aspect:context-preserving-transitions
// @check acceptance-check:search-results-fast-window-expanded-window-persists-per-batch
// @check acceptance-check:search-results-fast-window-selected-sort
// @check acceptance-check:search-query-route-transition-clears-stale-reaction
// @check acceptance-check:search-result-library-add-card-action
// @check acceptance-check:search-result-library-add-reviewed-papers-basis
// @check acceptance-check:search-result-library-add-analytics
// @check acceptance-check:inline-analysis-auto-run-visible-first-priority

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  type SearchMetadata,
  type SearchResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { t } from "@/app/i18n/message-access";
import { SEARCH_RESULTS_INITIAL_VISIBLE_COUNT } from "@/app/lib/constants";
import { API_ROUTES } from "@/app/lib/api-routes";
import { containsEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import {
  REVIEWED_PAPER_STATE_CHANGED_EVENT,
  dispatchReviewedPaperStateChanged,
  type ReviewedPaperStateChangedDetail,
} from "@/app/lib/reviewed-paper-state-event";
import { trackPaperSaved, trackPaperUnsaved } from "@/app/lib/track";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import {
  EMPTY_SEARCH_FACET_FILTERS,
  normalizeSearchFacetFilters,
  type SearchFacetFilters,
} from "@/app/domain/search-facets";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { type LibraryPresetPaper, useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { buildSearchResultWindowKey } from "./search-view-controller.helpers";
import {
  type SearchViewBodyViewModel,
  buildReviewedPaperPayload,
  buildSearchViewBodyViewModel,
  createReviewedIdSet,
  hasDirectPdfUrl,
} from "./search-view.helpers";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";
import { resolveDefaultSearchSortOption, type SearchSortOption } from "@/app/lib/search-paper-sort";
import { buildReviewDoneSystemEventMessage } from "./search-view-messages.helpers";
import {
  resolvePaperEvidenceAvailability,
  type SearchResultCardAnalyticsContext,
} from "./search-result-analytics";

import { useInlineAnalysis } from "./use-inline-analysis";

export { useSearchRequestHandlers } from "./use-search-view-request-handlers";

type SetState<T> = Dispatch<SetStateAction<T>>;

function createCurrentReviewedIdSet(params: {
  metadataPapers: readonly SearchMetadata["papers"][number][];
  libraryPapers: readonly LibraryPresetPaper[];
  reviewedOverrides: ReadonlyMap<string, boolean>;
  pendingReviewedPaperIds: ReadonlySet<string>;
  currentReviewedIds?: ReadonlySet<string>;
}): Set<string> {
  const next = createReviewedIdSet([...params.metadataPapers]);

  for (const paper of params.libraryPapers) {
    next.add(paper.paperId);
  }

  for (const [paperId, reviewed] of params.reviewedOverrides) {
    if (reviewed) {
      next.add(paperId);
    } else {
      next.delete(paperId);
    }
  }

  if (params.currentReviewedIds) {
    for (const paperId of params.pendingReviewedPaperIds) {
      if (params.currentReviewedIds.has(paperId)) {
        next.add(paperId);
      } else {
        next.delete(paperId);
      }
    }
  }

  return next;
}

function toLibraryPresetPaper(paper: PaperCore): LibraryPresetPaper {
  return {
    paperId: paper.paperId,
    title: paper.title,
    folderName: t("search.label.research-route-search-bar.libraryList.folder"),
    url: paper.url,
    authors: paper.authors.map((author) => ({ name: author.name })),
    year: paper.year,
    citationCount: paper.citationCount,
  };
}

export type EmitSystemEvent = (
  eventType: string,
  description: string,
  targetRoutePayloadId?: string,
) => void;
export type PatchCurrentView = (document: SearchResearchRoutePayload) => void;

export interface SearchViewStoreBindings {
  emitSystemEvent: EmitSystemEvent;
  patchCurrentView: PatchCurrentView;
}

export interface SearchViewUiState {
  analysisMap: ReturnType<typeof useInlineAnalysis>["analysisMap"];
  analysisProgressMap: ReturnType<typeof useInlineAnalysis>["analysisProgressMap"];
  bodyViewModel: SearchViewBodyViewModel;
  isError: boolean;
  isSearching: boolean;
  query: string;
  reviewedIds: Set<string>;
  reviewedIdsRef: { current: Set<string> };
  pendingReviewedPaperIds: Set<string>;
  pendingReviewedPaperIdsRef: { current: Set<string> };
  setQuery: SetState<string>;
  setReviewedIds: SetState<Set<string>>;
  setPendingReviewedPaperIds: SetState<Set<string>>;
  setSortOption: SetState<SearchSortOption>;
  setVisibleCount: SetState<number>;
  setYearFilter: SetState<string>;
  sortOption: SearchSortOption;
  facetFilters: SearchFacetFilters;
  visibleCount: number;
  yearFilter: string;
}

export function useSearchViewStoreBindings(
  document: SearchResearchRoutePayload,
  metadata: SearchMetadata,
): SearchViewStoreBindings {
  void metadata;
  const emitSystemEvent = useReactionActionStore((state) => state.emitSystemEvent);
  const patchCurrentViewAction = useResearchRouteStore((state) => state.patchCurrentView);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const patchCurrentView = useCallback(
    (patch: SearchResearchRoutePayload) => {
      if (!activeExecutionId) return;
      patchCurrentViewAction(patch, activeExecutionId);
    },
    [activeExecutionId, patchCurrentViewAction],
  );

  return {
    emitSystemEvent,
    patchCurrentView,
  };
}

export function useSearchViewUiState(
  document: SearchResearchRoutePayload,
  metadata: SearchMetadata,
  exposedPaperIds: readonly string[] = [],
  onPersistedDocument?: (document: SearchResearchRoutePayload) => void,
): SearchViewUiState {
  const [query, setQuery] = useState(metadata.query);
  const [sortOption, setSortOption] = useState<SearchSortOption>(
    resolveDefaultSearchSortOption(metadata),
  );
  const libraryPapers = useLibraryPapersStore((state) => state.papers);
  const reviewedOverridesRef = useRef(new Map<string, boolean>());
  const [yearFilter, setYearFilter] = useState(metadata.yearFilter ?? "");
  const resultWindowKey = useMemo(() => buildSearchResultWindowKey(metadata), [metadata]);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const visibleWindow = useResearchRouteStore((state) => state.searchVisibleWindow);
  const setSearchVisibleCount = useResearchRouteStore((state) => state.setSearchVisibleCount);
  const visibleCount =
    visibleWindow?.executionId === activeExecutionId && visibleWindow.resultKey === resultWindowKey
      ? visibleWindow.visibleCount
      : SEARCH_RESULTS_INITIAL_VISIBLE_COUNT;
  const effectiveSortOption = sortOption;
  const effectiveYearFilter = yearFilter;
  const effectiveFacetFilters = normalizeSearchFacetFilters(
    metadata.facetFilters ?? EMPTY_SEARCH_FACET_FILTERS,
  );
  const resultPapers = useMemo(
    () =>
      buildSearchResultPapers({
        metadata,
        sortOption: effectiveSortOption,
        yearFilter: effectiveYearFilter,
        facetFilters: effectiveFacetFilters,
      }),
    [effectiveFacetFilters, effectiveSortOption, effectiveYearFilter, metadata],
  );
  const currentVisiblePaperIds = useMemo(
    () => new Set(resultPapers.slice(0, visibleCount).map((paper) => paper.paperId)),
    [resultPapers, visibleCount],
  );
  const exposedVisiblePaperIds = useMemo(
    () => exposedPaperIds.filter((paperId) => currentVisiblePaperIds.has(paperId)),
    [currentVisiblePaperIds, exposedPaperIds],
  );
  const setVisibleCount = useCallback<SetState<number>>(
    (next) => {
      if (!activeExecutionId) return;
      setSearchVisibleCount(activeExecutionId, resultWindowKey, (current) =>
        typeof next === "function" ? next(current) : next,
      );
    },
    [activeExecutionId, resultWindowKey, setSearchVisibleCount],
  );
  const { analysisMap, analysisProgressMap } = useInlineAnalysis({
    documentId: document.id,
    ownerPrincipalId: document.ownerPrincipalId,
    metadata,
    analysisPapers: resultPapers,
    visiblePaperIds: exposedVisiblePaperIds,
    visibleCount,
    onPersistedDocument: onPersistedDocument
      ? (persistedDocument) => {
          if (persistedDocument.type === "search") onPersistedDocument(persistedDocument);
        }
      : undefined,
  });
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(() =>
    createCurrentReviewedIdSet({
      metadataPapers: metadata.papers,
      libraryPapers,
      reviewedOverrides: new Map(),
      pendingReviewedPaperIds: new Set(),
    }),
  );
  const reviewedIdsRef = useRef(reviewedIds);
  const [pendingReviewedPaperIds, setPendingReviewedPaperIds] = useState<Set<string>>(
    () => new Set(),
  );
  const pendingReviewedPaperIdsRef = useRef(pendingReviewedPaperIds);
  const reviewedStatusKey = useMemo(
    () =>
      JSON.stringify(
        metadata.papers.map((paper) => [
          paper.paperId,
          Boolean((paper as { reviewed?: boolean }).reviewed),
        ]),
      ),
    [metadata.papers],
  );
  const libraryPaperStatusKey = useMemo(
    () => JSON.stringify(libraryPapers.map((paper) => paper.paperId)),
    [libraryPapers],
  );

  useEffect(() => {
    reviewedIdsRef.current = reviewedIds;
  }, [reviewedIds]);

  useEffect(() => {
    pendingReviewedPaperIdsRef.current = pendingReviewedPaperIds;
  }, [pendingReviewedPaperIds]);

  useEffect(() => {
    setReviewedIds((current) => {
      const next = createCurrentReviewedIdSet({
        metadataPapers: metadata.papers,
        libraryPapers,
        reviewedOverrides: reviewedOverridesRef.current,
        pendingReviewedPaperIds: pendingReviewedPaperIdsRef.current,
        currentReviewedIds: current,
      });
      reviewedIdsRef.current = next;
      return next;
    });
  }, [libraryPapers, libraryPaperStatusKey, metadata.papers, reviewedStatusKey]);

  useEffect(() => {
    const handleReviewedPaperStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<ReviewedPaperStateChangedDetail | undefined>).detail;
      if (!detail || !detail.paperId) return;
      reviewedOverridesRef.current.set(detail.paperId, detail.reviewed);
      setReviewedIds((current) => {
        const next = new Set(current);
        if (detail.reviewed) {
          next.add(detail.paperId);
        } else {
          next.delete(detail.paperId);
        }
        reviewedIdsRef.current = next;
        return next;
      });
    };

    window.addEventListener(REVIEWED_PAPER_STATE_CHANGED_EVENT, handleReviewedPaperStateChanged);
    return () => {
      window.removeEventListener(
        REVIEWED_PAPER_STATE_CHANGED_EVENT,
        handleReviewedPaperStateChanged,
      );
    };
  }, [setReviewedIds]);

  useEffect(() => {
    if (!activeExecutionId) return;
    if (
      visibleWindow?.executionId === activeExecutionId &&
      visibleWindow.resultKey === resultWindowKey
    ) {
      return;
    }
    setSearchVisibleCount(activeExecutionId, resultWindowKey, SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
  }, [activeExecutionId, resultWindowKey, setSearchVisibleCount, visibleWindow]);

  const bodyViewModel = useMemo(
    () =>
      buildSearchViewBodyViewModel({
        metadata,
        visibleCount,
        sortOption: effectiveSortOption,
        yearFilter: effectiveYearFilter,
        facetFilters: effectiveFacetFilters,
        analysisProgressMap,
      }),
    [
      analysisProgressMap,
      effectiveFacetFilters,
      effectiveSortOption,
      effectiveYearFilter,
      metadata,
      visibleCount,
    ],
  );

  return {
    analysisMap,
    analysisProgressMap,
    bodyViewModel,
    isError: document.status === "failed",
    isSearching: document.status === "pending",
    query,
    reviewedIds,
    reviewedIdsRef,
    pendingReviewedPaperIds,
    pendingReviewedPaperIdsRef,
    setQuery,
    setReviewedIds,
    setPendingReviewedPaperIds,
    setSortOption,
    setVisibleCount,
    setYearFilter,
    sortOption: effectiveSortOption,
    facetFilters: effectiveFacetFilters,
    visibleCount,
    yearFilter: effectiveYearFilter,
  };
}

export function useReviewedPaperHandler(params: {
  ownerPrincipalId: string;
  documentId: string;
  emitSystemEvent: EmitSystemEvent;
  reviewedIdsRef: SearchViewUiState["reviewedIdsRef"];
  setReviewedIds: SetState<Set<string>>;
  pendingReviewedPaperIdsRef: SearchViewUiState["pendingReviewedPaperIdsRef"];
  setPendingReviewedPaperIds: SetState<Set<string>>;
}) {
  const {
    ownerPrincipalId,
    documentId,
    emitSystemEvent,
    reviewedIdsRef,
    setReviewedIds,
    pendingReviewedPaperIdsRef,
    setPendingReviewedPaperIds,
  } = params;

  return useCallback(
    (paper: PaperCore, analyticsContext?: SearchResultCardAnalyticsContext) => {
      if (pendingReviewedPaperIdsRef.current.has(paper.paperId)) {
        return;
      }

      const isReviewed = reviewedIdsRef.current.has(paper.paperId);
      const desiredReviewed = !isReviewed;
      const setReviewedState = (reviewed: boolean) => {
        const next = new Set(reviewedIdsRef.current);
        if (reviewed) {
          next.add(paper.paperId);
        } else {
          next.delete(paper.paperId);
        }
        reviewedIdsRef.current = next;
        setReviewedIds(next);
      };
      const setPendingState = (pending: boolean) => {
        const next = new Set(pendingReviewedPaperIdsRef.current);
        if (pending) {
          next.add(paper.paperId);
        } else {
          next.delete(paper.paperId);
        }
        pendingReviewedPaperIdsRef.current = next;
        setPendingReviewedPaperIds(next);
      };

      setPendingState(true);
      setReviewedState(desiredReviewed);
      const trackCommittedLibraryState = (reviewed: boolean) => {
        if (!analyticsContext) return;
        const event = {
          type: "paper_review_toggle",
          data: {
            ownerPrincipalId,
            documentId,
            journeyContextId: analyticsContext.journeyContextId,
            searchContextId: analyticsContext.searchContextId,
            paperId: paper.paperId,
            title: paper.title,
            resultRank: analyticsContext.resultRank,
            sourceSurface: analyticsContext.sourceSurface ?? "search_results",
            hasPdf: hasDirectPdfUrl(paper),
            evidenceAvailability: resolvePaperEvidenceAvailability(paper),
            reviewed,
          },
        } as const;
        if (reviewed) {
          trackPaperSaved({ ...event, data: { ...event.data, reviewed: true } });
        } else {
          trackPaperUnsaved({ ...event, data: { ...event.data, reviewed: false } });
        }
      };

      if (isReviewed) {
        void fetch(API_ROUTES.PAPERS_REVIEWED, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: paper.paperId }),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`review delete failed: ${String(response.status)}`);
            }
            useLibraryPapersStore.getState().removePaper(paper.paperId);
            useLibraryAvailabilityStore
              .getState()
              .setAvailable(containsEpisteme3PaperRef(useLibraryPapersStore.getState().papers));
            dispatchReviewedPaperStateChanged({ paperId: paper.paperId, reviewed: false });
            trackCommittedLibraryState(false);
          })
          .catch((error: unknown) => {
            console.error("[search] reviewed paper delete failed:", error);
            setReviewedState(isReviewed);
          })
          .finally(() => {
            setPendingState(false);
          });
        return;
      }

      void fetch(API_ROUTES.PAPERS_REVIEWED, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildReviewedPaperPayload(paper)),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`review save failed: ${String(response.status)}`);
          }
          useLibraryPapersStore.getState().upsertPaper(toLibraryPresetPaper(paper));
          useLibraryAvailabilityStore
            .getState()
            .setAvailable(containsEpisteme3PaperRef(useLibraryPapersStore.getState().papers));
          dispatchReviewedPaperStateChanged({ paperId: paper.paperId, reviewed: true });
          trackCommittedLibraryState(true);
          emitSystemEvent(
            "paper_review_done",
            buildReviewDoneSystemEventMessage(paper.title),
            documentId,
          );
        })
        .catch((error: unknown) => {
          console.error("[search] reviewed paper save failed:", error);
          setReviewedState(isReviewed);
        })
        .finally(() => {
          setPendingState(false);
        });
    },
    [
      ownerPrincipalId,
      documentId,
      emitSystemEvent,
      pendingReviewedPaperIdsRef,
      reviewedIdsRef,
      setPendingReviewedPaperIds,
      setReviewedIds,
    ],
  );
}
