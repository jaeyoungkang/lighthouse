#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";

const ROOT = process.cwd();
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const COLLECTOR_REF = "scripts/architecture-fitness/collect-q4-technical-grain.mjs";
const TEST_REF = "scripts/architecture-fitness/__tests__/q4-technical-grain-boundaries.test.ts";
const TEST_CONFIG_REF = "scripts/architecture-fitness/q4-vitest.config.mts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
export const TRUSTED_GUARD_REFS = Object.freeze({
  externalHttp: "scripts/quality/check-external-http-gateway.mjs",
  aiGateway: "scripts/quality/check-ai-generation-gateway.mjs",
  repositorySeam: "scripts/quality/check-repository-db-seam.mjs",
  leastAuthority: "scripts/architecture-fitness/check-least-authority-boundaries.mjs",
});
const TRUSTED_GUARD_DEPENDENCY_REFS = Object.freeze([
  "scripts/quality/route-handler-files.mjs",
  "scripts/quality/repository-seam-policy.mjs",
  "scripts/quality/guard-exception-policy.mjs",
]);
export const COLLECTOR_DEFINITION_REFS = Object.freeze([
  COLLECTOR_REF,
  TEST_REF,
  TEST_CONFIG_REF,
  TRUST_POLICY_REF,
  ...Object.values(TRUSTED_GUARD_REFS),
  ...TRUSTED_GUARD_DEPENDENCY_REFS,
]);
const POLICY_REF = "issue-297:technical-grain-conformance";
const CAPABILITY_REF = "capability:lighthouse-effect-boundaries";
const ZERO_DIGEST = "0".repeat(64);
const HISTORICAL_OWNER_LAYOUT_REVISIONS = new Set([
  "b9ba8c42b484e933860f591c807f7b6f56f7c543",
  "e26b4ab8775a158c39c0090b2af6b7d480704d74",
]);

export function isHistoricalOwnerLayoutRevision(revision) {
  return HISTORICAL_OWNER_LAYOUT_REVISIONS.has(revision);
}

const PROVIDER_GATEWAY_REF = "app/server/external-http-gateway/literature-provider-fetch.ts";
const PROVIDER_BREAKER_REF = "app/server/external-http-gateway/episteme-circuit-breaker.ts";
const AI_GATEWAY_REF = "app/server/ai-generation/gateway.ts";
const CURRENT_JUDGMENT_REF = "app/server/ai-generation/judgment.ts";
const LEGACY_JUDGMENT_REF = "app/lib/llm-judgment.ts";
const OWNER_AUTH_REF = "app/server/auth/identity.ts";
const ROUTE_GUARD_REF = "app/server/guards/route-guard.ts";
const REVIEWED_ACCESS_REF = "app/server/domain-access/reviewed-paper-access.ts";
const REVIEWED_REPOSITORY_REF = "app/server/repository/reviewed-papers.ts";
const BACKGROUND_REF = "app/components/research/ResearchBackgroundTasks.tsx";
const BACKGROUND_INLINE_REF = "app/components/research/background-inline-analysis.ts";
const BACKGROUND_SEARCH_REF = "app/components/research/background-search-tasks.ts";
const BACKGROUND_GRAPH_REF = "app/components/research/background-graph-neighbor-hydration.ts";
const BACKGROUND_TERM_REF = "app/components/research/background-term-discovery.ts";
const LEGACY_BACKGROUND_INLINE_TRANSPORT_REF =
  "app/components/research-route-renderers/search-view.helpers.ts";
const BACKGROUND_INLINE_TRANSPORT_REFS = [
  BACKGROUND_INLINE_REF,
  LEGACY_BACKGROUND_INLINE_TRANSPORT_REF,
];
const BACKGROUND_REQUEST_REF = "app/lib/background-request.ts";
const BACKGROUND_CLIENT_REFS = [
  BACKGROUND_REF,
  BACKGROUND_INLINE_REF,
  BACKGROUND_SEARCH_REF,
  BACKGROUND_GRAPH_REF,
  BACKGROUND_TERM_REF,
  ...BACKGROUND_INLINE_TRANSPORT_REFS,
  BACKGROUND_REQUEST_REF,
];
const BACKGROUND_SERVER_BINDINGS = [
  {
    clientRef: BACKGROUND_SEARCH_REF,
    apiToken: "API_ROUTES.SEARCH_ENRICHMENT",
    routeRef: "app/api/search/enrichment/route.ts",
    ownerRef: "app/server/domain-access/search-enrichment-access.ts",
    ownerSymbol: "enrichSearchSnapshot",
    ownerSymbolRef: "app/server/domain-access/search-enrichment-access.ts",
  },
  {
    clientRef: BACKGROUND_TERM_REF,
    apiToken: "API_ROUTES.SEARCH_TERM_DISCOVERY",
    routeRef: "app/api/search/term-discovery/route.ts",
    ownerRef: "app/api/search/term-discovery/route.ts",
    ownerSymbol: "runSearchTermDiscoveryOnMetadata",
    ownerSymbolRef: "app/server/services/search-term-discovery.ts",
  },
  {
    clientRefs: BACKGROUND_INLINE_TRANSPORT_REFS,
    apiToken: "API_ROUTES.PAPERS_ANALYZE_INLINE",
    routeRef: "app/api/papers/analyze-inline/route.ts",
    ownerRef: "app/server/domain-access/inline-analysis-access.ts",
    ownerSymbol: "resolveInlineAnalysis",
    ownerSymbolRef: "app/server/domain-access/inline-analysis-access.ts",
  },
  {
    clientRef: BACKGROUND_GRAPH_REF,
    apiToken: "API_ROUTES.GRAPH_NEIGHBORS_HYDRATION",
    routeRef: "app/api/graph-neighbors/hydrate/route.ts",
    ownerRef: "app/server/domain-access/graph-neighbor-hydration-access.ts",
    ownerSymbol: "hydrateGraphNeighborSnapshot",
    ownerSymbolRef: "app/server/domain-access/graph-neighbor-hydration-access.ts",
  },
];

