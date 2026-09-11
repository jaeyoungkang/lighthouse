#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

export const SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES = {
  owner: "app/lib/search-condition-url-budget.ts",
  routeBuilders: "app/lib/api-routes.ts",
  searchParser: "app/server/services/search-execution.ts",
  relationshipParser: "app/server/services/relationship-execution.ts",
  searchRoute: "app/(research)/search-route-page.tsx",
  relationshipRoute: "app/(research)/relationship-route-page.tsx",
};

const STRICT_BUILDERS = new Set([
  "searchRoutePageRoute",
  "citationSeedPageRoute",
  "similarSeedPageRoute",
]);
const DIRECT_ROUTE_PATTERN = /^\/(?:search|citation|similar)\?/;
const SAFE_BUILDERS = [
  "buildSearchRoutePageRoute",
  "buildCitationSeedPageRoute",
  "buildSimilarSeedPageRoute",
];
const RAW_QUERY_BUILDERS = new Set([
  ...SAFE_BUILDERS,
  "buildSearchTermFollowupRoute",
  "commitRouteSearch",
  "onViewFilterReplace",
]);

function parseSource(relative, source) {
  const scriptKind = relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, scriptKind);
}

function directConditionRoutePrefix(node, constInitializers = new Map(), visited = new Set()) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text;
  if (ts.isIdentifier(node) && !visited.has(node.text)) {
    const initializer = constInitializers.get(node.text);
    if (!initializer) return "";
    return directConditionRoutePrefix(
      initializer,
      constInitializers,
      new Set([...visited, node.text]),
    );
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return directConditionRoutePrefix(node.left, constInitializers, visited);
  }
  if (
    ts.isNewExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "URL" &&
    node.arguments?.[0]
  ) {
    return directConditionRoutePrefix(node.arguments[0], constInitializers, visited);
  }
  return "";
}

function owningCallName(node) {
  let current = node.parent;
  while (current && !ts.isCallExpression(current)) current = current.parent;
  if (!current) return null;
  if (ts.isIdentifier(current.expression)) return current.expression.text;
  if (ts.isPropertyAccessExpression(current.expression)) return current.expression.name.text;
  return null;
}

function functionBody(sourceFile, name) {
  const declaration = sourceFile.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  return declaration?.body?.getText(sourceFile) ?? "";
}

function appearsBefore(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
}

function containsThrowingSafeBuilderWrapper(sourceFile, safeBuilderNames = SAFE_BUILDERS) {
  let found = false;
  const visit = (node) => {
    if (found) return;
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node) ||
        ts.isMethodDeclaration(node)) &&
      node.body
    ) {
      const body = node.body.getText(sourceFile);
      if (body.includes("throw ") && safeBuilderNames.some((name) => body.includes(name))) {
        found = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

async function listProductionSources(root) {
  const appRoot = path.join(root, "app");
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "(admin)") continue;
        await visit(absolute);
        continue;
      }
      if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) {
        continue;
      }
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (relative.startsWith("app/i18n/messages/commitment")) {
        continue;
      }
      files.push(relative);
    }
  }
  await visit(appRoot);
  return files;
}

