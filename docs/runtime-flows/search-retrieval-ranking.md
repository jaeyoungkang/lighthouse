# Search Retrieval and Ranking

`executeSearchFromUrl`이 query를 provider 입력으로 바꾸고 keyword 결과와
library-neighbor 후보를 한 번의 search `ResearchRoutePayload`로 만드는 순서를
설명한다.

## Scope

- primary entrypoint: `app/server/services/search-execution.ts`
- state owner: 첫 search payload의 candidate pool과 basis metadata
- lifetime: 한 `/search?q=` execution의 첫 공개 snapshot
- fallback owner: keyword-only first payload

## Contract Architecture Impact Review

Contract delta: 검색 결과는 사용자가 `내 연구 기준`과 `검색어 기준`을 고르는 두 projection을 없애고, 라이브러리 신호가 있으면 검색어 관련도와 라이브러리 근접도를 자동으로 함께 반영한 한 목록을 보여 준다. 양수의 라이브러리 근접도 근거가 있는 논문은 `내 연구와 가까움`으로 표시한다. 검색·정확 조회·배치 보강·인용·관련 논문은 unversioned E2 호환 경로를 제거하고 Episteme 3 `/api/v3` 정본 계약으로 실행한다.
Verdict: reshape
Affected axes and current owners: Source of truth and authority; State lifetime and recovery; Observability and audit; Compatibility and retirement; Cross-surface invariant ownership — `app/server/services/search-execution.ts`, `app/server/services/episteme-literature.ts`, `app/lib/episteme3-schemas.ts`, `app/server/services/episteme-paper-neighborhood.ts`, `app/components/research-route-renderers/SearchView.tsx`, `app/domain/research-route-payload.ts`, `docs/analytics/events.yaml`, `aspect:library-grounded-research`
Decision: 첫 payload에서 keyword와 query-aware library graph 후보를 합치고 균형 점수로 정렬하는 runtime owner는 유지한다. provider-neutral `paper_uid`, opaque cursor, total relation, completeness/generation과 discovery evidence를 정본 wire model로 채택한다. 사용자 선택형 basis projection, client preference writer와 unversioned E2 endpoint는 제거한다. 기존 숫자형 S2 id와 `personalize=false` 조건 주소는 읽기 호환 projection으로만 유지한다. 2026-09-02 Human의 "에피스테메3에 맞춰서 전환" 지시가 이 reshape를 승인했다.
Rejected alternative: E2 shim의 `relevance`만 optional로 바꾸면 중단된 exact lookup과 compatibility lifecycle은 남고 E3 completeness·canonical identity를 잃는다. 토글과 preference writer만 숨기는 방식도 같은 검색 주소의 단일 제품 의미를 깨뜨린다.
Evidence and structural defense: `aspect:library-grounded-research`, `docs/runtime-flows/search-retrieval-ranking.md`, E3 native namespace·nullable relevance·by-ref·batch refs·discovery evidence adapter tests, `npm run quality:contract`
Human decision required: no

## Concept Shift Architecture Review

### 2026-09-02 Episteme identity and paging

- E3 `paper_uid`와 provider reference: `preserve`.
- 저장 snapshot과 Moonlight library의 숫자형 S2 corpus id: `migrate-read-only`.
  E3 호출 직전에 `s2:{id}`로 바꾸고, S2 membership이 있는 새 카드에서는 기존 저장
  join을 위해 숫자형 projection도 함께 유지한다.
- unversioned E2 `/search`, `/papers/lookup`, `/papers/batch`, paper citation,
  co-cited/coupled, `/graph/paper-neighborhood`: `remove`.
- E2 offset/`total_mode`: 신규 write에서 `remove`. E3 opaque cursor와
  completeness/total relation을 저장하고 기존 `nextOffset`은 reader 호환 projection만 둔다.

- keyword와 query-aware library graph를 첫 payload에서 합치는 combined ranking owner: `preserve`.
- `interestWeights`, `combinedRankWeights`, `libraryOnlyPaperIds`와 저장된 과거 snapshot reader: `preserve`.
- 기존 `personalize=false` 공개 URL 입력과 `sort=relevance|interest` basis 입력: `migrate-read-only`. 입력은 허용하지만 현재 검색 identity와 결과 projection에는 참여하지 않고 신규 writer도 만들지 않는다.
- 결과 header의 basis toggle, client preference store, active keyword-only projection과 후속 검색의 opt-out 전파: `remove`.
- 외부 analytics sink에 이미 적재된 `personalization_enabled` 값과 dated Story Chain review: `preserve`. 현재 event writer는 사용자 선택이 아니라 실제 library grounding 적용 여부를 기록한다.

