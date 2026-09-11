import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const guardPath = path.resolve(
  process.cwd(),
  "scripts/architecture-fitness/check-search-condition-url-budget.mjs",
);
const collectorPath = path.resolve(
  process.cwd(),
  "scripts/architecture-fitness/collect-search-condition-url-budget.mjs",
);

async function loadGuard(): Promise<{
  runSearchConditionUrlBudgetGuard: (params: { root: string }) => Promise<{
    ok: boolean;
    violations: Array<{ rule: string }>;
    facts: Record<string, boolean>;
  }>;
}> {
  return (await import(pathToFileURL(guardPath).href)) as never;
}

async function loadCollector(): Promise<{
  searchConditionUrlBudgetCollectorCommand: (revision: string, runRef: string) => string;
  compareSearchConditionUrlBudgetHarness: (root: string) => Promise<{
    ok: boolean;
    files: Array<{ ref: string; matches: boolean }>;
  }>;
  assertCompleteSearchConditionUrlBudgetObservation: (observation: {
    evidence: Array<{ id: string; commandExitCode: number }>;
    observations: Array<{ completeness: string }>;
  }) => void;
}> {
  return (await import(pathToFileURL(collectorPath).href)) as never;
}

describe("search condition URL budget guard", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "search-condition-url-budget-"));
    for (const relative of [
      "app/lib/search-condition-url-budget.ts",
      "app/lib/api-routes.ts",
      "app/server/services/search-execution.ts",
      "app/server/services/relationship-execution.ts",
      "app/(research)/search-route-page.tsx",
      "app/(research)/relationship-route-page.tsx",
      "app/components/research/ResearchRouteSearchBar.tsx",
      "app/components/research-route-renderers/search-view-content.tsx",
      "app/lib/__tests__/search-condition-url-budget.test.ts",
      "app/components/research/__tests__/ResearchRouteSearchBar.test.tsx",
      "app/components/research-route-renderers/__tests__/search-view-empty-state-route-selection.test.tsx",
      "app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx",
      "app/components/research-route-renderers/__tests__/SearchView.visible-window.test.tsx",
      "scripts/architecture-fitness/check-search-condition-url-budget.mjs",
      "scripts/architecture-fitness/search-condition-url-budget-probe.ts",
      "scripts/architecture-fitness/__tests__/search-condition-url-budget.test.ts",
      "vitest.config.mts",
      "vitest.setup.ts",
    ]) {
      await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
      await cp(path.resolve(process.cwd(), relative), path.join(root, relative));
    }
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("accepts the shared builder/parser boundary and bypass inventory", async () => {
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    expect(Object.values(result.facts).every(Boolean)).toBe(true);
  });

  it.each([
    ["declaredBoundary", "app/lib/search-condition-url-budget.ts", "8_192", "8_193"],
    [
      "productionSerializerMeasured",
      "app/lib/search-condition-url-budget.ts",
      "utf8ByteLength(requestTarget)",
      "requestTarget.length",
    ],
    [
      "searchParserBeforeIdentity",
      "app/server/services/search-execution.ts",
      "  if (!validateSearchExecutionUrlParams(params).ok) return null;\n",
      "",
    ],
    [
      "relationshipRoutesBeforeProvider",
      "app/(research)/relationship-route-page.tsx",
      '  if (!validateRelationshipSeedUrlParams("similar", params).ok) {\n    return <ConditionUrlRejectedState />;\n  }\n',
      "",
    ],
  ])("rejects %s drift", async (rule, relative, before, after) => {
    const file = path.join(root, relative);
    const source = await readFile(file, "utf8");
    expect(source.split(before).length - 1).toBe(1);
    await writeFile(file, source.replace(before, after), "utf8");
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain(rule);
  });

  it("rejects a production caller that imports a strict builder", async () => {
    const file = path.join(root, "app/lib/direct-condition-bypass.ts");
    await writeFile(
      file,
      `import { searchRoutePageRoute } from "@/app/lib/api-routes";
export const bypass = searchRoutePageRoute({ q: "bypass" });
`,
      "utf8",
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a same-module wrapper that turns a safe result back into a throw", async () => {
    const file = path.join(root, "app/lib/api-routes.ts");
    const source = await readFile(file, "utf8");
    await writeFile(
      file,
      `${source}
export function unsafeConditionRoute(params: SearchRoutePageParams): string {
  const result = buildSearchRoutePageRoute(params);
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain(
      "directBuilderBypassAbsent",
    );
  });

  it("rejects direct condition route assembly inside the route-builder owner", async () => {
    const file = path.join(root, "app/lib/api-routes.ts");
    const source = await readFile(file, "utf8");
    await writeFile(
      file,
      `${source}
export const unsafeDirectSearchRoute = (q: string): string => "/search?" + q;
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects an aliased safe-builder wrapper in another production module", async () => {
    const file = path.join(root, "app/lib/unsafe-condition-wrapper.ts");
    await writeFile(
      file,
      `import { buildSearchRoutePageRoute as buildRoute } from "@/app/lib/api-routes";
export function unsafe(params: { q: string }): string {
  const result = buildRoute(params);
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a const alias with a split throwing helper", async () => {
    await writeFile(
      path.join(root, "app/lib/split-condition-wrapper.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
const make = buildSearchRoutePageRoute;
function requireRoute(result: ReturnType<typeof make>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export const unsafe = (q: string) => requireRoute(make({ q }));
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a namespace-destructured alias with a split throwing helper", async () => {
    await writeFile(
      path.join(root, "app/lib/namespace-condition-wrapper.ts"),
      `import * as routes from "@/app/lib/api-routes";
const { buildSearchRoutePageRoute: makeRoute } = routes;
function requireRoute(result: ReturnType<typeof makeRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export const unsafe = (q: string) => requireRoute(makeRoute({ q }));
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a namespace alias chain before destructuring a safe builder", async () => {
    await writeFile(
      path.join(root, "app/lib/namespace-alias-chain.ts"),
      `import * as routeModule from "@/app/lib/api-routes";
const exportedRoutes = routeModule;
const { buildSearchRoutePageRoute: makeRoute } = exportedRoutes;
function requireRoute(result: ReturnType<typeof makeRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export const unsafe = (q: string) => requireRoute(makeRoute({ q }));
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a safe result stored before a split throwing helper", async () => {
    await writeFile(
      path.join(root, "app/lib/stored-condition-result.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
function requireRoute(result: ReturnType<typeof buildSearchRoutePageRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export function unsafe(q: string): string {
  const result = buildSearchRoutePageRoute({ q });
  return requireRoute(result);
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a safe result stored in an object carrier before a throwing helper", async () => {
    await writeFile(
      path.join(root, "app/lib/object-condition-result.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
function requireRoute(result: ReturnType<typeof buildSearchRoutePageRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export function unsafe(q: string): string {
  const state = { result: buildSearchRoutePageRoute({ q }) };
  return requireRoute(state.result);
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a safe result passed through a multi-hop alias to a throwing helper", async () => {
    await writeFile(
      path.join(root, "app/lib/aliased-condition-result.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
function requireRoute(result: ReturnType<typeof buildSearchRoutePageRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
export function unsafe(q: string): string {
  const first = buildSearchRoutePageRoute({ q });
  const second = first;
  return requireRoute(second);
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a safe result passed through a throwing helper call chain", async () => {
    await writeFile(
      path.join(root, "app/lib/chained-condition-helper.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
function unwrap(result: ReturnType<typeof buildSearchRoutePageRoute>): string {
  if (!result.ok) throw new Error(result.reason);
  return result.route;
}
function requireRoute(result: ReturnType<typeof buildSearchRoutePageRoute>): string {
  return unwrap(result);
}
export const unsafe = (q: string) => requireRoute(buildSearchRoutePageRoute({ q }));
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("allows a non-throwing identity helper to preserve the safe result", async () => {
    await writeFile(
      path.join(root, "app/lib/safe-condition-identity.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
const identity = <T,>(value: T): T => value;
export const safe = (q: string) => identity(buildSearchRoutePageRoute({ q }));
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok, JSON.stringify(result.violations, null, 2)).toBe(true);
  });

  it.each([
    ["template", "export const route = (q: string) => `/search?q=${q}`;"],
    ["concatenation", 'export const route = (q: string) => "/citation?seed=" + q;'],
    ["new URL", 'export const route = (q: string) => new URL("/similar?seed=" + q, "https://x");'],
    [
      "const alias",
      'const prefix = "/search?"; export const route = (q: string) => prefix + "q=" + q;',
    ],
    [
      "chained const alias",
      'const prefix = "/search?"; const routePrefix = prefix; export const route = (q: string) => routePrefix + "q=" + q;',
    ],
  ])("rejects direct condition route assembly through %s", async (_kind, source) => {
    await writeFile(path.join(root, "app/lib/direct-condition-route.ts"), `${source}\n`);
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a production caller that trims q before the safe builder", async () => {
    const file = path.join(root, "app/components/research/ResearchRouteSearchBar.tsx");
    const source = await readFile(file, "utf8");
    expect(source).toContain("q: query,");
    await writeFile(file, source.replace("q: query,", "q: trimmedQuery,"));
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a trim alias regardless of the local variable name", async () => {
    await writeFile(
      path.join(root, "app/lib/normalized-condition-route.ts"),
      `import { buildSearchRoutePageRoute } from "@/app/lib/api-routes";
export function unsafe(query: string) {
  const normalizedQuery = query.trim();
  return buildSearchRoutePageRoute({ q: normalizedQuery });
}
`,
    );
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a result requery that trims q before route commit", async () => {
    const file = path.join(root, "app/components/research-route-renderers/search-view-content.tsx");
    const source = await readFile(file, "utf8");
    expect(source).toContain("q: params.query,");
    await writeFile(file, source.replace("q: params.query,", "q: params.query.trim(),"));
    const { runSearchConditionUrlBudgetGuard } = await loadGuard();

    const result = await runSearchConditionUrlBudgetGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.rule)).toContain("direct-builder-bypass");
  });

  it("rejects a target-controlled decision harness that differs from the authorized base", async () => {
    const { compareSearchConditionUrlBudgetHarness } = await loadCollector();
    expect((await compareSearchConditionUrlBudgetHarness(root)).ok).toBe(true);

    const probe = path.join(
      root,
      "scripts/architecture-fitness/search-condition-url-budget-probe.ts",
    );
    await writeFile(
      probe,
      'process.stdout.write("{\\"boundaries\\":[],\\"measurements\\":[]}");\n',
    );

    const result = await compareSearchConditionUrlBudgetHarness(root);

    expect(result.ok).toBe(false);
    expect(result.files.filter((file) => !file.matches).map((file) => file.ref)).toEqual([
      "scripts/architecture-fitness/search-condition-url-budget-probe.ts",
    ]);
  });

  it("fails closed before publishing a partial observation", async () => {
    const { assertCompleteSearchConditionUrlBudgetObservation } = await loadCollector();

    expect(() => {
      assertCompleteSearchConditionUrlBudgetObservation({
        evidence: [{ id: "failed-test", commandExitCode: 1 }],
        observations: [{ completeness: "partial" }],
      });
    }).toThrow(/failed closed.*failed-test/);
    expect(() => {
      assertCompleteSearchConditionUrlBudgetObservation({
        evidence: [{ id: "passing-test", commandExitCode: 0 }],
        observations: [{ completeness: "complete" }],
      });
    }).not.toThrow();
  });

  it("records the canonical fixture-producing output path in every evidence command", async () => {
    const { searchConditionUrlBudgetCollectorCommand } = await loadCollector();

    expect(searchConditionUrlBudgetCollectorCommand("abc123", "local:abc123")).toBe(
      "node scripts/architecture-fitness/collect-search-condition-url-budget.mjs --policy docs/architecture-fitness/pilots/issue-399-serialized-input-budget.policy.json --revision abc123 --run-ref local:abc123 --output docs/architecture-fitness/pilots/issue-399-serialized-input-budget.observation.json",
    );
  });
});
