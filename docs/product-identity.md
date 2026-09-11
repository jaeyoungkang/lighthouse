# Light House — 제품 정체성

Light House는 학술 논문 탐색을 돕는 search-first 어시스턴트다. 연구자는
검색에서 시작해 결과 집합을 살피고, 인용·비슷한 논문 탐색으로 가지를 치고,
필요하면 연구 공백 분석을 실행한다. 시스템은 지금 보이는 result view에 짧은
구조화된 코멘트로 반응한다.

Light House는 논문 탐색을 빠르게 해 주는 도구에 그치지 않는다. 연구자가
논문 지형을 읽고, 주장을 비교하고, 더 나은 연구 질문을 세우도록 돕는다.
Story Chain과 release verdict가 제품 약속을 닫고, 그 약속이 연구자에게 왜
필요한지는 아래 제품 원칙이 설명한다.

신뢰는 핵심 제품 기준이다. 연구자는 검색 결과, AI 반응, 후속 액션이 어떤
데이터 소스에 근거하는지, 그 소스가 왜 이 작업에 충분히 신뢰할 만한지,
소스의 한계가 어디까지인지 이해할 수 있어야 한다. Light House는 AI가 만든
답이 자신 있게 들린다는 이유로 신뢰를 요구하지 않는다. provider,
loaded result set, visible metadata, citation 근거, source 한계를 연구자가
판단 권한을 유지할 만큼 분명하게 드러낸다.

이 파일은 제품 정체성 진입점이다. 사용자 약속, 검증, 시나리오 예시,
evidence는 Story Chain에 있다.

- `contracts/story-chain/` — Experience, Moment, Promise, Aspect, Evidence
  Ledger
- `contracts/story-chain/scenario-catalog.md` — 현재 시나리오 카탈로그
- `runtime-flows/` — runtime 처리 순서 상세. 현재 반응 생성 순서는
  `runtime-flows/ai-response-generation.md`에 있다.

## 제품 원칙

Light House는 Douglas Engelbart의 인간 증강 철학을 따른다. 제품은 연구자가
논문을 찾고, 읽고, 비교하고, 연구 질문을 좁히는 자기 작업을 증강한다.
제품 원칙의 뿌리는 하나다. **연구자의 판단 권한을 지킨다.** 아래 문장들은 이
뿌리를 반복되는 상황에 적용해 둔 판정이다. 문장이 덮지 않는 새 상황이 오면
문장을 늘리기 전에 뿌리에서 판정을 끌어낸다.

- **대신하지 않고 증강한다.** Light House는 검색 결과를 구조화하고, 논문
  지형을 요약하고, citation과 gap 구조를 드러내서 연구자가 자기 연구 활동을
  더 멀리 이어 가게 한다. 연구자의 판단을 대신 내리는 기능은 성능이 좋아도
  제품 원칙 밖이다.
- **현재 상태를 이해할 수 있게 한다.** 사용자는 자신이 시작한 작업이 진행
  중인지, 완료됐는지, 일부만 제공됐는지, 실패했는지를 현재 화면에서 구분할
  수 있어야 한다. Light House는 내부 처리 과정을 모두 노출하지 않지만,
  사용자가 기다릴지, 계속 탐색할지, 다시 시도할지 판단하는 데 필요한 상태와
  다음 행동을 분명히 보여 준다.
- **근거를 보여서 신뢰를 얻는다.** 위 신뢰 기준이 곧 제품 원칙이다. provider,
  loaded result set, visible metadata, citation 근거, source 한계는 연구자가
  판단 권한을 유지할 만큼 계속 보여야 한다.
- **상위 결정은 인간이 내린다.** 제품 방향 결정과 상위 정본(AGENTS.md의
  Ask-first 목록) 변경은 구현 전에 인간 승인이 선행한다. 결정 이후의 전파는
  agent가 소유한다. Story Chain, Evidence Ledger, runtime-flow 문서,
  테스트가 결정을 다시 열지 않고 함께 움직인다.

제품 원칙의 적용 단위는 사용자에게 보이는 surface다. 내부 runtime 경로, 저장
구조, 생성 방식이 달라도 사용자에게 같은 surface로 보이면 같은 원칙
판정을 받는다. 내부 구조의 차이가 사용자에게 보이는 정책 차이를 만들면 그
차이 자체가 제품 원칙 위반이다.

제품 원칙 문장, Promise의 의미, 상위 정본을 바꾸지 않는 변경은 local 구현
결정이다. 셋 중 하나라도 바꾸는 변경은 제품 원칙 변경이고 인간 승인이 먼저다.

## 제품 모델

- 1차 제품 단위는 route가 소유하는 research route payload다. 검색 결과
  view(`/search?q=...`), 파생 탐색 view(`/citation?seedPaperId=...`,
  `/similar?seedPaperId=...`), 영속 gap report(`/gap/:id`)가 있다. 검색과
  탐색 view는 URL 조건의 일시적 실행이고, gap report만 오래 남는 제품
  artifact다.
- Result-card PDF affordance는 Moonlight로 넘긴다. 내부 PDF 문서, reader,
  `/read` route는 없다.
