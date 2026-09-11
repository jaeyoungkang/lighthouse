import { describe, expect, it } from "vitest";
import {
  buildLoadSmokeReportPayload,
  classifyOutcome,
  ENDPOINT_LABELS,
  findFirstWorkloadBreak,
  formatCohortReport,
  formatRampTable,
  formatSustainedReport,
  getCohortGoNoGoVerdict,
  getSustainedGoNoGoVerdict,
  parseServerTiming,
  SEARCH_P95_BUDGET_MS,
  summarizeCohort,
  type CohortResult,
  type RequestRecord,
} from "../metrics";

describe("request metric primitives", () => {
  it.each([
    [199, "5xx"],
    [200, "2xx"],
    [399, "2xx"],
    [400, "4xx"],
    [499, "4xx"],
    [500, "5xx"],
  ] as const)("classifies HTTP %s as %s", (status, outcome) => {
    expect(classifyOutcome(status)).toBe(outcome);
  });

  it("parses finite Server-Timing phases and ignores malformed entries", () => {
    expect(parseServerTiming(null)).toEqual({});
    expect(parseServerTiming("   ")).toEqual({});
    expect(
      parseServerTiming("db;desc=primary;dur=12.5, cache;dur=3, missing, bad;dur=NaN, ;dur=4"),
    ).toEqual({ db: 12.5, cache: 3 });
  });
});

function searchAnchorStats(p95: number): CohortResult["endpoints"][number] {
  return {
    endpoint: ENDPOINT_LABELS.querySearch,
    count: 2,
    outcomes: { "2xx": 2, "4xx": 0, "5xx": 0, timeout: 0, "network-error": 0 },
    p50: p95,
    p95,
    p99: p95,
    max: p95,
  };
}

