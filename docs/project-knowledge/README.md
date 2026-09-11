# Project Knowledge

Project Knowledge는 두 종류의 기억을 분리한다. 로컬 기억은 agent가 작업을
이어받기 위한 episodic narrative다. 공유 지식은 여러 정본만 읽어서는 복원하기
어려운 Light House의 형성 배경과 관계를 설명하는 consolidated object다.

공유 지식은 두 질문에 답한다.

1. 제품은 왜 지금과 같은 개념·행동·구조를 가지게 되었는가?
2. 프로젝트 팀은 왜 지금과 같은 방식으로 제품을 발견하고, 선택하고, 만들고,
   검증하고, 운영하는가?

현재 무엇을 해야 하는지는 공유 지식이 지시하지 않는다. 현재 행동과 상태는
각 객체의 `authority_refs`가 가리키는 정본이 소유한다.

## 목적 우선 진입

Project Knowledge 절차는 제품과 제품제작 도메인 지식체계를 고도화하기 위해
존재한다. 작업을 시작할 때 파일 구조, 명령, review check부터 읽지 않는다. 먼저
이번 episode가 다음 두 질문 중 무엇을 더 잘 설명할 수 있는지 정한다.

1. 제품은 왜 지금과 같은 개념·행동·구조를 가지게 되었는가?
2. 프로젝트 팀은 왜 지금과 같은 방식으로 제품을 발견하고, 선택하고, 만들고,
   검증하고, 운영하는가?

그다음 설명할 subject, 기존 객체와 relation, 새 episode가 드러낸 긴장·기각 대안·
반례·변화를 확인한다. current authority와 exact grounding을 연결한 뒤에만 capture,
candidate, review, validation 절차를 실행한다. 절차를 완료했더라도 새 설명력이
없으면 0개로 닫는다.

### 조직화된 성장

공유 Project Knowledge는 새 항목을 시간순으로 누적하는 archive가 아니다. 새
episode가 들어오면 현재 projection 전체에서 같은 subject와 질문을 먼저 찾는다.
기존 설명을 강화하면 grounding·evolution·relation을 보강하고, 경계가 달라지면
revise 또는 split한다. 반례는 `challenged_by`, 대체 설명은 temporal status와
`supersedes`로 연결한다.

기존 객체로 설명할 수 없는 안정된 subject가 있을 때만 새 객체를 만든다. 새 case는
가능한 한 자신이 지지하거나 반박한 concept/model과 연결한다. 이 과정의 성공은 객체
수가 아니라 중복 subject가 줄고, relation을 따라 형성 과정과 반례를 찾을 수 있으며,
다음 recall에서 더 적은 재구성으로 도메인 질문에 답하는지로 판단한다.

## Project Identity

Light House는 학술 논문 탐색을 돕는 Search-first 어시스턴트다. 연구자가
검색, 인용·비슷한 논문 탐색, 연구 공백 후속 액션을 주도한다. 시스템은 현재
route-owned ResearchRoutePayload의 visible snapshot과 system event에 짧고 구조화된
comment로 반응한다.

제품 정체성의 정본은 `docs/product-identity.md`다. Project Knowledge는
agent가 작업을 이어받는 데 필요한 기억을 다룬다.

### 공유 맥락 규칙

- 사용자-facing 동작은 Story Chain과 Evidence Ledger가 관리한다.
- 사용자에게 보이는 agent output은 active AI response channel 또는 runtime이
  준비한 deterministic branch를 지난다.
- "화면에 렌더된다"만으로는 충분하지 않다. Promise, acceptance check,
  evidence, code, test가 함께 맞아야 한다.
- 공유 기억은 git에서 review할 수 있어야 한다.

## 구조

```text
docs/project-knowledge/
  README.md
  knowledge-objects.md
  pilot-evaluation.md
  shared-memory.md

.project-knowledge-local/
  work-memory.md
  work-memory-log.jsonl
  archive/
    work-memory-log-YYYY-MM.jsonl
  candidate.md
```

