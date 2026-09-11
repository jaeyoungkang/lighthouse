import { describe, expect, it } from "vitest";
import {
  researchRoutePayloadMetadataSchema,
  researchRoutePayloadSchema,
} from "@/app/domain/research-route-payload-schema";

function createGapNetworkWirePayload(identity: Record<string, string>) {
  return {
    id: "gap-1",
    type: "gap_network",
    title: "Gap report",
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "agent memory",
      papers: [],
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
        insight: { hypotheses: [] },
      },
    },
    refs: ["search-1"],
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...identity,
  };
}

describe("researchRoutePayloadSchema gap viewer identity", () => {
  it("accepts viewerPrincipalId and rejects the retired ownerPrincipalId alias", () => {
    const current = researchRoutePayloadSchema.safeParse(
      createGapNetworkWirePayload({ viewerPrincipalId: "viewer-1" }),
    );
    const retiredAlias = researchRoutePayloadSchema.safeParse(
      createGapNetworkWirePayload({ ownerPrincipalId: "viewer-1" }),
    );

    expect(current.success).toBe(true);
    expect(retiredAlias.success).toBe(false);
    if (current.success) {
      expect(current.data).not.toHaveProperty("ownerPrincipalId");
      expect(current.data).toHaveProperty("viewerPrincipalId", "viewer-1");
    }
  });
});

describe("researchRoutePayloadMetadataSchema combined search ranking", () => {
  it("preserves separate library evidence and combined ranking weights", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "search",
      query: "agent memory",
      papers: [
        {
          paperId: "501",
          title: "Keyword result",
          abstract: null,
          year: 2024,
          citationCount: 1,
          url: "https://example.com/501",
          authors: [],
        },
      ],
      total: 1,
      sortOption: "interest",
      libraryContext: {
        folders: [{ name: "내 연구" }],
        signalPresent: true,
        interestWeights: {},
        combinedRankWeights: { "501": 0.5 },
        libraryOnlyPaperIds: [],
        rankingMode: "combined_score",
      },
    });

    expect(parsed.type).toBe("search");
    if (parsed.type !== "search") {
      throw new Error("expected search metadata");
    }
    expect(parsed.libraryContext).toMatchObject({
      interestWeights: {},
      combinedRankWeights: { "501": 0.5 },
      rankingMode: "combined_score",
    });
  });

  it("preserves lower-bound provider totals in search paging metadata", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "search",
      query: "agent memory",
      papers: [],
      total: 2,
      totalMode: "lower_bound",
      paging: {
        limit: 1,
        offset: 0,
        returned: 1,
        total: 2,
        totalMode: "lower_bound",
        hasMore: true,
        nextOffset: 1,
      },
    });

    expect(parsed.type).toBe("search");
    if (parsed.type !== "search") {
      throw new Error("expected search metadata");
    }
    expect(parsed.totalMode).toBe("lower_bound");
    expect(parsed.paging?.totalMode).toBe("lower_bound");
  });
});

describe("researchRoutePayloadMetadataSchema library grounding outcome", () => {
  const baseSearch = {
    type: "search" as const,
    query: "agent memory",
    papers: [],
    total: 0,
  };

  it.each([
    { requested: false, status: "not_requested" },
    { requested: true, status: "applied" },
    { requested: true, status: "no_signal" },
    { requested: true, status: "unavailable" },
  ] as const)("preserves the safe tagged state $status", (libraryGrounding) => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      ...baseSearch,
      libraryGrounding,
    });

    expect(parsed.type === "search" ? parsed.libraryGrounding : null).toEqual(libraryGrounding);
  });

  it("keeps legacy absence compatible and strips raw provider detail", () => {
    const legacy = researchRoutePayloadMetadataSchema.parse(baseSearch);
    const unavailable = researchRoutePayloadMetadataSchema.parse({
      ...baseSearch,
      libraryGrounding: {
        requested: true,
        status: "unavailable",
        reason: "circuit-open",
        httpStatus: 503,
      },
    });

    expect(legacy.type === "search" ? legacy.libraryGrounding : null).toBeUndefined();
    expect(unavailable.type === "search" ? unavailable.libraryGrounding : null).toEqual({
      requested: true,
      status: "unavailable",
    });
  });

  it("rejects a no-signal state that claims grounding was not requested", () => {
    expect(
      researchRoutePayloadMetadataSchema.safeParse({
        ...baseSearch,
        libraryGrounding: { requested: false, status: "no_signal" },
      }).success,
    ).toBe(false);
  });
});

