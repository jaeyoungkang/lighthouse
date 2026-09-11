"use client";

// @promise promise:inline-analysis-auto-run
// @promise promise:search-results-fast-window
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @promise promise:similar-papers-discovery
// @promise promise:delegate-deep-read-to-moonlight
// @promise promise:search-result-library-add
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:paper-card-action-loading-feedback
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-title-year-summary
// @check acceptance-check:search-results-fast-window-card-triage-metadata
// @check acceptance-check:search-results-fast-window-library-proximity-marker
// @check acceptance-check:search-results-fast-window-card-inspection
// @check acceptance-check:citation-lineage-entry-point-counts-visible
// @check acceptance-check:graph-neighbor-papers-search-card-entry
// @check acceptance-check:inline-analysis-auto-run-visible-first-priority
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
// @check acceptance-check:inline-analysis-auto-run-evidence-limit-preview
// @check acceptance-check:similar-papers-discovery-author-topic-search
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback
// @check acceptance-check:search-result-library-add-card-action

import { memo, useId, useState, type MouseEvent } from "react";
import type { PaperCore } from "@/app/domain/paper";
import { isEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import { t } from "@/app/i18n/message-access";
import { buildDoiUrl } from "@/app/lib/doi";
import {
  trackCitationLineageOpened,
  trackPaperPdfOpened,
  trackSimilarPapersOpened,
} from "@/app/lib/track";
import { trackSearchResultInspectedFromCard } from "./search-view.analytics";
import {
  type FollowupActivationEvent,
  type SearchResultBasisBadgeViewModel,
  type SearchTermFollowupHandler,
} from "./search-view.helpers";
import { InlineAnalysis } from "./search-result-inline-analysis";
import {
  PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS,
  SearchResultAnalysisStateFrame,
  SearchResultDetailsLoadingFrame,
  SearchResultEvidenceLimitFrame,
} from "./search-result-generated-content";
import { LibraryActionButton, SimilarPaperActionButton } from "./search-result-item-actions";
import {
  buildCardMetadata,
  resolvePaperEvidenceAvailability,
  type CardMetadata,
  type PdfOpenElement,
  type PdfOpenTarget,
  type SearchResultCardAnalyticsContext,
} from "./search-result-analytics";
import {
  buildMoonlightFileUrl,
  getDirectPdfUrl,
  getAnalysisStatusBadge,
  hasDirectPdfUrl,
} from "./search-view.helpers";
import type { AnalysisProgressState, AnalysisResult } from "@/app/lib/inline-analysis";
import {
  LoadingRing,
  PAPER_CARD_TITLE_SCAN_ROW_CLASS,
  PAPER_CARD_TITLE_UTILITY_RAIL_CLASS,
  PdfActionIcon,
  SearchResultBasisBadge,
  SearchResultMetadata,
} from "./search-result-item.shared";
import { SearchResultAuthorRow } from "./search-result-author-row";

export interface SearchResultItemProps {
  paper: PaperCore;
  isLast: boolean;
  analyticsContext?: SearchResultCardAnalyticsContext;
  analysisState?: AnalysisProgressState;
  analysisResult?: AnalysisResult;
  isAnyPaperOpening?: boolean;
  isOpening?: boolean;
  isCitationLineageLoading?: boolean;
  isGraphNeighborsLoading?: boolean;
  isHighlighted?: boolean;
  isHydratingDetails?: boolean;
  isInLibrary?: boolean;
  isLibraryActionPending?: boolean;
  isRepresentative?: boolean;
  basisBadge?: SearchResultBasisBadgeViewModel | null;
  pdfOpenMode?: "arxivLightHouseOnly" | "documentDirect";
  onOpenPdf?: (
    paper: PaperCore,
    analyticsContext?: SearchResultCardAnalyticsContext,
    openElement?: PdfOpenElement,
    openTarget?: PdfOpenTarget,
  ) => void;
  onOpenCitationLineage?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onToggleLibrary?: (paper: PaperCore, context?: SearchResultCardAnalyticsContext) => void;
  onSearchTerm?: SearchTermFollowupHandler;
}

function CitationLineageCountButton({
  label,
  title,
  isLoading,
  onClick,
}: {
  label: string;
  title?: string;
  isLoading?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onAuxClick={(event) => {
        if (event.button === 1) onClick(event);
      }}
      disabled={isLoading}
      className="lh-chip lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors disabled:opacity-40"
      title={title ?? t("search.label.search-result-item.citationLineage")}
    >
      {isLoading ? (
        <span
          className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : null}
      {label}
    </button>
  );
}

function SearchResultDoiAction({ doi }: { doi: string | null | undefined }) {
  const normalizedDoi = doi?.trim();
  const className =
    "lh-chip lh-card-action lh-type-compact-control inline-flex w-14 shrink-0 items-center justify-center whitespace-nowrap transition-colors";

  if (!normalizedDoi) {
    return (
      <button
        type="button"
        disabled
        className={`${className} disabled:opacity-40`}
        data-testid="search-result-doi-action"
        data-doi-availability="unavailable"
      >
        DOI
      </button>
    );
  }

  return (
    <a
      href={buildDoiUrl(normalizedDoi)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} hover:border-accent hover:text-accent`}
      data-testid="search-result-doi-action"
      data-doi-availability="available"
    >
      DOI
    </a>
  );
}

function CitationLineageControl({
  paper,
  show,
  hasCitationData,
  hasLimitedReferenceList,
  label,
  title,
  referenceTitle,
  isLoading,
  onActivate,
  onOpenCitationLineage,
}: {
  paper: PaperCore;
  show: boolean;
  hasCitationData: boolean;
  hasLimitedReferenceList: boolean;
  label: string;
  title?: string;
  referenceTitle?: string;
  isLoading?: boolean;
  onActivate?: () => void;
  onOpenCitationLineage?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
}) {
  if (!show) return null;

  if (hasCitationData) {
    return (
      <CitationLineageCountButton
        label={label}
        title={title}
        isLoading={isLoading}
        onClick={(event) => {
          if (onOpenCitationLineage?.(paper, event)) onActivate?.();
        }}
      />
    );
  }

  if (hasLimitedReferenceList) {
    return (
      <button
        type="button"
        onClick={(event) => {
          if (onOpenCitationLineage?.(paper, event)) onActivate?.();
        }}
        onAuxClick={(event) => {
          if (event.button === 1) {
            if (onOpenCitationLineage?.(paper, event)) onActivate?.();
          }
        }}
        className="lh-chip lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors disabled:opacity-40"
        title={referenceTitle}
      >
        인용 계보
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled
      className="lh-chip lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors disabled:opacity-40"
      title={t("search.label.search-result-item.citationLineage.disabled")}
    >
      {t("search.label.search-result-item.citationLineage.disabled")}
    </button>
  );
}

function SearchResultPdfAction({
  paper,
  canOpenPdf,
  isHydratingDetails,
  moonlightPdfUrl,
  onTrackMoonlightHandoff,
}: {
  paper: PaperCore;
  canOpenPdf: boolean;
  isHydratingDetails: boolean;
  moonlightPdfUrl: string | null;
  onTrackMoonlightHandoff: (openElement: "pdf_button") => void;
}) {
  if (canOpenPdf && moonlightPdfUrl) {
    return (
      <a
        href={moonlightPdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="lh-chip lh-chip-accent lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors"
        title={t("search.label.search-result-item.openPdf")}
        aria-label={t("search.label.search-result-item.3", { title: paper.title })}
        onClick={() => {
          onTrackMoonlightHandoff("pdf_button");
        }}
        onAuxClick={(event) => {
          if (event.button === 1) onTrackMoonlightHandoff("pdf_button");
        }}
      >
        <PdfActionIcon kind="external" />
        PDF
      </a>
    );
  }

  if (isHydratingDetails) {
    return (
      <span
        className="lh-chip lh-card-action lh-type-compact-control lh-tone-secondary inline-flex items-center gap-1 opacity-75 transition-colors"
        title={t("search.label.search-result-item.checkingPdf")}
      >
        <LoadingRing />
        {t("search.label.search-result-item.checkingPdf")}
      </span>
    );
  }

  return (
    <button
      disabled
      className="lh-chip lh-chip-accent lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors disabled:opacity-40"
      title={t("search.label.search-result-item.2")}
      aria-label={t("search.label.search-result-item.4", { title: paper.title })}
    >
      <PdfActionIcon kind="document" />
      PDF
    </button>
  );
}

function buildCitationLineageState(paper: PaperCore) {
  const loadedReferenceCount = paper.referenceIds?.length ?? 0;
  const loadedCitationCount = paper.citationIds?.length ?? 0;
  const referenceCount = paper.referenceCount ?? loadedReferenceCount;
  const citationCount = loadedCitationCount > 0 ? loadedCitationCount : paper.citationCount;
  const hasLimitedReferenceList =
    loadedReferenceCount === 0 &&
    referenceCount > 0 &&
    (paper.referenceAvailability?.truncated !== false || !paper.referenceAvailability.available);
  const hasCitationData =
    loadedReferenceCount > 0 ||
    loadedCitationCount > 0 ||
    referenceCount > 0 ||
    citationCount > 0 ||
    paper.referenceAvailability?.available === false ||
    paper.citationAvailability?.available === false;

  return {
    citationCount,
    referenceCount,
    hasCitationData,
    hasLimitedReferenceList,
  };
}

function canOpenGraphNeighborsForPaper(paper: PaperCore): boolean {
  return isEpisteme3PaperRef(paper.paperId);
}

function getSimilarPaperAction(params: {
  paper: PaperCore;
  hasGraphHandler: boolean;
  hasFallbackHandler: boolean;
}): "graph" | "fallback" | null {
  if (params.hasGraphHandler && canOpenGraphNeighborsForPaper(params.paper)) return "graph";
  if (params.hasFallbackHandler) return "fallback";
  return null;
}

function getAnalysisPresentationState(
  state: AnalysisProgressState | undefined,
  result: AnalysisResult | undefined,
): AnalysisProgressState | undefined {
  if (result) return "done";
  if (state === "done") return "error";
  return state;
}

function isCardInspectionSurface(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !target.closest(
    "a, button, input, select, textarea, [role='button'], [contenteditable='true']",
  );
}

function SearchResultGeneratedContent({
  paper,
  analysisState,
  analysisResult,
  isHydratingDetails,
  analyticsContext,
  inspectionExpanded,
  inspectionPanelId,
  onToggleInspection,
  onSearchTerm,
}: Pick<
  SearchResultItemProps,
  "paper" | "analysisState" | "analysisResult" | "isHydratingDetails" | "analyticsContext"
> & {
  inspectionExpanded: boolean;
  inspectionPanelId: string;
  onToggleInspection: () => void;
  onSearchTerm?: SearchTermFollowupHandler;
}) {
  if (analysisResult) {
    return (
      <InlineAnalysis
        analysis={analysisResult.analysis}
        source={analysisResult.source}
        paper={paper}
        analyticsContext={analyticsContext}
        detailExpanded={inspectionExpanded}
        panelId={inspectionPanelId}
        onToggleDetail={onToggleInspection}
        onSearchTerm={onSearchTerm}
      />
    );
  }
  const disclosureProps = {
    expanded: inspectionExpanded,
    controlsId: inspectionPanelId,
    onToggle: onToggleInspection,
  };
  if (isHydratingDetails) {
    return <SearchResultDetailsLoadingFrame paper={paper} {...disclosureProps} />;
  }
  if (analysisState) {
    return (
      <SearchResultAnalysisStateFrame paper={paper} state={analysisState} {...disclosureProps} />
    );
  }
  return <SearchResultEvidenceLimitFrame paper={paper} {...disclosureProps} />;
}

export const SearchResultItem = memo(function SearchResultItem({
  paper,
  isLast,
  analyticsContext,
  analysisState,
  analysisResult,
  isCitationLineageLoading,
  isGraphNeighborsLoading,
  isHighlighted = false,
  isHydratingDetails = false,
  isInLibrary = false,
  isLibraryActionPending = false,
  isRepresentative = false,
  basisBadge,
  onOpenCitationLineage,
  onOpenGraphNeighbors,
  onFindSimilar,
  onToggleLibrary,
  onSearchTerm,
}: SearchResultItemProps) {
  const [inspectionExpanded, setInspectionExpanded] = useState(false);
  const inspectionInstanceId = useId();
  const pdfUrl = getDirectPdfUrl(paper);
  const canOpenPdf = hasDirectPdfUrl(paper);
  const moonlightPdfUrl = buildMoonlightFileUrl(pdfUrl);
  const cardMetadata = buildCardMetadata(paper, canOpenPdf);
  const inspectionPanelId = `paper-inspection-${paper.paperId.replace(/[^A-Za-z0-9_-]/g, "-")}-${inspectionInstanceId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
  const titleTextId = `${inspectionPanelId}-title`;

  const trackMoonlightHandoff = (openElement: "pdf_button") => {
    if (!analyticsContext || !canOpenPdf || !moonlightPdfUrl) return;
    trackPaperPdfOpenedFromCard(paper, analyticsContext, cardMetadata, openElement);
  };
  const trackPaperFollowup = (type: "citation_lineage_open" | "similar_papers_discovery") => {
    if (!analyticsContext) return;
    const shared = {
      ownerPrincipalId: analyticsContext.ownerPrincipalId,
      documentId: analyticsContext.documentId,
      journeyContextId: analyticsContext.journeyContextId,
      searchContextId: analyticsContext.searchContextId,
      paperId: paper.paperId,
      title: paper.title,
      resultRank: analyticsContext.resultRank,
      sourceSurface: analyticsContext.sourceSurface ?? "search_results",
      hasPdf: cardMetadata.hasPdf,
      evidenceAvailability: resolvePaperEvidenceAvailability(paper),
    };
    if (type === "citation_lineage_open") {
      trackCitationLineageOpened({
        type,
        data: {
          ...shared,
          referenceCount: cardMetadata.referenceCount,
          citationCount: cardMetadata.citationCount,
        },
      });
      return;
    }
    trackSimilarPapersOpened({ type, data: shared });
  };
  const toggleInspection = () => {
    if (!inspectionExpanded && analyticsContext) {
      trackSearchResultInspectedFromCard({
        paper,
        analyticsContext,
        cardMetadata,
      });
    }
    setInspectionExpanded((prev) => !prev);
  };

  const showCitationLineageButton = Boolean(onOpenCitationLineage);
  const similarPaperAction = getSimilarPaperAction({
    paper,
    hasGraphHandler: Boolean(onOpenGraphNeighbors),
    hasFallbackHandler: Boolean(onFindSimilar),
  });
  const { citationCount, referenceCount, hasCitationData, hasLimitedReferenceList } =
    buildCitationLineageState(paper);
  const referenceTitle = hasLimitedReferenceList
    ? t("search.label.search-result-item.citationLineage.referencesLimitedTitle")
    : undefined;
  const citationLineageLabel =
    citationCount > 0
      ? t("search.label.search-result-item.citationLineage.citations", {
          count: citationCount,
        })
      : t("search.label.search-result-item.citationLineage.lineage");
  const citationLineageTitle =
    referenceCount > 0
      ? t("search.label.search-result-item.citationLineage.lineageWithReferences", {
          count: referenceCount,
        })
      : t("search.label.search-result-item.citationLineage");
  const analysisPresentationState = getAnalysisPresentationState(analysisState, analysisResult);

  return (
    <div data-paper-id={paper.paperId} className={`relative ${isLast ? "" : "pb-px"}`}>
      <div
        className={`border-b px-2 py-4 transition-colors sm:px-3 ${PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS} cursor-pointer ${
          isHighlighted
            ? "border-accent bg-accent-soft/24 ring-accent/20 ring-1"
            : "border-sidebar-border/60 hover:bg-surface-panel/45 bg-transparent"
        }`}
        data-testid="search-result-card"
        data-card-expandable="true"
        onClick={(event) => {
          if (isCardInspectionSurface(event.target)) toggleInspection();
        }}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className={PAPER_CARD_TITLE_SCAN_ROW_CLASS} data-testid="search-result-title-row">
              <span
                className="lh-type-paper-title lh-tone-primary inline-flex min-w-0 flex-1 text-left"
                data-testid="search-result-title"
              >
                <span
                  id={titleTextId}
                  className={`min-w-0 ${inspectionExpanded ? "" : "line-clamp-1"}`}
                  data-testid="search-result-title-text"
                >
                  {paper.title}
                </span>
              </span>
              {basisBadge || isRepresentative || onToggleLibrary ? (
                <div
                  className={PAPER_CARD_TITLE_UTILITY_RAIL_CLASS}
                  data-testid="search-result-title-utilities"
                >
                  {basisBadge ? <SearchResultBasisBadge badge={basisBadge} /> : null}
                  {isRepresentative ? (
                    <span
                      className="lh-type-metadata border-accent/35 bg-accent-soft/60 text-accent-strong rounded-lh-sm border px-2 py-0.5"
                      data-testid="search-result-representative-badge"
                    >
                      대표
                    </span>
                  ) : null}
                  {onToggleLibrary ? (
                    <LibraryActionButton
                      paper={paper}
                      isInLibrary={isInLibrary}
                      isPending={isLibraryActionPending}
                      onToggleLibrary={(selectedPaper) => {
                        if (analyticsContext) {
                          onToggleLibrary(selectedPaper, analyticsContext);
                        } else {
                          onToggleLibrary(selectedPaper);
                        }
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
            <SearchResultMetadata paper={paper} />
            <SearchResultAuthorRow authors={paper.authors} onSearchTerm={onSearchTerm} />

            <div
              className="mt-2 flex min-h-7 flex-wrap items-center gap-2"
              data-testid="search-result-actions"
            >
              <SearchResultDoiAction doi={paper.doi} />
              <SearchResultPdfAction
                paper={paper}
                canOpenPdf={canOpenPdf}
                isHydratingDetails={isHydratingDetails}
                moonlightPdfUrl={moonlightPdfUrl}
                onTrackMoonlightHandoff={trackMoonlightHandoff}
              />
              <CitationLineageControl
                paper={paper}
                show={showCitationLineageButton}
                hasCitationData={hasCitationData}
                hasLimitedReferenceList={hasLimitedReferenceList}
                label={citationLineageLabel}
                title={citationLineageTitle}
                referenceTitle={referenceTitle}
                isLoading={isCitationLineageLoading}
                onActivate={() => {
                  trackPaperFollowup("citation_lineage_open");
                }}
                onOpenCitationLineage={onOpenCitationLineage}
              />
              <SimilarPaperActionButton
                action={similarPaperAction}
                paper={paper}
                isLoading={isGraphNeighborsLoading}
                onActivate={() => {
                  trackPaperFollowup("similar_papers_discovery");
                }}
                onOpenGraphNeighbors={onOpenGraphNeighbors}
                onFindSimilar={onFindSimilar}
              />
              {analysisPresentationState ? (
                <AnalysisStatusBadge state={analysisPresentationState} />
              ) : null}
            </div>
            <SearchResultGeneratedContent
              paper={paper}
              analysisState={analysisPresentationState}
              analysisResult={analysisResult}
              isHydratingDetails={isHydratingDetails}
              analyticsContext={analyticsContext}
              inspectionExpanded={inspectionExpanded}
              inspectionPanelId={inspectionPanelId}
              onToggleInspection={toggleInspection}
              onSearchTerm={onSearchTerm}
            />
          </div>
        </div>
      </div>
    </div>
  );
});

function AnalysisStatusBadge({ state }: { state: AnalysisProgressState }) {
  const badge = getAnalysisStatusBadge(state);

  return (
    <span className={badge.className}>
      {badge.showSpinner && (
        <span
          className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {badge.label}
    </span>
  );
}

function trackPaperPdfOpenedFromCard(
  paper: PaperCore,
  analyticsContext: SearchResultCardAnalyticsContext,
  cardMetadata: CardMetadata,
  openElement: "pdf_button",
) {
  trackPaperPdfOpened({
    type: "paper_pdf_open",
    data: {
      ownerPrincipalId: analyticsContext.ownerPrincipalId,
      documentId: analyticsContext.documentId,
      journeyContextId: analyticsContext.journeyContextId,
      searchContextId: analyticsContext.searchContextId,
      paperId: paper.paperId,
      title: paper.title,
      openTarget: "moonlight_external",
      openElement,
      resultRank: analyticsContext.resultRank,
      rankBucket: analyticsContext.rankBucket,
      totalResultCount: analyticsContext.totalResultCount,
      visibleResultCount: analyticsContext.visibleResultCount,
      hasPdf: cardMetadata.hasPdf,
      year: cardMetadata.year,
      citationCount: cardMetadata.citationCount,
      referenceCount: cardMetadata.referenceCount,
      authorCount: cardMetadata.authorCount,
      queryHash: analyticsContext.queryHash,
      sort: analyticsContext.sort,
      yearFilter: analyticsContext.yearFilter,
      sourceSurface: analyticsContext.sourceSurface,
      evidenceAvailability: resolvePaperEvidenceAvailability(paper),
    },
  });
}
