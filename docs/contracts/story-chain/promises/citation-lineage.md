---
id: promise:citation-lineage
slug: citation-lineage
title: 인용 계보
moment: moment:paper-led-followup-discovery
lane: search
status: propagated
aspects:
  - aspect:research-route-visual-hierarchy
  - aspect:first-paint-persistence-independence
  - aspect:search-first-url-model
  - aspect:immediate-navigation
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:visible-explanation-sufficiency
  - aspect:route-view-ai-reaction-rules
  - aspect:route-view-ai-comment-generation-routing
  - aspect:provider-failure-degraded-mode
  - aspect:reaction-prefers-load-bearing-facts
  - aspect:paper-card-list-windowing
  - aspect:paper-card-presentation-consistency
  - aspect:paper-card-action-loading-feedback
  - aspect:knowledge-map-followup-surface
  - aspect:document-content-width-governance
  - aspect:ai-comment-research-term-suggestions
  - aspect:progressive-content-spatial-stability
intentChecks:
  - intent-check:body-explains-citation-flow-not-counts
acceptanceChecks:
  - acceptance-check:citation-lineage-entry-point-counts-visible
  - acceptance-check:citation-lineage-entry-opens-route-view
  - acceptance-check:citation-lineage-immediate-navigation
  - acceptance-check:citation-lineage-search-first-seed
  - acceptance-check:citation-lineage-metadata-directional-cap
  - acceptance-check:citation-lineage-layout-separates-seed-from-directions
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
  - acceptance-check:citation-lineage-direction-availability-distinguished
  - acceptance-check:citation-lineage-paper-row-actions-preserved
  - acceptance-check:citation-lineage-keyword-click-feedback
  - acceptance-check:citation-lineage-reuse-refreshes-comment
  - acceptance-check:citation-lineage-entry-disabled-when-no-lineage
  - acceptance-check:citation-lineage-batch-failure-error-reaction
  - acceptance-check:citation-lineage-card-list-window
  - acceptance-check:citation-lineage-card-data-hydration
  - acceptance-check:citation-lineage-no-graph-neighbor-axes
  - acceptance-check:citation-lineage-seed-title-card-pinned
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# 인용 계보

## Promise

특정 논문의 인용 계보를 열어 선행 연구와 후속 연구를 함께 본다.
이 논문이 어디에서 왔고 어디로 이어지는지 보고, 더 읽을지 선행·후속
연구로 따라갈지 판단한다.

## Intent Checks

### intent-check:body-explains-citation-flow-not-counts

- question: AI body가 seed 논문의 인용 관계를 단순 편수 나열이 아니라 "어떤 흐름에서 파생되어 어디로 이어지는가"라는 관계의 의미로 충분히 설명하는가?
- evidence: live judge @ `app/server/services/__tests__/citation-lineage-intent-qualitative.live.test.tsx`
- why live judge: AC5가 body 존재와 host-owned follow-up 경계를 deterministic하게 닫고 direction availability AC가 실제 0편과 provider-limited 상태의 구분을 강제하지만, body가 "references 10편, citations 5편" 같은 숫자 나열이 아니라 seed 논문 중심으로 선행·후속의 관계 성격(주제 흐름·방법 계보·후속 응용 방향)을 충분히 설명하는지는 LLM body 생성의 창발 속성이다. 구성요소 존재 체크만으로는 "인용이 많다"/"관련 연구가 여럿 있다" 같은 얕은 서술을 통과시킬 수 있으므로 단일 assertion으로 닫히지 않는다.
- linked acceptance checks:
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
- answer criteria: body가 seed 논문을 중심으로 선행 연구가 어떤 흐름·방법에서 왔고 후속 연구가 어떤 방향·주제로 이어지는지를 두 방향 모두 서술해야 한다. "references N편, citations M편" 같은 단순 숫자 나열, "인용이 많다" 수준의 형용, 한쪽 방향만 언급하고 다른 쪽 결을 누락한 경우는 Intent 미달성. 한쪽 방향이 실제 0편이면 그 사실을 명시하고, availability metadata가 목록 미제공·미추출·잘림을 말하면 실제 0편처럼 단정하지 않아야 한다.

