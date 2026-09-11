#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { runLeastAuthorityBoundaryGuard } from "./check-least-authority-boundaries.mjs";
import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";
import {
  ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS,
  architectureFitnessPathTestEnvironment,
  architectureFitnessPathTestInvocation,
} from "./path-test-command.mjs";

const ROOT = process.cwd();
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const COLLECTOR_REF = "scripts/architecture-fitness/collect-least-authority.mjs";
const GUARD_REF = "scripts/architecture-fitness/check-least-authority-boundaries.mjs";
const GUARD_PATH = path.join(ROOT, GUARD_REF);
const GUARD_EXCEPTION_POLICY_REF = "scripts/quality/guard-exception-policy.mjs";
const GUARD_EXCEPTION_POLICY_PATH = path.join(ROOT, GUARD_EXCEPTION_POLICY_REF);
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const TRUST_POLICY_PATH = path.join(ROOT, TRUST_POLICY_REF);
const REPOSITORY_SEAM_POLICY_REF = "scripts/quality/repository-seam-policy.mjs";
const REPOSITORY_SEAM_POLICY_PATH = path.join(ROOT, REPOSITORY_SEAM_POLICY_REF);
const REVIEWED_PAPER_ACCESS = "app/server/domain-access/reviewed-paper-access.ts";
const REVIEWED_PAPER_REPOSITORY = "app/server/repository/reviewed-papers.ts";
const AUTH_IDENTITY = "app/server/auth/identity.ts";
const REPOSITORY_DB_HANDLE = "app/lib/supabase/repository-db-handle.ts";
const AUTH_BOUNDARY_TEST =
  "app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts";
const INJECTED_CALLER =
  "app/server/domain-access/architecture-fitness-injected-reviewed-paper-access.ts";
const PRODUCTION_SCOPE = [
  "app",
  "packages",
  "proxy.ts",
  "middleware.ts",
  "instrumentation.ts",
  "instrumentation-client.ts",
];
const REVIEWED_PAPER_PUBLIC_FUNCTIONS = new Set([
  "listMyReviewedPapers",
  "resolveMyCachedReviewedPapersLibraryContextSource",
  "resolveMyReviewedPapersLibraryContextSource",
  "markMyReviewedPaper",
  "unmarkMyReviewedPaper",
]);
const RAW_AUTHORITY_PARAMETER_RE =
  /\b(?:db|userId|ownerPrincipalId|viewerPrincipalId|principalId)\b/;
const ZERO_DIGEST = "0".repeat(64);
const HISTORICAL_ADMIN_CLIENT_LAYOUT_REVISIONS = new Set([
  "2066f24671d2f24d89c59359888df19f8befb89d",
  "87877a1a6448c5b355f4c3e7a07273b00c29776c",
  "e26b4ab8775a158c39c0090b2af6b7d480704d74",
]);

export function isHistoricalAdminClientLayoutRevision(revision) {
  return HISTORICAL_ADMIN_CLIENT_LAYOUT_REVISIONS.has(revision);
}

export const LEAST_AUTHORITY_COLLECTION_SCOPE_PATHS = [...PRODUCTION_SCOPE];

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

