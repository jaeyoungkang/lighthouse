import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isHistoricalAdminClientLayoutRevision } from "../collect-least-authority.mjs";

type GuardResult = {
  ok: boolean;
  violations: Array<{ rule: string; file: string; detail: string }>;
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function loadGuard(): Promise<{
  LEAST_AUTHORITY_PRODUCTION_SCOPE_PATHS: string[];
  runLeastAuthorityBoundaryGuard: (options: {
    root: string;
    allowAbsentExceptionMatches?: boolean;
    allowHistoricalGapReservationImports?: boolean;
    allowHistoricalAdminClientModule?: boolean;
  }) => Promise<GuardResult>;
}> {
  const modulePath = path.resolve(__dirname, "..", "check-least-authority-boundaries.mjs");
  return (await import(pathToFileURL(modulePath).href)) as never;
}

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "least-authority-boundary-"));
  roots.push(root);
  return root;
}

async function write(root: string, relative: string, contents: string): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

async function writeHealthyFixture(root: string): Promise<void> {
  await write(
    root,
    "app/server/auth/supabase.ts",
    `export function createAdminClient() { return {}; }
export async function createClient() { return {}; }`,
  );
  await write(
    root,
    "app/lib/supabase/repository-db-handle.ts",
    `export function createRepositoryDbHandle(db: unknown) { return { handle: db }; }
export function unwrapRepositoryDbHandle(handle: unknown) { return handle; }`,
  );
  await write(
    root,
    "app/server/repository/db.ts",
    `import { unwrapRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
export function getRepositoryDbFor(handle: unknown) { return unwrapRepositoryDbHandle(handle); }`,
  );
  await write(
    root,
    "app/server/auth/identity.ts",
    `import { createAdminClient, createClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
export async function auth() {
  await createClient();
  return createRepositoryDbHandle(createAdminClient());
}`,
  );
  await write(
    root,
    "app/auth/confirm/route.ts",
    `import { createClient } from "@/app/server/auth/supabase";
export async function GET() { return (await createClient()).auth; }`,
  );
  await write(
    root,
    "app/api/auth/magic-link/route.ts",
    `import { createClient } from "@/app/server/auth/supabase";
export async function POST() { return (await createClient()).auth; }`,
  );
  await write(
    root,
    "app/server/auth/app-user-snapshot.ts",
    `import { createAdminClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { upsertAppUserSnapshot } from "@/app/server/repository/app-users";
export function snapshot() { return upsertAppUserSnapshot(createRepositoryDbHandle(createAdminClient())); }`,
  );
  await write(
    root,
    "app/server/repository/app-users.ts",
    `export function upsertAppUserSnapshot(db: unknown) { return db; }`,
  );
  await write(
    root,
    "app/server/repository/reviewed-papers.ts",
    `export function listReviewedPapers(db: unknown, owner: string) { return [db, owner]; }
export function getReviewedStatus(db: unknown, owner: string) { return [db, owner]; }
export function markAsReviewed(db: unknown, owner: string) { return [db, owner]; }
export function unmarkReviewed(db: unknown, owner: string) { return [db, owner]; }`,
  );
  await write(
    root,
    "app/server/repository/paper-inline-analysis-cache.ts",
    `export function listSharedPaperInlineAnalysisCache() { return []; }
export function claimSharedPaperInlineAnalysisGeneration() { return []; }
export function completeSharedPaperInlineAnalysisGeneration() { return []; }
export function releaseSharedPaperInlineAnalysisGeneration() { return []; }`,
  );
  await write(
    root,
    "app/server/domain-access/inline-analysis-access.ts",
    `import {
  listSharedPaperInlineAnalysisCache,
  claimSharedPaperInlineAnalysisGeneration,
  completeSharedPaperInlineAnalysisGeneration,
  releaseSharedPaperInlineAnalysisGeneration,
} from "@/app/server/repository/paper-inline-analysis-cache";
export function resolveInlineAnalysis() {
  return [
    listSharedPaperInlineAnalysisCache,
    claimSharedPaperInlineAnalysisGeneration,
    completeSharedPaperInlineAnalysisGeneration,
    releaseSharedPaperInlineAnalysisGeneration,
  ];
}`,
  );
  await write(
    root,
    "app/server/domain-access/reviewed-paper-access.ts",
    `import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";
export function listMyReviewedPapers() { return listReviewedPapers({}, "current"); }
export function resolveMyReviewedPapersLibraryContextSource() { return listReviewedPapers({}, "current"); }
export function markMyReviewedPaper(paper: unknown) { return paper; }
export function unmarkMyReviewedPaper(paperId: string) { return paperId; }`,
  );
}

