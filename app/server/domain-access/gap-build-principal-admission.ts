import { randomUUID } from "node:crypto";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  claimGapBuildPrincipalAdmission,
  releaseGapBuildPrincipalAdmission,
  type GapBuildPrincipalAdmissionClaim,
} from "@/app/server/repository/gap-build-principal-admissions";

export const GAP_BUILD_PRINCIPAL_ADMISSION_LEASE_SECONDS = 70;

export type GapBuildPrincipalAdmission = GapBuildPrincipalAdmissionClaim;
export type AcquiredGapBuildPrincipalAdmission = Extract<
  GapBuildPrincipalAdmission,
  { outcome: "acquired" }
>;

export async function admitGapBuildForPrincipal(params: {
  db: RepositoryDbHandle;
  principalId: string;
  gapReportId: string;
}): Promise<GapBuildPrincipalAdmission> {
  const startedAt = Date.now();
  const result = await claimGapBuildPrincipalAdmission(params.db, {
    principalId: params.principalId,
    gapReportId: params.gapReportId,
    leaseToken: randomUUID(),
    leaseSeconds: GAP_BUILD_PRINCIPAL_ADMISSION_LEASE_SECONDS,
  });
  console.info("[gap-build-principal-admission]", {
    outcome: result.outcome,
    sameReport: result.activeGapReportId === params.gapReportId,
    retryAfterSeconds: result.retryAfterSeconds,
    durationMs: Math.max(Date.now() - startedAt, 0),
  });
  return result;
}

async function releaseGapBuildForPrincipal(params: {
  db: RepositoryDbHandle;
  principalId: string;
  gapReportId: string;
  leaseToken: string;
}): Promise<boolean> {
  const startedAt = Date.now();
  const released = await releaseGapBuildPrincipalAdmission(params.db, params);
  console.info("[gap-build-principal-admission-release]", {
    released,
    durationMs: Math.max(Date.now() - startedAt, 0),
  });
  return released;
}

export async function releaseGapBuildForPrincipalSafely(params: {
  db: RepositoryDbHandle;
  principalId: string;
  gapReportId: string;
  leaseToken: string;
}): Promise<void> {
  const startedAt = Date.now();
  try {
    await releaseGapBuildForPrincipal(params);
  } catch (error) {
    console.warn("[gap-build-principal-admission-release] failed", {
      errorType: error instanceof Error ? error.name : typeof error,
      durationMs: Math.max(Date.now() - startedAt, 0),
    });
  }
}
