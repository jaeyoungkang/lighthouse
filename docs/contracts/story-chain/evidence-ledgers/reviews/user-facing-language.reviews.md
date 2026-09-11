
# User-Facing Language — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[user-facing-language.ledger.yaml](../user-facing-language.ledger.yaml). The ledger
keeps executable coverage and the review pointer; release and Mission Control
readers treat this file as part of the same Evidence Ledger review source.

### Sufficiency Review

Dated log of judging the language governance Aspect against rendered fixed copy
and generated-copy evidence.

#### 2026-07-27 — invited-access fixed copy joins the governed language track

```yaml
date: 2026-07-27
acs:
  - acceptance-check:search-results-fast-window-result-basis-visible
  - acceptance-check:reaction-respond-format
  - intent-check:result-set-terrain-is-not-query-repetition
  - acceptance-check:invited-user-access-management-admin-surface
acReviewedRevision:
  - 17
  - 1
  - 1
fixtureRef: scripts/mission-control/check-message-registry-contract.ts; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts; app/admin/__tests__/admin-access.test.tsx; app/api/auth/magic-link/__tests__/route.test.ts
runCommitSha: 6e3ac3829439+worktree
observedOutput: The aspect:user-facing-language-governance fixed and generated tracks remain current for search result-basis and terrain prose. The fixed-copy registry additionally assigns the guarded admin surface and the magic-link DB-decision failure message to promise:invited-user-access-management. Rendered admin evidence covers list, add, remove, empty, load-failure, and save-failure copy; the magic-link route evidence covers the fail-closed retry message without leaking an internal error.
gaps:
  - adopt: The admin surface uses admin.access.* while the auth failure uses invitedAccess.*; both namespaces share the invited-access Promise owner and both language Aspects.
  - reject: The DB decision failure does not inherit the broad search-results auth/onboarding owner merely because it appears during magic-link issuance.
verdict: met
```

- Verdict: met

#### 2026-05-21 — `aspect:user-facing-language-governance` fixed and generated language tracks

```yaml
date: 2026-05-21
acs:
  - acceptance-check:search-results-fast-window-result-basis-visible
  - acceptance-check:reaction-respond-format
  - intent-check:result-set-terrain-is-not-query-repetition
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/__tests__/lobby-onboarding.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.test.tsx; app/about/__tests__/changes-page.test.tsx; app/server/services/__tests__/search-awareness-intent-qualitative.live.test.ts
runCommitSha: 189a233c4ec6
observedOutput: Historical fixed-copy evidence: tests covered the then-current source explanation, search, and changelog language tracks, while generated-copy search reactions remained covered by the existing structured-generation/live-judge path under aspect:user-facing-language-governance. Current Scholar naming is reviewed on the search-entry result-basis surface.
gaps:
  - adopt: Fixed-copy surfaces now route through i18n and rendered DOM or tone tests under aspect:user-facing-language-governance.
  - adopt: Generated search reaction prose stays in the structured-generation/live-judge track instead of being governed by static copy rules.
  - reject: Historical decision-log diff snippets and archived source-name wording remain exact dated evidence and are not rewritten as current product copy.
verdict: met
```

- Input: Human direction on 2026-05-21: 고정 문구와 생성 문구 관리 트랙을 별도로
  둔다. 사용자에게 전달되는 모든 말은 해당 Aspect의 영향을 받아야 한다.
- Evidence: α Fixed-copy track — search empty state and public
  changelog tests lock rendered Korean prose. β Generated-copy track — existing
  structured generation contract and live judge path lock generated search reaction prose.
  γ Wovenness — the current trust-source surfaces are woven into
  `aspect:user-facing-language-governance`, and existing generated search prose
  remains under the runtime structured generation path rather than a static-copy rule.
- Gaps observed:
  - Adopt-resolved — the contract now has a top-level language governance
    Aspect instead of stretching `aspect:visible-explanation-sufficiency`.
  - Adopt-resolved — the current visible issue, search trust wording,
    is covered by fixed-copy evidence.
  - Reject — archived decision-log diff snippets keep archived raw diff
    evidence and are not interpreted as current product copy.
- Verdict: met
