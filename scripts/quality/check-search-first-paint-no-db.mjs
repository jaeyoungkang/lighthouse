// guard:search-first-paint-no-db — query-canonical search first paint must not
// import the repository seam except for explicitly bounded first-result side
// channels (auth membership, analytics mirror, live My Library preflight).
//
// @aspect aspect:first-paint-persistence-independence
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { defineGuardExceptions } from "./guard-exception-policy.mjs";

export const DEFAULT_ENTRYPOINTS = [
  "app/(research)/search-route-page.tsx",
  "app/(research)/relationship-route-page.tsx",
  "app/server/services/search-execution.ts",
  "app/server/services/relationship-execution.ts",
];

const GUARD_ID = "guard:search-first-paint-no-db";
const DEFAULT_ALLOWED_REPOSITORY_CHAINS = defineGuardExceptions(
  GUARD_ID,
  [
    {
      id: "analytics-mirror-after-first-paint",
      dynamicModule: "app/server/domain-access/server-analytics.ts",
      repositoryModule: "app/server/repository/analytics-events.ts",
      repositoryImporterModule: "app/server/domain-access/analytics-event-access.ts",
      importKinds: ["dynamic-fire-and-forget"],
      reason: "fire-and-forget canonical analytics mirror after route-owned first paint",
      owner: "Lighthouse analytics event boundary",
      reviewWhen: "review when analytics persistence joins the first-paint response dependency",
    },
    {
      id: "live-library-graph-preflight",
      dynamicModule: "app/server/domain-access/reviewed-paper-access.ts",
      repositoryModule: "app/server/repository/reviewed-papers.ts",
      repositoryImporterModule: "app/server/domain-access/reviewed-paper-access.ts",
      importerModule: "app/server/services/search-execution.ts",
      importKinds: ["dynamic-live-library-preflight"],
      reason: "current owner-shaped My Library source read",
      owner: "Lighthouse search first-paint boundary",
      reviewWhen: "review when the My Library source owner or first-payload dependency changes",
    },
    {
      id: "authenticated-external-access-membership",
      dynamicModule: "app/server/domain-access/access-allowlist-access.ts",
      repositoryModule: "app/server/repository/access-allowlist.ts",
      repositoryImporterModule: "app/server/domain-access/access-allowlist-access.ts",
      importerModule: "app/server/auth/identity.ts",
      importKinds: ["static"],
      reason: "one indexed exact-email membership read before an authenticated external request",
      owner: "Lighthouse authentication boundary",
      reviewWhen: "review when invited access no longer requires next-request revocation",
    },
  ],
  { requiredMatchFields: ["dynamicModule", "repositoryModule"] },
);

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"];
const STATIC_IMPORT_RE =
  /import\s+(?!type\b)(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']|export\s+(?!type\b)[\s\S]*?\s+from\s+["']([^"']+)["']/g;
const DYNAMIC_IMPORT_RE = /\b(void|await)?\s*import\s*\(\s*["']([^"']+)["']\s*\)/g;

export async function runSearchFirstPaintNoDbGuard(options = {}) {
  const root = options.root ?? process.cwd();
  const enforceExceptionLiveness = options.enforceExceptionLiveness ?? true;
  const allowAbsentExceptionMatches = options.allowAbsentExceptionMatches ?? false;
  const entrypoints = options.entrypoints ?? DEFAULT_ENTRYPOINTS;
  const repositoryPrefix =
    options.repositoryPrefix ?? path.join(root, "app", "server", "repository");
  const allowedRepositoryChains = options.allowedRepositoryChains
    ? defineGuardExceptions(GUARD_ID, options.allowedRepositoryChains, {
        requiredMatchFields: ["dynamicModule", "repositoryModule"],
      })
    : DEFAULT_ALLOWED_REPOSITORY_CHAINS;
  const state = {
    visited: new Set(),
    violations: [],
    missing: [],
    allowedRepositoryImports: [],
    matchedExceptionIds: new Set(),
  };

  for (const entrypoint of entrypoints) {
    await scanFile(path.join(root, entrypoint), [entrypoint], {
      root,
      repositoryPrefix,
      allowedRepositoryChains,
      allowedRepositoryChain: null,
      repositoryImporterModule: null,
      state,
    });
  }

  if (enforceExceptionLiveness) {
    for (const exception of allowedRepositoryChains) {
      if (state.matchedExceptionIds.has(exception.id)) continue;
      if (allowAbsentExceptionMatches && !(await hasAnyExceptionMatchPath(root, exception))) {
        continue;
      }
      state.violations.push({
        file: exception.dynamicModule,
        chain: [`declared exception ${exception.id} did not match a repository side-channel`],
        reason: "stale-guard-exception",
      });
    }
  }

  return {
    ok: state.missing.length === 0 && state.violations.length === 0,
    visitedCount: state.visited.size,
    violations: state.violations,
    missing: state.missing,
    allowedRepositoryImports: state.allowedRepositoryImports,
  };
}

async function main() {
  const result = await runSearchFirstPaintNoDbGuard();

  if (result.missing.length > 0) {
    console.error("[guard:search-first-paint-no-db] import 해석 실패:");
    for (const item of result.missing) {
      console.error(`- ${item.importer} -> ${item.specifier}`);
    }
    process.exit(1);
  }

  if (result.violations.length > 0) {
    console.error("[guard:search-first-paint-no-db] 검색 첫 paint 경로의 repository import 발견:");
    for (const violation of result.violations) {
      console.error(`- ${violation.file}`);
      console.error(`  via ${violation.chain.join(" -> ")}`);
    }
    console.error(
      "  /search?q= 첫 결과 경로는 허용된 side-channel 외 app/server/repository/** seam을 import하지 않아야 합니다.",
    );
    process.exit(1);
  }

  const allowedCount = result.allowedRepositoryImports.length;
  const suffix =
    allowedCount > 0 ? `, allowed bounded repository side-channel ${allowedCount}건` : "";
  console.log(
    `[guard:search-first-paint-no-db] OK (${result.visitedCount}개 모듈 스캔, repository import 0건${suffix}).`,
  );
}

async function scanFile(file, chain, context) {
  const resolved = await resolveExistingFile(file);
  if (!resolved) {
    context.state.missing.push({
      importer: chain.at(-1),
      specifier: path.relative(context.root, file),
    });
    return;
  }
  const visitKey = [
    resolved,
    context.allowedRepositoryChain?.id ?? "",
    context.repositoryImporterModule ?? "",
  ].join("|");
  if (context.state.visited.has(visitKey)) return;
  context.state.visited.add(visitKey);

  if (isRepositoryPath(resolved, context.repositoryPrefix)) {
    const allowed = findAllowedDynamicRepositoryChain(resolved, context);
    if (allowed) {
      context.state.allowedRepositoryImports.push({
        id: allowed.id,
        file: path.relative(context.root, resolved),
        chain,
        reason: allowed.reason,
        owner: allowed.owner,
        reviewWhen: allowed.reviewWhen,
      });
      context.state.matchedExceptionIds.add(allowed.id);
      return;
    }
    context.state.violations.push({ file: path.relative(context.root, resolved), chain });
    return;
  }

  const source = await readFile(resolved, "utf8");
  for (const importRecord of getImportSpecifiers(source)) {
    const next = resolveLocalSpecifier(context.root, resolved, importRecord.specifier);
    if (!next) continue;
    const nextResolved = await resolveExistingFile(next);
    if (!nextResolved) {
      context.state.missing.push({
        importer: path.relative(context.root, resolved),
        specifier: importRecord.specifier,
      });
      continue;
    }
    const rel = path.relative(context.root, nextResolved);
    const importerRel = path.relative(context.root, resolved);
    const nextAllowedDynamicChain = getAllowedDynamicChain(rel, importerRel, importRecord, context);
    await scanFile(nextResolved, [...chain, `${rel} (${importRecord.kind})`], {
      ...context,
      allowedRepositoryChain: nextAllowedDynamicChain ?? context.allowedRepositoryChain,
      repositoryImporterModule: importerRel,
    });
  }
}

function getImportSpecifiers(source) {
  const specifiers = [];
  STATIC_IMPORT_RE.lastIndex = 0;
  DYNAMIC_IMPORT_RE.lastIndex = 0;

  for (;;) {
    const match = STATIC_IMPORT_RE.exec(source);
    if (!match) break;
    const specifier = match[1] ?? match[2];
    if (specifier) specifiers.push({ specifier, kind: "static" });
  }
  for (;;) {
    const match = DYNAMIC_IMPORT_RE.exec(source);
    if (!match) break;
    if (isTypePositionDynamicImport(source, match.index)) continue;
    let kind = match[1] === "void" ? "dynamic-fire-and-forget" : "dynamic";
    if (kind === "dynamic" && hasLibraryPreflightAllowMarker(source, match.index)) {
      kind = "dynamic-live-library-preflight";
    }
    specifiers.push({ specifier: match[2], kind });
  }
  return specifiers;
}

function hasLibraryPreflightAllowMarker(source, importIndex) {
  const precedingWindow = source.slice(Math.max(0, importIndex - 240), importIndex);
  return (
    precedingWindow.includes("@search-first-paint-allow live-library-preflight") ||
    precedingWindow.includes("@search-first-paint-allow cached-library-preflight")
  );
}

function isTypePositionDynamicImport(source, importIndex) {
  const lineStart = source.lastIndexOf("\n", importIndex) + 1;
  const linePrefix = source.slice(lineStart, importIndex);
  return (
    /\btype\s+[$_\p{ID_Start}][$_\p{ID_Continue}]*\s*=.*$/u.test(linePrefix) ||
    /\binterface\s+[$_\p{ID_Start}][$_\p{ID_Continue}]*\b.*$/u.test(linePrefix) ||
    /(?:[:<,\(]\s*|extends\s+|implements\s+|readonly\s+)$/.test(linePrefix)
  );
}

function getAllowedDynamicChain(relativeModule, importerModule, importRecord, context) {
  if (importRecord.kind !== "dynamic" && importRecord.kind !== "dynamic-fire-and-forget") {
    const hasExplicitAllowedKind = context.allowedRepositoryChains.some((candidate) =>
      (candidate.importKinds ?? []).includes(importRecord.kind),
    );
    if (!hasExplicitAllowedKind) return null;
  }
  const allowed = context.allowedRepositoryChains.find((candidate) => {
    if (normalizeRelativePath(candidate.dynamicModule) !== normalizeRelativePath(relativeModule)) {
      return false;
    }
    if (
      candidate.importerModule &&
      normalizeRelativePath(candidate.importerModule) !== normalizeRelativePath(importerModule)
    ) {
      return false;
    }
    const importKinds = candidate.importKinds ?? ["dynamic-fire-and-forget"];
    return importKinds.includes(importRecord.kind);
  });
  return allowed ?? null;
}

function findAllowedDynamicRepositoryChain(resolved, context) {
  if (!context.allowedRepositoryChain) return null;
  const relativeRepository = normalizeRelativePath(path.relative(context.root, resolved));
  const allowed = context.allowedRepositoryChain;
  const expectedImporter = normalizeRelativePath(
    allowed.repositoryImporterModule ?? allowed.dynamicModule,
  );
  const actualImporter = normalizeRelativePath(context.repositoryImporterModule ?? "");
  return normalizeRelativePath(allowed.repositoryModule) === relativeRepository &&
    expectedImporter === actualImporter
    ? allowed
    : null;
}

function resolveLocalSpecifier(root, importer, specifier) {
  if (specifier.startsWith("@/")) {
    return path.join(root, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(importer), specifier);
  }
  return null;
}

async function resolveExistingFile(candidate) {
  if (await isFile(candidate)) return candidate;
  for (const extension of SOURCE_EXTENSIONS) {
    const withExtension = `${candidate}${extension}`;
    if (await isFile(withExtension)) return withExtension;
  }
  for (const extension of SOURCE_EXTENSIONS) {
    const indexFile = path.join(candidate, `index${extension}`);
    if (await isFile(indexFile)) return indexFile;
  }
  return null;
}

async function isFile(candidate) {
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
}

function isRepositoryPath(candidate, repositoryPrefix) {
  return candidate === repositoryPrefix || candidate.startsWith(`${repositoryPrefix}${path.sep}`);
}

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

async function hasAnyExceptionMatchPath(root, exception) {
  const matchPaths = [
    exception.dynamicModule,
    exception.repositoryModule,
    exception.repositoryImporterModule,
    exception.importerModule,
  ].filter(Boolean);
  for (const matchPath of matchPaths) {
    if (await resolveExistingFile(path.join(root, matchPath))) return true;
  }
  return false;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
