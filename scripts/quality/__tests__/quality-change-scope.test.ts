import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

type Verdict = { docsOnly: boolean; reason: string };
type Change = {
  status: string;
  path: string;
  oldPath?: string;
  mode?: string;
};
type ScopeModule = {
  classifyChanges: (records: Change[]) => Verdict;
  classifyCi: (options: {
    cwd: string;
    eventName: string;
    event: unknown;
  }) => Verdict | Promise<Verdict>;
  classifyGitRange: (options: {
    cwd: string;
    base: string;
    head?: string;
  }) => Verdict | Promise<Verdict>;
  classifyPush: (options: {
    cwd: string;
    input: string;
    defaultBase?: string;
  }) => Verdict | Promise<Verdict>;
};

async function loadScope(): Promise<ScopeModule> {
  return (await import(
    pathToFileURL(path.resolve(__dirname, "../quality-change-scope.mjs")).href
  )) as ScopeModule;
}

const roots: string[] = [];
const zero = "0".repeat(40);
function git(root: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
}
function write(root: string, name: string, value = "# Example\n"): void {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  writeFileSync(path.join(root, name), value);
}
function commit(root: string, name: string, value = "# Example\n"): string {
  write(root, name, value);
  git(root, "add", "--", name);
  git(root, "commit", "-qm", "fixture change");
  return git(root, "rev-parse", "HEAD");
}
function fixture(): { root: string; base: string } {
  const root = mkdtempSync(path.join(os.tmpdir(), "quality-scope-"));
  roots.push(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Scope fixture");
  git(root, "config", "user.email", "scope@example.invalid");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "config", "core.hooksPath", "/dev/null");
  const base = commit(root, "README.md");
  git(root, "update-ref", "refs/remotes/origin/main", base);
  git(root, "checkout", "-qb", "topic");
  return { root, base };
}
function pushLine(head: string, remote = zero, localRef = "refs/heads/topic"): string {
  return `${localRef} ${head} refs/heads/topic ${remote}\n`;
}
function assertVerdict(result: Verdict, docsOnly: boolean): void {
  expect(result.docsOnly).toBe(docsOnly);
  expect(result.reason.trim().length).toBeGreaterThan(0);
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("documentation-only quality classification", () => {
  it.each([
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "docs/new-guide.md",
    "docs/archive/history.md",
    "docs/project-knowledge/README.md",
    "docs/contract-maps/quality-gates.md",
    "shared-skills/korean-prose/SKILL.md",
    "shared-skills/korean-prose/references/book.md",
  ])("accepts regular added or modified prose: %s", async (file) => {
    const { classifyChanges } = await loadScope();
    for (const status of ["A", "M"]) {
      assertVerdict(classifyChanges([{ status, path: file, mode: "100644" }]), true);
    }
  });

  it.each([
    "docs/contracts/story-chain/promises/example.md",
    "docs/contracts/README.md",
    "docs/architecture-fitness/README.md",
    "docs/analytics/events.md",
    "docs/glossary/README.md",
    "docs/runtime-flows/search.md",
    "docs/mission-control.md",
    "docs/operational-readiness.md",
    "app/example.md",
    "scripts/example.md",
    "unknown.md",
    "shared-skills/structural-audit/references/check-topology.mjs",
    "shared-skills/skill-governance-steward/references/skill-routing-corpus.json",
    "docs/example.yaml",
    "docs/example.mdx",
    ".github/workflows/quality.yml",
    "package.json",
  ])("requires full validation for protected or unknown input: %s", async (file) => {
    const { classifyChanges } = await loadScope();
    assertVerdict(classifyChanges([{ status: "M", path: file, mode: "100644" }]), false);
  });

  it("fails closed for empty, deleted, renamed, type-changed, or nonregular inputs", async () => {
    const { classifyChanges } = await loadScope();
    for (const changes of [
      [],
      [{ status: "D", path: "README.md", mode: "100644" }],
      [{ status: "T", path: "README.md", mode: "100644" }],
      [{ status: "R100", oldPath: "app/prompt.md", path: "docs/prompt.md", mode: "100644" }],
      [{ status: "M", path: "README.md", mode: "100755" }],
      [{ status: "A", path: "docs/link.md", mode: "120000" }],
      [{ status: "A", path: "docs/link.md", mode: "160000" }],
    ])
      assertVerdict(classifyChanges(changes), false);
  });

  it("requires full validation for a mixed path set", async () => {
    const { classifyChanges } = await loadScope();
    assertVerdict(
      classifyChanges([
        { status: "M", path: "README.md", mode: "100644" },
        { status: "A", path: "app/runtime.ts", mode: "100644" },
      ]),
      false,
    );
  });
});

describe("Git-backed quality scope", () => {
  it("examines the complete range rather than only the last commit", async () => {
    const { classifyGitRange } = await loadScope();
    const { root, base } = fixture();
    commit(root, "app/runtime.ts", "export const enabled = true;\n");
    commit(root, "docs/guide.md");
    assertVerdict(await classifyGitRange({ cwd: root, base }), false);
  });

  it("accepts a regular prose-only range and fails closed for missing or empty bases", async () => {
    const { classifyGitRange } = await loadScope();
    const { root, base } = fixture();
    const head = commit(root, "docs/guide.md");
    assertVerdict(await classifyGitRange({ cwd: root, base }), true);
    assertVerdict(await classifyGitRange({ cwd: root, base: "missing-ref" }), false);
    assertVerdict(await classifyGitRange({ cwd: root, base: head }), false);
  });

  it("does not lose the original side of a runtime-to-docs rename", async () => {
    const { classifyGitRange } = await loadScope();
    const { root } = fixture();
    const base = commit(root, "app/prompt.md");
    mkdirSync(path.join(root, "docs"));
    git(root, "mv", "app/prompt.md", "docs/prompt.md");
    git(root, "commit", "-qm", "move prompt");
    assertVerdict(await classifyGitRange({ cwd: root, base }), false);
  });

  it("rejects a Markdown symlink and an executable Markdown file", async () => {
    const { classifyGitRange } = await loadScope();
    const { root, base } = fixture();
    mkdirSync(path.join(root, "docs"));
    symlinkSync("../README.md", path.join(root, "docs/link.md"));
    git(root, "add", "docs/link.md");
    git(root, "commit", "-qm", "symlink markdown");
    assertVerdict(await classifyGitRange({ cwd: root, base }), false);
    git(root, "reset", "--hard", base);
    write(root, "docs/executable.md");
    git(root, "add", "docs/executable.md");
    git(root, "update-index", "--chmod=+x", "docs/executable.md");
    git(root, "commit", "-qm", "executable markdown");
    assertVerdict(await classifyGitRange({ cwd: root, base }), false);
  });
});

describe("outgoing push scope", () => {
  it("uses the origin/main merge base for a new branch", async () => {
    const { classifyPush } = await loadScope();
    const { root } = fixture();
    const head = commit(root, "docs/guide.md");
    assertVerdict(await classifyPush({ cwd: root, input: pushLine(head) }), true);
    git(root, "update-ref", "-d", "refs/remotes/origin/main");
    assertVerdict(await classifyPush({ cwd: root, input: pushLine(head) }), false);
  });

  it("compares new branches from the merge base when origin/main has advanced", async () => {
    const { classifyPush } = await loadScope();
    const { root } = fixture();
    const head = commit(root, "docs/guide.md");
    git(root, "checkout", "-q", "main");
    const upstream = commit(root, "app/upstream.ts", "export const upstream = true;\n");
    git(root, "update-ref", "refs/remotes/origin/main", upstream);
    git(root, "checkout", "-q", "topic");
    assertVerdict(await classifyPush({ cwd: root, input: pushLine(head) }), true);
  });

  it("uses the entire update range for an existing remote branch", async () => {
    const { classifyPush } = await loadScope();
    const { root, base } = fixture();
    commit(root, "app/runtime.ts", "export const changed = true;\n");
    const head = commit(root, "docs/guide.md");
    assertVerdict(await classifyPush({ cwd: root, input: pushLine(head, base) }), false);
  });

  it("aggregates multiple refs and fails closed for a nonchecked-out ref", async () => {
    const { classifyPush } = await loadScope();
    const { root, base } = fixture();
    const head = commit(root, "docs/guide.md");
    git(root, "branch", "other", base);
    const other = `refs/heads/other ${base} refs/heads/other ${zero}\n`;
    assertVerdict(await classifyPush({ cwd: root, input: pushLine(head) + other }), false);
    assertVerdict(await classifyPush({ cwd: root, input: other }), false);
  });

  it("fails closed for empty, malformed, unresolved, or deletion push input", async () => {
    const { classifyPush } = await loadScope();
    const { root, base } = fixture();
    for (const input of [
      "",
      "invalid\n",
      pushLine("f".repeat(40)),
      `(delete) ${zero} refs/heads/topic ${base}\n`,
    ]) {
      assertVerdict(await classifyPush({ cwd: root, input }), false);
    }
  });
});

describe("CI event scope", () => {
  it("compares the PR base SHA with checkout HEAD, including merge checkout changes", async () => {
    const { classifyCi } = await loadScope();
    const { root, base } = fixture();
    const proseHead = commit(root, "docs/guide.md");
    const event = { pull_request: { base: { sha: base }, head: { sha: proseHead } } };
    assertVerdict(await classifyCi({ cwd: root, eventName: "pull_request", event }), true);
    commit(root, "app/merged-runtime.ts", "export const changed = true;\n");
    assertVerdict(await classifyCi({ cwd: root, eventName: "pull_request", event }), false);
  });

  it("compares the complete push before range", async () => {
    const { classifyCi } = await loadScope();
    const { root, base } = fixture();
    commit(root, "app/runtime.ts", "export const changed = true;\n");
    commit(root, "docs/guide.md");
    assertVerdict(
      await classifyCi({ cwd: root, eventName: "push", event: { before: base } }),
      false,
    );
  });

  it("fails closed for absent or zero refs and manual events", async () => {
    const { classifyCi } = await loadScope();
    const { root, base } = fixture();
    commit(root, "docs/guide.md");
    for (const [eventName, event] of [
      ["pull_request", {}],
      ["pull_request", { pull_request: { base: { sha: zero } } }],
      ["push", {}],
      ["push", { before: zero }],
      ["push", { before: "missing-ref" }],
      ["workflow_dispatch", { before: base }],
      ["unknown", { before: base }],
    ] as const)
      assertVerdict(await classifyCi({ cwd: root, eventName, event }), false);
  });

  it("does not treat removal of executable mode as a prose-only edit", async () => {
    const { classifyGitRange } = await loadScope();
    const { root } = fixture();
    write(root, "docs/executable.md");
    git(root, "add", "docs/executable.md");
    git(root, "update-index", "--chmod=+x", "docs/executable.md");
    git(root, "commit", "-qm", "executable markdown");
    const base = git(root, "rev-parse", "HEAD");
    git(root, "update-index", "--chmod=-x", "docs/executable.md");
    git(root, "commit", "-qm", "regular markdown");
    assertVerdict(await classifyGitRange({ cwd: root, base }), false);
  });
});

function runHook(root: string, kind: "commit" | "push", input = "", fail = false) {
  const bin = mkdtempSync(path.join(os.tmpdir(), "scope-npm-"));
  roots.push(bin);
  const log = path.join(bin, "calls.jsonl");
  const npm = path.join(bin, "npm");
  writeFileSync(
    npm,
    `#!/usr/bin/env node
const fs = require("node:fs");
fs.appendFileSync(process.env.SCOPE_TEST_LOG, JSON.stringify(process.argv.slice(2)) + "\\n");
if (process.env.SCOPE_TEST_FAIL === "1") process.exit(23);
`,
  );
  chmodSync(npm, 0o755);
  const result = spawnSync(
    process.execPath,
    [path.resolve(__dirname, "../quality-change-scope.mjs"), "--hook", kind],
    {
      cwd: root,
      input,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
        SCOPE_TEST_LOG: log,
        SCOPE_TEST_FAIL: fail ? "1" : "0",
      },
    },
  );
  const calls = existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as string[])
    : [];
  return { ...result, calls };
}

