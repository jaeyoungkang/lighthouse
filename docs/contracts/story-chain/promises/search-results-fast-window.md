---
id: promise:search-results-fast-window
slug: search-results-fast-window
title: 검색 결과를 AI가 해설해 논문 검토가 빨라진다
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:library-grounded-research
  - aspect:paper-card-list-windowing
  - aspect:paper-card-presentation-consistency
  - aspect:paper-card-action-loading-feedback
  - aspect:document-content-width-governance
  - aspect:ai-comment-research-term-suggestions
  - aspect:common-page-footer
  - aspect:progressive-content-spatial-stability
acceptanceChecks:
  - acceptance-check:search-results-fast-window-initial-dom-window
  - acceptance-check:search-results-fast-window-load-more-shows-progress-counts
  - acceptance-check:search-results-fast-window-inline-analysis-visible-first
  - acceptance-check:search-results-fast-window-card-inspection
  - acceptance-check:search-results-fast-window-expanded-window-persists-per-batch
  - acceptance-check:search-results-fast-window-selected-sort
  - acceptance-check:search-results-fast-window-loading-visible
  - acceptance-check:search-results-fast-window-year-distribution
  - acceptance-check:search-results-fast-window-title-year-summary
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-library-proximity-marker
  - acceptance-check:search-results-fast-window-title-family-dedup
  - acceptance-check:search-results-fast-window-comma-query-single-intent
  - acceptance-check:search-results-fast-window-result-basis-visible
  - acceptance-check:search-results-fast-window-session-principal-handoff
  - acceptance-check:search-results-fast-window-bootstrap-auth-challenge
  - acceptance-check:search-results-fast-window-canonical-production-host
  - acceptance-check:search-results-fast-window-library-bootstrap-outcomes
  - acceptance-check:search-results-fast-window-post-search-layout-about
  - acceptance-check:search-results-fast-window-brand-mark-home-link
  - acceptance-check:search-results-fast-window-reviewed-papers-context-source
  - acceptance-check:search-results-fast-window-doi-exact-lookup
  - acceptance-check:search-results-fast-window-publication-year-range-filter
  - acceptance-check:search-results-fast-window-loaded-result-facet-filters
  - acceptance-check:search-results-fast-window-representative-filter
  - acceptance-check:search-results-fast-window-library-interest-default
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-balanced-basis-order
  - acceptance-check:search-results-fast-window-library-first-response
  - acceptance-check:search-results-fast-window-library-grounding-unavailable
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-unified-result-projection
  - acceptance-check:search-results-fast-window-library-source-sync
requiredEvents:
  - product.research_auth_challenge.viewed
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`

# 검색 결과를 AI가 해설해 논문 검토가 빨라진다

## Promise

검색 결과를 AI가 읽기 쉽게 해설해 논문 검토를 빠르게 만든다.
연구자가 새 연구나 진행 중인 연구에서 먼저 볼 논문을 고르는 시간을 줄인다.

CAIR record: `https://github.com/jaeyoungkang/lighthouse/issues/525#contract-architecture-impact-review`
CAIR record: `https://github.com/jaeyoungkang/lighthouse/issues/419#issuecomment-5140089462`
CAIR record: `docs/runtime-flows/research-route-lifecycle.md#contract-architecture-impact-review`
CAIR record: `https://github.com/jaeyoungkang/lighthouse/issues/677#issuecomment-5421013307`

검색 결과 카드는 논문을 Light House의 내 라이브러리에 추가하거나 해제할 수 있다.
다음 검색은 그때의 내 라이브러리가 제공하는 근접도 신호를 검색어 관련도와 자동으로
함께 반영한다. 검색 결과에서 논문을 추가하거나 해제하는 약속은
`promise:search-result-library-add`가 닫고, 이 Promise는 그 저장 상태가 이후 검색에서
어떻게 보이는지만 설명한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-results-fast-window-initial-dom-window

- description: 제출 직후 초기 DOM에는 정확히 10편이 렌더된다. 일반 키워드 검색에서는 이 10편이 `abstractHydration.status:"pending"`인 lightweight 카드(제목/연도/venue/인용/원문 링크 중심)여도 결과 창으로 인정한다. 11편째부터는 "더 보기" 전까지 DOM에 포함되지 않으며, 로딩 스피너로 대기 화면을 대신 보여주지 않는다. DOI exact lookup처럼 즉시 fully hydrated인 검색은 pending marker 없이 같은 창 규칙을 따른다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-load-more-shows-progress-counts

- description: "더 보기" 버튼은 라벨에 `더보기 (N/M)` 형태로 현재 노출 편수(N)와 총 편수(M)를 함께 표시해 더 볼 수 있음을 시각적으로 구분한다. 클릭 시 다음 10편이 추가되어 N이 +10 증가하며, N === M이면 버튼은 비활성/미표시로 정지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-inline-analysis-visible-first

- description: 인라인 분석은 `abstractHydration.status:"ready"` 이후 현재 검색 결과 window에 렌더된 논문 카드 id만 대상으로 시작된다. 초기 result window 10편은 모두 분석 task 대상이며, 같은 검색 batch 안에서도 `더 보기` 뒤에 숨은 카드는 큐잉하지 않는다. 사용자가 결과 창을 넓혀 추가 카드가 렌더되면 그 추가 window의 카드 id를 분석 task 대상으로 삼는다. 정렬·필터·기준 전환으로 현재 result window에서 빠진 카드는 새 queued 분석 대상에서 제거된다. pending lightweight 결과에서는 abstract 의존 분석과 연구 용어 추출을 시작하지 않는다. AI 검색 반응은 첫 공개의 결과 basis가 잠긴 뒤 발화할 수 있으며, 인라인 분석보다 먼저 시작된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:search-results-fast-window-card-inspection

