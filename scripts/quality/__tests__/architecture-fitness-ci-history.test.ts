import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

type Workflow = {
  jobs?: Record<string, { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> }>;
};

describe("Architecture Fitness CI history", () => {
  it("checks out full history in every job whose gates read historical revisions", () => {
    const workflow = YAML.parse(
      readFileSync(join(process.cwd(), ".github/workflows/quality.yml"), "utf8"),
    ) as Workflow;

    for (const jobName of ["static", "test", "full"]) {
      const checkout = workflow.jobs?.[jobName]?.steps?.find(
        (step) => step.uses === "actions/checkout@v5",
      );
      expect(checkout?.with?.["fetch-depth"], `${jobName} checkout history`).toBe(0);
    }
  });
});