## Propagation Map

### 2026-09-02 Episteme 3 cutover

- owning edits: E3 schemas, literature/discovery adapters, gateway classification, paper/search
  source metadata, search·citation·graph Acceptance Check의 provider mechanism, relationship route의
  E3 paper-reference admission, reviewed-paper library source의 bounded DB read.
- inspect-only downstream: combined ranking, general route renderer와 saved snapshot reader.
  사용자-facing 결과 의미와 DB schema는 바꾸지 않는다.
- compatibility: numeric S2 ids are read-only aliases; `paper_uid` is retained as
  `source.canonicalPaperId`; E3-only papers keep `paper_uid` as `paperId`.
- cleanup: E2 runtime endpoints and E2 wire fixtures are removed in this change. Historical
  ledger names such as `gap-network-e2` remain historical identifiers and are not renamed.
- expected churn: provider adapter/schema/tests plus three runtime/contract projections; no DB
  migration and no new external service.

Invariant: 라이브러리 신호가 있는 검색은 검색어와 라이브러리 근접도를 자동으로 함께 반영한 한 결과 목록을 보여 주고, 양수인 library relation 근거가 있는 논문은 `내 연구와 가까움`으로 표시한다. 사용자가 basis를 고르는 control은 없다.
Owning contract bundle: `promise:search-results-fast-window`와 `search-result-window.ledger.yaml`; `aspect:library-grounded-research`와 `library-grounded-research.ledger.yaml`; `promise:search-result-library-add`와 그 ledger; `promise:research-route-cap-feedback`; `promise:researcher-prose-promises-page`와 `commitment-pages.ledger.yaml`; 같은 route writer 계약을 쓰는 `promise:search-spelling-correction`
Runtime/engineering owner: `docs/runtime-flows/search-retrieval-ranking.md`, `app/server/services/search-execution.ts`, search route URL builder와 search result renderer
Required code/test paths: `app/server/services/search-execution.ts`, `app/lib/api-routes.ts`, `app/(research)/research-route-shell.tsx`, `app/(research)/relationship-route-page.tsx`, `app/(research)/__tests__/relationship-route-page.test.tsx`, `app/components/research-route-renderers/**`, `app/i18n/messages/search.ts`, `app/server/repository/reviewed-papers.ts`, `app/server/domain-access/reviewed-paper-access.ts`, E3 gateway·graph neighborhood fan-out, 관련 focused Vitest
Inspected, not edited: 저장 snapshot의 legacy CJK/interleave reader, dated Sufficiency Review, DB schema
Compatibility-only shapes: 저장 snapshot reader=`preserve`; 외부 analytics history=`preserve`; 기존 `personalize=false`와 `sort=relevance|interest` URL input=`migrate-read-only`; basis toggle·preference writer·active opt-out projection=`remove`
Split cleanup: 역사 review 문구와 inert browser URL의 강제 redirect는 이번 변경에서 다루지 않는다. 현재 authority를 주장하는 계약·ledger·runtime·public prose의 stale 용어는 같은 변경에서 정리한다.
Budget: 초기 forecast는 32..55 authored files, 650..1200 authored changed lines였다. Story Chain·ledger·analytics·glossary·공개 설명의 필수 projection까지 같은 closeout에 포함하면서 실제 변경 surface는 80여 파일로 늘었다. Human이 2026-08-21 `확장 범위로 한 번에 개편`을 승인했고, 늘어난 파일은 별도 제품 기능을 추가하지 않고 같은 단일 결과 invariant를 전파한다.

## Architecture Fitness Review

