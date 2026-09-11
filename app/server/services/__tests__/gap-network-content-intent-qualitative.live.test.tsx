import { describe, expect, it } from "vitest";
import type {
  GapHypothesis,
  GapNetworkCluster,
  GapNetworkReport,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import {
  judgeIntentQuestions,
  type IntentQuestion,
} from "@/app/server/ai-generation/intent-qualitative-judge";
import { buildE2SummaryMarkdown } from "@/app/server/services/gap-network-builder";
import { interpretClusterNarratives } from "@/app/server/services/knowledge-map/interpret-cluster-narrative";
import { interpretGapNetworkDomain } from "@/app/server/services/knowledge-map/interpret-gap-network-domain";
import { interpretGapNetworkContentNarrative } from "@/app/server/services/knowledge-map/interpret-gap-network-content-narrative";

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

const baseClusters: GapNetworkCluster[] = [
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

const intentQuestions: IntentQuestion[] = [
  {
    id: "domain-framing",
    severity: "critical",
    question:
      "본문 도입부와 타이틀이 분석된 학문 분야를 명시하고, 클러스터들이 그 분야 안에서 어떤 위상에 놓여 있는지 전체 조망(관계·비교)을 제공하는가?",
    answerCriteria:
      "타이틀이 원본 query를 그대로 echo하지 않고 분석된 학문 분야명(예: '자율 LLM 에이전트와 메모리/검색 보강')을 노출해야 하고, 본문 도입 단락이 클러스터들의 관계·위상을 그 분야 맥락에서 비교해 한 번에 이해 가능해야 함. 단순 메트릭 dump(군집 수/논문 수만 나열)나 키워드 합성에 그치면 미달성.",
  },
  {
    id: "cluster-differentiation",
    severity: "critical",
    question: "본문이 각 클러스터의 생성 배경과 클러스터간 차이를 비교 가능한 형태로 서술하는가?",
    answerCriteria:
      "각 클러스터에 대해 (a) 그 묶음이 어떤 연구 결을 묶고 있는지의 배경 + (b) 다른 클러스터와의 차이를 비교 형태로 함께 서술해야 함. 'A는 …에 집중하지만 B는 …에 집중한다' 같은 명시적 대조 구문이 본문 어디에도 없거나, 라벨/논문 수의 단순 paraphrase에 그치면 미달성.",
  },
  {
    id: "gap-inference-transparency",
    severity: "critical",
    question:
      "본문이 공백을 어떤 방법으로 추론했는지(클러스터 크기 기반 기대 vs 실제 연결, 매개 개념, 인접성)를 사용자가 추적 가능한 형태로 노출하는가?",
    answerCriteria:
      "본문 한 단락이 (i) 클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다는 방법 + (ii) 매개 개념·인접성 같은 보조 신호 활용을 같이 서술해야 함. 가능하면 대표 공백 1~2개를 그 방법의 예시로 짚어야 함. 수치 dump만 있고 추론 경로 서술이 없거나, 결과 요약만 있고 방법 노출이 없으면 미달성.",
  },
];

describe("gap-network content markdown intent qualitative verification (live runtime LLM)", () => {
  it("buildE2SummaryMarkdown output answers all three content critical Intent Questions", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    const query = "autonomous LLM agents memory retrieval";
    const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));

    const narrativesByClusterId = await interpretClusterNarratives({
      query,
      clusters: baseClusters,
      papersById,
    });
    const enrichedClusters = baseClusters.map((cluster) => {
      const narrative = narrativesByClusterId.get(cluster.id);
      return narrative ? { ...cluster, narrative } : cluster;
    });

    const domainLabel = await interpretGapNetworkDomain({
      query,
      clusters: enrichedClusters,
    });
    if (domainLabel === null) {
      throw new Error("interpretGapNetworkDomain returned null for non-empty clusters");
    }
    expect(domainLabel.toLowerCase()).not.toBe(query.toLowerCase());

    const contentNarrative = await interpretGapNetworkContentNarrative({
      query,
      domainLabel,
      clusters: enrichedClusters,
      gapPairs,
    });
    expect(contentNarrative.overview.length).toBeGreaterThan(0);
    expect(contentNarrative.clusterParagraphs.length).toBe(enrichedClusters.length);
    expect(contentNarrative.gapInferenceParagraph.length).toBeGreaterThan(0);

    const report: GapNetworkReport = {
      clusters: enrichedClusters,
      conceptEdges: [],
      gapPairs,
      metrics: {
        clusterCount: enrichedClusters.length,
        totalPaperCount: papers.length,
        totalEdgeCount: 0,
        gapPairCount: gapPairs.length,
      },
      insight: { hypotheses },
    };

    const markdown = buildE2SummaryMarkdown({
      query,
      report,
      domainLabel,
      contentNarrative,
    });

    process.stdout.write(
      `\n===== CONTENT MARKDOWN =====\n${markdown}\n============================\n\n`,
    );

    expect(markdown.startsWith(`# `)).toBe(true);
    expect(markdown).toContain("## 분석된 분야");
    expect(markdown).toContain("## 클러스터 배경과 차이");
    expect(markdown).toContain("## 공백 추론 방법");

    const judgement = await judgeIntentQuestions({
      surfaceName: "gap-network document content markdown",
      renderedContent: markdown,
      questions: intentQuestions,
    });

    process.stdout.write(
      `\n===== JUDGE RESULT =====\n${JSON.stringify(judgement, null, 2)}\n========================\n\n`,
    );

    expect(judgement.unansweredCritical).toEqual([]);
    expect(judgement.verdict).toBe("met");
  }, 180_000);
});
