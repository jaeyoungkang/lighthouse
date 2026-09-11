"use client";

// @promise promise:inline-analysis-auto-run
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy

import type { MouseEvent } from "react";
import type { PaperCore } from "@/app/domain/paper";
import { AiContentFeedback } from "@/app/components/ai-content-feedback";
import { t } from "@/app/i18n/message-access";
import { buildQueryAnalyticsMetadata } from "@/app/lib/analytics/query-hash";
import { trackDifferentPositionSearchClicked } from "@/app/lib/track";
import type { SearchTermFollowupHandler } from "./search-view.helpers";
import type { AnalysisResult } from "@/app/lib/inline-analysis";
import type { SearchResultCardAnalyticsContext } from "./search-result-analytics";
import {
  PAPER_GENERATED_CONTENT_REGION_CLASS,
  PaperCardDisclosureSurface,
  PaperSourceLinks,
} from "./search-result-generated-content";

export function InlineAnalysis({
  analysis,
  source,
  paper,
  analyticsContext,
  detailExpanded,
  panelId,
  onToggleDetail,
  onSearchTerm,
}: {
  analysis: AnalysisResult["analysis"];
  source?: "abstract";
  paper: PaperCore;
  analyticsContext?: SearchResultCardAnalyticsContext;
  detailExpanded: boolean;
  panelId?: string;
  onToggleDetail?: () => void;
  onSearchTerm?: SearchTermFollowupHandler;
}) {
  const stanceProfile = analysis.stanceProfile;
  const counterSearchQueries = (stanceProfile?.counterSearchQueries ?? []).slice(0, 3);
  const hasCounterSearchQueries = counterSearchQueries.length > 0;
  const limitations = stanceProfile?.limitations ?? null;
  const runDifferentPositionSearch = (
    candidate: (typeof counterSearchQueries)[number],
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (analyticsContext) {
      const queryMetadata = buildQueryAnalyticsMetadata(candidate.query);
      trackDifferentPositionSearchClicked({
        type: "different_position_search",
        data: {
          ownerPrincipalId: analyticsContext.ownerPrincipalId,
          documentId: analyticsContext.documentId,
          paperId: paper.paperId,
          queryHash: queryMetadata.queryHash,
          queryLength: queryMetadata.queryLength,
        },
      });
    }
    onSearchTerm?.(candidate.query, { entry: "position" }, event);
  };

  return (
    <div
      className={`bg-accent-soft/20 rounded-lh-sm relative py-3 pr-3 pl-4 ${PAPER_GENERATED_CONTENT_REGION_CLASS}`}
      data-testid="search-result-inline-analysis"
      data-generated-content-region="paper-card-analysis"
    >
      <span className="bg-accent/55 absolute top-3 bottom-3 left-0 w-0.5 rounded-full" />
      <PaperCardDisclosureSurface
        expanded={detailExpanded}
        controlsId={panelId}
        onToggle={onToggleDetail}
      >
        <div className={`min-w-0 ${detailExpanded ? "space-y-2" : "flex min-h-12 items-center"}`}>
          {source && detailExpanded ? (
            <span
              className="lh-chip lh-chip-warm lh-type-micro inline-flex w-fit rounded-full px-2 py-1 font-medium"
              data-testid="search-result-analysis-source"
            >
              {t("search.label.search-result-item.6")}
            </span>
          ) : null}
          <p
            className={`lh-type-reading-body lh-tone-primary ${
              detailExpanded ? "" : "line-clamp-2 min-w-0"
            }`}
            data-testid="search-result-analysis-summary"
          >
            <span className="font-semibold">{t("search.label.search-result-item.summary")}: </span>
            {analysis.summary}
          </p>
        </div>
      </PaperCardDisclosureSurface>
      <div id={panelId} hidden={!detailExpanded} className="mt-2 space-y-2">
        {detailExpanded ? (
          <>
            <PaperSourceLinks paper={paper} />
            <div>
              <span className="lh-type-metadata lh-tone-secondary font-semibold">주제</span>
              {analysis.semanticProfile.topics.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {analysis.semanticProfile.topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      onClick={(event: MouseEvent<HTMLButtonElement>) => {
                        onSearchTerm?.(topic, undefined, event);
                      }}
                      onAuxClick={(event: MouseEvent<HTMLButtonElement>) => {
                        if (event.button !== 1) return;
                        onSearchTerm?.(topic, undefined, event);
                      }}
                      className="lh-chip lh-card-action lh-type-compact-control hover:border-accent hover:text-accent"
                      title={t("search.label.search-result-item.searchTopic", { topic })}
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="lh-type-reading-body lh-tone-primary mt-1">
                  근거 부족으로 주제를 확정하지 않음
                </p>
              )}
            </div>
            <div>
              <span className="lh-type-metadata lh-tone-secondary font-semibold">방법</span>
              <p className="lh-type-reading-body lh-tone-primary mt-1">
                {renderSemanticField(analysis.semanticProfile.method)}
              </p>
            </div>
            <div>
              <span className="lh-type-metadata lh-tone-secondary font-semibold">결과</span>
              <p className="lh-type-reading-body lh-tone-primary mt-1">
                {renderSemanticField(analysis.semanticProfile.finding)}
              </p>
            </div>
            {hasCounterSearchQueries ? (
              <div
                className="border-border-subtle/70 border-t pt-3"
                data-testid="different-position-section"
              >
                <p
                  className="lh-type-metadata lh-tone-secondary font-semibold"
                  data-testid="different-position-toggle"
                >
                  {t("search.label.search-result-item.differentPosition.toggle")}
                </p>
                {limitations ? (
                  <p
                    className="lh-type-reading-body lh-tone-primary mt-1"
                    data-testid="different-position-limitations"
                  >
                    {limitations}
                  </p>
                ) : null}
                <ul className="mt-2 flex flex-col gap-y-2" data-testid="different-position-panel">
                  {counterSearchQueries.map((candidate) => (
                    <li key={candidate.query}>
                      <button
                        type="button"
                        data-testid="different-position-search-action"
                        className="lh-type-compact-control text-accent hover:text-accent-strong text-left underline decoration-current/35 underline-offset-4 transition-colors hover:decoration-current"
                        title={t("search.label.search-result-item.differentPosition.action")}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                          runDifferentPositionSearch(candidate, event);
                        }}
                        onAuxClick={(event: MouseEvent<HTMLButtonElement>) => {
                          if (event.button !== 1) return;
                          runDifferentPositionSearch(candidate, event);
                        }}
                      >
                        <span className="sr-only">
                          {t("search.label.search-result-item.differentPosition.action")}:
                        </span>
                        {candidate.query}
                      </button>
                      {candidate.rationale ? (
                        <p
                          className="lh-type-metadata lh-tone-secondary mt-0.5"
                          data-testid="different-position-rationale"
                        >
                          {candidate.rationale}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <AiContentFeedback
              target={{
                documentId: null,
                documentType: "search",
                surfaceId: `inline-analysis:${paper.paperId}`,
                surfaceKind: "inline_analysis_detail",
                promiseRef: "promise:inline-analysis-auto-run",
                outputSnapshot: {
                  title: paper.title,
                  body: [
                    analysis.summary,
                    renderSemanticField(analysis.semanticProfile.method),
                    renderSemanticField(analysis.semanticProfile.finding),
                    ...(limitations ? [limitations] : []),
                  ].join("\n"),
                },
                metadata: {
                  paperId: paper.paperId,
                  source: source ?? null,
                },
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function renderSemanticField(value: string | null | undefined) {
  return value && value.trim().length > 0 ? value : t("search.label.search-result-item.9");
}
