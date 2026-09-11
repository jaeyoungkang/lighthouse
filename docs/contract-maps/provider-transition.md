# Provider Transition Contract Map

This map explains how Episteme 3's provider-neutral paper model, loaded result
windows, citation availability, and user-facing source copy relate.

It is a derived map. It does not define the provider adapter contract.

## Product Language Boundary

User-facing copy should not present Episteme as a separate, more authoritative
academic corpus. The product language is Moonlight Search over the named source
coverage. Episteme 3 is the internal provider-neutral read path and may combine
S2, OpenAlex, Crossref, arXiv and other source memberships. A single provider
membership is lineage evidence, not the whole-corpus identity.

Sources:

- [`product.source-basis`](../project-knowledge/knowledge-objects.md)
- [`product-making.provider-contract-propagation`](../project-knowledge/knowledge-objects.md)
- [`docs/contract-maps/source-basis.md`](source-basis.md)

## Current Search Path

The current implementation uses only the Episteme 3 native `/api/v3` namespace:

- `POST /api/v3/search/papers` for hybrid ranked windows;
- `GET /api/v3/papers/by-ref` for exact identifier lookup;
- `POST /api/v3/papers/batch` for rich card projection;
- `GET /api/v3/graph/citations` for direction-specific lineage;
- `POST /api/v3/papers/discover` for co-citation, bibliographic-coupling and semantic evidence.

The unversioned E2 compatibility shim is not a fallback. The shared literature
gateway accepts only the configured Episteme origin.

Sources:

- [`app/server/services/search-service.ts`](../../app/server/services/search-service.ts)
- [`app/server/services/episteme-literature.ts`](../../app/server/services/episteme-literature.ts)
- [`app/server/services/__tests__/episteme-literature.test.ts`](../../app/server/services/__tests__/episteme-literature.test.ts)
- [`app/server/services/__tests__/search-service.test.ts`](../../app/server/services/__tests__/search-service.test.ts)

## Source Metadata

Provider metadata is useful, but provider names alone are not trust basis. The
UI should explain the source lineage and the loaded window/cap/fallback state
where it matters.

The key metadata concerns are:

- canonical `paper_uid` and source memberships;
- projection/retrieval generation and currency;
- opaque paging cursor, total relation and completeness;
- loaded result window;
- citation/reference availability;
- truncation and unavailable reasons;
- PDF/open-access availability.

Sources:

- [`app/domain/research-route-payload.ts`](../../app/domain/research-route-payload.ts)
- [`app/domain/research-route-payload-schema.ts`](../../app/domain/research-route-payload-schema.ts)
- [`app/domain/paper.ts`](../../app/domain/paper.ts)
- [`docs/contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-result-window.ledger.yaml)

## Citation And Gap Semantics

Provider omission must not become a research claim. Missing references,
citations, adjacency, graph concepts, or PDF data can mean provider limitation,
not absence in the literature.

This is especially important for:

- citation lineage direction availability;
- gap network input breakdown;
- insufficient graph edge states;
- lazy citation pages.

Sources:

- [`docs/contracts/story-chain/promises/citation-lineage.md`](../contracts/story-chain/promises/citation-lineage.md)
- [`docs/contracts/story-chain/promises/gap-network-detection-from-search.md`](../contracts/story-chain/promises/gap-network-detection-from-search.md)
- [`docs/contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml`](../contracts/story-chain/evidence-ledgers/citation-lineage.ledger.yaml)
- [`docs/contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.yaml`](../contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.yaml)

## Failure Handling

Provider hard failure should degrade visible AI response without exposing raw
provider internals to users. Deterministic surfaces should remain usable when
possible.

Sources:

- [`docs/contracts/story-chain/aspects/provider-failure-degraded-mode.md`](../contracts/story-chain/aspects/provider-failure-degraded-mode.md)
- [`docs/contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml`](../contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml)

## Read Path

For provider migration work:

1. Project Knowledge의 source-basis와 provider-propagation 객체.
2. Product Identity and source-basis map.
3. Search result window Promise and ledger.
4. Citation lineage and gap network contracts.
5. Provider adapter code and tests.
6. Mission Control status and relevant Evidence Ledger runs.
