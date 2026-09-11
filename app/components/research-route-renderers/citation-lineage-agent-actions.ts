"use client";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source

import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import {
  buildCitationLineageCitationsGapQuery,
  getCitationLineageGapInputPapers,
} from "./citation-lineage.helpers";
import {
  type GapReportNavigationTarget,
  openGapNetworkFromSearchSource,
} from "./search-view-agent-actions";

interface GapNetworkNavigationOptions {
  navigationTarget?: GapReportNavigationTarget | null;
}

export function openGapNetworkFromCitationLineageCitations(
  document: ResearchRoutePayload,
  navigate?: (url: string) => void,
  options?: GapNetworkNavigationOptions,
): void {
  if (document.type !== "citation_lineage") {
    options?.navigationTarget?.discard();
    return;
  }

  const metadata = document.metadata;
  const papers = getCitationLineageGapInputPapers(metadata);
  if (papers.length === 0) {
    options?.navigationTarget?.discard();
    return;
  }

  const query = buildCitationLineageCitationsGapQuery(metadata);
  const sourceMetadata = {
    type: "search" as const,
    query,
    papers,
    total: papers.length,
  };
  openGapNetworkFromSearchSource(document, sourceMetadata, navigate, undefined, options);
}
