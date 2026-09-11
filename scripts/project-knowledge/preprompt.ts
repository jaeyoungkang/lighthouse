import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  ensureLocalLayout,
  readText,
  relativePath,
  localPath,
  sharedPath,
  writeText,
  workMemoryLogJsonPath,
  workMemoryPath,
} from "./common";
import { formatPilotObservationReminder, parsePilotObservationStatus } from "./pilot-observation";

const MAX_MEMORY_LINES = 8;
const COMPACT_MEMORY_CHARS = 220;

type HookInput = {
  session_id?: string;
  transcript_path?: string;
  prompt?: string;
};

type PrepromptState = {
  sessions?: Record<string, string>;
};

function currentMemorySummary(markdown: string): string {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.trim() === "## 현재 기억");
  if (start === -1) {
    return lines.slice(0, MAX_MEMORY_LINES).join("\n").trim();
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("## ")) {
      break;
    }
    if (line.trim().length > 0) {
      body.push(line);
    }
  }

  return body.slice(0, MAX_MEMORY_LINES).join("\n").trim();
}

function localWorkMemoryExcerpt(): string {
  const filePath = workMemoryPath();
  if (!existsSync(filePath)) {
    return "로컬 작업 기억 없음. 필요하면 `npm run pk:start`.";
  }

  const summary = currentMemorySummary(readText(filePath));
  if (!summary) {
    return `로컬 작업 기억: ${relativePath(filePath)} — 현재 기억 요약 없음.`;
  }
  return `로컬 작업 기억: ${relativePath(filePath)}
현재 기억: ${summary}`;
}

function localWorkMemoryCompactExcerpt(): string {
  const filePath = workMemoryPath();
  if (!existsSync(filePath)) {
    return "로컬 작업 기억 없음. 필요하면 `npm run pk:start`.";
  }

  const summary = currentMemorySummary(readText(filePath));
  if (!summary) {
    return `로컬 작업 기억: ${relativePath(filePath)} — 현재 기억 요약 없음.`;
  }

  const compactSummary =
    summary.length > COMPACT_MEMORY_CHARS
      ? `${summary.slice(0, COMPACT_MEMORY_CHARS).trimEnd()}...`
      : summary;
  return `로컬 작업 기억: ${relativePath(filePath)}
현재 기억 요약: ${compactSummary}`;
}

function logPointer(): string {
  const filePath = workMemoryLogJsonPath();
  if (!existsSync(filePath)) {
    return "과거 로컬 작업 기억 로그는 아직 없다.";
  }
  return `과거 기억: \`npm run pk:recall -- <query>\` 또는 \`npm run pk:log -- --tail 5\` (${relativePath(filePath)}).`;
}

function pilotObservationReminder(): string {
  const evaluationPath = sharedPath("pilot-evaluation.md");
  if (!existsSync(evaluationPath)) {
    return "";
  }
  const status = parsePilotObservationStatus(readText(evaluationPath));
  return status ? formatPilotObservationReminder(status) : "";
}

function readHookInput(): HookInput {
  if (process.stdin.isTTY) {
    return {};
  }

  try {
    const rawInput = readText("/dev/stdin").trim();
    if (!rawInput) {
      return {};
    }
    return JSON.parse(rawInput) as HookInput;
  } catch {
    return {};
  }
}

function statePath(): string {
  return localPath("preprompt-state.json");
}

function readState(): PrepromptState {
  const filePath = statePath();
  if (!existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(readText(filePath)) as PrepromptState;
  } catch {
    return {};
  }
}

function writeState(state: PrepromptState): void {
  const sessions = Object.entries(state.sessions ?? {}).slice(-50);
  writeText(
    statePath(),
    `${JSON.stringify(
      {
        sessions: Object.fromEntries(sessions),
      },
      null,
      2,
    )}\n`,
  );
}

function sessionKey(input: HookInput): string | undefined {
  return input.session_id ?? input.transcript_path;
}

function shouldRefreshForPrompt(prompt: string | undefined): boolean {
  if (!prompt) {
    return false;
  }
  return /계속|이어서|이어줘|아까|방금|기억(해|나|을|이)?|회상|복원|resume|continue|recall|remember/i.test(
    prompt,
  );
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function formatPreprompt(status: "updated" | "unchanged", hash: string, body: string): string {
  return `<project-knowledge-preprompt status="${status}" hash="${hash.slice(0, 12)}">
${body}
</project-knowledge-preprompt>`;
}

function emitAdditionalContext(additionalContext: string): void {
  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext,
      },
    })}\n`,
  );
}

function main(): void {
  ensureLocalLayout();
  const hookInput = readHookInput();
  const fullBody = `${localWorkMemoryExcerpt()}

규칙: 없거나 더 필요하면 \`npm run pk:start\`; 작업 전환/커밋 전후에는 \`npm run pk:remember -- --note "<한국어 narrative>"\`.
${logPointer()}
${pilotObservationReminder()}`;
  const currentHash = hashContent(fullBody);
  const key = sessionKey(hookInput);
  const state = readState();
  const previousHash = key ? state.sessions?.[key] : undefined;
  const shouldPrintFull =
    !key || previousHash !== currentHash || shouldRefreshForPrompt(hookInput.prompt);

  if (key) {
    writeState({
      sessions: {
        ...(state.sessions ?? {}),
        [key]: currentHash,
      },
    });
  }

  if (shouldPrintFull) {
    emitAdditionalContext(formatPreprompt("updated", currentHash, fullBody));
    return;
  }

  emitAdditionalContext(
    formatPreprompt(
      "unchanged",
      currentHash,
      `${localWorkMemoryCompactExcerpt()}
필요하면 \`npm run pk:recall -- <query>\` 또는 \`npm run pk:start\`.
${pilotObservationReminder()}`,
    ),
  );
}

main();
