# Shared Memory

이 파일에는 review를 거쳐 승격된 repo 차원의 Project Knowledge가 누적된다. 기본
작업 기억의 저장 위치는 `.project-knowledge-local/work-memory.md`다.

---

## 2026-05-09 Project Knowledge를 narrative 기억 흐름으로 도입한 배경

이 결정은 세션이 바뀌어도 작업 판단을 이어받고, repo 차원의 반복 판단만 공유하기
위해 Project Knowledge 흐름을 도입했다. 당시에는 세션 기억과 공유 지식이 한
문서에 섞여 stale해지는 문제가 있었다.

로컬 작업 기억과 공유 기억을 분리한 이유는 현재 작업의 임시 상태가 다음
기여자에게 적용되는 규칙처럼 남지 않게 하기 위해서였다. candidate review를 둔
이유도 같은 경계를 사람이 확인할 수 있게 하기 위해서였다.

현재 명령과 승격 절차는 `docs/project-knowledge/README.md`와
`shared-skills/project-knowledge/SKILL.md`가 소유한다. 이 항목은 도입 이유만
보존한다.


---

## 2026-05-22 공유 기억

출처: `.project-knowledge-local/candidate.md`

---
status: candidate
confidence: high
last_reviewed: 2026-05-22
source_refs:
  - issue: https://github.com/corca-ai/episteme2/issues/1
  - issue: https://github.com/corca-ai/episteme2/issues/7
  - pull_request: https://github.com/corca-ai/episteme2/pull/9
  - issue: https://github.com/corca-ai/lighthouse/issues/86
  - issue: https://github.com/corca-ai/craken-agents/issues/305
  - issue: https://github.com/corca-ai/sah-web/issues/10
supersedes:
  -
---

# Narrative: Episteme literature API 계약은 Light House provider 전환의 기준이다

## 현재 형태

`corca-ai/episteme2#1`은 Light House 검색 provider 전환을 위한 upstream API
계약 논의의 부모 이슈다. 2026-05-22 기준 parent issue는 아직 열려 있지만,
핵심 upstream 구현은 `corca-ai/episteme2#9` merge로 대부분 완료됐다.

완료된 범위는 stable OpenAPI schemas, `POST /papers/batch` batch hydration,
search paging metadata, citation availability/truncation semantics,
PDF/open-access availability semantics, source/freshness/coverage metadata다.
이에 따라 `episteme2#2`, `#3`, `#4`, `#5`, `#6`, `#8`은 닫혔다.

남은 upstream 판단은 `episteme2#7`이다. `/search?include=...`를 바로
추가하지 않고, batch hydration을 첫 official contract로 둔 뒤 search
baseline latency, include set latency, response size, query planner/cache 영향을
profiling해 결정한다.

## 형성 과정

초기 요청은 Light House가 Semantic Scholar Graph API 직접 호출에서
Episteme/e2로 이동할 수 있는지 확인하는 API 계약 검토였다. Light House의 기존
검색 경로는 한 search/batch 응답을 retrieval result와 paper record로 함께 쓰며,
search card, representative paper, citation lineage, PDF/Moonlight handoff,
gap network, source copy가 그 shape에 묶여 있었다.

Episteme 쪽 검토 결과, `/search`를 무겁게 확장하기보다 retrieval과 paper record
hydration을 분리하는 additive public literature API 계약이 채택됐다. 이 방향은
Light House뿐 아니라 Craken의 `search -> inspect` 흐름과 sah-web의 public
paper/explorer 문서화에도 맞는 공통 계약으로 정리됐다.

## 핵심 결정

- Light House는 `/search?include=...`를 hard requirement로 보지 않는다.
- 첫 migration contract는 `GET /search -> POST /papers/batch -> lazy citations/graph`다.
- `/search`는 lightweight retrieval endpoint로 유지한다.
- batch hydration은 loaded result window의 `corpus_id` 목록을 paper record로
  hydrate하는 공식 경로다.
- citation/reference는 count, list availability, truncation, unavailable reason을
  분리해서 다룬다.
- PDF/open-access는 provider-supplied PDF, derived arXiv URL, missing reason을
  구분한다.
- Episteme는 Semantic Scholar보다 더 권위 있는 별도 corpus가 아니라 Semantic
  Scholar dump 기반 index와 Corca graph/extraction layer로 설명한다.

## 당시 propagation 범위

Light House downstream은 `corca-ai/lighthouse#86`으로 분리됐다. 당시 이 작업을 단순
provider swap이 아니라 Episteme `search -> batch hydrate -> lazy citations/graph`
adapter와 search source copy, citation-lineage semantics, PDF/Moonlight handoff,
gap-network input metadata, Story Chain, Evidence Ledger, tests까지 이어지는 범위로
기록했다. 현재 propagation 절차는 Mission Control과 관련 정본이 소유한다.

Craken 후속은 `corca-ai/craken-agents#305`, sah-web 후속은
`corca-ai/sah-web#10`에 남아 있다. Parent `episteme2#1`은 downstream 검증과
`episteme2#7` 판단이 남아 있어 아직 열린 상태로 본다.

## 주의 지점

- Provider omission을 실제 연구 사실로 표현하지 않는다.
- `0 references/citations`와 `list unavailable/truncated/not indexed`를 구분한다.
- graph claims/concepts가 없다는 상태를 논문에 claim/concept가 없다는 뜻으로
  해석하지 않는다.
