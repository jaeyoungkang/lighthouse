import policyDocument from "./route-ingress-policy.json";

type RouteIngressPolicy = (typeof policyDocument.routes)[number];

const policyByPath = new Map(policyDocument.routes.map((policy) => [policy.path, policy]));

export function getRouteIngressPolicy(path: string): RouteIngressPolicy {
  const policy = policyByPath.get(path);
  if (!policy) {
    throw new Error(`missing route ingress policy: ${path}`);
  }
  return policy;
}

export function getRouteBodyLimit(path: string): { maxBytes: number; maxChars?: number } {
  const body = getRouteIngressPolicy(path).body;
  if (!body) {
    throw new Error(`route does not accept a request body: ${path}`);
  }
  return {
    maxBytes: body.maxBytes,
    ...("maxChars" in body && typeof body.maxChars === "number" ? { maxChars: body.maxChars } : {}),
  };
}

export function getFixedRouteAdmissionPolicy(id: string): {
  id: string;
  key: string;
  maxRequests: number;
  windowMs: number;
  maxKeys: number;
} {
  const admissions: unknown[] = policyDocument.routes.flatMap(
    (policy) => policy.admission as unknown[],
  );
  const admission = admissions.find(
    (candidate): candidate is Record<string, unknown> =>
      typeof candidate === "object" &&
      candidate !== null &&
      "id" in candidate &&
      candidate.id === id,
  );
  if (
    !admission ||
    !("key" in admission) ||
    !("maxRequests" in admission) ||
    !("windowMs" in admission) ||
    !("maxKeys" in admission)
  ) {
    throw new Error(`missing fixed route admission policy: ${id}`);
  }
  if (
    typeof admission.id !== "string" ||
    typeof admission.key !== "string" ||
    typeof admission.maxRequests !== "number" ||
    typeof admission.windowMs !== "number" ||
    typeof admission.maxKeys !== "number"
  ) {
    throw new Error(`invalid fixed route admission policy: ${id}`);
  }
  return {
    id: admission.id,
    key: admission.key,
    maxRequests: admission.maxRequests,
    windowMs: admission.windowMs,
    maxKeys: admission.maxKeys,
  };
}

export { policyDocument as routeIngressPolicyDocument };
