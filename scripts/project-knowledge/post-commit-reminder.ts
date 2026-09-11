#!/usr/bin/env tsx
// Claude Code PostToolUse hook — when the agent just ran a successful
// `git commit`, inject a reminder into agent context to call
// `npm run pk:remember -- --note "<한국어 narrative>"` before ending the
// response. Reminder-only: narrative composition stays the agent's job.
//
// Wired in `.claude/settings.json` under `hooks.PostToolUse[].matcher=Bash`.
//
// Input (stdin): Claude Code hook payload — at minimum:
//   { "tool_name": "Bash", "tool_input": { "command": "..." },
//     "tool_response": { "output": "...", "is_error"?: boolean } }
//
// Output (stdout): JSON with hookSpecificOutput.additionalContext that
// Claude Code injects into the next agent context. Emit nothing for tool
// calls that don't match a successful commit so the hook stays silent.

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

function looksLikeCommit(cmd: string): boolean {
  // Real `git commit` form, possibly chained (cd … && git commit …).
  // Reject `git commit --help` and `git commit -h`.
  if (!/(^|\s|&&|;)\s*git\s+commit\b/.test(cmd)) return false;
  if (/\s(--help|-h)\b/.test(cmd)) return false;
  return true;
}

function commitSucceeded(output: string): boolean {
  // Successful `git commit` prints a header line like
  //   `[branch-name 0413d5cc] feat(search): ...`
  //   `[detached HEAD 0413d5cc] …`           (detached HEAD)
  //   `[main (root-commit) 0413d5cc] …`      (first commit on a branch)
  // Accept any non-`]` header token before the short SHA so we don't miss
  // legitimate cases. Anchor to start-of-line in multiline mode so we
  // match the header line itself, not stray bracketed text in stdout.
  return /^\[[^\]\n]*\b[0-9a-f]{7,}\]\s/m.test(output);
}

async function main(): Promise<void> {
  const raw = await readStdin();
  let input: HookInput;
  try {
    input = JSON.parse(raw) as HookInput;
  } catch {
    return; // Malformed payload: stay silent.
  }
  if (input.tool_name !== "Bash") return;
  const cmd = input.tool_input?.command ?? "";
  if (!looksLikeCommit(cmd)) return;
  if (input.tool_response?.is_error) return;
  const output = input.tool_response?.output ?? "";
  if (!commitSucceeded(output)) return;

  const reminder =
    "git commit detected. Per AGENTS.md project-knowledge rule " +
    '("커밋 전후, 컨텍스트 정리 시점에는 npm run pk:remember -- --note … 로 로컬 작업 기억을 갱신한다"), ' +
    'run `npm run pk:remember -- --note "<한국어 narrative>"` before ending this response so the next session can pick up.';

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: reminder,
      },
    }),
  );
}

void main();
