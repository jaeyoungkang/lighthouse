import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

async function loadGuard(): Promise<{
  validateRouteDeadlineBudget: (root?: string) => Promise<{
    ok: boolean;
    routeCount: number;
    violations: Array<{ file: string; line: number; message: string }>;
  }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-route-deadline-budget.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

describe("route deadline budget guard", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "route-deadline-budget-"));
  });

  afterEach(async () => {
    await rm(root, { force: true, recursive: true });
  });

  it("checks Route Handlers outside app/api", async () => {
    await mkdir(path.join(root, "app/auth/callback"), { recursive: true });
    await writeFile(
      path.join(root, "app/auth/callback/route.ts"),
      "export async function GET() { return new Response(); }\n",
    );
    const { validateRouteDeadlineBudget } = await loadGuard();

    const result = await validateRouteDeadlineBudget(root);

    expect(result.routeCount).toBe(1);
    expect(result.violations).toEqual([
      expect.objectContaining({
        file: "app/auth/callback/route.ts",
        line: 1,
      }),
    ]);
  });

  it("accepts a bounded Route Handler outside app/api", async () => {
    await mkdir(path.join(root, "app/auth/callback"), { recursive: true });
    await writeFile(
      path.join(root, "app/auth/callback/route.ts"),
      "export const maxDuration = 15;\nexport async function GET() { return new Response(); }\n",
    );
    const { validateRouteDeadlineBudget } = await loadGuard();

    await expect(validateRouteDeadlineBudget(root)).resolves.toEqual({
      ok: true,
      routeCount: 1,
      violations: [],
    });
  });
});
