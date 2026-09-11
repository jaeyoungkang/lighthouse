/**
 * Episteme literature provider 회로 차단기 + 동시성 제한 (#183 K5).
 *
 * Why: Episteme(`sah.borca.ai`)가 하드 저하(sustained 5xx / 연결 실패)에 빠지면,
 * 과거 keyword-result graph-support ladder와 동시 검색이 매 호출 timeout을 그대로
 * 곱해 graph-support p95를 증폭시켰다(baseline: 5.4→7.5s). 현재 ladder는 은퇴했지만
 * 라이브러리 preflight와 graph surface 호출은 같은 보호가 필요하다. 이 모듈은 단일
 * chokepoint(`literature-provider-fetch.ts`의 `performRetriedEpistemeRequest`)를 감싸, sustained 실패를
 * 관측하면 회로를 OPEN으로 돌려 추가 호출을 즉시 fast-fail(null degrade)시킨다.
 * 부분 저하(예: 30% 실패)에서는 CLOSED를 유지해 오늘의 성공 호출을 보존한다.
 *
 * 사용자-facing 계약은 불변이다: 차단된 호출은 기존 네트워크 실패와 똑같이 null로
 * 반환되어, 서비스 레이어의 degrade-to-null 경로(graph-support 생략, "지금 불러오지
 * 못했다" 안내)가 그대로 닫는다(aspect:provider-failure-degraded-mode 의미 유지).
 *
 * 상태와 동시성 카운터는 process-local이다. 그래서 슬롯 수는 고정 상수가 아니라
 * 운영 fleet budget을 peak instance budget으로 나눈 값에서 파생한다. Redis 같은
 * cross-instance shared counter는 아니지만, 관측한 peak instance 예산으로
 * per-instance 상한을 낮춰 provider fan-out을 먼저 제한한다.
 *
 * 순환 import를 피하기 위해 Episteme host와 API base 해석은 server service가 아니라
 * `app/lib/episteme-config.ts`가 소유한다.
 */

import { getEpistemeOrigin } from "@/app/lib/episteme-config";

const SAMPLE_SIZE = 10; // 최근 관측 ring buffer 크기
const MIN_VOLUME = 5; // trip 판정에 필요한 최소 관측 수
const FAILURE_RATIO = 0.5; // failures/observed 가 이 비율 이상이면 trip
const OPEN_MS = 15_000; // OPEN 쿨다운 — 회복을 다시 시험하기까지의 half-open probe 주기.
// 특정 요청 timeout에 묶이지 않는다(감싸는 Episteme search/neighborhood 호출은 최대 30s를 쓴다).
const DEFAULT_EPISTEME_TOTAL_CONCURRENCY_BUDGET = 20;
const DEFAULT_EPISTEME_PEAK_INSTANCE_BUDGET = 2;
const DEFAULT_EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = 8;
const DEFAULT_EPISTEME_MAX_QUEUE = 12;

export type EpistemeCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export type EpistemeBreakerLane = "core" | "optional";

export type EpistemeUnavailableReason =
  | "circuit open"
  | "half-open probe in flight"
  | "optional lane has no reserved capacity"
  | "concurrency queue full"
  | "circuit opened while queued";

export type EpistemeBreakerObservation<T> = {
  lane: EpistemeBreakerLane;
  capacity: EpistemeBreakerCapacitySnapshot;
  circuitStateAtEntry: EpistemeCircuitState;
  circuitStateAtExit: EpistemeCircuitState;
  outcome: "success" | "classified-failure" | "execution-error" | "rejected";
  result?: T;
  rejectionReason?: EpistemeUnavailableReason;
  executionStarted: boolean;
  queued: boolean;
  queueWaitMs: number;
  providerDurationMs: number | null;
  totalDurationMs: number;
  activeSlotsAtEntry: number;
  activeSlotsAtStart: number | null;
  activeSlotsAtFinish: number;
  queueDepthAtEntry: number;
  queueDepthAtFinish: number;
};

