# Research Route Lifecycle

`/search`, `/citation`, `/similar` 조건 route의 URL, navigation, 인증 bootstrap,
ephemeral view 수명을 설명한다. Provider retrieval과 ranking은
[`search-retrieval-ranking.md`](search-retrieval-ranking.md), 관계별 실행은
[`relationship-exploration.md`](relationship-exploration.md)가 소유한다.

## Scope

- primary entrypoints: `app/(research)/search-route-page.tsx`,
  `app/(research)/relationship-route-page.tsx`, `app/(research)/research-route-shell.tsx`
- state owner: 현재 브라우저 route와 mount별 active execution
- lifetime: route와 함께 끝나는 ephemeral `ResearchRoutePayload`
- fallback owner: destination route의 pending/failed/degraded state

## Condition URL Boundary

`/search`, `/citation`, `/similar`은 path와 query를 합친 request target을 UTF-8 기준
최대 8,192 bytes까지 지원한다. 공통 owner는
`app/lib/search-condition-url-budget.ts`다. Builder와 parser는 normalization 전에 raw
dimension을 검사하고, production `URLSearchParams` 직렬화 뒤 path+query bytes를 다시
검사한다. 모든 검사를 통과한 뒤에만 canonical execution key와 ephemeral view id를
만든다.

| mode | raw UTF-8 dimension |
| --- | --- |
| keyword `/search` | `q` 1,024 bytes. `field`·`author`·`venue`는 종류별 최대 4개, 값마다 128 bytes. `year`는 9 ASCII bytes. |
| term `/search` | `q` 192 bytes, `termSourceQuery` 1,024 bytes, `term` 192 bytes, `termSupport` 0~40. |
| seed fallback `/search` | `q` 192 bytes와 아래 slim seed dimension. |
| `/citation`, `/similar` | slim seed dimension. 두 route는 같은 숫자를 쓰지만 독립 execution boundary를 유지한다. |
| slim seed | id 128 bytes, title 768 bytes, URL 1,024 bytes, year 0~9,999, citation count 0~`Number.MAX_SAFE_INTEGER`. |

Overflow는 `reject`한다. Builder 거부는 현재 route를 유지하며 조건 오류를 보여 주고,
직접 연 overflow URL은 provider 호출과 identity 생성을 시작하지 않는다. Truncate나
omit은 연구 조건을 바꾸므로 사용하지 않는다.

검색의 `/`·`/search` alias가 받는 출판연도 조건은 빈 값과 `YYYY`, `YYYY-YYYY`,
`YYYY-`, `-YYYY`만 받는다. 공용 condition-route alias resolver가 두 검색 alias와
`/citation`·`/similar`의 shell 거부 경계를 한 곳에서 소유한다.
비어 있지 않은 malformed `year`는 같은 주소에서 조건 오류로 끝나며 인증, canonical
identity 생성, provider 호출을 시작하지 않는다. 역순 범위와 동일한 양쪽 경계는 입력
주소를 바꾸지 않고 낮은 연도부터 정렬한 canonical execution identity로 실행한다.

## Search Route Entry

검색 입력은 fetch나 client task를 먼저 만들지 않고 즉시 `/search?q=...`로 이동한다.
빈 `/search`는 중앙 primary input 하나를, query가 있는 research route는 상단
`ResearchRouteSearchBar` 하나를 commit owner로 사용한다. `SearchRoutePage`는 조건을
검증한 뒤 pending ephemeral view를 Suspense fallback으로 렌더하고, current user를
해석해 `executeSearchFromUrl` 결과로 교체한다.

Pending view의 빈 `papers`와 `total:0`은 완료된 빈 결과가 아니다. Renderer는 processing
상태를 유지한다. 검색 실패도 같은 조건 URL의 failed view로 남고 새로고침·재시도는
같은 조건을 다시 실행한다.

검색 결과 route는 durable row를 만들지 않는다. `research-route-store`의
`currentView`는 현재 route 하나만 담고 unmount에서 비워진다. Renderer와 AI comment
anchor는 route가 직접 주입한 view만 읽으므로 전환 직후 남은 이전 store snapshot이 새
화면에 노출되지 않는다.

## Navigation Ownership

검색 submit, 연구 용어, 저자·주제, 다른 입장, 교정 검색어는 `/search?q=`로 이동한다.
인용 계보와 비슷한 논문은 `/citation?seedPaperId=...`,
`/similar?seedPaperId=...`로 이동한다. Plain navigation은 browser history를 만들고
뒤로가기가 이전 조건 URL을 복원한다. Store state change는 URL을 push/replace하지
않는다.

Next App Router가 destination을 기다리는 동안 `SearchFollowupActivationProvider`는
선택 query와 destination identity의 짧은 click receipt만 소유한다. Destination 도착,
동기 navigation 실패, bounded cleanup, shell unmount가 같은 identity를 정리한다. 이
상태는 provider 진행·성공·실패를 추론하지 않는다.

