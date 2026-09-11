# Research Route Content Width Governance — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [document-content-width-governance.ledger.yaml](../document-content-width-governance.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Retired Acceptance Check history

`acceptance-check:route-view-ai-comment-inline-surface-inline-content-flow`는
2026-07-16에 철회했다. 이 AC가 소유하던 “본문을 기본 자연 높이로 표시” 규칙은
자동 생성 완료 때 content rail을 크게 미는 동작과 충돌했다. inline rail과 읽기
폭은 기존 `embedded-content-rail`·`responsive-flow` AC가 계속 소유하고,
접힌 미리보기와 명시적 펼침은
`acceptance-check:route-view-ai-comment-inline-surface-bounded-preview-flow`가
대체한다. 호환 방침은 `remove`다. 저장 데이터, URL, API, storage schema,
analytics event와 호환해야 할 자원은 없으며 기본 자연 높이 presentation과 그
전용 기대만 제거한다. inline rail과 읽기 폭은 그대로 보존한다. 2026-06-22의
원본 review는 아래 historical text에 수정 없이 보존한다.

### Sufficiency Review

#### 2026-06-23 — `aspect:document-content-width-governance` generalizes document rail width

```yaml
date: 2026-06-23
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-responsive-flow
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx
runCommitSha: c8a020705ba5
observedOutput: aspect:document-content-width-governance replaces the old narrow overlay rule with a shared ResearchRoutePayload width policy. This ledger verifies that inline reactions stay inside the owning ResearchRoutePayload rail without sidecar/overlay fallback or parent-rail widening. Search route width evidence is owned by search-result-window.ledger.md, citation-lineage by citation-lineage.ledger.md, graph-neighbor rails by graph-neighbor-papers.ledger.md, and gap view rails by gap-report-surface.ledger.md.
gaps:
  - adopt: Human direction explicitly approved generalizing the width rule into an Aspect and replacing outdated overlay-era wording.
  - reject: Pixel-level visual regression remains outside this evidence tier; this review locks semantic DOM/class contracts and existing component evidence.
verdict: met
```

### Historical Retired Review Notes

The following dated notes preserve the original review records for retired
desktop/view-mode Acceptance Checks. They are intentionally stored as historical
text rather than parsed Sufficiency Review YAML because those retired AC ids no
longer resolve in the current Story Chain.

**2026-06-22 — reactions move into ResearchRoutePayload content rails**

```text
date: 2026-06-22
acs:
  - acceptance-check:route-view-ai-comment-inline-surface-embedded-content-rail
  - acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view
  - acceptance-check:route-view-ai-comment-inline-surface-inline-content-flow
  - acceptance-check:route-view-ai-comment-inline-surface-title-body-only
  - acceptance-check:route-view-ai-comment-inline-surface-exempt-initial-search-and-gap-network
  - acceptance-check:route-view-ai-comment-inline-surface-responsive-flow
  - acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx; app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx
runCommitSha: e1e5fa6f4d43
observedOutput: Reactions for search, citation lineage, and graph-neighbor ResearchRoutePayloads render as `research-route-inline-reaction` inside the owning ResearchRoutePayload content rail before the ResearchRoutePayload body, use the inline reaction renderer, and keep the visible frame on the host AI comment treatment. The reaction remains scoped to the active ResearchRoutePayload, renders follow-up surfaces in the same inline slot, stays inline on narrow viewports and narrow content rails, stays absent for the first empty search screen and gap-network ResearchRoutePayloads, shows pending only while an expected comment can still arrive, and exits failed/stopped pending states through an owning terminal reaction.
gaps:
  - adopt: Human feedback moved AI reactions from sidecar/overlay/comment chrome into each owning ResearchRoutePayload while preserving ResearchRoutePayload-scoped reaction history, follow-up surfaces, and feedback provenance.
  - reject: This review does not preserve the old collapsed preview/unseen accent affordance because the accepted product direction removes the floating AI comment card.
verdict: met
```

**2026-06-02 — desktop overlay search-input clearance + scroll current verdict**

```text
date: 2026-06-02
acs:
  - acceptance-check:desktop-overlay-reaction-cards-overlay-position-top-right
acReviewedRevision:
  - 2
fixtureRef: app/components/research/__tests__/ResearchRouteLayout.view-mode.test.tsx; app/components/research/__tests__/AgentPanel.test.tsx
runCommitSha: 3feb0cc770fe
observedOutput: 데스크톱 멀티 도큐먼트 모드에서 검색 문서의 AI comment overlay는 `data-overlay-offset="below-search-input"`과 `top-36 right-4` 배치를 써서 재검색 입력과 toolbar 위를 덮지 않는다. PDF 같은 읽기 문서는 기존 `top-10 right-4` top-right 배치를 유지한다. 펼친 overlay 카드에는 `--agent-panel-max-height` 기반 max-height가 적용되고, 본문 영역은 `agent-panel-scroll-body`의 `overflow-y-auto`로 스크롤된다.
gaps:
  - adopt: jsdom은 실제 픽셀 높이와 스크롤바를 계산하지 않으므로 deterministic evidence는 class/data attribute 구조를 잠근다. 실제 브라우저 확인은 별도 수동/브라우저 QA로 보강할 수 있다.
verdict: met
```

