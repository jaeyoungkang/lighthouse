import type { AlignmentFinding } from "@/scripts/mission-control/lib/alignment-audit-types";
import type { AspectVerdictReport } from "@/scripts/mission-control/lib/aspect-verdict";
import type {
  ParsedAlignmentArtifacts,
  ParsedLedgerRow,
  ParsedEvidenceLedgerDocument,
  ParsedPromise,
} from "./parser";

interface FindingMaps {
  promiseMap: Map<string, ParsedPromise>;
  scenarioMap: Map<string, string>;
  ledgerMap: Map<string, ParsedEvidenceLedgerDocument>;
}

class FindingCollector {
  private findings: AlignmentFinding[] = [];

  add(input: Omit<AlignmentFinding, "id">) {
    this.findings.push({
      ...input,
      id: `finding-${String(this.findings.length + 1)}`,
    });
  }

  all(): AlignmentFinding[] {
    return this.findings;
  }
}

function createFindingMaps(artifacts: ParsedAlignmentArtifacts): FindingMaps {
  return {
    promiseMap: new Map(artifacts.promises.map((promise) => [promise.id, promise])),
    scenarioMap: new Map(artifacts.scenarios.map((scenario) => [scenario.id, scenario.id])),
    ledgerMap: new Map(artifacts.evidenceLedgers.map((ledger) => [ledger.path, ledger])),
  };
}

function buildLedgerByAcKey(rows: ParsedLedgerRow[]): Map<string, ParsedLedgerRow[]> {
  const ledgerByAcKey = new Map<string, ParsedLedgerRow[]>();

  for (const row of rows) {
    const key = row.acceptanceKey;
    ledgerByAcKey.set(key, [...(ledgerByAcKey.get(key) ?? []), row]);
  }

  return ledgerByAcKey;
}

function addMissingLedgerFindings(
  collector: FindingCollector,
  promises: ParsedPromise[],
  ledgerByAcKey: Map<string, ParsedLedgerRow[]>,
) {
  for (const promise of promises) {
    for (const ac of promise.acs) {
      const rows = ledgerByAcKey.get(ac.id) ?? [];
      if (rows.length > 0) {
        continue;
      }

      collector.add({
        severity: "critical",
        category: "missing_ac_ledger",
        title: `${ac.id} is missing from the Evidence Ledger`,
        detail: `${ac.id} is declared on a Story Chain promise but is not mapped in a covering Evidence Ledger.`,
        promiseId: promise.id,
        acceptanceKey: ac.id,
        evidence: [
          "docs/contracts/story-chain/promises/",
          "docs/contracts/story-chain/evidence-ledgers/",
        ],
      });
    }
  }
}

function addLedgerQualityFindings(
  collector: FindingCollector,
  promises: ParsedPromise[],
  ledgerByAcKey: Map<string, ParsedLedgerRow[]>,
  maps: FindingMaps,
) {
  for (const promise of promises) {
    for (const ac of promise.acs) {
      const rows = ledgerByAcKey.get(ac.id) ?? [];
      if (rows.length === 0) {
        continue;
      }

      if (hasDuplicateAcLedgerDebt(rows, maps)) {
        collector.add({
          severity: "warning",
          category: "duplicate_ac_ledger",
          title: `${ac.id} is declared multiple times`,
          detail: `${ac.id} appears ${String(rows.length)} times in Evidence Ledger Acceptance Checks.`,
          promiseId: promise.id,
          acceptanceKey: ac.id,
          evidence: ["docs/contracts/story-chain/evidence-ledgers/"],
        });
      }

      for (const row of rows) {
        if (row.status === "Gap") {
          collector.add({
            severity: "critical",
            category: "gap_status",
            title: `${ac.id} is still marked as Gap`,
            detail: `${ac.id} does not have a closed executable contract yet.`,
            promiseId: promise.id,
            acceptanceKey: ac.id,
            evidence: ["docs/contracts/story-chain/evidence-ledgers/"],
          });
        }

        if (row.status === "Hybrid") {
          collector.add({
            severity: "warning",
            category: "hybrid_status",
            title: `${ac.id} is still Hybrid`,
            detail: `${ac.id} still depends on extra validation outside the executable contract.`,
            promiseId: promise.id,
            acceptanceKey: ac.id,
            evidence: ["docs/contracts/story-chain/evidence-ledgers/"],
          });
        }

        addScenarioAndLedgerReferenceFindings(collector, row, maps);
      }
    }
  }
}

