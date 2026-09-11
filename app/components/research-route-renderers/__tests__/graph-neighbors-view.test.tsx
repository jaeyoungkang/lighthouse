import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GraphNeighborsMetadata } from "@/app/domain/research-route-payload";
import { GraphNeighborsResultsState } from "@/app/components/research-route-renderers/graph-neighbors-view";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function buildMetadata(overrides: Partial<GraphNeighborsMetadata> = {}): GraphNeighborsMetadata {
  return {
    type: "graph_neighbors",
    seedPaper: {
      paperId: "seed-1",
      title: "Attention Is All You Need",
      abstract: "seed abstract",
      year: 2017,
      citationCount: 1000,
      url: "https://sah.borca.ai/papers/seed-1",
      authors: [{ name: "Vaswani" }],
      openAccessPdf: null,
      doi: null,
    },
    papers: [],
    total: 0,
    coCited: [],
    coupled: [],
    ...overrides,
  };
}

function renderView(props: {
  metadata: GraphNeighborsMetadata;
  onRetry?: () => void;
}): HTMLDivElement {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <GraphNeighborsResultsState
        ownerPrincipalId="principal-1"
        documentId="doc-1"
        metadata={props.metadata}
        analysisProgressMap={new Map()}
        analysisMap={new Map()}
        citationLineageLoadingPaperId={null}
        onOpenCitationLineage={vi.fn()}
        onOpenGraphNeighbors={vi.fn()}
        onFindSimilar={vi.fn()}
        onRetry={props.onRetry}
      />,
    );
  });
  return container;
}

describe("GraphNeighborsResultsState degraded UX", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("renders a degraded notice and a retry button when graphLoadFailed is true", () => {
    const onRetry = vi.fn();
    const container = renderView({
      metadata: buildMetadata({ graphLoadFailed: true }),
      onRetry,
    });

    // 비슷한 논문 ResearchRoutePayload가 어떤 논문 곁에서 열린 것인지 degraded 상태에서도 유지한다.
    expect(container.textContent).toContain("비슷한 논문");
    expect(container.textContent).toContain("Attention Is All You Need");
    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    expect(seedTitleCard?.className).toContain("sticky");
    expect(seedTitleCard?.className).toContain("top-0");
    expect(seedTitleCard?.className).toContain("border-b");
    expect(seedTitleCard?.className).not.toContain("lh-panel");
    expect(container.textContent).toContain(
      "이 논문과 인용·참고문헌 관계로 묶인 논문을 두 축으로 보여 준다.",
    );
    // degraded 안내가 보이고 정직한 빈 결과 메시지와 구분된다.
    expect(container.textContent).toContain(
      "지금 비슷한 논문을 불러오지 못했다. 잠시 후 다시 시도해보자.",
    );
    expect(container.textContent).not.toContain("이 논문과 비슷한 논문을 찾지 못했다.");

    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "다시 시도",
    );
    expect(retryButton).toBeDefined();

    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders the honest-empty message when both axes are empty and not failed", () => {
    const container = renderView({
      metadata: buildMetadata({ coCited: [], coupled: [] }),
    });

    // 빈 결과여도 출발 논문 title card가 사라지지 않는다.
    expect(container.textContent).toContain("비슷한 논문");
    expect(container.textContent).toContain("Attention Is All You Need");
    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    expect(seedTitleCard?.className).toContain("sticky");
    expect(seedTitleCard?.className).toContain("top-0");
    expect(seedTitleCard?.className).toContain("border-b");
    expect(seedTitleCard?.className).not.toContain("lh-panel");
    // 정직한 빈 결과 메시지는 그대로, degraded 안내·재시도는 없다.
    expect(container.textContent).toContain("이 논문과 비슷한 논문을 찾지 못했다.");
    expect(container.textContent).not.toContain(
      "지금 비슷한 논문을 불러오지 못했다. 잠시 후 다시 시도해보자.",
    );
    const retryButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "다시 시도",
    );
    expect(retryButton).toBeUndefined();
  });

  it("renders the two graph axes when neighbors are present", () => {
    const container = renderView({
      metadata: buildMetadata({
        coCited: [
          {
            shared: 49,
            paper: {
              paperId: "cc-1",
              title: "Graph Attention Networks",
              abstract: null,
              year: 2017,
              citationCount: 25000,
              url: "https://example.com/cc-1",
              authors: [{ name: "Velickovic" }],
              openAccessPdf: null,
              doi: null,
            },
          },
        ],
        coupled: [
          {
            shared: 80,
            paper: {
              paperId: "cp-1",
              title: "Deep Learning on Graphs: A Survey",
              abstract: null,
              year: 2020,
              citationCount: 1200,
              url: "https://example.com/cp-1",
              authors: [{ name: "Zhang" }],
              openAccessPdf: null,
              doi: null,
            },
          },
        ],
      }),
    });

    expect(container.textContent).toContain("함께 인용되는 논문 1편");
    expect(container.textContent).toContain("같은 토대를 공유하는 논문 1편");
    expect(container.textContent).toContain("Attention Is All You Need");
    expect(container.textContent).toContain("Graph Attention Networks");
    expect(container.textContent).toContain("Deep Learning on Graphs: A Survey");
    expect(container.querySelector('[data-paper-id="seed-1"]')).toBeNull();
    // degraded·정직한 빈 결과 메시지는 보이지 않는다.
    expect(container.textContent).not.toContain("이 논문과 비슷한 논문을 찾지 못했다.");
    expect(container.textContent).not.toContain(
      "지금 비슷한 논문을 불러오지 못했다. 잠시 후 다시 시도해보자.",
    );
  });
});
