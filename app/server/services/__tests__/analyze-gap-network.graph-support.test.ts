import { describe, expect, it } from "vitest";
import { analyzeGapNetwork } from "@/app/server/services/knowledge-map/analyze-gap-network";

const graphPapers = [
  {
    paperId: "a1",
    title: "Agent Memory Retrieval",
    abstract: "Agent memory retrieval methods.",
    year: 2025,
    citationCount: 100,
    url: "https://example.com/a1",
    authors: [{ name: "A1" }],
  },
  {
    paperId: "a2",
    title: "Agent Memory Retrieval",
    abstract: "Agent memory retrieval methods.",
    year: 2025,
    citationCount: 10,
    url: "https://example.com/a2",
    authors: [{ name: "A2" }],
  },
  {
    paperId: "a3",
    title: "Agent Memory Retrieval",
    abstract: "Agent memory retrieval methods.",
    year: 2025,
    citationCount: 5,
    url: "https://example.com/a3",
    authors: [{ name: "A3" }],
  },
  {
    paperId: "b1",
    title: "Planning Repair Protocols",
    abstract: "Planning repair protocols for research workflows.",
    year: 2025,
    citationCount: 90,
    url: "https://example.com/b1",
    authors: [{ name: "B1" }],
  },
  {
    paperId: "b2",
    title: "Planning Repair Protocols",
    abstract: "Planning repair protocols for research workflows.",
    year: 2025,
    citationCount: 8,
    url: "https://example.com/b2",
    authors: [{ name: "B2" }],
  },
  {
    paperId: "b3",
    title: "Planning Repair Protocols",
    abstract: "Planning repair protocols for research workflows.",
    year: 2025,
    citationCount: 7,
    url: "https://example.com/b3",
    authors: [{ name: "B3" }],
  },
];

function buildSparseAiForSciencePapers() {
  const clusterSpecs = [
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
  ];

  const papers = clusterSpecs.flatMap((cluster) =>
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
  const clusters = clusterSpecs.map((cluster, index) => ({
    id: index,
    label: cluster.label,
    paperIds: papers
      .filter((paper) => paper.paperId.startsWith(cluster.prefix))
      .map((paper) => paper.paperId),
  }));
  const clusterLabels = Object.fromEntries(
    clusters.flatMap((cluster) => cluster.paperIds.map((paperId) => [paperId, cluster.label])),
  );

  return { papers, clusters, clusterLabels };
}

describe("analyzeGapNetwork graph support", () => {
  it("counts graph support as auxiliary edges and uses it as a representative-paper tie-breaker", () => {
    const result = analyzeGapNetwork({
      query: "agent memory planning repair",
      papers: graphPapers,
      citationEdges: [],
      semanticEdges: [],
      graphSupportEdges: [
        { source: "a1", target: "a2", weight: 0.2 },
        { source: "a1", target: "a3", weight: 0.2 },
        { source: "a2", target: "a3", weight: 1.2 },
        { source: "b1", target: "b2", weight: 0.2 },
        { source: "b1", target: "b3", weight: 0.2 },
        { source: "b2", target: "b3", weight: 1.1 },
      ],
      clusterLabels: {
        a1: "Memory",
        a2: "Memory",
        a3: "Memory",
        b1: "Planning",
        b2: "Planning",
        b3: "Planning",
      },
      clusters: [
        { id: 0, label: "Memory", paperIds: ["a1", "a2", "a3"] },
        { id: 1, label: "Planning", paperIds: ["b1", "b2", "b3"] },
      ],
    });

    expect(result.metrics.totalEdgeCount).toBe(6);
    expect(result.gapPairs).toHaveLength(1);
    expect(result.clusters.find((cluster) => cluster.label === "Memory")?.topPaperIds?.[0]).toBe(
      "a2",
    );
    expect(result.clusters.find((cluster) => cluster.label === "Planning")?.topPaperIds?.[0]).toBe(
      "b2",
    );
  });

  it("keeps a visible sparse-sample gap candidate when current-result graph support is the only edge source", () => {
    const result = analyzeGapNetwork({
      query: "ai for science",
      papers: [
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
      ],
      citationEdges: [],
      semanticEdges: [],
      graphSupportEdges: [{ source: "science-agent-1", target: "science-agent-2", weight: 0.8 }],
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
          topics: ["ai scientist", "hypothesis generation"],
          methods: ["agentic literature search"],
        },
        {
          paperId: "science-agent-2",
          topics: ["autonomous discovery agents"],
          methods: ["experiment planning"],
        },
        {
          paperId: "lab-robot-1",
          topics: ["robotic laboratories", "closed loop science"],
          methods: ["automated experiments"],
        },
        {
          paperId: "lab-robot-2",
          topics: ["laboratory automation", "materials discovery"],
          methods: ["workflow automation"],
        },
      ],
    });

    expect(result.metrics.totalEdgeCount).toBe(1);
    expect(result.gapPairs).toHaveLength(1);
    expect(result.gapPairs[0]).toMatchObject({
      displayLabel: "AI Scientists-Robotic Labs Gap",
      expected: 0.5,
      observed: 0,
    });
  });

  it("keeps visible sparse-sample gap candidates when semantic core evidence is the only edge source", () => {
    const { papers, clusters, clusterLabels } = buildSparseAiForSciencePapers();

    const result = analyzeGapNetwork({
      query: "ai for science",
      papers,
      citationEdges: [],
      semanticEdges: [
        { source: "science-agent-1", target: "science-agent-2", weight: 0.72, origin: "semantic" },
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
      ],
      graphSupportEdges: [],
      clusterLabels,
      clusters,
    });

    expect(result.metrics.totalPaperCount).toBe(39);
    expect(result.metrics.totalEdgeCount).toBe(4);
    expect(result.gapPairs.length).toBeGreaterThan(0);
    expect(result.gapPairs[0]?.expected).toBeLessThan(1);
    expect(result.gapPairs.map((gapPair) => gapPair.observed)).toContain(0);
  });
});
