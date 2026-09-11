import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";

describe("parameterized state-boundary guard", () => {
  it("evaluates search and relationship policies from one entrypoint", async () => {
    const modulePath = path.resolve(
      process.cwd(),
      "scripts/architecture-fitness/check-state-boundaries.mjs",
    );
    const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
      runStateBoundaryGuard: (options?: { root?: string; surface?: string }) => Promise<{
        ok: boolean;
        results: Record<string, { ok: boolean }>;
      }>;
    };

    const result = await runStateBoundaryGuard();

    expect(result.ok).toBe(true);
    expect(Object.keys(result.results)).toEqual(["search", "relationship"]);
    expect(result.results.search.ok).toBe(true);
    expect(result.results.relationship.ok).toBe(true);
  }, 30_000);

  it.each([
    ["search", ["search"]],
    ["relationship", ["relationship"]],
  ] as const)(
    "evaluates the %s surface independently",
    async (surface, expectedKeys) => {
      const modulePath = path.resolve(
        process.cwd(),
        "scripts/architecture-fitness/check-state-boundaries.mjs",
      );
      const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
        runStateBoundaryGuard: (options: { surface: string }) => Promise<{
          ok: boolean;
          results: Record<string, { ok: boolean }>;
        }>;
      };

      const result = await runStateBoundaryGuard({ surface });

      expect(result.ok).toBe(true);
      expect(Object.keys(result.results)).toEqual(expectedKeys);
      expect(result.results[surface].ok).toBe(true);
    },
    30_000,
  );

  it("rejects an unknown surface", async () => {
    const modulePath = path.resolve(
      process.cwd(),
      "scripts/architecture-fitness/check-state-boundaries.mjs",
    );
    const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
      runStateBoundaryGuard: (options: { surface: string }) => Promise<unknown>;
    };

    await expect(runStateBoundaryGuard({ surface: "unknown" })).rejects.toThrow(
      "Unknown state-boundary surface: unknown",
    );
  });

  it("returns structured surface failures when shared analysis creation fails", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "state-boundary-orchestrator-fallback-"));
    try {
      await mkdir(path.join(root, "app"), { recursive: true });
      await writeFile(path.join(root, "tsconfig.json"), "{", "utf8");
      const modulePath = path.resolve(
        process.cwd(),
        "scripts/architecture-fitness/check-state-boundaries.mjs",
      );
      const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
        runStateBoundaryGuard: (options: { root: string }) => Promise<{
          ok: boolean;
          results: Record<
            string,
            { ok: boolean; missing: string[]; violations: Array<{ errors: string[] }> }
          >;
        }>;
      };

      const result = await runStateBoundaryGuard({ root });

      expect(result.ok).toBe(false);
      expect(Object.keys(result.results)).toEqual(["search", "relationship"]);
      for (const surface of Object.values(result.results)) {
        expect(surface.ok).toBe(false);
        expect(surface.missing.length).toBeGreaterThan(0);
        expect(surface.violations.length).toBeGreaterThan(0);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("shares one requested-root analysis and keeps a single-surface failure aggregated", async () => {
    const modulePath = path.resolve(
      process.cwd(),
      "scripts/architecture-fitness/check-state-boundaries.mjs",
    );
    const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
      runStateBoundaryGuard: (
        options: { root: string; surface?: string },
        dependencies: {
          createAnalysis: (root: string) => Promise<object>;
          runSearch: (params: { root: string; analysis: object }) => Promise<{ ok: boolean }>;
          runRelationship: (params: {
            root: string;
            analysis: object;
            sharedResult: { ok: boolean };
          }) => Promise<{ ok: boolean }>;
        },
      ) => Promise<{ ok: boolean; results: Record<string, { ok: boolean }> }>;
    };
    const analysis = { revision: "exact-target" };
    const searchResult = { ok: true };
    const relationshipResult = { ok: false };
    const dependencies = {
      createAnalysis: vi.fn(() => Promise.resolve(analysis)),
      runSearch: vi.fn(() => Promise.resolve(searchResult)),
      runRelationship: vi.fn(() => Promise.resolve(relationshipResult)),
    };

    const result = await runStateBoundaryGuard({ root: "/exact-target" }, dependencies);

    expect(dependencies.createAnalysis).toHaveBeenCalledTimes(1);
    expect(dependencies.createAnalysis).toHaveBeenCalledWith("/exact-target");
    expect(dependencies.runSearch).toHaveBeenCalledTimes(1);
    expect(dependencies.runSearch).toHaveBeenCalledWith({ root: "/exact-target", analysis });
    expect(dependencies.runRelationship).toHaveBeenCalledTimes(1);
    expect(dependencies.runRelationship).toHaveBeenCalledWith({
      root: "/exact-target",
      analysis,
      sharedResult: searchResult,
    });
    expect(result).toEqual({
      ok: false,
      results: { search: searchResult, relationship: relationshipResult },
    });
  });

  it("binds relationship-only shared search analysis to the requested root", async () => {
    const modulePath = path.resolve(
      process.cwd(),
      "scripts/architecture-fitness/check-state-boundaries.mjs",
    );
    const { runStateBoundaryGuard } = (await import(pathToFileURL(modulePath).href)) as {
      runStateBoundaryGuard: (
        options: { root: string; surface: string },
        dependencies: {
          createAnalysis: (root: string) => Promise<object>;
          runSearch: (params: { root: string; analysis: object }) => Promise<{ ok: boolean }>;
          runRelationship: (params: {
            root: string;
            analysis: object;
            sharedResult: { ok: boolean };
          }) => Promise<{ ok: boolean }>;
        },
      ) => Promise<{ ok: boolean; results: Record<string, { ok: boolean }> }>;
    };
    const analysis = { revision: "relationship-target" };
    const searchResult = { ok: true };
    const dependencies = {
      createAnalysis: vi.fn(() => Promise.resolve(analysis)),
      runSearch: vi.fn(() => Promise.resolve(searchResult)),
      runRelationship: vi.fn(() => Promise.resolve({ ok: true })),
    };

    const result = await runStateBoundaryGuard(
      { root: "/relationship-target", surface: "relationship" },
      dependencies,
    );

    expect(dependencies.runSearch).toHaveBeenCalledTimes(1);
    expect(dependencies.runSearch).toHaveBeenCalledWith({
      root: "/relationship-target",
      analysis,
    });
    expect(dependencies.runRelationship).toHaveBeenCalledWith({
      root: "/relationship-target",
      analysis,
      sharedResult: searchResult,
    });
    expect(result.ok).toBe(true);
    expect(Object.keys(result.results)).toEqual(["relationship"]);
  });
});
