import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type {
  AcceptanceCheckKey,
  PromiseDeclaration,
  PromiseRef,
  ScenarioRef,
} from "@/app/domain/story-chain";
import {
  isFoundationalLedger,
  parseEvidenceLedgerFile,
  type LegacyEvidenceLedger,
} from "./legacy-markdown-audit";
import {
  evidenceLedgerRecordSchema,
  parseEvidenceLedgerRecord,
  serializeEvidenceLedgerRecord,
  type EvidenceExecution,
  type EvidenceLedgerRecord,
} from "@/app/server/services/story-chain/evidence-ledger-record";
import { parsePromiseFile } from "@/app/server/services/story-chain/parser";
import { parse as parseYaml } from "yaml";

import {
  executionIdentity,
  executionWithoutId,
  parseLegacyExecutionCommands,
  type EvidenceExecutionWithoutId,
} from "@/app/server/services/story-chain/evidence-execution-registry";
import {
  ACCEPTANCE_CHECK_KEY_REWRITES,
  ADDED_REVIEW_POINTERS,
  ARCHITECTURE_ASSERTION_REWRITES,
  ARCHITECTURE_EXECUTION_REWRITES,
  ARCHITECTURE_IMPLEMENTATION_REWRITES,
  FORWARD_ACCEPTANCE_CHECK_ADDITIONS,
  FORWARD_APPLIED_ASPECT_ADDITIONS,
  FORWARD_SCENARIO_ADDITIONS,
  LEGACY_EXECUTION_FILE_REWRITES,
  LEGACY_UNCURATED_INTENT_REPAIRS,
  POST_CUTOVER_LEDGER_ADDITIONS,
} from "./migration-delta-registry";

