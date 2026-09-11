import { createHash } from "node:crypto";
import {
  parseSearchQualityExpectedTargetRevision,
  type SearchQualityEvaluationSet,
  type SearchQualityLoadSmokeReport,
  type SearchQualityReleasePolicy,
} from "./contract";

const QUERY_ENDPOINT = "GET /search?q= (query execution)";
type Status = "pass" | "fail" | "missing" | "unapproved" | "not-applicable";
type Finding = { code: string; message: string };
type Metric = { observed: number | null; threshold: number | null; status: Status };
interface Metrics {
  queryP95MsMax: Metric;
  queryErrorRate: Metric;
  knownItemRecall: Metric & { atK: number; numerator: number; denominator: number };
  topicMeanNdcgAt10: Metric & { queryCount: number };
}
export type SearchQualityReportInput = { queryId: string; report: SearchQualityLoadSmokeReport };

const finding = (code: string, message: string): Finding => ({ code, message });

function opaqueReference(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(",")}}`;
}

export function getEvaluationSetSha256(set: SearchQualityEvaluationSet): string {
  return createHash("sha256").update(canonicalize(set)).digest("hex");
}

function readRanking(report: SearchQualityLoadSmokeReport, findings: Finding[]) {
  const rankings = report.cohorts[0].searchReadiness.map((item) => item.paperIds);
  if (rankings.some((ranking) => ranking === null)) {
    findings.push(finding("unreadable-ranking", "query ranking is unreadable"));
    return null;
  }
  const readable = rankings as string[][];
  const first = readable[0] ?? [];
  if (
    readable.some(
      (ranking) =>
        ranking.length !== first.length ||
        ranking.some((paperId, index) => paperId !== first[index]),
    )
  ) {
    findings.push(finding("inconsistent-ranking", "query rankings are inconsistent"));
    return null;
  }
  return first;
}

function dcg(grades: readonly number[]): number {
  return grades.reduce((sum, grade, index) => sum + (2 ** grade - 1) / Math.log2(index + 2), 0);
}
export function calculateNdcgAt10(
  ranking: readonly string[],
  judgments: ReadonlyArray<{ paperId: string; grade: number }>,
): number {
  const grades = new Map(judgments.map((item) => [item.paperId, item.grade]));
  const ideal = dcg(
    judgments
      .map((item) => item.grade)
      .sort((left, right) => right - left)
      .slice(0, 10),
  );
  return ideal === 0 ? 0 : dcg(ranking.slice(0, 10).map((id) => grades.get(id) ?? 0)) / ideal;
}

function indexReports(
  set: SearchQualityEvaluationSet,
  inputs: readonly SearchQualityReportInput[],
) {
  const reports = new Map<string, SearchQualityLoadSmokeReport>();
  const ids = new Set(set.queries.map((query) => query.id));
  for (const input of inputs) {
    if (!ids.has(input.queryId)) throw new Error("unknown evaluation query ID");
    if (reports.has(input.queryId)) throw new Error("duplicate evaluation query report");
    reports.set(input.queryId, input.report);
  }
  return reports;
}

type Evidence = {
  findings: Finding[];
  rankings: Map<string, string[]>;
  revisions: Set<string>;
  p95: number | null;
  requests: number;
  errors: number;
};
function inspectProviderBinding(
  scope: SearchQualityEvaluationSet["evidenceScope"],
  report: SearchQualityLoadSmokeReport,
): Finding[] {
  const fixture = report.providerFixtureEvidence;
  if (scope === "bounded-live") {
    return fixture === undefined
      ? []
      : [
          finding(
            "fixture-evidence-in-live",
            "bounded live evidence cannot use a provider fixture",
          ),
        ];
  }
  if (fixture === undefined) {
    return [
      finding("missing-provider-fixture-binding", "deterministic report has no fixture binding"),
    ];
  }
  const final = fixture.final;
  const healthy =
    final.profile === "healthy" &&
    final.searchRequests > 0 &&
    final.responses.success === final.searchRequests &&
    final.responses.rateLimited === 0 &&
    final.responses.serverError === 0;
  return healthy
    ? []
    : [finding("invalid-provider-fixture-binding", "deterministic fixture binding is not healthy")];
}

function inspectReports(
  set: SearchQualityEvaluationSet,
  reports: ReadonlyMap<string, SearchQualityLoadSmokeReport>,
  expectedTargetRevision?: string,
): Evidence {
  const evidence: Evidence = {
    findings: [],
    rankings: new Map(),
    revisions: new Set(),
    p95: null,
    requests: 0,
    errors: 0,
  };
  if (expectedTargetRevision === undefined) {
    evidence.findings.push(
      finding("missing-target-revision-binding", "expected target revision is required"),
    );
  }
  for (const query of set.queries) {
    const add = (code: string, message: string) => evidence.findings.push(finding(code, message));
    const report = reports.get(query.id);
    if (report === undefined) {
      evidence.findings.push(finding("missing-report", "evaluation query has no v5 report"));
      continue;
    }
    if (report.config.query !== query.query) add("query-mismatch", "report query does not match");
    if (report.config.workingTreeDirty) add("dirty-report", "report working tree is dirty");
    if (
      expectedTargetRevision !== undefined &&
      report.config.targetRevision !== expectedTargetRevision
    ) {
      add("target-revision-mismatch", "report target revision does not match the invocation");
    }
    evidence.findings.push(...inspectProviderBinding(set.evidenceScope, report));
    evidence.revisions.add(report.config.targetRevision);
    const ranking = readRanking(report, evidence.findings);
    if (ranking !== null) evidence.rankings.set(query.id, ranking.slice(0, set.sampleLimit));
    const endpoint = report.cohorts[0].endpoints.find((item) => item.endpoint === QUERY_ENDPOINT);
    if (endpoint !== undefined) {
      evidence.p95 = Math.max(evidence.p95 ?? 0, endpoint.p95);
      evidence.requests += endpoint.count;
      evidence.errors += endpoint.count - endpoint.outcomes["2xx"];
    }
  }
  if (evidence.revisions.size > 1) {
    evidence.findings.push(finding("mixed-revision", "reports use different revisions"));
  }
  return evidence;
}

function inspectPolicy(
  set: SearchQualityEvaluationSet,
  reports: ReadonlyMap<string, SearchQualityLoadSmokeReport>,
  policy: SearchQualityReleasePolicy,
  digest: string,
  now: Date,
): Finding[] {
  const findings: Finding[] = [];
  if (policy.evaluationSet.id !== set.id || policy.evaluationSet.version !== set.version) {
    findings.push(finding("policy-set-mismatch", "policy set identity does not match"));
  }
  if (policy.evaluationSet.sha256 !== digest) {
    findings.push(finding("policy-set-digest-mismatch", "policy set digest does not match"));
  }
  if (policy.thresholds.knownItemRecall.atK > set.sampleLimit) {
    findings.push(finding("policy-sample-limit-mismatch", "recall cutoff exceeds sample limit"));
  }
  const approvedAt = new Date(policy.approvedAt).getTime();
  const freshness = policy.evidenceFreshnessHours * 3_600_000;
  for (const query of set.queries) {
    const add = (code: string, message: string) => findings.push(finding(code, message));
    const report = reports.get(query.id);
    if (report === undefined) continue;
    const generatedAt = new Date(report.generatedAt).getTime();
    if (generatedAt > now.getTime() + 300_000) add("future-report", "report is future dated");
    if (generatedAt < approvedAt) add("pre-approval-report", "report predates the policy");
    if (now.getTime() - generatedAt > freshness) add("stale-report", "report is stale");
  }
  return findings;
}

function status(
  value: number | null,
  threshold: number | null,
  min: boolean,
  scope: string,
): Status {
  if (value === null) return "missing";
  if (scope === "deterministic-wiring") return "not-applicable";
  if (threshold === null) return "unapproved";
  return (min ? value >= threshold : value <= threshold) ? "pass" : "fail";
}
function buildMetrics(
  set: SearchQualityEvaluationSet,
  evidence: Evidence,
  policy?: SearchQualityReleasePolicy,
): Metrics {
  const thresholds = policy?.thresholds;
  const atK = thresholds?.knownItemRecall.atK ?? set.sampleLimit;
  let numerator = 0;
  let denominator = 0;
  let recallComplete = true;
  for (const query of set.queries) {
    if (query.evaluation.type !== "known-item") continue;
    const ranking = evidence.rankings.get(query.id);
    if (ranking === undefined) {
      recallComplete = false;
      continue;
    }
    const expected = query.evaluation.expectedPaperIds;
    const topK = new Set(ranking.slice(0, atK));
    denominator += expected.length;
    numerator += expected.filter((id) => topK.has(id)).length;
  }
  const recall = recallComplete && denominator > 0 ? numerator / denominator : null;
  const topicScores = set.queries
    .filter((query) => query.evaluation.type === "topic")
    .map((query) => {
      const ranking = evidence.rankings.get(query.id);
      return ranking === undefined || query.evaluation.type !== "topic"
        ? null
        : calculateNdcgAt10(ranking, query.evaluation.judgments);
    });
  const topic = topicScores.some((score) => score === null)
    ? null
    : (topicScores as number[]).reduce((sum, score) => sum + score, 0) / topicScores.length;
  const errorRate = evidence.requests > 0 ? evidence.errors / evidence.requests : null;
  const metric = (value: number | null, threshold: number | null, min: boolean): Metric => ({
    observed: value,
    threshold,
    status: status(value, threshold, min, set.evidenceScope),
  });
  return {
    queryP95MsMax: metric(evidence.p95, thresholds?.queryP95MsMax ?? null, false),
    queryErrorRate: metric(errorRate, thresholds?.queryErrorRateMax ?? null, false),
    knownItemRecall: {
      ...metric(recall, thresholds?.knownItemRecall.min ?? null, true),
      atK,
      numerator,
      denominator,
    },
    topicMeanNdcgAt10: {
      ...metric(topic, thresholds?.topicMeanNdcgAt10Min ?? null, true),
      queryCount: topicScores.length,
    },
  };
}

function inspectDeterministicIntegrity(
  set: SearchQualityEvaluationSet,
  evidence: Evidence,
  metrics: Metrics,
): Finding[] {
  const preservesOrder = (query: SearchQualityEvaluationSet["queries"][number]) => {
    const ranking = evidence.rankings.get(query.id);
    const expected =
      query.evaluation.type === "known-item"
        ? query.evaluation.expectedPaperIds
        : query.evaluation.judgments.map((item) => item.paperId);
    return ranking !== undefined && expected.every((paperId, index) => ranking[index] === paperId);
  };
  const findings: Finding[] = [];
  if (
    set.queries.some((query) => query.evaluation.type === "known-item" && !preservesOrder(query))
  ) {
    findings.push(
      finding(
        "deterministic-known-item-mismatch",
        "deterministic known-item identity or order is not preserved",
      ),
    );
  }
  if (set.queries.some((query) => query.evaluation.type === "topic" && !preservesOrder(query))) {
    findings.push(
      finding("deterministic-topic-order-mismatch", "deterministic topic order is not preserved"),
    );
  }
  if (metrics.queryErrorRate.observed !== 0) {
    findings.push(
      finding(
        "deterministic-query-transport-mismatch",
        "deterministic query transport is not exact",
      ),
    );
  }
  return findings;
}

function release(
  set: SearchQualityEvaluationSet,
  findings: readonly Finding[],
  metrics: Metrics,
  policy?: SearchQualityReleasePolicy,
) {
  const reasons = findings.map((item) => item.message);
  let verdict: "go" | "no-go" | "not-applicable";
  if (set.evidenceScope === "deterministic-wiring") {
    verdict = "not-applicable";
    reasons.push("deterministic wiring evidence cannot authorize a release");
  } else {
    if (policy !== undefined) {
      reasons.push(
        ...Object.entries(metrics as Record<keyof Metrics, Metric>)
          .filter(([, metric]) => metric.status !== "pass")
          .map(([name, metric]) => `${name} is ${metric.status}`),
      );
    }
    reasons.push("protected search-quality release authority is not available");
    verdict = "no-go";
  }
  return {
    verdict,
    reasons,
    policyVersion: policy === undefined ? null : opaqueReference(policy.policyVersion),
    pauseOwner: policy === undefined ? null : opaqueReference(policy.rollout.pauseOwner),
    rollbackOwner: policy === undefined ? null : opaqueReference(policy.rollout.rollbackOwner),
    resumeOwner: policy === undefined ? null : opaqueReference(policy.rollout.resumeOwner),
  };
}

export function evaluateSearchQuality(
  set: SearchQualityEvaluationSet,
  inputs: readonly SearchQualityReportInput[],
  policy?: SearchQualityReleasePolicy,
  now = new Date(),
  expectedTargetRevision?: string,
) {
  if (Number.isNaN(now.getTime())) throw new Error("evaluation time is invalid");
  if (expectedTargetRevision !== undefined) {
    parseSearchQualityExpectedTargetRevision(expectedTargetRevision);
  }
  const reports = indexReports(set, inputs);
  const evidence = inspectReports(set, reports, expectedTargetRevision);
  const digest = getEvaluationSetSha256(set);
  if (policy !== undefined) {
    evidence.findings.push(...inspectPolicy(set, reports, policy, digest, now));
  } else if (set.evidenceScope === "bounded-live") {
    evidence.findings.push(
      finding("missing-release-policy", "bounded live evidence has no approved release policy"),
    );
  }
  const metrics = buildMetrics(set, evidence, policy);
  if (set.evidenceScope === "deterministic-wiring") {
    evidence.findings.push(...inspectDeterministicIntegrity(set, evidence, metrics));
  }
  return {
    schemaVersion: "1",
    evaluationSet: {
      id: opaqueReference(set.id),
      version: opaqueReference(set.version),
      sha256: digest,
      evidenceScope: set.evidenceScope,
    },
    targetRevision: evidence.revisions.size === 1 ? ([...evidence.revisions][0] ?? null) : null,
    evidence: { complete: evidence.findings.length === 0, findings: evidence.findings },
    metrics,
    release: release(set, evidence.findings, metrics, policy),
  };
}

export type SearchQualityEvaluationResult = ReturnType<typeof evaluateSearchQuality>;

export function isSuccessfulSearchQualityEvaluation(
  result: SearchQualityEvaluationResult,
): boolean {
  if (!result.evidence.complete) return false;
  if (result.evaluationSet.evidenceScope !== "deterministic-wiring") return false;
  return Object.values(result.metrics as Record<keyof Metrics, Metric>).every(
    (metric) => metric.status === "not-applicable",
  );
}
