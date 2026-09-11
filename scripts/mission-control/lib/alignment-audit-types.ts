export type AlignmentStatus = "aligned" | "partial" | "gap";

export type AlignmentSeverity = "critical" | "warning" | "info";

export type AlignmentJourneyLaneId = "search" | "citation_lineage" | "gap" | "pdf" | "web";

export type AlignmentJourneyScenarioType =
  | "normal"
  | "progress"
  | "navigation"
  | "recoverable"
  | "hard_error";

export type AlignmentJourneyChipKind = "explore" | "navigate" | "recover";

export interface AlignmentSummary {
  experienceCount: number;
  momentCount: number;
  promiseCount: number;
  ledgerCount: number;
  runCheckCount: number;
  executionTargetCount: number;
  codeTargetCount: number;
  findingCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  alignedPromiseCount: number;
  partialPromiseCount: number;
  gapPromiseCount: number;
}

export interface AlignmentFinding {
  id: string;
  severity: AlignmentSeverity;
  category: string;
  title: string;
  detail: string;
  promiseId?: string;
  acceptanceKey?: string;
  ledgerPath?: string;
  command?: string;
  evidence: string[];
}

export interface AlignmentPromiseRow {
  id: string;
  title: string;
  experienceId: string;
  experienceTitle: string;
  experienceScope: string;
  momentId: string;
  momentTitle: string;
  policyIds: string[];
  acTotal: number;
  acCovered: number;
  scenarioCount: number;
  ledgerCount: number;
  runCheckCount: number;
  executionTargetCount: number;
  codeTargetCount: number;
  status: AlignmentStatus;
  findingIds: string[];
}

export interface AlignmentMomentRow {
  id: string;
  title: string;
  experienceId: string;
  promiseIds: string[];
  status: AlignmentStatus;
}

export interface AlignmentExperienceRow {
  id: string;
  title: string;
  scope: string;
  momentIds: string[];
  promiseIds: string[];
  status: AlignmentStatus;
}

export interface AlignmentRunCheckRow {
  id: string;
  ledgerPath: string;
  heading: string;
  command: string;
  executionTargets: string[];
  codeTargets: string[];
  missingTargets: string[];
}

export interface AlignmentLedgerRow {
  path: string;
  title: string;
  sourcePromises: string[];
  sourceAspects: string[];
  foundational: boolean;
  runCheckCount: number;
  executionTargetCount: number;
  codeTargetCount: number;
  status: AlignmentStatus;
  findingIds: string[];
}

export type AlignmentContractUpdateKind =
  | "experience"
  | "moment"
  | "promise"
  | "aspect"
  | "evidence_ledger"
  | "other";

export interface AlignmentContractUpdate {
  path: string;
  kind: AlignmentContractUpdateKind;
  refId: string | null;
  title: string;
  updatedAt: string;
  commitSha: string | null;
  author: string | null;
  summary: string;
  recent: boolean;
  dirty: boolean;
}

export interface AlignmentJourneyChip {
  label: string;
  kind: AlignmentJourneyChipKind;
}

export interface AlignmentJourneyLane {
  id: AlignmentJourneyLaneId;
  label: string;
  scenarioRefs: string[];
  scenarioCount: number;
}

export interface AlignmentJourneyScenario {
  id: string;
  lane: AlignmentJourneyLaneId;
  label: string;
  type: AlignmentJourneyScenarioType;
  situation: string;
  reactionTitle: string;
  reactionBody: string;
  chips: AlignmentJourneyChip[];
  selectedChipLabel: string | null;
  destinationLane: AlignmentJourneyLaneId | null;
}

export interface AlignmentSnapshot {
  generatedAt: string;
  repoRoot: string;
  gapClaim: string | null;
  summary: AlignmentSummary;
  experiences: AlignmentExperienceRow[];
  moments: AlignmentMomentRow[];
  promises: AlignmentPromiseRow[];
  evidenceLedgers: AlignmentLedgerRow[];
  runChecks: AlignmentRunCheckRow[];
  contractUpdates: AlignmentContractUpdate[];
  findings: AlignmentFinding[];
  journeyLanes: AlignmentJourneyLane[];
  journeyScenarios: AlignmentJourneyScenario[];
}
