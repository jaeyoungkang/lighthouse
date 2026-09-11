
## Reviews — Story Chain Event Contract

#### 2026-08-10 — first canonical event SDK identity ordering

```yaml
date: 2026-08-10
acs:
  - acceptance-check:story-chain-event-contract-external-identity-continuity
acReviewedRevision:
  - 4
fixtureRef: app/lib/analytics/__tests__/client.test.ts + app/lib/analytics/__tests__/amplitude-unified-client.test.ts
runCommitSha: 60a9d7781ded+worktree
observedOutput: Amplitude 설정이 있으면 canonical client bridge는 SDK 초기화가 끝난 뒤 첫 transport를 실행하고 같은 요청에 device_id와 session_id를 포함한다. 설정이 없거나 초기화가 실패하면 identity 없이 전송을 계속하며 제품 동작과 호출자의 fire-and-forget API를 막지 않는다.
gaps:
  - adopt: 첫 canonical event와 lazy SDK 초기화 사이의 순서 경쟁을 transport 경계에서 닫는다.
  - adopt: 설정 부재와 초기화 실패는 identity continuity를 낮추지만 canonical event 전송은 유지한다.
  - reject: 이 review는 Amplitude vendor의 실제 수신이나 Session Replay 연결 성공을 배포 후 증거로 주장하지 않는다.
verdict: met
```

#### 2026-08-06 — legacy query hash privacy boundary

```yaml
date: 2026-08-06
acs:
  - acceptance-check:story-chain-event-contract-payload-policy
acReviewedRevision:
  - 4
fixtureRef: docs/analytics/README.md + docs/analytics/events.yaml + app/lib/__tests__/track.test.ts + app/lib/__tests__/track.different-position.test.ts
runCommitSha: 1b81e45b+worktree
observedOutput: 활성 검색 여정은 raw query와 query hash를 수집하지 않는다. 호환 product.* event에 남은 queryHash, correctedQueryHash, termHash는 fnv1a32 형식의 unkeyed 32-bit FNV-1a 값이며 같은 event 안의 대략적인 반복 그룹화에만 사용한다. 충돌과 사전 대입 가능성이 있어 익명화, 사용자 identity, 민감정보 보호, cross-event join 경계로 사용하지 않는다. 테스트는 허용된 hash 형식과 raw query·corrected query·term 비전송을 함께 검증한다.
gaps:
  - adopt: legacy dashboard 호환 때문에 현재 property와 알고리즘은 유지하되 privacy 보장으로 오인하지 않는다.
  - adopt: 알고리즘 변경은 historical row 재해석 대신 새 event version 또는 property cutover로 진행한다.
  - reject: query hash를 검색 여정 funnel join이나 사용자 식별에 사용하지 않는다.
verdict: met
```

#### 2026-08-06 — unreachable legacy event retirement와 local JSONL provenance

```yaml
date: 2026-08-06
acs:
  - acceptance-check:story-chain-event-contract-router-boundary
  - acceptance-check:story-chain-event-contract-emission-boundary
acReviewedRevision:
  - 6
  - 4
fixtureRef: docs/analytics/events.yaml + app/lib/track.ts + app/lib/interaction-event.ts + app/server/services/analytics/event-contract-validation.ts + app/server/repository/analytics-events.ts + app/server/repository/__tests__/analytics-events.test.ts
runCommitSha: 5aee04d9e6d4+worktree
observedOutput: production reference가 없는 product.inline_analysis.queued, product.gap_report_margin.clicked, product.gap_report_prepared_reaction.clicked의 active contract·writer·dead helper를 제거했다. Inline-analysis 사용자 행동은 search_result_inspected, gap surface는 product.gap_view_margin.viewed와 product.gap_view_prepared_reaction.viewed가 같은 Promise를 계속 관측한다. 새 local JSONL row는 canonical event top-level을 유지하면서 allowlist된 environment, 길이·문자가 제한된 build revision, runtime/manual/test 실행 출처만 localProvenance에 기록한다. 허용되지 않는 값은 unknown/null/runtime으로 낮추고, 기존 provenance 없는 row는 rewrite하거나 사후 추정하지 않는다.
gaps:
  - adopt: 호출되지 않는 선언을 production collection evidence로 오인하지 않고 wire/retire 결정과 실제 reference inventory를 일치시킨다.
  - adopt: 테스트·수동·runtime local record와 build revision을 구분하되 canonical event와 Amplitude payload는 바꾸지 않는다.
  - reject: historical local·Amplitude row를 새 event로 rename하거나 현재 funnel에 합산하지 않는다.
  - reject: local JSONL은 실제 Amplitude receipt나 운영 사용량의 정본이 아니다.
verdict: met
```

