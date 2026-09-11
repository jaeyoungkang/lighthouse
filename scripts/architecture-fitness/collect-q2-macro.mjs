#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";

const ROOT = process.cwd();
const COLLECTOR_PATH = fileURLToPath(import.meta.url);
const COLLECTOR_REF = "scripts/architecture-fitness/collect-q2-macro.mjs";
const PROBE_REF = "scripts/architecture-fitness/q2-process-isolation-probe.ts";
const TEST_REF = "scripts/architecture-fitness/__tests__/q2-macro-boundaries.test.ts";
const TEST_CONFIG_REF = "scripts/architecture-fitness/q2-vitest.config.mts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const BREAKER_REF = "app/server/external-http-gateway/episteme-circuit-breaker.ts";
const SEARCH_REF = "app/server/services/search-execution.ts";
const SEARCH_TEST_REF = "app/server/services/__tests__/search-execution.test.ts";
const REVIEWED_SOURCE_FAILURE_TEST_REF =
  "scripts/architecture-fitness/__tests__/q2-search-failure-isolation.test.ts";
const SEARCH_SERVICE_MODULE_REF = "@/app/server/services/search-service";
const TOPOLOGY_POLICY_REF = "issue-280:episteme-breaker-process-scope";
const TOPOLOGY_CAPABILITY_REF = "capability:episteme-process-self-protection";
const TOPOLOGY_SCOPE_REF = "scope:episteme-circuit-breaker";
const CRITICAL_POLICY_REF = "issue-281:first-ready-search-payload";
const CRITICAL_CAPABILITY_REF = "capability:lighthouse-search";
const CRITICAL_MILESTONE_REF = "milestone:first-ready-search-payload";
const ZERO_DIGEST = "0".repeat(64);
const BEHAVIOR_TEST_NAME_PATTERN =
  "Q2 |degrades to the keyword first payload|returns a failed view when keyword retrieval fails";
const REQUIRED_BEHAVIOR_ASSERTIONS = [
  "degrades to the keyword first payload when the graph preflight fails",
  "returns a failed view when keyword retrieval fails",
  "keeps keyword results ready when the reviewed-library source read fails",
];

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

function nodeName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text;
  }
  return null;
}

function containsNode(node, predicate) {
  if (predicate(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsNode(child, predicate)) found = true;
  });
  return found;
}

function containsCall(node, functionName) {
  return containsNode(node, (candidate) => {
    if (!ts.isCallExpression(candidate)) return false;
    const expression = candidate.expression;
    return ts.isIdentifier(expression) && expression.text === functionName;
  });
}

function isCaughtCall(node, functionName) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === "catch" &&
    containsCall(node.expression.expression, functionName)
  );
}

