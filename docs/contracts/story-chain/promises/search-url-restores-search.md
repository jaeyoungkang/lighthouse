---
id: promise:search-url-restores-search
slug: search-url-restores-search
title: 검색 주소가 검색을 복원한다
moment: moment:route-search-entry
lane: search
status: declared
aspects:
  - aspect:search-first-url-model
  - aspect:first-paint-persistence-independence
  - aspect:immediate-navigation
acceptanceChecks:
  - acceptance-check:search-url-restores-search-url-carries-state
  - acceptance-check:search-url-restores-search-executes-in-place
  - acceptance-check:search-url-restores-search-share-reload
  - acceptance-check:search-url-restores-search-current-conditions-preserved
analyticsExempt: search execution initiated inside the app is observed by search_submitted and search_results_viewed (promise:search-results-fast-window); restoring a direct URL is not a new user action, so no separate canonical event is added
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 검색 주소가 검색을 복원한다

## Promise

검색 주소는 검색 그 자체다. 검색어와 정렬·연도·facet 조건은 `/search?q=...`
주소에 담기고, 그 주소를 새로 열거나 공유하거나 새로고침하면 같은 조건의
검색이 다시 실행된다. 결과를 보여 주기 위해 서버에 검색 기록이 미리 만들어질
필요가 없다. 다시 연 검색은 실행 시점의 최신 데이터를 따르므로 이전에 본
결과와 다를 수 있다. 화면은 이 사실을 숨기지 않는다 — 결과 기준 설명은 지금
실행된 검색의 조건을 보여 준다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-url-restores-search-url-carries-state

- description: 검색어·정렬·연도·facet 조건은 `/search?q=...` URL query에 담긴다. 같은 URL은 같은 조건의 검색 실행으로 해석되며, 조건을 바꾸는 refine 조작은 URL을 갱신한다. URL 밖의 숨은 서버 상태가 검색 조건을 소유하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-url-restores-search-executes-in-place

- description: `/search?q=...` 진입은 provider 실행을 시작하고, 결과 route view를 같은 주소에서 렌더한다. 검색 실행과 결과 기준 설명은 URL query의 조건에서 산출되며, 같은 조건 URL이 검색 route view의 정본 주소다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-url-restores-search-share-reload

- description: 같은 `/search?q=...` URL의 재진입·새로고침·공유 열람은 같은 조건 URL을 다시 실행한다. 결과 기준 설명(query·정렬·연도·loaded window)은 현재 실행 기준을 보여 준다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-url-restores-search-current-conditions-preserved

- description: 검색 실행 중 도착한 background enrichment는 시작한 URL query와 active execution이 현재 화면과 일치할 때만 반영된다. 늦은 응답은 논문 상세나 호환 경로의 보충 후보를 반영할 수 있지만, 사용자가 그 사이 바꾼 정렬·연도·facet 조건을 이전 값으로 되돌리지 않는다. 같은 URL을 다시 열면 그 URL의 조건으로 검색을 새로 실행하며, 이전 실행과 같은 결과 내용을 보장하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

## Contract Architecture Impact Review

Contract delta: URL 조건의 재실행과 한 실행 안의 `first_reveal_only` 정책을 함께 담던 Acceptance Check를 두 책임으로 분해한다. URL과 현재 사용자가 선택한 조건의 보존은 이 Promise가 소유하고, 늦은 라이브러리 후보 주입 금지는 기존 library-grounding Acceptance Check가 계속 소유한다.
Verdict: none
Affected axes: Source of truth and authority; State lifetime and recovery; Execution semantics; Runtime, external, or AI boundary; Compatibility and retirement
Existing-boundary evidence: `search-first-url-model`과 이 Promise가 이미 condition URL을 검색 조건의 정본으로 둔다. `activeExecutionId`가 background 작업의 stable identity다. 실행이 교체되면 기존 controller를 abort하고, execution·attempt key와 active controller가 같은 작업의 중복 실행을 막는다. view·owner·query·paper snapshot이 달라진 completion은 폐기하고, 같은 실행의 background metadata 3-way merge는 현재 정렬·연도·facet 조건을 보존한다.
Human decision required: no

## Concept Shift Architecture Review

| affected shape | verdict | reason |
| --- | --- | --- |
| condition URL과 URL query 해석 | preserve | 검색어와 정렬·연도·facet 조건의 현재 정본이다. |
| active execution identity와 background metadata 3-way merge | preserve | 이전 실행의 응답을 거부하고 현재 사용자가 선택한 조건을 보존한다. |
| `first_reveal_only` runtime policy | preserve | 현재 route 실행에서 늦은 라이브러리 후보 주입을 막는 좁은 계약으로 남고, `library-interest-default`와 `library-anchor-blend` Acceptance Check가 소유한다. 같은 condition URL의 새 실행 결과까지 고정하지 않는다. |
| `acceptance-check:search-results-fast-window-first-reveal-stable` | remove | URL 조건 보존과 한 실행 안의 library-grounding 정책을 한 identity에 섞던 계약이다. 두 의미를 현재 소유자에 나눴으므로 이 identity는 제거한다. |
