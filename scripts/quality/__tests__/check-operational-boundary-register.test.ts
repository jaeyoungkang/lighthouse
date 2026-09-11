import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

async function loadGuard(): Promise<{
  validateOperationalBoundaryRegister: (
    contents: string,
    docPath?: string,
  ) => { ok: boolean; violations: string[] };
  validatePublicTelemetryIngressControls: (
    root?: string,
  ) => Promise<{ ok: boolean; violations: string[] }>;
  validatePublicAuthIngressControls: (
    root?: string,
  ) => Promise<{ ok: boolean; violations: string[] }>;
  validateProviderFanoutControls: (root?: string) => Promise<{ ok: boolean; violations: string[] }>;
}> {
  const guardPath = path.resolve(__dirname, "..", "check-operational-boundary-register.mjs");
  return (await import(pathToFileURL(guardPath).href)) as never;
}

const validRegister = `
## 5. 운영 경계 리스크 등록부

### 등록 기준

### 상태와 소유

### 현재 등록부

| boundary id | 표면 | 위험 축 | 현재 control | go/no-go 전에 필요한 증거 | 상태 | trigger / next action |
| --- | --- | --- | --- | --- | --- | --- |
| \`inline-analysis-shared-cache\` | authenticated inline analysis | cache correctness and storage | exact identity and lease | fleet and storage evidence | \`policy-needed\` | #298/#305 |
| \`gap-report-build-ingress\` | authenticated gap report build | provider and LLM cost | bounded request, prompt, and lease | principal rate and cost ceiling | \`deferred\` | before external cohort |
| \`public-telemetry-ingress\` | \`/api/analytics-events\`, \`/api/errors\` | analytics integrity, load | runtime ingress controls | platform and sink evidence | \`evidence-needed\` | #227 |
| \`public-magic-link-ingress\` | \`/api/auth/magic-link\` | public auth abuse and provider fan-out | source/email admission and bounded body | platform/WAF evidence | \`evidence-needed\` | #430 |
| \`episteme-provider-fanout\` | Episteme outbound search | provider load | breaker and fanout budget | peak instance and provider evidence | \`evidence-needed\` | #227 |
| \`llm-provider-cost-observability\` | AI provider gateway usage | AI provider cost visibility | usage normalization and admin usage report | cost distribution and duplicate generation evidence | \`observed\` | #238/#239 |
| \`search-background-transport-retirement\` | authenticated search background routes | premature legacy retirement | bounded route/version observation | exact release coverage and zero legacy | \`evidence-needed\` | #584 |
| \`search-quality-evaluation-evidence\` | versioned search-quality evaluation | fixture evidence misuse | scope split and fail-closed evaluator | approved bounded-live policy and evidence | \`evidence-needed\` | #722 |

### Boundary Review Record 템플릿

### Evidence 사용 규칙
`;

