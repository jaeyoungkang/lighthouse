---
id: promise:gap-network-detection-from-search
slug: gap-network-detection-from-search
title: 검색 결과에서 연구 공백을 찾는다
moment: moment:gap-analysis-from-results
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:search-first-url-model
  - aspect:immediate-navigation
  - aspect:ai-generated-content-feedback
  - aspect:knowledge-map-followup-surface
  - aspect:provider-failure-degraded-mode
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:gap-build-principal-admission
intentChecks:
  - intent-check:cluster-narrative-describes-research-work
  - intent-check:representative-papers-show-cluster-grain
  - intent-check:adjacency-shows-network-position
acceptanceChecks:
  - acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
  - acceptance-check:gap-network-detection-from-search-top-result-input-set
  - acceptance-check:gap-network-detection-from-search-cluster-gap-pipeline
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
  - acceptance-check:gap-network-detection-from-search-progress-staged-pacing
  - acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render
  - acceptance-check:gap-network-detection-from-search-cluster-size-encoding
  - acceptance-check:gap-network-detection-from-search-layout-permutation-invariance
  - acceptance-check:gap-network-detection-from-search-citation-source
  - acceptance-check:gap-network-detection-from-search-citation-source-quality-parity
  - acceptance-check:gap-network-detection-from-search-graph-neighbor-source
  - acceptance-check:gap-network-detection-from-search-analysis-input-visible
  - acceptance-check:gap-network-detection-from-search-analysis-input-cap
  - acceptance-check:gap-network-detection-from-search-research-term-nodes
  - acceptance-check:gap-network-detection-from-search-principal-build-limit
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/417#issuecomment-5263034382
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/684#issuecomment-5434916090


# 검색 결과에서 연구 공백을 찾는다

## Promise

사용자가 검색 결과 기준 row 우측의 `연구 공백 지도 만들기`를 선택하면, Light House는
검색 결과 논문들을 클러스터로 묶고 클러스터 사이의 연결이 약한 지점을 저장된 gap
report로 만든다. 사용자는 결과 논문들이 어떤 연구 묶음으로 나뉘는지 보고,
새 연구 질문 후보가 될 만한 공백을 검토한다.

## Intent Checks

### intent-check:cluster-narrative-describes-research-work

- question: 이 군집이 실제로 어떤 연구 작업을 수행하는지 드러나는가 — 라벨·키워드 나열 수준을 넘어서?
- evidence: live judge @ `app/server/services/__tests__/cluster-card-intent-qualitative.live.test.tsx`
- why live judge: pipeline이 narrative 문장까지 생성하는 층(AC2 boundary)과 그 narrative가 키워드 나열이 아닌 실제 연구 작업 서술인지(AC4 boundary 너머 LLM 창발)는 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-network-detection-from-search-cluster-gap-pipeline
  - acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render
- answer criteria: narrative 1문장이 군집 논문들이 공통으로 수행하는 연구 작업을 명사구·동사구 수준으로 서술해야 한다. 단순 키워드 나열("topic: X, Y, Z")이나 label/concept 나열에 그치면 Intent 미달성.

### intent-check:representative-papers-show-cluster-grain

- question: 이 군집의 결을 감지할 수 있는 구체적 대표 논문이 제목 수준으로 제공되는가?
- evidence: live judge @ `app/server/services/__tests__/cluster-card-intent-qualitative.live.test.tsx`
- why live judge: AC2가 `topPaperIds` 계산을 deterministic하게 닫지만, 선택된 1~2편이 사용자에게 "이 군집의 결을 대표한다"로 읽히는지는 제목 가독성·대표성 품질의 창발이다.
- linked acceptance checks:
  - acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render
- answer criteria: representative-papers 영역이 표시되는 경우 1~2편의 논문 제목이 단순 ID/truncate 없이 식별 가능한 제목으로 표시되고, 그 제목들이 같은 연구 결의 sample로 읽혀야 한다. 공간이 부족하거나 제목 매핑이 없으면 이 영역은 생략 가능하다.

### intent-check:adjacency-shows-network-position

- question: 선택한 군집 설명이 실제 concept와 대표 논문 근거로 충분히 풍부해지는가?
- evidence: live judge @ `app/server/services/__tests__/cluster-card-intent-qualitative.live.test.tsx`
- why live judge: AC2의 concept/topPaper 계산은 deterministic이지만, 선택한 cluster 카드가 그 근거를 사용해 라벨 반복을 넘어 연구 작업 설명을 풍부하게 만드는지는 narrative와 근거 조합의 품질 창발이다.
- linked acceptance checks:
  - acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render