Ctrl/Cmd/가운데 클릭은 같은 조건 URL을 새 탭에 열고 현재 route, activation state,
`currentView`, visible-window state를 바꾸지 않는다. Gap report 생성은 별도 detached
창과 `/gap/:id`를 사용하며 상세 순서는 `gap-network-analysis.md`가 소유한다.

## Authentication Bootstrap

Research layout은 current-user 왕복을 first paint 앞에 두지 않고 shell과 children을 먼저
렌더한다. Mount 이후 `ResearchRouteShell`이 `GET /api/library-context/bootstrap`을 호출해
account와 library projection을 seed한다.

- `200`: current principal email과 library availability/display list를 seed한다.
- `401` 또는 `moonlight_scholar_session_invalid`: stale route/background subtree와 active
  view를 내리고 공용 `MoonlightAuthBootstrap`을 연다.
- 그 밖의 network·timeout·5xx·shape 실패: route content를 유지하고 account/library
  projection만 unavailable로 낮춘다.

Session 교환이 성공하면 auth-required state를 먼저 해제하지 않고 같은 URL을 새 문서
navigation으로 다시 연다. Token 발급 403은 allowlist 안내를 유지하고, 그 밖의 교환
실패는 bounded stale-session cleanup 뒤 `EmailGate`로 내려간다.

Production의 이메일 접속 결정은 다음 순서로 해석한다.

1. `@corca.ai` 내부 이메일은 기존 내부 사용자 정책으로 허용한다.
2. 외부 이메일은 `lighthouse.access_allowlist_entries`의 exact-email membership을
   요청마다 읽는다. row가 있으면 접속을 열고, 없으면 기존 세션이 있어도 접속을
   닫는다.
3. DB read 실패는 외부 이메일을 fail closed한다. magic-link 발급은 재시도 가능한
   503 안내를 반환하고, 인증 resolver는 사용자를 성립시키지 않는다.

내부 관리자는 `/admin/access`의 Server Action으로 외부 이메일 membership을
추가하거나 삭제한다. action은 매 요청에서 internal admin auth를 다시 확인하고,
성공한 commit 뒤 같은 관리 route로 redirect해 현재 목록을 다시 읽는다. process
cache는 두지 않으므로 성공한 변경은 다음 magic-link 발급과 다음 인증 resolver
요청부터 보인다. 기존 `LIGHTHOUSE_ALLOWED_EMAILS` 값은 배포 전에 DB
membership으로 이관하고 새 runtime allowlist source에서는 제거한다. 설정값은 구
revision rollback window가 닫힐 때까지 compatibility carrier로 보존한다.

Production canonical origin은 `https://scholar.themoonlight.io`다.
`search.themoonlight.io`는 path와 query를 보존하는 308 compatibility ingress다.
Host-scoped session cookie와 전환 전 PKCE verifier는 origin 사이에 복제하지 않는다.

## Library Context Source

기본 source of truth는 현재 principal의 `lighthouse.reviewed_papers`다.
`app/server/domain-access/reviewed-paper-access.ts`가 검색과 post-mount bootstrap 실행마다
owner predicate가 있는 repository read로 현재 `LibraryContextUserSource`를 만들고,
`app/server/services/library-context-source.ts`가 provider-neutral E3 paper reference 기반
context를 계산한다. 숫자형 S2 id는 read-compatible alias이고, 저장된 E3 `paper_uid`와
지원되는 DOI·arXiv·OpenAlex·PubMed reference는 그대로 유지한다. 저장·해제와 principal
backfill은 DB commit만 소유한다. Framework result cache와
tag invalidation을 두지 않으므로 commit 뒤 새 실행은 이전 empty source를 재사용하지 않는다.
Personalized 검색에서는 이 DB read와 keyword provider request를 동시에 시작하고, source가
준비되는 즉시 graph preflight를 잇는다. Source 실패는 keyword-only로 degrade한다.

`resolveLibraryPresetPapers`는 `anchorPapers[].title`을 먼저 쓰고, 제목이 없는 E3 paper
reference만 Episteme batch로 best-effort 보강한다. Positive title은 15분, 성공 empty/null은 30초,
LRU capacity는 1,024 entries다. 동일 process의 같은 id miss는 한 800ms-bounded fill을
공유한다. Failure와 timeout은 cache하지 않는다. 정확한 운영 관측·capacity trigger는
`docs/operational-readiness.md`가 소유한다.

내부 context가 없고 `LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED=1`일 때만 Moonlight Scholar
API source를 compatibility 후보로 읽는다. API base 또는 token이 없을 때만 명시적인
`LIBRARY_CONTEXT_JSON`/`LIBRARY_CONTEXT_PILOT_PATH` source로 내려간다. Live API가
구성된 뒤의 network·500·validation 실패는 stale file source로 우회하지 않고 일반
검색으로 degrade한다.

`lib=1`은 client-known availability hint다. 직접 들어온 URL에 없어도 서버는 current
source를 확인할 수 있다. 기존 `personalize=false` 입력은 파싱만 허용하고 현재 검색
identity와 결과에는 참여시키지 않으며, 모든 새 writer는 이 값을 생략한다.

## Loaded-result URL State

