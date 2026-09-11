#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

import { assertLighthouseCollectorAuthority } from "./lighthouse-trust-policy.mjs";

const ROOT = process.cwd();
const COLLECTOR_REF = "scripts/architecture-fitness/collect-q5-cache-lifecycle.mjs";
const COLLECTOR_PATH = path.join(ROOT, COLLECTOR_REF);
const BOUNDARY_TEST_REF =
  "scripts/architecture-fitness/__tests__/q5-cache-lifecycle-boundaries.test.ts";
const PROBE_TEST_REF = "scripts/architecture-fitness/__tests__/q5-cache-lifecycle-probe.test.ts";
const TEST_CONFIG_REF = "scripts/architecture-fitness/q5-vitest.config.mts";
const TRUST_POLICY_REF = "scripts/architecture-fitness/lighthouse-trust-policy.mjs";
const SOURCE_REF = "app/server/services/library-anchor-display.ts";
const POLICY_REF = "issue-298:preset-title-cache-lifecycle";
const CAPABILITY_REF = "capability:lighthouse-preset-title-display";
const CACHE_REF = "cache:lighthouse-preset-title";
const SCENARIO_REF = "scenario:lighthouse-preset-title-concurrent-fill";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalDigest(value) {
  return sha256(canonicalJson(value));
}

function git(args, { accepted = new Set([0]), encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: ROOT,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (!accepted.has(result.status)) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(stderr?.trim() || stdout?.trim() || `git exited ${result.status}`);
  }
  return result;
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function numericValue(node) {
  const current = unwrapExpression(node);
  if (!current) return null;
  if (ts.isNumericLiteral(current)) return Number(current.text.replaceAll("_", ""));
  if (ts.isPrefixUnaryExpression(current) && current.operator === ts.SyntaxKind.MinusToken) {
    const value = numericValue(current.operand);
    return value == null ? null : -value;
  }
  if (ts.isBinaryExpression(current)) {
    const left = numericValue(current.left);
    const right = numericValue(current.right);
    if (left == null || right == null) return null;
    if (current.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right;
    if (current.operatorToken.kind === ts.SyntaxKind.PlusToken) return left + right;
  }
  return null;
}

function objectLiteralForVariable(sourceFile, variableName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName) continue;
      const initializer = unwrapExpression(declaration.initializer);
      return initializer && ts.isObjectLiteralExpression(initializer) ? initializer : null;
    }
  }
  return null;
}

function objectNumber(object, propertyName) {
  if (!object) return null;
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const observedName =
      ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)
        ? name.text
        : null;
    if (observedName === propertyName) return numericValue(property.initializer);
  }
  return null;
}

function hasModuleMap(sourceFile, variableName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== variableName) continue;
      const initializer = unwrapExpression(declaration.initializer);
      return Boolean(
        initializer &&
        ts.isNewExpression(initializer) &&
        ts.isIdentifier(initializer.expression) &&
        initializer.expression.text === "Map",
      );
    }
  }
  return false;
}

function visitNodes(node, visitor) {
  visitor(node);
  node.forEachChild((child) => visitNodes(child, visitor));
}

function hasImportedBinding(sourceFile, moduleRef, bindingName) {
  return sourceFile.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== moduleRef
    ) {
      return false;
    }
    const bindings = statement.importClause?.namedBindings;
    return (
      bindings &&
      ts.isNamedImports(bindings) &&
      bindings.elements.some(
        (element) => (element.propertyName?.text ?? element.name.text) === bindingName,
      )
    );
  });
}

function hasIdentifierCall(node, functionName) {
  let found = false;
  visitNodes(node, (candidate) => {
    if (
      ts.isCallExpression(candidate) &&
      ts.isIdentifier(unwrapExpression(candidate.expression)) &&
      unwrapExpression(candidate.expression).text === functionName
    ) {
      found = true;
    }
  });
  return found;
}