- 검색, 탐색 분기, gap 분석, 후속 액션은 사용자가 시작한다.
- 검색과 후속 surface는 데이터 소스 근거를 드러내야 한다. provider
  이름만으로는 부족하다. Semantic Scholar 같은 provider가 보일 때 UI는 현재
  결과를 만드는 scholarly paper metadata, citation 데이터, loaded-result
  window, query, sort, filter, 알려진 source 한계를 설명해야 한다. provider
  누락은 source 한계로 보여 준다. "관계 없음"이나 "gap 없음"으로 표현하지
  않는다.
- agent는 독립적으로 browsing하거나 자유 대화를 하지 않는다. 지금 보이는
  result view의 snapshot과 `[system]` 이벤트에 반응한다.
- route-view AI 코멘트 API는
  `POST /api/route-ai-comments/generate/:viewId`다. 요청이 visible view
  snapshot을 실어 나른다. 서버는 반응 입력을 만들려고 저장된 레코드를 다시
  읽지 않는다. 탐색 실행의 runtime identity는 인증된 principal에서 나온다.
- 사용자에게 보이는 AI 코멘트는 구조화된 `RouteAiComment-or-null` 결과다.
- 모든 사용자-facing 약속은 Story Chain과 covering Evidence Ledger로
  선언하고 검증한다.

## Research Route 동작

- 탐색의 정본은 조건 URL이다. 검색을 제출하면 브라우저가 즉시
  `/search?q=...`로 이동하고 결과는 같은 URL에서 실행되고 렌더된다. 같은
  URL로 다시 들어오면(back, 공유, 북마크) 같은 조건을 재실행한다. 인용
  계보는 `/citation?seedPaperId=...`, 비슷한 논문은
  `/similar?seedPaperId=...`에서 열린다. seed 논문이 graph route를 쓸 수
  없으면 seed가 담긴 `/search?q=...&entry=similar` 조건 URL로 fallback한다.
  탐색 route는 조건 route이지 저장-id route가 아니다.
- id URL은 gap report만 갖는다. gap 생성은 visible result snapshot을
  입력으로 받아 `gap_reports` artifact를 영속하고 `/gap/:id`로 이동한다. 그
  route는 리포트가 준비될 때까지 building 상태를 렌더하고, 이후에도 직접
  공유할 수 있다.
- 내비게이션과 view 상태의 단독 소유자는 URL이다. 클라이언트 상태는
  브라우저 URL을 push하거나 다시 쓰지 않는다. 후속 액션은 현재 창에서 조건
  URL을 push한다(수정-활성화 클릭과 파생 탐색 view에서의 gap 생성은 조건
  URL을 새 창에서 열 수 있다). 브라우저 Back은 이전 조건을 재실행으로
  복원한다.
- 모든 research route는 화면 상단에 검색 commit 입력 하나를 노출한다.
  제출하면 URL이 `/search?q=...`로 이동하고 콘텐츠는 그 route 검색 입력
  아래에 렌더된다.
- AI 코멘트는 소유 view에 embed된 맥락 보조 surface다. view는 빈 대기
  상태를 예약하지 않는다. 코멘트는 생성 중이거나 코멘트 블록이 존재할 때만
  나타난다. 탐색-view 코멘트는 현재 view snapshot에서 생성되고 그 view와
  함께만 살며 영속되지 않는다. Gap report의 prepared reaction 선택은 현재
  가입자의 preference로 영속되고, 같은 가입자가 `/gap/:id`를 다시 열면 공유
  본문 위에 복원된다.

## AI 코멘트 채널

| 채널                 | 소스                                                              | 역할                                             |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| route-view AI 코멘트 | `POST /api/route-ai-comments/generate/:viewId` structured generation | visible ResearchRoutePayload에 대한 짧은 AI 코멘트 |
| ambient presence     | 클라이언트 결정적 상태                                            | 낮은 주의의 활동 신호. LLM 응답이 아니다         |

`RouteAiComment` payload 한도와 runtime 제약은 스타일 선호가 아니라
계약이다. 보이는 응답 포맷을 바꾸려면 runtime, Story Chain, Evidence Ledger
coverage, runtime-flow 문서, 테스트를 함께 갱신해야 한다.

## 정본 구현 진입점

| 영역                       | 진입점                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| Research route runtime     | `app/components/research/ResearchRouteRuntime.tsx`                                              |
| 검색 실행                  | `app/server/services/search-execution.ts`                                                       |
| 관계 실행                  | `app/server/services/relationship-execution.ts`                                                 |
| Route-view AI 코멘트 생성  | `app/api/route-ai-comments/generate/[id]/route.ts`, `app/server/agent/route-ai-comment-generation.ts` |
| AI 응답 runtime flow       | `docs/runtime-flows/ai-response-generation.md`                                                  |
| 도메인 계약                | `app/domain/`                                                                                   |

## 검증 규칙

"렌더된다"로는 부족하다. 사용자-facing 동작은 다음이 모두 성립할 때만
완료다.

1. Promise와 검증이 최신이다.
2. covering Evidence Ledger가 실행 가능한 evidence를 기록한다.
3. 코드와 테스트가 선언된 경로를 구현한다.
4. runtime 순서나 fallback 동작이 바뀌면 runtime-flow 문서가 최신이다.
5. surface tag와 Mission Control 게이트가 green을 유지한다.
