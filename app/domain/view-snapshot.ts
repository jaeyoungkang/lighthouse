// @promise promise:reaction-from-visible-snapshot
// @promise promise:citation-lineage
// @aspect aspect:visible-explanation-sufficiency
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
import { z } from "zod";

const MAX_VIEW_SNAPSHOT_JSON_CHARS = 20_000;
export const MAX_VIEW_SNAPSHOT_PROMPT_CHARS = 12_000;
export const CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION = 3;
export const MAX_CITATION_LINEAGE_EVIDENCE_SNIPPET_CHARS = 600;
export const viewSnapshotRouteKindSchema = z.enum([
  "search",
  "gap_network",
  "citation_lineage",
  "graph_neighbors",
]);

const boundedText = (max: number) => z.string().trim().max(max);

const paperSnapshotSchema = z.object({
  id: boundedText(160),
  title: boundedText(300),
  year: z.number().int().nullable(),
  authors: z.array(boundedText(80)).max(6),
});

const searchPaperSnapshotSchema = z.object({
  id: boundedText(160),
  title: boundedText(300),
  year: z.number().int().nullable(),
  citationCount: z.number().int().nonnegative(),
});

const sourceLimitSchema = z.object({
  provider: boundedText(120).optional(),
  baseCorpus: boundedText(160).optional(),
  limits: z.array(boundedText(240)).max(8).optional(),
  paging: z
    .object({
      limit: z.number().int().nonnegative().optional(),
      offset: z.number().int().nonnegative().optional(),
      returned: z.number().int().nonnegative().optional(),
      totalMode: boundedText(80).optional(),
    })
    .optional(),
});

const availabilitySchema = z
  .object({
    available: z.boolean(),
    truncated: z.boolean(),
    total: z.number().int().nonnegative().nullable().optional(),
    returned: z.number().int().nonnegative().nullable().optional(),
    reason: boundedText(180).nullable().optional(),
  })
  .nullable()
  .optional();

const relationshipPaperSchema = paperSnapshotSchema.extend({
  relation: z.enum(["reference", "citation", "co_cited", "coupled"]),
  shared: z.number().int().nonnegative().optional(),
});

const citationEvidencePaperSchema = paperSnapshotSchema.extend({
  evidenceSnippet: boundedText(MAX_CITATION_LINEAGE_EVIDENCE_SNIPPET_CHARS).optional(),
});

const citationRelationshipPaperSchema = citationEvidencePaperSchema.extend({
  relation: z.enum(["reference", "citation"]),
});

const searchContentSchema = z.object({
  kind: z.literal("search"),
  query: boundedText(500),
  sort: boundedText(80).optional(),
  yearFilter: boundedText(80).optional(),
  total: z.number().int().nonnegative(),
  totalMode: boundedText(80).optional(),
  seedPaper: paperSnapshotSchema.optional(),
  libraryContext: z
    .object({
      signalPresent: z.boolean(),
      folders: z.array(z.object({ name: boundedText(80) })).max(8),
      anchorPaperCount: z.number().int().nonnegative().optional(),
      libraryOnlyPaperCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
  results: z.array(searchPaperSnapshotSchema).max(20),
  source: sourceLimitSchema.optional(),
});

const citationLineageContentSchema = z.object({
  kind: z.literal("citation_lineage"),
  seedPaper: citationEvidencePaperSchema,
  total: z.number().int().nonnegative(),
  referenceCount: z.number().int().nonnegative(),
  citationCount: z.number().int().nonnegative(),
  references: z
    .array(citationRelationshipPaperSchema)
    .max(CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION),
  citations: z
    .array(citationRelationshipPaperSchema)
    .max(CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION),
  referenceAvailability: availabilitySchema,
  citationAvailability: availabilitySchema,
  source: sourceLimitSchema.optional(),
});

const graphNeighborsContentSchema = z.object({
  kind: z.literal("graph_neighbors"),
  seedPaper: paperSnapshotSchema,
  total: z.number().int().nonnegative(),
  coCitedCount: z.number().int().nonnegative(),
  coupledCount: z.number().int().nonnegative(),
  coCited: z.array(relationshipPaperSchema).max(20),
  coupled: z.array(relationshipPaperSchema).max(20),
  coCitedAvailability: availabilitySchema,
  coupledAvailability: availabilitySchema,
  source: sourceLimitSchema.optional(),
});

const gapNetworkContentSchema = z.object({
  kind: z.literal("gap_network"),
  query: boundedText(500).optional(),
  summary: boundedText(4000).optional(),
  metrics: z
    .object({
      clusterCount: z.number().int().nonnegative(),
      totalPaperCount: z.number().int().nonnegative(),
      totalEdgeCount: z.number().int().nonnegative(),
      gapPairCount: z.number().int().nonnegative(),
    })
    .optional(),
  topGapPairs: z
    .array(
      z.object({
        id: boundedText(160),
        label: boundedText(240),
        rank: z.number().int().nonnegative(),
        gapScore: z.number(),
      }),
    )
    .max(10)
    .optional(),
  hypotheses: z
    .array(
      z.object({
        id: boundedText(160),
        title: boundedText(240),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(10)
    .optional(),
});

export const viewSnapshotSchema = z
  .discriminatedUnion("snapshotKind", [
    z.object({
      snapshotId: boundedText(200),
      snapshotKind: z.literal("search"),
      title: boundedText(300),
      content: searchContentSchema,
    }),
    z.object({
      snapshotId: boundedText(200),
      snapshotKind: z.literal("citation_lineage"),
      title: boundedText(300),
      content: citationLineageContentSchema,
    }),
    z.object({
      snapshotId: boundedText(200),
      snapshotKind: z.literal("graph_neighbors"),
      title: boundedText(300),
      content: graphNeighborsContentSchema,
    }),
    z.object({
      snapshotId: boundedText(200),
      snapshotKind: z.literal("gap_network"),
      title: boundedText(300),
      content: gapNetworkContentSchema,
    }),
  ])
  .superRefine((snapshot, ctx) => {
    const length = JSON.stringify(snapshot).length;
    if (length > MAX_VIEW_SNAPSHOT_JSON_CHARS) {
      ctx.addIssue({
        code: "custom",
        message: "viewSnapshot is too large",
        path: ["viewSnapshot"],
      });
    }
  });

export type ViewSnapshot = z.infer<typeof viewSnapshotSchema>;

function sortJsonObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonObjectKeys);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nestedValue]) => [key, sortJsonObjectKeys(nestedValue)]),
  );
}

