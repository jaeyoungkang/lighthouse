import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listMyReviewedPapers,
  markMyReviewedPaper,
  unmarkMyReviewedPaper,
} from "@/app/server/domain-access/reviewed-paper-access";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { t } from "@/app/i18n/message-access";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 15;

const reviewedPaperAuthorSchema = z
  .object({
    name: z.string().trim().min(1).max(500),
  })
  .strict();

const reviewedPaperSchema = z
  .object({
    paperId: z.string().trim().min(1).max(256),
    title: z.string().max(2000).default(""),
    url: z.string().max(4096).optional(),
    authors: z.array(reviewedPaperAuthorSchema).max(100).optional(),
    year: z.number().int().nullable().optional(),
    citationCount: z.number().int().nonnegative().optional(),
  })
  .strict();

const reviewedPaperDeleteSchema = z
  .object({
    paperId: z.string().trim().min(1).max(256),
  })
  .strict();

/** GET /api/papers/reviewed — 검토한 논문 전체 목록 */
export const GET = withRouteGuard(async () => {
  const auth = await requireOwnerPrincipalAuth();
  const papers = await listMyReviewedPapers(auth);
  return NextResponse.json(papers);
});

/** POST /api/papers/reviewed — 검토 완료 마킹 */
export const POST = withRouteGuard(async (req: Request) => {
  const auth = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/papers/reviewed/route.ts"));
  if (!body.ok) return body.response;
  const parsed = reviewedPaperSchema.safeParse(body.body);

  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "REVIEWED_PAPER_INVALID",
      message: t("common.label.route.4"),
    });
  }

  await markMyReviewedPaper(parsed.data, auth);
  return NextResponse.json({ ok: true });
});

/** DELETE /api/papers/reviewed — 검토 해제 */
export const DELETE = withRouteGuard(async (req: Request) => {
  const auth = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(req, getRouteBodyLimit("app/api/papers/reviewed/route.ts"));
  if (!body.ok) return body.response;
  const parsed = reviewedPaperDeleteSchema.safeParse(body.body);

  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "REVIEWED_PAPER_DELETE_INVALID",
      message: t("common.label.route.4"),
    });
  }

  await unmarkMyReviewedPaper(parsed.data.paperId, auth);
  return NextResponse.json({ ok: true });
});
