import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import { PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS } from "@/app/components/research-route-renderers/search-result-generated-content";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";
import {
  readFirstAiContentFeedbackBody,
  stubAiContentFeedbackTransport,
} from "./ai-content-feedback-test-support";

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

function clickCardDisclosure(container: HTMLElement) {
  const card = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
  if (!card) throw new Error("card inspection surface not rendered");
  act(() => {
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return card;
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("SearchResultItem", () => {
  it("renders method and result fields without duplicating the summary as contribution", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
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
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenCitationLineage={vi.fn()}
        />,
      );
    });

    const title = container.querySelector('[data-testid="search-result-title"]');
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    expect(title?.tagName).toBe("SPAN");
    expect(title?.hasAttribute("aria-expanded")).toBe(false);
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 펼치기");
    expect(container.querySelector('[data-testid="search-result-analysis-source"]')).toBeNull();

    clickCardDisclosure(container);

    expect(container.textContent).toContain("주제");
    expect(container.textContent).toContain("방법");
    expect(container.textContent).toContain("결과");
    expect(container.textContent).toContain("초록 기반 AI 분석");
    expect(container.textContent).not.toContain("PDF 기반 AI 분석");
    expect(container.textContent).toContain(analysis.semanticProfile.method);
    expect(container.textContent).toContain(analysis.semanticProfile.finding);
    expect(container.textContent).not.toContain("결론");
    expect(container.textContent).not.toContain(analysis.semanticProfile.conclusion);
    expect(container.textContent).not.toContain("기여");
    expect(container.textContent).not.toContain("목적");
    expect(container.textContent).not.toContain("방법론");
    expect(container.textContent).not.toContain("근거:");
    expect(container.textContent).not.toContain(analysis.semanticProfile.quotedBasis.method);
    expect(container.textContent).not.toContain(analysis.semanticProfile.quotedBasis.finding);
  });
});

