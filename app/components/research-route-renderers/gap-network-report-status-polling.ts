"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type {
  GapNetworkResearchRoutePayload,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import { researchRoutePayloadSchema } from "@/app/domain/research-route-payload-schema";
import { t } from "@/app/i18n/message-access";
import { API_ROUTES } from "@/app/lib/api-routes";
import { fetchWithSilenceTimeout } from "@/app/lib/fetch-with-silence-timeout";
import {
  isGapNetworkBuildFailed,
  isGapNetworkViewReadyForDisplay,
} from "@/app/lib/gap-network-view-core";
import { getKnowledgeMapDisplayName } from "@/app/lib/knowledge-map-lens";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

interface UseGapNetworkReportStatusPollingParams {
  document: GapNetworkResearchRoutePayload;
  expectedExecutionId: string | null;
  isDisplayReady: boolean;
  patchCurrentView: (document: ResearchRoutePayload) => void;
  setStatusError: Dispatch<SetStateAction<string | null>>;
  setStatusTerminal: Dispatch<SetStateAction<boolean>>;
}

interface GapNetworkStatusPayload {
  status?: unknown;
  document?: unknown;
}

const GAP_NETWORK_STATUS_SILENCE_TIMEOUT_MS = 65_000;
export const GAP_NETWORK_BUILD_RECOVERY_GRACE_MS = 5_000;

function parseStatusDocument(params: {
  candidate: unknown;
  documentId: string;
  viewerPrincipalId: string;
  patchCurrentView: (document: ResearchRoutePayload) => void;
}): GapNetworkResearchRoutePayload | null {
  const { candidate, documentId, viewerPrincipalId, patchCurrentView } = params;
  const parsed = researchRoutePayloadSchema.safeParse(candidate);
  if (!parsed.success) {
    return null;
  }

  const nextDocument = parsed.data;
  const currentView = useResearchRouteStore.getState().currentView;
  if (
    nextDocument.id !== documentId ||
    nextDocument.type !== "gap_network" ||
    nextDocument.viewerPrincipalId !== viewerPrincipalId ||
    nextDocument.version < (currentView?.version ?? 0)
  ) {
    return null;
  }

  patchCurrentView(nextDocument);
  return nextDocument;
}

export function shouldRequestGapNetworkBuildRecovery(
  document: GapNetworkResearchRoutePayload,
  nowMs = Date.now(),
): boolean {
  const isDisplayReady: boolean = isGapNetworkViewReadyForDisplay(document);
  if (isDisplayReady) {
    return false;
  }
  const build = document.metadata.gapNetworkBuild;
  if (
    !build ||
    (build.core !== "pending" && !(build.core === "ready" && build.enrichment === "pending"))
  ) {
    return false;
  }
  if (build.leaseExpiresAt) {
    const leaseExpiresAt = Date.parse(build.leaseExpiresAt);
    return Number.isFinite(leaseExpiresAt) && leaseExpiresAt <= nowMs;
  }
  const updatedAt = Date.parse(build.updatedAt);
  return Number.isFinite(updatedAt) && updatedAt + GAP_NETWORK_BUILD_RECOVERY_GRACE_MS <= nowMs;
}

function buildRecoveryToken(document: GapNetworkResearchRoutePayload): string {
  const build = document.metadata.gapNetworkBuild;
  return `${document.id}:${String(build?.attempt ?? 0)}:${build?.leaseExpiresAt ?? build?.updatedAt ?? "queued"}`;
}