const LEDGER_DIR = "docs/contracts/story-chain/evidence-ledgers";
const PROMISE_DIR = "docs/contracts/story-chain/promises";
const RUN_FENCE = /```run:shell\s*\n([\s\S]*?)```/g;
const TEST_PATH = /`((?:app|packages|scripts)\/[^`\s]+\.test\.tsx?)`/g;
const CONTRACT_CITATION =
  /`(?:npx tsx )?scripts\/evidence-ledger\/helpers\/contract-check\.ts ([a-z0-9-]+) ([a-z0-9-]+)`/g;
const GUARD_CITATION = /(?:`)?npm run (guard:[a-z0-9:-]+)(?:`)?/g;

export interface LegacyLedgerSnapshot {
  ref: string;
  files: Map<string, string>;
  ledgers: Array<{ file: string; source: string; parsed: LegacyEvidenceLedger }>;
  promises: PromiseDeclaration[];
}

export interface MigrationParityResult {
  slug: string;
  acceptanceChecks: number;
  executions: number;
  executionRepairs: number;
  assertionRewrite: boolean;
  implementationRewrite: boolean;
  reviewPointerAdded: boolean;
  intentRepair: boolean;
}

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function listAtRef(ref: string, directory: string): string[] {
  return git(["ls-tree", "-r", "--name-only", ref, "--", directory])
    .split("\n")
    .filter(Boolean)
    .sort();
}

function readAtRef(ref: string, file: string): string {
  return git(["show", `${ref}:${file}`]);
}

export function loadLegacyLedgerSnapshot(ref: string): LegacyLedgerSnapshot {
  const resolvedRef = git(["rev-parse", "--verify", `${ref}^{commit}`]).trim();
  const ledgerFiles = listAtRef(resolvedRef, LEDGER_DIR).filter((file) =>
    file.endsWith(".ledger.md"),
  );
  const promiseFiles = listAtRef(resolvedRef, PROMISE_DIR).filter((file) => file.endsWith(".md"));
  const reviewFiles = listAtRef(resolvedRef, `${LEDGER_DIR}/reviews`);
  const files = new Map<string, string>();
  const ledgers: LegacyLedgerSnapshot["ledgers"] = [];
  for (const file of ledgerFiles) {
    const source = readAtRef(resolvedRef, file);
    files.set(file, source);
    if (isFoundationalLedger(source)) continue;
    assertContiguousAcceptanceTable(source, file);
    ledgers.push({ file, source, parsed: parseEvidenceLedgerFile({ source, file }) });
  }
  for (const file of reviewFiles) files.set(file, readAtRef(resolvedRef, file));
  const promises = promiseFiles.map((file) => {
    const source = readAtRef(resolvedRef, file);
    files.set(file, source);
    return parsePromiseFile({ source, file });
  });
  return { ref: resolvedRef, files, ledgers, promises };
}

export function assertContiguousAcceptanceTable(source: string, file: string): void {
  const section = source.match(/^## Acceptance Checks\s*$([\s\S]*?)(?=^## |\z)/m)?.[1] ?? "";
  const lines = section.split(/\r?\n/);
  const directive = lines.findIndex((line) => line.trim() === "> check:evidence-coverage");
  if (directive < 0) return;
  let tableStarted = false;
  let tableEnded = false;
  for (const line of lines.slice(directive + 1)) {
    const tableLine = /^>\s*\|/.test(line);
    if (tableLine) {
      if (tableEnded) throw new Error(`${file}: Acceptance Check table is non-contiguous`);
      tableStarted = true;
      continue;
    }
    if (tableStarted && line.trim().length > 0) tableEnded = true;
    if (tableStarted && line.trim().length === 0) tableEnded = true;
  }
}

function commandLines(body: string): string[] {
  return body
    .replace(/[ \t]*\\\n\s*/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function extractLegacyRunCommands(source: string): string[] {
  const commands: string[] = [];
  for (const match of source.matchAll(RUN_FENCE)) commands.push(...commandLines(match[1]));
  return commands;
}

export function extractLegacyImplementationContracts(source: string): string[] {
  const section = source.match(/^## Implementation Contracts\s*$([\s\S]*?)(?=^## |\z)/m)?.[1];
  if (!section) return [];
  const items: string[] = [];
  let current: string[] | undefined;
  for (const line of section.split(/\r?\n/)) {
    const bullet = line.match(/^\s*-\s+(.*)$/);
    if (bullet) {
      if (current) items.push(current.join(" ").trim());
      current = [bullet[1].trim()];
      continue;
    }
    if (current && line.trim().length > 0) current.push(line.trim());
  }
  if (current) items.push(current.join(" ").trim());
  return items;
}

function executionWithId(execution: EvidenceExecutionWithoutId, index: number): EvidenceExecution {
  return {
    ...execution,
    id: `execution:run-${String(index + 1).padStart(3, "0")}`,
  } as EvidenceExecution;
}

function matchingEvidenceExecutions(
  evidence: string,
  executions: readonly EvidenceExecution[],
): string[] {
  const refs = new Set<string>();
  const testPaths = [...evidence.matchAll(TEST_PATH)].map((match) => match[1]);
  for (const testPath of testPaths) {
    const candidates = executions.filter(
      (execution) => execution.kind === "vitest" && execution.files.includes(testPath),
    );
    const unfiltered = candidates.filter(
      (execution) => execution.kind === "vitest" && !execution.testNamePattern,
    );
    const selected =
      unfiltered.length > 0
        ? unfiltered
        : candidates.filter((execution) => {
            if (execution.kind !== "vitest") return false;
            const pattern = execution.testNamePattern;
            if (!pattern) return false;
            try {
              return [...evidence.matchAll(/"([^"]+)"/g)].some((title) =>
                new RegExp(pattern).test(title[1]),
              );
            } catch {
              return false;
            }
          });
    if (selected.length === 0) {
      throw new Error(`evidence cites ${testPath} without a matching executable selector`);
    }
    selected.forEach((execution) => refs.add(execution.id));
  }
  for (const match of evidence.matchAll(CONTRACT_CITATION)) {
    const found = executions.find(
      (execution) =>
        execution.kind === "contract-check" &&
        execution.target === match[1] &&
        execution.subcase === match[2],
    );
    if (!found)
      throw new Error(`evidence cites an unexecuted contract check ${match[1]} ${match[2]}`);
    refs.add(found.id);
  }
  for (const match of evidence.matchAll(GUARD_CITATION)) {
    const found = executions.find(
      (execution) => execution.kind === "guard" && execution.script === match[1],
    );
    if (!found) throw new Error(`evidence cites an unexecuted guard ${match[1]}`);
    refs.add(found.id);
  }
  if (evidence.includes("scripts/mission-control/check-message-registry-contract.ts")) {
    const found = executions.find(
      (execution) =>
        execution.kind === "registered-script" && execution.script === "message-registry-contract",
    );
    if (!found) throw new Error("evidence cites the message registry without an execution");
    refs.add(found.id);
  }
  if (evidence.includes("scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs")) {
    const found = executions.find(
      (execution) =>
        execution.kind === "registered-script" &&
        execution.script === "relationship-seed-sticky-browser",
    );
    if (!found) throw new Error("evidence cites the browser check without an execution");
    refs.add(found.id);
  }
  return [...refs];
}

function commandExecutions(
  command: string,
  byIdentity: ReadonlyMap<string, EvidenceExecution>,
  executions: readonly EvidenceExecution[],
): EvidenceExecution[] {
  return parseLegacyExecutionCommands(command).map((parsed) => {
    const identity = executionIdentity(parsed);
    const found = byIdentity.get(identity);
    if (found) return found;
    if (parsed.kind === "vitest") {
      const covering = executions.filter(
        (execution) =>
          execution.kind === "vitest" &&
          execution.testNamePattern === parsed.testNamePattern &&
          parsed.files.every((file) => execution.files.includes(file)),
      );
      if (covering.length === 1) return covering[0];
      if (covering.length > 1) {
        throw new Error(`Acceptance Check run has multiple covering executions: ${command}`);
      }
    }
    throw new Error(`Acceptance Check run is absent from run:shell: ${command}`);
  });
}

function assertLegacyExecutionCoverage(
  commandValues: readonly string[],
  retained: readonly EvidenceExecution[],
  file: string,
  rewriteRelocatedFiles = false,
): void {
  const selectorCovered = (legacyPattern?: string, candidatePattern?: string) => {
    if (!legacyPattern || !candidatePattern) return !candidatePattern;
    return (
      candidatePattern === legacyPattern ||
      candidatePattern.includes(legacyPattern) ||
      legacyPattern.split("|").every((part) => candidatePattern.includes(part))
    );
  };
  for (const command of commandValues) {
    for (const parsedLegacy of parseLegacyExecutionCommands(command)) {
      const legacy = rewriteRelocatedFiles
        ? rewriteLegacyExecutionFiles(parsedLegacy)
        : parsedLegacy;
      if (legacy.kind === "vitest") {
        const missing = legacy.files.filter(
          (testFile) =>
            !retained.some(
              (execution) =>
                execution.kind === "vitest" &&
                execution.files.includes(testFile) &&
                selectorCovered(legacy.testNamePattern, execution.testNamePattern),
            ),
        );
        if (missing.length > 0) {
          throw new Error(
            `${file}: conversion would drop Vitest targets from ${command}: ${missing.join(", ")}`,
          );
        }
        continue;
      }
      if (
        !retained.some(
          (execution) =>
            executionIdentity(executionWithoutId(execution)) === executionIdentity(legacy),
        )
      ) {
        throw new Error(`${file}: conversion would drop execution ${command}`);
      }
    }
  }
}

function rewriteLegacyExecutionFiles(
  execution: EvidenceExecutionWithoutId,
): EvidenceExecutionWithoutId {
  if (execution.kind !== "vitest") return execution;
  return {
    ...execution,
    files: execution.files.map((file) => LEGACY_EXECUTION_FILE_REWRITES.get(file) ?? file),
  };
}

function intentForLedger(
  ledger: LegacyEvidenceLedger,
  slug: string,
  snapshot: LegacyLedgerSnapshot,
): EvidenceLedgerRecord["intent"] {
  if (ledger.intentCheckEntries.length > 0) {
    return {
      mode: "explicit",
      checks: ledger.intentCheckEntries.map((entry) => ({
        key: `${entry.sourcePromise}#${entry.id}`,
        evidence: entry.evidence,
      })),
      delegations: [],
    };
  }
  if (ledger.intentAbsorbedIntoAcceptance) {
    return { mode: "absorbed", checks: [], delegations: [] };
  }
  const promises = new Map(snapshot.promises.map((entry) => [entry.id, entry]));
  const intentOwners = new Map<string, Set<string>>();
  for (const candidate of snapshot.ledgers) {
    const candidateSlug = path.basename(candidate.file).replace(/\.ledger\.md$/, "");
    for (const entry of candidate.parsed.intentCheckEntries) {
      const key = `${entry.sourcePromise}#${entry.id}`;
      const owners = intentOwners.get(key) ?? new Set<string>();
      owners.add(candidateSlug);
      intentOwners.set(key, owners);
    }
  }
  const delegations: EvidenceLedgerRecord["intent"]["delegations"] = [];
  for (const sourcePromise of ledger.sourcePromises) {
    const promise = promises.get(sourcePromise);
    if (!promise) throw new Error(`${slug}: unknown source Promise ${sourcePromise}`);
    for (const check of promise.intentChecks) {
      const key = `${sourcePromise}#${check.id}`;
      const owners = [...(intentOwners.get(key) ?? [])].filter((owner) => owner !== slug);
      if (owners.length !== 1) {
        throw new Error(`${slug}: ${key} has ${String(owners.length)} delegation owners`);
      }
      delegations.push({ key, ledger: owners[0] });
    }
  }
  return delegations.length > 0
    ? { mode: "delegated", checks: [], delegations }
    : { mode: "absorbed", checks: [], delegations: [] };
}

