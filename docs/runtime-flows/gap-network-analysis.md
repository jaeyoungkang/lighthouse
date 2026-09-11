# Gap Report Analysis Runtime Flow

이 문서는 검색 결과 snapshot에서 연구 공백 분석 report를 만들고 `/gap/:id`에서
building/ready 상태를 렌더하기까지의 런타임 절차를 설명한다. 검색 결과의
`연구 공백 지도 만들기`는 현재 화면의 결과 snapshot을 서버에 보내 `gap_reports`
artifact를 만들고, 응답으로 받은 report id의 `/gap/:id`를 연다. 검색 결과와
relationship view의 host-owned 진입점은 user activation 안에서 detached
창 target을 먼저 확보하고, 서버가 pending gap report id를 예약해 반환하면 같은
target을 `/gap/:id`로 이동한다.
direct helper fallback도 새 detached 창을 기본값으로 삼는다. 명시적으로
다른 navigate callback을 주지 않는 한 출발 탐색 route는 바꾸지 않는다.
공백 분석의 사용자 가치는 `promise:gap-network-detection-from-search`가,
공유 리포트의 가입자 접근·재사용은 `promise:shared-gap-report-member-access`가
소유한다. Acceptance와 증거는 두 Promise의 관련 Evidence Ledger가 정본이다.
이 문서는 **어떻게 처리되는가**를 다룬다.

## Contract Architecture Impact Review

Contract delta: gap report를 creator-owned resource에서 인증 가입자가 URL로 읽는 versioned shared artifact로 바꾸고, share-safe source identity와 viewer-scoped reaction을 분리한다.
Verdict: reshape
Affected axes and current owners: Domain and data shape; Source of truth and authority; State lifetime and recovery; Execution semantics; Security and privacy; Compatibility and retirement — `supabase/migrations/00019_shared_gap_report_artifacts.sql`, `app/server/domain-access/gap-network-view-access.ts`, `app/server/repository/gap-reports.ts`
Decision: `gap_reports.id + version + source_input_digest`가 artifact와 build lifecycle을 소유한다. 현재 가입자는 read authorization과 reaction scope만 제공하며, v1 digest artifact는 id로 읽되 새 예약에서 재사용하지 않는다.
Rejected alternative: creator principal을 artifact owner로 유지하거나 v1/v2 digest를 함께 역조회하면 공유 artifact와 요청 actor, private input과 share-safe input이 다시 결합된다.
Evidence and structural defense: `supabase/migrations/00019_shared_gap_report_artifacts.sql`, `app/server/domain-access/__tests__/gap-network-view-access.test.ts`, `app/domain/__tests__/research-route-payload-schema.test.ts`
Propagation Map: `docs/runtime-flows/gap-network-analysis.md#propagation-map`
Concept Shift Architecture Review: `docs/runtime-flows/gap-network-analysis.md#concept-shift-architecture-review`
Human decision required: no

- 판정: `reshape`
- share-safe graph projection이 digest 입력 bytes를 바꾸므로 source-input identity는
  v2로 올린다. v1 digest로 생성된 기존 report는 id로 계속 읽을 수 있지만 새 예약에서
  역조회하거나 재사용하지 않는다. v1/v2 dual lookup은 search-private 진단값을 저장한
  과거 artifact를 새 share-safe 입력과 같은 것으로 간주하므로 거부한다.
- 공유 `gap_reports` 행은 creator owner를 갖지 않는 `GapReportArtifact`이고, 인증된
  principal은 읽기·reaction preference·analytics를 한정하는 `ViewerContext`다.
- gap wire payload는 `viewerPrincipalId`만 노출한다. 검색·인용 계보·그래프 인접
  payload의 `ownerPrincipalId`는 기존 개인 route ownership 의미를 유지한다.
- 거부 대안: gap payload의 `ownerPrincipalId`를 viewer alias로 유지하면 artifact
  ownership과 요청 viewer가 같은 개념처럼 전파되므로 거부한다.
- 구조적 방어: `type: "gap_network"` 판별 DTO와 strict wire schema, repository/store/
  renderer 음성 테스트가 retired alias를 거부한다.

### Explicit enrichment retry (2026-08-12)

- 판정: `constrain-existing`
- Human decision: 최초 본문 보강 실패 뒤 첫 명시적 재시도는 즉시 허용하고, 그
  재시도가 다시 실패한 뒤에는 같은 report에 60초 cooldown을 적용한다.
- 안정 identity는 `gap_reports.id + version`이다. 전용 command route는 가입자 인증,
  현재 상태 판정, `core ready + enrichment failed → pending` version CAS만 소유한다.
  LLM 실행·저장·attempt/lease는 기존 runner가 계속 소유한다.
- `pending`과 `ready` 중복 command는 현재 상태를 반환하고 새 work를 만들지 않는다.
  화면 재방문과 status GET은 terminal enrichment failure를 다시 열지 않는다. 일반
  gap POST는 기존 failed-core recovery만 유지하고 failed enrichment는 다시 열지 않는다.
  command가 이미 받아들인 pending work의 만료 lease recovery만 기존 POST
  경로를 재사용한다.
- caller abort는 accepted runner를 취소하지 않는다. fresh attempt/lease가 stale
  completion을 거부한다. 새 queue, cache, control plane은 만들지 않는다.

### Destination-owned creation continuation (2026-07-19)

