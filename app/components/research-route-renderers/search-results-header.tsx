"use client";

// @promise promise:search-results-fast-window
// @promise promise:search-results-suggest-english-terms
// @promise promise:gap-network-detection-from-search
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:library-grounded-research
// @aspect aspect:knowledge-map-followup-surface
// @aspect aspect:user-facing-language-governance
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:ai-comment-research-term-suggestions
// @aspect aspect:ux-writing-voice-and-tone
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-library-grounding-unavailable
// @check acceptance-check:search-results-fast-window-loaded-result-facet-filters
// @check acceptance-check:search-results-fast-window-representative-filter
// @check acceptance-check:search-results-fast-window-publication-year-range-filter
// @check acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
// @check acceptance-check:search-results-suggest-english-terms-result-basis
// @check acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action

import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchResultsOverviewBlockFromMetadata,
  type SearchResultsOverviewBlock,
  type SearchResultsOverviewTerm,
} from "@/app/components/research/search-results-overview-model";
import {
  SearchResultsResearchTermLinks,
  YearDistributionPreview,
} from "@/app/components/research/search-results-overview-panel";
import { normalizeSearchFacetFilters, type SearchFacetFilters } from "@/app/domain/search-facets";
import { t } from "@/app/i18n/message-access";
import { SEARCH_DOCUMENT_FETCH_LIMIT } from "@/app/lib/constants";
import { attachInlineAiCommentBodySlot } from "@/app/components/research/attach-inline-ai-comment-body-slot";
import type { FollowupActivationEvent } from "./search-view.helpers";
import type { SearchSortOption } from "@/app/lib/search-paper-sort";
import {
  FacetDropdownChevron,
  SearchFacetDropdown,
  useSingleOpenFacet,
  type FacetOption,
} from "./search-results-facets";
import { SearchYearRangeFilter } from "./SearchYearRangeFilter";
import { type MouseEvent, type ReactNode } from "react";
import {
  INLINE_AI_COMMENT_ACTION_BUTTON_CLASS,
  INLINE_AI_COMMENT_FRAME_CLASS,
  INLINE_AI_COMMENT_TREATMENT,
} from "@/app/components/research/inline-ai-comment-treatment";

function getSearchSortLabel(sortOption: SearchSortOption): string {
  if (sortOption === "citationCount") return t("search.label.search-view-content.sortCitation");
  if (sortOption === "year") return t("search.label.search-view-content.sortYear");
  if (sortOption === "yearAsc") return t("search.label.search-view-content.sortYearAsc");
  return t("search.label.search-view-content.sortDefault");
}

function formatSearchResultBasis(params: {
  metadata: SearchMetadata;
  sortOption: SearchSortOption;
  yearFilter: string;
  facetFilters?: SearchFacetFilters;
  resultCount: number;
}): string {
  if (params.metadata.exactLookup?.kind === "doi") {
    return t("search.label.search-view-content.resultBasis.doi", {
      doi: params.metadata.exactLookup.value,
    });
  }

  // Library-grounded research: the result header basis toggle owns the
  // interest/relevance projection; this sentence only names the active basis.
  // @aspect aspect:library-grounded-research
  const clauseCount =
    params.metadata.queryClauses?.length ?? params.metadata.clauseStats?.length ?? 0;
  const isMergedMultiQuery = params.metadata.totalMode === "merged" || clauseCount > 1;
  const yearLabel = params.yearFilter
    ? t("search.label.search-view-content.resultBasis.year", { year: params.yearFilter })
    : "";
  const facetFilters = normalizeSearchFacetFilters(params.facetFilters);
  const activeFacetCount =
    facetFilters.fieldsOfStudy.length +
    facetFilters.authors.length +
    facetFilters.venues.length +
    (facetFilters.hasPdf ? 1 : 0);
  const facetLabel =
    activeFacetCount > 0
      ? t("search.label.search-view-content.resultBasis.facets", { count: activeFacetCount })
      : "";
  const values = {
    count: params.resultCount,
    total: params.metadata.total,
    sort: getSearchSortLabel(params.sortOption),
    library:
      params.metadata.libraryGrounding?.status === "applied"
        ? t("search.label.search-view-content.resultBasis.libraryApplied")
        : t("search.label.search-view-content.resultBasis.libraryNotApplied"),
    year: yearLabel,
    facets: facetLabel,
    limit: SEARCH_DOCUMENT_FETCH_LIMIT,
  };

  if (isMergedMultiQuery) {
    return t("search.label.search-view-content.resultBasis.merged", {
      ...values,
      clauseCount: Math.max(clauseCount, 1),
    });
  }

  return t("search.label.search-view-content.resultBasis", values);
}

