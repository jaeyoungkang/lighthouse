---
id: aspect:route-view-ai-reaction-rules
slug: route-view-ai-reaction-rules
title: Route-view AI reaction rules
appliesTo:
  - promise:reaction-from-visible-snapshot
  - promise:search-reaction-summarizes-terrain
  - promise:inline-analysis-auto-run
  - promise:gap-report-prepared-reaction
  - promise:search-query-route-transition
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:route-view-ai-comment-inline-surface
coveringLedger: docs/contracts/story-chain/evidence-ledgers/reaction-lifecycle.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Route-view AI reaction rules

## Why

AI 반응은 그것을 만들어 낸 화면 맥락에 귀속된다. 탐색 화면(검색·인용 계보·
비슷한 논문)의 반응은 현재 실행의 결과 스냅샷에서 생성되어 그 화면과 수명을
같이하고, 연구 공백 리포트 같은 저장 산출물의 반응만 산출물과 함께
저장·복원된다. 서로 다른 화면·산출물의 반응이 섞이면 사용자는 지금 보는
결과와 무관한 해설을 지금의 반응처럼 읽게 된다.

## Pointcut

이 Aspect는 화면별 AI reaction을 만들거나, 후속 reaction을 추가하거나,
reaction history를 저장·복원·교체하는 Promise에 적용한다.

검색, gap network, citation lineage, graph neighbors, 화면별 reaction
inline처럼 reaction이 특정 ResearchRoutePayload에 귀속되어야 하는 surface가 대상이다.

## Advice

AI reaction은 항상 그것을 소유한 맥락에 귀속된다. 탐색 화면의 reaction은 그
화면의 현재 실행에 귀속되어 영속되지 않고, 재실행이 새 reaction을 만든다.
저장 산출물의 reaction snapshot과 reaction history는 산출물 단위로
저장·복원된다. 다른 맥락의 reaction과 섞이면 안 된다.

AI reaction의 적절한 위치는 owning ResearchRoutePayload의 content rail 안이다. 검색,
인용 계보, 비슷한 논문처럼 comment가 ResearchRoutePayload 읽기 전에 필요한 표면은 같은
inline reaction treatment를 쓰고, gap network처럼 자체 그래프/본문 리포트가
prepared reaction을 흡수하는 ResearchRoutePayload만 별도 top slot을 만들지 않는다. 위치
차이는 ResearchRoutePayload의 읽기 흐름을 설명할 때만 허용되며, 타입별 장식이나 별도 AI
comment shell을 만들기 위한 예외가 아니다.

검색 결과 상단 AI comment 영역, 인용 계보 AI comment, 비슷한 논문 AI comment는
같은 visual treatment를 공유한다. Frame/background/border/padding/typography와
host-owned action row/button의 시각 문법은 Aspect가 통제하는 공통 규약이다. 각 route/view
host는 seed title card 아래, 결과 기준 아래처럼 위치만 조정할 수 있고, comment
자체를 full-width outline row, 본문 문단, 별도 카드 chrome 등으로 다르게
표현하지 않는다.

검색 결과, 인용 계보, 비슷한 논문 top AI comment의 연구 공백 진입은 host가
소유한 `연구 공백 지도 만들기` action으로 노출한다. 대표 논문 판단은 검색 결과
리스트의 대표 표시/필터 또는 gap network 리포트 내부 슬롯처럼 해당 ResearchRoutePayload
본문을 설명하는 위치에서 다룬다.

AI reaction을 생성할 때 load-bearing 본문은 현재 화면의 결과 스냅샷(저장
산출물이면 그 산출물의 본문)과 metadata에서 온다. 다른 화면·산출물은 alias,
제목, descriptor 수준의 참조로만 쓰고, 사용자가 명시적으로 가리키지 않는 한
그 본문을 현재 comment의 근거처럼 섞지 않는다. 열려 있지 않거나 다른
사용자 소유의 데이터는 reaction 입력과 화면에 포함하지 않는다.

## Verification

`reaction-lifecycle.ledger.yaml`의 `acceptanceChecks[]` assertion과 참조된
`executions[]`이 route-view ownership, inline placement,
visible `viewSnapshot` input scope, visual treatment parity, owned top follow-up
action, 다시 생성 action, generation endpoint behavior, gap reaction sub-resource
persistence, active-execution scalar replacement, and guarded clearing을 검증한다.