- 판정: `constrain-existing`
- 영향받는 현재 owner는 검색·인용 관계·비슷한 논문 source host와 공유 gap
  handoff helper다. 선택 owner는 id 예약 전에는 공유 gap handoff continuation이고,
  detached target은 그 continuation이 유지하는 carrier다. 세 source host와 출발
  surface의 pending state는 dispatch 뒤 취소 권위를 갖지 않으며, id 예약 뒤에는
  `/gap/:id` route가 progress를 소유한다. 출발 pending state는 화면이 살아 있는
  동안의 표시만 소유한다.
- POST가 시작되고 detached target이 확보된 뒤에는 source component unmount나 앱
  안의 route 이탈을 취소 신호로 연결하지 않는다. 응답이 늦게 도착해도 예약에
  성공하면 같은 target을 `/gap/:id`로 이동한다.
- 거부 대안: source effect cleanup이나 `AbortController`에 예약 요청 수명을
  결속하면 사용자가 다른 탐색으로 이동하는 순간 이미 연 gap target이 고아가
  되므로 거부한다. module-global request registry, background queue, detached-window
  messaging으로 수명을 승격하거나 요청 snapshot을 복제하는 방식도 현재
  continuation에 불필요한 상태 owner를 추가하므로 거부한다.
- 구조적 방어: 실제 검색 host에서 요청을 시작한 뒤 source view를 unmount하고
  지연된 예약 성공 응답이 동일 target을 `/gap/:id`로 이동하는 회귀 테스트를
  둔다. 브라우저 창 종료·새로고침·프로세스 손실·네트워크 실패는 이 수명
  결정의 보장 범위가 아니다.

## Propagation Map

- Owning edits: shared gap Promise·Evidence Ledger, `gap_reports` migration, domain-access·repository, gap runtime flow와 route payload schema.
- Compatibility: v1 report는 id 조회만 보존하고 새 share-safe 예약과 dedupe에서는 제외한다.
- Structural defense: shared read, viewer reaction 분리, retired owner alias 거부, versioned build CAS를 기존 테스트와 migration이 고정한다.
- Split cleanup: creator ownership과 current viewer carrier를 하나의 field로 표현하던 shape를 제거한다.

## Concept Shift Architecture Review

- 판정: `remove`
- 기존 gap `ownerPrincipalId` alias는 compatibility read나 dual-write 없이 제거한다.
  저장 artifact id는 `gap_reports.id`, viewer 상태는 `(gap_report_id,
  viewer_principal_id)`가 소유한다.

## 범위

- 다루는 것: 검색 결과 기준 row 우측의 `연구 공백 지도 만들기` action이 현재
  결과 snapshot을 `POST /api/gap-reports`로 보내고, 응답의 `gapReportId`
  기준 `/gap/:id` route를 새 detached 창으로 연 뒤 `GET /api/gap-reports/status`가
  같은 report id를 polling해 building/ready 상태를 닫는 순서.
- 다루지 않는 것: 공백 분석 알고리즘 내부의 cluster/gapPair 계산 방식과 LLM
  해석 품질. 그 실행 계약은 Evidence Ledger와 관련 테스트가 다룬다.

## 1. 진입점

공백 분석은 현재 ResearchRoutePayload 안에 탭을 추가하지 않는다. 검색 결과 ResearchRoutePayload에서는 결과 기준
row 우측의 `연구 공백 지도 만들기` 버튼이 현재 정렬·연도·facet 조건이 적용된
result pool snapshot을 `POST /api/gap-reports`로 보낸다. 클라이언트는 user
activation 안에서 detached 창 target을 Light House가 소유한 `/gap?opening=1`
route로 먼저 확보한다. 이 opening route는 데이터가 없고 auth도 필요 없는 route
transition 화면이고, 공유 research layout도 current user 해석 없이 shell/children을
먼저 반환한다. pending gap report id 예약이 지연되어도 브라우저의 `about:blank` 문서를
붙잡지 않는다. 서버는 core 계산을 기다리지 않고 pending gap
report row를 먼저 저장해 `{ gapReportId, status: "pending" }`를 반환한다. 클라이언트는
같은 target을 `/gap/:id`로 이동해 출발 검색 route와 ResearchRoutePayload 상태를
유지한다. 따라서 사용자는 빈 브라우저 문서가 아니라 제품 소유 연결 화면을 본 뒤,
준비되는 즉시 `/gap/:id`의 리포트 생성 progress 화면으로 이어진다. 출발 검색 surface도
gap 생성 요청이 진행 중임을 표시해 중복 실행을 막는다.
요청을 시작한 뒤 source component가 unmount되거나 사용자가 앱 안의 다른 route로
이동해도 공유 handoff continuation은 취소되지 않는다. 출발 surface의 pending 표시는
그 화면과 함께 사라질 수 있지만, 예약 성공 응답은 이미 확보한 detached target을
같은 `/gap/:id`로 이동한다.
서버 프로세스 안에서는 같은 versioned source-input digest 예약을 single-flight로
묶고, DB의 `gap_reports(source_input_digest)` unique index가 cross-process 중복
예약을 막는다. Digest는 source paper 선택과 cap을 먼저 적용한 뒤 query, 정규화된
paper id 순서, share-safe paper metadata, graph support(`generatedAt` 제외),
`createdBy`로 계산한다. query clauses, 출발 route의 ephemeral snapshot id, 생성자
principal은 artifact identity에 넣지 않는다. Unique 충돌이 나면 예약 경로는 같은
digest의 기존 gap report를 다시 읽어 반환한다. Repository의
`reserveGapReportUnchecked`가 digest 조회, insert, `23505` 뒤 재조회를 소유한다.
Domain access는 같은 프로세스의 single-flight만 소유하고 DB 경쟁 의미를 다시
구현하지 않는다.

