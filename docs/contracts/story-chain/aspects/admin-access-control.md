---
id: aspect:admin-access-control
slug: admin-access-control
title: Admin access control
appliesTo:
  - promise:evidence-ledger-implementation-trace
  - promise:invited-user-access-management
  - promise:story-chain-event-contract
coveringLedger: docs/contracts/story-chain/evidence-ledgers/admin-access-control.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Admin access control

## Why

Admin surface(`/admin`, `/admin/access`, `/admin/analytics`)는 운영자 인증이 있어야
접근할 수 있다. 현재 렌더되는 admin 표면은 초대 사용자 접속 관리와 canonical
event 계약 카탈로그다.

## Pointcut

이 Aspect는 admin route, 초대 사용자 접속 관리, analytics event 계약 카탈로그
surface를 운영자에게 보여 주거나 그 경계를 검증하는 Promise에 적용한다.
backend-only alignment 계산, baseline 비교, CLI gate처럼 admin lane에 있더라도
화면 접근 경계를 만들지 않는 Promise에는 적용하지 않는다.

## Advice

Admin surface는 `requireInternalAdminUser()`를 통과한 사용자에게만 열린다.
internal admin은 `@corca.ai` 이메일로 판정한다. 외부 초대 사용자 allowlist는
일반 접속만 허용하며 admin 권한을 만들지 않는다. 새 admin route나 endpoint가
생기면 같은 gate를 통과해야 하며, 계약 요약을 외부 공개 경로(`/about/*`)에
두지 않는다.

## Verification

`app/server/auth/__tests__/internal-admin.test.ts`가 internal admin 도메인 규칙을
닫고, `app/server/auth/__tests__/access-policy.test.ts`가 DB-only 외부 membership과
admin 판정의 분리를 닫는다. repository·domain-access·identity·magic-link 테스트가
row 존재·부재와 fail-closed read를 닫는다.
`app/admin/__tests__/admin-access.test.tsx`가 `/admin/access`의 렌더 gate와 mutation
gate, 실패 표시를 닫고, 기존 analytics page gate도 함께 유지한다.

CAIR record: `docs/contracts/story-chain/promises/invited-user-access-management.md#contract-architecture-impact-review`
