// structural-audit — 소스 직접 유도 정적 import 그래프 (dependency-cruiser 비의존)
// 사용: node shared-skills/structural-audit/references/import-graph-extractor.mjs <repo-root> <out.json>
//
// 한계(의도된 범위):
// - template literal 안의 import 모양 문자열은 엣지로 오인될 수 있다 (block comment는 제거한다).
// - Tarjan SCC는 재귀 구현이라 수천 노드급 깊은 체인에서 stack 한계가 있을 수 있다.
// - cross-zone findings는 후보 검출용 확장 검사이며 .dependency-cruiser.cjs 규칙의
//   재구현이 아니다. 두 결과의 불일치는 그 자체가 감사의 triage 대상이다.
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

import { compareCodePoints } from "./topology-fingerprint.mjs";

const ROOT = resolve(process.argv[2] ?? ".");
const OUT = process.argv[3] ?? "graph.json";

const EXCLUDE_DIR = /(^|\/)(__tests__|node_modules|\.next)(\/|$)/;
const EXCLUDE_FILE = /(\.test\.|\.live\.test\.|\.spec\.|\.d\.ts$)/;
const CODE_EXT = /\.(ts|tsx|mts)$/;

function walk(dir, acc) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!EXCLUDE_DIR.test("/" + relative(ROOT, p) + "/")) walk(p, acc);
    } else if (CODE_EXT.test(name) && !EXCLUDE_FILE.test(name)) {
      acc.push(p);
    }
  }
  return acc;
}

const files = walk(join(ROOT, "app"), []);
for (const extra of ["proxy.ts", "instrumentation-client.ts"]) {
  const p = join(ROOT, extra);
  if (existsSync(p)) files.push(p);
}
files.sort((left, right) => compareCodePoints(relative(ROOT, left), relative(ROOT, right)));

const fileSet = new Set(files.map((f) => relative(ROOT, f)));

function resolveSpec(fromFile, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(join(ROOT, fromFile)), spec);
  else return null; // external package
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".mts",
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  for (const c of candidates) {
    const rel = relative(ROOT, c);
    if (fileSet.has(rel)) return rel;
  }
  return { unresolved: relative(ROOT, base) };
}

