// mc:audit-surface — detect user-facing surface files without any backing tag.
//
// Convention (Phase 4B canonical): every user-facing surface (.tsx route entry,
// layout, component) must declare its backing promise / aspect / check via at
// least one magic comment within the first 24 lines of the file:
//
//   // @promise promise:<slug>           (canonical — Story Chain promise)
//   // @aspect  aspect:<slug>            (canonical — cross-cutting aspect)
//   // @check   intent-check:<slug>      (canonical — Intent Check)
//   // @check   acceptance-check:<slug>  (canonical — Acceptance Check)
//
// `mc:audit-story-surface` runs in parallel and validates Story Chain refs
// (existence + reciprocal weaving). This script only counts whether any
// canonical tag is present.
//
// Files exempt from this requirement live in `scripts/mission-control/surface-allowlist.json`
// in two layers: `infrastructure` (genuinely no user promise) and `backfillBacklog`
// (existing surfaces grandfathered until backfilled).
//
// Usage:
//   tsx scripts/mission-control/mc-audit-surface.ts             # full inventory + orphan list
//   tsx scripts/mission-control/mc-audit-surface.ts --json      # machine-readable
//   tsx scripts/mission-control/mc-audit-surface.ts --staged    # check staged surface diffs only
//
// Exit code: 0 = no orphans, 1 = orphans (or staged orphan blocked).

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { traceabilityNodePattern } from "@/app/domain/story-chain";

type Allowlist = {
  infrastructure: string[];
  backfillBacklog: string[];
};

type Classification = "tagged" | "infrastructure" | "backfillBacklog" | "orphan";

type SurfaceEntry = {
  path: string;
  classification: Classification;
  tags: string[];
};

const REPO_ROOT = resolve(__dirname, "..", "..");
const ALLOWLIST_PATH = join(REPO_ROOT, "scripts", "mission-control", "surface-allowlist.json");

const SURFACE_ROOTS = ["app"] as const;

// User-facing surfaces include not only React components but also the client
// modules that drive their behavior — Zustand stores under `app/stores/` and
// hooks (`use*.ts`) co-located with components. A bug or stale tag in those
// `.ts` files breaks the same user promise as a bug in a `.tsx` view, so the
// orphan auditor must see them. Server services and API route handlers are
// out of scope for this audit until they start carrying tags themselves.
//
// In addition, ANY .ts/.tsx file under app/** that already carries a Story
// Chain tag is included regardless of pattern match (union scan).
// Otherwise an author who tags a file outside the canonical pattern would silently bypass the
// orphan + ref check from `mc:audit-story-surface`.
const SURFACE_FILE_PATTERNS = [
  /\/page\.tsx$/,
  /\/layout\.tsx$/,
  /^app\/components\/.*\.tsx$/,
  /^app\/components\/.*\/use[A-Z][A-Za-z0-9]*\.ts$/,
  /^app\/stores\/.*\.ts$/,
];

const EXCLUDE_PATTERNS = [/\/__tests__\//, /\.test\.tsx?$/, /\.shared\.tsx?$/, /\.helpers\.tsx?$/];

// Canonical Story Chain tag kinds. Any of these satisfies "tagged":
//   // @promise promise:<slug>       (new — Story Chain promise ref)
//   // @aspect  aspect:<slug>        (new — cross-cutting aspect ref)
//   // @check   intent-check:<slug>  (new — Intent Check ref)
//   // @check   acceptance-check:<slug>  (new — Acceptance Check ref)
//
// `mc:audit-story-surface` remains the deeper validator for Story Chain refs
// (existence + reciprocal weaving). `mc:audit-surface` only cares whether a
// surface declares any tag at all so the orphan list stays meaningful.
const TAG_RES: RegExp[] = [
  new RegExp(`^\\s*//\\s*@promise\\s+(${traceabilityNodePattern("promise", "[a-z0-9-]+")})`),
  new RegExp(`^\\s*//\\s*@aspect\\s+(${traceabilityNodePattern("aspect", "[a-z0-9-]+")})`),
  new RegExp(
    `^\\s*//\\s*@check\\s+(${traceabilityNodePattern("intent-check", "[a-z0-9-]+")}|${traceabilityNodePattern("acceptance-check", "[a-z0-9-]+")})`,
  ),
];
const TAG_SCAN_LINES = 24;

function loadAllowlist(): Allowlist {
  const raw = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8")) as {
    infrastructure?: string[];
    backfillBacklog?: string[];
  };
  return {
    infrastructure: raw.infrastructure ?? [],
    backfillBacklog: raw.backfillBacklog ?? [],
  };
}