export function convertLegacyLedger(
  legacy: LegacyLedgerSnapshot["ledgers"][number],
  snapshot: LegacyLedgerSnapshot,
): EvidenceLedgerRecord {
  const slug = path.basename(legacy.file).replace(/\.ledger\.md$/, "");
  const commandValues = [
    ...extractLegacyRunCommands(legacy.source),
    ...legacy.parsed.acceptanceCheckEntries.flatMap((entry) =>
      entry.runCommand ? [entry.runCommand] : [],
    ),
  ];
  if (commandValues.length === 0) throw new Error(`${legacy.file}: no run:shell commands`);
  const unique = new Map<string, EvidenceExecutionWithoutId>();
  for (const command of commandValues) {
    for (const execution of parseLegacyExecutionCommands(command)) {
      unique.set(executionIdentity(execution), execution);
    }
  }
  const executions = [...unique.values()].map(executionWithId);
  const byIdentity = new Map(
    executions.map((execution) => [executionIdentity(executionWithoutId(execution)), execution]),
  );
  const acceptanceChecks = legacy.parsed.acceptanceCheckEntries.map((entry) => {
    const refs = new Set(matchingEvidenceExecutions(entry.evidence, executions));
    if (entry.runCommand) {
      commandExecutions(entry.runCommand, byIdentity, executions).forEach((execution) =>
        refs.add(execution.id),
      );
    }
    if (refs.size === 0) {
      throw new Error(`${legacy.file}: ${entry.key} has no assertion-bearing execution mapping`);
    }
    return {
      key: entry.key,
      assertion: entry.evidence,
      executionRefs: [...refs],
      scenarios: entry.scenarioRefs,
    };
  });
  const referencedExecutions = new Set(acceptanceChecks.flatMap((entry) => entry.executionRefs));
  const retainedExecutions = executions.filter((execution) =>
    referencedExecutions.has(execution.id),
  );
  assertLegacyExecutionCoverage(commandValues, retainedExecutions, legacy.file);
  const reviewPath = `${LEDGER_DIR}/reviews/${slug}.reviews.md`;
  const record = evidenceLedgerRecordSchema.parse({
    schemaVersion: 2,
    slug,
    ...(snapshot.files.has(reviewPath) ? { review: `reviews/${slug}.reviews.md` } : {}),
    sourcePromises: legacy.parsed.sourcePromises,
    appliedAspects: legacy.parsed.appliedAspects,
    ...(legacy.parsed.intentJudgmentRefs.length > 0
      ? { intentJudgmentRefs: legacy.parsed.intentJudgmentRefs }
      : {}),
    intent: intentForLedger(legacy.parsed, slug, snapshot),
    acceptanceChecks,
    executions: retainedExecutions,
    implementationContracts: extractLegacyImplementationContracts(legacy.source),
    verdict: legacy.parsed.verdict,
  });
  assertLegacyParity(
    legacy.parsed,
    legacy.source,
    record,
    reviewPath,
    snapshot.files.has(reviewPath),
  );
  return record;
}

