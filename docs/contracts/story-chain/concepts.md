# Story Chain Concepts

Story Chain은 제품이 지키려는 약속을 세 축으로 읽는다. 첫째는 사람의
의도를 점점 구체화하는 축이고, 둘째는 그 의도가 제품에서 실현되는 방식을
제약하는 축이며, 셋째는 그 결과를 검증 근거로 닫는 축이다.

```text
의도 선언 축

Experience
  -> Moment
    -> Promise

실현 제약 축

Aspect
  -> Moment를 실현하는 Promise에 적용

검증 축

Promise -> Evidence Ledger -> Code / Tests / Surface tags
           ^
           |
         Aspect
```

Moment와 Aspect가 Promise를 자동 생성하지는 않는다. Moment는 Promise가
발동되는 상황을 정하고, Aspect는 그 Moment가 제품에서 실현되는 방식에
공통 제약을 건다. 구조적으로는 Aspect가 해당 Moment 아래의 Promise들에
엮인다. Promise는 그 맥락 안에서 명시적으로 선언되는 종단 약속이다.
Evidence Ledger는 Aspect 제약 아래 선언된 Promise를 실행 가능한 evidence로
닫는다. 이때 Promise의 Acceptance Check는 Evidence Ledger의
`acceptanceChecks` 표 row로 내려가며, Story Chain validator는 각
Experience, Moment, Promise, Acceptance Check, Evidence row 사이의 최소
연결 수를 `traceability-cardinality.json`으로 검증한다.

## Responsibility Boundary

Story Chain은 의미 승인과 전파·구현 책임을 분리한다.

| 단계 | 주 책임 | 설명 |
| --- | --- | --- |
| Experience | Human | 제품이 오래 유지할 경험 영역을 정한다. |
| Moment | Human | 그 경험 안에서 약속이 발동되는 workflow 순간을 정한다. |
| Promise 존재와 의미 | Human | 제품이 실제로 지킬 종단 약속인지 승인한다. Agent가 초안을 쓸 수는 있지만 승인 없이 정본 의미가 되지는 않는다. |
| Aspect 신설과 의미 | Human | Moment를 실현하는 방식을 바꿀 수 있는 횡단 제약이므로 의미 승인이 필요하다. |
| 기존 Aspect 적용 전파 | Agent | 승인된 Aspect를 관련 Promise, Evidence Ledger, evidence로 일관되게 엮는다. |
| Evidence Ledger 작성과 갱신 | Agent | 승인된 Promise를 Aspect 제약과 함께 실행 가능한 검증 원장으로 내린다. |
| Code / Tests / Surface tags | Agent | Evidence Ledger가 요구하는 evidence를 구현하고 trace tag를 닫는다. |
| deterministic check / live judge 실행 | Evaluator | Acceptance Check와 Intent Check evidence를 실행해 verdict 근거를 만든다. |
| CI / release gate | System | `unknown`이나 `not-met` 상태를 release blocking으로 강제한다. |

짧게 말하면 사람은 “무엇을 약속할지”를 정하고, 에이전트는 “그 약속을
무엇으로 증명하고 어떻게 구현할지”를 닫는다. 에이전트가 Promise나 Aspect
문장을 제안할 수는 있지만, 존재와 의미를 확정하는 권한은 Human 쪽에 있다.

Story Chain의 구성은 사용자 경험 문장만 모으는 작업이 아니다. 새 core-product
Experience나 서비스 단위 Promise bundle을 정하기 전에 Service Policy Coverage
Matrix로 서비스의 최소 정책을 조사하고 owner를 배정한다. Matrix는 참조 당시
관찰, exact-revision 현재 관찰, 두 관찰의 reconciliation, `owned` / `rejected` /
`unresolved` disposition을 별도 field로 보존한다. 사용자에게 보이는 의미만 Story
Chain으로 들어오며, 실행 순서·권한·데이터 수명·SLO·rollout 같은 정책은 각
runtime, security/data/infrastructure, Operational Readiness 정본이 소유한다.
의도적 미지원은 Human 근거와 재검토 조건을 남기고, 미결 정책은 bundle 확정을
막는다. 이 검토는 새 Story Chain node나 별도 backlog가 아니며
`docs/mission-control.md`의 절차를 따른다.

`core-product` Experience는 검토의 aggregate를 `servicePolicyCoverage`로, durable
local Matrix pointer를 `servicePolicyCoverageReview`로 선언한다. `unresolved`는
계약 파일을 없애거나 거짓 `met`으로 만들지 않고 `mc:status`의 release verdict를
차단한다.

## Experience