- answer criteria: 카드에는 핵심 concept 또는 대표 논문 제목 같은 실제 시스템 근거가 포함되어야 하며, 별도 keyword-relations 연결 목록은 표시하지 않는다. 가장 가까운 공백 라벨도 표시하지 않아야 한다.

## Acceptance Checks

### acceptance-check:gap-network-detection-from-search-entry-from-ai-comment

- description: 검색 결과 기준 row 우측의 `연구 공백 지도 만들기` action으로 시작 가능하다. 이 action은 필터/정렬 컨트롤 줄, 검색 메타, AI comment frame, 연구 용어 목록 안에 배치하지 않고 새 창으로 gap report를 연다. 클릭 직후 detached 창은 `about:blank` 같은 브라우저 빈 문서가 아니라 Light House가 소유한 `/gap?opening=1` 연결 route를 즉시 표시한다(aspect:immediate-navigation). 서버는 core 계산을 기다리지 않고 pending gap report id를 먼저 저장해 반환하며, 같은 target을 `/gap/:id`의 단일 리포트 생성 프로그레스 화면으로 이동한다. 새 창을 연 뒤 사용자가 앱 안에서 출발 검색 화면을 떠나도 새 창의 생성은 계속된다. 출발 검색 화면이 남아 있는 동안에는 생성 중 상태를 표시해 중복 실행을 막고, 생성이 걸리는 동안 현재 검색 route와 출발 ResearchRoutePayload 상태는 바꾸지 않는다. 이 보장은 앱 안의 route 이탈과 화면 수명에 한정하며, 브라우저 창 종료·새로고침·네트워크 실패 뒤의 복구까지 뜻하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:gap-network-detection-from-search-top-result-input-set

- description: 검색 결과 화면에서 `연구 공백 지도 만들기`를 누르면 분석 입력은 AI comment 입력이나 현재 보이는 10편만이 아니라, 현재 정렬·연도·facet 조건이 적용된 검색 결과 풀의 순서를 유지한 상위 40편이다. 대표 논문 표시 필터는 화면의 카드만 좁히며 분석 입력을 대표 카드 subset으로 줄이지 않는다. 공유 리포트 입력에는 저장 여부나 개인 인라인 분석 같은 viewer-private 정보를 포함하지 않는다. 같은 화면 식별자를 썼더라도 실제 정규화된 논문 입력이 다르면 기존 리포트를 재사용하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-cluster-gap-pipeline

- description: 분석은 논문을 연구 묶음으로 나누고 묶음 사이의 연결이 기대보다 약한 지점을 대표 공백 후보로 정리한다. 첫 검색 결과에 관계 근거가 함께 있었다면 이를 인용·의미 근거를 대체하지 않는 보조 신호로만 사용한다. 근거량이 적어도 실제 연결이 있으면 낮은 근거량 후보로 표시하고 곧바로 "공백 후보 없음"으로 단정하지 않는다. 관계 근거가 0건이면 계산된 묶음을 공백 판단으로 신뢰하지 않고 전체 논문 수·관계 근거 수·초록 보유 수를 밝히는 근거 부족 상태로 닫는다. 아직 계산이 정착하지 않은 빈 결과는 이 terminal 상태가 아니라 진행 중 상태로 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:gap-network-detection-from-search-result-saved-gap-view

- description: 생성 요청은 결과 계산을 기다리지 않고 저장된 `/gap/:id`를 먼저 마련하며, 그 화면은 같은 리포트의 준비 단계를 보여준다. 실행이 중단되거나 오래 멈추면 같은 리포트에서 복구를 요청하되 중복 실행이 서로 다른 결과를 쓰지 못하게 한다. 입력과 핵심 관계 계산이 정착하기 전에는 완료 리포트로 보이지 않고, 핵심 계산 실패는 무한 진행이 아니라 terminal 실패로 닫힌다. 관계 근거가 없거나 의미 있는 공백 후보가 없는 정상 종료는 추가 해석을 기다리는 것처럼 보이지 않는다. 의미 있는 후보가 있으면 본문 해석까지 성공 또는 실패로 닫힌 뒤 리포트를 공개하며, 해석이 실패해도 사용자는 같은 `/gap/:id`에서 핵심 근거를 담은 degraded 리포트를 읽을 수 있다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 9

### acceptance-check:gap-network-detection-from-search-principal-build-limit

