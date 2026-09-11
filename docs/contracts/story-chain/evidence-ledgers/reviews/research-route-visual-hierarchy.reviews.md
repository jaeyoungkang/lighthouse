# Research route visual hierarchy — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[research-route-visual-hierarchy.ledger.yaml](../research-route-visual-hierarchy.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-08-25 — `aspect:research-route-visual-hierarchy` semantic role baseline

```yaml
date: 2026-08-25
acs:
  - acceptance-check:research-route-cap-feedback-route-search-visible
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-layout-separates-seed-from-directions
  - acceptance-check:graph-neighbor-papers-two-axes-separated
  - acceptance-check:route-view-ai-comment-inline-surface-inline-frame-treatment
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
acReviewedRevision:
  - 6
  - 17
  - 1
  - 1
  - 1
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/research-route-visual-hierarchy.contract.test.ts; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research/__tests__/AgentPanel.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx; app/components/research-route-renderers/__tests__/graph-neighbors-view.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkContentReport.test.tsx; http://localhost:3002/search?q=agent+memory; http://localhost:3002/citation?seedPaperId=276421617; http://localhost:3002/gap/faf8c9af-a5fc-4464-8272-5b60103dbb4d
runCommitSha: 76c357f992cd+worktree
observedOutput: 첫 pass는 paper title 15px, body 14px, metadata 12px와 action 11px를 유지해 Human feedback에서 반려됐다. Correction 후 검색·인용·연구 공백에서 route 24/32, section 20/28, paper/body 16/24·28, control 15/22, metadata 13/20, micro 12/18을 확인했다. Exact-state review가 찾은 inline AI, library child, author·spelling·load-more action, Gap fallback·selection, pending/degraded와 stale assertion을 전환했고, design reset에서 kicker와 bare chip 기본값 및 공통 activation/loading carrier도 11px legacy alias에서 semantic role로 옮겼다. 758px search input은 397px이고 library popup은 x49..369, 390px input은 16/24이며 popup은 x16..336, document scroll width는 390px다. 실제 font는 Inter 중심 stack으로 계산됐고 delivery와 SVG label owner는 유지했다. aspect:research-route-visual-hierarchy verdict는 met이다.
gaps:
  - adopt: semantic type role과 tone을 분리하고 실제 읽기 scale을 상향해 child control과 pending/degraded를 포함한 검색·관계·연구 공백 surface가 같은 상대 위계를 사용한다.
  - adopt: font family와 delivery는 유지하고, 좁은 화면의 primary·연도 input은 16px로 보정한다.
  - reject: SVG graph label, pointcut 밖 legacy alias, helper cascade 통합, 전역 radius·shadow와 font delivery 정리는 별도 migration으로 남긴다.
verdict: met
```
