import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";

function MockInlineReaction({ inlineBodyAppendSlot }: { inlineBodyAppendSlot?: ReactNode }) {
  return (
    <p data-testid="mock-ai-comment-body">
      검색 결과 해설 본문
      {inlineBodyAppendSlot ? <> {inlineBodyAppendSlot}</> : null}
    </p>
  );
}

function createMetadata(paperCount = 1): SearchMetadata {
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

function renderResultsState(metadata: SearchMetadata): HTMLElement {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <SearchViewResultsState
        ownerPrincipalId="principal-1"
        sourceSnapshotId="search-1"
        documentTitle={`검색: ${metadata.query}`}
        metadata={metadata}
        query={metadata.query}
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
        onOpenGapNetwork={vi.fn()}
        onOpenCitationLineage={vi.fn()}
        onFindSimilar={vi.fn()}
        onSearchTerm={vi.fn()}
        onLoadMore={vi.fn()}
        citationLineageLoadingPaperId={null}
        reactionSlot={
          <div data-testid="research-route-inline-reaction">
            <MockInlineReaction />
          </div>
        }
      />,
    );
  });
  return container;
}

describe("search-view-content research term discovery", () => {
  it("keeps research terms as clickable AI comment text", () => {
    const metadata: SearchMetadata = {
      ...createMetadata(2),
      query: "에이전트 기억",
      termSeed: {
        sourceQuery: "에이전트",
        term: "agent memory",
        candidateType: "direct",
        supportCount: 2,
      },
      englishTermCandidates: [
        {
          term: "workflow memory",
          type: "broader",
          confidence: "high",
          supportCount: 2,
          samplePaperIds: ["paper-1", "paper-2"],
          basis: "제목·초록에서 2편이 뒷받침합니다. 예: Agent Memory Paper 1",
        },
      ],
    };

    const container = renderResultsState(metadata);
    const resultsColumn = container.querySelector('[data-testid="search-results-list-column"]');
    const aiCommentTerms = container.querySelector(
      '[data-testid="search-ai-comment-research-terms"]',
    );
    const aiCommentBody = container.querySelector('[data-testid="mock-ai-comment-body"]');

    // Research terms live inside the AI comment body as compact text links.
    expect(aiCommentBody?.contains(aiCommentTerms)).toBe(true);
    expect(resultsColumn?.textContent).toContain("주요 연구 용어");
    expect(resultsColumn?.textContent).toContain("workflow memory");
    expect(aiCommentTerms?.textContent).toContain("주요 연구 용어");
    expect(aiCommentTerms?.textContent).toContain("workflow memory");
  });

  it("preserves the term seed without rendering a results-header iteration trace", () => {
    const metadata: SearchMetadata = {
      ...createMetadata(1),
      query: "agent memory",
      termSeed: {
        sourceQuery: "에이전트 기억",
        term: "agent memory",
        candidateType: "direct",
        supportCount: 2,
      },
    };

    const container = renderResultsState(metadata);

    expect(metadata.termSeed?.term).toBe("agent memory");
    expect(container.querySelector('[data-testid="search-term-seed-trace"]')).toBeNull();
    expect(container.textContent).not.toContain("이전 용어");
  });

  it("does not render an iteration trace for an ordinary search without a term seed", () => {
    const container = renderResultsState(createMetadata(1));

    expect(container.querySelector('[data-testid="search-term-seed-trace"]')).toBeNull();
  });
});
