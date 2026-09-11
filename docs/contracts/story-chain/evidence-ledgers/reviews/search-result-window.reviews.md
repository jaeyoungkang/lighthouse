
# Search Result Window — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [search-result-window.ledger.yaml](../search-result-window.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Retired Acceptance Check history

구조화된 `acs` 목록은 현재 Story Chain ref만 허용한다. 2026-07-12에
`historical:acceptance-check:search-results-fast-window-first-reveal-stable`을
철회하면서, 아래 dated review의 기존 ref와 revision을 이 historical index로
옮겼다. 혼합 review의 `observedOutput`과 `gaps`는 그대로 두었다. 철회 AC만
소유하던 review는 fixture·run commit·관찰·gap·verdict를 historical summary로
보존한다.

- 2026-07-11 `logical freshness and bounded post-result transports` — revision 3
- 2026-07-10 `supplement hydration moves into the preflight` — revision 3
- 2026-07-09 `first reveal owns search result basis` — revision 1
- 2026-07-28
  `historical:acceptance-check:search-results-fast-window-comma-title-single-intent` —
  정식 제목만 단일 의도로 보존하고 일반 콤마 검색어를 분리하던 기준을
  `acceptance-check:search-results-fast-window-comma-query-single-intent`로
  교체했다. 기존 콤마 자동 분리 동작은 remove하고 같은 조건 URL을 새 의미로
  다시 실행한다.
- 2026-07-09 `first reveal waits for the graph preflight as a co-equal input` — revision 2
- 2026-06-28 `search-run hydration race repair` — revision 1
- 2026-05-04 `Intent absorbed for 4 deterministic search promises` — revision 1
- 2026-05-03 `canonical promise verdict backfill` — revision 1
- 2026-04-22 `Re-verified under real runtime path` — revision 1
- 2026-07-08 `search-first landing removes the auth gate` — retired `moonlight-session-handoff`, revision 4; the still-current result-basis review remains structured below
- 2026-07-08 `post-paint library bootstrap after search-first entry` — retired `library-bootstrap-background`, revision 1
- 2026-06-30 `stateless owner-principal session handoff` — retired `moonlight-session-handoff`, revision 2
- 2026-06-29 `root direct Moonlight handoff` — retired `moonlight-session-handoff`, revision 1
- 2026-06-30 `search controls keep internal basis and card affordances`; 2026-05-04
  `Intent absorbed`; 2026-05-03 `canonical promise verdict backfill`; 2026-04-22
  `Re-verified under real runtime path` — retired
  `search-results-fast-window-title-actions`, revision 1. The current
  `search-results-fast-window-card-inspection` AC replaces the title-owned button
  and tooltip model with whole-card non-interactive-region disclosure.

#### Historical review — 2026-07-09 first reveal waits for the graph preflight as a co-equal input

- Historical ref: `historical:acceptance-check:search-results-fast-window-first-reveal-stable`, revision 2.
- Fixture: `app/server/services/__tests__/search-execution.test.ts`; `app/server/services/__tests__/search-hydration.test.ts`; `docs/runtime-flows/search-mechanism.md`.
- Run commit: `8219eb3f+worktree`.
- Observed output: Product owner reversed the earlier "do not hold the page for a slow graph preflight" stance. The route awaited the preflight beside the keyword window with no grace race. A failed preflight committed keyword-only with `libraryBlendPolicy: "first_reveal_only"`, and the late-injection prohibition remained in place.
- Adopted gap: 첫 payload가 graph preflight를 함께 기다렸다. Provider timeout과 route `maxDuration = 120`이 이 대기의 상한을 소유했다.
- Rejected gap: 이 리뷰는 결합된 첫 화면의 p95 SLO를 추가하지 않았다.
- Historical verdict: met.

### Sufficiency Review

#### 2026-08-25 — 고정 DOI 슬롯과 예측 가능한 인용 기준점

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-card-inspection
acReviewedRevision:
  - 19
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.pdf-links.test.tsx; app/components/research-route-renderers/search-result-item.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 반복 논문 카드의 DOI 슬롯은 실제 식별자 문자열을 화면에 표시하지 않고 고정 폭의 `DOI` 라벨만 보여 준다. DOI가 있으면 식별자 URL로 이동하는 링크이고, 없으면 같은 폭의 비활성 버튼이다. 따라서 DOI 값 길이와 유무가 바뀌어도 뒤의 PDF와 인용 정보 시작 위치가 달라지지 않으며, 링크와 비활성 버튼 모두 카드 disclosure를 바꾸지 않는다.
gaps:
  - adopt: 주요 액션은 데이터 길이보다 예측 가능한 반복 카드 기준점을 우선한다.
  - reject: 실제 DOI 문자열 노출, DOI 누락 시 슬롯 제거, DOI 값을 별도 tooltip에 반복하는 표현은 사용하지 않는다.