- initial search cards는 N+1 paper/author calls 없이 batch hydration으로 구성하는
  방향을 우선한다.

## 근거

- `corca-ai/episteme2#1`: original Light House API contract discussion.
- `corca-ai/episteme2#9`: additive public literature API contract implementation.
- `corca-ai/episteme2#7`: remaining include-based search hydration profiling decision.
- `corca-ai/lighthouse#86`: Light House downstream provider migration issue.
- `corca-ai/craken-agents#305`: Craken downstream adoption issue.
- `corca-ai/sah-web#10`: sah-web docs/types/UI follow-up issue.

---

## 2026-05-22 공유 기억

출처: `.project-knowledge-local/candidate.md`

---
status: candidate
confidence: high
last_reviewed: 2026-05-22
source_refs:
  - log: .project-knowledge-local/archive/work-memory-log-pre-rotation.md
  - log: .project-knowledge-local/work-memory-log.jsonl
  - issue: https://github.com/corca-ai/lighthouse/issues/24
  - issue: https://github.com/corca-ai/lighthouse/issues/36
  - issue: https://github.com/corca-ai/lighthouse/issues/70
  - issue: https://github.com/corca-ai/lighthouse/issues/71
  - issue: https://github.com/corca-ai/lighthouse/issues/85
  - issue: https://github.com/corca-ai/lighthouse/issues/81
  - issue: https://github.com/corca-ai/lighthouse/issues/84
supersedes:
  -
---

# Narrative: Reusable issue memories from May 2026 work

## 현재 형태

이 후보는 2026-05-09부터 2026-05-22까지 로컬 작업 기억을 다시 훑어, 다음
기여자에게도 반복해서 필요한 이슈 판단만 추린 것이다. 단순 PR 진행 상태, 한 번
끝난 CI 로그, 특정 커밋 대기 상태는 제외했다. 이미 공유 기억으로 승격된
Episteme literature API 계약은 중복하지 않는다.

## 핵심 공유 기억

### Context-preserving transitions

사용자-visible 맥락을 덮어쓰거나 되돌리기 어려운 전환은 단순 확인 배너만으로
다루지 않는다. 명시적 전환은 즉시 실행해도 되지만, 현재 맥락을 파괴하거나
복구 비용이 크면 사전 확인, 사후 복구, 병렬 보존 중 하나를 제공해야 한다.

검색 결과 내 재검색은 이 원칙의 첫 적용이다. 기존 확인 배너를 제거하고 새
쿼리는 즉시 실행하되, 문서별 직전 검색 결과와 AI 반응 snapshot을 1개 보관해
`이전 검색으로 되돌리기`로 복구했다. 이 사례가
`aspect:context-preserving-transitions`와 research route/view lifecycle을 함께
소유하게 된 배경이며, 현재 적용·검증 절차는 해당 Aspect 정본이 소유한다.

### Product feedback and ideation routing

베타 피드백, dogfooding, stakeholder direct request를 곧바로 UI copy나 기능으로
옮겼을 때 배경 신호와 더 깊은 제품 불확실성이 사라지는 문제가 있었다. 이 경험이
관찰과 제품 문제를 분리하고 `Add`, `Restructure`, `Defer`를 판단하는 흐름을 만든
이유였다. 현재 triage와 후속 routing은 `product-discovery-steward`, 사용자-facing
계약 전파는 Mission Control이 소유한다.

후속 탐색 기능을 설계할 때는 먼저 사용자의 질문이 무엇을 기준점으로 삼는지
확정한다. 특정 논문, PDF 구절, gap cluster, citation direction처럼 기준점이
있는 질문을 검색 결과 전체 상단이나 전역 AI comment에 붙이면 지시 대상이
흐려진다. 예를 들어 "이 논거를 반박하는 논문"은 40편 전체가 아니라 사용자가
보고 있는 한 논문의 주장에 대한 질문이므로, 전역 surface보다 논문 카드 같은
anchor surface가 맞다. 후속 검색어도 `{title} critique` 같은 문자열 조합보다
이미 수행 중인 semantic analysis에서 입장, 쟁점 축, 검색 후보를 함께 뽑는
방식을 우선한다.

### Analytics event contract

canonical analytics event 이름은 구현 이름이나 Promise slug가 아니라 관찰 가능한
사용자 행동 기준으로 짓는다. 기본 형태는 object + past-tense action이며,
`clicked`, `viewed`, `submitted`, `queued`, `failed`, `synced` 같은 동사를 쓴다.

Promise 관계를 이벤트 이름에 넣으면 관찰 가능한 행동과 계약 식별자가 결합되기
때문에 `docs/analytics/events.yaml`의 `storyRefs.promiseRef`로 분리했다. 이 결정으로
`events.yaml`, `track(...)`, `mc:event-impact`가 같은 계약 전파 범위를 확인하게 됐다.
현재 절차와 gate 의미는 `analytics-event-steward`와 Mission Control이 소유한다.
Vendor sink로 나가는 product event와 internal governance event를 분리한 이유는
identity와 payload allowlist의 authority가 다르기 때문이었다.

### Provider failure degraded mode

LLM/provider hard failure는 throw로만 끝내지 않고 사용자-visible degraded state로
닫는다. 현재 route-view AI comment generation은 `POST /api/route-ai-comments/generate/:viewId`
에서 nullable `RouteAiComment-or-null` structured output을 반환한다. provider
failure나 invalid output은 fallback comment를 만들거나 저장하지 않고 pending state를
닫는다.

