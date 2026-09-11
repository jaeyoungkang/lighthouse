# Citation Lineage — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [citation-lineage.ledger.yaml](../citation-lineage.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-08-02 — bounded citation evidence certification met 3/3

```yaml
date: 2026-08-02
acs:
  - intent-check:body-explains-citation-flow-not-counts
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx
runCommitSha: 0c2497950d0a0899edc81250131aac0375dd23b9
observedOutput: 실행 전에 순차 N=3, required quorum 3/3 met, confidence high, unansweredCritical 0, 첫 실패 즉시 중단을 선언했다. 세 생성문은 모두 LSTM·attention·convolution 계열 선행 방법에서 Transformer의 구조 변화로 이어진 흐름과 BERT·GPT-3·Vision Transformer의 후속 확장 방향을 설명했고, 실제 AgentPanel DOM을 본 judge가 세 번 모두 high-confidence met으로 판정했다. 세 번째 표본을 포함한 citation-lineage 원장 26개 structured execution도 모두 통과했다.
gaps:
  - adopt: seed와 양방향 abstract evidence를 bounded canonical snapshot에 포함한 새 product head의 실제 생성문과 judge payload를 3/3 인증 근거로 보존한다.
  - reject: 제목·연도·편수·availability만 나열한 출력이나 snapshot evidence 밖의 관계 추론은 계속 인증하지 않는다.
verdict: met
```

- Judge evidence: `npx vitest run app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx` (attempts 1–2), `npm run evidence-ledger -- --ledger citation-lineage` (attempt 3 and all 26 structured executions)
- Runtime surface: actual Gemini route AI comment rendered through the production inline `AgentPanel` DOM
- Result: `met`
- Attempt policy: sequential N=3, required quorum 3/3 `met`, `confidence=high`, `unansweredCritical=0`; stop immediately on any failure
- Observations: attempt 1 `met/high`, attempt 2 `met/high`, attempt 3 `met/high`; every generation output, DOM, and judge payload is preserved below
- Stability: met 3/3

##### Attempt 1 — runtime AI comment and DOM

```text
[title] Transformer의 학술적 계보
[body] Attention Is All You Need의 Transformer는 기존 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘을 결합한 번역 모델, 그리고 컨볼루션 기반의 효율적 모델들의 흐름을 이어받아 발전했습니다. 이후 Transformer 구조는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델링, 그리고 Vision Transformer의 이미지 도메인 확장 등 다양한 분야로 광범위하게 적용되며 언어와 시각 처리를 아우르는 핵심 아키텍처로 자리 잡았습니다.
[DOM] Attention Is All You Need의 Transformer는 기존 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘을 결합한 번역 모델, 그리고 컨볼루션 기반의 효율적 모델들의 흐름을 이어받아 발전했습니다. 이후 Transformer 구조는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델링, 그리고 Vision Transformer의 이미지 도메인 확장 등 다양한 분야로 광범위하게 적용되며 언어와 시각 처리를 아우르는 핵심 아키텍처로 자리 잡았습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행: '기존 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘을 결합한 번역 모델... 흐름을 이어받아 발전', 후속: 'BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델링, Vision Transformer의 이미지 도메인 확장 등... 적용'","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

##### Attempt 2 — runtime AI comment and DOM

```text
[title] Attention Is All You Need의 인용
[body] 본 논문은 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘, 그리고 병렬 처리를 위한 합성곱 연구의 흐름을 이어받아 순환과 합성곱을 배제한 Transformer 구조를 제시했습니다. 이후 이 구조는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델링, 그리고 Vision Transformer의 이미지 처리 분야 확장으로 이어지며 후속 연구의 핵심 기반이 되었습니다.
[DOM] 본 논문은 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘, 그리고 병렬 처리를 위한 합성곱 연구의 흐름을 이어받아 순환과 합성곱을 배제한 Transformer 구조를 제시했습니다. 이후 이 구조는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델링, 그리고 Vision Transformer의 이미지 처리 분야 확장으로 이어지며 후속 연구의 핵심 기반이 되었습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행(LSTM 기반 시퀀스 학습, 어텐션 메커니즘, 합성곱 연구의 흐름을 이어받아) 및 후속(BERT의 양방향 문맥 이해, GPT-3의 대규모 모델링, ViT 확장으로 이어지며) 관계를 구체적 방법론과 함께 서술함.","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

