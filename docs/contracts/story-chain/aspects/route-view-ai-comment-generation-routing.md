---
id: aspect:route-view-ai-comment-generation-routing
slug: route-view-ai-comment-generation-routing
title: route AI comment generation routing
appliesTo:
  - promise:reaction-from-visible-snapshot
  - promise:search-reaction-summarizes-terrain
  - promise:search-query-route-transition
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:route-view-ai-comment-inline-surface
coveringLedger: docs/contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# route AI comment generation routing

## Why

AI comment는 사용자가 검색 결과나 관계 화면을 열었을 때 현재 화면의 결과 맥락을
읽고 한 번 생성된다. 같은 화면을 여러 경로가 동시에 생성 대상으로 삼으면 사용자는
중복 comment를 보거나, 늦게 끝난 이전 요청 때문에 현재 comment가 사라진 것처럼 볼
수 있다.

이 Aspect는 일반 이벤트 처리 규칙이 아니라 화면별 AI comment의 사용자-facing
일관성을 소유한다. 현재 화면의 같은 결과 basis에는 하나의 생성 흐름만 대응하고,
화면이나 basis가 달라지면 서로의 comment를 덮지 않아야 한다. 자동 comment는
legacy interactive reaction stream이나 사용자 메시지를 거치지 않는다.

## Pointcut

검색·인용 계보·비슷한 논문 화면의 AI comment를 처음 생성하거나 다시 생성하고,
화면 전환·결과 basis 변경·실패 뒤에 comment를 교체하거나 보존하는 Promise에 적용한다.

## Advice

- 같은 화면과 결과 basis를 대상으로 한 중복 생성은 하나의 최신 요청으로 수렴한다.
  서로 다른 화면이나 서로 다른 결과 basis의 comment는 독립적으로 유지한다.
- 사용자가 현재 보고 있는 query·결과 basis와 일치하는 완료만 화면에 반영한다. 화면
  basis가 바뀌면 이전 comment와 늦게 도착한 완료를 버리고 현재 basis에서 다시
  생성한다. comment 입력과 무관한 UI 표시 변화만으로는 재생성하지 않는다.
- facet이 없는 검색처럼 첫 payload에서 comment basis가 고정되면 card hydration을
  기다리지 않고 생성한다. 저자·분야·venue·PDF loaded-result facet이나 비슷한 논문
  저자처럼 hydration이 현재 comment basis를 결정하는 경우에는 loading을 먼저
  표시하고, 해당 hydration이 닫힌 한 projection에서 한 번만 생성한다. 어느 생성
  진입이나 대기 경로도 이 준비 상태를 우회하지 않는다. 준비가 끝난 결과가 비어
  있으면 comment를 생성하지 않고 loading을 닫는다.
- 첫 생성이 실패하거나 결과가 비어 있으면 진행 상태를 내리고 성공 comment를
  상상해 만들지 않는다. 다시 생성하던 중 실패하면 기존의 성공 comment는 보존하고
  재생성 진행 상태만 내린다.
- 자동 comment는 짧고 제한된 생성 경로를 사용한다. 제한 시간을 넘기거나 사용할 수
  없는 출력이 나오면 같은 no-output 경계로 닫으며, legacy interactive stream이나
  고비용 tool loop로 우회하지 않는다.

## Runtime ownership

Queue identity, execution stamp, stale-completion guard, readiness builder와
각 generation ingress의 재확인, client/server deadline, structured output
budget과 provider gateway의 정확한 메커니즘은
`docs/runtime-flows/ai-response-generation.md`가 소유한다.

## Verification

`route-view-ai-comment-generation-routing.ledger.yaml`는 같은 대상의 중복 생성 수렴과
서로 다른 대상의 분리, 단일 trigger source, bounded generation을 검증한다.
`snapshot-reaction.ledger.yaml`는 현재 화면 basis와 일치하지 않는 완료를 거부하고 현재
basis에서 다시 생성하는지를 검증한다. 정확한 test·command·fixture와 runtime target은
각 Evidence Ledger가 소유한다.
