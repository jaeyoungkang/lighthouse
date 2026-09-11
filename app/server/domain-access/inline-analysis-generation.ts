import { isInlineAnalysisFailurePlaceholder } from "@/app/lib/inline-analysis";
import { isTransientLlmFailoverError } from "@/app/server/ai-generation/judgment";
import { createLlmJudgmentUsageLedgerForTrustedAgent } from "@/app/server/domain-access/llm-usage-access";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type {
  PaperInlineAnalysisCacheCompletion,
  PaperInlineAnalysisFailureFence,
  PaperInlineAnalysisGenerationState,
  PaperInlineAnalysisIdentity,
  completeSharedPaperInlineAnalysisGeneration,
  failSharedPaperInlineAnalysisGeneration,
  releaseSharedPaperInlineAnalysisGeneration,
  terminalFailSharedPaperInlineAnalysisGeneration,
} from "@/app/server/repository/paper-inline-analysis-cache";
import {
  InlineAnalysisTerminalGenerationError,
  type InlineAnalysisResult,
  type PaperInput,
  type analyzePapersInline,
} from "@/app/server/services/inline-analysis-service";

const SHARED_CACHE_CLEANUP_BUDGET_MS = 1_500;

export function getAbortReason(signal: AbortSignal): Error {
  return signal.reason == null
    ? new DOMException("Inline analysis caller aborted", "AbortError")
    : normalizePromiseError(signal.reason);
}

export function normalizePromiseError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof error.name === "string"
  ) {
    const normalized = new Error(
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Inline analysis promise rejected",
      { cause: error },
    );
    normalized.name = error.name;
    return normalized;
  }
  return new Error("Inline analysis promise rejected", { cause: error });
}

export function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(getAbortReason(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(getAbortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(normalizePromiseError(error));
      },
    );
  });
}

type AnalysisOutcome = PromiseSettledResult<{
  paper: PaperInput;
  results: InlineAnalysisResult[];
}>;

interface ClaimedAnalysisDeps {
  analyzeInline: typeof analyzePapersInline;
  completeInlineAnalysisGeneration: typeof completeSharedPaperInlineAnalysisGeneration;
  failInlineAnalysisGeneration: typeof failSharedPaperInlineAnalysisGeneration;
  terminalFailInlineAnalysisGeneration: typeof terminalFailSharedPaperInlineAnalysisGeneration;
  releaseInlineAnalysisGeneration: typeof releaseSharedPaperInlineAnalysisGeneration;
}

interface ResolveClaimedInlineAnalysesParams extends ClaimedAnalysisDeps {
  db: RepositoryDbHandle;
  ownerPrincipalId: string;
  claimedPapers: PaperInput[];
  claimedIdentities: PaperInlineAnalysisIdentity[];
  identityByPaperId: Map<string, PaperInlineAnalysisIdentity>;
  leaseToken: string;
  ownerWorkSignal: AbortSignal;
  resolutionSignal: AbortSignal;
  routeDeadlineAt: number;
}

export interface ClaimedInlineAnalysisResolution {
  successfulAnalyzedResults: InlineAnalysisResult[];
  transitionedStateByPaperId: Map<string, PaperInlineAnalysisGenerationState>;
}

async function analyzeClaims(
  params: ResolveClaimedInlineAnalysesParams,
): Promise<AnalysisOutcome[]> {
  if (params.claimedPapers.length === 0) return [];
  const usageLedger = createLlmJudgmentUsageLedgerForTrustedAgent({
    db: params.db,
    ownerPrincipalId: params.ownerPrincipalId,
  });
  return Promise.allSettled(
    params.claimedPapers.map(async (paper) => ({
      paper,
      results: await raceWithAbort(
        params.analyzeInline([paper], {
          signal: params.ownerWorkSignal,
          usageLedger,
        }),
        params.ownerWorkSignal,
      ),
    })),
  );
}

function successfulCandidates(outcomes: AnalysisOutcome[]): InlineAnalysisResult[] {
  return outcomes.flatMap((outcome) =>
    outcome.status === "fulfilled"
      ? outcome.value.results.filter(
          (result) => !isInlineAnalysisFailurePlaceholder(result.analysis),
        )
      : [],
  );
}

async function completeCandidates(
  params: ResolveClaimedInlineAnalysesParams,
  candidates: InlineAnalysisResult[],
): Promise<Set<string>> {
  const completions: PaperInlineAnalysisCacheCompletion[] = candidates.flatMap((result) => {
    const identity = params.identityByPaperId.get(result.paperId);
    return identity ? [{ ...identity, analysis: result.analysis, source: result.source }] : [];
  });
  return completions.length > 0
    ? params.completeInlineAnalysisGeneration(
        params.db,
        completions,
        params.leaseToken,
        params.resolutionSignal,
      )
    : new Set();
}

function cooldownState(
  identity: PaperInlineAnalysisIdentity,
  fence: PaperInlineAnalysisFailureFence,
): PaperInlineAnalysisGenerationState {
  return {
    ...identity,
    status: "cooldown_failed",
    cooldownUntil: fence.cooldownUntil,
    retryRequiresExplicit: true,
  };
}

function terminalState(identity: PaperInlineAnalysisIdentity): PaperInlineAnalysisGenerationState {
  return {
    ...identity,
    status: "terminal_failed",
    cooldownUntil: null,
    retryRequiresExplicit: true,
  };
}