describe("researchRoutePayloadMetadataSchema legacy search hydration", () => {
  it("reads historical loaded-result graph support and the active library-anchor v2 shape", () => {
    const baseSearch = {
      type: "search" as const,
      query: "knowledge map",
      papers: [],
      total: 0,
    };
    const historical = researchRoutePayloadMetadataSchema.parse({
      ...baseSearch,
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "empty",
        samplePaperIds: [],
        paperScores: {},
        generatedAt: "2026-06-01T00:00:00.000Z",
      },
    });
    const current = researchRoutePayloadMetadataSchema.parse({
      ...baseSearch,
      graphSupport: {
        version: 2,
        source: "episteme-paper-neighborhood",
        basis: "library_anchor_neighborhood",
        status: "ready",
        anchorPaperCount: 1,
        samplePaperIds: ["301"],
        paperScores: {},
        candidateCounts: {
          providerReturned: 2,
          hydrated: 2,
          keywordOverlap: 1,
          admittedSupplement: 1,
          deferredByQueryRelevance: 0,
          filteredOut: {
            candidateCap: 0,
            hydrationUnavailable: 0,
            publicationYear: 0,
            nonPositiveScore: 0,
            titleFamilyDuplicate: 0,
          },
        },
        generatedAt: "2026-07-14T00:00:00.000Z",
      },
    });

    expect(historical.type === "search" ? historical.graphSupport?.version : null).toBe(1);
    expect(current.type === "search" ? current.graphSupport : null).toMatchObject({
      version: 2,
      basis: "library_anchor_neighborhood",
      anchorPaperCount: 1,
      candidateCounts: { admittedSupplement: 1 },
    });
  });

  it("keeps the share-safe gap graph basis out of ordinary search metadata", () => {
    const gapSupport = {
      version: 2 as const,
      source: "episteme-paper-neighborhood" as const,
      basis: "gap_source_snapshot" as const,
      status: "ready" as const,
      samplePaperIds: [],
      paperScores: {},
      generatedAt: "2026-07-14T00:00:00.000Z",
    };
    const search = researchRoutePayloadMetadataSchema.safeParse({
      type: "search",
      query: "knowledge map",
      papers: [],
      total: 0,
      graphSupport: gapSupport,
    });
    const gapPayload = createGapNetworkWirePayload({ viewerPrincipalId: "viewer-1" });
    const gap = researchRoutePayloadSchema.safeParse({
      ...gapPayload,
      metadata: { ...gapPayload.metadata, sourceGraphSupport: gapSupport },
    });

    expect(search.success).toBe(false);
    expect(gap.success).toBe(true);
  });

  it("strips retired per-paper library feedback from stored search metadata", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "search",
      query: "knowledge map",
      papers: [
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: [{ name: "Author 1" }],
          libraryFeedback: { kind: "library_mismatch" },
        },
      ],
      total: 1,
    });

    expect(parsed.type).toBe("search");
    if (parsed.type !== "search") {
      throw new Error("expected search metadata");
    }

    expect(parsed.papers[0]).not.toHaveProperty("libraryFeedback");
  });

  it("hydrates semanticProfile from legacy inline analysis fields", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "search",
      query: "knowledge map",
      papers: [
        {
          paperId: "p1",
          title: "Paper 1",
          abstract: "Paper 1 abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/p1",
          authors: [{ name: "Author 1" }],
          reviewed: false,
          inlineAnalysis: {
            analysis: {
              summary: "summary",
              objective: "objective",
              methodology: "methodology",
              results: "results",
              keywords: ["topic one", "topic two"],
              confidence: "medium",
              evidenceMap: {},
            },
            source: "abstract",
          },
        },
      ],
      total: 1,
    });

    expect(parsed.type).toBe("search");
    if (parsed.type !== "search") {
      throw new Error("expected search metadata");
    }

    const inlineAnalysis =
      parsed.papers[0] && "inlineAnalysis" in parsed.papers[0]
        ? parsed.papers[0].inlineAnalysis
        : undefined;
    expect(inlineAnalysis?.analysis.semanticProfile).toMatchObject({
      claim: "objective",
      topics: ["topic one", "topic two"],
      method: "methodology",
      finding: "results",
    });
  });
});

