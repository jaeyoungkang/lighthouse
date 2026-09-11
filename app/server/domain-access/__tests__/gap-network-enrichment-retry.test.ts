import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GapNetworkMetadata, ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { RepositoryDbHandle } from "@/app/server/repository/db";

type GapNetworkView = ResearchRoutePayload & { type: "gap_network"; metadata: GapNetworkMetadata };
type VersionedGapUpdate = {
  metadata: GapNetworkMetadata;
  status?: "ready" | "pending" | "failed";
  version: number;
};

const TEST_DB = {} as RepositoryDbHandle;
const {
  getGapReportUncheckedMock,
  updateGapReportIfVersionUncheckedMock,
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipal,
} = vi.hoisted(() => ({
  getGapReportUncheckedMock: vi.fn(),
  updateGapReportIfVersionUncheckedMock: vi.fn(),
  admitGapBuildForPrincipal: vi.fn(),
  releaseGapBuildForPrincipal: vi.fn(),
}));

vi.mock("@/app/server/repository/gap-reports", () => ({
  getGapReportUnchecked: getGapReportUncheckedMock,
  updateGapReportIfVersionUnchecked: updateGapReportIfVersionUncheckedMock,
}));

vi.mock("@/app/server/domain-access/gap-build-principal-admission", () => ({
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipalSafely: releaseGapBuildForPrincipal,
}));

function createGapView(overrides: Partial<GapNetworkView> = {}): GapNetworkView {
  return {
    status: "ready",
    version: 4,
    reactionVersion: 0,
    id: "00000000-0000-4000-8000-000000000001",
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
      papers: [
        {
          paperId: "paper-1",
          title: "Research Agents",
          abstract: "abstract",
          year: 2025,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author 1" }],
          referenceIds: [],
          citationIds: [],
        },
      ],
      gapNetworkBuild: {
        core: "ready",
        enrichment: "failed",
        phase: "failed",
        attempt: 1,
        coreEvidence: "citation-semantic-graph-v2",
        updatedAt: "2026-07-07T00:00:05.000Z",
      },
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [
          { source: "concept-1", target: "concept-2", clusterId: "cluster-1", weight: 1 },
        ],
        gapPairs: [
          {
            id: "gap-1",
            leftClusterId: "cluster-1",
            rightClusterId: "cluster-2",
            leftLabel: "agents",
            rightLabel: "memory",
            displayLabel: "agent-memory gap",
            observed: 1,
            expected: 2,
            gapScore: 0.8,
            rank: 1,
            bridgeConcepts: [],
            leftConcepts: [],
            rightConcepts: [],
          },
        ],
        metrics: { clusterCount: 2, totalPaperCount: 1, totalEdgeCount: 1, gapPairCount: 1 },
        insight: { hypotheses: [] },
      },
    },
    reaction: null,
    ...overrides,
  };
}

function getVersionedUpdateCalls() {
  return updateGapReportIfVersionUncheckedMock.mock.calls as unknown as Array<
    [RepositoryDbHandle, string, number, VersionedGapUpdate, string]
  >;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  releaseGapBuildForPrincipal.mockResolvedValue(true);
});

