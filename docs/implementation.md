---
type: design
---

# 구현 가이드

이 문서는 Light House 구현 작업의 단일 진입점이다. 구현 위치를 찾고, 적용할
workflow owner와 정본을 선택하고, 완료 순서를 정하는 navigation을 소유한다.
설계 원리는 `docs/principles.md`, 코딩 규칙은 `docs/conventions.md`, 현재 상태
구조는 `docs/infrastructure.md`가 소유한다. 제품 의미와 검증 권한은 Story Chain,
runtime 처리 순서는 `docs/runtime-flows/`, gate 의미는 `docs/ci-structure.md`와
각 gate owner가 소유한다.

구현 작업을 하나의 profile로 분류하지 않는다. 한 변경은 여러 runtime zone을
함께 수정할 수 있다. Runtime zone은 탐색을 돕고, cross-cutting obligation은
어떤 owner와 검증이 필요한지를 결정한다. 어느 zone에도 명확히 놓이지 않는
변경은 영향이 없다는 뜻이 아니다. `docs/agent-skills.md`의 First-Route Rules에서
owner를 다시 찾는다.

## 구현 모델

### Runtime zone

Runtime zone은 코드가 실행되는 위치와 허용된 import 방향을 설명한다. 디렉터리
이름만으로 사용자-facing 의미나 계약 영향을 판정하지 않는다.

| Zone | 실행 의미 | 주요 위치와 진입점 |
| --- | --- | --- |
| UI | 브라우저에 전달되는 화면, 상호작용, client state | `app/components/`, `app/components/research/`, `app/components/research-route-renderers/`, `app/stores/` |
| HTTP entrypoint | 외부 HTTP 요청을 받아 인증, admission, 입력·응답 경계를 적용 | 모든 `app/**/route.ts`, `proxy.ts` |
| Server application | domain-access, service, agent, AI generation과 server orchestration | `app/server/domain-access/`, `app/server/services/`, `app/server/agent/`, `app/server/ai-generation/` |
| Data/persistence | DB schema, migration, 저수준 저장소와 지속 상태 | `app/server/repository/`, `supabase/`, `docs/infrastructure.md`의 Persistent State |
| Shared contracts | client와 server가 함께 쓰는 순수 타입, schema, 값 변환 | `app/domain/`, server runtime import가 없는 `app/lib/` |

Next.js Route Handler는 URL에 따라 `app/api/` 밖에 놓일 수 있다. 따라서 HTTP
entrypoint는 `app/api/**`가 아니라 `app/**/route.ts` 규칙으로 찾는다. 정확한 배치와
import 규칙은 `docs/conventions.md` §1~§3이 소유한다. Server-only 모듈을 shared
contract로 취급하지 않으며, `app/lib/`의 runtime 역참조 방어도 같은 문서가 소유한다.

### Cross-cutting obligation

Obligation은 변경 위치와 독립적으로 적용된다. 아래 신호가 보이면 해당 owner의
절차를 먼저 따른다. Zone 이름이나 path match만으로 `none`, merge eligibility,
CAIR verdict를 만들지 않는다.

| Obligation | 진입 신호 | Owner와 정본 | 완료 근거 |
| --- | --- | --- | --- |
| Product contract | 사용자-facing 의미, Promise, Acceptance Check, Aspect, Evidence Ledger 변화 | Mission Control, `docs/contracts/story-chain/` | `quality:contract`와 covering evidence |
| Runtime flow | 처리 순서, fallback, provider/API 경계, persistence·sync ownership 변화 | `runtime-flow-sync`, `docs/runtime-flows/` | 갱신된 flow와 관련 runtime test |
| Analytics / observability | canonical event, Amplitude, local audit sink, event router 변화 | `analytics-event-steward`, `docs/analytics/events.yaml` | event contract와 관련 test/evidence |
| Auth / security / capacity | 인증, privileged capability, 입력 한도, deadline, SLO, rollout 변화 | 관련 security owner, Operational Readiness, 기존 guard family | owner가 요구하는 negative test, guard, readiness record |
| Process / quality | agent routing, skill, Project Knowledge, gate 의미나 CI wiring 변화 | `skill-governance-steward` 또는 `quality-gate-steward` | process 전용 검증과 exact-head review |

