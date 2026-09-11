// guard:operational-boundaries — keep operational boundary reviews and
// runtime control points explicit.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_DOC = "docs/operational-readiness.md";

const REQUIRED_SECTIONS = [
  "## 5. 운영 경계 리스크 등록부",
  "### 등록 기준",
  "### 상태와 소유",
  "### 현재 등록부",
  "### Boundary Review Record 템플릿",
  "### Evidence 사용 규칙",
];

const ALLOWED_STATUSES = new Set([
  "observed",
  "policy-needed",
  "control-needed",
  "evidence-needed",
  "accepted",
  "deferred",
  "blocked",
]);

const REQUIRED_BOUNDARY_IDS = [
  "inline-analysis-shared-cache",
  "gap-report-build-ingress",
  "public-telemetry-ingress",
  "public-magic-link-ingress",
  "episteme-provider-fanout",
  "llm-provider-cost-observability",
  "search-background-transport-retirement",
  "search-quality-evaluation-evidence",
];

export async function runOperationalBoundaryRegisterGuard(options = {}) {
  const root = options.root ?? process.cwd();
  const docPath = options.docPath ?? DEFAULT_DOC;
  const contents = await readFile(path.join(root, docPath), "utf8");
  const registerResult = validateOperationalBoundaryRegister(contents, docPath);
  const publicTelemetryResult = await validatePublicTelemetryIngressControls(root);
  const publicAuthResult = await validatePublicAuthIngressControls(root);
  const providerFanoutResult = await validateProviderFanoutControls(root);
  const violations = [
    ...registerResult.violations,
    ...publicTelemetryResult.violations,
    ...publicAuthResult.violations,
    ...providerFanoutResult.violations,
  ];
  return { ok: violations.length === 0, violations };
}

export function validateOperationalBoundaryRegister(contents, docPath = DEFAULT_DOC) {
  const violations = [];

  for (const section of REQUIRED_SECTIONS) {
    if (!contents.includes(section)) {
      violations.push(`${docPath}: missing required section '${section}'`);
    }
  }

  const lines = contents.split("\n");
  for (const boundaryId of REQUIRED_BOUNDARY_IDS) {
    const row = lines.find((line) => line.includes(`\`${boundaryId}\``));
    if (!row) {
      violations.push(`${docPath}: missing boundary row '${boundaryId}'`);
      continue;
    }

    const status = getMarkdownTableStatus(row);
    if (!status) {
      violations.push(`${docPath}: boundary '${boundaryId}' row has no status column`);
    } else if (!ALLOWED_STATUSES.has(status)) {
      violations.push(`${docPath}: boundary '${boundaryId}' has unknown status '${status}'`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export async function validatePublicTelemetryIngressControls(root = process.cwd()) {
  const violations = [];

  const analyticsRoutePath = "app/api/analytics-events/route.ts";
  const analyticsRoute = await readRequiredFile(root, analyticsRoutePath, violations);
  requireIncludes(analyticsRoute, analyticsRoutePath, violations, [
    'from "@/app/server/operational/public-telemetry-ingress"',
    'from "@/app/server/domain-access/analytics-event-access"',
    'consumePublicTelemetryIngressBudget(req, "analytics-events")',
    "runPublicTelemetryDrain(drain)",
    "isPublicClientAnalyticsEventNameAllowed(parsed.data.name)",
  ]);

  const errorsRoutePath = "app/api/errors/route.ts";
  const errorsRoute = await readRequiredFile(root, errorsRoutePath, violations);
  requireIncludes(errorsRoute, errorsRoutePath, violations, [
    'from "@/app/server/operational/public-telemetry-ingress"',
    'consumePublicTelemetryIngressBudget(req, "errors")',
    "runPublicTelemetryDrain(drain)",
  ]);

  const analyticsAccessPath = "app/server/domain-access/analytics-event-access.ts";
  const analyticsAccess = await readRequiredFile(root, analyticsAccessPath, violations);
  requireIncludes(analyticsAccess, analyticsAccessPath, violations, [
    "isPublicClientAnalyticsEventNameAllowed",
    'event.actor === "user"',
    'event.trigger.source === "client"',
  ]);

  return { ok: violations.length === 0, violations };
}

export async function validatePublicAuthIngressControls(root = process.cwd()) {
  const violations = [];

  const magicLinkRoutePath = "app/api/auth/magic-link/route.ts";
  const magicLinkRoute = await readRequiredFile(root, magicLinkRoutePath, violations);
  requireIncludes(magicLinkRoute, magicLinkRoutePath, violations, [
    '"magic-link-source"',
    'getRouteBodyLimit("app/api/auth/magic-link/route.ts")',
    '"magic-link-email"',
    "retryAfterSeconds: sourceAdmission.retryAfterSeconds",
    "retryAfterSeconds: emailAdmission.retryAfterSeconds",
  ]);

  const admissionPath = "app/server/operational/route-ingress-admission.ts";
  const admission = await readRequiredFile(root, admissionPath, violations);
  requireIncludes(admission, admissionPath, violations, [
    'createHash("sha256")',
    "getFixedRouteAdmissionPolicy(policyId)",
    "countPolicyBuckets(policy.id)",
  ]);

  return { ok: violations.length === 0, violations };
}

export async function validateProviderFanoutControls(root = process.cwd()) {
  const violations = [];

  const breakerPath = "app/server/external-http-gateway/episteme-circuit-breaker.ts";
  const breaker = await readRequiredFile(root, breakerPath, violations);
  requireIncludes(breaker, breakerPath, violations, [
    "export function getEpistemeBreakerCapacitySnapshot",
    "export async function runThroughEpistemeBreaker",
  ]);

  const providerFetchPath = "app/server/external-http-gateway/literature-provider-fetch.ts";
  const providerFetch = await readRequiredFile(root, providerFetchPath, violations);
  requireIncludes(providerFetch, providerFetchPath, violations, [
    'from "./episteme-circuit-breaker"',
    "runThroughEpistemeBreaker(",
    "() => runEpistemeRetryLoop(params)",
    "classifyEpistemeOutcome(result) &&",
    "!(result === null && params.signal?.aborted === true)",
  ]);

  return { ok: violations.length === 0, violations };
}

async function readRequiredFile(root, relativePath, violations) {
  try {
    return await readFile(path.join(root, relativePath), "utf8");
  } catch {
    violations.push(`${relativePath}: operational boundary control file is missing`);
    return "";
  }
}

function requireIncludes(contents, filePath, violations, requiredTexts) {
  if (!contents) return;
  for (const required of requiredTexts) {
    if (!contents.includes(required)) {
      violations.push(`${filePath}: missing operational boundary invariant ${required}`);
    }
  }
}

function getMarkdownTableStatus(row) {
  const cells = row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`|`$/g, ""));
  return cells[5] || null;
}

async function main() {
  const result = await runOperationalBoundaryRegisterGuard();
  if (!result.ok) {
    console.error("[guard:operational-boundaries] operational boundary drift:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  console.log(
    `[guard:operational-boundaries] ${DEFAULT_DOC} OK (${REQUIRED_BOUNDARY_IDS.length} boundary rows).`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
