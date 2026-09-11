import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { GapNetworkCreateResearchRoutePayloadParams } from "@/app/domain/research-route-payload";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  claimGapBuildPrincipalAdmission,
  releaseGapBuildPrincipalAdmission,
} from "@/app/server/repository/gap-build-principal-admissions";
import { createGapReportUnchecked } from "@/app/server/repository/gap-reports";

const API_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_API_URL");
const DATABASE_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_DATABASE_URL");
const SERVICE_ROLE_KEY = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_SERVICE_ROLE_KEY");

function requireIntegrationEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; use npm run test:db:gap-report-concurrency`);
  return value;
}

function createDb() {
  const client = createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  }) as unknown as SupabaseClient;
  return createRepositoryDbHandle(client);
}

function reportParams(
  namespace: string,
  label: string,
): GapNetworkCreateResearchRoutePayloadParams {
  return {
    viewerPrincipalId: "session-a",
    type: "gap_network",
    title: `pending-${label}`,
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: `${namespace}-${label}`,
      query: "postgresql principal admission",
      papers: [],
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: { clusterCount: 0, totalPaperCount: 0, totalEdgeCount: 0, gapPairCount: 0 },
        insight: { hypotheses: [] },
      },
    },
    refs: [`${namespace}-${label}`],
    status: "pending",
  };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function verifyTerminalReissueFence(
  admin: Client,
  dbA: ReturnType<typeof createDb>,
  dbB: ReturnType<typeof createDb>,
  namespace: string,
  reportIds: Set<string>,
) {
  const reportA = await createGapReportUnchecked(
    dbA,
    reportParams(namespace, "terminal-a"),
    digest(`${namespace}:terminal-a`),
  );
  const reportB = await createGapReportUnchecked(
    dbA,
    reportParams(namespace, "terminal-b"),
    digest(`${namespace}:terminal-b`),
  );
  reportIds.add(reportA.id);
  reportIds.add(reportB.id);
  const principalId = `${namespace}-terminal-principal`;

  await expect(
    claimGapBuildPrincipalAdmission(dbA, {
      principalId,
      gapReportId: reportA.id,
      leaseToken: randomUUID(),
    }),
  ).resolves.toMatchObject({ outcome: "acquired" });
  await admin.query(
    `update lighthouse.gap_reports
     set status = 'ready',
       version = version + 1,
       metadata = jsonb_set(
         metadata,
         '{gapNetworkBuild}',
         '{"core":"ready","enrichment":"ready","phase":"complete","updatedAt":"2026-08-13T00:00:00.000Z"}'::jsonb
       )
     where id = $1`,
    [reportA.id],
  );

  const terminalReclaim = await claimGapBuildPrincipalAdmission(dbA, {
    principalId,
    gapReportId: reportA.id,
    leaseToken: randomUUID(),
  });
  expect(terminalReclaim).toMatchObject({ outcome: "acquired" });
  if (terminalReclaim.outcome !== "acquired") {
    throw new Error("terminal admission must be reclaimed once");
  }
  const duplicateLeaseToken = randomUUID();
  await expect(
    claimGapBuildPrincipalAdmission(dbB, {
      principalId,
      gapReportId: reportA.id,
      leaseToken: duplicateLeaseToken,
    }),
  ).resolves.toMatchObject({ outcome: "same_report", activeGapReportId: reportA.id });
  await expect(
    claimGapBuildPrincipalAdmission(dbB, {
      principalId,
      gapReportId: reportB.id,
      leaseToken: randomUUID(),
    }),
  ).resolves.toMatchObject({ outcome: "blocked", activeGapReportId: reportA.id });
  await expect(
    releaseGapBuildPrincipalAdmission(dbB, {
      principalId,
      gapReportId: reportA.id,
      leaseToken: duplicateLeaseToken,
    }),
  ).resolves.toBe(false);
  await expect(
    releaseGapBuildPrincipalAdmission(dbA, {
      principalId,
      gapReportId: reportA.id,
      leaseToken: terminalReclaim.leaseToken,
    }),
  ).resolves.toBe(true);
}

describe("gap build principal admission PostgreSQL concurrency", () => {
  const admin = new Client({ connectionString: DATABASE_URL });
  const dbA = createDb();
  const dbB = createDb();
  const reportIds = new Set<string>();
  let namespace = "";

  beforeAll(async () => {
    await admin.connect();
  });
  beforeEach(() => {
    namespace = `lh417-${randomUUID()}`;
  });
  afterEach(async () => {
    await admin.query("delete from lighthouse.gap_reports where id = any($1::uuid[])", [
      [...reportIds],
    ]);
    reportIds.clear();
  });
  afterAll(async () => {
    await admin.end();
  });

  it("admits one active report per principal and releases only the matching token", async () => {
    const reportA = await createGapReportUnchecked(
      dbA,
      reportParams(namespace, "a"),
      digest(`${namespace}:a`),
    );
    const reportB = await createGapReportUnchecked(
      dbA,
      reportParams(namespace, "b"),
      digest(`${namespace}:b`),
    );
    reportIds.add(reportA.id);
    reportIds.add(reportB.id);
    const principalId = `${namespace}-principal`;

    const claims = await Promise.all([
      claimGapBuildPrincipalAdmission(dbA, {
        principalId,
        gapReportId: reportA.id,
        leaseToken: randomUUID(),
      }),
      claimGapBuildPrincipalAdmission(dbB, {
        principalId,
        gapReportId: reportB.id,
        leaseToken: randomUUID(),
      }),
    ]);
    const acquired = claims.find((claim) => claim.outcome === "acquired");
    const blocked = claims.find((claim) => claim.outcome === "blocked");
    expect(acquired?.outcome).toBe("acquired");
    if (acquired?.outcome !== "acquired") throw new Error("one admission must be acquired");
    expect(blocked).toMatchObject({
      outcome: "blocked",
      activeGapReportId: acquired.activeGapReportId,
    });

    await expect(
      claimGapBuildPrincipalAdmission(dbB, {
        principalId,
        gapReportId: acquired.activeGapReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({ outcome: "same_report" });
    await expect(
      claimGapBuildPrincipalAdmission(dbB, {
        principalId: `${namespace}-other-principal`,
        gapReportId: acquired.activeGapReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({ outcome: "acquired" });

    await expect(
      releaseGapBuildPrincipalAdmission(dbA, {
        principalId,
        gapReportId: acquired.activeGapReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toBe(false);
    await expect(
      releaseGapBuildPrincipalAdmission(dbA, {
        principalId,
        gapReportId: acquired.activeGapReportId,
        leaseToken: acquired.leaseToken,
      }),
    ).resolves.toBe(true);
    const nextReportId = acquired.activeGapReportId === reportA.id ? reportB.id : reportA.id;
    const reclaimed = await claimGapBuildPrincipalAdmission(dbA, {
      principalId,
      gapReportId: nextReportId,
      leaseToken: randomUUID(),
    });
    expect(reclaimed).toMatchObject({ outcome: "acquired" });
    await expect(
      claimGapBuildPrincipalAdmission(dbB, {
        principalId,
        gapReportId: nextReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({
      outcome: "same_report",
      activeGapReportId: nextReportId,
    });
    await expect(
      claimGapBuildPrincipalAdmission(dbA, {
        principalId,
        gapReportId: acquired.activeGapReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({
      outcome: "blocked",
      activeGapReportId: nextReportId,
    });

    await admin.query(
      `update lighthouse.gap_build_principal_admissions
       set lease_expires_at = now() - interval '1 second'
       where principal_id = $1`,
      [principalId],
    );
    await expect(
      claimGapBuildPrincipalAdmission(dbB, {
        principalId,
        gapReportId: acquired.activeGapReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({ outcome: "acquired" });

    await admin.query(
      `update lighthouse.gap_reports
       set status = 'ready',
         version = version + 1,
         metadata = jsonb_set(
           metadata,
           '{gapNetworkBuild}',
           '{"core":"ready","enrichment":"ready","phase":"complete","updatedAt":"2026-08-13T00:00:00.000Z"}'::jsonb
         )
       where id = $1`,
      [acquired.activeGapReportId],
    );
    await expect(
      claimGapBuildPrincipalAdmission(dbA, {
        principalId,
        gapReportId: nextReportId,
        leaseToken: randomUUID(),
      }),
    ).resolves.toMatchObject({ outcome: "acquired" });
  });

  it("does not reissue a freshly reclaimed terminal report admission", async () => {
    await verifyTerminalReissueFence(admin, dbA, dbB, namespace, reportIds);
  });

  it("keeps SECURITY DEFINER admission RPCs fixed-path and service-role-only", async () => {
    const functions = await admin.query<{
      function_name: string;
      security_definer: boolean;
      fixed_search_path: boolean;
      anon_execute: boolean;
      authenticated_execute: boolean;
      service_role_execute: boolean;
    }>(
      `select
         p.proname as function_name,
         p.prosecdef as security_definer,
         p.proconfig @> array['search_path=pg_catalog, lighthouse']::text[] as fixed_search_path,
         has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
         has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute
       from pg_proc as p
       where p.oid in (
         'lighthouse.claim_gap_build_principal_admission(text,uuid,text,integer)'::regprocedure,
         'lighthouse.release_gap_build_principal_admission(text,uuid,text)'::regprocedure
       )
       order by p.proname`,
    );
    expect(functions.rows).toEqual([
      {
        function_name: "claim_gap_build_principal_admission",
        security_definer: true,
        fixed_search_path: true,
        anon_execute: false,
        authenticated_execute: false,
        service_role_execute: true,
      },
      {
        function_name: "release_gap_build_principal_admission",
        security_definer: true,
        fixed_search_path: true,
        anon_execute: false,
        authenticated_execute: false,
        service_role_execute: true,
      },
    ]);

    const tablePrivileges = await admin.query<{
      anon_direct_dml: boolean;
      authenticated_direct_dml: boolean;
      service_role_direct_dml: boolean;
    }>(
      `select
         has_table_privilege('anon', 'lighthouse.gap_build_principal_admissions', 'SELECT')
           or has_table_privilege('anon', 'lighthouse.gap_build_principal_admissions', 'INSERT')
           or has_table_privilege('anon', 'lighthouse.gap_build_principal_admissions', 'UPDATE')
           or has_table_privilege('anon', 'lighthouse.gap_build_principal_admissions', 'DELETE')
           as anon_direct_dml,
         has_table_privilege('authenticated', 'lighthouse.gap_build_principal_admissions', 'SELECT')
           or has_table_privilege('authenticated', 'lighthouse.gap_build_principal_admissions', 'INSERT')
           or has_table_privilege('authenticated', 'lighthouse.gap_build_principal_admissions', 'UPDATE')
           or has_table_privilege('authenticated', 'lighthouse.gap_build_principal_admissions', 'DELETE')
           as authenticated_direct_dml,
         has_table_privilege('service_role', 'lighthouse.gap_build_principal_admissions', 'SELECT')
           or has_table_privilege('service_role', 'lighthouse.gap_build_principal_admissions', 'INSERT')
           or has_table_privilege('service_role', 'lighthouse.gap_build_principal_admissions', 'UPDATE')
           or has_table_privilege('service_role', 'lighthouse.gap_build_principal_admissions', 'DELETE')
           as service_role_direct_dml`,
    );
    expect(tablePrivileges.rows).toEqual([
      {
        anon_direct_dml: false,
        authenticated_direct_dml: false,
        service_role_direct_dml: false,
      },
    ]);
  });
});