Provider-failure degraded state에는 검색 awareness의 AI-comment 내부 버튼 surface를
주입하지 않는다. 실패 상태 카드가 `갭 분석 보기` 같은 후속 행동을 제안하면 실제로
계산 가능한 근거가 있는 것처럼 보일 수 있다. Pre-reset virtual pending 문서
(`gap-network-pending-*`) 정리 기억은 역사적 맥락이다. 현재 route-owned
ResearchRoutePayload 흐름은 route runtime의 task/controller 정리와 nullable AI
comment generation을 하나의 실패 boundary로 두는 구조를 채택했다. 현재 검증
절차는 runtime-flow와 관련 계약 정본이 소유한다.

### User-facing language governance

고정 문구와 생성 문구를 같은 검증면에 넣으면 실제 생성 channel의 증거가 사라지는
문제가 있었다. 그래서 고정 문구는 `app/i18n/messages*` registry와 rendered DOM,
생성 문구는 active AI response channel prompt, fixture, live judge/review evidence로
나눴다. 직접 사용자 auth/onboarding, `[system]` event, 공개·내부 문서형 surface의
tone authority가 서로 달랐던 것이 이 분리의 이유였다. 현재 검증 명령은 관련
Promise/Aspect와 owning workflow가 소유한다.

### Search source and trust copy

Light House는 Semantic Scholar를 직접 학술 색인으로 설명하되, Google Scholar와의
비교는 방어적 caveat가 아니라 논문 탐색 coverage reassurance로 시작한다. 사용자는
Google Scholar의 전체 복제를 요구하는 것이 아니라, 유명 저널과 주요 학술 source를
충분히 다루는지 알고 싶어 한다.

책, 특허, 법원 판결문 같은 비논문 자료는 논문 탐색 제품의 핵심 비교 기준이
아니다. `Google Scholar처럼 검색어 기준` mental model은 인증 전 intro와 빈 검색
상태에서만 도움 되고, 결과 헤더에서는 반복하지 않는다. 결과 화면은 Semantic
Scholar 논문 검색 기반, 정렬/필터, 현재 적재 편수, source limits를 짧게 말한다.
Coverage claim은 공식 근거보다 강하게 쓰지 않는다.

### Branch review response

PR과 branch review feedback은 finding 판정, correction, validation, remote thread
처리가 분리되면 누락되기 쉬웠다. 이 경험이 `branch-review-response` workflow를
하나의 close-out 흐름으로 만든 배경이었다. 현재 순서와 thread 처리 규칙은 해당
skill이 소유한다.

## 다음 처리

이 기억은 workflow가 생긴 이유와 이전 이슈에서 반복된 판단을 연결한다. 현재
행동과 검증 순서는 관련 정본 skill과 Story Chain 문서가 소유한다.

## 제외한 기억

Mutation score 수치, 특정 PR의 CI 대기 상태, 한 번 끝난 커밋/푸시 상태,
개별 UI bugfix의 상세 수치는 공유 기억으로 승격하지 않았다. 이런 내용은 당시
ledger, PR, test, git history에서 확인하는 편이 낫고, shared memory에 넣으면
금방 stale해진다.

## 근거

- `work-memory-log-pre-rotation.md`: Project Knowledge, analytics, provider failure,
  branch review, beta feedback, context preservation 초기 판단.
- `work-memory-log.jsonl`: trust basis, user-facing language, Google Scholar
  comparison, Episteme provider transition, PR #70/#71/#85 후속 판단.

---

## 2026-05-22 공유 기억

출처: `.project-knowledge-local/candidate.md`

---
status: candidate
confidence: high
last_reviewed: 2026-05-22
source_refs:
  - log: .project-knowledge-local/archive/work-memory-log-pre-rotation.md
  - log: .project-knowledge-local/work-memory-log.jsonl
  - issue: https://github.com/corca-ai/lighthouse/issues/24
  - issue: https://github.com/corca-ai/lighthouse/issues/25
  - issue: https://github.com/corca-ai/lighthouse/issues/26
  - issue: https://github.com/corca-ai/lighthouse/issues/27
  - issue: https://github.com/corca-ai/lighthouse/issues/28
  - issue: https://github.com/corca-ai/lighthouse/issues/29
  - issue: https://github.com/corca-ai/lighthouse/issues/30
  - issue: https://github.com/corca-ai/lighthouse/issues/31
  - issue: https://github.com/corca-ai/lighthouse/issues/32
  - issue: https://github.com/corca-ai/lighthouse/issues/33
  - issue: https://github.com/corca-ai/lighthouse/issues/34
  - issue: https://github.com/corca-ai/lighthouse/issues/35
  - issue: https://github.com/corca-ai/lighthouse/issues/36
  - issue: https://github.com/corca-ai/lighthouse/issues/59
  - issue: https://github.com/corca-ai/lighthouse/issues/70
  - issue: https://github.com/corca-ai/lighthouse/issues/71
  - issue: https://github.com/corca-ai/lighthouse/issues/81
  - issue: https://github.com/corca-ai/lighthouse/issues/82
  - issue: https://github.com/corca-ai/lighthouse/issues/83
  - issue: https://github.com/corca-ai/lighthouse/issues/84
  - issue: https://github.com/corca-ai/lighthouse/issues/85
  - issue: https://github.com/corca-ai/lighthouse/issues/86
supersedes:
  -
---

