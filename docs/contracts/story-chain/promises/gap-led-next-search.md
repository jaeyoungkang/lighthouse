---
id: promise:gap-led-next-search
slug: gap-led-next-search
title: 연구 공백 리포트에서 다음 검색을 시작한다
moment: moment:gap-led-followup-discovery
lane: search
status: propagated
aspects:
  - aspect:visible-explanation-sufficiency
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:immediate-navigation
acceptanceChecks:
  - acceptance-check:gap-led-next-search-seeds-are-identifiable
  - acceptance-check:gap-led-next-search-seed-traces-to-papers
  - acceptance-check:gap-led-next-search-seed-launches-search
  - acceptance-check:gap-led-next-search-click-feedback
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 연구 공백 리포트에서 다음 검색을 시작한다

## Promise

사용자가 `gap_network` ResearchRoutePayload에서 클러스터·키워드 노드나 공백 후보를 선택
하면, Light House는 그 선택을 다음 검색의 출발점으로 가져갈 수 있는 형태
로 보여 준다. 사용자는 클러스터 내부의 키워드를 새 query로 던지거나, 두
클러스터 사이 공백 라벨을 좁힌 검색어로 가져가거나, 노드를 받치는 대표
논문을 paper-led 경로의 기준점으로 삼는다. `gap_network` ResearchRoutePayload는 읽고 닫는
산출물이 아니라 다음 query를 낳는 출발점으로 작동한다.

## Intent Checks

명시적 Intent Check는 없다. 단서가 *다음 검색의 출발점으로 읽히는가*는
구현이 도착한 뒤 live judge로 별도 라운드에서 추가한다.

## Acceptance Checks

### acceptance-check:gap-led-next-search-seeds-are-identifiable

- description: `gap_network` ResearchRoutePayload의 base view에서 모든 concept seed label은
  사용자가 다음 검색의 단서로 읽을 수 있는 식별 가능한 텍스트로 표시된다.
  화면 위치, 줌 상태, 클러스터 선택 여부와 무관하게 사용자는 어떤 seed가
  있는지 확인할 수 있다. cluster activation은 selection 및 연결 highlight만
  바꾸고 concept seed label 가시성을 current label 가시성을 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks`
  row for this Acceptance Check.

### acceptance-check:gap-led-next-search-seed-traces-to-papers

- description: 클러스터 내부 노드 단위 단서를 선택하면 그 단서를 뒷받침하는
  논문(제목 또는 식별 정보)이 따라간다. 사용자는 단서가 어떤 논문 근거에서
  왔는지 화면 안에서 확인할 수 있고, 그 논문을 paper-led 경로로 이어 갈 수
  있다. `analyzeGapNetwork`가 각 concept에 `supportingPaperIds`를 기록하고,
  focused cluster 카드에서 concept 선택 시 뒷받침 논문 제목이 노출된다.
  supportingPaperIds가 있고 cluster 안에서 매핑되는 논문 제목이 있을 때
  "뒷받침 논문" 라인을 함께 렌더한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks`
  row for this Acceptance Check.

### acceptance-check:gap-led-next-search-seed-launches-search

- description: 사용자가 선택한 단서(클러스터 라벨, concept 키워드, 공백
  라벨)를 새 검색 query의 출발점으로 가져갈 수 있는 명시적 액션이 있다.
  focused cluster/gap 카드에는 단일 "**[seedTerm] 으로 논문 검색**" 형태의
  버튼이 있고, 노드를 선택하는 것만으로는 검색하지 않으며 이 명시적 버튼이
  검색의 트리거다. 버튼을 클릭하면 `useSearchTermHandler`가 검색 실행을
  기다리지 않고 즉시 그 seedTerm을 담은 `/search?q=` 조건 route로 현재 브라우저
  창을 전환한다. 목적지 route가 검색 실행을 소유한다. 단서 검색 전환은
  `seedTerm`만 조건 URL의 검색어로 전달하고, retired `personalize` 기준이나
  legacy selected `libraryPaperIds`는 운반하지 않는다. 라이브러리 source가 있으면
  목적지 route가 메인 검색창과 같은 통합 projection으로 자동 반영한다.
  버튼 라벨은 cluster/concept/gap kind와 무관하게
  동일한 "[seedTerm] 으로 논문 검색" 형식을 사용해 사용자가 어떤 단어를
  검색에 가져갈지 한눈에 확인할 수 있게 한다 (kind는 analytics `data-seed-kind`
  속성에만 노출되고 라벨 문구에는 등장하지 않는다). seedTerm 자체는
  cluster 선택 시 cluster.label, concept 선택 시 concept.label, gap 선택
  시 gap displayLabel을 사용한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks`
  row for this Acceptance Check.
- revision: 3

### acceptance-check:gap-led-next-search-click-feedback

- description: 사용자가 focused cluster, concept, gap 카드에서 단서 검색 버튼을 plain click하면, 클릭한 버튼은 회전 표시와 `aria-busy` 상태를 즉시 보여 주고 같은 이동이 진행되는 동안 비활성화된다. 버튼은 seedTerm 문자열만이 아니라 자신이 여는 `entry=term` route identity와 현재 activation이 일치할 때만 이 상태를 보여 주며, 같은 query를 가진 상단 검색 activation과 혼동하지 않는다. 출발 연구 공백 리포트가 남아 있는 동안에는 선택한 seedTerm을 포함한 짧은 검색 이동 상태도 현재 scroll viewport에 보인다. 이 상태는 리포트를 대체하거나 검색 처리를 소유하지 않는다. 목적지 route 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. Ctrl/Cmd/가운데 클릭은 같은 검색 URL을 새 탭에서 열고 현재 창의 route·리포트·이동 상태를 바꾸지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3
