"use client";

// @promise promise:graph-neighbor-papers
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:document-content-width-governance
// @aspect aspect:ai-comment-research-term-suggestions
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:graph-neighbor-papers-two-axes-separated
// @check acceptance-check:graph-neighbor-papers-adjacency-count-shown
// @check acceptance-check:graph-neighbor-papers-seed-title-card-pinned
// @check acceptance-check:graph-neighbor-papers-graph-failure-degraded
// @check acceptance-check:graph-neighbor-papers-paginated-window
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-card-data-hydration
// @check acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
// @promise promise:inline-analysis-auto-run
// @check acceptance-check:inline-analysis-auto-run-different-position-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback

import type { PaperCore } from "@/app/domain/paper";
import type { GraphNeighborsMetadata } from "@/app/domain/research-route-payload";
import type { ReactNode } from "react";
import { t } from "@/app/i18n/message-access";
import { RESEARCH_ROUTE_BODY_RAIL_CLASS } from "@/app/components/research/research-route-layout.shared";
import { GraphAxesBlock, GraphNeighborSeedPaperCard } from "./graph-neighbor-section";
import type { FollowupActivationEvent, SearchTermFollowupHandler } from "./search-view.helpers";
import type { AnalysisProgressState, AnalysisResult } from "@/app/lib/inline-analysis";
import { InlineAiCommentFrame } from "@/app/components/research/inline-ai-comment-frame";
import { SearchResultsResearchTermLinks } from "@/app/components/research/search-results-overview-panel";
import {
  buildRelationshipResearchTermsBlock,
  type SearchResultsOverviewTerm,
} from "@/app/components/research/search-results-overview-model";
import { commitSearchResultsOverviewTerm } from "./search-results-overview-actions";
import { useSearchJourneyAnalyticsContext } from "@/app/components/research/search-followup-activation";

export interface GraphNeighborsResultsStateProps {
  ownerPrincipalId: string;
  documentId: string;
  metadata: GraphNeighborsMetadata;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
  onOpenCitationLineage: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onOpenGraphNeighbors: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onSearchTerm?: SearchTermFollowupHandler;
  /** 그래프 호출 실패(degraded) 시 같은 seed로 다시 그래프 view를 여는 재시도. */
  onRetry?: () => void;
  onVisiblePaperIdsChange?: (sectionId: string, paperIds: readonly string[]) => void;
  onOpenGapNetwork?: () => void;
  reactionSlot?: ReactNode;
}

export function GraphNeighborsResultsState({
  ownerPrincipalId,
  documentId,
  metadata,
  analysisProgressMap,
  analysisMap,
  citationLineageLoadingPaperId,
  graphNeighborsLoadingPaperId,
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onSearchTerm,
  onVisiblePaperIdsChange,
  onRetry,
  onOpenGapNetwork,
  reactionSlot,
}: GraphNeighborsResultsStateProps) {
  const analyticsContext = useSearchJourneyAnalyticsContext(documentId);
  const coCited = metadata.coCited;
  const coupled = metadata.coupled;
  const sourceQuery = metadata.seedPaper.title;
  const isHydratingCardData = metadata.cardDataHydration?.status === "pending";
  // 세 상태: degraded(그래프 호출 실패) → empty(정직한 빈 결과) → axes(축 렌더).
  // empty/axes 분기는 GraphAxesBlock이 내부에서 처리한다.
  const graphLoadFailed = metadata.graphLoadFailed === true;
  const hasGapNetworkInput = metadata.papers.length > 0;
  const researchTermsBlock = buildRelationshipResearchTermsBlock({
    documentType: "graph_neighbors",
    papers: [metadata.seedPaper, ...metadata.papers],
  });
  const handleResearchTerm = (
    candidate: SearchResultsOverviewTerm,
    event?: FollowupActivationEvent,
  ) => {
    commitSearchResultsOverviewTerm({
      candidate,
      ownerPrincipalId,
      documentId,
      query: sourceQuery,
      sourceResearchRouteKind: "graph_neighbors",
      onSearchTerm,
      event,
    });
  };

  return (
    <div className={RESEARCH_ROUTE_BODY_RAIL_CLASS} data-testid="graph-neighbors-content-rail">
      <GraphNeighborSeedPaperCard
        seedPaper={metadata.seedPaper}
        kicker={t("search.label.graph-neighbors.kicker")}
        seedGuide={t("search.label.graph-neighbors.seedGuide")}
      />
      <InlineAiCommentFrame
        reactionSlot={reactionSlot}
        inlineBodyAppendSlot={
          researchTermsBlock ? (
            <SearchResultsResearchTermLinks
              block={researchTermsBlock}
              onSearchTerm={handleResearchTerm}
            />
          ) : null
        }
        onOpenGapNetwork={onOpenGapNetwork}
        hasGapNetworkInput={hasGapNetworkInput}
        className="mb-4"
      />

      {graphLoadFailed ? (
        <div className="lh-panel-muted lh-tone-secondary mb-6 space-y-3 px-4 py-3">
          <p className="lh-type-reading-body">{t("search.label.graph-neighbors.loadFailed")}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="lh-control lh-type-control-label border-border-subtle bg-surface-panel rounded-lh-sm border px-4 py-2"
            >
              {t("search.label.graph-neighbors.retry")}
            </button>
          )}
        </div>
      ) : (
        <GraphAxesBlock
          ownerPrincipalId={ownerPrincipalId}
          documentId={documentId}
          analyticsContext={analyticsContext}
          coCited={coCited}
          coupled={coupled}
          analysisProgressMap={analysisProgressMap}
          analysisMap={analysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          isHydratingDetails={isHydratingCardData}
          sourceSurface="graph_neighbors"
          onOpenCitationLineage={onOpenCitationLineage}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
          onSearchTerm={onSearchTerm}
          onVisiblePaperIdsChange={onVisiblePaperIdsChange}
        />
      )}
    </div>
  );
}
