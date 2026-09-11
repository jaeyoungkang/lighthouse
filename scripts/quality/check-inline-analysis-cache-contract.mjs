// guard:inline-analysis-cache-contract — bind cache-relevant semantics to the
// shared inline-analysis cache version.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import ts from "typescript";

const execFileAsync = promisify(execFile);

const INLINE_ANALYSIS_CONTRACT_SOURCES = [
  {
    filePath: "app/domain/analysis.ts",
    includeNames: [
      "ASCII_LATIN_LETTER_PATTERN",
      "NON_ASCII_LATIN_LETTER_PATTERN",
      "UNSUPPORTED_QUERY_LETTER_PATTERN",
      "GREEK_LETTER_RUN_PATTERN",
      "COMBINING_MARK_PATTERN",
      "MAX_SCIENTIFIC_GREEK_TOKEN_LENGTH",
      "normalizeProviderReadyDifferentPositionQuery",
      "normalizeProviderReadyDifferentPositionCandidates",
    ],
  },
  {
    filePath: "app/lib/inline-analysis.ts",
    includeImportNames: ["INLINE_ANALYSIS_VERSION"],
    includeNames: [
      "normalizeInlineAnalysisInputText",
      "hasNonEmptyText",
      "hasSemanticProfileSignals",
      "isInlineAnalysisFailurePlaceholder",
    ],
  },
  {
    filePath: "app/lib/schemas.ts",
    includeImportNames: ["z", "normalizeProviderReadyDifferentPositionCandidates"],
    includeNames: [
      "SemanticProfileQuotedBasisSchema",
      "SemanticProfileSchema",
      "DifferentPositionSearchCandidateSchema",
      "StanceProfileSchema",
    ],
  },
  {
    filePath: "app/domain/research-route-payload-schema.ts",
    includeImportNames: [
      "z",
      "INLINE_ANALYSIS_VERSION",
      "normalizeProviderReadyDifferentPositionCandidates",
    ],
    includeNames: [
      "semanticProfileSchema",
      "stanceProfileSchema",
      "analysisSchema",
      "inlineAnalysisCacheSchema",
    ],
  },
  {
    filePath: "app/server/ai-generation/gemini.ts",
    legacyFilePaths: ["app/lib/gemini.ts"],
    includeImportNames: ["ThinkingLevel"],
    includeNames: ["GEMINI_MODEL", "GEMINI_GENERATE_CONTENT_THINKING_LEVEL"],
  },
  {
    filePath: "app/server/ai-generation/gateway.ts",
    includeImportNames: ["GEMINI_GENERATE_CONTENT_THINKING_LEVEL"],
    includeNames: ["executeStructuredGenerationWithUsage"],
    includePropertyNames: ["responseMimeType", "temperature", "topP", "seed", "thinkingConfig"],
  },
  {
    filePath: "app/server/services/inline-analysis-service.ts",
    includeImportNames: [
      "z",
      "SemanticProfileSchema",
      "StanceProfileSchema",
      "executeJudgment",
      "GEMINI_MODEL",
      "t",
      "INLINE_ANALYSIS_REQUEST_PAPER_LIMIT",
      "normalizeProviderReadyDifferentPositionQuery",
    ],
    includeNames: [
      "ABSTRACT_PROMPT",
      "semanticProfileSchema",
      "InlineAnalysisBatchItemSchema",
      "InlineAnalysisBatchSchema",
      "InlineAnalysisBatchResponseSchema",
      "buildInlineAnalysisPrompt",
      "normalizeText",
      "normalizeOptionalText",
      "normalizeTopics",
      "normalizeStanceProfile",
      "buildQuotedBasis",
      "buildEvidenceMap",
      "buildUnknownInlineAnalysis",
      "buildAnalysisFromSemanticProfile",
      "analyzePaper",
      "analyzePaperBatch",
    ],
  },
  {
    filePath: "app/server/domain-access/inline-analysis-identity.ts",
    includeImportNames: [
      "createHash",
      "INLINE_ANALYSIS_VERSION",
      "normalizeInlineAnalysisInputText",
    ],
    includeNames: [
      "toCanonicalInlineAnalysisInput",
      "buildInlineAnalysisInputFingerprint",
      "buildInlineAnalysisCacheIdentities",
      "getCanonicalAnalyzablePapers",
    ],
  },
  {
    filePath: "app/server/domain-access/inline-analysis-access.ts",
    includeNames: ["analyzeClaimedPapersInIsolation", "resolveInlineAnalysis"],
    includeReferencedLocalDeclarations: true,
    includeReferencedRuntimeImports: true,
    includeRuntimeModuleEffects: true,
    normalizeLocalBindings: true,
    normalizeConsoleDiagnostics: true,
  },
];

const RELOCATED_CONTRACT_IMPORTS = new Map([
  ["@/app/lib/gemini", "@/app/server/ai-generation/gemini"],
  ["@/app/lib/llm-judgment", "@/app/server/ai-generation/judgment"],
]);

