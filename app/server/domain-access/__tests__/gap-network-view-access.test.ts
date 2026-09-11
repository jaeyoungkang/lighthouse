import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";

interface TestReactionPreference {
  reaction: RouteAiComment | null;
  reactionHistory: RouteAiComment[];
  reactionVersion: number;
}

const {
  applyGapReportReactionPreference,
  getGapReportReactionPreferenceUnchecked,
  getGapReportUnchecked,
  requireOwnerPrincipalAuth,
  reserveGapReportUnchecked,
  updateGapReportReactionPreferenceIfVersionUnchecked,
} = vi.hoisted(() => ({
  applyGapReportReactionPreference: vi.fn(
    (
      report: ResearchRoutePayload,
      preference: TestReactionPreference | null,
    ): ResearchRoutePayload =>
      preference
        ? {
            ...report,
            reaction: preference.reaction,
            reactionHistory: preference.reactionHistory,
            reactionVersion: preference.reactionVersion,
          }
        : report,
  ),
  getGapReportReactionPreferenceUnchecked: vi.fn(),
  getGapReportUnchecked: vi.fn(),
  requireOwnerPrincipalAuth: vi.fn(),
  reserveGapReportUnchecked: vi.fn(),
  updateGapReportReactionPreferenceIfVersionUnchecked: vi.fn(),
}));

vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/repository/gap-reports", () => ({
  applyGapReportReactionPreference,
  getGapReportReactionPreferenceUnchecked,
  getGapReportUnchecked,
  reserveGapReportUnchecked,
  updateGapReportReactionPreferenceIfVersionUnchecked,
}));

import { reserveGapNetworkViewFromSnapshot } from "@/app/server/domain-access/gap-network-view-access";
import {
  findGapNetworkView,
  getGapNetworkView,
  updateGapNetworkReactionPreference,
} from "@/app/server/domain-access/gap-report-access";

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

function report(runtimePrincipalId = "viewer-1"): ResearchRoutePayload {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    viewerPrincipalId: runtimePrincipalId,
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
      gapNetworkReport: {
        clusters: [],
        conceptEdges: [],
        gapPairs: [],
        metrics: { clusterCount: 0, totalPaperCount: 1, totalEdgeCount: 0, gapPairCount: 0 },
        insight: { hypotheses: [] },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    },
    reaction: null,
    reactionHistory: [],
    refs: ["search-1"],
    status: "ready",
    version: 3,
    reactionVersion: 0,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: {},
    user: { id: "viewer-1", email: "viewer@example.com" },
  });
  getGapReportReactionPreferenceUnchecked.mockResolvedValue(null);
});

