// mc:status — print Mission Control board summary.
// Usage: tsx scripts/mission-control/mc-status.ts [--json]

import { spawnSync } from "node:child_process";
import { loadSnapshot } from "./lib/snapshot";
import { formatStatus } from "./lib/format";
import { computeReleaseVerdict, formatReleaseVerdict } from "./lib/release-verdict";

type SurfaceAudit = {
  total: number;
  tagged: { length: number };
  infrastructure: { length: number };
  backfillBacklog: { length: number };
  orphans: { path: string }[];
};

function loadSurfaceAudit(): SurfaceAudit | null {
  const result = spawnSync("tsx", ["scripts/mission-control/mc-audit-surface.ts", "--json"], {
    encoding: "utf8",
  });
  if (!result.stdout) return null;
  try {
    const parsed = JSON.parse(result.stdout) as {
      total: number;
      tagged: unknown[];
      infrastructure: unknown[];
      backfillBacklog: unknown[];
      orphans: { path: string }[];
    };
    return {
      total: parsed.total,
      tagged: { length: parsed.tagged.length },
      infrastructure: { length: parsed.infrastructure.length },
      backfillBacklog: { length: parsed.backfillBacklog.length },
      orphans: parsed.orphans,
    };
  } catch {
    return null;
  }
}

const wantsJson = process.argv.includes("--json");
const snapshot = loadSnapshot();
const surface = loadSurfaceAudit();
const releaseVerdict = computeReleaseVerdict(snapshot);

if (wantsJson) {
  process.stdout.write(`${JSON.stringify({ ...snapshot, surface, releaseVerdict }, null, 2)}\n`);
} else {
  process.stdout.write(`${formatStatus(snapshot)}\n`);
  process.stdout.write(`\n${formatReleaseVerdict(releaseVerdict)}\n`);
  if (surface) {
    const orphanLine =
      surface.orphans.length === 0
        ? `\n\x1b[2mSurface audit: orphan 0 · tagged ${surface.tagged.length.toString()} · backfill-backlog ${surface.backfillBacklog.length.toString()} (총 ${surface.total.toString()})\x1b[0m\n`
        : `\n\x1b[31m\x1b[1mSurface audit: orphan ${surface.orphans.length.toString()}\x1b[0m — \`mc:audit-surface\`로 상세 확인\n`;
    process.stdout.write(orphanLine);
  }
}
