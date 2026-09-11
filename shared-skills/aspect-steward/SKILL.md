---
name: aspect-steward
description: Companion to mission-control. Use after Mission Control scopes the Story Chain work when adding, editing, reviewing, retiring, or repairing Aspects under docs/contracts/story-chain/aspects, including Aspect frontmatter, appliesTo pointcuts, Why/Pointcut/Advice/Verification prose, covering Evidence Ledgers, reciprocal Promise weaving, surface tags, Aspect verdicts, or aspect-related validation failures. Keeps cross-cutting rules synchronized with Promises, ledgers, tests, and release verdict.
---

# Aspect Steward

Use this skill before changing any `aspect:*` declaration, pointcut, or
cross-cutting rule.

This is a Mission Control companion skill. Load Mission Control first for Story
Chain scope and authority. Use `story-chain-contract-steward` when covering
ledger shape, Promise weaving, or Sufficiency Review entries change.

## Non-Negotiables

- Do not add or materially change Aspect meaning without Human authority.
- Do not write or keep Aspect Advice that conflicts with the
  `## 제품 원칙` section of `docs/product-identity.md`. When an existing
  Aspect conflicts with a product-principle statement, record the
  principle-misalignment and stop for Human authority instead of forcing a
  `met` verdict or silently rewriting the Advice.
- Do not update an Aspect `appliesTo` list without reciprocal Evidence Ledger
  weaving.
- Do not treat Aspect prose as a label. It must define Why, Pointcut, Advice,
  and Verification when touched for meaning or pointcut changes.
- Keep Aspect Advice at the user- or operator-visible cross-surface constraint.
  Do not make exact schedulers, caches, gateways, components, functions,
  endpoints, tables, environment variables, tests, or commands authoritative
  there. Technical tokens are review signals, not automatic violations.
- Apply
  `shared-skills/mission-control/references/contract-layer-routing.md` before
  promoting detailed Promise or Acceptance Check prose. An exact URL shape does
  not become an Aspect merely because it is technical: the Aspect owns only a
  shared visible constraint with a real pointcut across two or more Promises.
  Route authority, carrier, canonical identity, serialization, and byte-budget
  rules stay with CAIR and their engineering/runtime owner; Architecture
  Fitness receives only a supported projection of that approved structure.
- Keep exact tests, commands, targets, fixtures, and artifacts in the covering
  Evidence Ledger. Aspect `## Verification` uses the stable ledger ref instead
  of duplicating those details.
- Do not leave release verdict stuck at `unverified`, `unknown`, or stale due to
  missing covering review evidence.

## Required Pre-Check

Before editing an Aspect:

```bash
sed -n '1,220p' docs/contracts/story-chain/concepts.md
sed -n '1,220p' shared-skills/mission-control/references/contract-layer-routing.md
sed -n '1,180p' shared-skills/mission-control/references/aspect-graduation.md
sed -n '1,260p' shared-skills/aspect-steward/references/aspect-lifecycle-catalog.md
sed -n '1,240p' shared-skills/mission-control/references/product-architecture-content-ownership.md
rg -n -A 30 "^## 제품 원칙" docs/product-identity.md
rg -n "aspect:<target-slug>|<target-slug>" docs/contracts/story-chain app
```

Also inspect every target Promise named by `appliesTo`.

Use `references/aspect-lifecycle-catalog.md` to classify Promise/AC versus
Aspect versus architecture/runtime ownership, survey one-target Aspects, and
apply the creation, change, retirement, and periodic-audit lifecycle. Its case
catalog is a reading route into current canonical files, not a registry.

## Aspect Shape

Use this target body shape for new or meaning-touched Aspects:

1. `## Why`
2. `## Pointcut`
3. `## Advice`
4. `## Verification`

Frontmatter must keep:

- `id: aspect:<slug>`
- `slug`
- `title`
- `appliesTo`
- `coveringLedger`
- `verdict`

The covering Evidence Ledger must list the Aspect under `## Applied Aspects`
when reciprocal weaving holds.

## Add Or Change Procedure

1. Decide whether this is a new cross-cutting rule, pointcut update, prose-only
   clarification, architecture-shaped clause normalization, or retirement.
   For normalization, classify each clause as `KEEP`, `SPLIT`, `MOVE`, or
   `EVIDENCE` before editing.