- description: 한 사용자가 이미 Gap 계산을 진행 중이면 같은 리포트의 반복 요청은 새 계산을 만들지 않는다. 다른 리포트의 새 생성이나 실패한 핵심 계산의 재시도도 시작하지 않는다. 새 창에서 요청한 작업이 거부되면 사용자는 현재 계산이 끝난 뒤 다시 시도해야 함을 그 창에서 이해할 수 있다. 저장된 리포트와 진행 상태를 읽는 행동은 계속 허용되며, 진행 중인 계산이 끝나거나 중단된 뒤에는 다른 리포트의 계산을 시작할 수 있다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:gap-network-detection-from-search-progress-staged-pacing

- description: gap report 생성 진행 화면은 관찰 가능한 build phase가 coarse하고
  deterministic core가 짧은 시간에 정착하므로, 화면 단계 전환을 raw phase에 1:1로
  묶지 않는다. 대신 client가 소유한 애니메이션 시계가 최소 노출 간격(min-dwell)으로
  수집→보강→군집→분석→해석 단계를 순서대로 보여준다. 새로 생성 중이던 report는
  core나 enrichment가 빨리 끝나 display-ready가 되어도 최소 노출 시간이 지나기
  전에는 그래프 리포트로 전환하지 않고 같은 진행 애니메이션 화면을 유지한다. 따라서
  빠르게 끝나거나 관계 근거가 부족한 terminal empty-state 생성도 첫 단계만 반짝
  보이고 completed로 점프하지 않는다. 다만 terminal empty-state는 그래프가 아니라
  짧은 근거 부족 안내를 보여주므로, 의미 있는 공백이 있는 리포트보다 더 짧은 최소
  노출 시간으로 먼저 공개한다. enrichment가 오래 걸리는 동안에는 진행 화면이
  해석 단계에 머문다. 이미 display-ready인 report를 다시 여는 재오픈 경로는 이 최소
  노출 지연을 적용하지 않고 즉시 리포트를 보여준다. terminal failed 빌드는 진행
  바를 첫 단계에 멈춰 가짜 완료로 진행하지 않는다(무한 진행으로 남지 않는다). 이
  페이싱은 진행 표시의 진실성을 지키되 (실제로 시작하지 않은 후속 단계를 완료로
  위장하지 않는다) 사용자가 생성 단계를 읽을 수 있게 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render

- description: 선택한 클러스터 설명은 그래프 옆 side-panel에 카드 형태로 렌더된다. `kicker` "선택한 클러스터" / `meta` 논문 수 / `body` LLM narrative에 핵심 concept·대표 논문 근거를 녹인 풍부한 설명 / 선택적 `representative-papers` 대표 논문 1~2편으로 구성된다. 별도 `keyword-relations` 목록과 가장 가까운 공백(`adjacency`) 문구는 표시하지 않는다. concept 노드와 클러스터 내부 링크는 D3 force-directed layout으로 배치되고 생동감 있는 시각 상태를 유지한다. **카드는 SVG 외부 panel에 위치하므로 카드가 그래프를 가리지 않는다 — 이 위치 분리 덕분에 SVG는 카드를 위해 공간을 비울 필요 없이 선택된 cluster로 또렷이 줌인할 수 있다.** cluster나 concept를 클릭하면 SVG는 선택된 cluster의 hull로 중심을 잡고 자동 줌인한다. focus viewBox는 base 너비의 46~62% 사이로 좁혀져 선택 cluster가 화면 중앙에 크게 표시되고, 다른 cluster들은 viewBox 가장자리에 부분적으로 또는 dim 상태로 남아 사용자가 주변 cluster 맥락을 잃지 않는다. 사용자는 선택한 cluster의 키워드를 크게 읽으면서도 카드를 동시에 읽을 수 있다 — image 10(gap focus)과 같은 시각적 강도로 작동한다. gap 노드/링크를 클릭하면 두 클러스터와 gap label로 자동 줌인하며, 이 viewBox도 같은 정책(46~48% 캡)으로 잡힌다. 배경 클릭 시 선택이 해제되고 base auto-fit viewBox로 복귀한다. 클러스터 관계별 gap 노드/링크는 계속 표시되고 클릭 가능한 gap 설명 진입점으로 동작한다. 단, core report가 정착된 뒤 `metadata.gapNetworkReport.metrics.totalEdgeCount`가 0이면 concept cluster hull, cluster label, gap node/link, side-panel 카드 전체를 렌더하지 않고 전체 논문 수 / 초록 보유 논문 수 / 관계 근거 0건을 밝히는 연결 근거 부족 상태만 표시한다. 또한 연결이 있더라도 군집 사이에서 기대보다 부족한 연결이 뚜렷하게 드러나지 않아 gapPairs가 비어 있으면, concept cluster hull, cluster label, gap node/link, side-panel 카드, 캔버스 오버레이 메시지를 모두 렌더하지 않고 전체 논문 수 / 관계 근거 수와 후속 단서를 같은 가독성 본문 글자 크기로 설명하는 빈 공백 후보 상태만 표시한다 — 작은 캔버스 오버레이로 "뚜렷한 공백 후보 없음" 같은 문구를 표시하지 않는다. flow/pulse 같은 과한 인터페이스 연출 효과는 비활성화한다. 그래프 자체에는 분야명 chip·계산 방법 설명·query 도입 단락 같은 prose 헤더가 노출되지 않는다 — 분야명은 `promise:gap-report-prepared-reaction#acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback`가, 공백 추론 방법은 `promise:gap-report-prepared-reaction#acceptance-check:gap-report-prepared-reaction-metadata-content-narrative`이 노출한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:gap-network-detection-from-search-cluster-size-encoding