function hasDuplicateAcLedgerDebt(rows: ParsedLedgerRow[], maps: FindingMaps): boolean {
  if (rows.length <= 1) {
    return false;
  }

  const rowCountByLedger = new Map<string, number>();
  for (const row of rows) {
    for (const ledgerPath of row.ledgerPaths) {
      rowCountByLedger.set(ledgerPath, (rowCountByLedger.get(ledgerPath) ?? 0) + 1);
    }
  }

  if ([...rowCountByLedger.values()].some((count) => count > 1)) {
    return true;
  }

  const ledgers = [...rowCountByLedger.keys()]
    .map((ledgerPath) => maps.ledgerMap.get(ledgerPath))
    .filter((ledger): ledger is ParsedEvidenceLedgerDocument => ledger !== undefined);

  const includesAspectLedger = ledgers.some((ledger) => ledger.sourceAspects.length > 0);
  return !includesAspectLedger;
}

function addScenarioAndLedgerReferenceFindings(
  collector: FindingCollector,
  row: ParsedLedgerRow,
  maps: FindingMaps,
) {
  for (const scenarioRef of row.scenarioRefs) {
    if (maps.scenarioMap.has(scenarioRef)) {
      continue;
    }

    collector.add({
      severity: "critical",
      category: "missing_scenario_reference",
      title: `${row.promiseId} ${row.acceptanceKey} points to a missing scenario`,
      detail: `${scenarioRef} is referenced in the AC ledger but missing from the scenario catalog.`,
      promiseId: row.promiseId,
      acceptanceKey: row.acceptanceKey,
      evidence: ["docs/contracts/story-chain/evidence-ledgers/"],
    });
  }

  for (const ledgerPath of row.ledgerPaths) {
    if (maps.ledgerMap.has(ledgerPath)) {
      continue;
    }

    collector.add({
      severity: "critical",
      category: "missing_ledger_file",
      title: `${row.promiseId} ${row.acceptanceKey} points to a missing ledger`,
      detail: `${ledgerPath} is listed in the Evidence Ledger but does not exist.`,
      promiseId: row.promiseId,
      acceptanceKey: row.acceptanceKey,
      ledgerPath,
      evidence: ["docs/contracts/story-chain/evidence-ledgers/", ledgerPath],
    });
  }
}

function addMissingScenarioCoverageFindings(
  collector: FindingCollector,
  artifacts: ParsedAlignmentArtifacts,
) {
  const coveredScenarios = new Set(artifacts.ledgerRows.flatMap((row) => row.scenarioRefs));
  for (const scenario of artifacts.scenarios) {
    if (coveredScenarios.has(scenario.id)) continue;
    collector.add({
      severity: "critical",
      category: "missing_scenario_coverage",
      title: `${scenario.id} has no owning Evidence Ledger entry`,
      detail:
        `${scenario.id} is active in the scenario catalog but no Promise Acceptance Check evidence names it. ` +
        "Add exact owning evidence or retire the stale scenario; do not attach it to a merely similar check.",
      evidence: [
        "docs/contracts/story-chain/scenario-catalog.md",
        "docs/contracts/story-chain/evidence-ledgers/",
      ],
    });
  }
}