async function checkDirectBuilderBypass(root) {
  const violations = [];
  for (const relative of await listProductionSources(root)) {
    const source = await readFile(path.join(root, relative), "utf8");
    const sourceFile = parseSource(relative, source);
    const trimmedAliasesByScope = new Map();
    const trimInitializersByScope = new Map();
    const constInitializers = new Map();
    const aliasScope = (node) => {
      let current = node;
      while (current.parent && !ts.isFunctionLike(current) && !ts.isSourceFile(current)) {
        current = current.parent;
      }
      return current;
    };
    const aliasesFor = (scope) => {
      const aliases = trimmedAliasesByScope.get(scope) ?? new Set();
      trimmedAliasesByScope.set(scope, aliases);
      return aliases;
    };
    const initializersFor = (scope) => {
      const initializers = trimInitializersByScope.get(scope) ?? new Map();
      trimInitializersByScope.set(scope, initializers);
      return initializers;
    };
    const collectTrimmedAliases = (node, scope = sourceFile) => {
      const currentScope = ts.isFunctionLike(node) ? node : scope;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        constInitializers.set(node.name.text, node.initializer);
        initializersFor(currentScope).set(node.name.text, node.initializer);
        if (
          ts.isCallExpression(node.initializer) &&
          ts.isPropertyAccessExpression(node.initializer.expression) &&
          node.initializer.expression.name.text === "trim"
        ) {
          aliasesFor(currentScope).add(node.name.text);
        }
      }
      ts.forEachChild(node, (child) => collectTrimmedAliases(child, currentScope));
    };
    collectTrimmedAliases(sourceFile);
    for (const [scope, initializers] of trimInitializersByScope) {
      const aliases = aliasesFor(scope);
      let discoveredTrimmedAlias = true;
      while (discoveredTrimmedAlias) {
        discoveredTrimmedAlias = false;
        for (const [name, initializer] of initializers) {
          if (!aliases.has(name) && ts.isIdentifier(initializer) && aliases.has(initializer.text)) {
            aliases.add(name);
            discoveredTrimmedAlias = true;
          }
        }
      }
    }
    const acquiredSafeBuilderNames = new Set(SAFE_BUILDERS);
    const namespaceObjects = new Set();
    for (const statement of sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === "@/app/lib/api-routes"
      ) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text;
            if (SAFE_BUILDERS.includes(importedName)) {
              acquiredSafeBuilderNames.add(element.name.text);
            }
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          namespaceObjects.add(bindings.name.text);
        }
      }
    }
    let discoveredAlias = true;
    while (discoveredAlias) {
      discoveredAlias = false;
      for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          if (!declaration.initializer) continue;
          if (ts.isIdentifier(declaration.name)) {
            const initializer = declaration.initializer;
            if (
              ts.isIdentifier(initializer) &&
              namespaceObjects.has(initializer.text) &&
              !namespaceObjects.has(declaration.name.text)
            ) {
              namespaceObjects.add(declaration.name.text);
              discoveredAlias = true;
            }
            const aliasesSafeBuilder =
              (ts.isIdentifier(initializer) && acquiredSafeBuilderNames.has(initializer.text)) ||
              (ts.isPropertyAccessExpression(initializer) &&
                ts.isIdentifier(initializer.expression) &&
                namespaceObjects.has(initializer.expression.text) &&
                SAFE_BUILDERS.includes(initializer.name.text));
            if (aliasesSafeBuilder && !acquiredSafeBuilderNames.has(declaration.name.text)) {
              acquiredSafeBuilderNames.add(declaration.name.text);
              discoveredAlias = true;
            }
          } else if (
            ts.isObjectBindingPattern(declaration.name) &&
            ts.isIdentifier(declaration.initializer) &&
            namespaceObjects.has(declaration.initializer.text)
          ) {
            for (const element of declaration.name.elements) {
              if (!ts.isIdentifier(element.name)) continue;
              const propertyName = element.propertyName?.getText(sourceFile) ?? element.name.text;
              if (
                SAFE_BUILDERS.includes(propertyName) &&
                !acquiredSafeBuilderNames.has(element.name.text)
              ) {
                acquiredSafeBuilderNames.add(element.name.text);
                discoveredAlias = true;
              }
            }
          }
        }
      }
    }
    const acquiredSafeBuilderNameList = [...acquiredSafeBuilderNames];
    const isSafeBuilderCall = (node) =>
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && acquiredSafeBuilderNames.has(node.expression.text)) ||
        (ts.isPropertyAccessExpression(node.expression) &&
          SAFE_BUILDERS.includes(node.expression.name.text)));
    const containsSafeBuilderCall = (node) => {
      let found = false;
      const inspect = (current) => {
        if (isSafeBuilderCall(current)) {
          found = true;
          return;
        }
        if (!found) ts.forEachChild(current, inspect);
      };
      inspect(node);
      return found;
    };
    const rootIdentifierName = (node) => {
      if (ts.isIdentifier(node)) return node.text;
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        return rootIdentifierName(node.expression);
      }
      return null;
    };
    const containsThrow = (node) => {
      let found = false;
      const inspect = (current) => {
        if (ts.isThrowStatement(current)) {
          found = true;
          return;
        }
        if (!found) ts.forEachChild(current, inspect);
      };
      inspect(node);
      return found;
    };
    const callableBodies = new Map();
    const safeResultAliases = new Set();
    const collectResultFlow = (node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        callableBodies.set(node.name.text, node.body);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          callableBodies.set(node.name.text, node.initializer.body);
        }
        if (containsSafeBuilderCall(node.initializer)) safeResultAliases.add(node.name.text);
      }
      ts.forEachChild(node, collectResultFlow);
    };
    collectResultFlow(sourceFile);
    let discoveredResultAlias = true;
    while (discoveredResultAlias) {
      discoveredResultAlias = false;
      for (const [name, initializer] of constInitializers) {
        if (
          !safeResultAliases.has(name) &&
          safeResultAliases.has(rootIdentifierName(initializer) ?? "")
        ) {
          safeResultAliases.add(name);
          discoveredResultAlias = true;
        }
      }
    }
    const throwingHelperNames = new Set(
      [...callableBodies].filter(([, body]) => containsThrow(body)).map(([name]) => name),
    );
    let discoveredThrowingHelper = true;
    while (discoveredThrowingHelper) {
      discoveredThrowingHelper = false;
      for (const [name, body] of callableBodies) {
        if (throwingHelperNames.has(name)) continue;
        let callsThrowingHelper = false;
        const inspectCalls = (node) => {
          if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            throwingHelperNames.has(node.expression.text)
          ) {
            callsThrowingHelper = true;
            return;
          }
          if (!callsThrowingHelper) ts.forEachChild(node, inspectCalls);
        };
        inspectCalls(body);
        if (callsThrowingHelper) {
          throwingHelperNames.add(name);
          discoveredThrowingHelper = true;
        }
      }
    }
    if (containsThrowingSafeBuilderWrapper(sourceFile, acquiredSafeBuilderNameList)) {
      violations.push({
        rule: "direct-builder-bypass",
        file: relative,
        detail: "production wrapper turns a safe condition builder rejection into a throw",
      });
    }
    const visit = (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        (node.name.getText(sourceFile) === "q" || node.name.getText(sourceFile) === "query") &&
        RAW_QUERY_BUILDERS.has(owningCallName(node) ?? "") &&
        ((ts.isIdentifier(node.initializer) &&
          aliasesFor(aliasScope(node)).has(node.initializer.text)) ||
          (ts.isCallExpression(node.initializer) &&
            ts.isPropertyAccessExpression(node.initializer.expression) &&
            node.initializer.expression.name.text === "trim"))
      ) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: "production passes a normalized query into a condition builder",
        });
      }
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        ((ts.isIdentifier(node.initializer) &&
          acquiredSafeBuilderNames.has(node.initializer.text)) ||
          (ts.isPropertyAccessExpression(node.initializer) &&
            SAFE_BUILDERS.includes(node.initializer.name.text)))
      ) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: "production stores a safe condition builder as an alias",
        });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        throwingHelperNames.has(node.expression.text) &&
        node.arguments.some(
          (argument) =>
            isSafeBuilderCall(argument) ||
            safeResultAliases.has(rootIdentifierName(argument) ?? ""),
        )
      ) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: "production passes a safe condition result into a throwing helper",
        });
      }
      if ((ts.isIdentifier(node) || ts.isStringLiteral(node)) && STRICT_BUILDERS.has(node.text)) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: `production acquires removed strict condition builder ${node.text}`,
        });
      }
      if (
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === "@/app/lib/api-routes"
      ) {
        for (const element of node.importClause?.namedBindings?.elements ?? []) {
          const importedName = element.propertyName?.text ?? element.name.text;
          if (STRICT_BUILDERS.has(importedName)) {
            violations.push({
              rule: "direct-builder-bypass",
              file: relative,
              detail: `production imports strict condition builder ${importedName}`,
            });
          }
        }
      }
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.Identifier ||
          node.expression.kind === ts.SyntaxKind.PropertyAccessExpression)
      ) {
        for (const argument of node.arguments) {
          if (ts.isStringLiteral(argument) && DIRECT_ROUTE_PATTERN.test(argument.text)) {
            violations.push({
              rule: "direct-builder-bypass",
              file: relative,
              detail: `production call embeds condition route ${argument.text}`,
            });
          }
        }
      }
      if (ts.isNoSubstitutionTemplateLiteral(node) && DIRECT_ROUTE_PATTERN.test(node.text)) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: `production template embeds condition route ${node.text}`,
        });
      }
      if (
        (ts.isTemplateExpression(node) ||
          ts.isBinaryExpression(node) ||
          ts.isNewExpression(node)) &&
        DIRECT_ROUTE_PATTERN.test(directConditionRoutePrefix(node, constInitializers))
      ) {
        violations.push({
          rule: "direct-builder-bypass",
          file: relative,
          detail: "production expression assembles a condition route directly",
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return violations;
}

export async function runSearchConditionUrlBudgetGuard({ root = process.cwd() } = {}) {
  const sources = Object.fromEntries(
    await Promise.all(
      Object.entries(SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES).map(async ([name, relative]) => [
        name,
        await readFile(path.join(root, relative), "utf8"),
      ]),
    ),
  );
  const routeBuilderAst = parseSource(
    SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES.routeBuilders,
    sources.routeBuilders,
  );
  const searchParserAst = parseSource(
    SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES.searchParser,
    sources.searchParser,
  );
  const relationshipParserAst = parseSource(
    SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES.relationshipParser,
    sources.relationshipParser,
  );
  const searchRouteAst = parseSource(
    SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES.searchRoute,
    sources.searchRoute,
  );
  const relationshipRouteAst = parseSource(
    SEARCH_CONDITION_URL_BUDGET_SOURCE_FILES.relationshipRoute,
    sources.relationshipRoute,
  );

  const directBuilderViolations = await checkDirectBuilderBypass(root);
  const declaredRouteBuilderFunctions = new Set(
    routeBuilderAst.statements
      .filter((statement) => ts.isFunctionDeclaration(statement) && statement.name)
      .map((statement) => statement.name.text),
  );
  const strictWrapperAbsent =
    [...STRICT_BUILDERS].every((name) => !declaredRouteBuilderFunctions.has(name)) &&
    !containsThrowingSafeBuilderWrapper(routeBuilderAst);
  const facts = {
    declaredBoundary:
      /SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES\s*=\s*8_192/.test(sources.owner) &&
      sources.owner.includes("new TextEncoder()"),
    productionSerializerMeasured:
      sources.owner.includes("params.toString()") &&
      sources.owner.includes("utf8ByteLength(requestTarget)") &&
      sources.owner.includes("requestTargetBytes > SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES"),
    sharedBuildersBounded: [
      ["buildSearchRoutePageRoute", '"search"'],
      ["buildCitationSeedPageRoute", '"citation"'],
      ["buildSimilarSeedPageRoute", '"similar"'],
    ].every(([name, routeKind]) => {
      const body = functionBody(routeBuilderAst, name);
      return body.includes("validateSearchConditionUrl") && body.includes(routeKind);
    }),
    searchParserBeforeIdentity: appearsBefore(
      functionBody(searchParserAst, "buildSearchExecutionFromUrlParams"),
      "validateSearchExecutionUrlParams(params)",
      "buildCanonicalSearchExecutionKey(input)",
    ),
    relationshipParserBeforeIdentity: appearsBefore(
      functionBody(relationshipParserAst, "buildRelationshipSeedFromUrlParams"),
      "validateRelationshipSeedUrlParams(routeKind, params)",
      "buildCanonicalRelationshipKey(seedPaper)",
    ),
    searchRouteBeforeProvider: appearsBefore(
      functionBody(searchRouteAst, "SearchRoutePage"),
      "validateSearchExecutionUrlParams(params)",
      "resolveCurrentUser()",
    ),
    relationshipRoutesBeforeProvider:
      appearsBefore(
        functionBody(relationshipRouteAst, "CitationSeedRoutePage"),
        'validateRelationshipSeedUrlParams("citation", params)',
        "executeCitationLineageFromUrl",
      ) &&
      appearsBefore(
        functionBody(relationshipRouteAst, "SimilarSeedRoutePage"),
        'validateRelationshipSeedUrlParams("similar", params)',
        "executeGraphNeighborsFromUrl",
      ),
    directBuilderBypassAbsent: strictWrapperAbsent && directBuilderViolations.length === 0,
  };

  const violations = Object.entries(facts)
    .filter(([, value]) => !value)
    .map(([rule]) => ({
      rule,
      file: "search-condition-url-budget-inventory",
      detail: `${rule} inventory fact is false`,
    }));
  violations.push(...directBuilderViolations);

  return { ok: violations.length === 0, facts, violations };
}

async function main() {
  const result = await runSearchConditionUrlBudgetGuard();
  if (result.ok) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
