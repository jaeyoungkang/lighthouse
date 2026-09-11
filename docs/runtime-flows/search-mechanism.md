# Search Mechanism Runtime Flow

사용자 검색이 조건 URL에서 시작해 첫 결과, background 보강, 후속 탐색, AI
반응 입력으로 이어지는 전체 처리 경로의 진입점이다. 이 문서는 공통 경계와 읽기
순서만 소유한다. 세부 순서·상수·fallback은 아래 owner 문서가 소유한다.

## Scope

| 실행 책임 | 세부 정본 |
| --- | --- |
| 조건 URL, route 전환, 인증·라이브러리 bootstrap, ephemeral view 수명 | [`research-route-lifecycle.md`](research-route-lifecycle.md) |
| query 분해, keyword/provider fan-out, library graph 정렬, discovery, dedup·projection | [`search-retrieval-ranking.md`](search-retrieval-ranking.md) |
| card hydration, 연구 용어, 맞춤법 교정, inline analysis queue/cache | [`search-background-enrichment.md`](search-background-enrichment.md) |
| 인용 계보, 비슷한 논문, 다른 입장 후속 탐색 | [`relationship-exploration.md`](relationship-exploration.md) |
| route-owned AI comment structured generation | [`ai-response-generation.md`](ai-response-generation.md) |
| gap report 생성·영속·polling | [`gap-network-analysis.md`](gap-network-analysis.md) |

사용자 가치와 Acceptance Check는 Story Chain이, 실행 가능한 coverage는 Evidence
Ledger가 소유한다. 이 문서군은 현재 구현의 **how**만 설명한다.

## Public Explanation Boundary

내부 문서는 Episteme endpoint, provider gateway, `reviewed_papers` 같은 runtime
이름을 쓴다. `/about/search`는 이를 Moonlight Search와 내 라이브러리 기준이라는
사용자 언어로 설명한다. 공개 설명은 내부 provider 이름을 신뢰 근거처럼 노출하지
않는다. Keyword 검색과 Episteme 3 discovery는 같은 검색어를 각각 입력으로 받으므로 keyword
결과 창에는 없고 graph에서 합류한 후보를 검색어와 무관하다고 설명하지 않는다. 검색어
관련도와 라이브러리 인접도가 각각 같은 최대 비중을 갖고, 출처가 아니라 두 점수의 합으로
순서를 만든다는 제품 의미를 유지한다.

검색 카드 원문 destination은 open-access landing → DOI → arXiv → Episteme paper
page 순서로 고른다. 이 destination fallback은 공개 설명 prose가 아니라 사용자가
누른 외부 원문 링크다.

## End-to-end Flow

1. 검색 submit·후속 검색·외부 진입은 조건 URL을 만든다. URL builder와 parser가
   encoded-byte boundary와 조건 문법을 통과시킨 뒤에만 canonical execution identity를
   만든다. 출판연도 문법, malformed 거부 순서, 직접 입력 주소와 canonical identity의
   관계는 `research-route-lifecycle.md#condition-url-boundary`가 소유한다.
2. `/search?q=...`는 route-owned pending view를 먼저 렌더하고 현재 principal을
   해석한 뒤 keyword search와 선택적인 library scoring preflight를 시작한다.
3. 검색 실행은 keyword 결과 최대 40편과 graph 결과 최대 40편을 한 result pool로
   합치고 같은 논문은 한 번만 남긴다. Keyword provider 최종 순위와 query-aware
   graph 관계 점수를 각각 최대 절반으로 결합해 첫 payload의 순서를 확정한다.
   DOI exact lookup과 keyword fallback의 연도 적용 순서는
   `search-retrieval-ranking.md#keyword-and-library-fan-out`이 소유한다. Optional graph leg가
   실패하면 keyword-only로 닫는다.
4. title-family dedup과 combined library-interest projection을 거쳐 ephemeral
   `ResearchRoutePayload`를 한 번 공개한다. 별도 발견 섹션은 만들지 않고 검색 route
   payload도 저장하지 않는다.
