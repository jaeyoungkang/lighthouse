import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import AiCommentsPage, { metadata } from "@/app/about/ai-comments/page";

const pageHarness = createAboutPageRenderHarness(AiCommentsPage);

describe("AiCommentsPage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("explains what AI comments do for each public research route payload shape", () => {
    const container = pageHarness.renderPage();
    const page = container.querySelector('[data-testid="commitment-ai-comments-page"]');
    const text = page?.textContent ?? "";

    expect(metadata.title).toContain("연구 화면마다 AI가 설명하는 것");
    expect(page?.querySelector("h1")?.textContent).toContain("연구 화면마다 AI가 설명하는 것");
    expect(text).toContain("모든 페이지에 같은 요약을 붙이지 않는다");
    expect(text).toContain("현재 연구 화면의 다음 판단");
    expect(text).toContain("검색 결과 화면에서는 결과 지형을 설명한다");
    expect(text).toContain("검색어를 반복하지 않고");
    expect(text).toContain("인용 계보 화면에서는 선행과 후속 흐름을 설명한다");
    expect(text).toContain("비슷한 논문 화면에서는 그래프 이웃의 관계를 설명한다");
    expect(text).toContain("연구 공백 화면에서는 리포트 본문이 설명을 흡수한다");
    expect(text).toContain("논문 카드 안에서는 읽기 전 판단을 돕는다");
    expect(text).not.toContain("Episteme");
    expect(text).not.toContain("respond");
    expect(text).not.toContain("reactionGeneration");
    expect(text).not.toContain("graph_neighbors");
    expect(text).not.toContain("/api/");

    const nav = container.querySelector('[data-testid="commitment-about-nav"]');
    expect(nav?.querySelector('a[href="/about/ai-comments"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav?.querySelector('a[href="/about"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/search"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/gap-network"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/promises"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("renders the common footer on the AI comments page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-ai-comments-page-footer");
  });
});
