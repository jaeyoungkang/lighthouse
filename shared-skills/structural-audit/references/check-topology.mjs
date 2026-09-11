import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  STRUCTURAL_POLICY_FILES,
  STRUCTURAL_TOOLING_FILES,
  buildFileSetFingerprint,
  buildGraphFingerprint,
  buildMetricDelta,
  buildMetricSummary,
  canonicalizeAuditSignals,
} from "./topology-fingerprint.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const EXTRACTOR_PATH = path.join(SCRIPT_DIR, "import-graph-extractor.mjs");
const GRAPH_ARCHIVE_PATHS = ["app", "proxy.ts", "instrumentation-client.ts"];

function usage() {
  return [
    "Usage:",
    "  node check-topology.mjs [repo-root] [--base <git-ref>] [--json]",
    "",
    "Compares committed base and HEAD trees. Topology changes are advisory;",
    "missing refs and extraction failures are blocking errors.",
  ].join("\n");
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }
  let repoRoot = process.cwd();
  let repoRootProvided = false;
  let baseRef;
  let json = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--base") {
      baseRef = argv[index + 1];
      if (!baseRef) throw new Error("--base requires a git ref.\n\n" + usage());
      index += 1;
    } else if (argument === "--json") {
      json = true;
    } else if (argument.startsWith("--")) {
      throw new Error("Unknown option: " + argument + "\n\n" + usage());
    } else if (!repoRootProvided) {
      repoRoot = path.resolve(argument);
      repoRootProvided = true;
    } else {
      throw new Error("Only one repo-root may be supplied.\n\n" + usage());
    }
  }
  return { repoRoot, baseRef, json };
}

