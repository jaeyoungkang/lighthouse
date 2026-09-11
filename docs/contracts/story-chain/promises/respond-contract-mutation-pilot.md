---
id: promise:respond-contract-mutation-pilot
slug: respond-contract-mutation-pilot
title: runtime contract mutation testing pilot (작동층)
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:respond-contract-mutation-pilot-stryker-wired
  - acceptance-check:respond-contract-mutation-pilot-manual-isolation
  - acceptance-check:respond-contract-mutation-pilot-baseline-tracking
analyticsExempt: internal mutation pilot is observed by mutation CI and evidence gates, not product analytics
verdict: met
---

Prior CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
Schedule-removal CAIR record: `docs/ci-structure.md#contract-architecture-impact-review`
Propagation Map: `docs/ci-structure.md#propagation-map`

# runtime contract mutation testing pilot

## Promise

`promise:hardening-tier-policy` AC `manual-mutation-lane`이 정책으로 박은
mutation tier가 *실제로 작동*한다. 현재 pilot은 route-view AI comment
generation boundary와 deterministic runtime guard, analytics contracts,
domain access, research route payload store invariants를 운영자가 수동으로
시작하는 mutation slice 묶음으로 실행한다. Stryker가 코드를 변형하고 vitest가
통과 여부를 보고한다. 첫 pilot의 historical baseline marker는 비교 증거로
유지한다. 예약·PR·push 실행은 두지 않아 PR gate 시간 예산을 침범하지 않는다.

원래 목적: vitest가 통과해도 본문이 tautology면 못 잡는다. Mutation은
실제 코드 경로를 변형해 느리고 좁지만 결정적인 검증을 제공한다. 이 Promise는
그 검증을 structured route-view generation, generation gateway, client scheduling,
analytics event contract, domain-access guard, research route payload store helper
같은 runtime contract 경계로 넓힌다.

## Intent Checks

명시적 Intent Check는 없다. Stryker config + 수동 workflow + ledger
baseline 표기 자체가 pilot의 contract다.

## Acceptance Checks

### acceptance-check:respond-contract-mutation-pilot-stryker-wired

- description: `npm run mutation`은 agent 기본 slice를 실행하고,
  `npm run mutation:all`은 agent / contracts / domain / research route payload
  slice를 모두 실행한다. 각 slice는 `stryker.*.config.mjs`를 읽고
  runtime contract 파일들을 mutate 대상으로, vitest를 test runner로
  실행한다. `coverageAnalysis: perTest`로 test 단위에서 mutation을
  평가하고 HTML / JSON 리포트를 `reports/mutation/<slice>/`에 떨군다.
  devDependency `@stryker-mutator/core`와 `@stryker-mutator/vitest-runner`가
  `package.json`에 박혀있다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:respond-contract-mutation-pilot-manual-isolation

- description: mutation 실행은 운영자가 명시적으로 시작할 때만 열린다.
  `.github/workflows/mutation.yml`은 `workflow_dispatch`만 갖고 `schedule`, PR,
  push 트리거는 갖지 않는다. PR gate(`quality.yml`)는 mutation 명령을 호출하지
  않는다. workflow는 4개 mutation slice
  (agent / contracts / domain / research route payload)를 matrix로 병렬 실행해
  각 slice가 독립 runner와 독립 timeout cap을 갖고, mutation 리포트는
  slice당 `actions/upload-artifact@v4`로 보존한다 — 한 slice가 늘어도
  전체 wall-clock과 timeout 마진이 sequential 합산처럼 부풀지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:respond-contract-mutation-pilot-baseline-tracking

- description: 첫 mutation pilot에서 남긴 historical baseline marker에
  `mutationScore: ≥ N%` 표기가 박혀 있고 각 `stryker.*.config.mjs`
  slice의 `thresholds.break`에도 threshold가 박혀 있어야 한다 — ledger
  주장과 실제 게이트가 어긋나면 안 된다. N의 첫 값은 50%
  (baseline 관측 57.14% − 7%p 버퍼, 2026-05-07)이고, 2026-05-09 expanded
  slice의 첫 로컬 baseline은 55.85%, 후속 hardening + cost-control
  baseline은 61.87%였고, 2026-05-11 agent slice hardening 후 로컬 score는
  72.99%다. 새 baseline이 안정화될 때까지 N은 50%로 유지한다. N 상향은
  ledger와 정책 문서(`hardening-tier-policy.md` §2), config를 동시에
  갱신하는 방식으로만 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 5

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747
