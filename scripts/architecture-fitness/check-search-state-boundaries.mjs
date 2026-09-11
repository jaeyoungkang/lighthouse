#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import {
  compactSource,
  createStateBoundaryAnalysis,
  descendants,
  directCall,
  loadStateBoundaryDeclaredSourceFiles,
  namedTopLevelFunction,
  namedVariable,
  propertyInitializer,
} from "./state-boundary-analysis.mjs";

export const SEARCH_STATE_BOUNDARY_SOURCE_FILES = {
  searchBar: "app/components/research/ResearchRouteSearchBar.tsx",
  searchRoute: "app/(research)/search-route-page.tsx",
  searchExecution: "app/server/services/search-execution.ts",
  searchFacets: "app/domain/search-facets.ts",
  ephemeralIdentity: "app/server/services/ephemeral-view-id.ts",
  ephemeralConstants: "app/lib/ephemeral-search-view.ts",
  routeRuntime: "app/components/research/ResearchRouteRuntime.tsx",
};

const SEARCH_EXECUTION_MODULE = "@/app/server/services/search-execution";
const EPHEMERAL_ID_MODULE = "@/app/server/services/ephemeral-view-id";
const RESEARCH_ROUTE_STORE_FILE = "app/stores/research-route-store.ts";

function memberCall(node, name) {
  return (
    ts.isCallExpression(node) &&
    ((ts.isIdentifier(node.expression) && node.expression.text === name) ||
      (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name) ||
      (ts.isElementAccessExpression(node.expression) &&
        ts.isStringLiteral(node.expression.argumentExpression) &&
        node.expression.argumentExpression.text === name))
  );
}

function staticString(node, sourceFile, seen = new Set()) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) {
    return staticString(node.expression, sourceFile, seen);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticString(node.left, sourceFile, seen);
    const right = staticString(node.right, sourceFile, seen);
    return left == null || right == null ? null : `${left}${right}`;
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text;
    for (const span of node.templateSpans) {
      const expression = staticString(span.expression, sourceFile, seen);
      if (expression == null) return null;
      value += expression + span.literal.text;
    }
    return value;
  }
  if (!ts.isIdentifier(node) || seen.has(node.text)) return null;
  seen.add(node.text);
  const declarations = descendants(
    sourceFile,
    (candidate) =>
      ts.isVariableDeclaration(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === node.text &&
      candidate.initializer != null,
  );
  if (declarations.length !== 1) return null;
  return staticString(declarations[0].initializer, sourceFile, seen);
}

function checkUrlConditionAuthority(sourceFile) {
  const errors = [];
  const baseSeed = namedVariable(sourceFile, "baseSeedQuery");
  if (baseSeed.length !== 1 || !baseSeed[0].initializer) {
    return ["baseSeedQuery must have one initializer"];
  }
  const initializer = baseSeed[0].initializer;
  const urlCalls = descendants(initializer, (node) => directCall(node, "getUrlQuerySeed"));
  const storeCalls = descendants(initializer, (node) => directCall(node, "getShellQuerySeed"));
  const returns = descendants(initializer, ts.isReturnStatement);
  if (urlCalls.length !== 1) errors.push("baseSeedQuery must read the URL seed exactly once");
  if (storeCalls.length !== 1)
    errors.push("baseSeedQuery must read the store fallback exactly once");
  if (returns.length !== 1 || !returns[0].expression) {
    errors.push("baseSeedQuery must have one return expression");
  } else {
    const expression = returns[0].expression;
    if (
      !ts.isBinaryExpression(expression) ||
      expression.operatorToken.kind !== ts.SyntaxKind.QuestionQuestionToken ||
      !ts.isIdentifier(expression.left) ||
      expression.left.text !== "urlSeed" ||
      !directCall(expression.right, "getShellQuerySeed") ||
      expression.right.arguments.length !== 1 ||
      !ts.isIdentifier(expression.right.arguments[0]) ||
      expression.right.arguments[0].text !== "activeView"
    ) {
      errors.push("baseSeedQuery must give urlSeed precedence over activeView");
    }
  }
  return errors;
}

function checkUrlExecutionProjection(sourceFile) {
  const errors = [];
  const inputDeclarations = namedVariable(sourceFile, "input").filter((declaration) =>
    declaration.initializer
      ? descendants(declaration.initializer, (node) =>
          directCall(node, "buildSearchExecutionFromUrlParams"),
        ).length === 1
      : false,
  );
  if (inputDeclarations.length !== 1) {
    errors.push("SearchRoutePage must derive one input from URL params");
  } else {
    const calls = descendants(inputDeclarations[0].initializer, (node) =>
      directCall(node, "buildSearchExecutionFromUrlParams"),
    );
    const argument = calls[0]?.arguments[0];
    if (!argument || !ts.isIdentifier(argument) || argument.text !== "params") {
      errors.push("search execution input must be built directly from params");
    }
  }

  const executeCalls = descendants(sourceFile, (node) => directCall(node, "executeSearchFromUrl"));
  if (executeCalls.length !== 1 || executeCalls[0].arguments.length !== 1) {
    errors.push("ResolvedSearchRoute must execute search exactly once");
  } else {
    const input = propertyInitializer(executeCalls[0].arguments[0], "input");
    if (!input || !ts.isIdentifier(input) || input.text !== "input") {
      errors.push("executeSearchFromUrl must receive the URL-derived input without rewriting it");
    }
  }
  return errors;
}