#### 2026-08-04 — 검색 여정 이벤트 계약 재검토

```yaml
date: 2026-08-04
acs:
  - acceptance-check:story-chain-event-contract-ref-validity
  - acceptance-check:story-chain-event-contract-router-boundary
  - acceptance-check:story-chain-event-contract-payload-policy
  - acceptance-check:story-chain-event-contract-external-identity-continuity
  - acceptance-check:story-chain-event-contract-emission-boundary
  - acceptance-check:story-chain-event-contract-measurement-purpose
  - acceptance-check:story-chain-event-contract-required-event-coverage
acReviewedRevision:
  - 3
  - 5
  - 3
  - 4
  - 3
  - 2
  - 1
fixtureRef: docs/analytics/events.yaml + app/server/services/analytics/event-contract.ts + app/server/services/analytics/event-contract-validation.ts + app/lib/analytics/__tests__/event-router.test.ts + app/lib/__tests__/track.test.ts + app/components/research/__tests__/search-followup-activation.test.tsx + app/components/research-route-renderers/__tests__/search-view-content.analytics.test.tsx + app/api/analytics-events/__tests__/route.test.ts
runCommitSha: 96fa282b+worktree
observedOutput: 검색 실행부터 첫 usable 결과, 논문 inspection, PDF, 인용 관계, 비슷한 논문, 저장·해제까지 새 canonical event가 같은 journey/search context를 전달한다. 신규 canonical name과 Amplitude event type, analytics subject·property·enum taxonomy token은 같은 lowercase snake_case 규칙을 쓴다. Validator는 exact allowlist 밖 dotted product name, 다른 Amplitude name, camelCase shared schema, 비-snake enum과 runtime scanner alias·비인가 member-call 우회를 거절한다. 공유 property schema와 router는 type·enum·range·identity parity·privacy를 검증하고 raw query, query hash, 논문 제목, PDF URL, AI 원문, 인증 token을 거절한다. 인증된 research shell은 email identity를 초기화하고 공개 route는 caller actor id를 서버 identity로 정규화한다. 검색 조건 변경은 새 search context와 parent link를 만들고 같은 탭의 branch는 출발 context를 이어받는다. 직접 URL과 새 탭 복원은 destination 문서 identity로 fallback context를 만들며 새 검색 제출로 세지 않는다. 주 `promiseRef`만 `requiredEvents` 소유권을 만족하며 related Promise ref는 coverage와 provenance에만 쓰인다. 활성 검색 여정의 구형 product.* writer는 이중 발행 없이 제거되고 저장 snapshot 전용 visibility event와 citation failure trace는 보존됐다.
gaps:
  - adopt: 이벤트 의미·schema·identity·발행 경계를 하나의 검색 여정 계약으로 닫는다.
  - adopt: 신규 event와 Amplitude 전송 이름, analytics property를 하나의 snake_case 규칙으로 닫는다.
  - adopt: 내부 Amplitude 수신은 collection fitness 증거로만 사용한다.
  - reject: 이벤트 수신과 행동 횟수를 사용자 성과나 제품 효과로 간주하지 않는다. 외부 사용자 cohort가 없으므로 outcome effect는 unknown이다.
  - reject: provider latency와 실패 원인은 사용자 여정 event가 아니라 별도 System Delivery Trace가 소유한다.
verdict: met
```

#### 2026-07-07 — public analytics route does not trust client actor ids

```yaml
date: 2026-07-07
acs:
  - acceptance-check:story-chain-event-contract-external-identity-continuity
acReviewedRevision:
  - 3
fixtureRef: app/api/analytics-events/__tests__/route.test.ts + app/lib/analytics/sinks/__tests__/amplitude.test.ts
runCommitSha: worktree
observedOutput: Analytics route tests assert public browser payloads are limited to user actor events, caller-supplied actor.id is replaced with authenticated server email when a session exists, caller-supplied actor.id is stripped for anonymous requests, and non-user actor payloads are not scheduled into the trusted router. Existing Amplitude sink coverage keeps identified email user_id plus SDK device/session continuity for externally allowed events.
gaps:
  - adopt: public analytics ingress no longer treats client actor.id as trusted identity.
  - adopt: anonymous public events keep SDK device/session continuity without minting caller-chosen user_id values.
  - reject: this review does not claim route/platform rate limiting is complete; that remains tracked by the #227 operational boundary register.
verdict: met
```

