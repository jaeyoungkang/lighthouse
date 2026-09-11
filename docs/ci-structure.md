---
type: design
---

# CI 검증 구조 — 검증 책임 단위와 배치 기준

이 문서는 검증이 어디서 실행되는지(CI job, 로컬 alias, 수동 실행)와 새 검증을
어디에 붙일지 판단하는 기준의 정본이다. 개별 게이트의 의미는 각 소유 문서가
정본이다 — Sufficiency Review hardening 6게이트는 `docs/verification-gates.md`,
게이트 전체 인덱스는 `docs/contract-maps/quality-gates.md`. `quality:*` alias의
필수 게이트 목록 단일 원본은 `package.json` alias 정의다 (이슈 #193). 이
문서는 그 목록을 다시 열거하지 않는다.

## PR fast-path job 구성

현재 `.github/workflows/quality.yml`은 PR마다 책임별 job을 병렬로 실행한다.
아래 일곱 context는 branch protection required check다 — contexts는 `static`, `test (1)`,
`test (2)`, `build`, `audit`, `review-closeout`, `db-integration`이다.
`db-integration`은 2026-08-15 Human 결정으로 advisory에서 required로
승격됐다([issue #652](https://github.com/jaeyoungkang/lighthouse/issues/652)).
선언된 게이트 지위와 실제 branch protection의 parity는 `guard:gate-parity`가
검사한다. `static`/`test`/`build` fast-path job은 로컬 `quality:fast`에
production build를 더한 구성이다. 이를 위한 별도 합성 alias는 두지 않는다. CI가 책임
단위로 나눠 실행해 wall-clock을 줄이기 때문이다. `db-integration` job은 현재
migration을 적용한 로컬 Supabase PostgreSQL과 PostgREST에서 repository PostgreSQL
integration 계약을 실행한다. Migration revision을 확인한 뒤 `lighthouse.gap_reports`의
PostgREST schema readiness를 bounded read-only probe로 확인하고 gap report 경쟁
시나리오와 reviewed_papers 결정적 정렬·인덱스 시나리오를 시작한다. 서비스 시작이
Docker host-port bind 충돌로만 실패하면 CI 전용 wrapper가 `lighthouse` project stack을
정리하고 한 번만 재시도한다. 다른 기동 오류는 즉시 실패하며, job 종료 시에는
성공·실패와 무관하게 같은 project stack을 정리한다. `audit` job은
의존성 책임을, `review-closeout` job은 PR 전용
closeout 책임을 맡는다(issue #318). `static` job은 아래 문서 전용 분류에 따라 `quality:docs` 또는
`quality:static`을 실행한다.
전체 검증 경로의 `test` job은 `test:unit`을 vitest `--shard`로
2개 runner에 나눠 돌린다. `build` job은 production build를 실행한다. `audit`
job은 `npm run quality:audit` alias를 통해 `npm run deps:audit`를 실행해
lockfile drift, dependency tree, runtime high/critical npm advisories와 knip을
분리해서 본다. dependency-cruiser는 빠른 정적 경계 검사이므로 `static` job이
소유한다. executable Evidence Ledger 전체
실행은 `workflow_dispatch(full=true)`에서 단일 `full` job이
`quality:full`로 돈다. 각 alias의 정확한 게이트 구성은 `package.json`
정의가 단일 원본이다.

`quality:full`은 fast-path 경로에 coverage와 `evidence-ledger` 실제 실행을
더해 수동 전용 `full` job에서 단일 직렬로 돈다. 여기서 coverage는
repository 전역이 아니라 `vitest.config.mts`의 `coverage.include`가 소유하는
위험 기반 대상 cohort와 그 임계다. 수동 실행도 같은 config를 사용하며 범위를
전역으로 넓히지 않는다. cohort의 유지·확장·은퇴는
`quality-gate-steward`의 분기 Standards Candidate Intake에서 심의한다.
Architecture Fitness process test는 각 Pilot이 선언한 과거 target revision에서 산출물을
재생성하므로 `test`와 `full` job의 checkout은 전체 git history를 가져온다.
shallow checkout에서는 현재 head의 테스트 코드가 정상이어도 고정된 evidence
commit을 찾지 못해 테스트가 실패한다.

## 문서·스킬 산문의 검증 범위

2026-09-07 일반 문서와 스킬 산문 변경에 맞는 검증 경로를 추가했다.
[스킬 PR #763의 CI](https://github.com/jaeyoungkang/lighthouse/actions/runs/34078631848)는
정적 검사에 9분 40초, 단위 테스트 두 shard에 각각
6분 17초와 5분 51초가 걸렸다. 문서에서도 필요한 검증은 유지하면서 제품
실행과 관계없는 설치·빌드·전체 테스트 비용을 줄이는 것이 목적이다.

분류 정본은 `scripts/quality/quality-change-scope.mjs`다. 일반 `docs/`와
`shared-skills/`의 Markdown, 루트 README·AGENTS·CLAUDE 문서의 추가·수정만
문서 경로 후보로 인정한다. 계약·runtime-flow·analytics·glossary·Architecture
Fitness 문서와 `docs/mission-control.md`, 운영 경계 register인
`docs/operational-readiness.md`는 실행 입력이므로 전체 경로를 유지한다.
비 Markdown, 실행 모드나 심볼릭 링크, 삭제·이동, 알 수 없는 경로가 섞이면
전체 경로다. 문서 경로에서도 `quality:docs`가 기존 guard·계약 검증과
라우팅·문서 소비 테스트를 실행한다. 명령 목록은 `package.json`이 소유한다.

각 CI job은 동일한 분류기를 실행한다. PR은 event의 base SHA와 checkout한
merge 결과 전체, main push는 event의 before SHA부터 현재 HEAD까지 비교한다.
비교 ref를 읽지 못하거나 변경 집합이 비었거나 수동 실행이면 전체 검증을 한다.
workflow 자체와 분류기 변경도 전체 경로이므로 이 개선을 자기 검증 축소에
사용할 수 없다.

문서 경로의 `static`은 `quality:docs`를 실행한다. `test`·`build`·
`db-integration`·`audit`은 적용 대상이 아님을 출력하고 무거운 단계를 실행하지
않는다. required context 이름은 유지하며, 분류기 실행 실패를 성공으로
처리하지 않는다. `review-closeout`은 PR마다 계속 실행한다. workflow 전체의
`paths-ignore`로 required check를 누락시키지 않는다. `full` 수동 실행은 기존
전체 검증을 유지한다. Vercel 배포 설정은 이 분기의 대상이 아니다.

로컬 pre-push는 `quality:hook`으로 같은 분류기를 호출한다. push는 훅의 stdin에
들어온 모든 ref의 원격 SHA부터 로컬 SHA까지 검사한다. 새 브랜치는
`refs/remotes/origin/main`과 HEAD의 merge base를 기준으로 한다. 여러 ref 중
하나라도 범위 밖이거나 현재 checkout과 다르거나 작업 트리가 더러우면 전체
경로로 돌아간다. 원격 ref나 기본 base가 없을 때도 마지막 커밋만 보고 축소하지
않는다. pre-commit은 기존 `quality:commit`을 그대로 실행해 staged CAIR 검사와
자동 포맷 순서를 보존한다. 직접 실행하는 `quality:fast`도 기존 전체 검증이다.

분류는 실행 비용만 선택한다. 제품 의미·CAIR 판정과 필요한 실행 evidence는
각 소유 workflow가 결정한다. 문서 경로라도 의미가 바뀐 계약의 실제 검증을
대신하지 않는다. 범위 확장은 새 경로의 소비자와 실패 사례를 확인한 뒤
분류 테스트와 함께 반영한다.

## 검증 책임 단위 원칙

CI job은 실행 편의가 아니라 **검증 책임 단위**로 나눈다. 한 job에 모든
검증을 누적하면 PR 화면에는 "quality 실패"만 남고, 실패가 제품 runtime
회귀인지, Story Chain trace 문제인지, 의존성·공급망 운영 문제인지, hardening
신호인지가 흐려진다. 그래서 새 검증을 추가할 때는 먼저 다음을 묻는다.

1. 이 실패는 어느 책임 영역에서 해석해야 하나?
2. 기존 job의 실패 의미와 같은가, 아니면 별도 빨간불이 대응을 빠르게 하나?
3. PR blocking gate인가, manual hardening인가, advisory/report인가?
4. secret, 외부 API, 긴 실행 시간처럼 PR 기본 경로와 분리해야 할 이유가 있는가?

## 현재 책임 분리

| 책임 단위 | CI 위치 | 대표 명령 | 실패 의미 |
|---|---|---|---|
| Story Chain trace / 정적 게이트 | `static` job | `npm run quality:static` | structural comparison ref·extractor 무결성 실패, format·lint·type·dup 회귀, raw external HTTP/DB seam drift, auth resolver side-effect drift, auth hot-path read drift, landing auth source-boundary drift, AI generation gateway drift, operational boundary register drift, Supabase migration transaction-safety drift, 게이트 지위 선언·branch protection 스냅샷 parity drift, 수동 lane 신선도 선언 drift, Story Chain trace, deterministic release gate 문제 |
| 제품 runtime 테스트 | `test` job (shard 1/2, 2/2) | `npm run test:unit -- --shard=N/2` | 사용자-facing 동작·런타임 회귀 |
| production build | `build` job | `npm run build` | build 회귀, unauthenticated `/` initial client bundle marker/size budget drift |
| 의존성 / lockfile / 공급망 / dead dependency | `audit` job | `npm run quality:audit` (`deps:audit`) | package manifest·lockfile·runtime high/critical advisory·dead dependency 문제 |
| PostgreSQL integration 계약 | `db-integration` job | `npm run test:db:gap-report-concurrency` | 실행 DB migration revision 불일치, PostgREST schema readiness timeout 또는 즉시 실패해야 할 인증·계약 오류, gap report version/CAS/lease 경쟁 회귀, reviewed_papers owner 정렬·matching index 회귀, mock과 실제 PostgreSQL/PostgREST 의미의 불일치 |
| mutation hardening | `mutation.yml` manual dispatch | `npm run mutation:*` | 테스트가 invariant를 실제로 보호하지 못하는 문제 |
| Review closeout | `review-closeout` job (PR-only) | `npm run review-closeout:check -- --base origin/main` | PR의 exact content head에 review record가 없거나, 신규 canonical review record의 `author-model` / `review-model` / `verdict-model`이 누락·오표기되거나 non-current `applied:` group·non-current/unknown `hit:` entry를 쓰거나, 신규 valid escape가 active/workflow entry 또는 명시적 HEAD candidate에 결속되지 않음 — 리뷰가 stale·미종결·미귀속·역사 label/entry 재사용·feedback 미결속인 상태 (issues #318, #504). 코드 회귀가 아니라 closeout 상태 문제로 해석한다 |
| Skill routing evaluation | `test` job의 `check-skill-routing-corpus.test.ts`; 분기·source 변경 시 직접 명령도 실행 | `npm run skill:routing-eval`; blind prediction은 `--score` | committed source로 만든 frozen input·evaluation-spec·routing-source digest, 저장된 opaque input/prediction/score와 model/input/prediction seal, first-route·required recall·allowed precision·forbidden/unknown route 기준이 어긋남. 의도된 no-skill helper 경로는 `firstRoute: null`로 표현하며 여기에 skill을 고르면 hard forbidden selection이다. Skill frontmatter나 First-Route Rules 변경은 같은 PR에서 blind 재평가와 artifact 갱신이 필요한 blocking 신호다 |

Issue #453에서 provider-backed Story Chain semantic judge를 은퇴했다. Blanket
override 때문에 유효한 signal을 내지 못했고, 외부 LLM의 비결정성·지연·secret
의존성은 PR fast path에 남아 있었다. 재무장하거나 별도 gate로 옮기지 않는다.
Story Chain graph, revision, review schema, Evidence Ledger, surface, event,
critical-finding 검증은 `quality:static`의 결정적 gate로 계속 차단한다.
`quality-static-offline.test.ts`는 `static` job이 provider secret이나 protected
environment를 다시 요구하지 않도록 잠근다.

## 관련 은퇴 결정 이력

Provider-backed Story Chain judge의 제거 결정은
[Issue #453](https://github.com/jaeyoungkang/lighthouse/issues/453), 내부 Decision Log
표면과 생성 프로세스의 제거 결정은
[Issue #452](https://github.com/jaeyoungkang/lighthouse/issues/452)가 소유한다. 두
결정의 통합 CAIR, 구현과 검증 결과는
[PR #467](https://github.com/jaeyoungkang/lighthouse/pull/467)에 요약돼 있다. 삭제 전
상세 verdict·rejected alternative·cross-impact ledger는
[#503 착수 전 revision](https://github.com/jaeyoungkang/lighthouse/blob/3e16c50638bcf98fa6a7bfbebdbb878487337339/docs/ci-structure.md#contract-architecture-impact-review)의
Git 이력에서 읽는다. 이 문서는 현재 CI 책임 구조만 유지한다.

## 새 검증을 붙이는 기준

기존 fast-path job(`static`/`test`/`build`)에 새 검증을 붙이는 것은 그 실패가
제품 runtime / Story Chain / build 회귀와 같은 의미일 때만 선택한다. dependency, 보안, lockfile,
dead dependency처럼 운영 책임이 다른 검증은 `deps:*` 아래 이름을 먼저 만들고
`audit` job에 연결한다. 비용이 크거나 mutation처럼 hardening 성격이 강한
검증은 PR 기본 경로가 아니라 manual 경로를 우선 검토한다.

`structural-audit:check`는 `quality:static`에서 committed base와 `HEAD`의
normalized production import graph, structural policy, tooling fingerprint를
비교한다. PR은 base branch와의 merge base를 사용하고 main push는 workflow가
전달한 event-before ref를 사용한다. 선언된 ref를 읽지 못하거나 extractor가
실패하면 비교를 생략하지 않고 static job을 실패시킨다. fingerprint와
SCC·unreachable·cross-zone 변화 자체는 advisory다. 차단 가능한 dependency
topology는 계속 `deps:boundaries`가 소유하며, detector는 별도의 architecture
health verdict를 만들지 않는다.

운영 판단 문서의 구조 드리프트를 막는 얇은 정적 검증은 `quality:guards`에 둔다.
기계 판독 가능한 용어 registry의 schema·충돌·authority/i18n 연결과 고정
projection freshness는 `guard:glossary`가 같은 lane에서 검사한다. TypeScript
term-id와 MessageKey는 기존 `typecheck`가 소유한다. 기계적 코드 이름과 codeRef
검증은 core glossary gate에 포함하지 않는다.
예를 들어 `guard:operational-boundaries`는 shared cache, public telemetry ingress,
external provider fan-out, LLM provider cost observability 같은 운영 boundary row가
`docs/operational-readiness.md`에서 사라지거나 상태값이 정해진 vocabulary 밖으로
흐르는 false pass와 public telemetry·Episteme runtime control 우회를 막는다.
`guard:inline-analysis-cache-contract`는 별도 cache owner로서 inline-analysis의
cache-relevant AST 변경이
`INLINE_ANALYSIS_VERSION`과 함께 움직이는지, digest-neutral compatibility invalidation은
새 `INLINE_ANALYSIS_VERSION_REASON`을 남기는지 확인한다. Version 전이는 로컬
worktree에서는 `HEAD`, PR에서는 base merge-base,
push에서는 workflow가 전달한 event-before ref와 비교한다. Event base가 없는 clean local
checkout만 first parent를 fallback으로 사용하며, 선언된 push/PR ref를 읽지 못하면 좁은
비교로 낮추지 않고 실패해 검사가 생략되지 않게 한다. 두 guard 모두 변경의 제품 의미나
cohort go/no-go를 결정하지 않는다. 실제 boundary 상태와 판정 권한은
`docs/operational-readiness.md`, dated 실행·verdict는
`docs/operational-readiness-records.md`가 소유한다.

## 게이트 자기 검증

게이트 시스템이 스스로 주장하는 상태도 검증 대상이다. 선언 정본은 세 파일이다.

- `scripts/quality/gate-status.json` — 각 workflow job의 강제 지위(required /
  advisory / manual)와 required check context 목록을 선언한다. workflow 파일
  단위 지위는 `manualWorkflows`(workflow_dispatch 전용)와
  `automatedWorkflows`(workflow_dispatch와 `main` push만 허용하는 자동 workflow)
  두 카테고리로 나눠 선언한다.
- `scripts/quality/branch-protection.snapshot.json` — `main` branch protection의
  required contexts와 보호 설정 스냅샷이다. 갱신은 운영자가
  `npm run gate:snapshot`으로 실행한다(gh 인증 필요). GitHub 쪽 설정 변경은 이
  스냅샷을 갱신하는 시점에 PR diff로 드러난다.
- `scripts/quality/lane-freshness.json` — 수동 authoritative lane의 마지막 실행
  target SHA와 신선도 budget(커밋 수), 초과 시 대응 소유자를 선언한다.

`guard:gate-parity`는 선언 ↔ workflow 트리거 ↔ 스냅샷의 parity와 모든 workflow의
`schedule` 트리거 부재 invariant(2026-08-07 결정, 아래 Contract Architecture
Impact Review)를 blocking으로 검사한다. `guard:lane-freshness`는 선언 무결성과
budget 초과를 모두 blocking으로 검사한다(2026-08-15 Human 결정으로 warn에서
block으로 승격, budget 100커밋). budget을 초과하면 운영자가 attestation을
수동 실행하고 `lastTargetSha`를 갱신해야 merge가 재개된다. 두 guard 모두
`quality:guards`에 속한다.
`mc:cair-inventory`는 전체 문서의 CAIR 레코드 현행 문법 준수를 advisory로
집계해 diff-scoped 검증이 남기는 잠복 비준수를 가시화한다. `static` job이 전체 검증 경로의
PR·push에서 이 집계 결과를 비차단 notice annotation으로 출력하므로, 잠복
비준수 카운트는 수동 실행 없이도 보인다.

2026-08-15의 첫 triage는 형식이 어긋난 현재형 레코드 둘을 교정하고, 서술형
history 여섯 건은 보존 대상으로 분류했다. 같은 issue의
[후속 Human 결정](https://github.com/jaeyoungkang/lighthouse/issues/652#issuecomment-5300646646)은
기존 결정과 날짜별 상세를 지우거나 사후 계획으로 다시 쓰지 않는 조건으로 이 여섯
건에도 현행 필드 블록을 추가하도록 승인했다. 현재 inventory는 17개 레코드가 모두
현행 문법을 따르고 nonconforming·legacy가 0이다. 이 집계는 문법 준수 현황이며
CAIR verdict의 적합성이나 release 판정을 대신하지 않는다.

CAIR의 결정적 강제 범위도 여기서 선언한다. `mc:validate-cair`가 CAIR 존재를
강제하는 대상은 `docs/contracts/story-chain/promises/`,
`docs/contracts/story-chain/aspects/`, `docs/contracts/story-chain/experiences/`,
`docs/contracts/story-chain/moments/`의 변경된 파일이다. 코드 전용 아키텍처
변경은 여전히 결정적 강제 밖이며, agent 규율(AGENTS.md의 CAIR 트리거)과
advisory 층(`mc:cair-inventory`, `architecture-fitness:impact`)이 담당한다. 이
경계를 좁히거나 넓히는 것은 게이트 의미 변경이므로 Human 결정을 거친다. 배경과
결정 기록은 [issue #652](https://github.com/jaeyoungkang/lighthouse/issues/652)가
소유한다.

## Boundary mechanism과 guard 상한

Import topology는 dependency-cruiser의 선언 규칙이 우선 소유한다. 이 그래프는
TypeScript pre-compilation edge를 수집하므로 `import type`도 규칙별 허용 여부에 따라
차단한다. Type-only 허용 규칙은 `dependencyTypesNot: ["type-only"]`를 직접
선언한다. Public auth message registry 경계도 이 규칙이 검사한다. 현재 그래프가
외부 dynamic import를 포함하지 않으므로 `@amplitude/unified` lazy-load owner 검사만
작은 custom fallback으로 남긴다.

Symbol provenance, capability 호출 횟수, 실행 순서, 문서와 runtime의 동시 변경처럼
dependency graph만으로 판정할 수 없는 의미는 custom AST guard가 맡는다.
`least-authority`, `operational-boundaries`, `inline-analysis-cache-contract`,
`state-boundaries`가 여기에 해당한다.
Route나 surface가 늘어나도 같은 정책 family라면 새 `guard:*`를 만들지 않고 기존
runner의 parameter로 추가한다. Search와 relationship state 검사는 이 규칙에 따라
`guard:state-boundaries` 하나와 공유 production analysis로 합쳤다.

Guard가 정상 seam·capability owner와 별도로 정책 예외를 허용할 때는 예외 선언을
그 guard의 실행 코드 안에 둔다. 각 선언은 안정적인 id와 이유(`reason`), 책임
owner, 재검토 조건(`reviewWhen`)을 가져야 하며
`scripts/quality/guard-exception-policy.mjs`가 누락·빈 값·중복 id를 실행 전에
거부한다. `owner`는 제외 대상 경로가 아니라 폐지를 심의할 workflow·policy
authority를 가리키며 match 값을 그대로 반복할 수 없다. 선언이 실제 검사에서 한 번도
사용되지 않으면 review 조건이 이미 충족된 stale 예외로 보고 guard가 실패한다. 검사
root, build directory 제외, canonical seam·effect owner, restricted
capability caller 표는 예외가 아니라 guard 자체의 범위·권한 모델이므로 이 형식을
억지로 적용하지 않는다. Exact-revision collector가 현재 guard를 과거 tree에 적용할
때는 선언의 모든 match 경로가 그 tree에 없으면 부적용으로 남긴다. 경로가 존재하는데
match가 0인 경우만 stale이며, 현재 HEAD를 검사하는 blocking guard는 부적용 완화를
사용하지 않는다.

새 `guard:*` command가 꼭 필요하면 dependency-cruiser와 기존 family runner로
표현할 수 없는 false pass를 Gate Stack에 기록한다. 이름만 다른 wrapper나
surface별 복제 command는 새 command를 만들 근거가 아니다.

## 로컬 게이트

Issue #450에서 실행 맥락이 겹치던 quality pipeline을 네 profile로 줄였고,
일반 문서·스킬 산문에 한정한 `quality:docs`를 추가했다.
profile 목록과 각 profile을 별도로 유지하는 이유는
`docs/contract-maps/quality-gates.md`의 `Quality Profiles`가 한 번만 설명한다.
정확한 명령 구성은 계속 `package.json`만 소유한다.

contract-affecting Story Chain 작업(docs-only 편집 포함)의 로컬 closeout 정본
alias는 `npm run quality:contract`다. 필수 게이트 목록의 단일 원본은
`package.json`의 alias 정의뿐이며, 이 문서를 포함해 어떤 문서도 그 목록을
다시 열거하지 않는다 — 문서가 게이트 목록을 손으로 복제하다가 docs-only 최소
경로에서 `mc:check-critical-findings`를 빠뜨린 드리프트가 이슈 #193의
프로세스 갭이다.

PR-only `review-closeout:check`는 변경 범위에 따라 검증을 선택하는 pre-push
hook에 없다. push는 반복 작업 경로라서 merge-time 게이트로 막지
않는다. merge 전에 로컬에서 같은 판정을 미리 보려면 `npm run quality:pr`를
실행한다. 이 alias는 exact content head의 review record 존재를 CI와 같은
규칙으로 확인한다.

로컬 commit-time gate인 `npm run quality:commit`은 staged Story Chain /
surface checks를 우선한다. CAIR 검사는 `mc:validate-cair -- --staged`로 Git
index의 실제 bytes를 `HEAD`와 비교해 새·변경 Story Chain contract 파일의 durable
record 연결과 변경된 CAIR 형식을 확인한다. 이전 branch commit까지 포함한
범위는 `quality:contract`의 기본 모드가 닫는다. 기본 `mc:validate-cair`는 PR
comparison base, staged·unstaged·untracked 변경을 합쳐 검사하므로
`quality:contract`에서도 같은 forward-only 경계를 유지한다. 과거 레코드를
별도 allowlist에 옮기지 않고, 레코드가 다시 바뀌는 시점에 현재 형식으로
회수한다.

기존 Story Chain contract 파일을 고치는 모든 diff도 embedded CAIR record나 정확한
durable pointer를 가져야 한다. 비의미 편집이라면 최소 기록은 현재 경계가
충분하다는 근거를 적은 `none`이다. 로컬 기본 비교 기준은 `origin/main`의
merge base이고, 사용할 수 없거나 현재 `HEAD`와 같으면 `HEAD^`, 그마저
없으면 현재 staged·unstaged·untracked 변경만 검사한다. GitHub PR에서는
`origin/$GITHUB_BASE_REF`가 필수다. 해당 ref가 없거나 HEAD와 merge base가
없으면 축소된 범위로 통과하지 않고 checkout/fetch 오류로 실패한다. push
CI는 workflow가 `github.event.before`를 `CAIR_COMPARISON_BASE`로 넘겨
다중 commit 전체를 비교한다. 그 밖의 CI는 `origin/main`이 필수이고, 현재
`HEAD`와 같으면 `HEAD^`를 사용한다. 필요한 base가 없으면 빈 범위나 마지막
commit만 검사해 통과하지 않고 실패한다. 비의미 편집처럼 실제 architecture
axis가 없다면 `Affected axes: none (non-semantic edit)`를 사용한다.

변경되지 않은 CAIR 레코드나 Story Chain contract pointer라도 같은 diff에서
가리키는 record, 구조적 방어, Propagation Map, Concept Shift record가
삭제·rename되거나 `npm run` script·Aspect id가 제거되면 해당 참조를 다시
검증한다. 상대 참조를 가진 record 파일의 rename도 새 owner 경로에서
재검증한다. Story Chain contract 파일 삭제는 같은 변경 안에 durable CAIR record가
있어야 한다. forward-only 문법 회수와 별개로, 이미 사라진 참조를 계속
유효하다고 통과시키지 않는다.

event contract는 `npm run mc:validate-events` 전체를 실행한다. 이 게이트는
production runtime의 canonical event literal과 server mapping을 앱 전체에서
스캔하므로, staged 파일만 보면 계약 밖 방출을 놓칠 수 있다.

로컬 pre-push의 전체 경로인 `quality:fast`는 `quality:static`을 통해
`structural-audit:check`를 실행한다. 이 로컬 실행은 빠른 피드백이다. hook을 우회할
수 있으므로 PR·main push의 CI static job이 같은 비교를 다시 실행한다. 구조 변화가
확인돼도 branch artifact를 보존하지 않는다. merge 뒤 exact `main` snapshot과 분기
backstop은 `structural-audit` skill과 `docs/project-status.md`가 소유한다.

계약이나 사용자-facing surface에 영향이 있는 작업을 agent가 로컬에서 닫을 때는
CI의 dry-run 목록과 별개로, 영향받은 ledger의 실제 executable evidence도
실행한다. 예: `npm run evidence-ledger -- --ledger <ledger>`. 이 항목은
현재 PR CI blocking job에 자동 포함된다는 뜻이 아니라, contract-affecting
closeout의 로컬 완료 조건이다.

Architecture Fitness는 현재 non-blocking advisory lane에만 있다.
`npm run architecture-fitness:advisory`는 pinned v0.9.1의 Issue #278 least-authority, Issue #276
keyword-search·relationship state-boundary, Issue #280 process topology와 Issue #281
first-ready critical-path, Issue #286 Q3 workload-envelope, Issue #297 Q4 technical-grain,
Issue #298 Q5 cache-lifecycle, Issue #399 serialized-input-budget policy를 exact-revision raw observation으로 다시 수집해 drift를
확인하고 unsigned evaluation까지 실행한다. 이 명령의 종료 코드 `0`은 checked-in
unsigned advisory가 재현됐다는 assertion이다. `architecture-fitness:verdict`는 같은 수집과
assertion을 실행한 뒤 core verdict 종료 코드 `0/1/2/3`을 전달한다.
`architecture-fitness:validate`도 같은 고정
observation 집합을 다시 수집하는 validation-only 경로이므로 더 싼 기본 closeout이 아니며,
같은 closeout에서 이 명령들을 연속 실행하지 않는다. 하나의 full recollection은
policy·collector·adapter·profile·checked observation·core·trust·evaluation 의미가 바뀌거나
deterministic recollection을 진단할 때만 한 실행 owner가 맡는다. 일반 제품 변경은
`quality:guards`에 포함된 least-authority·state-boundary guard와 영향받은 negative test로
PR을 차단한다. Heavy attestation은 운영자가 승인한 protected-main batch rebind에서만 실행한다.
기록 전용 변경은 full local recollection을 실행하지 않는다. `quality:fast`와 정당화된 advisory가
모두 필요하면 한 실행 owner가 두 heavy 명령을 직렬로 실행한다. 일회성 조합을
위한 별도 quality profile은 두지 않는다.
로컬 key나 GitHub처럼 보이는 환경 변수는 authority가 아니므로
로컬 verdict는 `unknown`, merge advisory는 `block`이다. 별도
`architecture-fitness-attestation.yml`은 운영자가 여는 protected `main` exact rebind에서만
secret 없는 exact-revision collection과
`architecture-fitness-attestor` Environment의 protected attest/evaluate/verify job을 분리한다.
workflow SHA는 exact target SHA와 같아야 하고 PR 번호는 `0`이어야 한다. Q4 source-only raw artifact와 Q5 base·target raw
artifact를 각각 독립 runner/lane에서 봉인한다. Q5 target probe는 별도 no-secret job에서 allowlist
환경만 받고 persistent npm cache를 저장하지 않는다. Protected job은 target code를 실행하지 않고, 봉인된 base·target observation
두 개만 새 Q5 input artifact로 결합한 뒤 그 ID와 digest를 Q5 provenance에 바인딩한다. Signed
observation, assessment, comparison, invocation과 artifact digest는 profile별 bundle을 포함한
immutable run artifact로 보존한다. 이 workflow는 scoped authoritative advisory이며 branch
protection의 required check가 아니다. Mandatory 승격은 별도 Human decision이다.
Q2는 exact target collector가 base와 target에서 TypeScript lexical symbol로 `search-service`
named import에 직접 결속된 keyword-search 호출과 await 결과 shape를 확인한다. Local shadow는
거부하고, 찾은 revision별 export를 신뢰된 harness에 전달한다. 과거 collector identity나 특정
provider export 이름은 bootstrap 선행조건이 아니다. 역할이 없거나 둘 이상이면 수집을 실패시킨다.
Q1 least-authority/state-boundary, Q2 macro behavior, Issue #399 serialized-input-budget
collection은 no-secret collector lane에서 exact target tree를 검사한다. collector·test
harness·명시적 Vitest config·setup·설치 dependency는 collector-authority checkout이 소유한다.
Target root Vitest config와 `package-lock.json`은 관측 대상
source identity이지 실행 dependency authority가 아니다. 따라서 base와 달라도 수집을
거부하지 않는다. 각 병렬 profile runner는 complete·exit-zero·reproducible publication과
canonical schema를 자기 artifact 봉인 전에 검증한다. Partial 또는 failed profile은 짧은
diagnostic을 남기고 matrix를 실패시킨다. 이미 시작했거나 대기 중인 sibling profile은 끝까지
실행해 각 profile의 진단 artifact를 보존한다. Aggregate `collect`는 전체 matrix 성공을
요구하므로 partial evidence를 결합하거나 서명하지 않는다. Q4는 더 좁게 target module을
실행하지 않는 source-only 경계를 유지한다.

Protected collector·policy·adapter·attestation workflow 변경도 별도 bootstrap PR을 요구하지
않는다. 변경은 blocking static guard와 exact-head review를 통과해 보호된 main에 먼저 반영한다.
운영자가 `workflow_dispatch`를 실행하면 `resolve` job이 protected `main`의 workflow SHA와 exact
target SHA가 같은지 확인하고 first parent를 comparison baseline으로 고정한다. 이미 보호된
target workflow·collector가 authority이며, 이전 main collector identity와의 일치는 선행조건이
아니다. 일반 main push와 제품 PR에서는 heavy collection을 자동 실행하지 않고, 새 main head에는
이전 signed verdict를 이월하지 않는다.
별도 `architecture-fitness-rebind-window.yml`은 운영자가 수동으로 실행할 때 retention 안의 signed artifact를
paginate하고 successful protected workflow의 최신 verified target과 현재 main을 비교한다.
`workflow_dispatch` artifact만 허용하며 main branch/run SHA와 target SHA가 같고 PR 번호가
`0`인지 검증한다. Current-head bundle을
최우선으로 고르고, 없을 때만 최신 stale bundle을 보고한다. Exact target이 다르거나
bundle이 없으면 rolling batch issue를 갱신하되, 현재 main을 평가한 것처럼 verdict를 붙이지
않는다. Squash merge 때문에 stale은 정상 batch-window 상태일 수 있다. 이 notifier는 policy
compatibility나 checked fixture freshness를 추정하지 않으며, rebind를 개별 제품 PR의 blocking
동반 작업으로 만들지 않는다.

`project-status-checkpoint.yml`은 `main` push 후 자동 실행되고 수동
`workflow_dispatch`도 지원하는 `automatedWorkflows` workflow다(`push`는
`branches: [main]`으로만 제한). 활성 GitHub status tracker의 label·assignee·milestone과
marker 구조를 확인하고, 기본 branch SHA·연결 issue 상태·분류 수치로 기계적
checkpoint block을 갱신한다. `project-status -- check`는 tracker period 밖이면
exit 2를 내고, push 실행은 그 경우에만 skip한다. 설정 오류 같은 다른 check 실패는
push와 수동 dispatch 모두에서 job 실패로 표면화한다.
이 workflow는 의미 행이나 Story Chain·Architecture Fitness·Operational Readiness
verdict를 계산하지 않는다. PR·push required check가 아니며 release eligibility에도
참여하지 않는다. 실행 절차와 tracker rollover는 `docs/project-status.md`가 소유한다.

`search-quality-evidence.yml`은 protected `main` exact target의 synthetic actual-path
report만 수동 수집한다. Secretless 단일 job은 exact loopback base URL의 request path·redirect 뒤
final URL provenance를 확인하고 aggregate-only candidate와 target self-check 두 파일만 14일
보존한다. Raw query·paper identity는 runner-local이고 artifact로 올리지 않는다. 이 로컬
self-check에는 attestation·execution·currentness·release authority가 모두 없으며 결과는
`not-applicable`이다. PR·push·freshness lane이나 release verdict에도 참여하지 않는다. 외부
attestor repository·protected Environment·HMAC key는 구성하지 않는다.

`architecture-fitness:impact`는 sensitive path 변경에 declaration이 없을 때 advisory
finding을 만든다. 이 review와 profile별 collector guard는 `quality:*` 또는 GitHub Actions
blocking job이 아니다. 외부 portable skill archive의 digest·unpacked tree·per-file
provenance와 설치 시 재생성된 runtime-copy drift만 process toolchain 무결성으로
`guard:skills`가 blocking 검사한다. Fresh checkout의 `npm ci`는 `postinstall`에서 두
runtime skill root를 만든 뒤 이 blocking guard로 넘어간다.

## Contract Architecture Impact Review

Contract delta: GitHub Actions의 Quality full, Mutation, Architecture Fitness rebind notifier에서 모든 예약 실행을 제거하고 PR·push·수동 실행 경로만 유지한다.
Verdict: constrain-existing
Affected axes and current owners: Resource and capacity; Observability and audit — `.github/workflows/quality.yml`, `.github/workflows/mutation.yml`, `.github/workflows/architecture-fitness-rebind-window.yml`, `docs/ci-structure.md`
Decision: 세 workflow의 `schedule` 트리거를 제거한다. Quality의 PR·main push와 수동 full dispatch, Mutation과 rebind notifier의 수동 dispatch는 유지한다.
Rejected alternative: cron을 남긴 채 job 조건으로 실행을 막으면 예약 run 자체는 계속 생성되고 trigger surface도 실제 운영 결정과 어긋난다. Workflow 전체를 끄면 유지해야 할 PR·push·수동 경로까지 사라진다.
Evidence and structural defense: `scripts/quality/__tests__/quality-profile-consolidation.test.ts`; `scripts/mission-control/lib/__tests__/respond-contract-mutation-pilot.test.ts`; `npm run quality:contract`
Human decision required: no

## Propagation Map

Invariant: GitHub Actions에는 `schedule` 트리거가 없고, 장시간 Quality full·Mutation·Architecture Fitness rebind는 운영자가 수동으로 시작한다. Quality의 PR·main push 검증은 유지한다.
Owning contract bundle: `promise:hardening-tier-policy` + `hardening-tier-policy.ledger.yaml`; `promise:respond-contract-mutation-pilot` + `respond-contract-mutation-pilot.ledger.yaml`
Runtime/engineering owner: `.github/workflows/quality.yml`; `.github/workflows/mutation.yml`; `.github/workflows/architecture-fitness-rebind-window.yml`; `docs/ci-structure.md`
Required code/test paths: `scripts/quality/__tests__/quality-profile-consolidation.test.ts`; `scripts/mission-control/lib/__tests__/hardening-tier-policy.test.ts`; `scripts/mission-control/lib/__tests__/respond-contract-mutation-pilot.test.ts`; `scripts/evidence-ledger/migration-delta-registry.ts`; `scripts/evidence-ledger/converter.ts`; `scripts/evidence-ledger/__tests__/converter.test.ts`
Inspected, not edited: `.github/workflows/architecture-fitness-attestation.yml`; Quality PR·push job wiring; dated Sufficiency Reviews and `docs/archive/**`
Compatibility-only shapes: 기존 GitHub Actions run 이력과 dated review의 과거 nightly 관측은 `preserve`한다.
Split cleanup: 없음
Budget: 16..22 authored files; 180..360 authored changed lines
