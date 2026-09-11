import { randomUUID } from "node:crypto";
import {
  INLINE_ANALYSIS_REQUEST_PAPER_LIMIT,
  INLINE_ANALYSIS_ROUTE_DEADLINE_MS,
  INLINE_ANALYSIS_VERSION,
  type InlineAnalysisRetryCommand,
} from "@/app/domain/analysis";
import type {
  CitationLineageMetadata,
  GraphNeighborsMetadata,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import {
  hasUsableInlineAnalysisAbstract,
  isInlineAnalysisFailurePlaceholder,
} from "@/app/lib/inline-analysis";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import {
  getAbortReason,
  normalizePromiseError,
  raceWithAbort,
  resolveClaimedInlineAnalyses,
} from "@/app/server/domain-access/inline-analysis-generation";
import {
  buildInlineAnalysisCacheIdentities,
  buildInlineAnalysisInputFingerprint,
  buildInlineAnalysisRequestKey,
  getCanonicalAnalyzablePapers,
} from "@/app/server/domain-access/inline-analysis-identity";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import {
  claimSharedPaperInlineAnalysisGeneration,
  completeSharedPaperInlineAnalysisGeneration,
  failSharedPaperInlineAnalysisGeneration,
  listSharedPaperInlineAnalysisCache,
  listSharedPaperInlineAnalysisGenerationStates,
  releaseSharedPaperInlineAnalysisGeneration,
  terminalFailSharedPaperInlineAnalysisGeneration,
  type PaperInlineAnalysisCacheRecord,
  type PaperInlineAnalysisGenerationState,
  type PaperInlineAnalysisIdentity,
} from "@/app/server/repository/paper-inline-analysis-cache";
import {
  analyzePapersInline,
  type InlineAnalysisResult,
  type PaperInput,
} from "@/app/server/services/inline-analysis-service";

interface ResolveInlineAnalysisParams {
  papers: PaperInput[];
  retryCommand?: InlineAnalysisRetryCommand;
  /** Absolute route-entry deadline; callers reserve response handoff inside maxDuration. */
  deadlineAt?: number;
  signal?: AbortSignal;
}

type PapersBearingMetadata = SearchMetadata | CitationLineageMetadata | GraphNeighborsMetadata;

interface HydrateSearchMetadataWithCachedInlineAnalysisParams<M extends PapersBearingMetadata> {
  db: RepositoryDbHandle;
  metadata: M;
  signal?: AbortSignal;
  /**
   * Exact identities computed before a lossy prompt projection. When supplied,
   * every analyzable paper must have an entry; the cache remains the authority
   * and only returns an exact paper/version/fingerprint match.
   */
  cacheInputFingerprintByPaperId?: ReadonlyMap<string, string>;
}

type WaitForCachedInlineAnalyses = (
  db: RepositoryDbHandle,
  identities: PaperInlineAnalysisIdentity[],
  signal?: AbortSignal,
) => Promise<Map<string, PaperInlineAnalysisCacheRecord>>;

interface InlineAnalysisAccessDeps {
  listCachedInlineAnalyses?: typeof listSharedPaperInlineAnalysisCache;
  claimInlineAnalysisGeneration?: typeof claimSharedPaperInlineAnalysisGeneration;
  analyzePapersInline?: typeof analyzePapersInline;
  completeInlineAnalysisGeneration?: typeof completeSharedPaperInlineAnalysisGeneration;
  releaseInlineAnalysisGeneration?: typeof releaseSharedPaperInlineAnalysisGeneration;
  listInlineAnalysisGenerationStates?: typeof listSharedPaperInlineAnalysisGenerationStates;
  failInlineAnalysisGeneration?: typeof failSharedPaperInlineAnalysisGeneration;
  terminalFailInlineAnalysisGeneration?: typeof terminalFailSharedPaperInlineAnalysisGeneration;
  waitForCachedInlineAnalyses?: WaitForCachedInlineAnalyses;
}

const SHARED_CACHE_POLL_DELAYS_MS = [500, 1_000, 2_000, 4_000, 6_000, 8_000, 8_000] as const;
const SHARED_CACHE_OWNER_WORK_BUDGET_MS = 24_000;
const SHARED_CACHE_INITIAL_LEASE_SECONDS = 30;
const SHARED_CACHE_PEER_OBSERVATION_BUDGET_MS = 30_000;

interface InFlightInlineAnalysisResolution {
  promise: Promise<ResolvedInlineAnalysisResult[]>;
  controller: AbortController;
  subscribers: Set<symbol>;
  settled: boolean;
}

function analyzeClaimedPapersInIsolation(
  params: Parameters<typeof resolveClaimedInlineAnalyses>[0],
): ReturnType<typeof resolveClaimedInlineAnalyses> {
  return resolveClaimedInlineAnalyses(params);
}

const inFlightInlineAnalysisResolutions = new Map<string, InFlightInlineAnalysisResolution>();

export interface ResolvedInlineAnalysisSuccess extends InlineAnalysisResult {
  inputFingerprint: string;
}

export interface ResolvedInlineAnalysisFailure {
  paperId: string;
  status: "error";
  failureKind: "cooldown" | "terminal";
  cooldownUntil?: string;
  retryRequiresExplicit: true;
}

export type ResolvedInlineAnalysisResult =
  | ResolvedInlineAnalysisSuccess
  | ResolvedInlineAnalysisFailure;

function waitForInFlightInlineAnalysis(
  entry: InFlightInlineAnalysisResolution,
  params: Pick<ResolveInlineAnalysisParams, "deadlineAt" | "signal">,
): Promise<ResolvedInlineAnalysisResult[]> {
  const subscriber = Symbol("inline-analysis-subscriber");
  const deadlineController = new AbortController();
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

  if (params.deadlineAt !== undefined) {
    const remainingMs = params.deadlineAt - Date.now();
    if (remainingMs <= 0) {
      deadlineController.abort(
        new DOMException("Inline analysis exceeded its caller deadline", "TimeoutError"),
      );
    } else {
      deadlineTimer = setTimeout(() => {
        deadlineController.abort(
          new DOMException("Inline analysis exceeded its caller deadline", "TimeoutError"),
        );
      }, remainingMs);
    }
  }

  const subscriberSignal = params.signal
    ? AbortSignal.any([params.signal, deadlineController.signal])
    : deadlineController.signal;
  entry.subscribers.add(subscriber);

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      subscriberSignal.removeEventListener("abort", handleAbort);
      entry.subscribers.delete(subscriber);
      if (!entry.settled && entry.subscribers.size === 0) {
        entry.controller.abort(
          new DOMException("Every inline analysis subscriber aborted", "AbortError"),
        );
      }
    };
    const handleAbort = () => {
      finish();
      reject(getAbortReason(subscriberSignal));
    };

    if (subscriberSignal.aborted) {
      handleAbort();
      return;
    }

    subscriberSignal.addEventListener("abort", handleAbort, { once: true });
    void entry.promise.then(
      (results) => {
        finish();
        resolve(results);
      },
      (error: unknown) => {
        finish();
        reject(normalizePromiseError(error));
      },
    );
  });
}

function waitForAbortableDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted || delayMs <= 0) return Promise.resolve();

  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    signal?.addEventListener("abort", finish, { once: true });
  });
}

function hasCurrentInlineAnalysis(paper: PapersBearingMetadata["papers"][number]): boolean {
  if (!hasUsableInlineAnalysisAbstract(paper.abstract)) {
    return true;
  }

  const inlineAnalysis = "inlineAnalysis" in paper ? paper.inlineAnalysis : undefined;
  if (
    inlineAnalysis?.version !== INLINE_ANALYSIS_VERSION ||
    inlineAnalysis.inputFingerprint !== buildInlineAnalysisInputFingerprint(paper)
  ) {
    return false;
  }

  return !isInlineAnalysisFailurePlaceholder(inlineAnalysis.analysis);
}

function toInlineAnalysisResult(
  record: PaperInlineAnalysisCacheRecord,
): ResolvedInlineAnalysisSuccess {
  return {
    paperId: record.paperId,
    inputFingerprint: record.inputFingerprint,
    analysis: record.analysis,
    source: record.source ?? "abstract",
  };
}

function toFailureResult(state: PaperInlineAnalysisGenerationState): ResolvedInlineAnalysisFailure {
  return {
    paperId: state.paperId,
    status: "error",
    failureKind: state.status === "cooldown_failed" ? "cooldown" : "terminal",
    ...(state.cooldownUntil ? { cooldownUntil: state.cooldownUntil } : {}),
    retryRequiresExplicit: true,
  };
}

