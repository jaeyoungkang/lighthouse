import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  inspectInlineAnalysisSources,
  normalizeProbeTestReport,
  validatePolicyBoundary,
} from "../collect-inline-analysis-cache-lifecycle.mjs";

const root = process.cwd();
const policyPath = path.join(
  root,
  "docs/architecture-fitness/pilots/issue-401-inline-analysis-cache-lifecycle.policy.json",
);
const sourcePaths = {
  analysis: "app/domain/analysis.ts",
  identity: "app/server/domain-access/inline-analysis-identity.ts",
  access: "app/server/domain-access/inline-analysis-access.ts",
  repository: "app/server/repository/paper-inline-analysis-cache.ts",
  sharedMigration: "supabase/migrations/00020_shared_inline_analysis_cache.sql",
  failureMigration: "supabase/migrations/00024_inline_analysis_failure_fence.sql",
  runtime: "docs/runtime-flows/search-background-enrichment.md",
} as const;

interface PolicyFixture {
  coverage: Array<{ id: string; status: string; policyRefs: string[] }>;
  policies: Array<{
    lifecycleScenarios: Array<{
      id: string;
      required: boolean;
      cacheRef: string;
      scenarioKind: string;
      requiredOutcomeRefs: string[];
      forbiddenOutcomeRefs: string[];
      requiredEvidenceRoles: string[];
    }>;
  }>;
}

async function readSources(): Promise<Record<keyof typeof sourcePaths, string>> {
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sourcePaths).map(async ([key, ref]) => [
        key,
        await readFile(path.join(root, ref), "utf8"),
      ]),
    ),
  ) as Record<keyof typeof sourcePaths, string>;
}

function passedProbeReport() {
  return {
    exitCode: 0,
    tests: [
      {
        assertions: [
          "normalizes canonical input and separates content, year, and version identity",
          "reuses a ready hit and claims a miss before provider execution",
          "keeps an unclaimed worker out of provider execution",
          "isolates one subscriber abort from shared process work",
          "blocks automatic failed-state retry and allows explicit retry",
        ].map((name) => ({ name, status: "passed" })),
      },
    ],
  };
}

describe("inline-analysis cache-lifecycle collector boundary", () => {
  it("normalizes the current deterministic production seam", async () => {
    const observed = inspectInlineAnalysisSources(await readSources());

    expect(observed).toMatchObject({
      cacheRef: "cache:lighthouse-paper-inline-analysis-shared-artifact",
      sourceOwnerRef: "source:provider-paper-title-abstract-year",
      keyRefs: ["key:paper-id", "key:inline-analysis-version", "key:canonical-input-fingerprint"],
      freshnessRef: "freshness:exact-input-fingerprint-and-analysis-version-no-time-ttl",
      missRef: "miss:exact-identity-db-claim-before-provider-fill",
      negativeResultRef: "negative:no-ready-artifact-without-usable-abstract",
      failureRef: "failure:durable-explicit-retry-fence-never-ready-artifact",
      fillControlRef: "fill:exact-identity-db-token-lease-plus-process-subscriber-coalescing",
      sharingScope: "fleet",
      persistenceScope: "durable",
      analysisVersion: 10,
    });
  });

  it("detects identity, claim, subscriber, and failure-fence mutations", async () => {
    const sources = await readSources();
    const withoutFingerprint = inspectInlineAnalysisSources({
      ...sources,
      identity: sources.identity.replace(
        "inputFingerprint: buildInlineAnalysisInputFingerprint(paper)",
        'inputFingerprint: "0".repeat(64)',
      ),
    });
    const withoutVersionConstraint = inspectInlineAnalysisSources({
      ...sources,
      sharedMigration: sources.sharedMigration.replace(
        "    paper_id,\n    version,\n    input_fingerprint",
        "    paper_id,\n    input_fingerprint",
      ),
    });
    const withoutClaim = inspectInlineAnalysisSources({
      ...sources,
      access: sources.access.replace(
        "claimInlineAnalysisGeneration(",
        "claimInlineAnalysisGenerationBypassed(",
      ),
    });
    const withoutSubscriberFence = inspectInlineAnalysisSources({
      ...sources,
      access: sources.access.replace("entry.subscribers.size === 0", "entry.subscribers.size >= 0"),
    });
    const withoutExplicitRetry = inspectInlineAnalysisSources({
      ...sources,
      failureMigration: sources.failureMigration.replaceAll(
        "p_retry_command = 'explicit_retry'",
        "p_retry_command = 'automatic'",
      ),
    });

    expect(withoutFingerprint.keyRefs).toEqual(["key:unresolved"]);
    expect(withoutVersionConstraint.keyRefs).toEqual(["key:unresolved"]);
    expect(withoutVersionConstraint.freshnessRef).toBe("freshness:unresolved");
    expect(withoutVersionConstraint.invalidationRefs).toEqual(["invalidation:unresolved"]);
    expect(withoutClaim.missRef).toBe("miss:unresolved");
    expect(withoutClaim.sharingScope).toBe("process");
    expect(withoutSubscriberFence.fillControlRef).toBe("fill:unresolved");
    expect(withoutExplicitRetry.failureRef).toBe("failure:unresolved");
  });

  it("keeps fleet, cleanup, and provider outcomes outside the included policy", async () => {
    const policy = JSON.parse(await readFile(policyPath, "utf8")) as PolicyFixture;
    expect(validatePolicyBoundary(policy)).toEqual([]);

    const promotedFleet = structuredClone(policy);
    const fleet = promotedFleet.coverage.find(
      (item) => item.id === "coverage:issue-401-inline-analysis-fleet",
    );
    if (!fleet) throw new Error("missing inline-analysis fleet coverage fixture");
    fleet.status = "included";
    fleet.policyRefs = ["issue-401:inline-analysis-cache-lifecycle"];
    expect(validatePolicyBoundary(promotedFleet)).toContain(
      "coverage:issue-401-inline-analysis-fleet must remain unsupported",
    );

    const cleanupScenario = structuredClone(policy);
    cleanupScenario.policies[0].lifecycleScenarios.push({
      id: "scenario:cleanup-effects",
      required: true,
      cacheRef: "cache:lighthouse-paper-inline-analysis-shared-artifact",
      scenarioKind: "invalidation",
      requiredOutcomeRefs: ["outcome:production-cleanup-safe"],
      forbiddenOutcomeRefs: [],
      requiredEvidenceRoles: ["cache-lifecycle-scenario-test"],
    });
    expect(validatePolicyBoundary(cleanupScenario)).toContain(
      "unsupported scenario kind entered deterministic case: invalidation",
    );
  });

  it("requires every focused probe outcome before reporting complete scenarios", () => {
    const complete = normalizeProbeTestReport(passedProbeReport());
    expect(complete.valid).toBe(true);
    expect(complete.outcomes.concurrentFill).toContain("outcome:caller-abort-isolated");

    const missingLoser = passedProbeReport();
    missingLoser.tests[0].assertions = missingLoser.tests[0].assertions.filter(
      (assertion) =>
        !assertion.name.endsWith("keeps an unclaimed worker out of provider execution"),
    );
    const incomplete = normalizeProbeTestReport(missingLoser);
    expect(incomplete.valid).toBe(false);
    expect(incomplete.outcomes.concurrentFill).toEqual(["outcome:probe-unavailable"]);
  });
});
