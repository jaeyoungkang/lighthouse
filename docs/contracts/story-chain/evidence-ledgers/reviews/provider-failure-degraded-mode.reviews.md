# Provider Failure Degraded Mode — Sufficiency Reviews

## Reviews

### Sufficiency Review

#### 2026-08-12 — gap enrichment degraded surface의 명시적 복구

```yaml
date: 2026-08-12
acs:
  - acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry
acReviewedRevision:
  - 2
fixtureRef: app/server/domain-access/__tests__/gap-network-enrichment-retry.test.ts; app/server/domain-access/__tests__/gap-network-view-access.runner.test.ts; app/api/gap-reports/[id]/enrichment-retry/__tests__/route.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.retry-response.test.tsx
runCommitSha: a0d7293d2fca
observedOutput: Provider 실패는 저장된 deterministic core graph를 지우거나 가리지 않는다. 사용자의 명시적 command만 보강을 다시 pending으로 열며, 실패한 상태의 단순 조회와 재방문은 자동 work를 만들지 않는다. 재시도 중에도 graph가 남고 재실패하면 fabricated narrative 없이 같은 degraded surface로 돌아온다. 첫 retry는 즉시 허용되고 이후 재실패에는 report 단위 60초 cooldown이 적용된다.
gaps:
  - adopt: provider-failure Advice를 이미 확보한 deterministic surface 위의 명시적 보강 복구에도 적용한다.
  - reject: provider 실패를 숨기는 deterministic narrative fallback이나 새 retry orchestration layer를 만들지 않는다.
verdict: met
```

#### 2026-07-31 — inline analysis bounded failover and explicit recovery

```yaml
date: 2026-07-31
acs:
  - acceptance-check:inline-analysis-auto-run-provider-failover-bounded
  - acceptance-check:inline-analysis-auto-run-explicit-failure-retry
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/server/ai-generation/__tests__/gateway.test.ts; app/server/domain-access/__tests__/inline-analysis-access-timing.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-owner-recovery.test.tsx
runCommitSha: 91b3af71a488+worktree
observedOutput: Gemini transient failure reaches one pinned OpenAI secondary attempt, exhausted attempts create a durable failure fence, and only the explicit card retry command opens another generation epoch.
gaps:
  - adopt: Replaced automatic missing-result and vanished-owner retries with durable cooldown or terminal failure state.
  - reject: Fleet-wide admission and deployment-topology policy remain owned by issue #442.
verdict: met
```

#### 2026-07-07 — aspect:provider-failure-degraded-mode after route-view generation contract cleanup

```yaml
date: 2026-07-07
acs:
  - acceptance-check:reaction-respond-format
  - acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/api/reaction/generate/[id]/__tests__/route.test.ts; ; app/api/gap-reports/[id]/reaction/__tests__/route.test.ts; app/components/research-route-renderers/__tests__/search-view.helpers.test.ts
runCommitSha: 5d54442ad05a+worktree
observedOutput: Current provider failure evidence is scoped to the active automatic route AI comment generation path. The route AI comment generator requests structured JSON only, trims generated titles to 30 characters and body text to 400 characters, sanitizes title/body as plain text without markup, and persists only the title/body/chips shape that the host renders without host-owned button surfaces. Invalid, empty, timed-out, aborted, or provider-failed structured generation returns reaction:null, clears pending UI state through the route-owned lifecycle, and does not fabricate or persist a fallback AI comment. Degraded notices are rejected at route AI comment persistence boundaries. Inline analysis exposes deterministic status badges for queued, running, done, and error states: each state has a distinct label, className differs by status family, and only the running badge shows the spinner. The error badge remains visible instead of blocking the deterministic search result surface.
gaps:
  - adopt: The previous provider-failure ledger mixed the legacy interactive reaction stream degraded AI comment card with the current route-view AI comment contract. The covering row now tracks nullable structured generation and degraded-notice non-persistence.
  - adopt: This review no longer treats the legacy interactive endpoint as current provider-failure evidence; the endpoint is removed from the current product path while automatic AI comment generation keeps nullable structured degradation.
verdict: met
```

#### 2026-06-18 — aspect:provider-failure-degraded-mode after internal PDF handoff

```yaml
date: 2026-06-18
acs:
  - acceptance-check:reaction-respond-format
  - acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/api/reaction/generate/[id]/__tests__/route.test.ts; ; app/components/research-route-renderers/__tests__/search-view.helpers.test.ts
runCommitSha: 50fd42bc01b3
observedOutput: Historical provider degraded-mode evidence was superseded by the current route-view generation contract: provider failure returns nullable structured output, closes pending state, and does not fabricate a fallback AI comment. Inline analysis keeps distinct queued/running/done/error badges with the spinner only on running.
gaps:
  - adopt: Current Aspect appliesTo, Coverage By Promise, and run evidence no longer rely on the retired interactive stream path.
  - reject: This historical entry is not current evidence for a synthetic fallback card.
verdict: met
```
