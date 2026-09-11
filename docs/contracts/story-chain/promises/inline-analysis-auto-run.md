---
id: promise:inline-analysis-auto-run
slug: inline-analysis-auto-run
title: 인라인 분석 자동 실행
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:route-view-ai-reaction-rules
  - aspect:visible-explanation-sufficiency
  - aspect:ai-generated-content-feedback
  - aspect:provider-failure-degraded-mode
  - aspect:paper-card-presentation-consistency
  - aspect:immediate-navigation
  - aspect:progressive-content-spatial-stability
  - aspect:research-route-visual-hierarchy
intentChecks:
  - intent-check:semantic-profile-is-phrase-not-keyword
acceptanceChecks:
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:inline-analysis-auto-run-visible-first-priority
  - acceptance-check:inline-analysis-auto-run-db-cache-shown-immediately
  - acceptance-check:inline-analysis-auto-run-shared-cache-reuse
  - acceptance-check:inline-analysis-auto-run-provider-failover-bounded
  - acceptance-check:inline-analysis-auto-run-explicit-failure-retry
  - acceptance-check:inline-analysis-auto-run-does-not-recompute-search-reaction
  - acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states
  - acceptance-check:inline-analysis-auto-run-evidence-limit-preview
  - acceptance-check:inline-analysis-auto-run-prompt-bounds-topics-and-claim
  - acceptance-check:inline-analysis-auto-run-expanded-triage-fields
  - acceptance-check:inline-analysis-auto-run-different-position-search
  - acceptance-check:inline-analysis-auto-run-search-click-feedback
requiredEvents:
  - search_result_inspected
  - product.different_position_search.clicked
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 인라인 분석 자동 실행

## Promise

검색 결과와 그 논문 카드가 재사용되는 인용 관계·비슷한 논문 ResearchRoutePayload에서는
논문별 인라인 분석이 자동으로 시작된다. 각 논문을 열지 않아도 핵심을 바로
보고, 후보 논문을 빠르게 가려 PDF 읽기나 후속 검색으로 이어 간다.

## Intent Checks

### intent-check:semantic-profile-is-phrase-not-keyword

- question: 인라인 분석 카드가 abstract를 열지 않고도 이 논문의 요약(주장 서술)·주제·방법·결과 중 최소 2종을 구체 구절 수준(키워드 나열 금지)으로 전달하는가?
- evidence: live judge @ `app/server/services/__tests__/inline-analysis-intent-qualitative.live.test.tsx`
- why live judge: AC1/AC2는 자동 실행·visible-first 배치를, AC3/AC4는 캐시 재사용과 failure/retry 상태를 deterministic하게 닫는다. semanticProfile 필드 존재 자체는 AC-level check로 닫히지만, 렌더된 요약(summary)/주제(topics)/방법(method)/결과(finding) 텍스트가 "이 논문이 무엇을 연구하는가"를 구절 수준으로 전달하는지는 단일 assertion으로 닫히지 않는 창발 속성이다 — 필드가 전부 채워져 있어도 "multi-agent, benchmark, performance"처럼 키워드 나열에 그치면 Intent 미달성이다.
- linked acceptance checks:
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:inline-analysis-auto-run-visible-first-priority
  - acceptance-check:inline-analysis-auto-run-db-cache-shown-immediately
- answer criteria: 요약(주장 서술)/주제/방법/결과 중 최소 2종이 구체 구절(명사구·동사구 수준, 연구 내용의 서술적 표현)로 카드에 보여야 함. 단순 키워드 라벨 나열("topic: X, Y, Z")이나 abstract raw truncate는 얕은 답으로 배제.

## Acceptance Checks

CAIR record: `docs/runtime-flows/search-background-enrichment.md#contract-architecture-impact-review`

### acceptance-check:inline-analysis-auto-run-exposed-card-start

- description: 검색 결과 ResearchRoutePayload에서는 논문 카드가 실제 viewport에 노출된 뒤에만 인라인 분석이 시작된다. 인용 관계·비슷한 논문 ResearchRoutePayload에서는 참고문헌/후속인용 섹션 또는 co-cited/coupled 축이 각각 처음 10개씩 렌더될 수 있으므로, 각 섹션/축에서 실제 렌더된 반복 논문 카드 id를 합친 visible window가 자동 분석 task 대상이 된다. 같은 카드 위치에서 분석 상태를 보여 주며, ResearchRoutePayload가 보유한 후보 전체나 각 섹션/축의 `더보기` 뒤에 숨은 카드를 한 번에 큐잉하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:inline-analysis-auto-run-visible-first-priority

