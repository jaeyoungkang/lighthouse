import { describe, expect, it } from "vitest";
import {
  computeGraphDensity,
  enrichDegreeDistributionNetwork,
  shouldEnrichDegreeDistribution,
} from "@/app/server/services/knowledge-map/enrich";

const papers = Array.from({ length: 15 }, (_, index) => ({
  paperId: `p${String(index + 1)}`,
  title:
    index === 0
      ? "Planning Agents for Scientific Discovery"
      : index === 1
        ? "Execution Agents for Automated Experiments"
        : index === 2
          ? "Scientific Workflow Memory in Research Agents"
          : `Sparse Paper ${String(index + 1)}`,
  abstract:
    index === 0
      ? "Planning-based agents coordinate hypothesis generation."
      : index === 1
        ? "Execution agents run automated experiments."
        : index === 2
          ? "Research agents share workflow memory across experiments."
          : `Sparse abstract ${String(index + 1)}`,
  year: 2020 + (index % 5),
  citationCount: 10 + index,
  url: `https://example.com/p${String(index + 1)}`,
  authors: [{ name: `Author ${String(index + 1)}` }],
  openAccessPdf: null,
  doi: null,
  referenceIds: null,
  citationIds: null,
}));

describe("knowledge-map enrich", () => {
  it("computes sparse gating from graph density", () => {
    expect(computeGraphDensity(0, 10)).toBe(0);
    expect(computeGraphDensity(1, 10)).toBe(0);
    expect(computeGraphDensity(15, 1)).toBe(1 / 105);
    expect(shouldEnrichDegreeDistribution({ paperCount: 15, edgeCount: 1 })).toBe(true);
    expect(shouldEnrichDegreeDistribution({ paperCount: 15, edgeCount: 2 })).toBe(false);
    expect(shouldEnrichDegreeDistribution({ paperCount: 4, edgeCount: 1 })).toBe(false);
    expect(shouldEnrichDegreeDistribution({ paperCount: 25, edgeCount: 3 })).toBe(false);
  });

  it("returns semantic and method edges from stored semantic profiles on sparse graphs", async () => {
    const edges = await enrichDegreeDistributionNetwork({
      query: "agentic research automation",
      papers,
      citationEdges: [{ source: "p2", target: "p1", weight: 1 }],
      externalSignals: [
        {
          paperId: "p1",
          topics: ["scientific discovery", "workflow memory", "agents"],
          methods: ["workflow memory"],
        },
        {
          paperId: "p3",
          topics: ["scientific discovery", "workflow memory", "agents"],
          methods: ["workflow memory"],
        },
        {
          paperId: "p4",
          topics: ["evaluation benchmarks", "research automation"],
          methods: ["workflow memory"],
        },
      ],
    });

    const semanticEdge = edges.find(
      (edge) => edge.source === "p1" && edge.target === "p3" && edge.origin === "semantic",
    );
    const methodEdge = edges.find(
      (edge) => edge.source === "p1" && edge.target === "p4" && edge.origin === "method",
    );

    expect(semanticEdge).toEqual({
      source: "p1",
      target: "p3",
      weight: 0.58,
      origin: "semantic",
    });
    expect(methodEdge).toEqual({
      source: "p1",
      target: "p4",
      weight: 0.34,
      origin: "method",
    });
    expect(
      edges.find(
        (edge) =>
          (edge.source === "p1" && edge.target === "p2") ||
          (edge.source === "p2" && edge.target === "p1"),
      ),
    ).toBeUndefined();
  });

  it("falls back to heuristic semantic edges when no API key is available", async () => {
    const edges = await enrichDegreeDistributionNetwork({
      query: "agentic research automation",
      papers,
      citationEdges: [{ source: "p1", target: "p2", weight: 1 }],
    });

    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((edge) => edge.source !== edge.target)).toBe(true);
  });

  it("does not enrich a one-paper or already-dense graph", async () => {
    await expect(
      enrichDegreeDistributionNetwork({
        query: "agentic research automation",
        papers: papers.slice(0, 1),
        citationEdges: [],
      }),
    ).resolves.toEqual([]);
    await expect(
      enrichDegreeDistributionNetwork({
        query: "agentic research automation",
        papers,
        citationEdges: [
          { source: "p1", target: "p2", weight: 1 },
          { source: "p2", target: "p3", weight: 1 },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it("enriches an exactly two-paper sparse graph when both signals support an edge", async () => {
    await expect(
      enrichDegreeDistributionNetwork({
        query: "workflow memory",
        papers: papers.slice(0, 2),
        citationEdges: [],
        externalSignals: [
          { paperId: "p1", topics: ["workflow memory", "agents"], methods: [] },
          { paperId: "p2", topics: ["workflow memory", "agents"], methods: [] },
        ],
      }),
    ).resolves.toEqual([{ source: "p1", target: "p2", weight: 0.5, origin: "semantic" }]);
  });

  it("does not infer an edge when one paper lacks a usable signal", async () => {
    await expect(
      enrichDegreeDistributionNetwork({
        query: "",
        papers: papers.slice(0, 2).map((paper) => ({ ...paper, title: "", abstract: null })),
        citationEdges: [],
        externalSignals: [{ paperId: "p1", topics: ["workflow memory"], methods: [] }],
      }),
    ).resolves.toEqual([]);
  });
});
