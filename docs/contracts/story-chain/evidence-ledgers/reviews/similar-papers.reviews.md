# Similar Papers — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [similar-papers.ledger.yaml](../similar-papers.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.


## Reviews

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-09-03 — E3 paper reference 기반 graph route 재검토

```yaml
date: 2026-09-03
acs:
  - acceptance-check:similar-papers-discovery-similar-button-on-each-paper
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-same-basis-reuse
acReviewedRevision:
  - 1
  - 6
  - 5
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx; app/server/services/__tests__/relationship-execution.test.ts; app/lib/__tests__/episteme-paper-ref.test.ts
runCommitSha: 8a2b1b9a862851fdf65079f8dff41f4264e98443+worktree
observedOutput: E3 paper reference로 식별되는 seed는 canonical uid 또는 S2 carrier 여부와 무관하게 graph-backed route를 열고, E3 ref가 없는 legacy seed만 title/topics keyword fallback을 사용한다. fallback route의 URL 소유권과 retired personalize/libraryPaperIds 비참여는 그대로 유지된다.
gaps:
  - adopt: graph admission 의미를 numeric corpus id가 아니라 provider-neutral E3 paper reference로 명시한다.
  - reject: legacy fallback의 immediate-navigation과 seed provenance를 변경하지 않는다.
verdict: met
```

#### 2026-07-12 — author and topic click acknowledgement stays visible

```yaml
date: 2026-07-12
acs:
  - acceptance-check:similar-papers-discovery-author-topic-search
acReviewedRevision:
  - 5
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: c6a4e99ef2f7+worktree
observedOutput: Author-name and inline-topic controls reach the shared handler. A plain click renders the selected query in a sticky, persistent screen-level status region while the origin cards remain mounted; destination arrival and the bounded shell-scoped lifecycle remove it. Modifier and middle clicks open the same entry URL in a detached tab without changing the current-window receipt.
gaps:
  - adopt: The existing author/topic owner now covers both immediate URL navigation and the visible interval before destination paint.
  - reject: The receipt is not an origin-owned search processing state; pending, ready, and failed search states remain destination-owned.
verdict: met
```

#### 2026-07-04 — similar fallback and keyword routes navigate immediately via the entry route

```yaml
date: 2026-07-04
acs:
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-author-topic-search
acReviewedRevision:
  - 4
  - 4
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/(research)/__tests__/research-routes.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: 990b039c7b1f
observedOutput: aspect:immediate-navigation applied. The legacy/non-corpus similar fallback and the author/topic keyword entry points no longer await a client reserve POST — they navigate immediately to the `/search?q=` condition URL. The fallback carries the slim seed-paper identity (seedPaperId/seedPaperTitle/seedPaperYear/seedPaperUrl/seedPaperCitations, no abstract or authors) as transient entry params which the route rebuilds into ephemeral metadata.seedPaper while executing that condition. It does not redirect to `/search/:id` and does not dedupe against persisted same-seed search ResearchRoutePayloads. Legacy selected libraryPaperIds never ride the entry URL; internal personalize preference/opt-out is preserved via entry params.
gaps:
  - adopt: The similar_papers_discovery click event still fires client-side before navigation; the search submit event now emits server-side at the entry-route reserve.
  - reject: This review does not re-judge graph-backed 비슷한 논문 (graph-neighbors) creation, which keeps its own ledger.
verdict: met
```

#### 2026-06-29 — similar fallback and keyword routes ignore selected anchors

