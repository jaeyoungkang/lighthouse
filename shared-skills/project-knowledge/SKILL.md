---
name: project-knowledge
description: Light House의 Project Knowledge를 로드, 갱신, consolidation, review할 때 사용한다. local-episodic 작업 기억, shared-consolidated product/product-making 지식 객체, concept/model/case, record-level recall, legacy shared-memory lazy migration을 다룬다.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Project Knowledge Skill

이 스킬은 Light House의 제품과 제품제작 도메인 지식체계를 고도화한다. 공유
Project Knowledge는 다음 두 질문에 답한다.

1. 제품은 왜 지금과 같은 개념·행동·구조를 가지게 되었는가?
2. 프로젝트 팀은 왜 지금과 같은 방식으로 제품을 발견하고, 선택하고, 만들고,
   검증하고, 운영하는가?

`remember -> recall -> candidate -> consolidation review -> knowledge object`는 이
목적을 수행하는 절차다. 로컬 narrative capture는 유지하고 공유 승격에서 0..n개
설명 객체로 변환한다.

## 목적 우선 진입

명령이나 review check를 실행하기 전에 이번 작업이 위 두 질문 중 무엇을 더 잘
설명해야 하는지 한 문장으로 고정한다. 그다음 아래 순서로 읽는다.

1. 설명할 제품 또는 제품제작 subject와 다음 작업에서 다시 답할 질문
2. 현재 `concept | model | case` 객체와 typed relation
3. 로컬 episode가 드러낸 형성 배경, 긴장, 기각 대안, 반례와 변화
4. 현재 상태와 행동을 소유하는 authority와 exact grounding
5. 마지막으로 capture, candidate, review, validation 절차

절차 완료나 기록량은 승급 목적이 아니다. 새 설명력이 없으면 0개로 닫는다. 현재
명령·값·verdict만 남는다면 authority로 돌려보내고 공유 객체를 만들지 않는다.

## 조직화된 성장

공유 지식은 새 객체를 하나씩 append하는 목록으로 성장하지 않는다. consolidation은
항상 현재 projection 전체를 읽고 새 episode가 기존 지식 구조를 어떻게 바꾸는지
판정한다.

1. 같은 subject와 질문을 가진 기존 concept/model/case를 먼저 찾는다.
2. 새 근거가 기존 설명을 강화하면 grounding·evolution·relation을 enrich한다.
3. 설명의 경계가 바뀌면 객체를 revise하거나 split한다.
4. 반례는 기존 model을 `disputed`로 열고 `challenged_by`로 연결한다.
5. 대체 설명이 형성됐을 때만 temporal status와 `supersedes` 관계를 함께 바꾼다.
6. 기존 객체로 설명할 수 없는 안정된 subject가 있을 때만 새 객체를 만든다.

새 case는 가능한 한 자신이 지지·반박·형성한 concept/model과 연결한다. relation이
없는 case와 같은 질문을 답하는 중복 객체는 명시적인 이유가 없으면 local에 둔다.
review는 개별 block의 완전성뿐 아니라 전체 projection의 subject 중복, relation,
temporal transition과 recall path가 더 명확해졌는지를 판정한다.

## 파일

- 로컬 작업 기억: `.project-knowledge-local/work-memory.md`
- 로컬 작업 기억 로그 (append-only JSONL): `.project-knowledge-local/work-memory-log.jsonl`
- 월 단위 archive: `.project-knowledge-local/archive/work-memory-log-YYYY-MM.jsonl`
- 로컬 후보: `.project-knowledge-local/candidate.md`
- 공유 설명 지식: `docs/project-knowledge/knowledge-objects.md`
- bounded pilot 평가: `docs/project-knowledge/pilot-evaluation.md`
- legacy narrative read source: `docs/project-knowledge/shared-memory.md`
- 안내 문서: `docs/project-knowledge/README.md`
- 스크립트: `scripts/project-knowledge/`

## 실행 흐름

