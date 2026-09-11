# Q5 Cache Policy Record

이 문서는 Issue #298의 Lighthouse consumer record다. Cache와 비슷한 상태를
분류하고, 실제 cache의 source owner와 invalidation 경계를 연결한다. Runtime 순서와
운영 verdict는 각각 `docs/runtime-flows/`와 `docs/operational-readiness.md`가 소유한다.

이 record는 전체 cache inventory와 Human 판단의 정본이다. Architecture Fitness policy와
observation은 이 문서에서 승인한 좁은 preset-title 경계만 투영하며 collector는
`match` 또는 `mismatch`를 계산하지 않는다. 현재 pin은 architecture-fitness
`6518ce21f0f755f85331ba7a8813772e4a43d51b`의 v0.9.1이고 generic `cache-lifecycle`
case를 지원한다.

Issue #307의 content-ownership 규칙(PR #309)과 clause normalization(PR #316)에 따라 이
문서는 #298의 inventory와 consumer policy projection만 소유한다. Canonical runtime mechanism은
`docs/runtime-flows/search-mechanism.md`, 운영 상태·배포 verdict는
`docs/operational-readiness.md`, retention baseline·임계·cadence는
`docs/runbooks/inline-analysis-cache-retention.md`, exact test와 command는 Evidence Ledger와
quality-gate owner가 소유한다. Promise·Aspect의 사용자 의미는 유지하고, replaceable
mechanism과 exact evidence는 이 정본들에만 둔다.

- Included machine coverage: preset-title process-local lifecycle와 same-id concurrent fill
- Unsupported coverage: reviewed-papers live source의 production DB availability·read latency·
  pool pressure·instance attribution, inline-analysis fleet, cleanup 효과, production cache 관측,
  process effectiveness
- Machine verdict: checked-in observation은 unsigned라 `unknown`이다. PR #372 protected run
  `29584588648`의 exact target `b4371af77c75825462759e38d8c0d74a43a57ce2`는
  preset-title included case를 `verified / healthy`, merge advisory `allow`로 판정했다.
  아래 unsupported coverage는 그대로 `unknown`이다.
- Human status: 전체 Q5는 `evidence-needed`
- Initial static inventory inspection base: Lighthouse
  `a77a7a51a39c69d4d5c5dc25fab63c1e689ad962`.
- Prior Q5 implementation and control verification baseline: Lighthouse
  `fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41`.

## State inventory