function checkUrlNormalizer(sourceFile) {
  const errors = [];
  const owner = namedTopLevelFunction(sourceFile, "buildSearchExecutionFromUrlParams");
  if (!owner?.body) return ["buildSearchExecutionFromUrlParams must exist"];
  const first = namedTopLevelFunction(sourceFile, "firstParam");
  const firstReturns = first?.body ? descendants(first.body, ts.isReturnStatement) : [];
  const firstExpression = firstReturns[0]?.expression;
  const firstValue = first?.parameters[0]?.name;
  if (
    !first?.body ||
    first.parameters.length !== 1 ||
    !firstValue ||
    !ts.isIdentifier(firstValue) ||
    firstValue.text !== "value" ||
    first.body.statements.length !== 1 ||
    firstReturns.length !== 1 ||
    !firstExpression ||
    !ts.isConditionalExpression(firstExpression) ||
    !ts.isCallExpression(firstExpression.condition) ||
    !ts.isPropertyAccessExpression(firstExpression.condition.expression) ||
    !ts.isIdentifier(firstExpression.condition.expression.expression) ||
    firstExpression.condition.expression.expression.text !== "Array" ||
    firstExpression.condition.expression.name.text !== "isArray" ||
    firstExpression.condition.arguments.length !== 1 ||
    !ts.isIdentifier(firstExpression.condition.arguments[0]) ||
    firstExpression.condition.arguments[0].text !== "value" ||
    !ts.isElementAccessExpression(firstExpression.whenTrue) ||
    !ts.isIdentifier(firstExpression.whenTrue.expression) ||
    firstExpression.whenTrue.expression.text !== "value" ||
    !firstExpression.whenTrue.argumentExpression ||
    !ts.isNumericLiteral(firstExpression.whenTrue.argumentExpression) ||
    firstExpression.whenTrue.argumentExpression.text !== "0" ||
    !ts.isIdentifier(firstExpression.whenFalse) ||
    firstExpression.whenFalse.text !== "value"
  ) {
    errors.push("firstParam must be the deterministic first URL value normalizer");
  }
  const queryDeclarations = descendants(
    owner.body,
    (node) =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "query",
  );
  if (
    queryDeclarations.length !== 1 ||
    queryDeclarations[0].initializer?.getText(sourceFile) !== '(firstParam(params.q) ?? "").trim()'
  ) {
    errors.push("search query must be derived only from params.q normalization");
  }
  const inputDeclarations = descendants(
    owner.body,
    (node) =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "input",
  );
  const rawInputInitializer = inputDeclarations[0]?.initializer;
  const inputInitializer =
    rawInputInitializer && ts.isSatisfiesExpression(rawInputInitializer)
      ? rawInputInitializer.expression
      : rawInputInitializer;
  const inputQuery = inputInitializer ? propertyInitializer(inputInitializer, "query") : null;
  if (
    inputDeclarations.length !== 1 ||
    !inputInitializer ||
    !ts.isObjectLiteralExpression(inputInitializer) ||
    !inputQuery ||
    !ts.isIdentifier(inputQuery) ||
    inputQuery.text !== "query"
  ) {
    errors.push("normalized search input must carry the URL-derived query without rewriting it");
  }
  const returns = descendants(owner.body, ts.isReturnStatement).filter(
    (statement) => statement.expression && ts.isObjectLiteralExpression(statement.expression),
  );
  const canonicalReturns = returns.filter((statement) => {
    const canonicalKey = propertyInitializer(statement.expression, "canonicalKey");
    return (
      canonicalKey &&
      directCall(canonicalKey, "buildCanonicalSearchExecutionKey") &&
      canonicalKey.arguments.length === 1 &&
      ts.isIdentifier(canonicalKey.arguments[0]) &&
      canonicalKey.arguments[0].text === "input"
    );
  });
  if (canonicalReturns.length !== 1) {
    errors.push("search canonicalKey must be built once from the normalized input object");
  }
  return errors;
}

function checkGlobalArrayNormalizer(program) {
  const checker = program.getTypeChecker();
  const relative = SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution;
  const sourceFile = program.getSourceFile(path.resolve(program.getCurrentDirectory(), relative));
  const first = sourceFile ? namedTopLevelFunction(sourceFile, "firstParam") : null;
  const returned = first?.body ? descendants(first.body, ts.isReturnStatement)[0] : null;
  const expression = returned?.expression;
  const arrayIdentifier =
    expression &&
    ts.isConditionalExpression(expression) &&
    ts.isCallExpression(expression.condition) &&
    ts.isPropertyAccessExpression(expression.condition.expression) &&
    ts.isIdentifier(expression.condition.expression.expression)
      ? expression.condition.expression.expression
      : null;
  const arraySymbol = arrayIdentifier
    ? canonicalSymbol(checker, checker.getSymbolAtLocation(arrayIdentifier))
    : null;
  const declarations = arraySymbol?.declarations ?? [];
  const isStandardArray =
    declarations.length > 0 &&
    declarations.every((declaration) => {
      const declarationSource = declaration.getSourceFile();
      return (
        declarationSource.isDeclarationFile && declarationSource.fileName.includes("node_modules")
      );
    });
  const isArrayMember =
    expression &&
    ts.isConditionalExpression(expression) &&
    ts.isCallExpression(expression.condition) &&
    ts.isPropertyAccessExpression(expression.condition.expression)
      ? canonicalSymbol(checker, checker.getSymbolAtLocation(expression.condition.expression.name))
      : null;
  const directMutations = isArrayMember
    ? program
        .getSourceFiles()
        .filter((candidate) => !candidate.isDeclarationFile)
        .flatMap((candidate) =>
          descendants(
            candidate,
            (node) =>
              ts.isBinaryExpression(node) &&
              node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
              symbolsEqual(checker, resolveExpressionSymbol(checker, node.left), isArrayMember),
          ),
        )
    : [];
  const errors = [];
  if (!isStandardArray) errors.push("firstParam Array.isArray must use the standard library Array");
  if (directMutations.length > 0)
    errors.push("the standard Array.isArray normalizer capability must not be reassigned");
  return errors;
}