- 검색 결과 문서의 action은
  `app/components/research-route-renderers/search-results-header.tsx`에서 modified activation
  payload(`ctrlKey: true`)로 시작하며,
  `app/components/research-route-renderers/search-view-agent-actions.ts`의
  `openGapNetworkFromSearchView` 또는 `openGapNetworkFromSearchSource`를 호출한다.
  `app/components/research-route-renderers/search-view-knowledge-map.ts`는 action 시작 시
  detached window target을 확보하고, `search-view-agent-actions.ts`가 POST로 받은
  pending gap report id를 같은 target의 `/gap/:id`로 이동한다. target 확보가 차단되면
  `app/components/research-route-renderers/view-followup-window.ts`의 forced detached navigation
  fallback을 쓴다. `auxclick`은 middle click(`button === 1`)만 follow-up으로
  인정하고, right click은 무시한다. helper를 직접 호출하는 fallback도 기본 navigate가
  새 detached 창을 연다.
- search source에서는 현재 화면의 정렬·연도·facet 필터가 적용된 result pool에서
  앞 40편의 paper id 순서와 필요한 paper metadata가 POST body의
  `sourcePaperIds`/`papers`에 보존된다. 서버는 저장된 source snapshot를 다시
  읽지 않는다.
  대표 논문 filter는 검색 결과 화면에 보이는 카드 목록만 좁히며, 이 id 목록을
  대표 카드 subset으로 줄이지 않는다.
- citation-lineage/graph-neighbors source도 현재 화면의 visible snapshot과 관계 근거를
  같은 POST 계약으로 직렬화한다. 서버는 저장된 source ResearchRoutePayload를 gap 생성
  입력으로 요구하지 않는다.
- 문서 본문 reaction 영역의 버튼 surface는 gap entrypoint를 소유하지 않는다. 검색 결과
  문서는 결과 기준 row 우측 deterministic action이 gap entrypoint를 소유하며,
  citation-lineage와 graph-neighbors 문서는 문서 상단의 host-owned action row가 같은
  route pipeline을 호출한다.

이미 같은 versioned source-input digest로 만든 gap report가 있으면 서버는 생성자와
관계없이 기존 report id를 반환한다. 입력 차이는 POST body에 함께 저장할 수 있는
share-safe snapshot으로만 표현한다.

## 2. Building report 렌더

서버는 UUID가 있는 pending row를 `lighthouse.gap_reports` purpose table에 먼저 저장한다.
detached 창은 POST가 반환한 id의 `/gap/:id` progress 화면을 연다. `/gap/:id` route는 UUID가 아니면 `notFound()`로
닫고, 인증된 가입자에게 id가 가리키는 공유 gap report를 읽어 `GapNetworkView`에
전달한다. 생성자 principal은 read authorization에 쓰지 않는다. report가 아직
display-ready가 아니면 같은 `/gap/:id` 화면에서 building progress를 보여 주고
`GET /api/gap-reports/status?gapReportId=<id>`를 polling한다.

display-ready는 core report가 정착되어 있고, terminal empty-state이거나 LLM
enrichment가 `ready`/`failed` terminal marker로 닫힌 상태다. 관계 근거와 의미 있는
gapPairs가 있는 enrichment-pending core report는 graph/report UI로 전환하지 않고
loading 상태를 유지한다.

`/gap/:id` building progress 화면의 단계 페이싱은 `GapNetworkView`가 소유한 client
애니메이션 시계가 결정한다. 관찰 가능한 build phase는 coarse하고(예약 직후
`core-build` → 약 1-2초 in-memory core → `persist`/`enrichment` → `complete`)
deterministic core가 읽을 수 있는 단계보다 빨리 정착하므로, 화면 단계를 raw phase에
묶지 않고 `GAP_NETWORK_PROGRESS_STAGE_DWELL_MS` 간격으로 수집→보강→군집→분석→해석을
순차 전진시키고 마지막 pending 단계(해석)에서 멈춘다. status route가 반환하는 `view`는
참고용이며 visible 라벨을 결정하지 않는다. 새로 생성 중이던 report는 core나 enrichment가
빨리 끝나 display-ready가 되어도 `GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS`가 지나기 전에는
그래프 리포트로 전환하지 않고 진행 애니메이션 화면을 유지하므로, 빠른 완료나 terminal
empty-state 생성이 첫 단계만 반짝 보이고 completed로 점프하지 않는다. terminal
empty-state는 그래프가 아니라 짧은 근거 부족 안내라 `GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS`
(의미 있는 공백 리포트의 floor보다 짧음)로 먼저 공개한다. 이미 display-ready인
report를 다시 여는 재오픈은 이 최소 노출 지연 없이 즉시 리포트를 보여준다. enrichment가
오래 걸리는 동안에는 진행 화면이 해석 단계에 머물고, terminal failed 빌드는 진행
바를 첫 단계에 멈춰 가짜 완료로 진행하지 않는다.

enrichment가 실패한 display-ready report는 core graph와 degraded 본문 상태를 함께
보인다. 사용자가 `분석 다시 시도`를 선택해 enrichment가 다시 pending이 된 경우에는
최초 생성 progress 화면으로 돌아가지 않고 core graph를 계속 노출하며, 본문 상태만
재시도 중으로 바뀐다. 첫 재시도는 즉시 시작된다. 재실패 뒤에는 persisted
`enrichmentRetryCount`와 실패 `updatedAt`에서 계산한 60초 동안 버튼을 비활성화하고,
command route의 `Retry-After`와 같은 남은 초를 표시한다.

