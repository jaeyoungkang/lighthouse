// mc:audit-story-surface — Phase 4A parallel surface audit.
//
// Recognises canonical Story Chain surface tags:
//
//   // @promise promise:<slug>
//   // @aspect  aspect:<slug>
//   // @check   intent-check:<slug>      (or)   acceptance-check:<slug>
//
// Each ref must resolve against the Story Chain loaded from
// `docs/contracts/story-chain/`. Unresolved refs are an audit failure.
//
//
// Usage:
//   tsx scripts/mission-control/mc-audit-story-surface.ts             # full inventory
//   tsx scripts/mission-control/mc-audit-story-surface.ts --json      # machine-readable
//   tsx scripts/mission-control/mc-audit-story-surface.ts --staged    # check staged surface diffs only
//
// Exit code: 0 on success; 1 when any story-chain ref is unresolved.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { traceabilityNodePattern } from "@/app/domain/story-chain";
import { loadStoryChain } from "@/app/server/services/story-chain/loader";
import { validateStoryChain } from "@/app/server/services/story-chain/validator";

type Classification = "story-tagged" | "untagged";

interface SurfaceTag {
  kind: "promise" | "aspect" | "check";
  ref: string;
}

interface SurfaceEntry {
  path: string;
  classification: Classification;
  tags: SurfaceTag[];
  // Refs whose target does not exist in the loaded chain.
  unresolvedRefs: string[];
  // Refs whose target exists but the weaving relationship implied by
  // co-tagging is broken. Three rules:
  //   1. `@aspect A` + `@promise P` → A.appliesTo must include P AND
  //      P.aspects must include A (reciprocal weaving). When the surface
  //      tags multiple promises, at least one of them must satisfy the
  //      reciprocal pair with A.
  //   2. `@check C` + `@promise P` → C must be declared on at least one
  //      tagged promise's intentChecks / acceptanceChecks list.
  //   3. `@aspect` or `@check` without any `@promise` on the same surface
  //      is tolerated (cross-cutting surfaces may not declare a primary
  //      promise) — only ref existence is checked in that case.
  weavingViolations: string[];
}

const REPO_ROOT = resolve(__dirname, "..", "..");

const SURFACE_ROOTS = ["app"] as const;

