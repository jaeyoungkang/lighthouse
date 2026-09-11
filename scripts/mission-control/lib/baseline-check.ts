// Pure helpers for the alignment critical gate. Extracted from the CLI so the
// staged-file classifier and finding partition are tested deterministically.

import type { AlignmentFinding } from "@/scripts/mission-control/lib/alignment-audit-types";

export const ALIGNMENT_FILE_PREFIXES = [
  // Story Chain is the canonical chain authority.
  "docs/contracts/story-chain/",
  "app/server/services/story-chain/",
  // Gate / policy surfaces — modifying these can change *what* the gate enforces,
  // so a staged change here must trigger a full check even if no contract files moved.
  "scripts/mission-control/",
  ".husky/",
  ".github/workflows/",
];

export const ALIGNMENT_FILE_EXACT = new Set([
  "docs/contracts/story-chain/scenario-catalog.md",
  // Gate / policy definitions
  "package.json",
  "docs/principles.md",
  "docs/mission-control.md",
]);

export function affectsAlignmentFiles(files: string[]): boolean {
  return files.some(
    (f) => ALIGNMENT_FILE_EXACT.has(f) || ALIGNMENT_FILE_PREFIXES.some((p) => f.startsWith(p)),
  );
}

export function partitionAlignmentFindings(findings: AlignmentFinding[]): {
  criticals: AlignmentFinding[];
  warnings: AlignmentFinding[];
} {
  return {
    criticals: findings.filter((finding) => finding.severity === "critical"),
    warnings: findings.filter((finding) => finding.severity === "warning"),
  };
}