export function buildViewSnapshotProjectionKey(snapshot: ViewSnapshot): string {
  return JSON.stringify(sortJsonObjectKeys(snapshot));
}

function formatPaper(paper: z.infer<typeof paperSnapshotSchema>): string {
  const authors = paper.authors.length > 0 ? paper.authors.join(", ") : "unknown authors";
  const year = paper.year == null ? "year unknown" : String(paper.year);
  return `${paper.title} | ${year} | ${authors}`;
}

function formatSearchPaper(paper: z.infer<typeof searchPaperSnapshotSchema>): string {
  const year = paper.year == null ? "year unknown" : String(paper.year);
  return `${paper.title} | ${year} | citations=${String(paper.citationCount)}`;
}

function formatSource(source: z.infer<typeof sourceLimitSchema> | undefined): string[] {
  if (!source) return [];
  const lines = [
    source.provider ? `provider: ${source.provider}` : null,
    source.baseCorpus ? `baseCorpus: ${source.baseCorpus}` : null,
    source.paging
      ? `paging: limit=${source.paging.limit == null ? "unknown" : String(source.paging.limit)}, offset=${source.paging.offset == null ? "unknown" : String(source.paging.offset)}, returned=${source.paging.returned == null ? "unknown" : String(source.paging.returned)}, totalMode=${source.paging.totalMode ?? "unknown"}`
      : null,
    ...(source.limits ?? []).map((limit) => `limit: ${limit}`),
  ].filter((line): line is string => Boolean(line));
  return lines;
}

function formatAvailability(
  label: string,
  availability: z.infer<typeof availabilitySchema>,
): string {
  if (!availability) {
    return `${label}Availability: unknown`;
  }

  const fields = [
    `available=${String(availability.available)}`,
    `truncated=${String(availability.truncated)}`,
    availability.returned == null ? null : `returned=${String(availability.returned)}`,
    availability.total == null ? null : `total=${String(availability.total)}`,
    availability.reason == null ? null : `reason=${availability.reason}`,
  ].filter((field): field is string => field != null);

  return `${label}Availability: ${fields.join(", ")}`;
}

function formatRelationshipPaper(paper: z.infer<typeof relationshipPaperSchema>): string {
  const shared = paper.shared == null ? "" : ` | shared=${String(paper.shared)}`;
  return `${paper.relation} | ${formatPaper(paper)}${shared}`;
}

function formatCitationEvidencePaper(
  paper: z.infer<typeof citationRelationshipPaperSchema>,
): string {
  return `${paper.relation} | ${formatPaper(paper)} | evidence=${paper.evidenceSnippet ?? "unavailable"}`;
}

