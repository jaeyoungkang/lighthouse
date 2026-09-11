---
id: promise:researcher-prose-promises-page
slug: researcher-prose-promises-page
title: 연구자에게 약속하는 경험을 산문으로 한 페이지에서 읽는다
moment: moment:researcher-commitment-page
lane: other
status: propagated
aspects:
  - aspect:user-facing-language-governance
  - aspect:ux-writing-voice-and-tone
  - aspect:common-page-footer
acceptanceChecks:
  - acceptance-check:researcher-prose-promises-page-public-page-with-core-promise-paragraphs
  - acceptance-check:researcher-prose-promises-page-hidden-footnoted-references
  - acceptance-check:researcher-prose-promises-page-user-centered-identity-prose
  - acceptance-check:researcher-prose-promises-page-footnote-section-with-promise-keys
  - acceptance-check:researcher-prose-promises-page-user-text-via-i18n
  - acceptance-check:researcher-prose-promises-page-required-value-facets-covered
  - acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
  - acceptance-check:researcher-prose-promises-page-gap-network-explainer
  - acceptance-check:researcher-prose-promises-page-graph-explainer
  - acceptance-check:researcher-prose-promises-page-ai-comment-type-explainer
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/runtime-flows/search-retrieval-ranking.md#contract-architecture-impact-review`
Concept Shift Architecture Review: `docs/runtime-flows/search-retrieval-ranking.md#concept-shift-architecture-review`
Propagation Map: `docs/runtime-flows/search-retrieval-ranking.md#propagation-map`
CAIR record: `docs/contracts/story-chain/promises/search-results-fast-window.md#contract-architecture-impact-review`
Propagation Map: `docs/contracts/story-chain/promises/search-results-fast-window.md#propagation-map`

# 연구자에게 약속하는 경험을 산문으로 한 페이지에서 읽는다

## Promise

외부 /about/promises 페이지에서 Moonlight Search가 연구자에게 무엇을 약속하는지
연구 장면을 따라 읽게 한다.

## Intent Checks

명시적 Intent Check는 없다.

## Acceptance Checks

### acceptance-check:researcher-prose-promises-page-public-page-with-core-promise-paragraphs

- description: `/about/promises` 페이지가 인증 없이 접근 가능하며, 검색·인라인 분석·인용 계보·PDF·갭 탐지·route-view AI comment 6개 핵심 약속을 연구자가 마주하는 판단 장면 중심의 산문 단락으로 노출한다.
- evidence: vitest @ `app/about/__tests__/promises-page.test.tsx` ("renders 6 core commitment paragraphs with footnoted references"). Locked in `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml` `Promises Page Renders Core Commitments` / `Promises Page Renders Footnoted References` structured execution blocks.

### acceptance-check:researcher-prose-promises-page-hidden-footnoted-references

- description: 각 핵심 약속 단락은 본문에 US ID를 직접 쓰지 않고, 하단 각주 묶음으로 참조를 남긴다. 각주 항목은 대응하는 약속의 정의 US ID를 숨은 참조로 보존한다.
- evidence: vitest @ `app/about/__tests__/promises-page.test.tsx` ("renders 6 core commitment paragraphs with footnoted references") — same test asserts visible prose에는 `promise:`가 없고, 각주 묶음이 6개 항목과 숨은 `data-promise-ref`를 보존한다.

### acceptance-check:researcher-prose-promises-page-user-centered-identity-prose

- description: 페이지 상단에 Moonlight Search의 정체성 한 단락이 도구 자체보다 사용자 경험 중심 언어로 쓰여 있으며, 처음 보는 검색 결과 앞에서 후보 논문·더 읽을 논문·새 질문 후보를 판단하는 장면과 Moonlight 검색 기능으로 통합될 논문 탐색 경험임을 설명한다 ("당신이…" / "Moonlight Search는…").
- evidence: vitest @ `app/about/__tests__/promises-page.test.tsx` ("renders user-experience-centered identity prose at the top of the page"). Asserts the page header carries identity prose using user-centered language (`당신`, `Moonlight Search`), names the Moonlight search integration context, and that the first promise paragraph follows the header in document order.

### acceptance-check:researcher-prose-promises-page-footnote-section-with-promise-keys

- description: 페이지 하단에 핵심 약속의 각주 묶음이 노출되고, 각주 항목은 원래 `promise:` 키를 그대로 표시한다.
- evidence: vitest @ `app/about/__tests__/promises-page.test.tsx` ("renders 6 core commitment paragraphs with footnoted references"). Asserts `[aria-label="각주"]`가 있고 6개의 footnote 항목이 원래 `promise:` 키와 함께 렌더된다.

### acceptance-check:researcher-prose-promises-page-user-text-via-i18n

- description: 모든 사용자 노출 텍스트는 i18n 키(`commitment.*`)로 관리되며 하드코딩 한국어가 없다.
- evidence: enforced by `guard:korean` in `quality:fast` (no hardcoded Korean in `app/about/promises/page.tsx`; all visible text routes through `t("commitment.*")` keys).

### acceptance-check:researcher-prose-promises-page-required-value-facets-covered

- description: `/about/promises` 문단 설정은 필수 가치 facet 목록을 모두 덮는다. 새 핵심 가치가 추가되면 `REQUIRED_PROMISE_VALUE_FACETS`에 먼저 들어가고, 대응 문단의 `valueFacetIds`와 렌더된 `data-value-facets`가 함께 갱신되어야 한다.
- evidence: vitest @ `app/about/__tests__/promises-page.test.tsx` ("covers every required promise value facet"). Asserts required facets, paragraph config facets, and rendered `data-value-facets` coverage match.