function successfulCacheEntries(
  cachedByPaperId: Map<string, PaperInlineAnalysisCacheRecord>,
): Map<string, PaperInlineAnalysisCacheRecord> {
  return new Map(
    [...cachedByPaperId.entries()].filter(
      ([, record]) => !isInlineAnalysisFailurePlaceholder(record.analysis),
    ),
  );
}

async function waitForSharedInlineAnalysisCache(
  db: RepositoryDbHandle,
  identities: PaperInlineAnalysisIdentity[],
  listCachedInlineAnalyses: typeof listSharedPaperInlineAnalysisCache,
  deadlineAt: number,
  signal?: AbortSignal,
): Promise<Map<string, PaperInlineAnalysisCacheRecord>> {
  let latestCached = new Map<string, PaperInlineAnalysisCacheRecord>();
  for (const delayMs of SHARED_CACHE_POLL_DELAYS_MS) {
    if (signal?.aborted || Date.now() >= deadlineAt) break;
    latestCached = successfulCacheEntries(
      await raceWithAbort(listCachedInlineAnalyses(db, identities, signal), signal),
    );
    if (signal?.aborted) return latestCached;
    if (identities.every((identity) => latestCached.has(identity.paperId))) {
      return latestCached;
    }

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) break;
    await waitForAbortableDelay(Math.min(delayMs, remainingMs), signal);
  }

  if (signal?.aborted || Date.now() >= deadlineAt) return latestCached;
  return successfulCacheEntries(
    await raceWithAbort(listCachedInlineAnalyses(db, identities, signal), signal),
  );
}

async function waitForPeerInlineAnalysisCache(params: {
  db: RepositoryDbHandle;
  identities: PaperInlineAnalysisIdentity[];
  waitForCachedInlineAnalyses: WaitForCachedInlineAnalyses;
  peerObservationDeadlineAt: number;
  signal: AbortSignal;
}): Promise<Map<string, PaperInlineAnalysisCacheRecord>> {
  const waiterController = new AbortController();
  const waiterSignal = AbortSignal.any([waiterController.signal, params.signal]);
  const waiterTimer = setTimeout(
    () => {
      waiterController.abort(
        new DOMException("Inline analysis peer lease observation completed", "TimeoutError"),
      );
    },
    Math.max(0, params.peerObservationDeadlineAt - Date.now()),
  );
  let completedByOtherWorker: Map<string, PaperInlineAnalysisCacheRecord>;
  try {
    completedByOtherWorker = await params.waitForCachedInlineAnalyses(
      params.db,
      params.identities,
      waiterSignal,
    );
  } catch {
    completedByOtherWorker = new Map();
  } finally {
    clearTimeout(waiterTimer);
  }
  if (params.identities.every((identity) => completedByOtherWorker.has(identity.paperId))) {
    return completedByOtherWorker;
  }

  await waitForAbortableDelay(params.peerObservationDeadlineAt - Date.now(), params.signal);
  if (params.signal.aborted) throw getAbortReason(params.signal);
  throw new DOMException(
    "Inline analysis peer result was unavailable before the observation deadline",
    "TimeoutError",
  );
}

