---
type: design
---

# Architecture Fitness consumer integration

Light House는 Contract Architecture Impact Review(CAIR)를 변경 영향 분류의 유일한
정본으로 유지한다. Architecture Fitness는 CAIR가 선택한 구조의 구현 준수와 현재
근거를 검토한다. CAIR의 `none/constrain-existing/reshape`, Architecture Fitness의
`healthy/degraded/unknown`, Human decision, merge eligibility를 합치지 않는다.

Issue #284의 Human process verdict는 `reshape`이다. 이 결정에 따라 외부 core의 실행 가능한
계약만 사용한다. 현재 pinned v0.9.1 core는 least-authority, state-boundary,
serialized-input-budget, topology-scope, critical-path, workload-envelope, technical-grain,
cache-lifecycle case를 지원한다. Lighthouse는
Issue #278의 least-authority, Issue #276의 좁은 keyword-search·relationship state-boundary,
Issue #280의 process topology, Issue #281의 first-ready search critical path, Issue #286의 Q3 launch
workload envelope, Issue #297의 Q4 technical-grain, Issue #298의 좁은 preset-title
cache-lifecycle, Issue #399의 Search-first 조건 URL serialized-input budget을 활성화했다.
Issue #399는 애플리케이션이 받은 `/search`, `/citation`, `/similar` 조건 URL만 판정하며
platform pre-app request-target은 지원하지 않는다. 제품 결과, 일반 확장성, cache fleet,
resilience, process effectiveness를 손으로 만든 check로 대체하지 않는다. 활성 policy가
지원하지 않는 렌즈는
`coverage: unsupported`로 선언하고 `unknown`을 유지한다.

## Lighthouse 출시 검증 순서와 현재 기준

Architecture Fitness는 Lighthouse의 안정적인 출시를 검증하는 수단이다. Core release나
두 번째 consumer 완료가 Lighthouse 출시보다 앞서지 않는다. 2026-07-16에 승인한 순서는
현재 상태 재확정, Q1, Q2, Q3, Q4, Q5, 통합 protected run, production trial이다.
새 요구가 실제로 드러나면 범용 case를 확장하되 각 단계 closeout에서 탐지 가치, 중복,
유지 비용을 다시 보고 불필요한 규칙·복제·검사는 통합하거나 삭제한다.

