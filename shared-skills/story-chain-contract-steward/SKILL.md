---
name: story-chain-contract-steward
description: Companion to mission-control. Use after Mission Control scopes Story Chain work when adding, editing, splitting, merging, retiring, or reviewing Promises, Acceptance Checks, Evidence Ledger coverage, Source Promise owner boundaries, foreign-owner AC refs, structured execution evidence, Sufficiency Review entries, surface tags, scenario refs, or Promise-related validation failures. Keeps Promise meaning, deterministic checks, ledgers, reviews, tests, and code synchronized without loading multiple narrow steward skills.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Story Chain Contract Steward

Use this skill after Mission Control has established the Story Chain scope and
authority. It covers the vertical contract path:

```text
Promise -> Acceptance Check -> Evidence Ledger -> run evidence -> Sufficiency Review -> code/test/surface tags
```

Use `aspect-steward` separately for Aspect pointcuts, advice, and Aspect verdict
work.

## Non-Negotiables

- Do not create, retire, or materially change Promise meaning without Human
  authority.
- Do not close a Promise or Acceptance Check meaning change without checking
  it against the `## 제품 원칙` section of `docs/product-identity.md`. A
  product-principle conflict is a Human-authority stop, not a propagation
  detail: record the misalignment instead of silently rewriting the contract
  or the principle.
- Do not change an Acceptance Check's meaning while keeping the old id.
- Do not propagate an internal mechanism-only change into Promise, Acceptance
  Check, or Aspect prose. Classify architecture-shaped clauses first; when
  visible meaning is unchanged, preserve the contract ids and wording that
  still state that meaning.
- Apply
  `shared-skills/mission-control/references/contract-layer-routing.md` before
  moving a clause between Promise, Acceptance Check, Aspect,
  engineering/runtime ownership, and Architecture Fitness. A public URL shape
  may remain a Promise or Acceptance Check when restore, share, bookmark, or
  compatibility behavior depends on that identity; a replaceable route detail
  must move to its engineering/runtime owner.
- Do not add an Acceptance Check without executable evidence in the same change
  unless Human authority explicitly leaves the Promise `unknown`.
- Do not skip, narrow, disable, or rename tests to make validation pass.
- Do not add `legacy: true` to a new or edited Sufficiency Review entry unless
  the user explicitly approves preserving historical prose.
- Do not leave stale refs in Aspect `appliesTo`, Evidence Ledgers, review YAML,
  scenarios, or `// @promise` / `// @check` tags.
- Do not draft a new core-product Promise bundle until Mission Control's
  Service Policy Coverage Review has assigned every minimum service policy to
  `owned`, `rejected`, or `unresolved`; unresolved rows stop composition.
- Do not let a Sufficiency Review directly name an Acceptance Check or Intent
  Check outside its Evidence Ledger's `Source Promises`. A downstream impact
  may be linked in prose, but its owning ledger keeps the AC/IC refs, reviewed
  revisions, run evidence, and verdict.
- Do not encode a retired behavior's absence as current contract prose unless
  the absence is itself a current safety, privacy, security, source-of-truth, or
  compatibility invariant. Rewrite current contracts toward the active owner,
  input, source, fallback, or visible state; keep purely historical absence in
  dated reviews or the explicit retirement stance.
- Do not satisfy retirement by allowing an empty scope, page, section, nav item,
  glossary bucket, generated list, or route to remain. Remove the empty surface
  or document the explicit Human-approved reason it stays visible.
- Do not retire behavior before recording whether backward compatibility is
  `preserve`, `migrate-read-only`, or `remove`. The stance must come from product
  ownership and stored/public contract risk, not from implementation convenience.

## Read First

For any contract change:

```bash
sed -n '1,220p' docs/contracts/story-chain/concepts.md
sed -n '1,180p' shared-skills/mission-control/references/cross-impact-check.md
sed -n '1,220p' shared-skills/mission-control/references/contract-layer-routing.md
sed -n '1,240p' shared-skills/mission-control/references/product-architecture-content-ownership.md
```

For live Promise modification or retirement:

```bash
sed -n '1,180p' shared-skills/mission-control/references/promise-modification.md
sed -n '1,180p' shared-skills/mission-control/references/promise-retirement.md
```

For quality parity or live judge review stamps, load only when relevant:

```bash
sed -n '1,180p' shared-skills/mission-control/references/quality-parity-evidence.md
sed -n '1,180p' shared-skills/mission-control/references/sufficiency-review-live-judge-stamp.md
```

## Contract Edges

A live Promise change is complete only when these edges are coherent:

1. Promise frontmatter and body: parent refs, aspects, Intent Checks,
   Acceptance Checks, status, lane, and prose.
2. Acceptance Check refs: frontmatter entry, body heading, description,
   evidence, optional `revision`, and semantic slug.
3. Evidence Ledger: source promises, applied aspects where relevant,
   v2 `acceptanceChecks`, `executionRefs`, `executions`, and an optional
   `review` pointer only when that ledger has actual review history.
4. Evidence target: deterministic test, live judge, or script named by the
   ledger.
5. Sufficiency Review, when the change requires a current qualitative verdict:
   a YAML entry with matching AC/Intent refs, `acReviewedRevision`, fixture,
   run commit, observed output, gaps, and verdict. Do not invent an empty
   sidecar or pointer for a ledger with no review history.
6. Implementation surface: code, tests, scenario refs, and `// @promise` /
   `// @aspect` / `// @check` tags.

## Contract Conflict Resolution

Resolve Story Chain conflicts semantically before resolving text. A merge or
rebase conflict in contract paths is not closed by choosing one side of the
diff; it is closed when every still-valid contract edge above remains coherent.

Classify each conflict hunk before editing:

- Human-owned meaning conflict: Experience, Moment, Promise existence/meaning,
  new Aspect meaning, or material Intent Check / Acceptance Check truth
  criteria differ between sides. Stop for Human authority even when a textual
  union looks plausible.
- Identity migration conflict: split, merge, rename, or retirement of Promise,
  Acceptance Check, Aspect, scenario, or ledger identity. Do not union old and
  new refs. Follow the approved migration/retirement path, update every stale
  ref, and require the `preserve` / `migrate-read-only` / `remove` stance when
  behavior is retired.
- Agent-owned propagation conflict: one side updated reciprocal refs, ledger
  rows, run evidence, surface tags, scenarios, or tests for already-approved
  meaning. Preserve compatible changes and repair the full chain rather than
  keeping only the hunk that validates locally.
- Shared-ledger or shared-surface conflict: different Promises can share one
  Evidence Ledger, Aspect pointcut, test, scenario, or tagged surface. Run the
  cross-impact scan before treating rows as independent additions.
- Evidence-currentness conflict: current ledger rows, executable checks, test
  names, and review YAML must match current code. Preserve old dated
  Sufficiency Review entries as history; add a new dated review when current
  evidence needs a new judgment instead of rewriting historical entries.

Automatic agent resolution is allowed only when the result is fully determined
by current approved contracts: independent rows with unique ids, reciprocal ref
repair, stale-ref cleanup, generated/check formatting, or evidence updates that
implement unchanged meaning. Stop when the conflict asks which product meaning,
truth criterion, compatibility stance, or identity should survive.

## Workflow

1. Classify the change:
   - new Promise or Promise meaning change;
   - Acceptance Check add/rename/delete/revision;
   - Evidence Ledger coverage or scope change;
   - Sufficiency Review entry change;
   - evidence-only propagation after an approved contract;
   - internal mechanism-only change with unchanged product meaning;
   - retrospective architecture-shaped clause normalization.
     For the last two cases, classify each affected clause as `KEEP`, `SPLIT`,
     `MOVE`, or `EVIDENCE` with
     `product-architecture-content-ownership.md` before editing Story Chain.
2. For retirements, choose the backward-compatibility stance from
   `shared-skills/mission-control/references/promise-retirement.md` before
   editing:
   - `preserve`: old user data, URLs, public API, integrations, or analytics
     history still work and have tests;
   - `migrate-read-only`: old stored data can still be read/rendered, but new
     writes or new user entry points are blocked;
   - `remove`: old behavior and dedicated infrastructure are deleted, with
     negative scans/tests where recurrence is likely.
