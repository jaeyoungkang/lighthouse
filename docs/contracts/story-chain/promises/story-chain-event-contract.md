---
id: promise:story-chain-event-contract
slug: story-chain-event-contract
title: Story Chain 변화와 이벤트 계약이 함께 갱신된다
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
aspects:
  - aspect:admin-access-control
  - aspect:common-page-footer
acceptanceChecks:
  - acceptance-check:story-chain-event-contract-ref-validity
  - acceptance-check:story-chain-event-contract-router-boundary
  - acceptance-check:story-chain-event-contract-trigger-timing
  - acceptance-check:story-chain-event-contract-payload-policy
  - acceptance-check:story-chain-event-contract-admin-event-catalog
  - acceptance-check:story-chain-event-contract-external-identity-continuity
  - acceptance-check:story-chain-event-contract-impact-review
  - acceptance-check:story-chain-event-contract-emission-boundary
  - acceptance-check:story-chain-event-contract-measurement-purpose
  - acceptance-check:story-chain-event-contract-required-event-coverage
analyticsExempt: event contract health is observed by mc:validate-events and mc:event-impact, not by a self-referential analytics event
verdict: met
---

## Contract Architecture Impact Review

Contract delta: 신규·개편 product event의 canonical name, Amplitude event type, analytics subject·property key·enum taxonomy token에 하나의 소문자 snake_case 규칙을 적용하고, 하나의 행동 event가 여러 현재 Promise를 중복 발행 없이 참조할 수 있게 한다.
Verdict: constrain-existing
Affected axes and current owners: Observability and audit; Compatibility and retirement — `docs/analytics/events.yaml`; `app/server/services/analytics/event-contract-validation.ts`; `app/server/services/analytics/runtime-emitted-events.ts`
Decision: 기존 canonical router와 sink fan-out 경계를 유지한다. 활성 product event는 `<object>_<past_tense_action>`을 쓰고 Amplitude sink name은 canonical name과 같아야 한다. analytics subject, property schema, enum taxonomy token은 snake_case를 쓴다. 주 owner는 `promiseRef`, 같은 행동을 공유하지만 `requiredEvents` 소유권을 갖지 않는 현재 계약은 `relatedPromiseRefs`가 참조한다. `search_submitted`의 주 owner는 accepted query transition을 직접 소유하는 `promise:search-query-route-transition`이고, 결과 창과 route entry Promise는 downstream coverage로만 연결한다.
Rejected alternative: canonical dotted name, Title Case Amplitude name, camelCase property를 함께 유지하면 같은 행동에 세 가지 이름이 생긴다. 기존 `product.*` 전체를 같은 변경에서 이관하면 릴리스된 호환 계약의 범위를 확인할 수 없다.
Evidence and structural defense: `docs/analytics/README.md`; `app/server/services/analytics/event-contract-validation.ts`; `npm run mc:validate-events`
Human decision required: no

### 2026-08-06 legacy reachability와 local provenance

Contract delta: production 호출부가 없는 세 legacy product event를 retire하고, local JSONL record에 환경·빌드 revision·실행 출처를 구분하는 bounded provenance를 추가한다.
Verdict: constrain-existing
Affected axes and current owners: Observability and audit; Compatibility and retirement — `docs/analytics/events.yaml`; `app/lib/track.ts`; `app/server/repository/analytics-events.ts`
Decision: `product.inline_analysis.queued`, `product.gap_report_margin.clicked`, `product.gap_report_prepared_reaction.clicked`의 active declaration·writer·dead helper를 제거한다. 같은 Promise의 현재 사용자 행동은 `search_result_inspected`, `product.gap_view_margin.viewed`, `product.gap_view_prepared_reaction.viewed`가 계속 관측한다. 과거 vendor/local row는 migrate-read-only로 두고 새 event와 합산하지 않는다. Local provenance는 canonical event나 Amplitude payload를 바꾸지 않고 local record에만 allowlist된 환경·revision·`runtime | manual | test`를 덧붙인다.
Rejected alternative: 호출되지 않는 helper를 production trigger로 간주하거나 자동 queue를 사용자 행동으로 wire하면 collection reachability와 Journey 의미를 왜곡한다. 기존 JSONL 전체를 rewrite하거나 process environment를 그대로 저장하면 provenance를 추정하고 credential 경계를 넓힌다.
Evidence and structural defense: `app/server/repository/__tests__/analytics-events.test.ts`; LSP production reference inventory; `npm run mc:validate-events`; `npm run quality:contract`
Human decision required: no — #570–#577 실행 지시 범위 안에서 기존 wire/retire 규칙과 local-store owner를 유지한다. 외부 vendor read capability는 이 판정에 포함하지 않는다.

