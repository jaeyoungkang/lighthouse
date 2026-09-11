import type {
  GapNetworkClusterReaction,
  GapNetworkGapReaction,
  GapNetworkReport as GapNetworkReportData,
} from "@/app/domain/research-route-payload";

export const gapNetworkReportFixture: GapNetworkReportData = {
  clusters: [
    {
      id: "cluster-0",
      label: "Memory",
      color: "oklch(0.641 0.131 251.4)",
      paperCount: 3,
      concepts: [
        {
          id: "workflow memory",
          label: "Workflow Memory",
          clusterId: "cluster-0",
          score: 5.1,
          supportingPaperIds: ["mem-1", "mem-2"],
        },
        { id: "memory-retrieval", label: "Retrieval", clusterId: "cluster-0", score: 4.7 },
        { id: "context memory", label: "Context Memory", clusterId: "cluster-0", score: 4.2 },
      ],
    },
    {
      id: "cluster-1",
      label: "Planning",
      color: "oklch(0.699 0.113 163.3)",
      paperCount: 3,
      concepts: [
        { id: "task planning", label: "Task Planning", clusterId: "cluster-1", score: 5.2 },
        { id: "decomposition", label: "Decomposition", clusterId: "cluster-1", score: 4.5 },
        { id: "planning-retrieval", label: "Retrieval", clusterId: "cluster-1", score: 4.1 },
      ],
    },
    {
      id: "cluster-2",
      label: "Evaluation",
      color: "oklch(0.685 0.16 44.7)",
      paperCount: 3,
      concepts: [
        { id: "benchmark", label: "Benchmark", clusterId: "cluster-2", score: 5.0 },
        { id: "verification", label: "Verification", clusterId: "cluster-2", score: 4.4 },
        { id: "evaluation-retrieval", label: "Retrieval", clusterId: "cluster-2", score: 4.0 },
      ],
    },
  ],
  conceptEdges: [
    { source: "workflow memory", target: "memory-retrieval", clusterId: "cluster-0", weight: 1 },
    { source: "task planning", target: "decomposition", clusterId: "cluster-1", weight: 0.84 },
    { source: "benchmark", target: "verification", clusterId: "cluster-2", weight: 0.79 },
  ],
  gapPairs: [
    {
      id: "gap-0-1",
      leftClusterId: "cluster-0",
      rightClusterId: "cluster-1",
      leftLabel: "Memory",
      rightLabel: "Planning",
      displayLabel: "Memory-Planning Gap",
      observed: 0,
      expected: 1.56,
      gapScore: 1,
      rank: 1,
      bridgeConcepts: ["retrieval"],
      leftConcepts: ["workflow memory", "retrieval", "context memory"],
      rightConcepts: ["task planning", "decomposition", "retrieval"],
    },
    {
      id: "gap-0-2",
      leftClusterId: "cluster-0",
      rightClusterId: "cluster-2",
      leftLabel: "Memory",
      rightLabel: "Evaluation",
      displayLabel: "Memory-Evaluation Gap",
      observed: 1,
      expected: 1.56,
      gapScore: 0.36,
      rank: 2,
      bridgeConcepts: ["retrieval"],
      leftConcepts: ["workflow memory", "retrieval", "context memory"],
      rightConcepts: ["benchmark", "verification", "retrieval"],
    },
  ],
  metrics: {
    clusterCount: 3,
    totalPaperCount: 9,
    totalEdgeCount: 7,
    gapPairCount: 2,
  },
  insight: {
    hypotheses: [
      {
        id: "hyp-1",
        gapPairId: "gap-0-1",
        title: "Workflow Memory ↔ Task Planning: Cross-Domain Bridge",
        description:
          "Memory와 planning은 관련성은 높지만 연결 논문은 드물다. retrieval을 매개로 결합하면 장기 실행형 연구 자동화의 안정성을 높일 수 있다.",
        sourceConcept: "workflow memory",
        targetConcept: "task planning",
        confidence: "medium" as const,
      },
      {
        id: "hyp-2",
        gapPairId: "gap-0-2",
        title: "Workflow Memory ↔ Benchmark: Cross-Domain Bridge",
        description:
          "Memory와 evaluation을 직접 연결하면 장기 실험 기록과 검증 루프를 하나의 연구 파이프라인으로 묶을 수 있다.",
        sourceConcept: "workflow memory",
        targetConcept: "benchmark",
        confidence: "medium" as const,
      },
    ],
  },
};

export const gapNetworkClusterReactionsFixture: GapNetworkClusterReaction[] = [
  {
    clusterId: "cluster-0",
    reaction: {
      id: "gap-network-cluster-cluster-0",
      title: "Memory 클러스터",
      body: "Memory는 논문 3편이 모인 군집이다. 핵심 개념은 Workflow Memory, Retrieval, Context Memory다.",
      chips: [],
      timestamp: "2026-04-11T00:00:00.000Z",
    },
    nearestGapLabel: "Memory-Planning Gap",
    representativePaperTitles: [
      "Workflow memory for agents",
      "Retrieval-augmented planning",
      "Context memory in long-horizon tasks",
    ],
    narrative:
      "Memory 클러스터는 에이전트가 장기 작업에서 이전 실행 기록과 검색 맥락을 보존하는 연구를 묶는다.",
  },
  {
    clusterId: "cluster-1",
    reaction: {
      id: "gap-network-cluster-cluster-1",
      title: "Planning 클러스터",
      body: "Planning은 논문 3편이 모인 군집이다. 핵심 개념은 Task Planning, Decomposition, Retrieval이다.",
      chips: [],
      timestamp: "2026-04-11T00:00:00.000Z",
    },
    nearestGapLabel: "Memory-Planning Gap",
    representativePaperTitles: ["Task planning survey", "Decomposition for LLM agents"],
    narrative:
      "Planning 클러스터는 목표를 하위 작업으로 나누고 실행 순서를 안정화하는 방법론에 집중한다.",
  },
];

export const gapNetworkGapReactionsFixture: GapNetworkGapReaction[] = [
  {
    gapPairId: "gap-0-1",
    reaction: {
      id: "gap-network-gap-gap-0-1",
      title: "Memory-Planning 가설",
      body: "Memory와 Planning을 잇는 장기 실행 계획 평가 설계가 비어 있다.",
      chips: [],
      timestamp: "2026-04-11T00:00:00.000Z",
    },
    metaQualitative:
      "Memory와 Planning은 검색 단서를 공유하지만 장기 실행 계획의 검증 흐름으로 직접 연결된 연구가 부족하다.",
    proposals: [
      {
        hypothesis:
          "Workflow Memory를 Task Planning 평가에 연결하면 장기 에이전트 실행 실패를 더 일관되게 추적할 수 있다.",
        grounding: "두 군집 모두 retrieval을 공유하지만 계획 평가 논문은 직접 연결이 적다.",
      },
    ],
  },
];

export const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