verdict: met
```

#### 2026-09-02 — Episteme 3 native source and paper link contract

```yaml
date: 2026-09-02
acs:
  - acceptance-check:search-results-fast-window-card-inspection
  - acceptance-check:search-results-fast-window-result-basis-visible
acReviewedRevision:
  - 5
  - 19
fixtureRef: app/server/services/__tests__/episteme-literature.test.ts; app/server/services/__tests__/paper-core-parity.test.ts; app/about/__tests__/search-mechanism-page.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 2d9709f9+worktree
observedOutput: Contract reviewer confirms that the visible Moonlight source explanation and loaded-window limits are preserved while E3 native search, completeness and cursor replace the E2 mechanism. Implementation evidence reviewer confirms nullable relevance, paper_uid retention, S2 read aliasing, best landing/PDF fallback and by-ref lookup. Preservation reviewer confirms provider names remain absent from public trust copy and provider totals are not presented as the visible result count.
gaps:
  - adopt: E3 paper_uid, source memberships, generation, completeness and opaque cursor are retained as provider evidence.
  - reject: The unversioned E2 compatibility shim is not accepted as a fallback, and an estimated or bounded provider total is not promoted to a corpus-wide claim.
verdict: met
```

#### 2026-08-26 — 긴 venue에서도 연도와 출처를 함께 유지

```yaml
date: 2026-08-26
acs:
  - acceptance-check:search-results-fast-window-title-year-summary
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 1
  - 22
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; app/components/research-route-renderers/search-result-item.tsx; docs/design-standards.md
runCommitSha: 1b5e234de8a8d43ca1eabb60664ab70cd62796b2
observedOutput: 반복 논문 카드는 제목 아래에서 박스 없는 연도·venue·분야를 이 순서로 읽게 한다. 연도와 venue는 같은 출처 그룹에 속해 좁은 화면과 긴 venue에서도 연도만 앞줄에 고립되지 않으며, venue 값만 남은 폭에서 말줄임된다. 분야는 바로 뒤의 같은 metadata 행에서 이어지고 필요할 때 다음 줄로 이동한다. 저자 행은 그 아래에 유지되며 페이지 전체에 가로 overflow가 생기지 않는다.
gaps:
  - adopt: 모바일 실화면에서 발견한 연도 고립을 공통 renderer의 출처 그룹과 회귀 assertion으로 닫는다.
  - reject: 긴 venue 때문에 연도와 출처의 관계를 끊거나 연도를 다시 badge로 올리지 않는다.
verdict: met
```

#### 2026-08-26 — 연도·venue·분야를 한 서지 그룹으로 재배치

```yaml
date: 2026-08-26
acs:
  - acceptance-check:search-results-fast-window-title-year-summary
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 1
  - 22
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; app/components/research-route-renderers/search-result-item.tsx; docs/design-standards.md
runCommitSha: e0a89966fd066841962af3e9aef0debdca5e996e
observedOutput: 반복 논문 카드는 제목 오른쪽의 연도 박스를 제거하고, 제목 아래 서지 metadata 행에서 연도·venue·분야를 이 순서로 이어 보여 준다. 연도는 값이 있을 때만 낮은 강조도의 일반 텍스트로 나타나며, venue와 분야는 구분점으로 연결되어 한 정보 그룹으로 읽힌다. 저자 행은 그 아래에 남고, 검색 결과·인용 관계·비슷한 논문 surface가 같은 공유 renderer와 순서를 사용한다.
gaps:
  - adopt: 연도와 출판 맥락을 같은 시선 흐름에 모아 논문 간 서지 정보를 더 빠르게 비교하게 한다.
  - reject: 연도가 없을 때 빈 badge나 placeholder를 만들거나 분야를 metadata 행의 반대편에 다시 분리하지 않는다.
verdict: met
```

#### 2026-08-25 — 반복 논문 카드의 metadata·DOI 스캔 순서

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-card-inspection
acReviewedRevision:
  - 18
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.pdf-links.test.tsx; app/components/research-route-renderers/search-result-item.tsx; app/components/research-route-renderers/search-result-item.shared.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 반복 논문 카드는 venue와 `분야`를 같은 왼쪽 정렬 묶음에 위아래로 표시한다. DOI가 있으면 실제 식별자 링크가 PDF 바로 앞에 나타나고, DOI가 없으면 자리를 만들지 않는다. DOI 링크는 카드 disclosure를 함께 바꾸지 않는다. 초록이 없을 때 분석 영역은 유지하되 별도 `메타데이터 단서` 제목 없이 근거 한계 본문부터 표시한다.
gaps:
  - adopt: 출처와 분야를 가까이 묶고 식별자를 PDF 선택 직전에 두어 한 카드의 판독 순서를 단순화한다.
  - reject: DOI 누락 placeholder, provider metadata shape 변경, surface별 별도 카드 구현은 추가하지 않는다.
verdict: met
```

#### 2026-08-21 — 통합 기본순의 legacy basis 우회 차단

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-selected-sort
acReviewedRevision:
  - 3
