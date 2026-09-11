import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { ENDPOINT_LABELS } from "../load-smoke/metrics";
import { parseSearchQualityLoadSmokeReport, type SearchQualityEvaluationSet } from "./contract";
import {
  evaluateSearchQuality,
  getEvaluationSetSha256,
  isSuccessfulSearchQualityEvaluation,
} from "./evaluator";

export const SEARCH_QUALITY_EXPECTED_REPOSITORY = "jaeyoungkang/lighthouse";
export const SEARCH_QUALITY_EXPECTED_EVENT = "workflow_dispatch";
export const SEARCH_QUALITY_EXPECTED_REF = "refs/heads/main";
export const SEARCH_QUALITY_EXPECTED_WORKFLOW_REF =
  "jaeyoungkang/lighthouse/.github/workflows/search-quality-evidence.yml@refs/heads/main";
export const SEARCH_QUALITY_COLLECTOR_DEFINITION_PATHS = [
  ".github/workflows/search-quality-evidence.yml",
  "scripts/load-smoke/metrics.ts",
  "scripts/load-smoke/mint-session.ts",
  "scripts/load-smoke/provider-fixture.ts",
  "scripts/load-smoke/provider-stats.ts",
  "scripts/load-smoke/run-provider-fixture.ts",
  "scripts/load-smoke/run.ts",
  "scripts/load-smoke/user-journey.ts",
  "scripts/search-quality/attestation.ts",
  "scripts/search-quality/contract.ts",
  "scripts/search-quality/evaluator.ts",
  "scripts/search-quality/fixtures/deterministic-wiring.v1.json",
  "scripts/search-quality/run-attestation.ts",
] as const;

const SHA_PATTERN = /^[0-9a-f]{40}$/u;
const POSITIVE_INTEGER_PATTERN = /^[1-9][0-9]*$/u;
const ACTOR_PATTERN = /^[A-Za-z0-9_.-]+(?:\[bot\])?$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const EXPECTED_PROVIDER_PROFILE = "local-fixture-healthy-v1";
const EXPECTED_INPUT_PROFILE = "search-quality-deterministic-wiring-v1";
const EXPECTED_TOPOLOGY_PROFILE = "local-single-next-process";
const EXPECTED_FIXTURE_PAPER_COUNT = 3;
const EXPECTED_FIXTURE_DELAY_MS = 0;
const EXPECTED_BASE_URL = "http://127.0.0.1:3000";

const exactSha = z
  .string()
  .regex(SHA_PATTERN)
  .refine((value) => !/^0+$/u.test(value), "revision cannot be the all-zero sentinel");
const instant = z.iso.datetime({ offset: true });

const invocationSchema = z
  .object({
    githubActions: z.literal("true"),
    repository: z.literal(SEARCH_QUALITY_EXPECTED_REPOSITORY),
    eventName: z.literal(SEARCH_QUALITY_EXPECTED_EVENT),
    ref: z.literal(SEARCH_QUALITY_EXPECTED_REF),
    workflowRef: z.literal(SEARCH_QUALITY_EXPECTED_WORKFLOW_REF),
    workflowSha: exactSha,
    targetRevision: exactSha,
    actor: z.string().regex(ACTOR_PATTERN),
    runId: z.string().regex(POSITIVE_INTEGER_PATTERN),
    runAttempt: z.string().regex(POSITIVE_INTEGER_PATTERN),
    pullRequestNumber: z.literal(0),
    collectionStartedAt: instant,
    collectionCompletedAt: instant,
  })
  .strict()
  .superRefine((invocation, context) => {
    if (invocation.workflowSha !== invocation.targetRevision) {
      context.addIssue({
        code: "custom",
        path: ["workflowSha"],
        message: "workflow SHA must equal the exact protected-main target revision",
      });
    }
    if (
      new Date(invocation.collectionStartedAt).getTime() >=
      new Date(invocation.collectionCompletedAt).getTime()
    ) {
      context.addIssue({
        code: "custom",
        path: ["collectionCompletedAt"],
        message: "collection completion must follow collection start",
      });
    }
  });

