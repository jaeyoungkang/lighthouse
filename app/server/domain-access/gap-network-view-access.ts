import type {
  GapNetworkResearchRoutePayload,
  ResearchRoutePayload,
  GapNetworkMetadata,
} from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { NotFoundError } from "@/app/server/auth/auth-errors";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import {
  getGapReportUnchecked,
  reserveGapReportUnchecked,
} from "@/app/server/repository/gap-reports";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  buildGapNetworkEnrichedViewPayloadFromCore,
  buildGapNetworkCoreViewPayload,
} from "@/app/server/services/gap-network-builder";
import { createLlmJudgmentUsageLedgerForTrustedAgent } from "@/app/server/domain-access/llm-usage-access";
import type { LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import { persistSearchBackedKnowledgeMapDocument } from "@/app/server/domain-access/search-backed-knowledge-map-persistence";
import {
  buildPendingGapNetworkMetadata,
  PENDING_GAP_NETWORK_DOCUMENT_TITLE,
  hasCurrentGapNetworkCoreEvidence,
  isGapNetworkNarrativeEnrichmentTerminal,
  isSettledGapNetworkView,
  needsGapNetworkNarrativeEnrichment,
} from "@/app/lib/gap-network-view-core";
import {
  type GapNetworkBuildPhase,
  type GapNetworkEnrichmentRetryQueueResult,
  isGapNetworkResearchRoutePayload,
  markGapNetworkBuildAttemptStarted,
  markGapNetworkBuildFailed,
  markGapNetworkBuildRetryQueued,
  markGapNetworkEnrichmentFailed,
  inspectGapNetworkEnrichmentRetryState,
  queueGapNetworkEnrichmentRetry,
  persistGapNetworkBuildStateDetails,
  runMeasuredPhase,
  withBuildStateDetails,
} from "@/app/server/domain-access/gap-network-build-state";
import {
  admitGapBuildForPrincipal,
  releaseGapBuildForPrincipalSafely,
  type GapBuildPrincipalAdmission,
} from "@/app/server/domain-access/gap-build-principal-admission";
import {
  buildGapNetworkBuildSourceFromStoredSnapshot,
  buildCanonicalGapNetworkSourceSnapshot,
  buildGapNetworkBuildSourceFromSnapshot,
  type GapNetworkBuildSourceMetadata,
  type GapNetworkSourceSnapshotInput,
} from "@/app/server/domain-access/gap-network-view-input";
import { buildGapReportSourceInputDigest } from "@/app/server/domain-access/gap-report-source-identity";

const inFlightGapNetworkCoreBuilds = new Map<string, Promise<GapNetworkResearchRoutePayload>>();
const inFlightGapNetworkReservations = new Map<string, Promise<GapNetworkResearchRoutePayload>>();
const inFlightGapNetworkEnrichments = new Map<string, Promise<GapNetworkResearchRoutePayload>>();
const inFlightGapNetworkBuildJobs = new Map<string, Promise<void>>();

function createGapNetworkEnrichmentUsageLedger(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  gapReportId: string;
  retryCount: number;
}): LLMJudgmentUsageLedger {
  const ledger = createLlmJudgmentUsageLedgerForTrustedAgent({
    db: params.db,
    ownerPrincipalId: params.runtimePrincipalId,
  });
  return {
    record: (event) =>
      ledger.record({
        ...event,
        metadata: {
          ...event.metadata,
          phase: "enrichment",
          mode:
            params.retryCount > 0
              ? `gap-report:${params.gapReportId}:retry-${String(params.retryCount)}`
              : `gap-report:${params.gapReportId}:initial`,
        },
      }),
  };
}

function prepareGapNetworkBuildInput(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  sourceSnapshotId: string;
  metadata: GapNetworkBuildSourceMetadata;
  createdBy: "user" | "agent";
  citationLineageBreakdown?: GapNetworkMetadata["sourceCitationLineageBreakdown"];
}) {
  return {
    viewerPrincipalId: params.runtimePrincipalId,
    sourceSnapshotId: params.sourceSnapshotId,
    query: params.metadata.query,
    queryClauses: params.metadata.queryClauses,
    papers: params.metadata.papers,
    graphSupport: params.metadata.graphSupport,
    createdBy: params.createdBy,
    citationLineageBreakdown: params.citationLineageBreakdown,
    usageLedger: createLlmJudgmentUsageLedgerForTrustedAgent({
      db: params.db,
      ownerPrincipalId: params.runtimePrincipalId,
    }),
  };
}

