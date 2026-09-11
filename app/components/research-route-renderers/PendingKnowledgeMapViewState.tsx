"use client";

// @promise promise:gap-network-detection-from-search
// @promise promise:gap-report-prepared-reaction
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:gap-network-detection-from-search-result-saved-gap-view

import { t } from "@/app/i18n/message-access";
import type { ReactNode } from "react";
import { GRAPH_PROGRESS_STAGES, type GraphProgressStage } from "@/app/lib/graph-progress";
import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";
import { RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS } from "../research/research-route-layout.shared";

interface PendingKnowledgeMapViewStateProps {
  lensLabel: string;
  pendingTitle: string;
  failedTitle: string;
  query: string;
  error: string | null;
  isRetrying: boolean;
  progressView: GraphProgressStage;
  progressStages?: readonly GraphProgressStage[];
  statusError: string | null;
  onRetry: (() => void) | null;
  readyDescription: string;
  contextualNotice?: ReactNode;
}

export function PendingKnowledgeMapViewState(props: PendingKnowledgeMapViewStateProps) {
  const {
    error,
    contextualNotice,
    failedTitle,
    isRetrying,
    lensLabel,
    onRetry,
    pendingTitle,
    progressView,
    progressStages = GRAPH_PROGRESS_STAGES,
    query,
    readyDescription,
    statusError,
  } = props;
  const isLoading = error === null;
  const activeStageIndex = progressStages.findIndex((stage) => stage.id === progressView.id);

  return (
    <ResearchRouteRendererShell>
      <div className={RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS}>
        <div className="flex h-full items-center justify-center px-6 py-10">
          <div className="lh-panel rounded-lh-2xl w-full max-w-xl px-6 py-7 text-center">
            {contextualNotice}
            {isLoading ? (
              <span className="border-accent/25 border-t-accent mx-auto mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2" />
            ) : (
              <span className="lh-type-metadata bg-error-soft text-error mx-auto mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full">
                !
              </span>
            )}
            <p className="lh-kicker">{lensLabel}</p>
            <h2 className="lh-type-route-heading lh-tone-primary mt-2">
              {isLoading ? pendingTitle : failedTitle}
            </h2>
            <p className="lh-type-reading-body lh-tone-secondary mt-2">
              {t("knowledgeMap.label.knowledge-map-view-shared.preparing", {
                query: query ? `"${query}"` : t("knowledgeMap.label.knowledge-map-view-shared.2"),
              })}
            </p>
            <div className="mt-5 text-left">
              <div className="bg-sidebar-border/50 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-accent h-full rounded-full transition-[width] duration-[var(--lh-duration-slow)]"
                  style={{ width: `${String(Math.round(progressView.progress * 100))}%` }}
                />
              </div>
              <div className="lh-type-metadata mt-3 flex items-center justify-between gap-3">
                <p className="lh-tone-primary font-medium">{progressView.label}</p>
                <p className="lh-tone-tertiary">{Math.round(progressView.progress * 100)}%</p>
              </div>
              <p className="lh-type-reading-body lh-tone-secondary mt-2">{progressView.detail}</p>
              <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                {progressStages.map((stage, index) => {
                  const isActive = progressView.id === stage.id;
                  const isCompleted =
                    progressView.id === "completed" ||
                    (!isActive &&
                      (activeStageIndex >= 0
                        ? index < activeStageIndex
                        : progressView.progress > stage.progress));
                  return (
                    <li
                      key={stage.id}
                      className="lh-panel-muted lh-type-metadata flex items-center gap-3 rounded-2xl px-3 py-2"
                    >
                      <span
                        className={`lh-type-micro inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                          isCompleted
                            ? "border-accent bg-accent text-accent-foreground"
                            : isActive
                              ? "border-accent text-accent"
                              : "border-sidebar-border text-text-subtle"
                        }`}
                      >
                        {isCompleted ? "•" : "○"}
                      </span>
                      <span
                        className={isActive ? "lh-tone-primary font-medium" : "lh-tone-secondary"}
                      >
                        {stage.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            {statusError ? (
              <p className="lh-type-metadata lh-tone-tertiary mt-4">{statusError}</p>
            ) : (
              <p className="lh-type-reading-body lh-tone-secondary mt-4">{readyDescription}</p>
            )}
            {error ? <p className="lh-type-metadata text-error mt-4">{error}</p> : null}
            {error && onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="lh-control lh-type-control-label mt-5 rounded-2xl px-4 py-2"
              >
                {isRetrying
                  ? t("knowledgeMap.progress.knowledge-map-view-shared")
                  : t("knowledgeMap.label.knowledge-map-view-shared.3")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </ResearchRouteRendererShell>
  );
}
