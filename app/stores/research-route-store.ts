// @promise promise:research-route-cap-feedback
// @promise promise:reaction-from-visible-snapshot
// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:search-query-route-transition
// @aspect aspect:search-first-url-model
// @check acceptance-check:research-route-cap-feedback-canonical-url
// @check acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible
// @check acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:search-query-route-transition-clears-stale-reaction
// @check acceptance-check:search-query-route-transition-url-owned

import { create } from "zustand";
import type {
  ResearchRoutePayload,
  ResearchRoutePayloadPatch,
} from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { buildEphemeralRouteAiCommentProjectionKey } from "@/app/lib/view-snapshot";
import {
  advanceReactionGeneration,
  getPersistedLatestReaction,
  getPersistedReactionHistory,
  reconcileActiveReactionHistory,
  syncActiveReactionCards,
} from "@/app/stores/research-route-store-internals";
import {
  createSearchVisibleWindowActions,
  type SearchVisibleWindow,
} from "@/app/stores/research-route-store-search-visible-window";

interface ResearchRouteState {
  currentView: ResearchRoutePayload | null;
  activeExecutionId: string | null;
  routeAiComment: RouteAiComment | null;
  reactionGeneration: number;
  pendingRouteAiCommentRegeneration: boolean;
  routeAiCommentGenerationStarted: boolean;
  reactionCardHistory: RouteAiComment[];
  searchVisibleWindow: SearchVisibleWindow | null;
  setSearchVisibleCount: (
    expectedExecutionId: string,
    resultKey: string,
    next: number | ((current: number) => number),
  ) => void;
  setCurrentView: (view: ResearchRoutePayload | null, executionId: string) => void;
  clearCurrentView: (expectedExecutionId: string) => void;
  patchCurrentView: (patch: ResearchRoutePayloadPatch, expectedExecutionId: string) => boolean;
  markRouteAiCommentGenerationPending: (docId: string, expectedExecutionId: string) => void;
  markRouteAiCommentGenerationStarted: (docId: string, expectedExecutionId: string) => void;
  requestRouteAiCommentRegeneration: (docId: string, expectedExecutionId: string) => void;
  clearRouteAiCommentRegeneration: (docId: string, expectedExecutionId: string) => void;
  setRouteAiComment: (
    docId: string,
    reaction: RouteAiComment | null,
    expectedExecutionId: string,
    expectedViewSnapshotProjectionKey?: string,
  ) => void;
}

function didEphemeralRouteAiCommentProjectionChange(
  currentView: ResearchRoutePayload,
  nextView: ResearchRoutePayload,
): boolean {
  const currentKey = buildEphemeralRouteAiCommentProjectionKey(currentView);
  const nextKey = buildEphemeralRouteAiCommentProjectionKey(nextView);
  return currentKey !== nextKey && (currentKey != null || nextKey != null);
}

function matchesActiveExecution(
  state: ResearchRouteState,
  docId: string,
  expectedExecutionId: string,
): boolean {
  return state.currentView?.id === docId && state.activeExecutionId === expectedExecutionId;
}

function isPatchAtLeastAsFresh(
  currentView: ResearchRoutePayload,
  patch: ResearchRoutePayloadPatch,
): boolean {
  if (!patch.updatedAt) return true;
  const currentUpdatedAt = Date.parse(currentView.updatedAt);
  const patchUpdatedAt = Date.parse(patch.updatedAt);
  if (!Number.isFinite(patchUpdatedAt)) return false;
  if (!Number.isFinite(currentUpdatedAt)) return true;
  return patchUpdatedAt >= currentUpdatedAt;
}

function mergeCurrentViewPatch(
  currentView: ResearchRoutePayload,
  patch: ResearchRoutePayloadPatch,
): ResearchRoutePayload | null {
  switch (patch.type) {
    case "search":
      return currentView.type === "search" ? { ...currentView, ...patch, type: "search" } : null;
    case "citation_lineage":
      return currentView.type === "citation_lineage"
        ? { ...currentView, ...patch, type: "citation_lineage" }
        : null;
    case "graph_neighbors":
      return currentView.type === "graph_neighbors"
        ? { ...currentView, ...patch, type: "graph_neighbors" }
        : null;
    case "gap_network":
      return currentView.type === "gap_network"
        ? { ...currentView, ...patch, type: "gap_network" }
        : null;
  }
}

function emptyActiveSessionState() {
  return {
    routeAiComment: null,
    reactionGeneration: 0,
    pendingRouteAiCommentRegeneration: false,
    routeAiCommentGenerationStarted: false,
    reactionCardHistory: [] as RouteAiComment[],
    searchVisibleWindow: null,
  };
}

