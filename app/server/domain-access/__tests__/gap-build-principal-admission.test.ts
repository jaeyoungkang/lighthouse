import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type {
  claimGapBuildPrincipalAdmission as ClaimGapBuildPrincipalAdmission,
  releaseGapBuildPrincipalAdmission as ReleaseGapBuildPrincipalAdmission,
} from "@/app/server/repository/gap-build-principal-admissions";

const TEST_DB = {} as RepositoryDbHandle;
const { claimGapBuildPrincipalAdmission, releaseGapBuildPrincipalAdmission } = vi.hoisted(() => ({
  claimGapBuildPrincipalAdmission: vi.fn<typeof ClaimGapBuildPrincipalAdmission>(),
  releaseGapBuildPrincipalAdmission: vi.fn<typeof ReleaseGapBuildPrincipalAdmission>(),
}));

vi.mock("@/app/server/repository/gap-build-principal-admissions", () => ({
  claimGapBuildPrincipalAdmission,
  releaseGapBuildPrincipalAdmission,
}));

import {
  admitGapBuildForPrincipal,
  GAP_BUILD_PRINCIPAL_ADMISSION_LEASE_SECONDS,
  releaseGapBuildForPrincipalSafely,
} from "@/app/server/domain-access/gap-build-principal-admission";

describe("gap build principal admission", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("claims one bounded lease with a generated token and privacy-bounded observation", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    claimGapBuildPrincipalAdmission.mockImplementation((_db, params) =>
      Promise.resolve({
        outcome: "acquired" as const,
        activeGapReportId: params.gapReportId,
        leaseToken: params.leaseToken,
        leaseExpiresAt: "2026-08-12T07:00:00.000Z",
        retryAfterSeconds: 0 as const,
      }),
    );

    const result = await admitGapBuildForPrincipal({
      db: TEST_DB,
      principalId: "principal-private",
      gapReportId: "00000000-0000-4000-8000-000000000001",
    });

    expect(result.outcome).toBe("acquired");
    expect(claimGapBuildPrincipalAdmission).toHaveBeenCalledWith(TEST_DB, {
      principalId: "principal-private",
      gapReportId: "00000000-0000-4000-8000-000000000001",
      leaseToken: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      leaseSeconds: GAP_BUILD_PRINCIPAL_ADMISSION_LEASE_SECONDS,
    });
    expect(info).toHaveBeenCalledWith("[gap-build-principal-admission]", {
      outcome: "acquired",
      sameReport: true,
      retryAfterSeconds: 0,
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("principal-private");
  });

  it("contains release failure and records only its error type", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    releaseGapBuildPrincipalAdmission.mockRejectedValue(new Error("private database detail"));

    await expect(
      releaseGapBuildForPrincipalSafely({
        db: TEST_DB,
        principalId: "principal-private",
        gapReportId: "00000000-0000-4000-8000-000000000001",
        leaseToken: "lease-private",
      }),
    ).resolves.toBeUndefined();

    expect(warning).toHaveBeenCalledWith("[gap-build-principal-admission-release] failed", {
      errorType: "Error",
      durationMs: expect.any(Number) as number,
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private");
  });
});
