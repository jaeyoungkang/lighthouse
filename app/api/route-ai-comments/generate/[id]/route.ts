// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:reaction-from-visible-snapshot
// @aspect aspect:provider-failure-degraded-mode
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:reaction-from-visible-snapshot-ephemeral-lifetime

import { NextResponse } from "next/server";
import { z } from "zod";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  ROUTE_AI_COMMENT_GENERATION_TRIGGERS,
  type RouteAiCommentGenerationTrigger,
} from "@/app/domain/route-ai-comment-generation-trigger";
import {
  buildViewSnapshotProjectionKey,
  viewSnapshotSchema,
  type ViewSnapshot,
} from "@/app/domain/view-snapshot";
import { generateRouteAiComment } from "@/app/server/agent/route-ai-comment-generation";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import type { RepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";

export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

type RouteAiCommentGenerationRouteTimingPhase = "parse" | "route-auth" | "generate" | "total";

interface RouteAiCommentGenerationTimingEntry {
  phase: RouteAiCommentGenerationRouteTimingPhase;
  durationMs: number;
}

interface RouteAiCommentGenerationRouteTiming {
  totalStartedAt: number;
  timings: RouteAiCommentGenerationTimingEntry[];
}

interface RouteAiCommentGenerationRouteContext extends RouteContext {
  routeTiming: RouteAiCommentGenerationRouteTiming;
}

const routeAiCommentGenerationRequestSchema = z
  .object({
    trigger: z.enum(ROUTE_AI_COMMENT_GENERATION_TRIGGERS).optional(),
    reactionGeneration: z.number().int().min(0),
    createdAt: z.number().int().min(0).optional(),
    viewSnapshot: viewSnapshotSchema,
  })
  .strict();

type GenerationResult = {
  snapshotId: string;
  snapshotKind: ViewSnapshot["snapshotKind"];
  reaction: RouteAiComment | null;
};

export type RouteAiCommentGenerationResponse = GenerationResult;

interface InFlightGenerationEntry {
  controller: AbortController;
  activeCallers: number;
  promise: Promise<GenerationResult>;
}

const inFlightGenerationEntries = new Map<string, InFlightGenerationEntry>();

function normalizeServerTimingDuration(durationMs: number): string {
  return Math.max(durationMs, 0).toFixed(1);
}

function formatServerTiming(entries: readonly RouteAiCommentGenerationTimingEntry[]): string {
  return entries
    .map((entry) => `${entry.phase};dur=${normalizeServerTimingDuration(entry.durationMs)}`)
    .join(", ");
}

async function measureRoutePhase<T>(
  timings: RouteAiCommentGenerationTimingEntry[],
  phase: RouteAiCommentGenerationRouteTimingPhase,
  operation: () => T | Promise<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    timings.push({ phase, durationMs: performance.now() - startedAt });
  }
}

function createRouteAiCommentGenerationRouteTiming(): RouteAiCommentGenerationRouteTiming {
  return { totalStartedAt: performance.now(), timings: [] };
}

function ensureTotalTiming(context: RouteAiCommentGenerationRouteTiming): void {
  if (context.timings.some((entry) => entry.phase === "total")) return;
  context.timings.push({
    phase: "total",
    durationMs: performance.now() - context.totalStartedAt,
  });
}

function attachRouteAiCommentGenerationServerTiming<T extends Response | NextResponse>(
  response: T,
  context: RouteAiCommentGenerationRouteTiming,
): T {
  ensureTotalTiming(context);
  response.headers.set("Server-Timing", formatServerTiming(context.timings));
  return response;
}

function attachGenerationCallerSignal(
  entry: InFlightGenerationEntry,
  signal: AbortSignal,
): () => void {
  entry.activeCallers += 1;

  let detached = false;
  const detach = () => {
    if (detached) return;
    detached = true;
    signal.removeEventListener("abort", handleAbort);
    entry.activeCallers = Math.max(0, entry.activeCallers - 1);
  };

  const handleAbort = () => {
    detach();
    if (entry.activeCallers === 0) {
      entry.controller.abort(signal.reason);
    }
  };

  if (signal.aborted) {
    handleAbort();
  } else {
    signal.addEventListener("abort", handleAbort, { once: true });
  }

  return detach;
}

function supportsViewSnapshotReactionGeneration(viewSnapshot: ViewSnapshot): boolean {
  if (viewSnapshot.snapshotKind === "search") {
    return viewSnapshot.content.query.trim().length > 0 && viewSnapshot.content.results.length > 0;
  }

  return (
    viewSnapshot.snapshotKind === "citation_lineage" ||
    viewSnapshot.snapshotKind === "graph_neighbors"
  );
}

