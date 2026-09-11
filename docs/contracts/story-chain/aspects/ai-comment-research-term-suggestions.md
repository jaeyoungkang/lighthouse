---
id: aspect:ai-comment-research-term-suggestions
slug: ai-comment-research-term-suggestions
title: AI comment research term suggestions
appliesTo:
  - promise:search-results-suggest-english-terms
  - promise:search-results-fast-window
  - promise:search-reaction-summarizes-terrain
  - promise:citation-lineage
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/ai-comment-research-term-suggestions.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# AI Comment Research Term Suggestions

## Why

연구 용어 제안은 사용자가 "다음 검색어로 무엇을 눌러 볼까"를 판단하는 단서다.
따라서 카드형 개요나 별도 row로 결과 목록을 밀어내기보다, 사용자가 이미
결과 해설을 읽는 AI comment 안에서 기존 term-discovery 후보를 문장 속
clickable text로 보이는 편이 자연스럽다. 생성 해설과 용어 제안은 같은 frame
안에서 이어 읽히되, 연구 공백 action은 owning host의 별도 action 위치가
소유한다. 검색 결과에서는 result-basis row, 인용 계보와 비슷한 논문에서는
AI comment frame보다 앞선 ResearchRoutePayload 상단 action 위치가 그 경계다.

## Pointcut

이 Aspect는 검색 결과, 인용 계보, 비슷한 논문처럼 ResearchRoutePayload 상단에 AI comment를
가진 ResearchRoutePayload host가 현재 탐색 화면의 논문 묶음에서 근거 있는 연구 용어 후보를
갖는 경우에 적용한다.

검색 결과는 `englishTermDiscovery`가 현재 결과 제목·초록과 inline analysis
맥락에서 만든 후보를 쓴다. 인용 계보와 비슷한 논문 ResearchRoutePayload는 현재 탐색 화면의
출발 논문과 관계 논문 묶음에 이미 저장된 inline analysis semantic
profile에서 근거 있는 영어 구절 후보를 만들고, 같은 AI comment text
treatment로 표시한다. 이 Aspect는 후보가 없는데 LLM이 새 용어를 꾸며 내라는
뜻이 아니다.

## Advice

- 연구 용어 제안은 AI comment frame 안에서 기존 term-discovery 후보를
  "주요 연구 용어 …" 형태의 본문형 문장 안에 낮은 밀도 텍스트 링크로
  바로 이어 붙인다. 이 문장은 AI comment의 읽기 흐름을 끊지 않는 compact
  text-link treatment가 소유한다.
- AI comment frame은 generated prose와 연구 용어 링크를 같은 읽기 흐름 안에
  둔다. generated prose는
  주변 검색 결과 UI와 같은 본문 크기에 맞추고, 용어 링크는 텍스트 링크로 이어 붙인다.
- 용어 텍스트는 클릭 가능해야 하며, 클릭하면 그 용어로 후속 검색을 시작한다.
  후속 검색 metadata에는 source query, term, candidate type, support count 같은
  seed 정보를 보존한다.
- 목록은 owning ResearchRoutePayload의 맥락에 앵커링한다. 검색 결과에서는 현재 적재 결과
  묶음, 인용 계보에서는 seed와 방향별 논문 묶음, 비슷한 논문에서는 graph axis와
  seed 논문을 기준으로 한다.
- 원 검색어와 같은 뜻의 말, 너무 넓은 분야 라벨, 단어 하나짜리 일반어는
  후보 품질 필터에서 제외한다. 신뢰할 수 있는 후보가 있을 때만 용어 링크를
  렌더한다.
- 출판연도 분포처럼 결과 전체 metadata를 조망하는 요소는 필터/정렬 컨트롤
  근처의 작은 inline metadata로 남기고, 연구 용어 제안과 시각 역할을 섞지
  않는다.

## Verification

`ai-comment-research-term-suggestions.ledger.yaml`와
`search-result-window.ledger.yaml`가 검색 결과, 인용 계보, 비슷한 논문에서 연구
용어 제안이 AI comment 본문형 문장 안의 clickable text로 렌더되는지 검증한다.
검색 결과의 연구 공백 action은 result-basis row로 분리되고, 인용 계보와
비슷한 논문의 연구 공백 action은 AI comment frame보다 앞선 host-owned 후속
action 위치로 남는다. 출판연도 분포는 검색 결과 필터 묶음과 정렬 사이의 작은 metadata
자리로 분리된다.

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/355#issuecomment-5125404747
