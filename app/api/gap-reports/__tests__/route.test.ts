import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as NextServer from "next/server";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";

const GAP_REPORT_ID = "00000000-0000-4000-8000-000000000001";
const {
  afterMock,
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipal,
  findGapNetworkView,
  queueGapNetworkBuildRetryIfFailed,
  requireOwnerPrincipalAuth,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
} = vi.hoisted(() => ({
  afterMock: vi.fn((callback: () => unknown) => callback()),
  admitGapBuildForPrincipal: vi.fn(),
  releaseGapBuildForPrincipal: vi.fn(),
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
  releaseGapBuildForPrincipalSafely: releaseGapBuildForPrincipal,
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
const GRAPH_SUPPORT_UNKNOWN_FIELDS = Object.fromEntries(
  Array.from({ length: 25_000 }, (_, index) => [`extra-${String(index)}`, null]),
);

function report(status: "pending" | "ready" | "failed" = "ready"): ResearchRoutePayload {
  const core = status === "failed" ? "failed" : status === "pending" ? "pending" : "ready";
  const enrichment = status === "ready" ? "ready" : status === "failed" ? "failed" : "pending";
  return {
    id: GAP_REPORT_ID,
    viewerPrincipalId: "viewer-1",
    type: "gap_network",
    title: "연구 공백",
    content: "공유 본문",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "research agents",
      papers,
      gapNetworkBuild: {
        core,
        enrichment,
        phase: status === "ready" ? "complete" : status === "failed" ? "failed" : "queued",
        coreEvidence: status === "ready" ? "citation-semantic-graph-v2" : undefined,
        updatedAt: "2026-07-10T00:00:00.000Z",
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
    status,
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: {},
    user: { id: "viewer-1", email: "viewer@example.com" },
  });
  queueGapNetworkBuildRetryIfFailed.mockImplementation(
    ({ document }: { document: ResearchRoutePayload }) => Promise.resolve(document),
  );
  admitGapBuildForPrincipal.mockResolvedValue({
    outcome: "acquired",
    activeGapReportId: GAP_REPORT_ID,
    leaseToken: "admission-token",
    leaseExpiresAt: "2026-07-10T00:01:10.000Z",
    retryAfterSeconds: 0,
  });
  releaseGapBuildForPrincipal.mockResolvedValue(true);
});

describe("gap report POST", () => {
  it("creates from a visible result snapshot without loading a source ResearchRoutePayload", async () => {
    const pending = report("pending");
    const buildJob = Promise.resolve();
    reserveGapNetworkViewFromSnapshot.mockResolvedValue(pending);
    startGapNetworkBuildJob.mockReturnValue(buildJob);

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
        }),
      }),
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ gapReportId: GAP_REPORT_ID, status: "pending" });
    expect(reserveGapNetworkViewFromSnapshot).toHaveBeenCalledWith({
      sourceSnapshotId: "search-1",
      sourceQuery: "research agents",
      sourcePaperIds: undefined,
      papers,
      graphSupport: undefined,
    });
    expect(startGapNetworkBuildJob).toHaveBeenCalledWith({
      db: {},
      runtimePrincipalId: "viewer-1",
      gapReportId: GAP_REPORT_ID,
      admission: {
        outcome: "acquired",
        activeGapReportId: GAP_REPORT_ID,
        leaseToken: "admission-token",
        leaseExpiresAt: "2026-07-10T00:01:10.000Z",
        retryAfterSeconds: 0,
      },
    });
  });

  it("returns a reused ready report without scheduling server-side viewed analytics", async () => {
    reserveGapNetworkViewFromSnapshot.mockResolvedValue(report("ready"));
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
    expect(admitGapBuildForPrincipal).not.toHaveBeenCalled();
  });

  it("does not expose a shared report reservation to an unauthenticated request", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
        }),
      }),
    );

    expect(response.status).toBe(401);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("authenticates before reading or validating the request body", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: "not-json",
      }),
    );

    expect(response.status).toBe(401);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("rejects a request body above the route budget before schema work", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: "x".repeat(1_000_001),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: "요청 내용이 너무 큽니다" });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("rejects oversized nested paper relation input before reserving provider work", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: [
            {
              ...papers[0],
              referenceIds: Array.from({ length: 1_001 }, (_, index) => `ref-${String(index)}`),
            },
          ],
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });
});

