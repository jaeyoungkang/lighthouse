// Phase 2 — full Story Chain validator. Combines the per-file
// parsers/resolvers (already verified by `parser.test.ts`) into a graph-wide
// audit. Returns a summary the CLI script can render. Throws
// `StoryChainParseError` on the first hard inconsistency so the script exits
// with a non-zero code.

import { TRACEABILITY_NODE_KINDS } from "@/app/domain/story-chain";

import { type StoryChain } from "./loader";
import { StoryChainParseError } from "./parser-shared";
import { resolvePromiseParents, resolveEvidenceLedger } from "./resolver";

const SERVICE_POLICY_REVIEW_REPO_REF_PATTERN =
  /^docs\/contracts\/story-chain\/service-policy-coverage\/[A-Za-z0-9._-]+\.matrix\.yaml$/;

export interface StoryChainValidationSummary {
  scenarioCount: number;
  experienceCount: number;
  momentCount: number;
  promiseCount: number;
  aspectCount: number;
  evidenceLedgerCount: number;
  explicitIntentLedgerCount: number;
  absorbedIntentLedgerCount: number;
  delegatedIntentLedgerCount: number;
  promisesByVerdict: Record<"met" | "not-met" | "unknown", number>;
  ledgersByVerdict: Record<"met" | "not-met" | "unknown", number>;
  traceabilityRelationCount: number;
}

function ensureNoDuplicates(ids: readonly string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new StoryChainParseError(`${label}: duplicate id "${id}"`);
    }
    seen.add(id);
  }
}

function ensureNonEmptyChain(chain: StoryChain): void {
  // The Phase 2 contract is that the current chain mirrors every Promise/Aspect
  // and every full ledger. A green run with zero promises or zero ledger
  // ledgers means the loader walked an empty graph — the validator must
  // refuse that, otherwise deleting the docs/contracts/story-chain content
  // would silently turn the gate green.
  const required: ReadonlyArray<{ count: number; label: string }> = [
    { count: chain.experiences.length, label: "experiences" },
    { count: chain.moments.length, label: "moments" },
    { count: chain.promises.length, label: "promises" },
    { count: chain.aspects.length, label: "aspects" },
    { count: chain.evidenceLedgers.length, label: "evidence ledgers" },
  ];
  const empty = required.filter((r) => r.count === 0).map((r) => r.label);
  if (empty.length > 0) {
    throw new StoryChainParseError(
      `Story Chain graph has zero ${empty.join(", zero ")}. The new chain must mirror the current chain in every category — refusing to mark this state green.`,
    );
  }
}

function validateIdentityUniqueness(chain: StoryChain): void {
  ensureNoDuplicates(
    chain.scenarios.map((scenario) => scenario.id),
    "scenarios",
  );
  ensureNoDuplicates(
    chain.experiences.map((e) => e.id),
    "experiences",
  );
  ensureNoDuplicates(
    chain.moments.map((m) => m.id),
    "moments",
  );
  ensureNoDuplicates(
    chain.promises.map((p) => p.id),
    "promises",
  );
  ensureNoDuplicates(
    chain.aspects.map((a) => a.id),
    "aspects",
  );
  ensureNoDuplicates(
    chain.promises.map((p) => p.slug),
    "promise slugs",
  );
  ensureNoDuplicates(
    chain.aspects.map((a) => a.slug),
    "aspect slugs",
  );
}

function validatePolicyMatrixItems(
  matrix: StoryChain["servicePolicyMatrices"][number],
  promiseIds: ReadonlySet<string>,
): void {
  for (const item of matrix.families.flatMap((family) => family.items)) {
    for (const promiseRef of item.sourcePromises) {
      if (!promiseIds.has(promiseRef)) {
        throw new StoryChainParseError(
          `${matrix.id}/${item.id}: sourcePromises references unknown Promise "${promiseRef}"`,
        );
      }
    }
    if (
      item.disposition === "owned" &&
      (item.verificationRefs.length === 0 ||
        (item.responsibilitySurfaces.includes("lighthouse-story-chain") &&
          item.sourcePromises.length === 0))
    ) {
      throw new StoryChainParseError(
        `${matrix.id}/${item.id}: owned policy must preserve verification refs and any Story Chain Source Promise`,
      );
    }
  }
}

