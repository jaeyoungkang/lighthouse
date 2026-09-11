---
id: promise:gap-report-margin
slug: gap-report-margin
title: 연구 공백 화면 여백
moment: moment:gap-analysis-from-results
lane: research-route
status: propagated
aspects:
  - aspect:document-content-width-governance
acceptanceChecks:
  - acceptance-check:gap-report-margin-wide-shell-classes
  - acceptance-check:gap-report-margin-distinct-from-reading-shell
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 연구 공백 화면 여백

## Promise

연구 공백 화면은 일반 ResearchRoutePayload rail의 폭 체계를 따른다.
노드 네트워크 시각화를 좁은 읽기 shell에 가두지 않고, 군집과 공백의 위치 관계를
한 화면에서 읽게 한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:gap-report-margin-wide-shell-classes

- description: `GapNetworkView`의 콘텐츠 shell은 읽기 rail보다 충분히 넓은 시각화 전용 폭을 쓴다. 노드 네트워크 그래프가 예전 `1060px` 읽기 shell이나 일반 읽기 rail에 갇히지 않는다. 폭 값은 `GAP_VIEW_CONTENT_SHELL_CLASS` 단일 출처에서 오고, 시각화 rail이 읽기 rail보다 충분히 넓다는 관계(1px 우위가 아닌 구조 floor)를 `research-route-layout.shared.test.ts`가 잠근다. 약속은 그 관계이지 특정 픽셀 값이 아니다. 연구 공백 화면 shell은 다른 ResearchRoutePayload 영역과 같이 중앙 정렬된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:gap-report-margin-distinct-from-reading-shell

- description: 공유 `RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS`는 연구 공백 화면 shell에 직접 사용하지 않는다 — `gap_network` ResearchRoutePayload는 일반 읽기 rail보다 넓은 시각화 화면이므로 `GAP_VIEW_CONTENT_SHELL_CLASS`를 사용해 같은 폭 체계 안의 전용 ResearchRoutePayload rail을 가진다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