## Concept Shift Architecture Review — 2026-08-06

| Shape | Verdict | 처리 |
| --- | --- | --- |
| 세 legacy event의 active contract·writer·helper | remove | production reference가 없고 현재 Promise coverage owner가 따로 있으므로 제거한다. |
| Historical local·Amplitude row | migrate-read-only | 과거 audit에는 남기되 현재 event와 합산하거나 이름을 변환하지 않는다. |
| Canonical event와 Amplitude payload shape | preserve | provenance는 local JSONL 저장 record에만 둔다. |
| `localProvenance` 없는 기존 JSONL row | migrate-read-only | 사후 추정하지 않고 legacy/unknown으로 분류한다. |

## Propagation Map

Invariant: 신규·개편 event는 canonical contract부터 Amplitude 전송까지 같은 snake_case event와 property identity를 사용한다.
Owning contract bundle: `promise:story-chain-event-contract`, `promise:search-result-library-add`, `promise:inline-analysis-auto-run`, `promise:delegate-deep-read-to-moonlight`, `promise:citation-lineage`, `promise:similar-papers-discovery`, `promise:search-url-restores-search`, `aspect:progressive-content-spatial-stability`와 각 covering Evidence Ledger 및 `search-result-window.ledger.yaml`
Runtime/engineering owner: `docs/analytics/README.md`; `docs/analytics/events.yaml`; analytics router와 emitter
Required code/test paths: `app/server/services/analytics/event-contract-validation.ts`; `app/server/services/analytics/runtime-emitted-events.ts`; `app/lib/track.ts`; `app/components/research-route-renderers/search-view.analytics.ts`; `app/components/research-route-renderers/search-result-item.tsx`; 관련 analytics tests
Inspected, not edited: 비검색 `product.*` event의 의미와 Amplitude historical row·saved chart history
Compatibility-only shapes: `product.search_language_aware_library_supplement.viewed`와 `product.citation_lineage.failed`는 저장 snapshot·failure trace 호환 때문에 writer와 계약을 preserve한다. `product.search.submitted`, `product.research_route_search.submitted`, `product.search_query_transition.submitted`는 `search_submitted`로, `product.search_results.viewed`, `product.search_results_budget.viewed`는 `search_results_viewed`로, `product.search_result_library_add.clicked`, `product.search_result_library_remove.clicked`, `product.search_result_detail.clicked`, `product.citation_lineage.clicked`, `product.pdf_open.clicked`, `product.similar_papers_discovery.clicked`는 각각 대응하는 새 outcome/action event로 cutover하고 active writer를 remove한다. `product.citation_lineage.viewed`는 새 `citation_lineage_opened`의 accepted-action 의미로 대체하며 기존 vendor row는 historical read-only다. 릴리스 전 #577 dotted 이름 `search.submitted`, `search_results.viewed`, `search_result.inspected`, `paper.pdf_opened`, `citation_lineage.opened`, `similar_papers.opened`, `paper.saved`, `paper.unsaved`와 camelCase analytics payload는 remove한다. 2026-08-06에는 호출되지 않는 `product.inline_analysis.queued`, `product.gap_report_margin.clicked`, `product.gap_report_prepared_reaction.clicked` active shape를 remove하고 historical row만 migrate-read-only로 남긴다. 그 밖의 exact legacy allowlist event는 preserve한다.
Split cleanup: repo-local skill, Mission Control, review checklist, CI 운영 규칙의 일반화는 별도 process workstream에서 수행한다.
Budget: 70..90 authored files; 5300..5700 authored changed lines. 2026-08-04 Human의 기능·운영 프로세스 범위 확대 승인을 scope checkpoint로 사용하되 process edit은 별도 workstream으로 분리한다.

