import { z } from "zod";
import type { ResearchRouteStatus } from "@/app/domain/research-route-payload";
import {
  routeAiCommentSchema,
  isBoundedPersistedRouteAiComment,
  isPersistableRouteAiComment,
  normalizePersistedRouteAiCommentHistory,
  type RouteAiComment,
} from "@/app/domain/route-ai-comment";
import { sanitizeForDatabase, sanitizeText } from "./sanitize";

export const persistedRoutePayloadRowFields = {
  title: z.string(),
  content: z.string(),
  created_by: z.enum(["user", "agent"]),
  reaction: routeAiCommentSchema.nullable().optional(),
  reaction_history: z.array(routeAiCommentSchema).nullable().optional(),
  refs: z.array(z.string()),
  status: z.enum(["pending", "ready", "failed"]).default("ready"),
  version: z.number().default(0),
  reaction_version: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
};

export type PersistedRoutePayloadUpdateChanges<TMetadata> = {
  title?: string;
  content?: string;
  metadata?: TMetadata;
  reaction?: RouteAiComment | null;
  reactionHistory?: RouteAiComment[];
  refs?: string[];
  status?: ResearchRouteStatus;
  version?: number;
  reactionVersion?: number;
};

export type SanitizedPersistedRoutePayloadInsertFields = {
  title: string;
  content: string;
  createdBy: "user" | "agent";
  metadata: unknown;
  reaction: unknown;
  reactionHistory: unknown;
  refs: unknown;
  status?: ResearchRouteStatus;
};

export type SanitizedPersistedRoutePayloadUpdateChanges = {
  title?: string;
  content?: string;
  metadata?: unknown;
  reaction?: unknown;
  reaction_history?: unknown;
  refs?: unknown;
  status?: ResearchRouteStatus;
  version?: number;
  reaction_version?: number;
};

export function hydratePersistedReactions(row: {
  reaction?: RouteAiComment | null;
  reaction_history?: RouteAiComment[] | null;
}) {
  const receivedAtMs = Date.now();
  const reaction =
    row.reaction &&
    isPersistableRouteAiComment(row.reaction) &&
    isBoundedPersistedRouteAiComment(row.reaction, receivedAtMs)
      ? row.reaction
      : null;
  const reactionHistory = normalizePersistedRouteAiCommentHistory(
    row.reaction_history ?? [],
    receivedAtMs,
  );
  return { reaction, reactionHistory };
}

export function toPersistedRoutePayloadBase(row: {
  title: string;
  content: string;
  created_by: "user" | "agent";
  reaction?: RouteAiComment | null;
  reaction_history?: RouteAiComment[] | null;
  refs: string[];
  status: ResearchRouteStatus;
  version: number;
  reaction_version: number;
  created_at: string;
  updated_at: string;
}) {
  return {
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    ...hydratePersistedReactions(row),
    refs: row.refs,
    status: row.status,
    version: row.version,
    reactionVersion: row.reaction_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildPersistedRoutePayloadInsertPayloadBase(
  fields: SanitizedPersistedRoutePayloadInsertFields,
) {
  return {
    title: fields.title,
    content: fields.content,
    created_by: fields.createdBy,
    metadata: fields.metadata,
    reaction: fields.reaction ?? null,
    reaction_history: fields.reactionHistory ?? [],
    refs: fields.refs,
    ...(fields.status ? { status: fields.status } : {}),
  };
}

function sanitizeReactionForWrite(reaction: RouteAiComment | null | undefined): unknown {
  if (reaction === undefined) return undefined;
  if (reaction === null) return null;
  if (!isPersistableRouteAiComment(reaction) || !isBoundedPersistedRouteAiComment(reaction)) {
    return undefined;
  }
  return sanitizeForDatabase(reaction);
}

function sanitizeReactionHistoryForWrite(reactionHistory: RouteAiComment[] | undefined): unknown {
  if (reactionHistory === undefined) return undefined;

  const persistableReactionHistory = normalizePersistedRouteAiCommentHistory(reactionHistory);
  if (reactionHistory.length > 0 && persistableReactionHistory.length === 0) {
    return undefined;
  }

  return sanitizeForDatabase(persistableReactionHistory);
}

export function sanitizePersistedRoutePayloadInsertFields(params: {
  title: string;
  content: string;
  createdBy: "user" | "agent";
  metadata: unknown;
  reaction?: RouteAiComment | null;
  reactionHistory?: RouteAiComment[];
  refs?: string[];
  status?: ResearchRouteStatus;
}): SanitizedPersistedRoutePayloadInsertFields {
  return {
    title: sanitizeText(params.title),
    content: sanitizeText(params.content),
    createdBy: params.createdBy,
    metadata: sanitizeForDatabase(params.metadata),
    reaction: sanitizeReactionForWrite(params.reaction),
    reactionHistory: sanitizeReactionHistoryForWrite(params.reactionHistory),
    refs: sanitizeForDatabase(params.refs ?? []),
    status: params.status,
  };
}

export function sanitizePersistedRoutePayloadUpdateChanges<TMetadata>(
  changes: PersistedRoutePayloadUpdateChanges<TMetadata>,
): SanitizedPersistedRoutePayloadUpdateChanges {
  const sanitizedChanges: SanitizedPersistedRoutePayloadUpdateChanges = {};

  if (changes.title !== undefined) {
    sanitizedChanges.title = sanitizeText(changes.title);
  }
  if (changes.content !== undefined) {
    sanitizedChanges.content = sanitizeText(changes.content);
  }
  if (changes.metadata !== undefined) {
    sanitizedChanges.metadata = sanitizeForDatabase(changes.metadata);
  }
  if (changes.reaction !== undefined) {
    const reaction = sanitizeReactionForWrite(changes.reaction);
    if (reaction !== undefined) {
      sanitizedChanges.reaction = reaction;
    }
  }
  if (changes.reactionHistory !== undefined) {
    const reactionHistory = sanitizeReactionHistoryForWrite(changes.reactionHistory);
    if (reactionHistory !== undefined) {
      sanitizedChanges.reaction_history = reactionHistory;
    }
  }
  if (changes.refs !== undefined) {
    sanitizedChanges.refs = sanitizeForDatabase(changes.refs);
  }
  if (changes.status !== undefined) {
    sanitizedChanges.status = changes.status;
  }
  if (changes.version !== undefined) {
    sanitizedChanges.version = changes.version;
  }
  if (changes.reactionVersion !== undefined) {
    sanitizedChanges.reaction_version = changes.reactionVersion;
  }

  return sanitizedChanges;
}