##### Attempt 3 — runtime AI comment and DOM

```text
[title] Attention Is All You Need의 인용
[body] 본 논문은 기존 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘을 발전시켜, 재귀와 합성곱을 배제한 Transformer 구조를 제안했습니다. 선행 연구인 Sequence to Sequence 학습과 어텐션 기법, 그리고 선형 시간 복잡도의 신경망 모델들의 흐름을 이어받았습니다. 이후 Transformer는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델 확장, 그리고 Vision Transformer를 통한 이미지 인식 분야로 응용되며 언어 모델을 넘어선 범용적 아키텍처로 확장되었습니다.
[DOM] 본 논문은 기존 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘을 발전시켜, 재귀와 합성곱을 배제한 Transformer 구조를 제안했습니다. 선행 연구인 Sequence to Sequence 학습과 어텐션 기법, 그리고 선형 시간 복잡도의 신경망 모델들의 흐름을 이어받았습니다. 이후 Transformer는 BERT의 양방향 문맥 이해, GPT-3의 대규모 언어 모델 확장, 그리고 Vision Transformer를 통한 이미지 인식 분야로 응용되며 언어 모델을 넘어선 범용적 아키텍처로 확장되었습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행 연구인 Sequence to Sequence... 흐름을 이어받았으며, 이후 Transformer는 BERT, GPT-3, Vision Transformer... 범용적 아키텍처로 확장되었다는 두 방향의 흐름을 모두 구체적으로 서술함","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

#### 2026-08-02 — predeclared certification sample stopped at the first not-met attempt

```yaml
date: 2026-08-02
acs:
  - intent-check:body-explains-citation-flow-not-counts
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx
runCommitSha: e2756535336ce48cbc98ce06aeda89bce9bb1e39
observedOutput: 실행 전에 순차 3회와 3/3 met quorum, 첫 실패 즉시 중단, 각 runtime output과 judge payload 원문 보존을 선언했다. 1회차 생성문은 선행·후속 논문명과 각 3편이라는 수만 나열했고 연구 흐름·방법론·주제 관계를 설명하지 않아 judge가 confidence high, verdict not-met으로 판정했다. 선언대로 2·3회차는 실행하지 않았다.
gaps:
  - adopt: 첫 not-met에서 중단하고 실제 생성문과 DOM 및 judge payload를 아래에 그대로 보존한다.
  - reject: 실패 뒤 추가 생성으로 green 표본을 골라내거나 이 표본을 met 근거로 사용하지 않는다.