Experience는 제품이 오래 유지하려는 경험 영역이다. 사용자가 어떤 큰
맥락에서 Light House를 쓰는지, 운영자가 어떤 운영 경험을 유지해야 하는지를
나눈다. 하나의 Experience는 여러 Moment를 품을 수 있다.

Experience는 새 최상위 노드 타입을 만들지 않고 `scope`로만 분류한다. 이
분류는 그래프 구조를 늘리지 않으면서, 실제 연구자 workflow와 운영·검증
surface가 같은 레벨처럼 읽히는 문제를 막기 위한 읽기 보조축이다.

| scope | 의미 |
| --- | --- |
| `core-product` | 연구자가 Light House에서 직접 수행하는 핵심 제품 경험 |
| `support-layer` | 핵심 제품 경험 위에 얹히는 보조 presence 또는 feedback layer |
| `governance` | 제품 약속, 검증, release 상태를 설명하거나 운영하는 내부/외부 governance surface |

검토 기준:

- 구현 방식이나 화면 이름이 아니라 지속되는 제품 경험을 말한다.
- 한 번의 행동보다 넓고, 여러 workflow moment를 포함할 수 있다.
- Experience가 바뀌면 그 아래 Moment와 Promise의 해석도 바뀐다.
- `scope`는 Experience를 대체하지 않는다. 새 hierarchy를 만들지 않고
  사람이 core product와 governance/support 항목을 구분해 읽게 하는
  classification이다.

본문 작성 기준:

Experience 문서는 scope tag나 라우팅 라벨이 아니라, 제품이 그 영역에서
사용자나 운영자에게 주려는 경험 자체를 적는다. 다음 셋은 필수다.

- **Subject & situation** — 누가, 어떤 맥락에서 이 경험에 들어오는가.
  사용자가 그 시점에 무엇을 하다가 Light House를 켜는지 짧게 잡는다. 사용자가
  함께 다루는 외부 연구 환경도 필요한 만큼 포함한다. 예를 들어 검색 결과,
  PDF, 인용 네트워크, 메모 도구, 동료 논의처럼 Experience의 의미를 만드는
  배경을 적는다. 별도 Subject / World 섹션을 만들 필요는 없다.
- **What happens** — 그 경험에서 제품이 어떻게 작동하는지를 직접 묘사
  한다. 사용자가 어떤 흐름을 따라가고 어떤 도움을 받는지 평이한 한국어로
  풀어 쓴다. 정상 흐름에서 이 묘사가 하위 Moment·Promise로 전파되는
  정본이다. 사용자가 무엇을 더 잘하고 싶어 하는지, 제품이 그 기대 중 어디를
  돕는지도 드러나야 한다.
- **Boundary** — 같은 단어로 헷갈릴 수 있는 인접 Experience와 어떻게
  다른가. 어떤 종류의 Moment·Promise가 여기에 속하지 **않는지**도 적는다.
  Promise를 새로 만들 때 어디에 붙일지 판정하는 기준이 된다.

선택 항목은 다음과 같다. 자명하면 생략한다.

- **Scope 분류 이유** — `core-product` / `support-layer` / `governance` 중
  왜 이걸로 분류했는지.
- **현재 품은 Moment의 흐름** — 지금 이 Experience 아래 Moment들이 합쳐서
  어떤 호를 그리는지 한두 줄.

문체:

- **단문 중심**으로 쓴다. 한 문장에 한 동작 또는 한 사실.
- 한국어 어법을 따른다. "이 경험에서 사용자에게 남아야 할 것은 ...
  감각이다" / "... 라는 결이다"처럼 felt outcome을 명사구로 굳혀 끝맺는
  영어 번역체는 쓰지 않는다.
- 비유는 정본 Promise 문장에 이미 쓰인 표현(예: "지형")만 살린다.
  그 비유 위에 다시 metaphor를 쌓지 않는다.
- 화면 이름, 컴포넌트, API, 기술 단어를 본문에 끌어오지 않는다. URL이
  사용자에게 직접 노출되는 commitment surface처럼 그 자체가 약속의
  일부일 때만 예외로 둔다.
- 길이는 한 화면(약 20~40줄). 길어지면 한 경험이 아니라는 신호다.

예: `experience:research-and-discovery`는 검색과 탐색이라는 큰 경험이고,
`experience:operator-alignment-audit`는 운영자가 alignment chain을 점검하는
경험이다.

## Moment

Moment는 Experience 안에서 약속이 실제로 발동되는 workflow 순간이다.
사용자나 운영자가 어떤 일을 하다가 제품의 반응을 기대하는 지점을 잡는다.
하나의 Moment는 여러 Promise를 품을 수 있다.

