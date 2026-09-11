# Graph Neighbor Papers — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [graph-neighbor-papers.ledger.yaml](../graph-neighbor-papers.ledger.yaml). The ledger keeps executable coverage and this review records the product-contract reason for changed graph-neighbor surface evidence.

### Sufficiency Review

#### 2026-09-03 — provider-reference seed 즉시 이동 재검토

```yaml
date: 2026-09-03
acs:
  - acceptance-check:graph-neighbor-papers-immediate-navigation
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx; app/(research)/__tests__/relationship-route-page.test.tsx; app/server/services/__tests__/relationship-execution.test.ts
runCommitSha: e5fa482d01a0a7323b5d5f58f0806119f654cd5e+worktree
observedOutput: canonical uid와 S2 alias를 포함한 provider-reference seed는 클릭 직후 `/similar?seedPaperId=` 목적지로 이동하고 destination route가 E3 graph 실행을 소유한다. provider reference가 없는 legacy seed만 keyword fallback으로 이동하며, 첫 paint 뒤 card hydration과 목적지 소유 실패 안내는 유지된다.
gaps:
  - adopt: immediate-navigation admission을 numeric corpus seed가 아닌 provider-reference seed로 명시한다.
  - reject: source payload lookup이나 persisted graph resource redirect를 복원하지 않는다.
verdict: met
```

#### 2026-07-18 — graph comment waits for one terminal ready projection

```yaml
date: 2026-07-18
acs:
  - acceptance-check:graph-neighbor-papers-reaction-own-view
acReviewedRevision:
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/lib/__tests__/view-snapshot.test.ts; app/components/research/route-ai-comment-generation-runtime.ts; app/components/research/background-graph-neighbor-hydration.ts
runCommitSha: 904b626a534d+worktree
observedOutput: The destination graph-neighbor route still opens from lightweight co-cited and coupled candidates and owns the pending AI comment surface immediately. While cardDataHydration is pending it does not send a provider request. After the enrichment attempt reaches terminal ready, destination bootstrap sends exactly one graph_neighbors_opened command for the owning route payload. Successfully hydrated relationship authors remain in the same co-cited/coupled snapshot; a degraded hydration result uses the preserved lightweight relationship evidence. Citation and graph relationship projections were not globally narrowed.
gaps:
  - adopt: Card hydration remains post-first-paint, while route AI comment generation waits only for the relationship evidence it actually transports.
  - reject: Generating once before authors and again after authors would expose two different comments for one opened graph result.
verdict: met
```

#### 2026-07-12 — graph-neighbor keyword receipt before destination paint

```yaml
date: 2026-07-12
acs:
  - acceptance-check:graph-neighbor-papers-keyword-click-feedback
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/inline-ai-comment-treatment.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: c6a4e99ef2f7+worktree
observedOutput: Graph-neighbor AI-comment research terms and repeated-card keyword follow-ups reach the shared handler. Plain clicks show the selected query in the sticky screen-level receipt while graph axes and cards remain mounted; modifier and middle clicks open the same URL in a detached tab without current-window receipt state.
gaps:
  - adopt: Relationship-view keyword callers are now explicit owners rather than incidental beneficiaries of the search-result contract.
  - reject: The receipt does not replace graph-neighbor content or become search processing state.
verdict: met
```

#### 2026-07-11 — abort-ignoring card hydration terminates

```yaml
date: 2026-07-11
acs:
  - acceptance-check:graph-neighbor-papers-card-data-hydration
acReviewedRevision:
  - 2
fixtureRef: app/components/research/background-graph-neighbor-hydration.ts; app/lib/background-request.ts; app/lib/fetch-with-silence-timeout.ts; app/components/research/__tests__/ResearchBackgroundTasks.graph-neighbor-hydration.test.tsx; app/lib/__tests__/fetch-with-silence-timeout.test.ts
runCommitSha: 6835982d+worktree
observedOutput: Graph-neighbor card hydration now shares the 65-second background silence rail. The transport and response-body reads race the internal abort signal, so even an abort-ignoring fetch cannot retain the execution controller forever. Three bounded attempts still preserve lightweight cards and close cardDataHydration to ready; execution replacement remains an immediate abort rather than a timeout retry.
gaps:
  - adopt: background card hydration must terminate independently of transport abort compliance.
  - reject: timeout does not remove the existing lightweight-ready degraded result.
verdict: met
```

#### 2026-06-29 — derived different-position routes ignore selected anchors

```yaml
date: 2026-06-29
acs:
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: 14cd7ec44c52
observedOutput: Citation-lineage and graph-neighbor repeated paper cards keep the same different-position search action as search-result cards. Current-window and detached activations use the route-owned search path without carrying legacy selected libraryPaperIds. When internal reviewed_papers context exists, the shared handler preserves the current personalize preference or personalize:false opt-out, while differentPositionSeed remains client-carried metadata outside the URL.
gaps:
  - adopt: Derived paper-card action parity follows the internal reviewed_papers basis rule.
  - reject: No graph-neighbor-specific stance retrieval API or selected Moonlight anchor transport is introduced.
verdict: met
```

#### 2026-06-23 — graph-neighbor reaction attribution split

```yaml
date: 2026-06-23
acs:
  - acceptance-check:graph-neighbor-papers-gap-surface
  - acceptance-check:graph-neighbor-papers-reaction-own-view
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/components/research/__tests__/AgentPanel.citation-lineage.test.tsx; app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx
runCommitSha: e1e5fa6f4d43
observedOutput: Graph-neighbor body-only AI reactions still receive the deterministic gap action and graph-neighbor source handoff, while create/reuse/forceRefetch handlers route to the similar-paper seed URL without emitting a second awareness in the previous route runtime; hydrated bootstrap targets graph_neighbors_opened to the owning route payload id.
gaps:
  - adopt: The previous gap-surface AC carried both gap action rendering and targeted awareness attribution; this review separates those invariants so per-route AI comment ownership has its own executable check.
  - reject: New-window activation still leaves awareness to the opened route and does not add the graph document to the previous tab's client store.
verdict: met
```

#### 2026-06-09 — seed context header pinned on graph-neighbor pages

```yaml
date: 2026-06-09
acs:
  - acceptance-check:graph-neighbor-papers-seed-title-card-pinned
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/graph-neighbors-view.test.tsx; app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx; scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs
runCommitSha: 3a82a1512839+worktree
observedOutput: GraphNeighborsView renders the source paper sticky context header with the seed title and guide before graph axes, GraphNeighborsResultsState keeps that background-style header visible in degraded and honest-empty states, and browser evidence confirms the header stays pinned in an overflow-y document scroller while the AI overlay starts below the relationship seed zone.
gaps:
  - adopt: The prior graph-neighbor contract treated the document title and AI context as enough; the new contract pins a visible sticky context header so users can always tell which paper the relation page belongs to.
  - reject: The seed paper is not reintroduced into co-cited or coupled candidate lists, and the header does not reuse candidate-card panel styling; seed exclusion remains a candidate-axis contract.
verdict: met
```
