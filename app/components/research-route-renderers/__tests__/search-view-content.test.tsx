import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SearchViewEmptyState,
  SearchViewResultsState,
} from "@/app/components/research-route-renderers/search-view-content";
import { SearchFollowupActivationProvider } from "@/app/components/research/search-followup-activation";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { createMetadata } from "./search-view-content.fixtures";

const { mockPathname, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/search" },
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams.value,
}));

vi.mock("@/app/components/research-route-renderers/SearchView", () => ({
  SearchView: () => null,
}));

afterEach(() => {
  mockPathname.value = "/search";
  mockPush.mockClear();
  mockSearchParams.value = new URLSearchParams();
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useLibraryPapersStore.setState({ papers: [] });
  vi.unstubAllGlobals();
});

it("submits the initial search without a result-basis parameter", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  mockPush.mockClear();
  mockSearchParams.value = new URLSearchParams();
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  act(() => {
    root.render(
      <SearchFollowupActivationProvider>
        <SearchViewEmptyState isError={false} libraryContextAvailable personalize />
      </SearchFollowupActivationProvider>,
    );
  });

  const queryInput = container.querySelector<HTMLInputElement>(
    '[data-testid="search-view-empty-query-input"]',
  );

  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(queryInput, "agent memory");
    queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
    container.querySelector<HTMLButtonElement>('[data-testid="search-view-empty-submit"]')?.click();
  });

  // The submit navigates IMMEDIATELY to the `/search?q=` URL
  // and creates no client-side result placeholder. The destination route executes from URL params; selected
  // library papers never ride the URL, only the availability marker (`lib=1`).
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledTimes(1);
  expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&lib=1&entry=empty-entry", {
    scroll: false,
  });
  const submitButton = container.querySelector<HTMLButtonElement>(
    '[data-testid="search-view-empty-submit"]',
  );
  expect(submitButton?.disabled).toBe(true);
  expect(submitButton?.getAttribute("aria-busy")).toBe("true");
  expect(
    submitButton?.querySelector('[data-testid="search-navigation-button-spinner"]'),
  ).not.toBeNull();
  expect(
    [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
      ReturnType<typeof useResearchRouteStore.getState>["currentView"]
    >[],
  ).toHaveLength(0);

  act(() => {
    root.unmount();
  });
});

it("clears the first-search button activation when navigation throws synchronously", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mockPush.mockImplementationOnce(() => {
    throw new Error("navigation failed");
  });
  act(() => {
    root.render(
      <SearchFollowupActivationProvider>
        <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize={true} />
      </SearchFollowupActivationProvider>,
    );
  });
  const queryInput = container.querySelector<HTMLInputElement>(
    '[data-testid="search-view-empty-query-input"]',
  );
  const submitButton = container.querySelector<HTMLButtonElement>(
    '[data-testid="search-view-empty-submit"]',
  );
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(queryInput, "agent memory");
    queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
  });

  act(() => {
    submitButton?.click();
  });
  expect(consoleError).toHaveBeenCalledWith(
    "[initial-search] navigation failed:",
    expect.objectContaining({ message: "navigation failed" }),
  );
  expect(submitButton?.disabled).toBe(false);
  expect(submitButton?.getAttribute("aria-busy")).toBe("false");
  expect(
    submitButton?.querySelector('[data-testid="search-navigation-button-spinner"]'),
  ).toBeNull();
  consoleError.mockRestore();

  act(() => {
    root.unmount();
  });
});

