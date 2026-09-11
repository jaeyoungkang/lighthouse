"use client";

// @promise promise:gap-report-prepared-reaction
// @promise promise:gap-report-margin
// @promise promise:gap-network-detection-from-search
// @promise promise:gap-led-next-search
// @check acceptance-check:gap-report-margin-wide-shell-classes
// @check acceptance-check:gap-report-margin-distinct-from-reading-shell
// @check acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
// @check acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry
// @check acceptance-check:gap-report-prepared-reaction-principal-build-limit
// @check acceptance-check:gap-network-detection-from-search-progress-staged-pacing
// @check acceptance-check:gap-led-next-search-seed-launches-search
// @check acceptance-check:gap-led-next-search-click-feedback
// @aspect aspect:ai-generated-content-feedback
// @aspect aspect:document-content-width-governance
// @aspect aspect:immediate-navigation
// @aspect aspect:provider-failure-degraded-mode
// @aspect aspect:gap-build-principal-admission
// @aspect aspect:research-route-visual-hierarchy

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  GapNetworkResearchRoutePayload,
  GapNetworkMetadata,
  GapNetworkReport as GapNetworkReportMetadata,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import {
  trackGapAnalysisRetryClicked,
  trackGapReportViewedOnce,
  trackGapViewMarginViewedOnce,
  trackGapViewPreparedReactionViewedOnce,
} from "@/app/lib/track";
import { ApiResponseError, readApiResponseError } from "@/app/lib/api-error-response";
import { gapReportEnrichmentRetryRoute } from "@/app/lib/api-routes";
import { researchRoutePayloadSchema } from "@/app/domain/research-route-payload-schema";
import {
  getGapNetworkEnrichmentRetryCooldownRemainingSeconds,
  isGapNetworkEnrichmentRetryPending,
} from "@/app/lib/gap-network-view-core";
import { getKnowledgeMapDisplayName, getKnowledgeMapLensTitle } from "@/app/lib/knowledge-map-lens";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";
import { GAP_VIEW_CONTENT_SHELL_CLASS } from "../research/research-route-layout.shared";
import {
  buildGapNetworkPendingProgressView,
  FAILED_GAP_NETWORK_DOCUMENT_TITLE,
  GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS,
  GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS,
  GAP_NETWORK_PROGRESS_STAGE_DWELL_MS,
  GAP_NETWORK_PROGRESS_STAGES,
  hasSettledGapNetworkCoreReport,
  isGapNetworkBuildFailed,
  isGapNetworkViewReadyForDisplay,
  needsGapNetworkNarrativeEnrichment,
  PENDING_GAP_NETWORK_DOCUMENT_TITLE,
} from "./gap-network-view.helpers";
import { GapNetworkContentReport } from "./knowledge-map/GapNetworkContentReport";
import { GapNetworkReport } from "./knowledge-map/GapNetworkReport";
import { useSearchTermHandler } from "./search-view-followup-handlers";
import type { FollowupActivationEvent } from "./search-view.helpers";
import { trackGapLedNextSearchClicked } from "@/app/lib/track";
import { PendingKnowledgeMapViewState } from "./PendingKnowledgeMapViewState";
import { useGapNetworkReportStatusPolling } from "./gap-network-report-status-polling";
import { useGapPreparedReactionPersistence } from "./gap-reaction-write-coordinator";

interface GapNetworkViewProps {
  document: ResearchRoutePayload;
  gapAdmissionBlocked?: boolean;
}

function assertGapNetworkViewPayload(
  document: ResearchRoutePayload,
): asserts document is GapNetworkResearchRoutePayload {
  if (document.type !== "gap_network") {
    throw new Error("GapNetworkView requires a gap_network viewer payload");
  }
}

function hasText(value?: string | null): boolean {
  return (value?.trim().length ?? 0) > 0;
}

function hasUsableGapNetworkContentReport(report: GapNetworkReportMetadata): boolean {
  const narrative = report.contentNarrative;

  return (
    (narrative != null &&
      (hasText(narrative.overview) ||
        hasText(narrative.gapInferenceParagraph) ||
        narrative.clusterParagraphs.some((entry) => hasText(entry.paragraph)))) ||
    report.clusters.some((cluster) => hasText(cluster.narrative))
  );
}

