import { describe, expect, it } from "vitest";
import {
  ROUTE_AI_COMMENT_GENERATION_COALESCE_WINDOW_MS,
  drainNextRouteAiCommentGeneration,
  enqueueRouteAiCommentGeneration,
} from "@/app/components/research/route-ai-comment-generation-scheduler";
import type { ViewSnapshot } from "@/app/domain/view-snapshot";

function snapshot(
  snapshotId: string,
  snapshotKind: ViewSnapshot["snapshotKind"] = "search",
): ViewSnapshot {
  if (snapshotKind === "citation_lineage") {
    return {
      snapshotId,
      snapshotKind,
      title: "Citation",
      content: {
        kind: "citation_lineage",
        seedPaper: { id: "seed", title: "Seed", year: 2026, authors: ["Ada"] },
        total: 0,
        referenceCount: 0,
        citationCount: 0,
        references: [],
        citations: [],
      },
    };
  }
  if (snapshotKind === "graph_neighbors") {
    return {
      snapshotId,
      snapshotKind,
      title: "Similar",
      content: {
        kind: "graph_neighbors",
        seedPaper: { id: "seed", title: "Seed", year: 2026, authors: ["Ada"] },
        total: 0,
        coCitedCount: 0,
        coupledCount: 0,
        coCited: [],
        coupled: [],
      },
    };
  }
  return {
    snapshotId,
    snapshotKind: "search",
    title: "Search",
    content: {
      kind: "search",
      query: "llm",
      total: 1,
      results: [{ id: "paper-1", title: "Paper 1", year: 2026, citationCount: 7 }],
    },
  };
}

function snapshotProjection(
  snapshotId: string,
  snapshotKind: ViewSnapshot["snapshotKind"] = "search",
) {
  const viewSnapshot = snapshot(snapshotId, snapshotKind);
  return { viewSnapshot };
}

describe("route AI comment generation scheduler", () => {
  it("deduplicates identical commands and keeps only the latest search commands", () => {
    const firstSearch = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 1,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-1",
      ...snapshotProjection("search-1"),
      reactionGeneration: 0,
    } as const;
    const sameTargetLaterSearch = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 2,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-1",
      ...snapshotProjection("search-1"),
      reactionGeneration: 0,
    } as const;
    const otherTargetSearch = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 3,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-2",
      ...snapshotProjection("search-2"),
      reactionGeneration: 0,
    } as const;

    expect(ROUTE_AI_COMMENT_GENERATION_COALESCE_WINDOW_MS).toBe(240);
    expect(enqueueRouteAiCommentGeneration([firstSearch], firstSearch)).toEqual([firstSearch]);
    expect(enqueueRouteAiCommentGeneration([firstSearch], sameTargetLaterSearch)).toEqual([
      sameTargetLaterSearch,
    ]);
    expect(enqueueRouteAiCommentGeneration([firstSearch], otherTargetSearch)).toEqual([
      firstSearch,
      otherTargetSearch,
    ]);
  });

  it("coalesces by (trigger, targetRoutePayloadId) so duplicate trigger sources collapse but different targets remain independent", () => {
    const bootstrapSearch = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 10,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-1",
      ...snapshotProjection("search-1"),
      reactionGeneration: 0,
    } as const;
    const backgroundSearchSameTarget = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 11,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-1",
      ...snapshotProjection("search-1"),
      reactionGeneration: 0,
    } as const;
    const otherSearchTarget = {
      executionId: "exec-1",
      trigger: "user_search",
      createdAt: 12,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-2",
      ...snapshotProjection("search-2"),
      reactionGeneration: 0,
    } as const;

    expect(enqueueRouteAiCommentGeneration([bootstrapSearch], backgroundSearchSameTarget)).toEqual([
      backgroundSearchSameTarget,
    ]);

    expect(enqueueRouteAiCommentGeneration([bootstrapSearch], otherSearchTarget)).toEqual([
      bootstrapSearch,
      otherSearchTarget,
    ]);

    const citationOpened = {
      executionId: "exec-1",
      trigger: "citation_lineage_opened",
      createdAt: 20,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "citation-1",
      ...snapshotProjection("citation-1", "citation_lineage"),
      reactionGeneration: 0,
    } as const;
    const citationOpenedLater = {
      executionId: "exec-1",
      trigger: "citation_lineage_opened",
      createdAt: 21,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "citation-1",
      ...snapshotProjection("citation-1", "citation_lineage"),
      reactionGeneration: 0,
    } as const;
    expect(enqueueRouteAiCommentGeneration([citationOpened], citationOpenedLater)).toEqual([
      citationOpenedLater,
    ]);
  });

  it("coalesces targeted opened generation commands for the same relationship ResearchRoutePayload", () => {
    const bootstrapOpened = {
      executionId: "exec-1",
      trigger: "graph_neighbors_opened",
      createdAt: 40,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "graph-1",
      ...snapshotProjection("graph-1", "graph_neighbors"),
      reactionGeneration: 0,
    } as const;
    const handlerOpenedSameTarget = {
      executionId: "exec-1",
      trigger: "graph_neighbors_opened",
      createdAt: 41,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "graph-1",
      ...snapshotProjection("graph-1", "graph_neighbors"),
      reactionGeneration: 0,
    } as const;
    const otherGraphTarget = {
      executionId: "exec-1",
      trigger: "graph_neighbors_opened",
      createdAt: 42,
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "graph-2",
      ...snapshotProjection("graph-2", "graph_neighbors"),
      reactionGeneration: 0,
    } as const;

    expect(enqueueRouteAiCommentGeneration([bootstrapOpened], handlerOpenedSameTarget)).toEqual([
      handlerOpenedSameTarget,
    ]);
    expect(enqueueRouteAiCommentGeneration([bootstrapOpened], otherGraphTarget)).toEqual([
      bootstrapOpened,
      otherGraphTarget,
    ]);
  });

  it("drains the next command and handles empty queues", () => {
    const queued = [
      {
        executionId: "exec-1",
        trigger: "user_search",
        ownerPrincipalId: "principal-1",
        targetRoutePayloadId: "search-1",
        createdAt: 1,
        ...snapshotProjection("search-1"),
        reactionGeneration: 0,
      },
      {
        executionId: "exec-1",
        trigger: "graph_neighbors_opened",
        ownerPrincipalId: "principal-1",
        targetRoutePayloadId: "graph-1",
        createdAt: 2,
        ...snapshotProjection("graph-1", "graph_neighbors"),
        reactionGeneration: 0,
      },
    ] as const;

    expect(drainNextRouteAiCommentGeneration([])).toEqual({
      nextCommand: null,
      remaining: [],
    });
    expect(drainNextRouteAiCommentGeneration([...queued])).toEqual({
      nextCommand: queued[0],
      remaining: [queued[1]],
    });
  });
});
