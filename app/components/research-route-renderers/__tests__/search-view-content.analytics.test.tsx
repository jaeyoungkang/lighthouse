import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { useSearchResultsViewedTracking } from "@/app/components/research-route-renderers/search-results-viewed-analytics";
import { trackSearchResultsViewed } from "@/app/lib/track";
import type * as TrackModule from "@/app/lib/track";

vi.mock("@/app/lib/track", async (importOriginal) => {
  const actual = await importOriginal<typeof TrackModule>();
  return { ...actual, trackSearchResultsViewed: vi.fn() };
});

const trackSearchResultsViewedMock = vi.mocked(trackSearchResultsViewed);

function createMetadata(): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: 2,
    sortOption: "interest",
    abstractHydration: { status: "ready", personalize: true },
    libraryContext: {
      folders: [{ name: "내 연구" }],
      signalPresent: true,
      interestWeights: {},
      anchorPaperCount: 4,
    },
    papers: [1, 2].map((index) => ({
      paperId: `paper-${String(index)}`,
      title: `Agent Memory Paper ${String(index)}`,
      abstract: null,
      year: 2024,
      citationCount: index,
      url: "",
      authors: [],
    })),
  };
}

describe("search result collection boundary", () => {
  beforeEach(() => trackSearchResultsViewedMock.mockClear());

  it("emits from the general visible-results boundary for every query language and sort", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = createMetadata();

    function Harness() {
      useSearchResultsViewedTracking({
        ownerPrincipalId: "principal-1",
        sourceSnapshotId: "search-context-1",
        metadata,
        sortOption: "interest",
        yearFilter: "",
        effectiveResultCount: 2,
        visiblePapers: metadata.papers,
      });
      return null;
    }

    act(() => {
      root.render(<Harness />);
    });

    expect(trackSearchResultsViewedMock).toHaveBeenCalledTimes(1);
    expect(trackSearchResultsViewedMock).toHaveBeenCalledWith({
      type: "user_search",
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "search-context-1",
        journeyContextId: "search-context-1",
        searchContextId: "search-context-1",
        query: "agent memory",
        sort: "interest",
        year: "",
        resultCount: 2,
        visibleResultCount: 2,
        libraryGroundingApplied: false,
        libraryAnchorPaperCount: 4,
      },
    });
  });
});
