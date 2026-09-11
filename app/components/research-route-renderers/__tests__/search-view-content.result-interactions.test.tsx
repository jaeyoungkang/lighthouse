import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";
import { createMetadata } from "./search-view-content.fixtures";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams.value,
}));

describe("search-view-content result interactions", () => {
  it("renders only the visible result window and advances through the load-more button", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = createMetadata(12);
    const onLoadMore = vi.fn();

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: agent memory"
          metadata={metadata}
          query="agent memory"
          sortOption="relevance"
          yearFilter=""
          isSearching={false}
          isError={false}
          analyzedCount={0}
          runningCount={0}
          queuedCount={0}
          isAnalyzing={false}
          isCreatingGapNetwork={false}
          visiblePapers={metadata.papers.slice(0, 10)}
          hasMorePapers
          analysisProgressMap={new Map()}
          analysisMap={new Map()}
          onQueryChange={vi.fn()}
          onSortChange={vi.fn()}
          personalize={true}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={onLoadMore}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.textContent).toContain("Agent Memory Paper 1");
    expect(container.textContent).toContain("Agent Memory Paper 10");
    expect(container.textContent).not.toContain("Agent Memory Paper 11");
    expect(container.textContent).toContain("더보기 (10/12)");

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/12)"),
    );

    expect(loadMoreButton).toBeTruthy();
    if (!loadMoreButton) {
      throw new Error("expected load-more button");
    }

    act(() => {
      loadMoreButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
