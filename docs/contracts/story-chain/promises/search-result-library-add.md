---
id: promise:search-result-library-add
slug: search-result-library-add
title: 검색 결과에서 논문을 라이브러리에 추가하거나 해제한다
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:paper-card-presentation-consistency
acceptanceChecks:
  - acceptance-check:search-result-library-add-card-action
  - acceptance-check:search-result-library-add-reviewed-papers-basis
  - acceptance-check:search-result-library-add-analytics
requiredEvents:
  - paper_saved
  - paper_unsaved
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`

# 검색 결과에서 논문을 라이브러리에 추가하거나 해제한다

## Promise

연구자는 검색 결과를 훑는 자리에서 읽어 둘 논문을 Light House 라이브러리에 바로
추가할 수 있다. 이미 추가된 논문은 같은 카드에서 라이브러리에서 해제할 수 있다.
추가된 논문은 기존 `reviewed_papers` 저장 경로에 남고, 해제된 논문은 그 경로에서
빠진다. 이후 같은 논문 카드는 현재 저장 상태에 맞는 action을 보여 준다.

이 저장 동작은 이후 검색의 라이브러리 근접도 원천이다. 다음 검색에서 내부 라이브러리
context가 있으면 `reviewed_papers`의 Episteme 3 paper reference가 근접도 anchor로 쓰인다.
논문을 해제하면 다음 검색의 내부 library context에서도 그 논문이 제외된다.
내부 `reviewed_papers` 목록 UI는 이 저장 상태를 보여 줄 수 있다. 현재 새 검색과
후속 검색은 이 `reviewed_papers` source를 검색어 관련도와 자동으로 함께 반영한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:search-result-library-add-card-action

- description: 검색 결과 카드는 PDF/인용/비슷한 논문 같은 탐색 action row와 라이브러리 저장 상태 토글을 시각적으로 분리한다. 제목 공간을 보존하기 위해 이 토글은 고정 폭의 북마크 아이콘으로 표시한다. 저장되지 않은 논문은 외곽선 북마크와 accent 계열 테두리로, 이미 저장된 논문은 채워진 북마크와 success 계열 배경·테두리로 상태를 구분한다. 화면에는 긴 명령 문구를 반복하지 않지만 저장 전 접근성 label/title은 `라이브러리에 추가`, 저장 후에는 실제 동작인 `라이브러리에서 해제`를 가리킨다. 같은 토글을 누르면 현재 사용자 기준 Light House 라이브러리(`reviewed_papers`)에 저장하거나 제거한다. 토글은 저장 상태에 맞춰 다시 렌더되고, 저장/해제 mutation이 진행 중이면 비활성화해 중복 write를 만들지 않는다. 서버 저장 실패는 성공처럼 보존하지 않고 카드 상태를 실패 전 상태로 되돌린다. 성공한 카드 저장/해제는 같은 화면의 내부 라이브러리 목록 store와도 동기화된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 7

### acceptance-check:search-result-library-add-reviewed-papers-basis

- description: 검색 결과에서 라이브러리에 추가하거나 해제하는 기능은 `reviewed_papers`를 통해 이후 검색의 라이브러리 근접도 source를 바꾼다. 추가된 Episteme 3 paper reference는 다음 검색의 내부 근접도 후보가 되고, 해제된 논문은 다음 internal library context에서 제외된다. 내부 `reviewed_papers` 목록 UI는 같은 저장 상태를 보여 주거나 관리할 수 있고, 목록의 해제 action도 같은 DELETE 경로로 source row를 제거한다. 새 검색과 follow-up은 현재 사용자 `reviewed_papers` source를 검색어 관련도와 자동으로 함께 반영한다. 사용자가 라이브러리 반영 여부를 고르는 별도 preference는 두지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 9

### acceptance-check:search-result-library-add-analytics

- description: 검색 결과 카드의 라이브러리 저장이 서버에서 성공하면 canonical event `paper_saved`를 발행한다. 저장 해제가 성공하면 `paper_unsaved`를 발행한다. 클릭했지만 mutation이 실패한 경우에는 성공 event를 발행하지 않는다. 두 event는 analytics 계약의 `journey_context_id`, `search_context_id`, `paper_id`, `result_rank`, `source_surface`, `has_pdf`, `evidence_availability`를 사용해 같은 검색 여정의 결과 노출·논문 탐색과 연결한다. raw query, query hash, 논문 제목, 인증 token은 싣지 않는다. 검색 맥락이 없는 내부 라이브러리 목록의 해제는 검색 여정 event로 가장하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5