describe("actual hook CLI dispatch", () => {
  it("preserves the push validation command's nonzero exit", () => {
    const { root, base } = fixture();
    const head = commit(root, "docs/guide.md");
    const result = runHook(root, "push", pushLine(head, base), true);
    expect(result.status).toBe(23);
    expect(result.calls).toEqual([["run", "quality:docs"]]);
  });

  it("rejects commit dispatch without invoking npm", () => {
    const { root } = fixture();
    const result = runHook(root, "commit");
    expect(result.status).not.toBe(0);
    expect(result.calls).toEqual([]);
  });

  it("preserves pre-commit staged CAIR checks and final lint-staged ordering", () => {
    const repoRoot = path.resolve(__dirname, "../../..");
    const hook = readFileSync(path.join(repoRoot, ".husky/pre-commit"), "utf8");
    expect(hook).toContain("npm run quality:commit");
    expect(hook).not.toContain("quality-change-scope");
    const manifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const commands = manifest.scripts["quality:commit"].split(" && ");
    expect(commands).toContain("npm run mc:validate-cair -- --staged");
    expect(commands.at(-1)).toBe("lint-staged");
    expect(commands).not.toContain("npm run quality:docs");
  });

  it("reads actual stdin ref inventory to choose docs or full push validation", () => {
    const { root, base } = fixture();
    const head = commit(root, "docs/guide.md");
    const docs = runHook(root, "push", pushLine(head, base));
    expect(docs.status, docs.stderr).toBe(0);
    expect(docs.calls).toEqual([["run", "quality:docs"]]);
    const unknown = runHook(root, "push", "");
    expect(unknown.status, unknown.stderr).toBe(0);
    expect(unknown.calls).toEqual([["run", "quality:fast"]]);
    const otherRef = `refs/heads/other ${base} refs/heads/other ${zero}\n`;
    const mixed = runHook(root, "push", pushLine(head, base) + otherRef);
    expect(mixed.calls).toEqual([["run", "quality:fast"]]);
  });
});

