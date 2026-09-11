# Source Basis Contract Map

This map explains how Light House currently keeps source, input scope, limits,
fallback, and generated-reaction voice visible enough for researcher judgment.

It is a derived reading map. The source of truth remains Product Identity, Story
Chain, Evidence Ledgers, Mission Control, and tests.

## Current Status

Snapshot checked on 2026-07-07 with `npm run mc:status`:

- Promise chain: 37/37 met.
- Aspect release axis: 21/21 met.
- Release verdict: ready.

The numbers above are a reading snapshot, not a second source of truth. Re-run
`npm run mc:status` before using this map for release judgment.

For the general status-reading rule, see [`verdict-reading.md`](verdict-reading.md).

## Product Principle

Product Identity makes trust a product criterion. A researcher should understand
what data source a search result, reaction, or follow-up action is based on, why
that source is credible enough for the task, and where the source is limited.

Source:

- [`docs/product-identity.md`](../product-identity.md)

## Contract Split

Light House does not use one "trust" Aspect. The current model splits source
basis across information structure and generated-reaction voice.

| Concern | Current owner | Role |
| --- | --- | --- |
| Source, input scope, loaded window, cap, known limit, fallback signal | [`aspect:visible-explanation-sufficiency`](../contracts/story-chain/aspects/visible-explanation-sufficiency.md) | Puts the needed explanation near the surface where the user judges it |
| Generated-reaction vocabulary and sentence priority | [`aspect:reaction-prefers-load-bearing-facts`](../contracts/story-chain/aspects/reaction-prefers-load-bearing-facts.md) | Keeps short AI reactions focused on counts, source limits, input scope, and next actions |
| Fixed copy and public wording governance | [`aspect:user-facing-language-governance`](../contracts/story-chain/aspects/user-facing-language-governance.md) | Keeps fixed UI copy and public prose aligned with current product vocabulary |

This split came from the private beta trust-basis work. The feedback inventory is
planning input, not the current contract state.

Source:

- [`research-trust-basis-surface-inventory.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-trust-basis-surface-inventory.md)

## Search Result Basis

`promise:search-results-fast-window` owns the current search result basis surface.
Its `acceptance-check:search-results-fast-window-result-basis-visible` requires
the search screen and AI reaction context to explain the current result basis.

The current contract says the UI should make clear that:

- results come from the Moonlight Search index through the Episteme literature
  runtime, whose base-corpus lineage includes the Semantic Scholar dump;
- the visible result set is a loaded result window, not the complete corpus;
- current sort, year filter, DOI exact lookup, and multi-query merge status shape
  the result;
- Episteme/internal API details are not presented as an independent user-facing
  corpus, and Semantic Scholar lineage is not described as a direct runtime
  request;
- wording avoids making Light House sound like it picked "top 40" papers by an
  internal AI criterion.

Sources:

- [`docs/contracts/story-chain/promises/search-results-fast-window.md`](../contracts/story-chain/promises/search-results-fast-window.md)
- [`docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml)
- [`research-google-scholar-comparison.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-google-scholar-comparison.md)

## Generated Search Reaction

`promise:search-reaction-summarizes-terrain` owns the search completion reaction.
The reaction must summarize the result set terrain instead of echoing the query.
It leaves follow-up actions to host-owned research-route controls and does not
perform a new search inside reaction generation.

The source-basis rule here is not "show every provider detail in the reaction".
It is narrower: the route-view AI comment uses the current result set as input,
spends the bounded generated body on load-bearing facts, and keeps search as a
user action.

Sources:

- [`docs/contracts/story-chain/promises/search-reaction-summarizes-terrain.md`](../contracts/story-chain/promises/search-reaction-summarizes-terrain.md)
- [`docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml)
- [`app/server/agent/route-ai-comment-generation.ts`](../../app/server/agent/route-ai-comment-generation.ts)
- [`app/lib/view-snapshot.ts`](../../app/lib/view-snapshot.ts)
- [`app/domain/view-snapshot.ts`](../../app/domain/view-snapshot.ts)

## Citation Lineage

`promise:citation-lineage` owns the source-basis distinction for seed-paper
references and citations. It separates the seed paper from references and
citations, preserves direction availability metadata, and distinguishes actual
zero papers from provider-limited or truncated states.

The source-basis rule here is that "none" must not hide a source limitation.
When the provider does not supply a list or truncates it, the UI and reaction
input keep that limitation visible instead of converting it into a false absence
claim.

Sources:

- [`docs/contracts/story-chain/promises/citation-lineage.md`](../contracts/story-chain/promises/citation-lineage.md)
- [`docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml`](../contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml)

## Gap Network

Gap network surfaces carry source basis through input counts, abstract coverage,
paper-to-paper edge counts, citation-lineage input breakdown, and degraded states
for insufficient graph evidence.

The important contract point is that missing adjacency or weak graph evidence is
treated as limited evidence, not as proof that a relation or gap is absent.

Sources:

- [`docs/contracts/story-chain/promises/gap-network-detection-from-search.md`](../contracts/story-chain/promises/gap-network-detection-from-search.md)
- [`docs/contracts/story-chain/promises/gap-report-prepared-reaction.md`](../contracts/story-chain/promises/gap-report-prepared-reaction.md)
- [`docs/contracts/story-chain/promises/gap-overlay-decision-evidence.md`](../contracts/story-chain/promises/gap-overlay-decision-evidence.md)
- [`docs/contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.yaml`](../contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.yaml)

## Provider Failure

`aspect:provider-failure-degraded-mode` handles hard provider failure. When AI
providers fail, Light House should keep deterministic surfaces usable and avoid
inventing unsupported AI summaries. User-visible messages stay short and do not
expose raw provider errors, API keys, stack traces, or exception class names.

Sources:

- [`docs/contracts/story-chain/aspects/provider-failure-degraded-mode.md`](../contracts/story-chain/aspects/provider-failure-degraded-mode.md)
- [`docs/contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml`](../contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml)

## Route-View AI Comment Contract

The route-view AI comment contract keeps generated reactions bounded. It does not
own every source-basis detail, but it gives visible route-view AI comments the
common shape: short title, bounded body, plain text, bounded chips/surfaces, and
nullable degraded output.

`runtime-contract.md` defines the shared runtime check registry.
`route-view-ai-comment-generation-routing.ledger.yaml` and
`search-reaction.ledger.yaml` carry the current release evidence for generated
route-view comments. Do not infer current release state from Aspect file
frontmatter alone.

Sources:

- [`docs/contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md`](../contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md)
- [`docs/contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml`](../contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml)
- [`docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml)

## Feedback Relationship

The private beta trust-basis documents remain useful for product reasoning, but
they are not release verdict sources.

Use them this way:

- [`research-trust-basis-surface-inventory.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-trust-basis-surface-inventory.md)
  explains the original product concern and surface inventory.
- [`research-google-scholar-comparison.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-google-scholar-comparison.md)
  explains why search source education is a trust problem rather than a
  tooltip-only copy task.
- this Contract Map explains the current source files that now carry the
  contract and evidence.

## Read Path

For a source-basis change, read in this order:

1. [`docs/product-identity.md`](../product-identity.md)
2. This map.
3. The affected Promise and Aspect files.
4. The covering Evidence Ledger.
5. `npm run mc:status` output.
6. Relevant Moonlight Project Knowledge evidence only if the change comes from user
   feedback.

Then update the source contract through Mission Control. Do not treat this map as
the edit target for product meaning.
