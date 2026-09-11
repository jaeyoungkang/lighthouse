"use client";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set

import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useRouter } from "next/navigation";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  openDetachedGapReportWindowTarget,
  openGapNetworkFromSearchView,
} from "./search-view-agent-actions";
import { FORCE_NEW_WINDOW_ACTIVATION, navigateFollowupRoute } from "./view-followup-window";
import {
  type GapNetworkOpenOptions,
  type FollowupActivationEvent,
  getNextVisibleSearchResultCount,
} from "./search-view.helpers";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";

type SetVisibleCount = Dispatch<SetStateAction<number>>;

interface SearchKnowledgeMapHandlersParams {
  document: ResearchRoutePayload;
  metadata: SearchMetadata;
  resultPapers: SearchMetadata["papers"];
  resultCount: number;
  setVisibleCount: SetVisibleCount;
}

export function shouldSkipLensOpen(
  _document: ResearchRoutePayload,
  metadata: SearchMetadata,
): boolean {
  return metadata.papers.length === 0;
}

export function buildGapNetworkSearchMetadata(
  metadata: SearchMetadata,
  resultPapers: SearchMetadata["papers"],
): SearchMetadata {
  return {
    ...metadata,
    papers: resultPapers,
  };
}

function normalizeSourcePaperIds(papers: SearchMetadata["papers"]): string[] {
  return papers.map((paper) => paper.paperId).filter((paperId) => paperId.trim().length > 0);
}

export function buildCurrentGapNetworkSearchMetadata(metadata: SearchMetadata): SearchMetadata {
  return buildGapNetworkSearchMetadata(
    metadata,
    buildSearchResultPapers({
      metadata,
      sortOption: metadata.sortOption,
      yearFilter: metadata.yearFilter,
    }),
  );
}

export function useSearchKnowledgeMapHandlers(params: SearchKnowledgeMapHandlersParams) {
  const { document, metadata, resultPapers, resultCount, setVisibleCount } = params;
  const router = useRouter();
  const [isCreatingGapNetwork, setIsCreatingGapNetwork] = useState(false);

  const handleOpenGapNetwork = useCallback(
    (event?: FollowupActivationEvent, options?: GapNetworkOpenOptions) => {
      void event;
      if (isCreatingGapNetwork) {
        return;
      }
      const sourcePapers =
        options?.papers && options.papers.length > 0 ? options.papers : resultPapers;
      const navigationTarget = openDetachedGapReportWindowTarget();
      openGapNetworkFromSearchView(
        document,
        buildGapNetworkSearchMetadata(metadata, sourcePapers),
        (url) => {
          navigateFollowupRoute(
            url,
            (next) => {
              router.push(next);
            },
            FORCE_NEW_WINDOW_ACTIVATION,
          );
        },
        normalizeSourcePaperIds(sourcePapers),
        { navigationTarget, onPendingChange: setIsCreatingGapNetwork },
      );
    },
    [document, isCreatingGapNetwork, metadata, resultPapers, router],
  );
  const handleLoadMore = useCallback(() => {
    setVisibleCount((currentVisibleCount) =>
      getNextVisibleSearchResultCount(currentVisibleCount, resultCount),
    );
  }, [resultCount, setVisibleCount]);

  return {
    handleOpenGapNetwork,
    handleLoadMore,
    isCreatingGapNetwork,
  };
}
