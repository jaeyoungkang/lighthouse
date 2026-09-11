# Reaction Lifecycle — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[reaction-lifecycle.ledger.yaml](../reaction-lifecycle.ledger.yaml). The ledger
keeps executable coverage and the review pointer; release and Mission Control
readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

#### 2026-07-18 — hydration-gated routes keep one visible pending lifecycle

```yaml
date: 2026-07-18
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible
  - acceptance-check:graph-neighbor-papers-reaction-own-view
acReviewedRevision:
  - 3
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts; app/lib/__tests__/view-snapshot.test.ts; app/components/research/route-ai-comment-generation-runtime.ts
runCommitSha: 904b626a534d+worktree
observedOutput: Automatic AI comments keep the same named pending surface across planned, hydration-gated, queued, and active states. Unfaceted pending search starts from committed terrain immediately. A search whose active loaded-result facet depends on authors, fields, venue, or PDF holds provider work until hydration is ready and then generates once from the stable non-empty visible pool. If that gate closes after transport starts, the request is aborted, its late completion is rejected, and bootstrap reopens for terminal ready. A lightweight graph-neighbor view also keeps pending visible and sends one generation only after card hydration reaches terminal ready, retaining authors when enrichment succeeds and using preserved lightweight relationship evidence when it degrades. Terminal failures, stale execution, and empty projections still close or avoid provider work through the existing route lifecycle.
gaps:
  - adopt: Visible pending ownership is separate from provider-call timing and does not require a second trigger path.
  - reject: Relationship authors must not be removed to make graph-neighbor hydration projection-equivalent.
verdict: met
```

#### 2026-07-11 — current active execution reaction lifecycle

```yaml
date: 2026-07-11
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout
  - acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
acReviewedRevision:
  - 2
  - 2
  - 3
  - 6
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.execution-lifecycle.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.route-owned-render.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-canonical.test.tsx; app/stores/research-route-store.ts; app/stores/__tests__/research-route-store.test.ts; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts
runCommitSha: 6835982d+worktree
observedOutput: The current route renders one route-owned panel and its inline reaction from active-execution scalar state. A same-id and same-updatedAt replacement receives a new execution id, so prior completion and cleanup cannot patch or clear it. Every active-session store writer and related async helper requires that execution id; there is no view-id and updatedAt fallback. Regeneration preserves the settled card while the current generation is pending. Inline analysis starts only for the accepted execution's visible cards and rejects detached completion.
gaps:
  - adopt: The active-document revision now includes route-owned first-frame rendering evidence in addition to layout and generation-snapshot isolation.
  - adopt: Execution identity remains distinct from updatedAt, reactionGeneration, and operation-specific task keys.
  - reject: Per-view compatibility state and a general task registry are not required for the single active route.
verdict: met
```

#### 2026-07-07 — ResearchRoutePayload AI comment lifecycle after legacy stream evidence split

```yaml
date: 2026-07-07
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
  - acceptance-check:route-view-ai-comment-inline-surface-transport-timeout
acReviewedRevision:
  - 2
  - 3
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/research-route-runtime.additional.test.ts; app/api/reaction/generate/[id]/__tests__/route.test.ts; app/api/gap-reports/[id]/reaction/__tests__/route.test.ts; app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx; app/stores/__tests__/research-route-store.reaction-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx
runCommitSha: 5d54442ad05a+worktree
observedOutput: The lifecycle ledger now treats automatic route-view AI comments as structured generation owned by the visible ResearchRoutePayload snapshot. Active-document evidence covers the current panel renderer, the route-owned current ResearchRoutePayload helper, and the generation route's supplied viewSnapshot input without relying on the legacy interactive reaction endpoint. Regeneration keeps the settled successful comment visible while pending and clears pending on generation failure without replacing it with a fallback card. First-generation route/provider/no-output failures return reaction:null and close pending without creating a new AI comment.
gaps:
  - adopt: The prior lifecycle evidence still cited interactive stream parsing and user-reaction transport timeout tests for automatic AI comment behavior. Those are no longer covering evidence for the current route-view generation contract.
  - adopt: Failure/no-output terminal behavior is now explicitly nullable/no-new-comment, matching the generation endpoint and persistence boundary instead of the older degraded-card wording.
  - reject: This review does not remove historical dated reviews; it records the current coverage boundary going forward.
verdict: met
```

#### 2026-06-25 — AI comment loading state and regeneration terminal cleanup

```yaml
date: 2026-06-25
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
acReviewedRevision:
  - 2
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/AgentPanel.test.tsx; app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx; app/stores/__tests__/research-route-store.reaction-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/api/reaction/generate/[id]/__tests__/route.test.ts;
runCommitSha: de92c35d2266+worktree
observedOutput: Documents with no settled reaction and no owning generation/loading state reserve no inline AI comment surface, so the empty-state-no-reserve boundary remains intact. Once a search, citation-lineage, or graph-neighbor document owns a planned generation, it still does not show a completed AI comment before structured generation returns; instead, the same slot becomes a named loading state (`role=status`, `data-state=loading`) that says AI comment is being generated. Regeneration keeps the settled card visible, shows the regenerate pending state, and clears that pending state on success, provider-failure nullable output, or transport error while preserving the previous settled card.
gaps:
  - adopt: The previous pending shell could read like an already-created comment; the contract now requires explicit loading semantics only after an owning generation/loading state exists, while a true empty state still reserves no surface.
  - adopt: Transport errors while preserving an existing regeneration card must clear the regenerate pending flag so `다시 생성` cannot remain permanently hidden.
  - reject: This review does not reopen retired legacy surface formats.
verdict: met
```

