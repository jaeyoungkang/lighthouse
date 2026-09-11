# Operational Readiness — SLO·용량·scale-out 판단 기준

`AGENTS.md` `## Operational Readiness` mandate("목표 동시성에서 5xx율·p99·풀
사용률 임계를 숫자로 고정한다")의 이행 문서다. 레일은 `npm run load-smoke`
(`scripts/load-smoke/`)다. 이 문서는 판단 기준(정책)을 소유한다. #183 당시의
측정 앵커 문서(`incident-183-load-baseline.md`)는 제거했고(git 이력에 남음),
구조 개선 후속 작업에서 새 baseline을 측정해 다시 고정한다.

숫자의 근거 원칙: 로컬 baseline은 상대 앵커다(prod 절대 용량 아님). 아래 임계는
#183 baseline 실측값에 여유폭을 더해 고정했고, prod 관측으로 교정한다. 교정하면
이 문서의 숫자를 갱신하고 갱신일을 남긴다.

## 1. SLO — 숫자 (2026-07-04 고정)

**목표 동시성: 동시 first-session 20.** 근거: 7/3 코호트 200명, 베타 관측상
실접속은 초대의 ~절반(≈100 active), peak에 그중 ~20%가 동시에 세션을 시작한다고
가정. 추정치이므로 prod 첫 주 관측으로 교정한다. 2026-07-16 exact-revision local
real-provider u20 cold/warm은 둘 다 6/20 ready-with-papers로 NO-GO였으며,
[`docs/operational-readiness-records.md`](operational-readiness-records.md)에
원인과 한계를 기록한다. 이는 production 절대 용량이 아니다.

로컬 부하 스모크 게이트 (레일: `npm run load-smoke -- --users 20`):

| 지표                                | 임계         | baseline 실측 (u15, 2026-06-30)     |
| ----------------------------------- | ------------ | ----------------------------------- |
| 5xx + timeout + network-error       | 0            | 0                                   |
| `GET /search?q=` (query-canonical 실행, provider fetch 포함) p95 | < 3,000ms | 재측정 필요 — #202 Phase 2 ephemeral 전환으로 reserve(598ms)/run(1,826ms) 2-앵커가 이 단일 앵커로 대체됨 |
| ready-with-papers                   | 전원 (100%)  | 73% (실 Episteme 부분 저하 하에서), K1-after 100% |
| `route-auth` p95                    | < 30ms       | 5.9ms (K1-after)                    |

go/no-go verdict의 소유자는 harness의 `getCohortGoNoGoVerdict`
(`scripts/load-smoke/metrics.ts`)다 — 에러 0 ∧ 전원 ready-with-papers ∧
`GET /search?q=` p95 < 3,000ms일 때만 green이다. 이 문서는 그 코드 기준을 옮겨
적을 뿐 별도 임계를 창조하지 않는다.
Harness는 성공한 SSR 응답에서 고유한 `data-paper-id`를 첫 등장 순서대로 보존한다.
한 편 이상일 때만 `ready-with-papers`로 분류한다. 2xx 응답이어도 논문 카드가 없으면
`ready-empty`이며 green이 될 수 없다. 이 ID 목록은 exact-result 관측의 입력일 뿐,
그 자체로 expected-item 일치나 topic relevance를 증명하지 않는다. Ramp 실행은 각
코호트의 첫 요청 실패와 별도로 전체 verdict가 처음 실패한 동시성 단계를
`firstWorkloadBreak`로 기록한다.
실패 원인이 provider 저하라도 no-go다 — 사용자는 원인을 구분하지 않는다.
provider 건강을 회복시킨 뒤 재측정한다. 검색 앵커 표본이 0인 run은 p95를
측정하지 못했으므로 green이 될 수 없다(no-go). `route-auth` p95 행은 verdict 밖의
관찰 지표로, 초과 시 원인 조사 없이 코호트를 열지 않는다. 검색 p95는 #260
co-equal 전환에서 latency가 문서에만 있고 verdict 코드가 무시해 회귀를 못 막았던
공백을 메우기 위해 verdict 기준으로 승격됐다.

지속 부하는 `sustained-closed`와 `sustained-open`으로 분리한다. Closed model은
고정된 synthetic user 수가 응답을 받은 뒤 다음 journey를 시작한다. Open model은
응답 완료와 무관하게 고정 arrival rate로 journey를 예약한다. Open model의
`maxInFlight`를 넘는 arrival은 client backlog에 쌓지 않고 즉시 shed로 기록한다.
지속 부하 verdict는 기존 검색 verdict에 admitted journey 전원 완료와 client shed
0건을 추가한다.

각 지속 부하 실행은 duration, concurrency 또는 arrival rate, input profile,
provider profile, topology profile, run owner를 먼저 선언해야 한다. Report v5는 이
값과 warm-up 0초, admitted work를 모두 drain하는 cool-down policy, target Git
revision, working tree dirty 상태를 보존한다. Profile 이름은 동작을 주입하지 않는다.
Controlled delay·429·5xx profile은 해당 fixture나 provider 설정이 실제로 적용됐다는
별도 근거가 있어야 한다. Dirty report는 개발 확인에는 쓸 수 있지만 exact-revision
baseline으로 쓰지 않는다. Loopback fixture stats를 지정하면 fresh zero baseline과 drain 뒤
final count를 같은 report에 결합하고, 재사용된 fixture는 귀속 실패로 중단한다. 실행 중 HEAD
또는 clean/dirty 상태가 바뀌면 report를 만들지 않는다.

지속 부하 local PASS도 production capacity verdict가 아니다. 현재 rail이 직접
측정하는 값은 client arrival·admission·completion·shed, admitted in-flight,
journey throughput, HTTP outcome, search readiness와 응답 latency다. Server/provider
queue depth와 wait, provider call·retry·429·5xx·cancellation, multi-instance peak와
fleet allowance는 별도 관측이 없으면 `unknown`으로 남긴다.

prod 관측 SLO (로컬에서 측정 불가, 대시보드 확인):

| 지표                              | 임계                     | 관측 위치            |
| --------------------------------- | ------------------------ | -------------------- |
| entry 앵커 5xx율 (주간)           | < 1%                     | Vercel logs          |
| entry 앵커 p99 (주간)             | < 5s                     | Vercel analytics     |
| Supabase 커넥션 풀 사용률 p95     | < 60%                    | Supabase 대시보드    |
| peak 동시 인스턴스 수             | 기록 (임계 아님, §2 입력) | Vercel 대시보드      |

### 1.1 검색 품질 release evidence

검색 운영 판정은 세 evidence lane을 합치지 않는다. Transport load-smoke는
응답·오류·latency·paper identity만 증명한다. Deterministic wiring은 synthetic
DOI·title·topic의 actual-path 연결만 증명하며 release는 `not-applicable`이다.
Bounded-live quality만 승인 표본의 네 지표를 각각 판정한다.

`scripts/search-quality/` evaluator는 기존 load-smoke schema v5 report를 읽는다. 새
검색 runner나 report 저장소를 만들지 않는다. Evaluation set은 query provenance,
expected paper ID, topic judgment, sample limit을 버전으로 고정한다. Release policy는
set id·version·SHA-256, Human과 Operational Readiness 승인, evidence freshness, 네
threshold, pause·rollback·resume owner를 함께 가져야 한다.

지원하지 않는 version, missing query, dirty·mixed revision, query·ranking 불일치와
policy 부재·set 불일치·승인 전·stale·future evidence는 모두 fail closed다. 네
지표는 합성하지 않는다.

현재 approved bounded-live set과 수치 threshold는 없다. Checked-in wiring 결과를
public readiness나 identifier 정책으로 승격하지 않으며, protected lane과 dated
record가 닫힐 때까지 release blocker를 유지한다.

## 2. process-local 상태 인벤토리와 scale-out 경계

아래 상태는 전부 인스턴스별 독립이다(Vercel Fluid는 인스턴스를 재사용하므로 베타
규모에서는 보통 1~2개로 유지되지만, 보장이 아니다). **요청 단위 3계층
데드라인(route `maxDuration` · `req.signal` 전파 · role `statement_timeout` 8s)은
인스턴스 수와 무관하게 유지된다** — 희석되는 것은 fast-fail과 load-shed다.

| 상태 | 위치 | 인스턴스 N개일 때 | 지금 막는 층 | 중앙화 트리거 |
| --- | --- | --- | --- | --- |
| Episteme 회로 차단기 + fleet-planned 세마포어 | `external-http-gateway/episteme-circuit-breaker.ts` | 회로 상태는 인스턴스별 독립이다. 기본값은 allowance 20 / planning denominator 2에서 projected 10을 구한 뒤 process cap 8을 적용하고, lane별 queue 12를 둔다. N개 process의 active provider work 상한은 `8×N`이다. 두 process 포화는 16으로 allowance 안이지만 세 process 포화는 24다. Queue는 global hard cap이 아니며 core·optional lane에 각각 적용된다. | 3계층 데드라인 + process당 load shed + cold connect-timeout allowlist 1회 retry. Clean exact-default `a513207e`의 burst u20은 3/3 PASS, sustained 1/s·60초는 PASS했다. Sustained 2/s·60초는 두 번 모두 provider final timeout 1건으로 119/120 NO-GO였다. | 실제 overlapping active provider work가 세 process 포화에 이르거나 Episteme 5xx/timeout incident가 열리면 env 감축, breaker 상태 공유(Redis), 또는 Episteme측 rate-limit 중 하나를 먼저 닫는다. Window의 distinct runtime id 수만으로 동시 포화를 판정하지 않는다. |
| route-view AI comment generation in-flight dedupe | `app/api/route-ai-comments/generate/[id]/route.ts` | 같은 ResearchRoutePayload 생성 요청이 다른 인스턴스에 떨어지면 중복 provider 실행 가능 — 비용 증폭, 정합성 문제 아님 | canonical `ViewSnapshot` projection 검증 + terminal `reaction:null` + route-owned state가 late/stale write를 차단 | AI comment generation 비용 telemetry 이상 또는 멀티 인스턴스 상시화 + generation 사용량 성장 |
| inline-analysis process in-flight fast path | `app/server/domain-access/inline-analysis-access.ts` | process `Map`은 인스턴스별이지만, 다른 인스턴스의 같은 논문·버전·canonical 입력 miss는 DB의 30초 expiring lease로 한 generator만 획득한다. Claim은 새 row를 자동 획득하고 만료된 pending row는 explicit retry에서만 회수하며 active lease를 갱신하지 않는다. Provider work는 24초에 중단한다. route-entry 30초 deadline과 request abort가 list/claim/complete transport에 전달된다. waiter는 owner 생성과 병렬로 claim 응답 기준 30초 동안 peer 결과를 관찰한다. waiter read가 실패하거나 예산 안에 모든 peer ready row를 확인하지 못하면 성공 partial 대신 5xx로 닫는다. Owner 실패는 waiter를 취소한다. Release는 caller abort와 분리된 최대 1.5초 cleanup signal을 사용하며, RPC가 모든 pending identity의 exact token release를 확인해야만 성공한다. 오류·0건·부분 확인은 즉시 5xx로 닫는다. caller cancellation만 claim을 release하고, provider·owner deadline은 5·15·60분 durable cooldown, schema·auth·configuration·DB 경계 실패는 terminal state로 닫는다. Cooldown 종료나 process 소실·transport loss는 자동 provider retry를 만들지 않고 사용자 explicit retry만 새 30초 claim을 연다. 같은 process의 caller는 subscriber별로 취소되며 남은 subscriber가 없을 때 공유 작업을 중단해도 독립 cleanup은 유지한다. | `(paper_id, version, input_fingerprint)` unique identity, exact-tuple security-definer RPC, direct table DML revoke, token-matched claim/complete/release, 공통 request cap에 따른 5편 한 wave·paper별 primary 1회와 secondary 최대 1회·third 없음·process-local breaker, exact repository export/import ownership과 direct RPC member acquisition guard. Process map은 지연 단축일 뿐 정합성 owner가 아니다. | duplicate provider generation 또는 expired-lease reclaim 실패가 관측되면 lease/wait 지표를 추가하고 DB advisory lock·queue 같은 중앙 조율을 재검토한다. |
| in-flight dedupe map (search run·gap create) | 각 경로 | 인스턴스 간 중복 provider 실행 — 비용 증폭, 정합성 문제 아님 | search는 pending→ready 전이 멱등과 seed-identity unique index(`00012`)로 문서 중복을 막는다. gap은 canonical `source_input_digest` unique index와 DB attempt/70초 lease(`00019`)로 artifact·runner 중복을 막는다. | 비용 telemetry 이상 |
| working context buffer | `server/reference/working-context.ts` | 요청이 인스턴스를 옮기면 buffer 미스 → 품질 graceful degrade | 원래 cache 의미론(TTL·cap) | 없음 — 수용 |
| local JSONL analytics store | `repository/analytics-events.ts` | Vercel FS는 휘발 — prod에서 JSONL은 유실될 수 있음 | Amplitude가 durable sink. JSONL은 로컬 관측용 | 없음 — 수용 |

요지: **지금 당장 중앙화(Redis 등)가 필요한 상태는 없다.** 정합성은 DB 층과
데드라인이 인스턴스 무관하게 지키고 있고, 희석되는 것은 보호의 속도와 비용
효율이다. 트리거 열이 관측되면 그때 해당 행만 중앙화한다.

## 3. 배포 형태와 서버 분리 부활 트리거

현재 배포 형태는 Next.js 서버리스(Vercel Fluid Compute)를 web과 API 단일 런타임으로
두는 것이다. 2026-07-06에 이 형태를 공식 운영 형태로 고정했다. 과거의
React/Express 서버 분리와 ECS 이전 로드맵은 이 결정으로 중단했고,
`packages/lighthouse-server` 스켈레톤·`errors` canary proxy·관련 정본 문서를
제거했다.

근거는 search-first 전환 이후 서버 작업의 수명과 복구 경계가 route 예산 안에
묶였다는 것이다. gap report POST는 pending row를 먼저 저장하고 `after()` runner를
예약한다. runner가 route 예산과 함께 사라지면 detached viewer가 만료 lease를 기존
인증 POST로 재획득한다. 지속 상태는 `lighthouse.gap_reports`가 소유한다. 전 API route가 `maxDuration`을 선언하고
최대 120s이며 `guard:route-deadline`이 CI에서 강제한다. Route-view AI comment
generation은 10s structured generation deadline과 15s client timeout을 갖고
terminal failure를 `reaction:null`로 닫는다. WebSocket과 상주 백그라운드 작업이
없다. DB는 Supabase HTTP 접근이라 인스턴스별
connection pool 고갈이 발생하지 않는다. 유일한 런타임 파일 쓰기인 local JSONL
analytics는 serverless를 감지해 `tmpdir`로 쓰고 Amplitude가 durable sink다(§2).
#183 close-out의 구조적 방어(3계층 데드라인·guard·부하 스모크 레일)도 전부
서버리스 전제로 설계·검증됐다.

§2는 process-local 상태를 Redis로 중앙화할 트리거를 다룬다. 프로세스를 별도
런타임으로 분리해 상주 서버(ECS)로 옮기는 것은 그보다 큰 결정이다. 아래 트리거가
관측될 때만 서버 분리를 다시 연다.

1. **중앙화로 안 풀리는 scale-out 압박** — peak 동시 인스턴스 >2가 상시화되고
   Episteme 저하가 breaker 상태 공유(Redis)로도 안 잡혀서 상주 프로세스 수준의
   조율이 필요할 때. 이 경우에도 1차 대응은 Redis이지 ECS가 아니다.
2. **조직·보안 정책 요구** — AWS 내부망 co-location 또는 public access를 끈 private
   RDS를 요구할 때. Vercel 함수는 private-only RDS에 직접 붙지 못한다. 이건 강제
   제약이지 성능 판단이 아니다.
3. **durable agent runtime 진화** — 300s 초과 실행, 응답 persistence,
   human-in-the-loop 중단·재개가 제품 요구가 될 때. 현재 route-view AI comment
   generation은 짧은 structured request라 해당 없다.

**날짜와 기능 압박이 트리거를 이기지 않는다.** §4 go/no-go와 같은 원칙이다.
트리거 없이 서버 분리를 다시 여는 것은 과설계다.

## 4. 코호트 확대 go/no-go 체크리스트

한국 전체 확대, 글로벌 확대 각각의 앞에서 전부 확인한다. **날짜가 게이트를 이기지
않는다** (`AGENTS.md`).

1. `npm run load-smoke -- --users 20` green — §1 로컬 게이트 전 항목 충족.
   실행은 실제 Episteme를 때리므로 사전에 Episteme 부하 여유를 확인하고 돌린다
   (baseline이 15에서 멈춘 이유).
2. §1.1 bounded-live search-quality verdict `go` — approved policy와 fresh clean
   exact-revision evidence가 없으면 `no-go`다.
3. prod 관측 SLO(§1 두 번째 표) 임계 내 — 직전 1주 기준.
4. peak 동시 인스턴스 수 기록 — 관측 peak가
   `EPISTEME_PEAK_INSTANCE_BUDGET` 이내이고,
   `effective per-instance concurrency × peak`가
   `EPISTEME_TOTAL_CONCURRENCY_BUDGET` 및 Episteme 허용 동시성 이내인지 먼저 닫는다.
5. entry 앵커(`GET /search?q=` query-canonical 실행) 관련 열린 인시던트 0.
6. §5 운영 경계 리스크 등록부에서 대상 코호트에 적용되는 boundary row가
   `policy-needed`, `control-needed`, `evidence-needed`, `blocked` 상태로 남아 있지
   않다.
7. verdict를
   [`docs/operational-readiness-records.md`](operational-readiness-records.md)에
   남긴다 (일자·코호트·판정·근거 링크).

## 5. 운영 경계 리스크 등록부

이 절은 #227의 후속 체계다. 목적은 public ingress, 외부 provider fan-out, 공개
POST sink처럼 보안·integrity·load·cost 경계가 섞인 표면을 “나중에 확인” 상태로
흘려보내지 않는 것이다. 새 boundary가 생기거나 기존 boundary의 용도·증거 사용처가
바뀌면 아래 등록부에 먼저 들어간다.

등록부는 구현 해결책을 처방하지 않는다. 대신 go/no-go 전에 반드시 닫아야 할
질문과 증거를 고정한다. 날짜, demo 필요, 작은 코호트 압박은 이 등록부 상태를
우회하지 못한다.

### 등록 기준

다음 중 하나라도 참이면 boundary row를 만든다.

- public 또는 semi-public POST endpoint가 telemetry, error, analytics, operational
  evidence, product decision signal 중 하나로 쓰일 수 있다.
- 외부 provider, AI provider, DB, durable sink 호출이 route/view fan-out 또는
  background task fan-out에 의해 증폭될 수 있다.
- process-local 보호(semaphore, circuit breaker, in-flight map, local JSONL 등)가
  multi-instance에서 총량 보호로 오해될 수 있다.
- load-smoke, prod SLO, analytics, error logs 같은 운영 증거가 caller identity,
  source validation, rate limit, sink durability, sampling 한계 때문에 decision
  evidence로 쓰기 전에 별도 판단을 요구한다.

### 상태와 소유

| 상태 | 의미 | 공개·확대 cohort go/no-go |
| --- | --- | --- |
| `observed` | 공격면·부하면·증거 한계를 등록했지만 코호트 판단에 아직 쓰지 않는다. | 허용 |
| `policy-needed` | 사용자/운영 판단에 필요한 policy가 아직 없다. | 차단 |
| `control-needed` | policy는 정했지만 route/platform/runtime control이 없다. | 차단 |
| `evidence-needed` | control은 있으나 실제 증거가 부족하다. | 차단 |
| `accepted` | 현재 코호트 범위에서 policy/control/evidence가 충분하다. | 허용 |
| `deferred` | 현재 코호트에는 적용하지 않는다고 명시했다. 다음 trigger가 오면 재검토한다. | 조건부 허용 |
| `blocked` | 알려진 미해결 위험이 있다. | 차단 |

운영 verdict는 이 문서가 소유한다. 게이트 의미나 `quality:*` wiring은
`quality-gate-steward`, runtime 순서나 provider/API boundary 변경은
`runtime-flow-sync`, analytics event 계약 변경은 `analytics-event-steward`, agent/process
운영 규칙 변경은 `skill-governance-steward`가 함께 닫는다.

### API route ingress policy

`app/server/operational/route-ingress-policy.json`은 현재 `app/**/route.ts` Route Handler
20개의 공개성, 작업 종류, read/write 성격, body byte·field·cardinality 상한,
인증 순서, application admission, platform admission, `maxDuration`을 모두
나열한다. 미확인된 Vercel·WAF·fleet rate limit은 `unknown`으로 기록한다.
Application의 process-local 제어를 fleet 전체 상한으로 해석하지 않는다.

인증 route의 비용 작업은 `principal auth → bounded body read → bounded schema →
cost admission → DB/provider/LLM work` 순서를 따른다. Public route의 source abuse
admission은 body보다 먼저 적용한다. Same-origin route는 origin을 먼저 확인한다.
Admission이 필요하지 않으면 해당 단계를 건너뛴다. `withRouteGuard`는 domain error를
HTTP response로 변환할 뿐 인증, body 제한, admission을 적용하지 않는다.

`guard:route-deadline`은 실행 시간 상한만 검사한다. `guard:route-ingress`는 모든
route가 inventory에 있는지, inventory와 `maxDuration`이 같은지, body route가
bounded reader를 쓰는지, direct `request.json()` 우회가 없는지를 따로 검사한다.
Focused route test는 인증 실패가 body·DB·provider·LLM보다 먼저 끝나는지와
`400`·`401`·`413`·`429`를 구분한다. Public telemetry는 fire-and-forget 의미를
보존하므로 malformed, oversized, overloaded request도 `204`로 drop한다.

`app/server/operational/api-response-contract.json`은 JSON API response를 보내는 19개 route의 success,
degraded success, correctable/auth/conflict/overload/transient failure를 별도로
나열한다. redirect만 반환하는 `app/auth/confirm/route.ts`는 이 JSON
envelope 계약에서만 이유·책임 owner·재검토 조건을 갖춘 명시적 예외다.
오류는 stable `code`, client `action`, `retryable`을 가지며 `429`는
`Retry-After`를 함께 보낸다. `guard:api-response-contract`은 모든 `app/**/route.ts`가
response inventory 또는 살아 있는 명시적 예외에 속하는지와 route inventory
누락, message-only 오류 body, status/action drift, 400 retry storm과 429 backoff
누락을 차단한다. 재시도 횟수와 write idempotency는 route inventory가 아니라 실제
domain transport가 소유한다. 세부 순서는
`docs/runtime-flows/api-response-and-retry.md`를 따른다.

### 현재 등록부

| boundary id | 표면 | 위험 축 | 현재 control | go/no-go 전에 필요한 증거 | 상태 | trigger / next action |
| --- | --- | --- | --- | --- | --- | --- |
| `inline-analysis-shared-cache` | 인증 `POST /api/papers/analyze-inline`, visible-card background fan-out, `lighthouse.paper_inline_analysis_cache` shared artifact와 DB lease/poll | 임의 paper identity에 대한 LLM 비용, 전역 row 증가, DB claim 경합·poll 증폭, multi-instance 중복 생성, 다른 논문 입력에 의한 shared 결과 오염 | auth-before-body, 1,000,000자 body·공통 5편 request cap·개별 field/array cap, 논문별 canonical title/abstract/year identity와 단독 prompt, 요청당 5편 한 wave·paper별 primary 1회와 secondary 최대 1회·third 없음·process-local breaker, exact-tuple security-definer RPC와 direct table DML revoke, unique shared identity, 새 row만 자동 획득하고 만료 pending은 explicit retry로만 회수하는 30초 claim·24초 owner-work deadline·token-matched complete/release, route-entry 30초 deadline과 cache RPC abort signal, 병렬 waiter의 claim-response 30초 observation budget·unconfirmed-peer/read-failure non-success handoff·delayed-claim route failure·owner-failure cancellation, caller-abort와 분리한 최대 1.5초 cleanup, release 오류·0건·부분 확인의 즉시 non-success handoff, caller cancellation만 token-matched release, provider·owner deadline의 5·15·60분 cooldown과 terminal failure fence, cooldown·process loss·transport 뒤 자동 재호출 금지와 explicit retry, subscriber-aware process coalescing, repository exact export/import ownership과 direct RPC member acquisition 정적 가드, cache-relevant AST와 `INLINE_ANALYSIS_VERSION` 변경을 묶는 정적 가드, 운영 DB에 적용되고 runtime/service role에 execute를 grant하지 않은 current/rollback/30일/최대 500-row retention function, 최초 generator principal usage attribution | cache hit/miss, claim contention, waiter p95/p99, expired lease reclaim 성공률, duplicate provider generation, 요청당 DB read/RPC 수, shared row 증가율, version·age별 row/size와 paper별 identity cardinality, route 5xx/p99와 principal별 LLM 비용 분포 | `evidence-needed` | 2026-07-15 migration ledger는 `00022`까지 local/remote가 일치한다. Post-migration baseline은 3,739 ready, 0 pending, 8,728 kB relation이다. Database는 25,635,987 bytes이고, approximate ready는 6,952,280 bytes(6,789 kB, 27.12%)다. 최근 30일은 1,041 rows·2,080,728 bytes(2,032 kB, 8.12%)다. Cleanup eligible row는 0이다. #319가 2026-07-31 이후 cleanup 전후 DB lock/5xx·baseline evidence를, #321이 multi-instance failure/load evidence를 소유한다. Q5 machine verdict는 별도로 `unknown`이다. |
| `public-telemetry-ingress` | `/api/analytics-events`, `/api/errors` | analytics integrity, load, sink durability | public route schema, client-event allowlist, server-derived user actor, source-window rate limit, analytics 65,536-byte·error 32,768-byte body ceiling, record key/string cardinality cap, error metadata object당 64-key·key 160자·4-level depth·32-item array·2,048-char string·총 512 visited value·16,384-byte stored JSON ceiling, server-owned top-level `__lighthouseTruncated` marker, bounded public telemetry drain, unauth client error no-op와 204 drop | platform/WAF source trust and rate-limit decision, sink load ceiling observation, decision on whether public telemetry can count as product/go/no-go evidence | `evidence-needed` | #227, #430, #651. Application route와 direct error-log repository write는 같은 metadata ceiling을 적용한다. Platform/WAF fleet ceiling과 sink load 관측이 닫히기 전에는 public telemetry를 cohort/product evidence로 승격하지 않는다. |
| `search-background-transport-retirement` | 인증 search enrichment·spelling-correction·term-discovery route의 `route × transportVersion` server observation과 legacy reader 제거 판단 | sink/export 누락, sampling, 배포 window 불완전성, 실제 traffic 0건을 legacy 0건으로 오인해 호환 reader를 조기 제거 | auth·bounded body·route schema를 통과한 요청만 세 route × `v1/legacy` 여섯 조합으로 기록, query·paper·payload·principal 비기록, sink failure 격리, malformed·oversized·auth failure 제외와 admission/downstream failure 포함을 route test로 고정, 증거 불완전 시 reader 유지 | exact deployed revision과 명시한 한 release window, 독립 request count와 export/log count 대조로 coverage·sampling·sink durability 확인, route별 `v1 / total > 0`, route별 legacy 0건 | `evidence-needed` | #584, #592. 2026-08-06 감사에서 #587 exact production release window를 고정했지만 runtime request-log query는 0 rows였다. 독립 request metrics는 사용할 수 없었고 Vercel Drain도 없었다. 세 route의 positive v1과 zero legacy, full-window coverage는 모두 미증명이다. Reader를 유지한다. 다음 window를 열기 전에 route별 독립 request count와 sampling 없는 durable export를 확보하고 같은 window에서 다시 판정한다. |
| `public-magic-link-ingress` | `POST /api/auth/magic-link` | public email enumeration, access-membership DB read, Supabase OTP provider fan-out, source/email cardinality | source 10회/60초와 normalized email 3회/15분의 process-local fixed window, 각각 최대 1,000개 hash key, 4,096-byte strict body, email 320자, access decision 뒤 provider call, overload `429`와 `Retry-After` | platform/WAF fleet rate limit owner와 trusted source-header policy, multi-instance 총량, 429·503·provider failure 빈도 | `evidence-needed` | #430. Application ceiling은 process마다 독립이다. Platform/WAF 설정을 확인하고 production window에서 source/email budget과 정상 로그인 실패율을 함께 관측하기 전에는 fleet 보호가 닫혔다고 판정하지 않는다. |
| `episteme-provider-fanout` | Episteme outbound via `literature-provider-fetch.ts` and `episteme-circuit-breaker.ts`; post-mount `/api/library-context/bootstrap` title hydration through `resolveLibraryPresetPapers` | provider availability, latency, cost, multi-instance load amplification, mount-triggered repeat calls, personalized 검색·bootstrap의 owner-scoped DB read | process-local circuit breaker, 기본 active 8·lane별 queue 12, per-route deadline, request abort propagation, `ETIMEDOUT`·`UND_ERR_CONNECT_TIMEOUT`만 같은 slot 안에서 최대 1회 retry, HTTP 429·5xx 무재시도, privacy-safe one-line provider observation(runtime identity·lane/normalized path·actual call·outcome/status·retry count·queue/provider duration·slot/queue depth), library bootstrap post-paint timing, 검색·bootstrap 실행별 owner-shaped live reviewed_papers read, `reviewed_at DESC, id DESC` 결정적 정렬과 동일 순서의 owner 복합 인덱스, keyword provider와 DB source read 동시 시작, `librarySourceOutcome`·`reviewedPaperCount`·`librarySourceResolutionMs` aggregate log, preset-title positive 15분·negative 30초 TTL, 1,024-entry LRU, same-id process-local coalescing, caller-only abort와 shared 800ms deadline, failure·timeout 비캐시, duration·fill/hit/coalescing·entry/capacity/eviction·heap aggregate log, `load-smoke` users-10 small-cohort rail과 users-20 blocking rail | exact deployment의 peak 동시 인스턴스와 overlapping active provider work, effective concurrency가 fleet/provider allowance 이내라는 확인, prod entry 5xx/p99, library bootstrap 5xx/p99와 call frequency, personalized 검색당 reviewed_papers read 1회·source empty/failure 비율·resolution p99, reviewed_papers owner-order 인덱스 사용 여부, preset-title hydration p99·fill ratio·cache occupancy/eviction·heap p95, Supabase pool p95, provider timeout/5xx 열린 incident 0 | `evidence-needed` | #227, #236, #298, #320, #321, #645, Moonlight #2047. Exact-default clean `a513207e`의 8/12 burst u20은 3/3 ready와 query p95 2,498.5~2,653.0ms를 기록했다. Sustained 1/s·60초는 60/60 ready, provider 120/120 success였다. Sustained 2/s·60초는 두 번 모두 latency와 admission은 통과했지만 provider final timeout 한 건으로 119/120 NO-GO였다. Provider call observation은 query·전체 URL·paper id·body·principal·인증정보를 기록하지 않으며 동적 citation path의 paper id도 `/papers/:paperId/citations`로 정규화한다. 같은 platform request에 묶인 record와 retry count로 call amplification을 계산한다. Window의 distinct `runtimeInstanceId`는 provider record를 낸 active runtime module 수일 뿐 idle fleet를 포함한 canonical Vercel peak 또는 동시 포화 증거가 아니다. Provider fill ratio는 exact revision의 모든 production instance에서 15분 동안 수집한 `preset-title cache observation` record 수를 분모로, `providerFillStarted=true` record 수를 분자로 계산한다. 각 record는 cache/provider title resolution에 한 건 이상 들어간 bootstrap이고, precomputed title만 있거나 numeric provider identity가 없는 bootstrap은 제외한다. Cold cache miss가 새 batched provider call을 시작하면 분자에 포함하고 cache hit 또는 기존 in-flight fill에만 합류한 miss는 분모에만 포함한다. `providerMissCount`는 item 수라 분자가 아니며, caller가 abort해도 shared fill과 provider load가 계속되므로 해당 record를 분자·분모에서 제외하지 않는다. 각 window의 분모가 100 이상인 두 window에서 연속으로 이 ratio가 50%를 넘거나 hydration p99가 800ms에 닿거나 failure/timeout이 1%를 넘으면 TTL, client backoff, display-list 크기를 재검토한다. Personalized 검색당 reviewed_papers read가 1회를 넘거나 source resolution p99·Supabase pool p95가 검색 SLO를 침범하면 owner-order query plan과 bootstrap 중복 빈도를 먼저 조사하고 cache 재도입은 별도 CAIR로 연다. Cache occupancy가 90%(922 preset-title entries) 이상이면서 eviction이 발생하거나 process heap p95가 같은 revision의 cold baseline보다 20MiB 이상 높은 상태가 두 window 연속이면 capacity를 재검토한다. 세 process의 active work가 실제로 겹쳐 포화되거나 Episteme incident가 열리면 env 감축, shared breaker, provider-side rate limit 중 하나를 먼저 닫는다. Production의 provider observation·platform p99/5xx·reviewed_papers source timing·Supabase pool p95 evidence 전에는 상태를 올리지 않는다. |
| `search-quality-evaluation-evidence` | versioned DOI·title·topic evaluation set과 load-smoke v5 report를 읽는 `scripts/search-quality/` evaluator | synthetic fixture를 public readiness로 오인, threshold 역산, set 변경 뒤 오래된 승인 재사용, dirty·mixed·stale evidence의 go 승격, query·paper identity가 포함된 report의 부적절한 공유 | deterministic wiring과 bounded-live scope 분리, set id·version·SHA-256 policy binding, public-or-synthetic-only provenance, exact clean same-revision requirement, missing·stale·future·pre-approval fail-closed, 네 metric 독립 판정, rollout owner 출력, `reports/load-smoke` local retention 재사용 | Human·Operational Readiness가 승인한 privacy-safe bounded-live set, p95·error rate·known-item recall·topic nDCG@10 threshold, sample size·freshness, protected lane exact-head 실행과 dated readiness record | `evidence-needed` | #722. 현재 checked-in synthetic set은 actual-path wiring만 검증하며 release verdict는 `not-applicable`이다. 승인 policy와 bounded-live evidence가 생기기 전에는 public cohort를 열지 않는다. Query와 paper identity가 든 local report를 PR artifact나 공유 문서에 올리지 않는다. |
| `search-first-public-root-ingress` | `/`와 research route는 server layout·빈 search entry의 게이트·session-status 왕복·redirect 없이 public first paint를 렌더한다. post-mount `GET /api/library-context/bootstrap`이 401 또는 Scholar session invalid를 반환하면 content slot은 기존 `MoonlightAuthBootstrap` 인증 화면으로 전환된다. | pre-auth 접근면 확대(auth boundary), mount별 bootstrap 빈도, Moonlight token/session 교환 fan-out, 외부 초대 membership DB read, public 초기 번들 위생, 익명 first-paint load | cookie가 없으면 current-user resolve를 DB/Supabase read 없이 끝내고, 미인증 query는 provider·소유 데이터 실행 전에 auth-required shell branch로 닫는다. 인증 자료가 있는 외부 이메일만 auth source 판정당 `lighthouse.access_allowlist_entries` exact-email membership read 1회를 수행한다. Moonlight와 Supabase credential을 함께 판정하는 요청은 최대 2회이며 row 부재는 거부다. DB 오류는 fail closed하며 magic-link 발급은 503으로 재시도를 안내한다. 내부 이메일은 allowlist table을 읽지 않는다. 401/session-invalid는 stale route, active view, background work를 내리고 공용 shell이 auth surface를 단독 렌더한다. 일반 bootstrap network·timeout·5xx·shape 실패는 content를 유지하면서 account/library projection만 unavailable로 낮춘다. 5초 token/session 교환 성공은 auth surface를 해제하지 않은 채 같은 URL을 새 문서로 다시 연다. 403은 초대 안내를 유지하고, 그 밖의 교환 실패는 stale Scholar session 삭제를 1초 안에 끝내거나 abort한 뒤 EmailGate로 닫는다. `/admin/access` mutation은 internal admin auth, normalized external email, service-role-only table grant, membership insert/delete, least-authority caller registry로 제한한다. 관리자 목록 read는 email-ordered fixed-size keyset page로 제한하고 URL에는 invited email 대신 opaque row cursor만 둔다. `guard:search-first-paint-no-db`는 `identity.ts`에서 시작하는 이 exact-email auth chain만 first-result side-channel로 허용하고 다른 repository 경로는 계속 거부한다. proxy는 root/auth/telemetry hot path에서 Supabase refresh를 건너뛰며 stale refresh cookie를 browser와 same-request downstream에서 제거한다. eager Amplitude는 `check-auth-hot-path.mjs`가 계속 가드한다. | 익명·만료 세션에서 소유 데이터·이메일 유출 0, bootstrap auth-required 뒤 route/background 부재, 외부 접속 membership read p95/p99·오류율과 magic-link 503 빈도, admin list page query 상한·URL PII 0, 일반 bootstrap 실패에서 content 유지, token/session 교환 단일 실행·5초 timeout, stale-session cleanup 1초 timeout·abort, same-URL document navigation, auth challenge viewed event, public `/` bootstrap·401·5xx/p99 | `observed` | #245. 외부 접속 membership DB read 오류가 두 연속 관측 window에서 1%를 넘거나 p99가 auth bootstrap 예산을 침범하면 incident를 열고 초대 확대를 멈춘 뒤 DB/index/pool 원인을 닫는다. public mount의 bootstrap 또는 auth 교환 빈도가 provider/session 허용량을 넘거나 5초 auth timeout·401 반복이 늘면 client backoff, session freshness hint, cohort rate limit 중 하나를 검토한다. public 초기 번들에 내부 계약/테스트 문자열이나 eager analytics SDK가 실측되면 `(research)/page` 기준 bundle guard 재도입 또는 정책적 수용을 먼저 닫는다. |
| `gap-report-build-ingress` | 인증 `POST /api/gap-reports`, shared known-id GET/status, detached viewer recovery POST, 인증 enrichment-retry command, provider/LLM `after()` runner | 임의 unique input의 provider·LLM 비용, process loss 뒤 영구 pending, shared artifact의 viewer identity 혼합 | auth-before-body, exact UTF-8 1,000,000-byte body cap, Zod 전 collection cardinality preflight, query/id 및 nested paper/graph 길이·배열 cap, paper/source ids 최대 40개와 unique/subset 검증, viewer-private field 거부, gap prompt exact UTF-8 65,536-byte cap과 호출별 output token cap, 호출별 10초·critical path 최대 30초 deadline, route 60초, share-safe digest, DB unique artifact key, versioned attempt/70초 lease, `{gapReportId}` recovery의 5초 bounded 재요청, status/direct GET observer-only, service-role-only artifact mutation, viewer-scoped reaction preference. 새 core, failed-core retry, enrichment retry는 principal별 70초 DB admission lease를 공유한다. Report 상태 판정 뒤 claim하고 report CAS no-start·loser는 matching token을 즉시 release한다. Runner 정착도 matching token을 release하며, release 실패 뒤 admission에 결속된 version보다 나중에 terminal이 된 report token은 다음 claim이 한 번만 회수하고 process loss는 expiry로 회복한다. 같은 report duplicate는 work를 늘리지 않고 다른 report는 429 `Retry-After`로 거부한다. 다른 principal은 독립 slot을 가진다. Enrichment retry의 report 단위 60초 cooldown은 이 제한과 별도로 유지된다. admission accepted/blocked/same-report/release와 duration을 identity 없이 관찰한다. | 외부 공개 전 principal별 unique digest 생성률과 provider/LLM 비용 상한, admission accepted/rejected/same-report/release-failure와 claim/release p95·p99, enrichment retry result/duration과 cooldown 빈도, recovery 성공률·attempt 분포, 5xx/p99, abuse/rate-limit 필요성 | `evidence-needed` | #414, #417. DB race·route/runtime evidence는 principal별 fleet-wide active build 1개와 report-scoped retry를 닫는다. 외부 코호트를 열기 전 production admission 분포·release failure·provider/LLM 비용 상한을 관찰하고, principal별 rate/cost ceiling 또는 추가 abuse control이 필요한지 판정한다. |
| `llm-provider-cost-observability` | `app/server/ai-generation/gateway.ts`를 지나는 route AI comment와 trusted `executeJudgment` 기반 LLM 호출 | AI provider cost visibility, price drift, multi-instance duplicate generation, abuse pattern detection | structured generation gateway usage normalization, Gemini/OpenAI model price table, integer `costUsdMicros` estimate, provider/model/role/duration/failure-class/cost attempt observation, route AI comment 10초 deadline, 768 max output token cap, retry off, process-local in-flight dedupe, route AI comment와 trusted `executeJudgment` provider result의 `after()` 예약 `lighthouse.llm_usage_events` append telemetry, prompt/output을 제외한 metadata allowlist. Gap enrichment는 phase와 `gap-report:<id>:initial` 또는 `gap-report:<id>:retry-<n>` bounded mode로 report snapshot, trigger, retry ordinal을 결속한다. | 필요 시 DB 운영 질의로 확인할 사용자별/전체 LLM cost distribution, `priced:false`/`costUsdMicros:null` row 빈도, route AI comment duplicate generation rate, gap retry별 cost/result/duration 상관관계, trusted `executeJudgment` action별 usage distribution, provider 결과 없이 throw된 실패 시도의 usage-attempt attribution 필요성 | `observed` | #238/#239/#254/#449/#414. 정상 사용량이 작은 현재 서비스에서는 hard daily cost cap을 두지 않는다. 비용 telemetry 이상, unpriced model row 반복, 멀티 인스턴스 중복 generation 증가가 보이면 rate limit / abuse guard, provider fan-out control, hard cap 재검토 순서로 다시 판단한다. missing pricing warning은 model별 process-local 1회 발견 신호다. 현재 durable append ledger는 route AI comment와 DB/owner principal을 이미 가진 trusted `executeJudgment` provider-result usage를 닫는다. 웹 앱은 전역 집계 read capability를 갖지 않는다. owner/db trusted boundary가 없는 판단 호출은 console observation에 남기고, 그 경계 변경은 별도 verdict로 재검토한다. |

### Inline-analysis cache retention 실행 절차

Operator 실행 순서, SQL, baseline, 임계와 cadence는
[`docs/runbooks/inline-analysis-cache-retention.md`](runbooks/inline-analysis-cache-retention.md)가
소유한다. 현재 운영 상태와 go/no-go 판정은 위
`inline-analysis-shared-cache` 등록 행이 계속 소유한다.

### Boundary Review Record 템플릿

새 row 또는 상태 전환은 PR/issue에 아래 record를 남긴다.

```markdown
## Operational Boundary Review

- boundary id:
- issue / PR:
- trigger:
- surfaces:
- risk axes:
- current controls:
- false pass this prevents:
- policy decision:
- required controls:
- evidence required:
- evidence observed:
- status:
- next review trigger:
```

### Evidence 사용 규칙

- `public-telemetry-ingress`가 `accepted`가 되기 전까지 public telemetry는 제품
  성공률, user adoption, cohort go/no-go의 primary evidence가 아니다. 보조 관측으로
  쓸 때도 caller/source 한계를 같이 적는다.
- local `load-smoke` green은 필요조건이다. prod SLO, peak instance, open incident,
  provider allowance가 없으면 충분조건이 아니다.
- process-local control은 항상 `N instances` 배수를 함께 기록한다. 단일 인스턴스
  수치만으로 multi-instance cohort를 열지 않는다.
- boundary row를 `deferred`로 두려면 현재 코호트와 무관한 이유, 다음 trigger, owner를
  적는다. “나중에 보기”만으로는 deferred가 아니다.

## 6. 후속 측정 과제

#183 baseline에서 deferred로 남긴 항목이 그대로 유효하다. 구조 개선 후속 작업의
새 baseline 측정에 포함한다.

- Episteme-격리 DB-pool break-point 측정 (Supavisor 풀 임계는 로컬에 없음).
- hanging-host 조건의 회로 차단기 before/after 격리 측정.
- 계측 revision 배포 뒤 provider observation의 distinct active runtime identity와 Vercel의
  canonical peak 동시 인스턴스를 같은 window에 대조하는 관측 루틴 확립(§2·§4의 입력값).
- checked-in controlled provider fixture의 request·response·max-in-flight 통계를
  `load-smoke` report와 결합한다. 3편·40편 fixture의 one-shot ramp는 수동으로
  통계를 나란히 기록했다. Server queue wait·실제 provider call·retry·cancellation의
  causal record는 chokepoint에 추가됐지만 report 자동 결합과 exact production window
  evidence는 아직 없다.
- 승인된 provider allowance 안에서 v5 sustained closed/open report를 만들고
  representative·maximum input profile의 첫 SLO break를 비교한다.
- representative·maximum ramp를 반복 실행해 cold-start와 run-to-run variance를
  분리한다. 단일 비단조 ramp의 `firstWorkloadBreak`를 안정된 capacity boundary로
  해석하지 않는다.

## 7. verdict 기록

Dated 실행과 go/no-go 판정은
[`docs/operational-readiness-records.md`](operational-readiness-records.md)에
기록한다.
