---
id: promise:hardening-tier-policy
slug: hardening-tier-policy
title: Hardening tier 발동 정책 (mutation · negative · fuzz)
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:hardening-tier-policy-critical-path-criteria
  - acceptance-check:hardening-tier-policy-manual-mutation-lane
  - acceptance-check:hardening-tier-policy-negative-test-trigger
  - acceptance-check:hardening-tier-policy-fuzz-trigger
analyticsExempt: internal hardening policy is observed by quality gates and CI, not product analytics
verdict: met
---

Prior CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
Schedule-removal CAIR record: `docs/ci-structure.md#contract-architecture-impact-review`
Propagation Map: `docs/ci-structure.md#propagation-map`

# Hardening tier 발동 정책

## Promise

특정 ledger가 mutation testing, co-located negative test, property-based fixture
중 어느 것을 추가해야 하는지에 대한 발동 기준이 정본 위치에 공개된다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:hardening-tier-policy-critical-path-criteria

- description: `docs/contracts/story-chain/hardening-tier-policy.md` 정본
  문서에 critical-path AC 정의가 한 단락으로 적혀 있다 — invariant가 한 줄에
  박혀 있고 깨지면 사용자가 즉시 다치는 종류 (예: 숫자 boundary, 데이터 손실
  여부, 보안 경계).
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:hardening-tier-policy-manual-mutation-lane

- description: mutation testing(#1)은 critical-path AC가 모인 runtime
  contract slice pilot에서 시작하고, 안정화된 slice를 같은 수동 실행 lane에서
  넓힌다. 현재 pilot은 `promise:respond-contract-mutation-pilot`이 소유한다.
  예약·PR·push 실행은 두지 않아 PR 게이트와 비용 경로를 섞지 않는다. ledger
  row에 `mutationScore: ≥ N%` 표기가 있을 때 그 AC는 mutation tier 적용 상태로
  본다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:hardening-tier-policy-negative-test-trigger

- description: co-located negative test(#2)는 critical-path *숫자 boundary*
  AC에 우선 적용된다 — 예: search-results-fast-window AC1의 "정확히 10편"
  같은 invariant. 정책 문서가 적용 ledger 후보를 나열한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:hardening-tier-policy-fuzz-trigger

- description: property-based fixture(#6)는 deterministic helper / route 레벨
  ledger에 우선 적용한다 (예: `citation-lineage.helpers`, `route.test`). live
  LLM judge에는 비용 사유로 도입하지 않는다 — 정책 문서가 명시한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747