const SEAM_IDS = {
  provider: "seam:episteme-provider-gateway",
  ai: "seam:structured-ai-gateway",
  repository: "seam:reviewed-paper-domain-repository",
  background: "seam:client-background-server-effect",
};

function resolveBackgroundBindingClientRef(files, binding) {
  if (binding.clientRef) return binding.clientRef;
  const matchingRefs = binding.clientRefs.filter((ref) =>
    (files[ref] ?? "").includes(binding.apiToken),
  );
  return matchingRefs.length === 1 ? matchingRefs[0] : undefined;
}

const SCENARIO_IDS = {
  incident183: "scenario:incident-183-release-contract",
  pr229: "scenario:pr-229-ai-trust-contract",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalDigest(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function normalizeRef(file) {
  return file.split(path.sep).join("/");
}

function resolveJudgmentRef(files) {
  return files[CURRENT_JUDGMENT_REF] !== undefined ? CURRENT_JUDGMENT_REF : LEGACY_JUDGMENT_REF;
}

function isProductionTypeScript(ref) {
  return (
    ref.startsWith("app/") &&
    /\.(?:ts|tsx)$/.test(ref) &&
    !ref.includes("/__tests__/") &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(ref)
  );
}

const VIRTUAL_PROGRAM_ROOT = path.resolve(path.parse(ROOT).root, "__lighthouse_q4_target__");

function virtualFileName(ref) {
  return path.resolve(VIRTUAL_PROGRAM_ROOT, ref);
}

function sourceProgram(files) {
  const compilerOptions = {
    allowJs: false,
    baseUrl: VIRTUAL_PROGRAM_ROOT,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noLib: true,
    paths: { "@/*": ["*"] },
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  };
  const sources = new Map(
    Object.entries(files).map(([ref, source]) => [virtualFileName(ref), source]),
  );
  const virtualDirectories = new Set([VIRTUAL_PROGRAM_ROOT]);
  for (const fileName of sources.keys()) {
    let directory = path.dirname(fileName);
    while (
      directory === VIRTUAL_PROGRAM_ROOT ||
      directory.startsWith(`${VIRTUAL_PROGRAM_ROOT}${path.sep}`)
    ) {
      virtualDirectories.add(directory);
      if (directory === VIRTUAL_PROGRAM_ROOT) break;
      directory = path.dirname(directory);
    }
  }
  const baseHost = ts.createCompilerHost(compilerOptions, true);
  const host = {
    ...baseHost,
    directoryExists(directoryName) {
      return (
        virtualDirectories.has(path.resolve(directoryName)) ||
        baseHost.directoryExists?.(directoryName) === true
      );
    },
    fileExists(fileName) {
      return sources.has(path.resolve(fileName)) || baseHost.fileExists(fileName);
    },
    getDirectories(directoryName) {
      const directory = path.resolve(directoryName);
      const prefix = `${directory}${path.sep}`;
      const virtual = [...virtualDirectories]
        .filter((candidate) => candidate.startsWith(prefix))
        .map((candidate) => candidate.slice(prefix.length).split(path.sep)[0])
        .filter(Boolean);
      return uniqueSorted([...(baseHost.getDirectories?.(directoryName) ?? []), ...virtual]);
    },
    readFile(fileName) {
      return sources.get(path.resolve(fileName)) ?? baseHost.readFile(fileName);
    },
    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
      const source = sources.get(path.resolve(fileName));
      if (source !== undefined) {
        return ts.createSourceFile(
          fileName,
          source,
          languageVersion,
          true,
          fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
      }
      return baseHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    },
    getCurrentDirectory() {
      return VIRTUAL_PROGRAM_ROOT;
    },
    realpath(fileName) {
      const resolved = path.resolve(fileName);
      return sources.has(resolved) || virtualDirectories.has(resolved)
        ? resolved
        : (baseHost.realpath?.(fileName) ?? resolved);
    },
  };
  const program = ts.createProgram({
    rootNames: [...sources.keys()],
    options: compilerOptions,
    host,
  });
  return { checker: program.getTypeChecker(), program };
}

function targetRefFromSourceFile(sourceFile) {
  const relative = path.relative(VIRTUAL_PROGRAM_ROOT, path.resolve(sourceFile.fileName));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return normalizeRef(relative);
}

function resolveAliasedSymbol(checker, symbol) {
  let current = symbol;
  const seen = new Set();
  while (current && (current.flags & ts.SymbolFlags.Alias) !== 0 && !seen.has(current)) {
    seen.add(current);
    current = checker.getAliasedSymbol(current);
  }
  return current;
}

function symbolResolvesTo(context, node, symbolName, originRef) {
  const symbol = resolveAliasedSymbol(context.checker, context.checker.getSymbolAtLocation(node));
  return (
    symbol?.getName() === symbolName &&
    (symbol.declarations ?? []).some(
      (declaration) => targetRefFromSourceFile(declaration.getSourceFile()) === originRef,
    )
  );
}

function sourceContainsResolvedCall(context, ref, symbolName, originRef) {
  const syntax = context.program.getSourceFile(virtualFileName(ref));
  if (!syntax) return false;
  let found = false;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = ts.isPropertyAccessExpression(node.expression)
        ? node.expression.name
        : node.expression;
      if (symbolResolvesTo(context, callee, symbolName, originRef)) {
        found = true;
        return;
      }
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(syntax);
  return found;
}

function sourceImportsOrigin(context, ref, originRef) {
  const syntax = context.program.getSourceFile(virtualFileName(ref));
  if (!syntax) return false;
  for (const statement of syntax.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const candidates = [];
    if (statement.importClause?.name) candidates.push(statement.importClause.name);
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      candidates.push(
        ...bindings.elements
          .filter((element) => !element.isTypeOnly)
          .map((element) => element.name),
      );
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      candidates.push(bindings.name);
    }
    const moduleSymbol = context.checker.getSymbolAtLocation(statement.moduleSpecifier);
    if (
      (moduleSymbol?.declarations ?? []).some(
        (declaration) => targetRefFromSourceFile(declaration.getSourceFile()) === originRef,
      )
    ) {
      return true;
    }
    if (
      candidates.some((candidate) => {
        const symbol = resolveAliasedSymbol(
          context.checker,
          context.checker.getSymbolAtLocation(candidate),
        );
        return (symbol?.declarations ?? []).some(
          (declaration) => targetRefFromSourceFile(declaration.getSourceFile()) === originRef,
        );
      })
    ) {
      return true;
    }
  }
  return false;
}

function importedTargetRefs(context, ref) {
  const syntax = context.program.getSourceFile(virtualFileName(ref));
  if (!syntax) return [];
  const imported = [];
  for (const statement of syntax.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const symbol = context.checker.getSymbolAtLocation(statement.moduleSpecifier);
    for (const declaration of symbol?.declarations ?? []) {
      const importedRef = targetRefFromSourceFile(declaration.getSourceFile());
      if (importedRef) imported.push(importedRef);
    }
  }
  return uniqueSorted(imported);
}

function importedSpecifiers(context, ref) {
  const syntax = context.program.getSourceFile(virtualFileName(ref));
  if (!syntax) return [];
  return syntax.statements
    .filter(
      (statement) =>
        ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier),
    )
    .map((statement) => statement.moduleSpecifier.text);
}

