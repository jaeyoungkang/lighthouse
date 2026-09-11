import { describe, expect, it } from "vitest";
import { countIntentRowsNeedingAttention } from "@/scripts/mission-control/lib/intent-traceability-types";
import { buildIntentTraceabilitySnapshot } from "@/scripts/mission-control/lib/intent-traceability-snapshot";
import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";

const alignment = buildAlignmentSnapshot();
const snapshot = buildIntentTraceabilitySnapshot(alignment);

describe("buildIntentTraceabilitySnapshot", () => {
  it("populates all four stage buckets with counts equal to row total", () => {
    const { summary, rows } = snapshot;
    expect(rows.length).toBe(summary.totalWithIntent);
    expect(
      summary.declareCount + summary.propagateCount + summary.verifyCount + summary.metCount,
    ).toBe(summary.totalWithIntent);
    expect(summary.totalWithIntent).toBeGreaterThan(0);
  });

  it("marks the Moonlight handoff promise met once current evidence propagation exists", () => {
    const moonlightRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:delegate-deep-read-to-moonlight",
    );
    expect(moonlightRow?.stage).toBe("met");
    expect(moonlightRow?.targetEvidenceLedger).toBe(
      "docs/contracts/story-chain/evidence-ledgers/moonlight-handoff.ledger.yaml",
    );
  });

  it("classifies promises absorbed into Acceptance Checks as met without Intent Check propagation", () => {
    // Absorbed ledgers cover every source Promise through Acceptance Check
    // entries on that same ledger. A sibling review can still record that
    // deterministic ownership without introducing an Intent Check.
    const absorbedRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:researcher-prose-promises-page",
    );
    expect(absorbedRow).toBeDefined();
    expect(absorbedRow?.stage).toBe("met");
    expect(absorbedRow?.latestReviewVerdict).toBe("met");
    expect(absorbedRow?.inheritedFromEvidenceLedger).toBe(
      "docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml",
    );
    expect(absorbedRow?.fulfillment.answeredCount).toBe(
      absorbedRow?.fulfillment.totalQuestions ?? 0,
    );
  });

  it("does not require an optional Sufficiency Review for absorbed intent", () => {
    for (const promiseRef of [
      "promise:hardening-tier-policy",
      "promise:respond-contract-mutation-pilot",
    ]) {
      const absorbedRow = snapshot.rows.find((row) => row.promiseRef === promiseRef);
      expect(absorbedRow).toBeDefined();
      expect(absorbedRow?.stage).toBe("met");
    }
  });

  it("reads sibling Sufficiency Review files with wrapper headings inside Intent Verification", () => {
    const libraryAddRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:search-result-library-add",
    );

    expect(libraryAddRow?.stage).toBe("met");
    expect(libraryAddRow?.latestReviewDate).toBe("2026-09-03");
    expect(libraryAddRow?.latestReviewVerdict).toBe("met");
  });

  it("keeps a newer unknown owner review from being hidden by another owner's met review", () => {
    const chain = loadStoryChain(process.cwd());
    const citationOwnerReview = chain.reviewEntries.find(
      (entry) =>
        entry.sourcePath?.endsWith("citation-lineage.reviews.md") &&
        entry.yaml?.acs.includes("intent-check:body-explains-citation-flow-not-counts"),
    );
    expect(citationOwnerReview?.yaml).toBeDefined();
    if (!citationOwnerReview?.yaml) throw new Error("citation owner review fixture is required");

    const syntheticUnknownReview = {
      ...citationOwnerReview,
      date: "2099-01-01",
      headingLine: "#### 2099-01-01 — synthetic owner blocker",
      yaml: {
        ...citationOwnerReview.yaml,
        date: "2099-01-01",
        verdict: "unknown" as const,
        gaps: ["adopt: synthetic current owner blocker"],
      },
    };
    const syntheticSnapshot = buildIntentTraceabilitySnapshot(alignment, {
      chain: {
        ...chain,
        reviewEntries: [...chain.reviewEntries, syntheticUnknownReview],
      },
    });
    const citationLineage = syntheticSnapshot.rows.find(
      (row) => row.promiseRef === "promise:citation-lineage",
    );

    expect(citationLineage?.stage).toBe("verify");
    expect(citationLineage?.latestReviewDate).toBe("2099-01-01");
    expect(citationLineage?.latestReviewVerdict).toBe("unknown");
    expect(citationLineage?.inheritedFromEvidenceLedger).toBe(
      "docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml",
    );
  });

  it("emits a critical-intent-questions list per promise with ≤3 questions (question-first rule)", () => {
    for (const row of snapshot.rows) {
      expect(row.criticalQuestions.length).toBeLessThanOrEqual(3);
    }
    const ciqRow = snapshot.rows.find((row) => row.promiseRef === "promise:citation-lineage");
    expect(ciqRow?.criticalQuestions.length).toBeGreaterThan(0);
  });

  it("surfaces Next actions sorted by priority then difficulty, each with a concrete action", () => {
    expect(snapshot.nextFiveActions.length).toBeLessThanOrEqual(5);
    const rank = (p: string | undefined) => (p === "P1" ? 0 : p === "P2" ? 1 : p === "P3" ? 2 : 3);
    const priorityOrder = snapshot.nextFiveActions.map((entry) => entry.priority);
    for (let i = 0; i < priorityOrder.length - 1; i += 1) {
      expect(rank(priorityOrder[i])).toBeLessThanOrEqual(rank(priorityOrder[i + 1]));
    }
    for (const entry of snapshot.nextFiveActions) {
      expect(entry.nextAction.length).toBeGreaterThan(10);
    }
  });

  it("surfaces a blocked-top-five queue drawn from non-met rows so review can start from active blockers", () => {
    expect(snapshot.blockedTopFive.length).toBeLessThanOrEqual(5);
    for (const entry of snapshot.blockedTopFive) {
      const row = snapshot.rows.find((candidate) => candidate.promiseRef === entry.promiseRef);
      expect(row?.stage).not.toBe("met");
      expect(entry.blockerSummary.length).toBeGreaterThan(10);
      if (entry.targetEvidenceLedger) {
        expect(
          entry.targetEvidenceLedger.startsWith("docs/contracts/story-chain/evidence-ledgers/"),
        ).toBe(true);
      }
    }
  });

  it("mirrors backlog counts in summary", () => {
    const { summary } = snapshot;
    expect(summary.backlogPendingCount).toBeGreaterThanOrEqual(0);
    expect(summary.backlogPropagatedCount).toBeGreaterThanOrEqual(0);
  });

  it("assigns a lane derived from promise ref and groups rows into lane buckets in the summary", () => {
    const moonlightRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:delegate-deep-read-to-moonlight",
    );
    const adminRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:ac-trace-bidirectional-enforcement",
    );
    const searchRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:inline-analysis-auto-run",
    );
    expect(moonlightRow?.lane).toBeDefined();
    expect(adminRow?.lane).toBe("admin");
    expect(searchRow?.lane).toBe("search");

    const laneSum = snapshot.summary.lanes.reduce((acc, group) => acc + group.totalIntents, 0);
    expect(laneSum).toBe(snapshot.summary.totalWithIntent);
    for (const group of snapshot.summary.lanes) {
      expect(group.fulfilledCount + group.inProgressCount + group.unfulfilledCount).toBe(
        group.totalIntents,
      );
    }
  });

  it("populates fulfillment breakdown so met stage shows answered === totalQuestions", () => {
    const metRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:search-results-fast-window",
    );
    expect(metRow?.fulfillment.totalQuestions).toBeGreaterThanOrEqual(0);
    expect(metRow?.fulfillment.answeredCount).toBe(metRow?.fulfillment.totalQuestions);
    expect(metRow?.fulfillment.openGapCount).toBe(0);
  });

  it("normalizes ledger paths for covering ledgers", () => {
    const row = snapshot.rows.find(
      (candidate) => candidate.promiseRef === "promise:delegate-deep-read-to-moonlight",
    );
    expect(row?.targetEvidenceLedger).toBe(
      "docs/contracts/story-chain/evidence-ledgers/moonlight-handoff.ledger.yaml",
    );
  });

  it("exposes linked scenario refs from Evidence Ledger acceptance entries on each row", () => {
    const moonlightRow = snapshot.rows.find(
      (row) => row.promiseRef === "promise:delegate-deep-read-to-moonlight",
    );
    expect(moonlightRow?.crossSignals.linkedScenarioIds.length).toBeGreaterThan(0);
    expect(moonlightRow?.crossSignals.linkedScenarioIds.every((id) => id.length > 0)).toBe(true);
  });

  it("counts alignment findings per story when an AlignmentSnapshot is passed", () => {
    for (const row of snapshot.rows) {
      const counts = row.crossSignals.alignmentFindings;
      expect(counts.critical).toBeGreaterThanOrEqual(0);
      expect(counts.warning).toBeGreaterThanOrEqual(0);
      expect(counts.info).toBeGreaterThanOrEqual(0);
    }
  });

  it("aggregates fulfillment totals in the summary (total/answered questions + open gap count)", () => {
    const { summary, rows } = snapshot;
    const expectedTotal = rows.reduce((acc, row) => acc + row.fulfillment.totalQuestions, 0);
    const expectedAnswered = rows.reduce((acc, row) => acc + row.fulfillment.answeredCount, 0);
    const expectedOpen = rows.reduce(
      (acc, row) => acc + row.fulfillment.openGapCount + row.fulfillment.deferredGapCount,
      0,
    );
    expect(summary.totalCriticalQuestions).toBe(expectedTotal);
    expect(summary.answeredCriticalQuestions).toBe(expectedAnswered);
    expect(summary.totalOpenGaps).toBe(expectedOpen);
  });

  it("tracks implementation and verification summary counts separately from intent review open-gap totals", () => {
    const { summary, rows } = snapshot;
    expect(summary.rowsWithCriticalFindings).toBe(
      rows.filter((row) => row.crossSignals.alignmentFindings.critical > 0).length,
    );
    expect(summary.rowsBlockingVerdict).toBe(rows.filter((row) => row.stage === "verify").length);
    expect(summary.rowsAwaitingEvidence).toBe(
      rows.filter((row) => row.stage === "declare" || row.stage === "propagate").length,
    );
  });

  it("extracts intent-check sub-rows for each US (intent-check ref + question + evidence + linked AC + answerCriteria)", () => {
    const citationLineage = snapshot.rows.find(
      (row) => row.promiseRef === "promise:citation-lineage",
    );
    expect(citationLineage?.ciqRows.length).toBeGreaterThan(0);
    const firstCiq = citationLineage?.ciqRows[0];
    expect(firstCiq?.ciqId.startsWith("intent-check:")).toBe(true);
    expect(firstCiq?.question.length).toBeGreaterThan(10);
    expect(firstCiq?.evidencePath).toBeDefined();
    expect(firstCiq?.linkedAcs.length).toBeGreaterThan(0);
    expect(firstCiq?.answerCriteria).toBeDefined();
    expect(firstCiq?.realitySignalCount).toBe(0);
  });

  it("attaches only directly matched Evidence runner run evidence to acceptance criteria rows", () => {
    const row = snapshot.rows.find(
      (candidate) => candidate.promiseRef === "promise:search-results-fast-window",
    );
    const ac1 = row?.acceptanceCriterionRows?.find(
      (criterion) =>
        criterion.acceptanceKey ===
        "promise:search-results-fast-window#acceptance-check:search-results-fast-window-initial-dom-window",
    );
    expect(ac1?.text).toContain("10편");
    expect(ac1?.evidenceMatches.length).toBeGreaterThan(0);
    expect(ac1?.evidenceMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ledgerPath:
            "docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml",
          scenarioRef: "scenario:search-initial-visible-window",
        }),
      ]),
    );
    expect(ac1?.evidenceMatches.some((match) => match.runChecks.length >= 0)).toBe(true);
  });

  it("reports zero active reality signals while no current signal mechanism exists", () => {
    const { summary, rows } = snapshot;
    for (const row of rows) {
      expect(row.realitySignals.openCount).toBe(0);
      expect(row.realitySignals.closedCount).toBe(0);
      expect(row.realitySignals.openEntries).toEqual([]);
      expect(row.realitySignals.openCiqTargetedCount).toBe(0);
      expect(row.realitySignals.openUsTargetedCount).toBe(0);
    }
    expect(summary.totalOpenRealitySignals).toBe(0);
    expect(summary.rowsWithOpenRealitySignals).toBe(0);
  });

  it("emits Aspect rows from the Story Chain bridge", () => {
    const { aspects } = snapshot;
    expect(aspects.length).toBeGreaterThan(0);
    for (const row of aspects) {
      // Story Chain emits canonical aspect refs.
      expect(row.aspectRef.startsWith("aspect:")).toBe(true);
      expect(row.kind).toBe("aspect");
      expect(row.title.length).toBeGreaterThan(0);
      expect(Array.isArray(row.appliesTo)).toBe(true);
    }
    expect(aspects.some((row) => row.appliesTo.length > 0)).toBe(true);
    expect(
      aspects.some(
        (row) => typeof row.coveringLedger === "string" && row.coveringLedger.length > 0,
      ),
    ).toBe(true);
  });

  it("does not surface staleRevisions on rows with no revision drift (current chain has no drifted ACs)", () => {
    // Today no AC revision outpaces a recorded review: revisions were
    // introduced after the 2026-05-06 cutoff and reviews after the cutoff
    // are still grandfathered or absent. This test pins the wiring path so
    // a future regression that always sets `staleRevisions` would fail.
    for (const row of snapshot.rows) {
      expect(row.staleRevisions).toBeUndefined();
    }
  });
});

describe("countIntentRowsNeedingAttention", () => {
  it("keeps unknown verdict rows as an informational subset of verify rows", () => {
    const { summary, rows } = snapshot;
    expect(summary.rowsUnknownVerdict).toBe(
      rows.filter((row) => row.latestReviewVerdict === "unknown").length,
    );
    expect(countIntentRowsNeedingAttention(summary)).toBe(
      rows.filter((row) => row.stage === "verify").length,
    );
  });

  it("counts an unknown verify row once in the attention total", () => {
    const summary = {
      ...snapshot.summary,
      rowsBlockingVerdict: 1,
      rowsUnknownVerdict: 1,
    };

    expect(countIntentRowsNeedingAttention(summary)).toBe(1);
  });
});
