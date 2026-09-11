# Progressive Content Spatial Stability — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[progressive-content-spatial-stability.ledger.yaml](../progressive-content-spatial-stability.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-07-17 — relationship document identity resets local disclosure

```yaml
date: 2026-07-17
acs:
  - acceptance-check:citation-lineage-card-data-hydration
  - acceptance-check:graph-neighbor-papers-card-data-hydration
acReviewedRevision:
  - 1
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/server/services/__tests__/episteme-literature.test.ts; app/server/services/__tests__/graph-neighbor-papers.test.ts; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.graph-neighbor-hydration.test.tsx
runCommitSha: c4eca6b3571f+worktree
observedOutput: Lazy citation pages hydrate abstract, venue, fields, PDF/open-access, external ids, DOI, and direction availability through the search-parity batch include set before route storage. Graph-neighbor routes first render lightweight candidates inside the shared pending detail frame, then the route-owned background hydrate merges the same card inputs and settles ready while preserving compatible review/analysis state; empty, failed, or bounded-timeout hydration also terminates without discarding the lightweight route. 같은 document id의 hydration 동안 카드 disclosure는 유지되지만 route document id가 바뀌면 ready subtree를 remount하므로 같은 paper id도 이전 펼침 상태를 이어받지 않고 접힌 반복 카드로 시작한다.
gaps:
  - adopt: Disclosure lifetime은 route document identity에 귀속되며 별도 전역 store나 paper-id persistence를 만들지 않는다.
  - reject: 같은 document 안의 hydration과 분석 진행은 기존 inspection을 닫지 않는다.
verdict: met
```

#### 2026-07-16 — `aspect:progressive-content-spatial-stability` current verdict

```yaml
date: 2026-07-16
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible
  - acceptance-check:route-view-ai-comment-inline-surface-bounded-preview-flow
  - acceptance-check:inline-analysis-auto-run-status-badge-distinguishes-states
  - acceptance-check:inline-analysis-auto-run-evidence-limit-preview
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-card-data-hydration
  - acceptance-check:graph-neighbor-papers-card-data-hydration
acReviewedRevision:
  - 2
  - 2
  - 1
  - 1
  - 7
  - 1
  - 2
fixtureRef: app/components/research/__tests__/AgentPanel.test.tsx; app/components/research/__tests__/inline-ai-comment-treatment.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-view.whitespace-abstract.test.ts; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/lib/__tests__/track.test.ts; app/lib/analytics/__tests__/event-router.ai-comment-expand.test.ts
runCommitSha: 29e123c6019b+worktree
observedOutput: The route AI comment pending shell and settled comment use the same bounded generated-content region. Actual rendered overflow, including a short body with explicit line breaks, controls the aria-expanded disclosure, and the real analytics contract accepts route/comment identity metadata while rejecting generated body prose. Search, citation-lineage, and graph-neighbor repeated paper cards share one compact responsive collapsed-card baseline and one generated-content region for hydration, not-started, metadata-only, queued/running/error, and settled states. Collapsed titles stay on one line, summaries use at most two, and the source badge appears only after expansion. Clicking a non-interactive card region opens or closes natural-height detail; the icon-only disclosure remains keyboard and assistive-technology operable, while nested links and controls remain independent. Missing metadata and authors show neutral unavailable copy. Missing or whitespace-only abstracts expose an evidence limit, use visible fields without author identity, and do not invent a queued task.
gaps:
  - adopt: Human approval prioritizes consistent repeated-card presentation, with an appropriately sized responsive baseline and user-driven expansion so automatic enrichment does not reposition the current reading target.
  - reject: The baseline is not a shortest-card absolute height and does not infer paper content from author identity; long metadata may exceed the minimum when accessibility or content requires it.
verdict: met
```

#### 2026-08-25 — 단일 서지 줄 이후의 접힌 카드 안정성

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 20
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/search-result-author-byline.tsx; app/components/research-route-renderers/search-result-generated-content.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 반복 논문 카드는 venue·분야·첫 저자 요약을 하나의 줄임 가능한 서지 줄에 두어 긴 저자명이 카드 폭이나 기본 행 수를 늘리지 않게 한다. DOI/PDF action 아래의 공통 생성 영역은 metadata-only, pending, error, settled 상태에서 같은 최소 공간을 유지하고, 초록이 없는 상태도 별도 제목 없이 같은 영역에서 근거 한계를 밝힌다. aspect:progressive-content-spatial-stability verdict는 met이다.
gaps:
  - adopt: 자동 metadata·분석 상태 변화는 공통 서지 줄과 생성 영역 안에서 처리한다.
  - reject: 긴 저자명이나 저자 수에 따라 접힌 카드의 기본 행 수를 늘리지 않는다.
verdict: met
```

#### 2026-08-25 — `aspect:progressive-content-spatial-stability` 별도 저자 행 기준

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 21
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/search-result-author-row.tsx; app/components/research-route-renderers/search-result-generated-content.tsx
runCommitSha: d571dc25baa8a39f18c6ec3eecadeba3f1096e4d
observedOutput: 반복 논문 카드는 venue·분야 metadata 행과 최대 세 명을 표시하는 저자 행을 공통 접힘 정보 예산에 포함한다. 좁은 화면은 15rem, sm 이상은 14rem의 공통 최소 높이를 사용하고 생성 콘텐츠 영역은 기존 최소 공간을 유지한다. 저자 전체 목록은 사용자가 펼칠 때만 같은 카드 안에서 자연 높이로 늘어나며, 자동 metadata·분석 상태 변화는 카드의 읽기 위치를 임의로 확장하지 않는다. aspect:progressive-content-spatial-stability verdict는 met이다.
gaps:
  - adopt: 별도 저자 행을 수용하도록 공통 접힘 기준 높이를 한 행만큼 복원한다.
  - reject: 저자 수와 이름 길이를 절대 고정 높이로 잘라 공간 안정성을 만들지 않는다.
verdict: met
```
