# Search Gap Handoff — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [search-gap-handoff.ledger.yaml](../search-gap-handoff.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-19 — detached gap handoff continues after source route departure

```yaml
date: 2026-07-19
acs:
  - acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
acReviewedRevision:
  - 6
fixtureRef: app/components/research-route-renderers/__tests__/search-view-states.test.tsx; docs/runtime-flows/gap-network-analysis.md
runCommitSha: pending-local
observedOutput: The real SearchView starts a deferred gap reservation with a product-owned detached target, then unmounts before the reservation response arrives. The late successful response still moves that same target from `/gap?opening=1` to `/gap/:id`, does not close it, and does not replace the source route. The request and target continuation are therefore owned beyond the source component lifetime, while the source pending indicator remains presentation-only.
gaps:
  - adopt: Source route departure and component unmount do not cancel an already-started gap reservation or orphan its detached target.
  - reject: Browser window close, full reload, process loss, and network failure are outside this source-surface lifetime guarantee.
verdict: met
```

#### 2026-04-22 — Re-verified under real runtime path; initial runtime run found Intent NOT met, same-day fix closes it

```text
date: 2026-04-22
acs: []
acReviewedRevision: []
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/search-gap-handoff.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: Initial re-verification runs (before fix) showed the simulation-wrapper false-met invalidated — LLM consistently generated structured reaction surface as a JSON-stringified object or primitive placeholder (e.g. `1`), failing the `ResearchRoutePayloadReaction` schema optional structured surface validation, so structured generation validation injected a surface-less fallback card. The live Gemini judge against that fallback returned `answered: false` for all three Critical Questions. After the fixes in the same session (tool-boundary surface coercion in `structured generation schema`, stopWhen retry until successful structured generation, route-view surface normalization programmatic injection for search-awareness, awareness model upgraded from Flash Lite to Flash), 15 consecutive live-runtime runs returned `verdict: met` with `unansweredCritical: []`. 15/15 reliability against the real runtime output, not a simulation.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: `search-awareness-intent-qualitative.live.test.ts` rewritten to comply with `docs/principles.md §0` — simulation wrapper removed, then-active pre-retirement runtime called `streamText(google(GEMINI_MODEL), ...)` with the real `buildReactionSystemPrompt` + structured generation schema + `toolChoice: "required"` + `stopWhen: [hasSuccessfulStructuredGeneration, stepCountIs(3)]`, then applied structured generation validation and route-view surface normalization. Same worst-case fixture (5 LLM-agent papers, total 180 > fetch limit, multi-clause with `lifelong learning` 0편).
- Evidence: Initial re-verification runs (before fix) showed the simulation-wrapper false-met invalidated — LLM consistently generated structured reaction surface as a JSON-stringified object or primitive placeholder (e.g. `1`), failing the `ResearchRoutePayloadReaction` schema optional structured surface validation, so structured generation validation injected a surface-less fallback card. The live Gemini judge against that fallback returned `answered: false` for all three Critical Questions. After the fixes in the same session (tool-boundary surface coercion in `structured generation schema`, stopWhen retry until successful structured generation, route-view surface normalization programmatic injection for search-awareness, awareness model upgraded from Flash Lite to Flash), 15 consecutive live-runtime runs returned `verdict: met` with `unansweredCritical: []`. 15/15 reliability against the real runtime output, not a simulation.
- Gaps observed:
  - **Adopt-resolved — LLM-emitted structured reaction surface occasionally unparseable under the strict discriminated-union schema**. Historical resolution: the then-active route-view reaction schema `coercedSurface` accepted stringified JSON / non-object placeholders at the tool boundary, parsed when possible, and dropped to `undefined` otherwise. Domain `ResearchRoutePayloadReaction` schema stayed strict for downstream consumers.
  - **Adopt-resolved — retired runtime stopWhen aborted on the first tool call, losing the chance for Gemini to see a tool-call error and retry**. Historical resolution: the then-active structured generation boundary used `[hasSuccessfulStructuredGeneration, stepCountIs(AWARENESS_MAX_STEPS=3)]`. The later route-view boundary now fails closed through `ResearchRoutePayloadReaction-or-null`.
  - **Adopt-resolved — surface content for search awareness is deterministic; LLM should not be responsible for emitting it**. Historical resolution: route-view surface normalization injected the fixed 2-part guided_tree (`search-representative` + `search-gap`) when a search-completion route-view reaction landed without a valid surface. The current contract has retired AI-comment button surfaces; host-owned follow-up actions live outside generated output.
  - **Adopt-resolved — Flash Lite unreliable even with surface injection on title/body Intent quality**. Resolution: `AWARENESS_MODEL` upgraded to `GEMINI_MODEL` (Flash); 15-run sample measured Flash 15/15 met vs Flash Lite 13/15 met under the same fix stack.
  - **Adopt-resolved — simulation-wrapper-based Sufficiency Review regression class not caught by prior gate**. Resolution: already closed by `docs/principles.md §0 핵심 철학` (commit `a23902a`) — simulation wrappers banned at principles level.
  - **Reject — 100% mathematical guarantee under live LLM**. Live LLM outputs are probabilistic; 15/15 is strong empirical evidence but not a mathematical proof. Treat future regressions as new Sufficiency Review entries rather than demanding a guarantee unavailable under stochastic models.
- Verdict: met
