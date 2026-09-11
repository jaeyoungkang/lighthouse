import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

async function loadGuard(): Promise<{
  runProductOwnedNavigationGuard: (options?: { root?: string; scanRoots?: string[] }) => Promise<{
    ok: boolean;
    violations: Array<{ file: string; line: number; text: string }>;
  }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-product-owned-navigation.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

describe("product-owned navigation guard", () => {
  it("fails production code that opens an about:blank navigation hold", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-owned-navigation-"));
    try {
      const sourceDir = path.join(root, "app/components/research");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, "bad.ts"),
        'export function open() { window.open("about:blank", "_blank"); }\n',
      );

      const { runProductOwnedNavigationGuard } = await loadGuard();
      const result = await runProductOwnedNavigationGuard({ root });

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          file: "app/components/research/bad.ts",
          line: 1,
        }),
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails multiline and template-literal about:blank navigation holds", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-owned-navigation-"));
    try {
      const sourceDir = path.join(root, "app/components/research");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, "bad.ts"),
        [
          "export function openMultiline() {",
          "  window.open(",
          '    "about:blank",',
          '    "_blank",',
          "  );",
          "}",
          "export function openTemplate() {",
          "  window.open(`about:blank`, `_blank`);",
          "}",
        ].join("\n"),
      );

      const { runProductOwnedNavigationGuard } = await loadGuard();
      const result = await runProductOwnedNavigationGuard({ root });

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual([
        expect.objectContaining({
          file: "app/components/research/bad.ts",
          line: 2,
        }),
        expect.objectContaining({
          file: "app/components/research/bad.ts",
          line: 8,
        }),
      ]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("allows immediate product-owned pending routes", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "product-owned-navigation-"));
    try {
      const sourceDir = path.join(root, "app/components/research");
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, "good.ts"),
        'export function open() { window.open("/gap?opening=1", "_blank"); }\n',
      );

      const { runProductOwnedNavigationGuard } = await loadGuard();
      const result = await runProductOwnedNavigationGuard({ root });

      expect(result.ok).toBe(true);
      expect(result.violations).toEqual([]);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
