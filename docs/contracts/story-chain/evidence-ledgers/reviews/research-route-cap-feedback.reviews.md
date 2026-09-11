# Research Route Cap Feedback — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [research-route-cap-feedback.ledger.yaml](../research-route-cap-feedback.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.


## Reviews

### Retired Acceptance Check history

`acceptance-check:research-route-cap-feedback-gap-artifact-ownership`은 2026-07-12에
`historical:acceptance-check:research-route-cap-feedback-gap-artifact-ownership`으로
철회했다. 아래 index는 mixed review에서 분리한 날짜와 revision을 보존하고, 전용
`text` 블록은 당시 관찰 전체를 그대로 보존한다. 현재 계약 판정에는 2026-07-22의
shared gap report access review와 실행 가능한 ledger만 사용한다.

- 2026-07-07 `detached gap artifact opens with immediate progress state` — revision 4
- 2026-07-05 `gap artifacts detach from the source exploration route` — revision 4
- 2026-07-05 `search-first condition routes replace saved navigation ids` — revision 4
- 2026-07-04 `search reserve moves to the /search?q= entry route` — revision 3
- 2026-06-28 `REST collection removes the ownerPrincipalId compat input` — revision 2
- 2026-05-08 `aspect:document-collection-cap-feedback current verdict` — revision 1
- 2026-05-03 `aspect:responsive-narrow-viewport-collapse 신설 + scope 축소` — revision 1
- 2026-07-05 `research-route-cap-feedback current revision consolidation` — revision 4

### Sufficiency Review

#### 2026-08-21 — route 검색 입력에서 basis 선택 제거

```yaml
date: 2026-08-21
acs:
  - acceptance-check:research-route-cap-feedback-route-search-visible
acReviewedRevision:
  - 6
fixtureRef: app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/components/research-route-renderers/search-results-header.tsx
runCommitSha: 9c14bfd2ec62+worktree
observedOutput: 빈 검색 route와 결과 route는 각각 기존의 단일 query 입력을 유지한다. 검색 결과 header는 라이브러리 반영 여부만 설명하고 내 연구 기준과 검색어 기준을 선택하는 토글이나 탭을 렌더하지 않는다. 출판연도, facet, 보조 정렬은 결과를 좁히는 기존 refine control로 남는다.
gaps:
  - adopt: 라이브러리 목록 진입점은 저장 source 관리로만 해석한다.
  - reject: 단일 query 입력과 조건 주소 탐색 구조는 변경하지 않는다.
verdict: met
```

#### 2026-07-31 — shared gap report concurrency is verified against PostgreSQL

```yaml
date: 2026-07-31
acs:
  - acceptance-check:shared-gap-report-member-access-authenticated-sharing
acReviewedRevision:
  - 1
fixtureRef: app/server/repository/__tests__/gap-reports.postgres.integration.ts; app/server/repository/__tests__/gap-reports.test.ts; app/server/domain-access/__tests__/gap-network-view-access.test.ts; scripts/db-integration/run-gap-report-concurrency.ts; scripts/db-integration/migration-revision.ts; docs/runtime-flows/gap-network-analysis.md; .github/workflows/quality.yml
runCommitSha: 56276247+worktree
observedOutput: 현재 migration revision을 적용한 로컬 PostgreSQL과 PostgREST에서 두 독립 session의 동일-version CAS는 하나의 update만 성공시켰다. 패배한 repository caller는 최신 row를 다시 읽었고 승자의 payload를 보존했다. 같은 canonical digest의 두 insert는 unique conflict 뒤 하나의 artifact id로 수렴했으며 서로 다른 digest는 별도 artifact를 만들었다. Pending build의 두 runner는 하나의 attempt와 lease만 획득했다. Lease 만료 뒤 새 attempt가 시작되면 이전 attempt의 늦은 persist는 최신 상태와 결과를 덮지 못했다. 실행 DB에서 repository migration 하나를 제거한 음성 실행은 시나리오 시작 전에 revision mismatch로 실패했다.
gaps:
  - adopt: Unit test의 query 조건과 오류 분기 증거를 실제 PostgreSQL MVCC, unique constraint, PostgREST conflict 의미의 protected evidence로 보강한다.
  - adopt: DB 경쟁 수렴은 repository가 소유하고 domain access는 process-local single-flight와 build orchestration만 소유한다.
  - reject: 이 검증은 lease 만료 전후 provider 계산의 exactly-once 실행을 보장하지 않는다.
  - reject: RDS 전환과 인증·RLS 정책은 각각 #306과 #410의 소유 범위에 남긴다.
verdict: met
```

#### 2026-07-22 — shared gap report access has a dedicated Promise owner

