// @promise promise:search-results-fast-window
// @promise promise:search-results-suggest-english-terms
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-year-distribution
// @check acceptance-check:search-results-suggest-english-terms-result-basis
// @check acceptance-check:search-results-suggest-english-terms-click-feedback
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback

import type {
  SearchResultsOverviewBlock,
  SearchResultsOverviewSection,
  SearchResultsOverviewTerm,
} from "@/app/components/research/search-results-overview-model";
import type { FollowupActivationEvent } from "@/app/components/research-route-renderers/search-view.helpers";
import { t } from "@/app/i18n/message-access";
import type { MouseEvent } from "react";

export function YearDistributionPreview({
  buckets,
  highlightRange,
}: {
  buckets: NonNullable<SearchResultsOverviewBlock["sections"][number]["buckets"]>;
  /** Years inside the currently entered publication-year filter range are accented so the chart
      previews the selected slice. `null` bounds are open-ended; both null means no highlight. */
  highlightRange?: { from: number | null; to: number | null };
}) {
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const firstYear = buckets[0]?.year;
  const lastYear = buckets[buckets.length - 1]?.year;

  const fromYear = highlightRange?.from ?? null;
  const toYear = highlightRange?.to ?? null;
  const hasHighlight = fromYear !== null || toYear !== null;
  const lowerBound =
    fromYear !== null && toYear !== null
      ? Math.min(fromYear, toYear)
      : (fromYear ?? Number.NEGATIVE_INFINITY);
  const upperBound =
    fromYear !== null && toYear !== null
      ? Math.max(fromYear, toYear)
      : (toYear ?? Number.POSITIVE_INFINITY);

  return (
    <div className="w-full min-w-0" data-testid="search-results-overview-search-year-chart">
      {/* Continuous year axis: every year from the earliest to the latest result gets an
          equal-width slot, so the chart always fills the width and years with no papers stay
          visible as empty slots instead of being dropped. */}
      <div className="flex h-7 items-end gap-px">
        {buckets.map((bucket) => {
          const isEmpty = bucket.count === 0;
          const isHighlighted =
            hasHighlight && bucket.year >= lowerBound && bucket.year <= upperBound;
          const bucketLabel = t("surface.label.agent-panel.searchOverview.yearBucket", {
            year: bucket.year,
            count: bucket.count,
          });
          const tooltipId = `search-year-tooltip-${String(bucket.year)}`;
          return (
            <div
              key={bucket.year}
              className="group/yearbar focus-visible:ring-accent/40 relative flex h-7 min-w-0 flex-1 items-end focus-visible:ring-2 focus-visible:outline-none"
              data-testid={`search-year-bar-${String(bucket.year)}`}
              data-empty={isEmpty}
              data-highlight={isHighlighted}
              aria-label={bucketLabel}
              aria-describedby={tooltipId}
              tabIndex={0}
            >
              <div
                className={`w-full rounded-t-sm ${
                  isHighlighted
                    ? isEmpty
                      ? "bg-accent/30"
                      : "bg-accent"
                    : isEmpty
                      ? "bg-text-muted/15"
                      : "bg-text-muted/35"
                }`}
                style={{
                  height: `${String(isEmpty ? 2 : Math.max(4, (bucket.count / maxCount) * 18))}px`,
                }}
              />
              <span
                id={tooltipId}
                role="tooltip"
                data-testid={`search-year-tooltip-${String(bucket.year)}`}
                className="lh-type-micro bg-background border-border-subtle text-foreground rounded-lh-sm pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 hidden -translate-x-1/2 border px-1.5 py-0.5 whitespace-nowrap shadow-lg group-focus-within/yearbar:block group-hover/yearbar:block"
              >
                {bucketLabel}
              </span>
            </div>
          );
        })}
      </div>
      {buckets.length > 0 ? (
        <div className="lh-type-micro lh-tone-tertiary mt-0.5 flex justify-between">
          <span>{firstYear}</span>
          {lastYear !== firstYear ? <span>{lastYear}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function getResearchTermsSection(
  block: SearchResultsOverviewBlock,
): SearchResultsOverviewSection | undefined {
  return block.sections.find((section) => section.kind === "research_terms");
}

export function SearchResultsResearchTermLinks({
  block,
  onSearchTerm,
}: {
  block: SearchResultsOverviewBlock;
  onSearchTerm?: (term: SearchResultsOverviewTerm, event?: FollowupActivationEvent) => void;
}) {
  const section = getResearchTermsSection(block);
  if (!section) return null;
  const terms = section.terms ?? [];
  if (section.pendingText) {
    return (
      <span
        className="lh-type-reading-body lh-tone-secondary"
        data-testid="search-ai-comment-research-terms"
      >
        <span
          className="lh-type-reading-body lh-tone-tertiary"
          data-testid="search-results-overview-search-terms-pending"
          role="status"
        >
          {section.pendingText}
        </span>
      </span>
    );
  }

  if (terms.length === 0) return null;

  return (
    <span
      className="lh-type-reading-body lh-tone-secondary block min-w-0 overflow-x-auto whitespace-nowrap"
      data-testid="search-ai-comment-research-terms"
    >
      <span className="lh-tone-tertiary">
        {t("surface.label.agent-panel.searchOverview.researchTerms.sentencePrefix")}
      </span>{" "}
      <span
        className="inline min-w-0 whitespace-nowrap"
        data-testid="search-ai-comment-research-term-links"
      >
        {terms.map((term, index) => (
          <span key={term.term} className="inline min-w-0 whitespace-nowrap">
            <button
              type="button"
              onClick={(event: MouseEvent<HTMLButtonElement>) => {
                onSearchTerm?.(term, event);
              }}
              onAuxClick={(event: MouseEvent<HTMLButtonElement>) => {
                if (event.button !== 1) return;
                onSearchTerm?.(term, event);
              }}
              className="lh-type-control-label text-accent rounded-lh-sm focus-visible:ring-accent min-w-0 text-left whitespace-nowrap underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              {term.term}
            </button>
            {index < terms.length - 1 ? (
              <span aria-hidden="true" className="text-text-subtle mx-1">
                ·
              </span>
            ) : null}
          </span>
        ))}
      </span>
    </span>
  );
}