verdict: unknown
```

- Predeclared policy: sequential N=3, required quorum 3/3 met, confidence high, unansweredCritical 0; any failure stops the sample without retry
- Result: attempt 1 `not-met`; attempts 2 and 3 not run; certification verdict `unknown`

##### Attempt 1 — runtime AI comment

```text
[title] Attention Is All You Need의 인용
[body] 본 논문은 'Sequence to Sequence Learning' 등 3편의 선행 연구를 바탕으로 발전하였으며, 이후 'BERT', 'GPT-3(Language Models are Few-Shot Learners)', 'ViT' 등 3편의 후속 연구에 인용되었습니다. 인용 및 참조 데이터의 가용성 제한으로 인해 전체 목록은 포함되어 있지 않으며, 현재 확인 가능한 범위 내에서의 주요 연결 관계입니다.
```

##### Attempt 1 — runtime DOM output

```text
본 논문은 'Sequence to Sequence Learning' 등 3편의 선행 연구를 바탕으로 발전하였으며, 이후 'BERT', 'GPT-3(Language Models are Few-Shot Learners)', 'ViT' 등 3편의 후속 연구에 인용되었습니다. 인용 및 참조 데이터의 가용성 제한으로 인해 전체 목록은 포함되어 있지 않으며, 현재 확인 가능한 범위 내에서의 주요 연결 관계입니다.다시 생성
```

##### Attempt 1 — judge payload

```json
{
  "results": [
    {
      "questionId": "intent-check:citation-lineage-card-sufficiency",
      "answered": false,
      "evidence": "선행 연구 3편과 후속 연구 3편의 제목만 나열하였을 뿐, 이들이 어떤 흐름이나 방법론에서 파생되었고 어떤 주제로 이어지는지에 대한 구체적인 관계 성격 설명이 결여됨.",
      "confidence": "high"
    }
  ],
  "verdict": "not-met",
  "unansweredCritical": [
    {
      "questionId": "intent-check:citation-lineage-card-sufficiency",
      "answered": false,
      "evidence": "선행 연구 3편과 후속 연구 3편의 제목만 나열하였을 뿐, 이들이 어떤 흐름이나 방법론에서 파생되었고 어떤 주제로 이어지는지에 대한 구체적인 관계 성격 설명이 결여됨.",
      "confidence": "high"
    }
  ]
}
```

#### 2026-08-02 — non-certifying citation live-judge history retained after a not-met sample

```yaml
date: 2026-08-02
acs:
  - intent-check:body-explains-citation-flow-not-counts
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx
runCommitSha: e89c202062bd
observedOutput: 같은 content head의 최초 전체 원장 실행에서 생성문이 선행·후속 논문 이름과 편수만 나열해 judge가 not-met으로 판정했다. 다음 실행 전에 N과 quorum을 선언해야 한다는 현재 strict policy와 달리 진단 재실행 2회를 먼저 수행했고, 그 뒤 선언한 3회와 최종 전체 게이트는 met이었다. 전체 verdict sequence를 보존하지만 개별 generation과 judge payload가 남지 않았고 선언 전 진단 retry가 포함되므로 이 history는 현재 Intent를 인증하지 않는다.
gaps:
  - adopt: 최초 not-met과 뒤의 모든 verdict label을 비인증 history로 보존하고 다음 표본은 실행 전에 N과 quorum 및 artifact 보존을 선언한다.
  - reject: 진단 retry 뒤의 3/3 green을 소급 인증하거나 최초 not-met 관측을 삭제하지 않는다.
verdict: unknown
```

- Judge evidence: `npx vitest run app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx`
- Runtime surface: real Gemini route AI comment body rendered through the inline AgentPanel DOM
- Result: `unknown` because two diagnostic retries preceded the declaration and per-attempt payloads were not retained
- Attempt history: diagnostic runs 뒤 추가 3회 순차 실행, required quorum 3/3을 선언했으나 strict predeclaration boundary는 이미 지나감
- Observations: 최초 전체 실행 `not-met`; 진단 2회 `met`; 선언 표본 3회 모두 `met`; 최종 251-execution 전체 게이트 `met`
- Stability: non-certifying complete verdict sequence `not-met, met, met, met, met, met, met`

#### 2026-08-02 — same-day currentness closeout for bounded citation evidence certification

```yaml
date: 2026-08-02
acs:
  - intent-check:body-explains-citation-flow-not-counts
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx
runCommitSha: 0c2497950d0a0899edc81250131aac0375dd23b9
observedOutput: 같은 날짜의 앞선 unknown 이력을 그대로 보존한 뒤, 위에 원문으로 보존한 새 product head의 사전 선언 N=3 표본이 required quorum 3/3 met, confidence high, unansweredCritical 0을 충족했음을 현재 판정으로 닫는다. 세 생성문과 AgentPanel DOM 및 judge payload는 이 파일의 bounded citation evidence certification 항목에 모두 보존되어 있고 citation-lineage 원장 26개 structured execution도 통과했다.
gaps:
  - adopt: 동일 날짜의 물리적 뒤쪽 항목을 최신으로 선택하는 currentness 규칙에 따라 이 closeout이 위 3/3 인증 결과를 현재 verdict로 명시한다.
  - reject: 앞선 not-met 및 non-certifying unknown 이력을 삭제하거나 새 met 표본으로 소급 해석하지 않는다.
