import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
  classifyGuardedTreeCompatibility,
  ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
  ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
  ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
  ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
  ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
  normalizeReportArtifact,
  PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
  PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
  PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
  PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
  Q3_WORKLOAD_REPORTS,
  readRevisionReport,
  reportCompatibility,
  SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
} from "../collect-q3-workload.mjs";

const TARGET_REVISION =
  process.env.AF_Q3_TARGET_REVISION ??
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const LATEST_REVIEWED_COMPATIBILITY_REVISION = "ef9b2a0de67388e865ef0560ac26118a94821584";
const Q3_INTEGRATION_BASE_REVISION = "cd8819ba3011da5668118b2fff5970dbbba51664";
const Q3_V5_MEASUREMENT_REVISION = "605ff8dfd17929a5615e343235176b01c42c9a26";
const Q3_V5_GUARDED_TREE_DIGEST =
  "c695fce96986463cdcac628460ce8c7d429004fffcc8a775ccb72814bb54188b";
const PR_338_MEASUREMENT_REVISION = "a02caaf757b2050aab062816249f96269dd052cf";
const PR_338_GUARDED_TREE_DIGEST =
  "ad206128f5a1c582303c608a3e0ae5b593783331d1d148318fc9680007beb544";
const PR_338_MEASUREMENT_UNAVAILABLE_POLICY = "accept-exact-reviewed-target";
const ACTIVE_TRANSITION_GUARDS = new Map([
  [
    Q3_V5_MEASUREMENT_REVISION,
    {
      guardedTreeDigest: Q3_V5_GUARDED_TREE_DIGEST,
      reviewedCompatibleTrees: [PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY],
      measurementUnavailablePolicy: undefined,
    },
  ],
  [
    PR_338_MEASUREMENT_REVISION,
    {
      guardedTreeDigest: PR_338_GUARDED_TREE_DIGEST,
      reviewedCompatibleTrees: [
        PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
        PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
        PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
        AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
        SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
        ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
      ],
      measurementUnavailablePolicy: PR_338_MEASUREMENT_UNAVAILABLE_POLICY,
    },
  ],
]);

type ReviewedCompatibleTree = {
  guardedTreeDigest: string;
  decisionRef: string;
  changedPaths: readonly string[];
  rationale: string;
};

type ReportSpec = {
  scenarioRef: string;
  reportRef: string;
  measurements: Array<{
    expectedDigest: string;
    measuredRevision: string;
    guardedTreeDigest: string;
    reviewedCompatibleTrees?: readonly ReviewedCompatibleTree[];
    measurementUnavailablePolicy?: string;
  }>;
  schemaVersion: string;
  expectedDigest?: string;
  measuredRevision?: string;
  guardedTreeDigest?: string;
  reviewedCompatibleTrees?: readonly ReviewedCompatibleTree[];
  measurementUnavailablePolicy?: string;
  mode: "one-shot" | "sustained-open";
  users?: number;
  durationMs?: number;
  arrivalRatePerSecond?: number;
  maxInFlight?: number;
  inputProfile: string;
  providerProfile: string;
  providerFixtureProfile?: string;
  topologyProfile: string;
  providerEvidence: boolean;
};

type WorkloadReport = {
  schemaVersion: string;
  config: {
    workingTreeDirty: boolean;
    targetRevision: string;
    providerProfile: string;
  };
  cohorts: Array<{
    searchReadiness: Array<{
      userIndex: number;
      paperCount?: number | null;
      paperIds?: string[] | null;
    }>;
    endpoints: Array<{
      endpoint: string;
      outcomes: Record<string, number>;
    }>;
  }>;
  providerFixtureEvidence: null | {
    baseline: { profile: string; searchRequests: number };
    final: { profile: string; responses: { success: number } };
  };
};

const REPORT_SPECS = Q3_WORKLOAD_REPORTS as unknown as readonly ReportSpec[];

