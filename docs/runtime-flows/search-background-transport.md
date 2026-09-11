# Search Background Transport

검색 결과가 공개된 뒤 실행되는 card hydration, 연구 용어 추출, 맞춤법 교정의
HTTP 계약을 소유한다. 사용자 화면의 `SearchMetadata`는 client view model로 남지만,
background route의 command나 response transport로는 사용하지 않는다.

## Contract Architecture Impact Review

2026-08-05 — issue #584 search background route별 command projection 전환.

Contract delta: 세 search background endpoint는 route별 `schemaVersion: 1` command를
받고 같은 snapshot target을 식별하는 route별 delta만 반환한다. 신규 client는 full
`SearchMetadata`를 송수신하지 않는다. 배포 호환을 위해 기존 full-metadata request와
response는 한 production release 동안 legacy reader 경로에서만 유지한다.
Verdict: reshape
Affected axes and current owners: Domain and data shape; Runtime, external, or AI boundary;
Resource and capacity; Compatibility and retirement; Cross-surface invariant ownership —
`app/domain/search-background-transport.ts`가 wire shape와 projection을, 세 API route가
legacy/new dispatch를, background client runner가 target freshness와 delta merge를,
`app/server/operational/route-ingress-policy.json`이 byte ceiling을 소유한다.
Decision: enrichment는 canonical query와 전체 committed paper id 순서, hydration·repair
state, library-only id를 command로 보내고 paper detail delta만 받는다. spelling correction은 query만 보내고 correction delta만
받는다. term discovery는 전체 ordered paper id target과 기존 prompt 상한 안의
title/abstract projection을 분리하고, 필요한 query-clause/graph evidence만 보내 term
delta만 받는다. semantic profile은 command가 아니라 server의 exact-input shared cache가
보강한다. 모든 응답은 command가 만든 canonical target을 되돌려 client가
현재 execution/view/owner와 다시 대조한다. 사용자-visible result membership/order와
card data는 자르거나 대체하지 않는다.
Rejected alternative: route 이름만 나누고 full `SearchMetadata`를 공통 DTO 내부에
유지하는 방식, response에서 전체 snapshot을 되돌리는 방식, transport 크기를 맞추려고
visible paper pool을 자르는 방식은 거부한다. 새로운 term-discovery 표본 cap도 만들지
않고 기존 prompt 상한만 사용한다.
Evidence and structural defense: `app/api/search/enrichment/__tests__/route.test.ts`,
`app/api/search/spelling-correction/__tests__/route.test.ts`,
`app/api/search/term-discovery/__tests__/route.test.ts`,
`app/domain/__tests__/search-background-transport.test.ts`,
`app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx`가 new/legacy
dispatch, route별 delta, stale target 거부, UTF-8 byte/cardinality 경계를 잠근다.
Human decision required: no

## Concept Shift Architecture Review

- `SearchMetadata` client route view model, 현재 화면의 사용자-visible paper pool,
  route URL·인증 순서·retry/degraded 의미는 `preserve`다.
- legacy `{ query, metadata }` request와 full-metadata response는 배포 직후 한 production
  release 동안 `migrate-read-only`다. 신규 client는 이 shape를 쓰지 않으며 #584의
  retirement 단계에서 reader와 관련 fixture를 `remove`한다.
- route별 `schemaVersion: 1` command와 delta response는 선택한 active replacement다.
  dual-write state나 별도 snapshot 저장소는 만들지 않는다.

## Propagation Map

Invariant: 새 client는 full `SearchMetadata`를 background HTTP body나 response에서
송수신하지 않는다. 각 command는 실행에 필요한 최소 projection만 운반하고, client는
response target이 queued command와 현재 route execution에 모두 맞을 때 소유 delta만
병합한다. 전체 result membership/order와 사용자-visible card data는 보존한다.

Owning edits: `app/domain/search-background-transport.ts`, enrichment/spelling/term API
routes, `search-enrichment-access.ts`, `search-hydration.ts`, projected term extraction seam,
`inline-analysis-access.ts`의 lossy prompt용 exact cache identity hydration seam과 테스트,
background search/term runners, `use-search-spelling-correction-request.ts`, legacy
`search-metadata-ingress.ts`와 fixture, route ingress policy,
`app/server/operational/api-response-contract.json`, low-cardinality transport observation과
이 runtime-flow 문서.

Inspect-only downstream impact: `SearchMetadata` schema와 route store, search ranking,
graph hydration, inline-analysis generation owner, route AI comment, gap report input,
product analytics event 계약. 이들은 transport owner가 아니며 의미나 저장 shape를
바꾸지 않는다. Shared inline-analysis cache repository와 capability policy도 그대로다.

Compatibility: 새 command client와 legacy full-metadata client를 request discriminant로
구분한다. legacy request에는 기존 response shape를, v1 command에는 v1 delta를 반환한다.
legacy branch는 route와 `transportVersion: "legacy" | "v1"`만 기록하는 저카디널리티
structured operational observation으로 신규 producer가 없음을 한 release 확인한 뒤
제거한다. query, paper id, payload 내용은 기록하지 않는다.

Split cleanup: agent skill, Mission Control, CI/checklist 같은 엔지니어링 process 개편은
별도 process session이 소유한다. production cohort와 legacy retirement 시점 확인은
#584 후속 release closeout에서 닫는다.

