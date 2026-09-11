import { z } from "zod";
import { t } from "@/app/i18n/message-access";

export const routeAiCommentPaperCardSchema = z.object({
  paperId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  headline: z.string().trim().min(1).max(40),
  insight: z.string().trim().min(1).max(140),
});

const routeAiCommentPaperCardsSurfaceSchema = z.object({
  kind: z.literal("paper_cards"),
  intent: z.literal("representative"),
  basis: z.enum(["search_metadata", "search_metadata_graph_support"]).optional(),
  cards: z.array(routeAiCommentPaperCardSchema).min(1).max(3),
});

export const routeAiCommentSurfaceSchema = routeAiCommentPaperCardsSurfaceSchema;

const persistedReactionSurfaceSchema = z.preprocess((value) => {
  if (value == null) return undefined;
  const parsed = routeAiCommentSurfaceSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}, routeAiCommentSurfaceSchema.optional());

const routeAiCommentBaseShape = {
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(30),
  body: z.string().trim().min(1).max(400),
  chips: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  timestamp: z.string().trim().min(1),
};

/** Public mutation input: invalid optional surfaces are rejected rather than compatibility-stripped. */
export const strictRouteAiCommentSchema = z.object({
  ...routeAiCommentBaseShape,
  surface: routeAiCommentSurfaceSchema.optional(),
});

/** Persisted compatibility input: legacy invalid optional surfaces are omitted during hydration. */
export const routeAiCommentSchema = z.object({
  ...routeAiCommentBaseShape,
  surface: persistedReactionSurfaceSchema,
});

export type RouteAiComment = z.infer<typeof routeAiCommentSchema>;
export type RouteAiCommentPaperCard = z.infer<typeof routeAiCommentPaperCardSchema>;
export type RouteAiCommentPaperCardsSurface = z.infer<typeof routeAiCommentPaperCardsSurfaceSchema>;
export type RouteAiCommentSurface = z.infer<typeof routeAiCommentSurfaceSchema>;

function hasSameRouteAiCommentSurface(
  left: RouteAiCommentSurface | undefined,
  right: RouteAiCommentSurface | undefined,
): boolean {
  if (!left || !right) return left === right;
  return (
    left.basis === right.basis &&
    left.cards.length === right.cards.length &&
    left.cards.every((card, index) => {
      const other = right.cards[index];
      return (
        card.paperId === other.paperId &&
        card.title === other.title &&
        card.headline === other.headline &&
        card.insight === other.insight
      );
    })
  );
}

/** Compares the immutable prepared-comment template while intentionally ignoring client time. */
export function hasSameRouteAiCommentSemantics(
  left: RouteAiComment,
  right: RouteAiComment,
): boolean {
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.body === right.body &&
    left.chips.length === right.chips.length &&
    left.chips.every((chip, index) => chip === right.chips[index]) &&
    hasSameRouteAiCommentSurface(left.surface, right.surface)
  );
}

const DEGRADED_REACTION_NOTICE = {
  title: t("surface.label.agent-panel.documentReactionFailedTitle"),
  body: t("surface.label.agent-panel.documentReactionFailedBody"),
} as const;

// Keep the old prefix as a read-filter for degraded rows written before
// route AI comment generation became the named runtime boundary.
const DEGRADED_REACTION_ID_PREFIXES = [
  "awareness-failed-",
  "route-ai-comment-failed-",
  "respond-fallback-",
  "respond-provider-failure-",
] as const;

export function isDegradedRouteAiCommentNotice(reaction: RouteAiComment): boolean {
  return (
    DEGRADED_REACTION_ID_PREFIXES.some((prefix) => reaction.id.startsWith(prefix)) ||
    (reaction.title === DEGRADED_REACTION_NOTICE.title &&
      reaction.body === DEGRADED_REACTION_NOTICE.body)
  );
}

export function isPersistableRouteAiComment(reaction: RouteAiComment): boolean {
  return !isDegradedRouteAiCommentNotice(reaction);
}

export function filterPersistableRouteAiComments(
  reactions: readonly RouteAiComment[],
): RouteAiComment[] {
  return reactions.filter(isPersistableRouteAiComment);
}

export const MAX_PERSISTED_ROUTE_AI_COMMENT_HISTORY = 100;
export const MAX_PERSISTED_ROUTE_AI_COMMENT_ID_LENGTH = 160;
export const MAX_PERSISTED_ROUTE_AI_COMMENT_CLOCK_SKEW_MS = 5 * 60_000;

export function isBoundedPersistedRouteAiComment(
  reaction: RouteAiComment,
  receivedAtMs = Date.now(),
): boolean {
  const timestampMs = Date.parse(reaction.timestamp);
  return (
    reaction.id.length <= MAX_PERSISTED_ROUTE_AI_COMMENT_ID_LENGTH &&
    Number.isFinite(timestampMs) &&
    timestampMs <= receivedAtMs + MAX_PERSISTED_ROUTE_AI_COMMENT_CLOCK_SKEW_MS
  );
}

export function normalizePersistedRouteAiCommentHistory(
  reactions: readonly RouteAiComment[],
  receivedAtMs = Date.now(),
): RouteAiComment[] {
  const latestById = new Map<string, RouteAiComment>();
  for (const reaction of filterPersistableRouteAiComments(reactions)) {
    if (!isBoundedPersistedRouteAiComment(reaction, receivedAtMs)) continue;
    latestById.delete(reaction.id);
    latestById.set(reaction.id, reaction);
  }
  return [...latestById.values()].slice(-MAX_PERSISTED_ROUTE_AI_COMMENT_HISTORY);
}

export function buildPersistableRouteAiCommentHistory(params: {
  reaction: RouteAiComment;
  reactionHistory?: readonly RouteAiComment[];
  receivedAtMs?: number;
}): RouteAiComment[] {
  return normalizePersistedRouteAiCommentHistory(
    [...(params.reactionHistory ?? []), params.reaction],
    params.receivedAtMs,
  );
}