## 4. 서버 생성 경로

`POST /api/gap-reports`의 생성 요청은
`{ sourceSnapshotId, sourceQuery, sourcePaperIds?, papers[], graphSupport? }`를 받는다.
프로세스 손실 뒤 복구 요청은 `{ gapReportId }`만 보내 기존 artifact의 lease를 다시
획득한다.
`sourceSnapshotId`는 provenance로 남는 visible result snapshot id다. URL-owned
search/citation/similar execution에서는 route-owned ephemeral id가 들어올 수 있지만
artifact identity에는 참여하지 않는다. 서버는 저장된 source route payload row나
현재 가입자의 inline-analysis cache를 읽지 않고, 예약 시 저장한 share-safe snapshot의
papers와 graph support를 gap builder 입력으로 사용한다. 저장은
`lighthouse.gap_reports` purpose table에 이뤄지고,
domain-access가 공유 artifact와 현재 `ViewerContext`를
`ResearchRoutePayload(type: "gap_network", viewerPrincipalId)`로 투영한다. 이 payload에는
`ownerPrincipalId`가 없다. 응답은 `{ gapReportId, status }`이고, 클라이언트는 user activation에서
미리 확보한 `/gap?opening=1` detached target을 `/gap/:id`로 이동해 기존 탐색 창을
끊지 않는다.

브라우저의 gap snapshot adapter는 분석에 쓰이지 않는 저자/PDF/DOI를 제거하고 관계
동일성을 compact local id로 보존한 뒤, 실제 전송 JSON이 UTF-8 1,000,000 bytes를 넘지
않는지 검사한다. 서버는 인증을 먼저 확인한 뒤 같은 1,000,000-byte ceiling으로 body를
읽고, 문자열 길이, paper/source id 최대 40개, id의 중복·부분집합 조건을 검증한다.
byte ceiling과 snapshot별 축약 기준의 정본은
`app/lib/gap-report-input-budget.ts`다. Gap 전용 strict paper DTO는 공개 graph snapshot
필드만 허용하고 `reviewed`, `reviewedAt`, `inlineAnalysis` 같은 viewer-private 필드를
예약 전에 거부한다. schema 진입 전 bounded preflight는 version+basis별 graph support root와
score, v2 candidate count·filtered count 객체의 unknown field도 첫 항목에서 거부해 nested
fan-out이 union 진단 트리를 만들지 못하게 한다. 선택 paper를 share-safe snapshot으로 한 번 정규화하고, 이
snapshot을 저장과 build에 사용한다. in-flight dedupe key와 persisted report lookup도
같은 versioned source-input digest를 쓴다. Graph support는 예약 시 저장 snapshot에 있으면
그대로 사용하고, 없으면 provider를 다시 호출하지 않은 채 citation/semantic 입력만으로 계속 진행한다.
Build·retry·lease 조정은
artifact id와 version/attempt가 소유하며 runtime principal은 LLM usage attribution에만
전달된다.

## 5. Status polling

`GET /api/gap-reports/status`는 `gapReportId`와 선택적 `startedAt`만 받는다.
UUID가 아니면 400으로 닫고, 미인증 요청에는 report payload를 노출하지 않는다.

1. 가입자 인증을 확인한 뒤 `lighthouse.gap_reports`에서 id로 공유 report를 읽고,
   현재 viewer의 reaction preference를 합성한다.
2. status route는 POST가 시작한 runner가 저장한 metadata만 읽는 observer다. 허용
   side effect는 response 조립뿐이며 provider, LLM, deterministic core build,
   enrichment와 source snapshot read는 command owner에 남는다.
3. artifact가 없으면 404로 닫고, 저장된 build-failed artifact면
   `{ status: "failed", gapReportId, document, view }`를 반환한다.
4. 나머지 non-display-ready artifact는 `{ status: "pending", gapReportId, document, view }`를 반환한다.
5. display-ready이면 completed status, `gapReportId`, renderer payload, `updatedAt`,
   `view`를 반환한다.

클라이언트는 status response의 `document`가 현재 `/gap/:id`와 같은 id·viewer이고,
poll 시작 시 캡처한 active execution id가 아직 현재 실행이며, version이 더 오래되지
않았을 때 current view에 merge한다. 같은 gap id로 새 실행이 열리면 이전 polling
completion은 새 실행을 patch하지 못한다. Polling effect 수명은 execution id, view id, viewer처럼
안정적인 scalar에 묶고 각 transport 직전에도 같은 값을 live store에서 확인하므로, pending
document patch가 예약된 interval을 취소해 즉시 GET을 반복하거나 route hydration 전 renderer가
이전 실행 id로 중복 GET을 시작하지 않는다. 각 status GET은 route의 60초 예산에 5초
handoff 여유를 둔 65초 silence deadline을 가진다. fetch가 abort를 무시해도 client Promise는
종료되어 오류 안내를 보이고 1.8초 뒤 다음 observer poll을 예약한다. Status 404, 저장된 build-failed
marker, status payload의 `failed`는 모두 terminal로 처리해 polling과 진행 clock을 중단하고,
spinner나 동작하지 않는 retry 없이 실패 화면을 보인다.

