// @promise promise:inline-analysis-auto-run
// @promise promise:search-results-fast-window
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:inline-analysis-auto-run-evidence-limit-preview

import { useEffect, useState, type ReactNode } from "react";
import { DisclosureChevron } from "@/app/components/DisclosureChevron";
import { t } from "@/app/i18n/message-access";
import type { PaperCore } from "@/app/domain/paper";
import {
  retryInlineAnalysisForPaper,
  useBackgroundTaskStore,
} from "@/app/stores/background-task-store";
import { getVisiblePaperMetadata, LoadingRing } from "./search-result-item.shared";
import { buildPaperExternalUrl, getAnalysisStatusBadge } from "./search-view.helpers";
import type { AnalysisProgressState } from "@/app/lib/inline-analysis";

export const PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS = "min-h-60 sm:min-h-56";
export const PAPER_GENERATED_CONTENT_REGION_CLASS = "mt-3 min-h-16";

export function PaperCardDisclosureSurface({
  expanded,
  controlsId,
  onToggle,
  children,
}: {
  expanded: boolean;
  controlsId?: string;
  onToggle?: () => void;
  children: ReactNode;
}) {
  if (!onToggle) {
    return <div className="flex min-h-11 items-center">{children}</div>;
  }

  const actionLabel = t(
    expanded ? "search.label.search-result-item.7" : "search.label.search-result-item.8",
  );
  const actionLabelId = controlsId ? `${controlsId}-disclosure-action` : undefined;
  const titleTextId = controlsId ? `${controlsId}-title` : undefined;

  return (
    <div className="-m-1 flex min-h-12 w-[calc(100%+0.5rem)] items-center gap-3 p-1">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="border-border-subtle bg-surface-panel text-text-muted hover:border-accent hover:text-accent focus-visible:ring-accent/40 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border focus-visible:ring-2 focus-visible:outline-none"
        aria-expanded={expanded}
        aria-controls={controlsId}
        aria-label={actionLabel}
        aria-labelledby={
          titleTextId && actionLabelId ? `${titleTextId} ${actionLabelId}` : undefined
        }
        data-testid="search-result-card-disclosure"
      >
        {actionLabelId ? (
          <span id={actionLabelId} className="sr-only">
            {actionLabel}
          </span>
        ) : null}
        <DisclosureChevron
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          testId="search-result-card-disclosure-icon"
        />
      </button>
    </div>
  );
}

interface GeneratedFrameDisclosureProps {
  expanded?: boolean;
  controlsId?: string;
  onToggle?: () => void;
}

