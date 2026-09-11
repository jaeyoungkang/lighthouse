#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import {
  createSearchStateBoundaryAnalysis,
  runSearchStateBoundaryGuard,
} from "./check-search-state-boundaries.mjs";
import {
  compactSource,
  descendants,
  directCall,
  inspectProtectedModule,
  loadStateBoundaryDeclaredSourceFiles,
  namedTopLevelFunction,
  namedVariable,
  propertyInitializer,
} from "./state-boundary-analysis.mjs";

export const RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES = {
  relationshipRoute: "app/(research)/relationship-route-page.tsx",
  relationshipExecution: "app/server/services/relationship-execution.ts",
  relationshipRuntimes: "app/(research)/research-route-runtimes.tsx",
  ephemeralIdentity: "app/server/services/ephemeral-view-id.ts",
  ephemeralConstants: "app/lib/ephemeral-search-view.ts",
  routeRuntime: "app/components/research/ResearchRouteRuntime.tsx",
};

const RELATIONSHIP_EXECUTION_MODULE = "@/app/server/services/relationship-execution";
const EPHEMERAL_ID_MODULE = "@/app/server/services/ephemeral-view-id";
const SHARED_ROUTE_RUNTIME_MODULE = "@/app/components/research/ResearchRouteRuntime";

function propertyChain(node, names) {
  let current = node;
  for (let index = names.length - 1; index >= 1; index -= 1) {
    if (!ts.isPropertyAccessExpression(current) || current.name.text !== names[index]) {
      return false;
    }
    current = current.expression;
  }
  return ts.isIdentifier(current) && current.text === names[0];
}

const RELATIONSHIP_URL_PARAM_FIELDS = new Set([
  "seed",
  "seedPaperId",
  "seedPaperTitle",
  "seedPaperYear",
  "seedPaperUrl",
  "seedPaperCitations",
]);

