---
id: promise:graph-neighbor-papers
slug: graph-neighbor-papers
title: 그래프로 이어진 관련 논문
moment: moment:paper-led-followup-discovery
lane: search
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:first-paint-persistence-independence
  - aspect:search-first-url-model
  - aspect:visible-explanation-sufficiency
  - aspect:provider-failure-degraded-mode
  - aspect:paper-card-list-windowing
  - aspect:paper-card-presentation-consistency
  - aspect:paper-card-action-loading-feedback
  - aspect:immediate-navigation
  - aspect:knowledge-map-followup-surface
  - aspect:route-view-ai-reaction-rules
  - aspect:route-view-ai-comment-generation-routing
  - aspect:document-content-width-governance
  - aspect:ai-comment-research-term-suggestions
  - aspect:progressive-content-spatial-stability
acceptanceChecks:
  - acceptance-check:graph-neighbor-papers-two-axes-separated
  - acceptance-check:graph-neighbor-papers-adjacency-count-shown
  - acceptance-check:graph-neighbor-papers-seed-excluded
  - acceptance-check:graph-neighbor-papers-graph-failure-degraded
  - acceptance-check:graph-neighbor-papers-paginated-window
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
  - acceptance-check:graph-neighbor-papers-keyword-click-feedback
  - acceptance-check:graph-neighbor-papers-card-data-hydration
  - acceptance-check:graph-neighbor-papers-search-card-entry
  - acceptance-check:graph-neighbor-papers-immediate-navigation
  - acceptance-check:graph-neighbor-papers-search-first-seed
  - acceptance-check:graph-neighbor-papers-gap-surface
  - acceptance-check:graph-neighbor-papers-reaction-own-view
  - acceptance-check:graph-neighbor-papers-seed-title-card-pinned
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 그래프로 이어진 관련 논문

## Promise

검색 결과나 논문 카드에서 `비슷한 논문`을 고르면, 그 논문과 자주 함께 인용되는
논문과 같은 참고문헌 토대를 공유하는 논문을 전용 ResearchRoutePayload의 두 축으로 본다. 사용자는 키워드를
다시 만들지 않고도, 분야가 그 논문 곁에서 무엇을 함께 읽고 어떤 토대 위에
서 있는지로 다음 읽기 후보를 넓힌다. 각 후보에는 출발 논문과 몇 번 함께
인용됐는지, 또는 참고문헌을 몇 개 공유하는지가 근거 수치로 붙어, 왜 곁에
놓였는지 바로 읽힌다.

이 약속은 직접 인용(선행·후속)을 보여주는 인용 계보와 다르다. 그래프 관계는
인덱싱된 참고문헌 목록에 의존하지 않으므로, 선행 인용 데이터가 부실한 분야
에서도 관련 논문을 복원한다. 함께 인용되는 논문은 분야가 곁에서 함께 읽는
정전을, 같은 토대를 공유하는 논문은 같은 가정 위에 선 최신 연구를 끌어온다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:graph-neighbor-papers-two-axes-separated

- description: 출발 논문의 비슷한 논문 route view에 `함께 인용되는 논문`(co-citation)과 `같은 토대를 공유하는 논문`(bibliographic coupling)을 분리된 두 섹션으로 보여준다. 각 섹션은 자기 라벨로 어떤 관계인지 드러낸다. 본문은 다른 연구 route와 같은 읽기 rail 안에서 중앙 정렬되고, 별도 좌우 rail을 겹쳐 읽기 폭을 불필요하게 좁히지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-adjacency-count-shown

- description: 각 후보에 출발 논문과의 공동 인용 횟수(co-cited) 또는 공유 참고문헌 수(coupled)를 근거 수치로 함께 보여줘, 왜 곁에 놓였는지 같은 자리에서 읽힌다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-seed-excluded

- description: provider가 출발 논문 자체를 이웃으로 돌려줘도 두 축 어디에도 넣지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-graph-failure-degraded

- description: graph discovery 호출이 실패하면 graph-backed 비슷한 논문 ResearchRoutePayload에서 침묵하는 빈 화면이 아니라 "지금 비슷한 논문을 불러오지 못했다"는 degraded 안내와 결정적(deterministic) 재시도 수단을 보여 준다. 인용 관계 ResearchRoutePayload는 그래프 축 degraded/empty 상태를 렌더하지 않고 계보 본체(선행·후속)만 유지한다. 두 축을 시도했으나 결과가 실제로 비면 비슷한 논문 ResearchRoutePayload에서는 degraded 안내가 아니라 정직한 부재 문장을 보여줘, 사용자가 "일시 오류"와 "관련 논문 없음"을 구분한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:graph-neighbor-papers-paginated-window