export function assertLegacyParity(
  legacy: LegacyEvidenceLedger,
  legacySource: string,
  record: EvidenceLedgerRecord,
  reviewPath: string,
  reviewExists: boolean,
): void {
  const equal = (label: string, left: unknown, right: unknown) => {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`${legacy.path}: parity mismatch for ${label}`);
    }
  };
  equal("sourcePromises", legacy.sourcePromises, record.sourcePromises);
  equal("appliedAspects", legacy.appliedAspects, record.appliedAspects);
  equal("intentJudgmentRefs", legacy.intentJudgmentRefs, record.intentJudgmentRefs ?? []);
  equal(
    "Acceptance Check keys",
    legacy.acceptanceCheckEntries.map((entry) => entry.key),
    record.acceptanceChecks.map((entry) => entry.key),
  );
  equal(
    "Acceptance Check assertions",
    legacy.acceptanceCheckEntries.map((entry) => entry.evidence),
    record.acceptanceChecks.map((entry) => entry.assertion),
  );
  equal(
    "scenarios",
    legacy.acceptanceCheckEntries.map((entry) => entry.scenarioRefs),
    record.acceptanceChecks.map((entry) => entry.scenarios),
  );
  equal(
    "implementationContracts",
    extractLegacyImplementationContracts(legacySource),
    record.implementationContracts,
  );
  equal("verdict", legacy.verdict, record.verdict);
  equal(
    "review pointer",
    reviewExists ? path.basename(reviewPath) : undefined,
    record.review ? path.basename(record.review) : undefined,
  );
  if (legacy.intentCheckEntries.length > 0) {
    equal(
      "Intent Check evidence",
      legacy.intentCheckEntries.map((entry) => [entry.sourcePromise, entry.id, entry.evidence]),
      record.intent.checks.map((entry) => [
        entry.key.split("#")[0],
        entry.key.split("#")[1],
        entry.evidence,
      ]),
    );
  }
}

export function convertLegacySnapshot(snapshot: LegacyLedgerSnapshot): Map<string, string> {
  return new Map(
    snapshot.ledgers.map((legacy) => {
      const slug = path.basename(legacy.file).replace(/\.ledger\.md$/, "");
      return [
        `${LEDGER_DIR}/${slug}.ledger.yaml`,
        serializeEvidenceLedgerRecord(convertLegacyLedger(legacy, snapshot)),
      ];
    }),
  );
}

