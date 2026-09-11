---
foundational: true
---

# Product Boundary

Light House stays inside a narrow product boundary.
The assistant reacts to the current visible research route payload instead of initiating
search, uses route-view structured AI comment generation instead of an
interactive agent tool surface, and leaves follow-up affordances to host-owned
research UI instead of AI-comment button surfaces.
Visible AI reactions belong to route-owned view snapshots, not to a shared
collection-wide response buffer.

## Traceability

- Source aspects: `aspect:visible-explanation-sufficiency`
- Related scenarios: `scenario:search-view-reaction-respond-format`
- Nature: foundational contract shared by multiple stories rather than a single screen flow

## Scope ownership

- `promise:search-reaction-summarizes-terrain AC3`: the agent reacts to search results instead of performing search itself.

## Contracts

- visible route-view AI comments are generated through
  `POST /api/route-ai-comments/generate/:viewId`; the retired interactive `/api/reaction`
  stream and user-message transport are outside the product boundary
- search, citation, and similar exploration views are route-owned ephemeral
  executions. The saved product artifact is `gap_reports`. Result-card PDF
  affordances hand off to Moonlight for reading.
- search / citation_lineage / graph_neighbors views own their visible AI reaction
  block in client view state. Completed gap reports persist a viewer-scoped reaction
  preference beside the shared artifact.
- knowledge-map output is scoped to the `E2` lens only
- the agent panel renders ResearchRoutePayload-owned AI reaction text while structured follow-up actions live with their host surface
- current `first_visit` / `revisit` branching is out of contract
- route-kind completeness is shared by the domain union, wire schema, view-snapshot schema,
  and the active route AI comment command/snapshot boundary

## Verification ownership

이 문서는 제품 경계를 설명하는 foundational 문서이며 실행 명령을 소유하지
않는다. route-view AI comment surface, route-kind runtime, server delegation,
Agent Panel input, autonomous search 경계는
[`route-view-ai-comment-generation-routing.ledger.yaml`](../route-view-ai-comment-generation-routing.ledger.yaml)의
구조화 실행이 검증한다. document model 경계는
[`citation-lineage.ledger.yaml`](../citation-lineage.ledger.yaml)의
`product-boundary / document-model` 실행이 검증한다.

### Sufficiency Review

See [`reviews/product-boundary.reviews.md`](../reviews/product-boundary.reviews.md).

