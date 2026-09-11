---
id: promise:ac-trace-bidirectional-enforcement
slug: ac-trace-bidirectional-enforcement
title: Acceptance Check 추적 양방향 검증 (Promise ↔ Evidence Ledger)
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acceptanceChecks:
  - acceptance-check:ac-trace-bidirectional-enforcement-coverage-entries-parsed
  - acceptance-check:ac-trace-bidirectional-enforcement-mismatch-finding-emitted
  - acceptance-check:ac-trace-bidirectional-enforcement-mismatch-blocks-critical-gate
  - acceptance-check:ac-trace-bidirectional-enforcement-foundational-ledgers-exempt
analyticsExempt: internal governance traceability is observed by mc:validate-story-chain and evidence-ledger gates, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Acceptance Check 추적 양방향 검증 (Promise ↔ Evidence Ledger)

## Promise

Promise의 Acceptance Check와 YAML Evidence Ledger의 `acceptanceChecks`가 서로
맞는지 양방향으로 검증한다. 한쪽에만 선언되거나 완전한 key가 어긋나면 운영
게이트가 통과하지 못한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:ac-trace-bidirectional-enforcement-coverage-entries-parsed

- description: 정합성 파서는 YAML v2 `acceptanceChecks[].key`에서 Promise ref와 Acceptance Check ref를 한 번만 분해하고, 같은 구조화 그래프를 validator와 alignment audit에 전달한다.
- evidence: vitest @ `app/server/services/story-chain/__tests__/evidence-ledger-record.test.ts`와 `scripts/mission-control/lib/__tests__/alignment-audit.test.ts`. strict key parsing과 구조화 Story Chain graph 소비를 함께 확인한다.

### acceptance-check:ac-trace-bidirectional-enforcement-mismatch-finding-emitted

- description: Promise의 Acceptance Check에 대응하는 YAML 원장 entry가 없으면 `missing_ac_ledger` critical finding이 발생하고, 원장 key가 정본 Promise/Acceptance Check와 다르면 strict parser 또는 validator가 실패한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/alignment-audit.test.ts` (`missing_ac_ledger`)와 `app/server/services/story-chain/__tests__/loader-validator.test.ts`. Promise ↔ 원장 매핑 단절을 fail-closed로 검증한다.

### acceptance-check:ac-trace-bidirectional-enforcement-mismatch-blocks-critical-gate

- description: `missing_ac_ledger`와 strict Story Chain validation failure는 current-critical `mc:check-critical-findings` 및 `quality:contract`에 통합되어 Promise ↔ Evidence Ledger 불일치가 운영 게이트를 차단한다.
- evidence: 조합 검증. `missing_ac_ledger`는 표준 `buildAlignmentFindings` collector를 통과하고, `partitionAlignmentFindings`(`scripts/mission-control/lib/__tests__/baseline-check.test.ts`)는 이 category를 다른 critical과 동일한 blocking group으로 분류한다.

### acceptance-check:ac-trace-bidirectional-enforcement-foundational-ledgers-exempt

- description: `evidence-ledgers/foundational/*.md`는 실행 원장이 아니라 프로세스 설명 정본이므로 YAML loader와 Promise ↔ Acceptance Check 매핑에서 제외된다.
- evidence: vitest @ `app/server/services/story-chain/__tests__/loader-review-ownership.test.ts`와 `scripts/mission-control/lib/__tests__/alignment-audit.test.ts` (`does not treat foundational Markdown as Acceptance Check evidence`).
