"use client";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:paper-card-list-windowing
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:document-content-width-governance
// @aspect aspect:ai-comment-research-term-suggestions
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:citation-lineage-seed-title-card-pinned
// @check acceptance-check:graph-neighbor-papers-two-axes-separated
// @check acceptance-check:graph-neighbor-papers-adjacency-count-shown
// @check acceptance-check:graph-neighbor-papers-graph-failure-degraded
// @check acceptance-check:graph-neighbor-papers-paginated-window
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback
// @check acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
// @promise promise:inline-analysis-auto-run
// @check acceptance-check:inline-analysis-auto-run-different-position-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { PaperCore } from "@/app/domain/paper";
import type { CitationLineageMetadata } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { SEARCH_RESULTS_INITIAL_VISIBLE_COUNT } from "@/app/lib/constants";
import { RESEARCH_ROUTE_BODY_RAIL_CLASS } from "@/app/components/research/research-route-layout.shared";
import { SearchResultItem } from "./search-result-item";
import { GraphNeighborSeedPaperCard } from "./graph-neighbor-section";
import { splitPapersByCitationDirection } from "./citation-lineage.helpers";
import {
  type FollowupActivationEvent,
  buildPaperExternalUrl,
  type SearchTermFollowupHandler,
} from "./search-view.helpers";
import type { AnalysisProgressState, AnalysisResult } from "@/app/lib/inline-analysis";
import { InlineAiCommentFrame } from "@/app/components/research/inline-ai-comment-frame";
import { SearchResultsResearchTermLinks } from "@/app/components/research/search-results-overview-panel";
import {
  buildRelationshipResearchTermsBlock,
  type SearchResultsOverviewTerm,
} from "@/app/components/research/search-results-overview-model";
import { commitSearchResultsOverviewTerm } from "./search-results-overview-actions";
import {
  useSearchJourneyAnalyticsContext,
  type SearchJourneyAnalyticsContext,
} from "@/app/components/research/search-followup-activation";

interface CitationLineageResultsStateProps {
  ownerPrincipalId: string;
  documentId: string;
  metadata: CitationLineageMetadata;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
  onOpenCitationLineage: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onSearchTerm?: SearchTermFollowupHandler;
  onOpenGapNetwork?: () => void;
  onVisiblePaperIdsChange?: (sectionId: string, paperIds: readonly string[]) => void;
  reactionSlot?: ReactNode;
}

function buildDoiUrl(doi: string | null | undefined): string | null {
  if (!doi) return null;
  const trimmed = doi.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://doi.org/${trimmed}`;
}

function isProviderLimitedDirection(availability: PaperCore["referenceAvailability"] | undefined) {
  return availability?.available === false || availability?.truncated === true;
}

