#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { EvidenceLedger, EvidenceLedgerExecution } from "@/app/domain/story-chain";
import {
  evidenceExecutionCitationAliases,
  formatEvidenceExecution,
  knownEvidenceExecutableCitationAliases,
} from "@/app/server/services/story-chain/evidence-execution-metadata";
import { compileEvidenceExecution } from "@/app/server/services/story-chain/evidence-execution-registry";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import { validateEvidenceLedgerVitestSelectors } from "@/scripts/evidence-ledger/zero-test-guard";
import { CONTRACT_CHECK_CASES } from "@/scripts/evidence-ledger/contract-check-registry";

export function parseLedgerFilters(argv: readonly string[]): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--ledger" || argument === "--ledgers") {
      const value = argv[index + 1];
      if (value && !value.startsWith("-")) {
        values.push(...value.split(","));
        index += 1;
      }
    } else if (argument.startsWith("--ledger=") || argument.startsWith("--ledgers=")) {
      values.push(...argument.slice(argument.indexOf("=") + 1).split(","));
    }
  }
  return [...new Set(values.map(normalizeLedgerFilter).filter(Boolean))];
}

function normalizeLedgerFilter(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^docs\/contracts\/story-chain\/evidence-ledgers\//, "")
    .replace(/\.ledger\.(?:yaml|md)$/i, "")
    .toLowerCase();
}

export function filterLedgers(
  ledgers: readonly EvidenceLedger[],
  filters: readonly string[],
): EvidenceLedger[] {
  if (filters.length === 0) return [...ledgers];
  return ledgers.filter((ledger) => filters.includes(ledger.slug.toLowerCase()));
}

export function findUnmatchedLedgerFilters(
  ledgers: readonly EvidenceLedger[],
  filters: readonly string[],
): string[] {
  const slugs = new Set(ledgers.map((ledger) => ledger.slug.toLowerCase()));
  return filters.filter((filter) => !slugs.has(filter));
}

export function collectKnownContractSubcases(): Map<string, Set<string>> {
  return new Map(
    Object.entries(CONTRACT_CHECK_CASES).map(([target, subcases]) => [
      target,
      new Set(["all", ...subcases]),
    ]),
  );
}

const CITED_TEST_FILE_RE = /(?:app|scripts)\/[A-Za-z0-9_./()\[\]-]+\.test\.tsx?/g;
const CITED_CONTRACT_CHECK_RE = /contract-check\.ts(?:`)?\s+([a-z0-9-]+)\s+([a-z0-9-]+)/g;

interface CitedTestReference {
  file: string;
  titles: string[];
}

function findClosingParen(value: string, start: number): number {
  let quote: string | undefined;
  for (let index = start + 1; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === ")") {
      return index;
    }
  }
  return -1;
}

function extractLeadingCitationTitles(value: string): string[] {
  const titles: string[] = [];
  let offset = 0;
  while (/\s|`/.test(value[offset] ?? "")) offset += 1;
  while (value[offset] === "(") {
    const end = findClosingParen(value, offset);
    if (end < 0) break;
    const group = value.slice(offset + 1, end);
    for (const match of group.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)) {
      titles.push(match[2].replace(/\\(["'\\])/g, "$1"));
    }
    offset = end + 1;
    while (/\s/.test(value[offset] ?? "")) offset += 1;
    if (value[offset] !== "+") break;
    offset += 1;
    while (/\s/.test(value[offset] ?? "")) offset += 1;
  }
  return titles;
}

export function collectCitedTestReferences(evidence: string): CitedTestReference[] {
  const matches = [...evidence.matchAll(CITED_TEST_FILE_RE)];
  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? evidence.length;
    return {
      file: match[0],
      titles: extractLeadingCitationTitles(evidence.slice(start, end)),
    };
  });
}

function validateCitedTests(
  ledgerPath: string,
  entryKey: string,
  evidence: string,
  referenced: EvidenceLedgerExecution[],
): string[] {
  const violations: string[] = [];
  for (const citation of collectCitedTestReferences(evidence)) {
    const fileExecutions = referenced.filter(
      (execution) => execution.kind === "vitest" && execution.files.includes(citation.file),
    );
    if (fileExecutions.length === 0) {
      violations.push(
        `${ledgerPath}#${entryKey}: assertion cites test file without a referenced vitest execution: ${citation.file}`,
      );
      continue;
    }
    for (const title of citation.titles) {
      if (
        !fileExecutions.some(
          (execution) =>
            execution.kind === "vitest" && selectorCoversTitle(execution.testNamePattern, title),
        )
      ) {
        violations.push(
          `${ledgerPath}#${entryKey}: cited test title is excluded by referenced vitest selectors: ${citation.file} (${JSON.stringify(title)})`,
        );
      }
    }
  }
  return violations;
}

function validateCitedContractChecks(
  ledgerPath: string,
  entryKey: string,
  evidence: string,
  referenced: EvidenceLedgerExecution[],
): string[] {
  const violations: string[] = [];
  for (const match of evidence.matchAll(CITED_CONTRACT_CHECK_RE)) {
    const [, target, subcase] = match;
    const covered = referenced.some(
      (execution) =>
        execution.kind === "contract-check" &&
        execution.target === target &&
        execution.subcase === subcase,
    );
    if (!covered) {
      violations.push(
        `${ledgerPath}#${entryKey}: assertion cites contract-check without a referenced execution: ${target}/${subcase}`,
      );
    }
  }
  return violations;
}

