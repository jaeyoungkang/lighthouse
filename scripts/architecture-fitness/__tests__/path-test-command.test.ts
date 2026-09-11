import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF,
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  ARCHITECTURE_FITNESS_PATH_TEST_MAX_WORKERS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "../path-test-command.mjs";

describe("Architecture Fitness path-test command", () => {
  it("keeps bounded worker args and recorded evidence command identical", () => {
    const invocation = architectureFitnessPathTestInvocation(["first.test.ts", "second.test.ts"]);

    expect(ARCHITECTURE_FITNESS_PATH_TEST_MAX_WORKERS).toBe(2);
    expect(invocation.args).toEqual([
      "run",
      "first.test.ts",
      "second.test.ts",
      "--config",
      expect.stringMatching(
        new RegExp(`${ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF.replaceAll(".", "\\.")}$`),
      ),
      "--reporter=json",
      "--maxWorkers=2",
    ]);
    expect(invocation.command).toBe(
      `node_modules/.bin/vitest run first.test.ts second.test.ts --config '<collector-authority>/${ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF}' --reporter=json --maxWorkers=2`,
    );
    expect(ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS).toEqual([
      "scripts/architecture-fitness/path-test-command.mjs",
      ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF,
      "scripts/architecture-fitness/path-vitest.setup.ts",
    ]);
  });

  it("renders a POSIX-shell command that round-trips paths with metacharacters", () => {
    const invocation = architectureFitnessPathTestInvocation([
      "app/(research)/__tests__/research-routes.test.tsx",
      "app/server/services/paper's.test.ts",
    ]);

    const parsed = execFileSync("sh", ["-c", `set -- ${invocation.command}; printf '%s\\n' "$@"`], {
      encoding: "utf8",
    })
      .trimEnd()
      .split("\n");

    expect(parsed[0]).toBe("node_modules/.bin/vitest");
    expect(parsed.slice(1)).toEqual([
      "run",
      "app/(research)/__tests__/research-routes.test.tsx",
      "app/server/services/paper's.test.ts",
      "--config",
      `<collector-authority>/${ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF}`,
      "--reporter=json",
      "--maxWorkers=2",
    ]);
    expect(invocation.command).toContain("'app/(research)/__tests__/research-routes.test.tsx'");
  });

  it("binds the target tree separately from the collector-owned config and setup", () => {
    const environment = architectureFitnessPathTestEnvironment(process.cwd());

    expect(environment.AF_PATH_TEST_TARGET_ROOT).toBe(realpathSync(process.cwd()));
    expect(environment.AF_PATH_TEST_COLLECTOR_ROOT).toBe(realpathSync(process.cwd()));
  });
});
