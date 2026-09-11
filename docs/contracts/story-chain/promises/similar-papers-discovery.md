---
id: promise:similar-papers-discovery
slug: similar-papers-discovery
title: 유사 논문 발견
moment: moment:paper-led-followup-discovery
lane: search
status: propagated
aspects:
  - aspect:first-paint-persistence-independence
  - aspect:search-first-url-model
  - aspect:immediate-navigation
acceptanceChecks:
  - acceptance-check:similar-papers-discovery-similar-button-on-each-paper
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-new-search-view-with-seed-metadata
  - acceptance-check:similar-papers-discovery-seed-paper-excluded-from-results
  - acceptance-check:similar-papers-discovery-fallback-to-title-only-query
  - acceptance-check:similar-papers-discovery-same-basis-reuse
  - acceptance-check:similar-papers-discovery-author-topic-search
  - acceptance-check:similar-papers-discovery-seed-paper-in-reaction-context
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 유사 논문 발견

## Promise

검색 결과의 논문에서 비슷한 논문을 바로 찾는다.
사용자는 기준 논문 주변의 관련 연구 흐름을 넓혀 후속 읽기 후보를 만든다. Episteme 3
paper reference로 식별되는 논문은 graph-backed 비슷한 논문 ResearchRoutePayload가 우선
경로이고, 키워드 prefill search는 graph lookup을 만들 수 없는 legacy 논문의 fallback이다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:similar-papers-discovery-similar-button-on-each-paper

- description: 각 논문 항목에 "비슷한 논문" 버튼이 노출된다. Episteme 3 paper reference로 식별되는 논문에서는 같은 버튼이 graph-backed 비슷한 논문 ResearchRoutePayload를 열고, graph lookup을 만들 수 없는 legacy 논문에서는 기존 키워드 prefill fallback을 연다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:similar-papers-discovery-fallback-query-opens-route

- description: Episteme 3 paper reference가 없는 fallback에서 클릭 시 제목 + 인라인 분석 topics를 조합해 쿼리를 구성하고, 서버 왕복을 기다리지 않고 즉시 `/search?q=` entry route로 이동한다(aspect:immediate-navigation). entry URL은 slim seed 논문 정체성(`seedPaperId`/`seedPaperTitle` 등, abstract·authors 제외)을 transient 파라미터로 운반하고, entry route의 서버가 같은 URL에서 search result surface를 실행·렌더한다. retired `personalize` 기준은 운반하지 않으며, 라이브러리 source가 있으면 목적지 route가 통합 projection으로 자동 반영한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:similar-papers-discovery-new-search-view-with-seed-metadata

- description: Episteme 3 paper reference가 없는 legacy fallback의 새 검색 ResearchRoutePayload는 기존 search ResearchRoutePayload로 생성하고, `seedPaper` 메타데이터(최소한 `paperId`와 제목)를 해당 문서에 기록해 "이 논문에서 출발했다"는 맥락이 후속 UI에서 시각적으로 추적 가능하도록 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:similar-papers-discovery-seed-paper-excluded-from-results

- description: Episteme 3 paper reference가 없는 fallback 검색 결과에서 출발 논문 자체는 제외한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:similar-papers-discovery-fallback-to-title-only-query

- description: Episteme 3 paper reference가 없는 fallback에서 인라인 분석 미완료 시 제목만으로 쿼리를 구성한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:similar-papers-discovery-same-basis-reuse

- description: Episteme 3 paper reference가 없는 fallback에서 같은 `seedPaper.paperId`가 현재 client state에 있어도 클릭은 route-owned `/search?q=` 조건으로 진입한다. 같은 seed라도 URL 조건의 query와 transient seed 정체성이 현재 요청을 소유하며, retired `personalize` 기준은 identity나 projection에 참여하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:similar-papers-discovery-author-topic-search

- description: 검색 결과 카드의 저자명과 인라인 분석 주제 키워드는 클릭 가능한 검색 진입점이다. 클릭하면 같은 search-term handler로 서버 왕복을 기다리지 않고 즉시 `/search?q=` entry route로 전환하며(aspect:immediate-navigation), entry route의 서버가 같은 URL에서 그 용어 검색을 실행·렌더한다. plain click 뒤 출발 화면이 남아 있는 동안에는 선택한 저자명 또는 주제를 포함한 짧은 이동 수신 상태가 현재 scroll viewport에 즉시 보이고, 기존 카드와 결과는 유지한다. 목적지 route 도착, 동기 navigation 호출 실패, 또는 bounded stale timeout으로 같은 activation만 정리하며, 연속 클릭의 새 상태를 이전 cleanup이 지우지 않는다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. Ctrl/Cmd/가운데 클릭은 같은 entry URL을 새 탭에서 열고 현재 창의 route·출발 ResearchRoutePayload·이동 상태를 바꾸지 않는다. 현재 route와 정확히 같은 URL을 향하는 no-op도 이동 상태를 만들지 않는다. 이 경로는 legacy selected `libraryPaperIds`와 retired `personalize` 기준을 싣지 않으며, 라이브러리 source가 있으면 목적지 route가 통합 projection으로 자동 반영한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:similar-papers-discovery-seed-paper-in-reaction-context

- description: Episteme 3 paper reference가 없는 legacy fallback으로 비슷한 논문에서 출발한 검색 ResearchRoutePayload는 AI 반응 생성 컨텍스트에 `seedPaper` 정보(제목·paperId)를 노출해, 에이전트가 같은 결과 집합이라도 "seed 논문을 기준으로 한 비슷한 결의 후보 뷰"로 명시적으로 frame하도록 한다. 그래서 seed 논문 자체의 일반 검색 반응과 똑같은 문장이 새 브라우저 문서에서 되풀이되지 않는다. seed 정보가 없는 일반 검색 ResearchRoutePayload에는 이 줄이 들어가지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