export async function reserveGapNetworkViewFromSnapshot(
  input: GapNetworkSourceSnapshotInput,
): Promise<GapNetworkResearchRoutePayload> {
  const { db, user } = await requireOwnerPrincipalAuth();
  const canonicalInput = buildCanonicalGapNetworkSourceSnapshot(input);
  const sourceInputDigest = buildGapReportSourceInputDigest(input);
  const dedupeKey = `reserve:${sourceInputDigest}`;
  const inFlight = inFlightGapNetworkReservations.get(dedupeKey);
  if (inFlight) {
    return { ...(await inFlight), viewerPrincipalId: user.id };
  }

  const reservePromise = (async () => {
    const baseMetadata = buildGapNetworkBuildSourceFromSnapshot(canonicalInput);
    const pendingMetadata = buildPendingGapNetworkMetadata({
      sourceSnapshotId: canonicalInput.sourceSnapshotId,
      query: baseMetadata.query,
      queryClauses: baseMetadata.queryClauses,
      papers: baseMetadata.papers,
      graphSupport: baseMetadata.graphSupport,
    });

    return reserveGapReportUnchecked(
      db,
      {
        type: "gap_network",
        title: PENDING_GAP_NETWORK_DOCUMENT_TITLE,
        content: "",
        createdBy: canonicalInput.createdBy,
        metadata: pendingMetadata,
        refs: [canonicalInput.sourceSnapshotId],
        viewerPrincipalId: user.id,
        status: "pending",
      },
      sourceInputDigest,
    );
  })();

  inFlightGapNetworkReservations.set(dedupeKey, reservePromise);
  try {
    return { ...(await reservePromise), viewerPrincipalId: user.id };
  } finally {
    if (inFlightGapNetworkReservations.get(dedupeKey) === reservePromise) {
      inFlightGapNetworkReservations.delete(dedupeKey);
    }
  }
}

export async function queueGapNetworkBuildRetryIfFailed(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  document: ResearchRoutePayload;
}): Promise<ResearchRoutePayload> {
  if (!isGapNetworkResearchRoutePayload(params.document)) {
    return params.document;
  }

  return markGapNetworkBuildRetryQueued({
    db: params.db,
    runtimePrincipalId: params.runtimePrincipalId,
    document: params.document,
  });
}

export async function requestGapNetworkEnrichmentRetry(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  gapReportId: string;
  nowMs?: number;
}): Promise<
  | GapNetworkEnrichmentRetryQueueResult
  | {
      document: GapNetworkResearchRoutePayload;
      outcome: "principal-blocked" | "same-report-active";
      retryCount: number;
      retryAfterSeconds: number;
      activeGapReportId: string;
    }
  | null
> {
  const document = await getGapReportUnchecked(
    params.db,
    params.gapReportId,
    params.runtimePrincipalId,
  );
  if (!document || !isGapNetworkResearchRoutePayload(document)) return null;

  const current = inspectGapNetworkEnrichmentRetryState(document, params.nowMs ?? Date.now());
  if (current.outcome !== "available") return current;

  const admission = await admitGapBuildForPrincipal({
    db: params.db,
    principalId: params.runtimePrincipalId,
    gapReportId: document.id,
  });
  if (admission.outcome !== "acquired") {
    return {
      document,
      outcome: admission.outcome === "blocked" ? "principal-blocked" : "same-report-active",
      retryCount: current.retryCount,
      retryAfterSeconds: admission.retryAfterSeconds,
      activeGapReportId: admission.activeGapReportId,
    };
  }

  let queued: GapNetworkEnrichmentRetryQueueResult;
  try {
    queued = await queueGapNetworkEnrichmentRetry({
      db: params.db,
      runtimePrincipalId: params.runtimePrincipalId,
      document,
      nowMs: params.nowMs,
    });
  } catch (error) {
    await releaseGapBuildForPrincipalSafely({
      db: params.db,
      principalId: params.runtimePrincipalId,
      gapReportId: document.id,
      leaseToken: admission.leaseToken,
    });
    throw error;
  }
  if (queued.outcome !== "queued") {
    await releaseGapBuildForPrincipalSafely({
      db: params.db,
      principalId: params.runtimePrincipalId,
      gapReportId: document.id,
      leaseToken: admission.leaseToken,
    });
    return queued;
  }
  return { ...queued, admission };
}

function shouldReturnCurrentGapNetworkCoreView(document: ResearchRoutePayload): boolean {
  return (
    document.metadata.type === "gap_network" &&
    isSettledGapNetworkView(document) &&
    hasCurrentGapNetworkCoreEvidence(document.metadata)
  );
}

function shouldReturnEnrichedGapNetworkView(document: ResearchRoutePayload): boolean {
  return (
    document.metadata.type === "gap_network" &&
    isSettledGapNetworkView(document) &&
    (!document.metadata.gapNetworkBuild || document.metadata.gapNetworkBuild.enrichment === "ready")
  );
}

