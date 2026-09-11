import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GapNetworkCluster,
  GapNetworkReport,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import {
  GAP_NETWORK_CLUSTER_LIMIT,
  GAP_NETWORK_GAP_PAIR_LIMIT,
  MAX_GRAPH_SOURCE_PAPERS,
} from "@/app/lib/constants";
import { utf8ByteLength } from "@/app/lib/utf8";
import {
  GAP_NETWORK_JUDGMENT_TIMEOUT_MS,
  GAP_NETWORK_OUTPUT_TOKEN_LIMITS,
  GAP_NETWORK_PROMPT_MAX_BYTES,
} from "@/app/server/services/knowledge-map/gap-network-prompt-budget";
import { interpretClusterNarratives } from "@/app/server/services/knowledge-map/interpret-cluster-narrative";
import { interpretGapNetworkHypotheses } from "@/app/server/services/knowledge-map/interpret-gap-hypothesis";
import { interpretGapNarratives } from "@/app/server/services/knowledge-map/interpret-gap-narrative";
import { interpretGapNetworkContentNarrative } from "@/app/server/services/knowledge-map/interpret-gap-network-content-narrative";
import { interpretGapNetworkDomain } from "@/app/server/services/knowledge-map/interpret-gap-network-domain";

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
}));

const OVERSIZED_TEXT = '\\"긴 입력\n'.repeat(4_000);

