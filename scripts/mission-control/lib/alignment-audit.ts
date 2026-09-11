import type {
  AlignmentContractUpdate,
  AlignmentContractUpdateKind,
  AlignmentJourneyLane,
  AlignmentJourneyLaneId,
  AlignmentJourneyScenario,
  AlignmentMomentRow,
  AlignmentFinding,
  AlignmentRunCheckRow,
  AlignmentSnapshot,
  AlignmentLedgerRow,
  AlignmentStatus,
  AlignmentPromiseRow,
  AlignmentExperienceRow,
} from "@/scripts/mission-control/lib/alignment-audit-types";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildAlignmentFindings } from "@/scripts/mission-control/lib/alignment-audit/findings";
import { loadAlignmentArtifacts } from "@/scripts/mission-control/lib/alignment-audit/parser";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";
import { buildAspectVerdictReportFromStoryChain } from "@/scripts/mission-control/lib/aspect-verdict";

const JOURNEY_LANE_ORDER: AlignmentJourneyLaneId[] = [
  "search",
  "citation_lineage",
  "gap",
  "pdf",
  "web",
];

const JOURNEY_LANE_LABELS: Record<AlignmentJourneyLaneId, string> = {
  search: "Search",
  citation_lineage: "Citation Lineage",
  gap: "Gap Network",
  pdf: "PDF",
  web: "Web",
};

const CONTRACT_ROOT = "docs/contracts/story-chain";
const RECENT_CONTRACT_UPDATE_COUNT = 8;

function listContractFiles(root: string, relativeDir: string): string[] {
  const absoluteDir = join(root, relativeDir);
  if (!existsSync(absoluteDir)) return [];

  return readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) return listContractFiles(root, relativePath);
    return entry.isFile() && (entry.name.endsWith(".md") || entry.name.endsWith(".ledger.yaml"))
      ? [relativePath]
      : [];
  });
}

function contractKind(path: string): AlignmentContractUpdateKind {
  if (path.includes("/experiences/")) return "experience";
  if (path.includes("/moments/")) return "moment";
  if (path.includes("/promises/")) return "promise";
  if (path.includes("/aspects/")) return "aspect";
  if (path.includes("/evidence-ledgers/")) return "evidence_ledger";
  return "other";
}

function contractMetadata(
  repoRoot: string,
  path: string,
): Pick<AlignmentContractUpdate, "refId" | "title"> {
  const fallbackTitle =
    path
      .split("/")
      .at(-1)
      ?.replace(/(?:\.ledger\.yaml|\.md)$/, "") ?? path;
  try {
    const markdown = readFileSync(join(repoRoot, path), "utf8");
    const refId = markdown.match(/^id:\s*([^\n]+)$/m)?.[1]?.trim() ?? null;
    const yamlSlug = markdown.match(/^slug:\s*([^\n]+)$/m)?.[1]?.trim();
    const frontmatterTitle = markdown.match(/^title:\s*([^\n]+)$/m)?.[1]?.trim();
    const headingTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return {
      refId,
      title: frontmatterTitle ?? headingTitle ?? yamlSlug ?? fallbackTitle,
    };
  } catch {
    return { refId: null, title: fallbackTitle };
  }
}

function gitOutput(repoRoot: string, args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", repoRoot, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function latestGitUpdate(repoRoot: string, path: string) {
  const output = gitOutput(repoRoot, ["log", "-1", "--format=%H%x09%aI%x09%an%x09%s", "--", path]);
  if (!output) return null;
  const [commitSha, updatedAt, author, ...summaryParts] = output.split("\t");
  if (!commitSha || !updatedAt) return null;
  return {
    commitSha,
    updatedAt,
    author: author || null,
    summary: summaryParts.join("\t") || "No commit summary",
  };
}

