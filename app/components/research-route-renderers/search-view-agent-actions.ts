"use client";

// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set
// @check acceptance-check:gap-network-detection-from-search-principal-build-limit

import {
  getResearchRouteViewerPrincipalId,
  type ResearchRoutePayload,
  type SearchMetadata,
} from "@/app/domain/research-route-payload";
import { API_ROUTES, gapOpeningRoute } from "@/app/lib/api-routes";
import {
  GAP_REPORT_SNAPSHOT_LIMITS,
  serializeGapReportRequest,
  truncateUtf8,
} from "@/app/lib/gap-report-input-budget";
import { track } from "@/app/lib/track";
import { ApiResponseError, readApiResponseError } from "@/app/lib/api-error-response";
import { normalizeGraphSourcePaperIds } from "@/app/lib/graph-source-paper-ids";
import {
  projectGraphSupportForGapRequest,
  toGraphPaperSnapshotProjection,
} from "@/app/lib/graph-paper-snapshots";

export interface GapReportNavigationTarget {
  navigate(url: string): void;
  discard(): void;
}

interface GapNetworkNavigationOptions {
  navigationTarget?: GapReportNavigationTarget | null;
  onPendingChange?: (isPending: boolean) => void;
}

export function buildGapReportCreationRequest(
  document: ResearchRoutePayload,
  metadata: SearchMetadata,
  sourcePaperIds?: readonly string[],
) {
  const requestedPaperIds = normalizeGraphSourcePaperIds(sourcePaperIds);
  const selectedPapers = requestedPaperIds
    ? requestedPaperIds
        .map((paperId) => metadata.papers.find((paper) => paper.paperId === paperId))
        .filter((paper): paper is SearchMetadata["papers"][number] => Boolean(paper))
    : metadata.papers;
  const projection = toGraphPaperSnapshotProjection(selectedPapers);
  const { papers } = projection;
  return {
    sourceSnapshotId: truncateUtf8(document.id, GAP_REPORT_SNAPSHOT_LIMITS.sourceSnapshotIdBytes),
    sourceQuery: truncateUtf8(metadata.query, GAP_REPORT_SNAPSHOT_LIMITS.sourceQueryBytes),
    sourcePaperIds: papers.map((paper) => paper.paperId),
    papers,
    graphSupport: projectGraphSupportForGapRequest(metadata.graphSupport, projection),
  };
}

function getSearchMetadata(document: ResearchRoutePayload): SearchMetadata | null {
  return document.type === "search" ? document.metadata : null;
}

export function openDetachedGapReportWindowTarget(): GapReportNavigationTarget | null {
  if (typeof window === "undefined") return null;

  const gapWindow = window.open(gapOpeningRoute(), "_blank");
  if (!gapWindow) return null;

  let navigated = false;
  try {
    gapWindow.opener = null;
  } catch {
    gapWindow.close();
    return null;
  }

  return {
    navigate(url: string) {
      try {
        gapWindow.location.assign(url);
        navigated = true;
      } catch (error) {
        gapWindow.close();
        throw error;
      }
    },
    discard() {
      if (navigated) return;
      gapWindow.close();
    },
  };
}

function openCreatedGapReportInDetachedWindow(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function openGapNetworkFromSearchView(
  document: ResearchRoutePayload,
  sortedMetadata?: SearchMetadata,
  navigate?: (url: string) => void,
  sourcePaperIds?: readonly string[],
  options?: GapNetworkNavigationOptions,
): void {
  const metadata = sortedMetadata ?? getSearchMetadata(document);
  if (!metadata || metadata.papers.length === 0) {
    options?.navigationTarget?.discard();
    return;
  }

  openGapNetworkFromSearchSource(document, metadata, navigate, sourcePaperIds, options);
}

export function openGapNetworkFromSearchSource(
  document: ResearchRoutePayload,
  metadata: SearchMetadata,
  navigate?: (url: string) => void,
  sourcePaperIds?: readonly string[],
  options?: GapNetworkNavigationOptions,
): void {
  if (metadata.papers.length === 0) {
    options?.navigationTarget?.discard();
    return;
  }

  const navigationTarget =
    options?.navigationTarget ?? (navigate ? null : openDetachedGapReportWindowTarget());
  const fallbackNavigate = navigate ?? openCreatedGapReportInDetachedWindow;
  const navigateToGapReport = (url: string) => {
    if (navigationTarget) {
      try {
        navigationTarget.navigate(url);
        return;
      } catch (error) {
        console.warn("[gap-network-action] detached window navigation failed:", error);
      }
    }
    fallbackNavigate(url);
  };

  let requestBody: string;
  try {
    requestBody = serializeGapReportRequest(
      buildGapReportCreationRequest(document, metadata, sourcePaperIds),
    );
  } catch (error) {
    navigationTarget?.discard();
    console.warn("[gap-network-action] creation skipped:", error);
    return;
  }

  track({
    type: "gap_report_open",
    data: {
      ownerPrincipalId: getResearchRouteViewerPrincipalId(document),
      documentId: document.id,
      lens: "E2",
      sourceType: document.type,
    },
  });
  options?.onPendingChange?.(true);
  void fetch(API_ROUTES.GAP_REPORTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw await readApiResponseError(response, "gap network creation failed");
      }
      const payload = (await response.json()) as { gapReportId?: unknown };
      if (typeof payload.gapReportId !== "string") {
        throw new Error("gap network creation response is invalid");
      }
      navigateToGapReport(`/gap/${encodeURIComponent(payload.gapReportId)}`);
    })
    .catch((error: unknown) => {
      if (
        error instanceof ApiResponseError &&
        error.code === "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT" &&
        typeof error.metadata === "object" &&
        error.metadata !== null &&
        "activeGapReportId" in error.metadata &&
        typeof error.metadata.activeGapReportId === "string"
      ) {
        navigateToGapReport(
          `/gap/${encodeURIComponent(error.metadata.activeGapReportId)}?admission=blocked`,
        );
      } else {
        navigationTarget?.discard();
      }
      console.warn("[gap-network-action] creation skipped:", error);
    })
    .finally(() => {
      options?.onPendingChange?.(false);
    });
}