async function transitionTransientFailure(
  params: ResolveClaimedInlineAnalysesParams,
  identity: PaperInlineAnalysisIdentity,
  error: Error,
): Promise<PaperInlineAnalysisGenerationState> {
  const failoverError = isTransientLlmFailoverError(error) ? error : null;
  const fences = await params.failInlineAnalysisGeneration(
    params.db,
    [identity],
    params.leaseToken,
    failoverError?.failureClass ?? "transient_owner_deadline",
    failoverError?.retryAfterSeconds ?? 0,
    params.resolutionSignal,
  );
  const fence = fences.get(identity.paperId);
  if (!fence) throw new Error("Failed to persist inline analysis cooldown failure");
  return cooldownState(identity, fence);
}

async function transitionTerminalFailure(
  params: ResolveClaimedInlineAnalysesParams,
  identity: PaperInlineAnalysisIdentity,
  error: Error,
): Promise<PaperInlineAnalysisGenerationState> {
  const transitioned = await params.terminalFailInlineAnalysisGeneration(
    params.db,
    [identity],
    params.leaseToken,
    error instanceof InlineAnalysisTerminalGenerationError
      ? error.failureClass
      : "terminal_generation_failure",
    params.resolutionSignal,
  );
  if (!transitioned.has(identity.paperId)) {
    throw new Error("Failed to persist terminal inline analysis failure");
  }
  return terminalState(identity);
}

async function transitionIncompleteClaims(
  params: ResolveClaimedInlineAnalysesParams,
  outcomes: AnalysisOutcome[],
  completedPaperIds: Set<string>,
  releasablePaperIds: Set<string>,
): Promise<Map<string, PaperInlineAnalysisGenerationState>> {
  const states = new Map<string, PaperInlineAnalysisGenerationState>();
  for (const [index, outcome] of outcomes.entries()) {
    const paper = params.claimedPapers[index];
    const identity = params.identityByPaperId.get(paper.paperId);
    if (!identity || completedPaperIds.has(identity.paperId)) continue;
    const rejectedError: unknown =
      outcome.status === "rejected"
        ? (outcome.reason as unknown)
        : new InlineAnalysisTerminalGenerationError(
            "Inline analysis provider omitted a claimed paper",
          );
    const error = normalizePromiseError(rejectedError);
    if (error.name === "AbortError") {
      releasablePaperIds.add(identity.paperId);
      continue;
    }
    const state =
      isTransientLlmFailoverError(error) || error.name === "TimeoutError"
        ? await transitionTransientFailure(params, identity, error)
        : await transitionTerminalFailure(params, identity, error);
    states.set(identity.paperId, state);
  }
  return states;
}

function createCleanupContext(routeDeadlineAt: number): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const remainingRouteBudgetMs = Math.max(1, routeDeadlineAt - Date.now());
  const cleanupController = new AbortController();
  const cleanupTimer = setTimeout(
    () => {
      cleanupController.abort(
        new DOMException("Inline analysis cleanup deadline exceeded", "TimeoutError"),
      );
    },
    Math.min(SHARED_CACHE_CLEANUP_BUDGET_MS, remainingRouteBudgetMs),
  );
  return {
    signal: cleanupController.signal,
    dispose: () => {
      clearTimeout(cleanupTimer);
    },
  };
}

async function releaseCancelledClaims(
  params: ResolveClaimedInlineAnalysesParams,
  releasablePaperIds: Set<string>,
): Promise<void> {
  const identities = params.claimedIdentities.filter((identity) =>
    releasablePaperIds.has(identity.paperId),
  );
  if (identities.length === 0) return;
  const cleanup = createCleanupContext(params.routeDeadlineAt);
  try {
    const released = await raceWithAbort(
      params.releaseInlineAnalysisGeneration(
        params.db,
        identities,
        params.leaseToken,
        cleanup.signal,
      ),
      cleanup.signal,
    );
    if (!identities.every((identity) => released.has(identity.paperId))) {
      throw new DOMException(
        "Inline analysis lease cleanup did not release every claimed identity",
        "TimeoutError",
      );
    }
  } catch (error) {
    const cleanupError = new Error("Inline analysis lease cleanup failed", { cause: error });
    cleanupError.name = "TimeoutError";
    throw cleanupError;
  } finally {
    cleanup.dispose();
  }
}

export async function resolveClaimedInlineAnalyses(
  params: ResolveClaimedInlineAnalysesParams,
): Promise<ClaimedInlineAnalysisResolution> {
  const releasablePaperIds = new Set<string>();
  try {
    const outcomes = await analyzeClaims(params);
    const candidates = successfulCandidates(outcomes);
    const completedPaperIds = await completeCandidates(params, candidates);
    const transitionedStateByPaperId = await transitionIncompleteClaims(
      params,
      outcomes,
      completedPaperIds,
      releasablePaperIds,
    );
    return {
      successfulAnalyzedResults: candidates.filter((result) =>
        completedPaperIds.has(result.paperId),
      ),
      transitionedStateByPaperId,
    };
  } finally {
    // Only caller cancellation may delete or restore a claim. Persistence
    // failures leave the pending fence in place for an explicit retry.
    await releaseCancelledClaims(params, releasablePaperIds);
  }
}
