import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";

function createMetadata(paperCount = 12): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: paperCount,
    papers: Array.from({ length: paperCount }, (_, index) => ({
      paperId: `paper-${String(index + 1)}`,
      title: `Agent Memory Paper ${String(index + 1)}`,
      abstract: `abstract ${String(index + 1)}`,
      year: 2024,
      citationCount: 12 - index,
      url: `https://example.com/paper-${String(index + 1)}`,
      authors: [{ name: "Alice" }],
      openAccessPdf: { url: `https://example.com/paper-${String(index + 1)}.pdf` },
      doi: null,
      referenceIds: null,
      citationIds: null,
    })),
  };
}

describe("SearchView representative reveal", () => {
  it("reveals a paper from a representative-card event beyond the visible window", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = createMetadata();
    const onEnsurePaperVisible = vi.fn();

    function RevealHarness() {
      const [visibleCount, setVisibleCount] = useState(10);
      return (
        <div data-doc-id="search-1">
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
            visiblePapers={metadata.papers.slice(0, visibleCount)}
            hasMorePapers={visibleCount < metadata.papers.length}
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
            onSearchTerm={vi.fn()}
            onEnsurePaperVisible={(paperIndex) => {
              onEnsurePaperVisible(paperIndex);
              setVisibleCount((current) => Math.max(current, paperIndex + 1));
            }}
            onLoadMore={vi.fn()}
            citationLineageLoadingPaperId={null}
          />
        </div>
      );
    }

    act(() => {
      root.render(<RevealHarness />);
    });

    expect(container.textContent).not.toContain("Agent Memory Paper 12");

    const originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };

    act(() => {
      window.dispatchEvent(
        new CustomEvent("lighthouse:reveal-paper", {
          detail: { documentId: "search-1", paperId: "paper-12" },
        }),
      );
    });
    window.requestAnimationFrame = originalRequestAnimationFrame;

    expect(onEnsurePaperVisible).toHaveBeenCalledWith(11);
    expect(container.textContent).toContain("Agent Memory Paper 12");
    expect(container.querySelector('[data-paper-id="paper-12"]')).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });
});