function report(index: number): { spec: ReportSpec; value: WorkloadReport } {
  const spec = REPORT_SPECS[index];
  const result = readRevisionReport(TARGET_REVISION, spec) as unknown as {
    report: WorkloadReport;
    resolvedSpec: ReportSpec;
  };
  return { spec: result.resolvedSpec, value: result.report };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function asV5Report(value: WorkloadReport): WorkloadReport {
  const result = clone(value);
  result.schemaVersion = "5";
  result.cohorts[0].searchReadiness = result.cohorts[0].searchReadiness.map(
    ({ userIndex, paperCount }) => ({
      userIndex,
      paperIds:
        paperCount === null
          ? null
          : Array.from(
              { length: paperCount ?? 0 },
              (_unused, index) => `user-${String(userIndex)}-paper-${String(index)}`,
            ),
    }),
  );
  return result;
}

describe("Q3 workload report boundary", () => {
  it("accepts every locked report against the latest Human-reviewed compatible tree", () => {
    for (const spec of REPORT_SPECS) {
      const { report: value, resolvedSpec } = readRevisionReport(
        LATEST_REVIEWED_COMPATIBILITY_REVISION,
        spec,
      ) as unknown as {
        report: WorkloadReport;
        resolvedSpec: ReportSpec;
      };
      expect(() => normalizeReportArtifact(value, resolvedSpec)).not.toThrow();
      const compatibility = reportCompatibility(
        resolvedSpec,
        LATEST_REVIEWED_COMPATIBILITY_REVISION,
      );
      expect(compatibility).toMatchObject({ exitCode: 0 });
      if (compatibility.reviewedCompatibility) {
        const expectedReviewedCompatibility = resolvedSpec.reviewedCompatibleTrees?.find(
          (candidate) => candidate.guardedTreeDigest === compatibility.observedGuardedTreeDigest,
        );
        if (!expectedReviewedCompatibility) {
          throw new Error("active reviewed compatibility fixture missing");
        }
        expect(compatibility).toMatchObject({
          reviewedCompatibility: expectedReviewedCompatibility,
          reviewedChangedPaths: expectedReviewedCompatibility.changedPaths,
        });
        if (compatibility.measurementBindingStatus === "verified") {
          expect(compatibility).toMatchObject({
            changedPaths: expectedReviewedCompatibility.changedPaths,
            changedPathsVerifiedAtRuntime: true,
          });
        } else {
          expect(compatibility).toMatchObject({
            changedPaths: [],
            changedPathsVerifiedAtRuntime: false,
          });
        }
      } else {
        expect(compatibility).toMatchObject({
          compatibilityBasis: "measured-tree",
          changedPaths: [],
          reviewedChangedPaths: [],
        });
      }
    }
  });

  it("accepts either exact active-report transition tuple and preserves the v5 baseline", () => {
    for (const spec of REPORT_SPECS) {
      const { report: activeReport, resolvedSpec: activeSpec } = readRevisionReport(
        LATEST_REVIEWED_COMPATIBILITY_REVISION,
        spec,
      ) as unknown as {
        report: WorkloadReport;
        resolvedSpec: ReportSpec;
      };
      const activeGuardedTreeDigest = ACTIVE_TRANSITION_GUARDS.get(
        activeSpec.measuredRevision ?? "",
      );
      expect(activeGuardedTreeDigest).toBeDefined();
      expect(activeSpec.guardedTreeDigest).toBe(activeGuardedTreeDigest?.guardedTreeDigest);
      expect(activeSpec.reviewedCompatibleTrees ?? []).toEqual(
        activeGuardedTreeDigest?.reviewedCompatibleTrees,
      );
      expect(activeSpec.measurementUnavailablePolicy).toBe(
        activeGuardedTreeDigest?.measurementUnavailablePolicy,
      );
      expect(() => normalizeReportArtifact(activeReport, activeSpec)).not.toThrow();
      const activeCompatibility = reportCompatibility(
        activeSpec,
        LATEST_REVIEWED_COMPATIBILITY_REVISION,
      );
      expect(activeCompatibility).toMatchObject({
        exitCode: 0,
        expectedGuardedTreeDigest: activeGuardedTreeDigest?.guardedTreeDigest,
      });
      if (activeCompatibility.reviewedCompatibility) {
        const expectedReviewedCompatibility = activeSpec.reviewedCompatibleTrees?.find(
          (candidate) =>
            candidate.guardedTreeDigest === activeCompatibility.observedGuardedTreeDigest,
        );
        if (!expectedReviewedCompatibility) {
          throw new Error("active reviewed compatibility fixture missing");
        }
        expect(activeCompatibility).toMatchObject({
          observedGuardedTreeDigest: expectedReviewedCompatibility.guardedTreeDigest,
          reviewedCompatibility: expectedReviewedCompatibility,
          reviewedChangedPaths: expectedReviewedCompatibility.changedPaths,
        });
        if (activeCompatibility.measurementBindingStatus === "verified") {
          expect(activeCompatibility).toMatchObject({
            changedPaths: expectedReviewedCompatibility.changedPaths,
            changedPathsVerifiedAtRuntime: true,
          });
        } else {
          expect(activeCompatibility).toMatchObject({
            changedPaths: [],
            changedPathsVerifiedAtRuntime: false,
          });
        }
      } else {
        expect(activeCompatibility).toMatchObject({
          compatibilityBasis: "measured-tree",
          observedGuardedTreeDigest: activeGuardedTreeDigest?.guardedTreeDigest,
          changedPaths: [],
        });
      }

      const baselineSpec = {
        ...spec,
        reportRef: spec.reportRef.replace("/v6-active/", "/v5/"),
      };
      const { report: baselineReport, resolvedSpec: resolvedBaselineSpec } = readRevisionReport(
        TARGET_REVISION,
        baselineSpec,
      ) as unknown as {
        report: WorkloadReport;
        resolvedSpec: ReportSpec;
      };
      expect(resolvedBaselineSpec.measuredRevision).toBe(Q3_V5_MEASUREMENT_REVISION);
      expect(() => normalizeReportArtifact(baselineReport, resolvedBaselineSpec)).not.toThrow();
      expect(reportCompatibility(resolvedBaselineSpec, Q3_INTEGRATION_BASE_REVISION)).toMatchObject(
        {
          exitCode: 0,
          changedPaths: [],
          expectedGuardedTreeDigest: Q3_V5_GUARDED_TREE_DIGEST,
          observedGuardedTreeDigest: Q3_V5_GUARDED_TREE_DIGEST,
        },
      );
    }
  });

  it("does not carry a reviewed verdict to an incompatible current target", () => {
    for (const spec of REPORT_SPECS) {
      const { resolvedSpec } = readRevisionReport(TARGET_REVISION, spec) as unknown as {
        resolvedSpec: ReportSpec;
      };
      const compatibility = reportCompatibility(resolvedSpec, TARGET_REVISION);

      if (compatibility.exitCode === 0) {
        expect([
          "measured-tree",
          "human-reviewed-compatible-tree",
          "exact-measured-tree-measurement-unavailable",
          "human-reviewed-exact-tree-measurement-unavailable",
        ]).toContain(compatibility.compatibilityBasis);
        continue;
      }

      expect(compatibility).toMatchObject({
        exitCode: 1,
        compatibilityBasis: "incompatible-tree",
        reviewedCompatibility: null,
      });
      expect(compatibility.observedGuardedTreeDigest).not.toBe(
        compatibility.expectedGuardedTreeDigest,
      );
    }
  }, 30_000);

  it("accepts only the exact Human-reviewed PR #338 UI tree and path set", () => {
    expect(PR_338_FINAL_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "fa893beae3fd25bdf585a0c8df17b028ec07236d62723e93641f29591f1045e9",
      decisionRef: "human:2026-07-18:pr338-contract-reconciliation-non-workload",
      changedPaths: [
        "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
        "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
        "app/components/research-route-renderers/search-result-generated-content.tsx",
        "app/components/research-route-renderers/search-result-item.tsx",
        "app/components/research/AgentPanel.tsx",
        "app/components/research/__tests__/AgentPanel.test.tsx",
        "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
        "app/components/research/attach-inline-ai-comment-body-slot.tsx",
        "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
      ],
      rationale:
        "The exact reviewed PR #338 tree adds only presentation, accessibility, Fragment-slot robustness, approved contract and Decision Log reconciliation, and their tests; provider/search execution, admission, readiness detection, and configuration remain unchanged.",
    });
    const reportSpec = REPORT_SPECS[0];
    const pr338Measurement = reportSpec.measurements.find(
      (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
    );
    if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
    const spec = { ...reportSpec, ...pr338Measurement };
    const classificationInput = {
      observedGuardedTreeDigest: PR_338_FINAL_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
      measurementBindingStatus: "verified",
      changedPaths: [...PR_338_FINAL_GUARDED_TREE_COMPATIBILITY.changedPaths],
    };

    expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
      compatible: true,
      compatibilityBasis: "human-reviewed-compatible-tree",
      reviewedCompatibility: PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
    });
    expect(
      classifyGuardedTreeCompatibility(spec, {
        ...classificationInput,
        observedGuardedTreeDigest: `0${PR_338_FINAL_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
      }),
    ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
    expect(
      classifyGuardedTreeCompatibility(spec, {
        ...classificationInput,
        changedPaths: [PR_338_FINAL_GUARDED_TREE_COMPATIBILITY.changedPaths[0]],
      }),
    ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
    expect(
      classifyGuardedTreeCompatibility(spec, {
        ...classificationInput,
        measurementBindingStatus: "unavailable",
        changedPaths: [],
      }),
    ).toMatchObject({
      compatible: true,
      compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
      reviewedCompatibility: PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
    });
    expect(
      classifyGuardedTreeCompatibility(
        { ...spec, measurementUnavailablePolicy: undefined },
        {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
        },
      ),
    ).toMatchObject({
      compatible: false,
      compatibilityBasis: "measurement-revision-unavailable",
    });
    expect(
      classifyGuardedTreeCompatibility(
        { ...spec, measurementUnavailablePolicy: "unsupported-policy" },
        {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
        },
      ),
    ).toMatchObject({
      compatible: false,
      compatibilityBasis: "measurement-revision-unavailable",
    });
    const exactReviewedCompatibleTrees = [
      PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
      PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
      PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
      AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
      SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
      ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
      ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
      ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
      ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
      ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
    ];
    const mutateReviewedCompatibility = (
      index: number,
      changes: Partial<ReviewedCompatibleTree>,
    ) => ({
      ...spec,
      reviewedCompatibleTrees: exactReviewedCompatibleTrees.map((candidate, candidateIndex) =>
        candidateIndex === index ? { ...candidate, ...changes } : candidate,
      ),
    });
    const unavailableBindingMutations = [
      { ...spec, scenarioRef: "scenario:q3-substituted" },
      { ...spec, measuredRevision: "0".repeat(40) },
      { ...spec, guardedTreeDigest: "0".repeat(64) },
      { ...spec, expectedDigest: "0".repeat(64) },
      { ...spec, reportRef: `${spec.reportRef}.substituted` },
      ...Array.from(
        { length: exactReviewedCompatibleTrees.length - 1 },
        (_, offset) => offset + 1,
      ).flatMap((index) => [
        mutateReviewedCompatibility(index, { guardedTreeDigest: "0".repeat(64) }),
        mutateReviewedCompatibility(index, { rationale: "Substituted rationale." }),
        mutateReviewedCompatibility(index, { decisionRef: "human:substituted" }),
        mutateReviewedCompatibility(index, {
          changedPaths: [exactReviewedCompatibleTrees[index]?.changedPaths[0] ?? ""],
        }),
      ]),
      {
        ...spec,
        reviewedCompatibleTrees: exactReviewedCompatibleTrees.slice(0, -1),
      },
      {
        ...spec,
        reviewedCompatibleTrees: [
          ...exactReviewedCompatibleTrees,
          ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
          ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
        ],
      },
      {
        ...spec,
        reviewedCompatibleTrees: [
          exactReviewedCompatibleTrees[1],
          exactReviewedCompatibleTrees[0],
          ...exactReviewedCompatibleTrees.slice(2),
        ],
      },
    ];
    for (const mutatedSpec of unavailableBindingMutations) {
      expect(
        classifyGuardedTreeCompatibility(mutatedSpec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: false,
        compatibilityBasis: "measurement-binding-invalid",
      });
    }
    expect(
      classifyGuardedTreeCompatibility(spec, {
        ...classificationInput,
        measurementBindingStatus: "invalid",
      }),
    ).toMatchObject({
      compatible: false,
      compatibilityBasis: "measurement-binding-invalid",
    });
  });

  it("accepts only the exact PR #338 and production auth integration tree", () => {
    expect(PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "ea909751493d6a5730279b0ed9717d29e7123166deeaef9cb207edd5057eaf01",
      decisionRef: "human:2026-07-18:pr338-main-integration-non-workload",
      changedPaths: [
        "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
        "app/api/auth/magic-link/__tests__/route.test.ts",
        "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
        "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
        "app/components/research-route-renderers/search-result-generated-content.tsx",
        "app/components/research-route-renderers/search-result-item.tsx",
        "app/components/research/AgentPanel.tsx",
        "app/components/research/__tests__/AgentPanel.test.tsx",
        "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
        "app/components/research/attach-inline-ai-comment-body-slot.tsx",
        "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
        "supabase/config.toml",
      ],
      rationale:
        "The exact reviewed integration tree combines the approved PR #338 presentation and contract reconciliation with the production auth callback tests and redirect allowlist; provider/search execution, admission, readiness detection, and workload configuration remain unchanged.",
    });

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      expect(pr338Measurement.reviewedCompatibleTrees).toEqual([
        PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
        PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
        PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
        AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
        SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
        ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
      ]);

      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [
          ...PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.changedPaths,
        ],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths:
            PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(
              0,
              -1,
            ),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact PR #379 canonical-host tree and path set", () => {
    expect(PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "687cb5c089fe368a002eeb406e84ec54c7b114fa54734c4ede565611c9a89bd2",
      decisionRef: "human:2026-07-18:pr379-canonical-host-non-workload",
      changedPaths: [
        "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
        "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
        "app/api/auth/magic-link/__tests__/route.test.ts",
        "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
        "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
        "app/components/research-route-renderers/search-result-generated-content.tsx",
        "app/components/research-route-renderers/search-result-item.tsx",
        "app/components/research/AgentPanel.tsx",
        "app/components/research/__tests__/AgentPanel.test.tsx",
        "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
        "app/components/research/attach-inline-ai-comment-body-slot.tsx",
        "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
        "next.config.ts",
        "supabase/config.toml",
      ],
      rationale:
        "The exact reviewed PR #379 tree combines the approved PR #338 presentation, production auth callback defense, a compatibility-host-only redirect with regression coverage, and the internal canonical-host Decision Log; canonical/local search execution, provider calls, admission, readiness detection, and workload configuration remain unchanged.",
    });

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      expect(pr338Measurement.reviewedCompatibleTrees).toEqual([
        PR_338_FINAL_GUARDED_TREE_COMPATIBILITY,
        PR_338_WITH_PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
        PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
        AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
        SKILL_RUNTIME_INSTALL_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
        ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
        ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
      ]);

      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          observedGuardedTreeDigest: `0${PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(0, -1),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: PR_379_CANONICAL_HOST_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact corrected AI-comment hydration tree", () => {
    expect(AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "034443c37027d0a49a9ec64a34e494c2e43c9f5aab9c277b826d8b1e157327e2",
      decisionRef: "human:2026-07-18:ai-comment-hydration-terminal-repair-non-amplifying",
      changedPaths: [
        "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
        "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
        "app/api/auth/magic-link/__tests__/route.test.ts",
        "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
        "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
        "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
        "app/components/research-route-renderers/search-result-generated-content.tsx",
        "app/components/research-route-renderers/search-result-item.tsx",
        "app/components/research/AgentPanel.tsx",
        "app/components/research/ResearchRouteRuntime.tsx",
        "app/components/research/__tests__/AgentPanel.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
        "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
        "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
        "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
        "app/components/research/attach-inline-ai-comment-body-slot.tsx",
        "app/components/research/research-route-runtime.helpers.ts",
        "app/components/research/route-ai-comment-generation-runtime.ts",
        "app/domain/__tests__/view-snapshot.test.ts",
        "app/domain/view-snapshot.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
        "app/lib/__tests__/view-snapshot.test.ts",
        "app/lib/view-snapshot.ts",
        "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
        "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
        "app/server/domain-access/search-enrichment-access.ts",
        "app/server/services/__tests__/search-hydration.test.ts",
        "app/server/services/search-hydration.ts",
        "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
        "next.config.ts",
        "supabase/config.toml",
      ],
      rationale:
        "The exact reviewed tree combines the approved PR #338 presentation and auth changes, the PR #379 canonical-host and internal Decision Log changes, the published PR #381 Decision Log surface, and AI-comment hydration stabilization. It preserves the Q3 journey arrival, input/provider/topology profiles, healthy-provider search fan-out, admission, route deadline, and concurrency. Server hydration preserves first-commit terrain metadata, records a successful-empty 200 from either initial hydration or repair as terminal, and returns provider errors or aborts to the existing sequential maximum-three client retry path; exhausted retries preserve lightweight evidence and settle ready with a terminal repair marker so faceted comments neither wait forever nor duplicate generation. This is not new latency, production-health, or real-provider evidence.",
    });

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          observedGuardedTreeDigest: `${AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.startsWith("0") ? "1" : "0"}${AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(0, -1),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: AI_COMMENT_HYDRATION_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact issue #208 error-catalog cleanup tree", () => {
    expect(ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "e392727463a7fa59361312c2b4265963e63da5105d3935d3e55cae676a0441e2",
      decisionRef: "human:2026-07-19:issue208-error-catalog-non-workload",
      changedPaths: [
        "app/(admin)/admin/decision-log/admin-decision-log-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-379-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-381-entries.ts",
        "app/(admin)/admin/decision-log/admin-decision-log-pr-386-entries.ts",
        "app/admin/__tests__/story-chain-guide-page.test.tsx",
        "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
        "app/api/auth/magic-link/__tests__/route.test.ts",
        "app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts",
        "app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx",
        "app/components/research-route-renderers/__tests__/search-result-item.test.tsx",
        "app/components/research-route-renderers/search-result-generated-content.tsx",
        "app/components/research-route-renderers/search-result-item.tsx",
        "app/components/research/AgentPanel.tsx",
        "app/components/research/ResearchRouteRuntime.tsx",
        "app/components/research/__tests__/AgentPanel.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx",
        "app/components/research/__tests__/ResearchRouteRuntime.targeting.test.tsx",
        "app/components/research/__tests__/inline-ai-comment-treatment.test.tsx",
        "app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts",
        "app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts",
        "app/components/research/attach-inline-ai-comment-body-slot.tsx",
        "app/components/research/research-route-runtime.helpers.ts",
        "app/components/research/route-ai-comment-generation-runtime.ts",
        "app/domain/__tests__/view-snapshot.test.ts",
        "app/domain/error-catalog.ts",
        "app/domain/view-snapshot.ts",
        "app/i18n/messages.ts",
        "app/i18n/messages/argument-map.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-338.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-379.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-381.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-386.ts",
        "app/i18n/messages/commitment-admin-decision-log-pr-recent.ts",
        "app/i18n/messages/community-map.ts",
        "app/i18n/messages/knowledge-map-interpret.ts",
        "app/i18n/messages/story-chain-guide.ts",
        "app/lib/__tests__/view-snapshot.test.ts",
        "app/lib/view-snapshot.ts",
        "app/server/agent/__tests__/route-ai-comment-generation.test.ts",
        "app/server/domain-access/__tests__/search-enrichment-access.test.ts",
        "app/server/domain-access/search-enrichment-access.ts",
        "app/server/services/__tests__/search-hydration.test.ts",
        "app/server/services/alignment-audit/findings.ts",
        "app/server/services/search-hydration.ts",
        "app/stores/__tests__/research-route-store.ai-comment-generation.test.ts",
        "next.config.ts",
        "supabase/config.toml",
      ],
      rationale:
        "The exact reviewed tree removes only zero-caller error catalog entries and retired fixed-copy messages on top of the approved skill-runtime tree. It does not change search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or any active message caller.",
    });

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          observedGuardedTreeDigest: `0${ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(
            0,
            -1,
          ),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: ISSUE_208_ERROR_CATALOG_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact issue #208 principal fixture cleanup tree", () => {
    expect(ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY).toMatchObject({
      guardedTreeDigest: "0c5001e9d6b048b4cb4b549608883bd80e62ec335259326fe2734ef9d4c554ef",
      decisionRef: "human:2026-07-19:issue208-principal-fixture-non-workload",
      rationale:
        "The exact reviewed tree renames only test fixture values that represent owner or viewer principals across 76 test and fixture files. It does not change production or runtime implementation, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
    });
    expect(ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths).toHaveLength(117);
    expect(
      createHash("sha256")
        .update(
          `${ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths.join("\n")}\n`,
        )
        .digest("hex"),
    ).toBe("6c77df453f147612420dbac1e9d181cb9118acb8917aa2b1e5bdfcc925779386");

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          observedGuardedTreeDigest: `${ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.startsWith("0") ? "1" : "0"}${ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(
            0,
            -1,
          ),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths[1],
            ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths[0],
            ...ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(2),
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: ISSUE_208_PRINCIPAL_FIXTURE_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact issue #208 stale fixture and CSS cleanup tree", () => {
    expect(ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY).toMatchObject({
      guardedTreeDigest: "957eca07faf715c281ec618b8b5ac78eec37c14fe8fa02cb20e70c200c960a5e",
      decisionRef: "human:2026-07-19:issue208-stale-fixture-css-non-workload",
      rationale:
        "The exact reviewed tree removes only redundant empty-directory scaffolding from the intent surface audit fixture and zero-caller global CSS tokens and selectors on top of the approved principal fixture tree. It does not change production component markup, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
    });
    expect(ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths).toHaveLength(119);
    expect(
      createHash("sha256")
        .update(
          `${ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths.join("\n")}\n`,
        )
        .digest("hex"),
    ).toBe("c29a395f19df1afec78174c1c3201ae427600aee5e2f9d2a77641e6f66819b0a");
    expect(ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths).toContain(
      "app/globals.css",
    );
    expect(ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths).toContain(
      "app/server/services/__tests__/intent-surface-audit.test.ts",
    );

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(
            0,
            -1,
          ),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths[1],
            ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths[0],
            ...ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(2),
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: ISSUE_208_STALE_FIXTURE_CSS_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact issue #208 gap lifetime regression tree", () => {
    expect(ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY).toMatchObject({
      guardedTreeDigest: "49fbe648a02727a551158f20434d2ba1e038477d74d3132db7c0e4254592dc7c",
      decisionRef:
        "human:2026-07-19:issue208-gap-lifetime-regression-and-decision-log-non-workload",
      rationale:
        "The exact reviewed tree adds a deterministic SearchView unmount regression that locks the existing shared detached-gap continuation after dispatch, keeps its close assertion lint-safe without changing test behavior, and includes the Human-approved internal Decision Log entry for that contract. It does not change production runtime implementation, search execution, provider calls, admission, readiness detection, route deadlines, concurrency, workload configuration, or analytics event contracts.",
    });
    expect(ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths).toHaveLength(
      122,
    );
    expect(
      createHash("sha256")
        .update(
          `${ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths.join("\n")}\n`,
        )
        .digest("hex"),
    ).toBe("06961f27916f943a40c2dc49fd7a66a88e3213c10e327a1f8c74a4f9c997c31f");
    expect(ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths).toContain(
      "app/components/research-route-renderers/__tests__/search-view-states.test.tsx",
    );
    expect(ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths).toContain(
      "app/(admin)/admin/decision-log/admin-decision-log-pr-416-entries.ts",
    );
    expect(ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths).toContain(
      "app/i18n/messages/commitment-admin-decision-log-pr-416.ts",
    );

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [
          ...ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths,
        ],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths:
            ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(0, -1),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ...ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths,
            "app/unreviewed-extra-path.ts",
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [
            ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths[1],
            ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths[0],
            ...ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(2),
          ],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: ISSUE_208_GAP_LIFETIME_REGRESSION_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact issue #399 URL-budget compatibility tree", () => {
    expect(ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY).toMatchObject({
      guardedTreeDigest: "e3eb178ddd5b2954da5a01deb979d5a7f53e0f999dafc141cebb3c8c5368734e",
      decisionRef: "implementation:2026-07-19:issue399-url-budget-non-workload",
    });
    expect(ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY.changedPaths).toHaveLength(155);
    expect(
      createHash("sha256")
        .update(`${ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY.changedPaths.join("\n")}\n`)
        .digest("hex"),
    ).toBe("8b2d07546245e47343d741be4a5badb16b4931b84d96e3e84d5dde122ea5f0c8");

    for (const reportSpec of REPORT_SPECS) {
      const pr338Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === PR_338_MEASUREMENT_REVISION,
      );
      if (!pr338Measurement) throw new Error("PR #338 measurement fixture missing");
      const spec = { ...reportSpec, ...pr338Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY.changedPaths.slice(0, -1),
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-exact-tree-measurement-unavailable",
        reviewedCompatibility: ISSUE_399_URL_BUDGET_GUARDED_TREE_COMPATIBILITY,
      });
    }
  });

  it("accepts only the exact production auth callback tree and path set", () => {
    expect(PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY).toEqual({
      guardedTreeDigest: "4be8a4050a45a467c32744dae8a3fd2f87776a996cec68f8a390bb3a9ce29b5b",
      decisionRef: "human:2026-07-18:production-auth-callback-non-workload",
      changedPaths: [
        "app/api/auth/magic-link/__tests__/production-auth-config.test.ts",
        "app/api/auth/magic-link/__tests__/route.test.ts",
        "supabase/config.toml",
      ],
      rationale:
        "The exact reviewed production auth callback tree changes only same-origin PKCE callback tests and the Supabase redirect allowlist; provider/search execution, admission, readiness detection, and workload configuration remain unchanged.",
    });

    for (const reportSpec of REPORT_SPECS) {
      const v5Measurement = reportSpec.measurements.find(
        (measurement) => measurement.measuredRevision === Q3_V5_MEASUREMENT_REVISION,
      );
      if (!v5Measurement) throw new Error("Q3 v5 measurement fixture missing");
      expect(v5Measurement.reviewedCompatibleTrees).toEqual([
        PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
      ]);

      const spec = { ...reportSpec, ...v5Measurement };
      const classificationInput = {
        observedGuardedTreeDigest:
          PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest,
        measurementBindingStatus: "verified",
        changedPaths: [...PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.changedPaths],
      };

      expect(classifyGuardedTreeCompatibility(spec, classificationInput)).toMatchObject({
        compatible: true,
        compatibilityBasis: "human-reviewed-compatible-tree",
        reviewedCompatibility: PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY,
      });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          observedGuardedTreeDigest: `0${PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.guardedTreeDigest.slice(1)}`,
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          changedPaths: [PRODUCTION_AUTH_CALLBACK_GUARDED_TREE_COMPATIBILITY.changedPaths[0]],
        }),
      ).toMatchObject({ compatible: false, compatibilityBasis: "incompatible-tree" });
      expect(
        classifyGuardedTreeCompatibility(spec, {
          ...classificationInput,
          measurementBindingStatus: "unavailable",
          changedPaths: [],
        }),
      ).toMatchObject({
        compatible: false,
        compatibilityBasis: "measurement-revision-unavailable",
      });
    }
  });

  it("rejects an available measured object whose guarded-tree binding is invalid", () => {
    const reportSpec = REPORT_SPECS[0];
    const v5Measurement = reportSpec.measurements.find(
      (measurement) => measurement.measuredRevision === Q3_V5_MEASUREMENT_REVISION,
    );
    if (!v5Measurement) throw new Error("Q3 v5 measurement fixture missing");
    const spec = { ...reportSpec, ...v5Measurement };
    expect(
      reportCompatibility(
        {
          ...spec,
          guardedTreeDigest: "0".repeat(64),
          reviewedCompatibleTrees: [],
        },
        TARGET_REVISION,
      ),
    ).toMatchObject({
      exitCode: 1,
      measuredRevisionAvailable: true,
      measurementBindingStatus: "invalid",
      compatibilityBasis: "measurement-binding-invalid",
    });
  });

  it("rejects a report measurement whose guarded-tree binding is substituted", () => {
    const { spec } = report(0);
    expect(
      reportCompatibility({ ...spec, guardedTreeDigest: "0".repeat(64) }, TARGET_REVISION),
    ).toMatchObject({ exitCode: 1 });
  });

  it("rejects dirty, misattributed, or profile-substituted reports", () => {
    const { spec, value } = report(0);
    const dirty = clone(value);
    dirty.config.workingTreeDirty = true;
    expect(() => normalizeReportArtifact(dirty, spec)).toThrow(/dirty reports/);

    const wrongRevision = clone(value);
    wrongRevision.config.targetRevision =
      spec.measuredRevision === "0".repeat(40) ? "1".repeat(40) : "0".repeat(40);
    expect(() => normalizeReportArtifact(wrongRevision, spec)).toThrow(/target revision/);

    const wrongProfile = clone(value);
    wrongProfile.config.providerProfile = "provider-substitution";
    expect(() => normalizeReportArtifact(wrongProfile, spec)).toThrow(/provider profile/);
  });

  it("rejects incomplete workload counts and outcomes", () => {
    const { spec, value } = report(1);
    const incomplete = clone(value);
    incomplete.cohorts[0].searchReadiness.pop();
    expect(() => normalizeReportArtifact(incomplete, spec)).toThrow(/readiness count/);

    const inconsistentOutcome = clone(value);
    const endpoint = inconsistentOutcome.cohorts[0].endpoints.find(
      (item) => item.endpoint === "GET /search?q= (query execution)",
    );
    if (!endpoint) throw new Error("query endpoint fixture missing");
    endpoint.outcomes["2xx"] -= 1;
    expect(() => normalizeReportArtifact(inconsistentOutcome, spec)).toThrow(/outcomes/);

    const misclassifiedError = clone(value);
    const errorEndpoint = misclassifiedError.cohorts[0].endpoints.find(
      (item) => item.endpoint === "GET /search?q= (query execution)",
    );
    if (!errorEndpoint) throw new Error("query endpoint fixture missing");
    errorEndpoint.outcomes["2xx"] -= 1;
    errorEndpoint.outcomes["5xx"] += 1;
    expect(() => normalizeReportArtifact(misclassifiedError, spec)).toThrow(/total error count/);
  });

  it("normalizes ordered v5 paper identities without rewriting locked v4 evidence", () => {
    const { spec, value } = report(0);
    const v5 = asV5Report(value);
    const normalized = normalizeReportArtifact(v5, {
      ...spec,
      schemaVersion: "5",
    }) as { successfulUnits: number };

    expect(normalized.successfulUnits).toBe(20);
    expect(value.schemaVersion).toBe("4");
    expect(value.cohorts[0].searchReadiness[0]).toHaveProperty("paperCount");
  });

  it("rejects malformed, duplicate, or aliased v5 paper identity evidence", () => {
    const { spec, value } = report(0);
    const v5Spec = { ...spec, schemaVersion: "5" };

    const emptyIdentity = asV5Report(value);
    emptyIdentity.cohorts[0].searchReadiness[0].paperIds = [""];
    expect(() => normalizeReportArtifact(emptyIdentity, v5Spec)).toThrow(
      /invalid paper identities/,
    );

    const duplicateIdentity = asV5Report(value);
    duplicateIdentity.cohorts[0].searchReadiness[0].paperIds = ["paper-1", "paper-1"];
    expect(() => normalizeReportArtifact(duplicateIdentity, v5Spec)).toThrow(
      /invalid paper identities/,
    );

    const retiredAlias = asV5Report(value);
    retiredAlias.cohorts[0].searchReadiness[0].paperCount = 1;
    expect(() => normalizeReportArtifact(retiredAlias, v5Spec)).toThrow(/retired paperCount field/);
  });

  it("rejects reused or incomplete provider counter windows", () => {
    const { spec, value } = report(2);
    const reused = clone(value);
    if (!reused.providerFixtureEvidence) throw new Error("provider fixture evidence missing");
    reused.providerFixtureEvidence.baseline.searchRequests = 1;
    expect(() => normalizeReportArtifact(reused, spec)).toThrow(/baseline/);

    const incomplete = clone(value);
    if (!incomplete.providerFixtureEvidence) throw new Error("provider fixture evidence missing");
    incomplete.providerFixtureEvidence.final.responses.success -= 1;
    expect(() => normalizeReportArtifact(incomplete, spec)).toThrow(/responses/);

    const wrongFixtureProfile = clone(value);
    if (!wrongFixtureProfile.providerFixtureEvidence) {
      throw new Error("provider fixture evidence missing");
    }
    wrongFixtureProfile.providerFixtureEvidence.baseline.profile = "delay";
    wrongFixtureProfile.providerFixtureEvidence.final.profile = "delay";
    expect(() => normalizeReportArtifact(wrongFixtureProfile, spec)).toThrow(/fixture profile/);
  });
});
