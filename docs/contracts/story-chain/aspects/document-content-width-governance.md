---
id: aspect:document-content-width-governance
slug: document-content-width-governance
title: ResearchRoutePayload content width governance
appliesTo:
  - promise:route-view-ai-comment-inline-surface
  - promise:search-results-fast-window
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:gap-report-margin
coveringLedger: docs/contracts/story-chain/evidence-ledgers/document-content-width-governance.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# ResearchRoutePayload content width governance

## Why

연구 view는 화면마다 본문 폭이 제각각이면 같은 연구 흐름 안에서도 읽는 힘이
흩어진다. 검색 결과, 인용 계보, 비슷한 논문, 연구 공백은 모두 현재 route view
하나를 읽는 route 안에 있다. AI 반응이나 검색 개요, 그래프가 붙어도
본문은 너무 좁아지거나 무한히 퍼지지 않아야 한다.

이 Aspect는 현재 제품 기준에서 route view별 본문 rail을 보존하고, view 타입별
예외를 같은 숫자 체계로 관리한다. AI 반응은 ResearchRoutePayload content rail 안의
inline flow로 들어오며, 폭 정책은 읽기 rail과 host frame의 관계를 고정한다.

## Pointcut

이 Aspect는 research route에서 본문 rail, AI reaction slot, 검색 메타, AI comment의 연구 용어 텍스트,
관계 view 반복 카드, gap report 시각화 shell이 함께 화면 폭을 나눠 쓰는
Promise에 적용한다.

초기 빈 검색 화면처럼 검색 entry 자체가 주 화면인 경우는 중앙 시작 rail을 유지할
수 있다. Moonlight handoff는 결과 카드 affordance의 외부 읽기 경로로 다루고,
Light House 안의 폭 정책은 ResearchRoutePayload 본문 rail과 gap report shell을 대상으로 한다.

## Advice

- research route의 outer panel은 post-search view에서도 bounded rail을 화면 가운데에
  둔다. rail 안의 본문과 컨트롤은 왼쪽부터 읽히되, content shell은 별도 좌측
  padding rail을 중첩하지 않는다.
- 일반 본문과 반복 논문 카드 rail은 같은 읽기 폭을 공유한다. 검색 결과
  main column, 인용 계보, 비슷한 논문은 한 읽기 rail 체계를 따른다. 읽기 폭은
  단일 출처에서 와서 화면마다 흔들리지 않는다. 구체 폭 값은 약속이 아니라 읽기
  기준을 구현하는 현재 값이며, 그 기준은 `docs/design-standards.md`의 읽기
  measure가 정한다.
- 검색 결과 메타처럼 결과 전체를 조망하는 보조 정보는 owning 검색 ResearchRoutePayload header의
  보조 컨트롤 줄, publication-year dropdown preview, AI comment research-term
  text flow에 나뉘어 들어간다.
- 연구 용어 제안은 검색 메타 row를 키우지 않고 AI comment 본문 문장 안의
  clickable text로 표현한다. 별도 chip row나 card가 본문 rail의 높이를 차지하지
  않아야 한다.
- AI reaction은 owning route view의 content rail 안에 inline으로 남는다. viewport
  폭이나 panel 폭이 좁아도 같은 content rail과 host frame 폭을 유지한다.
- gap network는 낡은 읽기 shell 예외나 `1060px` 고정 폭을 쓰지 않는다. 그래프와
  본문 리포트는 중앙 정렬을 공유하되, 읽기 rail보다 넓은 시각화용 route-view
  rail을 쓴다. 시각화 rail이 읽기 rail보다 넓다는 관계가 폭 정책의 핵심이다.
  구체 폭 값은 단일 출처에서 오고, 약속은 그 관계이지 픽셀 숫자가 아니다.

## Propagation status

이 관계 중심(픽셀 비고정) 형태는 현재 `promise:gap-report-margin`에서만 AC·
Evidence 산문까지 완전히 이행됐다. 같은 Aspect가 적용되는 나머지 Promise —
`search-results-fast-window`, `citation-lineage`, `graph-neighbor-papers` — 의 AC
산문은 아직 구체 픽셀(`max-w-[1080px]` 등)을 단일 출처의 현재 값으로 인용한다.
이 값들은 후속 작업에서 같은 관계 형태로 옮긴다. 코드 층의 단일 출처는 이미
`research-route-layout.shared.test.ts`가 전역으로 강제하므로, 남은 차이는 계약 산문의
표현이지 코드 drift가 아니다.

## Verification

`document-content-width-governance.ledger.yaml`가 route-view reaction inline flow와 공통
width governance를 검증한다. 검색 결과의 post-search grid와 route command rail은
`search-result-window.ledger.yaml`가, gap network shell은 `gap-report-surface.ledger.yaml`가,
인용 계보와 비슷한 논문 rail은 각 Promise의 component evidence가 함께 닫는다.