```yaml
date: 2026-06-29
acs:
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-same-basis-reuse
  - acceptance-check:similar-papers-discovery-author-topic-search
acReviewedRevision:
  - 3
  - 3
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/domain-access/__tests__/search-followup-document-access.test.ts; app/api/documents/search/__tests__/route.test.ts
runCommitSha: 14cd7ec44c52
observedOutput: Legacy/non-corpus similar-paper fallback still builds a title/topics query and opens the resulting search route. The search POST body and failure fallback URL do not carry legacy selected libraryPaperIds. When internal reviewed_papers context exists, current personalize preference or personalize:false opt-out is preserved. Reusable local and persisted similar-paper follow-up documents ignore legacy libraryPaperIds differences but still reject a different personalize basis.
gaps:
  - adopt: Similar fallback and author/topic keyword expansion now follow the internal reviewed_papers basis rule.
  - reject: This does not restore selected Moonlight anchors or make old libraryPaperIds part of follow-up reuse.
verdict: met
```

#### 2026-05-04 — Intent absorbed for 4 deterministic search promises

```yaml
date: 2026-05-04
acs:
  - acceptance-check:similar-papers-discovery-similar-button-on-each-paper
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-new-search-view-with-seed-metadata
  - acceptance-check:similar-papers-discovery-seed-paper-excluded-from-results
  - acceptance-check:similar-papers-discovery-fallback-to-title-only-query
  - acceptance-check:similar-papers-discovery-same-basis-reuse
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/similar-papers.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (seed metadata + 탭 포커스 + many-documents route continuation). β Wovenness — canonical ACs all remain wired through ledger Acceptance Checks and Coverage By Promise pointers.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: `promise:search-results-fast-window` (5 ACs), `promise:search-query-route-transition` (7 ACs), `promise:similar-papers-discovery` (8 ACs) — 모두 search 흐름의 surface mechanics을 잡는 deterministic 약속. Human Judgment Gate 결정 — 각 AC가 단일 store state · DOM presence · handler 호출 · helper return-value assertion으로 닫히고 emergent 속성 없음.
- Evidence: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (cap 차단 + seed metadata + 탭 포커스). β Wovenness — 20 ACs (5+7+8) 모두 ledger Acceptance Checks 블록과 Coverage By Promise pointer로 wired.
- Gaps observed:
  - Adopt-resolved — 4 promises × 25 ACs absorbed. 본 IV 블록에 absorption pointer 박음.
  - Reject — γ Necessity (배너 시각감 / 결과 카드 위계) 평가는 verdict에 포함 안 함; future signal review으로 분리.
- Verdict: met

#### 2026-04-22 — Re-verified under real runtime path; initial runtime run found Intent NOT met, same-day fix closes it

```yaml
date: 2026-04-22
acs:
  - acceptance-check:similar-papers-discovery-similar-button-on-each-paper
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-new-search-view-with-seed-metadata
  - acceptance-check:similar-papers-discovery-seed-paper-excluded-from-results
  - acceptance-check:similar-papers-discovery-fallback-to-title-only-query
  - acceptance-check:similar-papers-discovery-same-basis-reuse
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/similar-papers.reviews.md
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

#### 2026-08-21 — 비슷한 논문과 keyword 후속 검색의 retired basis 제거

```yaml
date: 2026-08-21
acs:
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-same-basis-reuse
  - acceptance-check:similar-papers-discovery-author-topic-search
acReviewedRevision:
  - 5
  - 4
  - 6
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/(research)/__tests__/research-routes.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: d3365127e26aec3aa1f856926fb7e22b4b501baf
observedOutput: legacy/non-corpus fallback은 query와 slim seed identity를, 저자·주제 링크는 query를 canonical `/search?q=` entry로 운반한다. 같은 seed의 과거 client state가 있어도 현재 URL 조건이 새 요청을 소유하며, 모든 current writer는 legacy selected libraryPaperIds와 retired personalize 기준을 생략한다. 목적지 route는 현재 라이브러리 source가 있으면 통합 projection으로 자동 반영한다.
gaps:
  - adopt: seed provenance와 keyword navigation은 유지하되 결과 basis 선택은 목적지에서 복원하지 않는다.
  - reject: 같은 seed 재사용을 retired query/personalize identity 비교로 되돌리지 않는다.
verdict: met
```