function walkSurfaceFiles(): string[] {
  // A file is in scope when it matches the canonical surface pattern OR it
  // already carries a story-chain tag (union scan). The second leg
  // keeps tagged files outside the canonical pattern (e.g. one-off internal
  // pages) inside the orphan auditor.
  const files: string[] = [];
  for (const root of SURFACE_ROOTS) {
    walkDir(join(REPO_ROOT, root), files);
  }
  const candidates = files
    .map((absPath) => relative(REPO_ROOT, absPath).replaceAll("\\", "/"))
    .filter((relPath) => !EXCLUDE_PATTERNS.some((re) => re.test(relPath)))
    .sort();
  return candidates.filter((relPath) => {
    if (SURFACE_FILE_PATTERNS.some((re) => re.test(relPath))) return true;
    return readTags(relPath).length > 0;
  });
}

function walkDir(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const fullPath = join(dir, name);
    let info;
    try {
      info = statSync(fullPath);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      walkDir(fullPath, out);
    } else if (info.isFile() && (fullPath.endsWith(".tsx") || fullPath.endsWith(".ts"))) {
      out.push(fullPath);
    }
  }
}

function readTags(relPath: string): string[] {
  const absPath = join(REPO_ROOT, relPath);
  const content = readFileSync(absPath, "utf8");
  const lines = content.split("\n", TAG_SCAN_LINES);
  const tags: string[] = [];
  for (const line of lines) {
    for (const re of TAG_RES) {
      const match = line.match(re);
      if (match) tags.push(match[1]);
    }
  }
  return tags;
}

function classify(relPath: string, allowlist: Allowlist): SurfaceEntry {
  const tags = readTags(relPath);
  if (tags.length > 0) {
    return { path: relPath, classification: "tagged", tags };
  }
  if (allowlist.infrastructure.includes(relPath)) {
    return { path: relPath, classification: "infrastructure", tags: [] };
  }
  if (allowlist.backfillBacklog.includes(relPath)) {
    return { path: relPath, classification: "backfillBacklog", tags: [] };
  }
  return { path: relPath, classification: "orphan", tags: [] };
}

function getStagedFiles(): string[] {
  const staged = spawnSync("git", ["diff", "--cached", "--name-only"], {
    encoding: "utf8",
  });
  if (staged.status !== 0) return [];
  return staged.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildReport(entries: SurfaceEntry[]): {
  total: number;
  tagged: SurfaceEntry[];
  infrastructure: SurfaceEntry[];
  backfillBacklog: SurfaceEntry[];
  orphans: SurfaceEntry[];
} {
  return {
    total: entries.length,
    tagged: entries.filter((entry) => entry.classification === "tagged"),
    infrastructure: entries.filter((entry) => entry.classification === "infrastructure"),
    backfillBacklog: entries.filter((entry) => entry.classification === "backfillBacklog"),
    orphans: entries.filter((entry) => entry.classification === "orphan"),
  };
}

function main(): void {
  const wantsJson = process.argv.includes("--json");
  const stagedOnly = process.argv.includes("--staged");

  const allowlist = loadAllowlist();
  const surfaceFiles = walkSurfaceFiles();
  const entries = surfaceFiles.map((path) => classify(path, allowlist));
  const report = buildReport(entries);

  if (stagedOnly) {
    const staged = new Set(getStagedFiles());
    const stagedOrphans = report.orphans.filter((entry) => staged.has(entry.path));
    if (stagedOrphans.length > 0) {
      process.stderr.write(
        `mc:audit-surface — ${stagedOrphans.length.toString()} staged surface file(s) missing backing tag:\n`,
      );
      for (const entry of stagedOrphans) {
        process.stderr.write(`  ${entry.path}\n`);
      }
      process.stderr.write(
        "\n각 파일 상단에 `// @promise promise:<slug>` (또는 `@aspect`/`@check`) 주석을 추가하거나 `scripts/mission-control/surface-allowlist.json`에 등록하라.\n",
      );
      process.exit(1);
    }
    process.exit(0);
  }

  if (wantsJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatReport(report));
  }
  process.exit(report.orphans.length > 0 ? 1 : 0);
}

function formatReport(report: ReturnType<typeof buildReport>): string {
  const lines: string[] = [];
  lines.push(`mc:audit-surface — ${report.total.toString()}개 user-facing surface 파일 검사`);
  lines.push("");
  lines.push(
    `  tagged           ${report.tagged.length.toString().padStart(3)}  // @promise / @aspect / @check 선언 완료`,
  );
  lines.push(
    `  infrastructure   ${report.infrastructure.length.toString().padStart(3)}  명시적 인프라 면제`,
  );
  lines.push(
    `  backfill-backlog ${report.backfillBacklog.length.toString().padStart(3)}  grandfathered, 향후 promise/aspect/check 태그 필요`,
  );
  lines.push(
    `  orphan           ${report.orphans.length.toString().padStart(3)}  ${report.orphans.length > 0 ? "⚠ 즉시 처리 필요" : ""}`,
  );
  lines.push("");
  if (report.orphans.length > 0) {
    lines.push("Orphans (promise/aspect/check/us 태그 또는 allowlist 등록 필요):");
    for (const entry of report.orphans) {
      lines.push(`  ${entry.path}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

main();
