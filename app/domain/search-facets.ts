export interface SearchFacetFilters {
  fieldsOfStudy: string[];
  authors: string[];
  venues: string[];
  hasPdf: boolean;
}

export const EMPTY_SEARCH_FACET_FILTERS: SearchFacetFilters = {
  fieldsOfStudy: [],
  authors: [],
  venues: [],
  hasPdf: false,
};

function normalizeList(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length > 0) seen.add(trimmed);
  }
  return [...seen].sort();
}

export function normalizeSearchFacetFilters(
  filters: Partial<SearchFacetFilters> | undefined,
): SearchFacetFilters {
  return {
    fieldsOfStudy: normalizeList(filters?.fieldsOfStudy),
    authors: normalizeList(filters?.authors),
    venues: normalizeList(filters?.venues),
    hasPdf: filters?.hasPdf === true,
  };
}

export function hasActiveSearchFacetFilters(
  filters: Partial<SearchFacetFilters> | undefined,
): boolean {
  const normalized = normalizeSearchFacetFilters(filters);
  return (
    normalized.fieldsOfStudy.length > 0 ||
    normalized.authors.length > 0 ||
    normalized.venues.length > 0 ||
    normalized.hasPdf
  );
}

export function buildSearchFacetFilterKey(filters: Partial<SearchFacetFilters> | undefined) {
  const normalized = normalizeSearchFacetFilters(filters);
  return [
    normalized.fieldsOfStudy.join("\u001f"),
    normalized.authors.join("\u001f"),
    normalized.venues.join("\u001f"),
    String(normalized.hasPdf),
  ].join("\u001e");
}