export type SearchQualityEvidenceInvocation = z.infer<typeof invocationSchema>;

export interface RawSearchQualityReportInput {
  queryId: string;
  raw: Buffer;
}

interface CollectorDefinition {
  sha256: string;
  files: Array<{ path: string; sha256: string }>;
}

const candidateBundleSchema = z
  .object({
    selfCheck: z
      .object({
        algorithm: z.literal("sha256"),
        digest: z.string().regex(DIGEST_PATTERN),
      })
      .strict(),
  })
  .loose();

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function parseInvocation(value: unknown, now: Date): SearchQualityEvidenceInvocation {
  if (Number.isNaN(now.getTime())) throw new Error("verification time is invalid");
  const invocation = invocationSchema.parse(value);
  if (new Date(invocation.collectionCompletedAt).getTime() > now.getTime() + MAX_CLOCK_SKEW_MS) {
    throw new Error("collection completion is future dated");
  }
  return invocation;
}

export function searchQualityEvidenceInvocationFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  now = new Date(),
): SearchQualityEvidenceInvocation {
  return parseInvocation(
    {
      githubActions: environment.GITHUB_ACTIONS,
      repository: environment.GITHUB_REPOSITORY,
      eventName: environment.GITHUB_EVENT_NAME,
      ref: environment.GITHUB_REF,
      workflowRef: environment.GITHUB_WORKFLOW_REF,
      workflowSha: environment.GITHUB_WORKFLOW_SHA,
      targetRevision: environment.GITHUB_SHA,
      actor: environment.GITHUB_ACTOR,
      runId: environment.GITHUB_RUN_ID,
      runAttempt: environment.GITHUB_RUN_ATTEMPT,
      pullRequestNumber: 0,
      collectionStartedAt: environment.SEARCH_QUALITY_COLLECTION_STARTED_AT,
      collectionCompletedAt: environment.SEARCH_QUALITY_COLLECTION_COMPLETED_AT,
    },
    now,
  );
}

export function getSearchQualityCollectorDefinition(root = process.cwd()): CollectorDefinition {
  const files = SEARCH_QUALITY_COLLECTOR_DEFINITION_PATHS.map((relativePath) => ({
    path: relativePath,
    sha256: sha256(readFileSync(path.join(root, relativePath))),
  }));
  if (files.length === 0) throw new Error("search-quality collector inventory is empty");
  return { sha256: sha256(canonicalize(files)), files };
}

function runRef(invocation: SearchQualityEvidenceInvocation): string {
  return [
    "github-actions",
    invocation.repository,
    invocation.runId,
    invocation.runAttempt,
    invocation.targetRevision,
  ].join(":");
}

