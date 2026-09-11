---
id: promise:search-query-route-transition
slug: search-query-route-transition
title: 검색 query route 전환
moment: moment:search-query-route-transition
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:route-view-ai-comment-generation-routing
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:route-view-ai-reaction-rules
  - aspect:context-preserving-transitions
  - aspect:immediate-navigation
  - aspect:search-first-url-model
  - aspect:first-paint-persistence-independence
acceptanceChecks:
  - acceptance-check:search-query-route-transition-immediate-submit
  - acceptance-check:search-query-route-transition-submit-feedback
  - acceptance-check:search-query-route-transition-clears-stale-reaction
  - acceptance-check:search-query-route-transition-empty-results-immediate
  - acceptance-check:search-query-route-transition-browser-route-owned
  - acceptance-check:search-query-route-transition-inline-analysis-exposure-cycle
  - acceptance-check:search-query-route-transition-url-owned
  - acceptance-check:search-query-route-transition-route-owned-render
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 검색 query route 전환

## Promise

결과가 있는 검색 화면에서 사용자가 새 query를 제출하면 Light House는 브라우저
주소를 새 조건의 `/search?q=...`로 바꾸고 그 주소에서 새 검색을 실행한다. 새
검색의 source of truth는 `/search?q=...` 조건 주소다.
사용자가 새 query를 제출한 의도는 막지 않는다. 직전 결과로 돌아가는 복귀
경로는 브라우저 history가 소유한다 — 각 검색이
자기 조건 주소를 가지므로 브라우저 뒤로가기가 직전 검색 조건을 복원하고, 그
조건의 검색이 다시 실행된다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-query-route-transition-immediate-submit

- description: 검색 결과 상단 route 입력창에 새 query를 입력하고 제출하면 별도 확인 클릭 없이, 서버 왕복도 기다리지 않고 즉시 새 조건의 `/search?q=...` 주소로 전환한다(aspect:immediate-navigation). origin shell은 클릭을 확인하는 bounded activation만 둘 수 있고 provider 진행·성공·실패 같은 검색 처리 상태를 소유하지 않는다. destination `/search?q=` route는 current-user 해석이나 provider 검색 완료를 기다리는 동안 같은 조건 주소에서 route-owned `search processing state`를 먼저 스트리밍한 뒤 인증 challenge 또는 검색 결과로 전환한다. 이 pending 상태는 완료된 빈 결과나 `0건` 결과 header/list처럼 보이면 안 되며, 검색이 아직 진행 중임을 명시하고 destination content slot 높이를 보존한다. 새 검색 실행은 그 주소에서 시작되어 결과가 같은 주소에서 렌더된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:search-query-route-transition-submit-feedback

- description: 첫 검색 화면과 연구 화면 상단의 `논문검색` 버튼으로 검색을 제출하면, 클릭한 버튼은 목적지 화면이 도착하기 전부터 회전 표시와 `aria-busy` 상태를 즉시 보여 준다. 같은 검색 이동이 진행되는 동안 버튼을 비활성화해 중복 제출을 막는다. 출발 화면은 그대로 유지하고, 검색 처리 상태는 목적지 route가 소유한다. 목적지 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. 현재 주소와 같은 검색 route를 다시 제출할 때는 이동 상태를 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-query-route-transition-clears-stale-reaction

- description: 새 query를 제출하면 현재 결과 컨텍스트에 붙어 있던 AI 반응은 즉시 제거되고, 새 result commit 기준으로 갱신된다. 이전 결과의 반응이 새 결과의 현재 반응처럼 보이면 안 된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-query-route-transition-empty-results-immediate

- description: 현재 결과 컨텍스트가 비어 있으면 전환 확인 단계나 보류 없이 새 search request를 즉시 실행한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-query-route-transition-browser-route-owned

- description: 새 query 제출은 현재 브라우저 창을 새 조건의 `/search?q=...` 주소로 전환하고, 브라우저 history가 사용자의 복귀 경로를 제공한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-query-route-transition-inline-analysis-exposure-cycle

- description: 새 result commit은 이전 결과 batch의 인라인 분석 작업을 새 결과 전체로 선제 대체하지 않는다. 새 결과가 렌더되면 현재 result window의 카드 id와 새 result batch 기준 cycle로 인라인 분석 작업이 갱신되고, 이전 batch 작업은 새 result window가 현재 작업 대상을 다시 정한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-query-route-transition-url-owned

- description: 클라이언트 research route payload store는 현재 route 실행의 단일 `currentView`와 active-execution scalar 보조 상태만 소유한다. store 상태 변경, hydration, background enrichment, reaction sync는 브라우저 URL을 push/replace하지 않는다. URL 변경은 검색 submit, 후속 액션 클릭, 서버 route response 같은 명시적 navigation 경계만 소유한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:search-query-route-transition-route-owned-render

- description: 뷰의 수명은 route와 함께 시작하고 끝난다. route 전환 후 첫 렌더 프레임을 포함해, 이 route가 주입하지 않은 view(이전 route의 store 잔재)는 renderer와 reaction 앵커에 도달하지 않는다. route가 unmount되면 store의 현재 뷰는 비워지고, 떠난 뷰의 background 작업(인라인 분석, enrichment)은 중단·폐기된다. 반응 스트림 tool output이 화면 view를 교체하는 경로는 존재하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1
