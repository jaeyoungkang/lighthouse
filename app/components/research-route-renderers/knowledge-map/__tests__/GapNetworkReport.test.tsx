import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GapNetworkReport } from "@/app/components/research-route-renderers/knowledge-map/GapNetworkReport";
import {
  gapNetworkClusterReactionsFixture,
  gapNetworkGapReactionsFixture,
  gapNetworkReportFixture,
  reactActEnvironment,
} from "./gap-network-report.fixtures";

async function settleGapNetworkViewBoxTransition() {
  await vi.advanceTimersByTimeAsync(260);
}

function parseSvgViewBox(value: string | null | undefined) {
  const parts = (value ?? "").split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`invalid viewBox: ${value ?? "null"}`);
  }
  return {
    x: parts[0] ?? 0,
    y: parts[1] ?? 0,
    width: parts[2] ?? 0,
    height: parts[3] ?? 0,
  };
}

const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

const report = gapNetworkReportFixture;
const clusterReactions = gapNetworkClusterReactionsFixture;
const gapReactions = gapNetworkGapReactionsFixture;

describe("GapNetworkReport", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    vi.useRealTimers();
  });

  it("renders the graph without a prose header (no lens chip, gap question, query intro, or calculation explanation)", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          gapReactions={gapReactions}
        />,
      );
    });

    // Domain naming and gap-inference explanation live elsewhere now —
    // page header (promise:gap-report-prepared-reaction AC4) and report body (promise:gap-report-prepared-reaction AC3)
    // — so the graph itself must not duplicate them.
    expect(container.textContent).not.toContain("연구 공백 리포트");
    expect(container.textContent).not.toContain("어떤 분야 사이에 아직 비어 있는 연결");
    expect(container.textContent).not.toContain("공백은 어떻게 계산되나?");
    expect(container.textContent).not.toContain("논문 수 비중으로 기대 교차 연결 수를 먼저 추정");
    expect(container.textContent).not.toContain(
      "기대보다 실제 연결이 부족한 관계만 주황 점선으로 남는다",
    );
    expect(container.querySelector("header")).toBeNull();
    expect(container.querySelector('[aria-label="gap network build explanation"]')).toBeNull();
    expect(container.textContent).not.toContain("1. 논문 군집화");
    expect(container.textContent).not.toContain("2. 대표 개념 추출");
    expect(container.textContent).not.toContain("3. 공백 계산");
    expect(container.textContent).not.toContain("Gap Network");
    expect(container.textContent).not.toContain("대표 클러스터");
    expect(container.textContent).not.toContain("Top Gaps");
    expect(container.textContent).not.toContain("읽는 법");
    expect(container.textContent).not.toContain("연구자 시사점");
    expect(container.textContent).not.toContain("Hypothesis Ideas");
    expect(container.textContent).not.toContain(
      "Workflow Memory ↔ Task Planning: Cross-Domain Bridge",
    );
    expect(container.textContent).not.toContain("군집 3");
    expect(container.textContent).not.toContain("concept 9");
    expect(container.textContent).not.toContain("gap 2");
    expect(container.textContent).not.toContain("구조 연결 7");
    expect(container.textContent).not.toContain("Guide / Controls");
    expect(container.textContent).not.toContain("Save as Markdown");
    expect(container.textContent).not.toContain("전체 보기");
    expect(container.textContent).not.toContain("선택한 클러스터");
    expect(container.textContent).not.toContain("선택한 공백");
    expect(container.querySelector('[data-gap-pair-id="gap-0-1"]')).not.toBeNull();
    expect(container.querySelector('[data-gap-flow="true"]')).toBeNull();
    expect(container.querySelector('[data-gap-interface-effects="enabled"]')).not.toBeNull();
    expect(container.querySelector('[data-concept-hub="true"]')).not.toBeNull();
    expect(
      Number(container.querySelector('[data-concept-id="workflow memory"]')?.getAttribute("r")),
    ).toBeGreaterThan(
      Number(
        container.querySelector('[data-concept-id="evaluation-retrieval"]')?.getAttribute("r"),
      ),
    );
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("h-[58vh]");
    expect(container.querySelector("svg")?.getAttribute("preserveAspectRatio")).toBe(
      "xMidYMid meet",
    );
    expect(container.querySelector("svg")?.parentElement?.className).toBe(
      "relative overflow-hidden",
    );

    act(() => {
      root.unmount();
    });
  });

  it("shows the focused cluster explanation in the side panel (outside the SVG) so the graph stays fully visible", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
        />,
      );
    });

    expect(container.querySelector('[data-testid="focused-selection-summary"]')).toBeNull();
    // No side panel before any selection.
    expect(container.querySelector('[data-testid="gap-network-side-panel"]')).toBeNull();

    const svg = container.querySelector("svg");
    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    expect(firstCluster).not.toBeNull();
    expect(svg).not.toBeNull();

    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    const sidePanel = container.querySelector('[data-testid="gap-network-side-panel"]');
    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    expect(sidePanel).not.toBeNull();
    expect(summary).not.toBeNull();
    // Card is outside the SVG — graph and all clusters/labels remain visible.
    expect(svg?.contains(summary as Node)).toBe(false);
    expect(sidePanel?.contains(summary as Node)).toBe(true);
    expect(container.querySelector('[data-testid="gap-network-selection-details"]')).toBeNull();
    expect(summary?.getAttribute("data-selection-kind")).toBe("cluster");
    expect(summary?.querySelector("h3")).toBeNull();
    expect(summary?.textContent).toContain("선택한 클러스터");
    expect(summary?.textContent).toContain("Memory");
    expect(summary?.textContent).toContain("논문 3편");
    expect(summary?.querySelector('[data-overlay-slot="adjacency"]')).toBeNull();
    expect(summary?.querySelector('[data-overlay-slot="keyword-relations"]')).toBeNull();
    expect(summary?.querySelector('[data-overlay-slot="cluster-evidence"]')).toBeNull();
    expect(summary?.textContent).not.toContain("근거:");
    expect(summary?.textContent).toContain("Workflow Memory, Retrieval, Context Memory");
    expect(summary?.textContent).toContain("Workflow memory for agents");
    const papersSlot = summary?.querySelector('[data-overlay-slot="representative-papers"]');
    expect(papersSlot).not.toBeNull();
    expect(papersSlot?.textContent).toContain("대표 논문");
    expect(papersSlot?.textContent).toContain("Workflow memory for agents");
    expect(papersSlot?.textContent).toContain("Retrieval-augmented planning");
    expect(papersSlot?.textContent).not.toContain("Context memory in long-horizon tasks");
    expect(papersSlot?.textContent).toContain(" · ");
    expect(summary?.textContent).toContain(
      "Memory 클러스터는 에이전트가 장기 작업에서 이전 실행 기록과 검색 맥락을 보존하는 연구를 묶는다.",
    );
    expect(summary?.textContent).not.toContain("Memory는 논문 3편이 모인 군집이다");
    expect(summary?.tagName.toLowerCase()).toBe("section");

    act(() => {
      svg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    expect(container.querySelector('[data-testid="focused-selection-summary"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-side-panel"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("opens a focused gap card in the side panel and auto-zooms the SVG", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          gapReactions={gapReactions}
        />,
      );
    });

    const svg = container.querySelector("svg");
    const initialViewBox = svg?.getAttribute("viewBox");
    const initialBounds = parseSvgViewBox(initialViewBox);
    const firstGap = container.querySelector('[data-gap-pair-id="gap-0-1"]');
    expect(svg).not.toBeNull();
    expect(firstGap).not.toBeNull();
    expect(firstGap?.getAttribute("data-gap-interface-effects")).toBe("enabled");

    act(() => {
      firstGap?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    const sidePanel = container.querySelector('[data-testid="gap-network-side-panel"]');
    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    expect(sidePanel?.contains(summary as Node)).toBe(true);
    expect(svg?.contains(summary as Node)).toBe(false);
    expect(summary?.getAttribute("data-selection-kind")).toBe("gap");
    expect(summary?.textContent).toContain("Memory");
    expect(summary?.textContent).toContain("Planning");
    expect(firstGap?.getAttribute("data-gap-interface-effects")).toBe("active");
    // Auto-zoom: gap click should reduce viewBox bounds (no manual toggle).
    expect(svg?.getAttribute("viewBox")).not.toBe(initialViewBox);
    const focusedBounds = parseSvgViewBox(svg?.getAttribute("viewBox"));
    expect(focusedBounds.width).toBeLessThan(initialBounds.width * 0.9);

    // No manual zoom toggle exists in the card anymore.
    expect(container.querySelector('[data-testid="gap-network-focus-zoom-toggle"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("does not render deterministic click explanations while enrichment is pending", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
          selectionNarrativeStatus="pending"
          onUseSeedAsSearch={vi.fn()}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain("해석 보강 중");
    expect(summary?.textContent).toContain("클러스터 설명은 해석 보강이 끝나면 표시됩니다.");
    expect(summary?.textContent).not.toContain("Memory는 논문 3편이 모인 군집이다");
    expect(summary?.textContent).not.toContain("Workflow memory for agents");
    expect(container.querySelector('[data-testid="gap-network-seed-as-search"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});

describe("GapNetworkReport overlay body integrity", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    vi.useRealTimers();
  });

  it("renders the full prepared LLM narrative for focused cluster overlay without truncation", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    const bodyParagraph = summary?.querySelectorAll("p")[2];
    const preparedBody = clusterReactions[0]?.narrative ?? "";

    // Side-panel card renders the full prepared LLM narrative without truncation.
    expect(bodyParagraph?.textContent).toContain(preparedBody);
    expect(bodyParagraph?.textContent).toContain("Workflow Memory, Retrieval, Context Memory");
    expect(bodyParagraph?.textContent).toContain("Workflow memory for agents");
    const bodyClass = bodyParagraph?.className ?? "";
    expect(bodyClass).not.toMatch(/\btruncate\b/);
    expect(bodyClass).not.toMatch(/\bline-clamp-/);
    expect(bodyClass).not.toMatch(/\boverflow-hidden\b/);
    expect(bodyClass).not.toMatch(/\btext-ellipsis\b/);
    expect(bodyClass).not.toMatch(/\bwhitespace-nowrap\b/);

    const summaryClass = summary?.className ?? "";
    expect(summaryClass).not.toMatch(/\bmax-h-/);
    expect(summaryClass).not.toMatch(/\boverflow-hidden\b/);

    act(() => {
      root.unmount();
    });
  });

  it("keeps the gap-pair layer static and renders cluster details under the cluster label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });
    const gapPair = container.querySelector('[data-gap-pair-id="gap-0-1"]');
    expect(gapPair).not.toBeNull();
    expect(gapPair?.getAttribute("data-gap-interface-effects")).toBe("enabled");
    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });
    // Cluster details live in the side panel now; the gap-pair layer stays
    // unchanged in the SVG (still enabled, gap pair still visible).
    expect(container.querySelector('[data-testid="gap-network-selection-details"]')).toBeNull();
    const sidePanel = container.querySelector('[data-testid="gap-network-side-panel"]');
    expect(sidePanel).not.toBeNull();
    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    expect(summary).not.toBeNull();
    expect(sidePanel?.contains(summary as Node)).toBe(true);
    expect(summary?.querySelector('[data-overlay-slot="keyword-relations"]')).toBeNull();
    expect(summary?.querySelector('[data-overlay-slot="cluster-evidence"]')).toBeNull();
    expect(summary?.textContent).not.toContain("근거:");
    expect(summary?.querySelector('[data-overlay-slot="adjacency"]')).toBeNull();
    // Gap layer not disturbed by the cluster focus selection.
    expect(gapPair?.getAttribute("data-gap-interface-effects")).toBe("enabled");

    const summaryClass = summary?.className ?? "";
    expect(summaryClass).not.toMatch(/\bmax-h-|\boverflow-hidden\b/);
    act(() => {
      root.unmount();
    });
  });

  it("renders a 200-character body for focused cluster overlay without truncation", async () => {
    const longBody = "가".repeat(200);
    expect(longBody.length).toBe(200);
    const longClusterReactions = [
      {
        clusterId: "cluster-0",
        reaction: {
          id: "gap-network-cluster-cluster-0",
          title: "Memory 클러스터",
          body: longBody,
          chips: [],
          timestamp: "2026-04-11T00:00:00.000Z",
        },
        narrative: longBody,
      },
    ];
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={longClusterReactions}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    const bodyParagraph = summary?.querySelectorAll("p")[2];

    // Side-panel card renders the 200-char LLM narrative in full without truncation,
    // and the card is uses content-driven height by a fixed SVG foreignObject.
    expect(bodyParagraph?.textContent).toContain(longBody);
    expect(bodyParagraph?.textContent).toContain("Workflow Memory, Retrieval, Context Memory");
    const bodyClass = bodyParagraph?.className ?? "";
    expect(bodyClass).not.toMatch(/\btruncate\b/);
    expect(bodyClass).not.toMatch(/\bline-clamp-/);
    expect(bodyClass).not.toMatch(/\btext-ellipsis\b/);
    expect(bodyClass).not.toMatch(/\bwhitespace-nowrap\b/);

    const summaryClass = summary?.className ?? "";
    expect(summaryClass).not.toMatch(/\bmax-h-/);
    expect(summaryClass).not.toMatch(/\boverflow-hidden\b/);

    act(() => {
      root.unmount();
    });
  });
});