describe("SearchResultItem card hierarchy", () => {
  it("renders the paper card hierarchy with a separate three-author row before actions and summary", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-1",
            title: "The AI Scientist",
            abstract: "abstract",
            year: 2024,
            venue: "NeurIPS",
            fieldsOfStudy: ["Computer Science", "Biology", "Medicine"],
            citationCount: 10,
            url: "https://example.com/paper-1",
            authors: [{ name: "Author 1" }, { name: "Author 2" }, { name: "Author 3" }],
            openAccessPdf: null,
            doi: "10.1145/3375637",
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onSearchTerm={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("2024");
    expect(container.textContent).toContain("NeurIPS");
    expect(container.textContent).toContain("The AI Scientist");
    expect(container.textContent).not.toContain("한국어 제목");
    expect(container.textContent).not.toContain("AI 과학자");
    expect(container.textContent).not.toContain("학회/저널");
    expect(container.textContent).toContain("DOI");
    expect(container.textContent).not.toContain("10.1145/3375637");
    expect(container.querySelector('a[href="https://doi.org/10.1145/3375637"]')).toBeTruthy();

    const text = container.textContent;
    expect(text.indexOf("The AI Scientist")).toBeLessThan(text.indexOf("2024"));
    expect(text.indexOf("2024")).toBeLessThan(text.indexOf("NeurIPS"));
    expect(text.indexOf("NeurIPS")).toBeLessThan(text.indexOf("Computer Science, Biology"));
    expect(text.indexOf("Computer Science, Biology")).toBeLessThan(text.indexOf("Author 1"));
    expect(text.indexOf("NeurIPS")).toBeLessThan(text.indexOf("Author 1"));
    expect(text.indexOf("NeurIPS")).toBeLessThan(text.indexOf("인용 10"));
    expect(text.indexOf("Author 1")).toBeLessThan(text.indexOf("DOI"));
    expect(text.indexOf("DOI")).toBeLessThan(text.indexOf("PDF"));
    expect(text.indexOf("PDF")).toBeLessThan(text.indexOf(analysis.summary));

    const paperCard = container.querySelector('[data-paper-id="paper-1"]')?.firstElementChild;
    const titleRow = container.querySelector('[data-testid="search-result-title-row"]');
    const title = container.querySelector('[data-testid="search-result-title"]');
    const authors = container.querySelector('[data-testid="search-result-authors"]');
    const metadata = container.querySelector('[data-testid="search-result-metadata"]');
    const venue = container.querySelector('[data-testid="paper-venue"]');
    const fields = container.querySelector('[data-testid="paper-fields"]');
    const actions = container.querySelector('[data-testid="search-result-actions"]');
    const actionText = actions?.textContent ?? "";
    expect(paperCard?.className).toContain("border-b");
    expect(paperCard?.className).toContain("bg-transparent");
    expect(paperCard?.className).not.toContain("rounded-lh-md");
    for (const className of PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS.split(" ")) {
      expect(paperCard?.className).toContain(className);
    }
    expect(titleRow?.textContent).toContain("The AI Scientist");
    expect(titleRow?.textContent).not.toContain("2024");
    expect(titleRow?.querySelector('[data-testid="paper-year"]')).toBeNull();
    expect(title?.className).toContain("lh-type-paper-title");
    expect(title?.className).toContain("inline-flex");
    const disclosure = container.querySelector('[data-testid="search-result-card-disclosure"]');
    expect(title?.tagName).toBe("SPAN");
    expect(disclosure).toBeTruthy();
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 펼치기");
    expect(disclosure?.querySelector(".sr-only")?.textContent).toBe("논문 정보 펼치기");
    expect(
      container.querySelector('[data-testid="search-result-card-disclosure-icon"]'),
    ).toBeTruthy();
    expect(authors?.tagName).toBe("DIV");
    expect(authors?.querySelectorAll("button")).toHaveLength(3);
    expect(authors?.textContent).toBe("Author 1,Author 2,Author 3");
    expect(venue?.className).toContain("font-medium");
    expect(metadata?.textContent).toContain("NeurIPS");
    expect(metadata?.querySelector('[data-testid="paper-year"]')?.textContent).toBe("2024");
    expect(metadata?.querySelector('[data-testid="paper-year"]')?.parentElement).toBe(
      venue?.parentElement,
    );
    expect(container.querySelector('[data-testid="paper-fields-label"]')?.textContent).toBe("분야");
    expect(fields?.textContent).toBe("Computer Science, Biology");
    expect(metadata?.textContent).toContain("Computer Science, Biology");
    expect(metadata?.textContent).not.toContain("Medicine");
    expect(metadata?.textContent).toContain("2024");
    expect(actionText).toContain("인용 10");
    const doiAction = actions?.querySelector('[data-testid="search-result-doi-action"]');
    expect(doiAction?.textContent).toBe("DOI");
    expect(doiAction?.className).toContain("w-14");
    expect(actionText).not.toContain("10.1145/3375637");
    expect(actionText).toContain("PDF");
    expect(actionText.indexOf("DOI")).toBeLessThan(actionText.indexOf("PDF"));
    expect(actionText.indexOf("PDF")).toBeLessThan(actionText.indexOf("인용 10"));
    for (const action of actions?.querySelectorAll("a, button") ?? []) {
      expect(action.className).toContain("lh-card-action");
      expect(action.className).toContain("lh-type-compact-control");
    }
  });

  it("marks representative papers inside the result list", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
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
          }}
          isLast
          isRepresentative
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    const badge = container.querySelector('[data-testid="search-result-representative-badge"]');
    expect(badge).toHaveTextContent("대표");
  });

  it("shows result but does not present abstract-based conclusion as card detail", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
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
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    clickCardDisclosure(container);

    expect(container.textContent).toContain("결과");
    expect(container.textContent).toContain(analysis.semanticProfile.finding);
    expect(container.textContent).not.toContain("결론");
    expect(container.textContent).not.toContain(analysis.semanticProfile.conclusion);
  });
});

