import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

interface StartLocalSupabaseOptions {
  run?: (args: readonly string[]) => CommandResult;
  wait?: (durationMs: number) => Promise<void>;
  write?: (result: CommandResult) => void;
}

const START_ARGS = [
  "supabase",
  "start",
  "--exclude",
  "realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor",
] as const;
const CLEANUP_ARGS = [
  "supabase",
  "stop",
  "--no-backup",
  "--project-id",
  "lighthouse",
  "--yes",
] as const;
const PORT_COLLISION_RETRY_DELAY_MS = 1_000;

function runNpx(args: readonly string[]): CommandResult {
  const result = spawnSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: [result.stderr, result.error?.message ?? ""].filter(Boolean).join("\n"),
  };
}

function writeCommandResult(result: CommandResult): void {
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function delay(durationMs: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, durationMs);
  });
}

export function isRetriableSupabasePortCollision(output: string): boolean {
  return output.includes("failed to bind host port") && output.includes("address already in use");
}

export async function startLocalSupabaseWithRecovery({
  run = runNpx,
  wait = delay,
  write = writeCommandResult,
}: StartLocalSupabaseOptions = {}): Promise<void> {
  const firstAttempt = run(START_ARGS);
  write(firstAttempt);
  if (firstAttempt.status === 0) return;

  const firstDiagnostic = `${firstAttempt.stdout}\n${firstAttempt.stderr}`;
  if (!isRetriableSupabasePortCollision(firstDiagnostic)) {
    throw new Error(
      `Supabase integration services failed to start without a retriable port collision (exit=${String(firstAttempt.status)}).`,
    );
  }

  console.warn(
    "[db-integration] local Supabase port collision detected; cleaning the lighthouse stack and retrying once.",
  );
  const cleanup = run(CLEANUP_ARGS);
  write(cleanup);
  await wait(PORT_COLLISION_RETRY_DELAY_MS);

  const secondAttempt = run(START_ARGS);
  write(secondAttempt);
  if (secondAttempt.status !== 0) {
    throw new Error(
      `Supabase integration services still failed after the single port-collision recovery attempt (exit=${String(secondAttempt.status)}).`,
    );
  }
}

async function main(): Promise<void> {
  if (process.env.CI !== "true") {
    throw new Error("The bounded Supabase startup recovery wrapper is CI-only.");
  }
  await startLocalSupabaseWithRecovery();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