function cohort(overrides: Partial<CohortResult> = {}): CohortResult {
  return {
    users: 2,
    wallClockMs: 100,
    endpoints: [searchAnchorStats(1_200)],
    serverTimingPhases: [],
    searchReadiness: [
      { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
      { userIndex: 1, paperIds: ["paper-1"] },
    ],
    totalErrorCount: 0,
    firstRequestFailure: null,
    ...overrides,
  };
}

describe("getCohortGoNoGoVerdict", () => {
  it("passes only when every user is ready with papers without 5xx or timeout and search p95 stays inside budget", () => {
    expect(getCohortGoNoGoVerdict(cohort())).toEqual({ ok: true, reasons: [] });
  });

  it("stays green when search p95 sits just under the budget", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({ endpoints: [searchAnchorStats(SEARCH_P95_BUDGET_MS - 1)] }),
    );

    expect(verdict).toEqual({ ok: true, reasons: [] });
  });

  it("fails when the search anchor p95 reaches the budget", () => {
    const verdict = getCohortGoNoGoVerdict(cohort({ endpoints: [searchAnchorStats(3_200)] }));

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain(
      `${ENDPOINT_LABELS.querySearch} p95 3200.0ms >= 3000ms budget`,
    );
  });

  it("fails when the budget boundary is hit exactly (green requires strictly under 3,000ms)", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({ endpoints: [searchAnchorStats(SEARCH_P95_BUDGET_MS)] }),
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain(
      `${ENDPOINT_LABELS.querySearch} p95 3000.0ms >= 3000ms budget`,
    );
  });

  it("fails instead of silently passing when the run produced no search anchor samples", () => {
    const missingAnchor = getCohortGoNoGoVerdict(cohort({ endpoints: [] }));
    const zeroSamples = getCohortGoNoGoVerdict(
      cohort({ endpoints: [{ ...searchAnchorStats(0), count: 0 }] }),
    );

    expect(missingAnchor.ok).toBe(false);
    expect(missingAnchor.reasons).toContain(
      `no ${ENDPOINT_LABELS.querySearch} samples — p95 unmeasured`,
    );
    expect(zeroSamples.ok).toBe(false);
    expect(zeroSamples.reasons).toContain(
      `no ${ENDPOINT_LABELS.querySearch} samples — p95 unmeasured`,
    );
  });

  it("fails when any request produced a 5xx or timeout", () => {
    const verdict = getCohortGoNoGoVerdict(cohort({ totalErrorCount: 1 }));

    expect(verdict).toEqual({
      ok: false,
      reasons: ["1 5xx/timeout/network-error request(s)"],
    });
  });

  it("fails when a cohort finishes without every user ready with papers", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({
        searchReadiness: [
          { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
          { userIndex: 1, paperIds: [] },
        ],
      }),
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("1/2 users ready with papers");
  });

  it("counts an unreadable search result as an explicit user error", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({
        searchReadiness: [
          { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
          { userIndex: 1, paperIds: null },
        ],
      }),
    );

    expect(verdict).toEqual({ ok: false, reasons: ["1/2 users ready with papers"] });
  });

  it("selects the search anchor even when another endpoint appears first", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({
        endpoints: [
          { ...searchAnchorStats(10), endpoint: ENDPOINT_LABELS.enrich },
          searchAnchorStats(SEARCH_P95_BUDGET_MS),
        ],
      }),
    );

    expect(verdict.reasons).toContain(
      `${ENDPOINT_LABELS.querySearch} p95 3000.0ms >= 3000ms budget`,
    );
  });

  it("fails closed when a report carries an empty paper identity", () => {
    const invalidIdentity = cohort({
      searchReadiness: [
        { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
        { userIndex: 1, paperIds: [""] },
      ],
    });
    const verdict = getCohortGoNoGoVerdict(invalidIdentity);
    const report = formatCohortReport(invalidIdentity);

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("user 1 has invalid search paper identities");
    expect(verdict.reasons).toContain("1/2 users ready with papers");
    expect(report).toMatch(/ready-with-papers\s+1/);
  });

  it("fails closed when one readiness entry repeats a paper identity", () => {
    const verdict = getCohortGoNoGoVerdict(
      cohort({
        searchReadiness: [
          { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
          { userIndex: 1, paperIds: ["paper-1", "paper-1"] },
        ],
      }),
    );

    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("user 1 has invalid search paper identities");
    expect(verdict.reasons).toContain("1/2 users ready with papers");
  });

  it("fails closed when duplicate, missing, or invalid user identities replace cohort evidence", () => {
    const duplicate = getCohortGoNoGoVerdict(
      cohort({
        searchReadiness: [
          { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
          { userIndex: 0, paperIds: ["paper-1"] },
        ],
      }),
    );
    const invalid = getCohortGoNoGoVerdict(
      cohort({
        searchReadiness: [
          { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
          { userIndex: 2.5, paperIds: ["paper-1"] },
        ],
      }),
    );

    expect(duplicate.ok).toBe(false);
    expect(duplicate.reasons).toContain("duplicate search readiness for user 0");
    expect(duplicate.reasons).toContain("missing search readiness for user(s) 1");
    expect(duplicate.reasons).toContain("1/2 users ready with papers");
    expect(invalid.ok).toBe(false);
    expect(invalid.reasons).toContain("invalid search readiness user index 2.5");
    expect(invalid.reasons).toContain("missing search readiness for user(s) 1");
  });
});

describe("summarizeCohort", () => {
  it("aggregates endpoint percentiles, outcome buckets, and search timing phases", () => {
    const summary = summarizeCohort(2, 100, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1", "paper-2"],
        records: [
          {
            endpoint: ENDPOINT_LABELS.querySearch,
            userIndex: 0,
            outcome: "2xx",
            status: 200,
            latencyMs: 10,
            startOffsetMs: 0,
            serverTiming: { db: 3, cache: 1 },
          },
          {
            endpoint: ENDPOINT_LABELS.enrich,
            userIndex: 0,
            outcome: "5xx",
            status: 500,
            latencyMs: 30,
            startOffsetMs: 5,
          },
        ],
      },
      {
        userIndex: 1,
        documentId: null,
        paperIds: ["paper-1"],
        records: [
          {
            endpoint: ENDPOINT_LABELS.querySearch,
            userIndex: 1,
            outcome: "4xx",
            status: 429,
            latencyMs: 20,
            startOffsetMs: 10,
            serverTiming: { db: 5 },
          },
        ],
      },
    ]);

    expect(summary.endpoints).toEqual([
      {
        endpoint: ENDPOINT_LABELS.querySearch,
        count: 2,
        outcomes: { "2xx": 1, "4xx": 1, "5xx": 0, timeout: 0, "network-error": 0 },
        p50: 10,
        p95: 20,
        p99: 20,
        max: 20,
      },
      {
        endpoint: ENDPOINT_LABELS.enrich,
        count: 1,
        outcomes: { "2xx": 0, "4xx": 0, "5xx": 1, timeout: 0, "network-error": 0 },
        p50: 30,
        p95: 30,
        p99: 30,
        max: 30,
      },
    ]);
    expect(summary.serverTimingPhases).toEqual([
      { phase: "cache", count: 1, p50: 1, p95: 1, max: 1 },
      { phase: "db", count: 2, p50: 3, p95: 5, max: 5 },
    ]);
    expect(summary.totalErrorCount).toBe(1);
    expect(summary.firstRequestFailure).toEqual({
      endpoint: ENDPOINT_LABELS.enrich,
      userIndex: 0,
      outcome: "5xx",
      status: 500,
      atMs: 5,
    });
  });

  it("preserves exact request paths and redirect-resolved URLs when the journey observed them", () => {
    const summary = summarizeCohort(1, 10, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1"],
        records: [
          {
            endpoint: ENDPOINT_LABELS.querySearch,
            userIndex: 0,
            outcome: "2xx",
            status: 200,
            latencyMs: 5,
            startOffsetMs: 0,
            method: "GET",
            requestPath: "/search?q=fixture&entry=route-bar",
            finalUrl: "http://127.0.0.1:3000/search?q=fixture&entry=route-bar",
            redirectMode: "follow",
          },
        ],
      },
    ]);

    expect(summary.requestProvenance).toEqual([
      {
        endpoint: ENDPOINT_LABELS.querySearch,
        userIndex: 0,
        method: "GET",
        requestPath: "/search?q=fixture&entry=route-bar",
        finalUrl: "http://127.0.0.1:3000/search?q=fixture&entry=route-bar",
        redirectMode: "follow",
      },
    ]);
  });

  it("counts network errors as collapse signals and first-break candidates", () => {
    const networkError: RequestRecord = {
      endpoint: ENDPOINT_LABELS.querySearch,
      userIndex: 1,
      outcome: "network-error",
      status: null,
      latencyMs: 5,
      startOffsetMs: 10,
    };
    const timeout: RequestRecord = {
      endpoint: ENDPOINT_LABELS.enrich,
      userIndex: 0,
      outcome: "timeout",
      status: null,
      latencyMs: 30_000,
      startOffsetMs: 50,
    };

    const summary = summarizeCohort(2, 100, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1", "paper-2"],
        records: [timeout],
      },
      {
        userIndex: 1,
        documentId: null,
        paperIds: null,
        records: [networkError],
      },
    ]);

    expect(summary.totalErrorCount).toBe(2);
    expect(summary.firstRequestFailure).toMatchObject({
      endpoint: ENDPOINT_LABELS.querySearch,
      outcome: "network-error",
      userIndex: 1,
    });
    expect(summary.searchReadiness).toEqual([
      { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
      { userIndex: 1, paperIds: null },
    ]);
  });

  it("rejects duplicate journey identities before producing a cohort artifact", () => {
    expect(() =>
      summarizeCohort(2, 100, [
        { userIndex: 0, documentId: null, paperIds: ["paper-1"], records: [] },
        { userIndex: 0, documentId: null, paperIds: ["paper-1"], records: [] },
      ]),
    ).toThrow("duplicate search readiness for user 0; missing search readiness for user(s) 1");
  });

  it("rejects invalid journey paper identities before aggregation", () => {
    expect(() =>
      summarizeCohort(1, 100, [{ userIndex: 0, documentId: null, paperIds: [""], records: [] }]),
    ).toThrow("invalid search paper identities for user 0");
  });

  it("ignores Server-Timing attached to non-search endpoints", () => {
    const summary = summarizeCohort(1, 100, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1"],
        records: [
          {
            endpoint: ENDPOINT_LABELS.enrich,
            userIndex: 0,
            outcome: "2xx",
            status: 200,
            latencyMs: 10,
            startOffsetMs: 0,
            serverTiming: { db: 99 },
          },
        ],
      },
    ]);

    expect(summary.serverTimingPhases).toEqual([]);
  });

  it("sorts unsorted latency samples before selecting percentile ranks", () => {
    const records = [40, 10, 30, 20].map<RequestRecord>((latencyMs, userIndex) => ({
      endpoint: ENDPOINT_LABELS.querySearch,
      userIndex,
      outcome: "2xx",
      status: 200,
      latencyMs,
      startOffsetMs: userIndex,
    }));
    const summary = summarizeCohort(
      4,
      40,
      records.map((record) => ({
        userIndex: record.userIndex,
        documentId: null,
        paperIds: ["paper-1"],
        records: [record],
      })),
    );

    expect(summary.endpoints[0]).toMatchObject({ p50: 20, p95: 40, p99: 40, max: 40 });
  });

  it("keeps canonical endpoints ahead of lexically ordered extension labels", () => {
    const labels = ["z-extension", ENDPOINT_LABELS.querySearch, "a-extension"];
    const summary = summarizeCohort(1, 10, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1"],
        records: labels.map<RequestRecord>((endpoint, index) => ({
          endpoint,
          userIndex: 0,
          outcome: "2xx",
          status: 200,
          latencyMs: index + 1,
          startOffsetMs: index,
        })),
      },
    ]);

    expect(summary.endpoints.map(({ endpoint }) => endpoint)).toEqual([
      ENDPOINT_LABELS.querySearch,
      "a-extension",
      "z-extension",
    ]);
  });

  it("distinguishes each invalid readiness identity boundary", () => {
    for (const invalidUserIndex of [-1, 0.5, 2]) {
      const verdict = getCohortGoNoGoVerdict(
        cohort({
          searchReadiness: [
            { userIndex: 0, paperIds: ["paper-1"] },
            { userIndex: invalidUserIndex, paperIds: ["paper-1"] },
          ],
        }),
      );

      expect(verdict.reasons).toContain(
        `invalid search readiness user index ${String(invalidUserIndex)}`,
      );
      expect(verdict.reasons).toContain("missing search readiness for user(s) 1");
    }
  });

  it("returns no first failure for successful records and preserves the first tied failure", () => {
    const tiedFailures: RequestRecord[] = [
      {
        endpoint: ENDPOINT_LABELS.enrich,
        userIndex: 0,
        outcome: "timeout",
        status: null,
        latencyMs: 30_000,
        startOffsetMs: 10,
      },
      {
        endpoint: ENDPOINT_LABELS.querySearch,
        userIndex: 0,
        outcome: "network-error",
        status: null,
        latencyMs: 1,
        startOffsetMs: 10,
      },
    ];
    const withFailure = summarizeCohort(1, 20, [
      { userIndex: 0, documentId: null, paperIds: ["paper-1"], records: tiedFailures },
    ]);
    const successful = summarizeCohort(1, 20, [
      {
        userIndex: 0,
        documentId: null,
        paperIds: ["paper-1"],
        records: [{ ...tiedFailures[0], outcome: "4xx", status: 429 }],
      },
    ]);

    expect(withFailure.firstRequestFailure).toMatchObject({
      endpoint: ENDPOINT_LABELS.enrich,
      outcome: "timeout",
    });
    expect(successful.firstRequestFailure).toBeNull();
  });
});