function createInlineAnalysisDeadlineContext(params: {
  resolutionStartedAt: number;
  deadlineAt?: number;
  signal?: AbortSignal;
}): {
  routeDeadlineAt: number;
  resolutionDeadlineAt: number;
  resolutionSignal: AbortSignal;
  ownerWorkSignal: AbortSignal;
  dispose: () => void;
} {
  const routeDeadlineAt =
    params.deadlineAt ?? params.resolutionStartedAt + INLINE_ANALYSIS_ROUTE_DEADLINE_MS;
  const routeController = new AbortController();
  const abortRoute = () => {
    routeController.abort(
      new DOMException("Inline analysis exceeded its route-entry deadline", "TimeoutError"),
    );
  };
  const routeDelayMs = routeDeadlineAt - Date.now();
  const routeTimer = routeDelayMs <= 0 ? undefined : setTimeout(abortRoute, routeDelayMs);
  if (routeDelayMs <= 0) abortRoute();
  const resolutionSignal = params.signal
    ? AbortSignal.any([params.signal, routeController.signal])
    : routeController.signal;
  const ownerController = new AbortController();
  const ownerWorkSignal = AbortSignal.any([ownerController.signal, resolutionSignal]);
  const ownerTimer = setTimeout(
    () => {
      ownerController.abort(
        new DOMException("Inline analysis owner work exceeded its route budget", "TimeoutError"),
      );
    },
    Math.max(
      0,
      Math.min(SHARED_CACHE_OWNER_WORK_BUDGET_MS, routeDeadlineAt - params.resolutionStartedAt),
    ),
  );

  return {
    routeDeadlineAt,
    resolutionDeadlineAt: routeDeadlineAt,
    resolutionSignal,
    ownerWorkSignal,
    dispose: () => {
      clearTimeout(ownerTimer);
      if (routeTimer) clearTimeout(routeTimer);
    },
  };
}

export async function hydrateSearchMetadataWithCachedInlineAnalysis<
  M extends PapersBearingMetadata,
>(
  params: HydrateSearchMetadataWithCachedInlineAnalysisParams<M>,
  deps: InlineAnalysisAccessDeps = {},
): Promise<M> {
  const hasUnanalyzableEmbeddedAnalysis = params.metadata.papers.some(
    (paper) => !hasUsableInlineAnalysisAbstract(paper.abstract) && "inlineAnalysis" in paper,
  );
  const sanitizedMetadata = hasUnanalyzableEmbeddedAnalysis
    ? ({
        ...params.metadata,
        papers: params.metadata.papers.map((paper) => {
          if (hasUsableInlineAnalysisAbstract(paper.abstract) || !("inlineAnalysis" in paper)) {
            return paper;
          }

          const paperWithoutInlineAnalysis = { ...paper };
          Reflect.deleteProperty(paperWithoutInlineAnalysis, "inlineAnalysis");
          return paperWithoutInlineAnalysis;
        }) as M["papers"],
      } as M)
    : params.metadata;

  const missingPapers = sanitizedMetadata.papers.filter(
    (paper): paper is M["papers"][number] & { abstract: string } =>
      hasUsableInlineAnalysisAbstract(paper.abstract) && !hasCurrentInlineAnalysis(paper),
  );

  if (missingPapers.length === 0) {
    return sanitizedMetadata;
  }

  const missingIdentities = params.cacheInputFingerprintByPaperId
    ? missingPapers.map((paper): PaperInlineAnalysisIdentity => {
        const inputFingerprint = params.cacheInputFingerprintByPaperId?.get(paper.paperId);
        if (!inputFingerprint) {
          throw new Error(`missing exact inline-analysis cache identity for ${paper.paperId}`);
        }
        return {
          paperId: paper.paperId,
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint,
        };
      })
    : buildInlineAnalysisCacheIdentities(missingPapers);

  const cachedByPaperId = await (
    deps.listCachedInlineAnalyses ?? listSharedPaperInlineAnalysisCache
  )(params.db, missingIdentities, params.signal);
  const successfulCachedByPaperId = successfulCacheEntries(cachedByPaperId);

  return {
    ...sanitizedMetadata,
    papers: sanitizedMetadata.papers.map((paper) => {
      if (hasCurrentInlineAnalysis(paper)) {
        return paper;
      }

      const cached = successfulCachedByPaperId.get(paper.paperId);
      if (!cached) {
        if ("inlineAnalysis" in paper) {
          const paperWithoutInlineAnalysis = { ...paper };
          Reflect.deleteProperty(paperWithoutInlineAnalysis, "inlineAnalysis");
          return paperWithoutInlineAnalysis;
        }
        return paper;
      }

      return {
        ...paper,
        inlineAnalysis: {
          version: cached.version,
          inputFingerprint: cached.inputFingerprint,
          analysis: cached.analysis,
          source: cached.source,
        },
      };
    }),
  };
}

