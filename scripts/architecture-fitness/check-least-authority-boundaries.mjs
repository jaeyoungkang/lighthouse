#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import { defineGuardExceptions } from "../quality/guard-exception-policy.mjs";
import { findRepositoryTableCapabilityUses } from "../quality/repository-seam-policy.mjs";

const DEFAULT_ROOT = process.cwd();
const PRODUCTION_SOURCE_ROOTS = ["app", "packages"];
const ROOT_RUNTIME_FILES = [
  "proxy.ts",
  "middleware.ts",
  "instrumentation.ts",
  "instrumentation-client.ts",
];
export const LEAST_AUTHORITY_PRODUCTION_SCOPE_PATHS = [
  ...PRODUCTION_SOURCE_ROOTS,
  ...ROOT_RUNTIME_FILES,
];
const CURRENT_ADMIN_CLIENT_MODULE = "app/server/auth/supabase.ts";
const LEGACY_ADMIN_CLIENT_MODULE = "app/lib/supabase/server.ts";
const SESSION_AUTH_CLIENT_OWNER_CALLERS = new Set(["app/server/auth/identity.ts"]);
export const SESSION_AUTH_CLIENT_EXCEPTIONS = defineGuardExceptions(
  "guard:least-authority-boundaries",
  [
    {
      id: "supabase-auth-confirm-bootstrap",
      path: "app/auth/confirm/route.ts",
      reason:
        "Supabase callback must verify an OTP or exchange its one-time code before a session exists",
      owner: "Lighthouse server auth boundary",
      reviewWhen: "review when the Supabase callback or legacy session boundary is retired",
    },
    {
      id: "supabase-magic-link-bootstrap",
      path: "app/api/auth/magic-link/route.ts",
      reason: "magic-link issuance must call Supabase Auth before an authenticated session exists",
      owner: "Lighthouse server auth boundary",
      reviewWhen: "review when magic-link issuance moves behind a dedicated auth gateway",
    },
  ],
  { requiredMatchFields: ["path"] },
);
const SESSION_AUTH_CLIENT_EXCEPTION_BY_CALLER = new Map(
  SESSION_AUTH_CLIENT_EXCEPTIONS.map((exception) => [exception.path, exception]),
);
const ADMIN_CLIENT_CALLERS = new Set([
  "app/server/auth/identity.ts",
  "app/server/auth/app-user-snapshot.ts",
]);
const REPOSITORY_PREFIX = "app/server/repository/";
const REPOSITORY_DB_MODULE = "app/server/repository/db.ts";
const REPOSITORY_DB_HANDLE_MODULE = "app/lib/supabase/repository-db-handle.ts";
const REPOSITORY_DB_HANDLE_FACTORY = "createRepositoryDbHandle";
const REPOSITORY_DB_HANDLE_UNWRAPPER = "unwrapRepositoryDbHandle";
const REPOSITORY_DB_HANDLE_FACTORY_CALLERS = new Set(ADMIN_CLIENT_CALLERS);
const PAPER_INLINE_ANALYSIS_CACHE_REPOSITORY =
  "app/server/repository/paper-inline-analysis-cache.ts";
