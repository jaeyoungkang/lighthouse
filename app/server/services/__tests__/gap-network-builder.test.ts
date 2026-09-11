import { describe, expect, it, vi } from "vitest";
import {
  buildE2SummaryMarkdown,
  buildGapNetworkCoreViewPayload,
  buildGapNetworkViewPayload,
} from "../gap-network-builder";
import type { PaperCore } from "@/app/domain/paper";
import type { GapNarrativeMap } from "@/app/server/services/knowledge-map/interpret-gap-narrative";
import type { GapNetworkReport, SearchMetadata } from "@/app/domain/research-route-payload";

const fakePapers: PaperCore[] = [
  {
    paperId: "p1",
    title: "Memory-augmented agents for task planning",
    abstract: "We propose a memory-augmented agent.",
    year: 2024,
    citationCount: 50,
    url: "https://example.com/p1",
    authors: [{ name: "Author A" }],
  },
  {
    paperId: "p2",
    title: "Tool-use in large language models",
    abstract: "This paper surveys tool-use.",
    year: 2024,
    citationCount: 30,
    url: "https://example.com/p2",
    authors: [{ name: "Author B" }],
  },
  {
    paperId: "p3",
    title: "Retrieval-augmented generation for QA",
    abstract: "We study RAG approaches.",
    year: 2023,
    citationCount: 80,
    url: "https://example.com/p3",
    authors: [{ name: "Author C" }],
  },
];

function makeFakeBaseData() {
  return {
    papers: fakePapers.map((p, i) => ({ ...p, clusterId: i < 2 ? 0 : 1, topics: [] })),
    base: {
      citationEdges: [{ source: "p1", target: "p3", direction: "reference" as const }],
      semanticEdges: [] as never[],
      clusterLabels: { "0": "Memory Systems", "1": "Tool Use" },
    },
    clusters: [
      { id: 0, label: "Memory Systems", paperIds: ["p1", "p3"] },
      { id: 1, label: "Tool Use", paperIds: ["p2"] },
    ],
  };
}

const fakeInsight = {
  hypotheses: [
    {
      id: "h1",
      title: "Memory-enhanced tool use",
      description: "Combining memory systems with tool-use could improve task planning.",
      clusterPairId: "0-1",
    },
  ],
};

const fakeContentNarrative = {
  overview: "Memory Systems와 Tool Use 묶음이 분야 안에서 보완 관계를 이루며 분포한다.",
  clusterParagraphs: [] as Array<{ clusterId: string; paragraph: string }>,
  gapInferenceParagraph:
    "클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다.",
};

function makeBuilderDeps() {
  return {
    buildKnowledgeMapBaseData: vi.fn().mockResolvedValue(makeFakeBaseData()),
    enrichNetwork: vi
      .fn()
      .mockResolvedValue([
        { source: "p1", target: "p2", weight: 0.7, origin: "semantic" as const },
      ]),
    interpretGapNetwork: vi.fn().mockResolvedValue(fakeInsight),
    interpretClusterNarrative: vi.fn().mockResolvedValue(new Map()),
    interpretGapNarrative: vi.fn().mockResolvedValue(new Map()),
    interpretDomain: vi.fn().mockResolvedValue("자율 LLM 에이전트와 메모리/검색 보강"),
    interpretContentNarrative: vi.fn().mockResolvedValue(fakeContentNarrative),
  };
}

function buildSparseAiForSciencePapers(): PaperCore[] {
  return [
    {
      label: "AI Scientists",
      prefix: "science-agent",
      title: "AI Scientists for Hypothesis Generation",
      abstract: "AI scientist systems generate hypotheses for scientific discovery.",
      count: 10,
    },
    {
      label: "Robotic Labs",
      prefix: "lab-robot",
      title: "Robotic Labs for Closed Loop Science",
      abstract: "Robotic laboratories automate experiments and measurements.",
      count: 10,
    },
    {
      label: "Scientific Benchmarks",
      prefix: "science-benchmark",
      title: "Scientific Benchmarks for AI Evaluation",
      abstract: "Benchmarks evaluate AI systems for scientific reasoning.",
      count: 10,
    },
    {
      label: "Materials Discovery",
      prefix: "materials-discovery",
      title: "Materials Discovery with Multimodal Models",
      abstract: "Multimodal models support materials discovery and experiment planning.",
      count: 9,
    },
  ].flatMap((cluster) =>
    Array.from({ length: cluster.count }, (_, index) => {
      const ordinal = String(index + 1);
      return {
        paperId: `${cluster.prefix}-${ordinal}`,
        title: `${cluster.title} ${ordinal}`,
        abstract: cluster.abstract,
        year: 2025,
        citationCount: 20 - index,
        url: `https://example.com/${cluster.prefix}-${ordinal}`,
        authors: [{ name: `${cluster.label} Author ${ordinal}` }],
      };
    }),
  );
}

