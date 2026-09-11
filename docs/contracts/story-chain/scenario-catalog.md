# Light House — Scenario Catalog

> Story Chain과 Evidence Ledger가 참조하는 scenario id catalog. 이 문서는
> Promise/Acceptance Check의 의미를 대체하지 않고, alignment audit과 admin
> journey surface가 scenario lane과 label을 안정적으로 읽기 위한 보조 정본이다.
> 화면별 AI 반응의 예시는 현재 런타임 기대를 설명할 때만 사용한다.

이 catalog의 모든 `scenario:*` 항목은 현재 Story Chain의 활성 coverage
의무다. 각 항목은 정확한 Promise Acceptance Check의 Evidence Ledger entry
하나 이상에 `scenarios`로 연결되어야 한다. 아직 조사·결정되지 않은 정책,
제안, 과거 구현 예시는 여기에 넣지 않는다. 현재 기대가 아니게 된 항목은
관련 ledger 참조와 같은 변경에서 활성 catalog에서 제거하고, 필요하면 Git
history나 기존 research 기록에서 이력을 읽는다.

---

## 1. 검색 ResearchRoutePayload (search)

### 시나리오 scenario:moonlight-search-route-handoff: Moonlight 검색 진입 인증 연계

상황: Moonlight에 이미 인증된 연구자가 Moonlight에서 Light House의
`/` 또는 `/search?q=ai+for+science` route로 들어온다. research shell은 server
layout의 인증 왕복 없이 먼저 렌더된다. browser bootstrap이 세션을 확인하면 쿼리
실행과 라이브러리 기준 연결이 challenge 없이 이어진다. 미인증이거나 세션이
만료됐으면 같은 route의 content slot이 인증 화면으로 바뀐다.

```txt
title: Moonlight 인증 검색 진입
body: research shell이 먼저 뜨고, 인증되면 같은 주소에서 검색과 라이브러리 연결이 이어진다.
surface: search entry auth handoff
```

### 시나리오 scenario:research-auth-bootstrap-required: bootstrap 401 인증 전환

상황: 사용자가 익명 상태이거나 기존 세션이 만료된 채 research route에 들어온다.
research shell은 먼저 렌더되지만 library bootstrap이 401을 반환한다. 공용 shell은 현재
research content와 active view session, background task를 내리고 기존 Moonlight 인증 화면을
content slot에 렌더한다. 세션 교환이 성공하면 인증 화면을 유지한 채 같은 URL과 query를
문서 전체 navigation으로 다시 연다. token 발급 403은 allowlist 안내를 유지하고, 그 밖의
교환 실패는 stale local session 삭제를 최대 1초 동안 시도하고, 멈춘 요청은 취소한 뒤
EmailGate로 이어진다.

```txt
title: 만료 세션 인증 전환
body: bootstrap 401 뒤 기존 연구 콘텐츠를 인증 화면으로 바꾸고, 인증 성공 뒤 같은 주소로 돌아간다.
surface: research route auth challenge
```

### 시나리오 scenario:search-initial-visible-window: 첫 검색 결과 창

상황: 사용자가 `"ai for science"`를 검색했고 35편이 반환됐다. 검색 ResearchRoutePayload는 첫 화면에 10편을 바로 보여주고 전체 결과 수를 함께 드러낸다.

```txt
title: AI for Science 연구 35편
body: 첫 10편을 먼저 보여주고, 나머지는 더보기로 이어서 확인할 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-load-more-window: 검색 결과 더보기

상황: 사용자가 검색 결과 ResearchRoutePayload에서 더보기를 누른다. 다음 10편이 추가되고 버튼은 현재 표시 수와 전체 수를 계속 알려준다.

```txt
title: 검색 결과 더보기
body: 다음 10편을 같은 ResearchRoutePayload에 이어 붙이고, 더 볼 결과가 없으면 더보기 affordance를 닫는다.
surface: (없음)
```

### 시나리오 scenario:search-spelling-correction: 맞춤법 교정 검색

상황: 사용자가 오타가 있는 검색어를 제출했다. 제품은 원 검색 결과를 먼저
보여준 뒤, 명백한 맞춤법 오류를 교정한 검색어로 다시 검색할 수 있다고
제안한다.

```txt
title: 맞춤법 교정 제안
body: 원 검색 결과를 유지한 채 원 검색어와 교정 검색어를 함께 보여주고, 사용자가 선택할 때만 교정 검색어로 새 검색을 시작한다.
surface: (없음)
```

### 시나리오 scenario:search-english-term-discovery: AI comment 안 연구 용어 탐색

상황: 사용자가 한국어 표현이나 아직 덜 정리된 말로 논문을 검색했다. 검색
결과 view는 현재 결과 제목·초록과 inline analysis 맥락을 앵커로 LLM이 추출한
accepted term 중 원 검색어 자체나 너무 넓은 라벨에 머물지 않는 영어 표현을
AI comment 본문 문장 안의 텍스트 링크로 보여준다. 사용자는 같은
검색 결과 본문 안에서 후보 용어를 눌러 다음 검색으로 이어 간다. 이어진
검색은 현재 `reviewed_papers` source를 자동으로 참고하되 결과 기준 상태를 운반하지 않고,
용어 출처 trace는 URL이 아니라 metadata로만 남긴다.

```txt
title: AI comment 안 연구 용어
body: 현재 결과 제목·초록과 inline analysis 맥락에서 추출된 accepted term을 본문형 문장 안의 클릭 가능한 텍스트 링크로 제시한다. 용어는 정답이 아니라 다음 검색을 시도해 볼 관측 단서이며, 이어진 검색의 출처는 metadata에만 남긴다.
surface: search results view
```

### 시나리오 scenario:search-view-reaction-respond-format: 검색 완료 반응 포맷

상황: 검색이 완료되고 route AI comment generation runtime이 metadata 기반 검색 완료 반응을 생성한다.

```txt
title: AI for Science 연구 35편
body: 바이오·분자 기초모델, 자율 실험, 연구 에이전트 축이 결과를 이끈다.
검증 루프 연결은 아직 얇다.
surface:
  none
