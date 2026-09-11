---
name: mission-control-workflows
description: Current 4-authority Mission Control workflows using Story Chain canonical terms.
---

# 4-Authority Workflows

## A — Agent

Use for propagation, implementation, and contract synchronization.

1. Read the Promise under `docs/contracts/story-chain/promises/<slug>.md`.
2. Read its covering Evidence Ledger under
   `docs/contracts/story-chain/evidence-ledgers/<name>.ledger.yaml`.
3. When the change touches architecture-shaped clauses, classify them with
   `references/product-architecture-content-ownership.md`. Record `KEEP`,
   `SPLIT`, `MOVE`, or `EVIDENCE`, destination, stable ref, meaning-change
   status, and CAIR status in the work's existing durable plan.
4. Ensure the ledger lists the Promise under `sourcePromises`.
5. Ensure reciprocal Aspect weaving is present under `appliedAspects`.
6. Add or update `intent.checks` for qualitative live-judge evidence. Use
   `intent.mode: delegated` only when every formal Intent Check names a valid
   explicit owner ledger.
7. Add or update strict v2 `acceptanceChecks` entries. Each entry carries one
   canonical key, an assertion, and one or more `executionRefs`.
8. For each Acceptance Check, list the runtime invariants that make the visible
   behavior true. Cover final DOM/state evidence and any upstream dependency
   such as generated payload fields, branch identity, persistence shape, or
   parser output. Do not count a fixture that already satisfies an invariant as
   proof that the real path creates that invariant.
9. Implement the code and tests.
10. If the change alters runtime ordering, fallback order, programmatic
    inspect/AI response boundaries, persistence/sync ownership, or debugging
    signals, update the relevant `docs/runtime-flows/*` document.
11. Tag user-facing surface files with `// @promise`; add `// @aspect` and
    `// @check` when the surface directly realizes those refs.
12. Run targeted verification, then `mc:validate-story-chain`,
    `mc:audit-surface`, and `mc:audit-story-surface`.

`intent.mode: absorbed` is valid when:

- the ledger has zero `intent.checks` and zero `intent.delegations`;
- every source Promise has zero Intent Checks;
- every source Promise has at least one `acceptanceChecks` entry on that ledger.

No external judgment-anchor ledger is required.

## E — Evaluator

Use for truth-signal execution.

1. Find rows needing evaluation with `npm run mc:next -- --authority E --json`.
2. Run the evidence path named by the Evidence Ledger.
3. Record the actual verdict in the Evidence Ledger's review section when the
   contract requires a dated review.
4. If the verdict is not met, stop and hand the row back to A or H depending on
   whether the fix is mechanical or normative.

## H — Human

Agents stop when the next step requires product meaning or policy authority:

- adding, removing, or materially changing an Intent Check;
- deciding whether a Promise should exist;
- changing Mission Control policy;
- accepting an unresolved tradeoff.

Report the Promise ref, current evidence, the blocked decision, and one or two
concrete options.

## S — System

Agents do not advance S items directly. CI, release verdict, typecheck,
surface audits, and Story Chain validation hold this authority.

## Common Slice: New UI Promise

1. Confirm Human approval for the Promise existence and meaning. Agents may
   draft wording, but the canonical Promise does not exist until Human meaning
   is explicit.
2. Add or update the Promise file with frontmatter, Promise prose, Intent Check
   blocks, and Acceptance Check blocks.
3. Update the covering Evidence Ledger v2 with `sourcePromises`,
   `appliedAspects`, `intent`, `acceptanceChecks`, `executions`,
   `implementationContracts`, and `verdict`.
4. Add deterministic tests and live judge tests where the Promise declares
   qualitative Intent Checks.
5. Implement the UI and tag the user-facing surface.
6. Update `docs/runtime-flows/*` when the UI Promise changes runtime procedure
   order, fallback behavior, programmatic inspect/AI response boundaries, or sync
   ownership.
7. Run targeted tests and Mission Control gates.

## Common Slice: Story Chain Content Review

Use this when a human reviews `experiences/`, `moments/`, `aspects/`, or
`promises/` by meaning rather than by failing tests.

1. Read `docs/contracts/story-chain/concepts.md`.
2. Review in this order: Experience, Moment, Aspect, Promise, Evidence Ledger.
3. For Experience/Moment review, decide whether the item is a durable
   experience area, an observable workflow moment, a vertical Promise, or a
   cross-cutting Aspect.
4. For Aspect review, require pointcut, advice, verification evidence, and a
   covering Evidence Ledger. Do not promote a single Promise's Acceptance Check into
   an Aspect.
5. For Promise review, keep the parent Experience/Moment refs and Acceptance
   Check set synchronized with the covering Evidence Ledger.
6. For architecture-shaped clauses, classify `KEEP`, `SPLIT`, `MOVE`, or
   `EVIDENCE` before editing. Preserve visible meaning and stable ids when
   meaning is unchanged; do not make Story Chain restate the destination's
   runtime or engineering mechanism.
7. If the human decision changes concept identity, use
   `references/concept-adjustment.md`.
