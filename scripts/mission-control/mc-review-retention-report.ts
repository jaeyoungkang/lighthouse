import {
  APPROVED_KEEP_GENERATIONS,
  buildReviewRetentionReport,
  type ReviewRetentionReport,
} from "./lib/review-retention-report";

function parseArgs(args: string[]): { json: boolean } {
  const unknown = args.filter((arg) => arg !== "--json");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(", ")}. Supported arguments: --json`);
  }
  return { json: args.includes("--json") };
}

function formatReport(report: ReviewRetentionReport): string {
  const lines = [
    "Mission Control — Sufficiency Review retention report",
    `revision: ${report.repositoryRevision}${report.dirty ? " (dirty)" : ""}`,
    `population: ${String(report.population.streamCount)} streams · ${String(report.population.generationCount)} generations · ${String(report.population.lineCount)} lines · ${String(report.population.byteCount)} bytes`,
    `ordering hazards: ${String(report.population.orderingHazardStreamCount)} · foundational exemptions: ${String(report.population.foundationalExemptStreamCount)} · unmapped: ${String(report.population.unmappedStreamCount)}`,
    `unresolved: ${String(report.population.unresolvedGenerationCount)} total · ${String(report.population.currentUnresolvedGenerationCount)} current authority`,
    `cadence: ${String(report.cadence.intervalSampleCount)} intervals · median ${String(report.cadence.medianDays ?? "-")}d · p75 ${String(report.cadence.p75Days ?? "-")}d · p90 ${String(report.cadence.p90Days ?? "-")}d · max ${String(report.cadence.maxDays ?? "-")}d · same-day ${String(report.cadence.sameDayTransitionCount)}`,
    "",
    "N   raw keep   authority exceptions   effective keep   would dispose",
  ];
  for (const candidate of report.candidates) {
    const marker = candidate.keepGenerations === APPROVED_KEEP_GENERATIONS ? " * approved" : "";
    lines.push(
      `${String(candidate.keepGenerations).padEnd(3)} ${String(candidate.rawKeep).padEnd(10)} ${String(candidate.authorityExceptions).padEnd(22)} ${String(candidate.effectiveKeep).padEnd(16)} ${String(candidate.wouldDispose)}${marker}`,
    );
  }
  lines.push(
    "",
    "Advisory only: no review file was changed. Deletion and CI gate behavior are disabled.",
  );
  return lines.join("\n");
}

const args = parseArgs(process.argv.slice(2));
const report = buildReviewRetentionReport(process.cwd());
process.stdout.write(
  args.json ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`,
);
