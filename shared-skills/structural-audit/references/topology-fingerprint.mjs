import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const STRUCTURAL_POLICY_FILES = [
  ".dependency-cruiser.cjs",
  "knip.json",
  "tsconfig.json",
  "tsconfig.typecheck.json",
];

export const STRUCTURAL_TOOLING_FILES = [
  "shared-skills/structural-audit/references/check-topology.mjs",
  "shared-skills/structural-audit/references/create-snapshot.mjs",
  "shared-skills/structural-audit/references/import-graph-extractor.mjs",
  "shared-skills/structural-audit/references/projection-manifest.json",
  "shared-skills/structural-audit/references/topology-fingerprint.mjs",
];

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function compareCodePoints(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalEdge(edge) {
  if (
    typeof edge?.from !== "string" ||
    typeof edge?.to !== "string" ||
    typeof edge?.typeOnly !== "boolean" ||
    typeof edge?.dynamic !== "boolean"
  ) {
    throw new Error("graph analysis contains an invalid edge");
  }
  return {
    from: edge.from,
    to: edge.to,
    typeOnly: edge.typeOnly,
    dynamic: edge.dynamic,
  };
}

function compareEdges(left, right) {
  return (
    compareCodePoints(left.from, right.from) ||
    compareCodePoints(left.to, right.to) ||
    Number(left.typeOnly) - Number(right.typeOnly) ||
    Number(left.dynamic) - Number(right.dynamic)
  );
}

function canonicalStringRows(rows) {
  return rows.map((row) => JSON.stringify(row)).sort(compareCodePoints);
}

export function canonicalizeGraphAnalysis(analysis) {
  if (
    analysis?.schemaVersion !== 1 ||
    !Array.isArray(analysis.nodes) ||
    !Array.isArray(analysis.edges)
  ) {
    throw new Error("graph analysis must use schemaVersion 1 with nodes and edges");
  }
  const nodes = [...analysis.nodes];
  if (nodes.some((node) => typeof node !== "string")) {
    throw new Error("graph analysis contains an invalid node");
  }
  nodes.sort(compareCodePoints);
  return {
    schemaVersion: 1,
    nodes,
    edges: analysis.edges.map(canonicalEdge).sort(compareEdges),
  };
}

export function buildGraphFingerprint(analysis) {
  return sha256(JSON.stringify(canonicalizeGraphAnalysis(analysis)));
}

export function buildFileSetFingerprint(entries) {
  const canonicalEntries = entries
    .map(({ filePath, contents }) => ({
      filePath,
      sha256: contents == null ? null : sha256(contents),
    }))
    .sort((left, right) => compareCodePoints(left.filePath, right.filePath));
  return sha256(JSON.stringify({ schemaVersion: 1, files: canonicalEntries }));
}

export function readFilesystemEntries(root, filePaths) {
  return filePaths.map((filePath) => {
    const absolutePath = path.join(root, filePath);
    return {
      filePath,
      contents: existsSync(absolutePath) ? readFileSync(absolutePath) : null,
    };
  });
}

export function canonicalizeAuditSignals(analysis) {
  if (
    !Array.isArray(analysis?.sccs) ||
    !Array.isArray(analysis?.unreachable) ||
    !Array.isArray(analysis?.crossZoneFindings) ||
    !Array.isArray(analysis?.unresolved)
  ) {
    throw new Error("graph analysis is missing structural audit signals");
  }
  const sccs = analysis.sccs
    .map((component) => {
      if (!Array.isArray(component) || component.some((node) => typeof node !== "string")) {
        throw new Error("graph analysis contains an invalid SCC");
      }
      return [...component].sort(compareCodePoints);
    })
    .sort((left, right) => compareCodePoints(JSON.stringify(left), JSON.stringify(right)));
  const unreachable = [...analysis.unreachable];
  if (unreachable.some((node) => typeof node !== "string")) {
    throw new Error("graph analysis contains an invalid unreachable candidate");
  }
  unreachable.sort(compareCodePoints);
  return {
    sccs,
    unreachable,
    crossZoneFindings: canonicalStringRows(analysis.crossZoneFindings),
    unresolved: canonicalStringRows(analysis.unresolved),
  };
}

export function buildMetricSummary(analysis) {
  const requiredCounts = ["files", "edges", "typeOnlyEdges", "dynamicEdges", "entries"];
  for (const key of requiredCounts) {
    if (!Number.isSafeInteger(analysis?.counts?.[key]) || analysis.counts[key] < 0) {
      throw new Error(`graph analysis count ${key} must be a non-negative integer`);
    }
  }
  return {
    files: analysis.counts.files,
    edges: analysis.counts.edges,
    typeOnlyEdges: analysis.counts.typeOnlyEdges,
    dynamicEdges: analysis.counts.dynamicEdges,
    entries: analysis.counts.entries,
    sccs: analysis.sccs.length,
    unreachable: analysis.unreachable.length,
    crossZoneFindings: analysis.crossZoneFindings.length,
    unresolved: analysis.unresolved.length,
  };
}

export function buildMetricDelta(base, current) {
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, value - base[key]]),
  );
}