function unwrapExpression(node) {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function relationshipSeedProvenance(node, approvedLocals) {
  const current = unwrapExpression(node);
  if (
    ts.isStringLiteral(current) ||
    ts.isNoSubstitutionTemplateLiteral(current) ||
    ts.isNumericLiteral(current) ||
    current.kind === ts.SyntaxKind.NullKeyword
  ) {
    return { valid: true, fromUrl: false };
  }
  if (ts.isArrayLiteralExpression(current) && current.elements.length === 0) {
    return { valid: true, fromUrl: false };
  }
  if (ts.isIdentifier(current)) {
    return approvedLocals.has(current.text)
      ? { valid: true, fromUrl: true }
      : { valid: current.text === "undefined", fromUrl: false };
  }
  if (
    ts.isPropertyAccessExpression(current) &&
    ts.isIdentifier(current.expression) &&
    current.expression.text === "params" &&
    RELATIONSHIP_URL_PARAM_FIELDS.has(current.name.text)
  ) {
    return { valid: true, fromUrl: true };
  }
  if (
    ts.isBinaryExpression(current) &&
    [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(
      current.operatorToken.kind,
    )
  ) {
    const left = relationshipSeedProvenance(current.left, approvedLocals);
    const right = relationshipSeedProvenance(current.right, approvedLocals);
    return {
      valid: left.valid && right.valid,
      fromUrl: left.fromUrl || right.fromUrl,
    };
  }
  if (ts.isCallExpression(current)) {
    if (
      ["firstParam", "parseOptionalNumber"].some((name) => directCall(current, name)) &&
      current.arguments.length === 1
    ) {
      return relationshipSeedProvenance(current.arguments[0], approvedLocals);
    }
    if (
      ts.isPropertyAccessExpression(current.expression) &&
      current.expression.name.text === "trim" &&
      current.arguments.length === 0
    ) {
      return relationshipSeedProvenance(current.expression.expression, approvedLocals);
    }
  }
  return { valid: false, fromUrl: false };
}

function assignmentRoot(node) {
  let current = unwrapExpression(node);
  while (ts.isPropertyAccessExpression(current) || ts.isElementAccessExpression(current)) {
    current = unwrapExpression(current.expression);
  }
  return ts.isIdentifier(current) ? current.text : null;
}

function checkRelationshipSeedProvenance(owner) {
  const errors = [];
  const approvedLocals = new Set();
  const derivedNames = ["seedPaperId", "seedPaperTitle", "seedPaperYear", "seedPaperCitations"];
  for (const name of derivedNames) {
    const declarations = namedVariable(owner.body, name);
    const initializer = declarations[0]?.initializer;
    const provenance = initializer
      ? relationshipSeedProvenance(initializer, approvedLocals)
      : { valid: false, fromUrl: false };
    if (declarations.length !== 1 || !provenance.valid || !provenance.fromUrl) {
      errors.push(`${name} must derive only from declared URL params and prior seed values`);
      continue;
    }
    approvedLocals.add(name);
  }

  const seedDeclarations = namedVariable(owner.body, "seedPaper");
  const seedDeclaration = seedDeclarations[0];
  const seedObject = seedDeclaration?.initializer;
  const expectedFields = [
    "paperId",
    "title",
    "abstract",
    "year",
    "citationCount",
    "url",
    "authors",
  ];
  const actualFields = ts.isObjectLiteralExpression(seedObject)
    ? seedObject.properties.flatMap((property) => {
        if (ts.isShorthandPropertyAssignment(property)) return [property.name.text];
        if (
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ) {
          return [property.name.text];
        }
        return [];
      })
    : [];
  if (
    seedDeclarations.length !== 1 ||
    !ts.isObjectLiteralExpression(seedObject) ||
    seedObject.properties.length !== expectedFields.length ||
    JSON.stringify([...actualFields].sort()) !== JSON.stringify([...expectedFields].sort())
  ) {
    errors.push("seedPaper must declare the bounded PaperCore projection exactly once");
  } else {
    for (const field of ["paperId", "title", "year", "citationCount", "url"]) {
      const initializer = propertyInitializer(seedObject, field);
      const provenance = initializer
        ? relationshipSeedProvenance(initializer, approvedLocals)
        : { valid: false, fromUrl: false };
      if (!provenance.valid || !provenance.fromUrl) {
        errors.push(`seedPaper.${field} must derive only from declared URL params`);
      }
    }
    const abstractValue = propertyInitializer(seedObject, "abstract");
    const authorsValue = propertyInitializer(seedObject, "authors");
    if (abstractValue?.kind !== ts.SyntaxKind.NullKeyword) {
      errors.push("seedPaper.abstract must remain the fixed null placeholder");
    }
    if (
      !authorsValue ||
      !ts.isArrayLiteralExpression(authorsValue) ||
      authorsValue.elements.length
    ) {
      errors.push("seedPaper.authors must remain the fixed empty collection");
    }
  }

  const protectedNames = new Set([...derivedNames, "seedPaper"]);
  const assignments = descendants(owner.body, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment
    ) {
      return protectedNames.has(assignmentRoot(node.left));
    }
    if (
      (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node)) &&
      [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)
    ) {
      return protectedNames.has(assignmentRoot(node.operand));
    }
    return false;
  });
  if (assignments.length > 0) {
    errors.push("relationship seed values must not be mutated after URL derivation");
  }

  if (seedDeclaration && ts.isIdentifier(seedDeclaration.name)) {
    const escapedUses = descendants(
      owner.body,
      (node) => ts.isIdentifier(node) && node.text === "seedPaper",
    ).filter((node) => {
      if (node === seedDeclaration.name) return false;
      if (ts.isShorthandPropertyAssignment(node.parent) && node.parent.name === node) return false;
      return !(
        ts.isCallExpression(node.parent) &&
        directCall(node.parent, "buildCanonicalRelationshipKey") &&
        node.parent.arguments.length === 1 &&
        node.parent.arguments[0] === node
      );
    });
    if (escapedUses.length > 0) {
      errors.push("seedPaper must flow only to the return carrier and canonical-key builder");
    }
  }
  return errors;
}

