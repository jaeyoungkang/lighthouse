import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import PromisesPage, { metadata } from "@/app/about/promises/page";
import {
  PROMISE_PARAGRAPHS,
  REQUIRED_PROMISE_VALUE_FACETS,
} from "@/app/about/promises/promise-paragraphs";

const pageHarness = createAboutPageRenderHarness(PromisesPage);

const PROMISE_IDS = [
  "search",
  "inline-analysis",
  "citation",
  "pdf",
  "gap",
  "research-route",
] as const;

describe("PromisesPage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("renders 6 core commitment paragraphs with footnoted references", () => {
    const container = pageHarness.renderPage();
    for (const id of PROMISE_IDS) {
      const paragraph = container.querySelector(`[data-testid="commitment-promise-${id}"]`);
      expect(paragraph, `paragraph ${id}`).not.toBeNull();
    }
    const bodyText = Array.from(container.querySelectorAll("header, section"))
      .map((node) => node.textContent)
      .join("");
    expect(bodyText).not.toContain("promise:");
    const footnotes = container.querySelector('[aria-label="각주"]');
    expect(footnotes, "footnotes").not.toBeNull();
    const footnoteItems = Array.from(footnotes?.querySelectorAll("li") ?? []);
    expect(footnoteItems.length).toBe(6);
    expect(footnoteItems.map((item) => item.textContent)).toEqual([
      "1. promise:search-reaction-summarizes-terrain",
      "2. promise:inline-analysis-auto-run",
      "3. promise:citation-lineage",
      "4. promise:delegate-deep-read-to-moonlight",
      "5. promise:gap-network-detection-from-search",
      "6. promise:route-view-ai-comment-inline-surface",
    ]);
    expect(
      footnotes?.querySelector(
        'li[data-promise-ref*="promise:search-reaction-summarizes-terrain"]',
      ),
    ).not.toBeNull();
    expect(
      footnotes?.querySelector('li[data-promise-ref*="promise:inline-analysis-auto-run"]'),
    ).not.toBeNull();
    expect(
      footnotes?.querySelector('li[data-promise-ref*="promise:citation-lineage"]'),
    ).not.toBeNull();
    expect(
      footnotes?.querySelector('li[data-promise-ref*="promise:delegate-deep-read-to-moonlight"]'),
    ).not.toBeNull();
    expect(
      footnotes?.querySelector('li[data-promise-ref*="promise:gap-network-detection-from-search"]'),
    ).not.toBeNull();
    expect(
      footnotes?.querySelector(
        'li[data-promise-ref*="promise:route-view-ai-comment-inline-surface"]',
      ),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("봇이 곁에서 지금 상태를 알려준다");
  });

  it("covers every required promise value facet", () => {
    const configuredFacets = new Set(REQUIRED_PROMISE_VALUE_FACETS);
    const coveredFacets = new Set(
      PROMISE_PARAGRAPHS.flatMap((paragraph) => paragraph.valueFacetIds),
    );

    expect([...configuredFacets].filter((facet) => !coveredFacets.has(facet))).toEqual([]);
    expect([...coveredFacets].filter((facet) => !configuredFacets.has(facet))).toEqual([]);

    const container = pageHarness.renderPage();
    const renderedFacets = new Set(
      Array.from(container.querySelectorAll("[data-value-facets]"))
        .flatMap((node) => node.getAttribute("data-value-facets")?.split(" ") ?? [])
        .filter(Boolean),
    );
    expect([...configuredFacets].filter((facet) => !renderedFacets.has(facet))).toEqual([]);
  });

  it("sets citation and PDF expectations in researcher-facing prose", () => {
    const container = pageHarness.renderPage();

    const citation = container.querySelector('[data-testid="commitment-promise-citation"]');
    expect(citation?.textContent).toContain("문제의식과 방법");
    expect(citation?.textContent).toContain("그 기반이 어떻게 확장되거나 비판");
    expect(citation?.textContent).toContain("연구 흐름으로 고르게 한다");

    const pdf = container.querySelector('[data-testid="commitment-promise-pdf"]');
    expect(pdf?.textContent).toContain("더 읽을 논문을 고르면");
    expect(pdf?.textContent).toContain("PDF를 내부 view로 다시 만들지 않고");
    expect(pdf?.textContent).toContain("Moonlight 읽기 화면으로 바로 이어 준다");
  });

  it("exports metadata that summarizes the user value at a glance", () => {
    expect(metadata.title).toBe("Moonlight Search는 논문 검토 흐름을 끊지 않게 돕는다");
    expect(metadata.description).toContain("낯선 검색 결과를 좁히고");
    expect(metadata.description).toContain("선행·후속 흐름");
    expect(metadata.description).toContain("연구 판단 장면");
  });

  it("links to every public about page from the shared navigation", () => {
    const container = pageHarness.renderPage();
    const nav = container.querySelector('[data-testid="commitment-about-nav"]');

    expect(nav?.querySelector('a[href="/about/promises"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav?.querySelector('a[href="/about"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/search"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/gap-network"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/graph"]')).toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/ai-comments"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("renders user-experience-centered identity prose at the top of the page", () => {
    const container = pageHarness.renderPage();
    const header = container.querySelector("header");
    expect(header, "page header").not.toBeNull();
    const headerText = header?.textContent ?? "";
    expect(headerText).toMatch(/당신/);
    expect(headerText).toMatch(/Moonlight Search/);
    expect(headerText).toContain("새 연구를 시작하거나 진행 중인 연구의 다음 방향");
    expect(headerText).toContain("Moonlight 검색 기능으로 통합될 논문 탐색 경험");
    expect(headerText).toContain("검색 결과 목록, 인용 계보, 연구 공백 화면");
    expect(headerText).toContain("처음 보는 검색 결과 앞에서는");
    expect(headerText).toContain("그 판단에 필요한 근거");
    const firstPromise = container.querySelector('[data-testid="commitment-promise-search"]');
    expect(firstPromise, "first promise paragraph").not.toBeNull();
    if (firstPromise && header) {
      expect(
        header.compareDocumentPosition(firstPromise) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("renders research-background prose in search, gap, and research-route promises", () => {
    const container = pageHarness.renderPage();

    const search = container.querySelector('[data-testid="commitment-promise-search"]');
    expect(search?.textContent).toContain("작은 문헌 지도처럼 열린다");
    expect(search?.textContent).toContain("제목은 첫 단서");
    expect(search?.textContent).toContain("세부 영역, 갈라지는 흐름");
    expect(search?.textContent).toContain(
      "키워드 검색과 내 라이브러리 논문 곁의 그래프 이웃 탐색을 동시에 시작",
    );
    expect(search?.textContent).toContain("두 결과를 한 번에 합쳐 보여 준다");

    const inlineAnalysis = container.querySelector(
      '[data-testid="commitment-promise-inline-analysis"]',
    );
    expect(inlineAnalysis?.textContent).toContain("모든 논문을 PDF로 열 수는 없다");
    expect(inlineAnalysis?.textContent).toContain("초록 기반 요약과 주제·방법·결과");
    expect(inlineAnalysis?.textContent).toContain("읽기 전 우선순위");

    const gap = container.querySelector('[data-testid="commitment-promise-gap"]');
    expect(gap?.textContent).toContain("새 질문이 남아 있는지");
    expect(gap?.textContent).toContain("클러스터 사이 연결이 약한 지점");
    expect(gap?.textContent).toContain("첫 검색 결과에 함께 온 라이브러리 그래프 근거");
    expect(gap?.textContent).toContain("연구 작업 설명과 대표 논문");
    expect(gap?.textContent).toContain("새 연구 질문 후보");

    const ownerPrincipal = container.querySelector(
      '[data-testid="commitment-promise-research-route"]',
    );
    expect(ownerPrincipal?.textContent).toContain("탐색 화면을 오가며 같은 판단 흐름");
    expect(ownerPrincipal?.textContent).toContain("같은 검토 과정의 다른 장면");
    expect(ownerPrincipal?.textContent).toContain("각 탐색 화면은 현재 논문 묶음과 그 근거");
    expect(ownerPrincipal?.textContent).toContain("방금 본 근거를 이어서 판단");
    expect(ownerPrincipal?.textContent).not.toContain("작업대");
    expect(ownerPrincipal?.textContent).not.toContain("owning content rail");
    expect(ownerPrincipal?.textContent).not.toContain("route view");
  });

  it("renders the common footer on the promises page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-promises-footer");
  });
});