#### 2026-06-24 — common inline AI comment contract after PDF reaction removal

```yaml
date: 2026-06-24
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout
  - acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
  - acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
  - acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx; app/components/research/__tests__/inline-ai-comment-treatment.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/relationship-view-ai-comment-actions.test.tsx; app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx; app/components/research/__tests__/research-route-runtime.additional.test.ts; app/api/reaction/generate/[id]/__tests__/route.test.ts
runCommitSha: 66955b663d42+worktree
observedOutput: Search, citation lineage, and graph-neighbor documents share the same embedded inline AI comment renderer; legacy PDF documents do not render route AI comment slots after the Human-approved PDF reaction removal; search, citation lineage, and graph-neighbor AI comment hosts share one frame/action visual treatment and one host-owned `연구 공백 지도 만들기` action; retired `대표 논문 보기`/paper_cards surfaces are excluded from AI comments; only the active document panel renders reaction content and the chat prompt body is rebuilt from the focused route payload id inside the current ResearchRoutePayload collection.
gaps:
  - adopt: AI comment placement had working UI evidence, but the common-layout invariant was implicit inside top-position and responsive checks; the new AC names it directly.
  - adopt: Search used a white framed comment area while citation lineage and graph-neighbor pages hosted AI comments as unframed inline body content; the visual parity evidence compares the three current surfaces in one fixture.
  - adopt: Visual parity alone did not control which action belongs in the top comment; relationship ResearchRoutePayloads could still expose legacy `대표 논문 보기` or a differently labeled gap guided tree. The new owned-followup AC moves research-gap entry to the host-owned shared button.
  - adopt: Focused document prompt content and route context descriptors were already separate, but the contract now states that unopened or foreign document bodies cannot feed the current AI comment.
  - reject: gap_network does not gain a top inline comment slot because its prepared reaction is consumed by the graph and report surfaces.
  - reject: legacy PDF does not gain a route AI comment slot because internal PDF reaction, PDF awareness, and Figure/Table interpretation are retired.
verdict: met
```

#### 2026-06-23 — pending inline reactions and graph-neighbor targeted awareness

```yaml
date: 2026-06-23
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
  - acceptance-check:graph-neighbor-papers-gap-surface
  - acceptance-check:graph-neighbor-papers-reaction-own-view
acReviewedRevision:
  - 2
  - 1
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/AgentPanel.citation-lineage.test.tsx; app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx
runCommitSha: e1e5fa6f4d43
observedOutput: Completed search ResearchRoutePayloads show a muted inline pending AI comment before the structured reaction body arrives, textless awareness failure or stop exits through an owning terminal reaction instead of a stuck spinner, graph_neighbors gap actions stay on the inline AI reaction, and graph_neighbors create/reuse no longer emits a second awareness in the previous route runtime while hydrated bootstrap targets the similar-paper route payload id.
gaps:
  - adopt: The prior empty-state wording hid the in-progress AI comment gap between document commit and awareness response; the new evidence distinguishes no-reserve surfaces from completed documents that are awaiting a reaction.
  - adopt: Pending inline reaction needed an explicit terminal/degraded branch; the new evidence records provider error and user stop as document-owned reactions so the inline pending state does not remain indefinitely.
  - adopt: graph_neighbors had deterministic gap follow-up once a reaction existed, but the targeted awareness ownership invariant was hidden inside the gap-surface AC; the new AC separates reaction attribution from gap action rendering and locks route bootstrap as the single create/reuse source.
verdict: met
```

#### 2026-06-18 — aspect:route-view-ai-reaction-rules and aspect:awareness-event-single-source-routing after internal PDF retirement

```yaml
date: 2026-06-18
acs:
  - acceptance-check:gap-report-prepared-reaction-no-visible-reaction-section
  - acceptance-check:inline-analysis-auto-run-does-not-recompute-search-reaction
  - acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
  - acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research-route-renderers/__tests__/search-view.helpers.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/stores/__tests__/research-route-store.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/stores/__tests__/research-route-store.reaction-overlay.test.ts
runCommitSha: bd2cdbba7cb4
observedOutput: Internal PDF awareness, failure reaction, and Figure/Table follow-up reaction lifecycle coverage was retired by Human decision. The active lifecycle ledger now covers the concrete reaction lifecycle owned by current ACs: search reactions attach to completed search ResearchRoutePayloads without synthesizing a guided_tree surface, inline analysis auto-queues only for eligible paper-card documents, gap documents persist prepared content without a visible reaction section, citation-lineage renders one scoped inline reaction with its follow-up gap entry point, and overlay proposals preserve their own selection-scoped reaction state without retired PDF Promise refs.
gaps:
  - adopt: Active Source Promises, Aspect appliesTo, Coverage By Promise, and executable evidence no longer include current reaction promises.
  - reject: Only current lifecycle review YAML is active review data.
verdict: met
```