export function validateInlineAnalysisVersionTransition({
  baseDigest,
  baseVersion,
  baseReason = "",
  currentDigest,
  currentVersion,
  currentReason = "",
}) {
  const violations = [];

  for (const [label, version] of [
    ["base", baseVersion],
    ["current", currentVersion],
  ]) {
    if (!Number.isSafeInteger(version) || version <= 0 || version > 2_147_483_647) {
      violations.push(
        `app/domain/analysis.ts: ${label} INLINE_ANALYSIS_VERSION must be a positive PostgreSQL integer (received ${String(version)})`,
      );
    }
  }
  if (violations.length > 0) return { ok: false, violations };

  if (currentVersion < baseVersion) {
    violations.push(
      `app/domain/analysis.ts: INLINE_ANALYSIS_VERSION must not decrease (base=${String(baseVersion)}, current=${String(currentVersion)})`,
    );
    return { ok: false, violations };
  }

  if (baseDigest === currentDigest) {
    if (
      baseVersion !== currentVersion &&
      (!currentReason.trim() || currentReason.trim() === baseReason.trim())
    ) {
      violations.push(
        `app/domain/analysis.ts: INLINE_ANALYSIS_VERSION changed from ${String(baseVersion)} to ${String(currentVersion)} without a cache-relevant contract change or a new INLINE_ANALYSIS_VERSION_REASON`,
      );
    }
    return { ok: violations.length === 0, violations };
  }

  if (currentVersion <= baseVersion) {
    violations.push(
      `inline-analysis cache contract changed but INLINE_ANALYSIS_VERSION did not increase (base=${String(baseVersion)}, current=${String(currentVersion)})`,
    );
  }

  return { ok: violations.length === 0, violations };
}

export function buildTypeScriptContractDigest(sources) {
  const canonicalSources = sources.map((source) => {
    const { checker, sourceFile } = createTypeScriptSourceContext(source);
    const includeNames = source.includeNames ? new Set(source.includeNames) : null;
    const initialSelectedStatements = sourceFile.statements.filter((statement) => {
      if (ts.isImportDeclaration(statement)) return false;
      const names = getTopLevelStatementNames(statement);
      if (!includeNames) return true;
      return names.some((name) => includeNames.has(name));
    });

    if (includeNames) {
      const selectedNames = new Set(initialSelectedStatements.flatMap(getTopLevelStatementNames));
      const missingNames = [...includeNames].filter((name) => !selectedNames.has(name));
      if (missingNames.length > 0) {
        throw new Error(
          `${source.filePath}: missing inline-analysis contract declaration(s): ${missingNames.join(", ")}`,
        );
      }
    }

    const dependencySeeds = source.includeRuntimeModuleEffects
      ? sourceFile.statements.filter(
          (statement) =>
            initialSelectedStatements.includes(statement) ||
            isTopLevelRuntimeEffectStatement(statement),
        )
      : initialSelectedStatements;
    const selectedStatements = source.includeReferencedLocalDeclarations
      ? expandReferencedLocalDeclarations(dependencySeeds, sourceFile, checker)
      : dependencySeeds;
    const canonicalImports = serializeSelectedImports(
      source,
      sourceFile,
      selectedStatements,
      checker,
    );
    const canonicalBody = source.includePropertyNames
      ? serializeSelectedProperties(source, selectedStatements, sourceFile)
      : selectedStatements.map((statement) =>
          serializeContractStatement(source, statement, sourceFile, checker),
        );

    return [source.filePath, [...canonicalImports, ...canonicalBody].join("\n")].join("\0");
  });

  return createHash("sha256").update(canonicalSources.join("\0\0")).digest("hex");
}

export async function validateInlineAnalysisCacheVersionContract(
  root = process.cwd(),
  options = {},
) {
  const violations = [];
  let currentSources;

  try {
    currentSources = await readInlineAnalysisContractSources(root);
  } catch (error) {
    return {
      ok: false,
      violations: [normalizeGuardError(error)],
      comparedRef: null,
    };
  }

  const comparedRef = options.baseRef ?? (await resolveInlineAnalysisContractBaseRef(root));
  if (!comparedRef) {
    return { ok: true, violations, comparedRef: null };
  }

  let baseSources;
  try {
    baseSources = await readInlineAnalysisContractSources(root, comparedRef);
  } catch (error) {
    return {
      ok: false,
      violations: [normalizeGuardError(error)],
      comparedRef,
    };
  }

  try {
    const result = validateInlineAnalysisVersionTransition({
      baseDigest: buildTypeScriptContractDigest(baseSources),
      baseVersion: extractInlineAnalysisVersion(baseSources),
      baseReason: extractInlineAnalysisVersionReason(baseSources),
      currentDigest: buildTypeScriptContractDigest(currentSources),
      currentVersion: extractInlineAnalysisVersion(currentSources),
      currentReason: extractInlineAnalysisVersionReason(currentSources),
    });
    violations.push(...result.violations);
  } catch (error) {
    violations.push(normalizeGuardError(error));
  }

  return { ok: violations.length === 0, violations, comparedRef };
}