fixtureRef: app/server/services/__tests__/search-execution.test.ts; app/lib/__tests__/api-routes.test.ts; app/components/research-route-renderers/__tests__/search-view-states.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 0a24696b4263+worktree
observedOutput: 과거 basis projection이 남긴 sort=relevance와 sort=interest 직접 주소는 입력 검증을 통과하지만 현재 실행에서는 sort 없는 주소와 같은 canonical identity와 통합 기본순으로 정규화된다. 현재 URL writer도 두 내부 basis 값을 쓰지 않는다. 인용순·최신순·오래된순만 명시적인 보조 정렬로 남아 선택한 결정적 순서를 적용한다.
gaps:
  - adopt: 같은 canonical search identity는 같은 통합 결과 projection을 공개한다.
  - reject: 관련순을 라이브러리 후보를 제거하는 숨은 escape hatch로 보존하지 않는다.
verdict: met
```

#### 2026-08-21 — venue와 분야의 의미적 스캔 기준점

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
acReviewedRevision:
  - 16
  - 5
  - 5
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/search-result-item.tsx; docs/design-standards.md
runCommitSha: 07b49a1ff4d0+worktree
observedOutput: 반복 논문 카드의 metadata 행은 venue를 왼쪽 출처 기준점에 두고, 최대 두 분야를 눈에 보이는 `분야` 라벨과 함께 오른쪽 분류 기준점에 둔다. 좁은 화면에서는 두 기준점을 위아래로 쌓는다. venue 또는 분야가 없으면 빈 DOM이나 고정 폭 placeholder를 만들지 않고 남은 정보만 자기 기준점에 표시한다. 제목 우측 보조 정보도 실제로 존재하는 marker, 대표 표시, 연도, 라이브러리 액션만 순서대로 렌더한다. Keyword 결과와 query-aware graph 후보는 첫 payload의 한 목록을 계속 구성하며, 두 membership AC는 사용자 표식 의미를 소유하지 않는다.
gaps:
  - adopt: 사용자가 카드마다 같은 위치를 훑을 수 있도록 source와 taxonomy를 서로 다른 의미적 기준점으로 구분한다.
  - adopt: 결과 membership과 사용자 표식 의미의 소유권을 분리하고, 표식은 library-grounded-research AC가 소유한다.
  - reject: 일부 값이 없는 카드를 맞추기 위한 빈 slot과 고정 폭 placeholder는 만들지 않는다.
verdict: met
```

#### 2026-08-21 — 결과 header와 조건 writer의 단일 기준 정리

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-selected-sort
  - acceptance-check:search-results-fast-window-result-basis-visible
  - acceptance-check:search-results-fast-window-library-bootstrap-outcomes
  - acceptance-check:search-results-fast-window-post-search-layout-about
  - acceptance-check:search-results-fast-window-publication-year-range-filter
  - acceptance-check:search-results-fast-window-reviewed-papers-context-source
  - acceptance-check:search-spelling-correction-corrected-apply-route-owned
acReviewedRevision:
  - 2
  - 18
  - 2
  - 14
  - 2
  - 10
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.year-range.test.tsx; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/api/search/__tests__/route.helpers.test.ts; app/server/services/__tests__/search-execution.test.ts
runCommitSha: 9c14bfd2ec62+worktree
observedOutput: 검색 결과 header는 기준 토글 없이 내 라이브러리 반영 또는 반영 없음만 설명하고 정렬 select는 기본순, 인용순, 최신순, 오래된순만 제공한다. 새 검색, 연도 조건, facet, 맞춤법 교정, 비슷한 논문과 keyword 후속 writer는 personalize를 주소에 쓰지 않는다. Bootstrap은 라이브러리 availability만 제공하며 별도 preference를 복원하지 않는다. 저장 논문 목록은 source 관리 surface로 남고 검색 실행 기준을 선택하는 control로 동작하지 않는다.
gaps:
  - adopt: 기본순은 사용자가 선택할 별도 연구 기준이 아니라 이용 가능한 라이브러리 신호를 자동 반영한 결과 순서다.
  - reject: 저장 논문 목록 편집과 출판연도·facet·보조 정렬을 이번 개편에서 제거하지 않는다.
verdict: met
```

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-28 — comma query remains one compound search intent

```yaml
date: 2026-07-28
acs:
  - acceptance-check:search-results-fast-window-comma-query-single-intent
acReviewedRevision:
  - 1
fixtureRef: app/lib/__tests__/search-query.test.ts; app/server/services/__tests__/query-clause-normalization-service.test.ts; app/server/services/__tests__/search-service.test.ts; app/server/services/__tests__/search-service.multi-query.test.ts; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx
runCommitSha: 9943bce1683f+worktree
observedOutput: Comma-containing topical queries and paper titles produce one normalized clause and one Episteme keyword request, while semicolon and newline inputs remain explicit multi-query separators with merged clause metadata.
gaps:
  - adopt: The query parser and provider boundary now preserve the approved compound-search meaning for comma input.
  - reject: A separate independent-search interaction is outside this Acceptance Check and is not inferred from punctuation.
