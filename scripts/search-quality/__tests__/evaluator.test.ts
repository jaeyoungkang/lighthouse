import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getProviderFixturePaperId } from "../../load-smoke/provider-fixture";
import { buildProviderFixtureEvidence } from "../../load-smoke/provider-stats";
import {
  parseSearchQualityEvaluationSet,
  parseSearchQualityExpectedTargetRevision,
  parseSearchQualityLoadSmokeReport,
  parseSearchQualityReleasePolicy,
  type SearchQualityEvaluationSet,
} from "../contract";
import {
  evaluateSearchQuality,
  getEvaluationSetSha256,
  isSuccessfulSearchQualityEvaluation,
} from "../evaluator";
import setFixture from "../fixtures/deterministic-wiring.v1.json";

const SHA = "a".repeat(40);
const OTHER_SHA = "b".repeat(40);
const GENERATED_AT = "2026-08-29T00:00:00.000Z";
const loadSet = () => parseSearchQualityEvaluationSet(setFixture);

function fixtureEvidence(users: number) {
  const baseline = {
    profile: "healthy" as const,
    configuredDelayMs: 0,
    configuredPaperCount: 3,
    searchRequests: 0,
    inFlight: 0,
    maxInFlight: 0,
    responses: { success: 0, rateLimited: 0, serverError: 0 },
  };
  return buildProviderFixtureEvidence(
    "http://127.0.0.1:43123/__stats",
    baseline,
    {
      ...baseline,
      searchRequests: users,
      maxInFlight: users,
      responses: { success: users, rateLimited: 0, serverError: 0 },
    },
    users,
  );
}

function report(
  query: string,
  rankings: Array<string[] | null>,
  options: {
    generatedAt?: string;
    revision?: string;
    dirty?: boolean;
    fixture?: boolean;
    endpointCount?: number;
    outcomes?: {
      "2xx": number;
      "4xx": number;
      "5xx": number;
      timeout: number;
      "network-error": number;
    };
  } = {},
) {
  const users = rankings.length;
  const endpointCount = options.endpointCount ?? users;
  const outcomes = options.outcomes ?? {
    "2xx": endpointCount,
    "4xx": 0,
    "5xx": 0,
    timeout: 0,
    "network-error": 0,
  };
  return parseSearchQualityLoadSmokeReport({
    schemaVersion: "5",
    generatedAt: options.generatedAt ?? GENERATED_AT,
    config: {
      query,
      mode: "one-shot",
      targetRevision: options.revision ?? SHA,
      workingTreeDirty: options.dirty ?? false,
      providerProfile: "fixture-v1",
      users,
    },
    cohorts: [
      {
        users,
        endpoints: [
          {
            endpoint: "GET /search?q= (query execution)",
            count: endpointCount,
            outcomes,
            p95: 50,
          },
        ],
        searchReadiness: rankings.map((paperIds, userIndex) => ({ userIndex, paperIds })),
      },
    ],
    ...(options.fixture === false ? {} : { providerFixtureEvidence: fixtureEvidence(users) }),
  });
}

function completeReports(
  set: SearchQualityEvaluationSet,
  options: { fixture?: boolean; revision?: string } = {},
) {
  return set.queries.map((query) => ({
    queryId: query.id,
    report: report(
      query.query,
      [
        query.evaluation.type === "known-item"
          ? query.evaluation.expectedPaperIds
          : query.evaluation.judgments.map((item) => item.paperId),
      ],
      options,
    ),
  }));
}
const liveSet = (set: SearchQualityEvaluationSet) =>
  parseSearchQualityEvaluationSet({
    ...set,
    id: "search-quality-bounded-live",
    evidenceScope: "bounded-live",
    queries: set.queries.map((query) => ({
      ...query,
      provenance: { ...query.provenance, source: "public-benchmark" },
    })),
  });
function policy(set: SearchQualityEvaluationSet, digest = getEvaluationSetSha256(set)) {
  return parseSearchQualityReleasePolicy({
    schemaVersion: "1",
    policyVersion: "test-policy",
    evaluationSet: { id: set.id, version: set.version, sha256: digest },
    approvedAt: "2026-08-28T00:00:00.000Z",
    approvals: [
      { role: "human-product-owner", owner: "test", decisionRef: "test:human" },
      { role: "operational-readiness-owner", owner: "test", decisionRef: "test:or" },
    ],
    evidenceFreshnessHours: 48,
    thresholds: {
      queryP95MsMax: 100,
      queryErrorRateMax: 0,
      knownItemRecall: { atK: 10, min: 1 },
      topicMeanNdcgAt10Min: 0.9,
    },
    rollout: { pauseOwner: "pause", rollbackOwner: "rollback", resumeOwner: "resume" },
  });
}

