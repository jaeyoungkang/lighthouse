# Search Query Route Transition — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [search-query-route-transition.ledger.yaml](../search-query-route-transition.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-14 — paper-search submit buttons acknowledge navigation immediately

```yaml
date: 2026-07-14
acs:
  - acceptance-check:search-query-route-transition-immediate-submit
  - acceptance-check:search-query-route-transition-submit-feedback
acReviewedRevision:
  - 5
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; docs/runtime-flows/search-mechanism.md
runCommitSha: 5e5f634357ca
observedOutput: The first-search and research-route `논문검색` buttons keep the existing immediate `/search?q=` navigation and immediately render a rotating indicator, `aria-busy=true`, and disabled state from the shared shell activation. The origin activation is explicitly a bounded click receipt rather than provider processing state; pending, ready, and failed search processing remain destination-owned. The current screen stays mounted until the destination route arrives. Exact same-route submission creates no activation, while direct button fixtures verify synchronous invocation failure cleanup and the shell fixture verifies destination-arrival cleanup; bounded timeout and shell unmount retain their identity-safe cleanup behavior.
gaps:
  - adopt: Search submit now acknowledges the click on the control itself and through the existing screen-level receipt before the destination route paints.
  - reject: The origin button does not represent provider progress; destination processing, ready, and failed states remain route-owned.
verdict: met
```

#### 2026-07-06 — query transition resets rendered-window inline-analysis ids

```yaml
date: 2026-07-06
acs:
  - acceptance-check:search-query-route-transition-inline-analysis-exposure-cycle
acReviewedRevision:
  - 2
fixtureRef: app/components/documents/__tests__/SearchDocument.visible-window.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-window.test.tsx
runCommitSha: b908bb09+worktree
observedOutput: A query-transition result no longer inherits a stale visible-id accumulator from the previous search. The committed search document recomputes inline-analysis candidates from its current rendered result window, queues the initial rendered cards for that window, and leaves cards behind 더보기 outside the task until the window expands. Background processing honors the task's current visible ids instead of reviving legacy expanded batches.
gaps:
  - adopt: The inline-analysis cycle remains owned by the destination route result window after transition.
  - reject: This review does not add a saved search history model; recovery remains browser-history owned.
verdict: met
```

#### 2026-07-05 — query submit stays on the search-first condition URL

```yaml
date: 2026-07-05
acs:
  - acceptance-check:search-query-route-transition-immediate-submit
  - acceptance-check:search-query-route-transition-clears-stale-reaction
  - acceptance-check:search-query-route-transition-empty-results-immediate
  - acceptance-check:search-query-route-transition-browser-route-owned
  - acceptance-check:search-query-route-transition-inline-analysis-exposure-cycle
acReviewedRevision:
  - 2
  - 1
  - 1
  - 2
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/(research)/__tests__/relationship-route-page.test.tsx; app/server/services/__tests__/search-execution.test.ts; app/api/documents/search/__tests__/route.helpers.test.ts; app/stores/__tests__/research-route-store.reaction-cards.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-window.test.tsx
runCommitSha: e0fc414dd032
observedOutput: Route-bar, empty-entry, term, position, and similar submits push `/search?q=...` immediately without a client reserve POST. The destination `/search` route executes from URL params, returns an ephemeral result ResearchRoutePayload, and does not redirect to a saved `/search/:id` route. Stale route AI comments are cleared for the new result payload before the next result renders, and the previous route's view is not delivered to the destination renderer or reused as the destination reaction anchor. The active route AI comment transport can only attach generated output to the current route-owned view/reaction target; legacy reaction/tool output has no path that replaces the visible SearchView with an older route payload. Browser history is the only recovery path, and inline analysis still waits for newly exposed result cards instead of reusing the previous batch.
gaps:
  - adopt: `search-ephemeral-execution.ledger.md` covers the reciprocal `aspect:immediate-navigation`, `aspect:search-first-url-model`, and `aspect:first-paint-persistence-independence` slice for this Promise; this ledger keeps the route-transition and reaction hygiene slice.
  - reject: Saved search-view URLs are intentionally retired for exploration screens; saved artifact URLs remain only for gap reports.
verdict: met
```

#### 2026-05-19 — Immediate query transition with previous-result recovery

Note: the original entry also covered `acceptance-check:search-query-route-transition-previous-result-recovery`. That AC and its in-app recovery snapshot were, removed on 2026-06-25 — browser history now owns recovery — so the ref is dropped here to keep this dated record resolvable against the current Story Chain. The `observedOutput` below describes the behavior as observed on 2026-05-19.

