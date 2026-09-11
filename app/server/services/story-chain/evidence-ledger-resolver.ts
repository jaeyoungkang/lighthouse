import type {
  AcceptanceCheckKey,
  EvidenceLedger,
  EvidenceLedgerExecution,
  EvidenceLedgerExecutionRef,
  IntentCheckKey,
  IntentJudgmentRef,
  ScenarioRef,
} from "@/app/domain/story-chain";

import {
  splitAcceptanceCheckKey,
  splitIntentCheckKey,
  type EvidenceLedgerRecord,
} from "./evidence-ledger-record";

export function resolveEvidenceLedgerRecord(
  record: EvidenceLedgerRecord,
  file: string,
): EvidenceLedger {
  return {
    path: file,
    schemaVersion: record.schemaVersion,
    slug: record.slug,
    ...(record.review ? { reviewPath: record.review } : {}),
    intentMode: record.intent.mode,
    intentJudgmentRefs: (record.intentJudgmentRefs ?? []) as IntentJudgmentRef[],
    sourcePromises: [...record.sourcePromises],
    appliedAspects: [...record.appliedAspects],
    intentCheckEntries: record.intent.checks.map((entry) => {
      const [sourcePromise, id] = splitIntentCheckKey(entry.key, file);
      return {
        key: entry.key as IntentCheckKey,
        id,
        evidence: entry.evidence,
        sourcePromise,
      };
    }),
    intentDelegations: record.intent.delegations.map((entry) => {
      const [sourcePromise, check] = splitIntentCheckKey(entry.key, file);
      return {
        key: entry.key as IntentCheckKey,
        sourcePromise,
        check,
        ledger: entry.ledger,
      };
    }),
    acceptanceCheckEntries: record.acceptanceChecks.map((entry) => {
      const [sourcePromise, check] = splitAcceptanceCheckKey(entry.key, file);
      return {
        key: entry.key as AcceptanceCheckKey,
        check,
        evidence: entry.assertion,
        executionRefs: entry.executionRefs as EvidenceLedgerExecutionRef[],
        sourcePromise,
        scenarioRefs: [...entry.scenarios] as ScenarioRef[],
      };
    }),
    executions: record.executions as EvidenceLedgerExecution[],
    implementationContracts: [...record.implementationContracts],
    verdict: record.verdict,
  };
}
