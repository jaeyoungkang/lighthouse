# paper-card-action-loading-feedback — Sufficiency Reviews

This sidecar byte-preserves the dated history moved from the former operational
Markdown ledger. The current owner is
[paper-card-action-loading-feedback.ledger.yaml](../paper-card-action-loading-feedback.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-08-02 — aspect:paper-card-action-loading-feedback YAML v2 migration re-verification

```yaml
date: 2026-08-02
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 12
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx
runCommitSha: 87ed95cc47a4
observedOutput: aspect:paper-card-action-loading-feedback의 YAML v2 원장이 지정한 5개 test file, 34개 test가 모두 통과했다. Search, citation-lineage, graph-neighbor surface가 shared SearchResultItem action row를 사용하고 클릭한 action과 paper에만 loading state를 한정한다. Pending metadata는 `PDF 확인 중`과 공통 detail hydration frame으로 표시되어 false no-PDF 상태나 page-level spinner로 대체되지 않는다.
gaps:
  - adopt: AC별 executionRefs가 shared card action row, local loading paper id, pending metadata frame을 하나의 실제 실행으로 검증한다.
  - reject: 전역 page-level spinner는 card-action feedback Aspect의 책임으로 확장하지 않는다.
verdict: met
```

#### 2026-06-08 — `aspect:paper-card-action-loading-feedback` shared card action state

- Input: Search, citation-lineage, and graph-neighbors cards now share the same `SearchResultItem` action row while opening graph-backed similar papers and citation-lineage follow-ups.
- Evidence: `search-result-item.graph-neighbors.test.tsx` asserts the shared loading affordance for graph-backed similar papers, `CitationLineageView.graph-neighbors.test.tsx` covers the same action row on citation and graph-neighbor documents plus the shared pending detail frame for graph-neighbor card metadata, `use-graph-neighbors-handler.test.tsx` covers the background replacement from pending to ready, and `search-view-content.test.tsx` covers pending search-card PDF availability as `PDF 확인 중` plus the detail status frame below the action row.
- Gaps observed:
  - Adopt-resolved — route renderers pass loading paper ids into the shared card rather than rendering local one-off loading buttons.
  - Reject — global page-level spinners are outside this Aspect; the contract is card-action feedback only.
- Verdict: met


#### 2026-08-25 — 단일 서지 줄과 DOI/PDF action loading 정합성

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 20
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색, 인용 관계, 비슷한 논문의 공유 SearchResultItem은 제목 다음에 venue·분야·저자 요약 서지 줄을 한 줄로 유지하고, action row를 고정 DOI 슬롯에서 시작한 뒤 PDF·인용·비슷한 논문 순으로 표시한다. DOI 유무는 뒤 action의 기준점을 바꾸지 않으며, PDF hydration은 기존 `PDF 확인 중` 상태와 공통 detail frame 안에서만 바뀐다. aspect:paper-card-action-loading-feedback verdict는 met이다.
gaps:
  - adopt: 공통 action row가 DOI 고정 슬롯과 action별 loading 상태를 함께 소유한다.
  - reject: DOI를 loading 상태로 만들거나 surface별 action 순서를 추가하지 않는다.
verdict: met
```