function buildEmptyGenerationResult(viewSnapshot: ViewSnapshot): GenerationResult {
  return {
    snapshotId: viewSnapshot.snapshotId,
    snapshotKind: viewSnapshot.snapshotKind,
    reaction: null,
  };
}

async function generateEphemeralRouteAiComment(params: {
  db: RepositoryDbHandle;
  ownerPrincipalId: string;
  viewSnapshot: ViewSnapshot;
  trigger?: RouteAiCommentGenerationTrigger;
  signal?: AbortSignal;
}): Promise<GenerationResult> {
  const generatedReaction = await generateRouteAiComment({
    db: params.db,
    userId: params.ownerPrincipalId,
    ownerPrincipalId: params.ownerPrincipalId,
    viewSnapshot: params.viewSnapshot,
    trigger: params.trigger,
    signal: params.signal,
  });

  if (params.signal?.aborted || !generatedReaction) {
    return buildEmptyGenerationResult(params.viewSnapshot);
  }

  return {
    snapshotId: params.viewSnapshot.snapshotId,
    snapshotKind: params.viewSnapshot.snapshotKind,
    reaction: generatedReaction,
  };
}

const guardedPOST = withRouteGuard(
  async (req: Request, ctx: RouteAiCommentGenerationRouteContext) => {
    const timings = ctx.routeTiming.timings;
    const { id } = await ctx.params;
    const { db, user } = await measureRoutePhase(timings, "route-auth", () =>
      requireOwnerPrincipalAuth(),
    );
    const body = await measureRoutePhase(timings, "parse", () =>
      readRouteJsonBody(req, getRouteBodyLimit("app/api/route-ai-comments/generate/[id]/route.ts")),
    );
    if (!body.ok) return body.response;
    const parsed = routeAiCommentGenerationRequestSchema.safeParse(body.body);

    if (!parsed.success) {
      return apiErrorResponse({
        status: 400,
        code: "ROUTE_AI_COMMENT_GENERATION_INVALID",
        message: "invalid route AI comment generation payload",
      });
    }

    if (parsed.data.viewSnapshot.snapshotId !== id) {
      return apiErrorResponse({
        status: 400,
        code: "ROUTE_AI_COMMENT_TARGET_MISMATCH",
        message: "view snapshot target mismatch",
      });
    }

    const viewSnapshot = parsed.data.viewSnapshot;

    if (!supportsViewSnapshotReactionGeneration(viewSnapshot)) {
      return apiErrorResponse({
        status: 422,
        code: "ROUTE_AI_COMMENT_UNSUPPORTED",
        message: "route AI comment generation unsupported",
      });
    }

    const key = [
      user.id,
      id,
      parsed.data.trigger ?? "route_bootstrap",
      parsed.data.reactionGeneration,
      buildViewSnapshotProjectionKey(viewSnapshot),
    ].join(":");
    const existing = inFlightGenerationEntries.get(key);
    if (existing) {
      const detachCallerSignal = attachGenerationCallerSignal(existing, req.signal);
      try {
        const result = await measureRoutePhase(timings, "generate", () => existing.promise);
        return NextResponse.json(result);
      } finally {
        detachCallerSignal();
      }
    }

    const entry: InFlightGenerationEntry = {
      controller: new AbortController(),
      activeCallers: 0,
      promise: new Promise<GenerationResult>(() => {
        // Replaced immediately before the entry is exposed in the in-flight map.
      }),
    };
    const detachCallerSignal = attachGenerationCallerSignal(entry, req.signal);
    const generation = generateEphemeralRouteAiComment({
      db,
      ownerPrincipalId: user.id,
      viewSnapshot,
      trigger: parsed.data.trigger,
      signal: entry.controller.signal,
    }).finally(() => {
      inFlightGenerationEntries.delete(key);
    });
    entry.promise = generation;
    inFlightGenerationEntries.set(key, entry);

    try {
      const result = await measureRoutePhase(timings, "generate", () => generation);
      return NextResponse.json(result);
    } finally {
      detachCallerSignal();
    }
  },
);

export async function POST(req: Request, ctx: RouteContext): Promise<Response | NextResponse> {
  const routeTiming = createRouteAiCommentGenerationRouteTiming();
  const response = await guardedPOST(req, { ...ctx, routeTiming });
  return attachRouteAiCommentGenerationServerTiming(response, routeTiming);
}
