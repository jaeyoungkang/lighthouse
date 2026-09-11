/** Episteme 전용 literature transport: deadline, breaker, bounded connect retry. */

import { randomUUID } from "node:crypto";
import { EPISTEME3_API_ROUTES } from "@/app/lib/api-routes";
import {
  type EpistemeBreakerObservation,
  type EpistemeBreakerLane,
  EpistemeUnavailableError,
  isEpistemeHost,
  runThroughEpistemeBreaker,
} from "./episteme-circuit-breaker";

const EPISTEME_TRANSIENT_CONNECT_RETRY_LIMIT = 1;
const RETRIABLE_EPISTEME_CONNECT_ERROR_CODES = new Set(["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT"]);
const REQUEST_TIMEOUT = 10_000; // 기본 10초
const LARGE_SEARCH_REQUEST_TIMEOUT = 30_000; // broad query / limit 100 대응
const ALLOWED_EPISTEME3_PATHS = new Set<string>(Object.values(EPISTEME3_API_ROUTES));

const epistemeRuntimeInstanceId = randomUUID();
const epistemeRuntimeStartedAt = Date.now();
let epistemeObservationSequence = 0;

type EpistemeProviderOutcome =
  | "success"
  | "provider-4xx"
  | "provider-429"
  | "provider-5xx"
  | "timeout-or-network"
  | "caller-cancelled"
  | "circuit-open"
  | "half-open-busy"
  | "load-shed"
  | "circuit-open-while-queued"
  | "execution-error";

function getRequestTimeoutMs(url: string): number {
  try {
    const parsedUrl = new URL(url);
    // Search endpoints can take 12-25s for broad/common queries even at
    // small limits, so any search hits the longer budget.
    if (parsedUrl.pathname === EPISTEME3_API_ROUTES.SEARCH_PAPERS) {
      return LARGE_SEARCH_REQUEST_TIMEOUT;
    }
  } catch {
    return REQUEST_TIMEOUT;
  }

  return REQUEST_TIMEOUT;
}

function getRequestLogMeta(url: string) {
  try {
    const parsedUrl = new URL(url);
    const staticSuffixes = [
      "/papers/batch",
      "/papers/by-ref",
      "/papers/discover",
      "/search/papers",
      "/search/papers/capabilities",
      "/graph/citations",
    ];
    const path = staticSuffixes.some((suffix) => parsedUrl.pathname.endsWith(suffix))
      ? parsedUrl.pathname
      : parsedUrl.pathname.replace(/\/papers\/[^/]+(?=\/|$)/u, "/papers/:paperId");
    return {
      path,
      limit: parsedUrl.searchParams.get("limit"),
      offset: parsedUrl.searchParams.get("offset"),
    };
  } catch {
    return { path: url };
  }
}

function getEpistemeBreakerLane(url: string): EpistemeBreakerLane {
  try {
    const pathname = new URL(url).pathname;
    return pathname.endsWith("/papers/discover") || pathname.endsWith("/papers/batch")
      ? "optional"
      : "core";
  } catch {
    return "core";
  }
}

function assertEpistemeUrl(url: string): void {
  if (!isEpistemeHost(url)) {
    throw new TypeError("Literature transport only permits the configured Episteme host");
  }
  const pathname = new URL(url).pathname;
  if (!ALLOWED_EPISTEME3_PATHS.has(pathname)) {
    throw new TypeError("Literature transport only permits approved Episteme 3 API endpoints");
  }
}

function getHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": "lighthouse-search/1.0",
  };
}

function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = getRequestTimeoutMs(url);
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  // external signal과 linking
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        () => {
          controller.abort();
        },
        { once: true },
      );
    }
  }

  return fetch(url, { headers, signal: controller.signal, redirect: "error" }).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Episteme literature API를 호출한다. Cold-connect 오류만 한 번 재시도하고,
 * provider 응답과 다른 네트워크 오류는 그대로 breaker에 전달한다.
 */
export async function epistemeFetch(
  url: string,
  signal?: AbortSignal,
  options?: { lane?: EpistemeBreakerLane },
): Promise<Response | null> {
  assertEpistemeUrl(url);
  const headers = getHeaders();
  const requestMeta = getRequestLogMeta(url);
  return performRetriedEpistemeRequest({
    signal,
    epistemeBreakerLane: options?.lane ?? getEpistemeBreakerLane(url),
    requestMeta,
    requestFailedLabel: "request failed",
    finalRequestFailedLabel: "final request failed",
    runRequest: () => fetchWithTimeout(url, headers, signal),
  });
}

function postFetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, LARGE_SEARCH_REQUEST_TIMEOUT);

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        () => {
          controller.abort();
        },
        { once: true },
      );
    }
  }

  return fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
    redirect: "error",
  }).finally(() => {
    clearTimeout(timer);
  });
}

type RetriedEpistemeRequestParams = {
  signal?: AbortSignal;
  epistemeBreakerLane: EpistemeBreakerLane;
  requestMeta: ReturnType<typeof getRequestLogMeta>;
  requestFailedLabel: string;
  finalRequestFailedLabel: string;
  runRequest: () => Promise<Response>;
  onProviderCallStart?: () => void;
};

function getEpistemeProviderOutcome(
  observation: EpistemeBreakerObservation<Response | null>,
  signal?: AbortSignal,
): EpistemeProviderOutcome {
  if (observation.outcome === "rejected") {
    switch (observation.rejectionReason) {
      case "circuit open":
        return "circuit-open";
      case "half-open probe in flight":
        return "half-open-busy";
      case "circuit opened while queued":
        return "circuit-open-while-queued";
      case "optional lane has no reserved capacity":
      case "concurrency queue full":
      default:
        return "load-shed";
    }
  }
  if (observation.outcome === "execution-error") return "execution-error";

  const result = observation.result;
  if (result === null) return signal?.aborted ? "caller-cancelled" : "timeout-or-network";
  if (!result) return "execution-error";
  if (result.status === 429) return "provider-429";
  if (result.status >= 500) return "provider-5xx";
  if (result.status >= 400) return "provider-4xx";
  return "success";
}

function logEpistemeProviderObservation(
  params: RetriedEpistemeRequestParams,
  providerCallCount: number,
  observation: EpistemeBreakerObservation<Response | null>,
): void {
  const result = observation.result;
  const record = {
    schemaVersion: 1,
    event: "episteme_provider_observation",
    runtimeInstanceId: epistemeRuntimeInstanceId,
    sequence: ++epistemeObservationSequence,
    processUptimeMs: Date.now() - epistemeRuntimeStartedAt,
    lane: observation.lane,
    path: params.requestMeta.path,
    outcome: getEpistemeProviderOutcome(observation, params.signal),
    status: result instanceof Response ? result.status : null,
    providerCallStarted: providerCallCount > 0,
    retryCount: Math.max(0, providerCallCount - 1),
    queued: observation.queued,
    queueWaitMs: observation.queueWaitMs,
    providerDurationMs: observation.providerDurationMs,
    totalDurationMs: observation.totalDurationMs,
    activeSlotsAtEntry: observation.activeSlotsAtEntry,
    activeSlotsAtStart: observation.activeSlotsAtStart,
    activeSlotsAtFinish: observation.activeSlotsAtFinish,
    queueDepthAtEntry: observation.queueDepthAtEntry,
    queueDepthAtFinish: observation.queueDepthAtFinish,
    maxConcurrency: observation.capacity.maxConcurrency,
    maxQueue: observation.capacity.maxQueue,
    circuitStateAtEntry: observation.circuitStateAtEntry,
    circuitStateAtExit: observation.circuitStateAtExit,
  };

  console.info(`[episteme-provider-observation] ${JSON.stringify(record)}`);
}

/**
 * breaker용 결과 분류. true = 실패. null(네트워크/timeout)·5xx·429를 실패로 본다.
 * 4xx batch 거절은 성공으로 둬야, healthy한 큰 배치→작은 배치 fallback이 회로를
 * trip시키지 않는다. 이는 provider가 oversize 배치를 4xx(예: 413/400)로 거절한다는
 * 가정에 기댄다 — 만약 oversize를 5xx/429로 답하면 한 검색의 ladder step-down이
 * 실패로 분류돼 회로를 불필요하게 열 수 있다.
 */
function classifyEpistemeOutcome(result: Response | null): boolean {
  if (result === null) return true;
  return result.status >= 500 || result.status === 429;
}

