import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type EpistemeBreakerObservation,
  EpistemeUnavailableError,
  __resetEpistemeCircuitForTests,
  getEpistemeBreakerCapacitySnapshot,
  isEpistemeBreakerOpen,
  isEpistemeHost,
  runThroughEpistemeBreaker,
} from "@/app/server/external-http-gateway/episteme-circuit-breaker";

// 모듈 내부 상수와 동기화된 테스트 상수 — OPEN_MS = 15_000.
const OPEN_COOLDOWN = 15_000;

const ORIGINAL_TOTAL_CONCURRENCY_BUDGET = process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET;
const ORIGINAL_PEAK_INSTANCE_BUDGET = process.env.EPISTEME_PEAK_INSTANCE_BUDGET;
const ORIGINAL_MAX_CONCURRENCY_PER_INSTANCE = process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE;
const ORIGINAL_MAX_QUEUE = process.env.EPISTEME_MAX_QUEUE;

// 결과를 실패/성공으로 직접 분류하는 테스트용 classify (true = 실패).
const classifyByFlag = (result: { failed: boolean }): boolean => result.failed;

// runThroughEpistemeBreaker의 fn은 `() => Promise<T>`다. async 없이 Promise를 직접
// 반환해 require-await 린트를 만족시키면서 동일한 호출 형태를 유지한다.
const settle = (failed: boolean) => Promise.resolve({ failed });

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function recordFailures(count: number): Promise<number> {
  let fnCalls = 0;
  for (let i = 0; i < count; i++) {
    try {
      await runThroughEpistemeBreaker(() => {
        fnCalls++;
        return settle(true);
      }, classifyByFlag);
    } catch {
      // OPEN 이후 호출은 fn 없이 throw — 카운트에 포함되지 않는다.
    }
  }
  return fnCalls;
}

function clearCapacityEnv(): void {
  delete process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET;
  delete process.env.EPISTEME_PEAK_INSTANCE_BUDGET;
  delete process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE;
  delete process.env.EPISTEME_MAX_QUEUE;
}

function restoreCapacityEnv(): void {
  if (ORIGINAL_TOTAL_CONCURRENCY_BUDGET === undefined) {
    delete process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET;
  } else {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = ORIGINAL_TOTAL_CONCURRENCY_BUDGET;
  }

  if (ORIGINAL_PEAK_INSTANCE_BUDGET === undefined) {
    delete process.env.EPISTEME_PEAK_INSTANCE_BUDGET;
  } else {
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = ORIGINAL_PEAK_INSTANCE_BUDGET;
  }

  if (ORIGINAL_MAX_CONCURRENCY_PER_INSTANCE === undefined) {
    delete process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE;
  } else {
    process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = ORIGINAL_MAX_CONCURRENCY_PER_INSTANCE;
  }

  if (ORIGINAL_MAX_QUEUE === undefined) {
    delete process.env.EPISTEME_MAX_QUEUE;
  } else {
    process.env.EPISTEME_MAX_QUEUE = ORIGINAL_MAX_QUEUE;
  }
}

beforeEach(() => {
  clearCapacityEnv();
  __resetEpistemeCircuitForTests();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  __resetEpistemeCircuitForTests();
  restoreCapacityEnv();
});

