---
id: promise:search-failure-degraded-at-url
slug: search-failure-degraded-at-url
title: 검색 실패는 같은 주소에서 복구한다
moment: moment:route-search-entry
lane: search
status: declared
aspects:
  - aspect:search-first-url-model
  - aspect:first-paint-persistence-independence
  - aspect:immediate-navigation
  - aspect:provider-failure-degraded-mode
acceptanceChecks:
  - acceptance-check:search-failure-degraded-at-url-degraded-surface
  - acceptance-check:search-failure-degraded-at-url-retry-reruns
analyticsExempt: the degraded failure surface is client-visible screen state with no durable resource; search execution failure observability is carried by the existing search execution server events and provider-failure signals
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 검색 실패는 같은 주소에서 복구한다

## Promise

검색 실행이 실패하면 같은 주소에서 통일된 안내가 보인다. 화면은 빈 결과나
성공한 검색처럼 꾸미지 않고, 결과를 가져오지 못했다는 사실과 다시 시도하는
길을 보여 준다. 다시 시도는 같은 주소의 검색을 다시 실행하는 것이고,
새로고침도 같은 재시도다. 실패는 서버에 남는 기록이 아니라 지금 화면의
상태이므로, 사용자는 실패한 주소를 떠나지 않고 그 자리에서 복구한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-failure-degraded-at-url-degraded-surface

- description: provider 실행이 실패하면 같은 `/search?q=...` 주소에서 degraded 안내와 재시도 affordance를 렌더한다. 실패 화면은 빈 결과 화면·성공 화면과 구분되는 명시적 실패 상태이고, 가짜 스켈레톤이나 무한 로딩으로 실패를 가리지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-failure-degraded-at-url-retry-reruns

- description: 재시도와 페이지 새로고침은 같은 조건 주소를 다시 실행한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
