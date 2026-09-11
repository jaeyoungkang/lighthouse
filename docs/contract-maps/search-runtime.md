# Search Runtime Contract Map

이 맵은 "사용자 직접 검색이 요청에서 결과 화면·반응 입력까지 어떻게 처리되는지,
그리고 라이브러리-grounded 동작이 어디에 걸려 있는지" 함께 읽을 파일을 고르기
위한 navigation이다.

런타임 절차의 정본은 runtime-flow 문서이고, 제품 의미는 Story Chain, 깨지면 안 되는
계약은 Evidence Ledger다. 이 맵은 그 사이를 잇는 읽기 경로일 뿐 — 순서·상수·계약을
여기서 만들지 않는다. 값(상수·cap)은 코드와 runtime-flow 문서가 정본이며 여기서
다시 적지 않는다.

## 단계별 처리 (how)

검색은 `/search?q=` URL 조건 해석 후 provider keyword fetch와
My Library graph preflight를 병렬로 시작한다. 첫 ephemeral ResearchRoutePayload는
keyword 결과와 preflight 완료를 co-equal 입력으로 기다려 라이브러리 anchor-blend를
닫은 채 한 번에 공개하고(preflight가 예산 안에 실패하면 keyword-only로 나간다),
title-family dedup → 통합 기본순 projection → 보조 정렬 →
공백 분석 입력·반응 입력 handoff로 이어진다. 경계 상수 표와 degrade 순서는
retrieval/ranking runtime-flow 문서에 있다. 조건 URL과 route 수명, background 보강,
관계 후속 탐색은 각각 별도 owner 문서로 읽는다.

Sources:

- [`docs/runtime-flows/search-mechanism.md`](../runtime-flows/search-mechanism.md)
- [`docs/runtime-flows/research-route-lifecycle.md`](../runtime-flows/research-route-lifecycle.md)
- [`docs/runtime-flows/search-retrieval-ranking.md`](../runtime-flows/search-retrieval-ranking.md)
- [`docs/runtime-flows/search-background-enrichment.md`](../runtime-flows/search-background-enrichment.md)
- [`docs/runtime-flows/relationship-exploration.md`](../runtime-flows/relationship-exploration.md)
- [`app/(research)/search-route-page.tsx`](../../app/%28research%29/search-route-page.tsx)
- [`app/server/services/search-execution.ts`](../../app/server/services/search-execution.ts)
- [`app/server/services/search-service.ts`](../../app/server/services/search-service.ts)
- [`app/components/research-route-renderers/search-view.helpers.ts`](../../app/components/research-route-renderers/search-view.helpers.ts)
- [`app/lib/view-snapshot.ts`](../../app/lib/view-snapshot.ts)
- [`app/domain/view-snapshot.ts`](../../app/domain/view-snapshot.ts)
- [`app/lib/constants.ts`](../../app/lib/constants.ts)

## 라이브러리-grounded 랭킹

라이브러리 신호가 있는 코호트 독자는 풀이 확대되고, folder별 anchor set으로 Episteme
graph neighborhood를 블렌딩한다. Episteme는 제품 중립적이며(corpus_id·exclude만),
Light House가 folder→anchor 변환·병합·top-N 주입·interest projection을 담당한다.
기본 통합 정렬에서는 키워드 결과와 query-aware 라이브러리 근접 보강 후보가 같은
weight-ranked pool에서 경쟁한다. Keyword provider 순위와 query-aware graph 관계를
같은 최대 기여도로 결합하고, 양쪽에 걸친 논문은 두 점수를 모두 받는다. 정확한 값은
Story Chain과 ranking runtime owner를 따른다. 고정 슬롯은 배급하지 않는다. 사용자가
별도 결과 기준을 고르는 escape hatch는 없다.
신호가 없으면 일반 검색으로 degrade한다.
이 cross-cutting 규칙의 정본은 Aspect와 covering Ledger다.

Sources:

- [`docs/runtime-flows/search-retrieval-ranking.md`](../runtime-flows/search-retrieval-ranking.md)
- [`docs/contracts/story-chain/aspects/library-grounded-research.md`](../contracts/story-chain/aspects/library-grounded-research.md)
- [`docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml`](../contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml)
- [`app/server/services/search-hydration.ts`](../../app/server/services/search-hydration.ts)
- [`app/server/services/library-neighborhood-discovery.ts`](../../app/server/services/library-neighborhood-discovery.ts)
- [`app/server/services/library-context-source.ts`](../../app/server/services/library-context-source.ts)

