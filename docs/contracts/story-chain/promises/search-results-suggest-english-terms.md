---
id: promise:search-results-suggest-english-terms
slug: search-results-suggest-english-terms
title: 검색 결과에서 연구 용어를 제안한다
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:ai-comment-research-term-suggestions
  - aspect:immediate-navigation
acceptanceChecks:
  - acceptance-check:search-results-suggest-english-terms-result-basis
  - acceptance-check:search-results-suggest-english-terms-prefilled-search
  - acceptance-check:search-results-suggest-english-terms-click-feedback
  - acceptance-check:search-results-suggest-english-terms-term-seed-preserved
  - acceptance-check:search-results-suggest-english-terms-no-answer-state
  - acceptance-check:search-results-suggest-english-terms-background-llm-primary
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review


# 검색 결과에서 연구 용어를 제안한다

## Promise

사용자가 한국어 표현이나 아직 덜 정리된 말로 논문을 검색했을 때, 제품은
현재 검색 결과의 제목·초록과 inline analysis 맥락을 LLM에 앵커링해
방법·기여 명사구 가족을 연구 용어로 제안한다. 단순히 반복된
단어를 고르는 목록이 아니며, 원 검색어 자체나 너무 넓은 분야 라벨에
머무는 영어 표현은 제외한다. 첫 payload의 라이브러리 anchor graph evidence가
있으면 그 용어를 뒷받침하는 결과 논문의 graph score로 우선순위와 근거 문구를
보강한다. 용어 추출이 현재 결과 corpus id로 graph retrieval을 새로 시작하지 않는다.
이 추출은 검색 결과 표시를 막지 않는다. 검색이 끝나면 목록은 추출 중 상태로
먼저 나타나고, 몇 초 뒤 background 추출이 끝나면 그 자리를 채운다. LLM 추출이
닫히지 않거나 안정적인 후보가 없으면 결과 안에서 반복된 표현 기준의 임시 목록을
대신 만들지 않고 no-answer 상태로 닫는다.
목록의 첫 화면은 AI comment 안에서 본문 문장 속 텍스트 링크처럼 보이고,
사용자가 용어를 선택하면 그 용어가 어떤 결과에서 나왔는지와 다음 검색 액션을
확인할 수 있다.
각 용어는 번역 정답이 아니라 다음 검색을 시도해 볼 관측 단서로 다룬다.
사용자가 용어를 선택하면 해당 영어 표현으로 새 검색을 시작하고, 이후
검색 metadata에는 어떤 용어에서 이어졌는지 남긴다. 이 흔적은 analytics와
후속 처리에는 보존하지만 결과 헤더 문구로 반복 노출하지 않는다. 충분한
단서가 없으면 억지로 목록을 만들지 않고, 빈 추천 섹션도 표시하지 않는다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-results-suggest-english-terms-result-basis

- description: 연구 용어 제안은 검색 결과 view의 AI comment 본문 흐름 안에서 기존 term-discovery 후보를 클릭 가능한 텍스트 링크로 표시한다. 현재 결과의 제목·초록과 inline analysis 맥락을 앵커로 삼은 LLM 추출 accepted term만 보여주며, 화면 문구는 전체 검색 규모나 provider total을 읽은 것처럼 말하지 않는다. 후보 근거 문구에서 초록은 공백 정규화 뒤 내용이 있을 때만 `제목·초록` 근거로 세고, 없거나 공백뿐이면 `제목` 근거로 밝힌다. 공백 초록 논문에 graph support가 있으면 초록·방법 단서를 덧붙이지 않고 `제목 + 첫 검색 결과의 라이브러리 그래프 근거`로 두 근거만 조합한다. 첫 payload의 라이브러리 anchor 기반 graph support가 있으면 같은 term을 뒷받침하는 graph-supported paper 수를 priority와 candidate basis에 반영하되, 키워드 결과를 graph seed로 다시 조회하지 않는다. 화면은 읽기 쉬운 본문형 문장 안의 compact text-link 구조를 유지한다. 원 검색어와 같은 뜻의 말, 너무 넓은 분야 라벨, 단어 하나짜리 일반어는 제안에서 제외한다. 사용자가 term text를 선택하면 해당 용어로 새 검색을 시작하고 source query, term, candidate type, support count가 `termSeed`로 보존된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:search-results-suggest-english-terms-prefilled-search

