#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { ISSUE_278_PROFILE, resolveArchitectureFitnessProfile } from "./lighthouse-profiles.mjs";
import {
  LIGHTHOUSE_ATTESTATION_KEY_REF,
  LIGHTHOUSE_AUTHORITATIVE_ATTESTOR_REF,
  assertAuthoritativeInvocation,
  assertLighthouseCollectorAuthority,
  assertVerifiedLighthouseAssessment,
  authoritativeCollectorRunRef,
  resolveAuthoritativeAttestationKey,
  unsignedEvaluationEnvironment,
} from "./lighthouse-trust-policy.mjs";
import { evaluateMergeEligibility } from "./merge-advisory.mjs";

const ROOT = process.cwd();
const PROVENANCE = path.join(ROOT, "shared-skills", "architecture-fitness-review.provenance.json");
const CORE_ROOT = path.join(ROOT, ".agents", "skills", "architecture-fitness-review", "scripts");
const ATTESTOR = path.join(CORE_ROOT, "attest.py");
const EVALUATOR = path.join(CORE_ROOT, "evaluate.py");
const COMPARATOR = path.join(CORE_ROOT, "compare.py");
const SUBJECTS = ["base", "target"];
const BUNDLE_FILES = [
  "policy.json",
  "base.raw-observation.json",
  "target.raw-observation.json",
  "base.observation.json",
  "target.observation.json",
  "base.assessment.json",
  "target.assessment.json",
  "comparison.json",
  "merge-advisory.json",
];

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

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function writeJson(file, value) {
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function fileDigest(file) {
  return sha256(await readFile(file));
}

function runPython(script, args, accepted, environment) {
  const result = spawnSync("python3", ["-B", script, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
  });
  if (result.error) {
    throw new Error(`${path.basename(script)} failed to start: ${result.error.message}`);
  }
  if (!accepted.has(result.status)) {
    const detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
    throw new Error(`${path.basename(script)} failed: ${detail}`);
  }
  return result;
}

function requireEnvironment(environment, key) {
  const value = environment[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing authoritative invocation environment: ${key}`);
  }
  return value;
}

export function invocationFromEnvironment(environment = process.env) {
  return assertAuthoritativeInvocation({
    repository: requireEnvironment(environment, "AF_REPOSITORY"),
    event: requireEnvironment(environment, "AF_EVENT"),
    workflowRef: requireEnvironment(environment, "AF_WORKFLOW_REF"),
    workflowSha: requireEnvironment(environment, "AF_WORKFLOW_SHA"),
    baseRef: requireEnvironment(environment, "AF_BASE_REF"),
    baseRevision: requireEnvironment(environment, "AF_BASE_REVISION"),
    targetRepository: requireEnvironment(environment, "AF_TARGET_REPOSITORY"),
    targetRevision: requireEnvironment(environment, "AF_TARGET_REVISION"),
    actor: requireEnvironment(environment, "AF_ACTOR"),
    pullRequestNumber: requireEnvironment(environment, "AF_PR_NUMBER"),
    runId: requireEnvironment(environment, "AF_RUN_ID"),
    runAttempt: requireEnvironment(environment, "AF_RUN_ATTEMPT"),
    rawArtifactId: requireEnvironment(environment, "AF_RAW_ARTIFACT_ID"),
    rawArtifactDigest: requireEnvironment(environment, "AF_RAW_ARTIFACT_DIGEST"),
  });
}

function revisionFor(invocation, subject) {
  return subject === "base" ? invocation.baseRevision : invocation.targetRevision;
}

function assertRawObservationBinding(observation, invocation, subject) {
  const revision = revisionFor(invocation, subject);
  const runRef = authoritativeCollectorRunRef(invocation, subject, revision);
  if (observation?.revision !== revision) {
    throw new Error(`${subject} observation revision does not match the invocation`);
  }
  if (observation?.collector?.runRef !== runRef) {
    throw new Error(`${subject} observation run ref does not match the invocation`);
  }
  return { revision, runRef };
}

function assertUnsupportedCoverageRemainsUnknown(assessment) {
  for (const coverage of assessment.coverageAssessments ?? []) {
    if (coverage.status === "unsupported" && canonicalJson(coverage.verdicts) !== '["unknown"]') {
      throw new Error(`Unsupported coverage ${coverage.coverageRef} escaped unknown`);
    }
  }
}

async function artifactRecords(directory) {
  const records = {};
  for (const file of BUNDLE_FILES) {
    records[file] = { sha256: await fileDigest(path.join(directory, file)) };
  }
  return records;
}

async function validateUnsignedObservation(file, environment, policy) {
  runPython(
    EVALUATOR,
    ["--policy", policy, "--observation", file, "--validate-only"],
    new Set([0]),
    unsignedEvaluationEnvironment(environment),
  );
}

async function evaluateSignedObservation(policy, observation, output, environment) {
  runPython(
    EVALUATOR,
    ["--policy", policy, "--observation", observation, "--output", output],
    new Set([0, 2, 3]),
    environment,
  );
  return readJson(output);
}

async function compareSignedObservations(policy, before, after, output, environment) {
  runPython(
    COMPARATOR,
    ["--policy", policy, "--before", before, "--after", after, "--output", output],
    new Set([0, 2, 3]),
    environment,
  );
  return readJson(output);
}

function assessmentSummary(assessment) {
  return {
    caseVerdicts: Object.fromEntries(
      (assessment.caseAssessments ?? []).map((item) => [item.caseRef, item.verdicts]),
    ),
    coverageVerdicts: Object.fromEntries(
      (assessment.coverageAssessments ?? []).map((item) => [item.coverageRef, item.verdicts]),
    ),
  };
}

export async function attestAuthoritativeBundle({
  rawDirectory,
  bundleDirectory,
  invocation,
  environment = process.env,
  profileId = ISSUE_278_PROFILE.id,
}) {
  assertAuthoritativeInvocation(invocation);
  resolveAuthoritativeAttestationKey(environment);
  await mkdir(bundleDirectory, { recursive: true });

  const profile = resolveArchitectureFitnessProfile(profileId);
  const policyPath = profile.policy;
  const policy = await readJson(policyPath);
  assertLighthouseCollectorAuthority(policy.policySet?.collectorAuthority);
  const sourceProvenance = await readJson(PROVENANCE);
  await copyFile(policyPath, path.join(bundleDirectory, "policy.json"));

  const assessments = {};
  const bindings = {};
  for (const subject of SUBJECTS) {
    const collectedRaw = path.join(rawDirectory, `${subject}.observation.json`);
    const raw = path.join(bundleDirectory, `${subject}.raw-observation.json`);
    const signed = path.join(bundleDirectory, `${subject}.observation.json`);
    const assessmentFile = path.join(bundleDirectory, `${subject}.assessment.json`);
    await copyFile(collectedRaw, raw);
    const observation = await readJson(raw);
    bindings[subject] = {
      ...assertRawObservationBinding(observation, invocation, subject),
      file: `${subject}.raw-observation.json`,
      sha256: await fileDigest(raw),
    };
    await validateUnsignedObservation(raw, environment, policyPath);
    runPython(
      ATTESTOR,
      ["--policy", policyPath, "--observation", raw, "--output", signed],
      new Set([0]),
      environment,
    );
    assessments[subject] = await evaluateSignedObservation(
      policyPath,
      signed,
      assessmentFile,
      environment,
    );
    assertVerifiedLighthouseAssessment(assessments[subject], bindings[subject]);
    assertUnsupportedCoverageRemainsUnknown(assessments[subject]);
  }

  await compareSignedObservations(
    policyPath,
    path.join(bundleDirectory, "base.observation.json"),
    path.join(bundleDirectory, "target.observation.json"),
    path.join(bundleDirectory, "comparison.json"),
    environment,
  );
  const merge = evaluateMergeEligibility(assessments.target, profile.mergePolicy);
  await writeJson(path.join(bundleDirectory, "merge-advisory.json"), merge);

  const provenance = {
    schemaVersion: "1",
    kind: "lighthouse-architecture-fitness-provenance",
    profileId: profile.id,
    authority: {
      attestorRef: LIGHTHOUSE_AUTHORITATIVE_ATTESTOR_REF,
      keyRef: LIGHTHOUSE_ATTESTATION_KEY_REF,
    },
    invocation,
    core: {
      sourceRepository: sourceProvenance.sourceRepository,
      sourceRevision: sourceProvenance.sourceRevision,
      artifactTreeSha256: sourceProvenance.artifactTreeSha256,
    },
    policyDigest: assessments.target.policyDigest,
    collectorDefinitionDigest: policy.policySet.collectorAuthority.definitionDigest,
    rawInputArtifact: {
      id: invocation.rawArtifactId,
      archiveSha256: invocation.rawArtifactDigest,
      observations: Object.fromEntries(
        SUBJECTS.map((subject) => [
          subject,
          { file: bindings[subject].file, sha256: bindings[subject].sha256 },
        ]),
      ),
    },
    artifacts: await artifactRecords(bundleDirectory),
    base: assessmentSummary(assessments.base),
    target: assessmentSummary(assessments.target),
    mergeEligibility: merge.eligibility,
  };
  await writeJson(path.join(bundleDirectory, "provenance.json"), provenance);
  return provenance;
}

function assertSameJson(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} does not match protected verifier output`);
  }
}