- `work-memory.md`는 현재 clone의 최신 작업 이어받기 요약이다. 컨텍스트 클리어,
  중단, 커밋 전후에 agent가 한국어 narrative로 갱신한다.
- `work-memory-log.jsonl`은 모든 `pk:remember` note를 append-only로 누적하는
  단일 source of truth다. `type`, `date`, `title`, `summary`, `context_hint`,
  `encoding_depth`, `role`, `domain_tags`, `entities`, `goal_links`, `events`,
  `source_refs`를 가진 record를 남긴다. 여러 세션이 동시에 `pk:remember`를
  실행해도 각 record는 로그에 남고, 최신 요약 파일은 마지막 writer의 이어받기
  요약으로만 취급한다. 사람이 읽고 싶으면 `npm run pk:log -- --tail <N>`으로
  markdown 뷰를 즉시 만든다.
- `archive/work-memory-log-YYYY-MM.jsonl`은 월이 바뀔 때 자동 이동된 직전 월
  jsonl이다. `pk:recall`은 기본적으로 archive를 검색하지 않고, 필요할 때
  `--all`을 붙인다.
- `candidate.md`는 local narrative에서 0..n개 공유 객체를 추출하는 consolidation
  후보이다.
- `knowledge-objects.md`는 review를 거친 공유 설명 지식의 현재 projection이다.
- `shared-memory.md`는 v1 narrative와 append-only frame을 byte 그대로 보존하는
  legacy read source다. 새 일반 write는 받지 않는다. 중단된 v1 candidate 복구만
  기존 writer를 사용할 수 있다.
- `pilot-evaluation.md`는 #627의 bounded pilot 비교와 비용을 기록한다.

## 두 개의 직교 축

| 축 | 값 | 질문 |
| --- | --- | --- |
| 기억 lifecycle | `local-episodic` / `shared-consolidated` | 작업 중 기억인가, 장기 설명 지식인가 |
| 지식 대상 plane | `product` / `product-making` | 제품이 왜 이러한가, 팀이 왜 이렇게 만드는가 |

로컬 capture는 plane을 미리 판정하지 않는다. 공유 review에서 각 객체가 정확히
하나의 plane과 `concept | model | case` 중 하나의 kind를 갖는다. `decision`은
객체 kind가 아니다. 재사용할 설명이 있는 판단은 concept/model의 evolution 또는
case로 흡수한다. 별도 decision ledger를 만들지 않는다.

### Plane 경계

`product`는 Light House라는 제품·시스템의 개념, 관계, 사용자에게 보이는 상태와
신뢰 의미, 그 형태가 형성된 이유를 설명한다. `product-making`은 팀과 agent가
제품을 발견·계약화·구현·검증·review·운영하는 체계가 생긴 이유를 설명한다.
두 plane은 hierarchy가 아니다.

| 영역 | `product`가 설명하는 것 | `product-making`이 설명하는 것 | 현재 authority |
| --- | --- | --- | --- |
| architecture | 구조가 제품에서 갖는 의미와 형성 배경 | 구조 결정을 검토하는 방식이 생긴 이유 | durable CAIR와 implementation owner |
| runtime | 순서·신선도·복원·실패의 제품 의미 | runtime-flow를 함께 갱신하는 이유 | `docs/runtime-flows/**` |
| state | 일시성·영속성·공유 scope의 제품 의미 | state boundary 판단 관행의 반복 근거 | `docs/infrastructure.md`, code/schema |
| evidence | 실제 행동이 제품 모델에 드러낸 한계 | gate·review·rollout 판정 방식의 존재 이유 | ledger, test, dated record |
| research | 외부 지식에 대한 Light House의 채택된 해석 | research를 제품 선택으로 전달하는 방식 | Moonlight Project Knowledge 원자료 |
| operational reality | 제품·시스템 행동과 관측 한계 | incident와 관측이 제작 관행을 바꾼 이유 | Operational Readiness 정본과 기록 |