type WorkflowStep = {
  id?: string;
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
};
type WorkflowJob = { if?: string; steps: WorkflowStep[] };
function qualityWorkflow(): { jobs: Record<string, WorkflowJob> } {
  return parseYaml(
    readFileSync(path.resolve(__dirname, "../../../.github/workflows/quality.yml"), "utf8"),
  ) as { jobs: Record<string, WorkflowJob> };
}

describe("required CI responsibility wiring", () => {
  it.each(["static", "test", "build", "db-integration", "audit"])(
    "classifies %s from full checkout history with the shared CI entrypoint",
    (name) => {
      const job = qualityWorkflow().jobs[name];
      expect(job.if ?? "").not.toContain("docs_only");
      const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"));
      expect(checkout?.with?.["fetch-depth"]).toBe(0);
      const classifier = job.steps.find((step) => step.id === "scope");
      expect(classifier?.run).toBe("node scripts/quality/quality-change-scope.mjs --ci");
      expect(classifier?.if).toBeUndefined();
    },
  );

  it("keeps docs validation in static and heavy execution conditional on full scope", () => {
    const { jobs } = qualityWorkflow();
    const docs = jobs.static.steps.find((step) => step.run === "npm run quality:docs");
    expect(docs?.if).toBe("steps.scope.outputs.docs_only == 'true'");
    const expected: Record<string, string[]> = {
      static: ["npm run quality:static"],
      test: ["npm ci", "npm run test:unit -- --shard=${{ matrix.shard }}/2"],
      build: ["npm ci", "npm run build"],
      "db-integration": [
        "npm ci",
        "npm run db:start:ci",
        "npm run db:reset:local",
        "npm run test:db:gap-report-concurrency",
        "npm run db:stop:ci",
      ],
      audit: ["npm ci", "npm run quality:audit"],
    };
    for (const [name, commands] of Object.entries(expected)) {
      for (const command of commands) {
        const step = jobs[name].steps.find((candidate) => candidate.run === command);
        expect(step, `${name}: ${command}`).toBeDefined();
        expect(step?.if).toContain("steps.scope.outputs.docs_only != 'true'");
      }
    }
    const closeout = jobs["review-closeout"];
    expect(closeout.if).toBe("github.event_name == 'pull_request'");
    expect(closeout.steps.some((step) => step.id === "scope")).toBe(false);
    const check = closeout.steps.find((step) => step.run?.includes("check-review-closeout.mjs"));
    expect(check).toBeDefined();
    expect(check?.if).toBeUndefined();
  });
});
