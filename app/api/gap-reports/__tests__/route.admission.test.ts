import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";

const GAP_REPORT_ID = "00000000-0000-4000-8000-000000000001";
const ACTIVE_REPORT_ID = "00000000-0000-4000-8000-000000000099";
const {
  afterMock,
  admitGapBuildForPrincipal,
  findGapNetworkView,
  queueGapNetworkBuildRetryIfFailed,
  requireOwnerPrincipalAuth,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
} = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => unknown) => callback()),
  admitGapBuildForPrincipal: vi.fn(),
  findGapNetworkView: vi.fn(),
  queueGapNetworkBuildRetryIfFailed: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  reserveGapNetworkViewFromSnapshot: vi.fn(),
  startGapNetworkBuildJob: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof NextServer>()),
  after: afterMock,
}));
vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/domain-access/gap-network-view-access", () => ({
  queueGapNetworkBuildRetryIfFailed,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
}));
vi.mock("@/app/server/domain-access/gap-report-access", () => ({ findGapNetworkView }));
vi.mock("@/app/server/domain-access/gap-build-principal-admission", () => ({
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipalSafely: vi.fn(),
}));

const papers: SearchMetadata["papers"] = [
  {
    paperId: "paper-1",
    title: "Research Agents",
    abstract: "abstract",
    year: 2025,
    citationCount: 12,
    url: "https://example.com/paper-1",
    authors: [{ name: "Author" }],
    referenceIds: [],
    citationIds: [],
  },
];

function pendingReport(): ResearchRoutePayload {
  return {
    id: GAP_REPORT_ID,
    viewerPrincipalId: "viewer-1",
    type: "gap_network",
    title: "연구 공백",
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "research agents",
      papers,
      gapNetworkBuild: {
        core: "pending",
        enrichment: "pending",
        phase: "queued",
        updatedAt: "2026-08-12T00:00:00.000Z",
      },
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: { clusterCount: 0, totalPaperCount: 1, totalEdgeCount: 0, gapPairCount: 0 },
        insight: { hypotheses: [] },
      },
    },
    reaction: null,
    reactionHistory: [],
    refs: ["search-1"],
    status: "pending",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

function createRequest(): NextRequest {
  return new NextRequest("https://example.com/api/gap-reports", {
    method: "POST",
    body: JSON.stringify({
      sourceSnapshotId: "search-1",
      sourceQuery: "research agents",
      papers,
    }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: {},
    user: { id: "viewer-1", email: "viewer@example.com" },
  });
  reserveGapNetworkViewFromSnapshot.mockResolvedValue(pendingReport());
});

describe("gap report principal admission", () => {
  it("returns stable retry metadata before starting another report", async () => {
    admitGapBuildForPrincipal.mockResolvedValue({
      outcome: "blocked",
      activeGapReportId: ACTIVE_REPORT_ID,
      leaseExpiresAt: "2026-08-12T00:01:10.000Z",
      retryAfterSeconds: 42,
    });

    const { POST } = await import("../route");
    const response = await POST(createRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({
      code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
      metadata: { activeGapReportId: ACTIVE_REPORT_ID },
    });
    expect(queueGapNetworkBuildRetryIfFailed).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("returns pending without new work for the already active report", async () => {
    admitGapBuildForPrincipal.mockResolvedValue({
      outcome: "same_report",
      activeGapReportId: GAP_REPORT_ID,
      leaseExpiresAt: "2026-08-12T00:01:10.000Z",
      retryAfterSeconds: 42,
    });

    const { POST } = await import("../route");
    const response = await POST(createRequest());

    expect(response.status).toBe(202);
    expect(queueGapNetworkBuildRetryIfFailed).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });
});

describe("gap report share-safe ingress", () => {
  it("rejects viewer-private paper fields at the shared artifact ingress", async () => {
    const request = new NextRequest("https://example.com/api/gap-reports", {
      method: "POST",
      body: JSON.stringify({
        sourceSnapshotId: "search-1",
        sourceQuery: "research agents",
        papers: [{ ...papers[0], reviewed: true, inlineAnalysis: { private: "viewer-cache" } }],
      }),
    });

    const { POST } = await import("../route");
    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });
});
