import { z } from "zod";
import type { RepositoryDbHandle } from "./db";
import { getLighthouseDbFor } from "./db";
import { parseRows } from "./row-parsers";

const claimRowSchema = z.object({
  outcome: z.enum(["acquired", "same_report", "blocked"]),
  active_gap_report_id: z.uuid(),
  acquired_lease_token: z.string().nullable(),
  lease_expires_at: z.string(),
  retry_after_seconds: z.number().int().nonnegative(),
});

const rpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.unknown().nullable(),
});

export type GapBuildPrincipalAdmissionClaim =
  | {
      outcome: "acquired";
      activeGapReportId: string;
      leaseToken: string;
      leaseExpiresAt: string;
      retryAfterSeconds: 0;
    }
  | {
      outcome: "same_report";
      activeGapReportId: string;
      leaseExpiresAt: string;
      retryAfterSeconds: number;
    }
  | {
      outcome: "blocked";
      activeGapReportId: string;
      leaseExpiresAt: string;
      retryAfterSeconds: number;
    };

function throwRpcError(error: unknown): never {
  if (error instanceof Error) throw error;
  throw new Error("Gap build principal admission RPC failed", { cause: error });
}

export async function claimGapBuildPrincipalAdmission(
  db: RepositoryDbHandle,
  params: {
    principalId: string;
    gapReportId: string;
    leaseToken: string;
    leaseSeconds?: number;
  },
): Promise<GapBuildPrincipalAdmissionClaim> {
  const response: unknown = await getLighthouseDbFor(db).rpc(
    "claim_gap_build_principal_admission",
    {
      p_principal_id: params.principalId,
      p_gap_report_id: params.gapReportId,
      p_lease_token: params.leaseToken,
      ...(params.leaseSeconds === undefined ? {} : { p_lease_seconds: params.leaseSeconds }),
    },
  );
  const { data, error } = rpcResponseSchema.parse(response);
  if (error) throwRpcError(error);

  const rows = parseRows(claimRowSchema, data, "gap build principal admission claim");
  const row = rows.at(0);
  if (!row || rows.length !== 1) {
    throw new Error("Gap build principal admission claim must return exactly one row");
  }

  if (row.outcome === "acquired") {
    if (row.acquired_lease_token !== params.leaseToken) {
      throw new Error("Gap build principal admission returned an unexpected lease token");
    }
    return {
      outcome: "acquired",
      activeGapReportId: row.active_gap_report_id,
      leaseToken: row.acquired_lease_token,
      leaseExpiresAt: row.lease_expires_at,
      retryAfterSeconds: 0,
    };
  }

  return {
    outcome: row.outcome,
    activeGapReportId: row.active_gap_report_id,
    leaseExpiresAt: row.lease_expires_at,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

export async function releaseGapBuildPrincipalAdmission(
  db: RepositoryDbHandle,
  params: { principalId: string; gapReportId: string; leaseToken: string },
): Promise<boolean> {
  const response: unknown = await getLighthouseDbFor(db).rpc(
    "release_gap_build_principal_admission",
    {
      p_principal_id: params.principalId,
      p_gap_report_id: params.gapReportId,
      p_lease_token: params.leaseToken,
    },
  );
  const { data, error } = rpcResponseSchema.parse(response);
  if (error) throwRpcError(error);
  return z.boolean().parse(data);
}
