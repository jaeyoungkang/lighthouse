import traceabilityCardinalityPolicy from "@/docs/contracts/story-chain/traceability-cardinality.json";

export const RELEASE_VERDICT_CLUSTERS = [
  "longitudinal",
  "service-policy",
  "cross-cutting",
] as const;

export const RELEASE_VERDICT_DIMENSIONS = [
  {
    id: "intent",
    reportKey: "intent",
    label: "Intent verdict:",
    documentLabel: "Intent verdict",
    cluster: "longitudinal",
  },
  {
    id: "acceptance-check-trace",
    reportKey: "acTrace",
    label: "AC trace:",
    documentLabel: "Acceptance Check trace",
    cluster: "longitudinal",
  },
  {
    id: "service-policy-coverage",
    reportKey: "servicePolicy",
    label: "Policy coverage:",
    documentLabel: "Service Policy Coverage",
    cluster: "service-policy",
  },
  {
    id: "aspect-verdict",
    reportKey: "aspect",
    label: "Aspect:",
    documentLabel: "Aspect verdict",
    cluster: "cross-cutting",
  },
] as const;

export const RELEASE_VERDICT_DOC_START = "<!-- release-verdict-dimensions:start -->";
export const RELEASE_VERDICT_DOC_END = "<!-- release-verdict-dimensions:end -->";

export function renderReleaseVerdictDocumentBlock(): string {
  return [
    RELEASE_VERDICT_DOC_START,
    ...RELEASE_VERDICT_DIMENSIONS.map((dimension) => `- ${dimension.documentLabel};`),
    RELEASE_VERDICT_DOC_END,
  ].join("\n");
}

// Story Chain domain — Intent Weaving model. The canonical chain typed by
// these definitions backs `docs/contracts/story-chain/` and is validated by
// `mc:validate-story-chain` (see `app/server/services/story-chain/validator.ts`).
// The current grammar is documented in `docs/contracts/story-chain/README.md`
// and `docs/intent-traceability.md`.
//
// `intent-traceability-snapshot.ts` and `alignment-audit.ts` are snapshot /
// audit consumers. They read this chain directly; Story Chain is the only
// source of truth for contract keys.
//
// Authority boundaries that MUST NOT collapse:
//   - IntentCheck != AcceptanceCheck. Different truth signals (live judge vs
//     deterministic test) demand different interfaces, not a merged "check".
//   - PromiseDeclaration != EvidenceLedger. The promise is the user-facing intent
//     declaration; the EvidenceLedger is the machine-verifiable weaving record.
//     EvidenceLedger therefore owns `implementationContracts` / `evidence` /
//     `verdict`; PromiseDeclaration does not.
//   - `slug` is opaque. Code MUST NOT parse hierarchy from slug tokens. Lane,
//     moment, and aspect are explicit Promise fields; Experience ownership is
//     derived from the referenced Moment.

export type StoryChainVerdict = "met" | "not-met" | "unknown";

export type PromiseStatus = "draft" | "declared" | "propagated" | "verified" | "retired";

export type StoryChainLane = "search" | "pdf" | "research-route" | "admin" | "other";

export type ExperienceScope = "core-product" | "support-layer" | "governance";
export type ServicePolicyCoverageStatus = "complete" | "unresolved";
export type ServicePolicyObservation = "met" | "not-met" | "unknown";
export type ServicePolicyReconciliation = "unchanged" | "changed-since-audit" | "current-unknown";
export type ServicePolicyDisposition = "owned" | "rejected" | "unresolved";
export type ServicePolicyResponsibilitySurface =
  | "provider"
  | "moonlight-runtime"
  | "moonlight-ui"
  | "moonlight-operations"
  | "lighthouse-story-chain"
  | "lighthouse-quality-gate";

