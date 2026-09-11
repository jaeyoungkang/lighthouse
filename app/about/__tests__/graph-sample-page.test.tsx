import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { createAboutPageRenderHarness } from "@/app/about/__tests__/about-page-test-support";
import { buildAiScienceSampleLayout } from "@/app/about/graph/sample/ai-for-science-sample-layout";
import GraphSamplePage, { metadata } from "@/app/about/graph/sample/page";

const pageHarness = createAboutPageRenderHarness(GraphSamplePage);

describe("GraphSamplePage", () => {
  beforeEach(() => {
    pageHarness.setup();
  });
  afterEach(() => {
    pageHarness.cleanup();
  });

  it("renders an ai-for-science scholarly relation example without claiming search runtime", () => {
    const container = pageHarness.renderPage();
    const page = container.querySelector('[data-testid="commitment-graph-sample-page"]');
    const text = page?.textContent ?? "";

    expect(metadata.title).toContain("AI for Science 논문 관계 예시");
    expect(page?.querySelector("h1")?.textContent).toContain("AI for Science 논문 관계 예시");
    expect(text).toContain("논문 6편");
    expect(text).toContain("일반 검색 결과를 만드는 과정을 재현한 그림은 아니다");
    expect(text).toContain("키워드 검색과 내 라이브러리 논문 곁의 그래프 이웃 탐색");

    expect(page?.querySelector('[data-testid="commitment-graph-sample-svg"]')).not.toBeNull();
    expect(
      page?.querySelector('[data-testid="commitment-graph-sample-cluster-legend"]'),
    ).not.toBeNull();
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-sample-nodes"] rect').length,
    ).toBe(6);
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-sample-svg"] > rect').length,
    ).toBe(0);
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-sample-strong-edges"] line').length,
    ).toBeGreaterThanOrEqual(4);
    expect(
      page?.querySelectorAll('[data-testid="commitment-graph-sample-weak-edges"] line').length,
    ).toBeGreaterThanOrEqual(2);

    expect(text).toContain("AI Scientists for HypothesisGeneration");
    expect(text).toContain("Robotic Labs for Closed LoopScience");
    expect(text).toContain("Retrieval AugmentedHypothesis Generation forScientific Workflows");
    expect(text).toContain("hypothesis generation");
    expect(text).toContain("closed-loop science");
    expect(text).toContain("함께 인용");
    expect(text).toContain("같은 참고문헌");
    expect(text).toContain("함께 인용 4");
    expect(text).toContain("참고문헌 1");

    expect(text).toContain("일반 검색의 결과 후보나 순서를 약속하지 않는다");
    expect(page?.querySelector('[data-testid="commitment-graph-sample-output-panel"]')).toBeNull();
    expect(page?.querySelector('[data-testid="commitment-graph-sample-paper-table"]')).toBeNull();
    expect(page?.querySelector('[data-testid="commitment-graph-sample-edge-table"]')).toBeNull();
    expect(page?.querySelector('[data-testid="commitment-graph-sample-mechanism"]')).toBeNull();
    expect(page?.querySelector('[data-testid="commitment-graph-sample-related-links"]')).toBeNull();
    expect(text).not.toContain("graphSupportCount");
    expect(text).not.toContain("numeric paper id");
    expect(text).not.toContain("paper pair");
    expect(text).not.toContain("priority");
    expect(text).not.toContain("보조 edge");
    expect(text).not.toContain("Episteme");
    expect(text).not.toContain("/api/");

    const nav = container.querySelector('[data-testid="commitment-about-nav"]');
    expect(nav?.querySelector('a[href="/about/graph"]')).toBeNull();
    expect(nav?.querySelector('a[href="/about/graph/sample"]')?.getAttribute("aria-current")).toBe(
      "page",
    );
    expect(nav?.querySelector('a[href="/about/ai-comments"]')).not.toBeNull();
    expect(nav?.querySelector('a[href="/about/changes"]')).toBeNull();
  });

  it("keeps the sample graph balanced across left, bridge, and right paper columns", () => {
    const layout = buildAiScienceSampleLayout();
    const byLabel = new Map(layout.papers.map((paper) => [paper.label, paper] as const));

    expect(byLabel.get("P1")?.x).toBe(250);
    expect(byLabel.get("P2")?.x).toBe(250);
    expect(byLabel.get("P5")?.x).toBe(560);
    expect(byLabel.get("P6")?.x).toBe(560);
    expect(byLabel.get("P3")?.x).toBe(870);
    expect(byLabel.get("P4")?.x).toBe(870);
    expect(byLabel.get("P1")?.y).toBe(byLabel.get("P3")?.y);
    expect(byLabel.get("P2")?.y).toBe(byLabel.get("P4")?.y);
    expect(byLabel.get("P2")?.y).toBe(byLabel.get("P6")?.y);
  });

  it("renders the common footer on the graph sample page", () => {
    const container = pageHarness.renderPage();

    assertCommonFooter(container, "commitment-graph-sample-page-footer");
  });
});
