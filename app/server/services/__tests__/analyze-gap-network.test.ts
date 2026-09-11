import { describe, expect, it } from "vitest";
import { analyzeGapNetwork } from "@/app/server/services/knowledge-map/analyze-gap-network";

const papers = [
  {
    paperId: "p1",
    title: "Tool-Using Agents for Research",
    abstract: "Agents coordinate tool use for research workflows.",
    year: 2024,
    citationCount: 40,
    url: "https://example.com/p1",
    authors: [{ name: "Author 1" }],
  },
  {
    paperId: "p2",
    title: "Agent Workflow Planning",
    abstract: "Planning helps research agents sequence tool calls.",
    year: 2024,
    citationCount: 32,
    url: "https://example.com/p2",
    authors: [{ name: "Author 2" }],
  },
  {
    paperId: "p3",
    title: "Agent Benchmarks for Tool Use",
    abstract: "Benchmarks evaluate tool-using research agents.",
    year: 2025,
    citationCount: 28,
    url: "https://example.com/p3",
    authors: [{ name: "Author 3" }],
  },
  {
    paperId: "p4",
    title: "Long-Context Memory for Agents",
    abstract: "Memory architectures preserve research context across tasks.",
    year: 2024,
    citationCount: 36,
    url: "https://example.com/p4",
    authors: [{ name: "Author 4" }],
  },
  {
    paperId: "p5",
    title: "Retrieval Memory Pipelines",
    abstract: "Retrieval memory improves persistent context for long workflows.",
    year: 2025,
    citationCount: 30,
    url: "https://example.com/p5",
    authors: [{ name: "Author 5" }],
  },
  {
    paperId: "p6",
    title: "Context Stores for Multi-Step Research",
    abstract: "Persistent context stores stabilize multi-step research loops.",
    year: 2025,
    citationCount: 18,
    url: "https://example.com/p6",
    authors: [{ name: "Author 6" }],
  },
  {
    paperId: "p7",
    title: "Plan Repair for Research Agents",
    abstract: "Plan repair helps automated research recover from failures.",
    year: 2024,
    citationCount: 26,
    url: "https://example.com/p7",
    authors: [{ name: "Author 7" }],
  },
  {
    paperId: "p8",
    title: "Task Decomposition for Open-Ended Research",
    abstract: "Task decomposition structures open-ended research planning.",
    year: 2024,
    citationCount: 24,
    url: "https://example.com/p8",
    authors: [{ name: "Author 8" }],
  },
  {
    paperId: "p9",
    title: "Execution Planners for Scientific Workflows",
    abstract: "Execution planners coordinate multi-step scientific workflows.",
    year: 2025,
    citationCount: 22,
    url: "https://example.com/p9",
    authors: [{ name: "Author 9" }],
  },
];

function makePaperSeries(params: { prefix: string; count: number; titleStem: string }) {
  return Array.from({ length: params.count }, (_, index) => {
    const ordinal = String(index + 1);
    return {
      paperId: `${params.prefix}-${ordinal}`,
      title: `${params.titleStem} ${ordinal}`,
      abstract: `${params.titleStem} ${ordinal} studies ${params.prefix} mechanism ${ordinal} and ${params.prefix} protocol ${ordinal}.`,
      year: 2025,
      citationCount: params.count - index,
      url: `https://example.com/${params.prefix}-${ordinal}`,
      authors: [{ name: `${params.prefix} Author ${ordinal}` }],
    };
  });
}

function makeExternalSignalsForPaperSeries(params: { prefix: string; count: number }) {
  return Array.from({ length: params.count }, (_, index) => {
    const ordinal = String(index + 1);
    return {
      paperId: `${params.prefix}-${ordinal}`,
      topics: [`${params.prefix} mechanism ${ordinal}`, `${params.prefix} protocol ${ordinal}`],
      methods: [`${params.prefix} workflow ${ordinal}`],
    };
  });
}