describe("search-view-content", () => {
  it("renders the initial search state with a stacked brand and URL-committing input", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize={true} />,
      );
    });

    expect(container.textContent).not.toContain("Moonlight Search는");
    expect(container.textContent).toContain(
      "PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB",
    );
    expect(container.textContent).not.toContain("내 라이브러리 반영");
    expect(container.textContent).not.toContain("Moonlight Search는 metadata · 초록 · 인용 관계");
    expect(container.querySelector('[data-testid="search-basis-facts"]')).toBeNull();
    expect(container.textContent).not.toContain(
      "2억+ 논문에서 긴 문장이나 키워드로 바로 찾을 수 있다.",
    );
    expect(container.textContent).not.toContain(
      "초록, 참고문헌 메타데이터, 인용 네트워크를 함께 본다.",
    );
    expect(container.textContent).not.toContain("Semantic Scholar에서 검색");

    const emptyState = container.querySelector('[data-testid="search-view-empty-state"]');
    const emptyStateBody = container.querySelector('[data-testid="search-view-empty-state-body"]');
    const queryInput = container.querySelector<HTMLInputElement>(
      '[data-testid="search-view-empty-query-input"]',
    );
    const formRow = container.querySelector('[data-testid="search-view-empty-form-row"]');
    const brandPanel = container.querySelector('[data-testid="search-view-empty-brand-panel"]');
    const inputPanel = container.querySelector('[data-testid="search-view-empty-input-panel"]');
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-view-empty-submit"]',
    );
    const logo = container.querySelector<HTMLImageElement>(
      '[data-testid="search-empty-brand-logo"]',
    );

    expect(queryInput).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(logo).not.toBeNull();
    expect(logo?.getAttribute("alt")).toBe("Moonlight Search");
    expect(decodeURIComponent(logo?.getAttribute("src") ?? "")).toContain(
      "/brand/scholar-logo.png",
    );
    expect(logo?.className).toContain("h-9");
    expect(logo?.className).toContain("max-w-[12.375rem]");
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-personalize-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-view-empty-personalize-row"]')).toBe(null);
    expect(container.querySelector("textarea")).toBeNull();
    expect(emptyState?.className).toContain("w-full");
    expect(emptyState?.className).toContain("min-h-[70vh]");
    expect(emptyState?.className).toContain("items-center");
    expect(emptyStateBody?.className).toContain("w-full");
    expect(emptyStateBody?.className).toContain("max-w-5xl");
    expect(emptyStateBody?.className).not.toContain("lg:grid-cols");
    expect(brandPanel).not.toBeNull();
    expect(inputPanel).not.toBeNull();
    expect(formRow?.className).toContain("border-b");

    act(() => {
      queryInput?.focus();
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(queryInput, "agent memory");
      queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    vi.stubGlobal("fetch", vi.fn());
    act(() => {
      submitButton?.click();
    });

    // The initial input commits the query to `/search?q=` IMMEDIATELY
    // with no client-side result placeholder; the destination route executes from that URL.
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=empty-entry", {
      scroll: false,
    });
    vi.unstubAllGlobals();
  });

  it("keeps the results-state query input and page footer out of the route body", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = {
      ...createMetadata(),
      query: "",
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: agent memory"
          metadata={metadata}
          query=""
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

    const queryInput = container.querySelector('input[aria-label="논문 검색어"]');
    const toolbar = container.querySelector('[data-testid="search-input-toolbar"]');
    const overviewControls = container.querySelector('[data-testid="search-overview-controls"]');
    const contentRail = container.querySelector('[data-testid="search-results-content-rail"]');

    expect(queryInput).toBeNull();
    expect(container.querySelector("textarea")).toBeNull();
    expect(toolbar).toBeNull();
    expect(overviewControls).not.toBeNull();
    expect(contentRail?.className).not.toContain("px-5");
    expect(container.querySelector("footer")).toBeNull();
    expect(container.querySelector('[data-testid="search-results-footer-about"]')).toBeNull();
  });

  it("renders the current result-basis gap-map action in the results header", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata = createMetadata();

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

    const chooserButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.trim() === "지식맵",
    );

    expect(chooserButton).toBeUndefined();
    expect(container.textContent).not.toContain("연구 지형도 생성 중");
  });
});

