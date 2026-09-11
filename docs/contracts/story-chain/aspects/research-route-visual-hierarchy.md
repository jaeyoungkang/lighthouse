---
id: aspect:research-route-visual-hierarchy
slug: research-route-visual-hierarchy
title: Research route visual hierarchy
appliesTo:
  - promise:research-route-cap-feedback
  - promise:search-results-fast-window
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:route-view-ai-comment-inline-surface
  - promise:gap-report-prepared-reaction
  - promise:inline-analysis-auto-run
coveringLedger: docs/contracts/story-chain/evidence-ledgers/research-route-visual-hierarchy.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/677#issuecomment-5406737609
Propagation Map: https://github.com/jaeyoungkang/lighthouse/issues/677#issuecomment-5407898225
Design reset: https://github.com/jaeyoungkang/lighthouse/issues/677#issuecomment-5411303984

# Research route visual hierarchy

## Why

연구자는 검색 조건을 확인하고, 결과 묶음과 논문 제목을 훑고, 근거와 상태를
읽은 뒤 다음 탐색을 고른다. 이 순서가 화면마다 다른 글자 크기와 강조도로
표현되면 같은 연구 흐름에서도 무엇을 먼저 읽고 무엇을 조작할지 다시 해석해야
한다.

작은 글자와 낮은 강조도를 함께 쓰면 필요한 metadata도 사실상 숨겨질 수 있다.
반대로 모든 항목을 크게 또는 진하게 만들면 논문 제목, 본문, 조작 요소와 상태가
서로 경쟁한다. Research route는 정보 역할을 기준으로 일관된 상대 위계를
유지해야 한다.

## Pointcut

검색 입력·라이브러리 메뉴, 결과 개요·필터·반복 논문 목록과 child action,
인용·비슷한 논문의 관계 섹션과 pending/degraded 상태, route AI comment, 연구
공백의 route context·본문·선택 요약과 pending/degraded 상태에 적용한다.

논문 카드 내부의 정보 순서와 액션 문법은
`aspect:paper-card-presentation-consistency`가 소유한다. AI comment frame은
`aspect:route-view-ai-reaction-rules`, 읽기 폭은
`aspect:document-content-width-governance`, 생성 전후 높이와 공간 안정성은
`aspect:progressive-content-spatial-stability`가 소유한다. 이 Aspect는 그 규칙을
다시 쓰지 않고, 각 surface의 텍스트와 조작 요소가 맡는 의미 역할과 상대적
강조 위계만 가로지른다.

`promise:similar-papers-discovery`처럼 카드 안의 한 진입 동작을 소유하는 Promise는
직접 pointcut이 아니다. 그 action은 자신이 놓인 검색·인용·비슷한 논문 surface의
control role을 따르고, 고유한 노출·전환 의미는 해당 Promise와 paper card Aspect가
계속 소유한다.

Gap graph의 SVG node·edge label은 데이터와 기하 배치가 함께 정하는 visualization
문법이므로 이 Aspect의 typography role class pointcut에서 제외한다. Graph와
paper card 사이의 관계 signal chip은 micro role을 사용하지만, SVG 내부 label의
크기·충돌 방지는 graph renderer owner가 계속 소유한다.

## Advice

- 화면의 텍스트와 조작 요소는 route heading, section heading, paper title,
  reading body, control label, compact control, metadata/status, micro label 가운데
  실제 의미에 맞는 역할을 사용한다. 컴포넌트 이름이나 현재 utility class가 역할을
  정하지 않는다.
- 같은 역할은 검색, 인용 계보, 비슷한 논문, 연구 공백에서 같은 상대적 강조도를
  유지한다. Route heading은 현재 작업의 기준점을, section heading은 정보 묶음을,
  paper title은 반복 후보의 식별자를 먼저 드러낸다. Reading body와 필요한
  metadata는 연속해서 읽을 수 있어야 한다.
- 필요한 metadata나 상태에 가장 작은 크기와 가장 낮은 강조도를 자동으로 함께
  적용하지 않는다. Micro label은 그래프 라벨이나 좁은 badge처럼 공간 제약이
  실제로 있는 보충 정보에만 쓴다.
- Control label은 조작할 수 있다는 사실이 metadata/status보다 분명해야 한다.
  반복 카드의 보조 action은 compact control을 사용해 논문 제목과 읽기 본문을
  압도하지 않되, 굵기와 action color로 metadata와 구분한다. 상태색은
  진행·성공·경고·오류처럼 실제 상태에만 쓰고, accent는 현재 action이나 선택을
  설명할 때만 쓴다.
- 좁은 화면에서 요소를 쌓거나 줄을 바꿔도 역할 순서는 유지한다. 핵심 제목,
  조작 가능성, 필요한 상태를 작은 글자나 낮은 강조도로 밀어내지 않는다.

구체 font family, 크기, 굵기, 행간, 색상, 간격과 radius 값은
`docs/design-standards.md`와 실행 token이 소유한다. 이 Aspect는 픽셀 값이나 특정
CSS utility를 제품 계약으로 고정하지 않는다.

## Verification

`research-route-visual-hierarchy.ledger.yaml`가 역할 class와 현재 구현값의 단일
정의, 실제 렌더 surface와 child control의 역할 배정, 이 변경에서 semantic role로
전환한 직접 소유 surface에 정의되지 않은 색상 alias가 다시 섞이지 않는지와
데스크톱·좁은 화면의 상대 위계 review를 닫는다. 기존 paper card, graph
visualization, AI comment, width, spatial stability Evidence Ledger는 각자의 고유
규칙을 계속 검증한다.
