"use client";

// @promise promise:search-nonascii-library-relevance
// @aspect aspect:library-grounded-research
// @check acceptance-check:search-nonascii-library-relevance-korean-overlap

import { useEffect, useMemo } from "react";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  canCompeteInLibraryInterestPool,
  hasCjkSearchCharacters,
} from "@/app/lib/search-paper-sort";
import { trackSearchLanguageAwareLibrarySupplementViewedOnce } from "@/app/lib/track";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";

export function useLanguageAwareLibrarySupplementTracking(params: {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  metadata: SearchMetadata;
  sortOption: SearchSortOption;
  yearFilter: string;
  effectiveResultCount: number;
  visiblePapers: SearchMetadata["papers"];
}): void {
  const languageAwareLibrarySupplementCount = useMemo(() => {
    if (!hasCjkSearchCharacters(params.metadata.query) || params.sortOption !== "interest") {
      return 0;
    }
    if (params.metadata.libraryContext?.rankingMode === "combined_score") {
      return 0;
    }

    const libraryOnlyPaperIds = new Set(params.metadata.libraryContext?.libraryOnlyPaperIds ?? []);
    return params.visiblePapers.filter(
      (paper) =>
        libraryOnlyPaperIds.has(paper.paperId) &&
        canCompeteInLibraryInterestPool({ paper, query: params.metadata.query }),
    ).length;
  }, [
    params.metadata.libraryContext?.libraryOnlyPaperIds,
    params.metadata.libraryContext?.rankingMode,
    params.metadata.query,
    params.sortOption,
    params.visiblePapers,
  ]);

  useEffect(() => {
    if (languageAwareLibrarySupplementCount <= 0) return;
    trackSearchLanguageAwareLibrarySupplementViewedOnce({
      type: "user_search",
      data: {
        ownerPrincipalId: params.ownerPrincipalId,
        documentId: params.sourceSnapshotId,
        query: params.metadata.query,
        sort: params.sortOption,
        year: params.yearFilter,
        resultCount: params.effectiveResultCount,
        visibleResultCount: params.visiblePapers.length,
        libraryGroundingApplied: params.metadata.libraryGrounding?.status === "applied",
        libraryAnchorPaperCount: params.metadata.libraryContext?.anchorPaperCount ?? 0,
        languageAwareLibrarySupplementCount,
      },
    });
  }, [
    languageAwareLibrarySupplementCount,
    params.effectiveResultCount,
    params.metadata.query,
    params.metadata.libraryGrounding?.status,
    params.metadata.libraryContext?.anchorPaperCount,
    params.ownerPrincipalId,
    params.sortOption,
    params.sourceSnapshotId,
    params.visiblePapers.length,
    params.yearFilter,
  ]);
}
