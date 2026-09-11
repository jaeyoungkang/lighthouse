// guard:repository-seam — Supabase 테이블 접근은 app/server/repository/ seam 안에서만 한다.
//
// Why this gate exists (#183 K6): #183의 hot-path 비용·풀 점유·소유권 누수는 모두
// DB 접근 seam에서 났다. 좋은 신호는 진짜 테이블 호출이 전부 한 곳
// (`app/server/repository/`)에 모여 있다는 것 — deadline 예산, owner_principal_id
// 소유권 필터, role statement_timeout 같은 wrapper를 박을 단일 깨끗한 seam이다.
// 이 guard는 그 seam을 회귀로부터 지킨다: repository 밖에서 새 Supabase 테이블 접근이
// 생기면 그 호출은 wrapper 없이 raw로 풀과 소유권을 건드릴 수 있으므로 차단한다.
// 학습 루프 규칙(모든 incident는 같은 close-out에 구조적 방어를 남긴다)에 따라 #183
// close-out의 구조적 방어로 둔다.
//
// 매칭 대상: Supabase query builder capability `from`과 `rpc`의 직접 호출, 정적으로
// 계산 가능한 element access, 추출한 method alias 호출이다. 테이블 인자와 method 접근을
// 문자열 리터럴 하나에만 묶으면 변수·element access로 seam을 우회할 수 있으므로 공통
// AST policy가 두 guard에 같은 판정을 제공한다. JS 빌트인 Array/TypedArray.from은
// 명시적으로 제외한다.
// app/ 과 packages/ 를 함께 스캔해, 서버 분리로 repository가 packages로 옮겨가도
// raw 테이블 접근이 새는 것을 잡는다. 결정적이고 git diff에 의존하지 않아 routine
// commit이 false-fail하지 않는다.
// 추가로 repository 밖 production code가 legacy documents repository의 id-only
// write/delete helper를 다시 도입하는 것도 막는다. 현재 남은 persisted artifact는
// gap_reports이며, write/delete는 owner_principal_id 필터가 같은 query builder에 붙어야 한다.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { findRepositoryTableCapabilityUses } from "./repository-seam-policy.mjs";

const ROOT = process.cwd();
const SCAN_DIRS = [path.join(ROOT, "app"), path.join(ROOT, "packages")];
// 현재 유일한 허용 seam. repository가 packages로 이동하면 그 경로를 여기에 추가한다.
const ALLOWED_DIRS = [path.join(ROOT, "app", "server", "repository")];
const ID_ONLY_DOCUMENT_WRITE_RE = /\b(?:updateDocumentUnchecked|deleteDocumentUnchecked)\b/;

const sourceFiles = [];
for (const dir of SCAN_DIRS) {
  await collectSourceFiles(dir);
}
sourceFiles.sort();

const violations = [];

for (const file of sourceFiles) {
  const contents = await readFile(file, "utf8");
  const rel = path.relative(ROOT, file);
  for (const access of findRepositoryTableCapabilityUses(contents, rel)) {
    violations.push({
      file: rel,
      line: access.line,
      text: access.text,
      reason: `raw-table-${access.kind}`,
    });
  }
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index++) {
    if (ID_ONLY_DOCUMENT_WRITE_RE.test(lines[index])) {
      violations.push({
        file: rel,
        line: index + 1,
        text: lines[index].trim(),
        reason: "id-only-document-write",
      });
    }
  }
}

if (violations.length > 0) {
  console.error(
    "[guard:repository-seam] repository seam 밖에서 Supabase 테이블 접근을 발견했습니다:",
  );
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} [${violation.reason}] ${violation.text}`);
  }
  console.error(
    "  테이블 접근(.from/.rpc)은 app/server/repository/ 안으로 옮기고, persisted artifact write/delete는 owner 필터가 붙은 repository helper를 사용하세요.",
  );
  process.exit(1);
}

console.log(
  `[guard:repository-seam] OK (app/·packages/ ${sourceFiles.length}개 스캔, repository seam 밖 .from/.rpc 테이블 접근 0건, id-only document write/delete 0건).`,
);

function isAllowedDir(targetPath) {
  return ALLOWED_DIRS.some((allowed) => targetPath === allowed);
}

async function collectSourceFiles(targetPath) {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return;
  }

  if (targetStat.isDirectory()) {
    if (isAllowedDir(targetPath)) return; // repository seam은 검사 대상에서 제외
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