function findFunction(syntax, functionName) {
  return syntax.statements.find(
    (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
}

function hasPropertyValue(node, propertyName, valueKind) {
  return containsNode(node, (candidate) => {
    if (!ts.isPropertyAssignment(candidate)) return false;
    return nodeName(candidate.name) === propertyName && candidate.initializer.kind === valueKind;
  });
}

function namedImportBindings(syntax, moduleRef) {
  const bindings = new Map();
  for (const statement of syntax.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleRef
    ) {
      continue;
    }
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    for (const element of namedBindings.elements) {
      bindings.set(element.name.text, {
        declaration: element,
        exportName: element.propertyName?.text ?? element.name.text,
      });
    }
  }
  return bindings;
}

function createSearchProgram(source, targetRoot) {
  const fileName = path.resolve(targetRoot, SEARCH_REF);
  const compilerOptions = {
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
  };
  const syntax = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const defaultHost = ts.createCompilerHost(compilerOptions, true);
  const host = {
    ...defaultHost,
    getCurrentDirectory: () => targetRoot,
    fileExists: (candidate) =>
      path.resolve(candidate) === fileName || defaultHost.fileExists(candidate),
    readFile: (candidate) =>
      path.resolve(candidate) === fileName ? source : defaultHost.readFile(candidate),
    getSourceFile: (candidate, languageVersion, onError, shouldCreateNewSourceFile) =>
      path.resolve(candidate) === fileName
        ? syntax
        : defaultHost.getSourceFile(candidate, languageVersion, onError, shouldCreateNewSourceFile),
  };
  const program = ts.createProgram({ rootNames: [fileName], options: compilerOptions, host });
  return { checker: program.getTypeChecker(), syntax };
}

function objectBindingPropertyNames(name) {
  if (!ts.isObjectBindingPattern(name)) return new Set();
  return new Set(
    name.elements.flatMap((element) => {
      const property = element.propertyName ?? element.name;
      const name = nodeName(property);
      return name ? [name] : [];
    }),
  );
}

function joinedPromiseBindings(executeSearch) {
  const entries = [];
  containsNode(executeSearch, (node) => {
    if (
      !ts.isVariableDeclaration(node) ||
      !ts.isArrayBindingPattern(node.name) ||
      !node.initializer ||
      !ts.isAwaitExpression(node.initializer) ||
      !ts.isCallExpression(node.initializer.expression)
    ) {
      return false;
    }
    const call = node.initializer.expression;
    if (
      !ts.isPropertyAccessExpression(call.expression) ||
      !ts.isIdentifier(call.expression.expression) ||
      call.expression.expression.text !== "Promise" ||
      call.expression.name.text !== "all" ||
      call.arguments.length !== 1 ||
      !ts.isArrayLiteralExpression(call.arguments[0])
    ) {
      return false;
    }
    const promises = call.arguments[0].elements;
    node.name.elements.forEach((binding, index) => {
      const promise = promises[index];
      if (binding && ts.isBindingElement(binding) && promise && ts.isIdentifier(promise)) {
        entries.push({ bindingName: binding.name, promiseName: promise.text });
      }
    });
    return false;
  });
  return entries;
}

function variableInitializer(executeSearch, variableName) {
  let initializer = null;
  containsNode(executeSearch, (node) => {
    if (
      !initializer &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === variableName
    ) {
      initializer = node.initializer ?? null;
    }
    return false;
  });
  return initializer;
}

function findKeywordSearchExport(syntax, checker, executeSearch) {
  const serviceBindings = namedImportBindings(syntax, SEARCH_SERVICE_MODULE_REF);
  const matches = [];
  containsNode(executeSearch, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) return false;
    const properties = objectBindingPropertyNames(node.name);
    if (!["papers", "total", "source"].every((property) => properties.has(property))) {
      return false;
    }
    const initializer = node.initializer;
    if (!ts.isAwaitExpression(initializer) || !ts.isCallExpression(initializer.expression)) {
      return false;
    }
    const expression = initializer.expression.expression;
    if (!ts.isIdentifier(expression)) return false;
    const binding = serviceBindings.get(expression.text);
    const symbol = checker.getSymbolAtLocation(expression);
    if (!binding || !symbol?.declarations?.includes(binding.declaration)) return false;
    matches.push(binding.exportName);
    return false;
  });
  for (const joined of joinedPromiseBindings(executeSearch)) {
    const properties = objectBindingPropertyNames(joined.bindingName);
    if (!["papers", "total", "source"].every((property) => properties.has(property))) {
      continue;
    }
    const initializer = variableInitializer(executeSearch, joined.promiseName);
    if (!initializer || !ts.isCallExpression(initializer)) continue;
    const expression = initializer.expression;
    if (!ts.isIdentifier(expression)) continue;
    const binding = serviceBindings.get(expression.text);
    const symbol = checker.getSymbolAtLocation(expression);
    if (!binding || !symbol?.declarations?.includes(binding.declaration)) continue;
    matches.push(binding.exportName);
  }
  if (matches.length !== 1) {
    throw new Error(
      `Unrecognized keyword-search role: expected exactly one awaited ${SEARCH_SERVICE_MODULE_REF} call returning papers, total, and source; observed ${String(matches.length)}`,
    );
  }
  return matches[0];
}