header action:
  - navigate: 연구 공백 지도 만들기
```

### 시나리오 scenario:search-view-reaction-host-owned-followup: 검색 완료 host-owned 후속 진입점

상황: `"quantum error correction topological"` 검색에서 7편만 반환됨. 결과가
적어도 검색 결과 기준 row 우측에 연구 공백 지도 만들기 action을 노출한다.

```txt
title: 양자 오류 정정 7편
body: 토폴로지컬 코드 중심의 소수 결과만 검색됐다. 결과가 적어 연구 공백은
제한적일 수 있다.
surface:
  none
header action:
  - navigate: 연구 공백 지도 만들기
```

### 시나리오 scenario:search-provider-failure-degraded: 검색 반응 provider failure

상황: 검색 결과 view는 만들어졌지만 AI provider hard failure 또는 LLM key
누락으로 검색 완료 반응을 생성할 수 없다.

```txt
title: AI 반응 불가
body: 모델 응답을 받지 못해 AI comment를 만들 수 없다. 현재 view는 계속 사용할 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-representative-paper-cards: 대표 논문 리스트 표시

상황: 검색 결과가 렌더된다. 클라이언트가 검색 결과 metadata와 현재 결과 내부
graph support로 대표 논문을 결정적으로 고르고, 별도 후속 버튼 대신 결과
리스트 카드에 `대표` 배지를 표시한다. 사용자가 `대표 논문` 필터를 켜면 현재
노출된 리스트는 대표 배지가 붙은 카드만 남는다.

```txt
result list:
  - The AI Scientist [대표]
  - Autonomous Materials Discovery
  - Agent Laboratory [대표]
```

### 시나리오 scenario:search-inline-analysis-visible-first: 보이는 논문 우선 인라인 분석

상황: 검색 결과의 현재 렌더된 result window 카드에 대해 인라인 분석이 자동 시작된다. 더보기 뒤에 숨은 카드는 선제 분석하지 않고, 현재 window의 카드 id만 분석하며 분석 상태를 각 카드 안에 표시한다.

```txt
title: 인라인 분석 시작
body: 현재 보이는 카드의 요약·주제·방법·결과를 채우고, 더보기 뒤에 숨은 카드는 보이기 전까지 자동 분석하지 않는다.
surface: (없음)
```

### 시나리오 scenario:search-inline-analysis-cache-retry: 인라인 분석 캐시와 재시도

상황: 일부 논문은 이미 분석 캐시가 있고 일부는 실패한다. 캐시는 즉시 재사용하고 실패한 항목은 retry queue로 보낸다.

```txt
title: 인라인 분석 갱신
body: 캐시된 분석은 즉시 보여주고, 실패한 논문은 재시도 대상으로 남긴다.
surface: (없음)
```

### 시나리오 scenario:search-inline-analysis-preserves-reaction: 인라인 분석과 검색 반응 분리

상황: 인라인 분석이 진행되거나 완료되어도 검색 완료 AI 반응과 결과 리스트의 대표 논문 표시/필터는 재계산하지 않는다.

```txt
title: 검색 반응 유지
body: 논문별 보조 분석은 각 카드에만 반영되고, ResearchRoutePayload의 AI 반응 카드는 유지된다.
surface: (없음)
```

### 시나리오 scenario:search-selected-sort: 선택 정렬 유지

상황: 사용자가 검색 결과에서 인용순, 최신순, 오래된순 중 하나를 선택한다. 검색 결과가 다시 로드되거나 같은 검색 ResearchRoutePayload가 remount되어도 선택한 정렬 기준과 표시 순서가 유지된다.

```txt
title: 정렬 유지
body: 선택한 정렬 기준으로 결과가 계속 보이고, 오래된순은 출판연도 오름차순으로 표시된다.
surface: (없음)
```

