import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import SearchMechanismPage, { metadata } from "@/app/about/search/page";

const pageHarness = createAboutPageRenderHarness(SearchMechanismPage);

describe("SearchMechanismPage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("keeps the search mechanism page centered on the co-equal keyword and graph inputs", () => {
    const container = pageHarness.renderPage();
    const page = container.querySelector('[data-testid="commitment-search-mechanism-page"]');
    const text = page?.textContent ?? "";

    expect(metadata.title).toContain("원하는 논문");
    expect(page?.querySelector("h1")?.textContent).toContain("원하는 논문");
    expect(text).toContain("주요 학술 출처");
    expect(text).not.toContain("Semantic Scholar");
    expect(text).not.toContain("Episteme");
    expect(text).toContain("내 라이브러리에 저장한 논문");
    expect(text).not.toContain("Moonlight 라이브러리");
    expect(text).toContain("원하는 논문을 놓칠 수 있다");
    expect(page?.querySelector('[data-testid="commitment-graph-surface-search"]')).not.toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-graph-surface-search-network"]'),
    ).not.toBeNull();
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-surface-search-network-nodes"] rect')
        .length,
    ).toBeGreaterThanOrEqual(5);
    expect(
      page?.querySelector('[data-testid="commitment-graph-surface-representative"]'),
    ).not.toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-graph-surface-representative-network"]'),
    ).not.toBeNull();
    expect(
      page?.querySelectorAll(
        '[data-testid="commitment-graph-surface-representative-network-nodes"] rect',
      ).length,
    ).toBeGreaterThanOrEqual(5);
    expect(page?.querySelector('[data-testid="commitment-graph-surface-terms"]')).not.toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-graph-surface-terms-network"]'),
    ).not.toBeNull();
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-surface-terms-network-nodes"] rect')
        .length,
    ).toBeGreaterThanOrEqual(5);
    expect(text).toContain("키워드 검색과 라이브러리 그래프 탐색을 함께 시작한다");
    expect(text).toContain("두 결과를 한 번에 공개");
    expect(text).toContain("내 연구와 가까움");
    expect(text).not.toContain("관련성 높은 후보");
    expect(text).not.toContain("라이브러리 인접");
    expect(text).not.toContain("검색어 일치");
    expect(text).toContain("출판연도와 제목 중복 기준");
    expect(text).toContain("라이브러리 근접도 근거가 있는 카드");
    expect(text).toContain("검색어 관련도와 라이브러리 근접도는 각각 최종 점수의 최대 절반");
    expect(text).not.toContain("검색어 관련성·출판연도·중복 기준");
    expect(text).not.toContain("검색어 관련성, 출판연도, 제목 중복 기준");
    expect(text).toContain("먼저 키워드 결과를 보여 준 뒤 그래프 후보를 몰래 덧붙이지 않는다");
    expect(text).toContain("대표 논문은 검색어에 맞는지를 먼저 본다");
    expect(text).toContain("연구 용어는 구체적인 방법 표현을 먼저 찾고");
    expect(text).toContain("AI Scientists for");
    expect(text).toContain("Hypothesis Generation");
    expect(text).toContain("Retrieval Augmented");
    expect(text).toContain("Hypothesis Generation");
    expect(text).toContain("retrieval augmented");
    expect(text).toContain("hypothesis generation");
    expect(text).toContain("연결된 논문 3편");
    expect(
      page?.querySelector('[data-testid="commitment-search-mechanism-keyword-limit"]'),
    ).toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-search-mechanism-library-clues"]'),
    ).toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-search-mechanism-related-links"]'),
    ).toBeNull();
    expect(text).not.toContain("graphSupportCount");
    expect(text).not.toContain("numeric paper id");
    expect(text).not.toContain("query directness");
    expect(text).not.toContain("field fit gate");
    expect(text).not.toContain("tie-breaker");
    expect(text).not.toContain("graph_neighbors");
    expect(text).not.toContain("corpus id");
    expect(text).not.toContain("/api");
    const nav = container.querySelector('[data-testid="commitment-about-nav"]');
    expect(nav?.querySelector('a[href="/about/search"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav?.querySelector('a[href="/about"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/gap-network"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/graph"]')).toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/ai-comments"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/promises"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("renders the common footer on the search mechanism page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-search-mechanism-page-footer");
  });
});