function validateCitedExecutableScripts(
  ledgerPath: string,
  entryKey: string,
  evidence: string,
  referenced: EvidenceLedgerExecution[],
): string[] {
  const violations: string[] = [];
  const matchedAliases = knownEvidenceExecutableCitationAliases().filter((alias) =>
    evidence.includes(alias),
  );
  const distinctAliases = matchedAliases.filter(
    (alias) => !matchedAliases.some((other) => other !== alias && other.includes(alias)),
  );
  for (const alias of distinctAliases) {
    const covered = referenced.some((execution) =>
      evidenceExecutionCitationAliases(execution).includes(alias),
    );
    if (!covered) {
      violations.push(
        `${ledgerPath}#${entryKey}: assertion cites executable script without a referenced execution: ${alias}`,
      );
    }
  }
  return violations;
}

function selectorCoversTitle(pattern: string | undefined, title: string): boolean {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(title);
  } catch {
    return false;
  }
}

export function validateAcceptanceEvidenceBindings(ledger: EvidenceLedger): string[] {
  const executionById = new Map(ledger.executions.map((execution) => [execution.id, execution]));
  const violations: string[] = [];
  for (const entry of ledger.acceptanceCheckEntries) {
    const referenced = entry.executionRefs
      .map((ref) => executionById.get(ref))
      .filter((execution): execution is EvidenceLedgerExecution => execution !== undefined);
    violations.push(
      ...validateCitedTests(ledger.path, entry.key, entry.evidence, referenced),
      ...validateCitedContractChecks(ledger.path, entry.key, entry.evidence, referenced),
      ...validateCitedExecutableScripts(ledger.path, entry.key, entry.evidence, referenced),
    );
  }
  return violations;
}

export function validateEvidenceLedgerScriptExecution(
  execution: EvidenceLedgerExecution,
  _packageScripts: Readonly<Record<string, string>>,
  repoRoot = process.cwd(),
): string[] {
  try {
    compileEvidenceExecution(repoRoot, execution);
    return [];
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
}

function validateExecution(
  ledger: EvidenceLedger,
  execution: EvidenceLedgerExecution,
  repoRoot: string,
): string[] {
  const prefix = `${ledger.path}#${execution.id}`;
  try {
    compileEvidenceExecution(repoRoot, execution);
    return [];
  } catch (error) {
    return [`${prefix}: ${error instanceof Error ? error.message : String(error)}`];
  }
}

export function validateEvidenceLedgerExecutions(
  ledgers: readonly EvidenceLedger[],
  repoRoot: string,
): string[] {
  if (ledgers.length === 0) return ["no Evidence Ledger files found"];
  const violations = ledgers.flatMap((ledger) => [
    ...(ledger.executions.length === 0 ? [`${ledger.path}: no structured executions found`] : []),
    ...validateAcceptanceEvidenceBindings(ledger),
    ...ledger.executions.flatMap((execution) => validateExecution(ledger, execution, repoRoot)),
  ]);
  for (const violation of validateEvidenceLedgerVitestSelectors(ledgers, repoRoot)) {
    violations.push(`${violation.ledger}#${violation.execution}: ${violation.reason}`);
  }
  return [...new Set(violations)];
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
  const repoRoot = process.cwd();
  const dryRun = argv.includes("-dry-run") || argv.includes("--dry-run");
  const filters = parseLedgerFilters(argv);
  const allLedgers = loadStoryChain(repoRoot).evidenceLedgers;
  const ledgers = filterLedgers(allLedgers, filters);
  const unmatched = findUnmatchedLedgerFilters(allLedgers, filters);
  if (unmatched.length > 0) {
    console.error(`evidence-ledger: unmatched --ledger filter(s): ${unmatched.join(", ")}`);
    return 1;
  }
  const violations = validateEvidenceLedgerExecutions(ledgers, repoRoot);
  if (violations.length > 0) {
    console.error("evidence-ledger structured execution validation failed:");
    for (const violation of violations) console.error(`- ${violation}`);
    return 1;
  }
  const executionCount = ledgers.reduce((count, ledger) => count + ledger.executions.length, 0);
  console.log(
    `evidence-ledger: ${dryRun ? "validated" : "running"} ${String(executionCount)} structured execution(s) from ${String(ledgers.length)} ledger(s)${filters.length ? ` matching ${filters.join(", ")}` : ""}`,
  );
  if (dryRun) return 0;
  for (const ledger of ledgers) {
    for (const execution of ledger.executions) {
      const invocation = compileEvidenceExecution(repoRoot, execution);
      console.log(`\n[evidence-ledger] ${ledger.slug}#${execution.id}`);
      console.log(`$ ${formatEvidenceExecution(execution)}`);
      const result = spawnSync(invocation.binary, invocation.argv, {
        cwd: repoRoot,
        shell: false,
        stdio: "inherit",
        env: { ...process.env, EVIDENCE_LEDGER: "1" },
      });
      if (result.error) throw result.error;
      if ((result.status ?? 1) !== 0) return result.status ?? 1;
    }
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
