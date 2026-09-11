import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import type * as TrackModule from "@/app/lib/track";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";

vi.mock("@/app/lib/analytics/client", () => ({
  trackCanonicalEvent: vi.fn(),
}));

vi.mock("@/app/lib/track", async (importOriginal) => ({
  ...(await importOriginal<typeof TrackModule>()),
  track: vi.fn(),
}));

const analysis: AIAnalysis = {
  summary: "이 논문은 연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
  objective: "연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
  methodology: "멀티 에이전트 파이프라인과 트리 탐색을 사용한다.",
  results: "워크숍 수준의 자동 연구 산출물을 만든다.",
  keywords: ["autonomous research agents", "scientific discovery"],
  semanticProfile: {
    claim: "이 논문은 연구 자동화를 위한 에이전트 파이프라인을 제안한다.",
    topics: ["autonomous research agents", "scientific discovery"],
    method: "멀티 에이전트 파이프라인과 트리 탐색을 사용한다.",
    finding: "워크숍 수준의 자동 연구 산출물을 만든다.",
    quotedBasis: {
      claim: "research automation agent pipeline",
      topics: ["autonomous research agents", "scientific discovery"],
      method: "multi-agent pipeline and tree search",
      finding: "workshop-level automated outputs",
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
      {
        query: "scientific discovery agents reproducibility",
        rationale: "재현성 평가를 확인한다.",
        basis: "scientific discovery agents",
      },
      {
        query: "automated research evaluation benchmark",
        rationale: "평가 기준을 확인한다.",
        basis: "automated research evaluation",
      },
      {
        query: "fourth query must not render",
        rationale: "표시 상한 밖의 후보다.",
        basis: "overflow candidate",
      },
    ],
  },
  confidence: "high",
  evidenceMap: {},
};