export function sourcePromiseSet(promises: readonly PromiseDeclaration[]): Set<PromiseRef> {
  return new Set(promises.map((promise) => promise.id));
}

function normalizedLedgerPointers<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replaceAll(".ledger.md", ".ledger.yaml")) as T;
}

function candidateAtRef(
  ref: string,
  legacy: LegacyLedgerSnapshot["ledgers"][number],
): EvidenceLedgerRecord {
  const slug = path.basename(legacy.file).replace(/\.ledger\.md$/, "");
  const file = `${LEDGER_DIR}/${slug}.ledger.yaml`;
  const raw = parseYaml(readAtRef(ref, file)) as Record<string, unknown>;
  const acceptanceChecks = raw.acceptanceChecks;
  if (!Array.isArray(acceptanceChecks)) {
    throw new Error(`${file}: migration candidate has no acceptanceChecks`);
  }
  acceptanceChecks.forEach((entry) => {
    if (entry && typeof entry === "object") delete (entry as Record<string, unknown>).scope;
  });
  const executions = raw.executions;
  if (!Array.isArray(executions)) {
    throw new Error(`${file}: migration candidate has no executions`);
  }
  const legacyCommands = [
    ...extractLegacyRunCommands(legacy.source),
    ...legacy.parsed.acceptanceCheckEntries.flatMap((entry) =>
      entry.runCommand ? [entry.runCommand] : [],
    ),
  ];
  const legacyUnfilteredFiles = new Set(
    legacyCommands
      .flatMap(parseLegacyExecutionCommands)
      .flatMap((execution) =>
        execution.kind === "vitest" && !execution.testNamePattern ? execution.files : [],
      ),
  );
  executions.forEach((entry) => {
    if (!entry || typeof entry !== "object") return;
    const execution = entry as Record<string, unknown>;
    if (
      execution.kind === "vitest" &&
      Array.isArray(execution.files) &&
      execution.files.some(
        (testFile) => typeof testFile === "string" && legacyUnfilteredFiles.has(testFile),
      )
    ) {
      delete execution.testNamePattern;
    }
  });
  if (legacy.parsed.intentCheckEntries.length > 0) {
    raw.intent = {
      mode: "explicit",
      checks: legacy.parsed.intentCheckEntries.map((entry) => ({
        key: `${entry.sourcePromise}#${entry.id}`,
        evidence: normalizedLedgerPointers(entry.evidence),
      })),
      delegations: [],
    };
  } else if (legacy.parsed.intentAbsorbedIntoAcceptance) {
    raw.intent = { mode: "absorbed", checks: [], delegations: [] };
  }
  if (legacy.parsed.intentJudgmentRefs.length > 0) {
    raw.intentJudgmentRefs = legacy.parsed.intentJudgmentRefs;
  } else {
    delete raw.intentJudgmentRefs;
  }
  const canonical = serializeEvidenceLedgerRecord(evidenceLedgerRecordSchema.parse(raw));
  return parseEvidenceLedgerRecord({ source: canonical, file });
}