function validateCoreProductPolicy(
  chain: StoryChain,
  experience: StoryChain["experiences"][number],
  promiseIds: ReadonlySet<string>,
): void {
  if (!experience.servicePolicyCoverage) {
    throw new StoryChainParseError(
      `${experience.id}: core-product Experience must declare servicePolicyCoverage before composing its Story Chain bundle`,
    );
  }
  if (!experience.servicePolicyCoverageReview) {
    throw new StoryChainParseError(
      `${experience.id}: core-product Experience must cite servicePolicyCoverageReview`,
    );
  }
  if (!SERVICE_POLICY_REVIEW_REPO_REF_PATTERN.test(experience.servicePolicyCoverageReview)) {
    throw new StoryChainParseError(
      `${experience.id}: servicePolicyCoverageReview must point to a versioned Story Chain *.matrix.yaml file`,
    );
  }
  const matrix = chain.servicePolicyMatrices.find(
    (candidate) => candidate.experience === experience.id,
  );
  if (!matrix) {
    throw new StoryChainParseError(`${experience.id}: no Service Policy Coverage Matrix is loaded`);
  }
  if (!matrix.path.endsWith(experience.servicePolicyCoverageReview)) {
    throw new StoryChainParseError(
      `${experience.id}: servicePolicyCoverageReview does not match its loaded Matrix`,
    );
  }
  const items = matrix.families.flatMap((family) => family.items);
  const aggregate = items.some((item) => item.disposition === "unresolved")
    ? "unresolved"
    : "complete";
  if (experience.servicePolicyCoverage !== aggregate) {
    throw new StoryChainParseError(
      `${experience.id}: servicePolicyCoverage ${experience.servicePolicyCoverage} does not match Matrix aggregate ${aggregate}`,
    );
  }
  validatePolicyMatrixItems(matrix, promiseIds);
}

function validateServicePolicyCoverage(chain: StoryChain): void {
  ensureNoDuplicates(
    chain.servicePolicyMatrices.map((matrix) => matrix.id),
    "service policy matrices",
  );
  ensureNoDuplicates(
    chain.servicePolicyMatrices.map((matrix) => matrix.experience),
    "service policy matrix Experience owners",
  );
  const promiseIds = new Set(chain.promises.map((promise) => promise.id));
  for (const experience of chain.experiences) {
    if (experience.scope === "core-product") {
      validateCoreProductPolicy(chain, experience, promiseIds);
    }
  }
  for (const matrix of chain.servicePolicyMatrices) {
    const owner = chain.experiences.find((experience) => experience.id === matrix.experience);
    if (!owner || owner.scope !== "core-product") {
      throw new StoryChainParseError(
        `${matrix.id}: experience owner "${matrix.experience}" must be a core-product Experience`,
      );
    }
  }
}

function validateScenarioReferences(chain: StoryChain): void {
  if (chain.scenarios.length === 0) {
    throw new StoryChainParseError(
      "Story Chain graph has zero active scenarios. The scenario catalog cannot be an empty completeness universe.",
    );
  }
  const scenarioIds = new Set(chain.scenarios.map((scenario) => scenario.id));
  for (const ledger of chain.evidenceLedgers) {
    for (const entry of ledger.acceptanceCheckEntries) {
      for (const scenarioRef of entry.scenarioRefs) {
        if (!scenarioIds.has(scenarioRef)) {
          throw new StoryChainParseError(
            `${ledger.path}: ${entry.key} references scenario "${scenarioRef}" that is not active in scenario-catalog.md`,
          );
        }
      }
    }
  }
}

function validateMomentParents(chain: StoryChain): void {
  const experienceIds = new Set(chain.experiences.map((e) => e.id));
  for (const moment of chain.moments) {
    if (!experienceIds.has(moment.experience)) {
      throw new StoryChainParseError(
        `${moment.id}: experience parent "${moment.experience}" is not declared`,
      );
    }
  }
}