function hasPreparedClusterNarrative(metadata: GapNetworkMetadata, clusterId: string): boolean {
  const preparedCluster = metadata.reactionPreparation?.clusterReactions.find(
    (entry) => entry.clusterId === clusterId,
  );
  const reportCluster = metadata.gapNetworkReport.clusters.find(
    (cluster) => cluster.id === clusterId,
  );

  return hasText(preparedCluster?.narrative) || hasText(reportCluster?.narrative);
}

function hasPreparedGapNarrative(metadata: GapNetworkMetadata, gapPairId: string): boolean {
  const preparedGap = metadata.reactionPreparation?.gapReactions.find(
    (entry) => entry.gapPairId === gapPairId,
  );

  return hasText(preparedGap?.metaQualitative) || (preparedGap?.proposals?.length ?? 0) > 0;
}

function getGapNetworkNarrativeVisibility(params: {
  metadata: GapNetworkMetadata;
  enrichmentStatus: NonNullable<GapNetworkMetadata["gapNetworkBuild"]>["enrichment"] | "ready";
}) {
  const hasGapNetworkEdgeEvidence = params.metadata.gapNetworkReport.metrics.totalEdgeCount > 0;
  const hasUsableContentReport = hasUsableGapNetworkContentReport(params.metadata.gapNetworkReport);
  const canShowNarrativeStatus = needsGapNetworkNarrativeEnrichment(params.metadata);
  const selectionNarrativeStatus =
    canShowNarrativeStatus && params.enrichmentStatus === "pending"
      ? "pending"
      : canShowNarrativeStatus && params.enrichmentStatus === "ready" && hasUsableContentReport
        ? "ready"
        : "degraded";

  return {
    hasGapNetworkEdgeEvidence,
    hasUsableContentReport,
    shouldShowContentStatus: canShowNarrativeStatus && !hasUsableContentReport,
    selectionNarrativeStatus,
  } as const;
}

function GapNetworkContentStatus({
  status,
  cooldownSeconds,
  isSubmitting,
  retryError,
  onRetry,
}: {
  status: "pending" | "degraded";
  cooldownSeconds: number;
  isSubmitting: boolean;
  retryError: string | null;
  onRetry: () => void;
}) {
  const isPending = status === "pending";
  const isCoolingDown = cooldownSeconds > 0;
  return (
    <div
      data-testid={
        isPending ? "gap-network-view-content-pending" : "gap-network-view-content-degraded"
      }
      className="border-sidebar-border mt-6 border-t px-1 pt-5"
    >
      <p className="lh-type-section-heading lh-tone-primary">
        {isPending
          ? t("gapNetwork.label.gap-network-view.contentPendingTitle")
          : t("gapNetwork.label.gap-network-view.contentDegradedTitle")}
      </p>
      <p className="lh-type-reading-body lh-tone-secondary mt-1">
        {isPending
          ? t("gapNetwork.label.gap-network-view.contentPendingBody")
          : t("gapNetwork.label.gap-network-view.contentDegradedBody")}
      </p>
      {retryError ? (
        <p className="lh-type-metadata text-error mt-2" role="alert">
          {retryError}
        </p>
      ) : null}
      <button
        type="button"
        className="lh-type-control-label border-foreground/20 text-foreground rounded-lh-sm mt-3 border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isPending || isSubmitting || isCoolingDown}
        onClick={onRetry}
      >
        {isPending || isSubmitting
          ? t("gapNetwork.label.gap-network-view.contentRetrying")
          : isCoolingDown
            ? t("gapNetwork.label.gap-network-view.contentRetryCooldown", {
                seconds: cooldownSeconds,
              })
            : t("gapNetwork.label.gap-network-view.contentRetry")}
      </button>
    </div>
  );
}

function useGapNetworkSeedSearchHandler(
  document: Pick<GapNetworkResearchRoutePayload, "viewerPrincipalId" | "id">,
) {
  const launchSearchTerm = useSearchTermHandler();
  return useCallback(
    (seed: string, seedKind: "cluster" | "concept" | "gap", event?: FollowupActivationEvent) => {
      trackGapLedNextSearchClicked({
        type: "gap_led_next_search_clicked",
        data: {
          viewerPrincipalId: document.viewerPrincipalId,
          documentId: document.id,
          seedKind,
        },
      });
      launchSearchTerm(seed, undefined, event);
    },
    [document.id, document.viewerPrincipalId, launchSearchTerm],
  );
}