export type EpistemeBreakerObserver<T> = (observation: EpistemeBreakerObservation<T>) => void;

type CircuitLaneState = {
  circuitState: EpistemeCircuitState;
  openedAt: number;
  outcomeRing: boolean[];
  halfOpenProbeInFlight: boolean;
};

export type EpistemeBreakerCapacitySnapshot = {
  totalConcurrencyBudget: number;
  peakInstanceBudget: number;
  configuredMaxConcurrencyPerInstance: number;
  projectedConcurrencyPerInstance: number;
  maxConcurrency: number;
  maxQueue: number;
};

function createCircuitLaneState(): CircuitLaneState {
  return {
    circuitState: "CLOSED",
    openedAt: 0,
    outcomeRing: [],
    halfOpenProbeInFlight: false,
  };
}

const circuitLanes: Record<EpistemeBreakerLane, CircuitLaneState> = {
  core: createCircuitLaneState(),
  optional: createCircuitLaneState(),
};

let activeSlots = 0;
const activeSlotsByLane: Record<EpistemeBreakerLane, number> = {
  core: 0,
  optional: 0,
};
type SlotWaiter = {
  resolve: () => void;
  reject: (error: Error) => void;
};
const slotWaiters: Record<EpistemeBreakerLane, SlotWaiter[]> = {
  core: [],
  optional: [],
};

