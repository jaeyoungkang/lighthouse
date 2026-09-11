# Gap Build Principal Admission — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[gap-build-principal-admission.ledger.yaml](../gap-build-principal-admission.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-08-13 — aspect:gap-build-principal-admission current verdict

```yaml
date: 2026-08-13
acs:
  - acceptance-check:gap-network-detection-from-search-principal-build-limit
  - acceptance-check:gap-report-prepared-reaction-principal-build-limit
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/api/gap-reports/__tests__/route.admission.test.ts; app/api/gap-reports/__tests__/status-route.test.ts; app/api/gap-reports/[id]/enrichment-retry/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-build-principal-admission.test.ts; app/server/domain-access/__tests__/gap-network-enrichment-retry.test.ts; app/server/domain-access/__tests__/gap-network-view-access.admission.test.ts; app/server/repository/__tests__/gap-build-principal-admissions.postgres.integration.ts; app/components/research-route-renderers/__tests__/search-view-agent-actions.admission.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.retry-response.test.tsx; app/lib/__tests__/api-error-response.test.ts; app/(research)/__tests__/gap-view-route-stale-core.test.tsx; docs/contracts/story-chain/aspects/gap-build-principal-admission.md
runCommitSha: 402cd957b059
observedOutput: aspect:gap-build-principal-admission의 α Coverage는 새 core, failed-core retry, enrichment retry 세 command가 같은 사용자별 DB admission을 거치고 읽기·status는 거치지 않는 것으로 닫혔다. β Wovenness는 승인된 두 Promise만 Aspect와 전용 ledger에 reciprocal하게 연결되고 gap-overlay Promise는 포함하지 않는 것으로 닫혔다. 같은 report 반복은 새 work를 만들지 않고 다른 active report는 안정적인 429/Retry-After와 읽을 수 있는 active report 안내로 귀결된다. 서로 다른 principal은 독립적으로 통과하며 matching release, no-start release, runner settlement, report-version 이후 terminal reconciliation, expiry 복구가 실행 증거로 확인됐다. 재발급 직후 같은 terminal version은 token을 다시 탈취하지 못한다. Admission의 최대 70초 Retry-After는 UI countdown까지 보존되고 SECURITY DEFINER RPC는 fixed search path와 service-role-only 실행을 유지한다.
gaps:
  - adopt: 사용자별 제한은 공유 report creator ownership이 아니라 짧은 command admission lease로 유지한다.
  - reject: pointcut을 gap-overlay Promise나 다른 LLM 기능으로 넓히거나 전역 queue·rate limit으로 승격하지 않는다.
verdict: met
```

#### 2026-08-12 — 사용자별 Gap 계산 진입 제한

```yaml
date: 2026-08-12
acs:
  - acceptance-check:gap-network-detection-from-search-principal-build-limit
  - acceptance-check:gap-report-prepared-reaction-principal-build-limit
acReviewedRevision:
  - 1
  - 1
fixtureRef: app/api/gap-reports/__tests__/route.admission.test.ts; app/api/gap-reports/[id]/enrichment-retry/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-build-principal-admission.test.ts; app/server/domain-access/__tests__/gap-network-enrichment-retry.test.ts; app/server/domain-access/__tests__/gap-network-view-access.admission.test.ts; app/server/repository/__tests__/gap-build-principal-admissions.postgres.integration.ts; app/components/research-route-renderers/__tests__/search-view-agent-actions.admission.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.retry-response.test.tsx; app/(research)/__tests__/gap-view-route-stale-core.test.tsx
runCommitSha: 638f6e20221a
observedOutput: 새 리포트 생성, 실패한 core 복구, 실패한 enrichment 재시도는 report 상태 판정 뒤 같은 사용자별 DB admission을 공유한다. 같은 report 반복은 token이나 work를 늘리지 않고, 다른 active report는 stable 429와 Retry-After로 거부한다. UI는 active report로 연결하거나 기존 core graph 위에 별도 안내를 남긴다. 서로 다른 DB session의 경쟁은 principal 하나에 active report 하나만 허용하고 다른 principal은 독립적으로 통과한다. CAS no-start와 runner 정착은 matching token을 반환하며 process loss는 70초 expiry로 복구한다.
gaps:
  - adopt: 공유 artifact에 creator ownership을 추가하지 않고 별도 principal admission lease를 command admission으로만 사용한다.
  - adopt: 첫 enrichment retry와 재실패 뒤 report 단위 60초 cooldown은 사용자별 admission과 독립된 기존 정책으로 유지한다.
  - reject: admission을 결과 commit authority, queue, cache, 전역 LLM admission으로 승격하지 않는다.
verdict: met
```
