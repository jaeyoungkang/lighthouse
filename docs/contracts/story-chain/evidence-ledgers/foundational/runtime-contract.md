---
foundational: true
---

# Runtime Contract

Automatic route-view reaction generation uses
`POST /api/route-ai-comments/generate/:viewId` and structured JSON generation. It builds
prompt context from the supplied `viewSnapshot` before the model runs, returns
`RouteAiComment-or-null`, and never lets the model reach out for more
context. The legacy interactive reaction stream has no served route or client
transport in the current ResearchRoutePayload AI comment path.
Result-card PDF affordances hand off to Moonlight for reading, while Light House
keeps reaction output bounded to visible ResearchRoutePayload context.

## Traceability

- Source aspects: `aspect:visible-explanation-sufficiency`
- Related scenarios: `scenario:search-view-reaction-respond-format`
- Nature: foundational response-control contract that multiple stories rely on

## Scope ownership

- `promise:search-reaction-summarizes-terrain#acceptance-check:search-reaction-structured-generation-boundary`: search-complete route-view reaction generation uses the supplied view snapshot and has no search/tool path.

## Contracts

- route AI comment generation builds prompt evidence from the supplied view snapshot, bakes it into a structured JSON prompt, and returns `RouteAiComment-or-null`
- follow-up affordances are host-owned research UI; the model returns structured reaction title/body content
- Prompt context rules are runtime-owned code in `app/lib/view-snapshot.ts` and
  `app/domain/view-snapshot.ts`, not markdown loaded from Story Chain at
  runtime.

## Verification ownership

이 문서는 runtime 경계를 설명하는 foundational 문서이며 실행 명령을 소유하지
않는다. route AI comment 생성 경계와 nullable 결과는
[`route-view-ai-comment-generation-routing.ledger.yaml`](../route-view-ai-comment-generation-routing.ledger.yaml)의
구조화 실행이 검증한다. visible snapshot 경계는
[`snapshot-reaction.ledger.yaml`](../snapshot-reaction.ledger.yaml)의 구조화 실행이
검증한다.

### Sufficiency Review

See [`reviews/runtime-contract.reviews.md`](../reviews/runtime-contract.reviews.md).

