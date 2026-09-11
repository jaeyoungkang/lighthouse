import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

export function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

export function createPaper(overrides?: Partial<Record<string, unknown>>) {
  return {
    paperId: "paper-1",
    title: "Paper 1",
    abstract: "Abstract 1",
    year: 2024,
    citationCount: 12,
    url: "https://example.com/paper-1",
    authors: [{ name: "Alice" }],
    ...overrides,
  };
}

export function createSearchView(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색 결과",
    content: "search content",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "agent memory",
      total: 20,
      papers: Array.from({ length: 20 }, (_, index) =>
        createPaper({
          paperId: `paper-${String(index + 1)}`,
          title: `Paper ${String(index + 1)}`,
          abstract: `Abstract ${String(index + 1)}`,
          year: 2020 + (index % 5),
          citationCount: index + 1,
          url: `https://example.com/paper-${String(index + 1)}`,
          authors: [{ name: `Author ${String(index + 1)}` }],
        }),
      ),
    },
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  };
}

export function createGapNetworkView(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "gap-network-1",
    type: "gap_network",
    title: "공백 탐지 맵: agent memory",
    content: "# 공백 탐지 맵\n\n- 군집 수: 2\n- gap 수: 1",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "agent memory",
      papers: [createPaper()],
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-0",
            label: "Agents",
            color: "oklch(0.641 0.131 251.4)",
            paperCount: 3,
            concepts: [
              { id: "c-0", label: "Tool Use", clusterId: "cluster-0", score: 8.2 },
              { id: "c-1", label: "Planner Memory", clusterId: "cluster-0", score: 6.4 },
            ],
          },
          {
            id: "cluster-1",
            label: "Memory",
            color: "#f28b82",
            paperCount: 2,
            concepts: [{ id: "c-2", label: "Long Context", clusterId: "cluster-1", score: 7.5 }],
          },
        ],
        conceptEdges: [],
        gapPairs: [
          {
            id: "gap-0",
            leftClusterId: "cluster-0",
            rightClusterId: "cluster-1",
            leftLabel: "Agents",
            rightLabel: "Memory",
            displayLabel: "Agents-Memory Gap",
            observed: 0,
            expected: 3,
            gapScore: 1,
            rank: 1,
            bridgeConcepts: ["Retrieval Planning"],
            leftConcepts: ["Tool Use"],
            rightConcepts: ["Long Context"],
          },
        ],
        metrics: {
          clusterCount: 2,
          totalPaperCount: 5,
          totalEdgeCount: 6,
          gapPairCount: 1,
        },
        insight: {
          hypotheses: [
            {
              id: "hyp-1",
              gapPairId: "gap-0",
              title: "Memory-guided agent benchmark",
              description: "Use memory planning to connect the two clusters.",
              sourceConcept: "Tool Use",
              targetConcept: "Long Context",
              confidence: "high",
            },
          ],
        },
      },
      reactionPreparation: {
        overviewReaction: {
          id: "gap-network-overview",
          title: "공백 탐지 맵 요약",
          body: "대표 공백을 요약한다.",
          chips: [],
          timestamp: "2026-04-08T00:00:00.000Z",
        },
        clusterReactions: [
          {
            clusterId: "cluster-0",
            reaction: {
              id: "gap-network-cluster-cluster-0",
              title: "Agents 클러스터",
              body: "Agents 군집 코멘트다.",
              chips: [],
              timestamp: "2026-04-08T00:00:00.000Z",
            },
          },
          {
            clusterId: "cluster-1",
            reaction: {
              id: "gap-network-cluster-cluster-1",
              title: "Memory 클러스터",
              body: "Memory 군집 코멘트다.",
              chips: [],
              timestamp: "2026-04-08T00:00:00.000Z",
            },
          },
        ],
        gapReactions: [
          {
            gapPairId: "gap-0",
            reaction: {
              id: "gap-network-gap-gap-0",
              title: "Agents-Memory 가설",
              body: "Agents와 Memory 사이 가설이다.",
              chips: [],
              timestamp: "2026-04-08T00:00:00.000Z",
            },
          },
        ],
        preparedAt: "2026-04-08T00:00:00.000Z",
      },
    },
    refs: [],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-04-08T00:00:00.000Z",
    updatedAt: "2026-04-08T00:00:00.000Z",
  };
}
