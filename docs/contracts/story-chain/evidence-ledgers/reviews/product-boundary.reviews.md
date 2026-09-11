# Product Boundary — Sufficiency Reviews

## Reviews

### Sufficiency Review

#### 2026-07-11 — route-kind runtime boundary simplification

```yaml
date: 2026-07-11
acs:
  - acceptance-check:reaction-respond-format
acReviewedRevision:
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/product-boundary.ledger.md; scripts/evidence-ledger/helpers/contract-check.ts; app/domain/research-route-payload.ts; app/domain/research-route-payload-schema.ts; app/domain/view-snapshot.ts; app/domain/route-ai-comment.ts; app/lib/view-snapshot.ts; app/components/research/research-route-runtime.helpers.ts; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts; app/components/research/__tests__/ResearchRouteLayout.reactions.test.tsx
runCommitSha: 6835982d+worktree
observedOutput: The domain union, wire schema, and view-snapshot schema expose the same four route kinds. The active command builds a structured snapshot from the current route payload, and the generation route returns only the bounded RouteAiComment shape whose title and body limits are owned by the domain schema. Layout coverage keeps pending and settled comments in the host-owned inline surface; the generated schema has no button action shape. The retired multi-view presentation registry and consumer-free route helpers are absent.
gaps:
  - adopt: Route-kind completeness and the bounded structured reaction format are verified through the active schemas, command/snapshot boundary, generation route, and inline host surface.
  - reject: Retired presentation registries and multi-view helpers are not preserved as compatibility layers.
verdict: met
```

#### 2026-06-18 — product boundary after internal PDF handoff

```yaml
date: 2026-06-18
acs:
  - acceptance-check:reaction-respond-format
acReviewedRevision:
  - 1
fixtureRef: scripts/evidence-ledger/helpers/contract-check.ts; app/server/agent/__tests__/route-ai-comment-generation.test.ts; app/api/reaction/generate/[id]/__tests__/route.test.ts
runCommitSha: 50fd42bc01b3
observedOutput: Product-boundary review keeps the active generated-reaction contract on `acceptance-check:reaction-respond-format`: search reactions use route-view structured generation and the contract-check helper verifies the bounded text-only response shape. PDF Moonlight handoff is recorded only as the Moonlight handoff boundary context, not as evidence for this AC.
gaps:
  - adopt: Current product-boundary prose removes active PDF awareness coverage, names legacy PDF documents only as migrate-read-only stored-data compatibility, and no longer treats the retired interactive stream as an active product surface.
  - reject: This review uses current product-boundary rows only.
verdict: met
```