# Narrative: Issue memory index for active Light House product threads

## 현재 형태

이 후보는 로컬 작업 기억에서 반복 참조될 가능성이 큰 GitHub 이슈 맥락을 번호별로
압축한 index다. 이슈에 관한 기억은 개인 로컬 기억이 아니라 다음 기여자가 같은
이슈를 이어받을 때 필요한 공통 기억으로 본다. 상태값은 2026-05-22 로컬 기억과
당시 GitHub 확인 기준이며, 최신 open/closed 상태는 작업 직전에 GitHub에서 다시
확인한다.

## Provider failure and review response

`lighthouse#24`는 provider failure degraded mode의 기준 이슈다. LLM/provider
hard failure를 throw로만 끝내지 않고 사용자-visible degraded respond로 닫는
흐름이 여기서 정리됐다. CodeRabbit 지적을 반영하며 `logError`가 동기 throw해도
degraded 응답 completion, response finalize, workflow summary가 실행되도록
try/catch/finally 경계를 보강했다. 이 이슈 대응 과정에서 PR/branch review feedback
은 수정, 검증, thread resolve 또는 PR conversation 요약을 하나의 close-out으로
보아야 누락이 줄어든다는 판단으로 이어졌고 `branch-review-response` skill로
승격됐다. 현재 절차는 해당 skill이 소유한다.

`lighthouse#35`는 legacy Story Chain judge drift를 별도 정리하기 위해 분리한
이슈다. PR #36에서 mc:judge-static 실패가 새 코드 회귀가 아니라 기존 drift의
재평가로 드러났고, 사용자 지시에 따라 해당 drift는 #35 범위로 남기고 beta feedback
PR에는 judgeOverride 이유를 명시했다.

## Donggyu beta feedback and PR #36

`lighthouse#25`부터 `#34`는 베타 테스터 A 피드백을 GitHub Project 관리용으로
쪼갠 이슈 묶음이다. Project는 org-level GitHub Projects v2 `Light House Beta
Feedback`이며 repo에 연결되어 있지만 `gh repo view --json projectsV2`가 repo-linked
Projects v2를 빈 배열로 보여주는 표시 한계가 있었다. 각 이슈의 projectItems로
연결 여부를 확인하는 편이 정확하다.

이 묶음의 원래 분해는 다음과 같다. `#25` 정렬 신뢰성, `#26` 재검색 후 stale AI
코멘트, `#27` 로딩 표시, `#28` 오른쪽 AI 코멘트 후속 질문, `#29` 출판연도 분포,
`#30` 출판연도/한영 제목, `#31` 갭 분석 용어, `#32` 인용 계보와 후속 논문 기반
연구 공백 찾기, `#33` 초록 novelty 편향, `#34` 검색 성향 설정이다.

PR `#36`은 이 beta feedback 묶음 대부분을 구현한 작업이다. 적용된 큰 결정은
검색 정렬/검색어 변경 후 AI 코멘트 갱신, 로딩 상태 확대, 연도 분포/출판년도/국문
요약/검색 성향, `갭 분석`을 `연구 공백 찾기`로 바꾸는 언어 정리, 인용 계보의
후속 논문으로 기존 연구 공백 리포트를 재사용하는 흐름이다. `#28`의 free-text
chat형 후속 질문은 첫 버전에서 보류했고, 필요하면 context별 guided action button
으로 좁히는 방향이 합의됐다.

PR #36 리뷰에서 중요한 후속 결정도 남아 있다. 검색 결과의 sort/year/intent control
은 서버 재검색이 아니라 클라이언트 view metadata update로 처리해 AI reaction을
지우지 않는다. 서버 intent ranking은 명시 sort가 없을 때만 적용한다. 늦게 도착한
이전 awareness reaction이 새 검색 결과를 덮지 못하도록 generation gate를 둔다.
후속 논문 기반 연구 공백 리포트 입력은 citationIds 기준으로 엄격히 제한한다.

## Search card, citation, and context preservation

`lighthouse#70`은 검색 결과 카드/인용 계보/analytics 정리 PR이다. 검색 결과 카드의
DOI 칩은 제거했고, DOI exact lookup 근거 표시는 검색 입력/결과 헤더 기준으로
남긴다. 검색 카드의 인용 표시는 총 인용수 칩이 아니라 `선행 N` / `인용 N` 계보
진입점으로 분리했다. Semantic Scholar가 count는 주지만 referenceIds 목록을 제한할
때는 `선행 0`처럼 말하지 않고 목록 제한 상태를 보여준다. 같은 작업에서 actor.id와
deviceId가 모두 없는 Amplitude canonical event는 vendor sink 전송을 생략하도록
정리했다.

`lighthouse#71`은 검색 결과 내 재검색 confirmation을 즉시 재검색 + 직전 검색 복구로
바꾼 PR이다. 이 이슈에서 `aspect:context-preserving-transitions`가 생겼다.
Pre-reset 구현은 직전 search document와 AI reaction snapshot을 1개 보관해 `이전
검색으로 되돌리기`를 제공했고, document collection 전환 누수를 막기 위해
collection/document 검증을 두었다. 현재 Search-first 모델에서 같은 교훈은
route-owned ResearchRoutePayload의 `currentView`, visible-window state, reaction snapshot이
다른 route condition으로 새지 않게 scoping하고 route unmount/replace 때 stale
background result를 폐기하는 것이다.

## Search source, trust basis, and product voice