| state ref | classification | canonical owner | Q5 처리 |
| --- | --- | --- | --- |
| `reviewed-papers-library-context` | authoritative live read, not a cache | `lighthouse.reviewed_papers`, `app/server/domain-access/reviewed-paper-access.ts` | 검색·bootstrap 실행별 owner-scoped source read로 아래 current-source 경계를 연결한다. |
| `paper-inline-analysis-cache` | durable reusable artifact cache | `lighthouse.paper_inline_analysis_cache`, inline-analysis repository와 domain-access | 아래 consumer policy projection에서 정본 경계를 연결한다. |
| library preset `epistemeTitleCache` | derived provider display cache | `app/server/services/library-anchor-display.ts` | 아래 projection이 #320에서 닫은 bounded lifecycle과 coalescing 경계를 연결한다. |
| compatibility context `cached` store | derived configuration parse cache | `app/server/services/library-context-source.ts` | 아래 consumer policy projection에서 정본 경계를 연결한다. |
| analytics `eventContract` | derived configuration parse cache | `app/server/domain-access/analytics-event-access.ts`, `docs/analytics/events.yaml` | 아래 consumer policy projection에서 정본 경계를 연결한다. |
| auth resolver React `cache()` | request memoization | `app/server/auth/identity.ts` | 한 request의 principal 해석만 합친다. Durable/fleet cache가 아니다. |
| `inFlightInlineAnalysisResolutions` | process-local coalescing | `app/server/domain-access/inline-analysis-access.ts` | Cache source가 아니다. DB lease가 fleet 동시 생성을 조정한다. |
| route AI comment `inFlightGenerationEntries` | process-local coalescing | route AI generation runtime-flow | Durable result cache가 아니다. 다른 instance의 중복 생성은 비용 unknown으로 남긴다. |
| gap-network in-flight maps와 build lease | reusable artifact coordination | gap-network runtime-flow와 `lighthouse.gap_reports` | Process map은 fast path다. DB artifact와 lease가 지속 상태를 소유한다. |
| spelling-correction `inFlightRequests`와 last-resolved marker | execution-scoped client coalescing / completion marker | search route renderer | Result cache가 아니다. Execution identity가 바뀌면 reuse하지 않고 timeout·route change 때 in-flight work를 폐기한다. |
| working context buffer | process-local session state | `app/server/reference/working-context.ts` | 항목 30분, session 6시간, session당 50개 제한을 가진다. Instance 이동 miss는 graceful degrade다. |
| Episteme circuit lanes·slot waiters와 public telemetry buckets | failure-protection / capacity state | external HTTP gateway·Operational Readiness | Cache가 아니다. Process-local 보호와 fleet budget/evidence로 분류한다. |
| OpenAI·Gemini client, Amplitude module/init Promise, analytics router | process resource / configuration initialization state | AI·analytics client owners | 결과 cache가 아니다. Provider/module resource를 재사용하거나 한 process의 초기화를 합친다. OpenAI는 API key 변경 때 교체하고 Gemini·analytics의 runtime config 변경은 process restart 경계다. |
| repository DB-handle `WeakMap` | opaque authority/resource registry | repository DB handle owner | Derived value cache가 아니라 raw DB capability를 opaque handle에 결속하는 registry다. Handle GC와 함께 entry가 사라진다. |
| pricing·missing-table warning flags | process log-suppression state | AI gateway·error-log repository | Source value를 재사용하지 않고 같은 process의 반복 경고만 억제한다. |
| auth session-touch timestamp와 analytics once keys | client throttle / event-dedupe state | auth touch·analytics owner | Source value cache가 아니며 session touch/event 중복 억제만 소유한다. |
| relationship analytics pending queue | process execution buffer / dynamic-import coalescing | relationship route analytics emitter | 결과 cache가 아니다. Import가 정착하면 queue를 drain하고 실패하면 버린다. |
| runtime mount counters | ephemeral identity state | route runtime | Source value cache가 아니라 같은 process의 mount identity만 소유한다. |
| feedback·debug localStorage | persisted client preference state | 각 UI surface | Derived cache가 아니라 사용자가 선택하거나 확인한 상태다. |

이 목록은 이름에 `cache`가 있는지로 분류하지 않는다. 재사용하는 derived value,
동시 실행을 합치는 Promise, 지속 artifact의 lease, session state, provider 보호 상태를
분리한다.

## Reviewed-papers library context

- Source of truth: owner principal별 `lighthouse.reviewed_papers` row다.
- Policy owner: `app/server/domain-access/reviewed-paper-access.ts`다.
- Scope와 freshness: 검색과 post-mount bootstrap 실행마다 현재 principal id predicate로
  repository를 읽는다. 빈 목록도 그 실행의 유효한 current source지만 다음 실행에서
  재사용하지 않는다. Framework result cache, cache key/tag, time revalidation은 없다.
- Mutation coverage: save/remove와 Moonlight principal lazy backfill이 허용 write다. 각
  mutation은 DB commit만 소유하며 그 뒤의 새 실행이 current rows를 읽는다. 이미 연결된 동일
  principal의 잔여 legacy row는 재검사하지만 허용 owner provenance는 `NULL`과 과거
  `app_users.id`로 한정한다.
  다른 token subject로의 전환이나 nonlegacy row owner는 email continuity·legacy `user_id`만으로
  승인하지 않고 DML 전 fail-closed한다. Exact runtime rule과 evidence는
  `docs/runtime-flows/search-mechanism.md`의 library context source 절과
  `docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml`가 소유한다.
