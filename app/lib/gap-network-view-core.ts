import type {
  GapNetworkGraphSupportMetadata,
  ResearchRoutePayload,
  GapNetworkMetadata,
  GapNetworkReport,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import { toGraphPaperSnapshots } from "@/app/lib/graph-paper-snapshots";
import { buildKnowledgeMapPendingTitle } from "@/app/lib/knowledge-map-lens";

export const PENDING_GAP_NETWORK_DOCUMENT_TITLE = buildKnowledgeMapPendingTitle("E2");

export const GAP_NETWORK_CORE_EVIDENCE_VERSION = "citation-semantic-graph-v2";
export const GAP_NETWORK_ENRICHMENT_RETRY_COOLDOWN_MS = 60_000;

export function createEmptyGapNetworkReport(): GapNetworkReport {
  return {
    clusters: [],
    conceptEdges: [],
    gapPairs: [],
    metrics: {
      clusterCount: 0,
      totalPaperCount: 0,
      totalEdgeCount: 0,
      gapPairCount: 0,
    },
    insight: {
      hypotheses: [],
    },
  };
}

export function hasSettledGapNetworkCoreReport(metadata: GapNetworkMetadata): boolean {
  const report = metadata.gapNetworkReport;
  if (report.metrics.totalPaperCount <= 0) {
    return false;
  }

  if (!hasCurrentGapNetworkCoreEvidence(metadata)) {
    return false;
  }

  if (metadata.gapNetworkBuild?.core === "ready") {
    return true;
  }

  return report.clusters.length > 0 || report.conceptEdges.length > 0 || report.gapPairs.length > 0;
}

export function hasCurrentGapNetworkCoreEvidence(metadata: GapNetworkMetadata): boolean {
  const build = metadata.gapNetworkBuild;
  if (!build) {
    return true;
  }
  if (build.enrichment !== "pending") {
    return true;
  }
  if (metadata.gapNetworkReport.gapPairs.length > 0) {
    return true;
  }
  return build.coreEvidence === GAP_NETWORK_CORE_EVIDENCE_VERSION;
}

export function isSettledGapNetworkView(
  document: ResearchRoutePayload,
): document is ResearchRoutePayload & { type: "gap_network"; metadata: GapNetworkMetadata } {
  return document.type === "gap_network" && hasSettledGapNetworkCoreReport(document.metadata);
}

export function needsGapNetworkNarrativeEnrichment(metadata: GapNetworkMetadata): boolean {
  return (
    hasSettledGapNetworkCoreReport(metadata) &&
    metadata.gapNetworkReport.metrics.totalEdgeCount > 0 &&
    metadata.gapNetworkReport.gapPairs.length > 0
  );
}

export function isGapNetworkNarrativeEnrichmentTerminal(metadata: GapNetworkMetadata): boolean {
  if (!metadata.gapNetworkBuild) {
    return true;
  }
  const enrichment = metadata.gapNetworkBuild.enrichment;
  return enrichment === "ready" || enrichment === "failed";
}

export function isGapNetworkEnrichmentRetryPending(metadata: GapNetworkMetadata): boolean {
  const build = metadata.gapNetworkBuild;
  return build?.enrichment === "pending" && (build.enrichmentRetryCount ?? 0) > 0;
}

export function getGapNetworkEnrichmentRetryCooldownRemainingSeconds(
  metadata: GapNetworkMetadata,
  nowMs = Date.now(),
): number {
  const build = metadata.gapNetworkBuild;
  if (build?.enrichment !== "failed" || (build.enrichmentRetryCount ?? 0) < 1) {
    return 0;
  }

  const failedAtMs = Date.parse(build.updatedAt);
  if (!Number.isFinite(failedAtMs)) return 0;
  return Math.max(
    Math.ceil((failedAtMs + GAP_NETWORK_ENRICHMENT_RETRY_COOLDOWN_MS - nowMs) / 1_000),
    0,
  );
}

export function isGapNetworkViewReadyForDisplay(
  document: ResearchRoutePayload,
): document is ResearchRoutePayload & { type: "gap_network"; metadata: GapNetworkMetadata } {
  return (
    isSettledGapNetworkView(document) &&
    (!needsGapNetworkNarrativeEnrichment(document.metadata) ||
      isGapNetworkNarrativeEnrichmentTerminal(document.metadata))
  );
}

/**
 * A gap-network build has terminally failed: the row status is `failed` or the
 * deterministic core marker is `failed`. Shared by the client view, status
 * polling, and the status route so the "failed" boundary stays single-sourced
 * like the other gap-network predicates.
 */
export function isGapNetworkBuildFailed(
  document: ResearchRoutePayload | null | undefined,
): boolean {
  return (
    document != null &&
    document.type === "gap_network" &&
    (document.status === "failed" || document.metadata.gapNetworkBuild?.core === "failed")
  );
}

export function buildPendingGapNetworkMetadata(params: {
  sourceSnapshotId: string;
  query: string;
  queryClauses?: SearchMetadata["queryClauses"];
  papers: SearchMetadata["papers"];
  graphSupport?: GapNetworkGraphSupportMetadata;
  now?: string;
}): GapNetworkMetadata {
  const timestamp = params.now ?? new Date().toISOString();
  const papers = toGraphPaperSnapshots(params.query, params.queryClauses, params.papers);
  return {
    type: "gap_network",
    version: 1,
    sourceSnapshotId: params.sourceSnapshotId,
    query: params.query,
    papers,
    ...(params.graphSupport ? { sourceGraphSupport: params.graphSupport } : {}),
    gapNetworkReport: createEmptyGapNetworkReport(),
    gapNetworkBuild: {
      core: "pending",
      enrichment: "pending",
      phase: "queued",
      attempt: 0,
      updatedAt: timestamp,
    },
  };
}
