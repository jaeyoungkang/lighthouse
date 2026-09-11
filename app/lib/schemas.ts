import { z } from "zod";
import { normalizeProviderReadyDifferentPositionCandidates } from "@/app/domain/analysis";

export const SemanticProfileQuotedBasisSchema = z.object({
  claim: z.string().nullable().default(null),
  topics: z.array(z.string()).max(10).default([]),
  method: z.string().nullable().default(null),
  finding: z.string().nullable().default(null),
  conclusion: z.string().nullable().default(null),
});

export const SemanticProfileSchema = z.object({
  claim: z.string().nullable().default(null),
  topics: z.array(z.string()).default([]),
  method: z.string().nullable().default(null),
  finding: z.string().nullable().default(null),
  conclusion: z.string().nullable().default(null),
  quotedBasis: SemanticProfileQuotedBasisSchema.default({
    claim: null,
    topics: [],
    method: null,
    finding: null,
    conclusion: null,
  }),
});

export const DifferentPositionSearchCandidateSchema = z.object({
  query: z.string(),
  rationale: z.string(),
  basis: z.string().nullable().default(null),
});

export const StanceProfileSchema = z.object({
  mainPosition: z.string().nullable().default(null),
  debateAxis: z.string().nullable().default(null),
  limitations: z.string().nullable().default(null),
  counterSearchQueries: z
    .array(DifferentPositionSearchCandidateSchema)
    .default([])
    .transform(normalizeProviderReadyDifferentPositionCandidates),
});

// Gemini AI 분석 응답 스키마
export const GeminiAnalysisSchema = z.object({
  summary: z.string(),
  localizedTitle: z.string().nullable().optional(),
  objective: z.string(),
  methodology: z.string(),
  results: z.string(),
  keywords: z.array(z.string()).min(1).max(10),
  semanticProfile: SemanticProfileSchema,
  stanceProfile: StanceProfileSchema.optional(),
  evidenceMap: z.record(z.string(), z.string()),
});

// Gemini 핵심 논문 제안 응답 스키마
export const KeyPaperSuggestionSchema = z.object({
  suggestions: z
    .array(
      z.object({
        paperId: z.string(),
        reason: z.string(),
      }),
    )
    .min(3)
    .max(5),
});

// Gemini 클러스터링 응답 스키마
export const GeminiClusterSchema = z.object({
  clusters: z.array(
    z.object({
      name: z.string(),
      reason: z.string(),
      anchorConnection: z.string().default(""),
      paperIds: z.array(z.string()),
    }),
  ),
  uncategorized: z.array(z.string()).default([]),
  landscapeOverview: z.string().default(""),
});

// 탐색 연관성 분석 응답 스키마
export const ExploreRelevanceSchema = z.object({
  papers: z.array(
    z.object({
      paperId: z.string(),
      summary: z.string(),
      relevance: z.string(),
    }),
  ),
});

// 종합 분석 응답 스키마
export const SynthesisSectionSchema = z.object({
  content: z.string(),
  paperRefs: z.array(z.string()),
});

export const TopicSynthesisSchema = z.object({
  overview: z.string(),
  researchTrends: SynthesisSectionSchema,
  keyFindings: SynthesisSectionSchema,
  methodologyComparison: SynthesisSectionSchema,
  researchGaps: SynthesisSectionSchema,
});