verdict: met
```

#### 2026-08-02 — production-shaped hydrated seed certification met 3/3

```yaml
date: 2026-08-02
acs:
  - intent-check:body-explains-citation-flow-not-counts
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx; app/server/services/__tests__/episteme-literature.test.ts; scripts/evidence-ledger/helpers/__tests__/relationship-execution.test.ts
runCommitSha: 67b1697ab5cff641bdbd3130f52b9a00c43b629f
observedOutput: Fable 5가 앞선 3/3 표본의 seed abstract가 당시 production URL 실행 경로에서 hydrate되지 않는 대표성 결함을 발견했다. 이 head는 seed corpus id를 기존 batch hydration에 포함하고 hydrated seed abstract가 실제 citation ResearchRoutePayload로 전달됨을 결정적 테스트로 고정했다. 그 뒤 실행 전에 순차 N=3, required quorum 3/3 met, confidence high, unansweredCritical 0, 첫 실패 즉시 중단을 선언했고 실제 Gemini 생성문과 AgentPanel DOM을 본 judge가 세 번 모두 high-confidence met으로 판정했다. 세 번째 표본을 포함한 citation-lineage 원장 26개 structured execution도 모두 통과했다.
gaps:
  - adopt: production hydration에서 canonical snapshot까지 이어지는 seed evidence 경로와 새 3/3 생성문·DOM·judge payload를 현재 인증 근거로 함께 보존한다.
  - reject: 앞선 hand-built 3/3 표본을 삭제하거나 production seed hydration을 입증한 표본으로 소급 해석하지 않는다.
verdict: met
```

- Deterministic production-shape evidence: `app/server/services/__tests__/episteme-literature.test.ts` hydrates seed + both directions in one batch; `scripts/evidence-ledger/helpers/__tests__/relationship-execution.test.ts` proves the hydrated seed abstract reaches the ready `citation_lineage` payload
- Live runtime surface: actual Gemini route AI comment rendered through the production inline `AgentPanel` DOM
- Attempt policy: sequential N=3, required quorum 3/3 `met`, `confidence=high`, `unansweredCritical=0`; stop immediately on any failure
- Result: attempt 1 `met/high`, attempt 2 `met/high`, attempt 3 `met/high`; every generation output, DOM, and judge payload is preserved below
- Stability: observed quorum met 3/3; no deterministic-stability claim

##### Corrected attempt 1 — runtime AI comment, DOM, and judge

```text
[title] Attention Is All You Need의 연구
[body] Attention Is All You Need는 기존의 LSTM 기반 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 모델의 흐름을 이어받아 재귀와 합성곱을 배제한 Transformer 구조를 제안했습니다. 이 연구는 이후 BERT의 양방향 문맥 표현 학습, GPT-3의 대규모 파라미터 기반 퓨샷 학습, 그리고 Vision Transformer의 이미지 도메인 확장 등 언어 이해와 생성, 비전 분야 전반으로 응용되며 현대 AI 모델의 핵심적인 기반이 되었습니다.
[DOM] Attention Is All You Need는 기존의 LSTM 기반 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 모델의 흐름을 이어받아 재귀와 합성곱을 배제한 Transformer 구조를 제안했습니다. 이 연구는 이후 BERT의 양방향 문맥 표현 학습, GPT-3의 대규모 파라미터 기반 퓨샷 학습, 그리고 Vision Transformer의 이미지 도메인 확장 등 언어 이해와 생성, 비전 분야 전반으로 응용되며 현대 AI 모델의 핵심적인 기반이 되었습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행: 'LSTM 기반 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 모델의 흐름을 이어받아', 후속: 'BERT의 양방향 문맥 표현 학습, GPT-3의 대규모 파라미터 기반 퓨샷 학습, 그리고 Vision Transformer의 이미지 도메인 확장 등... 응용'","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

