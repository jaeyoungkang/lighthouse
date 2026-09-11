import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

type LaneInput = Record<string, unknown>;

interface LaneFacts {
  isShallow: boolean;
  commitExists: boolean;
  integrated: boolean;
  staleness: number | null;
}

interface LaneEvaluation {
  laneId: string;
  outcome: "shallow-skip" | "integrity-fail" | "within-budget" | "warn" | "block";
  exitCode: 0 | 1;
  lines: string[];
  errorLines: string[];
  annotation: string | null;
}

interface LaneFreshnessModule {
  LaneFreshnessDeclarationError: new (message?: string) => Error;
  validateDeclaration: (raw: unknown) => LaneInput[];
  loadDeclaration: (declarationPath: string) => LaneInput[];
  evaluateLane: (lane: LaneInput, facts: LaneFacts) => LaneEvaluation;
  collectLaneGitFacts: (lane: LaneInput, root: string, head?: string) => LaneFacts;
}

async function loadGuard(): Promise<LaneFreshnessModule> {
  const guardPath = path.resolve(__dirname, "..", "check-lane-freshness.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

const SCRIPT = path.join(process.cwd(), "scripts/quality/check-lane-freshness.mjs");
const temporaryRoots: string[] = [];
let guard: LaneFreshnessModule;

beforeAll(async () => {
  guard = await loadGuard();
});

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const root = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function baseLane(overrides: LaneInput = {}): LaneInput {
  return {
    id: "test-lane",
    lastTargetSha: "a".repeat(40),
    budgetCommits: 10,
    enforcement: "warn",
    owner: "test owner",
    onExceeded: "run the lane manually and update lastTargetSha",
    ...overrides,
  };
}

// --- evaluateLane: pure decision table, no git process involved -----------

describe("evaluateLane", () => {
  it("passes silently within budget", () => {
    const lane = baseLane({ budgetCommits: 200 });
    const result = guard.evaluateLane(lane, {
      isShallow: false,
      commitExists: true,
      integrated: true,
      staleness: 5,
    });

    expect(result.outcome).toBe("within-budget");
    expect(result.exitCode).toBe(0);
    expect(result.annotation).toBeNull();
    expect(result.errorLines).toEqual([]);
    expect(result.lines).toEqual([
      expect.stringContaining("staleness=5 commits, budget=200, enforcement=warn"),
    ]);
  });

  it("warns and exits 0 when staleness exceeds budget with warn enforcement", () => {
    const lane = baseLane({ enforcement: "warn", budgetCommits: 10 });
    const result = guard.evaluateLane(lane, {
      isShallow: false,
      commitExists: true,
      integrated: true,
      staleness: 25,
    });

    expect(result.outcome).toBe("warn");
    expect(result.exitCode).toBe(0);
    expect(result.annotation).toMatch(/^::warning title=lane-freshness::/);
    expect(result.annotation).toContain("staleness 25 commits exceeds budget 10");
    expect(result.annotation).toContain(String(lane.onExceeded));
    // Status line is still printed even though the lane is over budget — no silent state.
    expect(result.lines).toEqual([
      expect.stringContaining("staleness=25 commits, budget=10, enforcement=warn"),
    ]);
  });

  it("blocks and exits 1 when staleness exceeds budget with block enforcement", () => {
    const lane = baseLane({ enforcement: "block", budgetCommits: 10 });
    const result = guard.evaluateLane(lane, {
      isShallow: false,
      commitExists: true,
      integrated: true,
      staleness: 25,
    });

    expect(result.outcome).toBe("block");
    expect(result.exitCode).toBe(1);
    expect(result.annotation).toMatch(/^::error title=lane-freshness::/);
    expect(result.annotation).toContain("staleness 25 commits exceeds budget 10");
  });

  it("hard-fails when lastTargetSha does not exist in a non-shallow repo", () => {
    const lane = baseLane();
    const result = guard.evaluateLane(lane, {
      isShallow: false,
      commitExists: false,
      integrated: false,
      staleness: null,
    });

    expect(result.outcome).toBe("integrity-fail");
    expect(result.exitCode).toBe(1);
    expect(result.errorLines.join("\n")).toContain("존재하지 않습니다");
  });

  it("hard-fails when lastTargetSha exists but is not integrated into HEAD", () => {
    const lane = baseLane();
    const result = guard.evaluateLane(lane, {
      isShallow: false,
      commitExists: true,
      integrated: false,
      staleness: null,
    });

    expect(result.outcome).toBe("integrity-fail");
    expect(result.exitCode).toBe(1);
    expect(result.errorLines.join("\n")).toContain("통합된 것으로 확인되지 않습니다");
  });

  it("skips with exit 0 when a shallow clone is missing the declared sha", () => {
    const lane = baseLane();
    const result = guard.evaluateLane(lane, {
      isShallow: true,
      commitExists: false,
      integrated: false,
      staleness: null,
    });

    expect(result.outcome).toBe("shallow-skip");
    expect(result.exitCode).toBe(0);
    expect(result.lines.join("\n")).toContain("shallow clone");
  });
});

// --- validateDeclaration: strict schema validation -------------------------

describe("validateDeclaration", () => {
  it("accepts a well-formed declaration, tolerating $comment", () => {
    const lanes = guard.validateDeclaration({
      $comment: "doc",
      lanes: [{ ...baseLane(), $comment: "lane doc", description: "d", refs: ["docs/x.md"] }],
    });

    expect(lanes).toHaveLength(1);
    expect(lanes[0].id).toBe("test-lane");
  });

  it("rejects a non-object declaration", () => {
    expect(() => guard.validateDeclaration(null)).toThrow(guard.LaneFreshnessDeclarationError);
    expect(() => guard.validateDeclaration([])).toThrow(guard.LaneFreshnessDeclarationError);
  });

  it("rejects an unknown top-level field", () => {
    expect(() => guard.validateDeclaration({ lanes: [baseLane()], extra: true })).toThrow(
      /알 수 없는 최상위 필드/,
    );
  });

  it("rejects a missing lanes array", () => {
    expect(() => guard.validateDeclaration({})).toThrow(/lanes/);
  });

  it("rejects an empty lanes array instead of silently checking nothing", () => {
    expect(() => guard.validateDeclaration({ lanes: [] })).toThrow(
      guard.LaneFreshnessDeclarationError,
    );
    expect(() => guard.validateDeclaration({ lanes: [] })).toThrow(/비어 있습니다/);
  });

  it("rejects a lane missing a required field", () => {
    expect(() => guard.validateDeclaration({ lanes: [{}] })).toThrow(/필수 필드/);
  });

  it("rejects an unknown lane field", () => {
    expect(() => guard.validateDeclaration({ lanes: [{ ...baseLane(), extraField: 1 }] })).toThrow(
      /알 수 없는 필드/,
    );
  });

  it("rejects a malformed lastTargetSha", () => {
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), lastTargetSha: "not-a-sha" }] }),
    ).toThrow(/lastTargetSha/);
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), lastTargetSha: "a".repeat(39) }] }),
    ).toThrow(/lastTargetSha/);
  });

  it("rejects a non-positive or non-integer budgetCommits", () => {
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), budgetCommits: 0 }] }),
    ).toThrow(/budgetCommits/);
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), budgetCommits: -5 }] }),
    ).toThrow(/budgetCommits/);
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), budgetCommits: 1.5 }] }),
    ).toThrow(/budgetCommits/);
  });

  it("rejects a bad enforcement value", () => {
    expect(() =>
      guard.validateDeclaration({ lanes: [{ ...baseLane(), enforcement: "notify" }] }),
    ).toThrow(/enforcement/);
  });

  it("rejects duplicate lane ids", () => {
    expect(() => guard.validateDeclaration({ lanes: [baseLane(), baseLane()] })).toThrow(/중복/);
  });
});