- description: 각 논문 제목은 가장 강한 식별 텍스트로 남고 그 자체가 별도 버튼이나 외부 링크처럼 보이지 않는다. 카드의 링크·버튼이 아닌 넓은 영역을 누르면 같은 카드 안의 inspection이 열리고, 열린 카드를 다시 누르면 닫힌다. DOI·PDF·인용 관계·비슷한 논문·저자 이름과 저자 펼침·라이브러리 같은 명시적 링크와 버튼은 고유 동작만 수행하며 카드 펼침을 함께 바꾸지 않는다. 접힘 상태를 보여 주는 화살표는 별도 문구 없이 표시하고, 키보드와 보조 기술에서는 같은 화살표 버튼이 펼침/접힘 상태와 접근성 이름을 제공한다. 펼친 inspection은 원문/식별자 링크와 상세 triage 정보를 보여 준다. 원문 링크는 이용 가능한 가장 직접적이고 신뢰할 수 있는 landing page를 우선하고, DOI·arXiv 같은 확인된 식별자 링크와 provider paper page를 순서대로 보완한다. 서버가 결정한 유효한 원문 URL을 클라이언트 inspection이 그대로 사용한다. PDF 버튼은 직접 열 수 있는 open-access PDF URL이 있을 때 활성 상태로 렌더되며, provider가 준 직접 PDF나 확인된 외부 식별자 기반 URL로 보강할 수 있다. PDF 링크가 없을 때는 같은 자리에 `disabled` 상태로 남아 활성/비활성이 시각적으로 구분된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:search-results-fast-window-expanded-window-persists-per-batch

- description: 사용자가 "더 보기"로 검색 결과 창을 확장한 뒤 Moonlight PDF 링크를 새 탭으로 열거나 다른 탭을 오가 검색 ResearchRoutePayload가 다시 mount되어도 같은 결과 batch에서는 확장된 노출 개수가 유지된다. 새 검색 결과 batch로 교체되면 초기 DOM은 다시 정확히 10편에서 시작한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-selected-sort

- description: 사용자가 정렬 기준을 바꾸면 검색 완료 뒤에도 선택한 정렬 기준이 유지되고, 표시 결과는 기본순·인용순·최신순·오래된순 각각의 결정적 순서를 따른다. 기본순은 라이브러리 신호가 있으면 검색어 관련도와 라이브러리 근접도를 함께 반영하고, 신호가 없으면 검색 provider 순서를 따른다. 과거 basis 선택이 남긴 직접 조건 주소의 `sort=relevance`와 `sort=interest`는 모두 현재 기본순으로 정규화하며, 인용순·최신순·오래된순만 명시적인 보조 정렬 입력으로 남는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:search-results-fast-window-loading-visible

- description: 검색 요청이 진행 중이면 route-level 검색 command field는 읽기 전용이 되고, 입력창 자체가 busy 상태임을 드러내는 강조 테두리와 큰 회전 표시를 보여준다. 검색 ResearchRoutePayload 본문은 별도 query 입력을 반복하지 않으며, 결과 refine control 영역에는 "검색 결과를 불러오는 중" 상태만 전달한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-year-distribution

- description: 검색 결과 본문은 논문 리스트를 우선하는 단일 문서 rail 안에서 이어 보여준다. 출판연도 분포는 출판연도 필터 칩 드롭다운 안에서 연도 범위 입력·조건 적용과 구분되는 별도 preview block으로 표시되어, 연도로 결과를 좁히는 맥락에서 드러난다. 분포는 가장 이른 결과 연도부터 가장 늦은 결과 연도까지를 연속 연도축으로 그리고, 사이의 빈 연도는 0건 slot으로 남겨 시간 간격이 결과 분포에 따라 왜곡되지 않게 한다. 각 연도 막대는 hover/focus 시 `{year}년 {count}편`을 낮은 위계의 app-rendered tooltip으로 드러낸다. 분포의 accent 강조는 현재 입력된 출판연도 범위(시작~끝)에 드는 해를 칠해 차트가 그 선택 구간의 미리보기가 되게 한다. 연구 용어 제안은 출판연도 메타가 아니라 AI comment 안의 본문형 링크로 남는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 12

### acceptance-check:search-results-fast-window-title-year-summary

- description: 각 검색 결과 카드는 원문 제목을 가장 강한 첫 줄로 둔다. 논문 출판연도는 제목 옆 배지가 아니라 바로 아래 서지 metadata 행의 첫 항목으로 표시한다. 연도에는 별도 border나 background를 씌우지 않는다. 인라인 분석이 제목 한국어화를 제공해도 검색 결과 카드 본문에는 번역 제목을 별도 줄로 반복하지 않는다. 원문 제목은 유지해 논문 식별성을 잃지 않으면서 한국어 화면에서 빠르게 훑어볼 수 있게 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-fast-window-card-triage-metadata

