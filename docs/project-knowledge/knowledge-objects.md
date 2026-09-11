# Shared Project Knowledge

이 파일은 review를 거쳐 consolidation된 Light House 설명 지식의 현재 projection이다.
현재 행동과 제품 상태는 각 객체의 `authority_refs`가 가리키는 정본이 소유한다.
기존 narrative와 append-only frame은 `shared-memory.md`에 byte 그대로 남아 있다.

<!-- project-knowledge-object:v1 -->
```yaml
id: product.research-route-lifetime-model
lifecycle: shared-consolidated
plane: product
kind: model
title: 탐색 route와 gap artifact의 수명 분리
aliases:
  - Search-first route lifetime
  - 조건 route와 영속 artifact
statement: 검색·인용·비슷한 논문 route는 URL 조건으로 다시 실행하는 일시적 view이고, gap report만 공유 가능한 영속 artifact로 남는다.
scope:
  - research route의 일시성과 gap report의 영속성
  - URL 재진입과 artifact 재열기의 차이
non_scope:
  - 현재 route 구현 순서와 API shape
  - gap report의 현재 release verdict
forces:
  - 탐색은 빠르게 분기하고 다시 실행할 수 있어야 한다.
  - 생성 비용이 큰 gap 결과는 안정된 identity로 다시 열 수 있어야 한다.
rejected_alternatives:
  - alternative: 모든 탐색 결과를 document id로 영속한다.
    reason: 탐색 조건과 실행 결과의 수명을 합쳐 URL 소유권과 재실행 의미를 흐린다.
authority_refs:
  - docs/product-identity.md#제품-모델
  - docs/infrastructure.md
grounding:
  - type: commit
    ref: 962cf9e17569d803cb0e04ef570747f60d9efa45
    path: docs/archive/search-first-reset-closeout.md
    note: Search-first 전환의 결과와 퇴역한 document-first 구조를 보존한다.
relations:
  - type: produced_by
    target: product-making.search-first-concept-shift
  - type: evidenced_by
    target: product.search-first-runtime-observation
temporal_status: current
evolution:
  - date: 2026-07-05
    note: Search-first reset에서 탐색 view와 gap artifact의 수명을 분리했다.
refresh_conditions:
  - 탐색 route가 durable id를 갖거나 gap report가 일시적 결과로 바뀐다.
  - 여러 active research view를 동시에 유지하는 제품 요구가 승인된다.
answers:
  - 검색과 인용·비슷한 논문 결과는 왜 저장하지 않는가?
  - gap report만 오래 남는 이유는 무엇인가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.condition-owned-research-route
lifecycle: shared-consolidated
plane: product
kind: concept
title: 조건 URL이 소유하는 Research Route
aliases:
  - condition-owned route
  - URL-owned search
statement: Research Route의 탐색 identity는 저장된 실행 id가 아니라 query·seed·filter를 담은 조건 URL이다.
scope:
  - search, citation, similar route의 canonical identity
  - 공유·새로고침·Back에서의 조건 재실행
non_scope:
  - URL byte budget의 현재 수치
  - provider 호출과 background 보강 순서
forces:
  - 사용자는 탐색 조건을 직접 공유하고 복원할 수 있어야 한다.
  - client state가 navigation의 두 번째 owner가 되면 안 된다.
rejected_alternatives:
  - alternative: 먼저 persisted execution을 만들고 id route로 이동한다.
    reason: 첫 navigation을 persistence에 결합하고 조건의 브라우저 복원 의미를 약하게 만든다.
authority_refs:
  - docs/product-identity.md#research-route-동작
  - docs/contracts/story-chain/aspects/search-first-url-model.md
grounding:
  - type: commit
    ref: 962cf9e17569d803cb0e04ef570747f60d9efa45
    path: docs/archive/search-first-reset-closeout.md
    note: document-first id route에서 조건 URL로 전환한 배경을 설명한다.
relations:
  - type: produced_by
    target: product-making.search-first-concept-shift
temporal_status: current
evolution:
  - date: 2026-07-05
    note: 검색·인용·비슷한 논문 route의 identity를 조건 URL로 통합했다.
refresh_conditions:
  - URL만으로 복원할 수 없는 승인된 탐색 상태가 생긴다.
answers:
  - 검색 route는 왜 저장 id 대신 조건 URL을 쓰는가?
  - Back과 공유가 같은 조건을 다시 실행하는 이유는 무엇인가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.search-first-runtime-observation
lifecycle: shared-consolidated
plane: product
kind: case
title: Search-first 뒤에도 남았던 다중 view 수명 구조
aliases:
  - active route cardinality mismatch
  - research route runtime structure case
statement: Search-first 전환 뒤 화면은 active route 하나만 가졌지만 runtime과 store에는 여러 view를 전제로 한 map과
  stale-result guard가 남아 후속 비동기 책임의 복잡성을 키웠다.
scope:
  - 제품 단위 변경 뒤 남은 runtime state shape의 실제 사례
  - 일시적 route와 영속 artifact를 같은 payload가 표현한 비용
non_scope:
  - 현재 runtime 구조가 당시와 동일하다는 주장
  - 특정 store 구현의 보존 지시
forces:
  - 비동기 완료가 이전 view에 쓰이지 않도록 막아야 했다.
  - 제품의 active-view cardinality와 state cardinality가 달랐다.
rejected_alternatives:
  - alternative: 남은 map과 guard를 모두 우발적 중복으로 분류한다.
    reason: 당시에는 stale completion을 막는 실제 역할이 있었고 단순 삭제로 안전성을 증명할 수 없었다.
authority_refs:
  - docs/product-identity.md#research-route-동작
  - docs/runtime-flows/README.md
grounding:
  - type: commit
    ref: 962cf9e17569d803cb0e04ef570747f60d9efa45
    path: docs/archive/research-route-runtime-structure-2026-07.md
    note: observed state cardinality와 형성 과정을 기록한 역사 자료다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-07-12
    note: 당시 main의 observed projection과 Search-first 이후 누적 경로를 복원했다.
refresh_conditions:
  - 같은 cardinality mismatch가 현재 runtime에서 다시 관측된다.
answers:
  - Search-first 전환 뒤에도 왜 runtime guard가 복잡했는가?
  - 비슷한 route-state 구조를 과거에 시도했을 때 무엇이 남았는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.search-first-concept-shift
lifecycle: shared-consolidated
plane: product-making
kind: case
title: Search-first concept shift와 퇴역 구조 제거
aliases:
  - Search-first reset
  - document-first retirement
statement: Search-first 전환은 route 이름만 바꾼 작업이 아니라 제품의 중심 단위를 persisted document에서 조건 route로 바꾸고, 그
  의미와 맞지 않는 state·repository·API shape를 함께 제거한 사례다.
scope:
  - product concept shift를 구현 구조에 전파한 경험
  - preserve하지 않은 retired architecture shape
non_scope:
  - 모든 concept shift의 고정 절차
  - 현재 Concept Shift Architecture Review 명령
forces:
  - 제품 중심 단위가 바뀌면 이전 구조를 기본 보존할 이유가 사라진다.
  - reaction과 async completion의 안전성은 새 lifetime 안에서도 유지해야 했다.
rejected_alternatives:
  - alternative: document-first 저장 구조를 compatibility layer로 계속 유지한다.
    reason: 새 제품 모델과 이중 owner를 만들고 후속 구현이 퇴역 shape를 계속 지원하게 한다.
authority_refs:
  - docs/agent-skills.md#concept-shift-architecture-review
  - docs/principles.md
grounding:
  - type: commit
    ref: 962cf9e17569d803cb0e04ef570747f60d9efa45
    path: docs/archive/search-first-reset-closeout.md
    note: 전환 범위와 제거된 구조의 close-out을 보존한다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-07-05
    note: 제품 중심 단위와 구현 shape를 같은 change set에서 전환했다.
refresh_conditions:
  - 다른 concept shift에서 퇴역 구조의 preserve가 반복돼 새 비용을 만든다.
answers:
  - Search-first 제품 모델은 어떤 제작 경험을 거쳐 형성됐는가?
  - 제품 개념이 바뀔 때 이전 architecture shape를 왜 자동 보존하지 않는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.concept-shift-review
lifecycle: shared-consolidated
plane: product-making
kind: concept
title: Concept Shift Architecture Review
aliases:
  - Concept Shift review
  - retired shape 판정
statement: Concept Shift Architecture Review는 제품 중심 개념이 바뀔 때 기존 route·state·repository·runtime
  shape를 관성으로 보존하지 않고 preserve·migrate-read-only·remove 중 하나로 명시하는 제작 개념이다.
scope:
  - 제품 개념 전환과 퇴역 architecture shape의 관계
  - compatibility를 명시적으로 다시 판단하는 이유
non_scope:
  - 현재 trigger와 기록 형식의 복사
  - 개별 작업의 Human verdict
forces:
  - 기존 구현은 새 제품 개념에 대한 중립적 기본값이 아니다.
  - compatibility와 제거 비용은 작업마다 다르다.
rejected_alternatives:
  - alternative: 기존 shape는 별도 판단 없이 항상 preserve한다.
    reason: 퇴역한 제품 단위를 shadow owner로 남겨 새 의미의 전파를 방해한다.
authority_refs:
  - docs/agent-skills.md#concept-shift-architecture-review
  - docs/mission-control.md
grounding:
  - type: commit
    ref: 65c84ada8b68a2a8b387a1a2d2e1a08a343cceb5
    path: docs/agent-skills.md
    note: 현재 workflow authority를 가리키며 객체는 존재 이유만 설명한다.
relations:
  - type: evidenced_by
    target: product-making.search-first-concept-shift
  - type: serves
    target: product.research-route-lifetime-model
temporal_status: current
evolution:
  - date: 2026-08-13
    note: Search-first 사례에서 반복 가능한 제작 개념을 분리해 설명했다.
refresh_conditions:
  - Concept Shift review가 다른 owner로 이동하거나 실제 적용에서 retired shape escape가 반복된다.
answers:
  - Concept Shift Architecture Review는 왜 존재하는가?
  - 제품 개념 변경과 compatibility 판정을 왜 분리하지 않는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.source-basis
lifecycle: shared-consolidated
plane: product
kind: concept
title: 연구자가 판단할 수 있게 하는 source basis
aliases:
  - source basis
  - provider lineage and limits
statement: Source basis는 provider 이름만 표시하는 것이 아니라 현재 결과를 만든 corpus lineage, loaded window, 입력 범위와
  알려진 한계를 함께 드러내 연구자의 판단 권한을 지키는 제품 개념이다.
scope:
  - 검색·인용·gap surface의 source lineage와 limitation 의미
  - provider omission을 해석하는 제품 경계
non_scope:
  - 현재 provider adapter의 상세 API
  - 일반 학술 데이터베이스 평가 지식
forces:
  - 생성된 설명의 자신감은 근거의 충분성을 대신하지 못한다.
  - provider가 제공하지 않은 데이터와 실제 학술적 부재를 구분해야 한다.
rejected_alternatives:
  - alternative: provider 브랜드만 보여 주면 source 설명이 충분하다고 본다.
    reason: loaded 범위와 누락 원인을 알 수 없어 연구자가 결과의 한계를 판단할 수 없다.
authority_refs:
  - docs/product-identity.md
  - docs/contract-maps/source-basis.md
grounding:
  - type: commit
    ref: 036bc3d2c7aa6b93fcf11791cee7dc37e3f95807
    path: docs/contract-maps/source-basis.md
    note: 제품 정체성과 여러 Story Chain owner를 잇는 source-basis 읽기 경로다.
relations:
  - type: produced_by
    target: product-making.provider-contract-propagation
  - type: evidenced_by
    target: product.provider-omission-limitation
temporal_status: current
evolution:
  - date: 2026-07-07
    note: trust-basis 피드백을 provider·loaded window·limit의 제품 설명으로 정리했다.
refresh_conditions:
  - base corpus lineage나 user-facing provider policy가 바뀐다.
  - omission을 실제 부재로 오해한 사용자-facing escape가 발생한다.
answers:
  - Light House가 말하는 source basis는 무엇인가?
  - provider 이름만으로 신뢰 근거가 충분하지 않은 이유는 무엇인가?
legacy_refs:
  - title:Episteme literature API 계약은 Light House provider 전환의 기준이다
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.provider-omission-limitation
lifecycle: shared-consolidated
plane: product
kind: case
title: provider 누락을 학술적 부재로 바꾸지 않는 사례
aliases:
  - provider omission case
  - citation availability limitation
statement: citation·reference·adjacency·PDF 데이터가 없을 때 그 상태는 provider limitation일 수 있으므로 Light House는
  관계나 연구 공백이 실제로 없다는 주장으로 변환하지 않는다.
scope:
  - citation lineage와 gap evidence의 누락 해석
  - unavailable·truncated·actual zero의 구분
non_scope:
  - 특정 논문 관계의 존재 여부
  - provider 품질의 일반 평가
forces:
  - UI는 빈 배열을 쉽게 실제 zero로 표현할 수 있다.
  - 연구자는 제한된 입력에서 과도한 결론을 내리지 않아야 한다.
rejected_alternatives:
  - alternative: 응답에 항목이 없으면 관계 없음으로 표시한다.
    reason: 데이터 미제공을 학술적 사실로 오인하게 만든다.
authority_refs:
  - docs/contract-maps/provider-transition.md#citation-and-gap-semantics
  - docs/contracts/story-chain/promises/citation-lineage.md
grounding:
  - type: commit
    ref: 036bc3d2c7aa6b93fcf11791cee7dc37e3f95807
    path: docs/contract-maps/provider-transition.md
    note: provider omission과 product claim의 경계를 묶은 현재 읽기 지도다.
relations: []
temporal_status: current
evolution:
  - date: 2026-07-07
    note: citation과 gap surface에서 omission을 limitation으로 표현하는 공통 사례로 정리했다.
refresh_conditions:
  - provider가 completeness guarantee를 제공하거나 omission 의미가 바뀐다.
answers:
  - citation 결과가 비었을 때 왜 관계 없음이라고 말하지 않는가?
  - source limitation은 제품에서 어떻게 드러나는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.provider-contract-propagation
lifecycle: shared-consolidated
plane: product-making
kind: case
title: provider 전환을 제품 의미와 downstream 전파로 분리한 사례
aliases:
  - Episteme provider transition
  - provider contract propagation
statement: Episteme 전환에서는 내부 runtime provider와 사용자에게 설명할 base-corpus lineage를 분리하고, source
  metadata·citation availability·failure handling을 각 현재 owner로 전파했다.
scope:
  - provider 변경에서 product language와 runtime mechanism을 분리한 경험
  - 여러 downstream contract owner를 함께 갱신한 사례
non_scope:
  - Episteme의 현재 운영 상태
  - 모든 provider migration의 고정 체크리스트
forces:
  - 내부 API 이름은 사용자에게 독립 corpus처럼 보일 수 있다.
  - provider 변경은 검색뿐 아니라 citation과 gap의 증거 의미에도 영향을 준다.
rejected_alternatives:
  - alternative: runtime provider 이름을 모든 사용자-facing source copy에 그대로 노출한다.
    reason: internal index와 base corpus를 혼동시키고 신뢰 설명을 구현 명칭에 결합한다.
authority_refs:
  - docs/contract-maps/provider-transition.md
  - docs/runtime-flows/search-mechanism.md
grounding:
  - type: commit
    ref: 036bc3d2c7aa6b93fcf11791cee7dc37e3f95807
    path: docs/contract-maps/provider-transition.md
    note: provider와 source language의 current owner 관계를 기록한다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-07-07
    note: provider 전환의 제품 설명과 downstream propagation을 하나의 사례로 복원했다.
refresh_conditions:
  - 새 provider 전환에서 product language와 runtime owner가 다시 혼합된다.
answers:
  - Episteme 전환은 source basis에 어떻게 반영됐는가?
  - provider 계약을 왜 검색 adapter 변경으로만 닫지 않았는가?
legacy_refs:
  - title:Episteme literature API 계약은 Light House provider 전환의 기준이다
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.observational-evidence-boundary
lifecycle: shared-consolidated
plane: product
kind: concept
title: 관측으로 말할 수 있는 제품 현실의 경계
aliases:
  - observational evidence boundary
  - 관측 부재의 의미
statement: 운영 관측은 실제로 본 window·identity·sink·sampling 범위만 설명하며, 빈 로그나 배포 성공만으로 사용자 journey의 성공 또는
  legacy traffic의 소멸을 증명하지 않는다.
scope:
  - 관측 범위와 제품·시스템 현실 주장 사이의 경계
  - empty observation과 zero occurrence의 차이
non_scope:
  - 현재 rollout go/no-go verdict
  - 현재 SLO 수치와 대시보드 상태
forces:
  - sink 부재와 sampling은 실제 요청을 보이지 않게 만들 수 있다.
  - HTTP 성공과 usable research result는 다른 관찰값이다.
rejected_alternatives:
  - alternative: 로그가 비었으면 legacy 사용이 0이라고 본다.
    reason: coverage와 durability가 입증되지 않으면 관측 부재가 실제 부재를 뜻하지 않는다.
authority_refs:
  - docs/operational-readiness.md
  - docs/operational-readiness-records.md
grounding:
  - type: commit
    ref: fd535ac8629d749eb6c8261fbc985b310cadfeb1
    path: docs/project-knowledge/shared-memory.md
    note: 관측 부재와 rollout·retirement 판단을 분리한 legacy rationale다.
relations:
  - type: evidenced_by
    target: product.false-ready-observation
temporal_status: current
evolution:
  - date: 2026-08-11
    note: production evidence gap 사례를 제품·시스템 현실의 설명 경계로 consolidation했다.
refresh_conditions:
  - sampling 없는 durable sink와 full-window identity coverage가 생긴다.
  - 관측 부재를 성공이나 은퇴 증거로 사용한 escape가 다시 발생한다.
answers:
  - 로그가 비었는데도 legacy path를 은퇴할 수 없는 이유는 무엇인가?
  - 현재 관측이 제품 현실에 대해 무엇을 증명하지 못하는가?
legacy_refs:
  - review:25a27af4-e70f-4d8f-88cc-5b6819e4c51a
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.false-ready-observation
lifecycle: shared-consolidated
plane: product
kind: case
title: HTTP 2xx가 ready-with-papers를 증명하지 못한 사례
aliases:
  - false-ready load observation
  - rendered 20/20 superseded evidence
statement: 초기 load-smoke는 HTTP 2xx 응답을 rendered success로 세어 20/20을 기록했지만 paperCount를 수집하지 않아 사용 가능한
  검색 결과가 전원에게 보였다는 사실을 증명하지 못했다.
scope:
  - transport success와 product-ready outcome의 차이
  - 과거 PASS evidence를 supersede한 실제 사례
non_scope:
  - 현재 capacity verdict
  - provider failure의 단일 원인 귀속
forces:
  - HTTP 성공은 빈 결과나 auth shell도 포함할 수 있다.
  - rollout 판단에는 사용자 milestone에 맞는 관찰값이 필요하다.
rejected_alternatives:
  - alternative: 과거 2xx 20/20 기록을 ready-with-papers baseline으로 재사용한다.
    reason: 당시 harness가 paper 존재를 관측하지 않아 claim보다 evidence가 좁다.
authority_refs:
  - docs/operational-readiness-records.md
  - docs/operational-readiness.md#1-slo--숫자-2026-07-04-고정
grounding:
  - type: commit
    ref: 1e323c42d6cf95809ae4ba8247b211eb09ef573a
    path: docs/operational-readiness-records.md
    note: 2xx 기반 과거 evidence를 SUPERSEDED로 판정한 dated record를 포함한다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-07-15
    note: paperCount가 없는 rendered 지표를 ready-with-papers 근거에서 제외했다.
refresh_conditions:
  - 새로운 readiness metric이 사용자 outcome보다 좁은 transport 상태만 측정한다.
answers:
  - local green이나 HTTP 성공이 제품 성공을 증명하지 못한 사례가 있는가?
  - ready-with-papers 지표는 왜 생겼는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.evidence-governed-rollout
lifecycle: shared-consolidated
plane: product-making
kind: model
title: evidence로 rollout과 compatibility retirement를 닫는 제작 모델
aliases:
  - evidence-governed rollout
  - rollout and retirement sufficiency
statement: Rollout과 compatibility retirement는 날짜·배포 완료·빈 로그가 아니라 대상 cohort와 claim에 맞는 outcome,
  coverage, revision, sink 한계를 함께 확인한 evidence로 판정한다.
scope:
  - rollout·retirement 판단의 evidence sufficiency
  - exact revision과 관측 한계를 함께 읽는 제작 방식
non_scope:
  - 현재 go/no-go verdict와 수치
  - 특정 quality gate의 현재 명령
forces:
  - 설치 성공과 효과 성공은 서로 다른 evidence를 요구한다.
  - 관측 도구의 coverage가 claim보다 좁을 수 있다.
rejected_alternatives:
  - alternative: 배포가 READY이고 오류 로그가 없으면 rollout을 완료한다.
    reason: 사용자 outcome, cohort coverage, provider 실행 여부를 증명하지 못한다.
authority_refs:
  - docs/operational-readiness.md#4-코호트-확대-gono-go-체크리스트
  - docs/agent-skills.md#skill-lifecycle
grounding:
  - type: commit
    ref: fd535ac8629d749eb6c8261fbc985b310cadfeb1
    path: docs/project-knowledge/shared-memory.md
    note: empty observation을 retirement evidence로 사용하지 않게 된 형성 과정을 담는다.
relations:
  - type: serves
    target: product.observational-evidence-boundary
  - type: evidenced_by
    target: product.false-ready-observation
  - type: supersedes
    target: product-making.deployment-success-sufficiency
temporal_status: current
evolution:
  - date: 2026-08-11
    note: rollout·retirement 판단의 반복 사례를 outcome과 coverage 중심 모델로 정리했다.
refresh_conditions:
  - outcome evidence 없이 rollout 또는 retirement가 승인된다.
  - evidence 수집 비용이 판단 가치보다 반복해서 커진다.
answers:
  - rollout과 compatibility retirement를 왜 날짜로 닫지 않는가?
  - 이 제작 관행이 막은 false pass는 무엇인가?
legacy_refs:
  - review:25a27af4-e70f-4d8f-88cc-5b6819e4c51a
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.deployment-success-sufficiency
lifecycle: shared-consolidated
plane: product-making
kind: model
title: 배포 성공을 효과 성공의 충분조건으로 보던 모델
aliases:
  - deployment-green sufficiency
  - local-green rollout model
statement: 과거 일부 판단은 deployment READY, local green, HTTP 성공을 사용자 outcome과 rollout 준비의 충분한 대리값으로
  사용했지만 관측 범위가 claim보다 좁아 반복 가능한 판정 모델이 되지 못했다.
scope:
  - evidence-governed rollout이 대체한 역사적 판단 형태
  - 설치 성공과 효과 성공이 합쳐졌던 문제
non_scope:
  - 현재 rollout 정책
  - 모든 과거 deployment의 품질 평가
forces:
  - deployment와 HTTP 상태는 쉽게 자동 수집할 수 있었다.
  - 사용자 outcome과 production coverage는 더 비싸고 늦게 수집됐다.
rejected_alternatives:
  - alternative: 자동으로 얻기 쉬운 deployment 상태를 계속 최종 outcome proxy로 사용한다.
    reason: 실제 provider journey와 usable result를 실행하지 않은 상태도 green으로 보인다.
authority_refs:
  - docs/operational-readiness-records.md
  - docs/operational-readiness.md
grounding:
  - type: commit
    ref: 1e323c42d6cf95809ae4ba8247b211eb09ef573a
    path: docs/operational-readiness-records.md
    note: 과거 evidence의 claim mismatch와 superseded 판정을 보존한다.
relations:
  - type: challenged_by
    target: product.false-ready-observation
temporal_status: superseded
evolution:
  - date: 2026-07-15
    note: ready-with-papers를 관측하지 않은 과거 2xx evidence가 재사용 불가로 판정됐다.
refresh_conditions:
  - 없음. 후속 설명은 product-making.evidence-governed-rollout이 소유한다.
answers:
  - 어떤 이전 rollout 판단 모델이 폐기됐는가?
  - deployment success와 effect success가 왜 분리됐는가?
legacy_refs: []
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product.gap-report-recoverable-artifact
lifecycle: shared-consolidated
plane: product
kind: model
title: enrichment 실패에서 core를 보존하는 gap report
aliases:
  - gap report core and enrichment separation
  - core-preserving gap recovery
statement: Gap report는 다시 열 수 있는 core evidence와 보강 가능한 enrichment를 분리한다. enrichment가 실패해도 core
  evidence와 report identity를 유지하며, 사용자는 같은 report 안에서 복구를 요청할 수 있다.
scope:
  - gap report의 core evidence와 enrichment 수명 분리
  - 실패 뒤에도 유지되는 report identity와 사용자-visible recovery 의미
  - 한 사용자의 동시 build가 다른 report recovery와 충돌하는 제품 경계
non_scope:
  - 현재 cooldown, lease, RPC, route의 정확한 수치와 구현 순서
  - 현재 gap report release verdict
forces:
  - 비용이 큰 enrichment는 usable core가 준비된 뒤에도 독립적으로 실패할 수 있다.
  - 복구가 새 report를 만들거나 이미 확보한 연구 근거를 지우면 report 신뢰가 약해진다.
  - 반복 요청이 같은 사용자의 background build를 제한 없이 늘려서는 안 된다.
rejected_alternatives:
  - alternative: enrichment 실패를 report 전체 실패로 바꾸고 복구할 때 새 report를 만든다.
    reason: 이미 준비된 core evidence와 stable report identity를 잃고 같은 계산을 다시 시작하게 한다.
authority_refs:
  - docs/contracts/story-chain/promises/gap-report-prepared-reaction.md
  - docs/contracts/story-chain/aspects/gap-build-principal-admission.md
  - docs/runtime-flows/gap-network-analysis.md
grounding:
  - type: commit
    ref: d73de28560535de5a092ba23b0d0f47b7488e9ef
    path: docs/contracts/story-chain/promises/gap-report-prepared-reaction.md
    note: core-visible artifact와 explicit enrichment recovery의 제품 의미를 도입한 변경이다.
  - type: commit
    ref: 2a5bdd5d729fe203b86714d72b914f4e2660eb03
    path: docs/contracts/story-chain/aspects/gap-build-principal-admission.md
    note: 여러 build command에 공통인 principal admission 제약을 제품 계약으로 연결했다.
relations:
  - type: produced_by
    target: product-making.gap-report-recovery-propagation
temporal_status: current
evolution:
  - date: 2026-08-12
    note: enrichment 실패를 core evidence와 분리하고 같은 report identity의 명시적 복구로 바꿨다.
  - date: 2026-08-13
    note: 생성·core recovery·enrichment retry에 공통인 principal admission 제약을 연결했다.
refresh_conditions:
  - gap report가 core와 enrichment를 다시 하나의 terminal 상태로 합친다.
  - recovery가 새 report identity 또는 별도 public enrichment result를 만들게 된다.
answers:
  - enrichment가 실패해도 gap report의 core graph를 유지하는 이유는 무엇인가?
  - gap report recovery가 새 report 생성이 아니라 같은 report identity의 상태 전이인 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.gap-report-recovery-propagation
lifecycle: shared-consolidated
plane: product-making
kind: case
title: gap report recovery를 계약부터 admission까지 전파한 사례
aliases:
  - gap enrichment retry propagation
  - principal admission propagation case
statement: Gap report recovery 작업은 사용자-visible 복구 의미를 Promise에 두고, 공통 build 제약을 Aspect로 분리한 뒤 기존
  runner·CAS·repository와 새 principal admission state까지 연결한 multi-owner 사례다.
scope:
  - 제품 의미를 Story Chain, UI, API, runtime, repository, DB와 운영 근거로 전파한 경험
  - 기존 실행 owner를 재사용하면서 새 공통 state lifecycle만 분리한 사례
non_scope:
  - 현재 retry command와 admission RPC의 구현 명세
  - 모든 multi-owner 작업의 고정 절차
forces:
  - 생성, core recovery, enrichment retry는 서로 다른 Promise 의미를 가지면서 같은 build 자원을 쓴다.
  - command admission과 durable report state가 분리되면 claim, CAS, release 사이의 race를 막아야 한다.
  - 사용자 행동 analytics와 내부 결과·비용 관측은 서로 다른 owner가 필요했다.
rejected_alternatives:
  - alternative: recovery를 새 queue나 별도 enrichment control plane으로 분리한다.
    reason: 기존 runner와 report CAS가 이미 실행·완료·stale fencing을 소유해 중복 lifecycle을 만든다.
authority_refs:
  - docs/mission-control.md
  - docs/runtime-flows/gap-network-analysis.md
  - docs/operational-readiness.md
grounding:
  - type: commit
    ref: d73de28560535de5a092ba23b0d0f47b7488e9ef
    path: docs/runtime-flows/gap-network-analysis.md
    note: explicit retry를 기존 runner와 report identity 안에 결속한 첫 workstream이다.
  - type: commit
    ref: 2a5bdd5d729fe203b86714d72b914f4e2660eb03
    path: docs/runtime-flows/gap-network-analysis.md
    note: principal admission state와 report CAS의 결합을 후속 workstream에서 닫았다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-08-12
    note: "Issue #414에서 explicit enrichment recovery를 기존 artifact와 runner에 제약했다."
  - date: 2026-08-13
    note: "Issue #417에서 두 Promise와 공통 Aspect, DB admission lifecycle을 연결했다."
refresh_conditions:
  - 다른 recovery 작업이 기존 owner 재사용보다 별도 control plane을 선택해 더 나은 결과를 보인다.
  - gap build의 command admission과 report state 경계에서 post-merge escape가 발생한다.
answers:
  - gap report recovery는 어떤 owner를 거쳐 제품 의미에서 durable execution으로 전파됐는가?
  - 새 queue를 만들지 않고 기존 runner와 CAS를 재사용한 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.executable-contract-evidence
lifecycle: shared-consolidated
plane: product-making
kind: model
title: 계약 주장을 실행 그래프로 닫는 evidence 모델
aliases:
  - executable Evidence Ledger graph
  - machine-first contract evidence
statement: Evidence Ledger는 Acceptance Check, assertion source와 structured execution을 하나의 그래프로 연결한다.
  사람이 읽는 설명은 맥락을 제공하지만 실행 identity와 coverage는 기계가 검증할 수 있는 구조가 소유한다.
scope:
  - 제품 계약 주장과 실행 증거 사이의 결속
  - source citation, assertion, execution coverage를 분리하지 않는 이유
  - 사람이 읽는 narrative와 machine-first record의 역할 분리
non_scope:
  - 현재 ledger schema field와 runner command의 복사
  - 개별 Promise의 현재 verdict와 execution count
forces:
  - Markdown 표와 자연어 실행 설명은 렌더 경계나 selector drift를 숨길 수 있다.
  - 실행 명령이 존재해도 해당 Acceptance Check의 인용 artifact를 실제로 실행하지 않을 수 있다.
  - 제품 의미를 유지하면서 evidence 형식과 runner를 독립적으로 진화시켜야 한다.
rejected_alternatives:
  - alternative: Markdown table과 raw shell command를 유지하고 review prose를 강화한다.
    reason: row, artifact와 실행 집합의 identity를 구조적으로 비교하지 못해 같은 false-green이 남는다.
authority_refs:
  - docs/contracts/story-chain/README.md
  - docs/mission-control.md
grounding:
  - type: commit
    ref: 036bc3d2c7aa6b93fcf11791cee7dc37e3f95807
    path: docs/contracts/story-chain/README.md
    note: operational Evidence Ledger를 strict YAML과 structured execution graph로 전환한 정본이다.
relations:
  - type: evidenced_by
    target: product-making.evidence-ledger-yaml-cutover
temporal_status: current
evolution:
  - date: 2026-08-01
    note: 한 ledger의 실행 결속 강화에서 전체 operational ledger 전환으로 범위를 확장했다.
  - date: 2026-08-02
    note: parity, closed execution, package target과 citation 결속을 보정해 YAML v2 전환을 닫았다.
refresh_conditions:
  - structured execution이 실제 assertion artifact를 실행하지 않은 채 반복해서 통과한다.
  - 현재 record 구조가 계약 설명과 실행 provenance를 함께 표현하지 못한다.
answers:
  - Evidence Ledger가 Markdown 표가 아니라 structured execution graph인 이유는 무엇인가?
  - 계약 citation과 실행 명령을 같은 graph에서 검증하는 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.evidence-ledger-yaml-cutover
lifecycle: shared-consolidated
plane: product-making
kind: case
title: Evidence Ledger YAML v2 전환 사례
aliases:
  - Evidence Ledger machine-first cutover
  - Issue 553 ledger migration
statement: Evidence Ledger YAML v2 전환은 렌더가 끊긴 Markdown 표, 비어 있는 row 실행과 raw shell 결속을 발견한 뒤 계약 의미를
  유지하면서 operational ledger 전체를 structured record와 closed runner로 옮긴 사례다.
scope:
  - 기존 계약 key를 보존한 evidence storage와 runner 전환
  - migration parity와 exact artifact execution을 함께 검증한 경험
non_scope:
  - 현재 ledger의 개수와 실행 cardinality
  - 모든 문서를 YAML로 바꾸는 일반 원칙
forces:
  - 사람이 보는 표가 일부 row만 렌더해도 source file의 pipe 수 검사는 통과할 수 있었다.
  - shell string과 package alias가 실제 target과 다른데도 정적 registry가 일치한다고 볼 수 있었다.
  - 큰 전환은 기존 Acceptance Check와 execution binding을 잃지 않았다는 parity 증거가 필요했다.
rejected_alternatives:
  - alternative: 깨진 표와 누락된 run만 개별적으로 고치고 storage 형식은 유지한다.
    reason: parser, runner와 review가 서로 다른 identity를 계속 사용해 공통 원인이 남는다.
authority_refs:
  - docs/contracts/story-chain/README.md
  - docs/mission-control.md
grounding:
  - type: commit
    ref: 036bc3d2c7aa6b93fcf11791cee7dc37e3f95807
    path: docs/contracts/story-chain/README.md
    note: "Issue #553의 YAML v2 cutover와 현재 evidence graph 경계를 통합한 merge revision이다."
relations: []
temporal_status: historical
evolution:
  - date: 2026-08-01
    note: 초기 전환의 parity와 execution closure 결함을 여러 exact-head review에서 발견했다.
  - date: 2026-08-02
    note: 두 번째 design cycle에서 converter와 구조 검증을 먼저 둔 전환으로 완료했다.
refresh_conditions:
  - 다른 대규모 evidence migration이 의미 parity 없이 형식만 바꾸려 한다.
  - ledger storage와 actual runner identity가 다시 분리된다.
answers:
  - Evidence Ledger YAML v2 전환은 어떤 false-green에서 시작됐는가?
  - 대규모 계약 증거 전환에서 parity와 closed execution을 함께 확인한 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.owner-routed-implementation-context
lifecycle: shared-consolidated
plane: product-making
kind: model
title: runtime zone과 obligation을 결합한 구현 맥락
aliases:
  - owner-routed implementation context
  - runtime zone by cross-cutting obligation
statement: Light House의 구현 맥락은 변경을 하나의 배타적 profile로 분류하지 않는다. runtime zone은 코드의 위치와 import 방향을 설명하고,
  서로 독립적인 obligation은 제품 의미·runtime·data·관측·보안·운영 owner를 연결한다.
scope:
  - 구현 위치 탐색과 의미·운영 obligation을 분리한 제작 모델
  - ordinary implementation과 specialist owner 진입의 관계
  - 여러 surface를 함께 바꾸는 변경의 owner 조합
non_scope:
  - 현재 zone 표, First Route와 validation command의 복사
  - 개별 PR의 구현 분류 또는 merge verdict
forces:
  - 실제 구현은 UI, HTTP, server, data와 shared contract를 함께 건드릴 수 있다.
  - frontend, backend, API 같은 배타적 label은 cross-cutting owner를 결정하지 못한다.
  - 모든 구현을 generic skill이나 classifier로 감싸면 작은 변경의 기본 경로까지 무거워진다.
rejected_alternatives:
  - alternative: staged diff를 하나의 profile로 분류해 required workflow를 선택한다.
    reason: multi-surface 변경을 한 label로 축소하고 path signal이 제품 의미와 owner 판단을 대신한다.
authority_refs:
  - docs/implementation.md
  - docs/agent-skills.md
grounding:
  - type: commit
    ref: 4fb115e45cf2aecc166d3f8d2d0b2765e5c34a95
    path: docs/implementation.md
    note: classifier를 은퇴하고 runtime zone과 obligation의 단일 구현 진입점을 통합한 revision이다.
  - type: commit
    ref: 722a181fea5ac66efcfe5b387ab48c5f97e62b19
    path: docs/contract-maps/quality-gate-records.md
    note: owner-routed 구현 맥락을 prospective 표본으로 평가한 bounded 결과를 보존한다.
relations:
  - type: evidenced_by
    target: product-making.gap-report-recovery-propagation
  - type: evidenced_by
    target: product-making.bounded-implementation-context-evaluation
temporal_status: current
evolution:
  - date: 2026-08-10
    note: staged classifier의 작은 live sample은 path profile의 제한을 드러냈다.
  - date: 2026-08-11
    note: 배타적 surface profile을 기각하고 구현 가이드와 owner 직접 routing으로 전환했다.
  - date: 2026-08-14
    note: ordinary와 multi-owner prospective 표본의 bounded 평가를 거쳐 repository-local 사용 근거를 남겼다.
refresh_conditions:
  - core owner를 늦게 발견해 material redesign이 반복된다.
  - zone과 obligation 조합이 실제 implementation surface를 설명하지 못한다.
answers:
  - Light House 구현 작업을 frontend, backend와 API 중 하나로 분류하지 않는 이유는 무엇인가?
  - runtime zone과 cross-cutting obligation을 별도 축으로 두는 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.bounded-implementation-context-evaluation
lifecycle: shared-consolidated
plane: product-making
kind: case
title: owner-routed 구현 맥락의 bounded 효과 검증
aliases:
  - Issue 616 bounded effectiveness case
  - implementation context 4 plus 1 evaluation
statement: "Issue #616은 두 ordinary workstream, 서로 다른 두 multi-owner workstream과 한 tie-breaker를 구현 전에
  선택해 owner routing과 merge 전 containment를 관찰했다. 비용 자료의 불완전성을 유지한 채 현재 저장소 범위의 정성 Human 판단으로 평가를
  닫았다."
scope:
  - 구현 체계의 설치와 효과를 분리해 검증한 경험
  - ordinary와 multi-owner 표본을 함께 본 repository-local 평가
  - route miss, correction containment와 process cost 한계를 함께 보존한 사례
non_scope:
  - 현재 구현 방법의 operating verdict와 재검토 명령
  - 통계적 또는 독립 인과 효과 주장
  - 다른 저장소로의 일반화
forces:
  - 설치와 gate 통과만으로 owner routing이 실제 구현을 돕는다고 말할 수 없었다.
  - 긴 자연 발생 cohort는 현재 프로젝트 속도와 맞지 않았고 선택 편향도 남겼다.
  - 일부 표본은 active authoring, machine과 review cost가 partial 또는 unknown이었다.
rejected_alternatives:
  - alternative: 20~30개 PR이 쌓일 때까지 판정을 미루거나 설치 완료를 효과 성공으로 간주한다.
    reason: 전자는 현실적인 의사결정 시점을 놓치고 후자는 비용과 containment evidence를 검증하지 않는다.
authority_refs:
  - docs/agent-skills.md
  - docs/contract-maps/quality-gate-records.md
  - docs/architecture-fitness/README.md
grounding:
  - type: commit
    ref: 722a181fea5ac66efcfe5b387ab48c5f97e62b19
    path: docs/contract-maps/quality-gate-records.md
    note: 다섯 표본, evidence limitation과 후속 Human 정성 판정을 보존한 exact main revision이다.
relations: []
temporal_status: historical
evolution:
  - date: 2026-08-13
    note: 초기 두 multi-owner 작업은 merge 전 containment를 보였지만 비용 분모가 없어 insufficient-evidence였다.
  - date: 2026-08-14
    note: 4+1 prospective 표본을 마치고 partial evidence를 보존한 정성 판단으로 bounded evaluation을 종료했다.
refresh_conditions:
  - owner-routed 구현 맥락에서 qualifying route miss 또는 linked escape가 새로 관찰된다.
  - 더 완전한 cost 자료나 비교 설계가 이 사례의 정성 해석을 반박한다.
answers:
  - Issue
  - bounded 평가가 통계적 효과 주장이 아닌 이유는 무엇인가?
legacy_refs: []
last_review_id: 9a18af7d-3e7b-472e-90b7-7cb4637efabe
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.gate-self-verification
lifecycle: shared-consolidated
plane: product-making
kind: model
title: 검증 장치가 주장하는 상태도 검증 대상으로 두는 제작 모델
aliases:
  - gate self-verification
  - 게이트 자기 검증
  - 선언과 배선의 parity
statement: 게이트가 코드와 계약을 검증한다는 사실은 그 게이트가 실제로 강제되고 있음을 증명하지 않는다. 강제 지위, 수동 판정의 신선도, 결정적 강제 범위는 각각
  선언으로 고정하고 선언과 실제 배선의 일치를 기계가 검사해야 하며, 검사하지 않으면 문서가 주장하는 보호와 실제 보호가 조용히 갈라진다.
scope:
  - 검증 장치 자신의 상태를 검증 대상으로 삼는 이유
  - 강제 지위·신선도·강제 범위를 선언으로 분리하는 이유
  - 수동으로만 도는 authoritative 판정이 무신호로 낡는 실패 형태
  - 결정적 강제 밖에 남는 범위를 숨기지 않고 선언하는 이유
non_scope:
  - 현재 required check 목록과 budget 수치
  - 특정 파일 편집에 요구되는 현재 절차
  - 개별 lane의 현재 신선도 상태와 verdict
forces:
  - 강제 지위가 문서 프로즈, workflow 트리거, 저장소 호스트 설정 세 곳에 흩어져 한 곳만 바뀌어도 드러나지 않는다.
  - 비용 때문에 수동 실행으로 남긴 판정 lane은 실행을 강제하는 신호가 없으면 실행되지 않는다.
  - 프로즈가 서술하는 강제 범위가 검증기의 실제 범위보다 넓으면 읽는 쪽이 보호받는다고 오해한다.
  - 과거 기록을 현재 문법에 맞추는 정리는 사후에 없던 산출물을 만들어내는 조작이 될 수 있다.
rejected_alternatives:
  - alternative: 검사 시점에 호스트 설정을 직접 조회해 실제 상태와 비교한다.
    reason: 기본 권한 밖이고 게이트가 외부 응답에 의존해 결정적이지 않게 된다.
  - alternative: 낡은 판정을 예약 실행으로 자동 갱신한다.
    reason: 예약 실행을 제거한 자원 결정과 충돌한다. 실행 강제와 실행 자동화는 다른 문제다.
  - alternative: 잠복 비준수 집계를 0으로 만들기 위해 과거 기록에 사전 계획 산출물을 소급 작성한다.
    reason: 요건이 생기기 전의 결정에 예측과 예산을 지어내면 증거가 아니라 조작이 된다. 원 결정문을 보존하고 실제로 일어난 전파 범위만 현행 필드로 옮기는 정규화는 이 기각에
      해당하지 않는다.
authority_refs:
  - docs/ci-structure.md
  - docs/contract-maps/quality-gates.md
grounding:
  - type: commit
    ref: 88508599fdb1ada142fc0fcae2293bfefa4c8904
    path: docs/ci-structure.md
    note: 강제 지위·신선도·강제 범위를 선언으로 분리하고 parity 검사를 도입한 변경이다.
  - type: commit
    ref: 7fe39a07e9944452f7f0490b0b91f24235d19733
    path: docs/contract-maps/quality-gates.md
    note: 프로즈가 주장하던 강제 범위와 검증기 범위의 갭을 검증기 쪽을 넓혀 닫고 게이트 지도를 같이 옮긴 변경이다.
relations:
  - type: evidenced_by
    target: product-making.attestation-silent-staleness
temporal_status: current
evolution:
  - date: 2026-08-15
    note: 감사에서 나온 다섯 결함을 개별 수리하지 않고 공통 원인인 자기 검증 부재로 묶어 모델을 만들었다.
  - date: 2026-08-15
    note: 첫 판단은 과거 기록의 현행화를 조작으로 보고 보존을 택했으나, 후속 Human 결정이 원 결정문과 날짜별 상세를 보존한 채 실제 전파 범위만 현행 필드로 옮기는
      정규화를 승인해 기각 대안의 경계를 "정규화 전체"에서 "예측·예산의 소급 창작"으로 좁혔다.
refresh_conditions:
  - 선언과 실제 배선이 일치하는데도 보호가 갈라지는 사례가 반복된다.
  - 선언 파일 자체가 신뢰할 수 없는 지점이 되어 별도의 상위 검증이 필요해진다.
  - 수동 판정 lane이 사라지거나 자동 실행으로 대체된다.
answers:
  - 게이트가 있는데도 왜 게이트의 강제 상태를 따로 검증하는가?
  - 비용 때문에 수동으로 남긴 판정을 어떻게 낡지 않게 유지하는가?
  - 결정적으로 강제하지 못하는 범위를 왜 숨기지 않고 선언하는가?
legacy_refs: []
last_review_id: 8b607715-bddd-455a-925c-8e1d37d9ddfc
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.attestation-silent-staleness
lifecycle: shared-consolidated
plane: product-making
kind: case
title: 수동 판정 lane이 무신호로 낡아 있던 사례
aliases:
  - attestation silent staleness
  - 무신호 신선도 위반
statement: 서명된 아키텍처 판정을 수동 실행으로만 남긴 뒤, 그 판정이 현재 기준선에서 얼마나 뒤처졌는지 알리는 장치를 함께 두지 않자 판정 lane이 고장난 상태로 여러
  날 지속됐고 발견 경로는 새 신선도 게이트가 강제한 실행 시도였다.
scope:
  - 수동 실행 lane에서 실행 강제 신호가 없을 때 나타나는 실패 형태
  - 문서에 적힌 최신 상태가 실행 이력보다 낡아 진단을 오도한 경험
  - 고장이 아니라 무신호가 문제였다는 관찰
non_scope:
  - 해당 lane의 현재 신선도 수치와 budget
  - collector와 정책 결속의 현재 구현 형태
forces:
  - 실행 비용이 큰 판정은 매 변경에서 돌릴 수 없어 수동 lane으로 남는다.
  - 수동 lane의 최신 상태를 사람이 쓰는 문서에 적으면 실행 이력과 갈라진다.
  - 낡음을 시간이 아니라 변경량으로 재야 활동이 없는 기간에 잘못된 경보가 나지 않는다.
rejected_alternatives:
  - alternative: 문서의 현재 상태 서술을 성실히 갱신하는 것으로 충분하다고 본다.
    reason: 이 사례에서 그 서술이 실제 실행보다 낡아 진단을 수백 커밋 규모로 오도했다.
authority_refs:
  - docs/architecture-fitness/README.md
  - docs/ci-structure.md
grounding:
  - type: commit
    ref: 7fe39a07e9944452f7f0490b0b91f24235d19733
    path: docs/architecture-fitness/README.md
    note: 문서 서술이 실행 이력을 따라가지 못한 사례임을 기록하고 기계 판독 가능한 선언으로 기준선을 옮겼다.
relations: []
temporal_status: current
evolution:
  - date: 2026-08-15
    note: 신선도 게이트가 강제한 첫 실행 시도에서 고장이 드러나 사례로 고정했다.
refresh_conditions:
  - 수동 lane 없이 모든 authoritative 판정이 자동 실행으로 바뀐다.
  - 신선도 신호가 있는데도 같은 무신호 낡음이 재현된다.
answers:
  - 수동 실행 판정을 그대로 두면 어떤 방식으로 무너지는가?
  - 낡음을 날짜가 아니라 변경량으로 재는 이유는 무엇인가?
legacy_refs: []
last_review_id: 8b607715-bddd-455a-925c-8e1d37d9ddfc
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.evidence-capability-authority-separation
lifecycle: shared-consolidated
plane: product-making
kind: model
title: 증거 생산 능력과 release authority를 매 절단마다 다시 분리하는 제작 모델
aliases:
  - evidence capability vs release authority
  - 검색 품질 release authority 분리
  - self-attestation false pass
statement: 검색 품질처럼 정책 기준이 아직 승인되지 않은 축에서는 증거를 만드는 능력이 늘어날 때마다 그 산출물이 스스로 release authority를 얻지 못하도록
  authority를 별도 선언으로 다시 분리한다. evaluator, self-check attestation, decision packet은 각각 실행 가능해졌지만
  authority는 매번 명시적으로 부정됐고, 대상이 만든 증거로 대상을 통과시키는 self-attestation은 독립 리뷰마다 다시 발견되는 false pass 유형으로
  다뤘다.
scope:
  - 정책 기준이 승인되기 전 evidence 공학이 authority를 갖지 않는 이유
  - 증거 산출물마다 authority 선언을 따로 두는 이유
  - self-reported 증거를 판정 입력으로 쓰지 않는 이유
  - 독립 리뷰에서 구조 결함이 반복되면 패치 대신 재설계로 전환하는 이유
non_scope:
  - 현재 threshold 수치, provider·corpus 선택, bounded-live 구현
  - Service Policy Coverage Matrix의 현재 행별 disposition
  - 승인 보류의 재개 시점
forces:
  - Promise와 Aspect가 모두 충족돼도 서비스 정책 감사가 끝나지 않은 축이 있을 수 있어, Service Policy Coverage가 Promise 완주와 분리된
    release 축으로 열렸다.
  - mock green, URL 재실행, 2xx와 논문 존재, generic release block 같은 기존 proxy 신호는 각각 실제 provider 품질과 승인
    threshold를 대신하지 못했다.
  - 실행 가능한 코드가 생기면 authority가 따라온 것처럼 읽히기 쉬워, evaluator가 성공해도 release는 not-applicable로 고정해야 했다.
  - 대상이 보고한 target SHA, fixture를 live로 오인하는 경로, 식별자 누출은 각각 독립 리뷰가 실제로 잡아낸 false pass였다.
  - threshold 같은 정책 값을 구현자가 기본값으로 채우면 Human과 Operational Readiness의 결정을 구현이 대신하게 된다.
rejected_alternatives:
  - alternative: 대상이 스스로 보고한 report·profile·target SHA를 threshold와 비교해 release go로 인정한다.
    reason: 보호된 실행 authority가 아니므로 독립 리뷰가 false pass로 판정했다.
  - alternative: threshold 수치를 코드나 schema 기본값으로 먼저 넣고 나중에 Human이 바꾼다.
    reason: 정책 결정을 구현이 대신하게 되어 decision packet 검토에서 기각됐다.
  - alternative: 독립 리뷰에서 새 구조 결함이 나와도 같은 설계에 패치를 계속 쌓는다.
    reason: 다섯 번째 리뷰에서도 새 결함이 나오자 이전 설계를 forensic 브랜치로 보존하고 main 기준으로 다시 설계했다. 같은 작업에서 두 번 발동했다.
  - alternative: 검색 품질 미결 사항을 기존 Promise·AC 계약 안에 끼워 넣어 일반 release block으로 막는다.
    reason: 계약 미충족과 정책 미감사는 다른 결핍이며, 일반 block을 미정 기준의 대리값으로 쓰면 무엇이 부족한지 가려진다.
authority_refs:
  - docs/operational-readiness.md#11-검색-품질-release-evidence
  - scripts/search-quality/README.md
  - docs/contracts/story-chain/service-policy-coverage/research-and-discovery.matrix.yaml
grounding:
  - type: commit
    ref: 4b6a5fd8e1af3f21b2da4fc3c3987fcb282f142e
    path: docs/contracts/story-chain/service-policy-coverage/research-and-discovery.matrix.yaml
    note: 관측 축과 disposition 축을 분리한 Service Policy Coverage Matrix를 도입해 Promise 완주와 별개인 release 축을 연 변경이다.
  - type: commit
    ref: 5363a7fbd41f60ef1ff9e6e359c41cd8d2f28d40
    path: scripts/search-quality/evaluator.ts
    note: 네 지표를 하나의 점수로 합치지 않고 deterministic wiring의 release를 not-applicable로 고정한 첫 fail-closed
      evaluator다.
  - type: commit
    ref: 2e386f1708f38f31b29f37aa8bd2eaa2ef08a2d9
    path: scripts/search-quality/attestation.ts
    note: 원시 report와 실행 identity를 exact revision에 묶으면서도 attestation· execution·currentness·release
      authority를 모두 false로 선언한 self-check다.
  - type: commit
    ref: f4065a30d44e95483ad97fd82ea68d80f1a20f0a
    path: scripts/search-quality/decision-packet.ts
    note: 열한 개 정책 입력을 digest로 묶어 한 번에 승인받게 하되 수치 자체는 담지 않는 pre-approval packet이다. 승인과 rollout 역할의 겹침을 명시
      승인 대상으로 만든 재설계 결과다.
relations:
  - type: serves
    target: product.observational-evidence-boundary
  - type: evidenced_by
    target: product-making.external-attestor-approved-then-withdrawn
temporal_status: current
evolution:
  - date: 2026-08-28
    note: Service Policy Coverage Matrix가 생기면서 measurement-release family가 별도 추적 대상이 됐고, 기존 proxy 신호가 각각
      release 근거로 부족함이 확인됐다.
  - date: 2026-08-29
    note: 첫 evaluator 병합 직후 self-reported target SHA, fixture 오인, 식별자 누출 세 false pass가 독립 리뷰에서 나와 수정됐고,
      다섯 번째 리뷰에서 새 결함이 나오자 cycle 1을 보존하고 재설계했다.
  - date: 2026-09-01
    note: self-check attestation과 decision packet이 authority false를 유지한 채 병합됐고, 외부 attestor는 승인 뒤 철회됐으며
      Human이 정책 승인을 보류했다. 그 결과 여러 PR이 병합된 뒤에도 owner issue는 열린 채 남았다.
refresh_conditions:
  - 어떤 검색 품질 산출물이 처음으로 release authority를 true로 선언한다.
  - Human이 승인을 재개해 protected verification이나 bounded-live 수집이 실제로 구현된다.
  - 다른 Matrix family에서 같은 패턴이 반복되지 않고 다른 authority 모델이 채택된다.
answers:
  - 검색 품질 evaluator가 통과해도 왜 release는 여전히 no-go인가?
  - 왜 여러 PR이 병합됐는데 검색 품질 owner issue는 계속 열려 있는가?
  - decision packet은 왜 threshold 수치가 아니라 승인 슬롯 구조만 담는가?
  - 독립 리뷰에서 결함이 반복되면 왜 패치 대신 설계를 다시 만드는가?
legacy_refs: []
last_review_id: b4ff8514-479e-4c25-b8c3-18d8af9d46db
```

