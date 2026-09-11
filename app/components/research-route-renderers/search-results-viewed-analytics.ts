"use client";

// The general result renderer owns the first-visible collection boundary.

import { useEffect } from "react";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { trackSearchResultsViewed } from "@/app/lib/track";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import type { SearchJourneyAnalyticsContext } from "@/app/components/research/search-followup-activation";

export function useSearchResultsViewedTracking(params: {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  analyticsContext?: SearchJourneyAnalyticsContext;
  ready?: boolean;
  metadata: SearchMetadata;
  sortOption: SearchSortOption;
  yearFilter: string;
  effectiveResultCount: number;
  visiblePapers: SearchMetadata["papers"];
}): void {
  useEffect(() => {
    if (params.ready === false) return;
    trackSearchResultsViewed({
      type: "user_search",
      data: {
        ownerPrincipalId: params.ownerPrincipalId,
        documentId: params.sourceSnapshotId,
        journeyContextId: params.analyticsContext?.journeyContextId ?? params.sourceSnapshotId,
        searchContextId: params.analyticsContext?.searchContextId ?? params.sourceSnapshotId,
        query: params.metadata.query,
        sort: params.sortOption,
        year: params.yearFilter,
        resultCount: params.effectiveResultCount,
        visibleResultCount: params.visiblePapers.length,
        libraryGroundingApplied: params.metadata.libraryGrounding?.status === "applied",
        libraryAnchorPaperCount: params.metadata.libraryContext?.anchorPaperCount ?? 0,
      },
    });
  }, [
    params.effectiveResultCount,
    params.analyticsContext?.journeyContextId,
    params.analyticsContext?.searchContextId,
    params.metadata.libraryGrounding?.status,
    params.metadata.libraryContext?.anchorPaperCount,
    params.metadata.query,
    params.ownerPrincipalId,
    params.ready,
    params.sortOption,
    params.sourceSnapshotId,
    params.visiblePapers.length,
    params.yearFilter,
  ]);
}
