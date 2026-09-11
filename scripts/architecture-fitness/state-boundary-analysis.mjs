import { readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export function parseStateBoundarySource(relative, source) {
  const scriptKind = relative.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : relative.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : /\.(?:mjs|cjs|js)$/.test(relative)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, scriptKind);
}

export function descendants(node, predicate) {
  const matches = [];
  const visit = (current) => {
    if (predicate(current)) matches.push(current);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return matches;
}

export function namedFunction(sourceFile, name) {
  return descendants(
    sourceFile,
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  )[0];
}

export function namedTopLevelFunction(sourceFile, name) {
  return sourceFile.statements.find(
    (node) => ts.isFunctionDeclaration(node) && node.name?.text === name,
  );
}

export function namedVariable(node, name) {
  return descendants(
    node,
    (candidate) =>
      ts.isVariableDeclaration(candidate) &&
      ts.isIdentifier(candidate.name) &&
      candidate.name.text === name,
  );
}

export function directCall(node, name) {
  return (
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
  );
}

export function propertyInitializer(node, name) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const matches = node.properties.filter((property) => {
    if (ts.isShorthandPropertyAssignment(property)) return property.name.text === name;
    return (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
    );
  });
  if (matches.length !== 1) return null;
  return ts.isShorthandPropertyAssignment(matches[0]) ? matches[0].name : matches[0].initializer;
}

export function compactSource(value) {
  return value.replace(/\s+/g, "");
}

export function staticModuleSpecifier(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

export function isTypeOnlyReference(node) {
  for (let current = node.parent; current && !ts.isStatement(current); current = current.parent) {
    if (ts.isTypeNode(current)) return true;
  }
  return false;
}

export function resolveModulePath(importerRelative, specifier) {
  const canonicalize = (value) =>
    value
      .replace(/\.(?:[cm]?[jt]sx?)$/, "")
      .replace(/\/index$/, "")
      .replace(/^\.\//, "");
  if (specifier.startsWith("@/")) {
    return canonicalize(path.posix.normalize(specifier.slice(2)));
  }
  if (!specifier.startsWith(".")) return null;
  return canonicalize(
    path.posix.normalize(path.posix.join(path.posix.dirname(importerRelative), specifier)),
  );
}

export function inspectProtectedModule(files, moduleSpecifier, expectedOwners) {
  const errors = [];
  const acquisitions = [];
  const protectedPath = resolveModulePath("app/index.ts", moduleSpecifier);
  for (const file of files) {
    for (const statement of file.sourceFile.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        resolveModulePath(file.relative, statement.moduleSpecifier.text) === protectedPath
      ) {
        const clause = statement.importClause;
        if (!clause || clause.isTypeOnly) continue;
        if (clause.name || !clause.namedBindings || ts.isNamespaceImport(clause.namedBindings)) {
          errors.push(`${file.relative}: ${moduleSpecifier} must use named imports only`);
          continue;
        }
        for (const element of clause.namedBindings.elements) {
          if (element.isTypeOnly) continue;
          acquisitions.push({
            file: file.relative,
            imported: element.propertyName?.text ?? element.name.text,
            local: element.name.text,
            sourceFile: file.sourceFile,
            declaration: element,
          });
        }
      }
      if (
        ts.isExportDeclaration(statement) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        resolveModulePath(file.relative, statement.moduleSpecifier.text) === protectedPath
      ) {
        errors.push(`${file.relative}: protected module re-export is forbidden`);
      }
    }
    for (const call of descendants(file.sourceFile, ts.isCallExpression)) {
      const isDynamicImport = call.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(call.expression) && call.expression.text === "require";
      if (!isDynamicImport && !isRequire) continue;
      const specifier = call.arguments[0] ? staticModuleSpecifier(call.arguments[0]) : null;
      if (specifier == null || resolveModulePath(file.relative, specifier) === protectedPath) {
        errors.push(`${file.relative}: dynamic protected module acquisition is forbidden`);
      }
    }
  }

  for (const [symbol, expected] of Object.entries(expectedOwners)) {
    const matches = acquisitions.filter((item) => item.imported === symbol);
    if (matches.length !== 1 || matches[0].file !== expected.file) {
      errors.push(`${symbol} must have one production import owner: ${expected.file}`);
      continue;
    }
    const binding = matches[0];
    const uses = descendants(
      binding.sourceFile,
      (node) =>
        ts.isIdentifier(node) && node.text === binding.local && node !== binding.declaration.name,
    ).filter((node) => !ts.isImportSpecifier(node.parent) && !isTypeOnlyReference(node));
    const calls = uses.filter(
      (node) => ts.isCallExpression(node.parent) && node.parent.expression === node,
    );
    if (calls.length !== expected.calls || uses.length !== calls.length) {
      errors.push(`${symbol} must be called ${expected.calls} time(s) without capability escape`);
    }
  }
  return errors;
}

async function productionSources(root) {
  const files = [];
  const resolvedRoot = await realpath(root);
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") await visit(absolute);
        continue;
      }
      if (entry.isSymbolicLink()) {
        const target = await stat(absolute);
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        const resolvedTarget = await realpath(absolute);
        const targetFromRoot = path.relative(resolvedRoot, resolvedTarget);
        if (
          targetFromRoot === ".." ||
          targetFromRoot.startsWith(`..${path.sep}`) ||
          path.isAbsolute(targetFromRoot)
        ) {
          throw new Error(
            `production source discovery rejects symlink outside materialized root ${relative}`,
          );
        }
        if (target.isDirectory()) {
          throw new Error(`production source discovery rejects directory symlink ${relative}`);
        }
        if (!target.isFile()) {
          throw new Error(`production source discovery rejects non-file symlink ${relative}`);
        }
      }
      if (
        (!entry.isFile() && !entry.isSymbolicLink()) ||
        !/\.(?:[cm]?[jt]sx?)$/.test(entry.name) ||
        /\.test\.[cm]?[jt]sx?$/.test(entry.name)
      ) {
        continue;
      }
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      files.push({ absolute, relative });
    }
  }
  await visit(path.join(root, "app"));
  return files;
}

function createProductionProgram(root, files) {
  const configPath = path.join(root, "tsconfig.json");
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) {
    throw new Error(ts.flattenDiagnosticMessageText(loaded.error.messageText, "\n"));
  }
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, root, undefined, configPath);
  const options = { ...parsed.options, noEmit: true };
  const host = ts.createCompilerHost(options, true);
  host.getCurrentDirectory = () => root;
  return ts.createProgram({
    rootNames: files.map((file) => file.absolute),
    options,
    host,
  });
}

export async function createStateBoundaryAnalysis(root = process.cwd()) {
  const discoveredFiles = await productionSources(root);
  const program = createProductionProgram(root, discoveredFiles);
  const files = discoveredFiles.map((file) => {
    const sourceFile = program.getSourceFile(file.absolute);
    if (!sourceFile) {
      throw new Error(`TypeScript program omitted production source ${file.relative}`);
    }
    return { ...file, sourceFile };
  });
  return {
    files,
    program,
    sourceFilesByRelative: new Map(files.map((file) => [file.relative, file.sourceFile])),
  };
}

export async function loadStateBoundaryDeclaredSourceFiles(root, declarations) {
  const sourceFiles = {};
  const missing = [];
  for (const [key, relative] of Object.entries(declarations)) {
    try {
      const source = await readFile(path.join(root, relative), "utf8");
      sourceFiles[key] = parseStateBoundarySource(relative, source);
    } catch {
      missing.push(relative);
    }
  }
  return { sourceFiles, missing };
}