function exportsGuardedPost(context, ref) {
  const syntax = context.program.getSourceFile(virtualFileName(ref));
  if (!syntax) return false;
  return syntax.statements.some(
    (statement) =>
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) &&
      statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "POST" &&
          declaration.initializer != null &&
          ts.isCallExpression(declaration.initializer) &&
          symbolResolvesTo(
            context,
            declaration.initializer.expression,
            "withRouteGuard",
            ROUTE_GUARD_REF,
          ),
      ),
  );
}

function productionImporters(context, files, moduleRef) {
  return uniqueSorted(
    Object.keys(files)
      .filter(isProductionTypeScript)
      .filter((ref) => sourceImportsOrigin(context, ref, moduleRef)),
  );
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

function observedSeam({
  id,
  seamRef,
  chokepointRefs,
  responsibilityRefs,
  callerRefs,
  bypassRefs,
  invariantRefs,
}) {
  return {
    id,
    seamRef,
    chokepointRefs: uniqueSorted(chokepointRefs),
    responsibilityRefs: uniqueSorted(responsibilityRefs),
    callerRefs: uniqueSorted(callerRefs),
    bypassRefs: uniqueSorted(bypassRefs),
    invariantRefs: uniqueSorted(invariantRefs),
  };
}

export function inspectTechnicalGrainSources(files, guardResults = {}) {
  const context = sourceProgram(files);
  const provider = files[PROVIDER_GATEWAY_REF] ?? "";
  const breaker = files[PROVIDER_BREAKER_REF] ?? "";
  const aiGateway = files[AI_GATEWAY_REF] ?? "";
  const judgmentRef = resolveJudgmentRef(files);
  const judgment = files[judgmentRef] ?? "";
  const reviewedAccess = files[REVIEWED_ACCESS_REF] ?? "";
  const reviewedRepository = files[REVIEWED_REPOSITORY_REF] ?? "";
  const background = files[BACKGROUND_REF] ?? "";
  const backgroundClientSources = Object.fromEntries(
    BACKGROUND_CLIENT_REFS.map((ref) => [ref, files[ref] ?? ""]),
  );
  const backgroundClientSource = Object.values(backgroundClientSources).join("\n");

  const providerImporters = productionImporters(context, files, PROVIDER_GATEWAY_REF);
  const allowedProviderImporters = new Map([
    ["app/server/services/episteme-literature.ts", "caller:episteme-literature"],
    ["app/server/services/episteme-paper-neighborhood.ts", "caller:episteme-paper-neighborhood"],
  ]);
  const providerBypasses = providerImporters
    .filter((ref) => !allowedProviderImporters.has(ref))
    .map((ref) => `bypass:raw-literature-http:${ref}`);
  if ((guardResults.externalHttp ?? 0) !== 0) {
    providerBypasses.push("bypass:raw-literature-http");
  }
  const providerHasGateway = includesAll(provider, [
    "export async function epistemeFetch",
    "export async function epistemePostFetch",
    "runThroughEpistemeBreaker",
  ]);
  const providerHasBreaker = includesAll(breaker, [
    "export async function runThroughEpistemeBreaker",
    "activeSlots",
    "slotWaiters",
  ]);
  const providerResponsibilities = [];
  if (provider.includes("getHeaders"))
    providerResponsibilities.push("responsibility:request-metadata");
  if (includesAll(provider, ["AbortController", "fetchWithTimeout"])) {
    providerResponsibilities.push("responsibility:timeout-and-abort");
  }
  if (provider.includes("shouldRetryEpistemeConnectError")) {
    providerResponsibilities.push("responsibility:bounded-connect-retry");
  }
  if (providerHasBreaker) {
    providerResponsibilities.push("responsibility:breaker-and-admission");
  }
  if (includesAll(provider, ["Promise<Response | null>", "catch"])) {
    providerResponsibilities.push("responsibility:failure-normalization");
  }

  const aiImporters = productionImporters(context, files, AI_GATEWAY_REF);
  const allowedAiImporters = new Map([
    [judgmentRef, "caller:execute-judgment"],
    ["app/server/agent/route-ai-comment-generation.ts", "caller:route-ai-comment-generation"],
  ]);
  const aiBypasses = aiImporters
    .filter((ref) => !allowedAiImporters.has(ref))
    .map((ref) => `bypass:direct-ai-provider-acquisition:${ref}`);
  if ((guardResults.aiGateway ?? 0) !== 0) {
    aiBypasses.push("bypass:direct-ai-provider-acquisition");
  }
  const aiHasGateway = includesAll(aiGateway, [
    "executeStructuredGenerationWithUsage",
    "generateText",
    "getGeminiClient",
  ]);
  const aiHasJudgment = includesAll(judgment, [
    "export async function executeJudgment",
    "executeStructuredGenerationWithUsage",
  ]);
  const aiResponsibilities = [];
  if (includesAll(aiGateway, ["getOpenAiProvider", "getGeminiClient"])) {
    aiResponsibilities.push("responsibility:provider-acquisition");
  }
  if (includesAll(aiGateway, ["createLinkedAbortSignal", "retryOptions: { attempts: 1 }"])) {
    aiResponsibilities.push("responsibility:deadline-and-no-retry");
  }
  if (includesAll(aiGateway, ["normalizeOpenAiUsage", "normalizeGeminiUsage"])) {
    aiResponsibilities.push("responsibility:usage-normalization");
  }
  if (includesAll(judgment, ["safeParse", "fallback", "usage"])) {
    aiResponsibilities.push("responsibility:judgment-parse-fallback-ledger");
  }

  const repositoryBypasses = [];
  if ((guardResults.repositorySeam ?? 0) !== 0) {
    repositoryBypasses.push("bypass:repository-outside-raw-db");
  }
  if ((guardResults.leastAuthority ?? 0) !== 0) {
    repositoryBypasses.push("bypass:route-or-service-to-repository");
  }
  const reviewedRepositoryImporters = productionImporters(context, files, REVIEWED_REPOSITORY_REF);
  const allowedReviewedRepositoryImporters = new Map([
    [
      "app/server/domain-access/graph-neighbor-hydration-access.ts",
      "caller:graph-neighbor-hydration-domain-access",
    ],
    ["app/server/domain-access/reviewed-paper-access.ts", "caller:reviewed-paper-domain-access"],
    [
      "app/server/domain-access/search-enrichment-access.ts",
      "caller:search-enrichment-domain-access",
    ],
  ]);
  repositoryBypasses.push(
    ...reviewedRepositoryImporters
      .filter((ref) => !allowedReviewedRepositoryImporters.has(ref))
      .map((ref) => `bypass:route-or-service-to-repository:${ref}`),
  );
  const accessHasSeam =
    sourceImportsOrigin(context, REVIEWED_ACCESS_REF, REVIEWED_REPOSITORY_REF) &&
    sourceContainsResolvedCall(
      context,
      REVIEWED_ACCESS_REF,
      "requireOwnerPrincipalAuth",
      OWNER_AUTH_REF,
    );
  const repositoryHasSeam = includesAll(reviewedRepository, [
    '"reviewed_papers"',
    "RepositoryDbHandle",
    "owner_principal_id",
  ]);
  const repositoryResponsibilities = [];
  if (
    sourceContainsResolvedCall(
      context,
      REVIEWED_ACCESS_REF,
      "requireOwnerPrincipalAuth",
      OWNER_AUTH_REF,
    ) &&
    reviewedAccess.includes("user.id")
  ) {
    repositoryResponsibilities.push("responsibility:principal-and-product-action");
  }
  if (reviewedAccess.includes("invalidate")) {
    repositoryResponsibilities.push("responsibility:cache-invalidation");
  }
  if (includesAll(reviewedRepository, ['from("reviewed_papers")', "parse"])) {
    repositoryResponsibilities.push("responsibility:table-query-and-row-mapping");
  }
  if (reviewedRepository.includes("owner_principal_id")) {
    repositoryResponsibilities.push("responsibility:owner-predicate");
  }

  const backgroundImporters = productionImporters(context, files, BACKGROUND_REF);
  const allowedBackgroundImporters = new Map([
    ["app/(research)/research-route-shell.tsx", "caller:research-route-shell"],
  ]);
  const backgroundBypasses = backgroundImporters
    .filter((ref) => !allowedBackgroundImporters.has(ref))
    .map((ref) => `bypass:client-background-owner:${ref}`);
  const backgroundImports = BACKGROUND_CLIENT_REFS.flatMap((ref) =>
    importedTargetRefs(context, ref),
  );
  const backgroundSpecifiers = BACKGROUND_CLIENT_REFS.flatMap((ref) =>
    importedSpecifiers(context, ref),
  );
  const clientImportsServer = backgroundImports.some((ref) => ref.startsWith("app/server/"));
  if (clientImportsServer) {
    backgroundBypasses.push("bypass:client-imports-server");
  }
  if (
    backgroundSpecifiers.some((specifier) =>
      /(?:@ai-sdk|@google\/genai|supabase|external-http-gateway)/.test(specifier),
    )
  ) {
    backgroundBypasses.push("bypass:client-acquires-provider-or-db");
  }
  const backgroundHasOwner = includesAll(background, [
    "export function ResearchBackgroundTasks",
    "AbortController",
  ]);
  const backgroundHasApiBoundary =
    BACKGROUND_SERVER_BINDINGS.every((binding) => {
      const clientRef = resolveBackgroundBindingClientRef(files, binding);
      return (
        clientRef !== undefined &&
        sourceContainsResolvedCall(
          context,
          clientRef,
          "fetchBackgroundRequest",
          BACKGROUND_REQUEST_REF,
        )
      );
    }) &&
    includesAll(files[BACKGROUND_REQUEST_REF] ?? "", [
      "export function fetchBackgroundRequest",
      "fetchWithSilenceTimeout",
    ]);
  const backgroundHasServerEffectOwnership = BACKGROUND_SERVER_BINDINGS.every(
    ({ ownerRef, ownerSymbol, ownerSymbolRef, routeRef }) => {
      const route = files[routeRef] ?? "";
      const owner = files[ownerRef] ?? "";
      const serverEffectSource = `${route}\n${owner}`;
      return (
        exportsGuardedPost(context, routeRef) &&
        sourceContainsResolvedCall(context, routeRef, ownerSymbol, ownerSymbolRef) &&
        (sourceContainsResolvedCall(
          context,
          routeRef,
          "requireOwnerPrincipalAuth",
          OWNER_AUTH_REF,
        ) ||
          sourceContainsResolvedCall(
            context,
            ownerRef,
            "requireOwnerPrincipalAuth",
            OWNER_AUTH_REF,
          )) &&
        /@\/app\/server\/(?:domain-access|services|repository|ai-generation|external-http-gateway)\//.test(
          serverEffectSource,
        )
      );
    },
  );
  const backgroundResponsibilities = [];
  if (background.includes("AbortController")) {
    backgroundResponsibilities.push("responsibility:client-cancellation");
  }
  if (includesAll(backgroundClientSource, ["activeExecutionId", "latestTask"])) {
    backgroundResponsibilities.push("responsibility:stale-completion-rejection");
  }
  if (backgroundHasApiBoundary && backgroundHasServerEffectOwnership && !clientImportsServer) {
    backgroundResponsibilities.push("responsibility:server-auth-and-effect");
  }
  const backgroundPreservesPrimaryResult =
    (files[BACKGROUND_INLINE_REF] ?? "").includes("hasSameInlineAnalysisInput") &&
    (files[BACKGROUND_SEARCH_REF] ?? "").includes("hasSameSearchSnapshotTarget") &&
    (files[BACKGROUND_GRAPH_REF] ?? "").includes("hasSameGraphNeighborSnapshotTarget") &&
    (files[BACKGROUND_TERM_REF] ?? "").includes("hasSameSearchSnapshotTarget");

  return [
    observedSeam({
      id: "observed-seam:episteme-provider-gateway",
      seamRef: SEAM_IDS.provider,
      chokepointRefs: [
        ...(providerHasGateway ? ["chokepoint:literature-provider-fetch"] : []),
        ...(providerHasBreaker ? ["chokepoint:episteme-circuit-breaker"] : []),
      ],
      responsibilityRefs: providerResponsibilities,
      callerRefs: providerImporters.map((ref) => allowedProviderImporters.get(ref)).filter(Boolean),
      bypassRefs: providerBypasses,
      invariantRefs: [
        ...(providerHasGateway ? ["invariant:provider-effect-behind-gateway"] : []),
        ...(providerHasBreaker ? ["invariant:episteme-self-protection"] : []),
        ...(providerResponsibilities.includes("responsibility:failure-normalization")
          ? ["invariant:bounded-provider-failure"]
          : []),
      ],
    }),
    observedSeam({
      id: "observed-seam:structured-ai-gateway",
      seamRef: SEAM_IDS.ai,
      chokepointRefs: [
        ...(aiHasGateway ? ["chokepoint:structured-generation-gateway"] : []),
        ...(aiHasJudgment ? ["chokepoint:execute-judgment"] : []),
      ],
      responsibilityRefs: aiResponsibilities,
      callerRefs: aiImporters.map((ref) => allowedAiImporters.get(ref)).filter(Boolean),
      bypassRefs: aiBypasses,
      invariantRefs: [
        ...(aiHasGateway ? ["invariant:provider-effect-behind-ai-gateway"] : []),
        ...(aiHasJudgment ? ["invariant:judgment-policy-separated"] : []),
        ...(aiResponsibilities.includes("responsibility:deadline-and-no-retry")
          ? ["invariant:bounded-structured-generation"]
          : []),
      ],
    }),
    observedSeam({
      id: "observed-seam:reviewed-paper-domain-repository",
      seamRef: SEAM_IDS.repository,
      chokepointRefs: [
        ...(accessHasSeam ? ["chokepoint:reviewed-paper-domain-access"] : []),
        ...(repositoryHasSeam ? ["chokepoint:reviewed-papers-repository"] : []),
      ],
      responsibilityRefs: repositoryResponsibilities,
      callerRefs: reviewedRepositoryImporters
        .map((ref) => allowedReviewedRepositoryImporters.get(ref))
        .filter(Boolean),
      bypassRefs: repositoryBypasses,
      invariantRefs: [
        ...(repositoryResponsibilities.includes("responsibility:principal-and-product-action")
          ? ["invariant:domain-access-owns-principal"]
          : []),
        ...(repositoryHasSeam ? ["invariant:repository-owns-storage"] : []),
        ...(sourceContainsResolvedCall(
          context,
          REVIEWED_ACCESS_REF,
          "requireOwnerPrincipalAuth",
          OWNER_AUTH_REF,
        ) &&
        reviewedAccess.includes("db") &&
        reviewedRepository.includes("RepositoryDbHandle")
          ? ["invariant:opaque-db-handle"]
          : []),
      ],
    }),
    observedSeam({
      id: "observed-seam:client-background-server-effect",
      seamRef: SEAM_IDS.background,
      chokepointRefs: [
        ...(backgroundHasOwner ? ["chokepoint:research-background-tasks"] : []),
        ...(backgroundHasApiBoundary ? ["chokepoint:purpose-api-route"] : []),
      ],
      responsibilityRefs: backgroundResponsibilities,
      callerRefs: backgroundImporters
        .map((ref) => allowedBackgroundImporters.get(ref))
        .filter(Boolean),
      bypassRefs: backgroundBypasses,
      invariantRefs: [
        ...(backgroundHasOwner && backgroundHasApiBoundary && backgroundHasServerEffectOwnership
          ? ["invariant:browser-lifetime-separated"]
          : []),
        ...(backgroundResponsibilities.includes("responsibility:stale-completion-rejection")
          ? ["invariant:stale-work-not-applied"]
          : []),
        ...(backgroundPreservesPrimaryResult ? ["invariant:primary-result-not-replaced"] : []),
      ],
    }),
  ];
}