export const useResearchRouteStore = create<ResearchRouteState>((set, get) => ({
  currentView: null,
  activeExecutionId: null,
  ...emptyActiveSessionState(),
  ...createSearchVisibleWindowActions(set),

  setCurrentView: (view, executionId) => {
    if (!view) {
      set({
        currentView: null,
        activeExecutionId: executionId,
        ...emptyActiveSessionState(),
      });
      return;
    }
    const state = get();
    const startsNewExecution = state.activeExecutionId !== executionId;
    if (
      !startsNewExecution &&
      state.currentView?.id === view.id &&
      !isPatchAtLeastAsFresh(state.currentView, view)
    ) {
      return;
    }
    if (startsNewExecution) {
      set({
        currentView: view,
        activeExecutionId: executionId,
        ...emptyActiveSessionState(),
        routeAiComment: getPersistedLatestReaction(view),
        reactionCardHistory: getPersistedReactionHistory(view),
      });
      return;
    }
    if (state.currentView && didEphemeralRouteAiCommentProjectionChange(state.currentView, view)) {
      set({
        currentView: view,
        routeAiComment: null,
        reactionGeneration: state.reactionGeneration + 1,
        pendingRouteAiCommentRegeneration: false,
        routeAiCommentGenerationStarted: false,
        reactionCardHistory: [],
      });
      return;
    }
    const routeAiComment = state.routeAiComment ?? getPersistedLatestReaction(view);
    set({
      currentView: view,
      routeAiComment,
      reactionCardHistory: reconcileActiveReactionHistory({
        view,
        currentReaction: routeAiComment,
        previousHistory: state.reactionCardHistory,
      }),
    });
  },

  clearCurrentView: (expectedExecutionId) => {
    if (get().activeExecutionId !== expectedExecutionId) return;
    set({
      currentView: null,
      activeExecutionId: null,
      ...emptyActiveSessionState(),
    });
  },

  patchCurrentView: (patch, expectedExecutionId) => {
    const state = get();
    const currentView = state.currentView;
    if (!currentView || currentView.id !== patch.id) return false;
    if (state.activeExecutionId !== expectedExecutionId) return false;
    if (patch.type !== currentView.type) return false;
    if (currentView.type === "gap_network" && "ownerPrincipalId" in patch) return false;
    if (currentView.type !== "gap_network" && "viewerPrincipalId" in patch) return false;
    if (!isPatchAtLeastAsFresh(currentView, patch)) return false;
    const nextView = mergeCurrentViewPatch(currentView, patch);
    if (!nextView) return false;
    if (didEphemeralRouteAiCommentProjectionChange(currentView, nextView)) {
      set({
        currentView: nextView,
        routeAiComment: null,
        reactionGeneration: state.reactionGeneration + 1,
        pendingRouteAiCommentRegeneration: false,
        routeAiCommentGenerationStarted: false,
        reactionCardHistory: [],
      });
      return true;
    }
    set({
      currentView: nextView,
      reactionCardHistory: reconcileActiveReactionHistory({
        view: nextView,
        currentReaction: state.routeAiComment,
        previousHistory: state.reactionCardHistory,
      }),
    });
    return true;
  },

  markRouteAiCommentGenerationPending: (docId, expectedExecutionId) => {
    const state = get();
    if (!matchesActiveExecution(state, docId, expectedExecutionId)) return;
    if (state.pendingRouteAiCommentRegeneration) return;
    set({ pendingRouteAiCommentRegeneration: true });
  },

  markRouteAiCommentGenerationStarted: (docId, expectedExecutionId) => {
    const state = get();
    if (!matchesActiveExecution(state, docId, expectedExecutionId)) return;
    set({
      pendingRouteAiCommentRegeneration: true,
      routeAiCommentGenerationStarted: true,
    });
  },

  requestRouteAiCommentRegeneration: (docId, expectedExecutionId) => {
    const state = get();
    if (!matchesActiveExecution(state, docId, expectedExecutionId)) return;
    set({
      reactionGeneration: state.reactionGeneration + 1,
      pendingRouteAiCommentRegeneration: true,
      routeAiCommentGenerationStarted: false,
    });
  },

  clearRouteAiCommentRegeneration: (docId, expectedExecutionId) => {
    const state = get();
    if (!matchesActiveExecution(state, docId, expectedExecutionId)) return;
    set({
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
    });
  },

  setRouteAiComment: (docId, reaction, expectedExecutionId, expectedViewSnapshotProjectionKey) => {
    const state = get();
    if (!matchesActiveExecution(state, docId, expectedExecutionId)) return;
    if (
      expectedViewSnapshotProjectionKey != null &&
      buildEphemeralRouteAiCommentProjectionKey(state.currentView) !==
        expectedViewSnapshotProjectionKey
    ) {
      return;
    }
    const cards = syncActiveReactionCards({
      history: state.reactionCardHistory,
      reaction,
    });
    set({
      routeAiComment: reaction,
      reactionGeneration: advanceReactionGeneration(state.reactionGeneration, reaction == null),
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
      reactionCardHistory: cards,
    });
  },
}));
