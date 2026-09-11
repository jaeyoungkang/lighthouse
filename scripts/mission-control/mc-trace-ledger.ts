// mc:trace-ledger — trace Evidence Ledger rows to run evidence and app code.
// Usage: tsx scripts/mission-control/mc-trace-ledger.ts --ledger documents [--json]

import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";

function parseArg(name: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function matchesLedger(path: string, query: string): boolean {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return true;
  return (
    path === normalizedQuery ||
    path.endsWith(normalizedQuery) ||
    path.endsWith(`${normalizedQuery}.ledger.yaml`) ||
    path.includes(normalizedQuery)
  );
}

const ledgerQuery = parseArg("ledger");
const wantsJson = process.argv.includes("--json");

if (!ledgerQuery) {
  process.stderr.write(
    "Usage: tsx scripts/mission-control/mc-trace-ledger.ts --ledger <path|name> [--json]\n",
  );
  process.exit(2);
}

const snapshot = buildAlignmentSnapshot(process.cwd());
const ledgers = snapshot.evidenceLedgers.filter((ledger) =>
  matchesLedger(ledger.path, ledgerQuery),
);

if (ledgers.length === 0) {
  process.stderr.write(`No Evidence Ledger matched "${ledgerQuery}".\n`);
  process.exit(1);
}

const traces = ledgers.map((ledger) => {
  const runChecks = snapshot.runChecks.filter((runCheck) => runCheck.ledgerPath === ledger.path);
  const findings = snapshot.findings.filter((finding) => finding.ledgerPath === ledger.path);
  return { ledger, runChecks, findings };
});

if (wantsJson) {
  process.stdout.write(`${JSON.stringify({ traces }, null, 2)}\n`);
} else {
  for (const trace of traces) {
    process.stdout.write(`${trace.ledger.path}\n`);
    process.stdout.write(`  title: ${trace.ledger.title}\n`);
    process.stdout.write(`  source promises: ${trace.ledger.sourcePromises.join(", ") || "-"}\n`);
    process.stdout.write(`  applied aspects: ${trace.ledger.sourceAspects.join(", ") || "-"}\n`);
    process.stdout.write(
      `  counts: run ${String(trace.ledger.runCheckCount)} · execution ${String(
        trace.ledger.executionTargetCount,
      )} · app code ${String(trace.ledger.codeTargetCount)} · findings ${String(
        trace.findings.length,
      )}\n`,
    );

    if (trace.runChecks.length === 0) {
      process.stdout.write("  run checks: -\n");
      continue;
    }

    process.stdout.write("  run checks:\n");
    for (const runCheck of trace.runChecks) {
      process.stdout.write(`    - ${runCheck.heading}\n`);
      process.stdout.write(`      command: ${runCheck.command}\n`);
      process.stdout.write(
        `      execution targets: ${runCheck.executionTargets.join(", ") || "-"}\n`,
      );
      process.stdout.write(`      app code targets: ${runCheck.codeTargets.join(", ") || "-"}\n`);
      if (runCheck.missingTargets.length > 0) {
        process.stdout.write(`      missing targets: ${runCheck.missingTargets.join(", ")}\n`);
      }
    }
  }
}