DB 접근과 repository 경계는 독립 profile이 아니다. Data/persistence zone을 수정하면서
source owner, timing, freshness, fallback이 바뀌는 구현이다. 구조 판단과 기록 항목은
`docs/conventions.md` §4가 소유한다. 실행·영속 순서가 바뀌면 Runtime flow obligation을,
사용자-facing 의미가 바뀌면 Product contract obligation을 함께 적용한다.

## 구현 순서

### 1. 범위를 정한다

변경할 runtime zone을 모두 적고 영향받는 obligation을 확인한다. 사용자-facing
의미가 바뀌면 코드보다 Mission Control을 먼저 연다. Process와 제품·기능 구현이
함께 나타나면 `docs/agent-skills.md`의 Skill Lifecycle에 따라 process workstream을
분리한다.

### 2. 구조와 가정을 확인한다

편집에 영향을 받는 정의와 호출 지점을 확인한다. 문서, 문자열 계약, fixture와 경로
규칙은 `rg`로 함께 찾는다. 실패 결과가 구현 방향을 바꾸는 미검증 가정이 있을
때만 `docs/conventions.md`의 실행 가능한 최소 절단을 만든다.

### 3. 가장 작은 owner에서 구현한다

현재 zone의 import 경계와 해당 obligation의 정본을 따른다. 여러 zone이 같은
invariant를 공유하면 호출 지점마다 규칙을 복제하지 않고 가장 작은 공통 owner에
둔다. 기존 abstraction이 목적을 잃었다면 guard를 추가하기 전에
`docs/principles.md` §6에 따라 abstraction을 줄일 수 있는지 먼저 검토한다.

### 4. 관련 검증을 실행한다

수정한 owner의 targeted test와 guard부터 실행한다. 일반적인 PR 모양의 코드 변경은
`quality:fast`로 닫는다. Story Chain 또는 Evidence Ledger가 바뀌면
`quality:contract`를 사용한다. Gate command와 포함 관계는 `package.json`과
`docs/contract-maps/quality-gates.md`에서 찾고, 문서가 별도의 gate 의미를 만들지
않게 한다.

### 5. Canonical closeout을 닫는다

코드, 테스트, 정본 문서와 실행 evidence가 같은 결론을 말하는지 확인한다. PR
merge 전에는 exact content head의 review record가 필요하다. 형식과 상태는
`docs/agent-skills.md`의 Review Closeout Status와 `review-checklist-steward`가
소유한다.

## 경로별 시작점

이 표는 owner를 찾는 navigation이다. 모든 행에 적용되는 별도 policy registry가
아니며, 최종 판정은 연결된 정본이 소유한다.

| 수정 위치 또는 변경 | 먼저 읽을 정본 | 함께 확인할 owner |
| --- | --- | --- |
| Research UI와 renderer | `docs/principles.md`, `docs/conventions.md`, `docs/intent-traceability.md` | UI 의미가 바뀌면 Mission Control, 값·디자인 기준은 `docs/design-standards.md` |
| Route Handler와 HTTP contract | `docs/conventions.md`, `docs/contract-maps/quality-gates.md` | auth, ingress, response, deadline owner와 관련 guard |
| Server service와 domain-access | `docs/principles.md`, `docs/conventions.md` | 실행 순서가 바뀌면 `docs/runtime-flows/` |
| Repository, schema, migration | `docs/conventions.md` §4, `docs/infrastructure.md` | runtime-flow, Operational Readiness, security owner |
| Domain type와 shared module | `docs/conventions.md` §2~§5 | 모든 producer와 consumer, Story Chain contract 영향 |
| AI response와 structured generation | `docs/product-identity.md`, `docs/runtime-flows/ai-response-generation.md` | 변경 전 Human 승인과 Mission Control |
| Analytics event와 sink | `docs/analytics/events.yaml`, analytics contract map | `analytics-event-steward` |
| Quality gate와 CI | `docs/ci-structure.md`, `docs/contract-maps/quality-gates.md` | `quality-gate-steward` |
| Agent process, skill, Project Knowledge | `docs/agent-skills.md`, `docs/project-knowledge/README.md` | 별도 process session의 `skill-governance-steward` |

현재 제품의 구체 진입점은 위 zone 표와 `docs/product-identity.md`의 정본 구현
진입점에서 찾는다. Persistent State와 Client State의 현재 목록은
`docs/infrastructure.md`가 소유한다. 상세 처리 순서를 이 문서에 추가하지 않고
해당 `docs/runtime-flows/` 문서로 연결한다.