describe("loadDeclaration", () => {
  it("throws on invalid JSON", () => {
    const root = makeTempDir("lane-freshness-json-");
    const file = path.join(root, "lane-freshness.json");
    writeFileSync(file, "{ not valid json");

    expect(() => guard.loadDeclaration(file)).toThrow(guard.LaneFreshnessDeclarationError);
  });

  it("throws when the file is missing", () => {
    const root = makeTempDir("lane-freshness-json-");
    expect(() => guard.loadDeclaration(path.join(root, "missing.json"))).toThrow(
      guard.LaneFreshnessDeclarationError,
    );
  });

  it("loads and validates a real declaration file", () => {
    const root = makeTempDir("lane-freshness-json-");
    const file = path.join(root, "lane-freshness.json");
    writeFileSync(file, JSON.stringify({ lanes: [baseLane()] }));

    const lanes = guard.loadDeclaration(file);
    expect(lanes[0].id).toBe("test-lane");
  });

  it("loads the checked-in declaration file shape", () => {
    const lanes = guard.loadDeclaration(
      path.join(process.cwd(), "scripts/quality/lane-freshness.json"),
    );
    expect(lanes.length).toBeGreaterThan(0);
    expect(lanes[0].id).toBe("architecture-fitness-attestation");
    // Policy values (budget, enforcement) are Human-owned in the declaration
    // file; pin only the validated shape here so a policy change edits one
    // place. validateDeclaration already rejects invalid enforcement values.
    expect(["warn", "block"]).toContain(lanes[0].enforcement);
  });
});

