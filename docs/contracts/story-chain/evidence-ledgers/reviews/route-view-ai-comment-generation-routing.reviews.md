# route-view-ai-comment-generation-routing — Sufficiency Reviews

This sidecar byte-preserves the dated history moved from the former operational
Markdown ledger. The current owner is
[route-view-ai-comment-generation-routing.ledger.yaml](../route-view-ai-comment-generation-routing.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-07-18 — search card hydration stays outside the route generation key

```yaml
date: 2026-07-18
acs:
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
  - acceptance-check:reaction-from-visible-snapshot-basis-match
  - acceptance-check:search-reaction-summarizes-terrain-generation-boundary
  - acceptance-check:graph-neighbor-papers-reaction-own-view
acReviewedRevision:
  - 4
  - 1
  - 6
  - 2
fixtureRef: app/lib/__tests__/view-snapshot.test.ts; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx; app/server/services/__tests__/search-hydration.test.ts; app/server/domain-access/__tests__/search-enrichment-access.test.ts; app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; docs/runtime-flows/ai-response-generation.md; docs/runtime-flows/search-mechanism.md
runCommitSha: b7c3efc20cfc+worktree
observedOutput: Route AI comment scheduling still keys commands by the canonical transported ViewSnapshot, but each search result paper now contributes only committed id, title, year, and citation count. Facet-neutral background hydration keeps the same generation and settled comment and makes no second provider request. Hydration-owned search facets keep pending visible and produce one ready-time command from the shared non-empty facet projection. A successful empty 200 from initial pending hydration or ready-snapshot repair preserves committed lightweight cards and records canonical `ready + repairAttempted:true`; provider errors and aborts remain marker-free until the bounded retry path succeeds or exhausts. System-event ingress, queued-command flush, active transport, and late completion rebuild or verify the current command through the same readiness boundary; terminal empty facet projections close pending without provider work. Lightweight graph-neighbor routes use the same pending-to-ready rule so their single command retains relationship authors when enrichment succeeds. The search hydration owner preserves first-commit terrain fields before publishing enriched cards.
gaps:
  - adopt: The existing scheduler, store, endpoint, and structured generation gateway remain the only route AI comment path; the fix constrains the search projection and readiness gate without adding another trigger source.
  - reject: Hydrated card detail must not be folded into the search generation key or removed from relationship prompts globally.
verdict: met
```

#### 2026-07-12 — aspect:route-view-ai-comment-generation-routing exact projection basis

```yaml
date: 2026-07-12
acs:
  - acceptance-check:reaction-from-visible-snapshot-basis-match
  - acceptance-check:search-reaction-summarizes-terrain-generation-boundary
acReviewedRevision:
  - 1
  - 2
fixtureRef: app/lib/__tests__/view-snapshot.test.ts; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; docs/runtime-flows/ai-response-generation.md
runCommitSha: 48681f6642ea+worktree
observedOutput: aspect:route-view-ai-comment-generation-routing now treats the canonical transported ViewSnapshot projection as the exploration target context. The command carries one snapshot and derives identity through the same schema normalization as transport. A changed projection clears the ephemeral comment, advances reaction generation, rejects the active stale completion at both runtime and store commit, and queues the current projection through the same single-flight path. Schema-equivalent raw snapshots and UI-only metadata outside the projection remain deduplicated, and server in-flight sharing requires the same projection.
gaps:
  - adopt: Reaction generation and the canonical ViewSnapshot projection jointly own route-view dedup and stale completion authority.
  - adopt: The existing queue, store, and generation route remain the owners; no persistence or new control plane is introduced.
  - reject: updatedAt-only invalidation cannot distinguish prompt basis changes from UI-only freshness changes.
verdict: met
```

#### 2026-07-01 — aspect:route-view-ai-comment-generation-routing after route AI comment generation split

```yaml
date: 2026-07-01
acs:
  - acceptance-check:graph-neighbor-papers-reaction-own-view
  - acceptance-check:search-reaction-summarizes-terrain-generation-boundary
  - acceptance-check:route-view-ai-comment-inline-surface-transport-timeout
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
fixtureRef: app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; app/server/agent/__tests__/route-ai-comment-generation.test.ts
runCommitSha: 3ae05bf8
observedOutput: aspect:route-view-ai-comment-generation-routing is now verified by a separate route boundary. Automatic route AI comments no longer travel through the legacy interactive reaction stream or compatibility [system] messages. The client queues explicit route AI comment generation commands keyed by trigger, targetRoutePayloadId, reactionGeneration, createdAt, and the visible viewSnapshot; route bootstrap is scoped to the routed ResearchRoutePayload; unsupported gap_network/pdf/empty-search targets are rejected; duplicate opened commands coalesce per target; the server endpoint generates from the supplied viewSnapshot without loading or persisting a route payload row; route responses expose parse/route-auth/generate/total Server-Timing; route AI comment generation uses one structured generation call; invalid, empty, timed-out, aborted, or provider-failed output returns reaction:null without persisting a fallback comment; shared in-flight generation survives one duplicate caller abort; all-caller abort cancels the provider signal; late success after all-caller abort does not persist; and the structured generation gateway owns JSON mode, timeout, retry, and abort-signal cleanup.
gaps:
  - adopt: The old awareness boundary hid that route bootstrap and follow-up handlers shared the legacy interactive stream path; the new endpoint, scheduler, and structured generation call make automatic route AI comment generation a separate runtime boundary.
  - adopt: Query transitions and regenerate actions remain allowed to generate again only after the reaction generation advances, while route changes drop queued regeneration and clear pending state.
  - adopt: The route-owned generation path now has its own structured output budget and timing phases, so slow AI comment generation can be diagnosed without waiting for the outer route/client boundary.
  - reject: This review does not change the visible structured reaction payload shape; it changes routing, target eligibility, and generation ownership for route AI comments.
verdict: met
```

#### 2026-07-10 — execution-scoped route AI comment commands

```yaml
date: 2026-07-10
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
  - acceptance-check:route-view-ai-comment-inline-surface-transport-timeout
acReviewedRevision:
  - 2
  - 3
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteRuntime.execution-lifecycle.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts
runCommitSha: e531e3f5+worktree
observedOutput: Route AI comment commands now capture the active execution id in addition to trigger, target payload, generation, and snapshot freshness. Duplicate commands still coalesce by trigger and target, but flush, completion, and cleanup may mutate only the execution that issued them. Same-id and same-updatedAt replacement runtimes therefore bootstrap independently and reject late work from the previous mount.
gaps:
  - adopt: Execution identity controls result-application authority without entering server payload identity or analytics properties.
  - reject: targetRoutePayloadId and updatedAt alone cannot distinguish two mounts that accept the same snapshot.
verdict: met
```