3. Run a cross-impact scan for sibling Promises, shared ledgers, Aspect
   pointcuts, surfaces, tests, and scenarios. Classify rows as owning edits,
   inspect-only downstream impacts, compatibility-only shapes, or split
   cleanup. When the scan triggers propagation scope control, record the map
   and complete the early scope review before editing.
4. For a new or materially restructured core-product service bundle, verify the
   versioned Service Policy Coverage Matrix before drafting the Promise set.
   Verify required family and reference-entry coverage, exact-revision current
   observations, reconciliation, disposition, owner, and downstream refs.
   User-facing `owned` rows enter Story Chain; runtime, security/data,
   operational, and evidence policies stay with their canonical owners.
   `rejected` rows need Human rationale and a reopening condition. Stop on
   `unresolved`, and verify that the `core-product` Experience declares the
   Matrix-derived `servicePolicyCoverage` aggregate and local
   `servicePolicyCoverageReview` pointer. A Story Chain-owned row must cite its
   Source Promise and verification ref; do not turn non-user-facing policy into
   empty Promise prose.
5. If meaning changes, stop unless Human authority is explicit. Check the
   approved meaning against the `## 제품 원칙` section of
   `docs/product-identity.md`; if they conflict, surface the conflict to the
   Human decision instead of proceeding.
6. Before drafting or editing contract prose, check terminology. Use current
   Story Chain concept terms from `docs/contracts/story-chain/concepts.md` and
   `docs/mission-control.md`; use product-surface vocabulary from its owning
   Promise, Evidence Ledger, runtime-flow, or code surface when a repeated
   surface, state, owner, source, or behavior is already named. If the change needs a new repeated
   product-surface term, route to `glossary-steward` and register it with its
   owning Promise/Evidence Ledger/runtime-flow or code surface. If the new term
   changes product meaning, treat it as Human-owned meaning before propagation.
   Do not introduce a synonym for an existing contract behavior just to improve
   style.
7. Update the Promise and reciprocal refs together. Do not leave a Promise body
   ahead of its ledger, review, or tags.
8. For Acceptance Checks:
   - use semantic ids:
     `acceptance-check:<promise-slug>-<short-kebab-axis>`;
   - increment `revision` only when meaning changes;
   - update every old ref on rename or deletion;
   - avoid embedding Aspect-wide caps in the AC body.
   - keep an exact path or query key only when it is an intentional
     product-boundary truth criterion; put route parsing, serialization, and
     byte-budget mechanisms in their engineering/runtime owner and use
     Architecture Fitness only after CAIR when an active supported profile
     covers the selected structural rule.
9. For Evidence Ledgers:
   - keep ledgers narrow by coherent Promise group;
   - keep dated reviews in `evidence-ledgers/reviews/<ledger>.reviews.md`;
   - split ledgers that mix unrelated moments, lanes, or historical archives;
   - add parity evidence when an AC claims parity between surfaces.
   - give every `acceptanceChecks` entry a non-empty `executionRefs` list;
   - declare each referenced execution once under `executions` using `vitest`,
     `contract-check`, `guard`, or `registered-script`;
   - keep execution argv structured. Raw shell strings, shell operators, and a
     second execution list are invalid;
   - run the ledger-scoped dry-run after changing files or test-name selectors.
10. For Sufficiency Reviews:
    - write post-2026-05-06 reviews as real YAML blocks;
    - run the targeted evidence first;
    - preserve old dated entries as history instead of rewriting them to today's
      refs.
    - keep every YAML `acs` ref within the ledger's `Source Promises`; cite a
      related owner or ledger in prose instead of revision-syncing its ACs here.