function getTopLevelStatementNames(statement) {
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return statement.name ? [statement.name.text] : [];
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  }

  return [];
}

function getTopLevelRuntimeBindingIdentifiers(statement) {
  if (
    (ts.isFunctionDeclaration(statement) ||
      ts.isClassDeclaration(statement) ||
      ts.isEnumDeclaration(statement)) &&
    statement.name
  ) {
    return [statement.name];
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.flatMap((declaration) =>
      collectBindingIdentifiers(declaration.name),
    );
  }
  return [];
}

function isTopLevelRuntimeEffectStatement(statement) {
  if (
    ts.isImportDeclaration(statement) ||
    ts.isExportDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEmptyStatement(statement)
  ) {
    return false;
  }
  if (statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword)) {
    return false;
  }
  if (ts.isFunctionDeclaration(statement)) {
    return (ts.getDecorators(statement)?.length ?? 0) > 0;
  }
  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.some(
      (declaration) => declaration.initializer !== undefined,
    );
  }
  return true;
}

function expandReferencedLocalDeclarations(initialStatements, sourceFile, checker) {
  const statementBySymbol = new Map();
  for (const statement of sourceFile.statements) {
    for (const identifier of getTopLevelRuntimeBindingIdentifiers(statement)) {
      const symbol = checker.getSymbolAtLocation(identifier);
      if (symbol) statementBySymbol.set(symbol, statement);
    }
  }

  const selected = new Set(initialStatements);
  const pending = [...initialStatements];
  while (pending.length > 0) {
    const statement = pending.pop();
    const visit = (node) => {
      if (ts.isIdentifier(node)) {
        const symbol = ts.isShorthandPropertyAssignment(node.parent)
          ? checker.getShorthandAssignmentValueSymbol(node.parent)
          : checker.getSymbolAtLocation(node);
        const dependency = symbol ? statementBySymbol.get(symbol) : undefined;
        if (dependency && !selected.has(dependency)) {
          selected.add(dependency);
          pending.push(dependency);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(statement);
  }

  return sourceFile.statements.filter((statement) => selected.has(statement));
}

function createTypeScriptSourceContext(source) {
  const compilerOptions = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const parsedSourceFile = ts.createSourceFile(
    source.filePath,
    source.contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const defaultHost = ts.createCompilerHost(compilerOptions);
  const host = {
    ...defaultHost,
    fileExists: (filePath) => filePath === source.filePath,
    getSourceFile: (filePath) => (filePath === source.filePath ? parsedSourceFile : undefined),
    readFile: (filePath) => (filePath === source.filePath ? source.contents : undefined),
    writeFile: () => undefined,
  };
  const program = ts.createProgram([source.filePath], compilerOptions, host);
  return {
    checker: program.getTypeChecker(),
    sourceFile: program.getSourceFile(source.filePath) ?? parsedSourceFile,
  };
}

function collectBindingIdentifiers(name) {
  if (ts.isIdentifier(name)) return [name];
  if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    return name.elements.flatMap((element) =>
      ts.isBindingElement(element) ? collectBindingIdentifiers(element.name) : [],
    );
  }
  return [];
}

function buildLocalBindingAliases(statement, checker) {
  const aliases = new Map();
  let nextAlias = 0;
  const addBinding = (name) => {
    for (const identifier of collectBindingIdentifiers(name)) {
      const symbol = checker.getSymbolAtLocation(identifier);
      if (symbol && !aliases.has(symbol)) {
        aliases.set(symbol, `local-${String(nextAlias)}`);
        nextAlias += 1;
      }
    }
  };
  const visit = (node) => {
    if (ts.isParameter(node) || ts.isVariableDeclaration(node)) {
      addBinding(node.name);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      addBinding(node.variableDeclaration.name);
    } else if (
      node !== statement &&
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node)) &&
      node.name
    ) {
      addBinding(node.name);
    } else if (ts.isTypeParameterDeclaration(node)) {
      addBinding(node.name);
    }
    ts.forEachChild(node, visit);
  };
  visit(statement);
  return aliases;
}

function unwrapDiagnosticExpression(expression) {
  if (ts.isParenthesizedExpression(expression) || ts.isVoidExpression(expression)) {
    return unwrapDiagnosticExpression(expression.expression);
  }
  return expression;
}

function isConsoleDiagnosticStatement(statement, checker) {
  if (ts.isBlock(statement)) {
    return (
      statement.statements.length > 0 &&
      statement.statements.every((child) => isConsoleDiagnosticStatement(child, checker))
    );
  }
  if (ts.isIfStatement(statement)) {
    return (
      isConsoleDiagnosticStatement(statement.thenStatement, checker) &&
      (!statement.elseStatement || isConsoleDiagnosticStatement(statement.elseStatement, checker))
    );
  }
  if (!ts.isExpressionStatement(statement)) return false;
  const expression = unwrapDiagnosticExpression(statement.expression);
  if (!ts.isCallExpression(expression)) return false;
  const callee = expression.expression;
  const receiver =
    ts.isPropertyAccessExpression(callee) || ts.isElementAccessExpression(callee)
      ? callee.expression
      : null;
  return (
    receiver !== null &&
    ts.isIdentifier(receiver) &&
    receiver.text === "console" &&
    !checker.getSymbolAtLocation(receiver)
  );
}

function isPureDiagnosticExpression(expression, checker) {
  const node = unwrapDiagnosticExpression(expression);
  if (
    ts.isIdentifier(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    node.kind === ts.SyntaxKind.ThisKeyword
  ) {
    return true;
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === "length" &&
    isKnownArrayOrStringExpression(node.expression, checker, new Set())
  ) {
    return true;
  }
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.every((span) =>
      isKnownPrimitiveDiagnosticExpression(span.expression, checker),
    );
  }
  if (ts.isPrefixUnaryExpression(node)) {
    if (
      node.operator === ts.SyntaxKind.PlusPlusToken ||
      node.operator === ts.SyntaxKind.MinusMinusToken
    ) {
      return false;
    }
    return (
      node.operator === ts.SyntaxKind.ExclamationToken &&
      isPureDiagnosticExpression(node.operand, checker)
    );
  }
  if (ts.isBinaryExpression(node)) {
    const operator = node.operatorToken.kind;
    if (operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment) {
      return false;
    }
    if (
      operator === ts.SyntaxKind.AmpersandAmpersandToken ||
      operator === ts.SyntaxKind.BarBarToken ||
      operator === ts.SyntaxKind.QuestionQuestionToken
    ) {
      return (
        isPureDiagnosticExpression(node.left, checker) &&
        isPureDiagnosticExpression(node.right, checker)
      );
    }
    return (
      isKnownPrimitiveDiagnosticExpression(node.left, checker) &&
      isKnownPrimitiveDiagnosticExpression(node.right, checker)
    );
  }
  if (ts.isConditionalExpression(node)) {
    return (
      isPureDiagnosticExpression(node.condition, checker) &&
      isPureDiagnosticExpression(node.whenTrue, checker) &&
      isPureDiagnosticExpression(node.whenFalse, checker)
    );
  }
  return false;
}

function isKnownPrimitiveDiagnosticExpression(expression, checker) {
  const node = unwrapDiagnosticExpression(expression);
  return (
    ts.isStringLiteralLike(node) ||
    ts.isNumericLiteral(node) ||
    ts.isBigIntLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isPropertyAccessExpression(node) &&
      node.name.text === "length" &&
      isKnownArrayOrStringExpression(node.expression, checker, new Set()))
  );
}