`lighthouse#59`는 Semantic Scholar 직접 API에서 Episteme/internal index로 이동하는
큰 운영 전환의 umbrella다. 2026-05-21 사용자 정정 이후 Episteme는 독립 corpus가
아니라 Semantic Scholar dump 기반 index + Corca-added graph/extraction layer로
설명해야 한다는 기억이 붙었다.

`lighthouse#81`은 product-wide trust-basis audit, `#82`는 PDF/Figure/Table input
basis and fallback limits, `#83`은 citation lineage/gap network source coverage
limits, `#84`는 제품 전반의 신뢰성 말투와 copy vocabulary 통일 이슈다. 처음에는
새 trust Aspect 후보처럼 보였지만, Mission Control에서 restructuring이 더 낫다고
판단했다. 새 Aspect를 추가하지 않고 `aspect:visible-explanation-sufficiency`는
source/input scope/loaded window/cap/known limit/fallback 같은 visible information
structure를 맡고, `aspect:reaction-prefers-load-bearing-facts`는 product voice와
vocabulary를 맡도록 재구조화했다.

`lighthouse#85`는 trust basis feedback process and search source clarity를 main에
반영한 PR이다. Semantic Scholar 설명은 direct academic-index lookup, major source
families, loaded-result basis, AI reaction wording을 검색 surface에 반영한다.
인증 전 intro는 Semantic Scholar/Google Scholar 직접 검색 비교 중심으로 정리하되,
Google Scholar 전체 복제 caveat보다 논문 탐색 coverage reassurance로 시작한다.
사용자-facing 언어 governance에서는 fixed copy registry와 generated prose 검증
track을 분리했다.

## Episteme downstream

`lighthouse#86`은 Episteme public literature API 계약 이후 Light House downstream
provider 전환을 추적하는 이슈다. 이 이슈는 단순 provider swap이 아니라
`search -> batch hydrate -> lazy citations/graph` 흐름으로 adapter를 바꾸는 것과
PaperCore mapping, loaded result source copy, citation/gap availability semantics,
PDF/Moonlight handoff, Story Chain/Evidence Ledger/tests를 한 propagation 범위로
기록한 작업이었다.

`episteme2#1`과 연결된 upstream 상황은 별도 공유 기억 `Episteme literature API
계약은 Light House provider 전환의 기준이다`에 이미 승격돼 있다. 이 index에서는
Light House 쪽 이어받기 관점만 남긴다.

## 다음 처리

이 index는 최신 상태 데이터베이스가 아니라 “왜 이 이슈가 이런 의미를 갖게
되었는지”를 보존한다. 따라서 현재 상태 판단에는 해당 issue/PR의 최신 GitHub
상태가 별도 근거로 필요하다.

## 근거

- `work-memory-log-pre-rotation.md`: #24, #25-#36, Project #10, PR #36 흐름.
- `work-memory-log.jsonl`: #59, #70, #71, #81-#86 흐름.

---

## 2026-08-10 공유 기억

출처: `.project-knowledge-local/candidate.md`

---
status: candidate
confidence: high
last_reviewed: 2026-08-10
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md#skill-lifecycle
source_refs:
  - issue: https://github.com/corca-ai/lighthouse/issues/601
  - file: AGENTS.md
  - file: docs/project-knowledge/README.md
  - file: shared-skills/skill-governance-steward/SKILL.md
  - file: scripts/implementation/classify-staged.mjs
  - file: scripts/implementation/__tests__/classify-staged.test.ts
  - file: scripts/project-knowledge/__tests__/candidate-metadata.test.ts
  - file: scripts/project-knowledge/shared-memory-entry.mjs
  - file: scripts/project-knowledge/claim-inventory.ts
  - file: scripts/project-knowledge/__tests__/shared-memory-entry.test.ts
  - file: scripts/project-knowledge/__tests__/review-boundary.test.ts
supersedes:
  -
---

# Narrative: 일반 구현과 agent-process governance는 실행 workstream을 분리한다

## 현재 형태

Issue #601은 일반 구현과 agent-process governance가 같은 Project Knowledge
흐름을 사용하더라도 실행 workstream과 최종 authority는 공유하지 않는 방향을
선택했다. 현재 `AGENTS.md` Implementation Classification은 진입을 안내하고,
`docs/agent-skills.md` Skill Lifecycle이 정책을 소유하며,
`shared-skills/skill-governance-steward/SKILL.md`가 이를 실행하는 구조다.
`scripts/implementation/classify-staged.mjs`는 staged advisory evidence를 제공한다.

## 형성 과정

LLM Agent가 기능 구현이나 버그 수정 중 발견한 process insight를 같은 작업에서
규칙으로 반영하거나, 일반 구현 교훈을 불필요한 process 변경으로 확장하는 현상이
있었다. 초기 제안은 공동 PK를 project와 process lane으로 구분하는 것이었다.

Claude Fable 5의 읽기 전용 자문은 lane 분리가 저장·회상 단계의 혼동은 줄이지만
실행 시점의 혼합 작업을 직접 막지는 못한다고 지적했다. 자문 모델은 정본 파일을
읽지 못했으므로 현행 classifier와 정본은 별도로 대조했다. 그 결과 기존
`agent-process-governance` boundary를 재사용하고 mixed diff에 session split 신호만
추가하는 방향을 선택했다.

## 핵심 결정