status가 non-display-ready row의 lease 만료나 lease 없는 queued 상태의 5초 경과를
알려주면, 클라이언트의 허용 행동은 `{ gapReportId }`를 기존 인증 POST command에
전달하는 것이다. 같은 recovery token이 갱신되지 않으면 5초 간격으로 bounded
재요청한다. POST command가 70초 lease를 DB version/attempt CAS로 재획득하고,
승리한 runner만 provider work를 실행한다. 따라서 반복 요청은 같은 runner를 중복
실행하지 않고, 프로세스 종료나 배포로 `after()` 작업이 사라져도 artifact가 영구
pending으로 남지 않는다. status GET과 direct load의 owner는 response 관찰로
한정된다.

명시적 enrichment retry의 시작 owner도 전용 인증 command다. 한 version CAS를 이긴
command만 기존 runner를 시작하고, loser request는 현재 pending을 그대로 받는다.
runner는 저장된 core를 다시 읽어 enrichment만 수행하고, 결과를 같은
report의 `ready` 또는 `failed` marker로 닫는다. retry LLM usage는 prompt/output 없이
enrichment phase와 `gap-report:<id>:initial|retry-<n>` bounded mode를 기존
`llm_usage_events`에 결속한다. command accepted/rejected/cooldown과 runner result,
attempt, duration은 report identity 기준 운영 로그로 관찰한다.

## 6. Persistence 경계

gap report는 DB에 저장되지만 범용 legacy documents 행이 아니다. 생성, status
lookup, enrichment update, reaction update, `/gap/:id` direct load는
`lighthouse.gap_reports`를 소유 경계로 삼고, 필요한 API 호환 지점에서만
`ResearchRoutePayload(type: "gap_network", viewerPrincipalId)` projection으로 변환한다.
이 projection은 공유 artifact의 owner를 만들지 않으며 retired `ownerPrincipalId` alias를
wire·store patch·renderer 어느 경계에서도 허용하지 않는다.
`source_input_digest`는 실제로 저장하고 재실행하는 share-safe build input의 SHA-256
identity다. 현재 identity version은 v2이며, 선택되지 않은 논문, viewer-private
review/inline-analysis, query clauses, graph 생성 시각은 identity에 참여하지 않는다.
v1 report는 direct id read만 유지하고 새 v2 예약의 dedupe 후보로 조회하지 않는다. 같은
v2 입력의 cross-process 중복 artifact는 DB unique key가 막는다. `gap_reports`에는 creator
owner와 reaction 상태를 저장하지 않는다.

준비된 overview/cluster/gap reaction 선택은 화면에서 즉시 active execution의 scalar
reaction으로 보인다. `GapNetworkView`의 execution-owned coordinator는 active write 하나와 최신
pending 선택 하나만 유지한다. 중간 선택은 최신 pending으로 coalesce하고, 이전 execution의 늦은
완료와 대기 중 선택은 현재 projection을 바꾸지 않는다. 별도 module-global registry나 uncertain
replay state는 두지 않는다.

각 browser write는 body chunk로 연장되지 않는 15초 absolute deadline을 가진다. 응답 유실과
5xx처럼 commit 여부가 모호한 실패는 같은 payload로 한 번 더 요청한다. 두 PUT 응답을 모두
확인하지 못하면 현재 viewer의 `GET /api/gap-reports/:id/reaction`을 최대 5회 호출해 요청 reaction이
현재 reaction 또는 history에 기록됐는지 확인한다. 확인되면 server document를 채택한다. 요청
reaction을 끝까지 확인하지 못해도 더 최신 canonical artifact를 관찰했다면 execution, id,
`reactionVersion` guard를 거쳐 그 document를 current view에 반영한다. 최신 pending 선택이 있으면
그 optimistic projection을 유지하고 관찰한 version에서 다음 CAS write를 시작한다. pending이
없으면 관찰한 artifact의 persisted tail로 projection을 닫는다. canonical document도 관찰하지
못했을 때만 마지막 server-confirmed reaction으로 되돌린다. 확인되지 않은 write를 client state로
보존하거나 자동 replay하지 않는다. 늦은 이전 commit은 다음 명시적 선택의 stale-base 응답으로
관찰되며, transport가 같은 최신 payload를 확인된 `reactionVersion`으로 제한적으로 재기반한다.

fetch나 body reader가 abort를 무시해도 deadline Promise는 끝난다. Non-2xx body는 stable
오류 envelope를 읽을 때까지 보존한다. 서버는 매 시도마다 공유 artifact와 현재 viewer의
preference를 다시 읽고 client history를 받지 않는다. 요청은 선택 시점의
`baseReactionVersion`을 싣고, 서버는 `(gap_report_id, viewer_principal_id)` 행의 단조
`reactionVersion`을 CAS로 갱신하며 현재 artifact version을 함께 기록한다. 더 오래된 reaction version에서 시작한
요청은 현재 artifact를 반환한다. transport는 요청 reaction이 history에 이미 있으면 현재
artifact를 채택하고, 아직 기록되지 않은 최신 선택이면 반환된 `reactionVersion`으로 다시
요청한다. `409`는 현재 viewer preference를 한 번 read-back하고 관찰한
`reactionVersion`에서 최신 선택을 새 command로 보낸다. `422`와 그 밖의 terminal 4xx는
read-back이나 같은 payload 자동 반복 없이 실패로 닫는다. DELETE도
`baseReactionVersion`을 요구하므로 늦은 삭제가 최신 PUT을 지우지 못한다. 브라우저 timestamp는
정렬 권위가 아니며 허용된 clock skew를 넘으면 거절한다. 서버가 승인한 요청 순서로 id 중복을
제거하고 최근 100개만 보존한다. mutation은 UUID path와 strict surface를 검증하며,
base version이 current와 같아 실제 write가 가능한 경우 요청 reaction의 timestamp를 제외한
id/title/body/chips/surface가 현재 artifact의 overview/cluster/gap `reactionPreparation` 중 하나와
일치해야 한다. 따라서 현재 viewer는 artifact가 준비한 reaction template과 일치하는 선택만
자신의 preference에 저장할 수 있다. Preference conflict는 최대 4회 재시도한 뒤 `409`로 닫는다. Artifact version이
바뀐 preference는 현재 report reaction으로 합성하지 않는다.

