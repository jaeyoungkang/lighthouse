import type { EvidenceLedgerExecution } from "@/app/domain/story-chain";

const REGISTERED_SCRIPT_TARGETS: Readonly<Record<string, readonly string[]>> = {
  "gap-report-concurrency": [
    "scripts/db-integration/run-gap-report-concurrency.ts",
    "app/server/repository/__tests__/gap-reports.postgres.integration.ts",
    "app/server/repository/__tests__/gap-build-principal-admissions.postgres.integration.ts",
  ],
  "mc-check-critical-findings": ["scripts/mission-control/mc-check-critical-findings.ts"],
  "message-registry-contract": ["scripts/mission-control/check-message-registry-contract.ts"],
  "relationship-seed-sticky-browser": [
    "scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
  ],
};

const REGISTERED_GUARD_TARGETS: Readonly<Record<string, readonly string[]>> = {
  "guard:auth-hot-path": ["scripts/quality/check-auth-hot-path.mjs"],
  "guard:korean": ["scripts/quality/check-hardcoded-korean.mjs"],
  "guard:landing-auth-source-boundary": ["scripts/quality/check-landing-auth-source-boundary.mjs"],
  "guard:product-owned-navigation": ["scripts/quality/check-product-owned-navigation.mjs"],
  "guard:search-condition-url-budget": [
    "scripts/architecture-fitness/check-search-condition-url-budget.mjs",
  ],
  "guard:search-first-paint-no-db": ["scripts/quality/check-search-first-paint-no-db.mjs"],
  "guard:state-boundaries": ["scripts/architecture-fitness/check-state-boundaries.mjs"],
};

function basename(target: string): string {
  return target.slice(target.lastIndexOf("/") + 1);
}

export function evidenceExecutionTargets(execution: EvidenceLedgerExecution): string[] {
  if (execution.kind === "vitest") return [...execution.files];
  if (execution.kind === "contract-check") {
    return ["scripts/evidence-ledger/helpers/contract-check.ts"];
  }
  if (execution.kind === "guard") {
    return [...(REGISTERED_GUARD_TARGETS[execution.script] ?? [])];
  }
  return [...(REGISTERED_SCRIPT_TARGETS[execution.script] ?? [])];
}

export function evidenceExecutionCitationAliases(execution: EvidenceLedgerExecution): string[] {
  if (execution.kind !== "guard" && execution.kind !== "registered-script") return [];
  const targets = evidenceExecutionTargets(execution);
  return [execution.script, ...targets, ...targets.map(basename)];
}

export function knownEvidenceExecutableCitationAliases(): string[] {
  const aliases = [
    ...Object.entries(REGISTERED_GUARD_TARGETS).flatMap(([script, targets]) => [
      script,
      ...targets,
      ...targets.map(basename),
    ]),
    ...Object.entries(REGISTERED_SCRIPT_TARGETS).flatMap(([script, targets]) => [
      script,
      ...targets,
      ...targets.map(basename),
    ]),
  ];
  return [...new Set(aliases)];
}

export function formatEvidenceExecution(execution: EvidenceLedgerExecution): string {
  if (execution.kind === "vitest") {
    return [
      "vitest",
      ...execution.files,
      ...(execution.testNamePattern ? ["-t", JSON.stringify(execution.testNamePattern)] : []),
    ].join(" ");
  }
  if (execution.kind === "contract-check") {
    return `contract-check ${execution.target} ${execution.subcase}`;
  }
  return `${execution.kind} ${execution.script}`;
}
