# Moonlight Handoff — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[moonlight-handoff.ledger.yaml](../moonlight-handoff.ledger.yaml). The ledger keeps
executable coverage and the review pointer; release and Mission Control readers
treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

#### 2026-07-16 — shared paper cards isolate PDF handoff from card inspection

```yaml
date: 2026-07-16
acs:
  - acceptance-check:delegate-deep-read-to-moonlight-result-card-link
  - acceptance-check:delegate-deep-read-to-moonlight-result-surfaces
acReviewedRevision:
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: 29e123c6019b+worktree
observedOutput: Search, citation-lineage, and graph-neighbor repeated paper cards keep Moonlight PDF handoff as an explicit nested link. The title is identification text, the card's non-interactive region opens or closes inspection, and clicking the PDF link preserves the current card disclosure state while opening the external Moonlight target.
gaps:
  - adopt: Handoff and inspection share one card but retain independent event ownership.
  - reject: This review does not change the Moonlight URL construction, new-tab policy, or analytics payload.
verdict: met
```

#### 2026-06-30 — current no-broken-link handoff review

```yaml
date: 2026-06-30
acs:
  - acceptance-check:delegate-deep-read-to-moonlight-no-broken-link
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx
runCommitSha: 2a263c0ef80b
observedOutput: Current result-card Moonlight handoff keeps unresolved and missing PDF states as checking or disabled affordances rather than broken external links, while ready direct PDF URLs still become Moonlight handoff links owned by the paper-card action row.
gaps:
  - adopt: The current no-broken-link AC is reviewed as its own 2026-06-30 entry instead of rewriting the 2026-06-18 AC list.
  - reject: This review does not change the current Moonlight handoff behavior.
verdict: met
```

#### 2026-06-18 — direct Moonlight handoff

```yaml
date: 2026-06-18
acs:
  - acceptance-check:delegate-deep-read-to-moonlight-result-card-link
  - acceptance-check:delegate-deep-read-to-moonlight-href-built-from-paper
  - acceptance-check:delegate-deep-read-to-moonlight-no-broken-link
  - acceptance-check:delegate-deep-read-to-moonlight-opens-new-tab
  - acceptance-check:delegate-deep-read-to-moonlight-result-surfaces
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.analytics.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: bd2cdbba7cb4
observedOutput: shared result-card PDF affordances now hand off directly to Moonlight external reading links while preserving the Light House exploration document.
gaps:
  - adopt: Current Promise, ledger, analytics, runtime-flow, and public commitment prose point to Moonlight handoff refs.
  - reject: The earlier `acceptance-check:delegate-deep-read-to-moonlight-no-link-when-urls-missing` slug is not carried in active `yaml.acs` because current review validation requires resolving Story Chain refs; the current replacement is reviewed in the 2026-06-30 entry above.
  - reject: Historical PDF awareness and visual interpretation review notes are not carried as active YAML because their current Acceptance Check refs in the current Story Chain.
verdict: met
```