describe("analyzeGapNetwork", () => {
  it("keeps one representative gap pair per cluster relation when multiple inter-cluster gaps qualify", () => {
    const result = analyzeGapNetwork({
      query: "agents memory planning",
      papers: [...papers],
      citationEdges: [
        { source: "p1", target: "p2", weight: 1 },
        { source: "p1", target: "p3", weight: 1 },
        { source: "p2", target: "p3", weight: 1 },
        { source: "p4", target: "p5", weight: 1 },
        { source: "p4", target: "p6", weight: 1 },
        { source: "p5", target: "p6", weight: 1 },
        { source: "p7", target: "p8", weight: 1 },
        { source: "p7", target: "p9", weight: 1 },
        { source: "p8", target: "p9", weight: 1 },
      ],
      semanticEdges: [],
      clusterLabels: {
        p1: "Agents",
        p2: "Agents",
        p3: "Agents",
        p4: "Memory",
        p5: "Memory",
        p6: "Memory",
        p7: "Planning",
        p8: "Planning",
        p9: "Planning",
      },
      clusters: [
        { id: 0, label: "Agents", paperIds: ["p1", "p2", "p3"] },
        { id: 1, label: "Memory", paperIds: ["p4", "p5", "p6"] },
        { id: 2, label: "Planning", paperIds: ["p7", "p8", "p9"] },
      ],
      externalSignals: [
        { paperId: "p1", topics: ["tool use", "research agents"], methods: ["tool orchestration"] },
        {
          paperId: "p2",
          topics: ["workflow planning", "research agents"],
          methods: ["agent planning"],
        },
        { paperId: "p3", topics: ["agent benchmarks", "tool use"], methods: ["benchmarking"] },
        {
          paperId: "p4",
          topics: ["long context", "agent memory"],
          methods: ["memory architecture"],
        },
        {
          paperId: "p5",
          topics: ["retrieval memory", "persistent context"],
          methods: ["retrieval pipeline"],
        },
        { paperId: "p6", topics: ["context stores", "long context"], methods: ["context storage"] },
        { paperId: "p7", topics: ["plan repair", "research planning"], methods: ["plan repair"] },
        {
          paperId: "p8",
          topics: ["task decomposition", "research planning"],
          methods: ["decomposition"],
        },
        {
          paperId: "p9",
          topics: ["execution planning", "scientific workflows"],
          methods: ["execution planning"],
        },
      ],
    });

    expect(result.metrics.clusterCount).toBe(3);
    expect(result.metrics.gapPairCount).toBe(3);
    expect(result.gapPairs).toHaveLength(3);
    expect(result.gapPairs.map((gapPair) => gapPair.displayLabel)).toEqual([
      "Agents-Memory Gap",
      "Agents-Planning Gap",
      "Memory-Planning Gap",
    ]);
    expect(
      new Set(
        result.gapPairs.map((gapPair) =>
          [gapPair.leftClusterId, gapPair.rightClusterId].sort().join("::"),
        ),
      ).size,
    ).toBe(result.gapPairs.length);
  });

  it("records supportingPaperIds for each concept that reflect topic profile membership", () => {
    const result = analyzeGapNetwork({
      query: "agents memory planning",
      papers: [...papers],
      citationEdges: [
        { source: "p1", target: "p2", weight: 1 },
        { source: "p1", target: "p3", weight: 1 },
        { source: "p2", target: "p3", weight: 1 },
        { source: "p4", target: "p5", weight: 1 },
        { source: "p4", target: "p6", weight: 1 },
        { source: "p5", target: "p6", weight: 1 },
        { source: "p7", target: "p8", weight: 1 },
        { source: "p7", target: "p9", weight: 1 },
        { source: "p8", target: "p9", weight: 1 },
      ],
      semanticEdges: [],
      clusterLabels: {
        p1: "Agents",
        p2: "Agents",
        p3: "Agents",
        p4: "Memory",
        p5: "Memory",
        p6: "Memory",
        p7: "Planning",
        p8: "Planning",
        p9: "Planning",
      },
      clusters: [
        { id: 0, label: "Agents", paperIds: ["p1", "p2", "p3"] },
        { id: 1, label: "Memory", paperIds: ["p4", "p5", "p6"] },
        { id: 2, label: "Planning", paperIds: ["p7", "p8", "p9"] },
      ],
      externalSignals: [
        { paperId: "p1", topics: ["tool use", "research agents"], methods: ["tool orchestration"] },
        {
          paperId: "p2",
          topics: ["workflow planning", "research agents"],
          methods: ["agent planning"],
        },
        { paperId: "p3", topics: ["agent benchmarks", "tool use"], methods: ["benchmarking"] },
        {
          paperId: "p4",
          topics: ["long context", "agent memory"],
          methods: ["memory architecture"],
        },
        {
          paperId: "p5",
          topics: ["retrieval memory", "persistent context"],
          methods: ["retrieval pipeline"],
        },
        { paperId: "p6", topics: ["context stores", "long context"], methods: ["context storage"] },
        { paperId: "p7", topics: ["plan repair", "research planning"], methods: ["plan repair"] },
        {
          paperId: "p8",
          topics: ["task decomposition", "research planning"],
          methods: ["decomposition"],
        },
        {
          paperId: "p9",
          topics: ["execution planning", "scientific workflows"],
          methods: ["execution planning"],
        },
      ],
    });

    const allConcepts = result.clusters.flatMap((cluster) => cluster.concepts);
    expect(allConcepts.length).toBeGreaterThan(0);

    const expectedPaperIdsByLabel = new Map<string, Set<string>>([
      ["Agents", new Set(["p1", "p2", "p3"])],
      ["Memory", new Set(["p4", "p5", "p6"])],
      ["Planning", new Set(["p7", "p8", "p9"])],
    ]);
    for (const cluster of result.clusters) {
      const ownedPaperIds = expectedPaperIdsByLabel.get(cluster.label) ?? new Set();
      expect(ownedPaperIds.size).toBeGreaterThan(0);
      for (const concept of cluster.concepts) {
        const ids = concept.supportingPaperIds ?? [];
        expect(ids.length).toBeGreaterThan(0);
        for (const paperId of ids) {
          expect(ownedPaperIds.has(paperId)).toBe(true);
        }
      }
    }
  });

  it("caps rendered cluster concept nodes by paper count", () => {
    const smallPapers = makePaperSeries({
      prefix: "small-cluster",
      count: 4,
      titleStem: "Small Cluster Topic",
    });
    const largePapers = makePaperSeries({
      prefix: "large-cluster",
      count: 20,
      titleStem: "Large Cluster Topic",
    });
    const allPapers = [...smallPapers, ...largePapers];

    const result = analyzeGapNetwork({
      query: "cluster size encoding",
      papers: allPapers,
      citationEdges: [],
      semanticEdges: [],
      clusterLabels: Object.fromEntries([
        ...smallPapers.map((paper) => [paper.paperId, "Small Cluster"] as const),
        ...largePapers.map((paper) => [paper.paperId, "Large Cluster"] as const),
      ]),
      clusters: [
        {
          id: 0,
          label: "Small Cluster",
          paperIds: smallPapers.map((paper) => paper.paperId),
        },
        {
          id: 1,
          label: "Large Cluster",
          paperIds: largePapers.map((paper) => paper.paperId),
        },
      ],
      externalSignals: [
        ...makeExternalSignalsForPaperSeries({ prefix: "small-cluster", count: 4 }),
        ...makeExternalSignalsForPaperSeries({ prefix: "large-cluster", count: 20 }),
      ],
    });

    const smallCluster = result.clusters.find((cluster) => cluster.label === "Small Cluster");
    const largeCluster = result.clusters.find((cluster) => cluster.label === "Large Cluster");

    expect(smallCluster?.paperCount).toBe(4);
    expect(largeCluster?.paperCount).toBe(20);
    expect(smallCluster?.concepts).toHaveLength(4);
    expect(largeCluster?.concepts.length).toBeGreaterThan(smallCluster?.concepts.length ?? 0);
    expect(largeCluster?.concepts.length).toBeLessThanOrEqual(16);
  });
});