async function refreshGapNetworkCoreView(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  targetView: GapNetworkResearchRoutePayload;
  phaseDurations?: Partial<Record<GapNetworkBuildPhase, number>>;
}): Promise<GapNetworkResearchRoutePayload> {
  if (shouldReturnCurrentGapNetworkCoreView(params.targetView)) {
    return params.targetView;
  }

  const durations = params.phaseDurations ?? {};
  const sourcePaperKey = params.targetView.metadata.papers.map((paper) => paper.paperId).join(",");
  const dedupeKey = `${params.targetView.id}:refresh-core:${sourcePaperKey}`;
  const inFlight = inFlightGapNetworkCoreBuilds.get(dedupeKey);
  if (inFlight) {
    return inFlight;
  }

  const buildPromise = (async () => {
    const latest = await getGapReportUnchecked(
      params.db,
      params.targetView.id,
      params.runtimePrincipalId,
    );
    if (!latest) {
      throw new NotFoundError(t("document.label.research-route-access"));
    }
    if (shouldReturnCurrentGapNetworkCoreView(latest)) {
      return latest;
    }

    const buildInput = prepareGapNetworkBuildInput({
      db: params.db,
      runtimePrincipalId: params.runtimePrincipalId,
      sourceSnapshotId: latest.metadata.sourceSnapshotId,
      metadata: buildGapNetworkBuildSourceFromStoredSnapshot({
        ...latest,
        metadata: latest.metadata,
      }),
      createdBy: latest.createdBy,
      citationLineageBreakdown: latest.metadata.sourceCitationLineageBreakdown,
    });
    const payload = await runMeasuredPhase("core-build", durations, () =>
      buildGapNetworkCoreViewPayload(buildInput),
    );
    const payloadWithStateDetails = withBuildStateDetails(payload, {
      baseBuild: latest.metadata.gapNetworkBuild,
      durations,
      phase: "persist",
    });
    const buildOwnership = {
      attempt: latest.metadata.gapNetworkBuild?.attempt,
      leaseExpiresAt: latest.metadata.gapNetworkBuild?.leaseExpiresAt,
    };
    const persisted = await runMeasuredPhase("persist", durations, () =>
      persistSearchBackedKnowledgeMapDocument(params.db, latest, payloadWithStateDetails, {
        buildOwnership,
      }),
    );
    return persistGapNetworkBuildStateDetails({
      db: params.db,
      runtimePrincipalId: params.runtimePrincipalId,
      document: persisted,
      durations,
      phase: "enrichment",
    });
  })();

  inFlightGapNetworkCoreBuilds.set(dedupeKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    if (inFlightGapNetworkCoreBuilds.get(dedupeKey) === buildPromise) {
      inFlightGapNetworkCoreBuilds.delete(dedupeKey);
    }
  }
}

async function enrichGapNetworkView(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  gapNetworkDocumentId: string;
  phaseDurations?: Partial<Record<GapNetworkBuildPhase, number>>;
}): Promise<GapNetworkResearchRoutePayload> {
  const durations = params.phaseDurations ?? {};
  const dedupeKey = params.gapNetworkDocumentId;
  const inFlight = inFlightGapNetworkEnrichments.get(dedupeKey);
  if (inFlight) {
    return inFlight;
  }

  const enrichPromise = (async () => {
    const existing = await getGapReportUnchecked(
      params.db,
      params.gapNetworkDocumentId,
      params.runtimePrincipalId,
    );
    if (!existing || !isGapNetworkResearchRoutePayload(existing)) {
      throw new NotFoundError(t("document.label.research-route-access"));
    }

    if (
      !existing.metadata.gapNetworkBuild ||
      !shouldReturnCurrentGapNetworkCoreView(existing) ||
      shouldReturnEnrichedGapNetworkView(existing)
    ) {
      return existing;
    }

    try {
      const retryCount = existing.metadata.gapNetworkBuild.enrichmentRetryCount ?? 0;
      const payload = await runMeasuredPhase("enrichment", durations, () =>
        buildGapNetworkEnrichedViewPayloadFromCore(
          {
            ...existing,
            metadata: existing.metadata,
          },
          {},
          {
            usageLedger: createGapNetworkEnrichmentUsageLedger({
              db: params.db,
              runtimePrincipalId: params.runtimePrincipalId,
              gapReportId: existing.id,
              retryCount,
            }),
          },
        ),
      );
      const payloadWithStateDetails = withBuildStateDetails(payload, {
        baseBuild: existing.metadata.gapNetworkBuild,
        durations,
        phase: "complete",
      });
      return await persistSearchBackedKnowledgeMapDocument(
        params.db,
        existing,
        payloadWithStateDetails,
        {
          buildOwnership: {
            attempt: existing.metadata.gapNetworkBuild.attempt,
            leaseExpiresAt: existing.metadata.gapNetworkBuild.leaseExpiresAt,
          },
        },
      );
    } catch {
      return markGapNetworkEnrichmentFailed(params.db, params.runtimePrincipalId, {
        ...existing,
        metadata: existing.metadata,
      });
    }
  })();

  inFlightGapNetworkEnrichments.set(dedupeKey, enrichPromise);

  try {
    return await enrichPromise;
  } finally {
    if (inFlightGapNetworkEnrichments.get(dedupeKey) === enrichPromise) {
      inFlightGapNetworkEnrichments.delete(dedupeKey);
    }
  }
}

