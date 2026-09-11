---
id: promise:research-route-cap-feedback
slug: research-route-cap-feedback
title: route 검색 입력과 조건 주소 탐색
moment: moment:route-search-entry
lane: research-route
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:search-first-url-model
  - aspect:common-page-footer
acceptanceChecks:
  - acceptance-check:research-route-cap-feedback-route-search-visible
  - acceptance-check:research-route-cap-feedback-canonical-url
  - acceptance-check:research-route-cap-feedback-condition-overflow
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`

# route 검색 입력과 조건 주소 탐색

## Promise

연구 행위 route는 사용자가 현재 창에서 읽는 결과와 새로 시작하는 검색을 URL로
분리해 다룬다. 검색은 `/search?q=...`, 인용 계보는 `/citation?seedPaperId=...`,
비슷한 논문은 `/similar?seedPaperId=...` 조건 주소에서 실행되고, 연구 공백 리포트는
저장되는 산출물이라 `/gap/:id` 주소로 열린다. 검색어를 제출하면 브라우저
주소가 즉시 그 조건의 `/search?q=...`로 이동하고, 결과는 같은 주소에서
실행되어 렌더된다.

제품이 지원하는 범위를 넘는 조건 주소는 일부 조건을 잘라 다른 탐색으로
바꾸지 않는다. 새 주소를 만들 수 없으면 현재 화면에서 이유를 알리고,
직접 연 주소라면 provider 실행 전에 조건 오류를 보여 준다.

검색 query를 commit하는 입력은 한 화면에 하나만 보인다. 아직 query가 없는 빈
`/search` 시작 화면에서는 Moonlight Search 브랜드/설명 아래의 primary input이
그 입력을 소유하고, 검색 결과나 다른 탐색 화면처럼 하단에 실제 콘텐츠가
있으면 콘텐츠 위의 route-level command field가 그 입력을 소유한다. 검색 결과
본문은 결과 목록·기준 문구·refine controls에 집중한다.
출판연도·라이브러리 반영 같은 refine controls는 결과 개요 controls 안에 둔다.

검색·인용 계보·비슷한 논문 후속 탐색 액션은 현재 창의 로컬 상태에 화면을 쌓지
않고 현재 브라우저 route를 조건 주소로 push한다. 그래서 검색 결과 위에 후속
화면이 이어져 보이고, 브라우저 뒤로가기로 출발 탐색 조건이 복원된다. 연구 공백
리포트 생성은 별도 저장 artifact라 출발 화면의 host action이 snapshot 생성을
시작한 뒤 완성된 리포트의 `/gap/:id`를 새 detached 창에서 연다.

연구 공백 리포트는 저장되는 산출물이라 출발 route를 바꾸지 않고 새 창에서
열린다. 가입자의 공유 리포트 접근과 재사용은
`promise:shared-gap-report-member-access`가 소유한다. 검색·인용 계보·비슷한
논문 실행은 조건 URL의 provider 실행 경로에서 닫힌다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:research-route-cap-feedback-route-search-visible

- description: authenticated shell은 `DocumentRouteUtilityControls`와 `WorkspaceTabStrip` 없이 검색 entry point를 제공한다. 빈 `/search` route에서 query가 없으면 Moonlight Search 브랜드/설명 아래의 primary input이 단일 검색 commit 입력이며 상단 `ResearchRouteSearchBar`는 숨겨진다. 이 첫 화면만 의도적으로 중앙 정렬된 시작 화면을 쓰고, shared footer는 첫 viewport 아래에 남는다. query가 있는 검색 route나 다른 연구 행위 route에서는 `ResearchRouteSearchBar`가 콘텐츠 위의 단일 검색 commit 입력이고, 상단 입력 레일과 이후 document/result content는 같은 중앙 bounded rail을 공유한다. rail 내부의 텍스트와 카드 흐름은 왼쪽부터 읽히지만 rail 자체는 화면 가운데에 놓인다. route 전환 중에는 fake skeleton line, 반복 카드 pulse, spinner 대체 화면 없이 짧은 named transition 상태만 보여줄 수 있다. 로딩 중인 route에서도 shared footer는 header offset을 뺀 viewport content slot 뒤에 남아 빈 공간으로 올라오지 않는다. 검색 결과 본문에는 같은 query 입력과 별도 결과 타이틀 영역을 반복하지 않는다. 인증된 route search rail은 검색 입력/버튼과 계정 컨트롤 사이에 `내 라이브러리` 목록 편집 진입점을 둘 수 있다. 결과 header는 라이브러리 반영 여부를 문장으로 설명하지만 사용자가 `내 연구 기준`과 `검색어 기준`을 고르는 토글이나 탭을 만들지 않는다. 출판연도·facet·보조 정렬 같은 refine controls는 결과 기준 문구가 있는 header controls 안에 남을 수 있다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:research-route-cap-feedback-canonical-url

- description: 탐색 화면은 조건 주소가 정본이다. 검색은 `/search?q=...`, 인용 계보는 `/citation?seedPaperId=...`, 비슷한 논문은 `/similar?seedPaperId=...`로 열리고, 연구 공백 리포트만 `/gap/:id` id 주소를 갖는다. 같은 창에서 탐색 화면 사이의 전환은 browser history에 남아 뒤로가기가 이전 조건 화면을 복원한다. 연구 공백 리포트 생성은 출발 탐색 화면을 유지하고 별도 창에서 `/gap/:id`를 연다. route-owned 임시 view 상태는 조건 주소 수명 안에서 끝나며, 빈 query 없는 `/search` 시작 화면만 의도적으로 콘텐츠 없는 상태를 만든다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

### acceptance-check:research-route-cap-feedback-condition-overflow

- description: 검색·인용 계보·비슷한 논문의 조건 주소가 지원 범위를 넘으면 입력을 자르거나 빼서 다른 조건으로 실행하지 않는다. 제품 안에서 만든 주소는 현재 화면을 유지하고 조건을 줄이라는 안내를 보여 준다. 직접 연 주소는 provider 실행과 임시 view identity 생성을 시작하지 않고 명시적 조건 오류 상태를 보여 준다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1