verdict: met
```

#### 2026-07-23 — result cards use one library-proximity label

```yaml
date: 2026-07-23
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 12
fixtureRef: app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx
runCommitSha: b36c53d5c625
observedOutput: Expanded search result cards use 검색어 일치 for keyword-only results, 검색어 일치 · 라이브러리 인접 for overlap, and 라이브러리 인접 for candidates absent from the keyword result window that joined from the query-aware graph retrieval.
gaps:
  - adopt: The graph-only marker describes its library relation without making a false query-irrelevance claim.
  - reject: Internal tone keys and libraryOnlyPaperIds remain compatibility identifiers rather than product copy.
verdict: met
```

#### 2026-07-22 — result-basis wording follows the current internal library source

```yaml
date: 2026-07-22
acs:
  - acceptance-check:search-results-fast-window-result-basis-visible
acReviewedRevision:
  - 17
fixtureRef: docs/contracts/story-chain/experiences/research-and-discovery.md; docs/contracts/story-chain/aspects/library-grounded-research.md; app/about/__tests__/search-mechanism-page.test.tsx
runCommitSha: ef3c9921b71d+worktree
observedOutput: The Experience, result-basis Acceptance Check, and public search explanation all name the default saved-paper source as Light House의 내 라이브러리. External Moonlight library access remains an explicitly enabled compatibility path. Search basis controls and runtime behavior are unchanged.
gaps:
  - adopt: Human selected the current internal reviewed_papers source as the Experience-level wording authority.
  - reject: The compatibility source is not presented as the default product library.
verdict: met
```

#### 2026-07-22 — retired feature onboarding stays absent from the research shell

```yaml
date: 2026-07-22
acs:
  - acceptance-check:search-results-fast-window-bootstrap-auth-challenge
acReviewedRevision:
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research/__tests__/research-route-shell.library-context.test.tsx; app/(research)/__tests__/layout.test.tsx; app/(research)/__tests__/research-routes.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx; app/components/__tests__/MoonlightAuthBootstrap.test.tsx; app/api/auth/magic-link/__tests__/route.test.ts; app/api/auth/magic-link/__tests__/production-auth-config.test.ts; app/lib/__tests__/track.test.ts; app/lib/analytics/__tests__/event-router.test.ts
runCommitSha: ec8b638a+worktree
observedOutput: Research shell first paint와 빈 검색 entry는 server auth gate 앞에서 먼저 렌더된다. Post-mount bootstrap 401 또는 Scholar-session-invalid가 발생하면 공용 shell이 stale route content, active view, background work, account, footer를 내리고 기존 인증 화면으로 전환한다. Authenticated bootstrap 뒤에는 폐기된 feature onboarding modal이 mount되지 않으며, route account control에도 onboarding reopen action이 없다. 관련 119개 테스트가 통과했다.
gaps:
  - adopt: 별도 feature onboarding은 인증 전환 계약의 일부가 아니며, 검색과 탐색 행동은 각 화면의 실제 조작 표면에서 드러난다.
  - reject: 폐기된 modal, seen key, reopen control, onboarding event를 compatibility surface로 복원하지 않는다.
verdict: met
```

#### 2026-07-17 — term discovery consumes only current usable analysis

```yaml
date: 2026-07-17
acs:
  - acceptance-check:search-results-suggest-english-terms-result-basis
acReviewedRevision:
  - 5
fixtureRef: app/server/services/__tests__/search-term-discovery.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx
runCommitSha: 59d73c57763e+worktree
observedOutput: 검색어 추출 prompt와 method-support count는 현재 v8, fingerprint가 있는 성공 분석, usable abstract를 함께 만족하는 inline analysis만 사용한다. Legacy v7 분석과 공백 초록에 남은 분석은 semantic profile 신호에 참여하지 않는다. 서버 후보 구성과 graph-support를 보존하는 클라이언트 merge 모두 공백뿐인 초록을 `제목·초록` 근거로 말하지 않는다. Graph support가 없으면 `제목`, 있으면 `제목 + 첫 검색 결과의 라이브러리 그래프 근거`로 실제 근거만 조합한다.
gaps:
  - adopt: 검색 결과의 현재 title·usable abstract는 term discovery 입력으로 남고, embedded analysis는 공통 current-analysis predicate로 제한하며 basis label도 같은 usable-abstract 판정을 공유한다.
  - reject: 이 보강은 새 term 생성 단계나 analysis-upgrade phase를 추가하지 않는다.
verdict: met
```

#### 2026-07-14 — research terms consume first-payload graph evidence

```yaml
date: 2026-07-14
acs:
  - acceptance-check:search-results-suggest-english-terms-result-basis
  - acceptance-check:search-results-suggest-english-terms-background-llm-primary