출판연도는 Apply 또는 Enter 때 current query·sort와 함께 조건 URL에
commit되어 provider `year` 파라미터를 바꾼다. 단일 연도는 두 입력에 같은 값을 복원하고,
네 자리 표기는 그대로 보존한다. 따라서 조건을 다시 적용하거나 정렬을 바꿔도 단일
연도가 하한만 있는 범위로 넓어지거나 앞자리 0이 사라지지 않는다. Typing과 blur는
실행하지 않는다.

분야·저자·venue·PDF facet은 이미 적재된 result metadata를 좁힌다. Facet 변경은 provider
검색을 다시 실행하지 않고 current metadata와 URL query를 함께 갱신한다. 직접 facet
URL로 들어오면 route payload가 같은 filter state를 보존하고, hydration 뒤의 client
projection과 AI focused context가 같은 result pool을 사용한다.

## Contract Architecture Impact Review

Contract delta: `research-route-cap-feedback-condition-overflow`가 이미 정한 직접 조건 URL의
명시적 오류와 provider·identity 이전 거부를 malformed 출판연도에도 적용하고, 지원하는
표기는 기존 publication-year AC의 하나의 canonical 실행 조건으로 수렴시킨다. 새 제품
복구 정책을 추가하지 않는다.
Verdict: constrain-existing
Affected axes and current owners: Source of truth and authority; Runtime, external, or AI boundary; Compatibility and retirement — `app/domain/search-year-range.ts`, `app/lib/search-condition-url-budget.ts`, `app/(research)/research-route-shell.tsx`, `app/server/services/search-execution.ts`
Decision: 기존 조건 URL parser와 domain normalizer를 유지한다. 인증·provider 실행 전
validation은 공용 `ResearchRouteShell`의 bootstrap·background 경계까지 지배하고, route
fingerprint, UI round-trip, DOI exact admission이 같은 canonical 연도 판정을 사용한다.
Rejected alternative: malformed 값을 무필터 검색으로 낮추거나 숫자 접미사를 부분
해석하지 않는다. 역순·동일 경계의 직접 주소도 redirect하지 않는다.
Evidence and structural defense: `promise:research-route-cap-feedback#acceptance-check:research-route-cap-feedback-condition-overflow`, `app/domain/search-year-range.ts`, `app/lib/search-condition-url-budget.ts`, `app/(research)/__tests__/relationship-route-page.test.tsx`, `app/components/research/__tests__/research-route-shell.test.tsx`, `app/server/services/__tests__/search-service.test.ts`
Human decision required: no

Authority basis: 승인된 공용 condition URL 거부 의미를 새 malformed-year 입력에 적용하는
`constrain-existing`이며 별도 사용자-facing 복구 선택을 만들지 않는다.

### Earlier research onboarding removal record

- classification: `reshape`
- approved change: 별도 research feature onboarding을 제거하고, 검색·탐색 행동은
  각 화면의 실제 조작 표면에서 바로 드러나게 한다.
- previous owners: `ResearchRouteShell` modal mount,
  `ResearchRouteSearchBar` manual reopen event, browser localStorage seen key,
  onboarding 전용 analytics emitters.
- selected owners: research route lifecycle은 검색, 인증, library projection,
  route-owned view만 유지한다. 제거된 onboarding에는 대체 runtime owner를 두지
  않는다.
- rejected alternatives: `preserve`와 `migrate-read-only`는 폐기된 별도 안내 흐름과
  상태를 계속 운영하므로 거부했다.
- structural defense: modal·assets·mount·reopen control·interaction event·canonical
  event contract를 함께 제거한다. route search bar와 authenticated bootstrap 테스트는
  폐기된 reopen control과 modal이 다시 나타나지 않는지 검증하고, Story Chain과 event
  validation은 삭제된 ref가 정본으로 남지 않게 한다.
- Architecture Fitness: 새 profile을 만들지 않는다. 제거된 onboarding localStorage는
  cache-lifecycle policy inventory에서도 제외했으며, 현재 활성 profile이 검증할 새
  구조적 projection은 없다.

## Concept Shift Architecture Review

- compatibility: `remove`
- route/state: 별도 modal과 reopen event를 제거한다. 브라우저에 남은 과거 seen key는
  더 이상 읽거나 쓰지 않는 inert 값이며 migration을 만들지 않는다.
- analytics: 전용 event contract와 emitters를 제거한다. 외부 sink에 이미 적재된 과거
  event는 역사 데이터로 남지만 현재 product event로 다시 발행하지 않는다.
- repository/DB/API: 전용 repository, DB field, route API가 없었으므로 변경하지 않는다.
  계정 가입 onboarding은 다른 제품 흐름이며 이번 제거 대상이 아니다.
- tests/assets: 전용 테스트와 시각 asset을 제거하고, 살아 있는 search/auth/library
  테스트는 onboarding 가정을 삭제한 상태로 유지한다.

## Update Rule

조건 URL dimension, route pending/failed semantics, browser navigation, detached 동작,
auth bootstrap과 invited-access source·freshness·compatibility 순서, library
source·freshness·compatibility 순서가 바뀌면 이 문서를 갱신한다.
