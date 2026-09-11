import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { shouldRepairSearchHydrationMetadata } from "@/app/lib/search-hydration-state";
import type { MappedPaper } from "@/app/server/services/search-service";

const {
  requireOwnerPrincipalAuthMock,
  hydrateSearchMetadataWithCachedInlineAnalysisMock,
  getReviewedStatusMock,
  computeSearchHydrationPaperDeltaMock,
  computeSearchHydrationMock,
  shouldRepairSearchHydrationMock,
  buildSearchViewPayloadMock,
  buildDocumentPaperMock,
} = vi.hoisted(() => ({
  requireOwnerPrincipalAuthMock: vi.fn(),
  hydrateSearchMetadataWithCachedInlineAnalysisMock: vi.fn(),
  getReviewedStatusMock: vi.fn(),
  computeSearchHydrationPaperDeltaMock: vi.fn(),
  computeSearchHydrationMock: vi.fn(),
  shouldRepairSearchHydrationMock: vi.fn(),
  buildSearchViewPayloadMock: vi.fn(),
  buildDocumentPaperMock: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth: requireOwnerPrincipalAuthMock,
}));

vi.mock("@/app/server/domain-access/inline-analysis-access", () => ({
  hydrateSearchMetadataWithCachedInlineAnalysis: hydrateSearchMetadataWithCachedInlineAnalysisMock,
}));

vi.mock("@/app/server/repository/reviewed-papers", () => ({
  getReviewedStatus: getReviewedStatusMock,
}));

vi.mock("@/app/server/services/search-hydration", () => ({
  computeSearchHydrationPaperDelta: computeSearchHydrationPaperDeltaMock,
  computeSearchHydration: computeSearchHydrationMock,
  shouldRepairSearchHydration: shouldRepairSearchHydrationMock,
}));

vi.mock("@/app/server/services/search-service", () => ({
  buildDocumentPaper: buildDocumentPaperMock,
  buildSearchViewPayload: buildSearchViewPayloadMock,
}));

function mappedPaper(id: string): MappedPaper {
  return {
    paperId: id,
    title: `Paper ${id}`,
    abstract: `Abstract ${id}`,
    year: 2024,
    citationCount: 10,
    url: `https://example.com/${id}`,
    authors: ["Ada"],
  };
}

function searchMetadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  return {
    type: "search",
    query: "graph retrieval",
    sortOption: "relevance",
    papers: [
      {
        paperId: "101",
        title: "Lightweight 101",
        abstract: null,
        year: 2024,
        citationCount: 3,
        url: "https://example.com/101",
        authors: [],
      },
    ],
    total: 57,
    abstractHydration: { status: "pending", personalize: true },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerPrincipalAuthMock.mockResolvedValue({
    db: { source: "db" },
    user: { id: "user-1", email: "reader@example.com" },
  });
  getReviewedStatusMock.mockResolvedValue(new Map());
  buildDocumentPaperMock.mockImplementation((paper: MappedPaper) => ({
    ...paper,
    authors: paper.authors.map((name) => ({ name })),
  }));
  shouldRepairSearchHydrationMock.mockReturnValue(false);
  hydrateSearchMetadataWithCachedInlineAnalysisMock.mockImplementation(
    ({ metadata }: { metadata: SearchMetadata }) => Promise.resolve(metadata),
  );
  buildSearchViewPayloadMock.mockImplementation(
    (
      _ownerPrincipalId: string,
      query: string,
      papers: MappedPaper[],
      total: number,
      _createdBy: "user" | "agent",
      _queryClauses: unknown,
      _totalMode: SearchMetadata["totalMode"],
      _clauseStats: unknown,
      _userId: string,
      _reviewedMap: Map<string, Date>,
      _seedPaper: unknown,
      _termSeed: unknown,
      _spellingCorrection: unknown,
      sortOption: SearchMetadata["sortOption"] | undefined,
      _yearFilter: string | undefined,
      _facetFilters: unknown,
      _exactLookup: unknown,
      _paging: unknown,
      _source: unknown,
      libraryGrounding: { context?: SearchMetadata["libraryContext"]; available?: boolean },
      abstractHydration: SearchMetadata["abstractHydration"],
    ) => ({
      metadata: {
        type: "search",
        query,
        sortOption: sortOption ?? "relevance",
        papers: papers.map((paper) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.year,
          citationCount: paper.citationCount,
          url: paper.url,
          authors: paper.authors.map((name) => ({ name })),
        })),
        total,
        ...(libraryGrounding.context ? { libraryContext: libraryGrounding.context } : {}),
        ...(libraryGrounding.available ? { libraryContextAvailable: true } : {}),
        ...(abstractHydration ? { abstractHydration } : {}),
      } satisfies SearchMetadata,
    }),
  );
});