describe("buildGapNetworkCoreViewPayload", () => {
  it("builds a core gap ResearchRoutePayload without waiting for narrative interpreters", async () => {
    const deps = makeBuilderDeps();

    const result = await buildGapNetworkCoreViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    const metadata = result.metadata;
    expect(result.type).toBe("gap_network");
    expect(metadata.gapNetworkReport.metrics.clusterCount).toBeGreaterThan(0);
    expect(metadata.gapNetworkReport.insight.hypotheses).toEqual([]);
    expect(metadata.reactionPreparation).toBeDefined();
    expect(metadata.gapNetworkBuild).toMatchObject({
      core: "ready",
      enrichment: "pending",
    });
    expect(deps.interpretGapNetwork).not.toHaveBeenCalled();
    expect(deps.interpretClusterNarrative).not.toHaveBeenCalled();
    expect(deps.interpretGapNarrative).not.toHaveBeenCalled();
    expect(deps.interpretDomain).not.toHaveBeenCalled();
    expect(deps.interpretContentNarrative).not.toHaveBeenCalled();
    expect(deps.enrichNetwork).toHaveBeenCalledOnce();
  });

  it("preserves source graph support in core metadata", async () => {
    const graphSupport: NonNullable<SearchMetadata["graphSupport"]> = {
      version: 1,
      source: "episteme-paper-neighborhood" as const,
      basis: "loaded_result_sample" as const,
      status: "ready" as const,
      samplePaperIds: ["paper-1", "paper-2"],
      generatedAt: "2026-07-05T00:00:00.000Z",
      paperScores: {
        "paper-1": {
          defaultScore: 4,
          graphScore: 4,
          semanticScore: null,
          sharedCiters: 4,
          sharedRefs: null,
          seedCount: 1,
          sources: ["co_cited:seed-1"],
        },
      },
    };

    const result = await buildGapNetworkCoreViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        graphSupport,
        createdBy: "user",
      },
      makeBuilderDeps(),
    );

    expect(result.metadata).toMatchObject({
      type: "gap_network",
      sourceGraphSupport: graphSupport,
    });
  });

  it("keeps semantic-only sparse top-40 samples as visible gap reports", async () => {
    const papers = buildSparseAiForSciencePapers();

    const result = await buildGapNetworkCoreViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-ai-science-sparse",
        query: "ai for science",
        papers,
        createdBy: "user",
      },
      {
        ...makeBuilderDeps(),
        enrichNetwork: vi.fn().mockResolvedValue([
          {
            source: "science-agent-1",
            target: "science-agent-2",
            weight: 0.72,
            origin: "semantic",
          },
          { source: "lab-robot-1", target: "lab-robot-2", weight: 0.68, origin: "semantic" },
          {
            source: "science-benchmark-1",
            target: "science-benchmark-2",
            weight: 0.64,
            origin: "semantic",
          },
          {
            source: "materials-discovery-1",
            target: "materials-discovery-2",
            weight: 0.61,
            origin: "semantic",
          },
        ]),
        clusterNetwork: vi.fn().mockReturnValue({
          clusterLabels: {
            ...Object.fromEntries(
              papers
                .filter((paper) => paper.paperId.startsWith("science-agent"))
                .map((paper) => [paper.paperId, "AI Scientists"]),
            ),
            ...Object.fromEntries(
              papers
                .filter((paper) => paper.paperId.startsWith("lab-robot"))
                .map((paper) => [paper.paperId, "Robotic Labs"]),
            ),
            ...Object.fromEntries(
              papers
                .filter((paper) => paper.paperId.startsWith("science-benchmark"))
                .map((paper) => [paper.paperId, "Scientific Benchmarks"]),
            ),
            ...Object.fromEntries(
              papers
                .filter((paper) => paper.paperId.startsWith("materials-discovery"))
                .map((paper) => [paper.paperId, "Materials Discovery"]),
            ),
          },
          clusters: [
            {
              id: 0,
              label: "AI Scientists",
              paperIds: papers
                .filter((paper) => paper.paperId.startsWith("science-agent"))
                .map((paper) => paper.paperId),
            },
            {
              id: 1,
              label: "Robotic Labs",
              paperIds: papers
                .filter((paper) => paper.paperId.startsWith("lab-robot"))
                .map((paper) => paper.paperId),
            },
            {
              id: 2,
              label: "Scientific Benchmarks",
              paperIds: papers
                .filter((paper) => paper.paperId.startsWith("science-benchmark"))
                .map((paper) => paper.paperId),
            },
            {
              id: 3,
              label: "Materials Discovery",
              paperIds: papers
                .filter((paper) => paper.paperId.startsWith("materials-discovery"))
                .map((paper) => paper.paperId),
            },
          ],
        }),
      },
    );

    expect(result.metadata.gapNetworkReport.metrics.totalPaperCount).toBe(39);
    expect(result.metadata.gapNetworkReport.metrics.totalEdgeCount).toBe(4);
    expect(result.metadata.gapNetworkReport.metrics.gapPairCount).toBeGreaterThan(0);
    expect(result.metadata.gapNetworkReport.gapPairs[0]?.expected).toBeLessThan(1);
  });
});

