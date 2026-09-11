import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";

const { requireOwnerPrincipalAuth, reserveGapNetworkViewFromSnapshot } = vi.hoisted(() => ({
  requireOwnerPrincipalAuth: vi.fn(),
  reserveGapNetworkViewFromSnapshot: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/domain-access/gap-network-view-access", () => ({
  queueGapNetworkBuildRetryIfFailed: vi.fn(),
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob: vi.fn(),
}));
vi.mock("@/app/server/domain-access/gap-report-access", () => ({
  findGapNetworkView: vi.fn(),
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

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: {},
    user: { id: "viewer-1", email: "viewer@example.com" },
  });
});

describe("gap report graph support variant preflight", () => {
  it.each([
    [1, "loaded_result_sample", "anchorPaperCount"],
    [1, "loaded_result_sample", "candidateCounts"],
    [2, "graph_neighbor_snapshot", "anchorPaperCount"],
    [2, "graph_neighbor_snapshot", "candidateCounts"],
  ] as const)(
    "rejects variant-only %s/%s graph support field %s before union parsing",
    async (version, basis, field) => {
      const { POST } = await import("../route");
      const response = await POST(
        new NextRequest("https://example.com/api/gap-reports", {
          method: "POST",
          body: JSON.stringify({
            sourceSnapshotId: "search-1",
            sourceQuery: "research agents",
            papers,
            graphSupport: {
              version,
              source: "episteme-paper-neighborhood",
              basis,
              status: "ready",
              samplePaperIds: [],
              paperScores: {},
              generatedAt: "2026-07-15T00:00:00.000Z",
              [field]: field === "candidateCounts" ? {} : 0,
            },
          }),
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        error: "invalid gap report payload",
        code: "GAP_REPORT_COLLECTION_LIMIT_INVALID",
        action: "correct-request",
        retryable: false,
        issues: [
          {
            path: `graphSupport.${field}`,
            message: "graph support field is not allowed",
          },
        ],
      });
      expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    },
  );
});
