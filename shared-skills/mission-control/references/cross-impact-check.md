---
name: mission-control-cross-impact-check
description: Current Story Chain impact scan before changing an existing Promise, Aspect, Evidence Ledger, or tagged surface.
---

# Cross-Impact Check

Run this before modifying or retiring an existing Promise. The goal is to find
other Story Chain nodes that would become stale if only the obvious file changed.

## Inputs

- Target Promise, Aspect, Intent Check, Acceptance Check, or surface file.
- Covering Evidence Ledger path when known.
- Planned change in one sentence.
- Whether the planned change alters visible product meaning, only an internal
  mechanism/evidence path, or a clause that currently mixes both.

## Scan

1. **Promise siblings**: find other Promises in the same Evidence Ledger or using
   the same surface/test.
2. **Acceptance Check links**: inspect every linked Acceptance Check before
   changing an Intent Check, and every linked Intent Check before changing an
   Acceptance Check.
3. **Aspect pointcuts**: check `docs/contracts/story-chain/aspects/` for
   `appliesTo` entries that include the target Promise.
4. **Evidence mappings**: inspect covering Evidence Ledgers and
   `docs/contracts/story-chain/scenario-catalog.md` for Acceptance Check or scenario
   mappings that name the target.
5. **Code surface tags**: search `app/` for `// @promise`, `// @aspect`, and
   `// @check` refs that would need to move or be removed.
6. **Evidence paths**: inspect run evidence and live judge tests shared by more
   than one Promise.
7. **Shared-builder quality parity**: if the target feeds a builder also fed by
   another source (e.g., a citation-lineage source and a search-result source
   both fed into the same `gap_network` builder), check whether each source
   produces input of comparable quality — same upstream fields, same
   adjacency, same metadata maturity. Helper-level tests on each path can
   pass while the end-to-end output diverges because the upstream contexts
   differ. If parity is claimed by the AC body, lock it with fixture-based
   or Intent Check evidence per `references/quality-parity-evidence.md`,
   not just with deterministic helper tests on each side.
8. **Content ownership**: classify every architecture-shaped Story Chain hit
   with `product-architecture-content-ownership.md`. Use `KEEP`, `SPLIT`,
   `MOVE`, or `EVIDENCE`; name the canonical destination and stable ref. Do not
   mark a Promise, AC, or Aspect for modification only because a component,
   scheduler, cache, gateway, function, endpoint, table, environment variable,
   or test name changed.

Use `rg` first. Keep the result small and explicit. Mark each discovered path
as an owning edit, inspect-only downstream impact, compatibility-only shape, or
split cleanup. Discovery alone does not make a path part of the owning change.

## Output

Before editing, write a short ledger in the working notes or user update:

```markdown
Cross-impact ledger — promise:<slug>

| category        | affected ref/path | placement | decision                  |
| --------------- | ----------------- | --------- | ------------------------- |
| sibling promise | promise:<slug>    | KEEP      | preserve / modify / no-op |
| aspect pointcut | aspect:<slug>     | KEEP      | update appliesTo / no-op  |
| runtime detail  | docs/runtime...   | MOVE      | add stable ref / no-op    |
| ledger evidence | evidence-ledger   | EVIDENCE  | update exact ref / no-op  |
| code surface    | app/...           | —         | retag / preserve / remove |
```

`KEEP`/`SPLIT`/`MOVE`/`EVIDENCE` classifies Story Chain clauses and evidence
placement. Code-surface lifecycle rows use only the propagation decision.

If a row needs Human authority, stop and ask. Do not hide an unresolved impact
behind a local code fix.

When the scan finds multiple owning bundles, a CAIR `reshape`, Concept Shift
`remove`, a cache/state lifecycle, or a scope-checkpoint forecast, continue with
[`propagation-scope-control.md`](./propagation-scope-control.md) before editing.
