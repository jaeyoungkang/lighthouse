---
id: promise:gap-report-prepared-reaction
slug: gap-report-prepared-reaction
title: 연구 공백 화면의 prepared reaction 상태와 본문 분석 노출
moment: moment:gap-analysis-from-results
lane: search
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:search-first-url-model
  - aspect:route-view-ai-reaction-rules
  - aspect:ai-generated-content-feedback
  - aspect:provider-failure-degraded-mode
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:gap-build-principal-admission
intentChecks:
  - intent-check:title-and-intro-name-the-discipline
  - intent-check:cluster-background-and-comparison
  - intent-check:gap-inference-method-traceable
acceptanceChecks:
  - acceptance-check:gap-report-prepared-reaction-no-visible-reaction-section
  - acceptance-check:gap-report-prepared-reaction-payload-sync-on-click
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
  - acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
  - acceptance-check:gap-report-prepared-reaction-principal-build-limit
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/414#issuecomment-5261507703
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/417#issuecomment-5263034382

# 연구 공백 화면의 prepared reaction 상태와 본문 분석 노출

## Promise

연구 공백 ResearchRoutePayload는 그래프와 overlay, 본문 설명을 함께 보여 준다.
따로 클릭하지 않아도 분야 흐름, 군집 차이, 공백 추론 근거를 함께 보고 다음
연구 질문을 좁힌다.

## Intent Checks

### intent-check:title-and-intro-name-the-discipline

- question: 본문 도입부와 타이틀이 분석된 학문 분야를 명시하고, 클러스터들이 그 분야 안에서 어떤 위상에 놓여 있는지 전체 조망(관계·비교)을 제공하는가?
- evidence: live judge @ `app/server/services/__tests__/gap-network-content-intent-qualitative.live.test.tsx`
- why live judge: AC3가 "분야명 도입부 + 전체 조망 단락"의 존재 자체는 deterministic하게 잠그지만, 도출된 분야명이 query·클러스터 라벨에서 추론된 학문 영역을 실제로 식별하게 하는지(LLM 1-shot 분류의 품질)와 도입 단락이 클러스터 묶음을 분야 안에 위치시키는 비교 시각을 제공하는지(narrative 창발)는 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
- answer criteria: 타이틀이 원본 query를 그대로 echo하지 않고 분석된 학문 분야명을 노출해야 하고, 본문 첫 단락이 클러스터들의 관계·위상을 분야 맥락에서 비교해 전체 조망을 한 번에 이해 가능해야 한다. 단순 메트릭 나열·키워드 합성에 그치면 Intent 미달성.

### intent-check:cluster-background-and-comparison

- question: 본문이 각 클러스터의 생성 배경(왜 이 묶음이 만들어졌는지)과 클러스터간 차이를 비교 가능한 형태로 서술하는가?
- evidence: live judge @ `app/server/services/__tests__/gap-network-content-intent-qualitative.live.test.tsx`
- why live judge: AC3가 "클러스터별 배경 + 대조 단락"의 존재를 deterministic하게 잠그지만, 배경 서술이 라벨·키워드의 단순 paraphrase가 아닌 묶음 형성 동기를 드러내고, 차이 서술이 다른 클러스터를 명시 참조한 비교문인지(narrative 창발)는 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
- answer criteria: 본문에 각 클러스터에 대해 (a) 그 클러스터가 어떤 연구 결을 묶고 있는지의 배경 + (b) 다른 클러스터와의 차이가 비교 형태(예: "A는 …에 집중하지만 B는 …에 집중한다")로 함께 서술되어야 한다. 라벨·논문 수 나열만으로는 Intent 미달성.

### intent-check:gap-inference-method-traceable