function installedDeclarationSymbol(symbol) {
  const declarations = symbol?.declarations ?? [];
  return (
    declarations.length > 0 &&
    declarations.every((declaration) => {
      const sourceFile = declaration.getSourceFile();
      return sourceFile.isDeclarationFile && sourceFile.fileName.includes("node_modules");
    })
  );
}

function checkGlobalFacetNormalizer(program) {
  const checker = program.getTypeChecker();
  const relative = SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchFacets;
  const sourceFile = program.getSourceFile(path.resolve(program.getCurrentDirectory(), relative));
  const normalizeList = sourceFile ? namedTopLevelFunction(sourceFile, "normalizeList") : null;
  const setExpression = normalizeList?.body
    ? descendants(
        normalizeList.body,
        (node) =>
          ts.isNewExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "Set",
      )[0]
    : null;
  const symbol =
    setExpression && ts.isNewExpression(setExpression)
      ? canonicalSymbol(checker, checker.getSymbolAtLocation(setExpression.expression))
      : null;
  return installedDeclarationSymbol(symbol)
    ? []
    : ["normalizeList Set must use the standard library Set"];
}

function checkIdentityHashProvider(program) {
  const checker = program.getTypeChecker();
  const relative = SEARCH_STATE_BOUNDARY_SOURCE_FILES.ephemeralIdentity;
  const sourceFile = program.getSourceFile(path.resolve(program.getCurrentDirectory(), relative));
  const digest = sourceFile ? namedTopLevelFunction(sourceFile, "canonicalIdentityDigest") : null;
  const createHashCall = digest?.body
    ? descendants(digest.body, (node) => directCall(node, "createHash"))[0]
    : null;
  const importBindings = sourceFile
    ? sourceFile.statements.flatMap((statement) => {
        if (
          !ts.isImportDeclaration(statement) ||
          !ts.isStringLiteral(statement.moduleSpecifier) ||
          statement.moduleSpecifier.text !== "node:crypto" ||
          !statement.importClause?.namedBindings ||
          !ts.isNamedImports(statement.importClause.namedBindings)
        ) {
          return [];
        }
        return statement.importClause.namedBindings.elements.filter(
          (element) =>
            element.name.text === "createHash" &&
            (!element.propertyName || element.propertyName.text === "createHash"),
        );
      })
    : [];
  const importSymbol =
    importBindings.length === 1 ? checker.getSymbolAtLocation(importBindings[0].name) : null;
  const callSymbol = createHashCall ? checker.getSymbolAtLocation(createHashCall.expression) : null;
  const isNodeCrypto = importSymbol != null && importSymbol === callSymbol;
  return isNodeCrypto ? [] : ["canonical identity createHash must use node:crypto"];
}

function checkFacetNormalizer(sourceFile) {
  const expected = {
    normalizeList: compactSource(`
function normalizeList(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (trimmed.length > 0) seen.add(trimmed);
  }
  return [...seen].sort();
}`),
    normalizeSearchFacetFilters: compactSource(`
export function normalizeSearchFacetFilters(
  filters: Partial<SearchFacetFilters> | undefined,
): SearchFacetFilters {
  return {
    fieldsOfStudy: normalizeList(filters?.fieldsOfStudy),
    authors: normalizeList(filters?.authors),
    venues: normalizeList(filters?.venues),
    hasPdf: filters?.hasPdf === true,
  };
}`),
  };
  const errors = [];
  for (const [name, canonical] of Object.entries(expected)) {
    const declaration = namedTopLevelFunction(sourceFile, name);
    if (!declaration || compactSource(declaration.getText(sourceFile)) !== canonical) {
      errors.push(`${name} must remain the deterministic search facet normalizer`);
    }
  }
  return errors;
}

function checkEphemeralSearchPrefix(sourceFile) {
  const declarations = namedVariable(sourceFile, "EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX");
  const initializer = declarations[0]?.initializer;
  return declarations.length === 1 &&
    initializer &&
    ts.isStringLiteral(initializer) &&
    initializer.text === "search-ephemeral-"
    ? []
    : ["ephemeral search document prefix must be the fixed search-ephemeral- literal"];
}

