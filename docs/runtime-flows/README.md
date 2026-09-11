# Runtime Flow Docs

이 디렉토리는 Promise만으로 직접 표현되지 않는 **기술 처리 절차 정본**을 둔다.

핵심 목적은 세 가지다.

- 현재 런타임이 어떤 순서로 동작하는지 단계별로 남긴다.
- programmatic routing, fallback, persistence, UI sync 같은 기술 절차를 추적 가능하게 만든다.
- "사용자 가치" 문서와 "실행 가능한 계약" 문서 사이의 비어 있는 층을 채운다.

## 문서 계층

| 층 | 정본 | 질문 |
| --- | --- | --- |
| 제품 계약 | `docs/contracts/*` | 사용자가 무엇을 기대하는가 |
| 기술 절차 | `docs/runtime-flows/*` | 시스템이 그것을 어떻게 처리하는가 |
| 실행 계약 | `docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml` | 무엇을 깨뜨리면 안 되는가 |

즉:

- `docs/contracts/*`는 **what / why**
- `docs/runtime-flows/*`는 **how**
- `docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml`는 **must not break** Evidence Ledger다.

## 여기에 두는 것

- runtime routing
- event -> ResearchRoutePayload -> reaction handoff
- structured generation / route-view AI comment 절차
- fallback 순서
- persistence / sync 순서
- 디버깅 포인트와 실패 신호

## 여기에 두지 않는 것

- 사용자 가치, 우선순위, acceptance criteria
  - `docs/contracts/*`
- 테스트 실행 계약, traceability, executable coverage
  - `docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml` (current path for Evidence Ledger)
- 구현 원리 일반론
  - `docs/principles.md`

## 고도화 런타임 기능의 기본 구조

검색 보강, 그래프 이웃, 공백 분석처럼 외부 provider·LLM·background task를 함께 쓰는
고도화 기능은 작업자의 구현 자율성을 열어 두되, 다음 구조를 최소 하방으로 둔다.

- **결정적 core와 enrichment를 분리한다.** 사용자가 기다리는 첫 결과는 입력 snapshot,
  정렬·필터, deterministic 계산, 저장 경계만으로 설명 가능해야 한다. LLM prose,
  provider 보조 신호, 후속 해석은 가능하면 upgrade/enrichment 단계로 분리한다.
- **입력 cap과 snapshot을 먼저 잠근다.** 어떤 결과 window, seed, sort, filter, source
  snapshot이 기능의 입력인지 URL·metadata·request body 중 한 곳 이상에 구조화해 보존한다.
- **외부 호출은 bounded degrade 경계를 갖는다.** provider·LLM 호출은 timeout,
  circuit/load-shed, cache 재사용, null degrade 중 하나 이상의 경계를 가져야 하며,
  실패가 core ResearchRoutePayload 생성을 불필요하게 막지 않는지 먼저 검토한다.
- **progress와 persistence 소유자를 하나로 둔다.** pending placeholder, background
  runner, status polling, completed ResearchRoutePayload merge 중 누가 상태를 소유하는지 runtime-flow에
  명시한다. pending id는 DB route payload id처럼 쓰지 않는다.
- **관측 가능한 phase 이름을 남긴다.** 성능이 문제 될 수 있는 기능은
  `input`, `prerequisite`, `core-build`, `enrichment`, `persist`처럼 phase를 분리해
  로그·Server-Timing·테스트에서 같은 이름으로 따라갈 수 있게 한다.

이 구조는 알고리즘 선택을 제한하려는 규칙이 아니다. 하방은 bounded core·명시적
degrade·관측 가능성으로 올리고, 상방은 각 기능이 더 좋은 provider, LLM 해석, 시각화,
후속 action을 붙일 수 있게 열어 둔다.

## 변경 규칙

다음 중 하나가 바뀌면 같은 PR 안에서 해당 runtime flow 문서를 갱신한다.

- entrypoint
- 단계 순서
- programmatic 처리 경계
- fallback 순서
- persistence / sync ownership
- 주요 디버깅 포인트

## 현재 정본