5. route가 ready가 되면 card hydration, term discovery, spelling correction,
   inline analysis가 각자 소유한 background task로 진행된다. 늦은 응답은 active
   execution과 snapshot identity가 맞을 때만 현재 view에 병합된다.
6. 현재 정렬·필터 projection은 gap input과 bounded `viewSnapshot`을 만들며, 실제 AI
   comment 생성은 `ai-response-generation.md`로 handoff한다.
7. 인용·비슷한 논문은 `/citation`·`/similar` 조건 route에서 실행한다. 연구 용어와
   다른 입장은 독립 `/search?q=` 조건으로 이동한다.

## Common Boundaries

- `/search`, `/citation`, `/similar`은 조건 URL이 실행과 복원을 소유한다. 저장 id
  route는 `/gap/:id`에만 있다.
- client store는 현재 route의 단일 `currentView`와 active-execution 상태만 소유하고
  URL을 스스로 만들거나 저장 view 목록을 관리하지 않는다.
- plain click은 현재 창을 전환한다. Ctrl/Cmd/가운데 클릭은 같은 조건 URL을 새 탭에
  열며 출발 route state를 바꾸지 않는다.
- route-owned background API는 현재 principal과 요청 snapshot을 입력으로 사용한다.
  검색·관계 route payload row를 서버에서 다시 읽어 입력을 복원하지 않는다.
- Episteme outbound는
  `app/server/external-http-gateway/literature-provider-fetch.ts`의 단일 gateway와
  process-local breaker/admission 경계를 지난다.

## Entrypoints

| 경계 | 위치 |
| --- | --- |
| 검색 route | `app/(research)/search/page.tsx`, `app/(research)/search-route-page.tsx` |
| 관계 route | `app/(research)/relationship-route-page.tsx`, `app/server/services/relationship-execution.ts` |
| 검색 실행 | `app/server/services/search-execution.ts` |
| background runner | `app/components/research/ResearchBackgroundTasks.tsx` |
| 검색 결과 표시 | `app/components/research-route-renderers/SearchView.tsx`, `app/components/research-route-renderers/use-search-view-controller.ts` |
| AI 반응 입력 | `app/lib/view-snapshot.ts`, `app/domain/view-snapshot.ts` |

## Library Context Source

