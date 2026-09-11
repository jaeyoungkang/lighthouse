// mc:check-critical-findings — current alignment critical gate.
//
// Strategy: alignment debt has been burned down to zero, so the gate no longer
// distinguishes "new" from "baseline" findings. CI/pre-commit runs this script
// in --check mode (default), builds the current alignment snapshot, and blocks
// on any current critical finding:
//
//   - critical findings  → exit 1, surface as blocker
//   - warning findings   → info, do not block
//
// The old command name is retained so existing package scripts and hooks do not
// break while the product language converges on the zero-critical policy.
//
// Usage:
//   npm run mc:check-critical-findings            # default check
//   npm run mc:check-critical-findings -- --staged
//   npm run mc:check-critical-findings -- --json

import { spawnSync } from "node:child_process";
import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";
import type { AlignmentFinding } from "@/scripts/mission-control/lib/alignment-audit-types";
import { affectsAlignmentFiles, partitionAlignmentFindings } from "./lib/baseline-check";

function getStagedFiles(): string[] {
  const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8",
  });
  if (staged.status !== 0) return [];
  return staged.stdout.split("\n").filter((f) => f.length > 0);
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function findingLabel(finding: AlignmentFinding): string {
  const parts: string[] = [finding.category];
  if (finding.promiseId) parts.push(`promise=${finding.promiseId}`);
  if (finding.acceptanceKey) parts.push(`ac=${finding.acceptanceKey}`);
  if (finding.ledgerPath) parts.push(`ledger=${finding.ledgerPath}`);
  if (finding.command) parts.push(`cmd=${finding.command}`);
  return parts.join("|");
}

function printHumanReadable(findings: AlignmentFinding[]): void {
  const { criticals, warnings } = partitionAlignmentFindings(findings);

  console.log(`${BOLD}Alignment critical check${RESET}\n`);

  if (criticals.length > 0) {
    console.log(`${RED}${BOLD}✖ ${String(criticals.length)} critical finding(s)${RESET}`);
    for (const finding of criticals) {
      console.log(`  ${RED}•${RESET} ${finding.title}`);
      console.log(`    ${DIM}${findingLabel(finding)}${RESET}`);
    }
    console.log("");
  }

  if (warnings.length > 0) {
    console.log(
      `${YELLOW}⚠ ${String(warnings.length)} warning finding(s) ${DIM}(non-blocking)${RESET}`,
    );
    for (const finding of warnings) {
      console.log(`  ${YELLOW}•${RESET} ${finding.title}`);
    }
    console.log("");
  }

  if (criticals.length === 0) {
    console.log(`${GREEN}No critical findings — clear to proceed.${RESET}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const wantsJson = args.includes("--json");
  const stagedOnly = args.includes("--staged");

  if (stagedOnly) {
    if (!affectsAlignmentFiles(getStagedFiles())) {
      if (!wantsJson) {
        process.stdout.write(
          "mc:check-critical-findings — no staged files affect alignment. skipping.\n",
        );
      } else {
        console.log(JSON.stringify({ skipped: true, reason: "no-alignment-staged" }));
      }
      return;
    }
    if (!wantsJson) {
      process.stdout.write(
        "mc:check-critical-findings — staged files affect alignment. running full check.\n",
      );
    }
  }

  const snap = buildAlignmentSnapshot();
  const { criticals, warnings } = partitionAlignmentFindings(snap.findings);
  if (wantsJson) {
    console.log(
      JSON.stringify(
        {
          criticals,
          warnings,
          criticalCount: criticals.length,
          warningCount: warnings.length,
        },
        null,
        2,
      ),
    );
  } else {
    printHumanReadable(snap.findings);
  }
  if (criticals.length > 0) process.exit(1);
}

main();