function isKnownArrayOrStringExpression(expression, checker, visitedSymbols) {
  const node = unwrapDiagnosticExpression(expression);
  if (ts.isArrayLiteralExpression(node) || ts.isStringLiteralLike(node)) return true;
  if (!ts.isIdentifier(node)) return false;
  const declarationSymbol = checker.getSymbolAtLocation(node);
  if (!declarationSymbol || visitedSymbols.has(declarationSymbol)) return false;
  visitedSymbols.add(declarationSymbol);
  return (declarationSymbol.declarations ?? []).some((declaration) => {
    if (
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      isImmutableVariableDeclaration(declaration) &&
      !hasWriteOutsideDeclaration(declarationSymbol, declaration, checker)
    ) {
      return isKnownArrayOrStringInitializer(declaration.initializer, checker, visitedSymbols);
    }
    return false;
  });
}

function isImmutableVariableDeclaration(declaration) {
  return (
    ts.isVariableDeclarationList(declaration.parent) &&
    (declaration.parent.flags & ts.NodeFlags.Const) !== 0
  );
}

function isAssignmentOperator(kind) {
  return kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;
}

function isIdentifierWrite(identifier) {
  const parent = identifier.parent;
  if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) {
    return (
      parent.operator === ts.SyntaxKind.PlusPlusToken ||
      parent.operator === ts.SyntaxKind.MinusMinusToken
    );
  }
  if (ts.isBinaryExpression(parent) && parent.left === identifier) {
    return isAssignmentOperator(parent.operatorToken.kind);
  }
  if (
    (ts.isForInStatement(parent) || ts.isForOfStatement(parent)) &&
    parent.initializer === identifier
  ) {
    return true;
  }
  if (ts.isArrayLiteralExpression(parent) || ts.isObjectLiteralExpression(parent)) {
    let current = identifier;
    while (
      ts.isArrayLiteralExpression(current.parent) ||
      ts.isObjectLiteralExpression(current.parent) ||
      ts.isPropertyAssignment(current.parent) ||
      ts.isShorthandPropertyAssignment(current.parent) ||
      ts.isSpreadAssignment(current.parent)
    ) {
      current = current.parent;
    }
    return (
      ts.isBinaryExpression(current.parent) &&
      current.parent.left === current &&
      isAssignmentOperator(current.parent.operatorToken.kind)
    );
  }
  return false;
}