describe("analyzeGapNetwork research term nodes", () => {
  // @check acceptance-check:gap-network-detection-from-search-research-term-nodes
  it("keeps concept nodes on research terms instead of broad query labels", () => {
    const result = analyzeGapNetwork({
      query: "artificial intelligence for science",
      papers: [
        {
          paperId: "science-agent-1",
          title: "AI Scientists for Hypothesis Generation",
          abstract:
            "Artificial intelligence for science uses large language models and agents for hypothesis generation.",
          year: 2025,
          citationCount: 30,
          url: "https://example.com/science-agent-1",
          authors: [{ name: "A" }],
        },
        {
          paperId: "science-agent-2",
          title: "Agentic Literature Search for Scientific Workflows",
          abstract: "AI for science agents use experiment planning and agentic literature search.",
          year: 2025,
          citationCount: 24,
          url: "https://example.com/science-agent-2",
          authors: [{ name: "B" }],
        },
        {
          paperId: "lab-robot-1",
          title: "Closed Loop Experiments in Robotic Labs",
          abstract:
            "Artificial intelligence for science can drive robotic labs and materials workflows.",
          year: 2024,
          citationCount: 18,
          url: "https://example.com/lab-robot-1",
          authors: [{ name: "C" }],
        },
        {
          paperId: "lab-robot-2",
          title: "Laboratory Automation for Materials Discovery",
          abstract: "AI for science systems use laboratory automation and closed loop experiments.",
          year: 2024,
          citationCount: 16,
          url: "https://example.com/lab-robot-2",
          authors: [{ name: "D" }],
        },
      ],
      citationEdges: [
        { source: "science-agent-1", target: "science-agent-2", weight: 1 },
        { source: "lab-robot-1", target: "lab-robot-2", weight: 1 },
      ],
      semanticEdges: [],
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
      externalSignals: [
        {
          paperId: "science-agent-1",
          topics: ["artificial intelligence", "science", "agents", "hypothesis generation"],
          methods: ["agentic literature search"],
        },
        {
          paperId: "science-agent-2",
          topics: ["large language models", "agents", "hypothesis generation"],
          methods: ["experiment planning"],
        },
        {
          paperId: "lab-robot-1",
          topics: ["artificial intelligence", "science", "materials", "verification"],
          methods: ["closed loop experiments"],
        },
        {
          paperId: "lab-robot-2",
          topics: ["materials", "automation", "scientific discovery"],
          methods: ["laboratory automation"],
        },
      ],
    });

    const conceptLabels = result.clusters.flatMap((cluster) =>
      cluster.concepts.map((concept) => concept.label),
    );
    const gapPairConcepts = result.gapPairs.flatMap((pair) => [
      ...pair.bridgeConcepts,
      ...pair.leftConcepts,
      ...pair.rightConcepts,
    ]);

    expect(conceptLabels).toEqual(
      expect.arrayContaining([
        "Hypothesis Generation",
        "Agentic Literature Search",
        "Closed Loop Experiments",
        "Laboratory Automation",
      ]),
    );
    expect(conceptLabels).not.toEqual(
      expect.arrayContaining([
        "Artificial Intelligence",
        "Agents",
        "Large Language Models",
        "Science",
        "Scientific Discovery",
        "Verification",
      ]),
    );
    expect(gapPairConcepts).toEqual(expect.arrayContaining(["materials"]));
    expect(gapPairConcepts).not.toEqual(
      expect.arrayContaining([
        "artificial intelligence",
        "agents",
        "large language models",
        "science",
        "scientific discovery",
        "verification",
      ]),
    );
  });
});
