import { z } from "zod";
import {
  INLINE_ANALYSIS_VERSION,
  normalizeProviderReadyDifferentPositionCandidates,
} from "@/app/domain/analysis";
import { routeAiCommentSchema } from "@/app/domain/route-ai-comment";

export const researchRouteKindSchema = z.enum([
  "search",
  "gap_network",
  "citation_lineage",
  "graph_neighbors",
]);

export const authorSchema = z.object({
  authorId: z.string().optional(),
  name: z.string(),
});

const citationListAvailabilitySchema = z
  .object({
    available: z.boolean(),
    truncated: z.boolean(),
    total: z.number().nullable().optional(),
    returned: z.number().nullable().optional(),
    reason: z.string().nullable().optional(),
  })
  .nullable()
  .optional();

export const paperCoreSchema = z.object({
  paperId: z.string(),
  title: z.string(),
  abstract: z.string().nullable(),
  year: z.number().nullable(),
  venue: z.string().nullable().optional(),
  fieldsOfStudy: z.array(z.string()).nullable().optional(),
  citationCount: z.number(),
  url: z.string(),
  authors: z.array(authorSchema),
  openAccessPdf: z
    .object({
      url: z.string(),
      status: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  openAccess: z
    .object({
      isOpenAccess: z.boolean(),
      pdfUrl: z.string().nullable().optional(),
      landingUrl: z.string().nullable().optional(),
      source: z.string().nullable().optional(),
      pdfUrlSource: z.string().nullable().optional(),
      license: z.string().nullable().optional(),
      reason: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  source: z
    .object({
      provider: z.string().optional(),
      baseCorpus: z.string().optional(),
      sourceFlags: z
        .union([z.number(), z.string(), z.array(z.string())])
        .nullable()
        .optional(),
      freshnessMode: z.enum(["unknown", "configured", "exact"]).optional(),
      limits: z.array(z.string()).optional(),
      canonicalPaperId: z.string().optional(),
      generation: z.string().optional(),
    })
    .nullable()
    .optional(),
  doi: z.string().nullable().optional(),
  externalIds: z
    .record(z.string(), z.union([z.string(), z.number()]).nullable())
    .nullable()
    .optional(),
  referenceIds: z.array(z.string()).nullable().optional(),
  referenceCount: z.number().nullable().optional(),
  citationIds: z.array(z.string()).nullable().optional(),
  referenceAvailability: citationListAvailabilitySchema,
  citationAvailability: citationListAvailabilitySchema,
});

export const graphPaperSnapshotSchema = paperCoreSchema.extend({});

export const gapNetworkConceptNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  clusterId: z.string(),
  score: z.number(),
  supportingPaperIds: z.array(z.string()).optional(),
});

export const gapNetworkClusterSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
  paperCount: z.number(),
  concepts: z.array(gapNetworkConceptNodeSchema),
  topPaperIds: z.array(z.string()).optional(),
  narrative: z.string().optional(),
});

export const gapNetworkConceptEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  clusterId: z.string(),
  weight: z.number(),
});

export const gapPairSchema = z.object({
  id: z.string(),
  leftClusterId: z.string(),
  rightClusterId: z.string(),
  leftLabel: z.string(),
  rightLabel: z.string(),
  displayLabel: z.string(),
  observed: z.number(),
  expected: z.number(),
  gapScore: z.number(),
  rank: z.number(),
  bridgeConcepts: z.array(z.string()),
  leftConcepts: z.array(z.string()),
  rightConcepts: z.array(z.string()),
});

