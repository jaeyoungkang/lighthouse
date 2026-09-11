import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { selectRepresentativePapers } from "@/app/components/research/followup-reaction";

function createSearchMetadata(): SearchMetadata {
  return {
    type: "search",
    query: "legal retrieval",
    total: 3,
    graphSupport: {
      version: 1,
      source: "episteme-paper-neighborhood",
      basis: "loaded_result_sample",
      status: "ready",
      samplePaperIds: ["101", "202", "303"],
      generatedAt: "2026-06-01T00:00:00.000Z",
      paperScores: {
        "101": {
          defaultScore: 0.9,
          graphScore: 0.9,
          semanticScore: null,
          sharedCiters: 4,
          sharedRefs: 1,
          seedCount: 2,
          sources: ["co_cited"],
        },
        "303": {
          defaultScore: 2,
          graphScore: 2,
          semanticScore: null,
          sharedCiters: 10,
          sharedRefs: 2,
          seedCount: 2,
          sources: ["co_cited"],
        },
      },
    },
    papers: [
      {
        paperId: "101",
        title: "Legal Retrieval with Sparse Signals",
        abstract: "Legal retrieval methods for court documents.",
        year: 2024,
        citationCount: 20,
        url: "https://example.com/101",
        authors: [{ name: "Alice" }],
      },
      {
        paperId: "202",
        title: "Legal Retrieval with Citation Features",
        abstract: "Legal retrieval methods for court documents.",
        year: 2023,
        citationCount: 200,
        url: "https://example.com/202",
        authors: [{ name: "Bob" }],
      },
      {
        paperId: "303",
        title: "Chemical Retrieval of Catalysts",
        abstract: "Catalyst retrieval in chemistry.",
        year: 2022,
        citationCount: 1000,
        url: "https://example.com/303",
        authors: [{ name: "Carol" }],
      },
    ],
  };
}

describe("representative paper selection", () => {
  it("uses graph support after the fit gate and before citation tie-breaks", () => {
    const selected = selectRepresentativePapers(createSearchMetadata());

    expect(selected.map((paper) => paper.paperId)).toEqual(["101", "202"]);
  });

  it("keeps off-field high-citation papers out of representative badges", () => {
    const metadata = createSearchMetadata();
    metadata.query = "LLM activation engineering";
    metadata.papers = [
      {
        paperId: "paper-domain",
        title: "Activation Engineering for Large Language Models",
        abstract: "This paper studies activation steering methods for large language models.",
        year: 2025,
        citationCount: 30,
        url: "https://example.com/domain",
        authors: [{ name: "Alice" }],
      },
      {
        paperId: "paper-off-field",
        title: "Oxygen Activation on Catalytic Surfaces",
        abstract: "This materials science paper studies oxygen activation and catalysis.",
        year: 2018,
        citationCount: 9000,
        url: "https://example.com/off-field",
        authors: [{ name: "Bob" }],
      },
    ];

    expect(selectRepresentativePapers(metadata).map((paper) => paper.paperId)).toEqual([
      "paper-domain",
    ]);
  });
});
