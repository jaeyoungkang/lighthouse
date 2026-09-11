
# Inline Analysis — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [inline-analysis.ledger.yaml](../inline-analysis.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-17 — current analysis eligibility reaches every semantic consumer

```yaml
date: 2026-07-17
acs:
  - acceptance-check:inline-analysis-auto-run-db-cache-shown-immediately
  - acceptance-check:inline-analysis-auto-run-shared-cache-reuse
acReviewedRevision:
  - 1
  - 4
fixtureRef: app/server/domain-access/__tests__/inline-analysis-hydration.test.ts; app/server/services/__tests__/search-term-discovery.test.ts; app/server/services/__tests__/knowledge-map-base-builder.test.ts; app/components/research-route-renderers/__tests__/GraphNeighborsView.inline-analysis-terms.test.tsx; app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx
runCommitSha: c4eca6b3571f+worktree
observedOutput: 카드가 숨긴 legacy·fingerprint-free·failure-placeholder 분석을 비슷한 논문 query, 검색어 prompt와 method support, 관계 route 연구 용어, knowledge-map external signal이 다시 읽지 않는다. 공통 current-analysis predicate는 usable abstract까지 요구하고, 서버 hydration은 공백 초록에 남은 embedded analysis를 cache 조회 없이 제거한다. Current v8 분석은 기존 카드와 파생 소비자에서 그대로 유지된다.
gaps:
  - adopt: 서버 hydration은 canonical title·abstract·year fingerprint의 exact 일치를 계속 소유하고, shared client/server consumer는 version·fingerprint presence·failure·usable abstract라는 동일한 최소 자격을 적용한다.
  - reject: 생성 payload와 cache identity는 바뀌지 않았으므로 INLINE_ANALYSIS_VERSION은 8을 유지한다.
verdict: met
```

#### 2026-07-16 — card-owned inspection exposes dense triage without a visible command

```yaml
date: 2026-07-16
acs:
  - acceptance-check:inline-analysis-auto-run-expanded-triage-fields
  - acceptance-check:inline-analysis-auto-run-different-position-search
acReviewedRevision:
  - 2
  - 9
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx
runCommitSha: 29e123c6019b+worktree
observedOutput: The collapsed card shows at most two summary lines and hides the abstract-source badge. Clicking a non-interactive card region opens title, source, topic, method, result, and different-position detail; clicking it again closes the detail. The compact chevron remains an icon-only accessible control, while PDF, citation, similar-paper, author/topic/follow-up, and library actions do not toggle the card. No visible expand/collapse command or title-owned tooltip is rendered. Search, citation-lineage, and graph-neighbor cards keep the same query-only different-position routing after expansion.
gaps:
  - adopt: The title is identification text; the wider card surface owns pointer discovery and the icon-only control owns keyboard and assistive-technology disclosure semantics.
  - reject: Card expansion does not make nested actions part of the disclosure or claim full-paper evidence beyond the available abstract and metadata.
verdict: met
```

#### 2026-07-14 — relationship routes complete visible-card inline analysis

```yaml
date: 2026-07-14
acs:
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:inline-analysis-auto-run-visible-first-priority
acReviewedRevision:
  - 6
  - 9
fixtureRef: app/components/research/background-inline-analysis.ts; app/components/research-route-renderers/__tests__/CitationLineageView.inline-analysis-budget.test.tsx; app/components/research-route-renderers/__tests__/GraphNeighborsView.inline-analysis-terms.test.tsx; docs/runtime-flows/search-mechanism.md
runCommitSha: 5e5f634357ca
observedOutput: Citation-lineage and graph-neighbor views already built tasks from the first ten rendered cards per section or axis, but the background runner's current-cycle guard accepted only search documents and discarded relationship results. The guard now accepts all three inline-analysis route types while retaining execution, document, owner, metadata-type, and cycle identity checks. Integrated runner fixtures prove that the two five-paper waves apply analyses to the first ten rendered relationship cards while hidden cards eleven and twelve never enter the provider requests or progress map.
gaps:
  - adopt: Relationship routes share the existing route-owned current-cycle guard and persistence path; no parallel relationship-specific runner or state owner is added.
  - adopt: The first rendered ten cards per section or axis remain the eligibility window, while provider calls remain capped to five papers per wave.
  - reject: This repair does not add per-card IntersectionObserver tracking to relationship lists; their rendered list window remains the established exposure boundary.
verdict: met
```

#### 2026-06-10 — intent-check vocabulary re-grounded to the 요약/주제/방법/결과 card layout

