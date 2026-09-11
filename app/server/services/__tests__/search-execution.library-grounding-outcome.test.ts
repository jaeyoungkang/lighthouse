import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchExecutionFromUrlParams,
  executeSearchFromUrl,
} from "@/app/server/services/search-execution";
import {
  applyLibraryContextToSearchResults,
  resolveLibraryNeighborhoodPreflight,
} from "@/app/server/services/search-hydration";
import * as SearchServiceModule from "@/app/server/services/search-service";
import type * as SearchHydrationModule from "@/app/server/services/search-hydration";
import type { MappedPaper } from "@/app/server/services/search-service";

const reviewedPapersSourceMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ reviewedPapers: [{ paperId: "900", title: "Anchor paper" }] })),
);

vi.mock("@/app/server/services/search-service", async (importOriginal) => {
  const actual: typeof SearchServiceModule = await importOriginal();
  return {
    ...actual,
    fetchEpistemePapers: vi.fn(),
  };
});

vi.mock("@/app/server/services/search-hydration", async (importOriginal) => {
  const actual: typeof SearchHydrationModule = await importOriginal();
  return {
    ...actual,
    resolveLibraryNeighborhoodPreflight: vi.fn(),
    applyLibraryContextToSearchResults: vi.fn(() => null),
  };
});

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  resolveMyReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
  resolveMyCachedReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
}));

const mockedFetchKeywordPapers = vi.mocked(SearchServiceModule.fetchEpistemePapers);
const mockedResolvePreflight = vi.mocked(resolveLibraryNeighborhoodPreflight);
const mockedApplyLibraryContext = vi.mocked(applyLibraryContextToSearchResults);

function mappedPaper(id: string): MappedPaper {
  return {
    paperId: id,
    title: `Paper ${id}`,
    abstract: null,
    year: 2024,
    venue: "Venue",
    citationCount: 10,
    url: `https://example.com/${id}`,
    authors: ["Ada"],
  };
}

function resolveInput(params: Parameters<typeof buildSearchExecutionFromUrlParams>[0]) {
  const input = buildSearchExecutionFromUrlParams(params);
  if (!input) throw new Error("expected search execution input");
  return input;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("search execution library grounding outcome", () => {
  it("normalizes a legacy personalization opt-out into the unified result model", async () => {
    const input = resolveInput({
      q: "graph retrieval",
      personalize: "false",
      lib: "1",
    });
    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: [mappedPaper("101")],
      total: 1,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockResolvedValueOnce({
      libraryContext: {
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-07T00:00:00.000Z",
      },
      neighborhood: new Map(),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [],
      providerStatus: "ready",
    });
    mockedApplyLibraryContext.mockReturnValueOnce({
      papers: [mappedPaper("101")],
      total: 1,
      librarySummary: {
        folders: [{ name: "Graph" }],
        signalPresent: false,
        interestWeights: {},
      },
      libraryContextAvailable: true,
      resolvedSort: "relevance",
    });

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    expect(input.personalize).toBe(false);
    expect(reviewedPapersSourceMock).toHaveBeenCalledTimes(1);
    expect(mockedResolvePreflight).toHaveBeenCalledTimes(1);
    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "relevance",
      libraryGrounding: { requested: true, status: "no_signal" },
    });
  });

  it("keeps an honest empty graph result distinct from provider unavailability", async () => {
    const input = resolveInput({ q: "graph retrieval" });
    const keywordPapers = [mappedPaper("101")];
    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: keywordPapers,
      total: 1,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockResolvedValueOnce({
      libraryContext: {
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-07T00:00:00.000Z",
      },
      neighborhood: new Map(),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [],
      providerStatus: "ready",
    });
    mockedApplyLibraryContext.mockReturnValueOnce({
      papers: keywordPapers,
      total: 1,
      librarySummary: {
        folders: [{ name: "Graph" }],
        signalPresent: false,
        interestWeights: {},
      },
      libraryContextAvailable: true,
      resolvedSort: "relevance",
    });

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "relevance",
      libraryGrounding: { requested: true, status: "no_signal" },
    });
  });

  it("keeps keyword results ready when the live library source read fails", async () => {
    const input = resolveInput({ q: "graph retrieval", lib: "1" });
    const timingLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    reviewedPapersSourceMock.mockRejectedValueOnce(new Error("reviewed_papers unavailable"));
    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: [mappedPaper("101")],
      total: 1,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    expect(result.failed).toBe(false);
    expect(mockedResolvePreflight).not.toHaveBeenCalled();
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
    ]);
    expect(result.view.metadata).toMatchObject({
      type: "search",
      libraryGrounding: { requested: true, status: "unavailable" },
    });
    expect(timingLog).toHaveBeenCalledWith(
      "[search-timing]",
      expect.objectContaining({
        outcome: "ready",
        librarySourceOutcome: "failed",
        reviewedPaperCount: 0,
        libraryContextApplied: false,
        libraryGroundingStatus: "unavailable",
      }),
    );
  });
});

describe("search execution unavailable graph preflight", () => {
  it("preserves keyword results when the provider-backed preflight degrades", async () => {
    const input = resolveInput({ q: "graph retrieval" });
    const keywordPapers = [mappedPaper("101")];
    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: keywordPapers,
      total: 1,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockResolvedValueOnce({
      libraryContext: {
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-07T00:00:00.000Z",
      },
      neighborhood: new Map(),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [],
      providerStatus: "degraded",
    });

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    expect(mockedApplyLibraryContext).not.toHaveBeenCalled();
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
    ]);
    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "relevance",
      libraryGrounding: { requested: true, status: "unavailable" },
    });
  });
});
