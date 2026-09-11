const DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS = 1_000;
const DEFAULT_PUBLIC_TELEMETRY_DRAIN_CONCURRENCY = 2;
const DEFAULT_PUBLIC_TELEMETRY_DRAIN_QUEUE = 100;

type PublicTelemetrySurface = "analytics-events" | "errors";

type RateLimitBucket = {
  count: number;
  lastSeenMs: number;
  windowStartMs: number;
};

type DrainQueueEntry = {
  resolve: (accepted: boolean) => void;
  run: () => Promise<void>;
};

export type PublicTelemetryIngressDecision =
  | {
      allowed: true;
      key: string;
      remaining: number;
    }
  | {
      allowed: false;
      key: string;
      reason: "rate-limit" | "source-table-full";
    };

export type PublicTelemetryIngressCapacitySnapshot = {
  drainConcurrency: number;
  drainQueue: number;
  maxRequests: number;
  maxSourceKeys: number;
  windowMs: number;
};

const buckets = new Map<string, RateLimitBucket>();
const drainQueue: DrainQueueEntry[] = [];
let activeDrains = 0;

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

export function getPublicTelemetryIngressCapacitySnapshot(): PublicTelemetryIngressCapacitySnapshot {
  return {
    drainConcurrency: readPositiveIntegerEnv(
      "PUBLIC_TELEMETRY_DRAIN_CONCURRENCY",
      DEFAULT_PUBLIC_TELEMETRY_DRAIN_CONCURRENCY,
    ),
    drainQueue: readPositiveIntegerEnv(
      "PUBLIC_TELEMETRY_DRAIN_QUEUE",
      DEFAULT_PUBLIC_TELEMETRY_DRAIN_QUEUE,
    ),
    maxRequests: readPositiveIntegerEnv(
      "PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS",
      DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_MAX_REQUESTS,
    ),
    maxSourceKeys: readPositiveIntegerEnv(
      "PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS",
      DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_MAX_SOURCE_KEYS,
    ),
    windowMs: readPositiveIntegerEnv(
      "PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS",
      DEFAULT_PUBLIC_TELEMETRY_RATE_LIMIT_WINDOW_MS,
    ),
  };
}

function resolvePublicTelemetrySourceKey(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")?.split(",").at(0)?.trim();
  const candidate =
    forwardedFor ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    "unknown";
  return candidate.slice(0, 128);
}

function pruneExpiredBuckets(nowMs: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (nowMs - bucket.lastSeenMs >= windowMs) buckets.delete(key);
  }
}

export function consumePublicTelemetryIngressBudget(
  req: Request,
  surface: PublicTelemetrySurface,
): PublicTelemetryIngressDecision {
  const capacity = getPublicTelemetryIngressCapacitySnapshot();
  const nowMs = Date.now();
  const key = `${surface}:${resolvePublicTelemetrySourceKey(req)}`;

  let bucket = buckets.get(key);
  if (!bucket && buckets.size >= capacity.maxSourceKeys) {
    pruneExpiredBuckets(nowMs, capacity.windowMs);
    if (buckets.size >= capacity.maxSourceKeys) {
      return { allowed: false, key, reason: "source-table-full" };
    }
  }

  if (!bucket || nowMs - bucket.windowStartMs >= capacity.windowMs) {
    bucket = { count: 0, lastSeenMs: nowMs, windowStartMs: nowMs };
    buckets.set(key, bucket);
  }

  bucket.lastSeenMs = nowMs;
  if (bucket.count >= capacity.maxRequests) {
    return { allowed: false, key, reason: "rate-limit" };
  }

  bucket.count += 1;
  return {
    allowed: true,
    key,
    remaining: Math.max(0, capacity.maxRequests - bucket.count),
  };
}

export function runPublicTelemetryDrain(run: () => Promise<void>): Promise<boolean> {
  const capacity = getPublicTelemetryIngressCapacitySnapshot();
  if (activeDrains < capacity.drainConcurrency) {
    return runDrain({ run });
  }

  if (drainQueue.length >= capacity.drainQueue) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    drainQueue.push({ resolve, run });
  });
}

async function runDrain(entry: {
  resolve?: (accepted: boolean) => void;
  run: () => Promise<void>;
}) {
  activeDrains += 1;
  try {
    await entry.run();
    return true;
  } catch (error) {
    console.error("[public-telemetry-ingress] drain task failed:", error);
    return true;
  } finally {
    entry.resolve?.(true);
    activeDrains = Math.max(0, activeDrains - 1);
    const next = drainQueue.shift();
    if (next) {
      void runDrain(next);
    }
  }
}

export function __resetPublicTelemetryIngressForTests(): void {
  buckets.clear();
  drainQueue.splice(0);
  activeDrains = 0;
}