검토 기준:

- Experience보다 좁고, Promise보다 넓다.
- 사용자의 관찰 가능한 흐름이나 운영자의 점검 장면으로 설명된다.
- Promise를 자동 생성하지 않고, Promise가 어떤 상황에서 발동되는지
  결정한다.
- 하나의 기술 작업, 컴포넌트, 테스트 케이스만을 뜻하지 않는다.
- 여러 Promise가 같은 상황에서 발동되면 같은 Moment 아래에 둘 수 있다.

예: `moment:search-results-first-review`는 검색 결과 view를 처음 보고
대표 결과, 검색 반응, 인라인 분석을 읽는 순간이고,
`moment:alignment-relation-observability`는 운영자가 Story Chain 정합성과
release 상태를 점검하는 순간이다.

## Promise

Promise는 제품이 사용자/운영자에게 내는 종단 기대 선언이다. 특정 Moment
에서 발동되며, 사람이 승인한 기대를 하나의 검증 가능한 계약으로 만든다.
Acceptance Check와 코드 surface tag가 그 기대를 동작·상태 불변식으로,
Intent Check가 narrative 창발 점검으로 분해해 증명하는 하위 장치다.
Promise를 "동작 계약"으로 부르면 이 계층이 뒤집힌다 — 동작은 약속의
검증 형식이지 약속 자체의 단위가 아니다. Promise는 하나의 Moment를 직접
참조하고, Experience는 그 Moment의 parent ref에서 유도한다. 적용된 Aspect와
함께 Evidence Ledger에서 닫힌다.

검토 기준:

- 사용자가 기대하는 결과나 운영자가 기대하는 상태를 직접 말한다.
- 하나의 약속은 검증 가능한 Acceptance Check 목록을 가진다.
- Moment가 정한 상황과 Aspect가 건 제약을 모두 읽어도 약속의 핵심 의미가
  유지되어야 한다.
- 특정 화면이나 API가 아니라 그 표면이 지켜야 하는 사용자 기대를 적는다.
- 여러 흐름을 가로지르는 규칙이면 Promise가 아니라 Aspect 후보로 본다.

Augment note:

Promise를 작성하거나 검토할 때 이 Promise가 상위 Experience의 어떤 사용자
기대에 기여하는지 한 줄로 따로 적을 수 있다. 논문 지형을 이해하려는 기대,
gap을 찾으려는 기대, 연구 질문을 좁히려는 기대, 외부 문헌·도구·사람과
연결하려는 기대 같은 점을 본다. 이 한 줄은 non-blocking augment note다.
Promise의 의미, Acceptance Check, Intent Check, verdict 조건을 구성하지
않는다. `mc:validate-story-chain`, `evidence-ledger`, 4차원 release verdict
운영에도 영향을 주지 않는다. Augment note는 `docs/augment-layer.md`의
Experience context와 따로 맞춰 본다.

## Aspect

Aspect는 여러 Promise에 동시에 적용되는 횡단 규약이다. 보안, 반응 속도,
설명 충분성, runtime 제약처럼 한 Promise에만 묶으면 중복되거나 약해지는
규칙을 Aspect로 둔다. 제품 관점에서 Aspect는 Moment를 실현하는 방식에
걸리는 제약이다. 그래서 Aspect가 달라지면 같은 Moment와 Promise라도 화면,
문구, runtime 경로, 테스트 기준 같은 제품의 실제 모습이 달라질 수 있다.

검토 기준:

- 둘 이상의 Promise에 적용될 수 있는 pointcut이 있다.
- 어떤 표면에 적용되는지와 어떤 행동만 허용하는지 advice가 분명하다.
- Promise의 핵심 의미를 바꾸지 않고, 그 Promise가 지켜져야 하는 조건과
  검증 기준을 더 엄격하게 만든다.
- 단일 Promise의 Acceptance Check로 닫을 수 있으면 Aspect로 올리지 않는다.
- Promise만큼 엄격해야 하며, covering Evidence Ledger와 verification 근거를
가져야 한다.

축 분리 규칙:

Promise의 Acceptance Check와 Intent Check 본문은 Aspect의 수치·임계치
(예: "≤400자", "≤30자", "마크다운 불가")를 인용하지 않는다. Aspect 제약은
Aspect의 coveringLedger에서 한 번 닫는다. Promise AC/IC 본문은 그 Promise
고유의 shape만 적고, 필요한 경우 Evidence Ledger의 `assertion`에서 annotation
pointer로 Aspect를 가리킨다. AC 본문에 Aspect 수치가 박혀 있으면 같은 cap을
여러 곳에 복사해 drift 위험을 만들고, 두 축의 책임이 섞인다.

