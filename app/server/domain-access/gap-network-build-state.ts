import type {
  CreateResearchRoutePayloadParams,
  GapNetworkMetadata,
  GapNetworkResearchRoutePayload,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import {
  getGapNetworkEnrichmentRetryCooldownRemainingSeconds,
  isSettledGapNetworkView,
  needsGapNetworkNarrativeEnrichment,
} from "@/app/lib/gap-network-view-core";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  getGapReportUnchecked,
  updateGapReportIfVersionUnchecked,
} from "@/app/server/repository/gap-reports";
import type { AcquiredGapBuildPrincipalAdmission } from "@/app/server/domain-access/gap-build-principal-admission";

export type GapNetworkBuildPhase = "graph-support" | "core-build" | "persist" | "enrichment";

type GapNetworkPhaseDurations = NonNullable<
  NonNullable<GapNetworkMetadata["gapNetworkBuild"]>["phaseDurationsMs"]
>;
export type GapNetworkRecordedPhase = NonNullable<GapNetworkMetadata["gapNetworkBuild"]>["phase"];

// The route budget is 60 seconds. A lease only needs a short grace beyond that
// budget so a detached viewer can reclaim work after a process loss instead of
// leaving the globally shared artifact poisoned for ten minutes.
export const GAP_NETWORK_BUILD_LEASE_MS = 70_000;

export type GapNetworkBuildAttemptStart = {
  document: GapNetworkResearchRoutePayload;
  acquired: boolean;
};

export type GapNetworkEnrichmentRetryQueueResult = {
  document: GapNetworkResearchRoutePayload;
  outcome: "available" | "queued" | "pending" | "ready" | "not-retryable" | "cooldown";
  retryCount: number;
  retryAfterSeconds?: number;
  admission?: AcquiredGapBuildPrincipalAdmission;
};

export function isGapNetworkResearchRoutePayload(
  view: ResearchRoutePayload,
): view is GapNetworkResearchRoutePayload {
  return view.type === "gap_network";
}

export async function runMeasuredPhase<T>(
  phase: GapNetworkBuildPhase,
  durations: Partial<Record<GapNetworkBuildPhase, number>>,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await action();
  } finally {
    durations[phase] = Math.max(Date.now() - startedAt, 0);
    console.info("[gap-network-build]", {
      phase,
      durationMs: durations[phase],
    });
  }
}

function normalizePhaseDurations(
  durations: Partial<Record<GapNetworkBuildPhase, number>>,
): GapNetworkPhaseDurations {
  return {
    ...(typeof durations["graph-support"] === "number"
      ? { "graph-support": durations["graph-support"] }
      : {}),
    ...(typeof durations["core-build"] === "number"
      ? { "core-build": durations["core-build"] }
      : {}),
    ...(typeof durations.persist === "number" ? { persist: durations.persist } : {}),
    ...(typeof durations.enrichment === "number" ? { enrichment: durations.enrichment } : {}),
  };
}

function hasActiveGapNetworkBuildLease(
  build: GapNetworkMetadata["gapNetworkBuild"],
  nowMs = Date.now(),
): boolean {
  if (!build?.leaseExpiresAt || build.phase === "failed" || build.phase === "complete") {
    return false;
  }

  const leaseExpiresAt = Date.parse(build.leaseExpiresAt);
  return Number.isFinite(leaseExpiresAt) && leaseExpiresAt > nowMs;
}

export function withBuildStateDetails<T extends CreateResearchRoutePayloadParams>(
  payload: T,
  params: {
    baseBuild?: GapNetworkMetadata["gapNetworkBuild"];
    durations?: Partial<Record<GapNetworkBuildPhase, number>>;
    phase?: GapNetworkRecordedPhase;
  },
): T {
  if (payload.type !== "gap_network") {
    return payload;
  }
  const phaseDurationsMs = params.durations ? normalizePhaseDurations(params.durations) : {};
  const hasPhaseDurations = Object.keys(phaseDurationsMs).length > 0;
  return {
    ...payload,
    metadata: {
      ...payload.metadata,
      gapNetworkBuild: payload.metadata.gapNetworkBuild
        ? {
            ...(params.baseBuild?.attempt !== undefined
              ? { attempt: params.baseBuild.attempt }
              : {}),
            ...(params.baseBuild?.enrichmentRetryCount !== undefined
              ? { enrichmentRetryCount: params.baseBuild.enrichmentRetryCount }
              : {}),
            ...(params.baseBuild?.leaseExpiresAt
              ? { leaseExpiresAt: params.baseBuild.leaseExpiresAt }
              : {}),
            ...payload.metadata.gapNetworkBuild,
            ...(params.phase ? { phase: params.phase } : {}),
            ...(hasPhaseDurations
              ? {
                  phaseDurationsMs: {
                    ...params.baseBuild?.phaseDurationsMs,
                    ...payload.metadata.gapNetworkBuild.phaseDurationsMs,
                    ...phaseDurationsMs,
                  },
                }
              : {}),
          }
        : payload.metadata.gapNetworkBuild,
    },
  } as T;
}

