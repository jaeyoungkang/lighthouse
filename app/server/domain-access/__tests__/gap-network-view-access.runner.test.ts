import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GapNetworkGraphSupportMetadata,
  GapNetworkMetadata,
  ResearchRoutePayload,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
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
  requireOwnerPrincipalAuth,
  updateGapReportIfVersionUncheckedMock,
  buildGapNetworkEnrichedViewPayloadFromCore,
  buildGapNetworkCoreViewPayload,
} = vi.hoisted(() => ({
  getGapReportUncheckedMock: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  updateGapReportIfVersionUncheckedMock: vi.fn(),
  buildGapNetworkEnrichedViewPayloadFromCore: vi.fn(),
  buildGapNetworkCoreViewPayload: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/repository/gap-reports", () => ({
  getGapReportUnchecked: getGapReportUncheckedMock,
  updateGapReportIfVersionUnchecked: updateGapReportIfVersionUncheckedMock,
}));

vi.mock("@/app/server/services/gap-network-builder", () => ({
  buildGapNetworkEnrichedViewPayloadFromCore,
  buildGapNetworkCoreViewPayload,
}));

const papers: SearchMetadata["papers"] = [
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
];

const graphSupport: GapNetworkGraphSupportMetadata = {
  version: 1,
  source: "episteme-paper-neighborhood",
  basis: "loaded_result_sample",
  status: "ready",
  samplePaperIds: ["paper-1"],
  generatedAt: "2026-07-07T00:00:02.000Z",
  paperScores: {
    "paper-1": {
      defaultScore: 4,
      graphScore: 4,
      semanticScore: null,
      sharedCiters: 4,
      sharedRefs: null,
      seedCount: 1,
      sources: ["co_cited:seed-1"],
    },
  },
};

function createGapView(overrides: Partial<GapNetworkView> = {}): GapNetworkView {
  return {
    status: "ready",
    version: 3,
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
      papers,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
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
    ...overrides,
  };
}

function createPendingBuild(
  version: number,
  phase: "queued" | "graph-support" | "core-build",
): GapNetworkView {
  return createGapView({
    status: "pending",
    version,
    metadata: {
      ...createGapView().metadata,
      gapNetworkBuild: {
        core: "pending",
        enrichment: "pending",
        phase,
        attempt: phase === "queued" ? 0 : 1,
        ...(phase !== "queued" ? { leaseExpiresAt: "2026-07-07T00:10:00.000Z" } : {}),
        updatedAt: "2026-07-07T00:00:00.000Z",
      },
    },
  });
}

function createCoreMetadata(): GapNetworkMetadata {
  const baseMetadata = createGapView().metadata;
  return {
    ...baseMetadata,
    sourceGraphSupport: graphSupport,
    gapNetworkBuild: {
      core: "ready",
      enrichment: "pending",
      coreEvidence: "citation-semantic-graph-v2",
      updatedAt: "2026-07-07T00:00:03.000Z",
    },
    gapNetworkReport: {
      ...baseMetadata.gapNetworkReport,
      clusters: [
        {
          id: "cluster-1",
          label: "research agents",
          color: "#000000",
          paperCount: 1,
          concepts: [],
        },
      ],
      gapPairs: [
        {
          id: "gap-1",
          leftClusterId: "cluster-1",
          rightClusterId: "cluster-1",
          leftLabel: "research agents",
          rightLabel: "research agents",
          displayLabel: "underexplored bridge",
          observed: 1,
          expected: 2,
          gapScore: 0.8,
          rank: 1,
          bridgeConcepts: [],
          leftConcepts: [],
          rightConcepts: [],
        },
      ],
      metrics: {
        clusterCount: 1,
        totalPaperCount: papers.length,
        totalEdgeCount: 1,
        gapPairCount: 1,
      },
    },
  };
}

function getVersionedUpdateCalls() {
  return updateGapReportIfVersionUncheckedMock.mock.calls as unknown as Array<
    [RepositoryDbHandle, string, number, VersionedGapUpdate, string]
  >;
}

function buildJobParams(gapReportId: string) {
  return { db: TEST_DB, runtimePrincipalId: "user-1", gapReportId };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: TEST_DB,
    user: { id: "user-1", email: "operator@corca.ai" },
  });
});