describe("search-quality evaluation", () => {
  it("rejects incomplete sets, unsafe live provenance, and malformed report evidence", () => {
    const set = loadSet();
    expect(() =>
      parseSearchQualityEvaluationSet({ ...set, queries: set.queries.slice(0, 2) }),
    ).toThrow("evaluation set requires a topic query");
    expect(() =>
      parseSearchQualityEvaluationSet({ ...set, evidenceScope: "bounded-live" }),
    ).toThrow("bounded live sets cannot use synthetic provenance");
    const current = report(set.queries[0]?.query ?? "missing", [["paper-1"]]);
    expect(() =>
      parseSearchQualityLoadSmokeReport({
        ...current,
        cohorts: [{ ...current.cohorts[0], searchReadiness: [{ userIndex: 0, paperCount: 1 }] }],
      }),
    ).toThrow();
    expect(() =>
      report(set.queries[0]?.query ?? "missing", [["paper-1"]], {
        endpointCount: 2,
        outcomes: { "2xx": 2, "4xx": 0, "5xx": 0, timeout: 0, "network-error": 0 },
      }),
    ).toThrow("invalid query endpoint evidence");
    expect(() => parseSearchQualityExpectedTargetRevision("0".repeat(40))).toThrow(
      "revision cannot be the all-zero sentinel",
    );
    expect(() =>
      report(set.queries[0]?.query ?? "missing", [["paper-1"]], {
        revision: "0".repeat(64),
      }),
    ).toThrow("revision cannot be the all-zero sentinel");
  });

  it("evaluates deterministic wiring but never emits release go", () => {
    const set = loadSet();
    expect(set.queries.map((query) => query.kind)).toEqual(["doi", "title", "topic"]);
    const firstIds = set.queries.map((query) =>
      query.evaluation.type === "known-item"
        ? query.evaluation.expectedPaperIds[0]
        : query.evaluation.judgments[0]?.paperId,
    );
    expect(firstIds).toEqual(
      set.queries.map((query) => String(getProviderFixturePaperId(query.query, 0))),
    );
    const result = evaluateSearchQuality(set, completeReports(set), undefined, new Date(), SHA);
    expect(result.evidence.complete).toBe(true);
    expect(result.metrics.knownItemRecall).toMatchObject({
      observed: 1,
      numerator: 2,
      denominator: 2,
    });
    expect(result.metrics.topicMeanNdcgAt10.observed).toBe(1);
    expect(result.release.verdict).toBe("not-applicable");
    expect(isSuccessfulSearchQualityEvaluation(result)).toBe(true);
  });

  it.each([
    {
      name: "target revision differs without a policy",
      expectedCode: "target-revision-mismatch",
      expectedRevision: OTHER_SHA,
      change: () => undefined,
    },
    {
      name: "known-item identity is missing",
      expectedCode: "deterministic-known-item-mismatch",
      expectedRevision: SHA,
      change: (set: SearchQualityEvaluationSet, inputs: ReturnType<typeof completeReports>) => {
        const query = set.queries[0];
        inputs[0].report = report(query.query, [["wrong-paper"]]);
      },
    },
    {
      name: "topic order is reversed",
      expectedCode: "deterministic-topic-order-mismatch",
      expectedRevision: SHA,
      change: (set: SearchQualityEvaluationSet, inputs: ReturnType<typeof completeReports>) => {
        const index = set.queries.findIndex((query) => query.evaluation.type === "topic");
        const query = set.queries[index];
        if (query.evaluation.type === "topic") {
          inputs[index].report = report(query.query, [
            query.evaluation.judgments.map((item) => item.paperId).reverse(),
          ]);
        }
      },
    },
    {
      name: "query transport is not all 2xx",
      expectedCode: "deterministic-query-transport-mismatch",
      expectedRevision: SHA,
      change: (set: SearchQualityEvaluationSet, inputs: ReturnType<typeof completeReports>) => {
        const query = set.queries[0];
        if (query.evaluation.type === "known-item") {
          inputs[0].report = report(query.query, [query.evaluation.expectedPaperIds], {
            outcomes: { "2xx": 0, "4xx": 1, "5xx": 0, timeout: 0, "network-error": 0 },
          });
        }
      },
    },
  ])("fails deterministic wiring when $name", ({ expectedCode, expectedRevision, change }) => {
    const set = loadSet();
    const inputs = completeReports(set);
    change(set, inputs);
    const result = evaluateSearchQuality(set, inputs, undefined, new Date(), expectedRevision);
    expect(result.evidence.findings.map((item) => item.code)).toContain(expectedCode);
    expect(isSuccessfulSearchQualityEvaluation(result)).toBe(false);
  });

  it("fails closed on missing fixture, mixed revision, and inconsistent ranking", () => {
    const set = loadSet();
    const inputs = completeReports(set).slice(0, 2);
    inputs[0].report = report(set.queries[0]?.query ?? "missing", [["a"], ["b"]], {
      fixture: false,
      dirty: true,
    });
    inputs[1].report = report(set.queries[1]?.query ?? "missing", [["a"]], {
      revision: "b".repeat(40),
    });
    const result = evaluateSearchQuality(set, inputs, undefined, new Date(), SHA);
    expect(result.evidence.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "missing-report",
        "dirty-report",
        "missing-provider-fixture-binding",
        "mixed-revision",
        "inconsistent-ranking",
      ]),
    );
  });

  it("keeps bounded-live no-go before protected release authority exists", () => {
    const set = liveSet(loadSet());
    const reports = completeReports(set, { fixture: false });
    const withoutPolicy = evaluateSearchQuality(set, reports, undefined, new Date(), SHA);
    expect(withoutPolicy.evidence.findings.map((item) => item.code)).toContain(
      "missing-release-policy",
    );
    expect(withoutPolicy.release.verdict).toBe("no-go");
    const passingCandidate = evaluateSearchQuality(
      set,
      reports,
      policy(set),
      new Date("2026-08-29T01:00:00.000Z"),
      SHA,
    );
    expect(passingCandidate.evidence.complete).toBe(true);
    expect(passingCandidate.release.verdict).toBe("no-go");
    expect(passingCandidate.release.rollbackOwner).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(passingCandidate.release.reasons).toContain(
      "protected search-quality release authority is not available",
    );
    expect(isSuccessfulSearchQualityEvaluation(passingCandidate)).toBe(false);
  });

  it("rejects provider fixture evidence relabelled as bounded live", () => {
    const set = liveSet(loadSet());
    const result = evaluateSearchQuality(
      set,
      completeReports(set),
      policy(set),
      new Date("2026-08-29T01:00:00.000Z"),
      SHA,
    );
    expect(result.evidence.findings.map((item) => item.code)).toContain("fixture-evidence-in-live");
    expect(result.release.verdict).toBe("no-go");
  });

  it("rejects stale and digest-mismatched live evidence", () => {
    const set = liveSet(loadSet());
    const inputs = completeReports(set, { fixture: false });
    inputs[0] = {
      ...inputs[0],
      report: report(set.queries[0]?.query ?? "missing", [["paper"]], {
        generatedAt: "2026-08-20T00:00:00.000Z",
        fixture: false,
      }),
    };
    const result = evaluateSearchQuality(
      set,
      inputs,
      policy(set, "f".repeat(64)),
      new Date("2026-08-29T01:00:00.000Z"),
      SHA,
    );
    expect(result.evidence.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["policy-set-digest-mismatch", "pre-approval-report", "stale-report"]),
    );
    expect(result.release.verdict).toBe("no-go");
  });

  it("does not expose raw query or paper identity in results and errors", () => {
    const original = loadSet();
    const rawPaperId =
      original.queries[0].evaluation.type === "known-item"
        ? original.queries[0].evaluation.expectedPaperIds[0]
        : "missing";
    const set = parseSearchQualityEvaluationSet({
      ...original,
      id: rawPaperId,
      version: original.queries[1].id,
      queries: original.queries.map((query, index) =>
        index === 0 ? { ...query, id: rawPaperId } : query,
      ),
    });
    const inputs = completeReports(set);
    const basePolicy = policy(set);
    const releasePolicy = parseSearchQualityReleasePolicy({
      ...basePolicy,
      policyVersion: rawPaperId,
      rollout: {
        pauseOwner: rawPaperId,
        rollbackOwner: "Research Operations / On-call",
        resumeOwner: "owner@example.test",
      },
    });
    const result = evaluateSearchQuality(set, inputs, releasePolicy, new Date(), SHA);
    expect(Object.keys(result.evaluationSet)).toEqual(["id", "version", "sha256", "evidenceScope"]);
    expect(Object.keys(result.release)).toEqual([
      "verdict",
      "reasons",
      "policyVersion",
      "pauseOwner",
      "rollbackOwner",
      "resumeOwner",
    ]);
    expect(result.evaluationSet.id).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(result.evaluationSet.version).toMatch(/^sha256:[0-9a-f]{64}$/u);
    const serialized = JSON.stringify(result);
    for (const query of set.queries) {
      expect(serialized).not.toContain(query.query);
      expect(serialized).not.toContain(query.id);
      const paperIds =
        query.evaluation.type === "known-item"
          ? query.evaluation.expectedPaperIds
          : query.evaluation.judgments.map((item) => item.paperId);
      for (const paperId of paperIds) expect(serialized).not.toContain(paperId);
    }
    expect(serialized).not.toContain(releasePolicy.rollout.rollbackOwner);
    expect(serialized).not.toContain(releasePolicy.rollout.resumeOwner);

    const rawUnknownId = "10.5555/private-query-identity";
    let error: unknown;
    try {
      evaluateSearchQuality(
        set,
        [...inputs, { queryId: rawUnknownId, report: inputs[0].report }],
        undefined,
        new Date(),
        SHA,
      );
    } catch (caught) {
      error = caught;
    }
    expect(String(error)).toContain("unknown evaluation query ID");
    expect(String(error)).not.toContain(rawUnknownId);
  });

  it("keeps the existing fourth Date argument callable but never successful without a target", () => {
    const set = loadSet();
    const result = evaluateSearchQuality(
      set,
      completeReports(set),
      undefined,
      new Date("2026-08-29T01:00:00.000Z"),
    );
    expect(result.evidence.findings.map((item) => item.code)).toContain(
      "missing-target-revision-binding",
    );
    expect(result.evidence.complete).toBe(false);
    expect(isSuccessfulSearchQualityEvaluation(result)).toBe(false);
  });

  it("does not expose an input path or malformed identity when CLI input fails", () => {
    const missingPath = "/tmp/10.5555/private-paper-query.json";
    const missing = spawnSync(
      "./node_modules/.bin/tsx",
      ["scripts/search-quality/run.ts", "--set", missingPath, "--expected-target-revision", SHA],
      { cwd: process.cwd(), encoding: "utf8" },
    );
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("cannot read or parse JSON input");
    expect(missing.stderr).not.toContain(missingPath);

    const rawIdentity = "secret-paper";
    const directory = mkdtempSync(join(tmpdir(), "lighthouse-search-quality-"));
    const malformedPath = join(directory, `${rawIdentity}.json`);
    const original = loadSet();
    const first = original.queries[0];
    if (first.evaluation.type !== "known-item") throw new Error("fixture order changed");
    writeFileSync(
      malformedPath,
      JSON.stringify({
        ...original,
        [rawIdentity]: 1,
        queries: [
          {
            ...first,
            id: rawIdentity,
            evaluation: { ...first.evaluation, expectedPaperIds: [rawIdentity, rawIdentity] },
          },
          ...original.queries.slice(1),
        ],
      }),
    );
    try {
      const malformed = spawnSync(
        "./node_modules/.bin/tsx",
        [
          "scripts/search-quality/run.ts",
          "--set",
          malformedPath,
          "--expected-target-revision",
          SHA,
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(malformed.status).toBe(1);
      expect(malformed.stderr).toContain("input validation failed");
      expect(malformed.stderr).not.toContain(rawIdentity);
      expect(malformed.stderr).not.toContain(malformedPath);

      const validSetPath = join(directory, "set.json");
      const invalidReportPath = join(directory, `${rawIdentity}-report.json`);
      const invalidPolicyPath = join(directory, `${rawIdentity}-policy.json`);
      const validReport = completeReports(original)[0].report;
      writeFileSync(validSetPath, JSON.stringify(original));
      writeFileSync(
        invalidReportPath,
        JSON.stringify({
          ...validReport,
          providerFixtureEvidence: {
            ...validReport.providerFixtureEvidence,
            statsUrl: rawIdentity,
          },
        }),
      );
      const invalidReport = spawnSync(
        "./node_modules/.bin/tsx",
        [
          "scripts/search-quality/run.ts",
          "--set",
          validSetPath,
          "--report",
          `${original.queries[0].id}=${invalidReportPath}`,
          "--expected-target-revision",
          SHA,
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(invalidReport.status).toBe(1);
      expect(invalidReport.stderr).toContain("input validation failed");
      expect(invalidReport.stderr).not.toContain(rawIdentity);
      expect(invalidReport.stderr).not.toContain(invalidReportPath);

      writeFileSync(
        invalidPolicyPath,
        JSON.stringify({ ...policy(original), [rawIdentity]: true }),
      );
      const invalidPolicy = spawnSync(
        "./node_modules/.bin/tsx",
        [
          "scripts/search-quality/run.ts",
          "--set",
          validSetPath,
          "--policy",
          invalidPolicyPath,
          "--expected-target-revision",
          SHA,
        ],
        { cwd: process.cwd(), encoding: "utf8" },
      );
      expect(invalidPolicy.status).toBe(1);
      expect(invalidPolicy.stderr).toContain("input validation failed");
      expect(invalidPolicy.stderr).not.toContain(rawIdentity);
      expect(invalidPolicy.stderr).not.toContain(invalidPolicyPath);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