function addStaleLedgerReferenceFindings(
  collector: FindingCollector,
  ledgerRows: ParsedLedgerRow[],
  maps: FindingMaps,
) {
  for (const row of ledgerRows) {
    const promise = maps.promiseMap.get(row.promiseId);
    if (!promise) {
      collector.add({
        severity: "critical",
        category: "stale_promise_reference",
        title: `${row.promiseId} only exists in a Evidence Ledger`,
        detail: `${row.promiseId} is referenced by a Evidence Ledger but no Story Chain promise declares it.`,
        promiseId: row.promiseId,
        acceptanceKey: row.acceptanceKey,
        evidence: [
          "docs/contracts/story-chain/evidence-ledgers/",
          "docs/contracts/story-chain/promises/",
        ],
      });
      continue;
    }

    const acExists = promise.acs.some((ac) => ac.id === row.acceptanceKey);
    if (acExists) {
      continue;
    }

    collector.add({
      severity: "critical",
      category: "stale_ac_reference",
      title: `${row.acceptanceKey} is is not declared on its promise`,
      detail: `${row.promiseId} is real, but ${row.acceptanceKey} is is not declared as an Acceptance Check on the corresponding Story Chain promise.`,
      promiseId: row.promiseId,
      acceptanceKey: row.acceptanceKey,
      evidence: [
        "docs/contracts/story-chain/evidence-ledgers/",
        "docs/contracts/story-chain/promises/",
      ],
    });
  }
}

function addLedgerDocumentFindings(
  collector: FindingCollector,
  artifacts: ParsedAlignmentArtifacts,
  maps: FindingMaps,
) {
  // Note: stale_evidence-ledger_report finding disabled (2026-04-28). The evidence-ledger
  // report (HTML + report.json) is generated render output, not source of
  // truth — per docs/principles.md §0.1 (canonical = `*.ledger.yaml`, render
  // output must not be committed). The alignment audit does not depend
  // on checked-in report freshness.
  for (const ledger of artifacts.evidenceLedgers) {
    if (
      ledger.path !== "docs/contracts/story-chain/evidence-ledgers/foundational/index.md" &&
      !ledger.hasTraceability
    ) {
      collector.add({
        severity: "warning",
        category: "missing_traceability_section",
        title: `${ledger.path} is missing Traceability`,
        detail: `${ledger.path} should declare source promises and policies explicitly.`,
        ledgerPath: ledger.path,
        evidence: [ledger.path],
      });
    }

    if (
      ledger.path !== "docs/contracts/story-chain/evidence-ledgers/foundational/index.md" &&
      !ledger.foundational &&
      ledger.runChecks.length === 0
    ) {
      collector.add({
        severity: "critical",
        category: "ac_trace_run_missing",
        title: `${ledger.path} has no structured execution`,
        detail: `${ledger.path} cannot be executed from the contract graph.`,
        ledgerPath: ledger.path,
        evidence: [ledger.path],
      });
    }

    if (
      ledger.path !== "docs/contracts/story-chain/evidence-ledgers/foundational/index.md" &&
      !ledger.foundational &&
      ledger.sourcePromises.length === 0
    ) {
      collector.add({
        severity: "warning",
        category: "missing_source_promise",
        title: `${ledger.path} is missing Source Promises`,
        detail: `Non-foundational ledgers should point back to the promises they protect.`,
        ledgerPath: ledger.path,
        evidence: [ledger.path],
      });
    }

    addLedgerPromiseReferenceFindings(collector, ledger, maps.promiseMap);
    addRunCheckFindings(collector, ledger);
  }
}

function addLedgerPromiseReferenceFindings(
  collector: FindingCollector,
  ledger: ParsedEvidenceLedgerDocument,
  promiseMap: Map<string, ParsedPromise>,
) {
  for (const promiseId of ledger.sourcePromises) {
    if (promiseMap.has(promiseId)) {
      continue;
    }

    collector.add({
      severity: "critical",
      category: "stale_ledger_promise_reference",
      title: `${ledger.path} references a missing promise`,
      detail: `${promiseId} is listed in Traceability but is not declared as a Story Chain promise.`,
      ledgerPath: ledger.path,
      evidence: [ledger.path, "docs/contracts/story-chain/promises/"],
    });
  }
}