function assertEqual(label: string, left: unknown, right: unknown, file: string): void {
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${file}: candidate parity mismatch for ${label}`);
  }
}

function assertScenarioParity(
  legacy: LegacyLedgerSnapshot["ledgers"][number],
  candidateChecks: EvidenceLedgerRecord["acceptanceChecks"],
  slug: string,
): void {
  const forwardScenarioAdditions: ReadonlyMap<
    AcceptanceCheckKey,
    ReadonlySet<ScenarioRef>
  > = FORWARD_SCENARIO_ADDITIONS.get(slug) ?? new Map();
  for (const [key, additions] of forwardScenarioAdditions) {
    const legacyEntry = legacy.parsed.acceptanceCheckEntries.find((entry) => entry.key === key);
    if (!legacyEntry) {
      throw new Error(`${legacy.file}: stale registered forward Scenario owner ${key}`);
    }
    const candidateEntry = candidateChecks.find((entry) => entry.key === key);
    for (const scenario of additions) {
      if (legacyEntry.scenarioRefs.includes(scenario)) {
        throw new Error(`${legacy.file}: stale registered forward Scenario ${scenario}`);
      }
      if (!candidateEntry?.scenarios.includes(scenario)) {
        throw new Error(`${legacy.file}: stale registered forward Scenario ${scenario}`);
      }
    }
  }
  const comparableCandidateScenarios = candidateChecks.map((entry) => {
    const additions = forwardScenarioAdditions.get(entry.key as AcceptanceCheckKey);
    return entry.scenarios.filter((scenario) => !additions?.has(scenario as ScenarioRef));
  });
  assertEqual(
    "scenarios",
    legacy.parsed.acceptanceCheckEntries.map((entry) => entry.scenarioRefs),
    comparableCandidateScenarios,
    legacy.file,
  );
}

export function assertReviewedCandidateParity(
  legacy: LegacyLedgerSnapshot["ledgers"][number],
  candidate: EvidenceLedgerRecord,
  snapshot: LegacyLedgerSnapshot,
): MigrationParityResult {
  const slug = candidate.slug;
  assertEqual("slug", path.basename(legacy.file, ".ledger.md"), slug, legacy.file);
  assertEqual(
    "Source Promises",
    legacy.parsed.sourcePromises,
    candidate.sourcePromises,
    legacy.file,
  );
  const forwardAspects =
    FORWARD_APPLIED_ASPECT_ADDITIONS.get(slug) ?? new Set<`aspect:${string}`>();
  for (const aspect of forwardAspects)
    if (!candidate.appliedAspects.includes(aspect))
      throw new Error(`${legacy.file}: stale registered forward Aspect ${aspect}`);
  assertEqual(
    "Applied Aspects",
    legacy.parsed.appliedAspects,
    candidate.appliedAspects.filter((aspect) => !forwardAspects.has(aspect)),
    legacy.file,
  );
  assertEqual(
    "intentJudgmentRefs",
    legacy.parsed.intentJudgmentRefs,
    candidate.intentJudgmentRefs ?? [],
    legacy.file,
  );
  const legacyAcceptanceCheckKeys = legacy.parsed.acceptanceCheckEntries.map((entry) => entry.key);
  const keyRewrites = ACCEPTANCE_CHECK_KEY_REWRITES.get(slug);
  const forwardAdditions: ReadonlySet<string> =
    FORWARD_ACCEPTANCE_CHECK_ADDITIONS.get(slug) ?? new Set<string>();
  for (const sourceKey of keyRewrites?.keys() ?? []) {
    if (!legacyAcceptanceCheckKeys.includes(sourceKey)) {
      throw new Error(`${legacy.file}: stale registered Acceptance Check key rewrite ${sourceKey}`);
    }
  }
  for (const addition of forwardAdditions) {
    if (!candidate.acceptanceChecks.some((entry) => entry.key === addition)) {
      throw new Error(`${legacy.file}: stale registered forward Acceptance Check ${addition}`);
    }
  }
  const legacyCandidateChecks = candidate.acceptanceChecks.filter(
    (entry) => !forwardAdditions.has(entry.key),
  );
  assertEqual(
    "Acceptance Check keys",
    legacyAcceptanceCheckKeys.map((key) => keyRewrites?.get(key) ?? key),
    legacyCandidateChecks.map((entry) => entry.key),
    legacy.file,
  );
  assertScenarioParity(legacy, legacyCandidateChecks, slug);
  assertEqual("verdict", legacy.parsed.verdict, candidate.verdict, legacy.file);

  const assertionsMatch =
    JSON.stringify(
      normalizedLedgerPointers(legacy.parsed.acceptanceCheckEntries.map((entry) => entry.evidence)),
    ) === JSON.stringify(legacyCandidateChecks.map((entry) => entry.assertion));
  if (!assertionsMatch && !ARCHITECTURE_ASSERTION_REWRITES.has(slug)) {
    throw new Error(`${legacy.file}: unregistered Acceptance Check assertion rewrite`);
  }

  const implementationMatches =
    JSON.stringify(
      normalizedLedgerPointers(extractLegacyImplementationContracts(legacy.source)),
    ) === JSON.stringify(candidate.implementationContracts);
  if (!implementationMatches && !ARCHITECTURE_IMPLEMENTATION_REWRITES.has(slug)) {
    throw new Error(`${legacy.file}: unregistered implementation-contract rewrite`);
  }

  const legacyReview = `${LEDGER_DIR}/reviews/${slug}.reviews.md`;
  const expectedReview = `reviews/${slug}.reviews.md`;
  const reviewExisted = snapshot.files.has(legacyReview);
  if (reviewExisted) {
    assertEqual("review pointer", expectedReview, candidate.review, legacy.file);
  } else if (candidate.review && !ADDED_REVIEW_POINTERS.has(slug)) {
    throw new Error(`${legacy.file}: unregistered review pointer addition`);
  }

  if (legacy.parsed.intentCheckEntries.length > 0) {
    assertEqual("intent mode", "explicit", candidate.intent.mode, legacy.file);
    legacy.parsed.intentCheckEntries.forEach((entry) => {
      const key = `${entry.sourcePromise}#${entry.id}`;
      const preserved = candidate.intent.checks.find((check) => check.key === key);
      assertEqual(
        `Intent Check evidence ${key}`,
        normalizedLedgerPointers(entry.evidence),
        preserved?.evidence,
        legacy.file,
      );
    });
  } else if (legacy.parsed.intentAbsorbedIntoAcceptance) {
    assertEqual("intent mode", "absorbed", candidate.intent.mode, legacy.file);
  } else {
    if (!LEGACY_UNCURATED_INTENT_REPAIRS.has(slug) || candidate.intent.mode !== "delegated") {
      throw new Error(`${legacy.file}: unregistered legacy intent-coverage repair`);
    }
  }

  const commandValues = [
    ...extractLegacyRunCommands(legacy.source),
    ...legacy.parsed.acceptanceCheckEntries.flatMap((entry) =>
      entry.runCommand ? [entry.runCommand] : [],
    ),
  ];
  if (!ARCHITECTURE_EXECUTION_REWRITES.has(slug)) {
    assertLegacyExecutionCoverage(commandValues, candidate.executions, legacy.file, true);
  }
  const legacyExecutionIdentities = new Set(
    commandValues
      .flatMap(parseLegacyExecutionCommands)
      .map(rewriteLegacyExecutionFiles)
      .map(executionIdentity),
  );
  const executionRepairs = candidate.executions.filter(
    (execution) => !legacyExecutionIdentities.has(executionIdentity(executionWithoutId(execution))),
  ).length;

  return {
    slug,
    acceptanceChecks: candidate.acceptanceChecks.length,
    executions: candidate.executions.length,
    executionRepairs,
    assertionRewrite: !assertionsMatch,
    implementationRewrite: !implementationMatches,
    reviewPointerAdded: !reviewExisted && Boolean(candidate.review),
    intentRepair: !legacy.parsed.curated,
  };
}