2. Confirm Human authority for new or meaning-changed Aspect advice.
3. Update Aspect frontmatter and body.
4. Propagate every new or changed Advice clause.
   - Build an advice-to-evidence matrix before marking the Aspect `met`.
   - For each changed advice clause, name the affected Promise(s), surface(s),
     ledger row(s), and deterministic or live-judge evidence that proves it.
   - If a clause is only partially covered, write the Sufficiency Review verdict
     as `unknown` and list the missing propagation paths. Do not claim `met`
     from a shared format/schema test when the advice is surface-specific.
   - Treat static UI copy, prompt-generated reaction prose, deterministic
     fallback copy, and provider/source wording as separate propagation paths.
   - Build the matrix in working notes or the covering ledger. Do not copy its
     exact test and mechanism identifiers into Aspect Advice.
5. Update the evidence topology without forcing every pointcut target into one
   ledger.
   - The declared `coveringLedger` must list the Aspect under
     `## Applied Aspects` and keep the direct Source Promises, AC coverage, and
     review/verdict evidence that it owns aligned.
   - Trace the current canonical evidence route for every remaining pointcut
     target through its owning AC, ledger, surface, and review. When a
     target-owning ledger declares the Aspect, keep that ledger's Source
     Promise and Applied Aspect pair reciprocal. When no parsed ledger pair
     exists, record the gap as a semantic advisory; do not invent duplicate
     rows or claim validator coverage.
6. Update affected `// @aspect` tags in rendered or user-facing surfaces.
7. If the Aspect affects release verdict, add or update the Sufficiency Review
   entry using `story-chain-contract-steward`.
   - The dated review entry must include the exact `aspect:<slug>` ref in the
     heading or body. The Aspect verdict reader only treats exact Aspect refs as
     verdict-bearing entries.
   - After editing the review, run `npm run mc:status` or
     `npx tsx -e "import { buildAspectVerdictReport } from './scripts/mission-control/lib/aspect-verdict'; console.log(buildAspectVerdictReport(process.cwd()))"`
     and verify the changed Aspect status is the intended one.
   - A changed Aspect may legitimately leave release blocked while propagation
     work is pending. Do not force green by writing an over-broad `met` review.

For new Aspects, start with the lifecycle catalog's discovery and layer
classification. The default is a pointcut over at least two current Promises.
A one-target Aspect requires an explicit reuse case, named sibling candidates,
a Promise-local demotion reason, complete current evidence, and review
triggers. Validator acceptance alone is not semantic approval.

For split, merge, retirement, or periodic audit, follow the lifecycle catalog
and keep the same Human-authority boundary. Do not retire only the Aspect file:
close reciprocal Promise refs, ledger weaving and verdict evidence, surface
tags, and stale process references in the same change.

## Pointcut Changes

For every added or removed Promise in `appliesTo`:

- inspect the Promise file,
- inspect the declared covering Evidence Ledger and affected target-owning
  ledgers,
- update reciprocal weaving,
- update affected surface tags,
- run Story Chain validation.

`mc:validate-story-chain` enforces the `appliesTo` ↔ `promise.aspects` mirror
globally (issue #193): adding a Promise to `appliesTo` fails validation until
the Promise declares the Aspect back, and a Promise-side declaration fails
until the pointcut includes it. A pointcut edit therefore mechanically forces
the rest of the weave — do not silence the error by reverting the pointcut
when the concern genuinely applies.

If a Promise no longer follows the Aspect advice but still has the Aspect in
`appliesTo`, do not patch tests around it. Fix the pointcut or implementation.

## Validation

Close with the canonical contract closeout alias — its gate list is owned by
the `package.json` definition, so do not hand-pick a subset (issue #193):

```bash
npm run quality:contract
```

Also run targeted evidence for the covering ledger and any live judge that
contributes to the Aspect verdict.

Treat validator results according to the lifecycle catalog's boundary:
structural ref, reciprocal-weaving, ledger, surface-tag, and release-verdict
failures block closeout; semantic pointcut breadth, duplicated threshold
authority, missing direct ledger pairs, mechanism leakage, and one-target
longevity are advisory findings rather than automatic validator failures.
Escalate to Human review only when closing an advisory requires a product
meaning or pointcut-scope decision; do not replace that judgment with invented
string lint.