function hasMemberCall(sourceFile, ownerName, methodName, firstArgumentName) {
  let found = false;
  visitNodes(sourceFile, (candidate) => {
    if (!ts.isCallExpression(candidate)) return;
    const expression = unwrapExpression(candidate.expression);
    if (
      !ts.isPropertyAccessExpression(expression) ||
      !ts.isIdentifier(expression.expression) ||
      expression.expression.text !== ownerName ||
      expression.name.text !== methodName
    ) {
      return;
    }
    if (firstArgumentName) {
      const firstArgument = unwrapExpression(candidate.arguments[0]);
      if (
        !firstArgument ||
        !ts.isIdentifier(firstArgument) ||
        firstArgument.text !== firstArgumentName
      )
        return;
    }
    found = true;
  });
  return found;
}

function hasPolicyProperty(sourceFile, propertyName) {
  let found = false;
  visitNodes(sourceFile, (candidate) => {
    if (
      ts.isPropertyAccessExpression(candidate) &&
      ts.isIdentifier(candidate.expression) &&
      candidate.expression.text === "LIBRARY_ANCHOR_TITLE_CACHE_POLICY" &&
      candidate.name.text === propertyName
    ) {
      found = true;
    }
  });
  return found;
}

function hasExpiryComparison(sourceFile) {
  let found = false;
  visitNodes(sourceFile, (candidate) => {
    if (
      ts.isBinaryExpression(candidate) &&
      candidate.operatorToken.kind === ts.SyntaxKind.LessThanEqualsToken &&
      ts.isPropertyAccessExpression(unwrapExpression(candidate.left)) &&
      unwrapExpression(candidate.left).name.text === "expiresAt" &&
      ts.isIdentifier(unwrapExpression(candidate.right)) &&
      unwrapExpression(candidate.right).text === "now"
    ) {
      found = true;
    }
  });
  return found;
}

function hasCapacityComparison(sourceFile) {
  let found = false;
  visitNodes(sourceFile, (candidate) => {
    if (!ts.isBinaryExpression(candidate)) return;
    if (candidate.operatorToken.kind !== ts.SyntaxKind.GreaterThanToken) return;
    const left = unwrapExpression(candidate.left);
    const right = unwrapExpression(candidate.right);
    if (
      ts.isPropertyAccessExpression(left) &&
      ts.isIdentifier(left.expression) &&
      left.expression.text === "epistemeTitleCache" &&
      left.name.text === "size" &&
      ts.isPropertyAccessExpression(right) &&
      ts.isIdentifier(right.expression) &&
      right.expression.text === "LIBRARY_ANCHOR_TITLE_CACHE_POLICY" &&
      right.name.text === "maxEntries"
    ) {
      found = true;
    }
  });
  return found;
}

function hasIdentifier(node, identifierName) {
  let found = false;
  visitNodes(node, (candidate) => {
    if (ts.isIdentifier(candidate) && candidate.text === identifierName) found = true;
  });
  return found;
}

function hasHydrateProviderSignal(node) {
  let found = false;
  visitNodes(node, (candidate) => {
    if (
      !ts.isCallExpression(candidate) ||
      !ts.isIdentifier(unwrapExpression(candidate.expression)) ||
      unwrapExpression(candidate.expression).text !== "hydrateEpistemePapers"
    ) {
      return;
    }
    found = candidate.arguments.some((argument) => {
      const current = unwrapExpression(argument);
      return (
        ts.isPropertyAccessExpression(current) &&
        ts.isIdentifier(current.expression) &&
        current.expression.text === "controller" &&
        current.name.text === "signal"
      );
    });
  });
  return found;
}

