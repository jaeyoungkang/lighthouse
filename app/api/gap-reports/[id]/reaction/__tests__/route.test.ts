import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

const { getGapNetworkViewMock, requireOwnerPrincipalAuth, updateGapNetworkReactionPreferenceMock } =
  vi.hoisted(() => ({
    getGapNetworkViewMock: vi.fn(),
    requireOwnerPrincipalAuth: vi.fn(),
    updateGapNetworkReactionPreferenceMock: vi.fn(),
  }));

const gapReportId = "11111111-1111-4111-8111-111111111111";

function routeContext(id = gapReportId) {
  return { params: Promise.resolve({ id }) };
}

vi.mock("@/app/server/domain-access/gap-report-access", () => ({
  getGapNetworkView: getGapNetworkViewMock,
  updateGapNetworkReactionPreference: updateGapNetworkReactionPreferenceMock,
}));
vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));

const reaction = {
  id: "reaction-1",
  title: "검색 반응",
  body: "상위 결과의 흐름을 정리했다.",
  chips: [],
  timestamp: "2026-06-01T00:00:00.000Z",
};

const previousReaction = {
  id: "reaction-0",
  title: "이전 반응",
  body: "이전 문서 흐름을 정리했다.",
  chips: [],
  timestamp: "2026-05-31T00:00:00.000Z",
};

const degradedReaction = {
  id: "awareness-failed-2026-06-01T00:00:00.000Z",
  title: "AI comment를 만들지 못했습니다",
  body: "현재 view는 그대로 사용할 수 있습니다.",
  chips: [],
  timestamp: "2026-06-01T00:00:00.000Z",
};

function createDocument(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: gapReportId,
    type: "gap_network",
    title: "연구 공백",
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "llm",
      papers: [],
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
        insight: { hypotheses: [] },
      },
      reactionPreparation: {
        overviewReaction: reaction,
        clusterReactions: [{ clusterId: "cluster-0", reaction: previousReaction }],
        gapReactions: [],
        preparedAt: "2026-06-01T00:00:00.000Z",
      },
    },
    reaction,
    reactionHistory: [reaction],
    refs: [],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

function resetRouteMocks() {
  getGapNetworkViewMock.mockReset();
  requireOwnerPrincipalAuth.mockReset();
  requireOwnerPrincipalAuth.mockResolvedValue({ db: {}, user: { id: "viewer-1" } });
  updateGapNetworkReactionPreferenceMock.mockReset();
  getGapNetworkViewMock.mockResolvedValue(createDocument());
}

describe("gap reaction mutation ingress", () => {
  beforeEach(resetRouteMocks);

  it("authenticates before parsing a reaction mutation body", async () => {
    const { UnauthenticatedError } = await import("@/app/server/auth/auth-errors");
    requireOwnerPrincipalAuth.mockRejectedValue(new UnauthenticatedError());
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request(`http://localhost/api/gap-reports/${gapReportId}/reaction`, {
        method: "PUT",
        body: "not-json",
      }),
      routeContext(),
    );

    expect(response.status).toBe(401);
    expect(getGapNetworkViewMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized reaction mutation body", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request(`http://localhost/api/gap-reports/${gapReportId}/reaction`, {
        method: "PUT",
        body: "x".repeat(100_001),
      }),
      routeContext(),
    );

    expect(response.status).toBe(413);
    expect(getGapNetworkViewMock).not.toHaveBeenCalled();
  });
});