function registerInFlightInlineAnalysis(params: {
  requestKey: string;
  promise: Promise<ResolvedInlineAnalysisResult[]>;
  controller: AbortController;
  dispose: () => void;
}): InFlightInlineAnalysisResolution {
  const entry: InFlightInlineAnalysisResolution = {
    promise: params.promise,
    controller: params.controller,
    subscribers: new Set(),
    settled: false,
  };
  entry.promise = params.promise.finally(() => {
    entry.settled = true;
    params.dispose();
    if (inFlightInlineAnalysisResolutions.get(params.requestKey) === entry) {
      inFlightInlineAnalysisResolutions.delete(params.requestKey);
    }
  });
  inFlightInlineAnalysisResolutions.set(params.requestKey, entry);
  // A caller may abort before another subscriber attaches. The shared promise
  // still owns cleanup and must never become an unhandled rejection.
  void entry.promise.catch(() => undefined);
  return entry;
}

function mergeResolvedInlineAnalysisResults(params: {
  papers: PaperInput[];
  cachedByPaperId: Map<string, PaperInlineAnalysisCacheRecord>;
  analyzedResults: InlineAnalysisResult[];
  completedByOtherWorker: Map<string, PaperInlineAnalysisCacheRecord>;
  failureStateByPaperId: Map<string, PaperInlineAnalysisGenerationState>;
}): ResolvedInlineAnalysisResult[] {
  const analyzedByPaperId = new Map(
    params.analyzedResults.map((result) => [result.paperId, result] as const),
  );
  const identityByPaperId = new Map(
    buildInlineAnalysisCacheIdentities(params.papers).map((identity) => [
      identity.paperId,
      identity,
    ]),
  );
  return params.papers.flatMap((paper): ResolvedInlineAnalysisResult[] => {
    const cached = params.cachedByPaperId.get(paper.paperId);
    if (cached) return [toInlineAnalysisResult(cached)];
    const analyzed = analyzedByPaperId.get(paper.paperId);
    const identity = identityByPaperId.get(paper.paperId);
    if (analyzed && identity) return [{ ...analyzed, inputFingerprint: identity.inputFingerprint }];
    const completedElsewhere = params.completedByOtherWorker.get(paper.paperId);
    if (completedElsewhere) return [toInlineAnalysisResult(completedElsewhere)];
    const failure = params.failureStateByPaperId.get(paper.paperId);
    return failure && (failure.status === "cooldown_failed" || failure.status === "terminal_failed")
      ? [toFailureResult(failure)]
      : [];
  });
}

