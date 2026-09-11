// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-publication-year-range-filter

export function normalizeYearRangeFilter(yearFilter: string | undefined): string | null {
  if (!yearFilter) return "";
  const trimmed = yearFilter.trim();
  if (!trimmed) return "";

  const match = /^(?:(\d{4})(?:-(\d{4})?)?|-(\d{4}))$/.exec(trimmed);
  if (!match) return null;

  const fromText = match[1];
  const rangeToText = match[2];
  const upperOnlyText = match[3];
  if (upperOnlyText) return `-${upperOnlyText}`;
  if (!fromText) return null;
  if (!trimmed.includes("-")) return fromText;
  if (!rangeToText) return `${fromText}-`;
  if (fromText === rangeToText) return fromText;
  return Number(fromText) > Number(rangeToText)
    ? `${rangeToText}-${fromText}`
    : `${fromText}-${rangeToText}`;
}

export function isValidYearRangeFilterSyntax(yearFilter: string): boolean {
  return yearFilter === yearFilter.trim() && normalizeYearRangeFilter(yearFilter) !== null;
}

export function parseYearRangeFilter(yearFilter: string | undefined): {
  from: number | null;
  to: number | null;
} {
  const normalized = normalizeYearRangeFilter(yearFilter);
  if (normalized == null || normalized.length === 0) return { from: null, to: null };
  if (!normalized.includes("-")) {
    const year = Number(normalized);
    return { from: year, to: year };
  }
  const dashIndex = normalized.indexOf("-");
  const fromText = normalized.slice(0, dashIndex);
  const toText = normalized.slice(dashIndex + 1);
  return {
    from: fromText.length === 0 ? null : Number(fromText),
    to: toText.length === 0 ? null : Number(toText),
  };
}

export function buildYearRangeFilter(from: number | null, to: number | null): string {
  if (from == null && to == null) return "";
  const shouldSwap = from != null && to != null && from > to;
  const normalizedFrom = shouldSwap ? to : from;
  const normalizedTo = shouldSwap ? from : to;
  if (normalizedFrom != null && normalizedTo != null && normalizedFrom === normalizedTo) {
    return String(normalizedFrom);
  }
  return `${normalizedFrom == null ? "" : String(normalizedFrom)}-${normalizedTo == null ? "" : String(normalizedTo)}`;
}

export function paperMatchesYearFilter(
  paperYear: number | null | undefined,
  yearFilter: string | undefined,
): boolean {
  if (!yearFilter) return true;
  const { from, to } = parseYearRangeFilter(yearFilter);
  if (from == null && to == null) return true;
  if (paperYear == null) return false;
  if (from != null && paperYear < from) return false;
  if (to != null && paperYear > to) return false;
  return true;
}