## Acceptance Checks

### acceptance-check:citation-lineage-entry-point-counts-visible

- description: 각 논문 항목에 인용 계보 진입점이 표시된다. 검색 결과 카드 기본 상태에서는 인용 수가 주 판단 신호이므로 `인용 N` 또는 count가 없는 `인용 계보` 진입점만 보인다. 선행 연구 수는 카드에서 별도 count chip으로 노출하지 않고, 인용 계보 ResearchRoutePayload를 열었을 때 references 섹션에서 확인한다. 검색 결과에 관계 count와 availability만 있고 목록이 아직 없으면, 검색 결과 카드는 `선행 0`처럼 실제 관계가 없다고 오해되는 문구를 표시하지 않으며 사용자가 계보를 여는 순간에만 선행·후속 방향 목록을 조회한다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC1 evidence.
- revision: 1

### acceptance-check:citation-lineage-entry-opens-route-view

- description: 진입점을 클릭하면 즉시 `/citation?seedPaperId=...` Search-first route로 이동하고, 목적지에서 URL seed paper의 Episteme citation page를 방향별로 lazy fetch해 각 item metadata를 보존한 **새 `citation_lineage` ResearchRoutePayload surface**를 렌더한다. `search` 문서의 변형이 아니며, 첫 결과 paint는 source ResearchRoutePayload lookup, pre-created route record, owned-ResearchRoutePayload dedup, canonical id redirect에 기대지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC2 evidence.

### acceptance-check:citation-lineage-immediate-navigation

- description: 인용 계보 진입점을 클릭하면 provider 실행 완료를 기다리지 않고 즉시 목적지 seed route(`/citation?seedPaperId=...`)로 이동한다. plain click은 현재 브라우저 route를 목적지로 바꾸고, Ctrl/Cmd/가운데 클릭(detached)은 같은 seed URL을 새 브라우저 탭에서 열며 현재 브라우저 route와 출발 ResearchRoutePayload 상태는 바꾸지 않는다(출발 화면에서 문서를 추가하지 않는다). 목적지 route는 URL seed로 provider를 실행해 같은 URL에서 `citation_lineage` ResearchRoutePayload를 렌더하고, 실패하면 같은 ResearchRoutePayload surface에서 `aspect:provider-failure-degraded-mode`와 같은 통일 degraded 안내와 재시도를 보여 준다. `citation_lineage_opened` route AI comment generation은 클릭이 직접 발화하지 않고 목적지 route bootstrap이 단일 source로 현재 destination ResearchRoutePayload를 target한다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` immediate-navigation evidence.

### acceptance-check:citation-lineage-search-first-seed

- description: 인용 계보 seed route는 source route payload id를 carry하지 않고, seed paper의 identity/display context(`seedPaperId`, `seedPaperTitle`, optional year/url/citationCount)를 URL 조건으로 운반한다. 목적지 server route는 owned source ResearchRoutePayload를 읽지 않고, 같은 seed의 persisted `citation_lineage` ResearchRoutePayload로 redirect하지 않으며, seed URL에서 복원한 논문만으로 provider 실행을 시작한다. destination route payload id는 client-only ephemeral id라 URL sync가 `/citation/:id`로 승격하지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` search-first-seed evidence.

### acceptance-check:citation-lineage-metadata-directional-cap

- description: `CitationLineageMetadata`에 `seedPaper` + lazy citation page에서 수집한 `referenceIds` + `citationIds`가 저장된다. 방향별 최대 20편씩, 총 40편 이하이며, `available=false`, `truncated=true`, `reason`, `total`, `returned` 같은 availability metadata를 함께 보존한다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC3 evidence.

### acceptance-check:citation-lineage-layout-separates-seed-from-directions