describe("shared gap report domain access", () => {
  it("requires authentication before reading a shared report", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());

    await expect(findGapNetworkView("shared-report")).rejects.toBeInstanceOf(UnauthenticatedError);
    expect(getGapReportUnchecked).not.toHaveBeenCalled();
  });

  it("reuses a content-addressed artifact without scoping the lookup to the creator", async () => {
    const existing = report("viewer-2");
    reserveGapReportUnchecked.mockResolvedValue(existing);

    const result = await reserveGapNetworkViewFromSnapshot({
      sourceSnapshotId: "new-route-snapshot",
      sourceQuery: "research agents",
      papers,
    });

    expect(result).toEqual({ ...existing, viewerPrincipalId: "viewer-1" });
    expect(reserveGapReportUnchecked).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ viewerPrincipalId: "viewer-1" }),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("reprojects a shared in-flight reservation to each authenticated viewer", async () => {
    let resolveLookup: ((value: ResearchRoutePayload) => void) | undefined;
    reserveGapReportUnchecked.mockReturnValue(
      new Promise<ResearchRoutePayload>((resolve) => {
        resolveLookup = resolve;
      }),
    );
    requireOwnerPrincipalAuth
      .mockResolvedValueOnce({ db: {}, user: { id: "viewer-1" } })
      .mockResolvedValueOnce({ db: {}, user: { id: "viewer-2" } });

    const input = {
      sourceSnapshotId: "search-1",
      sourceQuery: "research agents",
      papers,
    };
    const first = reserveGapNetworkViewFromSnapshot(input);
    await vi.waitFor(() => {
      expect(reserveGapReportUnchecked).toHaveBeenCalledTimes(1);
    });
    const second = reserveGapNetworkViewFromSnapshot(input);
    resolveLookup?.(report("viewer-1"));

    await expect(first).resolves.toMatchObject({ viewerPrincipalId: "viewer-1" });
    await expect(second).resolves.toMatchObject({ viewerPrincipalId: "viewer-2" });
    expect(reserveGapReportUnchecked).toHaveBeenCalledTimes(1);
  });

  it("does not deduplicate concurrent reservations with different source identities", async () => {
    const resolvers: Array<(value: ResearchRoutePayload) => void> = [];
    reserveGapReportUnchecked.mockImplementation(
      () =>
        new Promise<ResearchRoutePayload>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const first = reserveGapNetworkViewFromSnapshot({
      sourceSnapshotId: "search-a",
      sourceQuery: "research agents",
      papers,
    });
    const second = reserveGapNetworkViewFromSnapshot({
      sourceSnapshotId: "search-b",
      sourceQuery: "evaluation agents",
      papers,
    });
    await vi.waitFor(() => {
      expect(reserveGapReportUnchecked).toHaveBeenCalledTimes(2);
    });
    resolvers[0]?.(report());
    resolvers[1]?.({ ...report(), id: "00000000-0000-4000-8000-000000000002" });

    await expect(first).resolves.toMatchObject({ id: "00000000-0000-4000-8000-000000000001" });
    await expect(second).resolves.toMatchObject({ id: "00000000-0000-4000-8000-000000000002" });
  });

  it("allows another authenticated member to read the same report with their own preference", async () => {
    const shared = report("viewer-2");
    const reaction = {
      id: "reaction-1",
      title: "선택",
      body: "viewer-2의 선택",
      chips: [],
      timestamp: "2026-07-10T00:00:00.000Z",
    };
    getGapReportUnchecked.mockResolvedValue(shared);
    getGapReportReactionPreferenceUnchecked.mockResolvedValue({
      gapReportId: shared.id,
      viewerPrincipalId: "viewer-2",
      artifactVersion: 3,
      reaction,
      reactionHistory: [reaction],
      reactionVersion: 1,
    });
    requireOwnerPrincipalAuth.mockResolvedValue({
      db: {},
      user: { id: "viewer-2", email: "viewer2@example.com" },
    });

    const result = await getGapNetworkView(shared.id);

    expect(getGapReportUnchecked).toHaveBeenCalledWith({}, shared.id, "viewer-2");
    expect(getGapReportReactionPreferenceUnchecked).toHaveBeenCalledWith({}, shared.id, "viewer-2");
    expect(result.reaction).toEqual(reaction);
  });

  it("writes only the current viewer preference against the current artifact version", async () => {
    const shared = report();
    const reaction = {
      id: "reaction-1",
      title: "선택",
      body: "viewer-1의 선택",
      chips: [],
      timestamp: "2026-07-10T00:00:00.000Z",
    };
    getGapReportUnchecked.mockResolvedValue(shared);
    updateGapReportReactionPreferenceIfVersionUnchecked.mockResolvedValue({
      gapReportId: shared.id,
      viewerPrincipalId: "viewer-1",
      artifactVersion: 3,
      reaction,
      reactionHistory: [reaction],
      reactionVersion: 1,
    });

    const result = await updateGapNetworkReactionPreference(shared.id, 3, 0, {
      reaction,
      reactionHistory: [reaction],
    });

    expect(updateGapReportReactionPreferenceIfVersionUnchecked).toHaveBeenCalledWith(
      {},
      {
        gapReportId: shared.id,
        viewerPrincipalId: "viewer-1",
        artifactVersion: 3,
        expectedReactionVersion: 0,
        reaction,
        reactionHistory: [reaction],
      },
    );
    expect(result?.reactionVersion).toBe(1);
  });
});

