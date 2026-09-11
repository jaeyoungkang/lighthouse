import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";

describe("search-view facet projection", () => {
  const papers: SearchMetadata["papers"] = [
    {
      paperId: "keyword",
      title: "Agent Memory",
      abstract: null,
      year: 2024,
      venue: "arXiv.org",
      fieldsOfStudy: ["Computer Science"],
      citationCount: 10,
      url: "",
      authors: [{ name: "R. Lange" }],
      openAccessPdf: { url: "https://example.test/keyword.pdf" },
    },
    {
      paperId: "library-only",
      title: "Clinical Retrieval",
      abstract: null,
      year: 2023,
      venue: "Nature",
      fieldsOfStudy: ["Medicine"],
      citationCount: 20,
      url: "",
      authors: [{ name: "Chris Lu" }],
    },
  ];

  it("filters the loaded result window by fields, authors, venues, and PDF metadata", () => {
    const metadata: SearchMetadata = {
      type: "search",
      query: "agent memory",
      papers,
      total: 2,
      facetFilters: {
        fieldsOfStudy: ["Computer Science"],
        authors: ["R. Lange"],
        venues: ["arXiv.org"],
        hasPdf: true,
      },
    };

    expect(buildSearchResultPapers({ metadata }).map((paper) => paper.paperId)).toEqual([
      "keyword",
    ]);
  });

  it("keeps a library-only paper in the active combined pool's facet projection", () => {
    const metadata: SearchMetadata = {
      type: "search",
      query: "agent memory",
      papers,
      total: 2,
      sortOption: "interest",
      facetFilters: {
        fieldsOfStudy: ["Medicine"],
        authors: [],
        venues: [],
        hasPdf: false,
      },
      libraryContext: {
        folders: [{ name: "AI Agents" }],
        signalPresent: true,
        interestWeights: { "library-only": 1 },
        rankingMode: "combined_score",
        libraryOnlyPaperIds: ["library-only"],
      },
    };

    expect(buildSearchResultPapers({ metadata }).map((paper) => paper.paperId)).toEqual([
      "library-only",
    ]);
  });
});