function checkRouteFunctionProjection(sourceFile, functionName, executeName, runtimeName) {
  const errors = [];
  const owner = namedTopLevelFunction(sourceFile, functionName);
  if (!owner?.body) return [`${functionName} must exist`];

  const inputs = namedVariable(owner.body, "input").filter((declaration) =>
    declaration.initializer
      ? descendants(declaration.initializer, (node) =>
          directCall(node, "buildRelationshipSeedFromUrlParams"),
        ).length === 1
      : false,
  );
  if (inputs.length !== 1 || !inputs[0].initializer) {
    errors.push(`${functionName} must derive one relationship input from URL params`);
  } else {
    const buildCall = descendants(inputs[0].initializer, (node) =>
      directCall(node, "buildRelationshipSeedFromUrlParams"),
    )[0];
    const expectedRouteKind = functionName === "CitationSeedRoutePage" ? "citation" : "similar";
    if (
      buildCall?.arguments.length !== 2 ||
      !ts.isStringLiteral(buildCall.arguments[0]) ||
      buildCall.arguments[0].text !== expectedRouteKind ||
      !ts.isIdentifier(buildCall.arguments[1]) ||
      buildCall.arguments[1].text !== "params"
    ) {
      errors.push(`${functionName} must pass its route kind and params directly to the builder`);
    }
  }

  const executeCalls = descendants(owner.body, (node) => directCall(node, executeName));
  if (executeCalls.length !== 1 || executeCalls[0].arguments.length !== 1) {
    errors.push(`${functionName} must call ${executeName} exactly once`);
  } else {
    const input = propertyInitializer(executeCalls[0].arguments[0], "input");
    if (!input || !ts.isIdentifier(input) || input.text !== "input") {
      errors.push(`${executeName} must receive the URL-derived input without rewriting it`);
    }
  }

  const runtimeElements = descendants(
    owner.body,
    (node) => ts.isJsxSelfClosingElement(node) && node.tagName.getText(sourceFile) === runtimeName,
  );
  if (runtimeElements.length !== 1) {
    errors.push(`${functionName} must render one ${runtimeName}`);
  } else {
    const initialView = runtimeElements[0].attributes.properties.find(
      (attribute) =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(sourceFile) === "initialView",
    );
    const expression =
      initialView &&
      ts.isJsxAttribute(initialView) &&
      initialView.initializer &&
      ts.isJsxExpression(initialView.initializer)
        ? initialView.initializer.expression
        : null;
    if (!expression || !ts.isIdentifier(expression) || expression.text !== "document") {
      errors.push(`${runtimeName} must receive the relationship execution document directly`);
    }
  }
  return errors;
}

function checkRelationshipUrlProjection(sourceFile) {
  return [
    ...checkRouteFunctionProjection(
      sourceFile,
      "CitationSeedRoutePage",
      "executeCitationLineageFromUrl",
      "CitationResearchRouteRuntime",
    ),
    ...checkRouteFunctionProjection(
      sourceFile,
      "SimilarSeedRoutePage",
      "executeGraphNeighborsFromUrl",
      "SimilarResearchRouteRuntime",
    ),
  ];
}

