---
id: promise:route-view-ai-comment-inline-surface
slug: route-view-ai-comment-inline-surface
title: 연구 화면 내장 AI 반응
moment: moment:research-view-first-orientation
lane: research-route
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:route-view-ai-reaction-rules
  - aspect:visible-explanation-sufficiency
  - aspect:route-view-ai-comment-generation-routing
  - aspect:document-content-width-governance
  - aspect:provider-failure-degraded-mode
  - aspect:progressive-content-spatial-stability
acceptanceChecks:
  - acceptance-check:route-view-ai-comment-inline-surface-embedded-content-rail
  - acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout
  - acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
  - acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
  - acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
  - acceptance-check:route-view-ai-comment-inline-surface-inline-frame-treatment
  - acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view
  - acceptance-check:route-view-ai-comment-inline-surface-bounded-preview-flow
  - acceptance-check:route-view-ai-comment-inline-surface-title-body-only
  - acceptance-check:route-view-ai-comment-inline-surface-exempt-initial-search-and-gap-network
  - acceptance-check:route-view-ai-comment-inline-surface-responsive-flow
  - acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
  - acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible
  - acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
  - acceptance-check:route-view-ai-comment-inline-surface-transport-timeout
  - acceptance-check:route-view-ai-comment-inline-surface-fast-lane-budget
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

Glossary migration record: https://github.com/jaeyoungkang/lighthouse/issues/671#issuecomment-5393864311
— 레거시 "반응" 계열 어휘("AI 반응", "반응", "검색 반응", "리액션", "reaction")는 이
Promise가 소유하는 canonical 어휘 "AI 코멘트"(`route-ai-comment`)의 lookup-only
alias다. Human 판정(2026-08-24) 전면 병합.

# 연구 화면 내장 AI 반응

## Promise

각 route-owned ResearchRoutePayload의 AI 반응은 해당 ResearchRoutePayload 컴포넌트의 content rail 안에
inline surface로 내장된다. 사용자는 검색 결과, 인용 계보, 비슷한 논문 ResearchRoutePayload를
읽기 전에 그 view에 귀속된 짧은 반응과 후속 액션을 먼저 확인한다.
본문 폭은 줄어들지 않고, AI comment 생성이 아직 예정되지 않은 빈 대기 shell은
자리를 예약하지 않는다. 완료된 검색·인용 관계·비슷한 논문처럼 AI comment가
곧 생성될 ResearchRoutePayload는 실제 reaction block이 오기 전부터 같은 content rail 안에
생성 중 상태를 표시한다. 생성이 실패하거나 렌더 가능한 출력 없이 끝나면 pending
shell을 붙잡지 않고 같은 ResearchRoutePayload에 새 AI comment를 만들지 않는다. 사용자가
생성을 직접 중단하는 별도 액션은 없다. 생성이 성공한 AI comment에는 같은
ResearchRoutePayload의 반응을 다시 요청하는 결정적 '다시 생성' 액션이 붙는다. 이 액션은
새 반응이 도착하기 전까지 기존 settled comment를 유지하고 같은 자리에서 재생성 중
상태를 보여준다. 생성 중에는 이 액션을 노출하지 않는다.
현재 반응을 생성하는 ResearchRoutePayload 종류가 달라도 AI comment의 기본 레이아웃은 같은
inline reaction surface를 쓴다. 생성되는 AI comment는 현재 열린/focused ResearchRoutePayload의 본문과
metadata를 입력으로 삼고, route에 남아 있지만 열려 있지 않은 view의 본문은
생성 입력이나 렌더 대상에 섞지 않는다.
논문 PDF 정독은 `promise:delegate-deep-read-to-moonlight`가 담당한다.
ResearchRoutePayload의 일부가 된 반응은 host AI comment frame의 본문형 text treatment를 쓴다.
후속 액션과 '다시 생성' 액션은 반응 본문과 분리된 ResearchRoutePayload 내 action 위치에 두고,
surface 종류가 달라도 같은 시각 문법을 쓴다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:route-view-ai-comment-inline-surface-embedded-content-rail

- description: 검색 결과, 인용 계보, 비슷한 논문 ResearchRoutePayload에서 reaction이 있거나 생성 중이면 `ResearchRouteLayout`은 view 컴포넌트에 `reactionSlot`을 넘기고, 같은 content rail 안에 `data-testid="research-route-inline-reaction"`을 렌더한다. 그 안의 inline-only reaction renderer는 `data-testid="research-route-inline-reaction-content"`로 표시된다. 검색 첫 화면과 `gap_network` ResearchRoutePayload는 각자의 entry/report surface를 주 화면으로 유지한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout

