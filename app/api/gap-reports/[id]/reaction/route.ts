import { NextResponse } from "next/server";
import {
  buildPersistableRouteAiCommentHistory,
  isBoundedPersistedRouteAiComment,
  hasSameRouteAiCommentSemantics,
  MAX_PERSISTED_ROUTE_AI_COMMENT_ID_LENGTH,
  strictRouteAiCommentSchema,
  isPersistableRouteAiComment,
} from "@/app/domain/route-ai-comment";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  getGapNetworkView,
  updateGapNetworkReactionPreference,
} from "@/app/server/domain-access/gap-report-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "@/app/server/lib/bounded-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { z } from "zod";

export const maxDuration = 15;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const GAP_REACTION_WRITE_MAX_ATTEMPTS = 4;
const gapReportIdSchema = z.uuid();

const persistReactionSchema = z
  .object({
    reaction: strictRouteAiCommentSchema.extend({
      id: z.string().trim().min(1).max(MAX_PERSISTED_ROUTE_AI_COMMENT_ID_LENGTH),
      timestamp: z.iso.datetime({ offset: true }),
    }),
    baseReactionVersion: z.number().int().nonnegative(),
  })
  .strict();

const deleteReactionSchema = z
  .object({
    baseReactionVersion: z.number().int().nonnegative(),
  })
  .strict();

async function getValidatedGapReportId(ctx: RouteContext): Promise<string | null> {
  const parsedId = gapReportIdSchema.safeParse((await ctx.params).id);
  return parsedId.success ? parsedId.data : null;
}

function invalidGapReportIdResponse() {
  return apiErrorResponse({
    status: 400,
    code: "GAP_REACTION_REPORT_ID_INVALID",
    message: "invalid gap report id",
  });
}

async function readReactionWriteBody(
  req: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return {
      ok: true,
      body: await readBoundedJsonBody(
        req,
        getRouteBodyLimit("app/api/gap-reports/[id]/reaction/route.ts"),
      ),
    };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        ok: false,
        response: apiErrorResponse({
          status: 413,
          code: "GAP_REACTION_REQUEST_TOO_LARGE",
          message: "gap reaction request body is too large",
        }),
      };
    }
    throw error;
  }
}

function isCurrentPreparedGapReaction(
  document: Awaited<ReturnType<typeof getGapNetworkView>>,
  reaction: RouteAiComment,
): boolean {
  if (document.type !== "gap_network") return false;
  const preparation = document.metadata.reactionPreparation;
  if (!preparation) return false;
  return [
    preparation.overviewReaction,
    ...preparation.clusterReactions.map((entry) => entry.reaction),
    ...preparation.gapReactions.map((entry) => entry.reaction),
  ].some((prepared) => hasSameRouteAiCommentSemantics(prepared, reaction));
}

/** GET /api/gap-reports/:id/reaction — ambiguous write 뒤 서버 확정 상태 조회 */
export const GET = withRouteGuard(async (_req: Request, ctx: RouteContext) => {
  const id = await getValidatedGapReportId(ctx);
  if (!id) return invalidGapReportIdResponse();
  return NextResponse.json(await getGapNetworkView(id));
});

/** PUT /api/gap-reports/:id/reaction — 성공 AI comment 저장 */
export const PUT = withRouteGuard(async (req: Request, ctx: RouteContext) => {
  const id = await getValidatedGapReportId(ctx);
  if (!id) return invalidGapReportIdResponse();
  await requireOwnerPrincipalAuth();
  const bodyResult = await readReactionWriteBody(req);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = persistReactionSchema.safeParse(bodyResult.body);

  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_REACTION_PAYLOAD_INVALID",
      message: "invalid route AI comment payload",
    });
  }

  if (!isPersistableRouteAiComment(parsed.data.reaction)) {
    return apiErrorResponse({
      status: 422,
      code: "GAP_REACTION_DEGRADED_NOTICE_REJECTED",
      message: "degraded AI comment notices are not persisted",
    });
  }

  const receivedAtMs = Date.now();
  if (!isBoundedPersistedRouteAiComment(parsed.data.reaction, receivedAtMs)) {
    return apiErrorResponse({
      status: 422,
      code: "GAP_REACTION_TIMESTAMP_REJECTED",
      message: "route AI comment timestamp exceeds the allowed client clock skew",
    });
  }

  let doc: Awaited<ReturnType<typeof getGapNetworkView>> | null = null;
  for (let attempt = 0; attempt < GAP_REACTION_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const existing = await getGapNetworkView(id);
    if (parsed.data.baseReactionVersion < existing.reactionVersion) {
      // A stale execution or an idempotent retry must observe the already
      // confirmed server value instead of replacing it with a late request.
      doc = existing;
      break;
    }
    if (parsed.data.baseReactionVersion > existing.reactionVersion) {
      return apiErrorResponse({
        status: 409,
        code: "GAP_REACTION_VERSION_CONFLICT",
        message: "gap reaction version mismatch",
        metadata: { currentReactionVersion: existing.reactionVersion },
      });
    }
    if (!isCurrentPreparedGapReaction(existing, parsed.data.reaction)) {
      return apiErrorResponse({
        status: 422,
        code: "GAP_REACTION_NOT_PREPARED",
        message: "reaction does not match a prepared gap reaction",
      });
    }

    const reactionHistory = buildPersistableRouteAiCommentHistory({
      reaction: parsed.data.reaction,
      receivedAtMs,
      reactionHistory: [
        ...(existing.reactionHistory ?? []),
        ...(existing.reaction ? [existing.reaction] : []),
      ],
    });
    doc = await updateGapNetworkReactionPreference(id, existing.version, existing.reactionVersion, {
      reaction: parsed.data.reaction,
      reactionHistory,
    });
    if (doc) break;
  }
  if (!doc) {
    return apiErrorResponse({
      status: 409,
      code: "GAP_REACTION_WRITE_CONFLICT",
      message: "gap reaction write conflict",
    });
  }
  return NextResponse.json(doc);
});

/** DELETE /api/gap-reports/:id/reaction — 저장된 AI comment 제거 */
export const DELETE = withRouteGuard(async (req: Request, ctx: RouteContext) => {
  const id = await getValidatedGapReportId(ctx);
  if (!id) return invalidGapReportIdResponse();
  await requireOwnerPrincipalAuth();
  const bodyResult = await readReactionWriteBody(req);
  if (!bodyResult.ok) return bodyResult.response;
  const parsed = deleteReactionSchema.safeParse(bodyResult.body);
  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_REACTION_DELETE_INVALID",
      message: "invalid gap reaction delete payload",
    });
  }

  let doc: Awaited<ReturnType<typeof getGapNetworkView>> | null = null;
  for (let attempt = 0; attempt < GAP_REACTION_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const existing = await getGapNetworkView(id);
    if (parsed.data.baseReactionVersion < existing.reactionVersion) {
      doc = existing;
      break;
    }
    if (parsed.data.baseReactionVersion > existing.reactionVersion) {
      return apiErrorResponse({
        status: 409,
        code: "GAP_REACTION_VERSION_CONFLICT",
        message: "gap reaction version mismatch",
        metadata: { currentReactionVersion: existing.reactionVersion },
      });
    }
    doc = await updateGapNetworkReactionPreference(id, existing.version, existing.reactionVersion, {
      reaction: null,
      reactionHistory: [],
    });
    if (doc) break;
  }
  if (!doc) {
    return apiErrorResponse({
      status: 409,
      code: "GAP_REACTION_WRITE_CONFLICT",
      message: "gap reaction write conflict",
    });
  }
  return NextResponse.json(doc);
});
