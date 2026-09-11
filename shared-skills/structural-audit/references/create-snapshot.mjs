import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  STRUCTURAL_POLICY_FILES,
  STRUCTURAL_TOOLING_FILES,
  buildFileSetFingerprint,
  buildGraphFingerprint,
  compareCodePoints,
  readFilesystemEntries,
} from "./topology-fingerprint.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(SCRIPT_PATH);
const DEFAULT_PROJECTION_MANIFEST = path.join(SCRIPT_DIR, "projection-manifest.json");
const EXTRACTOR_PATH = path.join(SCRIPT_DIR, "import-graph-extractor.mjs");
const RENDERER_RESOURCES = {
  channel: "latest",
  mutable: true,
  bundledMermaidVersion: "11.17.0",
  renderer: "https://isnbh0.github.io/mermaiden/cdn/latest/mermaiden.js",
  toolkit: "https://isnbh0.github.io/mermaiden/cdn/latest/mermaiden-toolkit.js",
  styles: "https://isnbh0.github.io/mermaiden/cdn/latest/relationships.css",
};

function usage() {
  return [
    "Usage:",
    "  node create-snapshot.mjs <repo-root> <output-root> --date YYYY-MM-DD [options]",
    "",
    "Options:",
    "  --baseline <analysis.json>       Compare full-graph metrics with an earlier snapshot.",
    "  --issue-url <url>                Link the owning process issue in the dated record.",
    "  --projection-manifest <file>     Override the checked-in projection manifest.",
    "  --require-ref <git-ref>           Require HEAD to equal the named ref.",
  ].join("\n");
}

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage());
    process.exit(0);
  }
  const [repoRootArg, outputRootArg, ...rest] = argv;
  if (!repoRootArg || !outputRootArg) throw new Error(usage());
  const options = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error("Every option must use --name <value>.\n\n" + usage());
    }
    options.set(key, value);
  }
  const date = options.get("--date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("--date must use YYYY-MM-DD.");
  }
  return {
    repoRoot: path.resolve(repoRootArg),
    outputRoot: path.resolve(outputRootArg),
    date,
    baselinePath: options.get("--baseline") ? path.resolve(options.get("--baseline")) : undefined,
    issueUrl: options.get("--issue-url"),
    projectionManifestPath: options.get("--projection-manifest")
      ? path.resolve(options.get("--projection-manifest"))
      : DEFAULT_PROJECTION_MANIFEST,
    requiredRef: options.get("--require-ref"),
  };
}

function runGit(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function repositoryUrl(repoRoot) {
  let remote;
  try {
    remote = runGit(repoRoot, ["remote", "get-url", "origin"]);
  } catch {
    return undefined;
  }
  const match = remote.match(
    /(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?$/,
  );
  return match ? "https://github.com/" + match[1] : undefined;
}

function relativeRepoPath(repoRoot, filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return undefined;
  return relativePath;
}

function ensureExactSourceTree(repoRoot, requiredRef, projectionManifestPath) {
  try {
    runGit(repoRoot, ["rev-parse", "--git-dir"]);
  } catch {
    throw new Error("repo-root must be a Git worktree.");
  }
  const revision = runGit(repoRoot, ["rev-parse", "HEAD"]);
  if (requiredRef) {
    const requiredRevision = runGit(repoRoot, ["rev-parse", requiredRef]);
    if (revision !== requiredRevision) {
      throw new Error(
        "HEAD " +
          revision +
          " does not match required ref " +
          requiredRef +
          " @ " +
          requiredRevision +
          ".",
      );
    }
  }
  const snapshotInputPaths = [
    "app",
    "proxy.ts",
    "instrumentation-client.ts",
    ...STRUCTURAL_POLICY_FILES,
    ...STRUCTURAL_TOOLING_FILES,
  ];
  const projectionRepoPath = relativeRepoPath(repoRoot, projectionManifestPath);
  if (projectionRepoPath && !snapshotInputPaths.includes(projectionRepoPath)) {
    snapshotInputPaths.push(projectionRepoPath);
  }
  const dirty = runGit(repoRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "--",
    ...snapshotInputPaths,
  ]);
  if (dirty) {
    throw new Error(
      "Structural snapshot inputs differ from HEAD; commit or isolate them before snapshotting:\n" +
        dirty,
    );
  }
  return revision;
}

function validateProjectionManifest(manifest) {
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.groups)) {
    throw new Error("projection manifest must use schemaVersion 1 with groups.");
  }
  const groupIds = new Set();
  const nodes = new Set();
  for (const group of manifest.groups) {
    if (!group.id || !group.label || !group.className || !Array.isArray(group.nodes)) {
      throw new Error("every projection group needs id, label, className, and nodes.");
    }
    if (groupIds.has(group.id)) throw new Error("duplicate projection group id: " + group.id);
    groupIds.add(group.id);
    for (const node of group.nodes) {
      if (nodes.has(node)) throw new Error("projection node appears more than once: " + node);
      nodes.add(node);
    }
  }
  for (const node of manifest.metricNodes ?? []) {
    if (!nodes.has(node)) throw new Error("metric node is outside the projection: " + node);
  }
  return [...nodes];
}

