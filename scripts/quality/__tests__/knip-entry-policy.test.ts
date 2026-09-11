import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type KnipEntryException = {
  id: string;
  entry: string;
  reason: string;
  owner: string;
  reviewWhen: string;
};

type KnipConfig = {
  entry: string[];
  include: string[];
  project: string[];
};

const repoRoot = process.cwd();
const knipConfig = JSON.parse(readFileSync(path.join(repoRoot, "knip.json"), "utf8")) as KnipConfig;
const testOnlyVerificationFiles = [
  "app/api/search/route.helpers.ts",
  "app/components/CitationLink.tsx",
  "app/components/research-route-renderers/followup-pending-view.tsx",
  "app/server/ai-generation/intent-qualitative-judge.ts",
];

describe("Knip entry policy", () => {
  let fixtureRoot: string;

  beforeEach(() => {
    fixtureRoot = mkdtempSync(path.join(tmpdir(), "knip-entry-policy-"));
  });

  afterEach(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it("keeps broad app and scripts globs out of the entry set", () => {
    expect(knipConfig.entry).not.toContain("app/**/*.ts");
    expect(knipConfig.entry).not.toContain("app/**/*.tsx");
    expect(knipConfig.entry).not.toContain("app/**/*.css");
    expect(knipConfig.entry).not.toContain("scripts/**/*.ts");
    expect(knipConfig.entry).not.toContain("scripts/evidence-ledger/helpers/**/*.{ts,mjs}");
    expect(knipConfig.include).toEqual([
      "files",
      "dependencies",
      "devDependencies",
      "optionalPeerDependencies",
      "unlisted",
      "binaries",
      "unresolved",
      "catalog",
    ]);
  });

  it("keeps every exact exception declared, current, and registered", async () => {
    const policy = (await import("../knip-entry-exceptions.mjs")) as {
      KNIP_ENTRY_EXCEPTIONS: readonly KnipEntryException[];
    };
    const seen = new Set<string>();

    for (const declaration of policy.KNIP_ENTRY_EXCEPTIONS) {
      expect(seen.has(declaration.entry), declaration.id).toBe(false);
      seen.add(declaration.entry);
      expect(knipConfig.entry, declaration.id).toContain(declaration.entry);
      expect(existsSync(path.join(repoRoot, declaration.entry)), declaration.id).toBe(true);
      expect(declaration.reason.trim(), declaration.id).not.toBe("");
      expect(declaration.owner.trim(), declaration.id).not.toBe("");
      expect(declaration.reviewWhen.trim(), declaration.id).not.toBe("");
    }

    const configuredAppEntries = knipConfig.entry.filter((entry) => entry.startsWith("app/"));
    const declaredAppEntries = policy.KNIP_ENTRY_EXCEPTIONS.filter((declaration) =>
      declaration.entry.startsWith("app/"),
    ).map((declaration) => declaration.entry);
    expect(new Set(configuredAppEntries)).toEqual(new Set(declaredAppEntries));
  });

  it("keeps production-unreachable verification files explicitly self-declared", () => {
    for (const relativePath of testOnlyVerificationFiles) {
      const source = readFileSync(path.join(repoRoot, relativePath), "utf8");
      expect(source, relativePath).toMatch(/reason:/);
      expect(source, relativePath).toMatch(/owner:/);
      expect(source, relativePath).toMatch(/reviewWhen:/);
    }
  });

  it("fails an app file that no Next entry, test, or script consumes", () => {
    const write = (relativePath: string, source: string) => {
      const absolutePath = path.join(fixtureRoot, relativePath);
      mkdirSync(path.dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, source, "utf8");
    };
    const appEntries = knipConfig.entry.filter((entry) => entry.startsWith("app/"));

    write("package.json", JSON.stringify({ dependencies: { next: "*" } }));
    write(
      "knip.json",
      JSON.stringify({ entry: appEntries, project: ["app/**/*.{ts,tsx}"], include: ["files"] }),
    );
    write("app/page.tsx", "export default function Page() { return null; }\n");
    write("app/unreachable-fixture.ts", "export const unreachableFixture = true;\n");

    const result = spawnSync(
      path.join(repoRoot, "node_modules", ".bin", "knip"),
      ["--config", "knip.json", "--reporter", "compact", "--no-config-hints"],
      { cwd: fixtureRoot, encoding: "utf8" },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).not.toBe(0);
    expect(output).toContain("app/unreachable-fixture.ts");
    expect(output).not.toContain("app/page.tsx: app/page.tsx");
  });
});
