---
id: aspect:paper-card-list-windowing
slug: paper-card-list-windowing
title: Paper card list windowing
appliesTo:
  - promise:search-results-fast-window
  - promise:citation-lineage
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/paper-card-list-windowing.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Paper card list windowing

## Why

논문 카드 목록은 읽기 후보를 빠르게 훑는 표면이다. 한 번에 너무 많은 카드를
DOM과 화면에 풀면 사용자는 목록의 경계를 잃고, 인라인 분석·PDF 열기·인용 계보
같은 카드 액션도 묻힌다.

검색 결과, 인용 관계의 선행/후속 목록, 비슷한 논문의 그래프 축은 서로 다른
후속 맥락이지만 모두 같은 논문 카드 목록이다. 따라서 목록 밀도와 확장 방식은
surface별 임의값이 아니라 하나의 shared policy를 따라야 한다.

## Pointcut

논문 카드가 반복 목록으로 렌더되는 surface. 검색 결과 본문, 인용 관계의
선행/후속 섹션, 비슷한 논문의 함께 인용/같은 토대 축처럼 사용자가 여러 논문
후보를 훑고 더 볼지 결정하는 곳이 대상이다.

## Advice

초기 DOM window는 10편이다. 11편째부터는 사용자가 `더보기`를 누르기 전까지
DOM에 포함하지 않는다.

더보기는 같은 목록 안에서 10편씩 확장한다. 여러 축이나 섹션이 있는 문서에서는
각 목록이 자기 window를 가진다. 한 섹션의 더보기가 다른 섹션의 노출 개수를
바꾸면 안 된다.

더보기 버튼은 현재 보이는 편수와 전체 편수를 `더보기 (N/M)` 형태로 보여준다.
남은 후보가 없거나 전체가 10편 이하이면 버튼을 보이지 않는다.

이 Aspect는 provider fetch limit나 corpus ranking을 정하지 않는다. 서버가
얼마나 가져오는지는 각 Promise가 맡고, 이 Aspect는 이미 열린 문서 안에서
논문 카드 목록을 어떻게 보이게 할지만 정한다.

## Verification

검색 결과는 `search-result-window.ledger.yaml`의 initial DOM window, load-more,
expanded-window persistence evidence가 닫는다. 인용 관계의 선행/후속 섹션과
비슷한 논문 그래프 축은 `graph-neighbor-papers.ledger.yaml`의 paginated-window
evidence가 닫는다. `SEARCH_RESULTS_INITIAL_VISIBLE_COUNT`는 literal 10으로
negative test에 고정되어, 세 surface가 같은 상수를 공유해야 한다.