const CHANGE_TRACE_RULES = {
  [SCENARIO_IDS.incident183]: {
    revision: "358c1269",
    changeClass: "contract",
    groups: {
      "propagation:operational-authority": [
        "docs/incident-183-load-baseline.md",
        "docs/runtime-flows/search-mechanism.md",
      ],
      "propagation:provider-gateway": [PROVIDER_GATEWAY_REF, PROVIDER_BREAKER_REF],
      "propagation:provider-callers": [
        "app/server/services/episteme-literature.ts",
        "app/server/services/episteme-paper-neighborhood.ts",
      ],
      "propagation:behavior-tests": [
        "app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts",
        "app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts",
      ],
      "propagation:structural-guard": ["scripts/quality/check-external-http-gateway.mjs"],
      "propagation:story-chain-contract": [
        "docs/contracts/story-chain/promises/search-results-fast-window.md",
        "docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.md",
      ],
    },
  },
  [SCENARIO_IDS.pr229]: {
    revision: "61a1110d",
    changeClass: "contract",
    groups: {
      "propagation:runtime-authority": ["docs/runtime-flows/ai-response-generation.md"],
      "propagation:ai-gateway": [AI_GATEWAY_REF],
      "propagation:ai-caller": [
        "app/server/agent/research-view-reaction-generation.ts",
        LEGACY_JUDGMENT_REF,
      ],
      "propagation:behavior-tests": [
        "app/server/ai-generation/__tests__/gateway.test.ts",
        "app/server/agent/__tests__/research-view-reaction-generation.test.ts",
      ],
      "propagation:story-chain-contract": [
        "docs/contracts/story-chain/promises/reaction-from-visible-snapshot.md",
        "docs/contracts/story-chain/evidence-ledgers/snapshot-reaction.ledger.md",
      ],
    },
  },
};

