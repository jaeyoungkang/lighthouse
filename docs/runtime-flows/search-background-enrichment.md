# Search Background Enrichment

첫 search payload가 공개된 뒤 card detail, 연구 용어, 맞춤법 교정, inline analysis를
보강하는 route-owned background 순서를 설명한다.

## Scope

- primary entrypoint: `app/components/research/ResearchBackgroundTasks.tsx`
- state owner: active execution에 귀속된 background task와 metadata delta
- lifetime: current route view와 execution cycle
- fallback owner: 기존 lightweight payload를 보존하는 terminal settlement

## Contract Architecture Impact Review

2026-07-30 — inline analysis provider failover와 명시적 recovery.

Verdict: reshape

Contract delta: inline analysis lease owner는 Gemini primary를 최대 10초 실행하고,
  transient failure면 OpenAI `gpt-5.4-mini` secondary를 한 번 실행한다. 두 provider가
  실패하면 같은 입력을 자동 재실행하지 않고 durable failure fence와 사용자-visible
  retry command로 닫는다. 전체 owner/lease 상한은 30초다.
Affected axes and current owners: Interaction timing; Domain and data shape;
State lifetime and recovery; Execution semantics; Runtime, external, or AI boundary;
Resource and capacity; Observability and audit — provider 순서와 failure class는
structured-generation gateway와 inline-analysis service, 성공·failure state와
generation epoch는 shared cache RPC와 domain-access, 사용자 command와 표시 상태는
background runner와 paper card가 소유한다.
Decision: 한 DB lease owner가 primary→secondary chain과 exact-token
  completion/failure transition을 모두 소유한다. Process-local breaker는 알려진 Gemini
  장애를 fast bypass하지만 fleet 상태를 대표하지 않는다. Transient failure fence는
  canonical `(paper_id, version, input_fingerprint)` identity에 5분·15분·60분 cooldown을
  기록하고, cooldown 종료 뒤에도 explicit retry command만 새 epoch를 연다.
Rejected alternative: same-provider batch→N fallback, lease 만료·remount·timer에 의한
  자동 provider 재호출, third provider, process-local breaker를 fleet-wide authority로
  해석하는 방안은 거부한다. 공통 LLM admission과 Vercel topology는 #442가 소유한다.
Evidence and structural defense:
`app/server/ai-generation/__tests__/gateway.test.ts`,
`app/server/domain-access/__tests__/inline-analysis-access.test.ts`,
`app/server/services/__tests__/inline-analysis-service.test.ts`,
`app/components/research/__tests__/ResearchBackgroundTasks.inline-analysis-owner-recovery.test.tsx`
가 timeout/failure, provider schema parity, no-third-call·no-auto-retry,
exact-token/epoch와 explicit recovery 경계를 잠근다.
Human decision required: no

## Propagation Map

Invariant: primary 10초 뒤 secondary는 lease owner 한 명만 한 번 호출하고, 전체 30초
안에 성공 또는 durable degraded state로 닫으며 explicit user retry 전에는 같은 입력의
provider 호출을 다시 만들지 않는다.

Owning contract bundle: `promise:inline-analysis-auto-run`,
`aspect:provider-failure-degraded-mode`, `inline-analysis.ledger.yaml`,
`provider-failure-degraded-mode.ledger.yaml`.

Runtime/engineering owner: 이 문서의 inline-analysis scheduling/cache/degrade order,
structured-generation gateway, inline-analysis service와 domain-access/repository,
shared cache migration, background runner와 paper-card generated-content surface.

Required code/test paths: provider failure classifier와 process-local breaker, Gemini→OpenAI
failover gateway, shared cache failure/CAS RPC, explicit retry request/result carrier, client
settlement와 retry control, provider/cache/client deterministic tests, canonical retry event와
usage observation.

Inspected, not edited: route AI comment, research-term discovery, spelling correction,
successful cache consumers, search result membership/ranking, gap/citation generation.

Compatibility-only shapes: ready cache identity와 `AIAnalysis` payload는 `preserve`.
기존 pending lease는 새 30초 claim에서 만료 후 회수한다. failure placeholder 분석은
`remove`; degraded state는 분석 payload가 아니라 generation state로 운반한다.

Split cleanup: fleet/shared admission, region·Function topology, production cohort와
rollout verdict는 #442·#321에 남긴다.

Budget: 최대 36개 authored files; 최대 3,300 authored changed lines. 2026-07-31
Human checkpoint에서 신규 파일을 포함한 34개 파일·3,109줄 실제 범위를 확인하고
남은 게이트 정합화 여유까지 포함해 확장 승인했다. generated analytics coverage와
lockfile은 별도다.

## Shared Execution Boundary

세 search background HTTP route의 command/delta wire 계약과 legacy dual-read retirement는
`search-background-transport.md`가 소유한다. 이 문서는 execution 수명과 각 background
writer의 처리 순서만 소유한다.