// import 문 파싱: static import / side-effect import / export-from(`* [as ns]` 포함) / dynamic import()
// 문두는 줄 시작 또는 `;` 뒤를 허용해 같은 물리 줄의 두 번째 문장도 잡는다.
const RE_STATIC = /(^|[\n;])\s*import\s+(type\s+)?[^'"]*?from\s*['"]([^'"]+)['"]/g;
const RE_SIDE = /(^|[\n;])\s*import\s*['"]([^'"]+)['"]/g;
const RE_EXPORT =
  /(^|[\n;])\s*export\s+(type\s+)?(\*(\s+as\s+\w+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/g;
const RE_DYNAMIC = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const RE_BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;

const edges = [];
const unresolved = [];
for (const abs of files) {
  const from = relative(ROOT, abs);
  const src = readFileSync(abs, "utf8").replace(RE_BLOCK_COMMENT, "");
  const seen = new Map(); // to -> {typeOnly, dynamic}
  const add = (spec, typeOnly, dynamic) => {
    if (/\.(css|svg|png|jpe?g|ico|woff2?)$/.test(spec)) return;
    const r = resolveSpec(from, spec);
    if (r === null) return;
    if (typeof r === "object") {
      unresolved.push({ from, spec });
      return;
    }
    const prev = seen.get(r);
    if (prev) {
      prev.typeOnly = prev.typeOnly && typeOnly;
      prev.dynamic = prev.dynamic && dynamic;
    } else seen.set(r, { typeOnly, dynamic });
  };
  for (const m of src.matchAll(RE_STATIC)) add(m[3], Boolean(m[2]), false);
  for (const m of src.matchAll(RE_SIDE)) add(m[2], false, false);
  for (const m of src.matchAll(RE_EXPORT)) add(m[5], Boolean(m[2]), false);
  for (const m of src.matchAll(RE_DYNAMIC)) add(m[1], false, true);
  for (const [to, f] of seen) edges.push({ from, to, typeOnly: f.typeOnly, dynamic: f.dynamic });
}

// ---- 분석 ----
const nodes = [...fileSet];
const adj = new Map(nodes.map((n) => [n, []]));
const radj = new Map(nodes.map((n) => [n, []]));
for (const e of edges) {
  adj.get(e.from)?.push(e);
  radj.get(e.to)?.push(e);
}

// Tarjan SCC (전체 엣지: static+type+dynamic)
let idx = 0;
const index = new Map(),
  low = new Map(),
  onStack = new Set(),
  stack = [];
const sccs = [];
function strongconnect(v) {
  index.set(v, idx);
  low.set(v, idx);
  idx++;
  stack.push(v);
  onStack.add(v);
  for (const e of adj.get(v) ?? []) {
    const w = e.to;
    if (!index.has(w)) {
      strongconnect(w);
      low.set(v, Math.min(low.get(v), low.get(w)));
    } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
  }
  if (low.get(v) === index.get(v)) {
    const comp = [];
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      comp.push(w);
    } while (w !== v);
    if (comp.length > 1) sccs.push(comp);
  }
}
for (const n of nodes) if (!index.has(n)) strongconnect(n);

// entrypoint reachability — Next.js 파일 규약 + root 진입 파일
const isEntry = (n) =>
  /(^|\/)(page|layout|error|loading|not-found|template|global-error|default|unauthorized|forbidden)\.tsx$/.test(
    n,
  ) ||
  /(^|\/)route\.ts$/.test(n) ||
  n === "proxy.ts" ||
  n === "instrumentation-client.ts" ||
  /(^|\/)(sitemap|robots|manifest)\.tsx?$/.test(n) ||
  /(^|\/)(opengraph-image|twitter-image|icon|apple-icon)\.tsx?$/.test(n);
const entries = nodes.filter(isEntry);
const reachable = new Set();
{
  const q = [...entries];
  while (q.length) {
    const v = q.pop();
    if (reachable.has(v)) continue;
    reachable.add(v);
    for (const e of adj.get(v) ?? []) if (!reachable.has(e.to)) q.push(e.to);
  }
}
const unreachable = nodes.filter((n) => !reachable.has(n));

// zone 분류
function zone(n) {
  if (n === "proxy.ts" || n === "instrumentation-client.ts") return "root";
  if (n.startsWith("app/api/")) return "api";
  if (n.startsWith("app/components/")) return "components";
  if (n.startsWith("app/stores/")) return "stores";
  if (n.startsWith("app/domain/")) return "domain";
  if (n.startsWith("app/lib/")) return "lib";
  if (n.startsWith("app/i18n/")) return "i18n";
  if (n.startsWith("app/strategies/")) return "strategies";
  if (n.startsWith("app/server/repository/")) return "server-repository";
  if (n.startsWith("app/server/services/")) return "server-services";
  if (n.startsWith("app/server/auth/")) return "server-auth";
  if (n.startsWith("app/server/")) return "server-other";
  return "route-shell";
}

// cross-zone 이상 후보 — dependency-cruiser 규칙의 재구현이 아니라 type-only까지 보는 확장 후보 검출
const CLIENT = new Set(["components", "stores"]);
const findings = [];
for (const e of edges) {
  const zf = zone(e.from),
    zt = zone(e.to);
  const tag = (name) => findings.push({ rule: name, ...e, zf, zt });
  if (CLIENT.has(zf) && zt.startsWith("server")) tag("client->server");
  if (zf === "lib" && zt.startsWith("server") && !e.typeOnly) tag("lib->server(value)");
  if (zf.startsWith("server") && (zt === "components" || zt === "stores")) tag("server->ui");
  if ((zf === "api" || zf === "route-shell") && zt === "server-repository")
    tag("route->repository");
  if (zf === "server-services" && zt === "server-repository") tag("services->repository");
  if (zf === "domain" && (zt.startsWith("server") || CLIENT.has(zt) || zt === "api"))
    tag("domain->outward");
  if (zf === "stores" && zt === "components") tag("stores->components");
}

const deg = nodes.map((n) => ({
  n,
  zone: zone(n),
  fanIn: (radj.get(n) ?? []).length,
  fanInValue: (radj.get(n) ?? []).filter((e) => !e.typeOnly).length,
  fanOut: (adj.get(n) ?? []).length,
}));
deg.sort((a, b) => b.fanIn - a.fanIn);

const result = {
  schemaVersion: 1,
  revision: process.env.GIT_REV ?? "unknown",
  counts: {
    files: nodes.length,
    edges: edges.length,
    typeOnlyEdges: edges.filter((e) => e.typeOnly).length,
    dynamicEdges: edges.filter((e) => e.dynamic).length,
    entries: entries.length,
  },
  // unreachable은 "production entrypoint에서 도달 불가"이지 dead code 판정이 아니다.
  // scripts·테스트만 소비하는 파일이 포함되므로 파일별 triage 입력으로만 사용한다.
  unreachableNote: "production entrypoint 기준. scripts/테스트 소비자는 별도 확인 후 분류한다.",
  sccs,
  unreachable: unreachable.filter((n) => !isEntry(n)),
  topFanIn: deg.slice(0, 25),
  crossZoneFindings: findings,
  unresolved,
  nodes: [...nodes].sort(),
  edges,
};
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(
  `files=${nodes.length} edges=${edges.length} (type-only=${result.counts.typeOnlyEdges}, dynamic=${result.counts.dynamicEdges})`,
);
console.log(
  `SCCs(>1): ${sccs.length}  unreachable(non-entry, triage 입력): ${result.unreachable.length}  crossZone: ${findings.length}  unresolved: ${unresolved.length}`,
);
