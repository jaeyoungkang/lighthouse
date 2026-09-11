---
id: promise:search-empty-results-next-action
slug: search-empty-results-next-action
title: 검색 결과 없음은 실패와 구분해 다음 행동을 안내한다
moment: moment:route-search-entry
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
acceptanceChecks:
  - acceptance-check:search-empty-results-next-action-distinct-state
analyticsExempt: a successful zero-result search is client-visible screen state with no durable resource or new user action; existing search execution observability carries the query outcome
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/696#issuecomment-5433661399

# 검색 결과 없음은 실패와 구분해 다음 행동을 안내한다

## Promise

검색 실행은 성공했지만 현재 검색 조건과 일치하는 논문이 없으면 결과 영역은
검색 결과가 없다는 사실을 명시한다. 이 상태를 provider 실패나 아직 처리 중인
상태처럼 보이지 않게 하고, 사용자가 검색어나 필터를 바꿔 다시 탐색할 수 있게
다음 행동을 안내한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-empty-results-next-action-distinct-state

- description: provider 실행은 성공했지만 현재 검색어·필터와 일치하는 논문이 0편이면 결과 영역은 검색 결과가 없다는 안내와 검색어나 필터를 바꾸라는 다음 행동을 보여 준다. 이 상태는 provider 실패 안내·재시도 및 검색 처리 중 상태와 구분된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1
