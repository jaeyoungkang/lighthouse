---
id: aspect:common-page-footer
slug: common-page-footer
title: Common page footer
appliesTo:
  - promise:invited-user-access-management
  - promise:research-route-cap-feedback
  - promise:search-results-fast-window
  - promise:researcher-prose-promises-page
  - promise:story-chain-event-contract
coveringLedger: docs/contracts/story-chain/evidence-ledgers/common-page-footer.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Common page footer

## Why

Moonlight Search의 페이지는 사용자가 어느 유형의 화면에 들어와도 같은 하단
기준 정보를 제공해야 한다. 공개 검색 시작 화면, 검색 결과와 탐색 화면, 공개
설명, 내부 admin 문서는 서로 다른 일을 하지만 모두 Moonlight Search 제품 안의
페이지다. 하단에 공통 footer가 없으면 제품 설명, 공개 안내 링크, 사업자 정보,
저작권 정보가 화면 유형마다 사라지거나 다른 방식으로 흩어진다.

## Pointcut

이 Aspect는 Next.js page로 렌더되는 사용자-facing 또는 내부 작업자-facing
페이지의 route·page chrome에 적용한다. 공개 검색 시작 화면과 검색 결과를 함께
감싸는 연구 route shell, 공개 `/about*` 페이지, 내부 `/admin/access`,
`/admin/analytics`가 대상이다.

API route, redirect-only route, 외부 Moonlight handoff destination, 렌더된
ResearchRoutePayload 본문, 검색 결과 view, 반복 카드와 개별 component 조각은 page
footer의 owner가 아니다. 이 콘텐츠들은 자신을 감싸는 route·page chrome이 제공하는
footer보다 앞에 렌더된다.

## Advice

- 모든 대상 페이지 유형의 route·page chrome은 본문 scroll 흐름 끝에 공통
  Moonlight Search footer를 정확히 하나 노출한다.
- footer는 Moonlight Search 설명, 공개 안내 링크(`/about/search`,
  `/about/graph/sample`, `/about/promises`), 사업자 정보, 저작권 문구를 포함한다.
- footer는 페이지의 주된 작업을 가리거나 대체하지 않는다. 검색 입력, ResearchRoutePayload 본문,
  AI reaction, follow-up action, admin audit 본문보다 뒤에 놓인다.
- 기존 페이지 내부의 근거 footer나 출처 footer는 유지할 수 있다. 다만 그 내부
  근거 footer가 공통 page footer를 대체하지 않는다.
- 검색 결과를 포함한 콘텐츠 renderer는 공통 page footer를 주입하거나, route·page
  chrome에 footer 소유 여부를 전달하거나, chrome의 footer를 억제하지 않는다.
- 공통 footer는 존재하지 않는 정책 링크, 외부 social 링크, 별도 accent band를
  새로 만들지 않는다.

## Verification

`common-page-footer.ledger.yaml`가 route group과 page family별 rendered evidence를
닫는다. 각 evidence는 대상 page type이 공통 footer를 실제 DOM에 렌더하고, 필수
설명·공개 링크·사업자 정보·저작권 문구를 포함함을 검증한다. 연구 route evidence는
검색 결과 renderer에 footer가 없고, 완료된 검색 결과 뒤에도 route shell이 공통
footer를 정확히 하나 렌더함을 함께 검증한다.

## Contract Architecture Impact Review

Contract delta: 검색 결과 문서와 route shell이 조건에 따라 공통 footer 소유권을
교환하던 계약을 폐기하고, route·page chrome을 모든 페이지 상태의 단일 owner로
고정한다. 검색 결과 renderer는 결과 콘텐츠만 렌더한다.

Verdict: reshape

Affected axes and current owners: Source of truth and authority; Compatibility and
retirement; Cross-surface invariant ownership — `aspect:common-page-footer`가 공통
footer의 사용자-visible invariant를 소유하고, 각 route·page chrome과 공유
`SiteFooter`가 렌더링 책임을 소유한다.

