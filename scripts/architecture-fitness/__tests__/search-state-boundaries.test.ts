import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const guardPath = path.resolve(
  process.cwd(),
  "scripts/architecture-fitness/check-search-state-boundaries.mjs",
);

async function loadGuard(): Promise<{
  runSearchStateBoundaryGuard: (params: { root: string }) => Promise<{
    ok: boolean;
    violations: Array<{ rule: string }>;
    facts: Record<string, boolean>;
  }>;
}> {
  return (await import(pathToFileURL(guardPath).href)) as never;
}

async function loadCollector(): Promise<{
  SEARCH_STATE_NEGATIVE_MUTATIONS: ReadonlyArray<{
    rule: string;
    relative: string;
    before: string;
  }>;
}> {
  const collectorPath = path.resolve(
    process.cwd(),
    "scripts/architecture-fitness/collect-search-state-boundary.mjs",
  );
  return (await import(pathToFileURL(collectorPath).href)) as never;
}

describe("search state-boundary collector guard", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "search-state-boundary-"));
    await writeHealthySources(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("accepts URL authority, canonical identity, and route-owned snapshot lifecycle", async () => {
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("keeps every collector mutation anchored to exactly one current source target", async () => {
    const { SEARCH_STATE_NEGATIVE_MUTATIONS } = await loadCollector();

    for (const mutation of SEARCH_STATE_NEGATIVE_MUTATIONS) {
      const source = await readFile(path.resolve(process.cwd(), mutation.relative), "utf8");
      const occurrences = source.split(mutation.before).length - 1;
      expect(occurrences, `${mutation.rule} mutation target drifted in ${mutation.relative}`).toBe(
        1,
      );
    }
  });

  it.each([
    [
      "url-condition-authority",
      "app/components/research/ResearchRouteSearchBar.tsx",
      "return urlSeed ?? getShellQuerySeed(activeView);",
      "return getShellQuerySeed(activeView) || urlSeed;",
    ],
    [
      "url-to-execution-projection",
      "app/(research)/search-route-page.tsx",
      "    input,",
      '    input: { ...input, query: "collector-bypass" },',
    ],
    [
      "canonical-ephemeral-view-identity",
      "app/server/services/search-execution.ts",
      "id: buildEphemeralSearchViewId(params.input.canonicalKey),",
      "id: buildEphemeralSearchViewId(params.metadata.updatedAt),",
    ],
    [
      "route-owned-result-snapshot",
      "app/components/research/ResearchRouteRuntime.tsx",
      "clearCurrentView(executionId);",
      "void executionId;",
    ],
  ])("rejects %s drift", async (rule, relative, before, after) => {
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(file, source.replace(before, after), "utf8");
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(rule);
  });

  it.each([
    [
      "url-condition-authority",
      "app/components/research/ResearchRouteSearchBar.tsx",
      "    const urlSeed =",
      "    if (activeView) return getShellQuerySeed(activeView);\n    const urlSeed =",
    ],
    [
      "url-to-execution-projection",
      "app/(research)/search-route-page.tsx",
      "  return executeSearchFromUrl({",
      '  void executeSearchFromUrl({ ownerPrincipalId: "parallel", input });\n  return executeSearchFromUrl({',
    ],
    [
      "canonical-ephemeral-view-identity",
      "app/server/services/ephemeral-view-id.ts",
      'createHash("sha256").update(canonicalKey, "utf8").digest("hex")',
      '"0".repeat(64)',
    ],
    [
      "route-owned-result-snapshot",
      "app/components/research/ResearchRouteRuntime.tsx",
      "    setCurrentView(initialRouteView, executionId);",
      '    useResearchRouteStore.getState().setCurrentView(initialRouteView, "parallel");\n    setCurrentView(initialRouteView, executionId);',
    ],
  ])(
    "rejects parallel %s paths that preserve the required path",
    async (rule, relative, before, after) => {
      const file = path.join(root, relative);
      const source = await import("node:fs/promises").then(({ readFile }) =>
        readFile(file, "utf8"),
      );
      await writeFile(file, source.replace(before, after), "utf8");
      const { runSearchStateBoundaryGuard } = await loadGuard();

      const result = await runSearchStateBoundaryGuard({ root });

      expect(result.ok).toBe(false);
      expect(result.violations.map((item) => item.rule)).toContain(rule);
    },
  );

  it("rejects a constant-aliased dynamic identity owner", async () => {
    const relative = "app/server/services/parallel-identity.ts";
    const file = path.join(root, relative);
    await writeFile(
      file,
      `
const moduleRef = "@/app/server/services/ephemeral-view-id";
export async function parallelIdentity(updatedAt) {
  const { buildEphemeralSearchViewId: deriveViewId } = await import(moduleRef);
  return deriveViewId(updatedAt);
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it("rejects an alias-backed alternate production identity builder", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source
        .replace(
          "function buildEphemeralDocument(params) {",
          `function buildAlternateEphemeralDocument(params) {
  const deriveViewId = buildEphemeralSearchViewId;
  return { id: deriveViewId(params.metadata.updatedAt) };
}

function buildEphemeralDocument(params) {`,
        )
        .replace("view: buildEphemeralDocument({", "view: buildAlternateEphemeralDocument({"),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it("rejects undeclared runtime authority inside URL normalization", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        'const query = (firstParam(params.q) ?? "").trim();',
        'const query = (process.env.SEARCH_QUERY_OVERRIDE ?? firstParam(params.q) ?? "").trim();',
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects runtime authority hidden behind a new URL normalization helper", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source
        .replace(
          "export function buildSearchExecutionFromUrlParams(params) {",
          `function resolveRuntimeQuery(query) {
  return process.env.SEARCH_QUERY_OVERRIDE ?? query;
}
export function buildSearchExecutionFromUrlParams(params) {`,
        )
        .replace(
          "const input = { query, sort, facetFilters, ...parseSearchEntrySeeds(params, query) };",
          "const input = { query: resolveRuntimeQuery(query), sort, facetFilters, ...parseSearchEntrySeeds(params, query) };",
        ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects nondeterminism hidden inside the first URL parameter helper", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        "return Array.isArray(value) ? value[0] : value;",
        'return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";',
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects a nested healthy decoy before a corrupted top-level URL normalizer", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source
        .replace(
          "return Array.isArray(value) ? value[0] : value;",
          'return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";',
        )
        .replace(
          "function firstParam(value) {",
          `function nestedDecoy() {
  function firstParam(value) {
    return Array.isArray(value) ? value[0] : value;
  }
  return firstParam;
}
void nestedDecoy;
function firstParam(value) {`,
        ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects replacing the first URL parameter helper with an import", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const helper = path.join(root, "app/server/services/runtime-query.ts");
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      helper,
      `export function firstParam(value) {
  return Date.now() % 2 ? (Array.isArray(value) ? value[0] : value) : "runtime";
}
`,
      "utf8",
    );
    await writeFile(
      file,
      source.replace(
        `function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}`,
        'import { firstParam } from "@/app/server/services/runtime-query";',
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("allows unrelated pure helpers with runtime-like local names", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        "function firstParam(value) {",
        `function preserveLocalName(process) {
  return process;
}
void preserveLocalName;
function firstParam(value) {`,
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
  });

  it.each([
    [
      "namespace import",
      'import * as Array from "@/app/server/services/runtime-array";\n',
      `export function isArray() {
  return Date.now() % 2 === 0;
}
`,
    ],
    [
      "namespace declaration",
      `namespace Array {
  export function isArray() {
    return Date.now() % 2 === 0;
  }
}
`,
      null,
    ],
    ["enum declaration", "enum Array { isArray }\n", null],
  ])("rejects %s shadowing of the standard Array normalizer", async (_label, prefix, helper) => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    if (helper) {
      await writeFile(path.join(root, "app/server/services/runtime-array.ts"), helper, "utf8");
    }
    await writeFile(file, `${prefix}${source}`, "utf8");
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects runtime authority added by the imported facet normalizer", async () => {
    const relative = "app/domain/search-facets.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        "authors: normalizeList(filters?.authors),",
        "authors: process.env.SEARCH_AUTHOR_OVERRIDE ? [process.env.SEARCH_AUTHOR_OVERRIDE] : normalizeList(filters?.authors),",
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects a local Set capability shadowing facet normalization", async () => {
    const relative = "app/domain/search-facets.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      `
const NativeSet = globalThis.Set;
class Set<T> extends NativeSet<T> {
  override add(value: T) {
    return super.add(process.env.SEARCH_FACET_OVERRIDE ? ("runtime" as T) : value);
  }
}
${source}`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects locale-sensitive facet ordering", async () => {
    const relative = "app/domain/search-facets.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        "return [...seen].sort();",
        "return [...seen].sort((left, right) => left.localeCompare(right));",
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects non-static dynamic module acquisition", async () => {
    const relative = "app/server/services/runtime-module.ts";
    const file = path.join(root, relative);
    await writeFile(
      file,
      `
export async function loadRuntimeModule(name: string) {
  return import(name);
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
    expect(result.facts).toMatchObject({
      "url-to-execution-projection": false,
      "canonical-ephemeral-view-identity": false,
      "route-owned-result-snapshot": false,
    });
  });

  it("includes JavaScript modules in the protected-call owner inventory", async () => {
    const relative = "app/server/services/parallel-identity-owner.js";
    const file = path.join(root, relative);
    await writeFile(
      file,
      `
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";
export function buildParallelIdentity(canonicalKey) {
  return buildEphemeralSearchViewId(canonicalKey);
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it.each([
    [
      "a __tests__ module",
      "./__tests__/hidden-identity-owner",
      "__tests__/hidden-identity-owner.ts",
    ],
    ["a .test module", "./hidden-identity-owner.test", "hidden-identity-owner.test.js"],
  ])("rejects production acquisition of %s", async (_label, specifier, hiddenRelative) => {
    const bridge = path.join(root, "app/server/services/hidden-identity-bridge.ts");
    const hidden = path.join(root, "app/server/services", hiddenRelative);
    await mkdir(path.dirname(hidden), { recursive: true });
    await writeFile(
      hidden,
      `
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";
export function buildHiddenIdentity(canonicalKey) {
  return buildEphemeralSearchViewId(canonicalKey);
}
`,
      "utf8",
    );
    await writeFile(
      bridge,
      `
import { buildHiddenIdentity } from "${specifier}";
export { buildHiddenIdentity };
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining([
        "url-to-execution-projection",
        "canonical-ephemeral-view-identity",
        "route-owned-result-snapshot",
      ]),
    );
  });

  it.each([
    ["module.require", 'const hidden = module.require("./hidden-commonjs-owner.test");'],
    [
      "an aliased require capability",
      'const load = require; const hidden = load("./hidden-commonjs-owner.test");',
    ],
  ])("rejects test-module acquisition through %s", async (_label, acquisition) => {
    const bridge = path.join(root, "app/server/services/commonjs-identity-bridge.cjs");
    const hidden = path.join(root, "app/server/services/hidden-commonjs-owner.test.js");
    await writeFile(
      hidden,
      `
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";
export function buildHiddenIdentity(canonicalKey) {
  return buildEphemeralSearchViewId(canonicalKey);
}
`,
      "utf8",
    );
    await writeFile(bridge, `${acquisition}\nmodule.exports = hidden;\n`, "utf8");
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.facts).toMatchObject({
      "url-to-execution-projection": false,
      "canonical-ephemeral-view-identity": false,
      "route-owned-result-snapshot": false,
    });
  });

  it("fails every inventory-owned fact closed when production inventory cannot run", async () => {
    await writeFile(path.join(root, "tsconfig.json"), "{", "utf8");
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.facts).toMatchObject({
      "url-to-execution-projection": false,
      "canonical-ephemeral-view-identity": false,
      "route-owned-result-snapshot": false,
    });
  });

  it("rejects reassignment of the standard Array.isArray normalizer capability", async () => {
    const relative = "app/server/services/search-execution.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      `${source}\nif (process.env.SEARCH_ARRAY_OVERRIDE) Array.isArray = () => true;\n`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("url-to-execution-projection");
  });

  it("rejects runtime-dependent canonical identity prefixes", async () => {
    const relative = "app/server/services/ephemeral-view-id.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        "return `${EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`;",
        "return `${process.env.SEARCH_VIEW_ID_NAMESPACE ?? EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`;",
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it("rejects runtime authority in the canonical identity prefix owner", async () => {
    const relative = "app/lib/ephemeral-search-view.ts";
    const file = path.join(root, relative);
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      file,
      source.replace(
        'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "search-ephemeral-";',
        'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = process.env.VERCEL_ENV ?? "search-ephemeral-";',
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it("keeps the shared digest fact independent from the keyword prefix", async () => {
    const relative = "app/lib/ephemeral-search-view.ts";
    const file = path.join(root, relative);
    const source = await readFile(file, "utf8");
    await writeFile(
      file,
      source.replace(
        'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "search-ephemeral-";',
        'export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "keyword-only-drift-";',
      ),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.facts).toMatchObject({
      "canonical-identity-digest-implementation": true,
      "canonical-ephemeral-view-identity": false,
    });
  });

  it("rejects a non-node crypto identity hash provider", async () => {
    const relative = "app/server/services/ephemeral-view-id.ts";
    const file = path.join(root, relative);
    const helper = path.join(root, "app/server/services/runtime-hash.ts");
    const source = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8"));
    await writeFile(
      helper,
      `
export function createHash() {
  return {
    update() {
      return { digest() { return process.env.RUNTIME_DIGEST ?? "0".repeat(64); } };
    },
  };
}
`,
      "utf8",
    );
    await writeFile(
      file,
      source.replace('from "node:crypto"', 'from "@/app/server/services/runtime-hash"'),
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain(
      "canonical-ephemeral-view-identity",
    );
  });

  it("rejects direct store setState writes", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function overwrite(view, executionId) {
  useResearchRouteStore.setState({ currentView: view });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects destructured computed currentView writers", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function overwrite(view, executionId) {
  const state = useResearchRouteStore.getState();
  const { ["set" + "CurrentView"]: write } = state;
  write(view, executionId);
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects destructured store setState aliases", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
const { setState: replaceRouteState } = useResearchRouteStore;
export function overwrite(view) {
  replaceRouteState({ currentView: view });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects computed store setState aliases", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
const method = "set" + "State";
const replaceRouteState = useResearchRouteStore[method];
export function overwrite(view) {
  replaceRouteState({ currentView: view });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects reflective store setState access", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function overwrite(view) {
  Reflect.get(useResearchRouteStore, "setState")({ currentView: view });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects reflective route-state action access", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function overwrite(view) {
  Reflect.get(useResearchRouteStore.getState(), "setCurrentView")(view, "parallel");
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects aliased reflective route-state action access", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
const read = Reflect.get;
export function overwrite(view) {
  read(useResearchRouteStore.getState(), "setCurrentView")(view, "parallel");
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects dynamic reflective keys on route-state targets", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
const action = process.env.ROUTE_ACTION ?? "setCurrentView";
export function overwrite(view) {
  Reflect.get(useResearchRouteStore.getState(), action)(view, "parallel");
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects Object.assign writes to route-owned currentView", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function overwrite(view) {
  Object.assign(useResearchRouteStore.getState(), { currentView: view });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("rejects aliased Object.assign writes from identifier and spread patches", async () => {
    const relative = "app/components/research/background-parallel-write.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
const assign = Object.assign;
export function overwrite(view) {
  const patch = { currentView: view };
  assign(useResearchRouteStore.getState(), { ...patch });
}
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toContain("route-owned-result-snapshot");
  });

  it("allows aliased Reflect and Object.assign calls on unrelated objects", async () => {
    const relative = "app/lib/unrelated-view-cache.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
const unrelated = { currentView: null, setCurrentView() {} };
const read = Reflect.get;
const assign = Object.assign;
read(unrelated, "setCurrentView")();
assign(unrelated, { currentView: "next" });
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("allows unrelated objects with the same method names", async () => {
    const relative = "app/lib/unrelated-view-cache.ts";
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      `
const unrelated = { setCurrentView() {}, clearCurrentView() {} };
unrelated.setCurrentView();
unrelated.clearCurrentView();
`,
      "utf8",
    );
    const { runSearchStateBoundaryGuard } = await loadGuard();

    const result = await runSearchStateBoundaryGuard({ root });

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
  });
});

async function writeHealthySources(root: string): Promise<void> {
  const sources: Record<string, string> = {
    "app/components/research/ResearchRouteSearchBar.tsx": `
export function ResearchRouteSearchBar() {
  const activeView = useResearchRouteStore((state) => state.currentView);
  const baseSeedQuery = (() => {
    const urlSeed = getUrlQuerySeed(pathname, new URLSearchParams(searchParamString));
    return urlSeed ?? getShellQuerySeed(activeView);
  })();
  const route = searchRoutePageRoute({ query: baseSeedQuery });
  router.push(route, { scroll: false });
}
`,
    "app/(research)/search-route-page.tsx": `
import {
  buildSearchExecutionFromUrlParams,
  executeSearchFromUrl,
} from "@/app/server/services/search-execution";

async function ResolvedSearchRoute({ input }) {
  return executeSearchFromUrl({
    ownerPrincipalId: "user-1",
    input,
  });
}

export async function SearchRoutePage({ searchParams }) {
  const params = await searchParams;
  const input = buildSearchExecutionFromUrlParams(params);
  return ResolvedSearchRoute({ input });
}
`,
    "app/server/services/search-execution.ts": `
import { normalizeSearchFacetFilters } from "@/app/domain/search-facets";
import { buildEphemeralSearchViewId } from "@/app/server/services/ephemeral-view-id";

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}
function allParams(value) {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}
function appendCanonicalValues(searchParams, key, values) {
  for (const value of values.map((entry) => entry.trim()).filter(Boolean).sort()) {
    searchParams.append(key, value);
  }
}
const SEARCH_SORT_OPTIONS = new Set(["relevance", "year"]);
const TERM_SEED_CANDIDATE_TYPES = new Set(["direct"]);
function buildCanonicalSearchExecutionKey(input) {
  const searchParams = new URLSearchParams();
  searchParams.set("q", input.query);
  appendCanonicalValues(searchParams, "field", input.facetFilters?.fieldsOfStudy ?? []);
  return searchParams.toString();
}
function parseSearchEntrySeeds(params, query) {
  const term = firstParam(params.term);
  if (term && TERM_SEED_CANDIDATE_TYPES.has("direct")) return { termSeed: { term, query } };
  return {};
}
export function buildSearchExecutionFromUrlParams(params) {
  const query = (firstParam(params.q) ?? "").trim();
  if (!query) return null;
  const sortParam = firstParam(params.sort);
  const sort = SEARCH_SORT_OPTIONS.has(sortParam) ? sortParam : undefined;
  const facetFilters = normalizeSearchFacetFilters({ fieldsOfStudy: allParams(params.field) });
  const input = { query, sort, facetFilters, ...parseSearchEntrySeeds(params, query) };
  return { ...input, canonicalKey: buildCanonicalSearchExecutionKey(input) };
}
function buildEphemeralDocument(params) {
  return {
    id: buildEphemeralSearchViewId(params.input.canonicalKey),
    metadata: params.metadata,
  };
}
export function buildPendingSearchViewFromInput(params) {
  return buildEphemeralDocument({
    ownerPrincipalId: params.ownerPrincipalId,
    input: params.input,
    metadata: {},
    status: "pending",
  });
}
export async function executeSearchFromUrl({ input }) {
  try {
    return {
      view: buildEphemeralDocument({ input, metadata: { updatedAt: "ready" } }),
      executed: true,
    };
  } catch {
    return {
      view: buildEphemeralDocument({ input, metadata: { updatedAt: "failed" } }),
      executed: false,
    };
  }
}
`,
    "app/domain/search-facets.ts": `
export interface SearchFacetFilters {
  fieldsOfStudy: string[];
  authors: string[];
  venues: string[];
  hasPdf: boolean;
}
function normalizeList(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length > 0) seen.add(trimmed);
  }
  return [...seen].sort();
}
export function normalizeSearchFacetFilters(
  filters: Partial<SearchFacetFilters> | undefined,
): SearchFacetFilters {
  return {
    fieldsOfStudy: normalizeList(filters?.fieldsOfStudy),
    authors: normalizeList(filters?.authors),
    venues: normalizeList(filters?.venues),
    hasPdf: filters?.hasPdf === true,
  };
}
`,
    "app/server/services/ephemeral-view-id.ts": `
import { createHash } from "node:crypto";
import { EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX } from "@/app/lib/ephemeral-search-view";
function canonicalIdentityDigest(canonicalKey) {
  return createHash("sha256").update(canonicalKey, "utf8").digest("hex");
}
export function buildEphemeralSearchViewId(canonicalKey) {
  return \`\${EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX}\${canonicalIdentityDigest(canonicalKey)}\`;
}
`,
    "app/lib/ephemeral-search-view.ts": `
export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "search-ephemeral-";
`,
    "app/stores/research-route-store.ts": `
interface ResearchRouteState {
  currentView: unknown;
  setCurrentView: (view: unknown, executionId: string) => void;
  clearCurrentView: (executionId: string) => void;
  patchCurrentView: (view: unknown, executionId: string) => boolean;
}
interface ResearchRouteStore {
  <T>(selector: (state: ResearchRouteState) => T): T;
  getState(): ResearchRouteState;
  setState(patch: Partial<ResearchRouteState>): void;
}
export declare const useResearchRouteStore: ResearchRouteStore;
`,
    "app/components/research/ResearchRouteRuntime.tsx": `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
function useInitialDocumentHydration({ executionId, initialRouteView }) {
  const setCurrentView = useResearchRouteStore((state) => state.setCurrentView);
  const clearCurrentView = useResearchRouteStore((state) => state.clearCurrentView);
  useLayoutEffect(() => {
    setCurrentView(initialRouteView, executionId);
  }, []);
  useLayoutEffect(() => () => {
    clearCurrentView(executionId);
  }, []);
}
`,
    "app/(research)/research-route-shell.tsx": `
import { useResearchRouteStore } from "@/app/stores/research-route-store";
export function ResearchRouteShell() {
  const clearCurrentView = useResearchRouteStore((state) => state.clearCurrentView);
  clearCurrentView(activeExecutionId);
}
`,
    "tsconfig.json": `
{
  "compilerOptions": {
    "allowJs": true,
    "paths": { "@/*": ["./*"] },
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "target": "ESNext"
  }
}
`,
  };
  for (const [relative, source] of Object.entries(sources)) {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, source, "utf8");
  }
}
