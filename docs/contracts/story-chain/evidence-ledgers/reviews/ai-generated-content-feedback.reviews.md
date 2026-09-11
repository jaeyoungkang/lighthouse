
# AI-generated Content Feedback — Sufficiency Reviews

## Reviews

### Sufficiency Review

#### 2026-06-18 — aspect:ai-generated-content-feedback after internal PDF handoff

```yaml
date: 2026-06-18
acs:
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
fixtureRef: app/components/__tests__/ai-content-feedback.test.tsx; app/components/research/__tests__/AgentPanel.feedback.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkContentReport.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkFocusedSelectionSummary.feedback.test.tsx
runCommitSha: bd2cdbba7cb4
observedOutput: AI-generated content feedback coverage now excludes current feedback surfaces. For search reactions, the current evidence covers the visible AgentPanel reaction card case: the AI reaction body remains readable, the feedback affordance sits adjacent to that body, and the submitted payload preserves document, surface, promise, and output provenance. Document-embedded inline search AI comments intentionally omit this feedback affordance; their pending state, result-basis-row gap action, and inline research-term text are covered by the search reaction ledgers instead. The same feedback component remains active for expanded inline analysis, gap prose, and gap overlay proposals.
gaps:
  - adopt: Current Aspect appliesTo and ledger coverage no longer name retired PDF Promise ids.
  - adopt: Document-embedded inline reactions now intentionally omit feedback affordances under promise:route-view-ai-comment-inline-surface.
  - reject: Historical PDF visual feedback review rows are not active Sufficiency Review data after the Human-approved retirement.
verdict: met
```

#### 2026-07-10 — route-owned inline reaction pointcut propagation

```yaml
date: 2026-07-10
acs:
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
acReviewedRevision:
  - 1
  - 2
  - 1
fixtureRef: app/components/__tests__/ai-content-feedback.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkContentReport.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkFocusedSelectionSummary.feedback.test.tsx
runCommitSha: e531e3f5+worktree
observedOutput: The Aspect pointcut already excludes short route-owned top inline reactions. Search and citation-lineage AI comments now use only that inline surface, so their stale reciprocal Aspect refs and the retired AgentPanel feedback fixture were removed. Feedback remains on expanded inline paper analysis, rendered gap report prose, and focused gap proposals.
gaps:
  - adopt: The appliesTo list and covering ledger now match the approved route-inline exception.
  - reject: Keeping a production-only feedback branch or test-only AgentPanel layout to satisfy stale evidence.
verdict: met
```