Background producer는 시작 시점의 active execution id, view id, owner, query와 paper id
순서를 캡처한다. 응답은 이 identity와 현재 snapshot이 맞을 때만
`patchCurrentView`로 병합한다. Writer는 자신이 소유한 metadata delta만 합치고 현재
sort·year·facet, spelling, review state와 다른 writer 결과를 되돌리지 않는다.

Route 또는 execution이 바뀌면 search enrichment, graph hydration, term discovery와 inline
analysis transport를 abort하고 task를 폐기한다. 같은 view id와 `updatedAt`이 재사용돼도
execution id가 다르면 이전 completion을 받지 않는다.

같은 execution 안에서도 search의 versioned enrichment command input(canonical ordered
snapshot target과 hydration·library exclusion input) 또는 graph-neighbor의
paper·co-cited·coupled target이 바뀌면 진행 중인 이전 hydration을 abort하고 새 target
attempt로 교체한다. Active entry는 attempt key와 controller를 함께 소유하며, 이전
attempt의 finalizer는 자신이 등록한 entry와 정확히 일치할 때만 이를 해제한다.

Search, graph hydration, term discovery와 inline analysis client JSON transport는 공통
65초 silence rail을 쓴다. Abort signal과 response reader를 직접 race해 browser transport가
abort를 무시해도 runner promise가 끝나게 한다.

서버 route는 principal을 먼저 확인한다. 그 다음 route별 byte ceiling 안에서 JSON을
읽고 ingress 전용 schema로 query와 주요 collection cardinality를 검증한다.
Unauthenticated request는 body를 읽거나 DB·provider·LLM 작업을 시작하지 않는다.
`app/server/operational/route-ingress-policy.json`이 각 route의 byte와 cardinality
예산을 소유한다.

## Card Hydration

Ready search view가 hydrate 가능한 E3 paper reference를 포함하고
`abstractHydration.status:"pending"`이거나 one-shot repair 대상이면
`POST /api/search/enrichment`를 호출한다. 신규 client body는 route별 versioned command며
canonical query와 전체 committed paper id 순서, hydration·repair state,
library-only id를 운반한다. 서버는 저장 search row를 읽거나 쓰지 않는다. Route가
principal을 확인한 뒤 byte ceiling과
`SEARCH_RESULT_POOL_PAPER_LIMIT` 상한을 검증한다.
같은 auth context를 domain-access에 넘겨 인증을 다시 해석하지 않는다.

`computeSearchHydration`은 commit된 paper reference를 E3 native batch projection으로 hydrate해
abstract/authors/PDF/venue/field detail만 합친다. Title, year, citation count, paper order와
첫 payload의 library context·graph support·facet state는 보존한다. Neighborhood lookup,
blend, rank와 supplement injection은 다시 실행하지 않는다.

오류 envelope가 `429`, `5xx`를 반환하거나 timeout·transport loss가 나면 최대 3회
bounded retry한다. `400/401/403/404/409/413/422`는 같은 snapshot을 반복하지 않고
첫 응답에서 lightweight 결과를 `ready + repairAttempted:true`로 닫는다. 세 번 모두
실패하거나 성공 응답에 usable detail이 없어도 같은 terminal state로 닫아 무한 queue와
AI comment 대기를 막는다. 공통 status/action 의미는
`api-response-and-retry.md`가 소유한다.

## AI Comment Readiness

Facet이 없는 pending search는 첫 payload에서 result basis가 이미 정해졌으므로 card
hydration을 기다리지 않고 title·year·citation basis로 AI comment generation을 시작할 수
있다. Hydration은 같은 generation과 병렬이며 두 번째 comment를 만들지 않는다.

저자·분야·venue·PDF facet처럼 hydration detail이 visible membership을 정하는 경우에는
terminal hydration/repair까지 provider generation을 보류한다. 확정 pool이 비면 provider
request 없이 loading을 닫는다. Transport 직전에도 readiness를 다시 확인해 stale queued
command를 보내지 않는다.

## Term Discovery

Hydration-ready search view의 `englishTermDiscovery.status:"pending"`은 initial task 하나를
`POST /api/search/term-discovery`로 보낸다. Inline-analysis 완료 뒤 별도
`analysis_upgrade` 재추출은 없다.

서버는 principal을 먼저 확인하고 route별 command byte/cardinality를 검증한다. 그 뒤
prompt projection을 current shared inline-analysis cache로 보강하고 상위 12편의
title/abstract를 compact prompt로 만들어 Gemini lite 추출을 실행한다. 성공은
`status:"ready", source:"llm"`으로 닫는다. Key 부재, timeout, parse 실패 또는 usable 후보
없음은 deterministic 목록을 합성하지 않고 같은 source의 빈 목록으로 닫는다.

Graph support는 LLM 후보를 annotate·재정렬할 수 있지만 후보가 없을 때 새 용어를 만들지
않는다. Merge가 current execution에 적용된 뒤에만 canonical viewed event를 남긴다.

## Spelling Correction

