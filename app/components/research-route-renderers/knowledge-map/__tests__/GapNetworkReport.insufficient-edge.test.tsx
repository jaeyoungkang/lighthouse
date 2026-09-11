import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GapNetworkReport } from "@/app/components/research-route-renderers/knowledge-map/GapNetworkReport";
import {
  getCanvasMessage,
  isGapNetworkNoMeaningfulGapState,
} from "@/app/components/research-route-renderers/knowledge-map/gap-network.report-helpers";
import type {
  GapNetworkReport as GapNetworkReportData,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function makePaper(index: number, hasAbstract: boolean): GraphPaperSnapshot {
  const indexLabel = String(index);
  return {
    paperId: `paper-${indexLabel}`,
    title: `Paper ${indexLabel}`,
    abstract: hasAbstract ? `Abstract ${indexLabel}` : null,
    year: 2026,
    citationCount: 0,
    url: `https://example.test/paper-${indexLabel}`,
    authors: [],
  };
}

function makeReport(): GapNetworkReportData {
  return {
    clusters: [
      {
        id: "cluster-0",
        label: "Lung Cancer Screening",
        color: "oklch(0.641 0.131 251.4)",
        paperCount: 10,
        concepts: [
          { id: "ct-screening", label: "CT Screening", clusterId: "cluster-0", score: 5.1 },
        ],
      },
      {
        id: "cluster-1",
        label: "Zero Error Tolerance Model",
        color: "oklch(0.699 0.113 163.3)",
        paperCount: 10,
        concepts: [{ id: "safety", label: "Safety", clusterId: "cluster-1", score: 4.7 }],
      },
    ],
    conceptEdges: [],
    gapPairs: [],
    metrics: {
      clusterCount: 4,
      totalPaperCount: 40,
      totalEdgeCount: 0,
      gapPairCount: 0,
    },
    insight: {
      hypotheses: [],
    },
  };
}

describe("GapNetworkReport edge-insufficient state", () => {
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

  it("skips cluster visualization and explains missing paper evidence in quantities", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const papers = Array.from({ length: 40 }, (_, index) => makePaper(index, index < 10));

    act(() => {
      root?.render(
        <GapNetworkReport
          query="medical diagnosis automation"
          report={makeReport()}
          papers={papers}
        />,
      );
    });

    const fallback = container.querySelector('[data-testid="gap-network-insufficient-edge-state"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.textContent).toContain("연결 근거 부족");
    expect(fallback?.textContent).toContain("검색 결과 40편");
    expect(fallback?.textContent).toContain("관계 근거가 0건");
    expect(fallback?.textContent).toContain("초록이 있는 논문은 10편");
    expect(fallback?.textContent).toContain("같은 밀도로 비교했다고 보기 어렵습니다");
    expect(fallback?.textContent).toContain("시각화와 세부 리포트를 표시하지 않습니다");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector('[data-cluster-id="cluster-0"]')).toBeNull();
    expect(container.textContent).not.toContain("Lung Cancer Screening");
    expect(container.textContent).not.toContain("Zero Error Tolerance Model");
    expect(container.textContent).not.toContain("4개 클러스터");
  });

  it("suppresses the canvas message when no meaningful gap candidates exist", () => {
    const report = makeReport();
    report.metrics.totalEdgeCount = 1;

    const message = getCanvasMessage({
      hasRenderableNetwork: true,
      report,
      hasAnyMeaningfulExpectedGapPair: false,
    });

    expect(message).toBeNull();
    expect(
      isGapNetworkNoMeaningfulGapState({
        hasRenderableNetwork: true,
        report,
        hasAnyMeaningfulExpectedGapPair: false,
      }),
    ).toBe(true);
  });

  it("renders the no-meaningful-gap empty state instead of the network when no meaningful gap exists", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const report = makeReport();
    report.metrics.totalEdgeCount = 1;
    const papers = Array.from({ length: 40 }, (_, index) => makePaper(index, index < 10));

    act(() => {
      root?.render(
        <GapNetworkReport query="medical diagnosis automation" report={report} papers={papers} />,
      );
    });

    const emptyState = container.querySelector(
      '[data-testid="gap-network-no-meaningful-gap-state"]',
    );
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain("뚜렷한 공백 후보가 없습니다");
    expect(emptyState?.textContent).toContain("검색 결과 40편 전체");
    expect(emptyState?.textContent).toContain("관계 근거 1건");
    expect(emptyState?.textContent).toContain("기대 연결이 충분히 형성되지 않았습니다");
    expect(emptyState?.textContent).toContain("시각화와 세부 리포트를 표시하지 않습니다");
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).not.toContain("Lung Cancer Screening");
    expect(container.textContent).not.toContain("Zero Error Tolerance Model");
    expect(
      container.querySelector('[data-testid="gap-network-citation-lineage-breakdown"]'),
    ).toBeNull();
  });

  it("renders the graph-supported sparse sample as a gap report instead of the no-meaningful-gap state", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const papers: GraphPaperSnapshot[] = [
      {
        paperId: "science-agent-1",
        title: "AI Scientists for Hypothesis Generation",
        abstract: "AI scientist systems generate hypotheses for scientific discovery.",
        year: 2025,
        citationCount: 12,
        url: "https://example.com/science-agent-1",
        authors: [{ name: "A" }],
      },
      {
        paperId: "science-agent-2",
        title: "Autonomous Discovery Agents",
        abstract: "Discovery agents coordinate literature search and experiment planning.",
        year: 2025,
        citationCount: 10,
        url: "https://example.com/science-agent-2",
        authors: [{ name: "B" }],
      },
      {
        paperId: "lab-robot-1",
        title: "Robotic Labs for Closed Loop Science",
        abstract: "Robotic laboratories automate experiments and measurements.",
        year: 2024,
        citationCount: 14,
        url: "https://example.com/lab-robot-1",
        authors: [{ name: "C" }],
      },
      {
        paperId: "lab-robot-2",
        title: "Laboratory Automation for Materials Discovery",
        abstract: "Laboratory automation accelerates materials discovery workflows.",
        year: 2024,
        citationCount: 9,
        url: "https://example.com/lab-robot-2",
        authors: [{ name: "D" }],
      },
    ];
    const report: GapNetworkReportData = {
      clusters: [
        {
          id: "cluster-0",
          label: "AI Scientists",
          color: "oklch(0.641 0.131 251.4)",
          paperCount: 2,
          concepts: [
            {
              id: "ai-scientist",
              label: "AI Scientist",
              clusterId: "cluster-0",
              score: 4.2,
            },
          ],
        },
        {
          id: "cluster-1",
          label: "Robotic Labs",
          color: "oklch(0.699 0.113 163.3)",
          paperCount: 2,
          concepts: [
            {
              id: "robotic-lab",
              label: "Robotic Lab",
              clusterId: "cluster-1",
              score: 3.9,
            },
          ],
        },
      ],
      conceptEdges: [],
      gapPairs: [
        {
          id: "gap-cluster-0-cluster-1",
          leftClusterId: "cluster-0",
          rightClusterId: "cluster-1",
          leftLabel: "AI Scientists",
          rightLabel: "Robotic Labs",
          displayLabel: "AI Scientists ↔ Robotic Labs",
          observed: 0,
          expected: 0.5,
          gapScore: 0.5,
          rank: 1,
          bridgeConcepts: [],
          leftConcepts: ["AI Scientist"],
          rightConcepts: ["Robotic Lab"],
        },
      ],
      metrics: {
        clusterCount: 2,
        totalPaperCount: 4,
        totalEdgeCount: 1,
        gapPairCount: 1,
      },
      insight: { hypotheses: [] },
    };

    act(() => {
      root?.render(<GapNetworkReport query="ai for science" report={report} papers={papers} />);
    });

    expect(container.querySelector('[data-testid="gap-network-graph-and-panel"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="gap-network-no-meaningful-gap-state"]'),
    ).toBeNull();
    expect(container.textContent).toContain("검색 결과 4편을 2개 군집으로 나눴습니다");
    expect(container.textContent).toContain("AI Scientists ↔ Robotic Labs");
  });

  it("shows the citation-lineage references/citations breakdown line when the gap network comes from a citation-lineage source", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const report = makeReport();
    report.metrics.totalEdgeCount = 1;
    const papers = Array.from({ length: 40 }, (_, index) => makePaper(index, index < 10));

    act(() => {
      root?.render(
        <GapNetworkReport
          query="medical diagnosis automation"
          report={report}
          papers={papers}
          sourceCitationLineageBreakdown={{ references: 20, citations: 20 }}
        />,
      );
    });

    const breakdown = container.querySelector(
      '[data-testid="gap-network-citation-lineage-breakdown"]',
    );
    expect(breakdown).not.toBeNull();
    expect(breakdown?.textContent).toContain("선행 연구 20편");
    expect(breakdown?.textContent).toContain("후속 연구 20편");
  });

  it("also shows the breakdown line on the insufficient-edge state when source is citation-lineage", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const papers = Array.from({ length: 40 }, (_, index) => makePaper(index, index < 10));

    act(() => {
      root?.render(
        <GapNetworkReport
          query="medical diagnosis automation"
          report={makeReport()}
          papers={papers}
          sourceCitationLineageBreakdown={{ references: 18, citations: 22 }}
        />,
      );
    });

    const breakdown = container.querySelector(
      '[data-testid="gap-network-citation-lineage-breakdown"]',
    );
    expect(breakdown).not.toBeNull();
    expect(breakdown?.textContent).toContain("선행 연구 18편");
    expect(breakdown?.textContent).toContain("후속 연구 22편");
  });
});