describe("gap report validation diagnostics", () => {
  it("short-circuits oversized collections before building a full schema error tree", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: Array.from({ length: 50_000 }, () => null),
        }),
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      code: "GAP_REPORT_COLLECTION_LIMIT_INVALID",
      action: "correct-request",
      retryable: false,
      issues: [{ path: "papers", message: "too many papers" }],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("stops counting oversized graph score objects at the first excess key", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
          graphSupport: {
            version: 1,
            source: "episteme-paper-neighborhood",
            basis: "loaded_result_sample",
            status: "ready",
            samplePaperIds: [],
            paperScores: Object.fromEntries(
              Array.from({ length: 50_000 }, (_, index) => [`paper-${String(index)}`, null]),
            ),
            generatedAt: "2026-07-15T00:00:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "graphSupport.paperScores",
          message: "graph support score set is too large",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("rejects output-inert nested paper collections before schema traversal", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: [
            {
              ...papers[0],
              fieldsOfStudy: Array.from({ length: 100_000 }, () => null),
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "papers.0.fieldsOfStudy",
          message: "paper field is not allowed",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("short-circuits unknown nested paper object keys before schema diagnostics", async () => {
    const { POST } = await import("../route");
    const unknownFields = Object.fromEntries(
      Array.from({ length: 25_000 }, (_, index) => [`extra-${String(index)}`, null]),
    );
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: [
            {
              ...papers[0],
              authors: [{ name: "Ada", ...unknownFields }],
              openAccessPdf: { url: "https://example.com/paper.pdf", ...unknownFields },
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "papers.0.authors.0.extra-0",
          message: "author field is not allowed",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("rejects invalid relation elements before expanding schema issues", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: Array.from({ length: 40 }, (_, index) => ({
            ...papers[0],
            paperId: `paper-${String(index)}`,
            referenceIds: Array.from({ length: 1_000 }, () => null),
            citationIds: Array.from({ length: 1_000 }, () => null),
          })),
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "papers.0.referenceIds",
          message: "referenceIds contains an invalid id",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("rejects the first unknown top-level field before expanding union diagnostics", async () => {
    const { POST } = await import("../route");
    const unknownFields = Object.fromEntries(
      Array.from({ length: 60_000 }, (_, index) => [`x${String(index)}`, 0]),
    );
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
          ...unknownFields,
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [{ path: "$.x0", message: "request field is not allowed" }],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("returns field paths for invalid nested input without echoing request values", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers: [
            {
              ...papers[0],
              authors: Array.from({ length: 101 }, (_, index) => ({
                name: `sensitive-author-${String(index)}-${"x".repeat(600)}`,
              })),
            },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    const responseBody: unknown = await response.json();
    expect(responseBody).toMatchObject({ error: "invalid gap report payload" });
    if (typeof responseBody !== "object" || responseBody === null || !("issues" in responseBody)) {
      throw new Error("gap report validation issues missing");
    }
    expect(responseBody.issues).toContainEqual({
      path: "papers.0.authors",
      message: "too many authors",
    });
    expect(Array.isArray(responseBody.issues) ? responseBody.issues.length : 0).toBeLessThanOrEqual(
      50,
    );
    expect(JSON.stringify(responseBody)).not.toContain("sensitive-author");
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });
});

describe("gap report graph support preflight", () => {
  it("short-circuits unknown graph support fields before schema diagnostics", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
          graphSupport: {
            version: 1,
            source: "episteme-paper-neighborhood",
            basis: "loaded_result_sample",
            status: "ready",
            samplePaperIds: [],
            paperScores: {},
            generatedAt: "2026-07-15T00:00:00.000Z",
            ...GRAPH_SUPPORT_UNKNOWN_FIELDS,
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "graphSupport.extra-0",
          message: "graph support field is not allowed",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it("short-circuits unknown graph score fields before schema diagnostics", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
          graphSupport: {
            version: 1,
            source: "episteme-paper-neighborhood",
            basis: "loaded_result_sample",
            status: "ready",
            samplePaperIds: ["paper-1"],
            paperScores: {
              "paper-1": {
                defaultScore: 1,
                graphScore: 1,
                semanticScore: null,
                sharedCiters: 1,
                sharedRefs: null,
                seedCount: 1,
                sources: [],
                ...GRAPH_SUPPORT_UNKNOWN_FIELDS,
              },
            },
            generatedAt: "2026-07-15T00:00:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid gap report payload",
      issues: [
        {
          path: "graphSupport.paperScores.0.extra-0",
          message: "graph support score field is not allowed",
        },
      ],
    });
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
  });

  it.each([
    [
      "candidateCounts",
      "graphSupport.candidateCounts.extra-0",
      "graph support candidate count field is not allowed",
    ],
    [
      "filteredOut",
      "graphSupport.candidateCounts.filteredOut.extra-0",
      "graph support filtered count field is not allowed",
    ],
  ] as const)(
    "short-circuits unknown %s fields before schema diagnostics",
    async (target, path, message) => {
      const { POST } = await import("../route");
      const filteredOut = {
        candidateCap: 0,
        hydrationUnavailable: 0,
        publicationYear: 0,
        nonPositiveScore: 0,
        titleFamilyDuplicate: 0,
        ...(target === "filteredOut" ? GRAPH_SUPPORT_UNKNOWN_FIELDS : {}),
      };
      const candidateCounts = {
        providerReturned: 0,
        hydrated: 0,
        keywordOverlap: 0,
        admittedSupplement: 0,
        deferredByQueryRelevance: 0,
        filteredOut,
        ...(target === "candidateCounts" ? GRAPH_SUPPORT_UNKNOWN_FIELDS : {}),
      };
      const response = await POST(
        new NextRequest("https://example.com/api/gap-reports", {
          method: "POST",
          body: JSON.stringify({
            sourceSnapshotId: "search-1",
            sourceQuery: "research agents",
            papers,
            graphSupport: {
              version: 2,
              source: "episteme-paper-neighborhood",
              basis: "library_anchor_neighborhood",
              status: "ready",
              anchorPaperCount: 0,
              samplePaperIds: [],
              paperScores: {},
              candidateCounts,
              generatedAt: "2026-07-15T00:00:00.000Z",
            },
          }),
        }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "invalid gap report payload",
        issues: [{ path, message }],
      });
      expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    },
  );
});

describe("gap report POST", () => {
  it("rejects graph score source fan-out before it reaches edge construction", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
          graphSupport: {
            version: 1,
            source: "episteme-paper-neighborhood",
            basis: "loaded_result_sample",
            status: "ready",
            samplePaperIds: ["paper-1"],
            paperScores: {
              "paper-1": {
                defaultScore: 1,
                graphScore: 1,
                semanticScore: null,
                sharedCiters: 1,
                sharedRefs: null,
                seedCount: 1,
                sources: Array.from({ length: 101 }, (_, index) => `source-${String(index)}`),
              },
            },
            generatedAt: "2026-07-12T00:00:00.000Z",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("queues a failed artifact before scheduling its retry", async () => {
    const failed = report("failed");
    const queued = { ...report("pending"), version: 1 };
    reserveGapNetworkViewFromSnapshot.mockResolvedValue(failed);
    queueGapNetworkBuildRetryIfFailed.mockResolvedValue(queued);
    startGapNetworkBuildJob.mockReturnValue(Promise.resolve());

    const { POST } = await import("../route");
    await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-1",
          sourceQuery: "research agents",
          papers,
        }),
      }),
    );

    expect(queueGapNetworkBuildRetryIfFailed).toHaveBeenCalledWith({
      db: {},
      runtimePrincipalId: "viewer-1",
      document: failed,
    });
    expect(startGapNetworkBuildJob).toHaveBeenCalled();
  });

  it("recovers the same artifact id without recomputing identity from mutable build metadata", async () => {
    const pending = report("pending");
    findGapNetworkView.mockResolvedValue({
      ...pending,
      metadata: {
        ...pending.metadata,
        sourceGraphSupport: {
          version: 1,
          source: "episteme-paper-neighborhood",
          basis: "loaded_result_sample",
          status: "empty",
          samplePaperIds: [],
          paperScores: {},
          generatedAt: "2026-07-12T00:00:00.000Z",
        },
      },
    });
    startGapNetworkBuildJob.mockReturnValue(Promise.resolve());
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({ gapReportId: GAP_REPORT_ID }),
      }),
    );

    expect(response.status).toBe(202);
    expect(findGapNetworkView).toHaveBeenCalledWith(GAP_REPORT_ID);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).toHaveBeenCalledWith({
      db: {},
      runtimePrincipalId: "viewer-1",
      gapReportId: GAP_REPORT_ID,
      admission: {
        outcome: "acquired",
        activeGapReportId: GAP_REPORT_ID,
        leaseToken: "admission-token",
        leaseExpiresAt: "2026-07-10T00:01:10.000Z",
        retryAfterSeconds: 0,
      },
    });
  });
});
