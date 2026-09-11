import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import type { PaperCore } from "@/app/domain/paper";
import {
  PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS,
  PAPER_GENERATED_CONTENT_REGION_CLASS,
} from "@/app/components/research-route-renderers/search-result-generated-content";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";
import {
  PAPER_CARD_METADATA_SCAN_ROW_CLASS,
  PAPER_CARD_TITLE_SCAN_ROW_CLASS,
  PAPER_CARD_TITLE_UTILITY_RAIL_CLASS,
} from "@/app/components/research-route-renderers/search-result-item.shared";

const analysis: AIAnalysis = {
  summary: "이 논문은 연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
  localizedTitle: "AI 과학자",
  objective: "연구 자동화를 제안한다.",
  methodology: "멀티 에이전트 파이프라인을 사용한다.",
  results: "자동 연구 산출물을 만든다.",
  keywords: ["autonomous research agents"],
  semanticProfile: {
    claim: "연구 자동화 파이프라인을 제안한다.",
    topics: ["autonomous research agents"],
    method: "멀티 에이전트 파이프라인",
    finding: "자동 연구 산출물",
    quotedBasis: {
      claim: "research automation agent pipeline",
      topics: ["autonomous research agents"],
      method: "multi-agent pipeline",
      finding: "automated outputs",
    },
  },
  confidence: "high",
  evidenceMap: {},
};

const paper: PaperCore = {
  paperId: "paper-stable",
  title: "Stable Progressive Paper Card",
  abstract: "abstract",
  year: 2025,
  citationCount: 3,
  url: "https://example.com/paper-stable",
  authors: [{ name: "Author 1" }],
  openAccessPdf: null,
  doi: null,
  referenceIds: null,
  citationIds: null,
};

function renderItem(
  container: HTMLElement,
  props: Partial<ComponentProps<typeof SearchResultItem>>,
) {
  const root = createRoot(container);
  act(() => {
    root.render(<SearchResultItem paper={paper} isLast onOpenPdf={vi.fn()} {...props} />);
  });
  return root;
}

function setOverflow(element: Element | null) {
  if (!(element instanceof HTMLElement)) throw new Error("expected measurable element");
  Object.defineProperty(element, "clientHeight", { configurable: true, value: 24 });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: 48 });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