function checkCanonicalViewIdentity(sourceFile) {
  const errors = [];
  const owner = namedTopLevelFunction(sourceFile, "buildEphemeralDocument");
  if (!owner?.body) return ["buildEphemeralDocument must exist"];
  const returns = descendants(owner.body, ts.isReturnStatement);
  if (returns.length !== 1 || !returns[0].expression) {
    return ["buildEphemeralDocument must have one return object"];
  }
  const id = propertyInitializer(returns[0].expression, "id");
  if (
    !id ||
    !directCall(id, "buildEphemeralSearchViewId") ||
    id.arguments.length !== 1 ||
    id.arguments[0].getText(sourceFile) !== "params.input.canonicalKey"
  ) {
    return ["ephemeral search id must come only from params.input.canonicalKey"];
  }
  const calls = descendants(owner.body, (node) => directCall(node, "buildEphemeralSearchViewId"));
  if (calls.length !== 1) errors.push("buildEphemeralDocument must build one search view id");

  const execution = namedTopLevelFunction(sourceFile, "executeSearchFromUrl");
  if (!execution?.body) {
    errors.push("executeSearchFromUrl must exist");
  } else {
    const viewReturns = descendants(execution.body, ts.isReturnStatement).filter(
      (statement) =>
        statement.expression && propertyInitializer(statement.expression, "view") != null,
    );
    if (viewReturns.length !== 2) {
      errors.push("executeSearchFromUrl must have ready and failed view returns");
    } else {
      for (const statement of viewReturns) {
        const view = propertyInitializer(statement.expression, "view");
        const input =
          view && directCall(view, "buildEphemeralDocument") && view.arguments[0]
            ? propertyInitializer(view.arguments[0], "input")
            : null;
        if (!input || !ts.isIdentifier(input) || input.text !== "input") {
          errors.push("every search execution return must use buildEphemeralDocument with input");
        }
      }
    }
  }
  const pending = namedTopLevelFunction(sourceFile, "buildPendingSearchViewFromInput");
  const pendingReturns = pending?.body ? descendants(pending.body, ts.isReturnStatement) : [];
  if (
    pendingReturns.length !== 1 ||
    !pendingReturns[0].expression ||
    !directCall(pendingReturns[0].expression, "buildEphemeralDocument")
  ) {
    errors.push("pending search views must use buildEphemeralDocument");
  }
  const documentCalls = descendants(sourceFile, (node) =>
    directCall(node, "buildEphemeralDocument"),
  );
  if (documentCalls.length !== 3) {
    errors.push("search execution must have exactly three canonical document builder calls");
  }
  return errors;
}

function checkCanonicalIdentityDigestImplementation(sourceFile) {
  const digest = namedTopLevelFunction(sourceFile, "canonicalIdentityDigest");
  const digestReturns = digest?.body ? descendants(digest.body, ts.isReturnStatement) : [];
  if (
    digestReturns.length !== 1 ||
    digestReturns[0].expression?.getText(sourceFile) !==
      'createHash("sha256").update(canonicalKey, "utf8").digest("hex")'
  ) {
    return ["canonical identity digest must be SHA-256 over the UTF-8 canonical key"];
  }
  return [];
}

function checkEphemeralSearchIdBuilder(sourceFile) {
  const builder = namedTopLevelFunction(sourceFile, "buildEphemeralSearchViewId");
  const builderReturns = builder?.body ? descendants(builder.body, ts.isReturnStatement) : [];
  if (
    builderReturns.length !== 1 ||
    builderReturns[0].expression?.getText(sourceFile) !==
      "`${EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`"
  ) {
    return ["search view id must be the fixed prefix plus the digest of canonicalKey"];
  }
  return [];
}

function checkRouteOwnedSnapshot(sourceFile) {
  const owner = namedTopLevelFunction(sourceFile, "useInitialDocumentHydration");
  if (!owner?.body) return ["useInitialDocumentHydration must exist"];
  const setCalls = descendants(owner.body, (node) => memberCall(node, "setCurrentView"));
  const clearCalls = descendants(owner.body, (node) => memberCall(node, "clearCurrentView"));
  const errors = [];
  if (
    setCalls.length !== 1 ||
    setCalls[0].arguments.map((argument) => argument.getText(sourceFile)).join(",") !==
      "initialRouteView,executionId"
  ) {
    errors.push("route hydration must set only its initial view and execution id");
  }
  if (
    clearCalls.length !== 1 ||
    clearCalls[0].arguments.map((argument) => argument.getText(sourceFile)).join(",") !==
      "executionId"
  ) {
    errors.push("route cleanup must clear only its execution id");
  }
  return errors;
}

export function searchStateBoundaryInventoryFiles(files) {
  return files.filter((file) => !/\.test\./.test(path.basename(file.relative)));
}

function isCommonJsLoaderExpression(node) {
  if (
    ts.isIdentifier(node) &&
    node.text === "require" &&
    !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
  ) {
    return true;
  }
  return (
    (ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "module" &&
      node.name.text === "require") ||
    (ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "module" &&
      node.argumentExpression &&
      staticString(node.argumentExpression, node.getSourceFile()) === "require")
  );
}

function isModuleLoaderExpression(node) {
  return node.kind === ts.SyntaxKind.ImportKeyword || isCommonJsLoaderExpression(node);
}

function moduleLoaderEscapes(files) {
  const errors = [];
  for (const file of files) {
    const { sourceFile } = file;
    const escapes = descendants(
      sourceFile,
      (node) =>
        isCommonJsLoaderExpression(node) &&
        !(
          ts.isCallExpression(node.parent) &&
          node.parent.expression === node &&
          node.parent.arguments.length === 1
        ),
    );
    if (escapes.length > 0) {
      errors.push(`${file.relative}: CommonJS module loader capability escape`);
    }
  }
  return errors;
}

