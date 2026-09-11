#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { listArchitectureFitnessProfiles } from "./lighthouse-profiles.mjs";

const ROOT = process.cwd();
export const COVERAGE_PROJECTION_PATH = path.join(
  ROOT,
  "docs",
  "architecture-fitness",
  "service-coverage.projection.json",
);

const COVERAGE_STATUSES = new Set(["included", "unsupported", "excluded", "authority-missing"]);
const UNKNOWN_STATUSES = new Set(["unsupported", "authority-missing"]);
export const REQUIRED_SERVICE_DECISION_BINDINGS = Object.freeze({
  "decision:url-owned-search": [
    ["coverage:url-owned-keyword-search-state", "included", "state-boundary"],
    ["coverage:url-owned-relationship-seed-state", "included", "state-boundary"],
    ["coverage:url-owned-first-ready-critical-path", "included", "critical-path"],
    ["coverage:url-owned-search-condition-budget", "included", "serialized-input-budget"],
  ],
  "decision:route-ai-comment-ephemeral": [
    ["coverage:route-ai-comment-visible-basis", "unsupported", "state-boundary"],
    ["coverage:route-ai-comment-hydration-critical-path", "unsupported", "critical-path"],
  ],
  "decision:gap-report-shared-artifact": [
    ["coverage:gap-artifact-viewer-state", "included", "state-boundary"],
  ],
  "decision:gap-reaction-persisted-preference": [
    ["coverage:gap-artifact-viewer-state", "included", "state-boundary"],
  ],
  "decision:least-authority-boundaries": [
    ["coverage:least-authority-broad-boundary", "included", "least-authority"],
    ["coverage:reviewed-paper-owner-read", "included", "least-authority"],
    ["coverage:supabase-request-least-authority", "unsupported", "least-authority"],
  ],
  "decision:episteme-breaker-instance-self-protection": [
    ["coverage:episteme-breaker-process-scope", "included", "topology-scope"],
  ],
  "decision:effect-owner-chokepoints": [
    ["coverage:approved-effect-owner-chokepoints", "included", "technical-grain"],
  ],
});
export const REQUIRED_SERVICE_DECISION_REFS = Object.freeze(
  Object.keys(REQUIRED_SERVICE_DECISION_BINDINGS),
);
const DECISION_REGISTRY_REF = "github:corca-ai/lighthouse#275";
const RATIFICATION_REF = "github:corca-ai/lighthouse#275@issuecomment-5185805199";
const RATIFICATION_SCOPE =
  "approved-registry-decisions-and-policy-compatibility-only; service-wide classification remains an evidence projection";

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function requireStringArray(value, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error(`${label} must be ${allowEmpty ? "an" : "a non-empty"} array`);
  }
  for (const item of value) requireNonEmptyString(item, `${label} item`);
  if (new Set(value).size !== value.length) throw new Error(`${label} contains duplicates`);
}

async function requireResolvableReference(value, label) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return;
  const [relative] = value.split("#", 1);
  try {
    await access(path.join(ROOT, relative));
  } catch {
    throw new Error(`${label} references a missing local path: ${relative}`);
  }
}

async function loadProfileFacts(profiles) {
  const facts = new Map();
  for (const profile of profiles) {
    const policy = JSON.parse(await readFile(profile.policy, "utf8"));
    const policies = new Map(
      (policy.policies ?? []).map((item) => [item.id, { caseKind: item.caseKind }]),
    );
    const coverage = new Map(
      (policy.coverage ?? []).map((item) => [
        item.id,
        { status: item.status, policyRefs: item.policyRefs ?? [] },
      ]),
    );
    facts.set(profile.id, {
      policies,
      coverage,
    });
  }
  return facts;
}