describe("route AI comment route", () => {
  beforeEach(resetRouteMocks);

  it("reads back the viewer-scoped server state after an ambiguous write", async () => {
    const document = createDocument();
    getGapNetworkViewMock.mockResolvedValue(document);

    const { GET } = await import("../route");
    const response = await GET(
      new Request(`http://localhost/api/gap-reports/${gapReportId}/reaction`),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(getGapNetworkViewMock).toHaveBeenCalledWith(gapReportId);
    await expect(response.json()).resolves.toEqual(document);
  });

  it("persists a successful AI comment through the reaction sub-resource", async () => {
    const updatedDocument = createDocument();
    updateGapNetworkReactionPreferenceMock.mockResolvedValue(updatedDocument);
    const clientTimedReaction = {
      ...reaction,
      timestamp: "2026-06-01T00:00:01.000Z",
    };

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction: clientTimedReaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledWith(gapReportId, 0, 0, {
      reaction: clientTimedReaction,
      reactionHistory: [clientTimedReaction],
    });
    await expect(response.json()).resolves.toEqual(updatedDocument);
  });

  it("rejects a reaction that is not one of the artifact's prepared templates", async () => {
    const forgedReaction = {
      ...reaction,
      body: "사용자가 임의로 바꾼 준비되지 않은 본문이다.",
    };

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction: forgedReaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "reaction does not match a prepared gap reaction",
      code: "GAP_REACTION_NOT_PREPARED",
      action: "correct-request",
      retryable: false,
    });
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects reaction persistence when the artifact has no prepared reactions", async () => {
    const document = createDocument();
    if (document.metadata.type !== "gap_network") throw new Error("gap metadata is required");
    getGapNetworkViewMock.mockResolvedValue({
      ...document,
      metadata: { ...document.metadata, reactionPreparation: undefined },
    });

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(422);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects client-owned history so the server remains the only history source", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, reactionHistory: [reaction], baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized reaction id before it can amplify persisted history", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({
          reaction: { ...reaction, id: "r".repeat(161) },
          baseReactionVersion: 0,
        }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid reaction surface instead of compatibility-stripping it", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({
          reaction: {
            ...reaction,
            surface: {
              kind: "paper_cards",
              intent: "representative",
              cards: Array.from({ length: 4 }, (_, index) => ({
                paperId: `paper-${String(index)}`,
                title: `Paper ${String(index)}`,
                headline: "대표 논문",
                insight: "현재 결과를 설명하는 대표 논문이다.",
              })),
            },
          },
          baseReactionVersion: 0,
        }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(400);
    expect(getGapNetworkViewMock).not.toHaveBeenCalled();
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("rejects non-UUID path ids before repository access", async () => {
    const { DELETE, GET, PUT } = await import("../route");
    const getResponse = await GET(
      new Request("http://localhost/api/gap-reports/not-uuid/reaction"),
      routeContext("not-uuid"),
    );
    const putResponse = await PUT(
      new Request("http://localhost/api/gap-reports/not-uuid/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext("not-uuid"),
    );
    const deleteResponse = await DELETE(
      new Request("http://localhost/api/gap-reports/not-uuid/reaction", {
        method: "DELETE",
        body: JSON.stringify({ baseReactionVersion: 0 }),
      }),
      routeContext("not-uuid"),
    );

    expect(getResponse.status).toBe(400);
    expect(putResponse.status).toBe(400);
    expect(deleteResponse.status).toBe(400);
    expect(getGapNetworkViewMock).not.toHaveBeenCalled();
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("merges with existing reaction history when the client omits history", async () => {
    getGapNetworkViewMock.mockResolvedValue({
      ...createDocument(),
      reaction: previousReaction,
      reactionHistory: [],
    });
    updateGapNetworkReactionPreferenceMock.mockResolvedValue({
      ...createDocument(),
      reaction,
      reactionHistory: [previousReaction, reaction],
    });

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledWith(gapReportId, 0, 0, {
      reaction,
      reactionHistory: [previousReaction, reaction],
    });
  });

  it("rejects degraded AI comment notices as persisted route payload state", async () => {
    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction: degradedReaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "degraded AI comment notices are not persisted",
      code: "GAP_REACTION_DEGRADED_NOTICE_REJECTED",
      action: "correct-request",
      retryable: false,
    });
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });
});

describe("route AI comment ordering", () => {
  beforeEach(resetRouteMocks);

  it("returns the current server state for a stale non-template retry without mutating", async () => {
    const currentDocument = {
      ...createDocument(),
      version: 2,
      reactionVersion: 1,
    };
    getGapNetworkViewMock.mockResolvedValue(currentDocument);

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({
          reaction: { ...reaction, body: "stale retry payload is not a prepared template" },
          baseReactionVersion: 0,
        }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(currentDocument);
  });

  it("re-reads and rebases reaction history after a version conflict", async () => {
    const committedElsewhere = {
      ...createDocument(),
      version: 1,
      reaction: previousReaction,
      reactionHistory: [previousReaction],
    };
    const rebased = {
      ...committedElsewhere,
      version: 2,
      reaction,
      reactionHistory: [previousReaction, reaction],
    };
    getGapNetworkViewMock
      .mockResolvedValueOnce(createDocument())
      .mockResolvedValueOnce(committedElsewhere);
    updateGapNetworkReactionPreferenceMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(rebased);

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenNthCalledWith(1, gapReportId, 0, 0, {
      reaction,
      reactionHistory: [reaction],
    });
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenNthCalledWith(2, gapReportId, 1, 0, {
      reaction,
      reactionHistory: [previousReaction, reaction],
    });
    await expect(response.json()).resolves.toEqual(rebased);
  });

  it("revalidates the prepared template after a CAS conflict", async () => {
    const initial = createDocument();
    if (initial.metadata.type !== "gap_network") throw new Error("gap metadata is required");
    const changedPreparation = {
      ...initial,
      version: 1,
      metadata: {
        ...initial.metadata,
        reactionPreparation: {
          overviewReaction: previousReaction,
          clusterReactions: [],
          gapReactions: [],
          preparedAt: "2026-06-01T00:00:01.000Z",
        },
      },
    };
    getGapNetworkViewMock.mockResolvedValueOnce(initial).mockResolvedValueOnce(changedPreparation);
    updateGapNetworkReactionPreferenceMock.mockResolvedValueOnce(null);

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(422);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledTimes(1);
  });
});

describe("route AI comment history ordering", () => {
  beforeEach(resetRouteMocks);

  it("keeps the newest selected reaction when an older execution writes later", async () => {
    const currentDocument = {
      ...createDocument(),
      version: 3,
      reactionVersion: 1,
      reaction,
      reactionHistory: [reaction],
    };
    getGapNetworkViewMock.mockResolvedValue(currentDocument);

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction: previousReaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(currentDocument);
  });

  it("returns 409 after bounded version conflicts are exhausted", async () => {
    updateGapNetworkReactionPreferenceMock.mockResolvedValue(null);

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(409);
    expect(getGapNetworkViewMock).toHaveBeenCalledTimes(4);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledTimes(4);
  });

  it("caps and normalizes server-owned history instead of rewriting an unbounded row", async () => {
    const longHistory = Array.from({ length: 101 }, (_, index) => ({
      ...previousReaction,
      id: `history-${String(index).padStart(3, "0")}`,
      timestamp: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
    }));
    getGapNetworkViewMock.mockResolvedValue({
      ...createDocument(),
      reaction: null,
      reactionHistory: longHistory,
    });
    updateGapNetworkReactionPreferenceMock.mockResolvedValue(createDocument());

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    const changes = updateGapNetworkReactionPreferenceMock.mock.calls[0]?.[3] as
      | { reactionHistory: Array<typeof reaction> }
      | undefined;
    expect(changes?.reactionHistory).toHaveLength(100);
    expect(changes?.reactionHistory[0]?.id).toBe("history-002");
    expect(changes?.reactionHistory.at(-1)?.id).toBe(reaction.id);
  });

  it("moves a repeated id to the accepted tail and drops invalid legacy history", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-01T00:00:00.000Z"));
    const oldSameId = {
      ...reaction,
      body: "동일 ID의 이전 본문",
      timestamp: "2026-05-30T00:00:00.000Z",
    };
    const invalidFuture = {
      ...reaction,
      id: "future-history",
      timestamp: "9999-01-01T00:00:00.000Z",
    };
    const invalidOversized = {
      ...previousReaction,
      id: "legacy".repeat(27),
    };
    getGapNetworkViewMock.mockResolvedValue({
      ...createDocument(),
      reaction: null,
      reactionHistory: [oldSameId, previousReaction, invalidFuture, invalidOversized],
    });
    updateGapNetworkReactionPreferenceMock.mockResolvedValue(createDocument());

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    const changes = updateGapNetworkReactionPreferenceMock.mock.calls[0]?.[3] as
      | { reactionHistory: Array<typeof reaction> }
      | undefined;
    expect(changes?.reactionHistory).toEqual([previousReaction, reaction]);
  });

  it("rejects a client timestamp beyond the bounded clock-skew window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-01T00:00:00.000Z"));
    const futureReaction = {
      ...reaction,
      id: "future-reaction",
      timestamp: "9999-01-01T00:00:00.000Z",
    };

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction: futureReaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(422);
    expect(updateGapNetworkReactionPreferenceMock).not.toHaveBeenCalled();
  });

  it("uses reactionVersion and accepted request order instead of timestamp freshness", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-01T00:00:00.000Z"));
    const clockAheadReaction = {
      ...previousReaction,
      id: "clock-ahead-reaction",
      timestamp: "2026-06-01T00:04:00.000Z",
    };
    const existing = {
      ...createDocument(),
      reaction: clockAheadReaction,
      reactionHistory: [clockAheadReaction],
    };
    getGapNetworkViewMock.mockResolvedValue(existing);
    updateGapNetworkReactionPreferenceMock.mockResolvedValue({
      ...existing,
      version: 1,
      reactionVersion: 1,
      reaction,
      reactionHistory: [clockAheadReaction, reaction],
    });

    const { PUT } = await import("../route");
    const response = await PUT(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "PUT",
        body: JSON.stringify({ reaction, baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledWith(gapReportId, 0, 0, {
      reaction,
      reactionHistory: [clockAheadReaction, reaction],
    });
  });
});

describe("route AI comment deletion", () => {
  beforeEach(resetRouteMocks);

  it("clears a persisted AI comment through DELETE", async () => {
    const clearedDocument = { ...createDocument(), reaction: null, reactionHistory: [] };
    updateGapNetworkReactionPreferenceMock.mockResolvedValue(clearedDocument);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "DELETE",
        body: JSON.stringify({ baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledWith(gapReportId, 0, 0, {
      reaction: null,
      reactionHistory: [],
    });
    await expect(response.json()).resolves.toEqual(clearedDocument);
  });

  it("does not let a stale DELETE erase a newer reaction after a version conflict", async () => {
    const newerDocument = {
      ...createDocument(),
      version: 1,
      reactionVersion: 1,
    };
    getGapNetworkViewMock
      .mockResolvedValueOnce(createDocument())
      .mockResolvedValueOnce(newerDocument);
    updateGapNetworkReactionPreferenceMock.mockResolvedValueOnce(null);

    const { DELETE } = await import("../route");
    const response = await DELETE(
      new Request("http://localhost/api/gap-reports/search-1/reaction", {
        method: "DELETE",
        body: JSON.stringify({ baseReactionVersion: 0 }),
      }),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(updateGapNetworkReactionPreferenceMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual(newerDocument);
  });
});
