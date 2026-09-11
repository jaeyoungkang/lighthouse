---
id: aspect:search-first-url-model
slug: search-first-url-model
title: Search-first URL model
appliesTo:
  - promise:search-url-restores-search
  - promise:search-failure-degraded-at-url
  - promise:research-route-cap-feedback
  - promise:shared-gap-report-member-access
  - promise:search-query-route-transition
  - promise:citation-lineage
  - promise:similar-papers-discovery
  - promise:graph-neighbor-papers
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
coveringLedger: docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Search-first URL model

## Why

검색-first 구조에서 탐색 화면 상태의 정본은 서버 기록이 아니라 주소다. 탐색
화면(검색·인용 계보·비슷한 논문)은 주소에 담긴 조건을 재실행해 복원되고,
연구 공백 리포트 같은 저장 산출물만 id 주소를 갖는다. 이 구분이 흐려지면
탐색 화면이 다시 서버 기록에 묶이고, 첫 결과가 저장 작업을 기다리게 되며,
같은 화면을 여는 두 경로(주소 재실행 vs 기록 재생)가 서로 다른 결과를 만든다.

## Pointcut

이 Aspect는 탐색 실행 route(`/search`, `/citation`, `/similar`)와 그 URL 상태,
저장 산출물 route(`/gap/:id`), 그리고 이 route들 사이의 이동·복귀·공유를
다루는 Promise에 적용한다.

## Advice

탐색 화면의 주소는 실행 조건(query 또는 seed)을 담는다. 검색·파생 탐색 화면은
condition URL이 화면 수명을 소유하고, seed 맥락은 URL 파라미터 또는 현재 화면
스냅샷으로 전달된다. 저장 산출물만 `/gap/:id` 같은 id 주소를 갖는다. 후속 화면
이동은 브라우저 history에 남아 뒤로가기가 출발 화면의 조건을 복원한다.
지원하는 조건 범위를 넘은 주소는 일부 조건을 자르거나 빼서 다른 검색으로
바꾸지 않는다. 제품 안에서 만든 주소는 현재 화면에 거부 안내를 보여 주고,
직접 연 주소는 실행 전에 명시적 조건 오류 상태로 끝난다.

## Verification

`search-ephemeral-execution.ledger.yaml`의 acceptance-check 행들이 `/search?q=`
진입, 같은 주소 재진입, 실패 degrade, URL ownership을 검증한다. 파생 탐색 route
중 graph-neighbor seed URL은 `graph-neighbor-papers.ledger.yaml`가, non-corpus similar
fallback의 `/search?q=` 조건 진입은 `similar-papers.ledger.yaml`가 각각 Promise
AC로 닫는다. 저장 산출물 route(`/gap/:id`)의 id 주소성은
`gap-network-e2.ledger.yaml`가 `gap_reports` artifact와 `/gap/:id` render/status
경계를 통해 유지한다. 조건 범위의 무손실 거부는
`research-route-cap-feedback.ledger.yaml`가 세 탐색 route의 공통 Acceptance
Check로 닫는다.
