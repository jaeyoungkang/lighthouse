import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

const GAP_REPORT_ID = "00000000-0000-4000-8000-000000000001";
const { findGapNetworkView } = vi.hoisted(() => ({ findGapNetworkView: vi.fn() }));

vi.mock("@/app/server/domain-access/gap-report-access", () => ({ findGapNetworkView }));
vi.mock("@/app/server/guards/route-guard", () => ({
  withRouteGuard: (handler: (request: Request) => Promise<Response>) => handler,
}));

function readyReport(): ResearchRoutePayload {
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
      papers: [
        {
          paperId: "paper-1",
          title: "Research Agents",
          abstract: "abstract",
          year: 2025,
          citationCount: 1,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author" }],
        },
      ],
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        coreEvidence: "citation-semantic-graph-v2",
        phase: "complete",
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
    status: "ready",
    version: 1,
    reactionVersion: 0,
    createdAt: "2026-08-12T00:00:00.000Z",
    updatedAt: "2026-08-12T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("gap report status", () => {
  it("polls by gap report id and completes when the runner has persisted a ready report", async () => {
    findGapNetworkView.mockResolvedValue(readyReport());
    const { GET } = await import("../status/route");
    const response = await GET(
      new NextRequest(`https://example.com/api/gap-reports/status?gapReportId=${GAP_REPORT_ID}`),
    );

    await expect(response.json()).resolves.toMatchObject({
      status: "completed",
      gapReportId: GAP_REPORT_ID,
    });
  });

  it("returns not found for an unavailable artifact", async () => {
    findGapNetworkView.mockResolvedValue(null);
    const { GET } = await import("../status/route");
    const response = await GET(
      new NextRequest(`https://example.com/api/gap-reports/status?gapReportId=${GAP_REPORT_ID}`),
    );
    expect(response.status).toBe(404);
  });
});