function hasProviderDeadline(sourceFile) {
  let timeoutAbortsProvider = false;
  let racesProviderAgainstDeadline = false;
  visitNodes(sourceFile, (candidate) => {
    if (!ts.isCallExpression(candidate)) return;
    const expression = unwrapExpression(candidate.expression);
    if (ts.isIdentifier(expression) && expression.text === "setTimeout") {
      const delay = unwrapExpression(candidate.arguments[1]);
      const callback = unwrapExpression(candidate.arguments[0]);
      if (
        delay &&
        ts.isPropertyAccessExpression(delay) &&
        ts.isIdentifier(delay.expression) &&
        delay.expression.text === "LIBRARY_ANCHOR_TITLE_CACHE_POLICY" &&
        delay.name.text === "providerTimeoutMs" &&
        callback &&
        (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
        hasMemberCall(callback, "controller", "abort")
      ) {
        timeoutAbortsProvider = true;
      }
      return;
    }
    if (
      ts.isPropertyAccessExpression(expression) &&
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "Promise" &&
      expression.name.text === "race"
    ) {
      const entries = unwrapExpression(candidate.arguments[0]);
      if (
        entries &&
        ts.isArrayLiteralExpression(entries) &&
        hasHydrateProviderSignal(entries) &&
        hasIdentifier(entries, "providerDeadline")
      ) {
        racesProviderAgainstDeadline = true;
      }
    }
  });
  return timeoutAbortsProvider && racesProviderAgainstDeadline;
}

function isOldestCacheKeyExpression(node) {
  const value = unwrapExpression(node);
  if (
    !value ||
    !ts.isPropertyAccessExpression(value) ||
    value.name.text !== "value" ||
    !ts.isCallExpression(unwrapExpression(value.expression))
  ) {
    return false;
  }
  const nextCall = unwrapExpression(value.expression);
  const nextMember = unwrapExpression(nextCall.expression);
  if (
    !ts.isPropertyAccessExpression(nextMember) ||
    nextMember.name.text !== "next" ||
    !ts.isCallExpression(unwrapExpression(nextMember.expression))
  ) {
    return false;
  }
  const keysCall = unwrapExpression(nextMember.expression);
  const keysMember = unwrapExpression(keysCall.expression);
  return (
    ts.isPropertyAccessExpression(keysMember) &&
    ts.isIdentifier(keysMember.expression) &&
    keysMember.expression.text === "epistemeTitleCache" &&
    keysMember.name.text === "keys"
  );
}

function hasLruEviction(sourceFile) {
  let found = false;
  visitNodes(sourceFile, (candidate) => {
    if (!ts.isWhileStatement(candidate) || !hasCapacityComparison(candidate.expression)) return;
    const oldestKeyNames = [];
    visitNodes(candidate.statement, (statementNode) => {
      if (
        ts.isVariableDeclaration(statementNode) &&
        ts.isIdentifier(statementNode.name) &&
        isOldestCacheKeyExpression(statementNode.initializer)
      ) {
        oldestKeyNames.push(statementNode.name.text);
      }
    });
    if (
      oldestKeyNames.some((name) =>
        hasMemberCall(candidate.statement, "epistemeTitleCache", "delete", name),
      )
    ) {
      found = true;
    }
  });
  return found;
}

function chainedProviderCallback(sourceFile, methodName) {
  let callback = null;
  visitNodes(sourceFile, (candidate) => {
    if (!ts.isCallExpression(candidate)) return;
    const expression = unwrapExpression(candidate.expression);
    if (
      !ts.isPropertyAccessExpression(expression) ||
      expression.name.text !== methodName ||
      !hasIdentifierCall(expression.expression, "hydrateEpistemePapers")
    ) {
      return;
    }
    const argument = unwrapExpression(candidate.arguments[0]);
    if (argument && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument))) {
      callback = argument;
    }
  });
  return callback;
}

