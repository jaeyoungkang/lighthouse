import { readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import type { EvidenceExecution } from "./evidence-ledger-record";

import {
  isContractCheckSubcase,
  isContractCheckTarget,
} from "@/scripts/evidence-ledger/contract-check-registry";

export interface EvidenceProcess {
  binary: string;
  argv: string[];
}

const GUARD_PACKAGE_COMMANDS: Readonly<Record<string, string>> = {
  "guard:auth-hot-path": "node scripts/quality/check-auth-hot-path.mjs",
  "guard:korean": "node scripts/quality/check-hardcoded-korean.mjs",
  "guard:landing-auth-source-boundary":
    "npm run deps:boundaries && node scripts/quality/check-landing-auth-source-boundary.mjs",
  "guard:product-owned-navigation": "node scripts/quality/check-product-owned-navigation.mjs",
  "guard:search-condition-url-budget":
    "node scripts/architecture-fitness/check-search-condition-url-budget.mjs",
  "guard:search-first-paint-no-db": "node scripts/quality/check-search-first-paint-no-db.mjs",
  "guard:state-boundaries": "node scripts/architecture-fitness/check-state-boundaries.mjs",
};

const REGISTERED_GUARDS = new Set(Object.keys(GUARD_PACKAGE_COMMANDS));

function requireContainedFile(repoRoot: string, relativePath: string): string {
  const root = realpathSync(repoRoot);
  const absolute = realpathSync(path.resolve(root, relativePath));
  const relative = path.relative(root, absolute);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${relativePath}: execution target resolves outside the repository`);
  }
  if (!statSync(absolute).isFile()) {
    throw new Error(`${relativePath}: execution target is not a regular file`);
  }
  return absolute;
}

function readPackageScripts(repoRoot: string): Record<string, string> {
  const packageFile = requireContainedFile(repoRoot, "package.json");
  const parsed = JSON.parse(readFileSync(packageFile, "utf8")) as {
    scripts?: Record<string, unknown>;
  };
  return Object.fromEntries(
    Object.entries(parsed.scripts ?? {}).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function validateGuardDispatch(repoRoot: string, script: string): void {
  const expected = GUARD_PACKAGE_COMMANDS[script];
  if (!expected) throw new Error(`${script}: guard is not registered`);
  const actual = readPackageScripts(repoRoot)[script];
  if (actual !== expected) {
    throw new Error(
      `${script}: package dispatch differs from the registered exact command; expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`,
    );
  }
  const targetMatch = expected.match(
    /(?:^|&&\s*)(?:node\s+)(scripts\/[A-Za-z0-9_./-]+\.(?:mjs|js))$/,
  );
  if (!targetMatch)
    throw new Error(`${script}: registered package command has no exact node target`);
  requireContainedFile(repoRoot, targetMatch[1]);
}

export function compileEvidenceExecution(
  repoRoot: string,
  execution: EvidenceExecution,
): EvidenceProcess {
  if (execution.kind === "vitest") {
    const vitest = requireContainedFile(repoRoot, "node_modules/vitest/vitest.mjs");
    const files = execution.files.map((file) => {
      requireContainedFile(repoRoot, file);
      return file;
    });
    return {
      binary: process.execPath,
      argv: [
        vitest,
        "run",
        ...(execution.testNamePattern ? ["-t", execution.testNamePattern] : []),
        ...files,
      ],
    };
  }
  if (execution.kind === "contract-check") {
    const tsx = requireContainedFile(repoRoot, "node_modules/tsx/dist/cli.mjs");
    const check = requireContainedFile(
      repoRoot,
      "scripts/evidence-ledger/helpers/contract-check.ts",
    );
    return {
      binary: process.execPath,
      argv: [tsx, check, execution.target, execution.subcase],
    };
  }
  if (execution.kind === "guard") {
    validateGuardDispatch(repoRoot, execution.script);
    return { binary: "npm", argv: ["run", execution.script] };
  }
  if (execution.script === "gap-report-concurrency") {
    const expected = "tsx scripts/db-integration/run-gap-report-concurrency.ts";
    if (readPackageScripts(repoRoot)["test:db:gap-report-concurrency"] !== expected) {
      throw new Error("gap-report-concurrency package dispatch differs from the registry");
    }
    return { binary: "npm", argv: ["run", "test:db:gap-report-concurrency"] };
  }
  if (execution.script === "mc-check-critical-findings") {
    const expected = "tsx scripts/mission-control/mc-check-critical-findings.ts";
    if (readPackageScripts(repoRoot)["mc:check-critical-findings"] !== expected) {
      throw new Error("mc-check-critical-findings package dispatch differs from the registry");
    }
    const tsx = requireContainedFile(repoRoot, "node_modules/tsx/dist/cli.mjs");
    const script = requireContainedFile(
      repoRoot,
      "scripts/mission-control/mc-check-critical-findings.ts",
    );
    return { binary: process.execPath, argv: [tsx, script] };
  }
  if (execution.script === "message-registry-contract") {
    const tsx = requireContainedFile(repoRoot, "node_modules/tsx/dist/cli.mjs");
    const script = requireContainedFile(
      repoRoot,
      "scripts/mission-control/check-message-registry-contract.ts",
    );
    return { binary: process.execPath, argv: [tsx, script] };
  }
  const script = requireContainedFile(
    repoRoot,
    "scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
  );
  return { binary: process.execPath, argv: [script] };
}

interface TokenizeState {
  quote: "'" | '"' | null;
  escaped: boolean;
  current: string;
  tokens: string[];
}

function tokenize(command: string): string[] {
  const state: TokenizeState = { quote: null, escaped: false, current: "", tokens: [] };
  const push = () => {
    if (state.current.length > 0) state.tokens.push(state.current);
    state.current = "";
  };
  for (const character of command) {
    if (state.escaped) {
      state.current += character;
      state.escaped = false;
      continue;
    }
    if (character === "\\" && state.quote !== "'") {
      state.escaped = true;
      continue;
    }
    if (state.quote) {
      if (character === state.quote) state.quote = null;
      else state.current += character;
      continue;
    }
    if (character === "'" || character === '"') {
      state.quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      push();
      continue;
    }
    if (";&|<>`".includes(character) || character === "$" || character === "\0") {
      throw new Error(`unsupported shell token ${JSON.stringify(character)}`);
    }
    state.current += character;
  }
  if (state.quote || state.escaped) throw new Error("unterminated quote or escape");
  push();
  return state.tokens;
}