function assertSyntheticFixtureReport(
  report: ReturnType<typeof parseSearchQualityLoadSmokeReport>,
  invocation: SearchQualityEvidenceInvocation,
): void {
  if (
    report.config.targetRevision !== invocation.targetRevision ||
    report.config.workingTreeDirty
  ) {
    throw new Error("report is not bound to the exact clean target revision");
  }
  if (report.config.users !== 1 || report.cohorts[0].users !== 1) {
    throw new Error("synthetic candidate requires one one-shot journey per query");
  }
  const expectedEndpoints = new Set<string>(
    (["searchPage", "querySearch", "followupEntry"] as const).map((key) => ENDPOINT_LABELS[key]),
  );
  const journey = report.cohorts[0].endpoints;
  if (
    journey.length !== expectedEndpoints.size ||
    new Set(journey.map((item) => item.endpoint)).size !== expectedEndpoints.size ||
    journey.some(
      (item) =>
        !expectedEndpoints.has(item.endpoint) ||
        item.count !== 1 ||
        item.outcomes["2xx"] !== 1 ||
        Object.values(item.outcomes).reduce((sum, count) => sum + count, 0) !== item.count,
    )
  ) {
    throw new Error("synthetic candidate requires the full one-shot search journey");
  }
  const entryParams = new URLSearchParams({ q: report.config.query, entry: "route-bar" });
  const followupParams = new URLSearchParams({
    q: `${report.config.query} methods`,
    entry: "term",
    termSourceQuery: report.config.query,
    term: `${report.config.query} methods`,
    termType: "direct",
    termSupport: "1",
  });
  const expectedRequests = [
    { endpoint: ENDPOINT_LABELS.searchPage, requestPath: "/search" },
    {
      endpoint: ENDPOINT_LABELS.querySearch,
      requestPath: `/search?${entryParams.toString()}`,
    },
    {
      endpoint: ENDPOINT_LABELS.followupEntry,
      requestPath: `/search?${followupParams.toString()}`,
    },
  ];
  const requestProvenance = report.cohorts[0].requestProvenance;
  if (
    report.config.baseUrl !== EXPECTED_BASE_URL ||
    requestProvenance === undefined ||
    requestProvenance.length !== expectedRequests.length ||
    expectedRequests.some((expected, index) => {
      const actual = requestProvenance[index];
      return (
        actual.endpoint !== expected.endpoint ||
        actual.userIndex !== 0 ||
        actual.method !== "GET" ||
        actual.requestPath !== expected.requestPath ||
        actual.finalUrl !== `${EXPECTED_BASE_URL}${expected.requestPath}` ||
        actual.redirectMode !== "follow"
      );
    })
  ) {
    throw new Error("synthetic candidate request path or final URL provenance is invalid");
  }
  if (
    report.config.providerProfile !== EXPECTED_PROVIDER_PROFILE ||
    report.config.inputProfile !== EXPECTED_INPUT_PROFILE ||
    report.config.topologyProfile !== EXPECTED_TOPOLOGY_PROFILE
  ) {
    throw new Error("report execution profile does not match the expected synthetic collector");
  }
  const fixture = report.providerFixtureEvidence;
  if (
    fixture?.source !== "loopback-provider-fixture" ||
    fixture.final.profile !== "healthy" ||
    fixture.final.configuredPaperCount !== EXPECTED_FIXTURE_PAPER_COUNT ||
    fixture.final.configuredDelayMs !== EXPECTED_FIXTURE_DELAY_MS ||
    fixture.completedJourneys !== 1
  ) {
    throw new Error("report fixture identity does not match the expected synthetic corpus");
  }
  const generatedAt = new Date(report.generatedAt).getTime();
  if (
    generatedAt < new Date(invocation.collectionStartedAt).getTime() ||
    generatedAt > new Date(invocation.collectionCompletedAt).getTime()
  ) {
    throw new Error("report timestamp falls outside the declared collection window");
  }
}