- description: 전용 뷰(`CitationLineageView`)에서 seed paper 카드는 화면 최상위의 출발점 맥락으로 노출하고, references/citations 섹션의 반복 논문 리스트 카드는 검색 결과 리스트 카드와 같은 shared card 문법을 따른다. references 섹션과 citations 섹션은 **레이아웃 수준에서 분리된 두 집합**으로 렌더한다. 본문 rail은 route content shell 안에서 중앙 정렬된 `1080px` 계열의 폭 정책을 따르고 내부 `px-5` 좌우 padding rail을 중첩하지 않는다. 검색 입력창·정렬·연도 필터는 없다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC4 evidence.

### acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface

- description: `citation_lineage` ResearchRoutePayload에 AI 반응 섹션이 1개 붙는다. 초기 반응은 title(seedPaper 제목 축약 포함)과 body(seedPaper 중심으로 선행 연구가 어떤 흐름·방법에서 왔고 후속 연구가 어떤 방향·주제로 이어지는지를 두 방향 모두 서술하는 충분한 설명)를 포함한다. 선행 연구(references)와 후속 연구(citations) 합계가 1편 이상이면 검색 결과 문서와 동일하게 ResearchRoutePayload 상단 AI comment 영역에 host-owned `연구 공백 지도 만들기` action을 노출하고, 클릭 시 인용 계보 ResearchRoutePayload가 모은 선행+후속 논문 전체를 입력으로 기존 `gap_network` 파이프라인을 새 창으로 시작한다. 이 진입점은 LLM AI 반응 surface가 아니라 인용 계보 ResearchRoutePayload host가 소유하므로(`aspect:knowledge-map-followup-surface`) body-only AI 반응에서도 빠지지 않는다. 한쪽 묶음이 0편이어도 다른 쪽이 1편 이상 있으면 그쪽만으로 입력을 만든다. 선행과 후속이 모두 0편이면 host action 없이 title과 body만으로 닫는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC5 evidence.

### acceptance-check:citation-lineage-direction-availability-distinguished

- description: 한쪽 방향의 수집 목록이 비었을 때 실제 0편과 provider-limited 상태를 구분한다. count와 availability metadata가 실제 0편을 뜻하면 해당 섹션 영역과 AI 반응 생성 입력이 그 사실을 명시한다. `available=false`, `truncated=true`, `reason`, `total`, `returned` 등 metadata가 목록 미제공·미추출·잘림을 뜻하면 섹션 영역과 AI 반응 생성 입력은 "없음"으로 단정하지 않고 제한 상태를 드러낸다. 생성된 AI body가 이 입력을 충분한 관계 설명으로 바꾸는 품질은 `intent-check:body-explains-citation-flow-not-counts`가 닫는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC6 evidence.

### acceptance-check:citation-lineage-paper-row-actions-preserved

- description: 반복 논문 항목은 검색 결과와 같은 카드 inspection과 PDF 동작을 유지한다. 제목은 별도 링크나 버튼이 아니며, 카드의 비조작 영역을 누르면 상세가 열리고 다시 누르면 닫힌다. 카드 안의 PDF·인용 관계·비슷한 논문·저자 같은 명시적 링크와 버튼은 펼침 상태를 바꾸지 않고 고유 동작만 수행한다. PDF 버튼은 직접 열 수 있는 `openAccessPdf.url`이 있을 때만 활성화된다. 검색 결과의 라이브러리 토글은 citation_lineage 뷰에서 노출하지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC7 evidence.
- revision: 2

### acceptance-check:citation-lineage-keyword-click-feedback

- description: 인용 계보의 선행·후속 반복 논문 카드에 표시되는 저자명·인라인 주제·`다른 입장` 후보와 route AI comment의 연구 용어는 같은 search-term handler를 쓴다. plain click은 목적지 응답 전 출발 계보가 남아 있는 동안 선택 query의 짧은 수신 상태를 현재 scroll viewport에 즉시 표시하고 기존 계보·카드를 유지한다. 목적지 route 도착, 동기 navigation 호출 실패, bounded stale timeout은 같은 activation만 정리한다. `ResearchRouteShell` unmount는 timer와 local state를 폐기한다. Ctrl/Cmd/가운데 클릭은 같은 entry URL을 새 탭에서 열고 현재 창의 route·계보 ResearchRoutePayload·수신 상태를 바꾸지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:citation-lineage-reuse-refreshes-comment