describe("SearchResultItem spatial stability", () => {
  it("replaces analysis progress inside one stable region and expands through the wide card surface", () => {
    const container = document.createElement("div");
    const root = renderItem(container, { analysisState: "running" });
    const generatedRegion = () =>
      container.querySelector('[data-generated-content-region="paper-card-analysis"]');

    expect(generatedRegion()?.getAttribute("data-testid")).toBe("search-result-analysis-state");
    for (const className of PAPER_GENERATED_CONTENT_REGION_CLASS.split(" ")) {
      expect(generatedRegion()?.className).toContain(className);
    }
    expect(generatedRegion()?.hasAttribute("role")).toBe(false);
    expect(generatedRegion()?.textContent).toContain("분석 중");

    act(() => {
      root.render(
        <SearchResultItem paper={paper} isLast analysisState="error" onOpenPdf={vi.fn()} />,
      );
    });
    expect(generatedRegion()?.textContent).toContain("분석 실패");
    expect(generatedRegion()?.textContent).toContain(
      "논문 정보와 후속 탐색은 계속 사용할 수 있습니다.",
    );

    act(() => {
      root.render(
        <SearchResultItem paper={paper} isLast analysisState="done" onOpenPdf={vi.fn()} />,
      );
    });
    expect(container.textContent).toContain("분석 실패");
    expect(container.textContent).not.toContain("분석 완료");

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          onOpenPdf={vi.fn()}
        />,
      );
    });
    const summary = container.querySelector('[data-testid="search-result-analysis-summary"]');
    expect(generatedRegion()?.getAttribute("data-testid")).toBe("search-result-inline-analysis");
    expect(summary?.className).toContain("line-clamp-2");
    expect(container.querySelector('[data-testid="search-result-analysis-source"]')).toBeNull();

    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    const card = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 펼치기");
    expect(disclosure?.querySelector(".sr-only")?.textContent).toBe("논문 정보 펼치기");
    act(() => card?.click());
    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(summary?.className).not.toContain("line-clamp-2");
    expect(container.querySelector('[data-testid="search-result-analysis-source"]')).toBeTruthy();
    act(() => {
      root.unmount();
    });
  });

  it("keeps metadata-only and not-yet-started cards in the compact common frame", () => {
    const container = document.createElement("div");
    const sparsePaper: PaperCore = {
      ...paper,
      paperId: "paper-metadata-only",
      title: "Sparse Metadata Paper",
      abstract: null,
      fieldsOfStudy: ["Computer Science", "Biology"],
      authors: [{ name: "Author Must Not Become Evidence" }],
    };
    const root = renderItem(container, { paper: sparsePaper });
    const card = container.querySelector(
      '[data-paper-id="paper-metadata-only"]',
    )?.firstElementChild;
    const evidenceLimit = container.querySelector('[data-testid="search-result-evidence-limit"]');

    for (const className of PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS.split(" ")) {
      expect(card?.className).toContain(className);
    }
    for (const className of PAPER_GENERATED_CONTENT_REGION_CLASS.split(" ")) {
      expect(evidenceLimit?.className).toContain(className);
    }
    expect(evidenceLimit?.getAttribute("data-evidence-source")).toBe("metadata-only");
    expect(evidenceLimit?.textContent).not.toContain("메타데이터 단서");
    expect(evidenceLimit?.textContent).toContain("초록이 없어 분석하지 못했습니다.");
    expect(evidenceLimit?.textContent).toContain("Computer Science, Biology 관련 후보");
    expect(evidenceLimit?.textContent).not.toContain("Author Must Not Become Evidence");
    expect(container.textContent).not.toContain("분석 대기");
    const cardSurface = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    expect(cardSurface?.getAttribute("data-card-expandable")).toBe("true");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="search-result-source-links"]')).toBeNull();
    act(() => cardSurface?.click());
    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector('[data-testid="search-result-source-links"]')).toBeTruthy();
    act(() => cardSurface?.click());
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector('[data-testid="search-result-source-links"]')).toBeNull();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{ ...sparsePaper, abstract: "abstract" }}
          isLast
          onOpenPdf={vi.fn()}
        />,
      );
    });
    expect(evidenceLimit?.getAttribute("data-evidence-source")).toBe("abstract-available");
    expect(evidenceLimit?.textContent).toContain("AI 분석은 아직 시작되지 않았습니다.");
    act(() => {
      root.unmount();
    });
  });

  it("normalizes whitespace-only metadata before rendering the neutral fallback", () => {
    const container = document.createElement("div");
    const root = renderItem(container, {
      paper: {
        ...paper,
        paperId: "paper-whitespace-metadata",
        abstract: null,
        venue: "   ",
        fieldsOfStudy: [" ", "\t"],
        authors: [],
      },
    });

    expect(container.querySelector('[data-testid="paper-venue"]')).toHaveTextContent(
      "출처 정보 없음",
    );
    expect(container.querySelector('[data-testid="paper-fields"]')).toHaveTextContent("정보 없음");
    expect(container.querySelector('[data-testid="paper-venue"]')).toHaveAttribute(
      "data-metadata-availability",
      "unavailable",
    );
    expect(container.querySelector('[data-testid="paper-fields"]')).toHaveAttribute(
      "data-metadata-availability",
      "unavailable",
    );
    expect(
      container.querySelector('[data-testid="search-result-evidence-limit"]')?.textContent,
    ).not.toContain("관련 후보");

    act(() => {
      root.unmount();
    });
  });

  it("keeps fixed scan anchors with explicit unavailable metadata", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <>
          <SearchResultItem
            paper={{
              ...paper,
              paperId: "paper-fields-only",
              venue: null,
              fieldsOfStudy: ["Computer Science"],
              authors: [
                {
                  name: "A deliberately long first-author name that must not widen the paper card",
                },
                { name: "Second Author" },
              ],
            }}
            isLast={false}
          />
          <SearchResultItem
            paper={{
              ...paper,
              paperId: "paper-venue-and-fields",
              venue: "International Journal of Information Management",
              fieldsOfStudy: ["Business", "Computer Science"],
              doi: "10.1000/stable-anchor",
            }}
            isLast={false}
            basisBadge={{ label: "내 연구와 가까움" }}
            isRepresentative
            onToggleLibrary={vi.fn()}
          />
          <SearchResultItem
            paper={{
              ...paper,
              paperId: "paper-venue-only",
              year: null,
              venue: "arXiv.org",
              fieldsOfStudy: null,
            }}
            isLast
          />
        </>,
      );
    });

    const titleRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="search-result-title-row"]'),
    );
    const metadataRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="search-result-metadata"]'),
    );
    const authorRows = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="search-result-authors"]'),
    );
    expect(titleRows).toHaveLength(3);
    expect(metadataRows).toHaveLength(3);
    expect(authorRows).toHaveLength(3);

    const doiActions = Array.from(
      container.querySelectorAll<HTMLElement>('[data-testid="search-result-doi-action"]'),
    );
    expect(doiActions).toHaveLength(3);
    expect(doiActions.map((action) => action.textContent)).toEqual(["DOI", "DOI", "DOI"]);
    expect(doiActions.map((action) => action.tagName)).toEqual(["BUTTON", "A", "BUTTON"]);
    expect(doiActions.map((action) => action.getAttribute("data-doi-availability"))).toEqual([
      "unavailable",
      "available",
      "unavailable",
    ]);
    for (const doiAction of doiActions) {
      expect(doiAction.className).toContain("w-14");
      expect(doiAction.className).toContain("shrink-0");
      expect(doiAction.className).toContain("justify-center");
    }
    expect(container.textContent).not.toContain("10.1000/stable-anchor");

    for (const titleRow of titleRows) {
      expect(titleRow.className).toBe(PAPER_CARD_TITLE_SCAN_ROW_CLASS);
    }
    for (const metadataRow of metadataRows) {
      expect(metadataRow.className).toBe(PAPER_CARD_METADATA_SCAN_ROW_CLASS);
      expect(metadataRow.className).toContain("lh-type-metadata");
      expect(metadataRow.className).toContain("flex-wrap");
      expect(metadataRow.className).toContain("items-baseline");
    }

    expect(authorRows[0]?.className).toContain("flex-wrap");
    expect(authorRows[0]?.textContent).toContain(
      "A deliberately long first-author name that must not widen the paper card",
    );
    expect(authorRows[0]?.textContent).toContain("Second Author");

    const firstUtilities = titleRows[0]?.querySelector<HTMLElement>(
      '[data-testid="search-result-title-utilities"]',
    );
    const secondUtilities = titleRows[1]?.querySelector<HTMLElement>(
      '[data-testid="search-result-title-utilities"]',
    );
    expect(firstUtilities).toBeNull();
    expect(secondUtilities?.className).toBe(PAPER_CARD_TITLE_UTILITY_RAIL_CLASS);
    expect(
      Array.from(secondUtilities?.children ?? []).map((child) => child.getAttribute("data-testid")),
    ).toEqual([
      "search-result-basis-badge",
      "search-result-representative-badge",
      "search-result-library-action",
    ]);
    expect(titleRows[2]?.querySelector('[data-testid="search-result-title-utilities"]')).toBeNull();

    expect(metadataRows[0]?.getAttribute("data-metadata-layout")).toBe("fields-only");
    expect(metadataRows[0]?.textContent).toBe("2025·출처 정보 없음·분야Computer Science");
    expect(metadataRows[0]?.querySelector('[data-testid="paper-year"]')).toHaveTextContent("2025");
    expect(
      metadataRows[0]?.querySelector('[data-testid="paper-fields-group"]')?.className,
    ).not.toContain("sm:ml-auto");
    expect(metadataRows[0]?.querySelector('[data-testid="paper-venue"]')).toHaveAttribute(
      "data-metadata-availability",
      "unavailable",
    );
    expect(metadataRows[0]?.querySelector('[data-testid="paper-fields-label"]')).toHaveTextContent(
      "분야",
    );
    expect(metadataRows[1]?.getAttribute("data-metadata-layout")).toBe("venue-and-fields");
    expect(metadataRows[1]?.textContent).toBe(
      "2025·International Journal of Information Management·분야Business, Computer Science",
    );
    expect(metadataRows[1]?.querySelector('[data-testid="paper-venue"]')?.className).not.toContain(
      "sm:flex-1",
    );
    expect(metadataRows[1]?.querySelector('[data-testid="paper-fields"]')).toHaveTextContent(
      "Business, Computer Science",
    );
    expect(metadataRows[2]?.getAttribute("data-metadata-layout")).toBe("venue-only");
    expect(metadataRows[2]?.textContent).toBe("arXiv.org·분야정보 없음");
    expect(metadataRows[2]?.querySelector('[data-testid="paper-year"]')).toBeNull();
    expect(metadataRows[2]?.querySelector('[data-testid="paper-fields"]')).toHaveTextContent(
      "정보 없음",
    );
    expect(metadataRows[2]?.querySelector('[data-testid="paper-fields"]')).toHaveAttribute(
      "data-metadata-availability",
      "unavailable",
    );
    expect(container.querySelector('[data-testid$="-slot"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("gives repeated icon-only disclosure controls paper-specific accessible names", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <>
          <SearchResultItem paper={paper} isLast={false} />
          <SearchResultItem
            paper={{ ...paper, paperId: "paper-stable-2", title: "Second Stable Paper" }}
            isLast
          />
        </>,
      );
    });

    const disclosures = Array.from(
      container.querySelectorAll<HTMLButtonElement>(
        '[data-testid="search-result-card-disclosure"]',
      ),
    );
    const labelledBy = disclosures.map((button) => button.getAttribute("aria-labelledby"));
    const firstTitleId = labelledBy[0]?.split(" ")[0];
    const secondTitleId = labelledBy[1]?.split(" ")[0];
    if (!firstTitleId || !secondTitleId) {
      throw new Error("expected each disclosure to reference its paper title");
    }

    expect(labelledBy).toHaveLength(2);
    expect(labelledBy[0]).not.toBe(labelledBy[1]);
    expect(labelledBy[0]?.split(" ")).toHaveLength(2);
    expect(labelledBy[1]?.split(" ")).toHaveLength(2);
    expect(container.querySelector(`#${firstTitleId}`)?.textContent).toContain(paper.title);
    expect(container.querySelector(`#${secondTitleId}`)?.textContent).toContain(
      "Second Stable Paper",
    );

    act(() => {
      root.unmount();
    });
  });
});

describe("SearchResultItem metadata-only title inspection", () => {
  it("keeps a long metadata-only title on one line until the user expands it", () => {
    const container = document.createElement("div");
    const root = renderItem(container, {
      paper: {
        ...paper,
        paperId: "paper-long-title-no-analysis",
        title:
          "Artificial Intelligence: Multidisciplinary perspectives on emerging challenges, opportunities, and agenda for research, practice and policy",
        abstract: null,
        fieldsOfStudy: null,
        authors: [],
      },
    });
    const titleText = container.querySelector('[data-testid="search-result-title-text"]');
    expect(titleText?.className).toContain("line-clamp-1");
    setOverflow(titleText);

    const title = container.querySelector<HTMLElement>('[data-testid="search-result-title"]');
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    expect(title?.tagName).toBe("SPAN");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("출처 정보 없음");
    expect(container.textContent).toContain("분야정보 없음");
    expect(container.textContent).toContain("저자 정보 미제공");

    act(() => title?.click());
    expect(titleText?.className).not.toContain("line-clamp-1");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    act(() => container.querySelector<HTMLElement>('[data-testid="search-result-card"]')?.click());
    expect(titleText?.className).toContain("line-clamp-1");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    act(() => {
      root.unmount();
    });
  });
});
