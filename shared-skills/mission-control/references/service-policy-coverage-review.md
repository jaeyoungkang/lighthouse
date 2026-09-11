# Service Policy Coverage Review

Story Chain의 `core-product` Experience나 서비스 단위 Moment·Promise bundle을
새로 만들거나 크게 재구성하기 전에 이 검토를 연다. 사용자 경험 문장만으로는
서비스가 성립하는 데 필요한 최소 정책을 모두 발견할 수 없다. 이 검토는 그
누락을 Story Chain 구성 전에 드러내고 각 정책의 정본 owner를 정한다.

이 검토는 새 Story Chain node나 별도 backlog가 아니다. 조사·판정은 Experience가
가리키는 `docs/contracts/story-chain/service-policy-coverage/*.matrix.yaml`에
versioned Matrix로 남긴다. 작업 issue에는 `## Service Policy Coverage Review`와
Matrix pointer를 기록한다. 제품 조사 원문은 Moonlight Project Knowledge에
보존하고 commit 고정 링크를 사용한다. 현재 제품 의미는 각 정본 owner로 전달한다.

## Trigger

다음 중 하나면 검토한다.

- 새 `core-product` Experience 또는 서비스 surface를 추가한다.
- 여러 Moment·Promise를 묶어 서비스의 주요 여정을 구성하거나 재구성한다.
- 외부 감사, 사용자 연구, 장애, 경쟁 서비스 비교가 주요 계약의 부재를
  지적한다.
- 선언된 Promise가 모두 `met`인데도 서비스 기본 정책의 소유 여부를 설명할 수
  없다.

다음은 full review를 다시 열지 않는다.

- 하나의 기존 Promise 아래에서 의미가 바뀌지 않는 구현·evidence 보정
- policy 의미나 owner가 바뀌지 않는 코드 이동·이름 변경
- 오탈자와 record locator 교정

다만 기존 row가 가리키는 현재 사실이나 exact-revision evidence가 달라졌다면 그
row만 delta review한다. 서비스 책임 경계, canonical owner, 또는 여러 row의
`disposition`이 바뀌면 full review를 다시 연다.

## Minimum Policy Lenses

서비스 종류에 맞게 확장하되, 최소한 다음 렌즈를 조사한다.

| 렌즈        | 확인할 정책                                                    |
| ----------- | -------------------------------------------------------------- |
| 진입과 입력 | 허용 입력, 식별, 검증, 잘못된 입력과 한계                      |
| 결과와 품질 | 후보 생성, 정렬·선택 기준, 정확도·관련성·완전성, 품질 평가     |
| 근거와 출처 | source, coverage, freshness, provenance, 사용자에게 알릴 한계  |
| 결과 범위   | loaded window, total 의미, pagination/cap, 중복, partial/empty |
| 실패와 복구 | timeout, degraded, retry, idempotency, 취소, 재개              |
| 상태와 수명 | 정본, 저장·보존·삭제, 공유, 복원, 최신 상태와 snapshot 구분    |
| 접근과 보호 | 인증, 권한, 개인정보, 보안, abuse와 안전 경계                  |
| 운영 가능성 | 용량, 비용, SLO, 관측 identity/cardinality, rollout과 rollback |
| 호환과 종료 | version, migration, 지원 중단, backward compatibility          |

검색 서비스는 여기에 query/known-item 확인, 후보 확장, relevance·recall,
열람·저장·복귀 여정도 포함한다. 모든 렌즈를 사용자-facing Promise로 만들지는
않는다.

## Research and Disposition

Matrix는 최소한 다음을 기록한다.

```text
matrix id | Experience | service type | reviewed date | reference entry count
source id | repository | exact revision | path
family id | expected capability | minimum-policy lenses
row id | reference entries | reference observation | current observation |
reconciliation | current fact | exact-revision evidence | responsibility surfaces |
disposition | rationale | canonical owner | authority refs | source Promises |
verification refs | decision ref | follow-up
```

참조 당시 관찰(`referenceObservation`)과 현재 관찰(`observation`)은
`reconciliation`으로 대조하며, `disposition`과 합치지 않는다. 현재 사실을
모르면 `observation: unknown`과 `reconciliation: current-unknown`을 함께 쓰고
추정으로 채우지 않는다. 외부 감사가 한 항목을 여러 독립 책임으로 묶었으면
원자 row로 나눌 수 있지만 각 row에 원래 `referenceEntries`를 보존한다.

