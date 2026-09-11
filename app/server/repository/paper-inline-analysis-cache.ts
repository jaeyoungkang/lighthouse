import { z } from "zod";
import { analysisSchema } from "@/app/domain/research-route-payload-schema";
import type { AIAnalysis, InlineAnalysisRetryCommand } from "@/app/domain/analysis";
import type { RepositoryDbHandle } from "./db";
import { getLighthouseDbFor } from "./db";
import { parseRows } from "./row-parsers";
import { sanitizeForDatabase } from "./sanitize";

const paperInlineAnalysisCacheRowSchema = z.object({
  paper_id: z.string(),
  version: z.number().int(),
  input_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  analysis: analysisSchema,
  source: z
    .enum(["abstract"])
    .nullable()
    .optional()
    .transform((source) => source ?? undefined),
  created_at: z.string(),
  updated_at: z.string(),
});

const paperInlineAnalysisIdentityRowSchema = z.object({
  paper_id: z.string(),
  version: z.number().int(),
  input_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
});
const paperInlineAnalysisFailureRowSchema = paperInlineAnalysisIdentityRowSchema.extend({
  failure_count: z.number().int().positive(),
  cooldown_until: z.string(),
  retry_requires_explicit: z.boolean(),
});
const paperInlineAnalysisGenerationStateRowSchema = paperInlineAnalysisIdentityRowSchema.extend({
  status: z.enum(["pending", "ready", "cooldown_failed", "terminal_failed"]),
  cooldown_until: z.string().nullable(),
  retry_requires_explicit: z.boolean(),
});

const rpcResponseSchema = z.object({
  data: z.unknown(),
  error: z.unknown().nullable(),
});

type PaperInlineAnalysisCacheRow = z.infer<typeof paperInlineAnalysisCacheRowSchema>;

export interface PaperInlineAnalysisIdentity {
  paperId: string;
  version: number;
  inputFingerprint: string;
}

export interface PaperInlineAnalysisCacheRecord extends PaperInlineAnalysisIdentity {
  analysis: AIAnalysis;
  source?: "abstract";
  createdAt: string;
  updatedAt: string;
}

export interface PaperInlineAnalysisCacheCompletion extends PaperInlineAnalysisIdentity {
  analysis: AIAnalysis;
  source?: "abstract";
}

export interface PaperInlineAnalysisFailureFence extends PaperInlineAnalysisIdentity {
  failureCount: number;
  cooldownUntil: string;
  retryRequiresExplicit: boolean;
}

export interface PaperInlineAnalysisGenerationState extends PaperInlineAnalysisIdentity {
  status: "pending" | "ready" | "cooldown_failed" | "terminal_failed";
  cooldownUntil: string | null;
  retryRequiresExplicit: boolean;
}

function toPaperInlineAnalysisCacheRecord(
  row: PaperInlineAnalysisCacheRow,
): PaperInlineAnalysisCacheRecord {
  return {
    paperId: row.paper_id,
    version: row.version,
    inputFingerprint: row.input_fingerprint,
    analysis: row.analysis,
    ...(row.source ? { source: row.source } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseIdentitySet(
  data: unknown,
  label: string,
  expectedIdentities: PaperInlineAnalysisIdentity[],
): Set<string> {
  const expectedByPaperId = new Map(
    expectedIdentities.map((identity) => [identity.paperId, identity]),
  );
  return new Set(
    parseRows(paperInlineAnalysisIdentityRowSchema, data, label)
      .filter((row) => {
        const expected = expectedByPaperId.get(row.paper_id);
        return (
          expected?.version === row.version && expected.inputFingerprint === row.input_fingerprint
        );
      })
      .map((row) => row.paper_id),
  );
}

function throwRpcError(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Paper inline analysis cache RPC failed", { cause: error });
}

export async function listSharedPaperInlineAnalysisCache(
  db: RepositoryDbHandle,
  identities: PaperInlineAnalysisIdentity[],
  signal?: AbortSignal,
): Promise<Map<string, PaperInlineAnalysisCacheRecord>> {
  if (identities.length === 0) {
    return new Map();
  }

  const expectedByPaperId = new Map(identities.map((identity) => [identity.paperId, identity]));
  const query = getLighthouseDbFor(db).rpc("list_paper_inline_analysis_cache", {
    p_entries: identities.map((identity) => ({
      paper_id: identity.paperId,
      version: identity.version,
      input_fingerprint: identity.inputFingerprint,
    })),
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);

  if (error) throwRpcError(error);

  return new Map(
    parseRows(paperInlineAnalysisCacheRowSchema, data, "shared paper inline analysis cache")
      .map(toPaperInlineAnalysisCacheRecord)
      .filter((record) => {
        const expected = expectedByPaperId.get(record.paperId);
        return (
          expected?.version === record.version &&
          expected.inputFingerprint === record.inputFingerprint
        );
      })
      .map((record) => [record.paperId, record] as const),
  );
}

export async function claimSharedPaperInlineAnalysisGeneration(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
  leaseToken: string,
  leaseSeconds = 50,
  signal?: AbortSignal,
  retryCommand: InlineAnalysisRetryCommand = "automatic",
): Promise<Set<string>> {
  if (entries.length === 0) {
    return new Set();
  }

  const query = getLighthouseDbFor(db).rpc("claim_paper_inline_analysis_generation", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
    })),
    p_lease_token: leaseToken,
    p_lease_seconds: leaseSeconds,
    ...(retryCommand !== "automatic" ? { p_retry_command: retryCommand } : {}),
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);

  if (error) throwRpcError(error);
  return parseIdentitySet(data, "claimed shared inline analysis generation", entries);
}

export async function listSharedPaperInlineAnalysisGenerationStates(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
  signal?: AbortSignal,
): Promise<Map<string, PaperInlineAnalysisGenerationState>> {
  if (entries.length === 0) return new Map();
  const query = getLighthouseDbFor(db).rpc("list_paper_inline_analysis_generation_state", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
    })),
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);
  if (error) throwRpcError(error);
  return new Map(
    parseRows(
      paperInlineAnalysisGenerationStateRowSchema,
      data,
      "inline analysis generation state",
    ).map((row) => [
      row.paper_id,
      {
        paperId: row.paper_id,
        version: row.version,
        inputFingerprint: row.input_fingerprint,
        status: row.status,
        cooldownUntil: row.cooldown_until,
        retryRequiresExplicit: row.retry_requires_explicit,
      },
    ]),
  );
}

