import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

async function loadGuard(): Promise<{
  RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES: Record<string, string>;
  relationshipStateBoundaryInventoryFiles: <T extends { relative: string }>(files: T[]) => T[];
  runRelationshipStateBoundaryGuard: (params?: { root?: string }) => Promise<{
    ok: boolean;
    filesScanned: number;
    missing: string[];
    violations: Array<{ rule: string; errors: string[] }>;
  }>;
}> {
  const modulePath = path.join(
    repoRoot,
    "scripts/architecture-fitness/check-relationship-state-boundaries.mjs",
  );
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function loadSearchGuard(): Promise<{
  SEARCH_STATE_BOUNDARY_SOURCE_FILES: Record<string, string>;
  createSearchStateBoundaryAnalysis: (root: string) => Promise<{
    files: Array<{ relative: string }>;
  }>;
}> {
  const modulePath = path.join(
    repoRoot,
    "scripts/architecture-fitness/check-search-state-boundaries.mjs",
  );
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function materializeCurrentStateBoundarySources(root: string): Promise<void> {
  const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES } = await loadGuard();
  const { SEARCH_STATE_BOUNDARY_SOURCE_FILES } = await loadSearchGuard();
  const relativeFiles = new Set([
    ...Object.values(SEARCH_STATE_BOUNDARY_SOURCE_FILES),
    ...Object.values(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES),
  ]);
  for (const relative of relativeFiles) {
    const destination = path.join(root, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(path.join(repoRoot, relative), "utf8"), "utf8");
  }
  await writeFile(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"jsx":"preserve","module":"ESNext","moduleResolution":"Bundler","paths":{"@/*":["./*"]}}}',
    "utf8",
  );
}

async function loadCollector(): Promise<{
  RELATIONSHIP_STATE_NEGATIVE_MUTATIONS: ReadonlyArray<{
    rule: string;
    relative: string;
    before: string;
  }>;
}> {
  const modulePath = path.join(
    repoRoot,
    "scripts/architecture-fitness/collect-relationship-state-boundary.mjs",
  );
  return (await import(pathToFileURL(modulePath).href)) as never;
}