function productionTestModuleAcquisitions(files) {
  const errors = [];
  const isTestModule = (relative, specifier) => {
    const key = moduleKey(relative, specifier);
    return key.split("/").includes("__tests__") || /(?:^|\/)[^/]+\.test$/.test(key);
  };
  for (const file of files) {
    const { sourceFile } = file;
    const visit = (node) => {
      let specifier = null;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        (ts.isImportDeclaration(node)
          ? node.importClause?.isTypeOnly !== true
          : node.isTypeOnly !== true) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        specifier = node.moduleSpecifier.text;
      } else if (
        ts.isImportEqualsDeclaration(node) &&
        !node.isTypeOnly &&
        ts.isExternalModuleReference(node.moduleReference) &&
        node.moduleReference.expression &&
        ts.isStringLiteral(node.moduleReference.expression)
      ) {
        specifier = node.moduleReference.expression.text;
      } else if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        isModuleLoaderExpression(node.expression)
      ) {
        specifier = staticString(node.arguments[0], sourceFile);
      }
      if (specifier != null && isTestModule(file.relative, specifier)) {
        errors.push(
          `${file.relative}: production source must not acquire test module ${specifier}`,
        );
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return errors;
}

function canonicalSymbol(checker, symbol) {
  if (!symbol) return null;
  return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
}

function symbolsEqual(checker, left, right) {
  return canonicalSymbol(checker, left) === canonicalSymbol(checker, right);
}

function bindingPropertySymbol(checker, declaration) {
  if (!ts.isBindingElement(declaration)) return null;
  const direct = checker.getSymbolAtLocation(declaration.propertyName ?? declaration.name);
  const canonical = canonicalSymbol(checker, direct);
  if (canonical && canonical !== checker.getSymbolAtLocation(declaration.name)) return canonical;
  const pattern = declaration.parent;
  const variable = pattern.parent;
  if (!ts.isVariableDeclaration(variable) || !variable.initializer) return canonical;
  const name = declaration.propertyName ?? declaration.name;
  const key =
    ts.isIdentifier(name) || ts.isStringLiteral(name)
      ? name.text
      : ts.isComputedPropertyName(name)
        ? staticString(name.expression, declaration.getSourceFile())
        : null;
  return key
    ? canonicalSymbol(checker, checker.getTypeAtLocation(variable.initializer).getProperty(key))
    : null;
}

function resolveExpressionSymbol(checker, node, seen = new Set()) {
  if (!node) return null;
  if (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isAwaitExpression(node)
  ) {
    return resolveExpressionSymbol(checker, node.expression, seen);
  }
  if (ts.isCallExpression(node) && node.arguments[0]) {
    const selector = node.arguments[0];
    if (ts.isArrowFunction(selector) || ts.isFunctionExpression(selector)) {
      if (!ts.isBlock(selector.body)) return resolveExpressionSymbol(checker, selector.body, seen);
      const returned = descendants(selector.body, ts.isReturnStatement).find(
        (statement) => statement.expression,
      );
      if (returned?.expression) return resolveExpressionSymbol(checker, returned.expression, seen);
    }
  }
  if (ts.isElementAccessExpression(node)) {
    const key = node.argumentExpression
      ? staticString(node.argumentExpression, node.getSourceFile())
      : null;
    if (key) {
      const property = checker.getTypeAtLocation(node.expression).getProperty(key);
      if (property) return canonicalSymbol(checker, property);
    }
  }
  const location = ts.isPropertyAccessExpression(node) ? node.name : node;
  const symbol = canonicalSymbol(checker, checker.getSymbolAtLocation(location));
  if (!symbol || seen.has(symbol)) return symbol;
  seen.add(symbol);
  for (const declaration of symbol.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      const resolved = resolveExpressionSymbol(checker, declaration.initializer, seen);
      if (resolved) return resolved;
    }
    if (ts.isBindingElement(declaration)) {
      const resolved = bindingPropertySymbol(checker, declaration);
      if (resolved) return resolved;
    }
  }
  return symbol;
}

function moduleKey(relative, specifier) {
  const raw = specifier.startsWith("@/")
    ? specifier.slice(2)
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier))
      : specifier;
  return raw.replace(/\.(?:[cm]?[jt]sx?)$/, "").replace(/\/index$/, "");
}

function protectedModuleAcquisitions(files, moduleRef) {
  const target = moduleKey("", moduleRef);
  const owners = [];
  for (const file of files) {
    const { sourceFile } = file;
    const acquisitions = descendants(sourceFile, (node) => {
      if (!ts.isCallExpression(node) || node.arguments.length !== 1) return false;
      if (!isModuleLoaderExpression(node.expression)) {
        return false;
      }
      const specifier = staticString(node.arguments[0], sourceFile);
      return specifier != null && moduleKey(file.relative, specifier) === target;
    });
    if (acquisitions.length > 0) owners.push(file.relative);
  }
  return owners;
}

function nonStaticModuleAcquisitions(files) {
  const errors = [];
  for (const file of files) {
    const { sourceFile } = file;
    const acquisitions = descendants(
      sourceFile,
      (node) =>
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        isModuleLoaderExpression(node.expression) &&
        staticString(node.arguments[0], sourceFile) == null,
    );
    if (acquisitions.length > 0) {
      errors.push(`${file.relative}: non-static dynamic module acquisition`);
    }
  }
  return errors;
}

function exportedSymbol(program, relative, name) {
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(
    path.resolve(program.getCompilerOptions().baseUrl ?? program.getCurrentDirectory(), relative),
  );
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
  return moduleSymbol
    ? canonicalSymbol(
        checker,
        checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === name),
      )
    : null;
}

function exportedValueMemberSymbol(program, relative, exportName, memberName) {
  const checker = program.getTypeChecker();
  const exported = exportedSymbol(program, relative, exportName);
  const sourceFile = program.getSourceFile(
    path.resolve(program.getCompilerOptions().baseUrl ?? program.getCurrentDirectory(), relative),
  );
  const location = exported?.valueDeclaration ?? exported?.declarations?.[0] ?? sourceFile;
  if (!exported || !location) return null;
  return canonicalSymbol(
    checker,
    checker.getTypeOfSymbolAtLocation(exported, location).getProperty(memberName),
  );
}

function globalValueMemberSymbol(checker, location, ownerName, memberName) {
  const owner = canonicalSymbol(
    checker,
    checker.resolveName(ownerName, location, ts.SymbolFlags.Value, false),
  );
  const ownerLocation = owner?.valueDeclaration ?? owner?.declarations?.[0] ?? location;
  return owner && ownerLocation
    ? canonicalSymbol(
        checker,
        checker.getTypeOfSymbolAtLocation(owner, ownerLocation).getProperty(memberName),
      )
    : null;
}