### 시나리오 scenario:search-library-interest-default: 라이브러리 근거를 반영한 통합 정렬

상황: 누적 라이브러리를 가진 연구자가 검색한다. 검색어 결과 최대 40편과 라이브러리 그래프 결과 최대 40편을 모두 한 목록에 넣고, 같은 논문은 한 번만 남긴다. 검색어 관련도 순위와 라이브러리 근접 순위를 함께 반영하고, 양쪽에 모두 걸친 논문은 두 근거를 받아 올라간다. 어느 한 출처도 출처라는 이유만으로 상단 전체를 선점하지 않는다. 양수의 query-aware 라이브러리 그래프 근접도 근거가 있는 논문은 keyword 결과 포함 여부와 무관하게 `내 연구와 가까움` marker를 보인다. Keyword-only 후보는 marker 없이 같은 목록에 남으며, 결과 기준을 고르는 토글이나 탭은 없다.

```txt
title: 라이브러리 근거를 반영한 통합 정렬
body: 검색어 관련도와 내 라이브러리 근접도를 자동으로 함께 반영한 한 목록을 보고, 라이브러리 근접도 근거가 있는 논문은 내 연구와 가까운 후보로 확인한다.
surface: (없음)
```

### 시나리오 scenario:search-library-discovery: 라이브러리 근접 논문 통합

상황: keyword 결과 창에는 없지만 같은 검색어를 반영한 탐색에서 내 라이브러리 그래프와
가까운 후보가 있다. 이 후보는 그래프 결과 최대 40편의 범위에서 검색어 결과 논문과
같은 결과 목록에 합류한다.
검색어 순위와 라이브러리 근접 순위를 결합한 순서로 함께 정렬되고 같은 논문은 한 번만
남는다.
별도 섹션이나 3·6·9 고정 슬롯은 없으며 결과 수·더보기·후속 입력에도 함께 참여한다.

```txt
title: 검색어와 라이브러리를 반영한 통합 결과
body: 검색어와 내 라이브러리에서 찾은 논문을 한 목록에서 점수 순으로 살펴본다.
surface: (없음)
```

### 시나리오 scenario:search-nonascii-library-relevance: 한국어 검색어의 호환 라이브러리 보충 후보

상황: 저장된 과거 검색 snapshot에 한국어 검색어와 라이브러리 그래프 보충 후보가 있다.
기존 snapshot reader는 Hangul/CJK 관련성 문턱을 그대로 적용해 충분히 맞닿은 후보와 약한
문자 조각만 우연히 겹친 후보를 구분한다. 새 검색 writer는 언어별 token admission 없이
라이브러리 그래프 결과 최대 40편을 combined pool에 합류시키고 legacy visibility event를
발화하지 않는다.

```txt
title: 한국어 검색의 호환 보충 후보
body: 저장된 과거 검색에서는 한국어 검색어와 충분히 맞닿은 라이브러리 근접 후보를 기존 기준으로 구분한다.
surface: (없음)
```

### 시나리오 scenario:search-no-library-signal-degraded: 라이브러리 신호 없는 일반 검색

상황: 라이브러리 컨텍스트가 없으면 일반 검색으로 실행한다. 라이브러리 컨텍스트가 있으면 query-aware graph proximity로 라이브러리 근접 순위를 만든 뒤 검색어 순위와 함께 반영한다. 현재 combined pool에 양수인 라이브러리 근접 신호가 없으면 provider 순서를 보여 주고 header에는 라이브러리 반영 없음이라고 설명한다. 결과 기준 토글이나 비활성 탭은 보이지 않는다.

```txt
title: 일반 검색
body: graph 근접 신호가 있으면 라이브러리 근접 순위를 검색어 순위와 함께 반영하고, 없으면 provider 순서를 유지한다.
surface: (없음)
```

### 시나리오 scenario:search-library-grounding-unavailable: 라이브러리를 반영하지 못한 keyword 결과

상황: 내 라이브러리에 검색에 쓸 논문이 있지만 첫 결과를 확정하는 graph preflight나
source read가 일시적으로 unavailable하다. 검색 결과는 실패하지 않고 keyword 결과를
provider 순서로 보여 준다. 결과 header는 내 라이브러리를 이번 결과에 반영하지 못했지만
검색 결과는 계속 볼 수 있다고 안내한다. 같은 keyword 결과, 필터, 정렬, 논문 카드와 후속
읽기 동작은 계속 사용할 수 있다. 라이브러리가 없거나 provider가 정상 응답했지만 graph
신호가 없는 경우에는 실패 안내가 나타나지 않는다.

```txt
title: 내 라이브러리 일시 미반영
body: 내 라이브러리를 이번 결과에 반영하지 못했지만 검색 결과는 계속 볼 수 있다.
surface: search result header
```

### 시나리오 scenario:search-personalization-opt-out: 과거 결과 기준 주소 호환