- Execution과 failure: personalized 검색의 owner read와 keyword provider를 동시에 시작하고,
  source가 준비되는 즉시 graph preflight를 잇는다. Source read 실패는 keyword-only로
  degrade한다. Bootstrap도 실행마다 같은 current read를 한다.
- Retention과 privacy: reviewed-papers source를 별도 runtime cache에 보존하지 않는다.
  Owner predicate와 non-identifying source outcome/count/timing만 관측한다.
- Evidence: 위 Evidence Ledger, first-paint repository exception guard, repository acquisition
  guard를 사용한다. Issue #583 이후 reviewed-paper access는 별도 citation index, response-tail
  warm 또는 process cache를 만들지 않는다.
- Decision: owner-scoped current read를 유지한다. 개인화 검색당 read 수, resolution p99,
  empty/failure 비율, Supabase pool p95가 운영 재검토 입력이다.

## Episteme library preset-title cache

- Source of truth: precomputed `anchorPapers[].title`이 있으면 그것이 현재 display source다.
  빠진 numeric corpus id만 Episteme paper metadata로 보강한다.
- Policy owner: `app/server/services/library-anchor-display.ts`와 Operational Readiness의
  `episteme-provider-fanout` boundary다.
- Key scope: process-local map의 raw paper id다. Title은 principal과 무관한 public paper
  metadata라 principal을 key에 넣지 않는다.
- Freshness와 invalidation: positive title은 15분, 성공 응답의 empty/null은 30초 뒤 만료한다.
  Source mutation event는 없으며 TTL 뒤 첫 miss가 provider correction이나 transient empty
  recovery를 다시 읽는다. Process-local LRU는 최대 1,024 entries다.
- Miss·empty·failure: miss는 numeric id를 800ms bounded Episteme batch로 보강한다. Throw,
  timeout은 cache하지 않고 fallback title로 degrade한다. Caller abort의 fallback은 cache하지
  않는다. 이미 시작한 shared fill은 자체 deadline 안에서 계속되어 다른 subscriber를 보호하고,
  이후 성공하면 정상 positive/negative TTL로 cache할 수 있다. 성공 응답에 paper가 없을 때만
  null을 negative-cache한다.
- Concurrent fill과 scope: 동일 process와 raw paper id의 동시 miss는 한 Promise를 공유한다.
  한 caller의 abort는 그 caller의 wait만 끝내고 shared fill signal을 취소하지 않는다. 다른
  instance는 map과 in-flight Promise를 공유하지 않는다. Process restart는 cold miss일 뿐
  correctness source를 잃지 않는다.
- Retention과 privacy: title/null만 최대 1,024 entries로 보존한다. Aggregate observation에는
  duration, fill/hit/coalescing 수, cache entry/capacity/eviction, heap만 기록하고 principal,
  paper id, folder, prompt 입력은 기록하지 않는다.
- Evidence: implementation revision
  `fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41`의 deterministic clock·capacity·concurrency
  suite가 precomputed/cold/warm, positive/negative expiry, LRU eviction, same-id fill,
  one-caller abort, provider failure·abort를 무시하는 timeout의 late completion 비캐시,
  observation sink failure의 domain-result 비간섭을 검증한다.
- Decision: `constrain-existing`으로 bounded lifecycle과 same-id coalescing을 추가했다. Shared
  backend, provider topology, library bootstrap의 사용자-facing 의미는 바꾸지 않았다. 이
  included machine case가 fleet evidence를 대신하지 않는다.
- Re-entry: provider correction이나 null recovery가 TTL 안에서 더 빨라야 하는 사례, hydration
  p99 800ms 도달, timeout/failure 1% 초과, provider fill ratio 50% 초과, cache 90% 이상과 eviction
  지속, process heap p95가 baseline보다 20MiB 이상 증가하면 다시 연다.

### Preset-title bounded child — #320

- Status: implementation revision `fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41`에서 완료했다.
  #320이 deterministic lifecycle/concurrency evidence와 운영 trigger를 소유한다.
