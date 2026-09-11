import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { SearchViewResultsState } from "@/app/components/research-route-renderers/search-view-content";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

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

function renderResultsState(
  container: HTMLDivElement,
  overrides: {
    yearFilter?: string;
    query?: string;
    metadata?: SearchMetadata;
    onYearRangeApply?: () => void;
    onReSearch?: () => void;
    isSearching?: boolean;
    onRouteSearchCommit?: (params: {
      q: string;
      sort: "interest" | "relevance" | "citationCount" | "year" | "yearAsc";
      year: string;
    }) => void;
  } = {},
) {
  const metadata = overrides.metadata ?? createMetadata(1);
  const query = overrides.query ?? metadata.query;
  root = createRoot(container);
  act(() => {
    root?.render(
      <SearchViewResultsState
        ownerPrincipalId="principal-1"
        sourceSnapshotId="search-1"
        documentTitle="검색: agent memory"
        metadata={metadata}
        query={query}
        sortOption="relevance"
        yearFilter={overrides.yearFilter ?? ""}
        isSearching={overrides.isSearching ?? false}
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
        onYearRangeApply={overrides.onYearRangeApply ?? vi.fn()}
        onRouteSearchCommit={overrides.onRouteSearchCommit}
        onOpenGapNetwork={vi.fn()}
        onOpenCitationLineage={vi.fn()}
        onFindSimilar={vi.fn()}
        onLoadMore={vi.fn()}
        citationLineageLoadingPaperId={null}
      />,
    );
  });
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

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  const setter = descriptor?.set?.bind(input);
  if (!setter) {
    throw new Error("react input value setter unavailable");
  }
  setter(value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("SearchViewResultsState publication-year range surface", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    document.body.replaceChildren();
  });

  it("renders a condition apply button in the result overview controls", () => {
    const container = document.createElement("div");
    renderResultsState(container);
    openDateRangeDropdown(container);

    const toolbar = container.querySelector('[data-testid="search-input-toolbar"]');
    const overviewControls = container.querySelector('[data-testid="search-overview-controls"]');
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-submit-button"]',
    );
    expect(toolbar).toBeNull();
    expect(overviewControls).not.toBeNull();
    expect(submitButton).not.toBeNull();
    expect(overviewControls?.contains(submitButton)).toBe(true);
    expect(submitButton?.textContent).toContain("조건 적용");
    expect(submitButton?.disabled).toBe(false);
  });

  it("keeps publication-year distribution inside the year filter dropdown", () => {
    const container = document.createElement("div");
    renderResultsState(container, { metadata: createMetadata(3) });

    const rightControls = container.querySelector('[data-testid="search-results-right-controls"]');
    const dateRangeDropdown = container.querySelector('[data-testid="search-facet-dateRange"]');

    expect(container.querySelector('[data-testid="search-results-overview-inline"]')).toBeNull();
    expect(
      rightControls?.querySelector('[data-testid="search-results-overview-search-year-chart"]'),
    ).toBeNull();
    expect(dateRangeDropdown?.hasAttribute("open")).toBe(false);
    expect(container.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-year-distribution"]')).toBeNull();

    openDateRangeDropdown(container);
    const yearFilterPanel = container.querySelector('[data-testid="search-year-filter-panel"]');
    const distribution = container.querySelector('[data-testid="search-year-distribution"]');

    expect(dateRangeDropdown?.contains(yearFilterPanel ?? null)).toBe(true);
    expect(yearFilterPanel?.contains(distribution ?? null)).toBe(true);
    expect(
      distribution?.querySelector('[data-testid="search-results-overview-search-year-chart"]'),
    ).toBeTruthy();
    expect(distribution?.textContent).toContain("출판연도 분포");
    expect(container.textContent).not.toContain("검색 결과 개요");
    expect(distribution?.textContent).not.toContain("현재 결과");
    expect(
      distribution?.querySelector('[data-testid="search-results-overview-search-year-peak"]'),
    ).toBeNull();
    expect(
      distribution?.querySelector('[data-testid="search-results-overview-search-year-scale"]'),
    ).toBeNull();
  });

  it("disables condition controls when the query is empty or a search is in flight", () => {
    const emptyContainer = document.createElement("div");
    renderResultsState(emptyContainer, { query: "   " });
    openDateRangeDropdown(emptyContainer);
    const emptyButton = emptyContainer.querySelector<HTMLButtonElement>(
      '[data-testid="search-submit-button"]',
    );
    expect(emptyButton?.disabled).toBe(true);
    act(() => {
      root?.unmount();
    });
    root = null;

    const flightContainer = document.createElement("div");
    renderResultsState(flightContainer, { isSearching: true });
    const flightSummary = flightContainer.querySelector<HTMLElement>(
      '[data-testid="search-facet-dateRange"] summary',
    );
    expect(flightSummary?.getAttribute("aria-disabled")).toBe("true");
    expect(flightContainer.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
  });

  it("shows loading state and disables condition apply while a search request is in flight", () => {
    const container = document.createElement("div");
    renderResultsState(container, { isSearching: true });

    expect(container.querySelector('input[aria-label="논문 검색어"]')).toBeNull();
    expect(container.textContent).toContain("검색 결과를 불러오는 중");
    expect(container.textContent).not.toContain("완료되면 현재 결과 기준 AI 반응이 갱신된다");
    expect(
      container
        .querySelector<HTMLElement>('[data-testid="search-facet-dateRange"] summary')
        ?.getAttribute("aria-disabled"),
    ).toBe("true");
    expect(container.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-loading-status"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-loading-spinner"]')).toBeNull();
  });

  it("returns focus to the publication-year trigger when Escape closes the panel", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    renderResultsState(container);
    const dateRangeDropdown = openDateRangeDropdown(container);
    const summary = dateRangeDropdown.querySelector<HTMLElement>("summary");
    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    if (!summary || !fromInput) {
      throw new Error("expected year range trigger and input");
    }

    act(() => {
      fromInput.focus();
    });
    expect(document.activeElement).toBe(fromInput);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(container.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
    expect(document.activeElement).toBe(summary);
  });

  it("keeps the year-range filter in the result overview controls without a repeated query input", () => {
    const container = document.createElement("div");
    renderResultsState(container);
    openDateRangeDropdown(container);

    const queryInput = container.querySelector('input[aria-label="논문 검색어"]');
    const toolbar = container.querySelector('[data-testid="search-input-toolbar"]');
    const overviewControls = container.querySelector('[data-testid="search-overview-controls"]');
    const rangeFilter = container.querySelector('[data-testid="search-year-range-filter"]');
    expect(queryInput).toBeNull();
    expect(toolbar).toBeNull();
    expect(overviewControls).not.toBeNull();
    expect(rangeFilter).not.toBeNull();
    expect(overviewControls?.contains(rangeFilter)).toBe(true);
  });

  it("does not trigger a search request while the user is only typing in the year range inputs", () => {
    const onYearRangeApply = vi.fn();
    const onReSearch = vi.fn();
    const container = document.createElement("div");
    renderResultsState(container, { onYearRangeApply, onReSearch });
    openDateRangeDropdown(container);

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    if (!fromInput || !toInput) {
      throw new Error("expected year-range inputs");
    }

    act(() => {
      setInputValue(fromInput, "1990");
    });
    act(() => {
      setInputValue(toInput, "2000");
    });

    expect(onYearRangeApply).not.toHaveBeenCalled();
    expect(onReSearch).not.toHaveBeenCalled();
  });

  it("accents only the bars inside the entered publication-year range", () => {
    const container = document.createElement("div");
    const metadata = createMetadata(5);
    metadata.papers = metadata.papers.map((paper, index) => ({ ...paper, year: 2020 + index }));
    renderResultsState(container, { metadata });
    openDateRangeDropdown(container);

    const chart = container.querySelector(
      '[data-testid="search-results-overview-search-year-chart"]',
    );
    const highlightOf = (year: number) =>
      chart
        ?.querySelector(`[data-testid="search-year-bar-${String(year)}"]`)
        ?.getAttribute("data-highlight");

    // Empty range: nothing is accented.
    for (const year of [2020, 2021, 2022, 2023, 2024]) {
      expect(highlightOf(year)).toBe("false");
    }

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    if (!fromInput || !toInput) {
      throw new Error("expected year-range inputs");
    }

    act(() => {
      setInputValue(fromInput, "2021");
    });
    act(() => {
      setInputValue(toInput, "2023");
    });

    // In-range years are accented; years outside the entered range are not.
    expect(highlightOf(2020)).toBe("false");
    expect(highlightOf(2021)).toBe("true");
    expect(highlightOf(2022)).toBe("true");
    expect(highlightOf(2023)).toBe("true");
    expect(highlightOf(2024)).toBe("false");
  });

  it("commits the staged year range to the query route when the user clicks the condition apply button", () => {
    const onYearRangeApply = vi.fn();
    const onReSearch = vi.fn();
    const onRouteSearchCommit = vi.fn();
    const container = document.createElement("div");
    renderResultsState(container, { onYearRangeApply, onReSearch, onRouteSearchCommit });
    openDateRangeDropdown(container);

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-submit-button"]',
    );
    if (!fromInput || !toInput || !submitButton) {
      throw new Error("expected year-range inputs and submit button");
    }

    act(() => {
      setInputValue(fromInput, "1990");
    });
    act(() => {
      setInputValue(toInput, "2000");
    });
    act(() => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onYearRangeApply).not.toHaveBeenCalled();
    expect(onRouteSearchCommit).toHaveBeenCalledWith({
      q: "agent memory",
      sort: "relevance",
      year: "1990-2000",
    });
    expect(onReSearch).not.toHaveBeenCalled();
  });

  it.each([
    { yearFilter: "2024", from: "2024", to: "2024", committed: "2024" },
    { yearFilter: "2024-2024", from: "2024", to: "2024", committed: "2024" },
    { yearFilter: "0001-0010", from: "0001", to: "0010", committed: "0001-0010" },
    { yearFilter: "-0001", from: "", to: "0001", committed: "-0001" },
  ])("round-trips $yearFilter without widening or losing digits", (expected) => {
    const onRouteSearchCommit = vi.fn();
    const container = document.createElement("div");
    renderResultsState(container, {
      yearFilter: expected.yearFilter,
      onRouteSearchCommit,
    });
    openDateRangeDropdown(container);

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    const submitButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-submit-button"]',
    );
    if (!fromInput || !toInput || !submitButton) {
      throw new Error("expected year-range inputs and submit button");
    }

    expect(fromInput.value).toBe(expected.from);
    expect(toInput.value).toBe(expected.to);

    act(() => {
      submitButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRouteSearchCommit).toHaveBeenCalledWith({
      q: "agent memory",
      sort: "relevance",
      year: expected.committed,
    });
  });

  it("ignores Enter when the query is empty so the disabled-button contract is not bypassed", () => {
    const onYearRangeApply = vi.fn();
    const onReSearch = vi.fn();
    const container = document.createElement("div");
    renderResultsState(container, { onYearRangeApply, onReSearch, query: "   " });
    openDateRangeDropdown(container);

    const fromInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="출판연도 시작"]',
    );
    const toInput = container.querySelector<HTMLInputElement>('input[aria-label="출판연도 끝"]');
    if (!fromInput || !toInput) {
      throw new Error("expected year-range inputs");
    }

    act(() => {
      setInputValue(fromInput, "1990");
    });
    act(() => {
      setInputValue(toInput, "2000");
    });
    act(() => {
      toInput.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });

    expect(onYearRangeApply).not.toHaveBeenCalled();
    expect(onReSearch).not.toHaveBeenCalled();
  });

  it("keeps the year-range panel closed while a search is already in flight", () => {
    const onYearRangeApply = vi.fn();
    const onReSearch = vi.fn();
    const container = document.createElement("div");
    renderResultsState(container, { onYearRangeApply, onReSearch, isSearching: true });

    act(() => {
      const summary = container.querySelector<HTMLElement>(
        '[data-testid="search-facet-dateRange"] summary',
      );
      summary?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(onYearRangeApply).not.toHaveBeenCalled();
    expect(onReSearch).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="search-year-filter-panel"]')).toBeNull();
  });
});