// Branded ref strings. The `${kind}:` prefix exists for grep/readability and
// for the parser to type-check the ref kind, but the trailing token is opaque:
// no consumer is allowed to derive parent ownership or lane from it.
export type ExperienceRef = `experience:${string}`;
export type MomentRef = `moment:${string}`;
export type PromiseRef = `promise:${string}`;
export type AspectRef = `aspect:${string}`;
export type IntentCheckRef = `intent-check:${string}`;
export type AcceptanceCheckRef = `acceptance-check:${string}`;
export type ScenarioRef = `scenario:${string}`;
export type IntentCheckKey = `${PromiseRef}#${IntentCheckRef}`;
export type AcceptanceCheckKey = `${PromiseRef}#${AcceptanceCheckRef}`;

export interface Experience {
  id: ExperienceRef;
  slug: string;
  title: string;
  scope: ExperienceScope;
  servicePolicyCoverage?: ServicePolicyCoverageStatus;
  servicePolicyCoverageReview?: string;
}

export interface ServicePolicyEvidenceSource {
  id: string;
  repository: string;
  revision: string;
  path: string;
}

export interface ServicePolicyEvidenceRef {
  source: string;
  path: string;
  locator: string;
}

export interface ServicePolicyMatrixItem {
  id: string;
  referenceEntries: number[];
  referenceObservation: Exclude<ServicePolicyObservation, "unknown">;
  observation: ServicePolicyObservation;
  reconciliation: ServicePolicyReconciliation;
  fact: string;
  evidence: ServicePolicyEvidenceRef[];
  responsibilitySurfaces: ServicePolicyResponsibilitySurface[];
  disposition: ServicePolicyDisposition;
  dispositionRationale: string;
  canonicalOwner: string;
  authorityRefs: string[];
  sourcePromises: PromiseRef[];
  verificationRefs: string[];
  decisionRef?: string;
  followUp: string;
}

export interface ServicePolicyMatrixFamily {
  id: string;
  label: string;
  expectedCapability: string;
  mapsToLenses: string[];
  items: ServicePolicyMatrixItem[];
}

export interface ServicePolicyCoverageMatrix {
  path: string;
  schemaVersion: 1;
  id: string;
  experience: ExperienceRef;
  serviceType: string;
  reviewedAt: string;
  reference: string;
  coverageProfile: {
    id: string;
    referenceEntryCount: number;
    requiredFamilies: string[];
  };
  sources: ServicePolicyEvidenceSource[];
  families: ServicePolicyMatrixFamily[];
}

export interface Moment {
  id: MomentRef;
  slug: string;
  title: string;
  experience: ExperienceRef;
}

export interface StoryChainScenario {
  id: ScenarioRef;
  label: string;
}

// IntentCheck is the qualitative-judge half of the Verification matrix.
// It must always carry `whyLiveJudge` (so reviewers can audit why this is not
// a deterministic AC) and `answerCriteria` (so the live judge has a rubric).
export interface IntentCheck {
  id: IntentCheckRef;
  question: string;
  evidence: string;
  whyLiveJudge: string;
  linkedAcceptanceChecks: AcceptanceCheckRef[];
  answerCriteria: string;
}

// AcceptanceCheck is the deterministic half. It carries a `runCommand` that
// resolves to a vitest/component test; it never carries a live-judge rubric.
//
export interface AcceptanceCheck {
  id: AcceptanceCheckRef;
  description: string;
  evidence: string;
  runCommand?: string;
  // `revision` opts the AC into the alignment-coherence-gate slug rules.
  // ACs without revision auto-grandfather to the legacy `acN` shape; ACs
  // declaring revision must use a meaning slug that satisfies the rules.
  // Bumped (+1) only when the AC's *meaning* changes; review entries carry
  // `acReviewedRevision` to detect drift.
  revision?: number;
}

export interface Aspect {
  id: AspectRef;
  slug: string;
  title: string;
  whyDeclaration: string;
  appliesTo: PromiseRef[];
  coveringLedger: string | null;
  verdict: StoryChainVerdict | "unverified";
}

// PromiseDeclaration represents the user-facing intent declaration. Verdicts
// recorded here are the snapshot view; canonical evaluation lives on the
// EvidenceLedger so the agent cannot quietly mark its own promise met without a
// machine-verifiable weaving entry.
export interface PromiseDeclaration {
  id: PromiseRef;
  slug: string;
  title: string;
  moment: MomentRef;
  lane: StoryChainLane;
  status: PromiseStatus;
  aspects: AspectRef[];
  intentChecks: IntentCheck[];
  acceptanceChecks: AcceptanceCheck[];
  coveringLedgers: string[];
  requiredEvents?: string[];
  analyticsExempt?: string;
  verdict: StoryChainVerdict;
  promiseStatement: string;
}

