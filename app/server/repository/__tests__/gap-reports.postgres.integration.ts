import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type {
  GapNetworkCreateResearchRoutePayloadParams,
  GapNetworkMetadata,
  GapNetworkResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import {
  createRepositoryDbHandle,
  type RepositoryDbHandle,
} from "@/app/lib/supabase/repository-db-handle";
import {
  markGapNetworkBuildAttemptStarted,
  queueGapNetworkEnrichmentRetry,
  type GapNetworkBuildAttemptStart,
} from "@/app/server/domain-access/gap-network-build-state";
import { persistSearchBackedKnowledgeMapDocument } from "@/app/server/domain-access/search-backed-knowledge-map-persistence";
import {
  createGapReportUnchecked,
  getGapReportUnchecked,
  reserveGapReportUnchecked,
  updateGapReportIfVersionUnchecked,
} from "@/app/server/repository/gap-reports";

const API_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_API_URL");
const DATABASE_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_DATABASE_URL");
const SERVICE_ROLE_KEY = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_SERVICE_ROLE_KEY");

function requireIntegrationEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; use npm run test:db:gap-report-concurrency`);
  return value;
}

function createBarrier(participantCount: number): () => Promise<void> {
  let arrivals = 0;
  let release: (() => void) | undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrivals += 1;
    if (arrivals === participantCount) release?.();
    await released;
  };
}

function createRequestBarrier(
  method: "PATCH" | "POST",
  participantCount: number,
): {
  fetch: typeof globalThis.fetch;
  matchedRequests: () => number;
} {
  const rendezvous = createBarrier(participantCount);
  const nativeFetch = globalThis.fetch.bind(globalThis);
  let matchedRequests = 0;

  return {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (
        request.method === method &&
        new URL(request.url).pathname.endsWith("/rest/v1/gap_reports")
      ) {
        matchedRequests += 1;
        await rendezvous();
      }
      return nativeFetch(request);
    },
    matchedRequests: () => matchedRequests,
  };
}

function createBarrierDbHandles(method: "PATCH" | "POST"): {
  dbA: RepositoryDbHandle;
  dbB: RepositoryDbHandle;
  matchedRequests: () => number;
} {
  const requestBarrier = createRequestBarrier(method, 2);
  return {
    dbA: createRepositoryDbHandle(createIntegrationClient(requestBarrier.fetch)),
    dbB: createRepositoryDbHandle(createIntegrationClient(requestBarrier.fetch)),
    matchedRequests: requestBarrier.matchedRequests,
  };
}

function createIntegrationClient(fetch?: typeof globalThis.fetch): SupabaseClient {
  return createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    ...(fetch ? { global: { fetch } } : {}),
  }) as unknown as SupabaseClient;
}

function createServiceRoleDbHandle(): RepositoryDbHandle {
  return createRepositoryDbHandle(createIntegrationClient());
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildMetadata(
  sourceSnapshotId: string,
  build?: GapNetworkMetadata["gapNetworkBuild"],
): GapNetworkMetadata {
  return {
    type: "gap_network",
    version: 1,
    sourceSnapshotId,
    query: "postgresql concurrency",
    papers: [],
    gapNetworkReport: {
      clusters: [],
      conceptEdges: [],
      gapPairs: [],
      metrics: { clusterCount: 0, totalPaperCount: 0, totalEdgeCount: 0, gapPairCount: 0 },
      insight: { hypotheses: [] },
    },
    ...(build ? { gapNetworkBuild: build } : {}),
  };
}

function buildCreateParams(params: {
  namespace: string;
  viewerPrincipalId: string;
  label: string;
  build?: GapNetworkMetadata["gapNetworkBuild"];
}): GapNetworkCreateResearchRoutePayloadParams {
  const sourceSnapshotId = `${params.namespace}-${params.label}`;
  return {
    viewerPrincipalId: params.viewerPrincipalId,
    type: "gap_network",
    title: `pending-${params.label}`,
    content: "",
    createdBy: "user",
    metadata: buildMetadata(sourceSnapshotId, params.build),
    refs: [sourceSnapshotId],
    status: "pending",
  };
}

function assertRaceInvariant(
  description: string,
  condition: boolean,
  diagnostics: unknown,
): asserts condition {
  if (condition) return;
  throw new Error(`${description}\n${JSON.stringify(diagnostics, null, 2)}`);
}

class GapReportIntegrationFixture {
  readonly admin = new Client({ connectionString: DATABASE_URL });
  readonly dbA = createServiceRoleDbHandle();
  readonly dbB = createServiceRoleDbHandle();
  readonly reportIds = new Set<string>();
  readonly reportDigests = new Set<string>();
  namespace = "";

  async connect(): Promise<void> {
    await this.admin.connect();
  }

  beginScenario(): void {
    this.namespace = `lh426-${randomUUID()}`;
  }

  trackDigest(value: string): void {
    this.reportDigests.add(value);
  }

  trackReport(report: GapNetworkResearchRoutePayload): void {
    this.reportIds.add(report.id);
  }

  async cleanup(): Promise<void> {
    if (this.reportIds.size === 0 && this.reportDigests.size === 0) return;
    await this.admin.query(
      `delete from lighthouse.gap_reports
       where id = any($1::uuid[]) or source_input_digest = any($2::text[])`,
      [[...this.reportIds], [...this.reportDigests]],
    );
    this.reportIds.clear();
    this.reportDigests.clear();
  }

  async disconnect(): Promise<void> {
    await this.admin.end();
  }

  async createReport(params: {
    db?: RepositoryDbHandle;
    viewerPrincipalId?: string;
    label: string;
    build?: GapNetworkMetadata["gapNetworkBuild"];
  }): Promise<GapNetworkResearchRoutePayload> {
    const sourceDigest = digest(`${this.namespace}:${params.label}`);
    this.trackDigest(sourceDigest);
    const report = await createGapReportUnchecked(
      params.db ?? this.dbA,
      buildCreateParams({
        namespace: this.namespace,
        viewerPrincipalId: params.viewerPrincipalId ?? "session-a",
        label: params.label,
        build: params.build,
      }),
      sourceDigest,
    );
    this.trackReport(report);
    return report;
  }
}

async function runRawPostgresCasScenario(fixture: GapReportIntegrationFixture): Promise<void> {
  const report = await fixture.createReport({ label: "raw-cas" });
  const sessionA = new Client({ connectionString: DATABASE_URL });
  const sessionB = new Client({ connectionString: DATABASE_URL });
  await Promise.all([sessionA.connect(), sessionB.connect()]);
  const rendezvous = createBarrier(2);

  const updateInSession = async (session: Client, label: "winner-A" | "winner-B") => {
    await session.query("begin");
    try {
      const snapshot = await session.query<{ version: number; backend_pid: number }>(
        `select version, pg_backend_pid() as backend_pid
         from lighthouse.gap_reports where id = $1`,
        [report.id],
      );
      const snapshotRow = snapshot.rows.at(0);
      if (!snapshotRow) throw new Error(`session ${label} could not read the reserved row`);
      await rendezvous();
      const update = await session.query<{ title: string; content: string; version: number }>(
        `update lighthouse.gap_reports
         set title = $2, content = $2, version = version + 1
         where id = $1 and version = $3
         returning title, content, version`,
        [report.id, label, snapshotRow.version],
      );
      await session.query("commit");
      return {
        session: label,
        backendPid: snapshotRow.backend_pid,
        snapshotVersion: snapshotRow.version,
        affectedRows: update.rowCount,
        row: update.rows[0] ?? null,
      };
    } catch (error) {
      await session.query("rollback");
      throw error;
    }
  };

  try {
    const sessions = await Promise.all([
      updateInSession(sessionA, "winner-A"),
      updateInSession(sessionB, "winner-B"),
    ]);
    const latest = await getGapReportUnchecked(fixture.dbA, report.id, "observer");
    const diagnostics = { sessions, finalRow: latest };
    assertRaceInvariant(
      "CAS must use two distinct PostgreSQL sessions",
      sessions[0].backendPid !== sessions[1].backendPid,
      diagnostics,
    );
    assertRaceInvariant(
      "exactly one PostgreSQL CAS update must affect a row",
      sessions.filter((session) => session.affectedRows === 1).length === 1 &&
        sessions.filter((session) => session.affectedRows === 0).length === 1,
      diagnostics,
    );
    assertRaceInvariant(
      "the final row must advance exactly once and keep only the winning payload",
      latest?.version === report.version + 1 &&
        sessions.some(
          (session) =>
            session.affectedRows === 1 &&
            latest.title === session.session &&
            latest.content === session.session,
        ),
      diagnostics,
    );
  } finally {
    await Promise.all([sessionA.end(), sessionB.end()]);
  }
}

async function runRepositoryCasScenario(fixture: GapReportIntegrationFixture): Promise<void> {
  const report = await fixture.createReport({ label: "repository-cas" });
  const barrierClients = createBarrierDbHandles("PATCH");
  const update = async (
    db: RepositoryDbHandle,
    session: "winner-A" | "winner-B",
  ): Promise<{
    session: "winner-A" | "winner-B";
    result: GapNetworkResearchRoutePayload | null;
  }> => ({
    session,
    result: await updateGapReportIfVersionUnchecked(
      db,
      report.id,
      report.version,
      {
        title: session,
        content: session,
        metadata: report.metadata,
        refs: report.refs,
        status: "ready",
        version: report.version + 1,
      },
      session,
    ),
  });

  const sessions = await Promise.all([
    update(barrierClients.dbA, "winner-A"),
    update(barrierClients.dbB, "winner-B"),
  ]);
  const finalRow = await getGapReportUnchecked(fixture.dbA, report.id, "observer");
  const winner = sessions.find((session) => session.result !== null);
  const loser = sessions.find((session) => session.result === null);
  const raceDiagnostics = {
    sessions,
    finalRow,
    matchedPatchRequests: barrierClients.matchedRequests(),
  };
  assertRaceInvariant(
    "repository CAS must return one success and one conflict",
    barrierClients.matchedRequests() === 2 && winner !== undefined && loser !== undefined,
    raceDiagnostics,
  );
  const latestForLoser = await getGapReportUnchecked(
    loser.session === "winner-A" ? barrierClients.dbA : barrierClients.dbB,
    report.id,
    loser.session,
  );
  const diagnostics = {
    ...raceDiagnostics,
    latestForLoser,
  };
  assertRaceInvariant(
    "the losing repository caller must re-read the winning row",
    latestForLoser?.version === report.version + 1 &&
      latestForLoser.title === winner.session &&
      latestForLoser.viewerPrincipalId === loser.session,
    diagnostics,
  );
}

async function runEnrichmentRetryCasScenario(fixture: GapReportIntegrationFixture): Promise<void> {
  const created = await fixture.createReport({
    label: "enrichment-retry-cas",
    build: {
      core: "ready",
      enrichment: "failed",
      phase: "failed",
      attempt: 1,
      coreEvidence: "citation-semantic-graph-v2",
      updatedAt: "2026-08-12T00:00:00.000Z",
    },
  });
  const report = await updateGapReportIfVersionUnchecked(
    fixture.dbA,
    created.id,
    created.version,
    {
      metadata: {
        ...created.metadata,
        gapNetworkReport: {
          ...created.metadata.gapNetworkReport,
          gapPairs: [
            {
              id: "gap-1",
              leftClusterId: "cluster-1",
              rightClusterId: "cluster-2",
              leftLabel: "A",
              rightLabel: "B",
              displayLabel: "A-B gap",
              observed: 0,
              expected: 1,
              gapScore: 1,
              rank: 1,
              bridgeConcepts: [],
              leftConcepts: [],
              rightConcepts: [],
            },
          ],
          metrics: {
            clusterCount: 2,
            totalPaperCount: 1,
            totalEdgeCount: 1,
            gapPairCount: 1,
          },
        },
      },
      version: created.version + 1,
    },
    "fixture-seed",
  );
  if (!report) throw new Error("failed to seed retryable gap report");
  const barrierClients = createBarrierDbHandles("PATCH");
  const retry = (db: RepositoryDbHandle, session: string) =>
    queueGapNetworkEnrichmentRetry({
      db,
      runtimePrincipalId: session,
      document: report,
      nowMs: Date.parse("2026-08-12T00:00:01.000Z"),
    });

  const results = await Promise.all([
    retry(barrierClients.dbA, "session-a"),
    retry(barrierClients.dbB, "session-b"),
  ]);
  const finalRow = await getGapReportUnchecked(fixture.dbA, report.id, "observer");
  const diagnostics = { results, finalRow, matched: barrierClients.matchedRequests() };
  assertRaceInvariant(
    "two PostgreSQL sessions must race the enrichment retry CAS",
    barrierClients.matchedRequests() === 2,
    diagnostics,
  );
  assertRaceInvariant(
    "one retry queues and the concurrent loser converges on pending",
    results.filter((result) => result.outcome === "queued").length === 1 &&
      results.filter((result) => result.outcome === "pending").length === 1,
    diagnostics,
  );
  assertRaceInvariant(
    "the persisted report advances once, preserves ready core, and counts one retry",
    finalRow?.version === report.version + 1 &&
      finalRow.metadata.gapNetworkBuild?.core === "ready" &&
      finalRow.metadata.gapNetworkBuild.enrichment === "pending" &&
      finalRow.metadata.gapNetworkBuild.enrichmentRetryCount === 1,
    diagnostics,
  );
}

async function runCanonicalReservationScenario(
  fixture: GapReportIntegrationFixture,
): Promise<void> {
  const sharedDigest = digest(`${fixture.namespace}:shared-reservation`);
  fixture.trackDigest(sharedDigest);
  const barrierClients = createBarrierDbHandles("POST");
  const reserve = (db: RepositoryDbHandle, viewerPrincipalId: "session-a" | "session-b") =>
    reserveGapReportUnchecked(
      db,
      buildCreateParams({
        namespace: fixture.namespace,
        viewerPrincipalId,
        label: "shared-reservation",
      }),
      sharedDigest,
    );

  const shared = await Promise.all([
    reserve(barrierClients.dbA, "session-a"),
    reserve(barrierClients.dbB, "session-b"),
  ]);
  shared.forEach((report) => {
    fixture.trackReport(report);
  });
  const sharedRows = await fixture.admin.query<{ id: string }>(
    "select id from lighthouse.gap_reports where source_input_digest = $1",
    [sharedDigest],
  );

  const digestA = digest(`${fixture.namespace}:independent-a`);
  const digestB = digest(`${fixture.namespace}:independent-b`);
  fixture.trackDigest(digestA);
  fixture.trackDigest(digestB);
  const independent = await Promise.all([
    reserveGapReportUnchecked(
      fixture.dbA,
      buildCreateParams({
        namespace: fixture.namespace,
        viewerPrincipalId: "session-a",
        label: "independent-a",
      }),
      digestA,
    ),
    reserveGapReportUnchecked(
      fixture.dbB,
      buildCreateParams({
        namespace: fixture.namespace,
        viewerPrincipalId: "session-b",
        label: "independent-b",
      }),
      digestB,
    ),
  ]);
  independent.forEach((report) => {
    fixture.trackReport(report);
  });

  const diagnostics = {
    shared,
    sharedRows: sharedRows.rows,
    independent,
    matchedInsertRequests: barrierClients.matchedRequests(),
  };
  assertRaceInvariant(
    "same-digest reservations must issue two competing inserts and converge on one artifact id",
    barrierClients.matchedRequests() === 2 &&
      shared[0].id === shared[1].id &&
      sharedRows.rowCount === 1 &&
      sharedRows.rows[0]?.id === shared[0].id,
    diagnostics,
  );
  assertRaceInvariant(
    "different digests must create independent artifacts",
    independent[0].id !== independent[1].id,
    diagnostics,
  );
}

async function runLeaseAndStaleCommitScenario(fixture: GapReportIntegrationFixture): Promise<void> {
  const queued = await fixture.createReport({
    label: "lease",
    build: {
      core: "pending",
      enrichment: "pending",
      phase: "queued",
      attempt: 0,
      updatedAt: "2026-07-31T00:00:00.000Z",
    },
  });
  const barrierClients = createBarrierDbHandles("PATCH");
  const claim = async (
    db: RepositoryDbHandle,
    runtimePrincipalId: "session-a" | "session-b",
  ): Promise<{ session: "session-a" | "session-b"; claim: GapNetworkBuildAttemptStart }> => ({
    session: runtimePrincipalId,
    claim: await markGapNetworkBuildAttemptStarted({
      db,
      runtimePrincipalId,
      document: { ...queued, viewerPrincipalId: runtimePrincipalId },
    }),
  });

  const claims = await Promise.all([
    claim(barrierClients.dbA, "session-a"),
    claim(barrierClients.dbB, "session-b"),
  ]);
  const acquired = claims.find((result) => result.claim.acquired);
  const rejected = claims.find((result) => !result.claim.acquired);
  assertRaceInvariant(
    "one lease claim must be acquired and the losing runner must stop before provider work",
    barrierClients.matchedRequests() === 2 &&
      acquired !== undefined &&
      rejected !== undefined &&
      claims.filter((result) => result.claim.acquired).length === 1 &&
      claims.filter((result) => !result.claim.acquired).length === 1,
    { claims, matchedPatchRequests: barrierClients.matchedRequests() },
  );
  const firstAttempt = acquired.claim.document;

  await fixture.admin.query(
    `update lighthouse.gap_reports
     set metadata = jsonb_set(
       metadata,
       '{gapNetworkBuild,leaseExpiresAt}',
       to_jsonb($2::text),
       true
     ),
     version = version + 1
     where id = $1`,
    [queued.id, "2000-01-01T00:00:00.000Z"],
  );
  const expired = await getGapReportUnchecked(fixture.dbA, queued.id, "session-a");
  if (!expired) throw new Error("expired lease row disappeared");
  const secondAttempt = await markGapNetworkBuildAttemptStarted({
    db: fixture.dbB,
    runtimePrincipalId: "session-b",
    document: { ...expired, viewerPrincipalId: "session-b" },
  });
  assertRaceInvariant(
    "an expired lease must advance to a newer attempt",
    secondAttempt.acquired &&
      secondAttempt.document.metadata.gapNetworkBuild?.attempt ===
        (firstAttempt.metadata.gapNetworkBuild?.attempt ?? 0) + 1,
    { claims, expired, secondAttempt },
  );

  const stalePayload: GapNetworkCreateResearchRoutePayloadParams = {
    viewerPrincipalId: acquired.session,
    type: "gap_network",
    title: "stale-attempt-result",
    content: "stale-attempt-result",
    createdBy: firstAttempt.createdBy,
    metadata: {
      ...firstAttempt.metadata,
      gapNetworkBuild: {
        ...firstAttempt.metadata.gapNetworkBuild,
        core: "ready",
        enrichment: "ready",
        phase: "complete",
        updatedAt: "2026-07-31T00:01:00.000Z",
      },
    },
    refs: firstAttempt.refs,
    status: "ready",
  };

  await expect(
    persistSearchBackedKnowledgeMapDocument(fixture.dbA, firstAttempt, stalePayload, {
      buildOwnership: {
        attempt: firstAttempt.metadata.gapNetworkBuild?.attempt,
        leaseExpiresAt: firstAttempt.metadata.gapNetworkBuild?.leaseExpiresAt,
      },
    }),
  ).rejects.toThrow("gap_network report changed while updating");

  const finalRow = await getGapReportUnchecked(fixture.dbA, queued.id, "observer");
  const diagnostics = { claims, rejected, secondAttempt, finalRow };
  const finalBuild = finalRow?.metadata.gapNetworkBuild;
  const secondBuild = secondAttempt.document.metadata.gapNetworkBuild;
  assertRaceInvariant(
    "the stale-commit check must retain both build ownership records",
    finalRow !== null && finalBuild !== undefined,
    diagnostics,
  );
  assertRaceInvariant(
    "the stale attempt must not overwrite the newer attempt state or payload",
    finalBuild.attempt === secondBuild.attempt &&
      finalBuild.leaseExpiresAt === secondBuild.leaseExpiresAt &&
      finalRow.title !== "stale-attempt-result",
    diagnostics,
  );
}

describe("gap report PostgreSQL concurrency", () => {
  const fixture = new GapReportIntegrationFixture();

  beforeAll(async () => {
    await fixture.connect();
  });
  beforeEach(() => {
    fixture.beginScenario();
  });
  afterEach(async () => {
    await fixture.cleanup();
  });
  afterAll(async () => {
    await fixture.disconnect();
  });

  it("lets exactly one PostgreSQL session advance the same version and preserves its payload", async () => {
    await runRawPostgresCasScenario(fixture);
  });
  it("returns one repository success, one conflict, and lets the loser converge on latest", async () => {
    await runRepositoryCasScenario(fixture);
  });
  it("lets one session queue explicit enrichment retry and makes the loser observe pending", async () => {
    await runEnrichmentRetryCasScenario(fixture);
  });
  it("converges concurrent canonical reservations and keeps different digests independent", async () => {
    await runCanonicalReservationScenario(fixture);
  });
  it("grants one lease and rejects a stale attempt after a newer claim", async () => {
    await runLeaseAndStaleCommitScenario(fixture);
  });
});