acReviewedRevision:
  - 4
  - 5
fixtureRef: app/server/services/__tests__/search-term-discovery.test.ts; app/server/services/__tests__/search-term-discovery.background.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.term-discovery.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx
runCommitSha: 7f2ddb90bcb3
observedOutput: Term extraction remains a compact background LLM task over the visible result titles, abstracts, and inline-analysis context. When the first search payload already contains library-anchor graph evidence, existing accepted terms receive graph-supported counts, basis copy, and deterministic reordering. Neither term discovery nor card hydration starts a graph provider request, synthesizes a term from graph evidence alone, or accepts a later graph basis.
gaps:
  - adopt: first-payload graph evidence is an auxiliary strength signal for already accepted LLM terms.
  - adopt: no-key, timeout, failure, and filtered-empty extraction still close as an honest empty LLM result.
  - reject: current-result corpus ids are not a fallback PaperNeighborhood seed for term enrichment.
verdict: met
```

#### 2026-07-13 — owner principal handoff excludes shared gap artifacts

```yaml
date: 2026-07-13
acs:
  - acceptance-check:search-results-fast-window-session-principal-handoff
acReviewedRevision:
  - 2
fixtureRef: app/server/auth/__tests__/identity.test.ts; app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts; app/server/repository/__tests__/gap-reports.test.ts; docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.md
runCommitSha: 650d73a7ff7e+worktree
observedOutput: Moonlight and Supabase session resolution still derives the verified principal used by owner-scoped research resources. The reviewed-paper auth-boundary suite keeps those resources behind an explicit owner-principal filter. The shared gap repository suite is the negative exception: artifact persistence carries its canonical digest and source snapshot without creator owner or reaction columns, digest lookup maps the authenticated current viewer only into runtime context, and reaction persistence keys the preference by viewer principal plus artifact version. The search-result ledger runs both the owner-scoped boundary and this shared-artifact exception together, so principal handoff no longer implies that every stored resource has an owner column.
gaps:
  - adopt: Verified principal ownership applies only to owner-scoped resources; shared gap artifacts use authenticated member reads and viewer-scoped reaction preference instead of creator ownership.
  - reject: The shared artifact does not regain an owner_principal_id column or creator-based read authorization to make the generic session wording uniform.
verdict: met
```

#### 2026-07-12 — bootstrap 401 hands research routes to authentication

```yaml
date: 2026-07-12
acs:
  - acceptance-check:search-results-fast-window-session-principal-handoff
  - acceptance-check:search-results-fast-window-bootstrap-auth-challenge
  - acceptance-check:search-results-fast-window-library-bootstrap-outcomes
  - acceptance-check:search-results-fast-window-result-basis-visible
acReviewedRevision:
  - 1
  - 1
  - 1
  - 16
fixtureRef: app/__tests__/proxy.test.ts; app/components/MoonlightAuthBootstrap.tsx; app/components/EmailGate.tsx; app/(research)/research-route-shell.tsx; app/components/research/__tests__/research-route-shell.library-context.test.tsx
runCommitSha: 100a1a5a9f1a+worktree
observedOutput: Research shell first paint and the empty search entry stay off the server auth gate. A post-mount bootstrap 401 or Scholar-session-invalid result makes the shared shell the single auth-surface owner and removes a seeded stale active view, route content, account chrome, onboarding, and background work. Successful token/session exchange stays within five seconds and keeps the auth surface mounted until a same-URL full-document navigation resets client and RSC state. Token 403 preserves the allowlist notice; other exchange failures bound stale local Scholar session cleanup to one second, abort it on timeout or unmount, and then show EmailGate. Bootstrap 200 seeds current account and library state, while ordinary non-auth failures keep research content and lower account and library projections to unavailable. The canonical challenge-view event fires after the auth state is committed and initializes SDK identity before delivery. EmailGate retains the Moonlight source-coverage explanation.
gaps:
  - adopt: Authentication-required state is owned by ResearchRouteShell, while token exchange and EmailGate fallback remain owned by MoonlightAuthBootstrap.
  - adopt: Proxy cleanup removes stale Supabase cookies from both the browser response and the same request's downstream Cookie header.
  - reject: A server-layout auth wait is not restored; the shell still paints before post-mount auth and library bootstrap outcomes arrive.
verdict: met
```

#### 2026-07-12 — research term click feedback before route arrival

```yaml
date: 2026-07-12
acs:
  - acceptance-check:search-results-suggest-english-terms-click-feedback
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: c6a4e99ef2f7+worktree
observedOutput: Research-term links call the shared handler. Plain clicks immediately show the selected term in a sticky persistent screen-level status region while the origin results remain mounted, including when the clicked term is deep in the scroll container. Destination arrival removes that acknowledgement before the route-owned search processing state continues; shell unmount cancels its local timer and state.
gaps:
  - adopt: The immediate-navigation contract now distinguishes visible click acknowledgement from destination-owned search processing.
  - reject: The retired content-replacing origin transition is not restored; existing search results remain visible until the destination route arrives.