- 새 profile이나 required gate보다 기존 `agent-process-governance` boundary를
  재사용하는 방안을 선택했다. 기존 owner 신호를 유지하면서 mixed workstream만
  드러낼 수 있었기 때문이다.
- lane 지정은 capture가 아니라 shared promotion review에 두기로 했다. process
  insight를 발견한 agent가 자기 작업의 분류와 행동 규칙을 동시에 결정하는 문제를
  피하기 위해서였다.
- process rule에 막힌 agent가 같은 작업에서 그 rule을 바꾸는 상황은 독립적인
  검토가 사라지는 자기참조 문제로 판단했다. 이 판단이 Human checkpoint를 process
  authority에 추가한 이유였다.
- 물리적인 process-memory 파일 분리는 recall 오염 사례가 관찰될 때까지 보류했다.
  현재 증거는 실행 workstream 혼합을 먼저 다루는 편을 지지했다.

## 다음 처리

Issue #601 구현 이후 mixed-workstream escape가 다시 발생하는지 관찰한다. escape가
재발할 때만 advisory classifier의 추가 방어를 검토한다. 제품 작업의 recall에
process 기억이 섞여 판단을 흐린 사례가 확인될 때만 물리적인 process-memory 파일
분리를 다시 논의한다.

## 주의 지점

새 process profile, required gate, repo-local skill은 대안으로 검토했지만 기존
owner와 절차를 중복하므로 선택하지 않았다. 파일 경로만으로 변경 효과를 판정하는
방안도 mixed-purpose 파일에서 오탐을 만들 수 있어 선택하지 않았다. 현재 명령은
단일 `authority_refs`인 `docs/agent-skills.md` Skill Lifecycle에 있고, 다른
`source_refs`는 navigation·실행·advisory 관계를 설명한다.

## 근거

- issue: `corca-ai/lighthouse#601`
- base: `60a9d778` (`feat(process): classify staged implementation boundaries (#599)`)
- targeted tests: staged implementation classifier, shared-memory frame, candidate
  metadata, review recovery boundary 102개 통과
- process validation: `impl:classify`, `guard:skills`, `pk:validate` 통과
- broad validation: `quality:fast` 통과. unit 338개 파일, 2,932개 테스트를 실행했다.

## Review

- [x] assign knowledge_lane: process
- [x] name owning authority_refs
- [ ] local-only
- [x] approve to shared memory
<!-- project-knowledge-entry:v1 id=8e51e332-e3cd-4dc8-9e53-f69d8bbf0f16 lane=process bytes=2550 sha256=94864cf074937ef210454b7a10cced016abe7c96d970295af3406d2c1f0a63c3 -->
---

## 2026-08-10 공유 기억

출처: `.project-knowledge-local/candidate.md`

<!-- project-knowledge-candidate:v1 -->
---
status: candidate
confidence: high
last_reviewed: 2026-08-11
knowledge_lane: process
authority_refs:
  - docs/agent-skills.md#skill-lifecycle
source_refs:
  - commit: d536111f33536453a24ecb1c54b3c7a852ace5c4
  - issue: https://github.com/corca-ai/lighthouse/issues/601
  - file: docs/project-knowledge/shared-memory.md
  - file: docs/project-knowledge/README.md
supersedes:
  - "2026-08-10: 일반 구현과 agent-process governance는 실행 workstream을 분리한다"
---

# Narrative: Issue #601 process 기억의 근거 commit을 보완한다

## 현재 형태

Issue #601의 process 판단은 `docs/agent-skills.md` Skill Lifecycle을 현재
authority로 가리킨다. 2026-08-10에 승격한 legacy narrative에는 관련 파일과 issue는
남아 있지만 판단이 형성된 commit identity가 metadata에 없었다. 이 항목은 기존
바이트를 고쳐 쓰지 않고 그 근거를 `d536111f33536453a24ecb1c54b3c7a852ace5c4`로
보완한다.

## 형성 과정

Issue #601 브랜치와 main의 process-session 결정을 합치는 과정에서 현재 정본을
가리키는 `authority_refs`와 과거 판단 상태를 가리키는 `source_refs`가 서로 다른
역할이라는 점을 다시 확인했다. 새 승격 검증만 강화하면 이미 이 PR에 포함된 legacy
항목의 provenance 공백은 남기 때문에 별도 보완 항목이 필요했다.

## 핵심 결정

- 기존 legacy shared-memory 바이트는 append-only 호환성을 위해 유지한다.
- 현재 명령의 소유자는 `authority_refs`로, 판단이 형성된 역사적 상태는 commit
  `source_refs`로 구분한다.
- 새 항목은 2026-08-10의 Issue #601 process narrative를 provenance 측면에서
  보완하고 대체한다.

## 다음 처리

향후 process-memory 승격에서 근거 commit이 누락되는 사례가 다시 확인될 때만
metadata 계약과 review evidence를 재검토한다.

## 주의 지점

이 항목은 현재 agent 명령을 정의하지 않는다. 현재 명령은
`docs/agent-skills.md` Skill Lifecycle이 소유한다.

## 근거

- issue: `corca-ai/lighthouse#601`
- evidence commit: `d536111f33536453a24ecb1c54b3c7a852ace5c4`
- merge parents: `d536111f33536453a24ecb1c54b3c7a852ace5c4`,
  `97b8645e1551d1a47164e19039e1065f732d976e`

## Review