const RESTRICTED_REPOSITORY_RPC_CALLERS = new Map(
  [
    "list_paper_inline_analysis_cache",
    "claim_paper_inline_analysis_generation",
    "complete_paper_inline_analysis_generation",
    "release_paper_inline_analysis_generation",
  ].map((resource) => [resource, new Set([PAPER_INLINE_ANALYSIS_CACHE_REPOSITORY])]),
);
const ACCESS_ALLOWLIST_REPOSITORY = "app/server/repository/access-allowlist.ts";
const RESTRICTED_REPOSITORY_TABLE_CALLERS = new Map([
  ["access_allowlist_entries", new Set([ACCESS_ALLOWLIST_REPOSITORY])],
  ["paper_inline_analysis_cache", new Set()],
]);
const REVIEWED_PAPER_REPOSITORY = "app/server/repository/reviewed-papers.ts";
const REVIEWED_PAPER_REPOSITORY_SYMBOL_CALLERS = new Map([
  [
    "getReviewedStatus",
    new Set([
      "app/server/domain-access/graph-neighbor-hydration-access.ts",
      "app/server/domain-access/search-enrichment-access.ts",
    ]),
  ],
  ["listReviewedPapers", new Set(["app/server/domain-access/reviewed-paper-access.ts"])],
  ["markAsReviewed", new Set(["app/server/domain-access/reviewed-paper-access.ts"])],
  ["unmarkReviewed", new Set(["app/server/domain-access/reviewed-paper-access.ts"])],
]);
const REPOSITORY_RUNTIME_SYMBOL_CALLERS = new Map([
  [
    ACCESS_ALLOWLIST_REPOSITORY,
    new Map(
      [
        "getAccessAllowlistEntryUnchecked",
        "listAccessAllowlistEntriesUnchecked",
        "upsertAccessAllowlistEntryUnchecked",
        "deleteAccessAllowlistEntryUnchecked",
      ].map((symbol) => [symbol, new Set(["app/server/domain-access/access-allowlist-access.ts"])]),
    ),
  ],
  [
    "app/server/repository/app-users.ts",
    new Map([
      ["backfillOwnerPrincipalForEmail", new Set(["app/server/auth/app-user-snapshot.ts"])],
      ["upsertAppUserSnapshot", new Set(["app/server/auth/app-user-snapshot.ts"])],
    ]),
  ],
  [
    "app/server/repository/analytics-events.ts",
    new Map([
      [
        "createLocalJsonlAnalyticsEventStore",
        new Set(["app/server/domain-access/analytics-event-access.ts"]),
      ],
    ]),
  ],
  [
    "app/server/repository/error-logs.ts",
    new Map([["logError", new Set(["app/server/domain-access/error-access.ts"])]]),
  ],
  [
    "app/server/repository/gap-reports.ts",
    new Map([
      [
        "applyGapReportReactionPreference",
        new Set(["app/server/domain-access/gap-report-access.ts"]),
      ],
      [
        "createGapReportUnchecked",
        new Set(["app/server/domain-access/search-backed-knowledge-map-persistence.ts"]),
      ],
      [
        "reserveGapReportUnchecked",
        new Set(["app/server/domain-access/gap-network-view-access.ts"]),
      ],
      [
        "getGapReportReactionPreferenceUnchecked",
        new Set(["app/server/domain-access/gap-report-access.ts"]),
      ],
      [
        "getGapReportUnchecked",
        new Set([
          "app/server/domain-access/gap-network-build-state.ts",
          "app/server/domain-access/gap-network-view-access.ts",
          "app/server/domain-access/gap-report-access.ts",
          "app/server/domain-access/search-backed-knowledge-map-persistence.ts",
        ]),
      ],
      [
        "updateGapReportIfVersionUnchecked",
        new Set([
          "app/server/domain-access/gap-network-build-state.ts",
          "app/server/domain-access/search-backed-knowledge-map-persistence.ts",
        ]),
      ],
      [
        "updateGapReportReactionPreferenceIfVersionUnchecked",
        new Set(["app/server/domain-access/gap-report-access.ts"]),
      ],
    ]),
  ],
  [
    "app/server/repository/gap-build-principal-admissions.ts",
    new Map(
      ["claimGapBuildPrincipalAdmission", "releaseGapBuildPrincipalAdmission"].map((symbol) => [
        symbol,
        new Set(["app/server/domain-access/gap-build-principal-admission.ts"]),
      ]),
    ),
  ],
  [
    "app/server/repository/llm-usage-events.ts",
    new Map([
      ["insertLlmUsageEventUnchecked", new Set(["app/server/domain-access/llm-usage-access.ts"])],
    ]),
  ],
  [
    PAPER_INLINE_ANALYSIS_CACHE_REPOSITORY,
    new Map(
      [
        "listSharedPaperInlineAnalysisCache",
        "listSharedPaperInlineAnalysisGenerationStates",
        "claimSharedPaperInlineAnalysisGeneration",
        "completeSharedPaperInlineAnalysisGeneration",
        "failSharedPaperInlineAnalysisGeneration",
        "releaseSharedPaperInlineAnalysisGeneration",
        "terminalFailSharedPaperInlineAnalysisGeneration",
      ].map((symbol) => [symbol, new Set(["app/server/domain-access/inline-analysis-access.ts"])]),
    ),
  ],
  [REVIEWED_PAPER_REPOSITORY, REVIEWED_PAPER_REPOSITORY_SYMBOL_CALLERS],
]);
const REVIEWED_PAPER_ACCESS = "app/server/domain-access/reviewed-paper-access.ts";
const REVIEWED_PAPER_PUBLIC_FUNCTIONS = new Set([
  "listMyReviewedPapers",
  "resolveMyCachedReviewedPapersLibraryContextSource",
  "resolveMyReviewedPapersLibraryContextSource",
  "markMyReviewedPaper",
  "unmarkMyReviewedPaper",
]);
const RAW_AUTHORITY_PARAMETER_RE =
  /\b(?:db|userId|ownerPrincipalId|viewerPrincipalId|principalId)\b/;
function createSupabaseFactoryCallers(adminClientModule) {
  return new Map([
    ["@supabase/supabase-js", new Map([["*", new Set([adminClientModule])]])],
    [
      "@supabase/ssr",
      new Map([
        ["createServerClient", new Set([adminClientModule, "proxy.ts"])],
        ["createBrowserClient", new Set(["app/lib/supabase/client.ts"])],
      ]),
    ],
  ]);
}