describe("SearchResultItem citation lineage chips", () => {
  it("uses citation count as the default card-level lineage signal", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenCitationLineage = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-1",
            title: "The AI Scientist",
            abstract: "abstract",
            year: 2024,
            citationCount: 10,
            url: "https://example.com/paper-1",
            authors: [{ name: "Author 1" }],
            openAccessPdf: null,
            doi: null,
            referenceIds: ["ref-1", "ref-2"],
            citationIds: ["cit-1"],
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenCitationLineage={onOpenCitationLineage}
        />,
      );
    });

    expect(container.textContent).not.toContain("선행 2");
    expect(container.textContent).toContain("인용 1");
    const lineageButtons = Array.from(container.querySelectorAll("button")).filter(
      (button) => button.textContent === "인용 1",
    );
    expect(lineageButtons).toHaveLength(1);

    act(() => {
      lineageButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenCitationLineage).toHaveBeenCalledTimes(1);
  });

  it("explains limited reference lists instead of showing a zero-reference lineage chip", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenCitationLineage = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-1",
            title: "The AI Scientist",
            abstract: "abstract",
            year: 2024,
            citationCount: 10,
            url: "https://example.com/paper-1",
            authors: [{ name: "Author 1" }],
            openAccessPdf: null,
            doi: null,
            referenceIds: [],
            referenceCount: 66,
            citationIds: ["cit-1"],
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenCitationLineage={onOpenCitationLineage}
        />,
      );
    });

    expect(container.textContent).not.toContain("선행 0");
    expect(container.textContent).not.toContain("선행 66+");
    const limitedReferenceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "인용 1",
    );
    expect(limitedReferenceButton).toBeTruthy();
    expect(limitedReferenceButton?.getAttribute("title")).toContain("선행 연구 66편");

    act(() => {
      limitedReferenceButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenCitationLineage).toHaveBeenCalledTimes(1);
  });

  it("still explains provider-limited references when no lineage paper IDs are available", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-1",
            title: "The AI Scientist",
            abstract: "abstract",
            year: 2024,
            citationCount: 10,
            url: "https://example.com/paper-1",
            authors: [{ name: "Author 1" }],
            openAccessPdf: null,
            doi: null,
            referenceIds: [],
            referenceCount: 66,
            citationIds: [],
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenCitationLineage={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("인용 10");
    expect(container.textContent).not.toContain("선행 66+");
    expect(container.textContent).not.toContain("선행 0");
    expect(container.textContent).not.toContain("인용 정보 없음");
    const limitedReferenceButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "인용 10",
    );
    expect(limitedReferenceButton?.hasAttribute("disabled")).toBe(false);
  });
});

describe("SearchResultItem inline analysis feedback", () => {
  it("records feedback for inline AI analysis with paper provenance", async () => {
    const fetchMock = stubAiContentFeedbackTransport();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
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
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    const notHelpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-not-helpful"]',
    );
    expect(notHelpful).toBeNull();

    clickCardDisclosure(container);

    const expandedNotHelpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-not-helpful"]',
    );
    expect(expandedNotHelpful).not.toBeNull();

    act(() => {
      expandedNotHelpful?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const payload = await vi.waitFor(() => readFirstAiContentFeedbackBody(fetchMock));
    expect(payload).toMatchObject({
      name: "product.ai_content_feedback.submitted",
      payload: {
        properties: {
          documentType: "search",
          surfaceId: "inline-analysis:paper-1",
          surfaceKind: "inline_analysis_detail",
          promiseRef: "promise:inline-analysis-auto-run",
          value: "not_helpful",
          metadataPaperId: "paper-1",
          metadataSource: "abstract",
          outputTitleLength: 16,
        },
      },
    });
    const properties = (payload as { payload: { properties: Record<string, unknown> } }).payload
      .properties;
    expect(properties.outputTitleHash).toEqual(expect.stringMatching(/^fnv1a32:/));
    expect(properties.outputBodyHash).toEqual(expect.stringMatching(/^fnv1a32:/));
    expect(properties.outputBodyLength).toEqual(expect.any(Number));
    expect(JSON.stringify(payload)).not.toContain("이 논문은 연구 자동화를");

    act(() => {
      root.unmount();
    });
  });
});