function useTrackGapNetworkViewViewOnce(params: {
  document: GapNetworkResearchRoutePayload;
  isVisible: boolean;
  metadata: GapNetworkMetadata;
}) {
  const { document, isVisible, metadata } = params;
  const trackedGapMarginViewRef = useRef<string | null>(null);
  const trackedPreparedReactionViewRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isVisible) return;
    const viewerReportKey = `${document.viewerPrincipalId}:${document.id}`;
    trackGapReportViewedOnce({
      type: "gap_network_viewed",
      data: {
        viewerPrincipalId: document.viewerPrincipalId,
        documentId: document.id,
      },
    });
    if (trackedGapMarginViewRef.current !== viewerReportKey) {
      trackedGapMarginViewRef.current = viewerReportKey;
      trackGapViewMarginViewedOnce({
        type: "gap_view_margin_viewed",
        data: {
          viewerPrincipalId: document.viewerPrincipalId,
          researchRoutePayloadId: document.id,
          hasEdgeEvidence: metadata.gapNetworkReport.metrics.totalEdgeCount > 0,
        },
      });
    }

    const reactionPreparation = metadata.reactionPreparation;
    if (!reactionPreparation) return;
    if (trackedPreparedReactionViewRef.current === viewerReportKey) return;
    trackedPreparedReactionViewRef.current = viewerReportKey;
    const preparedReactionCount =
      1 + reactionPreparation.clusterReactions.length + reactionPreparation.gapReactions.length;
    trackGapViewPreparedReactionViewedOnce({
      type: "gap_view_prepared_reaction_viewed",
      data: {
        viewerPrincipalId: document.viewerPrincipalId,
        researchRoutePayloadId: document.id,
        preparedReactionCount,
      },
    });
  }, [document.id, document.viewerPrincipalId, isVisible, metadata]);
}