describe("enrichSearchSnapshot", () => {
  it("returns only the v1 hydration delta for a projected command", async () => {
    computeSearchHydrationPaperDeltaMock.mockResolvedValueOnce([mappedPaper("101")]);
    const { enrichSearchCommand } = await import("../search-enrichment-access");

    const result = await enrichSearchCommand({
      schemaVersion: 1,
      target: { query: "graph retrieval", orderedPaperIds: ["101", "202"] },
      hydration: { status: "pending", libraryOnlyPaperIds: [] },
    });

    expect(result.target.orderedPaperIds).toEqual(["101", "202"]);
    expect(result.delta.papers).toEqual([expect.objectContaining({ paperId: "101" })]);
    expect(result.delta.papers[0]).not.toHaveProperty("title");
    expect(result.delta.papers[0]).not.toHaveProperty("year");
    expect(result.delta.papers[0]).not.toHaveProperty("citationCount");
    expect(result.delta.papers[0]).not.toHaveProperty("url");
    expect(result.delta.papers[0]).not.toHaveProperty("inlineAnalysis");
    expect(result.delta.abstractHydration).toEqual({ status: "ready" });
    expect(result).not.toHaveProperty("metadata");
    expect(hydrateSearchMetadataWithCachedInlineAnalysisMock).not.toHaveBeenCalled();
  });

  it("does not terminalize a ready-snapshot repair when hydration fails", async () => {
    const failure = new Error("Episteme unavailable");
    shouldRepairSearchHydrationMock.mockReturnValueOnce(true);
    computeSearchHydrationMock.mockRejectedValueOnce(failure);

    const { enrichSearchSnapshot } = await import("../search-enrichment-access");

    await expect(
      enrichSearchSnapshot({
        query: "graph retrieval",
        metadata: searchMetadata({
          abstractHydration: { status: "ready", personalize: true },
        }),
      }),
    ).rejects.toBe(failure);
    expect(buildSearchViewPayloadMock).not.toHaveBeenCalled();
  });

  it("marks a successful empty ready-snapshot repair as terminal", async () => {
    shouldRepairSearchHydrationMock.mockReturnValueOnce(true);
    computeSearchHydrationMock.mockResolvedValueOnce(null);

    const { enrichSearchSnapshot } = await import("../search-enrichment-access");
    const result = await enrichSearchSnapshot({
      query: "graph retrieval",
      metadata: searchMetadata({
        abstractHydration: { status: "ready", personalize: true },
      }),
    });

    expect(result.metadata.abstractHydration).toEqual({
      status: "ready",
      personalize: true,
      repairAttempted: true,
    });
    expect(shouldRepairSearchHydrationMetadata(result.metadata)).toBe(false);
    expect(buildSearchViewPayloadMock).not.toHaveBeenCalled();
  });

  it("marks a successful empty pending hydration as terminal without rebuilding cards", async () => {
    computeSearchHydrationMock.mockResolvedValueOnce(null);

    const { enrichSearchSnapshot } = await import("../search-enrichment-access");
    const result = await enrichSearchSnapshot({
      query: "graph retrieval",
      metadata: searchMetadata(),
    });

    expect(result.metadata.papers).toEqual(searchMetadata().papers);
    expect(result.metadata.abstractHydration).toEqual({
      status: "ready",
      personalize: true,
      repairAttempted: true,
    });
    expect(shouldRepairSearchHydrationMetadata(result.metadata)).toBe(false);
    expect(buildSearchViewPayloadMock).not.toHaveBeenCalled();
  });

  it("preserves the terminal repair marker when hydration returns no usable card details", async () => {
    shouldRepairSearchHydrationMock.mockReturnValueOnce(true);
    computeSearchHydrationMock.mockResolvedValueOnce({
      papers: [
        {
          ...mappedPaper("101"),
          abstract: null,
          authors: [],
          referenceCount: null,
        },
      ],
      total: 57,
      librarySummary: undefined,
      libraryContextAvailable: false,
      resolvedSort: "relevance",
    });

    const { enrichSearchSnapshot } = await import("../search-enrichment-access");
    const result = await enrichSearchSnapshot({
      query: "graph retrieval",
      metadata: searchMetadata({
        abstractHydration: { status: "ready", personalize: true },
      }),
    });

    expect(buildSearchViewPayloadMock.mock.calls[0]?.at(-1)).toEqual(
      expect.objectContaining({ repairAttempted: true, status: "ready" }),
    );
    expect(result.metadata.abstractHydration).toEqual({
      status: "ready",
      personalize: true,
      repairAttempted: true,
    });
  });

  it("preserves first-reveal graph support while hydrating committed cards", async () => {
    const graphSupport: NonNullable<SearchMetadata["graphSupport"]> = {
      version: 2,
      source: "episteme-paper-neighborhood",
      basis: "library_anchor_neighborhood",
      status: "ready",
      anchorPaperCount: 1,
      samplePaperIds: ["101"],
      paperScores: {},
      candidateCounts: {
        providerReturned: 1,
        hydrated: 1,
        keywordOverlap: 1,
        admittedSupplement: 0,
        deferredByQueryRelevance: 0,
        filteredOut: {
          candidateCap: 0,
          hydrationUnavailable: 0,
          publicationYear: 0,
          nonPositiveScore: 0,
          titleFamilyDuplicate: 0,
        },
      },
      generatedAt: "2026-07-14T00:00:00.000Z",
    };
    computeSearchHydrationMock.mockResolvedValueOnce({
      papers: [mappedPaper("101")],
      total: 57,
      librarySummary: undefined,
      libraryContextAvailable: true,
      resolvedSort: "relevance",
    });

    const { enrichSearchSnapshot } = await import("../search-enrichment-access");
    const result = await enrichSearchSnapshot({
      query: "graph retrieval",
      metadata: searchMetadata({ libraryContextAvailable: true, graphSupport }),
    });

    expect(computeSearchHydrationMock).toHaveBeenCalledWith(
      expect.objectContaining({ libraryContextAvailable: true }),
      "reader@example.com",
      undefined,
      { repairReady: true },
    );
    expect(buildSearchViewPayloadMock).toHaveBeenCalledWith(
      "user-1",
      "graph retrieval",
      [expect.objectContaining({ paperId: "101" })],
      57,
      "user",
      undefined,
      undefined,
      undefined,
      "user-1",
      expect.any(Map),
      undefined,
      undefined,
      undefined,
      "relevance",
      "",
      undefined,
      undefined,
      undefined,
      undefined,
      { context: undefined, available: true },
      expect.objectContaining({ status: "ready" }),
    );
    expect(result.metadata.libraryContextAvailable).toBe(true);
    expect(result.metadata.graphSupport).toEqual(graphSupport);
  });
});
