#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runSearchFirstPaintNoDbGuard } from "../quality/check-search-first-paint-no-db.mjs";
import {
  SEARCH_STATE_BOUNDARY_SOURCE_FILES,
  runSearchStateBoundaryGuard,
} from "./check-search-state-boundaries.mjs";
import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";
import {
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "./path-test-command.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-search-state-boundary.mjs";
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const STATE_GUARD_REF = "scripts/architecture-fitness/check-search-state-boundaries.mjs";
const STATE_ANALYSIS_REF = "scripts/architecture-fitness/state-boundary-analysis.mjs";
const FIRST_PAINT_GUARD_REF = "scripts/quality/check-search-first-paint-no-db.mjs";
const GUARD_EXCEPTION_POLICY_REF = "scripts/quality/guard-exception-policy.mjs";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_REF = "issue-276:keyword-search-state-boundary";
const CAPABILITY_REF = "capability:keyword-search-route-state";
const TARGET_IDENTITY_TEST = "app/server/services/__tests__/ephemeral-view-id.test.ts";
const PRODUCTION_IDENTITY_TEST = "app/server/services/__tests__/search-execution.test.ts";
const TRUSTED_IDENTITY_TEST =
  "scripts/architecture-fitness/__tests__/trusted-search-view-identity.test.ts";
const TRUSTED_IDENTITY_TEST_SOURCE = `
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";

describe("trusted ephemeral search identity contract", () => {
  it("derives SHA-256 identity only from the canonical execution condition", () => {
    const canonicalKey = "q=graph+retrieval&sort=year";
    const expected = \`search-ephemeral-\${createHash("sha256")
      .update(canonicalKey, "utf8")
      .digest("hex")}\`;
    expect(buildEphemeralSearchViewId(canonicalKey)).toBe(expected);
    expect(buildEphemeralSearchViewId("q=graph+retrieval")).not.toBe(expected);
    expect(buildEphemeralSearchViewId("q=bex9j8+q6d1kt")).not.toBe(
      buildEphemeralSearchViewId("q=w9awp+1l9jjoz"),
    );
  });
});
`;
const PATH_TESTS = [
  "app/(research)/__tests__/research-routes.test.tsx",
  "app/components/research/__tests__/ResearchRouteSearchBar.test.tsx",
  "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
  PRODUCTION_IDENTITY_TEST,
  TARGET_IDENTITY_TEST,
  TRUSTED_IDENTITY_TEST,
  "scripts/quality/__tests__/check-search-first-paint-no-db.test.ts",
];
const ZERO_DIGEST = "0".repeat(64);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalDigest(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function git(args, { encoding = "utf8", input } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${result.status}`);
  }
  return result.stdout;
}

export async function searchStateCollectorDefinitionDigest() {
  const definitions = [];
  for (const relative of [
    COLLECTOR_REF,
    STATE_GUARD_REF,
    STATE_ANALYSIS_REF,
    FIRST_PAINT_GUARD_REF,
    GUARD_EXCEPTION_POLICY_REF,
    TRUST_POLICY_REF,
    ...ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  ]) {
    const file = relative === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, relative);
    definitions.push({ ref: relative, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-state-fitness-revision-"));
  try {
    const archive = git(["archive", "--format=tar", revision], { encoding: null });
    const extracted = spawnSync("tar", ["-x", "-C", root], {
      input: archive,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (extracted.status !== 0) {
      throw new Error(extracted.stderr.trim() || `tar exited ${extracted.status}`);
    }
    // The collector-authority checkout supplies the path-test harness and dependencies.
    // The exact target tree remains the inspected source/runtime input even
    // when its dependency lock differs from the collector-authority checkout.
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    return { root, dependencySource: "collector-authority" };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function executeStateInspection(root) {
  try {
    const result = await runSearchStateBoundaryGuard({ root });
    return { completed: true, result };
  } catch (error) {
    return {
      completed: false,
      result: { ok: false, filesScanned: 0, missing: [], violations: [], facts: {} },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeFirstPaintInspection(root) {
  try {
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: true,
      allowAbsentExceptionMatches: true,
    });
    return { completed: true, result };
  } catch (error) {
    return {
      completed: false,
      result: { ok: false, visitedCount: 0, missing: [], violations: [] },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const SEARCH_STATE_NEGATIVE_MUTATIONS = [
  {
    rule: "url-condition-authority",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchBar,
    before:
      "    const urlSeed = getUrlQuerySeed(pathname, new URLSearchParams(searchParamString));",
    after:
      "    if (activeView) return getShellQuerySeed(activeView);\n    const urlSeed = getUrlQuerySeed(pathname, new URLSearchParams(searchParamString));",
  },
  {
    rule: "url-to-execution-projection",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchRoute,
    before: `  const searchResult = executeSearchFromUrl({
    ownerPrincipalId: user.id,
    userEmail: user.email,
    input,
  });`,
    after: `  const searchResult = executeSearchFromUrl({
    ownerPrincipalId: user.id,
    userEmail: user.email,
    input: { ...input, query: "collector-bypass" },
  });`,
  },
  {
    rule: "url-to-execution-projection",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution,
    before: "  return Array.isArray(value) ? value[0] : value;",
    after: '  return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";',
  },
  {
    rule: "url-to-execution-projection",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchFacets,
    before: "    authors: normalizeList(filters?.authors),",
    after:
      "    authors: process.env.SEARCH_AUTHOR_OVERRIDE ? [process.env.SEARCH_AUTHOR_OVERRIDE] : normalizeList(filters?.authors),",
  },
  {
    rule: "url-to-execution-projection",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution,
    before: "function firstParam(value: string | string[] | undefined): string | undefined {",
    after:
      "if (process.env.SEARCH_ARRAY_OVERRIDE) Array.isArray = () => true;\nfunction firstParam(value: string | string[] | undefined): string | undefined {",
  },
  {
    rule: "canonical-ephemeral-view-identity",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.ephemeralIdentity,
    before: 'createHash("sha256").update(canonicalKey, "utf8").digest("hex")',
    after: '"0".repeat(64)',
  },
  {
    rule: "canonical-ephemeral-view-identity",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.ephemeralIdentity,
    before: 'import { createHash } from "node:crypto";',
    after: 'import { createHash } from "@/app/server/services/runtime-hash";',
  },
  {
    rule: "canonical-ephemeral-view-identity",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.ephemeralConstants,
    before: 'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "search-ephemeral-";',
    after:
      'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = process.env.VERCEL_ENV ?? "search-ephemeral-";',
  },
  {
    rule: "canonical-ephemeral-view-identity",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution,
    before: "    id: buildEphemeralSearchViewId(params.input.canonicalKey),",
    after: "    id: buildEphemeralSearchViewId(params.metadata.updatedAt),",
  },
  {
    rule: "route-owned-result-snapshot",
    relative: SEARCH_STATE_BOUNDARY_SOURCE_FILES.routeRuntime,
    before: "    setCurrentView(initialRouteView, executionId);",
    after:
      '    useResearchRouteStore.getState().setCurrentView(initialRouteView, "parallel");\n    setCurrentView(initialRouteView, executionId);',
  },
  {
    rule: "route-owned-result-snapshot",
    relative: "app/components/research/background-search-tasks.ts",
    before:
      "  return documentStore.patchCurrentView(resultDocument, task.executionId) ? resultDocument : null;",
    after:
      '  const readRouteAction = Reflect.get;\n  const action = process.env.ROUTE_ACTION ?? "setCurrentView";\n  readRouteAction(useResearchRouteStore.getState(), action)(resultDocument, "parallel");\n  return documentStore.patchCurrentView(resultDocument, task.executionId) ? resultDocument : null;',
  },
  {
    rule: "route-owned-result-snapshot",
    relative: "app/components/research/background-search-tasks.ts",
    before:
      "  return documentStore.patchCurrentView(resultDocument, task.executionId) ? resultDocument : null;",
    after:
      "  const { setState: replaceRouteState } = useResearchRouteStore;\n  replaceRouteState({ currentView: resultDocument });\n  return documentStore.patchCurrentView(resultDocument, task.executionId) ? resultDocument : null;",
  },
];

async function executeNegativeMutationSuite(root) {
  const mutations = SEARCH_STATE_NEGATIVE_MUTATIONS;
  const outcomes = [];
  for (const mutation of mutations) {
    const file = path.join(root, mutation.relative);
    let original;
    try {
      original = await readFile(file, "utf8");
    } catch {
      outcomes.push({
        rule: mutation.rule,
        rejected: false,
        error: `mutation target unavailable: ${mutation.relative}`,
      });
      continue;
    }
    try {
      if (!original.includes(mutation.before)) {
        outcomes.push({ rule: mutation.rule, rejected: false, error: "mutation target missing" });
        continue;
      }
      await writeFile(file, original.replace(mutation.before, mutation.after), "utf8");
      const result = await runSearchStateBoundaryGuard({ root });
      outcomes.push({
        rule: mutation.rule,
        rejected: result.violations.some((item) => item.rule === mutation.rule),
      });
    } finally {
      await writeFile(file, original, "utf8");
    }
  }
  return {
    exitCode: outcomes.every((item) => item.rejected) ? 0 : 1,
    artifact: { mutations: outcomes },
  };
}

async function executePathTests(root) {
  const trustedTest = path.join(root, TRUSTED_IDENTITY_TEST);
  await mkdir(path.dirname(trustedTest), { recursive: true });
  await writeFile(trustedTest, TRUSTED_IDENTITY_TEST_SOURCE, "utf8");
  const invocation = architectureFitnessPathTestInvocation(PATH_TESTS);
  const result = spawnSync(path.join(ROOT, "node_modules", ".bin", "vitest"), invocation.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ...architectureFitnessPathTestEnvironment(root),
      NODE_ENV: "test",
      SEARCH_VIEW_ID_NAMESPACE: "collector-hostile-namespace-",
    },
  });
  const normalize = (value) => String(value ?? "").replaceAll(root, "<target-revision>");
  try {
    const report = JSON.parse(result.stdout);
    const testResults = (report.testResults ?? []).map((item) => ({
      name: normalize(item.name),
      status: item.status,
      assertionResults: (item.assertionResults ?? []).map((assertion) => ({
        fullName: assertion.fullName,
        status: assertion.status,
      })),
    }));
    const missingExpectedTests = PATH_TESTS.filter(
      (relative) => !testResults.some((item) => item.name.endsWith(`/${relative}`)),
    );
    return {
      exitCode: (result.status ?? 1) === 0 && missingExpectedTests.length === 0 ? 0 : 1,
      artifact: {
        dependencySource: "collector-authority",
        missingExpectedTests,
        numTotalTestSuites: report.numTotalTestSuites,
        numPassedTestSuites: report.numPassedTestSuites,
        numTotalTests: report.numTotalTests,
        numPassedTests: report.numPassedTests,
        testResults,
      },
    };
  } catch {
    return {
      exitCode: result.status ?? 1,
      artifact: { stdout: normalize(result.stdout), stderr: normalize(result.stderr) },
    };
  }
}

function selectedPathTestEvidence(pathTests, relatives) {
  const testResults = pathTests.artifact.testResults ?? [];
  const selected = relatives.map((relative) => ({
    relative,
    results: testResults.filter((item) => item.name.endsWith(`/${relative}`)),
  }));
  const passed = selected.every(
    (item) =>
      item.results.length === 1 &&
      item.results[0].status === "passed" &&
      item.results[0].assertionResults.every((assertion) => assertion.status === "passed"),
  );
  return { exitCode: passed ? 0 : 1, digest: canonicalDigest(selected) };
}

function evidence({
  id,
  kind,
  role,
  source,
  revision,
  summary,
  command,
  exitCode,
  digest,
  runRef,
  target,
}) {
  return {
    id,
    kind,
    role,
    source,
    sourceRevision: revision,
    summary,
    freshness: "fresh",
    reproducible: true,
    command,
    commandExitCode: exitCode,
    artifactDigest: digest,
    collectorRunRef: runRef,
    target,
  };
}

export async function collectSearchStateObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await searchStateCollectorDefinitionDigest();
  if (authority.adapterRef !== COLLECTOR_REF) {
    throw new Error(`policy collector adapterRef must equal ${COLLECTOR_REF}`);
  }
  if (authority.definitionDigest !== definitionDigest) {
    throw new Error(
      `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
    );
  }
  if (!policy.policies?.some((item) => item.id === POLICY_REF)) {
    throw new Error(`policy is missing ${POLICY_REF}`);
  }
  git(["cat-file", "-e", `${revision}^{commit}`]);

  const materialized = await materializeRevision(revision);
  try {
    const inspection = await executeStateInspection(materialized.root);
    const firstPaint = await executeFirstPaintInspection(materialized.root);
    const negative = await executeNegativeMutationSuite(materialized.root);
    const pathTests = await executePathTests(materialized.root);
    const facts = inspection.result.facts ?? {};
    const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-276.policy.json --revision ${revision} --run-ref ${runRef}`;
    const target = (stateRefs, identityRefs, factRefs) => ({
      policyRef: POLICY_REF,
      capabilityRef: CAPABILITY_REF,
      stateRefs,
      identityRefs,
      factRefs,
    });
    const coverageDigest = canonicalDigest({ inspection, firstPaint });
    const negativeDigest = canonicalDigest(negative.artifact);
    const pathTestCommand = architectureFitnessPathTestInvocation(PATH_TESTS).command;
    const conditionTestEvidence = selectedPathTestEvidence(pathTests, [
      "app/(research)/__tests__/research-routes.test.tsx",
      "app/components/research/__tests__/ResearchRouteSearchBar.test.tsx",
      "app/server/services/__tests__/search-execution.test.ts",
    ]);
    const snapshotTestEvidence = selectedPathTestEvidence(pathTests, [
      "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
    ]);
    const identityTestEvidence = selectedPathTestEvidence(pathTests, [
      PRODUCTION_IDENTITY_TEST,
      TRUSTED_IDENTITY_TEST,
    ]);
    const conditionAuthority = facts["url-condition-authority"]
      ? ["authority:condition-url"]
      : ["authority:client-current-view-store"];
    const conditionCarriers = facts["url-to-execution-projection"]
      ? ["carrier:condition-url", "carrier:server-execution-input"]
      : ["carrier:condition-url"];
    const snapshotAuthority = facts["route-owned-result-snapshot"]
      ? ["authority:route-search-execution"]
      : ["authority:client-current-view-store"];
    const identityParticipants = facts["canonical-ephemeral-view-identity"]
      ? ["state:search-execution-condition"]
      : ["state:search-execution-condition", "state:current-result-snapshot"];
    const normalizationRefs = facts["canonical-ephemeral-view-identity"]
      ? ["normalization:canonical-search-execution-v1"]
      : ["normalization:result-snapshot-coupled"];
    const inspectionOk = inspection.completed && inspection.result.ok;
    const firstPaintOk = firstPaint.completed && firstPaint.result.ok;
    const inspectionExit = inspectionOk ? 0 : 1;
    const stateCoverageExit = inspectionOk && firstPaintOk ? 0 : 1;

    const evidenceItems = [
      evidence({
        id: `state-coverage-static:${revision}`,
        kind: "static",
        role: "state-coverage-static",
        source: `collector:issue-276-state-inventory:${revision}`,
        revision,
        summary:
          "The exact-revision collector inspected URL condition precedence, server input projection, ephemeral view identity, route-owned snapshot hydration/cleanup, and the first-paint repository graph.",
        command,
        exitCode: stateCoverageExit,
        digest: coverageDigest,
        runRef,
        target: target(
          ["state:search-execution-condition", "state:current-result-snapshot"],
          ["identity:ephemeral-search-view"],
          ["coverage:all-state-boundaries"],
        ),
      }),
      evidence({
        id: `state-coverage-negative-guard:${revision}`,
        kind: "test",
        role: "state-coverage-negative-guard",
        source: "collector:issue-276-state-negative-mutations",
        revision,
        summary:
          "The collector added competing store authority, rewrote the final URL-derived execution input, added a result-derived parallel identity, and added a parallel snapshot writer while preserving the required paths, then required the bound guard to reject every mutation.",
        command,
        exitCode: negative.exitCode,
        digest: negativeDigest,
        runRef,
        target: target(
          ["state:search-execution-condition", "state:current-result-snapshot"],
          ["identity:ephemeral-search-view"],
          ["coverage:undeclared-state-and-identity-rejected"],
        ),
      }),
      evidence({
        id: `state-static:condition:${revision}`,
        kind: "static",
        role: "state-static",
        source: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchBar,
        revision,
        summary:
          "The search route gives URL query state precedence over the current-view store and projects submitted conditions through the canonical route builder into server execution input.",
        command,
        exitCode: inspectionExit,
        digest: coverageDigest,
        runRef,
        target: target(
          ["state:search-execution-condition"],
          [],
          [...conditionAuthority, ...conditionCarriers],
        ),
      }),
      evidence({
        id: `state-test:condition:${revision}`,
        kind: "test",
        role: "state-test",
        source: PATH_TESTS.join(","),
        revision,
        summary:
          "Exact-revision route and service tests vary a foreign current-view store while holding the URL query fixed, re-execute the same URL, and exercise normalized URL execution input.",
        command: pathTestCommand,
        exitCode: conditionTestEvidence.exitCode,
        digest: conditionTestEvidence.digest,
        runRef,
        target: target(
          ["state:search-execution-condition"],
          [],
          [...conditionAuthority, ...conditionCarriers],
        ),
      }),
      evidence({
        id: `state-static:snapshot:${revision}`,
        kind: "static",
        role: "state-static",
        source: SEARCH_STATE_BOUNDARY_SOURCE_FILES.routeRuntime,
        revision,
        summary:
          "The route runtime hydrates the server-projected view into the client store for the active execution and clears that execution-owned snapshot on unmount.",
        command,
        exitCode: stateCoverageExit,
        digest: coverageDigest,
        runRef,
        target: target(
          ["state:current-result-snapshot"],
          [],
          [...snapshotAuthority, "carrier:route-payload", "carrier:client-current-view-store"],
        ),
      }),
      evidence({
        id: `state-test:snapshot:${revision}`,
        kind: "test",
        role: "state-test",
        source:
          "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
        revision,
        summary:
          "The exact-revision route-runtime test proves that a foreign store view does not render and the active route view is removed on unmount.",
        command: pathTestCommand,
        exitCode: snapshotTestEvidence.exitCode,
        digest: snapshotTestEvidence.digest,
        runRef,
        target: target(
          ["state:current-result-snapshot"],
          [],
          [...snapshotAuthority, "carrier:route-payload", "carrier:client-current-view-store"],
        ),
      }),
      evidence({
        id: `identity-static:view:${revision}`,
        kind: "static",
        role: "identity-static",
        source: SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution,
        revision,
        summary:
          "The ephemeral search view id is built only from the normalized canonical search execution key rather than the changing result snapshot.",
        command,
        exitCode: inspectionExit,
        digest: coverageDigest,
        runRef,
        target: target(
          [],
          ["identity:ephemeral-search-view"],
          [...identityParticipants, ...normalizationRefs],
        ),
      }),
      evidence({
        id: `identity-test:view:${revision}`,
        kind: "test",
        role: "identity-test",
        source: `${PRODUCTION_IDENTITY_TEST},${TRUSTED_IDENTITY_TEST}`,
        revision,
        summary:
          "The collector-owned exact-revision identity fixture binds SHA-256 output to the canonical execution condition, while the production execution test keeps view identity stable when only result metadata and papers change, changes identity with canonical conditions, and rejects the previous 32-bit collision pair.",
        command: pathTestCommand,
        exitCode: identityTestEvidence.exitCode,
        digest: identityTestEvidence.digest,
        runRef,
        target: target(
          [],
          ["identity:ephemeral-search-view"],
          [...identityParticipants, ...normalizationRefs],
        ),
      }),
    ];

    return {
      schemaVersion: "2",
      kind: "architecture-fitness-observation",
      serviceId: policy.service.id,
      policySetRef: policy.policySet.id,
      policySetVersion: policy.policySet.version,
      policyDigest: canonicalDigest(policy),
      revision,
      collector: {
        adapterRef: authority.adapterRef,
        id: authority.id,
        version: authority.version,
        scope: authority.scope,
        definitionDigest: authority.definitionDigest,
        attestorRef: authority.attestorRef,
        runRef,
        command,
        attestation: {
          algorithm: "hmac-sha256",
          keyRef: authority.attestationKeyRef,
          payloadDigest: ZERO_DIGEST,
          signature: ZERO_DIGEST,
        },
      },
      evidence: evidenceItems,
      observations: [
        {
          id: `observation:issue-276-keyword-search-state:${revision}`,
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          completeness:
            inspectionOk && firstPaintOk && negative.exitCode === 0 && pathTests.exitCode === 0
              ? "complete"
              : "partial",
          coverageEvidenceRefs: [
            `state-coverage-static:${revision}`,
            `state-coverage-negative-guard:${revision}`,
          ],
          states: [
            {
              id: `observed-state:search-condition:${revision}`,
              stateRef: "state:search-execution-condition",
              authorityRefs: conditionAuthority,
              coordinationRefs: [],
              carrierRefs: conditionCarriers,
              evidenceRefs: [
                `state-static:condition:${revision}`,
                `state-test:condition:${revision}`,
              ],
            },
            {
              id: `observed-state:result-snapshot:${revision}`,
              stateRef: "state:current-result-snapshot",
              authorityRefs: snapshotAuthority,
              coordinationRefs: [],
              carrierRefs: ["carrier:route-payload", "carrier:client-current-view-store"],
              evidenceRefs: [
                `state-static:snapshot:${revision}`,
                `state-test:snapshot:${revision}`,
              ],
            },
          ],
          canonicalIdentities: [
            {
              id: `observed-identity:ephemeral-search-view:${revision}`,
              identityRef: "identity:ephemeral-search-view",
              participatingStateRefs: identityParticipants,
              normalizationRefs,
              evidenceRefs: [`identity-static:view:${revision}`, `identity-test:view:${revision}`],
            },
          ],
        },
      ],
    };
  } finally {
    await rm(materialized.root, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { policy: null, revision: null, runRef: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--policy") options.policy = argv[++index];
    else if (value === "--revision") options.revision = argv[++index];
    else if (value === "--run-ref") options.runRef = argv[++index];
    else if (value === "--output") options.output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  for (const field of ["policy", "revision", "runRef"]) {
    if (!options[field])
      throw new Error(`--${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectSearchStateObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  const rendered = `${JSON.stringify(observation, null, 2)}\n`;
  if (options.output) await writeFile(path.resolve(options.output), rendered, "utf8");
  else process.stdout.write(rendered);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