| 문서 | 다루는 흐름 |
| --- | --- |
| [`api-response-and-retry.md`](api-response-and-retry.md) | JSON envelope를 보내는 19개 API route의 오류 의미와 redirect-only auth callback 예외, status별 client action, degraded 2xx, Retry-After와 idempotent/bounded retry 경계 |
| [`ai-response-generation.md`](ai-response-generation.md) | `POST /api/route-ai-comments/generate/:viewId`와 현재 화면 `viewSnapshot`으로 route-owned AI comment를 만드는 structured generation |
| [`gap-network-analysis.md`](gap-network-analysis.md) | 검색 결과 snapshot으로 `gap_reports` artifact를 만들고 `/gap/:id`에서 building/ready 상태를 렌더하며 `/api/gap-reports` 생성·status polling을 닫는 처리 절차 |
| [`search-mechanism.md`](search-mechanism.md) | 검색 route lifecycle, retrieval, background enrichment, 관계 탐색과 AI/gap handoff를 잇는 overview와 공통 경계 |
| [`research-route-lifecycle.md`](research-route-lifecycle.md) | `/search`·`/citation`·`/similar` 조건 URL, navigation, auth/library bootstrap, ephemeral view 수명 |
| [`search-retrieval-ranking.md`](search-retrieval-ranking.md) | query clause, keyword/provider fan-out, library graph preflight, title-family dedup, ranking·projection, 결과 handoff와 경계 상수 |
| [`search-background-enrichment.md`](search-background-enrichment.md) | card hydration, 연구 용어, 맞춤법 교정, inline-analysis queue와 shared cache |
| [`search-background-transport.md`](search-background-transport.md) | search background route별 versioned command, delta response, dual-read retirement와 byte 경계 |
| [`relationship-exploration.md`](relationship-exploration.md) | 인용 계보, graph-backed 비슷한 논문, seeded keyword fallback과 다른 입장 후속 검색 |

새 runtime-flow가 필요하면 이 README의 경계에 맞춰 별도 문서로 추가한다.

## Search-first route persistence

