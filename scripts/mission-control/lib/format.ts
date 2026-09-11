// Text formatters for human-readable CLI output. JSON output uses raw snapshot/data.

import {
  countIntentRowsNeedingAttention,
  type IntentTraceabilityRow,
  type IntentTraceabilitySnapshot,
} from "@/scripts/mission-control/lib/intent-traceability-types";
import type { NextAuthority } from "./snapshot";
import { nextAuthorityFor, recommendActionFor } from "./snapshot";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const AMBER = "\x1b[33m";

export function formatStatus(snapshot: IntentTraceabilitySnapshot): string {
  const { summary } = snapshot;
  const total = summary.totalWithIntent;
  const kept = summary.metCount;
  const drifting = countIntentRowsNeedingAttention(summary);
  const ratioPct = total === 0 ? 0 : Math.round((kept / total) * 100);
  const realityOpen = summary.totalOpenRealitySignals;
  const lines: string[] = [];
  lines.push(`${BOLD}Mission Control — 운영 보드 현황${RESET}`);
  lines.push(`${DIM}snapshot @ ${snapshot.generatedAt}${RESET}`);
  lines.push("");
  lines.push(
    `${BOLD}${String(kept)}/${String(total)}${RESET} (${String(ratioPct)}%) 사용자 약속이 지켜지고 있다`,
  );
  if (drifting > 0) {
    lines.push(`${RED}▲ 확인 필요한 약속 ${String(drifting)}건${RESET}`);
  } else {
    lines.push(`${DIM}◯ 확인 필요한 약속 없음${RESET}`);
  }
  if (realityOpen > 0) {
    lines.push(`${AMBER}▲ ${String(realityOpen)} production 신호가 확인을 기다린다${RESET}`);
  }
  lines.push("");
  const byAuthority = countByAuthority(snapshot.rows);
  lines.push(`${BOLD}Authority columns${RESET}`);
  lines.push(
    `  Human(H)     ${String(byAuthority.H).padStart(3)}  ${DIM}evidence·reality 검토 필요${RESET}`,
  );
  lines.push(
    `  Agent(A)     ${String(byAuthority.A).padStart(3)}  ${DIM}ledger 전파·파이프라인 fix${RESET}`,
  );
  lines.push(
    `  Evaluator(E) ${String(byAuthority.E).padStart(3)}  ${DIM}live judge 실행 필요${RESET}`,
  );
  lines.push(
    `  System(S)    ${String(byAuthority.S).padStart(3)}  ${DIM}release gate 유지·reality 흡수${RESET}`,
  );
  lines.push("");
  if (snapshot.blockedTopFive.length > 0) {
    lines.push(`${RED}${BOLD}지금 막힌 ${String(snapshot.blockedTopFive.length)}건${RESET}`);
    for (const entry of snapshot.blockedTopFive) {
      lines.push(
        `  ${entry.promiseRef} [${entry.lane}] ${DIM}crit ${String(entry.criticalFindingCount)} · open ${String(entry.openGapCount)}${RESET} — ${entry.blockerSummary}`,
      );
    }
    lines.push("");
  }
  lines.push(
    `${DIM}Source: docs/contracts/story-chain/ · docs/contracts/feature-ledgers.md · docs/contracts/story-chain/scenario-catalog.md${RESET}`,
  );
  lines.push(`${DIM}다음: \`npm run mc:next -- --authority A\`로 본인 책임 항목 확인${RESET}`);
  return lines.join("\n");
}

export function formatNext(
  snapshot: IntentTraceabilitySnapshot,
  authority: NextAuthority,
  limit: number,
): string {
  const filtered = snapshot.rows
    .filter((row) => nextAuthorityFor(row) === authority)
    .slice(0, limit);
  const lines: string[] = [];
  lines.push(
    `${BOLD}Mission Control — next ${authority} (${String(filtered.length)}/${String(countByAuthority(snapshot.rows)[authority])})${RESET}`,
  );
  if (authority === "H" || authority === "S") {
    lines.push(`${DIM}이 authority는 에이전트가 advance 못 한다 — 보고만 가능.${RESET}`);
  }
  lines.push("");
  if (filtered.length === 0) {
    lines.push(`${DIM}(이 authority에 항목 없음)${RESET}`);
    return lines.join("\n");
  }
  for (const row of filtered) {
    lines.push(`${BOLD}${row.promiseRef}${RESET} [${row.lane}] ${DIM}${row.title}${RESET}`);
    lines.push(`  stage: ${row.stage} · verdict: ${row.latestReviewVerdict ?? "—"}`);
    lines.push(`  ${BOLD}→${RESET} ${recommendActionFor(row)}`);
    if (row.realitySignals.openCount > 0) {
      lines.push(
        `  ${AMBER}▲ reality signals open: ${String(row.realitySignals.openCount)}${RESET}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function countByAuthority(rows: IntentTraceabilityRow[]): Record<NextAuthority, number> {
  const acc: Record<NextAuthority, number> = { H: 0, A: 0, E: 0, S: 0 };
  for (const row of rows) acc[nextAuthorityFor(row)] += 1;
  return acc;
}