- description: 검색 결과, 인용 계보, 비슷한 논문 ResearchRoutePayload의 AI comment는 같은 `research-route-inline-reaction` wrapper와 inline-only `AgentPanel` renderer를 사용한다. Pending 상태와 실제 reaction block도 같은 content rail 안의 동일한 inline treatment로 표시된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity

- description: 검색 결과 상단 AI comment 영역, 인용 계보 ResearchRoutePayload AI comment, 비슷한 논문 ResearchRoutePayload AI comment는 같은 frame/background/border/padding/typography treatment를 공유한다. 현재 ResearchRoutePayload에 grounded research-term 후보가 있으면 세 surface 모두 같은 본문형 텍스트 링크 treatment로 AI comment frame 안에 이어 붙인다. 인용 계보와 비슷한 논문 ResearchRoutePayload의 host-owned gap action은 AI comment frame 밖이면서 그 frame보다 앞선 ResearchRoutePayload 상단 action 위치에 두어 검색 결과 result-basis action과 같은 읽기 순서를 유지하고, 같은 button treatment를 쓴다. 검색 결과의 gap action은 result-basis row가 소유하므로 이 action-row parity 대상에서 제외된다. route host는 읽기 흐름에 맞춰 위치와 외부 margin만 조정할 수 있고, comment frame의 시각 문법은 바꾸지 않는다. `gap_network` ResearchRoutePayload는 prepared reaction을 그래프/본문 리포트가 흡수하므로 이 top inline frame parity 대상에서 제외된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action

- description: 검색 결과의 연구 공백 진입은 result-basis row의 host-owned `상위 논문 40개의 관계를 분석하여 연구 공백 찾아보기 >` action이 담당하고, 인용 계보와 비슷한 논문 ResearchRoutePayload의 연구 공백 진입은 AI comment frame보다 앞선 ResearchRoutePayload 상단 위치의 host-owned `현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >` action이 담당한다. 대표 논문 판단은 검색 결과 리스트의 대표 표시/필터나 gap 리포트 내부 대표 논문 슬롯이 담당한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only

- description: AI comment 생성과 렌더링은 현재 열려 있는 route view의 query·결과 snapshot만 기준으로 한다. 열려 있지 않은 route의 본문, 이전 실행의 comment 상태, 다른 사용자의 저장 resource를 현재 comment 입력이나 화면에 포함하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-inline-frame-treatment

- description: ResearchRoutePayload-embedded reaction은 host AI comment frame의 기준선에 맞춘 inline text flow로 렌더한다. 생성 중 상태는 같은 frame 안의 옅은 배경 문단으로 표시하고, 내용이 길어져도 부모 ResearchRoutePayload column 폭을 넓히지 않는다. 검색 결과·인용 계보·비슷한 논문 top AI comment의 연구 공백 진입은 각 host가 소유한 `연구 공백 지도 만들기` action이 담당한다.
- evidence: vitest @ `app/components/research/__tests__/AgentPanel.test.tsx` + `app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx`.

### acceptance-check:route-view-ai-comment-inline-surface-reactions-scoped-per-view

- description: inline reaction은 현재 route 실행이 수용한 view의 comment만 렌더한다. 이전 실행의 늦은 완료나 cleanup은 같은 view 주소를 다시 연 새 실행의 comment를 읽거나 바꾸지 못한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-bounded-preview-flow

- description: ResearchRoutePayload-embedded reaction은 content rail의 상단 inline flow와 host AI comment frame의 읽기 폭을 공유한다. 생성 중 상태와 완료된 comment는 같은 생성 영역을 사용한다. 완료된 body는 접힌 상태에서 세 줄 미리보기로 제한하고, 현재 렌더 폭에서 실제로 넘칠 때만 명시적 펼치기 affordance를 보여 준다. 사용자가 펼치면 같은 자리에서 전체 body를 자연 높이로 읽으며, 화면 폭 변경이나 명시적 줄바꿈도 실제 overflow 측정에 반영한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-title-body-only

- description: inline reaction은 해당 ResearchRoutePayload의 현재 렌더 대상 `RouteAiComment[]` 중 title/body reaction을 같은 view 상단 흐름 안에서 렌더한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:route-view-ai-comment-inline-surface-exempt-initial-search-and-gap-network