describe("ramp workload break", () => {
  it("reports the first cohort whose complete go/no-go verdict fails", () => {
    const cohorts = [
      cohort({
        users: 5,
        searchReadiness: Array.from({ length: 5 }, (_unused, userIndex) => ({
          userIndex,
          paperIds: ["paper-1"],
        })),
      }),
      cohort({
        users: 10,
        searchReadiness: Array.from({ length: 10 }, (_unused, userIndex) =>
          userIndex === 9 ? { userIndex, paperIds: [] } : { userIndex, paperIds: ["paper-1"] },
        ),
      }),
      cohort({ users: 20, totalErrorCount: 1 }),
    ];

    expect(findFirstWorkloadBreak(cohorts)).toEqual({
      cohortIndex: 1,
      users: 10,
      reasons: ["9/10 users ready with papers"],
    });
    expect(formatRampTable(cohorts)).toContain(
      "First workload break: step 2 at 10 users — 9/10 users ready with papers",
    );
    const table = formatRampTable(cohorts);
    expect(table).toContain("RAMP SUMMARY");
    expect(table).toContain("PASS");
    expect(table).toContain("NO-GO");
    expect(table.endsWith("\n")).toBe(true);
  });

  it("treats identity-invalid cohort evidence as the first workload break", () => {
    const valid = cohort();
    const invalid = cohort({
      searchReadiness: [
        { userIndex: 0, paperIds: ["paper-1"] },
        { userIndex: 0, paperIds: ["paper-1"] },
      ],
    });

    const firstBreak = findFirstWorkloadBreak([valid, invalid]);
    expect(firstBreak?.cohortIndex).toBe(1);
    expect(firstBreak?.users).toBe(2);
    expect(firstBreak?.reasons).toContain("duplicate search readiness for user 0");
  });
});

