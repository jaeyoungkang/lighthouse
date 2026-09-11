import { beforeEach, describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createGapView(): Extract<ResearchRoutePayload, { type: "gap_network" }> {
  return {
    id: "gap-1",
    type: "gap_network",
    title: "Gap report",
    content: "",
    createdBy: "user",
    metadata: {
      type: "gap_network",
      version: 1,
      sourceSnapshotId: "search-1",
      query: "agent memory",
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
    },
    refs: ["search-1"],
    viewerPrincipalId: "viewer-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
  };
}

function createSearchView(
  id: string,
  updatedAt = "2026-07-04T00:00:00.000Z",
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    id,
    type: "search",
    title: `Search ${id}`,
    content: "",
    createdBy: "user",
    metadata: { type: "search", query: id, papers: [], total: 0 },
    reaction: null,
    refs: [],
    ownerPrincipalId: "owner-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt,
  };
}

describe("research-route-store active execution", () => {
  beforeEach(() => {
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("stores exactly one active route execution", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-1"), "exec-1");
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-2"), "exec-2");

    expect(useResearchRouteStore.getState()).toMatchObject({
      currentView: { id: "search-2" },
      activeExecutionId: "exec-2",
    });
  });

  it("resets scalar session state when a new execution reuses the same id and updatedAt", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "reaction-1",
        title: "Reaction",
        body: "Body",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
    );
    useResearchRouteStore.getState().requestRouteAiCommentRegeneration(view.id, "exec-1");
    useResearchRouteStore.getState().setSearchVisibleCount("exec-1", "window", 20);

    useResearchRouteStore.getState().setCurrentView(view, "exec-2");

    expect(useResearchRouteStore.getState()).toMatchObject({
      activeExecutionId: "exec-2",
      routeAiComment: null,
      reactionGeneration: 0,
      pendingRouteAiCommentRegeneration: false,
      reactionCardHistory: [],
      searchVisibleWindow: null,
    });
  });

  it("does not let old cleanup clear a newer same-id execution", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-2");

    useResearchRouteStore.getState().clearCurrentView("exec-1");

    expect(useResearchRouteStore.getState().currentView?.id).toBe(view.id);
    expect(useResearchRouteStore.getState().activeExecutionId).toBe("exec-2");
  });

  it("lets an empty route own cleanup without clearing adjacent executions", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setCurrentView(null, "empty-exec");

    useResearchRouteStore.getState().clearCurrentView("exec-1");
    expect(useResearchRouteStore.getState().currentView).toBeNull();
    expect(useResearchRouteStore.getState().activeExecutionId).toBe("empty-exec");

    useResearchRouteStore.getState().setCurrentView(view, "exec-2");
    useResearchRouteStore.getState().clearCurrentView("empty-exec");
    expect(useResearchRouteStore.getState().currentView?.id).toBe(view.id);
    expect(useResearchRouteStore.getState().activeExecutionId).toBe("exec-2");
  });

  it("rejects old completion and visible-window writers from a previous execution", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-2");

    useResearchRouteStore
      .getState()
      .patchCurrentView({ ...view, title: "stale completion" }, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "stale-reaction",
        title: "Stale",
        body: "Stale",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
    );
    useResearchRouteStore.getState().setSearchVisibleCount("exec-1", "window", 99);

    expect(useResearchRouteStore.getState().currentView?.title).toBe("Search search-1");
    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
    expect(useResearchRouteStore.getState().searchVisibleWindow).toBeNull();
  });

  it("preserves active reaction state across a fresh metadata patch", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "reaction-1",
        title: "Reaction",
        body: "Body",
        chips: [],
        timestamp: view.updatedAt,
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    useResearchRouteStore.getState().patchCurrentView(
      {
        ...view,
        updatedAt: "2026-07-04T00:01:00.000Z",
        metadata: { type: "search", query: "search-1", papers: [], total: 1 },
      },
      "exec-1",
    );

    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("reaction-1");
  });

  it("ignores stale timestamps inside the current execution", () => {
    const view = createSearchView("search-1", "2026-07-04T00:02:00.000Z");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");

    const staleResult = useResearchRouteStore
      .getState()
      .patchCurrentView(
        { ...view, title: "Stale", updatedAt: "2026-07-04T00:01:00.000Z" },
        "exec-1",
      );
    expect(staleResult).toBe(false);
    expect(useResearchRouteStore.getState().currentView?.title).toBe("Search search-1");

    const freshResult = useResearchRouteStore
      .getState()
      .patchCurrentView(
        { ...view, title: "Fresh", updatedAt: "2026-07-04T00:03:00.000Z" },
        "exec-1",
      );
    expect(freshResult).toBe(true);
    expect(useResearchRouteStore.getState().currentView?.title).toBe("Fresh");
  });

  it("rejects the retired owner alias when patching a gap viewer payload", () => {
    const view = createGapView();
    useResearchRouteStore.getState().setCurrentView(view, "exec-gap");

    const retiredOwnerPatch = {
      id: view.id,
      type: "gap_network",
      ownerPrincipalId: "viewer-2",
    } as unknown as Parameters<
      ReturnType<typeof useResearchRouteStore.getState>["patchCurrentView"]
    >[0];
    const patched = useResearchRouteStore
      .getState()
      .patchCurrentView(retiredOwnerPatch, "exec-gap");

    expect(patched).toBe(false);
    expect(useResearchRouteStore.getState().currentView).toEqual(view);
    expect(useResearchRouteStore.getState().currentView).not.toHaveProperty("ownerPrincipalId");
  });
});