function legacySeparatorLength(command: string, index: number): number {
  if (command[index] === ";") return 1;
  return command[index] === "&" && command[index + 1] === "&" ? 2 : 0;
}

export function splitLegacyExecutionCommand(command: string): string[] {
  const parts: string[] = [];
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let current = "";
  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }
    if (character === "\\" && quote !== "'") {
      current += character;
      escaped = true;
      continue;
    }
    if (quote) {
      current += character;
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      current += character;
      continue;
    }
    const separatorLength = legacySeparatorLength(command, index);
    if (separatorLength > 0) {
      const part = current.trim();
      if (!part) throw new Error("empty command before legacy separator");
      parts.push(part);
      current = "";
      index += separatorLength - 1;
      continue;
    }
    if (character === "&" || character === "|") {
      throw new Error(`unsupported compound command token ${JSON.stringify(character)}`);
    }
    current += character;
  }
  if (quote || escaped) throw new Error("unterminated quote or escape");
  const finalPart = current.trim();
  if (!finalPart) throw new Error("empty final command");
  parts.push(finalPart);
  return parts;
}

export type EvidenceExecutionWithoutId =
  | { kind: "vitest"; files: string[]; testNamePattern?: string }
  | { kind: "contract-check"; target: string; subcase: string }
  | { kind: "guard"; script: string }
  | {
      kind: "registered-script";
      script:
        | "gap-report-concurrency"
        | "mc-check-critical-findings"
        | "message-registry-contract"
        | "relationship-seed-sticky-browser";
    };