verdict: met
```

#### 2026-07-11 — logical freshness and bounded post-result transports

```yaml
date: 2026-07-11
acs:
  - acceptance-check:search-results-fast-window-loaded-result-facet-filters
  - acceptance-check:search-spelling-correction-spelling-correction-metadata-recorded
acReviewedRevision:
  - 3
  - 1
fixtureRef: app/stores/__tests__/research-route-store-internals.mutation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/lib/__tests__/view-snapshot.test.ts; app/components/research-route-renderers/__tests__/search-view-content.spelling-correction.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.term-discovery.test.tsx; app/lib/__tests__/fetch-with-silence-timeout.test.ts; docs/runtime-flows/search-mechanism.md
runCommitSha: 6835982d+worktree
observedOutput: Equal or older proposed timestamps advance the current visible-view freshness by one logical millisecond. A server-clock-ahead facet mutation therefore applies instead of being rejected, and pre-flush route AI generation rebases to the current basis snapshot. Search UI and AI focused context share the same year/facet/sort projection, so excluded papers and counts do not reappear in generated-comment input. First-reveal-locked hydration keeps the committed pool; legacy personalized hydration accepts a supplement pool and library basis through a base/current/incoming merge while preserving current sort/facet and newer inline analysis. Search, graph, term, and inline JSON transports share a 65-second silence rail whose fetch/body races settle even when abort is ignored. Spelling correction keeps its separate 25-second execution-scoped deadline.
gaps:
  - adopt: updatedAt is the visible snapshot freshness token, so every accepted semantic mutation must advance it strictly even when wall clocks disagree.
  - adopt: result rendering and AI focused context consume one shared loaded-result projection.
  - adopt: subtree remount is not an execution cancellation boundary; execution replacement and the bounded client deadline are.
  - adopt: legacy personalized hydration may change the pool, but only the server-owned hydration/library fields; current user and per-paper writer deltas win their fields.
  - adopt: every post-result JSON transport has a terminal silence boundary even when the underlying fetch or body reader ignores abort.
  - reject: a never-settling spelling transport may not reserve its module request key indefinitely.
verdict: met
```

#### 2026-07-09 — first reveal owns search result basis

```yaml
date: 2026-07-09
acs:
  - acceptance-check:search-results-fast-window-inline-analysis-visible-first
acReviewedRevision:
  - 6
fixtureRef: app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; docs/runtime-flows/search-mechanism.md
runCommitSha: b949b07b9a4d+worktree
observedOutput: Personalized search still starts cached My Library graph preflight beside the provider fetch, and a preflight that finishes inside first-result grace is blended into the first payload. When the preflight misses grace, the committed search metadata carries `abstractHydration.libraryBlendPolicy: "first_reveal_only"` and hydration fills only the committed corpus ids, preserving the first-revealed libraryContext snapshot and avoiding late library-near card injection, card reordering, or basis marker changes. First-reveal-locked searches may generate the route AI comment from the committed result snapshot before inline analysis starts; inline analysis and term discovery still wait for hydrated abstracts.
gaps:
  - adopt: The user-visible result list is a single reveal surface; background enrichment may improve card details and graph support but cannot change which cards are being scanned.
  - reject: We do not hold the entire search page until a slow graph preflight finishes, because that would trade one confusing jump for an unbounded waiting surface.
verdict: met
```

#### 2026-06-30 — search controls keep internal basis and card affordances

```yaml
date: 2026-06-30
acs:
  - acceptance-check:search-results-fast-window-reviewed-papers-context-source
  - acceptance-check:search-results-fast-window-result-basis-visible
  - acceptance-check:search-results-fast-window-year-distribution
  - acceptance-check:search-results-fast-window-post-search-layout-about
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-suggest-english-terms-prefilled-search
acReviewedRevision:
  - 8
  - 15
  - 12
  - 12
  - 4
  - 4
fixtureRef: app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.year-range.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: e582aed6ac1d
observedOutput: The route bar can show the internal reviewed_papers list surface without using it as a selected-anchor transport for the next search, and result-basis copy stays provider-honest without default legacy library controls. Search result conditions keep publication-year distribution inside the year filter dropdown, and compact sort/PDF controls stay out of the card list. Paper titles stay keyboard-focusable even while details are preparing so the app-rendered tooltip can explain the state, and ready titles still open the inspection disclosure. Keyword follow-up navigation reserves canonical search ResearchRoutePayloads without carrying legacy selected libraryPaperIds, while preserving internal personalize preference or opt-out when context exists.
gaps:
  - adopt: Current UI evidence follows actual open/closed dropdown state and the internal reviewed_papers basis rule from main.
  - adopt: Preparing title affordances remain focusable explanation surfaces rather than native disabled buttons.
  - reject: This review covers the current result window behavior.
