import { beforeEach, describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createSearchDoc(id: string): Extract<ResearchRoutePayload, { type: "search" }> {
  const now = "2026-04-28T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "search",
    title: `검색 ${id}`,
    content: "",
    createdBy: "user",
    metadata: { type: "search", query: "llm", papers: [], total: 1 },
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    reaction: null,
  };
}

describe("research-route-store active reaction invariant (docs/principles.md §6)", () => {
  beforeEach(() => {
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  // aspect:route-view-ai-reaction-rules invariant — `ResearchRoutePayload.reaction` is server-only persistence;
  // `routeAiComment` is the single active-session client source of truth. Metadata
  // mutators such as `patchCurrentView` MUST NOT overwrite the active reaction even when
  // server response carries `reaction: null` (e.g. inline analysis PATCH where reaction is
  // mid-flight on a separate persistence path).
  it("preserves the active reaction across patchCurrentView when the server response carries no reaction (e.g. inline analysis PATCH)", () => {
    const initialDocument = createSearchDoc("search-1");
    useResearchRouteStore.getState().setCurrentView(initialDocument, "test-execution:37");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "route-ai-comment-1",
        title: "검색 반응",
        body: "검색 결과 1편",
        chips: [],
        timestamp: "2026-04-28T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("route-ai-comment-1");
    expect(useResearchRouteStore.getState().reactionCardHistory.length).toBe(1);

    useResearchRouteStore.getState().patchCurrentView(
      {
        ...initialDocument,
        updatedAt: "2026-04-28T00:01:00.000Z",
        metadata: { type: "search", query: "llm", papers: [], total: 1 },
        reaction: null,
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("route-ai-comment-1");
    expect(useResearchRouteStore.getState().reactionCardHistory.length).toBe(1);
  });
});