describe("trip CLOSED → OPEN", () => {
  it("trips after MIN_VOLUME observations at/above the failure ratio, then fast-fails without calling fn", async () => {
    // 5회 연속 실패(5/5 = 1.0 ≥ 0.5) → OPEN. 6번째는 fn 없이 throw.
    const fnCalls = await recordFailures(5);
    expect(fnCalls).toBe(5);
    expect(isEpistemeBreakerOpen()).toBe(true);

    let sixthFnCalled = false;
    await expect(
      runThroughEpistemeBreaker(() => {
        sixthFnCalled = true;
        return settle(true);
      }, classifyByFlag),
    ).rejects.toBeInstanceOf(EpistemeUnavailableError);
    expect(sixthFnCalled).toBe(false);
  });

  it("does not trip below MIN_VOLUME even at 100% failure (pins the 5-observation floor)", async () => {
    // 4회 실패(4/4 = 1.0이지만 관측 4 < MIN_VOLUME 5) → 아직 trip하지 않는다.
    const fnCalls = await recordFailures(4);
    expect(fnCalls).toBe(4);
    expect(isEpistemeBreakerOpen()).toBe(false);

    // 5번째 호출도 fn을 실행하고(fast-fail 아님), 그 관측이 floor를 채워 OPEN으로 만든다.
    let fifthFnCalled = false;
    await runThroughEpistemeBreaker(() => {
      fifthFnCalled = true;
      return settle(true);
    }, classifyByFlag);
    expect(fifthFnCalled).toBe(true);
    expect(isEpistemeBreakerOpen()).toBe(true);
  });

  it("does not trip under partial degradation below the failure ratio", async () => {
    // 10회 중 3회 실패(0.3 < 0.5) → CLOSED 유지, 모든 호출이 fn을 실행한다.
    let fnCalls = 0;
    for (let i = 0; i < 10; i++) {
      const failed = i % 3 === 0 && i < 9; // 3회 실패 (i=0,3,6)
      await runThroughEpistemeBreaker(() => {
        fnCalls++;
        return settle(failed);
      }, classifyByFlag);
    }
    expect(fnCalls).toBe(10);
    expect(isEpistemeBreakerOpen()).toBe(false);
  });

  it("trips at the exact fifty-percent failure boundary", async () => {
    for (const failed of [false, false, false, true, true, true]) {
      await runThroughEpistemeBreaker(() => settle(failed), classifyByFlag);
    }

    expect(isEpistemeBreakerOpen()).toBe(true);
  });

  it("uses only the latest ten observations when deciding whether to trip", async () => {
    for (const failed of [false, false, false, false, false, false, true, true, true, true]) {
      await runThroughEpistemeBreaker(() => settle(failed), classifyByFlag);
    }
    expect(isEpistemeBreakerOpen()).toBe(false);

    await runThroughEpistemeBreaker(() => settle(true), classifyByFlag);

    expect(isEpistemeBreakerOpen()).toBe(true);
  });

  it("treats 4xx/empty-OK results as success so the ladder's smaller-batch fallback never trips the breaker", async () => {
    // classify가 false(성공)를 반환하는 결과는 5회 이상이라도 trip하지 않는다.
    let fnCalls = 0;
    for (let i = 0; i < 8; i++) {
      await runThroughEpistemeBreaker(() => {
        fnCalls++;
        return settle(false);
      }, classifyByFlag);
    }
    expect(fnCalls).toBe(8);
    expect(isEpistemeBreakerOpen()).toBe(false);
  });

  it("counts a thrown fn as a failure", async () => {
    let fnCalls = 0;
    for (let i = 0; i < 5; i++) {
      await expect(
        runThroughEpistemeBreaker(() => {
          fnCalls++;
          return Promise.reject(new Error("network down"));
        }, classifyByFlag),
      ).rejects.toThrow("network down");
    }
    expect(fnCalls).toBe(5);
    expect(isEpistemeBreakerOpen()).toBe(true);
  });
});

describe("OPEN fast-fail and half-open recovery", () => {
  it("transitions OPEN → HALF_OPEN after the cooldown and admits a single probe", async () => {
    vi.useFakeTimers();
    await recordFailures(5);
    expect(isEpistemeBreakerOpen()).toBe(true);

    // 쿨다운 전: 여전히 OPEN.
    vi.advanceTimersByTime(14_000);
    expect(isEpistemeBreakerOpen()).toBe(true);

    // 쿨다운 경과: HALF_OPEN — probe 한 번 허용.
    vi.advanceTimersByTime(1_500);
    expect(isEpistemeBreakerOpen()).toBe(false);
  });

  it("closes the circuit when the half-open probe succeeds", async () => {
    vi.useFakeTimers();
    await recordFailures(5);
    vi.advanceTimersByTime(OPEN_COOLDOWN);

    let probeCalls = 0;
    await runThroughEpistemeBreaker(() => {
      probeCalls++;
      return settle(false);
    }, classifyByFlag);
    expect(probeCalls).toBe(1);
    expect(isEpistemeBreakerOpen()).toBe(false);

    // CLOSED로 복귀했으므로 ring이 비고 다음 호출들이 정상 실행된다.
    let nextCalls = 0;
    await runThroughEpistemeBreaker(() => {
      nextCalls++;
      return settle(false);
    }, classifyByFlag);
    expect(nextCalls).toBe(1);
  });

  it("re-opens the circuit when the half-open probe fails", async () => {
    vi.useFakeTimers();
    await recordFailures(5);
    vi.advanceTimersByTime(OPEN_COOLDOWN);

    await expect(
      runThroughEpistemeBreaker(() => settle(true), classifyByFlag),
    ).resolves.toMatchObject({ failed: true });
    // probe 실패 → 즉시 OPEN, 다음 호출 fast-fail.
    expect(isEpistemeBreakerOpen()).toBe(true);
  });

  it("admits only one concurrent half-open probe", async () => {
    vi.useFakeTimers();
    await recordFailures(5);
    vi.advanceTimersByTime(OPEN_COOLDOWN);

    const gate = deferred<{ failed: boolean }>();
    let firstFnCalls = 0;
    const firstProbe = runThroughEpistemeBreaker(() => {
      firstFnCalls++;
      return gate.promise;
    }, classifyByFlag);

    // 첫 probe가 in-flight인 동안 두 번째 호출은 fn 없이 throw.
    let secondFnCalled = false;
    await expect(
      runThroughEpistemeBreaker(() => {
        secondFnCalled = true;
        return settle(false);
      }, classifyByFlag),
    ).rejects.toBeInstanceOf(EpistemeUnavailableError);
    expect(secondFnCalled).toBe(false);
    expect(firstFnCalls).toBe(1);

    gate.resolve({ failed: false });
    await firstProbe;
    expect(isEpistemeBreakerOpen()).toBe(false);
  });
});

