---
id: promise:release-verdict-aspect-integration
slug: release-verdict-aspect-integration
title: Release verdict에 Aspect·서비스 정책 차원 통합
moment: moment:release-verdict-aspect-tier
lane: admin
status: propagated
acceptanceChecks:
  - acceptance-check:release-verdict-aspect-integration-four-dimension-shape
  - acceptance-check:release-verdict-aspect-integration-aspect-verdict-from-covering-review
  - acceptance-check:release-verdict-aspect-integration-aspect-finding-categories-block-release
  - acceptance-check:release-verdict-aspect-integration-cli-axis-cluster-grouping
analyticsExempt: internal release verdict integration is observed by mc:status, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/696#issuecomment-5433661399

# Release verdict에 Aspect·서비스 정책 차원 통합

## Promise

Release verdict에 Aspect와 core-product 서비스 정책 coverage를 따로 보여 주고,
종단 계약·서비스 정책·횡단 상태가 함께 반영되게 한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:release-verdict-aspect-integration-four-dimension-shape

- description: `mc:status`는 Promise 의도, Acceptance Check trace, core-product 서비스 정책 coverage, Aspect를 서로 구분된 네 release 차원으로 계산하고 표시한다. Service Policy Coverage Review가 `unresolved`이면 나머지 차원이 모두 met여도 release는 blocked다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/release-verdict.test.ts` ("blocks service policy coverage while a core-product Experience is unresolved"; "renders the Release status (ready when green, blocked when any dimension blocked)"). The sample report and formatter compile against the CLI-owned type in `scripts/mission-control/lib/release-verdict.ts`.
- revision: 2

### acceptance-check:release-verdict-aspect-integration-aspect-verdict-from-covering-review

- description: `computeReleaseVerdict()`는 모든 `kind: aspect` Aspect의 covering ledger §5 Sufficiency Review에서 aspectRef를 명시한 최신 dated entry의 verdict를 직접 읽어 met/not-met/unknown/unverified 4-state로 분류한다 — Intent verdict가 US Intent Check Sufficiency Review를 읽는 패턴과 평행 (`docs/mission-control.md §5` AOP own verdict).
- evidence: vitest @ `scripts/mission-control/lib/__tests__/aspect-verdict.test.ts` (`describe("extractLatestAspectReview")`). Asserts the per-Aspect §5 review extractor invoked by `computeReleaseVerdict` via `buildAspectVerdictReport` — picks the latest dated entry naming the aspectRef, classifies status, isolates entries across multiple Aspects, and defaults to unknown when the Verdict line is absent.

### acceptance-check:release-verdict-aspect-integration-aspect-finding-categories-block-release

- description: alignment audit이 finding category 3종(`aspect_verdict_unverified` / `aspect_verdict_not_met` / `aspect_verdict_unknown`)을 critical severity로 emit하여 current-critical gate에 자동 통합된다 — Aspect verdict 깨짐이 release를 자동 차단한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/aspect-finding.test.ts` (`describe("buildAlignmentFindings — Aspect verdict integration (promise:release-verdict-aspect-integration AC4)")`). Asserts `buildAlignmentFindings` emits `aspect_verdict_unverified` / `aspect_verdict_not_met` / `aspect_verdict_unknown` critical findings when an Aspect's covering-ledger §5 review is missing or non-met, and emits none when every Aspect is met. Implementation lives in `scripts/mission-control/lib/alignment-audit/findings.ts`.

### acceptance-check:release-verdict-aspect-integration-cli-axis-cluster-grouping

- description: `formatReleaseVerdict`는 Intent verdict와 AC trace를 종단축으로, Service Policy Coverage를 구성 전 정책 상태로, Aspect를 횡단축으로 구분해 표시하고 어느 차원 하나라도 blocked면 Release를 blocked로 통합한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/release-verdict.test.ts` ("groups dimensions into 종단축, 서비스 정책, and 횡단축 cluster headers"; "renders the Release status (ready when green, blocked when any dimension blocked)").
- revision: 2
