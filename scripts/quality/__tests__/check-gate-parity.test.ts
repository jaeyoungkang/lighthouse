import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

type GateParityResult = {
  ok: boolean;
  violations: string[];
  counts: {
    requiredContexts: number;
    advisoryJobs: number;
    manualJobs: number;
    manualWorkflows: number;
    automatedWorkflows: number;
    workflowFilesScanned: number;
  };
  summary?: string;
};

async function loadGuard(): Promise<{
  runGateParityCheck: (options?: { root?: string }) => Promise<GateParityResult>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-gate-parity.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

const QUALITY_WORKFLOW = `name: Quality

on:
  pull_request: {}
  push:
    branches:
      - main
  workflow_dispatch:
    inputs:
      full:
        required: false
        type: boolean
        default: false

jobs:
  static:
    runs-on: ubuntu-latest

  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2]

  build:
    runs-on: ubuntu-latest

  db-integration:
    runs-on: ubuntu-latest

  review-closeout:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest

  full:
    if: github.event_name == 'workflow_dispatch' && inputs.full
    runs-on: ubuntu-latest

  audit:
    runs-on: ubuntu-latest
`;

const QUALITY_WORKFLOW_MISSING_JOB_DECLARATION = QUALITY_WORKFLOW.replace(
  "  audit:\n    runs-on: ubuntu-latest\n",
  "  audit:\n    runs-on: ubuntu-latest\n\n  extra-undeclared-job:\n    runs-on: ubuntu-latest\n",
);

const MUTATION_WORKFLOW = `name: Mutation

on:
  workflow_dispatch:

jobs:
  mutation:
    runs-on: ubuntu-latest
`;

const ARCHITECTURE_FITNESS_ATTESTATION_WORKFLOW = `name: Architecture Fitness Attestation

on:
  workflow_dispatch: {}

jobs:
  resolve:
    runs-on: ubuntu-latest
`;

const ARCHITECTURE_FITNESS_REBIND_WORKFLOW = `name: Architecture Fitness Rebind Window

on:
  workflow_dispatch:

jobs:
  report:
    runs-on: ubuntu-latest
`;

const PROJECT_STATUS_CHECKPOINT_WORKFLOW = `name: Project Status Checkpoint

on:
  workflow_dispatch:
    inputs:
      lane:
        required: true
        default: all
        type: choice
        options:
          - all
          - process
          - search
  push:
    branches: [main]

jobs:
  sync:
    runs-on: ubuntu-latest
`;

function validDeclaration(): Record<string, unknown> {
  return {
    $comment: "fixture — mirrors scripts/quality/gate-status.json",
    requiredContexts: [
      { context: "static", workflow: "quality.yml", job: "static" },
      { context: "test (1)", workflow: "quality.yml", job: "test", matrix: { shard: 1 } },
      { context: "test (2)", workflow: "quality.yml", job: "test", matrix: { shard: 2 } },
      { context: "build", workflow: "quality.yml", job: "build" },
      { context: "audit", workflow: "quality.yml", job: "audit" },
      { context: "review-closeout", workflow: "quality.yml", job: "review-closeout" },
    ],
    advisoryJobs: [
      {
        workflow: "quality.yml",
        job: "db-integration",
        note: "Promotion to required is a pending Human decision tracked in issue #652.",
      },
    ],
    manualJobs: [
      {
        workflow: "quality.yml",
        job: "full",
        note: "Dispatch-gated; not a pull_request/push required-status-check producer.",
      },
    ],
    manualWorkflows: [
      "mutation.yml",
      "architecture-fitness-attestation.yml",
      "architecture-fitness-rebind-window.yml",
    ],
    automatedWorkflows: ["project-status-checkpoint.yml"],
    invariants: {
      scheduleTriggersForbidden: true,
    },
  };
}

function validSnapshot(): Record<string, unknown> {
  return {
    fetchedAt: "2026-08-14T12:29:48Z",
    source: "gh api repos/jaeyoungkang/lighthouse/branches/main/protection",
    requiredStatusChecks: {
      strict: false,
      contexts: ["static", "test (1)", "test (2)", "build", "audit", "review-closeout"],
    },
    enforceAdmins: true,
    allowForcePushes: false,
    allowDeletions: false,
    requiredApprovingReviewCount: 0,
  };
}

type FixtureFiles = Record<string, string>;

function validFixtureFiles(): FixtureFiles {
  return {
    "scripts/quality/gate-status.json": JSON.stringify(validDeclaration(), null, 2),
    "scripts/quality/branch-protection.snapshot.json": JSON.stringify(validSnapshot(), null, 2),
    ".github/workflows/quality.yml": QUALITY_WORKFLOW,
    ".github/workflows/mutation.yml": MUTATION_WORKFLOW,
    ".github/workflows/architecture-fitness-attestation.yml":
      ARCHITECTURE_FITNESS_ATTESTATION_WORKFLOW,
    ".github/workflows/architecture-fitness-rebind-window.yml":
      ARCHITECTURE_FITNESS_REBIND_WORKFLOW,
    ".github/workflows/project-status-checkpoint.yml": PROJECT_STATUS_CHECKPOINT_WORKFLOW,
  };
}

let tempRoots: string[] = [];

async function writeFixture(files: FixtureFiles): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-gate-parity-"));
  tempRoots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf8");
  }
  return root;
}