// --- collectLaneGitFacts: real git plumbing against a fixture repo ---------

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf-8" });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function commit(root: string, filename: string, message: string): string {
  writeFileSync(path.join(root, filename), `${message}\n`);
  git(root, ["add", "."]);
  git(root, ["-c", "user.name=t", "-c", "user.email=t@example.com", "commit", "-q", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]);
}

function makeFixtureRepo(): { root: string } {
  const root = makeTempDir("lane-freshness-git-");
  git(root, ["init", "-q", "-b", "main"]);
  return { root };
}

describe("collectLaneGitFacts", () => {
  it("reports commitExists + integrated + staleness for an ancestor commit", () => {
    const { root } = makeFixtureRepo();
    const targetSha = commit(root, "a.txt", "target commit");
    commit(root, "b.txt", "second commit");
    commit(root, "c.txt", "third commit");

    const lane = baseLane({ lastTargetSha: targetSha });
    const facts = guard.collectLaneGitFacts(lane, root);

    expect(facts.isShallow).toBe(false);
    expect(facts.commitExists).toBe(true);
    expect(facts.integrated).toBe(true);
    expect(facts.staleness).toBe(2);
  });

  it("treats a squash-merged former branch head as integrated via tree match", () => {
    const { root } = makeFixtureRepo();
    commit(root, "a.txt", "base commit");
    git(root, ["checkout", "-q", "-b", "feature"]);
    const featureHeadSha = commit(root, "feature.txt", "feature work");
    git(root, ["checkout", "-q", "main"]);
    git(root, ["merge", "-q", "--squash", "feature"]);
    git(root, [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.com",
      "commit",
      "-q",
      "-m",
      "squash-merge feature (#1)",
    ]);
    commit(root, "after.txt", "commit after the squash merge");

    // The pre-merge branch head is NOT a literal ancestor of main after a
    // squash merge (the squash commit carries a new SHA with the same tree).
    const isAncestor = spawnSync("git", ["merge-base", "--is-ancestor", featureHeadSha, "HEAD"], {
      cwd: root,
    }).status;
    expect(isAncestor).not.toBe(0);

    const lane = baseLane({ lastTargetSha: featureHeadSha });
    const facts = guard.collectLaneGitFacts(lane, root);

    expect(facts.commitExists).toBe(true);
    expect(facts.integrated).toBe(true);
    // HEAD has the squash commit itself plus the commit made after it — both
    // are "new" relative to the pre-merge branch head's own history.
    expect(facts.staleness).toBe(2);
  });

  it("reports commitExists=false for an unknown sha in a non-shallow repo", () => {
    const { root } = makeFixtureRepo();
    commit(root, "a.txt", "base commit");

    const lane = baseLane({ lastTargetSha: "f".repeat(40) });
    const facts = guard.collectLaneGitFacts(lane, root);

    expect(facts.isShallow).toBe(false);
    expect(facts.commitExists).toBe(false);
    expect(facts.integrated).toBe(false);
    expect(facts.staleness).toBeNull();
  });

  it("skips a shallow clone missing the declared sha", () => {
    const { root: sourceRoot } = makeFixtureRepo();
    const oldSha = commit(sourceRoot, "a.txt", "old commit");
    commit(sourceRoot, "b.txt", "newer commit");
    commit(sourceRoot, "c.txt", "newest commit");

    const shallowRoot = makeTempDir("lane-freshness-shallow-");
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${sourceRoot}`, shallowRoot]);

    const lane = baseLane({ lastTargetSha: oldSha });
    const facts = guard.collectLaneGitFacts(lane, shallowRoot);

    expect(facts.isShallow).toBe(true);
    expect(facts.commitExists).toBe(false);

    const result = guard.evaluateLane(lane, facts);
    expect(result.outcome).toBe("shallow-skip");
    expect(result.exitCode).toBe(0);
  });
});

// --- CLI end-to-end: exit codes and printed output --------------------------

function writeDeclaration(root: string, lanes: unknown[]): void {
  mkdirSync(path.join(root, "scripts/quality"), { recursive: true });
  writeFileSync(path.join(root, "scripts/quality/lane-freshness.json"), JSON.stringify({ lanes }));
}

describe("check-lane-freshness.mjs CLI", () => {
  it("exits 0 and prints a warning annotation for a within-budget + warn-over-budget mix", () => {
    const { root } = makeFixtureRepo();
    const targetSha = commit(root, "a.txt", "target commit");
    commit(root, "b.txt", "second commit");
    commit(root, "c.txt", "third commit");
    commit(root, "d.txt", "fourth commit");
    commit(root, "e.txt", "fifth commit"); // staleness = 4 relative to targetSha

    writeDeclaration(root, [
      baseLane({ id: "within-budget-lane", lastTargetSha: targetSha, budgetCommits: 10 }),
      baseLane({
        id: "warn-lane",
        lastTargetSha: targetSha,
        budgetCommits: 3,
        enforcement: "warn",
      }),
    ]);

    const result = spawnSync("node", [SCRIPT], { cwd: root, encoding: "utf-8" });

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("within-budget-lane: staleness=4 commits, budget=10");
    expect(result.stdout).toContain("warn-lane: staleness=4 commits, budget=3");
    expect(result.stdout).toContain("::warning title=lane-freshness::");
    expect(result.stdout).not.toContain("::error title=lane-freshness::");
  });

  it("exits 1 and prints an error annotation when any lane blocks", () => {
    const { root } = makeFixtureRepo();
    const targetSha = commit(root, "a.txt", "target commit");
    commit(root, "b.txt", "second commit");
    commit(root, "c.txt", "third commit");
    commit(root, "d.txt", "fourth commit");
    commit(root, "e.txt", "fifth commit"); // staleness = 4 relative to targetSha

    writeDeclaration(root, [
      baseLane({ id: "within-budget-lane", lastTargetSha: targetSha, budgetCommits: 10 }),
      baseLane({
        id: "block-lane",
        lastTargetSha: targetSha,
        budgetCommits: 3,
        enforcement: "block",
      }),
    ]);

    const result = spawnSync("node", [SCRIPT], { cwd: root, encoding: "utf-8" });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("within-budget-lane: staleness=4 commits, budget=10");
    expect(result.stdout).toContain("block-lane: staleness=4 commits, budget=3");
    expect(result.stdout).toContain("::error title=lane-freshness::");
  });

  it("exits 1 on a malformed declaration without touching git", () => {
    const { root } = makeFixtureRepo();
    commit(root, "a.txt", "base commit");
    writeDeclaration(root, [{ ...baseLane(), enforcement: "notify" }]);

    const result = spawnSync("node", [SCRIPT], { cwd: root, encoding: "utf-8" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("enforcement");
  });
});