export async function markGapNetworkBuildAttemptStarted(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  document: GapNetworkResearchRoutePayload;
}): Promise<GapNetworkBuildAttemptStart> {
  const startedAt = new Date().toISOString();
  const currentBuild = params.document.metadata.gapNetworkBuild;
  const hasSettledCore =
    currentBuild?.core !== "failed" && isSettledGapNetworkView(params.document);
  if (
    (currentBuild?.phase === "complete" && hasSettledCore) ||
    hasActiveGapNetworkBuildLease(currentBuild)
  ) {
    return { document: params.document, acquired: false };
  }

  const attempt = (currentBuild?.attempt ?? 0) + 1;
  const phase: GapNetworkRecordedPhase = hasSettledCore ? "enrichment" : "core-build";
  const updated = await updateGapReportIfVersionUnchecked(
    params.db,
    params.document.id,
    params.document.version,
    {
      status: hasSettledCore ? params.document.status : "pending",
      metadata: {
        ...params.document.metadata,
        gapNetworkBuild: {
          core: hasSettledCore ? "ready" : "pending",
          enrichment: hasSettledCore ? (currentBuild?.enrichment ?? "pending") : "pending",
          ...(currentBuild?.coreEvidence ? { coreEvidence: currentBuild.coreEvidence } : {}),
          ...(currentBuild?.phaseDurationsMs
            ? { phaseDurationsMs: currentBuild.phaseDurationsMs }
            : {}),
          ...(currentBuild?.enrichmentRetryCount !== undefined
            ? { enrichmentRetryCount: currentBuild.enrichmentRetryCount }
            : {}),
          phase,
          attempt,
          leaseExpiresAt: new Date(Date.now() + GAP_NETWORK_BUILD_LEASE_MS).toISOString(),
          updatedAt: startedAt,
        },
      },
      version: params.document.version + 1,
    },
    params.runtimePrincipalId,
  );
  if (updated && isGapNetworkResearchRoutePayload(updated)) {
    return { document: updated, acquired: true };
  }

  const latest = await getGapReportUnchecked(
    params.db,
    params.document.id,
    params.runtimePrincipalId,
  );
  if (latest && isGapNetworkResearchRoutePayload(latest)) {
    return { document: latest, acquired: false };
  }

  return { document: params.document, acquired: false };
}

export function inspectGapNetworkEnrichmentRetryState(
  document: GapNetworkResearchRoutePayload,
  nowMs: number,
): GapNetworkEnrichmentRetryQueueResult {
  const build = document.metadata.gapNetworkBuild;
  const retryCount = build?.enrichmentRetryCount ?? 0;
  if (
    build?.core !== "ready" ||
    !isSettledGapNetworkView(document) ||
    !needsGapNetworkNarrativeEnrichment(document.metadata)
  ) {
    return { document, outcome: "not-retryable", retryCount };
  }
  if (build.enrichment === "ready") {
    return { document, outcome: "ready", retryCount };
  }
  if (build.enrichment === "pending") {
    return { document, outcome: "pending", retryCount };
  }

  const retryAfterSeconds = getGapNetworkEnrichmentRetryCooldownRemainingSeconds(
    document.metadata,
    nowMs,
  );
  if (retryAfterSeconds > 0) {
    return { document, outcome: "cooldown", retryCount, retryAfterSeconds };
  }
  return { document, outcome: "available", retryCount };
}

