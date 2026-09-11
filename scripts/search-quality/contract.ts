import { z } from "zod";
import {
  validateProviderFixtureEvidence,
  type ProviderFixtureEvidence,
} from "../load-smoke/provider-stats";

const text = z.string().trim().min(1);
const paperId = text;
const exactRevision = z
  .string()
  .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u)
  .refine((value) => !/^0+$/u.test(value), "revision cannot be the all-zero sentinel");
const provenance = z
  .object({
    source: z.enum(["synthetic", "public-benchmark", "human-judged"]),
    reference: text,
    privacy: z.literal("public-or-synthetic-only"),
  })
  .strict();
const knownItemQuery = z
  .object({
    id: text,
    kind: z.enum(["doi", "title"]),
    query: text,
    provenance,
    evaluation: z
      .object({ type: z.literal("known-item"), expectedPaperIds: z.array(paperId).min(1) })
      .strict(),
  })
  .strict();
const topicQuery = z
  .object({
    id: text,
    kind: z.literal("topic"),
    query: text,
    provenance,
    evaluation: z
      .object({
        type: z.literal("topic"),
        judgments: z
          .array(z.object({ paperId, grade: z.number().int().min(0).max(3) }).strict())
          .min(1),
      })
      .strict(),
  })
  .strict();

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const searchQualityEvaluationSetSchema = z
  .object({
    schemaVersion: z.literal("1"),
    id: text,
    version: text,
    evidenceScope: z.enum(["deterministic-wiring", "bounded-live"]),
    sampleLimit: z.number().int().min(1).max(40),
    judgmentRubric: z.literal("topic-relevance-0-3-v1"),
    queries: z.array(z.union([knownItemQuery, topicQuery])).min(3),
  })
  .strict()
  .superRefine((set, context) => {
    const add = (message: string) => {
      context.addIssue({ code: "custom", path: ["queries"], message });
    };
    if (!unique(set.queries.map((query) => query.id))) add("query IDs must be unique");
    if (!unique(set.queries.map((query) => query.query))) add("query strings must be unique");
    for (const kind of ["doi", "title", "topic"] as const) {
      if (!set.queries.some((query) => query.kind === kind)) {
        add(`evaluation set requires a ${kind} query`);
      }
    }
    for (const query of set.queries) {
      const ids =
        query.evaluation.type === "known-item"
          ? query.evaluation.expectedPaperIds
          : query.evaluation.judgments.map((judgment) => judgment.paperId);
      if (!unique(ids)) add("paper IDs must be unique within each query");
      if (
        query.evaluation.type === "topic" &&
        !query.evaluation.judgments.some((judgment) => judgment.grade > 0)
      ) {
        add("each topic query requires at least one relevant judgment");
      }
      if (set.evidenceScope === "deterministic-wiring" && query.provenance.source !== "synthetic") {
        add("deterministic wiring sets require synthetic provenance");
      }
      if (set.evidenceScope === "bounded-live" && query.provenance.source === "synthetic") {
        add("bounded live sets cannot use synthetic provenance");
      }
    }
  });

const approval = z
  .object({
    role: z.enum(["human-product-owner", "operational-readiness-owner"]),
    owner: text,
    decisionRef: text,
  })
  .strict();
export const searchQualityReleasePolicySchema = z
  .object({
    schemaVersion: z.literal("1"),
    policyVersion: text,
    evaluationSet: z
      .object({ id: text, version: text, sha256: z.string().regex(/^[0-9a-f]{64}$/u) })
      .strict(),
    approvedAt: z.iso.datetime({ offset: true }),
    approvals: z.array(approval).length(2),
    evidenceFreshnessHours: z.number().int().positive(),
    thresholds: z
      .object({
        queryP95MsMax: z.number().positive(),
        queryErrorRateMax: z.number().min(0).max(1),
        knownItemRecall: z
          .object({ atK: z.number().int().positive(), min: z.number().min(0).max(1) })
          .strict(),
        topicMeanNdcgAt10Min: z.number().min(0).max(1),
      })
      .strict(),
    rollout: z
      .object({
        pauseOwner: text,
        rollbackOwner: text,
        resumeOwner: text,
      })
      .strict(),
  })
  .strict()
  .refine(
    (policy) => new Set(policy.approvals.map((item) => item.role)).size === policy.approvals.length,
    { path: ["approvals"], message: "release policy requires both approval roles" },
  );