describe("load-smoke report schema", () => {
  const input = {
    generatedAt: "2026-07-14T00:00:00.000Z",
    runLabel: "q3-regression",
    node: "v24.5.0",
    config: {
      baseUrl: "http://localhost:3000",
      query: "graph retrieval",
      timeoutMs: 30_000,
      mode: "one-shot" as const,
      targetRevision: "0123456789abcdef0123456789abcdef01234567",
      workingTreeDirty: false,
      runOwner: "operational-readiness",
      inputProfile: "first-session-search-v1",
      providerProfile: "runtime-configured-live-path",
      topologyProfile: "loopback-target-unverified",
      users: 2,
    },
  };

  it("serializes v5 workload identity and ordered paper evidence without historical aliases", () => {
    const report = JSON.parse(
      JSON.stringify(buildLoadSmokeReportPayload(input, [cohort()])),
    ) as Record<string, unknown>;
    const cohorts = report.cohorts as Array<Record<string, unknown>>;

    expect(report.schemaVersion).toBe("5");
    expect(report).not.toHaveProperty("firstWorkloadBreak");
    expect(cohorts[0]).toHaveProperty("searchReadiness", [
      { userIndex: 0, paperIds: ["paper-1", "paper-2"] },
      { userIndex: 1, paperIds: ["paper-1"] },
    ]);
    expect(cohorts[0]).not.toHaveProperty("searchOutcomes");
    expect(cohorts[0]).not.toHaveProperty("firstBreak");
  });

  it("binds validated loopback fixture amplification evidence without making it mandatory", () => {
    const baseline = {
      profile: "healthy" as const,
      configuredDelayMs: 0,
      configuredPaperCount: 3,
      searchRequests: 0,
      inFlight: 0,
      maxInFlight: 0,
      responses: { success: 0, rateLimited: 0, serverError: 0 },
    };
    const providerFixtureEvidence = {
      source: "loopback-provider-fixture" as const,
      statsUrl: "http://127.0.0.1:43123/__stats",
      attribution: "zero-baseline" as const,
      baseline,
      final: {
        ...baseline,
        searchRequests: 4,
        maxInFlight: 2,
        responses: { success: 4, rateLimited: 0, serverError: 0 },
      },
      completedJourneys: 2,
      requestsPerCompletedJourney: 2,
    };
    const report = buildLoadSmokeReportPayload(
      input,
      [cohort()],
      undefined,
      providerFixtureEvidence,
    );

    expect(report.providerFixtureEvidence).toEqual(providerFixtureEvidence);
    expect(buildLoadSmokeReportPayload(input, [cohort()])).not.toHaveProperty(
      "providerFixtureEvidence",
    );
    expect(() =>
      buildLoadSmokeReportPayload(input, [cohort()], undefined, {
        ...providerFixtureEvidence,
        requestsPerCompletedJourney: 1,
      }),
    ).toThrow("derived fields are inconsistent");
    expect(() =>
      buildLoadSmokeReportPayload(input, [cohort()], undefined, {
        ...providerFixtureEvidence,
        completedJourneys: 1,
        requestsPerCompletedJourney: 4,
      }),
    ).toThrow("provider fixture evidence does not match workload completion");
  });

  it("accepts only complete SHA-1 or SHA-256 Git object IDs", () => {
    expect(() =>
      buildLoadSmokeReportPayload(
        { ...input, config: { ...input.config, targetRevision: "a".repeat(64) } },
        [cohort()],
      ),
    ).not.toThrow();
    for (const length of [41, 63]) {
      expect(() =>
        buildLoadSmokeReportPayload(
          { ...input, config: { ...input.config, targetRevision: "a".repeat(length) } },
          [cohort()],
        ),
      ).toThrow("load-smoke report requires an exact Git revision");
    }
  });

  it("rejects blank report identity fields", () => {
    for (const field of [
      "runOwner",
      "inputProfile",
      "providerProfile",
      "topologyProfile",
    ] as const) {
      expect(() =>
        buildLoadSmokeReportPayload({ ...input, config: { ...input.config, [field]: "   " } }, [
          cohort(),
        ]),
      ).toThrow(`load-smoke report requires non-empty ${field}`);
    }
  });

  it("rejects fields that contradict the selected workload mode", () => {
    expect(() =>
      buildLoadSmokeReportPayload({ ...input, config: { ...input.config, ramp: [2] } }, [cohort()]),
    ).toThrow("one-shot report cannot carry ramp config");
    expect(() =>
      buildLoadSmokeReportPayload(
        { ...input, config: { ...input.config, mode: "ramp", ramp: [2] } },
        [cohort()],
      ),
    ).toThrow("ramp report cannot carry users config");

    const openInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-open" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        concurrency: 2,
        arrivalRatePerSecond: 2,
        maxInFlight: 2,
      },
    };
    const workload = {
      arrivalModel: "open" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 60_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 0.03,
    };
    expect(() => buildLoadSmokeReportPayload(openInput, [cohort()], workload)).toThrow(
      "sustained-open report cannot carry concurrency config",
    );
  });

  it("serializes the first failing workload step for ramp reports", () => {
    const healthy = cohort();
    const failing = cohort({
      searchReadiness: [
        { userIndex: 0, paperIds: ["paper-1"] },
        { userIndex: 1, paperIds: [] },
      ],
    });
    const report = buildLoadSmokeReportPayload(
      { ...input, config: { ...input.config, mode: "ramp", users: undefined, ramp: [2, 2] } },
      [healthy, failing],
    );

    expect(report.firstWorkloadBreak).toEqual({
      cohortIndex: 1,
      users: 2,
      reasons: ["1/2 users ready with papers"],
    });
  });

  it("fails closed when sustained mode lacks matching arrival evidence", () => {
    const sustainedInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-open" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        arrivalRatePerSecond: 2,
        maxInFlight: 4,
      },
    };
    const workload = {
      arrivalModel: "open" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 61_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 0.03,
    };

    expect(() => buildLoadSmokeReportPayload(sustainedInput, [cohort()])).toThrow(
      "sustained-open report requires sustained workload evidence",
    );
    expect(() =>
      buildLoadSmokeReportPayload(
        {
          ...sustainedInput,
          config: {
            ...sustainedInput.config,
            mode: "sustained-closed",
            concurrency: 2,
            arrivalRatePerSecond: undefined,
            maxInFlight: undefined,
          },
        },
        [cohort()],
        workload,
      ),
    ).toThrow("sustained-closed report cannot carry open arrival evidence");

    const report = buildLoadSmokeReportPayload(sustainedInput, [cohort()], workload);
    expect(report.sustainedWorkload).toEqual(workload);
  });

  it("validates the full sustained-closed admission and timing envelope", () => {
    const closedInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-closed" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        concurrency: 2,
      },
    };
    const workload = {
      arrivalModel: "closed" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 61_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 2 / 61,
    };

    expect(() => buildLoadSmokeReportPayload(closedInput, [cohort()], workload)).not.toThrow();
    for (const [changedInput, changedWorkload, cohorts] of [
      [{ ...closedInput, config: { ...closedInput.config, warmupMs: 1 } }, workload, [cohort()]],
      [
        { ...closedInput, config: { ...closedInput.config, cooldownPolicy: undefined } },
        workload,
        [cohort()],
      ],
      [closedInput, { ...workload, configuredDurationMs: 59_999 }, [cohort()]],
      [
        closedInput,
        workload,
        [cohort({ users: 1, searchReadiness: [{ userIndex: 0, paperIds: ["paper-1"] }] })],
      ],
      [closedInput, { ...workload, scheduledArrivals: -1 }, [cohort()]],
      [closedInput, { ...workload, wallClockMs: Number.NaN }, [cohort()]],
      [closedInput, { ...workload, achievedThroughputPerSecond: -1 }, [cohort()]],
      [closedInput, { ...workload, completedJourneys: 3 }, [cohort()]],
      [{ ...closedInput, config: { ...closedInput.config, concurrency: 0 } }, workload, [cohort()]],
      [closedInput, { ...workload, scheduledArrivals: 3 }, [cohort()]],
      [closedInput, { ...workload, shedArrivals: 1 }, [cohort()]],
      [closedInput, { ...workload, maxInFlight: 3 }, [cohort()]],
    ] as const) {
      expect(() =>
        buildLoadSmokeReportPayload(changedInput, [...cohorts], changedWorkload),
      ).toThrow();
    }
  });

  it("rejects every sustained numeric boundary with its owning error", () => {
    const closedInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-closed" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        concurrency: 2,
      },
    };
    const workload = {
      arrivalModel: "closed" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 61_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 2 / 61,
    };
    const expectClosedError = (
      changedInput: Parameters<typeof buildLoadSmokeReportPayload>[0],
      changedWorkload: Parameters<typeof buildLoadSmokeReportPayload>[2],
      message: string,
      changedCohorts: CohortResult[] = [cohort()],
    ) => {
      expect(() =>
        buildLoadSmokeReportPayload(changedInput, changedCohorts, changedWorkload),
      ).toThrow(message);
    };

    for (const durationMs of [undefined, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
      expectClosedError(
        { ...closedInput, config: { ...closedInput.config, durationMs } },
        workload,
        "sustained-closed report requires a positive durationMs",
      );
    }
    for (const concurrency of [undefined, 0, 1.5]) {
      expectClosedError(
        { ...closedInput, config: { ...closedInput.config, concurrency } },
        workload,
        "sustained-closed report requires positive concurrency",
      );
    }
    for (const field of [
      "scheduledArrivals",
      "admittedJourneys",
      "completedJourneys",
      "shedArrivals",
      "maxInFlight",
    ] as const) {
      expectClosedError(
        closedInput,
        { ...workload, [field]: -1 },
        `sustained workload ${field} must be a non-negative integer`,
        field === "admittedJourneys" ? [cohort({ users: -1 })] : undefined,
      );
      expectClosedError(
        closedInput,
        { ...workload, [field]: 0.5 },
        `sustained workload ${field} must be a non-negative integer`,
        field === "admittedJourneys" ? [cohort({ users: 0.5 })] : undefined,
      );
    }
    for (const [field, value] of [
      ["wallClockMs", -1],
      ["wallClockMs", Number.NaN],
      ["achievedThroughputPerSecond", -1],
      ["achievedThroughputPerSecond", Number.NaN],
    ] as const) {
      expectClosedError(
        closedInput,
        { ...workload, [field]: value },
        "sustained workload timing and throughput must be finite and non-negative",
      );
    }
    expectClosedError(
      closedInput,
      { ...workload, completedJourneys: 3 },
      "sustained workload completion/admission counts are inconsistent",
    );
    expectClosedError(
      closedInput,
      { ...workload, scheduledArrivals: 1 },
      "sustained workload completion/admission counts are inconsistent",
    );
  });

  it("rejects each mode-specific field conflict independently", () => {
    const closedConfig = {
      ...input.config,
      mode: "sustained-closed" as const,
      users: undefined,
      durationMs: 60_000,
      warmupMs: 0,
      cooldownPolicy: "drain-admitted" as const,
      concurrency: 2,
    };
    for (const [field, value] of [
      ["users", 2],
      ["ramp", [2]],
      ["arrivalRatePerSecond", 2],
      ["maxInFlight", 2],
    ] as const) {
      expect(() =>
        buildLoadSmokeReportPayload(
          { ...input, config: { ...closedConfig, [field]: value } },
          [cohort()],
          {
            arrivalModel: "closed",
            configuredDurationMs: 60_000,
            wallClockMs: 60_000,
            scheduledArrivals: 2,
            admittedJourneys: 2,
            completedJourneys: 2,
            shedArrivals: 0,
            maxInFlight: 2,
            achievedThroughputPerSecond: 1,
          },
        ),
      ).toThrow(`sustained-closed report cannot carry ${field} config`);
    }

    const openConfig = {
      ...input.config,
      mode: "sustained-open" as const,
      users: undefined,
      durationMs: 60_000,
      warmupMs: 0,
      cooldownPolicy: "drain-admitted" as const,
      arrivalRatePerSecond: 2,
      maxInFlight: 2,
    };
    for (const [field, value] of [
      ["users", 2],
      ["ramp", [2]],
      ["concurrency", 2],
    ] as const) {
      expect(() =>
        buildLoadSmokeReportPayload(
          { ...input, config: { ...openConfig, [field]: value } },
          [cohort()],
          {
            arrivalModel: "open",
            configuredDurationMs: 60_000,
            wallClockMs: 60_000,
            scheduledArrivals: 2,
            admittedJourneys: 2,
            completedJourneys: 2,
            shedArrivals: 0,
            maxInFlight: 2,
            achievedThroughputPerSecond: 1,
          },
        ),
      ).toThrow(`sustained-open report cannot carry ${field} config`);
    }
  });

  it("isolates open-admission and one-shot/ramp schema failures", () => {
    const openInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-open" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        arrivalRatePerSecond: 2,
        maxInFlight: 2,
      },
    };
    const openWorkload = {
      arrivalModel: "open" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 60_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 1,
    };
    expect(() => buildLoadSmokeReportPayload(openInput, [cohort()], openWorkload)).not.toThrow();
    expect(() =>
      buildLoadSmokeReportPayload(openInput, [cohort()], {
        ...openWorkload,
        wallClockMs: 0,
        achievedThroughputPerSecond: 0,
      }),
    ).not.toThrow();
    for (const [field, value] of [
      ["arrivalRatePerSecond", undefined],
      ["arrivalRatePerSecond", 0],
      ["arrivalRatePerSecond", Number.NaN],
      ["arrivalRatePerSecond", Number.POSITIVE_INFINITY],
      ["maxInFlight", undefined],
      ["maxInFlight", 0],
      ["maxInFlight", 1.5],
    ] as const) {
      expect(() =>
        buildLoadSmokeReportPayload(
          { ...openInput, config: { ...openInput.config, [field]: value } },
          [cohort()],
          openWorkload,
        ),
      ).toThrow("sustained-open report requires positive arrival rate and max in-flight");
    }
    expect(() =>
      buildLoadSmokeReportPayload(openInput, [cohort()], {
        ...openWorkload,
        scheduledArrivals: 3,
      }),
    ).toThrow("sustained-open admission evidence is inconsistent with max in-flight");
    expect(() =>
      buildLoadSmokeReportPayload(openInput, [cohort()], { ...openWorkload, maxInFlight: 3 }),
    ).toThrow("sustained-open admission evidence is inconsistent with max in-flight");
    expect(() => buildLoadSmokeReportPayload(openInput, [], openWorkload)).toThrow(
      "sustained workload evidence must match exactly one admitted journey cohort",
    );
    expect(() =>
      buildLoadSmokeReportPayload(openInput, [cohort(), cohort()], openWorkload),
    ).toThrow("sustained workload evidence must match exactly one admitted journey cohort");
    expect(() => buildLoadSmokeReportPayload(input, [cohort()], openWorkload)).toThrow(
      "one-shot report cannot carry sustained workload evidence",
    );

    for (const users of [undefined, 0, 1.5, 3]) {
      expect(() =>
        buildLoadSmokeReportPayload({ ...input, config: { ...input.config, users } }, [cohort()]),
      ).toThrow("one-shot report requires exactly one matching positive user cohort");
    }
    expect(() => buildLoadSmokeReportPayload(input, [], undefined)).toThrow(
      "one-shot report requires exactly one matching positive user cohort",
    );

    const rampInput = {
      ...input,
      config: { ...input.config, mode: "ramp" as const, users: undefined, ramp: [2] },
    };
    expect(() => buildLoadSmokeReportPayload(rampInput, [cohort()])).not.toThrow();
    for (const ramp of [undefined, [], [0], [1.5], [2, 2]]) {
      expect(() =>
        buildLoadSmokeReportPayload({ ...rampInput, config: { ...rampInput.config, ramp } }, [
          cohort(),
        ]),
      ).toThrow("ramp report requires ordered cohorts matching every positive ramp step");
    }
    expect(() =>
      buildLoadSmokeReportPayload({ ...rampInput, config: { ...rampInput.config, ramp: [1] } }, [
        cohort(),
      ]),
    ).toThrow("ramp report requires ordered cohorts matching every positive ramp step");
    expect(() =>
      buildLoadSmokeReportPayload({ ...rampInput, config: { ...rampInput.config, ramp: [2, 0] } }, [
        cohort(),
        cohort(),
      ]),
    ).toThrow("ramp report requires ordered cohorts matching every positive ramp step");
  });

  it("rejects incomplete or internally inconsistent v3 evidence", () => {
    expect(() =>
      buildLoadSmokeReportPayload(
        {
          ...input,
          config: { ...input.config, targetRevision: "working-tree" },
        },
        [cohort()],
      ),
    ).toThrow("load-smoke report requires an exact Git revision");
    expect(() =>
      buildLoadSmokeReportPayload({ ...input, config: { ...input.config, users: 3 } }, [cohort()]),
    ).toThrow("one-shot report requires exactly one matching positive user cohort");
    expect(() =>
      buildLoadSmokeReportPayload(
        { ...input, config: { ...input.config, mode: "ramp", users: undefined, ramp: [2, 3] } },
        [cohort(), cohort()],
      ),
    ).toThrow("ramp report requires ordered cohorts matching every positive ramp step");

    const sustainedInput = {
      ...input,
      config: {
        ...input.config,
        mode: "sustained-open" as const,
        users: undefined,
        durationMs: 60_000,
        warmupMs: 0,
        cooldownPolicy: "drain-admitted" as const,
        arrivalRatePerSecond: 2,
        maxInFlight: 2,
      },
    };
    const inconsistentWorkload = {
      arrivalModel: "open" as const,
      configuredDurationMs: 60_000,
      wallClockMs: 61_000,
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 1,
      maxInFlight: 2,
      achievedThroughputPerSecond: 0.03,
    };

    expect(() =>
      buildLoadSmokeReportPayload(sustainedInput, [cohort()], inconsistentWorkload),
    ).toThrow("sustained-open admission evidence is inconsistent with max in-flight");
    expect(() =>
      buildLoadSmokeReportPayload(
        { ...sustainedInput, config: { ...sustainedInput.config, durationMs: undefined } },
        [cohort()],
        { ...inconsistentWorkload, shedArrivals: 0 },
      ),
    ).toThrow("sustained-open report requires a positive durationMs");
  });
});