export async function queueGapNetworkEnrichmentRetry(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  document: GapNetworkResearchRoutePayload;
  nowMs?: number;
}): Promise<GapNetworkEnrichmentRetryQueueResult> {
  const nowMs = params.nowMs ?? Date.now();
  const current = inspectGapNetworkEnrichmentRetryState(params.document, nowMs);
  const build = params.document.metadata.gapNetworkBuild;
  if (current.outcome !== "available" || build?.enrichment !== "failed") {
    return current;
  }

  const retryCount = current.retryCount + 1;
  const updated = await updateGapReportIfVersionUnchecked(
    params.db,
    params.document.id,
    params.document.version,
    {
      status: "ready",
      metadata: {
        ...params.document.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "queued",
          ...(build.coreEvidence ? { coreEvidence: build.coreEvidence } : {}),
          ...(build.attempt !== undefined ? { attempt: build.attempt } : {}),
          ...(build.phaseDurationsMs ? { phaseDurationsMs: build.phaseDurationsMs } : {}),
          enrichmentRetryCount: retryCount,
          updatedAt: new Date(nowMs).toISOString(),
        },
      },
      version: params.document.version + 1,
    },
    params.runtimePrincipalId,
  );
  if (updated && isGapNetworkResearchRoutePayload(updated)) {
    return { document: updated, outcome: "queued", retryCount };
  }

  const latest = await getGapReportUnchecked(
    params.db,
    params.document.id,
    params.runtimePrincipalId,
  );
  if (latest && isGapNetworkResearchRoutePayload(latest)) {
    return inspectGapNetworkEnrichmentRetryState(latest, nowMs);
  }
  return current;
}

export async function markGapNetworkBuildRetryQueued(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  document: GapNetworkResearchRoutePayload;
}): Promise<GapNetworkResearchRoutePayload> {
  const currentBuild = params.document.metadata.gapNetworkBuild;
  if (currentBuild?.core !== "failed") {
    return params.document;
  }

  const updated = await updateGapReportIfVersionUnchecked(
    params.db,
    params.document.id,
    params.document.version,
    {
      status: "pending",
      metadata: {
        ...params.document.metadata,
        gapNetworkBuild: {
          core: "pending",
          enrichment: "pending",
          phase: "queued",
          ...(currentBuild.attempt !== undefined ? { attempt: currentBuild.attempt } : {}),
          updatedAt: new Date().toISOString(),
        },
      },
      version: params.document.version + 1,
    },
    params.runtimePrincipalId,
  );
  if (updated && isGapNetworkResearchRoutePayload(updated)) {
    return updated;
  }

  const latest = await getGapReportUnchecked(
    params.db,
    params.document.id,
    params.runtimePrincipalId,
  );
  if (latest && isGapNetworkResearchRoutePayload(latest)) {
    return latest;
  }

  return params.document;
}

export async function persistGapNetworkBuildStateDetails(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  document: GapNetworkResearchRoutePayload;
  durations?: Partial<Record<GapNetworkBuildPhase, number>>;
  phase?: GapNetworkRecordedPhase;
}): Promise<GapNetworkResearchRoutePayload> {
  if (!params.document.metadata.gapNetworkBuild) {
    return params.document;
  }

  const phaseDurationsMs = params.durations ? normalizePhaseDurations(params.durations) : {};
  const hasPhaseDurations = Object.keys(phaseDurationsMs).length > 0;
  const hasDetails = params.phase || hasPhaseDurations;
  if (!hasDetails) {
    return params.document;
  }

  const updated = await updateGapReportIfVersionUnchecked(
    params.db,
    params.document.id,
    params.document.version,
    {
      metadata: {
        ...params.document.metadata,
        gapNetworkBuild: {
          ...params.document.metadata.gapNetworkBuild,
          ...(params.phase ? { phase: params.phase } : {}),
          ...(hasPhaseDurations
            ? {
                phaseDurationsMs: {
                  ...params.document.metadata.gapNetworkBuild.phaseDurationsMs,
                  ...phaseDurationsMs,
                },
              }
            : {}),
          updatedAt: new Date().toISOString(),
        },
      },
      version: params.document.version + 1,
    },
    params.runtimePrincipalId,
  );
  if (updated) {
    return updated;
  }

  const latest = await getGapReportUnchecked(
    params.db,
    params.document.id,
    params.runtimePrincipalId,
  );
  return latest ?? params.document;
}