function hasPaperPdf(paper: SearchMetadata["papers"][number]): boolean {
  return Boolean(paper.openAccessPdf?.url || paper.openAccess?.pdfUrl);
}

function buildFacetOptions(params: {
  papers: SearchMetadata["papers"];
  selected: readonly string[];
  collect: (paper: SearchMetadata["papers"][number]) => readonly string[];
}): FacetOption[] {
  const counts = new Map<string, number>();
  for (const paper of params.papers) {
    for (const value of params.collect(paper)) {
      const trimmed = value.trim();
      if (trimmed.length === 0) continue;
      counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
    }
  }
  for (const selected of params.selected) {
    if (!counts.has(selected)) counts.set(selected, 0);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (left.count !== right.count) return right.count - left.count;
      return left.value.localeCompare(right.value);
    })
    .slice(0, 10);
}

function InlineAnalysisStatus({ analyzedCount, total }: { analyzedCount: number; total: number }) {
  return (
    <span
      className="lh-type-metadata lh-tone-secondary flex items-center gap-1.5"
      data-testid="search-inline-analysis-status"
    >
      <span
        aria-hidden="true"
        className="border-accent/30 border-t-accent inline-block h-3 w-3 animate-spin rounded-full border-2"
      />
      {t("search.label.search-view-content.analyzing", {
        analyzed: analyzedCount,
        total,
      })}
    </span>
  );
}

interface SearchResultsHeaderProps {
  metadata: SearchMetadata;
  sortOption: SearchSortOption;
  /** Legacy render-fixture input; no basis toggle is rendered. */
  personalize?: boolean;
  /** Legacy render-fixture input; grounding status comes from metadata. */
  libraryContextAvailable?: boolean;
  facetFilters: SearchFacetFilters;
  yearFilter: string;
  resultCount: number;
  isSearching: boolean;
  query: string;
  yearRangeInputs: { from: string; to: string };
  onYearRangeInputsChange: (value: { from: string; to: string }) => void;
  onSearchSubmit: () => void;
  onSortSelect: (value: SearchSortOption) => void;
  /** Legacy render-fixture callback; no basis selector calls it. */
  onBasisSelect?: (value: "interest" | "relevance") => void;
  onToggleFacetValue: (key: "fieldsOfStudy" | "authors" | "venues", value: string) => void;
  onToggleHasPdf: (value: boolean) => void;
  showInlineAnalysisStatus: boolean;
  analyzedCount: number;
  inlineAnalysisTotal: number;
  onApplySpellingCorrection: (correctedQuery: string) => void;
  isCreatingGapNetwork: boolean;
  representativeCount: number;
  showRepresentativeOnly: boolean;
  onToggleRepresentativeOnly: (value: boolean) => void;
  onOpenGapNetwork?: (event?: FollowupActivationEvent) => void;
  reactionSlot?: ReactNode;
  overviewBlock?: SearchResultsOverviewBlock | null;
  onOverviewSearchTerm?: (
    candidate: SearchResultsOverviewTerm,
    event?: FollowupActivationEvent,
  ) => void;
}

function SearchLibraryGroundingUnavailableNotice({ metadata }: { metadata: SearchMetadata }) {
  if (metadata.libraryGrounding?.status !== "unavailable") return null;
  return (
    <p
      aria-live="polite"
      className="lh-type-metadata lh-tone-secondary"
      data-testid="search-library-grounding-unavailable"
      role="status"
    >
      {t("search.label.search-view-content.libraryGroundingUnavailable")}
    </p>
  );
}