- description: 각 검색 결과 카드는 `one paper card` 단위의 빠른 읽기 판단을 위해 제목 → 출판연도·venue·분야 metadata 행 → 저자 행 → DOI/PDF/인용/비슷한 논문 액션 → AI 요약 순서로 스캔된다. 제목은 남은 가로 공간을 사용한다. 실제로 존재하는 결과 marker·대표 표시·라이브러리 액션만 우측 보조 영역에 이 순서로 나타난다. 접힌 카드는 공통 높이 안에서 제목 한 줄과 AI 요약 최대 두 줄을 보여주고, 카드 비조작 영역이나 화살표로 inspection을 열면 전체 제목, 원문·식별자 링크, 생성 근거·주제·방법·결과·다른 입장 탐색을 자연 높이로 읽으며 생성 근거 라벨도 이때만 드러낸다. 제목 아래 metadata 행은 연도를 별도 박스 없이 첫 항목으로 두고, venue와 `분야` 라벨·최대 두 분야를 바로 뒤에 이어 한 서지 묶음으로 보여준다. 연도가 없으면 빈 placeholder 없이 venue부터 시작한다. 저자 행은 그 아래에서 저자 이름을 최대 세 명까지 직접 표시하고 각 이름으로 저자 검색을 시작할 수 있게 한다. 저자가 네 명 이상이면 나머지는 `외 N명 펼치기`로 표시하고, 사용자가 펼치면 같은 행에 전체 저자를 보여준다. `접기`를 선택하면 다시 세 명만 표시한다. provider가 venue나 분야를 주지 않으면 각각 `출처 정보 없음`, `분야 정보 없음`을 낮은 강조도로 표시하고, 저자가 없으면 별도 저자 행에 `저자 정보 미제공`을 표시한다. DOI 액션은 실제 식별자를 화면에 노출하지 않고 고정 폭의 `DOI` 라벨만 PDF 바로 앞에 표시한다. DOI가 있으면 링크로 동작하고, 없으면 같은 폭의 비활성 상태로 남아 뒤따르는 PDF와 인용 정보의 시작 위치를 바꾸지 않는다. 논문 상세가 보강 중이면 현재 확실한 정보와 중립 상태를 먼저 보여주면서 최종 분석이 자리 잡을 카드 영역에서 `논문 정보 보강 중`, `저자·초록 보강`, `분석 입력 보강` 단계를 알리고, 보강 뒤에도 그 영역을 유지한다. 초록이나 분석 작업이 없을 때는 별도의 `메타데이터 단서` 제목을 반복하지 않고 근거 한계와 제목·분야 단서만 표시하며 대기 상태를 만들지 않는다. PDF는 확인 중 상태를 거쳐 실제 가능 여부로 전환하고, 반복 skeleton·헤더 중복 진행 문구 없이 인용 수는 DOI/PDF 다음의 기본 계보 진입점으로, 선행 연구 수는 인용 계보를 연 뒤 선행·후속 방향 안에서 보여준다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 22

### acceptance-check:search-results-fast-window-library-proximity-marker

- description: DOI 정확 일치가 아닌 검색 결과에서 양수의 query-aware 라이브러리 근접도 근거가 있는 논문 카드는 `내 연구와 가까움` marker 하나를 표시한다. 이 marker는 논문이 keyword 결과에도 있었는지, 라이브러리 그래프 결과에서만 합류했는지에 따라 달라지지 않는다. keyword 근거만 있는 논문에는 marker를 표시하지 않는다. 별도의 `키워드 일치` 또는 출처 marker를 추가하지 않으며, 이 표시는 관련성을 확정하거나 결과를 거르는 필터·액션이 아니다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-fast-window-title-family-dedup

- description: 초기 검색이 결과 snapshot을 커밋하기 전에는 같은 논문이 provider에서 별도 corpus 레코드로 두 번 돌아온 title-family 근접중복(구두점·말미 마침표만 다른 동일 제목)을 노출하지 않는다. 정규화한 제목이 같은 항목은 첫(=제공자 관련도가 더 높은) 항목만 남기고 이후 중복은 제거하며, 그 외 순서는 보존한다. 정규화 제목이 빈 항목은 서로 합치지 않고 모두 남긴다. 코호트·일반 검색 모두에 적용된다. 이미 커밋된 snapshot을 background hydration이나 legacy repair가 보강할 때는 기존 corpus id와 순서를 다시 dedup하지 않고 모두 보존한다. 합류하는 라이브러리 인접 후보는 현재 키워드 결과와 앞서 허용된 후보의 title-family 중복을 제거한다. 저장된 과거 snapshot의 보충 후보 admission과 클라이언트 prefix 검사는 기존 reader가 호환 범위에서만 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:search-results-fast-window-comma-query-single-intent

- description: 검색어에 콤마가 있으면 콤마 앞뒤의 개념을 함께 담은 논문을 찾는 하나의 검색 의도로 처리한다. `machine learning, climate change` 같은 복합 주제와 `Forced, Mixed, and Free Convection Regimes` 같은 정식 논문 제목을 모두 하나의 검색어로 조회한다. 결과 창은 콤마를 포함한 전체 검색어의 관련도를 단일 검색어 축으로 반영한다. 여러 검색 조건을 명시하려면 `;`나 줄바꿈으로 구분한다. 명시적으로 구분된 조건은 각각 조회한 결과를 하나의 결과 창에 병합한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-result-basis-visible