// Promise owns one parent ref: Moment. Moment is the single source of truth for
// the containing Experience, so projections must follow Promise -> Moment ->
// Experience instead of storing a second parent on Promise.
export function derivePromiseExperience(
  promise: Pick<PromiseDeclaration, "moment">,
  moments: readonly Moment[],
): ExperienceRef | undefined {
  return moments.find((moment) => moment.id === promise.moment)?.experience;
}

export function requirePromiseExperience(
  promise: Pick<PromiseDeclaration, "id" | "moment">,
  moments: readonly Moment[],
  experiences: readonly Experience[],
): Experience {
  const experienceRef = derivePromiseExperience(promise, moments);
  if (!experienceRef) {
    throw new Error(
      `${promise.id}: cannot derive Experience from missing Moment ${promise.moment}`,
    );
  }
  const experience = experiences.find((entry) => entry.id === experienceRef);
  if (!experience) {
    throw new Error(
      `${promise.id}: derived Experience ${experienceRef} from ${promise.moment} is not declared`,
    );
  }
  return experience;
}

// EvidenceLedger is the Weaving Ledger — a separate artifact that records how each
// (Promise x Aspect) intersection is implemented and verified. It must remain
// distinct from PromiseDeclaration so the agent cannot collapse promise and
// ledger into one self-asserting file.
export interface EvidenceLedgerIntentCheckEntry {
  key: IntentCheckKey;
  id: IntentCheckRef;
  evidence: string;
  sourcePromise: PromiseRef;
}

export interface EvidenceLedgerAcceptanceCheckEntry {
  key: AcceptanceCheckKey;
  check: AcceptanceCheckRef;
  evidence: string;
  executionRefs: EvidenceLedgerExecutionRef[];
  sourcePromise: PromiseRef;
  scope?: string;
  scenarioRefs: ScenarioRef[];
}

// Historical pointer from a source promise on an intent-absorbed ledger to the
// prior absorption anchor. The current validator does not dereference this
// field; absorption is validated from Story Chain declarations and Acceptance
// Check coverage.
export interface IntentJudgmentRef {
  promise: PromiseRef;
  anchor: PromiseRef;
}

export type EvidenceLedgerIntentMode = "explicit" | "absorbed" | "delegated";
export type EvidenceLedgerExecutionRef = `execution:${string}`;

export interface EvidenceLedgerIntentDelegation {
  key: IntentCheckKey;
  sourcePromise: PromiseRef;
  check: IntentCheckRef;
  ledger: string;
}

interface EvidenceLedgerExecutionBase {
  id: EvidenceLedgerExecutionRef;
}

export interface EvidenceLedgerVitestExecution extends EvidenceLedgerExecutionBase {
  kind: "vitest";
  files: string[];
  testNamePattern?: string;
}

export interface EvidenceLedgerContractCheckExecution extends EvidenceLedgerExecutionBase {
  kind: "contract-check";
  target: string;
  subcase: string;
}

export interface EvidenceLedgerGuardExecution extends EvidenceLedgerExecutionBase {
  kind: "guard";
  script:
    | "guard:auth-hot-path"
    | "guard:korean"
    | "guard:landing-auth-source-boundary"
    | "guard:product-owned-navigation"
    | "guard:search-condition-url-budget"
    | "guard:search-first-paint-no-db"
    | "guard:state-boundaries";
}

export type EvidenceLedgerRegisteredScript =
  | "mc-check-critical-findings"
  | "message-registry-contract"
  | "relationship-seed-sticky-browser";

export interface EvidenceLedgerRegisteredScriptExecution extends EvidenceLedgerExecutionBase {
  kind: "registered-script";
  script: EvidenceLedgerRegisteredScript;
}

