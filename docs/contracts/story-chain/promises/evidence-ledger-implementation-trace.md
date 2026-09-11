---
id: promise:evidence-ledger-implementation-trace
slug: evidence-ledger-implementation-trace
title: Evidence Ledger → 실행 증거 추적
moment: moment:alignment-relation-observability
lane: admin
status: propagated
aspects:
  - aspect:admin-access-control
acceptanceChecks:
  - acceptance-check:evidence-ledger-implementation-trace-ledger-row-target-counts
  - acceptance-check:evidence-ledger-implementation-trace-run-check-target-exposure
  - acceptance-check:evidence-ledger-implementation-trace-internal-admin-domain
analyticsExempt: internal Evidence Ledger traceability is observed by evidence-ledger gates, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Evidence Ledger → 실행 증거 추적

## Promise

Evidence Ledger 문서에서 실행 명령과 app/ 증거까지 연결해 추적한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:evidence-ledger-implementation-trace-ledger-row-target-counts

- description: Evidence Ledger 행은 Source Promises, Applied Aspects, foundational 여부, run-check/execution/`app/` import target 수를 표시한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/alignment-audit.test.ts` ("traces a run check through a test file into imported app code"). Asserts a ledger's structured execution case resolves through its test file into imported app code, exposing Source Promises / policies / foundational flag and run/exec/import/missing target counts.

### acceptance-check:evidence-ledger-implementation-trace-run-check-target-exposure

- description: run-check 행은 명령문, execution target, `app/` import target, missing target을 그대로 노출한다.
- evidence: vitest @ `scripts/mission-control/lib/__tests__/alignment-audit.test.ts` ("reports a missing target from a structured execution") + ("traces a run check through a test file into imported app code"). The first asserts missing-target exposure; the second asserts execution + `app/` import target exposure on the run-check row.

### acceptance-check:evidence-ledger-implementation-trace-internal-admin-domain

- description: 어드민 페이지는 인증된 internal admin만 접근할 수 있고, internal admin은 `@corca.ai` 이메일로만 판정한다. 외부 초대 사용자 allowlist는 일반 접속만 허용하며 admin 권한을 주지 않는다.
- evidence: vitest @ `app/server/auth/__tests__/internal-admin.test.ts` ("treats @corca.ai emails as internal admins") + `app/server/auth/__tests__/access-policy.test.ts` ("allows internal users and exact external allowlist entries"). Asserts the internal admin gate's `@corca.ai` boundary and the separate external user allowlist; cross-cuts `aspect:admin-access-control`.