export function traceChangeFiles(scenarioRef, changedFiles) {
  const rule = CHANGE_TRACE_RULES[scenarioRef];
  if (!rule) throw new Error(`Unknown Q4 change scenario: ${scenarioRef}`);
  const changed = new Set(changedFiles);
  return {
    id: `observed-change:${scenarioRef.slice("scenario:".length)}`,
    scenarioRef,
    changeClass: rule.changeClass,
    propagationRefs: Object.entries(rule.groups)
      .filter(([, requiredFiles]) => requiredFiles.every((file) => changed.has(file)))
      .map(([ref]) => ref)
      .sort(),
    scopedFiles: uniqueSorted(
      Object.values(rule.groups)
        .flat()
        .filter((file) => changed.has(file)),
    ),
  };
}

function seamPayload(value) {
  return {
    seamRef: value.seamRef,
    chokepointRefs: value.chokepointRefs,
    responsibilityRefs: value.responsibilityRefs,
    callerRefs: value.callerRefs,
    bypassRefs: value.bypassRefs,
    invariantRefs: value.invariantRefs,
  };
}

function changePayload(value) {
  return {
    scenarioRef: value.scenarioRef,
    changeClass: value.changeClass,
    propagationRefs: value.propagationRefs,
  };
}

function git(args, { encoding = "utf8", input } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${result.status}`);
  }
  return result.stdout;
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-q4-revision-"));
  try {
    const archive = git(["archive", "--format=tar", revision], { encoding: null });
    const extracted = spawnSync("tar", ["-x", "-C", root], {
      input: archive,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    if (extracted.status !== 0) {
      throw new Error(extracted.stderr.trim() || `tar exited ${extracted.status}`);
    }
    // Q4 executes only collector-authority guards, tests, and dependencies.
    // The target tree is source input, so legitimate dependency-lock changes
    // must not prevent source-only collection.
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function readTreeFiles(root, relative = "app") {
  const files = {};
  const directory = path.join(root, relative);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const ref = normalizeRef(path.join(relative, entry.name));
    if (entry.isDirectory()) {
      Object.assign(files, await readTreeFiles(root, ref));
    } else if (/\.(?:ts|tsx)$/.test(entry.name)) {
      files[ref] = await readFile(path.join(root, ref), "utf8");
    }
  }
  return files;
}

function trustedEnvironment(extra = {}) {
  return {
    CI: "1",
    HOME: os.tmpdir(),
    LANG: process.env.LANG ?? "C.UTF-8",
    LC_ALL: process.env.LC_ALL ?? "C.UTF-8",
    NODE_ENV: "test",
    NO_COLOR: "1",
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    TMPDIR: os.tmpdir(),
    TZ: "UTC",
    ...extra,
  };
}

function runTrustedGuard(targetRoot, scriptRef, allowHistoricalOwnerLayout) {
  const historicalArgs =
    allowHistoricalOwnerLayout === true
      ? ({
          [TRUSTED_GUARD_REFS.externalHttp]: ["--allow-historical-outbound-owners"],
          [TRUSTED_GUARD_REFS.aiGateway]: ["--allow-historical-gemini-owner"],
          [TRUSTED_GUARD_REFS.leastAuthority]: ["--allow-historical-admin-client-module"],
        }[scriptRef] ?? [])
      : [];
  const result = spawnSync(process.execPath, [path.join(ROOT, scriptRef), ...historicalArgs], {
    cwd: targetRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: trustedEnvironment(),
  });
  return {
    exitCode: result.status ?? 1,
    stdout: String(result.stdout ?? "")
      .replaceAll(targetRoot, "<target-revision>")
      .replaceAll(ROOT, "<collector-authority>"),
    stderr: String(result.stderr ?? "")
      .replaceAll(targetRoot, "<target-revision>")
      .replaceAll(ROOT, "<collector-authority>"),
  };
}

function normalizeTestReport(result, targetRoot, expectedTests) {
  const normalize = (value) =>
    String(value ?? "")
      .replaceAll(targetRoot, "<target-revision>")
      .replaceAll(ROOT, "<collector-authority>");
  const sanitizedStdout = normalize(result.stdout);
  const sanitizedStderr = normalize(result.stderr);
  try {
    const report = JSON.parse(result.stdout);
    const testResults = (report.testResults ?? [])
      .map((testResult) => ({
        name: normalize(testResult.name),
        status: testResult.status,
        assertionResults: (testResult.assertionResults ?? [])
          .map((assertion) => ({
            fullName: assertion.fullName,
            status: assertion.status,
          }))
          .sort((left, right) => left.fullName.localeCompare(right.fullName)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
    const missingExpectedTests = expectedTests.filter(
      (relative) => !testResults.some((item) => item.name.endsWith(`/${relative}`)),
    );
    const allReportedTestsPassed =
      testResults.length === expectedTests.length &&
      testResults.every(
        (item) =>
          item.status === "passed" &&
          item.assertionResults.every((assertion) => assertion.status === "passed"),
      );
    return {
      exitCode:
        result.status === 0 && missingExpectedTests.length === 0 && allReportedTestsPassed ? 0 : 1,
      missingExpectedTests,
      numTotalTestSuites: report.numTotalTestSuites,
      numPassedTestSuites: report.numPassedTestSuites,
      numTotalTests: report.numTotalTests,
      numPassedTests: report.numPassedTests,
      testResults,
    };
  } catch {
    return {
      exitCode: 1,
      stdout: sanitizedStdout,
      stderr: sanitizedStderr || "Vitest did not produce a parseable JSON report.",
    };
  }
}

function executeTrustedPolicySuite(targetRoot) {
  const trustedConfig = path.join(ROOT, TEST_CONFIG_REF);
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    ["run", path.join(ROOT, TEST_REF), "--config", trustedConfig, "--reporter=json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: trustedEnvironment({
        AF_Q4_TARGET_ROOT: targetRoot,
        AF_Q4_TRUSTED_HARNESS_ROOT: ROOT,
      }),
    },
  );
  return normalizeTestReport(result, targetRoot, [TEST_REF]);
}

export function digestCollectorDefinitionSources(sourceByRef) {
  const definitions = COLLECTOR_DEFINITION_REFS.map((ref) => {
    const source = sourceByRef[ref];
    if (source === undefined) throw new Error(`missing collector definition source: ${ref}`);
    return { ref, digest: sha256(source) };
  });
  return canonicalDigest(definitions);
}

export async function collectorDefinitionDigest() {
  const sourceByRef = {};
  for (const ref of COLLECTOR_DEFINITION_REFS) {
    const file = ref === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, ref);
    sourceByRef[ref] = await readFile(file);
  }
  return digestCollectorDefinitionSources(sourceByRef);
}

function evidence({
  id,
  kind,
  role,
  source,
  revision,
  summary,
  command,
  exitCode,
  digest,
  runRef,
  target,
}) {
  return {
    id,
    kind,
    role,
    source,
    sourceRevision: revision,
    summary,
    freshness: "fresh",
    reproducible: true,
    command,
    commandExitCode: exitCode,
    artifactDigest: digest,
    collectorRunRef: runRef,
    target,
  };
}

export async function collectObservation({ policy, revision, runRef }) {
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const allowHistoricalOwnerLayout = isHistoricalOwnerLayoutRevision(revision);
  const definitionDigest = await collectorDefinitionDigest();
  if (authority.adapterRef !== COLLECTOR_REF) {
    throw new Error(`policy collector adapterRef must equal ${COLLECTOR_REF}`);
  }
  if (authority.definitionDigest !== definitionDigest) {
    throw new Error(
      `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
    );
  }
  git(["cat-file", "-e", `${revision}^{commit}`]);
  const targetRoot = await materializeRevision(revision);
  try {
    const files = await readTreeFiles(targetRoot);
    const judgmentRef = resolveJudgmentRef(files);
    const guardReports = Object.fromEntries(
      Object.entries(TRUSTED_GUARD_REFS).map(([name, script]) => [
        name,
        runTrustedGuard(targetRoot, script, allowHistoricalOwnerLayout),
      ]),
    );
    const seams = inspectTechnicalGrainSources(
      files,
      Object.fromEntries(
        Object.entries(guardReports).map(([name, report]) => [name, report.exitCode]),
      ),
    );
    const changes = [];
    for (const scenarioRef of Object.values(SCENARIO_IDS)) {
      const rule = CHANGE_TRACE_RULES[scenarioRef];
      git(["merge-base", "--is-ancestor", rule.revision, revision]);
      const changedFiles = git([
        "diff-tree",
        "--no-commit-id",
        "--name-only",
        "-r",
        `${rule.revision}^`,
        rule.revision,
      ])
        .split("\n")
        .filter(Boolean);
      changes.push(traceChangeFiles(scenarioRef, changedFiles));
    }
    const tests = executeTrustedPolicySuite(targetRoot);
    if (tests.exitCode !== 0) {
      process.stderr.write(
        `Q4 trusted policy evidence failed:\n${JSON.stringify(tests, null, 2)}\n`,
      );
    }
    const testsDigest = canonicalDigest(tests);
    const inventory = {
      seams,
      changes,
      guards: guardReports,
      sourceDigests: Object.fromEntries(
        [
          PROVIDER_GATEWAY_REF,
          PROVIDER_BREAKER_REF,
          AI_GATEWAY_REF,
          judgmentRef,
          REVIEWED_ACCESS_REF,
          REVIEWED_REPOSITORY_REF,
          ...BACKGROUND_CLIENT_REFS,
          ...BACKGROUND_SERVER_BINDINGS.flatMap(({ ownerRef, routeRef }) => [routeRef, ownerRef]),
        ].map((ref) => [ref, sha256(files[ref] ?? "")]),
      ),
    };
    const inventoryDigest = canonicalDigest(inventory);
    const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-297-q4-technical-grain.policy.json --revision ${revision} --run-ref ${runRef}`;
    const testCommand = `node_modules/.bin/vitest run <collector-authority>/${TEST_REF} --config <collector-authority>/${TEST_CONFIG_REF} --reporter=json`;
    const evidenceItems = [
      evidence({
        id: "technical-grain-coverage-static:issue-297",
        kind: "static",
        role: "technical-grain-coverage-static",
        source: COLLECTOR_REF,
        revision,
        summary: "The inventory contains all four declared seams and both change scenarios.",
        command,
        exitCode: 0,
        digest: inventoryDigest,
        runRef,
        target: {
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          seamRefs: seams.map((item) => item.seamRef),
          changeScenarioRefs: changes.map((item) => item.scenarioRef),
          factRefs: ["coverage:all-technical-grain-objects"],
        },
      }),
      evidence({
        id: "technical-grain-coverage-negative-guard:issue-297",
        kind: "test",
        role: "technical-grain-coverage-negative-guard",
        source: TEST_REF,
        revision,
        summary:
          "The collector-authority source-policy harness rejects undeclared callers, missing owner responsibilities, raw persistence bypasses, client/server collapse, and incomplete change traces without executing target code.",
        command: testCommand,
        exitCode: tests.exitCode,
        digest: testsDigest,
        runRef,
        target: {
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          seamRefs: seams.map((item) => item.seamRef),
          changeScenarioRefs: changes.map((item) => item.scenarioRef),
          factRefs: ["coverage:technical-grain-negative-guard"],
        },
      }),
    ];

    for (const seam of seams) {
      const seamFact = `seam-observation-sha256:${canonicalDigest(seamPayload(seam))}`;
      evidenceItems.push(
        evidence({
          id: `technical-grain-seam-static:${seam.seamRef.slice("seam:".length)}`,
          kind: "static",
          role: "technical-grain-seam-static",
          source: COLLECTOR_REF,
          revision,
          summary: `Exact-revision static inventory for ${seam.seamRef}.`,
          command,
          exitCode: 0,
          digest: inventoryDigest,
          runRef,
          target: {
            policyRef: POLICY_REF,
            capabilityRef: CAPABILITY_REF,
            seamRefs: [seam.seamRef],
            changeScenarioRefs: [],
            factRefs: [seamFact, "structure:seam-observed"],
          },
        }),
        evidence({
          id: `technical-grain-behavior-test:${seam.seamRef.slice("seam:".length)}`,
          kind: "test",
          role: "technical-grain-behavior-test",
          source: TEST_REF,
          revision,
          summary: `Collector-authority source and negative-policy tests exercise ${seam.seamRef} without loading materialized comparison modules.`,
          command: testCommand,
          exitCode: tests.exitCode,
          digest: testsDigest,
          runRef,
          target: {
            policyRef: POLICY_REF,
            capabilityRef: CAPABILITY_REF,
            seamRefs: [seam.seamRef],
            changeScenarioRefs: [],
            factRefs: [seamFact, "behavior:invariants-observed"],
          },
        }),
      );
    }

    for (const change of changes) {
      const changeFact = `change-observation-sha256:${canonicalDigest(changePayload(change))}`;
      evidenceItems.push(
        evidence({
          id: `technical-grain-change-trace:${change.scenarioRef.slice("scenario:".length)}`,
          kind: "static",
          role: "technical-grain-change-trace",
          source: CHANGE_TRACE_RULES[change.scenarioRef].revision,
          revision,
          summary: `Bounded historical trace for ${change.scenarioRef}.`,
          command: `git diff-tree --no-commit-id --name-only -r ${CHANGE_TRACE_RULES[change.scenarioRef].revision}^ ${CHANGE_TRACE_RULES[change.scenarioRef].revision}`,
          exitCode: 0,
          digest: canonicalDigest(change),
          runRef,
          target: {
            policyRef: POLICY_REF,
            capabilityRef: CAPABILITY_REF,
            seamRefs: [],
            changeScenarioRefs: [change.scenarioRef],
            factRefs: [changeFact, "change:propagation-observed"],
          },
        }),
      );
    }

    const seamEvidenceRefs = Object.fromEntries(
      seams.map((seam) => [
        seam.seamRef,
        [
          `technical-grain-seam-static:${seam.seamRef.slice("seam:".length)}`,
          `technical-grain-behavior-test:${seam.seamRef.slice("seam:".length)}`,
        ],
      ]),
    );
    const changeEvidenceRefs = Object.fromEntries(
      changes.map((change) => [
        change.scenarioRef,
        [`technical-grain-change-trace:${change.scenarioRef.slice("scenario:".length)}`],
      ]),
    );

    return {
      schemaVersion: "2",
      kind: "architecture-fitness-observation",
      serviceId: policy.service.id,
      policySetRef: policy.policySet.id,
      policySetVersion: policy.policySet.version,
      policyDigest: canonicalDigest(policy),
      revision,
      collector: {
        adapterRef: authority.adapterRef,
        id: authority.id,
        version: authority.version,
        scope: authority.scope,
        definitionDigest,
        attestorRef: authority.attestorRef,
        runRef,
        command,
        attestation: {
          algorithm: "hmac-sha256",
          keyRef: authority.attestationKeyRef,
          payloadDigest: ZERO_DIGEST,
          signature: ZERO_DIGEST,
        },
      },
      evidence: evidenceItems,
      observations: [
        {
          id: "observation:issue-297-q4-technical-grain",
          policyRef: POLICY_REF,
          capabilityRef: CAPABILITY_REF,
          completeness: "complete",
          coverageEvidenceRefs: [
            "technical-grain-coverage-static:issue-297",
            "technical-grain-coverage-negative-guard:issue-297",
          ],
          seams: seams.map((seam) => ({
            ...seam,
            evidenceRefs: seamEvidenceRefs[seam.seamRef],
          })),
          changeScenarios: changes.map((change) => ({
            id: change.id,
            scenarioRef: change.scenarioRef,
            changeClass: change.changeClass,
            propagationRefs: change.propagationRefs,
            evidenceRefs: changeEvidenceRefs[change.scenarioRef],
          })),
        },
      ],
    };
  } finally {
    await rm(targetRoot, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!["--policy", "--revision", "--run-ref", "--output"].includes(value)) {
      throw new Error(`Unknown argument: ${value}`);
    }
    options[value.slice(2)] = argv[index + 1];
    index += 1;
  }
  for (const required of ["policy", "revision", "run-ref", "output"]) {
    if (!options[required]) throw new Error(`Missing --${required}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectObservation({
    policy,
    revision: options.revision,
    runRef: options["run-ref"],
  });
  await writeFile(
    path.resolve(options.output),
    `${JSON.stringify(observation, null, 2)}\n`,
    "utf8",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