export type EvidenceLedgerExecution =
  | EvidenceLedgerVitestExecution
  | EvidenceLedgerContractCheckExecution
  | EvidenceLedgerGuardExecution
  | EvidenceLedgerRegisteredScriptExecution;

export interface EvidenceLedger {
  path: string;
  schemaVersion: 2;
  slug: string;
  reviewPath?: string;
  intentMode: EvidenceLedgerIntentMode;
  intentJudgmentRefs?: IntentJudgmentRef[];
  sourcePromises: PromiseRef[];
  appliedAspects: AspectRef[];
  intentCheckEntries: EvidenceLedgerIntentCheckEntry[];
  intentDelegations: EvidenceLedgerIntentDelegation[];
  acceptanceCheckEntries: EvidenceLedgerAcceptanceCheckEntry[];
  executions: EvidenceLedgerExecution[];
  implementationContracts: string[];
  verdict: StoryChainVerdict;
}

export const TRACEABILITY_NODE_KINDS = [
  "experience",
  "moment",
  "promise",
  "acceptance-check",
  "evidence-ledger",
  "evidence-ledger-entry",
  "aspect",
  "intent-check",
  "execution",
  "scenario",
] as const;

export type TraceabilityNodeKind = (typeof TRACEABILITY_NODE_KINDS)[number];

type TraceabilityRelationNodeKind =
  | "scenario"
  | "experience"
  | "moment"
  | "promise"
  | "acceptance-check"
  | "evidence-ledger"
  | "evidence-ledger-entry";

export interface TraceabilityCardinalityRelation {
  name: string;
  from: TraceabilityRelationNodeKind;
  to: TraceabilityRelationNodeKind;
  count: string;
  description: string;
}

export interface DeferredVerificationTrigger {
  idea: string;
  trigger: string;
}

export interface TraceabilityCardinalityPolicy {
  version: number;
  nodeTypes: Record<TraceabilityNodeKind, string>;
  relations: TraceabilityCardinalityRelation[];
  deferredVerificationTriggers: DeferredVerificationTrigger[];
}

// Surface tag grammar (Phase 4 will rewrite mc-audit-surface to consume this).
// Phase 1 only declares the shape so future tag-parsers compile against a
// shared type.
export type SurfaceTagKind = "promise" | "aspect" | "check";

export interface SurfaceTag {
  kind: SurfaceTagKind;
  ref: PromiseRef | AspectRef | IntentCheckRef | AcceptanceCheckRef;
}

export const TRACEABILITY_NODE_PREFIXES = traceabilityCardinalityPolicy.nodeTypes as Record<
  TraceabilityNodeKind,
  string
>;

export function traceabilityNodePrefix(kind: TraceabilityNodeKind): string {
  return TRACEABILITY_NODE_PREFIXES[kind];
}

export function traceabilityNodePattern(kind: TraceabilityNodeKind, suffixPattern = ""): string {
  const escapedPrefix = traceabilityNodePrefix(kind).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return `${escapedPrefix}${suffixPattern}`;
}

export function hasTraceabilityNodePrefix(kind: TraceabilityNodeKind, value: string): boolean {
  const prefix = traceabilityNodePrefix(kind);
  return value.startsWith(prefix) && value.length > prefix.length;
}

export function isExperienceRef(value: string): value is ExperienceRef {
  return hasTraceabilityNodePrefix("experience", value);
}

export function isMomentRef(value: string): value is MomentRef {
  return hasTraceabilityNodePrefix("moment", value);
}

export function isPromiseRef(value: string): value is PromiseRef {
  return hasTraceabilityNodePrefix("promise", value);
}

export function isAspectRef(value: string): value is AspectRef {
  return hasTraceabilityNodePrefix("aspect", value);
}

export function isIntentCheckRef(value: string): value is IntentCheckRef {
  return hasTraceabilityNodePrefix("intent-check", value);
}

export function isAcceptanceCheckRef(value: string): value is AcceptanceCheckRef {
  return hasTraceabilityNodePrefix("acceptance-check", value);
}

export function isScenarioRef(value: string): value is ScenarioRef {
  return hasTraceabilityNodePrefix("scenario", value);
}
