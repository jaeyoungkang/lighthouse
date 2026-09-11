---
id: promise:invited-user-access-management
slug: invited-user-access-management
title: 운영자는 초대 사용자 접속을 관리한다
moment: moment:invited-user-access-management
lane: admin
status: propagated
aspects:
  - aspect:admin-access-control
  - aspect:common-page-footer
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
acceptanceChecks:
  - acceptance-check:invited-user-access-management-admin-surface
  - acceptance-check:invited-user-access-management-normalized-membership
  - acceptance-check:invited-user-access-management-next-auth-request
  - acceptance-check:invited-user-access-management-admin-separation
  - acceptance-check:invited-user-access-management-failure-preserves-state
requiredEvents:
  - governance.invited_access_membership.synced
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 운영자는 초대 사용자 접속을 관리한다

## Promise

내부 관리자는 현재 제품에 접속할 수 있는 외부 이메일을 확인하고 추가하거나
삭제한다. 추가된 이메일은 다음 인증 요청부터 접속할 수 있다. 삭제된 이메일은
다음 인증 요청부터 접속할 수 없다.

이메일은 대소문자와 앞뒤 공백을 구분하지 않고 하나의 주소로 관리한다. 외부
이메일을 추가해도 관리자 권한은 생기지 않는다. 내부 사용자와 관리자 자격은
`@corca.ai` 이메일 정책이 계속 소유한다.

변경 저장에 실패하면 기존 접속 상태를 유지한다. 관리 화면은 변경이 적용되지
않았음을 운영자에게 보여 준다.

## Intent Checks

명시적 Intent Check는 없다. 접속 결정과 관리 화면은 deterministic evidence로
닫는다.

## Acceptance Checks

### acceptance-check:invited-user-access-management-admin-surface

- description: 내부 관리자는 현재 유효한 외부 접속 이메일 목록을 같은 관리 표면에서 확인하고, 이메일을 추가하거나 삭제할 수 있다. 외부 초대 사용자는 이 표면에 접근할 수 없다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:invited-user-access-management-normalized-membership

- description: 외부 이메일은 앞뒤 공백과 대소문자를 정규화한 exact address로 관리한다. 유효하지 않은 이메일과 `@corca.ai` 주소는 외부 초대 목록에 추가하지 않으며, 같은 이메일은 현재 목록에 최대 한 번만 나타난다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:invited-user-access-management-next-auth-request

- description: 이메일 추가와 삭제가 성공하면 다음 magic-link 발급 요청과 다음 인증된 제품 요청은 최신 membership을 따른다. 삭제된 외부 이메일은 기존 인증 자료가 남아 있어도 제품 접속을 이어 가지 못한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:invited-user-access-management-admin-separation

- description: 외부 초대 이메일은 일반 제품 접속만 허용한다. 내부 관리자 자격은 `@corca.ai` 이메일로만 판정하며, 외부 초대 목록의 추가·삭제와 독립적으로 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:invited-user-access-management-failure-preserves-state

- description: 추가나 삭제 저장이 실패하면 이전 membership 상태를 유지한다. 관리 표면은 실패를 표시하고 성공한 변경으로 보이지 않게 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

## Contract Architecture Impact Review

Contract delta: 내부 관리자가 외부 사용자의 제품 접속 이메일을 조회·추가·삭제하고,
성공한 변경이 다음 인증 요청부터 적용되게 한다.

Verdict: reshape

Affected axes and current owners: Source of truth and authority; Domain and data
shape; State lifetime and recovery; Interaction timing; Security and privacy;
Resource and capacity; Observability and audit; Compatibility and retirement —
`app/server/auth/access-policy.ts`, `app/server/auth/identity.ts`,
`app/api/auth/magic-link/route.ts`, `LIGHTHOUSE_ALLOWED_EMAILS`

Decision: `lighthouse.access_allowlist_entries`가 외부 이메일 allowlist의 유일한
정본이다. row 존재는 허용을 뜻하고 row 부재는 거부를 뜻한다. repository와
domain-access가 이 테이블의 read/write capability를 제한한다. 인증 resolver와
magic-link 발급은 내부 이메일을 먼저 허용하고, 외부 이메일만 exact-email
membership을 읽는다. DB read가 실패하면 외부 이메일은 fail closed한다. 관리자는
추가할 때 row를 upsert하고 삭제할 때 row를 delete한다. 성공한 mutation은 초대
대상 이메일 없이 내부 운영자와 add/remove operation만 canonical event로 기록한다.
인증 결정은 요청마다 현재 값을 읽으며 별도 process cache를 두지 않는다.

Rejected alternative: Vercel 환경변수를 관리 화면에서 직접 수정하는 방안은 배포
플랫폼 권한과 재배포 지연을 제품 접속 mutation에 결합하므로 거부한다.
`app_users`에 허용 필드를 추가하는 방안은 로그인한 사용자 snapshot과 로그인 전
접속 정책을 같은 row lifecycle에 섞으므로 거부한다. process cache는 삭제 직후의
인증 요청이 이전 결정을 사용할 수 있어 거부한다.

