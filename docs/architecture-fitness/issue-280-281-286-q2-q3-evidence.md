---
type: design
---

# Issue #280·#281·#286 Q2·Q3 evidence 경계

이 문서는 Lighthouse의 deployment topology, critical path, sustained workload를
Human review용으로 기록하고 Q2 executable policy가 인용하는 consumer source를 소유한다.
문서 자체는 Architecture Fitness assessment가 아니다. 현재 pinned v0.9.1 core는
`least-authority`, `state-boundary`, `serialized-input-budget`, `topology-scope`,
`critical-path`, `workload-envelope`, `technical-grain`, `cache-lifecycle`을 지원한다. Q2의 process-local breaker scope와 first-ready
search await graph, Q3의 승인된 launch workload envelope는 included case다. Fleet/provider-account
hard cap, production latency·5xx·DB pool, real-provider amplification은 unsupported다.

## 상태와 범위

| 항목 | 값 |
| --- | --- |
| Issues | [#280](https://github.com/corca-ai/lighthouse/issues/280), [#281](https://github.com/corca-ai/lighthouse/issues/281), [#286](https://github.com/corca-ai/lighthouse/issues/286) |
| 구현 기준 base | `main@29e123c6019b5f5248333e81c66e1a048b39a27e` |
| 최신 runtime evidence revision | real-provider·controlled-provider `605ff8dfd17929a5615e343235176b01c42c9a26` (dirty `false`) |
| real-provider cold/warm aggregate | `q3-observed-cold-warm-provider-aggregate-2d9d12fa-20260716.json`, SHA-256 `22d635fc2938cc279b97225de5a6e390e017ae6a8f9bb0c0751c524dab6986e9` |
| breaker recovery aggregate | `q2-breaker-recovery-aggregate-2d9d12fa-20260716.json`, SHA-256 `31ba3f40e81a7305e864d5ddfd4d1f2027b0ac08b585c1d61fdd54bde2cce2fd` |
| production-mode admission calibration | `q3-production-mode-admission-calibration-a9c59f53-20260716.json`, SHA-256 `4a39d0d17146cd96188efdb75fee0064ce4496716159f209372e1eb55e26e676` |
| production-mode 4/16 calibration | `q3-production-mode-admission-calibration-17c3de1d-20260716.json`, SHA-256 `fe83e3e25e429de79aab4cc6c2ea8cef5991710525a1a9bb837b26bbfcb804ce` |
| exact-default 4/16 evidence | `q3-exact-default-4x16-e025ba1f-20260716.json`, SHA-256 `8b5f306de5a0e262d2b851f082b25b15145ad0c6fdfa6373922d071a72176e6e` |
| current-default 4/16 cold u20 | `q3-main-64624aa6-real-u20-cold-20260717.json`, SHA-256 `ed458e74ecc8e8db82e570ef7fdc25abfe8b2c1333c40bd7a3c63ceebe7eb7c2` |
| current-default 4/16 warm u20 | `q3-main-64624aa6-real-u20-warm-20260717.json`, SHA-256 `3bcc3cba669fa117d33cb37e6d9236e3ed8d869c14323aa5271dafc27a396d30` |
| current-default sustained-open | `q3-main-64624aa6-real-sustained-open-2ps-60s-20260717.json`, SHA-256 `c6548a91bfff5a61b5da371c9cbf94cab244673c0b3f86fe548551dbf25b0f31` |
| 8/12 candidate cold A / warm / cold B | `q3-main-64624aa6-real-u20-8x12-{cold,warm,cold-b}-20260717.json`, SHA-256 `e99217904e01b7e2dab5320a0bc128cdc097edc7f94434b16ed9b6c52028eb73`, `75e6f4e0bbfa69b88c21ea0fd91cb805ba90c9b6bbba2d2ad0d2b6229f106428`, `a3ff4cd4ade167097a240cb494d9a4e19c0958a4f72263fa8d91a5e514356280` |
| exact-default 8/12 cold A / warm / cold B | `q3-exact-default-8x12-a513207e-{cold-a,warm,cold-b}-20260717.json`, SHA-256 `14a1126a0628bd11af3f87d6423563db66bbe7fba785eff0f0ca8a81516952f8`, `5be932e03df8dfe784e0d9454c2a5ae5b6ee431db530c6521eec64371068958d`, `08c2f44c4306eaa4b692788243fceab9e48e2044142cb92b1081191185c07d29` |
| exact-default 8/12 sustained 2/s A / warm | `q3-exact-default-8x12-a513207e-sustained-open-2ps-60s-20260717.json`, `q3-exact-default-8x12-a513207e-sustained-open-2ps-60s-warm-20260717.json`; SHA-256 `a36f06eb4e27850f6bafab60a00b48b340364f684b3be7f09f64de2c75be5e9f`, `0a40bdfd047b03ffda54c424beb887f3206e61cbb0004d7fad58f88e91834470` |
| exact-default 8/12 sustained 1/s | `q3-exact-default-8x12-a513207e-sustained-open-1ps-60s-20260717.json`, SHA-256 `baf6845148dd712679f315fef92692530faa57b16339e7d578e5555ac63cf84a` |
| controlled provider amplification | `q3-provider-stats-binding-e11bfc5e-clean.json`, SHA-256 `998d7afadc23547af79c5d129d297ef487ceb553ed5a5d5777536e80a3ef5167`; 2 journey, provider 4/4 success, 2 calls/journey |
| 중간 Decision Log app 변경 뒤 exact-head Q3 refresh | historical `333951227bfa457099544574b20157418a28acde`; cold u20 20/20·p95 2756.1ms, sustained 1/s 60/60·p95 935.6ms, controlled u2 provider 4/4·2 calls/journey. 뒤이은 Decision Log 단일 정본화 변경 때문에 current report로 재사용하지 않음 |
| 최종 Decision Log 단일 정본화 뒤 exact-head Q3 refresh | historical `a32324afae58120533aec1ef864c13813c9e57d8`; cold u20 20/20·p95 2227.7ms, sustained 1/s 60/60·p95 780.8ms, controlled u2 provider 4/4·2 calls/journey. PR #341의 squash 병합으로 이 revision이 main의 조상이 아니므로 current report로 재사용하지 않음 |
| squash 병합 뒤 protected bootstrap Q3 refresh | checked-in `pilots/q3-workload/v5/{cold-u20,sustained-open-1ps-60s,controlled-u2}.report.json` @ `605ff8dfd17929a5615e343235176b01c42c9a26`; SHA-256 `6040852a53e0ec0f20f1e0f005ce706145efff553e2c951062b916f665027e94`, `47738014ecb544bbbb7a79a62e2d9874d269cfbd386ed32bb8c9c6809c4e972b`, `6ef8e6aaf13b735b9df96a3e4a392b318eb8cbfaeb3d279ba942de7b599852c6`; cold u20 20/20·p95 2907.2ms, sustained 1/s 60/60·p95 835.4ms, controlled u2 provider 4/4·2 calls/journey |
| Q2 checked-in exact-revision observation | `pilots/issue-280-281.observation.json`은 retained baseline `d3365127e26aec3aa1f856926fb7e22b4b501baf`를 policy `2026-09-03.v23`, collector `23`으로 재생하며 evidence 8개, observation 2개 `complete`, command exit 전부 0이다. E3 string paper reference와 bounded reviewed-library source를 trusted harness에 반영했지만 Q2 await·failure policy는 바꾸지 않는다. 이 checked-in baseline은 현재 E3 HEAD의 signed verdict가 아니며 새 protected exact-target rebind 전까지 local verdict는 `unknown`이다. |
| Q3 checked-in exact-revision observation | `pilots/issue-286-q3-workload.observation.json`은 내부 변경 기록 표면과 전용 projection 호환 분기를 제거한 v37 collector의 마지막 retained compatibility revision `ef9b2a0de67388e865ef0560ac26118a94821584`에 결속한다. evidence 9개, observation 1개, command exit 전부 0, completeness `complete` |
| exploratory provider calibration source | `c58a1e7a` + dirty worktree, owner `service owner`, executor Codex, raw artifact 미보존 |
| pinned core | Architecture Fitness `0.9.1` @ `6518ce21f0f755f85331ba7a8813772e4a43d51b` |
| machine coverage | Q2 process topology·first-ready critical path와 Q3 launch workload `included`; production/fleet와 real-provider amplification `unsupported` |
| machine verdict | Q2 checked-in observation은 complete지만 unsigned이므로 그 자체의 verdict는 `unknown`이며, protected signed-target 재결속은 별도 operator 단계로 남는다. PR #361의 Q3 protected profile은 `verified / healthy`; v37 checked-in observation도 complete하지만 unsigned이므로 그 자체의 verdict는 `unknown` |
| Human status | `Q3-local-machine-complete; production-evidence-needed` |
| CAIR | `constrain-existing` — Episteme cold-connect retry와 process-local admission 기본값 |

이 문서는 지원되지 않는 렌즈에 Lighthouse 전용 verdict calculator를 추가하지 않는다.
Static 구조와 deterministic test가 확인한 사실만 기록한다. Production timing과
multi-instance behavior는 실제 관측 전까지 `unknown`으로 남긴다. Provider allowance는
2026-07-16 service owner가 현재 Light House만 사용하는 사내 서비스
조건에서 동시 호출 20으로 승인했다. 과거 planning denominator 10의 decision record는
[PR #333](https://github.com/corca-ai/lighthouse/pull/333)이다. 2026-07-16 후속 Human 결정은
비공개 소수 코호트용 denominator 2와 제한 transport retry를 승인했다. 2026-07-17의
exact-revision 비교 뒤 process cap 8, lane별 queue 12로 기본값을 조정하는 controlled
trial도 승인했다. 이 Human policy는 machine observation과 합치지 않는다.

## Q2 deployment topology

### Executable machine scope

`issue-280:episteme-breaker-process-scope`는 Episteme circuit state, active slots와 waiters가
한 application process의 self-protection에만 속하는지 판정한다. Exact-revision AST inventory와
두 개의 독립 spawned process에서 한쪽만 breaker OPEN이 되는 behavior evidence가 모두 필요하다.
이 case가 `healthy`여도 fleet 또는 provider account 전체의 동시 호출 20 hard cap을 증명하지
않는다. 해당 렌즈는 `coverage:issue-280-provider-account-hard-cap`으로 분리해 `unknown`을
유지한다.

### 확인된 recovery owner

Gap report의 현재 recovery graph는 다음과 같다.

```text
status polling
→ stale queued 또는 core-persisted/enrichment-pending artifact 감지
→ bounded POST /api/gap-reports { gapReportId }
→ owner membership과 기존 artifact 확인
→ display-ready가 아니면 after() runner 재등록
→ after() 등록 실패 시 같은 job을 직접 시작
→ DB attempt/lease/CAS가 정확히 한 current attempt의 write를 허용
```

따라서 2026-07-12에 기록한 recovery owner 부재 finding은 현재 main에 적용되지
않는다. Client polling이 bounded recovery 재진입을 소유하고, durable artifact와
attempt/lease/CAS는 DB가 소유한다. Process-local runner는 artifact 정본이 아니다.

이 구조가 확인해 주지 않는 항목도 분리한다. Serverless function termination과 deploy
interruption 뒤 recovery 성공률, N-instance lease 경합, attempt 분포, 실제 provider
포화와 fleet concurrency는 runtime evidence가 없다. 이 항목은 `unknown`이다.

### topology evidence register

| evidence | 현재 확인 | 남은 증거 |
| --- | --- | --- |
| recovery trigger | stale progress를 본 client가 인증 POST를 시작한다. | production recovery frequency와 성공률 |
| durable authority | gap artifact, attempt, lease와 CAS는 Supabase DB가 소유한다. | N-instance lease contention과 stale write 관측 |
| execution carrier | `after()` runner와 direct fallback이 current attempt를 실행한다. | function termination·deployment interruption trace |
| provider protection | route deadline, provider timeout, bounded process-local control이 있다. Local single-process fixture에서 OPEN→HALF_OPEN→CLOSED와 15,283ms 회복을 관측했다. | production peak instance × effective concurrency, provider allowance와 multi-instance recovery |
| topology decision | 현재 serverless web/API 단일 runtime을 유지한다. | §3 trigger가 열릴 때만 별도 runtime을 재검토한다. |

## Q2 critical path

`issue-281:first-ready-search-payload`의 Human-approved milestone은 첫 ready search payload다.
이 milestone은 reviewed-library source, keyword search, library preflight를 모두 await한다.
Reviewed-library source와 library preflight 실패는 keyword payload로 degrade하고, keyword
search 실패는 ready 결과를 막는다. Await 참여와 failure ownership은 독립 축이다. 이 구분을
core v0.6.0에 적용하며 발견한 잘못된 subset 제약은 v0.6.1에서 수정했다. Exact-revision
static graph, 누락 await·failure isolation negative mutation, phase별 실제 failure-isolation test가
모두 필수다. v0.6.2는 필수 역할의 신뢰성을 역할별로 판정하고 topology 행동 증거를 실제 scope에
결속해 stale 부가 증거나 다른 phase·scope 테스트가 위반을 숨기지 못하게 한다. 이 case는
production p95/p99를 판정하지 않는다.

Q2 collector는 keyword-search 역할을 provider export 이름으로 식별하지 않는다.
`executeSearchFromUrl`의 호출이 TypeScript lexical symbol 기준으로 `search-service` named import에
직접 결속됐는지 확인한다. 같은 이름의 local shadow는 거부한다. 이어서 await 결과에서
`papers`·`total`·`source`를 구조 분해하는지를 검사한다. 이 조건을 만족하는 호출은 정확히
하나여야 한다. Collector는 찾은 revision별 export를 현재의 신뢰된 search execution test에
전달한다. 따라서 base와 target 사이의 이름 변경은 허용하지만, owner·await·결과 shape 또는
failure blocking 의미의 변경은 계속 거부한다. Exact provider seam과 owner는 Q4가 별도로 판정한다.

Observation의 `source`와 `sourceRevision`은 materialized target의 production source만
가리킨다. Trusted test와 probe는 target source로 가장하지 않고 collector
`definitionDigest`와 `<collector-authority>` command가 별도로 결속한다.

이 #401 세션은 현재 #280·#281 Q2 evidence 재결속만 소유한다. Human이 conditional
reshape를 승인했지만 prototype 구현을 defer한 #529와 그에 따른 Q4 repair는 이 정책과
관측의 명시적 제외 범위이며, 별도 #529 구현 세션 승인 없이 여기서 전파하지 않는다.

Search, route AI comment와 gap build의 현재 순서는 각각
`docs/runtime-flows/search-mechanism.md`,
`docs/runtime-flows/ai-response-generation.md`,
`docs/runtime-flows/gap-network-analysis.md`가 소유한다. 이 문서는 같은 순서를 새
정본으로 복제하지 않는다.

Gap path에서 deterministic test는 queued lost-runner와 core-persisted enrichment
recovery가 polling-owned POST로 재진입하는 동작을 검증한다. 이 증거로 production
critical-path latency를 추정하지 않는다. `after()` 실제 종료 시점, recovery로 인해
추가되는 latency, core-ready와 enrichment-ready의 사용자 milestone SLO는 관측되지
않았다.

| milestone | deterministic evidence | runtime evidence |
| --- | --- | --- |
| search first usable papers | load-smoke가 SSR paper identity와 search latency를 수집한다. Exact-revision local real-provider cold/warm u20은 각각 6/20 ready-with-papers였고 provider observation이 28/40 load-shed를 원인으로 연결했다. | production first-usable p99와 multi-instance provider phase는 `unknown` |
| route AI comment terminal result | bounded generation·nullable failure test와 runtime-flow가 있다. | production provider latency·duplicate generation은 `unknown` |
| gap durable pending → core | attempt/lease/CAS와 lost-runner recovery test가 있다. | production phase latency·termination frequency는 `unknown` |
| gap core → enrichment terminal | core-persisted recovery test가 있다. | enrichment recovery frequency와 p99는 `unknown` |

## Q3 workload와 sustained admission

현재 rail은 report v5를 쓴다. v5는 기존 one-shot incident rail과 네 workload mode를
유지하면서, 검색 결과 수 대신 첫 등장 순서의 paper ID를 보존한다. 기존 Q3 baseline의
v4 report는 immutable evidence로 남고 collector의 v4 경로가 `paperCount`를 읽는다. 새
v5 경로는 `paperIds`만 읽으며 빈 ID, 중복 ID, v4 count alias를 거부한다. ID 목록은
exact-result 관측의 입력이며 expected-item 일치나 topic relevance 판정은 아니다.

Optional loopback fixture binding은 fresh zero baseline과 drain 뒤 final stats를 같은
report에 넣는다. 실제 profile·paper count·request/response count·max in-flight·journey당
call amplification을 귀속한다. Binding이 없으면 provider evidence를 추정하지 않는다.

| mode | arrival 의미 | boundedness |
| --- | --- | --- |
| `one-shot` | N개 first-session journey를 동시에 한 번 시작한다. | N으로 제한한다. |
| `ramp` | one-shot cohort를 순서대로 실행한다. | 선언한 step으로 제한한다. |
| `sustained-closed` | 고정 worker가 완료 뒤 다음 journey를 시작한다. | concurrency와 duration이 admission을 제한한다. |
| `sustained-open` | 완료와 무관한 고정 rate로 arrival을 예약한다. | duration과 `maxInFlight`가 admission을 제한한다. 초과 arrival은 client shed로 기록한다. |

지속 부하 실행은 duration, concurrency 또는 arrival rate, input profile, provider
profile, topology profile과 run owner가 없으면 시작하지 않는다. Report는 exact target
Git revision, working-tree dirty 상태, warm-up 0초와 admitted work를 drain하는
cool-down policy를 함께 기록한다. Dirty report는 exact-revision baseline으로 쓸 수
없다. 실행 중 HEAD 또는 clean/dirty 상태가 바뀌면 report 생성을 중단한다.

Deterministic scheduler test는 다음 client-side invariant를 검증한다.

- Closed model은 선언한 worker 수보다 많은 journey를 동시에 실행하지 않는다.
- Open model은 completion과 독립된 fixed-rate arrival을 만든다.
- `maxInFlight`를 넘는 arrival은 대기열에 넣지 않고 shed로 센다.
- 완료 순서가 바뀌어도 admitted journey identity는 `0..N-1`로 보존한다.
- Sustained verdict는 admitted journey 전원 완료와 client shed 0건을 요구한다.

이 test는 서비스 capacity test가 아니다. Load-smoke report 자체에는 server queue
depth·wait와 provider call·retry·429·5xx·cancellation이 없지만, exact-revision runtime은
같은 chokepoint에서 privacy-safe one-line causal record를 남긴다. 현재는 두 artifact를
자동 결합하지 않으므로 observation sequence와 실행 window를 수동으로 대조한다.
`provider-profile`은 evidence label이며 controlled failure를 주입하지 않는다. Label과 실제
fixture 또는 승인된 live provider window를 연결하는 근거가 없으면 provider behavior는
`unknown`이다.

### 2026-07-15 controlled local ramp

Issue #286의 higher-ramp 요구에 따라 같은 clean revision에서 fixture와 Next.js를
프로필마다 새로 시작하고, 20→35→50→75→100 one-shot cohort를 순서대로 실행했다.
Representative fixture는 검색당 3편, maximum fixture는 현재 provider 요청 상한인
40편을 실제로 반환했다. Maximum profile의 SSR 가시 window는 10편이므로 journey의
ready paper count는 10으로 관측되지만, fixture 설정·통계와 Next search timing은
provider 응답 40편을 확인했다.

| users | representative ready / total | representative query p95 | maximum ready / total | maximum query p95 |
| ---: | ---: | ---: | ---: | ---: |
| 20 | 16 / 20 | 1339.7ms | 18 / 20 | 1591.8ms |
| 35 | 35 / 35 | 1503.3ms | 35 / 35 | 1668.0ms |
| 50 | 38 / 50 | 2043.9ms | 36 / 50 | 2713.6ms |
| 75 | 42 / 75 | 3783.2ms | 46 / 75 | 3921.5ms |
| 100 | 41 / 100 | 5460.6ms | 42 / 100 | 5457.9ms |

모든 cohort에서 5xx·timeout·network error는 0이었다. 그런데 두 프로필 모두 20명에서
일부 journey가 `ready-empty`로 끝나 첫 관측 break가 20명이었고, 35명은 전원
ready-with-papers로 통과했다. 50명부터 ready-empty가 다시 늘었으며, 75명부터는
3000ms query p95 예산도 함께 넘었다. 이 비단조 단일 실행은 20명을 안정된 capacity
boundary로 증명하지 않는다. Cold-start와 run-to-run variance를 분리한 반복 측정이
필요하다.

Representative fixture는 354 calls, maximum fixture는 360 calls를 받았고 모두 success,
max in-flight 1이었다. 이 수치는 실제 input cardinality와 provider 호출 수를 확인하지만
ready-empty의 원인을 설명하지 않는다. Server queue wait·retry·cancellation과 causal
failure phase가 report에 없으므로 원인은 `unknown`이다. Local gitignored report는
`reports/load-smoke/issue-286-representative-ramp.json`과
`reports/load-smoke/issue-286-max-cardinality-ramp.json`이다.

### 2026-07-16 Episteme exploratory allowance calibration

Service owner는 Episteme가 현재 Light House만 사용하는 사내 서비스라는
운영 조건에서 동시 호출 allowance 20과 임시 planning denominator 10을 승인했다. 이 값은
[PR #333](https://github.com/corca-ai/lighthouse/pull/333)에 남긴 Human policy이며 machine
observation이나 Architecture Fitness verdict가 아니다.

아래 호출은 source base `c58a1e7a`의 dirty worktree에서 Codex가 service owner의 로컬
자격증명으로 2026-07-16에 실행했다. Direct-provider 호출은 application revision에 의존하지
않지만 raw per-call artifact와 command digest를 보존하지 않았다. 따라서 수치는 exploratory
aggregate일 뿐 exact-revision Architecture Fitness evidence나 production capacity 판정으로
사용하지 않는다.

실제 `POST https://sah.borca.ai/papers/batch` 한 편 batch로 다음 범위를 분리해 관측했다.

- 단일 HTTP/2 연결의 동시 stream 20개는 client-observed overlap 20에서 20/20 `200`,
  p95 1,015ms, 최대 1,017ms였다.
- production shape에 가까운 IPv4 `fetch` 10묶음×2개, 묶음 간 50ms stagger는
  client-observed overlap 20에서 20/20 `200`, p95 1,876ms, 최대 1,927ms였다.
  10묶음은 client-side 호출 grouping이며 Vercel process 10개를 관측했다는 뜻이 아니다.
- IPv4 TCP 연결 20개를 같은 시점에 연 worst case는 실제 product timeout 30초에서도
  18/20 `200`이고 2개가 10,538ms에 `UND_ERR_CONNECT_TIMEOUT`으로 끝났다. 따라서 한
  process에서 20개 connection을 동시에 여는 shape는 승인 근거로 쓰지 않는다.
- 보호된 Vercel preview `dpl_BMCBLDphqFFW1KjoSC5oY2tb5b2f`의 20-request burst는
  3개 process, 실제 provider overlap 최대 3, `200` 18건, process-local queue shed `502`
  1건, client transport error 1건이었다. 이 run은 Episteme 20 동시 처리력을 시험하지
  못했으며 Vercel process 배치와 local queue 동작만 관측했다.

Runtime 기본 계산은 allowance 20 / Human이 선택한 임시 planning denominator 10 =
process당 2를 사용한다. Denominator 10은 관측한 Vercel process 상한이 아니다.
Process-local counter라 N개 process의 최대 동시 provider work는 `2×N`이고 N이 10을 넘으면
전역 20을 집행하지 못한다. 따라서 이 설정은 현재 내부 단독 사용 조건의 controlled
production trial만 승인하며 global hard cap이나 cohort-open capacity verdict가 아니다.
Production peak process와 provider 5xx/p99를 같은 deployment window에서 관측하기 전에는
상태를 올리지 않는다. 이 exploratory observation은 지원되지 않는 general scalability
렌즈를 `healthy`로 바꾸지 않으며 Q2·Q3 machine verdict는 계속
`unsupported / unknown`이다.

### 2026-07-16 exact-revision causal cold/warm과 breaker recovery

Clean revision `2d9d12fa20fd351c4aefbf09bde0269d295cb16e`에서 local Next 단일
process를 실제 Episteme에 연결하고 같은 process에서 one-shot u20을 cold와 warm으로
연속 실행했다. 검색어는 일반적인 `transformer attention`이었다. Human이 승인한 provider
allowance는 20이었고, process의 유효 capacity는 2 active + queue 4였다.

| run | ready / total | query p95 | provider observation | verdict |
| --- | ---: | ---: | --- | --- |
| cold | 6 / 20 | 3126.2ms | logical 40, actual fetch 12, queued 10, load-shed 28, queue-wait p95 2303ms | `NO-GO` |
| warm | 6 / 20 | 2691.6ms | logical 40, actual fetch 12, queued 10, load-shed 28, queue-wait p95 1865ms | `NO-GO` |

두 실행 모두 HTTP 5xx·timeout·network error는 0이었고 회로는 전 구간 CLOSED였다.
Active slot 최대 2와 queue depth 최대 4가 설정과 일치했다. Warm에서 latency는
내려갔지만 ready 수와 load-shed 수가 같았으므로 cold-start가 주원인이 아니다. 단일
process u20의
`ready-empty` 14건은 process-local admission 경계가 provider 호출 전 28/40 logical calls를
차단한 결과로 연결된다. 이 local NO-GO를 production absolute capacity나 multi-instance
fleet verdict로 환산하지 않는다.

별도의 checked-in fixture 실험은 같은 clean revision과 단일 Next process에서 첫 5회
provider 500으로 회로를 OPEN시킨 뒤 fixture만 healthy로 교체하고 500ms 간격으로 bounded
journey를 보냈다. 5번째 500은 process uptime 14,591ms에서 OPEN을 만들었고, 49회
`circuit-open` fast-fail 뒤 첫 HALF_OPEN probe가 uptime 29,874ms에 200으로 성공해 CLOSED로
복귀했다. OPEN→첫 성공은 15,283ms로 configured cooldown 15,000ms와 일치했다. 이는
process-local recovery control 증거일 뿐 production recovery frequency/success rate,
function termination, multi-instance recovery 증거가 아니다.

Cold/warm 원본 report SHA-256은 각각
`e0f3e23506c40d0579ce13a04798f5727ba31e4e13a0d8989ddb30cb6cd10852`,
`2006bff9cdb99896472f3ce4b176bb6abae7949a46178a1ed06dcde97428cd77`이다. Query·전체
URL·paper id·body·principal·인증정보는 provider aggregate에 기록하지 않았다.

### 2026-07-16 dirty admission·cold-connect retry calibration

Base `ba8fac4b`의 dirty worktree에서 service owner가 승인한 후보들을 실제 Episteme와
단일 local Next process로 비교했다. 이 실행은 exact-revision Architecture Fitness evidence가
아니며 후보 선택용 Human-review evidence다. Transport retry는 `ETIMEDOUT`과
`UND_ERR_CONNECT_TIMEOUT`만 같은 breaker slot 안에서 최대 1회 허용했고 HTTP 429·5xx는
재시도하지 않았다. Provider observation의 `retryCount`는 논리 호출 안의 실제 추가 fetch를
기록했다.

| config / cohort | cold 결과 | provider observation | Human review |
| --- | --- | --- | --- |
| 8 active + queue 12 / u20, process A | 18/20 ready, query p95 3697.4ms | logical 40, actual fetch 45, retry 5, final timeout/network 2, circuit CLOSED | `NO-GO` |
| 8 active + queue 12 / u20, process B | 20/20 ready, query p95 3891.9ms | logical 40, actual fetch 45, retry 5, final failure 0, circuit CLOSED | `NO-GO` |
| 10 active + queue 10 / u20 | 11/20 ready, query p95 2954.0ms | logical started 14, actual fetch 21, retry 7, final timeout/network 3, circuit OPEN | `NO-GO` |
| 6 active + queue 14 / u10, process A | 10/10 ready, query p95 2759.1ms | logical/actual 20/20, retry 0, circuit CLOSED | `PASS` candidate |
| 6 active + queue 14 / u10, process B | 10/10 ready, query p95 2896.2ms | logical 20, actual fetch 22, retry 2, final failure 0, circuit CLOSED | `PASS` candidate |

8/12와 10/10 u20 실패는 active provider allowance 20 자체보다 local cold connection
establishment, retry 동안의 slot 점유, minimum 5 observation에서 3/5가 먼저 완료될 수 있는
breaker ordering이 결합한 결과였다. 6/14는 이전 active 2보다 세 배 높고 세 process가
동시에 포화돼도 active 합계 18로 allowance 안이다. 네 process 포화에서는 24가 될 수 있어
global hard cap은 아니다. 서로 다른 runtime id 네 개가 한 window에 보였다는 사실만으로
동시 포화를 판정하지 않고, 실제 active overlap 또는 provider incident가 재중앙화 trigger다.

이 결과는 소수 코호트 u10 후보만 지지했다. U20, sustained capacity, production fleet,
provider p99/5xx, Supabase pool p95는 계속 `unknown` 또는 운영 `NO-GO`다. 후속 clean
production-mode 비교는 아래 exact-revision calibration에 분리한다.

### 2026-07-16 clean production-mode admission calibration

Clean `a9c59f53962d574ca6b87ae843803196b4402c5b`를 local optimized production build로
실행하고 매 run마다 새 Node process를 사용했다. 기본 `6/14`와 env override `5/15` 모두
같은 코드·실제 Episteme·u10 query/follow-up 20 logical calls 조건이다. Local aggregate는
`q3-production-mode-admission-calibration-a9c59f53-20260716.json`, SHA-256
`4a39d0d17146cd96188efdb75fee0064ce4496716159f209372e1eb55e26e676`이다.

| config / run | readiness / query p95 | provider observation | verdict |
| --- | --- | --- | --- |
| 6 active + queue 14 / A | 10/10, 2394.4ms | logical/actual 20/20, retry 0, circuit CLOSED | `PASS` |
| 6 active + queue 14 / B | 9/10, 3333.4ms | logical 20, actual 24, retry 4, final timeout/network 1, circuit CLOSED | `NO-GO` |
| 5 active + queue 15 / A | 10/10, 2248.0ms | logical/actual 20/20, retry 0, circuit CLOSED | `PASS` |
| 5 active + queue 15 / B | 10/10, 2321.3ms | logical 20, actual 23, retry 3, circuit CLOSED | `PASS` |
| 5 active + queue 15 / C | 10/10, 2701.7ms | logical 20, actual 23, retry 3, circuit CLOSED | `PASS` |

`5/15`는 process당 전체 admission 20을 유지하면서 cold connection active pressure만 낮춘다.
이전 active 2보다 2.5배 높고 네 process가 동시에 포화돼도 active 합계 20으로 allowance
안이다. 다섯 process 포화에서는 25가 될 수 있어 global hard cap은 아니다. 이 비교는
기본값 선택 근거이며 `5/15` default가 들어간 후속 exact clean revision, u20, sustained
capacity 또는 production fleet 증거를 대신하지 않는다.

### 2026-07-16 clean production-mode 4/16 follow-up calibration

`5/15`를 기본값으로 둔 clean `17c3de1d745495f9e93d3b5a4c8e591a62ea4bf1`의 첫
cold u10은 query p95 2,493.2ms였지만 9/10 ready였다. 20 logical calls는 모두 admission됐고
actual fetch 23·retry 3 뒤 timeout/network 최종 실패 1건이 남았으며 circuit은 CLOSED였다.

같은 optimized build에서 env로 `4/16`을 적용하고 새 Node process 다섯 개를 독립 실행했다.

| run | readiness / query p95 | provider observation | verdict |
| --- | --- | --- | --- |
| A | 10/10, 2649.9ms | actual 20, retry 0, queue p95 1719ms, circuit CLOSED | `PASS` |
| B | 10/10, 2286.4ms | actual 20, retry 0, queue p95 1497ms, circuit CLOSED | `PASS` |
| C | 10/10, 2622.3ms | actual 20, retry 0, queue p95 1817ms, circuit CLOSED | `PASS` |
| D | 10/10, 2538.1ms | actual 20, retry 0, queue p95 1702ms, circuit CLOSED | `PASS` |
| E | 10/10, 2926.5ms | actual 21, retry 1, queue p95 2013ms, circuit CLOSED | `PASS` |

Aggregate는 `q3-production-mode-admission-calibration-17c3de1d-20260716.json`, SHA-256
`fe83e3e25e429de79aab4cc6c2ea8cef5991710525a1a9bb837b26bbfcb804ce`이다. 총 100
logical calls에서 최종 실패는 0이었다. `4/16`은 process당 전체 admission 20을 유지하면서
active를 기존 2의 두 배로 둔다. 다섯 process 포화까지 active 합계 20으로 allowance 안이고,
여섯 process 포화에서는 24가 될 수 있어 global hard cap은 아니다. 이 local single-process
u10 비교는 후보 선택 근거이며 `4/16` default exact revision, u20, sustained 또는 production
fleet capacity를 대신하지 않는다.

### 2026-07-16 exact-default 4/16 confirmation

`4/16`을 코드 기본값으로 둔 clean
`e025ba1f03e6c2295e57d95e051b22bc6f34cb3e`를 다시 optimized build했다. Episteme capacity
env override가 없는 새 Node process 두 개에서 cold u10을 실행했다.

| run | readiness / query p95 | provider observation | verdict |
| --- | --- | --- | --- |
| A | 10/10, 2541.4ms | logical 20, actual 22, retry 2, queue p95 1728ms, circuit CLOSED | `PASS` |
| B | 10/10, 2349.3ms | logical/actual 20/20, retry 0, queue p95 1683ms, circuit CLOSED | `PASS` |

Aggregate는 `q3-exact-default-4x16-e025ba1f-20260716.json`, SHA-256
`8b5f306de5a0e262d2b851f082b25b15145ad0c6fdfa6373922d071a72176e6e`이다. 앞선 동일
`4/16` env calibration 다섯 run과 합치면 local production-mode cold u10은 7/7 PASS다.
이는 소수 코호트용 local candidate를 지지하지만, 단일 query·one-shot·single-process
증거다. U20은 NO-GO이고 sustained capacity, production fleet, provider p99/5xx, Supabase
pool p95는 여전히 `unknown` 또는 운영 `evidence-needed`다.

### 2026-07-17 current main 4/16 burst와 sustained 분리

Clean main `64624aa6e7e91678ee2e428027a3490fdba30006`의 optimized build를 capacity env
override 없이 실행했다. Cold와 warm burst u20은 모두 20/20 ready-with-papers이고 HTTP
5xx·timeout·network error는 0이었지만 query p95가 각각 3,898.6ms와 3,808.9ms여서
3초 SLO를 넘었다. Cold와 warm이 함께 실패했으므로 cold start만으로 설명하지 않는다.

같은 exact revision의 별도 `sustained-open` 2 journeys/s·60초 run은 120 arrival을 모두
admit·complete했고 120/120 ready-with-papers, client shed 0, HTTP error 0이었다. Query
p50/p95/p99는 643.8/884.2/1,138.1ms, max in-flight는 4, achieved throughput은
1.97 journeys/s였다. 따라서 4/16은 이 local steady-state rate에서는 안정적이지만 동시
u20 burst의 queue accumulation 때문에 SLO를 실패한다. 두 workload를 하나의 capacity
점수로 합치지 않는다.

### 2026-07-17 8/12 current-revision candidate

같은 clean `64624aa6` build에만 `EPISTEME_MAX_CONCURRENCY_PER_INSTANCE=8`,
`EPISTEME_MAX_QUEUE=12`를 적용했다. 새 process cold A, 같은 process warm, 다시 새 process
cold B의 u20 결과는 다음과 같다.

| run | readiness / query p95 | p99 / HTTP error | verdict |
| --- | --- | --- | --- |
| cold A | 20/20, 2497.2ms | 2770.7ms / 0 | `PASS` |
| warm | 20/20, 2424.1ms | 5161.7ms / 0 | `PASS` — p99 outlier는 별도 production 관측 대상 |
| cold B | 20/20, 2601.2ms | 2611.9ms / 0 | `PASS` |

현재 p95 gate에서는 3/3 PASS다. 단일 process는 active 8까지만 provider work를 시작하고
12개를 lane queue에 받아 admission 20을 유지한다. 두 process가 동시에 포화되어도 active
합계 16으로 승인 allowance 20 안이지만, 세 process 포화에서는 24가 될 수 있다. 따라서
8/12는 비공개 소수 코호트의 controlled trial 후보이지 global hard cap 또는 production
fleet capacity 증거가 아니다. 서버 observation은 circuit CLOSED와 capacity를 확인했지만
report에 provider call·retry·outcome을 자동 결합하지 않았으므로 그 aggregate는 판정하지
않는다.

### 2026-07-17 exact-default 8/12 confirmation

기본값을 8/12로 바꾼 clean content revision
`a513207e767183d1d110a4b97b39b4c3bb33f61a`를 다시 optimized build하고 capacity env
override 없이 실행했다. 새 process cold A, 같은 process warm, 다시 새 process cold B의
burst u20은 모두 20/20 ready, HTTP error 0, query p95 2,567.8/2,498.5/2,653.0ms로
3/3 PASS했다. Server observation은 실제 `maxConcurrency=8`, `maxQueue=12`, circuit
`CLOSED`를 확인했다.

Sustained-open 2 journeys/s·60초는 두 번 모두 120건을 admit·complete하고 client shed와
HTTP error가 0이었으며 query p95도 1,023.6ms와 968.7ms였다. 그러나 각 run의 서로 다른
journey 한 건이 `ready-empty`여서 둘 다 119/120으로 NO-GO다. 두 번째 window의 전체
provider observation 240건은 239건 200 success, 1건은 connect-timeout retry 1회 뒤에도
`timeout-or-network`로 끝났고 circuit은 계속 CLOSED였다. Max in-flight 6, provider queue
0이므로 이 failure를 8/12 포화로 설명하지 않는다.

같은 warm process의 1 journey/s·60초는 60/60 admit·complete·ready, client shed와 HTTP
error 0, query p95 1,121.3ms, max in-flight 3으로 PASS했다. 해당 window의 provider
observation 120건도 모두 200 success, retry 0, queue 0, circuit CLOSED였다. 따라서 현재
local steady envelope는 1/s까지 지지하고 2/s에서는 latency가 아니라 provider 결과
가용성이 반복 NO-GO다. Production absolute capacity로 환산하지 않는다.

Decision Log를 포함한 `app/**` 변경 뒤 compatibility guard가 기존 report를 의도대로
거부했다. Guard 예외를 추가하지 않고 clean `333951227bfa457099544574b20157418a28acde`를
다시 빌드해 세 launch scenario를 재측정했다. Cold u20은 20/20 ready·p95 2,756.1ms,
sustained-open 1/s·60초는 60/60 ready·p95 935.6ms, controlled u2는 provider 4/4
success·2 calls/journey였다. 세 report는 모두 schema v4이며 같은 clean revision에
귀속됐다.

그 뒤 review에서 Decision Log가 exact metric을 중복 소유해 쉽게 stale해지는 문제가 드러났다.
Decision Log에는 안정적인 결과만 남기고 exact revision·p95·artifact digest는 이 문서가 단독
소유하도록 바꿨다. 이 `app/**` 변경도 compatibility guard를 우회하지 않고 clean
`a32324afae58120533aec1ef864c13813c9e57d8`를 다시 optimized build해 세 scenario를 최종
재측정했다. Cold u20은 20/20 ready·p95 2,227.7ms, sustained-open 1/s·60초는 60/60
ready·p95 780.8ms, controlled u2는 provider 4/4 success·2 calls/journey였다. 당시 checked-in
report였지만 뒤의 ancestry refresh로 교체됐다. 두 refresh 모두 local single-process evidence라
production unknown을 닫지 않는다.

PR #341은 저장소 관례에 따라 squash 병합됐고, 그 결과 위 `a32324af` 실측 commit이 새 main의
조상이 아니게 됐다. Collector는 같은 guarded tree라는 사실만으로 ancestry를 우회하지 않고
해당 report를 `partial`로 거부했다. 새 main의 조상 `605ff8df`에서 승인된 세 scenario를 다시
실측했다. Dev compiler 최초 실행이 섞인 첫 u20은 20/20 ready·오류 0이었지만 p95 4,060.1ms로
실패해 기준에서 제외했고, compiler 준비 뒤 bound run은 20/20 ready·p95 2,907.2ms로 PASS했다.
Sustained-open 1/s·60초는 60/60 ready·shed/error 0·p95 835.4ms, controlled u2는 provider
4/4 success·2 calls/journey였다. 현재 v5 report는 이 세 PASS run만 가리킨다. PR #360은
merge commit `d45db37a`로 병합됐고 measurement commit `605ff8df`가 main의 조상임을 확인했다.

Base-owned workflow는 target의 새 collector를 실행하지 않는다. 그래서 PR #360에서는 base
v4가 읽는 기존 report 경로를 byte-identical하게 보존하고 v5 report를 versioned 하위 경로에
추가했다. Protected run `29552675027`은 v4의 ancestry-broken Q3를 `verified / unknown`으로
서명해 이행 경계가 fail-closed임을 확인했다. Merge 뒤 v5 collector가 trusted base가 되었으므로
PR #361은 임시 v4 report를 삭제했다. Final protected run `29554384006`이 v5 보고서와 exact
target을 `verified / healthy`로 판정했다.

PR #338은 guarded product tree를 바꾸므로 v5 기준 보고서를 그대로 재사용할 수 없다.
v6 전환은 삭제한 v4 경로를 되살리지 않는다. `v6-active` 경로에는 브리지 병합 시점의 v5
보고서를 byte-identical하게 둔다. Collector는 각 시나리오에 현재 main의 v5
report·measurement revision·guarded-tree digest와 PR #338의 clean 실측 tuple을 정확히
선언한다. 첫 브리지 PR은 base-owned v5 collector가 기존 정본 보고서를 읽어 판정했다. 이어지는
base-authority guard PR은 active 경로를 byte-identical하게 유지한 채 trusted negative guard가
두 exact tuple과 별도 v5 정본을 모두 이해하도록 만든다. 이 guard가 trusted base가 된 뒤에만
PR #338이 active report를 교체한다. 각 단계에서 digest, revision, guarded tree 중 하나가 맞지
않으면 실패한다. 이 전환은 PR #361의 protected 판정을 대체하지 않으며 production coverage도
계속 `unsupported / unknown`으로 남긴다.
PR #338의 protected exact-target 판정과 병합이 끝나면 Lighthouse operational-readiness owner가
다음 base-authority 전환 PR에서 `v6-active`를 보존한 채 PR #338 report를 versioned 정본으로
복제하고 새 collector와 policy가 그 정본만 읽도록 바꾼다. 이 PR이 병합되어 새 collector가
trusted base가 된 뒤 별도 cleanup PR에서 v5 baseline tuple과 `v6-active` 경로를 삭제한다.

PR #338의 마지막 AI comment 여백 패치, review-response 보완, 승인된 표시 계약 정합성 수정은
기존 PR #338 실측 tree에서 AI comment 간격, 논문 카드 metadata 표시·접근성 이름,
Fragment-wrapped 부가 슬롯, 관련 테스트, PR #338 Decision Log 동기화만 바꾼다. 계약 문서와
event Aspect 연결은 guarded tree 밖에 있고, guarded tree에서 계약 재검토 뒤 추가로 바뀐
경로는 기존 아홉 경로에 이미 포함된 Decision Log message뿐이다. Provider fetch, search
execution, admission, readiness detection, Supabase, proxy, Next 설정, package lock은 바꾸지
않는다. v23 collector는 실측 report·measurement revision·기준 guarded-tree binding을 그대로
유지한다. 대신 Human이 2026-07-18에 승인한 최종 reviewed tree digest
`fa893beae3fd25bdf585a0c8df17b028ec07236d62723e93641f29591f1045e9`와 아홉 guarded 경로의
정확한 diff가 동시에 일치할 때만 `human-reviewed-compatible-tree`로 분류한다.
Fresh clone에 measured revision commit 객체가 없을 때는 PR #338 measurement tuple에만
선언한 `accept-exact-reviewed-target` mode 아래에서 report digest·target revision·profile
binding을 먼저 확인한다. 원 measurement revision `a02caaf…`, 원 measured guarded-tree
digest `ad206128…`, exact report ref·digest, Human decision ref·경로 manifest가 base-owned
immutable tuple과 모두 일치한 뒤에만 exact target digest를 Human review와 직접 대조한다.
일치할 때만 `human-reviewed-exact-tree-measurement-unavailable`로 분류한다. 이 분기에서는
런타임 diff인 `changedPaths`를 비우고, 잠근 아홉 경로를 `reviewedChangedPaths`로 구분하며
`changedPathsVerifiedAtRuntime: false`를 기록한다. Mode가 없거나 원 measurement, digest,
report, review binding 중 하나라도 다르면 fail-closed다. 이 분기는 새 실측을 만들거나 3초
예산을 완화하지 않는다.

PR #338이 2026-07-18 최신 main의 production auth callback 복구를 병합한 integration tree는
guarded-tree digest
`ea909751493d6a5730279b0ed9717d29e7123166deeaef9cb207edd5057eaf01`과 정확한 열두 경로
합집합으로 별도 승인한다. 이 tuple은 standalone PR #338 아홉 경로와 auth-only 세 경로를
각각 통과했다는 이유로 임의 조합을 허용하지 않는다. 결합 digest·Human decision
ref·열두 경로 manifest가 모두 맞을 때만 기존 PR #338 measurement에 compatible하며,
누락·추가·순서 변경은 fail-closed다. Fresh clone 예외도 base-owned unavailable binding에
standalone과 integration 두 tuple이 모두 정확히 선언됐을 때만 열린다.

2026-07-18 production 인증 incident의 구조적 방어는 같은 Q3 보호 트리 안의
`app/api/auth/magic-link/__tests__/production-auth-config.test.ts`,
`app/api/auth/magic-link/__tests__/route.test.ts`, `supabase/config.toml` 세 경로만 바꾼다.
변경 내용은 production alias의 same-origin PKCE callback과 Supabase redirect allowlist를
검증·선언하는 것이며 provider fetch, search execution, admission, readiness detection,
workload profile은 바꾸지 않는다. Human이 위임한 임시 판단에 따라 이 exact path set과
guarded-tree digest
`4be8a4050a45a467c32744dae8a3fd2f87776a996cec68f8a390bb3a9ce29b5b`만
`human-reviewed-compatible-tree` 후보로 승인한다. Base-owned collector가 먼저 이 tuple을
신뢰하도록 authority bridge를 병합한 뒤에만 인증 수정 PR을 평가한다. 경로·digest가 하나라도
달라지거나 measured revision을 읽을 수 없으면 실패하며, PR #338 전용
`accept-exact-reviewed-target` 예외를 이 인증 변경에 확장하지 않는다. 이 판단은 기존 Q3
실측이나 production workload evidence를 새로 만들지 않고, 마지막 Human 점검 전까지
위임된 임시 결정으로 보고한다.

PR #379의 정본 host 전환은 위 integration tree에 compatibility host 전용 308 rule과 회귀
테스트, 내부 Decision Log를 더한다. 공개 `/about/changes`는 Human 결정에 따라 복원하지 않아
guarded tree에 들어오지 않는다. `next.config.ts` rule은 `search.themoonlight.io` host에만
적용되고 canonical·local measured route 실행은 그대로 둔다. Provider fetch, search execution,
admission 8/12, readiness detection, workload profile도 바꾸지 않는다. v23 collector는 exact
content revision `ab222c3ea29c4f659f5e5ed8b5dcb96f470b1935`의 guarded-tree digest
`687cb5c089fe368a002eeb406e84ec54c7b114fa54734c4ede565611c9a89bd2`와 measurement
revision 이후의 정확한 17개 changed path가 함께 일치할 때만 이 tree를
`human-reviewed-compatible-tree`로 분류했다. 현재 v30 fresh-clone unavailable binding은 기존
PR #338 tuple, standalone·integration·PR #379·수정된 PR #381 hydration·PR #386
skill-runtime·Issue #208 error-catalog·principal fixture·stale fixture/CSS cleanup·gap lifetime
회귀 테스트·Issue #399 URL byte budget과 review fix 결합 tree까지 열
Human-reviewed tree가 모두 정확할 때만
열린다. Digest, decision ref, rationale, path 누락·추가·순서 변경을 각각 negative test가
fail-closed로 거부한다. 이 compatibility는 기존 Q3 실측을 새로 만들거나 production
`unknown`을 줄이지 않는다.

PR #381 hydration 안정화는 검색 paper projection을 첫 commit의
id/title/year/citationCount로 고정하고, card detail만 뒤에서 보강한다. 초기 hydration이나
repair의 정상적인 빈 200은 lightweight 카드를 보존하고 즉시 `repairAttempted`를 기록한다.
개별 provider 오류·abort는 successful-empty로
바꾸거나 marker를 남기지 않고 기존 직렬 최대 3회 client retry로 돌린다. 세 번 모두
실패하면 lightweight 결과를 보존한 `ready + repairAttempted:true` degraded terminal로
닫아 faceted AI comment 대기와 repair 재큐잉을 함께 종료한다. v23 collector는 exact content
revision `f1d2173140b03b77a4c7cb8346eb88d9fa92f5ad`의 guarded-tree digest
`034443c37027d0a49a9ec64a34e494c2e43c9f5aab9c277b826d8b1e157327e2`와 measurement
revision 이후의 정확한 38개 changed path가 함께 일치할 때만 이 tree를
`human-reviewed-compatible-tree`로 분류한다. Review 뒤 terminal 의미가 수정된 이전
`9b5d474f…` / `a0274af2…` tuple은 active compatibility에서 퇴역했다. Healthy-provider
fan-out·arrival·concurrency·deadline은 바뀌지 않지만, 이 호환성은 새 latency,
production-health 또는 real-provider 증거가 아니다.

PR #386은 repository 정본 skill의 설치·동기화와 내부 Decision Log만 추가한다. Exact
guarded-tree digest `344706358c2217a4e75a9b10c808096501360480d0c1261f3adba6f07870fa15`와
measurement revision 이후의 정확한 마흔세 changed path가 함께 일치할 때만 compatible하다.
검색 실행과 Q3 workload 의미는 바꾸지 않는다.

Issue #208 error-catalog cleanup은 PR #386 tree 위에서 호출자가 없는 오류 코드와 퇴역한
fixed-copy message만 제거한다. v23 collector는 기존 v22 tuple의 exact target revision
`9de7bdd66a221af8084c9496851307096b1de9b6`의 guarded-tree digest
`e392727463a7fa59361312c2b4265963e63da5105d3935d3e55cae676a0441e2`와 measurement
revision 이후의 정확한 마흔여덟 changed path가 함께 일치할 때만 이 tree를
`human-reviewed-compatible-tree`로 분류한다. 신규 다섯 경로는 error catalog 하나와 i18n
catalog 넷이다. Active caller, search execution, provider, admission, readiness, deadline,
concurrency, workload profile은 바뀌지 않는다. Digest, decision ref, rationale, path 누락·추가를
negative test가 fail-closed로 거부한다. 이 호환성은 새 workload 측정이나 production evidence가
아니다.

Issue #208 principal fixture cleanup은 error-catalog tree 위에서 owner·viewer principal을
나타내던 테스트 값만 정본 principal 이름으로 바꾼다. Exact target revision
`b39147fe89a7499a9a3d88fb4bfc14eb33e1e98b`의 guarded-tree digest
`0c5001e9d6b048b4cb4b549608883bd80e62ec335259326fe2734ef9d4c554ef`와 measurement
revision 이후의 ordered 117-path manifest가 함께 일치할 때만
`human-reviewed-compatible-tree`로 분류한다. Direct delta 76개는 모두 test·fixture 파일이며
production/runtime 구현, analytics event 계약, search execution, provider, admission, readiness,
deadline, concurrency, workload profile은 바뀌지 않는다. 기존 error-catalog tuple은 유지한다.
Digest, decision ref, rationale, path 누락·추가·순서 변경을 negative test가 fail-closed로
거부한다. 이 호환성은 새 workload 측정이나 production evidence가 아니다.

Issue #208 stale fixture/CSS cleanup은 principal fixture tree 위에서 intent surface audit의
빈 retired-directory 준비 코드와 호출자가 없는 전역 CSS token·selector만 제거한다. Exact target
revision `087e718174725d25345c0f6c7d2dbc908139844e`의 guarded-tree digest
`957eca07faf715c281ec618b8b5ac78eec37c14fe8fa02cb20e70c200c960a5e`와 measurement
revision 이후의 ordered 119-path manifest가 함께 일치할 때만
`human-reviewed-compatible-tree`로 분류한다. Direct delta는
`app/globals.css`, `app/server/services/__tests__/intent-surface-audit.test.ts` 두 경로뿐이다.
Production component markup, search execution, provider, admission, readiness, deadline, concurrency,
workload profile, analytics event 계약은 바꾸지 않는다. 기존 principal fixture tuple은 유지한다.
Digest, decision ref, rationale, path 누락·추가·순서 변경을 negative test가 fail-closed로
거부한다. 이 호환성은 새 workload 측정이나 production evidence가 아니다.

Issue #208 gap lifetime 회귀 테스트와 승인된 내부 Decision Log는 stale fixture/CSS tree 위에서 실제 `SearchView`
언마운트 뒤에도 이미 dispatch된 detached gap handoff가 같은 target의 `/gap/:id` 이동을
완료하는 기존 동작을 고정한다. Exact target revision
`062eb465cb85b742a9a2c9978b4473589dabf8bf`의 guarded-tree digest
`49fbe648a02727a551158f20434d2ba1e038477d74d3132db7c0e4254592dc7c`와 measurement
revision 이후의 ordered 122-path manifest가 함께 일치할 때만
`human-reviewed-compatible-tree`로 분류한다. Direct delta는
`app/components/research-route-renderers/__tests__/search-view-states.test.tsx`와 승인된 내부
Decision Log publication의 네 경로뿐이다. 누적 manifest에는 기존부터 포함된 rollup 두 경로와
새 PR #416 shard 두 경로가 반영된다. Production runtime 구현, search execution, provider,
admission, readiness, deadline, concurrency, workload profile, analytics event 계약은 바꾸지
않는다. 기존 stale fixture/CSS tuple은 유지한다.
Digest, decision ref, rationale, path 누락·추가·순서 변경을 negative test가 fail-closed로
거부한다. 이 호환성은 새 workload 측정이나 production evidence가 아니다.

Issue #399 URL byte budget과 review fix 결합 tree는 stale fixture/CSS tree 위에 #399의
Search-first 조건 URL byte budget, reject-only 사용자 피드백, parser-before-identity 순서,
Decision Log와 회귀 테스트를 더하고, 이미 승인된 Issue #208 gap lifetime tree도 함께 포함한다.
Exact target revision `a7a682d9519507e64957d98462f521c1ff93f189`의 guarded-tree digest
`e3eb178ddd5b2954da5a01deb979d5a7f53e0f999dafc141cebb3c8c5368734e`와 measurement
revision 이후의 ordered 155-path manifest가 함께 일치할 때만
`human-reviewed-compatible-tree`로 분류한다. Search execution을 시작하기 전 URL 조건을
거부하고 identity resolution보다 먼저 검증하지만 provider 수, admission, readiness, deadline,
concurrency, workload profile과 production capacity evidence는 바꾸지 않는다. 기존 Issue #208
gap lifetime tuple은 별도 과거 호환성으로 유지한다. Digest, decision ref, rationale,
path 누락·추가·순서 변경을 negative test가 fail-closed로 거부한다.

앞선 spacing-only tree `efebc0e1…2c26`에서 2026-07-17 실행한 별도 cold u20은 20/20
ready·HTTP 오류 0이었지만 query p95 4,099.3ms였다. 실행 label에 approved-window 문자열이
있었지만 실제 provider window 승인은 확인하지 않았고, Human은 Episteme가 2026년 8월 초까지
내부 정비 중이라 간헐적으로 응답이 불안정할 수 있다고 확인했다. 따라서 이 실행은 숨기지 않고
maintenance-period 운영 관찰로 남기되 Q3 report tuple, 최종 reviewed tree compatibility,
UI 회귀 근거로 승격하지 않는다. 정비 종료 뒤 명시적으로 승인된 provider window에서
재진입한다. 그때까지 현재 Episteme 상태와 production fleet·p99·5xx는 계속
`unsupported / unknown`이다.

### Q3 case 상태

| case | Human review 상태 | 근거와 한계 |
| --- | --- | --- |
| workload envelope | `machine-verified-healthy` | PR #361 final run `29554384006`이 exact target `ba13b7be`의 cold u20, sustained-open 1/s·60초, controlled u2 arrival·input/provider/topology와 결과를 `verified / healthy`로 판정했다. |
| sustained client admission | `included-in-healthy-case` | 1/s·60초는 60/60 completion·ready, shed/error 0, p95 836ms다. 2/s의 반복 119/120은 현재 launch envelope 밖 `excluded`로 숨김없이 보존한다. |
| search outcome semantics | `included-narrow-definition` | 이 case 안의 success는 paper count가 1 이상인 ready 결과로 검증됐다. Legitimate empty와 provider-degraded empty를 일반적으로 분류하는 제품 outcome case는 아니다. |
| server/provider amplification | `machine-verified-controlled` | Fresh zero baseline의 loopback provider에서 2 journey가 4/4 successful request, 2 calls/journey로 결속됐다. Real Episteme attributable counter는 `unsupported / unknown`이다. |
| local sustained capacity | `included-in-healthy-case` | Exact-head 8/12 burst u20 20/20·p95 2,908ms와 sustained 1/s 60/60·p95 836ms가 3초 예산 안이다. 장시간·multi-process run은 없다. |
| production fleet capacity | `unknown` | Human-approved provider allowance 20은 있지만 production p99/5xx, peak instance와 pool 관측이 없다. |

이 표의 상태와 machine verdict는 합치지 않는다. Checked-in observation 파일 자체는 unsigned지만
base-owned protected workflow run `29554384006`의 exact-target 결과는 provenance `verified`,
workload case와 launch coverage `healthy`, merge advisory `allow`다. Production coverage의
`unsupported / unknown`은 이 scoped verdict로 덮지 않는다.

## 다음 evidence

Q2의 included static·behavior case와 별도로 production observation이 필요하다. Recovery attempt와 성공률, phase별 p95/p99,
peak instance, effective fleet concurrency, Human-approved provider allowance 20과 429·5xx를
같은 deployment identity와 observation window에 묶어야 한다.

Q3의 generic workload-envelope case는 v6 active report의 controlled fixture binding과 승인된
local burst·sustained report를 읽는다. Active report는 collector에 잠근 exact
report·measurement revision·guarded-tree tuple 중 하나와 일치하거나, 현재 policy에 잠근 exact
Human-reviewed guarded tree와 해당 exact changed-path manifest가 함께 일치해야 한다. Live provider
observation은 아직 report artifact에 자동 결합되지 않으므로 production
window에서는 platform log와 deployment identity를 함께 보존해야 한다. Cancellation 실제
사례와 multi-instance causal phase도 수집한다. Representative·maximum ramp를 반복해
run-to-run variance를 분리한다. Local 결과를 production absolute capacity로 환산하지 않는다.

## 검증

```bash
npx vitest run scripts/load-smoke/__tests__
npm run typecheck
npm run load-smoke -- --help
npx vitest run app/components/research-route-renderers/__tests__/GapNetworkView.progress-pacing.test.tsx
npm run architecture-fitness:advisory
```

Architecture Fitness 명령은 활성 Q1/least-authority, Q2 process topology·first-ready critical
path, Q3 launch workload case를 검증한다. Production/fleet coverage는 verdict로 승격하지 않는다.

## Contract Architecture Impact Review

Contract delta: 단일 Episteme chokepoint와 process-local admission owner를 유지하면서 승인된 Q2·Q3 workload envelope와 exact-tree compatibility evidence를 확장한다.
Verdict: constrain-existing
Affected axes and current owners: Runtime, external, or AI boundary; Resource and capacity; Observability and audit; Compatibility and retirement — `app/server/external-http-gateway/`, `scripts/architecture-fitness/collect-q2-macro.mjs`, `scripts/architecture-fitness/collect-q3-workload.mjs`, `docs/operational-readiness.md`
Decision: process-local breaker·semaphore와 protected exact-revision evidence를 유지한다. 승인된 workload와 compatibility tree만 추가하고 production fleet·provider account capacity는 `unsupported / unknown`으로 남긴다.
Rejected alternative: SLO를 완화하거나 전체 `app`을 compatibility 대상으로 허용하거나 process-local 결과를 production capacity로 승격하면 측정 경계가 사라진다.
Evidence and structural defense: `scripts/load-smoke/__tests__/`, `scripts/architecture-fitness/__tests__/`, `npm run architecture-fitness:validate`
Human decision required: no

이번 변경의 CAIR는 `constrain-existing`이다. Promise와 first-ready p95 3초의 의미는 바꾸지
않는다. Resource/capacity와 provider runtime의 현재 owner인 단일 Episteme chokepoint와
process-local breaker/semaphore를 유지하면서 기본 admission을 20/2/8/12로 조정한다. Retry,
회로 상태, lane 우선순위, 실행 순서와 failure degrade 정책은 바꾸지 않는다. Retry는 같은
slot을 유지하며 최종 논리 결과 하나만 breaker에 기록하고 실제 추가 fetch는 `retryCount`로
남긴다. HTTP 429·5xx, 그 밖의 network error, caller abort는 재시도하지 않는다.

4/16 유지는 current main burst u20 p95가 0/2였기 때문에 거부했다. Active 20 또는 무제한
실행은 fleet overlap 위험 때문에 거부했고, 3초 SLO 완화도 측정 결과를 통과시키기 위한
계약 후퇴라 거부했다. Redis/global limiter 즉시 도입은 현재 비공개 소수 코호트에는 과도해
거부했다. 8/12는 같은 clean revision에서 u20 3/3 PASS했고 두 process 포화의 active 합계가
16으로 allowance 20 안이다. 세 process의 active overlap 포화 또는 provider incident를
shared limiter·env 감축·provider-side rate-limit 재검토 trigger로 둔다.

Service owner는 2026-07-17 이 controlled risk와 기본값 조정을 승인했다. 별도 Human 결정은
남아 있지 않다. 이 Human decision은 Architecture Fitness machine verdict가 아니다. Q2
included case는 process scope와 await graph에 한정되고, Q3 included case는 승인된 local launch
workload에 한정된다. Production/fleet와 real-provider amplification은 계속
`unsupported / unknown`이다.

PR #338 UI-only compatibility 추가도 `constrain-existing`이다. 현재 owner와 선택 owner는
모두 Lighthouse operational-readiness owner와 Q3 collector다. 측정 identity, 3초 SLO,
provider profile, runtime 경로는 보존하고 UI-only tree 하나만 exact Human-reviewed
compatibility로 제한한다. 실패한 4,099.3ms 실행을 새 PASS measurement로 꾸미기, 통과할 때까지
반복 측정하기, `app` 전체를 compatibility guard에서 제거하기, 3초 예산을 늦추기는 거부했다.
구조적 방어는 exact digest, exact changed-path list, decision ref, measured-tree binding과
각각을 깨뜨리는 negative test다. Episteme 정비 기간 관찰은 별도 운영 기록으로 남고
production verdict는 `unknown`을 유지한다.

PR #379 canonical-host compatibility도 `constrain-existing`이다. 정본 host와 소수 초대 코호트
범위는 Human이 승인했고, 공개 changes surface는 복원하지 않기로 결정했다. 현재·선택 owner는
동일하게 Lighthouse operational-readiness owner와 Q3 collector다. Host 전용 redirect와 내부
Decision Log를 workload 재실측으로 가장하거나 전체 `app`을 허용하는 대안은 거부했다. 구조적
방어는 exact content revision의 guarded-tree digest, 정확한 17개 path manifest, decision ref,
rationale와 각 필드의 negative mutation이다. Protected workflow 서명 전 checked-in
observation은 complete여도 `unknown`이고, production fleet·p99·5xx·DB pool·real-provider
amplification도 계속 `unsupported / unknown`이다.

수정된 PR #381 hydration compatibility도 `constrain-existing`이다. 현재·선택 owner는
Lighthouse operational-readiness owner와 Q3 collector이며, AI comment readiness와
background hydration lifecycle의 기존 owner를 바꾸지 않는다. 정상 빈 200은 즉시 terminal,
개별 provider 오류·abort는 최대 3회 retry, 모두 실패하면 lightweight 결과를 보존한 degraded
terminal이라는 기존 bounded failure policy를 exact tree에 제한한다. 실패를 successful-empty로
숨기기, retry 소진 뒤 무한 pending 유지, 전체 `app` wildcard 허용, 이 변경을 새 3초
measurement로 취급하기는 거부했다. 구조적 방어는 exact content revision의 guarded-tree digest,
정확한 38개 path manifest, decision ref, rationale, collector-definition digest와 각각의
negative mutation이다. Protected workflow 서명 전 checked-in observation은 complete여도
`unknown`이고 production fleet·p99·5xx·DB pool·real-provider amplification도 계속
`unsupported / unknown`이다.

Issue #208 error-catalog compatibility도 `constrain-existing`이다. 현재·선택 owner는
Lighthouse operational-readiness owner와 Q3 collector다. 호출자가 없는 error catalog와
fixed-copy message를 제거하되 기존 workload report, measurement revision, 3초 p95 예산,
provider profile, runtime owner를 보존한다. 변경을 새 workload 측정으로 취급하거나 i18n 전체를
guard에서 제외하는 대안은 거부했다. 구조적 방어는 exact content revision의 guarded-tree digest,
정확한 마흔여덟 path manifest, decision ref, rationale, collector-definition digest와 각 필드의
negative mutation이다. Protected workflow가 v22 authority를 서명하기 전 checked-in observation은
complete여도 `unknown`이다. Production fleet·p99·5xx·DB pool·real-provider amplification도
계속 `unsupported / unknown`이다.

Issue #208 principal fixture compatibility도 `constrain-existing`이다. 현재·선택 owner는
Lighthouse operational-readiness owner와 Q3 collector다. 테스트 fixture identity만 정본
principal 이름으로 바꾸고 기존 workload report, measurement revision, 3초 p95 예산, provider
profile, runtime owner와 analytics event 계약을 보존한다. Direct 76개 test·fixture delta만
허용하거나 전체 `app`을 guard에서 제외하는 대안, fixture 정리를 새 workload 측정으로 취급하는
대안은 거부했다. 구조적 방어는 exact content revision의 guarded-tree digest, measurement
revision 이후의 ordered 117-path manifest, decision ref, rationale, collector-definition digest와
각 필드의 negative mutation이다. Protected workflow가 v23 authority를 서명하기 전 checked-in
observation은 complete여도 `unknown`이다. Production fleet·p99·5xx·DB pool·real-provider
amplification도 계속 `unsupported / unknown`이다.

Issue #208 stale fixture/CSS compatibility도 `constrain-existing`이다. 현재·선택 owner는
Lighthouse operational-readiness owner와 Q3 collector다. 빈 테스트 fixture 준비 코드와
zero-caller CSS만 제거하고 기존 workload report, measurement revision, 3초 p95 예산, provider
profile, runtime owner, production component markup을 보존한다. Direct 두 경로만 별도 예외로
허용하거나 전체 `app`을 guard에서 제외하는 대안, 정리를 새 workload 측정으로 취급하는 대안은
거부했다. 구조적 방어는 exact content revision의 guarded-tree digest, measurement revision
이후의 ordered 119-path manifest, decision ref, rationale, collector-definition digest와 각
필드의 negative mutation이다. Protected workflow가 v24 authority를 서명하기 전 checked-in
observation은 complete여도 `unknown`이다. Production fleet·p99·5xx·DB pool·real-provider
amplification도 계속 `unsupported / unknown`이다.

Issue #208 gap lifetime 회귀 테스트와 승인된 내부 Decision Log compatibility도
`constrain-existing`이다. 현재·선택
owner는 Lighthouse operational-readiness owner와 Q3 collector다. 기존 shared detached-gap
continuation의 source unmount 뒤 완료 동작을 테스트로 고정하되 기존 workload report,
measurement revision, 3초 p95 예산, provider profile, runtime owner와 production 구현을
보존한다. 테스트 한 경로만 별도 예외로 허용하거나 전체 `app`을 guard에서 제외하는 대안,
회귀 테스트 추가를 새 workload 측정으로 취급하는 대안은 거부했다. 구조적 방어는 exact content
revision의 guarded-tree digest, measurement revision 이후의 ordered 122-path manifest,
decision ref, rationale, collector-definition digest와 각 필드의 negative mutation이다.
Protected workflow가 v26 authority를 서명하기 전 checked-in observation은 complete여도
`unknown`이다. Production fleet·p99·5xx·DB pool·real-provider amplification도 계속
`unsupported / unknown`이다.
