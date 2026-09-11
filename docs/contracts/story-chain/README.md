# Story Chain

이 디렉토리는 Light House 계약의 정본이다.

Augment Layer는 Experience prose가 사용자 기대와 외부 연구 배경을 품도록 하는
읽기 규칙으로 [`docs/augment-layer.md`](../../augment-layer.md)에 정의되어
있으며, Story Chain validator는 이를 다루지 않는다.

- `experiences/`
- `moments/`
- `promises/`
- `aspects/`
- `evidence-ledgers/`
- `traceability-cardinality.json`
- `deferred-verification-triggers.md`

`evidence-ledger`, `alignment-audit`, Mission Control, surface audit는 Story Chain과
Evidence Ledger 파일을 직접 읽는다. Story Chain reset 이후 별도 backlog,
judgment-anchor, reality-feedback markdown 상태는 두지 않는다.

Experience, Moment, Promise, Aspect, Evidence Ledger의 검토 용어와 경계는
[`concepts.md`](concepts.md)를 따른다.

## 개념 정본

Story Chain의 개념 모델, 책임 경계, Evidence Ledger 의미, 검토 순서, 예시는
[`concepts.md`](concepts.md)가 유일한 정본이다. 이 README는 디렉토리
navigation과 파일 형식만 다룬다. 개념 문장을 바꿀 때는 README나 Evidence
Ledger에 중복 설명을 추가하지 말고 `concepts.md`를 먼저 갱신한다.

현재 Evidence Ledger 정본 경로와 도구명은 `evidence-ledgers/*.ledger.yaml`,
`npm run evidence-ledger`다.

## 참조 도메인

| 참조 | 파일 |
| --- | --- |
| `experience:<slug>` | `experiences/<slug>.md` |
| `moment:<slug>` | `moments/<slug>.md` |
| `promise:<slug>` | `promises/<slug>.md` |
| `aspect:<slug>` | `aspects/<slug>.md` |
| `intent-check:<slug>` | Promise의 `## Intent Checks` 블록 |
| `acceptance-check:<slug>` | Promise의 `## Acceptance Checks` 블록 |
| `promise:<slug>#acceptance-check:<slug>` | 완전한 Acceptance Check key |

Experience frontmatter에는 `scope:`가 필요하다. 허용값은 다음 세 가지다.
새 최상위 노드 타입을 추가하지 않고, 같은 Experience 그래프 안에서 핵심
제품 경험과 보조·governance surface를 구분하기 위한 메타데이터다.

```yaml
scope: core-product # 또는 support-layer, governance
```

Promise frontmatter는 parent ref로 `moment:`만 선언한다. Promise가 속한
Experience는 Moment의 `experience:`에서 유도한다. Promise에 `experience:`를
중복 선언하면 parser가 거부한다. Story Chain validator는 Promise의 Moment와
그 Moment에서 유도한 Experience가 모두 선언됐는지 검증한다.

과거 dated audit entry에는 `historical` ref가 기록으로 남을 수 있다. 새
작업과 현재 안내 문서는 현재 Promise / Intent Check / Acceptance Check /
Aspect / Evidence Ledger 용어와 canonical ref를 써야 한다.

## Evidence Ledgers

실행 가능한 Evidence Ledger의 정본은 `evidence-ledgers/*.ledger.yaml`이다.
사람이 읽는 운영 설명은 `evidence-ledgers/foundational/*.md`, 날짜별 Sufficiency
Review는 `evidence-ledgers/reviews/*.reviews.md`가 소유한다. 두 Markdown 경로는
실행 원장으로 로드하지 않는다.

```yaml
schemaVersion: 2
slug: example
review: reviews/example.reviews.md
sourcePromises:
  - promise:example
appliedAspects: []
intent:
  mode: absorbed
  checks: []
  delegations: []
acceptanceChecks:
  - key: promise:example#acceptance-check:example-visible
    assertion: 사용자가 결과를 볼 수 있다.
    executionRefs:
      - execution:example-visible
    scenarios:
      - scenario:example
executions:
  - id: execution:example-visible
    kind: vitest
    files:
      - app/components/__tests__/example.test.tsx
    testNamePattern: renders the example result
implementationContracts:
  - 결과 표현은 ExampleResult가 소유한다.
verdict: met
```