- Scope: `app/server/services/library-anchor-display.ts`의 process-local title/null cache만
  reshape한다. Shared backend, provider topology, library bootstrap 계약은 바꾸지 않는다.
- Acceptance: positive 15분, negative 30초, LRU 1,024 entries, 동일 raw paper id in-flight
  coalescing, shared 800ms deadline과 caller-only abort 경계를 deterministic test로 잠갔다.
- Verdict boundary: v0.9.1 included case는 이 child의 process-local lifecycle만 판정한다.
  Fleet·cleanup·production coverage는 계속 `unsupported / unknown`이다.

## Compatibility library-context parse cache

- Source of truth: external-source compatibility mode에서 명시한 `LIBRARY_CONTEXT_JSON` 또는
  `LIBRARY_CONTEXT_PILOT_PATH` file content다. 기본 제품 `reviewed_papers` source나 live
  Moonlight API 응답은 이 cache를 사용하지 않는다.
- Policy owner: `app/server/services/library-context-source.ts`와 runtime-flow의 configured
  file/env source 절이다.
- Key scope와 freshness: env는 전체 configured string을 source key로, file은
  mtime·size·content hash를 source key로 사용한다. 같은 크기 rewrite도 hash가 달라지면 다시
  parse한다. Missing file은 cache하지 않고 다음 lookup에서 다시 확인한다. Malformed value는
  같은 source key 동안 null로 유지하고 content가 바뀌면 다시 시도한다.
- Miss·empty·failure: synchronous JSON parse miss만 계산한다. 유효한 empty store와 malformed
  null은 구분하고 live API failure를 static stale source로 fallback하지 않는다.
- Concurrent fill과 scope: parse는 동기이고 한 process에서 마지막 source 하나만 보존한다.
  Fleet/deployment 간 공유나 durable state가 아니다.
- Retention과 privacy: one-entry process cache다. Compatibility JSON이 가진 email/context는
  원 source와 같은 server memory에만 있고 client나 cross-principal key로 나가지 않는다.
- Evidence와 decision: file cache reload, env precedence, malformed/missing, production default
  pilot exclusion tests를 사용한다. 현재 정책은 `keep`; source-key 구성이나 compatibility
  flag가 바뀌면 다시 검토한다.

## Analytics event-contract parse cache

- Source of truth: checked-in `docs/analytics/events.yaml`과 analytics event-contract validator다.
- Policy owner: analytics event workflow와
  `app/server/domain-access/analytics-event-access.ts`다.
- Key scope와 freshness: process당 contract 하나를 동기 load한 뒤 재사용한다. Production에서
  contract file을 runtime mutation하지 않으며 deploy/process restart가 새 source를 읽는
  invalidation 경계다.
- Miss·failure·concurrency: 첫 trusted analytics access가 한 번 parse한다. Load/validation이
  throw하면 값이 저장되지 않아 다음 access가 다시 시도한다. Parse가 동기라 process 안의
  concurrent fill은 없다.
- Retention과 privacy: event schema와 emitter metadata만 process memory에 두며 사용자 event나
  principal은 저장하지 않는다. Fleet instance는 각자 같은 build artifact를 읽는다.
- Decision: `keep`. Runtime contract mutation이나 remote contract source를 도입하면 source key,
  reload, partial failure policy를 별도 재검토한다. Contract validation 증거는 analytics quality
  gates가 소유한다.

## Paper inline-analysis shared cache

- Source of truth: exact identity의 성공 artifact는
  `lighthouse.paper_inline_analysis_cache`의 `ready` row다. Prompt 입력 source는 provider가
  돌려준 title, abstract, year다.
- Policy owner: `docs/runtime-flows/search-mechanism.md`의 Shared inline-analysis cache
  절과 inline-analysis domain-access/repository가 소유한다.
- Key scope: `(paper_id, INLINE_ANALYSIS_VERSION, input_fingerprint)`다.
  `input_fingerprint`는 정규화한 title, abstract, year의 SHA-256이다. Principal은 route
  권한과 최초 generation usage attribution에만 참여한다.
