import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";
import { INLINE_AI_COMMENT_FRAME_CLASS } from "@/app/components/research/inline-ai-comment-treatment";
import { DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS } from "@/app/components/research/research-route-layout.shared";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
const onSearchTermMock = vi.fn();
const onOpenGapNetworkMock = vi.fn();

function MockInlineReaction({ inlineBodyAppendSlot }: { inlineBodyAppendSlot?: ReactNode }) {
  return (
    <p data-testid="mock-ai-comment-body">
      AI reaction body
      {inlineBodyAppendSlot ? <> {inlineBodyAppendSlot}</> : null}
    </p>
  );
}

function createSearchView(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색: ai for science",
    content: "search content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "ai for science",
      total: 2,
      papers: [
        {
          paperId: "paper-1",
          title: "Agent Science 2024",
          abstract: "scientific discovery and verification",
          year: 2024,
          citationCount: 20,
          url: "https://example.com/1",
          authors: [{ name: "Alice" }],
        },
        {
          paperId: "paper-2",
          title: "Agent Science 2025",
          abstract: "hypothesis generation",
          year: 2025,
          citationCount: 10,
          url: "https://example.com/2",
          authors: [{ name: "Bob" }],
        },
      ],
      englishTermCandidates: [
        {
          term: "scientific discovery",
          type: "direct",
          confidence: "high",
          supportCount: 2,
          methodSupportCount: 1,
          graphSupportCount: 2,
          samplePaperIds: ["paper-1", "paper-2"],
          basis: "제목·초록에서 반복됨",
        },
      ],
      libraryContext: {
        folders: [{ name: "Moonlight 연구" }],
        signalPresent: true,
        interestWeights: { "paper-1": 0.8 },
      },
    },
    reaction: null,
  };
}

function resetStores() {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  useBackgroundTaskStore.setState({
    inlineAnalysisTasks: {},
  });
}

