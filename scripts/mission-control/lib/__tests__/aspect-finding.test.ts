import { describe, expect, it } from "vitest";
import type { AspectVerdictReport } from "@/scripts/mission-control/lib/aspect-verdict";
import { buildAlignmentFindings } from "@/scripts/mission-control/lib/alignment-audit/findings";
import type { ParsedAlignmentArtifacts } from "@/scripts/mission-control/lib/alignment-audit/parser";

const emptyArtifacts: ParsedAlignmentArtifacts = {
  repoRoot: "/tmp/empty",
  experiences: [],
  moments: [],
  promises: [],
  scenarios: [],
  journeyScenarios: [],
  ledgerRows: [],
  gapClaim: null,
  evidenceLedgers: [],
};

function makeReport(rows: AspectVerdictReport["rows"]): AspectVerdictReport {
  return {
    rows,
    metCount: rows.filter((r) => r.status === "met").length,
    notMetCount: rows.filter((r) => r.status === "not-met").length,
    unknownCount: rows.filter((r) => r.status === "unknown").length,
    unverifiedCount: rows.filter((r) => r.status === "unverified").length,
  };
}

describe("buildAlignmentFindings — Aspect verdict integration (promise:release-verdict-aspect-integration AC4)", () => {
  it("emits aspect_verdict_unverified critical when a Aspect has no §5 entry naming it", () => {
    const report = makeReport([
      {
        aspectRef: "aspect:demo-001",
        title: "Demo aspect",
        coveringLedger: "docs/contracts/story-chain/evidence-ledgers/demo.ledger.yaml",
        status: "unverified",
      },
    ]);

    const findings = buildAlignmentFindings(emptyArtifacts, report);

    const finding = findings.find((f) => f.category === "aspect_verdict_unverified");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("critical");
    expect(finding?.title).toContain("aspect:demo-001");
    expect(finding?.evidence).toContain(
      "docs/contracts/story-chain/evidence-ledgers/demo.ledger.yaml",
    );
  });

  it("emits aspect_verdict_not_met critical when latest §5 entry reports Verdict: not-met", () => {
    const report = makeReport([
      {
        aspectRef: "aspect:demo-002",
        title: "Demo aspect 2",
        coveringLedger: "docs/contracts/story-chain/evidence-ledgers/demo.ledger.yaml",
        latestReviewDate: "2026-05-01",
        latestReviewVerdict: "not-met",
        status: "not-met",
      },
    ]);

    const findings = buildAlignmentFindings(emptyArtifacts, report);

    const finding = findings.find((f) => f.category === "aspect_verdict_not_met");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("critical");
    expect(finding?.title).toContain("aspect:demo-002");
    expect(finding?.detail).toContain("2026-05-01");
  });

  it("emits aspect_verdict_unknown critical when latest §5 entry reports Verdict: unknown", () => {
    const report = makeReport([
      {
        aspectRef: "aspect:demo-003",
        title: "Demo aspect 3",
        coveringLedger: "docs/contracts/story-chain/evidence-ledgers/demo.ledger.yaml",
        latestReviewDate: "2026-05-01",
        latestReviewVerdict: "unknown",
        status: "unknown",
      },
    ]);

    const findings = buildAlignmentFindings(emptyArtifacts, report);

    const finding = findings.find((f) => f.category === "aspect_verdict_unknown");
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("critical");
    expect(finding?.title).toContain("aspect:demo-003");
  });

  it("emits no aspect_verdict_* findings when every aspect verdict is met", () => {
    const report = makeReport([
      {
        aspectRef: "aspect:demo-004",
        title: "Demo aspect 4",
        coveringLedger: "docs/contracts/story-chain/evidence-ledgers/demo.ledger.yaml",
        latestReviewDate: "2026-05-01",
        latestReviewVerdict: "met",
        status: "met",
      },
    ]);

    const findings = buildAlignmentFindings(emptyArtifacts, report);

    expect(findings.some((f) => f.category.startsWith("aspect_verdict_"))).toBe(false);
  });
});
