import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildSurfaceAuditCounts } from "@/scripts/mission-control/lib/intent-surface-audit";

let tempRoot: string | null = null;

function makeProject(): string {
  tempRoot = mkdtempSync(path.join(tmpdir(), "lighthouse-surface-audit-"));
  mkdirSync(path.join(tempRoot, "scripts", "mission-control"), { recursive: true });
  writeFileSync(
    path.join(tempRoot, "scripts", "mission-control", "surface-allowlist.json"),
    `${JSON.stringify({ infrastructure: [], backfillBacklog: [] }, null, 2)}\n`,
  );
  return tempRoot;
}

function writeProjectFile(root: string, relPath: string, content: string): void {
  const target = path.join(root, relPath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

afterEach(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  tempRoot = null;
});

describe("buildSurfaceAuditCounts", () => {
  it("counts canonical Story Chain tags and ignores @us tags", () => {
    const root = makeProject();
    writeProjectFile(
      root,
      "app/components/research/TaggedPanel.tsx",
      [
        "// @promise promise:search-results-fast-window",
        "// @aspect aspect:library-grounded-research",
        "export function TaggedPanel() { return null; }",
      ].join("\n"),
    );
    writeProjectFile(
      root,
      "app/components/research/LegacyPanel.tsx",
      ["// @us US-SEARCH-01-02", "export function LegacyPanel() { return null; }"].join("\n"),
    );
    writeProjectFile(
      root,
      "app/stores/search-store.ts",
      [
        "// @check acceptance-check:search-results-fast-window-selected-sort",
        "export const mode = 'idle';",
      ].join("\n"),
    );
    writeProjectFile(
      root,
      "app/custom/TaggedOutsidePattern.ts",
      ["// @promise promise:search-results-fast-window", "export const tagged = true;"].join("\n"),
    );

    expect(buildSurfaceAuditCounts(root)).toEqual({
      total: 4,
      tagged: 3,
      infrastructure: 0,
      backfillBacklog: 0,
      orphan: 1,
      orphanPaths: ["app/components/research/LegacyPanel.tsx"],
    });
  });

  it("classifies allowlisted surfaces and excludes test, shared, helper, and non-TypeScript files", () => {
    const root = makeProject();
    writeProjectFile(
      root,
      "scripts/mission-control/surface-allowlist.json",
      `${JSON.stringify(
        {
          infrastructure: ["app/page.tsx"],
          backfillBacklog: ["app/layout.tsx"],
        },
        null,
        2,
      )}\n`,
    );
    writeProjectFile(root, "app/page.tsx", "export default function Page() { return null; }");
    writeProjectFile(root, "app/layout.tsx", "export default function Layout() { return null; }");
    writeProjectFile(root, "app/components/Plain.tsx", "export function Plain() { return null; }");
    writeProjectFile(root, "app/components/Excluded.test.tsx", "export const testOnly = true;");
    writeProjectFile(root, "app/components/Excluded.shared.tsx", "export const shared = true;");
    writeProjectFile(root, "app/components/Excluded.helpers.ts", "export const helper = true;");
    writeProjectFile(root, "app/components/NotTypeScript.js", "export const ignored = true;");

    expect(buildSurfaceAuditCounts(root)).toEqual({
      total: 3,
      tagged: 0,
      infrastructure: 1,
      backfillBacklog: 1,
      orphan: 1,
      orphanPaths: ["app/components/Plain.tsx"],
    });
  });

  it("recognizes only canonical tags inside the first 24 source lines", () => {
    const root = makeProject();
    writeProjectFile(
      root,
      "app/components/InWindow.tsx",
      [
        ...Array.from({ length: 23 }, (_, index) => `// filler ${String(index)}`),
        "// @check intent-check:in-window",
      ].join("\n"),
    );
    writeProjectFile(
      root,
      "app/components/AfterWindow.tsx",
      [
        ...Array.from({ length: 24 }, (_, index) => `// filler ${String(index)}`),
        "// @promise promise:too-late",
      ].join("\n"),
    );
    writeProjectFile(
      root,
      "app/components/Malformed.tsx",
      "// @promise Promise:wrong-case\nexport const malformed = true;",
    );

    expect(buildSurfaceAuditCounts(root)).toEqual({
      total: 3,
      tagged: 1,
      infrastructure: 0,
      backfillBacklog: 0,
      orphan: 2,
      orphanPaths: ["app/components/AfterWindow.tsx", "app/components/Malformed.tsx"],
    });
  });

  it("fails closed to an empty allowlist and an empty app tree", () => {
    const root = makeProject();
    writeProjectFile(root, "scripts/mission-control/surface-allowlist.json", "not-json\n");
    writeProjectFile(root, "app/stores/orphan-store.ts", "export const value = 1;");

    expect(buildSurfaceAuditCounts(root)).toEqual({
      total: 1,
      tagged: 0,
      infrastructure: 0,
      backfillBacklog: 0,
      orphan: 1,
      orphanPaths: ["app/stores/orphan-store.ts"],
    });

    const emptyRoot = mkdtempSync(path.join(tmpdir(), "lighthouse-surface-audit-empty-"));
    rmSync(emptyRoot, { recursive: true, force: true });
    expect(buildSurfaceAuditCounts(emptyRoot)).toEqual({
      total: 0,
      tagged: 0,
      infrastructure: 0,
      backfillBacklog: 0,
      orphan: 0,
      orphanPaths: [],
    });
  });
});
