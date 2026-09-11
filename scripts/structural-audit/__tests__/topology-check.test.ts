import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(
  process.cwd(),
  "shared-skills/structural-audit/references/check-topology.mjs",
);
const FINGERPRINT_MODULE = pathToFileURL(
  path.join(process.cwd(), "shared-skills/structural-audit/references/topology-fingerprint.mjs"),
).href;
const temporaryRoots: string[] = [];

type CheckResult = {
  baseRevision: string;
  currentRevision: string;
  changed: { graph: boolean; policy: boolean; tooling: boolean };
  snapshotRequiredAfterMerge: boolean;
  auditTriggers: string[];
  metrics: { delta: Record<string, number> };
  boundaries: {
    topologyChangeIsBlocking: boolean;
    durableSnapshotRevision: string;
    architectureHealthVerdict: boolean;
  };
};

function makeRepository() {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-structural-check-test-"));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, "app"), { recursive: true });
  writeFileSync(
    path.join(root, "app/page.tsx"),
    'import { feature } from "./feature";\nexport default function Page() { return feature; }\n',
  );
  writeFileSync(path.join(root, "app/feature.ts"), 'export const feature = "base";\n');
  writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }) + "\n",
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim();
  git("init", "--initial-branch=main");
  git("config", "user.email", "structural-check@example.test");
  git("config", "user.name", "Structural Check Test");
  git("add", ".");
  git("commit", "-m", "base");
  return { root, git, baseRevision: git("rev-parse", "HEAD") };
}

function commit(repository: ReturnType<typeof makeRepository>, message: string) {
  repository.git("add", ".");
  repository.git("commit", "-m", message);
  return repository.git("rev-parse", "HEAD");
}

function runCheck(root: string, baseRevision: string) {
  const result = spawnSync(process.execPath, [SCRIPT, root, "--base", baseRevision, "--json"], {
    encoding: "utf8",
  });
  return {
    ...result,
    parsed: result.status === 0 ? (JSON.parse(result.stdout) as CheckResult) : undefined,
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("structural topology change detector", () => {
  it("keeps graph fingerprints stable across process locales", () => {
    const program = [
      `import { buildGraphFingerprint, canonicalizeAuditSignals } from ${JSON.stringify(FINGERPRINT_MODULE)};`,
      "const nodes = ['app/ch.ts', 'app/h.ts', 'app/ci.ts'];",
      "const edges = [",
      "  { from: 'app/ch.ts', to: 'app/h.ts', typeOnly: false, dynamic: false },",
      "  { from: 'app/ci.ts', to: 'app/ch.ts', typeOnly: true, dynamic: false },",
      "];",
      "const graph = buildGraphFingerprint({ schemaVersion: 1, nodes, edges });",
      "const signals = canonicalizeAuditSignals({",
      "  sccs: [['app/h.ts', 'app/ch.ts']],",
      "  unreachable: ['app/h.ts', 'app/ch.ts'],",
      "  crossZoneFindings: [],",
      "  unresolved: [],",
      "});",
      "console.log(JSON.stringify({ graph, signals }));",
    ].join("\n");
    const fingerprint = (locale: string) =>
      spawnSync(process.execPath, ["--input-type=module", "--eval", program], {
        encoding: "utf8",
        env: { ...process.env, LANG: locale, LC_ALL: locale },
      });

    const rootLocale = fingerprint("C");
    const czechLocale = fingerprint("cs_CZ.UTF-8");

    expect(rootLocale.status, rootLocale.stderr).toBe(0);
    expect(czechLocale.status, czechLocale.stderr).toBe(0);
    expect(czechLocale.stdout.trim()).toBe(rootLocale.stdout.trim());
  });

  it("ignores source-body changes that leave the normalized import graph unchanged", () => {
    const repository = makeRepository();
    writeFileSync(path.join(repository.root, "app/feature.ts"), 'export const feature = "head";\n');
    const currentRevision = commit(repository, "change implementation only");

    const result = runCheck(repository.root, repository.baseRevision);

    expect(result.status, result.stderr).toBe(0);
    expect(result.parsed).toMatchObject({
      baseRevision: repository.baseRevision,
      currentRevision,
      changed: { graph: false, policy: false, tooling: false },
      snapshotRequiredAfterMerge: false,
      auditTriggers: [],
    });
  });

  it("reports a committed import topology change without turning it into a blocking verdict", () => {
    const repository = makeRepository();
    writeFileSync(path.join(repository.root, "app/lazy.ts"), "export const lazy = true;\n");
    writeFileSync(
      path.join(repository.root, "app/page.tsx"),
      [
        'import { feature } from "./feature";',
        'import { lazy } from "./lazy";',
        "export default function Page() { return lazy ? feature : null; }",
        "",
      ].join("\n"),
    );
    commit(repository, "add structural edge");

    const result = runCheck(repository.root, repository.baseRevision);

    expect(result.status, result.stderr).toBe(0);
    expect(result.parsed?.changed).toEqual({ graph: true, policy: false, tooling: false });
    expect(result.parsed?.snapshotRequiredAfterMerge).toBe(true);
    expect(result.parsed?.metrics.delta).toMatchObject({ files: 1, edges: 1 });
    expect(result.parsed?.boundaries).toMatchObject({
      topologyChangeIsBlocking: false,
      durableSnapshotRevision: "exact-main-after-merge",
      architectureHealthVerdict: false,
    });
  });

  it("separates policy changes from graph changes", () => {
    const repository = makeRepository();
    writeFileSync(
      path.join(repository.root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { "@/*": ["./*"], "@contracts/*": ["./app/domain/*"] } },
      }) + "\n",
    );
    commit(repository, "change path policy");

    const result = runCheck(repository.root, repository.baseRevision);

    expect(result.status, result.stderr).toBe(0);
    expect(result.parsed?.changed).toEqual({ graph: false, policy: true, tooling: false });
    expect(result.parsed?.auditTriggers).toContain("policy");
    expect(result.parsed?.snapshotRequiredAfterMerge).toBe(true);
  });

  it("separates structural tooling changes from source topology", () => {
    const repository = makeRepository();
    const toolingPath = path.join(
      repository.root,
      "shared-skills/structural-audit/references/check-topology.mjs",
    );
    mkdirSync(path.dirname(toolingPath), { recursive: true });
    writeFileSync(toolingPath, "export const version = 1;\n");
    commit(repository, "add structural tooling");
    const toolingBase = repository.git("rev-parse", "HEAD");
    writeFileSync(toolingPath, "export const version = 2;\n");
    commit(repository, "change structural tooling");

    const result = runCheck(repository.root, toolingBase);

    expect(result.status, result.stderr).toBe(0);
    expect(result.parsed?.changed).toEqual({ graph: false, policy: false, tooling: true });
    expect(result.parsed?.auditTriggers).toContain("tooling");
  });

  it("fails closed when the declared comparison ref is unavailable", () => {
    const repository = makeRepository();

    const result = runCheck(repository.root, "refs/heads/missing-structural-base");

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "could not resolve structural comparison ref refs/heads/missing-structural-base",
    );
  });
});