function addRunCheckFindings(collector: FindingCollector, ledger: ParsedEvidenceLedgerDocument) {
  for (const runCheck of ledger.runChecks) {
    if (runCheck.executionTargets.length === 0) {
      collector.add({
        severity: "warning",
        category: "ac_trace_run_opaque",
        title: `${ledger.path} does not reveal its execution target`,
        detail: `The structured execution exists, but its registered target could not be discovered.`,
        ledgerPath: ledger.path,
        command: runCheck.command,
        evidence: [ledger.path],
      });
    }

    if (runCheck.missingTargets.length > 0) {
      collector.add({
        severity: "critical",
        category: "ac_trace_run_missing_target",
        title: `${ledger.path} points to missing execution files`,
        detail: `${runCheck.missingTargets.join(", ")} does not exist.`,
        ledgerPath: ledger.path,
        command: runCheck.command,
        evidence: [ledger.path, ...runCheck.missingTargets],
      });
    }

    if (
      runCheck.executionTargets.length > 0 &&
      runCheck.codeTargets.length === 0 &&
      requiresAppCodeTrace(runCheck.executionTargets)
    ) {
      collector.add({
        severity: "warning",
        category: "ac_trace_code_unreachable",
        title: `${ledger.path} cannot be traced to app code`,
        detail: `Execution files were found, but no app/ code target was derived from them.`,
        ledgerPath: ledger.path,
        command: runCheck.command,
        evidence: [ledger.path, ...runCheck.executionTargets],
      });
    }
  }
}

function requiresAppCodeTrace(executionTargets: string[]): boolean {
  return executionTargets.some(
    (target) => target.startsWith("app/") && target.includes("__tests__/"),
  );
}

function addOrphanLedgerFindings(
  collector: FindingCollector,
  ledgerRows: ParsedLedgerRow[],
  evidenceLedgers: ParsedEvidenceLedgerDocument[],
) {
  const referencedLedgerPaths = new Set(ledgerRows.flatMap((row) => row.ledgerPaths));

  for (const ledger of evidenceLedgers) {
    const isOrphan =
      ledger.path !== "docs/contracts/story-chain/evidence-ledgers/foundational/index.md" &&
      !ledger.foundational &&
      !referencedLedgerPaths.has(ledger.path) &&
      ledger.sourcePromises.length === 0;

    if (!isOrphan) {
      continue;
    }

    collector.add({
      severity: "warning",
      category: "orphan_ledger",
      title: `${ledger.path} is not connected to the AC ledger`,
      detail: `${ledger.path} exists, but no Evidence Ledger Acceptance Check points to it.`,
      ledgerPath: ledger.path,
      evidence: [ledger.path, "docs/contracts/story-chain/evidence-ledgers/"],
    });
  }
}

function addGapClaimFinding(
  collector: FindingCollector,
  gapClaim: string | null,
  findingCount: number,
) {
  if (!gapClaim || !/남아 있는 .*없/i.test(gapClaim) || findingCount === 0) {
    return;
  }

  collector.add({
    severity: "warning",
    category: "stale_gap_claim",
    title: "Evidence Ledger gap claim looks stale",
    detail: `The Evidence Ledger says there are no remaining gaps, but the analyzer found ${String(findingCount)} findings.`,
    evidence: ["docs/contracts/story-chain/evidence-ledgers/"],
  });
}

function normalizeConceptTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function collectDuplicateConceptLabels(
  items: Array<{ id: string; title: string; scope: string }>,
): Array<{ label: string; ids: string[]; scopes: string[] }> {
  const groups = new Map<string, { label: string; ids: string[]; scopes: string[] }>();

  for (const item of items) {
    const key = normalizeConceptTitle(item.title);
    if (!key) continue;
    const group = groups.get(key) ?? { label: item.title, ids: [], scopes: [] };
    group.ids.push(item.id);
    group.scopes.push(item.scope);
    groups.set(key, group);
  }

  return [...groups.values()].filter((group) => group.ids.length > 1);
}