describe("shared gap report reservation and version boundaries", () => {
  it("creates a pending content-addressed artifact when no reservation exists", async () => {
    const created = { ...report(), status: "pending" as const };
    reserveGapReportUnchecked.mockResolvedValue(created);

    const result = await reserveGapNetworkViewFromSnapshot({
      sourceSnapshotId: "search-new",
      sourceQuery: "  research agents  ",
      papers,
      createdBy: "agent",
    });

    expect(result).toEqual(created);
    expect(reserveGapReportUnchecked).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        type: "gap_network",
        content: "",
        createdBy: "agent",
        refs: ["search-new"],
        viewerPrincipalId: "viewer-1",
        status: "pending",
      }),
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("fails get but lets polling return null when the shared report does not exist", async () => {
    getGapReportUnchecked.mockResolvedValue(null);

    await expect(getGapNetworkView("missing-report")).rejects.toThrow("연구 화면 없음");
    await expect(findGapNetworkView("missing-report")).resolves.toBeNull();
    expect(getGapReportReactionPreferenceUnchecked).not.toHaveBeenCalled();
  });

  it("returns a pending report without reading a viewer preference", async () => {
    const base = report();
    const pending = {
      ...base,
      status: "pending" as const,
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "pending" as const,
          enrichment: "pending" as const,
          updatedAt: "2026-07-10T00:00:00.000Z",
        },
      },
    };
    getGapReportUnchecked.mockResolvedValue(pending);

    await expect(findGapNetworkView(pending.id)).resolves.toBe(pending);
    expect(getGapReportReactionPreferenceUnchecked).not.toHaveBeenCalled();
    expect(applyGapReportReactionPreference).not.toHaveBeenCalled();
  });

  it.each([
    ["missing report", null, 3],
    ["stale artifact", report(), 4],
  ])("rejects a preference write for a %s", async (_label, stored, artifactVersion) => {
    getGapReportUnchecked.mockResolvedValue(stored);

    await expect(
      updateGapNetworkReactionPreference("report", artifactVersion, 0, {
        reaction: null,
        reactionHistory: [],
      }),
    ).resolves.toBeNull();
    expect(updateGapReportReactionPreferenceIfVersionUnchecked).not.toHaveBeenCalled();
  });

  it("returns null when the atomic preference version check loses", async () => {
    getGapReportUnchecked.mockResolvedValue(report());
    updateGapReportReactionPreferenceIfVersionUnchecked.mockResolvedValue(null);

    await expect(
      updateGapNetworkReactionPreference(report().id, 3, 7, {
        reaction: null,
        reactionHistory: [],
      }),
    ).resolves.toBeNull();
    expect(getGapReportUnchecked).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["disappears", null],
    ["changes version", { ...report(), version: 4 }],
  ])(
    "returns null when the report %s before preference confirmation",
    async (_label, confirmed) => {
      const preference = {
        gapReportId: report().id,
        viewerPrincipalId: "viewer-1",
        artifactVersion: 3,
        reaction: null,
        reactionHistory: [],
        reactionVersion: 1,
      };
      getGapReportUnchecked.mockResolvedValueOnce(report()).mockResolvedValueOnce(confirmed);
      updateGapReportReactionPreferenceIfVersionUnchecked.mockResolvedValue(preference);

      await expect(
        updateGapNetworkReactionPreference(report().id, 3, 0, {
          reaction: null,
          reactionHistory: [],
        }),
      ).resolves.toBeNull();
      expect(applyGapReportReactionPreference).not.toHaveBeenCalled();
    },
  );
});
