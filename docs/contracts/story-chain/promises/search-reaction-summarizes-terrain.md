---
id: promise:search-reaction-summarizes-terrain
slug: search-reaction-summarizes-terrain
title: Search reaction summarizes terrain
moment: moment:search-results-first-review
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:route-view-ai-comment-generation-routing
  - aspect:route-view-ai-reaction-rules
  - aspect:knowledge-map-followup-surface
  - aspect:provider-failure-degraded-mode
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:library-grounded-research
  - aspect:ai-comment-research-term-suggestions
intentChecks:
  - intent-check:result-set-terrain-is-not-query-repetition
  - intent-check:search-reaction-ux-writing-voice
acceptanceChecks:
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
  - acceptance-check:search-reaction-summarizes-terrain-generation-boundary
  - acceptance-check:reaction-respond-format
  - acceptance-check:search-reaction-structured-generation-boundary
  - acceptance-check:search-reaction-summarizes-terrain-representative-badges
  - acceptance-check:search-reaction-summarizes-terrain-library-grounding
  - acceptance-check:search-reaction-summarizes-terrain-input-paper-cap
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Search reaction summarizes terrain

## Promise

검색이 끝나면 Light House는 결과 목록에 어떤 세부 영역, 긴장, 다음 경로가
있는지 짧게 설명한다. 쿼리를 그대로 되풀이하지 않는다. 연구 공백 지도 만들기는
검색 결과 기준 row 우측의 UI action이 담당하고, 대표 논문은
별도 버튼으로 열지 않고 검색 결과 리스트의 대표 표시로 드러낸다.

## Intent Checks

### intent-check:result-set-terrain-is-not-query-repetition

- question: Does the search reaction body summarize the terrain of the result set with concrete sub-areas, tensions, or next paths grounded in result metadata, instead of repeating the query?
- evidence: live judge output over the real route AI comment generation output at `app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts` (the live test judges the reaction body while the research-gap entry point is owned by the result-basis row).
- why live judge: AC-level structural checks confirm a body exists and contains numeric counts, but they cannot rule out shallow query-repetition prose like "X에 관한 논문이 N편 있습니다" — the difference between terrain summarization and query echo is a semantic judgement.
- linked acceptance checks:
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
- answer criteria: response names concrete sub-areas, tensions, or next paths grounded in result metadata. It should privilege repeated axes across multiple result titles/years/citation signals over one paper's unusual or promotional wording. Pure query-repetition, vague generalities ("이 분야의 다양한 연구"), or treating a single paper's "novel/first/new" phrasing as the whole field's core fail.

### intent-check:search-reaction-ux-writing-voice

- question: 생성된 검색 반응 title/body가 군더더기 없이 능동·긍정형으로 읽히고, 누구나 아는 보편적 단어로 결과 지형을 설명하며 다음 행동을 권유하는 voice·tone craft를 따르는가?
- evidence: live judge output over the real route AI comment generation output at `app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts` ("search completion route AI comment generation answers the UX-writing voice·tone Critical Intent Questions").
  `app/server/agent/__tests__/route-ai-comment-generation.test.ts` ("adds next-path guidance only for search view snapshots") locks the search-specific prompt guidance that asks generated bodies to suggest a next exploration path.
- why live judge: 고정 문구 registry 계약은 직접-사용자 microcopy의 개발 용어·에러 코드 노출과 말투 종결만 결정적으로 막는다. 생성 반응 문장이 군더더기 없이 능동·긍정형으로, 보편적 단어와 권유형 voice로 읽히는지는 같은 정보를 담고도 표현이 어떻게 읽히는지에 대한 의미 판단이라 deterministic 규칙으로 닫을 수 없다.
- linked acceptance checks:
  - acceptance-check:reaction-respond-format
- answer criteria: 반응 title/body가 생략해도 뜻이 통하는 군더더기를 덜어내고, 제약을 먼저 방어하기보다 결과 지형과 가능한 다음 경로를 능동·긍정형으로 제시하며, 전문 용어 남발 없이 보편적 단어로 권유하면 충족. 군더더기 반복, 제약만 나열한 부정형, 개발 용어·에러 코드 노출, 강요·공포 어조는 미달성이다.

## Acceptance Checks

### acceptance-check:search-reaction-summarizes-terrain-host-gap-action