- scope: `issue-276-search-state-boundary`의 keyword search state-authority lens와 `issue-399-serialized-input-budget`의 조건 주소 직렬화 lens.
- evidence: 현재 worktree에서 `npm run guard:state-boundaries`와 route·search execution·ephemeral identity·first-paint path 테스트 65개, `npm run guard:search-condition-url-budget`과 URL budget·writer call-site 테스트 92개가 통과했다.
- local conformance: `healthy`. 기존 조건 주소의 `personalize` 값은 입력 호환 carrier로만 남고 canonical search identity와 현재 result projection의 authority가 되지 않는다. 현재 writer와 client preference owner는 제거됐으며 조건 주소는 기존 byte budget과 provider-before-identity 경계를 지킨다.
- unsupported lenses: 이 변경이 새 topology, workload envelope, cache lifecycle, privileged effect를 만들지 않으므로 해당 lens는 이번 review에서 deterministic 판정을 만들지 않고 `unknown`으로 남긴다.
- authoritative verdict and merge eligibility: 현재 head의 protected verdict는 없다. URL writer call-site 정의가 바뀌어 Issue 399 checked profile은 protected-main batch rebind가 필요하다. 이 후속과 PR review closeout은 로컬 구현 준수 판정과 별도다.

## Query Clauses

`app/lib/search-query.ts`는 콤마가 포함된 검색어를 하나의 복합 검색 의도로
유지한다. `machine learning, climate change` 같은 주제 조합과 Oxford comma가
포함된 논문 제목은 모두 하나의 provider query로 전달한다. `;`와 줄바꿈만
명시적인 query clause 구분자로 사용한다. 명시적으로 나뉜 clause는 중복을
제거하고 최대 `MAX_SEARCH_QUERY_CLAUSES`개만 사용한다. 여러 clause는 별도
provider 조회 뒤 `allocateSearchClauseLimits`의 role 예산으로 병합한다. DOI와
pagination 입력은 단일 query로 처리한다.

## Keyword and Library Fan-out

`executeSearchFromUrl`은 personalized 검색에서 현재 principal의 `reviewed_papers`
repository read와 keyword provider fetch를 어느 한쪽도 기다리지 않고 시작한다. Source가
준비되면 최신 owner-order 최대 `MOONLIGHT_LIBRARY_MAX_PAPERS`편의 bounded active source에서
library anchor E3 paper reference로 library neighborhood preflight를 시작한다. 숫자형
legacy id는 `s2:` alias로 올리고, 저장된 `paper_uid`·DOI·arXiv·OpenAlex·PubMed reference는
그대로 보존한다. Search
실행은 response-tail citation warm이나 별도 citation cache를 만들지 않는다. Source read
실패는 graph leg만 `null`로 낮추고 이미 시작한 keyword leg는 계속한다.

Keyword leg는 `fetchEpistemePapers({ hydrate:false })`로 최대
`SEARCH_DOCUMENT_FETCH_LIMIT`편의 lightweight 결과를 가져온다. DOI exact lookup은 이미
hydrated된 단일 결과라 background hydration pending marker를 남기지 않는다. 연도 조건이
있으면 exact paper도 같은 조건을 통과해야 반환한다. 범위 밖이거나 출판연도가 없으면
exact match로 표시하지 않고, 정규화한 DOI를 query로 쓰는 keyword search에 같은 연도
경계를 전달한다.

기본순은 E3 hybrid relevance 순서를 요청한다. 사용자가 인용순·최신순·오래된순을
명시하면 adapter는 각각 E3 lexical citations·year-desc·year-asc 정렬을 요청하므로,
keyword window 자체가 선택한 정렬의 provider-wide 순서에서 잘린다. 이후 library 후보가
합류한 경우에는 같은 정렬 key를 combined loaded pool 전체에 다시 적용해 한 목록의 순서를
결정적으로 닫는다.

Episteme 3 `POST /api/v3/search/papers`는 opaque `next_cursor`, total의
`exact|estimated|bounded|unavailable` relation, uniform completeness와 generation을 준다.
adapter는 이를 검색 metadata의 `nextCursor`, `totalMode`, source limits에 보존한다.
비정확 total은 적재한 결과 창의 보조 metadata일 뿐이며 corpus 전체 건수로 표시하거나
AI 입력의 결과 수로 사용하지 않는다.

## Library Neighborhood Preflight

`resolveLibraryNeighborhoodPreflight`는 folder별 anchor E3 paper reference를
`POST /api/v3/papers/discover`에 E3 paper reference로 보내고, fusion score 상위
`SEARCH_LIBRARY_NEAR_BAND_LIMIT`편을 `/api/v3/papers/batch`의 rich projection으로
hydrate한다. Provider는 현재 검색어, seeds, exclusions, cap만 받고 library/folder 제품
어휘는 알지 못한다.