export function loadReviewedMigrationCandidates(
  candidateRef: string,
  snapshot: LegacyLedgerSnapshot,
): { records: Map<string, EvidenceLedgerRecord>; parity: MigrationParityResult[] } {
  const resolvedCandidate = git(["rev-parse", "--verify", `${candidateRef}^{commit}`]).trim();
  const records = new Map<string, EvidenceLedgerRecord>();
  const reviewedDelegationOwners = new Map<string, Map<string, string>>();
  for (const legacy of snapshot.ledgers) {
    const slug = path.basename(legacy.file).replace(/\.ledger\.md$/, "");
    const raw = parseYaml(readAtRef(resolvedCandidate, `${LEDGER_DIR}/${slug}.ledger.yaml`)) as {
      intent?: { delegations?: Array<{ key?: unknown; ledger?: unknown }> };
    };
    reviewedDelegationOwners.set(
      slug,
      new Map(
        (raw.intent?.delegations ?? [])
          .filter(
            (entry): entry is { key: string; ledger: string } =>
              typeof entry.key === "string" && typeof entry.ledger === "string",
          )
          .map((entry) => [entry.key, entry.ledger]),
      ),
    );
    const candidate = candidateAtRef(resolvedCandidate, legacy);
    records.set(candidate.slug, candidate);
  }
  for (const slug of POST_CUTOVER_LEDGER_ADDITIONS) {
    const file = `${LEDGER_DIR}/${slug}.ledger.yaml`;
    const source = readAtRef(resolvedCandidate, file);
    const raw = parseYaml(source) as {
      intent?: { delegations?: Array<{ key?: unknown; ledger?: unknown }> };
    };
    reviewedDelegationOwners.set(
      slug,
      new Map(
        (raw.intent?.delegations ?? [])
          .filter(
            (entry): entry is { key: string; ledger: string } =>
              typeof entry.key === "string" && typeof entry.ledger === "string",
          )
          .map((entry) => [entry.key, entry.ledger]),
      ),
    );
    const candidate = parseEvidenceLedgerRecord({ source, file });
    if (records.has(candidate.slug))
      throw new Error(`${file}: duplicate ledger slug ${candidate.slug}`);
    records.set(candidate.slug, candidate);
  }

  const promiseById = new Map(snapshot.promises.map((promise) => [promise.id, promise]));
  records.forEach((record, slug) => {
    if (record.intent.mode !== "explicit") return;
    const expected = record.sourcePromises.flatMap((promiseRef) => {
      const promise = promiseById.get(promiseRef);
      if (!promise && POST_CUTOVER_LEDGER_ADDITIONS.has(record.slug)) return [];
      if (!promise) throw new Error(`${record.slug}: missing Promise ${promiseRef}`);
      return promise.intentChecks.map((check) => `${promiseRef}#${check.id}`);
    });
    const checks = [...record.intent.checks];
    expected.forEach((key) => {
      if (checks.some((check) => check.key === key)) return;
      const ownerSlug = reviewedDelegationOwners.get(slug)?.get(key);
      const owner = ownerSlug ? records.get(ownerSlug) : undefined;
      const ownerCheck = owner?.intent.checks.find((check) => check.key === key);
      if (!ownerCheck) {
        throw new Error(`${slug}: missing reviewed explicit Intent evidence for ${key}`);
      }
      checks.push({ key, evidence: ownerCheck.evidence });
    });
    records.set(
      slug,
      evidenceLedgerRecordSchema.parse({
        ...record,
        intent: { mode: "explicit", checks, delegations: [] },
      }),
    );
  });

  return assertMigrationCandidateSetParity(records, snapshot);
}