- description: 사용자가 AI comment 본문 문장 안의 연구 용어 텍스트 링크를 선택하면 서버 왕복을 기다리지 않고 즉시 `/search?q=` entry route로 이동한다(aspect:immediate-navigation). plain click은 현재 브라우저 창을 같은 entry URL로 push하고, entry route의 서버가 그 용어의 같은 `/search?q=` 조건 주소에서 검색을 실행한다(redirect 없음). Ctrl/Cmd/가운데 클릭(detached)은 같은 entry URL을 새 브라우저 탭에서 열어 같은 조건 실행을 거치며 현재 브라우저 route와 출발 ResearchRoutePayload 상태를 바꾸지 않는다. 이 실행 입력은 legacy selected `libraryPaperIds`와 retired `personalize` 기준을 싣지 않으며, 라이브러리 source가 있으면 목적지 route가 통합 projection으로 자동 반영한다. source query, term, candidate type, support count는 redirect로 사라지는 transient entry URL 파라미터(`termSourceQuery`/`term`/`termType`/`termSupport`)로 운반해 실행된 검색 ResearchRoutePayload metadata의 `termSeed`로 보존하며, canonical `/search?q=` 조건 주소에는 seed 파라미터가 남지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 9

### acceptance-check:search-results-suggest-english-terms-click-feedback

- description: 사용자가 AI comment 안의 연구 용어 텍스트 링크를 plain click하면, 출발 화면이 남아 있는 동안 선택한 용어를 포함한 짧은 검색 이동 상태가 현재 scroll viewport에 즉시 보인다. 이 상태는 기존 검색 결과를 대체하지 않고 검색 처리 상태를 대신하지 않는다. 목적지 route 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. detached click과 현재 route로 향하는 no-op click은 현재 창에 이동 상태를 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:search-results-suggest-english-terms-term-seed-preserved

- description: AI comment 본문 문장 안의 연구 용어 텍스트 링크에서 이어진 검색은 source query, term, candidate type, support count를 `termSeed` metadata로 보존하되, 다음 검색 결과 헤더에는 "이전 용어" trace 줄을 반복 표시하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-suggest-english-terms-no-answer-state

- description: 현재 결과에서 안정적이고 다음 검색 단서로 쓸 수 있는 연구 용어를 만들 수 없으면 억지 추천 문구나 빈 추천 섹션을 표시하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-results-suggest-english-terms-background-llm-primary

- description: 검색 응답은 연구 용어 LLM 추출을 기다리지 않는다. 검색 ResearchRoutePayload는 `englishTermDiscovery.status="pending"`으로 커밋되고, AI comment 안의 연구 용어 텍스트 영역은 그 동안 추출 중 상태를 보여 준다. background 경로(`POST /api/search/term-discovery`)가 현재 결과 제목·초록과 inline-analysis 맥락을 compact prompt(상위 12편, 초록 300자)로 앵커링해 LLM 추출을 닫고 `status="ready"`, `source="llm"`로 PATCH한다. phase는 `initial` 하나뿐이며 inline analysis 완료 후 재추출하지 않는다. LLM 추출이 키 없음·timeout·파싱 실패로 닫히지 않거나 filter를 통과한 후보가 없으면 임시 fallback 목록을 만들지 않고 `source="llm"`의 빈 목록으로 정직하게 닫는다. background PATCH는 최신 search metadata의 query와 결과 표본이 추출 시작 시점과 같을 때만 저장하며, 늦게 도착한 stale snapshot이 닫힌 discovery 상태를 pending으로 되돌리거나 LLM 후보를 지우지 않는다. LLM이 supportPaperIds에 paperId 대신 프롬프트 나열 번호([N])를 echo하면 해당 번호의 표본 논문으로 결정적으로 복원해, 포맷 실수 하나가 정상 추출을 가짜 no-answer로 무너뜨리지 않는다. 첫 payload에 이미 고정된 library graph support는 LLM 후보를 새로 만들지 않고 이미 있는 후보의 근거 수와 순서만 보강한다. background 경로는 graph support를 새로 조회하거나 교체하지 않는다. method/contribution 명사구 가족이 실제로 등장하는지는 `slide accessibility` 재현 평가가 합격 기준으로 잠근다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5
