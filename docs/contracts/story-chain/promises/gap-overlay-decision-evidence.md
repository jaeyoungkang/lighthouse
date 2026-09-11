---
id: promise:gap-overlay-decision-evidence
slug: gap-overlay-decision-evidence
title: 공백 후보의 근거 기반 가설 자료 유지
moment: moment:gap-analysis-from-results
lane: search
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:search-first-url-model
  - aspect:ai-generated-content-feedback
  - aspect:provider-failure-degraded-mode
  - aspect:reaction-prefers-load-bearing-facts
intentChecks:
  - intent-check:hypothesis-proposals-have-depth
  - intent-check:proposals-grounded-in-system-resources
  - intent-check:meta-is-qualitative-not-numeric
acceptanceChecks:
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 공백 후보의 근거 기반 가설 자료 유지

## Promise

공백 후보를 클릭해 근거와 가설 자료를 바로 본다.
어느 공백이 자기 연구 방향으로 이어질 만한지 보고, 더 파고들 후보를 정한다.

## Intent Checks

### intent-check:hypothesis-proposals-have-depth

- question: body가 1~3개의 구체적 연구 가설 제안을 충분한 깊이로 담는가? "두 분야를 결합하면 좋다" 류 일반론이나 "expected vs observed" 류 정량 진술이 아니라, 어떤 결의 연구 작업이 의미 있는지 결이 잡히고, 작업의 구체와 그 작업이 만드는 가치가 함께 드러나는가?
- evidence: live judge @ `app/server/services/__tests__/gap-card-intent-qualitative.live.test.tsx`
- why live judge: AC가 "proposals 배열 길이 1~3"을 deterministic하게 잠가도, 그 안의 hypothesis 문장이 진짜 연구 방향 결을 잡는지·충분한 깊이로 닫는지는 LLM 창발 품질이며 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
- answer criteria: 각 proposal hypothesis가 (a) 두 군집의 결을 잇는 구체적 연구 작업·접근(어떤 데이터·모델·방법을 어떻게 다루는지)을 서술하고, (b) 그 작업이 만드는 능력·결과·문제 해결을 함께 드러내는 충분한 깊이(2~3문장 또는 80자 이상의 산문)여야 한다. 한 문장 슬로건, 일반론, 정량 비교만, gap의 character와 무관한 추상적 진술, 또는 짧은 진술(40자 미만)로 닫히면 Intent 미달성.

### intent-check:proposals-grounded-in-system-resources

- question: 각 가설 제안이 시스템이 가진 실제 자원(군집 라벨/개념·매개 개념·대표 논문)에 근거해 도출됐다고 grounding 슬롯에서 읽히는가? 데이터 외 과장 추론이면 미달성.
- evidence: live judge @ `app/server/services/__tests__/gap-card-intent-qualitative.live.test.tsx`
- why live judge: AC가 "각 proposal에 grounding 필드 존재"를 deterministic하게 잠가도, 그 grounding 문장이 실제 군집 개념·매개 개념·논문 결을 인용해 "왜 이 가설이 도출됐는지"를 닫는지 vs 형식적으로 채워졌는지는 LLM 창발 품질이며 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
- answer criteria: 각 proposal의 grounding이 실제 군집 라벨·매개 개념·논문 제목 중 하나 이상을 인용해 hypothesis가 그 자원에서 어떻게 도출되는지를 한 문장으로 서술해야 한다. 자원 인용 없이 "관련 분야 연구가 있다" 류 추상적 진술이면 미달성.

### intent-check:meta-is-qualitative-not-numeric

- question: meta가 수치(gap score / expected / observed) 나열이 아닌, 이 공백이 어떤 결인지를 정성적 한 줄로 묘사하는가? cluster pair 식별 + character 묘사가 함께 읽히고, 입력에 영문으로 주어진 도메인 용어(cluster 라벨·기법명·논문명)는 영문 원형으로 보존되는가?
- evidence: live judge @ `app/server/services/__tests__/gap-card-intent-qualitative.live.test.tsx`
- why live judge: AC가 "meta는 정성 한 줄"을 deterministic하게 잠가도, 그 정성 문구가 두 군집의 결과 gap의 character를 함께 전달하는지·영문 도메인 용어를 한국어로 강제 번역해 어색하지 않은지는 LLM 창발 품질이며 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
- answer criteria: meta가 cluster 라벨 두 개를 자연스럽게 포함한 한국어 한 줄 정성 묘사로 닫혀야 하고, 영문으로 들어온 cluster 라벨·도메인 기법명·논문명은 한국어로 번역하지 않고 영문 원형 그대로 한국어 문장 안에 끼워 넣어야 한다. 숫자(gap score / expected / observed)가 등장하거나, "X ↔ Y"만 나열하고 character 묘사가 없거나, 영문 도메인 용어를 한국어로 강제 번역해 원형이 사라지면 Intent 미달성.

## Acceptance Checks

### acceptance-check:gap-overlay-decision-evidence-gap-card-bounds

- description: gap 후보를 클릭하면 그래프가 해당 gap의 두 군집과 gap title로 줌인되고, 그래프 옆 side-panel `<aside>`에 `meta` LLM 정성 한 줄(수치 없음, LLM 실패 시 gapPair-specific facts에서 per-gap diverse fallback) / `proposals` 1~3개 evidence-based hypothesis 항목(각 항목은 `hypothesis` + `grounding` 두 필드, LLM 실패 시 per-gap diverse fallback 1개 — `gapPair.bridgeConcepts`/`leftConcepts`/`rightConcepts`/대표 논문 합성)이 카드 형태로 표시된다. **카드는 SVG 외부 side-panel에 위치하므로 focused viewBox가 두 군집 hull과 gap label을 또렷이 담을 수 있다.** 그래프에는 gap 노드/링크가 계속 보이고 클릭 대상임이 드러나며, 사용자-facing gap 설명은 meta/proposals와 grounded evidence를 우선한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