verdict: met
```

#### 2026-05-04 — Intent absorbed for 4 deterministic search promises

```yaml
date: 2026-05-04
acs:
  - acceptance-check:search-results-fast-window-initial-dom-window
  - acceptance-check:search-results-fast-window-load-more-shows-progress-counts
  - acceptance-check:search-results-fast-window-inline-analysis-visible-first
acReviewedRevision:
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/search-result-window.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (cap 차단 + seed metadata + 탭 포커스). β Wovenness — 20 ACs (5+7+8) 모두 ledger Acceptance Checks 블록과 Coverage By Promise pointer로 wired.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This converted entry uses current active AC refs only.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: `promise:search-results-fast-window` (5 ACs), `promise:search-query-route-transition` (7 ACs), `promise:similar-papers-discovery` (8 ACs) — 모두 search 흐름의 surface mechanics을 잡는 deterministic 약속. Human Judgment Gate 결정 — 각 AC가 단일 store state · DOM presence · handler 호출 · helper return-value assertion으로 닫히고 emergent 속성 없음.
- Evidence: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (cap 차단 + seed metadata + 탭 포커스). β Wovenness — 20 ACs (5+7+8) 모두 ledger Acceptance Checks 블록과 Coverage By Promise pointer로 wired.
- Gaps observed:
  - Adopt-resolved — 4 promises × 25 ACs absorbed. 본 IV 블록에 absorption pointer 박음.
  - Reject — γ Necessity (배너 시각감 / 결과 카드 위계) 평가는 verdict에 포함 안 함; future signal review으로 분리.
- Verdict: met

#### 2026-05-03 — canonical promise verdict backfill for `promise:search-reaction-summarizes-terrain` and `promise:inline-analysis-auto-run`

```yaml
date: 2026-05-03
acs:
  - acceptance-check:search-results-fast-window-initial-dom-window
  - acceptance-check:search-results-fast-window-load-more-shows-progress-counts
  - acceptance-check:search-results-fast-window-inline-analysis-visible-first
  - acceptance-check:search-spelling-correction-original-results-shown-first
  - acceptance-check:search-spelling-correction-corrected-query-not-auto-submitted
  - acceptance-check:search-spelling-correction-spelling-correction-metadata-recorded
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/search-result-window.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `search-awareness-intent-qualitative.live.test.ts` exercises the real route-view reaction generation path and route-view surface normalization; `research-route-runtime.additional.test.ts` / `ResearchRouteLayout.reactions.test.tsx` lock the guided-tree reaction surface; `inline-analysis-intent-qualitative.live.test.tsx`, `search-view-content.test.tsx`, and `search-view.helpers.test.ts` lock phrase-level inline semantic profile and 4-state status rendering. β Wovenness — both canonical promises are listed in Source Promises and their canonical Intent Checks are now declared in this `## Intent Verification` block.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This converted entry uses current active AC refs only.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: Story Chain canonicalized the search awareness and inline-analysis promises as `promise:search-reaction-summarizes-terrain` and `promise:inline-analysis-auto-run`. Earlier 2026-04-21/22/23 entries already closed the same runtime evidence, but the release extractor requires the canonical promise refs in the dated Intent Verification/Sufficiency Review path.
- Evidence: α Coverage — `search-awareness-intent-qualitative.live.test.ts` exercises the real route-view reaction generation path and route-view surface normalization; `research-route-runtime.additional.test.ts` / `ResearchRouteLayout.reactions.test.tsx` lock the guided-tree reaction surface; `inline-analysis-intent-qualitative.live.test.tsx`, `search-view-content.test.tsx`, and `search-view.helpers.test.ts` lock phrase-level inline semantic profile and 4-state status rendering. β Wovenness — both canonical promises are listed in Source Promises and their canonical Intent Checks are now declared in this `## Intent Verification` block.
- Gaps observed:
  - Adopt-resolved — release-verdict promise extraction requires canonical `promise:*` refs with canonical refs; this entry re-points the existing evidence without changing runtime behavior.
  - Reject — full `evidence-ledger` rerun for this formatting backfill is deferred to release-final; targeted deterministic and story-chain gates cover the edited contract surface.
- Verdict: met

#### 2026-07-05 — prefilled-search AC 본문을 조건 URL 실행 모델로 정합 (rev 8 재검토)

```yaml
date: 2026-07-05
acs:
  - acceptance-check:search-results-suggest-english-terms-prefilled-search
acReviewedRevision:
  - 8
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.md
runCommitSha: 73ffe3f45b3a
observedOutput: Revision bump is a wording catch-up, not a behavior change — the AC body's reserve-era sentences (server document reserve, canonical /search/:id redirect) were replaced with the Search-first condition-URL execution wording that the search-ephemeral-execution ledger already locks. The behavior the AC asserts is unchanged and its executable evidence rows keep passing. Term/position follow-ups still navigate immediately to the /search?q= entry URL, transitions clear on arrival or bounded stale cleanup, detached activation opens the same URL in a new tab, and termSeed stays a transient param preserved into result metadata while the canonical condition URL stays seed-free.
gaps:
  - adopt: AC prose now matches the executed condition-URL model, clearing the revision drift signal.
  - reject: No follow-up navigation or seed-carry behavior change is claimed.
verdict: met
```