Moonlight Project Knowledge는 사용자 연구, 외부 조사, 일반 학술·시장·방법론
지식을
소유한다. Lighthouse는 그 자료를 commit 고정 링크로 grounding하고 제품에 채택한
해석이나 제작 방식에 미친 영향만 consolidation한다. 원자료를 복제하지 않는다.

## 처음 사용할 때

세션을 시작할 때 agent가 실행한다. 현재 컨텍스트에 Project Knowledge start
출력, 로컬 작업 기억, 또는 `project-knowledge-preprompt`가 없으면 첫 응답
전에도 같은 명령을 실행한다. 감지 키워드는 `프로젝트 시작`, `project start`,
`pk:start`다.

```bash
npm run pk:start
```

agent는 작업 중 보존할 만한 맥락을 감지하고, 기본적으로는 `pk:remember`로
로컬 작업 기억 요약을 갱신하고 로컬 작업 기억 로그에 같은 note를 추가한다.
공유해야 할 기억이 분명할 때만 candidate를 만들고 review한다.

## `/clear` 대응

`/clear` 대응은 기억 저장과 기억 복원으로 나눈다. 컨텍스트를 비우기 전에는
agent가 현재 작업 흐름, 판단 전환, 다음 처리 순서를 한국어 narrative로 요약해
로컬 작업 기억을 갱신한다.

```bash
npm run pk:remember -- --note "<한국어 narrative>"
```

컨텍스트를 비운 뒤 새 세션의 첫 응답 전에는 `pk:start`를 실행한다. 이 명령이
공유 기억, 최신 로컬 작업 기억, 최근 3개 작업 기억 record를 함께 출력하므로,
새 agent는 직전 작업의 흐름을 읽고 이어서 처리한다. 더 거슬러 올라가야 하면
`npm run pk:log -- --tail 10` 또는 `npm run pk:recall -- <query>`를 쓴다.

slash command hook을 제공하는 harness에서는 clear 직전 hook에 `pk:remember`를
연결하고, clear 직후 또는 session-start hook에 `pk:start`를 연결한다.

Claude Code에서는 clear 이후 다음 사용자 입력에도 복원 규칙이 들어오도록
`UserPromptSubmit` hook에서 아래 preprompt 명령을 실행할 수 있다. 이 preprompt는
매 턴 실행되지만 같은 세션에서 로컬 작업 기억 내용이 바뀌지 않으면 축약된
unchanged preprompt만 주입한다. 작업 기억이 바뀌었거나 사용자 프롬프트가
재개/회상형이면 로컬 작업 기억 발췌와 `pk:start` 감지 규칙을 다시 주입한다.
Hook output은 plain stdout 본문이 아니라 JSON `hookSpecificOutput.additionalContext`로
내보내 화면 노출을 줄인다.

```bash
npm run pk:preprompt --silent
```

Codex에서는 `UserPromptSubmit` hook context가 화면에 그대로 펼쳐질 수 있으므로
이 hook을 쓰지 않고 AGENTS preprompt와 Project Knowledge skill의 첫 응답 규칙으로
같은 동작을 수행한다.

## 흐름

```text
work -> current local summary + append-only local evidence
     -> recall/checkpoint -> optional local candidate
     -> consolidation review -> 0..n structured objects
     -> atomic validated projection -> knowledge-objects.md
```

기본 기억은 로컬이다. 공유 review는 narrative를 그대로 복사하지 않는다. 0개로
비승격하거나, 새 객체를 만들거나, 여러 객체로 분할하거나, 기존 객체의 grounding·
relation·evolution을 보강한다. 새 객체와 revision은 projection 전체를 검증한 뒤
같은 lock 안에서 원자적으로 반영한다.

review는 생성보다 조직화를 먼저 판정한다. 현재 객체로 설명할 수 있는 episode를
새 id로 만들지 않는다. 기존 model을 지지·반박하는 case는 relation으로 연결하고,
설명이 바뀌면 current·disputed·historical·superseded 전이를 함께 기록한다.

