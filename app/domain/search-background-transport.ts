import { z } from "zod";
import type {
  EnglishTermCandidate,
  SearchMetadata,
  SearchTermDiscoveryState,
} from "@/app/domain/research-route-payload";
import type { SemanticProfile } from "@/app/domain/analysis";
import { searchPaperSchema } from "@/app/domain/research-route-payload-schema";
import { SEARCH_INGRESS_QUERY_MAX_CHARS } from "@/app/domain/search-metadata-ingress";
import { MAX_SEARCH_QUERY_CLAUSES } from "@/app/lib/search-query";
import {
  SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS,
  SEARCH_RESULT_POOL_PAPER_LIMIT,
  TERM_CANDIDATE_LLM_PAPER_LIMIT,
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_PROMPT_FIELD_CHARS,
} from "@/app/lib/constants";
import {
  hasUsableInlineAnalysisAbstract,
  normalizeInlineAnalysisInputText,
} from "@/app/lib/inline-analysis";

export const SEARCH_BACKGROUND_COMMAND_VERSION = 1 as const;
export const SEARCH_BACKGROUND_QUERY_MAX_CHARS = SEARCH_INGRESS_QUERY_MAX_CHARS;
export const SEARCH_BACKGROUND_TERM_CANDIDATE_LIMIT = 8;
export const SEARCH_BACKGROUND_TERM_MAX_CHARS = 48;
export const SEARCH_BACKGROUND_TERM_BASIS_MAX_CHARS = 2_000;

const boundedQuerySchema = z.string().trim().min(1).max(SEARCH_BACKGROUND_QUERY_MAX_CHARS);
const paperIdSchema = z.string().min(1).max(SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS);

function addUniqueArrayIssue(
  values: readonly string[],
  context: z.RefinementCtx,
  path: PropertyKey[],
  label: string,
): void {
  if (new Set(values).size === values.length) return;
  context.addIssue({ code: "custom", path, message: `${label} must contain unique values` });
}

export const searchBackgroundSnapshotTargetSchema = z
  .object({
    query: boundedQuerySchema,
    orderedPaperIds: z.array(paperIdSchema).max(SEARCH_RESULT_POOL_PAPER_LIMIT),
  })
  .strict()
  .superRefine((target, context) => {
    addUniqueArrayIssue(target.orderedPaperIds, context, ["orderedPaperIds"], "orderedPaperIds");
  });

export const searchEnrichmentCommandV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: searchBackgroundSnapshotTargetSchema,
    hydration: z
      .object({
        status: z.enum(["pending", "ready"]),
        repairAttempted: z.boolean().optional(),
        libraryOnlyPaperIds: z.array(paperIdSchema).max(SEARCH_RESULT_POOL_PAPER_LIMIT),
      })
      .strict(),
  })
  .strict()
  .superRefine((command, context) => {
    addUniqueArrayIssue(
      command.hydration.libraryOnlyPaperIds,
      context,
      ["hydration", "libraryOnlyPaperIds"],
      "libraryOnlyPaperIds",
    );
    const targetIds = new Set(command.target.orderedPaperIds);
    command.hydration.libraryOnlyPaperIds.forEach((paperId, index) => {
      if (targetIds.has(paperId)) return;
      context.addIssue({
        code: "custom",
        path: ["hydration", "libraryOnlyPaperIds", index],
        message: "libraryOnlyPaperIds must be a subset of orderedPaperIds",
      });
    });
  });

export const searchSpellingCorrectionCommandV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: z.object({ query: boundedQuerySchema }).strict(),
  })
  .strict();