describe("startGapNetworkBuildJob", () => {
  it("runs the owned build job through phase tracking and stored-core enrichment", async () => {
    const reserved = createPendingBuild(0, "queued");
    const started = createPendingBuild(1, "core-build");
    const coreMetadata = createCoreMetadata();
    const corePayload = {
      viewerPrincipalId: reserved.viewerPrincipalId,
      type: "gap_network" as const,
      title: reserved.title,
      content: reserved.content,
      createdBy: reserved.createdBy,
      metadata: coreMetadata,
      refs: reserved.refs,
    };
    const corePersisted = createGapView({ status: "ready", version: 2, metadata: coreMetadata });
    const coreBuild = corePersisted.metadata.gapNetworkBuild;
    if (!coreBuild) {
      throw new Error("expected core build state");
    }
    const corePhaseDocument = createGapView({
      status: "ready",
      version: 3,
      metadata: {
        ...corePersisted.metadata,
        gapNetworkBuild: {
          ...coreBuild,
          phase: "enrichment",
          attempt: 1,
          leaseExpiresAt: "2026-07-07T00:10:00.000Z",
        },
      },
    });
    const corePhaseBuild = corePhaseDocument.metadata.gapNetworkBuild;
    if (!corePhaseBuild) {
      throw new Error("expected core phase build state");
    }
    const enrichedMetadata: GapNetworkMetadata = {
      ...corePhaseDocument.metadata,
      gapNetworkBuild: {
        ...corePhaseBuild,
        enrichment: "ready",
        updatedAt: "2026-07-07T00:00:10.000Z",
      },
      gapNetworkReport: {
        ...corePhaseDocument.metadata.gapNetworkReport,
        domainLabel: "research agents",
        contentNarrative: {
          overview: "overview",
          clusterParagraphs: [{ clusterId: "cluster-1", paragraph: "cluster narrative" }],
          gapInferenceParagraph: "gap inference",
        },
      },
    };
    const enrichedPayload = { ...corePayload, metadata: enrichedMetadata };
    const enriched = createGapView({ status: "ready", version: 4, metadata: enrichedMetadata });
    getGapReportUncheckedMock
      .mockResolvedValueOnce(reserved)
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(corePhaseDocument);
    updateGapReportIfVersionUncheckedMock
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(corePersisted)
      .mockResolvedValueOnce(corePhaseDocument)
      .mockResolvedValueOnce(enriched);
    buildGapNetworkCoreViewPayload.mockResolvedValueOnce(corePayload);
    buildGapNetworkEnrichedViewPayloadFromCore.mockResolvedValueOnce(enrichedPayload);

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    const buildJob = startGapNetworkBuildJob({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: reserved.id,
    });
    expect(buildJob).toBeInstanceOf(Promise);
    await buildJob;

    expect(buildGapNetworkCoreViewPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "research agents",
        papers,
        graphSupport: undefined,
      }),
    );

    expect(buildGapNetworkEnrichedViewPayloadFromCore).toHaveBeenCalledWith(
      expect.objectContaining({ id: corePhaseDocument.id }),
      {},
      expect.anything(),
    );
    const enrichOptions = buildGapNetworkEnrichedViewPayloadFromCore.mock.calls[0]?.[2] as
      | { usageLedger?: { record?: unknown } }
      | undefined;
    expect(typeof enrichOptions?.usageLedger?.record).toBe("function");
    const updateCalls = getVersionedUpdateCalls();
    const attemptBuild = updateCalls[0]?.[3].metadata.gapNetworkBuild;
    const enrichmentPhaseBuild = updateCalls[2]?.[3].metadata.gapNetworkBuild;
    const finalBuild = updateCalls[3]?.[3].metadata.gapNetworkBuild;
    expect(attemptBuild).toMatchObject({
      core: "pending",
      enrichment: "pending",
      phase: "core-build",
      attempt: 1,
    });
    expect(typeof attemptBuild?.leaseExpiresAt).toBe("string");
    expect(updateCalls[1]?.[3]).toMatchObject({ status: "ready", version: 2 });
    expect(enrichmentPhaseBuild?.phase).toBe("enrichment");
    expect(enrichmentPhaseBuild?.phaseDurationsMs).not.toHaveProperty("graph-support");
    expect(typeof enrichmentPhaseBuild?.phaseDurationsMs?.["core-build"]).toBe("number");
    expect(typeof enrichmentPhaseBuild?.phaseDurationsMs?.persist).toBe("number");
    expect(updateCalls[3]?.[3].status).toBe("ready");
    expect(finalBuild?.enrichment).toBe("ready");
    expect(finalBuild?.phase).toBe("complete");
    expect(typeof finalBuild?.phaseDurationsMs?.enrichment).toBe("number");
  });

  it("exits without duplicate work when another runner owns an active lease", async () => {
    const leased = createPendingBuild(1, "graph-support");
    const leasedBuild = leased.metadata.gapNetworkBuild;
    if (!leasedBuild) {
      throw new Error("expected leased build state");
    }
    getGapReportUncheckedMock.mockResolvedValueOnce({
      ...leased,
      metadata: {
        ...leased.metadata,
        gapNetworkBuild: {
          ...leasedBuild,
          leaseExpiresAt: "2999-07-07T00:10:00.000Z",
        },
      },
    });

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    await startGapNetworkBuildJob({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: leased.id,
    });

    await Promise.resolve();
    expect(updateGapReportIfVersionUncheckedMock).not.toHaveBeenCalled();
    expect(buildGapNetworkCoreViewPayload).not.toHaveBeenCalled();
    expect(buildGapNetworkEnrichedViewPayloadFromCore).not.toHaveBeenCalled();
  });
});