`disposition`은 세 가지다.

- `owned`: 현재 의미가 확정됐고 정본 owner가 있다. 사용자-facing 의미는
  Experience/Moment/Promise/Aspect와 활성 scenario로, 실행 순서는 runtime-flow로,
  권한·데이터 수명은 security/data/infrastructure owner로, SLO·용량·rollout은
  Operational Readiness로, 검증은 Evidence Ledger/quality gate로 전달한다.
- `rejected`: Human이 의도적으로 지원하지 않기로 정했다. 근거와 다시 검토할
  반증 조건을 남긴다. 지원하지 않는 기대를 활성 scenario나 빈 Promise로
  만들지 않는다.
- `unresolved`: 조사나 Human 결정이 더 필요하다. owner 후보와 다음 질문을
  남긴다. Story Chain bundle의 `servicePolicyCoverage: complete` 판정과 해당
  미결 정책의 제품 의미 전파·구현을 멈춘다. 누락 탐지·구조적 방어와 이미
  `owned`로 확정된 row의 전파는 진행할 수 있다.

정책이 여러 owner에 걸쳐도 의미 owner는 하나만 둔다. 다른 파일은 mechanism,
evidence, 운영 rail을 소유하며 같은 정책 verdict를 복제하지 않는다.

`owned` row가 Story Chain 의미를 소유하면 `sourcePromises`와
`verificationRefs`를 모두 적는다. 다른 owner가 소유하면 Story Chain Promise를
억지로 만들지 않고 그 owner의 `authorityRefs`와 검증 ref를 남긴다.

`core-product` Experience frontmatter는 Matrix aggregate 상태를
`servicePolicyCoverage: complete | unresolved`로, 이 검토의 durable pointer를
`servicePolicyCoverageReview`로 선언한다. pointer는 issue가 아니라 local
`*.matrix.yaml`이어야 한다. 한 row라도 `unresolved`면 aggregate도 `unresolved`이며
`mc:status` release verdict가 blocked다. `complete`는 모든 row가 `owned` 또는
Human 근거와 reopening condition이 있는 `rejected`일 때만 쓴다.

## Exact-Revision Reconciliation

외부 감사나 비교 결과를 사용할 때는 감사 대상 revision과 현재 head를 함께
적는다. 감사에서 미충족으로 나온 항목이 현재 Promise/AC에 이미 있으면 다음 중
하나로 판정한다.

- 감사 revision 이후 계약·구현이 추가됐다.
- 계약은 있으나 현재 실행 evidence가 부족하다.
- 감사가 다른 의미를 측정했다.
- 현재 계약 자체가 빠졌다.

대조 없이 감사 문장을 새 Promise로 복제하지 않는다. 반대로 현재 Promise가
`met`이라는 이유만으로 감사 관찰을 폐기하지 않는다.

## Handoff and Closeout

1. 요구되는 policy family와 원 참조 entry가 Matrix에서 빠지지 않았는지 확인한다.
2. `unresolved`가 0인지 확인한다. 하나라도 남으면 Human checkpoint다.
3. `owned` row를 각 canonical owner로 전달한다. 사용자-facing row만 Story
   Chain과 활성 scenario에 들어간다.
4. Story Chain이 소유하는 row에는 Source Promise와 verification ref를 적고, 활성
   scenario마다 정확한 Promise Acceptance Check와 Evidence Ledger
   `scenarios` ref를 같은 변경에서 닫는다.
5. `rejected` row에는 Human rationale와 reopening condition이 있는지 확인한다.
6. CAIR는 승인된 계약의 구조 영향을 평가한다. 이 검토나 누락 탐지를 대신하지
   않는다.

`mc:validate-story-chain`은 Matrix schema, 원 참조 coverage, exact-revision source,
Experience aggregate, Story Chain-owned row의 Source Promise·verification ref를
fail-closed로 검사한다. `scenario_evidence_coverage` cardinality와 alignment
critical finding은 4번의 하류 전파를 검사한다. 사용자 경험으로 기술되지 않는
최소 정책은 각 비-Story-Chain owner의 기존 검증과 Operational Readiness 판정이
닫는다.
