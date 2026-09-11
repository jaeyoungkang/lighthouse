import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(
  process.cwd(),
  "shared-skills/structural-audit/references/create-snapshot.mjs",
);
const temporaryRoots: string[] = [];

type SnapshotManifest = {
  current: Record<string, number>;
  delta: Record<string, number>;
  toolingScope: string[];
  fingerprints: {
    graph: string;
    policy: string;
    tooling: string;
  };
  projection: {
    manifestNodes: number;
    sourceNodes: number;
    tombstones: string[];
    edges: number;
    typeOnlyEdges: number;
    dynamicEdges: number;
  };
  boundaries: {
    auditVerdict: string;
    releaseGate: boolean;
    healthScore: boolean;
    overwriteExistingArtifacts: boolean;
  };
};

type GraphAnalysis = {
  nodes: string[];
  edges: Array<{ from: string }>;
};

function makeFixture() {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-structural-snapshot-test-"));
  const output = path.join(root, "output");
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "app"), { recursive: true });
  writeFileSync(
    path.join(root, "app/page.tsx"),
    [
      'import { feature } from "./feature";',
      'const lazy = import("./lazy");',
      "export default function Page() {",
      "  void lazy;",
      "  return feature;",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    path.join(root, "app/feature.ts"),
    ['import type { Demo } from "./types";', 'export const feature: Demo = "demo";', ""].join("\n"),
  );
  writeFileSync(path.join(root, "app/types.ts"), 'export type Demo = "demo";\n');
  writeFileSync(path.join(root, "app/lazy.ts"), "export const lazy = true;\n");
  const projectionManifest = path.join(root, "projection-manifest.json");
  writeFileSync(
    projectionManifest,
    JSON.stringify(
      {
        schemaVersion: 1,
        id: "fixture-projection",
        title: "Fixture import graph",
        layout: { direction: "TB", nodeSpacing: 20, rankSpacing: 30, minWidthPx: 1200 },
        groups: [
          { id: "entry", label: "Entrypoints", className: "entry", nodes: ["app/page.tsx"] },
          { id: "ui", label: "UI", className: "ui", nodes: ["app/feature.ts"] },
          { id: "server", label: "Server", className: "server", nodes: ["app/lazy.ts"] },
          {
            id: "authority",
            label: "Authority",
            className: "authority",
            nodes: ["app/types.ts"],
          },
          {
            id: "cross",
            label: "Cross",
            className: "cross",
            nodes: ["app/removed.ts"],
          },
        ],
        metricNodes: ["app/feature.ts"],
      },
      null,
      2,
    ) + "\n",
  );
  const baseline = path.join(root, "baseline.json");
  writeFileSync(
    baseline,
    JSON.stringify({
      revision: "baseline-revision",
      counts: { files: 5, edges: 4, typeOnlyEdges: 1, dynamicEdges: 1, entries: 1 },
      sccs: [],
      unreachable: [],
      crossZoneFindings: [],
      unresolved: [],
    }),
  );
  const git = (...args: string[]) =>
    spawnSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
  expect(git("init", "-q").status).toBe(0);
  expect(git("config", "user.email", "snapshot@example.test").status).toBe(0);
  expect(git("config", "user.name", "Snapshot Test").status).toBe(0);
  expect(git("remote", "add", "origin", "https://github.com/corca-ai/fixture").status).toBe(0);
  expect(git("add", "app", "projection-manifest.json").status).toBe(0);
  expect(git("commit", "-qm", "fixture").status).toBe(0);
  return { root, output, projectionManifest, baseline };
}