- [x] assign knowledge_lane: process
- [x] name owning authority_refs
- [x] include evidence commit source_ref
- [x] approve to shared memory
<!-- /project-knowledge-entry:v1 id=8e51e332-e3cd-4dc8-9e53-f69d8bbf0f16 -->
<!-- project-knowledge-entry:v1 id=25a27af4-e70f-4d8f-88cc-5b6819e4c51a lane=process bytes=4270 sha256=153a40463175b8592b644324b2ce446d40c7b6412e33e559270f6700e6e6f930 -->
---

## 2026-08-10 공유 기억

출처: `.project-knowledge-local/candidate.md`

<!-- project-knowledge-candidate:v1 -->
---
status: candidate
confidence: high
last_reviewed: 2026-08-11
knowledge_lane: process
authority_refs:
  - docs/operational-readiness.md
source_refs:
  - commit: 3c3b14c0606f2ad4a57682664492b098ca82d4df
  - issue: https://github.com/corca-ai/lighthouse/issues/321
  - issue: https://github.com/corca-ai/lighthouse/issues/577
  - issue: https://github.com/corca-ai/lighthouse/issues/592
  - file: docs/operational-readiness.md
  - file: docs/operational-readiness-records.md
  - file: docs/runtime-flows/search-background-transport.md
supersedes:
  -
---

# Narrative: 관측 부재는 성공이나 호환 종료의 증거가 아니다

## 현재 형태

Light House의 운영 판단은 exact deployment와 관찰 window를 고정했더라도, 그
window의 request coverage, sampling, durable sink를 확인하지 못하면 성공이나
zero-legacy를 증명한 것으로 보지 않는다. 이 상태는 `unknown` 또는
`evidence-needed`로 남고, 실제 사용 부재를 전제로 한 compatibility 제거의 근거가
되지 않는다.

현재 상태와 go/no-go 의미는 `docs/operational-readiness.md`가 소유한다. 이 기억은
그 규칙이 형성된 이유와 반복해서 거부한 추론만 보존한다.

## 형성 과정

Issue #321에서는 exact production deployment에서 관찰을 준비했지만 인증된 정상
검색 요청 자체를 만들지 못한 실행이 있었다. 5xx가 없고 배포가 READY여도 provider
경로나 fleet capacity를 관찰한 것은 아니어서 verdict를 올릴 수 없었다.

Issue #577에서는 canonical analytics 계약과 로컬 검증을 닫은 뒤에도 실제
Amplitude receipt와 외부 사용자 outcome은 별도 미검증 상태로 남았다. 제품 계약의
완료와 production collection fitness를 같은 green으로 합치지 않은 사례였다.

Issue #592에서는 exact production revision과 alias window를 고정했지만 Vercel
runtime request-log export가 0행이었다. 독립 request metric은 사용할 수 없었고
durable drain과 sampling policy도 없었다. 따라서 0행이 실제 traffic 0건인지, export
누락인지, sampling 결과인지 구분할 수 없었다. 세 route의 positive v1과 zero legacy를
증명하지 못했으므로 legacy reader를 유지했다.

## 핵심 결정

- 배포 성공, 5xx 부재, 빈 log는 각각 관찰 대상 동작의 positive execution과 다른
  사실이다.
- 0건 주장을 retirement 근거로 쓰려면 같은 window의 독립 request count와 export
  count가 연결되어 coverage와 sampling 한계를 설명해야 한다.
- 현재 control이 존재하는 것과 그 control이 production에서 충분하다는 증거는
  별도 상태다.
- 증거가 없는 compatibility 제거보다 `unknown` 또는 `evidence-needed`와
  `migrate-read-only` 보존을 선택했다.

## 다음 처리

같은 종류의 retirement나 cohort 확대에서 빈 관측만으로 성공을 주장하는 사례가
다시 발생하거나, 독립 request count와 sampling 없는 durable export가 같은 exact
window에서 확보되면 이 판단을 재검토한다.

## 주의 지점

이 항목은 운영 명령이나 현재 임계값을 정의하지 않는다. 현재 boundary 상태,
필요한 수치, go/no-go 판정은 `docs/operational-readiness.md`와 해당 dated record가
소유한다. 특정 vendor log가 비어 있다는 사실만으로 실제 요청이나 legacy 사용이
없었다고 역추론하지 않은 배경을 보존한다.

## 근거

- Issue `corca-ai/lighthouse#321`: production observation eligibility와 인증 실행
  부재를 분리했다.
- Issue `corca-ai/lighthouse#577`: 계약·로컬 검증과 production receipt/outcome을
  분리했다.
- Issue `corca-ai/lighthouse#592`: exact release window의 0-row log를
  zero-legacy로 해석하지 않고 evidence-needed로 닫았다.
- evidence commit:
  `3c3b14c0606f2ad4a57682664492b098ca82d4df`
- merge commit: `1e323c42d6cf95809ae4ba8247b211eb09ef573a`

## Review

- [x] assign knowledge_lane: process
- [x] name owning authority_refs
- [x] include evidence commit source_ref
- [ ] local-only
- [ ] approve to shared memory
<!-- /project-knowledge-entry:v1 id=25a27af4-e70f-4d8f-88cc-5b6819e4c51a -->
<!-- project-knowledge-entry:v1 id=85be7aa3-60a4-4491-9ec2-2dbc3c06ab40 lane=process bytes=4815 sha256=509419c5e8f4c47d50f915c4e227ddd5a3cc8e57e28eb2e2a5d4b5c007075197 -->
---

## 2026-08-13 공유 기억