# Story Chain 변화와 이벤트 계약이 함께 갱신된다

## Promise

운영자는 이벤트 taxonomy가 Story Chain과 따로 자라지 않는지 확인할 수 있다.
`docs/analytics/events.yaml`은 각 canonical event가 어떤 Promise, Aspect,
Acceptance Check, scenario를 관측하는지 선언한다. Validator는 이 ref들이 올바른
Story Chain ref 형식인지, 그리고 현재 Story Chain에 존재하는지 확인한다.
이벤트는 로그 목록이 아니라 제품 약속이 현실 사용에서 어떻게 관측되는지
판단하기 위한 계약이다. 핵심 제품 Promise는 frontmatter의 `requiredEvents`로
필수 관측 event name을 선언할 수 있고, 해당 event가 없거나 그 Promise를
`storyRefs.promiseRef`로 가리키지 않으면 계약 실패로 본다. Product event의
payload property는 allowlist에 들어가는 것만으로 충분하지 않다. 각 event는
`measurement.purpose`, `measurement.decisionUse`, required/optional property별
`measurement.propertyPurposes`를 함께 가져야 한다.
검색 여정 관측은 사용자가 겪은 흐름, 제품 outcome, 시스템 delivery trace를
서로 다른 의미로 다룬다. 검색 실행, 결과 노출, 논문 탐색은 같은
`journey_context_id`를 유지한다. 검색 조건이 바뀌면 새 `search_context_id`를 만들고
이전 검색은 `parent_search_context_id`로 연결한다. 같은 탭의 인용 관계와 비슷한 논문
branch는 출발 context를 이어받는다. 직접 URL과 새 탭 복원은 destination 문서 identity로
로컬 fallback context를 만들며 새 검색 제출로 세지 않는다.
Runtime router는 앱과 CLI가 vendor SDK를
직접 의미 계층으로 쓰지 않도록 내부 canonical event와 외부 sink payload를
분리한다. 외부 sink로 보낼 때 router는 식별된 사용자에게는 이메일을 안정된
user_id로 사용하고, 클라이언트 SDK가 보유한 device_id를 함께 forwarding한다.
익명 구간 이벤트는 user_id를 비우고 device_id를 발송해 vendor가
anonymous→identified 자동 머지를 수행할 수 있게 한다. 브라우저 세션에서
발생한 canonical event는 같은 SDK session_id도 전달해 Amplitude Session
Replay가 같은 device/session 범위의 replay와 이벤트를 연결할 수 있게 한다.

이 약속은 이벤트를 verdict source로 만들지 않는다. Reality signal은 이후 별도
검토 흐름으로 승격할 수 있지만, 현재 구현은 계약 검증과 안전한 event write
경계까지만 닫는다.

이 Promise는 최종 사용자에게 직접 노출되는 제품 약속이 아니라, admin lane의
governance 운영 약속이다. 운영자는 `/admin/analytics`에서 현재 `events.yaml`
로 선언된 canonical event 계약 카탈로그를 본다. 각 event의 owner/version,
trigger source/phase/timing, Story Chain refs, subject/properties allowlist,
privacy 및 vendor sink policy(현재 Amplitude)가 함께 표시된다.

## Intent Checks

명시적 Intent Check는 없다. 이 Promise는 event contract, router, privacy
filter를 deterministic evidence로 닫는다.

## Acceptance Checks

### acceptance-check:story-chain-event-contract-ref-validity

