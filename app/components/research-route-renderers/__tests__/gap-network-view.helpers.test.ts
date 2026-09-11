import { describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type {
  GapNetworkResearchRoutePayload,
  GapNetworkMetadata,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import {
  buildGapNetworkPendingProgressView,
  buildPendingGapNetworkMetadata,
  GAP_NETWORK_CORE_EVIDENCE_VERSION,
  GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS,
  GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS,
  GAP_NETWORK_PROGRESS_STAGE_DWELL_MS,
  GAP_NETWORK_PROGRESS_STAGES,
  hasCurrentGapNetworkCoreEvidence,
  isGapNetworkViewReadyForDisplay,
  isSettledGapNetworkView,
} from "@/app/components/research-route-renderers/gap-network-view.helpers";

const analysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["automation"],
  semanticProfile: {
    claim: "automates scientific discovery workflows",
    topics: ["automation"],
    method: "end-to-end workflow orchestration",
    finding: null,
    quotedBasis: {
      claim: "automates scientific discovery workflows",
      topics: ["automation"],
      method: "end-to-end workflow orchestration",
      finding: null,
    },
  },
  confidence: "medium",
  evidenceMap: {},
};

function createSearchMetadata(): SearchMetadata {
  return {
    type: "search",
    query: "The AI Scientist, automation of AI research",
    queryClauses: [
      {
        rawClause: "The AI Scientist",
        normalizedClause: "The AI Scientist",
        role: "anchor",
        isExtractive: true,
        derivedExpansions: [],
      },
    ],
    total: 2,
    papers: [
      {
        paperId: "paper-1",
        title: "The AI Scientist",
        abstract: "Automates scientific discovery workflows.",
        year: 2024,
        citationCount: 120,
        url: "https://example.com/paper-1",
        authors: [{ name: "Alice", authorId: "a1" }],
        referenceIds: ["paper-2"],
        citationIds: ["paper-3"],
        inlineAnalysis: {
          version: INLINE_ANALYSIS_VERSION,
          analysis,
          source: "abstract",
        },
      },
      {
        paperId: "paper-2",
        title: "Towards end-to-end automation of AI research",
        abstract: "End-to-end automation systems for AI research loops.",
        year: 2025,
        citationCount: 45,
        url: "https://example.com/paper-2",
        authors: [{ name: "Bob", authorId: "b1" }],
        referenceIds: ["paper-1"],
        citationIds: [],
        inlineAnalysis: {
          version: INLINE_ANALYSIS_VERSION,
          analysis,
          source: "abstract",
        },
      },
    ],
  };
}

function createHydratedGapNetworkView(
  sourceSnapshotId: string,
  searchMetadata: SearchMetadata,
  overrides?: Partial<GapNetworkMetadata>,
): GapNetworkResearchRoutePayload {
  const pendingMetadata = buildPendingGapNetworkMetadata({
    sourceSnapshotId,
    query: searchMetadata.query,
    queryClauses: searchMetadata.queryClauses,
    papers: searchMetadata.papers,
    now: "2026-04-06T00:00:00.000Z",
  });

  return {
    id: "gap-network-doc-1",
    type: "gap_network",
    title: "연구 공백 리포트",
    content: "",
    createdBy: "user",
    refs: [sourceSnapshotId],
    viewerPrincipalId: "principal-1",
    status: "ready",
    version: 1,
    reactionVersion: 0,
    createdAt: "2026-04-06T00:00:00.000Z",
    updatedAt: "2026-04-06T00:01:00.000Z",
    metadata: {
      ...pendingMetadata,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        coreEvidence: GAP_NETWORK_CORE_EVIDENCE_VERSION,
        updatedAt: "2026-04-06T00:01:00.000Z",
      },
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-0",
            label: "Autonomous Discovery",
            color: "oklch(0.641 0.131 251.4)",
            paperCount: 2,
            representativePaperId: "paper-1",
            representativePaperTitle: "The AI Scientist",
            concepts: [
              {
                id: "cluster-0::agentic frameworks",
                label: "Agentic Frameworks",
                score: 0.88,
              },
            ],
          },
          {
            id: "cluster-1",
            label: "EDA Systems",
            color: "oklch(0.685 0.16 44.7)",
            paperCount: 1,
            representativePaperId: "paper-2",
            representativePaperTitle: "Towards end-to-end automation of AI research",
            concepts: [
              {
                id: "cluster-1::eda automation",
                label: "EDA Automation",
                score: 0.71,
              },
            ],
          },
        ],
        conceptEdges: [
          {
            source: "cluster-0::agentic frameworks",
            target: "cluster-0::agentic frameworks",
            clusterId: "cluster-0",
            weight: 1,
          },
        ],
        gapPairs: [
          {
            id: "gap-1",
            leftClusterId: "cluster-0",
            rightClusterId: "cluster-1",
            displayLabel: "Autonomous Discovery-EDA Systems",
            observed: 1,
            expected: 4,
            gapScore: 0.75,
            rank: 1,
            bridgeConcepts: ["planning"],
            leftConcepts: ["agentic frameworks"],
            rightConcepts: ["eda automation"],
          },
        ],
        metrics: {
          clusterCount: 2,
          totalPaperCount: 3,
          totalEdgeCount: 1,
          gapPairCount: 1,
        },
        insight: {
          hypotheses: [
            {
              id: "hyp-1",
              gapPairId: "gap-1",
              title: "EDA x agentic systems",
              description: "Study cross-domain automation opportunities.",
              sourceConcept: "agentic frameworks",
              targetConcept: "eda automation",
              confidence: "medium",
            },
          ],
        },
      },
      ...(overrides ?? {}),
    } as GapNetworkMetadata,
  };
}

