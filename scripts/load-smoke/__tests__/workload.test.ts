import { describe, expect, it } from "vitest";
import { runSustainedClosed, runSustainedOpen, type WorkloadClock } from "../workload";

describe("runSustainedClosed", () => {
  it("holds fixed concurrency and stops new admissions at the duration boundary", async () => {
    let now = 100;
    let active = 0;
    let observedMax = 0;
    const clock: WorkloadClock = {
      now: () => now,
      sleep: () => Promise.resolve(),
    };

    const execution = await runSustainedClosed({
      concurrency: 2,
      durationMs: 25,
      clock,
      execute: async (userIndex) => {
        active += 1;
        observedMax = Math.max(observedMax, active);
        await Promise.resolve();
        now += 10;
        active -= 1;
        return userIndex;
      },
    });

    expect(execution).toMatchObject({
      arrivalModel: "closed",
      configuredDurationMs: 25,
      wallClockMs: 40,
      scheduledArrivals: 4,
      admittedJourneys: 4,
      completedJourneys: 4,
      shedArrivals: 0,
      maxInFlight: 2,
      achievedThroughputPerSecond: 100,
      results: [0, 1, 2, 3],
    });
    expect(observedMax).toBe(2);
  });

  it("does not admit closed-model work exactly at the deadline", async () => {
    let now = 0;
    const executed: number[] = [];
    const execution = await runSustainedClosed({
      concurrency: 1,
      durationMs: 20,
      clock: { now: () => now, sleep: () => Promise.resolve() },
      execute: (userIndex) => {
        executed.push(userIndex);
        now += 10;
        return Promise.resolve(userIndex);
      },
    });

    expect(executed).toEqual([0, 1]);
    expect(execution.scheduledArrivals).toBe(2);
  });

  it.each([
    ["durationMs", { concurrency: 1, durationMs: 0 }],
    ["durationMs", { concurrency: 1, durationMs: Number.NaN }],
    ["concurrency", { concurrency: 0, durationMs: 1 }],
    ["concurrency", { concurrency: 1.5, durationMs: 1 }],
  ])("rejects an invalid %s before admitting closed-model work", async (label, values) => {
    await expect(
      runSustainedClosed({
        ...values,
        execute: () => Promise.resolve(1),
      }),
    ).rejects.toThrow(label);
  });
});

describe("runSustainedOpen", () => {
  it("keeps fixed-rate arrivals independent of completion and sheds above max in-flight", async () => {
    let now = 100;
    const sleeps: number[] = [];
    const resolvers: Array<() => void> = [];
    const clock: WorkloadClock = {
      now: () => now,
      sleep: (durationMs) => {
        sleeps.push(durationMs);
        now += durationMs;
        return Promise.resolve();
      },
    };

    const pending = runSustainedOpen({
      arrivalRatePerSecond: 4,
      durationMs: 1_000,
      maxInFlight: 2,
      clock,
      execute: (userIndex) =>
        new Promise<number>((resolve) => {
          resolvers.push(() => {
            resolve(userIndex);
          });
        }),
    });

    for (let index = 0; index < 8; index += 1) await Promise.resolve();
    expect(resolvers).toHaveLength(2);
    resolvers.forEach((resolve) => {
      resolve();
    });
    const execution = await pending;

    expect(sleeps).toEqual([0, 250, 250, 250, 250]);
    expect(execution).toMatchObject({
      arrivalModel: "open",
      configuredDurationMs: 1_000,
      scheduledArrivals: 4,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 2,
      maxInFlight: 2,
      wallClockMs: 1_000,
      achievedThroughputPerSecond: 2,
      results: [0, 1],
    });
  });

  it("releases completed work before the next arrival instead of shedding it", async () => {
    let now = 0;
    const execution = await runSustainedOpen({
      arrivalRatePerSecond: 2,
      durationMs: 1_000,
      maxInFlight: 1,
      clock: {
        now: () => now,
        sleep: async (durationMs) => {
          now += durationMs;
          await Promise.resolve();
          await Promise.resolve();
        },
      },
      execute: (userIndex) => Promise.resolve(userIndex),
    });

    expect(execution).toMatchObject({
      scheduledArrivals: 2,
      admittedJourneys: 2,
      completedJourneys: 2,
      shedArrivals: 0,
      maxInFlight: 1,
      results: [0, 1],
    });
  });

  it("retains admitted user identity order when journeys finish out of order", async () => {
    let now = 0;
    const resolvers: Array<(value: number) => void> = [];
    const clock: WorkloadClock = {
      now: () => now,
      sleep: (durationMs) => {
        now += durationMs;
        return Promise.resolve();
      },
    };

    const pending = runSustainedOpen({
      arrivalRatePerSecond: 2,
      durationMs: 1_000,
      maxInFlight: 2,
      clock,
      execute: () =>
        new Promise<number>((resolve) => {
          resolvers.push(resolve);
        }),
    });

    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    resolvers[1](20);
    resolvers[0](10);

    await expect(pending).resolves.toMatchObject({ results: [10, 20] });
  });

  it("does not process nominal arrivals after a delayed timer wakes at the deadline", async () => {
    let now = 0;
    const executed: number[] = [];
    const clock: WorkloadClock = {
      now: () => now,
      sleep: (durationMs) => {
        now += durationMs === 0 ? 0 : durationMs + 750;
        return Promise.resolve();
      },
    };

    const execution = await runSustainedOpen({
      arrivalRatePerSecond: 4,
      durationMs: 1_000,
      maxInFlight: 4,
      clock,
      execute: (userIndex) => {
        executed.push(userIndex);
        return Promise.resolve(userIndex);
      },
    });

    expect(executed).toEqual([0]);
    expect(execution).toMatchObject({
      wallClockMs: 1_000,
      scheduledArrivals: 1,
      admittedJourneys: 1,
      completedJourneys: 1,
      shedArrivals: 0,
      achievedThroughputPerSecond: 1,
      results: [0],
    });
  });

  it.each([
    ["durationMs", { durationMs: 0, arrivalRatePerSecond: 1, maxInFlight: 1 }],
    ["arrivalRatePerSecond", { durationMs: 1, arrivalRatePerSecond: 0, maxInFlight: 1 }],
    ["arrivalRatePerSecond", { durationMs: 1, arrivalRatePerSecond: Infinity, maxInFlight: 1 }],
    ["maxInFlight", { durationMs: 1, arrivalRatePerSecond: 1, maxInFlight: 0 }],
    ["maxInFlight", { durationMs: 1, arrivalRatePerSecond: 1, maxInFlight: 1.5 }],
  ])("rejects an invalid %s before scheduling open-model work", async (label, values) => {
    await expect(
      runSustainedOpen({
        ...values,
        execute: () => Promise.resolve(1),
      }),
    ).rejects.toThrow(label);
  });
});
