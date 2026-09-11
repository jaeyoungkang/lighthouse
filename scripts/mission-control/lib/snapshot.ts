// Thin wrapper around buildIntentTraceabilitySnapshot for CLI consumption.
// Returns the same snapshot the admin tab renders.

import { buildIntentTraceabilitySnapshot } from "@/scripts/mission-control/lib/intent-traceability-snapshot";
import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import type {
  IntentTraceabilityRow,
  IntentTraceabilitySnapshot,
} from "@/scripts/mission-control/lib/intent-traceability-types";

export type NextAuthority = "H" | "A" | "S" | "E";

export function loadSnapshot(): IntentTraceabilitySnapshot {
  const chain = loadStoryChain(process.cwd());
  const alignment = buildAlignmentSnapshot(process.cwd(), chain);
  return buildIntentTraceabilitySnapshot(alignment, { chain });
}

export function nextAuthorityFor(row: IntentTraceabilityRow): NextAuthority {
  switch (row.stage) {
    case "declare":
      if (row.ciqRows.length === 0) return "H";
      return "A";
    case "propagate":
      return "E";
    case "verify":
      return row.latestReviewVerdict === "unknown" ? "H" : "A";
    case "met":
      return "S";
  }
}

export function recommendActionFor(row: IntentTraceabilityRow): string {
  switch (row.stage) {
    case "declare":
      if (row.ciqRows.length === 0) {
        if (row.criticalQuestions.length > 0) {
          return "STOP — Human authority. Questions exist but formal Intent Check refs are not declared. Classify each question as Intent Check, Acceptance Check absorption, or retirement candidate.";
        }
        return "STOP — Human authority. No Intent Check is declared. Declare Intent Checks, mark deterministic Acceptance Check absorption, or retire the Promise.";
      }
      return `propagate to ${row.targetEvidenceLedger ?? "covering ledger"}: add Intent Check / Acceptance Check evidence + structured execution + live judge when UI-facing`;
    case "propagate":
      return `run live judge against ${row.inheritedFromEvidenceLedger ?? "ledger"} and append Sufficiency Review entry`;
    case "verify":
      if (row.latestReviewVerdict === "unknown") {
        return `STOP — Human authority. evidence 검토 필요. ${row.latestReviewGapSummary ?? ""}`;
      }
      return `fix pipeline producing not-met verdict: ${row.latestReviewGapSummary ?? "see latest Sufficiency Review entry"}`;
    case "met":
      return "held — wait for contract change";
  }
}

export function priorityRank(priority: IntentTraceabilityRow["priority"]): number {
  if (priority === "P1") return 0;
  if (priority === "P2") return 1;
  if (priority === "P3") return 2;
  return 3;
}

export function difficultyRank(difficulty: IntentTraceabilityRow["difficulty"]): number {
  if (difficulty === "S") return 0;
  if (difficulty === "M") return 1;
  if (difficulty === "L") return 2;
  return 3;
}
