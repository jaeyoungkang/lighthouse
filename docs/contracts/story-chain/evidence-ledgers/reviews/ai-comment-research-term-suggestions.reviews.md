# AI Comment Research Term Suggestions — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [ai-comment-research-term-suggestions.ledger.yaml](../ai-comment-research-term-suggestions.ledger.yaml).

### Sufficiency Review

#### 2026-07-18 — citation lineage keeps full flow evidence beside the shared term treatment

```yaml
date: 2026-07-18
acs:
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx; app/components/research/__tests__/AgentPanel.citation-lineage.test.tsx; app/components/research-route-renderers/__tests__/relationship-view-ai-comment-actions.test.tsx; app/components/research-route-renderers/citation-lineage-view.tsx; app/components/research-route-renderers/citation-lineage-agent-actions.ts; app/components/research-route-renderers/__tests__/citation-lineage.helpers.test.ts; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx; app/components/research/__tests__/AgentPanel.reaction-cards.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx
runCommitSha: cdf56b3eb5a3+worktree
observedOutput: The citation-lineage reaction title identifies the seed paper, and the live review judges the opened inline body for a two-direction explanation of which prior flow or method led into the seed and which later direction or topic follows from it rather than accepting paper-count narration alone. The route host derives gap-map eligibility from the combined reference and citation paper lists: a nonempty combined list exposes the host-owned `연구 공백 지도 만들기` action above and outside the AI comment frame and hands the complete collected list to the existing gap-network path, while an empty combined list leaves the reaction title and body without that action. Clicking the eligible host action opens the existing gap-network pipeline in a new window with the complete collected paper list; because the route host owns it outside the generated surface, it remains available when the reaction contains only title and body. On search results, the result commit immediately shows the pending AI comment state in the result rail and starts generation from the committed snapshot even when personalized card hydration remains pending; background hydration neither delays generation nor appends late grounding. Explicit regeneration keeps the settled card visible and replaces only its regeneration control with a pending state. The search host keeps its own `연구 공백 지도 만들기` action on the result-basis row, outside filter controls, compact metadata, and the AI comment frame. The shared research-term line remains an appended text treatment and does not replace these pending, regeneration, or host-owned eligibility boundaries.
gaps:
  - adopt: The current review makes the citation-flow title/body evidence, nonempty-paper host action, and search pending/regeneration/host-action boundaries explicit instead of relying on older shared-term-treatment summaries.
  - reject: Research-term rendering does not become evidence that a generic relationship summary or gap action may be fabricated without collected citation papers.
verdict: met
```

#### 2026-07-17 — relationship term lines reject stale semantic profiles

```yaml
date: 2026-07-17
acs:
  - acceptance-check:graph-neighbor-papers-gap-surface
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/GraphNeighborsView.inline-analysis-terms.test.tsx; app/components/research-route-renderers/__tests__/relationship-view-ai-comment-actions.test.tsx; app/server/services/__tests__/graph-neighbor-papers.test.ts; app/api/gap-reports/__tests__/route.test.ts
runCommitSha: c4eca6b3571f+worktree
observedOutput: Graph-neighbor AI comment의 연구 용어 줄은 current v8·fingerprint·usable abstract를 갖춘 semantic profile에서만 나온다. Legacy 분석이나 공백 초록에 남은 profile만 있을 때는 `주요 연구 용어` 줄을 억지로 만들지 않고 기존 AI comment frame을 유지한다. 그래프 후보가 있으면 host-owned `연구 공백 지도 만들기` action은 AI comment frame 위에 계속 노출되고, 클릭 시 co-cited/coupled shared-count 근거를 포함한 현재 route의 전체 후보 snapshot을 source payload 재조회 없이 기존 gap-network 입력으로 전달한다.
gaps:
  - adopt: 관계 연구 용어는 카드 표시와 같은 current-analysis 자격을 공유한다.
  - reject: 유효한 grounded profile이 없을 때 generic LLM term generator로 대체하지 않는다.
verdict: met
```

