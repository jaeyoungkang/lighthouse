import { beforeEach, expect, it, vi } from "vitest";
import type { RepositoryDbHandle } from "@/app/server/repository/db";

const TEST_DB = {} as RepositoryDbHandle;
const { getGapReportUncheckedMock, releaseGapBuildForPrincipal } = vi.hoisted(() => ({
  getGapReportUncheckedMock: vi.fn(),
  releaseGapBuildForPrincipal: vi.fn(),
}));

vi.mock("@/app/server/repository/gap-reports", () => ({
  getGapReportUnchecked: getGapReportUncheckedMock,
  updateGapReportIfVersionUnchecked: vi.fn(),
}));
vi.mock("@/app/server/services/gap-network-builder", () => ({
  buildGapNetworkEnrichedViewPayloadFromCore: vi.fn(),
  buildGapNetworkCoreViewPayload: vi.fn(),
}));
vi.mock("@/app/server/domain-access/gap-build-principal-admission", () => ({
  admitGapBuildForPrincipal: vi.fn(),
  releaseGapBuildForPrincipalSafely: releaseGapBuildForPrincipal,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  releaseGapBuildForPrincipal.mockResolvedValue(undefined);
});

it("releases the acquired principal admission when the runner finds no work", async () => {
  const gapReportId = "00000000-0000-4000-8000-000000000097";
  getGapReportUncheckedMock.mockResolvedValueOnce(null);

  const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
  await startGapNetworkBuildJob({
    db: TEST_DB,
    runtimePrincipalId: "user-1",
    gapReportId,
    admission: {
      outcome: "acquired",
      activeGapReportId: gapReportId,
      leaseToken: "admission-token",
      leaseExpiresAt: "2026-08-12T00:01:10.000Z",
      retryAfterSeconds: 0,
    },
  });

  expect(releaseGapBuildForPrincipal).toHaveBeenCalledWith({
    db: TEST_DB,
    principalId: "user-1",
    gapReportId,
    leaseToken: "admission-token",
  });
});
