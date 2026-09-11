import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  EMPTY_SEARCH_FACET_FILTERS,
  normalizeSearchFacetFilters,
  type SearchFacetFilters,
} from "@/app/domain/search-facets";
import { paperMatchesYearFilter } from "@/app/domain/search-year-range";
import {
  resolveDefaultSearchSortOption,
  sortSearchPapers,
  type SearchSortOption,
} from "@/app/lib/search-paper-sort";

export function buildSearchResultPapers(params: {
  metadata: SearchMetadata;
  sortOption?: SearchSortOption;
  yearFilter?: string;
  facetFilters?: SearchFacetFilters;
}): SearchMetadata["papers"] {
  const activeYearFilter = params.yearFilter ?? params.metadata.yearFilter;
  const yearFilteredPapers = activeYearFilter
    ? params.metadata.papers.filter((paper) => paperMatchesYearFilter(paper.year, activeYearFilter))
    : params.metadata.papers;
  const activeFacetFilters = normalizeSearchFacetFilters(
    params.facetFilters ?? params.metadata.facetFilters ?? EMPTY_SEARCH_FACET_FILTERS,
  );
  const filteredPapers = yearFilteredPapers.filter((paper) => {
    if (
      activeFacetFilters.fieldsOfStudy.length > 0 &&
      !activeFacetFilters.fieldsOfStudy.some((field) => paper.fieldsOfStudy?.includes(field))
    ) {
      return false;
    }
    if (
      activeFacetFilters.authors.length > 0 &&
      !activeFacetFilters.authors.some((author) =>
        paper.authors.some((paperAuthor) => paperAuthor.name === author),
      )
    ) {
      return false;
    }
    if (
      activeFacetFilters.venues.length > 0 &&
      !activeFacetFilters.venues.includes(paper.venue ?? "")
    ) {
      return false;
    }
    if (activeFacetFilters.hasPdf && !paper.openAccessPdf?.url && !paper.openAccess?.pdfUrl) {
      return false;
    }
    return true;
  });
  const effectiveSort = params.sortOption ?? resolveDefaultSearchSortOption(params.metadata);
  return sortSearchPapers(
    filteredPapers,
    effectiveSort,
    params.metadata.libraryContext?.combinedRankWeights ??
      params.metadata.libraryContext?.interestWeights,
    params.metadata.libraryContext?.libraryOnlyPaperIds ?? [],
    params.metadata.query,
    params.metadata.libraryContext?.rankingMode,
  );
}
