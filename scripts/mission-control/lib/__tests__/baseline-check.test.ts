import { describe, it, expect } from "vitest";
import type { AlignmentFinding } from "@/scripts/mission-control/lib/alignment-audit-types";
import { affectsAlignmentFiles, partitionAlignmentFindings } from "../baseline-check";

const sample = (overrides: Partial<AlignmentFinding>): AlignmentFinding => ({
  id: "finding-x",
  severity: "critical",
  category: "missing_ac_ledger",
  title: "sample",
  detail: "sample detail",
  evidence: [],
  ...overrides,
});

describe("affectsAlignmentFiles", () => {
  it("matches a Story Chain promise file", () => {
    expect(
      affectsAlignmentFiles(["docs/contracts/story-chain/promises/internal-intent-audit-page.md"]),
    ).toBe(true);
  });
  it("matches a Story Chain Evidence Ledger file", () => {
    expect(
      affectsAlignmentFiles([
        "docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml",
      ]),
    ).toBe(true);
  });
  it("rejects unrelated app code", () => {
    expect(affectsAlignmentFiles(["app/components/Foo.tsx", "README.md"])).toBe(false);
  });
  it("rejects empty staging", () => {
    expect(affectsAlignmentFiles([])).toBe(false);
  });
  it("matches gate / policy file changes (scripts/mission-control, package.json, principles/mission-control docs, husky, workflows)", () => {
    expect(affectsAlignmentFiles(["scripts/mission-control/lib/baseline-check.ts"])).toBe(true);
    expect(affectsAlignmentFiles(["package.json"])).toBe(true);
    expect(affectsAlignmentFiles(["docs/principles.md"])).toBe(true);
    expect(affectsAlignmentFiles(["docs/mission-control.md"])).toBe(true);
    expect(affectsAlignmentFiles([".husky/pre-commit"])).toBe(true);
    expect(affectsAlignmentFiles([".github/workflows/quality.yml"])).toBe(true);
  });
});

describe("partitionAlignmentFindings", () => {
  it("blocks on every current critical while keeping warnings non-blocking", () => {
    const result = partitionAlignmentFindings([
      sample({ severity: "critical", title: "critical one" }),
      sample({ severity: "warning", title: "warning one" }),
      sample({ severity: "critical", title: "critical two" }),
    ]);

    expect(result.criticals.map((finding) => finding.title)).toEqual([
      "critical one",
      "critical two",
    ]);
    expect(result.warnings.map((finding) => finding.title)).toEqual(["warning one"]);
  });
});
