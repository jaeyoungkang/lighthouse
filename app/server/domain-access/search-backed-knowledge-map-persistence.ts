import type {
  CreateResearchRoutePayloadParams,
  GapNetworkCreateResearchRoutePayloadParams,
  GapNetworkResearchRoutePayload,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  createGapReportUnchecked,
  getGapReportUnchecked,
  updateGapReportIfVersionUnchecked,
} from "@/app/server/repository/gap-reports";

type GapNetworkBuildOwnership = {
  attempt?: number;
  leaseExpiresAt?: string;
};

export async function persistSearchBackedKnowledgeMapDocument(
  db: RepositoryDbHandle,
  existing: ResearchRoutePayload | null,
  payload: CreateResearchRoutePayloadParams,
  options: { buildOwnership?: GapNetworkBuildOwnership; sourceInputDigest?: string } = {},
): Promise<GapNetworkResearchRoutePayload> {
  if (payload.type !== "gap_network") {
    throw new Error("search-backed knowledge maps must persist as gap_reports");
  }
  const gapPayload: GapNetworkCreateResearchRoutePayloadParams = {
    ...payload,
    type: "gap_network",
    metadata: payload.metadata,
  };

  if (!existing) {
    if (!options.sourceInputDigest) {
      throw new Error("gap report creation requires a source input digest");
    }
    return createGapReportUnchecked(db, gapPayload, options.sourceInputDigest);
  }

  if (
    existing.type === "gap_network" &&
    existing.metadata.gapNetworkBuild?.enrichment === "ready" &&
    gapPayload.metadata.gapNetworkBuild?.enrichment === "pending" &&
    gapNetworkInputMatchesPayload(existing, gapPayload)
  ) {
    return existing;
  }

  return updateExistingSearchBackedKnowledgeMapDocument(db, existing, gapPayload, options);
}

function canUseConcurrentKnowledgeMapDocument(
  document: ResearchRoutePayload,
  payload: GapNetworkCreateResearchRoutePayloadParams,
) {
  return (
    document.type === "gap_network" &&
    document.metadata.gapNetworkBuild?.enrichment === "ready" &&
    gapNetworkInputMatchesPayload(document, payload)
  );
}

function gapNetworkInputMatchesPayload(
  document: ResearchRoutePayload,
  payload: GapNetworkCreateResearchRoutePayloadParams,
) {
  if (document.type !== "gap_network") {
    return true;
  }

  if (document.metadata.sourceSnapshotId !== payload.metadata.sourceSnapshotId) {
    return false;
  }

  const documentPaperIds = document.metadata.papers.map((paper) => paper.paperId);
  const payloadPaperIds = payload.metadata.papers.map((paper) => paper.paperId);
  return (
    documentPaperIds.length === payloadPaperIds.length &&
    documentPaperIds.every((paperId, index) => paperId === payloadPaperIds[index])
  );
}

function isPersistableKnowledgeMapDocumentForPayload(
  document: ResearchRoutePayload | null,
  payload: GapNetworkCreateResearchRoutePayloadParams,
): document is GapNetworkResearchRoutePayload {
  return (
    document !== null &&
    document.type === payload.type &&
    gapNetworkInputMatchesPayload(document, payload)
  );
}

function hasGapNetworkBuildOwnership(
  document: ResearchRoutePayload,
  ownership: GapNetworkBuildOwnership | undefined,
): boolean {
  if (!ownership) {
    return true;
  }
  if (document.type !== "gap_network") {
    return true;
  }

  const build = document.metadata.gapNetworkBuild;
  return (
    (ownership.attempt === undefined || build?.attempt === ownership.attempt) &&
    (!ownership.leaseExpiresAt || build?.leaseExpiresAt === ownership.leaseExpiresAt)
  );
}

async function updateExistingSearchBackedKnowledgeMapDocument(
  db: RepositoryDbHandle,
  existing: ResearchRoutePayload,
  payload: GapNetworkCreateResearchRoutePayloadParams,
  options: { buildOwnership?: GapNetworkBuildOwnership; sourceInputDigest?: string },
): Promise<GapNetworkResearchRoutePayload> {
  const updateFromSnapshot = (snapshot: ResearchRoutePayload) =>
    updateGapReportIfVersionUnchecked(
      db,
      snapshot.id,
      snapshot.version,
      {
        title: payload.title,
        content: payload.content,
        metadata: payload.metadata,
        refs: payload.refs,
        status: payload.status ?? "ready",
        version: snapshot.version + 1,
      },
      payload.viewerPrincipalId,
    );

  const updated = hasGapNetworkBuildOwnership(existing, options.buildOwnership)
    ? await updateFromSnapshot(existing)
    : null;
  if (updated) {
    return updated;
  }

  const latest = await getGapReportUnchecked(db, existing.id, payload.viewerPrincipalId);
  if (!isPersistableKnowledgeMapDocumentForPayload(latest, payload)) {
    throw new Error(`${payload.type} report changed while updating`);
  }
  if (canUseConcurrentKnowledgeMapDocument(latest, payload)) {
    return latest;
  }
  if (!hasGapNetworkBuildOwnership(latest, options.buildOwnership)) {
    throw new Error(`${payload.type} report changed while updating`);
  }

  const retried = await updateFromSnapshot(latest);
  if (retried) {
    return retried;
  }

  const newest = await getGapReportUnchecked(db, existing.id, payload.viewerPrincipalId);
  if (
    isPersistableKnowledgeMapDocumentForPayload(newest, payload) &&
    canUseConcurrentKnowledgeMapDocument(newest, payload)
  ) {
    return newest;
  }

  throw new Error(`${payload.type} report changed while updating`);
}