상황: 연구자가 과거에 공유되거나 저장된 `personalize=false`, `sort=relevance` 또는 `sort=interest` 검색 주소를 직접 연다. 입력은 잘못된 주소로 거부되지 않지만 현재 검색은 이를 결과 기준 선택으로 해석하지 않고 단일 통합 결과와 기본순으로 정규화한다. 검색 화면에는 결과 기준 토글·탭·별도 입력이 없고, 새 검색 submit과 연구 용어·저자·주제·다른 입장 같은 후속 검색도 basis 파라미터를 만들지 않는다. 외부 analytics history와 과거 snapshot의 값만 호환 데이터로 남는다.

```txt
title: 과거 결과 기준 주소 호환
body: 과거 basis 주소도 열 수 있지만 현재 검색은 한 통합 결과의 기본순으로 실행하고 새 주소에는 그 값을 쓰지 않는다.
surface: (없음)
```

### 시나리오 scenario:search-reviewed-papers-context-source: reviewed_papers 기준 source와 목록 표시

상황: 인증된 연구자는 post-search 상단 검색바와 계정 사이의 `내 라이브러리`에서 내부
`reviewed_papers`에 저장된 Light House 라이브러리 목록을 볼 수 있다. 목록 UI는
`/api/papers/reviewed`를 읽어 논문 제목과 내부 라이브러리 folder label을 보여 주고,
저장된 논문이 없으면 빈 상태를 보여 준다. 연구자가 목록에서 논문을 해제하면 같은
`reviewed_papers` DELETE 경로가 실행되고 화면 store와 내부 availability가 갱신된다.
다음 검색은 현재 사용자 `reviewed_papers` source가 제공하는 라이브러리 근거를
검색어 관련도와 한 통합 projection에 자동으로 반영한다. 첫 `/search` 화면처럼 상단
검색바가 숨은 route에서도 서버는 내부 availability와 display list를 seed할 수 있다.
이 목록 UI는 현재 검색 기준 토글이나 정렬 select를
대신하지 않는다.

```txt
title: 내 라이브러리 목록 표시와 해제
body: 내부 reviewed_papers 라이브러리 목록은 볼 수 있고 해제할 수 있으며, 다음 검색은 현재 reviewed_papers source의 근거를 검색어 관련도와 자동으로 함께 반영한다.
surface: research route search bar
```

### 시나리오 scenario:search-library-bootstrap-background: 검색 shell 이후 라이브러리 기준 seed

상황: 인증된 연구자가 `/search` 또는 `/search?q=...`로 들어온다. Light House는
현재 사용자 확인 뒤 먼저 research shell을 렌더하고, 내부 `reviewed_papers` source와
compatibility Moonlight library source, preset paper title hydration은 browser mount 후
background bootstrap endpoint가 읽어 store에 반영한다. 401이 아닌 transport·response
실패는 검색 shell을 일반 검색 기준으로 유지한다. 401은
`scenario:research-auth-bootstrap-required` 인증 전환이 소유한다.

```txt
title: 검색 shell 먼저 표시
body: 라이브러리 기준은 화면이 뜬 뒤 배경에서 채워지고, 인증 외 실패면 일반 검색 기준으로 유지된다.
surface: search runtime
```

### 시나리오 scenario:search-library-source-sync: Moonlight 라이브러리 원 소스 동기화

상황: `LIGHTHOUSE_LIBRARY_GROUNDING_ENABLED=1` compatibility 경로에서 연구자의
Moonlight 라이브러리 원본이 바뀐 뒤 Light House가 새 검색이나 background hydration을
실행한다. Light House에 저장된 이전 검색의 라이브러리 snapshot은 그 검색을 설명하는
기록으로 남지만, 현재 외부 라이브러리 기준을 다시 계산할 때는 Moonlight 서버를 먼저
읽는다. 저장된 선택 fingerprint는 현재 Moonlight 원본을 필터링하는 데만 쓰인다.
기본 제품 경로의 원 소스는 내부 `reviewed_papers`다.

```txt
title: Moonlight compatibility 원 소스 재동기화
body: external-source 경로의 새 검색과 hydration은 Moonlight 서버에서 현재 라이브러리를 다시 읽고, 저장된 검색 snapshot은 해당 검색 기준 설명으로만 쓴다.
surface: search runtime
```

### 시나리오 scenario:search-result-library-add: 검색 결과에서 라이브러리에 추가·해제

상황: 연구자가 검색 결과 목록을 훑다가 나중에 읽어 둘 논문을 발견한다.
결과 카드 제목 줄의 외곽선 북마크 토글을 누르면 해당 논문이 현재 사용자
기준 Light House 라이브러리 상태에 저장된다. 이미 저장된 논문은 같은 제목 줄의
채워진 success 북마크로 바뀌며, 그 토글을 누르면 해제된다. 이 저장 상태는 내부
`reviewed_papers` 기반 라이브러리 근접 신호의 원천이다. 새 검색은 이 source를 자동으로
참고한다.

