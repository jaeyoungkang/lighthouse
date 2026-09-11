import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = resolve(process.cwd(), ".github/workflows/search-quality-evidence.yml");
const WORKFLOW_SOURCE = readFileSync(WORKFLOW_PATH, "utf8");
const workflow = parse(WORKFLOW_SOURCE) as {
  on?: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs?: Record<
    string,
    {
      environment?: unknown;
      env?: Record<string, string>;
      steps?: Array<{
        name?: string;
        uses?: string;
        run?: string;
        with?: Record<string, unknown>;
      }>;
    }
  >;
};

const EXPECTED_PUBLISHED_PATHS = [
  "${{ runner.temp }}/search-quality-published/bundle.json",
  "${{ runner.temp }}/search-quality-published/verification.json",
];

function publishedPaths(value: unknown): string[] {
  if (typeof value !== "string") throw new Error("published artifact path must be text");
  const paths = value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  if (JSON.stringify(paths) !== JSON.stringify(EXPECTED_PUBLISHED_PATHS)) {
    throw new Error("published artifact path must match the aggregate-only allowlist");
  }
  return paths;
}

describe("search-quality local synthetic evidence workflow", () => {
  it("keeps one secretless local evidence job with no external attestor", () => {
    expect(workflow.on).toEqual({ workflow_dispatch: {} });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(Object.keys(workflow.jobs ?? {})).toEqual(["evidence"]);

    const evidence = workflow.jobs?.evidence;
    expect(evidence?.environment).toBeUndefined();
    expect(evidence?.env?.EPISTEME_LITERATURE_API_URL).toBe("http://127.0.0.1:43123");
    expect(WORKFLOW_SOURCE).not.toMatch(/SEARCH_QUALITY_ATTESTATION_KEY/);
    expect(WORKFLOW_SOURCE).not.toMatch(/lighthouse-search-quality-attestor/);
    expect(WORKFLOW_SOURCE).not.toMatch(/search-quality-raw/);
  });

  it("runs the exact loopback path and publishes only the local candidate for 14 days", () => {
    const evidence = workflow.jobs?.evidence;
    const collectionStep = evidence?.steps?.find(
      (step) => step.name === "Collect synthetic actual-path reports",
    );
    const buildStep = evidence?.steps?.find(
      (step) => step.name === "Build and self-check candidate evidence from raw reports",
    );
    const uploadStep = evidence?.steps?.find(
      (step) => step.name === "Publish aggregate-only synthetic evidence",
    );

    expect(collectionStep?.run).toContain("--base-url http://127.0.0.1:3000");
    expect(collectionStep?.run).toContain("--provider-stats-url http://127.0.0.1:43123/__stats");
    expect(buildStep?.run).toContain('= "bundle.json verification.json"');
    expect(uploadStep?.uses).toMatch(/^actions\/upload-artifact@[0-9a-f]{40}$/);
    expect(publishedPaths(uploadStep?.with?.path)).toEqual(EXPECTED_PUBLISHED_PATHS);
    expect(uploadStep?.with?.["if-no-files-found"]).toBe("error");
    expect(uploadStep?.with?.["retention-days"]).toBe(14);
  });

  it("rejects a broad publication path that could include raw identities", () => {
    expect(() => publishedPaths("${{ runner.temp }}/search-quality-published/")).toThrow(
      "published artifact path must match the aggregate-only allowlist",
    );
  });
});