export async function failSharedPaperInlineAnalysisGeneration(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
  leaseToken: string,
  failureClass: string,
  retryAfterSeconds = 0,
  signal?: AbortSignal,
): Promise<Map<string, PaperInlineAnalysisFailureFence>> {
  if (entries.length === 0) return new Map();
  const query = getLighthouseDbFor(db).rpc("fail_paper_inline_analysis_generation", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
    })),
    p_lease_token: leaseToken,
    p_failure_class: failureClass,
    p_retry_after_seconds: retryAfterSeconds,
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);
  if (error) throwRpcError(error);
  return new Map(
    parseRows(paperInlineAnalysisFailureRowSchema, data, "inline analysis failure fence").map(
      (row) => [
        row.paper_id,
        {
          paperId: row.paper_id,
          version: row.version,
          inputFingerprint: row.input_fingerprint,
          failureCount: row.failure_count,
          cooldownUntil: row.cooldown_until,
          retryRequiresExplicit: row.retry_requires_explicit,
        },
      ],
    ),
  );
}

export async function terminalFailSharedPaperInlineAnalysisGeneration(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
  leaseToken: string,
  failureClass: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  if (entries.length === 0) return new Set();
  const query = getLighthouseDbFor(db).rpc("terminal_fail_paper_inline_analysis_generation", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
    })),
    p_lease_token: leaseToken,
    p_failure_class: failureClass,
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);
  if (error) throwRpcError(error);
  return parseIdentitySet(data, "terminal inline analysis failure fence", entries);
}

export async function completeSharedPaperInlineAnalysisGeneration(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisCacheCompletion[],
  leaseToken: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  if (entries.length === 0) {
    return new Set();
  }

  const query = getLighthouseDbFor(db).rpc("complete_paper_inline_analysis_generation", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
      analysis: sanitizeForDatabase(entry.analysis),
      source: entry.source ?? null,
    })),
    p_lease_token: leaseToken,
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);

  if (error) throwRpcError(error);
  return parseIdentitySet(data, "completed shared inline analysis generation", entries);
}

export async function releaseSharedPaperInlineAnalysisGeneration(
  db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
  leaseToken: string,
  signal?: AbortSignal,
): Promise<Set<string>> {
  if (entries.length === 0) {
    return new Set();
  }

  const query = getLighthouseDbFor(db).rpc("release_paper_inline_analysis_generation", {
    p_entries: entries.map((entry) => ({
      paper_id: entry.paperId,
      version: entry.version,
      input_fingerprint: entry.inputFingerprint,
    })),
    p_lease_token: leaseToken,
  });
  const rawResponse: unknown = await (signal ? query.abortSignal(signal) : query);
  const { data, error } = rpcResponseSchema.parse(rawResponse);

  if (error) throwRpcError(error);
  return parseIdentitySet(data, "released shared inline analysis generation", entries);
}