이 viewer-preference persistence 경계에는 다음 경로가 포함되지 않는다.

- route AI comment persistence
- ResearchRoutePayload delete persistence
- PDF fetch
- 일반 ResearchRoutePayload update

기존 gap report DB와 호환 read 경로는 두지 않는다. Migration은 기존 table을 삭제하고
공유 artifact와 viewer preference table을 새로 만들며, 새 생성 경로는 `/gap/:id`의
gap report id만 사용한다.

## 7. 실패와 degrade

- `POST /api/gap-reports`가 non-2xx면 미리 확보한 detached target을 닫고
  출발 ResearchRoutePayload의 gap 생성 pending 상태를 해제한다. 현재 경로에 별도 error surface를
  만들지 않고 생성 실패를 warning log로 남긴다.
- status 응답 payload가 예상 shape이 아니면 status error 문구를 별도로 남긴다.
- task 실패는 pending ResearchRoutePayload title과 progress surface에 반영된다.
- 저장 snapshot에 graph support가 없어도 provider 재호출 없이 기존 citation/semantic 입력으로 build를 계속한다.

status payload가 `ResearchRoutePayload` schema를 통과하지 못하면 `/gap/:id` 화면은 building 상태를
유지하거나 error copy를 표시한다. 재시도는 같은 snapshot key와 `sourcePaperIds`로 다시
`POST /api/gap-reports`를 호출한다.

## 8. Core-first 생성과 enrichment 승격

gap-network 생성 경로는 core build와 narrative enrichment를 분리하지만, normal route의
사용자 대기는 display-ready까지 유지한다. deterministic core는 먼저 같은 ResearchRoutePayload에 저장해
재시도와 조건부 update의 기준으로 쓰고, 고비용 LLM 해석은 POST가 시작한 독립 runner가
같은 ResearchRoutePayload를 업데이트하는 승격 단계로 닫는다. `/gap/:id` 화면과
`GET /api/gap-reports/status`는 저장된 artifact를 읽는 observer이며 provider/LLM/core 계산을
시작하거나 기다리지 않는다.

- **core build**: gap report runner는
  `buildGapNetworkCoreViewPayload`를 사용한다. 현재 입력 snapshot,
  citation/semantic/graph-support edge, cluster, gapPair, metrics, deterministic
  prepared reaction fallback을 저장하고 `metadata.gapNetworkBuild { core: "ready",
  enrichment: "pending", coreEvidence: "citation-semantic-graph-v2" }`를 남긴다. 이
  단계는 narrative/domain/content interpreter를 호출하지 않지만 deterministic semantic
  edge 계산은 core 관계 근거에 포함한다. 관계 근거와 의미 있는 gapPairs가 있는 core
  ResearchRoutePayload는 그래프 화면으로 전환되지 않고 loading 화면에 남으므로 deterministic fallback을
  최종 클릭 설명처럼 보여주거나 owning view reaction에 sync하지 않는다.
- **route completion**: `POST /api/gap-reports`는 pending `gap_reports` artifact와
  durable job state(`gapNetworkBuild.phase`, `attempt`, `leaseExpiresAt`)를 먼저 저장하고
  `after()`에 독립 runner Promise를 맡긴 뒤 202/pending을 반환한다. active lease를 획득하지 못한
  runner 시도는 provider/LLM/core work를 실행하지 않고 종료한다. status polling은 runner가 저장한 상태만
  읽으며 core ResearchRoutePayload가 저장됐다는 사실만으로 completed를 반환하지 않는다. display-ready는 core
  report가 정착되어 있고, terminal empty-state이거나 `gapNetworkBuild.enrichment`가
  `ready`/`failed`로 닫힌 상태다. core/build/persist 실패 marker가 저장되면 status는
  `failed`로 닫아 observer-only polling이 무한 pending으로 남지 않게 한다. Transient
  blank report처럼 입력 snapshot/metrics가 비어 있어 core-ready로 볼 수 없는
  경우, 또는 relationship/gap-bearing core가 enrichment pending인 경우 `/gap/:id`는
  같은 report id에서 building/loading 상태로 남는다. 이 상태는 연결 근거 부족으로 닫지
  않는다. core failed marker가 있는 같은 snapshot POST는 response 전에 row를 `pending`/`queued`로
  되돌린 뒤 runner를 schedule해 status polling이 retry intent를 과거 failed row로 닫지 않게 한다.
  complete phase가 남아 있어도 current core evidence가 아닌 no-gap marker는 재사용하지 않고
  새 build attempt를 잡을 수 있다.
