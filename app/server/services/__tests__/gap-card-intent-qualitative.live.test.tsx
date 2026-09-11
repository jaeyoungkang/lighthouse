import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GapNetworkFocusedSelectionSummary,
  buildClusterReactionLookup,
  buildFocusedSelectionSummary,
  buildGapReactionLookup,
} from "@/app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary";
import type {
  GapHypothesis,
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
import { interpretGapNarratives } from "@/app/server/services/knowledge-map/interpret-gap-narrative";

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
    bridgeConcepts: ["memory-grounded planning", "long-horizon retrieval"],
    leftConcepts: ["Tool Use", "Reasoning Traces"],
    rightConcepts: ["Long Context", "RAG Survey"],
  },
];

const hypotheses: GapHypothesis[] = [
  {
    id: "h-1",
    gapPairId: "gap-agents-retrieval",
    title: "Memory-grounded autonomous planning",
    description:
      "장기 문맥 기억과 도구 사용 에이전트를 결합해 다단계 과제 동안 외부 지식을 갱신·재호출하며 자율적으로 추론·행동하는 접근",
    sourceConcept: "Tool Use",
    targetConcept: "Long Context",
    confidence: "medium",
  },
];

const report = {
  clusters,
  conceptEdges: [],
  gapPairs,
  metrics: {
    clusterCount: 2,
    totalPaperCount: 5,
    totalEdgeCount: 0,
    gapPairCount: 1,
  },
  insight: { hypotheses },
};

const intentQuestions: IntentQuestion[] = [
  {
    id: "hypothesis-substance",
    severity: "critical",
    question:
      "body proposals(1~3개)가 일반론·정량 진술·짧은 슬로건에 그치지 않고 구체적 연구 작업·접근의 결을 충분한 깊이로 잡는가?",
    answerCriteria:
      "각 proposal의 hypothesis 문장이 (a) 두 군집의 결을 잇는 구체적 연구 작업·접근(데이터·모델·방법)을 서술하고, (b) 그 작업이 만드는 능력·결과·문제 해결을 함께 드러내는 충분한 깊이(2~3문장 또는 80자 이상의 산문)여야 함. 한 문장 슬로건, 'X와 Y를 결합하자' 류 일반론, 'expected vs observed' 류 정량 진술, 짧은 진술(40자 미만)이면 미달성.",
  },
  {
    id: "evidence-grounding",
    severity: "critical",
    question:
      "각 proposal의 grounding이 실제 자원(군집 라벨/개념·매개 개념·대표 논문 제목 중 하나 이상)을 인용해 가설 도출 근거를 한 문장으로 닫는가?",
    answerCriteria:
      "각 grounding 문장이 입력에 주어진 cluster 라벨·concept·bridgeConcept·논문 제목 중 적어도 하나를 명시적으로 인용해 'hypothesis가 어떤 자원에서 도출됐는지'를 닫아야 함. 자원 인용 없이 '관련 분야 연구가 있다' 류 추상으로 그치면 미달성.",
  },
  {
    id: "qualitative-meta",
    severity: "critical",
    question:
      "meta가 수치 없이 두 cluster 라벨과 gap의 character를 함께 묘사하는 정성 한 줄이고, 영문으로 들어온 cluster 라벨·도메인 기법명·논문명을 영문 원형으로 보존하는가?",
    answerCriteria:
      "meta 라인이 두 cluster 라벨을 자연스럽게 포함한 한국어 한 줄이며 character 드러나야 함. 영문으로 들어온 cluster 라벨·도메인 기법명·논문명은 영문 원형 그대로 한국어 문장 안에 끼워 넣어야 함. 숫자(gap score / expected / observed)가 등장하거나, 'X ↔ Y'만 나열하고 character 묘사가 없거나, 영문 도메인 용어를 한국어로 강제 번역(예: 'Autonomous LLM Agents' → '자율 LLM 에이전트', 'Retrieval-Augmented Generation' → '검색 증강 생성')해 원형이 사라지면 미달성.",
  },
];

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("gap card intent qualitative verification (live runtime DOM)", () => {
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

  it("focused gap overlay DOM answers all gap critical Intent Questions with LLM-generated hypothesis narrative", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));
    const narrativesByClusterId = await interpretClusterNarratives({
      query: "autonomous LLM agents memory retrieval",
      clusters,
      papersById,
    });

    const enrichedClusters = clusters.map((cluster) => {
      const narrative = narrativesByClusterId.get(cluster.id);
      return narrative ? { ...cluster, narrative } : cluster;
    });

    const clustersById = new Map(enrichedClusters.map((cluster) => [cluster.id, cluster] as const));
    const hypothesisByGapPairId = new Map(
      hypotheses.map((hypothesis) => [hypothesis.gapPairId, hypothesis] as const),
    );
    const narrativesByGapPairId = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs,
      clustersById,
      papersById,
    });
    expect(narrativesByGapPairId.size).toBe(1);
    const payload = narrativesByGapPairId.get(gapPairs[0].id);
    expect(payload?.proposals.length).toBeGreaterThanOrEqual(1);
    expect(payload?.proposals.length).toBeLessThanOrEqual(3);

    const preparation = buildGapNetworkReactionPreparation({
      query: "autonomous LLM agents memory retrieval",
      report: { ...report, clusters: enrichedClusters },
      papers,
      gapNarratives: narrativesByGapPairId,
      preparedAt: "2026-04-30T00:00:00.000Z",
    });

    const focusedGapPair = gapPairs[0];
    const summary = buildFocusedSelectionSummary({
      clusterReactionById: buildClusterReactionLookup(preparation.clusterReactions),
      focusedCluster: null,
      focusedGapPair,
      gapReactionById: buildGapReactionLookup(preparation.gapReactions),
      hypothesisByGapPairId,
    });
    if (!summary) throw new Error("buildFocusedSelectionSummary returned null for focused gap");

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
      surfaceName: "gap-network focused gap overlay (runtime component DOM)",
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