describe("operational boundary register guard", () => {
  it("accepts the required boundary rows and review sections", async () => {
    const { validateOperationalBoundaryRegister } = await loadGuard();

    expect(validateOperationalBoundaryRegister(validRegister)).toEqual({
      ok: true,
      violations: [],
    });
  });

  it.each([
    "episteme-provider-fanout",
    "llm-provider-cost-observability",
    "inline-analysis-shared-cache",
    "gap-report-build-ingress",
    "public-telemetry-ingress",
    "public-magic-link-ingress",
    "search-background-transport-retirement",
    "search-quality-evaluation-evidence",
  ])("fails when the %s boundary row is removed", async (boundaryId) => {
    const { validateOperationalBoundaryRegister } = await loadGuard();

    const result = validateOperationalBoundaryRegister(
      validRegister.replace(new RegExp(`^.*${boundaryId}.*$`, "m"), ""),
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      `docs/operational-readiness.md: missing boundary row '${boundaryId}'`,
    );
  });

  it("fails when a boundary row uses an unknown status", async () => {
    const { validateOperationalBoundaryRegister } = await loadGuard();

    const result = validateOperationalBoundaryRegister(
      validRegister.replace("`evidence-needed` | #227 |", "`made-up` | #227 |"),
    );

    expect(result.ok).toBe(false);
    expect(result.violations).toContain(
      "docs/operational-readiness.md: boundary 'public-telemetry-ingress' has unknown status 'made-up'",
    );
  });

  it("fails when public telemetry ingress control wiring disappears from code", async () => {
    const { validatePublicTelemetryIngressControls } = await loadGuard();
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-boundary-"));
    try {
      const domainAccessDir = path.join(root, "app/server/domain-access");
      const analyticsRouteDir = path.join(root, "app/api/analytics-events");
      const errorsRouteDir = path.join(root, "app/api/errors");
      await mkdir(domainAccessDir, { recursive: true });
      await mkdir(analyticsRouteDir, { recursive: true });
      await mkdir(errorsRouteDir, { recursive: true });
      await writeFile(
        path.join(analyticsRouteDir, "route.ts"),
        "consumePublicTelemetryIngressBudget();\n",
      );
      await writeFile(
        path.join(domainAccessDir, "analytics-event-access.ts"),
        "export function getAnalyticsEventRouterForTrustedServer() {}\n",
      );
      await writeFile(path.join(errorsRouteDir, "route.ts"), "export function POST() {}\n");

      const result = await validatePublicTelemetryIngressControls(root);

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          'app/api/analytics-events/route.ts: missing operational boundary invariant from "@/app/server/domain-access/analytics-event-access"',
          'app/api/analytics-events/route.ts: missing operational boundary invariant consumePublicTelemetryIngressBudget(req, "analytics-events")',
          "app/api/analytics-events/route.ts: missing operational boundary invariant runPublicTelemetryDrain(drain)",
          "app/api/analytics-events/route.ts: missing operational boundary invariant isPublicClientAnalyticsEventNameAllowed(parsed.data.name)",
          'app/server/domain-access/analytics-event-access.ts: missing operational boundary invariant event.trigger.source === "client"',
          'app/api/errors/route.ts: missing operational boundary invariant consumePublicTelemetryIngressBudget(req, "errors")',
          "app/api/errors/route.ts: missing operational boundary invariant runPublicTelemetryDrain(drain)",
        ]),
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails when public magic-link admission wiring disappears from code", async () => {
    const { validatePublicAuthIngressControls } = await loadGuard();
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-boundary-"));
    try {
      const magicLinkRouteDir = path.join(root, "app/api/auth/magic-link");
      const operationalDir = path.join(root, "app/server/operational");
      await mkdir(magicLinkRouteDir, { recursive: true });
      await mkdir(operationalDir, { recursive: true });
      await writeFile(
        path.join(magicLinkRouteDir, "route.ts"),
        'consumeRouteIngressAdmission("magic-link-source", source);\n',
      );
      await writeFile(
        path.join(operationalDir, "route-ingress-admission.ts"),
        'createHash("sha256");\n',
      );

      const result = await validatePublicAuthIngressControls(root);

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          'app/api/auth/magic-link/route.ts: missing operational boundary invariant getRouteBodyLimit("app/api/auth/magic-link/route.ts")',
          'app/api/auth/magic-link/route.ts: missing operational boundary invariant "magic-link-email"',
          "app/api/auth/magic-link/route.ts: missing operational boundary invariant retryAfterSeconds: sourceAdmission.retryAfterSeconds",
          "app/api/auth/magic-link/route.ts: missing operational boundary invariant retryAfterSeconds: emailAdmission.retryAfterSeconds",
          "app/server/operational/route-ingress-admission.ts: missing operational boundary invariant getFixedRouteAdmissionPolicy(policyId)",
          "app/server/operational/route-ingress-admission.ts: missing operational boundary invariant countPolicyBuckets(policy.id)",
        ]),
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it("fails when the provider fan-out control wiring disappears from code", async () => {
    const { validateProviderFanoutControls } = await loadGuard();
    const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-boundary-"));
    try {
      const gatewayDir = path.join(root, "app/server/external-http-gateway");
      await mkdir(gatewayDir, { recursive: true });
      await writeFile(
        path.join(gatewayDir, "episteme-circuit-breaker.ts"),
        "export function getEpistemeBreakerCapacitySnapshot() {}\n",
      );
      await writeFile(
        path.join(gatewayDir, "literature-provider-fetch.ts"),
        "runThroughEpistemeBreaker();\n",
      );

      const result = await validateProviderFanoutControls(root);

      expect(result.ok).toBe(false);
      expect(result.violations).toEqual(
        expect.arrayContaining([
          "app/server/external-http-gateway/episteme-circuit-breaker.ts: missing operational boundary invariant export async function runThroughEpistemeBreaker",
          "app/server/external-http-gateway/literature-provider-fetch.ts: missing operational boundary invariant () => runEpistemeRetryLoop(params)",
          "app/server/external-http-gateway/literature-provider-fetch.ts: missing operational boundary invariant !(result === null && params.signal?.aborted === true)",
        ]),
      );
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
