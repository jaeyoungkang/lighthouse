---
id: aspect:ai-generated-content-feedback
slug: ai-generated-content-feedback
title: AI-generated content feedback
appliesTo:
  - promise:inline-analysis-auto-run
  - promise:gap-network-detection-from-search
  - promise:gap-report-prepared-reaction
  - promise:gap-overlay-decision-evidence
coveringLedger: docs/contracts/story-chain/evidence-ledgers/ai-generated-content-feedback.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# AI-generated content feedback

## Why

AI가 만든 코멘트와 분석은 여러 종단 Promise에서 사용자에게 보인다. 사용자는
그 응답이 도움이 됐는지, 빗나갔는지, 충분했는지를 가장 가까운 자리에서
표시할 수 있어야 한다. 이 평가는 응답 품질을 즉시 보장한다는 약속이
아니다. 제품이 어떤 AI 출력이 실제 연구 흐름에서 유효했는지 배울 수 있게
하는 개선 신호다.

## Pointcut

이 Aspect는 AI가 생성하거나 AI 생성 결과를 사용자에게 visible content로
노출하는 Promise에 적용한다.

논문별 인라인 분석, gap 분석 본문, gap overlay처럼 사용자가 AI 생성 내용을
읽고 판단하는 surface가 대상이다. 검색·인용 계보처럼 route-owned
ResearchRoutePayload 상단에 놓이는 짧은 inline reaction은 읽기 밀도와 배치상
평가 affordance를 두지 않는 별도 Promise 정책을 따른다.

## Advice

AI 생성 콘텐츠가 사용자에게 보이는 자리에는 평가 affordance가 함께 있어야
한다. 평가는 사용자가 읽던 흐름을 막지 않는 낮은 마찰의 행동이어야 하며,
평가 UI가 AI 생성 콘텐츠의 본문 의미나 후속 액션을 가리면 안 된다.
반복 목록 안에서 AI 요약이 접힌 상태로 많이 노출되는 surface는 평가 UI를
항상 펼쳐 보이지 않는다. 사용자가 해당 AI 출력의 세부 내용을 펼치거나 집중한
상태에서 평가할 수 있게 하여, 평가 affordance가 탐색 밀도를 해치지 않게 한다.

평가를 제출한 뒤에는 어떤 값이 접수됐는지 사용자가 즉시 볼 수 있어야 한다.
선택된 값은 비선택 버튼과 충분히 구분되는 시각 상태로 남아야 한다. 같은
브라우저 세션 안에서 동일 ResearchRoutePayload 또는 artifact/surface/Promise/output으로 돌아오면 탭
전환이나 surface 재마운트만으로 선택 상태가 사라지면 안 된다. 계정 단위,
기기 간, 또는 장기 이력 복원은 별도 Promise가 생길 때 선언한다.
다만 선택 상태가 버튼 전체를 채워 AI 본문보다 강한 시각 덩어리가 되어서는
안 된다. 선택 표시는 아이콘 내부 채움, stroke, border, 접수 문구처럼 작은
면적의 변화로 제한해 정보 위계를 유지한다.

저장되는 평가는 원본 AI 출력과 연결되어야 한다. 최소한 어떤 ResearchRoutePayload 또는
artifact, 어떤 surface, 어떤 Promise 계열, 어떤 AI 출력 fingerprint에 대한 평가인지
추적할 수 있어야 한다. 평가 값만 남고 원본 출력과 분리되면 개선 신호로 쓸 수
없다. 다만 telemetry payload는 raw AI 출력 본문을 기본 저장하지 않고, hash/length 같은
최소 provenance를 우선한다.

평가는 제품 개선 신호로 보존된다. 이 Aspect는 개별 평가가 즉시 모델 학습,
응답 재생성, 랭킹 변경, 또는 품질 보증으로 이어진다고 약속하지 않는다. 그
운영 루프가 필요하면 별도 Promise로 선언한다.

## Verification

`ai-generated-content-feedback.ledger.yaml`는 적용 Promise별 visible AI surface에
평가 affordance가 있는지, 평가 저장이 원본 ResearchRoutePayload 또는 artifact/surface/output fingerprint와
연결되는지, 제출 후 상태가 보이고 같은 브라우저 세션 안에서 복원되는지,
평가 실패가 읽기 흐름을 깨지 않는지 검증한다.