function assertIntentSetParity(
  records: ReadonlyMap<string, EvidenceLedgerRecord>,
  snapshot: LegacyLedgerSnapshot,
): void {
  const promiseById = new Map(snapshot.promises.map((promise) => [promise.id, promise]));
  records.forEach((record) => {
    const expected = record.sourcePromises.flatMap((promiseRef) => {
      const promise = promiseById.get(promiseRef);
      if (!promise && POST_CUTOVER_LEDGER_ADDITIONS.has(record.slug)) return [];
      if (!promise) throw new Error(`${record.slug}: missing Promise ${promiseRef}`);
      return promise.intentChecks.map((check) => `${promiseRef}#${check.id}`);
    });

    if (record.intent.mode === "explicit") {
      assertEqual(
        "explicit Intent Check set",
        [...expected].sort(),
        record.intent.checks.map((entry) => entry.key).sort(),
        record.slug,
      );
      return;
    }

    if (record.intent.mode !== "delegated") return;
    assertEqual(
      "delegated Intent Check set",
      [...expected].sort(),
      record.intent.delegations.map((entry) => entry.key).sort(),
      record.slug,
    );
    record.intent.delegations.forEach((delegation) => {
      const owner = records.get(delegation.ledger);
      if (!owner || !owner.intent.checks.some((check) => check.key === delegation.key)) {
        throw new Error(
          `${record.slug}: delegated ${delegation.key} is not explicitly evidenced by ${delegation.ledger}`,
        );
      }
    });
  });
}

export function assertMigrationCandidateSetParity(
  records: Map<string, EvidenceLedgerRecord>,
  snapshot: LegacyLedgerSnapshot,
): { records: Map<string, EvidenceLedgerRecord>; parity: MigrationParityResult[] } {
  const legacySlugs = snapshot.ledgers.map((legacy) =>
    path.basename(legacy.file).replace(/\.ledger\.md$/, ""),
  );
  const expectedSlugs = [...legacySlugs, ...POST_CUTOVER_LEDGER_ADDITIONS].sort();
  assertEqual("ledger slug set", expectedSlugs, [...records.keys()].sort(), LEDGER_DIR);

  const parity = snapshot.ledgers.map((legacy) => {
    const slug = path.basename(legacy.file).replace(/\.ledger\.md$/, "");
    const candidate = records.get(slug);
    if (!candidate) throw new Error(`${slug}: migration candidate disappeared`);
    return assertReviewedCandidateParity(legacy, candidate, snapshot);
  });
  for (const slug of POST_CUTOVER_LEDGER_ADDITIONS) {
    const candidate = records.get(slug);
    if (!candidate) throw new Error(`${slug}: post-cutover ledger disappeared`);
    parity.push({
      slug,
      acceptanceChecks: candidate.acceptanceChecks.length,
      executions: candidate.executions.length,
      executionRepairs: 0,
      assertionRewrite: false,
      implementationRewrite: false,
      reviewPointerAdded: false,
      intentRepair: false,
    });
  }
  assertIntentSetParity(records, snapshot);
  return { records, parity };
}

/**
 * Read-only cutover audit. The baseline comes from Git history; the candidate
 * comes from the checked-out canonical YAML files, so CI certifies the actual
 * tree rather than a temporary migration branch.
 */
export function loadCurrentMigrationCandidates(
  repoRoot: string,
  snapshot: LegacyLedgerSnapshot,
): { records: Map<string, EvidenceLedgerRecord>; parity: MigrationParityResult[] } {
  const ledgerDirectory = path.join(repoRoot, LEDGER_DIR);
  const records = new Map<string, EvidenceLedgerRecord>();
  for (const basename of readdirSync(ledgerDirectory).filter((name) =>
    name.endsWith(".ledger.yaml"),
  )) {
    const file = `${LEDGER_DIR}/${basename}`;
    const record = parseEvidenceLedgerRecord({
      source: readFileSync(path.join(ledgerDirectory, basename), "utf8"),
      file,
    });
    if (records.has(record.slug)) throw new Error(`${file}: duplicate ledger slug ${record.slug}`);
    records.set(record.slug, record);
  }
  return assertMigrationCandidateSetParity(records, snapshot);
}
