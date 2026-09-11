import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  requirePromiseExperience,
  type AcceptanceCheckKey,
  type EvidenceLedger,
  type EvidenceLedgerExecution,
} from "@/app/domain/story-chain";
import {
  evidenceExecutionTargets,
  formatEvidenceExecution,
} from "@/app/server/services/story-chain/evidence-execution-metadata";
import type { ParsedJourneyScenario } from "@/scripts/mission-control/lib/alignment-audit/journey-parser";
import { parseReactionScenarios } from "@/scripts/mission-control/lib/alignment-audit/journey-parser";
import { loadStoryChain, type StoryChain } from "@/app/server/services/story-chain/loader";
import {
  extractFunctionSource,
  extractSubcaseBlock,
} from "@/scripts/mission-control/lib/alignment-audit/run-check-parser";
export interface ParsedPromise {
  id: string;
  title: string;
  experienceId: string;
  experienceTitle: string;
  experienceScope: string;
  momentId: string;
  momentTitle: string;
  policyIds: string[];
  acs: Array<{ id: string; text: string }>;
}
export interface ParsedMoment {
  id: string;
  title: string;
  experienceId: string;
}
export interface ParsedExperience {
  id: string;
  title: string;
  scope: string;
}
export interface ParsedLedgerRow {
  promiseId: string;
  acceptanceKey: string;
  detail: string;
  scenarioRefs: string[];
  ledgerPaths: string[];
  status: string;
}
export interface ParsedScenarioRow {
  id: string;
}
export interface ParsedEvidenceLedgerRunCheck {
  id: string;
  heading: string;
  description: string;
  command: string;
  executionTargets: string[];
  codeTargets: string[];
  missingTargets: string[];
}
export interface ParsedEvidenceLedgerDocument {
  path: string;
  title: string;
  sourcePromises: string[];
  sourceAspects: string[];
  foundational: boolean;
  hasTraceability: boolean;
  inReportJson: boolean;
  runChecks: ParsedEvidenceLedgerRunCheck[];
}
export interface ParsedAlignmentArtifacts {
  repoRoot: string;
  experiences: ParsedExperience[];
  moments: ParsedMoment[];
  promises: ParsedPromise[];
  scenarios: ParsedScenarioRow[];
  journeyScenarios: ParsedJourneyScenario[];
  ledgerRows: ParsedLedgerRow[];
  gapClaim: string | null;
  evidenceLedgers: ParsedEvidenceLedgerDocument[];
}
function acceptanceKey(promiseId: string, checkId: string): AcceptanceCheckKey {
  return `${promiseId}#${checkId}` as AcceptanceCheckKey;
}

function parseStoryChainArtifacts(
  chain: StoryChain,
  repoRoot: string,
): {
  experiences: ParsedExperience[];
  moments: ParsedMoment[];
  promises: ParsedPromise[];
  ledgerRows: ParsedLedgerRow[];
} {
  const momentById = new Map(chain.moments.map((moment) => [moment.id, moment]));
  const experiences: ParsedExperience[] = chain.experiences.map((experience) => ({
    id: experience.id,
    title: experience.title,
    scope: experience.scope,
  }));
  const moments: ParsedMoment[] = chain.moments.map((moment) => ({
    id: moment.id,
    title: moment.title,
    experienceId: moment.experience,
  }));
  const promises: ParsedPromise[] = chain.promises.map((promise) => {
    const moment = momentById.get(promise.moment);
    const experience = requirePromiseExperience(promise, chain.moments, chain.experiences);
    return {
      id: promise.id,
      title: promise.title,
      experienceId: experience.id,
      experienceTitle: experience.title,
      experienceScope: experience.scope,
      momentId: promise.moment,
      momentTitle: moment?.title ?? promise.moment,
      policyIds: promise.aspects,
      acs: promise.acceptanceChecks.map((check) => ({
        id: acceptanceKey(promise.id, check.id),
        text: check.description,
      })),
    };
  });
  const ledgerRows: ParsedLedgerRow[] = chain.evidenceLedgers.flatMap((ledger) =>
    ledger.acceptanceCheckEntries.map((entry) => ({
      promiseId: entry.sourcePromise,
      acceptanceKey: entry.key,
      detail: entry.scope ?? entry.evidence,
      scenarioRefs: entry.scenarioRefs,
      ledgerPaths: [relative(repoRoot, ledger.path).replace(/\\/g, "/")],
      status: "Evidence runner",
    })),
  );
  return { experiences, moments, promises, ledgerRows };
}