- description: A search reaction body is attached when generation succeeds. Before the first generated body arrives, the result ResearchRoutePayload renders a pending AI comment status in the same content rail as soon as the result list itself is visible; queued, hydration-gated, or active generation keeps that same state. Facet이 없는 검색은 result commit에서 후보군·순서·라이브러리 grounding이 고정되므로 personalized 여부나 저장된 hydration policy 호환값과 관계없이 committed snapshot에서 provider generation을 시작한다. 저자·분야·venue·PDF처럼 card hydration에 의존하는 loaded-result facet이 활성화된 검색은 pending 표시를 유지하고 card detail 보강이 정상 응답으로 끝나거나 최대 3회 bounded retry 뒤 degraded terminal로 닫힌 다음, 현재 facet result pool에서 한 번만 생성한다. 개별 provider 오류·abort는 successful-empty로 간주하거나 `repairAttempted`를 기록하지 않는다. 정상적인 빈 200 응답은 즉시 terminal marker를 남기고, 세 번 모두 실패하면 lightweight 근거를 보존한 `ready + repairAttempted:true`로 닫아 무한 대기를 막는다. Background card hydration은 grounding을 뒤늦게 붙이지 않으며, facet result pool을 바꾸지 않는 detail 보강은 생성된 comment를 버리거나 다시 생성하지 않는다. Explicit regeneration preserves the settled card and shows only regeneration pending. The visible research-gap entry point is the `연구 공백 지도 만들기` action on the result-basis row, not the filter/sort controls, compact search metadata, or AI comment frame.
- evidence: `app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx` ("keeps search metadata compact and renders research terms as clickable AI comment text") verifies the gap-map action sits on the result-basis row, `app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx` ("waits for a hydration-dependent search facet and generates once from the stable result set"; "clears pending when hydration settles with an empty facet projection") verifies the pending-to-one-generation facet boundary and terminal empty result, `app/server/domain-access/__tests__/search-enrichment-access.test.ts` ("marks a successful empty pending hydration as terminal without rebuilding cards"; "marks a successful empty ready-snapshot repair as terminal") verifies both the initial pending path and the compatibility-repair path preserve committed cards and record canonical `repairAttempted`, `app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx` ("retries search enrichment before leaving a pending result in place"; "terminates abort-ignoring enrichment attempts and releases the runner") verifies individual failures remain retryable and the third failed attempt settles the lightweight result with `ready + repairAttempted:true`, `app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts` ("waits for one-shot repair before generating from a ready faceted search"; "closes AI comment hydration waiting after a successful empty repair") verifies the terminal marker closes the shared hydration gate and prevents another repair from being queued, and `app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts` verifies automatic route-view reaction generation returns nullable structured output without persisting fallback comments.
- run: `npx vitest run app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx app/server/domain-access/__tests__/search-enrichment-access.test.ts 'app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts'`
- revision: 4
### acceptance-check:search-reaction-summarizes-terrain-generation-boundary

