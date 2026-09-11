"use client";

import type { PaperCore } from "@/app/domain/paper";
import { trackSearchResultInspected } from "@/app/lib/track";
import {
  resolvePaperEvidenceAvailability,
  type SearchResultCardAnalyticsContext,
} from "./search-result-analytics";

export function trackSearchResultInspectedFromCard(params: {
  paper: PaperCore;
  analyticsContext: SearchResultCardAnalyticsContext;
  cardMetadata: {
    hasPdf: boolean;
    year: number | null;
    citationCount: number;
    referenceCount: number;
    authorCount: number;
  };
}): void {
  trackSearchResultInspected({
    journeyContextId: params.analyticsContext.journeyContextId,
    searchContextId: params.analyticsContext.searchContextId,
    paperId: params.paper.paperId,
    resultRank: params.analyticsContext.resultRank,
    hasPdf: params.cardMetadata.hasPdf,
    sourceSurface: params.analyticsContext.sourceSurface ?? "search_results",
    evidenceAvailability: resolvePaperEvidenceAvailability(params.paper),
  });
}