const RESTRICTED_DOMAIN_SYMBOLS = new Map([
  [
    "app/server/auth/identity.ts",
    new Map([
      ["resolveCurrentProductAccessForEmail", new Set(["app/api/auth/magic-link/route.ts"])],
    ]),
  ],
  [
    "app/server/domain-access/access-allowlist-access.ts",
    new Map([
      ["resolveProductAccessForEmail", new Set(["app/server/auth/identity.ts"])],
      ["listInvitedAccessForAdmin", new Set(["app/(admin)/admin/access/page.tsx"])],
      ["updateInvitedAccessMembershipForAdmin", new Set(["app/(admin)/admin/access/actions.ts"])],
    ]),
  ],
  [
    "app/server/domain-access/analytics-event-access.ts",
    new Map([
      [
        "getAnalyticsEventRouterForTrustedServer",
        new Set([
          "app/server/domain-access/server-analytics.ts",
          "app/api/analytics-events/route.ts",
        ]),
      ],
    ]),
  ],
  [
    "app/server/domain-access/error-access.ts",
    new Map([
      ["recordRouteGuardError", new Set(["app/server/guards/route-guard.ts"])],
      [
        "recordRouteAiCommentGenerationErrorForTrustedAgent",
        new Set(["app/server/agent/route-ai-comment-generation.ts"]),
      ],
    ]),
  ],
  [
    "app/server/domain-access/gap-network-build-state.ts",
    new Map(
      [
        "markGapNetworkBuildAttemptStarted",
        "markGapNetworkBuildRetryQueued",
        "queueGapNetworkEnrichmentRetry",
        "persistGapNetworkBuildStateDetails",
        "markGapNetworkEnrichmentFailed",
        "markGapNetworkBuildFailed",
        "inspectGapNetworkEnrichmentRetryState",
      ].map((symbol) => [symbol, new Set(["app/server/domain-access/gap-network-view-access.ts"])]),
    ),
  ],
  [
    "app/server/domain-access/gap-build-principal-admission.ts",
    new Map([
      [
        "admitGapBuildForPrincipal",
        new Set([
          "app/api/gap-reports/route.ts",
          "app/server/domain-access/gap-network-view-access.ts",
        ]),
      ],
      [
        "releaseGapBuildForPrincipalSafely",
        new Set([
          "app/api/gap-reports/route.ts",
          "app/server/domain-access/gap-network-view-access.ts",
        ]),
      ],
    ]),
  ],
  [
    "app/server/domain-access/gap-network-view-access.ts",
    new Map([
      ["queueGapNetworkBuildRetryIfFailed", new Set(["app/api/gap-reports/route.ts"])],
      [
        "requestGapNetworkEnrichmentRetry",
        new Set(["app/api/gap-reports/[id]/enrichment-retry/route.ts"]),
      ],
      [
        "startGapNetworkBuildJob",
        new Set([
          "app/api/gap-reports/route.ts",
          "app/api/gap-reports/[id]/enrichment-retry/route.ts",
        ]),
      ],
    ]),
  ],
  [
    "app/server/domain-access/inline-analysis-access.ts",
    new Map([
      [
        "hydrateSearchMetadataWithCachedInlineAnalysis",
        new Set([
          "app/server/domain-access/search-enrichment-access.ts",
          "app/api/search/term-discovery/route.ts",
        ]),
      ],
      ["resolveInlineAnalysis", new Set(["app/api/papers/analyze-inline/route.ts"])],
      ["resolveInlineAnalysisForUser", new Set()],
    ]),
  ],
  [
    "app/server/domain-access/llm-usage-access.ts",
    new Map([
      [
        "recordLlmUsageEventBestEffortForTrustedAgent",
        new Set(["app/server/agent/route-ai-comment-generation.ts"]),
      ],
      ["recordLlmUsageEventForTrustedAgent", new Set()],
      [
        "createLlmJudgmentUsageLedgerForTrustedAgent",
        new Set([
          "app/server/domain-access/gap-network-view-access.ts",
          "app/server/domain-access/inline-analysis-access.ts",
          "app/server/domain-access/inline-analysis-generation.ts",
          "app/api/search/term-discovery/route.ts",
        ]),
      ],
    ]),
  ],
  [
    "app/server/domain-access/search-backed-knowledge-map-persistence.ts",
    new Map([
      [
        "persistSearchBackedKnowledgeMapDocument",
        new Set(["app/server/domain-access/gap-network-view-access.ts"]),
      ],
    ]),
  ],
]);

const DOMAIN_VALUE_EXPORT_SURFACES = new Map([
  [
    ACCESS_ALLOWLIST_REPOSITORY,
    new Set([
      "getAccessAllowlistEntryUnchecked",
      "listAccessAllowlistEntriesUnchecked",
      "upsertAccessAllowlistEntryUnchecked",
      "deleteAccessAllowlistEntryUnchecked",
    ]),
  ],
  [
    "app/server/domain-access/access-allowlist-access.ts",
    new Set([
      "resolveProductAccessForEmail",
      "listInvitedAccessForAdmin",
      "updateInvitedAccessMembershipForAdmin",
    ]),
  ],
  [
    PAPER_INLINE_ANALYSIS_CACHE_REPOSITORY,
    new Set([
      "listSharedPaperInlineAnalysisCache",
      "listSharedPaperInlineAnalysisGenerationStates",
      "claimSharedPaperInlineAnalysisGeneration",
      "completeSharedPaperInlineAnalysisGeneration",
      "failSharedPaperInlineAnalysisGeneration",
      "releaseSharedPaperInlineAnalysisGeneration",
      "terminalFailSharedPaperInlineAnalysisGeneration",
    ]),
  ],
  [
    "app/server/domain-access/analytics-event-access.ts",
    new Set(["getAnalyticsEventRouterForTrustedServer", "isPublicClientAnalyticsEventNameAllowed"]),
  ],
  [
    "app/server/domain-access/error-access.ts",
    new Set([
      "recordClientErrorReport",
      "recordRouteGuardError",
      "recordRouteAiCommentGenerationErrorForTrustedAgent",
    ]),
  ],
  [
    "app/server/domain-access/gap-network-build-state.ts",
    new Set([
      "GAP_NETWORK_BUILD_LEASE_MS",
      "isGapNetworkResearchRoutePayload",
      "runMeasuredPhase",
      "withBuildStateDetails",
      "markGapNetworkBuildAttemptStarted",
      "markGapNetworkBuildRetryQueued",
      "queueGapNetworkEnrichmentRetry",
      "inspectGapNetworkEnrichmentRetryState",
      "persistGapNetworkBuildStateDetails",
      "markGapNetworkEnrichmentFailed",
      "markGapNetworkBuildFailed",
    ]),
  ],
  [
    "app/server/domain-access/gap-build-principal-admission.ts",
    new Set([
      "GAP_BUILD_PRINCIPAL_ADMISSION_LEASE_SECONDS",
      "admitGapBuildForPrincipal",
      "releaseGapBuildForPrincipalSafely",
    ]),
  ],
  [
    "app/server/domain-access/gap-network-view-access.ts",
    new Set([
      "reserveGapNetworkViewFromSnapshot",
      "queueGapNetworkBuildRetryIfFailed",
      "requestGapNetworkEnrichmentRetry",
      "startGapNetworkBuildJob",
    ]),
  ],
  [
    "app/server/domain-access/inline-analysis-access.ts",
    new Set(["hydrateSearchMetadataWithCachedInlineAnalysis", "resolveInlineAnalysis"]),
  ],
  [
    "app/server/domain-access/llm-usage-access.ts",
    new Set([
      "recordLlmUsageEventBestEffortForTrustedAgent",
      "createLlmJudgmentUsageLedgerForTrustedAgent",
    ]),
  ],
  [
    "app/server/domain-access/search-backed-knowledge-map-persistence.ts",
    new Set(["persistSearchBackedKnowledgeMapDocument"]),
  ],
]);

