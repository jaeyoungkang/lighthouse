---
name: mission-control-concept-adjustment
description: Workflow for resolving duplicate or overlapping Story Chain Experience/Moment concepts.
---

# Concept Adjustment

Use this when `duplicate_high_level_concept` appears in the alignment snapshot,
or when a human reports that two Story Chain Experience / Moment nodes describe
the same upper-level concept.

Use `docs/contracts/story-chain/concepts.md` as the boundary authority before
deciding whether an item is an Experience, Moment, Promise, or Aspect.

## Authority

Concept identity is product meaning, so the semantic decision is Human
authority:

- **merge**: two nodes are the same concept; keep one canonical ref and migrate
  children.
- **split**: one label is overloaded; create or rename nodes so each has one
  role.
- **rename**: the concepts differ but the labels collide.
- **retire**: a concept no longer owns any live Promise after migration.

Agents may do A/E propagation after the Human decision is explicit.

## Scan

1. Run `npm run mc:status` and inspect alignment findings for
   `duplicate_high_level_concept`.
2. Read `docs/contracts/story-chain/concepts.md`.
3. Read the candidate Experience / Moment files and list their child Moments /
   Promises.
4. Check the semantic boundary:
   - Experience: durable product/operator experience area; may own multiple
     workflow moments.
   - Moment: observable workflow moment inside one Experience; may own
     multiple Promises.
   - Promise: vertical user/operator-facing contract with Acceptance Checks.
   - Aspect: cross-cutting rule that applies across multiple Promises.
5. Run `references/cross-impact-check.md` for every affected Promise group.
6. Inspect covering Evidence Ledgers and `// @promise` / `// @aspect` / `// @check`
   surface tags that mention affected children.

## Propagation

After Human approval:

1. Update `docs/contracts/story-chain/experiences/` and/or
   `docs/contracts/story-chain/moments/`.
2. Update child Promise frontmatter parent refs.
3. Update covering Evidence Ledger YAML v2 `sourcePromises`, complete
   `acceptanceChecks` keys, and any narrative that names the old concept.
4. Retag surfaces only when Promise / Aspect / Check refs move.
5. Remove or keep old concept files according to the approved operation; do not
   leave an empty duplicate concept as a silent alias.

## Validation

Close with the canonical contract closeout alias — its gate list is owned by
the `package.json` definition (issue #193):

```bash
npm run quality:contract
```

If the adjustment changes tests or runnable specs, also run the targeted
structured execution evidence.
