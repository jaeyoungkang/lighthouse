import { describe, expect, it } from "vitest";
import { ENDPOINT_LABELS } from "../../load-smoke/metrics";
import { buildProviderFixtureEvidence } from "../../load-smoke/provider-stats";
import {
  SEARCH_QUALITY_EXPECTED_WORKFLOW_REF,
  buildSearchQualityEvidenceCandidate,
  selfCheckSearchQualityEvidenceCandidate,
  type RawSearchQualityReportInput,
  type SearchQualityEvidenceInvocation,
} from "../attestation";
import { parseSearchQualityEvaluationSet } from "../contract";
import setFixture from "../fixtures/deterministic-wiring.v1.json";

const SHA = "a".repeat(40);
const set = () => parseSearchQualityEvaluationSet(setFixture);

function successfulEndpoint(endpoint: string) {
  return {
    endpoint,
    count: 1,
    outcomes: { "2xx": 1, "4xx": 0, "5xx": 0, timeout: 0, "network-error": 0 },
    p95: 50,
  };
}

function replaceRaw(input: RawSearchQualityReportInput, before: string, after: string) {
  return { ...input, raw: Buffer.from(input.raw.toString("utf8").replace(before, after)) };
}

function windowTimes() {
  const now = Date.now();
  return {
    started: new Date(now - 120_000).toISOString(),
    generated: new Date(now - 90_000).toISOString(),
    completed: new Date(now - 60_000).toISOString(),
  };
}

function invocation(times = windowTimes()): SearchQualityEvidenceInvocation {
  return {
    githubActions: "true",
    repository: "jaeyoungkang/lighthouse",
    eventName: "workflow_dispatch",
    ref: "refs/heads/main",
    workflowRef: SEARCH_QUALITY_EXPECTED_WORKFLOW_REF,
    workflowSha: SHA,
    targetRevision: SHA,
    actor: "operator",
    runId: "123",
    runAttempt: "1",
    pullRequestNumber: 0,
    collectionStartedAt: times.started,
    collectionCompletedAt: times.completed,
  };
}

function rawInputs(times = windowTimes()): RawSearchQualityReportInput[] {
  return set().queries.map((query) => {
    const paperIds =
      query.evaluation.type === "known-item"
        ? query.evaluation.expectedPaperIds
        : query.evaluation.judgments.map((item) => item.paperId);
    const baseline = {
      profile: "healthy" as const,
      configuredDelayMs: 0,
      configuredPaperCount: 3,
      searchRequests: 0,
      inFlight: 0,
      maxInFlight: 0,
      responses: { success: 0, rateLimited: 0, serverError: 0 },
    };
    const entryParams = new URLSearchParams({ q: query.query, entry: "route-bar" });
    const followupParams = new URLSearchParams({
      q: `${query.query} methods`,
      entry: "term",
      termSourceQuery: query.query,
      term: `${query.query} methods`,
      termType: "direct",
      termSupport: "1",
    });
    const requestPaths = [
      "/search",
      `/search?${entryParams.toString()}`,
      `/search?${followupParams.toString()}`,
    ];
    return {
      queryId: query.id,
      raw: Buffer.from(
        JSON.stringify({
          schemaVersion: "5",
          generatedAt: times.generated,
          config: {
            baseUrl: "http://127.0.0.1:3000",
            query: query.query,
            mode: "one-shot",
            targetRevision: SHA,
            workingTreeDirty: false,
            providerProfile: "local-fixture-healthy-v1",
            inputProfile: "search-quality-deterministic-wiring-v1",
            topologyProfile: "local-single-next-process",
            users: 1,
          },
          cohorts: [
            {
              users: 1,
              endpoints: (["searchPage", "querySearch", "followupEntry"] as const).map((key) =>
                successfulEndpoint(ENDPOINT_LABELS[key]),
              ),
              searchReadiness: [{ userIndex: 0, paperIds }],
              requestProvenance: (["searchPage", "querySearch", "followupEntry"] as const).map(
                (key, index) => ({
                  endpoint: ENDPOINT_LABELS[key],
                  userIndex: 0,
                  method: "GET",
                  requestPath: requestPaths[index],
                  finalUrl: `http://127.0.0.1:3000${requestPaths[index]}`,
                  redirectMode: "follow",
                }),
              ),
            },
          ],
          providerFixtureEvidence: buildProviderFixtureEvidence(
            "http://127.0.0.1:43123/__stats",
            baseline,
            {
              ...baseline,
              searchRequests: 1,
              maxInFlight: 1,
              responses: { success: 1, rateLimited: 0, serverError: 0 },
            },
            1,
          ),
        }),
      ),
    };
  });
}