#### 2026-07-03 — external sink timeout logging stays observable but concise

```yaml
date: 2026-07-03
acs:
  - acceptance-check:story-chain-event-contract-router-boundary
acReviewedRevision:
  - 3
fixtureRef: app/lib/analytics/sinks/__tests__/amplitude.test.ts + app/api/analytics-events/__tests__/route.test.ts
runCommitSha: f89ab572+worktree
observedOutput: Amplitude sink tests assert fetch AbortError timeout failures are normalized to a concise sink error message that names the event and timeout window. Analytics route tests assert sink AbortErrors are logged as `{name, message}` summaries, so the route keeps returning 204 and preserving the operational signal without dumping raw DOMException constants into the console.
gaps:
  - adopt: external sink timeout remains observable as a sink error rather than being swallowed.
  - adopt: route logging no longer passes raw DOMException arrays to console.error for expected vendor timeout failures.
  - reject: this review does not claim the Amplitude vendor received the timed-out event; it closes local failure classification and log hygiene for retry-exhausted sink delivery.
verdict: met
```

#### 2026-06-29 — runtime-emitted analytics contract closure

```yaml
date: 2026-06-29
acs:
  - acceptance-check:story-chain-event-contract-ref-validity
  - acceptance-check:story-chain-event-contract-router-boundary
  - acceptance-check:story-chain-event-contract-trigger-timing
  - acceptance-check:story-chain-event-contract-payload-policy
  - acceptance-check:story-chain-event-contract-external-identity-continuity
  - acceptance-check:story-chain-event-contract-impact-review
  - acceptance-check:story-chain-event-contract-emission-boundary
  - acceptance-check:story-chain-event-contract-measurement-purpose
  - acceptance-check:story-chain-event-contract-required-event-coverage
acReviewedRevision:
  - 1
  - 3
  - 2
  - 1
  - 2
  - 1
  - 1
  - 1
  - 1
fixtureRef: scripts/mission-control/__tests__/mc-validate-events.test.ts + app/lib/__tests__/track.test.ts + app/__tests__/lobby-onboarding.test.tsx + docs/analytics/events.yaml + docs/analytics/event-coverage.generated.md
runCommitSha: 1837cee8bf29+worktree
observedOutput: 이벤트 계약 점검에서 발견된 런타임 방출 누락(product.search_results_budget.viewed, product.pdf_open.failed)을 events.yaml에 선언하고, magic link의 vendor-only raw email 이벤트를 canonical source-only 이벤트(product.magic_link_request.submitted, product.magic_link_resend.clicked)로 교체했다. mc:validate-events는 production trackCanonicalEvent literal, trackCanonicalEventOnce helper call, legacy server canonical mapping을 스캔해 선언 없는 runtime event와 동적 direct emitter name을 실패로 처리한다. event-router.test.ts는 새 이벤트 payload를 실제 events.yaml contract로 통과시키고 raw email property reject를 단언한다. track.test.ts는 search_results_budget one-shot state transition을 잠그고, lobby-onboarding.test.tsx는 magic link request/resend properties에 raw email이 없으며 resend 성공 source가 confirm_step으로 유지됨을 단언한다. quality:commit은 mc:validate-events를 실행해 commit-time false pass를 막는다.
gaps:
  - adopt: runtime-emitted canonical event name과 events.yaml 선언 사이의 blind spot을 validator와 test로 닫고, direct emitter의 dynamic event name 우회를 차단했다.
  - adopt: pre-auth magic link 측정은 actor.id/user_id continuity에는 email을 쓰되 event properties에는 raw email을 싣지 않고, resend request success는 confirm_step source로 집계한다.
  - adopt: 새 이벤트 payload는 mock-only bridge test가 아니라 real events.yaml router validation으로도 검증한다.
  - adopt: commit-time quality path가 event contract validator를 실행한다.
  - adopt: generated analytics coverage가 새 PDF failure, search result budget, magic link events를 해당 Promise coverage로 반영한다.
  - reject: 이 review는 Amplitude Export API에서 실제 운영 이벤트가 수신됐다는 배포 후 관측을 주장하지 않는다.
verdict: met
```
