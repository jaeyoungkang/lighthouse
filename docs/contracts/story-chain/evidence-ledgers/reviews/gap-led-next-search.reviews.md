# Gap-led Next Search — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [gap-led-next-search.ledger.yaml](../gap-led-next-search.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-07-14 — gap seed paper-search button acknowledges navigation immediately

```yaml
date: 2026-07-14
acs:
  - acceptance-check:gap-led-next-search-click-feedback
acReviewedRevision:
  - 3
fixtureRef: app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkFocusedSelectionSummary.feedback.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.gap-led-next-search.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: 5e5f634357ca
observedOutput: The focused cluster, concept, and gap `[seed] 으로 논문 검색` control derives its busy state from the same shell activation as the persistent receipt. A plain click through the production search-term handler immediately adds a rotating indicator, `aria-busy=true`, and disabled state to the clicked control while preserving the report and selected seed receipt. Full target-route matching, including personalization, library context, and term-seed parameters, prevents another same-query activation from locking the gap control. Modifier and middle clicks keep opening a detached tab without changing the current button or receipt.
gaps:
  - adopt: The clicked gap seed control now acknowledges the action directly during the destination transition.
  - reject: The control does not replace the gap report or claim ownership of provider progress.
verdict: met
```

#### 2026-06-29 — seed search preserves internal basis without selected anchors

```yaml
date: 2026-06-29
acs:
  - acceptance-check:gap-led-next-search-seed-launches-search
acReviewedRevision:
  - 2
fixtureRef: app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.gap-led-next-search.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: 14cd7ec44c52
observedOutput: Focused cluster and gap cards keep the explicit seed-as-search button as the only trigger. Clicking the button sends the label through the shared search-term handler and route-owned reserve flow. The reserve payload does not carry legacy selected libraryPaperIds; when internal reviewed_papers context exists, it preserves the current personalize preference or personalize:false opt-out. The click still emits product.gap_led_next_search.clicked.
gaps:
  - adopt: Gap-led seed searches now share the internal reviewed_papers basis rule with route and keyword follow-up searches.
  - reject: This does not restore selected Moonlight library anchors or URL library params.
verdict: met
```

#### 2026-06-26 — gap-led seed search preserves library basis

```yaml
date: 2026-06-26
acs:
  - acceptance-check:gap-led-next-search-seed-launches-search
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.gap-led-next-search.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx
runCommitSha: 45033b701ea6+worktree
observedOutput: Focused cluster and gap cards keep the explicit seed-as-search button as the only trigger: selecting a node does not launch search. Clicking the button sends the cluster label or gap display label through the shared search-term handler and route-owned reserve flow. The reserve payload preserves the selected library fingerprint and carries `personalize=false` when the reader is on `검색어 기준`, without putting library anchors in URL params; the same click still emits `product.gap_led_next_search.clicked`.
gaps:
  - adopt: Gap-led seed searches now use the same route-owned library basis preservation as keyword follow-up search.
  - reject: This does not add hidden URL params for gap provenance; seed provenance remains owned by the gap report and analytics event.
verdict: met
```

#### 2026-08-21 — gap seed 후속 검색의 retired basis 제거

```yaml
date: 2026-08-21
acs:
  - acceptance-check:gap-led-next-search-seed-launches-search
acReviewedRevision:
  - 3
fixtureRef: app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.gap-led-next-search.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: d3365127e26aec3aa1f856926fb7e22b4b501baf
observedOutput: Focused cluster와 gap의 명시적 seed 검색 버튼은 seedTerm을 canonical `/search?q=` 조건으로 전달한다. 현재 writer는 legacy selected libraryPaperIds와 retired personalize 기준을 싣지 않으며, 목적지 route가 현재 라이브러리 source를 검색어 관련도와 함께 통합 projection으로 자동 반영한다.
gaps:
  - adopt: 후속 검색 계약을 현재 단일 결과 projection과 일치시킨다.
  - reject: 과거 personalize preference나 basis 선택을 후속 URL에 되살리지 않는다.
verdict: met
```