function tryResolveImport(fromFile: string, specifier: string, repoRoot: string): string | null {
  const basePath = specifier.startsWith("@/")
    ? resolve(repoRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null;

  if (!basePath) {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    join(basePath, "index.ts"),
    join(basePath, "index.tsx"),
    join(basePath, "index.js"),
  ];

  const resolvedPath = candidates.find((candidate) => existsSync(candidate));
  return resolvedPath ? relative(repoRoot, resolvedPath).replace(/\\/g, "/") : null;
}

function isTraceableImplementationTarget(path: string): boolean {
  return (
    path.startsWith("app/") ||
    path.startsWith("docs/") ||
    path.startsWith("evidence-ledgers/") ||
    path.startsWith("profiles/") ||
    path.startsWith("scripts/") ||
    path.startsWith("supabase/") ||
    path.startsWith(".github/workflows/") ||
    path === "next.config.ts" ||
    path === "package.json" ||
    path === "stryker.config.mjs" ||
    path.startsWith("vitest.config")
  );
}

function collectImportedRepoPaths(filePath: string, repoRoot: string): string[] {
  const absolutePath = join(repoRoot, filePath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const source = readFileSync(absolutePath, "utf8");
  const imports = new Set<string>();

  for (const importPattern of [
    /from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ]) {
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier) {
        continue;
      }

      const resolvedPath = tryResolveImport(absolutePath, specifier, repoRoot);
      if (!resolvedPath) {
        continue;
      }

      if (isTraceableImplementationTarget(resolvedPath)) {
        imports.add(resolvedPath);
      }
    }
  }

  return [...imports].sort();
}

function buildContractCheckContext(
  helperPath: string,
  suite: string,
  subcase: string,
  repoRoot: string,
): string[] {
  const absolutePath = join(repoRoot, helperPath);
  if (!existsSync(absolutePath)) {
    return [];
  }

  const source = readFileSync(absolutePath, "utf8");
  const localImports = new Map<string, string>();

  for (const match of source.matchAll(
    /import\s+(?:type\s+)?(?:\{([^}]+)\}|([A-Za-z0-9_]+))\s+from\s+["']([^"']+)["']/g,
  )) {
    const specifier = match[3];
    if (!specifier) {
      continue;
    }

    const resolvedPath = tryResolveImport(absolutePath, specifier, repoRoot);
    if (!resolvedPath) {
      continue;
    }

    const namedImportBlock = match[1];
    const namedImports = namedImportBlock
      ? namedImportBlock
          .split(",")
          .map((entry) => entry.trim().split(/\s+as\s+/)[0] ?? "")
          .filter(Boolean)
      : [];

    for (const identifier of namedImports) {
      localImports.set(identifier, resolvedPath);
    }

    const defaultImport = match[2];
    if (defaultImport) {
      localImports.set(defaultImport, resolvedPath);
    }
  }

  const functionNameBySuite: Record<string, string> = {
    "product-boundary": "checkProductBoundary",
    "runtime-contract": "checkRuntimeContract",
    documents: "checkDocumentsContract",
    "gap-network-e2": "checkGapNetworkE2Contract",
  };
  const functionName = functionNameBySuite[suite];
  if (!functionName) {
    return [];
  }

  const functionSource = extractFunctionSource(source, functionName);
  if (!functionSource) {
    return [];
  }

  const block = extractSubcaseBlock(functionSource, subcase);
  if (!block) {
    return [];
  }

  // contract-check.ts dispatcher functions typically share setup code in the
  // function preamble (e.g. building `payload` from an imported helper) and
  // then assert subcase-specific properties inside `if (subcase === ...)`
  // blocks. Scan both the preamble (everything before the first subcase
  // branch) and the block itself, so identifiers consumed only in setup
  // (the actual app/ code under test) still resolve to code targets.
  const firstSubcaseIndex = functionSource.search(/if\s*\(\s*subcase\s*===/);
  const preamble = firstSubcaseIndex > 0 ? functionSource.slice(0, firstSubcaseIndex) : "";
  const scanned = `${preamble}\n${block}`;

  const refs = new Set<string>();

  for (const match of scanned.matchAll(/readRepoFile\("([^"]+)"\)/g)) {
    const pathValue = match[1];
    if (pathValue) {
      refs.add(pathValue);
    }
  }

  for (const match of scanned.matchAll(/existsSync\("([^"]+)"\)/g)) {
    const pathValue = match[1];
    if (pathValue) {
      refs.add(pathValue);
    }
  }

  for (const [identifier, importPath] of localImports.entries()) {
    if (new RegExp(`\\b${identifier}\\b`).test(scanned)) {
      refs.add(importPath);
    }
  }

  return [...refs].filter(isTraceableImplementationTarget).sort();
}

