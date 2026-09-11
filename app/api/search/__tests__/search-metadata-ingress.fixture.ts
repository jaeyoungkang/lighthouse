import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SEARCH_DOCUMENT_FETCH_LIMIT,
  SEARCH_LIBRARY_NEAR_BAND_LIMIT,
  SEARCH_RESULT_POOL_PAPER_LIMIT,
} from "@/app/lib/constants";
import { applyLibraryContextToSearchResults } from "@/app/server/services/search-hydration";
import { buildDocumentPaper, type MappedPaper } from "@/app/server/services/search-service";

const FIXTURE_QUERY = "combined result pool";

function mappedPaper(prefix: "keyword" | "graph", index: number): MappedPaper {
  const paperId = `${prefix}-${String(index + 1)}`;
  return {
    paperId,
    title: `${prefix} paper ${String(index + 1)}`,
    abstract: `Abstract for ${paperId}`,
    year: 2026,
    citationCount: index,
    url: `https://example.com/${paperId}`,
    authors: ["Ada Lovelace"],
  };
}

export function buildMaximalProducedSearchMetadata(): SearchMetadata {
  const keywordPapers = Array.from({ length: SEARCH_DOCUMENT_FETCH_LIMIT }, (_, index) =>
    mappedPaper("keyword", index),
  );
  const graphPapers = Array.from({ length: SEARCH_LIBRARY_NEAR_BAND_LIMIT }, (_, index) =>
    mappedPaper("graph", index),
  );
  const result = applyLibraryContextToSearchResults({
    keywordPapers,
    providerTotal: keywordPapers.length,
    query: FIXTURE_QUERY,
    preflight: {
      libraryContext: {
        folders: [{ name: "Research", anchorCorpusIds: ["anchor-1"] }],
        neighborhood: {},
        computedAt: "2026-08-05T00:00:00.000Z",
      },
      neighborhood: new Map(
        graphPapers.map((paper, index) => [paper.paperId, graphPapers.length - index]),
      ),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["anchor-1"],
      hydratedCandidates: graphPapers,
    },
  });
  if (!result || result.papers.length !== SEARCH_RESULT_POOL_PAPER_LIMIT) {
    throw new Error("maximal search producer fixture did not fill the combined result pool");
  }
  return {
    type: "search",
    query: FIXTURE_QUERY,
    papers: result.papers.map((paper) => buildDocumentPaper(paper)),
    total: result.total,
    libraryContext: result.librarySummary,
    sortOption: result.resolvedSort,
  };
}

export function buildOversizedSearchMetadata(metadata: SearchMetadata): SearchMetadata {
  const firstPaper = metadata.papers[0];
  return {
    ...metadata,
    papers: [
      ...metadata.papers,
      {
        ...firstPaper,
        paperId: "overflow-paper",
        title: "Overflow paper",
        url: "https://example.com/overflow-paper",
      },
    ],
  };
}
