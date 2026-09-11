#!/usr/bin/env tsx
// Claude Code PostToolUse hook — after the agent runs a successful
// `gh pr merge …`, clean the local worktree (fetch, drop the branch whose
// PR just merged, fast-forward main, prune stale worktrees) and report what
// happened back into agent context.
//
// Modeled on `scripts/project-knowledge/post-commit-reminder.ts`.
// Wired in `.claude/settings.json` under `hooks.PostToolUse[].matcher=Bash`.
//
// Input (stdin): Claude Code hook payload — at minimum:
//   { "tool_name": "Bash", "tool_input": { "command": "..." },
//     "tool_response": { "output": "...", "is_error"?: boolean } }
//
// Output (stdout): JSON with hookSpecificOutput.additionalContext that
// Claude Code injects into the next agent context. Emit nothing for tool
// calls that don't match a successful `gh pr merge` so the hook stays
// silent.

import { execFileSync } from "node:child_process";

interface HookInput {
  tool_name?: string;
  tool_input?: { command?: string };
  tool_response?: { output?: string; is_error?: boolean };
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let raw = "";
    process.stdin.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    process.stdin.on("end", () => {
      resolve(raw);
    });
  });
}

export function looksLikeMerge(cmd: string): boolean {
  // Real `gh pr merge` invocation, possibly chained (`cd … && gh pr merge`,
  // `gh pr merge 1 --merge; echo done`). Anchored on shell command-segment
  // boundaries (start of string, or after `&&`/`;`/`|`/newline) — like
  // `looksLikeCommit` in post-commit-reminder.ts anchors on `git commit` —
  // so a mention such as `echo gh pr merge` (not an actual invocation)
  // does not match. Reject `gh pr merge --help`/`-h`.
  // Quoted literals and heredoc bodies (commit messages, echo arguments) can
  // carry "gh pr merge" at a line start without invoking gh, so strip them
  // before matching.
  // `$(gh pr merge …)` and backtick substitution count as command positions.
  // A substitution nested inside double quotes is stripped with the string
  // and stays unsupported.
  const bare = stripQuotedText(cmd);
  if (!/(^|&&|;|\||\n|\(|`)\s*gh\s+pr\s+merge\b/.test(bare)) return false;
  if (/\s(--help|-h)\b/.test(bare)) return false;
  return true;
}

export function stripQuotedText(cmd: string): string {
  return cmd
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\1(?=\n|$)/g, " ")
    .replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""')
    .replace(/'[^']*'/g, "''");
}

type GitResult = { ok: true; output: string } | { ok: false; error: unknown };

function runGit(args: string[], cwd: string): GitResult {
  try {
    const output = execFileSync("git", args, { cwd, stdio: "pipe", encoding: "utf8" });
    return { ok: true, output: output.trim() };
  } catch (error) {
    return { ok: false, error };
  }
}

export interface LocalBranchInfo {
  name: string;
  upstreamGone: boolean;
}

// Pure selection logic, kept separate from git I/O so it can be unit-tested
// without a real repository.
export function selectDeletableBranches(
  branches: readonly LocalBranchInfo[],
  exclude: readonly string[],
  isAncestorOfMain: (branch: string) => boolean,
): string[] {
  return branches
    .filter((branch) => !exclude.includes(branch.name))
    .filter((branch) => branch.upstreamGone)
    .filter((branch) => isAncestorOfMain(branch.name))
    .map((branch) => branch.name);
}

function listLocalBranches(cwd: string): LocalBranchInfo[] {
  // `%(upstream:track)` reports `[gone]` under the same condition
  // `git branch -vv` displays it for — the configured upstream's
  // remote-tracking ref no longer exists (e.g. after `fetch --prune`).
  const result = runGit(
    ["for-each-ref", "--format=%(refname:short)%09%(upstream:track)", "refs/heads/"],
    cwd,
  );
  if (!result.ok) return [];
  return result.output
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [name = "", track = ""] = line.split("\t");
      return { name, upstreamGone: track.includes("[gone]") };
    });
}

function isUpstreamGone(branch: string, cwd: string): boolean {
  const upstream = runGit(["rev-parse", "--abbrev-ref", `${branch}@{upstream}`], cwd);
  if (!upstream.ok) return true;
  const track = runGit(["for-each-ref", "--format=%(upstream:track)", `refs/heads/${branch}`], cwd);
  return track.ok && track.output.includes("[gone]");
}

function isAncestorOfMain(branch: string, cwd: string): boolean {
  return runGit(["merge-base", "--is-ancestor", branch, "origin/main"], cwd).ok;
}

function isWorktreeDirty(cwd: string): boolean {
  const status = runGit(["status", "--porcelain"], cwd);
  // Fail closed: if `git status` itself cannot run, treat the tree as dirty
  // so we skip mutations rather than risk clobbering uncommitted work.
  if (!status.ok) return true;
  return status.output.length > 0;
}

function getCurrentBranch(cwd: string): string | null {
  const result = runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  return result.ok ? result.output : null;
}

interface CleanupLog {
  performed: string[];
  skipped: string[];
}

function runStep(log: CleanupLog, description: string, args: string[], cwd: string): boolean {
  const result = runGit(args, cwd);
  if (result.ok) {
    log.performed.push(description);
    return true;
  }
  log.skipped.push(`${description} 실패`);
  return false;
}

function maybeCheckoutMain(log: CleanupLog, currentBranch: string, cwd: string): string {
  if (currentBranch === "main") return currentBranch;
  const gone = isUpstreamGone(currentBranch, cwd);
  const merged = gone && isAncestorOfMain(currentBranch, cwd);
  if (!merged) {
    log.skipped.push(
      `현재 브랜치 ${currentBranch} 유지 (upstream 존재 또는 origin/main에 아직 병합되지 않음)`,
    );
    return currentBranch;
  }
  const checkedOut = runStep(
    log,
    `git checkout main (이전 브랜치 ${currentBranch}는 origin/main에 병합됨)`,
    ["checkout", "main"],
    cwd,
  );
  return checkedOut ? "main" : currentBranch;
}

function deleteMergedBranches(log: CleanupLog, exclude: readonly string[], cwd: string): void {
  const branches = listLocalBranches(cwd);
  const deletable = selectDeletableBranches(branches, exclude, (branch) =>
    isAncestorOfMain(branch, cwd),
  );
  if (deletable.length === 0) {
    log.skipped.push("삭제할, upstream이 사라지고 origin/main에 병합된 로컬 브랜치 없음");
    return;
  }
  for (const branch of deletable) {
    runStep(log, `git branch -d ${branch}`, ["branch", "-d", branch], cwd);
  }
}

function performCleanup(cwd: string): CleanupLog {
  const log: CleanupLog = { performed: [], skipped: [] };

  runStep(log, "git fetch --prune origin", ["fetch", "--prune", "origin"], cwd);

  if (isWorktreeDirty(cwd)) {
    log.skipped.push(
      "작업 트리에 변경 사항이 있어 브랜치 checkout/pull/삭제를 건너뜀 (git status --porcelain 비어있지 않음)",
    );
  } else {
    const currentBranch = getCurrentBranch(cwd);
    if (currentBranch === null) {
      log.skipped.push("현재 브랜치를 확인할 수 없어 브랜치 checkout/pull/삭제를 건너뜀");
    } else {
      const branchAfterCheckout = maybeCheckoutMain(log, currentBranch, cwd);
      if (branchAfterCheckout === "main") {
        runStep(
          log,
          "git pull --ff-only origin main",
          ["pull", "--ff-only", "origin", "main"],
          cwd,
        );
      }
      deleteMergedBranches(log, ["main", branchAfterCheckout], cwd);
    }
  }

  runStep(log, "git worktree prune", ["worktree", "prune"], cwd);

  return log;
}

function resolveMainHeadShortSha(cwd: string): string {
  const local = runGit(["rev-parse", "--short", "refs/heads/main"], cwd);
  if (local.ok) return local.output;
  const remote = runGit(["rev-parse", "--short", "origin/main"], cwd);
  if (remote.ok) return remote.output;
  return "unknown";
}

function buildAdditionalContext(log: CleanupLog, mainHeadShortSha: string): string {
  const lines: string[] = [
    "gh pr merge 성공을 감지해 post-merge 로컬 정리를 실행했다.",
    log.performed.length > 0 ? `수행: ${log.performed.join("; ")}` : "수행: 없음",
  ];
  if (log.skipped.length > 0) {
    lines.push(`건너뜀: ${log.skipped.join("; ")}`);
  }
  lines.push(`main HEAD: ${mainHeadShortSha}`);
  lines.push(
    'AGENTS.md project-knowledge 규칙에 따라 npm run pk:remember -- --note "<한국어 narrative>" ' +
      "로 로컬 작업 기억을 갱신할 것.",
  );
  lines.push(
    "project-status 기계적 체크포인트 sync는 main push 시 project-status-checkpoint.yml 워크플로가 " +
      "자동 실행하므로, 의미 있는 tracker row 변경이 있을 때만 npm run project-status -- sync 를 " +
      "수동 실행할 것.",
  );
  return lines.join("\n");
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    let input: HookInput;
    try {
      input = JSON.parse(raw) as HookInput;
    } catch {
      return; // Malformed payload: stay silent.
    }
    if (input.tool_name !== "Bash") return;
    const cmd = input.tool_input?.command ?? "";
    if (!looksLikeMerge(cmd)) return;
    if (input.tool_response?.is_error) return;

    const cwd = process.cwd();
    const log = performCleanup(cwd);
    const mainHeadShortSha = resolveMainHeadShortSha(cwd);

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PostToolUse",
          additionalContext: buildAdditionalContext(log, mainHeadShortSha),
        },
      }),
    );
  } catch {
    // Never throw out of the hook process — staying silent is the safe
    // default when something unexpected happens.
  }
}

void main();
