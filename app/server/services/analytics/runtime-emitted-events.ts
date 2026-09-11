import { type Dirent, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { AnalyticsEventContract } from "./event-contract-types";

const DYNAMIC_ROUTER_BOUNDARY_PATHS = new Set([
  "app/api/analytics-events/route.ts",
  "app/server/domain-access/server-analytics.ts",
]);

interface RuntimeSourceFile {
  relativePath: string;
  source: string;
  directEventCalls: DirectEventCall[];
}

interface DirectEventCall {
  eventName: string;
  index: number;
}

interface CanonicalCallCandidate {
  callee: string;
  index: number;
  eventNameStart: number;
}

interface ExportedFunctionDefinition {
  relativePath: string;
  nameIndex: number;
  bodyStart: number;
  bodyEnd: number;
}

export function validateRuntimeEmittedEvents(
  contract: AnalyticsEventContract,
  repoRoot: string,
  errors: string[],
): void {
  const declared = new Set(contract.events.map((event) => event.name));
  const { emittedByName, runtimeSources, scanErrors } = findRuntimeEmittedEvents(repoRoot);

  errors.push(...scanErrors);

  for (const [eventName, filePaths] of emittedByName) {
    if (declared.has(eventName)) continue;
    errors.push(
      `${eventName}: runtime emits undeclared canonical event from ${[...filePaths].sort().join(", ")}`,
    );
  }

  validateActiveProductEmitterBindings(contract, runtimeSources, errors);
}

function findRuntimeEmittedEvents(repoRoot: string): {
  emittedByName: Map<string, Set<string>>;
  runtimeSources: RuntimeSourceFile[];
  scanErrors: string[];
} {
  const emittedByName = new Map<string, Set<string>>();
  const runtimeSources: RuntimeSourceFile[] = [];
  const scanErrors: string[] = [];
  for (const filePath of collectRuntimeSourceFiles(path.join(repoRoot, "app"))) {
    const relativePath = path.relative(repoRoot, filePath);
    const source = readFileSync(filePath, "utf8");
    collectUnsupportedCanonicalClientImports(source, relativePath, scanErrors);
    collectNonLiteralDirectEventCallErrors(source, relativePath, scanErrors);
    const directEventCalls = collectDirectCanonicalEventCalls(source, relativePath);
    runtimeSources.push({ relativePath, source, directEventCalls });
    for (const call of directEventCalls) {
      const filePaths = emittedByName.get(call.eventName) ?? new Set<string>();
      filePaths.add(relativePath);
      emittedByName.set(call.eventName, filePaths);
    }
    if (relativePath === "app/server/domain-access/server-analytics.ts") {
      collectEventNameMatches(
        source,
        /\bname:\s*["'`]([a-z][a-z0-9]*(?:[._][a-z][a-z0-9_]*)+)["'`]/g,
        relativePath,
        emittedByName,
      );
    }
  }
  return { emittedByName, runtimeSources, scanErrors };
}

function validateActiveProductEmitterBindings(
  contract: AnalyticsEventContract,
  runtimeSources: RuntimeSourceFile[],
  errors: string[],
): void {
  for (const event of contract.events) {
    if (event.owner !== "product" || event.name.includes(".")) continue;

    const emitter = event.emission?.emitter;
    if (!emitter) continue;
    const definitions = runtimeSources.flatMap((runtimeSource) =>
      findExportedFunctionDefinitions(runtimeSource, emitter),
    );
    if (definitions.length !== 1) {
      const locations = definitions.map((definition) => definition.relativePath).sort();
      errors.push(
        `${event.name}: emission emitter "${emitter}" must resolve to exactly one exported production function; found ${String(definitions.length)}${locations.length > 0 ? ` in ${locations.join(", ")}` : ""}`,
      );
      continue;
    }

    const definition = definitions[0];
    const bindingCalls = runtimeSources
      .flatMap((runtimeSource) =>
        runtimeSource.directEventCalls.map((call) => ({
          ...call,
          relativePath: runtimeSource.relativePath,
        })),
      )
      .filter(
        (call) =>
          call.eventName === event.name &&
          call.relativePath === definition.relativePath &&
          call.index >= definition.bodyStart &&
          call.index < definition.bodyEnd,
      );
    if (bindingCalls.length !== 1) {
      errors.push(
        `${event.name}: emission emitter "${emitter}" must emit the declared event exactly once; found ${String(bindingCalls.length)}`,
      );
    }

    const callerLocations = findProductionEmitterCallers(runtimeSources, emitter, definition);
    if (callerLocations.length === 0) {
      errors.push(`${event.name}: emission emitter "${emitter}" has no production caller`);
    }

    const bypassLocations = runtimeSources
      .flatMap((runtimeSource) =>
        runtimeSource.directEventCalls.map((call) => ({
          ...call,
          relativePath: runtimeSource.relativePath,
        })),
      )
      .filter((call) => {
        if (call.eventName !== event.name) return false;
        return !(
          call.relativePath === definition.relativePath &&
          call.index >= definition.bodyStart &&
          call.index < definition.bodyEnd
        );
      })
      .map((call) => call.relativePath)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort();
    if (bypassLocations.length > 0) {
      errors.push(
        `${event.name}: production emit path bypasses declared emitter "${emitter}" from ${bypassLocations.join(", ")}`,
      );
    }
  }
}

function findExportedFunctionDefinitions(
  runtimeSource: RuntimeSourceFile,
  functionName: string,
): ExportedFunctionDefinition[] {
  const escapedFunctionName = escapeRegExp(functionName);
  const pattern = new RegExp(
    `\\bexport\\s+(?:async\\s+)?function\\s+(${escapedFunctionName})\\s*\\(`,
    "g",
  );
  const definitions: ExportedFunctionDefinition[] = [];
  for (const match of runtimeSource.source.matchAll(pattern)) {
    const declarationIndex = match.index;
    if (!isExecutableCodePosition(runtimeSource.source, declarationIndex)) continue;
    const nameOffset = match[0].indexOf(functionName);
    const bodyStart = findFunctionBodyStart(runtimeSource.source, declarationIndex);
    if (bodyStart < 0) continue;
    const bodyEnd = findMatchingBrace(runtimeSource.source, bodyStart);
    if (bodyEnd < 0) continue;
    definitions.push({
      relativePath: runtimeSource.relativePath,
      nameIndex: declarationIndex + nameOffset,
      bodyStart,
      bodyEnd,
    });
  }
  return definitions;
}

function findProductionEmitterCallers(
  runtimeSources: RuntimeSourceFile[],
  emitter: string,
  definition: ExportedFunctionDefinition,
): string[] {
  const pattern = new RegExp(`\\b${escapeRegExp(emitter)}\\s*\\(`, "g");
  const callerLocations: string[] = [];
  for (const runtimeSource of runtimeSources) {
    for (const match of runtimeSource.source.matchAll(pattern)) {
      const index = match.index;
      if (!isExecutableCodePosition(runtimeSource.source, index)) continue;
      if (
        runtimeSource.relativePath === definition.relativePath &&
        (index === definition.nameIndex ||
          (index >= definition.bodyStart && index < definition.bodyEnd))
      ) {
        continue;
      }
      callerLocations.push(runtimeSource.relativePath);
    }
  }
  return callerLocations.filter((value, index, values) => values.indexOf(value) === index).sort();
}

function collectDirectCanonicalEventCalls(source: string, relativePath: string): DirectEventCall[] {
  const calls: DirectEventCall[] = [];
  for (const { eventNameStart, index } of collectCanonicalCallCandidates(source, relativePath)) {
    const eventName = readStringLiteral(source, eventNameStart);
    if (eventName && /^[a-z][a-z0-9]*(?:[._][a-z][a-z0-9_]*)+$/.test(eventName)) {
      calls.push({ eventName, index });
    }
  }
  return calls;
}

function collectUnsupportedCanonicalClientImports(
  source: string,
  relativePath: string,
  errors: string[],
): void {
  const importPattern = /import\s+([^;]+?)\s+from\s+["'][^"']*analytics\/client["']/g;
  for (const match of source.matchAll(importPattern)) {
    if (!isExecutableCodePosition(source, match.index)) continue;
    const importClause = match[1];
    if (/^\s*\*\s+as\s+/.test(importClause)) {
      errors.push(
        `${relativePath}: analytics client namespace imports are not allowed because event names must remain statically scannable`,
      );
    }
    if (/\btrackCanonicalEvent\s+as\s+/.test(importClause)) {
      errors.push(
        `${relativePath}: trackCanonicalEvent import aliases are not allowed because event names must remain statically scannable`,
      );
    }
  }
}

function collectRuntimeSourceFiles(root: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      files.push(...collectRuntimeSourceFiles(entryPath));
      continue;
    }
    if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts") &&
      !entry.name.includes(".test.") &&
      !entry.name.includes(".spec.")
    ) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectEventNameMatches(
  source: string,
  pattern: RegExp,
  relativePath: string,
  emittedByName: Map<string, Set<string>>,
): void {
  for (const match of source.matchAll(pattern)) {
    if (!isExecutableCodePosition(source, match.index)) continue;
    const eventName = match[1];
    if (!eventName) continue;
    const filePaths = emittedByName.get(eventName) ?? new Set<string>();
    filePaths.add(relativePath);
    emittedByName.set(eventName, filePaths);
  }
}

function collectNonLiteralDirectEventCallErrors(
  source: string,
  relativePath: string,
  errors: string[],
): void {
  for (const { callee, eventNameStart } of collectCanonicalCallCandidates(source, relativePath)) {
    if (eventNameStart <= 0 || !isQuote(source[eventNameStart])) {
      errors.push(`${relativePath}: ${callee} must use a literal canonical event name`);
    }
  }
}

function collectCanonicalCallCandidates(
  source: string,
  relativePath: string,
): CanonicalCallCandidate[] {
  const candidates: CanonicalCallCandidate[] = [];
  const directCallPattern = /\b(trackCanonicalEvent|trackCanonicalEventOnce)\s*\(/g;
  for (const match of source.matchAll(directCallPattern)) {
    const index = match.index;
    if (!isExecutableCodePosition(source, index)) continue;
    const callee = match[1];
    if (!callee || isFunctionDeclaration(source, index)) continue;
    if (isMethodCall(source, index) && DYNAMIC_ROUTER_BOUNDARY_PATHS.has(relativePath)) continue;
    if (
      callee === "trackCanonicalEvent" &&
      isInsideNamedFunction(source, index, "trackCanonicalEventOnce")
    ) {
      continue;
    }

    const argumentStart = index + match[0].length;
    const eventNameStart =
      callee === "trackCanonicalEvent"
        ? skipWhitespace(source, argumentStart)
        : skipWhitespace(source, findTopLevelComma(source, argumentStart) + 1);
    candidates.push({ callee, index, eventNameStart });
  }
  return candidates;
}

function isFunctionDeclaration(source: string, index: number): boolean {
  return source.slice(Math.max(0, index - "function ".length), index) === "function ";
}

function isInsideNamedFunction(source: string, index: number, functionName: string): boolean {
  const functionStart = source.lastIndexOf(`function ${functionName}`, index);
  if (functionStart < 0) return false;
  const rest = source.slice(functionStart + 1);
  const nextFunctionMatch = /\n(?:export\s+)?function\s+/.exec(rest);
  if (!nextFunctionMatch?.index) return true;
  return functionStart + 1 + nextFunctionMatch.index > index;
}

function isMethodCall(source: string, index: number): boolean {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const character = source[cursor];
    if (/\s/.test(character)) continue;
    return character === ".";
  }
  return false;
}

function skipWhitespace(source: string, index: number): number {
  let cursor = index;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor += 1;
  return cursor;
}

function isQuote(character: string | undefined): boolean {
  return character === '"' || character === "'" || character === "`";
}

interface LexicalScanState {
  quote: string | null;
  lineComment: boolean;
  blockComment: boolean;
}

function scanLexicalCharacter(
  source: string,
  cursor: number,
  state: LexicalScanState,
): { cursor: number; executable: boolean } {
  const character = source[cursor];
  const nextCharacter = source[cursor + 1];
  if (state.lineComment) {
    if (character === "\n") state.lineComment = false;
    return { cursor, executable: false };
  }
  if (state.blockComment) {
    if (character === "*" && nextCharacter === "/") {
      state.blockComment = false;
      return { cursor: cursor + 1, executable: false };
    }
    return { cursor, executable: false };
  }
  if (state.quote) {
    if (character === "\\") return { cursor: cursor + 1, executable: false };
    if (character === state.quote) state.quote = null;
    return { cursor, executable: false };
  }
  if (character === "/" && nextCharacter === "/") {
    state.lineComment = true;
    return { cursor: cursor + 1, executable: false };
  }
  if (character === "/" && nextCharacter === "*") {
    state.blockComment = true;
    return { cursor: cursor + 1, executable: false };
  }
  if (isQuote(character)) {
    state.quote = character;
    return { cursor, executable: false };
  }
  return { cursor, executable: true };
}

function isExecutableCodePosition(source: string, targetIndex: number): boolean {
  const state: LexicalScanState = { quote: null, lineComment: false, blockComment: false };
  for (let cursor = 0; cursor < targetIndex; cursor += 1) {
    cursor = scanLexicalCharacter(source, cursor, state).cursor;
  }
  return !state.quote && !state.lineComment && !state.blockComment;
}

function readStringLiteral(source: string, index: number): string | null {
  const quote = source[index];
  if (!isQuote(quote)) return null;
  let value = "";
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === "\\") return null;
    if (character === quote) return value;
    if (quote === "`" && character === "$" && source[cursor + 1] === "{") return null;
    value += character;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findFunctionBodyStart(source: string, declarationIndex: number): number {
  const parameterStart = source.indexOf("(", declarationIndex);
  if (parameterStart < 0) return -1;
  let parameterDepth = 0;
  let parametersClosed = false;
  let quote: string | null = null;
  for (let cursor = parameterStart; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === "\\") {
        cursor += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (isQuote(character)) {
      quote = character;
      continue;
    }
    if (character === "(") parameterDepth += 1;
    if (character === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) parametersClosed = true;
      continue;
    }
    if (parametersClosed && character === "{") return cursor;
  }
  return -1;
}

function findMatchingBrace(source: string, openingBraceIndex: number): number {
  let depth = 0;
  const state: LexicalScanState = { quote: null, lineComment: false, blockComment: false };
  for (let cursor = openingBraceIndex; cursor < source.length; cursor += 1) {
    const scanned = scanLexicalCharacter(source, cursor, state);
    cursor = scanned.cursor;
    if (!scanned.executable) continue;
    const character = source[cursor];
    if (character === "{") depth += 1;
    if (character === "}") {
      depth -= 1;
      if (depth === 0) return cursor;
    }
  }
  return -1;
}

function findTopLevelComma(source: string, index: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let cursor = index; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      if (character === "\\") {
        cursor += 1;
        continue;
      }
      if (character === quote) quote = null;
      continue;
    }
    if (isQuote(character)) {
      quote = character;
      continue;
    }
    if (character === "(" || character === "[" || character === "{") depth += 1;
    if (character === ")" || character === "]" || character === "}") depth -= 1;
    if (character === "," && depth === 0) return cursor;
    if (character === ")" && depth < 0) return -1;
  }
  return -1;
}