```yaml
date: 2026-06-10
acs:
  - intent-check:semantic-profile-is-phrase-not-keyword
fixtureRef: app/server/services/__tests__/inline-analysis-intent-qualitative.live.test.tsx
runCommitSha: 318332b2
observedOutput: 2026-05-28 카드 개편(52772c99)이 claim을 항상 보이는 요약 줄로 옮기고 상세 영역을 주제/방법/결과로 바꾼 뒤에도 Intent Check question/answer criteria와 live 테스트 단정이 옛 주제·방법·주장 어휘를 유지해 야간 FULL_QUALITY가 5/28 이후 매일 같은 toContain(주장) 단정으로 실패했다. Intent 의미(키워드 나열 금지, 구절 수준 최소 2종)는 그대로 두고 필드 어휘만 현재 surface로 재접지한 뒤 live judge를 실행 — 렌더된 카드 DOM이 요약(주장 서술)·주제·방법·결과를 모두 구절 수준으로 전달하고 judge verdict met, unansweredCritical 없음, confidence high.
gaps:
  - adopt: live-only 단정은 PR gate(test:unit)에서 제외되므로 surface 어휘 변경 시 live 테스트와 Intent Check prose 동기화가 같은 변경에 포함되어야 한다는 운영 교훈을 이 엔트리에 기록.
  - reject: 카드 레이아웃 자체의 재검토는 범위 밖 — acceptance-check:inline-analysis-auto-run-expanded-triage-fields가 2026-05-28 리뷰에서 이미 닫았다.
verdict: met
```

- Judge evidence: `npx vitest run app/server/services/__tests__/inline-analysis-intent-qualitative.live.test.tsx`
- Runtime surface: actual rendered DOM (`SearchResultItem` → `InlineAnalysis`, detail expanded) from a real `analyzePapersInline` Gemini call
- Result: `met`
- Stability: 3 consecutive runs (verdict `met`, `unansweredCritical: []` each run)

#### 2026-06-09 — different-position follow-up parity on derived paper cards

```yaml
date: 2026-06-09
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
  - acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
acReviewedRevision:
  - 2
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx
runCommitSha: 5960c59ec8b7+worktree
observedOutput: Search result, citation-lineage, and graph-neighbors repeated paper cards now thread the same search-term handler through inline analysis. Clicking a `다른 입장` candidate from citation-lineage or graph-neighbor cards opens a new search tab with the candidate query and preserves `differentPositionSeed` metadata for the source paper, position, and debate axis.
gaps:
  - adopt: Previous evidence verified `다른 입장` only on the unit-level search result card; derived document cards reused the visual component but did not receive the handler prop.
  - adopt: Paper-card parity now covers inline-analysis follow-up behavior, not just visible action row text or PDF/인용/비슷한 논문 buttons.
  - reject: This remains a regular search follow-up; no provider-side stance/debate API is introduced here.
verdict: met
```

#### 2026-05-04 — Intent absorbed for 4 deterministic search promises

```yaml
date: 2026-05-04
acs:
  - acceptance-check:inline-analysis-auto-run-exposed-card-start
  - acceptance-check:inline-analysis-auto-run-visible-first-priority
  - acceptance-check:inline-analysis-auto-run-db-cache-shown-immediately
acReviewedRevision:
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/inline-analysis.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (cap 차단 + seed metadata + 탭 포커스). β Wovenness — 20 ACs (5+7+8) 모두 ledger Acceptance Checks 블록과 Coverage By Promise pointer로 wired.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

Historical ref: `historical:acceptance-check:inline-analysis-auto-run-partial-failure-retried`.

- Input: `promise:search-results-fast-window` (5 ACs), `promise:search-query-route-transition` (7 ACs), `promise:similar-papers-discovery` (8 ACs) — 모두 search 흐름의 surface mechanics을 잡는 deterministic 약속. Human Judgment Gate 결정 — 각 AC가 단일 store state · DOM presence · handler 호출 · helper return-value assertion으로 닫히고 emergent 속성 없음.
- Evidence: α Coverage — `search-result-item.test.tsx` (제목 PDF 등가 + disabled affordance), `ResearchBackgroundTasks.test.tsx` (in-flight cycle 교체), `SearchView.similar-paper.test.tsx` (cap 차단 + seed metadata + 탭 포커스). β Wovenness — 20 ACs (5+7+8) 모두 ledger Acceptance Checks 블록과 Coverage By Promise pointer로 wired.
- Gaps observed:
  - Adopt-resolved — 4 promises × 25 ACs absorbed. 본 IV 블록에 absorption pointer 박음.
  - Reject — γ Necessity (배너 시각감 / 결과 카드 위계) 평가는 verdict에 포함 안 함; future signal review으로 분리.
- Verdict: met

#### 2026-07-15 — `다른 입장` query-only 목적지와 #295 결정 반영

```yaml
date: 2026-07-15
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
  - acceptance-check:inline-analysis-auto-run-search-click-feedback
acReviewedRevision:
  - 8
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/services/__tests__/search-execution-legacy-position.test.ts; app/lib/__tests__/track.different-position.test.ts
runCommitSha: fedb6597+worktree
observedOutput: 검색 결과·인용 관계·비슷한 논문 카드의 `다른 입장` 후보는 같은 handler와 plain/detached navigation을 유지한다. 목적지 URL에는 후보 query, 일반 검색 조건, 제출 표면만 남는다. 출발 논문·입장·쟁점은 URL, search metadata, canonical execution identity에서 제거됐다. canonical click event는 출발 view·paper id와 query hash·length만 기록하고 raw query나 설명문을 싣지 않는다.
gaps:
  - adopt: #295 Human decision에 따라 생성 query를 독립 검색 조건으로 취급한다. legacy `position*` 파라미터가 들어와도 search identity와 metadata에 참여하지 않는 negative evidence를 추가했다.
  - adopt: query-only 목적지는 query와 현재 `personalize` preference/opt-out을 보존한다. 출발 카드의 provenance는 origin analytics를 넘어 destination 상태로 확장되지 않는다.
  - reject: 이 review는 별도 debate/stance provider API, 합성된 반박 판정, 검색어 최대 길이 정책을 추가하지 않는다.
