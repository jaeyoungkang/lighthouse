"use client";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
// @promise promise:graph-neighbor-papers
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @promise promise:inline-analysis-auto-run
// @check acceptance-check:inline-analysis-auto-run-exposed-card-start
// @check acceptance-check:inline-analysis-auto-run-different-position-search
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:paper-card-action-loading-feedback

import {
  getResearchRouteViewerPrincipalId,
  type CitationLineageMetadata,
  type ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS } from "../research/research-route-layout.shared";
import { openGapNetworkFromCitationLineageCitations } from "./citation-lineage-agent-actions";
import { FORCE_NEW_WINDOW_ACTIVATION, navigateFollowupRoute } from "./view-followup-window";
import { openDetachedGapReportWindowTarget } from "./search-view-agent-actions";
import { CitationLineageResultsState } from "./citation-lineage-view";
import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";
import { usePaperCardDocumentHandlers } from "./use-paper-card-view-handlers";
import { useVisiblePaperIdsBySection } from "./use-visible-paper-ids-by-section";

interface CitationLineageViewProps {
  document: ResearchRoutePayload;
  reactionSlot?: ReactNode;
}

export function CitationLineageView({ document, reactionSlot }: CitationLineageViewProps) {
  return (
    <CitationLineageReadyDocument
      key={document.id}
      document={document}
      reactionSlot={reactionSlot}
    />
  );
}

function CitationLineageReadyDocument({ document, reactionSlot }: CitationLineageViewProps) {
  const router = useRouter();
  const metadata = document.metadata as CitationLineageMetadata;
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
  } = usePaperCardDocumentHandlers({ document, metadata, visiblePaperIds });

  return (
    <ResearchRouteRendererShell>
      <div className={RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS}>
        <CitationLineageResultsState
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
          onOpenGapNetwork={() => {
            const navigationTarget = openDetachedGapReportWindowTarget();
            openGapNetworkFromCitationLineageCitations(
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