```txt
title: 검색 결과에서 라이브러리에 추가·해제
body: 결과 카드 제목 줄의 compact 북마크 토글로 논문을 저장하거나 해제한다. 저장된 카드는 채워진 success 북마크로 식별되고, 현재 저장 상태는 다음 검색의 라이브러리 근접 신호 source가 된다.
surface: search result card
```

### 시나리오 scenario:search-query-route-transition-recovery: 새 query 전환과 복구

상황: 결과가 있는 search route에서 사용자가 새 query를 제출한다. 제품은 route-level search request를 즉시 큐에 넣고, 새 결과가 commit된 뒤 직전 결과 컨텍스트로 되돌리는 행동을 제공한다.

```txt
title: 검색 전환
body: 새 query 결과가 commit되고, 직전 결과 컨텍스트로 되돌릴 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-query-route-transition-reaction-hygiene: 새 query 전환 시 이전 반응 제거

상황: 사용자가 결과가 있는 search route에서 새 query를 제출한다. 새 result commit 전에 이전 AI 반응과 인라인 분석 cycle을 즉시 비운다.

```txt
title: 검색 교체 완료
body: 새 query 결과가 commit되고, 이전 AI 반응은 새 결과에 섞이지 않는다.
surface: (없음)
```

### 시나리오 scenario:search-hard-error: 검색 실패

상황: Episteme 검색 API 오류.

```txt
title: 검색에 실패했습니다
body: 외부 검색 서비스에 일시적 문제가 있다. 잠시 후 다시 시도해달라.
surface: (없음)
```

### 시나리오 scenario:search-gap-analysis-entry: 연구 공백 지도 만들기 선택 후

상황: 검색 결과 기준 row 우측에서 "연구 공백 지도 만들기"를 누르면 `gap_network`
ResearchRoutePayload가 새 창에서 생성된다. 이때 입력은 현재 정렬·필터가 적용된 검색 결과 상위 40편
표본이다. 화면에 먼저 보이는 10편 window나 대표 논문 표시 필터, AI comment 생성
입력 cap이 연구 공백 리포트 입력을 대신하지 않는다. 검색 ResearchRoutePayload의 AI 반응은 유지되고,
검색 메타는 결과 조망에 집중하고, 연구 용어 텍스트는 AI comment 안에서 용어
탐색에 집중한다.

### 시나리오 scenario:search-inline-analysis-partial-failure: 인라인 분석 일부 실패

상황: 검색 결과 카드 일부의 인라인 분석만 실패했다. 성공한 카드와 검색 결과
목록은 유지되고, 실패한 카드의 생성 콘텐츠 영역만 실패 상태와 명시적 재시도
경로를 보여 준다.

```txt
title: 일부 논문 분석 실패
body: 완료된 논문 분석과 검색 결과는 그대로 볼 수 있다. 실패한 논문은 해당
카드에서 다시 분석할 수 있다.
surface:
  none
header action:
  - navigate: 연구 공백 지도 만들기
```

### 시나리오 scenario:search-empty-results: 검색 결과 0편

```txt
title: 검색 결과가 없습니다
body: 이 키워드로는 논문이 검색되지 않았다. 키워드를 바꾸거나 더 넓은
주제로 다시 검색해볼 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-similar-papers-entry: 검색 결과에서 확장 탐색

상황: 사용자가 검색 결과 카드의 비슷한 논문, 저자명, 주제 키워드 같은 진입점을 누른다. 키워드형 진입점은 그 용어의 `/search?q=...` 조건 주소로 즉시 이동하고, graph lookup을 만들 수 없는 non-corpus 비슷한 논문 fallback도 같은 단일 결과 모델로 실행한다. 결과 기준 상태는 조건 주소에 싣지 않는다. 기존 검색 문맥을 잃지 않고 새 검색으로 확장 탐색한다.

```txt
title: 확장 검색 시작
body: 선택한 논문 또는 키워드에서 출발한 새 검색 ResearchRoutePayload를 연다. 이미 같은 출발점의 ResearchRoutePayload가 있으면 그 route view로 이동한다.
surface: (없음)
```

### 시나리오 scenario:search-similar-papers-query: 유사 논문 쿼리 구성

상황: 사용자가 비슷한 논문을 누른다. 제목 첫 5단어와 인라인 분석 topics 상위 3개를 조합하고, topics가 없으면 제목만으로 쿼리를 만든다.

```txt
title: 유사 논문 검색어
body: 출발 논문의 제목과 주제 키워드로 새 검색어를 구성한다.
surface: (없음)
```

### 시나리오 scenario:search-similar-papers-exclude-seed: 출발 논문 제외

상황: 유사 논문 검색 결과가 도착한다. 결과 목록은 출발 논문 자체를 제외하고 `seedPaper` metadata를 유지한다.