function ReferencesEmptyState({
  seedPaper,
  referenceAvailability,
}: {
  seedPaper: PaperCore;
  referenceAvailability?: PaperCore["referenceAvailability"] | null;
}) {
  const referenceCount = seedPaper.referenceCount ?? null;
  const paperExternalUrl = buildPaperExternalUrl(seedPaper.paperId, seedPaper.url);
  const doiUrl = buildDoiUrl(seedPaper.doi);
  const availability = referenceAvailability ?? seedPaper.referenceAvailability ?? null;
  const reportedTotal = availability?.total ?? referenceCount;
  const isLimited = isProviderLimitedDirection(availability);

  const message =
    isLimited && reportedTotal && reportedTotal > 0
      ? t("search.label.citation-lineage.referencesElided", { count: reportedTotal })
      : isLimited
        ? t("search.label.citation-lineage.referencesLimited")
        : referenceCount && referenceCount > 0
          ? t("search.label.citation-lineage.referencesElided", { count: referenceCount })
          : t("search.label.citation-lineage.noReferences");

  return (
    <div className="lh-panel-muted lh-type-metadata lh-tone-secondary mb-6 space-y-2 px-4 py-3">
      <p>{message}</p>
      <p className="lh-type-control-label flex flex-wrap gap-3">
        <a
          href={paperExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-strong underline"
        >
          {t("search.label.citation-lineage.openPaperPage")}
        </a>
        {doiUrl ? (
          <a
            href={doiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-strong underline"
          >
            {t("search.label.citation-lineage.openDoi")}
          </a>
        ) : null}
      </p>
    </div>
  );
}

function CitationsEmptyState({
  seedPaper,
  citationAvailability,
}: {
  seedPaper: PaperCore;
  citationAvailability?: PaperCore["citationAvailability"] | null;
}) {
  const availability = citationAvailability ?? seedPaper.citationAvailability ?? null;
  const isLimited = isProviderLimitedDirection(availability);

  return (
    <div className="lh-panel-muted lh-type-metadata lh-tone-secondary mb-6 px-4 py-3">
      {isLimited
        ? t("search.label.citation-lineage.citationsLimited")
        : t("search.label.citation-lineage.noCitations")}
    </div>
  );
}

function PaperSection({
  ownerPrincipalId,
  documentId,
  analyticsContext,
  sectionId,
  title,
  papers,
  analysisProgressMap,
  analysisMap,
  citationLineageLoadingPaperId,
  graphNeighborsLoadingPaperId,
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onSearchTerm,
  onVisiblePaperIdsChange,
}: {
  ownerPrincipalId: string;
  documentId: string;
  analyticsContext: SearchJourneyAnalyticsContext;
  sectionId: "references" | "citations";
  title: string;
  papers: CitationLineageMetadata["papers"];
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  citationLineageLoadingPaperId: string | null;
  graphNeighborsLoadingPaperId?: string | null;
  onOpenCitationLineage: CitationLineageResultsStateProps["onOpenCitationLineage"];
  onOpenGraphNeighbors: CitationLineageResultsStateProps["onOpenGraphNeighbors"];
  onFindSimilar: CitationLineageResultsStateProps["onFindSimilar"];
  onSearchTerm: CitationLineageResultsStateProps["onSearchTerm"];
  onVisiblePaperIdsChange?: CitationLineageResultsStateProps["onVisiblePaperIdsChange"];
}) {
  const [visibleCount, setVisibleCount] = useState(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
  const visiblePapers = useMemo(() => papers.slice(0, visibleCount), [papers, visibleCount]);
  const hasMore = papers.length > visibleCount;
  const visiblePaperIds = useMemo(
    () => visiblePapers.map((paper) => paper.paperId),
    [visiblePapers],
  );

  useEffect(() => {
    onVisiblePaperIdsChange?.(sectionId, visiblePaperIds);
    return () => {
      onVisiblePaperIdsChange?.(sectionId, []);
    };
  }, [onVisiblePaperIdsChange, sectionId, visiblePaperIds]);

  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="lh-type-section-heading lh-tone-primary">{title}</h2>
      </div>
      <div className="space-y-3">
        {visiblePapers.map((paper, index) => (
          <SearchResultItem
            key={paper.paperId}
            paper={paper}
            isLast={index === visiblePapers.length - 1}
            analyticsContext={{
              ownerPrincipalId,
              documentId,
              journeyContextId: analyticsContext.journeyContextId,
              searchContextId: analyticsContext.searchContextId,
              resultRank: index + 1,
              rankBucket: index < 3 ? "top_3" : index < 10 ? "top_10" : "below_10",
              totalResultCount: papers.length,
              visibleResultCount: visiblePapers.length,
              sourceSurface: "citation_lineage",
            }}
            analysisState={analysisProgressMap.get(paper.paperId)}
            analysisResult={analysisMap.get(paper.paperId)}
            isCitationLineageLoading={citationLineageLoadingPaperId === paper.paperId}
            isGraphNeighborsLoading={graphNeighborsLoadingPaperId === paper.paperId}
            onOpenCitationLineage={onOpenCitationLineage}
            onOpenGraphNeighbors={onOpenGraphNeighbors}
            onFindSimilar={onFindSimilar}
            onSearchTerm={onSearchTerm}
          />
        ))}
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
                visible: visiblePapers.length,
                total: papers.length,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CitationLineageResultsState({
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
  onOpenGapNetwork,
  reactionSlot,
}: CitationLineageResultsStateProps) {
  const analyticsContext = useSearchJourneyAnalyticsContext(documentId);
  const seedPaper = metadata.seedPaper;
  const sourceQuery = seedPaper.title;
  const { references, citations } = useMemo(
    () => splitPapersByCitationDirection(metadata),
    [metadata],
  );
  const hasGapNetworkInput = references.length + citations.length > 0;
  const researchTermsBlock = buildRelationshipResearchTermsBlock({
    documentType: "citation_lineage",
    papers: [seedPaper, ...references, ...citations],
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
      sourceResearchRouteKind: "citation_lineage",
      onSearchTerm,
      event,
    });
  };

  return (
    <div className={RESEARCH_ROUTE_BODY_RAIL_CLASS} data-testid="citation-lineage-content-rail">
      <GraphNeighborSeedPaperCard
        seedPaper={seedPaper}
        kicker={t("search.label.citation-lineage.kicker")}
        seedGuide={t("search.label.citation-lineage.seedGuide")}
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

      {references.length > 0 ? (
        <PaperSection
          ownerPrincipalId={ownerPrincipalId}
          documentId={documentId}
          analyticsContext={analyticsContext}
          sectionId="references"
          title={t("search.label.citation-lineage.references", { count: references.length })}
          papers={references}
          analysisProgressMap={analysisProgressMap}
          analysisMap={analysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          onOpenCitationLineage={onOpenCitationLineage}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
          onSearchTerm={onSearchTerm}
          onVisiblePaperIdsChange={onVisiblePaperIdsChange}
        />
      ) : (
        <ReferencesEmptyState
          seedPaper={seedPaper}
          referenceAvailability={metadata.referenceAvailability}
        />
      )}

      {citations.length > 0 ? (
        <PaperSection
          ownerPrincipalId={ownerPrincipalId}
          documentId={documentId}
          analyticsContext={analyticsContext}
          sectionId="citations"
          title={t("search.label.citation-lineage.citations", { count: citations.length })}
          papers={citations}
          analysisProgressMap={analysisProgressMap}
          analysisMap={analysisMap}
          citationLineageLoadingPaperId={citationLineageLoadingPaperId}
          graphNeighborsLoadingPaperId={graphNeighborsLoadingPaperId}
          onOpenCitationLineage={onOpenCitationLineage}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
          onSearchTerm={onSearchTerm}
          onVisiblePaperIdsChange={onVisiblePaperIdsChange}
        />
      ) : (
        <CitationsEmptyState
          seedPaper={seedPaper}
          citationAvailability={metadata.citationAvailability}
        />
      )}
    </div>
  );
}