function normalize(value) {
  return value.split(path.sep).join("/");
}

function lineOf(source, node) {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function isTestFile(file) {
  return (
    file.includes("/__tests__/") ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
    file.endsWith(".d.ts")
  );
}

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function resolveModule(root, importer, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(root, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(importer), specifier);
  else return null;

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.mjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (await exists(candidate)) return candidate;
  }
  return null;
}

function collectStaticStringDeclarations(source) {
  const declarations = new Map();
  const ambiguous = new Set();
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      if (declarations.has(node.name.text)) ambiguous.add(node.name.text);
      else declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const name of ambiguous) declarations.delete(name);
  return declarations;
}

function resolveStaticString(node, declarations, seen = new Set()) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return resolveStaticString(node.expression, declarations, seen);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = resolveStaticString(node.left, declarations, seen);
    const right = resolveStaticString(node.right, declarations, seen);
    return left === null || right === null ? null : `${left}${right}`;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = resolveStaticString(span.expression, declarations, seen);
      if (expression === null) return null;
      value += expression + span.literal.text;
    }
    return value;
  }
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) return null;
    const initializer = declarations.get(node.text);
    if (!initializer) return null;
    const nextSeen = new Set(seen);
    nextSeen.add(node.text);
    return resolveStaticString(initializer, declarations, nextSeen);
  }
  return null;
}

function importRecord(source, node, staticStringDeclarations) {
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
    if (!node.importClause || node.importClause.isTypeOnly) return null;
    const names = [];
    const localBindings = [];
    if (node.importClause.name) {
      names.push("default");
      localBindings.push({ imported: "default", local: node.importClause.name.text });
    }
    const namedBindings = node.importClause.namedBindings;
    if (namedBindings && ts.isNamespaceImport(namedBindings)) {
      names.push("*");
      localBindings.push({ imported: "*", local: namedBindings.name.text });
    }
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (!element.isTypeOnly) names.push(element.propertyName?.text ?? element.name.text);
        if (!element.isTypeOnly) {
          localBindings.push({
            imported: element.propertyName?.text ?? element.name.text,
            local: element.name.text,
          });
        }
      }
    }
    return {
      specifier: node.moduleSpecifier.text,
      names,
      bindings: localBindings,
      kind: "import",
      node,
    };
  }

  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    if (node.isTypeOnly) return null;
    const names = [];
    if (!node.exportClause) names.push("*");
    else if (ts.isNamespaceExport(node.exportClause)) names.push("*");
    else {
      for (const element of node.exportClause.elements) {
        if (!element.isTypeOnly) names.push(element.propertyName?.text ?? element.name.text);
      }
    }
    return { specifier: node.moduleSpecifier.text, names, bindings: [], kind: "re-export", node };
  }

  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1
  ) {
    const specifier = resolveStaticString(node.arguments[0], staticStringDeclarations);
    return {
      specifier,
      names: ["*"],
      bindings: [],
      kind: specifier === null ? "dynamic-import-unresolved" : "dynamic-import",
      node,
    };
  }

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "require" &&
    node.arguments.length === 1
  ) {
    const specifier = resolveStaticString(node.arguments[0], staticStringDeclarations);
    return {
      specifier,
      names: ["*"],
      bindings: [],
      kind: specifier === null ? "require-unresolved" : "require",
      node,
    };
  }

  return null;
}