`acceptanceChecks[].key`는 Promise와 Acceptance Check를 합친 완전한 key다.
`executionRefs`는 같은 파일의 `executions[].id`만 가리킬 수 있다. 참조되지 않은
execution, 존재하지 않는 ref, 중복 key와 id는 모두 거부한다. Acceptance Check의
`assertion`은 무엇이 잠기는지 설명하고, 실행 방법은 별도 execution 객체가 소유한다.
dated Sufficiency Review가 있는 원장의 optional `review`는
`reviews/<slug>.reviews.md`와 정확히 일치하고 실제 파일이 존재해야 한다.

Intent 소유 방식은 세 가지다.

- `explicit`: 정본 Promise의 모든 Intent Check를 `intent.checks`가 직접 증명한다.
- `absorbed`: source Promise에 Intent Check가 없고, 각 Promise의 Acceptance Check를
  이 원장이 직접 실행 증명한다.
- `delegated`: 정본 Promise의 모든 Intent Check를 다른 `explicit` 원장에 key와
  ledger slug로 위임한다.

원장은 YAML 1.2 단일 document이며 `schemaVersion: 2`만 허용한다. strict schema에
없는 field, duplicate key, anchor, alias, merge key, explicit/custom tag는 거부한다.
정규 직렬화 결과와 byte 단위로 다르면 로드에 실패한다. 원장 root의
`*.ledger.md`는 YAML과 함께 있든 단독으로 있든 회귀로 간주해 거부한다. 과거
dated review와 review usage 기록 속 Markdown 경로는 당시 사실이므로 바꾸지 않는다.

실행 kind는 다음 네 가지로 제한한다.

- `vitest`: `files`와 선택적인 `testNamePattern`
- `contract-check`: 등록된 `target`과 `subcase`
- `guard`: 등록된 `guard:*` package script
- `registered-script`: runner가 명시적으로 등록한 script

raw shell 문자열은 저장하지 않는다. runner는 구조화 객체를 binary와 argv로
변환하고 `shell: false`로 실행한다. `--ledger <slug|file>` 선택 실행과 전체
실행은 동일한 Story Chain loader·validator·zero-test 검증 그래프를 사용한다.

## Scenario Catalog

`scenario-catalog.md`는 Evidence Ledger의 `scenarios` 열과 alignment audit이
참조하는 활성 사용자-facing coverage 정본이다. 모든 catalog 항목은 Evidence
Ledger `acceptanceChecks` entry 하나 이상에 연결되어야 한다. 아직 조사·결정되지
않은 정책, 제안, 과거 예시는 catalog에 넣지 않는다. 새 시나리오 id는
`scenario:<semantic-kebab-case>` 형식을 쓴다.

좋은 id는 사용자의 상황, runtime 전환, 또는 surface 상태를 이름으로 설명한다.
예: `scenario:search-provider-failure-degraded`,
`scenario:search-gap-report-prepared-reaction`.

기존 `scenario:presence-01-01-03` 같은 숫자 좌표형 id는 historical ref로 남길
수 있다. 새 row를 작성할 때는 순번보다 의미가 먼저 읽히는 slug를 고른다.

## Traceability Cardinality

`traceability-cardinality.json`은 chain의 최소 연결 수를 선언한다. 현재
validator가 강제하는 관계는 다음과 같다.

- Experience 하나는 Moment 하나 이상을 가진다. Moment 하나는 Experience
  하나에 속한다.
- Moment 하나는 Promise 하나 이상을 가진다. Promise 하나는 Moment 하나에
  속한다.
- Promise 하나는 Acceptance Check 하나 이상을 가진다.
- Promise 하나는 Evidence Ledger 하나 이상에 인용된다.
- Promise의 각 Acceptance Check는 Evidence Ledger `acceptanceChecks` entry 하나
  이상에 인용된다.
- 활성 scenario 하나는 Evidence Ledger `acceptanceChecks` entry 하나 이상에
  인용된다. 존재하지 않는 scenario를 ledger가 참조해도 실패한다.

