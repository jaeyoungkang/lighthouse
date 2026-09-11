# Relationship Exploration

검색·인용·비슷한 논문 카드에서 시작하는 인용 계보, graph-neighbor, 다른 입장 후속
탐색의 route 실행과 fallback을 설명한다.

## Scope

- primary entrypoints: `app/components/research-route-renderers/use-graph-neighbors-handler.ts`,
  `app/components/research-route-renderers/search-view-followup-handlers.ts`,
  `app/(research)/relationship-route-page.tsx`
- execution owner: `app/server/services/relationship-execution.ts`
- lifetime: destination condition route의 ephemeral `ResearchRoutePayload`
- fallback owner: destination route의 failed/degraded view 또는 seeded keyword search

## Shared Navigation

Handler는 source view를 fetch·swap하거나 saved document를 만들지 않고 destination 조건
URL을 연다. Plain click은 현재 창을 push하고 detached click은 같은 URL을 새 탭에 열어
출발 route state를 보존한다. 조건 URL validation과 shell activation은
[`research-route-lifecycle.md`](research-route-lifecycle.md)가 소유한다.

목적지 route bootstrap이 AI comment generation의 단일 시작점이다. Handler는 출발
search runtime에서 별도 generation command를 보내지 않는다. Degraded retry도 현재 view를
직접 swap하지 않고 같은 seed route를 다시 실행한다.

## Citation Lineage

`useCitationLineageHandler`는 card의 slim seed identity를
`/citation?seedPaperId=...`에 싣는다. `CitationSeedRoutePage`가 current principal과 URL
seed를 해석해 `executeCitationLineageFromUrl`을 호출한다.

E3 paper reference seed이면 `lookupCitationLineageForPaper`가 provider citation page의
`cites`와 `cited_by` 방향을 병렬로 조회하고, 각 edge에 함께 온 rich paper projection으로
방향별 카드를 만든다. Projection을 해석할 수 없는 edge는 방향 전체를 실패시키지 않고
availability의 제한 사유로 남긴다. Card에 이미 실린 reference/citation id 목록을 별도
fast path로 사용하지 않는다. Provider reference가 없는 legacy seed는 citation page를
호출하지 않고 seed에 실린 availability와 id metadata로 unavailable view를 만든다.

Citation route는 co-cited/coupled graph lookup을 시작하지 않는다. Graph 관계는
`/similar`의 전용 `graph_neighbors` route가 소유한다. Citation lookup이 실패하면
destination route의 failed view로 닫는다.

## Similar Papers

E3 paper reference seed의 기본 경로는 `/similar?seedPaperId=...`다.
`executeGraphNeighborsFromUrl`이 lightweight co-cited/coupled 후보를 가져와
`graph_neighbors` view를 만들고 후보가 있으면
`cardDataHydration.status:"pending"`을 남긴다.

`ResearchBackgroundTasks`는 `POST /api/graph-neighbors/hydrate`로 abstract, authors,
venue, fields, open-access/PDF, external ids를 보강한다. 반복 실패해도 lightweight 관계
후보를 유지하고 terminal ready로 닫는다. 같은 snapshot 자동 반복은 `429`, `5xx`,
timeout·transport loss에만 최대 3회 허용한다. Correctable/auth/conflict 오류는 첫
응답에서 terminal ready로 닫는다. Seed paper는 sticky context header에는 남지만
neighbor 후보에서는 제외한다.

Graph route를 만들 수 없는 legacy seed는 `/similar`에서 빈 view를 만들지 않고
`/search?q=...&entry=similar`로 redirect한다. `buildSimilarPaperQuery`는 usable cached inline
analysis가 있으면 title 앞부분과 `semanticProfile.topics`를 합치고, 없으면 title만 쓴다.
Destination search payload는 `metadata.seedPaper`를 보존하고 seed paper를 결과에서 제외한다.

## Different Position

`다른 입장` 후보는 provider나 graph API가 아니라 current inline analysis의
`stanceProfile.counterSearchQueries`에서 나온다. 같은 `stanceProfile.limitations`가 영역
상단의 한계·반박 지점 요약을 공급한다. Candidate query는 영어 학술 검색식이어야
하고 그 검색어가 확인하려는 한계·반박 지점 설명은 `rationale`에 분리한다. Domain predicate는 한글·한자·가나·키릴 설명문이
섞이거나 Latin 검색 token이 없는 query를 cache·render 전에 제외한다. Greek scientific
token은 허용한다.

클릭하면 후보 query와 `entry=position`만 `/search?q=`에 싣는다. 출발 검색어·논문·입장·
쟁점 provenance는 URL, route metadata, canonical search identity에 포함하지 않는다. 출발
surface의 canonical event만 source view/paper identity와 candidate query의 hash·length를
기록한다.

현재 후보는 확정된 반박 논문이 아니라 다른 해석이나 비판적 논의를 찾기 위한 검색식이다.
향후 provider-backed debate/stance candidate API는 Episteme issue
`corca-ai/episteme2#57`과 Light House issue `jaeyoungkang/lighthouse#121`이 소유한다.

## Research Terms and Other Keyword Follow-ups

연구 용어·저자·주제 link는 shared `useSearchTermHandler`로 독립 `/search?q=` route를
연다. 연구 용어는 `termSeed`를 destination metadata에 보존할 수 있다. Library context의
가용성 hint는 보존할 수 있지만 결과 기준이나 `personalize` 상태는 운반하지 않는다.

## Degrade Order

1. Citation page 실행 실패 → failed citation view.
2. Graph-neighbor lookup 실패 → degraded graph view와 same-seed retry.
3. Graph card hydration 실패 → lightweight candidates 유지 후 terminal ready.
4. Provider reference가 없는 legacy similar seed → seeded keyword `/search` fallback.
5. Different-position candidate 없음 → action 없음; 확정 반박 논문을 합성하지 않음.

## Update Rule

Citation provider 순서, graph-neighbor route/hydration, similar fallback query, destination AI
bootstrap, detached navigation, different-position candidate owner나 query-only provenance가
바뀌면 이 문서를 갱신한다.
