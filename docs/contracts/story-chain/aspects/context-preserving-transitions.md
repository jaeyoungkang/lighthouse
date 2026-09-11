---
id: aspect:context-preserving-transitions
slug: context-preserving-transitions
title: Context-preserving transitions
appliesTo:
  - promise:search-query-route-transition
coveringLedger: docs/contracts/story-chain/evidence-ledgers/search-query-route-transition.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Context-preserving transitions

## Why

연구자는 검색 결과, AI 반응, 인라인 분석 상태를 바탕으로 다음 판단을
이어간다. 제품이 route-level query request로 결과 컨텍스트를 바꿀 때마다
사전 확인을 요구하면 흐름이 끊긴다. 반대로 아무 복구 수단 없이 바꾸면
브라우저의 뒤로가기처럼 기대할 수 있는 안전망이 사라진다.

## Pointcut

이 Aspect는 사용자가 보고 있던 결과, 반응, 분석 상태를 새 route/query 또는
result commit 경계로 전환하는 Promise에 적용한다.

현재 pointcut은 검색 결과 route에서 새 query request를 제출해 결과 컨텍스트가
바뀌는 전환이다. 이후 gap report, citation lineage 같은 다른 route 전환이
기존 판단 맥락을 대체하는 경우 같은 Advice를 적용할지 검토한다.

## Advice

명시적인 사용자 행동은 불필요하게 막지 않는다. 사용자가 새 맥락으로
넘어가겠다는 의도를 직접 제출했다면 전환은 즉시 실행할 수 있다.

다만 전환이 기존 판단 맥락을 대체하거나 되돌림 비용을 만들면 사전 확인,
사후 복구, 병렬 보존 중 하나를 제공해야 한다. 의도가 명확한 전환에는
사후 복구가 우선이다. 의도가 불명확하거나 복구가 불가능한 전환에는
사전 확인 또는 무복구 사실의 명시가 필요하다.

## Verification

`search-query-route-transition.ledger.yaml`가 검색 query route 전환의 첫 적용을
검증한다. 새 query request는 확인 배너 없이 즉시 큐에 들어가되, 직전 result
snapshot을 복구할 수 있고 이전 AI 반응이 새 결과에 섞이지 않는다.