describe("sustained workload verdict", () => {
  const workload = {
    arrivalModel: "open" as const,
    configuredDurationMs: 60_000,
    wallClockMs: 61_000,
    scheduledArrivals: 2,
    admittedJourneys: 2,
    completedJourneys: 2,
    shedArrivals: 0,
    maxInFlight: 2,
    achievedThroughputPerSecond: 0.03,
  };

  it("combines user outcome SLO with client admission and completion evidence", () => {
    expect(getSustainedGoNoGoVerdict(cohort(), workload)).toEqual({ ok: true, reasons: [] });

    const verdict = getSustainedGoNoGoVerdict(cohort(), {
      ...workload,
      completedJourneys: 1,
      shedArrivals: 3,
    });
    expect(verdict).toEqual({
      ok: false,
      reasons: ["1/2 admitted journeys completed", "3 client admission(s) shed"],
    });

    expect(getSustainedGoNoGoVerdict(cohort(), { ...workload, scheduledArrivals: 0 })).toEqual({
      ok: false,
      reasons: ["no sustained arrivals were scheduled"],
    });

    expect(getSustainedGoNoGoVerdict(cohort({ totalErrorCount: 1 }), workload)).toEqual({
      ok: false,
      reasons: ["1 5xx/timeout/network-error request(s)"],
    });
  });
});