function buildGraphMaps(analysis) {
  const adjacency = new Map(analysis.nodes.map((node) => [node, []]));
  const reverse = new Map(analysis.nodes.map((node) => [node, []]));
  for (const edge of analysis.edges) {
    adjacency.get(edge.from)?.push(edge.to);
    reverse.get(edge.to)?.push(edge.from);
  }
  return { adjacency, reverse };
}

function reachableCount(start, graph) {
  const visited = new Set();
  const pending = [...(graph.get(start) ?? [])];
  while (pending.length) {
    const node = pending.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) pending.push(next);
    }
  }
  visited.delete(start);
  return visited.size;
}

function metricsFor(node, analysis, maps) {
  return {
    fanIn: analysis.edges.filter((edge) => edge.to === node).length,
    fanOut: analysis.edges.filter((edge) => edge.from === node).length,
    upstreamReach: reachableCount(node, maps.reverse),
    downstreamReach: reachableCount(node, maps.adjacency),
  };
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function pathLabel(filePath) {
  return filePath
    .split("/")
    .map((part) => escapeHtml(part))
    .join("<br/>");
}

function buildMermaid(analysis, manifest, revision) {
  if (!Array.isArray(analysis.nodes)) {
    throw new Error("analysis must include the source-derived nodes array.");
  }
  const selectedNodes = validateProjectionManifest(manifest);
  const selected = new Set(selectedNodes);
  const sourceNodes = new Set(analysis.nodes);
  const tombstones = selectedNodes.filter((node) => !sourceNodes.has(node));
  const nodeIds = new Map(selectedNodes.map((node, index) => [node, "n" + index]));
  const metricNodes = new Set(manifest.metricNodes ?? []);
  const maps = buildGraphMaps(analysis);
  const sccMembership = new Map();
  analysis.sccs.forEach((component, index) => {
    for (const node of component) sccMembership.set(node, index + 1);
  });
  const projectedEdges = analysis.edges
    .filter((edge) => selected.has(edge.from) && selected.has(edge.to))
    .sort(
      (left, right) =>
        compareCodePoints(left.from, right.from) ||
        compareCodePoints(left.to, right.to) ||
        Number(left.typeOnly) - Number(right.typeOnly) ||
        Number(left.dynamic) - Number(right.dynamic),
    );
  const description = [
    "Complete source analysis at revision " + revision + ":",
    analysis.counts.files + " production files,",
    analysis.counts.edges + " resolved app-local imports,",
    analysis.counts.typeOnlyEdges + " type-only imports,",
    analysis.counts.dynamicEdges + " literal dynamic imports, and",
    analysis.sccs.length + " non-trivial strongly connected components.",
    "The visible graph is a " +
      selectedNodes.length +
      "-file fixed-manifest projection with " +
      projectedEdges.length +
      " resolved production imports and " +
      tombstones.length +
      " missing files.",
    "Every visible arrow is a source import; dashed edges are type-only and dynamic labels mark literal dynamic imports.",
  ].join(" ");
  const lines = [
    "---",
    "title: " + manifest.title + " @ " + revision.slice(0, 8),
    "config:",
    "  layout: elk",
    "  flowchart:",
    "    curve: linear",
    "    htmlLabels: true",
    "    nodeSpacing: " + manifest.layout.nodeSpacing,
    "    rankSpacing: " + manifest.layout.rankSpacing,
    "  theme: base",
    "  themeVariables:",
    '    background: "#0a0d12"',
    '    primaryTextColor: "#17202a"',
    '    lineColor: "#77808d"',
    '    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"',
    "---",
    "flowchart " + manifest.layout.direction,
    "  accTitle: " + manifest.title,
    "  accDescr: " + description,
    "",
  ];
  for (const [groupIndex, group] of manifest.groups.entries()) {
    const ids = [];
    lines.push("  subgraph cluster" + groupIndex + '["' + escapeHtml(group.label) + '"]');
    lines.push("    direction TB");
    for (const node of group.nodes) {
      const id = nodeIds.get(node);
      ids.push(id);
      const details = [];
      if (!sourceNodes.has(node)) {
        details.push("missing @ revision");
      } else {
        if (metricNodes.has(node)) {
          const metrics = metricsFor(node, analysis, maps);
          details.push(
            "in " +
              metrics.fanIn +
              " · out " +
              metrics.fanOut +
              " · up " +
              metrics.upstreamReach +
              " · down " +
              metrics.downstreamReach,
          );
        }
        const scc = sccMembership.get(node);
        if (scc) details.push("SCC " + scc + "/" + analysis.sccs.length);
      }
      const detailLabel = details
        .map((detail) => "<br/><small>" + escapeHtml(detail) + "</small>")
        .join("");
      lines.push("    " + id + '["' + pathLabel(node) + detailLabel + '"]');
    }
    lines.push("  end");
    lines.push("  class " + ids.join(",") + " " + group.className);
    lines.push("");
  }
  const typeOnlyIndexes = [];
  projectedEdges.forEach((edge, index) => {
    const label = edge.dynamic ? "|dynamic import|" : "";
    lines.push("  " + nodeIds.get(edge.from) + " -->" + label + " " + nodeIds.get(edge.to));
    if (edge.typeOnly) typeOnlyIndexes.push(index);
  });
  if (typeOnlyIndexes.length) {
    lines.push("");
    lines.push(
      "  linkStyle " +
        typeOnlyIndexes.join(",") +
        " stroke:#9f91c9,stroke-width:1.35px,stroke-dasharray:5 4",
    );
  }
  lines.push("");
  lines.push("  classDef entry fill:#f4efe3,stroke:#92794d,color:#201b13,stroke-width:1.4px");
  lines.push("  classDef ui fill:#dbeafe,stroke:#4e79a7,color:#10243b,stroke-width:1.35px");
  lines.push("  classDef server fill:#fee2d5,stroke:#b8643f,color:#3a1d12,stroke-width:1.35px");
  lines.push("  classDef authority fill:#eadcf8,stroke:#7952a3,color:#271538,stroke-width:1.4px");
  lines.push("  classDef cross fill:#dff2e3,stroke:#4f8c63,color:#15301e,stroke-width:1.35px");
  lines.push("  classDef scc stroke:#b91c1c,stroke-width:2.8px");
  lines.push(
    "  classDef tombstone fill:#2a2020,stroke:#cf6f6f,color:#f5c2c2,stroke-width:1.8px,stroke-dasharray:6 4",
  );
  lines.push("  style cluster0 fill:#161b22,stroke:#92794d,color:#f4efe3,stroke-width:1.5px");
  lines.push("  style cluster1 fill:#101923,stroke:#4e79a7,color:#dbeafe,stroke-width:1.5px");
  lines.push("  style cluster2 fill:#20150f,stroke:#b8643f,color:#fee2d5,stroke-width:1.5px");
  lines.push("  style cluster3 fill:#1d1426,stroke:#7952a3,color:#eadcf8,stroke-width:1.5px");
  lines.push("  style cluster4 fill:#102018,stroke:#4f8c63,color:#dff2e3,stroke-width:1.5px");
  const selectedSccNodes = selectedNodes
    .filter((node) => sourceNodes.has(node) && sccMembership.has(node))
    .map((node) => nodeIds.get(node));
  if (selectedSccNodes.length) lines.push("  class " + selectedSccNodes.join(",") + " scc");
  if (tombstones.length) {
    lines.push("  class " + tombstones.map((node) => nodeIds.get(node)).join(",") + " tombstone");
  }
  return {
    source: lines.join("\n") + "\n",
    projection: {
      manifestNodes: selectedNodes.length,
      sourceNodes: selectedNodes.length - tombstones.length,
      tombstones,
      edges: projectedEdges.length,
      typeOnlyEdges: projectedEdges.filter((edge) => edge.typeOnly).length,
      dynamicEdges: projectedEdges.filter((edge) => edge.dynamic).length,
    },
  };
}

function buildHtml(source, manifest) {
  const sourceLiteral = JSON.stringify(source).replaceAll("<", "\\u003c");
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1">',
    "    <title>" + escapeHtml(manifest.title) + "</title>",
    '    <link rel="stylesheet" href="' + RENDERER_RESOURCES.styles + '">',
    "    <style>",
    "      :root { color-scheme: dark; background: #0a0d12; }",
    "      * { box-sizing: border-box; }",
    "      html, body { margin: 0; min-width: 100%; min-height: 100%; background: #0a0d12; }",
    "      body { overflow: auto; }",
    "      #diagram { min-width: 100vw; min-height: 100vh; padding: 24px; display: grid; place-items: start center; }",
    "      #diagram svg { display: block; width: max(100vw, " +
      manifest.layout.minWidthPx +
      "px); max-width: none; height: auto; filter: drop-shadow(0 18px 45px rgba(0,0,0,.28)); }",
    "      #diagram .nodeLabel, #diagram .edgeLabel { line-height: 1.22; }",
    "      #diagram .nodeLabel small { color: inherit; opacity: .72; font-size: 10px; letter-spacing: .01em; }",
    "      #diagram .cluster-label { font-weight: 700; letter-spacing: .015em; }",
    "    </style>",
    "  </head>",
    "  <body>",
    '    <div id="diagram" role="img" aria-label="' +
      escapeHtml(manifest.title) +
      ' projection"></div>',
    '    <script type="module">',
    '      import { createSemanticRenderer } from "' + RENDERER_RESOURCES.renderer + '";',
    '      import { attachRelationshipHighlight } from "' + RENDERER_RESOURCES.toolkit + '";',
    "",
    '      const host = document.querySelector("#diagram");',
    '      if (!host) throw new Error("Missing diagram host");',
    "      const source = " + sourceLiteral + ";",
    "      const renderer = createSemanticRenderer();",
    "      let relationshipHighlight;",
    "",
    "      function retirePresentation() {",
    "        relationshipHighlight?.dispose();",
    "        relationshipHighlight = undefined;",
    "        host.replaceChildren();",
    "      }",
    "",
    "      async function present() {",
    "        retirePresentation();",
    "        const result = await renderer.renderWithSemantics({",
    '          id: "' + manifest.id + '",',
    "          source,",
    "          config: { startOnLoad: false },",
    "        });",
    "        host.innerHTML = result.svg;",
    "        result.bindFunctions?.(host);",
    "        await new Promise((resolve) => requestAnimationFrame(resolve));",
    '        const svg = host.querySelector("svg");',
    '        if (!svg) throw new Error("Missing rendered SVG");',
    '        svg.removeAttribute("height");',
    '        if (result.semantics.kind === "flowchart") {',
    "          relationshipHighlight = attachRelationshipHighlight(svg, result.semantics);",
    "        }",
    "      }",
    "",
    "      globalThis.__lighthouseImportSource = source;",
    "      try {",
    "        await present();",
    "      } catch (error) {",
    "        globalThis.__lighthouseImportRenderError = {",
    "          name: error?.name,",
    "          message: error?.message,",
    "          stack: error?.stack,",
    "          cause: error?.cause == null ? undefined : String(error.cause),",
    "          details: error?.details,",
    "        };",
    "        host.dataset.renderError = JSON.stringify(globalThis.__lighthouseImportRenderError);",
    '        console.error("Light House import graph render failed " + host.dataset.renderError);',
    "      }",
    '      window.addEventListener("pagehide", retirePresentation, { once: true });',
    "    </script>",
    "  </body>",
    "</html>",
    "",
  ].join("\n");
}

