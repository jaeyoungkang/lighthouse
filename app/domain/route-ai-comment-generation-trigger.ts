export const ROUTE_AI_COMMENT_GENERATION_TRIGGERS = [
  "route_bootstrap",
  "user_search",
  "citation_lineage_opened",
  "graph_neighbors_opened",
] as const;

export type RouteAiCommentGenerationTrigger = (typeof ROUTE_AI_COMMENT_GENERATION_TRIGGERS)[number];

const ROUTE_AI_COMMENT_GENERATION_TRIGGER_SET: ReadonlySet<string> = new Set(
  ROUTE_AI_COMMENT_GENERATION_TRIGGERS,
);

export function isRouteAiCommentGenerationTrigger(
  value: string,
): value is RouteAiCommentGenerationTrigger {
  return ROUTE_AI_COMMENT_GENERATION_TRIGGER_SET.has(value);
}
