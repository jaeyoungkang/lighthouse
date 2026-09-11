# Search Reaction — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [search-reaction.ledger.yaml](../search-reaction.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-18 — `aspect:visible-explanation-sufficiency` separates immediate limits from opened source detail

```yaml
date: 2026-07-18
acs:
  - acceptance-check:reaction-respond-format
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
  - acceptance-check:search-reaction-summarizes-terrain-generation-boundary
  - acceptance-check:search-reaction-summarizes-terrain-representative-badges
  - acceptance-check:search-reaction-summarizes-terrain-library-grounding
acReviewedRevision:
  - 1
  - 4
  - 6
  - 3
  - 3
fixtureRef: app/components/research/__tests__/AgentPanel.test.tsx; app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research/__tests__/representative-paper-selection.test.ts; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/server/domain-access/__tests__/search-enrichment-access.test.ts; app/lib/__tests__/view-snapshot.test.ts; app/server/agent/__tests__/route-ai-comment-generation.test.ts; app/server/agent/route-ai-comment-generation.ts; app/domain/route-ai-comment.ts
runCommitSha: b7c3efc20cfc+worktree
observedOutput: The result commit immediately renders a pending AI comment in the result rail and starts one provider generation from the committed result snapshot when the visible result pool is facet-neutral; background hydration neither delays that call nor appends late grounding. A hydration-owned active facet instead keeps the same pending surface until detail enrichment and compatibility repair are terminal, generates once from the non-empty final pool, or closes without provider work when the pool is empty. A successful empty 200 from initial pending hydration or ready-snapshot repair preserves the committed lightweight cards and records `ready + repairAttempted:true` immediately. Provider errors and aborts remain failed attempts without that marker and follow the sequential maximum-three retry boundary; exhaustion preserves the lightweight result and settles the same terminal state, so the comment neither waits forever nor triggers the same repair again. A legacy payload labeled ready but still eligible for repair stays gated by the same background repair predicate, so repair-driven facet membership changes cannot cause a pre-repair comment followed by a second generation. A new query clears the previous reaction, obsolete queued work is dropped, a prompt-relevant ViewSnapshot projection change rebases generation, and projection-external metadata does not re-fire it. Explicit regeneration preserves the settled card and shows only its regeneration-pending state. The host-owned `연구 공백 지도 만들기` action stays on the result-basis row outside filter controls, compact metadata, and the AI comment frame. Representative badges are selected deterministically from query and field fit before first-payload graph support and citation tie-breaks, without promoting off-field candidates. The prompt includes library context only when first-payload metadata has `libraryContext.signalPresent`; without that signal it omits the library line. The generated-output boundary trims title to at most 30 characters and body to at most 400 characters, rejects empty structured output, and instructs the JSON-only generator to return plain text without markdown or a host-owned button surface. Across repeated paper cards, the collapsed frame keeps the summary label, analysis state, missing-abstract limitation, pending, and error signals visible. A settled abstract-backed summary defers the exact `초록 기반 AI 분석` badge and source links to the opened inspection, where the full analysis detail appears in the same card.
gaps:
  - adopt: Current evidence makes the committed search basis, pending/regeneration lifecycle, host action, representative selection, conditional library grounding, and bounded card disclosure explicit in one current review.
  - reject: The source badge must not consume collapsed scan space, and missing evidence or failure state must not be hidden behind expansion.
verdict: met
```

#### 2026-07-07 — aspect:visible-explanation-sufficiency and aspect:reaction-prefers-load-bearing-facts after route-view generation cleanup

```yaml
date: 2026-07-07
acs:
  - acceptance-check:reaction-respond-format
acReviewedRevision:
  - 1
fixtureRef: app/api/reaction/generate/[id]/__tests__/route.test.ts; app/server/agent/__tests__/route-ai-comment-generation.test.ts; app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts
runCommitSha: 5d54442ad05a+worktree
observedOutput: Current search AI comment evidence is bounded by route-view structured generation, not the retired interactive stream. The generation route returns only `ResearchRoutePayloadReaction-or-null`, invalid or absent output does not fabricate fallback prose, UI pending state remains visible before content arrives, and the live judge track verifies generated body prose carries result-set terrain rather than decorative query repetition.
gaps:
  - adopt: The Aspect covering ledger now points at current search reaction evidence instead of the retired respond baseline marker.
  - adopt: Length, plain-text, nullable failure, and load-bearing prose checks are covered by route tests, structured generation tests, visible pending UI tests, and live judge evidence.
  - reject: The retired respond-contract ledger remains only a mutation-baseline marker and is not current sufficiency evidence for these Aspects.
verdict: met
```

