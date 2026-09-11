---
id: promise:delegate-deep-read-to-moonlight
slug: delegate-deep-read-to-moonlight
title: 논문 정독은 Moonlight로 안내
moment: moment:moonlight-reading-handoff
lane: pdf
status: propagated
acceptanceChecks:
  - acceptance-check:delegate-deep-read-to-moonlight-result-card-link
  - acceptance-check:delegate-deep-read-to-moonlight-href-built-from-paper
  - acceptance-check:delegate-deep-read-to-moonlight-no-broken-link
  - acceptance-check:delegate-deep-read-to-moonlight-opens-new-tab
  - acceptance-check:delegate-deep-read-to-moonlight-result-surfaces
requiredEvents:
  - pdf_opened
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 논문 정독은 Moonlight로 안내

## Promise

검색 결과, 인용 계보, 그래프 이웃에서 PDF가 있는 논문을 더 읽으려 하면
Light House는 내부 PDF view를 만들지 않고 Moonlight 읽기 화면으로 바로
보낸다. 사용자는 탐색 맥락은 Light House에 남겨 둔 채, 본문 정독은
Moonlight에서 이어 간다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:delegate-deep-read-to-moonlight-result-card-link

- description: PDF가 있는 결과 카드의 PDF 버튼은 Light House 내부 PDF view를 생성하지 않고 Moonlight 외부 링크를 렌더한다. 논문 제목은 식별 텍스트로 남으며, Moonlight handoff 경로가 아니라 카드 비조작 영역이 여는 inspection 안에서 전체 내용을 확인한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:delegate-deep-read-to-moonlight-href-built-from-paper

- description: Moonlight href는 논문의 direct PDF URL을 base로 `https://themoonlight.io/file?url=<encoded>` 형식으로 만든다. URL 값 자체는 analytics payload에 넣지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:delegate-deep-read-to-moonlight-no-broken-link

- description: direct PDF URL이 없거나 아직 hydration 중이면 PDF affordance는 확인 중 또는 disabled 상태로 남고, 유효한 Moonlight/external reading target이 확인되면 활성 링크로 바뀐다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:delegate-deep-read-to-moonlight-opens-new-tab

- description: Moonlight 진입 링크는 `target="_blank" rel="noopener noreferrer"`로 새 탭에서 열린다. Light House research route와 현재 탐색 view는 그대로 유지된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.

### acceptance-check:delegate-deep-read-to-moonlight-result-surfaces

- description: 검색 결과, 인용 계보, 그래프 이웃의 공유 논문 카드 surface는 같은 Moonlight handoff 규칙을 쓰고, 카드 inspection과 PDF handoff affordance를 현재 카드 안에서 분리한다. 카드 비조작 영역의 펼침은 PDF 링크 클릭과 함께 발동하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2