describe("startGapNetworkBuildJob in-flight and current-core boundaries", () => {
  it("deduplicates one in-flight build job and releases the key after settlement", async () => {
    let resolveLookup: ((value: ResearchRoutePayload | null) => void) | undefined;
    getGapReportUncheckedMock.mockImplementationOnce(
      () =>
        new Promise<ResearchRoutePayload | null>((resolve) => {
          resolveLookup = resolve;
        }),
    );

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    const params = buildJobParams("00000000-0000-4000-8000-000000000099");
    const first = startGapNetworkBuildJob(params);
    const duplicate = startGapNetworkBuildJob(params);

    expect(duplicate).toBe(first);
    expect(getGapReportUncheckedMock).toHaveBeenCalledTimes(1);
    if (!resolveLookup) {
      throw new Error("expected the first build lookup to remain in flight");
    }
    resolveLookup(null);
    await first;

    getGapReportUncheckedMock.mockResolvedValueOnce(null);
    const next = startGapNetworkBuildJob(params);
    expect(next).not.toBe(first);
    await next;
    expect(getGapReportUncheckedMock).toHaveBeenCalledTimes(2);
  });

  it("releases a failed in-flight build key so a later request can retry", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const lookupFailure = new Error("lookup unavailable");
    getGapReportUncheckedMock.mockRejectedValueOnce(lookupFailure);

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    const params = buildJobParams("00000000-0000-4000-8000-000000000098");
    const failed = startGapNetworkBuildJob(params);
    await expect(failed).resolves.toBeUndefined();
    expect(consoleWarn).toHaveBeenCalledOnce();

    getGapReportUncheckedMock.mockResolvedValueOnce(null);
    const retry = startGapNetworkBuildJob(params);
    await retry;
    expect(getGapReportUncheckedMock).toHaveBeenCalledTimes(2);
  });

  it("finishes a current core without rebuilding or inventing narrative enrichment", async () => {
    const current = createGapView({
      status: "ready",
      version: 3,
      metadata: {
        ...createGapView().metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "failed",
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-07-07T00:00:05.000Z",
        },
      },
    });
    const currentBuild = current.metadata.gapNetworkBuild;
    if (!currentBuild) {
      throw new Error("expected current core build state");
    }
    const started = createGapView({
      ...current,
      version: 4,
      metadata: {
        ...current.metadata,
        gapNetworkBuild: {
          ...currentBuild,
          phase: "enrichment",
          attempt: 1,
          leaseExpiresAt: "2999-07-07T00:10:00.000Z",
        },
      },
    });
    const startedBuild = started.metadata.gapNetworkBuild;
    if (!startedBuild) {
      throw new Error("expected started core build state");
    }
    const completed = createGapView({
      ...started,
      version: 5,
      metadata: {
        ...started.metadata,
        gapNetworkBuild: {
          ...startedBuild,
          phase: "complete",
        },
      },
    });
    getGapReportUncheckedMock.mockResolvedValueOnce(current);
    updateGapReportIfVersionUncheckedMock
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(completed);

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    await startGapNetworkBuildJob({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: current.id,
    });

    expect(buildGapNetworkCoreViewPayload).not.toHaveBeenCalled();
    expect(buildGapNetworkEnrichedViewPayloadFromCore).not.toHaveBeenCalled();
    const updateCalls = getVersionedUpdateCalls();
    expect(updateCalls).toHaveLength(2);
    expect(updateCalls[0]?.[3].metadata.gapNetworkBuild).toMatchObject({
      core: "ready",
      enrichment: "pending",
      phase: "enrichment",
    });
    expect(updateCalls[1]?.[3]).toMatchObject({
      metadata: {
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "complete",
          coreEvidence: "citation-semantic-graph-v2",
        },
      },
    });
  });
});