##### Corrected attempt 2 — runtime AI comment, DOM, and judge

```text
[title] Attention Is All You Need의 연구
[body] 본 논문은 순환 및 합성곱을 배제하고 어텐션 메커니즘을 도입해 번역 성능과 효율을 개선했습니다. 선행 연구로는 LSTM 기반의 시퀀스 학습(2014), 어텐션 메커니즘 도입(2015), 합성곱 기반의 선형 시간 번역(2017)이 흐름을 형성했습니다. 이후 후속 연구는 이 구조를 계승하여 BERT의 양방향 사전 학습(2019), GPT-3의 대규모 언어 모델 확장(2020), 비전 트랜스포머의 이미지 인식 분야 확장(2021)으로 연구 범위를 넓혔습니다.
[DOM] 본 논문은 순환 및 합성곱을 배제하고 어텐션 메커니즘을 도입해 번역 성능과 효율을 개선했습니다. 선행 연구로는 LSTM 기반의 시퀀스 학습(2014), 어텐션 메커니즘 도입(2015), 합성곱 기반의 선형 시간 번역(2017)이 흐름을 형성했습니다. 이후 후속 연구는 이 구조를 계승하여 BERT의 양방향 사전 학습(2019), GPT-3의 대규모 언어 모델 확장(2020), 비전 트랜스포머의 이미지 인식 분야 확장(2021)으로 연구 범위를 넓혔습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행 연구로는 LSTM 기반의 시퀀스 학습(2014) 등이 흐름을 형성했고, 이후 후속 연구는 이 구조를 계승하여 BERT(2019), GPT-3(2020) 등으로 연구 범위를 넓혔다고 명시함","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

##### Corrected attempt 3 — runtime AI comment, DOM, and judge

```text
[title] Attention Is All You Need의 연구
[body] 본 논문은 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 구조를 거쳐 제안된 Transformer 아키텍처입니다. 이후 후속 연구들은 이를 기반으로 BERT의 양방향 문맥 이해, GPT-3의 대규모 파라미터 기반 일반화, 그리고 Vision Transformer의 이미지 도메인 확장 등 다양한 자연어 처리 및 인식 작업으로 트랜스포머 기술을 성공적으로 확장했습니다. 현재 선행 및 후속 연구의 세부 목록은 데이터 제공 범위의 제한으로 일부 확인되지 않을 수 있습니다.
[DOM] 본 논문은 LSTM 기반의 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 구조를 거쳐 제안된 Transformer 아키텍처입니다. 이후 후속 연구들은 이를 기반으로 BERT의 양방향 문맥 이해, GPT-3의 대규모 파라미터 기반 일반화, 그리고 Vision Transformer의 이미지 도메인 확장 등 다양한 자연어 처리 및 인식 작업으로 트랜스포머 기술을 성공적으로 확장했습니다. 현재 선행 및 후속 연구의 세부 목록은 데이터 제공 범위의 제한으로 일부 확인되지 않을 수 있습니다.다시 생성
```

```json
{"results":[{"questionId":"intent-check:citation-lineage-card-sufficiency","answered":true,"evidence":"선행: 'LSTM 기반의 시퀀스 학습과 어텐션 메커니즘, 그리고 컨볼루션 구조를 거쳐 제안', 후속: 'BERT의 양방향 문맥 이해, GPT-3의 대규모 파라미터 기반 일반화, 그리고 Vision Transformer의 이미지 도메인 확장 등... 확장'","confidence":"high"}],"verdict":"met","unansweredCritical":[]}
```

#### 2026-07-16 — citation relation cards inherit whole-card inspection

```yaml
date: 2026-07-16
acs:
  - acceptance-check:citation-lineage-paper-row-actions-preserved
