---
id: aspect:first-paint-persistence-independence
slug: first-paint-persistence-independence
title: First paint persistence independence
appliesTo:
  - promise:search-failure-degraded-at-url
  - promise:search-url-restores-search
  - promise:search-query-route-transition
  - promise:citation-lineage
  - promise:similar-papers-discovery
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# First paint persistence independence

## Why

첫 결과 표시가 route-owned provider 실행보다 늦게 시작되면, 제출과 결과 사이에
제품이 통제할 수 없는 지연이 쌓인다. 이 결합은 한 번에 생기지 않는다 — 처음에는
싼 부가 작업이 경로에 하나씩 끼어들고, 데이터가 쌓이면 코드 diff에 드러나지 않은
채 느려진다. #202 재설계의 핵심 결정은 첫 결과 critical path를 URL 조건과
provider 실행으로 닫는 것이므로, 이 규칙을 지역적 구현 선택이 아니라 횡단
규칙으로 고정한다.

## Pointcut

이 Aspect는 검색과 파생 탐색 화면의 제출부터 첫 결과 렌더까지의 실행 경로를
소유하는 Promise에 적용한다.

## Advice

제출부터 첫 결과 표시까지의 경로는 URL 조건을 실행 입력으로 삼고, 그 조건에서 얻은
결과를 바로 현재 화면에 공개한다. 인증 확인이나 새로 읽어야 하는 영속 상태가 첫 결과를
불필요하게 붙잡지 않아야 한다. 사용자가 개인화를 켠 검색에서는 이미 준비된 내
라이브러리 맥락을 검색어 결과와 같은 첫 결과 입력으로 사용할 수 있지만, 이 보강이
실패하면 검색어 결과만 공개하고 나중의 보강으로 이미 공개한 후보군·순서·근거를
바꾸지 않는다. 분석 캐시 기록, artifact 생성, 상세 보강처럼 첫 결과에 필요하지 않은
작업은 첫 렌더 이후의 별도 단계에서 실행한다.

## Runtime ownership

정확한 provider fan-out, cache freshness, repository 허용 경계는
`docs/runtime-flows/search-mechanism.md`가 소유한다.

## Verification

`search-ephemeral-execution.ledger.yaml`의 Acceptance Check 행과 실행 검사가 첫 결과
경로에서 새 persistence 의존이 생기지 않았는지, 개인화 실패 뒤에도 검색어 결과가
공개되는지, 이후 보강이 첫 결과 basis를 바꾸지 않는지를 닫는다. 정확한 명령·테스트
대상은 이 Evidence Ledger가 소유한다.