```txt
title: 유사 논문 결과
body: 출발 논문은 결과에서 제외하고 관련 논문만 새 search view에 보여준다.
surface: (없음)
```

### 시나리오 scenario:graph-neighbor-axes-shown: 그래프로 이어진 관련 논문

상황: 사용자가 한 논문에서 비슷한 논문을 연다. 전용 view 최상단에는 출발 논문 sticky context header가 고정되어 사용자가 스크롤 중에도 어떤 논문 곁의 관계를 보고 있는지 확인한다. 그 아래에 그 논문과 자주 함께 인용되는 논문과 같은 참고문헌 토대를 공유하는 논문이 두 축으로 나뉘어 보인다. 각 후보에는 공동 인용 횟수 또는 공유 참고문헌 수가 근거 수치로 붙는다.

```txt
title: 그래프로 이어진 논문
body: 출발 논문 context header를 sticky로 먼저 보여준 뒤, 함께 인용되는 논문과 같은 토대를 공유하는 논문을 두 축으로 보여준다. 각 후보에 함께 인용된 횟수 또는 공유한 참고문헌 수를 함께 적는다.
surface: (없음)
```

### 시나리오 scenario:graph-neighbor-provider-degraded: 그래프 축 degrade

상황: 그래프 관계 조회가 실패하거나 결과가 비어 있다. 비슷한 논문 ResearchRoutePayload는 출발 논문 sticky context header를 유지한 채, 그래프 축 자리에 degraded 안내나 정직한 부재 문장을 보여준다. 인용 계보 본체는 그대로 유지되고, 인용 관계 ResearchRoutePayload 안에서는 그래프 축 degraded/empty 상태를 렌더하지 않는다.

```txt
title: 비슷한 논문 없음
body: 비슷한 논문 ResearchRoutePayload는 출발 논문을 먼저 보여주고, 그래프 관계를 가져오지 못하면 재시도 안내를 둔다. 시도했으나 비면 비슷한 논문을 찾지 못했다고 짧게 알린다.
surface: (없음)
```

---

## 2. 인용 계보 route view (citation_lineage)

### 시나리오 scenario:citation-provider-failure: 인용 계보 조회 실패

상황: Episteme Paper Batch API 호출 실패.

```txt
title: 인용 계보를 불러올 수 없습니다
body: 외부 API에서 논문 메타데이터를 가져오지 못했다. 잠시 후 다시
시도해달라.
surface: (없음)
```

### 시나리오 scenario:citation-03-03-01: 검색 결과의 인용 계보 진입점

상황: 검색 결과 카드에 `인용 계보 · 선행 N · 후속 M` 진입점이 노출된다.
누르면 클라이언트에서 citation 문서를 만들거나 dedup하지 않고
`/citation?seedPaperId=...` 조건 주소로 즉시 이동한다. 목적지 route가 URL의
출발 논문 조건으로 인용 계보를 다시 실행하고 ephemeral `citation_lineage`
view와 그 view의 AI comment generation을 소유한다. references와 citations
양쪽 ID와 availability/count 근거가 모두 없으면 진입점이 disabled된다.

```txt
title: 인용 계보 view로 이동
body: 목적지에서 이 논문의 선행과 후속 논문 묶음을 보여준다.
surface: (없음)
```

### 시나리오 scenario:citation-03-03-02: 인용 계보 view 렌더

상황: citation_lineage route view가 열린다. seed paper card가 상단에 있고 references와 citations이 헤딩으로 분리되어 노출된다. direction별 ID는 20/20으로 cap된 뒤 메타데이터 fetch 결과가 본래 순서로 채워진다. references/citations의 반복 논문 리스트 카드는 검색 결과 리스트 카드와 같은 shared card 표현을 쓴다. 제목은 식별 텍스트로 남고 카드 비조작 영역이 inspection을 열고 닫으며, PDF 같은 명시적 액션은 카드 toggle과 분리된다. 별도 검색 입력은 없다.

```txt
title: Transformer 논문의 인용 계보
body: 이 논문이 참조한 선행 15편과 이 논문을 인용한 후속 18편을 분리해 보여준다.
surface: (없음)
```

### 시나리오 scenario:citation-limited-direction: 반응 카드 + 방향별 제한 상태

상황: citation_lineage route view의 AI comment는 title/body가 있는 단일 카드로 렌더된다. 선행/후속 입력이 있으면 검색 결과와 같은 host-owned `연구 공백 지도 만들기` action이 view 상단 AI comment 영역에 표시된다(AI reaction 카드 안의 follow-up surface가 아니다). 한 방향이 실제 0편이면 그 섹션과 body가 0편임을 말하고, provider가 목록 미제공·미추출·잘림 상태를 반환하면 섹션과 body가 실제 없음으로 단정하지 않고 제한 상태를 말한다.

```txt
title: 인용 계보 요약
body: 이 논문의 선행 목록은 아직 제공되거나 추출되지 않았다. 실제 선행 연구가 없다는 뜻은 아니며, 후속 인용은 아직 없다.
surface: (없음)
```