function objectAssignSourceMayWriteCurrentView(checker, source) {
  const sourceType = checker.getTypeAtLocation(source);
  const candidates = sourceType.isUnionOrIntersection() ? sourceType.types : [sourceType];
  return candidates.some(
    (candidate) =>
      (candidate.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0 ||
      candidate.getProperty("currentView") != null,
  );
}

function protectedCallOwners(program, files, relative, exportName) {
  const checker = program.getTypeChecker();
  const target = exportedSymbol(program, relative, exportName);
  const owners = [];
  if (!target) return { owners, targetMissing: true };
  for (const file of files) {
    const sourceFile = program.getSourceFile(file.absolute);
    if (!sourceFile) continue;
    for (const call of descendants(sourceFile, ts.isCallExpression)) {
      const called = resolveExpressionSymbol(checker, call.expression);
      if (symbolsEqual(checker, called, target)) owners.push(file.relative);
    }
  }
  return { owners, targetMissing: false };
}

function interfaceMemberSymbols(program, relative, interfaceName, names) {
  const sourceFile = program.getSourceFile(
    path.resolve(program.getCompilerOptions().baseUrl ?? program.getCurrentDirectory(), relative),
  );
  const checker = program.getTypeChecker();
  const owner = sourceFile?.statements.find(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName,
  );
  const result = {};
  if (!owner || !ts.isInterfaceDeclaration(owner)) return result;
  for (const member of owner.members) {
    if (!member.name) continue;
    const name =
      ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) ? member.name.text : null;
    if (name && names.includes(name))
      result[name] = canonicalSymbol(checker, checker.getSymbolAtLocation(member.name));
  }
  return result;
}

function isExecutionIdExpression(node) {
  return (
    (ts.isIdentifier(node) && /executionId$/i.test(node.text)) ||
    (ts.isPropertyAccessExpression(node) && node.name.text === "executionId") ||
    (ts.isElementAccessExpression(node) &&
      node.argumentExpression != null &&
      staticString(node.argumentExpression, node.getSourceFile()) === "executionId")
  );
}

