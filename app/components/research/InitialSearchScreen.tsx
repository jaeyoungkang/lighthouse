"use client";

// @promise promise:research-route-cap-feedback
// @promise promise:search-results-fast-window
// @check acceptance-check:research-route-cap-feedback-route-search-visible
// @check acceptance-check:search-results-fast-window-result-basis-visible

import { ResearchRouteRendererShell } from "@/app/components/research-route-renderers/ResearchRouteRendererShell";
import { SearchViewEmptyState } from "@/app/components/research-route-renderers/search-view-states";
import {
  INITIAL_SEARCH_CONTENT_SHELL_CLASS,
  INITIAL_SEARCH_PANEL_MAX_WIDTH_CLASS,
} from "@/app/components/research/research-route-layout.shared";

// Stage 5e: the empty `/search` start screen is route-owned, not a fabricated
// store document. It renders the same centered initial search entry the retired
// `search-` virtual placeholder used to back. Submit is a pure URL navigation
// owned by `SearchViewEmptyState`; `/search?q=` executes from that URL.
interface InitialSearchScreenProps {
  libraryContextAvailable?: boolean;
  /** Legacy render-fixture input; ignored by the unified result projection. */
  personalize?: boolean;
}

export function InitialSearchScreen({ libraryContextAvailable = false }: InitialSearchScreenProps) {
  return (
    <div
      className={[
        "mx-auto",
        "grid min-h-[calc(100dvh-var(--lh-header-offset))] w-full min-w-0 grid-cols-1",
        "lg:grid-cols-[minmax(0,1fr)]",
        INITIAL_SEARCH_PANEL_MAX_WIDTH_CLASS,
      ].join(" ")}
      data-testid="initial-search-screen"
      data-panel-width-mode="inline"
    >
      <div className="w-full min-w-0" data-testid="document-panel-main">
        <ResearchRouteRendererShell>
          <div className={INITIAL_SEARCH_CONTENT_SHELL_CLASS}>
            <SearchViewEmptyState
              isError={false}
              libraryContextAvailable={libraryContextAvailable}
            />
          </div>
        </ResearchRouteRendererShell>
      </div>
    </div>
  );
}
