"use client";

// @promise promise:search-results-fast-window
// @aspect aspect:library-grounded-research
// @check acceptance-check:search-results-fast-window-result-basis-visible

import { createContext, useContext, type ReactNode } from "react";

interface ResearchRouteLibraryState {
  libraryContextAvailable: boolean;
}

const ResearchRouteLibraryContext = createContext<ResearchRouteLibraryState>({
  libraryContextAvailable: false,
});

export function ResearchRouteLibraryProvider({
  children,
  libraryContextAvailable,
}: Pick<ResearchRouteLibraryState, "libraryContextAvailable"> & { children: ReactNode }) {
  return (
    <ResearchRouteLibraryContext.Provider value={{ libraryContextAvailable }}>
      {children}
    </ResearchRouteLibraryContext.Provider>
  );
}

export function useResearchRouteLibraryState(): ResearchRouteLibraryState {
  return useContext(ResearchRouteLibraryContext);
}