function hasWriteOutsideDeclaration(symbol, declaration, checker) {
  const sourceFile = declaration.getSourceFile();
  let hasWrite = false;
  const visit = (node) => {
    if (hasWrite) return;
    if (
      ts.isIdentifier(node) &&
      node !== declaration.name &&
      checker.getSymbolAtLocation(node) === symbol &&
      isIdentifierWrite(node)
    ) {
      hasWrite = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return hasWrite;
}

function isCanonicalAnalyzablePapersFactory(identifier, checker) {
  const symbol = checker.getSymbolAtLocation(identifier);
  return (symbol?.declarations ?? []).some((declaration) => {
    if (!ts.isImportSpecifier(declaration)) return false;
    const importedName = declaration.propertyName?.text ?? declaration.name.text;
    const importDeclaration = declaration.parent.parent.parent;
    return (
      importedName === "getCanonicalAnalyzablePapers" &&
      ts.isImportDeclaration(importDeclaration) &&
      ts.isStringLiteral(importDeclaration.moduleSpecifier) &&
      importDeclaration.moduleSpecifier.text ===
        "@/app/server/domain-access/inline-analysis-identity"
    );
  });
}

function isKnownArrayOrStringInitializer(initializer, checker, visitedSymbols) {
  const node = unwrapDiagnosticExpression(initializer);
  if (ts.isArrayLiteralExpression(node) || ts.isStringLiteralLike(node)) return true;
  if (ts.isIdentifier(node)) {
    return isKnownArrayOrStringExpression(node, checker, visitedSymbols);
  }
  if (!ts.isCallExpression(node)) return false;
  if (
    ts.isIdentifier(node.expression) &&
    isCanonicalAnalyzablePapersFactory(node.expression, checker)
  ) {
    return true;
  }
  return (
    ts.isPropertyAccessExpression(node.expression) &&
    ["filter", "flat", "flatMap", "map", "slice", "sort", "reverse"].includes(
      node.expression.name.text,
    ) &&
    isKnownArrayOrStringExpression(node.expression.expression, checker, visitedSymbols)
  );
}

function serializeConsoleDiagnosticEffects(statement, sourceFile, options) {
  if (!isConsoleDiagnosticStatement(statement, options.checker)) return null;
  if (ts.isBlock(statement)) {
    return statement.statements
      .map((child) => serializeConsoleDiagnosticEffects(child, sourceFile, options))
      .filter(Boolean)
      .join("\0");
  }
  if (ts.isIfStatement(statement)) {
    const thenEffects = serializeConsoleDiagnosticEffects(
      statement.thenStatement,
      sourceFile,
      options,
    );
    const elseEffects = statement.elseStatement
      ? serializeConsoleDiagnosticEffects(statement.elseStatement, sourceFile, options)
      : "";
    const conditionIsPure = isPureDiagnosticExpression(statement.expression, options.checker);
    if (conditionIsPure && !thenEffects && !elseEffects) return "";
    const condition = serializeTypeScriptNode(statement.expression, sourceFile, options);
    return ["if", condition, "then", thenEffects, "else", elseEffects].join("\0");
  }
  const call = unwrapDiagnosticExpression(statement.expression);
  const calleeEffects =
    ts.isElementAccessExpression(call.expression) &&
    call.expression.argumentExpression &&
    !isKnownPrimitiveDiagnosticExpression(call.expression.argumentExpression, options.checker)
      ? serializeTypeScriptNode(call.expression.argumentExpression, sourceFile, options)
      : "";
  const argumentEffects = call.arguments
    .filter((argument) => !isPureDiagnosticExpression(argument, options.checker))
    .map((argument) => serializeTypeScriptNode(argument, sourceFile, options));
  return [calleeEffects, ...argumentEffects].filter(Boolean).join("\0");
}

function serializeContractStatement(source, statement, sourceFile, checker) {
  const options = {
    identifierAliases: source.normalizeLocalBindings
      ? buildLocalBindingAliases(statement, checker)
      : null,
    normalizeConsoleDiagnostics: source.normalizeConsoleDiagnostics,
    checker,
  };
  return serializeTypeScriptNode(statement, sourceFile, options);
}

function serializeTypeScriptNode(node, sourceFile, options = {}) {
  if (options.normalizeConsoleDiagnostics && ts.isStatement(node)) {
    const effects = serializeConsoleDiagnosticEffects(node, sourceFile, options);
    if (effects !== null) return effects;
  }
  if (ts.isShorthandPropertyAssignment(node)) {
    return [
      "object-property",
      node.name.text,
      serializeTypeScriptNode(node.name, sourceFile, options),
      node.objectAssignmentInitializer
        ? serializeTypeScriptNode(node.objectAssignmentInitializer, sourceFile, options)
        : "",
    ].join(":");
  }
  if (ts.isPropertyAssignment(node)) {
    const propertyName = getStaticPropertyName(node.name);
    if (propertyName !== null) {
      return [
        "object-property",
        propertyName,
        serializeTypeScriptNode(node.initializer, sourceFile, options),
        "",
      ].join(":");
    }
  }
  if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
    const propertyName = node.dotDotDotToken
      ? "*"
      : node.propertyName
        ? (getStaticPropertyName(node.propertyName) ??
          serializeTypeScriptNode(node.propertyName, sourceFile, options))
        : ts.isIdentifier(node.name)
          ? node.name.text
          : "pattern";
    return [
      "object-binding",
      node.dotDotDotToken ? "rest" : "single",
      propertyName,
      serializeTypeScriptNode(node.name, sourceFile, options),
      node.initializer ? serializeTypeScriptNode(node.initializer, sourceFile, options) : "",
    ].join(":");
  }
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    ts.isBigIntLiteral(node) ||
    node.kind === ts.SyntaxKind.RegularExpressionLiteral ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateHead(node) ||
    ts.isTemplateMiddle(node) ||
    ts.isTemplateTail(node)
  ) {
    return `${String(node.kind)}:${node.text}`;
  }
  if (ts.isIdentifier(node)) {
    const symbol = ts.isShorthandPropertyAssignment(node.parent)
      ? options.checker?.getShorthandAssignmentValueSymbol(node.parent)
      : options.checker?.getSymbolAtLocation(node);
    const alias = symbol ? options.identifierAliases?.get(symbol) : undefined;
    return `${String(node.kind)}:${alias ?? node.text}`;
  }

  const children = node
    .getChildren(sourceFile)
    .filter(
      (child) =>
        child.kind !== ts.SyntaxKind.SemicolonToken &&
        child.kind !== ts.SyntaxKind.CommaToken &&
        child.kind !== ts.SyntaxKind.EndOfFileToken,
    );
  if (children.length === 0) {
    return String(node.kind);
  }
  return `${String(node.kind)}(${children
    .map((child) => serializeTypeScriptNode(child, sourceFile, options))
    .filter(Boolean)
    .join(",")})`;
}

