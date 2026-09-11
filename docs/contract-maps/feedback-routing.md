# Feedback Routing Contract Map

This map explains how beta feedback and product requests move toward contracts.

It is a reading map. Feedback documents are planning input. Story Chain and
Mission Control own current product commitments.

## Routing Principle

Do not move feedback directly into UI copy or code. First decide whether the
feedback is:

- a concrete bug or regression;
- a missing Promise or Acceptance Check;
- a cross-cutting Aspect concern;
- a copy/product-voice issue;
- an issue backlog item;
- a deferred research/product question. External material research follows the
  [`external-research`](../../shared-skills/external-research/SKILL.md) skill
  procedure.

Sources:

- [`research-trust-basis-surface-inventory.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-trust-basis-surface-inventory.md)
- [`research-google-scholar-comparison.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-google-scholar-comparison.md)
- [`docs/project-knowledge/shared-memory.md`](../project-knowledge/shared-memory.md)

## Steward Split

Use the repo-local steward skills when feedback touches contracts or product
meaning.

| Workflow | Use when |
| --- | --- |
| `product-discovery-steward` | feedback triage, product ideation, issue routing, or reusable policy candidate detection |
| Mission Control Service Policy Coverage Review | a new or materially restructured core-product service bundle must research minimum user-facing and non-user-facing policies and assign `owned`, `rejected`, or `unresolved` before choosing the Promise set |
| Mission Control Contract Architecture Impact Review | an approved Experience/Moment/Promise/AC/Aspect changes timing, domain/data shape, ownership, state lifetime, execution semantics, runtime/external/AI boundaries, security/privacy, capacity/cost, observability, compatibility, or a shared invariant |
| `story-chain-contract-steward` | Promise, Acceptance Check, Evidence Ledger, run evidence, Sufficiency Review, or surface-tag propagation |
| `aspect-steward` | cross-cutting rule add/change/retire work |

Source:

- [`docs/agent-skills.md`](../agent-skills.md)

## Trust-Basis Example

The trust-basis feedback looked like a new trust Aspect at first. The accepted
direction was restructuring existing responsibilities:

- `visible-explanation-sufficiency` owns source/input/limit/fallback information
  structure;
- `reaction-prefers-load-bearing-facts` owns generated-reaction product voice;
- no duplicate trust Aspect was added.

Sources:

- [`research-trust-basis-surface-inventory.md`](https://github.com/corca-ai/moonlight-research/blob/0f55f8c0c837b941fafe38445d03001283cf23de/archive/private-beta-feedback/research-trust-basis-surface-inventory.md)
- [`docs/contract-maps/source-basis.md`](source-basis.md)

## Issue Memory

Project Knowledge records recurring issue-level decisions. Use it to recover why
a feedback item was routed, but do not treat it as the current contract.

Source:

- [`docs/project-knowledge/shared-memory.md`](../project-knowledge/shared-memory.md)

## Read Path

For new feedback:

1. Read the feedback artifact.
2. Check relevant Project Knowledge memories.
3. Decide whether it is Add, Restructure, Defer, or Reject.
4. If the work creates or materially restructures a core-product service bundle,
   run Mission Control's Service Policy Coverage Review before choosing the
   Promise set. Route non-user-facing policies to their runtime, security/data,
   operational, or evidence owner instead of forcing them into Story Chain prose.
5. If product meaning changes, use Mission Control and the relevant steward.
6. Before implementation, run the Contract Architecture Impact Review when the
   approved contract changes an expectation along an architecture-impact axis.
   Record `none`, `constrain-existing`, or `reshape` under the exact
   `## Contract Architecture Impact Review` heading in the work's durable
   issue/PR plan or body, owning contract artifact, or runtime-flow document.
7. If only implementation follows from approved contracts, update Evidence
   Ledger, code, tests, and runtime-flow docs as needed.
