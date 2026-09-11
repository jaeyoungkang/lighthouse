import { describe, expect, it } from "vitest";
import { clusterDegreeDistributionNetwork } from "@/app/server/services/knowledge-map/cluster";

const weightedTopicLabelInput = {
  query: "scientific discovery agents benchmarks",
  papers: [
    {
      paperId: "p1",
      title: "Scientific Discovery Agents for Hypothesis Generation",
      abstract: "Scientific discovery agents generate hypotheses for automated research.",
      year: 2024,
      citationCount: 120,
      url: "https://example.com/p1",
      authors: [{ name: "Author 1" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p2",
      title: "Autonomous Agents for Scientific Discovery",
      abstract: "Agents coordinate scientific discovery tasks and open-ended experimentation.",
      year: 2025,
      citationCount: 100,
      url: "https://example.com/p2",
      authors: [{ name: "Author 2" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p3",
      title: "Evaluation Benchmarks for AI Scientists",
      abstract: "Evaluation benchmarks test AI scientists and automated research systems.",
      year: 2025,
      citationCount: 90,
      url: "https://example.com/p3",
      authors: [{ name: "Author 3" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p4",
      title: "Verification Benchmarks for Research Automation",
      abstract:
        "Verification benchmarks measure research automation reliability and evaluation quality.",
      year: 2024,
      citationCount: 70,
      url: "https://example.com/p4",
      authors: [{ name: "Author 4" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p5",
      title: "Workflow Memory for Scientific Discovery Agents",
      abstract:
        "Workflow memory helps scientific discovery agents retain context across experiments.",
      year: 2024,
      citationCount: 60,
      url: "https://example.com/p5",
      authors: [{ name: "Author 5" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
  ],
  citationEdges: [
    { source: "p1", target: "p2", weight: 1 },
    { source: "p3", target: "p4", weight: 1 },
  ],
  semanticEdges: [],
  externalSignals: [
    {
      paperId: "p1",
      topics: ["scientific discovery", "hypothesis generation", "llm agents"],
      methods: ["multi-agent planning"],
    },
    {
      paperId: "p2",
      topics: ["scientific discovery", "hypothesis generation", "research automation"],
      methods: ["agentic workflow"],
    },
    {
      paperId: "p3",
      topics: ["benchmarks", "automation", "evaluation"],
      methods: ["benchmarking"],
    },
    {
      paperId: "p4",
      topics: ["benchmarks", "automation", "verification"],
      methods: ["verification benchmark"],
    },
    {
      paperId: "p5",
      topics: ["scientific discovery", "workflow memory", "hypothesis generation"],
      methods: ["workflow memory"],
    },
  ],
} as const;

const hubClusterAlignmentInput = {
  query: "ai scientist scientific discovery llm",
  papers: [
    {
      paperId: "p1",
      title: "The AI Scientist",
      abstract: "Large language models enable automated scientific discovery.",
      year: 2024,
      citationCount: 620,
      url: "https://example.com/p1",
      authors: [{ name: "Author 1" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p2",
      title: "AI Scientist v2",
      abstract: "LLM agents expand automated scientific discovery.",
      year: 2025,
      citationCount: 170,
      url: "https://example.com/p2",
      authors: [{ name: "Author 2" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p3",
      title: "Generative AI and supply chains",
      abstract: "Generative AI improves supply chain planning.",
      year: 2025,
      citationCount: 12,
      url: "https://example.com/p3",
      authors: [{ name: "Author 3" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
    {
      paperId: "p4",
      title: "Generative AI in music",
      abstract: "Generative AI supports music workflows.",
      year: 2025,
      citationCount: 8,
      url: "https://example.com/p4",
      authors: [{ name: "Author 4" }],
      referenceIds: null,
      citationIds: null,
      openAccessPdf: null,
      doi: null,
    },
  ],
  citationEdges: [
    { source: "p1", target: "p2", weight: 1 },
    { source: "p1", target: "p3", weight: 1 },
    { source: "p2", target: "p4", weight: 1 },
  ],
  semanticEdges: [
    { source: "p1", target: "p2", weight: 0.9, origin: "semantic" as const },
    { source: "p1", target: "p3", weight: 0.2, origin: "semantic" as const },
    { source: "p2", target: "p4", weight: 0.2, origin: "semantic" as const },
  ],
  externalSignals: [
    {
      paperId: "p1",
      topics: ["automated scientific discovery", "large language models", "scientific discovery"],
      methods: ["research agents"],
    },
    {
      paperId: "p2",
      topics: ["scientific discovery", "large language models", "agentic tree search"],
      methods: ["research agents"],
    },
    {
      paperId: "p3",
      topics: ["generative ai", "supply chains"],
      methods: ["planning system"],
    },
    {
      paperId: "p4",
      topics: ["generative ai", "music workflows"],
      methods: ["creative assistant"],
    },
  ],
} as const;

describe("knowledge-map cluster", () => {
  // @check acceptance-check:gap-network-detection-from-search-research-term-nodes
  it("creates weighted topic labels and assigns isolated nodes by topic similarity", () => {
    const result = clusterDegreeDistributionNetwork(weightedTopicLabelInput);

    expect(result.clusters).toHaveLength(2);
    expect(result.clusters.map((cluster) => cluster.label)).toEqual([
      "Hypothesis Generation & LLM Agents",
      "Research Automation & Verification Benchmark",
    ]);
    expect(result.clusterLabels.p5).toBe("Hypothesis Generation & LLM Agents");
  });

  it("keeps hub labels aligned with stored scientific-discovery topics instead of generic noise", () => {
    const result = clusterDegreeDistributionNetwork(hubClusterAlignmentInput);

    expect(result.clusters).toHaveLength(2);
    const hubClusterLabel =
      result.clusters.find((cluster) => cluster.paperIds.includes("p1"))?.label ?? "";
    expect(
      hubClusterLabel.includes("Scientific Discovery") ||
        hubClusterLabel.includes("Automated Scientific Discovery"),
    ).toBe(true);
    expect(hubClusterLabel).not.toContain("Large Language Models");
    expect(hubClusterLabel).not.toContain("Generative Ai");
  });
});
