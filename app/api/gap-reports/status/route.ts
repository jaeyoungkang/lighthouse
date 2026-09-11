// @promise promise:gap-network-detection-from-search
// @promise promise:research-route-cap-feedback
// @promise promise:shared-gap-report-member-access
// @aspect aspect:search-first-url-model
// @check acceptance-check:gap-network-detection-from-search-result-saved-gap-view
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set
// @check acceptance-check:shared-gap-report-member-access-authenticated-sharing

import { NextResponse } from "next/server";
import { z } from "zod";
import { buildGapNetworkPendingProgressView } from "@/app/components/research-route-renderers/gap-network-view.helpers";
import { findGapNetworkView } from "@/app/server/domain-access/gap-report-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { t } from "@/app/i18n/message-access";
import {
  isGapNetworkBuildFailed,
  isGapNetworkViewReadyForDisplay,
} from "@/app/lib/gap-network-view-core";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 60;

const gapNetworkStatusRequestSchema = z.object({
  gapReportId: z.uuid(),
  startedAt: z.iso.datetime().optional(),
});

export const GET = withRouteGuard(async (req: Request) => {
  const url = new URL(req.url);
  const parsed = gapNetworkStatusRequestSchema.safeParse({
    gapReportId: url.searchParams.get("gapReportId"),
    startedAt: url.searchParams.get("startedAt") ?? undefined,
  });

  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_REPORT_STATUS_QUERY_INVALID",
      message: t("common.label.route.source-snapshot-required"),
    });
  }

  const gapNetworkDocument = await findGapNetworkView(parsed.data.gapReportId);

  if (!gapNetworkDocument) {
    return apiErrorResponse({
      status: 404,
      code: "GAP_REPORT_NOT_FOUND",
      message: "gap report not found",
      extensions: { status: "not_found" },
    });
  }

  const startedAt = parsed.data.startedAt ? new Date(parsed.data.startedAt).getTime() : Date.now();
  const elapsedMs = Math.max(Date.now() - startedAt, 0);

  if (isGapNetworkBuildFailed(gapNetworkDocument)) {
    return NextResponse.json({
      status: "failed",
      gapReportId: parsed.data.gapReportId,
      document: gapNetworkDocument,
      view: buildGapNetworkPendingProgressView({ elapsedMs }),
    });
  }

  if (!isGapNetworkViewReadyForDisplay(gapNetworkDocument)) {
    return NextResponse.json({
      status: "pending",
      gapReportId: parsed.data.gapReportId,
      document: gapNetworkDocument,
      view: buildGapNetworkPendingProgressView({ elapsedMs }),
    });
  }

  return NextResponse.json({
    status: "completed",
    gapReportId: gapNetworkDocument.id,
    gapNetworkDocumentId: gapNetworkDocument.id,
    document: gapNetworkDocument,
    updatedAt: gapNetworkDocument.updatedAt,
    view: buildGapNetworkPendingProgressView({ elapsedMs: 0, isCompleted: true }),
  });
});
