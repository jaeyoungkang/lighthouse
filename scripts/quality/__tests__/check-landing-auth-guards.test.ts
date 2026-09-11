import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

async function loadSourceGuard(): Promise<{
  DEFAULT_ANALYTICS_FILES: string[];
  runLandingAuthSourceBoundaryGuard: (opts: {
    root?: string;
    analyticsFiles?: string[];
  }) => Promise<{
    ok: boolean;
    violations: Array<{ file: string; reason: string; text: string }>;
  }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-landing-auth-source-boundary.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

describe("landing auth boundary guards", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "landing-auth-guard-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(rel: string, source: string): void {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source, "utf8");
  }

  it("declares public auth message ownership in dependency-cruiser", () => {
    const config = require(path.resolve(process.cwd(), ".dependency-cruiser.cjs")) as {
      forbidden: Array<{
        name: string;
        from: { path: string };
        to: { path: string };
      }>;
    };
    const rule = config.forbidden.find(
      (candidate) => candidate.name === "public-auth-must-not-import-global-messages",
    );

    expect(rule).toBeDefined();
    if (!rule) throw new Error("public auth dependency rule missing");
    const from = new RegExp(rule.from.path);
    const to = new RegExp(rule.to.path);
    expect(from.test("app/components/MoonlightAuthBootstrap.tsx")).toBe(true);
    expect(from.test("app/i18n/public-client-messages.ts")).toBe(true);
    expect(from.test("app/components/SiteFooter.tsx")).toBe(false);
    expect(to.test("app/i18n/message-access.ts")).toBe(true);
    expect(to.test("app/i18n/messages/search.ts")).toBe(true);
    expect(to.test("app/i18n/public-client-messages.ts")).toBe(false);
  });

  it("rejects production app/lib runtime imports of app/server while allowing type-only contracts", () => {
    const config = require(path.resolve(process.cwd(), ".dependency-cruiser.cjs")) as {
      options: { tsPreCompilationDeps?: boolean };
      forbidden: Array<{
        name: string;
        from: { path: string; pathNot?: string };
        to: { path: string; dependencyTypesNot?: string[] };
      }>;
    };
    expect(config.options.tsPreCompilationDeps).toBe(true);
    const rule = config.forbidden.find(
      (candidate) => candidate.name === "no-shared-lib-to-server-runtime",
    );

    expect(rule).toBeDefined();
    if (!rule) throw new Error("shared lib runtime dependency rule missing");
    expect(new RegExp(rule.from.path).test("app/lib/search-query.ts")).toBe(true);
    expect(
      new RegExp(rule.from.pathNot ?? "$a").test("app/lib/__tests__/search-query.test.ts"),
    ).toBe(true);
    expect(new RegExp(rule.to.path).test("app/server/services/search-execution.ts")).toBe(true);
    expect(rule.to.dependencyTypesNot).toEqual(["type-only"]);
  });

  it("makes a client-to-server type-only import visible and blocking", () => {
    write(
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { moduleResolution: "bundler", module: "esnext" } }),
    );
    write("app/server/fixture.ts", "export interface ServerFixture { value: string }\n");
    write(
      "app/stores/fixture.ts",
      'import type { ServerFixture } from "../server/fixture";\nexport type StoreFixture = ServerFixture;\n',
    );

    const result = spawnSync(
      path.resolve(process.cwd(), "node_modules/.bin/dependency-cruiser"),
      ["--config", path.resolve(process.cwd(), ".dependency-cruiser.cjs"), "app"],
      { cwd: root, encoding: "utf8" },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).not.toBe(0);
    expect(output).toContain("no-client-to-server");
    expect(output).toContain("app/stores/fixture.ts → app/server/fixture.ts");
  });

  it("keeps declared client type-contract exceptions value-import blocking", () => {
    write(
      "tsconfig.json",
      JSON.stringify({ compilerOptions: { moduleResolution: "bundler", module: "esnext" } }),
    );
    write(
      "app/server/services/analytics/event-contract.ts",
      'export const eventContractFixture = "event";\n',
    );
    write(
      "app/server/services/library-context-source.ts",
      'export const libraryContextFixture = "library";\n',
    );
    write("app/server/services/other-contract.ts", "export interface OtherContract {}\n");
    write(
      "app/components/admin/AnalyticsEventsDashboard.tsx",
      'import { eventContractFixture } from "../../server/services/analytics/event-contract";\nimport type { OtherContract } from "../../server/services/other-contract";\nexport const dashboardFixture: OtherContract = eventContractFixture as never;\n',
    );
    write(
      "app/components/research/__tests__/research-route-shell.test.tsx",
      'import { libraryContextFixture } from "../../../server/services/library-context-source";\nimport type { OtherContract } from "../../../server/services/other-contract";\nexport const shellFixture: OtherContract = libraryContextFixture as never;\n',
    );

    const result = spawnSync(
      path.resolve(process.cwd(), "node_modules/.bin/dependency-cruiser"),
      ["--config", path.resolve(process.cwd(), ".dependency-cruiser.cjs"), "app"],
      { cwd: root, encoding: "utf8" },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).not.toBe(0);
    expect(output).toContain("admin-analytics-server-type-contract-only");
    expect(output).toContain("admin-analytics-server-contract-target-only");
    expect(output).toContain("research-shell-test-server-type-contract-only");
    expect(output).toContain("research-shell-test-server-contract-target-only");
  });

  it("keeps all analytics entrypoints in the minimal custom source set", async () => {
    const { DEFAULT_ANALYTICS_FILES } = await loadSourceGuard();

    expect(DEFAULT_ANALYTICS_FILES).toEqual([
      "app/lib/analytics/amplitude-unified-client.ts",
      "app/lib/analytics/client.ts",
      "app/lib/track.ts",
      "instrumentation-client.ts",
    ]);
  });

  it("fails analytics files that import Amplitude eagerly", async () => {
    write(
      "app/lib/analytics/client.ts",
      `import { getDeviceId } from "@amplitude/unified"; export const id = getDeviceId;`,
    );

    const { runLandingAuthSourceBoundaryGuard } = await loadSourceGuard();
    const result = await runLandingAuthSourceBoundaryGuard({
      root,
      analyticsFiles: ["app/lib/analytics/client.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.reason)).toEqual([
      "eager-amplitude-sdk-import",
    ]);
  });

  it("passes helper-scoped dynamic SDK imports", async () => {
    write(
      "app/lib/analytics/amplitude-unified-client.ts",
      `export async function load() { return import("@amplitude/unified"); }`,
    );
    write("app/lib/analytics/client.ts", `export const client = null;`);

    const { runLandingAuthSourceBoundaryGuard } = await loadSourceGuard();
    const result = await runLandingAuthSourceBoundaryGuard({
      root,
      analyticsFiles: [
        "app/lib/analytics/amplitude-unified-client.ts",
        "app/lib/analytics/client.ts",
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("fails direct dynamic Amplitude imports outside the helper", async () => {
    write(
      "app/lib/track.ts",
      `export async function load() { return import("@amplitude/unified"); }`,
    );

    const { runLandingAuthSourceBoundaryGuard } = await loadSourceGuard();
    const result = await runLandingAuthSourceBoundaryGuard({
      root,
      analyticsFiles: ["app/lib/track.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.violations.map((violation) => violation.reason)).toEqual([
      "direct-amplitude-sdk-dynamic-import",
    ]);
  });
});