describe("fleet capacity budget", () => {
  it("derives default per-instance capacity from the fleet total and peak instance budget", () => {
    const capacity = getEpistemeBreakerCapacitySnapshot();

    expect(capacity).toEqual({
      totalConcurrencyBudget: 20,
      peakInstanceBudget: 2,
      configuredMaxConcurrencyPerInstance: 8,
      projectedConcurrencyPerInstance: 10,
      maxConcurrency: 8,
      maxQueue: 12,
    });
  });

  it("uses the stricter per-instance cap when it is below the projected fleet budget", () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "12";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "2";
    process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = "3";

    expect(getEpistemeBreakerCapacitySnapshot()).toMatchObject({
      totalConcurrencyBudget: 12,
      peakInstanceBudget: 2,
      configuredMaxConcurrencyPerInstance: 3,
      projectedConcurrencyPerInstance: 6,
      maxConcurrency: 3,
      maxQueue: 12,
    });
  });

  it("allows an explicit queue limit without changing the active concurrency budget", () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "8";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "4";
    process.env.EPISTEME_MAX_QUEUE = "1";

    expect(getEpistemeBreakerCapacitySnapshot()).toMatchObject({
      projectedConcurrencyPerInstance: 2,
      maxConcurrency: 2,
      maxQueue: 1,
    });
  });

  it("fails closed when the fleet budget is below the peak instance count", () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "1";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "3";

    expect(getEpistemeBreakerCapacitySnapshot()).toMatchObject({
      projectedConcurrencyPerInstance: 0,
      maxConcurrency: 0,
      maxQueue: 0,
    });
  });

  it("falls back from blank, fractional, and non-positive capacity settings", () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "  ";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "1.5";
    process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = "0";
    process.env.EPISTEME_MAX_QUEUE = "not-a-number";

    expect(getEpistemeBreakerCapacitySnapshot()).toEqual({
      totalConcurrencyBudget: 20,
      peakInstanceBudget: 2,
      configuredMaxConcurrencyPerInstance: 8,
      projectedConcurrencyPerInstance: 10,
      maxConcurrency: 8,
      maxQueue: 12,
    });
  });
});

describe("bounded concurrency", () => {
  it("rejects immediately when fleet budget cannot allocate an instance slot", async () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "1";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "3";

    await expect(
      runThroughEpistemeBreaker(() => settle(false), classifyByFlag),
    ).rejects.toBeInstanceOf(EpistemeUnavailableError);
  });

  it("queues calls past the concurrency limit and rejects once the queue is full", async () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "2";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "1";
    process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = "8";
    process.env.EPISTEME_MAX_QUEUE = "3";

    const capacity = getEpistemeBreakerCapacitySnapshot();
    expect(capacity).toMatchObject({ maxConcurrency: 2, maxQueue: 3 });

    const gate = deferred<{ failed: boolean }>();
    const inFlight: Array<Promise<unknown>> = [];

    // effective 동시 슬롯을 모두 점유(미해결 fn으로 붙잡아 둔다).
    for (let i = 0; i < capacity.maxConcurrency; i++) {
      inFlight.push(
        runThroughEpistemeBreaker(() => gate.promise, classifyByFlag).catch(() => null),
      );
    }
    // maxQueue만큼은 큐에서 대기(아직 reject 안 됨).
    for (let i = 0; i < capacity.maxQueue; i++) {
      inFlight.push(
        runThroughEpistemeBreaker(() => gate.promise, classifyByFlag).catch(() => null),
      );
    }

    // 활성 슬롯 + 대기 큐를 초과한 다음 호출은 즉시 reject.
    await expect(
      runThroughEpistemeBreaker(() => settle(false), classifyByFlag),
    ).rejects.toBeInstanceOf(EpistemeUnavailableError);

    gate.resolve({ failed: false });
    await Promise.all(inFlight);
  });
});