- description: 검색 결과 화면과 AI 반응 입력 맥락은 현재 결과가 검색어와 이용 가능한 내 라이브러리 맥락을 자동으로 함께 반영한다는 점을 밝힌다. 첫 화면은 `Moonlight Search` 브랜드/설명과 검색 입력을 세로 흐름으로 배치하고, 브라우저 탭 title과 favicon도 `Moonlight Search` 브랜드로 맞춘다. `Moonlight Search`가 PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB에서 찾는다는 source coverage를 짧게 설명한다. bootstrap이 미인증 상태를 확인해 인증 화면으로 전환해도 같은 source 설명을 인증 입력과 함께 유지한다. 사용자가 입력한 검색어와 Light House의 내 라이브러리 맥락을 함께 보는 논문 검색임을 Semantic Scholar/Episteme 같은 provider 이름 노출 없이 밝힌다. 기본 제품 경로의 최초 검색 전 query commit surface는 하나의 검색 input이다. 내부 `reviewed_papers` 목록 UI는 표시할 수 있지만, 이 UI는 같은 저장 source를 보여 주는 surface이며 사용자가 결과 basis를 고르는 control이 아니다. 라이브러리 신호가 현재 결과에 반영되면 header는 이를 짧게 설명하고, 신호가 없으면 일반 검색 결과임을 설명한다. 서버는 provider가 반환한 loaded result window를 받고 필요한 카드 상세를 보강한다. 라이브러리 신호가 있으면 기본순은 검색어 관련도와 라이브러리 근접도를 함께 반영하고, 없으면 provider 순서를 보존한다. 사용자가 인용순·연도순을 명시하면 선택한 보조 정렬을 우선한다. 여러 검색 조건이 병합된 결과는 각 조건의 provider window를 합친 결과임을 드러낸다. 사용자-facing 문구는 Google Scholar 비교나 Semantic Scholar provider 이름을 반복하지 않고 Moonlight Search 기반, 라이브러리 반영 여부, 적용된 연도 필터, 실제 loaded result 수를 함께 표시한다. Provider total은 metadata에 보존할 수 있지만 완전한 corpus 총계가 아닐 수 있으므로, 화면 문구와 AI 반응 입력 맥락은 이를 complete corpus나 "전체 N편"처럼 노출하지 않는다. AI 반응 입력의 size label과 절별 통계는 번호로 제공된 현재 결과 수만 숫자로 말한다. 멀티 검색이면 조건 병합 결과임을 드러낸다. 이 문구는 Light House가 별도 내부 기준으로 "상위 40편"을 골랐다고 오해되지 않게 한다. 외부 Moonlight library 신호는 명시적으로 구성된 external-source 경로에서만 같은 기준 surface로 들어올 수 있다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 19

### acceptance-check:search-results-fast-window-session-principal-handoff

- description: 클라이언트는 Moonlight Scholar token을 credentials 포함 요청으로 받고, Light House는 같은 origin의 교환 요청에서만 token을 검증해 Light House 도메인의 HttpOnly 세션 쿠키로 저장한다. 세션 저장 뒤에는 현재 route와 query string을 보존하는 navigation을 수행한다. proxy는 root·auth·telemetry hot path에서 Supabase refresh를 건너뛰고, Supabase auth-token cookie가 있을 때만 legacy Supabase 세션을 갱신한다. 만료된 Supabase refresh token은 browser 응답과 같은 요청의 downstream cookie header에서 제거한다. `resolveCurrentUser`는 검증된 Moonlight Scholar 세션을 Supabase 세션보다 먼저 current user로 해석한다. owner-scoped resource에 한해 current user의 owner key는 인증 요청에서 직접 얻은 principal id다. Moonlight는 검증된 token sub를 사용하고, Supabase는 Supabase user id를 사용한다. 이 principal id는 해당 저장 resource의 `owner_principal_id`로 쓰이며, service-role client의 명시적 `WHERE owner_principal_id = $principal` 필터가 소유권을 닫는다. shared gap report artifact는 owner-scoped resource가 아니므로 creator owner column을 두지 않고, 인증된 member read와 현재 viewer principal의 별도 reaction preference로 접근 경계를 닫는다. `app_users`는 표시·운영용 비동기 snapshot으로 남는다. `owner_principal_id`가 비어 있던 Moonlight 사전 존재 행은 off-path lazy backfill로 한 번 채운다. Supabase session helper인 `requireAuth`는 Supabase 세션 전용으로 남고, owner-principal guard는 Supabase 세션 또는 검증된 Moonlight Scholar 세션의 principal을 owner로 사용한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-bootstrap-auth-challenge

- description: 루트 `/`와 research route는 server layout이나 빈 검색 entry에서 인증 왕복·redirect를 first paint 앞에 두지 않고 research shell을 먼저 렌더한다. browser mount 뒤 library bootstrap이 401을 반환하거나 `moonlight_scholar_session_invalid`를 확인하면 공용 shell은 현재 route content, active view session, background task, account chrome, footer를 내리고 기존 `MoonlightAuthBootstrap` 인증 화면으로 전환한다. 이 인증 화면의 단일 owner는 공용 shell이다. Moonlight Scholar token/session 교환은 5초 안에 끝나며, 성공하면 인증 화면을 먼저 해제하지 않고 같은 URL과 query를 문서 전체 navigation으로 다시 열어 새 문서가 session과 bootstrap 결과를 판정하게 한다. token 발급 403은 Scholar allowlist 안내를 유지한다. 그 밖의 교환 실패는 stale local Scholar session 삭제를 최대 1초 동안 시도하고, 요청이 멈추면 취소한 뒤 기존 `EmailGate`를 표시한다. 인증 화면이 DOM에 반영된 뒤 canonical challenge-view event를 남긴다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-canonical-production-host

- description: production에서 사용자가 보는 정본 origin은 `https://scholar.themoonlight.io`다. 기존 `https://search.themoonlight.io`로 들어온 route는 path와 query string을 보존한 채 정본 origin으로 영구 이동한 뒤 인증이나 검색을 시작한다. 따라서 공유하거나 새로고침한 같은 route는 정본 origin에서 열리고, 기존 origin은 호환 진입점으로만 남는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-fast-window-library-bootstrap-outcomes

- description: research layout은 내부 `reviewed_papers` source resolve, compatibility Moonlight library fetch, library preset title hydration을 first paint path에서 기다리지 않는다. browser mount 이후 background bootstrap endpoint가 인증된 owner principal의 user email, library availability, access status, preset papers를 읽어 shared store에 seed한다. 401과 `moonlight_scholar_session_invalid`는 `acceptance-check:search-results-fast-window-bootstrap-auth-challenge`가 소유한다. 그 밖의 network·timeout·5xx·response shape 실패는 현재 research content를 유지하고 account와 library projection을 unavailable로 낮춘다. 인증 성공으로 새 문서가 열린 뒤 그 문서의 bootstrap 200이 account와 library store를 현재 principal 기준으로 seed한다. 새 검색 submit과 keyword follow-up은 그 시점의 store availability를 사용해 현재 라이브러리 근접도 source를 자동으로 반영하며, 별도 basis 선택을 조건 URL에 쓰지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-post-search-layout-about

