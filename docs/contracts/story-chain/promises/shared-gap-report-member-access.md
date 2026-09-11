---
id: promise:shared-gap-report-member-access
slug: shared-gap-report-member-access
title: 가입자는 공유된 연구 공백 리포트를 다시 열 수 있다
moment: moment:shared-gap-report-access
lane: research-route
status: propagated
aspects:
  - aspect:search-first-url-model
acceptanceChecks:
  - acceptance-check:shared-gap-report-member-access-authenticated-sharing
verdict: met
---

CAIR source decision: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 가입자는 공유된 연구 공백 리포트를 다시 열 수 있다

## Promise

인증된 Light House 가입자는 연구 공백 리포트를 만든 사람이 누구인지와
상관없이 공유받은 주소에서 같은 리포트를 읽을 수 있다. 같은 논문 묶음으로
이미 준비 중이거나 완료된 리포트가 있으면 기존 리포트를 다시 사용하며,
연구자마다 남기는 반응은 다른 연구자의 리포트 상태를 바꾸지 않는다.

미인증 사용자는 리포트 내용을 받을 수 없다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:shared-gap-report-member-access-authenticated-sharing

- description: 연구 공백 리포트의 생성·진행 확인·조회는 인증된 Lighthouse 가입자만 사용할 수 있다. 리포트를 만든 사람이 누구인지는 읽기 권한을 정하지 않으며, 인증된 가입자는 URL을 알면 `/gap/:id`를 직접 열 수 있다. 미인증 요청에는 리포트 내용을 주지 않는다. 생성 입력은 출발 화면에서 공유해도 되는 논문 snapshot으로 제한하고, 같은 정규화 입력으로 이미 준비 중이거나 완료된 리포트가 있으면 기존 `/gap/:id`를 재사용한다. 각 가입자의 반응은 그 가입자에게만 적용되며 공유 리포트 본문이나 다른 가입자의 반응을 바꾸지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

## Contract Architecture Impact Review

Contract delta: 이번 Promise 분리는 기존 사용자 행동과 runtime 경계를 바꾸지 않는다. 공유
리포트의 접근·재사용 의미와 아래의 승인된 구조 결정을 검색 입력 Promise에서
분리해 전담 owner를 명확히 한다.

Verdict: reshape
Affected axes and current owners: Domain and data shape; Source of truth and authority; State lifetime and recovery; Execution semantics; Security and privacy; Compatibility and retirement — `gap_reports`, `app/server/domain-access/gap-network-view-access.ts`, `app/server/repository/gap-reports.ts`
Decision: gap report를 생성자 소유 resource에서 인증 가입자가 URL로 함께
읽는 저장 artifact로 바꾼다. Reaction 선택은 report 본문과 분리해 현재
가입자의 preference로 저장한다.
`gap_reports`는 artifact id와 versioned source input digest가 소유한다.
Read authorization은 현재 요청의 가입자 인증만 확인한다. Build·retry·lease는
artifact id와 version/attempt로 조정한다. 현재 viewer principal은 persisted
artifact 밖의 runtime actor로 전달한다. Reaction은 report id와 viewer principal
조합의 preference로 저장한다. Build는 예약 시 저장한 share-safe snapshot만 읽고
현재 viewer의 DB cache를 다시 읽지 않는다.
Rejected alternative: `owner_principal_id`를 `creator_principal_id`로 이름만 바꾸고
read·dedupe·build·analytics 조건에 계속 사용하는 방안은 소유권 결합을 유지하므로
거부한다. 32-bit route snapshot id와 paper id 목록만 global dedupe key로 쓰는
방안도 content identity를 충분히 표현하지 못하므로 거부한다.
Evidence and structural defense: `supabase/migrations/00019_shared_gap_report_artifacts.sql`, `app/server/domain-access/__tests__/gap-network-view-access.test.ts`, `app/domain/__tests__/research-route-payload-schema.test.ts`가 unique source input digest, artifact-id/version CAS, 가입자 인증, `viewerPrincipalId` wire 경계를 고정한다. Report-id/viewer-principal reaction key, 서로 다른 두 가입자의 shared read와 분리된 reaction test, 미인증 차단 test, exact repository query test, viewer/report analytics cardinality test도 같은 결정을 검증한다. Build mutation은 독립 runner로 한정하고 public enrichment endpoint를 제거한 route absence로 구조를 고정한다.
Propagation Map: `docs/runtime-flows/gap-network-analysis.md#propagation-map`
Concept Shift Architecture Review: `docs/runtime-flows/gap-network-analysis.md#concept-shift-architecture-review`
Human decision required: no

변경 전에는 `gap_reports.owner_principal_id`가 source authority와 read
authorization을 함께 맡았다. Owner-scoped repository query가 artifact
read·build CAS·dedupe를 함께 제어했고, `ResearchRoutePayload.ownerPrincipalId`가
route runtime의 actor를 운반했다. Build input도 저장 report snapshot과 현재
요청자의 inline-analysis cache를 함께 읽었다. 위 결정은 이 결합을 해소했다.

## Concept Shift Architecture Review

| affected shape | verdict | reason |
| --- | --- | --- |
| `gap_reports.owner_principal_id`와 owner index | remove | gap report는 생성자 소유 resource가 아니다. |
| owner-scoped report read/update/delete/list repository | remove | read는 artifact id, update는 artifact id/version, dedupe는 source input digest가 소유한다. 사용자 삭제와 owner별 목록은 현재 제품에 없다. |
| 기존 `gap_reports` row와 URL | remove | 외부 공개 전이며 실제 사용자가 없으므로 DB를 새 schema로 다시 만든다. |
| `ResearchRoutePayload.ownerPrincipalId`의 gap runtime 값 | preserve | persisted artifact owner가 아니라 현재 창의 인증 actor를 전달하는 runtime field로만 쓴다. |
| artifact-global reaction과 `reaction_version` | remove | 한 가입자의 선택이 다른 가입자의 report 상태를 바꾸지 않게 viewer preference로 분리한다. |
| creator principal 기반 build hydration | remove | 저장된 share-safe snapshot이 build input을 단독 소유한다. |
| public enrichment/failure endpoint | remove | 공유 artifact build mutation은 artifact lease를 가진 독립 runner만 수행한다. |
| `product.gap_report.viewed`의 viewer/report identity | preserve | 현재 viewer 기준으로 재배선하고 artifact-global viewed marker는 제거한다. |