Search result가 commit되고 query가 있으며 correction metadata가 없을 때
`useSearchSpellingCorrectionRequest`가 `POST /api/search/spelling-correction`을 호출한다.
Request는 execution/view/query identity로 dedupe하고 25초 client deadline을 가진다.

서버는 principal을 확인한 뒤 query-only versioned command의 byte와 query 500자 경계를
검증한다. Legacy full-metadata request만 기존 correction을 recovery하고, v1 command는
같은 principal의 provider-bound 요청을 process마다
분당 12회로 제한한다. Admission을 통과하면 `resolveSearchSpellingCorrection`을
실행한다. 명백한 교정어가 있을 때만
`spellingCorrection` delta를 반환한다. Key 부재, timeout, parse 실패 또는 교정 불필요는
UI를 만들지 않는 `null`이다.

Client는 `400/401/403/413/422`를 해당 execution의 terminal 결과로 기억한다.
`429`, `5xx`, timeout·transport loss와 malformed success만 request key를 풀어 다음
mount에서 다시 평가한다. 이 구분은 사용자-facing best-effort 침묵을 바꾸지 않는다.

`교정 검색어로 검색`은 card-local 재실행이 아니라 current 조건을 보존한 새
`/search?q=` route navigation이다. 이전 검색 복원은 browser history가 소유한다.

## Inline-analysis Scheduling

Inline analysis는 현재 정렬·필터 projection에서 실제 viewport에 들어온 card만 queue한다.
Route AI comment가 pending이면 request-start 신호가 기록된 뒤에 첫 provider batch를
시작한다. Search와 relationship view 모두 한 request에서 최대
`INLINE_ANALYSIS_REQUEST_PAPER_LIMIT`편을 처리하고 남은 visible id는 다음 batch로
이어 간다.

Task identity는 execution, view, result paper-id set과 canonical prompt input을 포함한다.
Caller transport 취소나 route/execution/cycle 변경은 자동 재호출을 만들지 않는다.
미완료 claim은 정리하고 현재 카드에는 명시적 재시도가 필요한 failure state를 남긴다.

## Shared Inline-analysis Cache

성공 artifact의 identity는
`(paper_id, analysis_version, canonical title/abstract/year input_fingerprint)`다.
Principal은 route 권한과 실제 miss generation usage attribution에만 참여한다. Current
version·fingerprint가 맞고 usable abstract가 있는 `ready` row만 search, citation, similar
surface에서 공유한다.

Cache miss는 DB의 30초 expiring lease를 획득한 worker만 provider에 보낸다. Owner는
Gemini primary를 최대 10초 실행하고 transient failure면 OpenAI `gpt-5.4-mini`
secondary를 한 번 실행한다. Provider work와 token-matched complete/failure transition은
lease 만료 전 끝나야 한다. 다른 worker는 같은 30초 resolution window 안에서 peer
`ready` 또는 failure state를 관찰한다.

Primary와 secondary가 timeout·network·429·5xx로 모두 실패하면 exact identity를
`cooldown_failed`로 전환한다. 1·2·3차 failure cooldown은 각각 5분·15분·60분이고 provider
`Retry-After`가 더 길면 그 값을 사용한다. Schema·auth·configuration·DB invariant 실패는
`terminal_failed`다. 두 상태 모두 remount·polling·cooldown timer·다른 route나 instance의
background 실행을 막는다. Cooldown 뒤 사용자가 `분석 다시 시도`를 명시적으로 실행할
때만 generation epoch와 lease CAS로 owner 하나가 새 실행을 연다.

Caller navigation abort처럼 provider failure가 아닌 미완료 claim만 caller signal과 분리된
bounded cleanup으로 release한다. Exact token transition이 확인되지 않으면 성공 partial로
낮추지 않는다.

같은 process의 exact identity 요청은 subscriber-aware promise를 공유한다. 한 caller abort는
그 subscriber만 제거하고, 마지막 subscriber가 사라질 때만 shared work를 abort한다. 이때도
독립 cleanup은 유지한다.

Current/rollback version 보존, 오래된 ready row cleanup, capacity·fleet verdict는
`docs/operational-readiness.md`가 소유한다.

## Degrade Order

1. Card hydration 실패 → lightweight cards 보존 후 terminal ready.
2. Term discovery 실패 → 검색 결과 유지, 해당 execution task error/empty settlement.
3. Spelling correction 실패 → 제안 UI 없음.
4. Inline analysis primary transient failure → secondary 한 번.
5. Secondary도 실패 → 검색 결과를 보존하고 cooldown/terminal 안내와 명시적 retry만 표시.
6. Route/execution 전환 → stale work abort·폐기. Durable failure fence가 있으면 새
   execution도 자동 provider 호출을 시작하지 않는다.

## Update Rule

Background queue 순서, execution freshness, hydration merge, AI readiness, term/spelling
trigger, inline-analysis batching·cache identity·lease·retry가 바뀌면 이 문서를 갱신한다.