Decision: 연구 route shell은 비검색, 검색 대기, 완료된 검색 결과에서 같은 위치에
공통 footer를 정확히 하나 렌더한다. 콘텐츠 renderer는 공통 footer 소유권을 갖지
않으며 route URL·현재 결과 fingerprint로 footer 표시 여부를 결정하지 않는다.

Rejected alternative: 검색 결과 문서가 footer를 렌더하고 route shell이 query, 정렬,
연도, facet과 현재 결과를 비교해 자신이 렌더할 footer를 억제하는 구조는 페이지
chrome의 책임을 콘텐츠 상태에 결합한다. 이 방식은 두 owner 사이의 판정이 어긋날 때
footer가 중복되거나 사라질 수 있어 폐기한다.

Evidence and structural defense: `aspect:common-page-footer`,
`app/components/research/__tests__/research-route-shell.test.tsx`,
`app/components/research-route-renderers/__tests__/search-view-content.test.tsx`가 완료된
검색 결과 뒤의 shell footer 하나와 검색 결과 renderer의 footer 부재를 함께 고정한다.
`docs/contracts/story-chain/evidence-ledgers/common-page-footer.ledger.yaml`와
`npm run quality:contract`가 이 owner 경계를 검증한다.

Human decision required: no

## Propagation Map

Invariant: route·page chrome은 콘텐츠 뒤에 공통 footer를 정확히 하나 렌더하고,
콘텐츠 renderer는 그 footer를 직접 렌더하거나 억제하지 않는다.

Owning contract bundle: `aspect:common-page-footer`와
`common-page-footer.ledger.yaml`; 검색 결과 배치 evidence를 함께 소유하는
`promise:search-results-fast-window`와 `search-result-window.ledger.yaml`.

Runtime/engineering owner: 연구 route shell, 공개·admin page chrome, 공유
`SiteFooter` component.

Required code/test paths: `app/(research)/research-route-shell.tsx`,
`app/components/research-route-renderers/search-view-content.tsx`,
`app/components/research-route-renderers/search-results-content-rail.tsx`, 연구 shell과
검색 결과 renderer의 focused Vitest.

Inspected, not edited: 공개 about와 admin page의 기존 직접 footer owner, 인증 화면이
페이지 chrome을 대체하는 상태, API·redirect route, dated Sufficiency Review의 역사 기록.

Compatibility-only shapes: 검색 결과 전용 `SearchResultsFooterAbout`,
`footerAboutSection` 전달, route query·정렬·연도·facet fingerprint 기반 shell footer
억제는 `remove`한다. 저장 데이터, URL, API, analytics 호환 shape는 없다.

Split cleanup: 과거 dated review의 당시 관찰 문구는 역사 기록으로 보존한다. 현재
authority를 주장하는 Aspect, Evidence Ledger, 코드와 테스트에서는 결과 소유 footer를
같은 변경에서 제거한다.

Budget: 10..16 authored files, 120..360 authored changed lines. 별도 runtime flow,
상태 저장소, analytics event, 새 component 추상화는 만들지 않는다.

## Concept Shift Architecture Review

Shift: 검색 결과 콘텐츠가 페이지 footer까지 소유하던 구조에서, route·page chrome이
공통 chrome 전체를 소유하고 결과 renderer는 결과 콘텐츠만 소유하는 구조로 전환한다.

- `remove`: 검색 결과 전용 `SearchResultsFooterAbout` component와
  `footerAboutSection` 전달 계약.
- `remove`: 검색 결과 document와 route 조건의 fingerprint를 비교해 shell footer를
  억제하는 함수와 상태 selector.
- `preserve`: 공통 `SiteFooter`의 내용과 각 공개·admin page chrome의 기존 footer
  배치, 인증 화면이 research page chrome을 의도적으로 대체하는 상태.
- `preserve`: 완료된 검색 결과를 읽은 뒤 별도 full-width Scholar footer를 만나는
  사용자-visible 결과와 과거 dated review의 역사 기록.
- `migrate-read-only`: 해당 없음. footer 소유권에는 영속 데이터나 외부 입력 호환
  경로가 없다.

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747
