---
id: promise:search-nonascii-library-relevance
slug: search-nonascii-library-relevance
title: 저장된 비ASCII 라이브러리 보충 결과를 호환해 읽는다
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:library-grounded-research
acceptanceChecks:
  - acceptance-check:search-nonascii-library-relevance-korean-overlap
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 저장된 비ASCII 라이브러리 보충 결과를 호환해 읽는다

## Promise

저장된 과거 검색 snapshot에 한국어처럼 ASCII 토큰으로 나뉘지 않는 검색어와
라이브러리 보충 후보가 함께 있으면, 제품은 그 snapshot을 기존 의미대로 읽는다.
검색어와 후보 논문의 제목·초록·저자 텍스트가 같은 문자권에서 충분히 맞닿은
후보와 약한 문자 조각만 우연히 겹친 후보를 구분한다.

새 검색은 언어별 token floor 대신 query-aware 라이브러리 그래프 근접도로
검색어 일치 논문과 인접 후보를 한 목록에서 정렬한다. 기존 Hangul/CJK overlap과
visibility event는 저장 snapshot reader에서만 유지한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-nonascii-library-relevance-korean-overlap

- description: 저장된 과거 검색 snapshot에 keyword 결과 창에는 없고 라이브러리에서 합류한 보충 후보가 있으면 Hangul/CJK-aware token overlap으로 한국어 검색어와 후보 논문 텍스트의 관련성을 기존 방식대로 판정하고 기존 visibility event를 호환해 유지한다. 새 검색의 combined pool은 이 token floor나 고정 rank ceiling을 쓰지 않고 언어와 무관한 query-aware 그래프 근접도 순서를 사용하며, legacy visibility event를 새로 발화하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4