- description: query가 있는 route와 저장된 검색 결과 화면은 첫 검색 화면과 다른 post-search layout을 쓰되, 상단 `ResearchRouteSearchBar`와 문서 outer panel은 모두 bounded rail 안에서 가운데 정렬된다. rail 안에서는 Moonlight Search 마크, 검색 입력, 계정 이메일과 로그아웃 버튼이 같은 행에서 수직 가운데가 맞고, 계정 영역은 배경 박스나 `현재 계정` 라벨 없이 상단바 오른쪽 끝에 표시된다. 기본 제품 경로의 상단 rail에서 라이브러리 관련 UI가 보이면 내부 `reviewed_papers` 저장 상태를 표시하거나 관리하는 surface로 해석된다. 새 검색 입력 계약은 route query가 소유하고, per-paper selected anchor 목록이나 별도 basis 선택은 현재 검색 실행 입력이 아니다. 상단 route command rail은 `max-w-[1280px]`까지 넓어져 검색 입력이 logo/account column 사이에서 충분히 확보되고, 검색 입력 column 자체는 `max-w-[1080px]` cap을 쓰며 중앙 정렬되지만 logo/account column을 보존하기 위해 실제 폭은 줄어들 수 있다. 결과 본문은 별도 내부 `px-5`나 content-shell `px-*` 같은 두 번째 좌측 여백을 만들지 않고 바깥 문서 route shell의 중앙 bounded rail을 공유해 상단바와 결과가 서로 다른 덩어리처럼 보이지 않게 한다. 큰 화면에서는 문서 content shell이 `max-w-[1060px]` 같은 좁은 고정 cap에 갇히거나 `max-w-none`처럼 과하게 퍼지지 않고, 검색·관계 ResearchRoutePayload 본문 rail은 `max-w-[1080px]` 읽기 폭 안에 머문다. 이 폭 체계는 `aspect:document-content-width-governance`의 일반 문서 rail 정책을 따른다. 검색 결과 기준 문구는 왼쪽에 놓이고, `상위 논문 40개의 관계를 분석하여 연구 공백 찾아보기 >` action은 같은 선상 오른쪽에 정렬된다. 결과 header controls는 논문 카드 표시 면적을 우선한다. 라이브러리 반영 여부는 결과 기준 문구가 설명하며 별도 토글이나 탭을 만들지 않는다. 왼쪽에는 `필터` disclosure만 두고, 보조 정렬 select와 PDF quick filter는 오른쪽 끝의 compact controls 묶음으로 우측 정렬한다. 정렬 select는 `기본순`·`인용순`·`최신순`·`오래된순` 같은 보조 정렬만 담고 남은 가로폭을 채우지 않는 고정 compact 폭을 쓰며, 상세 필터와 출판연도 조건은 `필터` disclosure 안에 둔다. 검색 결과 메타는 별도 오른쪽 rail이나 결과 카드 위의 큰 block, 또는 필터/정렬 줄 안의 별도 inline preview로 렌더하지 않는다. `검색 결과 개요` 타이틀이나 접기/펼치기 버튼도 렌더하지 않는다. AI comment는 생성 문장을 주변 검색 결과 UI와 같은 본문 크기와 행간으로 맞추되 내부 배경 박스나 추가 inset 없이 하단 용어 콘텐츠와 같은 좌우 기준선에 맞추고, 연구 용어 제안은 기존 `englishTermCandidates` 추출 결과를 본문형 문장 안의 클릭 가능한 텍스트 링크로 이어 붙인다. 검색 결과를 끝까지 읽으면 결과 rail의 마지막 카드가 아니라 별도 full-width Scholar footer가 나타나며, 중앙 Moonlight 브랜드 로고, Scholar 설명, 내부 안내 링크(`/about/search`, `/about/graph/sample`, `/about/promises`), 사업자 정보, 저작권 문구를 보여 준다. 존재하지 않는 정책/외부 링크나 별도 accent band를 footer에 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 14

### acceptance-check:search-results-fast-window-doi-exact-lookup

- description: 검색어가 DOI 또는 `doi.org` URL이면 일반 키워드 검색 전에 논문 식별자 정확 일치 조회를 먼저 시도한다. DOI가 arXiv 논문을 가리키면 arXiv 식별을 우선한다. 정확 일치가 성공하면 기존 검색 결과 화면에 해당 논문을 표시하고, 결과 기준 문구에서 DOI 정확 일치였음을 밝힌다. 정확 일치가 실패하면 일반 검색 경로로 돌아가며, 제품 문구는 DOI를 논문 식별자로만 다룬다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-fast-window-library-interest-default

- description: 내 라이브러리에 검색 기준으로 쓸 논문이 있으면 새 검색은 검색어 결과 최대 40편과 라이브러리 그래프 결과 최대 40편을 한 결과 목록에서 자동으로 함께 정렬한다. 검색어 관련성과 라이브러리 근접도는 어느 한 출처가 상단 전체를 선점하지 않도록 함께 반영하고, 두 근거에 모두 걸친 논문을 우선한다. 같은 논문은 한 번만 남긴다. 사용자가 두 기준 사이를 전환하는 토글이나 탭은 만들지 않는다. 나중의 보강은 이미 공개된 후보군·순서·근거를 바꾸지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 17

### acceptance-check:search-results-fast-window-combined-result-membership

- description: 통합 결과 목록은 Moonlight Search가 현재 검색어에 대해 찾은 결과 최대 40편과, 같은 검색어를 반영한 내 라이브러리 그래프 결과 최대 40편을 모두 한 pool로 사용한다. 같은 논문은 한 번만 남긴다. 두 출처는 같은 반복 카드 목록과 결과 수·더보기·후속 AI·연구 공백 입력에 함께 참여한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:search-results-fast-window-balanced-basis-order

