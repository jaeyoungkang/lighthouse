#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-inline-analysis-cache-lifecycle.mjs";
const COLLECTOR_PATH = path.join(ROOT, COLLECTOR_REF);
const BOUNDARY_TEST_REF =
  "scripts/architecture-fitness/__tests__/inline-analysis-cache-lifecycle-boundaries.test.ts";
const PROBE_TEST_REF =
  "scripts/architecture-fitness/__tests__/inline-analysis-cache-lifecycle-probe.test.ts";
const TEST_CONFIG_REF = "scripts/architecture-fitness/q5-vitest.config.mts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_PATH =
  "docs/architecture-fitness/pilots/issue-401-inline-analysis-cache-lifecycle.policy.json";
const POLICY_REF = "issue-401:inline-analysis-cache-lifecycle";
const CAPABILITY_REF = "capability:lighthouse-inline-analysis";
const CACHE_REF = "cache:lighthouse-paper-inline-analysis-shared-artifact";
const SCENARIO_REFS = {
  sourceChange: "scenario:lighthouse-inline-analysis-source-change",
  concurrentFill: "scenario:lighthouse-inline-analysis-concurrent-fill",
  fillFailure: "scenario:lighthouse-inline-analysis-fill-failure",
};
const SOURCE_REFS = {
  analysis: "app/domain/analysis.ts",
  identity: "app/server/domain-access/inline-analysis-identity.ts",
  access: "app/server/domain-access/inline-analysis-access.ts",
  repository: "app/server/repository/paper-inline-analysis-cache.ts",
  sharedMigration: "supabase/migrations/00020_shared_inline_analysis_cache.sql",
  failureMigration: "supabase/migrations/00024_inline_analysis_failure_fence.sql",
  runtime: "docs/runtime-flows/search-background-enrichment.md",
};
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalDigest(value) {
  return sha256(canonicalJson(value));
}