function addHighLevelConceptDuplicateFindings(
  collector: FindingCollector,
  artifacts: ParsedAlignmentArtifacts,
): void {
  const duplicateThemes = collectDuplicateConceptLabels(
    artifacts.experiences.map((experience) => ({
      id: experience.id,
      title: experience.title,
      scope: "Experience",
    })),
  );
  const duplicateEpics = collectDuplicateConceptLabels(
    artifacts.moments.map((moment) => ({
      id: moment.id,
      title: moment.title,
      scope: `Moment under ${moment.experienceId}`,
    })),
  );
  const duplicates = [...duplicateThemes, ...duplicateEpics];
  if (duplicates.length === 0) return;

  const detail = duplicates
    .map(
      (group) =>
        `${group.label}: ${group.ids.join(", ")} (${[...new Set(group.scopes)].join(", ")})`,
    )
    .join("; ");

  collector.add({
    severity: "warning",
    category: "duplicate_high_level_concept",
    title: "Story Chain has duplicate high-level concept labels",
    detail: `${detail}. Treat this as a Mission Control H/A adjustment candidate: decide whether to merge, split, rename, or retire the duplicated Experience/Moment, then propagate Promise parent refs and Evidence Ledger coverage in the same change.`,
    evidence: [
      "docs/contracts/story-chain/experiences/",
      "docs/contracts/story-chain/moments/",
      "docs/contracts/story-chain/promises/",
      "shared-skills/mission-control/references/promise-modification.md",
    ],
  });
}

function addAspectFindings(
  collector: FindingCollector,
  polReport: AspectVerdictReport | undefined,
): void {
  if (!polReport) return;
  for (const row of polReport.rows) {
    if (row.status === "met") continue;

    const evidence: string[] = [
      "docs/contracts/story-chain/aspects/",
      ...(row.coveringLedger ? [row.coveringLedger] : []),
    ];

    if (row.status === "unverified") {
      collector.add({
        severity: "critical",
        category: "aspect_verdict_unverified",
        title: `${row.aspectRef} aspect has no verdict-bearing Sufficiency Review entry`,
        detail: row.coveringLedger
          ? `${row.aspectRef} (${row.title}) declares covering-ledger ${row.coveringLedger} but no §5 Sufficiency Review entry names this Aspect id. AOP own verdict (α Coverage ∧ β Wovenness) is unmeasured.`
          : `${row.aspectRef} (${row.title}) declares no covering-ledger — Aspect verdict cannot be located.`,
        evidence,
      });
      continue;
    }

    if (row.status === "not-met") {
      collector.add({
        severity: "critical",
        category: "aspect_verdict_not_met",
        title: `${row.aspectRef} aspect verdict is not-met`,
        detail: `${row.aspectRef} (${row.title}) latest §5 entry (${row.latestReviewDate ?? "?"}) reports Verdict: not-met. Pointcut sites do not currently satisfy advice (α/β failing).`,
        evidence,
      });
      continue;
    }

    // Only "unknown" can reach here (met/unverified/not-met all handled above).
    collector.add({
      severity: "critical",
      category: "aspect_verdict_unknown",
      title: `${row.aspectRef} aspect verdict is unknown`,
      detail: `${row.aspectRef} (${row.title}) latest §5 entry (${row.latestReviewDate ?? "?"}) reports Verdict: unknown. Per docs/principles.md §0, unknown is blocking.`,
      evidence,
    });
  }
}

export function buildAlignmentFindings(
  artifacts: ParsedAlignmentArtifacts,
  aspectReport?: AspectVerdictReport,
): AlignmentFinding[] {
  const collector = new FindingCollector();
  const maps = createFindingMaps(artifacts);
  const ledgerByAcKey = buildLedgerByAcKey(artifacts.ledgerRows);

  addMissingLedgerFindings(collector, artifacts.promises, ledgerByAcKey);
  addMissingScenarioCoverageFindings(collector, artifacts);
  addLedgerQualityFindings(collector, artifacts.promises, ledgerByAcKey, maps);
  addStaleLedgerReferenceFindings(collector, artifacts.ledgerRows, maps);
  addLedgerDocumentFindings(collector, artifacts, maps);
  addOrphanLedgerFindings(collector, artifacts.ledgerRows, artifacts.evidenceLedgers);
  addHighLevelConceptDuplicateFindings(collector, artifacts);
  addAspectFindings(collector, aspectReport);

  const findingsBeforeGapCheck = collector.all();
  addGapClaimFinding(collector, artifacts.gapClaim, findingsBeforeGapCheck.length);

  return collector.all();
}