export async function verifyAuthoritativeBundle({
  bundleDirectory,
  invocation,
  environment = process.env,
  profileId = ISSUE_278_PROFILE.id,
}) {
  assertAuthoritativeInvocation(invocation);
  resolveAuthoritativeAttestationKey(environment);
  const profile = resolveArchitectureFitnessProfile(profileId);
  const policyPath = profile.policy;
  const provenance = await readJson(path.join(bundleDirectory, "provenance.json"));
  if (provenance.kind !== "lighthouse-architecture-fitness-provenance") {
    throw new Error("Invalid Architecture Fitness provenance kind");
  }
  if (provenance.profileId !== profile.id) {
    throw new Error("Architecture Fitness provenance profile does not match the verifier profile");
  }
  assertSameJson(provenance.invocation, invocation, "Invocation provenance");
  if (
    provenance.authority?.attestorRef !== LIGHTHOUSE_AUTHORITATIVE_ATTESTOR_REF ||
    provenance.authority?.keyRef !== LIGHTHOUSE_ATTESTATION_KEY_REF
  ) {
    throw new Error("Provenance authority does not match the active Lighthouse authority");
  }

  for (const [file, record] of Object.entries(provenance.artifacts ?? {})) {
    if (
      !BUNDLE_FILES.includes(file) ||
      record?.sha256 !== (await fileDigest(path.join(bundleDirectory, file)))
    ) {
      throw new Error(`Artifact payload digest mismatch: ${file}`);
    }
  }
  if (Object.keys(provenance.artifacts ?? {}).length !== BUNDLE_FILES.length) {
    throw new Error("Architecture Fitness provenance artifact set is incomplete");
  }
  if (
    (await fileDigest(path.join(bundleDirectory, "policy.json"))) !== (await fileDigest(policyPath))
  ) {
    throw new Error("Bundle policy does not match the trusted workflow policy");
  }
  const activeSourceProvenance = await readJson(PROVENANCE);
  assertSameJson(
    provenance.core,
    {
      sourceRepository: activeSourceProvenance.sourceRepository,
      sourceRevision: activeSourceProvenance.sourceRevision,
      artifactTreeSha256: activeSourceProvenance.artifactTreeSha256,
    },
    "Architecture Fitness core provenance",
  );
  const activePolicy = await readJson(policyPath);
  if (
    provenance.collectorDefinitionDigest !==
    activePolicy.policySet?.collectorAuthority?.definitionDigest
  ) {
    throw new Error("Collector definition provenance does not match the active policy");
  }
  const rawObservations = {};
  for (const subject of SUBJECTS) {
    const file = `${subject}.raw-observation.json`;
    rawObservations[subject] = {
      file,
      sha256: await fileDigest(path.join(bundleDirectory, file)),
    };
  }
  assertSameJson(
    provenance.rawInputArtifact,
    {
      id: invocation.rawArtifactId,
      archiveSha256: invocation.rawArtifactDigest,
      observations: rawObservations,
    },
    "Raw input artifact provenance",
  );

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lighthouse-af-verifier-"));
  try {
    const verifiedAssessments = {};
    for (const subject of SUBJECTS) {
      const rawObservationFile = path.join(bundleDirectory, `${subject}.raw-observation.json`);
      const observationFile = path.join(bundleDirectory, `${subject}.observation.json`);
      const reAttestedObservationFile = path.join(tempRoot, `${subject}.observation.json`);
      const storedAssessment = await readJson(
        path.join(bundleDirectory, `${subject}.assessment.json`),
      );
      const rawObservation = await readJson(rawObservationFile);
      assertRawObservationBinding(rawObservation, invocation, subject);
      await validateUnsignedObservation(rawObservationFile, environment, policyPath);
      runPython(
        ATTESTOR,
        [
          "--policy",
          path.join(bundleDirectory, "policy.json"),
          "--observation",
          rawObservationFile,
          "--output",
          reAttestedObservationFile,
        ],
        new Set([0]),
        environment,
      );
      assertSameJson(
        await readJson(observationFile),
        await readJson(reAttestedObservationFile),
        `${subject} signed observation`,
      );
      const observation = await readJson(observationFile);
      const binding = assertRawObservationBinding(observation, invocation, subject);
      verifiedAssessments[subject] = await evaluateSignedObservation(
        path.join(bundleDirectory, "policy.json"),
        observationFile,
        path.join(tempRoot, `${subject}.assessment.json`),
        environment,
      );
      assertVerifiedLighthouseAssessment(verifiedAssessments[subject], binding);
      assertUnsupportedCoverageRemainsUnknown(verifiedAssessments[subject]);
      assertSameJson(storedAssessment, verifiedAssessments[subject], `${subject} assessment`);
    }

    const verifiedComparison = await compareSignedObservations(
      path.join(bundleDirectory, "policy.json"),
      path.join(bundleDirectory, "base.observation.json"),
      path.join(bundleDirectory, "target.observation.json"),
      path.join(tempRoot, "comparison.json"),
      environment,
    );
    assertSameJson(
      await readJson(path.join(bundleDirectory, "comparison.json")),
      verifiedComparison,
      "Comparison",
    );
    const verifiedMerge = evaluateMergeEligibility(verifiedAssessments.target, profile.mergePolicy);
    assertSameJson(
      await readJson(path.join(bundleDirectory, "merge-advisory.json")),
      verifiedMerge,
      "Merge advisory",
    );
    if (provenance.policyDigest !== verifiedAssessments.target.policyDigest) {
      throw new Error("Policy digest provenance does not match the verified assessment");
    }
    assertSameJson(
      provenance.base,
      assessmentSummary(verifiedAssessments.base),
      "Base assessment provenance",
    );
    assertSameJson(
      provenance.target,
      assessmentSummary(verifiedAssessments.target),
      "Target assessment provenance",
    );
    if (provenance.mergeEligibility !== verifiedMerge.eligibility) {
      throw new Error("Merge eligibility provenance does not match the verified advisory");
    }

    const verification = {
      schemaVersion: "1",
      kind: "lighthouse-architecture-fitness-verification",
      status: "verified",
      profileId: profile.id,
      invocation,
      provenanceSha256: await fileDigest(path.join(bundleDirectory, "provenance.json")),
      artifactDigests: provenance.artifacts,
      target: assessmentSummary(verifiedAssessments.target),
      mergeEligibility: verifiedMerge.eligibility,
    };
    await writeJson(path.join(bundleDirectory, "verification.json"), verification);
    return verification;
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const [command, first, second, third] = process.argv.slice(2);
  const invocation = invocationFromEnvironment();
  if (command === "attest" && first && second) {
    await attestAuthoritativeBundle({
      rawDirectory: path.resolve(first),
      bundleDirectory: path.resolve(second),
      invocation,
      profileId: third ?? ISSUE_278_PROFILE.id,
    });
    return;
  }
  if (command === "verify" && first && !third) {
    await verifyAuthoritativeBundle({
      bundleDirectory: path.resolve(first),
      invocation,
      profileId: second ?? ISSUE_278_PROFILE.id,
    });
    return;
  }
  throw new Error(
    "Usage: authoritative-attestation.mjs attest <raw-directory> <bundle-directory> [profile-id] | verify <bundle-directory> [profile-id]",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