- Freshness: source 입력 변경은 fingerprint가 분리한다. Prompt, output schema,
  normalization, failure 의미, model compatibility가 바뀌면 analysis version을 올린다.
  시간 경과만으로 current exact-identity artifact를 stale로 만들지 않는다.
- Version rule: cache-relevant contract change는 version 증가가 필요하고, contract digest가 같은
  compatibility-only 증가는 새 `INLINE_ANALYSIS_VERSION_REASON`이 필요하다. Selector와 gate
  semantics는 `docs/contract-maps/quality-gates.md`의 operational-boundary guard가 소유한다. 이
  guard는 변경의 제품 의미나 Q5 verdict를 판정하지 않는다.
- Miss와 failure: miss만 provider generation을 시작한다. Low-confidence empty failure
  placeholder는 `ready`로 완료하지 않고 token-matched claim을 release한다. Abstract가 없는
  paper도 cache row를 만들지 않는다.
- Concurrent fill: 같은 process는 exact identity별 Promise를 공유하고, DB lease가 같은 database를
  쓰는 worker의 한 owner만 선택한다. Claim, owner/waiter, completion, cleanup 순서와 시간 예산은
  `docs/runtime-flows/search-mechanism.md`의 Shared inline-analysis cache 절이 소유한다.
- Scope: artifact와 lease는 DB를 공유하는 instance 전체에 적용된다. Process map은 지연
  단축만 소유한다.
- Retention projection: current와 명시적 rollback version은 보존하고, 그 밖의 오래된 `ready`
  version만 operator-owned bounded batch로 정리한다. `pending`, current/future, rollback은
  삭제하지 않으며 runtime role이나 scheduled job에 delete capability를 주지 않는다. Exact
  function, 실행 command, baseline, 임계와 cadence는
  `docs/runbooks/inline-analysis-cache-retention.md`가 소유하고, deployment no-go는
  `docs/operational-readiness.md`가 소유한다.
- Decision: exact identity, 성공 artifact 재사용, lease와 failure exclusion은 유지한다.
  Retention은 위 projection처럼 current/rollback 보존 + bounded cleanup 방식으로 선택했다. Fleet
  failure-injection/load evidence는 별도로 남는다.
- Re-entry: version/schema/model compatibility 변경, provider metadata correction 사례,
  non-current identity 증가, relation size 또는 월 증가량의 운영 임계 결정, duplicate
  generation, expired-lease recovery 실패가 생기면 다시 연다.

## Contract Architecture Impact Review

Contract delta: 기존 `library-source-sync` 제품 의미를 유지하면서, 새 검색과
post-mount bootstrap이 현재 principal의 `reviewed_papers`를 오래된 framework cache 없이
읽도록 production incident의 source freshness 경계를 복구한다.
Verdict: reshape
Affected axes and current owners: Source of truth and authority; State lifetime and recovery;
Execution semantics; Resource and capacity; Compatibility and retirement —
`app/server/domain-access/reviewed-paper-access.ts`,
`docs/runtime-flows/research-route-lifecycle.md`,
`docs/runtime-flows/search-mechanism.md`, `docs/operational-readiness.md`
Decision: `reviewed_papers` 목록은 검색·bootstrap 실행마다 owner predicate가 있는 repository
read로 해석한다. 저장·해제와 principal backfill은 DB commit만 소유하며 별도 cache tag
무효화에 의존하지 않는다. 이 결정 당시 분리해 유지한 direct-citation index의
anchor-revision process LRU/TTL은 Issue #583에서 불필요한 cold fill로 재판정해 제거했다.
Rejected alternative: 60초 stale-while-revalidate를 freshness 상한으로 간주하거나, 같은
best-effort tag 무효화에 retry·path invalidation을 더하거나, 현재 소규모 owner-shaped
목록을 위해 새 distributed cache를 도입하지 않는다.
Evidence and structural defense:
`app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts`,
`app/server/services/__tests__/search-execution.test.ts`,
`scripts/quality/check-search-first-paint-no-db.mjs`,
`docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml`,
`docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.yaml`
Human decision required: no

