import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GapNetworkFocusedSelectionSummary,
  buildClusterReactionLookup,
  buildFocusedSelectionSummary,
} from "@/app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary";
import type {
  GapNetworkCluster,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import {
  judgeIntentQuestions,
  type IntentQuestion,
} from "@/app/server/ai-generation/intent-qualitative-judge";
import { buildGapNetworkReactionPreparation } from "@/app/server/services/gap-network-reaction-preparation";
import { interpretClusterNarratives } from "@/app/server/services/knowledge-map/interpret-cluster-narrative";

const papers: GraphPaperSnapshot[] = [
  {
    paperId: "p1",
    title: "Toolformer: language models can teach themselves to use tools",
    abstract:
      "We introduce Toolformer, a model trained to decide which APIs to call, when to call them, what arguments to pass, and how to best incorporate results into future token prediction.",
    year: 2023,
    citationCount: 820,
    url: "https://example.com/p1",
    authors: [{ name: "Schick" }],
  },
  {
    paperId: "p2",
    title: "ReAct: synergizing reasoning and acting in language models",
    abstract:
      "We explore a paradigm where LLMs generate both reasoning traces and task-specific actions in an interleaved manner, enabling synergy between deliberate reasoning and environment interaction.",
    year: 2023,
    citationCount: 1900,
    url: "https://example.com/p2",
    authors: [{ name: "Yao" }],
  },
  {
    paperId: "p3",
    title: "Voyager: an open-ended embodied agent with large language models",
    abstract:
      "Voyager continuously explores the world, acquires diverse skills, and makes novel discoveries in Minecraft using an LLM-powered lifelong learning agent.",
    year: 2023,
    citationCount: 650,
    url: "https://example.com/p3",
    authors: [{ name: "Wang" }],
  },
  {
    paperId: "p4",
    title: "MemGPT: towards LLMs as operating systems",
    abstract:
      "MemGPT manages memory tiers so LLMs can handle contexts that far exceed their native window, enabling long-running conversations and analyses.",
    year: 2023,
    citationCount: 400,
    url: "https://example.com/p4",
    authors: [{ name: "Packer" }],
  },
  {
    paperId: "p5",
    title: "Retrieval-augmented generation for large language models: a survey",
    abstract:
      "We survey retrieval-augmented generation techniques, covering retriever design, fusion strategies, and evaluation across knowledge-intensive tasks.",
    year: 2024,
    citationCount: 210,
    url: "https://example.com/p5",
    authors: [{ name: "Gao" }],
  },
];

const clusters: GapNetworkCluster[] = [
  {
    id: "cluster-agents",
    label: "Autonomous LLM Agents",
    color: "oklch(0.641 0.131 251.4)",
    paperCount: 3,
    concepts: [
      { id: "c-0", label: "Tool Use", clusterId: "cluster-agents", score: 8 },
      { id: "c-1", label: "Reasoning Traces", clusterId: "cluster-agents", score: 7 },
      { id: "c-2", label: "Embodied Agents", clusterId: "cluster-agents", score: 6 },
    ],
    topPaperIds: ["p2", "p1", "p3"],
  },
  {
    id: "cluster-retrieval",
    label: "Memory & Retrieval-Augmented LLMs",
    color: "oklch(0.685 0.16 44.7)",
    paperCount: 2,
    concepts: [
      { id: "c-3", label: "Long Context", clusterId: "cluster-retrieval", score: 8 },
      { id: "c-4", label: "RAG Survey", clusterId: "cluster-retrieval", score: 7 },
    ],
    topPaperIds: ["p5", "p4"],
  },
];

const gapPairs: GapPair[] = [
  {
    id: "gap-agents-retrieval",
    leftClusterId: "cluster-agents",
    rightClusterId: "cluster-retrieval",
    leftLabel: "Autonomous LLM Agents",
    rightLabel: "Memory & Retrieval-Augmented LLMs",
    displayLabel: "Autonomous LLM Agents-Memory & Retrieval-Augmented LLMs Gap",
    observed: 0,
    expected: 3,
    gapScore: 1,
    rank: 1,
    bridgeConcepts: ["memory-grounded planning"],
    leftConcepts: ["Tool Use"],
    rightConcepts: ["Long Context"],
  },
];

const report = {
  clusters,
  conceptEdges: [{ source: "c-0", target: "c-1", clusterId: "cluster-agents", weight: 0.92 }],
  gapPairs,
  metrics: {
    clusterCount: 2,
    totalPaperCount: 5,
    totalEdgeCount: 0,
    gapPairCount: 1,
  },
  insight: { hypotheses: [] },
};

const intentQuestions: IntentQuestion[] = [
  {
    id: "subject",
    severity: "critical",
    question: "이 군집이 실제로 어떤 연구 작업을 수행하는지 카드 내용에서 드러나는가?",
    answerCriteria:
      "라벨·키워드 나열이 아닌, 접근 방식이나 연구 주제의 구체적인 서술(narrative)이 있어야 함.",
  },
  {
    id: "exemplar",
    severity: "critical",
    question: "이 군집의 결을 감지할 수 있는 구체적인 대표 논문이 제목 수준으로 제공되는가?",
    answerCriteria:
      "렌더 내용에 실제 논문 제목이 2편 이상 포함되어 있어 독자가 실제 작업의 예시를 확인할 수 있어야 함.",
  },
  {
    id: "grounded-explanation",
    severity: "critical",
    question: "카드 설명이 군집의 실제 개념과 대표 논문을 근거로 더 풍부하게 설명되는가?",
    answerCriteria:
      "렌더 내용에 핵심 개념이나 대표 논문 제목 같은 실제 시스템 근거가 포함되어, narrative가 라벨 반복을 넘어 구체적 설명으로 보강되어야 함.",
  },
];

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("cluster card intent qualitative verification (live runtime DOM)", () => {
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

  it("focused cluster detail DOM answers all critical Intent Questions with LLM-generated narrative and representative titles", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    // Real runtime produces the cluster narrative via Gemini.
    const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));
    const narrativesByClusterId = await interpretClusterNarratives({
      query: "autonomous LLM agents memory retrieval",
      clusters,
      papersById,
    });
    expect(narrativesByClusterId.size).toBe(2);

    const enrichedClusters = clusters.map((cluster) => {
      const narrative = narrativesByClusterId.get(cluster.id);
      return narrative ? { ...cluster, narrative } : cluster;
    });

    // Real runtime assembles the reaction preparation (same path used by
    // gap report generation).
    const preparation = buildGapNetworkReactionPreparation({
      query: "autonomous LLM agents memory retrieval",
      report: { ...report, clusters: enrichedClusters },
      papers,
      preparedAt: "2026-04-22T00:00:00.000Z",
    });

    // Real runtime component data assembly.
    const focusedCluster = enrichedClusters[0];
    const summary = buildFocusedSelectionSummary({
      clusterReactionById: buildClusterReactionLookup(preparation.clusterReactions),
      focusedCluster,
      focusedGapPair: null,
      gapReactionById: new Map(),
      hypothesisByGapPairId: new Map(),
    });
    if (!summary) throw new Error("buildFocusedSelectionSummary returned null for focused cluster");

    // Actual React DOM render — this is what the user sees in the overlay.
    // No manual `[kicker] ... [meta] ...` string assembly; judge target is the
    // real component's textContent (docs/principles.md §0 핵심 철학).
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<GapNetworkFocusedSelectionSummary summary={summary} />);
    });

    const rendered = container.textContent.trim();
    process.stdout.write(
      `\n===== RUNTIME DOM OUTPUT =====\n${rendered}\n==============================\n\n`,
    );

    expect(rendered.length).toBeGreaterThan(0);

    const judgement = await judgeIntentQuestions({
      surfaceName: "gap-network focused cluster overlay (runtime component DOM)",
      renderedContent: rendered,
      questions: intentQuestions,
    });

    process.stdout.write(
      `\n===== JUDGE RESULT =====\n${JSON.stringify(judgement, null, 2)}\n========================\n\n`,
    );

    expect(judgement.unansweredCritical).toEqual([]);
    expect(judgement.verdict).toBe("met");
  }, 120_000);
});