| 단계 | 현재 authoritative evidence | 다음 완료 조건 |
| --- | --- | --- |
| 현재 상태 | 가장 최근 성공한 authoritative evidence는 [2026-09-01 protected run `33451400087`, attempt 1](https://github.com/corca-ai/lighthouse/actions/runs/33451400087)이다. Protected `main`의 exact target·workflow SHA `118b66dfac55a48e5b73f5c0c676a6aee4a5432b`를 검증했으며, 아래 `2026-09-01 protected rebind evidence`가 event·subject·artifact 결속을 기록한다. 기계 판독 가능한 신선도 상태와 100커밋 budget의 정본은 `scripts/quality/lane-freshness.json`이고 `guard:lane-freshness`가 매 PR에서 blocking 검사한다. | staleness가 budget 100커밋을 넘기 전에 운영자가 protected main에서 attestation을 수동 실행하고, 성공한 run provenance를 이 문서에 기록한 뒤 exact target SHA로 `lastTargetSha`를 갱신한다. |
| Q1 | PR #337 run `29519396245`에서 exact target `b44105abf117666f317a89ac8fc4e8e9adfb16c8`의 keyword-search와 relationship state-boundary가 모두 `verified`·`healthy`; 제품 outcome은 `unknown` | 완료. Q2 이후 비용·중복 감사에서 유지·통합·삭제를 재판정 |
| Q2 | 지원 case: PR #340 run `29533199484`의 exact target `b9f8b8431e913f2cf5d4a69555ce02df02fa9359`에서 process topology와 first-ready critical path가 각각 `verified`·`healthy`, reviewed-paper owner-read 하위 case도 protected `healthy`; 미지원 coverage: fleet hard cap·production latency·process effectiveness는 `unknown` | 지원 case 완료. Fleet/provider와 production evidence는 Q3·production trial에서 별도로 닫고 Q2 aggregate 점수는 만들지 않음 |
| Q3 | PR #361 final run `29554384006`의 exact target `ba13b7be49ec13449c568bb89e7b109b94060aaa`에서 workload case와 launch coverage가 `verified`·`healthy`, merge advisory가 `allow`다. Cold u20 20/20·p95 2,907.2ms, sustained-open 1/s·60초 60/60·p95 835.4ms, controlled u2 2/2·provider 4/4가 v5 complete evidence에 결속됐다. 2/s·60초 119/120 두 번은 launch envelope 밖 `excluded`, production fleet·p99/5xx·DB pool·real-provider attribution은 `unsupported / unknown`이다. | 지원 case 완료. Production unknown은 local evidence로 추정하지 않고 마지막 production trial에서 출시 판단에 필요한 수준으로 닫음 |
| Q4 | PR #366 final run `29569113430`이 exact target `64eb5ef8c3b527c1f2e4ad25a1b20834e3f65134`의 네 seam·두 contract trace·12개 evidence를 `verified`·`healthy`로 판정했고 merge advisory는 `allow`다. Dynamic effect, 순수 mechanism-only 미래 locality, production background lifetime, process effectiveness는 `unsupported / unknown`이다. | 지원 case 완료. 미지원 runtime lens는 구체적인 변경·incident가 생길 때만 재진입한다. Process owner의 bounded Human 결정은 별도 기록을 따르며 Architecture Fitness coverage를 승격하지 않는다. |
| Q5 | PR #372 run `29584588648`이 exact target `b4371af77c75825462759e38d8c0d74a43a57ce2`의 preset-title cache source·key·TTL·LRU·failure·process single-flight·caller-abort isolation을 `verified`·`healthy`로 판정했고 merge advisory는 `allow`다. Signed artifact ID는 `8408730525`, archive digest는 `0561f207a48ef7cd0194b649570ba30e1fac0b693088af61aef43cf89929df0b`다. Reviewed-papers/inline-analysis fleet, cleanup 효과, production cache 관측, process effectiveness는 `unsupported / unknown`으로 보존됐다. | 지원 case 완료. Fleet·cleanup·production unknown은 #321, #319와 production trial에서 별도 유지 |
| 출시 | 현재 Q1–Q5 deterministic supported case는 exact-head protected bundle에서 허용됐고 production도 현재 main과 일치한다. 2026-07-18 인증 production 검색은 논문 79편을 1,861ms에 반환했다. 핵심·보조 Episteme 호출은 모두 200이었고 재시도와 load shed는 없었다. | 비공개 소수 코호트 controlled trial은 조건부 허용한다. 공개 확대 전에는 canonical host, 주간 production SLO, DB pool, cache·fleet unknown을 다시 판정한다. |

### 2026-09-01 protected rebind evidence

Architecture Fitness Attestation run `33451400087`, attempt `1`은
`workflow_dispatch`로 protected `main`에서 실행되어 `success`로 끝났다. Run head,
workflow SHA, exact target revision은 모두
`118b66dfac55a48e5b73f5c0c676a6aee4a5432b`이고 subject의 PR 번호는 `0`이다.
Workflow ref는
`corca-ai/lighthouse/.github/workflows/architecture-fitness-attestation.yml@refs/heads/main`이다.

최종 signed evidence artifact는 ID `9780034641`, archive digest
`sha256:6b35c1b8bfba9e130d0b768f60b9e9c5580bed85ef64da20c2019d164cc6a7d9`이며,
artifact 안의 아홉 `verification.json`은 모두 `verified`다. Bundle provenance가
결속한 raw artifact는 다음 세 개다.

- Q4 raw: ID `9780004425`, digest
  `6fd85ca1e6918e9e9522a0ac8e07604a38c15b8fd46c818af8e2e118f6aa7a96`
- Q1–Q4 profile raw: ID `9780007840`, digest
  `396f60a0dacb83d543dca3648263b86218e451e1068f8a151c3e58dfc731de8b`
- Q5 combined raw: ID `9780028352`, digest
  `4fdddbfd29001f137465ffecda9a4e4df6cf14944b73332724dbe92855edbfd0`

이 rebind는 Architecture Fitness 수동 lane의 freshness만 갱신한다. Search-quality
bounded-live set·threshold·release authority를 승인하거나 Service Policy Coverage Matrix
rows 52–54를 해제하지 않는다. 해당 제품 출시 blocker는 open Issue #722가 계속 소유한다.

이전 최신 기준은 2026-08-15 run `31884551011`, target
`fd924abe08e982484f831a3f0939552393f875d9`였다. 같은 날 앞선 run `31856026425`는
issue-276 collector definition digest 불일치로 서명 전에 실패했고, PR #661이
정책·checked observation을 재결속하고 digest 회귀 검사를 전 protected profile로 확장해
복구했다. 이어진 run `31857826958`이 target `f5c6943e`에서 처음 성공했으며,
`31884551011`은 budget 초과 전에 실행한 예방적 갱신이었다. 마지막으로 상세 기록된
2026-08-05 protected run `30976178687`, exact target `cc56558b`의 서명 bundle·verdict는
[issue #275의 2026-08-05 동기화](https://github.com/corca-ai/lighthouse/issues/275)가
소유한다.

### 2026-07-17 Q1–Q5 통합 비용·가치 감사

최종 signed bundle은 일곱 profile, 아홉 case, 35개 coverage verdict를 담는다. 지원 case는
여덟 개 `healthy`, 원래 #278 broad case 하나는 `unknown`이다. Coverage는 일곱 개
`healthy`, 미지원 28개 `unknown`이다. 모든 profile의 signature는 `verified`이고 merge
advisory는 `allow`다. 이 숫자는 지원 범위가 초기 두 case보다 넓어졌다는 뜻이지, 미지원
production·fleet·제품 outcome까지 합격했다는 뜻은 아니다.

| 단계 | 고유한 출시 판단 또는 제품 효과 | 통합 감사 판정 |
| --- | --- | --- |
| Q1 | URL 정본과 route-owned ephemeral carrier를 exact 경계로 고정했다. Review에서 relative owner·aliased helper·shared identity 결속 우회를 닫았지만 새 production blocker는 없었다. | 출시까지 유지. Keyword/relationship collector 공통 materialization은 출시 후 통합 후보 |
| Q2 | Process-local 보호와 first-ready await/failure 축을 분리했다. Generic core의 잘못된 subset 제약과 evidence trust 결함은 고쳤지만 Lighthouse runtime 변경은 없었다. | 출시까지 유지. 별도 aggregate score나 topology 추측은 추가하지 않음 |
| Q3 | Cold u20, sustained 1/s, controlled provider 증거가 active 8·queue 12의 소규모 cohort 결정을 직접 뒷받침했다. Production fleet·p99·5xx는 닫지 못했다. | 가장 높은 출시 판단 가치. Versioned report와 negative guard 유지 |
| Q4 | 두 disconnected wrapper를 삭제하고 OpenAI acquisition guard와 Moonlight whole-operation deadline owner를 보강했다. 네 seam과 두 propagation trace만 machine 범위다. | 제품 정리 가치가 확인돼 유지. Dynamic runtime lens는 incident 전까지 확장하지 않음 |
| Q5 | #320의 bounded TTL·LRU·single-flight·caller abort 경계를 재검증했다. 첫 protected 실행의 artifact layout 결함은 PR #371로 고쳤다. Fleet·cleanup·production cache 효과는 미지원이다. | 좁은 included case만 유지. Shared-cache/fleet case는 #319·#321 evidence가 생길 때 재진입 |

비용은 높다. 감사 직전 Architecture Fitness 정본은 docs 15,049행, consumer
scripts 17,600행, shared generic skill 9,868행, protected workflow 416행으로 42,933행이다.
두 generated skill copy 19,738행을 포함한 물리량은 62,671행이다. PR #335 baseline 이후
정본 증분은 17,435행이고, 전체 repository 물리 diff는 161 files, +29,025/-431이다.
2026-07-17 protected workflow는 45회 실행돼 success 34, failure 6, cancelled 5였고 실행별
wall time 합은 7.26시간이다. Final run은 Q5 target 47초, 통합 collect 10분 26초,
attest/verify 58초, 전체 11분 31초였다. Protected machine verdict의 확인된 false positive는
0건이지만, Q1–Q5 branch review에는 invalid 5건과 duplicate 5건이 있었다.

따라서 generic 확장은 동결하지 않되 새 case는 구체적인 제품 요구, 고유 출시 결정, 재진입
trigger를 먼저 가져야 한다. 현재 profile은 Lighthouse 출시까지 유지하고 protected 서명
workflow는 non-draft/ready exact head에서만 실행한다. Draft push에서는 로컬 unsigned advisory와
관련 quality gate를 사용한다. 같은 PR의 이전 protected run은 자동 취소한다. Aggregate 점수,
새 required check, 미지원 lens의 추정 verdict는 추가하지 않는다. Generated copy와 collector
boilerplate 통합은 agent-process 정본을 바꾸므로 별도 process session에서 다룬다.
PR #375의 첫 draft head `4d7edf5512dc4c5eaaadc4ace8af7ce633f6250d`에서 run
`29588610913`의 `collect`, `collect_q5`, `attest-and-verify`가 모두 `skipped`되어 draft
cadence가 collector-authority workflow에서도 동작함을 확인했다. 같은 PR을 `ready_for_review`로
전환할 때 한 번의 exact-head protected run을 별도로 확인한다.

### Issue #451 portable package 축소 결정

Issue #451에서는 외부 core를 npm registry나 Git submodule에서 직접 받지 않고, upstream이
만드는 exact-revision portable `.skill` archive 하나를 저장소에 고정한다. npm registry에는
`@corca/architecture-fitness` 패키지가 없고 upstream repository는 private이다. 직접 의존하면
일반 `npm ci`와 secretless collector에 별도 repository credential이 필요하다. Submodule도
같은 credential과 checkout 실패 지점을 추가하면서 unpacked source tree를 계속 노출한다.

Lighthouse는 `shared-skills/architecture-fitness-review.skill`과 provenance만 commit한다.
`postinstall`이 archive를 `.agents/skills/architecture-fitness-review/`와
`.claude/skills/architecture-fitness-review/`에 설치한다. Local adapter와 protected workflow는
설치된 `.agents` copy의 Python core를 실행한다. `guard:skills`는 archive SHA-256, unpacked tree,
per-file hash, package version, source revision과 두 generated copy를 함께 확인한다. 따라서
private source checkout이나 adjacent-tree drift 없이 같은 core를 재현한다.

이 결정은 Lighthouse 전용 profile, policy, collector, trust adapter와 protected workflow를
유지한다. 제거 대상은 49파일 9,868행의 중복 unpacked core와 source checkout importer이다.
향후 immutable package가 registry에 발행되고 secretless `npm ci`에서 받을 수 있게 되면,
같은 generated runtime 경계를 package-lock dependency로 바꾼다. 그 전에는 credential을
추가하지 않는다.

2026-07-19부터 full local recollection은 기본 closeout에서 제외한다. Policy, collector,
adapter, profile, checked observation, pinned core, trust 또는 evaluation 의미가 바뀐 작업만
`architecture-fitness:advisory`나 `architecture-fitness:validate` 중 하나를 한 실행 owner가
수행한다. 일반 제품 변경은 `quality:guards`에 포함된 least-authority·state-boundary guard와
영향받은 대표 negative/positive test로 PR을 막고, heavy attestation은 운영자가 승인한
protected-main batch rebind에서만 실행한다. 기록 전용 변경은 full recollection을 실행하지 않는다.

Protected-main exact rebind는 이미 보호된 main의 target workflow·collector를 authority로
사용한다. Target의 first parent는 비교 baseline일 뿐이며, 이전 main collector와의 identity
일치를 bootstrap 선행조건으로 요구하지 않는다. 따라서 collector·policy·adapter·workflow
변경을 위해 별도 bootstrap PR이나 manifest를 만들지 않는다. 변경은 일반 PR의 fast guard와
review closeout을 통과해 먼저 보호된 main에 들어가고, 이후 operator-requested rebind가 exact
target 자체의 workflow SHA·collector·policy로 evidence를 수집하고 검증한다.

일반 exact base/target collection은 profile별로 병렬 실행하되 각 profile 안에서는 base
수집 후 target 수집 순서를 유지한다. 각 profile은 complete·exit-zero·reproducible observation과
canonical schema를 자기 runner에서 검증한 뒤에만 14일 raw input artifact를 봉인한다. Partial
또는 failed observation은 같은 runner의 3일 diagnostic으로 보존하고 matrix를 실패시킨다.
이미 시작했거나 대기 중인 sibling profile은 끝까지 실행해 각 profile의 진단 artifact를
보존한다. 후속 aggregate `collect`는 전체 matrix가 성공했을 때만 설치·Q4·Q5 base collection을
시작한다. 어느 background process라도 실패하면 전체 publication을 중단한다.
`resolve` job은 workflow SHA와 exact protected-main target SHA가 같은지 확인하고 target의
first parent를 baseline으로 고정한다. 이 authority 확인이 실패하면 profile matrix와 Q5 target
lane을 시작하지 않는다.

2026-07-18 KST의 낮은 강도 production trial은 실제 로그인 세션으로 실행했다. 검색은
논문 79편을 반환했고 server `search-timing.totalMs`는 1,861ms였다. Episteme `/search`,
`/graph/paper-neighborhood`, `/papers/batch` 호출은 모두 200이었다. Provider duration은
529~766ms였고 queue wait는 0~1ms였다. 재시도와 load shed는 없었으며 circuit은
`CLOSED`를 유지했다. 후속 term discovery, route AI comment, inline analysis도 모두 200이었다.
30분 관측 범위의 5xx는 없었다.

이 단일 trial은 비공개 소수 코호트를 시작할 근거에는 포함한다. 주간 p99·5xx, Supabase
pool p95, cache fill·heap, canonical Vercel peak instance, overlapping provider work는
계속 `unsupported / unknown`이다. 서로 다른 `runtimeInstanceId` 두 개가 순차 요청에서
관측됐지만 fleet peak나 동시 포화를 증명하지 않는다. #319의 2026-07-31 이후 cleanup과
이슈 #321의 실제 multi-instance failure evidence도 현재 trial을 즉시 차단하지 않는다. Production에서
동시 runtime 포화나 cache/provider trigger가 열리면 재진입한다. Episteme가 2026년 8월 초까지
내부 정비 중인 기간에는 timeout·5xx·latency를 Lighthouse regression과 자동 합산하지 않고
deployment·runtime·provider window별로 분리한다.

2026-07-18 Human은 `scholar.themoonlight.io`를 production canonical host로 확정했다.
`search.themoonlight.io`는 path와 query를 보존해 정본 host로 영구 이동하는 compatibility
ingress다. 이 결정의 구조적 경계와 PKCE 전환은
`docs/runtime-flows/search-mechanism.md#contract-architecture-impact-review`가 소유한다.
host 수렴 여부는 deterministic Next config evidence와 production Vercel·Supabase readback으로
닫으며, Architecture Fitness의 지원되지 않는 topology·auth lens를 임의의 machine verdict로
바꾸지 않는다.

과거 `6/20 ready-with-papers` 결과는 active 2와 queue 4의 이전 admission 경계를 설명하는
역사 evidence다. 현재 기본 설정이나 배포 상태를 나타내지 않는다. 최신 4/16 u20은
readiness 20/20을 회복했지만 p95 3초를 넘었고, 8/12 후보는 3회 모두 현재 local u20 gate를
통과했다. 코드 기본값 exact revision도 burst u20 3/3과 sustained 1/s를 통과했다. 다만
2/s에서 반복된 provider final timeout은 승인된 launch envelope 밖 `excluded`로 보존한다.
Workload/amplification의 지원 case는 protected `healthy`로 완료됐지만, production fleet evidence가
없으므로 Lighthouse 출시 판정은 아직 닫지 않는다.

## 외부 skill provenance

| 항목 | 값 |
| --- | --- |
| Source repository | `https://github.com/jaeyoung2026/architecture-fitness.git` |
| Package version | `0.9.1` |
| Source revision | `6518ce21f0f755f85331ba7a8813772e4a43d51b` |
| Pinned source artifact | `skills/architecture-fitness-review` |
| Committed package | `shared-skills/architecture-fitness-review.skill` |
| Package archive SHA-256 | `5696006c5feb307211a6de25aaf892b8b7991302e52055e7dc8645ad488a61cf` |
| Artifact tree SHA-256 | `408d008b26054cd017fe7542d8ebe4c08cd6ce10c3a4ca88b6208013b6d24ab8` |
| Provenance manifest | `shared-skills/architecture-fitness-review.provenance.json` |

Committed package는 외부 관리 대상이다. Archive나 generated runtime copy를 직접 편집하지
않는다. 새 package는 clean exact upstream revision에서 upstream build와 package smoke를
통과한 뒤 교체한다. Provenance의 package version, source revision, archive digest, tree
digest와 per-file hash를 같은 변경에서 갱신한다.

```bash
cd ../architecture-fitness
python3 scripts/build-skill.py
python3 scripts/package-smoke.py
# exact archive와 provenance를 Lighthouse 변경에 반영한 뒤
python3 scripts/sync-agent-skills.py --prune
npm run guard:skills
```

Light House는 외부 core의 schema나 verdict 계산을 복제하지 않는다. Registry package로
전환할 때도 package-lock integrity와 installed runtime tree 검증을 유지한다.

## v0.9.1 consumer contract

Light House는 policy, observation, attestation을 분리한다.

| 역할 | 소유 파일 또는 경계 |
| --- | --- |
| 활성 profile과 merge policy | `scripts/architecture-fitness/lighthouse-profiles.mjs` |
| Service-wide coverage projection | `service-coverage.projection.json`, `scripts/architecture-fitness/coverage-projection.mjs` — #275 Human registry를 복제하지 않고 decision slice와 active profile/policy case를 연결 |
| Least-authority policy / collector | `pilots/issue-278.policy.json`, `scripts/architecture-fitness/collect-least-authority.mjs` |
| Keyword state-boundary policy / collector | `pilots/issue-276.policy.json`, `scripts/architecture-fitness/collect-search-state-boundary.mjs` |
| Relationship state-boundary policy / collector | `pilots/issue-276-relationship.policy.json`, `scripts/architecture-fitness/collect-relationship-state-boundary.mjs` |
| Q2 topology·critical-path policy / collector | `pilots/issue-280-281.policy.json`, `scripts/architecture-fitness/collect-q2-macro.mjs` — 한 behavior suite를 공유하지만 두 case verdict는 독립 |
| Q3 workload policy / collector | `pilots/issue-286-q3-workload.policy.json`, `scripts/architecture-fitness/collect-q3-workload.mjs` — burst·sustained·controlled-provider 시나리오를 한 case에서 각각 판정 |
| Q4 technical-grain policy / collector | `pilots/issue-297-q4-technical-grain.policy.json`, `scripts/architecture-fitness/collect-q4-technical-grain.mjs` — Human 승인 seam과 bounded contract propagation만 판정 |
| Q4 Human decision / inventory | `issue-297-q4-technical-grain.md` — approved `keep` 경계, bounded hardening, machine scope 밖 Human 판단을 소유 |
| Q5 cache-lifecycle policy / collector | `pilots/issue-298-q5-cache-lifecycle.policy.json`, `scripts/architecture-fitness/collect-q5-cache-lifecycle.mjs` — preset-title process-local lifecycle과 same-id concurrent fill만 판정 |
| Q5 Human decision / inventory | `q5-cache-policy.md` — 전체 cache inventory, fleet·cleanup·production evidence 경계와 Human 판단을 소유 |
| Search-first URL budget policy / collector | `pilots/issue-399-serialized-input-budget.policy.json`, `scripts/architecture-fitness/collect-search-condition-url-budget.mjs` — 다섯 조건 URL envelope의 production serializer·UTF-8 byte budget·reject-before-provider/identity만 판정 |
| Gap artifact/viewer state policy / collector | `pilots/issue-401-gap-shared-state.policy.json`, `scripts/architecture-fitness/collect-gap-shared-state-boundary.mjs` — creator-less artifact와 viewer preference identity, destination handoff, retired owner alias 거부만 판정 |
| Inline-analysis cache policy / collector | `pilots/issue-401-inline-analysis-cache-lifecycle.policy.json`, `scripts/architecture-fitness/collect-inline-analysis-cache-lifecycle.mjs` — exact source/version/fingerprint, ready-only hit, DB claim, subscriber isolation과 explicit-retry failure fence만 판정 |
| Q2·Q3 Human-review evidence boundary | `issue-280-281-286-q2-q3-evidence.md` — Q2 static·behavior contract와 Q3 runtime·workload inventory를 분리하며 production timing을 machine verdict로 바꾸지 않음 |
| Checked-in raw observations | `pilots/baselines/issue-278.observation.json`, `pilots/issue-278.observation.json`, `pilots/issue-276.observation.json`, `pilots/issue-276-relationship.observation.json`, `pilots/issue-280-281.observation.json`, `pilots/issue-286-q3-workload.observation.json`, `pilots/issue-297-q4-technical-grain.observation.json`, `pilots/issue-298-q5-cache-lifecycle.observation.json`, `pilots/issue-399-serialized-input-budget.observation.json`, `pilots/issue-401-gap-shared-state.observation.json`, `pilots/issue-401-inline-analysis-cache-lifecycle.observation.json` |
| Unsigned deterministic evaluation | pinned v0.9.1 `evaluate.py` |
| Authoritative host gate | `.github/workflows/architecture-fitness-attestation.yml` |
| Invocation verifier와 bundle orchestration | `scripts/architecture-fitness/authoritative-attestation.mjs` |
| 서명·평가·비교 semantics | pinned v0.9.1 `attest.py`, `evaluate.py`, `compare.py` |
| LLM candidate validation | `*.candidates.json`, pinned `validate_candidates.py` |
| Merge advisory | `scripts/architecture-fitness/merge-advisory.mjs` |
| Held-out mutation corpus / runner | `pilots/held-out/corpus.json`, `scripts/architecture-fitness/run-held-out-corpus.mjs` |

### Issue #401 service-wide coverage projection

`service-coverage.projection.json`은 #275의 Human status, rationale, implementation state나
Architecture Fitness verdict를 복제하지 않는다. Atomic projection row는 decision과 authority,
invariant ref, owner, case kind, `included / unsupported / excluded / authority-missing`, evidence와
재진입 조건만 소유한다. `included` row만 active profile의 policy coverage와 case에 결속된다.
하나의 executable case가 함께 검증하는 분리 불가능한 결정은 `ownedDecisionRefs`로 직접
열거한다. `relatedDecisionRefs`는 required decision coverage로 계산하지 않는다. #275 승인
comment는 registry 판정과 policy compatibility의 ratification일 뿐 service-wide 분류 전체의
Human 승인으로 확장하지 않는다.

Validator는 projection ref와 case binding 중복, 고아 active profile·policy case, 존재하지 않는
policy coverage, authority가 없는 included row, non-included row의 executable binding을 거부한다.
필수 decision set은 projection 바깥의 executable mapping에 decision별 허용 projection ref,
disposition, case kind까지 고정한다. 목록과 row의 동시 삭제뿐 아니라 무관한 row로 decision ref를
옮기는 것도 거부한다. Local invariant/evidence/legacy ref는 exact tree에 실제로 존재해야 하며,
퇴역 자료는 commit-pinned GitHub ref로만 남긴다.
기존 `architecture-fitness:validate`, `architecture-fitness:advisory`와 protected exact-main
workflow가 같은 validator를 사용한다. Protected artifact에는 분류별 projection ref와 projection
digest를 `service-coverage-summary.json`으로 넣고, case verdict는 기존 독립 signed profile
bundle에 그대로 둔다. 종합 health, 평균 점수, 별도 merge verdict나 새 required check는 만들지
않는다.

Route-AI visible-basis slice는 Human authority가 있으므로 `authority-missing`이 아니라
`unsupported / unknown`이다. Current callback carrier가 canonical reference에서 selector,
object, parameter로 전달되므로 complete negative inventory를 증명하지 못했고, cycle 1·2 구현은
퇴역했다. 새 carrier-edge authority나 runtime reshape, 지원되는 semantic evidence contract가
생길 때만 재진입한다. Gap shared artifact/viewer와 inline-analysis deterministic cache lifecycle은
독립 profile이다. Gap build topology·serialized body policy, inline-analysis fleet·cleanup과
production outcome은 각 projection row의 `unsupported / excluded / authority-missing` 경계를
유지한다.

### Issue #459 Q3 protected publication 중지

Q3 workload profile은 로컬 활성 profile과 checked-in historical observation으로 유지한다.
하지만 retained workload report가 현재 revision과 결속되지 않아, Q3와 무관한 변경에서도
exact-head collector가 `partial`을 만들고 protected publication 전체를 실패시켰다. Base와
target이 같은 여덟 개 unavailable evidence를 내는 경우에도 partial을 complete로 바꾸거나
과거 `healthy`를 현재 head로 이월하지 않는다.

`PROTECTED_PUBLICATION_EXCLUSIONS`가 Q3를 `suspended`, coverage를 `unsupported`, verdict를
`unknown`으로 선언한다. Protected exact-main workflow는
`listProtectedArchitectureFitnessProfiles()`만 사용한다. Signed bundle 요약은 이 누락을
명시하며 Q3의 현재 authoritative verdict를 만들지 않는다. 로컬
`architecture-fitness:advisory`와 `architecture-fitness:validate`는 Q3 policy·collector·fixture의
회귀 검증을 계속 수행한다.

재활성화는 Issue #286이 다음 조건을 모두 충족한 별도 exact-head 변경으로 한다.

1. 현재 revision에서 complete observation을 재현한다.
2. 무관한 다음 revision마다 Human-reviewed compatibility tuple을 추가하지 않아도 되는
   relevance 또는 측정 결속 방식을 갖춘다.
3. partial publication 거부와 unsupported `unknown` 보존을 negative test로 유지한다.
4. Human이 protected publication 재진입을 명시적으로 승인한다.

#### Contract Architecture Impact Review

- 판정: `constrain-existing`. Q3 policy·collector·과거 evidence의 소유권은 유지하고 protected
  publication membership만 기존 profile registry가 소유한다.
- 선택 owner: `lighthouse-profiles.mjs`의 protected publication selection과 collector-authority
  attestation workflow다.
- 거부 대안: 동일한 partial을 compatibility로 통과시키는 방식은 failed evidence를
  publication하는 false-green이 된다. 매 PR마다 Q3 guarded-tree tuple을 추가하는 방식은
  무관한 변경을 Q3 Human review에 결합하고 같은 CI 실패를 재생산한다.
- 구조적 방어: machine-readable exclusion, workflow 부재 assertion, protected policy 목록
  assertion, `unsupported / unknown` summary와 명시적 재진입 조건을 함께 둔다.

Policy는 case별 허용 authority·carrier·identity 또는 least-authority 경계, 필수 enforcement,
collector authority와 collector definition digest를 소유한다. Collector는 exact Git revision을
임시 트리에 펼친다. Least-authority profile은 bound production AST guard와 auth-boundary
Vitest를 실행한다. Exact-revision path test는 collector-authority의 설치 dependency,
`path-vitest.config.mts`, setup을 명시적으로 사용하고 target revision은 source/test input으로만
둔다. 따라서 least-authority `87877a1a`, keyword state `aa4f0b49`, relationship state
`bb7e361a`의 과거 root Vitest config가 import한 `vite-tsconfig-paths`는 더 이상 실행 dependency가
아니다. Q4 technical-grain checked fixture는 definition-integrity drift를 복구한
`b9ba8c42` revision을 유지한다. 이후 trusted source-policy test가 바뀌어 드러난 policy
결속 drift는 current collector definition과 policy digest를 다시 맞추고 process unit test로
직접 검증한다. Q2 macro profile은 현재 검색 snapshot이 retired personalization basis를 더는
쓰지 않도록 바뀐 trusted harness를 policy 의미 변경 없이 반영해 `d3365127` revision으로
재기준화했다. Serialized-input profile도 같은 revision에서 legacy basis URL을 통합 기본
projection으로 정규화한 production serializer를 다시 수집했고, 같은 collector-authority
path-test harness를 사용한다. `2026-08-27`에는 inline-analysis effect owner를
`background-inline-analysis.ts`로 옮기며 route-renderer trusted harness의 import만 바뀌었다.
URL budget 의미는 유지한 채 해당 harness를 포함하는 exact revision `3f6cf311`로 checked
fixture를 다시 결속했다. 두
state-boundary profile은
materialized revision에 compiler root를 고정한
TypeScript symbol·AST로 URL condition authority, server input projection, route-owned snapshot
lifetime, canonical ephemeral view identity의 실제 owner를 찾는다. Keyword profile은 URL query의 deterministic
standard Array·Set dependency, first-parameter normalizer와 facet normalizer, exact carrier를 고정한다. Store capability escape,
symbol alias를 포함한 reflection·`Object.assign` 우회 쓰기, 가변 identity prefix를 거부하며 collector-owned
hostile-environment identity fixture, production execution test, negative mutation suite를 실행한다.
Relationship profile은 citation/similar seed normalization과 두 execution owner, citation/graph-neighbor
identity와 route-kind prefix를 고정하고 shared search guard의 SHA-256 identity·route-store 수명
검사를 재사용한다.
각 profile은 core schema가 요구하는 static/test evidence role을 분리해 기록한다.
각 evidence에는 revision, run ref, command exit, artifact digest, target ref가 들어간다.

Raw observation에는 schema 검증을 위한 서명 자리만 있으며 유효한 signature를 저장하지
않는다. Baseline과 수정 revision은 서로 다른 deterministic fixture run ref를 사용하지만 둘 다
unsigned이다. 서명된 observation, assessment, comparison은 repository에 commit하지 않고
protected workflow run의 immutable artifact에만 보존한다.

### 기록 수명

Architecture Fitness 기록의 수명은 GitHub issue의 open/closed 상태가 아니라 현재
consumer authority에 묶인다. `lighthouse-profiles.mjs`에 등록된 active profile의
policy와 checked-in raw observation은 profile이 active인 동안 유지한다. Policy의
`source`가 가리키는 Human decision 또는 evidence 문서도 같은 기간 유지한다. 닫힌
이슈 번호를 사용하는 profile도 active일 수 있으므로 이슈 종료만으로 해당 파일을
삭제하지 않는다.

Profile을 은퇴할 때는 registry, workflow publication, policy, observation, 직접 소유한
Human evidence source를 같은 변경에서 정리한다. Baseline과 held-out fixture는 현재
collector 또는 test가 직접 참조할 때만 유지한다. 제거한 기록의 역사 권위는 별도
archive 사본이 아니라 Git history다.

`*.change.json`은 작업 중 Architecture Fitness impact advisory에 넣는 선언이다. 작업이
끝나면 durable CAIR record가 owning 문서에 남았거나 `none` 근거가 issue 또는 PR
history에 남았는지 확인하고 active tree에서 제거한다. 완료된 선언을
`docs/archive/`로 옮기지 않는다.

Protected workflow artifact는 workflow가 수명을 집행한다. 실패 diagnostic은 3일,
서명 전 raw input은 14일, signed bundle은 90일 보존한다. Protected publication은
issue 상태가 아니라 active profile registry를 사용한다. 이 값이나 publication
대상을 바꾸면 workflow와 `architecture-fitness-process` test를 함께 갱신한다.

## 실행과 신뢰 경계

공개 계약과 checked-in raw observation은 secret 없이 검증할 수 있다.

```bash
npm run architecture-fitness:advisory
npm run architecture-fitness:verdict
```

두 명령은 활성 profile의 exact-revision observation을 한 번 다시 수집한다. Checked-in
artifact와 byte 단위로 비교하고 schema를 검증한 뒤 unsigned evaluation까지 실행한다.
`architecture-fitness:advisory`는 기존 `--check` assertion 의미를 보존한다. 즉 재수집
artifact가 checked-in artifact와 일치하고 선언된 unsigned advisory가 재현되면 verdict가
`unknown`이거나 merge advisory가 `block`이어도 종료 코드 `0`이다.
`architecture-fitness:verdict`는 같은 assertion을 통과한 뒤 core evaluator의 verdict 종료
코드를 전달한다. 모든 scope가 `healthy`면 `0`, 입력이나 schema가 유효하지 않으면 `1`,
하나라도 `degraded`이면 `2`, `degraded` 없이 하나라도 `unknown`이면 `3`이다. 자동화에서
Architecture Fitness verdict 자체로 분기해야 할 때만 이 명령을 사용한다.
`architecture-fitness:validate`는 evaluation이 필요 없는 validation-only 경로지만 같은
고정 observation 집합을 다시 수집하므로 저비용 기본 경로가 아니다. 같은 closeout에서 두
수집 명령을 연속 실행하지 않는다. 이 세 경로는 같은 observation을 각각 다시 수집한다.
`quality:fast`까지 필요한 전체 로컬 closeout은 한 실행 owner가
`npm run quality:fast`와 advisory를 직렬로 실행한다. 일회성 조합을 위한 별도
quality profile은 두지 않는다.

Freshness는 한 값으로 뭉치지 않는다.

| 축 | 의미 |
| --- | --- |
| policy compatibility freshness | 현재 변경이 기존 policy 의미와 호환되는지에 대한 Human 판단 |
| checked fixture freshness | repository의 고정 observation이 선언된 revision·runRef·digest와 재현되는지 |
| protected signed-target freshness | protected bundle이 정확히 현재 target head를 서명했는지 |

보고 형식은
`{ verifiedHead: X, verdictAt: T, currentHead: Y, attestationFreshness: fresh | stale | absent }`
이다. `X != Y`거나 signed bundle이 없으면 Y의 machine verdict를 만들거나 X의 `healthy`를
이월하지 않는다. 이때 Y를 평가한 것처럼 `unknown`이라고 쓰지도 않고, “Y에는 authoritative
verdict 없음”이라고 쓴다. `.github/workflows/architecture-fitness-rebind-window.yml`은 운영자가
수동으로 실행할 때 retention 안의 signed artifact를 paginate하고 successful protected workflow의 최신 verified
target만 골라 main과 비교한다. Protected rebind bundle은 main branch/run SHA와 target SHA가
같고 PR 번호 `0`, PR bundle은 실제 merged PR 번호여야 하므로 event identity를 바꿔 끼울 수
없다. Current-head bundle을 최우선으로 고르고 없을 때만 최신 stale bundle을 fallback으로
쓴다. Squash merge에서는 signed PR
target SHA와 main SHA가 다른 것이 정상이라 `stale`은
오류나 current-head verdict가 아니라 batch window 상태다. Stale/absent이면 rolling batch
issue를 갱신한다. 개별 제품 PR은 covered behavior를 건드리지 않았다는 이유만으로 fixture
bridge를 동반하지 않는다. 운영자는 review나 milestone에서 필요하다고 판단한 rebind를
수동 batch로 모은다.

`architecture-fitness:check-publication`은 protected raw input이 complete이고 evidence exit가
0이며 collector가 reproducible evidence로 선언했는지를 검사한다. 이어서 pinned core evaluator의
profile policy별 `--validate-only`가 canonical schema를 통과시킨 뒤에만 raw input을 업로드한다.
실패한 partial observation은 3일짜리 `non-authoritative ... diagnostic` artifact로 따로 보존하고
signed input 업로드는 차단한다. Publication checker 자체는 reproducibility를 독립적으로
증명하지 않는다. Checked fixture의 동일 revision/runRef byte identity는 adapter `--check`가
소유한다. 현재 human-readable evidence command에는 필수 `--output`이 빠지거나
`<collector-authority>` placeholder가 있으므로 literal replay gate로 가장하지 않는다. 실행 가능한
normalized argv/recipe가 생기기 전까지 이 coverage는 별도 미완료 항목이다.

로컬 advisory는 key나 GitHub처럼 보이는 환경 변수가 있어도 observation을 서명하지 않는다.
외부 core를 직접 호출한 self-issued HMAC도 Lighthouse authority verdict가 아니다. 로컬
adapter는 key를 제거해 unsigned evaluation만 수행하고 `verified` assessment를 거부한다.

Authoritative 경로는 Human 승인 기록 뒤 운영자가 여는 protected `main`의 exact rebind만
허용한다. Workflow는 승인 자체를 machine fact로 추정하지 않고 invocation actor를 provenance에
남긴다. Workflow SHA와 target SHA는 같아야 한다. Rebind는
exact target의 first parent를 base로 고정하고 ancestor 관계를 확인한 뒤 한 번 full collection을
실행한다. 일반 main push에서는 heavy rebind를 자동 실행하지 않는다.
각 profile은 exact target의 collector가 현재 policy 의미를 유지한 채 base와 target을 모두
해석해야 한다. Q2 collector는 TypeScript lexical symbol로 `search-service`의 named import에
직접 결속된 호출과 await 결과의 `papers`·`total`·`source` shape를 확인해 keyword-search 역할을
하나만 찾는다. Local shadow는 owner 결속으로 인정하지 않는다. 발견한 revision별 export는
collector-authority의 신뢰된 behavior harness에만 전달한다. 역할이 없거나 둘 이상이면 수집을
실패시킨다. 따라서 provider export 이름이 revision 사이에서 바뀌어도 같은 역할을
비교할 수 있으며, 이전 main collector identity 일치를 bootstrap 선행조건으로 요구하지 않는다.
Q4가 소유하는 exact provider seam과 허용 owner 검사는 그대로 유지한다.
Secret 없고 `contents: read`만 가진 `collect` job이 base와 exact target revision을 수집한다.
Q4 collector는 해당 mode의 trusted collector·guard·source-policy test만 실행하고
target tree를 읽기 전용 source input으로 다룬다. Target module을 load하지 않으며 Q4 raw
artifact를 다른 exact-target behavior 수집보다 먼저 immutable artifact로 봉인한다. 나머지
target-executing profile도 secret을 받지 않는다. Q5 base observation은 collector-authority runner에서
별도 immutable artifact로 봉인하고, 별도 `collect_q5` job만 target module behavior를 실행한다.
Checkout credential을 저장하지 않고, collector-authority probe child에는 `PATH`, `HOME`, `NODE_ENV`와
두 harness root만 전달하며 이 job은 npm cache를 저장하지 않는다. Q5 target observation도 독립 artifact로 봉인한다. Protected
attestor는 두 artifact에서 정확히 base·target observation만 새 Q5 input artifact로 결합하고,
그 ID와 digest를 Q5 profile invocation provenance에 바인딩한다. 이 job은 target module을
실행하지 않는다.
Unmerged PR code는 이 신뢰 경계에서 실행하지 않는다. PR별 Architecture Fitness verdict를
발행하지 않으며, 일반 제품 PR은 blocking static guard와 exact-head review로 닫는다. Checkout은
같은 repository의 branch history를 모두 가져오고 exact target과 first parent를 확인한다.
Private repository를 unauthenticated HTTPS로 다시 fetch하지 않는다.
`attest-and-verify` job은 `architecture-fitness-attestor` GitHub Environment를 사용하며
unmerged PR code를 checkout하거나 실행하지 않는다. Exact protected target revision의 policy,
verifier와 pinned core만 실행해
schema, repository/event/workflow/base ref, target revision, run id/attempt와 raw
artifact id/digest를 다시 확인한 뒤 core `attest.py`로 complete observation을 서명한다.
`evaluate.py`와 `compare.py`의 결과를 독립 재실행해 검증하고 profile별 signed bundle을 하나의
90일 immutable artifact 아래 남긴다. 각 bundle의 provenance는 profile id와 policy digest를
포함하므로 한 profile의 observation이나 merge policy를 다른 profile로 재사용할 수 없다.

허용 authority는 다음과 같다.

- repository: `corca-ai/lighthouse`
- event: protected `main`의 `workflow_dispatch`
- workflow ref: `corca-ai/lighthouse/.github/workflows/architecture-fitness-attestation.yml@refs/heads/main`
- trusted implementation: exact target SHA이며 workflow SHA와 같아야 함
- subject identity: main branch/run SHA와 결속된 PR 번호 `0`
- key ref: `env:ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1`
- attestor ref: `github-actions:corca-ai/lighthouse:architecture-fitness-attestation@v1`

다른 repository의 target, workflow/ref/run/revision의 artifact 재사용, payload digest 변경, key
누락은 verified output을 만들지 못한다. Protected verifier는 GitHub artifact archive digest와
별도로 raw base/target observation을 bundle에 보존하고, 각 파일 digest를 다시 계산하며, core
attestor를 재실행해 signed observation이 보존된 raw input에서 유도됐는지 확인한다.

Environment에는 최소 32-byte `ARCHITECTURE_FITNESS_ATTESTATION_KEY_V1` secret을 두고 deployment
branch를 protected `main`으로 제한한다. Secret 값은 repository, cache, artifact와 log에 넣지
않는다.

## Issue #278 authoritative rollout evidence

| 항목 | 값 |
| --- | --- |
| Activation baseline | `7e2eee2d78954bf0da08ecc92bfa332622ae9d22` |
| Fixed collector baseline | `c353239f632a945cfd701badfe25e630e6d4509a` |
| 첫 fixed same-repository live run | [run 29300464279, attempt 1](https://github.com/corca-ai/lighthouse/actions/runs/29300464279) — PR #302 |
| 검증한 target revision | `165bae5807d914e234bb6ae2adf93619924b5cca` |
| Raw observation artifact | ID `8298343471`, SHA-256 `d6be79edcfc100752cc083101b2192eee7ef4ab3695d3990aa9262f449b79cdf` |
| Signed evidence artifact | [ID 8298355243](https://github.com/corca-ai/lighthouse/actions/runs/29300464279/artifacts/8298355243), SHA-256 `d7c6f87e0c0bfa06d3906278a1f07359c5f460bcc82c2feb1788db1f49acd4a2` |
| Verified scoped result | `verified`; My Library 하위 case `healthy`; merge advisory `allow` |
| 첫 v0.5 same-repository live run | [run 29496377990, attempt 1](https://github.com/corca-ai/lighthouse/actions/runs/29496377990) — PR #334 |
| v0.5 raw observation artifact | ID `8374667062`, SHA-256 `921079a3e810d2dfed9af68993d5d05e06884750fb2cfb0846ce1c98cd3ecde6` |
| v0.5 signed evidence artifact | [ID 8374691475](https://github.com/corca-ai/lighthouse/actions/runs/29496377990/artifacts/8374691475) |
| v0.5 verified target | `ef1fc22b823eca967a305494c9b4492fe71ab77e`; owner-read `healthy`; broader least-authority `unknown`; merge advisory `allow` |

Activation baseline은 authoritative workflow가 처음 main에 포함된 revision이다. Fixed
collector baseline은 첫 live run에서 발견한 private-repository 중복 fetch를 제거한 revision이다.
첫 fixed live run은 이 문서 변경을 대상으로 secretless collect, protected Environment 서명,
raw observation 재서명, assessment·comparison 재계산과 invocation·artifact binding 독립 검증을
통과했다. Signed bundle의 `verification.json`은 `status: verified`와 위 invocation을 기록한다.
이 결과는 실행 가능한 My Library owner-access 하위 case에만 해당한다. 원래 #278 case와
Q1/Q3/Q4/Q5/process coverage는 계속 `unknown`이며, GitHub required check 승격도 별도 Human
decision이다.

Run `29300464279`는 v0.4 policy v23 authority epoch의 역사 evidence다. Run
`29496377990`은 pinned v0.5 policy v25와 core revision
`233158c6822a42f88f3f62dddca48420c00325d1`을 사용한 첫 live evidence다. 두 active
profile의 protected invocation과 artifact binding은 `verified`다. 이 결과는 owner-read
하위 case와 keyword-search state-boundary만 검증한다.

PR #335 run `29509228056`은 target content head
`5333ca668bd988f5f1405d3b4ccce5e506d97197`를 다시 수집했다. Signature는 `verified`,
keyword-search state-boundary는 `healthy`, merge advisory는 `allow`였다. Raw artifact ID는
`8380017095`, digest는 `71384f58b2c26cac5ff4642be33fb7f42c2c742d1ef873495f8280f745593c17`이고,
signed artifact ID는 `8380050586`, digest는
`0b858ab2c7eb23083fd0588598aedb0c067f75f1bf0eca429d9612736aa1c1ab`이다.

## Issue #276 Q1 state-boundary 진행 상태

Human은 [Issue #276의 좁은 `keep` 결정](https://github.com/corca-ai/lighthouse/issues/276#issuecomment-4965016032)으로
다음 경계만 승인했다.

- `/search` keyword와 `/citation`·`/similar` seed condition은 URL이 소유한다.
- client store는 reload/share 정본이 아니라 active route execution의 current-result carrier다.
- 첫 결과 전에 persisted search record를 만들지 않는다.
- current result는 route-owned ephemeral snapshot이며 exact replay를 약속하지 않는다.

`issue-276.policy.json`과 exact-revision collector는 keyword-search 구현 하위 case를 관측한다. URL/store
우선순위와 deterministic URL normalization, URL에서 server execution input으로 이어지는
projection, canonical view identity 입력, route unmount cleanup의 production owner를 TypeScript
symbol·AST로 인벤토리화한다. 기존 정상 경로를 남긴 alias·병렬 authority·identity·writer,
간접 runtime query helper, facet normalizer의 runtime authority와 standard dependency shadow,
store capability escape, dynamic key와 symbol alias·identifier/spread patch를 사용한
reflection·`Object.assign` direct write mutation도 거부한다. Identity hash provider는
`node:crypto` import binding으로 고정한다.
실행할 것으로 선언한 route/service test와 collector가 소유한 identity fixture가 실제 Vitest
report에 없으면 collection을 실패시킨다. Identity fixture는 hostile namespace 환경에서도 고정
literal prefix와 canonical condition만으로 같은 값을 요구한다. Checked-in observation은 main
`aa4f0b495cdb1f8083d3e24d0cc02be127b3a09e`를 완전하게 수집했지만, unsigned local case verdict는
`unknown`이다.
Protected host gate의 profile-bound 서명과 독립 검증을 통과할 때만 이 state-boundary case가
evidence에 따라 `healthy/degraded/unknown`이 될 수 있다.
`/citation`·`/similar` relationship seed 경계는 별도
`issue-276-relationship-state-boundary` profile이 관측한다. 이 profile은 URL seed에서 canonical
input과 exact relationship execution owner로 이어지는 projection, seedPaper 각 필드의 URL provenance,
상대 경로를 포함한 protected-module owner, ready/failed 결과가 공유하는 canonical seed identity,
citation/graph-neighbor의 고정 route-kind prefix, shared route-owned snapshot lifetime을 수집한다.
Checked-in baseline은 main
`aa4f0b495cdb1f8083d3e24d0cc02be127b3a09e`를 완전하게 수집했지만 unsigned이므로 case verdict는
`unknown`이다. Base-branch workflow에 collector와 profile이 병합된 뒤 same-repository 후속 PR의
protected attestation을 통과해야 `healthy/degraded/unknown` machine verdict가 생긴다.

Keyword profile의 held-out corpus는 그대로 둔다. Relationship profile을 분리한 이유는 새 범위를
기존 collector definition과 동결 corpus에 끼워 넣어 과거 검증 기준을 회전시키지 않기 위해서다.
이 분리는 영구 원칙이 아니다. Q2 protected verdict가 끝나면 collector materialization·test evidence
boilerplate를 공통화했을 때 기존 profile digest와 evidence를 안전하게 이행할 수 있는지 다시 점검하고,
유지 비용이 검출 가치보다 크면 합치거나 삭제한다.

PR #334의 same-repository `pull_request_target` run `29496377990`은 v0.5 profile을 사용했다.
Keyword-search state-boundary는 base와 target 모두 `healthy`였고 merge advisory는 `allow`였다.
로컬 synthetic protected-key test는 profile·policy·invocation·artifact binding과
unsupported-coverage 보존을 검증하지만 이 live GitHub authority evidence를 대신하지 않는다.

이 case가 `healthy`여도 browser first-usable-result, persistence 제거와 속도 개선의 인과,
whole-capability technical grain, cache·lease의 instance-movement resilience, process
effectiveness는 증명하지 않는다. Q4 Human policy decision과 bounded hardening은 Issue
\#297에 기록됐지만 executable case는 없다. Q5 consumer inventory와 policy hardening은 PR
\#311의 별도 작업이 소유하지만 generic executable case와 승인된 evidence authority는 없다.
Policy의 `unsupported`는 이 범위가 Q1 결과로 잘못 승격되지 않게 하는 표식일 뿐 Q4·Q5
machine 평가 결과가 아니다.

## Issue #295 query-only 다른 입장 목적지

Human은 `다른 입장` 후보의 생성 query를 독립 검색 조건으로 승인했다. 출발 논문,
출발 입장과 쟁점 축은 destination URL·search metadata·canonical execution identity의
authority나 carrier가 아니다. `entry=position`은 제출 표면을 구분하는 비원문 event
분류값이며 provenance state를 복원하지 않는다.

구현은 `position*` URL projection과 `differentPositionSeed` domain/schema 전달을
제거한다. Follow-up handler와 파생 카드 parity test는 query-only plain/detached
navigation을 검증한다. Search execution negative test는 legacy provenance 파라미터를
바꿔도 canonical input과 identity가 같음을 검증한다. Canonical click event는 origin
view·paper identity와 query hash·length만 기록하고 raw query와 입장 설명을 싣지 않는다.

이 결과는 승인된 state 경계의 구현 준수 evidence다. 현재 active v0.9.1
`issue-276.policy.json`에 #295 전용 case를 추가하지 않았으므로 별도 signed Architecture
Fitness `healthy` verdict를 주장하지 않는다. Product Promise와 Evidence Ledger의 `met`,
Architecture Fitness machine verdict, Human decision을 한 값으로 합치지 않는다.

## Issue #272 분리 outcome proxy

Human은 첫 usable `search_results_viewed`부터 다음 검색 context 또는 세션 경계 전까지
같은 `search_context_id`로 `pdf_opened`와 `paper_saved`를 각각 연결하도록 승인했다.
두 event는 출발 `journey_context_id`, `search_context_id`, paper context를 유지한다. 두 행동은
합성 점수를 만들지 않으며 행동 자체를 사용자 성과로 간주하지 않는다. 비교 가능한
baseline 또는 cohort가 없으면 더 빠르거나 더 좋아졌다는 인과 주장을 하지 않는다.

이 변경은 관측 계약과 correlation identity를 닫는다. Production cohort와 실제 outcome
분포는 아직 수집되지 않았다. Outcome evidence는 v0.9.1 executable case가 아니므로
`coverage: unsupported`, machine verdict `unknown`을 유지한다.

## Issue #297 Q4 technical-grain Human review

Issue #297의 policy candidates, exact-revision call-path inventory, guard coverage matrix와
representative propagation trace는 `issue-297-q4-technical-grain.md`에 있다. 2026-07-15
Human decision은 literature provider gateway+breaker, structured AI gateway와
`executeJudgment`의 분리, domain-access와 repository의 분리, client background lifetime과
server effect owner의 분리를 `keep`으로 승인했다. 함께 승인한 bounded hardening은 OpenAI
provider acquisition guard, 연결되지 않은 DOI resolver 제거, 빈 repository index 제거,
Moonlight library 전체-operation deadline의 gateway 소유, Amplitude/Supabase 전용 outbound
owner와 guard scope다.

Human decision과 기존 구현 evidence만으로는 Q4 machine result가 되지 않는다. 별도
`issue-297-q4-technical-grain` profile은 네 승인 seam과 두 bounded contract trace를
exact revision에서 수집한다. Checked-in fixture는 schema와 증거 완전성을 검증하지만
서명되지 않았으므로 `unknown`이다. Profile 변경이 main에 병합된 뒤 protected exact-main
gate가 target-owned collector로 base와 target을 다시 수집·서명해야 첫 authoritative
`healthy/degraded` verdict가 생긴다.

`issue-276.policy.json`의
`coverage:issue-276-technical-grain`과 `issue-278.policy.json`의
`coverage:technical-grain`은 기존 policy 안에서 계속 `unsupported / unknown`이다. 두 기존 policy를
Q4 결과로 재해석하지 않는다. Keep/reshape/remove, dynamic runtime coverage,
whole-capability future change cost, process effectiveness는 machine case와 분리한다.

## Issue #298 Q5 cache policy 진행 상태

Issue #298의 cache/state classification과 consumer-owned policy record는
`q5-cache-policy.md`에 있다. 이 문서는 reviewed-papers 목록을 owner-scoped live DB
source로 분류하고, Issue #583에서 direct-citation process cache를 은퇴시켰으며,
shared inline-analysis artifact, Episteme preset-title display cache, compatibility context parse cache를 비롯해
analytics event-contract parse cache를 실제 cache로 분류한다. Process-local
coalescing, DB lease, request memoization, session state,
provider failure-protection state는 cache와 분리한다. Preset-title cache는 #320에서 positive
15분·negative 30초 TTL, 1,024-entry LRU, same-id process-local coalescing과 caller-only abort
경계를 deterministic evidence로 닫았다. 이 consumer control은 fleet evidence나 Q5 core 지원을
대신하지 않는다.

`guard:inline-analysis-cache-contract`는 inline-analysis의 cache-relevant AST 변경과
`INLINE_ANALYSIS_VERSION`을 묶고, shared-cache 생성·완료를 소유하는 선언 전체를
직렬화한다. Local alpha-rename과 console-only diagnostic은 정규화하지만 생성 입력 선택,
failure-placeholder 제외, completion projection과 cleanup 흐름은 모두 contract digest에 남는다.
Issue #305의 aggregate-only SQL은 운영 DB의 row 수,
크기, version/age 분포와 identity cardinality를 읽기 전용으로 수집한다. 이 두 검사는 consumer
control과 evidence collection을 보강할 뿐 Q5 calculator나 Architecture Fitness observation을
추가하지 않는다.

현재 pinned v0.9.1 core는 generic `cache-lifecycle` case를 지원한다. Lighthouse는 전체
cache를 한 번에 합격시키지 않고, source policy와 secret-free behavior probe가 완결된
preset-title process-local cache만 `issue-298-q5-cache-lifecycle` profile의 included case로
활성화했다. Checked-in exact-revision observation은 complete지만 unsigned라 `unknown`이며,
PR #368로 profile, PR #370으로 isolated Q5 collection lane을 main에 병합했다. 첫 실행
`29582901950`은 수집을 완료했지만 protected recombination에서 artifact 중첩 경로가 맞지 않아
서명 전에 실패했다. PR #371이 extraction layout을 수정했으며, 첫 authoritative verdict는 이
수정이 포함된 main에서 시작한 same-repository 후속 PR에서 생긴다.
Reviewed-papers와 inline-analysis의 fleet behavior, cleanup 효과, production cache 관측,
process effectiveness는 계속 `unsupported / unknown`이다. Production shared-cache baseline이 보존 임계를
넘어 current/rollback version을 제외한 30일 이전 `ready` row의 bounded operator cleanup을
선택했다. 2026-07-15에 `00016`~`00022`의 remote schema·function·ACL 효과를 확인하고
migration ledger를 `00022`까지 정합화했다. Migration SQL은 재실행하지 않았다. 같은 날
post-migration aggregate baseline은 3,739 `ready`, 0 `pending`, cleanup eligible 0 rows였다.
이 baseline은 production deployment `5450077796`의 application revision
`4f6c2513b17442fe7ad3b300badd67ff03f9b9d7`과 migration state `00022`에 연결한다.
Issue #319가 2026-07-31 이후 cleanup 전후 evidence를, #321이 multi-instance failure-injection/load
evidence를 소유한다. Episteme가 2026년 8월 초까지 내부 정비 중이므로 그 기간의
timeout·5xx·latency는 Lighthouse 회귀와 자동으로 합치지 않고 provider maintenance로 별도
귀속한다. 이 evidence가 없으므로 전체 Q5 Human status는 `evidence-needed`다.

## Issue #280·#281·#286 Q2·Q3 Human review

현재 recovery owner, critical-path evidence 경계, workload report v5와 sustained
closed/open admission semantics는 `issue-280-281-286-q2-q3-evidence.md`에 기록한다.
v0.9.1에서도 Q2 machine scope는 더 좁다. `issue-280:episteme-breaker-process-scope`는
process-local self-protection만, `issue-281:first-ready-search-payload`는 승인된 await와
failure-isolation graph만 판정한다. Fleet/provider-account hard cap과 production latency는
별도 unsupported coverage로 계속 `unknown`이다. Q3는 일반 scalability 전체가 아니라
승인된 burst·sustained·controlled-provider launch envelope만 executable case로 판정한다.

Checked-in Q2 observation은 exact revision
`528a482ecd8b269a8f8429f27190bf2f32a41466`에서 8개 evidence와 2개 observation을 모두 exit
0으로 수집했다. 이 fixture는 unsigned라 authoritative verdict로 쓰지 않는다. PR #340의 protected
run `29533199484`는 exact target `b9f8b8431e913f2cf5d4a69555ce02df02fa9359`에서 collector
attestation과 provenance를 `verified`로 검증했다. Process topology와 first-ready critical path는
각각 독립적으로 `healthy`, unsupported 세 렌즈는 `unknown`, merge advisory는 `allow`다. 따라서
Q2의 지원 case는 완료했고 fleet/provider-account hard cap과 production latency는 Q3·production
trial의 별도 evidence로 남긴다. Checked-in Q3 v37 observation은 내부 변경 기록
표면과 그 전용 projection 호환 분기를 제거하고, 마지막으로 남는 reviewed
compatibility revision `ef9b2a0de67388e865ef0560ac26118a94821584`에 결속한다. 세
시나리오와 negative behavior suite는 모두 exit 0이고 observation은 complete지만,
파일 자체는 unsigned라 authoritative verdict가 아니다. PR #360 run `29552675027`은
base v4 이행 경계를 `verified / unknown`으로, PR #361 final run `29554384006`은
v5 launch coverage를 `verified / healthy`와 merge advisory `allow`로 닫았다.

v37 collector는 v5 정본 보고서를 수정하지 않는다. `v6-active` 경로에서 보고서
digest, measurement revision, guarded-tree digest와 남아 있는 exact reviewed-tree
manifest를 함께 검증한다. 제거된 publication tree, workload projection digest,
전용 compatibility basis는 더는 현재 policy나 collector authority가 아니다. 현재
작업 head가 남은 exact tree와 다르면 이전 verdict를 이월하지 않고
`incompatible-tree`로 남긴다. Production fleet, p99/5xx, DB pool, real-provider
amplification은 계속 `unsupported / unknown`이다.

Production 인증 callback incident의 구조적 방어도 Q3 보호 경로를 바꾸므로 같은 원칙을
적용한다. 2026-07-18 authority bridge는 v5 workload report와 예산을 바꾸지 않고, exact
guarded-tree digest
`4be8a4050a45a467c32744dae8a3fd2f87776a996cec68f8a390bb3a9ce29b5b`와
인증 callback 테스트 두 파일·`supabase/config.toml` 세 경로만 기존 workload와 compatible한
비 workload 변경으로 잠근다. 이 bridge가 trusted base가 된 뒤 인증 수정 PR을 별도로
평가한다. Exact digest나 경로 manifest가 다르면 fail-closed이고, measured revision
unavailable 예외는 PR #338 tuple에만 남는다. 이 결정은 위임된 임시 Human 판단이며 마지막
출시 점검에서 다시 보고한다. Production fleet·provider·latency `unknown`은 줄이지 않는다.
PR #338이 이 복구가 포함된 최신 main을 병합한 integration tree는 guarded-tree digest
`ea909751493d6a5730279b0ed9717d29e7123166deeaef9cb207edd5057eaf01`과 두 변경의 정확한
열두 경로 합집합으로 별도 잠근다. Standalone 두 tuple을 임의로 조합해 허용하지 않으며,
integration digest와 경로 manifest가 함께 일치할 때만 PR #338 measurement의 compatible
target이다. Auth-only v5 tuple에는 measured revision unavailable 예외를 추가하지 않는다.

PR #379은 이 integration tree에 compatibility host 전용 308 rule, 회귀 테스트, 내부
Decision Log만 더한다. 공개 `/about/changes`는 Human 결정으로 은퇴 상태를 유지한다. Exact
guarded-tree digest `687cb5c089fe368a002eeb406e84ec54c7b114fa54734c4ede565611c9a89bd2`와
17개 changed path가 모두 일치할 때만 기존 Q3 measurement와 compatible하다. 이 tree는
canonical·local search execution, provider, admission, readiness, workload profile을 바꾸지
않으며 production/fleet `unknown`을 축소하지 않는다.

PR #381 hydration tree는 검색 결과 projection과 card detail hydration을 분리하고, faceted
AI comment의 terminal readiness를 한 번만 닫는다. 초기 hydration이나 repair의 정상적인 빈
200은 lightweight 카드를 보존하고 즉시 `repairAttempted`를 기록한다. 개별 provider
오류·abort는 successful-empty로 바꾸지 않고 기존
직렬 최대 3회 client retry로 돌리며, 모두 실패하면 lightweight 근거를 보존한
`ready + repairAttempted:true` degraded terminal로 닫는다. Exact content revision
`f1d2173140b03b77a4c7cb8346eb88d9fa92f5ad`, guarded-tree digest
`034443c37027d0a49a9ec64a34e494c2e43c9f5aab9c277b826d8b1e157327e2`,
서른여덟 changed path가 함께 일치할 때만 compatible하다. Review 뒤 의미가 수정된 이전
`9b5d474f…` / `a0274af2…` tuple은 active compatibility에서 퇴역했다. 이 binding은 healthy-provider
fan-out·arrival·concurrency·deadline을 바꾸지 않으며, 새 latency·production-health·real-provider
증거가 아니다.

PR #386 skill-runtime tree는 repository 정본 skill의 설치·동기화와 내부 Decision Log만
추가한다. Exact guarded-tree digest
`344706358c2217a4e75a9b10c808096501360480d0c1261f3adba6f07870fa15`와 마흔세
changed path가 함께 일치할 때만 compatible하다. 검색 실행과 Q3 workload 의미는 바뀌지 않는다.

PR #432, PR #437, Issue #423에서 사용했던 publication 전용 compatibility와
projection은 Issue #452에서 함께 은퇴했다. 당시 승인과 digest는 Git·PR·dated review
history에 남지만 active policy 후보가 아니며, protected collector는 이를 현재 head에
재사용하지 않는다.

Issue #208 error-catalog tree는 PR #386 tree 위에서 호출자가 없는 오류 코드와 퇴역한 fixed-copy
message만 제거한다. Exact target revision `9de7bdd66a221af8084c9496851307096b1de9b6`,
guarded-tree digest `e392727463a7fa59361312c2b4265963e63da5105d3935d3e55cae676a0441e2`,
마흔여덟 changed path가 함께 일치할 때만 compatible하다. 새로 추가된 다섯 경로는
`app/domain/error-catalog.ts`와 네 i18n catalog 경로다. Active message caller, search execution,
provider, admission, readiness, deadline, concurrency, workload profile은 바꾸지 않는다. 이
호환성은 새 workload 측정이나 production evidence가 아니다.

Issue #208 principal fixture tree는 error-catalog tree 위에서 owner·viewer principal을 나타내던
테스트 값만 76개 test·fixture 파일에서 정본 principal 이름으로 바꾼다. Exact target revision
`b39147fe89a7499a9a3d88fb4bfc14eb33e1e98b`, guarded-tree digest
`0c5001e9d6b048b4cb4b549608883bd80e62ec335259326fe2734ef9d4c554ef`, measurement
revision 이후의 ordered 117-path manifest가 함께 일치할 때만 compatible하다. Direct delta는
전부 test·fixture 경로이며 production/runtime 구현, analytics event 계약, search execution,
provider, admission, readiness, deadline, concurrency, workload profile은 바꾸지 않는다.
기존 error-catalog tuple은 대체하지 않고 누적 compatibility로 보존한다. 이 호환성도 새 workload
측정이나 production evidence가 아니며 production/fleet/provider 상태는 계속 `unknown`이다.

### Q2 보호 실행 및 비용·가치 감사

PR #339의 최종 물리 diff는 6,700행 추가·117행 삭제다. 이 가운데 3,156행 추가·30행 삭제는
`shared-skills`를 `.agents`와 `.claude`에 동기화한 generated copy이고, 외부 core의 고유 import
delta는 1,598행 추가·27행 삭제다. Lighthouse Q2 consumer는 정책, observation, 문서와 workflow를
합쳐 1,868행 추가·60행 삭제이며 내부 Decision Log는 78행이다. 핵심 Q2
collector·negative test·probe·trusted config·policy·observation 여섯 파일은 1,454행이다. Q2와 기존
search behavior를 함께 실행한 표적 suite는 18/18 통과했고 exact collector는 로컬에서 약 2.6초에
완료됐다. 모든 활성 profile을 수집한 첫 protected run의 collect job은 9분 49초, attestation과
verification은 50초였다.

Q2 v5 collector는 trusted harness의 절대 worktree 경로를 `<collector-authority>`로 정규화했다.
Q4 profile 통합 중에는 Vitest의 파일·assertion 보고 순서도 digest를 바꾸는 재현성 결함을
발견했다. Q2 policySet v6의 collector v4와 Q4 policySet v3의 collector v3은 report 배열을
안정 정렬하고 target·trusted root를 논리 ref로 정규화한다. Checkout root와 report 순서를
바꾼 negative test가 같은 artifact를 만들고 host root가 남지 않는지 확인한다. Q2와 Q4
observation은 연속 재수집에서 byte-for-byte 동일하다. 이 변경은 process topology,
first-ready critical path 또는 Q4 verdict 의미를 바꾸지 않고 evidence identity만 결정적으로
만든다.

최종 review closeout은 서로 다른 유효 root finding 12건을 수정했다. 실제 Lighthouse 적용이
awaited phase와 failure-blocking
phase를 같은 축으로 제한한 core v0.6.0 모델 오류를 드러내 v0.6.1로 수정했다. 초기 로컬 review는
외부-owned breaker initializer 오인, 제거 코드를 주석 marker로 위장하는 우회, 선언 test-file
누락이나 unparseable report를 exit 0으로 수용하는 우회를 찾아 policy v2에서 fail-closed로
고쳤다. 후속 GitHub review는 stale 부가 증거가 위반을 숨기는 경계, critical-path behavior의
phase 미결속, topology behavior의 scope 미결속, PR target이 바꿀 수 있는 test harness 신뢰,
observe reset으로 shared state를 지우는 순차 probe를 추가로 찾아 core v0.6.2와 policy v3에서
닫았다. 마지막 review는 partial JSON read, 실패 시 child 누수, 무기한 observe를 찾아 policy v4에서
닫았다. Architecture Fitness verdict의 확인된 false positive는 0건이며, review 날짜 지적 2건은
KST 기준 오탐으로 분류했고 generated-copy 지적 1건은 중복으로 분류했다.

첫 protected verdict가 이 경계를 실제로 검증했으므로 Q1과 Q2 profile은 Lighthouse 출시까지
유지한다. 별도 topology/critical-path collector 둘을 만들지 않고 한 process로 합쳤으며 aggregate
Q2 score, global limiter, 새 required check는 추가하지 않았다. 범용 Architecture Fitness 확장은
동결하지 않는다. Q3·Q4·Q5나 새 제품 요구가 실제로 요구하는 case만 추가하고, 각 단계 closeout과
통합 protected run에서 고유 finding, false positive, 실행시간, 물리·고유 코드량을 다시 비교한다.
출시 판단을 바꾸지 못하거나 기존 경계와 중복되는 profile·fixture·generated copy·문서는 수시로
통합하거나 삭제한다. 현재 Q1/Q2에서는 즉시 삭제할 저가치 case를 확인하지 못했다.

## 판정 결과

Checked-in unsigned advisory에서 issue #278의 before/after는 다음과 같다. Collector는 My
Library reviewed-paper list/cache/mutation 하위 범위만 실행한다. Reviewed-status enrichment,
service-role, repository runtime, trusted helper와 공유 inline-analysis cache path는 원래
#278 case의 미관측 범위로 남긴다. Bound production guard는 공유 cache repository의 네
RPC export와 네 RPC resource의 exact owner, shared table 직접 접근 금지도 검사한다.
정적으로 이름 붙은 무관 RPC까지 막지는 않으며, 이 검사를 별도 path-correlated case
verdict로 확대하지 않는다.

| 대상 | Revision | 수집 completeness | 원래 #278 case | My Library 하위 case | Coverage 밖 렌즈 | Merge advisory |
| --- | --- | --- | --- | --- | --- | --- |
| Baseline | `2066f24671d2f24d89c59359888df19f8befb89d` | `partial` | `unknown` | `unknown` | `unknown` | `block` |
| Reshape 구현 revision | `4bb42e2dfde1869ecdaa4319fb40736c08d8d7a3` | `complete` | `unknown` | `unknown` | `unknown` | `block` |

Baseline에는 raw `DbClient/userId` helper와 임의 principal cache path가 남아 있어
production guard가 실패하고 collection은 `partial`이다. Reshape 구현 revision은 auth가 raw
client를 즉시 `app/lib/supabase/repository-db-handle.ts`의 WeakMap에 등록하고
`RepositoryDbHandle`만 경계 밖으로 넘긴다. Auth는 repository runtime을 import하지 않는다.
등록되지 않은 객체는 repository에서도 unwrap할 수 없다. Handle 생성자는 두 auth owner만,
unwrap 함수는 `app/server/repository/db.ts`만 import할 수 있다. Domain-access가 가져갈 수
있는 repository runtime API도 module·symbol·caller 조합으로 고정했다. 따라서 repository
wrapper가 raw client를 반환하거나 callback으로 넘기는 새 우회는 wrapper import 지점에서
거부된다. Dynamic import와 `require`의 상수 결합·template·const alias도 같은 module
graph로 해석한다. 정적으로 해석할 수 없는 production module 취득도 거부한다. Collector는
이 구조를 immutable revision에서 다시 실행해 `complete`로 수집했다. 로컬 fixture는
의도적으로 unsigned이므로 공식 로컬 verdict는 계속 `unknown`이고 merge advisory는
`block`이다. Protected workflow에서 같은 policy의 exact base/target observation이 검증된
HMAC을 가지면 My Library 하위 case는 evidence에 따라 `healthy/degraded/unknown`이 될 수
있다. 더 넓은 원래 #278 case와 unsupported coverage의 `unknown`은 그대로 보존한다. Scoped
merge advisory는 현재 실행 가능한 My Library 하위 case만 required로 삼으며, 전체
Architecture Fitness health나 required GitHub check를 뜻하지 않는다.

Collector가 exact-revision 트리에 raw authority export, 병렬 arbitrary-owner repository
caller, static element table access, 추출한 table-method alias, repository DB module의 계산된
`import()`·`require()` 취득을 주입한 뒤 bound AST guard가 모든 우회 유형을 거부하는지
실행한다.

v0.4 이전 Issue #276, #278, #283, #285 파일럿의 Human decision은
`docs/archive/architecture-fitness-legacy-v2-decisions.md`에 읽기 전용 요약으로
보존한다. 26개 v2 원본과 그 안의 재실행 명령은 Issue #353에서 현재 트리에서 제거했다.
원본을 복원해야 할 때 사용할 exact Git revision은 요약 문서가 기록한다. Legacy decision은
#276 `evidence-needed`, #278·#283 `reshape`, #285 `keep`이며, 현재 활성 v0.9.1 policy가
실행 계약을 제공하지 않는 범위를 과거 결과로 다시 `healthy`라고 주장하지 않는다. 현재
#276 결정은 URL·route-owned state 하위 범위의 `keep`이며, legacy 결정을 다시 쓰지 않는다.

## Held-out mutation corpus

Issue #318이 요구하는 frozen held-out corpus는
`docs/architecture-fitness/pilots/held-out/corpus.json`이 소유한다. Runner는
`npm run architecture-fitness:held-out`이다. Corpus는 PR #308의 valid escape를 분류한
canonical defect class에서 저작했고, collector·guard 개발에 쓴 built-in negative-mutation
suite와 `scripts/architecture-fitness/__tests__/` fixture를 의도적으로 피한다. Corpus case를
built-in suite나 guard dev test로 복사하면 held-out 성질이 사라진다.

NC-5의 frozen fact/evidence payload는 그대로 유지하되 active policy version과 collector의 versioned
scope·definition digest만 실행 시점 임시 파일에서 다시 결속한다. Stable policy-set id, adapter id,
collector id 또는 attestor가 달라지면 자동 이행하지 않고 corpus rotation을 요구한다. 이 경계는
정상적인 collector hardening이 verdict downgrade control을 무관하게 깨뜨리는 것과, collector 교체를
과거 fixture로 잘못 신뢰하는 것을 동시에 막는다.

| Canonical defect class | Corpus case | PR #308 escape |
| --- | --- | --- |
| inventory-bypass | heldout-276-01·02·04·05, heldout-278-01·02·04·05 | r3576698153 |
| unresolvable-acquisition-fail-open | heldout-276-03, heldout-278-03 | r3576698200 |
| failure-propagation-inconsistency | nc-3a·3b·3c·3e (+ nc-3d deferred) | r3576698210 |
| factrefs-binding | nc-4a·4b·4c | r3576698149 |
| mismatch-downgrade | nc-5a·5b | r3576698171 |

PR #308의 raw CodeRabbit thread 20개 중 generated skill copy 중복은 위 5개 canonical
class에 연결되며 별도 defect로 세지 않는다.

Runner는 mutation 10건을 exact 트리 사본에 하나씩 적용해 bound guard가 기대 rule로
거부하는지 검증한다. Negative control 9건은 collector·verifier 실패가 uncaught exception이나
false healthy가 아니라 deterministic degraded/unknown/fail-closed로 닫히는지 검증한다.
nc-5 fixture의 self-issued local HMAC은 evaluator semantics 검증용이며 authority verdict가
아니다.

Corpus는 동결 상태다. Runner가 corpus 파일의 sha256을 고정하므로 조용한 편집은 실행
실패로 드러난다. 갱신은 policy 또는 collector version bump가 있을 때만 허용한다. 갱신
시 corpusVersion을 올리고, 교체된 corpus를 `pilots/held-out-archive/`에 보존하고, runner의
expected digest를 같은 변경에서 바꾼다. Archive된 corpus case는 이후 개발 fixture로만
쓴다. 이 runner는 advisory이며 `quality:*` blocking gate나 GitHub required check가 아니다.
Issue #515의 collector-authority config 재결속에서는 Q1 collector version을 올리면서 corpus
v2로 회전했다. v1은 `pilots/held-out-archive/corpus-v1.json`에 보존하며, v2의
`heldout-278-04`는 같은 raw-client window escape를 현재 `identity.ts`의 반환형 owner shape에
다시 고정한다.

Corpus 무결성 동결은 Architecture Fitness 요구사항 확장을 막지 않는다. 새 출시 요구가 생기면
지원되는 case를 추가하거나 core를 확장할 수 있다. 대신 각 Q 단계가 끝날 때 새 profile의 고유
검출 신호, false positive, 실행 시간, 추가 코드·문서량, 기존 gate와의 중복을 점검한다. 고유한
출시 판단을 만들지 못하거나 유지 비용이 더 크면 다음 Q로 넘어가기 전에 profile·collector·문서를
통합하거나 삭제한다.

## LLM candidate 경계

LLM review는 `*.candidates.json`에 candidate만 기록한다. Candidate는 기존 policy,
observation revision, evidence ref를 인용해야 한다. 상태는 항상 `unverified`이다.
`validate_candidates.py`가 orphan identity와 잘못된 상태를 거부한다. Candidate는
deterministic verdict나 merge eligibility를 바꾸지 않는다.

## Advisory와 mandatory 분리

Architecture Fitness local review와 profile별 collector guard는 `quality:*` blocking gate가 아니다.
Authoritative workflow도 signed advisory를 만들 뿐 branch protection의 required check로
승격하지 않는다. 외부 portable package provenance와 설치 시 재생성되는 runtime skill copy
drift는 process toolchain 무결성 문제이므로 `guard:skills`가 blocking으로 검사한다.

Mandatory 승격은 별도 Human decision이 필요하다. Architecture Fitness verdict, Human decision,
merge advisory와 GitHub required-check 여부를 한 값으로 합치지 않는다.

모든 review 보고와 PR closeout은 다음 세 상태를 분리해 표기한다 (issue #318).

| 상태 | 값 | 소유 |
| --- | --- | --- |
| Supported profile verdict | `healthy` / `degraded` / `unknown` | 이 문서와 active profile registry |
| Unsupported lenses | `unknown`, Human-owned | Human decision |
| PR review closeout | `clean` / `findings remain` / `stale` | review record — `shared-skills/review-checklist-steward/references/checklist-usage-log.md` |

Supported profile `healthy`는 system healthy가 아니고 PR `clean`도 아니다. PR closeout은
exact reviewed head의 review record에서만 유도한다. 새 commit은 이전 `clean`을 `stale`로
만든다. closeout 절차 정본은 `docs/agent-skills.md` § Review Closeout Status다. CodeRabbit
같은 외부 bot review는 참고 신호와 escape 측정 입력이며 closeout authority가 아니다.

## Key rotation과 invalidation

Active authority는 key ref와 attestor ref의 versioned pair다. Rotation은 다음 변경을 한 PR에서
같이 닫는다.

1. 새 GitHub Environment secret을 추가한다.
2. policy의 `attestationKeyRef`, `attestorRef`, policy/collector version과 definition digest를
   갱신한다.
3. checked-in raw observation을 새 policy digest로 다시 생성하고 negative tests를 실행한다.
4. 새 authority가 main에 반영된 뒤 이전 secret을 삭제한다.

Current verifier는 active pair만 받는다. 이전 epoch artifact는 90일 동안 historical audit
record로만 남고 현재 merge advisory 입력으로 재사용되지 않는다. Key 유출이나 trusted workflow
compromise가 확인되면 부분적인 run cutoff를 추정하지 않고 해당 authority epoch 전체를
무효화한다. 새 key/ref epoch를 배포하고 incident record에 마지막 신뢰 run과 invalidated
artifact 범위를 기록한다.

## 남은 unknown

### 2026-08-13 Issue #616 process-effectiveness 1차 실전 감사

Issue #616은 구현 작업의 단일 진입점, runtime zone × obligation 탐색, 기존 owner와
검증 lifecycle을 설치했다. PR #617부터 #622까지의 exact-head와 latest-main 감사는
이 구조가 의도한 형태로 설치됐음을 확인했다. 이 결과는 process effectiveness를
뜻하지 않는다.

첫 실전 표본은 Issue #414 / PR #623과 Issue #417 / PR #624다. 두 작업 모두 구현
전에 Mission Control, CAIR, Story Chain, runtime-flow와 관련 owner에 진입했다.
Issue #616의 재도입 기준에 해당하는 late route miss는 0건이다. #417의 Early
Propagation Scope Review는 구현 전에 Aspect, 두 Promise, API response와 ingress
owner를 추가해 `early-caught owner correction` 1개 workstream을 남겼다. 선택한 owner
안에서 propagation, correctness, evidence-depth를 보정한 작업은 두 PR 모두에서
발생했다.

| 관찰 | Issue #414 / PR #623 | Issue #417 / PR #624 |
| --- | --- | --- |
| 최종 content 범위 | 49 files, +1,689 / -55 | 53 files, +2,281 / -137 |
| 최초 content 뒤 correction | 23 files, +377 / -31 | 21 files, +467 / -50 |
| exact-head review | iteration 4, already-fixed 10 | iteration 4, already-fixed 17 |
| PR 생성부터 merge까지 | 56분 48초 | 1시간 50분 57초 |
| Quality workflow | 5 runs | 5 runs |
| 현재 기록에 연결된 merge escape | 0 | 0 |

Review 중 route lifetime, API response owner, terminal admission race, UI next action,
Story Chain과 DB evidence 결속 결함이 발견됐고 merge 전에 correction됐다. 두 작업은
새 skill, classifier, queue, cache, control plane을 만들지 않고 기존 owner에서
닫혔다. 이 관찰만으로 #616 체계의 독립적인 인과 기여를 계산할 수는 없다.

그러나 PR wall time은 active authoring, Human 대기, review, machine 실행을 분리하지
않는다. 로컬 machine run time, iteration별 고유 finding과 false positive, CAIR와
Story Chain의 중복 작성 시간도 기록되지 않았다. 최종 `already-fixed` 집계만으로 각
workflow의 인과 기여를 계산할 수 없고, 같은 Gap domain의 고복잡도 PR 두 건만
선택했으므로 비교군도 없다.

따라서 Architecture Fitness의 process-effectiveness coverage는 계속
`unsupported / unknown`이다. 이 절은 process owner verdict나 router 재도입 결정을
내리지 않는다. Human process 감사 결과와 evidence capture·재검토 제안은
[`quality-gate-records.md`의 2026-08-13 감사](../contract-maps/quality-gate-records.md#2026-08-13-구현-시스템-process-effectiveness-1차-감사)가
보존한다. 실제 process 감사 절차는 계속 `skill-governance-steward`가 소유한다.

2026-08-14의 bounded 5/5 검증은 처음에
[Issue #616의 Human-authorized 결정](https://github.com/corca-ai/lighthouse/issues/616#issuecomment-5292004287)에서
`insufficient-evidence`로 종료됐다. 이후 Human은
[후속 정성 비용 판정](https://github.com/corca-ai/lighthouse/issues/616#issuecomment-5293213759)으로
현재 Lighthouse 저장소 사용에 한해 process owner verdict를 `maintain`으로 바꿨다.
이 결정은 누락된 비용을 완전 계측으로 재해석하거나 통계적·독립 인과 효과를
주장하지 않는다. Architecture Fitness도 이를 `healthy`나 machine-supported verdict로
변환하지 않고 process-effectiveness를 계속 `unsupported / unknown`으로 보존한다.

대표 evidence는 Issue #616과 merge `680d7b64`, Issue #414 / PR #623과 merge
`d73de285`, Issue #417 / PR #624와 merge `2a5bdd5d`, review usage records #623·#624다.
Quality workflow 표본은 PR #623 runs `31565331277`, `31567072335`,
`31567460656`, `31567594125`, `31567819639`와 PR #624 runs `31653014629`,
`31655711010`, `31656631059`, `31657588614`, `31658263600`이다.

- #272의 first-usable-result 이후 PDF-open·library-add production cohort. Event correlation
  계약은 구현했지만 속도 인과와 제품 적절성은 여전히 `unknown`이다.
- #297의 dynamic effect acquisition, production browser/platform background lifetime,
  순수 mechanism-only 미래 변경의 locality, whole-capability authoring cost와 process
  effectiveness. 활성 Q4 case는 승인된 네 seam과 두 contract trace만 판정한다.
- #285 route AI comment 비용과 latency evidence
- Q2 production recovery·phase timing·N-instance topology evidence
- Q3 live sustained run, controlled provider amplification과 production fleet capacity evidence.
  Client-side closed/open admission과 report envelope는 구현했지만 service capacity를
  측정하지 않았다.
- Q5 cache와 lease의 multi-instance ownership evidence. Consumer policy, 정적 version guard,
  storage baseline, bounded retention control과 production migration-history reconciliation은
  완료했고 preset-title bounded policy도 #320에서 닫았다. 2026-07-31 이후 cleanup evidence는
  #319, fleet evidence는 #321이 소유한다.
- 파일럿 작성 비용 대비 신호에 대한 Human process cost-proportionality review. 2026-08-13의
  1차 감사가 제안한 장기 표본은 2026-08-14 bounded 5/5 결정으로 대체됐다. Human은
  현재 Lighthouse 저장소 사용에 한해 비용 비례성을 정성 승인하고 process owner
  verdict를 `maintain`으로 바꿨다. 비용 분모 일부는 계속 `partial / unknown`이며
  Architecture Fitness의 process-effectiveness도 `unsupported / unknown`이다. 추가 표본은
  만들지 않는다. 이후 qualifying route miss가 두 번 발생하면 Human이 routing을 다시
  검토한다. 채택된 감사 절차와 trigger는 `skill-governance-steward`가 소유한다.

Issue #272의 event identity와 해석 경계는 구현했다. Production outcome telemetry가
없으므로 outcome verdict는 계속 `unknown`이다.

## Contract Architecture Impact Review

Contract delta: pinned Architecture Fitness core와 Lighthouse profile을 같은 protected attestation authority 아래 확장하고, Q1·Q2·least-authority evidence의 exact-revision 결속을 강화한다.
Verdict: constrain-existing
Affected axes and current owners: Source of truth and authority; Observability and audit; Security and privacy; Cross-surface invariant ownership — `docs/architecture-fitness/`, `scripts/architecture-fitness/`, `.github/workflows/architecture-fitness-attestation.yml`
Decision: 기존 attestor와 profile registry를 유지하고 policy, collector, raw observation, signed evaluation의 역할을 분리한다. 각 profile은 지원하는 구조만 판정하고 unsupported runtime·process lens는 `unknown`으로 남긴다.
Rejected alternative: 별도 profile별 attestor나 Lighthouse 전용 verdict calculator를 만들면 protected authority와 unsupported 경계가 중복된다.
Evidence and structural defense: `scripts/architecture-fitness/lighthouse-profiles.mjs`, `scripts/architecture-fitness/authoritative-attestation.mjs`, `npm run architecture-fitness:validate`
Human decision required: no

Issue #284의 원래 contract delta는 범용 v2 review를 v0.4 least-authority executable contract와
protected authority로 바꾼 `reshape`였다. Q1 delta는 pinned core를 v0.5로 올리고 같은
authority·artifact 모델에 Issue #276 state-boundary profile을 추가했다. Q2 delta는 같은
trust boundary를 보존하면서 core를 v0.6.1로 올리고 topology-scope와 critical-path case를
한 profile에 추가했다. PR review에서 드러난 evidence 결속 경계는 v0.6.2로 보강했다.

이번 CAIR verdict는 `constrain-existing`이다. 기존 trust boundary와 attestor를 유지하고 profile
registry, profile-bound policy digest, 별도 raw/signed sub-bundle로 범위를 제한한다. 별도 Q1/Q2
attestor나 handwritten verdict calculator를 만드는 대안은 trust와 merge-policy 경계를 중복시키므로
거부했다. topology와 critical path는 한 테스트 프로세스를 공유해 비용을 줄이지만 case와
unsupported coverage는 합치지 않는다. Issue #284의 `reshape`와 Issue #276의 Human `keep`은 이 판정과 별개다. CAIR는 impact
분류를 계속 소유하고 Architecture Fitness는 실행 가능한 policy와 observation만 평가한다.

선택한 구조는 policy, collector, raw observation, unsigned local evaluation과 protected
authoritative host gate를 분리한다. Dirty source import 거부, collector와
production guard를 함께 묶은 definition digest, 실제 guard/test 종료 코드, exact revision,
unsigned/tampered `unknown`, invocation-bound run/artifact identity와 unsupported coverage 선언이
false `healthy`를 막는다.
구현 준수 리뷰에서 raw service-role client가 auth 밖으로 전달되면 lexical guard의 완전성을
증명할 수 없다는 근본 원인이 추가로 확인되었다. 이에 raw client를 registry-backed opaque
handle로 reshape하고, auth는 repository runtime을 import하지 않은 채 생성만, repository는
등록된 handle의 unwrap만 할 수 있도록 symbol/caller를 정적 가드로 고정했다. Repository 내부
wrapper를 통한 raw client laundering도 막기 위해
domain-access와 auth가 가져갈 수 있는 repository runtime symbol/caller를 명시적으로
등록했다. 중복된 DB/reviewed-paper 전용 검사 경로는 하나의 repository runtime 판정기로
합치되, collector가 추적하는 case-specific rule identity는 유지했다.

현재 revision에서는 inline-analysis cache repository도 opaque handle만 받고,
paper/version/canonical-input fingerprint의 exact tuple을 다루는 list/claim/complete/release
RPC 네 개만 export한다. Domain-access 한 곳만 이 symbol을 import할 수 있고 다른
repository의 RPC acquisition과 shared table 직접 접근은 별도 resource owner rule이
거부한다. 이 구조의 runtime 규모·lease 이동과 API/guard 비용 판단은 지원되지 않은
렌즈이므로 `unknown`을 유지하며 signed least-authority 결과로 덮지 않는다.

거부한 대안은 v2 `assess.py`를 유지하거나, 지원하지 않는 렌즈에 Lighthouse 전용
handwritten verdict calculator를 추가하는 것이다. 두 대안은 외부 core의 증거 권한과
unknown 의미를 약화한다.
