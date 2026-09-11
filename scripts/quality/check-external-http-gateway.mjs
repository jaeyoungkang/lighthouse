// guard:external-http-gateway — server-side outbound HTTP must pass through an
// explicit effect owner.
//
// Why this gate exists (#183 follow-up): route deadlines and circuit breakers
// only work when provider/network calls have a small chokepoint. A raw
// `fetch(...)` in an arbitrary service can escape timeout, retry, breaker, and
// load-shed policy. Provider HTTP stays in `app/server/external-http-gateway/`;
// Amplitude and Supabase keep separate effect-specific owners.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { collectRouteHandlerPaths } from "./route-handler-files.mjs";

const ROOT = process.cwd();
const SCAN_DIRS = [
  path.join(ROOT, "app", "api"),
  // Retired server-owner locations remain negative scan roots so raw outbound
  // effects cannot silently reappear behind an old import path.
  path.join(ROOT, "app", "lib", "analytics", "sinks"),
  path.join(ROOT, "app", "lib", "supabase"),
  path.join(ROOT, "app", "server"),
  path.join(ROOT, "packages"),
];
const ALLOWED_DIRS = [path.join(ROOT, "app", "server", "external-http-gateway")];
export const EXPLICIT_OUTBOUND_OWNER_FILES = new Set([
  "app/server/services/analytics/amplitude-sink.ts",
  "app/server/auth/supabase.ts",
]);
const ALLOW_HISTORICAL_OUTBOUND_OWNERS = process.argv
  .slice(2)
  .includes("--allow-historical-outbound-owners");
const HISTORICAL_OUTBOUND_OWNER_PAIRS = [
  ["app/server/services/analytics/amplitude-sink.ts", "app/lib/analytics/sinks/amplitude.ts"],
  ["app/server/auth/supabase.ts", "app/lib/supabase/server.ts"],
];
if (ALLOW_HISTORICAL_OUTBOUND_OWNERS) {
  for (const [currentOwner, historicalOwner] of HISTORICAL_OUTBOUND_OWNER_PAIRS) {
    if (!(await exists(path.join(ROOT, currentOwner)))) {
      EXPLICIT_OUTBOUND_OWNER_FILES.add(historicalOwner);
    }
  }
}
const FETCH_RE = /\b(?:globalThis\.)?fetch\s*\(|\bfetchImpl\s*\(|\?\?\s*(?:globalThis\.)?fetch\b/;

const sourceFiles = [];
for (const dir of SCAN_DIRS) {
  await collectSourceFiles(dir);
}
for (const routePath of await collectRouteHandlerPaths(ROOT)) {
  await collectSourceFiles(path.join(ROOT, routePath));
}
await collectSourceFiles(path.join(ROOT, "proxy.ts"));
const scopedSourceFiles = [...new Set(sourceFiles)].sort();

const violations = [];
for (const file of scopedSourceFiles) {
  const contents = await readFile(file, "utf8");
  const rel = path.relative(ROOT, file);
  violations.push(...findExternalHttpGatewayViolations(rel, contents));
}

if (violations.length > 0) {
  console.error(
    "[guard:external-http-gateway] 선언된 effect owner 밖의 server-side fetch를 발견했습니다:",
  );
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.text}`);
  }
  console.error(
    "  Provider HTTP는 external-http-gateway에 두고 analytics/Supabase transport는 선언된 owner 파일에만 두세요.",
  );
  process.exit(1);
}

console.log(
  `[guard:external-http-gateway] OK (${scopedSourceFiles.length}개 scoped production source 스캔, effect owner 밖 fetch 0건).`,
);

function isAllowedDir(targetPath) {
  return ALLOWED_DIRS.some(
    (allowed) => targetPath === allowed || targetPath.startsWith(`${allowed}${path.sep}`),
  );
}

async function exists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function findExternalHttpGatewayViolations(file, contents) {
  if (EXPLICIT_OUTBOUND_OWNER_FILES.has(file)) return [];

  const violations = [];
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (FETCH_RE.test(lines[index])) {
      violations.push({ file, line: index + 1, text: lines[index].trim() });
    }
  }
  return violations;
}

async function collectSourceFiles(targetPath) {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return;
  }

  if (targetStat.isDirectory()) {
    if (isAllowedDir(targetPath)) return;
    const base = path.basename(targetPath);
    if (base === "node_modules" || base === "dist" || base === "__tests__") return;
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      await collectSourceFiles(path.join(targetPath, entry.name));
    }
    return;
  }

  const base = path.basename(targetPath);
  if (base.endsWith(".test.ts") || base.endsWith(".test.tsx")) return;
  if (base.endsWith(".ts") || base.endsWith(".tsx")) {
    sourceFiles.push(targetPath);
  }
}
