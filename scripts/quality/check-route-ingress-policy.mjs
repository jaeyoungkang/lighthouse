import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectRouteHandlerPaths } from "./route-handler-files.mjs";

const ROOT = process.cwd();
const POLICY_PATH = "app/server/operational/route-ingress-policy.json";
const MAX_DURATION_RE = /^export const maxDuration\s*=\s*(\d+)\s*;/m;
const DIRECT_JSON_BODY_RE = /\b(?:req|request)\.json\s*\(/;
const BOUNDED_BODY_MARKERS = ["readRouteJsonBody(", "readBoundedJsonBody("];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function validateRouteIngressPolicy(root = ROOT, suppliedPolicyDocument) {
  const policyDocument =
    suppliedPolicyDocument ?? JSON.parse(await readFile(path.join(root, POLICY_PATH), "utf8"));
  const actualPaths = await collectRouteHandlerPaths(root);

  const violations = [];
  const policies = Array.isArray(policyDocument?.routes) ? policyDocument.routes : [];
  const policyPaths = policies.map((policy) => policy?.path).filter(Boolean);
  const duplicatePaths = policyPaths.filter((routePath, index) => {
    return policyPaths.indexOf(routePath) !== index;
  });
  for (const routePath of new Set(duplicatePaths)) {
    violations.push(`${POLICY_PATH}: duplicate route policy '${routePath}'`);
  }

  for (const routePath of actualPaths) {
    if (!policyPaths.includes(routePath)) {
      violations.push(`${POLICY_PATH}: missing route '${routePath}'`);
    }
  }
  for (const routePath of policyPaths) {
    if (!actualPaths.includes(routePath)) {
      violations.push(`${POLICY_PATH}: stale route '${routePath}'`);
    }
  }

  for (const policy of policies) {
    if (!policy || typeof policy.path !== "string") continue;
    const file = path.join(root, policy.path);
    let source;
    try {
      source = await readFile(file, "utf8");
    } catch {
      continue;
    }

    if (!Array.isArray(policy.methods) || policy.methods.length === 0) {
      violations.push(`${policy.path}: methods inventory is empty`);
    } else {
      const actualMethods = HTTP_METHODS.filter((method) => {
        return new RegExp(`export\\s+(?:(?:async\\s+)?function|const)\\s+${method}\\b`).test(
          source,
        );
      });
      if (JSON.stringify([...policy.methods].sort()) !== JSON.stringify(actualMethods.sort())) {
        violations.push(
          `${policy.path}: methods ${JSON.stringify(policy.methods)} do not match exports ${JSON.stringify(actualMethods)}`,
        );
      }
    }
    for (const field of ["visibility", "access", "authOrder", "platformAdmission"]) {
      if (typeof policy[field] !== "string" || policy[field].trim().length === 0) {
        violations.push(`${policy.path}: missing policy field '${field}'`);
      }
    }
    if (!Array.isArray(policy.work) || policy.work.length === 0) {
      violations.push(`${policy.path}: work inventory is empty`);
    }
    if (!Array.isArray(policy.admission)) {
      violations.push(`${policy.path}: admission inventory is missing`);
    } else {
      for (const admission of policy.admission) {
        if (!admission || typeof admission.id !== "string" || typeof admission.owner !== "string") {
          violations.push(`${policy.path}: admission owner/id is incomplete`);
          continue;
        }
        if (
          "key" in admission &&
          (!Number.isSafeInteger(admission.maxRequests) ||
            admission.maxRequests < 1 ||
            !Number.isSafeInteger(admission.windowMs) ||
            admission.windowMs < 1 ||
            !Number.isSafeInteger(admission.maxKeys) ||
            admission.maxKeys < 1)
        ) {
          violations.push(`${policy.path}: fixed admission budget '${admission.id}' is invalid`);
        }
      }
    }

    const durationMatch = MAX_DURATION_RE.exec(source);
    const actualDuration = durationMatch ? Number(durationMatch[1]) : null;
    if (actualDuration !== policy.deadlineSeconds) {
      violations.push(
        `${policy.path}: maxDuration ${String(actualDuration)} does not match inventory ${String(policy.deadlineSeconds)}`,
      );
    }

    if (DIRECT_JSON_BODY_RE.test(source)) {
      violations.push(`${policy.path}: direct request.json() bypasses the bounded body reader`);
    }

    if (policy.body === null) continue;
    if (
      typeof policy.body !== "object" ||
      typeof policy.body.maxBytes !== "number" ||
      policy.body.maxBytes < 1 ||
      typeof policy.body.fieldCardinality !== "string" ||
      policy.body.fieldCardinality.trim().length === 0
    ) {
      violations.push(`${policy.path}: body byte/field/cardinality budget is incomplete`);
      continue;
    }
    if (!BOUNDED_BODY_MARKERS.some((marker) => source.includes(marker))) {
      violations.push(`${policy.path}: body route does not use a bounded body reader`);
    }
    if (
      policy.path !== "app/api/gap-reports/route.ts" &&
      !source.includes(`getRouteBodyLimit("${policy.path}")`)
    ) {
      violations.push(`${policy.path}: body route does not consume its inventoried byte budget`);
    }
  }

  await validateGapReportBodyBudget(root, policies, violations);

  return {
    ok: violations.length === 0,
    routeCount: actualPaths.length,
    violations,
  };
}

async function validateGapReportBodyBudget(root, policies, violations) {
  const routePath = "app/api/gap-reports/route.ts";
  const policy = policies.find((candidate) => candidate?.path === routePath);
  if (!policy?.body) return;
  const ownerPath = "app/lib/gap-report-input-budget.ts";
  const owner = await readFile(path.join(root, ownerPath), "utf8").catch(() => "");
  const match = /export const GAP_REPORT_REQUEST_MAX_BYTES\s*=\s*([\d_]+)\s*;/.exec(owner);
  const actual = match ? Number(match[1].replaceAll("_", "")) : null;
  if (actual !== policy.body.maxBytes) {
    violations.push(
      `${routePath}: GAP_REPORT_REQUEST_MAX_BYTES ${String(actual)} does not match inventory ${String(policy.body.maxBytes)}`,
    );
  }
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isDirectExecution) {
  const result = await validateRouteIngressPolicy();
  if (!result.ok) {
    console.error("[guard:route-ingress] route ingress policy 위반을 발견했습니다:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log(
    `[guard:route-ingress] ${result.routeCount}개 Route Handler의 inventory, deadline, bounded body 경계가 일치합니다.`,
  );
}