async function runGapNetworkBuildJob(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  gapReportId: string;
}): Promise<void> {
  const durations: Partial<Record<GapNetworkBuildPhase, number>> = {};
  const existing = await getGapReportUnchecked(
    params.db,
    params.gapReportId,
    params.runtimePrincipalId,
  );
  if (!existing || !isGapNetworkResearchRoutePayload(existing)) {
    return;
  }

  const attemptStart = await markGapNetworkBuildAttemptStarted({
    db: params.db,
    runtimePrincipalId: params.runtimePrincipalId,
    document: existing,
  });
  if (!attemptStart.acquired) {
    return;
  }

  const buildAttempt = attemptStart.document.metadata.gapNetworkBuild;
  let document: ResearchRoutePayload = attemptStart.document;
  if (!isGapNetworkResearchRoutePayload(document)) {
    return;
  }

  try {
    if (!shouldReturnCurrentGapNetworkCoreView(document)) {
      document = await refreshGapNetworkCoreView({
        db: params.db,
        runtimePrincipalId: params.runtimePrincipalId,
        targetView: document,
        phaseDurations: durations,
      });
    }

    if (!isGapNetworkResearchRoutePayload(document) || !isSettledGapNetworkView(document)) {
      return;
    }

    if (
      needsGapNetworkNarrativeEnrichment(document.metadata) &&
      !isGapNetworkNarrativeEnrichmentTerminal(document.metadata)
    ) {
      const enriched = await enrichGapNetworkView({
        db: params.db,
        runtimePrincipalId: params.runtimePrincipalId,
        gapNetworkDocumentId: document.id,
        phaseDurations: durations,
      });
      const retryCount = enriched.metadata.gapNetworkBuild?.enrichmentRetryCount ?? 0;
      if (retryCount > 0) {
        console.info("[gap-network-enrichment-retry]", {
          gapReportId: enriched.id,
          retryCount,
          buildAttempt: enriched.metadata.gapNetworkBuild?.attempt ?? null,
          result: enriched.metadata.gapNetworkBuild?.enrichment ?? "failed",
          durationMs: durations.enrichment ?? null,
        });
      }
      return;
    }

    await persistGapNetworkBuildStateDetails({
      db: params.db,
      runtimePrincipalId: params.runtimePrincipalId,
      document,
      durations,
      phase: "complete",
    });
  } catch (error) {
    await markGapNetworkBuildFailed({
      db: params.db,
      runtimePrincipalId: params.runtimePrincipalId,
      documentId: params.gapReportId,
      durations,
      attempt: buildAttempt?.attempt,
      leaseExpiresAt: buildAttempt?.leaseExpiresAt,
    });
    throw error;
  }
}

export function startGapNetworkBuildJob(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  gapReportId: string;
  admission?: Extract<GapBuildPrincipalAdmission, { outcome: "acquired" }>;
}): Promise<void> {
  const dedupeKey = params.gapReportId;
  const inFlight = inFlightGapNetworkBuildJobs.get(dedupeKey);
  if (inFlight) {
    if (!params.admission) return inFlight;
    return releaseGapBuildForPrincipalSafely({
      db: params.db,
      principalId: params.runtimePrincipalId,
      gapReportId: params.gapReportId,
      leaseToken: params.admission.leaseToken,
    }).then(() => inFlight);
  }

  const job = runGapNetworkBuildJob(params)
    .catch((error: unknown) => {
      console.warn("[gap-network-build] job failed", {
        gapReportId: params.gapReportId,
        error,
      });
    })
    .finally(() => {
      if (inFlightGapNetworkBuildJobs.get(dedupeKey) === job) {
        inFlightGapNetworkBuildJobs.delete(dedupeKey);
      }
      if (params.admission) {
        return releaseGapBuildForPrincipalSafely({
          db: params.db,
          principalId: params.runtimePrincipalId,
          gapReportId: params.gapReportId,
          leaseToken: params.admission.leaseToken,
        }).then(() => undefined);
      }
    });
  inFlightGapNetworkBuildJobs.set(dedupeKey, job);
  return job;
}
