"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";

type SetState<T> = Dispatch<SetStateAction<T>>;

export function useSearchRequestHandlers(params: {
  document: ResearchRoutePayload;
  metadata: SearchMetadata;
  sortOption: SearchSortOption;
  yearFilter: string;
  isSearching: boolean;
  setSortOption: SetState<SearchSortOption>;
  setYearFilter: SetState<string>;
}) {
  const patchCurrentView = useResearchRouteStore((state) => state.patchCurrentView);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const { document, isSearching, setSortOption, setYearFilter, sortOption, yearFilter } = params;
  const sortOptionRef = useRef(sortOption);
  const yearFilterRef = useRef(yearFilter);

  useEffect(() => {
    sortOptionRef.current = sortOption;
  }, [sortOption]);

  useEffect(() => {
    yearFilterRef.current = yearFilter;
  }, [yearFilter]);

  const updateSearchViewMetadata = useCallback(
    (updates: Pick<SearchMetadata, "sortOption" | "yearFilter">) => {
      const routeState = useResearchRouteStore.getState();
      const currentView = routeState.currentView;
      if (
        !activeExecutionId ||
        routeState.activeExecutionId !== activeExecutionId ||
        currentView?.id !== document.id ||
        currentView.type !== "search"
      ) {
        return;
      }
      const { searchIntentMode: _searchIntentMode, ...currentMetadata } = currentView.metadata;
      void _searchIntentMode;
      patchCurrentView(
        {
          ...currentView,
          metadata: {
            ...currentMetadata,
            ...updates,
          },
          updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, currentView.updatedAt),
        },
        activeExecutionId,
      );
    },
    [activeExecutionId, document.id, patchCurrentView],
  );

  const handleSortChange = useCallback(
    (nextSortOption: SearchSortOption) => {
      sortOptionRef.current = nextSortOption;
      setSortOption(nextSortOption);
      updateSearchViewMetadata({ sortOption: nextSortOption, yearFilter: yearFilterRef.current });
    },
    [setSortOption, updateSearchViewMetadata],
  );

  // Stages a publication-year range value without triggering a server-side
  // query transition. The next user-initiated search action (검색 버튼 클릭 또는
  // query input Enter) picks the staged value up through `yearFilterRef` and
  // sends it alongside the query in a single Episteme search request.
  const handleYearRangeApply = useCallback(
    (nextYearFilter: string) => {
      if (isSearching) return;
      if (nextYearFilter === yearFilterRef.current) return;
      yearFilterRef.current = nextYearFilter;
      setYearFilter(nextYearFilter);
    },
    [isSearching, setYearFilter],
  );

  return {
    handleSortChange,
    handleYearRangeApply,
  };
}
