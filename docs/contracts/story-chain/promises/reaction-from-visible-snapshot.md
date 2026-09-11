---
id: promise:reaction-from-visible-snapshot
slug: reaction-from-visible-snapshot
title: AI 코멘트는 지금 보이는 결과에서 만들어진다
moment: moment:search-results-first-review
lane: search
status: declared
aspects:
  - aspect:route-view-ai-reaction-rules
  - aspect:route-view-ai-comment-generation-routing
  - aspect:visible-explanation-sufficiency
acceptanceChecks:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
  - acceptance-check:reaction-from-visible-snapshot-basis-match
  - acceptance-check:reaction-from-visible-snapshot-ephemeral-lifetime
  - acceptance-check:reaction-from-visible-snapshot-viewer-preference-persists
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/snapshot-reaction.ledger.yaml
analyticsExempt: reaction visibility and regenerate observability are carried by the existing product.ai_comment_card.viewed / product.ai_comment_regenerate.clicked events; the snapshot-anchored generation input change does not add a user action surface
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# AI 코멘트는 지금 보이는 결과에서 만들어진다

## Promise

AI 코멘트는 연구자가 지금 보고 있는 결과에서 만들어진다. 검색·인용 계보·
비슷한 논문 화면은 현재 query와 보이는 결과 snapshot을 코멘트의 입력 정본으로
사용한다. 이 화면들의 코멘트는 실행마다 새로 만들어지는 반응이며 화면을 떠나면
함께 사라진다. 연구 공백
리포트처럼 저장되는 산출물에서 선택한 코멘트만 현재 가입자의 선호로 남고,
같은 가입자가 다시 열면 공유 본문 위에 복원된다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:reaction-from-visible-snapshot-snapshot-input

- description: 탐색 화면(검색·인용 계보·비슷한 논문)의 AI comment는 현재 화면의 query와 결과 snapshot만 입력으로 사용한다. 입력에는 source·paging·limit와 인용·그래프 관계를 어느 범위까지 확인했는지도 함께 담아, 제공되지 않았거나 잘린 관계를 실제 연구 부재나 직접 관계 없음처럼 말하지 않게 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:reaction-from-visible-snapshot-basis-match

- description: 탐색 화면의 AI comment는 생성 요청이 캡처한 query·결과 basis가 적용 시점의 현재 화면 basis와 같을 때만 반영된다. 정렬·필터·결과처럼 comment 입력이 바뀌면 이전 comment와 늦게 도착한 응답을 폐기하고 현재 화면에서 새로 생성한다. comment 입력에 참여하지 않는 UI 표시 정보만 바뀐 경우에는 현재 comment를 버리거나 생성을 다시 시작하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:reaction-from-visible-snapshot-ephemeral-lifetime

- description: 탐색 화면의 reaction은 저장소에 영속되지 않는다. 같은 주소를 다시 열면 새 실행의 결과에서 reaction이 새로 생성되고, 이전 실행의 reaction이 현재 화면의 반응처럼 재생되지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:reaction-from-visible-snapshot-viewer-preference-persists

- description: 연구 공백 리포트에서 선택한 reaction은 해당 리포트와 현재 가입자의 선호로 저장되고, 같은 가입자가 `/gap/:id`를 다시 열면 공유 리포트 본문 위에 복원된다. 한 가입자의 선택은 다른 가입자의 reaction을 바꾸지 않는다. 리포트 내용의 version이 바뀌면 이전 version에서 고른 reaction을 현재 본문의 선택처럼 합성하지 않으며, 탐색 화면의 일시적 reaction과도 섞지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

## Runtime ownership

Snapshot projection, queue identity, cancellation과 stale completion guard는
`docs/runtime-flows/ai-response-generation.md`가 소유한다.