function serializeSelectedImports(source, sourceFile, selectedStatements, checker) {
  const importDeclarations = sourceFile.statements.filter(ts.isImportDeclaration);
  if (source.includeRuntimeModuleEffects) {
    return serializeRuntimeModuleDependencies(sourceFile);
  }
  const includeImportNames = source.includeImportNames ? new Set(source.includeImportNames) : null;
  const referencedImportSymbols = source.includeReferencedRuntimeImports
    ? collectReferencedRuntimeImportSymbols(selectedStatements, checker)
    : null;

  if (!includeImportNames && !referencedImportSymbols) {
    if (source.includeNames) return [];
    return importDeclarations
      .map((statement) => serializeTypeScriptNode(statement, sourceFile))
      .sort();
  }

  const selected = [];
  const foundNames = new Set();
  for (const declaration of importDeclarations) {
    const moduleName = declaration.moduleSpecifier.text;
    for (const binding of getImportBindings(declaration)) {
      const symbol = checker.getSymbolAtLocation(binding.localNode);
      const explicitlyIncluded = includeImportNames?.has(binding.localName) ?? false;
      const transitivelyIncluded =
        !binding.isTypeOnly && symbol !== undefined && referencedImportSymbols?.has(symbol);
      if (!explicitlyIncluded && !transitivelyIncluded) continue;
      if (explicitlyIncluded) foundNames.add(binding.localName);
      selected.push(
        [
          moduleName,
          binding.kind,
          binding.importedName,
          binding.localName,
          binding.isTypeOnly ? "type" : "value",
          serializeImportAttributes(declaration, sourceFile),
        ].join("\0"),
      );
    }
  }

  const missingNames = [...(includeImportNames ?? [])].filter((name) => !foundNames.has(name));
  if (missingNames.length > 0) {
    throw new Error(
      `${source.filePath}: missing inline-analysis contract import binding(s): ${missingNames.join(", ")}`,
    );
  }

  return selected.sort();
}

