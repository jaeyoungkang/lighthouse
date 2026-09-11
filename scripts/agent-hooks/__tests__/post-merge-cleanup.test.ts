import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { looksLikeMerge, selectDeletableBranches } from "../post-merge-cleanup";

const REPO_ROOT = process.cwd();
const HOOK_SCRIPT = path.join(REPO_ROOT, "scripts/agent-hooks/post-merge-cleanup.ts");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: "Post Merge Cleanup Test",
  GIT_AUTHOR_EMAIL: "post-merge-cleanup-test@example.com",
  GIT_COMMITTER_NAME: "Post Merge Cleanup Test",
  GIT_COMMITTER_EMAIL: "post-merge-cleanup-test@example.com",
};

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    env: GIT_ENV,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runHook(cwd: string, command: string): { stdout: string; status: number | null } {
  const payload = JSON.stringify({
    tool_name: "Bash",
    tool_input: { command },
    tool_response: { output: "", is_error: false },
  });
  const result = spawnSync(TSX, [HOOK_SCRIPT], {
    cwd,
    env: GIT_ENV,
    input: payload,
    encoding: "utf8",
  });
  return { stdout: result.stdout, status: result.status };
}

describe("looksLikeMerge", () => {
  it.each([
    "gh pr merge 747 --merge",
    "cd x && gh pr merge",
    "cd apps/foo && gh pr merge 1 --squash",
    "gh pr merge 1 --merge; echo done",
    "RESULT=$(gh pr merge 123 --merge); echo $RESULT",
    "echo `gh pr merge 123 --merge`",
  ])("matches %s", (cmd) => {
    expect(looksLikeMerge(cmd)).toBe(true);
  });

  it.each([
    "gh pr merge --help",
    "gh pr merge -h",
    "gh pr view",
    "echo gh pr merge",
    // 커밋 메시지 본문 줄 시작에 등장하는 문자열은 명령이 아니다.
    'git commit -q -m "process: cleanup\n\ngh pr merge 성공 뒤 hook이 정리한다."',
    "cat <<'EOF'\ngh pr merge 1\nEOF",
    "echo 'x; gh pr merge 1'",
  ])("rejects %s", (cmd) => {
    expect(looksLikeMerge(cmd)).toBe(false);
  });
});

describe("selectDeletableBranches", () => {
  it("keeps only branches with a gone upstream that are ancestors of main, excluding named branches", () => {
    const branches = [
      { name: "main", upstreamGone: false },
      { name: "current", upstreamGone: true },
      { name: "feat", upstreamGone: true },
      { name: "wip-not-ancestor", upstreamGone: true },
      { name: "still-has-upstream", upstreamGone: false },
    ];
    const ancestors = new Set(["feat"]);

    const result = selectDeletableBranches(branches, ["main", "current"], (branch) =>
      ancestors.has(branch),
    );

    expect(result).toEqual(["feat"]);
  });
});

describe("post-merge-cleanup hook integration", () => {
  const cleanupDirs: string[] = [];

  afterEach(() => {
    while (cleanupDirs.length > 0) {
      const dir = cleanupDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function buildFixture(): { originDir: string; workDir: string } {
    const root = mkdtempSync(path.join(tmpdir(), "post-merge-cleanup-"));
    cleanupDirs.push(root);
    const originDir = path.join(root, "origin.git");
    const workDir = path.join(root, "work");

    git(["init", "--bare", "--quiet", originDir], root);
    git(["clone", "--quiet", originDir, workDir], root);
    git(["checkout", "-b", "main", "--quiet"], workDir);
    writeFileSync(path.join(workDir, "file.txt"), "hello\n");
    git(["add", "file.txt"], workDir);
    git(["commit", "--quiet", "-m", "initial"], workDir);
    git(["push", "--quiet", "-u", "origin", "main"], workDir);

    // feat: will be fast-forward-merged into origin/main and its remote
    // branch deleted — a real "PR just merged and remote branch deleted"
    // shape.
    git(["checkout", "-b", "feat", "--quiet"], workDir);
    writeFileSync(path.join(workDir, "file.txt"), "hello\nfeat work\n");
    git(["add", "file.txt"], workDir);
    git(["commit", "--quiet", "-m", "feat work"], workDir);
    git(["push", "--quiet", "-u", "origin", "feat"], workDir);

    // wip: pushed then its remote branch deleted too, but its commit never
    // lands on origin/main — must be kept.
    git(["checkout", "main", "--quiet"], workDir);
    git(["checkout", "-b", "wip", "--quiet"], workDir);
    writeFileSync(path.join(workDir, "wip.txt"), "wip work\n");
    git(["add", "wip.txt"], workDir);
    git(["commit", "--quiet", "-m", "wip work"], workDir);
    git(["push", "--quiet", "-u", "origin", "wip"], workDir);

    // Simulate feat's PR merging: fast-forward origin/main to feat's tip,
    // then delete both remote branches the way a merged/closed PR would.
    git(["push", "--quiet", "origin", "feat:main"], workDir);
    git(["push", "--quiet", "origin", "--delete", "feat"], workDir);
    git(["push", "--quiet", "origin", "--delete", "wip"], workDir);

    git(["checkout", "feat", "--quiet"], workDir);

    return { originDir, workDir };
  }

  it("cleans up a merged branch, keeps an unmerged one, and fast-forwards main", () => {
    const { originDir, workDir } = buildFixture();

    const result = runHook(workDir, "gh pr merge 1 --merge");

    expect(result.status).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    expect(parsed.hookSpecificOutput?.additionalContext).toBeTruthy();

    const localBranches = git(["branch", "--list"], workDir);
    expect(localBranches).not.toContain("feat");
    expect(localBranches).toContain("wip");

    expect(git(["rev-parse", "--abbrev-ref", "HEAD"], workDir)).toBe("main");

    const workMainHead = git(["rev-parse", "main"], workDir);
    const originMainHead = git(["rev-parse", "main"], originDir);
    expect(workMainHead).toBe(originMainHead);
  });

  it("skips checkout and branch deletion when the worktree is dirty, and says why", () => {
    const { workDir } = buildFixture();
    writeFileSync(path.join(workDir, "file.txt"), "hello\nfeat work\nuncommitted change\n");

    const result = runHook(workDir, "gh pr merge 1 --merge");

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as {
      hookSpecificOutput?: { additionalContext?: string };
    };
    const context = parsed.hookSpecificOutput?.additionalContext ?? "";
    expect(context).toContain("작업 트리에 변경 사항이 있어");

    expect(git(["rev-parse", "--abbrev-ref", "HEAD"], workDir)).toBe("feat");
    const localBranches = git(["branch", "--list"], workDir);
    expect(localBranches).toContain("feat");
    expect(localBranches).toContain("wip");
  });

  it("stays silent for a non-matching command", () => {
    const { workDir } = buildFixture();

    const result = runHook(workDir, "gh pr view 1");

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });
});