describe("SearchViewEmptyState library row", () => {
  it("does not render a first-search library reflection row", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize={true} />,
      );
    });

    expect(container.querySelector('[data-testid="search-view-empty-personalize-row"]')).toBe(null);
    expect(container.querySelector('[data-testid="search-personalize-toggle"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});

describe("search-view-content pending hydration cards", () => {
  it("keeps pending lightweight search cards focused on available metadata", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const metadata: SearchMetadata = {
      ...createMetadata(),
      abstractHydration: { status: "pending" },
      papers: [
        {
          paperId: "paper-1",
          title: "Agent Memory Paper",
          abstract: null,
          year: 2024,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [],
          openAccessPdf: null,
          doi: null,
          referenceIds: null,
          citationIds: null,
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

    expect(container.textContent).toContain("Agent Memory Paper");
    expect(container.querySelector('[data-testid="search-result-title"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="search-result-actions"]')).toBeTruthy();
    expect(container.textContent).toContain("PDF 확인 중");
    expect(container.textContent).toContain("논문 정보 보강 중");
    expect(container.textContent).not.toContain(
      "저자, 초록, 원문 링크를 확인한 뒤 분석을 이어갑니다.",
    );
    expect(container.textContent).toContain("저자·초록 보강");
    expect(container.textContent).toContain("분석 입력 보강");
    expect(container.textContent).toContain("인용 12");
    expect(container.textContent).not.toContain("논문 세부정보와 분석을 준비하는 중");
    expect(container.querySelector('[data-testid="search-hydration-progress"]')).toBeNull();

    const detailsLoading = container.querySelector('[data-testid="search-result-details-loading"]');
    const actions = container.querySelector('[data-testid="search-result-actions"]');
    expect(detailsLoading).toBeTruthy();
    expect(actions).toBeTruthy();
    if (!actions) {
      throw new Error("expected search result action row");
    }

    expect(actions.contains(detailsLoading)).toBe(false);
    expect(detailsLoading?.getAttribute("role")).toBeNull();
    expect(detailsLoading?.getAttribute("aria-live")).toBeNull();
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(0);
    expect(
      Array.from(actions.querySelectorAll("button")).some((button) =>
        button.textContent.includes("PDF 확인 중"),
      ),
    ).toBe(false);
    expect(
      container.querySelector('[data-testid="search-result-pending-details-skeleton"]'),
    ).toBeNull();
  });
});

describe("search-view-content spelling correction", () => {
  it("renders spelling correction feedback with original and corrected queries", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onRouteSearchCommit = vi.fn();
    const metadata: SearchMetadata = {
      ...createMetadata(),
      query: "trasnformer",
      spellingCorrection: {
        originalQuery: "trasnformer",
        correctedQuery: "transformer",
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: trasnformer"
          metadata={metadata}
          query="trasnformer"
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
          onRouteSearchCommit={onRouteSearchCommit}
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

    expect(container.textContent).toContain(
      '"trasnformer" 대신 "transformer"로 다시 검색할 수 있다',
    );
    const action = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("교정 검색어로 검색"),
    );
    expect(action).toBeTruthy();

    act(() => {
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRouteSearchCommit).toHaveBeenCalledWith(expect.objectContaining({ q: "transformer" }));
  });

  it("commits the corrected query through the search route so the top input reflects it", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onApplySpellingCorrection = vi.fn();
    const onRouteSearchCommit = vi.fn();
    const metadata: SearchMetadata = {
      ...createMetadata(),
      query: "trasnformer",
      spellingCorrection: {
        originalQuery: "trasnformer",
        correctedQuery: "transformer",
      },
    };

    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId="search-1"
          documentTitle="검색: trasnformer"
          metadata={metadata}
          query="trasnformer"
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
          onRouteSearchCommit={onRouteSearchCommit}
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

    const action = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("교정 검색어로 검색"),
    );
    act(() => {
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Route-owned commit: the corrected query rides the `/search?q=` route so the
    // top route input and URL reflect it; the local card-only search callback is bypassed.
    expect(onRouteSearchCommit).toHaveBeenCalledWith(
      expect.objectContaining({ q: "transformer", sort: "relevance" }),
    );
    expect(onRouteSearchCommit.mock.calls[0]?.[0]).not.toHaveProperty("personalize");
    expect(onApplySpellingCorrection).not.toHaveBeenCalled();
  });
});