Keyword 결과는 graph seed가 아니며 graph 시작 조건도 아니다. Keyword 검색과 graph
탐색은 같은 검색어를 각각 독립 입력으로 받는다. 첫 payload는 keyword leg와 graph→batch
preflight leg를 함께 기다린 뒤 `applyLibraryContextToSearchResults`로 한 결과 pool을
만든다. 각 folder lookup은 provider의 정상 empty와 일시 실패를 구분한다. 후보 hydration도
정상 empty와 실패를 구분한다. 일부 호출이 실패해도 남은 신호가 실제 결과에 적용되면
`applied`로 닫는다. 적용할 신호가 남지 않으면 `unavailable`로 내려가 keyword-only
payload를 만든다. 첫 공개 뒤 background enrichment가 neighborhood를 다시 조회하거나
늦은 후보를 주입하지 않는다.

Preflight는 score 상위 band를 keyword 결과와 비교하기 전에 cap한다. 이후 hydrate되지 못한
후보와 keyword paper-id/title-family 중복, 현재 연도 범위 밖 후보를 제거하므로 실제
합류 후보 수는 40편보다 작을 수 있고 41위 이하 backfill은 하지 않는다. 남은 후보는
별도 supplement cap 없이 모두 combined pool에 합류한다.

## Dedup and Projection

`dedupePapersByTitleFamily`는 첫 payload commit 전에 정규화 제목이 같은 후보 중 provider
순서상 첫 항목만 남긴다. Background hydration은 이미 commit된 candidate pool을 다시
dedup하거나 줄이지 않는다.

Query-aware E3 discovery의 양수 fusion score는 라이브러리 근거 marker용
`interestWeights`와 active 정렬용 `combinedRankWeights`를 함께 만든다. 저장된 과거
snapshot은 같은 `interestWeights` reader를 유지하지만, 새 검색은 별도 직접 인용 source를
합치지 않는다.

Active 정렬은 두 축을 독립적으로 0~1로 환산한다. Query 축 `Q`는 Episteme 3
`POST /api/v3/search/papers`가
반환한 최종 provider 순서를 사용한다. Raw `relevance`는 provider 내부 후보 결합 뒤의
최종 순서와 단조 관계가 아니므로 다시 정렬하거나 graph 원점수와 직접 비교하지 않는다.

```text
Q = (keywordCount - zeroBasedKeywordRank) / keywordCount
```

Library relation 축은 Episteme 3 discovery의 query-aware `fusion_score`를 사용한다.
한 요청의 graph 후보 점수에서 P05와 P95를 구하고, 그 구간 밖 값은 0과 1로 제한한다.
후보가 하나뿐이거나 점수 분산이 없으면 모든 양수 관계의 magnitude를 1로 둔다.

```text
M = clamp((defaultScore - P05) / (P95 - P05), 0, 1)
P = (relationCount - zeroBasedRelationRank) / relationCount
R = 0.7M + 0.3P
```

최종 `combinedRankWeights`는 두 축이 각각 최대 0.5를 기여하게 합친다.

```text
combinedScore = 0.5Q + 0.5R
```

같은 논문이 양쪽 후보군에 있으면 두 기여도를 모두 받고, 어느 한쪽에만 있으면 해당
축만 받는다. 최종 점수가 같으면 combined pool의 기존 순서를 보존하므로 exact top tie에서는
keyword provider 결과가 먼저다. 이 계산은 이미 도착한 최대 80편을 순회·정렬하는 순수
projection이며 새 I/O를 만들지 않는다. 라이브러리 근접 signal이 있으면 단일 결과의
resolved sort는 `interest`, 없으면 keyword relevance다. 두 값은 내부 실행 상태이지
사용자가 선택하는 결과 기준이 아니다.

`buildSearchViewPayload`는 combined papers와 실제 라이브러리 근거만 담은
`interestWeights`, 정렬 전용 `combinedRankWeights`, `libraryOnlyPaperIds`,
`rankingMode:combined_score`, facet state, hydration state를 함께 보존한다.
같은 첫 payload의 `libraryGrounding`은 실제 적용 결과를 다음처럼 기록한다.

- `not_requested`: 과거 snapshot을 읽기 위한 호환 상태이며 현재 검색 실행은 만들지 않는다.
- `applied`: 라이브러리 신호가 현재 결과에 실제로 반영됐다.
- `no_signal`: 라이브러리가 없거나 provider가 정상 응답했지만 적용할 신호가 없다.
- `unavailable`: 적용할 라이브러리 source가 있지만 source read 또는 provider preflight가
  실패해 keyword-only 결과를 사용한다.

