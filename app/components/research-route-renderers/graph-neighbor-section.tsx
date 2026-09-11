"use client";

// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:paper-card-list-windowing
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:citation-lineage-seed-title-card-pinned
// @check acceptance-check:graph-neighbor-papers-seed-title-card-pinned
// @check acceptance-check:graph-neighbor-papers-two-axes-separated
// @check acceptance-check:graph-neighbor-papers-adjacency-count-shown
// @check acceptance-check:graph-neighbor-papers-paginated-window
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @check acceptance-check:graph-neighbor-papers-card-data-hydration
// @promise promise:inline-analysis-auto-run
// @check acceptance-check:inline-analysis-auto-run-different-position-search

import { useEffect, useMemo, useState } from "react";
import type { PaperCore } from "@/app/domain/paper";
import type { GraphNeighborPaperEntry } from "@/app/domain/research-route-payload";
import { SEARCH_RESULTS_INITIAL_VISIBLE_COUNT } from "@/app/lib/constants";
import { t } from "@/app/i18n/message-access";
import { SearchResultItem } from "./search-result-item";
import type { SearchResultCardAnalyticsContext } from "./search-result-analytics";
import {
  type FollowupActivationEvent,
  type SearchTermFollowupHandler,
  buildPaperExternalUrl,
  formatPaperAuthors,
} from "./search-view.helpers";
import type { AnalysisProgressState, AnalysisResult } from "@/app/lib/inline-analysis";

export type GraphNeighborAxis = "coCited" | "coupled";

export interface GraphNeighborSectionProps {
  ownerPrincipalId: string;
  documentId: string;
  analyticsContext: Pick<SearchResultCardAnalyticsContext, "journeyContextId" | "searchContextId">;
  axis: GraphNeighborAxis;
  title: string;
  guide: string;
  entries: GraphNeighborPaperEntry[];
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
  isHydratingDetails?: boolean;
  sourceSurface?: SearchResultCardAnalyticsContext["sourceSurface"];
  onOpenCitationLineage: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onSearchTerm?: SearchTermFollowupHandler;
  onVisiblePaperIdsChange?: (sectionId: string, paperIds: readonly string[]) => void;
}

