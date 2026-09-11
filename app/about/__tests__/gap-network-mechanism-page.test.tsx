import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import GapNetworkMechanismPage, { metadata } from "@/app/about/gap-network/page";

const pageHarness = createAboutPageRenderHarness(GapNetworkMechanismPage);

describe("GapNetworkMechanismPage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("keeps the gap report page centered on the core relation map", () => {
    const container = pageHarness.renderPage();
    const page = container.querySelector('[data-testid="commitment-gap-network-mechanism-page"]');
    const text = page?.textContent ?? "";

    expect(metadata.title).toContain("연구 공백");
    expect(page?.querySelector("h1")?.textContent).toContain("연구 공백");
    expect(text).toContain("검색 결과나 인용 계보");
    expect(text).toContain("정답을 단정하는 것이 아니라 질문 후보를 좁히는 것");
    expect(page?.querySelector('[data-testid="commitment-graph-surface-gap"]')).not.toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-graph-surface-gap-network"]'),
    ).not.toBeNull();
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-surface-gap-network-nodes"] rect')
        .length,
    ).toBeGreaterThanOrEqual(5);
    expect(text).toContain("공백 분석은 약하게 이어진 논문 묶음을 놓치지 않게 돕는다");
    expect(text).toContain("AI scientist / hypothesis");
    expect(text).toContain("robotic lab / automation");
    expect(text).toContain("가설 생성 → 실험 검증");
    expect(
      page?.querySelector('[data-testid="commitment-gap-network-mechanism-input"]'),
    ).toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-gap-network-mechanism-cluster"]'),
    ).toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-gap-network-mechanism-related-links"]'),
    ).toBeNull();
    expect(text).not.toContain("gap payload");
    expect(text).not.toContain("numeric paper id");
    expect(text).not.toContain("paper pair");
    expect(text).not.toContain("graph support edge");
    expect(text).not.toContain("tie-breaker");
    expect(text).not.toContain("Episteme");
    expect(text).not.toContain("gap-network-pending");
    expect(text).not.toContain("/api/");
    expect(text).not.toContain("UUID");
    const nav = container.querySelector('[data-testid="commitment-about-nav"]');
    expect(nav?.querySelector('a[href="/about/gap-network"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav?.querySelector('a[href="/about"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/search"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/graph"]')).toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/ai-comments"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/promises"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("renders the common footer on the gap-network mechanism page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-gap-network-mechanism-page-footer");
  });
});
