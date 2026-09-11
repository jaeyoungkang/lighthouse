# Snapshot Reaction — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[snapshot-reaction.ledger.yaml](../snapshot-reaction.ledger.yaml). The ledger keeps
executable coverage and this review pointer as one current evidence source.

## Reviews

### 2026-07-18 — search hydration stays outside the canonical reaction basis

```yaml
date: 2026-07-18
acs:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
  - acceptance-check:reaction-from-visible-snapshot-basis-match
acReviewedRevision:
  - 2
  - 1
fixtureRef: app/lib/__tests__/view-snapshot.test.ts; app/domain/__tests__/view-snapshot.test.ts; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; docs/runtime-flows/ai-response-generation.md
runCommitSha: 904b626a534d+worktree
observedOutput: The canonical search ViewSnapshot projects each visible result paper to id, title, year, and citation count. Background authors, abstract, venue, fields, PDF availability, and inline-analysis state can complete after first render without changing each paper's transported provider fields, clearing the settled comment, or incrementing reactionGeneration when the visible facet pool is unchanged. Query, facets, sort, stable result terrain, representative papers, and first-payload library context remain prompt-bearing. If hydration-owned facet fields decide visible membership, bootstrap holds the pending state and captures one ready projection; queued and active work rechecks readiness, aborts pre-ready transport, rejects its late completion, and reopens bootstrap for terminal ready. Citation and similar-paper snapshots continue to include authors, proving that the stable search paper projection was narrowed at the route-specific boundary rather than weakening the shared relationship contract.
gaps:
  - adopt: Search-specific prompt identity is narrower than the hydrated paper-card model and is normalized before scheduling and transport.
  - adopt: The server hydration merge preserves first-commit title, year, and citation count so the canonical search terrain cannot drift behind the client guard.
  - reject: Hydration-only paper metadata must not become a second implicit reaction trigger; hydration-owned facet membership settles before its first request instead.
verdict: met
```

### 2026-07-12 — viewer-scoped persisted reaction preference

```yaml
date: 2026-07-12
acs:
  - acceptance-check:reaction-from-visible-snapshot-viewer-preference-persists
acReviewedRevision:
  - 1
fixtureRef: app/api/gap-reports/[id]/reaction/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-network-view-access.test.ts; app/server/repository/__tests__/gap-reports.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.persistence.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.persistence-readback.test.tsx
runCommitSha: 31b0d177+worktree
observedOutput: Lifecycle review followed PUT, bounded retry, read-back, remount, and artifact-version change. The current viewer's preference is restored on the shared report, another viewer's preference is not read or overwritten, and a preference pinned to an older artifact version is not projected onto the current body. Contract-history review separates this durable viewer preference from ephemeral search, citation, and similar-route reactions. Architecture review confirms reactionVersion CAS is scoped to the report-viewer row and rechecks the artifact version after write before returning a confirmed projection.
gaps:
  - adopt: stale artifact-version preference rows are conditionally replaced before a new reactionVersion sequence starts.
  - adopt: a concurrent artifact update turns the reaction response into a retryable conflict instead of returning a stale projection.
  - reject: row-wide artifact CAS and artifact-global reaction history would couple unrelated viewers.
verdict: met
```

### 2026-07-12 — exact visible projection commit and regeneration

```yaml
date: 2026-07-12
acs:
  - acceptance-check:reaction-from-visible-snapshot-basis-match
acReviewedRevision:
  - 1
fixtureRef: app/lib/__tests__/view-snapshot.test.ts; app/components/research/__tests__/route-ai-comment-generation-scheduler.test.ts; app/stores/__tests__/research-route-store.ai-comment-generation.test.ts; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; docs/runtime-flows/ai-response-generation.md
runCommitSha: 48681f6642ea+worktree
observedOutput: buildViewSnapshot creates one bounded canonical projection through a non-throwing schema boundary before command creation. Raw snapshots that normalize to the same provider input keep one basis, while a route-valid payload outside snapshot bounds fails closed without interrupting route render or store mutation. The request command captures that one ViewSnapshot and derives its identity by serialization. A same-execution basis change clears the settled comment, advances reaction generation, rejects the active stale response at completion and final store commit, and starts one queued generation from the current projection. UI-only metadata changes outside the projection keep the active request and settled comment. Server in-flight dedup shares only an exact canonical projection basis.
gaps:
  - adopt: The canonical transported ViewSnapshot projection, rather than route id, updatedAt, or an independently writable key, owns prompt basis identity.
  - adopt: Snapshot schema overflow fails closed before generation without throwing through route or store lifecycle code.
  - adopt: A changed projection discards the ephemeral comment and regenerates; gap report reaction persistence remains a separate viewer preference and is unchanged by this ephemeral basis transition.
  - reject: Returning or persisting the full projection identity with the reaction would duplicate ephemeral input and introduce retention ownership without improving the client-side exact guard.
verdict: met
```