export const searchTermDiscoveryPaperV1Schema = z
  .object({
    paperId: paperIdSchema,
    title: z.string().max(TERM_CANDIDATE_PROMPT_FIELD_CHARS),
    abstract: z.string().max(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS).nullable(),
    year: z.number().int().nullable(),
    inputFingerprint: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict()
  .superRefine((paper, context) => {
    const needsFingerprint = hasUsableInlineAnalysisAbstract(paper.abstract);
    if (needsFingerprint === (paper.inputFingerprint != null)) return;
    context.addIssue({
      code: "custom",
      path: ["inputFingerprint"],
      message: needsFingerprint
        ? "inputFingerprint is required for analyzable abstracts"
        : "inputFingerprint requires an analyzable abstract",
    });
  });

const projectedQueryClauseSchema = z
  .object({
    normalizedClause: z.string().max(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    derivedExpansions: z
      .array(z.string().max(SEARCH_BACKGROUND_QUERY_MAX_CHARS))
      .max(MAX_SEARCH_QUERY_CLAUSES),
  })
  .strict();

export const searchTermDiscoveryCommandV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: searchBackgroundSnapshotTargetSchema,
    promptPapers: z.array(searchTermDiscoveryPaperV1Schema).max(TERM_CANDIDATE_LLM_PAPER_LIMIT),
    queryClauses: z.array(projectedQueryClauseSchema).max(MAX_SEARCH_QUERY_CLAUSES),
    graphSupportedPaperIds: z.array(paperIdSchema).max(TERM_CANDIDATE_LLM_PAPER_LIMIT),
  })
  .strict()
  .superRefine((command, context) => {
    const targetIds = new Set(command.target.orderedPaperIds);
    const promptPaperIds = command.promptPapers.map((paper) => paper.paperId);
    addUniqueArrayIssue(promptPaperIds, context, ["promptPapers"], "promptPapers.paperId");
    addUniqueArrayIssue(
      command.graphSupportedPaperIds,
      context,
      ["graphSupportedPaperIds"],
      "graphSupportedPaperIds",
    );
    promptPaperIds.forEach((paperId, index) => {
      if (targetIds.has(paperId)) return;
      context.addIssue({
        code: "custom",
        path: ["promptPapers", index, "paperId"],
        message: "promptPapers must be a subset of orderedPaperIds",
      });
    });
    const promptIds = new Set(promptPaperIds);
    command.graphSupportedPaperIds.forEach((paperId, index) => {
      if (promptIds.has(paperId)) return;
      context.addIssue({
        code: "custom",
        path: ["graphSupportedPaperIds", index],
        message: "graphSupportedPaperIds must be a subset of promptPapers",
      });
    });
  });

const abstractHydrationDeltaSchema = z
  .object({
    status: z.literal("ready"),
    repairAttempted: z.boolean().optional(),
  })
  .strict();

const searchEnrichmentPaperDeltaShape = {
  paperId: paperIdSchema,
  abstract: searchPaperSchema.shape.abstract.optional(),
  venue: searchPaperSchema.shape.venue.optional(),
  fieldsOfStudy: searchPaperSchema.shape.fieldsOfStudy.optional(),
  authors: searchPaperSchema.shape.authors.optional(),
  openAccessPdf: searchPaperSchema.shape.openAccessPdf.optional(),
  openAccess: searchPaperSchema.shape.openAccess.optional(),
  source: searchPaperSchema.shape.source.optional(),
  doi: searchPaperSchema.shape.doi.optional(),
  externalIds: searchPaperSchema.shape.externalIds.optional(),
  referenceIds: searchPaperSchema.shape.referenceIds.optional(),
  referenceCount: searchPaperSchema.shape.referenceCount.optional(),
  citationIds: searchPaperSchema.shape.citationIds.optional(),
  referenceAvailability: searchPaperSchema.shape.referenceAvailability.optional(),
  citationAvailability: searchPaperSchema.shape.citationAvailability.optional(),
};

export const searchEnrichmentPaperDeltaSchema = z.object(searchEnrichmentPaperDeltaShape).strict();
const searchEnrichmentPaperProjectorSchema = z.object(searchEnrichmentPaperDeltaShape);

export const searchEnrichmentDeltaResponseV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: searchBackgroundSnapshotTargetSchema,
    delta: z
      .object({
        papers: z.array(searchEnrichmentPaperDeltaSchema).max(SEARCH_RESULT_POOL_PAPER_LIMIT),
        abstractHydration: abstractHydrationDeltaSchema,
      })
      .strict(),
    updatedAt: z.string(),
  })
  .strict()
  .superRefine((response, context) => {
    const targetIds = new Set(response.target.orderedPaperIds);
    const paperIds = response.delta.papers.map((paper) => paper.paperId);
    addUniqueArrayIssue(paperIds, context, ["delta", "papers"], "delta.papers.paperId");
    paperIds.forEach((paperId, index) => {
      if (targetIds.has(paperId)) return;
      context.addIssue({
        code: "custom",
        path: ["delta", "papers", index, "paperId"],
        message: "delta papers must be a subset of target orderedPaperIds",
      });
    });
  });

const spellingCorrectionSchema = z
  .object({
    originalQuery: boundedQuerySchema,
    correctedQuery: boundedQuerySchema,
  })
  .strict();