```yaml
date: 2026-07-22
acs:
  - acceptance-check:shared-gap-report-member-access-authenticated-sharing
  - acceptance-check:research-route-cap-feedback-canonical-url
acReviewedRevision:
  - 1
  - 5
fixtureRef: app/api/gap-reports/__tests__/route.test.ts; app/api/gap-reports/status/__tests__/route.test.ts; app/(research)/__tests__/gap-view-route-stale-core.test.tsx; app/server/domain-access/__tests__/gap-network-view-access.test.ts; app/server/domain-access/__tests__/gap-report-source-identity.test.ts; app/server/repository/__tests__/gap-reports.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/stores/__tests__/research-route-store.test.ts; app/(research)/__tests__/research-routes.test.tsx; app/components/research-route-renderers/__tests__/search-view-states.test.tsx; docs/runtime-flows/gap-network-analysis.md
runCommitSha: ec8b638a+worktree
observedOutput: 인증된 가입자는 생성자와 무관하게 공유된 `/gap/:id` 리포트를 열고, 같은 입력의 준비 중 또는 완료된 리포트를 재사용하며, 자신의 반응만 별도로 유지한다. 미인증 요청은 생성·상태 확인·직접 URL 조회에서 리포트 내용을 받기 전에 닫힌다. 리포트 생성은 출발 탐색 화면을 유지한 채 별도 창의 `/gap/:id`로 이어진다. 이 출력과 구조는 그대로 유지되고, 공유 접근 owner만 `promise:shared-gap-report-member-access`와 `moment:shared-gap-report-access`로 분리됐다.
gaps:
  - adopt: 공유 리포트 접근·재사용은 검색 입력 Moment가 아니라 공유 리포트를 여는 상황이 소유한다.
  - adopt: 출발 화면을 유지하는 별도 창 전환은 조건 주소와 artifact 주소를 구분하는 기존 route Promise가 계속 소유한다.
  - reject: 계약 분리를 이유로 runtime route, 저장 identity, 인증 경계, viewer preference를 변경하지 않는다.
verdict: met
```

#### 2026-07-19 — condition URL encoded-byte overflow is visible and lossless

```yaml
date: 2026-07-19
acs:
  - acceptance-check:research-route-cap-feedback-condition-overflow
acReviewedRevision:
  - 1
fixtureRef: app/lib/search-condition-url-budget.ts; app/lib/__tests__/search-condition-url-budget.test.ts; app/(research)/__tests__/research-routes.test.tsx; app/(research)/__tests__/relationship-route-page.test.tsx; app/components/research/__tests__/research-route-local-navigation.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/server/services/__tests__/relationship-execution.test.ts; scripts/architecture-fitness/check-search-condition-url-budget.mjs; scripts/architecture-fitness/__tests__/search-condition-url-budget.test.ts; docs/architecture-fitness/pilots/issue-399-serialized-input-budget.policy.json
runCommitSha: df44cbbb07ea0835482779f6b08cd46d0cdac404
observedOutput: Production URLSearchParams serialization now measures the UTF-8 bytes of the full path and query for keyword, term, seed fallback, citation, and similar condition URLs. Raw values from the route bar, empty state, requery, spelling correction, and term follow-up are passed to the shared builder before whitespace normalization; whitespace-only follow-up q is invalid. Maximum emoji and percent-expansion fixtures remain below the approved request-target budget, including an exact 8,192-byte similar URL. A one-byte raw dimension overflow, a fifth facet, an oversized seed title, malformed discriminants, or mixed term and seed modes is rejected without truncation, omission, fallback navigation, or throw. Product-generated rejection leaves the current route in place and publishes the fixed guidance message; valid same-route and detached navigation clear stale rejection state; and oversized local result-card or citation-link metadata takes the same non-throwing feedback path. Oversized direct URLs render the condition-error state before auth/provider search execution and before canonical ephemeral identity creation. The guard scans the route-builder owner and other production modules for throwing wrappers, direct condition route assembly, and function-scoped trim aliases. The collector refuses target-revision guard, probe, test, Vitest config, or setup drift before executing target code, and every evidence item records the canonical fixture-producing output path.
gaps:
  - adopt: Korean, combining-mark, emoji, and reserved-character cases are measured with UTF-8 and production percent encoding rather than ASCII length.
  - adopt: The shared static guard rejects parser/provider ordering drift and strict-builder imports from production callers.
  - reject: The deployment platform's pre-application raw request-target rejection remains unsupported because application code cannot observe it.
verdict: met
```

#### 2026-07-05 — research-route-cap-feedback current revision consolidation

```yaml
date: 2026-07-05
acs:
  - acceptance-check:research-route-cap-feedback-route-search-visible
  - acceptance-check:research-route-cap-feedback-canonical-url
acReviewedRevision:
  - 5
  - 4
fixtureRef: docs/contracts/story-chain/evidence-ledgers/research-route-cap-feedback.ledger.md; app/(research)/__tests__/research-routes.test.tsx; app/components/research-route-renderers/__tests__/search-view-states.test.tsx; app/api/gap-reports/__tests__/route.test.ts
runCommitSha: e2db4d87a1c0
observedOutput: Current evidence covers the single route search entry, condition URL execution for search/citation/similar routes, detached `/gap/:id` opening for long-running gap artifacts, and gap artifact creation from visible snapshots without loading a source document or using a document creation API.
gaps:
  - adopt: Same-day review ordering is consolidated so the latest Sufficiency Review records the current revisions 5/4/4 after route transition progress moved to `promise:search-query-route-transition`.
  - adopt: The stale `app/api/documents/__tests__/route.test.ts` evidence ref is replaced by current gap-reports and condition-route execution evidence.
  - reject: Older route-phase notes are outside current executable evidence.
verdict: met
```
