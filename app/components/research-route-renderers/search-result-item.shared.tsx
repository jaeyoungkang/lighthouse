// Pure presentational sub-parts of SearchResultItem, split out to keep
// search-result-item.tsx within the max-lines budget. These render-only helpers
// carry no card state — they take view-model props and draw. Behavior lives in
// search-result-item.tsx.

import type { PaperCore } from "@/app/domain/paper";
import { t } from "@/app/i18n/message-access";
import { type SearchResultBasisBadgeViewModel } from "./search-view.helpers";

export const PAPER_CARD_TITLE_SCAN_ROW_CLASS = "flex min-w-0 items-start gap-3";

export const PAPER_CARD_TITLE_UTILITY_RAIL_CLASS = "flex shrink-0 items-center justify-end gap-2";

export const PAPER_CARD_METADATA_SCAN_ROW_CLASS =
  "lh-type-metadata mt-2 flex min-h-6 min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5";

export function getVisiblePaperMetadata(paper: Pick<PaperCore, "venue" | "fieldsOfStudy">): {
  venue: string | null;
  fieldSummary: string | null;
} {
  const venue = paper.venue?.trim() || null;
  const fieldSummary =
    paper.fieldsOfStudy
      ?.map((field) => field.trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(", ") || null;

  return { venue, fieldSummary };
}

export function SearchResultMetadata({ paper }: { paper: PaperCore }) {
  const { venue, fieldSummary } = getVisiblePaperMetadata(paper);
  const layout = venue
    ? fieldSummary
      ? "venue-and-fields"
      : "venue-only"
    : fieldSummary
      ? "fields-only"
      : "unavailable";

  return (
    <div
      className={PAPER_CARD_METADATA_SCAN_ROW_CLASS}
      data-metadata-layout={layout}
      data-testid="search-result-metadata"
    >
      <span className="inline-flex max-w-full min-w-0 items-baseline gap-2">
        {paper.year ? (
          <>
            <span className="lh-tone-secondary shrink-0 tabular-nums" data-testid="paper-year">
              {paper.year}
            </span>
            <span className="lh-tone-tertiary shrink-0" aria-hidden="true">
              ·
            </span>
          </>
        ) : null}
        <span
          className={`${venue ? "lh-tone-primary font-medium" : "lh-tone-tertiary"} min-w-0 truncate`}
          data-metadata-availability={venue ? "available" : "unavailable"}
          data-testid="paper-venue"
          title={venue ?? undefined}
        >
          {venue ?? t("search.label.search-result-item.venueUnavailable")}
        </span>
        <span className="lh-tone-tertiary shrink-0" aria-hidden="true">
          ·
        </span>
      </span>
      <span
        className="lh-tone-secondary inline-flex max-w-full min-w-0 items-baseline gap-1.5"
        data-testid="paper-fields-group"
      >
        <span className="lh-tone-tertiary shrink-0 font-medium" data-testid="paper-fields-label">
          {t("search.label.search-result-item.fields")}
        </span>
        <span
          className={fieldSummary ? "min-w-0 truncate" : "lh-tone-tertiary min-w-0 truncate"}
          data-metadata-availability={fieldSummary ? "available" : "unavailable"}
          data-testid="paper-fields"
          title={fieldSummary ?? undefined}
        >
          {fieldSummary ?? t("search.label.search-result-item.fieldsUnavailable")}
        </span>
      </span>
    </div>
  );
}

export function PdfActionIcon({ kind }: { kind: "document" | "external" }) {
  const paths =
    kind === "document"
      ? ["M7 3.75h6.25L18 8.5v11.75H7V3.75z", "M13 4v5h5", "M9.5 14h5M9.5 17h3"]
      : [
          "M14 5h5v5",
          "M19 5l-9 9",
          "M10 6H6.5A1.5 1.5 0 005 7.5v10A1.5 1.5 0 006.5 19h10a1.5 1.5 0 001.5-1.5V14",
        ];
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path key={path} strokeLinecap="round" strokeLinejoin="round" d={path} />
      ))}
    </svg>
  );
}

export function SimilarPaperIcon({ kind }: { kind: "fallback" | "graph" }) {
  const path =
    kind === "fallback"
      ? "M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      : "M6.75 7.5a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5Zm10.5 0a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5ZM12 20.25a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5ZM8.5 6.5l6.75 0m-7 1.5 2.8 7m6.2-7-3 7";

  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  );
}

export function SearchResultBasisBadge({ badge }: { badge: SearchResultBasisBadgeViewModel }) {
  return (
    <span
      className="lh-type-micro text-success bg-success-soft/70 border-success/35 rounded-lh-sm inline-flex h-7 w-fit shrink-0 items-center gap-1.5 border px-2.5"
      data-testid="search-result-basis-badge"
    >
      <span className="bg-success h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
      {badge.label}
    </span>
  );
}

export function LoadingRing({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span
      className={`border-accent/30 border-t-accent inline-block shrink-0 animate-spin rounded-full border ${className}`}
      aria-hidden="true"
    />
  );
}