function git(args, { accepted = new Set([0]), encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!accepted.has(result.status)) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${String(result.status)}`);
  }
  return result;
}

function includesAll(source, fragments) {
  return fragments.every((fragment) => source.includes(fragment));
}

function ordered(source, fragments) {
  let cursor = -1;
  return fragments.every((fragment) => {
    cursor = source.indexOf(fragment, cursor + 1);
    return cursor >= 0;
  });
}

function extractInlineAnalysisVersion(source) {
  const match = source.match(/INLINE_ANALYSIS_VERSION\s*=\s*([0-9_]+)/u);
  return match ? Number(match[1].replaceAll("_", "")) : null;
}

export function extractInlineAnalysisIdentityConstraint(source) {
  const columns = source.match(
    /constraint\s+paper_inline_analysis_cache_input_key\s+unique\s*\(([^)]*)\)/iu,
  )?.[1];
  if (!columns) return [];
  return columns
    .split(",")
    .map((column) => column.trim().replaceAll('"', ""))
    .filter(Boolean);
}

export function inspectInlineAnalysisSources(sources) {
  const analysisVersion = extractInlineAnalysisVersion(sources.analysis);
  const identityConstraint = extractInlineAnalysisIdentityConstraint(sources.sharedMigration);
  const hasCanonicalSource = includesAll(sources.identity, [
    'createHash("sha256")',
    "normalizeInlineAnalysisInputText(paper.title)",
    "normalizeInlineAnalysisInputText(paper.abstract)",
    "year: paper.year ?? null",
  ]);
  const hasIdentity =
    Number.isInteger(analysisVersion) &&
    includesAll(sources.identity, [
      "paperId: paper.paperId",
      "version: INLINE_ANALYSIS_VERSION",
      "inputFingerprint: buildInlineAnalysisInputFingerprint(paper)",
    ]) &&
    canonicalJson(identityConstraint) ===
      canonicalJson(["paper_id", "version", "input_fingerprint"]);
  const hasReadyOnlyRead = includesAll(sources.sharedMigration, [
    "create or replace function lighthouse.list_paper_inline_analysis_cache",
    "where cache.status = 'ready'",
  ]);
  const hasUsableAbstractBoundary = includesAll(sources.identity, [
    "hasUsableInlineAnalysisAbstract",
    ".filter((paper)",
  ]);
  const hasClaimBeforeFill =
    ordered(sources.access, [
      "claimInlineAnalysisGeneration(",
      "const claimedPapers = generationCandidatePapers.filter",
      "analyzeClaimedPapersInIsolation({",
    ]) &&
    includesAll(sources.access, [
      "SHARED_CACHE_INITIAL_LEASE_SECONDS = 30",
      "claimedPaperIds.has(paper.paperId)",
      "waitingIdentities",
      "waitForPeerInlineAnalysisCache",
    ]);
  const hasSubscriberIsolation = includesAll(sources.access, [
    "inFlightInlineAnalysisResolutions = new Map",
    "subscribers: Set<symbol>",
    "entry.subscribers.delete(subscriber)",
    "entry.subscribers.size === 0",
  ]);
  const hasFailureFence = includesAll(sources.failureMigration, [
    "status in ('pending', 'ready', 'cooldown_failed', 'terminal_failed')",
    "p_retry_command text default 'automatic'",
    "p_retry_command = 'explicit_retry'",
    "status = 'cooldown_failed'",
    "status = 'terminal_failed'",
    "retry_requires_explicit = true",
    "and cache.lease_token = p_lease_token",
  ]);
  const hasAutomaticFence = includesAll(sources.access, [
    'const retryCommand = params.retryCommand ?? "automatic"',
    'if (retryCommand === "automatic") return false',
    'state.status === "terminal_failed"',
    "Date.parse(state.cooldownUntil) <= Date.now()",
  ]);
  const runtimeAgrees = includesAll(sources.runtime, [
    "(paper_id, analysis_version, canonical title/abstract/year input_fingerprint)",
    "30초 expiring lease",
    "cooldown_failed",
    "terminal_failed",
    "explicit retry command",
  ]);
  const durableSharedStore = includesAll(sources.sharedMigration, [
    "create table lighthouse.paper_inline_analysis_cache",
    "lease_token text",
    "lease_expires_at timestamptz",
  ]);

  return {
    cacheRef: CACHE_REF,
    sourceOwnerRef: hasCanonicalSource
      ? "source:provider-paper-title-abstract-year"
      : "source:unresolved",
    keyRefs: hasIdentity
      ? ["key:paper-id", "key:inline-analysis-version", "key:canonical-input-fingerprint"]
      : ["key:unresolved"],
    freshnessRef:
      hasIdentity && hasCanonicalSource
        ? "freshness:exact-input-fingerprint-and-analysis-version-no-time-ttl"
        : "freshness:unresolved",
    invalidationRefs:
      hasIdentity && hasCanonicalSource
        ? [
            "invalidation:canonical-input-fingerprint-change",
            "invalidation:inline-analysis-version-change",
          ]
        : ["invalidation:unresolved"],
    missRef:
      hasClaimBeforeFill && runtimeAgrees
        ? "miss:exact-identity-db-claim-before-provider-fill"
        : "miss:unresolved",
    negativeResultRef:
      hasReadyOnlyRead && hasUsableAbstractBoundary
        ? "negative:no-ready-artifact-without-usable-abstract"
        : "negative:unresolved",
    failureRef:
      hasReadyOnlyRead && hasFailureFence && hasAutomaticFence && runtimeAgrees
        ? "failure:durable-explicit-retry-fence-never-ready-artifact"
        : "failure:unresolved",
    fillControlRef:
      hasClaimBeforeFill && hasSubscriberIsolation
        ? "fill:exact-identity-db-token-lease-plus-process-subscriber-coalescing"
        : "fill:unresolved",
    sharingScope: durableSharedStore && hasClaimBeforeFill ? "fleet" : "process",
    persistenceScope: durableSharedStore ? "durable" : "ephemeral",
    analysisVersion,
  };
}

const REQUIRED_COVERAGE = new Map([
  ["coverage:issue-401-inline-analysis-deterministic-lifecycle", "included"],
  ["coverage:issue-401-inline-analysis-fleet", "unsupported"],
  ["coverage:issue-401-inline-analysis-cleanup-effects", "unsupported"],
  ["coverage:issue-401-inline-analysis-provider-outcome", "unsupported"],
]);

export function validatePolicyBoundary(policy) {
  const violations = [];
  const policies = policy?.policies ?? [];
  if (policies.length !== 1 || policies[0]?.id !== POLICY_REF) {
    violations.push(`policy set must contain only ${POLICY_REF}`);
  }
  const scenarios = new Set((policies[0]?.lifecycleScenarios ?? []).map((item) => item.id));
  for (const scenarioRef of Object.values(SCENARIO_REFS)) {
    if (!scenarios.has(scenarioRef)) violations.push(`missing scenario: ${scenarioRef}`);
  }
  for (const scenario of policies[0]?.lifecycleScenarios ?? []) {
    if (["process-restart", "instance-movement", "invalidation"].includes(scenario.scenarioKind)) {
      violations.push(
        `unsupported scenario kind entered deterministic case: ${scenario.scenarioKind}`,
      );
    }
  }
  const coverage = new Map((policy?.coverage ?? []).map((item) => [item.id, item]));
  for (const [coverageId, status] of REQUIRED_COVERAGE) {
    const item = coverage.get(coverageId);
    if (item?.status !== status) violations.push(`${coverageId} must remain ${status}`);
    const expectedPolicyRefs = status === "included" ? [POLICY_REF] : [];
    if (canonicalJson(item?.policyRefs ?? []) !== canonicalJson(expectedPolicyRefs)) {
      violations.push(`${coverageId} has invalid policyRefs`);
    }
  }
  if (coverage.size !== REQUIRED_COVERAGE.size) {
    violations.push("policy coverage must remain the bounded four-lens inventory");
  }
  return violations;
}

const PROBE_ASSERTIONS = {
  sourceChange: "normalizes canonical input and separates content, year, and version identity",
  hitAndMiss: "reuses a ready hit and claims a miss before provider execution",
  losingWorker: "keeps an unclaimed worker out of provider execution",
  subscriberIsolation: "isolates one subscriber abort from shared process work",
  failureFence: "blocks automatic failed-state retry and allows explicit retry",
};

function assertionsBySuffix(test) {
  const assertions = (test?.tests ?? []).flatMap((item) => item.assertions ?? []);
  return Object.fromEntries(
    Object.entries(PROBE_ASSERTIONS).map(([key, suffix]) => [
      key,
      assertions.find((assertion) => assertion.name.endsWith(suffix))?.status === "passed",
    ]),
  );
}

export function normalizeProbeTestReport(test) {
  const passed = assertionsBySuffix(test);
  const harnessValid = test?.exitCode === 0 && test?.tests?.length === 1;
  const sourceChangeValid = harnessValid && passed.sourceChange;
  const concurrentFillValid =
    harnessValid && passed.hitAndMiss && passed.losingWorker && passed.subscriberIsolation;
  const fillFailureValid = harnessValid && passed.failureFence;
  return {
    valid: sourceChangeValid && concurrentFillValid && fillFailureValid,
    outcomes: {
      sourceChange: sourceChangeValid
        ? [
            "outcome:canonical-whitespace-shares-fingerprint",
            "outcome:content-or-year-change-separates-fingerprint",
            "outcome:analysis-version-participates-in-identity",
          ]
        : ["outcome:probe-unavailable"],
      concurrentFill: concurrentFillValid
        ? [
            "outcome:ready-hit-bypasses-provider",
            "outcome:miss-claims-before-provider",
            "outcome:unclaimed-worker-waits-without-provider",
            "outcome:caller-abort-isolated",
          ]
        : ["outcome:probe-unavailable"],
      fillFailure: fillFailureValid
        ? [
            "outcome:failure-state-is-not-ready-artifact",
            "outcome:automatic-retry-is-fenced",
            "outcome:explicit-retry-opens-new-claim",
          ]
        : ["outcome:probe-unavailable"],
    },
  };
}

async function materializeRevision(revision) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lighthouse-inline-cache-revision-"));
  const archive = git(["archive", "--format=tar", revision], { encoding: null });
  const extracted = spawnSync("tar", ["-x", "-C", directory], {
    input: archive.stdout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (extracted.status !== 0) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(extracted.stderr?.toString("utf8") || "could not extract revision");
  }
  return directory;
}

function normalizeVitestResult(result, expectedTestRef) {
  try {
    const report = JSON.parse(result.stdout);
    const tests = (report.testResults ?? []).map((item) => ({
      name: String(item.name).replaceAll(ROOT, "<collector-authority>"),
      status: item.status,
      assertions: (item.assertionResults ?? []).map((assertion) => ({
        name: assertion.fullName,
        status: assertion.status,
      })),
    }));
    const expectedPresent = tests.some((item) => item.name.endsWith(`/${expectedTestRef}`));
    const passed =
      result.status === 0 &&
      expectedPresent &&
      tests.length === 1 &&
      tests.every(
        (item) =>
          item.status === "passed" &&
          item.assertions.every((assertion) => assertion.status === "passed"),
      );
    return {
      exitCode: passed ? 0 : 1,
      numTotalTests: report.numTotalTests,
      numPassedTests: report.numPassedTests,
      tests,
    };
  } catch {
    return {
      exitCode: 1,
      stdout: result.stdout?.replaceAll(ROOT, "<collector-authority>"),
      stderr: result.stderr?.replaceAll(ROOT, "<collector-authority>"),
    };
  }
}

function executeBoundarySuite() {
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    ["run", path.join(ROOT, BOUNDARY_TEST_REF), "--reporter=json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: process.env },
  );
  return normalizeVitestResult(result, BOUNDARY_TEST_REF);
}

function executeProbe(targetRoot) {
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    [
      "run",
      path.join(ROOT, PROBE_TEST_REF),
      "--config",
      path.join(ROOT, TEST_CONFIG_REF),
      "--reporter=json",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? os.homedir(),
        NODE_ENV: "test",
        AF_Q5_TARGET_ROOT: targetRoot,
        AF_Q5_TRUSTED_HARNESS_ROOT: ROOT,
      },
    },
  );
  const test = normalizeVitestResult(result, PROBE_TEST_REF);
  const normalized = normalizeProbeTestReport(test);
  return { exitCode: test.exitCode === 0 && normalized.valid ? 0 : 1, test, normalized };
}

export async function collectorDefinitionDigest() {
  const definitions = [];
  for (const ref of [
    COLLECTOR_REF,
    BOUNDARY_TEST_REF,
    PROBE_TEST_REF,
    TEST_CONFIG_REF,
    TRUST_POLICY_REF,
  ]) {
    const file = ref === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, ref);
    definitions.push({ ref, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

function cacheFact(cache) {
  return `cache-observation-sha256:${canonicalDigest({
    cacheRef: cache.cacheRef,
    sourceOwnerRef: cache.sourceOwnerRef,
    keyRefs: cache.keyRefs,
    freshnessRef: cache.freshnessRef,
    invalidationRefs: cache.invalidationRefs,
    missRef: cache.missRef,
    negativeResultRef: cache.negativeResultRef,
    failureRef: cache.failureRef,
    fillControlRef: cache.fillControlRef,
    sharingScope: cache.sharingScope,
    persistenceScope: cache.persistenceScope,
  })}`;
}

function scenarioFact(scenario) {
  return `cache-scenario-observation-sha256:${canonicalDigest({
    scenarioRef: scenario.scenarioRef,
    cacheRef: scenario.cacheRef,
    scenarioKind: scenario.scenarioKind,
    outcomeRefs: scenario.outcomeRefs,
  })}`;
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

function buildScenario(key, kind, outcomes) {
  const scenarioRef = SCENARIO_REFS[key];
  return {
    id: `observed-${scenarioRef.slice("scenario:".length)}`,
    scenarioRef,
    cacheRef: CACHE_REF,
    scenarioKind: kind,
    outcomeRefs: outcomes,
    evidenceRefs: [`cache-lifecycle-scenario-test:inline-analysis:${kind}`],
  };
}

export async function collectObservation({ policy, revision, runRef }) {
  assert(SHA_PATTERN.test(revision), "revision must be a 40-character commit SHA");
  git(["cat-file", "-e", `${revision}^{commit}`]);
  const policyViolations = validatePolicyBoundary(policy);
  assert(policyViolations.length === 0, policyViolations.join("; "));
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await collectorDefinitionDigest();
  assert(authority.adapterRef === COLLECTOR_REF, `policy adapterRef must equal ${COLLECTOR_REF}`);
  assert(
    authority.definitionDigest === definitionDigest,
    `collector definition digest mismatch: policy=${String(authority.definitionDigest)} observed=${definitionDigest}`,
  );

  const sources = {};
  let sourceExitCode = 0;
  for (const [key, ref] of Object.entries(SOURCE_REFS)) {
    try {
      sources[key] = git(["show", `${revision}:${ref}`]).stdout;
    } catch {
      sources[key] = "";
      sourceExitCode = 1;
    }
  }
  const inspected = inspectInlineAnalysisSources(sources);
  const { analysisVersion, ...cacheFields } = inspected;
  const cache = {
    id: "observed-lighthouse-paper-inline-analysis-shared-artifact",
    ...cacheFields,
    evidenceRefs: [
      "cache-lifecycle-policy-static:inline-analysis",
      "cache-lifecycle-behavior-test:inline-analysis",
    ],
  };
  const boundary = executeBoundarySuite();
  let targetRoot;
  let probe;
  try {
    targetRoot = await materializeRevision(revision);
    probe = executeProbe(targetRoot);
  } catch (error) {
    probe = {
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
      normalized: normalizeProbeTestReport(null),
    };
  } finally {
    if (targetRoot) await rm(targetRoot, { recursive: true, force: true });
  }

  const scenarios = [
    buildScenario("sourceChange", "source-change", probe.normalized.outcomes.sourceChange),
    buildScenario("concurrentFill", "concurrent-fill", probe.normalized.outcomes.concurrentFill),
    buildScenario("fillFailure", "fill-failure", probe.normalized.outcomes.fillFailure),
  ];
  const command = `node ${COLLECTOR_REF} --policy ${POLICY_PATH} --revision ${revision} --run-ref ${runRef}`;
  const probeCommand = `AF_Q5_TARGET_ROOT=<revision:${revision}> node_modules/.bin/vitest run ${PROBE_TEST_REF} --config ${TEST_CONFIG_REF} --reporter=json`;
  const cacheRefs = [CACHE_REF];
  const scenarioRefs = Object.values(SCENARIO_REFS);
  const inspectionDigest = canonicalDigest({
    sourceDigests: Object.fromEntries(
      Object.entries(sources).map(([key, value]) => [key, sha256(value)]),
    ),
    analysisVersion,
    cache,
  });
  const boundaryDigest = canonicalDigest(boundary);
  const probeDigest = canonicalDigest(probe);
  const commonTarget = { policyRef: POLICY_REF, capabilityRef: CAPABILITY_REF, cacheRefs };
  const scenarioEvidenceItems = scenarios.map((scenario) =>
    evidence({
      id: `cache-lifecycle-scenario-test:inline-analysis:${scenario.scenarioKind}`,
      kind: "test",
      role: "cache-lifecycle-scenario-test",
      source: PROBE_TEST_REF,
      revision,
      summary: `The probe records the deterministic ${scenario.scenarioKind} outcomes without declaring a verdict.`,
      command: probeCommand,
      exitCode: probe.exitCode,
      digest: probeDigest,
      runRef,
      target: {
        ...commonTarget,
        lifecycleScenarioRefs: [scenario.scenarioRef],
        factRefs: [scenarioFact(scenario), "behavior:cache-scenario-observed"],
      },
    }),
  );
  const evidenceItems = [
    evidence({
      id: "cache-lifecycle-coverage-static:inline-analysis",
      kind: "static",
      role: "cache-lifecycle-coverage-static",
      source: SOURCE_REFS.runtime,
      revision,
      summary:
        "The bounded inventory contains only deterministic inline-analysis identity, fill, subscriber, and failure-fence scenarios.",
      command,
      exitCode: sourceExitCode,
      digest: inspectionDigest,
      runRef,
      target: {
        ...commonTarget,
        lifecycleScenarioRefs: scenarioRefs,
        factRefs: ["coverage:all-cache-lifecycle-objects"],
      },
    }),
    evidence({
      id: "cache-lifecycle-coverage-negative-guard:inline-analysis",
      kind: "test",
      role: "cache-lifecycle-coverage-negative-guard",
      source: BOUNDARY_TEST_REF,
      revision,
      summary:
        "The collector-authority guard detects identity, claim, subscriber, failure-fence, and unsupported-scope mutations.",
      command: `node_modules/.bin/vitest run ${BOUNDARY_TEST_REF} --reporter=json`,
      exitCode: boundary.exitCode,
      digest: boundaryDigest,
      runRef,
      target: {
        ...commonTarget,
        lifecycleScenarioRefs: scenarioRefs,
        factRefs: ["coverage:cache-lifecycle-negative-guard"],
      },
    }),
    evidence({
      id: "cache-lifecycle-policy-static:inline-analysis",
      kind: "static",
      role: "cache-lifecycle-policy-static",
      source: SOURCE_REFS.identity,
      revision,
      summary:
        "The collector normalizes exact source identity, version freshness, ready-only reuse, DB claim, failure, fill control, and storage scope facts.",
      command,
      exitCode: sourceExitCode,
      digest: inspectionDigest,
      runRef,
      target: {
        ...commonTarget,
        lifecycleScenarioRefs: [],
        factRefs: [cacheFact(cache), "structure:cache-policy-observed"],
      },
    }),
    evidence({
      id: "cache-lifecycle-behavior-test:inline-analysis",
      kind: "test",
      role: "cache-lifecycle-behavior-test",
      source: PROBE_TEST_REF,
      revision,
      summary:
        "The trusted harness executes the exact-revision inline-analysis production resolution seam with controlled repository and provider effects.",
      command: probeCommand,
      exitCode: probe.exitCode,
      digest: probeDigest,
      runRef,
      target: {
        ...commonTarget,
        lifecycleScenarioRefs: [],
        factRefs: [cacheFact(cache), "behavior:cache-lifecycle-observed"],
      },
    }),
    ...scenarioEvidenceItems,
  ];
  const complete = sourceExitCode === 0 && boundary.exitCode === 0 && probe.exitCode === 0;
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
        payloadDigest: "0".repeat(64),
        signature: "0".repeat(64),
      },
    },
    evidence: evidenceItems,
    observations: [
      {
        id: "observation:issue-401-inline-analysis-cache-lifecycle",
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        completeness: complete ? "complete" : "partial",
        coverageEvidenceRefs: [
          "cache-lifecycle-coverage-static:inline-analysis",
          "cache-lifecycle-coverage-negative-guard:inline-analysis",
        ],
        caches: [cache],
        lifecycleScenarios: scenarios,
      },
    ],
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--policy", "--revision", "--run-ref", "--output"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = value;
    index += 1;
  }
  for (const key of ["policy", "revision", "run-ref", "output"]) {
    if (!options[key]) throw new Error(`Missing --${key}`);
  }
  return {
    policy: options.policy,
    revision: options.revision,
    runRef: options["run-ref"],
    output: options.output,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  await writeFile(path.resolve(options.output), `${JSON.stringify(observation, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