## Propagation Map

Invariant: 저장·해제 또는 principal backfill이 끝난 뒤의 새 검색과 bootstrap은 현재
principal의 최신 `reviewed_papers` 집합을 사용하며, 이전 빈 목록을 runtime cache에서
재사용하지 않는다.
Owning contract bundle: `promise:search-results-fast-window`의
`library-source-sync`·`reviewed-papers-context-source`,
`promise:search-result-library-add`의 `reviewed-papers-basis`,
`aspect:library-grounded-research`, `aspect:first-paint-persistence-independence`,
`library-grounded-research.ledger.yaml`, `search-result-window.ledger.yaml`,
`search-result-library-add.ledger.yaml`, `search-ephemeral-execution.ledger.yaml`
Runtime/engineering owner: `app/server/domain-access/reviewed-paper-access.ts`,
`app/server/services/search-execution.ts`,
`docs/runtime-flows/research-route-lifecycle.md`,
`docs/runtime-flows/search-mechanism.md`, `docs/operational-readiness.md`
Required code/test paths: reviewed-paper domain access와 mutation, principal snapshot backfill,
search execution·bootstrap 호출부, auth-boundary·search-execution·bootstrap·snapshot 동작 테스트,
first-paint repository exception과 least-authority public-symbol inventory,
exact-revision evidence에 묶인 search-state·Q2 critical-path·serialized-input collector policy와
checked observation
Inspected, not edited: Promise·Aspect 본문, provider graph/hydration, client library refresh,
Q5 preset-title executable profile와 pinned observation
Compatibility-only shapes: `reviewed-papers-library-context` framework cache key·tag·무효화 helper,
`resolveMyCachedReviewedPapersLibraryContextSource` 이름,
`@search-first-paint-allow cached-library-preflight` marker와
`cached-library-graph-preflight` 예외는 `remove`; owner-shaped live read 이름·marker·예외로
교체하며 keyword provider 시작과 DB source read를 동시에 시작한다. Exact-revision
collector는 각 revision에 실제로 존재하는 두 이름을 모두 읽을 수 있다.
Split cleanup: distributed cache 도입, Q5 protected attestation/profile 확대,
inline-analysis·preset-title cache 변경은 이 incident에서 제외한다.
Budget: 40..42 authored files와 collector가 생성하는 checked observation 6개;
1,050..1,150 authored changed lines이며 generated JSON churn은 별도다. Initial forecast의
30-file 상한은 first-paint guard definition에 결합된 exact-revision search-state evidence,
현재 search test에 결합된 Q2 evidence, route-renderer harness에 결합된 serialized-input
evidence의 policy·collector baseline 재수집과 구형 direct-await·신형 Promise.all을 함께
검증하는 Q2 cross-epoch 분석을 빠뜨렸다. 제품·provider·storage scope는 늘리지 않는다.

## Concept Shift Architecture Review

- Owner-scoped `reviewed_papers` repository read: `preserve` — 현재 source of truth이며 검색과
  bootstrap 실행마다 새로 읽는다.
- `reviewed-papers-library-context` framework cache key·tag·60초 revalidation·invalidation helper:
  `remove`.
- `resolveMyCachedReviewedPapersLibraryContextSource`와
  `cached-library-graph-preflight` marker/guard vocabulary: `remove`.
- Owner-shaped live-source resolver와 `live-library-graph-preflight` guard exception:
  `preserve` — keyword provider와 동시에 시작하는 현재 실행 경계다.
- Direct-citation anchor-revision process LRU/TTL, response-tail warm과 projection service:
  `remove` — Issue #583에서 query-aware graph 관계와 중복되는 cold fill로 은퇴했다.
- Q5 preset-title checked observation과 exact-revision evidence: `preserve` — 현재
  reviewed-papers runtime owner로 재해석하지 않는 pinned historical evidence다.

Q5 included case의 `healthy/degraded/unknown`, unsupported coverage의 `unknown`, Human decision,
CAIR verdict, Operational Readiness status는 서로 대체하지 않는다.

