// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:reaction-from-visible-snapshot
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match

import { buildViewSnapshotProjectionKey, type ViewSnapshot } from "@/app/domain/view-snapshot";
import type { RouteAiCommentGenerationTrigger } from "@/app/domain/route-ai-comment-generation-trigger";

export {
  ROUTE_AI_COMMENT_GENERATION_TRIGGERS,
  isRouteAiCommentGenerationTrigger,
  type RouteAiCommentGenerationTrigger,
} from "@/app/domain/route-ai-comment-generation-trigger";

export interface QueuedRouteAiCommentGeneration {
  executionId: string;
  trigger: RouteAiCommentGenerationTrigger;
  createdAt: number;
  ownerPrincipalId: string;
  targetRoutePayloadId: string;
  viewSnapshot: ViewSnapshot;
  /** Reaction generation of the target document at enqueue time. */
  reactionGeneration: number;
}

export const ROUTE_AI_COMMENT_GENERATION_COALESCE_WINDOW_MS = 240;

function isSameCommand(
  a: QueuedRouteAiCommentGeneration,
  b: QueuedRouteAiCommentGeneration,
): boolean {
  return (
    a.trigger === b.trigger &&
    a.executionId === b.executionId &&
    a.targetRoutePayloadId === b.targetRoutePayloadId &&
    buildViewSnapshotProjectionKey(a.viewSnapshot) ===
      buildViewSnapshotProjectionKey(b.viewSnapshot) &&
    a.createdAt === b.createdAt &&
    a.reactionGeneration === b.reactionGeneration
  );
}

function sameTriggerSource(
  a: QueuedRouteAiCommentGeneration,
  b: QueuedRouteAiCommentGeneration,
): boolean {
  return a.trigger === b.trigger && a.targetRoutePayloadId === b.targetRoutePayloadId;
}

export function enqueueRouteAiCommentGeneration(
  queue: QueuedRouteAiCommentGeneration[],
  nextCommand: QueuedRouteAiCommentGeneration,
): QueuedRouteAiCommentGeneration[] {
  if (queue.some((command) => isSameCommand(command, nextCommand))) {
    return queue;
  }

  return [...queue.filter((command) => !sameTriggerSource(command, nextCommand)), nextCommand];
}

export function drainNextRouteAiCommentGeneration(queue: QueuedRouteAiCommentGeneration[]): {
  nextCommand: QueuedRouteAiCommentGeneration | null;
  remaining: QueuedRouteAiCommentGeneration[];
} {
  if (queue.length === 0) {
    return { nextCommand: null, remaining: [] };
  }

  const [nextCommand, ...remaining] = queue;
  return { nextCommand, remaining };
}
