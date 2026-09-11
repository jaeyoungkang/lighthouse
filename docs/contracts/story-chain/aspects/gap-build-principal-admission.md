---
id: aspect:gap-build-principal-admission
slug: gap-build-principal-admission
title: 사용자별 Gap 계산 진입 제한
appliesTo:
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
coveringLedger: docs/contracts/story-chain/evidence-ledgers/gap-build-principal-admission.ledger.yaml
verdict: met
---

# 사용자별 Gap 계산 진입 제한

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/417#issuecomment-5263034382

## Why

Gap 계산은 사용자가 명시적으로 시작하며 시간이 걸린다. 한 사용자가 여러
리포트의 계산을 동시에 시작하면 어떤 작업을 기다려야 하는지 판단하기 어렵고,
같은 사용자의 요청이 서로 자원을 다투게 된다. 저장된 리포트를 읽는 행동까지
막으면 진행 중인 작업을 이해하거나 이미 나온 근거를 검토할 수 없다.

## Pointcut

이 Aspect는 검색 결과에서 새 Gap 리포트를 만들거나 실패한 핵심 계산을 다시
시도하는 Promise와, 저장된 리포트의 실패한 해석 보강을 다시 시도하는 Promise에
적용한다.

## Advice

한 사용자가 Gap 계산 하나를 진행 중일 때 같은 리포트의 반복 요청은 새 계산을
만들지 않는다. 다른 리포트의 새 계산, 실패한 핵심 계산의 재시도, 실패한 해석
보강의 재시도도 시작하지 않는다. 사용자는 현재 작업이 끝난 뒤 다시 시도해야
함을 이해할 수 있어야 한다. 저장된 리포트의 본문과 상태를 읽는 행동은 계속
허용한다.

## Verification

`gap-build-principal-admission.ledger.yaml`은 새 리포트 생성·핵심 계산 복구·해석 보강 재시도
경로가 같은 사용자별 제한을 따르는지 검증한다. 서로 다른 실행 인스턴스의 경쟁,
같은 리포트 반복 요청, 다른 사용자의 독립 실행, 계산 종료·중단 뒤의 다음 진입은
등록된 PostgreSQL 경쟁 evidence와 route/runtime 테스트로 닫는다.