acReviewedRevision:
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx
runCommitSha: 29e123c6019b+worktree
observedOutput: Citation reference and citation rows use the same repeated paper card as search results. Clicking a non-interactive card region opens or closes inspection, the compact chevron remains an icon-only accessible control, and PDF, lineage, similar-paper, author/topic/follow-up, and library controls stay independent. The title remains identification text and no title-owned tooltip or visible expand/collapse command is rendered.
gaps:
  - adopt: Citation relation rows inherit the shared card interaction and generated-content budget rather than keeping a surface-specific title trigger.
  - reject: Seed context cards and direction headings remain outside the repeated-card disclosure contract.
verdict: met
```

#### 2026-07-12 — citation keyword receipt before destination paint

```yaml
date: 2026-07-12
acs:
  - acceptance-check:citation-lineage-keyword-click-feedback
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/inline-ai-comment-treatment.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.graph-neighbors.test.tsx; app/components/research-route-renderers/__tests__/paper-card-derived-followup-parity.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research/__tests__/search-followup-activation.test.tsx; app/components/research/__tests__/research-route-shell.test.tsx
runCommitSha: c6a4e99ef2f7+worktree
observedOutput: Citation AI-comment research terms and repeated-card keyword follow-ups reach the shared handler. Plain clicks show the selected query in the sticky screen-level receipt while lineage content remains mounted; modifier and middle clicks open the same URL in a detached tab without current-window receipt state.
gaps:
  - adopt: Relationship-view keyword callers are now explicit owners rather than incidental beneficiaries of the search-result contract.
  - reject: The receipt does not replace citation content or become search processing state.
verdict: met
```

#### 2026-07-10 — live judge uses the production inline AgentPanel surface

```yaml
date: 2026-07-10
acs:
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
acReviewedRevision:
  - 1
fixtureRef: app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx; app/components/research/__tests__/AgentPanel.citation-lineage.test.tsx; app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx
runCommitSha: e531e3f5+worktree
observedOutput: The live test no longer renders the retired compact AgentPanel branch. It verifies that the generated reaction title identifies the seed, then judges the actual inline AgentPanel body DOM for a two-direction relationship explanation. CitationLineageView separately keeps the seed title visible in the sticky route-owned context above that inline body.
gaps:
  - adopt: Split the structural title check from the emergent body judge at their real owners.
  - reject: Keeping a test-only compact production branch merely to place the generated title inside the AgentPanel DOM.
verdict: met
```

#### 2026-07-01 — citation reuse refreshes via route AI comment generation route

```yaml
date: 2026-07-01
acs:
  - acceptance-check:citation-lineage-reuse-refreshes-comment
acReviewedRevision:
  - 2
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.citation-lineage.test.tsx; app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx
runCommitSha: worktree
observedOutput: Re-clicking a citation seed navigates to the citation seed condition route instead of consuming the previous search runtime. The destination route bootstrap, not /api/chat and not an existing saved citation redirect, queues a targeted citation_lineage_opened route AI comment generation for the route-owned citation view so the AI reaction refreshes from citation_lineage context.
gaps:
  - adopt: Existing document reuse now treats route bootstrap as the reaction refresh owner; the review uses the current route bootstrap wording.
  - reject: Existing reaction history is not synchronously deleted during navigation; a successful owning-document generation replaces the latest reaction snapshot.
verdict: met
```

#### 2026-06-09 — seed context header pinned on citation-lineage pages

```yaml
date: 2026-06-09
acs:
  - acceptance-check:citation-lineage-seed-title-card-pinned
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx; app/components/research/__tests__/ResearchRouteLayout.narrow.test.tsx; scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs
runCommitSha: 3a82a1512839+worktree
observedOutput: Citation-lineage renders a sticky source-paper context header above references/citations; the document collection overlay is offset below the relationship seed zone, and browser evidence confirms the seed header remains pinned in an overflow-y document scroller after scroll.
gaps:
  - adopt: The citation_lineage seed card is promoted from a static source card to a sticky background-style source-context header, so the user can keep the source paper identity while scanning direct citation directions.
  - reject: Reusing the repeated paper list `SearchResultItem` or `lh-panel` candidate-card styling for the seed context is excluded; the seed header is document context, not another candidate.