- description: 현재 화면에 렌더된 논문 카드 window부터 우선 분석된다. 검색 결과·인용 관계·비슷한 논문 모두 현재 visible result window 밖의 후보는 사용자가 더 보기로 그 섹션/축의 window를 넓히기 전까지 자동 분석 큐에 들어가지 않는다. 정렬·필터·기준 전환이나 섹션 변경으로 현재 window에서 빠진 queued 후보는 새 분석 대상에서 제거된다. 인용 관계의 참고문헌/후속인용 섹션과 비슷한 논문의 co-cited/coupled 축은 각각 보이는 카드 id를 합쳐 전달하므로, 화면에 보이는 한쪽 섹션 카드가 다른 섹션의 metadata 순서 때문에 분석에서 누락되지 않는다. 이 관계형 view의 visible window가 20개여도 한 번에 처리하지 않고 5개씩 이어서 보강한다. 각 요청은 논문별 입력을 섞지 않은 한 번의 실행만 허용하고 30초 안에 성공 또는 지속되는 실패 상태로 닫는다. 확인되지 않은 실행, transport timeout, remount는 자동 재호출을 만들지 않는다. 첫 batch가 끝난 뒤 나머지 visible id는 task에 남아 다음 batch로 이어지고, 실패한 id는 사용자의 명시적 재시도 전까지 error 상태를 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 9

### acceptance-check:inline-analysis-auto-run-db-cache-shown-immediately

- description: DB 캐시가 있으면 검색 결과·인용 관계·비슷한 논문 카드에서 즉시 표시한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:inline-analysis-auto-run-shared-cache-reuse

- description: 현재 분석 버전과 정규화된 제목·초록·출판연도 입력이 같은 성공 분석은 공동 캐시에서 재사용한다. 요청 사용자와 검색 결과·인용 관계·비슷한 논문 route 종류는 cache identity에 포함하지 않는다. 공동 결과는 한 논문의 정규화된 입력만으로 생성하며, 같은 요청에 실린 다른 논문은 그 결과에 영향을 주지 않는다. 같은 논문·버전·입력의 cache miss가 동시에 발생해도 한 번만 생성하고, 나머지 요청은 30초 안에 같은 성공 결과나 지속되는 실패 상태를 읽는다. 같은 논문 id라도 제목·초록·출판연도 입력이 다르면 이전 결과나 실패 상태를 재사용하지 않는다. 입력 identity는 API 결과와 카드 cache까지 유지되며, 입력이 바뀌거나 identity가 없는 legacy card cache는 현재 분석으로 표시하지 않는다. 실패 상태와 완료되지 않은 실행은 성공 캐시로 표시하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:inline-analysis-auto-run-provider-failover-bounded

- description: 첫 분석 생성은 호출 시작 후 최대 10초에 중단한다. 일시적 provider 실패면 동일한 분석 형식과 품질 기준을 따르는 별도 secondary를 한 번만 호출하고, 전체 실행은 30초 안에 성공 또는 지속되는 실패 상태로 닫는다. 같은 실패에 대한 추가 자동 재호출이나 third provider 호출은 허용하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:inline-analysis-auto-run-explicit-failure-retry

- description: Primary와 secondary가 모두 일시적으로 실패하면 같은 분석 버전·정규화 입력에 5분·15분·60분 단계와 더 긴 Retry-After를 적용한 지속되는 cooldown failure를 기록한다. Cooldown 동안 재방문·remount·다른 route·tab·instance·background task가 provider를 호출하지 않으며, cooldown 종료만으로도 자동 실행하지 않는다. 사용자가 카드의 `분석 다시 시도`를 명시적으로 실행하고 cooldown이 끝난 뒤에만 새 실행을 시작할 수 있다. Schema·auth·configuration·저장 경계 실패는 terminal failure로 남고 자동 recovery에 들어가지 않는다. 사용자에게 provider 내부 오류를 노출하지 않으며 검색 결과는 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:inline-analysis-auto-run-does-not-recompute-search-reaction

- description: 인라인 분석은 검색 결과 view의 보조 신호일 뿐, 검색 완료 AI 반응이나 결과 리스트의 대표 논문 표시를 재계산하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states

- description: 인라인 분석 상태 뱃지는 4 상태(queued / running / done / error)에 대해 서로 다른 라벨·className·스피너 조합을 렌더해 구별 불가 상태를 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:inline-analysis-auto-run-evidence-limit-preview

- description: 초록 기반 분석 결과가 없는 반복 논문 카드도 인라인 분석 영역을 없애지 않는다. 초록이 없거나 공백뿐이면 분석할 수 없다는 한계를 밝히고, 제목과 분야처럼 현재 카드에 보이는 metadata로 확인할 수 있는 제한된 관련성 단서만 보여 준다. 저자명으로 논문 내용·방법·결과·품질을 추론하지 않는다. 실제 분석 task 상태가 없을 때 queued로 표시하지 않으며, 검색 결과·인용 관계·비슷한 논문 카드가 같은 위치와 표현을 사용한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:inline-analysis-auto-run-prompt-bounds-topics-and-claim

- description: 초록 기반 인라인 분석 프롬프트는 topics를 연구 대상·방법·문제 축으로 한정하고, "novel/first/new/state-of-the-art"류 저자 홍보 표현이나 일회성 수식어를 분야 핵심 토픽으로 만들지 말라고 지시한다. claim은 초록에서 저자가 주장하는 바임을 밝히고, 제목/초록만으로 분야 전체 중요도나 반복성을 단정하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:inline-analysis-auto-run-expanded-triage-fields