## 단일 결과와 정렬

결과 header는 라이브러리 근거의 실제 반영 여부만 설명하고 결과 기준 토글이나 탭을
제공하지 않는다. Library 보유 여부는 post-mount bootstrap이 client store에 seed한다.
통합 projection은 검색어 결과와 graph preflight 결과를 모두 한 result pool에서
keyword provider 순위와 query-aware graph 관계 점수를 같은 최대 기여도로 결합해
정렬한다. 각 leg의 현재 상한과 dedup·combined-score 경계는
`search-retrieval-ranking.md`의 Boundary Constants와 Result Projection을 읽는다.
Library signal이 없을 때만 provider keyword 순서를 사용한다. 정렬 동작의 제품 의미는
아래 Promise의 Acceptance Check가 정본이다.

Post-mount availability와 source 수명은
[`research-route-lifecycle.md`](../runtime-flows/research-route-lifecycle.md)가,
현재 payload projection과 새 검색의 preflight 적용은
[`search-retrieval-ranking.md`](../runtime-flows/search-retrieval-ranking.md)가 소유한다.

Sources:

- [`docs/runtime-flows/research-route-lifecycle.md`](../runtime-flows/research-route-lifecycle.md)
- [`docs/runtime-flows/search-retrieval-ranking.md`](../runtime-flows/search-retrieval-ranking.md)
- [`app/stores/library-availability-store.ts`](../../app/stores/library-availability-store.ts)
- [`app/components/research-route-renderers/use-search-view-controller.ts`](../../app/components/research-route-renderers/use-search-view-controller.ts)
- [`app/components/research-route-renderers/search-view-content.tsx`](../../app/components/research-route-renderers/search-view-content.tsx)

## 카드 후속 검색

검색 결과 카드의 "비슷한 논문"은 현재 seed paper metadata로
`/similar?seedPaperId=...` 조건 route를 연다. 그래프 route를 만들 수 없는 seed는
seeded `/search?q=...&entry=similar` 조건 route로 fallback한다. "다른 입장"은
카드 inline analysis의 stance profile이 만든 counter-search query를
`/search?q=` 조건 route로 넘긴다. 둘 다 현재 브라우저 route 또는 detached 새 창이
조건 URL을 소유하며, 저장 id 탐색 route로 승격하지 않는다.

Sources:

- [`docs/runtime-flows/relationship-exploration.md`](../runtime-flows/relationship-exploration.md)
- [`docs/runtime-flows/research-route-lifecycle.md`](../runtime-flows/research-route-lifecycle.md)
- [`app/components/research-route-renderers/search-view-followup-handlers.ts`](../../app/components/research-route-renderers/search-view-followup-handlers.ts)
- [`app/components/research-route-renderers/search-result-inline-analysis.tsx`](../../app/components/research-route-renderers/search-result-inline-analysis.tsx)
- [`app/components/research-route-renderers/search-view.helpers.ts`](../../app/components/research-route-renderers/search-view.helpers.ts)

## 제품 약속과 실행 계약

검색 결과 윈도·라이브러리-grounded 동작·검색 반응은 아래 Promise와 covering Ledger가
정본이다. 현재 verdict는 `npm run mc:status`로 읽는다(맵에 상태를 박지 않는다).

Sources:

- [`docs/contracts/story-chain/promises/search-results-fast-window.md`](../contracts/story-chain/promises/search-results-fast-window.md)
- [`docs/contracts/story-chain/promises/search-reaction-summarizes-terrain.md`](../contracts/story-chain/promises/search-reaction-summarizes-terrain.md)
- [`docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml)
- [`docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml)

## Change Rule

검색 runtime이 바뀌면:

1. 조건 URL과 route 수명은 `research-route-lifecycle.md`, retrieval·ranking·상수는
   `search-retrieval-ranking.md`, background task는 `search-background-enrichment.md`,
   관계 후속은 `relationship-exploration.md`를 갱신한다. 공통 순서나 owner가 바뀔 때만
   `search-mechanism.md` overview를 갱신한다;
2. 변경한 owner 문서와 실제 runtime path를 함께 검토하고 관련 targeted test를 실행한다;
3. 영향 Promise/Aspect/Evidence Ledger를 같은 변경에서 닫는다;
4. 이 맵은 읽기 경로가 바뀔 때만 갱신한다.