Client에는 이 네 상태만 전달한다. Provider 오류, HTTP status, circuit와 queue 상태는
`episteme_provider_observation`과 `[search-timing]` log가 소유한다.
`libraryOnlyPaperIds`는 현재 keyword provider의 적재 결과 창에는 없고 graph 탐색에서
합류한 논문을 뜻한다. 검색어와 무관하다는 뜻이 아니며 keyword 전체 corpus의 절대
41위 이하임을 보장하는 표현도 아니다.
카드 marker는 `interestWeights`를 읽고 active 정렬은 `combinedRankWeights`를 읽으므로
keyword 순위 contribution이 라이브러리 인접 근거처럼 보이지 않는다. 과거 snapshot
reader는 rankingMode나 `combinedRankWeights`가 없을 때 기존 interest key와
interleave/CJK field를 read-compatible하게 유지한다.

## Result Projection

기본 `interest` projection은 keyword 결과 최대 40편과 preflight graph 결과 최대 40편을
한 목록에서 equal-max combined score 내림차순으로 stable sort한다. Paper-id/title-family
중복 제거 전 결합 상한은 80편이다. 양쪽에 걸친 논문은 두 contribution의 합으로 올라간다.
고정 3·6·9 슬롯과 별도 discovery section은 없다. 양수인 library relation 근거가
있는 논문은 keyword 결과 포함 여부와 무관하게 `내 연구와 가까움` marker를 표시한다.
Keyword-only 후보에는 marker를 붙이지 않고, keyword 또는 출처를 설명하는 별도 marker도
만들지 않는다.

사용자에게는 이 결과 목록 하나만 제공한다. 내부 `relevance`는 적용할 library signal이
없을 때 provider 순서를 나타내고, `interest`는 signal이 있는 combined 순서를 나타낸다.
인용·연도 정렬은 combined pool 전체에 해당 key를 적용한다. 기존 `personalize=false`
URL 입력은 검증 후 단일 결과 실행으로 정규화하며 신규 writer는 이 값을 만들지 않는다.

초기 노출은 `SEARCH_RESULTS_INITIAL_VISIBLE_COUNT`편이고, 본문 preview는
`SEARCH_RESULTS_CONTENT_PREVIEW_LIMIT`편까지 담는다. `더 보기`는 같은 loaded pool의 다음
window를 연다.

## Handoffs

Gap action은 현재 sort·year·facet projection의 상위 `MAX_GRAPH_SOURCE_PAPERS`편을
snapshot 입력으로 넘긴다. 화면의 최초 10편과 대표 논문 local filter는 gap 입력을 줄이지
않는다. 저장·polling은 `gap-network-analysis.md`가 소유한다.

AI comment 입력은 현재 projection의 상위 `SEARCH_REACTION_INPUT_PAPER_LIMIT`편만
`viewSnapshot`에 포함한다. Provider total을 corpus 사실처럼 전달하지 않고 snapshot에 실제
포함된 결과 수만 사용한다. 이후 structured generation은
`ai-response-generation.md`가 소유한다.

## Degrade Order

1. Library context 없음 → `no_signal` keyword-only. 실패 안내는 표시하지 않는다.
2. Neighborhood·candidate hydration 실패/timeout/abort → 적용할 다른 library signal이
   없으면 `unavailable` keyword-only 결과와 visible 안내를 사용한다. 일부 성공 신호가
   결과에 적용되면 `applied`로 기록한다.
3. Keyword provider 실패 → 같은 `/search?q=`의 failed view.
4. Episteme breaker OPEN/load shed → gateway `null`; 각 service의 기존 degraded path.

## Boundary Constants

