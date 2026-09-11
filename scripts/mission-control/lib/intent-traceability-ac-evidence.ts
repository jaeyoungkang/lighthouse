import type {
  IntentAcceptanceCriterionRow,
  IntentAcceptanceCriterionEvidenceMatch,
} from "@/scripts/mission-control/lib/intent-traceability-types";
import {
  loadAlignmentArtifacts,
  type ParsedAlignmentArtifacts,
  type ParsedEvidenceLedgerRunCheck,
} from "@/scripts/mission-control/lib/alignment-audit/parser";
import type { UsDeclaration } from "@/scripts/mission-control/lib/intent-traceability-user-stories";
import type { StoryChain } from "@/app/server/services/story-chain/loader";

interface AcceptanceCriterionEvidenceIndex {
  storyAcMap: Map<string, Array<{ id: string; text: string }>>;
  acEvidenceMatches: Map<string, IntentAcceptanceCriterionEvidenceMatch[]>;
}

function buildStoryAcMap(
  artifacts: ParsedAlignmentArtifacts,
): Map<string, Array<{ id: string; text: string }>> {
  return new Map(artifacts.promises.map((promise) => [promise.id, promise.acs]));
}

function mentionsAcceptanceCriterion(value: string, acceptanceKey: string): boolean {
  if (value.includes(acceptanceKey)) return true;
  const numbered = acceptanceKey.match(/-ac(\d+)$/i);
  return numbered ? new RegExp(`\\bAC${numbered[1]}\\b`, "i").test(value) : false;
}

function runCheckMatchesAc(
  runCheck: ParsedEvidenceLedgerRunCheck,
  promiseId: string,
  acceptanceKey: string,
  scenarioRef: string,
  ledgerDetail: string,
): boolean {
  const haystack = `${runCheck.heading}\n${runCheck.description}\n${runCheck.command}`;
  if (haystack.includes(promiseId) && mentionsAcceptanceCriterion(haystack, acceptanceKey)) {
    return true;
  }
  if (ledgerDetail.includes(runCheck.heading) || ledgerDetail.includes(runCheck.command)) {
    return true;
  }
  return scenarioRef !== "SC-unmapped" && haystack.includes(scenarioRef);
}

function toAcceptanceCriterionRunCheck(runCheck: ParsedEvidenceLedgerRunCheck) {
  return {
    heading: runCheck.heading,
    description: runCheck.description,
    command: runCheck.command,
    executionTargets: runCheck.executionTargets,
    codeTargets: runCheck.codeTargets,
  };
}

function buildAcEvidenceMatchIndex(
  artifacts: ParsedAlignmentArtifacts,
): Map<string, IntentAcceptanceCriterionEvidenceMatch[]> {
  const runChecksByLedger = new Map(
    artifacts.evidenceLedgers.map((ledger) => [ledger.path, ledger.runChecks]),
  );
  const matchesByAc = new Map<string, IntentAcceptanceCriterionEvidenceMatch[]>();

  for (const ledgerRow of artifacts.ledgerRows) {
    const key = ledgerRow.acceptanceKey;
    const existing = matchesByAc.get(key) ?? [];
    const scenarioRefs =
      ledgerRow.scenarioRefs.length > 0 ? ledgerRow.scenarioRefs : ["SC-unmapped"];

    for (const scenarioRef of scenarioRefs) {
      for (const ledgerPath of ledgerRow.ledgerPaths) {
        const runChecks = (runChecksByLedger.get(ledgerPath) ?? [])
          .filter((runCheck) =>
            runCheckMatchesAc(
              runCheck,
              ledgerRow.promiseId,
              ledgerRow.acceptanceKey,
              scenarioRef,
              ledgerRow.detail,
            ),
          )
          .map(toAcceptanceCriterionRunCheck);

        existing.push({
          scenarioRef,
          ledgerPath,
          runChecks,
        });
      }
    }

    matchesByAc.set(key, existing);
  }

  for (const [key, matches] of matchesByAc.entries()) {
    matchesByAc.set(
      key,
      matches.sort((a, b) => {
        const scenarioDiff = a.scenarioRef.localeCompare(b.scenarioRef);
        return scenarioDiff !== 0 ? scenarioDiff : a.ledgerPath.localeCompare(b.ledgerPath);
      }),
    );
  }

  return matchesByAc;
}

export function buildAcceptanceCriterionEvidenceIndex(
  repoRoot: string,
  loadedChain?: StoryChain,
): AcceptanceCriterionEvidenceIndex {
  const artifacts = loadAlignmentArtifacts(repoRoot, loadedChain);
  return {
    storyAcMap: buildStoryAcMap(artifacts),
    acEvidenceMatches: buildAcEvidenceMatchIndex(artifacts),
  };
}

export function buildAcceptanceCriterionRows(
  declaration: UsDeclaration,
  evidence: AcceptanceCriterionEvidenceIndex,
): IntentAcceptanceCriterionRow[] {
  const parsedAcs =
    evidence.storyAcMap.get(declaration.promiseRef) ??
    declaration.acceptanceCriteria.map((text, index) => ({
      id: `${declaration.promiseRef}#acceptance-check:${String(index + 1)}`,
      text,
    }));

  return parsedAcs.map((ac) => ({
    acceptanceKey: ac.id,
    text: ac.text,
    evidenceMatches: evidence.acEvidenceMatches.get(ac.id) ?? [],
  }));
}
