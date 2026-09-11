import path from "node:path";

const ROOT = process.cwd();
const PILOT_ROOT = path.join(ROOT, "docs", "architecture-fitness", "pilots");

export const ISSUE_278_PROFILE = {
  id: "issue-278-least-authority",
  policy: path.join(PILOT_ROOT, "issue-278.policy.json"),
  collector: path.join(ROOT, "scripts", "architecture-fitness", "collect-least-authority.mjs"),
  mergePolicy: {
    requiredCaseRefs: ["issue-278:reviewed-paper-owner-read"],
    unknownHandling: {
      "issue-278:reviewed-paper-owner-read": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_276_PROFILE = {
  id: "issue-276-search-state-boundary",
  policy: path.join(PILOT_ROOT, "issue-276.policy.json"),
  collector: path.join(
    ROOT,
    "scripts",
    "architecture-fitness",
    "collect-search-state-boundary.mjs",
  ),
  mergePolicy: {
    requiredCaseRefs: ["issue-276:keyword-search-state-boundary"],
    unknownHandling: {
      "issue-276:keyword-search-state-boundary": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_276_RELATIONSHIP_PROFILE = {
  id: "issue-276-relationship-state-boundary",
  policy: path.join(PILOT_ROOT, "issue-276-relationship.policy.json"),
  collector: path.join(
    ROOT,
    "scripts",
    "architecture-fitness",
    "collect-relationship-state-boundary.mjs",
  ),
  mergePolicy: {
    requiredCaseRefs: ["issue-276:relationship-seed-state-boundary"],
    unknownHandling: {
      "issue-276:relationship-seed-state-boundary": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_280_281_PROFILE = {
  id: "issue-280-281-q2-macro",
  policy: path.join(PILOT_ROOT, "issue-280-281.policy.json"),
  collector: path.join(ROOT, "scripts", "architecture-fitness", "collect-q2-macro.mjs"),
  mergePolicy: {
    requiredCaseRefs: [
      "issue-280:episteme-breaker-process-scope",
      "issue-281:first-ready-search-payload",
    ],
    unknownHandling: {
      "issue-280:episteme-breaker-process-scope": { mode: "requiredBeforeMerge" },
      "issue-281:first-ready-search-payload": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_286_Q3_WORKLOAD_PROFILE = {
  id: "issue-286-q3-workload",
  policy: path.join(PILOT_ROOT, "issue-286-q3-workload.policy.json"),
  collector: path.join(ROOT, "scripts", "architecture-fitness", "collect-q3-workload.mjs"),
  mergePolicy: {
    requiredCaseRefs: ["issue-286:search-workload-envelope"],
    unknownHandling: {
      "issue-286:search-workload-envelope": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE = {
  id: "issue-297-q4-technical-grain",
  policy: path.join(PILOT_ROOT, "issue-297-q4-technical-grain.policy.json"),
  collector: path.join(ROOT, "scripts", "architecture-fitness", "collect-q4-technical-grain.mjs"),
  mergePolicy: {
    requiredCaseRefs: ["issue-297:technical-grain-conformance"],
    unknownHandling: {
      "issue-297:technical-grain-conformance": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE = {
  id: "issue-298-q5-cache-lifecycle",
  policy: path.join(PILOT_ROOT, "issue-298-q5-cache-lifecycle.policy.json"),
  collector: path.join(ROOT, "scripts", "architecture-fitness", "collect-q5-cache-lifecycle.mjs"),
  mergePolicy: {
    requiredCaseRefs: ["issue-298:preset-title-cache-lifecycle"],
    unknownHandling: {
      "issue-298:preset-title-cache-lifecycle": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE = {
  id: "issue-399-serialized-input-budget",
  policy: path.join(PILOT_ROOT, "issue-399-serialized-input-budget.policy.json"),
  collector: path.join(
    ROOT,
    "scripts",
    "architecture-fitness",
    "collect-search-condition-url-budget.mjs",
  ),
  mergePolicy: {
    requiredCaseRefs: ["issue-399:search-first-condition-url-budget"],
    unknownHandling: {
      "issue-399:search-first-condition-url-budget": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_401_GAP_SHARED_STATE_PROFILE = {
  id: "issue-401-gap-shared-state-boundary",
  policy: path.join(PILOT_ROOT, "issue-401-gap-shared-state.policy.json"),
  collector: path.join(
    ROOT,
    "scripts",
    "architecture-fitness",
    "collect-gap-shared-state-boundary.mjs",
  ),
  mergePolicy: {
    requiredCaseRefs: ["issue-401:gap-shared-artifact-viewer-state-boundary"],
    unknownHandling: {
      "issue-401:gap-shared-artifact-viewer-state-boundary": {
        mode: "requiredBeforeMerge",
      },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

export const ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE = {
  id: "issue-401-inline-analysis-cache-lifecycle",
  policy: path.join(PILOT_ROOT, "issue-401-inline-analysis-cache-lifecycle.policy.json"),
  collector: path.join(
    ROOT,
    "scripts",
    "architecture-fitness",
    "collect-inline-analysis-cache-lifecycle.mjs",
  ),
  mergePolicy: {
    requiredCaseRefs: ["issue-401:inline-analysis-cache-lifecycle"],
    unknownHandling: {
      "issue-401:inline-analysis-cache-lifecycle": { mode: "requiredBeforeMerge" },
    },
    blockers: [],
    riskAcceptance: null,
  },
};

const LIGHTHOUSE_ARCHITECTURE_FITNESS_PROFILES = {
  [ISSUE_278_PROFILE.id]: ISSUE_278_PROFILE,
  [ISSUE_276_PROFILE.id]: ISSUE_276_PROFILE,
  [ISSUE_276_RELATIONSHIP_PROFILE.id]: ISSUE_276_RELATIONSHIP_PROFILE,
  [ISSUE_280_281_PROFILE.id]: ISSUE_280_281_PROFILE,
  [ISSUE_286_Q3_WORKLOAD_PROFILE.id]: ISSUE_286_Q3_WORKLOAD_PROFILE,
  [ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE.id]: ISSUE_297_Q4_TECHNICAL_GRAIN_PROFILE,
  [ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE.id]: ISSUE_298_Q5_CACHE_LIFECYCLE_PROFILE,
  [ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE.id]: ISSUE_399_SERIALIZED_INPUT_BUDGET_PROFILE,
  [ISSUE_401_GAP_SHARED_STATE_PROFILE.id]: ISSUE_401_GAP_SHARED_STATE_PROFILE,
  [ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE.id]:
    ISSUE_401_INLINE_ANALYSIS_CACHE_LIFECYCLE_PROFILE,
};

export const PROTECTED_PUBLICATION_EXCLUSIONS = Object.freeze({
  [ISSUE_286_Q3_WORKLOAD_PROFILE.id]: Object.freeze({
    status: "suspended",
    coverage: "unsupported",
    verdict: "unknown",
    reason:
      "The retained workload reports do not bind to current revisions, so exact-head collection is partial.",
    decisionRef: "github:corca-ai/lighthouse#459",
    reentryRef: "github:corca-ai/lighthouse#286",
  }),
});

export function listArchitectureFitnessProfiles() {
  return Object.values(LIGHTHOUSE_ARCHITECTURE_FITNESS_PROFILES);
}

export function listProtectedArchitectureFitnessProfiles() {
  return listArchitectureFitnessProfiles().filter(
    (profile) => PROTECTED_PUBLICATION_EXCLUSIONS[profile.id] === undefined,
  );
}

export function resolveArchitectureFitnessProfile(profileId = ISSUE_278_PROFILE.id) {
  const profile = LIGHTHOUSE_ARCHITECTURE_FITNESS_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown Architecture Fitness profile: ${profileId}`);
  return profile;
}
