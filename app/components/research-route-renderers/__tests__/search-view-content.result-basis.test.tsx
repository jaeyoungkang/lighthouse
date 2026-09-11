import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SearchViewResultsState,
  patchActiveSearchFacetFilters,
} from "@/app/components/research-route-renderers/search-view-content";
import { createMetadata } from "./search-view-content.fixtures";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const roots = new Set<Root>();

function createTestRoot(container: Element): Root {
  const root = createRoot(container);
  roots.add(root);
  return root;
}

function requireText(element: Element | null | undefined): string {
  if (!element) {
    throw new Error("Expected element to exist");
  }
  return element.textContent.trim();
}

afterEach(() => {
  act(() => {
    for (const root of roots) {
      root.unmount();
    }
  });
  roots.clear();
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
});

describe("search-view-content result basis", () => {
  it.each([
    [{ requested: false, status: "not_requested" }, false],
    [{ requested: true, status: "applied" }, false],
    [{ requested: true, status: "no_signal" }, false],
    [{ requested: true, status: "unavailable" }, true],
  ] as const)(
    "renders the degraded notice only for library grounding %s",
    (libraryGrounding, expectsNotice) => {
      const container = document.createElement("div");
      const root = createTestRoot(container);
      const metadata: SearchMetadata = {
        ...createMetadata(2),
        sortOption: "relevance",
        libraryContextAvailable: true,
        libraryGrounding,
      };

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
            visiblePapers={metadata.papers}
            hasMorePapers={false}
            analysisProgressMap={new Map()}
            analysisMap={new Map()}
            onQueryChange={vi.fn()}
            onSortChange={vi.fn()}
            personalize={libraryGrounding.requested}
            libraryContextAvailable
            onPersonalizeChange={vi.fn()}
            onYearRangeApply={vi.fn()}
            onOpenGapNetwork={vi.fn()}
            onOpenCitationLineage={vi.fn()}
            onFindSimilar={vi.fn()}
            onLoadMore={vi.fn()}
            citationLineageLoadingPaperId={null}
          />,
        );
      });

      const notice = container.querySelector(
        '[data-testid="search-library-grounding-unavailable"]',
      );
      expect(notice !== null).toBe(expectsNotice);
      if (expectsNotice) {
        expect(notice?.getAttribute("role")).toBe("status");
        expect(notice?.textContent).toBe(
          "내 라이브러리를 이번 결과에 반영하지 못했어요. 검색 결과는 계속 볼 수 있어요.",
        );
      }
      const expectedLibraryState = libraryGrounding.status === "applied" ? "반영" : "반영 없음";
      expect(container.querySelector('[data-testid="search-result-basis"]')?.textContent).toContain(
        `내 라이브러리 ${expectedLibraryState}`,
      );
      expect(container.textContent).toContain("Agent Memory Paper 1");
    },
  );

  it("does not present provider total as the loaded result window", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const metadata: SearchMetadata = {
      ...createMetadata(3),
      total: 100,
      sortOption: "interest",
      queryClauses: [
        {
          rawClause: "machine learning, climate change",
          normalizedClause: "machine learning, climate change",
          role: "other",
          isExtractive: true,
          derivedExpansions: [],
        },
      ],
      libraryContext: {
        folders: [{ name: "표현학습" }],
        signalPresent: true,
        interestWeights: {},
        computedAt: "2026-06-01T03:04:05.000Z",
        anchorPaperCount: 7,
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: machine learning, climate change"
          metadata={metadata}
          query="machine learning, climate change"
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
          personalize={false}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    const basis = container.querySelector('[data-testid="search-result-basis"]');
    expect(basis?.textContent).toBe(
      "Moonlight Search 기반 · 현재 3편 적재 · 기본순 · 내 라이브러리 반영 없음",
    );
    expect(basis?.textContent).not.toContain("100건 중");
    expect(basis?.textContent).not.toContain("조건 병합");
  });

  it("explains the loaded search result basis in the results header", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const metadata: SearchMetadata = {
      ...createMetadata(3),
      total: 120,
      sortOption: "citationCount",
      yearFilter: "2024",
      totalMode: "merged",
      queryClauses: [
        {
          rawClause: "agent memory",
          normalizedClause: "agent memory",
          role: "anchor",
          isExtractive: true,
          derivedExpansions: [],
        },
        {
          rawClause: "retrieval",
          normalizedClause: "retrieval",
          role: "theme",
          isExtractive: true,
          derivedExpansions: [],
        },
      ],
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: agent memory"
          metadata={metadata}
          query="agent memory"
          sortOption="citationCount"
          yearFilter="2024"
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
          personalize={false}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    const basis = container.querySelector('[data-testid="search-result-basis"]');
    expect(basis?.textContent).toBe(
      "Moonlight Search 기반 · 2개 조건 병합 · 현재 3편 적재 · 인용순 · 내 라이브러리 반영 없음 · 2024년",
    );
    expect(basis?.textContent).not.toContain("상위 40편");
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).not.toContain("검색: agent memory");
  });

  it("uses the standard result basis with owned header controls", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const metadata: SearchMetadata = {
      ...createMetadata(3),
      sortOption: "interest",
      libraryContext: {
        folders: [{ name: "표현학습" }],
        signalPresent: true,
        interestWeights: {},
        computedAt: "2026-06-01T03:04:05.000Z",
        anchorPaperCount: 7,
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: self-supervised learning"
          metadata={metadata}
          query="self-supervised learning"
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
          personalize={false}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    const basis = container.querySelector('[data-testid="search-result-basis"]');
    expect(basis?.textContent).toContain("Moonlight Search 기반");
    expect(basis?.textContent).toContain("기본순");
    expect(basis?.textContent).toContain("내 라이브러리 반영");
    expect(basis?.textContent).not.toContain("내 연구 기준");
    expect(basis?.textContent).not.toContain("라이브러리와 가까운 순서");
    const basisToggle = container.querySelector('[data-testid="search-basis-toggle"]');
    expect(basisToggle).toBeNull();
    const sortOptionValues = Array.from(container.querySelectorAll("option")).map(
      (option) => option.value,
    );
    expect(sortOptionValues).not.toContain("interest");
    expect(sortOptionValues).not.toContain("relevance");
  });

  it("opens only one facet filters dropdown at a time", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createTestRoot(container);
    const metadata: SearchMetadata = { ...createMetadata(3) };

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
          visiblePapers={metadata.papers}
          hasMorePapers={false}
          analysisProgressMap={new Map()}
          analysisMap={new Map()}
          onQueryChange={vi.fn()}
          onSortChange={vi.fn()}
          personalize={true}
          libraryContextAvailable={true}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    const dropdown = (key: string) =>
      container.querySelector(`[data-testid="search-facet-${key}"]`);
    const openDropdown = (key: string) => {
      const summary = dropdown(key)?.querySelector("summary");
      act(() => {
        summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    };

    openDropdown("fields");
    expect(dropdown("fields")?.hasAttribute("open")).toBe(true);
    expect(dropdown("authors")?.hasAttribute("open")).toBe(false);

    // Opening another facet closes the previously open one — panels never stack.
    openDropdown("authors");
    expect(dropdown("fields")?.hasAttribute("open")).toBe(false);
    expect(dropdown("authors")?.hasAttribute("open")).toBe(true);
    expect(dropdown("dateRange")?.hasAttribute("open")).toBe(false);
    expect(dropdown("venues")?.hasAttribute("open")).toBe(false);

    // A pointerdown outside the filter group closes the open dropdown.
    act(() => {
      document.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(dropdown("authors")?.hasAttribute("open")).toBe(false);

    // Esc closes the open dropdown too.
    openDropdown("venues");
    expect(dropdown("venues")?.hasAttribute("open")).toBe(true);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(dropdown("venues")?.hasAttribute("open")).toBe(false);

    document.body.removeChild(container);
  });
});

describe("search-view-content result basis interactions", () => {
  it("persists a facet mutation when the server timestamp is ahead of the browser", () => {
    const metadata = createMetadata(3);
    const view: ResearchRoutePayload = {
      id: "search-1",
      type: "search",
      status: "ready",
      title: "검색: agent memory",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "principal-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2099-01-01T00:00:00.000Z",
      updatedAt: "2099-01-01T00:00:00.000Z",
      metadata,
    };
    useResearchRouteStore.getState().setCurrentView(view, "facet-execution");
    const facetFilters = {
      fieldsOfStudy: ["Computer Science"],
      authors: [],
      venues: [],
      hasPdf: false,
    };

    patchActiveSearchFacetFilters({
      activeExecutionId: "facet-execution",
      facetFilters,
      sourceSnapshotId: view.id,
      patchCurrentView: useResearchRouteStore.getState().patchCurrentView,
    });

    expect(useResearchRouteStore.getState().currentView).toMatchObject({
      updatedAt: "2099-01-01T00:00:00.001Z",
      metadata: { facetFilters },
    });
  });

  it("keeps the library-reflection row out of the results body", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const onRouteSearchCommit = vi.fn();
    const onViewFilterReplace = vi.fn();
    const onPersonalizeChange = vi.fn();
    const metadata: SearchMetadata = {
      ...createMetadata(3),
      sortOption: "interest",
      libraryContextAvailable: true,
      abstractHydration: {
        status: "ready",
        personalize: true,
        libraryPaperIds: ["corpus-202"],
      },
      libraryContext: {
        folders: [{ name: "의료 LLM" }],
        signalPresent: true,
        interestWeights: {},
        computedAt: "2026-06-01T03:04:05.000Z",
        anchorPaperCount: 12,
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: clinical language models"
          metadata={metadata}
          query="clinical language models"
          sortOption="interest"
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
          personalize={false}
          libraryContextAvailable={false}
          onPersonalizeChange={onPersonalizeChange}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          onRouteSearchCommit={onRouteSearchCommit}
          onViewFilterReplace={onViewFilterReplace}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.querySelector('[data-testid="search-results-personalize-row"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-personalize-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();
    expect(container.textContent).toContain("내 라이브러리 반영");
    expect(container.textContent).not.toContain("내 라이브러리 적용");
    const basisToggle = container.querySelector('[data-testid="search-basis-toggle"]');
    expect(basisToggle).toBeNull();
    expect(container.querySelector('[data-testid="research-route-personalize-row"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="search-secondary-condition-controls"]'),
    ).not.toBeNull();
    // The facet filters render as one visually bounded group, distinct from the
    // result basis line and the sort control, without a redundant visible label.
    expect(container.querySelector('[data-testid="search-facet-filter-group"]')).not.toBeNull();
    // It also must not regress into a separate basis disclosure on the results screen.
    expect(container.querySelector('[data-testid="search-personalize-basis"]')).toBeNull();
    expect(container.textContent).not.toContain("기준 보기");
    expect(container.textContent).not.toContain("반영 폴더");
    expect(container.textContent).not.toContain("대표 기준 논문");
    expect(onRouteSearchCommit).not.toHaveBeenCalled();
    expect(onViewFilterReplace).not.toHaveBeenCalled();
    expect(onPersonalizeChange).not.toHaveBeenCalled();
  });

  it("does not expose a result-basis switch or commit hidden basis state", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const onRouteSearchCommit = vi.fn();
    const onViewFilterReplace = vi.fn();
    const onPersonalizeChange = vi.fn();
    const metadata: SearchMetadata = {
      ...createMetadata(3),
      sortOption: "relevance",
      libraryContextAvailable: true,
      libraryContext: {
        folders: [{ name: "의료 LLM" }],
        signalPresent: true,
        interestWeights: {},
        computedAt: "2026-06-01T03:04:05.000Z",
        anchorPaperCount: 12,
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: clinical language models"
          metadata={metadata}
          query="clinical language models"
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
          personalize={false}
          libraryContextAvailable={true}
          onPersonalizeChange={onPersonalizeChange}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          onRouteSearchCommit={onRouteSearchCommit}
          onViewFilterReplace={onViewFilterReplace}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.querySelector('[data-testid="search-basis-toggle-interest"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-basis-toggle-relevance"]')).toBeNull();
    expect(onRouteSearchCommit).not.toHaveBeenCalled();
    expect(onViewFilterReplace).not.toHaveBeenCalled();
    expect(onPersonalizeChange).not.toHaveBeenCalled();
  });
});

describe("search-view-content result basis DOI", () => {
  it("labels DOI searches as exact DOI matches when the result carries DOI metadata", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const metadata: SearchMetadata = {
      ...createMetadata(1),
      query: "https://doi.org/10.1145/3375637",
      exactLookup: { kind: "doi", value: "10.1145/3375637" },
      papers: [
        {
          ...createMetadata(1).papers[0],
          doi: "10.1145/3375637",
        },
      ],
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: https://doi.org/10.1145/3375637"
          metadata={metadata}
          query="https://doi.org/10.1145/3375637"
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
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });

    expect(container.querySelector('[data-testid="search-result-basis"]')?.textContent).toBe(
      "DOI 10.1145/3375637 정확 일치 · Moonlight Search 기반",
    );
    expect(container.textContent).toContain("DOI 10.1145/3375637");
    expect(container.querySelector('[data-testid="search-result-basis-badge"]')).toBeNull();
  });
});

describe("search-view-content library-proximity marker", () => {
  it("labels every result with positive library-proximity evidence", () => {
    const container = document.createElement("div");
    const root = createTestRoot(container);
    const baseMetadata = createMetadata(4);
    const metadata: SearchMetadata = {
      ...baseMetadata,
      papers: baseMetadata.papers.map((paper) =>
        paper.paperId === "paper-4"
          ? {
              ...paper,
              title: "Remote Haptics for Cinema",
              abstract: "Cinema haptics and remote touch interfaces.",
            }
          : paper,
      ),
      sortOption: "interest",
      libraryContext: {
        folders: [{ name: "표현학습" }],
        signalPresent: true,
        interestWeights: { "paper-1": 100, "paper-3": 9999, "paper-4": 5000 },
        libraryOnlyPaperIds: ["paper-3", "paper-4"],
      },
    };

    const renderResults = () => {
      act(() => {
        root.render(
          <SearchViewResultsState
            ownerPrincipalId="principal-1"
            sourceSnapshotId="search-1"
            documentTitle="검색: agent memory"
            metadata={metadata}
            query="agent memory"
            sortOption="interest"
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
            libraryContextAvailable={true}
            onPersonalizeChange={vi.fn()}
            onYearRangeApply={vi.fn()}
            onOpenGapNetwork={vi.fn()}
            onOpenCitationLineage={vi.fn()}
            onFindSimilar={vi.fn()}
            onLoadMore={vi.fn()}
            citationLineageLoadingPaperId={null}
          />,
        );
      });
    };

    renderResults();

    const paper1Badge = container
      .querySelector('[data-paper-id="paper-1"]')
      ?.querySelector('[data-testid="search-result-basis-badge"]');
    const paper2Badge = container
      .querySelector('[data-paper-id="paper-2"]')
      ?.querySelector('[data-testid="search-result-basis-badge"]');
    const paper3Badge = container
      .querySelector('[data-paper-id="paper-3"]')
      ?.querySelector('[data-testid="search-result-basis-badge"]');
    const paper4Badge = container
      .querySelector('[data-paper-id="paper-4"]')
      ?.querySelector('[data-testid="search-result-basis-badge"]');
    expect(requireText(paper1Badge)).toBe("내 연구와 가까움");
    expect(paper1Badge?.className).toContain("text-success");
    expect(paper2Badge).toBeNull();
    expect(requireText(paper3Badge)).toBe("내 연구와 가까움");
    expect(requireText(paper4Badge)).toBe("내 연구와 가까움");
    expect(container.querySelector('[data-testid="library-near-band-label"]')).toBeNull();
    expect(container.textContent).not.toContain("함께 볼 만한 인접 연구");
    expect(container.textContent).toContain("Agent Memory Paper 3");
  });
});