async function collectSourceFiles(root) {
  const files = new Set();
  async function walk(target) {
    let targetStat;
    try {
      targetStat = await stat(target);
    } catch {
      return;
    }
    if (targetStat.isDirectory()) {
      if (["node_modules", ".next", "dist", "coverage"].includes(path.basename(target))) return;
      for (const entry of await readdir(target, { withFileTypes: true })) {
        await walk(path.join(target, entry.name));
      }
      return;
    }
    const relative = normalize(path.relative(root, target));
    if (!/\.[cm]?[jt]sx?$/.test(relative) || isTestFile(relative)) return;
    files.add(target);
  }
  for (const sourceRoot of PRODUCTION_SOURCE_ROOTS) {
    await walk(path.join(root, sourceRoot));
  }
  for (const rootFile of ROOT_RUNTIME_FILES) {
    await walk(path.join(root, rootFile));
  }
  return [...files].sort();
}

function checkReviewedPaperExports(source, file, relative, violations) {
  if (relative !== REVIEWED_PAPER_ACCESS) return;
  for (const statement of source.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (ts.isFunctionDeclaration(statement) && exported && statement.name) {
      const name = statement.name.text;
      if (!REVIEWED_PAPER_PUBLIC_FUNCTIONS.has(name)) {
        violations.push({
          rule: "reviewed-paper-export-surface",
          file: relative,
          line: lineOf(source, statement),
          detail: `unexpected exported function ${name}`,
        });
      }
      const parameters = statement.parameters
        .map((parameter) => parameter.getText(source))
        .join(" ");
      if (RAW_AUTHORITY_PARAMETER_RE.test(parameters)) {
        violations.push({
          rule: "reviewed-paper-raw-authority-parameter",
          file: relative,
          line: lineOf(source, statement),
          detail: `${name} exposes a raw authority parameter`,
        });
      }
    }
    if (ts.isVariableStatement(statement) && exported) {
      for (const declaration of statement.declarationList.declarations) {
        violations.push({
          rule: "reviewed-paper-export-surface",
          file: relative,
          line: lineOf(source, declaration),
          detail: `unexpected exported variable ${declaration.name.getText(source)}`,
        });
      }
    }
    if (ts.isExportDeclaration(statement)) {
      violations.push({
        rule: "reviewed-paper-export-surface",
        file: relative,
        line: lineOf(source, statement),
        detail: "reviewed-paper access must not re-export another module",
      });
    }
  }
}

function checkDomainValueExportSurface(source, relative, violations) {
  const allowedExports = DOMAIN_VALUE_EXPORT_SURFACES.get(relative);
  if (!allowedExports) return;
  for (const statement of source.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    const names = [];
    if (exported && ts.isFunctionDeclaration(statement) && statement.name) {
      names.push(statement.name.text);
    } else if (exported && ts.isVariableStatement(statement)) {
      names.push(
        ...statement.declarationList.declarations.map((declaration) =>
          declaration.name.getText(source),
        ),
      );
    } else if (
      exported &&
      (ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement))
    ) {
      if (statement.name) names.push(statement.name.getText(source));
    } else if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
      if (!statement.exportClause || ts.isNamespaceExport(statement.exportClause)) names.push("*");
      else {
        for (const element of statement.exportClause.elements) {
          if (!element.isTypeOnly) names.push(element.name.text);
        }
      }
    } else if (ts.isExportAssignment(statement)) {
      names.push("default");
    }
    for (const name of names) {
      if (!allowedExports.has(name)) {
        violations.push({
          rule: "privileged-domain-export-surface",
          file: relative,
          line: lineOf(source, statement),
          detail: `unregistered value export ${name}`,
        });
      }
    }
  }
}