// Reciprocal weaving used to be enforced only lazily, at Evidence Ledger
// resolution (validatePromiseAspectReciprocal fires only for aspects a ledger
// applies). A pointcut entry with no ledger application therefore passed
// silently, and a promise could declare an aspect the pointcut never claimed —
// exactly the weave gap behind issue #193. These two checks make the mirror
// global: aspect.appliesTo and promise.aspects must agree in both directions,
// so a single edit to either side fails validation until the other side's
// owner (promise author / aspect steward) reciprocates.
function validateAspectAppliesTo(chain: StoryChain): void {
  const promiseById = new Map(chain.promises.map((p) => [p.id, p]));
  for (const aspect of chain.aspects) {
    for (const ref of aspect.appliesTo) {
      const promise = promiseById.get(ref);
      if (!promise) {
        throw new StoryChainParseError(
          `${aspect.id}: appliesTo "${ref}" is not a declared promise`,
        );
      }
      if (!promise.aspects.includes(aspect.id)) {
        throw new StoryChainParseError(
          `${aspect.id}: appliesTo includes "${ref}" but that promise does not declare the aspect back in its aspects list — weave the aspect into the promise (and its covering ledger) or remove the pointcut entry`,
        );
      }
    }
  }
}

function validatePromiseAspects(chain: StoryChain): void {
  const aspectById = new Map(chain.aspects.map((a) => [a.id, a]));
  for (const promise of chain.promises) {
    for (const ref of promise.aspects) {
      const aspect = aspectById.get(ref);
      if (!aspect) {
        throw new StoryChainParseError(
          `${promise.id}: aspect ref "${ref}" is not a declared aspect`,
        );
      }
      if (!aspect.appliesTo.includes(promise.id)) {
        throw new StoryChainParseError(
          `${promise.id}: declares "${ref}" but that aspect's appliesTo pointcut does not include this promise — add the promise to the pointcut or drop the declaration`,
        );
      }
    }
  }
}

function validateAbsorbedLedger(
  ledger: StoryChain["evidenceLedgers"][number],
  promiseById: Map<string, StoryChain["promises"][number]>,
): void {
  if (ledger.intentCheckEntries.length > 0) {
    throw new StoryChainParseError(
      `${ledger.path}: absorbed intent mode cites ${String(ledger.intentCheckEntries.length)} Intent Check entries`,
    );
  }
  const offenders = ledger.sourcePromises.filter(
    (ref) => (promiseById.get(ref)?.intentChecks.length ?? 0) > 0,
  );
  if (offenders.length > 0) {
    throw new StoryChainParseError(
      `${ledger.path}: absorbed intent mode cannot cover source promise(s) ${offenders.join(", ")} because they carry formal Intent Checks`,
    );
  }
  // Guard 1 — per-source-promise AC coverage. A multi-promise absorbed
  // ledger that cites only one Acceptance Check entry would silently let
  // the other source promises ride on AC coverage that never names them.
  const acCoverage = new Set(ledger.acceptanceCheckEntries.map((e) => e.sourcePromise));
  const acMissing = ledger.sourcePromises.filter((ref) => !acCoverage.has(ref));
  if (acMissing.length > 0) {
    throw new StoryChainParseError(
      `${ledger.path}: absorbed intent mode source promise(s) ${acMissing.join(", ")} carry zero Acceptance Check entries`,
    );
  }
}