export const gapHypothesisSchema = z.object({
  id: z.string(),
  gapPairId: z.string(),
  title: z.string(),
  description: z.string(),
  sourceConcept: z.string(),
  targetConcept: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const gapNetworkInsightSchema = z.object({
  hypotheses: z.array(gapHypothesisSchema),
});

export const gapNetworkMetricsSchema = z.object({
  clusterCount: z.number(),
  totalPaperCount: z.number(),
  totalEdgeCount: z.number(),
  gapPairCount: z.number(),
});

const gapNetworkClusterReactionSchema = z.object({
  clusterId: z.string(),
  reaction: routeAiCommentSchema,
  nearestGapLabel: z.string().optional(),
  representativePaperTitles: z.array(z.string()).optional(),
  narrative: z.string().optional(),
});

const gapHypothesisProposalSchema = z.object({
  hypothesis: z.string(),
  grounding: z.string(),
});

const gapNetworkGapReactionSchema = z.object({
  gapPairId: z.string(),
  reaction: routeAiCommentSchema,
  metaQualitative: z.string().optional(),
  proposals: z.array(gapHypothesisProposalSchema).min(1).max(3).optional(),
});

const gapNetworkReactionPreparationSchema = z.object({
  overviewReaction: routeAiCommentSchema,
  clusterReactions: z.array(gapNetworkClusterReactionSchema),
  gapReactions: z.array(gapNetworkGapReactionSchema),
  preparedAt: z.string(),
});

const gapNetworkClusterParagraphSchema = z.object({
  clusterId: z.string(),
  paragraph: z.string(),
});

const gapNetworkContentNarrativeSchema = z.object({
  overview: z.string(),
  clusterParagraphs: z.array(gapNetworkClusterParagraphSchema),
  gapInferenceParagraph: z.string(),
});

const gapNetworkBuildStateSchema = z.object({
  core: z.enum(["pending", "ready", "failed"]),
  enrichment: z.enum(["pending", "ready", "failed"]),
  updatedAt: z.string(),
  coreEvidence: z.enum(["citation-semantic-graph-v1", "citation-semantic-graph-v2"]).optional(),
  phase: z
    .enum(["queued", "graph-support", "core-build", "persist", "enrichment", "complete", "failed"])
    .optional(),
  attempt: z.number().int().nonnegative().optional(),
  enrichmentRetryCount: z.number().int().nonnegative().optional(),
  leaseExpiresAt: z.string().optional(),
  phaseDurationsMs: z
    .object({
      "graph-support": z.number().nonnegative().optional(),
      "core-build": z.number().nonnegative().optional(),
      persist: z.number().nonnegative().optional(),
      enrichment: z.number().nonnegative().optional(),
    })
    .optional(),
});

export const gapNetworkReportSchema = z.object({
  clusters: z.array(gapNetworkClusterSchema),
  conceptEdges: z.array(gapNetworkConceptEdgeSchema),
  gapPairs: z.array(gapPairSchema),
  metrics: gapNetworkMetricsSchema,
  insight: gapNetworkInsightSchema,
  domainLabel: z.string().optional(),
  contentNarrative: gapNetworkContentNarrativeSchema.optional(),
});

const semanticProfileSchema = z.object({
  claim: z.string().nullable().default(null),
  topics: z.array(z.string()).default([]),
  method: z.string().nullable().default(null),
  finding: z.string().nullable().default(null),
  conclusion: z.string().nullable().default(null),
  quotedBasis: z
    .object({
      claim: z.string().nullable().default(null),
      topics: z.array(z.string()).default([]),
      method: z.string().nullable().default(null),
      finding: z.string().nullable().default(null),
      conclusion: z.string().nullable().default(null),
    })
    .default({
      claim: null,
      topics: [],
      method: null,
      finding: null,
      conclusion: null,
    }),
});

const stanceProfileSchema = z
  .object({
    mainPosition: z.string().nullable().default(null),
    debateAxis: z.string().nullable().default(null),
    limitations: z.string().nullable().default(null),
    counterSearchQueries: z
      .array(
        z.object({
          query: z.string(),
          rationale: z.string(),
          basis: z.string().nullable().default(null),
        }),
      )
      .default([])
      .transform(normalizeProviderReadyDifferentPositionCandidates),
  })
  .default({
    mainPosition: null,
    debateAxis: null,
    limitations: null,
    counterSearchQueries: [],
  });

export const analysisSchema = z
  .object({
    summary: z.string(),
    localizedTitle: z.string().nullable().optional(),
    objective: z.string(),
    methodology: z.string(),
    results: z.string(),
    keywords: z.array(z.string()),
    semanticProfile: semanticProfileSchema.optional(),
    stanceProfile: stanceProfileSchema.optional(),
    confidence: z.enum(["high", "medium", "low"]),
    evidenceMap: z.record(z.string(), z.string()),
  })
  .transform((analysis) => ({
    ...analysis,
    semanticProfile: analysis.semanticProfile ?? {
      claim: analysis.objective || analysis.summary,
      topics: analysis.keywords,
      method: analysis.methodology || null,
      finding: analysis.results || null,
      conclusion: null,
      quotedBasis: {
        claim: null,
        topics: [],
        method: null,
        finding: null,
        conclusion: null,
      },
    },
    stanceProfile: analysis.stanceProfile ?? {
      mainPosition: null,
      debateAxis: null,
      limitations: null,
      counterSearchQueries: [],
    },
  }));

export const inlineAnalysisCacheSchema = z.object({
  version: z
    .number()
    .int()
    .default(INLINE_ANALYSIS_VERSION - 1),
  inputFingerprint: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  analysis: analysisSchema,
  // Stored rows may carry retired source values; normalize them instead of
  // failing the whole route payload row parse (mirrors paper-inline-analysis-cache).
  source: z
    .string()
    .nullable()
    .optional()
    .transform((source) => (source === "abstract" ? ("abstract" as const) : undefined)),
});

export const searchPaperSchema = paperCoreSchema.extend({
  reviewed: z.boolean().optional(),
  reviewedAt: z.string().optional(),
  inlineAnalysis: inlineAnalysisCacheSchema.optional(),
});

const searchQueryClauseSchema = z.object({
  rawClause: z.string(),
  normalizedClause: z.string(),
  role: z.enum(["anchor", "theme", "constraint", "other"]),
  isExtractive: z.boolean(),
  derivedExpansions: z.array(z.string()),
});

const searchQueryClauseStatSchema = z.object({
  clause: z.string(),
  role: z.enum(["anchor", "theme", "constraint", "other"]),
  total: z.number(),
  fetched: z.number(),
  providerWindow: z
    .object({
      totalMode: z
        .enum(["exact", "merged", "candidate_window", "estimated", "lower_bound", "not_computed"])
        .optional(),
      hasMore: z.boolean(),
      nextCursor: z.string().nullable().optional(),
      generation: z.string().optional(),
      completenessStatus: z.enum(["complete", "bounded", "estimated", "unavailable"]).optional(),
      currencyState: z.enum(["current", "mixed", "missing"]).optional(),
      totalCoverage: z
        .object({
          full: z.boolean(),
          indexed: z.number().int().nullable().optional(),
          eligible: z.number().int().nullable().optional(),
          generation: z.string(),
        })
        .optional(),
    })
    .optional(),
});

const englishTermCandidateTypeSchema = z.enum(["direct", "broader", "narrower", "variant"]);

const englishTermCandidateSchema = z.object({
  term: z.string(),
  type: englishTermCandidateTypeSchema,
  confidence: z.enum(["high", "medium", "low"]),
  supportCount: z.number(),
  methodSupportCount: z.number().optional(),
  graphSupportCount: z.number().optional(),
  supportPaperIds: z.array(z.string()).optional(),
  samplePaperIds: z.array(z.string()),
  basis: z.string(),
});

const searchGraphSupportPaperScoreSchema = z.object({
  defaultScore: z.number(),
  graphScore: z.number().nullable(),
  semanticScore: z.number().nullable(),
  sharedCiters: z.number().nullable(),
  sharedRefs: z.number().nullable(),
  seedCount: z.number().nullable(),
  sources: z.array(z.string()),
});

const searchGraphSupportMetadataV1Schema = z.object({
  version: z.literal(1),
  source: z.literal("episteme-paper-neighborhood"),
  basis: z.literal("loaded_result_sample"),
  status: z.enum(["ready", "empty"]),
  samplePaperIds: z.array(z.string()),
  paperScores: z.record(z.string(), searchGraphSupportPaperScoreSchema),
  generatedAt: z.string(),
});

const searchLibraryGraphCandidateCountsSchema = z.object({
  providerReturned: z.number().int().nonnegative(),
  hydrated: z.number().int().nonnegative(),
  keywordOverlap: z.number().int().nonnegative(),
  admittedSupplement: z.number().int().nonnegative(),
  deferredByQueryRelevance: z.number().int().nonnegative(),
  filteredOut: z.object({
    candidateCap: z.number().int().nonnegative(),
    hydrationUnavailable: z.number().int().nonnegative(),
    publicationYear: z.number().int().nonnegative(),
    nonPositiveScore: z.number().int().nonnegative(),
    titleFamilyDuplicate: z.number().int().nonnegative(),
  }),
});

const searchLibraryGraphSupportMetadataSchema = z.object({
  version: z.literal(2),
  source: z.literal("episteme-paper-neighborhood"),
  basis: z.literal("library_anchor_neighborhood"),
  status: z.enum(["ready", "empty"]),
  anchorPaperCount: z.number().int().nonnegative(),
  samplePaperIds: z.array(z.string()),
  paperScores: z.record(z.string(), searchGraphSupportPaperScoreSchema),
  candidateCounts: searchLibraryGraphCandidateCountsSchema,
  generatedAt: z.string(),
});

const graphNeighborSnapshotSupportMetadataSchema = z.object({
  version: z.literal(2),
  source: z.literal("episteme-paper-neighborhood"),
  basis: z.literal("graph_neighbor_snapshot"),
  status: z.enum(["ready", "empty"]),
  samplePaperIds: z.array(z.string()),
  paperScores: z.record(z.string(), searchGraphSupportPaperScoreSchema),
  generatedAt: z.string(),
});

const gapSourceSnapshotSupportMetadataSchema = z.object({
  version: z.literal(2),
  source: z.literal("episteme-paper-neighborhood"),
  basis: z.literal("gap_source_snapshot"),
  status: z.enum(["ready", "empty"]),
  samplePaperIds: z.array(z.string()),
  paperScores: z.record(z.string(), searchGraphSupportPaperScoreSchema),
  generatedAt: z.string(),
});

export const searchGraphSupportMetadataSchema = z.union([
  searchGraphSupportMetadataV1Schema,
  searchLibraryGraphSupportMetadataSchema,
  graphNeighborSnapshotSupportMetadataSchema,
]);

const gapNetworkGraphSupportMetadataSchema = z.union([
  searchGraphSupportMetadataV1Schema,
  gapSourceSnapshotSupportMetadataSchema,
]);

const searchTermDiscoveryStateSchema = z.object({
  status: z.enum(["pending", "ready"]),
  source: z
    .enum(["llm", "deterministic_fallback"])
    .optional()
    .transform((source) => (source === "llm" ? source : undefined)),
  inlineAnalysisApplied: z
    .boolean()
    .optional()
    .transform(() => undefined),
  generatedAt: z.string().optional(),
});

const searchFacetFiltersSchema = z.object({
  fieldsOfStudy: z.array(z.string()),
  authors: z.array(z.string()),
  venues: z.array(z.string()),
  hasPdf: z.boolean(),
});

const searchAbstractHydrationStatusSchema = z.object({
  status: z.enum(["pending", "ready"]),
  personalize: z.boolean().optional(),
  libraryBlendPolicy: z.enum(["first_reveal_only"]).optional(),
  libraryPaperIds: z.array(z.string()).optional(),
  repairAttempted: z.boolean().optional(),
  requestedSort: z.enum(["relevance", "citationCount", "year", "yearAsc", "interest"]).optional(),
});

const searchTermSeedSchema = z.object({
  sourceQuery: z.string(),
  term: z.string(),
  candidateType: englishTermCandidateTypeSchema,
  supportCount: z.number(),
});

export const searchMetadataSchema = z.object({
  type: z.literal("search"),
  query: z.string(),
  sortOption: z.enum(["relevance", "citationCount", "year", "yearAsc", "interest"]).optional(),
  libraryContext: z
    .object({
      folders: z.array(z.object({ name: z.string() })),
      signalPresent: z.boolean(),
      interestWeights: z.record(z.string(), z.number()),
      combinedRankWeights: z.record(z.string(), z.number()).optional(),
      rankingMode: z.literal("combined_score").optional(),
      libraryOnlyPaperIds: z.array(z.string()).optional(),
      computedAt: z.string().optional(),
      anchorPaperCount: z.number().optional(),
    })
    .optional(),
  libraryContextAvailable: z.boolean().optional(),
  libraryGrounding: z
    .discriminatedUnion("requested", [
      z.object({
        requested: z.literal(false),
        status: z.literal("not_requested"),
      }),
      z.object({
        requested: z.literal(true),
        status: z.enum(["applied", "no_signal", "unavailable"]),
      }),
    ])
    .optional(),
  searchIntentMode: z.enum(["balanced", "foundational", "latest", "applied"]).optional(),
  yearFilter: z.string().optional(),
  facetFilters: searchFacetFiltersSchema.optional(),
  spellingCorrection: z
    .object({
      originalQuery: z.string(),
      correctedQuery: z.string(),
    })
    .optional(),
  exactLookup: z
    .object({
      kind: z.literal("doi"),
      value: z.string(),
    })
    .optional(),
  seedPaper: paperCoreSchema.optional(),
  termSeed: searchTermSeedSchema.optional(),
  englishTermCandidates: z.array(englishTermCandidateSchema).optional(),
  englishTermDiscovery: searchTermDiscoveryStateSchema.optional(),
  abstractHydration: searchAbstractHydrationStatusSchema.optional(),
  graphSupport: searchGraphSupportMetadataSchema.optional(),
  queryClauses: z.array(searchQueryClauseSchema).optional(),
  papers: z.array(searchPaperSchema),
  total: z.number(),
  totalMode: z
    .enum(["exact", "merged", "candidate_window", "estimated", "lower_bound", "not_computed"])
    .optional(),
  paging: z
    .object({
      limit: z.number(),
      offset: z.number(),
      returned: z.number(),
      total: z.number().nullable().optional(),
      totalMode: z.enum(["candidate_window", "estimated", "exact", "lower_bound", "not_computed"]),
      hasMore: z.boolean(),
      nextOffset: z.number().nullable().optional(),
      nextCursor: z.string().nullable().optional(),
    })
    .optional(),
  source: z
    .object({
      provider: z.string().optional(),
      baseCorpus: z.string().optional(),
      sourceFlags: z
        .union([z.number(), z.string(), z.array(z.string())])
        .nullable()
        .optional(),
      canonicalPaperId: z.string().optional(),
      dumpDate: z.string().nullable().optional(),
      indexedAt: z.string().nullable().optional(),
      freshnessMode: z.enum(["unknown", "configured", "exact"]).optional(),
      searchBasis: z.array(z.string()).optional(),
      limits: z.array(z.string()).optional(),
      generation: z.string().optional(),
      completenessStatus: z.enum(["complete", "bounded", "estimated", "unavailable"]).optional(),
      coverage: z
        .object({
          full: z.boolean(),
          indexed: z.number().int().nullable().optional(),
          eligible: z.number().int().nullable().optional(),
          generation: z.string(),
        })
        .optional(),
      totalCoverage: z
        .object({
          full: z.boolean(),
          indexed: z.number().int().nullable().optional(),
          eligible: z.number().int().nullable().optional(),
          generation: z.string(),
        })
        .optional(),
      currencyState: z.enum(["current", "mixed", "missing"]).optional(),
      retrievalGeneration: z.string().optional(),
      projectionGenerations: z.array(z.number().int()).optional(),
      elapsedMs: z.number().int().nonnegative().optional(),
    })
    .nullable()
    .optional(),
  clauseStats: z.array(searchQueryClauseStatSchema).optional(),
});

const graphNeighborPaperEntrySchema = z.object({
  shared: z.number(),
  paper: searchPaperSchema,
});

const citationLineageMetadataSchema = z.object({
  type: z.literal("citation_lineage"),
  seedPaper: paperCoreSchema,
  referenceIds: z.array(z.string()),
  citationIds: z.array(z.string()),
  papers: z.array(searchPaperSchema),
  total: z.number(),
  referenceAvailability: paperCoreSchema.shape.referenceAvailability,
  citationAvailability: paperCoreSchema.shape.citationAvailability,
});

export const graphNeighborsMetadataSchema = z.object({
  type: z.literal("graph_neighbors"),
  seedPaper: paperCoreSchema,
  papers: z.array(searchPaperSchema),
  total: z.number(),
  coCited: z.array(graphNeighborPaperEntrySchema),
  coupled: z.array(graphNeighborPaperEntrySchema),
  graphLoadFailed: z.boolean().optional(),
  cardDataHydration: z
    .object({
      status: z.enum(["pending", "ready"]),
    })
    .optional(),
  coCitedAvailability: paperCoreSchema.shape.citationAvailability,
  coupledAvailability: paperCoreSchema.shape.citationAvailability,
});

export const gapNetworkMetadataSchema = z.object({
  type: z.literal("gap_network"),
  version: z.literal(1),
  sourceSnapshotId: z.string(),
  query: z.string(),
  papers: z.array(graphPaperSnapshotSchema),
  sourceGraphSupport: gapNetworkGraphSupportMetadataSchema.optional(),
  gapNetworkReport: gapNetworkReportSchema,
  reactionPreparation: gapNetworkReactionPreparationSchema.optional(),
  gapNetworkBuild: gapNetworkBuildStateSchema.optional(),
  sourceCitationLineageBreakdown: z
    .object({
      references: z.number(),
      citations: z.number(),
    })
    .optional(),
});

export const researchRoutePayloadMetadataSchema = z.union([
  searchMetadataSchema,
  gapNetworkMetadataSchema,
  citationLineageMetadataSchema,
  graphNeighborsMetadataSchema,
]);

const researchRoutePayloadBaseShape = {
  id: z.string(),
  title: z.string(),
  content: z.string(),
  createdBy: z.enum(["user", "agent"]),
  reaction: routeAiCommentSchema.nullable().optional(),
  reactionHistory: z.array(routeAiCommentSchema).optional(),
  refs: z.array(z.string()),
  // 서버 소유 lifecycle/version 필드. 누락 payload(이전 캐시 등)는 기본값으로 채워
  // required 타입을 만족시킨다 — repository `documentRowSchema`와 동일한 tolerance.
  status: z.enum(["pending", "ready", "failed"]).default("ready"),
  version: z.number().default(0),
  reactionVersion: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
};

const searchResearchRoutePayloadSchema = z.object({
  ...researchRoutePayloadBaseShape,
  type: z.literal("search"),
  metadata: searchMetadataSchema,
  ownerPrincipalId: z.string(),
});

const citationLineageResearchRoutePayloadSchema = z.object({
  ...researchRoutePayloadBaseShape,
  type: z.literal("citation_lineage"),
  metadata: citationLineageMetadataSchema,
  ownerPrincipalId: z.string(),
});

const graphNeighborsResearchRoutePayloadSchema = z.object({
  ...researchRoutePayloadBaseShape,
  type: z.literal("graph_neighbors"),
  metadata: graphNeighborsMetadataSchema,
  ownerPrincipalId: z.string(),
});

const gapNetworkResearchRoutePayloadSchema = z
  .object({
    ...researchRoutePayloadBaseShape,
    type: z.literal("gap_network"),
    metadata: gapNetworkMetadataSchema,
    viewerPrincipalId: z.string(),
  })
  .strict();

export const researchRoutePayloadSchema = z.discriminatedUnion("type", [
  searchResearchRoutePayloadSchema,
  gapNetworkResearchRoutePayloadSchema,
  citationLineageResearchRoutePayloadSchema,
  graphNeighborsResearchRoutePayloadSchema,
]);