afterEach(async () => {
  await Promise.all(tempRoots.map((root) => rm(root, { force: true, recursive: true })));
  tempRoots = [];
});

describe("gate enforcement-status parity guard", () => {
  it("passes for the green case mirroring the real repo shape", async () => {
    const { runGateParityCheck } = await loadGuard();
    const root = await writeFixture(validFixtureFiles());

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.counts).toEqual({
      requiredContexts: 6,
      advisoryJobs: 1,
      manualJobs: 1,
      manualWorkflows: 3,
      automatedWorkflows: 1,
      workflowFilesScanned: 5,
    });
  });

  it("fails when quality.yml gains a job not declared as required, advisory, or manual", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/quality.yml"] = QUALITY_WORKFLOW_MISSING_JOB_DECLARATION;
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "quality.yml: job 'extra-undeclared-job' is not declared as a requiredContexts producer, advisoryJobs entry, or manualJobs entry",
    );
  });

  it("fails when a brand-new workflow file is added but not declared anywhere", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/sneaky.yml"] = `name: Sneaky

on:
  pull_request: {}

jobs:
  sneaky-job:
    runs-on: ubuntu-latest
`;
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      ".github/workflows/sneaky.yml: not accounted for in scripts/quality/gate-status.json — declare it in requiredContexts/advisoryJobs/manualJobs (if it is the quality workflow) or in manualWorkflows/automatedWorkflows before merging",
    );
  });

  it("accounts for a workflow file listed in manualWorkflows without requiring job-level declarations", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    const declaration = validDeclaration();
    (declaration.manualWorkflows as string[]).push("extra-manual.yml");
    files["scripts/quality/gate-status.json"] = JSON.stringify(declaration, null, 2);
    files[".github/workflows/extra-manual.yml"] = `name: Extra Manual

on:
  workflow_dispatch:

jobs:
  some-undeclared-job:
    runs-on: ubuntu-latest
  another-undeclared-job:
    runs-on: ubuntu-latest
`;
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("fails when the snapshot is missing a declared required context", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    const snapshot = validSnapshot();
    (snapshot.requiredStatusChecks as { contexts: string[] }).contexts = [
      "static",
      "test (1)",
      "test (2)",
      "build",
      "audit",
    ];
    files["scripts/quality/branch-protection.snapshot.json"] = JSON.stringify(snapshot, null, 2);
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "scripts/quality/branch-protection.snapshot.json: declared required context 'review-closeout' is missing from the live branch protection snapshot",
    );
  });

  it("fails when the snapshot has an extra context beyond the declaration", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    const snapshot = validSnapshot();
    (snapshot.requiredStatusChecks as { contexts: string[] }).contexts = [
      "static",
      "test (1)",
      "test (2)",
      "build",
      "audit",
      "review-closeout",
      "db-integration",
    ];
    files["scripts/quality/branch-protection.snapshot.json"] = JSON.stringify(snapshot, null, 2);
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "scripts/quality/gate-status.json: live branch protection requires context 'db-integration' that is not declared in requiredContexts",
    );
  });

  it("fails when a workflow has a schedule trigger", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/mutation.yml"] = MUTATION_WORKFLOW.replace(
      "on:\n  workflow_dispatch:\n",
      'on:\n  workflow_dispatch:\n  schedule:\n    - cron: "0 3 * * *"\n',
    );
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      ".github/workflows/mutation.yml: has a forbidden 'schedule' trigger (docs/ci-structure.md 2026-08-07 decision)",
    );
  });

  it("fails when a manual workflow gains a pull_request trigger", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/mutation.yml"] = MUTATION_WORKFLOW.replace(
      "on:\n  workflow_dispatch:\n",
      "on:\n  workflow_dispatch:\n  pull_request: {}\n",
    );
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "manualWorkflows: 'mutation.yml' must have workflow_dispatch as its ONLY trigger, found [workflow_dispatch, pull_request]",
    );
  });

  it("fails when a declared manual workflow has no jobs", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/mutation.yml"] = MUTATION_WORKFLOW.replace(
      "jobs:\n  mutation:\n    runs-on: ubuntu-latest\n",
      "jobs: {}\n",
    );
    const result = await runGateParityCheck({ root: await writeFixture(files) });
    expect(result.violations).toContain(
      "manualWorkflows: 'mutation.yml' must declare at least one job",
    );
  });

  it("passes for an automatedWorkflows entry with workflow_dispatch and push restricted to main", async () => {
    const { runGateParityCheck } = await loadGuard();
    const root = await writeFixture(validFixtureFiles());

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("fails when an automatedWorkflows entry gains a pull_request trigger", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/project-status-checkpoint.yml"] =
      PROJECT_STATUS_CHECKPOINT_WORKFLOW.replace(
        "  push:\n    branches: [main]\n",
        "  push:\n    branches: [main]\n  pull_request: {}\n",
      );
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "automatedWorkflows: 'project-status-checkpoint.yml' triggers must be a non-empty subset of [workflow_dispatch, push], found [workflow_dispatch, push, pull_request]",
    );
  });

  it("fails when an automatedWorkflows entry gains a schedule trigger", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/project-status-checkpoint.yml"] =
      PROJECT_STATUS_CHECKPOINT_WORKFLOW.replace(
        "  push:\n    branches: [main]\n",
        '  push:\n    branches: [main]\n  schedule:\n    - cron: "0 3 * * *"\n',
      );
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      ".github/workflows/project-status-checkpoint.yml: has a forbidden 'schedule' trigger (docs/ci-structure.md 2026-08-07 decision)",
    );
    expect(result.violations).toContain(
      "automatedWorkflows: 'project-status-checkpoint.yml' triggers must be a non-empty subset of [workflow_dispatch, push], found [workflow_dispatch, push, schedule]",
    );
  });

  it("fails when an automatedWorkflows entry's push trigger targets a branch other than main", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files[".github/workflows/project-status-checkpoint.yml"] =
      PROJECT_STATUS_CHECKPOINT_WORKFLOW.replace(
        "  push:\n    branches: [main]\n",
        "  push:\n    branches: [main, develop]\n",
      );
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      'automatedWorkflows: \'project-status-checkpoint.yml\' push trigger must be restricted to branches: [main] only, found {"branches":["main","develop"]}',
    );
  });

  it("fails when a push-and-dispatch workflow is listed in neither manualWorkflows nor automatedWorkflows", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    delete files[".github/workflows/project-status-checkpoint.yml"];
    const declaration = validDeclaration();
    delete declaration.automatedWorkflows;
    files["scripts/quality/gate-status.json"] = JSON.stringify(declaration, null, 2);
    files[".github/workflows/undeclared-automated.yml"] = PROJECT_STATUS_CHECKPOINT_WORKFLOW;
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      ".github/workflows/undeclared-automated.yml: not accounted for in scripts/quality/gate-status.json — declare it in requiredContexts/advisoryJobs/manualJobs (if it is the quality workflow) or in manualWorkflows/automatedWorkflows before merging",
    );
  });

  it("fails when enforceAdmins is false in the snapshot", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    const snapshot = validSnapshot();
    snapshot.enforceAdmins = false;
    files["scripts/quality/branch-protection.snapshot.json"] = JSON.stringify(snapshot, null, 2);
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "scripts/quality/branch-protection.snapshot.json: enforceAdmins must be true (branch protection must apply to admins too), found false",
    );
  });

  it("hard-fails when the declaration file is malformed JSON", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files["scripts/quality/gate-status.json"] = "{ this is not valid json";
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.some((violation) =>
        violation.startsWith("scripts/quality/gate-status.json: malformed JSON"),
      ),
    ).toBe(true);
  });

  it("hard-fails when the declaration file is missing", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    delete files["scripts/quality/gate-status.json"];
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.some((violation) =>
        violation.startsWith("scripts/quality/gate-status.json: missing"),
      ),
    ).toBe(true);
  });

  it("hard-fails when the snapshot file is malformed JSON", async () => {
    const { runGateParityCheck } = await loadGuard();
    const files = validFixtureFiles();
    files["scripts/quality/branch-protection.snapshot.json"] = "not json at all";
    const root = await writeFixture(files);

    const result = await runGateParityCheck({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.some((violation) =>
        violation.startsWith("scripts/quality/branch-protection.snapshot.json: malformed JSON"),
      ),
    ).toBe(true);
  });
});