function isAllowedStoreHookReference(node) {
  const parent = node.parent;
  if (ts.isImportSpecifier(parent) || ts.isBindingElement(parent)) return true;
  for (let ancestor = parent; ancestor && !ts.isStatement(ancestor); ancestor = ancestor.parent) {
    if (ts.isTypeQueryNode(ancestor)) return true;
  }
  if (ts.isCallExpression(parent) && parent.expression === node) return true;
  if (
    (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
    parent.expression === node
  ) {
    return true;
  }
  return false;
}

function storeWriterInventory(program, files) {
  const checker = program.getTypeChecker();
  const memberNames = ["currentView", "setCurrentView", "clearCurrentView", "patchCurrentView"];
  const members = interfaceMemberSymbols(
    program,
    RESEARCH_ROUTE_STORE_FILE,
    "ResearchRouteState",
    memberNames,
  );
  const hookSetState = exportedValueMemberSymbol(
    program,
    RESEARCH_ROUTE_STORE_FILE,
    "useResearchRouteStore",
    "setState",
  );
  const hook = exportedSymbol(program, RESEARCH_ROUTE_STORE_FILE, "useResearchRouteStore");
  const symbolLocation =
    program.getSourceFile(path.resolve(program.getCurrentDirectory(), RESEARCH_ROUTE_STORE_FILE)) ??
    program.getSourceFiles().find((sourceFile) => !sourceFile.isDeclarationFile);
  const reflectGet = symbolLocation
    ? globalValueMemberSymbol(checker, symbolLocation, "Reflect", "get")
    : null;
  const reflectSet = symbolLocation
    ? globalValueMemberSymbol(checker, symbolLocation, "Reflect", "set")
    : null;
  const objectAssign = symbolLocation
    ? globalValueMemberSymbol(checker, symbolLocation, "Object", "assign")
    : null;
  const accesses = Object.fromEntries(memberNames.map((name) => [name, []]));
  const invalidWrites = [];
  for (const file of files) {
    if (file.relative === RESEARCH_ROUTE_STORE_FILE) continue;
    const sourceFile = program.getSourceFile(file.absolute);
    if (!sourceFile) continue;
    const visit = (node) => {
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const resolved = resolveExpressionSymbol(checker, node);
        for (const name of memberNames) {
          if (members[name] && symbolsEqual(checker, resolved, members[name])) {
            accesses[name].push(file.relative);
          }
        }
        if (hookSetState && symbolsEqual(checker, resolved, hookSetState)) {
          invalidWrites.push(`${file.relative}: useResearchRouteStore.setState capability access`);
        }
      }
      if (ts.isBindingElement(node)) {
        const resolved = bindingPropertySymbol(checker, node);
        for (const name of memberNames) {
          if (members[name] && symbolsEqual(checker, resolved, members[name])) {
            accesses[name].push(file.relative);
          }
        }
        if (hookSetState && symbolsEqual(checker, resolved, hookSetState)) {
          invalidWrites.push(`${file.relative}: useResearchRouteStore.setState capability access`);
        }
      }
      if (ts.isCallExpression(node)) {
        const called = resolveExpressionSymbol(checker, node.expression);
        if (hookSetState && symbolsEqual(checker, called, hookSetState)) {
          invalidWrites.push(`${file.relative}: direct useResearchRouteStore.setState`);
        }
        const reflectOperation =
          reflectGet && symbolsEqual(checker, called, reflectGet)
            ? "get"
            : reflectSet && symbolsEqual(checker, called, reflectSet)
              ? "set"
              : null;
        if (reflectOperation && node.arguments.length >= 2) {
          const key = staticString(node.arguments[1], sourceFile);
          const reflectedTargetType = checker.getTypeAtLocation(node.arguments[0]);
          const reflected = key
            ? canonicalSymbol(checker, reflectedTargetType.getProperty(key))
            : null;
          const protectedDynamicTarget = [...Object.values(members), hookSetState].some(
            (protectedMember) => {
              if (!protectedMember) return false;
              const candidate = reflectedTargetType.getProperty(protectedMember.name);
              return candidate && symbolsEqual(checker, candidate, protectedMember);
            },
          );
          if (!key && protectedDynamicTarget) {
            invalidWrites.push(`${file.relative}: dynamic reflective store capability access`);
          }
          if (
            reflectOperation === "get" &&
            ((hookSetState && symbolsEqual(checker, reflected, hookSetState)) ||
              ["setCurrentView", "clearCurrentView", "patchCurrentView"].some(
                (name) => members[name] && symbolsEqual(checker, reflected, members[name]),
              ))
          ) {
            invalidWrites.push(`${file.relative}: reflective ${key} capability access`);
          }
          if (
            reflectOperation === "set" &&
            members.currentView &&
            symbolsEqual(checker, reflected, members.currentView)
          ) {
            invalidWrites.push(`${file.relative}: reflective currentView assignment`);
          }
        }
        if (
          objectAssign &&
          symbolsEqual(checker, called, objectAssign) &&
          node.arguments.length >= 2 &&
          members.currentView &&
          symbolsEqual(
            checker,
            canonicalSymbol(
              checker,
              checker.getTypeAtLocation(node.arguments[0]).getProperty("currentView"),
            ),
            members.currentView,
          ) &&
          node.arguments
            .slice(1)
            .some((argument) => objectAssignSourceMayWriteCurrentView(checker, argument))
        ) {
          invalidWrites.push(`${file.relative}: Object.assign currentView assignment`);
        }
        for (const [name, argumentIndex] of [
          ["setCurrentView", 1],
          ["clearCurrentView", 0],
          ["patchCurrentView", 1],
        ]) {
          if (
            members[name] &&
            symbolsEqual(checker, called, members[name]) &&
            (!node.arguments[argumentIndex] ||
              !isExecutionIdExpression(node.arguments[argumentIndex]))
          ) {
            invalidWrites.push(`${file.relative}: ${name} must receive an execution id`);
          }
        }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        members.currentView &&
        symbolsEqual(checker, resolveExpressionSymbol(checker, node.left), members.currentView)
      ) {
        invalidWrites.push(`${file.relative}: direct currentView assignment`);
      }
      if (
        ts.isIdentifier(node) &&
        hook &&
        symbolsEqual(checker, resolveExpressionSymbol(checker, node), hook) &&
        !isAllowedStoreHookReference(node)
      ) {
        invalidWrites.push(`${file.relative}: useResearchRouteStore capability escape`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
  return {
    accesses: Object.fromEntries(
      Object.entries(accesses).map(([name, owners]) => [name, [...new Set(owners)].sort()]),
    ),
    invalidWrites,
  };
}

function inventoryErrors({ files, program }) {
  const errors = {
    "url-to-execution-projection": [],
    "canonical-identity-digest-implementation": [],
    "canonical-ephemeral-view-identity": [],
    "route-owned-result-snapshot": [],
  };
  const testModuleAcquisitions = productionTestModuleAcquisitions(files);
  const nonStaticAcquisitions = nonStaticModuleAcquisitions(files);
  const loaderEscapes = moduleLoaderEscapes(files);
  for (const rule of [
    "url-to-execution-projection",
    "canonical-ephemeral-view-identity",
    "route-owned-result-snapshot",
  ]) {
    errors[rule].push(...testModuleAcquisitions, ...nonStaticAcquisitions, ...loaderEscapes);
  }
  errors["url-to-execution-projection"].push(...checkGlobalArrayNormalizer(program));
  errors["url-to-execution-projection"].push(...checkGlobalFacetNormalizer(program));
  const identityHashProviderErrors = checkIdentityHashProvider(program);
  errors["canonical-identity-digest-implementation"].push(...identityHashProviderErrors);
  errors["canonical-ephemeral-view-identity"].push(...identityHashProviderErrors);
  const execution = protectedCallOwners(
    program,
    files,
    SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution,
    "executeSearchFromUrl",
  );
  const executionAmbiguous = protectedModuleAcquisitions(files, SEARCH_EXECUTION_MODULE);
  if (
    execution.targetMissing ||
    executionAmbiguous.length > 0 ||
    execution.owners.length !== 1 ||
    execution.owners[0] !== SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchRoute
  ) {
    errors["url-to-execution-projection"].push(
      "executeSearchFromUrl must have one named production owner: search-route-page.tsx",
    );
  }
  const identity = protectedCallOwners(
    program,
    files,
    SEARCH_STATE_BOUNDARY_SOURCE_FILES.ephemeralIdentity,
    "buildEphemeralSearchViewId",
  );
  const identityAmbiguous = protectedModuleAcquisitions(files, EPHEMERAL_ID_MODULE);
  if (
    identity.targetMissing ||
    identityAmbiguous.length > 0 ||
    identity.owners.length !== 1 ||
    identity.owners[0] !== SEARCH_STATE_BOUNDARY_SOURCE_FILES.searchExecution
  ) {
    errors["canonical-ephemeral-view-identity"].push(
      "buildEphemeralSearchViewId must have one named production owner: search-execution.ts",
    );
  }
  const writers = storeWriterInventory(program, files);
  const expectedWriters = {
    setCurrentView: [SEARCH_STATE_BOUNDARY_SOURCE_FILES.routeRuntime],
    clearCurrentView: [
      "app/(research)/research-route-shell.tsx",
      SEARCH_STATE_BOUNDARY_SOURCE_FILES.routeRuntime,
    ],
  };
  for (const [name, expected] of Object.entries(expectedWriters)) {
    const actualAccesses = writers.accesses[name] ?? [];
    const sortedExpected = [...expected].sort();
    if (JSON.stringify(actualAccesses) !== JSON.stringify(sortedExpected)) {
      errors["route-owned-result-snapshot"].push(
        `${name} production access owners must equal ${expected.join(", ")}`,
      );
    }
  }
  errors["route-owned-result-snapshot"].push(...writers.invalidWrites);
  return errors;
}

export async function createSearchStateBoundaryAnalysis(root = process.cwd()) {
  return createStateBoundaryAnalysis(root);
}

export async function runSearchStateBoundaryGuard({
  root = process.cwd(),
  analysis: providedAnalysis,
} = {}) {
  let analysis;
  let analysisError = null;
  const sourceFiles = {};
  const missing = [];
  try {
    analysis = providedAnalysis ?? (await createSearchStateBoundaryAnalysis(root));
    for (const [key, relative] of Object.entries(SEARCH_STATE_BOUNDARY_SOURCE_FILES)) {
      const sourceFile = analysis.sourceFilesByRelative.get(relative);
      if (sourceFile) sourceFiles[key] = sourceFile;
      else missing.push(relative);
    }
  } catch (error) {
    analysisError = error;
    const fallback = await loadStateBoundaryDeclaredSourceFiles(
      root,
      SEARCH_STATE_BOUNDARY_SOURCE_FILES,
    );
    Object.assign(sourceFiles, fallback.sourceFiles);
    missing.push(...fallback.missing);
  }

  const checks = {
    "url-condition-authority": sourceFiles.searchBar
      ? checkUrlConditionAuthority(sourceFiles.searchBar)
      : ["source missing"],
    "url-to-execution-projection": [
      ...(sourceFiles.searchRoute
        ? checkUrlExecutionProjection(sourceFiles.searchRoute)
        : ["source missing"]),
      ...(sourceFiles.searchExecution
        ? checkUrlNormalizer(sourceFiles.searchExecution)
        : ["search execution source missing"]),
      ...(sourceFiles.searchFacets
        ? checkFacetNormalizer(sourceFiles.searchFacets)
        : ["search facet source missing"]),
    ],
    "canonical-identity-digest-implementation": sourceFiles.ephemeralIdentity
      ? checkCanonicalIdentityDigestImplementation(sourceFiles.ephemeralIdentity)
      : ["identity implementation source missing"],
    "canonical-ephemeral-view-identity": [
      ...(sourceFiles.searchExecution
        ? checkCanonicalViewIdentity(sourceFiles.searchExecution)
        : ["source missing"]),
      ...(sourceFiles.ephemeralIdentity
        ? [
            ...checkCanonicalIdentityDigestImplementation(sourceFiles.ephemeralIdentity),
            ...checkEphemeralSearchIdBuilder(sourceFiles.ephemeralIdentity),
          ]
        : ["identity implementation source missing"]),
      ...(sourceFiles.ephemeralConstants
        ? checkEphemeralSearchPrefix(sourceFiles.ephemeralConstants)
        : ["identity constant source missing"]),
    ],
    "route-owned-result-snapshot": sourceFiles.routeRuntime
      ? checkRouteOwnedSnapshot(sourceFiles.routeRuntime)
      : ["source missing"],
  };

  try {
    if (analysisError) throw analysisError;
    const inventory = inventoryErrors({
      ...analysis,
      files: searchStateBoundaryInventoryFiles(analysis.files),
    });
    for (const [rule, errors] of Object.entries(inventory)) checks[rule].push(...errors);
  } catch (error) {
    const message = `production inventory failed: ${error instanceof Error ? error.message : String(error)}`;
    for (const rule of [
      "url-to-execution-projection",
      "canonical-identity-digest-implementation",
      "canonical-ephemeral-view-identity",
      "route-owned-result-snapshot",
    ]) {
      checks[rule].push(message);
    }
  }

  const violations = Object.entries(checks)
    .filter(([, errors]) => errors.length > 0)
    .map(([rule, errors]) => ({
      rule,
      file: SEARCH_STATE_BOUNDARY_SOURCE_FILES[
        rule === "url-condition-authority"
          ? "searchBar"
          : rule === "url-to-execution-projection"
            ? "searchRoute"
            : rule === "canonical-identity-digest-implementation"
              ? "ephemeralIdentity"
              : rule === "canonical-ephemeral-view-identity"
                ? "searchExecution"
                : "routeRuntime"
      ],
      errors,
    }));
  const facts = Object.fromEntries(
    Object.entries(checks).map(([rule, errors]) => [rule, errors.length === 0]),
  );

  return {
    ok: missing.length === 0 && violations.length === 0,
    filesScanned: Object.keys(sourceFiles).length,
    missing,
    violations,
    facts,
  };
}

async function main() {
  const result = await runSearchStateBoundaryGuard();
  if (!result.ok) {
    console.error("[architecture-fitness:search-state-boundary] declared boundary drift:");
    for (const file of result.missing) console.error(`- missing ${file}`);
    for (const violation of result.violations) {
      console.error(`- ${violation.rule}: ${violation.file}`);
      for (const error of violation.errors) console.error(`  ${error}`);
    }
    process.exit(1);
  }
  console.log(
    `[architecture-fitness:search-state-boundary] OK (${result.filesScanned} source files plus production ownership inventory).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
