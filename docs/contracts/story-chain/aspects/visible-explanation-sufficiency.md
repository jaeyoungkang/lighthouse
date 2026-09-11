---
id: aspect:visible-explanation-sufficiency
slug: visible-explanation-sufficiency
title: Visible explanation sufficiency
appliesTo:
  - promise:reaction-from-visible-snapshot
  - promise:search-empty-results-next-action
  - promise:search-results-fast-window
  - promise:search-spelling-correction
  - promise:search-results-suggest-english-terms
  - promise:search-reaction-summarizes-terrain
  - promise:inline-analysis-auto-run
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:route-view-ai-comment-inline-surface
  - promise:gap-led-next-search
coveringLedger: docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Visible explanation sufficiency

## Why

사용자가 판단에 쓰는 설명은 화면 안에서 바로 이해되어야 한다. 다른
패널이나 툴팁을 찾아야만 뜻이 보이는 설명은 맞지 않다.

이 Aspect는 말투보다 정보 구조를 맡는다. 사용자가 결과나 반응을
신뢰하려면 어떤 입력과 근거에서 나온 설명인지, 그 입력의 범위와
한계가 무엇인지 같은 자리에서 읽을 수 있어야 한다. source, input
scope, loaded window나 cap, known limit, fallback 신호가 흩어져 있으면
설명이 충분해 보여도 판단 근거는 충분하지 않다.

말투와 문장 트랙 분류는 `aspect:user-facing-language-governance`가 맡는다.
이 Aspect는 source, input scope, limit, fallback 같은 설명 구성요소만 맡는다.

## Pointcut

공개 검색 시작 화면, 검색 결과와 AI 반응, 인용 계보, 비슷한 논문, 연구 공백
리포트처럼 사용자가 제품 작동 방식이나 결과 근거를 이해하는 설명 텍스트가
있는 화면. 특히 설명이 현재 검색 결과, 현재 route view snapshot, 인용 묶음,
내부 그래프, fallback 경로에 기대는 surface가 대상이다.

## Advice

- 설명은 보고 있는 자리에 둔다.
- 설명이 특정 데이터 묶음에 기대면 그 묶음의 source와 input scope를 같은
  surface 안에서 드러낸다. 예를 들어 현재 결과 N편, 선행/후속 입력 분해,
  PDF caption/body mention, 내부 그래프 edge 수처럼 사용자가 판단에 쓰는
  단서를 숨기지 않는다.
- loaded window, 방향별 cap, provider가 주지 않은 목록, abstract·caption·edge
  부족, deterministic fallback처럼 설명의 신뢰 범위를 제한하는 조건은
  가능한 한 한 줄로 보인다.
- 사용자가 결과를 먼저 받았지만 세부정보·분석·보강 작업이 뒤따르는 경우,
  현재 무엇이 완료됐고 무엇이 진행 중인지 같은 화면에서 볼 수 있어야 한다.
  진행 중인 상태를 숨기거나 결측 데이터처럼 보이는 placeholder로 대신하지 않는다.
- provider나 내부 색인 이름은 단독으로 신뢰 근거가 되지 않는다. 사용자가
  모를 수 있는 이름을 쓸 때는 그 이름이 어떤 source lineage나 입력 범위를
  뜻하는지 표면 근처에서 알 수 있어야 한다.
- "다양한", "여러", "일부" 같은 모호한 말보다 구체적 근거를 쓴다.
- 판단에 필요한 현재 상태와 known limit, fallback·근거 부족 신호는 접힌
  화면에서도 읽혀야 한다. 이 정보는 `truncate`, `line-clamp-*`,
  `text-ellipsis`, `whitespace-nowrap`로 숨기지 않는다.
- 반복 카드나 자동 생성 영역이 공통 접힘 높이를 유지해야 할 때는 장문 body나
  summary를 제한된 미리보기로 보여줄 수 있다. 이때 잘렸다는 사실과 펼치기
  affordance가 바로 보여야 하며, 사용자가 펼치면 같은 자리에서 전체 내용을
  읽을 수 있어야 한다.
- 반복 논문 카드의 접힌 미리보기는 `요약`과 분석 상태를 보여 주되, 정확한 생성
  근거 라벨과 source/input scope 상세를 열린 inspection에 둘 수 있다. 단 접힌
  미리보기가 논문 전체를 읽은 결론처럼 보이지 않아야 하고, disclosure affordance가
  남아야 하며, 펼치면 같은 자리에서 생성 근거·source/input scope와 전체 상세를
  확인할 수 있어야 한다. 초록 없음·근거 부족·pending·error·fallback 같은 현재
  한계와 상태는 이 예외로 숨기지 않는다.
- route-view AI comment payload는 surface별 구조화 schema의 cap을 따른다.
  title <=30자, body <=400자, plain text only(마크다운 거부). surface별로 더
  짧은 local override는 허용하지만 cap을 넘기지 않는다.

## Verification

route-view AI comment generation ledgers의 structured generation execution이
body 길이, plain text, nullable failure boundary, runtime success boundary를
검증한다.

각 적용 Promise의 covering ledger는 해당 surface가 충분한 설명을 실제 DOM,
structured generation payload, 또는 live judge fixture에서 보이는지 별도로
검증한다. Source/input/limit/fallback 단서는 shared legacy surface schema보다
surface별 데이터 구조에 가깝기 때문에 검색, citation lineage, gap report의
개별 ledger가 필요한 범위만 닫는다.

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747
