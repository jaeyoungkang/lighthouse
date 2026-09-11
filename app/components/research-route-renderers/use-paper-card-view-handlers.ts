"use client";

import {
  getResearchRouteViewerPrincipalId,
  type CitationLineageMetadata,
  type GraphNeighborsMetadata,
  type ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useFindSimilarHandler, useSearchTermHandler } from "./search-view-followup-handlers";
import type { FollowupActivationEvent } from "./search-view.helpers";
import { buildInlineAnalysisMap, buildInlineAnalysisProgressMap } from "@/app/lib/inline-analysis";
import { useCitationLineageHandler, useGraphNeighborsHandler } from "./use-graph-neighbors-handler";
import { useInlineAnalysis } from "./use-inline-analysis";

type PaperCardResearchRoutePayloadMetadata = CitationLineageMetadata | GraphNeighborsMetadata;

export function usePaperCardDocumentHandlers({
  document,
  metadata,
  visiblePaperIds = [],
}: {
  document: ResearchRoutePayload;
  metadata: PaperCardResearchRoutePayloadMetadata;
  visiblePaperIds?: readonly string[];
}) {
  const emitSystemEvent = useReactionActionStore((state) => state.emitSystemEvent);

  const { analysisMap, analysisProgressMap } = useInlineAnalysis({
    documentId: document.id,
    ownerPrincipalId: getResearchRouteViewerPrincipalId(document),
    metadata,
    visiblePaperIds,
    visibleCount: visiblePaperIds.length,
  });

  const mergedAnalysisMap = new Map([...buildInlineAnalysisMap(metadata.papers), ...analysisMap]);
  const mergedProgressMap = new Map([
    ...buildInlineAnalysisProgressMap(metadata.papers),
    ...analysisProgressMap,
  ]);

  const citationLineageHandler = useCitationLineageHandler({
    sourceDocumentId: document.id,
    ownerPrincipalId: getResearchRouteViewerPrincipalId(document),
  });
  const graphNeighborsHandler = useGraphNeighborsHandler({
    sourceDocumentId: document.id,
    emitSystemEvent,
  });
  const handleFindSimilar = useFindSimilarHandler({
    documentId: document.id,
    ownerPrincipalId: getResearchRouteViewerPrincipalId(document),
    metadata,
  });
  const handleSearchTerm = useSearchTermHandler();
  const handleOpenCitationLineage = (paper: PaperCore, event?: FollowupActivationEvent) => {
    return citationLineageHandler.handleOpenCitationLineage(paper, event);
  };
  const handleOpenGraphNeighbors = (paper: PaperCore, event?: FollowupActivationEvent) => {
    return graphNeighborsHandler.handleOpenGraphNeighbors(paper, event);
  };

  return {
    mergedAnalysisMap,
    mergedProgressMap,
    citationLineageLoadingPaperId: citationLineageHandler.citationLineageLoadingPaperId,
    graphNeighborsLoadingPaperId: graphNeighborsHandler.graphNeighborsLoadingPaperId,
    handleOpenCitationLineage,
    handleOpenGraphNeighbors,
    handleFindSimilar,
    handleSearchTerm,
    graphNeighborsHandler,
  };
}