function snapshotMetrics(analysis) {
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

function metricDelta(current, baseline) {
  if (!baseline) return undefined;
  return Object.fromEntries(
    Object.entries(current).map(([key, value]) => [key, value - baseline[key]]),
  );
}

function signed(value) {
  return value > 0 ? "+" + value : String(value);
}

function buildRecord({
  date,
  revision,
  repoUrl,
  issueUrl,
  currentMetrics,
  baseline,
  delta,
  projection,
  artifactNames,
}) {
  const rows = Object.entries(currentMetrics).map(([metric, value]) => {
    const baselineValue = baseline ? baseline.metrics[metric] : undefined;
    const deltaValue = delta ? signed(delta[metric]) : "n/a";
    return (
      "| " + metric + " | " + value + " | " + (baselineValue ?? "n/a") + " | " + deltaValue + " |"
    );
  });
  const productBasis = repoUrl ? repoUrl + "/tree/" + revision : revision;
  return [
    "# Lighthouse structural snapshot — " + date,
    "",
    "- 날짜: " + date,
    "- 상태: evidence",
    "- 관련 지식: 없음",
    "- 관련 제품 기준: [" + revision.slice(0, 8) + "](" + productBasis + ")",
    "- 제품 반영 기록: " + (issueUrl ? "[" + issueUrl + "](" + issueUrl + ")" : "없음"),
    "",
    "## 실행",
    "",
    "- revision: " + revision,
    "- analysis: [" + artifactNames.analysis + "](dataset/" + artifactNames.analysis + ")",
    "- projection source: [" +
      artifactNames.projectionSource +
      "](dataset/" +
      artifactNames.projectionSource +
      ")",
    "- projection HTML: [" + artifactNames.html + "](" + artifactNames.html + ")",
    "- manifest: [" + artifactNames.manifest + "](dataset/" + artifactNames.manifest + ")",
    "",
    "## 전체 그래프 지표",
    "",
    "| Metric | Current | Baseline | Delta |",
    "| --- | ---: | ---: | ---: |",
    ...rows,
    "",
    "Baseline: " +
      (baseline
        ? baseline.revision + " / " + baseline.sourceFile
        : "없음 — 최초 baseline 또는 비교 입력 미지정"),
    "",
    "## 고정 투영",
    "",
    "- manifest nodes: " + projection.manifestNodes,
    "- source nodes: " + projection.sourceNodes,
    "- tombstones: " + projection.tombstones.length,
    "- displayed source imports: " + projection.edges,
    "- displayed type-only imports: " + projection.typeOnlyEdges,
    "- displayed literal dynamic imports: " + projection.dynamicEdges,
    "",
    "## 판정 경계",
    "",
    "- 이 문서는 기계적 snapshot evidence다. 5단계 structural-audit 실행이나 architecture health verdict가 아니다.",
    "- SCC, unreachable, cross-zone, unresolved 수치는 정독·불일치 triage 입력이며 자동 결함 판정이 아니다.",
    "- HTML은 Mermaiden latest 채널을 사용한다. 채널은 mutable하므로 재현 정본은 analysis JSON, Mermaid source, manifest다.",
    "- 전체 판단형 감사가 필요하면 전역 스캔 뒤 지목 파일 정독과 현재 main stale 재대조를 별도로 수행한다.",
    "",
  ].join("\n");
}

function assertNoOutputOverwrite(paths) {
  const existing = paths.filter((filePath) => existsSync(filePath));
  if (existing.length) {
    throw new Error(
      "Snapshot artifacts are append-only; refusing to overwrite:\n" + existing.join("\n"),
    );
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const revision = ensureExactSourceTree(
    options.repoRoot,
    options.requiredRef,
    options.projectionManifestPath,
  );
  const projectionManifestRaw = readFileSync(options.projectionManifestPath, "utf8");
  const projectionManifest = JSON.parse(projectionManifestRaw);
  validateProjectionManifest(projectionManifest);
  const temporaryRoot = mkdtempSync(path.join(tmpdir(), "lighthouse-structural-snapshot-"));
  try {
    const temporaryAnalysis = path.join(temporaryRoot, "analysis.json");
    const extractorOutput = execFileSync(
      process.execPath,
      [EXTRACTOR_PATH, options.repoRoot, temporaryAnalysis],
      {
        encoding: "utf8",
        env: { ...process.env, GIT_REV: revision },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const analysis = readJson(temporaryAnalysis);
    if (analysis.revision !== revision) {
      throw new Error("extractor revision does not match the pinned source revision.");
    }
    const baselineAnalysis = options.baselinePath ? readJson(options.baselinePath) : undefined;
    const baseline = baselineAnalysis
      ? {
          sourceFile: path.basename(options.baselinePath),
          revision: baselineAnalysis.revision,
          metrics: snapshotMetrics(baselineAnalysis),
        }
      : undefined;
    const currentMetrics = snapshotMetrics(analysis);
    const delta = metricDelta(currentMetrics, baseline?.metrics);
    const rendered = buildMermaid(analysis, projectionManifest, revision);
    const html = buildHtml(rendered.source, projectionManifest);
    const datasetDir = path.join(options.outputRoot, "dataset");
    const artifactNames = {
      analysis: options.date + "-graph-analysis.json",
      projectionSource: options.date + "-projection.mmd",
      html: options.date + "-projection.html",
      manifest: options.date + "-snapshot-manifest.json",
      record: options.date + "-snapshot-record.md",
    };
    const artifactPaths = {
      analysis: path.join(datasetDir, artifactNames.analysis),
      projectionSource: path.join(datasetDir, artifactNames.projectionSource),
      html: path.join(options.outputRoot, artifactNames.html),
      manifest: path.join(datasetDir, artifactNames.manifest),
      record: path.join(options.outputRoot, artifactNames.record),
    };
    assertNoOutputOverwrite(Object.values(artifactPaths));
    const analysisText = JSON.stringify(analysis, null, 2) + "\n";
    const tooling = {
      snapshotGeneratorSha256: sha256(readFileSync(SCRIPT_PATH)),
      extractorSha256: sha256(readFileSync(EXTRACTOR_PATH)),
      projectionManifestSha256: sha256(projectionManifestRaw),
    };
    const snapshotManifest = {
      schemaVersion: 1,
      date: options.date,
      revision,
      repository: repositoryUrl(options.repoRoot),
      sourceScope: ["app/**", "proxy.ts", "instrumentation-client.ts"],
      policyScope: STRUCTURAL_POLICY_FILES,
      toolingScope: STRUCTURAL_TOOLING_FILES,
      current: currentMetrics,
      baseline,
      delta,
      projection: {
        id: projectionManifest.id,
        ...rendered.projection,
      },
      fingerprints: {
        graph: buildGraphFingerprint(analysis),
        policy: buildFileSetFingerprint(
          readFilesystemEntries(options.repoRoot, STRUCTURAL_POLICY_FILES),
        ),
        tooling: buildFileSetFingerprint(
          readFilesystemEntries(options.repoRoot, STRUCTURAL_TOOLING_FILES),
        ),
      },
      tooling,
      renderer: RENDERER_RESOURCES,
      artifacts: {
        analysis: artifactNames.analysis,
        analysisSha256: sha256(analysisText),
        projectionSource: artifactNames.projectionSource,
        projectionSourceSha256: sha256(rendered.source),
        html: artifactNames.html,
        htmlSha256: sha256(html),
        record: artifactNames.record,
      },
      boundaries: {
        auditVerdict: "not-run",
        releaseGate: false,
        healthScore: false,
        overwriteExistingArtifacts: false,
      },
    };
    const record = buildRecord({
      date: options.date,
      revision,
      repoUrl: snapshotManifest.repository,
      issueUrl: options.issueUrl,
      currentMetrics,
      baseline,
      delta,
      projection: rendered.projection,
      artifactNames,
    });
    mkdirSync(datasetDir, { recursive: true });
    writeFileSync(artifactPaths.analysis, analysisText, { flag: "wx" });
    writeFileSync(artifactPaths.projectionSource, rendered.source, { flag: "wx" });
    writeFileSync(artifactPaths.html, html, { flag: "wx" });
    writeFileSync(artifactPaths.manifest, JSON.stringify(snapshotManifest, null, 2) + "\n", {
      flag: "wx",
    });
    writeFileSync(artifactPaths.record, record, { flag: "wx" });
    process.stdout.write(extractorOutput);
    console.log(
      "snapshot=" +
        options.date +
        " revision=" +
        revision +
        " projection=" +
        rendered.projection.sourceNodes +
        "/" +
        rendered.projection.manifestNodes +
        " edges=" +
        rendered.projection.edges,
    );
    console.log("output=" + options.outputRoot);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
