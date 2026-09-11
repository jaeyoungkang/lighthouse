# Immediate Navigation — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [immediate-navigation.ledger.yaml](../immediate-navigation.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-07-14 — aspect:immediate-navigation paper-search button feedback

```yaml
date: 2026-07-14
acs:
  - acceptance-check:search-query-route-transition-submit-feedback
  - acceptance-check:gap-led-next-search-click-feedback
acReviewedRevision:
  - 1
  - 3
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-query-route-transition.ledger.md; docs/contracts/story-chain/evidence-ledgers/gap-led-next-search.ledger.md; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkFocusedSelectionSummary.feedback.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; docs/runtime-flows/search-mechanism.md
runCommitSha: 5e5f634357ca
observedOutput: Advice-to-evidence matrix for `aspect:immediate-navigation`: route-bar and first-search submit controls are covered by search-query-route-transition submit-feedback revision 1; focused gap seed controls are covered by gap-led-next-search click-feedback revision 3. All three paper-search button surfaces derive rotation, `aria-busy`, and disabled state from the existing shell-scoped activation. The activation starts before `router.push`, leaves provider work to the destination route, ignores exact same-route submissions, and retains identity-safe cleanup. The gap control matches its full target route, including personalization, library context, and term-seed parameters, so another activation with the same query cannot disable it; detached activation does not create button busy state.
gaps:
  - adopt: Explicit paper-search buttons now acknowledge the click on the control itself in addition to the persistent viewport receipt.
  - reject: Keyword text links and detached activations keep their existing receipt semantics; this change does not force button visuals onto non-button affordances.
  - reject: No new transition store or origin-owned processing state is introduced.
verdict: met
```

#### 2026-07-12 — aspect:immediate-navigation visible keyword receipt without restoring origin processing

```yaml
date: 2026-07-12
acs:
  - acceptance-check:search-results-suggest-english-terms-click-feedback
  - acceptance-check:similar-papers-discovery-author-topic-search
  - acceptance-check:inline-analysis-auto-run-search-click-feedback
  - acceptance-check:gap-led-next-search-click-feedback
  - acceptance-check:citation-lineage-keyword-click-feedback
  - acceptance-check:graph-neighbor-papers-keyword-click-feedback
acReviewedRevision:
  - 1
  - 5
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.md; docs/contracts/story-chain/evidence-ledgers/similar-papers.ledger.md; docs/contracts/story-chain/evidence-ledgers/inline-analysis.ledger.md; docs/contracts/story-chain/evidence-ledgers/gap-led-next-search.ledger.md; docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.md; docs/contracts/story-chain/evidence-ledgers/graph-neighbor-papers.ledger.md; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.gap-led-next-search.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs
runCommitSha: c6a4e99ef2f7+worktree
observedOutput: Advice-to-evidence matrix: research term rev 1 → search-result-window; author/topic rev 5 → similar-papers; different-position rev 1 → inline-analysis; gap seed rev 1 → gap-led-next-search; citation keyword rev 1 → citation-lineage; graph-neighbor keyword rev 1 → graph-neighbor-papers. Plain keyword clicks update one persistent screen-level live region whose sticky surface stays in the current scroll viewport while origin content remains mounted. The receipt has no aria-busy announcement hold. State and timer are shell-scoped, identity-safe across consecutive clicks, and removed on destination arrival, bounded timeout, synchronous navigation invocation failure, or shell unmount. Actual gap buttons preserve modifier and middle-click events through the full call chain so detached tabs do not mutate the current receipt.
gaps:
  - adopt: The click-to-paint interval is now a first-class Aspect slice across every shared keyword owner.
  - reject: The retired origin-owned search processing screen and singleton transition store remain removed; destination pending, ready, and failed states are unchanged.
  - reject: router.push returns void, so asynchronous App Router failure is closed by route arrival or bounded timeout rather than a fictitious rejected promise.
verdict: met
```
