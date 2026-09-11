# Reaction Runtime Contract Map

This map explains how current route-view AI reactions are routed.

It is derived from runtime-flow docs, Product Identity, and Story Chain. It does
not change runtime order.

## Product Boundary

Light House is not a free-chat agent. Current route-view reaction generation
uses the visible route `viewSnapshot`, structured JSON generation, and returns
`RouteAiComment-or-null`. The legacy interactive reaction stream is not a
served current-product entrypoint.

Sources:

- [`docs/product-identity.md`](../product-identity.md)
- [`docs/runtime-flows/ai-response-generation.md`](../runtime-flows/ai-response-generation.md)

## Runtime Flow

The current automatic route-view reaction flow is:

1. `ResearchRouteRuntime` queues a targeted generation command for an eligible
   route-owned search, citation, or similar result view.
2. The generation scheduler coalesces duplicate `(trigger, targetRoutePayloadId)`
   commands while preserving independent targets and `reactionGeneration`
   freshness.
3. `POST /api/route-ai-comments/generate/:viewId` receives the caller-supplied
   `viewSnapshot`, verifies the current principal, rejects non-generation
   snapshot types, and de-dupes identical in-flight requests.
4. `generateRouteAiComment` builds prompt context from the supplied snapshot
   and calls `executeStructuredGeneration` for one JSON object.
5. Successful search/citation/similar comments return to client state only.
   `null` results are not persisted and do not create fallback comments. Gap
   report reactions persist through the current viewer's preference
   sub-resource beside the shared report artifact.

Sources:

- [`docs/runtime-flows/ai-response-generation.md`](../runtime-flows/ai-response-generation.md)
- [`app/server/agent/route-ai-comment-generation.ts`](../../app/server/agent/route-ai-comment-generation.ts)
- [`app/api/route-ai-comments/generate/[id]/route.ts`](../../app/api/route-ai-comments/generate/%5Bid%5D/route.ts)
- [`app/components/research/route-ai-comment-generation-scheduler.ts`](../../app/components/research/route-ai-comment-generation-scheduler.ts)

## Execution Modes

| Mode | Model? | Purpose |
| --- | --- | --- |
| structured route-view reaction generation | Yes | Generate one targeted route-view reaction as JSON |

Source:

- [`docs/runtime-flows/ai-response-generation.md`](../runtime-flows/ai-response-generation.md)

## Route-View AI Comment Contract

The current AI comment contract keeps automatic route-view reactions bounded to
structured title/body JSON generated from the visible ResearchRoutePayload snapshot.
Host-owned follow-up actions stay outside model output. The contract is enforced
by route tests, structured generation tests, contract checks, mutation
hardening, and Evidence Ledger rows.

Sources:

- [`docs/contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md`](../contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md)
- [`docs/contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml`](../contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml)
- [`app/server/agent/route-ai-comment-generation.ts`](../../app/server/agent/route-ai-comment-generation.ts)
- [`app/api/route-ai-comments/generate/[id]/route.ts`](../../app/api/route-ai-comments/generate/%5Bid%5D/route.ts)

## Product Promises

The runtime path supports several product promises. The most common reaction
entry points are:

- search reaction terrain summary;
- citation lineage reaction;
- graph-neighbor reaction;
- gap network reaction and overlay.

Result-card PDF affordances do not enter this reaction runtime. They render a
Moonlight handoff link outside the Light House AI response path.

Sources:

- [`docs/contracts/story-chain/promises/search-reaction-summarizes-terrain.md`](../contracts/story-chain/promises/search-reaction-summarizes-terrain.md)
- [`docs/contracts/story-chain/promises/citation-lineage.md`](../contracts/story-chain/promises/citation-lineage.md)
- [`docs/contracts/story-chain/promises/gap-network-detection-from-search.md`](../contracts/story-chain/promises/gap-network-detection-from-search.md)

## Change Rule

If a change touches route-view generation ownership, fallback order, structured
generation boundaries, or provider-failure handling, update:

1. runtime-flow docs;
2. affected Promise/Aspect/Evidence Ledger;
3. tests or live judges;
4. this map only if the reading path changes.