<!-- project-knowledge-object:v1 -->
```yaml
id: product-making.external-attestor-approved-then-withdrawn
lifecycle: shared-consolidated
plane: product-making
kind: case
title: 승인된 외부 attestor 아키텍처가 같은 날 철회된 사례
aliases:
  - external attestor withdrawal
  - lighthouse-search-quality-attestor
  - 외부 attestor 철회
  - 레포는 제거하라 일단 로컬에서 테스트하자
statement: 검색 품질 증거를 대상 밖에서 증명하기 위해 별도 private 저장소와 protected environment 서명을 쓰는 외부 attestor 안이
  Human 승인을 받아 구현됐으나, 약 두 시간 뒤 외부 저장소 PR과 타인 승인 요구가 나타나자 Human이 "별도 레포를 만드는건가?"라고 물은 뒤 "레포는 제거하라. 일단
  로컬에서 테스트하자"고 결정하고 저장소를 직접 삭제해 secretless local-only 증거 경계로 되돌아갔다. 승인 시점의 선택지 세 개는 모두 별도 저장소를 항목으로
  담고 있었지만, 그 결과가 실제 원격 저장소와 외부 PR로 구체화된 뒤에야 Human의 결정이 바뀌었다.
scope:
  - 외부 attestor 제안·승인·구현·철회의 경과와 Human 발화 원문
  - 승인된 선택지의 항목과 실제 결과물 사이의 인지 간격
  - 철회 뒤 남은 local-only 경계가 무엇을 여전히 막는지
non_scope:
  - 외부 attestor를 다시 채택할지 여부
  - Human 발화 밖의 동기 추정
forces:
  - 대상 코드를 실행하지 않는 독립 verifier와 별도 key custody는 self-attestation을 구조적으로 없앤다.
  - 별도 저장소는 branch protection상 타인 승인, custodian 지정, environment와 key 소유권 결정을 즉시 요구했고 그 소유자는 정해져 있지
    않았다.
  - 세 선택지의 bullet 목록에 든 "별도 private attestor 저장소"는 승인 시점에 다른 항목과 같은 무게로 읽혔고, 외부 PR이 열리고 나서야 별도 저장소가
    결정의 핵심으로 드러났다.
  - Human은 외부 운영 경계를 세우기 전에 로컬에서 먼저 테스트하는 순서를 택했다.
rejected_alternatives:
  - alternative: 별도 private attestor 저장소와 protected environment HMAC 서명.
    reason: 승인 뒤 구현까지 진행됐으나 Human이 "레포는 제거하라. 일단 로컬에서 테스트하자"고 철회하고 저장소를 직접 삭제했다. 사유는 2026-09-02 issue
      738 코멘트에 사후 기록됐다.
  - alternative: OIDC 또는 cloud KMS 비대칭 서명, 독립 GitHub App 고보증안.
    reason: 승인 시점에 이미 기각돼 문서로만 남았다. 둘 다 별도 저장소를 전제하므로 같은 철회 사유가 적용된다.
  - alternative: 같은 저장소 안의 self-attestation을 authority로 인정한다. 승인 시점의 A/B/C 세 안 밖에 있던 상시 기각 기준선이다.
    reason: 처음부터 authority 선택지에서 제외됐고, 철회 뒤에도 로컬 self-check는 authority 네 항목을 모두 false로 유지했다.
authority_refs:
  - docs/ci-structure.md
  - docs/contract-maps/quality-gates.md
  - scripts/search-quality/README.md
grounding:
  - type: commit
    ref: a23494351b815f46a2cb6be030469d216c2bf21a
    path: scripts/search-quality/attestation.ts
    note: 승인된 외부 attestation 경계를 구현한 commit이다. 이후 철회로 external wiring은 제거됐다.
  - type: commit
    ref: 0bcb54689a6e1f67e3017b6923f4a6f1624a075d
    path: scripts/search-quality/attestation.ts
    note: 철회를 구현해 검색 품질 증거를 local에 유지하도록 되돌린 commit이다.
  - type: commit
    ref: bc0cdd946ec12a38e27d10f03610f4ed5e8a4c73
    path: docs/ci-structure.md
    note: 철회를 병합한 commit이다. local loopback 테스트를 더하고 외부 workflow 배선을 걷어내 되돌린 뒤의 상태를 보여준다.
relations: []
temporal_status: current
evolution:
  - date: 2026-09-01
    note: 외부 attestor 안이 승인·구현된 뒤 같은 날 철회됐고 issue는 not planned로 닫혔다.
  - date: 2026-09-02
    note: 철회 사유를 durable 기록 밖의 로컬 Codex 세션 transcript (session 01a040fa-5cb2-7ec3-a6ce-5527d2f0d4bb,
      2026-09-01T05:01Z 선택지 제시, 05:10Z "A 로가자", 07:08Z "별도 레포를 만드는건가?", 07:09Z "레포는 제거하라. 일단 로컬에서
      테스트하자", 07:14Z "레포는 수동으로 삭제 했다.")에서 확인했다. 이전 버전이 추정으로 적었던 "좁은 보장만 필요했다"는 force를 제거했다.
  - date: 2026-09-02
    note: 독립 리뷰가 인용 마침표 누락과 A/B/C 세 안과 세 번째 기각 대안의 혼동 가능성을 지적해 고쳤다.
  - date: 2026-09-02
    note: 같은 발화 표를 issue 738 코멘트(issuecomment-5503680709)로 durable 기록에 남겨 로컬 transcript 의존을 없앴다.
refresh_conditions:
  - 독립 attestation을 다시 여는 issue가 protected 구현에 도달하거나 다시 철회된다.
  - issue 738의 사유 코멘트가 삭제되거나 수정되어 발화 원문 기록이 바뀐다.
answers:
  - lighthouse-search-quality-attestor 저장소는 왜 history에는 있고 지금은 없는가?
  - 외부 attestor는 왜 시도됐다가 local secretless 경로로 돌아갔는가?
  - 승인된 선택지가 왜 두 시간 만에 뒤집혔는가?
  - 철회 뒤에도 self-attestation은 어떻게 막혀 있는가?
legacy_refs: []
last_review_id: 0dedd4bd-894d-48b7-b6fe-cf12f10eb976
```