function serializeRuntimeModuleDependencies(sourceFile) {
  const selected = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const bindings = getImportBindings(statement);
      const runtimeBindings = bindings.filter((binding) => !binding.isTypeOnly);
      const moduleName = statement.moduleSpecifier.text;
      const attributes = serializeImportAttributes(statement, sourceFile);
      const bindingRecords = runtimeBindings
        .map((binding) =>
          [
            moduleName,
            binding.kind,
            binding.importedName,
            binding.localName,
            "value",
            attributes,
          ].join("\0"),
        )
        .sort();
      selected.push(...bindingRecords);
      if (
        runtimeBindings.length === 0 &&
        bindings.length === 0 &&
        !statement.importClause?.isTypeOnly
      ) {
        selected.push(["module-import", moduleName, attributes].join("\0"));
      }
      continue;
    }
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;
    selected.push(...serializeRuntimeExportDeclaration(statement, sourceFile));
  }
  return selected;
}

function serializeImportAttributes(declaration, sourceFile) {
  const attributes = declaration.attributes ?? declaration.assertClause;
  return attributes ? serializeTypeScriptNode(attributes, sourceFile) : "";
}

function serializeRuntimeExportDeclaration(declaration, sourceFile) {
  if (declaration.isTypeOnly) return [];
  const moduleName = declaration.moduleSpecifier.text;
  const attributes = serializeImportAttributes(declaration, sourceFile);
  if (!declaration.exportClause) {
    return [["module-export-all", moduleName, attributes].join("\0")];
  }
  if (ts.isNamespaceExport(declaration.exportClause)) {
    return [
      ["module-export-namespace", moduleName, declaration.exportClause.name.text, attributes].join(
        "\0",
      ),
    ];
  }
  const runtimeBindings = declaration.exportClause.elements.filter(
    (element) => !element.isTypeOnly,
  );
  if (runtimeBindings.length === 0 && declaration.exportClause.elements.length > 0) return [];
  if (runtimeBindings.length === 0) {
    return [["module-export-empty", moduleName, attributes].join("\0")];
  }
  return runtimeBindings
    .map((binding) =>
      [
        "module-export",
        moduleName,
        binding.propertyName?.text ?? binding.name.text,
        binding.name.text,
        attributes,
      ].join("\0"),
    )
    .sort();
}

function collectReferencedRuntimeImportSymbols(statements, checker) {
  const symbols = new Set();
  const visit = (node) => {
    if (ts.isIdentifier(node) && !isInsideTypeNode(node)) {
      const symbol = ts.isShorthandPropertyAssignment(node.parent)
        ? checker.getShorthandAssignmentValueSymbol(node.parent)
        : checker.getSymbolAtLocation(node);
      if (
        symbol?.declarations?.some(
          (declaration) =>
            ts.isImportSpecifier(declaration) ||
            ts.isNamespaceImport(declaration) ||
            ts.isImportClause(declaration),
        )
      ) {
        symbols.add(symbol);
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of statements) visit(statement);
  return symbols;
}

function isInsideTypeNode(node) {
  let current = node.parent;
  while (current && !ts.isStatement(current)) {
    if (ts.isTypeNode(current)) return true;
    current = current.parent;
  }
  return false;
}

function serializeSelectedProperties(source, statements, sourceFile) {
  const includePropertyNames = new Set(source.includePropertyNames);
  const selected = [];

  const getApplicationNode = (property) => {
    let node = property;
    while (node.parent && !statements.includes(node.parent)) {
      node = node.parent;
      if (ts.isSpreadAssignment(node)) return node;
    }
    return property;
  };

  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const propertyName = getStaticPropertyName(node.name);
      if (propertyName && includePropertyNames.has(propertyName)) {
        selected.push(
          [propertyName, serializeTypeScriptNode(getApplicationNode(node), sourceFile)].join("\0"),
        );
      }
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of statements) visit(statement);

  const foundNames = new Set(selected.map((value) => value.slice(0, value.indexOf("\0"))));
  const missingNames = [...includePropertyNames].filter((name) => !foundNames.has(name));
  if (missingNames.length > 0) {
    throw new Error(
      `${source.filePath}: missing inline-analysis contract property assignment(s): ${missingNames.join(", ")}`,
    );
  }

  return selected.sort();
}

function getStaticPropertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function getImportBindings(declaration) {
  const clause = declaration.importClause;
  if (!clause) return [];

  const bindings = [];
  if (clause.name) {
    bindings.push({
      kind: "default",
      importedName: "default",
      localName: clause.name.text,
      localNode: clause.name,
      isTypeOnly: clause.isTypeOnly,
    });
  }

  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    bindings.push({
      kind: "namespace",
      importedName: "*",
      localName: clause.namedBindings.name.text,
      localNode: clause.namedBindings.name,
      isTypeOnly: clause.isTypeOnly,
    });
  }

  if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) {
      bindings.push({
        kind: "named",
        importedName: element.propertyName?.text ?? element.name.text,
        localName: element.name.text,
        localNode: element.name,
        isTypeOnly: clause.isTypeOnly || element.isTypeOnly,
      });
    }
  }

  return bindings;
}