function checkServiceRoleEnvironment(source, relative, violations, adminClientModule) {
  if (relative === adminClientModule) return;
  function visit(node) {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text === "SUPABASE_SERVICE_ROLE_KEY"
    ) {
      violations.push({
        rule: "service-role-environment-owner",
        file: relative,
        line: lineOf(source, node),
        detail: "service-role environment key is owned by the Supabase server factory",
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function checkRestrictedRepositoryInternalCapabilities(source, relative, violations) {
  if (!relative.startsWith(REPOSITORY_PREFIX)) return;

  for (const access of findRepositoryTableCapabilityUses(source.text, relative)) {
    if (access.capabilityName === "rpc" && access.resourceName == null) {
      violations.push({
        rule: "restricted-repository-dynamic-capability",
        file: relative,
        line: access.line,
        detail: "repository RPC resources must be statically named for exact ownership checks",
      });
      continue;
    }

    if (access.capabilityName === "rpc" && access.resourceName != null) {
      const allowedCallers = RESTRICTED_REPOSITORY_RPC_CALLERS.get(access.resourceName);
      if (allowedCallers && !allowedCallers.has(relative)) {
        violations.push({
          rule: "restricted-repository-rpc-caller",
          file: relative,
          line: access.line,
          detail: `${access.resourceName} is owned by ${PAPER_INLINE_ANALYSIS_CACHE_REPOSITORY}`,
        });
      }
      continue;
    }

    if (access.capabilityName === "from" && access.resourceName != null) {
      const allowedCallers = RESTRICTED_REPOSITORY_TABLE_CALLERS.get(access.resourceName);
      if (allowedCallers && !allowedCallers.has(relative)) {
        violations.push({
          rule: "restricted-repository-table-caller",
          file: relative,
          line: access.line,
          detail: `${access.resourceName} is accessible only through its security-definer repository RPCs`,
        });
      }
    }
  }
}

function checkRepositoryTableOwner(source, relative, violations) {
  if (relative.startsWith(REPOSITORY_PREFIX)) return;
  for (const access of findRepositoryTableCapabilityUses(source.text, relative)) {
    violations.push({
      rule: "repository-table-owner",
      file: relative,
      line: access.line,
      detail: `${access.capabilityName} table capability (${access.kind}) is owned by app/server/repository/`,
    });
  }
}

function checkRepositoryRuntimeImport(
  record,
  targetRelative,
  importerRelative,
  source,
  violations,
  options = {},
) {
  if (targetRelative === REPOSITORY_DB_HANDLE_MODULE) {
    const pushViolation = (name) => {
      violations.push({
        rule: "repository-db-capability-caller",
        file: importerRelative,
        line: lineOf(source, record.node),
        detail: `${record.kind} cannot acquire ${name} from ${targetRelative} for this caller`,
      });
    };
    if (record.kind !== "import" || record.names.includes("*")) {
      pushViolation(record.names.join(",") || "*");
      return;
    }
    for (const name of record.names) {
      const allowed =
        (name === REPOSITORY_DB_HANDLE_FACTORY &&
          REPOSITORY_DB_HANDLE_FACTORY_CALLERS.has(importerRelative)) ||
        (name === REPOSITORY_DB_HANDLE_UNWRAPPER && importerRelative === REPOSITORY_DB_MODULE);
      if (!allowed) pushViolation(name);
    }
    return;
  }
  if (!targetRelative.startsWith(REPOSITORY_PREFIX)) return;
  const rule =
    targetRelative === REPOSITORY_DB_MODULE
      ? "repository-db-capability-caller"
      : targetRelative === REVIEWED_PAPER_REPOSITORY
        ? "reviewed-paper-repository-caller"
        : record.kind === "re-export"
          ? "repository-runtime-re-export"
          : "repository-runtime-caller";
  const pushViolation = (name) => {
    violations.push({
      rule,
      file: importerRelative,
      line: lineOf(source, record.node),
      detail: `${record.kind} cannot acquire ${name} from ${targetRelative} for this caller`,
    });
  };

  if (record.kind !== "import" || record.names.includes("*")) {
    pushViolation(record.names.join(",") || "*");
    return;
  }

  for (const name of record.names) {
    const allowedHistoricalGapReservationImport =
      options.allowHistoricalGapReservationImports === true &&
      targetRelative === "app/server/repository/gap-reports.ts" &&
      importerRelative === "app/server/domain-access/gap-network-view-access.ts" &&
      ["createGapReportUnchecked", "getGapReportBySourceInputDigestUnchecked"].includes(name);
    const allowed =
      importerRelative.startsWith(REPOSITORY_PREFIX) ||
      allowedHistoricalGapReservationImport ||
      (targetRelative === REPOSITORY_DB_MODULE
        ? false
        : REPOSITORY_RUNTIME_SYMBOL_CALLERS.get(targetRelative)?.get(name)?.has(importerRelative));
    if (!allowed) pushViolation(name);
  }
}

function checkRestrictedDomainImport(record, targetRelative, importerRelative, source, violations) {
  const symbolRules = RESTRICTED_DOMAIN_SYMBOLS.get(targetRelative);
  if (!symbolRules) return;
  if (record.names.includes("*")) {
    violations.push({
      rule: "privileged-domain-namespace-acquisition",
      file: importerRelative,
      line: lineOf(source, record.node),
      detail: `${record.kind} can acquire restricted exports from ${targetRelative}`,
    });
    return;
  }
  for (const name of record.names) {
    const allowedCallers = symbolRules.get(name);
    if (allowedCallers && (record.kind !== "import" || !allowedCallers.has(importerRelative))) {
      violations.push({
        rule:
          record.kind === "re-export" ? "privileged-domain-re-export" : "privileged-domain-caller",
        file: importerRelative,
        line: lineOf(source, record.node),
        detail:
          record.kind === "re-export"
            ? `${name} from ${targetRelative} must not be re-exported`
            : `${name} from ${targetRelative} is not allowed for this caller`,
      });
    }
  }
}

function checkSupabaseFactoryImport(
  record,
  importerRelative,
  source,
  violations,
  supabaseFactoryCallers,
) {
  const factoryRules = supabaseFactoryCallers.get(record.specifier);
  if (!factoryRules) return;
  for (const name of record.names) {
    const allowedCallers = factoryRules.get(name) ?? factoryRules.get("*");
    if (allowedCallers && (record.kind !== "import" || !allowedCallers.has(importerRelative))) {
      violations.push({
        rule:
          name === "*"
            ? "supabase-factory-namespace-acquisition"
            : record.kind === "re-export"
              ? "supabase-factory-re-export"
              : "supabase-factory-caller",
        file: importerRelative,
        line: lineOf(source, record.node),
        detail:
          record.kind === "re-export"
            ? `${name} from ${record.specifier} must not be re-exported`
            : `${name} from ${record.specifier} is not allowed for this caller`,
      });
    }
  }
}

function checkSessionAuthClientImport(
  record,
  targetRelative,
  importerRelative,
  source,
  violations,
  matchedExceptionIds,
  adminClientModule,
) {
  if (
    targetRelative !== adminClientModule ||
    (!record.names.includes("createClient") && !record.names.includes("*"))
  ) {
    return;
  }

  const exception = SESSION_AUTH_CLIENT_EXCEPTION_BY_CALLER.get(importerRelative);
  const allowedCaller =
    record.kind === "import" &&
    !record.names.includes("*") &&
    (SESSION_AUTH_CLIENT_OWNER_CALLERS.has(importerRelative) || exception);
  if (allowedCaller && exception) matchedExceptionIds.add(exception.id);
  if (allowedCaller) return;

  violations.push({
    rule:
      record.kind === "re-export" ? "session-auth-client-re-export" : "session-auth-client-caller",
    file: importerRelative,
    line: lineOf(source, record.node),
    detail:
      record.kind === "re-export"
        ? "createClient must not be re-exported"
        : `${record.kind} can acquire createClient only as the auth owner or a declared bootstrap exception`,
  });
}

function privilegedImportedNames(
  record,
  targetRelative,
  adminClientModule,
  supabaseFactoryCallers,
) {
  const names = new Set();
  const addBindings = (restrictedNames) => {
    for (const binding of record.bindings ?? []) {
      if (restrictedNames.has(binding.imported) || binding.imported === "*") {
        names.add(binding.local);
      }
    }
  };

  const factoryRules = supabaseFactoryCallers.get(record.specifier);
  if (factoryRules?.has("*")) {
    for (const binding of record.bindings ?? []) names.add(binding.local);
  } else if (factoryRules) addBindings(new Set(factoryRules.keys()));
  if (targetRelative === adminClientModule) {
    addBindings(new Set(["createAdminClient", "createClient"]));
  }
  if (targetRelative === REPOSITORY_DB_HANDLE_MODULE) {
    addBindings(new Set([REPOSITORY_DB_HANDLE_FACTORY, REPOSITORY_DB_HANDLE_UNWRAPPER]));
  }
  if (targetRelative?.startsWith(REPOSITORY_PREFIX)) {
    for (const binding of record.bindings ?? []) names.add(binding.local);
  }
  const symbolRules = RESTRICTED_DOMAIN_SYMBOLS.get(targetRelative);
  if (symbolRules) addBindings(new Set(symbolRules.keys()));
  return names;
}

function propagatePrivilegedAliases(source, privilegedBindings) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const statement of source.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          ts.isIdentifier(declaration.initializer) &&
          privilegedBindings.has(declaration.initializer.text) &&
          !privilegedBindings.has(declaration.name.text)
        ) {
          privilegedBindings.add(declaration.name.text);
          changed = true;
        }
      }
    }
  }
}