---

## 3. 연구 공백 화면 (gap_network)

참고: 아래 내용은 gap report route view에 준비되는 reaction snapshot 예시다. Light House는 이 view 타입에 AgentPanel을 렌더하지 않으므로, 사용자는 별도 AI 반응 패널 대신 그래프와 선택 오버레이만 본다.

### 시나리오 scenario:search-gap-network-generated: 연구 공백 리포트 생성

상황: `"AI research automation"` 검색 결과에서 여러 클러스터 관계의 gap이 정리됨.

```txt
title: ML-Neuroscience 사이 공백 발견
body: ML 클러스터와 Neuroscience 클러스터 사이 연결이 기대 대비 크게
부족하다. 강화학습의 신경과학적 기반 연구가 교차점이 될 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-gap-view-field-overview: 연구 공백 화면 분야 조망

상황: 연구 공백 화면이 생성된다. 본문 도입부는 분석된 학문 분야와 클러스터들이 그 분야 안에서 놓이는 위치를 설명한다.

```txt
title: AI 연구 자동화 지형
body: 에이전트 실험 자동화, 과학 발견 워크플로, 검증 루프 클러스터가 서로 다른 연구 축으로 나뉜다.
surface: (없음)
```

### 시나리오 scenario:search-gap-view-method-trace: 공백 추론 방법 노출

상황: 사용자가 연구 공백 화면 본문에서 공백 추론 방법을 확인한다. 본문은 기대 연결 수와 실제 연결 수, 매개 개념, 인접성을 설명한다.

```txt
title: 공백 추론 방법
body: 클러스터 크기 기반 기대 연결과 실제 연결의 차이를 보고, 매개 개념으로 연구 공백 후보를 설명한다.
surface: (없음)
```

### 시나리오 scenario:search-gap-report-prepared-reaction: 연구 공백 화면 prepared reaction 동기화

상황: gap_network ResearchRoutePayload는 별도 AI reaction 패널을 만들지 않고 prepared reaction snapshot을 그래프와 본문 surface에 반영한다.

```txt
title: 연구 공백 결과
body: prepared reaction은 gap report 본문 설명과 그래프 오버레이로 동기화되고, 별도 반응 카드는 렌더하지 않는다.
surface: (없음)
```

### 시나리오 scenario:search-gap-no-clear-gap: 뚜렷한 갭 없음

```txt
title: 뚜렷한 연구 공백 없음
body: 검색된 논문들이 비교적 밀접하게 연결되어 있어 구조적 공백이
탐지되지 않았다. 검색 범위를 넓히면 교차 영역이 드러날 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-gap-link-display: gap 링크 표시

```txt
title: (없음)
body: gap 노드/링크는 그래프 안에 계속 표시되지만 클릭 overlay나 AI reaction 전환을 만들지 않는다.
surface: (없음)
```

### 시나리오 scenario:search-gap-cluster-detail-grounding: 클러스터 클릭

```txt
title: Neuroscience 클러스터
body: Neuroscience는 대표 개념과 관련 논문이 모인 군집이다. 핵심 개념과
주요 키워드 연결을 그래프 아래 설명 영역에서 정리한다.
surface: (없음)
```

### 시나리오 scenario:search-gap-insufficient-evidence: 연구 공백 근거 부족

```txt
title: 연구 공백 근거가 부족합니다
body: 검색 결과의 논문 수가 적거나 관계 근거가 부족해 네트워크 분석이
어렵다. 검색 범위를 넓히면 분석이 가능해질 수 있다.
surface: (없음)
```

### 시나리오 scenario:search-gap-overlay-hypothesis-evidence: hypothesis fallback

```txt
title: ML-Neuro 사이 공백 발견
body: ML과 Neuroscience 사이에 연결이 부족하다. 강화학습과 의사결정
신경과학의 교차 연구가 가능한 출발점이다.
surface: (없음)
```

---

## 4. Search-first route와 저장 아티팩트 관리

### Moonlight PDF handoff

### 시나리오 scenario:pdf-04-01-01: Moonlight card href build

상황: 검색 결과, 인용 계보, 그래프 이웃의 논문 카드에 PDF URL이 있다. PDF 버튼은 `https://themoonlight.io/file?url=<encoded>` 형식의 Moonlight 외부 href를 렌더해 정독 handoff를 소유한다. 제목은 식별 텍스트로 남고 카드 비조작 영역이 inspection을 열고 닫는다. PDF 버튼은 이 toggle과 독립적으로 동작한다. PDF URL 후보가 없거나 hydration 중이면 깨진 링크를 렌더하지 않는다.

```txt
title: PDF
body: 이 논문은 Moonlight 새 탭에서 정독으로 이어진다.
surface: (없음)
```

### 시나리오 scenario:pdf-04-01-02: Moonlight card 새 탭 위임