- description: 함께 인용되는 논문과 같은 토대를 공유하는 논문 두 축은 각각 처음 일부만 보이고, 나머지는 더보기로 펼친다. 각 축은 처음 10편을 보여주고, 더보기를 누르면 같은 축 안에서 10편씩 추가로 드러난다. 더보기 버튼에는 지금 보이는 편수와 전체 편수가 `(보임/전체)` 형태로 붙어, 사용자가 얼마나 더 남았는지 바로 읽는다. 한 축의 더보기는 그 축에만 적용되고 다른 축의 노출 범위를 바꾸지 않는다. 후보가 10편 이하인 축에는 더보기 버튼이 나타나지 않는다. 각 후보 위의 근접도 수치 chip은 그대로 유지된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-neighbor-card-action-parity

- description: 두 그래프 축(함께 인용·같은 토대)과 인용 계보 본체(선행·후속) 카드는 검색 결과 카드와 같은 후속 액션 세트를 노출한다 — PDF 열기, 인용 계보 열기, 비슷한 논문 찾기, 인라인 분석의 `다른 입장` 검색. 사용자는 그래프 이웃에서 곧장 그 논문의 인용 계보를 다시 펼치거나 유사 논문 검색·다른 입장 검색으로 탐색을 이어갈 수 있고, 검색 결과에서 하던 것과 같은 방식으로 다음 읽기를 넓힌다. 근접도 수치 chip은 그대로 유지된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:graph-neighbor-papers-keyword-click-feedback

- description: 비슷한 논문의 co-cited/coupled 반복 카드에 표시되는 저자명·인라인 주제·`다른 입장` 후보와 route AI comment의 연구 용어는 같은 search-term handler를 쓴다. plain click은 목적지 응답 전 출발 graph-neighbor view가 남아 있는 동안 선택 query의 짧은 수신 상태를 현재 scroll viewport에 즉시 표시하고 기존 축·카드를 유지한다. 목적지 route 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. Ctrl/Cmd/가운데 클릭은 같은 entry URL을 새 탭에서 열고 현재 창의 route·graph-neighbor ResearchRoutePayload·수신 상태를 바꾸지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:graph-neighbor-papers-card-data-hydration

- description: 그래프 이웃 API가 반환한 co-cited/coupled 경량 후보는 비슷한 논문 route를 빠르게 열 수 있도록 먼저 route result로 렌더된다. 이때 반복 논문 카드는 검색 결과와 같은 `SearchResultItem`을 쓰고 `cardDataHydration.status = pending` 동안 `paper detail hydration frame`을 같은 카드 골격 안에서 보여준다. 이 frame은 `논문 정보 보강 중`, `저자·초록 보강`, `분석 입력 보강`으로 카드 재료 보강 상태를 이름 붙인다. 목적지 route에서 경량 그래프 ResearchRoutePayload가 열린 뒤 background hydrate route로 batch metadata hydration을 요청해 abstract, venue, fields, open access/PDF, external ids 같은 카드 재료를 채우고 `ready`로 교체한다. Batch hydration이 실패해도 그래프 ResearchRoutePayload 전체를 실패시키지 않고 경량 후보를 유지하되, 사용자는 세부 정보가 준비 중이거나 준비 완료된 상태를 같은 반복 카드 계약 안에서 읽는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:graph-neighbor-papers-search-card-entry

- description: 검색 결과 카드의 action row에서 `비슷한 논문` 진입점은 provider paper reference가 있는 논문에 대해 graph-backed 비슷한 논문 ResearchRoutePayload를 연다. 사용자는 인용 계보를 거치지 않고도 검색 결과에서 직접 그 논문의 그래프 인접(함께 인용되는 논문·같은 토대를 공유하는 논문) 두 축을 route-owned ResearchRoutePayload로 연다. 이 진입은 기존 키워드 prefill 유사검색을 대체하는 우선 경로이며, provider reference가 없는 legacy seed처럼 그래프를 만들 수 없는 경우에만 기존 검색 prefill fallback을 남긴다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:graph-neighbor-papers-immediate-navigation