## Scenario evidence and remaining unknown

Initial inventory inspection base는 Lighthouse
`a77a7a51a39c69d4d5c5dc25fab63c1e689ad962`이고, preset-title·inline-analysis
guard·retention을 포함한 prior Q5 implementation and control verification baseline은
`fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41`이다.

| cache | scenario | evidence | status |
| --- | --- | --- | --- |
| reviewed-papers | source mutation과 next-execution freshness | save/remove auth-boundary test와 empty→mutation→current row 재조회 test, lazy owner-backfill의 same-principal residual repair·linked/nonlegacy-owner mismatch fail-closed·atomic collision reconciliation evidence | committed deterministic evidence |
| reviewed-papers | principal collision | owner principal predicate를 repository call과 public domain-access surface가 함께 잠그는 auth-boundary·least-authority test | committed deterministic evidence |
| reviewed-papers | search concurrency와 process/instance movement | live source read와 keyword fetch 동시 시작 test; runtime cache가 없어 process/instance movement가 source freshness를 바꾸지 않음 | committed deterministic evidence; production DB load evidence needed |
| inline-analysis | cold miss·warm exact hit | shared hit는 provider generation을 건너뛰고 missing paper만 claim하는 domain-access test | base deterministic evidence |
| inline-analysis | source content·year·version 변경 | content fingerprint mismatch, year/whitespace identity, previous-version non-reuse tests | committed deterministic evidence |
| inline-analysis | 동일·부분 중첩 concurrent fill | DB claim 뒤 peer result reuse, parallel waiter와 one-wave tests | base deterministic evidence |
| inline-analysis | leader failure·timeout·cancellation | token release, partial-release rejection, caller abort와 1.5초 cleanup, peer deadline tests | base deterministic evidence |
| inline-analysis | process restart·instance movement | DB lease/reclaim 구조와 deterministic clock tests만 있고 실제 multi-instance failure injection은 없음. #321이 후속 evidence를 소유한다. | `unknown` |
| preset title | miss·provider failure·timeout | precomputed title precedence, Episteme fill, fallback, timeout·abort tests | base deterministic evidence |
| preset title | warm hit·positive/negative expiry·capacity·concurrent fill | 15분/30초 deterministic clock, 1,024-entry LRU eviction, same-id one-fill, caller-only abort, abort 무시 timeout late completion·failure 비캐시, observation sink 비간섭 test (`fe7f37ab87a1ccc2f05de3111821fdccc4a4fe41`) | included machine observation complete; unsigned `unknown`, isolated activation merge와 first signed run pending |
| compatibility parse | source rewrite·malformed·missing·env precedence | content-hash same-size rewrite, missing retry, malformed null, env precedence tests | base deterministic evidence |
| analytics event contract | first load·invalid contract·deploy change | analytics event validator와 process-lifetime source inspection; runtime file mutation은 지원하지 않음 | base static evidence |

Exact 재검증 command는
`docs/contracts/story-chain/evidence-ledgers/library-grounded-research.ledger.yaml`,
`docs/contracts/story-chain/evidence-ledgers/inline-analysis.ledger.yaml`, analytics event quality
gates와 `guard:inline-analysis-cache-contract`가 소유한다.

Issue #321의 multi-instance failure/load evidence, Issue #319의 post-cutoff cleanup evidence뿐 아니라
preset-title hydration p99 800ms 도달, failure/timeout 1% 초과, provider
fill ratio 50% 초과, cache occupancy 90% 이상과 eviction 동시 발생, 같은 revision의 cold
baseline 대비 process heap p95 20MiB 이상 증가, 열린 provider 5xx/timeout incident 중 하나가
생기면 이 record를 다시 연다. 2026년 8월 초까지 Episteme 내부 정비로 발생할 수 있는
timeout·5xx·latency는 Lighthouse 회귀와 자동으로 합치지 않고 provider-maintenance
귀속으로 분리한다. Production migration ledger는 2026-07-15에 `00022`까지 정합화했다.