// Mirror mc-audit-surface SURFACE_FILE_PATTERNS so both audits see the same
// surface set. .ts hooks/stores carry tags too — they are part of the
// user-facing client behavior and must be subject to the same chain checks.
//
// In addition, ANY .ts/.tsx file under app/** that already carries a story-
// chain tag is included regardless of pattern match (union scan).
// Otherwise an author who tags a file outside the canonical pattern would silently bypass the
// chain ref + weaving check.
const SURFACE_FILE_PATTERNS = [
  /\/page\.tsx$/,
  /\/layout\.tsx$/,
  /^app\/components\/.*\.tsx$/,
  /^app\/components\/.*\/use[A-Z][A-Za-z0-9]*\.ts$/,
  /^app\/stores\/.*\.ts$/,
];
const EXCLUDE_PATTERNS = [/\/__tests__\//, /\.test\.tsx?$/, /\.shared\.tsx?$/, /\.helpers\.tsx?$/];

// Tag scan window is generous (24 lines) because a surface may have a
// docstring header before the magic comments.
const TAG_SCAN_LINES = 24;

const PROMISE_TAG_RE = new RegExp(
  `^\\s*//\\s*@promise\\s+(${traceabilityNodePattern("promise", "[a-z0-9-]+")})`,
);
const ASPECT_TAG_RE = new RegExp(
  `^\\s*//\\s*@aspect\\s+(${traceabilityNodePattern("aspect", "[a-z0-9-]+")})`,
);
const CHECK_TAG_RE = new RegExp(
  `^\\s*//\\s*@check\\s+(${traceabilityNodePattern("intent-check", "[a-z0-9-]+")}|${traceabilityNodePattern("acceptance-check", "[a-z0-9-]+")})`,
);

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

function walkAllAppFiles(): string[] {
  const files: string[] = [];
  for (const root of SURFACE_ROOTS) {
    walkDir(join(REPO_ROOT, root), files);
  }
  return files
    .map((absPath) => relative(REPO_ROOT, absPath).replaceAll("\\", "/"))
    .filter((relPath) => !EXCLUDE_PATTERNS.some((re) => re.test(relPath)))
    .sort();
}

function walkSurfaceFiles(): string[] {
  // A file is in scope when it matches the canonical surface pattern OR it
  // already carries a story-chain tag (union scan). The second leg
  // ensures tagged files outside the canonical pattern (e.g. one-off internal
  // pages) cannot escape ref + weaving validation.
  const candidates = walkAllAppFiles();
  return candidates.filter((relPath) => {
    if (SURFACE_FILE_PATTERNS.some((re) => re.test(relPath))) return true;
    return readSurfaceTags(relPath).length > 0;
  });
}

function readSurfaceTags(relPath: string): SurfaceTag[] {
  const absPath = join(REPO_ROOT, relPath);
  const content = readFileSync(absPath, "utf8");
  const lines = content.split("\n", TAG_SCAN_LINES);
  const tags: SurfaceTag[] = [];
  for (const line of lines) {
    const promiseMatch = line.match(PROMISE_TAG_RE);
    if (promiseMatch) tags.push({ kind: "promise", ref: promiseMatch[1] });
    const aspectMatch = line.match(ASPECT_TAG_RE);
    if (aspectMatch) tags.push({ kind: "aspect", ref: aspectMatch[1] });
    const checkMatch = line.match(CHECK_TAG_RE);
    if (checkMatch) tags.push({ kind: "check", ref: checkMatch[1] });
  }
  return tags;
}

interface ChainIndex {
  promiseIds: Set<string>;
  aspectIds: Set<string>;
  intentCheckIds: Set<string>;
  acceptanceCheckIds: Set<string>;
  // Weaving lookup maps (ref → set of related refs) used by the surface
  // audit to verify reciprocal weaving when @promise + @aspect / @check
  // co-occur on the same surface.
  promiseAspects: Map<string, Set<string>>;
  aspectAppliesTo: Map<string, Set<string>>;
  promiseIntentChecks: Map<string, Set<string>>;
  promiseAcceptanceChecks: Map<string, Set<string>>;
}

function buildChainIndex(): ChainIndex {
  const chain = loadStoryChain(REPO_ROOT);
  validateStoryChain(chain);
  const promiseIds = new Set(chain.promises.map((p) => p.id));
  const aspectIds = new Set(chain.aspects.map((a) => a.id));
  const intentCheckIds = new Set<string>();
  const acceptanceCheckIds = new Set<string>();
  const promiseAspects = new Map<string, Set<string>>();
  const promiseIntentChecks = new Map<string, Set<string>>();
  const promiseAcceptanceChecks = new Map<string, Set<string>>();
  for (const promise of chain.promises) {
    promiseAspects.set(promise.id, new Set(promise.aspects));
    promiseIntentChecks.set(promise.id, new Set(promise.intentChecks.map((ic) => ic.id)));
    promiseAcceptanceChecks.set(promise.id, new Set(promise.acceptanceChecks.map((ac) => ac.id)));
    for (const ic of promise.intentChecks) intentCheckIds.add(ic.id);
    for (const ac of promise.acceptanceChecks) acceptanceCheckIds.add(ac.id);
  }
  const aspectAppliesTo = new Map<string, Set<string>>();
  for (const aspect of chain.aspects) {
    aspectAppliesTo.set(aspect.id, new Set(aspect.appliesTo));
  }
  return {
    promiseIds,
    aspectIds,
    intentCheckIds,
    acceptanceCheckIds,
    promiseAspects,
    aspectAppliesTo,
    promiseIntentChecks,
    promiseAcceptanceChecks,
  };
}

function resolveTagExistence(tags: readonly SurfaceTag[], index: ChainIndex): string[] {
  const unresolved: string[] = [];
  for (const tag of tags) {
    if (tag.kind === "promise" && !index.promiseIds.has(tag.ref)) {
      unresolved.push(tag.ref);
    } else if (tag.kind === "aspect" && !index.aspectIds.has(tag.ref)) {
      unresolved.push(tag.ref);
    } else if (tag.kind === "check") {
      if (!index.intentCheckIds.has(tag.ref) && !index.acceptanceCheckIds.has(tag.ref)) {
        unresolved.push(tag.ref);
      }
    }
  }
  return unresolved;
}

function checkAspectWeaving(
  aspectRef: string,
  promiseRefs: readonly string[],
  index: ChainIndex,
): string | null {
  // Reciprocal weaving requires at least one tagged promise to declare the
  // aspect AND that aspect to list the promise in its appliesTo set.
  for (const promiseRef of promiseRefs) {
    const declared = index.promiseAspects.get(promiseRef)?.has(aspectRef) ?? false;
    const reverse = index.aspectAppliesTo.get(aspectRef)?.has(promiseRef) ?? false;
    if (declared && reverse) return null;
  }
  const promiseList = promiseRefs.join(", ");
  return `${aspectRef}: not reciprocally woven with any tagged promise (tagged: ${promiseList}). promise.aspects must include the aspect AND aspect.appliesTo must include the promise.`;
}

function checkCheckOwnership(
  checkRef: string,
  promiseRefs: readonly string[],
  index: ChainIndex,
): string | null {
  for (const promiseRef of promiseRefs) {
    const intentSet = index.promiseIntentChecks.get(promiseRef);
    const acceptanceSet = index.promiseAcceptanceChecks.get(promiseRef);
    if (intentSet?.has(checkRef) || acceptanceSet?.has(checkRef)) return null;
  }
  const promiseList = promiseRefs.join(", ");
  return `${checkRef}: not declared on any tagged promise (tagged: ${promiseList}).`;
}

function resolveTagWeaving(tags: readonly SurfaceTag[], index: ChainIndex): string[] {
  const taggedPromises = tags.filter((t) => t.kind === "promise").map((t) => t.ref);
  if (taggedPromises.length === 0) return []; // tolerated — see SurfaceEntry comment
  const violations: string[] = [];
  for (const tag of tags) {
    if (tag.kind === "aspect") {
      // Skip aspects whose ref does not exist — caught by existence check.
      if (!index.aspectIds.has(tag.ref)) continue;
      const violation = checkAspectWeaving(tag.ref, taggedPromises, index);
      if (violation) violations.push(violation);
    } else if (tag.kind === "check") {
      if (!index.intentCheckIds.has(tag.ref) && !index.acceptanceCheckIds.has(tag.ref)) continue;
      const violation = checkCheckOwnership(tag.ref, taggedPromises, index);
      if (violation) violations.push(violation);
    }
  }
  return violations;
}

function classify(tags: readonly SurfaceTag[]): Classification {
  return tags.length > 0 ? "story-tagged" : "untagged";
}

interface AuditReport {
  total: number;
  storyTagged: SurfaceEntry[];
  untagged: SurfaceEntry[];
  failed: SurfaceEntry[]; // unresolved refs OR weaving violations
}

function isSurfaceFailed(e: SurfaceEntry): boolean {
  return e.unresolvedRefs.length > 0 || e.weavingViolations.length > 0;
}

function buildReport(entries: SurfaceEntry[]): AuditReport {
  return {
    total: entries.length,
    storyTagged: entries.filter((e) => e.classification === "story-tagged"),
    untagged: entries.filter((e) => e.classification === "untagged"),
    failed: entries.filter(isSurfaceFailed),
  };
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

function formatReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`mc:audit-story-surface — ${String(report.total)} surface 파일 (Phase 4A)`);
  lines.push("");
  lines.push(
    `  story-tagged   ${String(report.storyTagged.length).padStart(3)}  // @promise / @aspect / @check 선언`,
  );
  lines.push(`  untagged       ${String(report.untagged.length).padStart(3)}  canonical tag 없음`);
  if (report.failed.length > 0) {
    lines.push("");
    lines.push("Surface audit failures:");
    for (const e of report.failed) {
      lines.push(`  ${e.path}`);
      for (const ref of e.unresolvedRefs) lines.push(`    unresolved ref: ${ref}`);
      for (const v of e.weavingViolations) lines.push(`    weaving: ${v}`);
    }
  }
  if (report.storyTagged.length > 0) {
    lines.push("");
    lines.push("Story-tagged surfaces:");
    for (const e of report.storyTagged) {
      const refs = e.tags.map((t) => t.ref).join(", ");
      lines.push(`  ${e.path}  →  ${refs}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

// Staged-mode triggers: when any staged file matches one of these prefixes,
// the audit must run on the FULL surface set, not just staged surface files.
// Reason: if a promise / aspect / check is renamed or deleted in the
// story-chain docs (or the loader / domain types / this script changes),
// surface files tagged with the now-broken ref do not themselves appear in
// the staged diff. Filtering to staged surfaces would silently let the
// breaking change land.
const STAGED_FULL_AUDIT_TRIGGERS = [
  "docs/contracts/story-chain/",
  "app/server/services/story-chain/",
  "app/domain/story-chain.ts",
  "scripts/mission-control/mc-audit-story-surface.ts",
];

function reportFailures(entries: readonly SurfaceEntry[]): void {
  for (const e of entries) {
    for (const ref of e.unresolvedRefs) {
      process.stderr.write(`  ${e.path}: unresolved ref ${ref}\n`);
    }
    for (const v of e.weavingViolations) {
      process.stderr.write(`  ${e.path}: weaving ${v}\n`);
    }
  }
}

function main(): void {
  const wantsJson = process.argv.includes("--json");
  const stagedOnly = process.argv.includes("--staged");

  const index = buildChainIndex();
  const surfaceFiles = walkSurfaceFiles();
  const entries: SurfaceEntry[] = surfaceFiles.map((relPath) => {
    const tags = readSurfaceTags(relPath);
    return {
      path: relPath,
      classification: classify(tags),
      tags,
      unresolvedRefs: resolveTagExistence(tags, index),
      weavingViolations: resolveTagWeaving(tags, index),
    };
  });
  const report = buildReport(entries);

  if (stagedOnly) {
    const staged = getStagedFiles();
    const stagedSet = new Set(staged);
    const triggersFullAudit = staged.some((f) =>
      STAGED_FULL_AUDIT_TRIGGERS.some((prefix) => f.startsWith(prefix)),
    );

    if (triggersFullAudit) {
      process.stdout.write(
        "mc:audit-story-surface — staged files touch story-chain content / parser / domain / script. running full surface audit.\n",
      );
      if (report.failed.length > 0) {
        process.stderr.write(
          `mc:audit-story-surface — ${String(report.failed.length)} surface(s) failed (unresolved refs or weaving violations) after this change:\n`,
        );
        reportFailures(report.failed);
        process.exit(1);
      }
      process.exit(0);
    }

    const stagedFailed = report.failed.filter((e) => stagedSet.has(e.path));
    if (stagedFailed.length > 0) {
      process.stderr.write(
        `mc:audit-story-surface — ${String(stagedFailed.length)} staged surface(s) failed (unresolved refs or weaving violations):\n`,
      );
      reportFailures(stagedFailed);
      process.exit(1);
    }
    process.stdout.write(
      "mc:audit-story-surface — no staged files affect story-chain surface tags. ok.\n",
    );
    process.exit(0);
  }

  if (wantsJson) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatReport(report));
  }
  if (report.failed.length > 0) {
    process.stderr.write(
      `mc:audit-story-surface — ${String(report.failed.length)} surface(s) failed (unresolved refs or weaving violations).\n`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
