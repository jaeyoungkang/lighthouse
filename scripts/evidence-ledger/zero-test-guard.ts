import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

import type { EvidenceLedger } from "@/app/domain/story-chain";

export interface ZeroTestViolation {
  ledger: string;
  execution: string;
  reason: string;
}

interface ListedTest {
  name: string;
  file: string;
}

interface VitestListProcessResult {
  error?: Error;
  status: number | null;
  stderr: string;
  stdout: string;
}

type VitestListRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    shell: false;
    encoding: "utf8";
    maxBuffer: number;
  },
) => VitestListProcessResult;

function listVitestTests(
  repoRoot: string,
  files: readonly string[],
  runVitestList: VitestListRunner,
): { tests?: ListedTest[]; error?: string } {
  if (files.length === 0) return { tests: [] };
  const vitest = realpathSync(path.join(repoRoot, "node_modules/vitest/vitest.mjs"));
  const result = runVitestList(process.execPath, [vitest, "list", ...files, "--json"], {
    cwd: repoRoot,
    shell: false,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) return { error: result.error.message };
  if (result.status !== 0) {
    return {
      error: `vitest list exited ${String(result.status)}: ${(result.stderr || result.stdout).trim()}`,
    };
  }
  try {
    return { tests: JSON.parse(result.stdout) as ListedTest[] };
  } catch (error) {
    return {
      error: `vitest list returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function validateEvidenceLedgerVitestSelectors(
  ledgers: readonly EvidenceLedger[],
  repoRoot: string,
  runVitestList: VitestListRunner = spawnSync,
): ZeroTestViolation[] {
  const executions = ledgers.flatMap((ledger) =>
    ledger.executions.flatMap((execution) =>
      execution.kind === "vitest" ? [{ ledger, execution }] : [],
    ),
  );
  const files = [...new Set(executions.flatMap(({ execution }) => execution.files))].sort();
  const listed = listVitestTests(repoRoot, files, runVitestList);
  if (listed.error) {
    return [{ ledger: "<all>", execution: "<vitest-list>", reason: listed.error }];
  }
  const testsByFile = new Map<string, string[]>();
  (listed.tests ?? []).forEach((test) => {
    const relative = path.relative(repoRoot, test.file).replaceAll("\\", "/");
    const names = testsByFile.get(relative) ?? [];
    names.push(test.name);
    testsByFile.set(relative, names);
  });

  const violations: ZeroTestViolation[] = [];
  executions.forEach(({ ledger, execution }) => {
    const names = execution.files.flatMap((file) => testsByFile.get(file) ?? []);
    if (names.length === 0) {
      violations.push({
        ledger: ledger.path,
        execution: execution.id,
        reason: "structured Vitest execution collects zero tests",
      });
      return;
    }
    if (!execution.testNamePattern) return;
    let selector: RegExp;
    try {
      selector = new RegExp(execution.testNamePattern);
    } catch {
      violations.push({
        ledger: ledger.path,
        execution: execution.id,
        reason: `testNamePattern ${JSON.stringify(execution.testNamePattern)} is not a valid regular expression`,
      });
      return;
    }
    if (!names.some((name) => selector.test(name))) {
      violations.push({
        ledger: ledger.path,
        execution: execution.id,
        reason: `testNamePattern ${JSON.stringify(execution.testNamePattern)} matches zero collected tests`,
      });
    }
  });
  return violations;
}
