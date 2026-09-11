import { loadCurrentMigrationCandidates, loadLegacyLedgerSnapshot } from "./converter";

const MIGRATION_BASE = "01b757f2db753d4aca96682a45cc33679ebcd03c";

const baseline = loadLegacyLedgerSnapshot(MIGRATION_BASE);
const { records, parity } = loadCurrentMigrationCandidates(process.cwd(), baseline);
const acceptanceChecks = parity.reduce((total, entry) => total + entry.acceptanceChecks, 0);
const executions = parity.reduce((total, entry) => total + entry.executions, 0);
const executionRepairs = parity.reduce((total, entry) => total + entry.executionRepairs, 0);

console.log(
  `evidence-ledger parity: ${String(records.size)} ledgers, ${String(acceptanceChecks)} Acceptance Checks, ${String(executions)} executions, ${String(executionRepairs)} registered execution repairs against ${baseline.ref}`,
);