describe("gap network build failure state", () => {
  it("queues a failed core marker as pending without taking the runner lease", async () => {
    const failed = createGapView({
      status: "failed",
      version: 2,
      metadata: {
        ...createPendingBuild(2, "queued").metadata,
        gapNetworkBuild: {
          core: "failed",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          leaseExpiresAt: "2026-07-07T00:10:00.000Z",
          updatedAt: "2026-07-07T00:00:05.000Z",
        },
      },
    });
    const queued = createGapView({
      status: "pending",
      version: 3,
      metadata: {
        ...failed.metadata,
        gapNetworkBuild: {
          core: "pending",
          enrichment: "pending",
          phase: "queued",
          attempt: 1,
          updatedAt: "2026-07-07T00:00:06.000Z",
        },
      },
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(queued);

    const { markGapNetworkBuildRetryQueued } = await import("../gap-network-build-state");
    const result = await markGapNetworkBuildRetryQueued({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      document: failed,
    });

    expect(result).toBe(queued);
    const retryUpdate = getVersionedUpdateCalls()[0]?.[3];
    expect(retryUpdate.status).toBe("pending");
    expect(retryUpdate.metadata.gapNetworkBuild).toMatchObject({
      core: "pending",
      enrichment: "pending",
      phase: "queued",
      attempt: 1,
    });
    expect(retryUpdate.metadata.gapNetworkBuild?.leaseExpiresAt).toBeUndefined();
  });

  it("retries a failed core marker by acquiring a new pending attempt", async () => {
    const failed = createGapView({
      status: "failed",
      version: 2,
      metadata: {
        ...createPendingBuild(2, "queued").metadata,
        gapNetworkBuild: {
          core: "failed",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          leaseExpiresAt: "2026-07-07T00:10:00.000Z",
          updatedAt: "2026-07-07T00:00:05.000Z",
        },
      },
    });
    const retryStarted = createGapView({
      status: "pending",
      version: 3,
      metadata: {
        ...failed.metadata,
        gapNetworkBuild: {
          core: "pending",
          enrichment: "pending",
          phase: "core-build",
          attempt: 2,
          leaseExpiresAt: "2999-07-07T00:10:00.000Z",
          updatedAt: "2026-07-07T00:00:06.000Z",
        },
      },
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(retryStarted);

    const { markGapNetworkBuildAttemptStarted } = await import("../gap-network-build-state");
    const result = await markGapNetworkBuildAttemptStarted({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      document: failed,
    });

    expect(result).toEqual({ document: retryStarted, acquired: true });
    const retryUpdate = getVersionedUpdateCalls()[0]?.[3];
    expect(retryUpdate.status).toBe("pending");
    expect(retryUpdate.metadata.gapNetworkBuild).toMatchObject({
      core: "pending",
      enrichment: "pending",
      phase: "core-build",
      attempt: 2,
    });
    expect(typeof retryUpdate.metadata.gapNetworkBuild?.leaseExpiresAt).toBe("string");
  });
});

describe("gap network stale build ownership", () => {
  it("rebuilds a stale complete no-gap marker when core evidence is not current", async () => {
    const baseMetadata = createGapView().metadata;
    const staleComplete = createGapView({
      status: "ready",
      version: 2,
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          metrics: {
            clusterCount: 0,
            totalPaperCount: papers.length,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
        },
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "complete",
          attempt: 1,
          coreEvidence: "citation-semantic-graph-v1",
          updatedAt: "2026-07-07T00:00:05.000Z",
        },
      },
    });
    const retryStarted = createGapView({
      status: "pending",
      version: 3,
      metadata: {
        ...staleComplete.metadata,
        gapNetworkBuild: {
          core: "pending",
          enrichment: "pending",
          phase: "core-build",
          attempt: 2,
          leaseExpiresAt: "2999-07-07T00:10:00.000Z",
          updatedAt: "2026-07-07T00:00:06.000Z",
        },
      },
    });
    updateGapReportIfVersionUncheckedMock.mockResolvedValueOnce(retryStarted);

    const { markGapNetworkBuildAttemptStarted } = await import("../gap-network-build-state");
    const result = await markGapNetworkBuildAttemptStarted({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      document: staleComplete,
    });

    expect(result).toEqual({ document: retryStarted, acquired: true });
    const retryUpdate = getVersionedUpdateCalls()[0]?.[3];
    expect(retryUpdate.status).toBe("pending");
    expect(retryUpdate.metadata.gapNetworkBuild).toMatchObject({
      core: "pending",
      enrichment: "pending",
      phase: "core-build",
      attempt: 2,
    });
  });

  it("does not let a stale failed attempt overwrite a newer completed attempt", async () => {
    const completed = createGapView({
      status: "ready",
      version: 6,
      metadata: {
        ...createCoreMetadata(),
        gapNetworkBuild: {
          core: "ready",
          enrichment: "ready",
          phase: "complete",
          attempt: 2,
          leaseExpiresAt: "2999-07-07T00:10:00.000Z",
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-07-07T00:00:10.000Z",
        },
      },
    });
    getGapReportUncheckedMock.mockResolvedValueOnce(completed);

    const { markGapNetworkBuildFailed } = await import("../gap-network-build-state");
    const result = await markGapNetworkBuildFailed({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      documentId: completed.id,
      durations: { "core-build": 12 },
      attempt: 1,
      leaseExpiresAt: "2026-07-07T00:10:00.000Z",
    });

    expect(result).toBe(completed);
    expect(updateGapReportIfVersionUncheckedMock).not.toHaveBeenCalled();
  });

  it("marks the build failed when core generation throws before enrichment", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reserved = createPendingBuild(0, "queued");
    const started = createPendingBuild(1, "graph-support");
    const failed = createGapView({
      status: "failed",
      version: 2,
      metadata: {
        ...started.metadata,
        gapNetworkBuild: {
          core: "failed",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          leaseExpiresAt: "2026-07-07T00:10:00.000Z",
          updatedAt: "2026-07-07T00:00:02.000Z",
        },
      },
    });
    getGapReportUncheckedMock
      .mockResolvedValueOnce(reserved)
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(started);
    updateGapReportIfVersionUncheckedMock
      .mockResolvedValueOnce(started)
      .mockResolvedValueOnce(failed);
    buildGapNetworkCoreViewPayload.mockRejectedValueOnce(new Error("core build failed"));

    const { startGapNetworkBuildJob } = await import("../gap-network-view-access");
    await startGapNetworkBuildJob({
      db: TEST_DB,
      runtimePrincipalId: "user-1",
      gapReportId: reserved.id,
    });

    expect(consoleWarn).toHaveBeenCalledOnce();
    const [warningLabel, warningDetails] = consoleWarn.mock.calls[0] as unknown as [
      string,
      { gapReportId: string; error: unknown },
    ];
    expect(warningLabel).toBe("[gap-network-build] job failed");
    expect(warningDetails.gapReportId).toBe(reserved.id);
    expect(warningDetails.error).toBeInstanceOf(Error);
    if (!(warningDetails.error instanceof Error)) {
      throw new Error("expected build failure warning to retain the original error");
    }
    expect(warningDetails.error.message).toBe("core build failed");
    const failedUpdate = getVersionedUpdateCalls()[1][3];
    expect(failedUpdate.status).toBe("failed");
    expect(failedUpdate.metadata.gapNetworkBuild).toMatchObject({
      core: "failed",
      enrichment: "failed",
      phase: "failed",
      attempt: 1,
    });
    consoleWarn.mockRestore();
  });
});