- description: `docs/analytics/events.yaml`의 event name은 중복되지 않는다. 신규·개편 product event의 canonical name은 `<object>_<past_tense_action>` 소문자 snake_case를 쓰고 Amplitude sink name과 같아야 한다. Analytics subject, 공유 property schema key, enum taxonomy token도 소문자 snake_case를 쓴다. exact legacy allowlist에 든 기존 `product.*` event만 dotted name을 유지할 수 있다. 각 event의 Story Chain refs는 canonical prefix 형식을 지키며 현재 Story Chain Experience, Moment, Promise, related Promise, Aspect, Acceptance Check, scenario catalog에 존재한다. Acceptance Check ref가 있으면 같은 event의 주 Promise ref에 속해야 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:story-chain-event-contract-router-boundary

- description: 앱과 CLI는 canonical event name과 runtime payload를 발행하고, router가 `events.yaml`에서 version, Story Chain refs, privacy, vendor sink mapping(현재 Amplitude)을 채운다. 호출부는 vendor event name이나 Story Chain ref를 직접 조립하지 않는다. Router는 `allowExternalSinks: true`인 이벤트만 외부 vendor sink로 fan-out하고, 각 vendor sink는 `events.yaml`의 `sinks.<vendor>` 매핑이 선언된 이벤트만 받는다. Product event property는 공유 semantic schema에 선언되어야 한다. Router는 실제 payload의 type, enum, 숫자 범위, emission identity key 존재와 subject/property identity parity를 schema와 대조한다. 기본 local JSONL store는 로컬 개발에서는 `.local`에 쓰지만, serverless runtime에서는 배포 번들 경로가 아니라 쓰기 가능한 temp directory를 사용한다. 새 local row는 canonical 필드를 유지한 채 allowlist된 environment, build revision, `runtime | manual | test` 실행 출처를 `localProvenance`에 기록하고, 기존 provenance 없는 row는 rewrite 없이 legacy/unknown으로 취급한다. Local provenance는 canonical event와 외부 sink payload에 포함하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 6

### acceptance-check:story-chain-event-contract-trigger-timing

- description: 각 canonical event는 `trigger.source`, `trigger.phase`, `trigger.timing`을 선언한다. Trigger 시점은 버튼 클릭 자체가 아니라 Story Chain에서 관측하려는 의미가 확정되는 최소 시점이다. 사용자 요청은 `requested`, artifact가 실제로 생긴 뒤는 `committed`, 실패 응답은 `failed`로 구분된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:story-chain-event-contract-payload-policy

- description: 내부 canonical store와 외부 sink payload는 event별 allowlist 기반으로 만든다. 공유 property schema는 각 property의 설명, type, 예시, 민감도, context group, lifetime, source owner를 선언한다. 제한된 값은 enum이나 숫자 범위도 선언한다. 선언되지 않았거나 schema와 맞지 않는 property는 validation failure로 다룬다. 검색 여정 event에는 raw query와 query hash를 금지하고, 안정된 `paper_id`로 대체할 수 있는 고카디널리티 논문 제목도 싣지 않는다. 호환 event에 남아 있는 unkeyed 32-bit FNV-1a query/term hash는 같은 event 안의 대략적인 반복 그룹화에만 쓰며, 익명화·사용자 identity·민감정보 보호·cross-event join 경계로 간주하지 않는다. 기존 알고리즘을 바꿀 때는 historical row를 재해석하지 않고 새 version 또는 property로 cutover한다. PDF 원문과 AI 응답 전문도 수집하지 않는다. 원문 수집이나 새 외부 export client는 별도 Human 승인과 privacy 계약 없이는 추가하지 않는다. `forbidden` 목록은 `required`/`optional`과 충돌하지 않아야 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:story-chain-event-contract-admin-event-catalog

- description: `/admin/analytics`는 internal admin gate를 통과한 운영자에게 현재 `docs/analytics/events.yaml`로 선언된 canonical event 계약 카탈로그를 보여 준다. 각 row는 event name, owner, version, actor/surface, trigger source/phase/timing, emission boundary/cardinality/emitter, Story Chain refs, subject/properties allowlist(required/optional/forbidden), privacy level과 `allowExternalSinks`, Amplitude sink mapping을 표시한다. 런타임 발생 로그는 이 surface에 표시하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:story-chain-event-contract-external-identity-continuity

