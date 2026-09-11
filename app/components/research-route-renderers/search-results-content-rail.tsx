// @promise promise:search-results-fast-window
// @promise promise:search-results-suggest-english-terms
// @aspect aspect:document-content-width-governance
// @check acceptance-check:search-results-fast-window-year-distribution
// @check acceptance-check:search-results-fast-window-post-search-layout-about
// @check acceptance-check:search-results-suggest-english-terms-result-basis

import type { ReactNode } from "react";
import { DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS } from "@/app/components/research/research-route-layout.shared";

export function SearchResultsContentRail({ resultsColumn }: { resultsColumn: ReactNode }) {
  return (
    <div
      className={`mx-auto w-full min-w-0 pt-2 pb-5 ${DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS}`}
      data-testid="search-results-content-rail"
    >
      {resultsColumn}
    </div>
  );
}