export const searchSpellingCorrectionDeltaResponseV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: z.object({ query: boundedQuerySchema }).strict(),
    delta: z.object({ spellingCorrection: spellingCorrectionSchema.nullable() }).strict(),
    updatedAt: z.string(),
  })
  .strict()
  .superRefine((response, context) => {
    if (
      response.delta.spellingCorrection &&
      response.delta.spellingCorrection.originalQuery !== response.target.query
    ) {
      context.addIssue({
        code: "custom",
        path: ["delta", "spellingCorrection", "originalQuery"],
        message: "spelling correction originalQuery must match the target query",
      });
    }
  });

const englishTermCandidateSchema = z.object({
  term: z.string().min(1).max(SEARCH_BACKGROUND_TERM_MAX_CHARS),
  type: z.enum(["direct", "broader", "narrower", "variant"]),
  confidence: z.enum(["high", "medium", "low"]),
  supportCount: z.number().int().nonnegative().max(TERM_CANDIDATE_LLM_PAPER_LIMIT),
  methodSupportCount: z.number().int().nonnegative().max(TERM_CANDIDATE_LLM_PAPER_LIMIT).optional(),
  graphSupportCount: z.number().int().nonnegative().max(TERM_CANDIDATE_LLM_PAPER_LIMIT).optional(),
  supportPaperIds: z.array(paperIdSchema).max(TERM_CANDIDATE_LLM_PAPER_LIMIT).optional(),
  samplePaperIds: z.array(paperIdSchema).max(3),
  basis: z.string().max(SEARCH_BACKGROUND_TERM_BASIS_MAX_CHARS),
});

const searchTermDiscoveryStateSchema = z.object({
  status: z.literal("ready"),
  source: z.literal("llm"),
  generatedAt: z.string(),
});

export const searchTermDiscoveryDeltaResponseV1Schema = z
  .object({
    schemaVersion: z.literal(SEARCH_BACKGROUND_COMMAND_VERSION),
    target: searchBackgroundSnapshotTargetSchema,
    delta: z
      .object({
        englishTermCandidates: z
          .array(englishTermCandidateSchema)
          .max(SEARCH_BACKGROUND_TERM_CANDIDATE_LIMIT),
        englishTermDiscovery: searchTermDiscoveryStateSchema,
      })
      .strict(),
    updatedAt: z.string(),
  })
  .strict();

export type SearchBackgroundSnapshotTarget = z.infer<typeof searchBackgroundSnapshotTargetSchema>;
export type SearchEnrichmentCommandV1 = z.infer<typeof searchEnrichmentCommandV1Schema>;
export type SearchSpellingCorrectionCommandV1 = z.infer<
  typeof searchSpellingCorrectionCommandV1Schema
>;
export interface SearchTermSemanticProfileV1 {
  topics: string;
  method: string | null;
  claim: string | null;
  finding: string | null;
}
export type SearchTermDiscoveryPaperV1 = z.infer<typeof searchTermDiscoveryPaperV1Schema> & {
  semanticProfile?: SearchTermSemanticProfileV1;
};
export type SearchTermDiscoveryCommandV1 = z.infer<typeof searchTermDiscoveryCommandV1Schema>;
export type SearchEnrichmentPaperDelta = z.infer<typeof searchEnrichmentPaperDeltaSchema>;
export type SearchEnrichmentDeltaResponseV1 = z.infer<typeof searchEnrichmentDeltaResponseV1Schema>;
export type SearchSpellingCorrectionDeltaResponseV1 = z.infer<
  typeof searchSpellingCorrectionDeltaResponseV1Schema
>;
export type SearchTermDiscoveryDeltaResponseV1 = z.infer<
  typeof searchTermDiscoveryDeltaResponseV1Schema
>;

export function buildSearchBackgroundSnapshotTarget(
  metadata: SearchMetadata,
): SearchBackgroundSnapshotTarget {
  return {
    query: metadata.query.trim(),
    orderedPaperIds: metadata.papers.map((paper) => paper.paperId),
  };
}

export function hasSameSearchBackgroundTarget(
  left: SearchBackgroundSnapshotTarget,
  right: SearchBackgroundSnapshotTarget,
): boolean {
  return (
    left.query === right.query &&
    left.orderedPaperIds.length === right.orderedPaperIds.length &&
    left.orderedPaperIds.every((paperId, index) => paperId === right.orderedPaperIds[index])
  );
}

