# Contract Maps

Contract Maps are curated reading maps over current Light House contracts.

They are not source of truth. Product meaning lives in Story Chain. Verification
state lives in Evidence Ledger, Mission Control, tests, and release gates.
Project Knowledge separates clone-local work handoff memory from reviewed
product and product-making explanation objects. The private Moonlight Project
Knowledge repository stores feedback synthesis and external or reusable research inputs.

Contract Maps answer a different question: when a product concern crosses many
contracts, which current files should a human or agent read together?

## Authority Boundary

| Layer | Owns | Contract Map relationship |
| --- | --- | --- |
| `docs/product-identity.md` | Product identity and trust principles | Read as source |
| `docs/contracts/story-chain/` | Experience, Moment, Promise, Aspect, Evidence Ledger | Read as source |
| `npm run mc:status` | Current computed release and verdict state | Read as source |
| `docs/project-knowledge/` | Local handoff memory and reviewed explanation objects | Read for rationale; follow each object's authority refs for current state |
| [`corca-ai/moonlight-research`](https://github.com/corca-ai/moonlight-research/tree/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback) | Feedback inventory and synthesis | Read as external planning source, not as current contract |
| `docs/contract-maps/` | Cross-document reading maps | Derived only |

Do not change Promise, Aspect, or Evidence Ledger meaning in this directory. If a
map reveals stale evidence or a missing contract edge, update the source contract
through Mission Control.

## Current Maps

- [`story-chain-authority.md`](story-chain-authority.md) — how product meaning,
  propagation, evidence, evaluator, and system gate authority are split.
- [`source-basis.md`](source-basis.md) — how Light House explains source,
  input scope, limits, fallback, and generated-reaction voice across current
  contracts.
- [`verdict-reading.md`](verdict-reading.md) — how to read current Promise,
  Aspect, Evidence Ledger, and release verdict state without mistaking one file's
  frontmatter for computed Mission Control status.
- [`reaction-runtime.md`](reaction-runtime.md) — how visible route
  `viewSnapshot` input moves through structured generation to
  `RouteAiComment-or-null` output.
- [`search-runtime.md`](search-runtime.md) — how user search moves from request
  through provider fetch, library anchor-blend, dedup, the unified default
  projection and secondary sort to the reaction input handoff.
- [`quality-gates.md`](quality-gates.md) — how validation gates relate to Story
  Chain, Evidence Ledger, Mission Control, CI, and mutation; runtime zone ×
  obligation으로 관련 검증을 찾는 빠른 색인.
- [`quality-gate-records.md`](quality-gate-records.md) — quality gate의 dated
  회수 감사와 과거 inventory snapshot. 현재 gate 선택은 `quality-gates.md`에서
  시작한다.
- [`feedback-routing.md`](feedback-routing.md) — how beta feedback and product
  requests move toward issues, steward workflows, Story Chain, or deferral.
- [`provider-transition.md`](provider-transition.md) — how Semantic Scholar,
  Episteme, loaded result windows, citation availability, and source copy relate.
- [`project-knowledge.md`](project-knowledge.md) — how Project Knowledge differs
  from Story Chain, Contract Maps, and private feedback documents.

## Maintenance

When updating a map:

1. Read the current product identity and relevant Story Chain files.
2. Check `npm run mc:status`; computed status can differ from a single file's
   frontmatter.
3. Link to source files instead of duplicating long contract text.
4. Record whether a referenced feedback document is current contract or planning
   input.
5. Run `npm run contract-maps:check`, `npm run format:check`,
   `npm run mc:validate-story-chain`, and `npm run pk:validate` for docs-only
   map changes.
