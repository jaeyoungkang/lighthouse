import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";
import type {
  FollowupActivationEvent,
  GapNetworkOpenOptions,
} from "@/app/components/research-route-renderers/search-view.helpers";
import { createMetadata } from "./search-view-content.fixtures";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("search-view representative filter", () => {
  it("passes the current result pool to the gap action even when only 10 cards are visible", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = createMetadata(45);
    const onOpenGapNetwork =
      vi.fn<(event?: FollowupActivationEvent, options?: GapNetworkOpenOptions) => void>();

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: agent memory"
          metadata={metadata}
          query="agent"
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
          resultCount={metadata.papers.length}
          hasMorePapers={true}
          analysisProgressMap={new Map()}
          analysisMap={new Map()}
          onQueryChange={vi.fn()}
          onSortChange={vi.fn()}
          personalize={true}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={onOpenGapNetwork}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.textContent).toContain("Agent Memory Paper 10");
    expect(container.textContent).not.toContain("Agent Memory Paper 11");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-results-gap-network-action"]')
        ?.click();
    });

    const [event, options] = onOpenGapNetwork.mock.calls[0] ?? [];
    expect(event).toEqual(expect.objectContaining({ ctrlKey: true }));
    expect(options?.papers).toHaveLength(45);
    expect(options?.papers?.[0]?.paperId).toBe("paper-1");
    expect(options?.papers?.[39]?.paperId).toBe("paper-40");
  });

  it("filters the visible list but opens gap analysis from the current top-result pool", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const basePaper = createMetadata().papers[0];
    const metadata: SearchMetadata = {
      ...createMetadata(4),
      query: "agent",
      papers: [
        {
          ...basePaper,
          paperId: "paper-1",
          title: "Unrelated Systems Survey",
          abstract: "general distributed systems",
        },
        {
          ...basePaper,
          paperId: "paper-2",
          title: "Agent Retrieval Memory",
          abstract: "agent memory retrieval",
        },
        {
          ...basePaper,
          paperId: "paper-3",
          title: "Agent Evaluation Memory",
          abstract: "agent memory evaluation",
        },
        {
          ...basePaper,
          paperId: "paper-4",
          title: "Agent Workflow Memory",
          abstract: "agent memory workflows",
        },
      ],
    };
    const onOpenGapNetwork =
      vi.fn<(event?: FollowupActivationEvent, options?: GapNetworkOpenOptions) => void>();

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: agent memory"
          metadata={metadata}
          query="agent"
          sortOption="relevance"
          yearFilter=""
          isSearching={false}
          isError={false}
          analyzedCount={0}
          runningCount={0}
          queuedCount={0}
          isAnalyzing={false}
          isCreatingGapNetwork={false}
          visiblePapers={metadata.papers}
          hasMorePapers={false}
          analysisProgressMap={new Map()}
          analysisMap={new Map()}
          onQueryChange={vi.fn()}
          onSortChange={vi.fn()}
          personalize={true}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={onOpenGapNetwork}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.textContent).toContain("Unrelated Systems Survey");
    expect(
      container.querySelectorAll('[data-testid="search-result-representative-badge"]'),
    ).toHaveLength(3);

    act(() => {
      container
        .querySelector<HTMLInputElement>('[data-testid="search-representative-filter"]')
        ?.click();
    });

    expect(container.textContent).not.toContain("Unrelated Systems Survey");
    expect(container.textContent).toContain("Agent Retrieval Memory");
    expect(container.textContent).toContain("Agent Evaluation Memory");
    expect(container.textContent).toContain("Agent Workflow Memory");

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-results-gap-network-action"]')
        ?.click();
    });

    expect(onOpenGapNetwork).toHaveBeenCalledWith(
      expect.objectContaining({ ctrlKey: true }),
      expect.objectContaining({
        papers: [
          expect.objectContaining({ paperId: "paper-1" }),
          expect.objectContaining({ paperId: "paper-2" }),
          expect.objectContaining({ paperId: "paper-3" }),
          expect.objectContaining({ paperId: "paper-4" }),
        ],
      }),
    );
  });
});