function dirtyContractPaths(repoRoot: string): Set<string> {
  const output = gitOutput(repoRoot, ["status", "--porcelain", "--", CONTRACT_ROOT]);
  if (!output) return new Set();
  return new Set(
    output
      .split("\n")
      .map((line) => line.slice(3).trim())
      .map((path) => path.replace(/^"|"$/g, ""))
      .filter((path) => path.endsWith(".md") || path.endsWith(".ledger.yaml")),
  );
}

function isContractPathDirty(repoRoot: string, path: string, dirtyPaths: Set<string>): boolean {
  if (dirtyPaths.has(path)) return true;
  const output = gitOutput(repoRoot, ["status", "--porcelain", "--", path]);
  return output !== null && output.length > 0;
}

function buildContractUpdates(repoRoot: string, generatedAt: string): AlignmentContractUpdate[] {
  const files = listContractFiles(repoRoot, CONTRACT_ROOT);
  const dirtyPaths = dirtyContractPaths(repoRoot);
  const updateRows = files.map((path) => {
    const metadata = contractMetadata(repoRoot, path);
    const latest = latestGitUpdate(repoRoot, path);
    const dirty = isContractPathDirty(repoRoot, path, dirtyPaths);
    return {
      path,
      kind: contractKind(path),
      refId: metadata.refId,
      title: metadata.title,
      updatedAt: dirty ? generatedAt : (latest?.updatedAt ?? "unknown"),
      commitSha: dirty ? null : (latest?.commitSha ?? null),
      author: dirty ? null : (latest?.author ?? null),
      summary: dirty ? "Working tree change pending review" : (latest?.summary ?? "No git history"),
      recent: false,
      dirty,
    } satisfies AlignmentContractUpdate;
  });

  return updateRows
    .sort((left, right) => {
      if (left.updatedAt === "unknown" && right.updatedAt === "unknown") {
        return left.path.localeCompare(right.path);
      }
      if (left.updatedAt === "unknown") return 1;
      if (right.updatedAt === "unknown") return -1;
      return right.updatedAt.localeCompare(left.updatedAt);
    })
    .map((row, index) => ({
      ...row,
      recent: row.dirty || index < RECENT_CONTRACT_UPDATE_COUNT,
    }));
}

function summarizeStatus(findings: AlignmentFinding[]): AlignmentStatus {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "gap";
  }
  if (findings.length > 0) {
    return "partial";
  }
  return "aligned";
}

function rollupStatus(statuses: AlignmentStatus[]): AlignmentStatus {
  if (statuses.includes("gap")) {
    return "gap";
  }
  if (statuses.includes("partial")) {
    return "partial";
  }
  return "aligned";
}

function buildPromiseRows(
  promises: ReturnType<typeof loadAlignmentArtifacts>["promises"],
  ledgerRows: ReturnType<typeof loadAlignmentArtifacts>["ledgerRows"],
  ledgers: ReturnType<typeof loadAlignmentArtifacts>["evidenceLedgers"],
  findings: AlignmentFinding[],
): AlignmentPromiseRow[] {
  const ledgerMap = new Map(ledgers.map((ledger) => [ledger.path, ledger]));

  return promises.map((promise) => {
    const ledgerRowsForPromise = ledgerRows.filter((row) => row.promiseId === promise.id);
    const relatedLedgers = [
      ...new Set(ledgerRowsForPromise.flatMap((row) => row.ledgerPaths)),
    ].filter((path) => ledgerMap.has(path));
    const relatedRunChecks = relatedLedgers.flatMap((path) => ledgerMap.get(path)?.runChecks ?? []);
    const relatedFindings = findings.filter(
      (finding) =>
        finding.promiseId === promise.id ||
        (finding.ledgerPath !== undefined && relatedLedgers.includes(finding.ledgerPath)),
    );

    return {
      id: promise.id,
      title: promise.title,
      experienceId: promise.experienceId,
      experienceTitle: promise.experienceTitle,
      experienceScope: promise.experienceScope,
      momentId: promise.momentId,
      momentTitle: promise.momentTitle,
      policyIds: promise.policyIds,
      acTotal: promise.acs.length,
      acCovered: promise.acs.filter((ac) =>
        ledgerRowsForPromise.some((row) => row.acceptanceKey === ac.id),
      ).length,
      scenarioCount: [...new Set(ledgerRowsForPromise.flatMap((row) => row.scenarioRefs))].length,
      ledgerCount: relatedLedgers.length,
      runCheckCount: relatedRunChecks.length,
      executionTargetCount: [
        ...new Set(relatedRunChecks.flatMap((runCheck) => runCheck.executionTargets)),
      ].length,
      codeTargetCount: [...new Set(relatedRunChecks.flatMap((runCheck) => runCheck.codeTargets))]
        .length,
      status: summarizeStatus(relatedFindings),
      findingIds: relatedFindings.map((finding) => finding.id),
    };
  });
}