function validateDelegatedLedger(
  chain: StoryChain,
  ledger: StoryChain["evidenceLedgers"][number],
): void {
  const promiseById = new Map(chain.promises.map((promise) => [promise.id, promise]));
  const ledgerBySlug = new Map(
    chain.evidenceLedgers.map((candidate) => [candidate.slug, candidate]),
  );
  const expected = ledger.sourcePromises.flatMap((sourcePromise) =>
    (promiseById.get(sourcePromise)?.intentChecks ?? []).map(
      (check) => `${sourcePromise}#${check.id}`,
    ),
  );
  ensureNoDuplicates(
    ledger.intentDelegations.map((entry) => entry.key),
    `${ledger.path}: intent delegations`,
  );
  const actual = new Set<string>(ledger.intentDelegations.map((entry) => entry.key));
  const missing = expected.filter((key) => !actual.has(key));
  const extra = [...actual].filter((key) => !expected.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new StoryChainParseError(
      `${ledger.path}: delegated Intent Check set differs from Source Promises (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
    );
  }
  ledger.intentDelegations.forEach((delegation) => {
    const owner = ledgerBySlug.get(delegation.ledger);
    if (!owner || owner === ledger || owner.intentMode !== "explicit") {
      throw new StoryChainParseError(
        `${ledger.path}: ${delegation.key} delegates to invalid explicit owner ${delegation.ledger}`,
      );
    }
    if (
      !owner.sourcePromises.includes(delegation.sourcePromise) ||
      !owner.intentCheckEntries.some((entry) => entry.key === delegation.key)
    ) {
      throw new StoryChainParseError(
        `${ledger.path}: ${delegation.key} is not explicitly evidenced by ${delegation.ledger}`,
      );
    }
  });
}

function validateEvidenceLedgerIntentModes(chain: StoryChain): void {
  const promiseById = new Map(chain.promises.map((p) => [p.id, p]));
  for (const ledger of chain.evidenceLedgers) {
    if (ledger.acceptanceCheckEntries.length === 0) {
      throw new StoryChainParseError(
        `${ledger.path}: Evidence Ledger has zero Acceptance Check entries`,
      );
    }
    if (ledger.intentMode === "absorbed") {
      validateAbsorbedLedger(ledger, promiseById);
      continue;
    }
    if (ledger.intentMode === "delegated") continue;
    if (ledger.intentCheckEntries.length === 0) {
      throw new StoryChainParseError(
        `${ledger.path}: explicit intent mode has zero Intent Check entries`,
      );
    }
    const expected = ledger.sourcePromises.flatMap((sourcePromise) =>
      (promiseById.get(sourcePromise)?.intentChecks ?? []).map(
        (check) => `${sourcePromise}#${check.id}`,
      ),
    );
    const actual = new Set<string>(ledger.intentCheckEntries.map((entry) => entry.key));
    const missing = expected.filter((key) => !actual.has(key));
    const extra = [...actual].filter((key) => !expected.includes(key));
    if (missing.length > 0 || extra.length > 0) {
      throw new StoryChainParseError(
        `${ledger.path}: explicit Intent Check set differs from Source Promises (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`,
      );
    }
  }
  chain.evidenceLedgers.forEach((ledger) => {
    if (ledger.intentMode === "delegated") validateDelegatedLedger(chain, ledger);
  });
}

interface Multiplicity {
  min: number;
  max: number | null;
}

function parseMultiplicity(raw: string, relationName: string): Multiplicity {
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const exact = Number(value);
    return { min: exact, max: exact };
  }
  const range = value.match(/^(\d+)\.\.(\d+|\*)$/);
  if (!range) {
    throw new StoryChainParseError(
      `traceability-cardinality:${relationName}: unsupported multiplicity "${raw}"`,
    );
  }
  return {
    min: Number(range[1]),
    max: range[2] === "*" ? null : Number(range[2]),
  };
}

function parseCardinalityCount(
  relation: StoryChain["traceabilityCardinality"]["relations"][number],
): { sourcePerTarget: Multiplicity; targetPerSource: Multiplicity } {
  const parts = relation.count.split(/\s*->\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new StoryChainParseError(
      `traceability-cardinality:${relation.name}: count must be "<source-per-target> -> <target-per-source>"`,
    );
  }
  return {
    sourcePerTarget: parseMultiplicity(parts[0], relation.name),
    targetPerSource: parseMultiplicity(parts[1], relation.name),
  };
}

function ensureMultiplicity(count: number, multiplicity: Multiplicity, context: string): void {
  if (count < multiplicity.min || (multiplicity.max !== null && count > multiplicity.max)) {
    const upper = multiplicity.max === null ? "*" : String(multiplicity.max);
    throw new StoryChainParseError(
      `${context}: cardinality ${String(count)} violates ${String(multiplicity.min)}..${upper}`,
    );
  }
}

function validateRelationMultiplicity(
  relation: StoryChain["traceabilityCardinality"]["relations"][number],
  edges: ReadonlyArray<{ source: string; target: string }>,
  sourceUniverse: readonly string[],
  targetUniverse: readonly string[],
): void {
  const { sourcePerTarget, targetPerSource } = parseCardinalityCount(relation);
  const allSources = new Set([...sourceUniverse, ...edges.map((edge) => edge.source)]);
  const allTargets = new Set([...targetUniverse, ...edges.map((edge) => edge.target)]);
  for (const source of allSources) {
    const targetCount = edges.filter((edge) => edge.source === source).length;
    ensureMultiplicity(
      targetCount,
      targetPerSource,
      `traceability-cardinality:${relation.name}: ${source} -> ${relation.to}`,
    );
  }
  for (const target of allTargets) {
    const sourceCount = edges.filter((edge) => edge.target === target).length;
    ensureMultiplicity(
      sourceCount,
      sourcePerTarget,
      `traceability-cardinality:${relation.name}: ${target} <- ${relation.from}`,
    );
  }
}