verdict: met
```

#### 2026-08-21 — `다른 입장` 후속 검색의 retired basis 제거

```yaml
date: 2026-08-21
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
acReviewedRevision:
  - 10
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/services/__tests__/search-execution-legacy-position.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: d3365127e26aec3aa1f856926fb7e22b4b501baf
observedOutput: `다른 입장` 후보는 provider-ready query만 canonical `/search?q=` 조건으로 운반하고 출발 논문·입장·쟁점 provenance와 legacy selected libraryPaperIds, retired personalize 기준을 목적지 identity에서 제외한다. 라이브러리 source가 있으면 목적지 route가 통합 projection으로 자동 반영하고, 출발 상관관계는 origin analytics에만 남는다.
gaps:
  - adopt: query-only 목적지와 단일 결과 projection을 같은 후속 검색 경계로 정합한다.
  - reject: 출발 카드 provenance나 retired basis를 destination metadata로 확장하지 않는다.
verdict: met
```

#### 2026-08-25 — `다른 입장 탐색`의 직접 노출과 간결한 검색어 선택

```yaml
date: 2026-08-25
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
acReviewedRevision:
  - 11
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/server/services/__tests__/search-execution-legacy-position.test.ts; app/lib/__tests__/track.different-position.test.ts
runCommitSha: 76c357f992cd+worktree
observedOutput: 검색 결과·인용 관계·비슷한 논문의 반복 카드에서 `다른 입장 탐색`은 별도 접기나 후보 카드 없이 한 줄 설명과 최대 3개의 영어 검색어 선택으로 바로 보인다. 검색어를 누르면 기존 query-only `/search?q=` 이동과 canonical click analytics를 그대로 사용하며, 출발 논문·입장·쟁점 provenance는 목적지 상태로 확장하지 않는다.
gaps:
  - adopt: 후보의 존재와 검색어 선택이 같은 작은 후속 탐색 단위 안에서 직접 읽히도록 중첩 disclosure, 입장·쟁점·선정 이유·반복 근거 표시를 제거했다.
  - adopt: `quotedBasis`를 포함한 생성 payload와 cache/schema는 호환을 위해 보존하되 반복 카드의 세부 표시에서는 사용하지 않는다.
  - reject: 검색 결과를 실제 반박 논문으로 판정하거나 새 provider API·runtime response contract를 도입하지 않는다.
verdict: met
```

#### 2026-09-03 — `다른 입장 탐색`이 한계·반박 지점과 검색어별 설명을 보여 준다

```yaml
date: 2026-09-03
acs:
  - acceptance-check:inline-analysis-auto-run-different-position-search
acReviewedRevision:
  - 12
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.interactions.test.tsx; app/server/services/__tests__/inline-analysis-service.test.ts; app/lib/__tests__/schemas.different-position.test.ts; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx
runCommitSha: a6eb09862980+worktree
observedOutput: 반복 카드의 `다른 입장 탐색`은 일반 면책 문구 대신 이 논문의 한계·반박 지점 요약(`stanceProfile.limitations`)을 보여 주고, 요약이 null이면 그 줄을 생략한다. 최대 3개의 영어 검색어는 세로 목록으로 각각 한 줄 한국어 `rationale`과 함께 보이며, 4번째 후보와 그 설명은 렌더링되지 않는다. 검색어 클릭은 기존 query-only `/search?q=` 이동과 canonical click analytics를 그대로 쓴다. 생성 프롬프트는 abstract·PDF 경로 모두 `limitations` 1-2문장과 검색어별 한계·반박 지점 설명을 요구하고, 반박 논문의 존재를 단정하지 말라는 규칙을 유지한다. `INLINE_ANALYSIS_VERSION` 10으로 캐시가 재생성되며 구버전 payload는 `limitations: null`로 복원된다. provider API 교체 중이라 live 생성 출력은 이번 리뷰에서 확인하지 못했고, deterministic fixture와 prompt 문자열 검사만 근거다.
gaps:
  - adopt: 한계·반박 지점 요약과 검색어별 설명을 같은 작은 후속 탐색 단위 안에 카드·disclosure 없이 직접 보여 준다.
  - adopt: 입장·쟁점 축(`mainPosition`, `debateAxis`)은 payload에 보존하되 카드에는 계속 표시하지 않는다.
  - reject: 검색 결과를 실제 반박 논문으로 판정하거나 새 provider 호출·runtime response contract를 도입하지 않는다.
  - adopt: provider 교체 중이라 live 생성 출력은 이번 리뷰 밖이며, 교체가 끝나면 실제 출력에서 `limitations` 품질과 rationale의 한계 지점 연결을 다시 확인한다.
verdict: met
```