출처: `.project-knowledge-local/candidate.md`

<!-- project-knowledge-candidate:v1 -->
---
status: candidate
confidence: high
last_reviewed: 2026-08-13
knowledge_lane: process
authority_refs:
  - shared-skills/skill-governance-steward/SKILL.md
  - docs/architecture-fitness/README.md
  - docs/implementation.md
source_refs:
  - commit: 680d7b64e316da2f2a67a334cb9ae54ed8665c0a
  - commit: d73de28560535de5a092ba23b0d0f47b7488e9ef
  - commit: 2a5bdd5d729fe203b86714d72b914f4e2660eb03
  - issue: https://github.com/corca-ai/lighthouse/issues/616
  - issue: https://github.com/corca-ai/lighthouse/issues/414
  - issue: https://github.com/corca-ai/lighthouse/issues/417
  - file: docs/contract-maps/quality-gate-records.md
  - file: docs/architecture-fitness/README.md
  - file: docs/implementation.md
  - file: shared-skills/review-checklist-steward/references/checklist-usage-log.md
supersedes:
  -
---

# Narrative: 구현 체계의 설치 성공과 효과 성공은 별도로 판정한다

## 현재 형태

Issue #616은 구현 작업을 runtime zone × obligation × lifecycle로 탐색하는 단일
진입점을 설치했다. Exact-head와 latest-main 검증은 이 구조가 의도한 형태로
설치됐음을 확인했다. 이 결과만으로 작업 비용, 라우팅 정확도, 재작업 감소 효과가
성공했다고 판단하지 않는다.

Architecture Fitness의 process-effectiveness coverage는 `unsupported / unknown`이다.
Human process owner verdict는 `insufficient-evidence`다. 기계 검증 실패가 아니라
cost-proportionality를 판단할 관찰이 부족하다는 뜻이다.

## 형성 과정

Issue #414와 #417은 #616 뒤의 첫 실제 architecture-impact 표본이었다. 두 작업 모두
구현 전에 Mission Control, CAIR, Story Chain, runtime-flow와 관련 owner에 진입했다.
Issue #616의 재도입 기준에 해당하는 late route miss는 0건이다. #417 Early
Propagation Scope Review가 구현 전에 빠진 owner를 보정한 early-caught owner
correction은 1개 workstream이다.

두 PR 모두 네 번째 exact-head review에서 clean이 됐고, 선택한 owner 안의
propagation, correctness, evidence-depth 보정이 각각 23개와 21개 파일에 걸쳐
발생했다. Review 중 route lifetime, API response owner, terminal admission race, UI
next action, Story Chain과 PostgreSQL evidence 결속 결함이 발견돼 merge 전에
고쳐졌다. 이 관찰만으로 #616 체계의 독립적인 인과 기여를 계산할 수는 없다.

Active authoring time, 로컬 machine run time, iteration별 고유 finding과 false
positive, CAIR와 Story Chain의 중복 시간은 기록되지 않았다. 같은 Gap domain의
고복잡도 표본 두 건뿐이라 비교군도 없다.

## 핵심 결정

- 구현 체계의 설치 검증과 process effectiveness 판정을 분리한다.
- 현재 구현 guide와 routing corpus를 유지한다. 새 skill, classifier, Architecture
  Fitness profile이나 gate는 추가하지 않는다.
- Evidence capture 보정은 `reconfigure` 후보로 둔다. 별도 process 변경이 채택되기
  전까지 미기록 값은 `unknown`이다.
- 최소 machine router의 `20~30개 구현 PR / owner route 누락 2~3회 / 실질적 재작업`
  결합 조건은 Issue #616의 재검토 제안으로 보존한다. 아직 활성 process 명령은
  아니며 채택 여부는 별도 Skill Governance 변경이 결정한다.

## 다음 처리

현재는 Skill Governance 정본이 이미 채택한 절차만 따른다. 2026-08-13 dated 감사의
8-workstream 중간 cohort, 다섯 지표 capture envelope, 20~30 PR 결합 조건은 모두 후속
process 변경의 제안이다.

## 주의 지점

Routing corpus 20/20, exact-head `clean`, 최종 `already-fixed` 수는 서로 다른
증거다. 어느 하나도 단독으로 process effectiveness를 증명하지 않는다. Finding의
원인 종류와 발견 시점을 분리하고, early-caught owner correction을 late route miss와
합치지 않는다. 어려운 multi-owner 작업만 표본으로 삼으면 selection bias가 생기며,
final clean 기록만으로 각 workflow의 인과 기여나 false-positive 비율을 복원할 수
없다.

## 근거

- Issue #616 및 merge commit `680d7b64e316da2f2a67a334cb9ae54ed8665c0a`
- Issue #414 / PR #623 및 merge commit
  `d73de28560535de5a092ba23b0d0f47b7488e9ef`
- Issue #417 / PR #624 및 merge commit
  `2a5bdd5d729fe203b86714d72b914f4e2660eb03`
- `docs/contract-maps/quality-gate-records.md`의 2026-08-13 process 감사
- `docs/architecture-fitness/README.md`의 process-effectiveness unknown 기록
- exact-head usage records #623, #624

## Review

- [x] assign knowledge_lane: project | process
- [x] name at least one owning authority_ref
- [ ] local-only
- [x] approve to shared memory
<!-- /project-knowledge-entry:v1 id=85be7aa3-60a4-4491-9ec2-2dbc3c06ab40 -->