1. 위 두 도메인 질문 중 이번 작업이 설명할 질문과 subject를 먼저 고정한다.
2. 현재 컨텍스트에 Project Knowledge start 출력, 로컬 작업 기억, 또는 `project-knowledge-preprompt`가 없으면 첫 응답 전에 `npm run pk:start`를 실행한다.
3. `프로젝트 시작`, `project start`, `pk:start` 요청을 받으면 `npm run pk:start`를 실행한다.
4. 작업 전환, 커밋 전후, 컨텍스트 정리 시점에는 `npm run pk:remember -- --note "<한국어 narrative>"`를 실행한다. 이 명령은 최신 요약(`work-memory.md`)을 갱신하고 append-only JSONL 로그에 한 record를 추가한다. 월이 바뀌면 직전 월 jsonl이 `archive/work-memory-log-YYYY-MM.jsonl`로 자동 이동한다. 회상 키는 보통명사 확대가 아니라 구분력 있는 고유명사와 canonical id 중심으로 남긴다. 해당 기억의 핵심을 특정하는 사람, 조직, 제품, 라이브러리, 벤더, 서비스, 파일, 문서, Promise/AC id, 도구명이 있으면 `--entities`, `--goal-links`, `--context-hint`, `--role`, `--encoding-depth`를 함께 전달한다. repo-local skill을 사용했으면 같은 note에 `docs/project-knowledge/README.md`의 `## 스킬 사용 기록` 형식으로 호출별 한 줄을 포함한다.
5. 과거 작업 기억이 필요하면 `npm run pk:recall -- <query>`를 실행한다. 기본 검색 범위는 최근 30일 + 공유 기억이고, archive를 포함하려면 `--all`, 시간 범위를 바꾸려면 `--since YYYY-MM-DD`를 쓴다.
6. 최근 N개 기억을 사람이 읽고 싶을 때는 `npm run pk:log -- --tail <N>`(archive 포함은 `--all`)로 jsonl을 markdown으로 렌더한다.
7. `pk:start`/`pk:preprompt`가 incomplete bounded pilot을 알리면 agent가 Human 확인 없이 현재 authorized workstream의 적격성을 결과 확인 전에 판정한다. 첫 paired pilot에서 고정한 12개 객체의 설명을 실제로 다시 묻는 적격 작업이면 재조사 전에 `pk:recall`을 실행하고, 종료 시 `docs/project-knowledge/pilot-evaluation.md`의 다음 pending 행에 `valid recall: yes | no`, 절약 시간 또는 `unknown`, drift/misread와 근거를 기록한다. 성공 표본만 고르거나 단순 명령 실행을 `yes`로 세지 않는다. Human은 10건 완료 뒤 유지·축소·폐기 선택만 맡는다.
8. repo 차원의 반복 설명 가치가 생기면 `npm run pk:checkpoint`로 `candidate.md`를 만든다. 로컬 capture에서는 plane을 미리 판정하지 않는다.
9. 후보 review는 현재 projection 전체에서 기존 객체 보강·revision·split·temporal transition·relation 연결을 먼저 판정한 뒤, 남은 subject만 새 객체로 추출한다. 원문을 복사하지 않고 0..n개 객체를 만들며, 각 객체는 정확히 하나의 `product | product-making` plane과 `concept | model | case` kind를 갖는다. stable id, statement, scope/non-scope, forces, rejected alternatives, authority refs, exact-commit grounding, relation, temporal status, evolution, refresh condition, answers를 채운다. 0개이면 `--local-only`, 1개 이상이면 조직화 검토와 여섯 shadow-canon check를 통과한 뒤 `npm run pk:review -- --approve .project-knowledge-local/candidate.md`를 실행한다.
10. `pk:start`나 `pk:review -- --list`가 `candidate.review-<id>.md`를 보여주면 `docs/project-knowledge/README.md`의 recovery state contract를 확인한다. 명령이 허용한 상태에서만 기존 `--recover` 또는 `--discard-applied-claim` action을 실행한다. `conflict`와 `invalid`는 자동으로 변경하지 않는다.
11. 구조나 스크립트를 바꾼 뒤에는 `python3 scripts/sync-agent-skills.py`, `npm run guard:skills`, `npm run pk:validate`를 실행한다.

## `/clear` 대응

`/clear`는 기억 저장과 기억 복원의 두 단계로 다룬다.

컨텍스트를 비우기 전에는 agent가 현재 작업 흐름, 판단 전환, 다음 처리 순서를 한국어 narrative로 요약해 아래 명령을 실행한다.

```bash
npm run pk:remember -- --note "<한국어 narrative>"
```

컨텍스트를 비운 뒤 새 세션의 첫 응답 전에는 아래 명령을 실행한다.

```bash
npm run pk:start
```

필요한 과거 맥락이 최신 요약에 없으면 아래 명령으로 로컬 evidence까지 검색한다.

```bash
npm run pk:recall -- <query>
```

Claude Code에서는 clear 이후 다음 사용자 입력에도 복원 규칙이 들어오도록 `UserPromptSubmit` hook에서 아래 preprompt 명령을 실행할 수 있다. 이 preprompt는 매 턴 실행되지만, 같은 세션에서 로컬 작업 기억 내용이 바뀌지 않으면 축약된 unchanged preprompt만 주입한다. 작업 기억이 바뀌었거나 사용자 프롬프트가 재개/회상형이면 로컬 작업 기억 발췌와 `pk:start` 감지 규칙을 다시 주입한다. Hook output은 plain stdout 본문이 아니라 JSON `hookSpecificOutput.additionalContext`로 내보내 화면 노출을 줄인다.

```bash
npm run pk:preprompt --silent
```