function clickCardDisclosure(container: HTMLElement) {
  const card = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
  if (!card) throw new Error("expected card inspection surface");
  act(() => {
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  return card;
}

describe("SearchResultItem interactions", () => {
  it("tracks relationship opens only after navigation is accepted", async () => {
    const { trackCanonicalEvent } = await import("@/app/lib/analytics/client");
    const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenCitationLineage = vi.fn(() => false);
    const paper = {
      paperId: "paper-journey",
      title: "Journey Paper",
      abstract: "abstract",
      year: 2024,
      citationCount: 10,
      url: "https://example.com/paper-journey",
      authors: [{ name: "Author" }],
      openAccessPdf: null,
      doi: null,
      referenceIds: ["reference-1"],
      citationIds: null,
    };

    const render = () => {
      act(() => {
        root.render(
          <SearchResultItem
            paper={paper}
            isLast
            analyticsContext={{
              ownerPrincipalId: "principal-1",
              documentId: "search-doc-1",
              journeyContextId: "journey-1",
              searchContextId: "search-1",
              resultRank: 1,
              rankBucket: "top_3",
              totalResultCount: 10,
              visibleResultCount: 10,
              sourceSurface: "search_results",
            }}
            onOpenCitationLineage={onOpenCitationLineage}
          />,
        );
      });
    };
    render();

    const lineageButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("인용"),
    );
    if (!lineageButton) throw new Error("expected citation-lineage action");
    act(() => {
      lineageButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(trackCanonicalEventMock).not.toHaveBeenCalled();

    onOpenCitationLineage.mockReturnValue(true);
    act(() => {
      lineageButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const lineageCall = trackCanonicalEventMock.mock.calls.find(
      ([eventName]) => eventName === "citation_lineage_opened",
    );
    expect(lineageCall?.[1].subject).toMatchObject({ paper_id: "paper-journey" });

    act(() => {
      root.unmount();
    });
  });

  it("opens author and topic terms through the search-term handler", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSearchTerm = vi.fn();

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
            authors: [
              { name: "Author 1" },
              { name: "Author 2" },
              { name: "Author 3" },
              { name: "Author 4" },
            ],
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
          onSearchTerm={onSearchTerm}
        />,
      );
    });

    expect(container.textContent).toContain("Author 1,Author 2,Author 3");
    expect(container.textContent).toContain("외 1명 펼치기");
    expect(container.textContent).not.toContain("Author 4");

    const expandAuthorsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "외 1명 펼치기",
    );
    if (!expandAuthorsButton) throw new Error("expected author expansion button");
    expect(expandAuthorsButton.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[data-testid="search-result-card-disclosure"]'),
    ).toHaveAttribute("aria-expanded", "false");

    act(() => {
      expandAuthorsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(expandAuthorsButton.getAttribute("aria-expanded")).toBe("true");
    expect(expandAuthorsButton.textContent).toBe("접기");

    const fourthAuthorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Author 4",
    );
    if (!fourthAuthorButton) throw new Error("expected author list button");

    act(() => {
      fourthAuthorButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    clickCardDisclosure(container);

    const topicButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("scientific discovery"),
    );
    if (!topicButton) throw new Error("expected topic search button");

    act(() => {
      topicButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSearchTerm).toHaveBeenNthCalledWith(
      1,
      "Author 4",
      undefined,
      expect.objectContaining({ metaKey: false }),
    );
    expect(onSearchTerm).toHaveBeenNthCalledWith(
      2,
      "scientific discovery",
      undefined,
      expect.objectContaining({ metaKey: false }),
    );

    onSearchTerm.mockClear();
    const expandedFourthAuthorButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Author 4",
    );
    if (!expandedFourthAuthorButton) throw new Error("expected expanded author button");
    act(() => {
      expandedFourthAuthorButton.dispatchEvent(
        new MouseEvent("click", { bubbles: true, metaKey: true }),
      );
      topicButton.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    });

    expect(onSearchTerm).toHaveBeenNthCalledWith(
      1,
      "Author 4",
      undefined,
      expect.objectContaining({ metaKey: true }),
    );
    expect(onSearchTerm).toHaveBeenNthCalledWith(
      2,
      "scientific discovery",
      undefined,
      expect.objectContaining({ button: 1 }),
    );
  });
});

describe("SearchResultItem author expansion", () => {
  it("keeps author expansion focus stable without toggling the card", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const onSearchTerm = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-author-summary",
            title: "Stable Author Summary",
            abstract: null,
            year: 2024,
            citationCount: 3,
            url: "https://example.com/paper-author-summary",
            authors: [
              { name: "Author 1" },
              { name: "Author 2" },
              { name: "Author 3" },
              { name: "Author 4" },
            ],
            openAccessPdf: null,
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          onSearchTerm={onSearchTerm}
        />,
      );
    });

    const expandAuthors = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "외 1명 펼치기",
    );
    expandAuthors?.focus();
    act(() => {
      expandAuthors?.click();
    });
    expect(expandAuthors).toHaveTextContent("접기");
    expect(document.activeElement).toBe(expandAuthors);
    expect(container.textContent).toContain("Author 4");
    act(() => {
      expandAuthors?.click();
    });
    expect(expandAuthors).toHaveTextContent("외 1명 펼치기");
    expect(document.activeElement).toBe(expandAuthors);
    expect(container.textContent).not.toContain("Author 4");
    expect(onSearchTerm).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-testid="search-result-card-disclosure"]'),
    ).toHaveAttribute("aria-expanded", "false");

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("SearchResultItem detail interactions", () => {
  it("opens paper-specific different-position search candidates from inline analysis", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSearchTerm = vi.fn();

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
          onSearchTerm={onSearchTerm}
        />,
      );
    });

    expect(container.querySelector('[data-testid="different-position-toggle"]')).toBeNull();

    clickCardDisclosure(container);

    const expandedText = container.textContent;
    expect(expandedText.indexOf("방법")).toBeLessThan(expandedText.indexOf("결과"));
    expect(expandedText.indexOf("결과")).toBeLessThan(expandedText.indexOf("다른 입장 탐색"));
    const section = container.querySelector('[data-testid="different-position-section"]');
    expect(section).toBeTruthy();
    const toggle = container.querySelector('[data-testid="different-position-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle?.textContent).toContain("다른 입장 탐색");
    expect(toggle?.tagName).toBe("P");
    expect(toggle?.hasAttribute("aria-expanded")).toBe(false);
    const toggleIcon = container.querySelector('[data-testid="different-position-toggle-icon"]');
    expect(toggleIcon).toBeNull();

    const panel = container.querySelector('[data-testid="different-position-panel"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain("autonomous research agents reliability critique");
    const limitations = container.querySelector('[data-testid="different-position-limitations"]');
    expect(limitations?.textContent).toBe(analysis.stanceProfile?.limitations);
    expect(section?.textContent).not.toContain(
      "다른 입장의 존재를 확정하지 않고, 확인할 검색어만 제안한다.",
    );
    expect(section?.textContent).not.toContain(analysis.stanceProfile?.mainPosition);
    expect(section?.textContent).not.toContain(analysis.stanceProfile?.debateAxis);
    expect(panel?.querySelectorAll("button")).toHaveLength(3);
    expect(panel?.textContent).not.toContain("fourth query must not render");

    const rationales = panel?.querySelectorAll('[data-testid="different-position-rationale"]');
    expect(rationales).toHaveLength(3);
    expect(rationales?.[0]?.textContent).toBe("자동 연구 산출물의 신뢰성 문제를 확인한다.");
    expect(rationales?.[1]?.textContent).toBe("재현성 평가를 확인한다.");
    expect(rationales?.[2]?.textContent).toBe("평가 기준을 확인한다.");
    expect(panel?.textContent).not.toContain("표시 상한 밖의 후보다.");

    const action = panel?.querySelector('[data-testid="different-position-search-action"]');
    expect(action).toBeTruthy();

    act(() => {
      action?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onSearchTerm).toHaveBeenCalledWith(
      "autonomous research agents reliability critique",
      { entry: "position" },
      expect.objectContaining({ metaKey: false }),
    );
  });

  it("omits the limitations line when the analysis has none", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onSearchTerm = vi.fn();
    const analysisWithoutLimitations: AIAnalysis = {
      ...analysis,
      stanceProfile: {
        mainPosition: analysis.stanceProfile?.mainPosition ?? null,
        debateAxis: analysis.stanceProfile?.debateAxis ?? null,
        counterSearchQueries: analysis.stanceProfile?.counterSearchQueries ?? [],
        limitations: null,
      },
    };

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
          analysisResult={{ analysis: analysisWithoutLimitations, source: "abstract" }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onSearchTerm={onSearchTerm}
        />,
      );
    });

    clickCardDisclosure(container);

    expect(container.querySelector('[data-testid="different-position-limitations"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="different-position-search-action"]'),
    ).toBeTruthy();
  });

  it("tracks detail and PDF clicks with card rank metadata", async () => {
    const { trackCanonicalEvent } = await import("@/app/lib/analytics/client");
    const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
    trackCanonicalEventMock.mockClear();
    const container = document.createElement("div");
    const root = createRoot(container);
    const moonlightHref = "https://themoonlight.io/file?url=https%3A%2F%2Farxiv.org%2Fpdf%2F2401.1";

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
            authors: [{ name: "Author 1" }, { name: "Author 2" }],
            openAccessPdf: { url: "https://arxiv.org/pdf/2401.1" },
            doi: null,
            referenceIds: ["r1", "r2"],
            citationIds: null,
          }}
          isLast
          analyticsContext={{
            ownerPrincipalId: "principal-1",
            documentId: "search-doc-1",
            journeyContextId: "search-doc-1",
            searchContextId: "search-doc-1",
            resultRank: 2,
            rankBucket: "top_3",
            totalResultCount: 20,
            visibleResultCount: 10,
            queryHash: "fnv1a32:test",
            sort: "relevance",
            sourceSurface: "search_results",
          }}
          analysisState="done"
          analysisResult={{ analysis, source: "abstract" }}
        />,
      );
    });

    clickCardDisclosure(container);

    const detailCall = trackCanonicalEventMock.mock.calls.find(
      (call) => call[0] === "search_result_inspected",
    );
    expect(detailCall?.[1].subject).toEqual({
      search_context_id: "search-doc-1",
      paper_id: "paper-1",
    });
    expect(detailCall?.[1].properties).toMatchObject({
      journey_context_id: "search-doc-1",
      search_context_id: "search-doc-1",
      paper_id: "paper-1",
      result_rank: 2,
      has_pdf: true,
      evidence_availability: "available",
    });

    const pdfLink = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent.trim() === "PDF",
    );
    if (!pdfLink) throw new Error("expected PDF link");
    expect(pdfLink.getAttribute("href")).toBe(moonlightHref);

    act(() => {
      pdfLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(
      container
        .querySelector('[data-testid="search-result-card-disclosure"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("true");

    const pdfOpenCall = trackCanonicalEventMock.mock.calls.find((call) => call[0] === "pdf_opened");
    expect(pdfOpenCall?.[1].properties).toMatchObject({
      paper_id: "paper-1",
      open_element: "pdf_button",
      open_target: "moonlight_external",
      result_rank: 2,
      search_context_id: "search-doc-1",
    });
  });
});