async function readInlineAnalysisContractSources(root, gitRef) {
  return Promise.all(
    INLINE_ANALYSIS_CONTRACT_SOURCES.map(async (source) => ({
      ...source,
      contents: gitRef
        ? normalizeInlineAnalysisComparisonSource(
            await readGitFileWithFallback(
              root,
              gitRef,
              source.filePath,
              source.legacyFilePaths ?? [],
            ),
          )
        : await readFile(path.join(root, source.filePath), "utf8"),
    })),
  );
}

function extractInlineAnalysisVersion(sources) {
  const source = sources.find((candidate) => candidate.filePath === "app/domain/analysis.ts");
  if (!source) {
    throw new Error("app/domain/analysis.ts: inline-analysis contract source is missing");
  }

  const sourceFile = ts.createSourceFile(
    source.filePath,
    source.contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "INLINE_ANALYSIS_VERSION" &&
        declaration.initializer &&
        ts.isNumericLiteral(declaration.initializer)
      ) {
        return Number(declaration.initializer.text);
      }
    }
  }

  throw new Error(
    "app/domain/analysis.ts: INLINE_ANALYSIS_VERSION must remain a numeric literal for cache identity review",
  );
}

function extractInlineAnalysisVersionReason(sources) {
  const source = sources.find((candidate) => candidate.filePath === "app/domain/analysis.ts");
  if (!source) return "";

  const sourceFile = ts.createSourceFile(
    source.filePath,
    source.contents,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === "INLINE_ANALYSIS_VERSION_REASON" &&
        declaration.initializer &&
        (ts.isStringLiteral(declaration.initializer) ||
          ts.isNoSubstitutionTemplateLiteral(declaration.initializer))
      ) {
        return declaration.initializer.text;
      }
    }
  }

  return "";
}

export async function resolveInlineAnalysisContractBaseRef(root) {
  const contractPaths = INLINE_ANALYSIS_CONTRACT_SOURCES.map((source) => source.filePath);
  if (await gitHasDiff(root, ["HEAD", "--", ...contractPaths])) {
    return "HEAD";
  }

  const pushedBaseRef = process.env.INLINE_ANALYSIS_CONTRACT_BASE_REF?.trim();
  if (pushedBaseRef && !/^0+$/.test(pushedBaseRef)) {
    // Return the declared ref even when it is unavailable locally. The source
    // read will then report a guard violation instead of silently narrowing a
    // multi-commit push to HEAD^1.
    return (await runGit(root, ["rev-parse", "--verify", pushedBaseRef])) ?? pushedBaseRef;
  }

  const baseBranch = process.env.GITHUB_BASE_REF;
  if (baseBranch) {
    const remoteBase = `refs/remotes/origin/${baseBranch}`;
    const mergeBase = await runGit(root, ["merge-base", "HEAD", remoteBase]);
    if (mergeBase) return mergeBase;
    // GITHUB_BASE_REF declares PR context. Keep the missing remote ref so the
    // comparison read fails closed rather than checking only the last commit.
    return remoteBase;
  }

  const branch = await runGit(root, ["branch", "--show-current"]);
  if (branch && branch !== "main") {
    const mergeBase = await runGit(root, ["merge-base", "HEAD", "refs/remotes/origin/main"]);
    if (mergeBase) return mergeBase;
  }

  // A clean local main or detached non-PR checkout has neither a worktree diff
  // nor a declared event base. Compare it with its first parent instead of
  // silently disabling the version-transition guard.
  return await runGit(root, ["rev-parse", "--verify", "HEAD^1"]);
}

export function normalizeInlineAnalysisComparisonSource(contents) {
  let normalized = contents;
  for (const [legacyImport, currentImport] of RELOCATED_CONTRACT_IMPORTS) {
    normalized = normalized.replaceAll(legacyImport, currentImport);
  }
  return normalized;
}

export async function readGitFileWithFallback(root, gitRef, filePath, legacyFilePaths = []) {
  for (const candidate of [filePath, ...legacyFilePaths]) {
    const contents = await runGit(root, ["show", `${gitRef}:${candidate}`]);
    if (contents != null) return contents;
  }
  throw new Error(`${filePath}: could not read comparison source at ${gitRef}`);
}

async function gitHasDiff(root, args) {
  try {
    await execFileAsync("git", ["diff", "--quiet", ...args], { cwd: root });
    return false;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === 1) {
      return true;
    }
    return false;
  }
}

async function runGit(root, args) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd: root,
      maxBuffer: 5 * 1024 * 1024,
    });
    return stdout.trimEnd();
  } catch {
    return null;
  }
}

function normalizeGuardError(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const result = await validateInlineAnalysisCacheVersionContract();
  if (!result.ok) {
    console.error("[guard:inline-analysis-cache-contract] cache contract drift:");
    for (const violation of result.violations) console.error(`- ${violation}`);
    process.exit(1);
  }

  const comparedRef = result.comparedRef ? ` compared with ${result.comparedRef}` : "";
  console.log(
    `[guard:inline-analysis-cache-contract] inline-analysis cache version OK${comparedRef}.`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
