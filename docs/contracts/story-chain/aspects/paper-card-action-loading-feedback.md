---
id: aspect:paper-card-action-loading-feedback
slug: paper-card-action-loading-feedback
title: Paper card action loading feedback
appliesTo:
  - promise:search-results-fast-window
  - promise:citation-lineage
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/paper-card-action-loading-feedback.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Paper Card Action Loading Feedback

## Why

논문 카드의 후속 액션은 같은 자리에서 진행 중임을 보여야 한다. PDF, 인용 관계,
비슷한 논문처럼 새 route view나 새 탭을 여는 버튼이 눌렸는데 버튼이 그대로 있으면
사용자는 클릭이 먹혔는지 알 수 없고 같은 액션을 반복할 수 있다.

## Pointcut

반복 논문 카드 안에서 비동기 후속 route view를 여는 액션 버튼. 검색 결과, 인용 관계,
비슷한 논문 페이지의 paper card action row가 대상이다.

## Advice

비동기 카드 액션이 시작되면 해당 논문의 해당 액션 버튼은 같은 위치에서 spinner를
보이고 disabled 상태가 된다. 다른 논문 카드의 액션은 막지 않는다.

로딩 표현은 액션별 임의 UI가 아니라 shared paper card의 버튼 문법을 따른다.
PDF 열기, 인용 관계 열기, 비슷한 논문 열기는 모두 같은 크기의 inline spinner와
disabled opacity를 사용한다.

카드 액션의 가능 여부가 아직 확정되지 않은 progressive hydration 상태에서는
불가능하다고 단정하는 disabled 버튼을 보이지 않는다. 예를 들어 PDF availability가
아직 hydrate되지 않은 검색 카드에서는 같은 action row 위치에 `PDF 확인 중`과
inline spinner를 보여주고, hydrate 이후 실제 PDF 여부에 따라 활성 PDF 또는
비활성 PDF 상태로 전환한다.

카드 본문에 필요한 세부정보가 아직 보강 중이면 action row 바로 아래, 최종
인라인 분석/요약이 들어오는 자리와 같은 카드 골격 안에 낮은 강도의
`논문 정보 보강 중` 상태를 둔다. 이 상태는 `저자·초록 보강`과
`분석 입력 보강`처럼 실제 진행 단계를 이름 붙이며, 저자·초록·분석 입력이
아직 준비 중임을 알린다. 카드 본문에 가짜 skeleton 줄이나 결측 placeholder를
반복해서 그리는 대체 UI가 아니다.

## Verification

`SearchResultItem`의 graph-backed `비슷한 논문` loading 테스트와 기존 PDF/인용 관계
loading 테스트가 같은 카드 action row 문법을 검증한다. 검색 결과 progressive hydration과
graph_neighbors `cardDataHydration = pending` 테스트는 `PDF 확인 중`과 카드 세부정보
준비 상태가 같은 detail frame 안에 놓이는지도 검증한다. 각 문서 renderer는 자신의
handler loading paper id와 card-data hydration 상태를 `SearchResultItem`에 전달해야 한다.
