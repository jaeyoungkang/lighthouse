import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const probePath = fileURLToPath(import.meta.url);
const targetRoot = process.cwd();
const tsxPath = path.join(targetRoot, "node_modules", ".bin", "tsx");
const breakerUrl = pathToFileURL(
  path.join(targetRoot, "app/server/external-http-gateway/episteme-circuit-breaker.ts"),
).href;

type BreakerProbeModule = {
  __resetEpistemeCircuitForTests: () => void;
  runThroughEpistemeBreaker: <T>(
    execute: () => Promise<T>,
    classify: (result: T) => boolean,
  ) => Promise<T>;
  isEpistemeBreakerOpen: () => boolean;
};

type ProbeResult = { mode: "trip" | "observe"; circuitOpen: boolean };

function parseProbeResult(stdout: string, mode: ProbeResult["mode"]): ProbeResult {
  const result = JSON.parse(stdout.trim()) as ProbeResult;
  if (result.mode !== mode || typeof result.circuitOpen !== "boolean") {
    throw new Error(`Invalid ${mode} probe result: ${stdout}`);
  }
  return result;
}

async function runPair(): Promise<void> {
  const tripProcess = spawn(tsxPath, [probePath, "trip"], {
    cwd: targetRoot,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let tripStdout = "";
  let tripStderr = "";
  tripProcess.stdout.setEncoding("utf8");
  tripProcess.stderr.setEncoding("utf8");
  tripProcess.stdout.on("data", (chunk: string) => {
    tripStdout += chunk;
  });
  tripProcess.stderr.on("data", (chunk: string) => {
    tripStderr += chunk;
  });

  const trip = await new Promise<ProbeResult>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      tripProcess.stdout.off("data", handleTripData);
      tripProcess.off("error", handleTripError);
      tripProcess.off("exit", handleTripExit);
    };
    const rejectAndTerminate = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      tripProcess.kill();
      reject(error);
    };
    const handleTripData = () => {
      const newlineIndex = tripStdout.indexOf("\n");
      if (newlineIndex < 0 || settled) return;
      try {
        const result = parseProbeResult(tripStdout.slice(0, newlineIndex), "trip");
        settled = true;
        cleanup();
        resolve(result);
      } catch (error) {
        rejectAndTerminate(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const handleTripError = (error: Error) => {
      rejectAndTerminate(error);
    };
    const handleTripExit = (code: number | null) => {
      rejectAndTerminate(
        new Error(tripStderr || `Trip probe exited ${String(code)} before observation.`),
      );
    };
    const timeout = setTimeout(() => {
      rejectAndTerminate(new Error("Trip probe did not become ready within 10 seconds."));
    }, 10_000);
    tripProcess.stdout.on("data", handleTripData);
    tripProcess.once("error", handleTripError);
    tripProcess.once("exit", handleTripExit);
  });

  const observed = spawnSync(tsxPath, [probePath, "observe"], {
    cwd: targetRoot,
    encoding: "utf8",
    timeout: 10_000,
  });
  const tripExit = new Promise<number | null>((resolve) => {
    tripProcess.once("exit", resolve);
  });
  tripProcess.stdin.end("release\n");
  const tripExitCode = await tripExit;
  if (observed.error) {
    throw observed.error;
  }
  if (observed.status === null) {
    throw new Error(`Observe probe terminated by ${observed.signal ?? "an unknown signal"}.`);
  }
  if (observed.status !== 0) {
    throw new Error(observed.stderr || `Observe probe exited ${String(observed.status)}`);
  }
  if (tripExitCode !== 0) {
    throw new Error(tripStderr || `Trip probe exited ${String(tripExitCode)}`);
  }
  process.stdout.write(
    JSON.stringify({ trip, observe: parseProbeResult(observed.stdout, "observe") }),
  );
}

async function runLeaf(mode: "trip" | "observe"): Promise<void> {
  const breaker = (await import(breakerUrl)) as BreakerProbeModule;
  if (mode === "trip") {
    breaker.__resetEpistemeCircuitForTests();
    for (let index = 0; index < 5; index += 1) {
      await breaker.runThroughEpistemeBreaker(
        () => Promise.resolve({ failed: true }),
        (result: { failed: boolean }) => result.failed,
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ mode, circuitOpen: breaker.isEpistemeBreakerOpen() })}\n`,
  );
  if (mode === "trip") {
    await new Promise<void>((resolve) => {
      process.stdin.once("data", () => {
        resolve();
      });
    });
  }
}

async function main(): Promise<void> {
  const mode = process.argv[2];
  if (mode === "pair") {
    await runPair();
    return;
  }
  if (mode === "trip" || mode === "observe") {
    await runLeaf(mode);
    return;
  }
  throw new Error("Expected probe mode: pair | trip | observe");
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