- description: 정상 분석 graph의 base view에서 cluster의 시각적 footprint와 표시 concept node 수는 `GapNetworkCluster.paperCount`의 상대 크기를 반영한다. 분석기는 모든 cluster를 같은 concept cap으로 맞추지 않고, 작은 paperCount cluster의 표시 concept node 수를 paperCount 이하로 제한한다. 따라서 20편 안팎을 품은 cluster는 4편 안팎의 cluster보다 더 많은 concept node와 더 큰 hull footprint를 갖고, 사용자는 많은 논문이 다룬 연구 묶음과 적은 논문이 포함된 묶음을 즉시 구분할 수 있다. 이 인코딩은 concept node radius의 concept score 의미를 바꾸지 않고 node 개수와 cluster hull에만 적용되며, 모든 cluster의 paperCount가 같으면 기존 균형 크기를 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:gap-network-detection-from-search-layout-permutation-invariance

- description: Gap Network의 node와 edge 집합이 같으면 입력 배열 순서가 달라도 같은 cluster anchor와 concept 좌표를 보여 준다. label이 같은 두 cluster의 좌우 위치는 stable id로 결정한다. layout은 graph 입력을 받는 기존 presentation 경계에서 node와 edge 순서를 stable identity로 정규화하며, upstream 생성 순서를 별도 제품 계약으로 요구하거나 upstream과 layout 양쪽에 중복 ordering owner를 두지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:gap-network-detection-from-search-citation-source

- description: 인용 계보 ResearchRoutePayload에서 사용자는 ResearchRoutePayload 상단 AI comment 영역의 host-owned `연구 공백 지도 만들기` action을 통해 그 문서가 모은 선행 연구(references)와 후속 연구(citations) 묶음 전체를 입력으로 기존 `gap_network` 파이프라인을 시작할 수 있다. 이 액션은 새 분석 기능을 만들지 않고 `gap_network` 파이프라인을 재사용하며, 입력은 인용 계보 ResearchRoutePayload 본문에 그대로 보이는 선행+후속 합집합 snapshot이다. ResearchRoutePayload 본문에는 별도 `인용 관계로 공백 찾기` 버튼을 두지 않는다. 합집합 정책은 클라이언트의 host-owned `연구 공백 지도 만들기` action(`citation-lineage-agent-actions.ts`)과 실제 분석을 수행하는 서버 측 준비 단계가 같은 의미를 공유한다. 한 경로라도 후속만 좁히면 사용자가 본 묶음과 실제 분석 입력이 어긋나므로, references listed first then citations, single-direction fallback when one side is empty, and empty-input action hiding all stay invariant. `POST /api/gap-reports`는 이 snapshot을 받아 gap report id를 만들고, 클라이언트는 `/gap/:id`를 새 detached 창으로 열어 출발 인용 계보 route를 끊지 않는다. 서버는 source citation-lineage/search 문서를 다시 읽지 않고 요청의 share-safe snapshot으로 생성·build를 닫으며, versioned content digest로 creator와 무관하게 dedupe한다. Status와 direct read는 인증 가입자가 artifact id로 관찰한다. Episteme search/batch hydration은 adjacency list를 search result에 실어 보내지 않으므로, gap-network는 없는 adjacency를 "관계 없음"으로 해석하지 않고 ResearchRoutePayload metadata에 보존된 availability/truncation metadata를 제한 상태로 다룬다. 사용자에게는 입력 분해가 함께 보인다. citation_lineage source일 때 `gap_network` metadata의 `sourceCitationLineageBreakdown`에 `{references, citations}` 편수가 저장되고, 빈 상태 메시지(연결 근거 부족 / 뚜렷한 공백 후보 없음 두 곳)에 "이 입력은 선행 N편과 후속 M편을 합한 것입니다" 한 줄이 추가되어 사용자가 화면 안에서 입력 출처를 바로 따라갈 수 있다 (aspect:visible-explanation-sufficiency). 후속만 입력으로 좁히는 옛 정책은 사용자가 보이는 묶음 중 절반만 분석에 쓰이는 단절을 만들었기 때문에 회수했다. 생성된 gap report는 versioned source-input digest와 snapshot metadata로 입력 출처를 보존한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-citation-source-quality-parity