### Retired Acceptance Check history

`acceptance-check:reaction-from-visible-snapshot-artifact-persists`는 2026-07-12에
`historical:acceptance-check:reaction-from-visible-snapshot-artifact-persists`로
철회했다. 아래 index는 mixed review에서 분리한 날짜와 revision을 보존한다. 기존
observedOutput과 gaps는 해당 dated review에 그대로 남긴다. 현재 판정에는
viewer-preference review를 사용한다.

- 2026-07-11 `current snapshot freshness and remount-safe artifact writes` — revision 1
- 2026-07-10 `request-time snapshot and artifact persistence boundary` — revision 1

#### 2026-07-11 — current snapshot freshness and remount-safe artifact writes

```yaml
date: 2026-07-11
acs:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
acReviewedRevision:
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/stores/__tests__/research-route-store-internals.mutation.test.ts; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/lib/__tests__/view-snapshot.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.persistence.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.persistence-readback.test.tsx; app/components/research-route-renderers/__tests__/gap-reaction-write-transport.test.ts; app/api/gap-reports/[id]/reaction/__tests__/route.test.ts; app/components/research-route-renderers/gap-reaction-write-coordinator.ts; app/components/research-route-renderers/gap-reaction-write-transport.ts; docs/runtime-flows/ai-response-generation.md; docs/runtime-flows/gap-network-analysis.md
runCommitSha: 6835982d+worktree
observedOutput: A visible basis, facet, or accepted background mutation strictly advances logical freshness before transport, so the queued generation command rebuilds its request from the current view snapshot. The search snapshot uses the same loaded facet projection as the rendered list. Gap prepared-reaction serialization stays in a renderer-local coordinator with only active and latest-pending writes, while bounded fetch/read-back and stale-version rebase live in the transport helper. An old execution completion cannot cancel the replacement selection. An unresolved old write is not retained or automatically replayed; a newer pending selection proceeds through the same server CAS path. A definite 409/422 does not retry or read back. The mutation route persists only a current prepared template rather than arbitrary owner-supplied prose.
gaps:
  - adopt: queued generation observes strict logical freshness; active transport remains single-flight and does not re-fire for a later metadata-only mutation.
  - adopt: renderer lifecycle does not own durable artifact-write serialization.
  - adopt: 당시 owner scope와 prepared-template scope는 별도 mutation authority였다. 현재 공유 gap report는 viewer-scoped preference 경계를 사용한다.
  - adopt: bounded read-back confirms recorded server state without creating a durable client uncertainty state.
  - adopt: route-lifetime guards discard inactive pending intent so a replacement execution is not blocked by an old write.
  - adopt: a newer explicit local choice may retry the same payload against a stale response's confirmed version within the bounded transport loop.
  - reject: module-global coordinator sharing and replay state duplicate the single active route execution.
verdict: met
```

#### 2026-07-10 — request-time snapshot and artifact persistence boundary

```yaml
date: 2026-07-10
acs:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
acReviewedRevision:
  - 2
fixtureRef: docs/contracts/story-chain/evidence-ledgers/snapshot-reaction.ledger.md; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.persistence.test.tsx; app/api/gap-reports/[id]/reaction/__tests__/route.test.ts; app/server/repository/__tests__/gap-reports.test.ts; app/server/domain-access/__tests__/gap-network-view-access.test.ts
runCommitSha: 6835982d+worktree
observedOutput: Route AI comment requests carry the request-time visible viewSnapshot and target freshness. Distinct refreshed-snapshot requests do not share the server's older in-flight provider result, while a metadata-only mutation after one active request starts does not trigger a second provider call; the same execution and reactionGeneration may settle from that request-time snapshot result. Pending rerenders and active-request completion preserve the 240ms client coalescing window. A replacement execution aborts the active transport, and the 15-second fetch/body hard race releases scalar single-flight even when the transport ignores abort so the queued latest generation can start. Artifact persistence evidence covers strict mutation validation, bounded latest-100 normalization, artifact CAS with reactionVersion, owner-scoped read-back, execution disposal, superseding pending selection, and bounded same-payload stale rebase after detached late commit.
gaps:
  - adopt: updatedAt is request freshness and reactionGeneration is operation identity; neither replaces execution identity.
  - adopt: metadata-only freshness may update a command before transport, but it does not create an additional provider execution after transport starts.
  - reject: a refreshed-snapshot request may not share an older request's server in-flight provider result.
  - adopt: 당시 persisted compatibility stripping은 read-only였고 public mutation input은 repository access 전에 strict owner scope였다. 현재 공유 gap report mutation은 viewer scope다.
  - adopt: a previous local execution cannot reconcile into its replacement; the replacement owns its projection and resolves any server CAS conflict through its own request.
verdict: met
```
