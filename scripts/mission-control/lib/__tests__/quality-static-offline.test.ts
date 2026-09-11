import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import YAML from "yaml";

type WorkflowStep = {
  env?: Record<string, unknown>;
  run?: string;
};

type WorkflowJob = {
  environment?: unknown;
  steps?: WorkflowStep[];
};

type Workflow = {
  jobs?: Record<string, WorkflowJob>;
};

describe("quality static job", () => {
  it("stays offline and deterministic", () => {
    const source = readFileSync(join(process.cwd(), ".github/workflows/quality.yml"), "utf8");
    const workflow = YAML.parse(source) as Workflow;
    const staticJob = workflow.jobs?.static;

    expect(staticJob).toBeDefined();
    expect(staticJob?.environment).toBeUndefined();
    expect(staticJob?.steps?.some((step) => step.run === "npm run quality:static")).toBe(true);
    expect(JSON.stringify(staticJob)).not.toContain("${{ secrets.");

    const envNames = (staticJob?.steps ?? []).flatMap((step) => Object.keys(step.env ?? {}));
    expect(envNames.filter((name) => /(?:API_KEY|SECRET|TOKEN)$/.test(name))).toEqual([]);
  });
});
