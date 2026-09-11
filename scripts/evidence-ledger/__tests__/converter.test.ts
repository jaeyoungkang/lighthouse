import { describe, expect, it } from "vitest";

import type { EvidenceLedgerRecord } from "@/app/server/services/story-chain/evidence-ledger-record";
import {
  assertContiguousAcceptanceTable,
  assertMigrationCandidateSetParity,
  assertReviewedCandidateParity,
  extractLegacyImplementationContracts,
  extractLegacyRunCommands,
  loadCurrentMigrationCandidates,
  loadLegacyLedgerSnapshot,
  sourcePromiseSet,
} from "../converter";

const MIGRATION_BASE = "01b757f2db753d4aca96682a45cc33679ebcd03c";

describe("Evidence Ledger v1 converter", () => {
  it("rejects a Markdown Acceptance Check table split by a blank blockquote line", () => {
    const source = [
      "## Acceptance Checks",
      "",
      "> check:evidence-coverage",
      "> | promise | check | evidence | scope | run | scenarios |",
      "> | --- | --- | --- | --- | --- | --- |",
      "> | promise:a | acceptance-check:a | evidence | Evidence runner | run | |",
      ">",
      "> | promise:b | acceptance-check:b | evidence | Evidence runner | run | |",
      "",
      "## Verdict",
    ].join("\n");

    expect(() => {
      assertContiguousAcceptanceTable(source, "broken.ledger.md");
    }).toThrow("Acceptance Check table is non-contiguous");

    expect(() => {
      assertContiguousAcceptanceTable(
        [
          "## Acceptance Checks",
          "> check:evidence-coverage",
          "> | promise | check | evidence | scope | run | scenarios |",
          "> | --- | --- | --- | --- | --- | --- |",
          "> | promise:a | acceptance-check:a | evidence | scope | run | |",
          "## Verdict",
        ].join("\n"),
        "contiguous.ledger.md",
      );
    }).not.toThrow();
    expect(() => {
      assertContiguousAcceptanceTable("## Acceptance Checks\n\nNo directive.\n", "plain.ledger.md");
    }).not.toThrow();
  });

  it("joins continuation lines and ignores comments in run:shell", () => {
    expect(
      extractLegacyRunCommands(
        ["```run:shell", "# explanation", "npx vitest run \\", "  app/a.test.ts", "```"].join("\n"),
      ),
    ).toEqual(["npx vitest run app/a.test.ts"]);

    expect(
      extractLegacyRunCommands(
        [
          "```run:shell",
          "npm run guard:korean",
          "```",
          "not executable prose",
          "```run:shell",
          "npx vitest run app/b.test.ts",
          "```",
        ].join("\n"),
      ),
    ).toEqual(["npm run guard:korean", "npx vitest run app/b.test.ts"]);
  });

  it("preserves continuation lines in legacy implementation-contract bullets", () => {
    expect(
      extractLegacyImplementationContracts(
        [
          "## Implementation Contracts",
          "",
          "- First line",
          "  continues here.",
          "- Second item.",
          "",
          "## Verdict",
          "met",
        ].join("\n"),
      ),
    ).toEqual(["First line continues here.", "Second item."]);
    expect(extractLegacyImplementationContracts("## Verdict\nmet\n")).toEqual([]);
  });

  it("preserves the 41 cutover ledgers and admits reviewed post-cutover ledgers", () => {
    const baseline = loadLegacyLedgerSnapshot(MIGRATION_BASE);
    const { records, parity } = loadCurrentMigrationCandidates(process.cwd(), baseline);

    expect(baseline.ref).toBe(MIGRATION_BASE);
    expect(records.size).toBe(44);
    expect(parity).toHaveLength(44);
    expect(parity.reduce((total, entry) => total + entry.acceptanceChecks, 0)).toBe(320);
    expect(parity.reduce((total, entry) => total + entry.executions, 0)).toBe(263);
    expect(parity.reduce((total, entry) => total + entry.executionRepairs, 0)).toBe(86);
    expect(parity.filter((entry) => entry.assertionRewrite).map((entry) => entry.slug)).toEqual([
      "ai-comment-research-term-suggestions",
      "alignment-audit",
      "alignment-coherence-gate",
      "citation-lineage",
      "commitment-pages",
      "common-page-footer",
      "gap-led-next-search",
      "gap-network-e2",
      "graph-neighbor-papers",
      "hardening-tier-policy",
      "inline-analysis",
      "library-grounded-research",
      "moonlight-handoff",
      "paper-card-action-loading-feedback",
      "paper-card-presentation-consistency",
      "progressive-content-spatial-stability",
      "respond-contract-mutation-pilot",
      "search-query-route-transition",
      "search-result-library-add",
      "search-result-window",
      "similar-papers",
      "story-chain-event-contract",
    ]);
    expect(parity.filter((entry) => entry.reviewPointerAdded).map((entry) => entry.slug)).toEqual([
      "knowledge-map-followup-surface",
      "paper-card-action-loading-feedback",
      "paper-card-list-windowing",
      "paper-card-presentation-consistency",
      "route-view-ai-comment-generation-routing",
    ]);
    expect(
      parity
        .filter((entry) => entry.intentRepair)
        .map((entry) => entry.slug)
        .sort(),
    ).toEqual([
      "ai-generated-content-feedback",
      "knowledge-map-followup-surface",
      "paper-card-action-loading-feedback",
      "paper-card-list-windowing",
      "paper-card-presentation-consistency",
      "progressive-content-spatial-stability",
      "provider-failure-degraded-mode",
      "route-view-ai-comment-generation-routing",
    ]);

    expect(sourcePromiseSet(baseline.promises).size).toBe(baseline.promises.length);

    const libraryLegacy = baseline.ledgers.find((ledger) =>
      ledger.file.endsWith("/library-grounded-research.ledger.md"),
    );
    const libraryCandidate = records.get("library-grounded-research");
    if (!libraryLegacy || !libraryCandidate) {
      throw new Error("library-grounded migration candidate missing");
    }
    const libraryProximityMarkerKey =
      "promise:search-results-fast-window#acceptance-check:search-results-fast-window-library-proximity-marker";
    expect(libraryCandidate.acceptanceChecks.map((entry) => entry.key)).toContain(
      libraryProximityMarkerKey,
    );
    expect(() =>
      assertReviewedCandidateParity(
        libraryLegacy,
        {
          ...libraryCandidate,
          acceptanceChecks: libraryCandidate.acceptanceChecks.filter(
            (entry) => entry.key !== libraryProximityMarkerKey,
          ),
        },
        baseline,
      ),
    ).toThrow(`stale registered forward Acceptance Check ${libraryProximityMarkerKey}`);

    const citationLegacy = baseline.ledgers.find((ledger) =>
      ledger.file.endsWith("/citation-lineage.ledger.md"),
    );
    const citationCandidate = records.get("citation-lineage");
    const citationFailureKey =
      "promise:citation-lineage#acceptance-check:citation-lineage-batch-failure-error-reaction";
    if (!citationLegacy || !citationCandidate) {
      throw new Error("citation-lineage migration candidate missing");
    }
    expect(() =>
      assertReviewedCandidateParity(
        citationLegacy,
        {
          ...citationCandidate,
          acceptanceChecks: citationCandidate.acceptanceChecks.map((entry) =>
            entry.key === citationFailureKey ? { ...entry, scenarios: [] } : entry,
          ),
        },
        baseline,
      ),
    ).toThrow("stale registered forward Scenario scenario:citation-provider-failure");

    const mutationLegacy = baseline.ledgers.find((ledger) =>
      ledger.file.endsWith("/respond-contract-mutation-pilot.ledger.md"),
    );
    const mutationCandidate = records.get("respond-contract-mutation-pilot");
    if (!mutationLegacy || !mutationCandidate) {
      throw new Error("mutation pilot migration candidate missing");
    }
    const manualIsolationKey =
      "promise:respond-contract-mutation-pilot#acceptance-check:respond-contract-mutation-pilot-manual-isolation";
    const nightlyIsolationKey =
      "promise:respond-contract-mutation-pilot#acceptance-check:respond-contract-mutation-pilot-nightly-isolation";
    expect(mutationCandidate.acceptanceChecks.map((entry) => entry.key)).toContain(
      manualIsolationKey,
    );
    expect(() =>
      assertReviewedCandidateParity(
        mutationLegacy,
        {
          ...mutationCandidate,
          acceptanceChecks: mutationCandidate.acceptanceChecks.map((entry) =>
            entry.key === manualIsolationKey ? { ...entry, key: nightlyIsolationKey } : entry,
          ),
        },
        baseline,
      ),
    ).toThrow("candidate parity mismatch for Acceptance Check keys");

    const firstLegacy = baseline.ledgers[0];
    const firstSlug = firstLegacy.file
      .split("/")
      .at(-1)
      ?.replace(/\.ledger\.md$/, "");
    if (!firstSlug) throw new Error("baseline ledger slug missing");
    const firstCandidate = records.get(firstSlug);
    if (!firstCandidate) throw new Error(`candidate missing for ${firstSlug}`);
    expect(() =>
      assertReviewedCandidateParity(
        firstLegacy,
        {
          ...firstCandidate,
          sourcePromises: ["promise:not-the-legacy-owner"],
        },
        baseline,
      ),
    ).toThrow("candidate parity mismatch for Source Promises");

    const missingCandidate = new Map(records);
    missingCandidate.delete(firstSlug);
    expect(() => assertMigrationCandidateSetParity(missingCandidate, baseline)).toThrow(
      "candidate parity mismatch for ledger slug set",
    );

    const explicit = [...records.values()].find(
      (record) => record.intent.mode === "explicit" && record.sourcePromises.length > 0,
    );
    if (!explicit || explicit.intent.mode !== "explicit") {
      throw new Error("explicit migration candidate missing");
    }
    const explicitMismatch = new Map(records);
    explicitMismatch.set(explicit.slug, {
      ...explicit,
      intent: {
        ...explicit.intent,
        checks: [
          ...explicit.intent.checks,
          {
            key: `${explicit.sourcePromises[0]}#intent-check:not-declared-by-promise`,
            evidence: "counterfactual evidence",
          },
        ],
      },
    } as EvidenceLedgerRecord);
    expect(() => assertMigrationCandidateSetParity(explicitMismatch, baseline)).toThrow(
      "candidate parity mismatch for explicit Intent Check set",
    );

    const delegated = [...records.values()].find(
      (record) => record.intent.mode === "delegated" && record.intent.delegations.length > 0,
    );
    if (!delegated || delegated.intent.mode !== "delegated") {
      throw new Error("delegated migration candidate missing");
    }
    const delegatedMismatch = new Map(records);
    delegatedMismatch.set(delegated.slug, {
      ...delegated,
      intent: {
        ...delegated.intent,
        delegations: delegated.intent.delegations.map((entry, index) =>
          index === 0 ? { ...entry, ledger: "missing-delegation-owner" } : entry,
        ),
      },
    } as EvidenceLedgerRecord);
    expect(() => assertMigrationCandidateSetParity(delegatedMismatch, baseline)).toThrow(
      "is not explicitly evidenced by missing-delegation-owner",
    );
  });
});