describe("SearchResultItem metadata-only inspection analytics", () => {
  it("tracks metadata-only card inspection with explicit evidence availability", async () => {
    const { trackCanonicalEvent } = await import("@/app/lib/analytics/client");
    const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
    trackCanonicalEventMock.mockClear();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-metadata-only",
            title: "Metadata Only Paper",
            abstract: null,
            year: 2021,
            citationCount: 4,
            url: "https://example.com/paper-metadata-only",
            authors: [{ name: "Author 1" }],
            openAccessPdf: null,
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analyticsContext={{
            ownerPrincipalId: "principal-1",
            documentId: "search-doc-1",
            journeyContextId: "search-doc-1",
            searchContextId: "search-doc-1",
            resultRank: 4,
            rankBucket: "top_10",
            totalResultCount: 20,
            visibleResultCount: 10,
            sourceSurface: "search_results",
          }}
        />,
      );
    });

    clickCardDisclosure(container);
    const detailCalls = trackCanonicalEventMock.mock.calls.filter(
      (call) => call[0] === "search_result_inspected",
    );
    expect(detailCalls).toHaveLength(1);
    expect(detailCalls[0]?.[1].properties).toMatchObject({
      paper_id: "paper-metadata-only",
      result_rank: 4,
      evidence_availability: "available",
    });

    clickCardDisclosure(container);
    expect(
      trackCanonicalEventMock.mock.calls.filter((call) => call[0] === "search_result_inspected"),
    ).toHaveLength(1);

    clickCardDisclosure(container);
    expect(
      trackCanonicalEventMock.mock.calls.filter((call) => call[0] === "search_result_inspected"),
    ).toHaveLength(1);

    act(() => {
      root.unmount();
    });
  });
});

