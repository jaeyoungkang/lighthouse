// @promise promise:search-results-fast-window
// @check acceptance-check:search-results-fast-window-doi-exact-lookup

const DOI_PATTERN = /\b(10\.\d{4,9}\/\S+)\b/i;

function trimDoiCandidate(value: string): string {
  return value
    .trim()
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi\.org\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/[<>"'\s]+$/g, "")
    .replace(/[.,;]+$/g, "");
}

export function normalizeDoiSearchInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const decoded = (() => {
    try {
      return decodeURIComponent(trimmed);
    } catch {
      return trimmed;
    }
  })();
  const direct = trimDoiCandidate(decoded);
  const directMatch = direct.match(DOI_PATTERN);
  if (directMatch?.[1]) {
    return trimDoiCandidate(directMatch[1]);
  }

  const embeddedMatch = decoded.match(DOI_PATTERN);
  return embeddedMatch?.[1] ? trimDoiCandidate(embeddedMatch[1]) : null;
}

export function extractArxivIdFromDoi(doi: string): string | null {
  const match = doi.trim().match(/^10\.48550\/arxiv\.([0-9]{4}\.[0-9]{4,5})(?:v[0-9]+)?$/i);
  return match?.[1] ?? null;
}

export function buildDoiUrl(doi: string): string {
  const normalizedDoi = normalizeDoiSearchInput(doi) ?? trimDoiCandidate(doi);
  return `https://doi.org/${normalizedDoi}`;
}
