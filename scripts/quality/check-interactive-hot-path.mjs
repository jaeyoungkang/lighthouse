// guard:interactive-hot-path — 상호작용 핫패스는 외부 HTTP·히스토리 비례 조회를 하지 않는다.
//
// Why this gate exists: 연구 용어 클릭 지연(2026-07-03 조사)은 한 번에 만들어지지
// 않았다. reserve 경로의 라이브러리 조회는 처음(#169)에는 동기 정적 lookup이라
// 쌌는데, #175가 callee(getLibraryContextForUser)를 live Moonlight HTTP로 바꾸고
// #179가 reviewed-papers 조회를 더하면서 — reserve 코드 자체는 diff에 나타나지
// 않은 채 — 클릭 핫패스에 외부 왕복이 유입됐다. dedup도 소유자의 전체 검색
// 히스토리를 select * 로 읽는 스캔이라 사용량에 비례해 조용히 느려졌다.
// guard:route-deadline은 최악(120s)만 캡하고 guard:external-http-gateway는 fetch의
// "위치"(seam 안인가)만 보므로, "어떤 경로가 그것을 부르는가"는 어느 게이트도
// 지키지 않았다. 이 guard가 그 자리를 지킨다: 검색 entry reserve 핫패스 파일이
// live 라이브러리 resolver 식별자나 히스토리 비례 목록 조회 식별자를 다시
// 참조하면 fail한다 (aspect:immediate-navigation의 hot-path advice).
//
// 매칭은 파일별 금지 식별자 regex다(guard:auth-hot-path와 같은 계열). import
// 그래프 전체를 걷지 않으므로 간접 우회를 다 잡지는 못하지만, 이 회귀가 실제로
// 유입된 두 지점(직접 import·직접 호출)을 결정적으로 잠근다. 정당한 예외가
// 생기면 이 파일의 규칙을 의식적으로 고쳐야 한다.
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

// live/aggregate 라이브러리 컨텍스트 resolver — 외부 Moonlight HTTP까지 갈 수 있다.
const LIVE_LIBRARY_RESOLVER_RE =
  /\b(?:getLibraryContextForUser|resolveLibraryContextForUser|getLiveMoonlightLibraryContext|fetchMoonlightScholarLibraryPapers)\b/;
// 소유자 히스토리 크기에 비례하는 전체 목록 조회 — 핫패스에서는 seed-identity
// 필터 조회(listGapReportsBySourceUnchecked)만 허용한다.
const HISTORY_SCAN_RE =
  /\b(?:listDocumentsByTypeUnchecked|listDocumentsUnchecked|listRecentDocumentsUnchecked)\b/;

const RULES = [
  {
    file: "app/(research)/search-route-page.tsx",
    forbidden: [
      { re: LIVE_LIBRARY_RESOLVER_RE, reason: "검색 실행 핫패스가 live 라이브러리 resolver 참조" },
      { re: HISTORY_SCAN_RE, reason: "검색 실행 핫패스가 히스토리 비례 목록 조회 참조" },
    ],
  },
  {
    file: "app/(research)/research-route-pages.tsx",
    forbidden: [
      {
        re: LIVE_LIBRARY_RESOLVER_RE,
        reason: "검색 entry route가 live 라이브러리 resolver 참조",
      },
    ],
  },
  {
    file: "app/server/domain-access/gap-network-view-access.ts",
    forbidden: [
      {
        re: /\blistDocumentsByTypeUnchecked\b/,
        reason:
          "search follow-up dedup은 source-snapshot identity 조회(listGapReportsBySourceUnchecked)를 쓴다 — 전체 목록 스캔 금지",
      },
    ],
  },
];

const violations = [];

for (const rule of RULES) {
  const absolute = path.join(ROOT, rule.file);
  let source;
  try {
    source = await readFile(absolute, "utf8");
  } catch {
    violations.push({ file: rule.file, line: 0, reason: "guard 대상 파일이 없음 (경로 이동?)" });
    continue;
  }
  const lines = source.split("\n");
  for (const { re, reason } of rule.forbidden) {
    lines.forEach((text, index) => {
      if (re.test(text)) {
        violations.push({ file: rule.file, line: index + 1, reason, text: text.trim() });
      }
    });
  }
}

if (violations.length > 0) {
  console.error("[guard:interactive-hot-path] 상호작용 핫패스 침범을 발견했습니다:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.reason}`);
    if (violation.text) console.error(`  ${violation.text}`);
  }
  console.error(
    "  클릭→전환 핫패스(검색 entry reserve)는 외부 HTTP resolver와 히스토리 비례 조회를 참조하지 않는다. 필요하면 background(run/hydration) 경로로 옮기거나 이 guard의 규칙을 의식적으로 개정하라.",
  );
  process.exit(1);
}

console.log(
  `[guard:interactive-hot-path] OK (${String(RULES.length)}개 핫패스 파일, 금지 식별자 참조 0건).`,
);
