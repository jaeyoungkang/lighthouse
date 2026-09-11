import path from "node:path";
import { formatIntentTraceabilityMessage as t } from "@/scripts/mission-control/lib/intent-traceability-messages";
import type { AlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit-types";
import type {
  IntentAlignmentFindingCounts,
  IntentBacklogDifficulty,
  IntentBacklogPriority,
  IntentRealitySignalSummary,
  IntentAspectRow,
  IntentTraceabilityBlockedAction,
  IntentCrossSignals,
  IntentFulfillment,
  IntentLane,
  IntentStage,
  IntentTraceabilityLaneGroup,
  IntentTraceabilityNextAction,
  IntentTraceabilityRow,
  IntentTraceabilitySnapshot,
  IntentTraceabilitySummary,
} from "@/scripts/mission-control/lib/intent-traceability-types";
import type { EvidenceLedger, ExperienceScope } from "@/app/domain/story-chain";
import {
  buildAcceptanceCriterionEvidenceIndex,
  buildAcceptanceCriterionRows,
} from "@/scripts/mission-control/lib/intent-traceability-ac-evidence";
import { type UsDeclaration } from "@/scripts/mission-control/lib/intent-traceability-user-stories";
import {
  buildAspectDeclarationsFromStoryChain,
  buildUsDeclarationsFromStoryChain,
} from "@/scripts/mission-control/lib/intent-traceability-snapshot-source";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";
import type { ReviewEntry } from "@/app/server/services/story-chain/review-parser";
import { latestReviewEntry } from "@/app/server/services/story-chain/review-entry-currentness";
import { buildRevisionDriftIndex } from "@/scripts/mission-control/lib/intent-traceability-revision-drift";
import type { RevisionDriftSignal } from "@/app/server/services/story-chain/revision-drift";
import { buildAspectVerdictReportFromStoryChain } from "@/scripts/mission-control/lib/aspect-verdict";
import { buildSurfaceAuditCounts } from "@/scripts/mission-control/lib/intent-surface-audit";

const PROJECT_ROOT = process.cwd();
// Snapshot reads its Promise/Aspect data from Story Chain via the
// `intent-traceability-snapshot-source` bridge. Spec lookups (run-target /
// AC-evidence indexing) still walk the executable ledger dir; that path
// switched to `docs/contracts/story-chain/evidence-ledgers/` in Batch 2.
const LANE_LABEL: Record<IntentLane, string> = {
  search: t("intentTraceability.lane.search"),
  pdf: t("intentTraceability.lane.pdf"),
  "research-route": t("intentTraceability.lane.research-route"),
  admin: t("intentTraceability.lane.admin"),
  other: t("intentTraceability.lane.other"),
};

const LANE_ORDER: IntentLane[] = ["search", "pdf", "research-route", "admin", "other"];

interface LedgerSource {
  filename: string;
  ledger: EvidenceLedger;
  reviewEntries: ReviewEntry[];
}

interface BacklogRow {
  promiseRef: string;
  targetEvidenceLedger: string;
  priority?: IntentBacklogPriority;
  difficulty?: IntentBacklogDifficulty;
  notes?: string;
}

interface BacklogData {
  pending: Map<string, BacklogRow>;
  propagated: Set<string>;
}

interface RealitySignalIndex {
  byUs: Map<string, IntentRealitySignalSummary>;
  openByCiq: Map<string, number>;
}

interface LedgerIntentVerification {
  filename: string;
  block: string;
  latestReviewDate?: string;
  latestReviewVerdict?: "met" | "not-met" | "unknown";
  latestReviewGapSummary?: string;
  gapCounts: {
    resolved: number;
    open: number;
    deferred: number;
    rejected: number;
  };
  unresolvedGapLabels: string[];
}

// Story Chain Evidence Ledgers currently live under the
// `docs/contracts/story-chain/evidence-ledgers/` path. External references may use a bare
// basename. Map it to the canonical Story Chain path so all rendered
// `filename` / `targetEvidenceLedger` / `inheritedFromEvidenceLedger` strings agree.
const STORY_CHAIN_EVIDENCE_LEDGERS_DIR_REL = "docs/contracts/story-chain/evidence-ledgers";

function normalizeLedgerPath(ledgerPath: string): string {
  if (ledgerPath.startsWith(`${STORY_CHAIN_EVIDENCE_LEDGERS_DIR_REL}/`)) {
    return ledgerPath;
  }
  const basename = ledgerPath.startsWith("evidence-ledgers/")
    ? ledgerPath.slice("evidence-ledgers/".length)
    : ledgerPath;
  return `${STORY_CHAIN_EVIDENCE_LEDGERS_DIR_REL}/${basename}`;
}

function listLedgers(chain: StoryChain): LedgerSource[] {
  return chain.evidenceLedgers.map((ledger) => {
    const filename = normalizeLedgerPath(path.basename(ledger.path));
    const reviewPath = ledger.reviewPath
      ? path.normalize(path.join(path.dirname(ledger.path), ledger.reviewPath))
      : undefined;
    return {
      filename,
      ledger,
      reviewEntries: chain.reviewEntries.filter(
        (entry) =>
          reviewPath && entry.sourcePath && path.normalize(entry.sourcePath) === reviewPath,
      ),
    };
  });
}

function ledgerCoversPromise(ledger: LedgerSource, promiseRef: string): boolean {
  return ledger.ledger.sourcePromises.includes(promiseRef as `promise:${string}`);
}

function firstCoveringLedger(ledgers: LedgerSource[], promiseRef: string): string | undefined {
  for (const ledger of ledgers) {
    if (ledgerCoversPromise(ledger, promiseRef)) return ledger.filename;
  }
  return undefined;
}

function ledgerHasAcceptanceCoverage(ledger: LedgerSource, promiseRef: string): boolean {
  return ledger.ledger.acceptanceCheckEntries.some((entry) => entry.sourcePromise === promiseRef);
}

function specDeclaresIntentFor(
  ledger: LedgerSource,
  promiseRef: string,
): LedgerIntentVerification | null {
  const ownsExplicitIntent =
    ledger.ledger.intentMode === "explicit" &&
    ledger.ledger.intentCheckEntries.some((entry) => entry.sourcePromise === promiseRef);
  const ownsAbsorbedIntent =
    ledger.ledger.intentMode === "absorbed" &&
    ledger.ledger.acceptanceCheckEntries.some((entry) => entry.sourcePromise === promiseRef);
  const ownsIntent = ownsExplicitIntent || ownsAbsorbedIntent;
  if (!ownsIntent) return null;
  const review = extractLatestSufficiencyReview(ledger.reviewEntries);
  // Absorbed intent is proven by deterministic Acceptance Check coverage and
  // does not require a dated live-judge review. Preserve an optional review
  // when one exists so an explicit non-met/unknown finding can still block.
  if (ownsAbsorbedIntent && !review.latestReviewDate) return null;
  const block = [
    `Evidence Ledger: ${ledger.filename}`,
    `Intent mode: ${ledger.ledger.intentMode}`,
    `Source Promise: ${promiseRef}`,
    ...(review.latestReviewDate ? [`Latest review: ${review.latestReviewDate}`] : []),
    ...(review.latestReviewVerdict ? [`Verdict: ${review.latestReviewVerdict}`] : []),
    ...(review.latestReviewGapSummary ? [`Gap: ${review.latestReviewGapSummary}`] : []),
  ].join("\n");
  return {
    filename: ledger.filename,
    block,
    ...review,
  };
}

function verificationBlockingRank(verification: LedgerIntentVerification): number {
  if (!verification.latestReviewDate) return 0;
  if (verification.latestReviewVerdict !== "met") return 1;
  return 2;
}

/**
 * One Promise can be covered by more than one explicit/absorbed ledger.  The
 * Promise is current only when every owner is current, so a convenient first
 * match must never hide a missing or non-met review on another owner.
 */
function selectEffectiveIntentVerification(
  candidates: readonly LedgerIntentVerification[],
): LedgerIntentVerification | null {
  const blockers = candidates.filter((candidate) => verificationBlockingRank(candidate) < 2);
  if (blockers.length === 0) return candidates[0] ?? null;

  return (
    [...blockers].sort((left, right) => {
      const blockingDifference = verificationBlockingRank(left) - verificationBlockingRank(right);
      if (blockingDifference !== 0) return blockingDifference;

      const dateDifference = (right.latestReviewDate ?? "").localeCompare(
        left.latestReviewDate ?? "",
      );
      if (dateDifference !== 0) return dateDifference;

      return left.filename.localeCompare(right.filename);
    })[0] ?? null
  );
}

function intentVerificationsFor(
  ledgers: readonly LedgerSource[],
  promiseRef: string,
): LedgerIntentVerification[] {
  return ledgers
    .map((ledger) => specDeclaresIntentFor(ledger, promiseRef))
    .filter((result): result is LedgerIntentVerification => result !== null);
}

function extractLatestSufficiencyReview(reviewEntries: readonly ReviewEntry[]): {
  latestReviewDate?: string;
  latestReviewVerdict?: "met" | "not-met" | "unknown";
  latestReviewGapSummary?: string;
  gapCounts: LedgerIntentVerification["gapCounts"];
  unresolvedGapLabels: string[];
} {
  const emptyCounts = { resolved: 0, open: 0, deferred: 0, rejected: 0 };
  const lastEntry = latestReviewEntry(reviewEntries, (entry) => entry.yaml !== null);
  if (!lastEntry?.yaml) return { gapCounts: emptyCounts, unresolvedGapLabels: [] };
  const gapText = lastEntry.yaml.gaps.join("\n");
  const gapCounts = {
    resolved: countMatches(gapText, /\bAdopt-resolved\b/gi),
    open: countMatches(gapText, /\bAdopt-open\b/gi),
    deferred: countMatches(gapText, /\bDefer\b/gi),
    rejected: countMatches(gapText, /\bReject\b/gi),
  };
  return {
    latestReviewDate: lastEntry.date,
    latestReviewVerdict: lastEntry.yaml.verdict as "met" | "not-met" | "unknown" | undefined,
    latestReviewGapSummary: lastEntry.yaml.gaps[0],
    gapCounts,
    unresolvedGapLabels: extractUnresolvedGapLabels(gapText),
  };
}

function countMatches(source: string, pattern: RegExp): number {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function extractUnresolvedGapLabels(entry: string): string[] {
  const labels: string[] = [];
  const pattern = /-\s+\*\*(Adopt-open|Defer)\s*[—\-–]\s*([^*]+?)\*\*/gi;
  let match;
  while ((match = pattern.exec(entry)) !== null) {
    labels.push(`${match[1]} — ${match[2].trim()}`);
  }
  return labels;
}

function buildBacklogFromStoryChain(
  declarations: UsDeclaration[],
  ledgers: LedgerSource[],
): BacklogData {
  const pending = new Map<string, BacklogRow>();
  const propagated = new Set<string>();
  for (const declaration of declarations) {
    const propagation = selectEffectiveIntentVerification(
      intentVerificationsFor(ledgers, declaration.promiseRef),
    );
    if (propagation || declaration.absorbedIntoAc) {
      propagated.add(declaration.promiseRef);
      continue;
    }
    const targetEvidenceLedger =
      firstCoveringLedger(ledgers, declaration.promiseRef) ??
      ledgers.find((ledger) => ledgerHasAcceptanceCoverage(ledger, declaration.promiseRef))
        ?.filename;
    pending.set(declaration.promiseRef, {
      promiseRef: declaration.promiseRef,
      targetEvidenceLedger:
        targetEvidenceLedger ??
        "docs/contracts/story-chain/evidence-ledgers/<unassigned>.ledger.yaml",
    });
  }
  return { pending, propagated };
}

function buildEmptyRealitySignalIndex(): RealitySignalIndex {
  return { byUs: new Map(), openByCiq: new Map() };
}

function parseScenarioCoverageMap(chain: StoryChain): Map<string, Set<string>> {
  const scenarioMap = new Map<string, Set<string>>();
  for (const ledger of chain.evidenceLedgers) {
    for (const entry of ledger.acceptanceCheckEntries) {
      if (entry.scenarioRefs.length === 0) continue;
      const refs = scenarioMap.get(entry.sourcePromise) ?? new Set<string>();
      for (const scenarioRef of entry.scenarioRefs) refs.add(scenarioRef);
      scenarioMap.set(entry.sourcePromise, refs);
    }
  }
  return scenarioMap;
}

function laneFromUsId(promiseRef: string): IntentLane {
  if (
    promiseRef.startsWith("promise:search-") ||
    promiseRef.startsWith("promise:gap-") ||
    promiseRef.startsWith("promise:inline-analysis-") ||
    promiseRef.startsWith("promise:query-clause-") ||
    promiseRef.startsWith("promise:similar-papers-") ||
    promiseRef.startsWith("promise:citation-lineage")
  ) {
    return "search";
  }
  if (promiseRef.startsWith("promise:pdf-") || promiseRef.startsWith("promise:delegate-"))
    return "pdf";
  if (
    promiseRef.startsWith("promise:research-route-") ||
    promiseRef.startsWith("promise:desktop-") ||
    promiseRef.startsWith("promise:document-") ||
    promiseRef.startsWith("promise:tab-") ||
    promiseRef.startsWith("promise:visual-") ||
    promiseRef.startsWith("promise:floating-")
  ) {
    return "research-route";
  }
  if (
    promiseRef.startsWith("promise:alignment-") ||
    promiseRef.startsWith("promise:internal-") ||
    promiseRef.startsWith("promise:release-") ||
    promiseRef.startsWith("promise:ac-") ||
    promiseRef.startsWith("promise:domain-") ||
    promiseRef.startsWith("promise:journey-") ||
    promiseRef.startsWith("promise:ledger-") ||
    promiseRef.startsWith("promise:hardening-") ||
    promiseRef.startsWith("promise:evidence-ledger-")
  ) {
    return "admin";
  }
  return "other";
}

function classifyStage(
  propagation: LedgerIntentVerification | null,
  absorbedIntoAc: boolean,
  hasRevisionDriftSignals: boolean,
): IntentStage {
  // Revision drift is a soft gate: when a Promise's AC has been revised past
  // what the latest Sufficiency Review recorded, we drop the stage to `verify`
  // even if the underlying review verdict was `met`. Admin board renders the
  // stale flag from `row.staleRevisions`; PR gates are not blocked.
  if (hasRevisionDriftSignals) return "verify";
  if (!propagation) {
    // The current Evidence Ledger marks this Promise as absorbed into deterministic
    // Acceptance Checks. Their structured execution references lock the Promise
    // without a live-judge path.
    if (absorbedIntoAc) return "met";
    return "declare";
  }
  if (!propagation.latestReviewDate) return "propagate";
  if (propagation.latestReviewVerdict === "met") return "met";
  return "verify";
}

function describeNextAction(
  stage: IntentStage,
  promiseRef: string,
  backlogRow: BacklogRow | undefined,
  propagation: LedgerIntentVerification | null,
): string {
  switch (stage) {
    case "declare":
      return t("intentTraceability.nextAction.declare", {
        targetEvidenceLedger: backlogRow?.targetEvidenceLedger ?? "covering ledger",
        promiseRef,
      });
    case "propagate":
      return t("intentTraceability.nextAction.propagate", {
        ledger: propagation?.filename ?? "ledger",
      });
    case "verify":
      return t("intentTraceability.nextAction.verify", {
        ledger: propagation?.filename ?? "ledger",
      });
    case "met":
      return t("intentTraceability.nextAction.met");
  }
}

function priorityRank(priority: IntentBacklogPriority | undefined): number {
  if (priority === "P1") return 0;
  if (priority === "P2") return 1;
  if (priority === "P3") return 2;
  return 3;
}

function difficultyRank(difficulty: IntentBacklogDifficulty | undefined): number {
  if (difficulty === "S") return 0;
  if (difficulty === "M") return 1;
  if (difficulty === "L") return 2;
  return 3;
}

function stageRank(stage: IntentStage): number {
  if (stage === "verify") return 0;
  if (stage === "propagate") return 1;
  if (stage === "declare") return 2;
  return 3;
}

function compareBacklog(a: BacklogRow, b: BacklogRow): number {
  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;
  const difficultyDiff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
  if (difficultyDiff !== 0) return difficultyDiff;
  return a.promiseRef.localeCompare(b.promiseRef);
}

function describeBlockedReason(row: IntentTraceabilityRow): string {
  const criticalCount = row.crossSignals.alignmentFindings.critical;
  const warningCount = row.crossSignals.alignmentFindings.warning;
  if (criticalCount > 0) {
    return t("intentTraceability.blocker.alignmentCritical", { count: criticalCount });
  }
  if (row.stage === "verify") {
    return row.latestReviewGapSummary ?? t("intentTraceability.blocker.verifyFallback");
  }
  if (row.stage === "propagate") {
    return t("intentTraceability.blocker.propagate");
  }
  if (warningCount > 0) {
    return t("intentTraceability.blocker.alignmentWarning", { count: warningCount });
  }
  return t("intentTraceability.blocker.unpropagated");
}

function compareBlockedRows(a: IntentTraceabilityRow, b: IntentTraceabilityRow): number {
  const criticalDiff =
    b.crossSignals.alignmentFindings.critical - a.crossSignals.alignmentFindings.critical;
  if (criticalDiff !== 0) return criticalDiff;
  const stageDiff = stageRank(a.stage) - stageRank(b.stage);
  if (stageDiff !== 0) return stageDiff;
  const gapDiff =
    b.fulfillment.openGapCount +
    b.fulfillment.deferredGapCount -
    (a.fulfillment.openGapCount + a.fulfillment.deferredGapCount);
  if (gapDiff !== 0) return gapDiff;
  const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDiff !== 0) return priorityDiff;
  const difficultyDiff = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
  if (difficultyDiff !== 0) return difficultyDiff;
  return a.promiseRef.localeCompare(b.promiseRef);
}

function buildFulfillment(
  totalQuestions: number,
  stage: IntentStage,
  propagation: LedgerIntentVerification | null,
): IntentFulfillment {
  if (stage === "met") {
    return {
      totalQuestions,
      answeredCount: totalQuestions,
      resolvedGapCount: propagation?.gapCounts.resolved ?? 0,
      openGapCount: 0,
      deferredGapCount: 0,
      rejectedGapCount: propagation?.gapCounts.rejected ?? 0,
      unresolvedGapLabels: [],
    };
  }
  return {
    totalQuestions,
    answeredCount: 0,
    resolvedGapCount: propagation?.gapCounts.resolved ?? 0,
    openGapCount: propagation?.gapCounts.open ?? 0,
    deferredGapCount: propagation?.gapCounts.deferred ?? 0,
    rejectedGapCount: propagation?.gapCounts.rejected ?? 0,
    unresolvedGapLabels: propagation?.unresolvedGapLabels ?? [],
  };
}

function buildCrossSignals(
  promiseRef: string,
  scenarioMap: Map<string, Set<string>>,
  findings: IntentAlignmentFindingCounts,
): IntentCrossSignals {
  const scenarios = scenarioMap.get(promiseRef);
  return {
    linkedScenarioIds: scenarios ? Array.from(scenarios).sort() : [],
    alignmentFindings: findings,
  };
}

function countFindings(
  promiseRef: string,
  alignmentSnapshot: AlignmentSnapshot | null,
): IntentAlignmentFindingCounts {
  const counts: IntentAlignmentFindingCounts = { critical: 0, warning: 0, info: 0 };
  if (!alignmentSnapshot) return counts;
  for (const finding of alignmentSnapshot.findings) {
    if (finding.promiseId !== promiseRef) continue;
    if (finding.severity === "critical") counts.critical += 1;
    else if (finding.severity === "warning") counts.warning += 1;
    else counts.info += 1;
  }
  return counts;
}

function buildRow(
  declaration: UsDeclaration,
  ledgers: LedgerSource[],
  backlog: BacklogData,
  scenarioMap: Map<string, Set<string>>,
  alignmentSnapshot: AlignmentSnapshot | null,
  reality: RealitySignalIndex,
  acEvidence: ReturnType<typeof buildAcceptanceCriterionEvidenceIndex>,
  driftIndex: Map<string, RevisionDriftSignal[]>,
): IntentTraceabilityRow {
  const propagation = selectEffectiveIntentVerification(
    intentVerificationsFor(ledgers, declaration.promiseRef),
  );
  const backlogRow = backlog.pending.get(declaration.promiseRef);
  const driftSignals = driftIndex.get(declaration.promiseRef) ?? [];
  const stage = classifyStage(propagation, declaration.absorbedIntoAc, driftSignals.length > 0);
  const nextAction = describeNextAction(stage, declaration.promiseRef, backlogRow, propagation);
  const fulfillment = buildFulfillment(declaration.criticalQuestions.length, stage, propagation);
  const crossSignals = buildCrossSignals(
    declaration.promiseRef,
    scenarioMap,
    countFindings(declaration.promiseRef, alignmentSnapshot),
  );
  return {
    promiseRef: declaration.promiseRef,
    title: declaration.title,
    experienceScope: declaration.experienceScope,
    intent: declaration.intent,
    criticalQuestions: declaration.criticalQuestions,
    stage,
    lane: laneFromUsId(declaration.promiseRef),
    targetEvidenceLedger:
      backlogRow?.targetEvidenceLedger ??
      propagation?.filename ??
      firstCoveringLedger(ledgers, declaration.promiseRef),
    inheritedFromEvidenceLedger: propagation?.filename,
    priority: backlogRow?.priority,
    difficulty: backlogRow?.difficulty,
    notes: backlogRow?.notes,
    nextAction,
    latestReviewDate: propagation?.latestReviewDate,
    latestReviewVerdict: propagation?.latestReviewVerdict,
    latestReviewGapSummary: propagation?.latestReviewGapSummary,
    inheritedBlockExcerpt: propagation
      ? propagation.block.split("\n").slice(0, 6).join("\n")
      : undefined,
    fulfillment,
    crossSignals,
    realitySignals: reality.byUs.get(declaration.promiseRef) ?? {
      openCount: 0,
      closedCount: 0,
      openEntries: [],
      openCiqTargetedCount: 0,
      openUsTargetedCount: 0,
    },
    absorbedIntoAc: declaration.absorbedIntoAc,
    acceptanceCriteria: declaration.acceptanceCriteria,
    acceptanceCriterionRows: buildAcceptanceCriterionRows(declaration, acEvidence),
    staleRevisions: driftSignals.length > 0 ? driftSignals : undefined,
    ciqRows: declaration.ciqBlocks.map((block) => ({
      ciqId: block.ciqId,
      question: block.question,
      evidencePath: block.evidencePath,
      whyLiveJudge: block.whyLiveJudge,
      linkedAcs: block.linkedAcs,
      answerCriteria: block.answerCriteria,
      realitySignalCount: reality.openByCiq.get(block.ciqId) ?? 0,
    })),
  };
}

function buildLaneGroups(rows: IntentTraceabilityRow[]): IntentTraceabilityLaneGroup[] {
  const byLane = new Map<IntentLane, IntentTraceabilityRow[]>();
  for (const lane of LANE_ORDER) byLane.set(lane, []);
  for (const row of rows) {
    const bucket = byLane.get(row.lane);
    if (bucket) bucket.push(row);
  }
  const groups: IntentTraceabilityLaneGroup[] = [];
  for (const lane of LANE_ORDER) {
    const laneRows = byLane.get(lane) ?? [];
    if (laneRows.length === 0) continue;
    groups.push({
      lane,
      label: LANE_LABEL[lane],
      totalIntents: laneRows.length,
      fulfilledCount: laneRows.filter((row) => row.stage === "met").length,
      inProgressCount: laneRows.filter((row) => row.stage === "propagate" || row.stage === "verify")
        .length,
      unfulfilledCount: laneRows.filter((row) => row.stage === "declare").length,
      promiseRefs: laneRows.map((row) => row.promiseRef),
    });
  }
  return groups;
}

function buildSummary(
  rows: IntentTraceabilityRow[],
  backlog: BacklogData,
): IntentTraceabilitySummary {
  let declareCount = 0;
  let propagateCount = 0;
  let verifyCount = 0;
  let metCount = 0;
  let totalCriticalQuestions = 0;
  let answeredCriticalQuestions = 0;
  let totalOpenGaps = 0;
  let rowsWithCriticalFindings = 0;
  let rowsBlockingVerdict = 0;
  let rowsAwaitingEvidence = 0;
  let rowsUnknownVerdict = 0;
  let rowsWithOpenRealitySignals = 0;
  let totalOpenRealitySignals = 0;
  for (const row of rows) {
    if (row.stage === "declare") declareCount += 1;
    else if (row.stage === "propagate") propagateCount += 1;
    else if (row.stage === "verify") verifyCount += 1;
    else metCount += 1;
    totalCriticalQuestions += row.fulfillment.totalQuestions;
    answeredCriticalQuestions += row.fulfillment.answeredCount;
    totalOpenGaps += row.fulfillment.openGapCount + row.fulfillment.deferredGapCount;
    if (row.crossSignals.alignmentFindings.critical > 0) rowsWithCriticalFindings += 1;
    if (row.stage === "verify") rowsBlockingVerdict += 1;
    if (row.stage === "declare" || row.stage === "propagate") rowsAwaitingEvidence += 1;
    if (row.latestReviewVerdict === "unknown") rowsUnknownVerdict += 1;
    if (row.realitySignals.openCount > 0) rowsWithOpenRealitySignals += 1;
    totalOpenRealitySignals += row.realitySignals.openCount;
  }
  return {
    totalWithIntent: rows.length,
    declareCount,
    propagateCount,
    verifyCount,
    metCount,
    backlogPendingCount: backlog.pending.size,
    backlogPropagatedCount: backlog.propagated.size,
    totalCriticalQuestions,
    answeredCriticalQuestions,
    totalOpenGaps,
    rowsWithCriticalFindings,
    rowsBlockingVerdict,
    rowsAwaitingEvidence,
    rowsUnknownVerdict,
    rowsWithOpenRealitySignals,
    totalOpenRealitySignals,
    lanes: buildLaneGroups(rows),
  };
}

function buildNextActions(
  backlog: BacklogData,
  rows: IntentTraceabilityRow[],
): IntentTraceabilityNextAction[] {
  const rowByUs = new Map(rows.map((row) => [row.promiseRef, row]));
  const ordered = Array.from(backlog.pending.values()).sort(compareBacklog).slice(0, 5);
  return ordered.map((backlogRow) => {
    const row = rowByUs.get(backlogRow.promiseRef);
    return {
      promiseRef: backlogRow.promiseRef,
      targetEvidenceLedger: backlogRow.targetEvidenceLedger,
      priority: backlogRow.priority,
      difficulty: backlogRow.difficulty,
      lane: row?.lane ?? laneFromUsId(backlogRow.promiseRef),
      nextAction:
        row?.nextAction ??
        t("intentTraceability.nextAction.declare", {
          targetEvidenceLedger: backlogRow.targetEvidenceLedger,
          promiseRef: backlogRow.promiseRef,
        }),
    };
  });
}

function buildBlockedTopFive(rows: IntentTraceabilityRow[]): IntentTraceabilityBlockedAction[] {
  return rows
    .filter((row) => row.stage !== "met")
    .sort(compareBlockedRows)
    .slice(0, 5)
    .map((row) => ({
      promiseRef: row.promiseRef,
      targetEvidenceLedger: row.targetEvidenceLedger ?? row.inheritedFromEvidenceLedger,
      priority: row.priority,
      difficulty: row.difficulty,
      lane: row.lane,
      stage: row.stage,
      criticalFindingCount: row.crossSignals.alignmentFindings.critical,
      warningFindingCount: row.crossSignals.alignmentFindings.warning,
      openGapCount: row.fulfillment.openGapCount,
      deferredGapCount: row.fulfillment.deferredGapCount,
      blockerSummary: describeBlockedReason(row),
      nextAction: row.nextAction,
    }));
}

export function buildIntentTraceabilitySnapshot(
  alignmentSnapshot?: AlignmentSnapshot,
  options: { scope?: ExperienceScope; chain?: StoryChain } = {},
): IntentTraceabilitySnapshot {
  const chain = options.chain ?? loadStoryChain(PROJECT_ROOT);
  const allDeclarations = buildUsDeclarationsFromStoryChain(chain);
  const declarations = options.scope
    ? allDeclarations.filter((declaration) => declaration.experienceScope === options.scope)
    : allDeclarations;
  const ledgers = listLedgers(chain);
  const backlog = buildBacklogFromStoryChain(declarations, ledgers);
  const scenarioMap = parseScenarioCoverageMap(chain);
  const driftIndex = buildRevisionDriftIndex(chain);
  const reality = buildEmptyRealitySignalIndex();
  const acEvidence = buildAcceptanceCriterionEvidenceIndex(PROJECT_ROOT, chain);
  const rows = declarations
    .map((declaration) =>
      buildRow(
        declaration,
        ledgers,
        backlog,
        scenarioMap,
        alignmentSnapshot ?? null,
        reality,
        acEvidence,
        driftIndex,
      ),
    )
    .sort((a, b) => {
      const laneDiff = LANE_ORDER.indexOf(a.lane) - LANE_ORDER.indexOf(b.lane);
      if (laneDiff !== 0) return laneDiff;
      return a.promiseRef.localeCompare(b.promiseRef);
    });
  const summary = buildSummary(rows, backlog);
  const nextFiveActions = buildNextActions(backlog, rows);
  const blockedTopFive = buildBlockedTopFive(rows);
  const includedPromiseRefs = new Set(rows.map((row) => row.promiseRef));
  const aspects = buildAspectRows(chain, includedPromiseRefs);
  const surfaceAudit = buildSurfaceAuditCounts(PROJECT_ROOT);
  return {
    generatedAt: new Date().toISOString(),
    summary,
    rows,
    nextFiveActions,
    blockedTopFive,
    aspects,
    surfaceAudit,
  };
}

function buildAspectRows(chain: StoryChain, includedPromiseRefs?: Set<string>): IntentAspectRow[] {
  // Read own verdict (α Coverage ∧ β Wovenness) for each Aspect from its
  // covering ledger entry. This surfaces the same data Release verdict's Aspect
  // dimension uses, so admin/about UIs can render verdict pills alongside
  // Promise row verdicts.
  const verdictReport = buildAspectVerdictReportFromStoryChain(chain, PROJECT_ROOT);
  const verdictByPolId = new Map(verdictReport.rows.map((r) => [r.aspectRef, r]));

  return buildAspectDeclarationsFromStoryChain(chain)
    .filter((entry) => entry.frontmatter.kind === "aspect")
    .map((entry): IntentAspectRow => {
      const verdictRow = verdictByPolId.get(entry.frontmatter.id);
      const appliesTo = includedPromiseRefs
        ? entry.frontmatter.appliesTo.filter((promiseRef) => includedPromiseRefs.has(promiseRef))
        : entry.frontmatter.appliesTo;
      return {
        aspectRef: entry.frontmatter.id,
        title: entry.frontmatter.title,
        kind: entry.frontmatter.kind,
        appliesTo,
        coveringLedger: entry.frontmatter.coveringLedger,
        whyDeclaration: entry.whyDeclaration,
        verdict: verdictRow?.status ?? "unverified",
        latestReviewDate: verdictRow?.latestReviewDate,
      };
    })
    .filter((entry) => !includedPromiseRefs || entry.appliesTo.length > 0)
    .sort((a, b) => a.aspectRef.localeCompare(b.aspectRef));
}