## Evidence Ledger

Evidence Ledger는 Aspect 제약 아래 선언된 Promise를 실행 가능한 검증
근거로 엮는 원장이다.
Source Promise, Applied Aspect, Acceptance Check, structured execution evidence를 한
곳에 모아 Story Chain과 코드 사이의 audit trail을 만든다. Acceptance
Checks는 자유 bullet list나 Markdown 표가 아니라 `acceptanceChecks[]` 배열이다.
각 entry는 하나의 `Promise#AcceptanceCheck`가 어떤 `assertion`,
`executionRefs`, `scenarios`로 닫히는지 나타낸다. 실행 정의는
`executions[]`에 한 번만 두며 raw command를 저장하지 않는다.

Evidence Ledger는 흔히 말하는 "앞으로 만들 기능을 설명하는 스펙 문서"가
아니다. Light House에서 Evidence Ledger는 Promise가 현재 어떤 evidence로
증명되는지를 적는 검증 원장이다. 개발자는 Promise만 보고 바로 코드를
작성할 수도 있지만, release 판단에는 "그 약속이 무엇으로 닫혔는가"가
남아야 한다. Evidence Ledger는 그 질문에 답한다.

```text
Promise
  = 무엇을 지킬 것인가

Evidence Ledger
  = 그 약속이 지금 무엇으로 증명되는가
```

`evidence-ledgers/*.ledger.yaml` 파일은 설계 의도를 길게 풀어 쓰는 곳이
아니라, Source Promise, Applied Aspect, Intent Check, Acceptance Check,
Evidence, Verdict가 서로 빠지지 않았는지 확인하는 장부다.

Promise에서 코드로 바로 가면 아래 정보가 흩어진다.

- 이 Promise의 Acceptance Check가 어느 테스트나 script로 닫히는가?
- Intent Check가 live judge evidence인지 deterministic evidence인지?
- 어떤 Aspect 제약이 함께 적용되는가?
- `met`, `unknown`, `not-met` verdict의 근거가 무엇인가?
- 코드 surface의 `// @promise`, `// @aspect`, `// @check` tag가 어떤 계약과
  연결되는가?

Evidence Ledger는 이 정보를 한 곳에 모아 "돌아간다"와 "약속이 증명됐다"를
분리한다.

Evidence Ledger runner는 HTML/JSON report를 생성해 사람이 읽게 하는 도구가
아니다. 사람은 Story Chain 정본과 `mc:status`에서 상태를 읽고, agent와 CI는
Evidence Ledger 파일, structured execution evidence, `mc:*` exit code를 읽는다. 그래서 현재 검증 경로는
report freshness가 아니라 정본 원장과 실행 증거의 직접 검증에 의존한다.

사용자-facing 언어도 Evidence Ledger가 닫는 검증 표면이다. 고정 문구는
개별 컴포넌트에 흩어진 문자열이 아니라 `app/i18n/messages*` registry에
모인다. 이 registry 자체가 fixed-copy 계약 표면이며, 각 key namespace는
관련 Promise와 Aspect owner group에 분류되어야 한다. Evidence Ledger는
registry 검사 script로 "모든 고정 문구가 어떤 계약 아래 있는가"를 먼저
닫고, 필요한 surface에서는 rendered DOM test로 해당 key가 실제 화면에
닿는지 확인한다.

Fixed-copy registry 검증은 owner 분류만으로 끝나지 않는다. Aspect가 말투나
신뢰 설명 방식을 요구하면 registry checker가 semantic tone policy를 함께
실행한다. 예를 들어 직접 방문자에게 말하는 onboarding/auth 문구는 반말형
종결을 거부한다. 공개 문서와 내부 audit은 문서형 다체를 쓸 수 있지만, 같은
surface 안에서 말투가 섞이면 별도 tone consistency evidence로 닫아야 한다.

생성 문구는 fixed-copy registry에 넣지 않는다. 생성 문구는 현재 runtime
generated output schema, deterministic fixture, live judge evidence로 닫는다.
즉 사용자-facing 언어 계약은 fixed-copy registry track과 generated-copy
runtime track을 분리해 검증한다.

검토 기준:

- 어떤 Promise와 Aspect를 닫는지 명시한다.
- 각 Acceptance Check가 어떤 테스트나 deterministic evidence로 닫히는지
연결한다.
- Acceptance Check가 여러 실행 불변식으로 성립하면 그 불변식을 나누어
  evidence가 닫는다. 특히 화면 배치가 payload key, 저장 snapshot, runtime
  branch처럼 upstream 입력에 의존하면 fixture가 이미 만족한 최종 상태만
  검증하지 않고 그 입력이 실제 경로에서 보존되는지도 함께 닫는다.
- `acceptanceChecks` 표로 Promise, Check, Evidence, Scope, Run,
  Scenario를 한 row에 둔다.
- UI intent가 있으면 Intent Verification과 Sufficiency Review를 포함한다.
  긴 dated review log는 `evidence-ledgers/reviews/<ledger-slug>.reviews.md`로
  분리할 수 있지만, ledger에는 해당 review 파일을 가리키는
  `### Sufficiency Review` 포인터를 남긴다.
- `unknown`이나 `not-met`은 중립 상태가 아니라 release blocking 상태다.

## Traceability Cardinality

Traceability cardinality는 “문서가 존재한다”보다 강한 검증이다. 각 노드가
최소 몇 개의 다음 노드와 연결되어야 하는지를 정책 파일로 선언하고,
`mc:validate-story-chain`이 실제 Story Chain을 세어 검증한다.
노드 ID prefix도 `traceability-cardinality.json`의 `nodeTypes`가 소유한다.

현재 정책은 다음을 요구한다.

- Experience -> Moment: Experience 하나는 Moment 하나 이상을 가진다.
- Moment -> Promise: Moment 하나는 Promise 하나 이상을 가진다.
- Promise -> Acceptance Check: Promise 하나는 deterministic Acceptance
  Check 하나 이상을 가진다.
- Promise -> Evidence Ledger: Promise 하나는 Evidence Ledger 하나 이상에
  Source Promise로 인용된다.
- Acceptance Check -> Evidence row: Promise의 각 Acceptance Check는
  Evidence Ledger check table row 하나 이상에 인용된다.
- Scenario -> Evidence row: 활성 scenario 하나는 Evidence Ledger check table
  row 하나 이상에 인용되며, ledger는 catalog 밖의 scenario를 인용할 수 없다.

이 검증은 traceability cardinality 아이디어를 Light House 문맥에 맞게 직접
적용한 것이다. Adapter protocol과 Alloy-style model checking은 아직 필요하지
않으므로 `deferred-verification-triggers.md`에 도입 조건만 보관한다.

## Review Order

내용 중심 검토는 다음 순서가 좋다.

1. Experience: 큰 제품 경험의 경계가 맞는지 본다.
2. Moment: 각 경험 안의 workflow 순간이 적절히 나뉘었는지 본다.
3. Aspect: 여러 Promise를 가로지르는 규칙이 충분히 엄격한지 본다.
4. Promise: 각 순간의 종단 약속과 Acceptance Check가 맞는지 본다.
5. Evidence Ledger: 선언된 약속과 횡단 규약이 실행 근거로 닫혔는지 본다.

이 순서를 따르면 Promise를 고치기 전에 상위 분류가 맞는지 확인할 수 있고,
Aspect를 Promise의 부속 문장으로 낮추거나 단일 Promise를 Aspect로 과하게
올리는 실수를 줄일 수 있다.

## Weaving Model

Promise와 Aspect의 관계는 부모-자식 관계보다 weaving 관계에 가깝다.

| 질문 | 답 |
| --- | --- |
| Promise는 어디서 발동되는가? | Experience 안의 특정 Moment에서 발동된다. |
| Aspect는 무엇을 하는가? | Moment를 실현하는 여러 Promise에 공통 제약을 적용한다. |
| Aspect가 Promise를 바꾸는가? | 핵심 의미를 바꾸지는 않고, 조건과 검증 기준을 더 엄격하게 만든다. |
| Aspect가 제품 모습을 바꾸는가? | 그렇다. 같은 Promise라도 Aspect가 달라지면 UI, 문구, runtime 경로, 테스트 기준이 달라질 수 있다. |
| Evidence Ledger는 무엇을 닫는가? | Aspect 제약 아래 선언된 Promise를 evidence로 닫는다. |

예를 들어 “검색 반응은 결과 지형을 요약한다”는 Promise에
`aspect:visible-explanation-sufficiency`가 적용되면, Promise의 핵심 의미는
그대로 유지된다. 대신 그 요약은 화면 안에서 바로 이해되어야 하고, 모호한
말보다 구체 근거를 써야 하며, 텍스트가 잘려 의미가 사라지면 안 된다. 이
강화된 계약 묶음이 Evidence Ledger에서 테스트와 live judge evidence로
닫힌다.