```yaml
date: 2026-05-19
acs:
  - acceptance-check:search-query-route-transition-immediate-submit
  - acceptance-check:search-query-route-transition-clears-stale-reaction
  - acceptance-check:search-query-route-transition-empty-results-immediate
  - acceptance-check:search-query-route-transition-browser-route-owned
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-query-route-transition.ledger.md
runCommitSha: 832af0a45da5
observedOutput: Search query transition now treats the search button submit as the explicit user intent. The handler queues the next search request immediately, stores the previous result context and its AI reaction as a single client-side recovery snapshot, clears the current reaction before queueing, and the results view renders a previous-result recovery action instead of a confirmation banner. Restoring returns the current search route context to the previous result set and restores its reaction inline.
gaps:
  - adopt: The new aspect:context-preserving-transitions is satisfied by post-action recovery rather than a pre-action confirmation, which keeps the search flow fast while preserving a browser-like way back to the prior context.
  - reject: A full multi-step search history is not introduced here; the recovery affordance is limited to the immediately previous search to avoid turning document history into search-version history.
verdict: met
```

- Input: Tester feedback said the same-page query-change warning required one extra click, while the follow-up product discussion noted that Light House lacks the browser back-button recovery path users expect.
- Evidence: α Coverage — `use-search-view-controller.search-query-transition.test.tsx` locks immediate queueing, stale-reaction clearing, previous snapshot capture, and restore with the previous AI reaction. β Surface — `search-view-content.test.tsx` locks the rendered recovery action and absence of the old confirmation actions. γ Wovenness — `aspect:context-preserving-transitions`, this ledger, and `SearchView` / `research-route-store` surface tags bind the policy to the first concrete Promise.
- Gaps observed:
  - Adopt-resolved — pre-confirmation is replaced by immediate transition plus one-step recovery.
  - Reject — broad top-bar document history reuse is not used as the recovery source because current ResearchRoutePayload history dedupes by route payload id and stores the latest search route payload state.
- Verdict: met

#### 2026-07-05 — Route-owned view lifetime: active-document 잔재 제거의 역할 분리 리뷰

```yaml
date: 2026-07-05
acs:
  - acceptance-check:search-query-route-transition-route-owned-render
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.test.tsx; app/components/research/__tests__/research-route-runtime.helpers.test.ts
runCommitSha: 8d83e09e
observedOutput: lifecycle reviewer와 contract-history reviewer(비수정 서브에이전트)가 route-owned 뷰 수명 변경을 분리 검토했다. lifecycle 축 blocking 0건 — route A unmount cleanup(setCurrentDocument(null))이 route B hydration보다 항상 먼저 실행됨을 React commit ordering(mutation destroy → layout create)으로 확인, StrictMode 이중 mount 수렴, 같은 route 파라미터 전환(q=a→b)의 task 정리, /gap 폴링 비간섭, enrichment controller 이중 삭제 부재를 각각 확인했다. `research-route-runtime.helpers.test.ts`는 tool output으로 들어온 document payload가 화면 view 교체로 반응하지 않음을 잠가, 반응 스트림/tool 출력이 현재 route-owned SearchView를 이전 또는 외부 view payload로 바꾸는 경로가 없음을 확인했다. contract-history 축은 태그·인용·scenario ref·closeout 매트릭스 전수 PASS에 minor 1건 — AC의 enrichment abort 절이 inline analysis abort 테스트로만 잠겨 있었다. 같은 세션에서 "aborts an in-flight search enrichment when the view leaves the document" 테스트를 추가해 닫았고, ledger 인용을 갱신했다. run:shell 3파일 21 테스트 green.
gaps:
  - adopt: enrichment abort 절의 전용 테스트 부재 — 같은 세션에서 테스트 추가로 해소.
  - adopt: DocumentRendererLoading(dynamic chunk fallback)이 store currentDocument를 직접 읽는다 — unmount cleanup이 이전 route 문서를 paint 전에 비우므로 foreign doc이 사용자에게 보이는 경로는 없음을 lifecycle reviewer가 ordering으로 확인. 남는 것은 pre-paint 렌더 프레임뿐이라 게이트 확장 없이 수용.
  - reject: route 전환 중 store-null 1프레임에 shell footer/route bar가 잠깐 재계산되는 코스메틱 flicker — 뷰 수명이 route에 귀속된 모델의 자연스러운 경계이고 정확성 위반이 아니므로 계약 대상으로 승격하지 않는다.
verdict: met
```

- Input: `/similar → /search?q=` route-bar 전환에서 이전 route의 graph_neighbors ResearchRoutePayload가 SearchView renderer에 주입되어 `parseSearchQueryClauses(undefined)` TypeError로 화면 전체가 죽는 실측 crash (2026-07-05 로컬 재현). 전역 `currentView`가 라우트를 넘어 살아남는 active-view 잔재가 원인 — #205 False Pass 항목("hidden active-view state still drives renderer choice") 그대로.
- Evidence: `ResearchRouteRuntime.route-owned-render.test.tsx`가 route 전환 첫 프레임의 foreign doc 비주입·initial search entry 보호·unmount store 정리를, `ResearchBackgroundTasks.test.tsx`가 뷰 이탈 시 inline analysis·enrichment의 in-flight abort와 task 폐기를, `research-route-runtime.helpers.test.ts`가 tool output 문서 payload의 비반응을 잠근다. 21/21 green @ 8d83e09e.
- Verdict: met