export function GraphNeighborSection({
  ownerPrincipalId,
  documentId,
  analyticsContext,
  axis,
  title,
  guide,
  entries,
  analysisProgressMap,
  analysisMap,
  citationLineageLoadingPaperId,
  graphNeighborsLoadingPaperId,
  isHydratingDetails = false,
  sourceSurface = "citation_lineage",
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onSearchTerm,
  onVisiblePaperIdsChange,
}: GraphNeighborSectionProps) {
  // 검색 결과 window와 같은 정책: 처음 10편만 보이고 더보기로 +10씩 펼친다.
  const [visibleCount, setVisibleCount] = useState(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
  const visibleEntries = useMemo(() => entries.slice(0, visibleCount), [entries, visibleCount]);
  const hasMore = entries.length > visibleCount;
  const visiblePaperIds = useMemo(
    () => visibleEntries.map((entry) => entry.paper.paperId),
    [visibleEntries],
  );

  useEffect(() => {
    onVisiblePaperIdsChange?.(axis, visiblePaperIds);
    return () => {
      onVisiblePaperIdsChange?.(axis, []);
    };
  }, [axis, onVisiblePaperIdsChange, visiblePaperIds]);

  return (
    <div className="mb-6">
      <div className="mb-3">
        <h2 className="lh-type-section-heading lh-tone-primary">{title}</h2>
        <p className="lh-type-metadata lh-tone-secondary mt-1">{guide}</p>
      </div>
      <div className="space-y-3">
        {visibleEntries.map((entry, index) => {
          const signal =
            axis === "coCited"
              ? t("search.label.graph-neighbors.coCitedSignal", {
                  count: entry.shared.toLocaleString(),
                })
              : t("search.label.graph-neighbors.coupledSignal", {
                  count: entry.shared.toLocaleString(),
                });
          return (
            <div key={entry.paper.paperId}>
              <span className="lh-chip lh-type-micro mb-1 inline-flex">{signal}</span>
              <SearchResultItem
                paper={entry.paper}
                isLast={index === visibleEntries.length - 1}
                analyticsContext={{
                  ownerPrincipalId,
                  documentId,
                  journeyContextId: analyticsContext.journeyContextId,
                  searchContextId: analyticsContext.searchContextId,
                  resultRank: index + 1,
                  rankBucket: index < 3 ? "top_3" : index < 10 ? "top_10" : "below_10",
                  totalResultCount: entries.length,
                  visibleResultCount: visibleEntries.length,
                  sourceSurface,
                }}
                analysisState={analysisProgressMap.get(entry.paper.paperId)}
                analysisResult={analysisMap.get(entry.paper.paperId)}
                isCitationLineageLoading={citationLineageLoadingPaperId === entry.paper.paperId}
                isGraphNeighborsLoading={graphNeighborsLoadingPaperId === entry.paper.paperId}
                isHydratingDetails={isHydratingDetails}
                onOpenCitationLineage={onOpenCitationLineage}
                onOpenGraphNeighbors={onOpenGraphNeighbors}
                onFindSimilar={onFindSimilar}
                onSearchTerm={onSearchTerm}
              />
            </div>
          );
        })}
        {hasMore && (
          <div className="pt-4">
            <button
              type="button"
              onClick={() => {
                setVisibleCount((current) => current + SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
              }}
              className="lh-control lh-type-control-label border-border-subtle bg-surface-panel rounded-lh-sm w-full border px-4 py-3"
            >
              {t("search.label.search-view-content.loadMore", {
                visible: visibleEntries.length,
                total: entries.length,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * citation_lineage / graph_neighbors seed 논문 카드. 반복 후보 목록의 paper card가
 * 아니므로 검색 결과 리스트 카드 통일 정책의 대상이 아니다.
 */
export function GraphNeighborSeedPaperCard({
  seedPaper,
  kicker,
  seedGuide,
}: {
  seedPaper: PaperCore;
  kicker: string;
  seedGuide: string;
}) {
  const metaParts = [
    seedPaper.authors.length > 0 ? formatPaperAuthors(seedPaper.authors) : null,
    seedPaper.year ? String(seedPaper.year) : null,
    seedPaper.citationCount > 0
      ? t("search.label.search-result-item.citationCount", {
          count: seedPaper.citationCount.toLocaleString(),
        })
      : null,
  ].filter((part): part is string => part != null);

  // 글로벌 검색바가 모든 라우트 상단을 점유하므로, seed context header는 그 아래
  // 가벼운 sub-header로 읽혀야 한다. sticky·배경형 문법·짧은 안내는 계약상 유지하되
  // (citation-lineage / graph-neighbor seed-title-card-pinned), 제목 크기·여백을 줄이고
  // 저자·연도·인용 수를 한 줄로 합쳐 두 번째 header band의 세로 무게를 낮춘다.
  return (
    <div
      className="bg-surface-research/95 border-border-subtle sticky top-0 z-20 mb-4 border-b px-1 py-2.5 backdrop-blur"
      data-testid="relationship-seed-title-card"
    >
      <p className="lh-kicker">{kicker}</p>
      <a
        href={buildPaperExternalUrl(seedPaper.paperId, seedPaper.url)}
        target="_blank"
        rel="noopener noreferrer"
        className="lh-type-paper-title lh-tone-primary hover:text-accent mt-1 block"
        title={t("search.label.citation-lineage.openPaperPage")}
      >
        {seedPaper.title}
      </a>
      {metaParts.length > 0 && (
        <p className="lh-type-metadata lh-tone-secondary mt-1">{metaParts.join(" · ")}</p>
      )}
      <p className="lh-type-metadata lh-tone-secondary mt-1.5">{seedGuide}</p>
    </div>
  );
}

export interface GraphAxesBlockProps {
  ownerPrincipalId: string;
  documentId: string;
  analyticsContext: GraphNeighborSectionProps["analyticsContext"];
  coCited: GraphNeighborPaperEntry[];
  coupled: GraphNeighborPaperEntry[];
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
  isHydratingDetails?: boolean;
  sourceSurface?: SearchResultCardAnalyticsContext["sourceSurface"];
  onOpenCitationLineage: GraphNeighborSectionProps["onOpenCitationLineage"];
  onOpenGraphNeighbors: GraphNeighborSectionProps["onOpenGraphNeighbors"];
  onFindSimilar: GraphNeighborSectionProps["onFindSimilar"];
  onSearchTerm: GraphNeighborSectionProps["onSearchTerm"];
  onVisiblePaperIdsChange?: GraphNeighborSectionProps["onVisiblePaperIdsChange"];
}

/**
 * 그래프 두 축(co-cited / coupled)을 렌더한다. 두 축 모두 비어 있으면 정직한 "없음"
 * 안내를 보여 준다 (provider 실패 degraded는 호출 view가 별도로 처리한다).
 * graph_neighbors view가 이 축과 설명 충분성 경계를 소유한다.
 */
export function GraphAxesBlock({
  ownerPrincipalId,
  documentId,
  analyticsContext,
  coCited,
  coupled,
  analysisProgressMap,
  analysisMap,
  citationLineageLoadingPaperId,
  graphNeighborsLoadingPaperId,
  isHydratingDetails = false,
  sourceSurface = "graph_neighbors",
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onSearchTerm,
  onVisiblePaperIdsChange,
}: GraphAxesBlockProps) {
  if (coCited.length === 0 && coupled.length === 0) {
    return (
      <div className="lh-panel-muted lh-type-metadata lh-tone-secondary mb-6 px-4 py-3">
        {t("search.label.graph-neighbors.empty")}
      </div>
    );
  }

  return (
    <>
      {coCited.length > 0 && (
        <GraphNeighborSection
          axis="coCited"
          ownerPrincipalId={ownerPrincipalId}
          documentId={documentId}
          analyticsContext={analyticsContext}
          title={t("search.label.graph-neighbors.coCited", { count: coCited.length })}
          guide={t("search.label.graph-neighbors.coCitedGuide")}
          entries={coCited}
          analysisProgressMap={analysisProgressMap}
          analysisMap={analysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          isHydratingDetails={isHydratingDetails}
          sourceSurface={sourceSurface}
          onOpenCitationLineage={onOpenCitationLineage}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
          onSearchTerm={onSearchTerm}
          onVisiblePaperIdsChange={onVisiblePaperIdsChange}
        />
      )}
      {coupled.length > 0 && (
        <GraphNeighborSection
          axis="coupled"
          ownerPrincipalId={ownerPrincipalId}
          documentId={documentId}
          analyticsContext={analyticsContext}
          title={t("search.label.graph-neighbors.coupled", { count: coupled.length })}
          guide={t("search.label.graph-neighbors.coupledGuide")}
          entries={coupled}
          analysisProgressMap={analysisProgressMap}
          analysisMap={analysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          isHydratingDetails={isHydratingDetails}
          sourceSurface={sourceSurface}
          onOpenCitationLineage={onOpenCitationLineage}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
          onSearchTerm={onSearchTerm}
          onVisiblePaperIdsChange={onVisiblePaperIdsChange}
        />
      )}
    </>
  );
}
