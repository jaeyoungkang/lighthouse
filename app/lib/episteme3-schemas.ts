import { z } from "zod";

export const Episteme3IdentifierSchema = z.object({
  namespace: z.string(),
  value: z.string(),
});

const Episteme3CurrencySchema = z.object({
  generation: z.number().default(0),
  state: z.enum(["current", "partial"]).default("current"),
});

const Episteme3SemanticCoverageSchema = z.object({
  indexed_papers: z.number().int(),
  corpus_papers: z.number().int(),
  ratio: z.number(),
  model_id: z.string(),
  generation: z.string(),
});

const Episteme3SearchCoverageValueSchema = z.object({
  full: z.boolean(),
  indexed: z.number().int().nullable().optional(),
  eligible: z.number().int().nullable().optional(),
  generation: z.string(),
});

const Episteme3SearchCoverageSchema = z.object({
  paper: Episteme3SearchCoverageValueSchema,
  semantic: Episteme3SemanticCoverageSchema.nullable().optional(),
});

const Episteme3SearchCurrencySchema = z.object({
  retrieval_generation: z.string(),
  projection_generations: z.array(z.number().int()).optional(),
  state: z.enum(["current", "mixed", "missing"]),
});

export const Episteme3CompletenessSchema = z.object({
  status: z.enum(["complete", "bounded", "estimated", "unavailable"]),
  generations: z.record(z.string(), z.string()).optional(),
  indexed: z.number().nullable().optional(),
  eligible: z.number().nullable().optional(),
  incomplete_reasons: z.array(z.string()).default([]),
});

export const Episteme3PaperCardSchema = z.object({
  paper_uid: z.string(),
  projection: z.enum(["compact", "standard", "rich"]).default("rich"),
  omitted_fields: z.array(z.string()).default([]),
  title: z.string().nullable().optional(),
  abstract: z.string().nullable().optional(),
  abstract_snippet: z.string().nullable().optional(),
  publication_year: z.number().int().nullable().optional(),
  venue: z.object({ name: z.string().nullable().optional() }).nullable().optional(),
  publication_venue: z.string().nullable().optional(),
  authors: z
    .array(
      z.object({
        person_uid: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        identifiers: z.array(Episteme3IdentifierSchema).default([]),
      }),
    )
    .default([]),
  fields_of_study: z.array(z.string()).default([]),
  identifiers: z.array(Episteme3IdentifierSchema).default([]),
  source_memberships: z.array(z.string()).default([]),
  has_pdf: z.boolean().default(false),
  has_open_access_location: z.boolean().default(false),
  access_url: z.string().nullable().optional(),
  best_open_pdf: z.string().nullable().optional(),
  best_landing_page: z.string().nullable().optional(),
  citation_count: z.number().int().default(0),
  reference_count: z.number().int().default(0),
  relevance: z.number().nullable().optional(),
  currency: Episteme3CurrencySchema,
});

const Episteme3PageSchema = z.object({
  generation: z.string(),
  next_cursor: z.string().nullable().optional(),
  size: z.number().int(),
});

export const Episteme3SearchResponseSchema = z.object({
  items: z.array(Episteme3PaperCardSchema),
  next_cursor: z.string().nullable().optional(),
  total: z
    .object({
      value: z.number().int().nullable(),
      relation: z.enum(["exact", "estimated", "bounded", "unavailable"]),
      basis: z.enum([
        "filtered_corpus",
        "lexical_candidates",
        "lexical_matches",
        "semantic_candidates",
        "hybrid_candidates",
      ]),
      coverage: Episteme3SearchCoverageValueSchema,
      incomplete_reasons: z.array(z.string()).default([]),
    })
    .nullable()
    .optional(),
  coverage: Episteme3SearchCoverageSchema,
  currency: Episteme3SearchCurrencySchema,
  elapsed_ms: z.number().int().nonnegative(),
  page: Episteme3PageSchema,
  completeness: Episteme3CompletenessSchema,
});

export const Episteme3BatchResponseSchema = z.object({
  items: z.array(
    z.object({
      resolution: z.object({ input_ref: z.string() }).loose(),
      paper: Episteme3PaperCardSchema,
    }),
  ),
  unresolved: z.array(z.object({ input_ref: z.string() }).loose()).default([]),
  completeness: Episteme3CompletenessSchema,
});

export const Episteme3CitationPageSchema = z.object({
  paper_uid: z.string(),
  direction: z.enum(["cites", "cited_by"]),
  items: z.array(
    z.object({
      source_paper_uid: z.string(),
      target_paper_uid: z.string(),
      relation: z.literal("citation").default("citation"),
      paper: Episteme3PaperCardSchema.nullable().optional(),
    }),
  ),
  next_cursor: z.string().nullable().optional(),
  total: z.number().int(),
  total_relation: z.literal("exact").default("exact"),
  graph_generation: z.string(),
  page: Episteme3PageSchema,
  completeness: Episteme3CompletenessSchema,
});

export const Episteme3DiscoveryResponseSchema = z.object({
  seeds: z.array(z.object({ input_ref: z.string(), status: z.string() }).loose()),
  unresolved: z.array(z.object({ input_ref: z.string(), status: z.string() }).loose()).optional(),
  items: z.array(
    z.object({
      paper: Episteme3PaperCardSchema,
      rank: z.number().int(),
      fusion_score: z.number(),
      evidence: z.array(
        z.object({
          retriever: z.enum([
            "direct_citation",
            "co_citation",
            "bibliographic_coupling",
            "semantic",
          ]),
          seed_paper_uid: z.string().nullable().optional(),
          raw_signal: z.number().nonnegative(),
          normalized_signal: z.number().min(0).max(1),
        }),
      ),
    }),
  ),
  coverage: z.object({
    graph_generation: z.string(),
    paper_generation: z.string(),
    semantic_coverage: Episteme3SemanticCoverageSchema.nullable().optional(),
    semantic_calibration_id: z.string().nullable().optional(),
    semantic_min_similarity: z.number().nullable().optional(),
    retrievers: z.array(
      z.object({
        retriever: z.enum(["direct_citation", "co_citation", "bibliographic_coupling", "semantic"]),
        state: z.enum(["complete", "bounded", "unavailable"]),
        generation: z.string(),
        examined: z.number().int().nonnegative(),
        candidates: z.number().int().nonnegative(),
        truncated: z.boolean(),
        incomplete_reasons: z.array(z.string()).optional(),
      }),
    ),
    incomplete_reasons: z.array(z.string()).optional(),
  }),
  fusion: z.object({
    strategy: z.literal("normalized_weighted_sum").default("normalized_weighted_sum"),
    version: z.literal("paper-discovery-v1").default("paper-discovery-v1"),
    quality: z.enum(["fast", "balanced", "thorough"]),
  }),
  elapsed_ms: z.number().int().nonnegative(),
  completeness: Episteme3CompletenessSchema,
});