`core-product` Experience는 Story Chain bundle 구성 전에 수행한 Service Policy
Coverage Review의 aggregate 상태와 durable pointer를 frontmatter에 선언한다.
`unresolved`는 graph 파일을 삭제하거나 verdict를 위조하게 만들지 않으면서
`mc:status`의 release ready 판정을 차단한다. 절차와 상태 의미는
`docs/mission-control.md`가 소유한다.

Adapter protocol과 Alloy-style model checking은
[`deferred-verification-triggers.md`](deferred-verification-triggers.md)의
조건에 도달할 때만 도입한다.

## 검증 명령

- `npm run evidence-ledger:dry`는 strict YAML v2를 읽어 빈 원장, dangling 또는
  orphaned execution ref, 알 수 없는 file/target/subcase/script, zero-test selector를
  차단한다.
- `npm run evidence-ledger`는 같은 검증을 통과한 뒤 모든 구조화 execution을
  `shell: false`로 실행한다.
- `npm run evidence-ledger -- --ledger <ledger>`는 지정한 ledger의 구조화
  execution만 실제 실행한다. Promise/AC/Evidence Ledger나 user-facing 계약을
  바꾸면 `evidence-ledger:dry`만으로 닫지 않고, 영향 ledger를 이 필터로 실제
  실행한다.
- `npm run mc:validate-story-chain`은 graph 무결성, parent ref,
  Promise/Aspect 양방향 weaving, strict YAML v2, execution ref 무결성,
  traceability cardinality, Intent Check와 Acceptance Check 필드 분리,
  비어 있지 않은 chain category를 확인한다.
- `npm run mc:audit-surface`는 user-facing surface에 최소 하나의 trace tag가
  있는지 확인한다.
- `npm run mc:audit-story-surface`는 `// @promise`, `// @aspect`, `// @check`
  tag가 현재 Story Chain ref로 해석되는지 확인한다.

Evidence Ledger runner와 세 MC gate는 항상 green이어야 한다.

## 문장 검증

새 story-chain 문장을 쓰거나 고칠 때는 짧게 줄이는 것보다 먼저, 처음
읽는 사람이 한 번에 이해할 수 있는지 확인한다.

- 계약 문장은 먼저 현재 용어사전을 확인한다. Story Chain 개념어는
  [`concepts.md`](concepts.md)와 `docs/mission-control.md`의 canonical term을
  쓰고, 제품 surface 용어는 owning Promise, Evidence Ledger, runtime-flow에
  이미 쓰인 말을 우선 쓴다.
- 핵심 용어를 새말로 바꾸지 않는다. 같은 처리나 surface를 다른 말로 부르면
  중복 계약처럼 보이므로, 기존 용어가 있으면 본문 표현을 그 말에 맞춘다.
- 반복될 제품 surface 용어가 새로 필요하면 계약 문장에 먼저 흩어 쓰지 말고
  owning Promise / Evidence Ledger / runtime-flow 근거를 정한 뒤
  `concepts.md` 또는 적합한 정본에 등록한다. 새 제품 의미나 새 Aspect 의미가 필요한 용어는 Mission Control의
  Human authority가 먼저 승인해야 한다.
- 문장 하나에 역할을 여러 개 섞지 않는다. 대상, 동작, 결과가 한 번에
  들어오지 않으면 나눠 쓴다.
- 내부 약어와 계약 용어가 나오면, 바로 앞뒤 문장에서 뜻을 풀어쓴다.
- 소리 내어 읽었을 때 걸리는 문장은 아직 덜 자연스러운 문장이다.
- 새 prose를 넣은 뒤에는 `mc:validate-story-chain`과 해당 surface test를
  함께 돌려 문장과 렌더가 같이 맞는지 본다.

## Verdict Evidence 규칙

`verdict: unknown`은 blocking 상태다. Promise, Aspect, Evidence Ledger는 현재
evidence가 실행 가능하고 실제 runtime output, rendered DOM, deterministic
test, script, explicit guard를 가리킬 때만 `met`으로 이동한다.

Generated HTML/JSON report artifact는 현재 검증 체계의 일부가 아니다. 사람은 admin
surface에서 상태를 읽고, agent와 CI는 Evidence Ledger 파일과 runner exit
code를 직접 읽는다. `evidence-ledgers/report.json`, `evidence-ledgers/report/`
같은 생성 artifact는 정본이 아니며 commit하지 않는다.
