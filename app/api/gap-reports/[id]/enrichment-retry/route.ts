// @promise promise:gap-report-prepared-reaction
// @promise promise:shared-gap-report-member-access
// @check acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry
// @check acceptance-check:gap-report-prepared-reaction-principal-build-limit
// @aspect aspect:provider-failure-degraded-mode
// @aspect aspect:gap-build-principal-admission

import { after, NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import {
  requestGapNetworkEnrichmentRetry,
  startGapNetworkBuildJob,
} from "@/app/server/domain-access/gap-network-view-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 60;

interface RouteContext {
  params: Promise<{ id: string }>;
}

const gapReportIdSchema = z.uuid();

/** POST /api/gap-reports/:id/enrichment-retry — admit one explicit enrichment retry. */
export const POST = withRouteGuard(async (_req: Request, ctx: RouteContext) => {
  const { db, user } = await requireOwnerPrincipalAuth();
  const parsedId = gapReportIdSchema.safeParse((await ctx.params).id);
  if (!parsedId.success) {
    return apiErrorResponse({
      status: 400,
      code: "GAP_ENRICHMENT_RETRY_REPORT_ID_INVALID",
      message: "invalid gap report id",
    });
  }

  const result = await requestGapNetworkEnrichmentRetry({
    db,
    runtimePrincipalId: user.id,
    gapReportId: parsedId.data,
  });
  if (!result) {
    return apiErrorResponse({
      status: 404,
      code: "GAP_REPORT_NOT_FOUND",
      message: "gap report not found",
    });
  }

  console.info("[gap-network-enrichment-retry-command]", {
    gapReportId: parsedId.data,
    outcome: result.outcome,
    retryCount: result.retryCount,
    retryAfterSeconds: result.retryAfterSeconds ?? null,
  });

  if (result.outcome === "cooldown") {
    return apiErrorResponse({
      status: 429,
      code: "GAP_ENRICHMENT_RETRY_COOLDOWN",
      message: "gap enrichment retry is cooling down",
      action: "wait-and-retry",
      retryable: true,
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
  if (result.outcome === "principal-blocked") {
    return apiErrorResponse({
      status: 429,
      code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
      message: "another gap report is still being calculated",
      action: "wait-and-retry",
      retryable: true,
      retryAfterSeconds: result.retryAfterSeconds,
      metadata: { activeGapReportId: result.activeGapReportId },
    });
  }
  if (result.outcome === "same-report-active") {
    return NextResponse.json(
      {
        status: "pending",
        gapReportId: result.document.id,
        retryCount: result.retryCount,
        document: result.document,
      },
      { status: 202 },
    );
  }
  if (result.outcome === "not-retryable") {
    return apiErrorResponse({
      status: 409,
      code: "GAP_ENRICHMENT_RETRY_NOT_AVAILABLE",
      message: "gap enrichment retry is not available for the current report state",
      action: "refresh-and-rebase",
      retryable: false,
    });
  }

  if (result.outcome === "queued") {
    if (!result.admission) {
      throw new Error("queued gap enrichment retry is missing principal admission");
    }
    const runBuildJob = () =>
      startGapNetworkBuildJob({
        db,
        runtimePrincipalId: user.id,
        gapReportId: result.document.id,
        admission: result.admission,
      });
    try {
      after(runBuildJob);
    } catch {
      void runBuildJob();
    }
  }

  return NextResponse.json(
    {
      status: result.outcome === "ready" ? "ready" : "pending",
      gapReportId: result.document.id,
      retryCount: result.retryCount,
      document: result.document,
    },
    { status: result.outcome === "ready" ? 200 : 202 },
  );
});