function buildMaximumEnvelopeFixture(): {
  query: string;
  clusters: GapNetworkCluster[];
  gapPairs: GapPair[];
  papers: GraphPaperSnapshot[];
} {
  const papers = Array.from(
    { length: MAX_GRAPH_SOURCE_PAPERS },
    (_, index): GraphPaperSnapshot => ({
      paperId: `paper-${String(index)}`,
      title: `${OVERSIZED_TEXT}-title-${String(index)}`,
      abstract: `${OVERSIZED_TEXT}-abstract-${String(index)}`,
      year: 2026,
      citationCount: index,
      url: `https://example.com/${String(index)}`,
      authors: [],
    }),
  );
  const clusters = Array.from(
    { length: GAP_NETWORK_CLUSTER_LIMIT },
    (_, index): GapNetworkCluster => ({
      id: `cluster-${String(index)}`,
      label: `${OVERSIZED_TEXT}-cluster-${String(index)}`,
      color: "oklch(0.6 0.1 240)",
      paperCount: 8,
      concepts: Array.from({ length: 6 }, (_, conceptIndex) => ({
        id: `concept-${String(index)}-${String(conceptIndex)}`,
        label: `${OVERSIZED_TEXT}-concept-${String(index)}-${String(conceptIndex)}`,
        clusterId: `cluster-${String(index)}`,
        score: conceptIndex,
      })),
      topPaperIds: papers.slice(index * 8, index * 8 + 8).map((paper) => paper.paperId),
      narrative: `${OVERSIZED_TEXT}-narrative-${String(index)}`,
    }),
  );
  const gapPairs = Array.from({ length: GAP_NETWORK_GAP_PAIR_LIMIT }, (_, index): GapPair => {
    const left = clusters[index % clusters.length];
    const right = clusters[(index + 1) % clusters.length];
    return {
      id: `gap-${String(index)}`,
      leftClusterId: left.id,
      rightClusterId: right.id,
      leftLabel: left.label,
      rightLabel: right.label,
      displayLabel: `${OVERSIZED_TEXT}-gap-${String(index)}`,
      observed: 0,
      expected: 10,
      gapScore: 1,
      rank: index + 1,
      bridgeConcepts: Array.from({ length: 5 }, () => OVERSIZED_TEXT),
      leftConcepts: Array.from({ length: 5 }, () => OVERSIZED_TEXT),
      rightConcepts: Array.from({ length: 5 }, () => OVERSIZED_TEXT),
    };
  });

  return { query: OVERSIZED_TEXT, clusters, gapPairs, papers };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gap network prompt serialized-input budget", () => {
  it("keeps every production enrichment prompt inside the pinned maximum envelope", async () => {
    const fixture = buildMaximumEnvelopeFixture();
    expect(GAP_NETWORK_CLUSTER_LIMIT).toBe(5);
    expect(GAP_NETWORK_GAP_PAIR_LIMIT).toBe(10);
    expect(MAX_GRAPH_SOURCE_PAPERS).toBe(40);
    expect(fixture.papers).toHaveLength(MAX_GRAPH_SOURCE_PAPERS);
    const papersById = new Map(fixture.papers.map((paper) => [paper.paperId, paper] as const));
    const clusterLabels = Object.fromEntries(
      fixture.clusters.flatMap((cluster) =>
        (cluster.topPaperIds ?? []).map((paperId) => [paperId, cluster.label] as const),
      ),
    );
    const report: Omit<GapNetworkReport, "insight"> = {
      clusters: fixture.clusters,
      conceptEdges: [],
      gapPairs: fixture.gapPairs,
      metrics: {
        clusterCount: fixture.clusters.length,
        totalPaperCount: fixture.papers.length,
        totalEdgeCount: 0,
        gapPairCount: fixture.gapPairs.length,
      },
    };

    vi.mocked(executeJudgment).mockImplementation((spec) =>
      Promise.resolve(("fallbackValue" in spec ? spec.fallbackValue : undefined) as never),
    );

    const hypotheses = await interpretGapNetworkHypotheses({
      query: fixture.query,
      report,
      papers: fixture.papers,
      clusterLabels,
      clusters: fixture.clusters.map((cluster) => ({
        id: cluster.id,
        label: cluster.label,
        paperIds: cluster.topPaperIds ?? [],
      })),
    });
    const clusterNarratives = await interpretClusterNarratives({
      query: fixture.query,
      clusters: fixture.clusters,
      papersById,
    });
    const gapNarratives = await interpretGapNarratives({
      query: fixture.query,
      gapPairs: fixture.gapPairs,
      clustersById: new Map(fixture.clusters.map((cluster) => [cluster.id, cluster] as const)),
      papersById,
    });
    const domainLabel = await interpretGapNetworkDomain({
      query: fixture.query,
      clusters: fixture.clusters,
    });
    const contentNarrative = await interpretGapNetworkContentNarrative({
      query: fixture.query,
      domainLabel,
      clusters: fixture.clusters,
      gapPairs: fixture.gapPairs,
    });

    const serializedFallbackOutputs = JSON.stringify({
      hypotheses,
      clusterNarratives: [...clusterNarratives],
      gapNarratives: [...gapNarratives],
      domainLabel,
      contentNarrative,
    });
    expect(serializedFallbackOutputs).not.toContain(OVERSIZED_TEXT);
    expect(utf8ByteLength(serializedFallbackOutputs)).toBeLessThanOrEqual(65_536);

    expect(GAP_NETWORK_PROMPT_MAX_BYTES).toBe(65_536);
    expect(GAP_NETWORK_JUDGMENT_TIMEOUT_MS).toBe(10_000);
    const expectedBudgets = new Map([
      ["interpret-gap-network", GAP_NETWORK_OUTPUT_TOKEN_LIMITS.hypothesis],
      ["interpret-cluster-narrative", GAP_NETWORK_OUTPUT_TOKEN_LIMITS.clusterNarrative],
      ["interpret-gap-narrative", GAP_NETWORK_OUTPUT_TOKEN_LIMITS.gapNarrative],
      ["interpret-gap-network-domain", GAP_NETWORK_OUTPUT_TOKEN_LIMITS.domain],
      ["interpret-gap-network-content-narrative", GAP_NETWORK_OUTPUT_TOKEN_LIMITS.contentNarrative],
    ]);
    const calls = vi.mocked(executeJudgment).mock.calls;

    expect(calls).toHaveLength(expectedBudgets.size);
    for (const [spec] of calls) {
      expect(spec.maxInputBytes).toBe(65_536);
      expect(spec.maxOutputTokens).toBe(expectedBudgets.get(spec.label));
      expect(spec.timeoutMs).toBe(10_000);
      expect(utf8ByteLength(spec.prompt)).toBeLessThanOrEqual(65_536);
      expect(spec.prompt).not.toContain(OVERSIZED_TEXT);
      expect(spec.usageMetadata).toMatchObject({
        phase: "gap-enrichment",
        promptChars: spec.prompt.length,
      });
    }
  });
});