export async function markGapNetworkEnrichmentFailed(
  db: RepositoryDbHandle,
  runtimePrincipalId: string,
  document: GapNetworkResearchRoutePayload,
): Promise<GapNetworkResearchRoutePayload> {
  const updated = await updateGapReportIfVersionUnchecked(
    db,
    document.id,
    document.version,
    {
      metadata: {
        ...document.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          ...(document.metadata.gapNetworkBuild?.coreEvidence
            ? { coreEvidence: document.metadata.gapNetworkBuild.coreEvidence }
            : {}),
          ...(document.metadata.gapNetworkBuild?.attempt !== undefined
            ? { attempt: document.metadata.gapNetworkBuild.attempt }
            : {}),
          ...(document.metadata.gapNetworkBuild?.enrichmentRetryCount !== undefined
            ? { enrichmentRetryCount: document.metadata.gapNetworkBuild.enrichmentRetryCount }
            : {}),
          ...(document.metadata.gapNetworkBuild?.leaseExpiresAt
            ? { leaseExpiresAt: document.metadata.gapNetworkBuild.leaseExpiresAt }
            : {}),
          ...(document.metadata.gapNetworkBuild?.phaseDurationsMs
            ? { phaseDurationsMs: document.metadata.gapNetworkBuild.phaseDurationsMs }
            : {}),
          updatedAt: new Date().toISOString(),
        },
      },
      version: document.version + 1,
    },
    runtimePrincipalId,
  );
  if (updated) {
    return updated;
  }

  const latest = await getGapReportUnchecked(db, document.id, runtimePrincipalId);
  if (latest) {
    return latest;
  }

  return document;
}

export async function markGapNetworkBuildFailed(params: {
  db: RepositoryDbHandle;
  runtimePrincipalId: string;
  documentId: string;
  durations?: Partial<Record<GapNetworkBuildPhase, number>>;
  attempt?: number;
  leaseExpiresAt?: string;
}): Promise<ResearchRoutePayload | null> {
  const latest = await getGapReportUnchecked(
    params.db,
    params.documentId,
    params.runtimePrincipalId,
  );
  if (!latest || !isGapNetworkResearchRoutePayload(latest)) {
    return null;
  }

  const currentBuild = latest.metadata.gapNetworkBuild;
  if (
    (params.attempt !== undefined && currentBuild?.attempt !== params.attempt) ||
    (params.leaseExpiresAt && currentBuild?.leaseExpiresAt !== params.leaseExpiresAt) ||
    currentBuild?.phase === "complete" ||
    currentBuild?.enrichment === "ready"
  ) {
    return latest;
  }

  const phaseDurationsMs = params.durations ? normalizePhaseDurations(params.durations) : {};
  const hasPhaseDurations = Object.keys(phaseDurationsMs).length > 0;
  const updated = await updateGapReportIfVersionUnchecked(
    params.db,
    latest.id,
    latest.version,
    {
      status: currentBuild?.core === "ready" ? "ready" : "failed",
      metadata: {
        ...latest.metadata,
        gapNetworkBuild: {
          core: currentBuild?.core === "ready" ? "ready" : "failed",
          enrichment: "failed",
          phase: "failed",
          ...(currentBuild?.coreEvidence ? { coreEvidence: currentBuild.coreEvidence } : {}),
          ...(currentBuild?.attempt !== undefined ? { attempt: currentBuild.attempt } : {}),
          ...(currentBuild?.enrichmentRetryCount !== undefined
            ? { enrichmentRetryCount: currentBuild.enrichmentRetryCount }
            : {}),
          ...(currentBuild?.leaseExpiresAt ? { leaseExpiresAt: currentBuild.leaseExpiresAt } : {}),
          ...(hasPhaseDurations || currentBuild?.phaseDurationsMs
            ? {
                phaseDurationsMs: {
                  ...currentBuild?.phaseDurationsMs,
                  ...phaseDurationsMs,
                },
              }
            : {}),
          updatedAt: new Date().toISOString(),
        },
      },
      version: latest.version + 1,
    },
    params.runtimePrincipalId,
  );

  return updated ?? latest;
}
