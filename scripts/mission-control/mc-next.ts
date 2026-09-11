// mc:next — recommend next actionable item(s) for a given authority.
// Usage: tsx scripts/mission-control/mc-next.ts --authority A [--limit 5] [--json]

import { loadSnapshot, nextAuthorityFor, recommendActionFor } from "./lib/snapshot";
import type { NextAuthority } from "./lib/snapshot";
import { formatNext } from "./lib/format";

function parseArg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

const authorityRaw = parseArg("authority", "A");
const limit = Number.parseInt(parseArg("limit", "5") ?? "5", 10);
const wantsJson = process.argv.includes("--json");

if (!authorityRaw || !["H", "A", "E", "S"].includes(authorityRaw)) {
  process.stderr.write(
    `Usage: tsx scripts/mission-control/mc-next.ts --authority H|A|E|S [--limit N] [--json]\n`,
  );
  process.exit(2);
}
const authority = authorityRaw as NextAuthority;

const snapshot = loadSnapshot();

if (wantsJson) {
  const items = snapshot.rows
    .filter((row) => nextAuthorityFor(row) === authority)
    .slice(0, limit)
    .map((row) => ({
      promiseRef: row.promiseRef,
      lane: row.lane,
      title: row.title,
      stage: row.stage,
      latestReviewVerdict: row.latestReviewVerdict ?? null,
      latestReviewGapSummary: row.latestReviewGapSummary ?? null,
      latestReviewDate: row.latestReviewDate ?? null,
      targetEvidenceLedger: row.targetEvidenceLedger ?? null,
      inheritedFromEvidenceLedger: row.inheritedFromEvidenceLedger ?? null,
      priority: row.priority ?? null,
      difficulty: row.difficulty ?? null,
      ciqRows: row.ciqRows,
      realitySignals: row.realitySignals,
      recommendedAction: recommendActionFor(row),
    }));
  process.stdout.write(`${JSON.stringify({ authority, items }, null, 2)}\n`);
} else {
  process.stdout.write(`${formatNext(snapshot, authority, limit)}\n`);
}