export async function validateArchitectureFitnessCoverageProjection(
  projection,
  { profiles = listArchitectureFitnessProfiles() } = {},
) {
  if (projection?.schemaVersion !== 1) {
    throw new Error("Architecture Fitness coverage projection schemaVersion must equal 1");
  }
  if (projection?.kind !== "lighthouse-architecture-fitness-coverage-projection") {
    throw new Error("Unexpected Architecture Fitness coverage projection kind");
  }
  requireNonEmptyString(projection.issueRef, "issueRef");
  if (projection.decisionRegistryRef !== DECISION_REGISTRY_REF) {
    throw new Error(`decisionRegistryRef must equal ${DECISION_REGISTRY_REF}`);
  }
  if (projection.ratificationRef !== RATIFICATION_REF) {
    throw new Error(`ratificationRef must equal ${RATIFICATION_REF}`);
  }
  if (projection.ratificationScope !== RATIFICATION_SCOPE) {
    throw new Error("ratificationScope must not claim service-wide Human approval");
  }
  requireNonEmptyString(projection.coreVersion, "coreVersion");
  requireStringArray(projection.requiredDecisionRefs, "requiredDecisionRefs");
  if (
    JSON.stringify(projection.requiredDecisionRefs) !==
    JSON.stringify(REQUIRED_SERVICE_DECISION_REFS)
  ) {
    throw new Error(
      "requiredDecisionRefs must equal the independently pinned service decision set",
    );
  }
  if (!Array.isArray(projection.entries) || projection.entries.length === 0) {
    throw new Error("Architecture Fitness coverage projection entries must be non-empty");
  }

  const profileFacts = await loadProfileFacts(profiles);
  const projectionRefs = new Set();
  const entriesByProjectionRef = new Map();
  const ownedDecisionRefsByProjectionRef = new Map();
  const includedCaseIds = new Set();
  const coveredDecisionRefs = new Set();
  const coveredProfiles = new Set();

  for (const [index, entry] of projection.entries.entries()) {
    const label = `entries[${index}]`;
    requireNonEmptyString(entry.projectionRef, `${label}.projectionRef`);
    if (projectionRefs.has(entry.projectionRef)) {
      throw new Error(`Duplicate projectionRef: ${entry.projectionRef}`);
    }
    projectionRefs.add(entry.projectionRef);
    entriesByProjectionRef.set(entry.projectionRef, entry);

    requireNonEmptyString(entry.decisionRef, `${label}.decisionRef`);
    const ownedDecisionRefs = entry.ownedDecisionRefs ?? [entry.decisionRef];
    requireStringArray(ownedDecisionRefs, `${label}.ownedDecisionRefs`);
    if (!ownedDecisionRefs.includes(entry.decisionRef)) {
      throw new Error(`${label}.ownedDecisionRefs must include the primary decisionRef`);
    }
    ownedDecisionRefsByProjectionRef.set(entry.projectionRef, ownedDecisionRefs);
    for (const decisionRef of ownedDecisionRefs) coveredDecisionRefs.add(decisionRef);
    requireStringArray(entry.relatedDecisionRefs, `${label}.relatedDecisionRefs`, {
      allowEmpty: true,
    });
    for (const decisionRef of entry.relatedDecisionRefs) {
      if (ownedDecisionRefs.includes(decisionRef)) {
        throw new Error(`${label} cannot classify an owned decision as related`);
      }
    }
    requireNonEmptyString(entry.architectureCharacteristic, `${label}.architectureCharacteristic`);
    requireNonEmptyString(entry.owner, `${label}.owner`);
    requireNonEmptyString(entry.caseKind, `${label}.caseKind`);
    requireStringArray(entry.invariantRefs, `${label}.invariantRefs`);
    requireStringArray(entry.evidenceRefs, `${label}.evidenceRefs`);
    requireNonEmptyString(entry.reentryTrigger, `${label}.reentryTrigger`);
    requireStringArray(entry.legacyRefs, `${label}.legacyRefs`, { allowEmpty: true });
    for (const [field, refs] of [
      ["invariantRefs", entry.invariantRefs],
      ["evidenceRefs", entry.evidenceRefs],
      ["legacyRefs", entry.legacyRefs],
    ]) {
      for (const ref of refs) await requireResolvableReference(ref, `${label}.${field}`);
    }

    if (!COVERAGE_STATUSES.has(entry.disposition)) {
      throw new Error(`${label}.disposition has unsupported value: ${String(entry.disposition)}`);
    }
    const authorityMissing = entry.disposition === "authority-missing";
    requireStringArray(entry.authorityRefs, `${label}.authorityRefs`, {
      allowEmpty: authorityMissing,
    });
    if (authorityMissing && entry.authorityRefs.length !== 0) {
      throw new Error(`${label} is authority-missing but declares Human authority`);
    }

    if (entry.disposition === "included") {
      if (entry.binding === null || typeof entry.binding !== "object") {
        throw new Error(`${label} included coverage requires an executable binding`);
      }
      requireNonEmptyString(entry.binding.profileId, `${label}.binding.profileId`);
      requireNonEmptyString(entry.binding.policyCoverageRef, `${label}.binding.policyCoverageRef`);
      requireStringArray(entry.binding.caseRefs, `${label}.binding.caseRefs`);
      if (entry.binding.caseRefs.length !== 1) {
        throw new Error(`${label} must bind exactly one atomic case`);
      }
      const [caseId] = entry.binding.caseRefs;
      if (includedCaseIds.has(caseId)) throw new Error(`Duplicate included caseId: ${caseId}`);
      includedCaseIds.add(caseId);

      const facts = profileFacts.get(entry.binding.profileId);
      if (!facts) {
        throw new Error(`${label} references unknown active profile ${entry.binding.profileId}`);
      }
      const policy = facts.policies.get(caseId);
      if (!policy) {
        throw new Error(
          `${label} case ${caseId} is absent from profile ${entry.binding.profileId}`,
        );
      }
      const coverage = facts.coverage.get(entry.binding.policyCoverageRef);
      if (!coverage || coverage.status !== "included" || !coverage.policyRefs.includes(caseId)) {
        throw new Error(
          `${label} binding does not match included policy coverage ${entry.binding.policyCoverageRef}`,
        );
      }
      if (policy.caseKind !== entry.caseKind) {
        throw new Error(
          `${label} case kind ${entry.caseKind} does not match profile policy ${policy.caseKind}`,
        );
      }
      coveredProfiles.add(entry.binding.profileId);
    } else {
      if (entry.binding !== null) {
        throw new Error(`${label} non-included coverage cannot claim a profile or case`);
      }
    }
  }

  for (const [decisionRef, expectedBindings] of Object.entries(
    REQUIRED_SERVICE_DECISION_BINDINGS,
  )) {
    const allowedProjectionRefs = new Set(expectedBindings.map(([projectionRef]) => projectionRef));
    for (const [projectionRef, disposition, caseKind] of expectedBindings) {
      const entry = entriesByProjectionRef.get(projectionRef);
      if (!entry) {
        throw new Error(`Required Human decision projection is missing: ${projectionRef}`);
      }
      if (!ownedDecisionRefsByProjectionRef.get(projectionRef)?.includes(decisionRef)) {
        throw new Error(`Required Human decision has no direct coverage in ${projectionRef}`);
      }
      if (entry.disposition !== disposition || entry.caseKind !== caseKind) {
        throw new Error(
          `Required Human decision binding drifted at ${projectionRef}: expected ${disposition}/${caseKind}`,
        );
      }
    }
    for (const [projectionRef, ownedDecisionRefs] of ownedDecisionRefsByProjectionRef) {
      if (ownedDecisionRefs.includes(decisionRef) && !allowedProjectionRefs.has(projectionRef)) {
        throw new Error(`Required Human decision was attached to an unrelated row: ${decisionRef}`);
      }
    }
    if (!coveredDecisionRefs.has(decisionRef)) {
      throw new Error(`Required Human decision has no coverage entry: ${decisionRef}`);
    }
  }
  for (const profile of profiles) {
    if (!coveredProfiles.has(profile.id)) {
      throw new Error(`Active profile has no included decision coverage: ${profile.id}`);
    }
    const facts = profileFacts.get(profile.id);
    for (const caseId of facts.policies.keys()) {
      if (!includedCaseIds.has(caseId)) {
        throw new Error(`Active policy case has no decision coverage: ${caseId}`);
      }
    }
  }

  const counts = Object.fromEntries(
    [...COVERAGE_STATUSES].map((status) => [
      status,
      projection.entries.filter((entry) => entry.disposition === status).length,
    ]),
  );
  return {
    ok: true,
    counts,
    activeProfileCount: profiles.length,
    includedProfileCount: coveredProfiles.size,
    unknownCoverageRefs: projection.entries
      .filter((entry) => UNKNOWN_STATUSES.has(entry.disposition))
      .map((entry) => entry.projectionRef),
    entriesByDisposition: Object.fromEntries(
      [...COVERAGE_STATUSES].map((status) => [
        status,
        projection.entries
          .filter((entry) => entry.disposition === status)
          .map((entry) => entry.projectionRef),
      ]),
    ),
  };
}

export async function loadAndValidateArchitectureFitnessCoverageProjection({
  projectionPath = COVERAGE_PROJECTION_PATH,
  profiles = listArchitectureFitnessProfiles(),
} = {}) {
  const source = await readFile(projectionPath, "utf8");
  const projection = JSON.parse(source);
  const summary = await validateArchitectureFitnessCoverageProjection(projection, { profiles });
  return {
    projection,
    summary: {
      ...summary,
      projectionDigest: createHash("sha256").update(source).digest("hex"),
    },
  };
}

async function main() {
  const { summary } = await loadAndValidateArchitectureFitnessCoverageProjection();
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
