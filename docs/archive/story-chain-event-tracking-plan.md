# Story Chain Event Tracking Contract

> 상태: current operating contract
> 범위: `docs/analytics/events.yaml`, canonical analytics router, Mission Control event gates

## Purpose

Light House 이벤트는 수집 목록이 아니다. 이벤트는 Story Chain Promise가 현실
사용에서 어떤 신호로 관측되는지 선언하는 하위 계약이다. 제품 판단은 Promise와
Evidence Ledger가 닫고, 이벤트는 그 판단을 보조하는 관측 신호를 남긴다.

외부 분석 도구는 의미 계층이 아니다. 앱은 canonical event name과 runtime
payload만 발행한다. Router가 `events.yaml`에서 version, Story Chain refs,
privacy, sink mapping, measurement 계약을 읽어 내부 저장과 외부 sink fan-out을
처리한다.

## Story Chain Relationship

각 event는 `storyRefs`로 관측하려는 Experience, Moment, Promise, Aspect,
Acceptance Check, scenario를 선언한다. Validator는 ref prefix와 존재 여부를
확인하고, Acceptance Check가 event의 Promise에 속하는지도 확인한다.

핵심 제품 Promise는 frontmatter에 `requiredEvents`를 선언할 수 있다.

```yaml
requiredEvents:
  - product.pdf_open.clicked
  - product.search_result_detail.clicked
```

`requiredEvents`에 있는 event name이 `events.yaml`에 없거나, 해당 event가 같은
Promise를 `storyRefs.promiseRef`로 가리키지 않으면 `mc:validate-events`가
실패한다. "이 Promise는 반드시 관측되어야 하는가"는 Promise 의미에 가깝고,
event 파일은 그 event가 어떻게 발행되고 어떤 payload를 허용하는지 정의한다.

## Measurement Contract

Product event는 다음을 가져야 한다.

- `measurement.purpose`: 이 event로 답하려는 제품 질문
- `measurement.decisionUse`: 이 신호를 제품 판단에 어떻게 쓸지
- `measurement.propertyPurposes`: `properties.required`와 `properties.optional`
  각 property의 수집 이유

Property는 allowlist에 들어가는 것만으로 충분하지 않다. 목적 없는 property
수집은 계약 실패다. Raw query, PDF 원문, AI 응답 전문은 기본 payload에 넣지
않는다. 필요하면 목적, 보존 정책, 외부 sink 차단 여부를 명시한 뒤 별도 계약으로
다룬다.

검색결과 카드 클릭 분석은 paper/card/rank/context를 핵심 단위로 본다.
`ownerPrincipalId`는 새 카드 클릭 분석 event의 required property나 identity key로
쓰지 않는다.

## Canonical Router Flow

```text
client/server call site
  -> trackCanonicalEvent(name, runtime payload)
  -> router loads docs/analytics/events.yaml
  -> validate actor, subject, required/optional properties
  -> compose canonical event with Story Chain refs, trigger, privacy
  -> write internal canonical event store
  -> privacy-filtered external sink fan-out when allowed
```

Legacy `/api/events` has been retired as a public telemetry write path. Core
product events pass through the canonical router, either directly or through
the centralized bridge in `app/lib/track.ts`.

## Current Card Exploration Events

`product.search_result_detail.clicked` fires when a result card's title-owned
inspection area is opened. It records paper id, title, result rank/bucket, result set
size, visible card count, PDF availability, year, citation/reference/author
counts, and analysis source. Optional query metadata uses `queryHash`, never raw
query text.

`product.pdf_open.clicked` covers result-card PDF-open affordances from the
PDF button. `openTarget` records whether the action currently
hands off to Moonlight or another external reading target. It does not
include raw URL or PDF URL values. The event records card position and
paper/card metadata so operators can judge which results lead from Light House
exploration into reading intent.

## Admin Surface

`/admin/analytics` renders the contract catalog from `events.yaml`. It shows event
identity, trigger timing, emission boundary, Story Chain refs, measurement
purpose, property purpose coverage, payload allowlist, required-event status,
privacy, and sink policy. It does not show runtime occurrence logs.

## Validation

Run the narrow event gates after analytics contract changes:

```bash
npm run mc:validate-events
npm run mc:event-impact
```

Run Story Chain gates when Promise, Acceptance Check, Evidence Ledger, or
required event declarations change:

```bash
npm run mc:validate-story-chain
npm run evidence-ledger:dry
```

`mc:validate-events` fails when:

- event names are duplicated;
- Story Chain refs are malformed, missing, or cross-linked to the wrong Promise;
- required/optional/forbidden property lists conflict;
- product events omit measurement purpose, decision use, or property purposes;
- Promise `requiredEvents` are missing from `events.yaml` or point at another
  Promise;
- emission identity keys do not resolve to allowed subject/property paths or
  registered identity fields;
- restricted events allow external sinks.