- question: 본문이 공백을 어떤 방법으로 추론했는지(클러스터 크기 기반 기대 연결 수 vs 실제 연결 수, 매개 개념, 인접성)를 사용자가 추적 가능한 형태로 노출하는가?
- evidence: live judge @ `app/server/services/__tests__/gap-network-content-intent-qualitative.live.test.tsx`
- why live judge: AC3가 "공백 추론 방법 단락"의 존재를 deterministic하게 잠그지만, 그 단락이 사용자에게 추론 경로(어떤 신호로 어떤 공백을 식별했는지)를 한 번에 따라가게 하는지는 narrative 창발이다. 단순 수치 dump면 추론을 가리고, 단순 결과 요약이면 방법을 가린다.
- linked acceptance checks:
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
- answer criteria: 본문 한 단락이 (i) 클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다는 방법 + (ii) 매개 개념·인접성 같은 보조 신호를 어떻게 활용했는지를 같이 서술해야 한다. 그 단락에서 대표 공백 1~2개를 그 방법의 예시로 짚으면 더 강하게 답한다.

## Acceptance Checks

### acceptance-check:gap-report-prepared-reaction-no-visible-reaction-section

- description: `gap_network` ResearchRoutePayload는 visible AI 반응 섹션을 렌더하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:gap-report-prepared-reaction-payload-sync-on-click

- description: 클러스터와 공백을 클릭했을 때 보이는 설명은 enrichment가 만든 LLM narrative/proposals에서 나온다. 관계 근거와 의미 있는 gapPairs가 있는 core-ready ResearchRoutePayload에서 enrichment가 아직 `pending`이면 route/display는 그래프 화면으로 전환하지 않고 loading 화면에 머문다. 따라서 deterministic cluster/gap 설명을 사용자-facing 클릭 설명으로 표시하거나 owning gap route AI comment에 sync하지 않는다. enrichment가 `ready`가 되면 `metadata.reactionPreparation`에 담긴 overview/cluster/gap reaction snapshot이 **클릭 시점에 즉시** 현재 viewer의 `(gap_report_id, viewer_principal_id)` preference에 동기화되고 active ResearchRoutePayload에 합성된다. 각 전환 시점의 설명은 정확히 현재 선택에 대응하는 LLM payload로 교체되며, 한 가입자의 선택은 공유 report 본문이나 다른 가입자의 reaction을 바꾸지 않는다. gap 노드/링크는 시각화 안에 남지만 클릭으로 별도 AI comment UI나 overlay를 전환하지 않는다. terminal empty-state처럼 enrichment 대상이 아닌 ResearchRoutePayload는 클릭 설명을 만들지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:gap-report-prepared-reaction-metadata-content-narrative

- description: `gap_network` ResearchRoutePayload 자체의 metadata에 E2 핵심 분석 결과와 준비된 cluster/gap reaction payload가 담긴다. core-ready 상태에서는 `clusters`, `gapPairs`, `metrics`, `metadata.gapNetworkBuild { core: "ready", enrichment: "pending" }`가 먼저 저장된다. 관계 근거와 의미 있는 gapPairs가 있으면 이 단계의 ResearchRoutePayload는 route/display 완료로 취급하지 않고 loading 화면에 머물며, deterministic payload를 최종 클릭 설명으로 노출하지 않는다. enrichment 완료 후 같은 ResearchRoutePayload는 `enrichment: "ready"`로 업데이트되고, 클러스터 narrative · gap meta · proposals, `domainLabel?`, `contentNarrative { overview, clusterParagraphs[], gapInferenceParagraph }`를 저장한다. 이때 prepared cluster reaction body도 LLM cluster narrative를 담는다. enrichment 실패 시 같은 ResearchRoutePayload는 `enrichment: "failed"` phase로 닫히며 core metadata는 유지된다. 이때 `content` markdown 본문은 (i) 분석된 학문 분야명을 도입부에 노출, (ii) 각 클러스터의 생성 배경과 클러스터간 차이를 비교 가능한 형태로 종합 서술, (iii) 공백을 추론한 방법(클러스터 크기 기반 기대 연결 수 vs 실제 연결 수, 매개 개념, 인접성)을 사용자가 추적 가능한 형태로 노출한다. 타이틀은 enrichment 완료 시 `app/lib/knowledge-map-lens.ts` `buildKnowledgeMapTitle("E2", ...)`이 분석된 분야명으로 도출한 결과를 사용한다 (lens별 분기 — E1은 기존 형식 유지). 단, core report가 정착된 뒤 관계 근거가 0건이면 저장된 narrative가 있더라도 UI는 클러스터 배경·차이와 공백 추론 본문을 신뢰 가능한 리포트로 표시하지 않는다. 관계 근거가 있어도 enrichment 본문 prose가 실패하면 하단 본문 리포트를 빈 섹션으로 렌더하지 않고 보강 실패 상태를 표시한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry

- description: narrative enrichment가 실패한 저장 report는 이미 확보한 core graph를 계속 보여 주며, 인증된 사용자의 `분석 다시 시도`만 보강을 다시 요청한다. 중복 요청과 상태 조회·화면 재방문은 보강을 자동으로 다시 시작하지 않는다. 첫 명시적 재시도는 즉시 허용하며, 그 재시도가 다시 실패하면 같은 report의 다음 재시도는 실패 시점부터 60초 동안 비활성화된다. 서버 `Retry-After`와 UI countdown은 같은 남은 시간을 보여 주고, retry-pending 중에도 core graph를 계속 보여 준다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:gap-report-prepared-reaction-principal-build-limit

- description: 한 사용자가 다른 리포트의 Gap 계산을 진행 중이면 현재 리포트의 `분석 다시 시도`는 새 보강 작업을 시작하지 않는다. 기존 core graph와 실패 상태는 그대로 읽을 수 있고, 사용자는 현재 계산이 끝난 뒤 다시 시도해야 함을 이해할 수 있다. 같은 리포트의 반복 요청도 보강 작업을 늘리지 않으며, 기존 report 단위 60초 cooldown은 이 사용자별 제한과 별도로 유지된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback

- description: `gap_network` ResearchRoutePayload는 enrichment가 route/display 완료 조건을 만족한 뒤 수직 stack 페이지 구성으로 사용자에게 노출된다 — `app/components/research-route-renderers/GapNetworkView.tsx`가 (i) 페이지 헤더(분야명 타이틀), (ii) 상단 그래프(`GapNetworkReport`), (iii) 그래프 아래 선택 클러스터 설명 영역, (iv) 하단 본문 리포트(`GapNetworkContentReport`)를 순서대로 노출한다. 선택 클러스터/공백 설명 영역은 enrichment-ready LLM narrative/proposals만 설명으로 보여 준다. enrichment가 pending이면 연구 공백 화면은 수직 stack으로 넘어가지 않고 loading 화면에 머문다. 본문 리포트는 `metadata.gapNetworkReport.domainLabel`과 `contentNarrative`를 React로 직접 렌더(markdown 의존 없음)해 `## 분석된 분야`, `## 클러스터 배경과 차이`(클러스터 라벨/논문 수 헤더 + 단락), `## 공백 추론 방법` 3 섹션을 보여준다. 단, core report가 정착된 뒤 `metadata.gapNetworkReport.metrics.totalEdgeCount`가 0이면 하단 본문 리포트를 렌더하지 않고 상단 `GapNetworkReport`의 연결 근거 부족 상태만 노출한다. metadata가 아직 core-ready가 아니거나 입력 snapshot/metrics가 비어 있는 transient blank report는 상단 그래프나 연결 근거 부족 상태로 렌더하지 않고 공백 관계 계산 중 상태로 유지한다. 관계 근거가 있어도 enrichment가 실패해 `contentNarrative`/cluster narrative가 비어 있으면 하단 본문 리포트를 빈 섹션으로 노출하지 않고 보강 실패 상태를 노출한다. 이 부족 상태는 ResearchRoutePayload metadata의 paper snapshot에서 초록이 있는 논문 수를 세어 전체 논문 수와 함께 보여준다. 설명 영역은 그래프 위에 absolute overlay로 겹치지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3