function checkRelationshipRuntimeProjection(sourceFile) {
  const errors = [];
  const runtimeImports = sourceFile.statements.filter(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === SHARED_ROUTE_RUNTIME_MODULE,
  );
  const runtimeBindings = runtimeImports.flatMap((statement) => {
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return [];
    return bindings.elements.filter(
      (element) =>
        !element.isTypeOnly &&
        (element.propertyName?.text ?? element.name.text) === "ResearchRouteRuntime" &&
        element.name.text === "ResearchRouteRuntime",
    );
  });
  if (runtimeImports.length !== 1 || runtimeBindings.length !== 1) {
    errors.push("relationship runtime wrappers must import the shared runtime directly");
  }

  for (const name of ["CitationResearchRouteRuntime", "SimilarResearchRouteRuntime"]) {
    const owner = namedTopLevelFunction(sourceFile, name);
    if (!owner?.body) {
      errors.push(`${name} must exist`);
      continue;
    }
    const runtimes = descendants(
      owner.body,
      (node) =>
        ts.isJsxSelfClosingElement(node) &&
        ts.isIdentifier(node.tagName) &&
        node.tagName.text === "ResearchRouteRuntime",
    );
    if (runtimes.length !== 1) {
      errors.push(`${name} must render one shared ResearchRouteRuntime`);
      continue;
    }
    const spreads = runtimes[0].attributes.properties.filter(
      (attribute) =>
        ts.isJsxSpreadAttribute(attribute) &&
        ts.isIdentifier(attribute.expression) &&
        attribute.expression.text === "props",
    );
    const overrides = runtimes[0].attributes.properties.filter(
      (attribute) =>
        ts.isJsxAttribute(attribute) &&
        ["initialView", "runtimeId"].includes(attribute.name.getText(sourceFile)),
    );
    if (spreads.length !== 1 || overrides.length !== 0) {
      errors.push(`${name} must pass runtimeId and initialView through the exact props carrier`);
    }
  }
  return errors;
}