export function normalizeVitestTestName(name, targetRoot) {
  const reportedName = String(name);
  const roots = [...new Set([path.resolve(targetRoot), realpathSync(targetRoot)])];
  const reportedPaths = [...new Set([path.resolve(reportedName), realpathSync(reportedName)])];
  for (const root of roots) {
    for (const reportedPath of reportedPaths) {
      const relative = path.relative(root, reportedPath);
      const isInsideRoot =
        relative === "" ||
        (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
      if (isInsideRoot) {
        const normalized = relative.split(path.sep).join(path.posix.sep);
        return normalized ? `<target-revision>/${normalized}` : "<target-revision>";
      }
    }
  }
  throw new Error(`Vitest reported a test outside the target revision: ${reportedName}`);
}

async function readRevisionSource(root, ref, { optional = false } = {}) {
  try {
    return await readFile(path.join(root, ref), "utf8");
  } catch (error) {
    if (optional && error && typeof error === "object" && error.code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

export async function collectorDefinitionDigest() {
  const definitions = [];
  for (const [ref, file] of [
    [COLLECTOR_REF, COLLECTOR_PATH],
    [GUARD_REF, GUARD_PATH],
    [GUARD_EXCEPTION_POLICY_REF, GUARD_EXCEPTION_POLICY_PATH],
    [TRUST_POLICY_REF, TRUST_POLICY_PATH],
    [REPOSITORY_SEAM_POLICY_REF, REPOSITORY_SEAM_POLICY_PATH],
    ...ARCHITECTURE_FITNESS_PATH_TEST_DEFINITION_REFS.map((ref) => [ref, path.join(ROOT, ref)]),
  ]) {
    definitions.push({ ref, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
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
    const detail = stderr?.trim() || stdout?.trim() || `exit ${result.status}`;
    throw new Error(`git ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout;
}

function sourceFile(relative, contents) {
  return ts.createSourceFile(
    relative,
    contents,
    ts.ScriptTarget.Latest,
    true,
    relative.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function exportedValues(contents) {
  const source = sourceFile(REVIEWED_PAPER_ACCESS, contents);
  const values = [];
  for (const statement of source.statements) {
    const exported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (exported && ts.isFunctionDeclaration(statement) && statement.name) {
      values.push({
        kind: "function",
        name: statement.name.text,
        parameters: statement.parameters.map((item) => item.getText(source)),
      });
    } else if (exported && ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        const parameters =
          initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            ? initializer.parameters.map((item) => item.getText(source))
            : [];
        values.push({
          kind: "variable",
          name: declaration.name.getText(source),
          parameters,
        });
      }
    } else if (ts.isExportDeclaration(statement)) {
      values.push({
        kind: "re-export",
        name: statement.exportClause?.getText(source) ?? "*",
        parameters: [],
      });
    }
  }
  return values;
}

function inspectOwnerBoundary(contents) {
  const source = sourceFile(REVIEWED_PAPER_ACCESS, contents);
  let ownerAuthCalls = 0;
  let ownerPredicateCalls = 0;
  function visit(node) {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "requireOwnerPrincipalAuth"
      ) {
        ownerAuthCalls += 1;
      }
      if (
        ts.isIdentifier(node.expression) &&
        ["listReviewedPapers", "markAsReviewed", "unmarkReviewed"].includes(node.expression.text) &&
        node.arguments.length >= 2 &&
        ts.isPropertyAccessExpression(node.arguments[1]) &&
        node.arguments[1].name.text === "id"
      ) {
        ownerPredicateCalls += 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return {
    ownerAuthCalls,
    ownerPredicateCalls,
    ownerDerived: ownerAuthCalls > 0 && ownerPredicateCalls > 0,
  };
}

function inspectOpaqueRepositoryHandle(identityContents, repositoryDbHandleContents) {
  const identitySource = sourceFile(AUTH_IDENTITY, identityContents);
  const repositoryDbHandleSource = sourceFile(REPOSITORY_DB_HANDLE, repositoryDbHandleContents);
  let opaqueHandleType = false;
  let handleFactory = false;
  let registeredHandleStore = false;
  let rejectingUnwrapper = false;
  let authContextUsesHandle = false;

  function opaqueHandleMembers(typeNode) {
    let candidate = typeNode;
    while (ts.isParenthesizedTypeNode(candidate)) candidate = candidate.type;
    if (
      ts.isTypeReferenceNode(candidate) &&
      ts.isIdentifier(candidate.typeName) &&
      candidate.typeName.text === "Readonly" &&
      candidate.typeArguments?.length === 1
    ) {
      [candidate] = candidate.typeArguments;
    }
    return ts.isTypeLiteralNode(candidate) ? candidate.members : [];
  }

  for (const statement of repositoryDbHandleSource.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text === "RepositoryDbHandle" &&
      opaqueHandleMembers(statement.type).some(
        (member) => ts.isPropertySignature(member) && ts.isComputedPropertyName(member.name),
      )
    ) {
      opaqueHandleType = true;
    }
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "createRepositoryDbHandle" &&
      statement.type?.getText(repositoryDbHandleSource) === "RepositoryDbHandle"
    ) {
      handleFactory = true;
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "repositoryDbClients" &&
          declaration.initializer &&
          ts.isNewExpression(declaration.initializer) &&
          ts.isIdentifier(declaration.initializer.expression) &&
          declaration.initializer.expression.text === "WeakMap"
        ) {
          registeredHandleStore = true;
        }
      }
    }
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === "unwrapRepositoryDbHandle" &&
      statement.body
    ) {
      function findThrow(node) {
        if (ts.isThrowStatement(node)) rejectingUnwrapper = true;
        ts.forEachChild(node, findThrow);
      }
      findThrow(statement.body);
    }
  }

  function inspectIdentity(node) {
    if (
      ts.isPropertySignature(node) &&
      node.name.getText(identitySource) === "db" &&
      node.type?.getText(identitySource) === "RepositoryDbHandle"
    ) {
      authContextUsesHandle = true;
    }
    ts.forEachChild(node, inspectIdentity);
  }
  inspectIdentity(identitySource);

  return {
    opaqueHandleType,
    handleFactory,
    registeredHandleStore,
    rejectingUnwrapper,
    authContextUsesHandle,
    enforced:
      opaqueHandleType &&
      handleFactory &&
      registeredHandleStore &&
      rejectingUnwrapper &&
      authContextUsesHandle,
  };
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-fitness-revision-"));
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
    // The collector-authority checkout supplies the path-test harness and dependencies.
    // The exact target tree remains the inspected source/runtime input even
    // when its dependency lock differs from the collector-authority checkout.
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    return { root, dependencySource: "collector-authority" };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function executeGuard(root, allowHistoricalAdminClientModule) {
  try {
    const result = await runLeastAuthorityBoundaryGuard({
      root,
      allowAbsentExceptionMatches: true,
      allowHistoricalGapReservationImports: true,
      allowHistoricalAdminClientModule,
    });
    return { completed: true, exitCode: result.ok ? 0 : 1, result };
  } catch (error) {
    return {
      completed: false,
      exitCode: 1,
      result: { ok: false, filesScanned: 0, violations: [] },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function executeNegativeMutationSuite(root) {
  const accessPath = path.join(root, REVIEWED_PAPER_ACCESS);
  const injectedCallerPath = path.join(root, INJECTED_CALLER);
  const original = await readFile(accessPath, "utf8");
  const injectedFunction = [
    "",
    "export async function architectureFitnessInjectedRawReviewedPaper(",
    "  db: unknown,",
    "  userId: string,",
    "): Promise<void> {",
    "  void db;",
    "  void userId;",
    "}",
    "",
  ].join("\n");
  const injectedCaller = [
    `import { listReviewedPapers } from \"@/${REVIEWED_PAPER_REPOSITORY.replace(/\.ts$/, "")}\";`,
    "",
    "export async function architectureFitnessInjectedOwnerSelection(",
    "  db: Parameters<typeof listReviewedPapers>[0],",
    "  ownerId: string,",
    ") {",
    "  return listReviewedPapers(db, ownerId);",
    "}",
    "",
    'const ARCHITECTURE_FITNESS_INJECTED_TABLE = "reviewed_papers";',
    "",
    "export function architectureFitnessInjectedDirectTableSelection(",
    "  db: { from(table: string): unknown },",
    "  ownerId: string,",
    ") {",
    "  void ownerId;",
    '  return db["from"](ARCHITECTURE_FITNESS_INJECTED_TABLE);',
    "}",
    "",
    "export function architectureFitnessInjectedAliasedTableSelection(",
    "  db: { from(table: string): unknown },",
    ") {",
    '  const callFrom = db["from"];',
    "  const applyFrom = db.from;",
    "  const bindFrom = db.from;",
    "  const invoke = (method: typeof callFrom) => method.call(db, ARCHITECTURE_FITNESS_INJECTED_TABLE);",
    "  const called = callFrom.call(db, ARCHITECTURE_FITNESS_INJECTED_TABLE);",
    "  const applied = applyFrom.apply(db, [ARCHITECTURE_FITNESS_INJECTED_TABLE]);",
    "  const bound = bindFrom.bind(db);",
    "  const { from: destructuredFrom } = db;",
    "  const { db: connection } = { db };",
    "  const { from } = connection;",
    "  let assignedFrom: typeof callFrom;",
    "  assignedFrom = db.from;",
    "  return [",
    "    called,",
    "    applied,",
    "    bound(ARCHITECTURE_FITNESS_INJECTED_TABLE),",
    "    invoke(destructuredFrom),",
    "    invoke(from),",
    "    invoke(assignedFrom),",
    "  ];",
    "}",
    "",
    'const ARCHITECTURE_FITNESS_INJECTED_DB_MODULE = "../repository/" + "db";',
    "",
    "export async function architectureFitnessInjectedComputedDbImport() {",
    "  return import(ARCHITECTURE_FITNESS_INJECTED_DB_MODULE);",
    "}",
    "",
    'const ARCHITECTURE_FITNESS_INJECTED_DB_DIRECTORY = "../repository";',
    "const ARCHITECTURE_FITNESS_INJECTED_DB_REQUIRE = `${ARCHITECTURE_FITNESS_INJECTED_DB_DIRECTORY}/db`;",
    "",
    "export function architectureFitnessInjectedComputedDbRequire() {",
    "  return require(ARCHITECTURE_FITNESS_INJECTED_DB_REQUIRE);",
    "}",
    "",
  ].join("\n");
  try {
    await writeFile(accessPath, `${original}${injectedFunction}`, "utf8");
    await writeFile(injectedCallerPath, injectedCaller, "utf8");
    const execution = await executeGuard(root);
    const injectedExportRejected = execution.result.violations.some(
      (item) =>
        item.file === REVIEWED_PAPER_ACCESS &&
        ["reviewed-paper-export-surface", "reviewed-paper-raw-authority-parameter"].includes(
          item.rule,
        ) &&
        item.detail.includes("architectureFitnessInjectedRawReviewedPaper"),
    );
    const injectedCallerRejected = execution.result.violations.some(
      (item) => item.file === INJECTED_CALLER && item.rule === "reviewed-paper-repository-caller",
    );
    const injectedElementTableAccessRejected = execution.result.violations.some(
      (item) =>
        item.file === INJECTED_CALLER &&
        item.rule === "repository-table-owner" &&
        item.detail.includes("direct-call"),
    );
    const injectedAliasViolations = execution.result.violations.filter(
      (item) => item.file === INJECTED_CALLER && item.rule === "repository-table-owner",
    );
    const injectedAliasTableAccessRejected =
      injectedAliasViolations.filter((item) => item.detail.includes("extracted-capability"))
        .length >= 6 &&
      injectedAliasViolations.filter((item) => item.detail.includes("extracted-alias-forwarding"))
        .length >= 3;
    const injectedComputedDbAcquisitionRejected =
      execution.result.violations.filter(
        (item) => item.file === INJECTED_CALLER && item.rule === "repository-db-capability-caller",
      ).length >= 2;
    const passed =
      execution.completed &&
      !execution.result.ok &&
      injectedExportRejected &&
      injectedCallerRejected &&
      injectedElementTableAccessRejected &&
      injectedAliasTableAccessRejected &&
      injectedComputedDbAcquisitionRejected;
    return {
      exitCode: passed ? 0 : 1,
      artifact: {
        execution,
        expectations: {
          injectedExportRejected,
          injectedCallerRejected,
          injectedElementTableAccessRejected,
          injectedAliasTableAccessRejected,
          injectedComputedDbAcquisitionRejected,
        },
      },
    };
  } catch (error) {
    return {
      exitCode: 1,
      artifact: { error: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    await writeFile(accessPath, original, "utf8");
    await unlink(injectedCallerPath).catch(() => undefined);
  }
}

function normalizeVitestResult(result, targetRoot) {
  if (result.status !== 0) {
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout.replaceAll(targetRoot, "<target-revision>"),
      stderr: result.stderr.replaceAll(targetRoot, "<target-revision>"),
    };
  }
  try {
    const report = JSON.parse(result.stdout);
    return {
      exitCode: 0,
      numTotalTestSuites: report.numTotalTestSuites,
      numPassedTestSuites: report.numPassedTestSuites,
      numTotalTests: report.numTotalTests,
      numPassedTests: report.numPassedTests,
      testResults: (report.testResults ?? []).map((testResult) => ({
        name: normalizeVitestTestName(testResult.name, targetRoot),
        status: testResult.status,
        assertionResults: (testResult.assertionResults ?? []).map((assertion) => ({
          fullName: assertion.fullName,
          status: assertion.status,
        })),
      })),
    };
  } catch {
    return {
      exitCode: 1,
      stdout: result.stdout.replaceAll(targetRoot, "<target-revision>"),
      stderr: "Vitest did not produce a parseable JSON report.",
    };
  }
}

function executePathTest(targetRoot) {
  const invocation = architectureFitnessPathTestInvocation([AUTH_BOUNDARY_TEST]);
  const result = spawnSync(path.join(ROOT, "node_modules", ".bin", "vitest"), invocation.args, {
    cwd: targetRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    env: {
      ...process.env,
      ...architectureFitnessPathTestEnvironment(targetRoot),
      NODE_ENV: "test",
    },
  });
  const artifact = normalizeVitestResult(result, targetRoot);
  return { exitCode: artifact.exitCode, artifact };
}

function evidence({
  id,
  kind,
  role,
  source,
  revision,
  summary,
  freshness,
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
    freshness,
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
  const allowHistoricalAdminClientModule = isHistoricalAdminClientLayoutRevision(revision);
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

  const materialized = await materializeRevision(revision);
  try {
    const accessSource = await readFile(
      path.join(materialized.root, REVIEWED_PAPER_ACCESS),
      "utf8",
    );
    const identitySource = await readFile(path.join(materialized.root, AUTH_IDENTITY), "utf8");
    const repositoryDbHandleSource = await readRevisionSource(
      materialized.root,
      REPOSITORY_DB_HANDLE,
      { optional: true },
    );
    const exports = exportedValues(accessSource);
    const rawExports = exports.filter(
      (item) =>
        !REVIEWED_PAPER_PUBLIC_FUNCTIONS.has(item.name) ||
        item.parameters.some((parameter) => RAW_AUTHORITY_PARAMETER_RE.test(parameter)),
    );
    const boundaryInspection = inspectOwnerBoundary(accessSource);
    const handleInspection = inspectOpaqueRepositoryHandle(
      identitySource,
      repositoryDbHandleSource,
    );
    const guardExecution = await executeGuard(materialized.root, allowHistoricalAdminClientModule);
    const negativeExecution = await executeNegativeMutationSuite(materialized.root);
    const pathTestExecution = executePathTest(materialized.root);

    const allowedPathRef = "policy-path:current-owner-reviewed-papers";
    const rawPathRef = "observed-path:raw-reviewed-paper-helper";
    const observedPathRefs = [allowedPathRef, ...(rawExports.length > 0 ? [rawPathRef] : [])];
    const policyRef = "issue-278:reviewed-paper-owner-read";
    const scopedPolicy = policy.policies.find((item) => item.id === policyRef);
    if (!scopedPolicy) throw new Error(`policy is missing ${policyRef}`);
    const capabilityRef = scopedPolicy.capabilityRef;
    const target = (pathRefs, factRefs) => ({
      policyRef,
      capabilityRef,
      pathRefs,
      factRefs,
    });
    const graph = {
      revision,
      scope: PRODUCTION_SCOPE,
      dependencySource: materialized.dependencySource,
      attestorRef: authority.attestorRef,
      guardDefinitionRef: GUARD_REF,
      guardExecution,
      reviewedPaperAccess: { exports, boundaryInspection },
      repositoryDbHandle: handleInspection,
    };
    const graphDigest = canonicalDigest(graph);
    const accessDigest = sha256(accessSource);
    const pathStaticDigest = canonicalDigest({
      accessDigest,
      identityDigest: sha256(identitySource),
      repositoryDbHandleDigest: sha256(repositoryDbHandleSource),
    });
    const negativeDigest = canonicalDigest(negativeExecution.artifact);
    const pathTestDigest = canonicalDigest(pathTestExecution.artifact);
    const forbiddenCallerGuardObserved = negativeExecution.exitCode === 0;
    const principalFacts = [
      ...(boundaryInspection.ownerDerived ? ["principal:authenticated-owner"] : []),
    ];
    const enforcementFacts = [
      ...(boundaryInspection.ownerPredicateCalls > 0
        ? ["enforcement:repository-owner-predicate"]
        : []),
      ...(forbiddenCallerGuardObserved ? ["enforcement:forbidden-caller-guard"] : []),
      ...(guardExecution.exitCode === 0 && handleInspection.enforced
        ? ["enforcement:opaque-repository-db-handle"]
        : []),
    ];
    const ownerFacts = [...principalFacts, ...enforcementFacts];
    const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-278.policy.json --revision ${revision} --run-ref ${runRef}`;
    const complete =
      guardExecution.exitCode === 0 &&
      negativeExecution.exitCode === 0 &&
      pathTestExecution.exitCode === 0 &&
      boundaryInspection.ownerDerived &&
      handleInspection.enforced;

    const evidenceItems = [
      evidence({
        id: `coverage-static:${revision}`,
        kind: "static",
        role: "coverage-static-graph",
        source: `collector-graph:${revision}`,
        revision,
        summary: `The exact-revision least-authority guard scanned ${guardExecution.result.filesScanned} production modules and returned a normalized result.`,
        freshness: "fresh",
        command,
        exitCode: guardExecution.exitCode,
        digest: graphDigest,
        runRef,
        target: target(observedPathRefs, ["coverage:all-acquisition-paths"]),
      }),
      evidence({
        id: `coverage-negative-guard:${revision}`,
        kind: "test",
        role: "coverage-negative-guard",
        source: "collector:reviewed-paper-negative-mutation-suite",
        revision,
        summary:
          "The collector injected a raw authority export, a parallel arbitrary-owner repository caller, static element-access table selection, an extracted table-method alias, and computed import/require acquisition of the repository DB module into the exact-revision tree, then required the bound AST guard to reject every bypass class.",
        freshness: "fresh",
        command,
        exitCode: negativeExecution.exitCode,
        digest: negativeDigest,
        runRef,
        target: target(observedPathRefs, ["coverage:undeclared-acquisition-rejected"]),
      }),
      evidence({
        id: `path-static:current-owner:${revision}`,
        kind: "static",
        role: "path-static",
        source: REVIEWED_PAPER_ACCESS,
        revision,
        summary:
          "The exact-revision AST inspection observed owner-principal authentication, repository calls using the derived principal id, and whether auth exposes only a registered opaque repository DB handle.",
        freshness: "fresh",
        command,
        exitCode: guardExecution.exitCode,
        digest: pathStaticDigest,
        runRef,
        target: target(
          [allowedPathRef],
          ["caller:reviewed-paper-current-principal-boundary", ...ownerFacts],
        ),
      }),
      evidence({
        id: `path-test:current-owner:${revision}`,
        kind: "test",
        role: "path-test",
        source: AUTH_BOUNDARY_TEST,
        revision,
        summary:
          "Vitest executed the exact-revision auth-boundary suite with the collector-authority config, setup, and dependency installation.",
        freshness: "fresh",
        command: architectureFitnessPathTestInvocation([AUTH_BOUNDARY_TEST]).command,
        exitCode: pathTestExecution.exitCode,
        digest: pathTestDigest,
        runRef,
        target: target(
          [allowedPathRef],
          ["caller:reviewed-paper-current-principal-boundary", ...ownerFacts],
        ),
      }),
    ];

    const paths = [
      {
        id: `observation-path:current-owner:${revision}`,
        pathRef: allowedPathRef,
        callerRef: "caller:reviewed-paper-current-principal-boundary",
        principalSourceRefs: principalFacts,
        enforcementRefs: enforcementFacts,
        exposureRefs: [],
        evidenceRefs: [
          `path-static:current-owner:${revision}`,
          `path-test:current-owner:${revision}`,
        ],
      },
    ];

    if (rawExports.length > 0) {
      evidenceItems.push(
        evidence({
          id: `path-static:raw-helper:${revision}`,
          kind: "static",
          role: "path-static",
          source: REVIEWED_PAPER_ACCESS,
          revision,
          summary: `The exact-revision AST guard observed undeclared reviewed-paper exports: ${rawExports.map((item) => item.name).join(", ")}.`,
          freshness: "fresh",
          command,
          exitCode: guardExecution.exitCode,
          digest: accessDigest,
          runRef,
          target: target(
            [rawPathRef],
            [
              "caller:arbitrary-user-id-helper",
              "principal:caller-supplied-user-id",
              "enforcement:repository-owner-predicate",
              "exposure:raw-user-id-export",
              "exposure:raw-db-client-export",
            ],
          ),
        }),
      );
      paths.push({
        id: `observation-path:raw-helper:${revision}`,
        pathRef: rawPathRef,
        callerRef: "caller:arbitrary-user-id-helper",
        principalSourceRefs: ["principal:caller-supplied-user-id"],
        enforcementRefs: ["enforcement:repository-owner-predicate"],
        exposureRefs: ["exposure:raw-user-id-export", "exposure:raw-db-client-export"],
        evidenceRefs: [`path-static:raw-helper:${revision}`],
      });
    }

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
        definitionDigest: authority.definitionDigest,
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
          id: `observation:issue-278-reviewed-paper:${revision}`,
          policyRef,
          capabilityRef,
          completeness: complete ? "complete" : "partial",
          coverageEvidenceRefs: [
            `coverage-static:${revision}`,
            `coverage-negative-guard:${revision}`,
          ],
          paths,
        },
      ],
    };
  } finally {
    await rm(materialized.root, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const options = { policy: null, revision: null, runRef: null, output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--policy") options.policy = argv[++index];
    else if (value === "--revision") options.revision = argv[++index];
    else if (value === "--run-ref") options.runRef = argv[++index];
    else if (value === "--output") options.output = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  for (const field of ["policy", "revision", "runRef"]) {
    if (!options[field]) {
      throw new Error(
        `--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`,
      );
    }
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  const rendered = `${JSON.stringify(observation, null, 2)}\n`;
  if (options.output) await writeFile(path.resolve(options.output), rendered, "utf8");
  else process.stdout.write(rendered);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
