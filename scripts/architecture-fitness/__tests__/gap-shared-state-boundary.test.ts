import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

type Collector = {
  GAP_STATE_BOUNDARY_SOURCE_FILES: Record<string, string>;
  GAP_STATE_NEGATIVE_MUTATIONS: ReadonlyArray<{
    rule: string;
    relative: string;
    before: string;
  }>;
  executeGapStateNegativeMutationSuite: (root: string) => Promise<{
    exitCode: number;
    artifact: { mutations: Array<{ rule: string; rejected: boolean; error?: string }> };
  }>;
  runGapStateBoundaryGuard: (params?: { root?: string }) => Promise<{
    ok: boolean;
    missing: string[];
    violations: Array<{ rule: string; errors: string[] }>;
    facts: Record<string, boolean>;
  }>;
};

async function loadCollector(): Promise<Collector> {
  const modulePath = path.join(
    repoRoot,
    "scripts/architecture-fitness/collect-gap-shared-state-boundary.mjs",
  );
  return (await import(pathToFileURL(modulePath).href)) as Collector;
}

async function materializeDeclaredSources(root: string, collector: Collector): Promise<void> {
  for (const relative of Object.values(collector.GAP_STATE_BOUNDARY_SOURCE_FILES)) {
    const destination = path.join(root, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(repoRoot, relative), "utf8"), "utf8");
  }
}

describe("gap shared-artifact state-boundary collector", () => {
  it("accepts the creator-less artifact, viewer preference, identities, and destination carrier", async () => {
    const collector = await loadCollector();
    const result = await collector.runGapStateBoundaryGuard({ root: repoRoot });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.facts).toEqual({
      "creator-less-shared-artifact": true,
      "viewer-scoped-preference": true,
      "retired-gap-owner-alias": true,
      "canonical-gap-source-digest": true,
      "destination-owned-gap-handoff": true,
    });
  }, 30_000);

  it("keeps every mutation anchored to exactly one exact-revision source target", async () => {
    const collector = await loadCollector();

    for (const mutation of collector.GAP_STATE_NEGATIVE_MUTATIONS) {
      const source = await readFile(path.join(repoRoot, mutation.relative), "utf8");
      expect(
        source.split(mutation.before).length - 1,
        `${mutation.rule} mutation target drifted in ${mutation.relative}`,
      ).toBe(1);
    }
  });

  it("rejects ownership, identity, tuple, and handoff regressions", async () => {
    const collector = await loadCollector();
    const root = await mkdtemp(path.join(os.tmpdir(), "gap-state-negative-"));
    try {
      await materializeDeclaredSources(root, collector);
      const result = await collector.executeGapStateNegativeMutationSuite(root);

      expect(result.exitCode, JSON.stringify(result, null, 2)).toBe(0);
      expect(result.artifact.mutations).toHaveLength(collector.GAP_STATE_NEGATIVE_MUTATIONS.length);
      expect(result.artifact.mutations.every((item) => item.rejected)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects a second direct table owner outside the repository", async () => {
    const collector = await loadCollector();
    const root = await mkdtemp(path.join(os.tmpdir(), "gap-state-owner-inventory-"));
    try {
      await materializeDeclaredSources(root, collector);
      const decoy = path.join(root, "app/server/parallel-gap-owner.ts");
      await mkdir(path.dirname(decoy), { recursive: true });
      await writeFile(
        decoy,
        'export const read = (db: any) => db.from("gap_reports").select("*");\n',
        "utf8",
      );

      const result = await collector.runGapStateBoundaryGuard({ root });
      expect(result.ok).toBe(false);
      expect(result.violations).toContainEqual(
        expect.objectContaining({ rule: "creator-less-shared-artifact" }),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