Evidence and structural defense: DB는 정규화 이메일 unique key, 외부 이메일 check,
service-role 전용 grant, RLS를 적용한다. least-authority registry는 repository
함수와 호출자를 고정한다. search-first-paint guard는
`app/server/auth/identity.ts`에서 시작하는
exact-email membership read만 인증 side-channel로 허용하고 다른 repository
경로는 계속 거부한다. repository/domain-access/auth tests는 row 존재·부재,
fail-closed read, 내부 관리자 분리, 다음 인증 요청 적용을 검증한다. rendered
admin tests는 목록·추가·삭제·실패 상태를 검증한다. event router와 emitter
테스트는 초대 대상 이메일이 event payload에 들어가지 않는지 검증한다.

Human decision required: no

## Concept Shift Architecture Review

| affected shape | verdict | reason |
| --- | --- | --- |
| `LIGHTHOUSE_ALLOWED_EMAILS` 외부 이메일 읽기 | remove | 현재 외부 초대 이메일을 DB에 미리 입력한 뒤 새 runtime의 읽기를 제거한다. 구 revision rollback window가 닫힐 때까지 설정값은 compatibility carrier로 보존한다. |
| 환경변수 기반 외부 이메일 쓰기 | remove | 관리 표면은 배포 환경을 수정하지 않고 DB membership만 추가·삭제한다. |
| `@corca.ai` 내부 사용자·관리자 판정 | preserve | 내부 사용자 접속과 관리자 권한의 현재 정본이며 외부 초대 결정과 분리한다. |
| 기존 외부 사용자 세션 | preserve | 세션 자료는 남아도 매 인증 요청에서 최신 외부 접속 결정을 다시 확인한다. |

## Propagation Map

Invariant: 내부 관리자만 외부 접속 이메일을 관리하고, 성공한 변경은 다음 인증
요청부터 적용되며 외부 초대는 관리자 권한을 만들지 않는다.

Owning contract bundle: `experience:operator-access-governance` →
`moment:invited-user-access-management` →
`promise:invited-user-access-management`, `aspect:admin-access-control`,
`aspect:common-page-footer`, `aspect:user-facing-language-governance`,
`aspect:ux-writing-voice-and-tone`, `admin-access-control.ledger.yaml`,
`common-page-footer.ledger.yaml`, `user-facing-language.ledger.yaml`,
`ux-writing-voice-and-tone.ledger.yaml`.

Runtime/engineering owner: `docs/runtime-flows/research-route-lifecycle.md`의
Authentication Bootstrap, `app/server/auth/**`, 목적별 domain-access/repository,
`lighthouse.access_allowlist_entries`.

Required code/test paths: Supabase migration, access allowlist repository와
domain-access, auth policy·identity·magic-link route, `/admin/access` page와 Server
Actions, admin navigation과 rendered tests, i18n registry, least-authority caller
registry, first-paint exception policy, 관련 Architecture Fitness policy/raw
observation, canonical event contract와 emitter tests.

Inspected, not edited: Moonlight JWT claim shape, Supabase callback route,
`app_users` snapshot/backfill, research result execution, public about surfaces.

Compatibility-only shapes: 현재 `LIGHTHOUSE_ALLOWED_EMAILS` 이메일은 배포 전
DB membership으로 이관한 뒤 새 runtime 환경변수 읽기를 `remove`한다. 설정값은
구 revision rollback window가 닫힐 때까지 carrier로 보존하고, rollback은 먼저
설정값이 유효한지 확인한 뒤 구 revision으로 전환한다. 기존 세션 자료와
`@corca.ai` 판정은 `preserve`.

Split cleanup: 과거 초대 이력용 append-only audit ledger는 현재 invariant를
닫는 데 필요하지 않아 별도 Human 결정 전에는 만들지 않는다.

Budget: 55..56 authored files; 2,250..2,350 authored changed lines. 초기
26..36 files / 750..1,100 lines 예상은 기존 테스트 파일 통합과
search-first-paint guard의 인증 side-channel 등록을 빠뜨렸다. 2026-07-26
Human checkpoint에서 첫 변경량 조정을, 2026-07-27 Human checkpoint에서 DB-only
membership과 guard·negative fixture·Gate Stack 전파를 승인했다. 독립 리뷰에서
발견한 auth 초기화 실패, exact-chain, rollback carrier 구조 방어와 operator
action의 privacy-safe canonical event WIRE가 상한 조정을 소비했다. 같은
checkpoint의 작업·review·PR 진행 승인은 message registry owner, 두 language
Aspect ledger, Architecture Fitness policy/raw observation, deterministic
projection test와 review usage record까지 필요한 gate closure를 포함한다. 기능
범위는 늘리지 않았다. Exact-head contract review가 요구한 magic-link 실패 문구
owner와 두 language Aspect의 현재 Sufficiency Review를 닫으면서 review archive
projection 두 파일이 마지막 상한 조정을 소비했다. 생성 사본과 lockfile 변경은
예상하지 않는다.

## Clause Classification

| story ref | clause | classification | destination | product meaning changed |
| --- | --- | --- | --- | --- |
| promise:invited-user-access-management | 목록 조회·추가·삭제와 다음 인증 요청 반영 | KEEP | Promise와 Acceptance Checks | yes, Human approved |
| promise:invited-user-access-management | DB membership과 fail-closed read | MOVE | 이 CAIR와 `research-route-lifecycle.md` | no |
| promise:invited-user-access-management | exact tests, commands, fixtures | EVIDENCE | `admin-access-control.ledger.yaml` | no |
| aspect:admin-access-control | 외부 초대와 내부 관리자 권한 분리 | KEEP | 기존 Aspect advice와 covering ledger | no |