로컬 capture는 `project`와 `process`를 미리 판정하지 않는다. 로컬에 담긴 process
insight는 관찰, 근거, 거부 대안, 재검토 조건을 보존하는 evidence이며 현재 행동
명령을 포함하지 않는다. 기능 구현·버그 수정 중 발견한 process insight도 같은
세션에서 `AGENTS.md`, skill, Project Knowledge 운영 규칙을 고치는 근거로 사용하지
않는다. 공유 객체는 현재 정본을 `authority_refs`로, 형성 근거를 exact commit과
path로 연결한다. 하나의 episode가 두 plane을 설명하면 narrative를 복제하지 않고
단일 주어를 가진 객체로 분할해 typed relation으로 연결한다.

## 명령

```bash
npm run pk:start
npm run pk:preprompt
npm run pk:remember
npm run pk:remember -- --note "<한국어 narrative>" --domain-tags "태그1,태그2" --context-hint "짧은 맥락"
npm run pk:checkpoint
npm run pk:review
npm run pk:recall -- <query>
npm run pk:recall -- --all <query>
npm run pk:recall -- --since 2026-04-01 <query>
npm run pk:recall -- --plane product-making --kind model --status current <query>
npm run pk:log -- --tail 5
npm run pk:log -- --tail 50 --all
npm run pk:validate
```

- `pk:start`는 로컬 Project Knowledge 공간을 만들고 공유 기억, 최신 로컬 작업
  기억, 최근 3개 작업 기억 record를 출력한다.
- `pk:preprompt`는 hook이 주입할 짧은 Project Knowledge 감지 규칙과 로컬 작업
  기억 발췌, 과거 기억 조회 명령 포인터를 출력한다. 같은 hook session에서 출력
  내용의 hash가 바뀌지 않으면 현재 기억을 축약해 반복 주입 비용을 낮춘다. 과거
  record는 컨텍스트에 주입하지 않는다. Hook stdout에는 JSON wrapper만 출력하고,
  실제 preprompt 본문은 `additionalContext`에 담는다.
- `pk:remember`는 현재 작업의 이어받기 narrative를
  `.project-knowledge-local/work-memory.md`에 갱신하고, 같은 note를
  `.project-knowledge-local/work-memory-log.jsonl`에 append한다. 월이 바뀌면
  직전 월 jsonl을 `archive/work-memory-log-YYYY-MM.jsonl`로 자동 이동시킨 뒤
  새 파일에 append한다. 회상 키는 note에서 자동으로 넓게 추출하지 않는다.
  보통명사는 검색 노이즈를 만들 수 있으므로, 작업을 특정하는 고유명사와 정본
  식별자가 있을 때 `--entities`, `--goal-links`, `--context-hint`, `--role`,
  `--encoding-depth`를 명시한다. `--domain-tags`는 안정적인 영역만 좁게 남긴다.
  `--encoding-depth`와 `--role`은 이 절에 정의한 값만 허용하며, 값이 어긋나면
  아무 파일도 쓰지 않고 명령이 실패한다.
- `pk:checkpoint`는 현재 evidence를 바탕으로 structured consolidation 후보
  템플릿을 만든다. 0개 객체이면 `--local-only`로 닫는다.
