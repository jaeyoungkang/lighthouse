import { NextResponse } from "next/server";
import { z } from "zod";
import {
  INLINE_ANALYSIS_REQUEST_PAPER_LIMIT,
  INLINE_ANALYSIS_RETRY_COMMANDS,
  INLINE_ANALYSIS_ROUTE_DEADLINE_MS,
} from "@/app/domain/analysis";
import { t } from "@/app/i18n/message-access";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { PaperInputSchema } from "@/app/server/services/inline-analysis-service";
import { resolveInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readBoundedJsonBody, RequestBodyTooLargeError } from "@/app/server/lib/bounded-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 60;

const BoundedPaperInputSchema = PaperInputSchema.pick({
  paperId: true,
  title: true,
  abstract: true,
  year: true,
}).extend({
  paperId: z.string().min(1).max(512),
  title: z.string().max(4_000),
  abstract: z.string().max(80_000).nullable(),
  year: z.number().int().min(0).max(3_000).nullable().optional(),
});
const InlineAnalysisSchema = z.object({
  papers: z.array(BoundedPaperInputSchema).max(INLINE_ANALYSIS_REQUEST_PAPER_LIMIT),
  retryCommand: z.enum(INLINE_ANALYSIS_RETRY_COMMANDS).default("automatic"),
});

/** POST /api/papers/analyze-inline — 초록 기반 인라인 분석 (문서 생성 없음) */
export const POST = withRouteGuard(async (req: Request) => {
  const deadlineAt = Date.now() + INLINE_ANALYSIS_ROUTE_DEADLINE_MS;
  // Authenticate before consuming attacker-controlled request bytes. The
  // domain-access recheck is request-cached and preserves its own authority gate.
  await requireOwnerPrincipalAuth();
  let body: unknown;
  try {
    body = await readBoundedJsonBody(
      req,
      getRouteBodyLimit("app/api/papers/analyze-inline/route.ts"),
    );
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return apiErrorResponse({
      status: 413,
      code: "INLINE_ANALYSIS_REQUEST_TOO_LARGE",
      message: t("common.error.request-body-too-large"),
    });
  }
  const parsed = InlineAnalysisSchema.safeParse(body);
  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "INLINE_ANALYSIS_INVALID",
      message: "invalid inline analysis payload",
    });
  }

  const results = await resolveInlineAnalysis({
    papers: parsed.data.papers,
    retryCommand: parsed.data.retryCommand,
    deadlineAt,
    signal: req.signal,
  });
  return NextResponse.json(results, { status: 200 });
});
