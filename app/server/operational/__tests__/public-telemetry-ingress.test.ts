import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __resetPublicTelemetryIngressForTests,
  consumePublicTelemetryIngressBudget,
  getPublicTelemetryIngressCapacitySnapshot,
  runPublicTelemetryDrain,
} from "@/app/server/operational/public-telemetry-ingress";

function request(source = "203.0.113.7"): Request {
  return new Request("https://lighthouse.example.com/api/analytics-events", {
    headers: { "x-forwarded-for": source },
    method: "POST",
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("public telemetry ingress controls", () => {
  afterEach(() => {
    __resetPublicTelemetryIngressForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses positive integer capacity overrides and rejects invalid values", () => {
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_CONCURRENCY", " 3 ");
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_QUEUE", "0");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS", "1.5");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS", "invalid");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "90000");

    expect(getPublicTelemetryIngressCapacitySnapshot()).toEqual({
      drainConcurrency: 3,
      drainQueue: 100,
      maxRequests: 120,
      maxSourceKeys: 1_000,
      windowMs: 90_000,
    });
  });

  it("applies a source-scoped rate limit per public telemetry surface", () => {
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "60000");

    const first = consumePublicTelemetryIngressBudget(request(), "analytics-events");
    const second = consumePublicTelemetryIngressBudget(request(), "analytics-events");
    const errorsSurface = consumePublicTelemetryIngressBudget(request(), "errors");

    expect(first).toMatchObject({ allowed: true, remaining: 0 });
    expect(second).toMatchObject({ allowed: false, reason: "rate-limit" });
    expect(errorsSurface).toMatchObject({ allowed: true });
  });

  it("resets a source budget at the exact window boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T00:00:00.000Z"));
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS", "2");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "1000");

    expect(consumePublicTelemetryIngressBudget(request(), "analytics-events")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(consumePublicTelemetryIngressBudget(request(), "analytics-events")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(consumePublicTelemetryIngressBudget(request(), "analytics-events")).toMatchObject({
      allowed: false,
      reason: "rate-limit",
    });

    vi.advanceTimersByTime(1_000);
    expect(consumePublicTelemetryIngressBudget(request(), "analytics-events")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it("uses the first bounded source identity with deterministic fallbacks", () => {
    const consumeWithHeaders = (headers: HeadersInit = {}) =>
      consumePublicTelemetryIngressBudget(
        new Request("https://lighthouse.example.com/api/errors", { headers }),
        "errors",
      );

    expect(consumeWithHeaders({ "x-forwarded-for": " 198.51.100.7 , 203.0.113.9" }).key).toBe(
      "errors:198.51.100.7",
    );
    expect(consumeWithHeaders({ "x-forwarded-for": "   ", "x-real-ip": "198.51.100.8" }).key).toBe(
      "errors:198.51.100.8",
    );
    expect(consumeWithHeaders({ "x-real-ip": " 198.51.100.8 " }).key).toBe("errors:198.51.100.8");
    expect(consumeWithHeaders({ "cf-connecting-ip": " 198.51.100.9 " }).key).toBe(
      "errors:198.51.100.9",
    );
    expect(consumeWithHeaders().key).toBe("errors:unknown");
    expect(consumeWithHeaders({ "x-real-ip": "x".repeat(160) }).key).toBe(
      `errors:${"x".repeat(128)}`,
    );
  });

  it("bounds the source key table so unique-source floods shed load", () => {
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS", "1");

    const first = consumePublicTelemetryIngressBudget(request("203.0.113.1"), "analytics-events");
    const second = consumePublicTelemetryIngressBudget(request("203.0.113.2"), "analytics-events");

    expect(first).toMatchObject({ allowed: true });
    expect(second).toMatchObject({ allowed: false, reason: "source-table-full" });
  });

  it("reclaims an expired source key before shedding a new source", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-03T00:00:00.000Z"));
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS", "1000");

    expect(
      consumePublicTelemetryIngressBudget(request("203.0.113.1"), "analytics-events"),
    ).toMatchObject({ allowed: true });

    vi.advanceTimersByTime(1_000);
    expect(
      consumePublicTelemetryIngressBudget(request("203.0.113.2"), "analytics-events"),
    ).toMatchObject({ allowed: true, key: "analytics-events:203.0.113.2" });
  });

  it("bounds telemetry drain concurrency and queue length", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_CONCURRENCY", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_QUEUE", "1");
    expect(getPublicTelemetryIngressCapacitySnapshot()).toMatchObject({
      drainConcurrency: 1,
      drainQueue: 1,
    });

    const gate = deferred();
    const calls: string[] = [];

    const first = runPublicTelemetryDrain(async () => {
      calls.push("first");
      await gate.promise;
    });
    const second = runPublicTelemetryDrain(() => {
      calls.push("second");
      return Promise.resolve();
    });
    const third = await runPublicTelemetryDrain(() => {
      calls.push("third");
      return Promise.resolve();
    });

    expect(third).toBe(false);
    expect(calls).toEqual(["first"]);

    gate.resolve();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(calls).toEqual(["first", "second"]);
  });

  it("settles failed drain work and recovers queue capacity", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_CONCURRENCY", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_QUEUE", "1");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const gate = deferred();
    const calls: string[] = [];

    const first = runPublicTelemetryDrain(async () => {
      calls.push("first");
      await gate.promise;
    });
    const second = runPublicTelemetryDrain(() => {
      calls.push("second");
      return Promise.reject(new Error("sink failed"));
    });
    const rejectedWhileQueued = await runPublicTelemetryDrain(() => {
      calls.push("third");
      return Promise.resolve();
    });

    expect(rejectedWhileQueued).toBe(false);
    expect(calls).toEqual(["first"]);

    gate.resolve();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(consoleError).toHaveBeenCalledWith(
      "[public-telemetry-ingress] drain task failed:",
      expect.any(Error),
    );

    await expect(
      runPublicTelemetryDrain(() => {
        calls.push("after-failure");
        return Promise.resolve();
      }),
    ).resolves.toBe(true);
    expect(calls).toEqual(["first", "second", "after-failure"]);
  });

  it("keeps a directly admitted failed drain accepted without widening concurrency", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_CONCURRENCY", "1");
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_QUEUE", "1");
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      runPublicTelemetryDrain(() => Promise.reject(new Error("sink failed"))),
    ).resolves.toBe(true);

    const gate = deferred();
    const calls: string[] = [];
    const first = runPublicTelemetryDrain(async () => {
      calls.push("first");
      await gate.promise;
    });
    const second = runPublicTelemetryDrain(() => {
      calls.push("second");
      return Promise.resolve();
    });

    expect(calls).toEqual(["first"]);
    gate.resolve();
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(calls).toEqual(["first", "second"]);
  });

  it("retains other active drains when one concurrent drain settles", async () => {
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_CONCURRENCY", "2");
    vi.stubEnv("PUBLIC_TELEMETRY_DRAIN_QUEUE", "1");

    const firstGate = deferred();
    const secondGate = deferred();
    const thirdGate = deferred();
    const calls: string[] = [];
    const first = runPublicTelemetryDrain(async () => {
      calls.push("first");
      await firstGate.promise;
    });
    const second = runPublicTelemetryDrain(async () => {
      calls.push("second");
      await secondGate.promise;
    });

    firstGate.resolve();
    await expect(first).resolves.toBe(true);

    const third = runPublicTelemetryDrain(async () => {
      calls.push("third");
      await thirdGate.promise;
    });
    const fourth = runPublicTelemetryDrain(() => {
      calls.push("fourth");
      return Promise.resolve();
    });

    expect(calls).toEqual(["first", "second", "third"]);

    secondGate.resolve();
    await expect(second).resolves.toBe(true);
    await expect(fourth).resolves.toBe(true);
    thirdGate.resolve();
    await expect(third).resolves.toBe(true);
    expect(calls).toEqual(["first", "second", "third", "fourth"]);
  });
});