describe("GapNetworkReport interactions", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    vi.useRealTimers();
  });

  it("auto-zooms softly on cluster click — selected cluster emphasized but every cluster still visible", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const svg = container.querySelector("svg");
    const initialViewBox = svg?.getAttribute("viewBox");
    const initialBounds = parseSvgViewBox(initialViewBox);
    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');

    expect(svg).not.toBeNull();
    expect(initialViewBox).toBeTruthy();
    expect(firstCluster).not.toBeNull();

    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    // Auto-zoom lands a visible focus on the selected cluster. The cluster
    // path stays in the AC's soft zoom band (46-62% of base width), while the
    // gap path below can tighten further around two connected clusters.
    expect(svg?.getAttribute("viewBox")).not.toBe(initialViewBox);
    const focusedBounds = parseSvgViewBox(svg?.getAttribute("viewBox"));
    expect(focusedBounds.width).toBeLessThanOrEqual(initialBounds.width * 0.62);
    expect(focusedBounds.width).toBeGreaterThanOrEqual(initialBounds.width * 0.46);
    expect(focusedBounds.height).toBeLessThanOrEqual(initialBounds.height * 0.48);
    expect(focusedBounds.height).toBeGreaterThanOrEqual(initialBounds.height * 0.33);
    expect(container.querySelector('[data-testid="gap-network-focus-zoom-toggle"]')).toBeNull();
    const sidePanel = container.querySelector('[data-testid="gap-network-side-panel"]');
    expect(sidePanel).not.toBeNull();

    // Background click closes the selection and returns to base viewBox.
    act(() => {
      svg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });
    expect(svg?.getAttribute("viewBox")).toBe(initialViewBox);
    expect(container.querySelector('[data-testid="gap-network-side-panel"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("auto-zooms into a clicked gap pair (no manual toggle)", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const svg = container.querySelector("svg");
    const initialViewBox = svg?.getAttribute("viewBox");
    const initialBounds = parseSvgViewBox(initialViewBox);
    const firstGap = container.querySelector('[data-gap-pair-id="gap-0-1"]');

    expect(svg).not.toBeNull();
    expect(initialViewBox).toBeTruthy();
    expect(firstGap).not.toBeNull();

    act(() => {
      firstGap?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    expect(container.querySelector('[data-testid="gap-network-focus-zoom-toggle"]')).toBeNull();
    expect(svg?.getAttribute("viewBox")).not.toBe(initialViewBox);
    const focusedBounds = parseSvgViewBox(svg?.getAttribute("viewBox"));
    expect(focusedBounds.width).toBeLessThan(initialBounds.width * 0.9);
    const summary = container.querySelector('[data-testid="focused-selection-summary"]');
    const sidePanel = container.querySelector('[data-testid="gap-network-side-panel"]');
    expect(sidePanel?.contains(summary as Node)).toBe(true);
    expect(summary?.getAttribute("data-selection-kind")).toBe("gap");
    expect(firstGap?.getAttribute("data-gap-interface-effects")).toBe("active");

    act(() => {
      root.unmount();
    });
  });

  it("forwards cluster, gap, and background selections to the outer AI reaction callbacks", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onClusterSelect = vi.fn();
    const onGapSelect = vi.fn();
    const onBackgroundReset = vi.fn();

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          onClusterSelect={onClusterSelect}
          onGapSelect={onGapSelect}
          onBackgroundReset={onBackgroundReset}
        />,
      );
    });

    const svg = container.querySelector("svg");
    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    const firstGap = container.querySelector('[data-gap-pair-id="gap-0-1"]');

    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      firstGap?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      svg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClusterSelect).toHaveBeenCalledWith("cluster-0");
    expect(onGapSelect).toHaveBeenCalledWith("gap-0-1");
    expect(onBackgroundReset).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("marks gap links as enabled interaction targets", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const secondGap = container.querySelector('[data-gap-pair-id="gap-0-2"]');
    expect(secondGap).not.toBeNull();

    act(() => {
      secondGap?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(secondGap?.getAttribute("data-gap-interface-effects")).toBe("active");
    expect(container.textContent).not.toContain("Hypothesis Ideas");

    act(() => {
      root.unmount();
    });
  });

  it("keeps every concept seed label legible at base view regardless of cluster activation", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    // promise:gap-led-next-search AC seeds-are-identifiable —
    // concept labels stay visible at base view; the user can read every
    // seed without first activating a cluster.
    expect(svg?.textContent).toContain("Workflow Memory");
    expect(svg?.textContent).toContain("Task Planning");
    expect(svg?.textContent).toContain("Benchmark");

    // Activation only changes selection/connection highlighting; it does not
    // gate label visibility anymore.
    const firstConceptNode = container.querySelector('[data-concept-node="true"]');
    expect(firstConceptNode).not.toBeNull();
    act(() => {
      firstConceptNode?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(svg?.textContent).toContain("Workflow Memory");
    act(() => {
      firstConceptNode?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(svg?.textContent).toContain("Workflow Memory");

    act(() => {
      root.unmount();
    });
  });

  it("switches concept clicks from zoom triggers to local graph highlighting once zoomed", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const svg = container.querySelector("svg");
    const initialViewBox = svg?.getAttribute("viewBox");
    const workflowNode = container.querySelector('[data-concept-id="workflow memory"]');
    const retrievalNode = container.querySelector('[data-concept-id="memory-retrieval"]');
    const planningNode = container.querySelector('[data-concept-id="task planning"]');
    const connectedEdge = container.querySelector(
      '[data-concept-edge-id="workflow memory::memory-retrieval"]',
    );

    expect(svg).not.toBeNull();
    expect(initialViewBox).toBeTruthy();
    expect(workflowNode).not.toBeNull();
    expect(retrievalNode).not.toBeNull();
    expect(planningNode).not.toBeNull();
    expect(connectedEdge).not.toBeNull();

    // First concept click activates the owning cluster — auto-zoom narrows
    // the viewBox to emphasize that cluster while keeping every cluster on
    // screen.
    act(() => {
      workflowNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await settleGapNetworkViewBoxTransition();
    });

    expect(svg?.getAttribute("viewBox")).not.toBe(initialViewBox);
    expect(workflowNode?.getAttribute("data-concept-state")).toBe("idle");

    // Second click on the same concept selects it locally (highlighting only,
    // no further viewBox change beyond the cluster auto-zoom).
    act(() => {
      workflowNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(workflowNode?.getAttribute("data-concept-state")).toBe("selected");
    expect(retrievalNode?.getAttribute("data-concept-state")).toBe("connected");
    expect(planningNode?.getAttribute("data-concept-state")).toBe("dimmed");
    expect(connectedEdge?.getAttribute("data-concept-edge-state")).toBe("connected");

    act(() => {
      workflowNode?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(workflowNode?.getAttribute("data-concept-state")).toBe("idle");
    expect(retrievalNode?.getAttribute("data-concept-state")).toBe("idle");
    expect(planningNode?.getAttribute("data-concept-state")).toBe("dimmed");
    expect(connectedEdge?.getAttribute("data-concept-edge-state")).toBe("idle");

    act(() => {
      root.unmount();
    });
  });
});