export function parseLegacyExecutionCommand(command: string): EvidenceExecutionWithoutId {
  const tokens = tokenize(command);
  if (tokens[0] === "npx" && tokens[1] === "vitest" && tokens[2] === "run") {
    const argumentsAfterRun = tokens.slice(3);
    const selectorIndex = argumentsAfterRun.indexOf("-t");
    const files = selectorIndex < 0 ? argumentsAfterRun : argumentsAfterRun.slice(0, selectorIndex);
    const pattern = selectorIndex < 0 ? undefined : argumentsAfterRun[selectorIndex + 1];
    if (
      files.length === 0 ||
      files.some(
        (file) =>
          file.includes("\\") ||
          file.startsWith("-") ||
          path.posix.isAbsolute(file) ||
          path.posix.normalize(file) !== file ||
          file.split("/").includes("..") ||
          !/\.test\.tsx?$/.test(file),
      ) ||
      (selectorIndex >= 0 &&
        (selectorIndex !== argumentsAfterRun.length - 2 || !pattern || pattern.startsWith("-")))
    ) {
      throw new Error(`invalid bounded Vitest command: ${command}`);
    }
    return {
      kind: "vitest",
      files,
      ...(pattern ? { testNamePattern: pattern } : {}),
    };
  }
  if (
    tokens[0] === "npx" &&
    tokens[1] === "tsx" &&
    tokens[2] === "scripts/evidence-ledger/helpers/contract-check.ts" &&
    tokens.length === 5
  ) {
    if (!isContractCheckTarget(tokens[3]) || !isContractCheckSubcase(tokens[3], tokens[4])) {
      throw new Error(`unknown contract-check target or subcase: ${tokens[3]} ${tokens[4]}`);
    }
    return { kind: "contract-check", target: tokens[3], subcase: tokens[4] };
  }
  if (
    tokens[0] === "npm" &&
    tokens[1] === "run" &&
    tokens[2] === "mc:check-critical-findings" &&
    tokens.length === 3
  ) {
    return { kind: "registered-script", script: "mc-check-critical-findings" };
  }
  if (tokens[0] === "npm" && tokens[1] === "run" && tokens.length === 3) {
    if (!REGISTERED_GUARDS.has(tokens[2])) {
      throw new Error(`guard is not registered: ${tokens[2]}`);
    }
    return { kind: "guard", script: tokens[2] };
  }
  if (
    tokens.length === 3 &&
    tokens[0] === "npx" &&
    tokens[1] === "tsx" &&
    tokens[2] === "scripts/mission-control/check-message-registry-contract.ts"
  ) {
    return { kind: "registered-script", script: "message-registry-contract" };
  }
  if (
    tokens.length === 2 &&
    tokens[0] === "node" &&
    tokens[1] === "scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs"
  ) {
    return { kind: "registered-script", script: "relationship-seed-sticky-browser" };
  }
  throw new Error(`command is outside the closed Evidence Ledger grammar: ${command}`);
}

export function parseLegacyExecutionCommands(command: string): EvidenceExecutionWithoutId[] {
  return splitLegacyExecutionCommand(command).map(parseLegacyExecutionCommand);
}

export function executionIdentity(execution: EvidenceExecutionWithoutId): string {
  if (execution.kind === "vitest") {
    return JSON.stringify([execution.kind, execution.files, execution.testNamePattern ?? null]);
  }
  if (execution.kind === "contract-check") {
    return JSON.stringify([execution.kind, execution.target, execution.subcase]);
  }
  return JSON.stringify([execution.kind, execution.script]);
}

export function executionWithoutId(execution: EvidenceExecution): EvidenceExecutionWithoutId {
  if (execution.kind === "vitest") {
    return {
      kind: execution.kind,
      files: execution.files,
      ...(execution.testNamePattern ? { testNamePattern: execution.testNamePattern } : {}),
    };
  }
  if (execution.kind === "contract-check") {
    return {
      kind: execution.kind,
      target: execution.target,
      subcase: execution.subcase,
    };
  }
  if (execution.kind === "guard") {
    return { kind: execution.kind, script: execution.script };
  }
  return { kind: execution.kind, script: execution.script };
}