describe("gap-network-view helpers", () => {
  it("throws when E2 progress stages are missing required states", () => {
    const originalStages = [...GAP_NETWORK_PROGRESS_STAGES];
    GAP_NETWORK_PROGRESS_STAGES.splice(0, GAP_NETWORK_PROGRESS_STAGES.length);

    try {
      expect(() => buildGapNetworkPendingProgressView({ elapsedMs: 0, isCompleted: true })).toThrow(
        "gap network progress stages must include completed state",
      );
      expect(() => buildGapNetworkPendingProgressView({ elapsedMs: 0 })).toThrow(
        "gap network progress stages must include pending state",
      );
    } finally {
      GAP_NETWORK_PROGRESS_STAGES.push(...originalStages);
    }
  });

  it("describes pending E2 progress through LLM interpretation before completion", () => {
    const progressText = GAP_NETWORK_PROGRESS_STAGES.flatMap((stage) => [
      stage.label,
      stage.detail,
    ]).join(" ");
    const completed = buildGapNetworkPendingProgressView({ elapsedMs: 0, isCompleted: true });

    expect(progressText).toContain("해석 리포트 정리 중...");
    expect(progressText).toContain("LLM 해석 결과");
    expect(progressText).not.toContain("가설 생성 중...");
    expect(progressText).not.toContain("연구 가설을 정리");
    expect(completed.detail).toContain("그래프와 본문 해석이 반영된 리포트");
  });

  it("advances one visible progress stage per min-dwell and holds on interpret", () => {
    const stageIdAt = (elapsedMs: number) => buildGapNetworkPendingProgressView({ elapsedMs }).id;

    expect(stageIdAt(0)).toBe("collect");
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS - 1)).toBe("collect");
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS)).toBe("enrich");
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS * 2)).toBe("cluster");
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS * 3)).toBe("analyze");
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS * 4)).toBe("interpret");
    // The visible pacing must never outrun the last pending stage; enrichment is
    // the long pole and the screen holds on interpret however long it takes.
    expect(stageIdAt(GAP_NETWORK_PROGRESS_STAGE_DWELL_MS * 999)).toBe("interpret");

    // The reveal floor keeps the animated screen up long enough to read several
    // stages, so a fast build cannot flash the first stage and jump.
    expect(GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS).toBeGreaterThanOrEqual(
      GAP_NETWORK_PROGRESS_STAGE_DWELL_MS * 2,
    );
    // A terminal empty-state reveals sooner than a meaningful-gap report, but
    // still shows at least one full stage rather than flashing.
    expect(GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS).toBeLessThan(
      GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS,
    );
    expect(GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS).toBeGreaterThanOrEqual(
      GAP_NETWORK_PROGRESS_STAGE_DWELL_MS,
    );
  });

  it("treats blank gap reports as unsettled until core evidence is present", () => {
    const searchMetadata = createSearchMetadata();
    const hydrated = createHydratedGapNetworkView("search-1", searchMetadata);
    const hydratedMetadata = hydrated.metadata;
    const blank: GapNetworkResearchRoutePayload = {
      ...hydrated,
      metadata: {
        ...hydratedMetadata,
        papers: searchMetadata.papers.map((paper) => ({
          paperId: paper.paperId,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.year,
          citationCount: paper.citationCount,
          url: paper.url,
          authors: paper.authors,
          referenceIds: paper.referenceIds,
          citationIds: paper.citationIds,
        })),
        gapNetworkBuild: undefined,
        gapNetworkReport: {
          clusters: [],
          conceptEdges: [],
          gapPairs: [],
          metrics: {
            clusterCount: 0,
            totalPaperCount: 0,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
          insight: {
            hypotheses: [],
          },
        },
      },
    };

    const pending: GapNetworkResearchRoutePayload = {
      ...hydrated,
      status: "pending",
      metadata: buildPendingGapNetworkMetadata({
        sourceSnapshotId: "search-1",
        query: searchMetadata.query,
        papers: searchMetadata.papers,
        now: "2026-04-06T00:00:00.000Z",
      }),
    };
    expect(isSettledGapNetworkView(pending)).toBe(false);
    expect(isSettledGapNetworkView(blank)).toBe(false);
    expect(isSettledGapNetworkView(hydrated)).toBe(true);
    expect(isGapNetworkViewReadyForDisplay(hydrated)).toBe(true);
  });
});