describe("search-quality synthetic candidate evidence", () => {
  it("binds exact-main synthetic evidence without creating release authority", () => {
    const times = windowTimes();
    const currentInvocation = invocation(times);
    const inputs = rawInputs(times);
    const build = (
      overrides: Partial<Parameters<typeof buildSearchQualityEvidenceCandidate>[0]> = {},
    ) =>
      buildSearchQualityEvidenceCandidate({
        set: set(),
        rawInputs: inputs,
        invocation: currentInvocation,
        ...overrides,
      });
    const bundle = build();
    const verification = selfCheckSearchQualityEvidenceCandidate({
      bundle,
      set: set(),
      rawInputs: inputs,
      invocation: currentInvocation,
    });

    expect(bundle.authority).toEqual({
      evidenceScope: "synthetic-evidence-only",
      releaseAuthority: false,
      executionAuthority: false,
      currentnessAuthority: false,
      attestationAuthority: false,
      verificationMode: "target-self-recomputation",
    });
    expect(bundle.aggregate.release.verdict).toBe("not-applicable");
    expect(bundle.reports.count).toBe(3);
    expect(verification).toMatchObject({
      status: "target-self-check-passed",
      releaseAuthority: false,
      executionAuthority: false,
      currentnessAuthority: false,
      attestationAuthority: false,
    });
    const serialized = JSON.stringify(bundle);
    for (const query of set().queries) {
      expect(serialized).not.toContain(query.id);
      expect(serialized).not.toContain(query.query);
      for (const paperId of query.evaluation.type === "known-item"
        ? query.evaluation.expectedPaperIds
        : query.evaluation.judgments.map((item) => item.paperId)) {
        expect(serialized).not.toContain(paperId);
      }
    }
  });

  it("rejects tamper, replay, raw changes, and non-synthetic sets", () => {
    const times = windowTimes();
    const currentInvocation = invocation(times);
    const inputs = rawInputs(times);
    const build = (
      overrides: Partial<Parameters<typeof buildSearchQualityEvidenceCandidate>[0]> = {},
    ) =>
      buildSearchQualityEvidenceCandidate({
        set: set(),
        rawInputs: inputs,
        invocation: currentInvocation,
        ...overrides,
      });
    const bundle = build();
    const verify = (overrides = {}) =>
      selfCheckSearchQualityEvidenceCandidate({
        bundle,
        set: set(),
        rawInputs: inputs,
        invocation: currentInvocation,
        ...overrides,
      });
    const tampered = structuredClone(bundle);
    tampered.aggregate.metrics.queryP95MsMax.observed = 1;
    expect(() => verify({ bundle: tampered })).toThrow();
    expect(() => verify({ invocation: { ...currentInvocation, runAttempt: "2" } })).toThrow();
    expect(() =>
      verify({
        rawInputs: [
          { ...inputs[0], raw: Buffer.concat([inputs[0].raw, Buffer.from(" ")]) },
          ...inputs.slice(1),
        ],
      }),
    ).toThrow();

    const live = parseSearchQualityEvaluationSet({
      ...set(),
      evidenceScope: "bounded-live",
      queries: set().queries.map((query) => ({
        ...query,
        provenance: { ...query.provenance, source: "public-benchmark" },
      })),
    });
    expect(() => build({ set: live })).toThrow("accepts only the synthetic wiring set");
    expect(() =>
      build({ invocation: { ...currentInvocation, targetRevision: "0".repeat(40) } }),
    ).toThrow();
    for (const invalidInputs of [[...inputs, inputs[0]], inputs.slice(1)]) {
      expect(() => build({ rawInputs: invalidInputs })).toThrow(
        "exactly one report per evaluation query",
      );
    }
    const incompleteJourney = [
      replaceRaw(inputs[0], ENDPOINT_LABELS.searchPage, ENDPOINT_LABELS.followupEntry),
      ...inputs.slice(1),
    ];
    expect(() => build({ rawInputs: incompleteJourney })).toThrow("full one-shot search journey");

    const inconsistentOutcomes = [replaceRaw(inputs[0], '"5xx":0', '"5xx":1'), ...inputs.slice(1)];
    expect(() => build({ rawInputs: inconsistentOutcomes })).toThrow(
      "full one-shot search journey",
    );

    const extraEndpointReport = JSON.parse(inputs[0].raw.toString("utf8")) as {
      cohorts: Array<{ endpoints: Array<Record<string, unknown>> }>;
    };
    extraEndpointReport.cohorts[0].endpoints.push(successfulEndpoint("GET /undeclared"));
    expect(() =>
      build({
        rawInputs: [
          { ...inputs[0], raw: Buffer.from(JSON.stringify(extraEndpointReport)) },
          ...inputs.slice(1),
        ],
      }),
    ).toThrow("full one-shot search journey");
    expect(() =>
      build({ rawInputs: [{ ...inputs[0], raw: Buffer.from([0xff]) }, ...inputs.slice(1)] }),
    ).toThrow();

    const redirected = [
      replaceRaw(
        inputs[0],
        "http://127.0.0.1:3000/search",
        "http://127.0.0.1:3000/redirected-search",
      ),
      ...inputs.slice(1),
    ];
    expect(() => build({ rawInputs: redirected })).toThrow(
      "request path or final URL provenance is invalid",
    );

    const pathDrift = [
      replaceRaw(inputs[0], '"requestPath":"/search"', '"requestPath":"/other"'),
      ...inputs.slice(1),
    ];
    expect(() => build({ rawInputs: pathDrift })).toThrow(
      "request path or final URL provenance is invalid",
    );
  });
});