**2026-05-03 — `aspect:responsive-narrow-viewport-collapse` 신설 + scope 축소**

```text
date: 2026-05-03
acs:
  - acceptance-check:desktop-horizontal-layout-horizontal-equal-page-layout
  - acceptance-check:desktop-horizontal-layout-responsive-page-width
  - acceptance-check:desktop-horizontal-layout-border-separates-pages
  - acceptance-check:desktop-overlay-reaction-cards-overlay-position-top-right
  - acceptance-check:desktop-overlay-reaction-cards-reactions-scoped-per-document
  - acceptance-check:desktop-overlay-reaction-cards-ikeda-shape-no-speech-bubble
  - acceptance-check:desktop-overlay-reaction-cards-preview-card-toggle-with-unseen-accent
  - acceptance-check:desktop-overlay-reaction-cards-renders-all-reaction-surfaces
  - acceptance-check:desktop-overlay-reaction-cards-exempt-initial-search-and-gap-network
  - acceptance-check:tab-vs-desktop-viewmode-single-toggle-with-current-label
  - acceptance-check:tab-vs-desktop-viewmode-toggle-persisted-to-localstorage
  - acceptance-check:tab-vs-desktop-viewmode-restored-from-localstorage-with-ssr-default
  - acceptance-check:tab-vs-desktop-viewmode-tabstrip-hidden-in-desktop
  - acceptance-check:tab-vs-desktop-viewmode-empty-search-fallback-to-tabs
  - acceptance-check:tab-vs-desktop-viewmode-narrow-tab-falls-back-to-overlay
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/document-content-width-governance.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `Narrow Viewport Overlay Collapse` run:shell locks tab-mode overlay transition deterministically; the existing desktop-overlay-reaction-cards run:shell rows keep overlay visual contracts (`border-l-4`, preview toggle, unseen accent) bound to their semantic acceptance-check slugs. β Wovenness — `validateStoryChain` confirms bidirectional weaving between `aspect:responsive-narrow-viewport-collapse` and the 2 covered promises.
gaps:
  - adopt: Existing prose evidence below is preserved and now attached to current Story Chain Acceptance Check refs.
  - reject: Retired historical Promise, Aspect, and Intent refs are excluded from this converted review.
verdict: met
```

- Input: cross-cutting aspect 추가 — appliesTo = 2 promises (`tab-vs-desktop-viewmode`, `desktop-overlay-reaction-cards`); coveringLedger = this file. 추가된 AC: `tab-vs-desktop-viewmode-ac6` (탭 모드 + narrow에서 overlay 전환), `desktop-overlay-reaction-cards-ac7` (overlay trigger를 narrow viewport까지 확장). 초안에 포함됐던 `desktop-horizontal-layout-ac5` (데스크톱 multi→single collapse)는 사용자 normative judgement으로 같은 PR 안에서 철회 — 데스크톱 multi-doc 가로 나열 자체는 collapse 대상이 아니며(`w-full` 기본값이 narrow에서 viewport 채우고 가로 스크롤 보존), aspect는 overlay 약속에만 한정한다.
- Evidence (α Coverage): `Narrow Viewport Overlay Collapse` run:shell이 탭 모드 overlay 전환을 deterministic 잠금. overlay 시각 약속(`border-l-4`, preview 토글, unseen 강조)은 기존 AC1-AC6 run:shell이 유지.
- Evidence (β Wovenness): `validateStoryChain`이 promise ↔ aspect 양방향 weaving 검증 — 2 promise 모두 frontmatter `aspects:`에 `aspect:responsive-narrow-viewport-collapse` 선언, aspect 파일 `appliesTo`에 2 promise 모두 명시.
- Gaps observed:
  - Adopt-resolved — aspect 신설 + 2 promise mode (c) AC 추가 + Evidence Ledger Acceptance Checks/run:shell 동시 추가.
  - Reject — 데스크톱 multi-doc collapse는 over-engineering으로 판정, scope 축소.
  - Reject — 1024px breakpoint은 Tailwind `lg:` 분기점과 일치시켜 추가 token 도입 불필요.
- Verdict: met
