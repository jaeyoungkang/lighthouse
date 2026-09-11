import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateResearchRoutePayloadParams,
  ResearchRoutePayload,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";

const {
  createGapReportUnchecked,
  getGapReportUnchecked,
  updateGapReportForOwnerIfVersionUnchecked,
} = vi.hoisted(() => ({
  createGapReportUnchecked: vi.fn(),
  getGapReportUnchecked: vi.fn(),
  updateGapReportForOwnerIfVersionUnchecked: vi.fn(),
}));

vi.mock("@/app/server/repository/gap-reports", () => ({
  createGapReportUnchecked,
  getGapReportUnchecked,
  updateGapReportIfVersionUnchecked: updateGapReportForOwnerIfVersionUnchecked,
}));

function paper(paperId: string): GraphPaperSnapshot {
  return {
    paperId,
    title: paperId,
    abstract: null,
    year: 2024,
    citationCount: 1,
    url: `https://example.com/${paperId}`,
    authors: [{ name: "Author" }],
    openAccessPdf: null,
    doi: null,
    referenceIds: null,
    citationIds: null,
  };
}

function gapDocument(params: {
  id?: string;
  sourceSnapshotId?: string;
  paperIds: string[];
  enrichment: "pending" | "ready";
  version: number;
  attempt?: number;
  leaseExpiresAt?: string;
}): ResearchRoutePayload {
  return {
    status: "ready",
    version: params.version,
    reactionVersion: 0,
    id: params.id ?? "gap-1",
    type: "gap_network",
    title: "공백 분석",
    content: "",
    createdBy: "user",
    refs: [params.sourceSnapshotId ?? "search-1"],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: params.sourceSnapshotId ?? "search-1",
      query: "slide accessibility",
      papers: params.paperIds.map(paper),
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: {
          clusterCount: 0,
          totalPaperCount: 0,
          totalEdgeCount: 0,
          gapPairCount: 0,
        },
        insight: {
          hypotheses: [],
        },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: params.enrichment,
        ...(params.attempt !== undefined ? { attempt: params.attempt } : {}),
        ...(params.leaseExpiresAt ? { leaseExpiresAt: params.leaseExpiresAt } : {}),
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    },
  };
}

function gapPayload(params: {
  sourceSnapshotId?: string;
  paperIds: string[];
  enrichment: "pending" | "ready";
}): CreateResearchRoutePayloadParams {
  return {
    viewerPrincipalId: "principal-1",
    type: "gap_network",
    title: "공백 분석",
    content: "",
    createdBy: "user",
    refs: [params.sourceSnapshotId ?? "search-1"],
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: params.sourceSnapshotId ?? "search-1",
      query: "slide accessibility",
      papers: params.paperIds.map(paper),
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: {
          clusterCount: 0,
          totalPaperCount: 0,
          totalEdgeCount: 0,
          gapPairCount: 0,
        },
        insight: {
          hypotheses: [],
        },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: params.enrichment,
        updatedAt: "2026-06-01T00:01:00.000Z",
      },
    },
  };
}

describe("search-backed knowledge map persistence", () => {
  beforeEach(() => {
    createGapReportUnchecked.mockReset();
    getGapReportUnchecked.mockReset();
    updateGapReportForOwnerIfVersionUnchecked.mockReset();
  });

  it("returns a concurrent ready document only when it matches the same gap input", async () => {
    const existing = gapDocument({ paperIds: ["p1", "p2"], enrichment: "pending", version: 1 });
    const latest = gapDocument({ paperIds: ["p1", "p2"], enrichment: "pending", version: 2 });
    const newest = gapDocument({ paperIds: ["p1", "p2"], enrichment: "ready", version: 3 });
    updateGapReportForOwnerIfVersionUnchecked
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getGapReportUnchecked.mockResolvedValueOnce(latest).mockResolvedValueOnce(newest);

    const { persistSearchBackedKnowledgeMapDocument } =
      await import("../search-backed-knowledge-map-persistence");
    const result = await persistSearchBackedKnowledgeMapDocument(
      "db" as never,
      existing,
      gapPayload({ paperIds: ["p1", "p2"], enrichment: "ready" }),
    );

    expect(result).toBe(newest);
  });

  it("throws after version conflicts when the newest gap report has a different input", async () => {
    const existing = gapDocument({ paperIds: ["p1", "p2"], enrichment: "pending", version: 1 });
    const latest = gapDocument({ paperIds: ["p1", "p2"], enrichment: "pending", version: 2 });
    const newest = gapDocument({ paperIds: ["p2", "p1"], enrichment: "ready", version: 3 });
    updateGapReportForOwnerIfVersionUnchecked
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    getGapReportUnchecked.mockResolvedValueOnce(latest).mockResolvedValueOnce(newest);

    const { persistSearchBackedKnowledgeMapDocument } =
      await import("../search-backed-knowledge-map-persistence");
    await expect(
      persistSearchBackedKnowledgeMapDocument(
        "db" as never,
        existing,
        gapPayload({ paperIds: ["p1", "p2"], enrichment: "ready" }),
      ),
    ).rejects.toThrow("gap_network report changed while updating");
  });

  it("does not retry a runner-owned persist after another attempt owns the latest row", async () => {
    const existing = gapDocument({
      paperIds: ["p1", "p2"],
      enrichment: "pending",
      version: 1,
      attempt: 1,
      leaseExpiresAt: "2026-07-07T00:10:00.000Z",
    });
    const latest = gapDocument({
      paperIds: ["p1", "p2"],
      enrichment: "pending",
      version: 2,
      attempt: 2,
      leaseExpiresAt: "2026-07-07T00:20:00.000Z",
    });
    updateGapReportForOwnerIfVersionUnchecked.mockResolvedValueOnce(null);
    getGapReportUnchecked.mockResolvedValueOnce(latest);

    const { persistSearchBackedKnowledgeMapDocument } =
      await import("../search-backed-knowledge-map-persistence");
    await expect(
      persistSearchBackedKnowledgeMapDocument(
        "db" as never,
        existing,
        gapPayload({ paperIds: ["p1", "p2"], enrichment: "ready" }),
        {
          buildOwnership: {
            attempt: 1,
            leaseExpiresAt: "2026-07-07T00:10:00.000Z",
          },
        },
      ),
    ).rejects.toThrow("gap_network report changed while updating");

    expect(updateGapReportForOwnerIfVersionUnchecked).toHaveBeenCalledTimes(1);
    expect(getGapReportUnchecked).toHaveBeenCalledTimes(1);
  });
});