describe("buildGapNetworkViewPayload", () => {
  it("produces a gap_network document with expected shape", async () => {
    const deps = makeBuilderDeps();

    const result = await buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    expect(result.type).toBe("gap_network");
    expect(result.viewerPrincipalId).toBe("ws-1");
    expect(result.refs).toContain("search-1");
    expect(result.metadata.type).toBe("gap_network");
  });

  it("includes gap network report and reaction preparation in metadata", async () => {
    const deps = makeBuilderDeps();

    const result = await buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    const meta = result.metadata as {
      gapNetworkReport: GapNetworkReport;
      reactionPreparation: unknown;
      gapNetworkBuild: unknown;
    };
    expect(meta.gapNetworkReport).toBeDefined();
    expect(meta.gapNetworkReport.insight).toBe(fakeInsight);
    expect(meta.reactionPreparation).toBeDefined();
    expect(meta.gapNetworkBuild).toMatchObject({
      core: "ready",
      enrichment: "ready",
    });
  });
});

describe("buildGapNetworkViewPayload enrichment scheduling", () => {
  it("starts gap narrative and report narrative enrichment in parallel", async () => {
    const deps = makeBuilderDeps();
    const events: string[] = [];
    let resolveGapNarrative: ((value: GapNarrativeMap) => void) | undefined;

    deps.interpretGapNarrative.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          events.push("gap-narrative:start");
          resolveGapNarrative = (value) => {
            events.push("gap-narrative:resolve");
            resolve(value);
          };
        }),
    );
    deps.interpretDomain.mockImplementationOnce(() => {
      events.push("domain:start");
      return "자율 LLM 에이전트와 메모리/검색 보강";
    });
    deps.interpretContentNarrative.mockImplementationOnce(() => {
      events.push("content-narrative:start");
      return fakeContentNarrative;
    });

    const resultPromise = buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    await vi.waitFor(() => {
      expect(events).toContain("gap-narrative:start");
      expect(events).toContain("domain:start");
      expect(events).toContain("content-narrative:start");
    });
    expect(events).not.toContain("gap-narrative:resolve");

    resolveGapNarrative?.(new Map());
    const result = await resultPromise;

    expect(result.metadata.gapNetworkReport.contentNarrative).toBe(fakeContentNarrative);
  });

  it("uses the derived domain label in the document title (E2 lens branch)", async () => {
    const deps = makeBuilderDeps();

    const result = await buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    expect(result.title).toContain("자율 LLM 에이전트와 메모리/검색 보강");
    expect(result.title).not.toContain("AI agents");
  });

  it("falls back to query in the title when domain derivation returns null", async () => {
    const deps = makeBuilderDeps();
    deps.interpretDomain.mockResolvedValueOnce(null);

    const result = await buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    expect(result.title).toContain("AI agents");
  });

  it("calls interpretGapNetwork with query and report", async () => {
    const deps = makeBuilderDeps();

    await buildGapNetworkViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-1",
        query: "AI agents",
        papers: fakePapers,
        createdBy: "user",
      },
      deps,
    );

    expect(deps.interpretGapNetwork).toHaveBeenCalledOnce();
    const callArg = deps.interpretGapNetwork.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined;
    expect(callArg?.["query"]).toBe("AI agents");
    expect(callArg?.["report"]).toBeDefined();
  });

  it("builds a visible gap report instead of a no-meaningful-gap report for an ai-for-science style sample", async () => {
    const deps = makeBuilderDeps();
    deps.interpretDomain.mockResolvedValueOnce("AI for Science");
    deps.interpretContentNarrative.mockResolvedValueOnce({
      ...fakeContentNarrative,
      overview: "AI scientists and robotic labs appear as adjacent but under-connected clusters.",
    });

    const papers: PaperCore[] = [
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

    const result = await buildGapNetworkCoreViewPayload(
      {
        viewerPrincipalId: "ws-1",
        sourceSnapshotId: "search-ai-science",
        query: "ai for science",
        papers,
        createdBy: "user",
      },
      {
        ...deps,
        enrichNetwork: vi.fn().mockResolvedValue([
          {
            source: "science-agent-1",
            target: "science-agent-2",
            weight: 0.72,
            origin: "semantic",
          },
          { source: "lab-robot-1", target: "lab-robot-2", weight: 0.68, origin: "semantic" },
        ]),
        clusterNetwork: vi.fn().mockReturnValue({
          clusterLabels: {
            "science-agent-1": "AI Scientists",
            "science-agent-2": "AI Scientists",
            "lab-robot-1": "Robotic Labs",
            "lab-robot-2": "Robotic Labs",
          },
          clusters: [
            { id: 0, label: "AI Scientists", paperIds: ["science-agent-1", "science-agent-2"] },
            { id: 1, label: "Robotic Labs", paperIds: ["lab-robot-1", "lab-robot-2"] },
          ],
        }),
      },
    );

    expect(result.metadata.gapNetworkReport.metrics.gapPairCount).toBeGreaterThan(0);
    expect(result.metadata.gapNetworkReport.gapPairs[0]?.displayLabel).toContain(
      "AI Scientists-Robotic Labs Gap",
    );
  });
});

