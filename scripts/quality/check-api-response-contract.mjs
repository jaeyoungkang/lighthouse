import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

import { defineGuardExceptions } from "./guard-exception-policy.mjs";
import { collectRouteHandlerPaths } from "./route-handler-files.mjs";

const ROOT = process.cwd();
const CONTRACT_PATH = "app/server/operational/api-response-contract.json";
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const FAILURE_FIELDS = [
  "correctableFailures",
  "authFailures",
  "conflictFailures",
  "overloadFailures",
  "transientFailures",
];
const OPTIONAL_FAILURE_FIELDS = ["terminalFailures"];
const API_ERROR_ACTIONS = new Set([
  "correct-request",
  "authenticate",
  "request-permission",
  "clear-missing-state",
  "refresh-and-rebase",
  "reduce-request",
  "wait-and-retry",
  "retry",
  "stop",
]);
const UNEXPECTED_FAILURE_POLICIES = new Set(["stable-envelope", "absorbed-204", "not-applicable"]);
const DIRECT_MESSAGE_ERROR_RESPONSE_RE = /\b(?:NextResponse|Response)\.json\s*\(\s*\{\s*error\s*:/s;
const GUARD_ID = "guard:api-response-contract";
const ROUTE_HANDLER_EXEMPTIONS = defineGuardExceptions(
  GUARD_ID,
  [
    {
      id: "auth-confirm-redirect-only",
      path: "app/auth/confirm/route.ts",
      reason: "the auth callback emits redirects rather than JSON API response envelopes",
      owner: "Lighthouse authentication boundary",
      reviewWhen: "review when the callback returns a non-redirect response or changes location",
    },
  ],
  { requiredMatchFields: ["path"] },
);

export async function validateApiResponseContract(root = ROOT, suppliedContract) {
  const contract =
    suppliedContract ?? JSON.parse(await readFile(path.join(root, CONTRACT_PATH), "utf8"));
  const actualPaths = await collectRouteHandlerPaths(root);

  const violations = [];
  const routes = Array.isArray(contract?.routes) ? contract.routes : [];
  const contractPaths = routes.map((route) => route?.path).filter(Boolean);
  const matchedExceptionIds = new Set();

  for (const routePath of new Set(
    contractPaths.filter((routePath, index) => contractPaths.indexOf(routePath) !== index),
  )) {
    violations.push(`${CONTRACT_PATH}: duplicate route contract '${routePath}'`);
  }
  for (const routePath of actualPaths) {
    if (contractPaths.includes(routePath)) continue;
    const exception = ROUTE_HANDLER_EXEMPTIONS.find((candidate) => candidate.path === routePath);
    if (exception) matchedExceptionIds.add(exception.id);
    else violations.push(`${CONTRACT_PATH}: missing route '${routePath}'`);
  }
  for (const routePath of contractPaths) {
    if (!actualPaths.includes(routePath)) {
      violations.push(`${CONTRACT_PATH}: stale route '${routePath}'`);
    }
  }
  if (suppliedContract === undefined) {
    for (const exception of ROUTE_HANDLER_EXEMPTIONS) {
      if (!matchedExceptionIds.has(exception.id)) {
        violations.push(
          `${CONTRACT_PATH}: stale Route Handler exemption '${exception.id}' (${exception.path})`,
        );
      }
    }
  }

  validateDefaultUnexpectedFailure(contract?.defaultUnexpectedFailure, violations);

  for (const route of routes) {
    if (!route || typeof route.path !== "string") continue;
    const source = await readFile(path.join(root, route.path), "utf8").catch(() => "");
    validateMethods(route, source, violations);
    validateSuccessInventory(route, violations);
    for (const field of FAILURE_FIELDS) {
      validateFailureInventory(route, field, violations);
    }
    for (const field of OPTIONAL_FAILURE_FIELDS) {
      if (route[field] !== undefined) validateFailureInventory(route, field, violations);
    }
    validateLiteralApiErrorResponses(route, source, violations);
    if (!UNEXPECTED_FAILURE_POLICIES.has(route.unexpectedFailure)) {
      violations.push(`${route.path}: unexpectedFailure policy is missing or invalid`);
    }
    if (
      route.unexpectedFailure === "stable-envelope" &&
      !source.includes("withRouteGuard(") &&
      !source.includes("apiErrorResponse(")
    ) {
      violations.push(`${route.path}: stable unexpected failure has no response-envelope owner`);
    }
    if (DIRECT_MESSAGE_ERROR_RESPONSE_RE.test(source)) {
      violations.push(
        `${route.path}: direct message-only error response bypasses apiErrorResponse`,
      );
    }
  }

  return {
    ok: violations.length === 0,
    routeCount: actualPaths.length,
    exemptionCount: matchedExceptionIds.size,
    violations,
  };
}

function collectLiteralApiErrorResponses(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const responses = [];
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "apiErrorResponse" &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      let status;
      let code;
      for (const property of node.arguments[0].properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const name = property.name.getText(sourceFile).replaceAll(/["']/g, "");
        if (name === "status" && ts.isNumericLiteral(property.initializer)) {
          status = Number(property.initializer.text);
        }
        if (name === "code" && ts.isStringLiteral(property.initializer)) {
          code = property.initializer.text;
        }
      }
      if (Number.isSafeInteger(status) && typeof code === "string")
        responses.push({ status, code });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return responses;
}

function validateLiteralApiErrorResponses(route, source, violations) {
  const inventory = [...FAILURE_FIELDS, ...OPTIONAL_FAILURE_FIELDS]
    .flatMap((field) => (Array.isArray(route[field]) ? route[field] : []))
    .flatMap((entry) =>
      (entry.codes ?? []).flatMap((code) =>
        (entry.statuses ?? []).map((status) => `${String(status)}:${String(code)}`),
      ),
    );
  const inventoryPairs = new Set(inventory);
  for (const response of collectLiteralApiErrorResponses(source, route.path)) {
    if (response.status < 400) continue;
    if (!inventoryPairs.has(`${String(response.status)}:${response.code}`)) {
      violations.push(
        `${route.path}: literal apiErrorResponse ${String(response.status)}/${response.code} is missing from this route inventory`,
      );
    }
  }
}

function validateDefaultUnexpectedFailure(value, violations) {
  if (
    value?.status !== 500 ||
    value?.code !== "API_INTERNAL_ERROR" ||
    value?.action !== "retry" ||
    value?.retryable !== true
  ) {
    violations.push(`${CONTRACT_PATH}: defaultUnexpectedFailure must be stable retryable 500`);
  }
}

function validateMethods(route, source, violations) {
  if (!Array.isArray(route.methods) || route.methods.length === 0) {
    violations.push(`${route.path}: methods inventory is empty`);
    return;
  }
  const actualMethods = HTTP_METHODS.filter((method) => {
    return new RegExp(`export\\s+(?:(?:async\\s+)?function|const)\\s+${method}\\b`).test(source);
  });
  if (JSON.stringify([...route.methods].sort()) !== JSON.stringify(actualMethods.sort())) {
    violations.push(
      `${route.path}: methods ${JSON.stringify(route.methods)} do not match exports ${JSON.stringify(actualMethods)}`,
    );
  }
}

function validateSuccessInventory(route, violations) {
  if (!Array.isArray(route.successStatuses)) {
    violations.push(`${route.path}: successStatuses inventory is missing`);
  } else if (
    route.successStatuses.some(
      (status) => !Number.isSafeInteger(status) || status < 200 || status > 299,
    )
  ) {
    violations.push(`${route.path}: successStatuses contains a non-2xx status`);
  }
  if (
    !Array.isArray(route.degradedSuccess) ||
    route.degradedSuccess.some((meaning) => typeof meaning !== "string" || meaning.length === 0)
  ) {
    violations.push(`${route.path}: degradedSuccess inventory is missing or invalid`);
  }
}

function validateFailureInventory(route, field, violations) {
  const entries = route[field];
  if (!Array.isArray(entries)) {
    violations.push(`${route.path}: ${field} inventory is missing`);
    return;
  }
  for (const [index, entry] of entries.entries()) {
    const prefix = `${route.path}: ${field}[${String(index)}]`;
    if (
      !Array.isArray(entry?.statuses) ||
      entry.statuses.length === 0 ||
      entry.statuses.some((status) => !Number.isSafeInteger(status) || status < 400 || status > 599)
    ) {
      violations.push(`${prefix} statuses are incomplete`);
      continue;
    }
    if (
      !Array.isArray(entry.codes) ||
      entry.codes.length === 0 ||
      entry.codes.some((code) => typeof code !== "string" || code.length === 0)
    ) {
      violations.push(`${prefix} stable codes are incomplete`);
    }
    if (!API_ERROR_ACTIONS.has(entry.action) || typeof entry.retryable !== "boolean") {
      violations.push(`${prefix} action/retryable meaning is incomplete`);
      continue;
    }
    for (const status of entry.statuses) {
      validateStatusMeaning(prefix, field, status, entry, violations);
    }
  }
}

function validateStatusMeaning(prefix, field, status, entry, violations) {
  if (field === "terminalFailures" && status < 500) {
    violations.push(`${prefix} terminalFailures may contain only 5xx statuses`);
    return;
  }
  const expected =
    status === 400 || status === 422
      ? ["correct-request", false]
      : status === 401
        ? ["authenticate", false]
        : status === 403
          ? ["request-permission", false]
          : status === 404 || status === 410
            ? ["clear-missing-state", false]
            : status === 409
              ? ["refresh-and-rebase", false]
              : status === 413
                ? ["reduce-request", false]
                : status === 429
                  ? ["wait-and-retry", true]
                  : status >= 500
                    ? field === "terminalFailures"
                      ? ["stop", false]
                      : ["retry", true]
                    : null;
  if (!expected) return;
  if (entry.action !== expected[0] || entry.retryable !== expected[1]) {
    violations.push(
      `${prefix} status ${String(status)} must map to ${expected[0]}/${String(expected[1])}`,
    );
  }
  if (status === 429 && entry.backoff !== "retry-after") {
    violations.push(`${prefix} status 429 must declare retry-after backoff`);
  }
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isDirectExecution) {
  const result = await validateApiResponseContract();
  if (!result.ok) {
    console.error("[guard:api-response-contract] API response contract drift:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }
  console.log(
    `[guard:api-response-contract] ${result.routeCount}개 Route Handler: response/action contract ${result.routeCount - result.exemptionCount}개, explicit exempt ${result.exemptionCount}개.`,
  );
}
