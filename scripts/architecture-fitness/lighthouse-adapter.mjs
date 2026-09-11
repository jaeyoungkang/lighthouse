#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateMergeEligibility } from "./merge-advisory.mjs";
import { loadAndValidateArchitectureFitnessCoverageProjection } from "./coverage-projection.mjs";
import {
  ISSUE_276_PROFILE,
  ISSUE_276_RELATIONSHIP_PROFILE,
  ISSUE_278_PROFILE,
  ISSUE_280_281_PROFILE,
  ISSUE_286_Q3_WORKLOAD_PROFILE,
  ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE,
  ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE,
  ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE,
  ISSUE_401_GAP_SHARED_STATE_PROFILE,
  ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE,
} from "./lighthouse-profiles.mjs";
import {
  assertLighthouseAssessmentAuthority,
  assertLighthouseCollectorAuthority,
  resolveAttestationMode,
  unsignedEvaluationEnvironment,
} from "./lighthouse-trust-policy.mjs";

export {
  assertLighthouseAssessmentAuthority,
  assertLighthouseCollectorAuthority,
  resolveAttestationMode,
};

const ROOT = process.cwd();
const PILOT_ROOT = path.join(ROOT, "docs", "architecture-fitness", "pilots");
const POLICY = ISSUE_278_PROFILE.policy;
const STATE_POLICY = ISSUE_276_PROFILE.policy;
const RELATIONSHIP_STATE_POLICY = ISSUE_276_RELATIONSHIP_PROFILE.policy;
const Q2_MACRO_POLICY = ISSUE_280_281_PROFILE.policy;
const Q3_WORKLOAD_POLICY = ISSUE_286_Q3_WORKLOAD_PROFILE.policy;
const Q4_TECHNICAL_GRAIN_POLICY = ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE.policy;
const Q5_CACHE_LIFECYCLE_POLICY = ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE.policy;
const ISSUE_399_SERIALIZED_INPUT_BUDGET_POLICY = ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE.policy;
const ISSUE_401_GAP_SHARED_STATE_POLICY = ISSUE_401_GAP_SHARED_STATE_PROFILE.policy;
const ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_POLICY =
  ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE.policy;
const CORE_ROOT = path.join(ROOT, ".agents", "skills", "architecture-fitness-review", "scripts");
const COLLECTOR = ISSUE_278_PROFILE.collector;
const STATE_COLLECTOR = ISSUE_276_PROFILE.collector;
const RELATIONSHIP_STATE_COLLECTOR = ISSUE_276_RELATIONSHIP_PROFILE.collector;
const Q2_MACRO_COLLECTOR = ISSUE_280_281_PROFILE.collector;
const Q3_WORKLOAD_COLLECTOR = ISSUE_286_Q3_WORKLOAD_PROFILE.collector;
const Q4_TECHNICAL_GRAIN_COLLECTOR = ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE.collector;
const Q5_CACHE_LIFECYCLE_COLLECTOR = ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE.collector;
const ISSUE_399_SERIALIZED_INPUT_BUDGET_COLLECTOR =
  ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE.collector;
const ISSUE_401_GAP_SHARED_STATE_COLLECTOR = ISSUE_401_GAP_SHARED_STATE_PROFILE.collector;
const ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_COLLECTOR =
  ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE.collector;