- `pk:review`는 candidate를 공유 기억으로 승인하거나 로컬 보관으로 처리한다.
  review는 canonical candidate를 읽기 전에 같은 디렉터리의 고유 processing path로
  atomic rename해 artifact identity를 점유한다. 그 뒤 생성된 새 candidate는 현재
  review가 삭제하지 않으며, checkpoint도 temp file을 canonical path로 atomic
  rename한다. reject 결과는 기존 entry와 symlink를 거부하고 최종 destination을
  exclusive file descriptor로 연 뒤 기록한다. 중단되어 일부만 기록된 결과를
  완료로 추정하지 않는다.

  `pk:start`와 `pk:review -- --list`는 같은 inventory와 표현을 사용한다. canonical
  candidate는 `canonical`, 처리 중인 claim은 `active`, `pending`, `canonical-conflict`,
  `already-shared`, `already-rejected`, `conflict`, `invalid` 중 하나로 나타난다.
  잘못된 claim 하나는 다른 claim의 표시를 막지 않는다. 살아 있는 review owner가
  있는 `active` claim은 복구하지 않는다. owner가 없거나 관찰한 owner가 종료된
  `pending`만 `--recover <claim>`으로 복원할 수 있다. 완전한 shared/rejected 결과가 같은 review
  id로 확인된 `already-*`만 `--discard-applied-claim <claim>`으로 정리할 수 있다.
  정리 직전에는 applied result를 다시 열어 identity와 완전성을 확인하고 durable
  sync를 마친다. `conflict`와 `invalid`는 자동으로 복원하거나 삭제하지 않는다.

  v1 recovery candidate의 shared-memory 항목은 review id, `knowledge_lane`, UTF-8 byte length, digest가
  결합된 versioned frame으로 append한다. frame 안의 Markdown heading, YAML,
  entry-shaped 예시는 새 항목으로 다시 해석하지 않는다. 기존 unframed 기억은 byte
  그대로 보존한다. writer는 base가 비었거나 LF로 끝나면 separator 없이, 그 외에는
  LF 1 byte 뒤에 완전한 frame을 append한다. `pk:validate`는 문서 전체에서 손상되거나
  중복된 frame과 유효하지 않은 authority ref를 거부한다.
  shared 승격은 완전한 owner identity를 atomic하게 공개하는 lock으로 협력하는
  `pk:review` process 사이에서 직렬화한다. stale lock 정리는 관찰한 file identity가
  그대로일 때만 수행한다.

  이 로컬 CLI는 실행 전에 발견할 수 있는 local-root/final symlink와 협력 process의
  경합을 방어한다. 같은 OS 사용자가 parent pathname을 실행 중 악의적으로 계속
  치환하는 상황까지 core Node API가 완전히 차단한다고 주장하지 않는다.

  structured candidate는 여섯 review check가 모두 `pass`여야 한다. 새 object id는
  projection에서 유일해야 한다. 기존 객체를 보강할 때는 현재 object block의
  SHA-256을 `revises_digest`로 제출해야 한다. merge는 relation target, temporal
  state, authority와 grounding을 projection 전체에서 다시 검증한다.
- `pk:recall`은 local JSONL을 record 단위로, `knowledge-objects.md`를 object 단위로,
  `shared-memory.md`를 legacy narrative 단위로 검색한다. structured 결과는 id,
  plane, kind, temporal status, match field와 authority를 표시한다. `--plane`,
  `--kind`, `--status`로 좁힐 수 있다. 현재 행동 질의에는 PK가 지시를 만들지 않고
  authority를 다시 확인하라는 경계를 먼저 출력한다.
- `pk:log`는 jsonl을 markdown으로 렌더해 사람이 읽기 쉬운 뷰를 만든다.
  `--tail N`으로 최근 N개, `--all`로 archive 포함, `--since YYYY-MM-DD`로
  시간 범위.
- `pk:validate`는 로컬/공유 경계, legacy frame의 완전성, structured object의 필수
  필드·중복 id·relation target·temporal state·authority·grounding commit과 legacy
  forward ref를 검사한다. 의미가 명령인지까지 기계 판정한다고 주장하지 않는다.

## Legacy lazy migration

기존 `shared-memory.md`는 일괄 변환하지 않는다. `pk:recall`에서 legacy narrative가
실제로 검색되면 `legacy migration candidate`로 표시한다. review는 current authority와
source를 다시 확인한 뒤 0개 비승격, 하나의 객체 보강, 여러 객체 분할 중 하나를
선택한다. 새 객체의 `legacy_refs`가 기존 review id나 narrative title을 가리키면
recall은 forward target을 함께 보여 준다. legacy bytes는 수정하지 않는다.

이 방식은 v1 append-only provenance를 보존하면서 v2 current projection의 stable id와
relation을 유일하게 유지한다. v2 revision은 git history와 exact prior block digest로
추적한다. 별도 변경 ledger를 만들지 않는다.

## 스킬 사용 기록

