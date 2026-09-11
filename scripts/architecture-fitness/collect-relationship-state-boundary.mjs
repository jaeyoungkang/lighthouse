#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES,
  runRelationshipStateBoundaryGuard,
} from "./check-relationship-state-boundaries.mjs";
import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";
import {
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "./path-test-command.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-relationship-state-boundary.mjs";
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const RELATIONSHIP_GUARD_REF =
  "scripts/architecture-fitness/check-relationship-state-boundaries.mjs";
const SHARED_STATE_GUARD_REF = "scripts/architecture-fitness/check-search-state-boundaries.mjs";
const STATE_ANALYSIS_REF = "scripts/architecture-fitness/state-boundary-analysis.mjs";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_PATH = "docs/architecture-fitness/pilots/issue-276-relationship.policy.json";
const POLICY_REF = "issue-276:relationship-seed-state-boundary";
const CAPABILITY_REF = "capability:relationship-seed-route-state";
const ZERO_DIGEST = "0".repeat(64);

const PATH_TESTS = [
  "app/(research)/__tests__/relationship-route-page.test.tsx",
  "app/server/services/__tests__/search-execution.test.ts",
  "app/server/services/__tests__/ephemeral-view-id.test.ts",
  "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
];

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

export async function relationshipStateCollectorDefinitionDigest() {
  const definitions = [];
  for (const relative of [
    COLLECTOR_REF,
    RELATIONSHIP_GUARD_REF,
    SHARED_STATE_GUARD_REF,
    STATE_ANALYSIS_REF,
    TRUST_POLICY_REF,
    ...ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  ]) {
    const file = relative === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, relative);
    definitions.push({ ref: relative, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-relationship-fitness-revision-"));
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

async function executeInspection(root) {
  try {
    const result = await runRelationshipStateBoundaryGuard({ root });
    return { completed: true, result };
  } catch (error) {
    return {
      completed: false,
      result: { ok: false, filesScanned: 0, missing: [], violations: [], facts: {} },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const RELATIONSHIP_STATE_NEGATIVE_MUTATIONS = [
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
    before: `  const { view: document, failed } = await executeCitationLineageFromUrl({
    ownerPrincipalId: user.id,
    input,
  });`,
    after: `  const { view: document, failed } = await executeCitationLineageFromUrl({
    ownerPrincipalId: user.id,
    input: { ...input, canonicalKey: "collector-bypass" },
  });`,
  },
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
    before: "  return Array.isArray(value) ? value[0] : value;",
    after: '  return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";',
  },
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
    before: "    paperId: seedPaperId,",
    after: "    paperId: nextSeed(),",
  },
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
    before: `  const { view: document, failed } = await executeGraphNeighborsFromUrl({
    ownerPrincipalId: user.id,
    input,
  });`,
    after: `  const { view: document, failed } = await executeGraphNeighborsFromUrl({
    ownerPrincipalId: user.id,
    input: { ...input, canonicalKey: "collector-bypass" },
  });`,
  },
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
    before: "  return params.toString();",
    after: "  return `${params.toString()}&execution=${Date.now().toString(36)}`;",
  },
  {
    rule: "canonical-relationship-view-identity",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
    before: "        id: buildEphemeralCitationLineageViewId(input.canonicalKey),",
    after: "        id: buildEphemeralCitationLineageViewId(payload.metadata.updatedAt),",
  },
  {
    rule: "canonical-relationship-view-identity",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
    before: "        id: buildEphemeralGraphNeighborsViewId(input.canonicalKey),",
    after: "        id: buildEphemeralGraphNeighborsViewId(payload.metadata.updatedAt),",
  },
  {
    rule: "canonical-relationship-view-identity",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.ephemeralConstants,
    before: 'export const EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX = "citation-ephemeral-";',
    after:
      'export const EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX = process.env.VERCEL_ENV ?? "citation-ephemeral-";',
  },
  {
    rule: "route-owned-relationship-result-snapshot",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRuntimes,
    before: `export function SimilarResearchRouteRuntime(props: RouteRuntimeProps) {
  return (
    <ResearchRouteRuntime
      {...props}`,
    after: `export function SimilarResearchRouteRuntime(props: RouteRuntimeProps) {
  return (
    <ResearchRouteRuntime
      runtimeId={props.runtimeId}`,
  },
  {
    rule: "route-owned-relationship-result-snapshot",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.routeRuntime,
    before: "    setCurrentView(initialRouteView, executionId);",
    after:
      '    useResearchRouteStore.getState().setCurrentView(initialRouteView, "parallel");\n    setCurrentView(initialRouteView, executionId);',
  },
  {
    rule: "relationship-url-to-execution-projection",
    relative: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRuntimes,
    before: 'import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";',
    after:
      'import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";\nexport { executeCitationLineageFromUrl } from "../server/services/relationship-execution";',
  },
];

export async function executeRelationshipNegativeMutationSuite(root) {
  const outcomes = [];
  for (const mutation of RELATIONSHIP_STATE_NEGATIVE_MUTATIONS) {
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
      const result = await runRelationshipStateBoundaryGuard({ root });
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
  const invocation = architectureFitnessPathTestInvocation(PATH_TESTS);
  const result = spawnSync(path.join(ROOT, "node_modules", ".bin", "vitest"), invocation.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ...architectureFitnessPathTestEnvironment(root),
      NODE_ENV: "test",
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

export async function collectRelationshipStateObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await relationshipStateCollectorDefinitionDigest();
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
    const inspection = await executeInspection(materialized.root);
    const negative = await executeRelationshipNegativeMutationSuite(materialized.root);
    const pathTests = await executePathTests(materialized.root);
    const facts = inspection.result.facts ?? {};
    const command = `node ${COLLECTOR_REF} --policy ${POLICY_PATH} --revision ${revision} --run-ref ${runRef}`;
    const target = (stateRefs, identityRefs, factRefs) => ({
      policyRef: POLICY_REF,
      capabilityRef: CAPABILITY_REF,
      stateRefs,
      identityRefs,
      factRefs,
    });
    const inspectionDigest = canonicalDigest(inspection);
    const negativeDigest = canonicalDigest(negative.artifact);
    const pathTestCommand = architectureFitnessPathTestInvocation(PATH_TESTS).command;
    const conditionTestEvidence = selectedPathTestEvidence(pathTests, [
      "app/(research)/__tests__/relationship-route-page.test.tsx",
      "app/server/services/__tests__/search-execution.test.ts",
    ]);
    const snapshotTestEvidence = selectedPathTestEvidence(pathTests, [
      "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
    ]);
    const identityTestEvidence = selectedPathTestEvidence(pathTests, [
      "app/server/services/__tests__/ephemeral-view-id.test.ts",
    ]);
    const conditionHealthy = facts["relationship-url-to-execution-projection"] === true;
    const identityHealthy = facts["canonical-relationship-view-identity"] === true;
    const snapshotHealthy = facts["route-owned-relationship-result-snapshot"] === true;
    const conditionAuthority = conditionHealthy
      ? ["authority:relationship-condition-url"]
      : ["authority:client-current-view-store"];
    const conditionCarriers = conditionHealthy
      ? ["carrier:relationship-condition-url", "carrier:relationship-server-execution-input"]
      : ["carrier:relationship-condition-url"];
    const snapshotAuthority = snapshotHealthy
      ? ["authority:route-relationship-execution"]
      : ["authority:client-current-view-store"];
    const identityParticipants = identityHealthy
      ? ["state:relationship-execution-condition"]
      : ["state:relationship-execution-condition", "state:current-relationship-result-snapshot"];
    const normalizationRefs = identityHealthy
      ? ["normalization:canonical-relationship-seed-v1"]
      : ["normalization:relationship-result-snapshot-coupled"];
    const inspectionOk = inspection.completed && inspection.result.ok;
    const inspectionExit = inspectionOk ? 0 : 1;

    const evidenceItems = [
      evidence({
        id: `relationship-state-coverage-static:${revision}`,
        kind: "static",
        role: "state-coverage-static",
        source: `collector:issue-276-relationship-state-inventory:${revision}`,
        revision,
        summary:
          "The exact-revision collector inspected citation and similar URL seed projection, relationship execution owners, shared route snapshot lifetime, and canonical citation/graph-neighbor view identities.",
        command,
        exitCode: inspectionExit,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:relationship-execution-condition", "state:current-relationship-result-snapshot"],
          ["identity:ephemeral-citation-view", "identity:ephemeral-graph-neighbors-view"],
          ["coverage:all-state-boundaries"],
        ),
      }),
      evidence({
        id: `relationship-state-coverage-negative-guard:${revision}`,
        kind: "test",
        role: "state-coverage-negative-guard",
        source: "collector:issue-276-relationship-state-negative-mutations",
        revision,
        summary:
          "The collector rewrote both URL-derived relationship inputs, injected an aliased seed helper, added nondeterministic seed state, introduced an alternate-path protected-module owner, coupled both identities to mutable output, changed a prefix owner, broke relationship-wrapper pass-through, and added a parallel route-store writer; every mutation had to be rejected.",
        command,
        exitCode: negative.exitCode,
        digest: negativeDigest,
        runRef,
        target: target(
          ["state:relationship-execution-condition", "state:current-relationship-result-snapshot"],
          ["identity:ephemeral-citation-view", "identity:ephemeral-graph-neighbors-view"],
          ["coverage:undeclared-state-and-identity-rejected"],
        ),
      }),
      evidence({
        id: `relationship-state-static:condition:${revision}`,
        kind: "static",
        role: "state-static",
        source: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
        revision,
        summary:
          "Both relationship route pages build one canonical seed directly from URL params and pass it unchanged to their sole execution owner.",
        command,
        exitCode: inspectionExit,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:relationship-execution-condition"],
          [],
          [...conditionAuthority, ...conditionCarriers],
        ),
      }),
      evidence({
        id: `relationship-state-test:condition:${revision}`,
        kind: "test",
        role: "state-test",
        source:
          "app/(research)/__tests__/relationship-route-page.test.tsx,app/server/services/__tests__/search-execution.test.ts",
        revision,
        summary:
          "Exact-revision route and service tests exercise citation and similar URL seed normalization and prove the destination route executes the resulting relationship input.",
        command: pathTestCommand,
        exitCode: conditionTestEvidence.exitCode,
        digest: conditionTestEvidence.digest,
        runRef,
        target: target(
          ["state:relationship-execution-condition"],
          [],
          [...conditionAuthority, ...conditionCarriers],
        ),
      }),
      evidence({
        id: `relationship-state-static:snapshot:${revision}`,
        kind: "static",
        role: "state-static",
        source: `${RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRuntimes},${RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.routeRuntime}`,
        revision,
        summary:
          "The relationship execution document is passed directly to the shared route runtime, whose execution id owns hydration and unmount cleanup of the single current-view carrier.",
        command,
        exitCode: inspectionExit,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:current-relationship-result-snapshot"],
          [],
          [...snapshotAuthority, "carrier:route-payload", "carrier:client-current-view-store"],
        ),
      }),
      evidence({
        id: `relationship-state-test:snapshot:${revision}`,
        kind: "test",
        role: "state-test",
        source:
          "app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx",
        revision,
        summary:
          "The exact-revision shared runtime test rejects a foreign store view and removes the execution-owned route payload on unmount.",
        command: pathTestCommand,
        exitCode: snapshotTestEvidence.exitCode,
        digest: snapshotTestEvidence.digest,
        runRef,
        target: target(
          ["state:current-relationship-result-snapshot"],
          [],
          [...snapshotAuthority, "carrier:route-payload", "carrier:client-current-view-store"],
        ),
      }),
      ...[
        ["citation", "identity:ephemeral-citation-view"],
        ["graph-neighbors", "identity:ephemeral-graph-neighbors-view"],
      ].flatMap(([name, identityRef]) => [
        evidence({
          id: `relationship-identity-static:${name}:${revision}`,
          kind: "static",
          role: "identity-static",
          source: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
          revision,
          summary: `The ephemeral ${name} view id is minted only by relationship execution from the canonical URL seed key and a static route-kind prefix.`,
          command,
          exitCode: inspectionExit,
          digest: inspectionDigest,
          runRef,
          target: target([], [identityRef], [...identityParticipants, ...normalizationRefs]),
        }),
        evidence({
          id: `relationship-identity-test:${name}:${revision}`,
          kind: "test",
          role: "identity-test",
          source: "app/server/services/__tests__/ephemeral-view-id.test.ts",
          revision,
          summary: `The exact-revision identity test keeps ${name} identity stable across mutable result snapshots and changes it when the canonical seed condition changes.`,
          command: pathTestCommand,
          exitCode: identityTestEvidence.exitCode,
          digest: identityTestEvidence.digest,
          runRef,
          target: target([], [identityRef], [...identityParticipants, ...normalizationRefs]),
        }),
      ]),
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
          id: `observation:issue-276-relationship-seed-state:${revision}`,
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          completeness:
            inspectionOk && negative.exitCode === 0 && pathTests.exitCode === 0
              ? "complete"
              : "partial",
          coverageEvidenceRefs: [
            `relationship-state-coverage-static:${revision}`,
            `relationship-state-coverage-negative-guard:${revision}`,
          ],
          states: [
            {
              id: `observed-state:relationship-condition:${revision}`,
              stateRef: "state:relationship-execution-condition",
              authorityRefs: conditionAuthority,
              coordinationRefs: [],
              carrierRefs: conditionCarriers,
              evidenceRefs: [
                `relationship-state-static:condition:${revision}`,
                `relationship-state-test:condition:${revision}`,
              ],
            },
            {
              id: `observed-state:relationship-result-snapshot:${revision}`,
              stateRef: "state:current-relationship-result-snapshot",
              authorityRefs: snapshotAuthority,
              coordinationRefs: [],
              carrierRefs: ["carrier:route-payload", "carrier:client-current-view-store"],
              evidenceRefs: [
                `relationship-state-static:snapshot:${revision}`,
                `relationship-state-test:snapshot:${revision}`,
              ],
            },
          ],
          canonicalIdentities: [
            {
              id: `observed-identity:ephemeral-citation-view:${revision}`,
              identityRef: "identity:ephemeral-citation-view",
              participatingStateRefs: identityParticipants,
              normalizationRefs,
              evidenceRefs: [
                `relationship-identity-static:citation:${revision}`,
                `relationship-identity-test:citation:${revision}`,
              ],
            },
            {
              id: `observed-identity:ephemeral-graph-neighbors-view:${revision}`,
              identityRef: "identity:ephemeral-graph-neighbors-view",
              participatingStateRefs: identityParticipants,
              normalizationRefs,
              evidenceRefs: [
                `relationship-identity-static:graph-neighbors:${revision}`,
                `relationship-identity-test:graph-neighbors:${revision}`,
              ],
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
    if (!options[field]) {
      throw new Error(
        `--${field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)} is required`,
      );
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectRelationshipStateObservation({
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