- description: 기본 통합 정렬은 검색어 관련도와 라이브러리 근접도를 각각 독립된 점수로 환산한다. 두 기준은 최종 점수에서 각각 최대 절반을 차지한다. 같은 논문이 양쪽 근거에 모두 걸리면 두 점수를 함께 받아 올라간다. 어느 한 출처도 출처라는 이유만으로 상단 전체를 선점하지 않으며, 3·6·9 같은 고정 위치도 배급하지 않는다. 최종 점수가 같으면 검색어 결과와 기존 후보 순서를 보존한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:search-results-fast-window-library-first-response

- description: 라이브러리 신호를 사용할 수 있는 검색은 처음 공개하는 화면에서 검색어 결과와 라이브러리 그래프 후보로 이루어진 한 결과 pool의 멤버십과 순서를 함께 확정한다. 논문 세부 정보가 뒤늦게 보강되더라도 이미 공개된 결과의 멤버십·순서·근거는 바뀌지 않는다. 라이브러리 근접도나 후보를 준비하지 못하면 이용 가능한 keyword 결과만으로 화면을 연다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:search-results-fast-window-library-grounding-unavailable

- description: 적용할 라이브러리 source가 있지만 첫 결과를 확정하는 graph preflight나 source read가 일시적으로 unavailable일 때도 keyword 결과를 보여 준다. 결과 header에는 "내 라이브러리를 이번 결과에 반영하지 못했어요. 검색 결과는 계속 볼 수 있어요."라는 접근 가능한 안내를 표시한다. 라이브러리 없음이나 provider의 정상 응답 뒤 graph 무신호일 때는 이 실패 안내를 표시하지 않는다. 첫 search payload는 적용·정상 무신호·일시 unavailable을 tagged state로 구분한다. Raw provider 오류, HTTP status, circuit·queue 상세는 client에 싣지 않는다. Server telemetry는 상세 실패와 load-shed 원인을 구분한다. Background hydration은 unavailable 결과에 graph 후보를 늦게 주입하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-library-neighbor-combined-pool

- description: 라이브러리 그래프 결과 최대 40편은 검색어 결과와 같은 결과 목록에 모두 합류한다. 현재 결과와 논문 id나 title-family가 같거나 출판연도 범위를 벗어난 후보는 합류 전에 제외해 같은 논문은 한 번만 남긴다. 합류한 후보는 별도 섹션이나 고정 슬롯을 만들지 않고 같은 정렬·facet·결과 수·더보기·후속 입력 규칙을 따른다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:search-results-fast-window-personalization-opt-out

- description: 이전 검색의 `personalize=false` opt-out은 신규 제품 선택으로 제공하지 않는다. 기존 조건 주소를 직접 열면 입력 검증은 통과하지만 현재 검색은 이를 basis 선택으로 해석하지 않고 단일 결과 projection으로 정규화한다. 검색 UI, 새 검색 submit과 모든 후속 검색 writer는 이 파라미터를 만들거나 preference로 저장하지 않으며, 현재 검색의 hydration snapshot에도 basis preference를 기록하지 않는다. 외부 analytics sink, 과거 저장 snapshot과 dated review에 남은 값은 읽기 호환·역사 데이터로 보존한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 20

### acceptance-check:search-results-fast-window-unified-result-projection

- description: 검색 결과는 사용자가 `내 연구 기준`과 `검색어 기준`을 고르는 토글·탭·별도 입력을 보여 주지 않는다. 라이브러리 신호가 있으면 검색어 관련도와 라이브러리 근접도를 자동으로 함께 반영한 한 목록을 보여 주고, 신호가 없으면 keyword provider 순서를 보여 준다. 기존 `personalize=false`와 `sort=relevance|interest` 조건 주소를 직접 열어도 현재 단일 projection과 기본순으로 실행하며, 새 검색과 후속 검색은 이 basis 파라미터를 쓰지 않는다. 라이브러리 목록 UI는 저장 논문을 표시하거나 관리하는 별도 surface로 남는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-library-source-sync

- description: 기본 제품 경로에서 새 검색의 라이브러리 근접도 source는 현재 가입자의 내 라이브러리 저장 상태가 소유한다. 저장·해제 뒤의 새 검색은 갱신된 라이브러리 논문 집합을 사용하고, 완료된 검색 metadata는 그 검색의 snapshot일 뿐 이후 기준을 대신하지 않는다. 새 검색은 현재 라이브러리 논문을 query-aware graph proximity의 anchor로 사용해 검색어 관련도 순위와 함께 반영한다. 검색 응답 뒤에 별도의 직접 인용 자료를 채우거나 다음 검색의 숨은 기준으로 보관하지 않는다. 라이브러리 근접도 신호가 없으면 provider 순서를 보존한다. 외부 호환 source 실패도 오래된 자료를 쓰지 않고 일반 검색으로 degrade한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 9

### acceptance-check:search-results-fast-window-publication-year-range-filter

