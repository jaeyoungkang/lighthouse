import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

type NativePathConfig = {
  resolve?: {
    tsconfigPaths?: boolean;
  };
};

function nativePathConfig(value: unknown): NativePathConfig {
  return value as NativePathConfig;
}

describe("quality configuration ownership", () => {
  it("keeps the local-only pilot workspace outside the full-repo lint input", () => {
    const eslintConfig = read("eslint.config.mjs");

    expect(eslintConfig).toContain('"pilot/**"');
  });

  it("keeps duplicate detection free of ignores outside its app-only scan root", () => {
    const jscpdConfig = JSON.parse(read(".jscpd.json")) as {
      ignore: string[];
      path: string[];
    };

    expect(
      jscpdConfig.path,
      "benchmark ignore removal is valid only while duplicate detection scans app/ exclusively",
    ).toEqual(["app"]);
  });

  it("uses Vite native tsconfig path resolution in unit and mutation configs", async () => {
    for (const configPath of ["vitest.config.mts", "vitest.config.mutation.mts"]) {
      const loaded = (await import(path.join(repoRoot, configPath))) as {
        default: unknown;
      };
      const config = nativePathConfig(loaded.default);
      expect(config.resolve?.tsconfigPaths).toBe(true);
    }

    expect(read("scripts/architecture-fitness/path-test-command.mjs")).toContain(
      "ARCHITECTURE_FITNESS_PATH_TEST_CONFIG_REF",
    );
    expect(read("scripts/architecture-fitness/path-vitest.config.mts")).toContain(
      "AF_PATH_TEST_TARGET_ROOT",
    );
  });

  it("keeps CI documentation aligned with the six-gate hardening authority", () => {
    expect(read("docs/ci-structure.md")).toContain("Sufficiency Review hardening 6게이트");
    expect(read("docs/verification-gates.md")).toContain(
      "Sufficiency Review가 근거 없이 met으로 통과되지 않게 만드는 6개 도구",
    );
  });
});