11. Search for stale refs before closeout, but classify each hit before
    replacing it. A changed affordance, label, visible URL, lifetime, fallback,
    or degraded result can change product meaning and requires normal Story
    Chain propagation. A changed component owner, builder, scheduler, cache,
    gateway, function, endpoint, table, environment variable, or test name is
    usually an internal mechanism/evidence change and must not automatically
    rewrite Promise, AC, or Aspect prose.
    - Keep visible meaning in Story Chain and preserve ids when it is unchanged.
    - Move runtime and engineering mechanism to the canonical owner, leaving a
      stable ref only when readers need it.
    - Update exact tests, paths, commands, fixtures, and artifacts in the
      covering Evidence Ledger.
    - When existing prose mixes both kinds, use `SPLIT`; do not replace the old
      internal identifier with the new one in Human-authority prose.
      Contract prose must not describe removed visible behavior at closeout.
      Propagate visible meaning through Promise, Aspect, Evidence Ledger, and
      Code/Test in the same change. If required Human authority is missing, stop
      closeout and request it. The deterministic backstop
      `guard:ledger-citations` checks only that every
      ``vitest @ `file.test.tsx` ("name")`` citation resolves. A citation failure
      opens the ledger evidence for correction; it does not prove the AC or
      Aspect body should name the replacement test.
12. Scan the changed current-authority semantic cluster for negative and
    retired-shape rules. Use `docs/principles.md §6` and the shared
    `review-checklist-steward` `root-cause-09` rather than defining a Story
    Chain-only classification. For compatibility, also record `preserve`,
    `migrate-read-only`, or `remove` and name the surviving read/write boundary.

## Retirement Propagation Check

When a Promise, Moment, Experience, Aspect, or ambient/support surface is
retired, treat its previous category and compatibility stance as first-class
propagation edges. Search for empty containers created by the retirement,
including:

- routes and page modules associated with the retired contract;
- navigation entries, tabs, filters, headings, ledes, and i18n keys;
- tests importing the retired page or asserting the retired section still
  renders;
- Evidence Ledger v2 `acceptanceChecks`, `executionRefs`, `executions`, and
  named test filters;
- generated docs, scenario catalog rows, surface tags, and `// @promise` /
  `// @aspect` comments.

Then check the chosen compatibility stance:

- `preserve`: legacy paths must have explicit owner, tests, and current docs or
  comments that explain why they remain.
- `migrate-read-only`: new writes/routes/buttons must be blocked or removed,
  while old records still have fixture coverage.
- `remove`: routes, client constants, services, storage buckets, migrations,
  env vars, generated configs, jobs, analytics emitters, and tests dedicated to
  the retired behavior should be gone.

For prose, treat retired-feature absence as an implementation symptom, not the
contract's normal subject. Current rows should say which surface now owns the
workflow, which data source is authoritative, or which compatibility boundary
remains. Phrases like "do not resurrect", "do not render the old row", and
"keep the retired control out" belong only when the product meaning is a current
negative invariant, for example no stale-source fallback after live auth is
configured, or inside dated historical review notes.

Default to deleting empty containers. Only keep one when the user explicitly
approves a visible empty state as the product behavior, and then add
deterministic evidence for that empty state. Before closeout, run an `rg` scan
for the retired slug and for the parent scope/category name; explain any
remaining hits as active domain concepts, negative assertions, or unrelated
history.

## Review YAML Shape

```yaml
date: YYYY-MM-DD
acs:
  - acceptance-check:example-ac
  - intent-check:example-intent
acReviewedRevision:
  - 1
fixtureRef: path/to/test-or-fixture
runCommitSha: abc123def456
observedOutput: Single-line summary of the actual rendered/runtime output, at least 80 chars.
gaps:
  - adopt: Concrete resolved gap and how this change resolves it.
  - reject: Concrete excluded expectation and why it is outside this review.
verdict: met
```

Use `git rev-parse --short=12 HEAD` for `runCommitSha`. `verdict: met` requires
no open or deferred gap in that review.

## Validation

Close with the canonical contract closeout alias — its gate list is owned by
the `package.json` definition, so do not hand-pick a subset (issue #193):

```bash
npm run quality:contract
```

Also run every targeted test or live judge named by changed Evidence Ledger rows.
If review YAML changed, include:

```bash
npx vitest run app/server/services/story-chain/__tests__/review-parser.test.ts
```

If release status or Aspect verdict coupling is affected, also run:

```bash
npm run mc:status
```