repo-local skill을 사용하면 다음 `pk:remember` note에 호출별 한 줄을 포함한다.
스킬 기록만을 위해 `pk:remember`를 따로 실행하지 않는다. 별도 실행은 최신 작업
요약을 짧은 기록으로 덮어쓸 수 있다.

```text
스킬 사용: <skill-name> | invoking-model: <canonical model id 또는 human> | workstream-root: <issue, PR, task의 canonical id> | reason: <사용 이유> | result: <영향을 받은 행동, 중단 판단, 또는 변경 없음>
```

한 checkpoint에서 여러 skill을 사용했으면 note 본문에 한 줄씩 적는다.
`invoking-model`은 skill을 호출한 model을 뜻하며 review record의
`author-model` 역할과 같다고 간주하지 않는다. model 식별자 형식은
`shared-skills/review-checklist-steward/references/default-checklist.md`의 모델
식별자 규칙을 따른다. `workstream-root`는 review record와 연결할 수 있는 안정된
식별자를 쓴다.

이 줄은 skill을 사용했다는 근거다. 효과를 증명하지 않는다. 이 기록은 이 clone의
로컬 log에 남은 checkpoint만 포함하므로 줄이 없다는 사실을 skill 미사용의 근거로
삼지 않는다. session preprompt는 현재 note의 앞부분만 주입하므로 전체 호출별
기록은 `npm run pk:log -- --tail <N>`으로 확인한다. clean 비율, escape, design
reset 같은 결과와의 연동은 별도 감사가 선택 편향과 비교 대상을 함께 검토해야
한다. 스킬 로딩 자동 기록과 효과 판정 자동화는 이 수동 기록의 가치가 확인되기
전에는 추가하지 않는다.

## 회상 키 기준

회상 키는 "많이 걸리는 검색어"가 아니라 나중에 기억을 활성화할 구조 슬롯이다.
보통명사는 검색 노이즈를 만들 수 있으므로 고유명사와 canonical id를 우선한다.

- `domain_tags`: 기억이 속한 안정적인 주제 영역 1-4개. 너무 넓은 도구명이나
  repo 공통어만 단독으로 넣지 않는다.
- `entities`: 실제로 구분력이 있는 사람, 조직, 제품, 라이브러리, 벤더, 서비스,
  파일, 문서, Promise/AC id, 시스템 이름. 예: `PostHog`, `Amplitude`,
  `server-analytics`, `events.yaml`, `promise:story-chain-event-contract`,
  `acceptance-check:story-chain-event-contract-router-boundary`.
- `goal_links`: 이 기억을 다시 불러야 할 목표나 과업 축.
- `context_hint`: 2-8단어 정도의 짧은 맥락. 예: "키워드 회상 기준 정정".
- `role`: `goal`, `decision`, `constraint`, `result`, `issue` 중 알 수 있을 때만.
- `encoding_depth`: `decision`, `discovery`, `discussion`, `mention` 중 하나.

선택 필드는 알 수 있을 때만 채운다. 애매하면 비워둔다.

## Consolidation 형식

Project Knowledge의 공유 후보는 narrative를 1:1로 복사하지 않는다. frontmatter에서
추출 결과와 여섯 review를 확정하고 아래 object block을 1개 이상 둔다.

````markdown
---
status: candidate
confidence: medium
last_reviewed: YYYY-MM-DD
consolidation: structured
extraction_outcome: create | revise | split | enrich | legacy-forward
review_summary: review가 내린 분할·보강 판단
review_checks:
  command_free: pass
  one_pr_falsification: pass
  verdict_free: pass
  second_situation: pass
  single_subject: pass
  deletion: pass
source_refs:
  - commit: <candidate를 만든 exact head>
---

