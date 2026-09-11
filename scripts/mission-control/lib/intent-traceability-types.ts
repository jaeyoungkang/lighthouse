export type IntentStage = "declare" | "propagate" | "verify" | "met";

export type IntentBacklogPriority = "P1" | "P2" | "P3";

export type IntentBacklogDifficulty = "S" | "M" | "L";

export type IntentLane = "search" | "pdf" | "research-route" | "admin" | "other";

export interface IntentFulfillment {
  totalQuestions: number;
  answeredCount: number;
  resolvedGapCount: number;
  openGapCount: number;
  deferredGapCount: number;
  rejectedGapCount: number;
  unresolvedGapLabels: string[];
}

export interface IntentAlignmentFindingCounts {
  critical: number;
  warning: number;
  info: number;
}

export interface IntentCrossSignals {
  linkedScenarioIds: string[];
  alignmentFindings: IntentAlignmentFindingCounts;
}

export interface RealitySignalEntry {
  date: string;
  target: string;
  title: string;
  source: string;
  observation: string;
  status: "open" | "closed";
}

export interface IntentRealitySignalSummary {
  openCount: number;
  closedCount: number;
  openEntries: RealitySignalEntry[];
  openCiqTargetedCount: number;
  openUsTargetedCount: number;
}

export interface IntentCiqRow {
  ciqId: string;
  question: string;
  evidencePath?: string;
  whyLiveJudge?: string;
  linkedAcs: string[];
  answerCriteria?: string;
  realitySignalCount: number;
}

export interface IntentAcceptanceCriterionRunCheck {
  heading: string;
  description: string;
  command: string;
  executionTargets: string[];
  codeTargets: string[];
}

export interface IntentAcceptanceCriterionEvidenceMatch {
  scenarioRef: string;
  ledgerPath: string;
  runChecks: IntentAcceptanceCriterionRunCheck[];
}

export interface IntentAcceptanceCriterionRow {
  acceptanceKey: string;
  text: string;
  evidenceMatches: IntentAcceptanceCriterionEvidenceMatch[];
}

export interface IntentTraceabilityRow {
  promiseRef: string;
  title: string;
  experienceScope: "core-product" | "support-layer" | "governance";
  intent: string;
  criticalQuestions: string[];
  ciqRows: IntentCiqRow[];
  stage: IntentStage;
  lane: IntentLane;
  targetEvidenceLedger?: string;
  inheritedFromEvidenceLedger?: string;
  priority?: IntentBacklogPriority;
  difficulty?: IntentBacklogDifficulty;
  notes?: string;
  nextAction: string;
  latestReviewDate?: string;
  latestReviewVerdict?: "met" | "not-met" | "unknown";
  latestReviewGapSummary?: string;
  inheritedBlockExcerpt?: string;
  fulfillment: IntentFulfillment;
  crossSignals: IntentCrossSignals;
  realitySignals: IntentRealitySignalSummary;
  // True when the source Promise is covered by an intent-absorbed Evidence Ledger.
  // Surfaced so the dashboard can distinguish deterministic Acceptance
  // Check-absorbed rows from live-judge Intent Check rows.
  absorbedIntoAc: boolean;
  // Acceptance Checks parsed from the Promise body.
  // Empty when the Promise has no Acceptance Check section. Surfaced through
  // Mission Control CLI so reviewers can read each Promise's deterministic criteria.
  acceptanceCriteria: string[];
  // Acceptance criteria with AC ids plus structured Evidence Ledger executions.
  // mapped from the evidence-ledgers/*.ledger.yaml path. Used by internal audit
  // surfaces that need to inspect how each deterministic criterion is closed.
  acceptanceCriterionRows?: IntentAcceptanceCriterionRow[];
  // Acceptance Checks whose declared `revision` has outpaced the latest
  // Sufficiency Review's `acReviewedRevision` for this Promise. Empty
  // (or undefined) when the promise has no drift. When non-empty, `stage`
  // is dropped to `verify` even if the review verdict was `met` — closes
  // `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-revision-drift-soft`.
  staleRevisions?: IntentRevisionDriftSignal[];
}

export interface IntentRevisionDriftSignal {
  acId: string;
  reviewedRevision: number;
  currentRevision: number;
  reviewDate: string;
}

export interface IntentTraceabilityLaneGroup {
  lane: IntentLane;
  label: string;
  totalIntents: number;
  fulfilledCount: number;
  inProgressCount: number;
  unfulfilledCount: number;
  promiseRefs: string[];
}

export interface IntentTraceabilitySummary {
  totalWithIntent: number;
  declareCount: number;
  propagateCount: number;
  verifyCount: number;
  metCount: number;
  backlogPendingCount: number;
  backlogPropagatedCount: number;
  totalCriticalQuestions: number;
  answeredCriticalQuestions: number;
  totalOpenGaps: number;
  rowsWithCriticalFindings: number;
  /** All verify-stage rows, including rows whose latest review verdict is unknown. */
  rowsBlockingVerdict: number;
  rowsAwaitingEvidence: number;
  /** Informational subset of rowsBlockingVerdict, not an additional blocking count. */
  rowsUnknownVerdict: number;
  rowsWithOpenRealitySignals: number;
  totalOpenRealitySignals: number;
  lanes: IntentTraceabilityLaneGroup[];
}

export function countIntentRowsNeedingAttention(summary: IntentTraceabilitySummary): number {
  return summary.rowsBlockingVerdict;
}

export interface IntentTraceabilityNextAction {
  promiseRef: string;
  targetEvidenceLedger?: string;
  priority?: IntentBacklogPriority;
  difficulty?: IntentBacklogDifficulty;
  lane: IntentLane;
  nextAction: string;
}

export interface IntentTraceabilityBlockedAction {
  promiseRef: string;
  targetEvidenceLedger?: string;
  priority?: IntentBacklogPriority;
  difficulty?: IntentBacklogDifficulty;
  lane: IntentLane;
  stage: IntentStage;
  criticalFindingCount: number;
  warningFindingCount: number;
  openGapCount: number;
  deferredGapCount: number;
  blockerSummary: string;
  nextAction: string;
}

/**
 * Aspect own verdict — α Coverage ∧ β Wovenness read from the covering ledger's
 * Sufficiency Review entry naming this Aspect ref.
 * `unverified` means no entry exists; `unknown` means entry has no Verdict line.
 */
export type AspectVerdictStatus = "met" | "not-met" | "unknown" | "unverified";

export interface IntentAspectRow {
  aspectRef: string;
  title: string;
  kind: "aspect" | "policy";
  appliesTo: string[];
  coveringLedger: string | null;
  // Prose intent declaration (first paragraph of `## 1. Why`). Empty when the
  // Aspect body has no Why section.
  whyDeclaration: string;
  /** AOP own verdict (α Coverage ∧ β Wovenness) from covering ledger §5. */
  verdict: AspectVerdictStatus;
  /** Latest dated entry naming this Aspect ref, when `verdict` is met/not-met/unknown. */
  latestReviewDate?: string;
}

export interface IntentSurfaceAuditCounts {
  total: number;
  tagged: number;
  infrastructure: number;
  backfillBacklog: number;
  orphan: number;
  orphanPaths: string[];
}

export interface IntentTraceabilitySnapshot {
  generatedAt: string;
  summary: IntentTraceabilitySummary;
  rows: IntentTraceabilityRow[];
  nextFiveActions: IntentTraceabilityNextAction[];
  blockedTopFive: IntentTraceabilityBlockedAction[];
  aspects: IntentAspectRow[];
  surfaceAudit: IntentSurfaceAuditCounts;
}