async function performRetriedEpistemeRequest(
  inputParams: RetriedEpistemeRequestParams,
): Promise<Response | null> {
  // Episteme 호출을 process-local 회로 차단기 + 세마포어로 감싼다.
  // OPEN/probe-busy/큐 초과면 fn을 부르지 않고 즉시 null로 degrade한다 — 기존
  // 네트워크 실패 반환과 동일하므로 서비스 레이어의 degrade-to-null 경로가 그대로
  let providerCallCount = 0;
  const params: RetriedEpistemeRequestParams = {
    ...inputParams,
    onProviderCallStart: () => {
      providerCallCount++;
    },
  };
  try {
    // Client-abort(호출자 signal abort로 null이 된 경우)는 Episteme 건강 신호가
    // 아니다 — 사용자가 떠났거나 route가 요청을 접은 것이므로 breaker 실패로
    // 집계하지 않는다. 단 abort와 경합해도 provider가 실제 5xx/429 Response를
    // 돌려준 경우는 건강 신호이므로 그대로 실패로 집계하고, provider가 느려서
    // 우리 내부 timeout이 끊은 null은 호출자 signal이 살아 있으므로 실패로 남는다.
    return await runThroughEpistemeBreaker(
      () => runEpistemeRetryLoop(params),
      (result) =>
        classifyEpistemeOutcome(result) && !(result === null && params.signal?.aborted === true),
      params.epistemeBreakerLane,
      (observation) => {
        logEpistemeProviderObservation(params, providerCallCount, observation);
      },
    );
  } catch (error) {
    if (error instanceof EpistemeUnavailableError) return null;
    throw error;
  }
}

function getErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const errorWithCode = error as { code?: unknown; cause?: unknown };
  if (typeof errorWithCode.code === "string") return errorWithCode.code;

  const cause = errorWithCode.cause;
  if (typeof cause !== "object" || cause === null) return null;
  const causeCode = (cause as { code?: unknown }).code;
  return typeof causeCode === "string" ? causeCode : null;
}

function shouldRetryEpistemeConnectError(
  error: unknown,
  signal: AbortSignal | undefined,
  attempt: number,
): boolean {
  if (signal?.aborted || attempt >= EPISTEME_TRANSIENT_CONNECT_RETRY_LIMIT) return false;
  const errorCode = getErrorCode(error);
  return errorCode !== null && RETRIABLE_EPISTEME_CONNECT_ERROR_CODES.has(errorCode);
}

type ProviderRequestAttempt =
  | { outcome: "response"; response: Response }
  | { outcome: "error"; error: unknown };

async function runProviderRequestAttempt(
  params: RetriedEpistemeRequestParams,
): Promise<ProviderRequestAttempt> {
  try {
    params.onProviderCallStart?.();
    return { outcome: "response", response: await params.runRequest() };
  } catch (error) {
    return { outcome: "error", error };
  }
}

function logProviderRequestFailure(
  params: RetriedEpistemeRequestParams,
  error: unknown,
  attempt: number,
): boolean {
  const willRetry = shouldRetryEpistemeConnectError(error, params.signal, attempt);
  console.warn(
    `[literature-provider-fetch] ${willRetry ? params.requestFailedLabel : params.finalRequestFailedLabel}`,
    {
      attempt,
      errorName: error instanceof Error ? error.name : String(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      ...params.requestMeta,
    },
  );
  return willRetry;
}

async function runEpistemeRetryLoop(
  params: RetriedEpistemeRequestParams,
): Promise<Response | null> {
  const { signal } = params;

  // Episteme는 429/5xx backoff를 두지 않는다. 다만 cold connection establishment에서
  // 실측된 두 connect-timeout code만 같은 breaker 슬롯 안에서 한 번 다시 시도한다.
  const maxRetries = EPISTEME_TRANSIENT_CONNECT_RETRY_LIMIT;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) return null;
    const attemptResult = await runProviderRequestAttempt(params);
    if (attemptResult.outcome === "error") {
      if (logProviderRequestFailure(params, attemptResult.error, attempt)) continue;
      return null;
    }
    const { response } = attemptResult;

    // HTTP 응답은 첫 결과를 그대로 breaker에 넘긴다. 연결 성립 뒤
    // 429/5xx를 재시도해 provider 부하를 증폭시키지 않는다.
    return response;
  }

  return null;
}

/**
 * Literature provider API에 POST 요청을 보낸다 (paper batch API 등).
 * GET 전용인 epistemeFetch와 동일한 timeout·breaker·bounded cold-connect retry 정책을 적용한다.
 */
export async function epistemePostFetch(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response | null> {
  assertEpistemeUrl(url);
  const baseHeaders = getHeaders();
  const headers: Record<string, string> = {
    ...baseHeaders,
    "Content-Type": "application/json",
  };
  const requestMeta = getRequestLogMeta(url);
  return performRetriedEpistemeRequest({
    signal,
    epistemeBreakerLane: getEpistemeBreakerLane(url),
    requestMeta,
    requestFailedLabel: "POST request failed",
    finalRequestFailedLabel: "POST final request failed",
    runRequest: () => postFetchWithTimeout(url, headers, body, signal),
  });
}