describe("researchRoutePayloadMetadataSchema gap_network round-trip", () => {
  it("accepts legacy gap-network core evidence markers while preserving persisted documents", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "AI agents memory",
      papers: [],
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
        insight: { hypotheses: [] },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        coreEvidence: "citation-semantic-graph-v1",
        updatedAt: "2026-04-30T00:00:00.000Z",
      },
    });

    expect(parsed).toMatchObject({
      type: "gap_network",
      gapNetworkBuild: {
        coreEvidence: "citation-semantic-graph-v1",
      },
    });
  });

  it("preserves domainLabel and contentNarrative through schema parse (promise:gap-report-prepared-reaction AC3/AC4)", () => {
    const parsed = researchRoutePayloadMetadataSchema.parse({
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "AI agents memory",
      papers: [],
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
        insight: { hypotheses: [] },
        domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
        contentNarrative: {
          overview: "Memory Systems와 Tool Use 묶음이 분야 안에서 보완 관계를 이루며 분포한다.",
          clusterParagraphs: [
            {
              clusterId: "c0",
              paragraph:
                "Memory Systems는 장기 문맥 기억에 집중하며, 다른 클러스터와 다르게 정보 보존 결을 본다.",
            },
          ],
          gapInferenceParagraph: "클러스터 크기로 기대 교차 연결 수를 추정해 공백을 계산했다.",
        },
      },
      reactionPreparation: {
        overviewReaction: {
          id: "overview",
          title: "연구 공백 리포트",
          body: "본문",
          chips: [],
          timestamp: "2026-04-30T00:00:00.000Z",
        },
        clusterReactions: [],
        gapReactions: [],
        preparedAt: "2026-04-30T00:00:00.000Z",
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        coreEvidence: "citation-semantic-graph-v2",
        updatedAt: "2026-04-30T00:00:00.000Z",
      },
    });

    if (parsed.type !== "gap_network") {
      throw new Error("expected gap_network metadata");
    }

    expect(parsed.gapNetworkReport.domainLabel).toBe("자율 LLM 에이전트와 메모리/검색 보강");
    expect(parsed.gapNetworkReport.contentNarrative).toBeDefined();
    expect(parsed.gapNetworkReport.contentNarrative?.overview).toContain(
      "Memory Systems와 Tool Use",
    );
    expect(parsed.gapNetworkReport.contentNarrative?.clusterParagraphs).toHaveLength(1);
    expect(parsed.gapNetworkReport.contentNarrative?.clusterParagraphs[0]).toEqual({
      clusterId: "c0",
      paragraph:
        "Memory Systems는 장기 문맥 기억에 집중하며, 다른 클러스터와 다르게 정보 보존 결을 본다.",
    });
    expect(parsed.gapNetworkReport.contentNarrative?.gapInferenceParagraph).toContain(
      "기대 교차 연결 수",
    );
    expect(parsed.gapNetworkBuild).toEqual({
      core: "ready",
      enrichment: "ready",
      coreEvidence: "citation-semantic-graph-v2",
      updatedAt: "2026-04-30T00:00:00.000Z",
    });
  });
});