export function PaperSourceLinks({ paper }: { paper: PaperCore }) {
  const paperExternalUrl = buildPaperExternalUrl(paper.paperId, paper.url);

  return (
    <div data-testid="search-result-source-links">
      <span className="lh-type-metadata lh-tone-secondary font-semibold">
        {t("search.label.search-result-item.sourceLinks")}
      </span>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <a
          href={paperExternalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="lh-chip hover:border-accent hover:text-accent"
        >
          {t("search.label.search-result-item.openSource")}
        </a>
      </div>
    </div>
  );
}

function ExpandedPaperSourceLinks({
  paper,
  expanded,
  id,
}: {
  paper: PaperCore;
  expanded: boolean;
  id?: string;
}) {
  return (
    <div id={id} hidden={!expanded} className="mt-2">
      {expanded ? <PaperSourceLinks paper={paper} /> : null}
    </div>
  );
}

export function SearchResultDetailsLoadingFrame({
  paper,
  expanded = false,
  controlsId,
  onToggle,
}: { paper: PaperCore } & GeneratedFrameDisclosureProps) {
  return (
    <div
      className={`border-border-subtle bg-surface-panel/45 border-l-2 px-3 py-2.5 ${PAPER_GENERATED_CONTENT_REGION_CLASS}`}
      data-testid="search-result-details-loading"
      data-generated-content-region="paper-card-analysis"
    >
      <PaperCardDisclosureSurface expanded={expanded} controlsId={controlsId} onToggle={onToggle}>
        <div className="flex items-center gap-2">
          <LoadingRing className="h-3.5 w-3.5 border-2" />
          <span className="lh-type-metadata lh-tone-secondary font-semibold">
            {t("search.label.search-result-item.preparingDetails")}
          </span>
        </div>
        <div className="lh-type-metadata lh-tone-secondary mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-border-strong h-px w-3" aria-hidden="true" />
            {t("search.label.search-result-item.loadingContent")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-border-strong h-px w-3" aria-hidden="true" />
            {t("search.label.search-result-item.loadingAnalysis")}
          </span>
        </div>
        <ExpandedPaperSourceLinks paper={paper} expanded={expanded} id={controlsId} />
      </PaperCardDisclosureSurface>
    </div>
  );
}

export function SearchResultAnalysisStateFrame({
  paper,
  state,
  expanded = false,
  controlsId,
  onToggle,
}: { paper: PaperCore; state: AnalysisProgressState } & GeneratedFrameDisclosureProps) {
  const failed = state === "error" || state === "done";
  const badge = getAnalysisStatusBadge(failed ? "error" : state);
  const cooldownUntil = useBackgroundTaskStore((store) => {
    const task = Object.values(store.inlineAnalysisTasks).find(
      (candidate) => candidate?.progressMap.get(paper.paperId) === "error",
    );
    return task?.recoveryMap?.get(paper.paperId)?.cooldownUntil ?? null;
  });
  const retryAt = cooldownUntil ? Date.parse(cooldownUntil) : null;
  const [clock, setClock] = useState(() => Date.now());
  const cooldownActive = retryAt != null && Number.isFinite(retryAt) && retryAt > clock;

  useEffect(() => {
    if (retryAt == null || !Number.isFinite(retryAt)) return;
    const remaining = retryAt - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => {
      setClock(Date.now());
    }, remaining);
    return () => {
      window.clearTimeout(timer);
    };
  }, [clock, retryAt]);

  return (
    <div
      className={`border-border-subtle bg-accent-soft/10 border-l-2 px-3 py-2.5 ${PAPER_GENERATED_CONTENT_REGION_CLASS}`}
      data-testid="search-result-analysis-state"
      data-analysis-state={state}
      data-generated-content-region="paper-card-analysis"
    >
      <PaperCardDisclosureSurface expanded={expanded} controlsId={controlsId} onToggle={onToggle}>
        <div className="flex items-center gap-2">
          {badge.showSpinner ? <LoadingRing className="h-3.5 w-3.5 border-2" /> : null}
          <span className="lh-type-metadata lh-tone-secondary font-semibold">{badge.label}</span>
        </div>
        <p className="lh-type-metadata lh-tone-secondary mt-2">
          {t(
            failed
              ? "search.label.search-result-item.analysisUnavailableDescription"
              : "search.label.search-result-item.analysisPendingDescription",
          )}
        </p>
        {failed && cooldownActive ? (
          <p className="lh-type-metadata lh-tone-secondary mt-1">
            {t("search.label.search-result-item.analysisRetryAvailableAt", {
              time: new Date(retryAt).toLocaleTimeString(),
            })}
          </p>
        ) : null}
        {failed ? (
          <button
            type="button"
            className="lh-type-compact-control text-accent mt-2 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            disabled={cooldownActive}
            onClick={(event) => {
              event.stopPropagation();
              retryInlineAnalysisForPaper(paper.paperId);
            }}
          >
            {t("search.label.search-result-item.retryAnalysis")}
          </button>
        ) : null}
        <ExpandedPaperSourceLinks paper={paper} expanded={expanded} id={controlsId} />
      </PaperCardDisclosureSurface>
    </div>
  );
}

export function SearchResultEvidenceLimitFrame({
  paper,
  expanded = false,
  controlsId,
  onToggle,
}: { paper: PaperCore } & GeneratedFrameDisclosureProps) {
  const { fieldSummary } = getVisiblePaperMetadata(paper);
  const hasAbstract = Boolean(paper.abstract?.trim());

  return (
    <div
      className={`border-border-subtle bg-surface-panel/45 border-l-2 px-3 py-2.5 ${PAPER_GENERATED_CONTENT_REGION_CLASS}`}
      data-testid="search-result-evidence-limit"
      data-evidence-source={hasAbstract ? "abstract-available" : "metadata-only"}
      data-generated-content-region="paper-card-analysis"
    >
      <PaperCardDisclosureSurface expanded={expanded} controlsId={controlsId} onToggle={onToggle}>
        {hasAbstract ? (
          <span className="lh-type-metadata lh-tone-secondary font-semibold">
            {t("search.label.search-result-item.analysisNotStarted")}
          </span>
        ) : null}
        <p className={`lh-type-metadata lh-tone-secondary ${hasAbstract ? "mt-2" : ""}`}>
          {hasAbstract
            ? t("search.label.search-result-item.analysisNotStartedDescription")
            : fieldSummary
              ? t("search.label.search-result-item.metadataClueWithFields", {
                  fields: fieldSummary,
                })
              : t("search.label.search-result-item.metadataClueWithoutFields")}
        </p>
        <ExpandedPaperSourceLinks paper={paper} expanded={expanded} id={controlsId} />
      </PaperCardDisclosureSurface>
    </div>
  );
}