- description: research shell은 인증된 email로 Amplitude identity를 초기화하고 식별한다. 로그아웃이 성공하면 로드된 SDK identity를 reset한다. 외부 vendor sink로 fan-out하는 canonical event는 식별된 사용자에 대해 email을 user_id로, 클라이언트 SDK가 발행한 device_id와 session_id를 함께 forwarding한다. 익명 구간 이벤트는 user_id 없이 device_id와 session_id를 발송한다. 공개 `/api/analytics-events` route는 user actor payload만 받고 caller-supplied `actor.id`는 신뢰하지 않는다. 인증된 세션이면 서버가 user email을 actor id로 채우고, 인증되지 않은 요청이면 actor id를 제거한다. 호출부는 pseudonymous browser uuid를 user_id로 사용하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:story-chain-event-contract-impact-review

- description: 사용자-facing Promise 또는 `// @promise` surface가 바뀌면 `mc:event-impact`가 변경된 Promise와 canonical event coverage를 출력한다. 변경된 Promise에 연결된 canonical event가 없고 같은 변경에 `docs/analytics/events.yaml` 갱신도 없으면 gate가 실패한다. 운영자는 `npm run mc:event-impact -- --sync`로 누락 event 초안 추가, 삭제된 Promise event 제거, 기존 event의 Story Chain parent ref 갱신, coverage inventory 갱신을 한 번에 수행한다. `docs/analytics/event-coverage.generated.md`만 stale하면 `npm run mc:event-impact -- --update`로 coverage inventory만 갱신한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:story-chain-event-contract-emission-boundary

- description: 각 canonical event는 `emission.boundary`, `emission.cardinality`, `emission.identityKeys`, `emission.emitter`를 선언한다. 검색 실행은 accepted client transition에서 새 `search_context_id`와 함께 한 번 발행한다. 결과 노출은 destination view의 첫 usable window에서 같은 context로 한 번 발행한다. 재검색은 journey root를 유지하고 직전 search context를 parent로 연결한다. 같은 탭의 인용 관계와 비슷한 논문 branch는 출발 search context를 이어받는다. 직접 URL과 새 탭 복원은 destination 문서 identity로 fallback context를 만들며 새 검색 제출을 발행하지 않는다. 저장·해제는 서버 mutation 성공 뒤에만 발행한다. Card inspection은 같은 search context·paper·rank identity에서 닫았다 다시 열어도 한 번만 발행하고 PDF는 primary click과 middle-click handoff를 모두 센다. 활성 검색 여정의 retired `product.*` writer는 cutover와 함께 제거하며 새 event와 이중 발행하지 않는다. Product event의 production trigger가 없으면 product lane exempt로 숨기지 않고 실제 boundary에 wire하거나 active declaration·writer를 retire하며, 현재 Promise coverage owner와 historical compatibility를 함께 기록한다. React render/update/effect 재실행은 발행 근거가 아니다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 4

### acceptance-check:story-chain-event-contract-measurement-purpose

- description: Product event는 `measurement.purpose`와 `measurement.decisionUse`를 선언하고, `properties.required`와 `properties.optional`의 모든 property에 대해 `measurement.propertyPurposes`를 가진다. 목적 없는 property 수집은 계약 실패다. 검색 여정 event는 Experience Journey와 Product Outcome을 관측한다. provider latency, 실패 원인, delivery 상태는 System Delivery Trace로 분리하며 사용자 journey outcome으로 세지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:story-chain-event-contract-required-event-coverage

- description: Promise frontmatter의 `requiredEvents`에 선언된 event name은 `docs/analytics/events.yaml`에 존재해야 하며, 해당 event는 같은 Promise를 `storyRefs.promiseRef`로 가리켜야 한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1