export function useGapNetworkReportStatusPolling(params: UseGapNetworkReportStatusPollingParams) {
  const {
    document,
    expectedExecutionId,
    isDisplayReady,
    patchCurrentView,
    setStatusError,
    setStatusTerminal,
  } = params;
  const documentId = document.id;
  const viewerPrincipalId = document.viewerPrincipalId;
  const isBuildFailed = isGapNetworkBuildFailed(document);
  const requestedRecoveryRef = useRef<{ token: string; requestedAt: number } | null>(null);

  useEffect(() => {
    if (!expectedExecutionId) {
      return;
    }
    setStatusTerminal(false);

    if (isBuildFailed) {
      setStatusTerminal(true);
      setStatusError(
        t("gapNetwork.error.gap-network-view.3", {
          displayName: getKnowledgeMapDisplayName("E2"),
        }),
      );
      return;
    }

    if (isDisplayReady) {
      return;
    }

    const startedAt = new Date().toISOString();
    const controller = new AbortController();
    let timeoutId: number | null = null;

    const schedulePoll = (delay: number) => {
      timeoutId = window.setTimeout(() => {
        void pollStatus();
      }, delay);
    };

    const pollStatus = async () => {
      try {
        const routeState = useResearchRouteStore.getState();
        const currentView = routeState.currentView;
        if (
          routeState.activeExecutionId !== expectedExecutionId ||
          currentView?.id !== documentId ||
          currentView.type !== "gap_network" ||
          currentView.viewerPrincipalId !== viewerPrincipalId
        ) {
          return;
        }
        const searchParams = new URLSearchParams({
          gapReportId: documentId,
          startedAt,
        });
        const response = await fetchWithSilenceTimeout(
          `${API_ROUTES.GAP_REPORTS_STATUS}?${searchParams}`,
          { signal: controller.signal },
          {
            discardBodyOnNonOk: true,
            timeoutMs: GAP_NETWORK_STATUS_SILENCE_TIMEOUT_MS,
            timeoutMessage: "gap network status stalled",
            timeoutErrorName: "TimeoutError",
          },
        );
        if (response.status === 404) {
          setStatusTerminal(true);
          setStatusError(
            t("gapNetwork.error.gap-network-view.3", {
              displayName: getKnowledgeMapDisplayName("E2"),
            }),
          );
          return;
        }
        if (!response.ok) {
          throw new Error(`gap network status failed: ${String(response.status)}`);
        }

        const payload = (await response
          .json()
          .catch((): unknown => null)) as GapNetworkStatusPayload | null;
        if (!payload || typeof payload !== "object") {
          throw new Error("gap network status response is invalid");
        }
        setStatusError(null);
        const nextDocument = parseStatusDocument({
          candidate: payload.document,
          documentId,
          viewerPrincipalId,
          patchCurrentView,
        });
        if (nextDocument && shouldRequestGapNetworkBuildRecovery(nextDocument)) {
          const recoveryToken = buildRecoveryToken(nextDocument);
          const priorRecovery = requestedRecoveryRef.current;
          if (
            priorRecovery?.token !== recoveryToken ||
            priorRecovery.requestedAt + GAP_NETWORK_BUILD_RECOVERY_GRACE_MS <= Date.now()
          ) {
            requestedRecoveryRef.current = { token: recoveryToken, requestedAt: Date.now() };
            const recoveryResponse = await fetchWithSilenceTimeout(
              API_ROUTES.GAP_REPORTS,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ gapReportId: nextDocument.id }),
                signal: controller.signal,
              },
              {
                discardBodyOnNonOk: true,
                timeoutMs: GAP_NETWORK_STATUS_SILENCE_TIMEOUT_MS,
                timeoutMessage: "gap network recovery stalled",
                timeoutErrorName: "TimeoutError",
              },
            );
            if (!recoveryResponse.ok) {
              throw new Error(`gap network recovery failed: ${String(recoveryResponse.status)}`);
            }
          }
        }
        if (payload.status === "failed") {
          setStatusTerminal(true);
          setStatusError(
            t("gapNetwork.error.gap-network-view.3", {
              displayName: getKnowledgeMapDisplayName("E2"),
            }),
          );
          return;
        }
        if (payload.status === "completed" && nextDocument) {
          return;
        }
        schedulePoll(1200);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const fallbackStatusError = t("gapNetwork.error.gap-network-view.3", {
          displayName: getKnowledgeMapDisplayName("E2"),
        });
        setStatusError(
          error instanceof Error && error.name !== "TimeoutError"
            ? error.message
            : fallbackStatusError,
        );
        schedulePoll(1800);
      }
    };

    void pollStatus();

    return () => {
      controller.abort();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    documentId,
    expectedExecutionId,
    isBuildFailed,
    isDisplayReady,
    viewerPrincipalId,
    patchCurrentView,
    setStatusError,
    setStatusTerminal,
  ]);
}
