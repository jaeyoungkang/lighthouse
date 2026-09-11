import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";

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

describe("SearchResultItem PDF links", () => {
  it("renders a disabled pdf button when no direct PDF URL is available", () => {
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
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    const pdfButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("PDF"),
    );
    expect(pdfButton).toBeTruthy();
    expect(pdfButton?.hasAttribute("disabled")).toBe(true);
    const doiAction = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-doi-action"]',
    );
    expect(doiAction?.tagName).toBe("BUTTON");
    expect(doiAction?.textContent).toBe("DOI");
    expect(doiAction?.disabled).toBe(true);
    expect(doiAction?.className).toContain("w-14");
    expect(doiAction?.getAttribute("data-doi-availability")).toBe("unavailable");
  });

  it("opens an arXiv pdf via the PDF button through Moonlight", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const moonlightHref =
      "https://themoonlight.io/file?url=https%3A%2F%2Farxiv.org%2Fpdf%2F2401.00001";

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
            openAccessPdf: { url: "https://arxiv.org/pdf/2401.00001" },
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
        />,
      );
    });

    const pdfLink = Array.from(container.querySelectorAll("a")).find((anchor) =>
      anchor.textContent.includes("PDF"),
    );
    expect(pdfLink).toBeTruthy();
    if (!pdfLink) throw new Error("pdf link not rendered");
    expect(pdfLink.getAttribute("href")).toBe(moonlightHref);

    act(() => {
      pdfLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  });

  it("keeps the title non-interactive and opens inspection from the wide card surface", () => {
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
            openAccessPdf: { url: "https://arxiv.org/pdf/2401.00001" },
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
        />,
      );
    });

    const title = container.querySelector<HTMLElement>('[data-testid="search-result-title"]');
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );
    expect(title).toBeTruthy();
    expect(title?.tagName).toBe("SPAN");
    expect(title?.hasAttribute("aria-expanded")).toBe(false);
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 펼치기");
    const disclosureIcon = container.querySelector(
      '[data-testid="search-result-card-disclosure-icon"]',
    );
    expect(disclosureIcon).toBeTruthy();
    expect(disclosureIcon?.getAttribute("class")).not.toContain("rotate-180");
    expect(container.querySelector('a[href*="themoonlight.io/file"]')?.textContent).toContain(
      "PDF",
    );

    clickCardDisclosure(container);

    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(disclosure?.getAttribute("aria-label")).toBe("논문 정보 접기");
    expect(disclosureIcon?.getAttribute("class")).toContain("rotate-180");
    expect(container.textContent).toContain("원문/식별자");
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.com/paper-1"]'),
    ).toBeTruthy();
  });

  it("links non-arXiv PDF controls through Moonlight without Light House download", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const moonlightHref =
      "https://themoonlight.io/file?url=https%3A%2F%2Fpublisher.example%2Fpaper-1.pdf";

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
            openAccessPdf: { url: "https://publisher.example/paper-1.pdf" },
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
        />,
      );
    });

    const pdfAnchor = Array.from(container.querySelectorAll<HTMLAnchorElement>("a")).find(
      (anchor) =>
        anchor.textContent.includes("PDF") && anchor.getAttribute("href") === moonlightHref,
    );

    expect(
      container.querySelector<HTMLAnchorElement>(`a[href="${moonlightHref}"]`)?.textContent,
    ).toContain("PDF");
    expect(pdfAnchor).toBeTruthy();
    if (!pdfAnchor) throw new Error("pdf anchor not rendered");
    expect(pdfAnchor.target).toBe("_blank");

    act(() => {
      pdfAnchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
  });

  it("keeps the provider paper URL inside card inspection when the paper has no direct PDF", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenPdf = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-2",
            title: "Plain Paper",
            abstract: "abstract",
            year: 2024,
            citationCount: 10,
            url: "https://example.com/paper-2",
            authors: [{ name: "Author 2" }],
            openAccessPdf: null,
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
          onOpenPdf={onOpenPdf}
        />,
      );
    });

    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://example.com/paper-2"]'),
    ).toBeNull();

    clickCardDisclosure(container);

    const sourceAnchor = container.querySelector<HTMLAnchorElement>(
      'a[href="https://example.com/paper-2"]',
    );
    expect(sourceAnchor).toBeTruthy();
    act(() => {
      sourceAnchor?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(onOpenPdf).not.toHaveBeenCalled();
  });

  it("uses the provider paper URL inside inspection and never links to Semantic Scholar", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "271854887",
            title: "The AI Scientist",
            abstract: "abstract",
            year: 2024,
            citationCount: 10,
            // 서버가 만든 paper.url(외부 식별자가 없어 Episteme paper 페이지로 떨어진 fallback).
            url: "https://sah.borca.ai/papers/271854887",
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

    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://sah.borca.ai/papers/271854887"]'),
    ).toBeNull();

    clickCardDisclosure(container);

    // 서버가 준 paper.url을 inspection source link로 그대로 쓴다.
    expect(
      container.querySelector<HTMLAnchorElement>('a[href="https://sah.borca.ai/papers/271854887"]'),
    ).toBeTruthy();
    // Semantic Scholar 링크는 어떤 형태로도 렌더하지 않는다.
    expect(container.querySelector('a[href*="semanticscholar.org"]')).toBeNull();
  });

  it("disables the pdf button when only doi is available without a direct PDF URL", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenPdf = vi.fn();

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
            doi: "10.1000/test",
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          onOpenPdf={onOpenPdf}
        />,
      );
    });

    const pdfButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("PDF"),
    );
    const doiLink = container.querySelector<HTMLAnchorElement>(
      '[data-testid="search-result-doi-action"]',
    );
    const actionText =
      container.querySelector('[data-testid="search-result-actions"]')?.textContent ?? "";
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-card-disclosure"]',
    );

    expect(doiLink?.href).toBe("https://doi.org/10.1000/test");
    expect(doiLink?.textContent).toBe("DOI");
    expect(doiLink?.className).toContain("w-14");
    expect(doiLink?.getAttribute("data-doi-availability")).toBe("available");
    expect(actionText).not.toContain("10.1000/test");
    expect(pdfButton).toBeTruthy();
    expect(pdfButton?.hasAttribute("disabled")).toBe(true);
    expect(actionText.indexOf("DOI")).toBeLessThan(actionText.indexOf("PDF"));

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    click.preventDefault();
    act(() => {
      doiLink?.dispatchEvent(click);
    });
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
  });
});
