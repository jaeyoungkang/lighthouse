import { describe, expect, it } from "vitest";
import type {
  IntentBacklogDifficulty,
  IntentBacklogPriority,
  IntentTraceabilityRow,
} from "@/scripts/mission-control/lib/intent-traceability-types";
import {
  difficultyRank,
  loadSnapshot,
  nextAuthorityFor,
  priorityRank,
  recommendActionFor,
} from "@/scripts/mission-control/lib/snapshot";

const baseRow: IntentTraceabilityRow = {
  promiseRef: "promise:fixture-01",
  title: "fixture",
  experienceScope: "governance",
  intent: "...",
  criticalQuestions: [],
  ciqRows: [],
  stage: "declare",
  lane: "other",
  nextAction: "—",
  fulfillment: {
    totalQuestions: 0,
    answeredCount: 0,
    resolvedGapCount: 0,
    openGapCount: 0,
    deferredGapCount: 0,
    rejectedGapCount: 0,
    unresolvedGapLabels: [],
  },
  crossSignals: {
    linkedScenarioIds: [],
    alignmentFindings: { critical: 0, warning: 0, info: 0 },
  },
  realitySignals: {
    openCount: 0,
    closedCount: 0,
    openEntries: [],
    openCiqTargetedCount: 0,
    openUsTargetedCount: 0,
  },
  absorbedIntoAc: false,
  acceptanceCriteria: [],
};

describe("mission-control lib", () => {
  const ciqRow = {
    ciqId: "intent-check:fixture-01-01",
    question: "q",
    linkedAcs: [] as string[],
    realitySignalCount: 0,
  };

  it("nextAuthorityFor maps stage + verdict to H/A/E/S deterministically", () => {
    expect(nextAuthorityFor({ ...baseRow, stage: "declare", ciqRows: [ciqRow] })).toBe("A");
    expect(nextAuthorityFor({ ...baseRow, stage: "propagate" })).toBe("E");
    expect(nextAuthorityFor({ ...baseRow, stage: "verify", latestReviewVerdict: "not-met" })).toBe(
      "A",
    );
    expect(nextAuthorityFor({ ...baseRow, stage: "verify", latestReviewVerdict: "unknown" })).toBe(
      "H",
    );
    expect(nextAuthorityFor({ ...baseRow, stage: "met" })).toBe("S");
  });

  it("nextAuthorityFor routes declare-stage rows without formal Intent Checks to Human authority", () => {
    expect(nextAuthorityFor({ ...baseRow, stage: "declare", ciqRows: [] })).toBe("H");
    expect(
      nextAuthorityFor({ ...baseRow, stage: "declare", ciqRows: [], criticalQuestions: ["q1"] }),
    ).toBe("H");
  });

  it("recommendActionFor returns STOP for unknown verdict (Human authority)", () => {
    const row = { ...baseRow, stage: "verify", latestReviewVerdict: "unknown" } as const;
    expect(recommendActionFor(row)).toContain("STOP");
    expect(recommendActionFor(row)).toContain("Human authority");
  });

  it("recommendActionFor returns Human stop when questions lack formal Intent Checks", () => {
    const row = {
      ...baseRow,
      stage: "declare" as const,
      ciqRows: [],
      criticalQuestions: ["Q1", "Q2", "Q3"],
    };
    const msg = recommendActionFor(row);
    expect(msg).toContain("STOP");
    expect(msg).toContain("Human authority");
    expect(msg).toContain("Intent Check");
  });

  it("recommendActionFor returns Human stop when no Intent is declared at all", () => {
    const row = { ...baseRow, stage: "declare" as const, ciqRows: [], criticalQuestions: [] };
    const msg = recommendActionFor(row);
    expect(msg).toContain("STOP");
    expect(msg).toContain("No Intent Check");
  });

  it("recommendActionFor returns propagate action when formal Intent Checks exist", () => {
    const row = {
      ...baseRow,
      stage: "declare" as const,
      ciqRows: [ciqRow],
      targetEvidenceLedger: "docs/contracts/story-chain/evidence-ledgers/foo.ledger.yaml",
    };
    expect(recommendActionFor(row)).toContain(
      "propagate to docs/contracts/story-chain/evidence-ledgers/foo.ledger.yaml",
    );
  });

  it("recommendActionFor keeps every workflow stage and fallback owner explicit", () => {
    expect(
      recommendActionFor({
        ...baseRow,
        stage: "declare",
        ciqRows: [ciqRow],
      }),
    ).toContain("propagate to covering ledger");
    expect(
      recommendActionFor({
        ...baseRow,
        stage: "propagate",
        inheritedFromEvidenceLedger:
          "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
      }),
    ).toContain(
      "run live judge against docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
    );
    expect(recommendActionFor({ ...baseRow, stage: "propagate" })).toContain(
      "run live judge against ledger",
    );
    expect(
      recommendActionFor({
        ...baseRow,
        stage: "verify",
        latestReviewVerdict: "not-met",
        latestReviewGapSummary: "missing runtime evidence",
      }),
    ).toBe("fix pipeline producing not-met verdict: missing runtime evidence");
    expect(
      recommendActionFor({
        ...baseRow,
        stage: "verify",
        latestReviewVerdict: "not-met",
      }),
    ).toContain("see latest Sufficiency Review entry");
    expect(recommendActionFor({ ...baseRow, stage: "met" })).toBe(
      "held — wait for contract change",
    );
  });

  it("preserves priority and difficulty ordering including unknown values", () => {
    const priorities: Array<IntentBacklogPriority | undefined> = ["P1", "P2", "P3", undefined];
    const difficulties: Array<IntentBacklogDifficulty | undefined> = ["S", "M", "L", undefined];

    expect(priorities.map((value) => priorityRank(value))).toEqual([0, 1, 2, 3]);
    expect(difficulties.map((value) => difficultyRank(value))).toEqual([0, 1, 2, 3]);
  });

  it(
    "loadSnapshot returns the same data shape buildIntentTraceabilitySnapshot emits",
    { timeout: 90000 },
    () => {
      const snapshot = loadSnapshot();
      expect(snapshot.rows.length).toBeGreaterThan(0);
      expect(snapshot.summary.totalWithIntent).toBe(snapshot.rows.length);
      expect(snapshot.blockedTopFive.length).toBeLessThanOrEqual(5);
      for (const row of snapshot.rows) {
        const authority = nextAuthorityFor(row);
        expect(["H", "A", "E", "S"]).toContain(authority);
      }
    },
  );
});
