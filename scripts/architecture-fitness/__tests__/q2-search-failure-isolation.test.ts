import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSearchExecutionFromUrlParams,
  executeSearchFromUrl,
} from "@/app/server/services/search-execution";
import * as SearchServiceModule from "@/app/server/services/search-service";
import { resolveLibraryNeighborhoodPreflight } from "@/app/server/services/search-hydration";
import type * as SearchHydrationModule from "@/app/server/services/search-hydration";
import type { MappedPaper } from "@/app/server/services/search-service";

const keywordSearchExport = vi.hoisted(
  () => process.env.AF_Q2_KEYWORD_SEARCH_EXPORT?.trim() || "fetchEpistemePapers",
);
const reviewedPapersSourceMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ reviewedPapers: [{ paperId: "900", title: "Anchor paper" }] })),
);

vi.mock("@/app/server/services/search-service", async (importOriginal) => {
  const actual: typeof SearchServiceModule = await importOriginal();
  return {
    ...actual,
    [keywordSearchExport]: vi.fn(),
  };
});

vi.mock("@/app/server/services/search-hydration", async (importOriginal) => {
  const actual: typeof SearchHydrationModule = await importOriginal();
  return {
    ...actual,
    resolveLibraryNeighborhoodPreflight: vi.fn(),
  };
});

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  resolveMyReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
  resolveMyCachedReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
}));

type KeywordSearch = typeof SearchServiceModule.fetchEpistemePapers;
const mockedFetchKeywordPapers = vi.mocked(
  (SearchServiceModule as unknown as Record<string, KeywordSearch>)[keywordSearchExport],
);
const mockedResolvePreflight = vi.mocked(resolveLibraryNeighborhoodPreflight);

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

afterEach(() => {
  vi.clearAllMocks();
});

describe("Q2 reviewed-library source failure isolation", () => {
  it("keeps keyword results ready when the reviewed-library source read fails", async () => {
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval", lib: "1" });
    if (!input) throw new Error("expected search execution input");
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
    expect(
      (result.view.metadata as { papers: Array<{ paperId: string }> }).papers.map(
        (paper) => paper.paperId,
      ),
    ).toEqual(["101"]);
  });
});