verdict: met
```

#### 2026-05-29 — `acceptance-check:citation-lineage-batch-failure-error-reaction` coverage backfill

```yaml
date: 2026-05-29
acs:
  - acceptance-check:citation-lineage-batch-failure-error-reaction
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.citation-lineage.test.tsx
runCommitSha: 52772c994a5b
observedOutput: Citation metadata batch hydration failure emits a `citation_lineage_failed` system event and leaves the document collection unchanged with no follow-up surface, so the batch-failure error-reaction AC is now covered by a passing deterministic test instead of being absent from every dated entry.
gaps:
  - adopt: This AC was listed on no prior dated review entry; per issue #39 it is backfilled here from the current passing test rather than retro-inserted into the 2026-05-28 entry, which only reviewed the citation-first entry-point AC.
  - reject: This entry does not re-review the other ten citation-lineage ACs; their existing dated entries remain the coverage of record.
verdict: met
```

#### 2026-05-28 — search card lineage entry becomes citation-first

```yaml
date: 2026-05-28
acs:
  - acceptance-check:citation-lineage-entry-point-counts-visible
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item.test.tsx; app/components/research-route-renderers/__tests__/SearchView.citation-lineage.test.tsx
runCommitSha: a699dee7854d
observedOutput: Search result cards expose one citation-lineage entry point with citation count as the visible card-level signal, hide separate 선행 count chips, preserve click-through to citation_lineage documents, and still avoid false 선행 0 states for provider-limited references.
gaps:
  - adopt: Reference counts move from the search card into the citation_lineage document where references/citations are separated.
  - reject: Removing citation lineage access is excluded; the card still opens the same lineage document.
verdict: met
```

#### 2026-05-23 — `acceptance-check:citation-lineage-direction-availability-distinguished` propagation review

```yaml
date: 2026-05-23
acs:
  - acceptance-check:citation-lineage-direction-availability-distinguished
  - intent-check:body-explains-citation-flow-not-counts
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/CitationLineageView.test.tsx + app/lib/__tests__/view-snapshot.test.ts
runCommitSha: 3851e92ad7ca
observedOutput: Citation lineage UI rendered true-zero references as 등록되지 않음, provider-limited references as 목록은 아직 제공되거나 추출되지 않았고 실제 선행 연구가 없다는 뜻은 아님, and the route-view snapshot prompt context preserves availability limits so the model does not receive provider-limited directions as false zero-reference claims.
gaps:
  - adopt: Provider-limited reference availability is now visible in the citation_lineage section and in the generated document context before the AI body is produced.
  - reject: This deterministic review does not claim a live LLM provider-limited body run; generated body quality remains covered by the existing Intent Check.
verdict: met
```

- Input: `CitationLineageView.test.tsx` true-zero and provider-limited fixtures plus `view-snapshot.test.ts` citation_lineage snapshot fixture with `referenceAvailability.available=false`. The original 2026-05-23 pass also had a now-retired `reaction-system-prompt.test.ts` prompt assertion; that prompt-loop fixture is preserved here only as historical prose, not as current executable evidence.
- Evidence: targeted vitest confirmed the UI no longer renders provider-limited references as the true-zero empty state and the route-view snapshot context preserves the availability distinction before generation. The historical prompt assertion carried the same instruction into the then-active AI response path.
- Gaps observed:
  - **Adopt-resolved — provider-limited direction state**. Resolution: citation lineage sections and AI input now preserve the availability distinction introduced by Episteme #14 instead of collapsing it into "0편".
  - **Reject — live provider-limited body judge in this pass**. Reason: this change is deterministic propagation of the availability distinction into UI and model input. The live judge remains scoped to relationship-nature body quality and can be refreshed separately if generated limited-state prose drifts.
- Verdict: met