describe("gap-network-view core evidence reuse", () => {
  it("does not treat enrichment-pending core ResearchRoutePayloads as display-ready when gaps need LLM prose", () => {
    const searchMetadata = createSearchMetadata();
    const pendingEnrichment = createHydratedGapNetworkView("search-1", searchMetadata, {
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        updatedAt: "2026-04-06T00:01:00.000Z",
      },
    });

    expect(isSettledGapNetworkView(pendingEnrichment)).toBe(true);
    expect(isGapNetworkViewReadyForDisplay(pendingEnrichment)).toBe(false);
  });

  it("requires current core evidence before reusing an enrichment-pending no-gap GapNetworkResearchRoutePayload", () => {
    const searchMetadata = createSearchMetadata();
    const baseDocument = createHydratedGapNetworkView("search-1", searchMetadata);
    const baseMetadata = baseDocument.metadata;
    const noGapReport = {
      ...baseMetadata.gapNetworkReport,
      gapPairs: [],
      metrics: {
        ...baseMetadata.gapNetworkReport.metrics,
        gapPairCount: 0,
        totalEdgeCount: 1,
      },
    };
    const staleNoGap: GapNetworkResearchRoutePayload = {
      ...baseDocument,
      id: "gap-stale-no-gap",
      metadata: {
        ...baseMetadata,
        gapNetworkReport: noGapReport,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          updatedAt: "2026-07-01T00:01:00.000Z",
        },
      },
    };
    const legacyNoGap: GapNetworkResearchRoutePayload = {
      ...baseDocument,
      id: "gap-pending-no-gap",
      metadata: {
        ...baseMetadata,
        gapNetworkReport: noGapReport,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          coreEvidence: "citation-semantic-graph-v1",
          updatedAt: "2026-07-01T00:02:00.000Z",
        },
      },
    };
    const currentNoGap: GapNetworkResearchRoutePayload = {
      ...baseDocument,
      id: "gap-current-no-gap",
      metadata: {
        ...baseMetadata,
        gapNetworkReport: noGapReport,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          coreEvidence: GAP_NETWORK_CORE_EVIDENCE_VERSION,
          updatedAt: "2026-07-02T00:01:00.000Z",
        },
      },
    };

    expect(hasCurrentGapNetworkCoreEvidence(staleNoGap.metadata)).toBe(false);
    expect(hasCurrentGapNetworkCoreEvidence(legacyNoGap.metadata)).toBe(false);
    expect(hasCurrentGapNetworkCoreEvidence(currentNoGap.metadata)).toBe(true);
    expect(isGapNetworkViewReadyForDisplay(staleNoGap)).toBe(false);
    expect(isGapNetworkViewReadyForDisplay(currentNoGap)).toBe(true);
  });
});