export async function resolveInlineAnalysis(
  params: ResolveInlineAnalysisParams,
  deps: InlineAnalysisAccessDeps = {},
): Promise<ResolvedInlineAnalysisResult[]> {
  const { db, user } = await requireOwnerPrincipalAuth();
  const analyzablePapers = getCanonicalAnalyzablePapers(params.papers);
  if (analyzablePapers.length === 0) return [];

  const analyzableIdentities = buildInlineAnalysisCacheIdentities(analyzablePapers);
  const retryCommand = params.retryCommand ?? "automatic";
  const requestKey = `${buildInlineAnalysisRequestKey(analyzableIdentities)}:${retryCommand}`;
  const inFlight = inFlightInlineAnalysisResolutions.get(requestKey);
  if (inFlight) return waitForInFlightInlineAnalysis(inFlight, params);

  const resolutionStartedAt = Date.now();
  const sharedResolutionController = new AbortController();
  const {
    routeDeadlineAt,
    resolutionDeadlineAt,
    resolutionSignal,
    ownerWorkSignal,
    dispose: disposeDeadlineContext,
  } = createInlineAnalysisDeadlineContext({
    resolutionStartedAt,
    deadlineAt: params.deadlineAt,
    signal: sharedResolutionController.signal,
  });
  const resolvePromise = (async () => {
    const listCachedInlineAnalyses =
      deps.listCachedInlineAnalyses ?? listSharedPaperInlineAnalysisCache;
    const claimInlineAnalysisGeneration =
      deps.claimInlineAnalysisGeneration ?? claimSharedPaperInlineAnalysisGeneration;
    const analyzeInline = deps.analyzePapersInline ?? analyzePapersInline;
    const completeInlineAnalysisGeneration =
      deps.completeInlineAnalysisGeneration ?? completeSharedPaperInlineAnalysisGeneration;
    const releaseInlineAnalysisGeneration =
      deps.releaseInlineAnalysisGeneration ?? releaseSharedPaperInlineAnalysisGeneration;
    const listInlineAnalysisGenerationStates =
      deps.listInlineAnalysisGenerationStates ??
      (Object.keys(deps).length > 0
        ? () => Promise.resolve(new Map<string, PaperInlineAnalysisGenerationState>())
        : listSharedPaperInlineAnalysisGenerationStates);
    const failInlineAnalysisGeneration =
      deps.failInlineAnalysisGeneration ??
      (Object.keys(deps).length > 0
        ? (_db, entries) =>
            Promise.resolve(
              new Map(
                entries.map((entry) => [
                  entry.paperId,
                  {
                    ...entry,
                    failureCount: 1,
                    cooldownUntil: new Date(Date.now() + 300_000).toISOString(),
                    retryRequiresExplicit: true,
                  },
                ]),
              ),
            )
        : failSharedPaperInlineAnalysisGeneration);
    const terminalFailInlineAnalysisGeneration =
      deps.terminalFailInlineAnalysisGeneration ??
      (Object.keys(deps).length > 0
        ? (_db, entries) => Promise.resolve(new Set(entries.map((entry) => entry.paperId)))
        : terminalFailSharedPaperInlineAnalysisGeneration);
    const waitForCachedInlineAnalyses: WaitForCachedInlineAnalyses =
      deps.waitForCachedInlineAnalyses ??
      ((waitDb, identities, signal) =>
        waitForSharedInlineAnalysisCache(
          waitDb,
          identities,
          listCachedInlineAnalyses,
          resolutionDeadlineAt,
          signal,
        ));

    const successfulCachedByPaperId = successfulCacheEntries(
      await raceWithAbort(
        listCachedInlineAnalyses(db, analyzableIdentities, resolutionSignal),
        resolutionSignal,
      ),
    );
    const initialStateByPaperId = await raceWithAbort(
      listInlineAnalysisGenerationStates(db, analyzableIdentities, resolutionSignal),
      resolutionSignal,
    );
    const missingPapers = analyzablePapers.filter((paper) => {
      if (successfulCachedByPaperId.has(paper.paperId)) return false;
      const state = initialStateByPaperId.get(paper.paperId);
      if (!state || state.status === "pending") return true;
      if (state.status === "ready") return false;
      if (retryCommand === "automatic") return false;
      return (
        state.status === "terminal_failed" ||
        (state.cooldownUntil != null && Date.parse(state.cooldownUntil) <= Date.now())
      );
    });
    // Keep one request to one concurrent wave so primary, secondary, and the
    // durable transition remain inside the 30-second lease. Later visible
    // papers stay queued for the next explicit request wave.
    const generationCandidatePapers = missingPapers.slice(0, INLINE_ANALYSIS_REQUEST_PAPER_LIMIT);
    const generationCandidateIdentities =
      buildInlineAnalysisCacheIdentities(generationCandidatePapers);
    const missingIdentityByPaperId = new Map(
      generationCandidateIdentities.map((identity) => [identity.paperId, identity] as const),
    );
    const leaseToken = randomUUID();
    const claimedPaperIds = await raceWithAbort(
      claimInlineAnalysisGeneration(
        db,
        generationCandidateIdentities,
        leaseToken,
        SHARED_CACHE_INITIAL_LEASE_SECONDS,
        resolutionSignal,
        retryCommand,
      ),
      resolutionSignal,
    );
    const claimedPapers = generationCandidatePapers.filter((paper) =>
      claimedPaperIds.has(paper.paperId),
    );
    const claimedIdentities = generationCandidateIdentities.filter((identity) =>
      claimedPaperIds.has(identity.paperId),
    );
    const waitingIdentities = generationCandidateIdentities.filter(
      (identity) => !claimedPaperIds.has(identity.paperId),
    );
    const peerObservationDeadlineAt = Date.now() + SHARED_CACHE_PEER_OBSERVATION_BUDGET_MS;
    const waiterAbortController = new AbortController();
    const waiterSignal = AbortSignal.any([waiterAbortController.signal, resolutionSignal]);
    const completedByOtherWorkerPromise =
      waitingIdentities.length > 0
        ? waitForPeerInlineAnalysisCache({
            db,
            identities: waitingIdentities,
            waitForCachedInlineAnalyses,
            peerObservationDeadlineAt,
            signal: waiterSignal,
          })
        : Promise.resolve(new Map<string, PaperInlineAnalysisCacheRecord>());
    // The peer observation runs beside owner generation. Mark its rejection as
    // handled immediately even when owner generation settles after the peer budget;
    // the original promise still rejects at the final await below.
    void completedByOtherWorkerPromise.catch(() => undefined);
    let claimedResolution: Awaited<ReturnType<typeof analyzeClaimedPapersInIsolation>>;
    try {
      claimedResolution = await analyzeClaimedPapersInIsolation({
        db,
        ownerPrincipalId: user.id,
        claimedPapers,
        claimedIdentities,
        identityByPaperId: missingIdentityByPaperId,
        leaseToken,
        ownerWorkSignal,
        resolutionSignal,
        routeDeadlineAt,
        analyzeInline,
        completeInlineAnalysisGeneration,
        failInlineAnalysisGeneration,
        terminalFailInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
      });
    } catch (error) {
      waiterAbortController.abort();
      await completedByOtherWorkerPromise.catch(() => undefined);
      throw error;
    }
    const { successfulAnalyzedResults, transitionedStateByPaperId } = claimedResolution;

    let peerError: unknown;
    const completedByOtherWorker = await completedByOtherWorkerPromise.catch((error: unknown) => {
      peerError = error;
      return new Map<string, PaperInlineAnalysisCacheRecord>();
    });
    const persistedStateByPaperId = await listInlineAnalysisGenerationStates(
      db,
      analyzableIdentities,
      resolutionSignal,
    ).catch(() => initialStateByPaperId);
    const finalStateByPaperId = new Map([
      ...persistedStateByPaperId,
      ...transitionedStateByPaperId,
    ]);
    if (
      peerError &&
      waitingIdentities.some((identity) => {
        const state = finalStateByPaperId.get(identity.paperId);
        return state?.status !== "cooldown_failed" && state?.status !== "terminal_failed";
      })
    ) {
      throw normalizePromiseError(peerError);
    }
    return mergeResolvedInlineAnalysisResults({
      papers: analyzablePapers,
      cachedByPaperId: successfulCachedByPaperId,
      analyzedResults: successfulAnalyzedResults,
      completedByOtherWorker,
      failureStateByPaperId: finalStateByPaperId,
    });
  })();

  const inFlightEntry = registerInFlightInlineAnalysis({
    requestKey,
    promise: resolvePromise,
    controller: sharedResolutionController,
    dispose: disposeDeadlineContext,
  });

  return waitForInFlightInlineAnalysis(inFlightEntry, params);
}