- description: 초기 빈 검색 ResearchRoutePayload는 시작 화면이 primary surface이고, `gap_network` ResearchRoutePayload는 자체 그래프/본문 리포트와 prepared reaction state가 primary surface이므로 inline reaction을 렌더하지 않는다. inline reaction slot은 검색 결과, 인용 계보, 비슷한 논문 ResearchRoutePayload의 AI comment 흐름에 적용된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:route-view-ai-comment-inline-surface-responsive-flow

- description: viewport 폭이나 ResearchRoutePayload panel 폭과 관계없이 reaction은 content rail 안의 상단 inline flow로 유지되고, 본문 content rail의 폭을 그대로 사용한다.
- evidence: vitest @ `app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx` ("keeps route AI comments inline on narrow viewports"; "keeps route AI comments inline when the %s panel is narrow").

### acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve

- description: 검색 결과, 인용/비슷한 논문 ResearchRoutePayload가 실제 AI reaction block도 없고 생성 예정·진행 상태도 아니면 reaction renderer와 `research-route-inline-reaction`을 렌더하지 않는다. 초기 빈 검색, gap_network처럼 comment가 곧 생성되지 않는 ResearchRoutePayload는 콘텐츠 위 공간을 예약하지 않는다.
- evidence: vitest @ `app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx` ("does not reserve the inline reaction surface before a block or loading state exists"; "renders search reactions at the top of the main content") + `app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx` ("keeps route AI comments inline on narrow viewports").
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible

- description: 완료된 검색·인용 계보·비슷한 논문 화면에서 AI comment가 예정되었거나 hydration을 기다리거나 생성 중이면, 첫 comment가 오기 전에도 같은 화면의 content rail 상단에 명시적인 loading 상태를 보여준다. 검색 결과는 논문 목록이 처음 보이는 시점부터 이 상태를 함께 보여 주고, hydration-owned loaded-result facet이 활성화된 검색과 lightweight 비슷한 논문은 현재 comment 입력이 안정될 때까지 이 상태를 유지한 뒤 provider generation을 한 번만 시작한다. 관계 화면으로 전환 중이면 연결 화면의 loading 상태가 준비된 목적지 화면의 상태로 자연스럽게 이어진다. 이 표시는 완료된 comment처럼 보이면 안 된다. 생성 실패, current 화면과 맞지 않는 완료, terminal ready 뒤 빈 facet projection, 또는 사용할 수 있는 출력 없이 끝난 경우에는 loading 상태를 내리고 terminal 상태로 닫는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card

- description: 생성이 성공한 inline AI comment는 같은 화면의 action 위치에 `다시 생성` 액션 하나를 노출한다. 사용자가 다시 생성을 시작하면 기존 comment를 지우지 않고 진행 상태를 보여 주며, 새 성공 comment가 도착했을 때만 교체한다. 재생성이 실패하거나 사용할 수 있는 출력 없이 끝나면 기존 성공 comment를 보존하고 진행 상태를 내린다. 이전 요청의 늦은 완료는 현재 comment나 진행 상태를 바꾸지 못한다. 첫 생성이 실패하면 진행 상태만 내리고 새 comment를 만들지 않으며, 생성 중에는 다시 생성이나 중단 action을 노출하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:route-view-ai-comment-inline-surface-transport-timeout

- description: AI comment generation transport가 응답 없이 실패하거나 route가 non-OK를 반환하면 첫 생성은 pending inline reaction을 붙잡지 않고 새 AI comment 없이 닫힌다. 기존 comment를 재생성하던 중이면 기존 settled comment를 보존하고 재생성 pending 상태만 내린다. Transport error가 아니어도 route AI comment generation이 렌더 가능한 출력 없이 종료되면 같은 terminal 경계로 닫는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:route-view-ai-comment-inline-surface-fast-lane-budget

- description: 자동 route-owned AI comment는 legacy interactive reaction stream이나 고비용 agent/tool loop를 쓰지 않고, 짧고 제한된 structured generation 경로를 사용한다. 서버 생성과 client transport는 각각 bounded deadline 안에서 닫히고 출력 크기도 제한된다. 제한 시간을 넘기거나 유효한 출력이 없으면 성공 comment를 상상하지 않고 기존 terminal/no-output 경계로 닫는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

## Runtime ownership

Scheduler, execution identity, stale completion guard, model, deadline과 output budget은
`docs/runtime-flows/ai-response-generation.md`가 소유한다.