function buildMomentRows(
  moments: ReturnType<typeof loadAlignmentArtifacts>["moments"],
  promiseRows: AlignmentPromiseRow[],
): AlignmentMomentRow[] {
  return moments.map((moment) => {
    const relatedPromiseRows = promiseRows.filter((promise) => promise.momentId === moment.id);
    return {
      id: moment.id,
      title: moment.title,
      experienceId: moment.experienceId,
      promiseIds: relatedPromiseRows.map((promise) => promise.id),
      status: rollupStatus(relatedPromiseRows.map((promise) => promise.status)),
    };
  });
}

function buildExperienceRows(
  experiences: ReturnType<typeof loadAlignmentArtifacts>["experiences"],
  moments: AlignmentMomentRow[],
  promiseRows: AlignmentPromiseRow[],
): AlignmentExperienceRow[] {
  return experiences.map((experience) => {
    const relatedPromiseRows = promiseRows.filter(
      (promise) => promise.experienceId === experience.id,
    );
    return {
      id: experience.id,
      title: experience.title,
      scope: experience.scope,
      momentIds: moments
        .filter((moment) => moment.experienceId === experience.id)
        .map((moment) => moment.id),
      promiseIds: relatedPromiseRows.map((promise) => promise.id),
      status: rollupStatus(relatedPromiseRows.map((promise) => promise.status)),
    };
  });
}

function buildLedgerRows(
  ledgers: ReturnType<typeof loadAlignmentArtifacts>["evidenceLedgers"],
  findings: AlignmentFinding[],
): AlignmentLedgerRow[] {
  return ledgers.map((ledger) => {
    const relatedFindings = findings.filter((finding) => finding.ledgerPath === ledger.path);
    return {
      path: ledger.path,
      title: ledger.title,
      sourcePromises: ledger.sourcePromises,
      sourceAspects: ledger.sourceAspects,
      foundational: ledger.foundational,
      runCheckCount: ledger.runChecks.length,
      executionTargetCount: [
        ...new Set(ledger.runChecks.flatMap((runCheck) => runCheck.executionTargets)),
      ].length,
      codeTargetCount: [...new Set(ledger.runChecks.flatMap((runCheck) => runCheck.codeTargets))]
        .length,
      status: summarizeStatus(relatedFindings),
      findingIds: relatedFindings.map((finding) => finding.id),
    };
  });
}

function buildRunCheckRows(
  ledgers: ReturnType<typeof loadAlignmentArtifacts>["evidenceLedgers"],
): AlignmentRunCheckRow[] {
  return ledgers.flatMap((ledger) =>
    ledger.runChecks.map((runCheck) => ({
      id: runCheck.id,
      ledgerPath: ledger.path,
      heading: runCheck.heading,
      command: runCheck.command,
      executionTargets: runCheck.executionTargets,
      codeTargets: runCheck.codeTargets,
      missingTargets: runCheck.missingTargets,
    })),
  );
}

