---
id: aspect:library-grounded-research
slug: library-grounded-research
title: Library-grounded research
appliesTo:
  - promise:search-results-fast-window
  - promise:search-nonascii-library-relevance
  - promise:search-reaction-summarizes-terrain
coveringLedger: docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`
CAIR record: `docs/contracts/story-chain/promises/search-results-fast-window.md#contract-architecture-impact-review`
Propagation Map: `docs/contracts/story-chain/promises/search-results-fast-window.md#propagation-map`

# Library-grounded research

CAIR record: `https://github.com/jaeyoungkang/lighthouse/issues/419#issuecomment-5140089462`

## Why

연구자는 빈손으로 검색하지 않는다. 이미 모아 둔 라이브러리가 그가 선 분야의
좌표다. 같은 검색어라도 그 좌표를 아는 검색은 연구자가 지금 어디에 서 있는지를
반영할 수 있다.

기본 제품 경로의 라이브러리 신호는 사용자가 Light House의 내 라이브러리에 저장한
논문에서 온다. 검색 결과에서 논문을 저장하거나 해제하면 그 변화는 이후 검색의
라이브러리 근접도에 반영된다(`promise:search-result-library-add`).

## Pointcut

내 라이브러리에 검색 기준으로 쓸 논문이 있는 검색과 그 검색의 결과·AI comment에
적용한다. 명시적으로 켠 외부 라이브러리 호환 경로도 같은 사용자-facing 규칙을
따르지만, 내부 저장 경계나 외부 provider 선택 자체는 이 Aspect의 제품 의미가 아니다.

## Advice

- 내 라이브러리 신호가 있으면 검색어 관련도와 라이브러리 근접도를 자동으로 함께
  반영한 한 결과 목록을 보여 준다. 사용자가 두 기준 사이를 고르는 토글·탭·별도 입력은
  만들지 않는다.
- 새 검색은 그때의 내 라이브러리를 근접도 source로 삼는다. 완료된 검색의
  라이브러리 정보는 그 검색을 설명하는 스냅샷일 뿐 이후 검색의 현재 기준이 아니다.
  첫 공개에서 근접도 기준과 한 결과 pool을 함께 확정하며, 논문 정보가 뒤늦게
  보강되어도 결과 멤버십·순서·근거를 바꾸지 않는다.
- 적용 가능한 라이브러리가 있지만 첫 공개의
  provider 보강을 일시적으로 사용할 수 없으면 keyword 결과를 유지하고 라이브러리를
  이번 결과에 반영하지 못했다는 안내를 보여 준다. 라이브러리 없음과 정상적인 graph 무신호는
  실패로 말하지 않는다. Provider·circuit·HTTP 세부정보는 server telemetry에만 남긴다.
- 통합 기본순은 검색어 결과 최대 40편과 라이브러리 그래프 결과 최대 40편을
  모두 한 결과 목록에 넣고, 같은 논문은 한 번만 남긴다. 검색어 관련도와 라이브러리
  인접도는 각각 최종 점수의 최대 절반을 차지한다. 같은 논문이 두 근거에 모두
  걸리면 두 점수를 함께 받는다. 어느 한 출처도 출처라는 이유만으로 상단 전체를
  선점하지 않으며 고정 위치도 배급하지 않는다.
- 키워드 결과 목록에 없고 라이브러리 그래프 결과에서 합류한 후보도 같은 결과
  수·더보기·facet·후속 입력에 참여한다. 이 후보는 별도 섹션이나 출처 marker를 만들지
  않는다.
- 결과 카드에는 양수의 query-aware 라이브러리 그래프 근접도 근거가 있는 논문을
  `내 연구와 가까움`이라고 표시한다. keyword 결과와 그래프에서 합류한 후보에 같은
  marker 하나를 사용한다. keyword 근거만 있는 논문에는 marker를 표시하지 않는다.
  별도의 keyword 또는 출처 marker는 만들지 않는다. 이 표시는 관련성을 확정하거나
  결과를 거르는 필터·액션이 아니다.
- 검색 결과의 AI comment는 현재 결과가 내 라이브러리와 가까운 갈래인지, 아직 다루지
  않은 쪽인지 설명한다. 라이브러리 신호가 없으면 일반 검색 근거만 말한다.
- 개인 라이브러리 식별자는 결과나 공유 artifact에 노출하지 않는다. 연구 공백 같은
  후속 분석은 첫 결과에 실제로 반영되어 사용자가 볼 수 있는 논문 근거만 이어받는다.

## Runtime ownership

Provider fan-out, 내부 저장 source, 외부 호환 source, neighbor hydration과
first-result ordering의 정확한 메커니즘은 `docs/runtime-flows/search-retrieval-ranking.md`가
소유한다.

## Verification

`library-grounded-research.ledger.yaml`는 자동 combined 멤버십, 검색어·라이브러리 순위
결합, 단일 라이브러리 근접도 marker, tagged unavailable 안내, 일반 검색 degrade와 개인 식별자 비노출을
Acceptance Check 행으로 검증한다. `search-reaction.ledger.yaml`는
AI comment가 현재 결과와 라이브러리의 관계를 설명하는지 검증한다. 정확한 테스트,
명령, fixture와 runtime target은 각 Evidence Ledger가 소유한다.
