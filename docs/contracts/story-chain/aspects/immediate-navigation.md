---
id: aspect:immediate-navigation
slug: immediate-navigation
title: Immediate navigation
appliesTo:
  - promise:search-failure-degraded-at-url
  - promise:search-url-restores-search
  - promise:search-query-route-transition
  - promise:search-results-suggest-english-terms
  - promise:inline-analysis-auto-run
  - promise:gap-led-next-search
  - promise:gap-network-detection-from-search
  - promise:citation-lineage
  - promise:similar-papers-discovery
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/immediate-navigation.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Immediate navigation

## Why

연구자가 검색을 제출하거나 연구 용어·다른 입장·비슷한 논문 같은 후속 링크를
누르는 순간, 화면이 바로 반응해야 탐색 흐름이 끊기지 않는다. 클릭과 화면 전환
사이에 서버 왕복이 끼면 그 왕복의 지연이 통째로 "아무 일도 안 일어나는 시간"으로
체감된다. 이 문제는 한 번에 만들어지지 않는다 — 전환 앞의 서버 호출이 처음에는
싸다가, 의존성의 비용 모델이 바뀌면(외부 HTTP, 히스토리에 비례하는 조회) 코드
diff에 드러나지 않은 채 느려진다. 그래서 "전환은 왕복을 기다리지 않는다"는
지역적 구현 선택이 아니라 횡단 규칙으로 고정한다.

## Pointcut

이 Aspect는 사용자 클릭이 새 탐색 화면(route)이나 저장 artifact route로의 전환을
시작하는 Promise에 적용한다. 현재 pointcut은 검색 제출(메인 route 검색창, 빈
`/search` 중앙 입력, 결과 내 재검색), 검색 후속 클릭(연구 용어, 다른 입장,
비슷한 논문, graph-neighbors 후속), 그리고 연구 공백 리포트 생성처럼 새 detached
브라우저 문서가 열리는 handoff다.

## Advice

클릭에서 화면 전환은 서버 왕복 완료를 기다리지 않는다. 클릭은 즉시 실행
조건(query 또는 seed)이 담긴 목적지 URL로 이동하고, provider 실행은 목적지에서
시작한다. 저장 artifact id가 아직 없어서 목적지 id URL을 바로 만들 수 없는
detached handoff도 `about:blank` 같은 브라우저 빈 문서를 붙잡지 않는다. user
activation 안에서 열린 visible target은 `/gap?opening=1`처럼 제품이 소유한 pending
route를 먼저 표시하고, reservation이 끝난 뒤 같은 target을 artifact id route로
이동한다. Next App Router가 목적지 payload를 기다리더라도 전환을 시작하는
클라이언트 코드는 전환 앞에서 fetch를 await하지 않는다. seed 같은 전환 맥락은
목적지 URL 파라미터로 운반한다. analytics 방출도 전환을 잡지 않으며, 실행을
소유한 쪽이 방출한다.

키워드나 검색 단서를 선택해 같은 창의 `/search?q=`로 이동할 때는 route 응답을
기다리는 동안 출발 화면이 그대로 남을 수 있다. 이때 출발 화면은 선택한 검색어를
포함한 짧은 클릭 수신 상태를 현재 scroll viewport에 즉시 덧붙인다. persistent
screen-level status region은 문구 변경을 공지하되 `aria-busy`로 공지를 보류하지
않는다. 기존 결과를 대체하지 않으며 실제 검색 처리 상태도 소유하지 않는다. 검색
처리는 계속 목적지 route의 `search processing state`가 소유한다. 목적지 route가
도착하거나 navigation 호출이 동기적으로 실패하면 같은 activation identity만 지운다.
App Router의 비동기 실패를 `router.push()` 반환값으로 관찰할 수 있다고 가정하지
않으며, route가 바뀌지 않으면 bounded stale cleanup으로 닫는다. 더 늦게 시작된 클릭
상태를 이전 cleanup이 지우지 않는다. activation state와 timer는 research shell 수명에
묶여 shell unmount 뒤 남지 않는다. detached click은 현재 창의 상태를 바꾸지 않는다.

검색을 시작하는 명시적 버튼이 `논문검색` 또는 `[검색어] 으로 논문 검색`처럼
검색 실행을 직접 가리킬 때는 클릭한 버튼도 같은 activation을 즉시 드러낸다. 버튼은
회전 표시와 `aria-busy` 상태를 보여 주고 같은 이동이 진행되는 동안 비활성화된다.
버튼 상태는 screen-level status와 같은 shell Context에서 파생한다. 별도 처리 상태나
provider 진행률을 만들지 않는다. 여러 검색 진입점에 같은 query가 있을 수 있으므로
버튼은 query 문자열만이 아니라 자신이 여는 route identity가 현재 activation과 일치할
때만 이 상태를 보여 준다.

## Verification

`immediate-navigation.ledger.yaml`의 advice-to-evidence matrix와 각 owning ledger의
acceptance-check 행들이 검색 제출이
fetch 없이 즉시 조건이 담긴 URL로 이동하고, 목적지가 URL 조건으로 provider 실행을 시작함을 검증한다. 후속 클릭의 즉시 전환은 각 follow-up Promise의
전용 ledger가 닫는다. 연구 용어 plain click이 client fetch 없이 `/search?q=` entry
URL로 이동하고 seed를 목적지 route metadata로 운반하는 증거는
`search-result-window.ledger.yaml`의
`acceptance-check:search-results-suggest-english-terms-prefilled-search`가 닫는다.
첫 검색 화면과 상단 route 검색창의 `논문검색` 버튼 피드백은
`search-query-route-transition.ledger.yaml`의
`acceptance-check:search-query-route-transition-submit-feedback`이 닫는다.
클릭 직후 출발 화면에 선택한 검색어를 표시하면서 기존 결과를 유지하는 증거와
route 도착·동기 navigation invocation 실패·bounded identity cleanup 증거는 `search-result-window.ledger.yaml`,
`inline-analysis.ledger.yaml`, `gap-led-next-search.ledger.yaml`의 `click-feedback`
Acceptance Check가 닫는다.
저자명과 인라인 주제 키워드는 `similar-papers.ledger.yaml`의
`acceptance-check:similar-papers-discovery-author-topic-search` revision 5가 같은 receipt
lifecycle과 detached/no-op 불변을 닫는다.
인용 계보와 graph-neighbor route에서 같은 shared handler를 쓰는 AI comment 연구 용어와
반복 카드 keyword 경로는 `citation-lineage.ledger.yaml`와
`graph-neighbor-papers.ledger.yaml`의 `keyword-click-feedback` Acceptance Check가 닫는다.
graph-neighbors의 즉시-이동은
`promise:graph-neighbor-papers#acceptance-check:graph-neighbor-papers-immediate-navigation`이
같은 규칙의 선행 사례로 잠그고, 인용 계보 seed route의 즉시 전환은
`citation-lineage.ledger.yaml`의
`acceptance-check:citation-lineage-immediate-navigation`이 닫는다. non-corpus similar
fallback의 즉시 전환은 `similar-papers.ledger.yaml`가 잠근다. 연구 공백 리포트
handoff는 `search-gap-handoff.ledger.yaml`가 `/gap?opening=1` product-owned pending
route와 `guard:product-owned-navigation` 정적 가드로 잠근다.