describe("lane reservations and breaker observations", () => {
  it("rejects optional work when one process slot must stay reserved for core search", async () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "1";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "1";
    const observations: EpistemeBreakerObservation<{ failed: boolean }>[] = [];
    let fnCalled = false;

    await expect(
      runThroughEpistemeBreaker(
        () => {
          fnCalled = true;
          return settle(false);
        },
        classifyByFlag,
        "optional",
        (observation) => observations.push(observation),
      ),
    ).rejects.toMatchObject({
      name: "EpistemeUnavailableError",
      message: "Episteme circuit unavailable: optional lane has no reserved capacity",
      reason: "optional lane has no reserved capacity",
    });
    expect(fnCalled).toBe(false);
    expect(observations).toEqual([
      expect.objectContaining({
        lane: "optional",
        outcome: "rejected",
        rejectionReason: "optional lane has no reserved capacity",
        executionStarted: false,
        queued: false,
      }),
    ]);
  });

  it("lets core search use its reserved slot while optional work waits", async () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "2";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "1";
    process.env.EPISTEME_MAX_CONCURRENCY_PER_INSTANCE = "2";
    process.env.EPISTEME_MAX_QUEUE = "2";
    const gate = deferred<{ failed: boolean }>();
    let activeOptionalStarted = false;
    let queuedOptionalStarted = false;
    let coreStarted = false;

    const activeOptional = runThroughEpistemeBreaker(
      () => {
        activeOptionalStarted = true;
        return gate.promise;
      },
      classifyByFlag,
      "optional",
    );
    const queuedOptional = runThroughEpistemeBreaker(
      () => {
        queuedOptionalStarted = true;
        return settle(false);
      },
      classifyByFlag,
      "optional",
    );
    await Promise.resolve();
    expect(activeOptionalStarted).toBe(true);
    expect(queuedOptionalStarted).toBe(false);

    await expect(
      runThroughEpistemeBreaker(
        () => {
          coreStarted = true;
          return settle(false);
        },
        classifyByFlag,
        "core",
      ),
    ).resolves.toEqual({ failed: false });
    expect(coreStarted).toBe(true);
    expect(queuedOptionalStarted).toBe(false);

    gate.resolve({ failed: false });
    await Promise.all([activeOptional, queuedOptional]);
    expect(queuedOptionalStarted).toBe(true);
  });

  it("observes queue wait and load shedding exactly once without starting rejected work", async () => {
    process.env.EPISTEME_TOTAL_CONCURRENCY_BUDGET = "1";
    process.env.EPISTEME_PEAK_INSTANCE_BUDGET = "1";
    process.env.EPISTEME_MAX_QUEUE = "1";

    const gate = deferred<{ failed: boolean }>();
    const first = runThroughEpistemeBreaker(() => gate.promise, classifyByFlag);
    const queuedObservations: EpistemeBreakerObservation<{ failed: boolean }>[] = [];
    const rejectedObservations: EpistemeBreakerObservation<{ failed: boolean }>[] = [];
    const queued = runThroughEpistemeBreaker(
      () => gate.promise,
      classifyByFlag,
      "core",
      (observation) => queuedObservations.push(observation),
    );

    await expect(
      runThroughEpistemeBreaker(
        () => settle(false),
        classifyByFlag,
        "core",
        (observation) => rejectedObservations.push(observation),
      ),
    ).rejects.toMatchObject({ reason: "concurrency queue full" });

    expect(rejectedObservations).toHaveLength(1);
    expect(rejectedObservations[0]).toMatchObject({
      outcome: "rejected",
      rejectionReason: "concurrency queue full",
      executionStarted: false,
      queued: false,
      activeSlotsAtEntry: 1,
      queueDepthAtEntry: 1,
    });

    gate.resolve({ failed: false });
    await Promise.all([first, queued]);

    expect(queuedObservations).toHaveLength(1);
    expect(queuedObservations[0]).toMatchObject({
      outcome: "success",
      executionStarted: true,
      queued: true,
      activeSlotsAtStart: 1,
    });
    expect(queuedObservations[0]?.queueWaitMs).toBeGreaterThanOrEqual(0);
  });

  it("does not let an observer failure change the provider result", async () => {
    await expect(
      runThroughEpistemeBreaker(
        () => settle(false),
        classifyByFlag,
        "core",
        () => {
          throw new Error("observation sink unavailable");
        },
      ),
    ).resolves.toEqual({ failed: false });
  });

  it("classifies provider results and thrown executions in the emitted observation", async () => {
    const classified: EpistemeBreakerObservation<{ failed: boolean }>[] = [];
    await runThroughEpistemeBreaker(
      () => settle(true),
      classifyByFlag,
      "core",
      (observation) => classified.push(observation),
    );
    expect(classified).toEqual([
      expect.objectContaining({
        outcome: "classified-failure",
        result: { failed: true },
        executionStarted: true,
      }),
    ]);

    const executionErrors: EpistemeBreakerObservation<{ failed: boolean }>[] = [];
    const failure = new Error("provider unavailable");
    await expect(
      runThroughEpistemeBreaker(
        () => Promise.reject(failure),
        classifyByFlag,
        "core",
        (observation) => executionErrors.push(observation),
      ),
    ).rejects.toBe(failure);
    expect(executionErrors).toEqual([
      expect.objectContaining({
        outcome: "execution-error",
        result: undefined,
        executionStarted: true,
      }),
    ]);
  });

  it("rejects OPEN-circuit calls without consuming a concurrency slot", async () => {
    await recordFailures(5);
    expect(isEpistemeBreakerOpen()).toBe(true);
    const observations: EpistemeBreakerObservation<{ failed: boolean }>[] = [];

    // OPEN 상태에서 여러 호출을 던져도 슬롯을 잡지 않고 모두 fast-fail.
    for (let i = 0; i < 30; i++) {
      await expect(
        runThroughEpistemeBreaker(
          () => settle(false),
          classifyByFlag,
          "core",
          (observation) => observations.push(observation),
        ),
      ).rejects.toBeInstanceOf(EpistemeUnavailableError);
    }
    expect(observations).toHaveLength(30);
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          outcome: "rejected",
          rejectionReason: "circuit open",
          executionStarted: false,
          queued: false,
          activeSlotsAtEntry: 0,
          activeSlotsAtFinish: 0,
        }),
      ]),
    );
  });
});