function validateTraceabilityCardinalityPolicyShape(chain: StoryChain): void {
  const policy = chain.traceabilityCardinality;
  if (policy.version !== 1) {
    throw new StoryChainParseError("traceability-cardinality: version must be 1");
  }
  const rawNodeTypes: unknown = policy.nodeTypes;
  if (typeof rawNodeTypes !== "object" || rawNodeTypes === null || Array.isArray(rawNodeTypes)) {
    throw new StoryChainParseError("traceability-cardinality: nodeTypes must be an object");
  }
  const nodeTypes = rawNodeTypes as Record<string, unknown>;
  const declaredNodeTypes = Object.keys(nodeTypes);
  const knownNodeTypes = new Set<string>(TRACEABILITY_NODE_KINDS);
  const missingNodeTypes = TRACEABILITY_NODE_KINDS.filter(
    (kind) => !Object.hasOwn(nodeTypes, kind),
  );
  const unexpectedNodeTypes = declaredNodeTypes.filter((kind) => !knownNodeTypes.has(kind));
  if (missingNodeTypes.length > 0 || unexpectedNodeTypes.length > 0) {
    throw new StoryChainParseError(
      `traceability-cardinality: nodeTypes must match validator node types (missing: ${missingNodeTypes.join(", ") || "none"}; unexpected: ${unexpectedNodeTypes.join(", ") || "none"})`,
    );
  }
  const prefixes = TRACEABILITY_NODE_KINDS.map((kind) => nodeTypes[kind]);
  for (const [index, prefix] of prefixes.entries()) {
    if (typeof prefix !== "string" || !/^[a-z][a-z0-9-]*:$/.test(prefix)) {
      throw new StoryChainParseError(
        `traceability-cardinality: nodeTypes.${TRACEABILITY_NODE_KINDS[index]} must be a lowercase kebab-case prefix ending in ":"`,
      );
    }
  }
  ensureNoDuplicates(prefixes as string[], "traceability-cardinality nodeTypes prefixes");
  if (!Array.isArray(policy.relations) || policy.relations.length === 0) {
    throw new StoryChainParseError("traceability-cardinality: relations must be non-empty");
  }
  const names = policy.relations.map((relation) => relation.name);
  ensureNoDuplicates(names, "traceability-cardinality relations");
}