- description: `citation-source` AC가 약속한 제한 상태 보존 invariant를 deterministic test로 잠근다. 동일 논문이 최초 검색 결과와 상세 보강을 차례로 통과해도 공통 논문 identity가 바뀌지 않아야 한다. lazy citation 경로의 `referenceAvailability` / `citationAvailability` / `truncated` / `reason`은 그대로 유지되며, adjacency 미제공 상태가 false "no relation"으로 변환되지 않아야 한다. production 또는 저장 데이터 consumer가 없는 과거 direct-provider 응답 mapping branch를 호환 경로로 보존하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:gap-network-detection-from-search-graph-neighbor-source

- description: 비슷한 논문(`graph_neighbors`) route view에서 host-owned `연구 공백 지도 만들기` action을 누르면, 클라이언트는 현재 화면의 그래프 후보 snapshot을 gap report 경로에 보낸다. pending 응답과 실제 서버 build path는 같은 query(`비슷한 논문: {seed title}`)와 같은 후보 papers 집합을 사용한다. host-owned action이 현재 graph-neighbor snapshot과 shared-count 근거를 gap builder 입력으로 전달한다. graph-neighbor source는 검색 결과 내부 graph support 재계산 대상이 아니다. 서버는 예약할 때 저장한 share-safe 후보와 co-cited/coupled shared-count graph support만 사용한다. 이 관계 근거는 core gap report에서 0건으로 사라지지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-analysis-input-visible

- description: 사용자는 `gap_network` ResearchRoutePayload가 어떤 입력 표본을 기반으로
  분석되었는지 화면 안에서 확인할 수 있다. 분석 입력 표본 편수(현재
  정렬·필터가 적용된 검색 결과 풀에서 산출된 최대 40편)와 cluster 개수가
  가독성 있는 글자 크기로 노출되어, 사용자가 cluster에 표시되는 노드 수가
  임의 cap이 아니라 입력 표본이 cluster로 나뉜 결과임을 인식할 수 있다. 이
  노출은 정상 분석 상태에 일관되게 보인다. 화면에 표시되는 문장은 "검색 결과
  N편을 M개 cluster로 나눴습니다" 형태로, 다른 axis(예: 검색 결과 화면에서 처음
  보이는 10편과의 비교) 같이 사용자의 cap 오해를 풀지 않는 비교축은 끌어오지
  않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-analysis-input-cap

- description: gap 분석은 검색 결과 전체를 무제한으로 읽지 않고 현재 정렬·필터가
  적용된 검색 결과 풀의 앞에서부터 상위 40편까지만 읽는다. 이 40편 표본이
  클러스터링·gap 파이프라인에 들어가는 검색-source의 유일한 입력이다. 이 상한은
  군집이 의미 있게 갈라질 만큼은 넓고, 표본이 과도해 군집이 흐려지거나 너무 좁아
  관계 근거가 부족한 빈 상태로 떨어지지 않도록 잡은 값이다. 검색 결과 풀이 40편
  미만이면 들어온 풀 전부가 입력이 된다. AI comment 생성 입력 cap이나 화면에
  먼저 보이는 10편 window는 이 분석 입력 상한을 대체하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-network-detection-from-search-research-term-nodes

- description: gap graph cluster labels and concept nodes stay on concrete research terms rather than query-equivalent or broad labels, sharing the same research-term quality boundary as English term discovery.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

## Runtime ownership

Runner, lease, polling, recovery와 core/enrichment 실행 순서는
`docs/runtime-flows/gap-network-analysis.md`가 소유한다.