export function buildSearchEnrichmentCommandV1(
  metadata: SearchMetadata,
): SearchEnrichmentCommandV1 {
  return searchEnrichmentCommandV1Schema.parse({
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: buildSearchBackgroundSnapshotTarget(metadata),
    hydration: {
      status: metadata.abstractHydration?.status ?? "ready",
      ...(metadata.abstractHydration?.repairAttempted ? { repairAttempted: true } : {}),
      libraryOnlyPaperIds: metadata.libraryContext?.libraryOnlyPaperIds ?? [],
    },
  });
}

export function buildSearchSpellingCorrectionCommandV1(
  query: string,
): SearchSpellingCorrectionCommandV1 {
  return searchSpellingCorrectionCommandV1Schema.parse({
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: { query: query.trim() },
  });
}

function truncatePromptField(value: string | null | undefined): string {
  return (value ?? "").slice(0, TERM_CANDIDATE_PROMPT_FIELD_CHARS);
}

async function buildPortableInlineAnalysisFingerprint(
  paper: Pick<SearchMetadata["papers"][number], "title" | "abstract" | "year">,
): Promise<string> {
  const input = JSON.stringify({
    title: normalizeInlineAnalysisInputText(paper.title),
    abstract: normalizeInlineAnalysisInputText(paper.abstract),
    year: paper.year ?? null,
  });
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function projectSearchTermSemanticProfile(
  profile: SemanticProfile,
): SearchTermSemanticProfileV1 {
  return {
    topics: truncatePromptField(profile.topics.join("; ")),
    method: profile.method == null ? null : truncatePromptField(profile.method),
    claim: profile.claim == null ? null : truncatePromptField(profile.claim),
    finding: profile.finding == null ? null : truncatePromptField(profile.finding),
  };
}

export async function buildSearchTermDiscoveryCommandV1(
  metadata: SearchMetadata,
): Promise<SearchTermDiscoveryCommandV1> {
  const promptPapers = await Promise.all(
    metadata.papers.slice(0, TERM_CANDIDATE_LLM_PAPER_LIMIT).map(async (paper) => {
      const projectedAbstract =
        paper.abstract == null
          ? null
          : paper.abstract.slice(0, TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS);
      const inputFingerprint = hasUsableInlineAnalysisAbstract(projectedAbstract)
        ? await buildPortableInlineAnalysisFingerprint(paper)
        : undefined;
      return {
        paperId: paper.paperId,
        title: truncatePromptField(paper.title),
        abstract: projectedAbstract,
        year: paper.year,
        ...(inputFingerprint ? { inputFingerprint } : {}),
      };
    }),
  );
  const promptPaperIds = new Set(promptPapers.map((paper) => paper.paperId));
  const graphSupportedPaperIds =
    metadata.graphSupport?.status === "ready"
      ? Object.keys(metadata.graphSupport.paperScores).filter((paperId) =>
          promptPaperIds.has(paperId),
        )
      : [];

  return searchTermDiscoveryCommandV1Schema.parse({
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: buildSearchBackgroundSnapshotTarget(metadata),
    promptPapers,
    queryClauses: (metadata.queryClauses ?? [])
      .slice(0, MAX_SEARCH_QUERY_CLAUSES)
      .map((clause) => ({
        normalizedClause: clause.normalizedClause.slice(0, SEARCH_BACKGROUND_QUERY_MAX_CHARS),
        derivedExpansions: clause.derivedExpansions
          .slice(0, MAX_SEARCH_QUERY_CLAUSES)
          .map((value) => value.slice(0, SEARCH_BACKGROUND_QUERY_MAX_CHARS)),
      })),
    graphSupportedPaperIds,
  });
}

export function isVersionedSearchBackgroundCommand(value: unknown): value is { schemaVersion: 1 } {
  return (
    value != null &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === SEARCH_BACKGROUND_COMMAND_VERSION
  );
}

export function projectSearchEnrichmentPaperDelta(
  paper: SearchMetadata["papers"][number],
): SearchEnrichmentPaperDelta {
  return searchEnrichmentPaperProjectorSchema.parse(paper);
}

export interface SearchEnrichmentDelta {
  papers: SearchEnrichmentPaperDelta[];
  abstractHydration: { status: "ready"; repairAttempted?: boolean };
}
export type SearchSpellingCorrectionDelta = SearchSpellingCorrectionDeltaResponseV1["delta"];
export type SearchTermDiscoveryDelta = {
  englishTermCandidates: EnglishTermCandidate[];
  englishTermDiscovery: SearchTermDiscoveryState & { status: "ready" };
};