export function inspectBreakerTopology(source) {
  const syntax = ts.createSourceFile(
    BREAKER_REF,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const moduleState = new Map();
  for (const statement of syntax.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        moduleState.set(declaration.name.text, declaration.initializer ?? null);
      }
    }
  }
  const requiredLocalInitializers = {
    circuitLanes: (node) => ts.isObjectLiteralExpression(node),
    activeSlots: (node) => ts.isNumericLiteral(node) && node.text === "0",
    activeSlotsByLane: (node) => ts.isObjectLiteralExpression(node),
    slotWaiters: (node) => ts.isObjectLiteralExpression(node),
  };
  const invalid = Object.entries(requiredLocalInitializers)
    .filter(([name, accepts]) => {
      const initializer = moduleState.get(name);
      return !initializer || !accepts(initializer);
    })
    .map(([name]) => name);
  if (invalid.length > 0) {
    throw new Error(`Unrecognized Episteme breaker process-local state: ${invalid.join(", ")}`);
  }
  const requiredUsage = {
    circuitLanes: [
      "advanceState",
      "tripOpen",
      "closeCircuit",
      "recordOutcome",
      "isEpistemeBreakerOpen",
      "runThroughEpistemeBreaker",
    ],
    activeSlots: [
      "canAcquireSlot",
      "grantSlot",
      "drainSlotWaiters",
      "releaseSlot",
      "runThroughEpistemeBreaker",
    ],
    activeSlotsByLane: ["canAcquireSlot", "grantSlot", "drainSlotWaiters", "releaseSlot"],
    slotWaiters: ["acquireSlot", "drainSlotWaiters", "totalQueueDepth"],
  };
  const invalidUsage = Object.entries(requiredUsage).flatMap(([name, functionNames]) =>
    functionNames
      .filter((functionName) => {
        const declaration = findFunction(syntax, functionName);
        return (
          !declaration ||
          !containsNode(
            declaration,
            (candidate) => ts.isIdentifier(candidate) && candidate.text === name,
          )
        );
      })
      .map((functionName) => `${name}@${functionName}`),
  );
  if (invalidUsage.length > 0) {
    throw new Error(
      `Unrecognized Episteme breaker process-local state usage: ${invalidUsage.join(", ")}`,
    );
  }
  return {
    stateScopes: ["process"],
    coordinationScopes: ["process"],
  };
}

export function inspectSearchCriticalPathRole(source, targetRoot = ROOT) {
  const { checker, syntax } = createSearchProgram(source, targetRoot);
  const executeSearch = findFunction(syntax, "executeSearchFromUrl");
  const startPreflight = findFunction(syntax, "startLibraryNeighborhoodPreflight");
  const missing = [];
  if (!executeSearch) missing.push("function:executeSearchFromUrl");
  if (!startPreflight) missing.push("function:startLibraryNeighborhoodPreflight");
  const joinedPromises = executeSearch ? joinedPromiseBindings(executeSearch) : [];
  const joinedPromiseNames = new Set(joinedPromises.map((entry) => entry.promiseName));
  const legacySourceAwait =
    executeSearch &&
    containsNode(
      executeSearch,
      (node) =>
        ts.isAwaitExpression(node) &&
        isCaughtCall(node.expression, "resolveInternalReviewedPapersSource"),
    );
  const librarySourceInitializer = executeSearch
    ? variableInitializer(executeSearch, "libraryContextUserSourcePromise")
    : null;
  const libraryPreflightInitializer = executeSearch
    ? variableInitializer(executeSearch, "libraryPreflightPromise")
    : null;
  const concurrentSourceJoin =
    librarySourceInitializer &&
    containsNode(librarySourceInitializer, (node) =>
      isCaughtCall(node, "resolveInternalReviewedPapersSource"),
    ) &&
    libraryPreflightInitializer &&
    containsNode(
      libraryPreflightInitializer,
      (node) => ts.isIdentifier(node) && node.text === "libraryContextUserSourcePromise",
    ) &&
    containsCall(libraryPreflightInitializer, "startLibraryNeighborhoodPreflight") &&
    joinedPromiseNames.has("libraryPreflightPromise");
  if (executeSearch && !legacySourceAwait && !concurrentSourceJoin) {
    missing.push("awaited-caught-call:resolveInternalReviewedPapersSource");
  }
  let keywordSearchExport = null;
  if (executeSearch) {
    try {
      keywordSearchExport = findKeywordSearchExport(syntax, checker, executeSearch);
    } catch (error) {
      missing.push(error instanceof Error ? error.message : "awaited-role:keyword-search");
    }
  }
  const legacyPreflightAwait =
    executeSearch &&
    containsNode(
      executeSearch,
      (node) =>
        ts.isAwaitExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "libraryPreflightPromise",
    );
  if (
    executeSearch &&
    !legacyPreflightAwait &&
    !joinedPromiseNames.has("libraryPreflightPromise")
  ) {
    missing.push("awaited-value:libraryPreflightPromise");
  }
  if (
    startPreflight &&
    !containsNode(startPreflight, (node) =>
      isCaughtCall(node, "resolveLibraryNeighborhoodPreflight"),
    )
  ) {
    missing.push("caught-call:resolveLibraryNeighborhoodPreflight");
  }
  const blockingCatch =
    executeSearch &&
    containsNode(
      executeSearch,
      (node) =>
        ts.isCatchClause(node) &&
        hasPropertyValue(node.block, "status", ts.SyntaxKind.StringLiteral) &&
        containsNode(
          node.block,
          (candidate) =>
            ts.isPropertyAssignment(candidate) &&
            nodeName(candidate.name) === "status" &&
            ts.isStringLiteral(candidate.initializer) &&
            candidate.initializer.text === "failed",
        ) &&
        hasPropertyValue(node.block, "failed", ts.SyntaxKind.TrueKeyword) &&
        hasPropertyValue(node.block, "executed", ts.SyntaxKind.FalseKeyword),
    );
  if (!blockingCatch) missing.push("blocking-catch:keyword-search");
  if (missing.length > 0) {
    throw new Error(`Unrecognized first-ready search critical path: ${missing.join(" | ")}`);
  }
  return {
    keywordSearchExport,
    facts: {
      awaitedPhases: [
        "phase:reviewed-library-source",
        "phase:keyword-search",
        "phase:library-preflight",
      ],
      failureBlockingPhases: ["phase:keyword-search"],
    },
  };
}

