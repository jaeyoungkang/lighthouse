"use client";

// @promise promise:graph-neighbor-papers
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
// @promise promise:inline-analysis-auto-run
// @check acceptance-check:inline-analysis-auto-run-exposed-card-start
// @check acceptance-check:inline-analysis-auto-run-different-position-search
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:paper-card-action-loading-feedback

import {
  getResearchRouteViewerPrincipalId,
  type GraphNeighborsMetadata,
  type ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS } from "../research/research-route-layout.shared";
import { openGapNetworkFromGraphNeighbors } from "./graph-neighbors-agent-actions";
import { FORCE_NEW_WINDOW_ACTIVATION, navigateFollowupRoute } from "./view-followup-window";
import { openDetachedGapReportWindowTarget } from "./search-view-agent-actions";
import { GraphNeighborsResultsState } from "./graph-neighbors-view";
import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";
import { usePaperCardDocumentHandlers } from "./use-paper-card-view-handlers";
import { useVisiblePaperIdsBySection } from "./use-visible-paper-ids-by-section";

interface GraphNeighborsViewProps {
  document: ResearchRoutePayload;
  reactionSlot?: ReactNode;
}

export function GraphNeighborsView({ document, reactionSlot }: GraphNeighborsViewProps) {
  return (
    <GraphNeighborsReadyDocument
      key={document.id}
      document={document}
      reactionSlot={reactionSlot}
    />
  );
}

function GraphNeighborsReadyDocument({ document, reactionSlot }: GraphNeighborsViewProps) {
  const router = useRouter();
  const metadata = document.metadata as GraphNeighborsMetadata;
  const { visiblePaperIds, handleVisiblePaperIdsChange } = useVisiblePaperIdsBySection(document.id);
  const {
    mergedAnalysisMap,
    mergedProgressMap,
    citationLineageLoadingPaperId,
    graphNeighborsLoadingPaperId,
    handleOpenCitationLineage,
    handleOpenGraphNeighbors,
    handleFindSimilar,
    handleSearchTerm,
    graphNeighborsHandler,
  } = usePaperCardDocumentHandlers({ document, metadata, visiblePaperIds });
  // degraded 문서에서 재시도: 같은 seed route를 다시 실행한다.
  const handleRetry = () => {
    graphNeighborsHandler.handleOpenGraphNeighbors(metadata.seedPaper, { forceRefetch: true });
  };

  return (
    <ResearchRouteRendererShell>
      <div className={RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS}>
        <GraphNeighborsResultsState
          ownerPrincipalId={getResearchRouteViewerPrincipalId(document)}
          documentId={document.id}
          metadata={metadata}
          analysisProgressMap={mergedProgressMap}
          analysisMap={mergedAnalysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          onOpenCitationLineage={handleOpenCitationLineage}
          onOpenGraphNeighbors={handleOpenGraphNeighbors}
          onFindSimilar={handleFindSimilar}
          onSearchTerm={handleSearchTerm}
          onVisiblePaperIdsChange={handleVisiblePaperIdsChange}
          onRetry={handleRetry}
          onOpenGapNetwork={() => {
            const navigationTarget = openDetachedGapReportWindowTarget();
            openGapNetworkFromGraphNeighbors(
              document,
              (url) => {
                navigateFollowupRoute(
                  url,
                  (next) => {
                    router.push(next);
                  },
                  FORCE_NEW_WINDOW_ACTIVATION,
                );
              },
              { navigationTarget },
            );
          }}
          reactionSlot={reactionSlot}
        />
      </div>
    </ResearchRouteRendererShell>
  );
}