- description: 새 query request가 이전 반응을 비우고 새 result commit을 만들면 route AI comment generation이 새 결과 기준으로 다시 1회 발화된다. automatic generation trigger source는 store-commit bootstrap 단일 경로를 유지한다. dedup 경계는 문서 lifetime이 아니라 reaction generation과 prompt-relevant `ViewSnapshot` projection이다. 인라인 분석처럼 projection에 포함되지 않는 metadata 변경은 재발화하지 않는다. projection이 바뀌면 `promise:reaction-from-visible-snapshot`의 basis-match AC에 따라 현재 projection에서 다시 생성한다. 큐에 남아 있던 generation command도 대상 문서의 generation이 지나갔으면 flush 시점에 버린다. facet이 없는 pending 검색은 search retrieval과 library grounding이 첫 payload에서 이미 고정되어 있으므로 personalized 여부와 `abstractHydration.libraryBlendPolicy` 호환값에 관계없이 commit terrain 기준으로 1회 생성된다. Background card hydration이 current facet result pool을 바꾸지 않으면 provider generation의 선행 조건이 아니고 comment를 재생성하지 않는다. 반대로 hydration-owned 저자·분야·venue·PDF facet이 활성화된 동안에는 visible pending 상태만 유지한다. 어느 자동 생성이나 재생성 경로도 이 대기를 우회하지 않는다. 개별 provider 오류·abort는 성공한 빈 보강으로 바꾸지 않고 최대 3회 bounded retry한다. 정상적인 빈 200 응답은 즉시, 세 번 모두 실패한 경우에는 lightweight 근거를 보존한 degraded settlement가 `ready + repairAttempted:true`를 기록해 repair를 terminal로 닫는다. 그러면 current facet projection에서 1회 생성하고, 결과가 비어 있으면 provider 요청 없이 pending 상태를 내린다.
- evidence: vitest @ `app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx` ("re-fires one route AI comment generation when a query transition clears the reaction and commits a new result"; "fires at commit for a personalized pending search without waiting for card hydration") + `app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx` ("keeps one generation when a lightweight search card hydrates after the comment settles"; "waits for a hydration-dependent search facet and generates once from the stable result set"; "rechecks hydration readiness when a queued command becomes gated before flush"; "reopens bootstrap when an active same-projection request becomes hydration-gated"; "resumes a settled-card regeneration after an active hydration gate closes"; "clears pending when hydration settles with an empty facet projection") + `app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts` ("waits for hydration when an active search facet depends on card details"; "waits for one-shot repair before generating from a ready faceted search"; "closes AI comment hydration waiting after a successful empty repair"; "keeps an unfaceted pending search on the first-commit generation path"; "skips empty search ResearchRoutePayloads when building generation commands") + `app/server/domain-access/__tests__/search-enrichment-access.test.ts` ("marks a successful empty pending hydration as terminal without rebuilding cards"; "marks a successful empty ready-snapshot repair as terminal"; "preserves the terminal repair marker when hydration returns no usable card details") + `app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx` ("retries search enrichment before leaving a pending result in place"; "terminates abort-ignoring enrichment attempts and releases the runner") + `app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx` ("drops an active result and regenerates from the current ViewSnapshot projection after the basis changes"; "does not re-fire an active regeneration for a metadata-only freshness change"). 새 query request 후 generation 1회 발화, generation이 지나간 큐 command의 flush-시점 드롭, projection이 바뀐 active 응답의 폐기와 현재 projection 재생성, detail-only hydration의 비재발화, unfaceted commit-시점 발화, hydration-dependent facet의 initial pending·repair 정상 빈 응답 또는 degraded terminal 이후 단일 발화·큐/active readiness 재검사·settled-card regeneration 재개·terminal empty 정리를 함께 잠근다.
- run: `npx vitest run app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts app/server/domain-access/__tests__/search-enrichment-access.test.ts app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx`
- revision: 6

### acceptance-check:reaction-respond-format

- description: 검색 route AI comment은 generated title/body 계약(title ≤30, body ≤400, plain-text, no host-owned button surface)을 따른다. 별도 자유 텍스트 출력 경로 없이 structured JSON generation 결과만 반영한다.
- evidence: vitest @ `app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts` ("generates a reaction from the supplied viewSnapshot without loading or persisting a route payload row"; "returns null generation results without persisting them") plus `app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx` ("shows a pending inline reaction for automatic generation before content arrives"; "shows a pending inline reaction for explicit regeneration while preserving the settled card"). Asserts automatic generation uses the supplied view snapshot without row reload or fallback persistence, null outputs do not persist fallback comments, and automatic generation exposes a named pending inline status before the first generated body arrives.
- run: `npx vitest run 'app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts' app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx`
### acceptance-check:search-reaction-structured-generation-boundary

- description: 검색 route-view reaction을 만드는 동안 에이전트는 직접 검색하지 않는다. route AI comment generation은 caller가 보낸 `viewSnapshot`과 structured generation gateway만 사용하고, legacy interactive reaction stream, `createMainTools`, `respond` tool-call, search tool 경로를 타지 않는다. 검색은 사용자 행동으로만 trigger된다.
- evidence: contract-check @ `scripts/evidence-ledger/helpers/contract-check.ts runtime-contract route-ai-comment-generation-boundary` plus vitest @ `app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx` ("bootstraps search route AI comment generation for a hydrated result ResearchRoutePayload with no reaction block"). Asserts route AI comment generation imports `executeStructuredGeneration`, does not import reaction response tooling, and route bootstrap owns automatic route-view reaction generation.
- run: `npx tsx scripts/evidence-ledger/helpers/contract-check.ts runtime-contract route-ai-comment-generation-boundary && npx vitest run app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx -t "bootstraps search route AI comment generation"`
### acceptance-check:search-reaction-summarizes-terrain-representative-badges

