import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  inspectBreakerTopology,
  inspectSearchCriticalPath,
  normalizeTestReport,
} from "../collect-q2-macro.mjs";

const ROOT = process.cwd();
const BREAKER = "app/server/external-http-gateway/episteme-circuit-breaker.ts";
const SEARCH = "app/server/services/search-execution.ts";
const PROBE = path.join(
  process.env.AF_Q2_TRUSTED_HARNESS_ROOT ?? ROOT,
  "scripts/architecture-fitness/q2-process-isolation-probe.ts",
);

function source(ref: string): string {
  return readFileSync(path.join(ROOT, ref), "utf8");
}

function keywordSearchBinding(value: string): string {
  const awaitedBinding = value.match(
    /const\s*\{\s*papers,\s*total,[\s\S]*?\}\s*=\s*await\s+([A-Za-z_$][\w$]*)\(/,
  );
  if (awaitedBinding) return awaitedBinding[1];
  const joinedBinding = value.match(/const\s+keywordFetchPromise\s*=\s*([A-Za-z_$][\w$]*)\(/);
  if (joinedBinding) return joinedBinding[1];
  throw new Error("keyword-search binding fixture not found");
}

function runProbePair() {
  const result = spawnSync(path.join(ROOT, "node_modules", ".bin", "tsx"), [PROBE, "pair"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 20_000,
  });
  if (result.error) throw result.error;
  if (result.status === null)
    throw new Error(`probe terminated by ${result.signal ?? "an unknown signal"}`);
  if (result.status !== 0)
    throw new Error(result.stderr || `probe exited ${String(result.status)}`);
  return JSON.parse(result.stdout) as {
    trip: { mode: string; circuitOpen: boolean };
    observe: { mode: string; circuitOpen: boolean };
  };
}

describe("Q2 deployment topology", () => {
  it("collects the process-local breaker state and coordination scope", () => {
    expect(inspectBreakerTopology(source(BREAKER))).toEqual({
      stateScopes: ["process"],
      coordinationScopes: ["process"],
    });
  });

  it("rejects a breaker inventory without its module-local circuit state", () => {
    const mutation = source(BREAKER).replace("const circuitLanes", "const movedCircuitLanes");
    expect(() => inspectBreakerTopology(mutation)).toThrow(/circuitLanes/);
  });

  it("rejects breaker state acquired from an external owner", () => {
    const mutation = source(BREAKER).replace(
      "const circuitLanes: Record<EpistemeBreakerLane, CircuitLaneState> = {",
      "const circuitLanes: Record<EpistemeBreakerLane, CircuitLaneState> = globalThis.sharedCircuitLanes; const ignoredCircuitLanes = {",
    );
    expect(() => inspectBreakerTopology(mutation)).toThrow(/circuitLanes/);
  });

  it("rejects a dummy local declaration when breaker operations use external state", () => {
    const mutation = source(BREAKER).replaceAll(
      "circuitLanes[lane]",
      "globalThis.sharedCircuitLanes[lane]",
    );
    expect(() => inspectBreakerTopology(mutation)).toThrow(/circuitLanes@advanceState/);
  });

  it("keeps a tripped breaker isolated from an independent process", () => {
    expect(runProbePair()).toEqual({
      trip: { mode: "trip", circuitOpen: true },
      observe: { mode: "observe", circuitOpen: false },
    });
  });
});

describe("Q2 first-ready search critical path", () => {
  it("collects the awaited phases separately from failure ownership", () => {
    expect(inspectSearchCriticalPath(source(SEARCH))).toEqual({
      awaitedPhases: [
        "phase:reviewed-library-source",
        "phase:keyword-search",
        "phase:library-preflight",
      ],
      failureBlockingPhases: ["phase:keyword-search"],
    });
  });

  it("keeps the keyword-search role stable when its imported binding is renamed", () => {
    const searchSource = source(SEARCH);
    const currentBinding = keywordSearchBinding(searchSource);
    const mutation = searchSource
      .replace(
        `buildSearchViewPayload, ${currentBinding}`,
        `buildSearchViewPayload, ${currentBinding} as loadKeywordPapersFromProvider`,
      )
      .replace(
        new RegExp(`(await\\s+|=\\s*)${currentBinding}\\(`),
        "$1loadKeywordPapersFromProvider(",
      );

    expect(inspectSearchCriticalPath(mutation)).toEqual(inspectSearchCriticalPath(source(SEARCH)));
  });

  it("rejects a keyword-search await whose owner is outside the search service", () => {
    const mutation = source(SEARCH).replace(
      'from "@/app/server/services/search-service";',
      'from "@/app/server/services/other-search-owner";',
    );

    expect(() => inspectSearchCriticalPath(mutation)).toThrow(/keyword-search role/);
  });

  it("rejects a local shadow of the imported keyword-search binding", () => {
    const searchSource = source(SEARCH);
    const currentBinding = keywordSearchBinding(searchSource);
    const mutation = searchSource.replace(
      "const keywordFetchStartedAt = Date.now();",
      `const ${currentBinding} = () => Promise.resolve({});
      const keywordFetchStartedAt = Date.now();`,
    );

    expect(() => inspectSearchCriticalPath(mutation)).toThrow(/keyword-search role/);
  });

  it("rejects more than one awaited call claiming the keyword-search role", () => {
    const searchSource = source(SEARCH);
    const currentBinding = keywordSearchBinding(searchSource);
    const mutation = searchSource.replace(
      "const keywordFetchStartedAt = Date.now();",
      `const { papers: duplicatePapers, total: duplicateTotal, source: duplicateSource } =
        await ${currentBinding}({} as never);
      void duplicatePapers;
      void duplicateTotal;
      void duplicateSource;
      const keywordFetchStartedAt = Date.now();`,
    );

    expect(() => inspectSearchCriticalPath(mutation)).toThrow(/observed 2/);
  });

  it("rejects an omitted library-preflight await", () => {
    const searchSource = source(SEARCH);
    const mutation = searchSource.includes(
      "Promise.all([keywordFetchPromise, libraryPreflightPromise])",
    )
      ? searchSource.replace(
          "Promise.all([keywordFetchPromise, libraryPreflightPromise])",
          "Promise.all([keywordFetchPromise, Promise.resolve(null)])",
        )
      : searchSource.replace(
          "const libraryPreflight = await libraryPreflightPromise;",
          "const libraryPreflight = null; // const libraryPreflight = await libraryPreflightPromise;",
        );
    expect(() => inspectSearchCriticalPath(mutation)).toThrow(/libraryPreflight/);
  });

  it("rejects removal of the library-preflight failure isolation", () => {
    const mutation = source(SEARCH).replace(
      "}).catch(() => null);",
      "}); // }).catch(() => null);",
    );
    expect(() => inspectSearchCriticalPath(mutation)).toThrow(
      /resolveLibraryNeighborhoodPreflight/,
    );
  });
});

describe("Q2 behavior evidence", () => {
  it("normalizes the trusted harness path across worktrees", () => {
    const resultFor = (trustedRoot: string) =>
      normalizeTestReport(
        {
          status: 0,
          stdout: JSON.stringify({
            numTotalTestSuites: 2,
            numPassedTestSuites: 2,
            numTotalTests: 2,
            numPassedTests: 2,
            testResults: [
              "scripts/architecture-fitness/__tests__/q2-macro-boundaries.test.ts",
              "app/server/services/__tests__/search-execution.test.ts",
            ].map((relative) => ({
              name: path.join(trustedRoot, relative),
              status: "passed",
              assertionResults: [{ fullName: "fixture", status: "passed" }],
            })),
          }),
          stderr: "",
        },
        "/tmp/materialized-target",
        trustedRoot,
      );

    expect(resultFor("/workspace/one")).toEqual(resultFor("/workspace/two"));
  });

  it("rejects a successful report that omitted a declared test file", () => {
    const report = normalizeTestReport(
      {
        status: 0,
        stdout: JSON.stringify({
          testResults: [
            {
              name: path.join(
                ROOT,
                "scripts/architecture-fitness/__tests__/q2-macro-boundaries.test.ts",
              ),
              status: "passed",
              assertionResults: [{ fullName: "fixture", status: "passed" }],
            },
            {
              name: path.join(ROOT, "app/server/services/__tests__/search-execution.test.ts"),
              status: "passed",
              assertionResults: [{ fullName: "fixture", status: "passed" }],
            },
          ],
        }),
        stderr: "",
      },
      ROOT,
    );

    expect(report.exitCode).toBe(1);
    expect(report.missingExpectedTests).toEqual([
      "scripts/architecture-fitness/__tests__/q2-search-failure-isolation.test.ts",
    ]);
  });

  it("rejects a filtered report that skipped a required behavior assertion", () => {
    const report = normalizeTestReport(
      {
        status: 0,
        stdout: JSON.stringify({
          testResults: [
            "scripts/architecture-fitness/__tests__/q2-macro-boundaries.test.ts",
            "app/server/services/__tests__/search-execution.test.ts",
            "scripts/architecture-fitness/__tests__/q2-search-failure-isolation.test.ts",
          ].map((relative) => ({
            name: path.join(ROOT, relative),
            status: "passed",
            assertionResults: [{ fullName: "required behavior", status: "skipped" }],
          })),
        }),
        stderr: "",
      },
      ROOT,
      ROOT,
      ["required behavior"],
    );

    expect(report.exitCode).toBe(1);
  });

  it("rejects an unparseable report even when the process exits zero", () => {
    expect(normalizeTestReport({ status: 0, stdout: "not-json", stderr: "" }, ROOT)).toMatchObject({
      exitCode: 1,
    });
  });
});