describe("cohort report subject", () => {
  it("labels sustained evidence as admitted journeys without changing cohort concurrency output", () => {
    expect(formatCohortReport(cohort())).toContain("COHORT — 2 concurrent users");
    const sustainedReport = formatCohortReport(cohort(), "admitted-journeys");
    expect(sustainedReport).toContain("SUSTAINED RESULT — 2 admitted journeys");
    expect(sustainedReport).not.toContain("concurrent users");
  });

  it("prints the measured endpoint, readiness, and first-failure evidence", () => {
    const report = formatCohortReport(
      cohort({
        firstRequestFailure: {
          endpoint: ENDPOINT_LABELS.querySearch,
          userIndex: 1,
          outcome: "5xx",
          status: 503,
          atMs: 25,
        },
      }),
    );

    expect(report).toContain("Per-endpoint");
    expect(report).toContain(ENDPOINT_LABELS.querySearch);
    expect(report).toContain("ready-with-papers");
    expect(report).toContain("status 503, user 1, +25.0ms");
    expect(report.endsWith("\n")).toBe(true);
  });

  it("prints the sustained arrival and throughput envelope", () => {
    const report = formatSustainedReport({
      arrivalModel: "open",
      configuredDurationMs: 60_000,
      wallClockMs: 61_000,
      scheduledArrivals: 3,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 1,
      maxInFlight: 2,
      achievedThroughputPerSecond: 0.5,
    });

    expect(report).toContain("SUSTAINED WORKLOAD");
    expect(report).toContain("arrival model: open");
    expect(report).toContain("arrivals: 3   admitted: 2   completed: 2   client-shed: 1");
    expect(report).toContain("achieved journey throughput: 0.50/s");
  });
});