- description: 대표 논문 표시는 검색 결과 metadata(title, 저자, 연도, 인용 수, abstract)와 첫 payload에 함께 온 라이브러리 anchor 기반 graph support만으로 결정적으로 계산되어 검색 결과 리스트 카드에 `대표` 배지로 표시된다. 검색어 직접성과 field fit을 먼저 통과한 후보 안에서 graph support와 citationCount를 보조 정렬 신호로 쓰고, 제목 family 중복을 제거한다. 후보가 충분하지 않으면 검색 의도와 분야가 약하게만 맞는 high-citation 또는 graph-only 논문으로 억지로 채우지 않는다. graph support가 없는 keyword-only 검색은 기존 metadata와 citation 신호로 degrade한다.
- evidence: vitest @ `app/components/research/__tests__/representative-paper-selection.test.ts` ("uses graph support after the fit gate and before citation tie-breaks"; "keeps off-field high-citation papers out of representative badges") + `app/components/research-route-renderers/__tests__/search-result-item.test.tsx` ("marks representative papers inside the result list") + `app/components/research-route-renderers/__tests__/search-view-content.representative-filter.test.tsx` ("filters the visible list but opens gap analysis from the current top-result pool"). Asserts deterministic representative selection plus visible result-card badges/filtering.
- run: `npx vitest run app/components/research/__tests__/representative-paper-selection.test.ts app/components/research-route-renderers/__tests__/search-result-item.test.tsx app/components/research-route-renderers/__tests__/search-view-content.representative-filter.test.tsx`
- revision: 3

### acceptance-check:search-reaction-summarizes-terrain-library-grounding

- description: 라이브러리 신호가 있는 검색의 반응은 결과가 연구자의 라이브러리와 어떻게 닿는지 함께 짚는다. 어느 컬렉션의 관심사로 결과가 모였는지, 그 컬렉션과 가까운 갈래인지 아직 다루지 않은 쪽인지를 결과 지형 설명에 포함하도록 반응 입력 맥락에 라이브러리 컨텍스트를 주입한다. 신호가 없으면 반응 입력 맥락에 라이브러리 줄을 넣지 않고, 반응은 기존과 같게 결과 지형만 설명한다. 이 grounding은 first payload의 current metadata에 `libraryContext.signalPresent`가 이미 붙어 있을 때만 주입된다. Personalized 검색도 route 실행에서 graph preflight 결과를 함께 기다린 뒤 commit하므로 background card hydration이 late library grounding을 붙이는 일은 기다리지 않는다. 다만 저자·분야·venue·PDF facet이 활성화되어 hydration metadata가 visible membership을 결정할 때는 grounding 때문이 아니라 안정된 facet result pool을 위해 route AI comment bootstrap을 card detail 보강과 호환 repair가 끝날 때까지 보류한다. @aspect aspect:library-grounded-research
- evidence: vitest @ `app/lib/__tests__/view-snapshot.test.ts` ("includes library-grounded context in the search snapshot prompt only when a signal is present"). Asserts the current route-view `viewSnapshot` path names the reader's collections when `metadata.libraryContext.signalPresent`, and omits the library grounding line when no signal is present.
- revision: 3
- run: `npx vitest run app/lib/__tests__/view-snapshot.test.ts -t "library-grounded context"`

### acceptance-check:search-reaction-summarizes-terrain-input-paper-cap

- description: 검색 반응 입력 맥락(`viewSnapshot` → `buildViewSnapshotPromptContext`)은 정렬된 결과 풀 중 최대 상위 `SEARCH_REACTION_INPUT_PAPER_LIMIT`(20)편만 논문 상세로 포함한다. 기본 검색 풀이나 라이브러리 anchor-blend 주입으로 커진 결과 풀 전체를 반응 프롬프트에 싣지 않는다. provider의 total 값, estimated total, candidate-window size는 corpus 사실처럼 전달하지 않고, 현재 snapshot에 실제 포함된 결과 수만 말한다. 반응은 전체 풀이 아니라 제공된 현재 결과 표본의 지형을 요약한다. 값은 named 상수로 잠겨 `@check-removes-fails` marker로 표시된다. @aspect aspect:library-grounded-research
- evidence: vitest @ `app/lib/__tests__/view-snapshot.test.ts` ("sorts search snapshot results by interest before the reaction input cap"; "formats search snapshot result counts without provider totals") + `app/lib/__tests__/constants.contract.test.ts` ("SEARCH_REACTION_INPUT_PAPER_LIMIT is literally 20"). 21편 풀에서 관심사 가중치가 높은 논문이 snapshot 상단에 들어오고 snapshot 결과가 20편으로 capped 되며, provider total 100/estimated 값이 prompt context의 corpus-size wording으로 들어가지 않음을 단언한다.
- run: `npx vitest run app/lib/__tests__/view-snapshot.test.ts app/lib/__tests__/constants.contract.test.ts -t "SEARCH_REACTION_INPUT_PAPER_LIMIT|search snapshot"`
- revision: 2
