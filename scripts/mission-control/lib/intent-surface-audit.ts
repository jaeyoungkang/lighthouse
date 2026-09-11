import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { traceabilityNodePattern } from "@/app/domain/story-chain";
import type { IntentSurfaceAuditCounts } from "@/scripts/mission-control/lib/intent-traceability-types";

// Mirrors `scripts/mission-control/mc-audit-surface.ts` classification — kept in
// sync deliberately to expose surface audit counts in the dashboard headline
// without crossing the snapshot/script boundary. If allowlist or surface patterns
// drift, both paths must be updated together (Boundary-Failure Guard).

const SURFACE_FILE_PATTERNS = [
  /\/page\.tsx$/,
  /\/layout\.tsx$/,
  /^app\/components\/.*\.tsx$/,
  /^app\/components\/.*\/use[A-Z][A-Za-z0-9]*\.ts$/,
  /^app\/stores\/.*\.ts$/,
];
const SURFACE_EXCLUDE_PATTERNS = [
  /\/__tests__\//,
  /\.test\.tsx?$/,
  /\.shared\.tsx?$/,
  /\.helpers\.tsx?$/,
];
const SURFACE_TAG_RES: RegExp[] = [
  new RegExp(`^\\s*//\\s*@promise\\s+(${traceabilityNodePattern("promise", "[a-z0-9-]+")})`),
  new RegExp(`^\\s*//\\s*@aspect\\s+(${traceabilityNodePattern("aspect", "[a-z0-9-]+")})`),
  new RegExp(
    `^\\s*//\\s*@check\\s+(${traceabilityNodePattern("intent-check", "[a-z0-9-]+")}|${traceabilityNodePattern("acceptance-check", "[a-z0-9-]+")})`,
  ),
];
const SURFACE_TAG_SCAN_LINES = 24;

export function buildSurfaceAuditCounts(projectRoot: string): IntentSurfaceAuditCounts {
  const allowlist = loadAllowlist(projectRoot);
  const surfaceFiles = walkSurfaceFiles(projectRoot);
  let tagged = 0;
  let infrastructure = 0;
  let backfillBacklog = 0;
  const orphanPaths: string[] = [];
  for (const relPath of surfaceFiles) {
    const tags = readSurfaceTags(path.join(projectRoot, relPath));
    if (tags.length > 0) {
      tagged += 1;
      continue;
    }
    if (allowlist.infrastructure.includes(relPath)) {
      infrastructure += 1;
      continue;
    }
    if (allowlist.backfillBacklog.includes(relPath)) {
      backfillBacklog += 1;
      continue;
    }
    orphanPaths.push(relPath);
  }
  return {
    total: surfaceFiles.length,
    tagged,
    infrastructure,
    backfillBacklog,
    orphan: orphanPaths.length,
    orphanPaths,
  };
}

function loadAllowlist(projectRoot: string): {
  infrastructure: string[];
  backfillBacklog: string[];
} {
  const allowlistPath = path.join(projectRoot, "scripts/mission-control/surface-allowlist.json");
  try {
    const raw = JSON.parse(readFileSync(allowlistPath, "utf8")) as {
      infrastructure?: string[];
      backfillBacklog?: string[];
    };
    return {
      infrastructure: raw.infrastructure ?? [],
      backfillBacklog: raw.backfillBacklog ?? [],
    };
  } catch {
    return { infrastructure: [], backfillBacklog: [] };
  }
}

function walkSurfaceFiles(projectRoot: string): string[] {
  const found: string[] = [];
  walkSurfaceDir(path.join(projectRoot, "app"), found);
  const candidates = found
    .map((absPath) => path.relative(projectRoot, absPath).replaceAll("\\", "/"))
    .filter((relPath) => !SURFACE_EXCLUDE_PATTERNS.some((re) => re.test(relPath)))
    .sort();
  return candidates.filter((relPath) => {
    if (SURFACE_FILE_PATTERNS.some((re) => re.test(relPath))) return true;
    return readSurfaceTags(path.join(projectRoot, relPath)).length > 0;
  });
}

function walkSurfaceDir(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const fullPath = path.join(dir, name);
    let info;
    try {
      info = statSync(fullPath);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      walkSurfaceDir(fullPath, out);
    } else if (info.isFile() && (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts"))) {
      out.push(fullPath);
    }
  }
}

function readSurfaceTags(absPath: string): string[] {
  let content: string;
  try {
    content = readFileSync(absPath, "utf8");
  } catch {
    return [];
  }
  const lines = content.split("\n", SURFACE_TAG_SCAN_LINES);
  const tags: string[] = [];
  for (const line of lines) {
    for (const re of SURFACE_TAG_RES) {
      const match = line.match(re);
      if (match) tags.push(match[1]);
    }
  }
  return tags;
}
