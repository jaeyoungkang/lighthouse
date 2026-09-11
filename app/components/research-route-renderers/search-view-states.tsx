"use client";

// @promise promise:search-results-fast-window
// @promise promise:research-route-cap-feedback
// @promise promise:search-query-route-transition
// @aspect aspect:library-grounded-research
// @aspect aspect:immediate-navigation
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-loading-visible
// @check acceptance-check:search-results-fast-window-reviewed-papers-context-source
// @check acceptance-check:search-results-fast-window-unified-result-projection
// @check acceptance-check:search-query-route-transition-immediate-submit
// @check acceptance-check:search-query-route-transition-submit-feedback

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/app/components/BrandLogo";
import { SearchNavigationButtonContent } from "@/app/components/research/SearchNavigationButtonContent";
import { useSearchFollowupActivation } from "@/app/components/research/search-followup-activation";
import { normalizeSearchFacetFilters } from "@/app/domain/search-facets";
import { t } from "@/app/i18n/message-access";
import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";

interface SearchViewEmptyStateProps {
  isError: boolean;
  libraryContextAvailable: boolean;
  /** Legacy render-fixture input; current searches always use the unified projection. */
  personalize?: boolean;
}

interface SearchViewProcessingStateProps {
  isError: boolean;
  query: string;
}

interface SearchViewFailedStateProps {
  query: string;
  onRetry: () => void;
}

export function SearchViewEmptyState({
  isError,
  libraryContextAvailable,
}: SearchViewEmptyStateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clearIfStillPending, pending, reportConditionUrlRejected, startActivation } =
    useSearchFollowupActivation();
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim();
  const canSubmit = trimmedQuery.length > 0;
  const submitRouteResult = canSubmit
    ? buildSearchRoutePageRoute({
        q: query,
        sort: searchParams.get("sort") ?? undefined,
        year: searchParams.get("year") ?? undefined,
        libraryContextAvailable: libraryContextAvailable ? true : undefined,
        facetFilters: normalizeSearchFacetFilters({
          fieldsOfStudy: searchParams.getAll("field"),
          authors: searchParams.getAll("author"),
          venues: searchParams.getAll("venue"),
          hasPdf: searchParams.get("hasPdf") === "true",
        }),
        entry: "empty-entry",
      })
    : null;
  const submitRoute = submitRouteResult?.ok ? submitRouteResult.route : null;
  const isSearchNavigationPending = submitRoute !== null && pending?.route === submitRoute;
  const submitQuery = () => {
    if (submitRouteResult && !submitRouteResult.ok) {
      reportConditionUrlRejected();
      return;
    }
    if (!submitRoute || isSearchNavigationPending) return;
    // The empty-state submit moves IMMEDIATELY to the `/search?q=` route
    // (aspect:immediate-navigation); the server emits the canonical submit event
    // and executes the query at the same address.
    const activation = startActivation({ route: submitRoute, query: trimmedQuery });
    try {
      router.push(submitRoute, { scroll: false });
    } catch (error) {
      clearIfStillPending(activation);
      console.error("[initial-search] navigation failed:", error);
    }
  };

  return (
    <div
      className="flex min-h-[70vh] w-full flex-col items-center justify-center px-5 py-5"
      data-testid="search-view-empty-state"
    >
      <div className="w-full max-w-5xl" data-testid="search-view-empty-state-body">
        <div className="space-y-3" data-testid="search-view-empty-brand-panel">
          <BrandLogo placement="intro" priority testId="search-empty-brand-logo" />
          <p className="lh-type-reading-body lh-tone-secondary max-w-4xl">
            {t("search.label.search-view-content.heroSubtitle")}
          </p>
        </div>

        <div className="mt-5 min-w-0" data-testid="search-view-empty-input-panel">
          <div
            className="border-sidebar-border flex w-full items-center gap-2 border-b pb-3"
            data-testid="search-view-empty-form-row"
          >
            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <svg
                  className="text-text-subtle h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submitQuery();
                  }
                }}
                placeholder={t("search.label.search-view-content.9")}
                aria-label={t("search.label.search-view-content.10")}
                data-testid="search-view-empty-query-input"
                className="lh-input lh-type-control-label rounded-lh-md w-full py-5 pr-4 pl-12"
              />
            </div>
            <button
              type="button"
              onClick={submitQuery}
              disabled={!canSubmit || isSearchNavigationPending}
              aria-busy={isSearchNavigationPending}
              data-testid="search-view-empty-submit"
              className="lh-control-accent lh-type-control-label rounded-lh-sm inline-flex items-center justify-center gap-2 px-7 py-4 disabled:opacity-50"
            >
              <SearchNavigationButtonContent pending={isSearchNavigationPending}>
                {t("search.label.search-view-content.heroButton")}
              </SearchNavigationButtonContent>
            </button>
          </div>
          {isError && (
            <p className="lh-type-metadata text-error mt-4">
              {t("search.error.search-view-content.requestFailed")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SearchViewProcessingState({ isError, query }: SearchViewProcessingStateProps) {
  return (
    <div
      className="flex min-h-[54vh] w-full flex-col justify-center px-5 py-10"
      data-testid="search-view-processing-state"
      role="status"
      aria-live="polite"
    >
      <div className="border-sidebar-border/70 bg-surface-panel/80 rounded-lh-lg w-full border px-6 py-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="border-accent/25 border-t-accent mt-1 inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-[3px]"
          />
          <div className="min-w-0">
            <p className="lh-kicker">{t("search.label.search-view-content.processingKicker")}</p>
            <h2 className="lh-type-route-heading lh-tone-primary mt-2">
              {t("search.label.search-view-content.processingTitle")}
            </h2>
            <p className="lh-type-reading-body lh-tone-secondary mt-2">
              {t("search.label.search-view-content.processingBody", { query })}
            </p>
            {isError ? (
              <p className="lh-type-metadata text-error mt-4">
                {t("search.error.search-view-content.requestFailed")}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// @promise promise:search-failure-degraded-at-url
export function SearchViewFailedState({ query, onRetry }: SearchViewFailedStateProps) {
  return (
    <div
      className="flex min-h-[54vh] w-full flex-col justify-center px-5 py-10"
      data-testid="search-view-degraded-failure"
      role="alert"
    >
      <div className="border-sidebar-border/70 bg-surface-panel/80 rounded-lh-lg w-full border px-6 py-6 shadow-sm">
        <p className="lh-kicker">{t("search.label.reserved-search.failed.title")}</p>
        <h2 className="lh-type-route-heading lh-tone-primary mt-2">
          {query || t("search.label.search-view-content.processingTitle")}
        </h2>
        <p className="lh-type-reading-body lh-tone-secondary mt-2">
          {t("search.label.reserved-search.failed.body")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          data-testid="search-view-degraded-retry"
          className="lh-control-accent lh-type-control-label rounded-lh-sm mt-5 px-4 py-2"
        >
          {t("search.label.reserved-search.failed.retry")}
        </button>
      </div>
    </div>
  );
}