describe("gap network enrichment retry state", () => {
  it("queues the first failed enrichment retry immediately and preserves the core", async () => {
    const failed = createGapView();
    const queued = createGapView({
      version: 5,
      metadata: {
        ...failed.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "queued",
          attempt: 1,
          enrichmentRetryCount: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-07-07T00:00:06.000Z",
        },
      },
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(queued);

    const { queueGapNetworkEnrichmentRetry } = await import("../gap-network-build-state");
    const result = await queueGapNetworkEnrichmentRetry({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      document: failed,
      nowMs: Date.parse("2026-07-07T00:00:06.000Z"),
    });

    expect(result).toEqual({ document: queued, outcome: "queued", retryCount: 1 });
    const retryUpdate = getVersionedUpdateCalls()[0]?.[3];
    expect(retryUpdate.status).toBe("ready");
    expect(retryUpdate.metadata.gapNetworkReport).toEqual(failed.metadata.gapNetworkReport);
    expect(retryUpdate.metadata.gapNetworkBuild).toMatchObject({
      core: "ready",
      enrichment: "pending",
      phase: "queued",
      enrichmentRetryCount: 1,
    });
    expect(retryUpdate.metadata.gapNetworkBuild?.leaseExpiresAt).toBeUndefined();
  });

  it("applies a report-scoped 60 second cooldown after a retry fails", async () => {
    const failedAgain = createGapView({
      version: 7,
      metadata: {
        ...createGapView().metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          attempt: 2,
          enrichmentRetryCount: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-07-07T00:00:30.000Z",
        },
      },
    });
    const { queueGapNetworkEnrichmentRetry } = await import("../gap-network-build-state");

    await expect(
      queueGapNetworkEnrichmentRetry({
        db: TEST_DB,
        runtimePrincipalId: "user-1",
        document: failedAgain,
        nowMs: Date.parse("2026-07-07T00:00:52.100Z"),
      }),
    ).resolves.toEqual({
      document: failedAgain,
      outcome: "cooldown",
      retryCount: 1,
      retryAfterSeconds: 38,
    });
    expect(updateGapReportIfVersionUncheckedMock).not.toHaveBeenCalled();
  });

  it("lets one CAS winner queue concurrent enrichment retries", async () => {
    const failed = createGapView();
    const queued = createGapView({
      version: 5,
      metadata: {
        ...failed.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "queued",
          attempt: 1,
          enrichmentRetryCount: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-07-07T00:00:06.000Z",
        },
      },
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(queued).mockResolvedValueOnce(null);
    getGapReportUncheckedMock.mockResolvedValueOnce(queued);
    const { queueGapNetworkEnrichmentRetry } = await import("../gap-network-build-state");
    const retry = () =>
      queueGapNetworkEnrichmentRetry({
        db: TEST_DB,
        runtimePrincipalId: "user-1",
        document: failed,
        nowMs: Date.parse("2026-07-07T00:00:06.000Z"),
      });

    const [winner, loser] = await Promise.all([retry(), retry()]);

    expect([winner.outcome, loser.outcome].sort()).toEqual(["pending", "queued"]);
    expect(winner.retryCount).toBe(1);
    expect(loser.retryCount).toBe(1);
  });
});

describe("gap network enrichment principal admission", () => {
  it("does not queue failed enrichment when another report is active", async () => {
    const failed = createGapView();
    getGapReportUncheckedMock.mockResolvedValueOnce(failed);
    admitGapBuildForPrincipal.mockResolvedValueOnce({
      outcome: "blocked",
      activeGapReportId: "00000000-0000-4000-8000-000000000099",
      leaseExpiresAt: "2026-07-07T00:01:10.000Z",
      retryAfterSeconds: 55,
    });

    const { requestGapNetworkEnrichmentRetry } = await import("../gap-network-view-access");
    const result = await requestGapNetworkEnrichmentRetry({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: failed.id,
      nowMs: Date.parse("2026-07-07T00:00:06.000Z"),
    });

    expect(result).toMatchObject({
      outcome: "principal-blocked",
      activeGapReportId: "00000000-0000-4000-8000-000000000099",
      retryAfterSeconds: 55,
    });
    expect(updateGapReportIfVersionUncheckedMock).not.toHaveBeenCalled();
  });

  it("releases admission when a concurrent enrichment command already queued the report", async () => {
    const failed = createGapView();
    const pending = createGapView({
      version: failed.version + 1,
      metadata: {
        ...failed.metadata,
        gapNetworkBuild: {
          core: "ready",
          updatedAt: "2026-07-07T00:00:00.000Z",
          enrichment: "pending",
          phase: "queued",
          enrichmentRetryCount: 1,
        },
      },
    });
    getGapReportUncheckedMock.mockResolvedValueOnce(failed).mockResolvedValueOnce(pending);
    admitGapBuildForPrincipal.mockResolvedValueOnce({
      outcome: "acquired",
      activeGapReportId: failed.id,
      leaseToken: "admission-token",
      leaseExpiresAt: "2026-07-07T00:01:10.000Z",
      retryAfterSeconds: 0,
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(null);

    const { requestGapNetworkEnrichmentRetry } = await import("../gap-network-view-access");
    const result = await requestGapNetworkEnrichmentRetry({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: failed.id,
      nowMs: Date.parse("2026-07-07T00:00:06.000Z"),
    });

    expect(result).toMatchObject({ outcome: "pending" });
    expect(releaseGapBuildForPrincipal).toHaveBeenCalledWith({
      db: TEST_DB,
      principalId: "user-1",
      gapReportId: failed.id,
      leaseToken: "admission-token",
    });
  });
});