#### 2026-08-21 — 통합 기본순 legacy 입력 exact-commit 재검토

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-selected-sort
acReviewedRevision:
  - 3
fixtureRef: app/server/services/__tests__/search-execution-legacy-position.test.ts; app/lib/__tests__/api-routes.test.ts; app/components/research-route-renderers/__tests__/search-view-states.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: d3365127e26aec3aa1f856926fb7e22b4b501baf
observedOutput: exact 기능 커밋에서 sort=relevance와 sort=interest 직접 입력은 sort 없는 주소와 같은 canonical identity와 통합 기본순으로 정규화되고, 현재 URL writer는 두 retired basis 값을 생략한다. 인용순·최신순·오래된순만 명시적인 보조 정렬과 provider sort로 남는다.
gaps:
  - adopt: 같은 canonical search identity는 같은 통합 결과 projection을 공개한다.
  - reject: legacy basis 입력을 별도 결과 목록으로 되살리는 escape hatch를 두지 않는다.
verdict: met
```

#### 2026-08-21 — 후속 검색 basis 제거와 metadata 없음 상태 재검토

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-suggest-english-terms-prefilled-search
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 9
  - 17
fixtureRef: app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/services/__tests__/search-view-payload.test.ts; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx; docs/runtime-flows/search-retrieval-ranking.md; docs/design-standards.md
runCommitSha: bab657eb08b4764256f015e561006a6e1e2e5876
observedOutput: 연구 용어 링크는 termSeed를 transient entry parameter로 보존하면서 canonical `/search?q=` 조건으로 즉시 이동하고, legacy selected libraryPaperIds와 retired personalize 기준을 싣지 않는다. 반복 논문 카드의 metadata 행은 실제 값 유무와 관계없이 venue의 왼쪽 출처 기준점과 분야의 오른쪽 분류 기준점을 유지하며, 누락 값은 낮은 강조도의 `출처 정보 없음`, `분야 정보 없음`으로 명시한다.
gaps:
  - adopt: term provenance와 현재 검색 projection을 분리하고, metadata 누락도 스캔 가능한 정보로 표현한다.
  - reject: 없음 문구를 facet 값으로 만들거나 제목 행의 선택 정보까지 빈 슬롯으로 고정하지 않는다.
verdict: met
```

#### 2026-08-25 — 저자 요약 중심의 서지 줄

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-card-inspection
acReviewedRevision:
  - 20
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/search-result-author-byline.tsx; app/components/research-route-renderers/search-result-item.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 반복 논문 카드는 venue·분야·저자를 한 서지 줄에서 읽게 하고, 저자는 첫 저자와 `외 N명`만 기본 표시한다. 저자 요약을 선택한 뒤에만 전체 저자 목록이 같은 카드에 열리며, 목록의 저자를 선택하면 기존 저자 검색을 실행하고 카드 inspection은 바뀌지 않는다. 저자 수가 많아도 기본 카드의 액션과 인용 정보 기준점은 유지된다.
gaps:
  - adopt: 기본 상태에서는 저자 수보다 논문 간 스캔 리듬을 우선하고 전체 저자 식별은 명시적 요약 선택 뒤에 제공한다.
  - reject: 모든 저자를 기본 행에 개별 링크로 늘어놓거나 별도의 저자 펼치기·접기 문구를 반복하지 않는다.
verdict: met
```

#### 2026-08-25 — venue 아래의 세 저자 기본 행 복원

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-card-inspection
acReviewedRevision:
  - 21
  - 4
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/search-result-author-row.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; app/components/research-route-renderers/search-result-item.tsx
runCommitSha: d571dc25baa8a39f18c6ec3eecadeba3f1096e4d
observedOutput: 반복 논문 카드는 venue와 분야를 한 metadata 행에 두고 바로 아래 저자 행에서 최대 세 명을 직접 표시한다. 네 명째부터는 `외 N명 펼치기`로 같은 행에서 열고 `접기`로 세 명 기본 상태에 돌아간다. 저자 이름과 펼침 토글은 카드 inspection을 바꾸지 않으며, 토글은 상태가 바뀌어도 같은 DOM control로 남아 키보드 포커스를 유지한다. DOI 고정 슬롯과 뒤따르는 PDF·인용 기준점은 그대로 유지된다.
gaps:
  - adopt: 저자 식별을 위해 기본 세 명을 venue 아래에서 직접 보여 주고 나머지만 명시적으로 펼친다.
  - reject: 첫 저자와 인원수만 보이는 요약 또는 별도 저자 dialog로 돌아가지 않는다.
verdict: met
```