function resolveTargetWithExtensionFallback(target: string, repoRoot: string): string | null {
  if (existsSync(join(repoRoot, target))) return target;
  if (target.endsWith(".ts")) {
    const tsx = target.slice(0, -3) + ".tsx";
    if (existsSync(join(repoRoot, tsx))) return tsx;
  }
  return null;
}

function resolveRunCheck(
  ledgerPath: string,
  blockId: string,
  heading: string,
  description: string,
  execution: EvidenceLedgerExecution,
  repoRoot: string,
): ParsedEvidenceLedgerRunCheck {
  const command = formatEvidenceExecution(execution);
  const rawTargets = evidenceExecutionTargets(execution);
  const executionTargets = rawTargets.map(
    (t) => resolveTargetWithExtensionFallback(t, repoRoot) ?? t,
  );
  const missingTargets = executionTargets.filter((target) => !existsSync(join(repoRoot, target)));
  const codeTargets = new Set<string>();

  for (const target of executionTargets) {
    if (!existsSync(join(repoRoot, target))) {
      continue;
    }

    if (target === "scripts/evidence-ledger/helpers/contract-check.ts") {
      if (execution.kind !== "contract-check") continue;
      for (const codeRef of buildContractCheckContext(
        target,
        execution.target,
        execution.subcase,
        repoRoot,
      )) {
        codeTargets.add(codeRef);
      }
      continue;
    }

    if (target.startsWith("app/") && !target.includes("__tests__/") && !/\.test\./.test(target)) {
      codeTargets.add(target);
    }

    for (const importPath of collectImportedRepoPaths(target, repoRoot)) {
      codeTargets.add(importPath);
    }
  }

  return {
    id: blockId,
    heading,
    description,
    command,
    executionTargets,
    codeTargets: [...codeTargets].sort(),
    missingTargets,
  };
}

function buildLedgerDocumentFromGraph(
  ledger: EvidenceLedger,
  repoRoot: string,
): ParsedEvidenceLedgerDocument {
  const ledgerPath = relative(repoRoot, ledger.path).replace(/\\/g, "/");
  const checksByExecution = new Map<string, string[]>();
  for (const entry of ledger.acceptanceCheckEntries) {
    for (const executionRef of entry.executionRefs) {
      const assertions = checksByExecution.get(executionRef) ?? [];
      assertions.push(`${entry.key}: ${entry.evidence}`);
      checksByExecution.set(executionRef, assertions);
    }
  }
  return {
    path: ledgerPath,
    title: ledger.slug,
    sourcePromises: ledger.sourcePromises,
    sourceAspects: ledger.appliedAspects,
    foundational: false,
    hasTraceability: true,
    inReportJson: false,
    runChecks: ledger.executions.map((execution) =>
      resolveRunCheck(
        ledgerPath,
        `${ledgerPath}#${execution.id}`,
        execution.id,
        (checksByExecution.get(execution.id) ?? []).join("\n"),
        execution,
        repoRoot,
      ),
    ),
  };
}

export function loadAlignmentArtifacts(
  repoRoot: string,
  loadedChain?: StoryChain,
): ParsedAlignmentArtifacts {
  const resolvedRoot = resolve(repoRoot);
  const chain = loadedChain ?? loadStoryChain(resolvedRoot);
  const journeySourcePath = join(resolvedRoot, "docs/contracts/story-chain/scenario-catalog.md");
  const journeySource = existsSync(journeySourcePath)
    ? readFileSync(journeySourcePath, "utf8")
    : "";

  const { experiences, moments, promises, ledgerRows } = parseStoryChainArtifacts(
    chain,
    resolvedRoot,
  );
  const journeyScenarios = journeySource ? parseReactionScenarios(journeySource) : [];
  const scenarios = chain.scenarios.map((scenario) => ({ id: scenario.id }));
  const ledgers = chain.evidenceLedgers.map((ledger) =>
    buildLedgerDocumentFromGraph(ledger, resolvedRoot),
  );

  return {
    repoRoot: resolvedRoot,
    experiences,
    moments,
    promises,
    scenarios,
    journeyScenarios,
    ledgerRows,
    gapClaim: null,
    evidenceLedgers: ledgers,
  };
}
