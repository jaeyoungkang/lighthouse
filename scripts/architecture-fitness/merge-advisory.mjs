#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ELIGIBILITIES = new Set(["allow", "block", "defer-with-owner"]);

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validProductionDeferral(rule) {
  return (
    rule?.mode === "productionEvidenceOnly" &&
    nonEmpty(rule.owner) &&
    nonEmpty(rule.evidencePlan) &&
    nonEmpty(rule.deadline)
  );
}

function validRiskAcceptance(acceptance, caseRef) {
  return (
    acceptance != null &&
    Array.isArray(acceptance.caseRefs) &&
    acceptance.caseRefs.includes(caseRef) &&
    nonEmpty(acceptance.approvedBy) &&
    nonEmpty(acceptance.reason) &&
    /^\d{4}-\d{2}-\d{2}$/.test(acceptance.expiresOn ?? "") &&
    nonEmpty(acceptance.revisitCondition)
  );
}

export function evaluateMergeEligibility(assessment, policy) {
  const cases = new Map((assessment.caseAssessments ?? []).map((item) => [item.caseRef, item]));
  const requiredCaseRefs = policy.requiredCaseRefs ?? [];
  const blockers = [...(policy.blockers ?? [])];
  const deferrals = [];

  for (const caseRef of requiredCaseRefs) {
    const item = cases.get(caseRef);
    if (!item) {
      blockers.push({ caseRef, reason: "required-case-missing" });
      continue;
    }

    if (item.verdicts.includes("degraded")) {
      if (validRiskAcceptance(policy.riskAcceptance, caseRef)) {
        deferrals.push({
          caseRef,
          reason: "explicit-risk-acceptance",
          owner: policy.riskAcceptance.approvedBy,
          deadline: policy.riskAcceptance.expiresOn,
          revisitCondition: policy.riskAcceptance.revisitCondition,
        });
      } else {
        blockers.push({ caseRef, reason: "degraded" });
      }
    }

    if (item.verdicts.includes("unknown")) {
      const rule = policy.unknownHandling?.[caseRef];
      if (validProductionDeferral(rule)) {
        deferrals.push({
          caseRef,
          reason: "production-evidence-only",
          owner: rule.owner,
          evidencePlan: rule.evidencePlan,
          deadline: rule.deadline,
        });
      } else {
        blockers.push({
          caseRef,
          reason:
            rule?.mode === "productionEvidenceOnly"
              ? "invalid-production-evidence-deferral"
              : "unknown-required-before-merge",
        });
      }
    }
  }

  const eligibility =
    blockers.length > 0 ? "block" : deferrals.length > 0 ? "defer-with-owner" : "allow";
  if (!ELIGIBILITIES.has(eligibility)) {
    throw new Error(`Unsupported merge eligibility: ${eligibility}`);
  }
  return {
    schemaVersion: "1",
    reviewRef: assessment.reviewId ?? assessment.policySetRef,
    revision: assessment.revision,
    eligibility,
    architectureFitnessVerdictsPreserved: true,
    blockers,
    deferrals,
    riskAcceptance: policy.riskAcceptance ?? null,
  };
}

async function main() {
  const [reviewPath, assessmentPath] = process.argv.slice(2);
  if (!reviewPath || !assessmentPath) {
    throw new Error("Usage: merge-advisory.mjs <review.json> <assessment.json>");
  }
  const review = JSON.parse(await readFile(reviewPath, "utf8"));
  const assessment = JSON.parse(await readFile(assessmentPath, "utf8"));
  process.stdout.write(
    `${JSON.stringify(evaluateMergeEligibility(assessment, review.lighthouse.mergePolicy), null, 2)}\n`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