function checkPrivilegedLocalForwarding(source, relative, privilegedBindings, violations) {
  if (privilegedBindings.size === 0) return;
  propagatePrivilegedAliases(source, privilegedBindings);
  for (const statement of source.statements) {
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const localName = element.propertyName?.text ?? element.name.text;
        if (privilegedBindings.has(localName)) {
          violations.push({
            rule: "privileged-local-forwarding",
            file: relative,
            line: lineOf(source, element),
            detail: `${localName} forwards an imported privileged capability`,
          });
        }
      }
    }
    if (
      ts.isExportAssignment(statement) &&
      ts.isIdentifier(statement.expression) &&
      privilegedBindings.has(statement.expression.text)
    ) {
      violations.push({
        rule: "privileged-local-forwarding",
        file: relative,
        line: lineOf(source, statement),
        detail: `${statement.expression.text} forwards an imported privileged capability`,
      });
    }
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          declaration.initializer &&
          ts.isIdentifier(declaration.initializer) &&
          privilegedBindings.has(declaration.initializer.text)
        ) {
          violations.push({
            rule: "privileged-local-forwarding",
            file: relative,
            line: lineOf(source, declaration),
            detail: `${declaration.initializer.text} forwards an imported privileged capability`,
          });
        }
      }
    }
  }
}

