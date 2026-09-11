import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadAndValidateArchitectureFitnessCoverageProjection,
  validateArchitectureFitnessCoverageProjection,
} from "../coverage-projection.mjs";

const projectionPath = path.join(
  process.cwd(),
  "docs",
  "architecture-fitness",
  "service-coverage.projection.json",
);

type ProjectionEntry = {
  projectionRef: string;
  decisionRef: string;
  ownedDecisionRefs?: string[];
  relatedDecisionRefs: string[];
  evidenceRefs: string[];
  disposition: string;
  authorityRefs: string[];
  binding: {
    profileId: string;
    policyCoverageRef: string;
    caseRefs: string[];
  } | null;
};

type CoverageProjection = {
  requiredDecisionRefs: string[];
  entries: ProjectionEntry[];
  [key: string]: unknown;
};

async function readProjection(): Promise<CoverageProjection> {
  return JSON.parse(await readFile(projectionPath, "utf8")) as CoverageProjection;
}

describe("service-wide Architecture Fitness coverage projection", () => {
  it("maps every active policy case while keeping unsupported and authority-missing slices classified", async () => {
    const { summary } = await loadAndValidateArchitectureFitnessCoverageProjection();

    expect(summary.ok).toBe(true);
    expect(summary.includedProfileCount).toBe(summary.activeProfileCount);
    expect(summary.counts.included).toBeGreaterThanOrEqual(summary.activeProfileCount);
    expect(summary.counts.unsupported).toBeGreaterThan(0);
    expect(summary.counts["authority-missing"]).toBeGreaterThan(0);
    expect(summary.unknownCoverageRefs).toContain("coverage:route-ai-comment-visible-basis");
  });

  it("rejects duplicate executable case bindings", async () => {
    const projection = await readProjection();
    const included = projection.entries.find((entry) => entry.disposition === "included");
    if (!included) throw new Error("test projection requires included coverage");
    projection.entries.push({
      ...structuredClone(included),
      projectionRef: "coverage:test-duplicate-case",
    });

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      /Duplicate included caseId/,
    );
  });

  it("rejects an active policy case that loses decision coverage", async () => {
    const projection = await readProjection();
    projection.entries = projection.entries.filter(
      (entry) =>
        !entry.binding?.caseRefs.includes("issue-278:least-authority-boundary-conformance"),
    );

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      "Required Human decision projection is missing: coverage:least-authority-broad-boundary",
    );
  });

  it("rejects deleting a Human decision from both the declared set and projection rows", async () => {
    const projection = await readProjection();
    const removed = "decision:route-ai-comment-ephemeral";
    projection.requiredDecisionRefs = projection.requiredDecisionRefs.filter(
      (decisionRef) => decisionRef !== removed,
    );
    projection.entries = projection.entries.filter(
      (entry) => entry.decisionRef !== removed && !entry.ownedDecisionRefs?.includes(removed),
    );

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      /independently pinned service decision set/,
    );
  });

  it("does not count a related decision as directly covered", async () => {
    const projection = await readProjection();
    const gap = projection.entries.find(
      (entry) => entry.projectionRef === "coverage:gap-artifact-viewer-state",
    );
    if (!gap) throw new Error("test projection requires gap coverage");
    gap.ownedDecisionRefs = ["decision:gap-report-shared-artifact"];
    gap.relatedDecisionRefs = ["decision:gap-reaction-persisted-preference"];

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      "Required Human decision has no direct coverage in coverage:gap-artifact-viewer-state",
    );
  });

  it("rejects moving a required decision onto an unrelated projection row", async () => {
    const projection = await readProjection();
    const moved = "decision:route-ai-comment-ephemeral";
    projection.entries = projection.entries.filter(
      (entry) => !entry.projectionRef.startsWith("coverage:route-ai-comment-"),
    );
    const keyword = projection.entries.find(
      (entry) => entry.projectionRef === "coverage:url-owned-keyword-search-state",
    );
    if (!keyword) throw new Error("test projection requires keyword coverage");
    keyword.ownedDecisionRefs = [keyword.decisionRef, moved];

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      "Required Human decision projection is missing: coverage:route-ai-comment-visible-basis",
    );
  });

  it("rejects missing local evidence references", async () => {
    const projection = await readProjection();
    projection.entries[0].evidenceRefs = ["docs/architecture-fitness/missing.json"];

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      /references a missing local path/,
    );
  });

  it("rejects executable bindings on unsupported coverage", async () => {
    const projection = await readProjection();
    const unsupported = projection.entries.find((entry) => entry.disposition === "unsupported");
    if (!unsupported) throw new Error("test projection requires unsupported coverage");
    unsupported.binding = {
      profileId: "issue-276-search-state-boundary",
      policyCoverageRef: "coverage:issue-276-keyword-search-state-boundary",
      caseRefs: ["issue-276:keyword-search-state-boundary"],
    };

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      /non-included coverage cannot claim a profile or case/,
    );
  });

  it("keeps authority-missing rows free of inferred Human authority", async () => {
    const projection = await readProjection();
    const missing = projection.entries.find((entry) => entry.disposition === "authority-missing");
    if (!missing) throw new Error("test projection requires authority-missing coverage");
    missing.authorityRefs = ["github:corca-ai/lighthouse#implementation-only"];

    await expect(validateArchitectureFitnessCoverageProjection(projection)).rejects.toThrow(
      /authority-missing but declares Human authority/,
    );
  });
});