- **terminal empty-state**: core report가 정착된 뒤 `totalEdgeCount = 0`이거나 의미 있는
  `gapPairs`가 없으면 ResearchRoutePayload는 연결 근거 부족 또는 뚜렷한 공백 후보 없음 상태로 닫힌다.
  이 상태는 정상 리포트로 곧 교체될 pending 상태가 아니므로 `해석 보강 중`이나 하단
  본문 보강 진행 상태를 표시하지 않고 runner enrichment 단계도 시작하지 않는다.
- **enrichment**: 독립 runner는 관계 근거와 gap 후보가 있는 core-ready ResearchRoutePayload를
  관측하면 저장된 core payload를 `buildGapNetworkEnrichedViewPayloadFromCore`에 넘겨
  domain label, cluster/gap prose, content narrative, enriched prepared reactions를
  같은 route payload id에 업데이트하고
  version 조건부 update로 `metadata.gapNetworkBuild.enrichment = "ready"`로 승격한다.
  이 단계는 `buildGapNetworkViewPayload`로 core를 다시 만들지 않고, 저장된 clusters/gapPairs/metrics를
  enrichment 입력으로 재사용한다.
  cluster narrative와 hypothesis는 먼저 같은 base report를 만들고, 이후 gap-pair
  narrative 해석과 domain/content narrative 체인은 병렬로 시작한다. Domain label은 content
  narrative보다 먼저 필요하므로 그 체인 내부 순서는 유지하지만, gap-pair prose는 domain/content
  prose를 기다리지 않고 진행한다.
  다섯 enrichment interpreter는 query·cluster label·concept·대표 논문 제목/초록을
  prompt 전용 UTF-8 field budget으로 먼저 투영하고, 정확히 직렬화된 최종 prompt를 공통
  structured-generation gateway가 64 KiB ceiling으로 다시 검사한다. ceiling과 호출별
  output token cap은 `app/server/services/knowledge-map/gap-network-prompt-budget.ts`가
  소유한다. 최종 prompt가 ceiling을 넘으면 gateway는 provider를 호출하지 않고 오류를
  반환하며, 각 interpreter의 기존 `onError: "fallback"` 경로가 deterministic core와
  gap별 fallback prose를 유지한다. fallback도 prompt와 같은 field projection을 거쳐 raw
  oversized label·concept·title·query를 artifact에 다시 싣지 않는다. 각 interpreter의
  structured generation deadline은 10초다. 첫 hypothesis/cluster wave와 뒤의 gap prose 및
  domain→content branch를 합친 enrichment critical path는 최대 30초여서 route 60초와 DB
  attempt lease 70초 안에 persist headroom을 남긴다. usage event에는 raw prompt 대신
  `promptBytes`, `timeoutMs`, `maxInputBytes`만 기록한다.
  cluster prepared reaction body도 LLM cluster narrative를 담는다. direct URL과 status polling은
  runner가 닫은 terminal marker를 관찰할 때까지 loading 화면을 유지하고, 클라이언트 enrichment
  effect나 별도 public enrichment API로 같은 작업을 대신 실행하지 않는다. Ready 상태가 된 뒤의 cluster/gap 클릭 설명만 owning
  gap route AI comment에 sync된다. 같은 입력의 다른 gap ResearchRoutePayload가 있더라도 요청된 ResearchRoutePayload
  id만 업데이트한다.
- **degrade**: core/build/persist 실패는 같은 ResearchRoutePayload를 row `status: "failed"`와
  `metadata.gapNetworkBuild { core: "failed", enrichment: "failed", phase: "failed" }`로
  닫는다. 같은 snapshot POST는 이 core failure marker를 새 pending attempt로 retry할 수 있다.
  반대로 오래된 attempt가 성공 payload를 뒤늦게 persist하려 하면 runner가 획득한
  `attempt`/`leaseExpiresAt` token이 최신 row와 맞을 때만 version-conflict retry를 허용한다.
  enrichment 요청이 실패해도 core gap_network ResearchRoutePayload는 유지된다. enrichment 실패 marker가
  닫힌 뒤 ResearchRoutePayload는 display-ready가 되고, 사용자는 그래프를 읽을 수 있지만 cluster/gap 클릭
  설명과 하단 본문 리포트는 신뢰 가능한 설명으로 렌더하지 않는다. 서버는 실패한
  enrichment를 같은 ResearchRoutePayload의
  `metadata.gapNetworkBuild.enrichment = "failed"` marker로 닫되, 이미 다른 요청이
  `ready`로 승격한 ResearchRoutePayload는 실패나 pending payload로 되돌리지 않는다.
  client polling은 terminal failed marker를 적용한 뒤 같은 failed document로 polling을 재시작하지 않는다.
  LLM prompt가 64 KiB input ceiling을 넘는 경우는 provider dispatch 전 차단되는 enrichment
  degrade이며 core/build failure로 승격하지 않는다. 해당 interpreter는 deterministic fallback으로
  닫히고 나머지 enrichment branch는 기존 병렬 순서를 유지한다.