describe("isEpistemeHost", () => {
  const originalEpisteme3Url = process.env.EPISTEME3_LITERATURE_API_URL;
  const originalEpistemeUrl = process.env.EPISTEME_LITERATURE_API_URL;
  const originalPublicBase = process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE;

  afterEach(() => {
    if (originalEpisteme3Url === undefined) delete process.env.EPISTEME3_LITERATURE_API_URL;
    else process.env.EPISTEME3_LITERATURE_API_URL = originalEpisteme3Url;
    if (originalEpistemeUrl === undefined) delete process.env.EPISTEME_LITERATURE_API_URL;
    else process.env.EPISTEME_LITERATURE_API_URL = originalEpistemeUrl;
    if (originalPublicBase === undefined) delete process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE;
    else process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE = originalPublicBase;
  });

  it("matches the default Episteme public base when no env override is set", () => {
    delete process.env.EPISTEME3_LITERATURE_API_URL;
    delete process.env.EPISTEME_LITERATURE_API_URL;
    delete process.env.NEXT_PUBLIC_EPISTEME_PUBLIC_BASE;
    expect(isEpistemeHost("https://sah.borca.ai/search?q=test")).toBe(true);
    expect(isEpistemeHost("https://api.semanticscholar.org/graph/v1/paper/search")).toBe(false);
  });

  it("follows the EPISTEME_LITERATURE_API_URL override host", () => {
    delete process.env.EPISTEME3_LITERATURE_API_URL;
    process.env.EPISTEME_LITERATURE_API_URL = "http://127.0.0.1:9";
    expect(isEpistemeHost("http://127.0.0.1:9/search")).toBe(true);
    expect(isEpistemeHost("https://sah.borca.ai/search")).toBe(false);
  });

  it("uses the E3-specific override as the canonical transport origin", () => {
    process.env.EPISTEME3_LITERATURE_API_URL = "http://127.0.0.1:10/api/v3";
    process.env.EPISTEME_LITERATURE_API_URL = "http://127.0.0.1:9";
    expect(isEpistemeHost("http://127.0.0.1:10/api/v3/search/papers")).toBe(true);
    expect(isEpistemeHost("http://127.0.0.1:9/api/v3/search/papers")).toBe(false);
  });

  it("returns false for malformed urls", () => {
    expect(isEpistemeHost("not-a-url")).toBe(false);
  });

  it("fails closed when the configured Episteme base is malformed", () => {
    delete process.env.EPISTEME3_LITERATURE_API_URL;
    process.env.EPISTEME_LITERATURE_API_URL = "not-a-url";
    expect(isEpistemeHost("https://sah.borca.ai/search")).toBe(false);
  });
});