기본 library source는 현재 principal의 `reviewed_papers`다. Source 조회, post-mount
bootstrap, current-read freshness와 compatibility source 순서는
[`research-route-lifecycle.md#library-context-source`](research-route-lifecycle.md#library-context-source)가
소유한다. Keyword/provider fan-out에 실제로 반영하는 순서는
[`search-retrieval-ranking.md#library-neighborhood-preflight`](search-retrieval-ranking.md#library-neighborhood-preflight)가
소유한다.

## Shared Inline-analysis Cache

공동 cache identity, DB lease, owner/waiter와 cleanup 순서는
[`search-background-enrichment.md#shared-inline-analysis-cache`](search-background-enrichment.md#shared-inline-analysis-cache)가
소유한다. 운영 retention·capacity·rollout verdict는 `docs/operational-readiness.md`가
소유한다.

## 데드라인·커넥션 예산

검색과 background route는 세 계층으로 worst-case를 경계한다.

1. 각 `app/**/route.ts` Route Handler의 `maxDuration`
2. request abort signal과 provider 내부 timeout의 합성
3. DB role-level `statement_timeout`

정확한 route 예산과 gate 의미는 `docs/contract-maps/quality-gates.md`, 운영 수치와
rollout 판정은 `docs/operational-readiness.md`가 소유한다.

## Episteme Resilience Boundary

모든 Episteme GET/POST는 공용 gateway의 process-local circuit breaker와 lane별
admission을 지난다. Core keyword lane은 optional graph/batch work보다 우선한다.
차단·load shed·provider failure는 서비스 계층에서 기존 `null` 또는 degraded view로
내려간다. 현재 capacity, fleet 한계, retry allowlist와 production evidence는
`docs/operational-readiness.md`의 `episteme-provider-fanout` boundary가 소유한다.

## Contract Architecture Impact Review

Contract delta: 검색의 query·library relation 결합, provider resilience, compatibility tree를 기존 search execution과 hydration owner 안에서 제한한다.
Verdict: constrain-existing
Affected axes and current owners: Source of truth and authority; Execution semantics; Runtime, external, or AI boundary; Resource and capacity; Compatibility and retirement — `app/server/services/search-execution.ts`, `app/server/services/search-hydration.ts`, `app/server/external-http-gateway/`, `docs/operational-readiness.md`
Decision: 검색 execution과 hydration의 현재 owner를 유지한다. 승인된 combined score, candidate cap, breaker·admission, retired cold-fill 제거를 같은 runtime 경계에서 적용한다.
Rejected alternative: 별도 direct-citation cold fill이나 검색 전역 cache·새 control plane을 복원하면 첫 payload와 provider fan-out의 owner가 다시 분산된다.
Evidence and structural defense: `app/server/services/__tests__/search-hydration.test.ts`, `app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts`, `npm run guard:external-http-gateway`
Human decision required: no

### 2026-08-06 — direct-citation cold fill 은퇴

- verdict: `constrain-existing`
- contract delta: 새 검색의 라이브러리 marker와 정렬 근거를 이미 첫 payload에서 계산한
  query-aware PaperNeighborhood 관계 하나로 제한한다. 사용자-facing `/citation` 계보는
  그대로 유지한다.
- affected axes: reviewed-paper domain access의 response-tail warm, anchor-revision
  process LRU/TTL, 방향별 citation provider fan-out과 별도 projection이 제거된다. 검색
  payload schema, graph/keyword 후보 상한, combined score, downstream cap은 바뀌지 않는다.
- selected boundary: `search-execution.ts`가 owner-scoped reviewed-paper source와 graph
  preflight를 연결하고, `search-hydration.ts`가 같은 graph 관계에서 marker용
  `interestWeights`와 정렬용 `combinedRankWeights`를 만든다.
- rejected alternative: 사용자가 보지 않는 cold fill을 선제 계산하거나, graph 관계와
  별도 direct-citation source를 다시 합치거나, `/citation` 계보까지 함께 제거하지 않는다.
- structural defense: reviewed-paper access가 citation index·warm capability를 노출하지 않는
  auth-boundary test, graph-only marker/ranking test와 Evidence Ledger가 닫는다.
- Human decision required: resolved — Issue #583 작업 승인으로 cold fill과 cache owner를
  `remove`로 확정했다.

### 2026-07-23 — query와 library relation의 equal-max combined score

- verdict: `constrain-existing`
- contract delta: 검색어 관련도와 라이브러리 인접도는 각각 0~1로 환산하고 최종 점수에
  최대 0.5씩 기여한다. 라이브러리 인접도는 Episteme `default_score`의 P05~P95 robust
  magnitude 70%와 stable graph rank 30%를 합친다. 두 후보군에 모두 있는 논문은 두
  기여도를 함께 받는다.
- affected axes: 첫 payload의 정렬 의미와 `combinedRankWeights` 값이 바뀐다. 후보
  멤버십, payload schema, provider·DB·AI 호출, timeout, retry, downstream cap은 그대로다.
  당시 direct-citation index는 카드 marker 근거와 compatibility reader를 지원했지만,
  2026-08-06 결정에서 은퇴했다.
- selected boundary: 기존 `search-hydration.ts`의 pure projection과
  `rankingMode:combined_score` payload를 유지한다. Query 축은 Episteme 최종 provider
  순위가, library 축은 같은 PaperNeighborhood 응답의 `default_score`가 소유한다.
  정확한 공식과 튜닝 절차는 `search-retrieval-ranking.md#ranking-tuning`이 소유한다.
- rejected alternative: 검색 `relevance`와 graph 원점수를 직접 비교하거나, 같은 순위의
  두 목록을 대칭 reciprocal-rank fusion으로 합치거나, 직접 인용 연결 수를 첫 정렬
  기준으로 두거나, 출처별 고정 슬롯을 배급하지 않는다.
- structural defense: query/library 각 최대 0.5, P05/P95 제한, 70:30 relation 결합,
  exact tie의 provider 순서 보존, marker와 정렬 key 분리, 40+40 전체 pool을
  deterministic tests와 Evidence Ledger가 잠근다.
- Human decision required: resolved — 2026-07-23 Human이 두 축의 최대 기여도를
  0.5로 맞추고 이 값을 지속적으로 튜닝할 기준점으로 승인했다.

### 2026-07-23 — graph 40편 전체 합류와 두 retrieval 순위 결합

- status: superseded by the equal-max combined score decision above.
- verdict: `constrain-existing`
- contract delta: 이미 hydrate한 graph 상위 40편 중 dedup·연도 필터를 통과한 전부를
  keyword 결과 최대 40편과 한 pool에 넣는다. 중복 제거 전 combined bound는 80편이다.
  Keyword 관련도 순위와 내 연구 인접 순위는 reciprocal-rank fusion으로 결합해 어느 한
  출처도 출처라는 이유만으로 상단 전체를 선점하지 않게 하고, 양쪽에 걸친 논문은 두
  순위 기여도를 모두 받는다.
- affected axes: 첫 payload의 result shape와 브라우저 더보기 범위가 커진다. 검색
  keyword·graph·batch provider 호출 수는 그대로지만, 사용자가 80편을 모두 펼치고
  cache가 비어 있으면 visible-card inline analysis의 5편 request wave는 최대 9회에서
  16회로 늘 수 있다. Rank fusion은 이미 도착한 최대 80편의 ordinal만 계산하며 새
  provider·DB·AI 호출을 추가하지 않는다. Snapshot metadata는 실제 라이브러리 근거용
  `interestWeights`와 정렬 전용 `combinedRankWeights`를 분리한다.
- selected boundary: 기존 `search-execution.ts`의 first-payload join과
  `search-hydration.ts`의 combined projection을 유지한다. Graph hydrate 상한은
  `hydrateNeighborhoodSupplementBand`, 합류·dedup은 `selectNeighborhoodSupplements`,
  두 순위 결합은 `buildCombinedInterestProjection`, keyword-only fallback은
  `executeSearchFromUrl`이 계속 소유한다. AI comment 20편, gap 40편 cap과 inline
  analysis의 visible-only·5편 request cap도 유지한다.
- rejected alternative: graph 신호가 있다는 이유만으로 graph band 전체를 keyword
  band 앞에 두거나, 이미 계산한 graph 결과를 5편으로 자르거나, 고정 교차 슬롯을
  배급하거나, 첫 공개 뒤 새 graph pagination/provider 호출로 멤버십을 늘리지 않는다.
- structural defense: 40편 graph band 전체 선택, 40+40=80 result pool,
  paper-id/title-family·연도 dedup, dual-basis overlap 승격과 두 retrieval 순위의
  reciprocal-rank fusion, 근거 marker와 정렬 key 분리를 deterministic tests와 Evidence
  Ledger가 잠근다.
- Human decision required: resolved — 2026-07-23 Human이 graph 결과 40편을 모두 쓰고
  검색어·라이브러리 두 순위를 함께 반영하되 어느 한 출처도 상단 전체를 선점하지 않게
  하도록 선택했다.

### 2026-07-22 — keyword·library-neighbor 통합 score order

- status: direct-citation cold fill과 projection은 2026-08-06 결정으로 대체됨.
- verdict: `reshape`
- contract delta: keyword provider 결과와 최대 5편의 query-absent graph neighbor가 한
  result pool을 이루고 직접 인용 연결 수, graph proximity, 기존 순서로 함께 정렬된다.
- selected boundary: `reviewed-paper-access.ts`의 anchor-revision process LRU/TTL이
  direct-citation index 수명을, `library-citation-proximity.ts`가 bounded fill과 projection을,
  `search-hydration.ts`가 combined pool과 ordinal ranking projection을 소유한다.
- rejected alternative: keyword relevance와 citation weight의 산술 결합, 고정 자리
  interleave, hydration 이후 rerank, 새 shared cache 도입을 선택하지 않는다.
- structural defense: combined membership/total, direct-first lexicographic order와 stable
  tie, incomplete-fill 폐기, five-card/title-family supplement 경계를 deterministic tests와
  Evidence Ledger가 잠근다.
- Human decision required: resolved — 2026-07-22 Human이 별도 discovery section을 거부하고
  검색어 일치 결과와 한 목록에서 정렬하도록 결정했다.

### 2026-07-19 — Search-first condition URL encoded-byte budget

- verdict: `constrain-existing`
- contract delta: 검색·인용·비슷한 논문 조건 주소는 승인된 raw UTF-8 dimension과
  8,192-byte encoded request-target 안에서만 실행된다. 초과 조건은 truncate하지 않고
  내부 탐색과 직접 URL 진입에서 거부한다.
- selected boundary: 공통 순수 owner가 raw dimension과 production
  `URLSearchParams` 직렬화 결과를 검사한 뒤에만 canonical identity와 provider 실행을
  허용한다. 상세 mode와 실패 순서는 `research-route-lifecycle.md`가 소유한다.
- rejected alternative: browser/vendor 한도 의존, truncate·omit, code-unit 길이 검사,
  identity 생성 뒤 거부를 사용하지 않는다.
- structural defense: `guard:search-condition-url-budget`와 builder/parser/provider
  ordering tests가 경계를 잠근다.
- Human decision required: no — 2026-07-19 Human 승인 완료.

### 2026-07-18 — production canonical host와 compatibility ingress

- verdict: `constrain-existing`
- contract delta: production 정본 origin은 `scholar.themoonlight.io`이고
  `search.themoonlight.io`는 path/query를 보존하는 308 ingress다.
- selected boundary: Vercel redirect가 외부 ingress를, `next.config.ts`가 application
  fallback을, Supabase Auth config가 callback allowlist를 소유한다.
- rejected alternative: 두 host를 동등한 application origin으로 유지하거나
  host-scoped session·PKCE cookie를 복제하지 않는다.
- structural defense: Next config test와 production Vercel/Supabase readback이 닫는다.
- Human decision required: yes — 2026-07-18 Human 승인 완료.

### 2026-07-16~17 — Episteme 소수 코호트 admission과 cold connect retry

- verdict: `constrain-existing`
- contract delta: degrade-to-null과 first-ready 의미를 유지하면서 allowlist에 든 cold
  connect timeout만 같은 breaker slot에서 한 번 재시도한다.
- selected boundary: gateway가 transport/retry를, breaker가 process-local lane·slot·queue를
  소유한다. 현재 운영값과 evidence는 `docs/operational-readiness.md`가 소유한다.
- rejected alternative: 무제한 실행, HTTP 429·5xx retry, 현재 코호트에서의 선제적
  Redis/global limiter 도입을 선택하지 않는다.
- structural defense: retry allowlist·상한·abort·lane reservation tests와 provider
  observation을 유지한다.
- Human decision required: yes — 2026-07-17 Human 승인 완료.

### 2026-07-14 — 명시적 논문검색 버튼의 즉시 클릭 feedback

- verdict: `constrain-existing`
- contract delta: 검색 버튼은 destination paint 전 click receipt와 중복 제출 방지를
  제공하며 provider 진행 상태를 소유하지 않는다.
- selected boundary: `SearchFollowupActivationProvider`가 route identity와 bounded
  cleanup을, destination route가 pending/ready/failed를 소유한다.
- rejected alternative: 버튼별 pending store나 출발 화면의 provider 상태 추론을
  도입하지 않는다.
- structural defense: spinner, exact-route cleanup, detached-click tests가 닫는다.
- Human decision required: no.

### 2026-07-14 — 라이브러리 그래프와 키워드 검색의 co-equal 첫 결과

- verdict: `reshape`
- contract delta: personalized 검색은 현재 library corpus id만 graph anchor로 쓰며
  keyword와 graph leg를 함께 시작해 첫 payload에서 한 번 합친다.
- selected boundary: `search-execution.ts`가 두 leg의 시작과 join을,
  `search-hydration.ts`가 preflight와 blend를, `SearchMetadata.graphSupport`가 첫 결과
  evidence를 소유한다.
- rejected alternative: keyword 결과를 graph seed로 다시 호출하거나 늦은 graph 후보를
  첫 결과 뒤에 주입하지 않는다.
- structural defense: concurrent-start, first-payload blend, keyword-only degrade와
  no-post-keyword-hop tests가 닫는다.
- Human decision required: no.

## Concept Shift Architecture Review

### 2026-09-02 — Episteme 3 native read model

- E3 `/api/v3/search/papers`, `/papers/by-ref`, `/papers/batch`,
  `/graph/citations`, `/papers/discover`: `preserve` as the only live provider path.
- unversioned E2 compatibility endpoints and DTOs: `remove`.
- stored numeric S2 corpus ids: `migrate-read-only` through `s2:{id}` refs.
- E3 `paper_uid`, source memberships, completeness, generation and opaque cursor:
  `preserve` in the provider projection.

### 2026-08-06 — direct-citation cold fill 은퇴

- reviewed-papers direct-citation index, anchor-revision LRU/TTL, response-tail warm과
  `library-citation-proximity.ts`: `remove`.
- query-aware PaperNeighborhood 기반 `interestWeights`·`combinedRankWeights`와
  `rankingMode:combined_score`: `preserve`.
- 사용자-facing `/citation` lineage route와 payload: `preserve`.

### 2026-07-22 — 고정-slot 개인화 은퇴와 통합 score order

- keyword provider result와 client-side sort projection: `reshape` — library neighbor를 같은
  pool에서 score order로 정렬한다.
- 새 검색의 library supplement interleave와 CJK admission writer: `remove`.
- 저장된 interleave/CJK visibility event reader: `migrate-read-only`.
- `libraryOnlyPaperIds`: `preserve` — active combined pool의 출처와 relevance escape hatch에도 쓴다.
- reviewed-papers direct-citation index: 당시 `reshape`, 2026-08-06 결정에서 `remove`.
- `rankingMode:combined_score`: `preserve`.

### 2026-07-14 — first-reveal graph blend 도입 (2026-07-22 결정으로 대체됨)

- keyword와 library preflight의 동시 시작, `first_reveal_only`, 첫 payload join:
  `preserve`.
- keyword-result `loaded_result_sample` graph provider 호출: `remove`.
- 저장된 `SearchGraphSupportMetadata` v1 read compatibility: `migrate-read-only`.
- library-anchor 후보를 담는 v2 `basis:"library_anchor_neighborhood"`: `reshape`.
- server-layout auth wait: `remove`; post-mount shell bootstrap과 auth-required handoff:
  `preserve`.
- 사용자별 inline-analysis cache identity: `remove`; shared
  `(paper_id, analysis_version, input_fingerprint)` identity와 DB lease: `reshape`.

## Update Rule

- 공통 end-to-end 순서나 문서 owner가 바뀌면 이 overview를 갱신한다.
- route lifecycle만 바뀌면 `research-route-lifecycle.md`를 갱신한다.
- retrieval·ranking·상수만 바뀌면 `search-retrieval-ranking.md`를 갱신한다.
- background task나 inline cache만 바뀌면 `search-background-enrichment.md`를 갱신한다.
- citation/similar/different-position만 바뀌면 `relationship-exploration.md`를 갱신한다.
- 운영 수치와 rollout verdict는 이 문서에 복제하지 않고
  `docs/operational-readiness.md`를 갱신한다.
