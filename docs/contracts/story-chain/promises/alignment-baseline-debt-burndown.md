---
id: promise:alignment-baseline-debt-burndown
slug: alignment-baseline-debt-burndown
title: alignment critical zero gate
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acceptanceChecks:
  - acceptance-check:alignment-baseline-debt-burndown-staged-fast-skip-on-unrelated-paths
  - acceptance-check:alignment-baseline-debt-burndown-exit-on-current-criticals
  - acceptance-check:alignment-baseline-debt-burndown-warning-nonblocking
analyticsExempt: internal alignment critical findings are observed by alignment audit and mc:status, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# alignment critical zero gate

## Promise

alignment 정합성 critical finding은 현재 snapshot에 하나도 남기지 않는다.
warning은 운영자가 볼 수 있게 드러내되 commit/push를 막지는 않는다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:alignment-baseline-debt-burndown-staged-fast-skip-on-unrelated-paths

- description: `mc:check-critical-findings -- --staged`는 staged file이 alignment 정본(`docs/contracts/story-chain/`, Evidence Ledger YAML v2, `docs/contracts/story-chain/scenario-catalog.md`, `scripts/mission-control/lib/alignment-audit*`, `app/server/services/story-chain/`, `scripts/mission-control/`, `package.json`, `principles.md`, `mission-control.md`, `.husky/`, `.github/workflows/`)과 무관할 때 fast-skip 메시지와 함께 exit 0 한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/baseline-check.test.ts` (`describe("affectsAlignmentFiles")`). Asserts the alignment-file path classifier matches Story Chain promise / aspect / Evidence Ledger YAML files and gate/policy file changes; rejects unrelated app code or empty staging — the predicate that drives `mc:check-critical-findings -- --staged` fast-skip.

### acceptance-check:alignment-baseline-debt-burndown-exit-on-current-criticals

- description: `mc:check-critical-findings`는 현재 alignment snapshot의 critical finding이 1개 이상이면 exit 1 한다. baseline과 신규 여부를 나누지 않는다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/baseline-check.test.ts` (`describe("partitionAlignmentFindings")`) + CLI run `npm run mc:check-critical-findings`. Asserts critical findings are partitioned as blocking findings and the clean current snapshot exits 0.

### acceptance-check:alignment-baseline-debt-burndown-warning-nonblocking

- description: warning finding은 alignment output에 표시되지만 release를 막지는 않는다. warning을 critical처럼 baseline에 고정하거나 carry-over로 분리하지 않는다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/baseline-check.test.ts` (`describe("partitionAlignmentFindings")`). Asserts warning findings are partitioned separately from current critical findings.
