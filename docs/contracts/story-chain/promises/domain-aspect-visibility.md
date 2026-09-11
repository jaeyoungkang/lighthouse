---
id: promise:domain-aspect-visibility
slug: domain-aspect-visibility
title: Mission Control에서 도메인 Aspect 상태를 읽는다
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acceptanceChecks:
  - acceptance-check:domain-aspect-visibility-aspect-rows-emitted-in-snapshot
analyticsExempt: internal aspect visibility is observed by the mc:status CLI, not product analytics
verdict: met
---

# Mission Control에서 도메인 Aspect 상태를 읽는다

## Promise

Mission Control snapshot과 release verdict가 Promise에 적용되는 Aspect와
각 Aspect의 검증 상태를 함께 읽는다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:domain-aspect-visibility-aspect-rows-emitted-in-snapshot

- description: `buildIntentTraceabilitySnapshot`은 Story Chain에서 도메인 Aspect row를 별도 collection으로 emit한다 (`id` · `title` · `kind` · `appliesTo` · `coveringLedger`).
- evidence: vitest @ `scripts/mission-control/lib/__tests__/intent-traceability-snapshot.test.ts` ("emits Aspect rows from the Story Chain bridge"). Asserts `buildIntentTraceabilitySnapshot` emits a separate `aspects` collection with id / appliesTo / coveringLedger / verdict exposed for the CLI-owned snapshot.
