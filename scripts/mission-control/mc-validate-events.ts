import path from "node:path";

import {
  AnalyticsEventContractError,
  loadEventContract,
  validateEventContractOrThrow,
} from "@/app/server/services/analytics/event-contract";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";

const repoRoot = path.resolve(__dirname, "..", "..");

interface ValidateEventsCliDeps {
  repoRoot: string;
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  loadEventContract: typeof loadEventContract;
  loadStoryChain: typeof loadStoryChain;
  validateEventContractOrThrow: typeof validateEventContractOrThrow;
}

export function shouldRunValidateEventsCli(argv: string[] = process.argv): boolean {
  return path.basename((argv[1] ?? "").replace(/\\/g, "/")) === "mc-validate-events.ts";
}

export async function runValidateEventsCli(
  deps: ValidateEventsCliDeps = {
    repoRoot,
    stdout: process.stdout,
    stderr: process.stderr,
    loadEventContract,
    loadStoryChain,
    validateEventContractOrThrow,
  },
): Promise<number> {
  await Promise.resolve();
  try {
    const contract = deps.loadEventContract(deps.repoRoot);
    const chain = deps.loadStoryChain(deps.repoRoot);
    const result = deps.validateEventContractOrThrow(contract, chain, deps.repoRoot);
    deps.stdout.write("mc:validate-events — event contract green\n");
    deps.stdout.write(`  events    ${String(contract.events.length).padStart(3)}\n`);
    if (result.warnings.length > 0) {
      deps.stdout.write(`  warnings  ${String(result.warnings.length).padStart(3)}\n`);
      for (const warning of result.warnings) {
        deps.stdout.write(`  - ${warning}\n`);
      }
    }
    return 0;
  } catch (error: unknown) {
    const message =
      error instanceof AnalyticsEventContractError || error instanceof Error
        ? error.message
        : String(error);
    deps.stderr.write(`mc:validate-events — FAIL\n${message}\n`);
    return 1;
  }
}

if (shouldRunValidateEventsCli()) {
  void runValidateEventsCli()
    .then((exitCode) => {
      process.exit(exitCode);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`mc:validate-events — unexpected failure\n${message}\n`);
      process.exit(1);
    });
}