#### 2026-04-22 — Re-verified under real runtime path; initial runtime run found Intent NOT met, same-day fix closes it

```text
date: 2026-04-22
acs: []
acReviewedRevision: []
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/search-reaction.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: Initial re-verification runs (before fix) showed the simulation-wrapper false-met invalidated — LLM consistently generated structured reaction surface as a JSON-stringified object or primitive placeholder (e.g. `1`), failing the `ResearchRoutePayloadReaction` schema optional structured surface validation, so structured generation validation injected a surface-less fallback card. The live Gemini judge against that fallback returned `answered: false` for all three Critical Questions. After the fixes in the same session (tool-boundary surface coercion in `structured generation schema`, stopWhen retry until successful structured generation, route-view surface normalization programmatic injection for search-awareness, awareness model upgraded from Flash Lite to Flash), 15 consecutive live-runtime runs returned `verdict: met` with `unansweredCritical: []`. 15/15 reliability against the real runtime output, not a simulation.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: `search-awareness-intent-qualitative.live.test.ts` rewritten to comply with `docs/principles.md §0` — simulation wrapper removed, then-current runtime called `streamText(google(GEMINI_MODEL), ...)` with the real `buildReactionSystemPrompt` + structured generation schema + `toolChoice: "required"` + `stopWhen: [hasSuccessfulStructuredGeneration, stepCountIs(3)]`, then applied structured generation validation and route-view surface normalization. Same worst-case fixture (5 LLM-agent papers, total 180 > fetch limit, multi-clause with `lifelong learning` 0편).
- Evidence: Initial re-verification runs (before fix) showed the simulation-wrapper false-met invalidated — LLM consistently generated structured reaction surface as a JSON-stringified object or primitive placeholder (e.g. `1`), failing the `ResearchRoutePayloadReaction` schema optional structured surface validation, so structured generation validation injected a surface-less fallback card. The live Gemini judge against that fallback returned `answered: false` for all three Critical Questions. After the fixes in the same session (tool-boundary surface coercion in `structured generation schema`, stopWhen retry until successful structured generation, route-view surface normalization programmatic injection for search-awareness, awareness model upgraded from Flash Lite to Flash), 15 consecutive live-runtime runs returned `verdict: met` with `unansweredCritical: []`. 15/15 reliability against the real runtime output, not a simulation.
- Gaps observed:
  - **Adopt-resolved — LLM-emitted structured reaction surface occasionally unparseable under the strict discriminated-union schema**. Historical resolution: the then-current route-view reaction schema `coercedSurface` accepted stringified JSON / non-object placeholders at the tool boundary, parsed when possible, and dropped to `undefined` otherwise. Domain `ResearchRoutePayloadReaction` schema stayed strict for downstream consumers.
  - **Adopt-resolved — retired runtime stopWhen aborted on the first tool call, losing the chance for Gemini to see a tool-call error and retry**. Historical resolution: the then-active structured generation boundary used `[hasSuccessfulStructuredGeneration, stepCountIs(AWARENESS_MAX_STEPS=3)]`. The later route-view boundary now fails closed through `ResearchRoutePayloadReaction-or-null`.
  - **Adopt-resolved — surface content for search awareness is deterministic; LLM should not be responsible for emitting it**. Historical resolution: route-view surface normalization injected the fixed 2-part guided_tree (`search-representative` + `search-gap`) when a search-completion route-view reaction landed without a valid surface. The current contract has retired AI-comment button surfaces; host-owned follow-up actions live outside generated output.
  - **Adopt-resolved — Flash Lite unreliable even with surface injection on title/body Intent quality**. Resolution: `AWARENESS_MODEL` upgraded to `GEMINI_MODEL` (Flash); 15-run sample measured Flash 15/15 met vs Flash Lite 13/15 met under the same fix stack.
  - **Adopt-resolved — simulation-wrapper-based Sufficiency Review regression class not caught by prior gate**. Resolution: already closed by `docs/principles.md §0 핵심 철학` (commit `a23902a`) — simulation wrappers banned at principles level.
  - **Reject — 100% mathematical guarantee under live LLM**. Live LLM outputs are probabilistic; 15/15 is strong empirical evidence but not a mathematical proof. Treat future regressions as new Sufficiency Review entries rather than demanding a guarantee unavailable under stochastic models.
- Verdict: met