function buildJourneyLanes(
  scenarios: ReturnType<typeof loadAlignmentArtifacts>["journeyScenarios"],
): AlignmentJourneyLane[] {
  const grouped = new Map<AlignmentJourneyLaneId, AlignmentJourneyScenario[]>();

  scenarios.forEach((scenario) => {
    const laneScenarios = grouped.get(scenario.lane) ?? [];
    laneScenarios.push({
      id: scenario.id,
      lane: scenario.lane,
      label: scenario.label,
      type: scenario.type,
      situation: scenario.situation,
      reactionTitle: scenario.reactionTitle,
      reactionBody: scenario.reactionBody,
      chips: scenario.chips,
      selectedChipLabel: scenario.selectedChipLabel,
      destinationLane: scenario.destinationLane,
    });
    grouped.set(scenario.lane, laneScenarios);
  });

  return JOURNEY_LANE_ORDER.filter((lane) => grouped.has(lane)).map((lane) => {
    const laneScenarios = grouped.get(lane) ?? [];
    return {
      id: lane,
      label: JOURNEY_LANE_LABELS[lane],
      scenarioRefs: laneScenarios.map((scenario) => scenario.id),
      scenarioCount: laneScenarios.length,
    };
  });
}

export function buildAlignmentSnapshot(
  repoRoot = process.cwd(),
  loadedChain?: StoryChain,
): AlignmentSnapshot {
  const chain = loadedChain ?? loadStoryChain(repoRoot);
  const artifacts = loadAlignmentArtifacts(repoRoot, chain);
  const aspectReport = buildAspectVerdictReportFromStoryChain(chain, repoRoot);
  const generatedAt = new Date().toISOString();
  const findings = buildAlignmentFindings(artifacts, aspectReport);
  const promiseRows = buildPromiseRows(
    artifacts.promises,
    artifacts.ledgerRows,
    artifacts.evidenceLedgers,
    findings,
  );
  const momentRows = buildMomentRows(artifacts.moments, promiseRows);
  const experienceRows = buildExperienceRows(artifacts.experiences, momentRows, promiseRows);
  const evidenceLedgerRows = buildLedgerRows(artifacts.evidenceLedgers, findings);
  const runChecks = buildRunCheckRows(artifacts.evidenceLedgers);
  const journeyLanes = buildJourneyLanes(artifacts.journeyScenarios);
  const journeyScenarios = artifacts.journeyScenarios.map((scenario) => ({
    id: scenario.id,
    lane: scenario.lane,
    label: scenario.label,
    type: scenario.type,
    situation: scenario.situation,
    reactionTitle: scenario.reactionTitle,
    reactionBody: scenario.reactionBody,
    chips: scenario.chips,
    selectedChipLabel: scenario.selectedChipLabel,
    destinationLane: scenario.destinationLane,
  }));

  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const infoCount = findings.filter((finding) => finding.severity === "info").length;

  return {
    generatedAt,
    repoRoot: artifacts.repoRoot,
    gapClaim: artifacts.gapClaim,
    summary: {
      experienceCount: experienceRows.length,
      momentCount: momentRows.length,
      promiseCount: promiseRows.length,
      ledgerCount: evidenceLedgerRows.length,
      runCheckCount: runChecks.length,
      executionTargetCount: [...new Set(runChecks.flatMap((runCheck) => runCheck.executionTargets))]
        .length,
      codeTargetCount: [...new Set(runChecks.flatMap((runCheck) => runCheck.codeTargets))].length,
      findingCount: findings.length,
      criticalCount,
      warningCount,
      infoCount,
      alignedPromiseCount: promiseRows.filter((promise) => promise.status === "aligned").length,
      partialPromiseCount: promiseRows.filter((promise) => promise.status === "partial").length,
      gapPromiseCount: promiseRows.filter((promise) => promise.status === "gap").length,
    },
    experiences: experienceRows,
    moments: momentRows,
    promises: promiseRows,
    evidenceLedgers: evidenceLedgerRows,
    runChecks,
    contractUpdates: buildContractUpdates(artifacts.repoRoot, generatedAt),
    findings,
    journeyLanes,
    journeyScenarios,
  };
}