- description: 같은 `seedPaper.paperId`의 `citation_lineage` ResearchRoutePayload가 이미 현재 client state에 있어도 클릭은 client dedup 없이 seed route로 이동한다. 목적지는 URL seed로 다시 실행되며, route AI comment generation은 열린 destination ResearchRoutePayload를 target해 이전 검색 ResearchRoutePayload나 stale reaction에 머물지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` reuse-refresh evidence.
- revision: 2

### acceptance-check:citation-lineage-entry-disabled-when-no-lineage

- description: `referenceIds`와 `citationIds`가 모두 빈/null이고, `referenceCount` / `citationCount` / availability metadata도 인용 관계 fetch 가능성을 주지 않으면 진입점을 disabled 처리한다. count가 0인 경우만 실제 0개로 취급하고, 목록 미제공·잘림 상태는 disabled가 아니라 제한 상태로 표시한다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` disabled-entry evidence.

### acceptance-check:citation-lineage-batch-failure-error-reaction

- description: citation page 또는 metadata hydration 실패 시 에러 반응(새 AI-comment 내부 버튼 surface 없음)을 표시한다. 즉시-이동 모델에서 배경 생성이 실패하면 이 에러 반응은 목적지 view 표면에서 `aspect:provider-failure-degraded-mode`와 같은 통일 degraded 안내(현재 view와 검색 결과를 계속 쓸 수 있다는 사실)와 재시도로 나타난다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` failure evidence.

### acceptance-check:citation-lineage-card-list-window

- description: 인용 관계 ResearchRoutePayload의 선행 연구와 후속 연구 섹션은 각각 처음 10편만 렌더하고, `더보기 (N/M)`를 누르면 같은 섹션 안에서 10편씩 추가로 보여준다. 한 방향의 더보기는 다른 방향이나 비슷한 논문 그래프 축의 노출 개수를 바꾸지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC12 evidence.

### acceptance-check:citation-lineage-card-data-hydration

- description: lazy citation page에서 얻은 선행/후속 논문은 route view payload 렌더 전에 검색 결과와 같은 Episteme batch metadata hydration을 거친다. 반복 논문 리스트 카드가 검색 결과 카드와 같은 인라인 분석 파이프라인을 탈 수 있도록 abstract, venue, fields, open access/PDF, external ids를 가능한 한 채운다. batch hydration 실패는 provider 제한 상태로 fallback할 수 있지만 정상 parity evidence로 보지 않는다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` card-data hydration evidence.

### acceptance-check:citation-lineage-no-graph-neighbor-axes

- description: 인용 관계 ResearchRoutePayload 본문은 seed paper, 선행 연구, 후속 연구만 보여준다. 함께 인용되는 논문과 같은 토대를 공유하는 그래프 축은 `비슷한 논문` 전용 ResearchRoutePayload에서만 보여준다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` AC13 evidence.

### acceptance-check:citation-lineage-seed-title-card-pinned

- description: 인용 관계 ResearchRoutePayload는 본문 최상단에 출발 논문의 sticky context header를 항상 고정한다. 이 헤더는 문서가 어떤 논문의 선행·후속 관계를 펼친 것인지 제목, 저자, 연도, 인용 수와 짧은 안내로 드러내며, 선행/후속 섹션·빈 상태·provider-limited 상태보다 먼저 렌더되고 스크롤 중에도 상단에 남는다. 사용자가 섹션 목록만 보고도 "어떤 논문과 관계된 묶음인가"를 잃지 않아야 하므로, 이 header는 반복 후보 리스트 카드와 다른 배경형 문법을 쓰며 제거할 수 없다.
- evidence: covered by `docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml` seed-title-card evidence.