describe("relationship state-boundary collector guard", () => {
  it("accepts the current URL seed, canonical identity, and route-owned result boundaries", async () => {
    const { runRelationshipStateBoundaryGuard } = await loadGuard();

    const result = await runRelationshipStateBoundaryGuard({ root: repoRoot });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    expect(result.violations).toEqual([]);
  }, 30_000);

  it("keeps every negative mutation anchored to exactly one current source target", async () => {
    const { RELATIONSHIP_STATE_NEGATIVE_MUTATIONS } = await loadCollector();

    for (const mutation of RELATIONSHIP_STATE_NEGATIVE_MUTATIONS) {
      const source = await readFile(path.join(repoRoot, mutation.relative), "utf8");
      const occurrences = source.split(mutation.before).length - 1;
      expect(occurrences, `${mutation.rule} mutation target drifted in ${mutation.relative}`).toBe(
        1,
      );
    }
  });

  it("keeps relationship-only dotted test helpers in the shared production discovery", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-discovery-"));
    try {
      const relative = "app/server/services/parallel.test.helper.ts";
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await writeFile(
        path.join(root, relative),
        'export { buildEphemeralCitationLineageViewId } from "@/app/server/services/ephemeral-view-id";\n',
        "utf8",
      );
      await writeFile(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","paths":{"@/*":["./*"]}}}',
        "utf8",
      );
      const { createSearchStateBoundaryAnalysis } = await loadSearchGuard();
      const { relationshipStateBoundaryInventoryFiles } = await loadGuard();

      const analysis = await createSearchStateBoundaryAnalysis(root);
      const relationshipFiles = relationshipStateBoundaryInventoryFiles(analysis.files);

      expect(analysis.files.map((file) => file.relative)).toContain(relative);
      expect(relationshipFiles.map((file) => file.relative)).toContain(relative);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves declared sources and the inventory cause when analysis creation fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-fallback-"));
    try {
      const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES, runRelationshipStateBoundaryGuard } =
        await loadGuard();
      for (const relative of Object.values(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES)) {
        const file = path.join(root, relative);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "export {};\n", "utf8");
      }
      await writeFile(path.join(root, "tsconfig.json"), "{", "utf8");

      const result = await runRelationshipStateBoundaryGuard({ root });
      const errors = result.violations.flatMap((violation) => violation.errors);

      expect(result.ok).toBe(false);
      expect(result.missing).toEqual([]);
      expect(result.filesScanned).toBe(
        Object.keys(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES).length,
      );
      expect(errors.some((error) => error.startsWith("production inventory failed:"))).toBe(true);
      expect(errors).not.toContain("relationship route source missing");
      expect(errors).not.toContain("relationship execution source missing");
      expect(errors).not.toContain("ephemeral constants source missing");
      expect(errors).not.toContain("relationship runtime wrapper source missing");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a nested healthy decoy before a corrupted top-level relationship normalizer", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-top-level-owner-"));
    try {
      await materializeCurrentStateBoundarySources(root);
      const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES, runRelationshipStateBoundaryGuard } =
        await loadGuard();
      const file = path.join(root, RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution);
      const source = await readFile(file, "utf8");
      const original = `function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}`;
      const mutated = `function nestedDecoy() {
  function firstParam(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
  }
  return firstParam;
}
void nestedDecoy;
function firstParam(value: string | string[] | undefined): string | undefined {
  return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";
}`;
      expect(source.split(original)).toHaveLength(2);
      await writeFile(file, source.replace(original, mutated), "utf8");

      const result = await runRelationshipStateBoundaryGuard({ root });

      expect(result.ok).toBe(false);
      expect(result.violations.map((item) => item.rule)).toContain(
        "relationship-url-to-execution-projection",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("rejects an additional protected identity owner behind a production file symlink", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-symlink-"));
    try {
      const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES, runRelationshipStateBoundaryGuard } =
        await loadGuard();
      for (const relative of Object.values(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES)) {
        const file = path.join(root, relative);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "export {};\n", "utf8");
      }
      await writeFile(
        path.join(root, RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution),
        `
import { buildEphemeralCitationLineageViewId } from "@/app/server/services/ephemeral-view-id";
export function buildCitationIds() {
  buildEphemeralCitationLineageViewId("first");
  buildEphemeralCitationLineageViewId("second");
}
`,
        "utf8",
      );
      const hidden = path.join(root, "app/__tests__/parallel-identity-owner.ts");
      await mkdir(path.dirname(hidden), { recursive: true });
      await writeFile(
        hidden,
        'export { buildEphemeralCitationLineageViewId } from "@/app/server/services/ephemeral-view-id";\n',
        "utf8",
      );
      const linked = path.join(root, "app/server/services/parallel-identity-owner.ts");
      await symlink(path.relative(path.dirname(linked), hidden), linked);
      await writeFile(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","paths":{"@/*":["./*"]}}}',
        "utf8",
      );

      const result = await runRelationshipStateBoundaryGuard({ root });
      const errors = result.violations.flatMap((violation) => violation.errors);

      expect(result.ok).toBe(false);
      expect(errors, JSON.stringify(errors, null, 2)).toContain(
        "app/server/services/parallel-identity-owner.ts: protected module re-export is forbidden",
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed on production directory symlinks instead of omitting their modules", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-directory-symlink-"));
    try {
      const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES, runRelationshipStateBoundaryGuard } =
        await loadGuard();
      for (const relative of Object.values(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES)) {
        const file = path.join(root, relative);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "export {};\n", "utf8");
      }
      const hiddenDirectory = path.join(root, "app/__tests__/hidden-owners");
      await mkdir(hiddenDirectory, { recursive: true });
      await writeFile(
        path.join(hiddenDirectory, "parallel-owner.ts"),
        'export { buildEphemeralCitationLineageViewId } from "@/app/server/services/ephemeral-view-id";\n',
        "utf8",
      );
      const linkedDirectory = path.join(root, "app/server/hidden-owners");
      await mkdir(path.dirname(linkedDirectory), { recursive: true });
      await symlink(path.relative(path.dirname(linkedDirectory), hiddenDirectory), linkedDirectory);
      await writeFile(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","paths":{"@/*":["./*"]}}}',
        "utf8",
      );

      const result = await runRelationshipStateBoundaryGuard({ root });
      const errors = result.violations.flatMap((violation) => violation.errors);

      expect(result.ok).toBe(false);
      expect(
        errors.some((error) =>
          error.includes(
            "production source discovery rejects directory symlink app/server/hidden-owners",
          ),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("fails closed when a production file symlink escapes the materialized root", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relationship-state-external-symlink-"));
    const external = await mkdtemp(path.join(os.tmpdir(), "relationship-state-external-target-"));
    try {
      const { RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES, runRelationshipStateBoundaryGuard } =
        await loadGuard();
      for (const relative of Object.values(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES)) {
        const file = path.join(root, relative);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, "export {};\n", "utf8");
      }
      const externalOwner = path.join(external, "parallel-owner.ts");
      await writeFile(
        externalOwner,
        'export { buildEphemeralCitationLineageViewId } from "@/app/server/services/ephemeral-view-id";\n',
        "utf8",
      );
      const linked = path.join(root, "app/server/services/external-owner.ts");
      await symlink(externalOwner, linked);
      await writeFile(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","paths":{"@/*":["./*"]}}}',
        "utf8",
      );

      const result = await runRelationshipStateBoundaryGuard({ root });
      const errors = result.violations.flatMap((violation) => violation.errors);

      expect(result.ok).toBe(false);
      expect(
        errors.some((error) =>
          error.includes(
            "production source discovery rejects symlink outside materialized root app/server/services/external-owner.ts",
          ),
        ),
      ).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(external, { recursive: true, force: true });
    }
  });
});
