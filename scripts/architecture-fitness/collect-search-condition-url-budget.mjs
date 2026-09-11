#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runSearchConditionUrlBudgetGuard } from "./check-search-condition-url-budget.mjs";
import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";
import {
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "./path-test-command.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-search-condition-url-budget.mjs";
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const GUARD_REF = "scripts/architecture-fitness/check-search-condition-url-budget.mjs";
const PROBE_REF = "scripts/architecture-fitness/search-condition-url-budget-probe.ts";
const TEST_REF = "scripts/architecture-fitness/__tests__/search-condition-url-budget.test.ts";
const PRODUCT_TEST_REF = "app/lib/__tests__/search-condition-url-budget.test.ts";
const CALLSITE_TEST_REFS = [
  "app/components/research/__tests__/ResearchRouteSearchBar.test.tsx",
  "app/components/research-route-renderers/__tests__/search-view-empty-state-route-selection.test.tsx",
  "app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx",
  "app/components/research-route-renderers/__tests__/SearchView.visible-window.test.tsx",
];
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_PATH_REF =
  "docs/architecture-fitness/pilots/issue-399-serialized-input-budget.policy.json";
const OBSERVATION_PATH_REF =
  "docs/architecture-fitness/pilots/issue-399-serialized-input-budget.observation.json";
const POLICY_REF = "issue-399:search-first-condition-url-budget";
const CAPABILITY_REF = "capability:search-first-condition-url-serialization";
const ENCODING_REF = "encoding:utf8-urlsearchparams-percent-v1";
const BUDGET_REF = "budget:condition-request-target-8192";
const GUARD_POLICY_REF = "guard:search-condition-url-budget-reject";
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

export function searchConditionUrlBudgetCollectorCommand(revision, runRef) {
  return `node ${COLLECTOR_REF} --policy ${POLICY_PATH_REF} --revision ${revision} --run-ref ${runRef} --output ${OBSERVATION_PATH_REF}`;
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

export async function searchConditionUrlBudgetCollectorDefinitionDigest() {
  const definitions = [];
  for (const relative of [
    COLLECTOR_REF,
    GUARD_REF,
    PROBE_REF,
    TEST_REF,
    PRODUCT_TEST_REF,
    ...CALLSITE_TEST_REFS,
    ...ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
    TRUST_POLICY_REF,
  ]) {
    const file = relative === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, relative);
    definitions.push({ ref: relative, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

export async function compareSearchConditionUrlBudgetHarness(root) {
  const files = [];
  for (const relative of [
    GUARD_REF,
    PROBE_REF,
    TEST_REF,
    PRODUCT_TEST_REF,
    ...CALLSITE_TEST_REFS,
  ]) {
    const authorizedDigest = sha256(await readFile(path.join(ROOT, relative)));
    const materializedDigest = sha256(await readFile(path.join(root, relative)));
    files.push({
      ref: relative,
      authorizedDigest,
      materializedDigest,
      matches: authorizedDigest === materializedDigest,
    });
  }
  return {
    ok: files.every((file) => file.matches),
    files,
  };
}

async function materializeRevision(revision) {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "lighthouse-serialized-input-budget-revision-"),
  );
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
    // The collector-authority checkout supplies the serialization harness and dependencies.
    // The exact target tree remains the inspected source/runtime input even when
    // its dependency lock differs from the collector-authority checkout.
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    return { root, dependencySource: "collector-authority" };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

function runTarget(command, args, root, extraEnvironment = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...extraEnvironment },
  });
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
  boundaryRefs,
  scenarioRefs,
  factRefs,
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
    target: {
      policyRef: POLICY_REF,
      capabilityRef: CAPABILITY_REF,
      boundaryRefs,
      scenarioRefs,
      factRefs,
    },
  };
}

function parseVitestReport(result, root) {
  try {
    const normalized = result.stdout.replaceAll(root, "<target-revision>");
    const report = JSON.parse(normalized);
    return {
      exitCode: result.status ?? 1,
      artifact: {
        numTotalTestSuites: report.numTotalTestSuites,
        numPassedTestSuites: report.numPassedTestSuites,
        numTotalTests: report.numTotalTests,
        numPassedTests: report.numPassedTests,
        testResults: (report.testResults ?? [])
          .map((item) => ({
            name: item.name,
            status: item.status,
            assertionResults: (item.assertionResults ?? [])
              .map((assertion) => ({
                fullName: assertion.fullName,
                status: assertion.status,
              }))
              .sort((left, right) =>
                `${left.fullName}\0${left.status}`.localeCompare(
                  `${right.fullName}\0${right.status}`,
                ),
              ),
          }))
          .sort((left, right) =>
            `${left.name}\0${left.status}`.localeCompare(`${right.name}\0${right.status}`),
          ),
      },
    };
  } catch {
    return {
      exitCode: result.status ?? 1,
      artifact: {
        stdout: result.stdout.replaceAll(root, "<target-revision>"),
        stderr: result.stderr.replaceAll(root, "<target-revision>"),
      },
    };
  }
}

export async function collectSearchConditionUrlBudgetObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await searchConditionUrlBudgetCollectorDefinitionDigest();
  if (authority.adapterRef !== COLLECTOR_REF) {
    throw new Error(`policy collector adapterRef must equal ${COLLECTOR_REF}`);
  }
  if (authority.definitionDigest !== definitionDigest) {
    throw new Error(
      `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
    );
  }
  const policyCase = policy.policies?.find((item) => item.id === POLICY_REF);
  if (!policyCase) throw new Error(`policy is missing ${POLICY_REF}`);
  git(["cat-file", "-e", `${revision}^{commit}`]);

  const materialized = await materializeRevision(revision);
  try {
    const harness = await compareSearchConditionUrlBudgetHarness(materialized.root);
    if (!harness.ok) {
      const mismatches = harness.files
        .filter((file) => !file.matches)
        .map((file) => file.ref)
        .join(", ");
      throw new Error(`target-controlled serialized-input harness drift: ${mismatches}`);
    }
    const inspection = await runSearchConditionUrlBudgetGuard({
      root: materialized.root,
    });
    const probeResult = runTarget(
      path.join(ROOT, "node_modules", ".bin", "tsx"),
      [PROBE_REF],
      materialized.root,
    );
    const probe =
      probeResult.status === 0
        ? JSON.parse(probeResult.stdout)
        : { boundaries: [], measurements: [] };
    const testRefs = [TEST_REF, PRODUCT_TEST_REF, ...CALLSITE_TEST_REFS];
    const testInvocation = architectureFitnessPathTestInvocation(testRefs);
    const testCommand = testInvocation.command;
    const tests = parseVitestReport(
      runTarget(
        path.join(ROOT, "node_modules", ".bin", "vitest"),
        testInvocation.args,
        materialized.root,
        {
          ...architectureFitnessPathTestEnvironment(materialized.root),
          NODE_ENV: "test",
        },
      ),
      materialized.root,
    );
    const command = searchConditionUrlBudgetCollectorCommand(revision, runRef);
    const boundaryDefinitions = new Map(
      policyCase.boundaries.map((boundary) => [boundary.id, boundary]),
    );
    const allBoundaryRefs = policyCase.boundaries.map((boundary) => boundary.id);
    const allScenarioRefs = policyCase.boundaries.flatMap((boundary) =>
      boundary.scenarios.map((scenario) => scenario.id),
    );
    const inspectionDigest = canonicalDigest(inspection);
    const probeDigest = canonicalDigest(probe);
    const testDigest = canonicalDigest(tests.artifact);
    const coverageExitCode =
      inspection.ok &&
      probeResult.status === 0 &&
      probe.boundaries.length === policyCase.boundaries.length
        ? 0
        : 1;
    const evidenceItems = [
      evidence({
        id: `budget-coverage-static:${revision}`,
        kind: "static",
        role: "budget-coverage-static",
        source: `${GUARD_REF},${PROBE_REF}`,
        revision,
        summary:
          "The exact-revision inventory covers the five mode-specific Search-first condition URL serializers, their shared UTF-8 request-target guard, parser/provider ordering, and direct-builder bypass scan.",
        command,
        exitCode: coverageExitCode,
        digest: canonicalDigest({
          dependencySource: materialized.dependencySource,
          harness,
          inspection,
          boundaries: probe.boundaries,
        }),
        runRef,
        boundaryRefs: allBoundaryRefs,
        scenarioRefs: allScenarioRefs,
        factRefs: [
          "coverage:all-serialization-boundaries",
          `dependency-source:${materialized.dependencySource}`,
        ],
      }),
      evidence({
        id: `budget-coverage-negative-guard:${revision}`,
        kind: "test",
        role: "budget-coverage-negative-guard",
        source: TEST_REF,
        revision,
        summary:
          "The exact-revision negative tests remove the 8192-byte declaration, replace UTF-8 measurement with code-unit length, bypass parser and provider ordering, and add a strict production builder import; every mutation must be rejected.",
        command: testCommand,
        exitCode: tests.exitCode,
        digest: testDigest,
        runRef,
        boundaryRefs: allBoundaryRefs,
        scenarioRefs: allScenarioRefs,
        factRefs: ["coverage:unguarded-overflow-rejected"],
      }),
    ];

    for (const observedBoundary of probe.boundaries) {
      const boundary = boundaryDefinitions.get(observedBoundary.boundaryRef);
      if (!boundary) continue;
      evidenceItems.push(
        evidence({
          id: `serialization-static:${observedBoundary.boundaryRef}:${revision}`,
          kind: "static",
          role: "serialization-static",
          source: `${GUARD_REF},app/lib/api-routes.ts,app/lib/search-condition-url-budget.ts`,
          revision,
          summary:
            "The production builder serializes with URLSearchParams, measures the UTF-8 path plus query, and shares the reject-only overflow owner before canonical execution identity.",
          command,
          exitCode: inspection.ok ? 0 : 1,
          digest: inspectionDigest,
          runRef,
          boundaryRefs: [observedBoundary.boundaryRef],
          scenarioRefs: [],
          factRefs: [observedBoundary.serializerRef, ENCODING_REF, GUARD_POLICY_REF],
        }),
      );
    }

    const observations = [];
    for (const observedMeasurement of probe.measurements) {
      const measurement = { ...observedMeasurement };
      const measurementDigest = canonicalDigest(measurement);
      const boundary = boundaryDefinitions.get(measurement.boundaryRef);
      const scenario = boundary?.scenarios.find((item) => item.id === measurement.scenarioRef);
      if (!boundary || !scenario) continue;
      const role =
        scenario.kind === "envelope-maximum"
          ? "serialization-measurement"
          : "serialization-guard-test";
      const evidenceId = `${role}:${measurement.scenarioRef}:${revision}`;
      evidenceItems.push(
        evidence({
          id: evidenceId,
          kind: "test",
          role,
          source: `${PROBE_REF},${PRODUCT_TEST_REF}`,
          revision,
          summary:
            scenario.kind === "envelope-maximum"
              ? "The exact-revision production serializer measured the declared non-ASCII and percent-expansion envelope without dropping any supported dimension."
              : "The exact-revision production serializer rejected the declared one-byte dimension overflow without truncation or omission.",
          command: `${path.join("node_modules", ".bin", "tsx")} ${PROBE_REF} && ${testCommand}`,
          exitCode: probeResult.status === 0 && tests.exitCode === 0 ? 0 : 1,
          digest: canonicalDigest({ probe: probeDigest, tests: testDigest, measurement }),
          runRef,
          boundaryRefs: [measurement.boundaryRef],
          scenarioRefs: [measurement.scenarioRef],
          factRefs: [
            BUDGET_REF,
            `expected-result:${scenario.expectedResult}`,
            `measurement-sha256:${measurementDigest}`,
            `observed-result:${measurement.result.kind}`,
            measurement.inputProfileRef,
            ...(role === "serialization-guard-test" ? [GUARD_POLICY_REF] : []),
          ],
        }),
      );
      measurement.evidenceRefs = [evidenceId];
      observations.push(measurement);
    }

    const boundaryObservations = probe.boundaries.map((boundary) => ({
      id: `observed-${boundary.boundaryRef}:${revision}`,
      boundaryRef: boundary.boundaryRef,
      serializerRef: boundary.serializerRef,
      encodingRef: ENCODING_REF,
      guardRefs: [GUARD_POLICY_REF],
      evidenceRefs: [`serialization-static:${boundary.boundaryRef}:${revision}`],
    }));
    const complete =
      coverageExitCode === 0 &&
      tests.exitCode === 0 &&
      observations.length === allScenarioRefs.length;

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
          id: `observation:issue-399-search-first-condition-url-budget:${revision}`,
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          completeness: complete ? "complete" : "partial",
          coverageEvidenceRefs: [
            `budget-coverage-static:${revision}`,
            `budget-coverage-negative-guard:${revision}`,
          ],
          boundaries: boundaryObservations,
          measurements: observations,
        },
      ],
    };
  } finally {
    await rm(materialized.root, { recursive: true, force: true });
  }
}

export function assertCompleteSearchConditionUrlBudgetObservation(observation) {
  const incomplete = observation.observations?.some((item) => item.completeness !== "complete");
  const failedEvidence = observation.evidence?.filter((item) => item.commandExitCode !== 0);
  if (!incomplete && failedEvidence?.length === 0) return;

  const failedEvidenceIds = (failedEvidence ?? []).map((item) => item.id).join(", ");
  throw new Error(
    `serialized-input observation collection failed closed: completeness=${
      incomplete ? "partial" : "complete"
    }; failedEvidence=${failedEvidenceIds || "none"}`,
  );
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
    if (!options[field]) {
      throw new Error(
        `--${field.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)} is required`,
      );
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectSearchConditionUrlBudgetObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  assertCompleteSearchConditionUrlBudgetObservation(observation);
  const rendered = `${JSON.stringify(observation, null, 2)}\n`;
  if (options.output) await writeFile(path.resolve(options.output), rendered, "utf8");
  else process.stdout.write(rendered);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