function checkAdminClientWrapping(
  source,
  relative,
  adminClientBindings,
  handleFactoryBindings,
  violations,
) {
  if (adminClientBindings.size === 0) return;

  function visit(node) {
    if (ts.isIdentifier(node) && adminClientBindings.has(node.text)) {
      const parent = node.parent;
      if (ts.isImportSpecifier(parent) || ts.isImportClause(parent)) return;

      const adminCall = ts.isCallExpression(parent) && parent.expression === node ? parent : null;
      const wrapperCall = adminCall?.parent;
      const wrappedInline =
        wrapperCall &&
        ts.isCallExpression(wrapperCall) &&
        ts.isIdentifier(wrapperCall.expression) &&
        handleFactoryBindings.has(wrapperCall.expression.text) &&
        wrapperCall.arguments.some((argument) => argument === adminCall);

      if (!wrappedInline) {
        violations.push({
          rule: "raw-service-role-client-exposure",
          file: relative,
          line: lineOf(source, node),
          detail: "createAdminClient must be called directly inside createRepositoryDbHandle",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

export async function runLeastAuthorityBoundaryGuard(options = {}) {
  const root = path.resolve(options.root ?? DEFAULT_ROOT);
  const allowAbsentExceptionMatches = options.allowAbsentExceptionMatches ?? false;
  const files = await collectSourceFiles(root);
  const relativeFiles = new Set(files.map((file) => normalize(path.relative(root, file))));
  const adminClientModule =
    relativeFiles.has(CURRENT_ADMIN_CLIENT_MODULE) ||
    options.allowHistoricalAdminClientModule !== true
      ? CURRENT_ADMIN_CLIENT_MODULE
      : LEGACY_ADMIN_CLIENT_MODULE;
  const supabaseFactoryCallers = createSupabaseFactoryCallers(adminClientModule);
  const gapReportRepositoryPath = path.join(root, "app/server/repository/gap-reports.ts");
  const gapReportRepositorySource = relativeFiles.has("app/server/repository/gap-reports.ts")
    ? await readFile(gapReportRepositoryPath, "utf8")
    : "";
  const allowHistoricalGapReservationImports =
    options.allowHistoricalGapReservationImports === true &&
    !gapReportRepositorySource.includes("reserveGapReportUnchecked");
  const violations = [];
  const matchedExceptionIds = new Set();

  for (const file of files) {
    const relative = normalize(path.relative(root, file));
    const contents = await readFile(file, "utf8");
    const source = ts.createSourceFile(
      file,
      contents,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    checkReviewedPaperExports(source, file, relative, violations);
    checkDomainValueExportSurface(source, relative, violations);
    checkServiceRoleEnvironment(source, relative, violations, adminClientModule);
    checkRestrictedRepositoryInternalCapabilities(source, relative, violations);
    checkRepositoryTableOwner(source, relative, violations);

    const records = [];
    const staticStringDeclarations = collectStaticStringDeclarations(source);
    function visit(node) {
      const record = importRecord(source, node, staticStringDeclarations);
      if (record) records.push(record);
      ts.forEachChild(node, visit);
    }
    visit(source);
    const privilegedBindings = new Set();
    const adminClientBindings = new Set();
    const handleFactoryBindings = new Set();

    for (const record of records) {
      if (record.names.length === 0) continue;
      if (record.specifier === null) {
        violations.push({
          rule: "non-static-module-acquisition",
          file: relative,
          line: lineOf(source, record.node),
          detail: `${record.kind} must use a statically resolvable module specifier`,
        });
        continue;
      }
      checkSupabaseFactoryImport(record, relative, source, violations, supabaseFactoryCallers);
      const resolved = await resolveModule(root, file, record.specifier);
      const targetRelative = resolved ? normalize(path.relative(root, resolved)) : null;
      for (const name of privilegedImportedNames(
        record,
        targetRelative,
        adminClientModule,
        supabaseFactoryCallers,
      )) {
        privilegedBindings.add(name);
      }
      if (!targetRelative) continue;

      if (record.kind === "import") {
        for (const binding of record.bindings ?? []) {
          if (targetRelative === adminClientModule && binding.imported === "createAdminClient") {
            adminClientBindings.add(binding.local);
          }
          if (
            targetRelative === REPOSITORY_DB_HANDLE_MODULE &&
            binding.imported === REPOSITORY_DB_HANDLE_FACTORY
          ) {
            handleFactoryBindings.add(binding.local);
          }
        }
      }

      if (
        targetRelative === adminClientModule &&
        (record.names.includes("createAdminClient") || record.names.includes("*")) &&
        (record.kind !== "import" ||
          record.names.includes("*") ||
          !ADMIN_CLIENT_CALLERS.has(relative))
      ) {
        violations.push({
          rule:
            record.kind === "re-export"
              ? "service-role-client-re-export"
              : "service-role-client-caller",
          file: relative,
          line: lineOf(source, record.node),
          detail:
            record.kind === "re-export"
              ? "createAdminClient must not be re-exported"
              : `${record.kind} can acquire createAdminClient outside server auth`,
        });
      }

      checkSessionAuthClientImport(
        record,
        targetRelative,
        relative,
        source,
        violations,
        matchedExceptionIds,
        adminClientModule,
      );
      checkRepositoryRuntimeImport(record, targetRelative, relative, source, violations, {
        allowHistoricalGapReservationImports,
      });
      checkRestrictedDomainImport(record, targetRelative, relative, source, violations);
    }
    checkAdminClientWrapping(
      source,
      relative,
      adminClientBindings,
      handleFactoryBindings,
      violations,
    );
    checkPrivilegedLocalForwarding(source, relative, privilegedBindings, violations);
  }
  for (const exception of SESSION_AUTH_CLIENT_EXCEPTIONS) {
    if (matchedExceptionIds.has(exception.id)) continue;
    if (allowAbsentExceptionMatches && !relativeFiles.has(exception.path)) continue;
    violations.push({
      rule: "stale-guard-exception",
      file: exception.path,
      line: 1,
      detail: `declared session-auth exception ${exception.id} did not match a runtime createClient import`,
    });
  }

  return { ok: violations.length === 0, filesScanned: files.length, violations };
}

async function main() {
  const allowHistoricalAdminClientModule = process.argv
    .slice(2)
    .includes("--allow-historical-admin-client-module");
  const result = await runLeastAuthorityBoundaryGuard({
    allowAbsentExceptionMatches: allowHistoricalAdminClientModule,
    allowHistoricalAdminClientModule,
  });
  if (!result.ok) {
    console.error("[guard:least-authority-boundaries] privileged capability bypasses found:");
    for (const violation of result.violations) {
      console.error(
        `- ${violation.file}:${violation.line} [${violation.rule}] ${violation.detail}`,
      );
    }
    process.exit(1);
  }
  console.log(
    `[guard:least-authority-boundaries] OK (${result.filesScanned} production modules scanned).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
