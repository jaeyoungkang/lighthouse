---
id: promise:search-spelling-correction
slug: search-spelling-correction
title: 맞춤법이 틀린 검색어는 교정 검색을 제안한다
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
acceptanceChecks:
  - acceptance-check:search-spelling-correction-original-results-shown-first
  - acceptance-check:search-spelling-correction-corrected-query-not-auto-submitted
  - acceptance-check:search-spelling-correction-spelling-correction-metadata-recorded
  - acceptance-check:search-spelling-correction-corrected-suggestion-user-confirms
  - acceptance-check:search-spelling-correction-corrected-apply-route-owned
  - acceptance-check:search-spelling-correction-best-effort-silent-when-absent
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`

# 맞춤법이 틀린 검색어는 교정 검색을 제안한다

## Promise

사용자의 검색어에 명백한 맞춤법 오류나 오타가 있으면, 제품은 원 검색
결과를 먼저 표시한 뒤 교정한 검색어로 다시 검색할 수 있다고 제안한다.
교정 검색은 자동으로 실행하지 않는다. 교정은 사용자가 의도한 학술 주제를
보존하는 맞춤법·띄어쓰기·표기 수정으로만 제한해, 검색어 표기 실수 때문에
관련 논문 흐름을 놓치지 않게 한다.
사용자가 교정 제안을 선택하면 교정 검색어로 시작하는 새 검색은 메인 검색과
같은 route-owned 실행 모델로 canonical `/search?q=` 조건 주소로 이동해 그 주소에서 실행한다.
그래서 주소가 교정 검색어 기준의 condition route를 가리키고, 원 검색 결과로는
브라우저 뒤로가기로 돌아간다.
교정은 best-effort다. 교정기를 돌릴 수 없거나(LLM 키 미설정·timeout·실패) 명백한
표기 오류가 없으면 제안을 만들지 않고 조용히 넘어간다 — 사용자에게 "오타 없음"과
"교정 불가"는 같은 상태이고, 없는 교정을 지어내거나 강등 안내로 화면을 채우는
대신 침묵하는 것이 정직하다. 침묵은 가시적 설명 surface를 만들지 않으므로
`aspect:visible-explanation-sufficiency`의 pointcut 밖이다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-spelling-correction-original-results-shown-first

- description: 일반 단일 검색은 맞춤법 교정 검사 때문에 원 검색 결과 표시를 기다리지 않는다. 원 결과는 먼저 search view로 표시된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-spelling-correction-corrected-query-not-auto-submitted

- description: 교정 검색어가 감지되어도 제품은 자동으로 교정 검색어를 조회하지 않는다. 원 검색 결과 view에 `correctedQuery` 제안만 붙인다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-spelling-correction-spelling-correction-metadata-recorded

- description: 교정 제안이 표시될 때 search metadata에는 `spellingCorrection.originalQuery`와 `spellingCorrection.correctedQuery`가 기록된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-spelling-correction-corrected-suggestion-user-confirms

- description: 교정 제안은 원 검색어와 교정 검색어를 함께 보여주고, 사용자가 선택할 때만 교정 검색어로 새 검색을 시작한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:search-spelling-correction-corrected-apply-route-owned

- description: 사용자가 교정 제안을 선택하면 교정 검색은 로컬 card-only 재실행이 아니라 메인 검색과 같은 route-owned 실행 모델로 교정 검색어의 canonical `/search?q=` 조건 주소로 이동해 그 주소에서 실행한다(현재 sort·연도 조건은 함께 싣고 별도 basis 파라미터는 만들지 않는다). 따라서 주소가 교정 검색어 기준의 조건 route를 가리키고, 원 검색 결과로의 복귀는 브라우저 history가 제공한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3


### acceptance-check:search-spelling-correction-best-effort-silent-when-absent

- description: 교정은 best-effort다. LLM 키 미설정·timeout·파싱 실패로 교정기를 닫을 수 없거나 명백한 표기 오류가 없으면 `resolveSearchSpellingCorrection`은 `null`을 돌려주고 search metadata에 `spellingCorrection`을 쓰지 않는다. 그 결과 교정 제안 행이나 강등 안내 문구를 렌더하지 않고 조용히 넘어간다(없는 교정을 지어내지 않는다). 정규화상 원 검색어와 동일한 교정 결과도 제안으로 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
