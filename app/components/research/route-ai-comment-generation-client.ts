// @promise promise:reaction-from-visible-snapshot
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input

import { z } from "zod";
import { routeAiCommentSchema, type RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  viewSnapshotRouteKindSchema,
  viewSnapshotSchema,
  type ViewSnapshot,
} from "@/app/domain/view-snapshot";
import type { RouteAiCommentGenerationTrigger } from "@/app/domain/route-ai-comment-generation-trigger";
import { routeAiCommentGenerateRoute } from "@/app/lib/api-routes";
import { fetchWithSilenceTimeout } from "@/app/lib/fetch-with-silence-timeout";

const routeAiCommentGenerationResponseSchema = z.object({
  snapshotId: z.string(),
  snapshotKind: viewSnapshotRouteKindSchema,
  reaction: routeAiCommentSchema.nullable(),
});

const RESEARCH_ROUTE_REACTION_GENERATION_REQUEST_TIMEOUT_MS = 15_000;

export async function requestRouteAiCommentGeneration(params: {
  documentId: string;
  trigger: RouteAiCommentGenerationTrigger;
  reactionGeneration: number;
  createdAt: number;
  viewSnapshot: ViewSnapshot;
  signal?: AbortSignal;
}): Promise<{
  snapshotId: string;
  snapshotKind: ViewSnapshot["snapshotKind"];
  reaction: RouteAiComment | null;
}> {
  const parsedViewSnapshot = viewSnapshotSchema.parse(params.viewSnapshot);
  const response = await fetchWithSilenceTimeout(
    routeAiCommentGenerateRoute(encodeURIComponent(params.documentId)),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: params.signal,
      body: JSON.stringify({
        trigger: params.trigger,
        reactionGeneration: params.reactionGeneration,
        createdAt: params.createdAt,
        viewSnapshot: parsedViewSnapshot,
      }),
    },
    {
      deadlineMs: RESEARCH_ROUTE_REACTION_GENERATION_REQUEST_TIMEOUT_MS,
      discardBodyOnNonOk: true,
      timeoutMs: RESEARCH_ROUTE_REACTION_GENERATION_REQUEST_TIMEOUT_MS,
      timeoutMessage: "route AI comment generation stalled",
      timeoutErrorName: "TimeoutError",
    },
  );

  if (!response.ok) {
    throw new Error(`route AI comment generation failed: ${String(response.status)}`);
  }

  const raw: unknown = await response.json().catch((): unknown => null);
  const parsed = routeAiCommentGenerationResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid route AI comment generation response");
  }

  return parsed.data;
}
