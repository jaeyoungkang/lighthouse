---
name: mission-control-promise-modification
description: Current Story Chain workflow for changing a live Promise without retiring it.
---

# Promise Modification

Use this when the Promise remains valid but its declaration, evidence, or
placement needs to change.

## Step 0 — Cross-Impact

Run `references/cross-impact-check.md`. Modification is often where stale edges
are introduced, because a Promise can share a Evidence Ledger, Aspect, component,
or test with sibling Promises.

Before editing, separate visible meaning from implementation mechanism with
`references/product-architecture-content-ownership.md`.

- A user- or operator-visible meaning change follows the normal Human authority,
  CAIR, identity, and propagation rules.
- An internal mechanism-only change does not by itself change Promise,
  Acceptance Check, or Aspect prose. Update the canonical engineering/runtime
  owner and exact Evidence Ledger refs instead.
- A retrospective mixed clause is `SPLIT`: keep the visible guarantee, move the
  mechanism, and preserve the Promise/AC id when the truth criterion is the
  same.

## Cases

### Prose Or Title

Change only the Promise title/body when the user-facing meaning is unchanged.
If the meaning changes, inspect Intent Checks and Acceptance Checks too.

Do not use prose-only clarification to replace one scheduler, cache, gateway,
function, endpoint, table, environment variable, component, or test name with
another. Those identifiers belong to their runtime, engineering, or Evidence
Ledger owners unless the identifier is itself a user-visible contract surface.

Update:

- `docs/contracts/story-chain/promises/<slug>.md`
- covering Evidence Ledger prose if it quotes or summarizes the old meaning

### Intent Check

Adding, removing, or materially rewriting an Intent Check changes qualitative
truth criteria. This usually needs Human authority.

Update:

- Promise `## Intent Checks`
- covering Evidence Ledger `## Intent Checks`
- live judge evidence path and review/verdict entry
- any linked Acceptance Check references

Run the live judge against actual runtime output or rendered DOM.

### Acceptance Check

Acceptance Checks are deterministic contracts. Do not silently reuse a check id
for a different meaning.

Write the AC as an executable product-boundary invariant. Keep exact test,
command, fixture, artifact, internal path, function, table, endpoint, and
environment-variable refs in the covering Evidence Ledger or canonical runtime
owner. A user-visible URL/route or declared operator command may remain in the
AC when its identity is part of the guarantee.

When adding a new Acceptance Check or changing the meaning of an existing one,
use a semantic kebab-case slug instead of positional numbering. The canonical
rule is
`promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-ac-slug-rule`:
new AC ids should name the assertion axis, be unique inside the Promise, stay
short (≤ 4 words / ≤ 30 chars after the Promise prefix), and avoid encoding
specific brittle values. If an old `*-ac1` style check changes meaning, rename
it to a semantic slug and update every Promise frontmatter entry, heading,
Evidence Ledger YAML v2 entry, execution ref, surface tag, and test reference
in the same change.

When an Acceptance Check body promises a behavior across multiple code paths
(client action, server fallback, background analysis preparation, etc.), every
path the AC names must be locked by its own executable evidence. The covering
Evidence Ledger row should call out each path by file or test name. A row that
only locks two of three named paths lets the third path drift silently and
contradicts the AC body — that is how a recent citation-lineage union policy
shipped covered for the client and pending fallback while the real analysis
preparation kept the old behavior. Decompose the AC into the runtime
invariants and add evidence rows or test cases for each one.

When the AC body claims **parity** between two surfaces — same pipeline, same
quality, comparable output between two sources or a primary + fallback — the
per-path evidence rule above is necessary but not sufficient. Per-path tests
each pass in isolation while end-to-end output diverges because the upstream
contexts differ (different SS field sets, different inline-analysis maturity,
different cap windows). Follow `references/quality-parity-evidence.md`: write
the parity invariant into the AC body in concrete terms, then lock it with
either a fixture that runs both surfaces against the same logical scenario
and asserts a comparable output metric, or — when the parity claim is
qualitative — an Intent Check (live judge) registered on the Promise. If the
fixture needs a mock provider response (Semantic Scholar batch, inline
analysis, gap-network input), extend the existing simulation surface
(`s2-fetch` mock, inline-analysis fixture, gap-network test seam) so the
parity test is reproducible and lives alongside the per-path tests rather
than inventing a one-off mocking style.

Pair this with an Intent Check authoring pass when the parity question is
genuinely qualitative — "does the citation-lineage gap report read as a real
research-gap analysis the same way the search-result one does?" Deterministic
fixtures answer structural parity ("same input fields", "same edge order of
magnitude"); Intent Checks answer qualitative parity ("comparable depth",
"same kind of explanation"). Do not collapse one into the other.

Update:

- Promise `## Acceptance Checks`
- covering Evidence Ledger v2 `acceptanceChecks` entry and its `executionRefs`
- deterministic tests or structured execution evidence

### Parent Refs

Changing `experience:`, `moment:`, `lane:`, or Aspect pointcuts changes where
the Promise lives in the Story Chain.

Update:

- Promise frontmatter
- related Experience/Moment references when needed
- Aspect `appliesTo` and reciprocal Evidence Ledger weaving

### Split Or Merge

Treat split/merge as a small migration. Create the new Promise shape, migrate
Evidence Ledger coverage and surface tags, then retire or remove the old refs only
after validation passes.

## Closeout

Run:

```bash
npm run mc:validate-story-chain
npm run mc:audit-surface
npm run mc:audit-story-surface
```

Run targeted tests for every changed evidence path.