function runSnapshot(
  fixture: ReturnType<typeof makeFixture>,
  date = "2026-08-29",
  requiredRef = "HEAD",
  options: { outputRoot?: string; env?: Partial<NodeJS.ProcessEnv> } = {},
) {
  return spawnSync(
    process.execPath,
    [
      SCRIPT,
      fixture.root,
      options.outputRoot ?? fixture.output,
      "--date",
      date,
      "--baseline",
      fixture.baseline,
      "--projection-manifest",
      fixture.projectionManifest,
      "--require-ref",
      requiredRef,
      "--issue-url",
      "https://github.com/jaeyoungkang/lighthouse/issues/730",
    ],
    { encoding: "utf8", env: { ...process.env, ...options.env } },
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("structural snapshot generator", () => {
  it("keeps durable Mermaid source stable across process locales", () => {
    const fixture = makeFixture();
    const projection = JSON.parse(readFileSync(fixture.projectionManifest, "utf8")) as {
      groups: Array<{ nodes: string[] }>;
    };
    projection.groups[1].nodes.push("app/ch.ts", "app/ci.ts", "app/h.ts");
    writeFileSync(fixture.projectionManifest, JSON.stringify(projection, null, 2) + "\n");
    writeFileSync(path.join(fixture.root, "app/ch.ts"), 'import "./h";\nexport const ch = true;\n');
    writeFileSync(
      path.join(fixture.root, "app/ci.ts"),
      'import "./ch";\nexport const ci = true;\n',
    );
    writeFileSync(path.join(fixture.root, "app/h.ts"), "export const h = true;\n");
    appendFileSync(
      path.join(fixture.root, "app/page.tsx"),
      '\nimport "./ch";\nimport "./ci";\nimport "./h";\n',
    );
    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: fixture.root, encoding: "utf8", stdio: "pipe" });
    expect(git("add", "app", "projection-manifest.json").status).toBe(0);
    expect(git("commit", "-qm", "add locale-sensitive projection paths").status).toBe(0);
    const rootOutput = path.join(fixture.root, "output-root-locale");
    const czechOutput = path.join(fixture.root, "output-czech-locale");

    const rootLocale = runSnapshot(fixture, "2026-08-29", "HEAD", {
      outputRoot: rootOutput,
      env: { LANG: "C", LC_ALL: "C" },
    });
    const czechLocale = runSnapshot(fixture, "2026-08-29", "HEAD", {
      outputRoot: czechOutput,
      env: { LANG: "cs_CZ.UTF-8", LC_ALL: "cs_CZ.UTF-8" },
    });

    expect(rootLocale.status, rootLocale.stderr || rootLocale.stdout).toBe(0);
    expect(czechLocale.status, czechLocale.stderr || czechLocale.stdout).toBe(0);
    expect(readFileSync(path.join(czechOutput, "dataset/2026-08-29-projection.mmd"), "utf8")).toBe(
      readFileSync(path.join(rootOutput, "dataset/2026-08-29-projection.mmd"), "utf8"),
    );
  });

  it("writes a revision-pinned bundle with fixed projection and Mermaiden lifecycle", () => {
    const fixture = makeFixture();
    const result = runSnapshot(fixture);
    expect(result.status, result.stderr || result.stdout).toBe(0);

    const manifest = JSON.parse(
      readFileSync(path.join(fixture.output, "dataset/2026-08-29-snapshot-manifest.json"), "utf8"),
    ) as SnapshotManifest;
    expect(manifest.current).toMatchObject({
      files: 4,
      edges: 3,
      typeOnlyEdges: 1,
      dynamicEdges: 1,
      entries: 1,
    });
    expect(manifest.delta).toMatchObject({ files: -1, edges: -1 });
    expect(manifest.projection).toMatchObject({
      manifestNodes: 5,
      sourceNodes: 4,
      tombstones: ["app/removed.ts"],
      edges: 3,
      typeOnlyEdges: 1,
      dynamicEdges: 1,
    });
    expect(manifest.boundaries).toEqual({
      auditVerdict: "not-run",
      releaseGate: false,
      healthScore: false,
      overwriteExistingArtifacts: false,
    });
    expect(manifest.fingerprints.graph).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.fingerprints.policy).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.fingerprints.tooling).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.toolingScope).toContain(
      "shared-skills/structural-audit/references/topology-fingerprint.mjs",
    );

    const analysis = JSON.parse(
      readFileSync(path.join(fixture.output, "dataset/2026-08-29-graph-analysis.json"), "utf8"),
    ) as GraphAnalysis;
    expect(analysis.nodes).toEqual([
      "app/feature.ts",
      "app/lazy.ts",
      "app/page.tsx",
      "app/types.ts",
    ]);
    expect(analysis.edges.map((edge) => edge.from)).toEqual([
      "app/feature.ts",
      "app/page.tsx",
      "app/page.tsx",
    ]);

    const mermaid = readFileSync(
      path.join(fixture.output, "dataset/2026-08-29-projection.mmd"),
      "utf8",
    );
    expect(mermaid).toContain("|dynamic import|");
    expect(mermaid).toContain("linkStyle");
    expect(mermaid).toContain("missing @ revision");
    expect(mermaid).toContain("class n4 tombstone");

    const html = readFileSync(path.join(fixture.output, "2026-08-29-projection.html"), "utf8");
    expect(html).toContain("https://isnbh0.github.io/mermaiden/cdn/latest/mermaiden.js");
    expect(html).toContain("https://isnbh0.github.io/mermaiden/cdn/latest/mermaiden-toolkit.js");
    expect(html).toContain("https://isnbh0.github.io/mermaiden/cdn/latest/relationships.css");
    expect(html).toContain("attachRelationshipHighlight(svg, result.semantics)");
    expect(html).toContain("relationshipHighlight?.dispose()");
    expect(html).toContain('window.addEventListener("pagehide", retirePresentation');

    const record = readFileSync(path.join(fixture.output, "2026-08-29-snapshot-record.md"), "utf8");
    expect(record).toContain("기계적 snapshot evidence");
    expect(record).toContain("Mermaiden latest");
    expect(record).toContain("architecture health verdict가 아니다");
  });

  it("fails closed when production graph inputs differ from HEAD", () => {
    const fixture = makeFixture();
    appendFileSync(path.join(fixture.root, "app/page.tsx"), "\n// dirty\n");
    const result = runSnapshot(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Structural snapshot inputs differ from HEAD");
    expect(result.stderr).toContain("app/page.tsx");
  });

  it("fails closed when structural policy inputs differ from HEAD", () => {
    const fixture = makeFixture();
    writeFileSync(path.join(fixture.root, "tsconfig.json"), '{"compilerOptions":{}}\n');
    const result = runSnapshot(fixture);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Structural snapshot inputs differ from HEAD");
    expect(result.stderr).toContain("tsconfig.json");
  });

  it("fails closed when HEAD differs from the required ref", () => {
    const fixture = makeFixture();
    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: fixture.root, encoding: "utf8", stdio: "pipe" });
    expect(git("branch", "snapshot-base").status).toBe(0);
    appendFileSync(path.join(fixture.root, "app/page.tsx"), "\n// committed change\n");
    expect(git("add", "app/page.tsx").status).toBe(0);
    expect(git("commit", "-qm", "move head").status).toBe(0);

    const result = runSnapshot(fixture, "2026-08-29", "snapshot-base");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("does not match required ref snapshot-base");
  });

  it("refuses to overwrite an existing dated snapshot", () => {
    const fixture = makeFixture();
    const first = runSnapshot(fixture);
    expect(first.status, first.stderr || first.stdout).toBe(0);
    const second = runSnapshot(fixture);
    expect(second.status).not.toBe(0);
    expect(second.stderr).toContain("append-only");
    expect(second.stderr).toContain("2026-08-29");
  });
});