function renderSearchResults(searchDocument: Extract<ResearchRoutePayload, { type: "search" }>) {
  const container = document.createElement("div");
  root = createRoot(container);

  act(() => {
    root?.render(
      <SearchViewResultsState
        ownerPrincipalId={searchDocument.ownerPrincipalId}
        sourceSnapshotId={searchDocument.id}
        documentTitle={searchDocument.title}
        metadata={searchDocument.metadata}
        query={searchDocument.metadata.query}
        sortOption="interest"
        personalize
        libraryContextAvailable
        yearFilter=""
        isSearching={false}
        isError={false}
        analyzedCount={0}
        runningCount={0}
        queuedCount={0}
        isAnalyzing={false}
        isCreatingGapNetwork={false}
        visiblePapers={searchDocument.metadata.papers}
        resultCount={searchDocument.metadata.papers.length}
        hasMorePapers={false}
        analysisProgressMap={new Map()}
        analysisMap={new Map()}
        onQueryChange={vi.fn()}
        onSortChange={vi.fn()}
        onPersonalizeChange={vi.fn()}
        onYearRangeApply={vi.fn()}
        onOpenGapNetwork={onOpenGapNetworkMock}
        onOpenCitationLineage={vi.fn()}
        onFindSimilar={vi.fn()}
        onSearchTerm={onSearchTermMock}
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

function openDateRangeDropdown(container: HTMLElement): HTMLElement {
  const dateRangeDropdown = container.querySelector<HTMLElement>(
    '[data-testid="search-facet-dateRange"]',
  );
  const summary = dateRangeDropdown?.querySelector("summary");
  if (!dateRangeDropdown || !summary) {
    throw new Error("expected publication-year dropdown");
  }
  act(() => {
    summary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  return dateRangeDropdown;
}

describe("Search results metadata and term rows", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    resetStores();
    mockPush.mockClear();
    onSearchTermMock.mockClear();
    onOpenGapNetworkMock.mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    resetStores();
    vi.restoreAllMocks();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("keeps search metadata compact and renders research terms as clickable AI comment text", async () => {
    const sourceDocument = createSearchView();
    const container = renderSearchResults(sourceDocument);

    const contentRail = container.querySelector('[data-testid="search-results-content-rail"]');
    expect(container.querySelector('[data-testid="search-results-overview-rail"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-results-content-grid"]')).toBeNull();
    expect(contentRail?.className).toContain(DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS);
    expect(contentRail?.className).toContain("mx-auto");
    expect(contentRail?.className).toContain("w-full");
    const primaryControls = container.querySelector(
      '[data-testid="search-primary-condition-controls"]',
    );
    const rightControls = container.querySelector('[data-testid="search-results-right-controls"]');
    // Publication-year distribution moved out of the controls row into the year filter dropdown panel.
    expect(container.querySelector('[data-testid="search-results-overview-inline"]')).toBeNull();
    expect(
      rightControls?.querySelector('[data-testid="search-results-overview-search-year-chart"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
    openDateRangeDropdown(container);
    const yearFilterPanel = container.querySelector('[data-testid="search-year-filter-panel"]');
    expect(
      yearFilterPanel?.querySelector('[data-testid="search-results-overview-search-year-chart"]'),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("검색 결과 개요");
    const gapMapAction = container.querySelector(
      '[data-testid="search-results-gap-network-action"]',
    );
    expect(gapMapAction?.textContent).toContain(
      "상위 논문 40개의 관계를 분석하여 연구 공백 찾아보기 >",
    );
    const sortControl = container.querySelector<HTMLSelectElement>('[aria-label="정렬 기준"]');
    const basisToggle = container.querySelector<HTMLElement>('[data-testid="search-basis-toggle"]');
    expect(primaryControls && sortControl).toBeTruthy();
    expect(basisToggle).toBeNull();
    expect(primaryControls?.className).toContain("w-full");
    expect(rightControls?.className).toContain("ml-auto");
    expect(rightControls?.contains(sortControl)).toBe(true);
    expect(sortControl?.className).not.toContain("ml-auto");
    expect(sortControl?.value).toBe("default");
    expect(sortControl?.textContent).toContain("기본순");
    expect(sortControl?.textContent).not.toContain("내 연구 기준");
    const reactionRegion = container.querySelector(
      '[data-testid="search-results-reaction-below-basis"]',
    );
    const basisRow = container.querySelector('[data-testid="search-result-basis-row"]');
    const gapMapActionRow = container.querySelector(
      '[data-testid="search-results-reaction-actions"]',
    );
    expect(basisRow?.contains(gapMapAction)).toBe(true);
    expect(gapMapActionRow?.className).toContain("ml-auto");
    expect(reactionRegion?.contains(gapMapAction)).toBe(false);
    expect(reactionRegion?.className).toBe(INLINE_AI_COMMENT_FRAME_CLASS);
    const aiCommentTerms = container.querySelector<HTMLElement>(
      '[data-testid="search-ai-comment-research-terms"]',
    );
    expect(aiCommentTerms).toBeTruthy();
    expect(reactionRegion?.contains(aiCommentTerms)).toBe(true);
    expect(aiCommentTerms?.className).toContain("lh-type-reading-body");
    expect(aiCommentTerms?.className).toContain("lh-tone-secondary");
    expect(
      container
        .querySelector('[data-testid="search-secondary-condition-controls"]')
        ?.contains(aiCommentTerms),
    ).toBe(false);
    expect(
      container
        .querySelector('[data-testid="search-primary-condition-controls"]')
        ?.contains(gapMapAction),
    ).toBe(false);
    if (!(gapMapAction instanceof HTMLButtonElement)) {
      throw new Error("expected gap map action button");
    }

    await act(async () => {
      gapMapAction.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onOpenGapNetworkMock).toHaveBeenCalledWith(
      expect.objectContaining({ ctrlKey: true }),
      expect.any(Object),
    );
    const firstGapCall = onOpenGapNetworkMock.mock.calls.at(0) as
      | [unknown, { papers: Array<{ paperId: string }> }]
      | undefined;
    expect(firstGapCall?.[1].papers.map((paper) => paper.paperId)).toEqual(["paper-1", "paper-2"]);
    onOpenGapNetworkMock.mockClear();

    await act(async () => {
      gapMapAction.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 2 }));
      await Promise.resolve();
    });

    expect(onOpenGapNetworkMock).not.toHaveBeenCalled();
    const aiCommentBody = container.querySelector('[data-testid="mock-ai-comment-body"]');
    expect(aiCommentBody).toBeTruthy();
    expect(container.querySelector(".lh-panel-muted")).toBeNull();
    const year = container.querySelector('[data-testid="search-year-distribution"]');
    const termSection = container.querySelector<HTMLElement>(
      '[data-testid="search-results-overview-search-lead-research-terms"]',
    );
    const terms = container.querySelector('[data-testid="search-ai-comment-research-terms"]');
    expect(aiCommentBody?.contains(terms)).toBe(true);
    expect(year?.textContent).toContain("출판연도 분포");
    expect(year?.textContent).not.toContain("현재 결과 2편 기준");
    expect(yearFilterPanel?.contains(year)).toBe(true);
    expect(termSection).toBeNull();
    expect(
      container.querySelector('[data-testid="search-results-overview-search-year-peak"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("최다");
    expect(
      container.querySelector('[data-testid="search-results-overview-search-year-scale"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("20/10/0");
    expect(terms?.textContent).toContain("scientific discovery");
    expect(terms?.textContent).toContain("주요 연구 용어");
    expect(terms?.textContent).not.toContain("등을 제안합니다.");
    const termLinks = container.querySelector<HTMLElement>(
      '[data-testid="search-ai-comment-research-term-links"]',
    );
    expect(termLinks).toBeTruthy();
    expect(termLinks?.className).toContain("inline");
    expect(aiCommentTerms?.className).toContain("whitespace-nowrap");
    expect(aiCommentTerms?.className).toContain("overflow-x-auto");
    expect(termLinks?.className).toContain("whitespace-nowrap");
    expect(termLinks?.querySelector("button")?.className).toContain("whitespace-nowrap");
    expect(terms?.textContent).toContain("주요 연구 용어");
    expect(container.textContent).toContain("Agent Science 2024");
    expect(aiCommentBody?.textContent).toContain("AI reaction body");
    expect(aiCommentBody?.textContent).toContain("scientific discovery");

    const termButton = Array.from(terms?.querySelectorAll<HTMLButtonElement>("button") ?? []).find(
      (button) => button.textContent.includes("scientific discovery"),
    );
    if (!termButton) throw new Error("expected research term button");
    expect(termButton.className).toContain("text-accent");
    expect(termButton.className).toContain("lh-type-control-label");
    expect(termButton.className).not.toContain("border");

    await act(async () => {
      termButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(onSearchTermMock).toHaveBeenCalledWith(
      "scientific discovery",
      {
        termSeed: {
          sourceQuery: "ai for science",
          term: "scientific discovery",
          candidateType: "direct",
          supportCount: 2,
        },
      },
      expect.objectContaining({ ctrlKey: false, metaKey: false }),
    );

    onSearchTermMock.mockClear();
    await act(async () => {
      termButton.dispatchEvent(new MouseEvent("click", { bubbles: true, metaKey: true }));
      await Promise.resolve();
    });

    expect(onSearchTermMock).toHaveBeenCalledWith(
      "scientific discovery",
      expect.any(Object),
      expect.objectContaining({ metaKey: true }),
    );

    onSearchTermMock.mockClear();
    await act(async () => {
      termButton.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
      await Promise.resolve();
    });

    expect(onSearchTermMock).toHaveBeenCalledWith(
      "scientific discovery",
      expect.any(Object),
      expect.objectContaining({ button: 1 }),
    );
  });

  it("draws the year distribution as a continuous full-width axis", () => {
    const sparseDocument = createSearchView();
    // Earliest 2020, latest 2024, with 2021–2023 holding no papers.
    sparseDocument.metadata.papers = [
      { ...sparseDocument.metadata.papers[0], paperId: "paper-1", year: 2020 },
      { ...sparseDocument.metadata.papers[1], paperId: "paper-2", year: 2024 },
    ];
    const container = renderSearchResults(sparseDocument);
    openDateRangeDropdown(container);

    const chart = container.querySelector(
      '[data-testid="search-results-overview-search-year-chart"]',
    );
    expect(chart).toBeTruthy();

    // One equal-width bar per year across the whole span — present years are never dropped.
    for (const year of [2020, 2021, 2022, 2023, 2024]) {
      expect(chart?.querySelector(`[data-testid="search-year-bar-${String(year)}"]`)).toBeTruthy();
    }
    expect(chart?.querySelectorAll("[data-testid^='search-year-bar-']").length).toBe(5);

    // Gap years are kept as empty slots; years that have papers are not empty.
    expect(
      chart?.querySelector('[data-testid="search-year-bar-2020"]')?.getAttribute("data-empty"),
    ).toBe("false");
    expect(
      chart?.querySelector('[data-testid="search-year-bar-2024"]')?.getAttribute("data-empty"),
    ).toBe("false");
    for (const gapYear of [2021, 2022, 2023]) {
      expect(
        chart
          ?.querySelector(`[data-testid="search-year-bar-${String(gapYear)}"]`)
          ?.getAttribute("data-empty"),
      ).toBe("true");
    }

    // Each bar carries a hover tooltip with the year and paper count.
    expect(chart?.querySelector('[data-testid="search-year-tooltip-2024"]')?.textContent).toContain(
      "2024년 1편",
    );
    expect(chart?.querySelector('[data-testid="search-year-tooltip-2022"]')?.textContent).toContain(
      "2022년 0편",
    );
  });

  it("shows an extracting state while discovery is pending", () => {
    const pendingDoc = createSearchView();
    pendingDoc.metadata.englishTermCandidates = [];
    pendingDoc.metadata.englishTermDiscovery = { status: "pending" };

    const container = renderSearchResults(pendingDoc);
    const section = container.querySelector('[data-testid="search-ai-comment-research-terms"]');
    expect(
      container.querySelector('[data-testid="search-results-overview-search-terms-pending"]'),
    ).toBeTruthy();
    expect(section?.textContent).toContain("추출하고 있다");
    expect(
      container.querySelector('[data-testid="search-results-overview-search-terms"]'),
    ).toBeNull();
  });

  it("hides the research term row when discovery is ready with no terms", () => {
    const noAnswerDoc = createSearchView();
    noAnswerDoc.metadata.englishTermCandidates = [];
    noAnswerDoc.metadata.englishTermDiscovery = { status: "ready", source: "llm" };

    const container = renderSearchResults(noAnswerDoc);
    expect(
      container.querySelector('[data-testid="search-ai-comment-research-terms"] button'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="search-results-overview-search-terms-pending"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="search-ai-comment-research-terms"]')).toBeNull();
  });

  it("keeps ready research terms inline without a degraded fallback note", () => {
    const readyDoc = createSearchView();
    readyDoc.metadata.englishTermDiscovery = { status: "ready", source: "llm" };

    const container = renderSearchResults(readyDoc);
    expect(
      container.querySelector('[data-testid="search-ai-comment-research-terms"] button'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="search-results-overview-search-terms-degraded"]'),
    ).toBeNull();
    const termSentence = container.querySelector(
      '[data-testid="search-ai-comment-research-terms"]',
    );
    expect(termSentence?.textContent).toContain("주요 연구 용어 scientific discovery");
    expect(termSentence?.textContent).not.toContain("scientific discovery방법");
  });
});
