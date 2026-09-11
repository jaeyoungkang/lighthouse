# Quality Gate Review Records

이 문서는 `quality-gates.md`에서 분리한 dated audit와 회수 실행 기록이다.
현재 gate 선택, command 구성, release obligation의 정본이 아니다. 현재 경로는
[`quality-gates.md`](quality-gates.md)에서 시작하고, 아래 기록은 당시 revision의
inventory·비용·판정 근거를 재검토할 때만 읽는다.

## 2026-08-27 활성 scenario 역방향 coverage 방어

### Trigger

Issue #696의 계약 완전성 감사에서 활성 검색 scenario가 어떤 Promise나 Evidence
Ledger에도 도달하지 않아도 기존 Story Chain 검증이 통과할 수 있음을 확인했다.
이 누락은 사용자 경험 밖의 서비스 최소 정책을 찾는 Service Policy Coverage
Review 전체를 기계화하려는 문제가 아니라, 그 검토에서 `owned`로 판정되어 활성
scenario가 된 사용자-facing 정책의 하류 전파가 사라지는 문제다.

### Decision

새 독립 gate나 registry를 만들지 않고 기존 `mc:validate-story-chain` cardinality에
`scenario_evidence_coverage` 관계를 추가했다. active scenario catalog를 source
universe로 삼아 모든 scenario가 Evidence Ledger row 하나 이상에 인용되도록 하고,
ledger가 catalog 밖의 scenario id를 인용하는 것도 거부한다. Alignment audit에는
같은 누락을 `missing_scenario_coverage` critical finding으로 투영한다.

Service Policy Coverage Review의 비-user-facing 정책은 이 관계의 분모가 아니다.
그 항목은 runtime-flow, security/data/infrastructure, Operational Readiness와 기존
quality owner가 닫는다. 따라서 이 gate는 전체 서비스 정책의 충분성을 주장하지
않고, 승인된 사용자-facing scenario의 owner·evidence 단절만 fail-closed로 막는다.

별도로 모든 `core-product` Experience는 review의 aggregate 상태와 durable pointer를
선언한다. 누락된 metadata는 graph gate가 거부하고, `unresolved` 상태는
`mc:status`의 독립 Service Policy dimension이 release ready를 차단한다. 구조 복구와
미결 기록은 보존할 수 있으므로 `unresolved` 자체를 `quality:contract` 실패로 만들지는
않는다.

### Validation

- semantic heading parser는 legacy bare scenario id와 malformed heading을 거부한다.
- validator negative test는 미인용 active scenario, catalog 밖 ledger ref, duplicate
  scenario를 각각 실패시킨다.
- alignment audit negative test는 active scenario의 ledger coverage가 빠졌을 때
  `missing_scenario_coverage`를 만든다.
- 실제 Story Chain closeout은 `npm run quality:contract`로 검증한다.

### Result

기존 graph gate의 책임을 역방향 coverage까지 강화했다. 서비스 최소 정책의 조사와
owner disposition은 Mission Control의 Service Policy Coverage Review가 소유하고,
이 dated record는 그 절차를 대체하거나 새 release verdict를 만들지 않는다.

## 2026-07-25 Guard·Mission Control 회수 감사

이 절은 현재 Gate Stack의 비용과 회수 근거를 읽기 위한 첫 기준점이다. 새
release gate나 별도 registry를 만들지 않는다. 감사 절차와 분기 주기는
`quality-gate-steward`가 소유하고, 이 map은 그 결과만 요약한다.

### 표본과 판정 방법

- 현재 inventory는 commit `d897ccfb`의 `package.json`에 있는 `guard:*` 21개와
  `mc:*` 11개다.
- CI 표본은 GitHub Actions `Quality` workflow의 최근 500회다. 표본 시각은
  2026-07-13 03:41:44 UTC부터 2026-07-25 12:16:05 UTC까지다. 성공 347회,
  실패 146회, 취소 6회, 조회 시점에 결론이 없던 실행 1회였다.