Budget: 2026-08-05 세 번째 Human checkpoint 승인에 따라 최대 40개 authored files, 최대
2,450 authored changed lines. 기존 30개/1,800줄 예측은 route별 음성 fixture를,
34개/2,200줄 예측은 exact-content review에서 확인한 delta authority 축소, maximal UTF-8
fixture, observation placement와 기존 Q4·condition-ownership fixture 전파를 포함하지
못했다. 38개/2,400줄 상한은 세 번째 review에서 드러난 server canonical fingerprint
owner와 browser mirror parity binding을 포함하지 못했다. generated skill copy와 lockfile은
별도다. 이 상한을 넘기거나 사용자-visible 의미가 달라지면 Human checkpoint를 다시 연다.

## Version 1 Commands

- 공통 target: canonical query와 전체 committed ordered paper ids다. Spelling은 paper
  snapshot에 의존하지 않으므로 query-only target이다. `executionId`, `documentId`, owner는
  client runtime identity로 남아 response target과 별도로 다시 검증한다.
- enrichment: 공통 target, library-only id와 hydration state. response delta는 target id의
  unique subset인 hydration-owned paper detail과 terminal hydration state만 소유한다.
`title`, `year`, `citationCount`, `url`, review state는 delta에서 거부하고 현재 committed
basis를 보존한다. `inlineAnalysis`도 delta에서 제외하며 abstract가 달라지면 committed
analysis를 제거해 다른 canonical input에 결합하지 않는다. provider가 반환하지 않은
paper는 client의 기존 card로 보존하고 80편 membership/order를 유지한다.
- spelling correction: canonical query만 운반한다. response delta는 correction 또는
  정직한 no-answer만 소유하며 기존 correction recovery는 legacy branch만 담당한다.
- term discovery: 공통 target과 기존 prompt 상한만큼의 paper prompt projection,
  query clauses, 해당 paper에 필요한 graph support. response delta는 candidates와 discovery
  settlement만 소유한다. target의 13–80번째 id도 freshness에는 참여하지만 prompt에는
  들어가지 않는다. Command는 inline analysis와 semantic profile을 운반하지 않는다.
  대신 prompt 절단 전에 현재 full title/abstract/year에서 계산한 SHA-256 fingerprint를
  opaque cache identity carrier로 운반한다. 서버는 이 값을 profile authority로 신뢰하지
  않고 `paperId + version + fingerprint`가 이미 존재하는 canonical inline-analysis cache
  record와 exact match할 때만 abort-aware하게 조회해 current profile을 LLM prompt
  projection에 보강한다. analyzable abstract에는 fingerprint를 반드시 요구하고 그 밖에는
  거부해 lossy prompt에서 identity를 다시 계산하는 fallback을 막는다. Server canonical
  hash는 cache-contract guard가 소유하고 browser mirror는 정규화·Unicode·year·긴 입력
  parity fixture로 같은 digest를 강제한다.

Command builder는 사용자-visible 배열을 임의로 잘라 transport 오류를 숨기지 않는다.
enrichment와 term target은 `SEARCH_RESULT_POOL_PAPER_LIMIT` 전체를 허용하고 그 다음 한
편을 거부한다. term discovery의 prompt paper projection만 기존
`TERM_CANDIDATE_LLM_PAPER_LIMIT`와 title/abstract/semantic prompt field 상한을 그대로
사용한다. query와 query clause는 기존 canonical producer 상한을 공유한다.

각 command string과 identity collection은 named constant로 상한을 갖고 builder와
schema가 같은 값을 읽는다. Enrichment response의 사용자-visible paper detail은 byte
예산을 맞추려고 자르지 않는다. UTF-16 code unit당 UTF-8 byte가 가장 큰 3-byte BMP 한글로
서로 다른 paper id 80개, query, prompt field, clause/expansion의 모든 허용 cardinality를 채운 maximal
producer fixture를 `TextEncoder`로 직렬화해 route byte ceiling 이하임을 검증한다. enrichment
80/81, paper id 512/513, term prompt와 graph evidence 12/13, prompt field 300/301,
clause/expansion 4/5, query 500/501, request body max/max+1을 각각 음성 경계로 둔다.

## Dual-read Retirement

P1이 production에 배포된 release를 관측 시작점으로 삼는다. 그 release 동안 route는
`schemaVersion: 1` command와 기존
`{ query, metadata }` body를 모두 읽는다. 새 client producer는 v1만 쓴다. legacy
request에는 기존 full-metadata response를 반환해 이미 배포된 client의 response reader를
깨뜨리지 않는다. operational-readiness owner가 다음 production release closeout에서
명시한 deployed release window 전체에 대해 export/log coverage가 손실 없이 유지됐음을
확인하고, 세 route 각각 `v1 / total` traffic이 0보다 크면서 legacy observation이 0건일
때만 legacy schema, full response branch, full-metadata ingress fixture를 함께 제거한다.
현재 외부 cohort가 없으므로 route별 positive v1 traffic이 생기기 전에는 retirement를
인증할 수 없다. coverage가 불완전하거나 v1 traffic이 0이거나 legacy 관측이 있으면
제거하지 않는다. 증거 sink/export와 sampling 판정은
`docs/operational-readiness.md`의 `search-background-transport-retirement` boundary가
소유한다.

2026-08-06에 #587의 첫 production release window를 확인했지만 retirement 증거는
충분하지 않았다. 해당 window의 runtime request-log query는 0 rows였고 독립 request
count와 durable sink coverage를 확인할 수 없었다. 0 rows를 legacy 0건으로
간주하지 않으며 reader는 `migrate-read-only`로 유지한다. exact revision, window와
조회 결과는 `docs/operational-readiness-records.md`가 기록한다.

## Update Rule

command field, response delta, target identity, byte/cardinality budget, legacy retirement
상태가 바뀌면 이 문서와 세 route의 boundary test를 같은 변경에서 갱신한다.
