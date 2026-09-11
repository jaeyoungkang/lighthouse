#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";
import {
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "./path-test-command.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-gap-shared-state-boundary.mjs";
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const TEST_REF = "scripts/architecture-fitness/__tests__/gap-shared-state-boundary.test.ts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const POLICY_PATH = "docs/architecture-fitness/pilots/issue-401-gap-shared-state.policy.json";
const POLICY_REF = "issue-401:gap-shared-artifact-viewer-state-boundary";
const CAPABILITY_REF = "capability:gap-shared-artifact-viewer-state";
const ZERO_DIGEST = "0".repeat(64);

export const GAP_STATE_BOUNDARY_SOURCE_FILES = {
  migration: "supabase/migrations/00019_shared_gap_report_artifacts.sql",
  repository: "app/server/repository/gap-reports.ts",
  payloadSchema: "app/domain/research-route-payload-schema.ts",
  sourceIdentity: "app/server/domain-access/gap-report-source-identity.ts",
  apiRoute: "app/api/gap-reports/route.ts",
  destinationCarrier: "app/components/research-route-renderers/search-view-agent-actions.ts",
};

const PATH_TESTS = [
  "app/server/repository/__tests__/gap-reports.test.ts",
  "app/server/domain-access/__tests__/gap-report-source-identity.test.ts",
  "app/api/gap-reports/__tests__/route.test.ts",
  "app/components/research-route-renderers/__tests__/search-view-agent-actions.test.ts",
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

function compact(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

async function productionFiles(root, relative = "app") {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const child = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      result.push(...(await productionFiles(root, child)));
    } else if (/\.(?:ts|tsx|mjs)$/.test(entry.name) && !/\.(?:test|spec)\./.test(entry.name)) {
      result.push(child);
    }
  }
  return result;
}

function ruleResult(rule, errors, facts) {
  facts[rule] = errors.length === 0;
  return errors.length === 0 ? null : { rule, errors };
}

function requireIncludes(source, required, label, errors) {
  for (const value of required) {
    if (!source.includes(value)) errors.push(`${label} is missing: ${value}`);
  }
}

export async function runGapStateBoundaryGuard({ root = ROOT } = {}) {
  const sources = {};
  const missing = [];
  for (const [name, relative] of Object.entries(GAP_STATE_BOUNDARY_SOURCE_FILES)) {
    try {
      sources[name] = await readFile(path.join(root, relative), "utf8");
    } catch {
      sources[name] = "";
      missing.push(relative);
    }
  }

  const facts = {};
  const violations = [];
  if (missing.length > 0) {
    violations.push({
      rule: "gap-state-source-inventory",
      errors: missing.map((item) => `missing ${item}`),
    });
  }

  const migration = compact(sources.migration);
  const repository = compact(sources.repository);
  const payloadSchema = compact(sources.payloadSchema);
  const sourceIdentity = compact(sources.sourceIdentity);
  const apiRoute = compact(sources.apiRoute);
  const destinationCarrier = compact(sources.destinationCarrier);

  const sharedErrors = [];
  requireIncludes(
    migration,
    [
      "create table lighthouse.gap_reports ( id uuid primary key default gen_random_uuid()",
      "source_input_digest text not null",
      "constraint gap_reports_source_input_digest_unique unique (source_input_digest)",
    ],
    "shared artifact migration",
    sharedErrors,
  );
  const gapTableDefinition =
    migration.match(/create table lighthouse\.gap_reports \(([\s\S]*?)\);/)?.[1] ?? "";
  const artifactOwnershipField = /\b(?:owner|viewer|principal)(?:_[a-z0-9]+)*\b/i;
  if (artifactOwnershipField.test(gapTableDefinition)) {
    sharedErrors.push("gap_reports must not persist owner, viewer, or principal identity");
  }
  requireIncludes(
    repository,
    [
      "const gapReportRowSchema = z.object({ id: z.string(), source_snapshot_id: z.string(), source_input_digest: z.string()",
      '.from("gap_reports") .select("*") .eq("id", id) .maybeSingle()',
      '.from("gap_reports") .select("*") .eq("source_input_digest", sourceInputDigest) .maybeSingle()',
      "return { source_snapshot_id: params.metadata.sourceSnapshotId, source_input_digest: params.sourceInputDigest",
    ],
    "shared artifact repository",
    sharedErrors,
  );
  const artifactRowSchema =
    repository.match(
      /const gapReportRowSchema = z\.object\(\{([\s\S]*?)\}\); const gapReportReactionPreferenceRowSchema/,
    )?.[1] ?? "";
  const artifactInsertProjection =
    repository.match(
      /function buildGapReportInsertPayload[\s\S]*?return \{([\s\S]*?)\}; \}/,
    )?.[1] ?? "";
  if (artifactOwnershipField.test(artifactRowSchema)) {
    sharedErrors.push(
      "gap artifact row schema must not expose owner, viewer, or principal identity",
    );
  }
  if (artifactOwnershipField.test(artifactInsertProjection)) {
    sharedErrors.push("gap artifact insert must not persist owner, viewer, or principal identity");
  }
  const production = await productionFiles(root);
  const directOwners = [];
  for (const relative of production) {
    const text = await readFile(path.join(root, relative), "utf8");
    if (
      /\.from\(["']gap_reports["']\)/.test(text) ||
      /\.from\(["']gap_report_reactions["']\)/.test(text)
    ) {
      directOwners.push(relative);
    }
  }
  if (
    JSON.stringify(directOwners.sort()) !==
    JSON.stringify([GAP_STATE_BOUNDARY_SOURCE_FILES.repository])
  ) {
    sharedErrors.push(`direct gap table owners drifted: ${directOwners.sort().join(",")}`);
  }
  const shared = ruleResult("creator-less-shared-artifact", sharedErrors, facts);
  if (shared) violations.push(shared);

  const viewerErrors = [];
  requireIncludes(
    migration,
    [
      "create table lighthouse.gap_report_reactions ( gap_report_id uuid not null references lighthouse.gap_reports(id) on delete cascade, viewer_principal_id text not null",
      "primary key (gap_report_id, viewer_principal_id)",
    ],
    "viewer preference migration",
    viewerErrors,
  );
  requireIncludes(
    repository,
    [
      "const gapReportReactionPreferenceRowSchema = z.object({ gap_report_id: z.string(), viewer_principal_id: z.string()",
      '.from("gap_report_reactions") .select("*") .eq("gap_report_id", gapReportId) .eq("viewer_principal_id", viewerPrincipalId) .maybeSingle()',
      "gap_report_id: params.gapReportId, viewer_principal_id: params.viewerPrincipalId",
      '.eq("gap_report_id", params.gapReportId) .eq("viewer_principal_id", params.viewerPrincipalId) .eq("artifact_version", params.artifactVersion) .eq("reaction_version", params.expectedReactionVersion)',
    ],
    "viewer preference repository",
    viewerErrors,
  );
  const viewer = ruleResult("viewer-scoped-preference", viewerErrors, facts);
  if (viewer) violations.push(viewer);

  const retiredErrors = [];
  const gapSchemaMatch = payloadSchema.match(
    /const gapNetworkResearchRoutePayloadSchema = z \.object\(\{([\s\S]*?)\}\) \.strict\(\)/,
  );
  const gapSchema = gapSchemaMatch?.[1] ?? "";
  if (!gapSchemaMatch) retiredErrors.push("strict gap payload schema is missing");
  if (!gapSchema.includes("viewerPrincipalId: z.string()")) {
    retiredErrors.push("gap payload must expose viewerPrincipalId");
  }
  if (gapSchema.includes("ownerPrincipalId")) {
    retiredErrors.push("gap payload must reject retired ownerPrincipalId");
  }
  const retired = ruleResult("retired-gap-owner-alias", retiredErrors, facts);
  if (retired) violations.push(retired);

  const digestErrors = [];
  requireIncludes(
    sourceIdentity,
    [
      "const canonicalInput = { version: GAP_REPORT_SOURCE_IDENTITY_VERSION, sourceQuery: canonical.sourceQuery, sourcePaperIds: canonical.sourcePaperIds, papers: canonical.papers",
      'return createHash("sha256").update(stableJson(canonicalInput)).digest("hex")',
    ],
    "source digest",
    digestErrors,
  );
  const canonicalInput =
    sourceIdentity.match(/const canonicalInput = \{([\s\S]*?)\}; return createHash/)?.[1] ?? "";
  if (/viewer|principal|owner|sourceSnapshotId/i.test(canonicalInput)) {
    digestErrors.push(
      "source digest must not depend on viewer, owner, principal, or ephemeral route id",
    );
  }
  const digest = ruleResult("canonical-gap-source-digest", digestErrors, facts);
  if (digest) violations.push(digest);

  const handoffErrors = [];
  requireIncludes(
    apiRoute,
    [
      'return NextResponse.json( { gapReportId: doc.id, status: isDisplayReady ? "ready" : "pending"',
    ],
    "gap handoff response",
    handoffErrors,
  );
  requireIncludes(
    destinationCarrier,
    [
      "const payload = (await response.json()) as { gapReportId?: unknown }",
      "navigateToGapReport(`/gap/${encodeURIComponent(payload.gapReportId)}`)",
    ],
    "gap destination carrier",
    handoffErrors,
  );
  const responseProjection =
    apiRoute.match(/return NextResponse\.json\( \{([\s\S]*?)\}, \{ status:/)?.[1] ?? "";
  if (/viewer|principal|owner/i.test(responseProjection)) {
    handoffErrors.push("handoff response must carry destination artifact id, not viewer ownership");
  }
  const handoff = ruleResult("destination-owned-gap-handoff", handoffErrors, facts);
  if (handoff) violations.push(handoff);

  return {
    ok: missing.length === 0 && violations.length === 0,
    filesScanned: Object.keys(sources).length + production.length,
    missing,
    violations,
    facts,
  };
}

export const GAP_STATE_NEGATIVE_MUTATIONS = [
  {
    rule: "creator-less-shared-artifact",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.migration,
    before: "  source_snapshot_id text not null,",
    after: "  owner_principal_id text not null,\n  source_snapshot_id text not null,",
  },
  {
    rule: "creator-less-shared-artifact",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.migration,
    before: "  source_snapshot_id text not null,",
    after: "  viewer_principal_id text not null,\n  source_snapshot_id text not null,",
  },
  {
    rule: "creator-less-shared-artifact",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.repository,
    before: "  source_snapshot_id: z.string(),",
    after: "  viewer_principal_id: z.string(),\n  source_snapshot_id: z.string(),",
  },
  {
    rule: "creator-less-shared-artifact",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.repository,
    before: "    source_snapshot_id: params.metadata.sourceSnapshotId,",
    after:
      "    viewer_principal_id: params.viewerPrincipalId,\n    source_snapshot_id: params.metadata.sourceSnapshotId,",
  },
  {
    rule: "creator-less-shared-artifact",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.repository,
    before: '.eq("id", id)\n    .maybeSingle();',
    after: '.eq("id", id)\n    .eq("viewer_principal_id", viewerPrincipalId)\n    .maybeSingle();',
  },
  {
    rule: "viewer-scoped-preference",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.migration,
    before: "  primary key (gap_report_id, viewer_principal_id)",
    after: "  primary key (gap_report_id)",
  },
  {
    rule: "viewer-scoped-preference",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.repository,
    before:
      '.eq("gap_report_id", gapReportId)\n    .eq("viewer_principal_id", viewerPrincipalId)\n    .maybeSingle();',
    after: '.eq("gap_report_id", gapReportId)\n    .maybeSingle();',
  },
  {
    rule: "retired-gap-owner-alias",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.payloadSchema,
    before: "    viewerPrincipalId: z.string(),\n  })\n  .strict();",
    after: "    ownerPrincipalId: z.string(),\n  })\n  .strict();",
  },
  {
    rule: "canonical-gap-source-digest",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.sourceIdentity,
    before: "    version: GAP_REPORT_SOURCE_IDENTITY_VERSION,",
    after:
      "    version: GAP_REPORT_SOURCE_IDENTITY_VERSION,\n    viewerPrincipalId: input.sourceSnapshotId,",
  },
  {
    rule: "destination-owned-gap-handoff",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.apiRoute,
    before: '      gapReportId: doc.id,\n      status: isDisplayReady ? "ready" : "pending",',
    after:
      '      gapReportId: doc.id,\n      viewerPrincipalId: user.id,\n      status: isDisplayReady ? "ready" : "pending",',
  },
  {
    rule: "destination-owned-gap-handoff",
    relative: GAP_STATE_BOUNDARY_SOURCE_FILES.destinationCarrier,
    before: "      navigateToGapReport(`/gap/${encodeURIComponent(payload.gapReportId)}`);",
    after:
      "      navigateToGapReport(`/gap/${encodeURIComponent(payload.gapReportId)}?owner=current`);",
  },
];

export async function executeGapStateNegativeMutationSuite(root) {
  const outcomes = [];
  for (const mutation of GAP_STATE_NEGATIVE_MUTATIONS) {
    const file = path.join(root, mutation.relative);
    const original = await readFile(file, "utf8");
    try {
      const occurrences = original.split(mutation.before).length - 1;
      if (occurrences !== 1) {
        outcomes.push({
          rule: mutation.rule,
          relative: mutation.relative,
          rejected: false,
          error: `mutation target count ${occurrences}`,
        });
        continue;
      }
      await writeFile(file, original.replace(mutation.before, mutation.after), "utf8");
      const result = await runGapStateBoundaryGuard({ root });
      outcomes.push({
        rule: mutation.rule,
        relative: mutation.relative,
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

export async function gapStateCollectorDefinitionDigest() {
  const definitions = [];
  for (const relative of [
    COLLECTOR_REF,
    TEST_REF,
    TRUST_POLICY_REF,
    ...ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  ]) {
    const file = relative === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, relative);
    definitions.push({ ref: relative, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-gap-state-revision-"));
  try {
    const archive = git(["archive", "--format=tar", revision], { encoding: null });
    const extracted = spawnSync("tar", ["-x", "-C", root], {
      input: archive,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (extracted.status !== 0)
      throw new Error(extracted.stderr.trim() || `tar exited ${extracted.status}`);
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function executePathTests(root) {
  const invocation = architectureFitnessPathTestInvocation(PATH_TESTS);
  const result = spawnSync(path.join(ROOT, "node_modules", ".bin", "vitest"), invocation.args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...architectureFitnessPathTestEnvironment(root), NODE_ENV: "test" },
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
  const selected = relatives.map((relative) => ({
    relative,
    results: (pathTests.artifact.testResults ?? []).filter((item) =>
      item.name.endsWith(`/${relative}`),
    ),
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

export async function collectGapStateObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await gapStateCollectorDefinitionDigest();
  if (authority.adapterRef !== COLLECTOR_REF)
    throw new Error(`policy collector adapterRef must equal ${COLLECTOR_REF}`);
  if (authority.definitionDigest !== definitionDigest) {
    throw new Error(
      `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
    );
  }
  if (!policy.policies?.some((item) => item.id === POLICY_REF))
    throw new Error(`policy is missing ${POLICY_REF}`);
  git(["cat-file", "-e", `${revision}^{commit}`]);

  const targetRoot = await materializeRevision(revision);
  try {
    let inspection;
    try {
      inspection = {
        completed: true,
        result: await runGapStateBoundaryGuard({ root: targetRoot }),
      };
    } catch (error) {
      inspection = {
        completed: false,
        result: { ok: false, facts: {}, violations: [] },
        error: error instanceof Error ? error.message : String(error),
      };
    }
    const negative = await executeGapStateNegativeMutationSuite(targetRoot);
    const pathTests = await executePathTests(targetRoot);
    const command = `node ${COLLECTOR_REF} --policy ${POLICY_PATH} --revision ${revision} --run-ref ${runRef}`;
    const pathTestCommand = architectureFitnessPathTestInvocation(PATH_TESTS).command;
    const inspectionDigest = canonicalDigest(inspection);
    const negativeDigest = canonicalDigest(negative.artifact);
    const facts = inspection.result.facts ?? {};
    const target = (stateRefs, identityRefs, factRefs) => ({
      policyRef: POLICY_REF,
      capabilityRef: CAPABILITY_REF,
      stateRefs,
      identityRefs,
      factRefs,
    });
    const sharedRefs = [
      "authority:gap-reports-row",
      "carrier:gap-reports-row",
      "carrier:gap-network-view",
      "carrier:gap-destination-route",
    ];
    const viewerRefs = [
      "authority:gap-viewer-preference-row",
      "carrier:gap-report-reactions-row",
      "carrier:viewer-gap-projection",
    ];
    const sharedHealthy =
      facts["creator-less-shared-artifact"] &&
      facts["retired-gap-owner-alias"] &&
      facts["destination-owned-gap-handoff"];
    const viewerHealthy = facts["viewer-scoped-preference"];
    const digestHealthy = facts["canonical-gap-source-digest"];
    const artifactParticipants = sharedHealthy
      ? ["state:gap-shared-artifact-body"]
      : ["state:gap-shared-artifact-body", "state:gap-viewer-preference"];
    const digestParticipants = digestHealthy
      ? ["state:gap-shared-artifact-body"]
      : ["state:gap-shared-artifact-body", "state:gap-viewer-preference"];
    const preferenceParticipants = viewerHealthy
      ? ["state:gap-shared-artifact-body", "state:gap-viewer-preference"]
      : ["state:gap-viewer-preference"];
    const repositoryTest = selectedPathTestEvidence(pathTests, [PATH_TESTS[0]]);
    const digestTest = selectedPathTestEvidence(pathTests, [PATH_TESTS[1]]);
    const handoffTest = selectedPathTestEvidence(pathTests, [PATH_TESTS[2], PATH_TESTS[3]]);
    const inspectionExit = inspection.completed && inspection.result.ok ? 0 : 1;
    const stateEvidence = [
      evidence({
        id: `gap-state-coverage-static:${revision}`,
        kind: "static",
        role: "state-coverage-static",
        source: `collector:gap-state-inventory:${revision}`,
        revision,
        summary:
          "The exact-revision collector inspected the active shared-artifact migration, sole direct table repository owner, strict gap DTO, canonical source digest, API response, and destination route carrier.",
        command,
        exitCode: inspectionExit,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:gap-shared-artifact-body", "state:gap-viewer-preference"],
          [
            "identity:gap-artifact-id",
            "identity:gap-source-digest",
            "identity:gap-viewer-preference",
          ],
          ["coverage:all-state-boundaries"],
        ),
      }),
      evidence({
        id: `gap-state-coverage-negative-guard:${revision}`,
        kind: "test",
        role: "state-coverage-negative-guard",
        source: "collector:gap-state-negative-mutations",
        revision,
        summary:
          "The collector injected creator ownership, viewer-scoped shared reads, a non-composite preference key, a missing viewer predicate, the retired DTO alias, viewer-coupled source identity, and viewer-owned handoff carriers; every mutation had to be rejected.",
        command,
        exitCode: negative.exitCode,
        digest: negativeDigest,
        runRef,
        target: target(
          ["state:gap-shared-artifact-body", "state:gap-viewer-preference"],
          [
            "identity:gap-artifact-id",
            "identity:gap-source-digest",
            "identity:gap-viewer-preference",
          ],
          ["coverage:undeclared-state-and-identity-rejected"],
        ),
      }),
      evidence({
        id: `gap-state-static:artifact:${revision}`,
        kind: "static",
        role: "state-static",
        source: `${GAP_STATE_BOUNDARY_SOURCE_FILES.migration},${GAP_STATE_BOUNDARY_SOURCE_FILES.repository},${GAP_STATE_BOUNDARY_SOURCE_FILES.payloadSchema},${GAP_STATE_BOUNDARY_SOURCE_FILES.apiRoute},${GAP_STATE_BOUNDARY_SOURCE_FILES.destinationCarrier}`,
        revision,
        summary:
          "The durable gap body is a creator-less gap_reports row, projected with the current viewer only at read time and handed to /gap/:id by artifact id.",
        command,
        exitCode: sharedHealthy ? 0 : 1,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:gap-shared-artifact-body"],
          [],
          [...sharedRefs, "coordination:gap-source-digest-unique-reservation"],
        ),
      }),
      evidence({
        id: `gap-state-test:artifact:${revision}`,
        kind: "test",
        role: "state-test",
        source: `${PATH_TESTS[0]},${PATH_TESTS[2]},${PATH_TESTS[3]}`,
        revision,
        summary:
          "Exact-revision repository and route tests exercise creator-less persistence, cross-viewer shared lookup, id-only API handoff, and /gap/:id navigation.",
        command: pathTestCommand,
        exitCode: Math.max(repositoryTest.exitCode, handoffTest.exitCode),
        digest: canonicalDigest([repositoryTest.digest, handoffTest.digest]),
        runRef,
        target: target(["state:gap-shared-artifact-body"], [], sharedRefs),
      }),
      evidence({
        id: `gap-state-static:viewer-preference:${revision}`,
        kind: "static",
        role: "state-static",
        source: `${GAP_STATE_BOUNDARY_SOURCE_FILES.migration},${GAP_STATE_BOUNDARY_SOURCE_FILES.repository}`,
        revision,
        summary:
          "Reaction preference has its own row authority and every read/write is keyed by gap_report_id plus viewer_principal_id, with artifact and reaction versions retained for CAS.",
        command,
        exitCode: viewerHealthy ? 0 : 1,
        digest: inspectionDigest,
        runRef,
        target: target(
          ["state:gap-viewer-preference"],
          [],
          [...viewerRefs, "coordination:artifact-and-reaction-version-cas"],
        ),
      }),
      evidence({
        id: `gap-state-test:viewer-preference:${revision}`,
        kind: "test",
        role: "state-test",
        source: PATH_TESTS[0],
        revision,
        summary:
          "The exact-revision repository test exercises the viewer tuple, separate preference payload, artifact-version fence, and reaction-version CAS.",
        command: pathTestCommand,
        exitCode: repositoryTest.exitCode,
        digest: repositoryTest.digest,
        runRef,
        target: target(["state:gap-viewer-preference"], [], viewerRefs),
      }),
    ];
    const identitySpecs = [
      {
        name: "artifact-id",
        ref: "identity:gap-artifact-id",
        participants: artifactParticipants,
        normalization: sharedHealthy
          ? ["normalization:gap-report-uuid-v1"]
          : ["normalization:viewer-coupled-gap-id"],
        test: handoffTest,
        source: `${GAP_STATE_BOUNDARY_SOURCE_FILES.migration},${GAP_STATE_BOUNDARY_SOURCE_FILES.repository},${GAP_STATE_BOUNDARY_SOURCE_FILES.apiRoute},${GAP_STATE_BOUNDARY_SOURCE_FILES.destinationCarrier}`,
        testSource: `${PATH_TESTS[0]},${PATH_TESTS[2]},${PATH_TESTS[3]}`,
        summary:
          "gap_reports.id is the durable artifact identity carried by the API response and destination /gap/:id route without viewer ownership.",
      },
      {
        name: "source-digest",
        ref: "identity:gap-source-digest",
        participants: digestParticipants,
        normalization: digestHealthy
          ? ["normalization:canonical-gap-source-sha256-v2"]
          : ["normalization:viewer-coupled-gap-source"],
        test: digestTest,
        source: `${GAP_STATE_BOUNDARY_SOURCE_FILES.sourceIdentity},${GAP_STATE_BOUNDARY_SOURCE_FILES.migration},${GAP_STATE_BOUNDARY_SOURCE_FILES.repository}`,
        testSource: PATH_TESTS[1],
        summary:
          "The global reuse identity hashes only canonical share-safe build input and is unique independently of source route id or viewer.",
      },
      {
        name: "viewer-preference",
        ref: "identity:gap-viewer-preference",
        participants: preferenceParticipants,
        normalization: viewerHealthy
          ? ["normalization:gap-report-viewer-tuple-v1"]
          : ["normalization:gap-report-only-preference"],
        test: repositoryTest,
        source: `${GAP_STATE_BOUNDARY_SOURCE_FILES.migration},${GAP_STATE_BOUNDARY_SOURCE_FILES.repository}`,
        testSource: PATH_TESTS[0],
        summary:
          "Viewer preference identity is exactly the composite (gap_report_id, viewer_principal_id) primary key and repository predicate.",
      },
    ];
    for (const spec of identitySpecs) {
      stateEvidence.push(
        evidence({
          id: `gap-identity-static:${spec.name}:${revision}`,
          kind: "static",
          role: "identity-static",
          source: spec.source,
          revision,
          summary: spec.summary,
          command,
          exitCode: inspectionExit,
          digest: inspectionDigest,
          runRef,
          target: target([], [spec.ref], [...spec.participants, ...spec.normalization]),
        }),
        evidence({
          id: `gap-identity-test:${spec.name}:${revision}`,
          kind: "test",
          role: "identity-test",
          source: spec.testSource,
          revision,
          summary: `Exact-revision focused product tests exercise ${spec.name} stability and separation.`,
          command: pathTestCommand,
          exitCode: spec.test.exitCode,
          digest: spec.test.digest,
          runRef,
          target: target([], [spec.ref], [...spec.participants, ...spec.normalization]),
        }),
      );
    }

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
      evidence: stateEvidence,
      observations: [
        {
          id: `observation:issue-401-gap-shared-state:${revision}`,
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          completeness:
            inspectionExit === 0 && negative.exitCode === 0 && pathTests.exitCode === 0
              ? "complete"
              : "partial",
          coverageEvidenceRefs: [
            `gap-state-coverage-static:${revision}`,
            `gap-state-coverage-negative-guard:${revision}`,
          ],
          states: [
            {
              id: `observed-state:gap-shared-artifact:${revision}`,
              stateRef: "state:gap-shared-artifact-body",
              authorityRefs: sharedHealthy
                ? ["authority:gap-reports-row"]
                : ["authority:gap-reports-row", "authority:viewer-principal"],
              coordinationRefs: ["coordination:gap-source-digest-unique-reservation"],
              carrierRefs: [
                "carrier:gap-reports-row",
                "carrier:gap-network-view",
                "carrier:gap-destination-route",
              ],
              evidenceRefs: [
                `gap-state-static:artifact:${revision}`,
                `gap-state-test:artifact:${revision}`,
              ],
            },
            {
              id: `observed-state:gap-viewer-preference:${revision}`,
              stateRef: "state:gap-viewer-preference",
              authorityRefs: viewerHealthy
                ? ["authority:gap-viewer-preference-row"]
                : ["authority:gap-report-row"],
              coordinationRefs: ["coordination:artifact-and-reaction-version-cas"],
              carrierRefs: viewerHealthy
                ? ["carrier:gap-report-reactions-row", "carrier:viewer-gap-projection"]
                : ["carrier:gap-reports-row"],
              evidenceRefs: [
                `gap-state-static:viewer-preference:${revision}`,
                `gap-state-test:viewer-preference:${revision}`,
              ],
            },
          ],
          canonicalIdentities: identitySpecs.map((spec) => ({
            id: `observed-identity:${spec.name}:${revision}`,
            identityRef: spec.ref,
            participatingStateRefs: spec.participants,
            normalizationRefs: spec.normalization,
            evidenceRefs: [
              `gap-identity-static:${spec.name}:${revision}`,
              `gap-identity-test:${spec.name}:${revision}`,
            ],
          })),
        },
      ],
    };
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
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
      throw new Error(
        `--${field.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)} is required`,
      );
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectGapStateObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  const rendered = `${JSON.stringify(observation, null, 2)}\n`;
  if (options.output) await writeFile(path.resolve(options.output), rendered, "utf8");
  else process.stdout.write(rendered);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
