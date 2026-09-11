// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-expanded-window-persists-per-batch

import { SEARCH_RESULTS_INITIAL_VISIBLE_COUNT } from "@/app/lib/constants";

export interface SearchVisibleWindow {
  executionId: string;
  resultKey: string;
  visibleCount: number;
}

export interface SearchVisibleWindowState {
  activeExecutionId: string | null;
  searchVisibleWindow: SearchVisibleWindow | null;
  setSearchVisibleCount: (
    expectedExecutionId: string,
    resultKey: string,
    next: number | ((current: number) => number),
  ) => void;
}

export function resolveNextSearchVisibleWindow(params: {
  activeExecutionId: string | null;
  current: SearchVisibleWindow | null;
  expectedExecutionId: string;
  resultKey: string;
  next: number | ((current: number) => number);
}): SearchVisibleWindow | null {
  if (params.activeExecutionId !== params.expectedExecutionId) return params.current;
  const currentVisibleCount =
    params.current?.executionId === params.expectedExecutionId &&
    params.current.resultKey === params.resultKey
      ? params.current.visibleCount
      : SEARCH_RESULTS_INITIAL_VISIBLE_COUNT;
  const visibleCount =
    typeof params.next === "function" ? params.next(currentVisibleCount) : params.next;
  return {
    executionId: params.expectedExecutionId,
    resultKey: params.resultKey,
    visibleCount,
  };
}

export function createSearchVisibleWindowActions(
  set: (
    partial:
      | Partial<SearchVisibleWindowState>
      | ((state: SearchVisibleWindowState) => Partial<SearchVisibleWindowState>),
  ) => void,
): Pick<SearchVisibleWindowState, "setSearchVisibleCount"> {
  return {
    setSearchVisibleCount: (expectedExecutionId, resultKey, next) => {
      set((state) => ({
        searchVisibleWindow: resolveNextSearchVisibleWindow({
          activeExecutionId: state.activeExecutionId,
          current: state.searchVisibleWindow,
          expectedExecutionId,
          resultKey,
          next,
        }),
      }));
    },
  };
}
