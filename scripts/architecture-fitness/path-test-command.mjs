import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHITECTURE_FITNESS_PATH_TEST_MAX_WORKERS = 2;
export const ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF =
  "scripts/architecture-fitness/path-vitest.config.mts";
export const ARCHITECTURE_FITNESS_PATH_TEST_SETUP_REF =
  "scripts/architecture-fitness/path-vitest.setup.ts";
export const ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS = [
  "scripts/architecture-fitness/path-test-command.mjs",
  ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF,
  ARCHITECTURE_FITNESS_PATH_TEST_SETUP_REF,
];

const COLLECTOR_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG_PATH = path.join(COLLECTOR_ROOT, ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF);

export function quoteShellArgument(value) {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

export function architectureFitnessPathTestInvocation(testPaths) {
  const args = [
    "run",
    ...testPaths,
    "--config",
    CONFIG_PATH,
    "--reporter=json",
    `--maxWorkers=${ARCHITECTURE_FITNESS_PATH_TEST_MAX_WORKERS}`,
  ];
  const recordedArgs = args.map((value) =>
    value === CONFIG_PATH
      ? `<collector-authority>/${ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF}`
      : value,
  );
  return {
    args,
    command: [path.join("node_modules", ".bin", "vitest"), ...recordedArgs]
      .map(quoteShellArgument)
      .join(" "),
  };
}

export function architectureFitnessPathTestEnvironment(targetRoot) {
  return {
    AF_PATH_TEST_TARGET_ROOT: realpathSync(targetRoot),
    AF_PATH_TEST_COLLECTOR_ROOT: realpathSync(COLLECTOR_ROOT),
  };
}