- 실패 run의 responsible job을 다시 조회했다. `static` 또는 `full`이 실패한
  72회가 이번 분석 대상이었다. 실패 귀속과 네 판정의 적용 규칙은
  [`quality-gate-steward` § Quarterly Reclamation Audit](../../shared-skills/quality-gate-steward/SKILL.md#quarterly-reclamation-audit)
  3번과 5번이 소유한다. 이 절은 그 규칙을 복제하지 않고 적용 결과만
  기록한다.
- 실패 job 수는 서로 배타적인 run 분할이 아니다. 한 run에서 `static`과
  `review-closeout`처럼 여러 job이 함께 실패하면 각 lane에 한 번씩
  계수된다.
- 72회는 `evidence-ledger` 2회, `test:coverage` 9회,
  `guard:operational-boundaries` 1회, 당시의 `decision-log:check` 39회,
  `format:check` 6회, `lint:cached` 7회, 은퇴한 `mc:judge-static` 8회로
  귀속됐다. 현재 inventory가 직접 멈춘 사례는 1회다.
- 실행 비용은 같은 commit에서 npm startup을 포함해 각 명령을 한 번씩 순차
  실행한 로컬 wall-clock이다. `mc:compact-reviews`는 `--check`,
  `mc:next`·`mc:trace-ledger`는 대표 읽기 인자를 사용했다. 로컬 machine
  snapshot이므로 CI runner 시간으로 해석하지 않는다.

이 표본은 최근 500회만 다룬다. 표본보다 오래된 CI 이력과 CI에 도달하기 전에
`quality:commit`이 잡은 실패는 계수할 수 없다. 감사 기간 중 추가·은퇴된
명령도 있어 명령별 노출 횟수가 같지 않다. 따라서 실패 0회는 회수 0회나
불필요함을 뜻하지 않는다.

### Guard 결과

| 단계 | 고유한 출시 판단 또는 제품 효과 | 로컬 비용 | 귀속 CI 실패 | 후속 diff 방향 | 통합 감사 판정 |
| --- | --- | ---: | ---: | --- | --- |
| `guard:ai-generation-gateway` | AI provider acquisition을 shared gateway에 가둔다. | 0.23s | 0 | 해당 없음 | 증거 부족 |
| `guard:auth-hot-path` | public·auth hot path의 불필요한 auth read를 막는다. | 0.16s | 0 | 해당 없음 | 증거 부족 |
| `guard:auth-resolver-write-free` | auth identity resolution에서 projection write가 돌아오는 것을 막는다. | 0.16s | 0 | 해당 없음 | 증거 부족 |
| `guard:escapes` | lint·test disable escape가 정적 검증을 무력화하지 못하게 한다. | 0.29s | 0 | 해당 없음 | 증거 부족 |
| `guard:external-http-gateway` | server-side outbound HTTP owner를 제한한다. | 0.17s | 0 | 해당 없음 | 증거 부족 |
| `guard:glossary` | glossary identity·anchor·projection drift를 막는다. | 1.28s | 0 | 해당 없음 | 증거 부족 |
| `guard:interactive-hot-path` | search entry가 외부 library resolver나 history scan을 기다리지 않게 한다. | 0.17s | 0 | 해당 없음 | 증거 부족 |
| `guard:korean` | UI 한국어가 i18n registry를 우회하지 않게 한다. | 0.19s | 0 | 해당 없음 | 증거 부족 |
| `guard:landing-auth-source-boundary` | landing/auth dependency boundary와 Amplitude dynamic import 예외를 함께 검증한다. | 2.61s | 0 | 해당 없음 | 증거 부족 |
| `guard:least-authority-boundaries` | DB·principal·trusted-operation authority 우회를 막는다. | 0.67s | 0 | 해당 없음 | 증거 부족 |
| `guard:ledger-citations` | Story Chain이 삭제되거나 이름이 바뀐 test를 증거로 인용하지 못하게 한다. | 0.21s | 0 | 해당 없음 | 증거 부족 |
| `guard:operational-boundaries` | 운영 boundary row와 inline-analysis identity/version drift를 막는다. | 0.52s | 1 | CI checkout history 보강과 회귀 test 추가 | **헛경보** — [실패 run](https://github.com/jaeyoungkang/lighthouse/actions/runs/29816948053), [회복 run](https://github.com/jaeyoungkang/lighthouse/actions/runs/29817898919), [PR #467](https://github.com/jaeyoungkang/lighthouse/pull/467) |
| `guard:product-owned-navigation` | async handoff가 빈 browser document를 남기지 않게 한다. | 0.17s | 0 | 해당 없음 | 증거 부족 |
| `guard:repository-seam` | table access와 owner-scoped write를 repository seam에 가둔다. | 0.51s | 0 | 해당 없음 | 증거 부족 |
| `guard:review-archives` | 2026-07-25 당시 Sufficiency Review archive의 current-authority 복귀와 manifest drift를 막았다. | 0.42s | 0 | 해당 없음 | 증거 부족 |
| `guard:route-deadline` | route별 `maxDuration` 예산 누락과 범위 초과를 막는다. | 0.16s | 0 | 해당 없음 | 증거 부족 |
| `guard:search-condition-url-budget` | search condition이 shared URL byte budget을 우회하지 못하게 한다. | 0.57s | 0 | 해당 없음 | 증거 부족 |
| `guard:search-first-paint-no-db` | search first paint가 repository I/O를 기다리지 않게 한다. | 0.21s | 0 | 해당 없음 | 증거 부족 |
| `guard:skills` | canonical skill, generated copy, external package provenance drift를 막는다. | 0.29s | 0 | 해당 없음 | 증거 부족 |
| `guard:state-boundaries` | search·relationship route state authority와 lifetime drift를 한 번에 검증한다. | 2.95s | 0 | 해당 없음 | 증거 부족 |
| `guard:supabase-migration-transaction-safety` | transaction apply와 양립하지 않는 concurrent index DDL을 막는다. | 0.17s | 0 | 해당 없음 | 증거 부족 |

21개를 각각 실행한 합계는 12.09초였다. 유일한 직접 실패는 보호 대상의
위반이 아니라 shallow checkout에서 `origin/main`을 읽지 못한 실행 환경
문제였다. 후속 변경은 `static` checkout의 `fetch-depth: 0`과 해당 CI
계약의 회귀 test였다. 제품 boundary나 임계치는 바뀌지 않았으므로
`헛경보`로 판정한다.

### Mission Control 결과

| 단계 | 고유한 출시 판단 또는 운영 효과 | 로컬 비용 | 귀속 CI 실패 | 후속 diff 방향 | 통합 감사 판정 |
| --- | --- | ---: | ---: | --- | --- |
| `mc:audit-story-surface` | Story Chain과 user-facing surface tag의 연결을 검사한다. | 0.49s | 0 | 해당 없음 | 증거 부족 |
| `mc:audit-surface` | user-facing surface의 tag 누락과 stale tag를 검사한다. | 0.31s | 0 | 해당 없음 | 증거 부족 |
| `mc:check-critical-findings` | unresolved critical finding이 계약 closeout을 통과하지 못하게 한다. | 4.40s | 0 | 해당 없음 | 증거 부족 |
| `mc:check-message-registry` | i18n namespace owner와 tone policy drift를 검사한다. | 0.33s | 0 | 해당 없음 | 증거 부족 |
| `mc:compact-reviews` | Sufficiency Review를 archive로 옮기고 rollback provenance를 만든다. 직접 명령은 maintenance write이고 `guard:review-archives`가 `--check` path를 blocking하게 실행한다. | 0.31s (`--check`) | 해당 없음 | 해당 없음 | 증거 부족 — direct command는 CI gate가 아니다. |
| `mc:event-impact` | 변경 파일이 요구하는 analytics event 계약 전파를 검사한다. | 0.44s | 0 | 해당 없음 | 증거 부족 |
| `mc:next` | authority별 다음 계약 작업을 계산한다. | 4.52s | 해당 없음 | 해당 없음 | 증거 부족 — operator query다. |
| `mc:status` | 현재 Story Chain release/verdict 상태를 계산한다. | 8.69s | 해당 없음 | 해당 없음 | 증거 부족 — operator query다. |
| `mc:trace-ledger` | 한 Evidence Ledger의 Promise·AC·evidence 연결을 추적한다. | 4.33s | 해당 없음 | 해당 없음 | 증거 부족 — operator query다. |
| `mc:validate-events` | analytics event schema와 owner ref를 검증한다. | 0.41s | 0 | 해당 없음 | 증거 부족 |
| `mc:validate-story-chain` | Story Chain graph·cardinality·ledger shape·owner boundary를 검증한다. | 0.35s | 0 | 해당 없음 | 증거 부족 |

11개를 대표 읽기 또는 check mode로 실행한 합계는 24.59초였다.
`mc:next`·`mc:status`·`mc:trace-ledger`는 release blocker가 아니므로 CI 실패
diff 판별법을 적용할 수 없다. `mc:compact-reviews`도 write command 자체와
`guard:review-archives`의 blocking check를 나눠 읽어야 한다. 이 네 명령은
비용은 계속 관측하되 CI 회수율 분모에 넣지 않는다.

2026-07-28 후속 작업에서 `mc:compact-reviews`를 퇴역하고
`guard:review-archives`를 Git-history 경계 검사로 바꿨다. 위 Mission Control 표는
2026-07-25 감사 당시의 명령과 비용을 기록하므로 그대로 보존한다.

`review-closeout`은 현재 32개 inventory 밖의 process checkpoint다. 같은
500회 표본에서 실패 job이 75회였지만, 새 content head에 review record가
없으면 실패하는 것이 정상이다. 이 횟수는 제품 결함 회수나 헛경보로 분류하지
않는다. 감사 기간에 은퇴한 `mc:judge-static`의 8회 실패도 현재 MC 명령의
회수 실적으로 이월하지 않는다.

### 통합·은퇴 후보와 규칙 감소량

즉시 은퇴할 gate는 없다. 12일 표본의 실패 0회만으로 보호 가치가 없다고
판정할 수 없기 때문이다. 다음 분기 감사에서는 아래 세 경계를 우선 비교한다.

- `guard:landing-auth-source-boundary`가 실행하는 전체 `deps:boundaries`와
  상위 quality profile의 dependency 검증이 중복되는지 확인한다. 현재 guard
  중 비용이 두 번째로 크므로 leaf fallback만 남길 수 있는지가 통합 후보다.
- `guard:state-boundaries`는 두 route별 gate를 하나로 합친 직후다. 현재
  guard 중 비용이 가장 크지만 inventory와 engine을 공유해 이미 중복을
  줄였다. 다음 감사 전에는 다시 나누거나 은퇴하지 않는다.
- MC operator query 세 개와 compaction write command를 blocking MC gate와
  같은 회수율 표에 합치지 않는다. 분류만 분리하고 명령은 유지한다.

같은 감사 창의 시작 직전 main `cd4852ca`와 현재 head를 비교하면 `guard:*`는
20개에서 21개로 순증했다. 창 안에서는 stale absence guard 3개를 은퇴했고,
route별 state-boundary guard 2개를 1개로 통합했다. 현재 inventory 밖까지
포함하면 `mc:judge-static` 계열 2개도 은퇴했다. Repo-local skill source는
20개에서 18개가 됐다. `decision-log-draft` 1개를 은퇴했고,
`architecture-fitness-review` 1개는 external portable package로 옮겼다.
`AGENTS.md` Never 규칙은 5개로 유지되어 삭제가 없었다. 이 수치는 건강한
감소 관행이 이미 있다는 근거이며, 특정 감소율을 목표나 hard gate로 만들지
않는다.

Sources:

- [Issue #498](https://github.com/jaeyoungkang/lighthouse/issues/498)
- [`package.json`](../../package.json)
- [`docs/ci-structure.md`](../ci-structure.md)
- [`docs/verification-gates.md`](../verification-gates.md)
- [`shared-skills/quality-gate-steward/SKILL.md`](../../shared-skills/quality-gate-steward/SKILL.md)

## 2026-07-28 Issue #530 방어 회수 실행

기준 content head `ea9987029d75ba8dc30d586abd2f600e2f4f3be3`에서 Issue #530의
N(no-code recurrence) / M(maintenance recurrence) / I(intentional
reintroduction) 분류를 적용했다.

- `guard:review-archives`는 I형 absence lock으로 판정해 blocking inventory와
  전용 script/test를 제거했다. 현재 `evidence-ledgers/reviews` owner directory의
  존재와 sidecar schema·Source Promise ownership은 기존
  `mc:validate-story-chain` loader가 positive invariant로 검증한다. Git history
  복원 절차는 유지한다.
- `guard:operational-boundaries`가 함께 소유하던 운영 등록부·telemetry·provider
  control과 inline-analysis cache AST/version 계약을 분리했다. 전자는 기존
  명령에 남기고 후자는 `guard:inline-analysis-cache-contract`로 이동했다. 보호
  범위는 줄이지 않고 실패 owner와 test 파일을 분리했다.
- `guard:landing-auth-source-boundary`는 `deps:boundaries` 2.77초와 custom
  dynamic-import fallback 0.05초로 측정됐다. dependency-cruiser는 다른 blocking
  profile에서 중복 실행되지 않고 leaf fallback의 추가 비용도 작으므로 현재 통합
  명령을 유지한다.
- `guard:state-boundaries`는 shared wrapper 2.73초, search와 relationship 개별
  실행 합계 5.40초였다. 공유 production analysis가 약 49%의 중복 실행을 없애므로
  현재 통합 명령을 유지한다.

Guard inventory는 archive absence owner 하나를 회수하고 cache 계약 owner를 기존
operational 묶음에서 분리해 총 21개를 유지한다. 이 수는 목표가 아니며 다음 분기
감사에서는 CI 귀속 failure, exception 수, 변경 propagation과 reviewer burden을
같이 본다.

## 2026-07-26 Skill·Review·Standards 정렬 감사

이 절은 Issue #507 S8의 첫 통합 감사 결과다. S4에서 추출한
inventory/head → interval/sample → value/evidence/cost → follow-up/verdict →
candidate/recheck 형식을 재사용한다. Skill, review lens, gate의 서로 다른
수명주기 어휘는 합치지 않는다.

### 표본과 한계

- 기준 content head는 `e4deb5d74005a34ed98f75f4cce376d665ab792a`다.
- Skill inventory는 repo-local 18개다. S3 prospective usage 관례 이후 첫
  감사 cutoff 전까지 field-complete 호출은 16건, 8개 skill, 3개 workstream
  root이며 2026-07-25 12:17:51Z–13:25:45Z의 68분 표본이다. 호출별
  `invoking-model`·`workstream-root`·`reason`·`result`가 모두 있는 segment를
  계수했다. 관례 도입 중 `author-model`을 쓴 11:34:51Z record와 필드 없는
  자유문장만 남긴 13:04:42Z record는 제외했다. 이 감사 결과가 만든 23:14:21Z
  S8 self-record도 순환 증거라 cutoff 밖에 두었다. 원본 invocation ledger는 gitignored
  `.project-knowledge-local/work-memory-log.jsonl`의 machine-local 증거라
  제3자가 같은 파일을 다시 읽을 수 없다. 아래 16행 frozen snapshot을 이
  감사의 재현 가능한 표본으로 사용하며 원본 로컬 로그의 지속성을 주장하지
  않는다.
- 기준 head의 `references/`는 24파일 3,681행(`wc -l`)이고, 모두 owning `SKILL.md`에서
  직접 도달 가능했다. 파일·행 수는 burden inventory일 뿐 품질 판정이 아니다.
- Review lens는 canonical log의 archive compacted counts 306건과 active tail
  217 review record를 합쳤다. 과거 label을 현재 group으로 추정 매핑하지 않았다.
  현재 record가 historical label을 새로 쓰는 경로는 prospective closeout
  validation으로 차단한다.
- Skill invocation과 review 결과는 `workstream-root`로만 join했다. 어려운
  process 작업이 steward와 review 반복을 더 많이 부르는 selection bias가 있고
  skill 미사용 비교 cohort가 없으므로 clean 비율을 인과 효과로 해석하지 않는다.

### Skill 사용 × 효과

직접 관측된 호출은 `skill-governance-steward`,
`project-knowledge` 각 3회, `review-checklist-steward`, `korean-prose`,
`quality-gate-steward`, `contract-map-steward` 각 2회,
`mission-control`, `lsp-assisted-engineering` 각 1회다. #505 root의 review
record는 5건(valid 10, already-fixed 29, 최종 clean), #498 root는 4건(valid 3,
already-fixed 6, 최종 clean), #497 root는 최종 통합 record 1건(valid 0,
already-fixed 27, clean)이었고 세 workstream 모두 요구 산출물과 원격 CI를
닫았다. 이것은 산출물 준수 근거이지 skill의 인과 효과 추정치는 아니다.

| Timestamp (UTC) | Skill | Workstream root |
| --- | --- | --- |
| 2026-07-25T12:17:51Z | `skill-governance-steward` | `repo:jaeyoungkang/lighthouse#issue:505` |
| 2026-07-25T12:17:51Z | `review-checklist-steward` | `repo:jaeyoungkang/lighthouse#issue:505` |
| 2026-07-25T12:17:51Z | `project-knowledge` | `repo:jaeyoungkang/lighthouse#issue:505` |
| 2026-07-25T12:17:51Z | `korean-prose` | `repo:jaeyoungkang/lighthouse#issue:505` |
| 2026-07-25T12:34:48Z | `quality-gate-steward` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T12:34:48Z | `contract-map-steward` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T12:34:48Z | `skill-governance-steward` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T12:34:48Z | `korean-prose` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T12:34:48Z | `project-knowledge` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T12:34:48Z | `review-checklist-steward` | `repo:jaeyoungkang/lighthouse#issue:498` |
| 2026-07-25T13:25:45Z | `quality-gate-steward` | `repo:jaeyoungkang/lighthouse#issue:497` |
| 2026-07-25T13:25:45Z | `skill-governance-steward` | `repo:jaeyoungkang/lighthouse#issue:497` |
| 2026-07-25T13:25:45Z | `mission-control` | `repo:jaeyoungkang/lighthouse#issue:497` |
| 2026-07-25T13:25:45Z | `contract-map-steward` | `repo:jaeyoungkang/lighthouse#issue:497` |
| 2026-07-25T13:25:45Z | `lsp-assisted-engineering` | `repo:jaeyoungkang/lighthouse#issue:497` |
| 2026-07-25T13:25:45Z | `project-knowledge` | `repo:jaeyoungkang/lighthouse#issue:497` |

| Cohort | 사용 근거 | 효과 근거 | 판정 | 다음 재검사 |
| --- | --- | --- | --- | --- |
| 위 8개 관측 skill | field-complete 호출 16건 | 세 root의 required output·최종 clean·merge | `insufficient-evidence`; 유지하며 측정 | 한 분기 또는 root 8개 중 먼저 충족 |
| 나머지 10개 skill | frozen cohort의 direct ledger 0건 | 비교 가능한 joined outcome 없음 | `insufficient-evidence`; 빈도 0으로 은퇴 금지 | 한 분기, routing miss, 또는 직접 호출 8건 |
| `contract-map-steward` | #498·#497에서 각 1회 직접 호출 | 기존 Gate Stack map에 감사·CAIR gate 관계 착지 | 기존 4-proxy “완전 무증거” 가정 기각 | 다음 derived-map workstream |

18개 frozen input과 세 overlap pair의 양방향·negative control을 담은 routing
corpus를 추가했다. Audit base는 `e4deb5d7`이고 당시 branch provenance head는
`9d0c5b40`이다. Squash merge 뒤 branch commit 생존을 요구하지 않으며
input·evaluation spec·routing source SHA-256 digest가 authoritative identity다.
저장된 [`skill-routing-evaluation.json`](../../shared-skills/skill-governance-steward/references/skill-routing-evaluation.json)의
`claude-opus-5` opaque inputs/prediction/score와 model/input/prediction seal을
gate가 매번 다시 채점·검증한다. Routing-source digest는 committed local
frontmatter와 external package provenance의 `SKILL.md` SHA-256에서 만든다.
first-route accuracy 18/18,
required-route recall 22/22, allowed-route precision 22/22, forbidden
selection 0, unknown route 0으로 threshold를 통과했다. 이 점수는 frontmatter
discovery와 First-Route arbitration만 증명하며 workflow 준수나 제품 효과를
증명하지 않는다. 평가 inventory는 repo-local 18개와 committed package
provenance로 고정한 external `architecture-fitness-review`를 합친 19개 routable
skill이다.

### Review lens 회수

| Current group | Applied / hit records | 상태 판정 |
| --- | ---: | --- |
| root-cause | 479 / 55 | `active` |
| code | 363 / 109 | `active` |
| load-security | 127 / 24 | `active` |
| overengineering | 335 / 27 | `active` |
| architecture | 430 / 103 | `active` |
| loading-ui | 19 / 2 | `active` |
| async-client | 18 / 0 | `covered` 유지 — 네 entry가 code-03/load-security-02에 이미 흡수됨 |
| observability | 16 / 5 | `active` |
| analytics | 17 / 2 | `active` |
| pagination | 0 / 0 | `active`, `insufficient-evidence`; 미적용을 무가치로 해석하지 않음 |
| layout-constants | 4 / 0 | `covered` 유지 — code-04/architecture-07에 이미 흡수됨 |
| skills-governance | 246 / 31 | `active` |
| story-chain | 144 / 45 | `active` |

Active tail에는 current group이 아닌 과거 label 47회가 별도로 남아 있다.
`quality-gates` 25, `runtime-flow` 8, `security/privacy` 7, `evidence` 2,
`contract`·`UI-style`·`security-boundary`·`korean-prose`·`server-load` 각
1회다. 이 47회는 위 current-group 분모에 합치지 않는다. 앞으로는 checklist의
prospective replacement 규칙에 따라 `quality-gates`를
code+architecture(+필요시 skills-governance), runtime-flow를
architecture(+계약 영향 시 story-chain), security 계열을 load-security,
contract/evidence를 story-chain으로 기록한다. 기존 label은 immutable history로
유지한다.

Active tail에는 current entry로 해석되지 않는 `security/privacy-01` hit도
3건 있다. 위 current-group hit 분자에 합치지 않고 immutable history로
공개한다. 신규 review record는 이 id를 `load-security-03`으로 기록하며
prospective closeout validation이 실재 active entry만 허용한다.

이번 분기의 신규 은퇴는 0개다. Issue #504의 기준 조사와 달리
root-cause tail에서 53개 hit record가 추가되어 저회수 렌즈가 아니며, 0-hit
두 group은 이미 `covered`다. `pagination`은 적용 분모가 없어 판정 근거가
없다. Entry별 hit는 보이더라도 과거 revision의 active-entry application
분모를 재구성하지 않은 상태에서 entry 은퇴율을 만들지 않는다.

전체 structured findings는 valid 336, invalid 62, already-fixed 1,066,
duplicate 42, needs-human 12로 already-fixed/valid는 3.17이다. 이 지표의
구조적 감축 owner는 #411이고 여기서는 추세만 유지한다. Escape 누계는 valid
46, invalid 7, already-fixed 2, duplicate 1이다. Immutable archive의 valid
`entry:none` 5건은 각각 은퇴한 decision-log surface 1건과 line-leading issue
reference/ambiguous heading 4건으로 보존한다. 신규 valid escape는 active/workflow entry 또는
`candidate:<stable-entry-id>`를 의무화하며 covered/retired entry로 닫지 않는다.

Lens audit는 세 모델 role cohort를 동결한다. 현재 prospective model 장부가
한 분기를 채우지 않았으므로 모델별 hit rate는 만들지 않았다. author, review,
verdict model generation 중 하나가 바뀌거나 covering owner가 사라지거나
surface가 복귀하면 `covered`/`retired` 판정을 다시 연다.

### 코드 장인 규칙과 coverage

- `Owned*`는 0-use가 아니다. 기준 head에서
  `OwnedResearchRoutePayload`와 `OwnedCreateResearchRoutePayloadParams`가
  owner identity-bearing route와 viewer projection을 구분한다. Domain-access
  함수 전체의 접두어로 확대하지 않고 domain variant 타입 이름으로
  `maintain`한다.
- `*ForTrustedAgent`와 `*Unchecked`는 각각 trusted capability와 저수준
  repository access를 계속 나타낸다. 세 이름을 한 형태로 강제하는 새 lint는
  만들지 않는다.
- `quality:full`의 coverage도 `vitest.config.mts`의 8-entry include cohort를
  그대로 사용하므로 전역 coverage가 아니다. 현재 cohort와 90–97% 임계는
  `maintain`; 이번 감사에서 expand/retire 0건이다. 범위 확대는 #499의 test
  inventory와 다음 분기 위험·비용 근거를 함께 본다.
- Async Client Component 금지는 installed Next ESLint rule과
  `--max-warnings=0`이 이미 막는다. Server→Client serializable props는
  type/context-dependent라 custom lint를 만들지 않고 intentional prose와
  architecture review로 유지한다. §8 성능 네 원칙도 unconditional invariant가
  아니라 code/load-security/architecture review heuristic으로 유지한다.
- Framework 표준은 installed 공식 docs와 preset의 rule diff를 candidate별로
  심의한다. Architecture 표준은 CAIR, Architecture Fitness,
  dependency-cruiser, review architecture lens의 후보 입력으로만 보내고 별도
  판정 체계를 만들지 않는다.

이번 follow-up은 current-group·hit-entry·valid-escape prospective validation 3개,
routing corpus 18건, First-Route arbitration 3쌍, 공통 분기 intake 절차,
coverage·prose·naming 설명을 추가했다. 신규 blocking `quality:*` alias는
0개지만 `test` job에서 blocking으로 도는 routing corpus 검사 1개를 추가했고,
기존 `review-closeout`의 blocking failure mode는 3개 늘었다. review lens 신규
entry와 은퇴는 각각 0개다. 다음 감사는 2026-10 분기 또는
model generation/covering owner 변경 중 먼저 발생한 시점이다.

Sources:

- [Issues #504](https://github.com/jaeyoungkang/lighthouse/issues/504),
  [#505](https://github.com/jaeyoungkang/lighthouse/issues/505),
  [#506](https://github.com/jaeyoungkang/lighthouse/issues/506)
- [`checklist-usage-log.md`](../../shared-skills/review-checklist-steward/references/checklist-usage-log.md)
- [`skill-routing-corpus.json`](../../shared-skills/skill-governance-steward/references/skill-routing-corpus.json)
- [`skill-routing-evaluation.json`](../../shared-skills/skill-governance-steward/references/skill-routing-evaluation.json)
- [`vitest.config.mts`](../../vitest.config.mts)

## 2026-08-13 구현 시스템 process-effectiveness 1차 감사

이 절은 Issue #616이 설치한 구현 체계의 첫 실전 효과 감사다. 현재 구현 방법의
정본은 `docs/implementation.md`, Architecture Fitness의 `unknown` 의미는
`docs/architecture-fitness/README.md`, 분기 process 감사 절차와 owner verdict 어휘는
`skill-governance-steward`가 소유한다. 이 dated record는 해당 정본을 바꾸지 않는다.

### 표본과 기대 효과

- 기준 head는 `2a5bdd5d729fe203b86714d72b914f4e2660eb03`이다.
- 표본은 Issue #414 / PR #623과 Issue #417 / PR #624다. 둘 다 #616 뒤의 실제
  architecture-impact 작업이며 같은 Gap domain의 고복잡도 표본이다.
- 기대 효과는 구현 전에 필요한 owner를 찾고, 선택된 owner의 obligation과 검증을
  따라 merge 전 결함을 닫으며, 불필요한 classifier나 workflow layer를 만들지 않는
  것이다.
- PR #623과 #624는 각각 네 번째 exact-head review에서 clean이 됐고 현재 기록에
  연결된 merge escape는 없다. 이는 안전한 closeout 관찰이지 #616의 독립 인과 효과
  추정치가 아니다.

### 관찰과 재현 가능한 비용

| 관찰 | Issue #414 / PR #623 | Issue #417 / PR #624 |
| --- | --- | --- |
| 최종 content 범위 | 49 files, +1,689 / -55 | 53 files, +2,281 / -137 |
| 최초 content 뒤 correction | 23 files, +377 / -31 | 21 files, +467 / -50 |
| exact-head review | iteration 4, already-fixed 10 | iteration 4, already-fixed 17 |
| PR 생성부터 merge까지 | 56분 48초 | 1시간 50분 57초 |
| Quality workflow | 5 runs | 5 runs |

두 작업 모두 구현 전에 Mission Control, CAIR, Story Chain, runtime-flow와 관련
owner에 진입했다. Issue #616의 재도입 기준에 해당하는 late route miss는 0건이다.
#417 Early Propagation Scope Review가 구현 전에 Aspect, 두 Promise, API response와
ingress owner를 추가한 `early-caught owner correction`은 1개 workstream이다.
Propagation, correctness, evidence-depth correction은 두 PR 모두에서 발생했다.

PR wall time은 active authoring, Human 대기, review와 machine 실행을 분리하지 않는다.
로컬 실행 시간, iteration별 고유 finding과 false positive, CAIR와 Story Chain overlap
시간도 남아 있지 않다. 같은 domain의 고복잡도 표본만 선택했고 ordinary/no-skill
비교군이 없다.

### 판정과 후속 방향

- Process owner verdict는 `insufficient-evidence`다.
- Evidence capture는 `reconfigure` 후보로 둔다. 현재 guide와 routing corpus는
  유지하며 새 skill, classifier, Architecture Fitness profile, gate는 만들지 않는다.
- 최소 machine router 재도입은 아직 거부한다. Issue #616의 원래 조건인 20~30개
  구현 PR 안에서 owner route 누락이 2~3회 발생하고 gate나 review 단계에서 실질적인
  재작업을 만든 때만 다시 검토한다. 감사에서는 qualifying occurrence 수와 영향을
  받은 distinct PR 수를 함께 보고한다.
- 다음 별도 process 변경에서는 고위험 multi-owner 4개와 ordinary/no-skill 4개가
  쌓이거나 다음 분기가 도래했을 때 중간 감사하는 cadence를 채택 후보로 검토한다.
  20~30개 PR cohort에서는 위 재도입 결합 조건의 충족 여부를 판정하는 기존 방향을
  유지한다. 채택된 절차의 정본은 `skill-governance-steward`다.

후속 감사가 같은 증거 공백을 반복하지 않도록 다음 capture envelope를 제안한다.
이는 현재 required output이나 blocking gate가 아니며, process owner가 별도 변경으로
채택하기 전까지 미기록 값은 `unknown`이다.

| 증거 | 제안 기록 owner와 필드 |
| --- | --- |
| active authoring elapsed | 구현 owner가 durable issue/PR에 start, end, Human 대기·중단 제외 구간과 unknown 사유를 기록한다. |
| machine run time | 실행 owner가 로컬 명령별 wall time과 CI run id를 기록한다. Audit은 GitHub job duration을 재구성하고 병렬 job 합계를 wall time으로 해석하지 않는다. |
| adjacent finding | review owner가 iteration별 고유 finding에 `finding-kind`(`route-miss`, `propagation-miss`, `correctness`, `evidence-depth`, `record-binding`)와 `detection-phase`(`early-scope`, `implementation`, `exact-head`, `CI`, `post-merge`)를 별도로 기록하고 owner와 evidence ref를 남긴다. |
| false positive | review owner가 `invalid` finding의 hypothesis와 rejection evidence를 iteration에 결속한다. 최종 invalid 0을 전체 loop의 0으로 해석하지 않는다. |
| workflow overlap | 구현 owner가 CAIR, Story Chain, runtime, Architecture Fitness 사이에서 같은 내용을 다시 작성하거나 같은 heavy command를 반복한 구간과 elapsed 또는 unknown 사유를 남긴다. |

대표 evidence는 Issue #616과 merge `680d7b64`, Issue #414 / PR #623과 merge
`d73de285`, Issue #417 / PR #624와 merge `2a5bdd5d`, review usage records #623·#624다.
Quality workflow 표본은 PR #623 runs `31565331277`, `31567072335`,
`31567460656`, `31567594125`, `31567819639`와 PR #624 runs `31653014629`,
`31655711010`, `31656631059`, `31657588614`, `31658263600`이다.

## 2026-08-14 구현 시스템 제한 검증 기준 채택

이 결정은 2026-08-13 감사가 제안했던 8-workstream 중간 감사와 20~30 PR
장기 cohort를 대체한다. 현재 절차의 정본은 `skill-governance-steward`의
`Bounded effectiveness decision`이다. 이 dated record는 채택 이유와 시작 상태만
보존한다.

### 검증 집합과 판정

검증 집합은 prospective 표본 네 개로 제한한다. `ordinary-no-skill` 두 개와 서로
다른 owner 형태의 `multi-owner` 두 개를 사용한다. multi-owner 표본 하나는
계약 결정을 UI·API·runtime owner 중 하나 이상으로 전파해야 한다. 다른 하나는
DB 또는 repository 소유권과 operational owner를 함께 건드려야 한다. 네 표본의
결과가 엇갈리거나 비용 비례성을 판단할 수 없을 때만 다섯 번째 표본을 사전에
선택한다. 그 뒤에는 표본을 늘리지 않는다.

현재 완료된 ordinary 표본은 Issue #632 / PR #634와 Issue #636 / PR #637이다.
두 작업은 구현 전에 선택됐고 각각 active authoring 195초와 97초를 기록했다.
둘 다 specialist First Route가 없는 작은 구현이었다. exact-head review와 merge 전
검증을 닫았으며 현재 연결된 post-merge escape는 없다. 이 두 건만으로
multi-owner routing의 효과를 판정하지 않는다.

### 3/4 중간 관찰 — Issue #642 / PR #643

첫 multi-owner 표본은 구현 전에 선택한 Search·Graph hydration target 교체
작업이다. 선택 comment는 Story Chain 의미 보존, UI orchestration, API command
identity, runtime lifecycle, 기존 Evidence Ledger를 계획 owner로 고정했다. 실제
구현은 9개 content 파일, +468/-87줄이었고 merge commit은
`37f28a1c4e2ad42bb72f01cc774c5192ba761349`다.

Qualifying route miss는 0 occurrence / 0 affected PR이다. 네 차례 exact-head
review에서 canonical command identity, target-only mutation evidence, loser-first
finalizer defense, runtime authority propagation과 기록 결속을 포함한 고유 finding
6건을 merge 전에 보정했다. 이 finding은 모두 사전에 선택한
`runtime-flow-sync`, Story Chain evidence, code/runtime review 경로 안에서 발견됐고
다른 specialist route로의 재라우팅이나 design reset을 만들지 않았다. 따라서
현재 관찰은 core route 선택을 지지하지만, final clean이나 finding 수 자체를
효과의 인과 증거로 사용하지 않는다.

비용 관찰은 부분적이다. 초기 구현의 1,233초는 Human·machine wait를 포함한 wall
envelope라 active authoring denominator가 아니다. 이후 correction에서 active
segment 554초를 계측했고, final pre-push는 146초, record-only GitHub Quality는
405초였다. 다른 초기 command와 authoring 구간은 `unknown`으로 남는다. 첫
pre-push의 181초 실패는 같은 content head가 이미 원격에 반영된 뒤 발생한 ref
lock race이며 content defect가 아니었다. Source evidence는 Issue #642의 immutable
selection comment, evolving process-effectiveness block, exact-head usage record와
GitHub Actions run `31766797091`이 소유한다.

현재 제한 검증은 3/4다. 설치된 구현 방법의 Human effectiveness verdict는 아직
내리지 않는다. 남은 표본은 구현 전에 선택할 DB 또는 repository + operational
owner 작업 하나다. 이 표본이 닫힐 때 네 표본의 route miss, post-merge escape,
측정 가능한 비용과 containment 가치를 함께 판정한다.

Sources: [prospective selection](https://github.com/jaeyoungkang/lighthouse/issues/642#issuecomment-5288581386),
[evolving evidence](https://github.com/jaeyoungkang/lighthouse/issues/642#issuecomment-5288583052),
[final exact-head evidence](https://github.com/jaeyoungkang/lighthouse/issues/642#issuecomment-5289049294),
[PR #643](https://github.com/jaeyoungkang/lighthouse/pull/643),
[Quality run 31766797091](https://github.com/jaeyoungkang/lighthouse/actions/runs/31766797091).

Human은 두 ordinary 표본의 불필요한 전문 process 진입이 0이고, 두 multi-owner
표본이 구현 전에 core owner를 모두 찾았으며, late route miss로 인한 실질적인
재설계·재작업과 연결된 post-merge escape가 없을 때 현재 저장소에서의 효과를
판정한다. 마지막으로 측정된 process 비용이 구현과 containment 가치에 비례하는지
판단한다. 이 판정은 저장소 운영 결정이며 통계적 일반화나 독립 인과 효과를
주장하지 않는다.

중대한 route miss나 design reset이 한 번 발생하면 남은 표본을 기다리지 않고
`reconfigure`한다. 제한 검증이 끝난 뒤에는 PR 개수가 아니라 qualifying route miss
발생을 센다. 두 번 발생하면 Human이 routing과 최소 machine router를 다시
검토한다. occurrence 수와 영향을 받은 distinct PR 수를 함께 보고하며 router를
자동으로 재도입하지 않는다.

### 5/5 종료 판정 — `insufficient-evidence`

2026-08-14의 bounded 검증은 허용된 다섯 표본을 모두 사용하고 종료했다. Human
결정은 [Issue #616의 immutable comment](https://github.com/jaeyoungkang/lighthouse/issues/616#issuecomment-5292004287)가
소유한다. 이 절은 그 결정의 dated evidence를 요약하며 현재 절차나 Architecture
Fitness verdict를 바꾸지 않는다.

| 표본 | 유형 | merge | active authoring |
| --- | --- | --- | --- |
| Issue #632 / PR #634 | ordinary-no-skill | `202c6b982dea1b9a09c4590f4e669016cfcb4707` | 195초, complete |
| Issue #636 / PR #637 | ordinary-no-skill | `5e378ae01f7940702581cd0d8116fb7957e98c11` | 97초, complete |
| Issue #642 / PR #643 | contract → UI/API/runtime multi-owner | `37f28a1c4e2ad42bb72f01cc774c5192ba761349` | correction 554초, initial unknown |
| Issue #645 / PR #648 | DB/repository + operational multi-owner | `121ffc6702934ebcc484a43d096e9effe351ffcd` | unknown |
| Issue #649 / PR #650 | 허용된 단일 tie-breaker | `08487ed45b571db8ea77dbece384fb0060151e2a` | 1,237초, complete |

두 ordinary 표본의 불필요한 specialist-process 진입은 0건이다. 필수 multi-owner
표본 둘은 구현 전에 core owner를 식별했다. 다섯 표본의 qualifying late route miss는
`0 occurrences / 0 affected distinct PRs`이며 severe design reset도 0건이다. 현재
연결된 post-merge escape는 0건이지만, 같은 날 병합된 표본이 있어 관찰창은 짧다.

표본 block의 고유 causal finding은 15건이다. correctness 4건,
evidence-depth 4건, propagation-miss 3건, record-binding 4건이며 모두 merge 전에
닫혔다. route-miss는 없다. Finding 수와 exact-head clean은 containment 기록이지
설치된 방법의 독립 인과 효과가 아니다.

Owner verdict는 `insufficient-evidence`다. Ordinary와 tie-breaker의 active authoring,
multi-owner correction 일부는 계측됐지만 Issue #642의 초기 authoring, Issue #645의
active authoring, 각 표본의 machine·review·workflow-overlap 비용 일부는 계속
`partial / unknown`이다. 따라서 현재 방법을 reconfigure하거나 rollback하지 않고
status quo로 유지하되, 비용 비례성이 확인됐다는 `maintain` 효과 판정은 내리지
않는다.

여섯 번째 표본은 추가하지 않는다. 새 router, classifier, skill, Architecture Fitness
profile, gate, registry도 만들지 않는다. Architecture Fitness의 process-effectiveness는
계속 `unsupported / unknown`이다. 이후에는 PR 개수가 아니라 qualifying route-miss
occurrence를 세고, 두 번 발생하면 Human이 routing과 최소 machine router를 다시
검토한다. 이 판정은 Lighthouse 저장소 한정의 운영 결정이며 통계적 일반화나 독립
인과 효과를 주장하지 않는다.

### 후속 Human 정성 비용 판정 — `maintain`

같은 날 Human은 [후속 immutable comment](https://github.com/jaeyoungkang/lighthouse/issues/616#issuecomment-5293213759)에서
측정된 process 비용이 현재 Lighthouse 저장소의 구현 규모와 merge 전 containment
가치에 비례한다고 정성 판단했다. 이에 따라 process owner verdict는 `maintain —
effective for current Lighthouse repository use`로 바뀌었다.

이 결정은 앞선 `insufficient-evidence` 기록을 삭제하거나 누락된 비용을 완전 계측으로
재해석하지 않는다. Issue #642와 #645의 active authoring, machine·review·workflow
overlap 비용 일부는 계속 `partial / unknown`이다. 따라서 이 판정은 저장소 한정의
Human 운영 결정이며 통계적 효과, 독립 인과 효과, 다른 저장소·모델·host에 대한
일반화를 주장하지 않는다.

현재 구현 방법은 유지한다. 여섯 번째 표본이나 새 router, classifier, skill,
Architecture Fitness profile, gate, registry는 추가하지 않는다. Architecture Fitness의
process-effectiveness도 계속 `unsupported / unknown`이다. qualifying route-miss가 두 번
발생하면 Human이 routing과 최소 machine router를 다시 검토한다.

## 2026-08-13 부정형 규칙 lifecycle 기준 감사

이 절은 Issue #625의 일회성 baseline과 분기 회수 근거다. current authoring 규칙은
`docs/principles.md §6`, review 분류는 `review-checklist-steward`
`root-cause-09`, 분기 절차는 `quality-gate-steward`와
`skill-governance-steward`가 소유한다. 이 dated record는 별도 규칙 registry나
release verdict가 아니다.

### Inventory와 검색 경계

- 기준 head는 `0a4ee4fae9f4dcdcd66f8eaebbabe11772080179`이다.
- current-authority discovery root는 `AGENTS.md`, `README.md`, `docs/`,
  `shared-skills/`, `scripts/`, `app/`, `package.json`, `.github/`다.
- `docs/archive/**`, checklist usage log와 이 dated record 자체는 current 의미를
  주장하지 않는 history로 제외했다. Sufficiency Review sidecar는 최신
  verdict-bearing block과 과거 immutable block이 한 파일에 섞이므로 raw prose
  분모에서는 별도로 두고, `mc:validate-story-chain`과 관련 ledger trace가 선택한 최신
  block은 release evidence authority로 의미 검토했다. 과거 block만 history로
  제외한다.
- 정확한 `하지 않는다.` 검색은 604개/128파일, 가까운 금지형 검색은
  859개/165파일이었다. test assertion discovery에서 `not.toMatch`,
  `not.toContain`, `toBeUndefined`는 551개/132파일이었다. 이 수치는 문법적
  discovery 경계일 뿐 rule 수, 품질 KPI, retire 기준이 아니다.
- base를 `git archive 0a4ee4fae9f4dcdcd66f8eaebbabe11772080179`로 빈
  directory에 푼 뒤 아래 명령을 실행한다. 각 결과의 줄 수는 hit 수, 첫 `:` 앞
  경로를 `sort -u`한 수는 파일 수다.

```bash
rg -n -F '하지 않는다.' AGENTS.md README.md docs shared-skills scripts app package.json .github \
  -g '!docs/archive/**' -g '!**/*.reviews.md' \
  -g '!shared-skills/review-checklist-steward/references/checklist-usage-log.md' \
  -g '!docs/contract-maps/quality-gate-records.md'

rg -n '하지 않(는다|고|도록)|하지 말|금지|허용하지 않|시작하지 않|기록하지 않|노출하지 않|포함하지 않|두지 않' \
  AGENTS.md README.md docs shared-skills scripts app package.json .github \
  -g '!docs/archive/**' -g '!**/*.reviews.md' \
  -g '!shared-skills/review-checklist-steward/references/checklist-usage-log.md' \
  -g '!docs/contract-maps/quality-gate-records.md'

rg -n '\.(not\.toMatch|not\.toContain|toBeUndefined)\(' scripts app \
  -g '**/*.test.{ts,tsx,mts,mjs,js,jsx}'
```

### Semantic cluster 판정

| 분류 | current owner와 허용 행동 | 위반 피해와 이번 처리 |
| --- | --- | --- |
| `KEEP` | privacy/schema allowlist, auth·repository·external HTTP capability seam, observer read, source epistemic limit, manual-only mutation workflow가 각 owner에서 허용 입력·side effect를 좁힌다. | query·prompt·principal 유출, 무권한 write/provider 실행, 거짓 scholarly absence, PR마다 mutation cost 발생을 막으므로 유지했다. proxy/auth, analytics payload, gap status observer, provider degraded, mutation workflow negative controls가 대표 표본이다. |
| `SPLIT` | quality config test는 lint/duplicate/path-resolution current behavior와 Architecture Fitness exact-revision compatibility evidence를 함께 갖고 있었다. | config owner를 잘못 읽고 역사 ref를 일반 quality rule처럼 다룰 수 있어 current config test와 Architecture Fitness process evidence로 분리했다. |
| `MOVE` | retired mechanism과 exact revision은 runtime/evidence/history owner가 소유한다. Story Chain의 공통 분류 owner도 Story Chain 전용 entry가 아니라 `root-cause-09` 하나다. | 퇴역 이름이 current Promise나 일반 quality test의 통과 이유가 되는 drift를 막기 위해 exact revision evidence를 Architecture Fitness test로, rail 수치 owner를 design standards로, 공통 분류를 root-cause group으로 옮겼다. |
| `EVIDENCE` | current gate alias, mutation target 목록, route rail, observer/command 경계는 behavior·capability·state evidence가 증명한다. | 문구만 바꾸고 동작은 회귀하는 false defense를 막기 위해 `mc:validate-story-chain` wiring, 현재 mutation slices, route rail 상수, command CAS/runner evidence를 양성 근거로 유지했다. |
| `STALE` | current ledger·target·gate owner가 이미 양성으로 등록돼 있다. | 정확한 retired pilot 문구 2개, 삭제한 `guard:review-archives` 이름 3개, 옛 mutation alias·파일명 4개, 옛 Vite alias/plugin/ignore/config 문자열 9개는 old name/shape만 잠가 semantic drift를 막지 못해 제거했다. 관련 assertion 18개를 제거했고 historical compatibility evidence는 제거하지 않고 owner로 이동했다. |

Story Chain 표본에서는 사용자-visible 두 그래프 축과 같은 읽기 rail이라는 의미를
유지하고 `1080px`와 `px-5` 메커니즘을 Promise truth criterion에서 분리했다. 현재
값과 단일 출처는 `docs/design-standards.md#reading-measure`, exact rail 증거는
covering Evidence Ledger가 소유한다. 검색 결과 카드의 긴 AC도 정상 스캔 순서와
보이는 상태를 먼저 두고, 내부 state 이름과 퇴역 레이아웃 provenance 대신 현재
카드 영역·상태 전환을 기준으로 압축했다. Gap runtime 표본은 status read의 허용
side effect와 recovery/retry command owner를 먼저 쓰도록 재배치했다. Promise id,
AC id, 사용자-visible 결과, runtime 실행 순서와 response policy는 바꾸지 않았다.
생성 prompt의 trust rule presence test는 gateway input wiring 증거로 `KEEP`하되,
actual output 의미 준수는 structured-output fixture와 real-output live judge가 별도로
소유한다고 `aspect:user-facing-language-governance` Verification에 명시했다.

### 재발 방지와 다음 회수

- author는 `docs/principles.md §6`에서 current owner와 허용 행동, concrete
  counterexample, 구조적 방어를 먼저 정한다.
- reviewer는 변경된 current-authority semantic cluster만 `root-cause-09`의
  `KEEP / SPLIT / MOVE / EVIDENCE / STALE`로 분류한다. archive와 dated history는
  current authority를 주장할 때만 다시 연다.
- `quality-gate-steward` 분기 감사는 phrase-presence/absence test와
  behavior/capability/state evidence를 분리해 비용·recovery·false positive를 본다.
  `skill-governance-steward`는 skills의 중복 배제와 owner drift를 같은 분류로
  회수한다.
- 전체 문구 수 감소, zero observed failure, guard 수 증감은 verdict가 아니다. 새
  skill, registry, 문구-count lint, blocking gate는 추가하지 않았다.
- 다음 분기 감사 또는 `root-cause-09` hit가 누적된 시점에 이 검색 경계와 대표
  semantic cluster를 다시 실행한다. current owner coverage, 실제 recovery,
  false-positive, 유지 비용이 바뀌었을 때만 consolidate/move/retire를 다시 판정한다.