상황: 사용자가 논문 카드의 PDF 버튼을 누른다. `target="_blank" rel="noopener noreferrer"`로 새 탭이 열려 현재 Light House research route는 그대로 유지된다.

```txt
title: Moonlight에서 열림
body: 새 탭에서 Moonlight가 PDF를 받아 정독을 진행한다. Light House 연구 route는 그대로 유지된다.
surface: (없음)
```

### 시나리오 scenario:research-route-search-shell: Route search shell

상황: 인증된 사용자가 검색 결과, 인용 계보, 그래프 이웃, 갭 네트워크 같은 탐색
route를 보고 있다. 화면 최상단에는 공통 검색 입력이 있다. 사용자가 여기서 검색어를
제출하면 현재 화면 종류와 무관하게 브라우저 주소가 그 조건의 `/search?q=...`로
즉시 바뀌고, 검색은 같은 주소에서 실행된다. 현재 라이브러리 기준은 조건
주소의 파라미터로 유지된다.

```txt
title: Route search
body: 현재 연구 route에서 새 검색을 시작한다.
surface: research route search input
```

### 시나리오 scenario:research-route-canonical-url: Canonical research URL

상황: 인증된 사용자가 탐색 화면을 직접 열면 화면은 하나의 탐색만 보여 주고,
브라우저 URL은 탐색 조건 주소 — 검색 `/search?q=...`, 인용 계보
`/citation?seedPaperId=...`, 비슷한 논문 `/similar?seedPaperId=...` — 또는 연구 공백 리포트의
`/gap/:id`를 가리킨다. 같은 조건 주소를 새로 열거나 공유하면 같은 조건의
탐색이 다시 실행되고, 연구 공백 리포트는 `/gap/:id` artifact route에서 복원된다.
탐색 화면 사이의 전환은 browser history에 쌓이므로 뒤로가기로 이전 조건
화면이 다시 열린다. 조건 주소는 재실행되고, `/gap/:id`는 gap report artifact를 복원한다.

```txt
title: Research URL
body: 현재 탐색은 브라우저 주소로 다시 열 수 있다.
surface: research route
```

### 시나리오 scenario:research-route-rest-collection: Gap report REST artifact

상황: authenticated client나 route가 가입자 공유 연구 공백 아티팩트를
생성하거나 상태를 확인하거나 다시 연다. 요청은 gap 아티팩트 API
(`/api/gap-reports` 계열 생성·status·조회)를 사용하고, 생성 입력은
현재 화면의 share-safe 결과 스냅샷이다. 생성자와 무관하게 인증 가입자는 report
URL로 본문을 읽고, reaction 선택은 현재 viewer별로 저장된다. 검색·인용 계보·비슷한
논문 실행은 route-owned view snapshot으로 닫히고, gap report만 artifact API를 호출한다.

```txt
title: Gap report artifact
body: 연구 공백 아티팩트 본문을 가입자가 URL로 공유하고 reaction은 viewer별로 쓴다.
surface: gap report API
```

---

## 예외 시나리오 요약

| 문서 | 예외 | 시나리오 | 대응 방식 |
|---|---|---|---|
| **search** | API 실패 | scenario:search-hard-error | 재시도 안내, 선택지 없음 |
| **search** | 인라인 분석 일부 실패 | scenario:search-inline-analysis-partial-failure | 성공분으로 진행, 실패 투명 고지 |
| **search** | 결과 0편 | scenario:search-empty-results | 키워드 변경 안내 |
| **search** | AI provider hard failure/LLM key 누락 | scenario:search-provider-failure-degraded | view와 검색 결과는 유지, AI comment 없음 |
| **citation_lineage** | Batch API 실패 | scenario:citation-provider-failure | 재시도 안내, 선택지 없음 |
| **citation_lineage** | 한 방향 0편 또는 목록 제한 | scenario:citation-limited-direction | 실제 0편과 미제공·미추출·잘림을 구분 |
| **gap** | 관계 근거 부족 | scenario:search-gap-insufficient-evidence | 검색 범위 확대 안내 |
| **gap** | hypothesis LLM 실패 | scenario:search-gap-overlay-hypothesis-evidence | deterministic fallback |

예외 응답 원칙:
1. 짧게: `body ≤ 400자`
2. 투명하게: 무엇이 실패했는지 드러낸다.
3. 다음 행동 제시: surface 대신 body에서 재시도나 다른 경로를 짧게 안내한다.
4. 경험을 끊지 않는다: fallback이 있으면 surface 없이 자동 fallback으로 진행한다.

---

## 반응 품질 체크리스트

- [ ] title ≤ 30자
- [ ] body ≤ 400자
- [ ] 마크다운 없음
- [ ] 에러 상황에서 surface 없음
- [ ] body가 현재 view 근거에만 묶여 있다
- [ ] 조작 affordance는 AI comment 내부 버튼이 아니라 host-owned UI에 있다
- [ ] 예외 상황에서 원인이 투명하게 드러난다
