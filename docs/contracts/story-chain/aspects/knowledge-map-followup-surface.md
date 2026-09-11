---
id: aspect:knowledge-map-followup-surface
slug: knowledge-map-followup-surface
title: Knowledge map follow-up surface
appliesTo:
  - promise:search-reaction-summarizes-terrain
  - promise:gap-network-detection-from-search
  - promise:citation-lineage
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/knowledge-map-followup-surface.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Knowledge Map Follow-Up Surface

## Why

검색 결과, 인용 관계, 비슷한 논문은 모두 논문 묶음을 보고 다음 질문을 찾는
surface다. 이 묶음이 1편 이상이면 사용자는 같은 자리에서 연구 공백 지도로
넘어갈 수 있어야 한다. 이 진입점이 LLM surface 생성에만 맡겨지면 같은 데이터가
있어도 어떤 ResearchRoutePayload에서는 설명형 진입점이 빠져 사용자가 기능 존재를 예측할 수 없다.

## Pointcut

검색 결과 기준 row 우측 action, 검색 완료 AI 반응, 또는
ResearchRoutePayload 내장 AI 반응 surface가 검색 결과, 인용 관계, 비슷한 논문 ResearchRoutePayload 안에
렌더되고, 해당 ResearchRoutePayload가 gap-network 입력 논문을 1편 이상 제공하는 경우.

## Advice

연구 공백 진입점은 prompt 권고가 아니라 각 ResearchRoutePayload host가 ResearchRoutePayload metadata의 gap
입력 유무로 직접 거는 deterministic affordance다. LLM이 AI 반응 surface를
생략하거나 다르게 내더라도 진입점은 영향받지 않는다.

- 검색 ResearchRoutePayload는 적재된 검색 결과가 1편 이상이면 결과 기준 row 우측에
  `상위 논문 40개의 관계를 분석하여 연구 공백 찾아보기 >` action을 둔다.
  이 action은 새 창으로
  gap-network ResearchRoutePayload를 열며, 필터/정렬 컨트롤 줄, 검색 메타, 연구 용어 텍스트,
  AI comment body 내부 버튼 surface가 담당하지 않는다. 대표 논문은 후속 action이
  아니라 검색 결과 리스트의 대표 표시가 담당한다.
- 인용 관계 ResearchRoutePayload는 선행/후속 입력이 1편 이상이면 ResearchRoutePayload 상단 AI comment 영역에
  붙은 host-owned `현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >`
  action을 노출한다. 이 진입점은 LLM AI
  반응 surface가 아니라 인용 관계 ResearchRoutePayload host가 소유하며, 새 창으로 gap-network
  ResearchRoutePayload를 연다. AI 반응 본문 버튼 surface는 담당하지 않는다.
- 비슷한 논문 ResearchRoutePayload는 graph 후보가 1편 이상이면 같은 방식으로 ResearchRoutePayload 상단 AI
  comment 영역의 host-owned `현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >`
  action을 노출한다.
- 입력이 0편이면 진입점을 만들지 않는다.
- 세 surface(검색 결과·인용 관계·비슷한 논문)의 연구 공백 진입은 모두 같은 방식으로
  새 브라우저 창(detached)에 gap-network ResearchRoutePayload를 연다. 한 surface가 같은 탭으로 열어
  동작이 갈리지 않도록, 각 host는 공유 follow-up 네비게이션을 강제 새-창 activation으로
  호출한다.
- 새 창을 연 뒤에는 출발 surface가 앱 안의 다른 route로 바뀌거나 화면에서
  사라져도 새 창의 생성은 계속된다. 출발 surface의 생성 중 표시는 그 화면이
  남아 있는 동안에만 동작한다.

이 Aspect는 ResearchRoutePayload 본문에 중복 진입점을 추가하라는 뜻이 아니다. 검색 결과의 연구
공백 진입점은 검색 결과 기준 row 우측에 있고, 인용 관계와
비슷한 논문 ResearchRoutePayload의 진입점은 ResearchRoutePayload 내장 AI 반응 아래의 별도 action row에 있다.
검색 메타는 결과 조망에 집중하고, 연구 용어 텍스트는 AI comment 안에서 키워드
탐색에 집중하며, 본문은 각 ResearchRoutePayload의 관계 목록을 읽는 데 집중한다.

## Verification

Evidence Ledger는 검색·인용 관계·비슷한 논문 ResearchRoutePayload가 gap 입력이 1편 이상일 때
상단 AI comment 영역에 host-owned 설명형 연구 공백 action을 품는지, 그
action이 새 창으로 gap-network ResearchRoutePayload를 여는지, body-only AI 반응에서도 진입점이
host action으로 유지되는지, 요청 뒤 출발 surface가 사라져도 확보한 새 창 target의
handoff가 계속되는지 검증한다. AgentPanel은 AI comment 내부 버튼 surface를
렌더하지 않고, sync 단계도 gap surface를 합성하거나 보존하지 않는다.
Graph-neighbor source는 서버 gap-network route와 domain-access build path가 같은
visible snapshot과 co-cited/coupled shared-count 근거를 받아 실제 `gap_network`
입력으로 쓰는 테스트로 닫는다.