| 상수 | 값 | 역할 |
| --- | --- | --- |
| `SEARCH_DOCUMENT_FETCH_LIMIT` | 40 | keyword 후보 풀 |
| `SEARCH_LIBRARY_ANCHOR_CANDIDATE_LIMIT` | 40 | folder별 neighborhood 후보 상한 |
| `SEARCH_LIBRARY_NEAR_BAND_LIMIT` | 40 | hydrate할 library-near band |
| `SEARCH_RESULT_POOL_PAPER_LIMIT` | `SEARCH_DOCUMENT_FETCH_LIMIT + SEARCH_LIBRARY_NEAR_BAND_LIMIT` | keyword와 library-near band의 combined ingress 상한 |
| `MAX_GRAPH_SOURCE_PAPERS` | 40 | gap 입력 상위 편수 |
| `SEARCH_REACTION_INPUT_PAPER_LIMIT` | 20 | AI 반응 입력 상위 편수 |
| `SEARCH_RESULTS_INITIAL_VISIBLE_COUNT` | 10 | 최초 노출 편수 |
| `SEARCH_RESULTS_CONTENT_PREVIEW_LIMIT` | 20 | payload content preview 편수 |
| `MAX_SEARCH_QUERY_CLAUSES` | 4 | query clause 상한 |
| `COMBINED_QUERY_WEIGHT` | 0.5 | query 축의 최대 기여도 |
| `COMBINED_LIBRARY_WEIGHT` | 0.5 | library relation 축의 최대 기여도 |
| `LIBRARY_MAGNITUDE_WEIGHT` | 0.7 | relation 축 안의 robust magnitude 비중 |
| `LIBRARY_RANK_WEIGHT` | 0.3 | relation 축 안의 stable rank 비중 |
| `LIBRARY_SCORE_LOWER_QUANTILE` | 0.05 | graph magnitude 하한 |
| `LIBRARY_SCORE_UPPER_QUANTILE` | 0.95 | graph magnitude 상한 |

Provider timeout, breaker, retry, lane capacity와 production evidence는
`docs/operational-readiness.md`가 소유한다.

2026-07-23 graph 40편 전체 합류의 `constrain-existing` 판정과 capacity 축은
[`search-mechanism.md#contract-architecture-impact-review`](search-mechanism.md#contract-architecture-impact-review)에
기록한다. 이 문서는 그 결정이 선택한 retrieval·projection 메커니즘과 상수를 소유한다.

## Ranking Tuning

`COMBINED_QUERY_WEIGHT=0.5`와 `COMBINED_LIBRARY_WEIGHT=0.5`는 Human이 승인한
제품 계약이다. 둘 중 하나를 바꾸는 것은 운영 튜닝이 아니라
`balanced-basis-order`의 의미 변경이므로 Mission Control에서 Story Chain과 CAIR를
다시 열어야 한다.

Runtime ranking owner가 제품 계약을 유지한 채 튜닝할 수 있는 값은
`LIBRARY_MAGNITUDE_WEIGHT`, `LIBRARY_RANK_WEIGHT`,
`LIBRARY_SCORE_LOWER_QUANTILE`, `LIBRARY_SCORE_UPPER_QUANTILE` 네 개다. 앞의 두 값은
합이 1이어야 하고, percentile 하한은 상한보다 작아야 한다. 다음 불변식도 유지한다.

- keyword 최대 40편과 graph 최대 40편을 모두 정렬 대상으로 사용한다.
- query와 library relation을 같은 0~1 범위로 환산한 뒤 결합한다.
- query와 library relation은 최종 점수에 각각 같은 최대 기여도를 갖는다.
- 출처별 고정 슬롯이나 목표 비율을 두지 않는다.
- 양쪽에 걸친 논문은 두 근거를 함께 받는다.
- 첫 payload 이후 hydration은 멤버십과 순서를 바꾸지 않는다.
- 사용자에게 노출하는 basis switch 없이 signal 유무가 기본 순서를 결정한다.

튜닝 후보는 실제 `library × query` 표본에서 query 적합도, library 관계도, 최종 유용성을
0~3으로 평가한다. 기본 비교군은 keyword-only, graph-first, reciprocal-rank fusion,
현재 combined score다. 주 지표는 nDCG@10·20과 Precision@10이다. 첫 유용 논문의 위치와
저장·열람 행동은 보조 지표로 본다. 상위 결과의 출처 비율은 목표값이 아니라 한쪽 독점을
찾는 가드레일로만 사용한다.

허용된 네 값을 바꿀 때는 `library-neighborhood-discovery.test.ts`의 percentile·40+40
fixture와 실제 library/query pilot를 함께 실행한다. API 원점수의 의미나 범위가 바뀌면
점수를 그대로 재사용하지 않고 Episteme OpenAPI와 live response를 다시 확인한다.

## Update Rule

Query clause, provider fan-out, library anchor authority, first-payload
join, title-family dedup, combined ranking projection, handoff cap, degrade order와 위 상수가 바뀌면 이 문서를
갱신한다.