제품 표면은 Search-first route가 소유한다. 검색 진입은 `/search?q=...`이고,
in-app submit과 외부 `/search?q=...` 진입 모두 같은 URL에서 provider 검색을 실행해
현재 연구 view를 렌더한다. 검색 실행은 저장 ResearchRoutePayload를 만들지 않는다. 탐색 화면의 URL
정본은 조건 주소(`/search?q=...`, `/citation?seedPaperId=...`,
`/similar?seedPaperId=...`)이고, 저장 id route는 연구 공백 리포트(`/gap/:id`)에만
남는다. Route mount hydration은 조건 URL이 제공한 실행 결과를 단일 current view로
렌더한다. Client runtime은 mount별 active execution id와 scalar reaction/history/visible-window
state를 소유하며, 같은 id·timestamp를 재사용한 이전 execution의 completion이나 cleanup을
거부한다. Server route seed로 ResearchRoutePayload 목록이나 tab state를 reset하지 않는다.
빈 query 없는 `/search` 시작 화면은 store 문서를 만들지 않고 route가 직접 소유한 초기
검색 입력 화면(`InitialSearchScreen`)으로 렌더한다. Search route는 검색 결과
ResearchRoutePayload를 durable storage에 저장하지 않으며 URL 정본은 조건 주소 그대로
유지된다. Client background task state와 논문별 공유 inline-analysis cache는 이
route-payload 비영속 경계와 구분되는 별도 목적 상태다. route-owned API인
`POST /api/gap-reports`,
`GET /api/gap-reports/status`, `POST /api/search/enrichment`,
`POST /api/route-ai-comments/generate/:viewId`, `PUT /api/gap-reports/:id/reaction`,
`DELETE /api/gap-reports/:id/reaction`는 `ownerPrincipalId` 없이 현재 사용자 기준으로
동작한다. gap artifact read는 인증된 가입자에게 열리고 reaction preference는 현재
viewer로 결정한다. `ownerPrincipalId` query/body는 입력으로 받지 않는다. 자동 reaction generation은 현재 화면 `viewSnapshot`을
입력으로 쓰며, 서버가 search/citation/similar route payload row를 다시 읽어 reaction 입력을
만들지 않는다. search enrichment도 route-owned search metadata snapshot을 입력으로 받아
legacy documents row를 읽거나 쓰지 않는다.
search/citation/similar ephemeral
reaction은 클라이언트 상태에만 남는다. 완료된 연구 공백 리포트의 reaction은 shared
`gap_reports` 본문과 분리된 viewer preference row에 저장한다. 카드 follow-up은 현재 화면에 탭을
추가하지 않는다. 비슷한 논문·인용 계보는 클릭 즉시 조건 route
URL(`/similar?seedPaperId=...`, `/citation?seedPaperId=...`)로 이동하고, 목적지 server
route가 seed URL 파라미터만으로 provider를 실행해 ephemeral relationship ResearchRoutePayload를
렌더한다. 같은 seed owned 문서를 찾거나 canonical saved id로 redirect하지 않는다. plain
click은 현재 브라우저 route를 전환하고, detached(Ctrl/Cmd/가운데 클릭)는 같은 조건
route URL을 새 브라우저 탭에서 열며 현재 브라우저 route는 바꾸지 않는다. ResearchRoutePayload
reaction generation은 클릭이 아니라 목적지 route bootstrap이 단일 source로
`POST /api/route-ai-comments/generate/:viewId`를 큐잉한다. 연구 용어·다른 입장 click은
`/search?q=` 조건 route로 이동하고 destination route가 검색을 소유한다. plain click은
현재 브라우저 route를 전환하고, detached(Ctrl/Cmd/가운데 클릭)는 같은 `/search?q=`
entry URL을 새 브라우저 탭에서 열며 현재 브라우저 route와 출발 route payload state는 바꾸지
않는다. 연구 용어의 `termSeed`는 entry URL 파라미터로 운반되어 route metadata에
보존된다. `다른 입장` 목적지는 후보 query만 독립 검색 조건으로 받고 출발
논문·입장·쟁점은 URL이나 route metadata로 운반하지 않는다.
기본 제품 경로에서는 현재 `reviewed_papers`가 라이브러리 근접 신호의 source다.
검색 결과는 이 신호와 검색어 관련도를 자동으로 함께 반영하며 사용자가 결과 기준을
선택하는 상태를 두지 않는다. 기존 `personalize=false` 입력은 읽기 호환 뒤 단일 결과로
정규화하고 새 조건 URL에는 쓰지 않는다.
공백 분석은 현재 화면 snapshot을 `POST /api/gap-reports`로 보내 pending gap report
id를 먼저 예약하고, 같은 새 브라우저 문서 창을 `/gap/:id`로 이동한다. 리포트 생성
진행 상태는 `/gap/:id` 화면 하나가 소유한다. 이 경로는 항상 detached 창을 사용하므로
출발 route history와 뒤로가기 관계를 만들지 않는다. 연구 공백 리포트의 물리
저장소는 범용 legacy documents 행이 아니라 `lighthouse.gap_reports` purpose
table이다. domain-access는 이 행을 기존 `ResearchRoutePayload` 렌더러가 읽을 수 있는
`gap_network` adapter shape로 변환한다. 같은 share-safe canonical input의 예약은
`source_input_digest` unique key와 conflict recovery로 하나의 gap report에 수렴한다.
본문 보강이 실패한 report는 같은 `/gap/:id`에서 core graph를 유지하고, 전용 인증
command로만 보강을 명시적으로 다시 연다. 첫 재시도는 즉시 허용하고 재실패 뒤에는
report 단위 60초 cooldown을 적용한다. 실행과 저장은 기존 runner가 계속 소유한다.

Client view store는 단일 `currentView`와 active-execution scalar
reaction·history·generation·search-visible-window 상태만 소유한다. 빈 `/search`
시작 화면은 route-owned로 렌더되고, 검색·인용 계보·비슷한 논문 조건 route는
server route seed로 current view를 만들되 컬렉션형 tab/list state를 만들지 않는다. 사용자
navigation은 handler의 명시적 route push 또는 server route 응답이 소유하고, store state
change는 URL을 변경하지 않는다.
