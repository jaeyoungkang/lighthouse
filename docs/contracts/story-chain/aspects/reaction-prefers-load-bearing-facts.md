---
id: aspect:reaction-prefers-load-bearing-facts
slug: reaction-prefers-load-bearing-facts
title: Reaction prose prefers load-bearing facts over decorative phrasing
appliesTo:
  - promise:search-reaction-summarizes-terrain
  - promise:citation-lineage
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
  - promise:search-query-route-transition
  - promise:gap-led-next-search
coveringLedger: docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Reaction prose prefers load-bearing facts over decorative phrasing

## Why

사용자가 받는 생성 AI 반응은 결과 집합이나 문서를 빠르게 읽도록 돕는 짧은 글이다.
화려한 수사, 자기 자랑, 일반론적 안내문은 같은 분량 안에서 load-bearing 사실을
밀어낸다. 동규님 3차 베타 리뷰에서 인용 계보 반응이 장황하다는 피드백이
나왔는데, 핵심 문제는 길이가 아니라 톤이었다 — 사용자가 정말 알고 싶은 것은
"이 페이지가 어떤 데이터를 어떤 범위로 모았는가"이고, 그 한두 사실을 담백하게
받으면 충분하다. 이 Aspect는 검색 / 인용 계보 / 연구 공백 리포트 reaction처럼
런타임에서 생성되는 문구가 같은 톤 규칙을 공유하도록 횡단으로 묶는다.
고정 UI 문구와 공개 변경 로그 문체는 `aspect:user-facing-language-governance`의
고정 문구 트랙에서 닫는다.

`aspect:visible-explanation-sufficiency`가 어떤 근거와 한계가 보여야 하는지
정한다면, 이 Aspect는 그것을 어떤 문장과 제품 어휘로 말할지 정한다. 같은
근거라도 surface마다 "AI 추천", "AI 반응", "검색 결과", "해석"처럼
다른 함의를 가진 말로 흩어지면 사용자는 제품의 작동 방식을 다르게 이해한다.

## Pointcut

사용자에게 노출되는 route-view AI reaction — `title` / `body` — 를 생성하는
surface. 검색 요약, 인용 계보 설명, 후속 연구 공백 리포트의 narrative
section, paper-level reaction이 대상이다. 결정적 fallback chip, 시스템 event
echo, deterministic surface는 이 Aspect의 적용 대상이 아니다.

## Advice

- 반응의 거의 모든 문장은 한 가지 load-bearing 사실을 담는다. load-bearing
  사실은 결과 편수, 데이터 출처/한계, 수집 범위, 사용자가 다음에 무엇을 볼 수
  있는지처럼 사용자가 다음 행동에 쓰는 정보다.
- "흥미롭게도", "주목할 만한", "특히 인상적인", "다양한 측면에서" 같은 수식
  표현, 자기 자랑("저희가 정리한"), 일반론적 안내문("이 분야는 빠르게
  발전하고 있습니다")은 피한다.
- 같은 사실을 두 문장으로 풀어 쓰지 않는다. 동일한 정보의 paraphrase 반복은
  반응을 장황하게 만든다.
- 결정적 수치(논문 N편, 후속 N편, 빈 결과)는 그 자체로 본문에 그대로 들어가고
  "여러 편"이나 "다수" 같은 모호한 양화 표현으로 대체하지 않는다.
- 출처/입력의 한계가 명확하면 (예: 초록만 본다, 출판사 데이터가 선행 연구를
  주지 않는다) 그 한계를 한 문장으로 짧게 밝힌다.
- "추천"은 사용자가 임의 생성이나 editorial pick으로 읽을 수 있으므로, 실제
  검색 결과나 view 근거에 묶인 반응에서는 "현재 결과 기준", "현재 화면 기준",
  "현재 내부 그래프 기준"처럼 입력 범위를 말한다.
- 생성 콘텐츠의 설명 방향은 현재 열린 view가 사용자의 다음 판단에 필요한
  축을 우선한다. 검색 결과는 결과 집합의 지형과 반복 축을, 인용 계보는
  seedPaper 기준 선행/후속 흐름을, 비슷한 논문은 그래프 후보의 연구 결을,
  gap report는 top gap·대표 가설·연결 약한 클러스터의 관계를 설명한다.
  화면 밖 일반론이나 열려 있지 않은 view의 내용을 끌어와 comment를 넓히지
  않는다.
- "없음"은 실제 빈 결과와 source 한계를 섞는다. provider가 목록을 주지 않거나
  내부 그래프에서 edge가 부족한 경우에는 "목록 제한", "현재 내부 그래프에서
  확인된 연결 부족", "본문 인용 없음"처럼 확인 범위를 함께 말한다.
- 내부 색인이나 provider 이름은 독립 신뢰 근거처럼 쓰지 않는다. Episteme는
  Semantic Scholar dump 기반 내부 색인으로 말하고, Corca가 보강한
  concepts/claims/graph 정보는 원천 corpus가 아니라 보강 정보로 말한다.
- `aspect:visible-explanation-sufficiency`의 cap (title ≤30, body ≤400)을
  지키되, 이 Aspect는 같은 cap 안에서 표현 우선순위를 바꾼다.

## Verification

`search-reaction.ledger.yaml`와 route-view AI comment generation ledgers의
structured generation checks가 cap과 plain text boundary를 잠근다. 각 적용
Promise의 covering ledger 또는 live judge fixture가 톤 규칙을 검증한다 — 특히
`intent-check:result-set-terrain-is-not-query-repetition`(search reaction)이
"화려한 수사 대신 load-bearing 사실"이라는 기준을 이미 의미적으로 닫는다.
신규 reaction surface가 도입되면 같은 Aspect를 `appliesTo`에 추가하고
covering ledger에서 같은 톤 기준을 확인한다.