export function GapNetworkView({ document, gapAdmissionBlocked = false }: GapNetworkViewProps) {
  assertGapNetworkViewPayload(document);
  const patchCurrentView = useResearchRouteStore((state) => state.patchCurrentView);
  const setRouteAiComment = useResearchRouteStore((state) => state.setRouteAiComment);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const patchCurrentExecution = useCallback(
    (nextDocument: ResearchRoutePayload) => {
      if (!activeExecutionId) return;
      patchCurrentView(nextDocument, activeExecutionId);
    },
    [activeExecutionId, patchCurrentView],
  );
  const handleSeedAsSearch = useGapNetworkSeedSearchHandler(document);
  const metadata = document.metadata;
  const syncPreparedReaction = useGapPreparedReactionPersistence({
    activeExecutionId,
    document,
    reactionPreparation: metadata.reactionPreparation,
    setRouteAiComment,
  });
  const enrichmentStatus = metadata.gapNetworkBuild?.enrichment ?? "ready";
  const isEnrichmentRetryPending = isGapNetworkEnrichmentRetryPending(metadata);
  const hasSettledCoreReport = hasSettledGapNetworkCoreReport(metadata);
  const isDisplayReady = isGapNetworkViewReadyForDisplay(document);
  const canRunNarrativeEnrichment = needsGapNetworkNarrativeEnrichment(metadata);
  const shouldShowEnrichmentStatus =
    canRunNarrativeEnrichment && enrichmentStatus === "pending" && !isEnrichmentRetryPending;
  const isBuildFailed = isGapNetworkBuildFailed(document);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusTerminal, setStatusTerminal] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrySubmitting, setRetrySubmitting] = useState(false);
  const [cooldownClockMs, setCooldownClockMs] = useState(() => Date.now());
  const [localRetryNotBeforeMs, setLocalRetryNotBeforeMs] = useState(0);
  const persistedCooldownSeconds = getGapNetworkEnrichmentRetryCooldownRemainingSeconds(
    metadata,
    cooldownClockMs,
  );
  const localCooldownSeconds = Math.max(
    Math.ceil((localRetryNotBeforeMs - cooldownClockMs) / 1_000),
    0,
  );
  const cooldownSeconds = Math.max(persistedCooldownSeconds, localCooldownSeconds);

  useEffect(() => {
    setCooldownClockMs(Date.now());
  }, [enrichmentStatus, metadata.gapNetworkBuild?.updatedAt]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const intervalId = window.setInterval(() => {
      setCooldownClockMs(Date.now());
    }, 1_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [cooldownSeconds]);

  const retryEnrichment = useCallback(async () => {
    const retryCount = (metadata.gapNetworkBuild?.enrichmentRetryCount ?? 0) + 1;
    trackGapAnalysisRetryClicked({ gapReportId: document.id, retryCount });
    setRetrySubmitting(true);
    setRetryError(null);
    try {
      const response = await fetch(gapReportEnrichmentRetryRoute(document.id), { method: "POST" });
      if (!response.ok) {
        throw await readApiResponseError(response, "gap enrichment retry failed");
      }
      const body: unknown = await response.json();
      const parsed = researchRoutePayloadSchema.safeParse(
        typeof body === "object" && body !== null && "document" in body
          ? (body as { document: unknown }).document
          : null,
      );
      if (!parsed.success) throw new Error("invalid gap enrichment retry response");
      patchCurrentExecution(parsed.data);
    } catch (error) {
      if (error instanceof ApiResponseError && error.retryAfterMs != null) {
        setLocalRetryNotBeforeMs(Date.now() + error.retryAfterMs);
      }
      setRetryError(
        error instanceof ApiResponseError && error.code === "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT"
          ? t("gapNetwork.error.gap-network-view.principalAdmission")
          : t("gapNetwork.error.gap-network-view.contentRetry"),
      );
    } finally {
      setRetrySubmitting(false);
    }
  }, [document.id, metadata.gapNetworkBuild?.enrichmentRetryCount, patchCurrentExecution]);

  // Client-owned animation clock. The observable build phase is coarse — the
  // deterministic core settles in ~1-2s and narrative enrichment is the long
  // pole — so the visible stage pacing is driven here rather than by the raw
  // phase. `startedPending` is captured once at mount: only builds that started
  // pending get the minimum-visible hold, and reopening an already-display-ready
  // report is never delayed. The elapsed clock is seeded so a report opened
  // mid-enrichment (core already settled) starts on the interpretation stage
  // instead of replaying the already-finished early stages; a fresh core-pending
  // mount starts at collect.
  const [startedPending] = useState(() => !isDisplayReady && !isEnrichmentRetryPending);
  const [elapsedMs, setElapsedMs] = useState(() => {
    if (!hasSettledCoreReport || isDisplayReady) {
      return 0;
    }
    const interpretIndex = GAP_NETWORK_PROGRESS_STAGES.findIndex(
      (stage) => stage.id === "interpret",
    );
    return Math.max(interpretIndex, 0) * GAP_NETWORK_PROGRESS_STAGE_DWELL_MS;
  });

  const isCorePending = !hasSettledCoreReport && !isDisplayReady;
  // A terminal empty-state (insufficient edges / no meaningful gap) reveals a
  // short message rather than a graph, so it holds for less time than a
  // meaningful-gap report while still showing brief staged progress.
  const isTerminalEmptyState =
    isDisplayReady &&
    (metadata.gapNetworkReport.metrics.totalEdgeCount === 0 ||
      metadata.gapNetworkReport.gapPairs.length === 0);
  const minVisibleMs = isTerminalEmptyState
    ? GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS
    : GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS;
  const holdForMinVisible = startedPending && elapsedMs < minVisibleMs;
  const showProgress =
    isStatusTerminal || isCorePending || shouldShowEnrichmentStatus || holdForMinVisible;
  const progressView = buildGapNetworkPendingProgressView({ elapsedMs });

  useEffect(() => {
    // No animation for a terminal-failed build — freeze the clock so the bar
    // stays at the first stage instead of animating toward completion.
    if (!showProgress || isBuildFailed || isStatusTerminal) {
      return;
    }
    const stepMs = 300;
    const intervalId = window.setInterval(() => {
      setElapsedMs((previous) => previous + stepMs);
    }, stepMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [showProgress, isBuildFailed, isStatusTerminal]);

  useGapNetworkReportStatusPolling({
    document,
    expectedExecutionId: activeExecutionId,
    isDisplayReady,
    patchCurrentView: patchCurrentExecution,
    setStatusError,
    setStatusTerminal,
  });

  useTrackGapNetworkViewViewOnce({
    document,
    isVisible: (isDisplayReady || isEnrichmentRetryPending) && !showProgress,
    metadata,
  });

  const admissionNotice = gapAdmissionBlocked ? (
    <div
      role="status"
      data-testid="gap-build-principal-admission-notice"
      className="border-sidebar-border bg-surface-panel mb-5 rounded border px-4 py-3 text-left"
    >
      <p className="lh-type-section-heading lh-tone-primary">
        {t("gapNetwork.label.gap-network-view.principalAdmissionTitle")}
      </p>
      <p className="lh-type-reading-body lh-tone-secondary mt-1">
        {t("gapNetwork.label.gap-network-view.principalAdmissionBody")}
      </p>
    </div>
  ) : null;

  if (showProgress) {
    return (
      <PendingKnowledgeMapViewState
        lensLabel={getKnowledgeMapDisplayName("E2")}
        pendingTitle={PENDING_GAP_NETWORK_DOCUMENT_TITLE}
        failedTitle={FAILED_GAP_NETWORK_DOCUMENT_TITLE}
        query={metadata.query}
        error={isStatusTerminal ? statusError : null}
        isRetrying={false}
        progressView={progressView}
        progressStages={GAP_NETWORK_PROGRESS_STAGES}
        statusError={isStatusTerminal ? null : statusError}
        readyDescription={t("gapNetwork.label.gap-network-view.4", {
          lensTitle: getKnowledgeMapLensTitle("E2"),
        })}
        contextualNotice={admissionNotice}
        onRetry={null}
      />
    );
  }

  const visibility = getGapNetworkNarrativeVisibility({ metadata, enrichmentStatus });

  return (
    <ResearchRouteRendererShell>
      <div className={GAP_VIEW_CONTENT_SHELL_CLASS} data-testid="gap-network-content-shell">
        {admissionNotice}
        <header data-testid="gap-network-view-header" className="mb-4">
          <h1 className="lh-type-route-heading lh-tone-primary">{document.title}</h1>
          {metadata.gapNetworkReport.domainLabel ? (
            <p
              data-testid="gap-network-view-domain-chip"
              className="lh-type-metadata lh-tone-secondary mt-1"
            >
              {metadata.gapNetworkReport.domainLabel}
            </p>
          ) : null}
        </header>
        <div data-testid="gap-network-view-graph-sticky" className="bg-surface-research w-full">
          {hasSettledCoreReport ? (
            <GapNetworkReport
              documentId={document.id}
              query={metadata.query}
              report={metadata.gapNetworkReport}
              papers={metadata.papers}
              sourceCitationLineageBreakdown={metadata.sourceCitationLineageBreakdown}
              clusterReactions={metadata.reactionPreparation?.clusterReactions}
              gapReactions={metadata.reactionPreparation?.gapReactions}
              selectionNarrativeStatus={visibility.selectionNarrativeStatus}
              onBackgroundReset={() => {
                if (visibility.selectionNarrativeStatus === "ready") {
                  syncPreparedReaction("overview");
                }
              }}
              onClusterSelect={(clusterId) => {
                if (
                  visibility.selectionNarrativeStatus === "ready" &&
                  hasPreparedClusterNarrative(metadata, clusterId)
                ) {
                  syncPreparedReaction({ clusterId });
                }
              }}
              onGapSelect={(gapPairId) => {
                if (
                  visibility.selectionNarrativeStatus === "ready" &&
                  hasPreparedGapNarrative(metadata, gapPairId)
                ) {
                  syncPreparedReaction({ gapPairId });
                }
              }}
              onUseSeedAsSearch={handleSeedAsSearch}
            />
          ) : null}
        </div>
        {hasSettledCoreReport &&
        visibility.hasGapNetworkEdgeEvidence &&
        visibility.hasUsableContentReport ? (
          <div data-testid="gap-network-view-content-scroll" className="mt-6">
            <GapNetworkContentReport documentId={document.id} report={metadata.gapNetworkReport} />
          </div>
        ) : null}
        {hasSettledCoreReport && visibility.shouldShowContentStatus ? (
          <GapNetworkContentStatus
            status={enrichmentStatus === "pending" ? "pending" : "degraded"}
            cooldownSeconds={cooldownSeconds}
            isSubmitting={isRetrySubmitting}
            retryError={retryError}
            onRetry={() => void retryEnrichment()}
          />
        ) : null}
      </div>
    </ResearchRouteRendererShell>
  );
}