### acceptance-check:researcher-prose-promises-page-search-mechanism-explainer

- description: `/about/search` 페이지는 주요 학술 출처를 모은 Moonlight 논문 DB에서 내 라이브러리에 저장한 논문을 참고해 원하는 논문을 찾을 가능성을 어떻게 높이는지 연구자가 읽을 수 있는 공개 설명으로 보여 준다. 페이지는 긴 단계별 산문 카드보다 핵심 관계도에 집중하며, 키워드 검색과 같은 검색어를 반영한 저장 논문 곁의 그래프 이웃 탐색을 같은 시점에 시작해 둘 다 준비된 뒤 한 첫 결과로 합친다는 점을 설명한다. 라이브러리 그래프 후보는 현재 키워드 결과와 제목이 겹치거나 출판연도 범위를 벗어나면 제외한다. 키워드 검색의 첫 결과 목록에 없던 후보도 같은 목록에 합류한다. 양수의 라이브러리 근접도 근거가 있는 논문은 keyword 결과 포함 여부와 무관하게 `내 연구와 가까움`으로 표시한다. keyword 또는 출처 marker는 따로 붙이지 않는다. 검색어 관련도와 라이브러리 근접도는 각각 최종 점수의 최대 절반을 차지하고, 라이브러리 근접도는 그래프 관계 강도와 후보 사이의 상대 순위를 함께 반영한다. `내 연구와 가까움` 표시는 관련성을 확정하거나 필터로 동작하지 않는다. 먼저 keyword-only 결과를 공개한 뒤 뒤늦게 후보를 덧붙이지 않는다. 사용자가 두 기준을 고르는 토글이나 탭은 만들지 않는다. 내부 corpus id/API/provider 이름은 노출하지 않는다. `/about`, `/about/search`, `/about/gap-network`, `/about/graph/sample`, `/about/ai-comments`, `/about/promises`는 같은 공개 about navigation을 노출한다.
- evidence: vitest @ `app/about/__tests__/search-mechanism-page.test.tsx` ("keeps the search mechanism page centered on the co-equal keyword and graph inputs") + `app/about/__tests__/promises-page.test.tsx` ("links to every public about page from the shared navigation"; research-background prose). Locked in `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml`.
- revision: 10

### acceptance-check:researcher-prose-promises-page-gap-network-explainer

- description: 연구 공백 리포트 설명 페이지(`/about/gap-network`)는 검색 결과나 인용 계보의 논문 묶음에서 연구 공백 후보를 어떻게 만드는지 연구자가 읽을 수 있는 공개 설명으로 보여 준다. 페이지는 긴 단계별 산문 카드보다 핵심 관계도에 집중하며, 논문들이 비슷한 흐름끼리 묶이고 묶음 사이의 약한 연결이 다음 질문 후보로 남는다는 점을 관계도와 짧은 요약으로 설명한다.
- evidence: vitest @ `app/about/__tests__/gap-network-mechanism-page.test.tsx` ("keeps the gap report page centered on the core relation map"). Locked in `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml` `Gap Report Mechanism Page Explains Research Gap Analysis` structured execution block.

### acceptance-check:researcher-prose-promises-page-graph-explainer

- description: `/about/graph/sample` 페이지는 그래프 탐색이라는 말을 처음 듣는 연구자도 이해할 수 있도록, `ai for science` 분야 논문 6편의 제목·키워드 카드와 함께 인용/공유 참고문헌 연결이 들어간 핵심 관계도 하나를 고정 예시로 보여 준다. 이 관계도는 학술 그래프 관계를 읽는 법을 설명하며 일반 검색의 실제 후보 수집·순서 메커니즘을 재현한다고 주장하지 않는다. 일반 검색에서는 키워드 검색과 라이브러리 그래프 이웃 탐색이 함께 시작되어 한 결과로 공개된다는 점을 짧게 연결하고, 상세 메커니즘은 `/about/search`가 소유한다.
- evidence: vitest @ `app/about/__tests__/graph-sample-page.test.tsx` ("renders an ai-for-science scholarly relation example without claiming search runtime"). Locked in `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml` `Graph Sample Page Shows Mechanism` structured execution block.
- revision: 1

### acceptance-check:researcher-prose-promises-page-ai-comment-type-explainer

- description: `/about/ai-comments` 페이지는 검색 결과, 인용 계보, 비슷한 논문, 연구 공백 화면, 검색 결과 카드 인라인 분석에서 AI comment가 각각 무엇을 설명하는지 공개 설명으로 보여 준다. 페이지는 AI가 새 논문을 임의 추천하거나 화면 밖 내용을 대신 읽는다는 인상을 주지 않고, 현재 ResearchRoutePayload의 metadata·결과 집합·인용 관계·그래프 근거·prepared report가 comment의 입력 범위임을 설명한다. 내부 runtime 명칭, API route, provider 내부명은 노출하지 않는다.
- evidence: vitest @ `app/about/__tests__/ai-comments-page.test.tsx` ("explains what AI comments do for each public research route payload shape"). Locked in `docs/contracts/story-chain/evidence-ledgers/commitment-pages.ledger.yaml` `AI Comment Type Page Explains Research Route Reactions` structured execution block.