- **phase observability**: 현재 영속 phase marker는 `metadata.gapNetworkBuild`가
  담당한다. runner는 `phase`, `attempt`, `leaseExpiresAt`, `phaseDurationsMs`를 같은 metadata에
  기록하고, 새 build는 `core-build`, `persist`, `enrichment` phase 이름을 사용한다.
  과거 저장값의 `graph-support` phase는 read compatibility로만 남으며 새 build가 쓰지 않는다.
  `inline-analysis`는 새 build input 단계가 아니다.
  enrichment-pending no-gap core ResearchRoutePayload에 `coreEvidence:
  "citation-semantic-graph-v2"`가 없으면 현재 deterministic 관계 근거와 sparse
  expected-threshold로 계산된 결과가 아니므로 digest-based ready artifact reuse, status completed,
  viewed analytics 대상으로 취급하지 않는다. viewed event는 최소 진행 화면이 끝나 실제
  report가 보인 뒤 viewer/report identity로 client에서 한 번만 보낸다. 공유 artifact에
  저장된 최초 `sourceSnapshotId` provenance는 현재 viewer의 진입 출처로 발행하지 않는다.
  direct `/gap/:id`는 observer-only로 저장된 artifact를 열되 UI는 stale no-gap
  ResearchRoutePayload를 terminal로 보여주지 않고 pending progress를 유지한다.
  현재 marker가 아닌 `citation-semantic-graph-v1` marker도 stale로 취급한다.

이 구조는 알고리즘 선택을 고정하지 않는다. 최소 하방은 bounded core와 명시적
degrade이고, 상방은 더 좋은 LLM 해석·provider 보조 신호·후속 action으로 연다.

### 사용자별 계산 진입

새 리포트 생성, 실패한 core 계산 복구, 실패한 enrichment 재시도는 report 상태를
확인한 뒤 `lighthouse.gap_build_principal_admissions`의 principal별 짧은 lease를
얻는다. 한 principal에는 active report 하나만 들어간다. 같은 report의 반복 command는
현재 pending 상태를 반환하고 새 token이나 runner를 만들지 않는다. 다른 report가
active이면 command는 `GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT` 429와 `Retry-After`를
반환한다. Status와 `/gap/:id` 조회는 이 lease를 얻지 않는다.

Claim 뒤 report version CAS가 실패하거나 현재 상태가 work를 만들지 않으면 matching
token을 즉시 반환한다. Runner가 시작되면 runner 정착이 반환을 소유한다. Process가
종료돼 반환이 실행되지 못해도 다음 claim은 admission에 결속한 report version보다 나중에
terminal이 된 report가 남긴 token만 한 번 회수한다. 재발급된 admission은 같은 terminal
version을 근거로 다시 탈취할 수 없다. Process loss로 report가 active인 채 멈춘 경우에는 70초 뒤 lease가
만료된다. Report row의 attempt/lease가
계속 결과 commit의 권위이며 principal admission row는 결과나 job 상태를 저장하지
않는다.

운영 기록은 admission outcome, same-report 여부, `Retry-After`, claim/release duration만
남긴다. Principal id, report id, query, prompt, output은 기록하지 않는다.

### PostgreSQL 경쟁 검증

`app/server/repository/__tests__/gap-reports.postgres.integration.ts`는 현재
migration을 적용한 실제 PostgreSQL과 PostgREST를 사용한다. 두 독립 session이
서로 다른 payload로 같은 version을 갱신하면 하나만 성공하고, 패배한 caller는
최신 row를 다시 읽는다. 같은 digest의 두 insert는 DB unique constraint에서
경쟁한 뒤 같은 artifact id로 수렴한다. Pending build의 두 PATCH도 같은 request
barrier를 통과하며 하나의 attempt/lease만 획득한다. 만료 뒤 시작한 새 attempt는
이전 attempt의 늦은 persist를 거부한다.
같은 principal이 서로 다른 두 report를 동시에 claim하면 하나만 admission을 얻고,
다른 principal은 독립 slot을 얻는다. Same-report command는 새 token을 받지 않는다.
Matching token release와 lease 만료 뒤에는 다음 report가 admission을 얻는다.

로컬에서는 다음 순서로 실행한다.

```bash
npx supabase start
npm run db:reset:local
npm run test:db:gap-report-concurrency
```

마지막 명령은 loopback Supabase만 허용하고
`supabase_migrations.schema_migrations`와 저장소 migration 파일의 revision
집합이 정확히 같은지 먼저 확인한다. 테스트는 임의 sleep을 쓰지 않는다. 실행별
namespace와 제한된 cleanup을 사용하고, 실패할 때 session별 결과와 최종 row를
출력한다. PR과 main push에서는 `.github/workflows/quality.yml`의
`db-integration` job이 같은 명령을 blocking으로 실행한다. 이 검증은 lease 만료
전후 계산이 잠시 겹치지 않는다는 exactly-once 실행을 주장하지 않는다. 최신
attempt만 결과를 commit한다는 safety만 검증한다.

## 9. 확인 포인트

관련 구현과 테스트는 다음 위치를 우선 확인한다.

- `app/components/research-route-renderers/search-view-agent-actions.ts`
- `app/components/research-route-renderers/gap-network-view.helpers.ts`
- `app/components/research-route-renderers/GapNetworkView.tsx`
- `app/components/research-route-renderers/gap-reaction-write-coordinator.ts`
- `app/components/research-route-renderers/gap-reaction-write-transport.ts`
- `app/components/research-route-renderers/PendingKnowledgeMapViewState.tsx`
- `app/components/research-route-renderers/gap-network-report-status-polling.ts`
- `app/api/gap-reports/route.ts`
- `app/api/gap-reports/[id]/reaction/route.ts`
- `app/api/gap-reports/status/route.ts`
- `app/server/domain-access/search-backed-view-access.helpers.ts`
- `app/server/repository/__tests__/gap-reports.postgres.integration.ts`
- `scripts/db-integration/run-gap-report-concurrency.ts`
- `app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx`
- `app/(research)/__tests__/document-routes.test.tsx`
- `app/api/gap-reports/__tests__/route.test.ts`
