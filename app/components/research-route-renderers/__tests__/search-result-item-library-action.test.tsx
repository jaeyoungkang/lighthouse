import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import type { PaperCore } from "@/app/domain/paper";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";

const paper: PaperCore = {
  paperId: "paper-1",
  title: "The AI Scientist",
  abstract: "abstract",
  year: 2024,
  citationCount: 10,
  url: "https://example.com/paper-1",
  authors: [{ name: "Author 1" }],
  openAccessPdf: null,
  doi: null,
  referenceIds: null,
  citationIds: null,
};

const analysis: AIAnalysis = {
  summary: "이 논문은 연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
  localizedTitle: "AI 과학자",
  objective: "연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
  methodology: "멀티 에이전트 파이프라인과 트리 탐색을 사용한다.",
  results: "워크숍 수준의 자동 연구 산출물을 만든다.",
  keywords: ["autonomous research agents", "scientific discovery"],
  semanticProfile: {
    claim: "이 논문은 연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
    topics: ["autonomous research agents", "scientific discovery"],
    method: "멀티 에이전트 파이프라인과 트리 탐색을 사용한다.",
    finding: "워크숍 수준의 자동 연구 산출물을 만든다.",
    conclusion: "자동 연구 에이전트는 초기 연구 보조 도구로 검토할 수 있다.",
    quotedBasis: {
      claim: "research automation agent pipeline",
      topics: ["autonomous research agents", "scientific discovery"],
      method: "multi-agent pipeline and tree search",
      finding: "workshop-level automated outputs",
      conclusion: "early research assistant",
    },
  },
  stanceProfile: {
    mainPosition: "이 논문은 자동 연구 에이전트가 연구 산출물을 만들 수 있다고 본다.",
    debateAxis: "자동 연구 에이전트의 산출물 신뢰성과 평가 기준",
    limitations: "표본이 단일 도메인에 한정되어 일반화 근거가 약하다.",
    counterSearchQueries: [
      {
        query: "autonomous research agents reliability critique",
        rationale: "자동 연구 산출물의 신뢰성 문제를 확인한다.",
        basis: "automated outputs",
      },
    ],
  },
  confidence: "high",
  evidenceMap: {},
};

describe("SearchResultItem library action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a title-row library state toggle outside the research action row", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onToggleLibrary = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          onOpenCitationLineage={vi.fn()}
          onToggleLibrary={onToggleLibrary}
        />,
      );
    });

    const titleRow = container.querySelector('[data-testid="search-result-title-row"]');
    const actions = container.querySelector('[data-testid="search-result-actions"]');
    const addButton = titleRow?.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );
    expect(titleRow?.textContent).toContain("라이브러리에 추가");
    expect(actions?.textContent).not.toContain("라이브러리에 추가");
    expect(container.querySelector('[data-testid="search-result-library-controls"]')).toBeNull();
    expect(addButton).toBeTruthy();
    expect(addButton?.textContent).toContain("라이브러리에 추가");
    expect(addButton?.getAttribute("data-library-state")).toBe("unsaved");
    expect(addButton?.getAttribute("aria-label")).toContain("라이브러리에 추가");
    expect(addButton?.getAttribute("title")).toContain("라이브러리에 추가");
    expect(addButton?.className).not.toContain("lh-chip");
    expect(addButton?.className).toContain("rounded-lh-sm");
    expect(addButton?.className).toContain("h-7");
    expect(addButton?.className).toContain("w-7");
    expect(addButton?.className).toContain("bg-surface-panel");
    expect(addButton?.className).not.toContain("bg-success");
    expect(
      addButton?.querySelector('[data-testid="search-result-library-icon"]')?.getAttribute("fill"),
    ).toBe("none");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();

    act(() => {
      addButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleLibrary).toHaveBeenCalledWith(paper);

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          isInLibrary
          onOpenCitationLineage={vi.fn()}
          onToggleLibrary={onToggleLibrary}
        />,
      );
    });

    const addedTitleRow = container.querySelector('[data-testid="search-result-title-row"]');
    const addedActions = container.querySelector('[data-testid="search-result-actions"]');
    const addedButton = addedTitleRow?.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );
    expect(addedActions?.textContent).not.toContain("라이브러리에서 해제");
    expect(addedActions?.textContent).not.toContain("라이브러리에 있음");
    expect(container.querySelector('[data-testid="search-result-library-controls"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(addedButton?.disabled).toBe(false);
    expect(addedButton?.getAttribute("aria-pressed")).toBe("true");
    expect(addedButton?.getAttribute("data-library-state")).toBe("saved");
    expect(addedButton?.getAttribute("aria-label")).toContain("라이브러리에서 해제");
    expect(addedButton?.getAttribute("title")).toContain("라이브러리에서 해제");
    expect(addedButton?.textContent).toContain("라이브러리에서 해제");
    expect(addedButton?.className).not.toContain("lh-chip");
    expect(addedButton?.className).toContain("rounded-lh-sm");
    expect(addedButton?.className).toContain("bg-success/10");
    expect(addedButton?.className).toContain("text-success");
    expect(addedButton?.className).not.toContain("bg-surface-panel");
    expect(
      addedButton
        ?.querySelector('[data-testid="search-result-library-icon"]')
        ?.getAttribute("fill"),
    ).toBe("currentColor");

    act(() => {
      addedButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onToggleLibrary).toHaveBeenCalledTimes(2);
    expect(onToggleLibrary).toHaveBeenLastCalledWith(paper);

    act(() => {
      root.unmount();
    });
  });

  it("keeps the wide inspection surface and library toggle independently usable", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onToggleLibrary = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          onOpenCitationLineage={vi.fn()}
          onToggleLibrary={onToggleLibrary}
        />,
      );
    });

    const titleRow = container.querySelector('[data-testid="search-result-title-row"]');
    const title = titleRow?.querySelector('[data-testid="search-result-title"]');
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    const card = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
    const libraryButton = titleRow?.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );
    const actions = container.querySelector('[data-testid="search-result-actions"]');

    expect(title?.tagName).toBe("SPAN");
    expect(disclosure).toBeTruthy();
    expect(libraryButton).toBeTruthy();
    expect(actions?.textContent).not.toContain("라이브러리에 추가");

    act(() => {
      card?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 접기");
    expect(container.textContent).toContain("초록 기반 AI 분석");
    expect(container.textContent).toContain("주제");
    expect(container.textContent).toContain("다른 입장");

    act(() => {
      libraryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onToggleLibrary).toHaveBeenCalledTimes(1);
    expect(onToggleLibrary).toHaveBeenCalledWith(paper);
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-card-disclosure"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("true");

    act(() => {
      root.unmount();
    });
  });

  it("does not render a read-only library status badge without a toggle handler", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem paper={paper} isLast isInLibrary onOpenCitationLineage={vi.fn()} />,
      );
    });

    expect(container.querySelector('[data-testid="search-result-library-action"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="search-result-title-row"]')?.textContent,
    ).not.toContain("라이브러리에 있음");

    act(() => {
      root.unmount();
    });
  });

  it("disables the library action while a toggle is pending", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          isLibraryActionPending
          onOpenCitationLineage={vi.fn()}
          onToggleLibrary={vi.fn()}
        />,
      );
    });

    expect(
      container
        .querySelector('[data-testid="search-result-title-row"]')
        ?.querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.disabled,
    ).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