function checkRelationshipNormalizer(sourceFile) {
  const errors = [];
  const owner = namedTopLevelFunction(sourceFile, "buildRelationshipSeedFromUrlParams");
  const canonicalOwner = namedTopLevelFunction(sourceFile, "buildCanonicalRelationshipKey");
  const firstParam = namedTopLevelFunction(sourceFile, "firstParam");
  const numberNormalizer = namedTopLevelFunction(sourceFile, "parseOptionalNumber");
  if (!owner?.body) errors.push("buildRelationshipSeedFromUrlParams must exist");
  if (!canonicalOwner?.body) errors.push("buildCanonicalRelationshipKey must exist");
  if (!owner?.body || !canonicalOwner?.body) return errors;

  const firstReturns = firstParam?.body ? descendants(firstParam.body, ts.isReturnStatement) : [];
  const firstExpression = firstReturns[0]?.expression;
  if (
    !firstParam?.body ||
    firstParam.body.statements.length !== 1 ||
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
    errors.push("relationship firstParam must select only the first declared URL value");
  }
  const expectedNumberNormalizer = compactSource(`{
    if (value == null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }`);
  if (
    !numberNormalizer?.body ||
    compactSource(numberNormalizer.body.getText(sourceFile)) !== expectedNumberNormalizer
  ) {
    errors.push("relationship numeric URL values must use the deterministic number normalizer");
  }
  const protectedBindings = new Set(["Array", "Number", "firstParam", "parseOptionalNumber"]);
  const importedShadows = descendants(
    sourceFile,
    (node) =>
      (ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) &&
      node.name &&
      protectedBindings.has(node.name.text),
  );
  const localShadows = descendants(
    owner.body,
    (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      protectedBindings.has(node.name.text),
  );
  if (importedShadows.length > 0 || localShadows.length > 0) {
    errors.push("relationship seed normalizer bindings must not be shadowed or replaced");
  }

  const forbidden = new Set(["Date", "Math", "process", "globalThis", "window", "crypto"]);
  for (const candidate of [owner.body, canonicalOwner.body]) {
    const found = descendants(
      candidate,
      (node) => ts.isIdentifier(node) && forbidden.has(node.text),
    );
    if (found.length > 0) {
      errors.push(
        "relationship seed normalization must not read runtime or nondeterministic state",
      );
      break;
    }
  }
  errors.push(...checkRelationshipSeedProvenance(owner));

  const returns = descendants(owner.body, ts.isReturnStatement).filter(
    (statement) => statement.expression && ts.isObjectLiteralExpression(statement.expression),
  );
  const finalReturn = returns.at(-1)?.expression;
  const canonicalKey = finalReturn ? propertyInitializer(finalReturn, "canonicalKey") : null;
  if (
    !canonicalKey ||
    !directCall(canonicalKey, "buildCanonicalRelationshipKey") ||
    canonicalKey.arguments.length !== 1 ||
    !ts.isIdentifier(canonicalKey.arguments[0]) ||
    canonicalKey.arguments[0].text !== "seedPaper"
  ) {
    errors.push("canonicalKey must be built only from the URL-derived seedPaper");
  }

  const setKeys = descendants(canonicalOwner.body, (node) => {
    if (
      !ts.isCallExpression(node) ||
      !ts.isPropertyAccessExpression(node.expression) ||
      !ts.isIdentifier(node.expression.expression) ||
      node.expression.expression.text !== "params" ||
      node.expression.name.text !== "set" ||
      node.arguments.length < 1 ||
      !ts.isStringLiteral(node.arguments[0])
    ) {
      return false;
    }
    return true;
  }).map((call) => call.arguments[0].text);
  const expectedKeys = [
    "seedPaperId",
    "seedPaperTitle",
    "seedPaperYear",
    "seedPaperUrl",
    "seedPaperCitations",
  ];
  if (
    JSON.stringify([...setKeys].sort()) !== JSON.stringify([...expectedKeys].sort()) ||
    setKeys.length !== expectedKeys.length
  ) {
    errors.push("canonical relationship key must use the declared seed-paper URL fields exactly");
  }
  const toStringCalls = descendants(
    canonicalOwner.body,
    (node) =>
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "params" &&
      node.expression.name.text === "toString",
  );
  if (toStringCalls.length !== 1) {
    errors.push("canonical relationship key must return URLSearchParams.toString exactly once");
  }
  return errors;
}

function checkRelationshipIdentityCalls(sourceFile) {
  const errors = [];
  for (const name of [
    "buildEphemeralCitationLineageViewId",
    "buildEphemeralGraphNeighborsViewId",
  ]) {
    const calls = descendants(sourceFile, (node) => directCall(node, name));
    if (calls.length !== 2) {
      errors.push(`${name} must mint the ready and failed views exactly once each`);
      continue;
    }
    for (const call of calls) {
      const argument = call.arguments[0];
      if (
        !argument ||
        (!propertyChain(argument, ["input", "canonicalKey"]) &&
          !propertyChain(argument, ["params", "input", "canonicalKey"]))
      ) {
        errors.push(`${name} must use only input.canonicalKey`);
      }
    }
  }
  return errors;
}

function checkRelationshipPrefixes(sourceFile) {
  const expected = {
    EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX: "citation-ephemeral-",
    EPHEMERAL_GRAPH_NEIGHBORS_DOCUMENT_ID_PREFIX: "graph-neighbors-ephemeral-",
  };
  const errors = [];
  for (const [name, value] of Object.entries(expected)) {
    const declarations = namedVariable(sourceFile, name);
    if (
      declarations.length !== 1 ||
      !declarations[0].initializer ||
      !ts.isStringLiteral(declarations[0].initializer) ||
      declarations[0].initializer.text !== value
    ) {
      errors.push(`${name} must remain the declared static literal`);
    }
  }
  return errors;
}

function inventoryErrors(files) {
  return {
    projection: inspectProtectedModule(files, RELATIONSHIP_EXECUTION_MODULE, {
      buildRelationshipSeedFromUrlParams: {
        file: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
        calls: 2,
      },
      executeCitationLineageFromUrl: {
        file: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
        calls: 1,
      },
      executeGraphNeighborsFromUrl: {
        file: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute,
        calls: 1,
      },
    }),
    identity: inspectProtectedModule(files, EPHEMERAL_ID_MODULE, {
      buildEphemeralCitationLineageViewId: {
        file: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
        calls: 2,
      },
      buildEphemeralGraphNeighborsViewId: {
        file: RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution,
        calls: 2,
      },
    }),
  };
}

export function relationshipStateBoundaryInventoryFiles(files) {
  return files.filter(
    (file) => !/(?:\.test|\.spec|\.d)\.[cm]?[jt]sx?$/.test(path.basename(file.relative)),
  );
}

export async function runRelationshipStateBoundaryGuard({
  root = process.cwd(),
  analysis: providedAnalysis,
  sharedResult: providedSharedResult,
} = {}) {
  const sourceFiles = {};
  const missing = [];
  let analysis;
  let analysisError = null;
  try {
    analysis = providedAnalysis ?? (await createSearchStateBoundaryAnalysis(root));
    for (const [key, relative] of Object.entries(RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES)) {
      const sourceFile = analysis.sourceFilesByRelative.get(relative);
      if (sourceFile) sourceFiles[key] = sourceFile;
      else missing.push(relative);
    }
  } catch (error) {
    analysisError = error;
    const fallback = await loadStateBoundaryDeclaredSourceFiles(
      root,
      RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES,
    );
    Object.assign(sourceFiles, fallback.sourceFiles);
    missing.push(...fallback.missing);
  }

  const shared =
    providedSharedResult ??
    (analysis
      ? await runSearchStateBoundaryGuard({ root, analysis })
      : await runSearchStateBoundaryGuard({ root }));
  const checks = {
    "relationship-url-to-execution-projection": [
      ...(sourceFiles.relationshipRoute
        ? checkRelationshipUrlProjection(sourceFiles.relationshipRoute)
        : ["relationship route source missing"]),
      ...(sourceFiles.relationshipExecution
        ? checkRelationshipNormalizer(sourceFiles.relationshipExecution)
        : ["relationship execution source missing"]),
    ],
    "canonical-relationship-view-identity": [
      ...(sourceFiles.relationshipExecution
        ? checkRelationshipIdentityCalls(sourceFiles.relationshipExecution)
        : ["relationship execution source missing"]),
      ...(sourceFiles.ephemeralConstants
        ? checkRelationshipPrefixes(sourceFiles.ephemeralConstants)
        : ["ephemeral constants source missing"]),
      ...(shared.facts?.["canonical-identity-digest-implementation"]
        ? []
        : ["shared canonical identity digest implementation is not healthy"]),
    ],
    "route-owned-relationship-result-snapshot": [
      ...(sourceFiles.relationshipRuntimes
        ? checkRelationshipRuntimeProjection(sourceFiles.relationshipRuntimes)
        : ["relationship runtime wrapper source missing"]),
      ...(shared.facts?.["route-owned-result-snapshot"]
        ? []
        : ["shared route-owned snapshot boundary is not healthy"]),
    ],
  };

  try {
    if (analysisError) throw analysisError;
    const inventory = inventoryErrors(relationshipStateBoundaryInventoryFiles(analysis.files));
    checks["relationship-url-to-execution-projection"].push(...inventory.projection);
    checks["canonical-relationship-view-identity"].push(...inventory.identity);
  } catch (error) {
    const message = `production inventory failed: ${error instanceof Error ? error.message : String(error)}`;
    checks["relationship-url-to-execution-projection"].push(message);
    checks["canonical-relationship-view-identity"].push(message);
  }

  const violations = Object.entries(checks)
    .filter(([, errors]) => errors.length > 0)
    .map(([rule, errors]) => ({
      rule,
      file:
        rule === "relationship-url-to-execution-projection"
          ? RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRoute
          : rule === "canonical-relationship-view-identity"
            ? RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipExecution
            : RELATIONSHIP_STATE_BOUNDARY_SOURCE_FILES.relationshipRuntimes,
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
  const result = await runRelationshipStateBoundaryGuard();
  if (!result.ok) {
    console.error("[architecture-fitness:relationship-state-boundary] declared boundary drift:");
    for (const file of result.missing) console.error(`- missing ${file}`);
    for (const violation of result.violations) {
      console.error(`- ${violation.rule}: ${violation.file}`);
      for (const error of violation.errors) console.error(`  ${error}`);
    }
    process.exit(1);
  }
  console.log(
    `[architecture-fitness:relationship-state-boundary] OK (${result.filesScanned} declared source files plus shared route-state and production ownership inventory).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
