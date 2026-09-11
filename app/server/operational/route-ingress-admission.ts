import { createHash } from "node:crypto";
import { getFixedRouteAdmissionPolicy } from "@/app/server/operational/route-ingress-policy";

type AdmissionBucket = {
  count: number;
  lastSeenMs: number;
  windowStartedAtMs: number;
};

export type RouteIngressAdmissionDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; reason: "rate-limit" | "key-table-full"; retryAfterSeconds: number };

const buckets = new Map<string, AdmissionBucket>();

function digestKey(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function countPolicyBuckets(policyId: string): number {
  const prefix = `${policyId}:`;
  let count = 0;
  for (const key of buckets.keys()) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
}

function pruneExpiredBuckets(policyId: string, nowMs: number, windowMs: number): void {
  const prefix = `${policyId}:`;
  for (const [key, bucket] of buckets) {
    if (key.startsWith(prefix) && nowMs - bucket.lastSeenMs >= windowMs) {
      buckets.delete(key);
    }
  }
}

export function resolveRequestSourceKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",").at(0)?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown"
  ).slice(0, 128);
}

export function consumeRouteIngressAdmission(
  policyId: string,
  rawKey: string,
): RouteIngressAdmissionDecision {
  const policy = getFixedRouteAdmissionPolicy(policyId);
  const nowMs = Date.now();
  const key = `${policy.id}:${digestKey(rawKey)}`;
  let bucket = buckets.get(key);

  if (!bucket && countPolicyBuckets(policy.id) >= policy.maxKeys) {
    pruneExpiredBuckets(policy.id, nowMs, policy.windowMs);
    if (countPolicyBuckets(policy.id) >= policy.maxKeys) {
      return {
        allowed: false,
        reason: "key-table-full",
        retryAfterSeconds: Math.ceil(policy.windowMs / 1000),
      };
    }
  }

  if (!bucket || nowMs - bucket.windowStartedAtMs >= policy.windowMs) {
    bucket = { count: 0, lastSeenMs: nowMs, windowStartedAtMs: nowMs };
    buckets.set(key, bucket);
  }

  bucket.lastSeenMs = nowMs;
  if (bucket.count >= policy.maxRequests) {
    return {
      allowed: false,
      reason: "rate-limit",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((policy.windowMs - (nowMs - bucket.windowStartedAtMs)) / 1000),
      ),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, policy.maxRequests - bucket.count),
  };
}

export function __resetRouteIngressAdmissionForTests(): void {
  buckets.clear();
}
