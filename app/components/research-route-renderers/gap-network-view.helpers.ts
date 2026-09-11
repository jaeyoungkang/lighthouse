import { t } from "@/app/i18n/message-access";
import type { GraphProgressStage } from "@/app/lib/graph-progress";
import {
  buildKnowledgeMapFailedTitle,
  getKnowledgeMapLensTitle,
} from "@/app/lib/knowledge-map-lens";
/**
 * Client-owned min-dwell between visible gap-network progress stages. The
 * deterministic core settles in ~1-2s while narrative enrichment is the long
 * pole, and the observable build phase is coarse, so the visible pacing is
 * driven by this dwell rather than the raw phase. This keeps
 * collect→enrich→cluster→analyze→interpret readable instead of flashing the
 * first stage and jumping straight to completed.
 */
export const GAP_NETWORK_PROGRESS_STAGE_DWELL_MS = 1500;

/**
 * Minimum time the animated progress screen stays visible before a freshly
 * built gap report is revealed. Fast builds that settle in ~1-2s still show
 * staged progress instead of flashing straight to the result. Only applies to
 * builds that started pending in this mount; reopening an already-ready report
 * is not delayed.
 */
export const GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS = 4500;

/**
 * Shorter minimum-visible floor for a terminal empty-state result (insufficient
 * edges / no meaningful gap). The payoff is a short "not enough evidence"
 * message, not a graph, so it should surface sooner than a meaningful-gap report
 * while still showing brief staged progress instead of flashing.
 */
export const GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS = 3000;

export const FAILED_GAP_NETWORK_DOCUMENT_TITLE = buildKnowledgeMapFailedTitle("E2");
export {
  PENDING_GAP_NETWORK_DOCUMENT_TITLE,
  GAP_NETWORK_CORE_EVIDENCE_VERSION,
  buildPendingGapNetworkMetadata,
  createEmptyGapNetworkReport,
  hasCurrentGapNetworkCoreEvidence,
  hasSettledGapNetworkCoreReport,
  isGapNetworkBuildFailed,
  isGapNetworkViewReadyForDisplay,
  isSettledGapNetworkView,
  needsGapNetworkNarrativeEnrichment,
} from "@/app/lib/gap-network-view-core";

export const GAP_NETWORK_PROGRESS_STAGES: GraphProgressStage[] = [
  {
    id: "collect",
    label: t("gapNetwork.progress.gap-network-view-helpers"),
    detail: t("gapNetwork.label.gap-network-view-helpers"),
    progress: 1 / 6,
  },
  {
    id: "enrich",
    label: t("gapNetwork.progress.gap-network-view-helpers.2"),
    detail: t("gapNetwork.label.gap-network-view-helpers.2"),
    progress: 2 / 6,
  },
  {
    id: "cluster",
    label: t("gapNetwork.progress.gap-network-view-helpers.3"),
    detail: t("gapNetwork.label.gap-network-view-helpers.3"),
    progress: 3 / 6,
  },
  {
    id: "analyze",
    label: t("gapNetwork.progress.gap-network-view-helpers.4"),
    detail: t("gapNetwork.label.gap-network-view-helpers.4"),
    progress: 4 / 6,
  },
  {
    id: "interpret",
    label: t("gapNetwork.progress.gap-network-view-helpers.5"),
    detail: t("gapNetwork.label.gap-network-view-helpers.5"),
    progress: 5 / 6,
  },
  {
    id: "completed",
    label: t("gapNetwork.label.gap-network-view-helpers.7"),
    detail: t("gapNetwork.label.gap-network-view-helpers.6", {
      lensTitle: getKnowledgeMapLensTitle("E2"),
    }),
    progress: 1,
  },
];

export function buildGapNetworkPendingProgressView(params: {
  elapsedMs: number;
  isCompleted?: boolean;
}): GraphProgressStage {
  if (params.isCompleted) {
    const completedStage = GAP_NETWORK_PROGRESS_STAGES.at(-1);
    if (!completedStage) {
      throw new Error("gap network progress stages must include completed state");
    }
    return completedStage;
  }

  const pendingStages = GAP_NETWORK_PROGRESS_STAGES.slice(0, -1);
  const stageIndex = Math.min(
    Math.max(Math.floor(params.elapsedMs / GAP_NETWORK_PROGRESS_STAGE_DWELL_MS), 0),
    pendingStages.length - 1,
  );
  const stage = pendingStages.at(stageIndex);
  if (!stage) {
    throw new Error("gap network progress stages must include pending state");
  }
  return stage;
}
