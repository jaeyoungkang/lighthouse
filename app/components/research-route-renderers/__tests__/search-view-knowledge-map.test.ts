import { describe, expect, it } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildCurrentGapNetworkSearchMetadata,
  buildGapNetworkSearchMetadata,
  shouldSkipLensOpen,
} from "@/app/components/research-route-renderers/search-view-knowledge-map";

function createSearchMetadata(overrides?: Partial<SearchMetadata>): SearchMetadata {
  return {
    type: "search",
    query: "agent systems",
    total: 1,
    papers: [
      {
        paperId: "paper-1",
        title: "Paper 1",
        abstract: "abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/paper-1",
        authors: [{ name: "Author 1", authorId: "a1" }],
        referenceIds: [],
        citationIds: [],
      },
    ],
    ...overrides,
  };
}

function createSearchView(metadata: SearchMetadata): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색 결과",
    content: "# 검색 결과",
    createdBy: "user",
    metadata,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:00:00.000Z",
  };
}

describe("search-view knowledge map", () => {
  it("does not skip real search ResearchRoutePayloads whose ids use the search-* prefix", () => {
    const metadata = createSearchMetadata();
    const document = createSearchView(metadata);

    expect(shouldSkipLensOpen(document, metadata)).toBe(false);
  });

  it("skips opening lenses when the search has no papers", () => {
    const metadata = createSearchMetadata({ papers: [], total: 0 });
    const document = createSearchView(metadata);

    expect(shouldSkipLensOpen(document, metadata)).toBe(true);
  });

  it("builds gap report metadata from the currently sorted result pool", () => {
    const metadata = createSearchMetadata({
      papers: [
        ...createSearchMetadata().papers,
        {
          paperId: "paper-2",
          title: "Paper 2",
          abstract: "abstract",
          year: 2025,
          citationCount: 20,
          url: "https://example.com/paper-2",
          authors: [{ name: "Author 2" }],
        },
      ],
    });
    const sortedPapers = [metadata.papers[1], metadata.papers[0]].filter(Boolean);

    const gapMetadata = buildGapNetworkSearchMetadata(metadata, sortedPapers);

    expect(gapMetadata.papers.map((paper) => paper.paperId)).toEqual(["paper-2", "paper-1"]);
    expect(gapMetadata.query).toBe(metadata.query);
  });

  it("can preserve an explicitly scoped gap report source set", () => {
    const metadata = createSearchMetadata({
      papers: [
        ...createSearchMetadata().papers,
        {
          paperId: "paper-2",
          title: "Paper 2",
          abstract: "abstract",
          year: 2025,
          citationCount: 20,
          url: "https://example.com/paper-2",
          authors: [{ name: "Author 2" }],
        },
        {
          paperId: "paper-3",
          title: "Paper 3",
          abstract: "abstract",
          year: 2026,
          citationCount: 30,
          url: "https://example.com/paper-3",
          authors: [{ name: "Author 3" }],
        },
      ],
    });
    const exposedPapers = [metadata.papers[2], metadata.papers[0]].filter(Boolean);

    const gapMetadata = buildGapNetworkSearchMetadata(metadata, exposedPapers);

    expect(gapMetadata.papers.map((paper) => paper.paperId)).toEqual(["paper-3", "paper-1"]);
  });

  it("derives agent-panel gap-network metadata from current sort and year filter", () => {
    const metadata = createSearchMetadata({
      sortOption: "relevance",
      yearFilter: "2024",
      papers: [
        {
          paperId: "paper-1",
          title: "Keyword Paper",
          abstract: "abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author 1" }],
        },
        {
          paperId: "paper-2",
          title: "Library-only Paper",
          abstract: "abstract",
          year: 2024,
          citationCount: 50,
          url: "https://example.com/paper-2",
          authors: [{ name: "Author 2" }],
        },
        {
          paperId: "paper-3",
          title: "Filtered Paper",
          abstract: "abstract",
          year: 2023,
          citationCount: 100,
          url: "https://example.com/paper-3",
          authors: [{ name: "Author 3" }],
        },
      ],
      libraryContext: {
        folders: [{ name: "내 컬렉션" }],
        signalPresent: true,
        interestWeights: { "paper-2": 100, "paper-3": 90 },
        libraryOnlyPaperIds: ["paper-2"],
      },
    });

    const gapMetadata = buildCurrentGapNetworkSearchMetadata(metadata);

    expect(gapMetadata.papers.map((paper) => paper.paperId)).toEqual(["paper-1"]);
  });

  it("includes library-only papers in the active combined-pool gap source", () => {
    const metadata = createSearchMetadata({
      total: 2,
      sortOption: "interest",
      papers: [
        ...createSearchMetadata().papers,
        {
          paperId: "paper-2",
          title: "Library-only Paper",
          abstract: "abstract",
          year: 2025,
          citationCount: 20,
          url: "https://example.com/paper-2",
          authors: [{ name: "Author 2" }],
        },
      ],
      libraryContext: {
        folders: [{ name: "내 컬렉션" }],
        signalPresent: true,
        interestWeights: { "paper-2": 2, "paper-1": 1 },
        rankingMode: "combined_score",
        libraryOnlyPaperIds: ["paper-2"],
      },
    });

    const gapMetadata = buildCurrentGapNetworkSearchMetadata(metadata);

    expect(gapMetadata.papers.map((paper) => paper.paperId)).toEqual(["paper-2", "paper-1"]);
  });
});
