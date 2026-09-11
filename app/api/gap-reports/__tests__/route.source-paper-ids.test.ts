import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { buildGapReportCreationRequest } from "@/app/components/research-route-renderers/search-view-agent-actions";

const {
  queueGapNetworkBuildRetryIfFailed,
  requireOwnerPrincipalAuth,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
} = vi.hoisted(() => ({
  queueGapNetworkBuildRetryIfFailed: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  reserveGapNetworkViewFromSnapshot: vi.fn(),
  startGapNetworkBuildJob: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/domain-access/gap-network-view-access", () => ({
  queueGapNetworkBuildRetryIfFailed,
  reserveGapNetworkViewFromSnapshot,
  startGapNetworkBuildJob,
}));

const sourcePapers: SearchMetadata["papers"] = Array.from({ length: 45 }, (_, index) => {
  const paperId = `paper-${String(index + 1)}`;
  return {
    paperId,
    title: paperId,
    abstract: "abstract",
    year: 2024,
    citationCount: index,
    url: `https://example.com/${paperId}`,
    authors: [{ name: "Author" }],
    referenceIds: [],
    citationIds: [],
  };
});

function createGapDocument(papers: SearchMetadata["papers"]): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "00000000-0000-4000-8000-000000000040",
    type: "gap_network",
    title: "연구 공백: research agents",
    content: "",
    createdBy: "user",
    refs: ["search-ephemeral-1"],
    viewerPrincipalId: "user-1",
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:05.000Z",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-ephemeral-1",
      query: "research agents",
      papers,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        coreEvidence: "citation-semantic-graph-v2",
        updatedAt: "2026-04-14T00:00:05.000Z",
      },
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: {
          clusterCount: 0,
          totalPaperCount: papers.length,
          totalEdgeCount: 0,
          gapPairCount: 0,
        },
        insight: {
          hypotheses: [],
        },
      },
    },
  };
}

describe("gap-network route source paper ids", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireOwnerPrincipalAuth.mockResolvedValue({
      db: {},
      user: { id: "user-1", email: "operator@corca.ai" },
    });
    queueGapNetworkBuildRetryIfFailed.mockImplementation(
      ({ document }: { document: ResearchRoutePayload }) => Promise.resolve(document),
    );
  });

  it("passes scoped source paper ids from the snapshot to gap creation", async () => {
    reserveGapNetworkViewFromSnapshot.mockResolvedValueOnce(
      createGapDocument(sourcePapers.slice(0, 2)),
    );

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-ephemeral-1",
          sourceQuery: "research agents",
          sourcePaperIds: ["paper-2", "paper-1"],
          papers: sourcePapers.slice(0, 3),
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(reserveGapNetworkViewFromSnapshot).toHaveBeenCalledWith({
      sourceSnapshotId: "search-ephemeral-1",
      sourceQuery: "research agents",
      sourcePaperIds: ["paper-2", "paper-1"],
      papers: sourcePapers.slice(0, 3),
    });
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("rejects an oversized snapshot before reserving provider work", async () => {
    const selectedPaperIds = sourcePapers.map((paper) => paper.paperId);
    reserveGapNetworkViewFromSnapshot.mockResolvedValueOnce(
      createGapDocument(sourcePapers.slice(0, 40)),
    );

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify({
          sourceSnapshotId: "search-ephemeral-1",
          sourceQuery: "research agents",
          sourcePaperIds: selectedPaperIds,
          papers: sourcePapers,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(reserveGapNetworkViewFromSnapshot).not.toHaveBeenCalled();
    expect(startGapNetworkBuildJob).not.toHaveBeenCalled();
  });

  it("accepts the canonical client request built from more than 40 search results", async () => {
    const sourceView = {
      ...createGapDocument(sourcePapers),
      id: "search-ephemeral-1",
      type: "search" as const,
      metadata: {
        type: "search" as const,
        query: "research agents",
        papers: sourcePapers,
        total: sourcePapers.length,
      },
    } as ResearchRoutePayload;
    const body = buildGapReportCreationRequest(
      sourceView,
      sourceView.metadata as SearchMetadata,
      sourcePapers.map((paper) => paper.paperId),
    );
    reserveGapNetworkViewFromSnapshot.mockResolvedValueOnce(
      createGapDocument(sourcePapers.slice(0, 40)),
    );
    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    expect(body.papers).toHaveLength(40);
    expect(response.status).toBe(201);
    expect(reserveGapNetworkViewFromSnapshot).toHaveBeenCalledWith(body);
  });

  it("accepts a canonical graph-neighbor request when a provider paper has over 100 authors", async () => {
    const exceptionalPapers = sourcePapers.slice(0, 3).map((paper, index) => ({
      ...paper,
      authors:
        index === 1
          ? Array.from({ length: 101 }, (_, authorIndex) => ({
              name: `Author ${String(authorIndex)}`,
            }))
          : paper.authors,
    }));
    const sourceView = {
      ...createGapDocument(exceptionalPapers),
      id: "graph-neighbors-ephemeral-1",
      type: "search" as const,
      metadata: {
        type: "search" as const,
        query: "비슷한 논문: AgentRxiv",
        papers: exceptionalPapers,
        total: exceptionalPapers.length,
      },
    } as ResearchRoutePayload;
    const body = buildGapReportCreationRequest(sourceView, sourceView.metadata as SearchMetadata);
    reserveGapNetworkViewFromSnapshot.mockResolvedValueOnce(createGapDocument(exceptionalPapers));

    const { POST } = await import("../route");
    const response = await POST(
      new NextRequest("https://example.com/api/gap-reports", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

    expect(body.papers[1]?.authors).toEqual([]);
    expect(response.status).toBe(201);
    expect(reserveGapNetworkViewFromSnapshot).toHaveBeenCalledWith(body);
  });
});
