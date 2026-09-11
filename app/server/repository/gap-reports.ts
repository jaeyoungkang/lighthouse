import { z } from "zod";
import type {
  CreateResearchRoutePayloadParams,
  GapNetworkCreateResearchRoutePayloadParams,
  GapNetworkMetadata,
  GapNetworkResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import { gapNetworkMetadataSchema } from "@/app/domain/research-route-payload-schema";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import type { RepositoryDbHandle } from "./db";
import { getLighthouseDbFor } from "./db";
import {
  hydratePersistedReactions,
  sanitizePersistedRoutePayloadInsertFields,
  sanitizePersistedRoutePayloadUpdateChanges,
  type PersistedRoutePayloadUpdateChanges,
} from "./persisted-route-payload-repository-shared";
import { parseSingleRow } from "./row-parsers";

const gapReportRowSchema = z.object({
  id: z.string(),
  source_snapshot_id: z.string(),
  source_input_digest: z.string(),
  title: z.string(),
  content: z.string(),
  created_by: z.enum(["user", "agent"]),
  metadata: gapNetworkMetadataSchema,
  refs: z.array(z.string()),
  status: z.enum(["pending", "ready", "failed"]).default("ready"),
  version: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

const gapReportReactionPreferenceRowSchema = z.object({
  gap_report_id: z.string(),
  viewer_principal_id: z.string(),
  artifact_version: z.number(),
  reaction: z.unknown().nullable().optional(),
  reaction_history: z.array(z.unknown()).nullable().optional(),
  reaction_version: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

type GapReportRow = z.infer<typeof gapReportRowSchema>;
type GapReportCreateParams = GapNetworkCreateResearchRoutePayloadParams;

export type GapReportUpdateChanges = Omit<
  PersistedRoutePayloadUpdateChanges<GapNetworkMetadata>,
  "reaction" | "reactionHistory" | "reactionVersion"
>;

export interface GapReportReactionPreference {
  gapReportId: string;
  viewerPrincipalId: string;
  artifactVersion: number;
  reaction: RouteAiComment | null;
  reactionHistory: RouteAiComment[];
  reactionVersion: number;
}

function toGapNetworkView(
  row: GapReportRow,
  viewerPrincipalId: string,
): GapNetworkResearchRoutePayload {
  return {
    id: row.id,
    viewerPrincipalId,
    type: "gap_network",
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    metadata: row.metadata,
    reaction: null,
    reactionHistory: [],
    refs: row.refs,
    status: row.status,
    version: row.version,
    reactionVersion: 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertGapReportCreateParams(
  params: CreateResearchRoutePayloadParams,
): asserts params is GapReportCreateParams {
  if (params.type !== "gap_network") {
    throw new Error("gap_reports only persists gap_network artifacts");
  }
}

function buildGapReportInsertPayload(params: {
  sourceInputDigest: string;
  fields: ReturnType<typeof sanitizePersistedRoutePayloadInsertFields>;
  metadata: GapNetworkMetadata;
}) {
  return {
    source_snapshot_id: params.metadata.sourceSnapshotId,
    source_input_digest: params.sourceInputDigest,
    title: params.fields.title,
    content: params.fields.content,
    created_by: params.fields.createdBy,
    metadata: params.fields.metadata,
    refs: params.fields.refs,
    ...(params.fields.status ? { status: params.fields.status } : {}),
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function createGapReportUnchecked(
  db: RepositoryDbHandle,
  params: CreateResearchRoutePayloadParams,
  sourceInputDigest: string,
): Promise<GapNetworkResearchRoutePayload> {
  assertGapReportCreateParams(params);
  const fields = sanitizePersistedRoutePayloadInsertFields(params);
  const result = await getLighthouseDbFor(db)
    .from("gap_reports")
    .insert(buildGapReportInsertPayload({ sourceInputDigest, fields, metadata: params.metadata }))
    .select("*")
    .single();

  if (result.error) throw result.error;
  return toGapNetworkView(
    parseSingleRow(gapReportRowSchema, result.data, "gap_reports insert"),
    params.viewerPrincipalId,
  );
}

export async function reserveGapReportUnchecked(
  db: RepositoryDbHandle,
  params: CreateResearchRoutePayloadParams,
  sourceInputDigest: string,
): Promise<GapNetworkResearchRoutePayload> {
  assertGapReportCreateParams(params);
  const existing = await getGapReportBySourceInputDigestUnchecked(
    db,
    sourceInputDigest,
    params.viewerPrincipalId,
  );
  if (existing) return existing;

  try {
    return await createGapReportUnchecked(db, params, sourceInputDigest);
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;

    const concurrentExisting = await getGapReportBySourceInputDigestUnchecked(
      db,
      sourceInputDigest,
      params.viewerPrincipalId,
    );
    if (concurrentExisting) return concurrentExisting;
    throw error;
  }
}

export async function getGapReportUnchecked(
  db: RepositoryDbHandle,
  id: string,
  viewerPrincipalId: string,
): Promise<GapNetworkResearchRoutePayload | null> {
  const result = await getLighthouseDbFor(db)
    .from("gap_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;
  return toGapNetworkView(
    parseSingleRow(gapReportRowSchema, result.data, "gap_reports get"),
    viewerPrincipalId,
  );
}

export async function getGapReportBySourceInputDigestUnchecked(
  db: RepositoryDbHandle,
  sourceInputDigest: string,
  viewerPrincipalId: string,
): Promise<GapNetworkResearchRoutePayload | null> {
  const result = await getLighthouseDbFor(db)
    .from("gap_reports")
    .select("*")
    .eq("source_input_digest", sourceInputDigest)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;
  return toGapNetworkView(
    parseSingleRow(gapReportRowSchema, result.data, "gap_reports digest get"),
    viewerPrincipalId,
  );
}

export async function updateGapReportIfVersionUnchecked(
  db: RepositoryDbHandle,
  id: string,
  expectedVersion: number,
  changes: GapReportUpdateChanges,
  viewerPrincipalId: string,
): Promise<GapNetworkResearchRoutePayload | null> {
  const sanitizedChanges = sanitizePersistedRoutePayloadUpdateChanges(changes);
  if (sanitizedChanges.version !== expectedVersion + 1) {
    throw new Error("Versioned gap report updates must advance version by exactly 1");
  }
  const result = await getLighthouseDbFor(db)
    .from("gap_reports")
    .update(sanitizedChanges)
    .eq("id", id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;
  return toGapNetworkView(
    parseSingleRow(gapReportRowSchema, result.data, "gap_reports version update"),
    viewerPrincipalId,
  );
}

function toReactionPreference(
  row: z.infer<typeof gapReportReactionPreferenceRowSchema>,
): GapReportReactionPreference {
  const { reaction, reactionHistory } = hydratePersistedReactions({
    reaction: row.reaction as RouteAiComment | null | undefined,
    reaction_history: row.reaction_history as RouteAiComment[] | null | undefined,
  });
  return {
    gapReportId: row.gap_report_id,
    viewerPrincipalId: row.viewer_principal_id,
    artifactVersion: row.artifact_version,
    reaction,
    reactionHistory,
    reactionVersion: row.reaction_version,
  };
}

export async function getGapReportReactionPreferenceUnchecked(
  db: RepositoryDbHandle,
  gapReportId: string,
  viewerPrincipalId: string,
): Promise<GapReportReactionPreference | null> {
  const result = await getLighthouseDbFor(db)
    .from("gap_report_reactions")
    .select("*")
    .eq("gap_report_id", gapReportId)
    .eq("viewer_principal_id", viewerPrincipalId)
    .maybeSingle();

  if (result.error) throw result.error;
  if (!result.data) return null;
  return toReactionPreference(
    parseSingleRow(gapReportReactionPreferenceRowSchema, result.data, "gap_report_reactions get"),
  );
}

export async function updateGapReportReactionPreferenceIfVersionUnchecked(
  db: RepositoryDbHandle,
  params: {
    gapReportId: string;
    viewerPrincipalId: string;
    artifactVersion: number;
    expectedReactionVersion: number;
    reaction: RouteAiComment | null;
    reactionHistory: RouteAiComment[];
  },
): Promise<GapReportReactionPreference | null> {
  const sanitized = sanitizePersistedRoutePayloadUpdateChanges({
    reaction: params.reaction,
    reactionHistory: params.reactionHistory,
    reactionVersion: params.expectedReactionVersion + 1,
  });
  const writePayload = {
    artifact_version: params.artifactVersion,
    reaction: sanitized.reaction ?? null,
    reaction_history: sanitized.reaction_history ?? [],
    reaction_version: params.expectedReactionVersion + 1,
  };

  if (params.expectedReactionVersion === 0) {
    const replacedStale = await getLighthouseDbFor(db)
      .from("gap_report_reactions")
      .update(writePayload)
      .eq("gap_report_id", params.gapReportId)
      .eq("viewer_principal_id", params.viewerPrincipalId)
      .neq("artifact_version", params.artifactVersion)
      .select("*")
      .maybeSingle();
    if (replacedStale.error) throw replacedStale.error;
    if (replacedStale.data) {
      return toReactionPreference(
        parseSingleRow(
          gapReportReactionPreferenceRowSchema,
          replacedStale.data,
          "gap_report_reactions stale artifact replace",
        ),
      );
    }

    const inserted = await getLighthouseDbFor(db)
      .from("gap_report_reactions")
      .insert({
        gap_report_id: params.gapReportId,
        viewer_principal_id: params.viewerPrincipalId,
        ...writePayload,
      })
      .select("*")
      .maybeSingle();
    if (inserted.error) {
      if ((inserted.error as { code?: string }).code === "23505") return null;
      throw inserted.error;
    }
    if (!inserted.data) return null;
    return toReactionPreference(
      parseSingleRow(
        gapReportReactionPreferenceRowSchema,
        inserted.data,
        "gap_report_reactions insert",
      ),
    );
  }

  const updated = await getLighthouseDbFor(db)
    .from("gap_report_reactions")
    .update(writePayload)
    .eq("gap_report_id", params.gapReportId)
    .eq("viewer_principal_id", params.viewerPrincipalId)
    .eq("artifact_version", params.artifactVersion)
    .eq("reaction_version", params.expectedReactionVersion)
    .select("*")
    .maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) return null;
  return toReactionPreference(
    parseSingleRow(
      gapReportReactionPreferenceRowSchema,
      updated.data,
      "gap_report_reactions update",
    ),
  );
}

export function applyGapReportReactionPreference(
  report: GapNetworkResearchRoutePayload,
  preference: GapReportReactionPreference | null,
): GapNetworkResearchRoutePayload {
  if (!preference || preference.artifactVersion !== report.version) {
    return { ...report, reaction: null, reactionHistory: [], reactionVersion: 0 };
  }
  return {
    ...report,
    reaction: preference.reaction,
    reactionHistory: preference.reactionHistory,
    reactionVersion: preference.reactionVersion,
  };
}
