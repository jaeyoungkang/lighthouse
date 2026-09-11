// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:reaction-from-visible-snapshot
// @check acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view
// @check acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
// @check acceptance-check:reaction-from-visible-snapshot-basis-match

import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";

export function getPersistedReactionHistory(view: ResearchRoutePayload): RouteAiComment[] {
  const history = view.reactionHistory ?? [];
  if (history.length > 0) return history;
  return view.reaction ? [view.reaction] : [];
}

export function getPersistedLatestReaction(view: ResearchRoutePayload): RouteAiComment | null {
  return getPersistedReactionHistory(view).at(-1) ?? null;
}

export function advanceReactionGeneration(current: number, shouldAdvance: boolean): number {
  return shouldAdvance ? current + 1 : current;
}

export function advanceUpdatedAtAfterCurrent(
  currentUpdatedAt: string,
  proposedUpdatedAt: string,
): string {
  const currentMs = Date.parse(currentUpdatedAt);
  const proposedMs = Date.parse(proposedUpdatedAt);
  if (!Number.isFinite(currentMs)) {
    return Number.isFinite(proposedMs) ? proposedUpdatedAt : new Date().toISOString();
  }
  if (Number.isFinite(proposedMs) && proposedMs > currentMs) return proposedUpdatedAt;
  return new Date(currentMs + 1).toISOString();
}

export function reconcileActiveReactionHistory(params: {
  view: ResearchRoutePayload;
  currentReaction: RouteAiComment | null;
  previousHistory: RouteAiComment[];
}): RouteAiComment[] {
  const persistedHistory = getPersistedReactionHistory(params.view);
  if (params.currentReaction == null) {
    return params.previousHistory.length > 0 ? params.previousHistory : persistedHistory;
  }
  if (params.previousHistory.length === 0) {
    return persistedHistory.at(-1)?.id === params.currentReaction.id
      ? persistedHistory
      : [params.currentReaction];
  }
  const latest = params.previousHistory.at(-1);
  return latest?.id === params.currentReaction.id
    ? [...params.previousHistory.slice(0, -1), params.currentReaction]
    : params.previousHistory;
}

export function syncActiveReactionCards(params: {
  history: RouteAiComment[];
  reaction: RouteAiComment | null;
}): RouteAiComment[] {
  if (params.reaction == null) {
    return [];
  }
  const latest = params.history.at(-1);
  return params.history.length > 0 && latest?.id === params.reaction.id
    ? [...params.history.slice(0, -1), params.reaction]
    : [params.reaction];
}