- description: 카드의 비조작 영역이나 화살표로 여는 inspection은 읽기 전 triage를 위해 생성 근거, 원문/식별자, 주제, 방법, 결과를 구분해 보여준다. `초록 기반 AI 분석` 같은 생성 근거 라벨은 접힌 두 줄 요약에는 보이지 않고 inspection이 열린 뒤에만 표시된다. 카드 상단 요약과 중복되는 기여/claim 블록은 상세 영역에서 반복하지 않는다. 검색 결과·인용 관계·비슷한 논문 카드에서는 초록만 보고 논문 전체 결론을 안다는 신호를 주지 않으며, 결과는 근거가 부족하면 추정 문장 대신 제한 상태를 보여준다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:inline-analysis-auto-run-different-position-search

- description: 인라인 분석은 각 논문 카드의 제목·초록/PDF 근거에서 해당 논문의 입장, 반대 해석이 갈릴 수 있는 쟁점 축, 해당 논문의 한계나 반박할 수 있는 지점(`limitations`), 다른 입장 탐색용 영어 검색 후보를 함께 추출한다. `limitations`는 근거가 약하면 비운다. 후보의 `query`에는 검색 provider에 바로 전달할 영어 검색식만 담고, 그 검색어가 어떤 한계·반박 지점을 확인하려는지는 한국어 `rationale`에만 담는다. 이 경계를 지키지 않는 후보는 캐시·표시·검색 이동 전에 제외한다. 검색 결과·인용 관계·비슷한 논문에서 반복되는 같은 논문 카드는 inspection이 펼쳐진 뒤 방법·결과 아래에 후보가 있을 때만 `다른 입장 탐색`을 보여 준다. 이 영역은 별도 disclosure를 만들지 않는다. 영역 상단에는 일반 면책 문구 대신 이 논문의 한계·반박 지점을 요약한 짧은 설명을 보여 주고, 요약이 비어 있으면 그 줄을 생략한다. 그 아래 최대 3개의 영어 검색 후보를 각각 한 줄 한국어 설명과 함께 바로 보여 주며, 각 query 자체가 검색 action이다. 사용자가 후보를 클릭하면 같은 search-term handler로 서버 왕복을 기다리지 않고 즉시 `/search?q=` entry route로 이동한다(aspect:immediate-navigation). entry route의 서버는 그 query를 독립된 검색 조건으로 취급하고 같은 `/search?q=` 주소에서 검색을 실행한다. plain click은 현재 브라우저 창에서 전환한다. Ctrl/Cmd/가운데 클릭은 같은 query-only entry URL을 새 브라우저 탭에서 열고 현재 브라우저 route와 출발 ResearchRoutePayload 상태를 바꾸지 않는다. 이 경로는 legacy selected `libraryPaperIds`, retired `personalize` 기준, 출발 논문·입장·쟁점 trace를 싣지 않는다. 라이브러리 source가 있으면 목적지 route가 통합 projection으로 자동 반영한다. 출발 논문과 후보의 상관관계는 raw query를 제외한 출발 화면의 canonical analytics event에만 남고 destination URL·metadata·canonical search identity에는 참여하지 않는다. 이 표면은 한계·반박 지점을 제목·초록 근거의 분석으로 제시할 뿐, 반박 논문이 실제로 존재한다고 단정하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 12

### acceptance-check:inline-analysis-auto-run-search-click-feedback

- description: 사용자가 논문 카드의 `다른 입장` 검색 후보를 plain click하면, 출발 화면이 남아 있는 동안 선택한 검색어를 포함한 검색 이동 상태가 현재 scroll viewport에 즉시 보인다. 이 상태는 카드와 기존 결과를 유지한다. 목적지 route 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. detached click은 현재 창의 route, 출발 ResearchRoutePayload, 이동 상태를 바꾸지 않는다. 저자명과 인라인 주제 키워드의 같은 feedback 의미는 `acceptance-check:similar-papers-discovery-author-topic-search`가 소유한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

## Contract Architecture Impact Review

Contract delta: `다른 입장 탐색` 영역은 일반 면책 문구 대신 이 논문의 한계·반박 지점
요약(`stanceProfile.limitations`)을 보여 주고, 최대 3개의 영어 검색 후보를 각각 그
검색어가 확인하려는 한계·반박 지점 설명(`rationale`)과 함께 보여 준다. 클릭 동작,
query-only 목적지, analytics identity는 바뀌지 않는다.

Verdict: none

Affected axes: Domain and data shape; State lifetime and recovery; Runtime, external, or AI boundary; Compatibility and retirement

Existing-boundary evidence: 새 필드는 기존 `stanceProfile` bundle 안의 optional nullable
필드이며 `app/domain/analysis.ts`, `app/lib/schemas.ts`,
`app/domain/research-route-payload-schema.ts`, `app/server/services/inline-analysis-service.ts`가
그대로 소유한다. cache 재생성은 기존 `INLINE_ANALYSIS_VERSION` bump 절차가 소유하고,
구버전 payload는 schema default(`null`)로 복원되어 요약 줄만 생략된다. 새 provider
호출, 새 runtime-flow, 새 cache lifecycle, 새 response channel은 없으며 같은 생성 요청
1회 안에서 필드 하나가 늘어난다.

Human decision required: no