export function inspectPresetTitleSource(source) {
  const sourceFile = ts.createSourceFile(
    SOURCE_REF,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const policy = objectLiteralForVariable(sourceFile, "LIBRARY_ANCHOR_TITLE_CACHE_POLICY");
  const positiveTtlMs = objectNumber(policy, "positiveTtlMs");
  const negativeTtlMs = objectNumber(policy, "negativeTtlMs");
  const maxEntries = objectNumber(policy, "maxEntries");
  const providerTimeoutMs = objectNumber(policy, "providerTimeoutMs");
  const hasCache = hasModuleMap(sourceFile, "epistemeTitleCache");
  const hasInFlight = hasModuleMap(sourceFile, "inFlightEpistemeTitles");
  const hasProviderSource =
    hasImportedBinding(sourceFile, "./episteme-literature", "hydrateEpistemePapers") &&
    hasIdentifierCall(sourceFile, "hydrateEpistemePapers");
  const hasTtlExpiry =
    hasCache &&
    hasExpiryComparison(sourceFile) &&
    hasMemberCall(sourceFile, "epistemeTitleCache", "delete", "paperId");
  const hasCapacity = hasCache && hasLruEviction(sourceFile);
  const appliesProviderDeadline = hasProviderDeadline(sourceFile);
  const hasNegativeTtl =
    hasPolicyProperty(sourceFile, "positiveTtlMs") &&
    hasPolicyProperty(sourceFile, "negativeTtlMs");
  const hasSingleFlight =
    hasInFlight &&
    hasMemberCall(sourceFile, "inFlightEpistemeTitles", "get", "paperId") &&
    hasMemberCall(sourceFile, "inFlightEpistemeTitles", "set", "paperId") &&
    hasMemberCall(sourceFile, "inFlightEpistemeTitles", "delete", "paperId");
  const providerThen = chainedProviderCallback(sourceFile, "then");
  const providerCatch = chainedProviderCallback(sourceFile, "catch");
  const excludesFailures =
    providerThen &&
    providerCatch &&
    hasIdentifierCall(providerThen, "cacheEpistemeTitle") &&
    !hasIdentifierCall(providerCatch, "cacheEpistemeTitle");

  return {
    cacheRef: CACHE_REF,
    sourceOwnerRef: hasProviderSource ? "source:episteme-paper-title" : "source:unresolved",
    keyRefs:
      hasCache &&
      hasMemberCall(sourceFile, "epistemeTitleCache", "get", "paperId") &&
      hasMemberCall(sourceFile, "epistemeTitleCache", "set", "paperId")
        ? ["key:public-raw-paper-id"]
        : ["key:unresolved"],
    freshnessRef:
      Number.isInteger(positiveTtlMs) && Number.isInteger(negativeTtlMs)
        ? `freshness:positive-${positiveTtlMs}ms-negative-${negativeTtlMs}ms`
        : "freshness:unresolved",
    invalidationRefs: [
      hasTtlExpiry ? "invalidation:ttl-expiry" : "invalidation:ttl-unresolved",
      hasCapacity && Number.isInteger(maxEntries)
        ? `invalidation:lru-capacity-${maxEntries}`
        : "invalidation:capacity-unresolved",
    ],
    missRef:
      hasProviderSource && appliesProviderDeadline && Number.isInteger(providerTimeoutMs)
        ? `miss:provider-fill-deadline-${providerTimeoutMs}ms`
        : "miss:unresolved",
    negativeResultRef:
      hasNegativeTtl && Number.isInteger(negativeTtlMs)
        ? `negative:cache-null-${negativeTtlMs}ms`
        : "negative:unresolved",
    failureRef: excludesFailures
      ? "failure:do-not-cache-timeout-or-provider-error"
      : "failure:unresolved",
    fillControlRef: hasSingleFlight ? "fill:process-single-flight-per-id" : "fill:unresolved",
    sharingScope: hasCache ? "process" : "fleet",
    persistenceScope: hasCache ? "ephemeral" : "durable",
  };
}

const PROBE_ASSERTION_SUFFIXES = [
  "coalesces same-id fills and shares the resolved title",
  "isolates caller abort from the shared provider fill",
];

export function normalizeProbeTestReport(test) {
  const assertions = (test?.tests ?? []).flatMap((item) => item.assertions ?? []);
  const expectedAssertions = PROBE_ASSERTION_SUFFIXES.map((suffix) =>
    assertions.find((assertion) => assertion.name.endsWith(suffix)),
  );
  const valid =
    test?.exitCode === 0 &&
    test?.tests?.length === 1 &&
    expectedAssertions.every((assertion) => assertion?.status === "passed");
  if (!valid) {
    return { valid: false, outcomeRefs: ["outcome:probe-unavailable"] };
  }
  return {
    valid: true,
    outcomeRefs: [
      "outcome:one-provider-fill",
      "outcome:waiters-share-title",
      "outcome:caller-abort-isolated",
    ],
  };
}

async function materializeRevision(revision) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lighthouse-q5-revision-"));
  const archive = git(["archive", "--format=tar", revision], { encoding: null });
  const extracted = spawnSync("tar", ["-x", "-C", directory], {
    input: archive.stdout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (extracted.status !== 0) {
    await rm(directory, { recursive: true, force: true });
    throw new Error(extracted.stderr?.toString("utf8") || "could not extract revision");
  }
  return directory;
}

function normalizeVitestResult(result, expectedTestRef) {
  try {
    const report = JSON.parse(result.stdout);
    const tests = (report.testResults ?? []).map((item) => ({
      name: String(item.name).replaceAll(ROOT, "<collector-authority>"),
      status: item.status,
      assertions: (item.assertionResults ?? []).map((assertion) => ({
        name: assertion.fullName,
        status: assertion.status,
      })),
    }));
    const expectedPresent = tests.some((item) => item.name.endsWith(`/${expectedTestRef}`));
    const passed =
      result.status === 0 &&
      expectedPresent &&
      tests.length === 1 &&
      tests.every(
        (item) =>
          item.status === "passed" &&
          item.assertions.every((assertion) => assertion.status === "passed"),
      );
    return {
      exitCode: passed ? 0 : 1,
      numTotalTests: report.numTotalTests,
      numPassedTests: report.numPassedTests,
      tests,
    };
  } catch {
    return {
      exitCode: 1,
      stdout: result.stdout?.replaceAll(ROOT, "<collector-authority>"),
      stderr: result.stderr?.replaceAll(ROOT, "<collector-authority>"),
    };
  }
}

function executeBoundarySuite() {
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    ["run", path.join(ROOT, BOUNDARY_TEST_REF), "--reporter=json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    },
  );
  return normalizeVitestResult(result, BOUNDARY_TEST_REF);
}

function executeProbe(targetRoot) {
  const result = spawnSync(
    path.join(ROOT, "node_modules", ".bin", "vitest"),
    [
      "run",
      path.join(ROOT, PROBE_TEST_REF),
      "--config",
      path.join(ROOT, TEST_CONFIG_REF),
      "--reporter=json",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? os.homedir(),
        NODE_ENV: "test",
        AF_Q5_TARGET_ROOT: targetRoot,
        AF_Q5_TRUSTED_HARNESS_ROOT: ROOT,
      },
    },
  );
  const test = normalizeVitestResult(result, PROBE_TEST_REF);
  const normalized = normalizeProbeTestReport(test);
  return {
    exitCode: test.exitCode === 0 && normalized.valid ? 0 : 1,
    test,
    normalized,
  };
}

export async function collectorDefinitionDigest() {
  const definitions = [];
  for (const ref of [
    COLLECTOR_REF,
    BOUNDARY_TEST_REF,
    PROBE_TEST_REF,
    TEST_CONFIG_REF,
    TRUST_POLICY_REF,
  ]) {
    const file = ref === COLLECTOR_REF ? COLLECTOR_PATH : path.join(ROOT, ref);
    definitions.push({ ref, digest: sha256(await readFile(file)) });
  }
  return canonicalDigest(definitions);
}

function cacheFact(cache) {
  return `cache-observation-sha256:${canonicalDigest({
    cacheRef: cache.cacheRef,
    sourceOwnerRef: cache.sourceOwnerRef,
    keyRefs: cache.keyRefs,
    freshnessRef: cache.freshnessRef,
    invalidationRefs: cache.invalidationRefs,
    missRef: cache.missRef,
    negativeResultRef: cache.negativeResultRef,
    failureRef: cache.failureRef,
    fillControlRef: cache.fillControlRef,
    sharingScope: cache.sharingScope,
    persistenceScope: cache.persistenceScope,
  })}`;
}

function scenarioFact(scenario) {
  return `cache-scenario-observation-sha256:${canonicalDigest({
    scenarioRef: scenario.scenarioRef,
    cacheRef: scenario.cacheRef,
    scenarioKind: scenario.scenarioKind,
    outcomeRefs: scenario.outcomeRefs,
  })}`;
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
  assert(SHA_PATTERN.test(revision), "revision must be a 40-character commit SHA");
  git(["cat-file", "-e", `${revision}^{commit}`]);
  const authority = policy.policySet?.collectorAuthority ?? {};
  assertLighthouseCollectorAuthority(authority);
  const definitionDigest = await collectorDefinitionDigest();
  assert(authority.adapterRef === COLLECTOR_REF, `policy adapterRef must equal ${COLLECTOR_REF}`);
  assert(
    authority.definitionDigest === definitionDigest,
    `collector definition digest mismatch: policy=${authority.definitionDigest} observed=${definitionDigest}`,
  );

  let source = "";
  let sourceExitCode = 0;
  try {
    source = git(["show", `${revision}:${SOURCE_REF}`]).stdout;
  } catch {
    sourceExitCode = 1;
  }
  const cache = {
    id: `observed-${CACHE_REF.slice("cache:".length)}`,
    ...inspectPresetTitleSource(source),
    evidenceRefs: [
      "cache-lifecycle-policy-static:preset-title",
      "cache-lifecycle-behavior-test:preset-title",
    ],
  };
  const boundary = executeBoundarySuite();
  let targetRoot;
  let probe;
  try {
    targetRoot = await materializeRevision(revision);
    probe = executeProbe(targetRoot);
  } catch (error) {
    probe = {
      exitCode: 1,
      error: error instanceof Error ? error.message : String(error),
      normalized: normalizeProbeTestReport(null),
    };
  } finally {
    if (targetRoot) await rm(targetRoot, { recursive: true, force: true });
  }
  const scenario = {
    id: `observed-${SCENARIO_REF.slice("scenario:".length)}`,
    scenarioRef: SCENARIO_REF,
    cacheRef: CACHE_REF,
    scenarioKind: "concurrent-fill",
    outcomeRefs: probe.normalized.outcomeRefs,
    evidenceRefs: ["cache-lifecycle-scenario-test:preset-title"],
  };
  const command = `node ${COLLECTOR_REF} --policy docs/architecture-fitness/pilots/issue-298-q5-cache-lifecycle.policy.json --revision ${revision} --run-ref ${runRef}`;
  const probeCommand = `AF_Q5_TARGET_ROOT=<revision:${revision}> node_modules/.bin/vitest run ${PROBE_TEST_REF} --config ${TEST_CONFIG_REF} --reporter=json`;
  const cacheRefs = [CACHE_REF];
  const scenarioRefs = [SCENARIO_REF];
  const inspectionDigest = canonicalDigest({ sourceDigest: sha256(source), cache });
  const boundaryDigest = canonicalDigest(boundary);
  const probeDigest = canonicalDigest(probe);
  const evidenceItems = [
    evidence({
      id: "cache-lifecycle-coverage-static:q5",
      kind: "static",
      role: "cache-lifecycle-coverage-static",
      source: SOURCE_REF,
      revision,
      summary:
        "The inventory contains the selected preset-title cache and concurrent-fill scenario.",
      command,
      exitCode: sourceExitCode,
      digest: inspectionDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        cacheRefs,
        lifecycleScenarioRefs: scenarioRefs,
        factRefs: ["coverage:all-cache-lifecycle-objects"],
      },
    }),
    evidence({
      id: "cache-lifecycle-coverage-negative-guard:q5",
      kind: "test",
      role: "cache-lifecycle-coverage-negative-guard",
      source: BOUNDARY_TEST_REF,
      revision,
      summary:
        "The collector-authority guard detects changed freshness, capacity, fill control, and measured scenario outcomes.",
      command: `node_modules/.bin/vitest run ${BOUNDARY_TEST_REF} --reporter=json`,
      exitCode: boundary.exitCode,
      digest: boundaryDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        cacheRefs,
        lifecycleScenarioRefs: scenarioRefs,
        factRefs: ["coverage:cache-lifecycle-negative-guard"],
      },
    }),
    evidence({
      id: "cache-lifecycle-policy-static:preset-title",
      kind: "static",
      role: "cache-lifecycle-policy-static",
      source: SOURCE_REF,
      revision,
      summary:
        "The collector normalizes the preset-title source, identity, freshness, invalidation, failure, fill, and scope facts.",
      command,
      exitCode: sourceExitCode,
      digest: inspectionDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        cacheRefs,
        lifecycleScenarioRefs: [],
        factRefs: [cacheFact(cache), "structure:cache-policy-observed"],
      },
    }),
    evidence({
      id: "cache-lifecycle-behavior-test:preset-title",
      kind: "test",
      role: "cache-lifecycle-behavior-test",
      source: PROBE_TEST_REF,
      revision,
      summary:
        "The collector-authority probe executes the exact-revision preset-title cache through controlled provider fills.",
      command: probeCommand,
      exitCode: probe.exitCode,
      digest: probeDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        cacheRefs,
        lifecycleScenarioRefs: [],
        factRefs: [cacheFact(cache), "behavior:cache-lifecycle-observed"],
      },
    }),
    evidence({
      id: "cache-lifecycle-scenario-test:preset-title",
      kind: "test",
      role: "cache-lifecycle-scenario-test",
      source: PROBE_TEST_REF,
      revision,
      summary:
        "The probe records provider-fill count, waiter results, and caller-abort isolation without declaring a verdict.",
      command: probeCommand,
      exitCode: probe.exitCode,
      digest: probeDigest,
      runRef,
      target: {
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        cacheRefs,
        lifecycleScenarioRefs: scenarioRefs,
        factRefs: [scenarioFact(scenario), "behavior:cache-scenario-observed"],
      },
    }),
  ];
  const complete = sourceExitCode === 0 && boundary.exitCode === 0 && probe.exitCode === 0;
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
        payloadDigest: "0".repeat(64),
        signature: "0".repeat(64),
      },
    },
    evidence: evidenceItems,
    observations: [
      {
        id: "observation:issue-298-q5-cache-lifecycle",
        policyRef: POLICY_REF,
        capabilityRef: CAPABILITY_REF,
        completeness: complete ? "complete" : "partial",
        coverageEvidenceRefs: [
          "cache-lifecycle-coverage-static:q5",
          "cache-lifecycle-coverage-negative-guard:q5",
        ],
        caches: [cache],
        lifecycleScenarios: [scenario],
      },
    ],
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--policy", "--revision", "--run-ref", "--output"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${key}`);
    options[key.slice(2)] = value;
    index += 1;
  }
  for (const key of ["policy", "revision", "run-ref", "output"]) {
    if (!options[key]) throw new Error(`Missing --${key}`);
  }
  return {
    policy: options.policy,
    revision: options.revision,
    runRef: options["run-ref"],
    output: options.output,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const policy = JSON.parse(await readFile(path.resolve(options.policy), "utf8"));
  const observation = await collectObservation({
    policy,
    revision: options.revision,
    runRef: options.runRef,
  });
  await writeFile(path.resolve(options.output), `${JSON.stringify(observation, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