function validateTraceabilityCardinality(chain: StoryChain): void {
  const expected = new Set([
    "scenario_evidence_coverage",
    "experience_moments",
    "moment_promises",
    "promise_acceptance_checks",
    "promise_evidence_ledgers",
    "acceptance_check_evidence",
  ]);
  for (const name of expected) {
    if (!chain.traceabilityCardinality.relations.some((relation) => relation.name === name)) {
      throw new StoryChainParseError(`traceability-cardinality: missing relation "${name}"`);
    }
  }

  const promiseAcceptanceKeys = chain.promises.flatMap((promise) =>
    promise.acceptanceChecks.map((check) => `${promise.id}#${check.id}`),
  );

  const relationEdges = new Map<string, Array<{ source: string; target: string }>>([
    [
      "scenario_evidence_coverage",
      chain.evidenceLedgers.flatMap((ledger) =>
        ledger.acceptanceCheckEntries.flatMap((entry) =>
          entry.scenarioRefs.map((scenario) => ({
            source: scenario,
            target: `${ledger.path}#${entry.key}`,
          })),
        ),
      ),
    ],
    [
      "experience_moments",
      chain.moments.map((moment) => ({ source: moment.experience, target: moment.id })),
    ],
    [
      "moment_promises",
      chain.promises.map((promise) => ({ source: promise.moment, target: promise.id })),
    ],
    [
      "promise_acceptance_checks",
      chain.promises.flatMap((promise) =>
        promise.acceptanceChecks.map((check) => ({
          source: promise.id,
          target: `${promise.id}#${check.id}`,
        })),
      ),
    ],
    [
      "promise_evidence_ledgers",
      chain.evidenceLedgers.flatMap((ledger) =>
        ledger.sourcePromises.map((promise) => ({ source: promise, target: ledger.path })),
      ),
    ],
    [
      "acceptance_check_evidence",
      chain.evidenceLedgers.flatMap((ledger) =>
        ledger.acceptanceCheckEntries.map((entry) => ({
          source: `${entry.sourcePromise}#${entry.check}`,
          target: `${ledger.path}#${entry.key}`,
        })),
      ),
    ],
  ]);

  const sourceUniverses = new Map<string, string[]>([
    ["scenario_evidence_coverage", chain.scenarios.map((scenario) => scenario.id)],
    ["experience_moments", chain.experiences.map((experience) => experience.id)],
    ["moment_promises", chain.moments.map((moment) => moment.id)],
    ["promise_acceptance_checks", chain.promises.map((promise) => promise.id)],
    ["promise_evidence_ledgers", chain.promises.map((promise) => promise.id)],
    ["acceptance_check_evidence", promiseAcceptanceKeys],
  ]);
  const targetUniverses = new Map<string, string[]>([
    [
      "scenario_evidence_coverage",
      chain.evidenceLedgers.flatMap((ledger) =>
        ledger.acceptanceCheckEntries.map((entry) => `${ledger.path}#${entry.key}`),
      ),
    ],
    ["experience_moments", chain.moments.map((moment) => moment.id)],
    ["moment_promises", chain.promises.map((promise) => promise.id)],
    ["promise_acceptance_checks", promiseAcceptanceKeys],
    ["promise_evidence_ledgers", chain.evidenceLedgers.map((ledger) => ledger.path)],
    [
      "acceptance_check_evidence",
      chain.evidenceLedgers.flatMap((ledger) =>
        ledger.acceptanceCheckEntries.map((entry) => `${ledger.path}#${entry.key}`),
      ),
    ],
  ]);

  for (const relation of chain.traceabilityCardinality.relations) {
    const edges = relationEdges.get(relation.name);
    if (!edges) continue;
    validateRelationMultiplicity(
      relation,
      edges,
      sourceUniverses.get(relation.name) ?? [],
      targetUniverses.get(relation.name) ?? [],
    );
  }
}

export function validateStoryChain(chain: StoryChain): StoryChainValidationSummary {
  validateTraceabilityCardinalityPolicyShape(chain);
  ensureNonEmptyChain(chain);
  validateIdentityUniqueness(chain);
  validateServicePolicyCoverage(chain);
  validateMomentParents(chain);

  // Promise parents must resolve.
  const experienceList = chain.experiences.map((e) => e.id);
  for (const promise of chain.promises) {
    resolvePromiseParents(promise, {
      experiences: experienceList,
      moments: chain.moments,
    });
  }

  validateAspectAppliesTo(chain);
  validatePromiseAspects(chain);
  validateEvidenceLedgerIntentModes(chain);
  validateScenarioReferences(chain);
  validateTraceabilityCardinality(chain);

  // EvidenceLedger resolution wires Promise/Aspect refs and reciprocal weaving.
  for (const ledger of chain.evidenceLedgers) {
    resolveEvidenceLedger(ledger, {
      promises: chain.promises,
      aspects: chain.aspects,
      experiences: experienceList,
      moments: chain.moments,
    });
  }

  // Surface a verdict tally for the CLI summary.
  const promisesByVerdict = { met: 0, "not-met": 0, unknown: 0 } as Record<
    "met" | "not-met" | "unknown",
    number
  >;
  for (const p of chain.promises) promisesByVerdict[p.verdict] += 1;
  const ledgersByVerdict = { met: 0, "not-met": 0, unknown: 0 } as Record<
    "met" | "not-met" | "unknown",
    number
  >;
  for (const l of chain.evidenceLedgers) ledgersByVerdict[l.verdict] += 1;

  return {
    scenarioCount: chain.scenarios.length,
    experienceCount: chain.experiences.length,
    momentCount: chain.moments.length,
    promiseCount: chain.promises.length,
    aspectCount: chain.aspects.length,
    evidenceLedgerCount: chain.evidenceLedgers.length,
    explicitIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "explicit",
    ).length,
    absorbedIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "absorbed",
    ).length,
    delegatedIntentLedgerCount: chain.evidenceLedgers.filter(
      (ledger) => ledger.intentMode === "delegated",
    ).length,
    promisesByVerdict,
    ledgersByVerdict,
    traceabilityRelationCount: chain.traceabilityCardinality.relations.length,
  };
}