export function inspectSearchCriticalPath(source) {
  return inspectSearchCriticalPathRole(source).facts;
}

export async function collectorDefinitionDigest() {
  const definitions = [];
  for (const ref of [
    COLLECTOR_REF,
    PROBE_REF,
    TEST_REF,
    TEST_CONFIG_REF,
    TRUST_POLICY_REF,
    SEARCH_TEST_REF,
    REVIEWED_SOURCE_FAILURE_TEST_REF,
  ]) {
    const file = ref === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, ref);
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
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${result.status}`);
  }
  return result.stdout;
}

async function materializeRevision(revision) {
  const root = await mkdtemp(path.join(os.tmpdir(), "lighthouse-q2-revision-"));
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
    // The trusted base owns the collector, behavior harness, and installed
    // dependencies. The target revision is mounted only as the source tree
    // inspected by that harness, so target lock drift is valid input.
    await symlink(path.join(ROOT, "node_modules"), path.join(root, "node_modules"), "dir");
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

export function normalizeTestReport(
  result,
  targetRoot,
  trustedRoot = ROOT,
  requiredAssertions = [],
) {
  const normalize = (value) =>
    String(value ?? "")
      .replaceAll(targetRoot, "<target-revision>")
      .replaceAll(trustedRoot, "<collector-authority>");
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
    const expectedTests = [TEST_REF, SEARCH_TEST_REF, REVIEWED_SOURCE_FAILURE_TEST_REF];
    const missingExpectedTests = expectedTests.filter(
      (relative) => !testResults.some((item) => item.name.endsWith(`/${relative}`)),
    );
    const allReportedTestsPassed =
      testResults.length === expectedTests.length &&
      testResults.every(
        (item) =>
          item.status === "passed" &&
          item.assertionResults.every((assertion) =>
            ["passed", "skipped"].includes(assertion.status),
          ),
      );
    const requiredAssertionsPassed = requiredAssertions.every((required) =>
      testResults.some((item) =>
        item.assertionResults.some(
          (assertion) => assertion.status === "passed" && assertion.fullName.includes(required),
        ),
      ),
    );
    return {
      exitCode:
        result.status === 0 &&
        missingExpectedTests.length === 0 &&
        allReportedTestsPassed &&
        requiredAssertionsPassed
          ? 0
          : 1,
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

export function executeBehaviorSuite(targetRoot) {
  const targetSearchSource = readFileSync(path.join(targetRoot, SEARCH_REF), "utf8");
  const { keywordSearchExport } = inspectSearchCriticalPathRole(targetSearchSource, targetRoot);
  const trustedQ2Test = path.join(ROOT, TEST_REF);
  const trustedSearchTest = path.join(ROOT, SEARCH_TEST_REF);
  const trustedReviewedSourceFailureTest = path.join(ROOT, REVIEWED_SOURCE_FAILURE_TEST_REF);
  const trustedConfig = path.join(ROOT, TEST_CONFIG_REF);
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    [
      "run",
      trustedQ2Test,
      trustedSearchTest,
      trustedReviewedSourceFailureTest,
      "--config",
      trustedConfig,
      "--reporter=json",
      "--testNamePattern",
      BEHAVIOR_TEST_NAME_PATTERN,
    ],
    {
      cwd: targetRoot,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        NODE_ENV: "test",
        AF_Q2_TARGET_ROOT: targetRoot,
        AF_Q2_TRUSTED_HARNESS_ROOT: ROOT,
        AF_Q2_KEYWORD_SEARCH_EXPORT: keywordSearchExport,
      },
    },
  );
  return normalizeTestReport(result, targetRoot, ROOT, REQUIRED_BEHAVIOR_ASSERTIONS);
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
    const breakerSource = await readFile(path.join(targetRoot, BREAKER_REF), "utf8");
    const searchSource = await readFile(path.join(targetRoot, SEARCH_REF), "utf8");
    const topology = inspectBreakerTopology(breakerSource);
    const { facts: criticalPath } = inspectSearchCriticalPathRole(searchSource, targetRoot);
    const behavior = executeBehaviorSuite(targetRoot);
    const behaviorDigest = canonicalDigest(behavior);
    const coverageDigest = canonicalDigest({
      breaker: sha256(breakerSource),
      search: sha256(searchSource),
    });
    const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-280-281.policy.json --revision ${revision} --run-ref ${runRef}`;
    const behaviorCommand = `node_modules/.bin/vitest run <collector-authority>/${TEST_REF} <collector-authority>/${SEARCH_TEST_REF} <collector-authority>/${REVIEWED_SOURCE_FAILURE_TEST_REF} --config <collector-authority>/${TEST_CONFIG_REF} --reporter=json --testNamePattern "${BEHAVIOR_TEST_NAME_PATTERN}"`;
    const evidenceItems = [
      evidence({
        id: "topology-coverage-static:q2-macro",
        kind: "static",
        role: "topology-coverage-static",
        source: BREAKER_REF,
        revision,
        summary:
          "The included topology inventory contains the Episteme process-self-protection scope.",
        command,
        exitCode: 0,
        digest: coverageDigest,
        runRef,
        target: {
          policyRef: TOPOLOGY_POLICY_REF,
          capabilityRef: TOPOLOGY_CAPABILITY_REF,
          scopeRefs: [TOPOLOGY_SCOPE_REF],
          factRefs: ["coverage:all-topology-scopes"],
        },
      }),
      evidence({
        id: "topology-coverage-negative-guard:q2-macro",
        kind: "test",
        role: "topology-coverage-negative-guard",
        source: BREAKER_REF,
        revision,
        summary:
          "The exact-revision suite rejects missing module-local breaker ownership and verifies process isolation.",
        command: behaviorCommand,
        exitCode: behavior.exitCode,
        digest: behaviorDigest,
        runRef,
        target: {
          policyRef: TOPOLOGY_POLICY_REF,
          capabilityRef: TOPOLOGY_CAPABILITY_REF,
          scopeRefs: [TOPOLOGY_SCOPE_REF],
          factRefs: ["coverage:scope-mismatch-negative-guard"],
        },
      }),
      evidence({
        id: "topology-static:episteme-breaker",
        kind: "static",
        role: "topology-static",
        source: BREAKER_REF,
        revision,
        summary: "Circuit state, active slots, and waiters are module-local process state.",
        command,
        exitCode: 0,
        digest: sha256(breakerSource),
        runRef,
        target: {
          policyRef: TOPOLOGY_POLICY_REF,
          capabilityRef: TOPOLOGY_CAPABILITY_REF,
          scopeRefs: [TOPOLOGY_SCOPE_REF],
          factRefs: ["state-scope:process", "coordination-scope:process"],
        },
      }),
      evidence({
        id: "topology-behavior-test:episteme-breaker",
        kind: "test",
        role: "topology-behavior-test",
        source: BREAKER_REF,
        revision,
        summary: "One spawned process trips OPEN while an independent process remains CLOSED.",
        command: behaviorCommand,
        exitCode: behavior.exitCode,
        digest: behaviorDigest,
        runRef,
        target: {
          policyRef: TOPOLOGY_POLICY_REF,
          capabilityRef: TOPOLOGY_CAPABILITY_REF,
          scopeRefs: [TOPOLOGY_SCOPE_REF],
          factRefs: [
            "behavior:n-instance-scope-observed",
            "state-scope:process",
            "coordination-scope:process",
          ],
        },
      }),
      evidence({
        id: "critical-path-coverage-static:q2-macro",
        kind: "static",
        role: "critical-path-coverage-static",
        source: SEARCH_REF,
        revision,
        summary:
          "The included critical-path inventory contains the first-ready search payload milestone.",
        command,
        exitCode: 0,
        digest: coverageDigest,
        runRef,
        target: {
          policyRef: CRITICAL_POLICY_REF,
          capabilityRef: CRITICAL_CAPABILITY_REF,
          milestoneRefs: [CRITICAL_MILESTONE_REF],
          factRefs: ["coverage:all-critical-path-milestones"],
        },
      }),
      evidence({
        id: "critical-path-coverage-negative-guard:q2-macro",
        kind: "test",
        role: "critical-path-coverage-negative-guard",
        source: SEARCH_REF,
        revision,
        summary: "The exact-revision suite rejects an omitted await or failure-isolation relation.",
        command: behaviorCommand,
        exitCode: behavior.exitCode,
        digest: behaviorDigest,
        runRef,
        target: {
          policyRef: CRITICAL_POLICY_REF,
          capabilityRef: CRITICAL_CAPABILITY_REF,
          milestoneRefs: [CRITICAL_MILESTONE_REF],
          factRefs: ["coverage:forbidden-blocking-negative-guard"],
        },
      }),
      evidence({
        id: "critical-path-static:first-ready-search",
        kind: "static",
        role: "critical-path-static",
        source: SEARCH_REF,
        revision,
        summary:
          "The first ready payload awaits reviewed-library source, keyword search, and library preflight; keyword failure blocks readiness.",
        command,
        exitCode: 0,
        digest: sha256(searchSource),
        runRef,
        target: {
          policyRef: CRITICAL_POLICY_REF,
          capabilityRef: CRITICAL_CAPABILITY_REF,
          milestoneRefs: [CRITICAL_MILESTONE_REF],
          factRefs: [
            ...criticalPath.awaitedPhases.map((phase) => `awaited-phase:${phase}`),
            ...criticalPath.failureBlockingPhases.map((phase) => `failure-blocking-phase:${phase}`),
          ],
        },
      }),
      evidence({
        id: "critical-path-behavior-test:first-ready-search",
        kind: "test",
        role: "critical-path-behavior-test",
        source: SEARCH_REF,
        revision,
        summary:
          "The collector-authority behavior harness verifies that reviewed-library source and graph-preflight failures preserve this target-revision keyword payload, while keyword failure blocks readiness and static negative mutations reject await-graph drift.",
        command: behaviorCommand,
        exitCode: behavior.exitCode,
        digest: behaviorDigest,
        runRef,
        target: {
          policyRef: CRITICAL_POLICY_REF,
          capabilityRef: CRITICAL_CAPABILITY_REF,
          milestoneRefs: [CRITICAL_MILESTONE_REF],
          factRefs: [
            "behavior:failure-isolation-observed",
            "behavior:failure-isolation-observed:phase:reviewed-library-source",
            "behavior:failure-isolation-observed:phase:library-preflight",
          ],
        },
      }),
    ];
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
          id: "observation:episteme-breaker-process-scope",
          policyRef: TOPOLOGY_POLICY_REF,
          capabilityRef: TOPOLOGY_CAPABILITY_REF,
          completeness: "complete",
          coverageEvidenceRefs: [
            "topology-coverage-static:q2-macro",
            "topology-coverage-negative-guard:q2-macro",
          ],
          scopes: [
            {
              id: "observed-scope:episteme-circuit-breaker",
              scopeRef: TOPOLOGY_SCOPE_REF,
              stateScopes: topology.stateScopes,
              coordinationScopes: topology.coordinationScopes,
              evidenceRefs: [
                "topology-static:episteme-breaker",
                "topology-behavior-test:episteme-breaker",
              ],
            },
          ],
        },
        {
          id: "observation:first-ready-search-payload",
          policyRef: CRITICAL_POLICY_REF,
          capabilityRef: CRITICAL_CAPABILITY_REF,
          completeness: "complete",
          coverageEvidenceRefs: [
            "critical-path-coverage-static:q2-macro",
            "critical-path-coverage-negative-guard:q2-macro",
          ],
          milestones: [
            {
              id: "observed-milestone:first-ready-search-payload",
              milestoneRef: CRITICAL_MILESTONE_REF,
              awaitedPhases: criticalPath.awaitedPhases,
              failureBlockingPhases: criticalPath.failureBlockingPhases,
              evidenceRefs: [
                "critical-path-static:first-ready-search",
                "critical-path-behavior-test:first-ready-search",
              ],
            },
          ],
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
