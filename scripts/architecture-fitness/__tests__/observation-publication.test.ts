import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  checkObservationFiles,
  inspectObservationPublication,
} from "../check-observation-publication.mjs";

const SCRIPT = path.join(
  process.cwd(),
  "scripts/architecture-fitness/check-observation-publication.mjs",
);
const temporaryRoots: string[] = [];

function makeObservation(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "2",
    kind: "architecture-fitness-observation",
    serviceId: "lighthouse",
    policySetRef: "test-policy",
    policySetVersion: "1",
    policyDigest: "a".repeat(64),
    revision: "b".repeat(40),
    collector: {
      id: "test-collector",
      version: "1",
      definitionDigest: "c".repeat(64),
      runRef: "test-run",
      command: "test collector command",
    },
    evidence: [
      {
        id: "evidence:test",
        commandExitCode: 0,
        reproducible: true,
      },
    ],
    observations: [
      {
        id: "observation:test",
        completeness: "complete",
      },
    ],
    ...overrides,
  };
}

function runObservation(observation: Record<string, unknown>) {
  const root = mkdtempSync(path.join(tmpdir(), "architecture-fitness-publication-"));
  temporaryRoots.push(root);
  const observationPath = path.join(root, "observation.json");
  writeFileSync(observationPath, `${JSON.stringify(observation, null, 2)}\n`);
  return spawnSync("node", [SCRIPT, "--observation", observationPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Architecture Fitness observation publication boundary", () => {
  it("accepts complete, successful, reproducible observations", () => {
    const observation = makeObservation();
    expect(inspectObservationPublication(observation)).toEqual({
      publishable: true,
      failures: [],
    });
    const result = runObservation(observation);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("PASS");
  });

  it("refuses successful publication of a partial diagnostic observation", () => {
    const observation = makeObservation({
      observations: [{ id: "observation:test", completeness: "partial" }],
    });
    expect(inspectObservationPublication(observation)).toEqual({
      publishable: false,
      failures: ["observation observation:test completeness=partial"],
    });
    const result = runObservation(observation);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("completeness=partial");
  });

  it("refuses evidence whose command failed even if a collector claims completeness", () => {
    const observation = makeObservation({
      evidence: [{ id: "evidence:test", commandExitCode: 1, reproducible: true }],
    });
    expect(inspectObservationPublication(observation)).toEqual({
      publishable: false,
      failures: ["evidence evidence:test commandExitCode=1"],
    });
    const result = runObservation(observation);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("commandExitCode=1");
  });

  it("refuses evidence whose reproducibility is not established", () => {
    const observation = makeObservation({
      evidence: [{ id: "evidence:test", commandExitCode: 0, reproducible: false }],
    });
    expect(inspectObservationPublication(observation)).toEqual({
      publishable: false,
      failures: ["evidence evidence:test declared reproducible=false"],
    });
    const result = runObservation(observation);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("declared reproducible=false");
  });

  it("refuses an identity-incomplete artifact before raw publication", () => {
    const observation = {
      kind: "architecture-fitness-observation",
      evidence: [],
      observations: [],
    };
    const inspection = inspectObservationPublication(observation);
    expect(inspection.publishable).toBe(false);
    expect(inspection.failures).toContain("schemaVersion is not 2");
    expect(inspection.failures).toContain("collector.id is missing");
    expect(inspection.failures).toContain("observations are missing");
    expect(inspection.failures).toContain("evidence is missing");
    const result = runObservation(observation);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("schemaVersion is not 2");
    expect(result.stderr).toContain("collector.id is missing");
  });

  it.each(["serviceId", "policySetRef", "policySetVersion", "policyDigest", "revision"])(
    "refuses a missing %s identity field",
    (field) => {
      const observation = makeObservation({ [field]: "" });

      expect(inspectObservationPublication(observation)).toEqual({
        publishable: false,
        failures: [`${field} is missing`],
      });
    },
  );

  it.each(["id", "version", "definitionDigest", "runRef", "command"])(
    "refuses a missing collector.%s identity field",
    (field) => {
      const valid = makeObservation();
      const collector = { ...(valid.collector as Record<string, unknown>), [field]: "" };
      const observation = { ...valid, collector };

      expect(inspectObservationPublication(observation)).toEqual({
        publishable: false,
        failures: [`collector.${field} is missing`],
      });
    },
  );

  it("rejects a wrong artifact kind instead of treating identity fields as sufficient", () => {
    const observation = makeObservation({ kind: "architecture-fitness-policy" });

    expect(inspectObservationPublication(observation)).toEqual({
      publishable: false,
      failures: ["kind is not architecture-fitness-observation"],
    });
  });

  it("fails closed for absent roots and malformed nested evidence items", () => {
    expect(inspectObservationPublication(undefined).publishable).toBe(false);

    const inspection = inspectObservationPublication(
      makeObservation({ observations: [null], evidence: [null] }),
    );
    expect(inspection).toEqual({
      publishable: false,
      failures: [
        "observation <unknown> completeness=undefined",
        "evidence <unknown> commandExitCode=undefined",
        "evidence <unknown> declared reproducible=undefined",
      ],
    });
  });

  it("checks every requested file and preserves its input path", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "architecture-fitness-publication-files-"));
    temporaryRoots.push(root);
    const observationPath = path.join(root, "observation.json");
    writeFileSync(observationPath, `${JSON.stringify(makeObservation())}\n`);

    await expect(checkObservationFiles([observationPath])).resolves.toEqual([
      { path: observationPath, publishable: true, failures: [] },
    ]);
  });
});