- description: 검색 결과나 논문 카드에서 `비슷한 논문`(provider-reference seed)을 클릭하면 provider 실행 완료를 기다리지 않고 즉시 목적지 seed route(`/similar?seedPaperId=...`)로 이동한다. plain click은 현재 브라우저 route를 목적지로 바꾸고, Ctrl/Cmd/가운데 클릭(detached)은 같은 seed URL을 새 브라우저 탭에서 열며 현재 브라우저 route와 출발 ResearchRoutePayload 상태는 바꾸지 않는다. 목적지 route는 URL seed로 provider를 실행해 같은 URL에서 경량 그래프 이웃 ResearchRoutePayload를 렌더하고, 카드 상세 hydrate는 첫 paint 뒤에 이어진다. 실패하면 목적지에서 통일 degraded 안내와 재시도를 보여 준다. `graph_neighbors_opened` route AI comment generation은 클릭이 아니라 목적지 route bootstrap이 단일 source로 현재 destination ResearchRoutePayload를 target한다. Provider reference가 없는 legacy seed는 이 경로 대신 기존 키워드 search prefill fallback을 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-search-first-seed

- description: 비슷한 논문 seed route는 source route payload id를 carry하지 않고, seed paper의 identity/display context(`seedPaperId`, `seedPaperTitle`, optional year/url/citationCount`)를 URL 조건으로 운반한다. 목적지 server route는 owned source ResearchRoutePayload를 읽지 않고, 같은 seed의 persisted `graph_neighbors` resource로 redirect하지 않으며, seed URL에서 복원한 논문만으로 provider 실행을 시작한다. destination route payload id는 client-only ephemeral id라 URL sync가 `/similar/:id`로 승격하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-gap-surface

- description: 비슷한 논문 route view는 그래프 후보가 1편 이상이면 ResearchRoutePayload 상단 AI comment 영역에 host-owned `연구 공백 지도 만들기` action을 노출한다. 이 진입점은 LLM AI 반응 surface가 아니라 비슷한 논문 route host가 소유하므로(`aspect:knowledge-map-followup-surface`) body-only AI 반응에서도 빠지지 않는다. 클릭하면 seed 논문 자체가 아니라 현재 route view가 모은 그래프 후보 전체와 co-cited/coupled shared-count 근거를 snapshot 입력으로 기존 gap network 파이프라인에 보내 새 창으로 시작한다. 서버 gap-network 경로는 source id reload 없이 이 visible snapshot을 분석 입력으로 사용한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:graph-neighbor-papers-reaction-own-view

- description: 비슷한 논문 ResearchRoutePayload가 생성·재사용되어 lightweight graph 후보를 먼저 열면 AI comment pending 상태를 표시하되, `graph_neighbors_opened` provider generation은 `cardDataHydration`의 저자 등 관계 comment 단서 보강 시도가 terminal `ready`로 닫힌 route bootstrap에서 그 view id를 target으로 한 번만 발화한다. 보강에 성공하면 현재 저자를 관계 snapshot에 포함하고, 보강이 실패해도 유지된 lightweight 후보 근거로 한 번만 생성한다. 생성/reuse 경로는 route bootstrap을 단일 generation source로 두고, route bootstrap이 없는 degraded force-refetch swap만 교체된 view id로 직접 큐잉한다. 따라서 비슷한 논문 ResearchRoutePayload는 이전 검색 ResearchRoutePayload의 AI 반응을 상속하지 않고, hydration 전후 두 comment를 만들지 않으며, 자기 view의 ready reaction snapshot/history에만 AI comment를 받는다. 연구 공백 진입은 그 route host의 `연구 공백 지도 만들기` action이 담당한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:graph-neighbor-papers-seed-title-card-pinned

- description: 비슷한 논문 ResearchRoutePayload는 본문 최상단에 출발 논문의 sticky context header를 항상 고정한다. 이 헤더는 view가 어떤 논문 곁에서 열린 그래프 관계인지 제목, 저자, 연도, 인용 수와 짧은 안내로 드러내며, co-cited/coupled 축·빈 결과·provider degraded 안내보다 먼저 렌더되고 스크롤 중에도 상단에 남는다. 출발 논문은 후보 축에서는 제외되지만, 사용자가 "무엇과 비슷한 논문인가"를 잃지 않도록 ResearchRoutePayload context header에서는 사라지지 않는다. 이 header는 반복 후보 리스트 카드와 다른 배경형 문법을 써서 첫 번째 후보 카드처럼 보이지 않아야 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