export function buildViewSnapshotPromptContext(snapshot: ViewSnapshot): string {
  const lines = [
    `snapshot_id: ${snapshot.snapshotId}`,
    `snapshot_type: ${snapshot.snapshotKind}`,
    `snapshot_title: ${snapshot.title}`,
  ];

  if (snapshot.content.kind === "search") {
    const searchLines = [
      `query: ${snapshot.content.query}`,
      `sort: ${snapshot.content.sort ?? "default"}`,
      `yearFilter: ${snapshot.content.yearFilter ?? "none"}`,
      `loaded_results_in_snapshot: ${String(snapshot.content.results.length)}`,
      snapshot.content.seedPaper ? `seed: ${formatPaper(snapshot.content.seedPaper)}` : null,
      snapshot.content.libraryContext?.signalPresent
        ? `library_context: collections=${snapshot.content.libraryContext.folders.map((folder) => folder.name).join(", ") || "unknown"}; anchorPaperCount=${snapshot.content.libraryContext.anchorPaperCount == null ? "unknown" : String(snapshot.content.libraryContext.anchorPaperCount)}; libraryOnlyPaperCount=${snapshot.content.libraryContext.libraryOnlyPaperCount == null ? "unknown" : String(snapshot.content.libraryContext.libraryOnlyPaperCount)}`
        : null,
      "source:",
      ...formatSource(snapshot.content.source).map((line) => `- ${line}`),
      "top_results:",
      ...snapshot.content.results.map(
        (paper, index) => `${String(index + 1)}. ${formatSearchPaper(paper)}`,
      ),
    ].filter((line): line is string => Boolean(line));
    lines.push(...searchLines);
  } else if (snapshot.content.kind === "citation_lineage") {
    lines.push(
      `seed: ${formatPaper(snapshot.content.seedPaper)}`,
      `seed_evidence: ${snapshot.content.seedPaper.evidenceSnippet ?? "unavailable"}`,
      `references: ${String(snapshot.content.referenceCount)}`,
      `citations: ${String(snapshot.content.citationCount)}`,
      formatAvailability("reference", snapshot.content.referenceAvailability),
      formatAvailability("citation", snapshot.content.citationAvailability),
      "source:",
      ...formatSource(snapshot.content.source).map((line) => `- ${line}`),
      "reference_results:",
      ...snapshot.content.references.map(
        (paper, index) => `${String(index + 1)}. ${formatCitationEvidencePaper(paper)}`,
      ),
      "citation_results:",
      ...snapshot.content.citations.map(
        (paper, index) => `${String(index + 1)}. ${formatCitationEvidencePaper(paper)}`,
      ),
    );
  } else if (snapshot.content.kind === "graph_neighbors") {
    lines.push(
      `seed: ${formatPaper(snapshot.content.seedPaper)}`,
      `coCited: ${String(snapshot.content.coCitedCount)}`,
      `coupled: ${String(snapshot.content.coupledCount)}`,
      formatAvailability("coCited", snapshot.content.coCitedAvailability),
      formatAvailability("coupled", snapshot.content.coupledAvailability),
      "source:",
      ...formatSource(snapshot.content.source).map((line) => `- ${line}`),
      "co_cited_results:",
      ...snapshot.content.coCited.map(
        (paper, index) => `${String(index + 1)}. ${formatRelationshipPaper(paper)}`,
      ),
      "coupled_results:",
      ...snapshot.content.coupled.map(
        (paper, index) => `${String(index + 1)}. ${formatRelationshipPaper(paper)}`,
      ),
    );
  } else {
    lines.push(
      `query: ${snapshot.content.query ?? "unknown"}`,
      snapshot.content.metrics
        ? `metrics: clusters=${String(snapshot.content.metrics.clusterCount)}, papers=${String(snapshot.content.metrics.totalPaperCount)}, edges=${String(snapshot.content.metrics.totalEdgeCount)}, gaps=${String(snapshot.content.metrics.gapPairCount)}`
        : "metrics: unknown",
      `summary: ${snapshot.content.summary ?? "none"}`,
      "top_gap_pairs:",
      ...(snapshot.content.topGapPairs ?? []).map(
        (gap) =>
          `- ${gap.id} | ${gap.label} | rank=${String(gap.rank)} | score=${String(gap.gapScore)}`,
      ),
      "hypotheses:",
      ...(snapshot.content.hypotheses ?? []).map(
        (hypothesis) => `- ${hypothesis.id} | ${hypothesis.title} | ${hypothesis.confidence}`,
      ),
    );
  }

  return lines.join("\n").slice(0, MAX_VIEW_SNAPSHOT_PROMPT_CHARS);
}
