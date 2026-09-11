import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

async function loadGuard(): Promise<{
  runSearchFirstPaintNoDbGuard: (opts: {
    root?: string;
    entrypoints?: string[];
    enforceExceptionLiveness?: boolean;
    allowAbsentExceptionMatches?: boolean;
    allowedRepositoryChains?: Array<{
      dynamicModule: string;
      repositoryModule: string;
      importerModule?: string;
      importKinds?: string[];
      id: string;
      reason: string;
      owner: string;
      reviewWhen: string;
    }>;
  }) => Promise<{
    ok: boolean;
    violations: Array<{ file: string; chain: string[]; reason?: string }>;
    allowedRepositoryImports: Array<{
      id: string;
      file: string;
      chain: string[];
      reason: string;
    }>;
  }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-search-first-paint-no-db.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

describe("search first-paint repository guard", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "search-first-paint-guard-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(rel: string, source: string): void {
    const file = path.join(root, rel);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source, "utf8");
  }

  it("follows dynamic imports and permits the fire-and-forget analytics repository chain", async () => {
    write("app/(research)/entry.ts", `void import("@/app/server/domain-access/server-analytics");`);
    write(
      "app/server/domain-access/server-analytics.ts",
      `import { getAnalyticsEventRouterForTrustedServer } from "@/app/server/domain-access/analytics-event-access";
export function trackServerEvent() { return getAnalyticsEventRouterForTrustedServer(); }`,
    );
    write(
      "app/server/domain-access/analytics-event-access.ts",
      `import { createLocalJsonlAnalyticsEventStore } from "@/app/server/repository/analytics-events";
export function getAnalyticsEventRouterForTrustedServer() { return createLocalJsonlAnalyticsEventStore(); }`,
    );
    write(
      "app/server/repository/analytics-events.ts",
      `export function createLocalJsonlAnalyticsEventStore() { return {}; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.allowedRepositoryImports).toHaveLength(1);
    expect(result.allowedRepositoryImports[0].file).toBe(
      "app/server/repository/analytics-events.ts",
    );
    expect(result.allowedRepositoryImports[0].chain.join(" -> ")).toContain(
      "app/server/domain-access/server-analytics.ts (dynamic-fire-and-forget)",
    );
  });

  it("permits the marked live reviewed_papers source chain for My Library graph preflight", async () => {
    write(
      "app/server/services/search-execution.ts",
      `export async function resolveInternalReviewedPapersSource() {
  // @search-first-paint-allow live-library-preflight
  const { resolveMyReviewedPapersLibraryContextSource } =
    await import("@/app/server/domain-access/reviewed-paper-access");
  return resolveMyReviewedPapersLibraryContextSource();
}`,
    );
    write(
      "app/server/domain-access/reviewed-paper-access.ts",
      `import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";
export function resolveMyReviewedPapersLibraryContextSource() { return listReviewedPapers(); }`,
    );
    write(
      "app/server/repository/reviewed-papers.ts",
      `export function listReviewedPapers() { return []; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/server/services/search-execution.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.allowedRepositoryImports).toHaveLength(1);
    expect(result.allowedRepositoryImports[0].file).toBe(
      "app/server/repository/reviewed-papers.ts",
    );
    expect(result.allowedRepositoryImports[0].chain.join(" -> ")).toContain(
      "app/server/domain-access/reviewed-paper-access.ts (dynamic-live-library-preflight)",
    );
  });

  it("permits only the auth-owned exact-email allowlist membership chain", async () => {
    write(
      "app/(research)/entry.ts",
      `import { resolveAuth } from "@/app/server/auth/identity";
export async function Entry() { return resolveAuth(); }`,
    );
    write(
      "app/server/auth/identity.ts",
      `import { resolveProductAccessForEmail } from "@/app/server/domain-access/access-allowlist-access";
export function resolveAuth() { return resolveProductAccessForEmail("pilot@example.com"); }`,
    );
    write(
      "app/server/domain-access/access-allowlist-access.ts",
      `import { getAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
export function resolveProductAccessForEmail(email: string) {
  return getAccessAllowlistEntryUnchecked(email);
}`,
    );
    write(
      "app/server/repository/access-allowlist.ts",
      `export function getAccessAllowlistEntryUnchecked(email: string) { return email; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.allowedRepositoryImports).toEqual([
      expect.objectContaining({
        id: "authenticated-external-access-membership",
        file: "app/server/repository/access-allowlist.ts",
      }),
    ]);
  });

  it("rejects the allowlist repository chain outside the auth identity owner", async () => {
    write(
      "app/(research)/entry.ts",
      `import { resolveProductAccessForEmail } from "@/app/server/domain-access/access-allowlist-access";
export function Entry() { return resolveProductAccessForEmail("pilot@example.com"); }`,
    );
    write(
      "app/server/domain-access/access-allowlist-access.ts",
      `import { getAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
export function resolveProductAccessForEmail(email: string) {
  return getAccessAllowlistEntryUnchecked(email);
}`,
    );
    write(
      "app/server/repository/access-allowlist.ts",
      `export function getAccessAllowlistEntryUnchecked(email: string) { return email; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.allowedRepositoryImports).toEqual([]);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ file: "app/server/repository/access-allowlist.ts" }),
    );
  });

  it("rejects an intermediary inserted into the exact auth membership chain", async () => {
    write(
      "app/(research)/entry.ts",
      `import { resolveAuth } from "@/app/server/auth/identity";
export function Entry() { return resolveAuth(); }`,
    );
    write(
      "app/server/auth/identity.ts",
      `import { resolveProductAccessForEmail } from "@/app/server/domain-access/access-allowlist-access";
export function resolveAuth() { return resolveProductAccessForEmail("pilot@example.com"); }`,
    );
    write(
      "app/server/domain-access/access-allowlist-access.ts",
      `import { readMembership } from "@/app/server/services/access-membership-helper";
export function resolveProductAccessForEmail(email: string) { return readMembership(email); }`,
    );
    write(
      "app/server/services/access-membership-helper.ts",
      `import { getAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
export function readMembership(email: string) { return getAccessAllowlistEntryUnchecked(email); }`,
    );
    write(
      "app/server/repository/access-allowlist.ts",
      `export function getAccessAllowlistEntryUnchecked(email: string) { return email; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.allowedRepositoryImports).toEqual([]);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ file: "app/server/repository/access-allowlist.ts" }),
    );
  });

  it("rejects a helper path even when the same repository also has an allowed direct edge", async () => {
    write(
      "app/(research)/entry.ts",
      `import { resolveAuth } from "@/app/server/auth/identity";
export function Entry() { return resolveAuth(); }`,
    );
    write(
      "app/server/auth/identity.ts",
      `import { resolveProductAccessForEmail } from "@/app/server/domain-access/access-allowlist-access";
export function resolveAuth() { return resolveProductAccessForEmail("pilot@example.com"); }`,
    );
    write(
      "app/server/domain-access/access-allowlist-access.ts",
      `import { getAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
import { readMembership } from "@/app/server/services/access-membership-helper";
export function resolveProductAccessForEmail(email: string) {
  return [getAccessAllowlistEntryUnchecked(email), readMembership(email)];
}`,
    );
    write(
      "app/server/services/access-membership-helper.ts",
      `import { getAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
export function readMembership(email: string) { return getAccessAllowlistEntryUnchecked(email); }`,
    );
    write(
      "app/server/repository/access-allowlist.ts",
      `export function getAccessAllowlistEntryUnchecked(email: string) { return email; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.allowedRepositoryImports).toHaveLength(1);
    expect(result.violations).toContainEqual(
      expect.objectContaining({ file: "app/server/repository/access-allowlist.ts" }),
    );
  });

  it("matches an allowed dynamic module by importer and import kind across candidates", async () => {
    write(
      "app/server/services/search-execution.ts",
      `export async function resolveInternalReviewedPapersSource() {
  // @search-first-paint-allow live-library-preflight
  await import("@/app/server/domain-access/reviewed-paper-access");
}`,
    );
    write(
      "app/server/domain-access/reviewed-paper-access.ts",
      `import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";
export function resolveMyReviewedPapersLibraryContextSource() { return listReviewedPapers(); }`,
    );
    write(
      "app/server/repository/reviewed-papers.ts",
      `export function listReviewedPapers() { return []; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/server/services/search-execution.ts"],
      allowedRepositoryChains: [
        {
          id: "wrong-importer",
          dynamicModule: "app/server/domain-access/reviewed-paper-access.ts",
          repositoryModule: "app/server/repository/reviewed-papers.ts",
          importerModule: "app/(research)/layout.tsx",
          importKinds: ["dynamic-live-library-preflight"],
          reason: "wrong importer candidate",
          owner: "fixture layout boundary",
          reviewWhen: "review when the fixture importer changes",
        },
        {
          id: "matched-importer",
          dynamicModule: "app/server/domain-access/reviewed-paper-access.ts",
          repositoryModule: "app/server/repository/reviewed-papers.ts",
          importerModule: "app/server/services/search-execution.ts",
          importKinds: ["dynamic-live-library-preflight"],
          reason: "matched live preflight candidate",
          owner: "fixture search first-paint boundary",
          reviewWhen: "review when the fixture preflight changes",
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.allowedRepositoryImports).toHaveLength(1);
    expect(result.allowedRepositoryImports[0]).toMatchObject({
      file: "app/server/repository/reviewed-papers.ts",
      reason: "matched live preflight candidate",
    });
  });

  it("rejects a dynamic repository exception without owner and review metadata", async () => {
    const { runSearchFirstPaintNoDbGuard } = await loadGuard();

    await expect(
      runSearchFirstPaintNoDbGuard({
        root,
        enforceExceptionLiveness: false,
        entrypoints: [],
        allowedRepositoryChains: [
          {
            id: "malformed-fixture",
            dynamicModule: "app/server/domain-access/reviewed-paper-access.ts",
            repositoryModule: "app/server/repository/reviewed-papers.ts",
            reason: "fixture reason",
            owner: "",
            reviewWhen: "",
          },
        ],
      }),
    ).rejects.toThrow("requires non-empty owner metadata");
  });

  it("rejects a declared dynamic repository exception that no longer matches", async () => {
    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      entrypoints: [],
      allowedRepositoryChains: [
        {
          id: "retired-side-channel",
          dynamicModule: "app/server/domain-access/retired.ts",
          repositoryModule: "app/server/repository/retired.ts",
          reason: "fixture retired side-channel",
          owner: "fixture first-paint boundary",
          reviewWhen: "review when the fixture side-channel disappears",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        file: "app/server/domain-access/retired.ts",
        reason: "stale-guard-exception",
      }),
    );
  });

  it("treats an exception whose entire match is absent from an exact-revision tree as inapplicable", async () => {
    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      entrypoints: [],
      enforceExceptionLiveness: true,
      allowAbsentExceptionMatches: true,
      allowedRepositoryChains: [
        {
          id: "future-side-channel",
          dynamicModule: "app/server/domain-access/future.ts",
          repositoryModule: "app/server/repository/future.ts",
          reason: "fixture future side-channel",
          owner: "fixture first-paint boundary",
          reviewWhen: "review when the fixture side-channel disappears",
        },
      ],
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }));
  });

  it("rejects a partially absent exception match in an exact-revision tree as stale", async () => {
    write("app/server/domain-access/future.ts", `export function futureAccess() { return []; }`);
    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      entrypoints: [],
      allowAbsentExceptionMatches: true,
      allowedRepositoryChains: [
        {
          id: "partially-retired-side-channel",
          dynamicModule: "app/server/domain-access/future.ts",
          repositoryModule: "app/server/repository/future.ts",
          reason: "fixture partially retired side-channel",
          owner: "fixture first-paint boundary",
          reviewWhen: "review when every fixture match path disappears",
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        file: "app/server/domain-access/future.ts",
        reason: "stale-guard-exception",
      }),
    );
  });

  it("fails an unmarked awaited reviewed_papers import before first paint", async () => {
    write(
      "app/(research)/entry.ts",
      `export async function Entry() { await import("@/app/server/domain-access/reviewed-paper-access"); }`,
    );
    write(
      "app/server/domain-access/reviewed-paper-access.ts",
      `import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";
export function resolveMyReviewedPapersLibraryContextSource() { return listReviewedPapers(); }`,
    );
    write(
      "app/server/repository/reviewed-papers.ts",
      `export function listReviewedPapers() { return []; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.allowedRepositoryImports).toEqual([]);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("app/server/repository/reviewed-papers.ts");
  });

  it("fails awaited analytics imports because they can block first paint", async () => {
    write(
      "app/(research)/entry.ts",
      `export async function Entry() { await import("@/app/server/domain-access/server-analytics"); }`,
    );
    write(
      "app/server/domain-access/server-analytics.ts",
      `import { getAnalyticsEventRouterForTrustedServer } from "@/app/server/domain-access/analytics-event-access";
export function trackServerEvent() { return getAnalyticsEventRouterForTrustedServer(); }`,
    );
    write(
      "app/server/domain-access/analytics-event-access.ts",
      `import { createLocalJsonlAnalyticsEventStore } from "@/app/server/repository/analytics-events";
export function getAnalyticsEventRouterForTrustedServer() { return createLocalJsonlAnalyticsEventStore(); }`,
    );
    write(
      "app/server/repository/analytics-events.ts",
      `export function createLocalJsonlAnalyticsEventStore() { return {}; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("app/server/repository/analytics-events.ts");
    expect(result.violations[0].chain.join(" -> ")).toContain(
      "app/server/domain-access/server-analytics.ts (dynamic)",
    );
  });

  it("fails dynamic imports that reach a non-allowlisted repository module", async () => {
    write("app/(research)/entry.ts", `void import("@/app/server/repository/direct-db");`);
    write("app/server/repository/direct-db.ts", `export const table = "search_views";`);

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("app/server/repository/direct-db.ts");
    expect(result.violations[0].chain.join(" -> ")).toContain(
      "app/server/repository/direct-db.ts (dynamic-fire-and-forget)",
    );
  });

  it("ignores type-only static imports from repository modules", async () => {
    write(
      "app/(research)/entry.ts",
      `import type { RepositoryRow } from "@/app/server/repository/direct-db";
export function Entry() { return null; }`,
    );
    write("app/server/repository/direct-db.ts", `export type RepositoryRow = { id: string };`);

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("treats mixed named imports with value specifiers as runtime imports", async () => {
    write(
      "app/(research)/entry.ts",
      `import { type RepositoryRow, queryDirectDb } from "@/app/server/repository/direct-db";
export function Entry(): RepositoryRow | null { return queryDirectDb(); }`,
    );
    write(
      "app/server/repository/direct-db.ts",
      `export type RepositoryRow = { id: string };
export function queryDirectDb(): RepositoryRow | null { return null; }`,
    );

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0].file).toBe("app/server/repository/direct-db.ts");
    expect(result.violations[0].chain.join(" -> ")).toContain(
      "app/server/repository/direct-db.ts (static)",
    );
  });

  it("ignores type-position dynamic imports from repository modules", async () => {
    write(
      "app/(research)/entry.ts",
      `type RepositoryRow = import("@/app/server/repository/direct-db").RepositoryRow;
export function Entry() { return null; }`,
    );
    write("app/server/repository/direct-db.ts", `export type RepositoryRow = { id: string };`);

    const { runSearchFirstPaintNoDbGuard } = await loadGuard();
    const result = await runSearchFirstPaintNoDbGuard({
      root,
      enforceExceptionLiveness: false,
      entrypoints: ["app/(research)/entry.ts"],
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