const outcomes = z
  .object({
    "2xx": z.number().int().nonnegative(),
    "4xx": z.number().int().nonnegative(),
    "5xx": z.number().int().nonnegative(),
    timeout: z.number().int().nonnegative(),
    "network-error": z.number().int().nonnegative(),
  })
  .strict();
const endpoint = z.looseObject({
  endpoint: text,
  count: z.number().int().positive(),
  outcomes,
  p95: z.number().nonnegative(),
});
const readiness = z
  .object({ userIndex: z.number().int().nonnegative(), paperIds: z.array(paperId).nullable() })
  .strict()
  .refine((item) => item.paperIds === null || unique(item.paperIds), {
    path: ["paperIds"],
    message: "rendered paper IDs must be unique",
  });
const requestProvenance = z
  .object({
    endpoint: text,
    userIndex: z.number().int().nonnegative(),
    method: z.enum(["GET", "POST"]),
    requestPath: z.string().startsWith("/"),
    finalUrl: z.url().nullable(),
    redirectMode: z.enum(["follow", "manual"]),
  })
  .strict();
const cohort = z.looseObject({
  users: z.number().int().positive(),
  endpoints: z.array(endpoint).min(1),
  searchReadiness: z.array(readiness).min(1),
  requestProvenance: z.array(requestProvenance).optional(),
});
const loadSmokeReportSchema = z
  .looseObject({
    schemaVersion: z.literal("5"),
    generatedAt: z.iso.datetime({ offset: true }),
    config: z.looseObject({
      query: text,
      mode: z.literal("one-shot"),
      targetRevision: exactRevision,
      workingTreeDirty: z.boolean(),
      providerProfile: text,
      users: z.number().int().positive(),
    }),
    cohorts: z.array(cohort).length(1),
    providerFixtureEvidence: z.unknown().optional(),
  })
  .superRefine((report, context) => {
    const current = report.cohorts[0];
    const indices = current.searchReadiness.map((item) => item.userIndex);
    if (
      current.users !== report.config.users ||
      current.searchReadiness.length !== current.users ||
      !unique(indices.map(String)) ||
      Array.from({ length: current.users }, (_unused, index) => index).some(
        (index) => !indices.includes(index),
      )
    ) {
      context.addIssue({ code: "custom", path: ["cohorts", 0], message: "invalid user cohort" });
    }
    const queryEndpoints = current.endpoints.filter(
      (item) => item.endpoint === "GET /search?q= (query execution)",
    );
    const queryEndpoint = queryEndpoints.at(0);
    const outcomeCount =
      queryEndpoint === undefined
        ? -1
        : Object.values(queryEndpoint.outcomes).reduce((sum, count) => sum + count, 0);
    if (
      queryEndpoints.length !== 1 ||
      outcomeCount !== queryEndpoint?.count ||
      queryEndpoint.count !== current.users
    ) {
      context.addIssue({
        code: "custom",
        path: ["cohorts", 0, "endpoints"],
        message: "invalid query endpoint evidence",
      });
    }
  });

export type SearchQualityEvaluationSet = z.infer<typeof searchQualityEvaluationSetSchema>;
export type SearchQualityReleasePolicy = z.infer<typeof searchQualityReleasePolicySchema>;
type ParsedLoadSmokeReport = z.infer<typeof loadSmokeReportSchema>;
export type SearchQualityLoadSmokeReport = ParsedLoadSmokeReport & {
  providerFixtureEvidence?: ProviderFixtureEvidence;
};

export const parseSearchQualityEvaluationSet = (value: unknown) =>
  searchQualityEvaluationSetSchema.parse(value);
export const parseSearchQualityReleasePolicy = (value: unknown) =>
  searchQualityReleasePolicySchema.parse(value);
export const parseSearchQualityExpectedTargetRevision = (value: unknown) =>
  exactRevision.parse(value);
export function parseSearchQualityLoadSmokeReport(value: unknown): SearchQualityLoadSmokeReport {
  const report = loadSmokeReportSchema.parse(value);
  const fixture = report.providerFixtureEvidence;
  if (fixture !== undefined) {
    validateProviderFixtureEvidence(fixture as ProviderFixtureEvidence);
    if ((fixture as ProviderFixtureEvidence).completedJourneys !== report.cohorts[0].users) {
      throw new Error("provider fixture completed journeys must match the one-shot cohort");
    }
  }
  return report as SearchQualityLoadSmokeReport;
}