<!-- project-knowledge-object:v1 -->
```yaml
id: product.example
lifecycle: shared-consolidated
plane: product
kind: concept
title: 설명 제목
aliases: [회상 별칭]
statement: 무엇을 왜 참이라고 보는지 설명한다.
scope: [적용 범위]
non_scope: [적용하지 않는 범위]
forces: [이 형태를 만든 긴장]
rejected_alternatives:
  - alternative: 기각한 대안
    reason: 기각한 이유
authority_refs: [docs/product-identity.md]
grounding:
  - type: commit
    ref: <exact commit SHA>
    path: <그 commit과 현재 tree에 모두 존재하는 path>
    note: 이 근거가 설명하는 것
relations: []
temporal_status: current
evolution:
  - date: YYYY-MM-DD
    note: 객체가 형성되거나 바뀐 이유
refresh_conditions: [다시 검토할 관측]
answers: [다음 작업에서 답할 구체적 질문]
legacy_refs: []
```
````

review는 다음 검사를 적용한다.

1. **명령 금지** — 지시로 바꿔도 내용 손실이 없으면 process authority로 보낸다.
2. **1-PR 반증** — 평범한 PR 하나로 거짓이 될 현재값은 pointer로 바꾼다.
3. **verdict 금지** — 허용·release·go/no-go·clean은 owning dated record로 보낸다.
4. **두 번째 상황** — 현재 workstream 밖의 미래 질문을 지목하지 못하면 local에 둔다.
5. **단일 주어** — product와 product-making을 함께 설명하면 객체를 분할한다.
6. **삭제** — 객체 삭제가 규칙 준수 행동을 바꾸면 shadow canon이므로 authority로 옮긴다.

`current`, `disputed`, `historical`, `superseded`를 조용히 덮어쓰지 않는다.
`disputed`는 `challenged_by`, `superseded`는 current successor의 `supersedes`
relation이 있어야 한다. case는 역사 사실로 남을 수 있고 concept/model은 반례와
evolution에 따라 상태가 바뀐다.

## Bounded pilot 판정

첫 paired slice의 고정 질의, 시간, object 비용, authority drift는
[`pilot-evaluation.md`](./pilot-evaluation.md)에 기록한다. 다음 관련 작업 10건의
유효 recall은 구현 완료를 꾸미기 위한 소급 사례가 아니라 실제 후속 작업에서만
채운다.

이 10건의 작업별 판단과 기록은 agent 책임이다. `pk:start`와 `pk:preprompt`가
남은 표본 수와 책임을 알리면 agent는 Human checkpoint 없이 현재 authorized
workstream의 적격성을 결과 확인 전에 판정한다. 첫 paired pilot에서 고정한 12개
객체가 설명하는 배경을
실제로 다시 묻는 적격 작업이면 정본·git/issue history를 재구성하기 전에
`pk:recall`을 실행하고, 종료 시 `pilot-evaluation.md`의 시간순 다음 pending 행에
`valid recall`, 절약 시간 또는 `unknown`, drift/misread와 근거를 기록한다. 도움되지
않은 `no`도 버리지 않는다. Human은 개별 행을 판정하지 않고 10건 완료 뒤 아래 실패
신호에 따라 구조를 유지·축소·폐기하는 정책 선택만 맡는다.

실패 조건의 활용도와 작성 비용은 `AND`로 묶지 않는다. 다음 관련 작업 10건에서
유효한 shared recall이 2회 미만이면 낮은 활용도만으로 구조 축소를 검토한다. 객체당
작성 시간이 30분을 넘으면 recall 횟수와 무관하게 consolidation 형식과 relation을
축소한다. 이 밖에도 아래 조건은 각각 독립적으로 확장을 멈추는 신호다.

- 제출 객체의 30% 이상이 명령·현재값·verdict를 포함한다.
- 후보 객체의 1/3 이상이 단일 plane으로 분리할 때 설명력을 잃는다.
- 고정 질의의 정확도·설명력·재구성 비용이 legacy 파일 단위 검색보다 개선되지 않는다.
- relation이 실제 recall 결과에서 다음 객체를 찾는 데 쓰이지 않는다.
- authority drift 때문에 stale explanation을 current로 반복 반환한다.

실패 신호가 생겨도 이 문서가 자동 verdict를 내리지는 않는다. Human review에서
relation을 제거한 record schema, 단일 subject tag, 또는 local-only capture로
축소할지를 결정한다.
