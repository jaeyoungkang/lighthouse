# Agent Guide

**Light House** — 학술 논문 탐색을 돕는 Search-first 어시스턴트. 사용자의 검색,
인용·비슷한 논문 탐색, 연구 공백 후속 액션에 반응해 구조화된 코멘트를 제공한다.

이 파일은 세션 진입용 navigation이다. 제품 설명, 운영 절차, 구현 원칙, 스킬별
라우팅 상세는 각 정본이 소유하고, 여기서는 진입 규칙과 포인터만 유지한다.

## Read Order

1. `docs/product-identity.md` — 제품 정체성
2. `docs/project-knowledge/README.md` — 공유 프로젝트 맥락과 기억 운영
3. 사용자 연구·비공개 베타·피드백·제품 발견·지식 정리 작업이면
   [`corca-ai/moonlight-project-knowledge`](https://github.com/corca-ai/moonlight-project-knowledge)의
   `README.md`와 관련 자료를 읽는다. 새 리서치 리포트와 장기 보존할 지식도 이
   저장소에 기록한다.
4. 작업에 맞는 정본만 추가로 읽는다.

| 작업                                    | 읽을 문서                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| 사용자 연구·피드백·제품 발견·지식 관리  | Moonlight Project Knowledge `README.md`, `docs/contract-maps/feedback-routing.md` |
| Promise 추가·수정·철회                  | `docs/mission-control.md`, `docs/contracts/story-chain/README.md`                 |
| 코드 구현                               | `docs/implementation.md`                                                          |
| DB 접근·repository 경계 변경            | `docs/implementation.md`, `docs/conventions.md`                                   |
| UI 구현·시각 변경                       | `docs/design-standards.md`, `docs/intent-traceability.md`                         |
| 검증 게이트 추가·이해                   | `docs/ci-structure.md`, `docs/contract-maps/quality-gates.md`                     |
| runtime 처리 순서 변경                  | `docs/runtime-flows/README.md`                                                    |
| 계약의 architecture impact 판정         | `docs/agent-skills.md`, `docs/mission-control.md`                                 |
| Architecture Fitness review             | `docs/architecture-fitness/README.md`, `docs/agent-skills.md`                     |
| skill 라우팅·수명주기                   | `docs/agent-skills.md`                                                            |
| 제품 중심 개념 전환                     | `docs/agent-skills.md`, `docs/principles.md`, `docs/conventions.md`               |
| glossary·용어 사전 변경                 | `docs/agent-skills.md`, `docs/contracts/story-chain/concepts.md`                  |
| Contract Maps 변경                      | `docs/contract-maps/README.md`                                                    |
| SLO·용량·롤아웃 판단                    | `docs/operational-readiness.md`                                                   |
| 프로젝트·작업 프로세스·검색 서비스 현황 | `docs/project-status.md`                                                          |
| 공유 프로젝트 지식                      | `docs/project-knowledge/README.md`                                                |

Moonlight Project Knowledge는 Moonlight 전반의 장기 지식관리 저장소이다. 진행 중인
리서치와 리포트는 `research/`, 재사용할 수 있게 정리한 지식은 `knowledge/`,
종료되거나 이전된 자료는 `archive/`에 둔다. 현재 제품 계약과 구현은
Lighthouse가 소유한다.

sibling checkout이 있으면 `../moonlight-project-knowledge/README.md`에서
시작하고, 없으면 위 GitHub 저장소를 사용한다. 과거 자료의
`corca-ai/moonlight-research` commit 고정 링크는 GitHub rename redirect로
계속 유효하므로 고쳐 쓰지 않는다. Lighthouse가 Moonlight Project Knowledge
자료를
사용할 때는 해당 자료의 commit 고정 링크를 Lighthouse 문서나 PR에 남긴다.
Moonlight Project Knowledge 자료에는 관련 Lighthouse 기준 문서의 commit 고정
링크를
남기고, 제품에 반영됐을 때는 Lighthouse PR 또는 merge commit을 추가한다.
승인된 제품 의미는 Mission Control과 Story Chain으로 전달한다.

Next.js 작업에서는 필요한 경우 현재 설치된 Next.js 문서를 확인한다. 과거 학습보다 repo와 로컬 패키지를 우선한다.

## Executable Slice First

실행 가능한 최소 절단의 적용 시점은 `docs/implementation.md`, 상세 조건과 안전
경계는 `docs/conventions.md`의 `구현 착수 — 실행 가능한 최소 절단`을 따른다.

## Project Knowledge

컨텍스트에 Project Knowledge start 출력, 로컬 작업 기억, 또는 `project-knowledge-preprompt`가 없으면 agent가 첫 응답 전에 즉시 `npm run pk:start`를 실행한다. 작업 전환, 커밋 전후, 컨텍스트 정리 시점에는 `npm run pk:remember -- --note "<한국어 narrative>"`로 로컬 작업 기억을 갱신한다. `/clear` 2단계 대응, harness별 hook 동작, 공유 승격 기준은 `docs/project-knowledge/README.md`와 `project-knowledge` skill이 정본이다.
repo-local skill을 사용했으면 다음 `pk:remember` note에
`docs/project-knowledge/README.md`의 `## 스킬 사용 기록` 형식으로 남긴다.

## Project Status

프로젝트 현황, 작업 프로세스 현황, 검색 서비스 현황, `status-tracker`, #2,
#3 작업은 `docs/project-status.md`에서 시작한다. 관련 child issue·PR·정본 변경이
tracker의 현재 사실, owner, verdict, 다음 행동을 바꾸면 같은 closeout에서 해당
tracker를 갱신한다. tracker는 정본의 projection이며 별도 backlog나 종합 verdict를
만들지 않는다. 기계적 checkpoint는 `npm run project-status -- check` 후 권한 범위에
따라 `dry-run` 또는 `sync`로 갱신한다.

## Mission Control

Promise-driven 작업은 `mission-control` skill과 Story Chain을 기준으로 닫는다. 진입은 `/mission-control`, `mc`, 또는 Promise·계약·의도·AC·Aspect·이벤트 계약 계열 키워드다 — 전체 트리거 목록은 skill frontmatter가 정본이다. 계약 대화의 용어 해석과 모호성 확인 절차는 `mission-control` skill의 `## Vocabulary`가 소유한다. 운영 절차는 `docs/mission-control.md`, 검증은 `npm run mc:validate-story-chain`. Story Chain 바깥에 별도 backlog, judgment, reality ledger를 만들지 않는다 — 현재 상태는 `docs/contracts/story-chain/`과 Evidence Ledger에서 계산한다.

## Operational Readiness

operational-readiness owner는 skill이 아니라 workflow 소유권 taxonomy의 mandate 보유자다. SLO 정의와 용량 판단(목표 동시성에서 5xx율·p99·풀 사용률 임계를 숫자로 고정한다), 부하 스모크 레일, anti-pattern lint family, 롤아웃 go/no-go verdict를 소유한다. 숫자 기준·체크리스트·판정 권한은 `docs/operational-readiness.md`, dated 실행·verdict는 `docs/operational-readiness-records.md`, lint family 목록은 `docs/contract-maps/quality-gates.md` Gate Stack이 정본이다. 게이트 의미 편집은 `quality-gate-steward`, 레일·런타임 편집은 `runtime-flow-sync`로 라우팅하되, "이 코호트를 열어도 되는가" verdict는 owner가 닫는다. 날짜가 게이트를 이기지 않는다.

## Skill Routing

스킬 라우팅 정본은 `docs/agent-skills.md`다. 진입이 모호하면 First-Route Rules, 수명주기·process 규칙은 Skill Lifecycle을 따르고, 각 skill frontmatter의 트리거 서술이 1차 진입 신호다. 이 문서에는 작업 시작 전에 반드시 적용할 핵심 진입 규칙만 둔다.

- 사용자-facing 의미, Promise, Acceptance Check, Aspect, Evidence Ledger가 바뀌는 작업은 구현 전에 Mission Control로 먼저 진입한다.
- 새 Experience·Moment·Promise·Acceptance Check·Aspect나 의미가 바뀐 계약이 반응 시간, domain/data shape, 정본·소유권, 상태 수명·영속·복원, 실행 순서·동시성, runtime 배치와 provider/AI 경계·실패 정책, 보안·개인정보, fan-out·용량·비용, 관측 identity/cardinality, 호환·은퇴, 여러 surface의 shared invariant에 걸친 기대를 바꾸면 구현 전에 `Contract Architecture Impact Review`를 연다. 모든 판정은 작업이 이미 쓰는 durable plan/contract/runtime-flow/PR 본문에 `## Contract Architecture Impact Review`로 남긴다. `none`은 현재 경계가 충분하다는 근거만 기록하고, `constrain-existing / reshape`는 현재·선택 owner, 거부 대안, 구조적 방어까지 기록한다.
- CAIR가 `reshape`이거나 Concept Shift가 `remove`를 선택했거나, 여러 owning contract bundle·새 cache/state lifecycle·scope checkpoint가 걸리면 구현 전에 기존 durable plan에 `## Propagation Map`을 남긴다. map은 owning edit, inspect-only downstream impact, compatibility, split cleanup, 예상 file/churn 범위를 구분한다. 예산 초과와 scope 증가는 Human checkpoint이며 file/LOC hard gate로 바꾸지 않는다. Sufficiency Review의 새 AC/IC ref가 ledger의 Source Promise 밖 owner를 직접 review하는 것은 결정적 owner-boundary 위반으로 차단한다.
- CAIR가 선택한 구조의 구현 준수, 결정 적합성, 검토 프로세스 효과를 검증할 때는 repo-local `architecture-fitness-review` skill과 `docs/architecture-fitness/README.md`의 Lighthouse adapter를 사용한다. 지원되는 v0.5 case kind와 실제 활성 profile은 `docs/agent-skills.md`가 소유한다. 지원되지 않는 렌즈는 deterministic verdict를 만들지 않고 `unknown`과 Human 판단으로 남긴다. CAIR의 `none/constrain-existing/reshape`, Architecture Fitness의 `healthy/degraded/unknown`, Human decision, merge eligibility를 합치지 않는다. Architecture Fitness는 CAIR를 대체하거나 별도 impact registry를 만들지 않는다.
- 제품 중심 개념이 바뀌거나 retired architecture shape가 남을 수 있는 작업은 구현 전에 `Concept Shift Architecture Review`를 연다. 기존 route/state/repository/domain-access/runtime-flow/analytics/DB shape는 기본 보존하지 않고 `preserve / migrate-read-only / remove` 판정을 기록한다.
- 제품 방향, 사용자-facing 행동, 제품 정책처럼 범위와 증거가 정리된 제품 레벨의 새 선택을 논의하거나 사용자가 기존 제품 결정을 명시적으로 다시 열었을 때만 `jaeyoung-think`를 사용한다. 산출물은 Human 승인 전 proposal이며 전파하지 않는다. 아키텍처, DB, cache, repository, runtime, quality gate 같은 기술 의사결정에는 사용하지 않는다. 기술 판단은 implementation author가 해당 정본과 영향받는 workflow owner를 따라 닫는다.
- 기존 제품 결정이나 그 이유를 회상·탐색·설명할 때는 `jaeyoung-think`를 사용하지 않는다. Project Knowledge와 정본 문서, `rg`, `git log`/`git show`, issue/PR history에서 근거를 찾는다.
- 엔지니어링 process workstream의 분리, local-only insight, self-unblock
  checkpoint 정책은 `docs/agent-skills.md`의 Skill Lifecycle이 소유한다. 이
  navigation은 해당 작업을 별도 process session의 `skill-governance-steward`로
  라우팅하며 세부 조건을 다시 정의하지 않는다.

## Boundaries

- **Always** — 사용자-facing 동작은 Promise → Aspect → Evidence Ledger → Code/Test까지 같은 변경 안에서 닫는다.
- **Always** — 모든 incident는 같은 close-out에 최소 1개의 구조적 방어(게이트·테스트·Aspect)를 커밋한다. 장애를 기록만 하고 방어를 안 만들면 같은 무방비 의존성이 다시 물린다. 구조적 방어는 보통 `## Operational Readiness`가 소유하는 anti-pattern lint family·부하 스모크 레일로 닫는다.
- **Ask first** — AI response channel/structured-generation contract, 새 도구, runtime response policy, 새 runtime-flow, 상위 정본(`docs/product-identity.md`, `docs/contracts/*`, `docs/principles.md §0`, `docs/mission-control.md`)을 바꿀 때는 먼저 확인한다.
- **Never** — Story Chain 없이 코드만 수정하지 않는다. 검증 회피용 disable, 테스트 스킵, 규칙 무력화를 하지 않는다. LLM judge를 simulation wrapper나 ad-hoc prompt로 우회하지 않는다. commit 후 git index를 `git rm --cached -r ...` 류로 비우지 않는다 — 의도된 변경 외의 mass-deletion은 작업 완료가 아니라 손상이다. analytics stub event 처리는 `docs/analytics/wire-retire-exempt-decision-tree.md`의 wire / retire / exempt 분기를 따른다 (특히 `lane: product`에 exempt를 적용하지 않는다).

## Implementation Navigation

코드 진입점은 `docs/implementation.md`의 runtime zone과 경로별 시작점에서 찾는다.
현재 제품 경계는 `docs/product-identity.md`, 상태 구조는
`docs/infrastructure.md`, 처리 순서는 `docs/runtime-flows/`가 각각 소유한다.

## Validation

Use the smallest honest gate set for the change, and do not mark work complete if a relevant gate was skipped.

PR merge에는 exact content head의 review record가 필요하다 — main의 `review-closeout` required check가 강제하며, record 형식과 3-상태 closeout(clean / findings remain / stale)은 `docs/agent-skills.md` § Review Closeout Status와 `review-checklist-steward`의 § Usage Records가 정본이다. merge 전 로컬 미리보기는 `npm run quality:pr`.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run evidence-ledger
npm run dup:check
```

For contract-affecting Story Chain / Evidence Ledger / Promise / Aspect work —
docs-only edits included — close with the canonical alias instead of a
hand-picked subset:

```bash
npm run quality:contract
```

The required gate list lives only in the `package.json` alias definition;
documents reference the alias by name so the list cannot drift (issue #193).
