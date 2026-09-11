// guard:route-deadline — every Route Handler must declare a per-route deadline budget.
//
// Why this gate exists (#183 K2): Vercel functions default to a 300s ceiling.
// A single stuck route can hold its pooled DB connection for the full default
// before the platform kills it. Declaring `export const maxDuration = <int>;`
// on each route caps the worst case per endpoint and keeps the multi-layer
// deadline budget (per-route maxDuration → req.signal → role statement_timeout)
// honest. This check fails on real drift only: a route missing the export, or a
// value outside the sane budget band. It is deterministic and does not depend on
// git diff, so routine commits never false-fail.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { collectRouteHandlerPaths } from "./route-handler-files.mjs";

const ROOT = process.cwd();
// Match a top-level `export const maxDuration = <int>;` declaration.
const MAX_DURATION_RE = /^export const maxDuration\s*=\s*(\d+)\s*;/m;
// Guard-wide safety ceiling for Route Handler budgets. Changing this band
// requires an operational-readiness review; do not derive it from one route or
// from the mutable ingress inventory that this guard constrains.
const CEILING_SECONDS = 120;

export async function validateRouteDeadlineBudget(root = ROOT) {
  const routePaths = await collectRouteHandlerPaths(root);
  const violations = [];

  for (const routePath of routePaths) {
    const contents = await readFile(path.join(root, routePath), "utf8");
    const match = MAX_DURATION_RE.exec(contents);

    if (!match) {
      violations.push({
        file: routePath,
        line: 1,
        message: "최상위 `export const maxDuration = <int>;`가 없습니다 (Vercel 300s 기본값 상속).",
      });
      continue;
    }

    const value = Number(match[1]);
    const line = contents.slice(0, match.index).split("\n").length;
    if (value <= 0 || value > CEILING_SECONDS) {
      violations.push({
        file: routePath,
        line,
        message: `maxDuration=${value}가 예산(1..${CEILING_SECONDS}s)을 벗어났습니다.`,
      });
    }
  }

  return { ok: violations.length === 0, routeCount: routePaths.length, violations };
}

const isDirectExecution =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href ===
    pathToFileURL(fileURLToPath(import.meta.url)).href;

if (isDirectExecution) {
  const result = await validateRouteDeadlineBudget();
  if (!result.ok) {
    console.error("[guard:route-deadline] route deadline 예산 위반을 발견했습니다:");
    for (const violation of result.violations) {
      console.error(`- ${violation.file}:${violation.line} ${violation.message}`);
    }
    process.exit(1);
  }

  console.log(
    `[guard:route-deadline] app/**/route.ts OK (Route Handler ${result.routeCount}개, 모두 1..${CEILING_SECONDS}s 예산 이내).`,
  );
}