function runGit(repoRoot, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(repoRoot, args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function resolveCommit(repoRoot, gitRef) {
  const revision = tryGit(repoRoot, ["rev-parse", "--verify", `${gitRef}^{commit}`]);
  if (!revision) throw new Error(`could not resolve structural comparison ref ${gitRef}`);
  return revision;
}

export function resolveStructuralBaseRef(repoRoot, explicitBaseRef) {
  if (explicitBaseRef) return explicitBaseRef;

  const pushedBaseRef = process.env.STRUCTURAL_AUDIT_BASE_REF?.trim();
  if (pushedBaseRef && !/^0+$/.test(pushedBaseRef)) return pushedBaseRef;

  const githubBaseRef = process.env.GITHUB_BASE_REF?.trim();
  if (githubBaseRef) {
    const remoteBase = `refs/remotes/origin/${githubBaseRef}`;
    return tryGit(repoRoot, ["merge-base", "HEAD", remoteBase]) ?? remoteBase;
  }

  const branch = tryGit(repoRoot, ["branch", "--show-current"]);
  if (branch && branch !== "main") {
    return (
      tryGit(repoRoot, ["merge-base", "HEAD", "refs/remotes/origin/main"]) ??
      "refs/remotes/origin/main"
    );
  }

  return tryGit(repoRoot, ["rev-parse", "--verify", "HEAD^1"]) ?? "HEAD^1";
}

function treeHasPath(repoRoot, revision, filePath) {
  return (
    spawnSync("git", ["cat-file", "-e", `${revision}:${filePath}`], {
      cwd: repoRoot,
      stdio: "ignore",
    }).status === 0
  );
}

function readRefEntries(repoRoot, revision, filePaths) {
  return filePaths.map((filePath) => ({
    filePath,
    contents: treeHasPath(repoRoot, revision, filePath)
      ? runGit(repoRoot, ["show", `${revision}:${filePath}`], { encoding: null })
      : null,
  }));
}

function extractAnalysisAtRevision(repoRoot, revision, temporaryRoot, label) {
  const sourceRoot = path.join(temporaryRoot, label, "tree");
  const archivePath = path.join(temporaryRoot, `${label}.tar`);
  const outputPath = path.join(temporaryRoot, `${label}-analysis.json`);
  mkdirSync(sourceRoot, { recursive: true });
  const archivePaths = GRAPH_ARCHIVE_PATHS.filter((filePath) =>
    treeHasPath(repoRoot, revision, filePath),
  );
  if (!archivePaths.includes("app")) {
    throw new Error(`structural source root app is missing at ${revision}`);
  }
  runGit(repoRoot, [
    "archive",
    "--format=tar",
    `--output=${archivePath}`,
    revision,
    "--",
    ...archivePaths,
  ]);
  execFileSync("tar", ["-xf", archivePath, "-C", sourceRoot], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  execFileSync(process.execPath, [EXTRACTOR_PATH, sourceRoot, outputPath], {
    encoding: "utf8",
    env: { ...process.env, GIT_REV: revision },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(readFileSync(outputPath, "utf8"));
}

function changedSignalNames(base, current) {
  return Object.keys(current).filter(
    (key) => JSON.stringify(base[key]) !== JSON.stringify(current[key]),
  );
}

export function compareStructuralAnalyses({
  baseRevision,
  currentRevision,
  baseAnalysis,
  currentAnalysis,
  basePolicyEntries,
  currentPolicyEntries,
  baseToolingEntries,
  currentToolingEntries,
}) {
  const baseMetrics = buildMetricSummary(baseAnalysis);
  const currentMetrics = buildMetricSummary(currentAnalysis);
  const baseSignals = canonicalizeAuditSignals(baseAnalysis);
  const currentSignals = canonicalizeAuditSignals(currentAnalysis);
  const fingerprints = {
    base: {
      graph: buildGraphFingerprint(baseAnalysis),
      policy: buildFileSetFingerprint(basePolicyEntries),
      tooling: buildFileSetFingerprint(baseToolingEntries),
    },
    current: {
      graph: buildGraphFingerprint(currentAnalysis),
      policy: buildFileSetFingerprint(currentPolicyEntries),
      tooling: buildFileSetFingerprint(currentToolingEntries),
    },
  };
  const changed = {
    graph: fingerprints.base.graph !== fingerprints.current.graph,
    policy: fingerprints.base.policy !== fingerprints.current.policy,
    tooling: fingerprints.base.tooling !== fingerprints.current.tooling,
  };
  const auditTriggers = changedSignalNames(baseSignals, currentSignals);
  if (changed.policy) auditTriggers.push("policy");
  if (changed.tooling) auditTriggers.push("tooling");
  return {
    schemaVersion: 1,
    baseRevision,
    currentRevision,
    fingerprints,
    changed,
    snapshotRequiredAfterMerge: Object.values(changed).some(Boolean),
    auditTriggers,
    metrics: {
      base: baseMetrics,
      current: currentMetrics,
      delta: buildMetricDelta(baseMetrics, currentMetrics),
    },
    boundaries: {
      topologyChangeIsBlocking: false,
      canonicalEnforcement: ["deps:boundaries", "deps:unused", "quality:guards"],
      durableSnapshotRevision: "exact-main-after-merge",
      architectureHealthVerdict: false,
    },
  };
}

export function checkStructuralTopology(repoRoot, options = {}) {
  const currentRevision = resolveCommit(repoRoot, "HEAD");
  const baseRef = resolveStructuralBaseRef(repoRoot, options.baseRef);
  const baseRevision = resolveCommit(repoRoot, baseRef);
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "lighthouse-structural-check-"));
  try {
    const baseAnalysis = extractAnalysisAtRevision(repoRoot, baseRevision, temporaryRoot, "base");
    const currentAnalysis = extractAnalysisAtRevision(
      repoRoot,
      currentRevision,
      temporaryRoot,
      "current",
    );
    return compareStructuralAnalyses({
      baseRevision,
      currentRevision,
      baseAnalysis,
      currentAnalysis,
      basePolicyEntries: readRefEntries(repoRoot, baseRevision, STRUCTURAL_POLICY_FILES),
      currentPolicyEntries: readRefEntries(repoRoot, currentRevision, STRUCTURAL_POLICY_FILES),
      baseToolingEntries: readRefEntries(repoRoot, baseRevision, STRUCTURAL_TOOLING_FILES),
      currentToolingEntries: readRefEntries(repoRoot, currentRevision, STRUCTURAL_TOOLING_FILES),
    });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function printHumanResult(result) {
  const changedKinds = Object.entries(result.changed)
    .filter(([, changed]) => changed)
    .map(([kind]) => kind);
  if (changedKinds.length === 0) {
    console.log(
      `[structural-audit:check] topology unchanged (${result.baseRevision.slice(0, 8)}..${result.currentRevision.slice(0, 8)}).`,
    );
    return;
  }
  console.log(
    `[structural-audit:check] structural change detected: ${changedKinds.join(", ")} (${result.baseRevision.slice(0, 8)}..${result.currentRevision.slice(0, 8)}).`,
  );
  console.log(
    "[structural-audit:check] metric delta: " +
      Object.entries(result.metrics.delta)
        .map(([key, value]) => `${key}=${signed(value)}`)
        .join(" "),
  );
  console.log(
    `[structural-audit:check] full-audit candidates: ${result.auditTriggers.join(", ") || "none"}.`,
  );
  console.log(
    "[structural-audit:check] advisory: preserve one durable snapshot after merge at exact main; metric changes are not a release verdict.",
  );
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(
      `::notice title=structural-topology::${changedKinds.join(", ")} changed; exact-main snapshot required after merge`,
    );
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = checkStructuralTopology(options.repoRoot, { baseRef: options.baseRef });
  if (options.json) console.log(JSON.stringify(result));
  else printHumanResult(result);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[structural-audit:check] ${message}`);
    if (process.env.GITHUB_ACTIONS === "true") {
      console.error(`::error title=structural-topology::${message.replaceAll("\n", " ")}`);
    }
    process.exitCode = 1;
  }
}