export function SearchResultsHeader({
  metadata,
  sortOption,
  facetFilters,
  yearFilter,
  resultCount,
  isSearching,
  query,
  yearRangeInputs,
  onYearRangeInputsChange,
  onSearchSubmit,
  onSortSelect,
  onToggleFacetValue,
  onToggleHasPdf,
  showInlineAnalysisStatus,
  analyzedCount,
  inlineAnalysisTotal,
  onApplySpellingCorrection,
  isCreatingGapNetwork,
  representativeCount,
  showRepresentativeOnly,
  onToggleRepresentativeOnly,
  onOpenGapNetwork,
  reactionSlot,
  overviewBlock,
  onOverviewSearchTerm,
}: SearchResultsHeaderProps) {
  const { openFacet, setOpenFacet, facetGroupRef, registerFacetTrigger } = useSingleOpenFacet();
  const fieldOptions = buildFacetOptions({
    papers: metadata.papers,
    selected: facetFilters.fieldsOfStudy,
    collect: (paper) => paper.fieldsOfStudy ?? [],
  });
  const authorOptions = buildFacetOptions({
    papers: metadata.papers,
    selected: facetFilters.authors,
    collect: (paper) => paper.authors.map((author) => author.name),
  });
  const venueOptions = buildFacetOptions({
    papers: metadata.papers,
    selected: facetFilters.venues,
    collect: (paper) => (paper.venue ? [paper.venue] : []),
  });
  const hasPdfCount = metadata.papers.filter(hasPaperPdf).length;
  const handleGapNetworkAction = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.type === "auxclick" && event.button !== 1) {
      return;
    }
    onOpenGapNetwork?.({
      ctrlKey: true,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      button: event.button,
    });
  };
  const gapNetworkAction = onOpenGapNetwork ? (
    <button
      type="button"
      onClick={handleGapNetworkAction}
      onAuxClick={handleGapNetworkAction}
      disabled={isCreatingGapNetwork}
      className={INLINE_AI_COMMENT_ACTION_BUTTON_CLASS}
      data-testid="search-results-gap-network-action"
    >
      {isCreatingGapNetwork
        ? t("search.label.search-results-content-rail.gapMapPending")
        : t("search.label.search-results-content-rail.gapMapAction")}
    </button>
  ) : null;
  const researchTermInlineSlot = overviewBlock ? (
    <SearchResultsResearchTermLinks block={overviewBlock} onSearchTerm={onOverviewSearchTerm} />
  ) : null;
  const metadataOverviewBlock = buildSearchResultsOverviewBlockFromMetadata(metadata);
  const yearDistributionBuckets =
    metadataOverviewBlock?.sections.find((section) => section.kind === "year_distribution")
      ?.buckets ?? [];
  const parseYearInput = (raw: string): number | null =>
    /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : null;
  const yearHighlightRange = {
    from: parseYearInput(yearRangeInputs.from),
    to: parseYearInput(yearRangeInputs.to),
  };
  const reactionSlotWithTerms = attachInlineAiCommentBodySlot(reactionSlot, researchTermInlineSlot);
  const sortSelectValue =
    sortOption === "citationCount" || sortOption === "year" || sortOption === "yearAsc"
      ? sortOption
      : "default";

  return (
    <div className="border-sidebar-border/70 mb-5 border-b pb-3">
      <div className="flex flex-col gap-2.5">
        <div
          className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2"
          data-testid="search-result-basis-row"
        >
          <p
            className="lh-type-metadata lh-tone-secondary min-w-0"
            data-testid="search-result-basis"
          >
            {formatSearchResultBasis({
              metadata,
              sortOption,
              facetFilters,
              yearFilter,
              resultCount,
            })}
          </p>
          {gapNetworkAction ? (
            <div
              className="ml-auto flex shrink-0 items-center justify-end text-right"
              data-testid="search-results-reaction-actions"
            >
              {gapNetworkAction}
            </div>
          ) : null}
        </div>
        <SearchLibraryGroundingUnavailableNotice metadata={metadata} />
        {reactionSlotWithTerms ? (
          <div
            className={INLINE_AI_COMMENT_FRAME_CLASS}
            data-ai-comment-treatment={INLINE_AI_COMMENT_TREATMENT}
            data-testid="search-results-reaction-below-basis"
          >
            {reactionSlotWithTerms}
          </div>
        ) : null}
        <div
          className="flex w-full flex-col items-start gap-2 pt-0.5"
          data-testid="search-overview-controls"
        >
          <div
            className="flex w-full flex-wrap items-center gap-2"
            data-testid="search-primary-condition-controls"
          >
            <div
              ref={facetGroupRef}
              className="border-border-subtle bg-surface-panel/40 rounded-lh-sm flex flex-wrap items-center gap-2 border border-dashed px-2.5 py-1.5"
              data-testid="search-facet-filter-group"
            >
              <SearchFacetDropdown
                dropdownKey="fields"
                label={t("search.label.search-view-content.facets.fields")}
                options={fieldOptions}
                selected={facetFilters.fieldsOfStudy}
                disabled={isSearching}
                onToggle={(value) => {
                  onToggleFacetValue("fieldsOfStudy", value);
                }}
                openKey={openFacet}
                onOpenChange={setOpenFacet}
                triggerRef={registerFacetTrigger("fields")}
              />
              <details
                className="group relative"
                open={openFacet === "dateRange"}
                data-testid="search-facet-dateRange"
              >
                <summary
                  ref={registerFacetTrigger("dateRange")}
                  aria-disabled={isSearching}
                  onClick={(event) => {
                    event.preventDefault();
                    if (isSearching) return;
                    setOpenFacet(openFacet === "dateRange" ? null : "dateRange");
                  }}
                  className="lh-control lh-type-control-label rounded-lh-sm border-border-subtle bg-surface-panel group-open:border-accent flex cursor-pointer list-none items-center gap-1.5 border px-2.5 py-1.5 aria-disabled:opacity-50"
                >
                  <span>{t("search.label.search-view-content.facets.dateRange")}</span>
                  {yearFilter ? <span className="text-accent font-medium">1</span> : null}
                  <FacetDropdownChevron />
                </summary>
                {openFacet === "dateRange" ? (
                  <div
                    className="border-border-subtle bg-surface-panel absolute top-full left-0 z-20 mt-1 w-72 border p-3 shadow-lg sm:w-96"
                    data-testid="search-year-filter-panel"
                  >
                    <div className="flex flex-wrap items-center gap-1">
                      <SearchYearRangeFilter
                        value={yearRangeInputs}
                        isSearching={isSearching}
                        onChange={onYearRangeInputsChange}
                        onSubmit={onSearchSubmit}
                      />
                      <button
                        type="button"
                        onClick={onSearchSubmit}
                        disabled={isSearching || query.trim().length === 0}
                        aria-label={t("search.label.search-view-content.applyConditions")}
                        data-testid="search-submit-button"
                        className="lh-control-accent lh-type-control-label rounded-lh-sm ml-auto shrink-0 px-2.5 py-1 disabled:opacity-50"
                      >
                        {t("search.label.search-view-content.applyConditions")}
                      </button>
                    </div>
                    {yearDistributionBuckets.length > 0 ? (
                      <div
                        className="border-border-subtle mt-3 border-t pt-3"
                        data-testid="search-year-distribution"
                      >
                        <p className="lh-type-micro lh-tone-tertiary mb-1.5">
                          {t("surface.label.agent-panel.searchOverview.yearDistribution.title")}
                        </p>
                        <YearDistributionPreview
                          buckets={yearDistributionBuckets}
                          highlightRange={yearHighlightRange}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </details>
              <label className="lh-control lh-type-control-label rounded-lh-sm border-border-subtle bg-surface-panel flex items-center gap-2 border px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={facetFilters.hasPdf}
                  disabled={isSearching || hasPdfCount === 0}
                  onChange={(event) => {
                    onToggleHasPdf(event.target.checked);
                  }}
                  className="accent-accent h-3.5 w-3.5"
                />
                <span>{t("search.label.search-view-content.facets.hasPdf")}</span>
                <span className="lh-type-metadata lh-tone-tertiary">{hasPdfCount}</span>
              </label>
              <label className="lh-control lh-type-control-label rounded-lh-sm border-border-subtle bg-surface-panel flex items-center gap-2 border px-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={showRepresentativeOnly}
                  disabled={isSearching || representativeCount === 0}
                  onChange={(event) => {
                    onToggleRepresentativeOnly(event.target.checked);
                  }}
                  className="accent-accent h-3.5 w-3.5"
                  data-testid="search-representative-filter"
                />
                <span>{t("search.label.search-view-content.facets.representative")}</span>
                <span className="lh-type-metadata lh-tone-tertiary">{representativeCount}</span>
              </label>
              <SearchFacetDropdown
                dropdownKey="authors"
                label={t("search.label.search-view-content.facets.authors")}
                options={authorOptions}
                selected={facetFilters.authors}
                disabled={isSearching}
                onToggle={(value) => {
                  onToggleFacetValue("authors", value);
                }}
                openKey={openFacet}
                onOpenChange={setOpenFacet}
                triggerRef={registerFacetTrigger("authors")}
              />
              <SearchFacetDropdown
                dropdownKey="venues"
                label={t("search.label.search-view-content.facets.venues")}
                options={venueOptions}
                selected={facetFilters.venues}
                disabled={isSearching}
                onToggle={(value) => {
                  onToggleFacetValue("venues", value);
                }}
                openKey={openFacet}
                onOpenChange={setOpenFacet}
                triggerRef={registerFacetTrigger("venues")}
              />
            </div>
            <div
              className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2"
              data-testid="search-results-right-controls"
            >
              {isSearching ? (
                <span className="lh-type-metadata lh-tone-secondary">
                  {t("search.label.search-view-content.loadingTitle")}
                </span>
              ) : null}
              <select
                value={sortSelectValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onSortSelect(
                    nextValue === "default"
                      ? metadata.libraryContext?.signalPresent === true
                        ? "interest"
                        : "relevance"
                      : (nextValue as SearchSortOption),
                  );
                }}
                aria-label={t("search.label.search-view-content.15")}
                className="lh-input lh-type-control-label rounded-lh-sm px-2.5 py-1.5"
              >
                <option value="default">{t("search.label.search-view-content.sortDefault")}</option>
                <option value="citationCount">
                  {t("search.label.search-view-content.sortCitation")}
                </option>
                <option value="year">{t("search.label.search-view-content.sortYear")}</option>
                <option value="yearAsc">{t("search.label.search-view-content.sortYearAsc")}</option>
              </select>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="search-secondary-condition-controls"
          >
            {showInlineAnalysisStatus && (
              <InlineAnalysisStatus analyzedCount={analyzedCount} total={inlineAnalysisTotal} />
            )}
          </div>
        </div>
      </div>
      {metadata.spellingCorrection ? (
        <div className="lh-type-metadata mt-2 flex flex-wrap items-center gap-2">
          <p className="lh-tone-secondary">
            {t("search.label.search-view-content.spellingCorrection", {
              original: metadata.spellingCorrection.originalQuery,
              corrected: metadata.spellingCorrection.correctedQuery,
            })}
          </p>
          <button
            type="button"
            onClick={() => {
              onApplySpellingCorrection(metadata.spellingCorrection?.correctedQuery ?? "");
            }}
            disabled={isSearching}
            className="lh-type-control-label text-accent hover:underline disabled:opacity-50"
          >
            {t("search.label.search-view-content.spellingCorrection.action")}
          </button>
        </div>
      ) : null}
      {isCreatingGapNetwork ? (
        <p className="lh-type-metadata lh-tone-secondary mt-2">
          {t("search.label.search-view-content.creatingGapNetwork")}
        </p>
      ) : null}
    </div>
  );
}