describe("SearchResultItem PDF interactions", () => {
  it("tracks external PDF link clicks before preserving navigation", async () => {
    const { trackCanonicalEvent } = await import("@/app/lib/analytics/client");
    const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
    trackCanonicalEventMock.mockClear();
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", {
      configurable: true,
      value: sendBeacon,
    });
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-2",
            title: "External PDF Paper",
            abstract: "abstract",
            year: 2021,
            citationCount: 5,
            url: "https://example.com/paper-2",
            authors: [{ name: "Author 1" }],
            openAccessPdf: { url: "https://publisher.example/pdf/paper-2.pdf" },
            doi: null,
            referenceIds: [],
            citationIds: null,
          }}
          isLast
          analyticsContext={{
            ownerPrincipalId: "principal-1",
            documentId: "search-doc-1",
            journeyContextId: "search-doc-1",
            searchContextId: "search-doc-1",
            resultRank: 5,
            rankBucket: "top_10",
            totalResultCount: 20,
            visibleResultCount: 10,
            queryHash: "fnv1a32:test",
            sort: "relevance",
            sourceSurface: "search_results",
          }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    const externalPdfLink = Array.from(container.querySelectorAll("a")).find(
      (link) => link.textContent.trim() === "PDF",
    );
    if (!externalPdfLink) throw new Error("expected external PDF link");
    expect(externalPdfLink.getAttribute("href")).toBe(
      "https://themoonlight.io/file?url=https%3A%2F%2Fpublisher.example%2Fpdf%2Fpaper-2.pdf",
    );

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      externalPdfLink.dispatchEvent(click);
    });

    expect(click.defaultPrevented).toBe(false);
    const pdfOpenCall = trackCanonicalEventMock.mock.calls.find((call) => call[0] === "pdf_opened");
    expect(pdfOpenCall?.[1].subject).toEqual({
      search_context_id: "search-doc-1",
      paper_id: "paper-2",
    });
    expect(pdfOpenCall?.[1].properties).toMatchObject({
      paper_id: "paper-2",
      open_element: "pdf_button",
      open_target: "moonlight_external",
      result_rank: 5,
      evidence_availability: "available",
    });
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("tracks middle-click PDF handoffs once", async () => {
    const { trackCanonicalEvent } = await import("@/app/lib/analytics/client");
    const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
    trackCanonicalEventMock.mockClear();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={{
            paperId: "paper-middle-click",
            title: "Middle Click Paper",
            abstract: null,
            year: 2024,
            citationCount: 1,
            url: "https://example.com/paper-middle-click",
            authors: [{ name: "Author" }],
            openAccessPdf: { url: "https://arxiv.org/pdf/2401.2" },
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analyticsContext={{
            ownerPrincipalId: "principal-1",
            documentId: "search-doc-1",
            journeyContextId: "journey-1",
            searchContextId: "search-1",
            resultRank: 1,
            rankBucket: "top_3",
            totalResultCount: 10,
            visibleResultCount: 10,
            sourceSurface: "search_results",
          }}
        />,
      );
    });

    const pdfLink = Array.from(container.querySelectorAll("a")).find(
      (anchor) => anchor.textContent.trim() === "PDF",
    );
    if (!pdfLink) throw new Error("expected PDF link");
    act(() => {
      pdfLink.dispatchEvent(
        new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }),
      );
    });
    expect(
      trackCanonicalEventMock.mock.calls.filter((call) => call[0] === "pdf_opened"),
    ).toHaveLength(1);

    act(() => {
      root.unmount();
    });
  });
});
