import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  afterMock,
  requestGapNetworkEnrichmentRetry,
  requireOwnerPrincipalAuth,
  startGapNetworkBuildJob,
} = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => unknown) => callback()),
  requestGapNetworkEnrichmentRetry: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  startGapNetworkBuildJob: vi.fn(),
}));

vi.mock("next/server", async () => ({
  ...(await vi.importActual("next/server")),
  after: afterMock,
}));
vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/domain-access/gap-network-view-access", () => ({
  requestGapNetworkEnrichmentRetry,
  startGapNetworkBuildJob,
}));

const gapReportId = "11111111-1111-4111-8111-111111111111";
const document = { id: gapReportId, version: 4, metadata: { type: "gap_network" } };

function context(id = gapReportId) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({ db: {}, user: { id: "viewer-1" } });
  startGapNetworkBuildJob.mockResolvedValue(undefined);
});

describe("gap enrichment retry command", () => {
  it("keeps the existing runner inside a 60 second route envelope", async () => {
    const { maxDuration } = await import("../route");

    expect(maxDuration).toBe(60);
  });

  it("authenticates before reading report state", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    requireOwnerPrincipalAuth.mockRejectedValueOnce(new UnauthenticatedError());
    const { POST } = await import("../route");
    const response = await POST(
      new Request(`http://localhost/gap/not-a-uuid`),
      context("not-a-uuid"),
    );

    expect(response.status).toBe(401);
    expect(requestGapNetworkEnrichmentRetry).not.toHaveBeenCalled();
  });

  it("schedules the existing runner exactly for the CAS winner", async () => {
    requestGapNetworkEnrichmentRetry.mockResolvedValueOnce({
      document,
      outcome: "queued",
      retryCount: 1,
      admission: {
        outcome: "acquired",
        activeGapReportId: gapReportId,
        leaseToken: "admission-token",
        leaseExpiresAt: "2026-07-10T00:01:10.000Z",
        retryAfterSeconds: 0,
      },
    });
    const { POST } = await import("../route");
    const response = await POST(new Request(`http://localhost/gap/${gapReportId}`), context());

    expect(response.status).toBe(202);
    expect(afterMock).toHaveBeenCalledOnce();
    expect(startGapNetworkBuildJob).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      status: "pending",
      gapReportId,
      retryCount: 1,
      document,
    });
  });

  it("returns current pending state without creating duplicate work", async () => {
    requestGapNetworkEnrichmentRetry.mockResolvedValueOnce({
      document,
      outcome: "pending",
      retryCount: 1,
    });
    const { POST } = await import("../route");
    const response = await POST(new Request(`http://localhost/gap/${gapReportId}`), context());

    expect(response.status).toBe(202);
    expect(afterMock).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("returns Retry-After for the report cooldown", async () => {
    requestGapNetworkEnrichmentRetry.mockResolvedValueOnce({
      document,
      outcome: "cooldown",
      retryCount: 1,
      retryAfterSeconds: 37,
    });
    const { POST } = await import("../route");
    const response = await POST(new Request(`http://localhost/gap/${gapReportId}`), context());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("37");
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_ENRICHMENT_RETRY_COOLDOWN",
      action: "wait-and-retry",
      retryable: true,
      retryAfterSeconds: 37,
    });
  });

  it("returns principal admission feedback without scheduling enrichment", async () => {
    requestGapNetworkEnrichmentRetry.mockResolvedValueOnce({
      document,
      outcome: "principal-blocked",
      retryCount: 0,
      retryAfterSeconds: 29,
      activeGapReportId: "22222222-2222-4222-8222-222222222222",
    });
    const { POST } = await import("../route");
    const response = await POST(new Request(`http://localhost/gap/${gapReportId}`), context());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("29");
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
      metadata: { activeGapReportId: "22222222-2222-4222-8222-222222222222" },
    });
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("returns a stable conflict when the report state cannot be retried", async () => {
    requestGapNetworkEnrichmentRetry.mockResolvedValueOnce({
      document,
      outcome: "not-retryable",
      retryCount: 0,
    });
    const { POST } = await import("../route");
    const response = await POST(new Request(`http://localhost/gap/${gapReportId}`), context());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_ENRICHMENT_RETRY_NOT_AVAILABLE",
      action: "refresh-and-rebase",
      retryable: false,
    });
  });
});