Codex에서는 `UserPromptSubmit` hook context가 화면에 그대로 펼쳐질 수 있으므로 이 hook을 쓰지 않고 AGENTS preprompt와 이 스킬의 첫 응답 규칙으로 같은 동작을 수행한다. slash command hook을 제공하는 harness에서는 clear 직전 hook에 `pk:remember`를 연결하고, clear 직후 또는 session-start hook에 `pk:start`를 연결한다.

## 기억 작성 형식

기억은 한국어 narrative로 쓴다. git 정보는 본문이 아니라 근거다.

회상 키는 note 본문에만 맡기지 않는다. 작업 기억을 다시 불러야 할 고유명사나
정본 식별자가 있으면 구조화 필드에 명시한다.

- `--entities`: 검색 노이즈를 줄이기 위해 보통명사보다 고유명사와 canonical id를
  우선한다. 예: `PostHog`, `Amplitude`, `server-analytics`,
  `events.yaml`, `promise:story-chain-event-contract`,
  `acceptance-check:story-chain-event-contract-router-boundary`.
- `--domain-tags`: 넓은 검색어가 아니라 기억을 묶는 안정적인 영역을 1-4개만
  넣는다.
- `--goal-links`: Promise, Acceptance Check, issue, PR처럼 나중에 같은 목표로
  다시 찾을 식별자를 넣는다.
- `--context-hint`: 2-8단어 정도로 회상 상황을 좁힌다.

보통명사는 그 단어만으로 이 기억을 찾을 수 있을 때만 쓴다. `analytics`,
`contract`, `test`처럼 repo 전반에 넓게 걸리는 말은 단독 회상 키로 남기지
않는다.

```bash
npm run pk:remember -- --note "<한국어 narrative>" \
  --entities "PostHog,Amplitude,server-analytics,events.yaml,promise:story-chain-event-contract" \
  --domain-tags "analytics,story-chain" \
  --goal-links "acceptance-check:story-chain-event-contract-router-boundary" \
  --context-hint "PostHog removal sink migration" \
  --role "result" \
  --encoding-depth "decision"
```

공유 후보는 `npm run pk:checkpoint`가 만드는 structured 골격을 사용한다. review는
다음 여섯 항목을 모두 `pass`로 확정한다.

```markdown
---
consolidation: structured
extraction_outcome: create
review_summary: 공유 설명 객체로 추출한 이유
review_checks:
  command_free: pass
  one_pr_falsification: pass
  verdict_free: pass
  second_situation: pass
  single_subject: pass
  deletion: pass
---
```

- 현재 행동을 지시하면 owning process authority로 보낸다.
- 평범한 PR 하나로 거짓이 되는 현재값은 authority pointer로 바꾼다.
- release·go/no-go·clean verdict는 owning dated record로 보낸다.
- 현재 workstream 밖의 두 번째 질문을 지목하지 못하면 local에 둔다.
- product와 product-making을 함께 주어로 삼으면 객체를 분할한다.
- 객체 삭제가 agent 행동을 바꾸면 shadow canon이므로 authority로 옮긴다.

## 판단 기준

로컬 작업 기억에는 현재 작업 흐름, 판단 전환, 다음 처리 순서를 남긴다. 최신
요약은 `work-memory.md`, append-only 구조 로그는 `work-memory-log.jsonl`에
남긴다. 월이 바뀌면 직전 월 jsonl이 `archive/`로 자동 이동한다. 사람이 읽는
markdown 뷰는 별도 파일로 누적하지 않고 `npm run pk:log` 명령으로 jsonl에서
바로 렌더한다. JSONL record는 `type`, `date`, `title`, `summary`,
`context_hint`, `encoding_depth`, `role`, `domain_tags`, `entities`,
`goal_links`, `events`, `source_refs`를 가진다. 회상 키는 자동으로 넓게
추출하지 않는다. 대신 작업을 대표하는 고유명사와 정본 식별자가 뚜렷하면 agent가
직접 구조화 필드로 남긴다.

로컬 기억의 process insight는 관찰, 근거, 거부 대안, 재검토 조건을 보존하는
evidence이며 현재 행동 명령을 포함하지 않는다. 공유 review는 product와
product-making 중 설명 대상을 확정한다. 실제 명령은 해당 process 정본이 소유한다.
일반 agent-process 분리 정책의 정본은 `docs/agent-skills.md`의 Skill Lifecycle이고,
`AGENTS.md`는 진입을 안내하며 관련 skill은 그 정책을 실행한다.
PK 항목을 삭제했을 때 규칙을 준수하는 agent의 행동이 달라진다면 명령이 PK에
잘못 들어간 것이다.

공유 객체에는 다음 기여자도 반복해서 참조할 제품·시스템 개념, 제작 방식이 생긴
이유, 사례, 기각 대안과 재검토 조건을 남긴다. 현재 agent 행동을 지시하는 문장은
owning authority에만 둔다. 기존 `shared-memory.md`는 lazy migration 대상이다.
