import type { GapNetworkResearchRoutePayload } from "@/app/domain/research-route-payload";

export function createGapNetworkView(): GapNetworkResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "gap-1",
    type: "gap_network",
    title: "연구 공백: AI for Science",
    content: "gap content",
    createdBy: "agent",
    refs: [],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "gap_network",
      version: 1 as const,
      query: "AI for Science",
      sourceSnapshotId: "search-1",
      papers: [],
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-0",
            label: "Agents",
            color: "oklch(0.6 0.1 200)",
            paperCount: 2,
            concepts: [],
          },
        ],
        conceptEdges: [
          {
            source: "agent memory",
            target: "planning",
            clusterId: "cluster-0",
            weight: 1,
          },
        ],
        gapPairs: [
          {
            id: "gap-0",
            leftClusterId: "cluster-0",
            rightClusterId: "cluster-1",
            leftLabel: "Agents",
            rightLabel: "Memory",
            displayLabel: "Agents-Memory",
            observed: 0,
            expected: 2,
            gapScore: 1,
            rank: 1,
            bridgeConcepts: [],
            leftConcepts: [],
            rightConcepts: [],
          },
        ],
        metrics: {
          clusterCount: 1,
          totalPaperCount: 2,
          totalEdgeCount: 1,
          gapPairCount: 1,
        },
        insight: { hypotheses: [] },
      },
      reactionPreparation: {
        overviewReaction: {
          id: "gap-network-overview",
          title: "연구 공백 리포트 요약",
          body: "대표 공백을 요약한다.",
          chips: [],
          timestamp: "2026-04-09T00:00:00.000Z",
        },
        clusterReactions: [
          {
            clusterId: "cluster-0",
            reaction: {
              id: "gap-network-cluster-cluster-0",
              title: "Agents 클러스터",
              body: "Agents 군집 코멘트다.",
              chips: [],
              timestamp: "2026-04-09T00:00:00.000Z",
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
              timestamp: "2026-04-09T00:00:00.000Z",
            },
          },
        ],
        preparedAt: "2026-04-09T00:00:00.000Z",
      },
    },
    reaction: null,
  };
}

export function createReactionReadyGapNetworkView(): GapNetworkResearchRoutePayload {
  const gapView = createGapNetworkView();
  const metadata = gapView.metadata;
  const preparation = metadata.reactionPreparation;
  if (!preparation) throw new Error("reaction preparation fixture is required");
  return {
    ...gapView,
    metadata: {
      ...metadata,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        updatedAt: "2026-04-09T00:01:00.000Z",
      },
      gapNetworkReport: {
        ...metadata.gapNetworkReport,
        contentNarrative: {
          overview: "prepared reaction test overview",
          clusterParagraphs: [],
          gapInferenceParagraph: "prepared reaction test gap inference",
        },
      },
      reactionPreparation: {
        ...preparation,
        clusterReactions: preparation.clusterReactions.map((entry) => ({
          ...entry,
          narrative: entry.reaction.body,
        })),
        gapReactions: preparation.gapReactions.map((entry) => ({
          ...entry,
          metaQualitative: entry.reaction.body,
          proposals: [
            {
              hypothesis: entry.reaction.body,
              grounding: "prepared gap grounding",
            },
          ],
        })),
      },
    },
  };
}
