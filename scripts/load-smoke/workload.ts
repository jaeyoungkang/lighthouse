// Deterministic sustained-workload schedulers for the load-smoke runner.
//
// These functions own only client-side arrival/admission semantics. They do not
// infer server queue depth, provider retries, or production fleet capacity.

export interface WorkloadClock {
  now(): number;
  sleep(durationMs: number): Promise<void>;
}

const realClock: WorkloadClock = {
  now: () => performance.now(),
  sleep: (durationMs) =>
    new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    }),
};

interface SustainedWorkloadBase<T> {
  durationMs: number;
  execute(
    userIndex: number,
    workloadStartedAt: number,
    closedWorkerIndex: number | null,
  ): Promise<T>;
  clock?: WorkloadClock;
}

export interface SustainedClosedWorkload<T> extends SustainedWorkloadBase<T> {
  concurrency: number;
}

export interface SustainedOpenWorkload<T> extends SustainedWorkloadBase<T> {
  arrivalRatePerSecond: number;
  maxInFlight: number;
}

export interface SustainedWorkloadExecution<T> {
  arrivalModel: "closed" | "open";
  configuredDurationMs: number;
  wallClockMs: number;
  scheduledArrivals: number;
  admittedJourneys: number;
  completedJourneys: number;
  shedArrivals: number;
  maxInFlight: number;
  achievedThroughputPerSecond: number;
  results: T[];
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number`);
  }
}

function throughput(completedJourneys: number, wallClockMs: number): number {
  return wallClockMs <= 0 ? 0 : completedJourneys / (wallClockMs / 1_000);
}

/**
 * Closed model: a fixed number of workers repeatedly start a new journey only
 * after their previous journey completes. Duration bounds the admission window;
 * wall-clock includes the final drain.
 */
export async function runSustainedClosed<T>(
  workload: SustainedClosedWorkload<T>,
): Promise<SustainedWorkloadExecution<T>> {
  assertPositiveFinite(workload.durationMs, "durationMs");
  if (!Number.isInteger(workload.concurrency) || workload.concurrency <= 0) {
    throw new Error("concurrency must be a positive integer");
  }

  const clock = workload.clock ?? realClock;
  const workloadStartedAt = clock.now();
  const admissionDeadline = workloadStartedAt + workload.durationMs;
  const results: T[] = [];
  let nextUserIndex = 0;
  let completedJourneys = 0;
  let inFlight = 0;
  let maxInFlight = 0;

  const worker = async (workerIndex: number): Promise<void> => {
    while (clock.now() < admissionDeadline) {
      const userIndex = nextUserIndex;
      nextUserIndex += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        results[userIndex] = await workload.execute(userIndex, workloadStartedAt, workerIndex);
        completedJourneys += 1;
      } finally {
        inFlight -= 1;
      }
    }
  };

  await Promise.all(
    Array.from({ length: workload.concurrency }, (_unused, workerIndex) => worker(workerIndex)),
  );
  const wallClockMs = clock.now() - workloadStartedAt;

  return {
    arrivalModel: "closed",
    configuredDurationMs: workload.durationMs,
    wallClockMs,
    scheduledArrivals: nextUserIndex,
    admittedJourneys: nextUserIndex,
    completedJourneys,
    shedArrivals: 0,
    maxInFlight,
    achievedThroughputPerSecond: throughput(completedJourneys, wallClockMs),
    results,
  };
}

/**
 * Open model: arrivals are scheduled at a fixed rate independently of request
 * completion. The client never builds an unbounded backlog: an arrival is shed
 * immediately when maxInFlight is already occupied. Duration bounds arrivals;
 * wall-clock includes the final drain.
 */
export async function runSustainedOpen<T>(
  workload: SustainedOpenWorkload<T>,
): Promise<SustainedWorkloadExecution<T>> {
  assertPositiveFinite(workload.durationMs, "durationMs");
  assertPositiveFinite(workload.arrivalRatePerSecond, "arrivalRatePerSecond");
  if (!Number.isInteger(workload.maxInFlight) || workload.maxInFlight <= 0) {
    throw new Error("maxInFlight must be a positive integer");
  }

  const clock = workload.clock ?? realClock;
  const workloadStartedAt = clock.now();
  const admissionDeadline = workloadStartedAt + workload.durationMs;
  const arrivalIntervalMs = 1_000 / workload.arrivalRatePerSecond;
  const results: T[] = [];
  const executions: Array<Promise<void>> = [];
  let scheduledArrivals = 0;
  let admittedJourneys = 0;
  let completedJourneys = 0;
  let shedArrivals = 0;
  let inFlight = 0;
  let maxInFlight = 0;

  for (
    let scheduledAt = workloadStartedAt;
    scheduledAt < admissionDeadline;
    scheduledAt = workloadStartedAt + scheduledArrivals * arrivalIntervalMs
  ) {
    await clock.sleep(Math.max(0, scheduledAt - clock.now()));
    if (clock.now() >= admissionDeadline) break;
    scheduledArrivals += 1;

    if (inFlight >= workload.maxInFlight) {
      shedArrivals += 1;
      continue;
    }

    const userIndex = admittedJourneys;
    admittedJourneys += 1;
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const execution = workload
      .execute(userIndex, workloadStartedAt, null)
      .then((result) => {
        results[userIndex] = result;
        completedJourneys += 1;
      })
      .finally(() => {
        inFlight -= 1;
      });
    executions.push(execution);
  }

  await clock.sleep(Math.max(0, admissionDeadline - clock.now()));
  await Promise.all(executions);
  const wallClockMs = clock.now() - workloadStartedAt;

  return {
    arrivalModel: "open",
    configuredDurationMs: workload.durationMs,
    wallClockMs,
    scheduledArrivals,
    admittedJourneys,
    completedJourneys,
    shedArrivals,
    maxInFlight,
    achievedThroughputPerSecond: throughput(completedJourneys, wallClockMs),
    results,
  };
}