function candidatePayload(
  set: SearchQualityEvaluationSet,
  rawInputs: readonly RawSearchQualityReportInput[],
  invocation: SearchQualityEvidenceInvocation,
  collector: CollectorDefinition,
) {
  if (
    set.evidenceScope !== "deterministic-wiring" ||
    set.queries.some((query) => query.provenance.source !== "synthetic")
  ) {
    throw new Error("search-quality candidate accepts only the synthetic wiring set");
  }
  const expectedQueryIds = new Set(set.queries.map((query) => query.id));
  const actualQueryIds = rawInputs.map((input) => input.queryId);
  if (
    actualQueryIds.length !== expectedQueryIds.size ||
    new Set(actualQueryIds).size !== actualQueryIds.length ||
    actualQueryIds.some((queryId) => !expectedQueryIds.has(queryId))
  ) {
    throw new Error("synthetic candidate requires exactly one report per evaluation query");
  }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parsedInputs = rawInputs.map((input) => {
    const text = decoder.decode(input.raw);
    return {
      queryId: input.queryId,
      raw: input.raw,
      report: parseSearchQualityLoadSmokeReport(JSON.parse(text) as unknown),
    };
  });
  for (const input of parsedInputs) assertSyntheticFixtureReport(input.report, invocation);

  const result = evaluateSearchQuality(
    set,
    parsedInputs.map(({ queryId, report }) => ({ queryId, report })),
    undefined,
    new Date(invocation.collectionCompletedAt),
    invocation.targetRevision,
  );
  if (!isSuccessfulSearchQualityEvaluation(result) || result.release.verdict !== "not-applicable") {
    throw new Error("synthetic actual-path evaluation did not produce complete wiring evidence");
  }

  const setDigest = getEvaluationSetSha256(set);
  const currentRunRef = runRef(invocation);
  const reportItems = parsedInputs.map((input) => ({
    queryRef: `sha256:${sha256(`${setDigest}\0${currentRunRef}\0${input.queryId}`)}`,
    sha256: sha256(input.raw),
    generatedAt: input.report.generatedAt,
    requestProvenanceSha256: sha256(canonicalize(input.report.cohorts[0].requestProvenance)),
  }));
  const fixtureDefinition = collector.files.find(
    (item) => item.path === "scripts/load-smoke/provider-fixture.ts",
  );
  if (fixtureDefinition === undefined) {
    throw new Error("collector inventory omits the provider fixture definition");
  }

  return {
    schemaVersion: "1" as const,
    kind: "lighthouse-search-quality-synthetic-candidate" as const,
    authority: {
      evidenceScope: "synthetic-evidence-only" as const,
      releaseAuthority: false as const,
      executionAuthority: false as const,
      currentnessAuthority: false as const,
      attestationAuthority: false as const,
      verificationMode: "target-self-recomputation" as const,
    },
    invocation: { ...invocation, runRef: currentRunRef },
    collector,
    evaluationSet: {
      sha256: setDigest,
      evidenceScope: "deterministic-wiring" as const,
      queryCount: set.queries.length,
    },
    fixture: {
      kind: "loopback-provider-fixture" as const,
      profile: "healthy" as const,
      paperCount: EXPECTED_FIXTURE_PAPER_COUNT,
      delayMs: EXPECTED_FIXTURE_DELAY_MS,
      definitionSha256: fixtureDefinition.sha256,
    },
    reports: {
      count: reportItems.length,
      bundleSha256: sha256(canonicalize(reportItems)),
      items: reportItems,
    },
    aggregate: {
      evidenceComplete: true as const,
      metrics: result.metrics,
      release: {
        verdict: "not-applicable" as const,
        reasons: result.release.reasons,
      },
    },
  };
}

export function buildSearchQualityEvidenceCandidate(params: {
  set: SearchQualityEvaluationSet;
  rawInputs: readonly RawSearchQualityReportInput[];
  invocation: SearchQualityEvidenceInvocation;
}) {
  const invocation = parseInvocation(params.invocation, new Date());
  const payload = candidatePayload(
    params.set,
    params.rawInputs,
    invocation,
    getSearchQualityCollectorDefinition(),
  );
  return {
    ...payload,
    selfCheck: {
      algorithm: "sha256" as const,
      digest: sha256(canonicalize(payload)),
    },
  };
}

export type SearchQualityEvidenceBundle = ReturnType<typeof buildSearchQualityEvidenceCandidate>;

export function selfCheckSearchQualityEvidenceCandidate(params: {
  bundle: unknown;
  set: SearchQualityEvaluationSet;
  rawInputs: readonly RawSearchQualityReportInput[];
  invocation: SearchQualityEvidenceInvocation;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const invocation = parseInvocation(params.invocation, now);
  const bundle = candidateBundleSchema.parse(params.bundle);
  const expected = buildSearchQualityEvidenceCandidate({
    set: params.set,
    rawInputs: params.rawInputs,
    invocation,
  });
  if (canonicalize(bundle) !== canonicalize(expected)) {
    throw new Error("search-quality candidate does not match target self-recomputation");
  }
  return {
    schemaVersion: "1" as const,
    kind: "lighthouse-search-quality-synthetic-self-check" as const,
    status: "target-self-check-passed" as const,
    evidenceScope: "synthetic-evidence-only" as const,
    releaseAuthority: false as const,
    executionAuthority: false as const,
    currentnessAuthority: false as const,
    attestationAuthority: false as const,
    runRef: expected.invocation.runRef,
    targetRevision: expected.invocation.targetRevision,
    bundleSha256: sha256(canonicalize(bundle)),
    verifiedAt: now.toISOString(),
  };
}
