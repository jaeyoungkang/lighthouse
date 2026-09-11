// guard:gate-parity — gate enforcement-status parity guard (issue #652).
//
// Docs describe some CI jobs as blocking while GitHub branch protection is
// the real authority, and nothing verified the two agreed. This guard makes
// scripts/quality/gate-status.json the canonical, machine-checked declaration
// of which contexts are required, which jobs are advisory, and which
// workflows/jobs are manual-only, and checks it for parity against:
//
//   - the parsed workflow YAML under .github/workflows/ (declared job/context
//     wiring actually exists and triggers the way the declaration claims), and
//   - scripts/quality/branch-protection.snapshot.json, the last observed live
//     GitHub branch protection state (refreshed by
//     scripts/quality/refresh-branch-protection-snapshot.mjs / `npm run gate:snapshot`).
//
// This script is deterministic and offline: it never calls the network or
// the `gh` CLI. It only reads files already in the working tree.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";

const DECLARATION_PATH = path.join("scripts", "quality", "gate-status.json");
const SNAPSHOT_PATH = path.join("scripts", "quality", "branch-protection.snapshot.json");
const WORKFLOWS_DIR = path.join(".github", "workflows");
const QUALITY_WORKFLOW = "quality.yml";

export async function runGateParityCheck(options = {}) {
  const root = options.root ?? process.cwd();
  const violations = [];
  const counts = {
    requiredContexts: 0,
    advisoryJobs: 0,
    manualJobs: 0,
    manualWorkflows: 0,
    automatedWorkflows: 0,
    workflowFilesScanned: 0,
  };

  const declaration = await readJson(root, DECLARATION_PATH, violations);
  const snapshot = await readJson(root, SNAPSHOT_PATH, violations);

  if (!declaration || !snapshot) {
    // Both files are load-bearing for every remaining check. Fail fast with
    // the malformed/missing-file violations already collected above rather
    // than cascading into confusing secondary failures.
    return { ok: false, violations, counts };
  }

  const requiredContexts = Array.isArray(declaration.requiredContexts)
    ? declaration.requiredContexts
    : [];
  const advisoryJobs = Array.isArray(declaration.advisoryJobs) ? declaration.advisoryJobs : [];
  const manualJobs = Array.isArray(declaration.manualJobs) ? declaration.manualJobs : [];
  const manualWorkflows = Array.isArray(declaration.manualWorkflows)
    ? declaration.manualWorkflows
    : [];
  const automatedWorkflows = Array.isArray(declaration.automatedWorkflows)
    ? declaration.automatedWorkflows
    : [];
  counts.requiredContexts = requiredContexts.length;
  counts.advisoryJobs = advisoryJobs.length;
  counts.manualJobs = manualJobs.length;
  counts.manualWorkflows = manualWorkflows.length;
  counts.automatedWorkflows = automatedWorkflows.length;

  // Load every workflow file up front — checks 1, 4, 5, and 6 all need it.
  let workflowFiles = [];
  try {
    workflowFiles = (await readdir(path.join(root, WORKFLOWS_DIR))).filter((file) =>
      /\.ya?ml$/.test(file),
    );
  } catch (error) {
    violations.push(`${WORKFLOWS_DIR}: could not list workflow directory (${errorMessage(error)})`);
    return { ok: false, violations, counts };
  }
  counts.workflowFilesScanned = workflowFiles.length;

  const workflows = new Map();
  for (const file of workflowFiles) {
    const relativePath = path.join(WORKFLOWS_DIR, file);
    try {
      const raw = await readFile(path.join(root, relativePath), "utf8");
      const parsed = parseYaml(raw);
      workflows.set(file, parsed && typeof parsed === "object" ? parsed : {});
    } catch (error) {
      violations.push(`${relativePath}: could not parse workflow YAML (${errorMessage(error)})`);
    }
  }

  // Check 1: every requiredContexts entry's workflow+job exists, and that
  // workflow triggers on pull_request.
  for (const entry of requiredContexts) {
    const label = `requiredContexts[${JSON.stringify(entry?.context ?? "?")}]`;
    const workflow = resolveWorkflow(workflows, entry?.workflow, label, violations);
    if (!workflow) continue;
    if (!jobExists(workflow, entry?.job)) {
      violations.push(`${label}: job '${String(entry?.job)}' does not exist in ${entry.workflow}`);
    }
    if (!hasTrigger(workflow, "pull_request")) {
      violations.push(
        `${label}: ${entry.workflow} does not trigger on pull_request, but a required context is declared to come from it`,
      );
    }
  }

  // Check 2: set equality between declared required context names and the
  // snapshot's observed required-status-check contexts.
  const declaredContextNames = new Set(
    requiredContexts.map((entry) => entry?.context).filter((value) => typeof value === "string"),
  );
  const snapshotContextNames = new Set(
    Array.isArray(snapshot?.requiredStatusChecks?.contexts)
      ? snapshot.requiredStatusChecks.contexts
      : [],
  );
  for (const context of declaredContextNames) {
    if (!snapshotContextNames.has(context)) {
      violations.push(
        `${SNAPSHOT_PATH}: declared required context '${context}' is missing from the live branch protection snapshot`,
      );
    }
  }
  for (const context of snapshotContextNames) {
    if (!declaredContextNames.has(context)) {
      violations.push(
        `${DECLARATION_PATH}: live branch protection requires context '${context}' that is not declared in requiredContexts`,
      );
    }
  }

  // Check 3: snapshot integrity floor.
  if (snapshot.enforceAdmins !== true) {
    violations.push(
      `${SNAPSHOT_PATH}: enforceAdmins must be true (branch protection must apply to admins too), found ${JSON.stringify(snapshot.enforceAdmins)}`,
    );
  }
  if (snapshot.allowForcePushes !== false) {
    violations.push(
      `${SNAPSHOT_PATH}: allowForcePushes must be false, found ${JSON.stringify(snapshot.allowForcePushes)}`,
    );
  }
  if (snapshot.allowDeletions !== false) {
    violations.push(
      `${SNAPSHOT_PATH}: allowDeletions must be false, found ${JSON.stringify(snapshot.allowDeletions)}`,
    );
  }

  // Check 4: every manualWorkflows file exists and has workflow_dispatch as
  // its ONLY trigger.
  for (const file of manualWorkflows) {
    if (typeof file !== "string") {
      violations.push(`manualWorkflows: entry ${JSON.stringify(file)} is not a filename string`);
      continue;
    }
    const workflow = workflows.get(file);
    if (!workflow) {
      violations.push(
        `manualWorkflows: declared workflow '${file}' does not exist under ${WORKFLOWS_DIR}`,
      );
      continue;
    }
    const triggers = Object.keys(getOnMap(workflow));
    if (triggers.length !== 1 || triggers[0] !== "workflow_dispatch") {
      violations.push(
        `manualWorkflows: '${file}' must have workflow_dispatch as its ONLY trigger, found [${triggers.join(", ") || "none"}]`,
      );
    }
    if (
      !workflow.jobs ||
      typeof workflow.jobs !== "object" ||
      Object.keys(workflow.jobs).length === 0
    ) {
      violations.push(`manualWorkflows: '${file}' must declare at least one job`);
    }
  }

  // Check 4b: every automatedWorkflows file exists, declares a non-empty
  // trigger set drawn only from {workflow_dispatch, push}, restricts any
  // push trigger to branches: [main] only (no other branches, tags,
  // pull_request, workflow_run, or schedule riding along), and declares at
  // least one job. Unlike manualWorkflows this category may run
  // unattended after a main push, so its trigger surface is checked just as
  // strictly, not loosened.
  const AUTOMATED_WORKFLOW_ALLOWED_TRIGGERS = new Set(["workflow_dispatch", "push"]);
  for (const file of automatedWorkflows) {
    if (typeof file !== "string") {
      violations.push(`automatedWorkflows: entry ${JSON.stringify(file)} is not a filename string`);
      continue;
    }
    const workflow = workflows.get(file);
    if (!workflow) {
      violations.push(
        `automatedWorkflows: declared workflow '${file}' does not exist under ${WORKFLOWS_DIR}`,
      );
      continue;
    }
    const onMap = getOnMap(workflow);
    const triggers = Object.keys(onMap);
    const triggersValid =
      triggers.length > 0 &&
      triggers.every((trigger) => AUTOMATED_WORKFLOW_ALLOWED_TRIGGERS.has(trigger));
    if (!triggersValid) {
      violations.push(
        `automatedWorkflows: '${file}' triggers must be a non-empty subset of [workflow_dispatch, push], found [${triggers.join(", ") || "none"}]`,
      );
    }
    if (triggers.includes("push")) {
      const pushConfig = onMap.push && typeof onMap.push === "object" ? onMap.push : {};
      const pushKeys = Object.keys(pushConfig);
      const branches = Array.isArray(pushConfig.branches) ? pushConfig.branches : null;
      const isMainOnly =
        pushKeys.length === 1 &&
        pushKeys[0] === "branches" &&
        branches !== null &&
        branches.length === 1 &&
        branches[0] === "main";
      if (!isMainOnly) {
        violations.push(
          `automatedWorkflows: '${file}' push trigger must be restricted to branches: [main] only, found ${JSON.stringify(pushConfig)}`,
        );
      }
    }
    if (
      !workflow.jobs ||
      typeof workflow.jobs !== "object" ||
      Object.keys(workflow.jobs).length === 0
    ) {
      violations.push(`automatedWorkflows: '${file}' must declare at least one job`);
    }
  }

  // Check 5: scheduleTriggersForbidden — no workflow anywhere may declare a
  // schedule trigger. Enforced regardless of what the declaration claims, and
  // the declaration itself must assert the invariant is true.
  if (declaration?.invariants?.scheduleTriggersForbidden !== true) {
    violations.push(`${DECLARATION_PATH}: invariants.scheduleTriggersForbidden must be true`);
  }
  for (const [file, workflow] of workflows) {
    if (hasTrigger(workflow, "schedule")) {
      violations.push(
        `${path.join(WORKFLOWS_DIR, file)}: has a forbidden 'schedule' trigger (docs/ci-structure.md 2026-08-07 decision)`,
      );
    }
  }

  // Check 6a: every workflow file under .github/workflows/ is accounted for
  // by the declaration — either it is the quality workflow (whose jobs are
  // covered below) or it is listed in manualWorkflows or automatedWorkflows.
  // A brand-new workflow file that is none of those must be declared before
  // it can pass this guard, so it can't silently gain a pull_request/push
  // trigger and undeclared jobs.
  const manualWorkflowNames = new Set(manualWorkflows.filter((file) => typeof file === "string"));
  const automatedWorkflowNames = new Set(
    automatedWorkflows.filter((file) => typeof file === "string"),
  );
  for (const file of workflows.keys()) {
    if (
      file === QUALITY_WORKFLOW ||
      manualWorkflowNames.has(file) ||
      automatedWorkflowNames.has(file)
    )
      continue;
    violations.push(
      `${path.join(WORKFLOWS_DIR, file)}: not accounted for in ${DECLARATION_PATH} — declare it in requiredContexts/advisoryJobs/manualJobs (if it is the quality workflow) or in manualWorkflows/automatedWorkflows before merging`,
    );
  }

  // Check 6b: completeness — every job in quality.yml is accounted for as a
  // requiredContexts producer, an advisoryJobs entry, or a manualJobs entry.
  const qualityWorkflow = workflows.get(QUALITY_WORKFLOW);
  if (!qualityWorkflow) {
    violations.push(
      `manualWorkflows/requiredContexts: ${QUALITY_WORKFLOW} does not exist under ${WORKFLOWS_DIR}`,
    );
  } else {
    const jobs =
      qualityWorkflow.jobs && typeof qualityWorkflow.jobs === "object" ? qualityWorkflow.jobs : {};
    const jobNames = Object.keys(jobs);
    const requiredJobNames = new Set(
      requiredContexts
        .filter((entry) => entry?.workflow === QUALITY_WORKFLOW)
        .map((entry) => entry.job),
    );
    const advisoryJobNames = new Set(
      advisoryJobs
        .filter((entry) => entry?.workflow === QUALITY_WORKFLOW)
        .map((entry) => entry.job),
    );
    const manualJobNames = new Set(
      manualJobs.filter((entry) => entry?.workflow === QUALITY_WORKFLOW).map((entry) => entry.job),
    );

    for (const jobName of jobNames) {
      const accounted =
        requiredJobNames.has(jobName) ||
        advisoryJobNames.has(jobName) ||
        manualJobNames.has(jobName);
      if (!accounted) {
        violations.push(
          `${QUALITY_WORKFLOW}: job '${jobName}' is not declared as a requiredContexts producer, advisoryJobs entry, or manualJobs entry`,
        );
      }
    }

    // Reverse direction: declared advisory/manual quality.yml jobs must
    // actually exist, so the declaration cannot silently drift from the
    // workflow it describes.
    for (const entry of advisoryJobs) {
      if (entry?.workflow === QUALITY_WORKFLOW && !jobNames.includes(entry.job)) {
        violations.push(
          `advisoryJobs: declared job '${entry.job}' does not exist in ${QUALITY_WORKFLOW}`,
        );
      }
    }
    for (const entry of manualJobs) {
      if (entry?.workflow === QUALITY_WORKFLOW && !jobNames.includes(entry.job)) {
        violations.push(
          `manualJobs: declared job '${entry.job}' does not exist in ${QUALITY_WORKFLOW}`,
        );
      }
    }
  }

  const summary =
    `requiredContexts=${counts.requiredContexts} advisoryJobs=${counts.advisoryJobs} ` +
    `manualJobs=${counts.manualJobs} manualWorkflows=${counts.manualWorkflows} ` +
    `automatedWorkflows=${counts.automatedWorkflows} ` +
    `workflowFilesScanned=${counts.workflowFilesScanned}`;

  return { ok: violations.length === 0, violations, counts, summary };
}

