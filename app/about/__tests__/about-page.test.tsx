import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import AboutPage from "@/app/about/page";

const pageHarness = createAboutPageRenderHarness(AboutPage);

describe("AboutPage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("renders graph-centered public about cards without linking to history or internal intent pages", () => {
    const container = pageHarness.renderPage();
    const searchCard = container.querySelector('[data-testid="commitment-about-card-search"]');
    const gapNetworkCard = container.querySelector(
      '[data-testid="commitment-about-card-gap-network"]',
    );
    const graphCard = container.querySelector('[data-testid="commitment-about-card-graph"]');
    const aiCommentsCard = container.querySelector(
      '[data-testid="commitment-about-card-ai-comments"]',
    );
    const promisesCard = container.querySelector('[data-testid="commitment-about-card-promises"]');
    const intentCard = container.querySelector('[data-testid="commitment-about-card-intent"]');
    expect(searchCard).not.toBeNull();
    expect(gapNetworkCard).not.toBeNull();
    expect(graphCard).not.toBeNull();
    expect(aiCommentsCard).not.toBeNull();
    expect(promisesCard).not.toBeNull();
    expect(intentCard).toBeNull();
    expect(searchCard?.getAttribute("href")).toBe("/about/search");
    expect(gapNetworkCard?.getAttribute("href")).toBe("/about/gap-network");
    expect(graphCard?.getAttribute("href")).toBe("/about/graph/sample");
    expect(graphCard?.textContent).toContain("AI for Science");
    expect(graphCard?.textContent).toContain("샘플 그래프");
    expect(aiCommentsCard?.getAttribute("href")).toBe("/about/ai-comments");
    expect(aiCommentsCard?.textContent).toContain("연구 화면마다 AI");
    expect(promisesCard?.getAttribute("href")).toBe("/about/promises");
    const root = container.querySelector('[data-testid="commitment-about-page"]');
    expect(root?.querySelector("h1")?.textContent).toContain("Moonlight Search");
    expect(root?.textContent).toContain("논문 검색 결과를 어떻게 그래프로 읽고");
    expect(root?.querySelector('a[href="/about/changes"]')).toBeNull();
    expect(root?.textContent).not.toContain("변경 로그");
    const nav = container.querySelector('[data-testid="commitment-about-nav"]');
    expect(nav?.querySelector('a[href="/about"]')?.getAttribute("aria-current")).toBe("page");
    expect(nav?.querySelector('a[href="/about/search"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/gap-network"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/graph"]')).toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/ai-comments"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/promises"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("renders the common footer on the about landing page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-about-footer");
  });
});