- description: 검색 query 입력과 primary 검색 commit은 route-level command field 하나가 담당한다. 검색 결과 본문은 별도 검색 결과 타이틀 영역이나 같은 query 입력을 반복하지 않는다. 출판연도 from / to 두 입력과 조건 적용 affordance는 결과 기준 문구 아래의 결과 controls에 위치한다. 기준 문구와 조건 controls는 같은 가로 줄에서 폭을 빼앗지 않고, 기준 문구가 먼저 자연스럽게 읽힌 뒤 조건 조작이 이어진다. 사용자가 from / to 값을 입력하고 조건 적용 액션(조건 적용 버튼 클릭 또는 출판연도 입력의 Enter)을 발화하면, 그 시점의 from / to를 함께 정규화한 연도 범위 문자열(`YYYY-YYYY` / `YYYY-` / `-YYYY` / 단일 값 `YYYY`)이 현재 query·`sort`와 함께 canonical `/search?q=...&year=...` 조건 주소로 commit되어 그 주소에서 실행된다. 검색 본문은 서버 호출을 직접 실행하지 않고, route 서버 실행이 yearFilter를 provider year 파라미터로 실어 검색을 수행한다. 직접 `/search?q=...&year=...`로 들어와도 같은 조건 실행으로 같은 주소에서 렌더된다. 입력 자체(typing, blur, Tab 이동)는 서버 호출이나 URL 변경을 일으키지 않는다 — range가 부분적으로 입력된 상태에서 의도치 않게 검색이 발화하지 않도록, 사용자가 양쪽을 다 채우거나 비운 뒤 명시적 조건 적용 액션을 한 번 발화하는 것이 단일 commit 시점이다. from이 to보다 크면 입력 순서를 자동으로 뒤바꿔 정규화한다. 두 입력이 모두 비어 있으면 yearFilter는 빈 문자열로 정리되어 범위 제한 없는 검색 조건으로 commit된다. 입력 컨트롤과 조건 적용 버튼은 검색 진행 중에는 비활성화되어 다중 동시 검색 request를 만들지 않는다. 조건 적용 버튼은 query가 비어 있을 때도 비활성화되어 빈 검색을 막는다. 출판연도 입력은 정렬 컨트롤이나 YearDistributionTimeline 위젯과는 분리된 별도 surface다. 한 번 적용된 범위는 실행된 결과 view, 결과 카드, AI 반응 컨텍스트가 같은 검색 단위로 갱신되도록 search context key에 포함된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-results-fast-window-loaded-result-facet-filters

- description: 검색 결과 필터 controls는 현재 적재된 논문 metadata에서 분야(`fieldsOfStudy`), 저자, venue/journal/conference, PDF 가능 여부 facet 후보를 구성한다. 이 facet은 provider corpus 전체에 새 facet query를 던지는 전역 검색 조건이 아니라, 이미 받은 loaded result window와 background hydration으로 보강된 metadata를 좁히는 route-owned 결과 필터다. 따라서 facet 변경은 새 provider 검색을 실행하지 않고 현재 search ResearchRoutePayload metadata의 `facetFilters`와 현재 조건 주소의 view-filter query(`/search?q=...&field=&author=&venue=&hasPdf=`)를 함께 갱신한다. 새로고침·공유 URL·브라우저 뒤로가기는 같은 facet 상태를 복원해야 하며, 직접 `/search?q=...&field=...&author=...&venue=...&hasPdf=true`로 들어오면 route가 같은 facet을 실행된 검색 결과에 적용한다. 검색 결과 기준 문구와 AI focused context는 현재 facet으로 좁혀진 result count와 paper pool을 기준으로 말한다. 출판연도는 provider year 파라미터를 바꾸는 route query 조건이고, 이 loaded-result facet들과 역할이 다르다는 경계를 유지한다. 화면에서는 분야·저자·venue facet과 출판연도 조건을 각각 별도의 칩 드롭다운으로 결과 controls 줄의 한 묶음(dashed group)에 두고, PDF 여부와 대표 논문은 같은 묶음 안의 즉시 토글 quick filter 칩으로 둔다. 이 facet 칩 드롭다운들은 한 번에 하나만 열린다 — 하나를 열면 이미 열려 있던 다른 드롭다운은 닫히고, 드롭다운 패널 바깥을 클릭하거나 Esc를 누르면 닫혀, 여러 패널이 동시에 떠 서로 겹치지 않는다. 필터 컨트롤은 줄을 늘리거나 정렬 select가 남은 폭을 먹어 논문 카드 표시 면적을 밀어내지 않게 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:search-results-fast-window-representative-filter

- description: 검색 결과 metadata와 deterministic representative selector가 고른 대표 논문은 검색 결과 리스트의 같은 `one paper card` 안에서 `대표` 표시로 식별된다. 결과 개요의 `필터` 그룹에는 `대표 논문` 체크 필터가 있어, 사용자가 현재 화면에 노출된 결과 카드 중 대표 논문만 남겨 빠르게 훑을 수 있다. 이 필터는 provider corpus에 새 검색을 요청하는 조건이 아니라 현재 노출 result window 위의 local narrowing이다. 필터가 켜진 동안 `더 보기` 확장 affordance는 숨겨져 대표 논문 subset을 읽는 상태와 전체 결과 window 확장 상태가 섞이지 않는다. 연구 공백 리포트 입력 범위는 이 표시 필터가 아니라 `promise:gap-network-detection-from-search#acceptance-check:gap-network-detection-from-search-top-result-input-set`이 정한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-fast-window-brand-mark-home-link

- description: 상단바(route command rail) 왼쪽의 `Moonlight Search` 브랜드 마크는 검색 홈(`/`)으로 가는 링크다. 마크를 클릭하면 홈으로 이동하고, 브랜드 이미지는 그 홈 링크 안에 들어간다. 마크의 위치·정렬은 `acceptance-check:search-results-fast-window-post-search-layout-about`이 정하고, 이 Acceptance Check는 그 마크가 홈으로 가는 네비게이션 affordance라는 점만 잠근다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-fast-window-reviewed-papers-context-source

- description: 기본 제품 경로의 라이브러리 근접도 source는 현재 가입자가 Light House의 내 라이브러리에 저장한 논문이다. 인증된 검색 화면은 그 목록의 논문 제목과 폴더를 보여 주고, 저장된 논문이 없으면 빈 상태를 보여 준다. 목록에서 논문을 해제하면 이후 검색과 화면의 저장 상태에 반영된다. 새 검색과 연구 용어·저자·토픽·다른 입장 후속 검색은 현재 query·보조 조건과 그때의 내 라이브러리 상태를 자동으로 함께 반영한다. 외부 Moonlight source는 명시적으로 켠 호환 경로에서만 현재 근접도 후보가 된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 10

