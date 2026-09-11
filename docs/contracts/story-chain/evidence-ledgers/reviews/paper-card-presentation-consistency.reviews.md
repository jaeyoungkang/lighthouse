# paper-card-presentation-consistency — Sufficiency Reviews

This sidecar byte-preserves the dated history moved from the former operational
Markdown ledger. The current owner is
[paper-card-presentation-consistency.ledger.yaml](../paper-card-presentation-consistency.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-08-25 — `aspect:paper-card-presentation-consistency` 고정 DOI 슬롯

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 19
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.pdf-links.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색, 인용 관계, 비슷한 논문 surface의 반복 카드는 공유 SearchResultItem에서 실제 DOI 문자열을 숨기고 같은 폭의 `DOI` 슬롯을 PDF 앞에 유지한다. DOI가 있으면 링크, 없으면 비활성 버튼으로만 상태가 달라져 PDF와 인용 정보의 기준점이 안정적으로 유지된다. aspect:paper-card-presentation-consistency verdict는 met이다.
gaps:
  - adopt: 공유 반복 카드가 DOI 유무를 포함한 액션 슬롯 크기와 순서를 한 곳에서 소유한다.
  - reject: surface별 DOI 상세 표시나 누락 상태별 가변 배치를 만들지 않는다.
verdict: met
```

#### 2026-08-26 — `aspect:paper-card-presentation-consistency` 긴 출처의 모바일 재검토

```yaml
date: 2026-08-26
acs:
  - acceptance-check:search-results-fast-window-title-year-summary
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 1
  - 22
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; app/components/research-route-renderers/search-result-item.tsx; docs/design-standards.md
runCommitSha: 1b5e234de8a8d43ca1eabb60664ab70cd62796b2
observedOutput: aspect:paper-card-presentation-consistency가 적용되는 검색 결과·인용 관계·비슷한 논문 반복 카드는 공유 SearchResultItem에서 연도와 venue를 하나의 출처 그룹으로 렌더한다. 긴 venue는 남은 폭 안에서 말줄임되어 연도가 별도 줄에 고립되지 않고, 분야 그룹은 바로 뒤에서 같은 행 또는 다음 줄로 이어진다. 연도 누락 시에는 빈 자리 없이 venue부터 시작하며 저자 행과 기존 카드 action 순서는 바뀌지 않는다.
gaps:
  - adopt: 공통 renderer의 grouping과 검색·인용·그래프 parity fixture가 같은 모바일 서지 문법을 보장한다.
  - reject: surface별 줄바꿈 문법이나 연도 badge를 다시 도입하지 않는다.
verdict: met
```

#### 2026-08-26 — `aspect:paper-card-presentation-consistency` 서지 metadata 그룹

```yaml
date: 2026-08-26
acs:
  - acceptance-check:search-results-fast-window-title-year-summary
  - acceptance-check:search-results-fast-window-card-triage-metadata
acReviewedRevision:
  - 1
  - 22
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; app/components/research-route-renderers/search-result-item.tsx; docs/design-standards.md
runCommitSha: e0a89966fd066841962af3e9aef0debdca5e996e
observedOutput: aspect:paper-card-presentation-consistency가 적용되는 검색 결과·인용 관계·비슷한 논문 반복 카드는 공유 SearchResultItem에서 제목을 먼저 읽고, 바로 아래 행에서 박스 없는 연도·venue·분야를 하나의 서지 metadata 그룹으로 읽는다. 연도 값이 없으면 빈 자리를 만들지 않고 venue부터 시작하며, 저자는 다음 행에 유지된다. 공통 parity fixture는 세 surface의 metadata 순서와 표시값이 같음을 확인한다.
gaps:
  - adopt: 공통 renderer와 디자인 표준이 서지 metadata의 순서와 그룹 관계를 함께 소유한다.
  - reject: surface별 연도 badge, 분야 우측 정렬, 별도 metadata 문법을 허용하지 않는다.
verdict: met
```

#### 2026-08-25 — `aspect:paper-card-presentation-consistency` metadata·DOI 근접 배치

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 18
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.pdf-links.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색, 인용 관계, 비슷한 논문 surface의 반복 카드는 공유 SearchResultItem을 통해 venue 바로 아래에 `분야`를 표시하고, 실제 DOI 링크를 PDF 바로 앞에 표시한다. DOI 누락은 빈 자리를 만들지 않으며 DOI 클릭은 카드 disclosure로 전파되지 않는다. 초록이 없는 공통 분석 영역은 `메타데이터 단서` 제목 없이 근거 한계 본문부터 시작한다. aspect:paper-card-presentation-consistency verdict는 met이다.
gaps:
  - adopt: 공유 반복 카드가 metadata 세로 묶음과 DOI/PDF 순서를 한 곳에서 소유한다.
  - reject: 인용 관계나 graph-neighbor surface에 별도 배치 규칙을 만들지 않는다.
verdict: met
```

#### 2026-08-21 — `aspect:paper-card-presentation-consistency` source/taxonomy 기준점

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 16
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-item.tsx
runCommitSha: 07b49a1ff4d0+worktree
observedOutput: 검색, 인용 관계, 비슷한 논문 surface가 공유하는 SearchResultItem은 venue를 왼쪽 source 기준점에, `분야` 라벨과 분야 값을 오른쪽 taxonomy 기준점에 표시한다. 좁은 화면에서는 자연스럽게 쌓이고, 값이 없는 쪽을 위해 빈 노드를 만들지 않는다. 기존 제목, 저자, 액션, 분석 영역과 카드 disclosure parity는 유지된다. aspect:paper-card-presentation-consistency verdict는 met이다.
gaps:
  - adopt: shared repeated-card component가 source/taxonomy 배치 규칙을 한 곳에서 소유한다.
  - reject: 분야를 독립 chip 묶음으로 만들어 카드의 액션·상태 표식과 경쟁시키지 않는다.
verdict: met
```

#### 2026-07-16 — `aspect:paper-card-presentation-consistency` common collapsed-card baseline

```yaml
date: 2026-07-16
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-result-library-add-card-action
  - acceptance-check:inline-analysis-auto-run-evidence-limit-preview
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:citation-lineage-card-data-hydration
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
  - acceptance-check:graph-neighbor-papers-card-data-hydration
acReviewedRevision:
  - 7
  - 7
  - 1
  - 2
  - 1
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-library-action.test.tsx; app/components/research-route-renderers/__tests__/search-view.whitespace-abstract.test.ts; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: 29e123c6019b+worktree
observedOutput: Search, citation-lineage, and graph-neighbor repeated cards use the same compact responsive collapsed-card minimum and stable metadata, author, action, and analysis rows. Collapsed titles stay on one line and summaries use at most two lines; the settled source badge appears only after expansion. Clicking any non-interactive card region opens natural-height detail and clicking it again closes the card, while the icon-only chevron retains its accessible name and expanded state. PDF, citation, similar, author/topic/follow-up, and library controls remain isolated from the card toggle. The title-row library control is a fixed-square bookmark: outline/accent before save and filled/success after save, with full add/remove accessibility labels but no repeated visible command text. Missing metadata and authors show neutral unavailable copy. Hydration, metadata-only, not-started, queued, running, error, and settled states keep the analysis region. Missing or whitespace-only abstracts name the evidence limit, use visible fields without author-based content inference, and never fabricate queued state. Ready sparse citation and graph fixtures render the same policy.
gaps:
  - adopt: Human approval prioritizes consistent card comparison and allows long content to move behind an explicit disclosure.
  - reject: The common baseline is not an absolute maximum; accessibility, narrow layouts, and unusually long visible metadata may grow beyond it instead of clipping interactive content.
verdict: met
```

#### 2026-06-08 — `aspect:paper-card-presentation-consistency` shared repeated-paper card

```yaml
date: 2026-06-08
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-result-library-add-card-action
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:citation-lineage-card-data-hydration
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
  - acceptance-check:graph-neighbor-papers-card-data-hydration
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
acReviewedRevision:
  - 4
  - 6
  - 1
  - 1
  - 2
  - 2
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/server/services/__tests__/episteme-literature.test.ts; app/server/services/__tests__/graph-neighbor-papers.test.ts; app/components/research-route-renderers/__tests__/use-graph-neighbors-handler.test.tsx
runCommitSha: c96d1d891141
observedOutput: Search, citation-lineage, and graph-neighbor repeated paper cards share the same panel, title, venue/field metadata, author text, action row, pending detail frame, and inline-analysis placement; citation-lineage rows hydrate before storage while graph-neighbor lightweight rows keep the shared pending card and are replaced by batch metadata hydration.
gaps:
  - adopt: Citation-lineage and graph-neighbor repeated paper lists now use the shared paper-card handlers and visible hierarchy instead of surface-specific card grammars.
  - reject: Graph axis chips, citation direction headings, seed-paper cards, and representative-paper cards remain surface-specific context outside the repeated paper card body.
verdict: met
```

- Input: Search, citation-lineage, and graph-neighbors surfaces all render repeated paper candidates and must not drift into separate card grammars.
- Evidence: `CitationLineageView.graph-neighbors.test.tsx` now compares citation-direction and graph-neighbor repeated list cards against a direct search-result `SearchResultItem` fixture for panel class, title class, venue/field metadata, author text, action row, and inline-analysis placement, and also verifies graph-neighbor pending cards reuse the shared paper detail hydration frame. `episteme-literature.test.ts` locks citation-lineage relation-item hydration. `graph-neighbor-papers.test.ts` and `use-graph-neighbors-handler.test.tsx` lock the graph-neighbor fast-first-document path and background batch metadata replacement. `CitationLineageView.test.tsx`, `graph-neighbors-view.test.tsx`, and `search-result-item.graph-neighbors.test.tsx` cover seed/top-level context separation, seed-card removal from graph-neighbor pages, graph-neighbor page behavior, and search-card entry behavior.
- Gaps observed:
  - Adopt-resolved — citation-lineage and graph-neighbor views now pass through the same paper-card handlers and card component for PDF, citation, similar-paper, loading, and inline-analysis presentation; the parity evidence compares the visible card hierarchy rather than only checking action text or component reuse.
  - Reject — graph axis chips, citation direction headings, seed-paper cards, and representative-paper cards remain surface-specific context outside the shared card body because they are not repeated paper list cards.
- Verdict: met

#### 2026-06-29 — `aspect:paper-card-presentation-consistency` non-obvious trigger tooltip

```yaml
date: 2026-06-29
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 4
  - 1
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: be81fd52c5ab
observedOutput: Search-result, citation-lineage, and graph-neighbor repeated paper cards expose non-obvious title inspection through an app-rendered tooltip wired by aria-describedby, no native title tooltip, a visible disclosure signifier, hover/focus/expanded state, and the same low-emphasis tooltip grammar across surfaces.
gaps:
  - adopt: Title inspection now has app-rendered help text, visible chevron, focus/expanded state, and pointer-near hover placement without turning the explanation into a standalone callout.
  - reject: The aspect does not require custom tooltip replacement for already-clear buttons, chips, or secondary icons.
verdict: met
```

#### 2026-07-15 — `aspect:paper-card-presentation-consistency` query-only 다른 입장 후속 검색

```yaml
date: 2026-07-15
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 8
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/services/__tests__/search-execution-legacy-position.test.ts
runCommitSha: fedb6597+worktree
observedOutput: 검색 결과·인용 관계·비슷한 논문의 반복 카드가 같은 `다른 입장` handler와 plain/detached 동작을 유지한다. 모든 surface가 query-only destination을 만들고 출발 논문·입장·쟁점 provenance를 URL과 destination metadata로 운반하지 않는다.
gaps:
  - adopt: 카드 parity는 같은 query-only 후속 검색 의미까지 포함한다. surface별 provenance 운반 차이를 허용하지 않는다.
  - reject: 검색 결과를 실제 반박 논문으로 판정하거나 별도 provider API를 도입하는 의미는 추가하지 않는다.
verdict: met
```

- Historical note (2026-06-29): the then-current title-owned trigger used an
  app-rendered tooltip and visible chevron. The 2026-07-16 current review retires
  that model in favor of whole-card non-interactive-region disclosure, no visible
  command or inspection tooltip, and an icon-only accessible control.

#### 2026-08-21 — 반복 카드 metadata의 명시적 없음 상태

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 17
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbor-states.test.tsx; app/components/research-route-renderers/search-result-item.shared.tsx; docs/design-standards.md
runCommitSha: bab657eb08b4764256f015e561006a6e1e2e5876
observedOutput: 검색, 인용 관계, 비슷한 논문 surface가 공유하는 SearchResultItem은 metadata 유무와 관계없이 venue를 왼쪽 source 기준점에, `분야` 라벨과 분야 값을 오른쪽 taxonomy 기준점에 표시한다. 누락 값은 빈 여백 대신 낮은 강조도의 `출처 정보 없음`, `분야 정보 없음`으로 나타나며, 실제 metadata와 facet 값은 만들지 않는다. 기존 제목 utility는 실제 값이 있을 때만 렌더하는 규칙을 유지한다.
gaps:
  - adopt: 누락도 사용자가 같은 위치에서 판독할 수 있는 metadata 상태로 표현한다.
  - reject: 없음 상태를 chip이나 상호작용 가능한 필터 값으로 만들지 않는다.
verdict: met
```

#### 2026-08-25 — `aspect:paper-card-presentation-consistency` 저자 요약 서지 줄

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
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-author-byline.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색, 인용 관계, 비슷한 논문 surface의 반복 카드는 공유 SearchResultItem과 SearchResultAuthorByline을 사용해 venue·분야·첫 저자와 나머지 수를 같은 순서로 표시한다. 저자 요약을 선택하면 전체 저자 목록이 열리고 개별 저자 검색을 실행할 수 있으며, 이 동작은 카드 disclosure와 분리된다. aspect:paper-card-presentation-consistency verdict는 met이다.
gaps:
  - adopt: 공용 byline이 기본 저자 요약, 전체 목록, 개별 저자 검색을 한 곳에서 소유한다.
  - reject: surface별 저자 행이나 저자 수에 따라 늘어나는 기본 카드 높이를 만들지 않는다.
verdict: met
```

#### 2026-08-25 — `aspect:paper-card-presentation-consistency` 세 저자 기본 행

```yaml
date: 2026-08-25
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 21
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/search-result-item-spatial-stability.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/search-result-author-row.tsx; app/components/research-route-renderers/search-result-item.shared.tsx
runCommitSha: d571dc25baa8a39f18c6ec3eecadeba3f1096e4d
observedOutput: 검색 결과, 인용 관계, 비슷한 논문 surface의 반복 카드는 공유 SearchResultItem을 사용해 venue·분야 metadata 아래에 같은 저자 행을 렌더한다. 저자 행은 최대 세 명을 기본 표시하고, 나머지는 인라인으로 펼치거나 접는다. 각 저자 검색과 저자 펼침은 카드 disclosure와 분리된다. DOI/PDF/인용/비슷한 논문 액션 순서와 공통 인라인 분석 위치도 유지된다. aspect:paper-card-presentation-consistency verdict는 met이다.
gaps:
  - adopt: 모든 반복 논문 surface가 같은 metadata·저자 행 순서와 세 명 기본 표시를 사용한다.
  - reject: surface마다 저자 요약이나 펼침 방식을 다르게 만들지 않는다.
verdict: met
```

#### 2026-08-26 — `aspect:paper-card-presentation-consistency` 직접 노출 후속 검색

```yaml
date: 2026-08-26
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 11
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색 결과·인용 관계·비슷한 논문의 반복 카드는 카드 inspection 뒤 `다른 입장 탐색`을 별도 disclosure나 후보 card 없이 한 줄 안내와 최대 3개의 영어 query action으로 바로 보여 준다. 네 번째 후보는 렌더하지 않으며, 보이는 action은 기존 query-only 검색 이동을 공유한다.
gaps:
  - adopt: paper-card Aspect의 최신 Advice와 revision 11 AC를 같은 covering ledger row, 최대 3개 boundary fixture와 derived-card parity evidence로 다시 닫았다.
  - reject: 생성 payload·cache schema의 후보 설명과 근거 필드를 제거하거나 목적지 검색에 출발 provenance를 다시 싣지 않는다.
verdict: met
```