const EVALUATOR = path.join(CORE_ROOT, "evaluate.py");
const CANDIDATE_VALIDATOR = path.join(CORE_ROOT, "validate_candidates.py");
const ORIGINAL_CASE = "issue-278:least-authority-boundary-conformance";
const REVIEWED_PAPER_CASE = "issue-278:reviewed-paper-owner-read";
const SEARCH_STATE_CASE = "issue-276:keyword-search-state-boundary";
const RELATIONSHIP_STATE_CASE = "issue-276:relationship-seed-state-boundary";
const Q2_TOPOLOGY_CASE = "issue-280:episteme-breaker-process-scope";
const Q2_CRITICAL_PATH_CASE = "issue-281:first-ready-search-payload";
const Q3_WORKLOAD_CASE = "issue-286:search-workload-envelope";
const Q4_TECHNICAL_GRAIN_CASE = "issue-297:technical-grain-conformance";
const Q5_CACHE_LIFECYCLE_CASE = "issue-298:preset-title-cache-lifecycle";
const ISSUE_399_SERIALIZED_INPUT_BUDGET_CASE = "issue-399:search-first-condition-url-budget";
const ISSUE_401_GAP_SHARED_STATE_CASE = "issue-401:gap-shared-artifact-viewer-state-boundary";
const ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_CASE = "issue-401:inline-analysis-cache-lifecycle";
const CASES = [
  {
    name: "before",
    revision: "2066f24671d2f24d89c59359888df19f8befb89d",
    runRef: "fixture-run:issue-278-before:2066f246",
    observation: path.join(PILOT_ROOT, "baselines", "issue-278.observation.json"),
    candidates: path.join(PILOT_ROOT, "baselines", "issue-278.candidates.json"),
  },
  {
    name: "after",
    revision: "87877a1a6448c5b355f4c3e7a07273b00c29776c",
    runRef: "fixture-run:issue-449-least-authority:87877a1a",
    observation: path.join(PILOT_ROOT, "issue-278.observation.json"),
    candidates: path.join(PILOT_ROOT, "issue-278.candidates.json"),
  },
];
const STATE_BASELINE = {
  name: "issue-276-baseline",
  revision: "aa4f0b495cdb1f8083d3e24d0cc02be127b3a09e",
  runRef: "fixture-run:issue-276-v31-definition-rebind:aa4f0b49",
  observation: path.join(PILOT_ROOT, "issue-276.observation.json"),
};
const RELATIONSHIP_STATE_BASELINE = {
  name: "issue-276-relationship-baseline",
  revision: "bb7e361ab69a11f3237dffb51fc0f6e25b176037",
  runRef: "fixture-run:issue-276-relationship-v11-baseline:bb7e361a",
  observation: path.join(PILOT_ROOT, "issue-276-relationship.observation.json"),
};
const Q2_MACRO_BASELINE = {
  name: "issue-280-281-q2-macro-baseline",
  revision: "d3365127e26aec3aa1f856926fb7e22b4b501baf",
  runRef: "fixture-run:unified-search-result-projection-review:d3365127",
  observation: path.join(PILOT_ROOT, "issue-280-281.observation.json"),
};
const Q3_WORKLOAD_BASELINE = {
  name: "issue-286-q3-workload-baseline",
  revision: "ef9b2a0de67388e865ef0560ac26118a94821584",
  runRef: "fixture-run:issue-286-q3-workload:ef9b2a0de67388e865ef0560ac26118a94821584",
  observation: path.join(PILOT_ROOT, "issue-286-q3-workload.observation.json"),
};
const Q4_TECHNICAL_GRAIN_BASELINE = {
  name: "issue-297-q4-technical-grain-baseline",
  revision: "b9ba8c42b484e933860f591c807f7b6f56f7c543",
  runRef: "fixture-run:issue-569-q4-definition-integrity:b9ba8c42",
  observation: path.join(PILOT_ROOT, "issue-297-q4-technical-grain.observation.json"),
};
const Q5_CACHE_LIFECYCLE_BASELINE = {
  name: "issue-298-q5-cache-lifecycle-baseline",
  revision: "fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41",
  runRef: "fixture-run:issue-298-q5-cache-lifecycle:fe7f37ab",
  observation: path.join(PILOT_ROOT, "issue-298-q5-cache-lifecycle.observation.json"),
};
const ISSUE_399_SERIALIZED_INPUT_BUDGET_BASELINE = {
  name: "issue-399-serialized-input-budget-baseline",
  revision: "3f6cf3115dfe0be6e4d99262e1f9043c4d8367fa",
  runRef: "fixture-run:issue-683-direct-owner-import:3f6cf311",
  observation: path.join(PILOT_ROOT, "issue-399-serialized-input-budget.observation.json"),
};
const ISSUE_401_GAP_SHARED_STATE_BASELINE = {
  name: "issue-401-gap-shared-state-baseline",
  revision: "ef76b100212d19c76a44b8e49d1eb730645f4e8b",
  runRef: "fixture-run:issue-401-gap-shared-state:ef76b100",
  observation: path.join(PILOT_ROOT, "issue-401-gap-shared-state.observation.json"),
};
const ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_BASELINE = {
  name: "issue-401-inline-analysis-cache-lifecycle-baseline",
  revision: "7e74607c40d1824e5b359daf93c386e02c1eb4e5",
  runRef: "fixture-run:issue-401-inline-analysis-cache-lifecycle-v3-definition-rebind:7e74607c",
  observation: path.join(PILOT_ROOT, "issue-401-inline-analysis-cache-lifecycle.observation.json"),
};
function run(command, args, accepted = new Set([0]), environment = process.env) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: environment,
  });
  if (!accepted.has(result.status)) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status}`;
    throw new Error(`${path.basename(command)} failed: ${detail}`);
  }
  return result;
}

function runPython(script, args, accepted = new Set([0]), environment = process.env) {
  return run("python3", ["-B", script, ...args], accepted, environment);
}

async function assertOrReplace(expectedPath, generatedPath, check) {
  const generated = await readFile(generatedPath, "utf8");
  if (!check) {
    await copyFile(generatedPath, expectedPath);
    return;
  }
  let expected;
  try {
    expected = await readFile(expectedPath, "utf8");
  } catch {
    throw new Error(`Missing generated Architecture Fitness artifact: ${expectedPath}`);
  }
  if (expected !== generated) {
    throw new Error(`Generated Architecture Fitness observation drift: ${expectedPath}`);
  }
}

function collect(item, output) {
  run(process.execPath, [
    COLLECTOR,
    "--policy",
    POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectState(item, output) {
  run(process.execPath, [
    STATE_COLLECTOR,
    "--policy",
    STATE_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectRelationshipState(item, output) {
  run(process.execPath, [
    RELATIONSHIP_STATE_COLLECTOR,
    "--policy",
    RELATIONSHIP_STATE_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectQ2Macro(item, output) {
  run(process.execPath, [
    Q2_MACRO_COLLECTOR,
    "--policy",
    Q2_MACRO_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectQ3Workload(item, output) {
  run(process.execPath, [
    Q3_WORKLOAD_COLLECTOR,
    "--policy",
    Q3_WORKLOAD_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectQ4TechnicalGrain(item, output) {
  run(process.execPath, [
    Q4_TECHNICAL_GRAIN_COLLECTOR,
    "--policy",
    Q4_TECHNICAL_GRAIN_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectQ5CacheLifecycle(item, output) {
  run(process.execPath, [
    Q5_CACHE_LIFECYCLE_COLLECTOR,
    "--policy",
    Q5_CACHE_LIFECYCLE_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectIssue399SerializedInputBudget(item, output) {
  run(process.execPath, [
    ISSUE_399_SERIALIZED_INPUT_BUDGET_COLLECTOR,
    "--policy",
    ISSUE_399_SERIALIZED_INPUT_BUDGET_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectIssue401GapSharedState(item, output) {
  run(process.execPath, [
    ISSUE_401_GAP_SHARED_STATE_COLLECTOR,
    "--policy",
    ISSUE_401_GAP_SHARED_STATE_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function collectIssue401InlineAnalysisCacheLifecycle(item, output) {
  run(process.execPath, [
    ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_COLLECTOR,
    "--policy",
    ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_POLICY,
    "--revision",
    item.revision,
    "--run-ref",
    item.runRef,
    "--output",
    output,
  ]);
}

function validateObservation(observation, policy = POLICY) {
  runPython(EVALUATOR, ["--policy", policy, "--observation", observation, "--validate-only"]);
}

function validateCandidates(item, observation) {
  runPython(CANDIDATE_VALIDATOR, [
    "--policy",
    POLICY,
    "--observation",
    observation,
    "--candidates",
    item.candidates,
  ]);
}

export function evaluateUnsignedObservation(
  observation,
  environment = process.env,
  policy = POLICY,
) {
  return evaluateUnsignedObservationWithExitCode(observation, environment, policy).assessment;
}

export function evaluateUnsignedObservationWithExitCode(
  observation,
  environment = process.env,
  policy = POLICY,
) {
  const result = runPython(
    EVALUATOR,
    ["--policy", policy, "--observation", observation],
    new Set([0, 2, 3]),
    unsignedEvaluationEnvironment(environment),
  );
  return {
    assessment: JSON.parse(result.stdout),
    exitCode: result.status,
  };
}

export function resolveVerdictExitCode(exitCodes) {
  if (exitCodes.some((exitCode) => !new Set([0, 2, 3]).has(exitCode))) {
    throw new Error(`Unsupported Architecture Fitness verdict exit code: ${exitCodes.join(",")}`);
  }
  if (exitCodes.includes(2)) return 2;
  if (exitCodes.includes(3)) return 3;
  return 0;
}

export function resolveReviewProcessExitCode({ verdictExit }, verdictExitCode) {
  return verdictExit ? verdictExitCode : 0;
}

function assertUnsignedReviewSemantics(assessment, caseRef, label) {
  assertLighthouseAssessmentAuthority(assessment);
  assertUnsupportedCoverageUnknown(assessment);
  const stateCase = caseAssessment(assessment, caseRef);
  if (stateCase.verdicts.join(",") !== "unknown") {
    throw new Error(`The unsigned ${label} case must remain unknown`);
  }
  if (assessment.collectorAttestation?.status !== "unverified") {
    throw new Error("Unsigned collector attestation must remain unverified");
  }
}

function caseAssessment(assessment, caseRef) {
  const item = assessment.caseAssessments?.find((candidate) => candidate.caseRef === caseRef);
  if (!item) throw new Error(`Missing Architecture Fitness case assessment: ${caseRef}`);
  return item;
}

function assertUnsupportedCoverageUnknown(assessment) {
  const unsupported = (assessment.coverageAssessments ?? []).filter(
    (item) => item.status === "unsupported",
  );
  if (unsupported.length === 0) throw new Error("Missing unsupported coverage declarations");
  for (const item of unsupported) {
    if (item.verdicts.join(",") !== "unknown") {
      throw new Error(`Unsupported coverage ${item.coverageRef} must remain unknown`);
    }
  }
}

export function assertReviewSemantics(before, after) {
  assertLighthouseAssessmentAuthority(before);
  assertLighthouseAssessmentAuthority(after);
  assertUnsupportedCoverageUnknown(before);
  assertUnsupportedCoverageUnknown(after);
  const beforeCase = caseAssessment(before, REVIEWED_PAPER_CASE);
  const afterCase = caseAssessment(after, REVIEWED_PAPER_CASE);
  const beforeOriginal = caseAssessment(before, ORIGINAL_CASE);
  const afterOriginal = caseAssessment(after, ORIGINAL_CASE);
  if (
    beforeOriginal.verdicts.join(",") !== "unknown" ||
    afterOriginal.verdicts.join(",") !== "unknown"
  ) {
    throw new Error("The uncollected original issue-278 case must remain unknown");
  }
  if (!beforeCase.verdicts.includes("unknown") || !afterCase.verdicts.includes("unknown")) {
    throw new Error("Unsigned observations must evaluate to unknown");
  }
  if (
    before.collectorAttestation?.status !== "unverified" ||
    after.collectorAttestation?.status !== "unverified"
  ) {
    throw new Error("Unsigned collector attestations must remain unverified");
  }
}

export async function runReview({ check = false, validateOnly = false } = {}) {
  if (resolveAttestationMode() !== "unsigned-local") {
    throw new Error("Lighthouse local Architecture Fitness review must remain unsigned");
  }
  const { summary: coverageSummary } = await loadAndValidateArchitectureFitnessCoverageProjection();
  const policy = JSON.parse(await readFile(POLICY, "utf8"));
  assertLighthouseCollectorAuthority(policy.policySet?.collectorAuthority);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "lighthouse-architecture-fitness-v05-"));
  try {
    const collected = {};
    for (const item of CASES) {
      const raw = path.join(tempRoot, `${item.name}.observation.json`);
      collect(item, raw);
      await assertOrReplace(item.observation, raw, check);
      validateObservation(raw);
      validateCandidates(item, raw);
      collected[item.name] = raw;
    }
    const stateObservation = path.join(tempRoot, `${STATE_BASELINE.name}.observation.json`);
    collectState(STATE_BASELINE, stateObservation);
    await assertOrReplace(STATE_BASELINE.observation, stateObservation, check);
    validateObservation(stateObservation, STATE_POLICY);
    const relationshipStateObservation = path.join(
      tempRoot,
      `${RELATIONSHIP_STATE_BASELINE.name}.observation.json`,
    );
    collectRelationshipState(RELATIONSHIP_STATE_BASELINE, relationshipStateObservation);
    await assertOrReplace(
      RELATIONSHIP_STATE_BASELINE.observation,
      relationshipStateObservation,
      check,
    );
    validateObservation(relationshipStateObservation, RELATIONSHIP_STATE_POLICY);
    const q2MacroObservation = path.join(tempRoot, `${Q2_MACRO_BASELINE.name}.observation.json`);
    collectQ2Macro(Q2_MACRO_BASELINE, q2MacroObservation);
    await assertOrReplace(Q2_MACRO_BASELINE.observation, q2MacroObservation, check);
    validateObservation(q2MacroObservation, Q2_MACRO_POLICY);
    const q3WorkloadObservation = path.join(
      tempRoot,
      `${Q3_WORKLOAD_BASELINE.name}.observation.json`,
    );
    collectQ3Workload(Q3_WORKLOAD_BASELINE, q3WorkloadObservation);
    await assertOrReplace(Q3_WORKLOAD_BASELINE.observation, q3WorkloadObservation, check);
    validateObservation(q3WorkloadObservation, Q3_WORKLOAD_POLICY);
    const q4TechnicalGrainObservation = path.join(
      tempRoot,
      `${Q4_TECHNICAL_GRAIN_BASELINE.name}.observation.json`,
    );
    collectQ4TechnicalGrain(Q4_TECHNICAL_GRAIN_BASELINE, q4TechnicalGrainObservation);
    await assertOrReplace(
      Q4_TECHNICAL_GRAIN_BASELINE.observation,
      q4TechnicalGrainObservation,
      check,
    );
    validateObservation(q4TechnicalGrainObservation, Q4_TECHNICAL_GRAIN_POLICY);
    const q5CacheLifecycleObservation = path.join(
      tempRoot,
      `${Q5_CACHE_LIFECYCLE_BASELINE.name}.observation.json`,
    );
    collectQ5CacheLifecycle(Q5_CACHE_LIFECYCLE_BASELINE, q5CacheLifecycleObservation);
    await assertOrReplace(
      Q5_CACHE_LIFECYCLE_BASELINE.observation,
      q5CacheLifecycleObservation,
      check,
    );
    validateObservation(q5CacheLifecycleObservation, Q5_CACHE_LIFECYCLE_POLICY);
    const issue399SerializedInputBudgetObservation = path.join(
      tempRoot,
      `${ISSUE_399_SERIALIZED_INPUT_BUDGET_BASELINE.name}.observation.json`,
    );
    collectIssue399SerializedInputBudget(
      ISSUE_399_SERIALIZED_INPUT_BUDGET_BASELINE,
      issue399SerializedInputBudgetObservation,
    );
    await assertOrReplace(
      ISSUE_399_SERIALIZED_INPUT_BUDGET_BASELINE.observation,
      issue399SerializedInputBudgetObservation,
      check,
    );
    validateObservation(
      issue399SerializedInputBudgetObservation,
      ISSUE_399_SERIALIZED_INPUT_BUDGET_POLICY,
    );
    const issue401GapSharedStateObservation = path.join(
      tempRoot,
      `${ISSUE_401_GAP_SHARED_STATE_BASELINE.name}.observation.json`,
    );
    collectIssue401GapSharedState(
      ISSUE_401_GAP_SHARED_STATE_BASELINE,
      issue401GapSharedStateObservation,
    );
    await assertOrReplace(
      ISSUE_401_GAP_SHARED_STATE_BASELINE.observation,
      issue401GapSharedStateObservation,
      check,
    );
    validateObservation(issue401GapSharedStateObservation, ISSUE_401_GAP_SHARED_STATE_POLICY);
    const issue401InlineAnalysisCacheLifecycleObservation = path.join(
      tempRoot,
      `${ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_BASELINE.name}.observation.json`,
    );
    collectIssue401InlineAnalysisCacheLifecycle(
      ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_BASELINE,
      issue401InlineAnalysisCacheLifecycleObservation,
    );
    await assertOrReplace(
      ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_BASELINE.observation,
      issue401InlineAnalysisCacheLifecycleObservation,
      check,
    );
    validateObservation(
      issue401InlineAnalysisCacheLifecycleObservation,
      ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_POLICY,
    );
    if (validateOnly) {
      return { mode: "validate-only", trusted: false, eligibility: null, coverageSummary };
    }

    const verdictExitCodes = [];
    const evaluate = (observation, policy = POLICY) => {
      const result = evaluateUnsignedObservationWithExitCode(observation, process.env, policy);
      verdictExitCodes.push(result.exitCode);
      return result.assessment;
    };
    const assessments = {};
    for (const item of CASES) {
      const observation = collected[item.name];
      assessments[item.name] = evaluate(observation);
      collected[item.name] = observation;
    }
    assertReviewSemantics(assessments.before, assessments.after);
    const stateAssessment = evaluate(stateObservation, STATE_POLICY);
    assertUnsignedReviewSemantics(stateAssessment, SEARCH_STATE_CASE, "issue-276 keyword-search");
    const relationshipStateAssessment = evaluate(
      relationshipStateObservation,
      RELATIONSHIP_STATE_POLICY,
    );
    assertUnsignedReviewSemantics(
      relationshipStateAssessment,
      RELATIONSHIP_STATE_CASE,
      "issue-276 relationship-seed",
    );
    const q2MacroAssessment = evaluate(q2MacroObservation, Q2_MACRO_POLICY);
    assertUnsignedReviewSemantics(q2MacroAssessment, Q2_TOPOLOGY_CASE, "issue-280 topology");
    assertUnsignedReviewSemantics(
      q2MacroAssessment,
      Q2_CRITICAL_PATH_CASE,
      "issue-281 critical-path",
    );
    const q3WorkloadAssessment = evaluate(q3WorkloadObservation, Q3_WORKLOAD_POLICY);
    assertUnsignedReviewSemantics(q3WorkloadAssessment, Q3_WORKLOAD_CASE, "issue-286 workload");
    const q4TechnicalGrainAssessment = evaluate(
      q4TechnicalGrainObservation,
      Q4_TECHNICAL_GRAIN_POLICY,
    );
    assertUnsignedReviewSemantics(
      q4TechnicalGrainAssessment,
      Q4_TECHNICAL_GRAIN_CASE,
      "issue-297 technical-grain",
    );
    const q5CacheLifecycleAssessment = evaluate(
      q5CacheLifecycleObservation,
      Q5_CACHE_LIFECYCLE_POLICY,
    );
    assertUnsignedReviewSemantics(
      q5CacheLifecycleAssessment,
      Q5_CACHE_LIFECYCLE_CASE,
      "issue-298 cache-lifecycle",
    );
    const issue399SerializedInputBudgetAssessment = evaluate(
      issue399SerializedInputBudgetObservation,
      ISSUE_399_SERIALIZED_INPUT_BUDGET_POLICY,
    );
    assertUnsignedReviewSemantics(
      issue399SerializedInputBudgetAssessment,
      ISSUE_399_SERIALIZED_INPUT_BUDGET_CASE,
      "issue-399 serialized-input-budget",
    );
    const issue401GapSharedStateAssessment = evaluate(
      issue401GapSharedStateObservation,
      ISSUE_401_GAP_SHARED_STATE_POLICY,
    );
    assertUnsignedReviewSemantics(
      issue401GapSharedStateAssessment,
      ISSUE_401_GAP_SHARED_STATE_CASE,
      "issue-401 gap shared state-boundary",
    );
    const issue401InlineAnalysisCacheLifecycleAssessment = evaluate(
      issue401InlineAnalysisCacheLifecycleObservation,
      ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_POLICY,
    );
    assertUnsignedReviewSemantics(
      issue401InlineAnalysisCacheLifecycleAssessment,
      ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_CASE,
      "issue-401 inline-analysis cache-lifecycle",
    );

    const merge = evaluateMergeEligibility(assessments.after, ISSUE_278_PROFILE.mergePolicy);
    const expectedEligibility = "block";
    if (merge.eligibility !== expectedEligibility) {
      throw new Error(`Unsigned merge advisory must equal ${expectedEligibility}`);
    }
    return {
      mode: "unsigned",
      trusted: false,
      eligibility: merge.eligibility,
      originalVerdicts: caseAssessment(assessments.after, ORIGINAL_CASE).verdicts,
      beforeVerdicts: caseAssessment(assessments.before, REVIEWED_PAPER_CASE).verdicts,
      afterVerdicts: caseAssessment(assessments.after, REVIEWED_PAPER_CASE).verdicts,
      stateVerdicts: caseAssessment(stateAssessment, SEARCH_STATE_CASE).verdicts,
      relationshipStateVerdicts: caseAssessment(
        relationshipStateAssessment,
        RELATIONSHIP_STATE_CASE,
      ).verdicts,
      q2TopologyVerdicts: caseAssessment(q2MacroAssessment, Q2_TOPOLOGY_CASE).verdicts,
      q2CriticalPathVerdicts: caseAssessment(q2MacroAssessment, Q2_CRITICAL_PATH_CASE).verdicts,
      q3WorkloadVerdicts: caseAssessment(q3WorkloadAssessment, Q3_WORKLOAD_CASE).verdicts,
      q4TechnicalGrainVerdicts: caseAssessment(q4TechnicalGrainAssessment, Q4_TECHNICAL_GRAIN_CASE)
        .verdicts,
      q5CacheLifecycleVerdicts: caseAssessment(q5CacheLifecycleAssessment, Q5_CACHE_LIFECYCLE_CASE)
        .verdicts,
      issue399SerializedInputBudgetVerdicts: caseAssessment(
        issue399SerializedInputBudgetAssessment,
        ISSUE_399_SERIALIZED_INPUT_BUDGET_CASE,
      ).verdicts,
      issue401GapSharedStateVerdicts: caseAssessment(
        issue401GapSharedStateAssessment,
        ISSUE_401_GAP_SHARED_STATE_CASE,
      ).verdicts,
      issue401InlineAnalysisCacheLifecycleVerdicts: caseAssessment(
        issue401InlineAnalysisCacheLifecycleAssessment,
        ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_CASE,
      ).verdicts,
      verdictExitCode: resolveVerdictExitCode(verdictExitCodes),
      coverageSummary,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { all: false, check: false, validateOnly: false, verdictExit: false };
  for (const value of argv) {
    if (value === "--all") options.all = true;
    else if (value === "--check") options.check = true;
    else if (value === "--validate-only") options.validateOnly = true;
    else if (value === "--verdict-exit") options.verdictExit = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!options.all) throw new Error("Use --all to review the declared v0.9.1 policy sets");
  if (options.validateOnly && options.verdictExit) {
    throw new Error("--verdict-exit requires evaluation and cannot be used with --validate-only");
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runReview(options);
  if (result.mode === "validate-only") {
    console.log(
      "validated issue-278 least-authority, issue-276 keyword/relationship state-boundary, issue-280/281 Q2 macro, issue-286 Q3 workload, issue-297 Q4 technical-grain, issue-298 Q5 cache-lifecycle, issue-399 serialized-input-budget, and issue-401 gap/inline-analysis atomic v0.9.1 policy artifacts",
    );
    console.log(
      `service coverage projection: included=${result.coverageSummary.counts.included} unsupported=${result.coverageSummary.counts.unsupported} excluded=${result.coverageSummary.counts.excluded} authority-missing=${result.coverageSummary.counts["authority-missing"]} active-profiles=${result.coverageSummary.includedProfileCount}/${result.coverageSummary.activeProfileCount}`,
    );
    return;
  }
  console.log(
    `${result.mode} architecture review: issue-278-original=${result.originalVerdicts.join("+")} reviewed-before=${result.beforeVerdicts.join("+")} reviewed-after=${result.afterVerdicts.join("+")} issue-276-search-state=${result.stateVerdicts.join("+")} issue-276-relationship-state=${result.relationshipStateVerdicts.join("+")} issue-280-topology=${result.q2TopologyVerdicts.join("+")} issue-281-critical-path=${result.q2CriticalPathVerdicts.join("+")} issue-286-workload=${result.q3WorkloadVerdicts.join("+")} issue-297-technical-grain=${result.q4TechnicalGrainVerdicts.join("+")} issue-298-cache-lifecycle=${result.q5CacheLifecycleVerdicts.join("+")} issue-399-serialized-input-budget=${result.issue399SerializedInputBudgetVerdicts.join("+")} issue-401-gap-state=${result.issue401GapSharedStateVerdicts.join("+")} issue-401-inline-cache=${result.issue401InlineAnalysisCacheLifecycleVerdicts.join("+")} merge=${result.eligibility}`,
  );
  console.log(
    "This local advisory is unsigned; only the protected GitHub bundle verifier can authorize a signed assessment.",
  );
  console.log(
    `service coverage projection: included=${result.coverageSummary.counts.included} unsupported=${result.coverageSummary.counts.unsupported} excluded=${result.coverageSummary.counts.excluded} authority-missing=${result.coverageSummary.counts["authority-missing"]} active-profiles=${result.coverageSummary.includedProfileCount}/${result.coverageSummary.activeProfileCount}`,
  );
  process.exitCode = resolveReviewProcessExitCode(options, result.verdictExitCode);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