describe("buildE2SummaryMarkdown", () => {
  const baseReport: GapNetworkReport = {
    clusters: [
      {
        id: "c0",
        label: "Memory Systems",
        color: "oklch(0.6 0.1 200)",
        paperCount: 2,
        concepts: [
          { id: "k0", label: "Long Context", clusterId: "c0", score: 8 },
          { id: "k1", label: "Memory Augmentation", clusterId: "c0", score: 6 },
        ],
        topPaperIds: ["p1", "p3"],
      },
      {
        id: "c1",
        label: "Tool Use",
        color: "oklch(0.6 0.1 60)",
        paperCount: 1,
        concepts: [{ id: "k2", label: "Function Calling", clusterId: "c1", score: 7 }],
        topPaperIds: ["p2"],
      },
    ],
    conceptEdges: [],
    gapPairs: [
      {
        id: "g0",
        leftClusterId: "c0",
        rightClusterId: "c1",
        leftLabel: "Memory Systems",
        rightLabel: "Tool Use",
        displayLabel: "Memory Systems-Tool Use Gap",
        observed: 0,
        expected: 2,
        gapScore: 1,
        rank: 1,
        bridgeConcepts: ["memory-grounded planning"],
        leftConcepts: ["Long Context"],
        rightConcepts: ["Function Calling"],
      },
    ],
    metrics: {
      clusterCount: 2,
      totalPaperCount: 3,
      totalEdgeCount: 1,
      gapPairCount: 1,
    },
    insight: { hypotheses: [] },
  };

  it("composes domain framing / cluster differentiation / gap inference sections in the body", () => {
    const contentNarrative = {
      overview:
        "Memory Systems와 Tool Use 묶음이 분야 안에서 보완 관계를 이루며 서로 다른 결을 본다.",
      clusterParagraphs: [
        {
          clusterId: "c0",
          paragraph:
            "Memory Systems는 장기 문맥 기억과 외부 지식 갱신에 집중하며, Tool Use 묶음과 달리 작업 수행보다 정보 보존 결을 본다.",
        },
        {
          clusterId: "c1",
          paragraph:
            "Tool Use는 도구 호출과 함수 실행 자체에 집중하며, Memory Systems와 달리 장기 문맥보다 단일 행동 결정 결을 본다.",
        },
      ],
      gapInferenceParagraph:
        "클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다. 매개 개념(memory-grounded planning)과 인접 클러스터 신호도 활용한다. 예: Memory Systems-Tool Use Gap이 두 묶음 사이의 매개 개념으로 식별된 공백.",
    };

    const markdown = buildE2SummaryMarkdown({
      query: "AI agents memory tool",
      report: baseReport,
      domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
      contentNarrative,
    });

    expect(markdown.startsWith("# ")).toBe(true);
    expect(markdown).toContain("자율 LLM 에이전트와 메모리/검색 보강");
    expect(markdown).toContain("## 분석된 분야");
    expect(markdown).toContain("## 클러스터 배경과 차이");
    expect(markdown).toContain("## 공백 추론 방법");
    expect(markdown).toContain("Memory Systems");
    expect(markdown).toContain("Tool Use");
    expect(markdown).toContain("매개 개념");
  });

  it("falls back to deterministic phrasing when contentNarrative pieces are empty", () => {
    const contentNarrative = {
      overview: "",
      clusterParagraphs: [] as Array<{ clusterId: string; paragraph: string }>,
      gapInferenceParagraph: "",
    };

    const markdown = buildE2SummaryMarkdown({
      query: "AI agents",
      report: baseReport,
      domainLabel: null,
      contentNarrative,
    });

    expect(markdown).toContain("## 분석된 분야");
    expect(markdown).toContain("## 클러스터 배경과 차이");
    expect(markdown).toContain("## 공백 추론 방법");
    expect(markdown.length).toBeGreaterThan(0);
  });
});
