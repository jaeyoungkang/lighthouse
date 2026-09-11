// Mission Control owns both the release-verdict calculation and its CLI
// formatter. The retired admin dashboards must not pull process governance
// back into the application server boundary.

import type { AlignmentFinding } from "@/scripts/mission-control/lib/alignment-audit-types";
import { RELEASE_VERDICT_CLUSTERS, RELEASE_VERDICT_DIMENSIONS } from "@/app/domain/story-chain";
import {
  countIntentRowsNeedingAttention,
  type IntentTraceabilitySnapshot,
} from "@/scripts/mission-control/lib/intent-traceability-types";
import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";
import { buildAspectVerdictReport } from "@/scripts/mission-control/lib/aspect-verdict";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";

export const AC_TRACE_CATEGORIES = new Set([
  "missing_ac_ledger",
  "stale_ac_reference",
  "stale_story_reference",
  "stale_ledger_promise_reference",
  "missing_scenario_reference",
  "missing_scenario_coverage",
  "missing_ledger_file",
  "gap_status",
  "ac_trace_code_unreachable",
  "ac_trace_run_missing_target",
  "ac_trace_run_opaque",
  "ac_trace_run_missing",
]);

export type DimensionStatus = "green" | "blocked";

export interface DimensionReport {
  status: DimensionStatus;
  criticalCount: number;
  warningCount: number;
  detail: string;
}

export interface ReleaseVerdictReport {
  intent: DimensionReport;
  acTrace: DimensionReport;
  servicePolicy: DimensionReport;
  aspect: DimensionReport;
  release: DimensionStatus;
}

interface ClassifyResult {
  criticals: number;
  warnings: number;
}

function classify(findings: AlignmentFinding[], categorySet: Set<string>): ClassifyResult {
  let criticals = 0;
  let warnings = 0;
  for (const finding of findings) {
    if (!categorySet.has(finding.category)) continue;
    if (finding.severity === "critical") criticals += 1;
    else if (finding.severity === "warning") warnings += 1;
  }
  return { criticals, warnings };
}

function dimensionStatus(classified: ClassifyResult): DimensionStatus {
  return classified.criticals > 0 ? "blocked" : "green";
}

function formatDetail(classified: ClassifyResult): string {
  const parts: string[] = [];
  if (classified.criticals > 0) parts.push(`${String(classified.criticals)} critical`);
  if (classified.warnings > 0) parts.push(`${String(classified.warnings)} warning`);
  return parts.length === 0 ? "clean" : parts.join(" · ");
}

export function buildServicePolicyCoverageDimension(
  experiences: StoryChain["experiences"],
): DimensionReport {
  const coreExperiences = experiences.filter((experience) => experience.scope === "core-product");
  const unresolved = coreExperiences.filter(
    (experience) => experience.servicePolicyCoverage !== "complete",
  );
  return {
    status: unresolved.length > 0 ? "blocked" : "green",
    criticalCount: unresolved.length,
    warningCount: 0,
    detail:
      unresolved.length > 0
        ? `${String(coreExperiences.length - unresolved.length)}/${String(coreExperiences.length)} complete · ${String(unresolved.length)} unresolved`
        : `${String(coreExperiences.length)}/${String(coreExperiences.length)} complete`,
  };
}

export function computeReleaseVerdict(
  intentSnapshot: IntentTraceabilitySnapshot,
  chain: StoryChain = loadStoryChain(process.cwd()),
): ReleaseVerdictReport {
  const alignment = buildAlignmentSnapshot();
  const { summary } = intentSnapshot;
  const intentBlocking = countIntentRowsNeedingAttention(summary);
  const intent: DimensionReport = {
    status: intentBlocking > 0 ? "blocked" : "green",
    criticalCount: intentBlocking,
    warningCount: 0,
    detail:
      intentBlocking > 0
        ? `${String(intentBlocking)} not-met/unknown of ${String(summary.totalWithIntent)}`
        : `${String(summary.metCount)}/${String(summary.totalWithIntent)} met`,
  };

  const classifiedAc = classify(alignment.findings, AC_TRACE_CATEGORIES);
  const acTrace: DimensionReport = {
    status: dimensionStatus(classifiedAc),
    criticalCount: classifiedAc.criticals,
    warningCount: classifiedAc.warnings,
    detail: formatDetail(classifiedAc),
  };

  const servicePolicy = buildServicePolicyCoverageDimension(chain.experiences);

  const aspectReport = buildAspectVerdictReport();
  const aspectTotal = aspectReport.rows.length;
  const aspectBlocking =
    aspectReport.notMetCount + aspectReport.unknownCount + aspectReport.unverifiedCount;
  const aspect: DimensionReport = {
    status: aspectBlocking > 0 ? "blocked" : "green",
    criticalCount: aspectBlocking,
    warningCount: 0,
    detail:
      aspectBlocking > 0
        ? `${String(aspectReport.metCount)}/${String(aspectTotal)} met · ${String(aspectReport.notMetCount)} not-met · ${String(aspectReport.unknownCount)} unknown · ${String(aspectReport.unverifiedCount)} unverified`
        : `${String(aspectReport.metCount)}/${String(aspectTotal)} met`,
  };

  const dimensions = { intent, acTrace, servicePolicy, aspect };
  const release: DimensionStatus = RELEASE_VERDICT_DIMENSIONS.some(
    (dimension) => dimensions[dimension.reportKey].status === "blocked",
  )
    ? "blocked"
    : "green";

  return { ...dimensions, release };
}

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function colorFor(status: DimensionStatus): string {
  if (status === "green") return GREEN;
  return RED;
}

function statusLabel(status: DimensionStatus): string {
  if (status === "green") return "green";
  return "blocked";
}

export function formatReleaseVerdict(report: ReleaseVerdictReport): string {
  const lines: string[] = [];
  lines.push(`${BOLD}Release verdict${RESET}`);
  const fmt = (label: string, dim: DimensionReport) =>
    `    ${label.padEnd(15)} ${colorFor(dim.status)}${statusLabel(dim.status)}${RESET}  ${DIM}${dim.detail}${RESET}`;
  const clusterPresentation = {
    longitudinal: { label: "종단축 (Promise chain)", prefix: "┌" },
    "service-policy": { label: "서비스 정책 (composition)", prefix: "├" },
    "cross-cutting": { label: "횡단축 (Aspect)", prefix: "├" },
  } as const satisfies Record<
    (typeof RELEASE_VERDICT_CLUSTERS)[number],
    { label: string; prefix: string }
  >;
  for (const clusterId of RELEASE_VERDICT_CLUSTERS) {
    const presentation = clusterPresentation[clusterId];
    lines.push(`  ${DIM}${presentation.prefix} ${presentation.label}${RESET}`);
    for (const dimension of RELEASE_VERDICT_DIMENSIONS.filter(
      (candidate) => candidate.cluster === clusterId,
    )) {
      lines.push(fmt(dimension.label, report[dimension.reportKey]));
    }
  }
  const releaseColor = colorFor(report.release);
  const releaseLabel = report.release === "green" ? "ready" : statusLabel(report.release);
  lines.push(
    `  ${DIM}└${RESET} ${"Release:".padEnd(13)} ${releaseColor}${BOLD}${releaseLabel}${RESET}`,
  );
  return lines.join("\n");
}