## Runtime ownership

저장소·캐시·provider 실행 순서와 첫 결과 fan-out은
`docs/runtime-flows/search-mechanism.md`가 소유한다.

## Contract Architecture Impact Review

Contract delta: 검색 결과 카드는 양수의 query-aware 라이브러리 근접도 근거가 있는
모든 논문에 `내 연구와 가까움` marker 하나를 표시한다. 반복 논문 카드는 venue·분야
metadata 행 아래에 별도 저자 행을 두고, 최대 세 명을 기본 표시한 뒤 나머지를 인라인으로 펼친다. DOI는 실제 식별자를 노출하지 않는
고정 폭 `DOI` 슬롯으로 PDF 바로 앞에 표시한다. 초록이 없는 설명은 별도의 `메타데이터 단서`
제목 없이 근거 한계 문장부터 시작한다.

Verdict: constrain-existing

Affected axes and current owners: Source of truth and authority; State lifetime and recovery; Cross-surface invariant ownership —
기존 `SearchMetadata.libraryContext.interestWeights`, `aspect:library-grounded-research`,
`aspect:paper-card-presentation-consistency`, 공통 `SearchResultItem`이 계속 소유한다.

Decision: 양수의 `interestWeights`를 카드별 라이브러리 근접도 근거로 사용한다. keyword
목록 포함 여부는 marker를 막지 않는다. 반복 카드의 venue와 분야는 한 metadata 행에 두고,
저자 행은 바로 아래에 둔다. 저자는 최대 세 명을 기본 표시하고, 나머지는 사용자가 같은 행에서
펼치거나 접는다. 각 저자 이름은 저자 검색을 제공한다. 펼침 상태는 카드가 렌더되는 동안만 유지하며
저장·복원하지 않는다. 누락 값은 같은 순서에서 낮은 강조도의 `출처 정보 없음`, `분야 정보 없음`,
`저자 정보 미제공` 상태로 표시한다. DOI 슬롯은 실제 값을
화면에 표시하지 않고, 식별자가 있으면 링크, 없으면 같은 폭의 비활성 상태로 PDF 바로 앞에
유지한다. 초록이 없는 근거 한계 설명은 별도 제목 없이 본문만 표시한다.

Rejected alternative: keyword와 라이브러리 근거가 겹친 카드에만 marker를 표시하면 실제
라이브러리 근접도 근거가 있는 graph-only 후보가 설명되지 않는다. 첫 저자와 인원수만 보이는
요약과 별도 저자 목록은 카드 왼쪽 밀도를 낮추지만 저자 식별을 간접적으로 만든다. venue·분야와
저자를 한 줄에 합치면 긴 서지 정보가 서로 경쟁하므로 저자 행을 분리한다. 실제 DOI
문자열을 액션 행에 표시하거나 DOI가 없을 때 슬롯을 제거하면 값 길이와 유무에 따라 PDF와
인용 정보의 위치가 달라져 반복 카드의 예측 가능한 스캔 기준점이 깨진다.

Evidence and structural defense: `aspect:library-grounded-research`,
`aspect:paper-card-presentation-consistency`,
`app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx`,
`app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx`,
`app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx`,
`npm run quality:contract`가 기존 근거 owner와 공통 카드 표시 규칙을 검증한다.

Human decision required: no

## Propagation Map

Invariant: 양수의 query-aware 라이브러리 근접도 근거가 있는 카드는 `내 연구와 가까움`
marker 하나를 표시한다. 반복 카드는 venue·분야 metadata 행 아래에 저자 행을 두고 정보 유무와
무관하게 스캔 순서를 유지하며 누락 상태를 명시한다. 저자는 최대 세 명을 기본 표시하고 나머지는
사용자가 같은 행에서 펼치거나 접는다. DOI는 식별자 유무와 무관하게 같은 폭의
슬롯을 PDF 바로 앞에 유지하고, 실제 식별자는 화면에 표시하지 않는다.

Owning contract bundle: `promise:search-results-fast-window`와
`search-result-window.ledger.yaml`, `aspect:library-grounded-research`와 그 covering ledger,
`aspect:paper-card-presentation-consistency`와 그 covering ledger,
`promise:researcher-prose-promises-page`와 `commitment-pages.ledger.yaml`.

Runtime/engineering owner: `SearchMetadata.libraryContext.interestWeights`, 공통
`SearchResultItem`, `docs/runtime-flows/search-retrieval-ranking.md`,
`docs/design-standards.md`.

Required code/test paths: `search-view.helpers.ts`, `search-result-item.tsx`,
`search-result-author-row.tsx`,
`search-result-item.shared.tsx`, `search-result-generated-content.tsx`, search result marker·공간
안정성·공개 검색 설명 테스트와 i18n registry.

Inspected, not edited: 검색 점수 계산, 저장 snapshot schema, citation과 graph-neighbor의
별도 Promise 의미, analytics event 계약. Provider fan-out과 reviewed-paper source read는
E3 전환 및 bounded active-source 적용을 위해 owning edit에 포함했다.

Compatibility-only shapes: `libraryOnlyPaperIds`, 저장된 과거 snapshot reader와 dated review는
`preserve`한다. 현재 marker 판단에서는 `libraryOnlyPaperIds`를 읽지 않는다.

Split cleanup: 과거 dated review와 archive의 당시 marker 문구는 바꾸지 않는다. 별도 후속
cleanup은 없다.

Budget: 24..36 authored files; 350..850 authored changed lines. Generated glossary projection은
별도로 보고한다.