async function readJson(root, relativePath, violations) {
  let raw;
  try {
    raw = await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    violations.push(`${relativePath}: missing (${errorMessage(error)})`);
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    violations.push(`${relativePath}: malformed JSON (${errorMessage(error)})`);
    return null;
  }
}

function resolveWorkflow(workflows, filename, label, violations) {
  if (typeof filename !== "string" || filename.length === 0) {
    violations.push(`${label}: has no 'workflow' filename declared`);
    return null;
  }
  const workflow = workflows.get(filename);
  if (!workflow) {
    violations.push(
      `${label}: declared workflow '${filename}' does not exist under ${WORKFLOWS_DIR}`,
    );
    return null;
  }
  return workflow;
}

function jobExists(workflow, jobName) {
  if (typeof jobName !== "string") return false;
  return Boolean(workflow?.jobs && typeof workflow.jobs === "object" && jobName in workflow.jobs);
}

function getOnMap(workflow) {
  const on = workflow?.on;
  if (on == null) return {};
  if (Array.isArray(on)) {
    return Object.fromEntries(
      on.filter((value) => typeof value === "string").map((key) => [key, {}]),
    );
  }
  if (typeof on === "object") return on;
  if (typeof on === "string") return { [on]: {} };
  return {};
}

function hasTrigger(workflow, triggerName) {
  return Object.prototype.hasOwnProperty.call(getOnMap(workflow), triggerName);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const result = await runGateParityCheck();
  if (!result.ok) {
    console.error("[guard:gate-parity] gate enforcement-status parity drift:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[guard:gate-parity] OK (${result.summary}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