describe("Issue #278 least-authority guard", () => {
  it("keeps the v0.5 collector scope aligned with production scan roots", async () => {
    const { LEAST_AUTHORITY_PRODUCTION_SCOPE_PATHS } = await loadGuard();
    const collectorPath = path.resolve(__dirname, "..", "collect-least-authority.mjs");
    const collector = (await import(pathToFileURL(collectorPath).href)) as {
      LEAST_AUTHORITY_COLLECTION_SCOPE_PATHS: string[];
    };
    expect(collector.LEAST_AUTHORITY_COLLECTION_SCOPE_PATHS).toEqual(
      LEAST_AUTHORITY_PRODUCTION_SCOPE_PATHS,
    );
  });

  it("accepts the caller-specific API, auth-owned service role, and repository seam", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/lib/array-factories.ts",
      `export const values = Array.from(new Set(["one"]));
export const bytes = Uint8Array.from([1, 2]);
export const globalValues = globalThis.Array.from(["two"]);`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }));
  });

  it("rejects the retired Supabase owner unless exact-revision collection opts in", async () => {
    const root = await fixtureRoot();
    await write(
      root,
      "app/lib/supabase/server.ts",
      `import { createClient } from "@supabase/supabase-js";
export function createAdminClient() { return createClient("url", "key"); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const blocking = await runLeastAuthorityBoundaryGuard({
      root,
      allowAbsentExceptionMatches: true,
    });
    const historical = await runLeastAuthorityBoundaryGuard({
      root,
      allowAbsentExceptionMatches: true,
      allowHistoricalAdminClientModule: true,
    });

    expect(blocking.violations).toContainEqual(
      expect.objectContaining({
        rule: "supabase-factory-caller",
        file: "app/lib/supabase/server.ts",
      }),
    );
    expect(historical).toEqual(expect.objectContaining({ ok: true, violations: [] }));

    await write(root, "app/server/auth/supabase.ts", "export const currentOwner = true;\n");
    const duplicate = await runLeastAuthorityBoundaryGuard({
      root,
      allowAbsentExceptionMatches: true,
      allowHistoricalAdminClientModule: true,
    });
    expect(duplicate.violations).toContainEqual(
      expect.objectContaining({
        rule: "supabase-factory-caller",
        file: "app/lib/supabase/server.ts",
      }),
    );
  });

  it("binds the Supabase historical option to definition-owned full revisions", () => {
    expect(isHistoricalAdminClientLayoutRevision("87877a1a6448c5b355f4c3e7a07273b00c29776c")).toBe(
      true,
    );
    expect(isHistoricalAdminClientLayoutRevision("e26b4ab8775a158c39c0090b2af6b7d480704d74")).toBe(
      true,
    );
    expect(isHistoricalAdminClientLayoutRevision("7b4a9a50bc021bcb41e63aa73093f66c9fe72cc8")).toBe(
      false,
    );
  });

  it("rejects an undeclared session-auth client caller", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/api/auth/parallel-bootstrap/route.ts",
      `import { createClient } from "@/app/server/auth/supabase";
export async function POST() { return createClient(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "session-auth-client-caller",
        file: "app/api/auth/parallel-bootstrap/route.ts",
      }),
    );
  });

  it("rejects session-auth client re-export and namespace acquisition", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/services/session-client-re-export.ts",
      `export { createClient } from "@/app/server/auth/supabase";`,
    );
    await write(
      root,
      "app/server/services/session-client-namespace.ts",
      `import * as supabase from "@/app/server/auth/supabase";
export async function acquire() { return supabase.createClient(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "session-auth-client-re-export",
          file: "app/server/services/session-client-re-export.ts",
        }),
        expect.objectContaining({
          rule: "session-auth-client-caller",
          file: "app/server/services/session-client-namespace.ts",
        }),
      ]),
    );
  });

  it("rejects a declared session-auth exception after its runtime import disappears", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/api/auth/magic-link/route.ts",
      `export async function POST() { return { retired: true }; }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "stale-guard-exception",
        file: "app/api/auth/magic-link/route.ts",
      }),
    );
  });

  it("treats an exception path absent from an exact-revision tree as inapplicable", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await rm(path.join(root, "app/api/auth/magic-link/route.ts"));
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({
      root,
      allowAbsentExceptionMatches: true,
    });

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }));
  });

  it("rejects an absent exception path by default on the blocking guard", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await rm(path.join(root, "app/api/auth/magic-link/route.ts"));
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "stale-guard-exception",
        file: "app/api/auth/magic-link/route.ts",
      }),
    );
  });

  it("accepts a type-only session-client reference outside the auth owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/services/session-client-type.ts",
      `import type { createClient } from "@/app/server/auth/supabase";
export type SessionClient = Awaited<ReturnType<typeof createClient>>;`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }));
  });

  it("does not mistake route-AI repository types for a runtime repository bypass", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/agent/route-ai-comment-generation.ts",
      `import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type { LlmUsageEventStatus } from "@/app/server/repository/llm-usage-events";
export type RouteAiInputs = {
  db: RepositoryDbHandle;
  status: LlmUsageEventStatus;
};`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result).toEqual(expect.objectContaining({ ok: true, violations: [] }));
  });

  it("rejects any newly exported raw-principal reviewed-paper helper", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/reviewed-paper-access.ts",
      `export function listMyReviewedPapers() { return []; }
export function resolveMyReviewedPapersLibraryContextSource() { return []; }
export function markMyReviewedPaper(paper: unknown) { return paper; }
export function unmarkMyReviewedPaper(paperId: string) { return paperId; }
export function resolveArbitraryLibrary(db: unknown, userId: string) { return [db, userId]; }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining([
        "reviewed-paper-export-surface",
        "reviewed-paper-raw-authority-parameter",
      ]),
    );
  });

  it("rejects service-role imports, re-exports, and environment-key duplication", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/services/unsafe.ts",
      `import { createAdminClient } from "@/app/server/auth/supabase";
export { createAdminClient } from "@/app/server/auth/supabase";
export const key = "SUPABASE_SERVICE_ROLE_KEY";
export const db = createAdminClient();`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining(["service-role-client-caller", "service-role-environment-owner"]),
    );
  });

  it("rejects privileged forwarding through an otherwise allowed owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/auth/identity.ts",
      `import { createAdminClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
const forwarded = createAdminClient;
const forwardedAgain = forwarded;
export { forwardedAgain };
export function auth() { return createRepositoryDbHandle(createAdminClient()); }`,
    );
    await write(
      root,
      "app/server/domain-access/forwarded-repository.ts",
      `export { upsertAppUserSnapshot } from "@/app/server/repository/app-users";`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining(["privileged-local-forwarding", "repository-runtime-re-export"]),
    );
  });

  it("rejects parallel Supabase factories and scans root and packages production sources", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "instrumentation-client.ts",
      `import { SupabaseClient } from "@supabase/supabase-js";
const key = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
export const db = new SupabaseClient("url", process.env[key] ?? "");`,
    );
    await write(
      root,
      "packages/server/unsafe.ts",
      `import { upsertAppUserSnapshot } from "@/app/server/repository/app-users";
export const row = upsertAppUserSnapshot({});`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "supabase-factory-caller",
          file: "instrumentation-client.ts",
        }),
        expect.objectContaining({
          rule: "repository-runtime-caller",
          file: "packages/server/unsafe.ts",
        }),
      ]),
    );
  });

  it("rejects non-static privileged acquisition even inside an allowed owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/auth/identity.ts",
      `const admin = require("@/app/server/auth/supabase");
export async function load() { return import("@/app/server/auth/supabase"); }
export function auth() { return admin.createAdminClient(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "service-role-client-caller"),
    ).toHaveLength(2);
  });

  it("rejects a raw service-role client returned by an otherwise allowed auth owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/auth/identity.ts",
      `import { createAdminClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
void createRepositoryDbHandle;
export function auth() { return createAdminClient(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "raw-service-role-client-exposure",
        file: "app/server/auth/identity.ts",
      }),
    );
  });

  it("keeps repository handle creation and raw unwrapping with their authority owners", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/unsafe-db-handle.ts",
      `import { createRepositoryDbHandle, unwrapRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
export const capabilities = [createRepositoryDbHandle, unwrapRepositoryDbHandle];`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "repository-db-capability-caller"),
    ).toHaveLength(2);
  });

  it("resolves computed import and require specifiers before repository authorization", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/computed-db-import.ts",
      `const target = "../repository/" + "db";
export async function leak(handle: unknown) {
  const { getRepositoryDbFor } = await import(target);
  return getRepositoryDbFor(handle);
}`,
    );
    await write(
      root,
      "app/server/domain-access/computed-db-require.ts",
      `const directory = "../repository";
const target = \`\${directory}/db\`;
export function leak(handle: unknown) {
  const { getRepositoryDbFor } = require(target);
  return getRepositoryDbFor(handle);
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "repository-db-capability-caller"),
    ).toHaveLength(2);
  });

  it("rejects unresolved dynamic module acquisition in production source", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/services/unresolved-module.ts",
      `export async function load(moduleName: string) { return import(moduleName); }
export function loadSync(moduleName: string) { return require(moduleName); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "non-static-module-acquisition"),
    ).toHaveLength(2);
  });

  it("rejects repository wrappers that return or callback with an unwrapped raw client", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/raw-db-leak.ts",
      `import { getRepositoryDbFor } from "@/app/server/repository/db";
export function exposeRepositoryDb(handle: unknown) { return getRepositoryDbFor(handle); }
export function withRepositoryDb(handle: unknown, sink: (db: unknown) => unknown) {
  return sink(getRepositoryDbFor(handle));
}`,
    );
    await write(
      root,
      "app/server/domain-access/raw-db-return-leak.ts",
      `import { exposeRepositoryDb } from "@/app/server/repository/raw-db-leak";
export function leak(handle: unknown) {
  const raw = exposeRepositoryDb(handle) as Record<string, (table: string) => unknown>;
  return raw[["fr", "om"].join("")]("reviewed_papers");
}`,
    );
    await write(
      root,
      "app/server/domain-access/raw-db-callback-leak.ts",
      `import { withRepositoryDb } from "@/app/server/repository/raw-db-leak";
export function leak(handle: unknown) {
  return withRepositoryDb(handle, (raw) => raw);
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" && item.file.includes("raw-db-return-leak"),
      ),
    ).toHaveLength(1);
    expect(
      result.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" && item.file.includes("raw-db-callback-leak"),
      ),
    ).toHaveLength(1);
  });

  it("rejects static and dynamic repository acquisition outside allowed policy owners", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/agent/unsafe.ts",
      `import { upsertAppUserSnapshot } from "@/app/server/repository/app-users";
export const value = upsertAppUserSnapshot({});`,
    );
    await write(
      root,
      "app/server/services/dynamic-unsafe.ts",
      `export async function load() { return import("@/app/server/repository/app-users"); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "repository-runtime-caller"),
    ).toHaveLength(2);
  });

  it("keeps canonical gap reservation capability inside its exact domain-access owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/gap-reports.ts",
      `export function reserveGapReportUnchecked() { return { id: "gap-1" }; }`,
    );
    await write(
      root,
      "app/server/domain-access/gap-network-view-access.ts",
      `import { reserveGapReportUnchecked } from "@/app/server/repository/gap-reports";
export const reserveGapNetworkView = reserveGapReportUnchecked;`,
    );
    await write(
      root,
      "app/server/services/unsafe-gap-reservation.ts",
      `import { reserveGapReportUnchecked } from "@/app/server/repository/gap-reports";
export const reserve = reserveGapReportUnchecked;`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(
      result.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" &&
          item.file === "app/server/domain-access/gap-network-view-access.ts",
      ),
    ).toHaveLength(0);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "repository-runtime-caller",
        file: "app/server/services/unsafe-gap-reservation.ts",
      }),
    );
  });

  it("allows the retired gap reservation imports only for exact historical collection", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/gap-reports.ts",
      `export function createGapReportUnchecked() { return { id: "gap-1" }; }
export function getGapReportBySourceInputDigestUnchecked() { return { id: "gap-1" }; }`,
    );
    await write(
      root,
      "app/server/domain-access/gap-network-view-access.ts",
      `import {
  createGapReportUnchecked,
  getGapReportBySourceInputDigestUnchecked,
} from "@/app/server/repository/gap-reports";
export const reserveGapNetworkView = [
  createGapReportUnchecked,
  getGapReportBySourceInputDigestUnchecked,
];`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const blocking = await runLeastAuthorityBoundaryGuard({ root });
    const historical = await runLeastAuthorityBoundaryGuard({
      root,
      allowHistoricalGapReservationImports: true,
    });

    expect(
      blocking.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" &&
          item.file === "app/server/domain-access/gap-network-view-access.ts",
      ),
    ).toHaveLength(2);
    expect(
      historical.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" &&
          item.file === "app/server/domain-access/gap-network-view-access.ts",
      ),
    ).toHaveLength(0);

    await write(
      root,
      "app/server/repository/gap-reports.ts",
      `export function createGapReportUnchecked() { return { id: "gap-1" }; }
export function getGapReportBySourceInputDigestUnchecked() { return { id: "gap-1" }; }
export async function reserveGapReportUnchecked() { return { id: "gap-1" }; }`,
    );
    const currentTree = await runLeastAuthorityBoundaryGuard({
      root,
      allowHistoricalGapReservationImports: true,
    });

    expect(
      currentTree.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" &&
          item.file === "app/server/domain-access/gap-network-view-access.ts",
      ),
    ).toHaveLength(2);
  });

  it("rejects a parallel domain-access path that can select an arbitrary reviewed-paper owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/parallel-reviewed-paper-access.ts",
      `import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";
export function listReviewedPapersForOwner(db: unknown, ownerId: string) {
  return listReviewedPapers(db, ownerId);
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "reviewed-paper-repository-caller",
        file: "app/server/domain-access/parallel-reviewed-paper-access.ts",
      }),
    );
  });

  it("rejects static element table access outside the repository owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/parallel-reviewed-paper-table-access.ts",
      `const TABLE = "reviewed_papers";
export function listReviewedPapersForOwner(
  db: { from(table: string): unknown },
  ownerId: string,
) {
  void ownerId;
  return db["from"](TABLE);
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations).toContainEqual(
      expect.objectContaining({
        rule: "repository-table-owner",
        file: "app/server/domain-access/parallel-reviewed-paper-table-access.ts",
      }),
    );
  });

  it("rejects extracted table capabilities before call, apply, or bind forwarding", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/parallel-reviewed-paper-table-alias.ts",
      `const TABLE = "reviewed_papers";
export function listReviewedPapersForOwner(
  db: { from(table: string): unknown },
  ownerId: string,
) {
  void ownerId;
  const callFrom = db["from"];
  const applyFrom = db.from;
  const bindFrom = db.from;
  const invoke = (method: typeof callFrom) => method.call(db, TABLE);
  const called = callFrom.call(db, TABLE);
  const applied = applyFrom.apply(db, [TABLE]);
  const bound = bindFrom.bind(db);
  const { from: destructuredFrom } = db;
  const { db: connection } = { db };
  const { from } = connection;
  let assignedFrom: typeof callFrom;
  assignedFrom = db.from;
  return [
    called,
    applied,
    bound(TABLE),
    invoke(destructuredFrom),
    invoke(from),
    invoke(assignedFrom),
  ];
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    const aliasViolations = result.violations.filter(
      (item) =>
        item.rule === "repository-table-owner" &&
        item.file === "app/server/domain-access/parallel-reviewed-paper-table-alias.ts",
    );
    expect(
      aliasViolations.filter((item) => item.detail.includes("extracted-capability")),
    ).toHaveLength(6);
    expect(
      aliasViolations.filter((item) => item.detail.includes("extracted-alias-forwarding")),
    ).toHaveLength(3);
  });

  it("rejects a new caller and namespace import of trusted domain capabilities", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/llm-usage-access.ts",
      `export function createLlmJudgmentUsageLedgerForTrustedAgent() { return {}; }`,
    );
    await write(
      root,
      "app/server/services/unsafe-ledger.ts",
      `import { createLlmJudgmentUsageLedgerForTrustedAgent } from "@/app/server/domain-access/llm-usage-access";
export const ledger = createLlmJudgmentUsageLedgerForTrustedAgent();`,
    );
    await write(
      root,
      "app/server/services/unsafe-namespace.ts",
      `import * as usage from "@/app/server/domain-access/llm-usage-access";
export const ledger = usage.createLlmJudgmentUsageLedgerForTrustedAgent();`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining([
        "privileged-domain-caller",
        "privileged-domain-namespace-acquisition",
      ]),
    );
  });

  it("keeps gap enrichment retry authority on the exact command route and domain owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/gap-network-build-state.ts",
      `export function queueGapNetworkEnrichmentRetry() { return {}; }`,
    );
    await write(
      root,
      "app/server/domain-access/gap-network-view-access.ts",
      `import { queueGapNetworkEnrichmentRetry } from "@/app/server/domain-access/gap-network-build-state";
export function requestGapNetworkEnrichmentRetry() { return queueGapNetworkEnrichmentRetry(); }
export function startGapNetworkBuildJob() { return {}; }`,
    );
    await write(
      root,
      "app/api/gap-reports/[id]/enrichment-retry/route.ts",
      `import { requestGapNetworkEnrichmentRetry, startGapNetworkBuildJob } from "@/app/server/domain-access/gap-network-view-access";
export function POST() { return [requestGapNetworkEnrichmentRetry(), startGapNetworkBuildJob()]; }`,
    );
    await write(
      root,
      "app/api/gap-reports/[id]/unsafe-retry/route.ts",
      `import { requestGapNetworkEnrichmentRetry } from "@/app/server/domain-access/gap-network-view-access";
export function POST() { return requestGapNetworkEnrichmentRetry(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(
      result.violations.filter(
        (item) =>
          item.rule === "privileged-domain-caller" &&
          item.file === "app/api/gap-reports/[id]/enrichment-retry/route.ts",
      ),
    ).toEqual([]);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "privileged-domain-caller",
          file: "app/api/gap-reports/[id]/unsafe-retry/route.ts",
        }),
      ]),
    );
  });

  it("keeps principal admission RPC capability inside its exact domain-access owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/gap-build-principal-admissions.ts",
      `export function claimGapBuildPrincipalAdmission() { return {}; }
export function releaseGapBuildPrincipalAdmission() { return {}; }`,
    );
    await write(
      root,
      "app/server/domain-access/gap-build-principal-admission.ts",
      `import { claimGapBuildPrincipalAdmission, releaseGapBuildPrincipalAdmission } from "@/app/server/repository/gap-build-principal-admissions";
export function admitGapBuildForPrincipal() { return claimGapBuildPrincipalAdmission(); }
export function releaseGapBuildForPrincipal() { return releaseGapBuildPrincipalAdmission(); }`,
    );
    await write(
      root,
      "app/api/gap-reports/unsafe-admission/route.ts",
      `import { claimGapBuildPrincipalAdmission } from "@/app/server/repository/gap-build-principal-admissions";
export function POST() { return claimGapBuildPrincipalAdmission(); }`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(
      result.violations.filter(
        (item) =>
          item.rule === "repository-runtime-caller" &&
          item.file === "app/server/domain-access/gap-build-principal-admission.ts",
      ),
    ).toEqual([]);
    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "repository-runtime-caller",
          file: "app/api/gap-reports/unsafe-admission/route.ts",
        }),
      ]),
    );
  });

  it("keeps invited-access membership inside the registered repository and admin/auth owners", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/access-allowlist.ts",
      `export function getAccessAllowlistEntryUnchecked() { return null; }
export function listAccessAllowlistEntriesUnchecked() { return []; }
export function upsertAccessAllowlistEntryUnchecked() { return undefined; }
export function deleteAccessAllowlistEntryUnchecked() { return undefined; }`,
    );
    await write(
      root,
      "app/server/domain-access/access-allowlist-access.ts",
      `import {
  getAccessAllowlistEntryUnchecked,
  listAccessAllowlistEntriesUnchecked,
  upsertAccessAllowlistEntryUnchecked,
  deleteAccessAllowlistEntryUnchecked,
} from "@/app/server/repository/access-allowlist";
export function resolveProductAccessForEmail() { return getAccessAllowlistEntryUnchecked(); }
export function listInvitedAccessForAdmin() { return listAccessAllowlistEntriesUnchecked(); }
export function updateInvitedAccessMembershipForAdmin(operation = "add") {
  return operation === "add"
    ? upsertAccessAllowlistEntryUnchecked()
    : deleteAccessAllowlistEntryUnchecked();
}`,
    );
    await write(
      root,
      "app/server/auth/identity.ts",
      `import { createAdminClient, createClient } from "@/app/server/auth/supabase";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { resolveProductAccessForEmail } from "@/app/server/domain-access/access-allowlist-access";
export async function auth() {
  await createClient();
  const db = createRepositoryDbHandle(createAdminClient());
  return resolveProductAccessForEmail(db, "pilot@example.com");
}
export function resolveCurrentProductAccessForEmail() { return auth(); }`,
    );
    await write(
      root,
      "app/api/auth/magic-link/route.ts",
      `import { resolveCurrentProductAccessForEmail } from "@/app/server/auth/identity";
export function POST() { return resolveCurrentProductAccessForEmail(); }`,
    );
    await write(
      root,
      "app/(admin)/admin/access/page.tsx",
      `import { listInvitedAccessForAdmin } from "@/app/server/domain-access/access-allowlist-access";
export default function Page() { return listInvitedAccessForAdmin(); }`,
    );
    await write(
      root,
      "app/(admin)/admin/access/actions.ts",
      `import { updateInvitedAccessMembershipForAdmin } from "@/app/server/domain-access/access-allowlist-access";
export function update() { return updateInvitedAccessMembershipForAdmin(); }`,
    );
    await write(
      root,
      "app/server/services/unsafe-access-allowlist.ts",
      `import { upsertAccessAllowlistEntryUnchecked } from "@/app/server/repository/access-allowlist";
import { updateInvitedAccessMembershipForAdmin } from "@/app/server/domain-access/access-allowlist-access";
import { resolveCurrentProductAccessForEmail } from "@/app/server/auth/identity";
export function bypass(db: { from: (name: string) => unknown }) {
  return [
    upsertAccessAllowlistEntryUnchecked(),
    updateInvitedAccessMembershipForAdmin(),
    resolveCurrentProductAccessForEmail(),
    db.from("access_allowlist_entries"),
  ];
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "repository-runtime-caller",
          file: "app/server/services/unsafe-access-allowlist.ts",
        }),
        expect.objectContaining({
          rule: "privileged-domain-caller",
          file: "app/server/services/unsafe-access-allowlist.ts",
        }),
        expect.objectContaining({
          rule: "repository-table-owner",
          file: "app/server/services/unsafe-access-allowlist.ts",
        }),
      ]),
    );
    expect(
      result.violations.some(
        (violation) =>
          violation.rule === "privileged-domain-caller" &&
          violation.file === "app/server/services/unsafe-access-allowlist.ts" &&
          violation.detail.includes("resolveCurrentProductAccessForEmail"),
      ),
    ).toBe(true);
  });

  it("keeps shared inline cache mutation capability inside its domain-access owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/unsafe-inline-cache.ts",
      `import { claimSharedPaperInlineAnalysisGeneration } from "@/app/server/repository/paper-inline-analysis-cache";
export { completeSharedPaperInlineAnalysisGeneration } from "@/app/server/repository/paper-inline-analysis-cache";
export const claim = claimSharedPaperInlineAnalysisGeneration;`,
    );
    await write(
      root,
      "app/server/domain-access/unsafe-inline-cache-namespace.ts",
      `import * as cache from "@/app/server/repository/paper-inline-analysis-cache";
export const release = cache.releaseSharedPaperInlineAnalysisGeneration;`,
    );
    await write(
      root,
      "app/server/domain-access/unsafe-inline-cache-dynamic.ts",
      `export async function load() {
  return import("@/app/server/repository/paper-inline-analysis-cache");
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(result.violations.map((item) => item.rule)).toEqual(
      expect.arrayContaining([
        "repository-runtime-caller",
        "repository-runtime-re-export",
        "privileged-local-forwarding",
      ]),
    );
  });

  it("rejects expanding the shared inline-cache repository value export surface", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/paper-inline-analysis-cache.ts",
      `export function listSharedPaperInlineAnalysisCache() { return []; }
export function claimSharedPaperInlineAnalysisGeneration() { return []; }
export function completeSharedPaperInlineAnalysisGeneration() { return []; }
export function releaseSharedPaperInlineAnalysisGeneration() { return []; }
export function unsafeSharedCacheWrapper() { return []; }`,
    );
    await write(
      root,
      "app/server/domain-access/unsafe-inline-cache-wrapper.ts",
      `import { unsafeSharedCacheWrapper } from "@/app/server/repository/paper-inline-analysis-cache";
export const cache = unsafeSharedCacheWrapper();`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "privileged-domain-export-surface",
          file: "app/server/repository/paper-inline-analysis-cache.ts",
        }),
      ]),
    );
  });

  it("rejects direct RPC member acquisition outside its repository owner", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/unsafe-inline-cache.ts",
      `export function bypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc("complete_paper_inline_analysis_generation", {});
}
export function bracketBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db["rpc"]("release_paper_inline_analysis_generation", {});
}
const rpcMethod = "rpc";
export function computedMethodBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db[rpcMethod]("complete_paper_inline_analysis_generation", {});
}
const shadowedRpcName = "complete_paper_inline_analysis_generation";
export function shadowedResourceBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db[rpcMethod](shadowedRpcName, {});
}
export function unrelatedScope() {
  const shadowedRpcName = "unrelated_maintenance_rpc";
  return shadowedRpcName;
}
const reconstructedRpc = "claim_paper_inline_analysis_generation";
export function aliasBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc(reconstructedRpc, {});
}
export function joinedNameBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc(["list", "paper", "inline", "analysis", "cache"].join("_"), {});
}
export function parenthesizedPropertyBypass(db: { rpc: (name: string, args: unknown) => unknown }) {
  return (db.rpc)("complete_paper_inline_analysis_generation", {});
}
export function unrelatedRpc(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc("unrelated_maintenance_rpc", {});
}
export const harmlessMetadata = "paper_inline_analysis_cache";`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    const repositoryViolations = result.violations.filter(
      (item) => item.file === "app/server/repository/unsafe-inline-cache.ts",
    );
    expect(
      repositoryViolations.filter((item) => item.rule === "restricted-repository-rpc-caller"),
    ).toHaveLength(5);
    expect(
      repositoryViolations.filter(
        (item) => item.rule === "restricted-repository-dynamic-capability",
      ),
    ).toHaveLength(2);
    expect(repositoryViolations.map((item) => item.detail).join("\n")).not.toContain(
      "unrelated_maintenance_rpc",
    );
  });

  it("rejects direct shared inline-cache table access outside security-definer RPCs", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/unsafe-inline-table.ts",
      `export function bypass(db: { from: (name: string) => unknown }) {
  return db.from("paper_inline_analysis_cache");
}
const fromMethod = "from";
export function computedMethodBypass(db: { from: (name: string) => unknown }) {
  return db[fromMethod]("paper_inline_analysis_cache");
}
export function unrelatedTable(db: { from: (name: string) => unknown }) {
  return db.from("unrelated_table");
}
export const harmlessMetadata = "paper_inline_analysis_cache";`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(
      result.violations.filter(
        (item) =>
          item.rule === "restricted-repository-table-caller" &&
          item.file === "app/server/repository/unsafe-inline-table.ts",
      ),
    ).toHaveLength(2);
  });

  it("rejects dynamic RPC acquisition outside registered owners", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/dynamic-inline-cache.ts",
      `export function dynamicRpc(db: { rpc: (name: string) => unknown }, name: string) {
  return db.rpc(name);
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rule: "restricted-repository-dynamic-capability" }),
      ]),
    );
  });

  it("rejects RPC resource names shadowed through destructuring bindings", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/destructured-shadow-inline-cache.ts",
      `const objectRpcName = "unrelated_maintenance_rpc";
export function objectShadow(
  db: { rpc: (name: string, args: unknown) => unknown },
  { objectRpcName }: { objectRpcName: string },
) {
  return db.rpc(objectRpcName, {});
}
const arrayRpcName = "unrelated_maintenance_rpc";
export function arrayShadow(
  db: { rpc: (name: string, args: unknown) => unknown },
  input: string[],
) {
  const [arrayRpcName] = input;
  return db.rpc(arrayRpcName, {});
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(
      result.violations.filter(
        (item) =>
          item.rule === "restricted-repository-dynamic-capability" &&
          item.file === "app/server/repository/destructured-shadow-inline-cache.ts",
      ),
    ).toHaveLength(2);
  });

  it("separates protected, unrelated, and dynamic RPC resources", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/scoped-inline-cache.ts",
      `const protectedRpc = "claim_paper_inline_analysis_generation";
export function protectedCall(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc(protectedRpc, {});
}
export function unrelatedCall(db: { rpc: (name: string, args: unknown) => unknown }) {
  return db.rpc("unrelated_maintenance_rpc", {});
}
export function dynamicCall(
  db: { rpc: (name: string, args: unknown) => unknown },
  rpcName: string,
) {
  return db.rpc(rpcName, {});
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    const scopedViolations = result.violations.filter(
      (item) => item.file === "app/server/repository/scoped-inline-cache.ts",
    );
    expect(
      scopedViolations.filter((item) => item.rule === "restricted-repository-rpc-caller"),
    ).toHaveLength(1);
    expect(
      scopedViolations.filter((item) => item.rule === "restricted-repository-dynamic-capability"),
    ).toHaveLength(1);
    expect(scopedViolations.map((item) => item.detail).join("\n")).not.toContain(
      "unrelated_maintenance_rpc",
    );
  });

  it("unwraps direct RPC access but ignores generic computed dispatch", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/repository/computed-inline-cache.ts",
      `type Rpc = (name: string, args: unknown) => unknown;
export function castBypass(
  db: { rpc: Rpc },
) {
  return (db.rpc as Rpc)("complete_paper_inline_analysis_generation", {});
}
export function nonNullBypass(db: { rpc?: Rpc }) {
  return db.rpc!("complete_paper_inline_analysis_generation", {});
}
export function satisfiesBypass(db: { rpc: Rpc }) {
  return (db.rpc satisfies Rpc)("complete_paper_inline_analysis_generation", {});
}
export function boundBypass(db: { rpc: Rpc }) {
  const callRpc = db.rpc.bind(db);
  return callRpc("complete_paper_inline_analysis_generation", {});
}
export function harmlessDispatch(
  handlers: Record<string, (name: string, args: unknown) => unknown>,
  eventName: string,
  payloadName: string,
) {
  return handlers[eventName](payloadName, {});
}`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    const computedViolations = result.violations.filter(
      (item) => item.file === "app/server/repository/computed-inline-cache.ts",
    );
    expect(
      computedViolations.filter((item) => item.rule === "restricted-repository-rpc-caller"),
    ).toHaveLength(3);
    expect(
      computedViolations.filter((item) => item.rule === "restricted-repository-dynamic-capability"),
    ).toHaveLength(1);
  });

  it("rejects renamed function and arrow raw-principal domain exports", async () => {
    const root = await fixtureRoot();
    await writeHealthyFixture(root);
    await write(
      root,
      "app/server/domain-access/inline-analysis-access.ts",
      `export function resolveInlineAnalysis() { return []; }
export function resolveInlineAnalysisRaw(db: unknown, userId: string) { return [db, userId]; }`,
    );
    await write(
      root,
      "app/server/domain-access/llm-usage-access.ts",
      `export const writeUsageRaw = (db: unknown, ownerPrincipalId: string) => [db, ownerPrincipalId];`,
    );
    const { runLeastAuthorityBoundaryGuard } = await loadGuard();

    const result = await runLeastAuthorityBoundaryGuard({ root });

    expect(result.ok).toBe(false);
    expect(
      result.violations.filter((item) => item.rule === "privileged-domain-export-surface"),
    ).toHaveLength(2);
  });
});