/** 회로가 OPEN이거나 half-open probe가 막혔을 때 던지는, fast-fail용 에러. */
export class EpistemeUnavailableError extends Error {
  constructor(public readonly reason: EpistemeUnavailableReason) {
    super(`Episteme circuit unavailable: ${reason}`);
    this.name = "EpistemeUnavailableError";
  }
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function readOptionalPositiveIntegerEnv(name: string): number | null {
  const raw = process.env[name]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  return parsed;
}

export function getEpistemeBreakerCapacitySnapshot(): EpistemeBreakerCapacitySnapshot {
  const totalConcurrencyBudget = readPositiveIntegerEnv(
    "EPISTEME_TOTAL_CONCURRENCY_BUDGET",
    DEFAULT_EPISTEME_TOTAL_CONCURRENCY_BUDGET,
  );
  const peakInstanceBudget = readPositiveIntegerEnv(
    "EPISTEME_PEAK_INSTANCE_BUDGET",
    DEFAULT_EPISTEME_PEAK_INSTANCE_BUDGET,
  );
  const configuredMaxConcurrencyPerInstance = readPositiveIntegerEnv(
    "EPISTEME_MAX_CONCURRENCY_PER_INSTANCE",
    DEFAULT_EPISTEME_MAX_CONCURRENCY_PER_INSTANCE,
  );
  const projectedConcurrencyPerInstance = Math.floor(totalConcurrencyBudget / peakInstanceBudget);
  const maxConcurrency = Math.min(
    configuredMaxConcurrencyPerInstance,
    projectedConcurrencyPerInstance,
  );
  const maxQueue =
    maxConcurrency === 0
      ? 0
      : (readOptionalPositiveIntegerEnv("EPISTEME_MAX_QUEUE") ?? DEFAULT_EPISTEME_MAX_QUEUE);

  return {
    totalConcurrencyBudget,
    peakInstanceBudget,
    configuredMaxConcurrencyPerInstance,
    projectedConcurrencyPerInstance,
    maxConcurrency,
    maxQueue,
  };
}

function nowMs(): number {
  return Date.now();
}

/**
 * OPEN 쿨다운이 지났으면 HALF_OPEN으로 전이하고, 현재 상태를 반환한다. 상태
 * 조회/획득 직전에 호출한다. 반환값을 쓰면 모듈 변수 narrowing이 await/재진입
 * 사이에 잘못 좁혀지는 것을 피한다.
 */
function advanceState(lane: EpistemeBreakerLane): EpistemeCircuitState {
  const state = circuitLanes[lane];
  if (state.circuitState === "OPEN" && nowMs() - state.openedAt >= OPEN_MS) {
    state.circuitState = "HALF_OPEN";
    state.halfOpenProbeInFlight = false;
  }
  return state.circuitState;
}

function tripOpen(lane: EpistemeBreakerLane): void {
  const state = circuitLanes[lane];
  state.circuitState = "OPEN";
  state.openedAt = nowMs();
  state.halfOpenProbeInFlight = false;
}

function closeCircuit(lane: EpistemeBreakerLane): void {
  const state = circuitLanes[lane];
  state.circuitState = "CLOSED";
  state.outcomeRing.length = 0;
  state.halfOpenProbeInFlight = false;
}

function recordOutcome(lane: EpistemeBreakerLane, failed: boolean, isProbe: boolean): void {
  const state = circuitLanes[lane];
  if (isProbe) {
    // half-open probe 결과가 회복 여부를 결정한다.
    if (failed) tripOpen(lane);
    else closeCircuit(lane);
    return;
  }

  state.outcomeRing.push(failed);
  if (state.outcomeRing.length > SAMPLE_SIZE) state.outcomeRing.shift();

  // 이미 다른 호출이 trip시켰으면 다시 trip하지 않는다(쿨다운 연장 방지).
  if (state.circuitState !== "CLOSED") return;
  if (state.outcomeRing.length < MIN_VOLUME) return;

  const failures = state.outcomeRing.reduce((count, isFailure) => count + (isFailure ? 1 : 0), 0);
  if (failures / state.outcomeRing.length >= FAILURE_RATIO) {
    tripOpen(lane);
  }
}

function optionalConcurrencyLimit(maxConcurrency: number): number {
  // Always reserve one slot for keyword search. With an effective one-slot
  // process budget, optional graph work fast-fails instead of occupying the
  // only slot and preventing keyword-only degradation.
  return Math.max(0, maxConcurrency - 1);
}

function canAcquireSlot(lane: EpistemeBreakerLane, maxConcurrency: number): boolean {
  if (activeSlots >= maxConcurrency) return false;
  return lane === "core" || activeSlotsByLane.optional < optionalConcurrencyLimit(maxConcurrency);
}

function grantSlot(lane: EpistemeBreakerLane, waiter?: SlotWaiter): void {
  activeSlots++;
  activeSlotsByLane[lane]++;
  waiter?.resolve();
}

function acquireSlot(lane: EpistemeBreakerLane): Promise<void> {
  const capacity = getEpistemeBreakerCapacitySnapshot();
  if (lane === "optional" && optionalConcurrencyLimit(capacity.maxConcurrency) === 0) {
    return Promise.reject(new EpistemeUnavailableError("optional lane has no reserved capacity"));
  }
  if (canAcquireSlot(lane, capacity.maxConcurrency)) {
    grantSlot(lane);
    return Promise.resolve();
  }
  if (slotWaiters[lane].length >= capacity.maxQueue) {
    return Promise.reject(new EpistemeUnavailableError("concurrency queue full"));
  }
  return new Promise<void>((resolve, reject) => {
    slotWaiters[lane].push({ resolve, reject });
  });
}

function drainSlotWaiters(): void {
  const { maxConcurrency } = getEpistemeBreakerCapacitySnapshot();
  while (activeSlots < maxConcurrency) {
    const coreWaiter = slotWaiters.core.shift();
    if (coreWaiter) {
      grantSlot("core", coreWaiter);
      continue;
    }
    if (activeSlotsByLane.optional >= optionalConcurrencyLimit(maxConcurrency)) return;
    const optionalWaiter = slotWaiters.optional.shift();
    if (!optionalWaiter) return;
    grantSlot("optional", optionalWaiter);
  }
}

function releaseSlot(lane: EpistemeBreakerLane): void {
  activeSlots = Math.max(0, activeSlots - 1);
  activeSlotsByLane[lane] = Math.max(0, activeSlotsByLane[lane] - 1);
  drainSlotWaiters();
}

function totalQueueDepth(): number {
  return slotWaiters.core.length + slotWaiters.optional.length;
}

function notifyObserver<T>(
  observer: EpistemeBreakerObserver<T> | undefined,
  observation: EpistemeBreakerObservation<T>,
): void {
  try {
    observer?.(observation);
  } catch {
    // 관측 실패가 provider 호출이나 사용자 응답을 바꾸면 안 된다.
  }
}

/**
 * ladder guard용 상태 조회. OPEN→HALF_OPEN 쿨다운 전이를 advance한 뒤, 다음 호출이
 * 즉시 fast-fail될지를 반환한다. HALF_OPEN에서 probe가 비어 있으면 false(한 번의
 * probe 시도 허용), probe가 떠 있으면 true.
 */
export function isEpistemeBreakerOpen(lane: EpistemeBreakerLane = "core"): boolean {
  const circuitState = advanceState(lane);
  const state = circuitLanes[lane];
  if (circuitState === "OPEN") return true;
  if (circuitState === "HALF_OPEN" && state.halfOpenProbeInFlight) return true;
  return false;
}

/**
 * Episteme 호출을 회로 차단기 + 세마포어로 감싼다. OPEN/probe-busy/큐 초과면
 * `fn`을 호출하지 않고 `EpistemeUnavailableError`를 던진다. 그 외에는 슬롯을 잡고
 * `fn()`을 실행한 뒤 `classify(result)`로 실패 여부를 판정해 회로에 기록한다.
 *
 * `classify`는 결과가 실패면 true를 반환한다(`literature-provider-fetch`: null·5xx·429 = 실패,
 * 4xx batch 거절 = 성공).
 */
export async function runThroughEpistemeBreaker<T>(
  fn: () => Promise<T>,
  classify: (result: T) => boolean,
  lane: EpistemeBreakerLane = "core",
  observer?: EpistemeBreakerObserver<T>,
): Promise<T> {
  const totalStartedAt = nowMs();
  const capacity = getEpistemeBreakerCapacitySnapshot();
  const activeSlotsAtEntry = activeSlots;
  const queueDepthAtEntry = totalQueueDepth();
  const state = circuitLanes[lane];
  const entryState = advanceState(lane);

  const notifyRejected = (
    reason: EpistemeUnavailableReason,
    queued: boolean,
    queueWaitMs: number,
  ): void => {
    notifyObserver(observer, {
      lane,
      capacity,
      circuitStateAtEntry: entryState,
      circuitStateAtExit: state.circuitState,
      outcome: "rejected",
      rejectionReason: reason,
      executionStarted: false,
      queued,
      queueWaitMs,
      providerDurationMs: null,
      totalDurationMs: nowMs() - totalStartedAt,
      activeSlotsAtEntry,
      activeSlotsAtStart: null,
      activeSlotsAtFinish: activeSlots,
      queueDepthAtEntry,
      queueDepthAtFinish: totalQueueDepth(),
    });
  };

  if (entryState === "OPEN") {
    const reason = "circuit open";
    notifyRejected(reason, false, 0);
    throw new EpistemeUnavailableError(reason);
  }
  if (entryState === "HALF_OPEN" && state.halfOpenProbeInFlight) {
    const reason = "half-open probe in flight";
    notifyRejected(reason, false, 0);
    throw new EpistemeUnavailableError(reason);
  }

  let isProbe = entryState === "HALF_OPEN";
  if (isProbe) state.halfOpenProbeInFlight = true;

  const slotWaitStartedAt = nowMs();
  const hasOptionalCapacity =
    lane === "core" || optionalConcurrencyLimit(capacity.maxConcurrency) > 0;
  const queued =
    hasOptionalCapacity &&
    !canAcquireSlot(lane, capacity.maxConcurrency) &&
    slotWaiters[lane].length < capacity.maxQueue;
  try {
    await acquireSlot(lane);
  } catch (error) {
    if (isProbe) state.halfOpenProbeInFlight = false;
    if (error instanceof EpistemeUnavailableError) {
      notifyRejected(error.reason, queued, queued ? nowMs() - slotWaitStartedAt : 0);
    }
    throw error;
  }
  const slotAcquiredAt = nowMs();
  const queueWaitMs = slotAcquiredAt - slotWaitStartedAt;

  // 큐에서 대기하는 동안 회로가 trip됐을 수 있으니 슬롯 획득 후 재확인한다.
  const stateAfterAcquire = advanceState(lane);
  if (stateAfterAcquire === "OPEN") {
    releaseSlot(lane);
    if (isProbe) state.halfOpenProbeInFlight = false;
    const reason = "circuit opened while queued";
    notifyRejected(reason, queued, queueWaitMs);
    throw new EpistemeUnavailableError(reason);
  }
  if (!isProbe && stateAfterAcquire === "HALF_OPEN") {
    if (state.halfOpenProbeInFlight) {
      releaseSlot(lane);
      const reason = "half-open probe in flight";
      notifyRejected(reason, queued, queueWaitMs);
      throw new EpistemeUnavailableError(reason);
    }
    isProbe = true;
    state.halfOpenProbeInFlight = true;
  }

  const activeSlotsAtStart = activeSlots;
  let observationOutcome: EpistemeBreakerObservation<T>["outcome"] = "execution-error";
  let observationResult: T | undefined;
  try {
    const result = await fn();
    observationResult = result;
    const classifiedFailure = classify(result);
    observationOutcome = classifiedFailure ? "classified-failure" : "success";
    recordOutcome(lane, classifiedFailure, isProbe);
    return result;
  } catch (error) {
    recordOutcome(lane, true, isProbe);
    throw error;
  } finally {
    releaseSlot(lane);
    notifyObserver(observer, {
      lane,
      capacity,
      circuitStateAtEntry: entryState,
      circuitStateAtExit: state.circuitState,
      outcome: observationOutcome,
      result: observationResult,
      executionStarted: true,
      queued,
      queueWaitMs,
      providerDurationMs: nowMs() - slotAcquiredAt,
      totalDurationMs: nowMs() - totalStartedAt,
      activeSlotsAtEntry,
      activeSlotsAtStart,
      activeSlotsAtFinish: activeSlots,
      queueDepthAtEntry,
      queueDepthAtFinish: totalQueueDepth(),
    });
  }
}

/**
 * 주어진 outbound URL이 Episteme literature origin인지 판별한다. `literature-provider-fetch`의
 * Episteme transport 경계에서 configured Episteme origin만 회로 차단기에 넣기
 * 위해 쓴다. env는 `episteme-literature.ts`의 base URL 해석 규칙을 그대로 따른다.
 */
export function isEpistemeHost(url: string): boolean {
  const epistemeOrigin = getEpistemeOrigin();
  if (!epistemeOrigin) return false;
  try {
    return new URL(url).origin.toLowerCase() === epistemeOrigin;
  } catch {
    return false;
  }
}

/** 테스트 전용 — 모듈 회로 상태와 세마포어 카운터를 초기화한다. */
export function __resetEpistemeCircuitForTests(): void {
  for (const lane of Object.values(circuitLanes)) {
    lane.circuitState = "CLOSED";
    lane.openedAt = 0;
    lane.outcomeRing.length = 0;
    lane.halfOpenProbeInFlight = false;
  }
  activeSlots = 0;
  activeSlotsByLane.core = 0;
  activeSlotsByLane.optional = 0;
  slotWaiters.core.length = 0;
  slotWaiters.optional.length = 0;
}
