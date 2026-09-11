---
id: aspect:provider-failure-degraded-mode
slug: provider-failure-degraded-mode
title: Provider failure degraded mode
appliesTo:
  - promise:search-failure-degraded-at-url
  - promise:search-reaction-summarizes-terrain
  - promise:inline-analysis-auto-run
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:route-view-ai-comment-inline-surface
coveringLedger: docs/contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/414#issuecomment-5261507703

# Provider failure degraded mode

## Why

AI provider가 실패해도 Light House 자체가 멈추면 안 된다. 사용자는 현재
검색 결과, 인용 계보, 비슷한 논문, gap report처럼 이미 확보된 deterministic
surface를 계속 써야 한다. AI가 새 코멘트를 만들 수 없는 순간에는 그 사실만 짧게
알리고, 근거 없는 대체 요약이나 운영 디테일을 사용자에게 넘기지 않는다.

## Pointcut

이 Aspect는 모델 호출이나 AI 생성 payload에 의존해 visible reaction 또는
AI-generated content를 만드는 Promise에 적용한다.

검색 route AI comment generation, gap/citation reaction, inline analysis, route-owned
ResearchRoutePayload inline reaction surface처럼 provider 실패가 사용자 흐름을 끊을 수 있는 surface가
대상이다.

## Advice

Provider hard failure나 LLM key 누락은 route hard crash로 사용자 흐름을 끊지
않는다. Automatic route AI comment generation의 provider 실패, timeout,
invalid output은 `reaction: null`로 닫고 fallback comment를 persist하지 않는다.

Degraded 안내는 AI 반응을 만들 수 없다는 사실과 deterministic surface를 계속
쓸 수 있다는 사실만 말한다. Raw provider error, API key, stack trace, HTTP
status, 예외 클래스명 같은 운영 디테일은 사용자에게 노출하지 않는다.

Provider 실패 상태에서는 근거 없는 AI 대체 요약을 만들지 않는다. Visible failure
surface에는 근거 없는 AI follow-up surface를 붙이지 않되, settled ResearchRoutePayload
reaction이 이미 있는 explicit regeneration 실패에서는 같은 입력으로 ResearchRoutePayload
reaction generation을 처음부터 다시 부르는 결정적 '다시 생성' 액션 하나를 유지한다. 운영 로그에는
원인을 남겨 조사할 수 있어야 한다.

저장된 deterministic surface 위의 AI 보강만 실패한 경우에는 그 surface를 그대로
유지한 채 사용자가 보강을 명시적으로 다시 요청할 수 있다. 재시도 중에도 이미
확보한 근거를 가리지 않고, 화면 재방문이나 상태 조회만으로 자동 재실행하지 않으며,
실패하면 다시 같은 degraded surface로 돌아온다.

그래프 관계 탐색 surface(인용 계보의 그래프 인접 축, 그리고 검색 결과에서 직접
연 그래프 인접 ResearchRoutePayload)에서 provider 그래프 호출이 실패하면, 침묵하는 생략이나 빈
화면 대신 "지금 불러오지 못했다"는 짧은 degraded 안내를 보여 준다. 이 안내는
정직한 빈 결과(관련 논문이 실제로 없음)와 시각적으로 구분되어, 사용자가 "없음"과
"일시 오류"를 혼동하지 않는다. 이때 허용되는 유일한 action은 같은 요청을 그대로
다시 부르는 결정적(deterministic) 재시도뿐이며(전용 그래프 인접 ResearchRoutePayload에 한함), 근거
없는 AI 대체 요약이나 다른 follow-up surface는 붙이지 않는다. 인용 계보의 그래프
실패는 계보 본체(선행·후속)를 그대로 유지한 채 축 자리에만 degraded 안내를 둔다.

## Verification

`provider-failure-degraded-mode.ledger.yaml`는 automatic route AI comment generation
실패가 `reaction: null`로 닫히고, fallback comment를 만들거나 persist하지 않으며,
운영 로그가 보존되는지 검증한다.

기존 narrower ledgers는 각 surface의 deterministic failure state를 별도로 닫는다.
예를 들어 inline analysis는 실패 상태 badge를 남기고, gap/relationship graph
surface는 빈 결과와 일시 오류를 구분하는 deterministic failure state를 남긴다.
저장된 gap core 위의 explicit enrichment retry는 같은 ledger의 전용 Acceptance
Check가 graph 유지, 사용자 명시 요청, 자동 재실행 금지, 재실패 뒤 cooldown을
검증한다.