#### 2026-07-04 — research term route transition leaves AI comment placement intact

```yaml
date: 2026-07-04
acs:
  - acceptance-check:search-results-suggest-english-terms-result-basis
  - acceptance-check:search-results-suggest-english-terms-prefilled-search
acReviewedRevision:
  - 3
  - 6
fixtureRef: app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.term-discovery.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: 03171abcb208+worktree
observedOutput: The AI comment research-term placement remains compact text inside the comment flow while the click behavior now opens a visible route transition owned by the research route shell. Research-term and different-position plain clicks use the shared follow-up handler to push the transient entry URL and set origin-bound transition state; detached clicks leave the current window transition state untouched. The route transition mechanics and canonical reserve evidence remain owned by search-result-window.ledger.md, while this Aspect ledger confirms the AI comment host still exposes the same clickable term text without adding chips, a separate overview row, or duplicate placement.
gaps:
  - adopt: The previous Aspect review predated the visible route-transition AC revision, so this entry records that AC6 does not move research terms out of the AI comment text treatment.
  - reject: This Aspect ledger does not become the owner of reserve, redirect, or route-shell lifecycle coverage; those executable checks stay in search-result-window.ledger.md.
verdict: met
```

#### 2026-06-25 — relationship AI comments share research-term text treatment

```yaml
date: 2026-06-25
acs:
  - acceptance-check:search-results-suggest-english-terms-result-basis
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
  - acceptance-check:graph-neighbor-papers-gap-surface
acReviewedRevision:
  - 3
  - 1
  - 1
fixtureRef: app/components/research/__tests__/inline-ai-comment-treatment.test.tsx
runCommitSha: 6d5a325dcef7+worktree
observedOutput: Search, citation-lineage, and graph-neighbor AI comment hosts now share the same inline research-term text treatment when grounded candidates exist; relationship ResearchRoutePayloads derive candidates from stored inline-analysis semantic profiles, render them as compact clickable text in the AI comment frame, preserve the host-owned gap action above and outside that frame, and pass clicks through the same termSeed follow-up search path.
gaps:
  - adopt: The previous deferred relationship-view term treatment is now implemented with grounded inline-analysis candidates instead of leaving citation-lineage and graph-neighbor AI comments visually thinner than search.
  - reject: This change still does not add a generic LLM term generator for relationship ResearchRoutePayloads; no grounded semantic-profile candidate means no forced term line.
verdict: met
```

#### 2026-06-23 — aspect:ai-comment-research-term-suggestions current verdict

```yaml
date: 2026-06-23
acs:
  - acceptance-check:search-results-suggest-english-terms-result-basis
  - acceptance-check:search-results-fast-window-year-distribution
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
acReviewedRevision:
  - 3
  - 8
  - 1
fixtureRef: app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.term-discovery.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx
runCommitSha: 8aa45b61822a
observedOutput: Search result research terms render inside the AI comment area as compact clickable text links inside a sentence from existing term-discovery candidates, with pending/degraded states compact and no-answer hidden. The generated reaction uses the same text scale as the surrounding result UI, while the research-term suggestion stays in the same prose flow. The host-owned research-gap action is right-aligned on the result-basis row. The old separate term row, `다음 검색 후보:` label, `연구 용어 목록` heading, and chip treatment are gone. Publication-year distribution is absent from the card list and header controls when the dropdown is closed, then renders only inside the publication-year filter dropdown panel without `최다` peak copy, numeric scale copy, or `검색 결과 개요` disclosure, while controls keep `필터`, sort, and PDF quick filter visible.
gaps:
  - adopt: Relationship documents should reuse this AI comment text treatment only after they have grounded term candidates.
  - reject: This review does not add a generic LLM term generator for citation-lineage or graph-neighbor documents.
verdict: met
```
