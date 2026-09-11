# Review Checklist Steward — Default Checklist

Read this file completely before applying the checklist in a review loop.
Filter it by the files and contracts touched in the current review. Prefer
entries whose `surface`, `trigger`, `severity`, or `lastSeen` match the work.
Skip entries marked `covered`, `retired`, or `workflow` when calculating the
active review set. `workflow` entries are procedures owned by `SKILL.md`, not
finding checks. Reopen a `covered` or `retired` entry only when the current
owner no longer covers the risk or the retired surface becomes current again.

## Entry Shape

Every entry has a stable id of the form `<group>-NN`, shown as the inline code
prefix of its bullet. Ids are never renumbered: a new entry takes the next
unused number in its group, and a retired entry keeps its id with
`status: retired`. All entries below are `status: active` unless marked
otherwise. When an entry does not state its own `trigger`, the group heading's
scope is the trigger. `frequency` and `importance` accumulate from per-entry
hits in the usage log; do not invent them at authoring time.

When adding or updating an entry, use this lightweight shape in prose or a
compact metadata line:

```text
id:
surface:
trigger:
check:
severity: low | medium | high
frequency:
importance:
lastSeen:
validation:
status: candidate | active | covered | retired | workflow
```

Use `frequency` for how often reviewers hit it and `importance` for how harmful
it is when missed. High-importance findings can stay active even if rare.

## Usage Records and Hit Rate

After each review loop that applied this checklist, append one review record to
[checklist-usage-log.md](checklist-usage-log.md):

```text
YYYY-MM-DDTHH:MM | repo: <owner/name> | pr: <#NNN, or local> | head: <reviewed commit sha, +dirty when uncommitted changes were reviewed> | role: <reviewer role> | author-model: <canonical-model-id(s)-or-human> | review-model: <canonical-model-id(s)-or-human> | verdict-model: <canonical-model-id(s)-or-human> | surface: <scope-frozen reviewed surface> | workstream: <stable issue, PR, or task id> | workstream-root: <canonical repository task id> | applied: <group ids> | excluded: <relevant lens skipped: reason, or none> | round: <discovery-sweep | exact-head-certification> | design-cycle: <positive integer> | iteration: <1-5> | reset-from: <none | retired-state identity> | countermeasure-from: <none | restart record id> | reason: <initial entry or rerun reason> | cluster: <stable semantic-cluster name, or none> | sweep: <inspected owner/path and history exclusions, or none> | hit: <entry-id: short finding, …, or none> | findings: valid N, invalid N, already-fixed N, duplicate N, needs-human N | validation: <commands that ran and execution owner, or none> | closeout: <clean | findings remain | stale> | gap: <valid finding no current entry named, or none>
```

- `head` is the exact commit the review actually read. A review record proves
  review only for that head; it says nothing about later commits.
- `role` names the reviewer role that ran this loop (for example
  `implementation-author`, `independent-subagent`, `code-authority`,
  `contract-evidence`, `branch-review-response`).
- `author-model` identifies the model that produced the reviewed implementation
  or prose. `review-model` identifies the model that performed this record's
  reviewer role. `verdict-model` identifies the model that classified findings,
  interpreted the named validation evidence, and certified the closeout state.
  Use the canonical model id reported by the execution surface, not a moving
  alias such as `opus` or `latest`. Use `human` when that role was performed
  without a model. If materially distinct models shared one role, join their
  canonical ids with `+`. New records may not use `none`, `unknown`, `n/a`,
  `na`, `tbd`, or an unfilled template placeholder for these fields. The gate
  rejects those named aliases and malformed identifier components; confirming
  that a syntactically valid id names the model actually used remains
  reviewer/Human-owned.
- `workstream` is stable across branches, reviewer changes, commits, and design
  cycles. `workstream-root` is the canonical sequence identity. Use
  `repo:<owner/name>#issue:<number>` when an issue owns the outcome; otherwise
  use one durable repository task id. A branch, PR, task label, or alias does
  not create a new root.
- `applied` lists the group ids (the `###` headings below) that were in the
  filtered set for this review. The exact active entry set for those groups is
  the one in this file at the commit that adds the record, so per-entry applied
  sets stay derivable without listing every id. New records may name only
  current `###` group ids. The closeout gate rejects historical or invented
  labels prospectively; unchanged base and archive records keep their original
  labels.
  Use these prospective replacements for labels still present in historical
  records:
  - `quality-gates` → `code` + `architecture`; add `skills-governance` only
    when agent-process routing or review policy also changed.
  - `runtime-flow` → `architecture`; add `story-chain` when user-facing
    contract meaning also changed.
  - `security/privacy`, `security-boundary`, `server-load` →
    `load-security`.
  - `contract`, `evidence` → `story-chain`.
  - `UI-style` → `code`, plus `loading-ui` only for loading/pending state.
  - `korean-prose` is a writing workflow, not a review lens; record the
    affected current surface group instead.
- `excluded` names each relevant lens that was skipped and why. Use `none` when
  no relevant lens was skipped. Irrelevant lenses are not exclusions.
- `round` distinguishes broad `discovery-sweep` from bounded
  `exact-head-certification`.
- `design-cycle` starts at `1` for an implementation design and increments only
  after `SKILL.md` § Five-Iteration Design Reset retires that design.
- `iteration` is shared by every role reviewing the same implementation state.
  Increment it only after a correction changes that state. Evidence-only or
  record-only checks reuse the current number. Iteration five with any new
  `valid` finding closes as `findings remain` and retires the design; the same
  design cannot receive iteration six.
- `reset-from` is `none` in the first design cycle. Later cycles must reference
  the exact `retired-state` from the preceding `design-reset` record. A new
  cycle number without that record and identity is invalid review evidence.
- `countermeasure-from` is `none` until the three-cycle stop applies. A
  Human-authorized post-stop cycle must name the exact
  `countermeasure-restart` activation record.
- `reason` names the initial entry or rerun cause, such as
  `semantic-drift:<cluster>`, `scope-reopened:<cluster>`, or `evidence-only`.
- `cluster` is a short stable name for the semantic cluster that triggered the
  sweep; use `none` when no semantic cluster was involved.
- `sweep` summarizes the canonical owner and paths inspected plus any
  historical/archive exclusions. It is procedural evidence, not a claim that
  semantic judgment was mechanically complete.
- `hit` names the individual entry ids whose check caught a `valid` finding.
  Both a comma-separated id list (`code-04, architecture-16`) and
  `entry-id: short finding` items are valid historical/current syntax; audits
  count every stable entry id token rather than depending on the optional
  description. The same id may appear more than once when it caught distinct
  findings, and description prose may contain semicolons. New records may name
  only active or workflow entry ids at HEAD; the closeout gate rejects covered,
  retired, candidate, historical, or invented hit ids prospectively. Audits
  keep workflow hits separate from finding-check hit rates. Historical hit ids
  use their current owner:
  - `security/privacy-01` → `load-security-03`.
    Use `none` when the applied groups caught nothing.
- `gap` records a valid finding that no current entry named — this is the
  input for a new or updated entry, added in the same loop.
- `closeout` records the status derived for this exact head. The merge-path
  gate accepts only the latest matching non-dirty record when it says `clean`
  and reports `findings: valid 0`; reviewer-role completeness and valid escape
  resolution remain Human-owned until those sets are machine-readable.

Records created before the Issue #441 metadata extension remain valid in their
original format. The four Issue #441 metadata fields and the later
`workstream` / `design-cycle` / `iteration` / `reset-from` fields are required
only for records created after their respective process changes; they do not
retroactively invalidate canonical or archived history. They remain procedural
evidence: merge-path enforcement continues to derive only the exact content
head, valid-finding count, and closeout state unless `quality-gate-steward`
explicitly changes that contract.

`workstream-root` and `countermeasure-from` are required only for records
created after the `three-cycle-countermeasure-stop-v1` policy-effective
revision. Earlier review records retain their original validity.

Issue #504 adds `author-model`, `review-model`, and `verdict-model`
prospectively. `scripts/quality/check-review-closeout.mjs` compares the
canonical usage log at the declared base with `HEAD` and requires all three
fields on every newly added review record, including a backdated line or a
`+dirty` record. Unchanged canonical records and immutable archive records keep
their original validity without model fields. This attribution extension does
not change exact-content-head, valid-finding, or closeout verdict semantics.
Machine enforcement rejects `opus` and `latest` as moving aliases and requires
each `+`-joined component to be `human` or a minimally well-formed identifier;
it does not maintain a registry of provider model ids.

When iteration five has a new valid finding, append one reset record after the
fifth-iteration `findings remain` records and before any replacement
implementation:

```text
YYYY-MM-DDTHH:MM | design-reset | record-id: <stable reset id> | repo: <owner/name> | workstream: <stable id> | workstream-root: <canonical repository task id> | retired-cycle: <positive integer> | retired-state: <published commit sha> | retired-ref: <shared workstream, PR, or forensic ref> | trigger: iteration-5-valid | compatibility: <artifact@canonical-owner=verdict, …; verdict is preserve / migrate-read-only / remove> | preserved: <requirements, decisions, counterexamples, current-authority sweep, and history exclusions> | discarded: <implementation paths and implementation-shaped tests> | cause: <invalid design assumptions and review gaps> | replacement-owner: <canonical sources for fresh design> | validation: <remote identity, matching iteration-five findings-remain record, compatibility, and scope checks>
```

The reset record is procedural evidence, not a closeout record. Reviewers of
the next cycle verify that its `reset-from` matches `retired-state`, every
reviewer can resolve `retired-state` through `retired-ref` from the shared
repository,
protected/deployed/persisted/public artifact has a compatibility verdict and
canonical owner, discarded implementation seams were not copied, and preserved
inputs are implementation-independent. `scripts/quality/check-review-closeout.mjs`
continues to ignore this record; automated enforcement would be a separate
`quality-gate-steward` decision.

The new `record-id` and `workstream-root` fields apply to resets created after
the three-cycle policy-effective revision. Older reset records keep their
original validity. A later stop record may reference an older reset by its
timestamp, exact retired state, and published ref.

When one root accumulates distinct, qualifying, chained resets for cycles one,
two, and three, append this stop record before any cycle-four implementation.
For a grandfathered workstream, append it after the allowed cycle retires and
before any later cycle:

```text
YYYY-MM-DDTHH:MM | countermeasure-stop | record-id: <stable stop id> | repo: <owner/name> | workstream: <stable id> | workstream-root: <canonical repository task id> | trigger: <third-iteration-5-valid | grandfathered-next-iteration-5-valid | post-countermeasure-iteration-5-valid> | reset-records: <every counted cycle reset id or timestamp+state@ref> | prior-countermeasure: <none | preceding restart record id> | chain-validation: <unique retired states, iteration-five findings-remain records, and reset-from links> | status: implementation-stopped | next: human-countermeasure-meeting
```

Every Human meeting outcome uses this decision record:

```text
YYYY-MM-DDTHH:MM | countermeasure-decision | record-id: <stable decision id> | repo: <owner/name> | workstream-root: <canonical repository task id> | stop-record: <stable stop id> | convergence-failure: <why all retired designs named by the stop did not converge> | recurring-causes: <invalid assumptions, owner-boundary errors, and review gaps across those designs> | options-considered: <abandon, split, change requirements or ownership, obtain evidence or dependencies, new design> | disposition: <abandon | split | restart-later> | countermeasures: <selected requirement, ownership, evidence, dependency, implementation, and review changes> | cause-action-owners: <cause=action@owner, …> | restart-conditions: <measurable conditions or none> | child-workstreams: <none | child root + non-overlapping outcome, requirements, and scope delta> | human-approval: <durable approval ref>
```

`disposition: split` creates an independent child count only for the
Human-approved non-overlapping outcome and scope delta recorded here. A renamed
or relabeled version of the same outcome remains under the stopped root.
`disposition: restart-later` does not itself permit implementation. After every
condition is satisfied, append this activation record:

```text
YYYY-MM-DDTHH:MM | countermeasure-restart | record-id: <stable restart id> | repo: <owner/name> | workstream-root: <canonical repository task id> | stop-record: <stable stop id> | decision-record: <stable decision id> | condition-evidence: <condition=evidence ref, …> | activation-approval: <durable Human approval ref> | restart-cycle: <next positive integer> | reset-from: <latest retired-state>
```

The next cycle may start only after this activation record exists. Its number
must immediately follow the latest retired cycle. Its iteration-one review
records use this `record-id` in `countermeasure-from`.

If that restarted cycle later retires at iteration five with a new valid
finding, append a new stop record with
`trigger: post-countermeasure-iteration-5-valid` and the preceding activation
in `prior-countermeasure`. Repeat the meeting and issue fresh decision and
activation records. Earlier records cannot authorize another cycle.

This transition record defines the prospective boundary:

```text
YYYY-MM-DDTHH:MM | process-policy-transition | policy: three-cycle-countermeasure-stop-v1 | status: effective-on-protected-main | grandfather-records: <record ids already present in this revision or none> | rationale: <durable Human decision ref and why three retired designs require escalation>
```

The policy-effective revision is the first protected-main commit containing
that transition line. Only grandfather records present in that revision count:

```text
YYYY-MM-DDTHH:MM | countermeasure-grandfather | record-id: <stable grandfather id> | policy: three-cycle-countermeasure-stop-v1 | repo: <owner/name> | workstream: <stable id> | workstream-root: <canonical repository task id> | allowed-cycle: <already-started cycle> | cycle-start: <published commit@shared ref> | reset-from: <preceding retired-state> | allowance: complete-named-cycle-only | human-approval: <durable approval ref>
```

Pre-effective qualifying resets still count. A grandfathered cycle may finish,
but its iteration-five retirement stops the workstream before any further
cycle. These records are procedural evidence, not review closeout records. The
closeout parser ignores them. Implementation owners and reviewers enforce the
stop; automated chain enforcement would require a separate
`quality-gate-steward` decision.

When a later external or independent signal — a CodeRabbit thread, a human
reviewer, an incident, a later review — surfaces a finding for a head that
already has review records, triage it and append an escape record:

```text
YYYY-MM-DD | escape | pr: <#NNN> | head: <sha> | source: <coderabbit | human | incident | other> | classification: <valid | invalid | already-fixed | duplicate | needs-human-decision> | finding: <short> | entry: <active/workflow entry id | candidate:stable-entry-id | none for non-valid classification>
```

Escape records are the measurement corpus for issue #318: valid escape rate is
computed from them, generated-copy duplicates link to their canonical defect
via `duplicate`, and each `valid` escape must add or update a checklist entry
in the same triage. When no active/workflow entry fits, use
`candidate:<stable-entry-id>` and add that `status: candidate` entry in the
same HEAD; `entry: none` is not valid feedback closure. The closeout gate
enforces this rule only for newly added valid escapes, preserving base and
archive history. A `covered` entry maps to its absorbing owner, and a `retired`
entry must be reopened or replaced before it can receive new valid feedback.
CodeRabbit is a reference signal and escape source here, not closeout authority.

Review-closeout status (`clean` / `findings remain` / `stale`) is derived from
these records, never asserted as free prose: `clean` holds only when every
relevant reviewer role has a review record at exactly the current head and no
valid findings or valid escapes remain unaddressed; a new commit or merge makes
prior `clean` claims `stale`; otherwise findings remain. Machine enforcement of
this status on the merge path is owned by `quality-gate-steward` (issue #318).

The periodic skill review (`skill-governance-steward`) computes hit rate per
group and per entry id from this log. A group or entry with `applied >= 8`
and zero hits stays active only if its `importance`/`severity` is high;
otherwise mark it `covered` or `retired` and record the decision.
Freeze the three model-role cohort with each audit. A change to the author,
review, or verdict model generation reopens covered/retired lens review;
model-specific rates require one full quarterly cohort rather than a partial
prospective sample.

Append new records to the canonical log without a fixed record limit or
size-triggered compaction. The existing `docs/archive/` usage-log files remain
immutable history, but no new archive is required merely because the canonical
log grows. `scripts/quality/check-review-closeout.mjs` continues to read only
the canonical log as merge authority. Revisit storage only when measured
repository or parser cost justifies a separate process decision.

- Records dated before 2026-07-15 use the older group-level format; treat them
  at group granularity when computing hit rates.

## Groups

### root-cause — apply before the surface-specific checklist

- `root-cause-01` `status: workflow` — root-cause tracing is owned by
  `SKILL.md` § Review Loop classification and correction.
- `root-cause-02` Review the owner boundary that should have prevented the
  defect: builder, domain-access method, runtime-flow step, contract artifact,
  validator, or quality gate.
- `root-cause-03` If the same fix must be repeated across call sites, search
  for the missing shared owner or single source of truth before patching each
  site.
- `root-cause-04` `status: workflow` — symptom-versus-owner correction is
  owned by `SKILL.md` § Review Loop classification and correction.
- `root-cause-05` `status: workflow` — loop completion while a causal path is
  open is governed by `SKILL.md` § Review Loop.
- `root-cause-06` On the first valid semantic-drift finding, inventory and
  sweep the whole current-authority semantic cluster before another scope
  freeze. Check the approved decision, canonical owner, adjacent canonical
  docs, runtime-flow, Evidence Ledger, tests, current operational/PR prose,
  derived docs, and validation fixtures; record search terms and justified
  historical/archive exclusions. Correct the cluster as one causal batch.
  A new valid semantic drift during exact-head certification reopens discovery
  and requires a later same-head `findings remain` record when an earlier
  `clean` record already exists, so the canonical parser cannot keep accepting
  the stale certification
  (severity: medium, lastSeen: 2026-07-20, validation: preserve both legacy and
  Issue #441 metadata review-record fixtures while exact-content-head
  enforcement stays unchanged).
- `root-cause-07` `status: workflow` — the five-iteration ceiling, mandatory
  implementation retirement, compatibility verdict, immutable reset record,
  preserved design inputs, and new-cycle restart are owned by `SKILL.md`
  § Five-Iteration Design Reset.
- `root-cause-08` `status: workflow` — the mandatory implementation stop after
  three design cycles retire at iteration five, Human countermeasure meeting,
  and approved restart record are owned by `SKILL.md`
  § Three-Cycle Countermeasure Stop.
- `root-cause-09` When changed current-authority prose, tests, or guards use
  negative or retired-shape rules, start from the allowed behavior and current
  owner, then classify each relevant semantic hit as `KEEP`, `SPLIT`, `MOVE`,
  `EVIDENCE`, or `STALE`. `KEEP` only when absence itself is a current safety,
  privacy, security, source-of-truth, compatibility, non-interference, or
  epistemic guarantee. Use `SPLIT` when one rule mixes owners, states, or
  current behavior with history; `MOVE` for mechanism, rejected alternatives,
  or retired history owned elsewhere; `EVIDENCE` when phrase presence or
  absence should become behavior, capability, or state-transition proof; and
  `STALE` when an old name or shape is the only thing being locked. Exclude
  archives and dated immutable history unless they claim current authority.
  Do not replace this semantic review with a repository-wide phrase-count
  lint. Sweep the changed semantic cluster and consolidate the rule at its
  current owner
  (severity: medium, lastSeen: 2026-08-13, validation: owner-first current
  behavior assertions plus retained safety/privacy/non-interference negative
  controls).

### code — baseline checks whenever the reviewed work touches code

- `code-01` `status: workflow` — changed-file and call-site inspection is a
  required Review Loop preparation step.
- `code-02` Verify the behavior path from input to consumed output, including
  data flow, owner boundary, imports, serialization boundary, and persistence
  mapping when present.
- `code-03` Check error, empty, loading, retry, cancellation, and async cleanup
  paths that the changed code can affect. For client transitions, include
  mounted success-state release, mutable-store versus server-prop freshness,
  and rejected lazy imports that could leave UI state stuck or create an
  unhandled rejection.
- `code-04` Check whether tests or guards assert the user-visible behavior or
  runtime contract, not only implementation details. When a shared policy
  constant is itself contractual, pin its value independently instead of
  comparing production output only with the same imported constant.
- `code-05` Search for dead code, duplicate branches, stale helper names, and
  unused constants introduced or exposed by the change.
- `code-06` `status: workflow` — relevant TypeScript definition, reference,
  call-site, and diagnostic inspection is owned by `SKILL.md` § Review Loop.

### load-security — database access, server hot paths, public endpoints, auth, provider fan-out, background work, operational evidence, security/privacy boundaries

- `load-security-01` Database-load review: check whether the change adds DB
  reads/writes, broadens query cardinality, removes owner-shaped predicates,
  adds history-proportional scans, or moves repository access before first
  paint. Prefer purpose-named repository queries with identity-shaped
  predicates over list-then-filter code.
- `load-security-02` Server-load review: check route `maxDuration`, request
  abort propagation, provider/API fan-out, retry windows, queue/concurrency
  limits, bundle or lazy loading effects on hot paths, whether a dynamic
  renderer needs pending-state preload to avoid a data-ready chunk waterfall,
  and whether work is repeated per request, per card, per result, or per
  browser retry.
- `load-security-03` Security/privacy review: check auth and ownership
  boundaries, public or semi-public POST endpoints, input schema and
  allowlists, rate/source-window limits, server-derived actor identity,
  secrets/API keys/env vars, token/header forwarding, SSRF through
  user-controlled URLs, request body size or payload-amplification DoS,
  CSRF/origin checks for cookie-backed mutations, cache/privacy headers, raw
  query/PDF/AI-output handling, sink durability, and whether
  logs/analytics/errors can expose sensitive content. For every new or changed
  rejection cap or bounded ingress, exercise the actual composition boundary
  and prove that the current canonical producer's normal maximum (`max-valid`)
  is accepted while `max+1` is rejected. If there is no canonical producer or
  its maximum is undefined, record why this check is not applicable and what
  bounded evidence substitutes for it
  (severity: high, lastSeen: 2026-08-05, validation: production-shaped
  producer-to-ingress composition fixture covering `max-valid` and `max+1`).
- `load-security-04` If the change creates or changes a public ingress,
  external provider fan-out, DB/durable-sink fan-out, operational evidence
  source, authenticated route that reads or mutates user data, authorization
  boundary, PII/sensitive-content exposure path, or sensitive logging path,
  compare it with `docs/operational-readiness.md` §5 and add or update an
  operational boundary row when the registered risk axes, controls, or
  evidence needs changed.
- `load-security-05` `status: workflow` — risk-owner gate selection and honest
  scope are owned by `SKILL.md` § Review Loop validation.

### overengineering — new abstractions, helper layers, configuration knobs, feature flags, broad refactors, generalized framework code

- `overengineering-01` A new abstraction should remove current complexity,
  reduce meaningful duplication, or match an established local pattern. If it
  only anticipates a possible future caller, future provider, or future mode,
  ask whether the simpler current implementation should stay inline.
- `overengineering-02` Prefer reducing or reshaping an existing abstraction
  before adding more guards, negative advice, or policy text around it.
  `docs/principles.md §6` makes abstraction reduction the first check; guard
  accumulation is the fallback after that review. Apply `root-cause-09` when
  the changed cluster already contains negative or retired-shape rules.
- `overengineering-03` New files, seams, or helpers should have a clear owner,
  call site, and validation path. If the split mostly increases import hops,
  test surface, or documentation burden without simplifying the runtime, flag
  it as possible overengineering.
- `overengineering-04` Configuration knobs, environment variables, strategy
  objects, and extension registries should correspond to a present
  product/runtime decision. Do not accept speculative switchboards whose
  branches are untested or unused.
- `overengineering-05` A correction should close the defect's cause at its
  owner boundary. If the change expands into unrelated cleanup, naming, or
  architecture reshaping after that cause is closed, ask for an explicit scope
  decision.
- `overengineering-06` When Mission Control requires a Propagation Map, run the
  scope review before implementation. Verify the named owner bundle, required
  code/test paths, inspect-only downstream owners, compatibility shapes, split
  cleanup, and file/churn budget. Trigger a Human checkpoint when the map's
  maximum or the canonical thresholds are exceeded, a new lifecycle appears,
  five unplanned files enter through one correction, or scope grows after the
  second review round. Treat these thresholds as advisory; a justified large
  migration may continue after explicit approval
  (severity: high, lastSeen: 2026-07-22, validation: durable `## Propagation
Map` plus the early-scope review record).

### architecture — runtime boundaries, data access, persistence/sync ownership, provider gateways, route handlers, server/client imports, document types, cross-cutting constants

- `architecture-01` Compare the diff against `docs/principles.md`,
  `docs/conventions.md`, and `docs/infrastructure.md` before calling an
  architecture finding valid. Review comments should name the violated
  boundary, not just a personal style preference.
- `architecture-02` Preserve the data-access layering from
  `docs/principles.md §5` and `docs/conventions.md §3-§4`: page/route/server
  entrypoints should not import repository directly; `domain-access` owns
  ownership-checked access and storage path composition; services own external
  API calls, payload transformation, and pure logic; repositories stay
  low-level DB access.
- `architecture-03` When a diff adds or moves DB access, review the source
  timing decision, not only the import layer. A route/runtime hot path live DB
  read or write needs a recorded reason for rejecting preloaded snapshots,
  cache updates, background sync, or defer. Missing freshness, invalidation,
  fallback, or source-owner reasoning is an architecture finding even when the
  layering is technically valid.
- `architecture-04` Preserve Next.js boundaries from `docs/principles.md §4`
  and `docs/conventions.md §1`: Client Components should not import
  `app/server/**`, server-to-client props must be serializable, and route
  handlers belong in `app/**/route.ts` without a sibling `page.tsx` in the same
  segment.
- `architecture-05` New or changed persistent fields must close the full path
  named in `docs/infrastructure.md`: domain schema, DB/repository mapping,
  server/client creation, UI consumption, and test/evidence. TypeScript
  success alone does not prove data flow.
- `architecture-06` Runtime fallback order, provider/API boundary,
  persistence/sync ownership, or debugging-signal changes should update the
  relevant `docs/runtime-flows/**` page and, when user-facing behavior
  changes, the Story Chain/Evidence Ledger.
- `architecture-07` Cross-cutting values should use the repository's
  centralization seams from `docs/conventions.md §9`
  (`app/lib/api-routes.ts`, `AppError`/error catalog, i18n message keys,
  shared constants). Parallel literals or nominal constants that production
  does not consume are review findings; remove a nominal constant if the
  production render path intentionally owns a different value.
- `architecture-08` `status: covered` — the general identity-shaped query
  review is integrated into active `load-security-01`; existing guards cover
  only their named hot-path, repository-seam, and least-authority scopes.
- `architecture-09` When several call sites hand-assemble the same request
  body, URL, or config, a parameter added for one flow must be wired into
  every call site or the assembly must be centralized into one builder the
  sites share. Review the call sites that do NOT appear in the diff —
  parameter drift is invisible in the diff of the site that gained the
  parameter (`libraryContextAvailable` reached the main search bar in #179 but
  missed the three follow-up handlers until 2026-07-03; the entry-URL model
  now centralizes assembly in `documentSearchPageRoute`) (severity: medium,
  lastSeen: 2026-07-04).
- `architecture-10` When a dedup, cache, freshness, or stale-commit identity
  represents a payload that is validated or transformed before transport,
  derive the identity from the canonical transported payload. Do not carry a
  mutable payload and its precomputed identity as independently writable
  fields. Schema transforms such as trimming can otherwise make two
  provider-equivalent payloads trigger different work, or let the payload/key
  pair drift (severity: medium, lastSeen: 2026-07-12, validation: add a
  fixture whose raw and canonical forms differ but serialize to one
  transported projection).
- `architecture-11` A state-boundary completeness claim must inventory every
  production owner and writer for the declared authority, carrier, and
  canonical identity. Required snippets or one healthy path are insufficient:
  add negative mutations that preserve the healthy path while introducing a
  competing authority, identity, or writer, and require the guard to reject
  them (severity: high, lastSeen: 2026-07-14, validation: add one
  parallel-path mutation per declared boundary).
- `architecture-12` Canonical-identity evidence must vary required state and
  forbidden state independently, compare the resulting identities, and prove
  that the named test file actually ran. A successful aggregate test command
  is not identity evidence when the runner omitted or never collected the
  intended file (severity: high, lastSeen: 2026-07-14, validation: assert
  required-state change, forbidden-state stability, a known collision pair,
  and report-file membership).
- `architecture-13` `status: covered` — shared inline analysis now generates
  each paper independently and its regression tests own companion isolation.
- `architecture-14` `status: workflow` — intentional exceptions must name an
  owner and validation route during Review Loop scope and correction.
- `architecture-15` New or edited doc statements that pin a threshold, gate
  semantic, or placement rule must be checked against the code that already
  enforces it and against current violations before the doc lands. A doc that
  invents a looser or stricter number than the enforcing rail, or states an
  absolute rule the codebase already violates, is born drifted — cite the
  enforcing source (verdict function, guard script) in the doc, or change the
  code in the same diff, and name surviving violations as explicit exceptions.
  An operational-readiness draft wrote ready-with-papers ≥ 90% while
  `getCohortGoNoGoVerdict` (`scripts/load-smoke/metrics.ts`) only passes 100%,
  and a new `app/lib` purity rule ignored the existing `llm-judgment.ts`
  runtime server import until review caught both (severity: medium,
  lastSeen: 2026-07-04, validation: read the named rail/guard source next to
  the doc diff).
- `architecture-16` Architecture evidence labeled as a test or guard must come
  from executing the declared command against the exact target revision.
  Test-file existence, source hashing, or a hard-coded zero exit code is not
  execution evidence. Bind the collector to the guard implementation it
  delegates to, record the actual exit and a normalized output digest, and
  degrade completeness to `partial` or `unknown` on execution failure
  (severity: high, lastSeen: 2026-07-13, validation: inject a failing or
  bypass fixture and prove the assessment cannot become `healthy`).
- `architecture-17` Exact-revision symbol inventories must bind their compiler
  host, current directory, and module resolution to the materialized target
  tree. A guard that reads target files but resolves protected symbols against
  the reviewer's checkout fails closed today and can silently misclassify
  future evidence (severity: medium, lastSeen: 2026-07-14, validation: run the
  guard in a temporary revision root with the repository's `tsconfig.json` and
  no synthetic `baseUrl`).
- `architecture-18` Protected Architecture Fitness authority belongs only to an
  operator-requested exact-main rebind after the change is protected. Its
  workflow SHA and target SHA must match, the target workflow·collectors own
  collection, and the first parent is only the comparison baseline. Do not
  require previous-main collector identity or create bootstrap/bridge PRs.
  Product PRs remain blocked by the fast least-authority·state-boundary guards
  and exact-head review (severity: high, lastSeen: 2026-07-21, validation:
  collector-only identity rotation can merge through normal PR gates, while a
  dispatch whose workflow SHA differs from the protected target fails before
  raw observation collection; enforcing sources:
  `.github/workflows/architecture-fitness-attestation.yml`,
  `scripts/architecture-fitness/lighthouse-trust-policy.mjs`, and
  `package.json` `quality:guards`).
- `architecture-19` A guard that verifies a declared inventory (gate status,
  required contexts, freshness lanes, workflow files) must fail on undeclared
  new members and on an empty declaration. Scanning only the currently known
  container (a hardcoded workflow file) or accepting a zero-length declaration
  silently reverts the guarantee to "checks nothing" as the surface grows
  (severity: medium, lastSeen: 2026-08-14, validation: add an undeclared
  fixture member and empty the declaration; both must fail — enforcing
  sources: `scripts/quality/check-gate-parity.mjs`,
  `scripts/quality/check-lane-freshness.mjs`).

### loading-ui — loading, pending, or temporary card states

- `loading-ui-01` One screen-level live region is enough. Do not repeat
  `role="status"` / `aria-live` on every card when a header or document-level
  status already announces progress.
- `loading-ui-02` Temporary non-action states such as `PDF 확인 중` should be
  non-interactive chips/spans, not disabled buttons. Keep disabled buttons for
  final unavailable actions only when that is the established UI pattern.
- `loading-ui-03` Loading visuals should not look like empty inputs, broken
  fields, or error skeletons. Prefer named progress states and restrained
  motion.
- `loading-ui-04` Spinner/ring indicators must be `aria-hidden` when adjacent
  text already names the state.
- `loading-ui-05` Tests should assert the user-visible copy and the semantic
  shape that matters: placement outside action rows, live-region count,
  non-button temporary states, and absence of removed skeleton test ids.

### async-client — async client transitions, dynamic imports, lazy analytics/auth chunks, route-submit pending states

- `async-client-01` `status: covered` — integrated into `code-03`.
- `async-client-02` `status: covered` — integrated into `code-03`.
- `async-client-03` `status: covered` — integrated into `code-03`.
- `async-client-04` `status: covered` — integrated into `load-security-02`.

### observability — observability callbacks, timing recorders, analytics sinks, diagnostic hooks

- `observability-01` Diagnostic hooks must not alter domain state or route
  success/failure. Wrap observer failures or otherwise prove a sink exception
  cannot turn a ready domain transition into a failed/degraded one.

### analytics — analytics, canonical events, `events.yaml`, `trackCanonicalEvent`, event validator wiring

- `analytics-01` New or changed canonical events should have at least one
  router-level test against the real `docs/analytics/events.yaml` contract
  when the runtime payload shape is new. Mock-only emitter tests that assert
  event names do not prove actor type, subject allowlist, required properties,
  or forbidden properties match the contract.
- `analytics-02` Event `source`, phase, and timing properties must match every
  emit path that reuses a handler. Retry/resend/confirm-step success should
  not be silently counted as an initial submit/source; tests should assert
  payload source for retry paths, not only event order.
- `analytics-03` Runtime emitted-event validators should reject direct
  canonical calls with dynamic event names unless that boundary is
  intentionally a router/API entry point. Literal event names keep
  `events.yaml` coverage and code search aligned.
- `analytics-04` Helper functions named for one branch of a union event should
  narrow the discriminating payload literal for that branch. For example,
  add/remove wrappers over one toggle event should not both accept either add
  or remove payloads while still type-checking.
- `analytics-05` If an event validator scans runtime source beyond staged
  contract files, the nearest commit-time quality gate should run that
  validator or explicitly document why the protection starts only at
  pre-push/CI.
- `analytics-06` New or rebuilt product event names, vendor sink identities,
  subject/property keys, and enum taxonomy tokens must follow the naming
  authority in `docs/analytics/README.md`. Verify legacy exceptions against an
  exact compatibility inventory owned by
  `app/server/services/analytics/event-contract-validation.ts`; a broad
  namespace or prefix must not grandfather newly added names.
- `analytics-07` For every retired, merged, or replaced event, map the previous
  Promise coverage, runtime writer, stored/read compatibility, vendor history,
  and replacement owner. Require zero uncovered current product Promise impacts,
  prevent accidental dual counting, and verify any intentional transition
  window follows the recorded compatibility verdict and CAIR/Propagation Map.
- `analytics-08` Compare `emission.cardinality` and `identityKeys` with runtime
  reopen, rerender, retry, and navigation behavior. Add a negative transition
  case when repeated UI states could emit again, and verify subject/property
  copies of the same identity cannot disagree at the router.
- `analytics-09` Every collected property must name the concrete decision it
  supports. Reject circular purpose prose and remove high-cardinality or
  sensitive metadata when an existing stable identity can answer the same
  question; key allowlists alone are not a privacy justification.
- `analytics-10` Reconstruct at least one declared journey end to end and verify
  that context joins across submit, viewed, action, and final outcome boundaries.
  Direct/new-tab fallback must not impersonate submit, and System Delivery Trace
  events must not be counted as user journey or Product Outcome events.

### pagination — paginated fetch loops, cursor restart paths, retry windows, loop progress guards

- `pagination-01` Restart/retry paths must reset every per-attempt loop guard
  that depends on prior pages, such as seen-cursor sets, page counters,
  empty-page counters, or duplicate-progress sentinels.
- `pagination-02` Add a regression case where the restarted attempt
  legitimately reuses a cursor/value from the failed attempt and still
  continues to the next page.
- `pagination-03` Infinite-loop guards should degrade by stopping or throwing
  explicitly; they should not silently drop already accepted pages unless the
  contract says the failed attempt is discarded.

### layout-constants — shared layout constants and centralized UI policy values

- `layout-constants-01` `status: covered` — integrated into `code-04`.
- `layout-constants-02` `status: covered` — integrated into `architecture-07`.

### skills-governance — repo-local skills, skill routing, agent-process governance

- `skills-governance-01` If a skill starts owning a new process surface, update
  its frontmatter description and the `docs/agent-skills.md` First-Route table
  so future agents can discover the route before reading the body.
- `skills-governance-02` If a new route overlaps an existing steward, state
  the precedence or sequencing rule explicitly. For example, verification-gate
  semantics and CI wiring remain with `quality-gate-steward` unless the change
  also alters agent routing or workflow ownership taxonomy.
- `skills-governance-03` Generated skill copies under `.agents/skills` and
  `.claude/skills` should match `shared-skills/`, and references inside the
  shared text must remain valid from every copy root. Prefer repo-root plain
  paths for links to repo docs when one relative Markdown link cannot resolve
  from all three roots. Run `npm run guard:skills` after sync and resolve any
  changed cross-root references from each copy location.
- `skills-governance-04` An attestation secret present in a local environment
  proves only that the process knows the secret; it does not prove a protected
  gate executed the collection. GitHub-like environment strings are
  caller-settable too. Trusted automation must bind a protected signing
  identity, a separate fixed verifier, an immutable invocation-specific run
  ref, and durable run provenance. Local self-issued key runs remain
  non-authoritative (severity: high, lastSeen: 2026-07-13, validation: set a
  local key plus every GitHub-like environment value and require the result to
  stay `unknown`).
- `skills-governance-05` A protected verifier must recompute every
  decision-bearing provenance field from trusted inputs, including core pin,
  policy and collector digests, base/target summaries, and merge eligibility.
  Verifying only artifact hashes leaves unsigned summary fields available for
  tampering (severity: high, lastSeen: 2026-07-14, validation: mutate each
  provenance field independently and require verification to fail).
- `skills-governance-06` When a new canonical doc is added (or a doc is split
  out), register it in every list that enumerates canonical/contract-affecting
  docs, not only the enforcing code. A human-readable allowlist that declares
  itself "kept in sync" with a code list (e.g. a generated skill registry
  mirroring an implementation allowlist) is a separate drift source
  with no test guarding it — grep the doc mirrors for a sibling canonical
  doc's name and add the new one beside it (severity: medium, lastSeen:
  2026-07-29, validation: `rg -n "<sibling-doc>" shared-skills docs scripts`).
- `skills-governance-07` `status: retired` — fixed-limit review-history
  compaction is no longer a current workflow. Its archive-chain, retained-tail,
  and reconstruction integrity rationale remains historical; reopen it only if
  a future measured-cost decision approves a new compaction process.
- `skills-governance-08` `status: retired` — staged path inference no longer
  participates in implementation routing. Its mixed-purpose Project Knowledge
  parsing and self-classification rationale remains historical; reopen only if
  a future process decision introduces a deterministic owner registry with a
  distinct merge responsibility.
- `skills-governance-09` Shared process memory may preserve decision rationale,
  rejected alternatives, recheck conditions, and authority pointers, but it
  must not restate current agent commands. When this boundary changes, sweep
  the live shared-memory and current PK prose so append-only rationale cannot
  compete with the owning AGENTS, docs, skill, hook, or gate authority
  (severity: high, lastSeen: 2026-08-10, validation: current-authority semantic
  sweep with dated archive and immutable review evidence excluded).
- `skills-governance-10` A local agent-process CLI that promotes, rejects,
  moves, or deletes an artifact must resolve only its exact canonical local
  target. Reject missing-path fallback, another existing path, an outside
  absolute path, and a symlink before reading or mutating files. Atomically
  claim the validated artifact identity before a destructive workflow so a
  concurrent producer cannot replace the path and lose its newer artifact;
  write derived destinations through an exclusively opened, held file
  descriptor without following substituted final symlinks. Give an interrupted
  claim a durable decision identity. One per-entry inventory must expose the
  same state through normal list/start handoff, isolate invalid entries, and
  distinguish recoverable, already-applied, partial, and conflicting states
  before cleanup. Do not infer completion from a partial destination. State
  the supported local threat boundary when the host API cannot provide
  descriptor-relative parent-path mutation. Claim restoration must use
  no-clobber publication as well as the forward path. A cooperating-process
  lock must publish a complete owner identity atomically and stale cleanup must
  remove only the observed lock identity. Before destructive `already-*`
  cleanup, reopen, revalidate, and durably sync the applied sink; one evidence
  read failure must remain isolated to its inventory entry. An in-flight claim
  must expose durable live ownership so recovery accepts only a missing or
  observed-stale owner and the original operation cannot continue after a
  takeover. Protect the boundary with a
  production-entrypoint integration test
  (severity: high, lastSeen: 2026-08-10, validation: exact target success plus
  typo, alternate-path, symlink, validation-before-mutation, and concurrent
  replacement, destination substitution, and crash-recovery cases).
- `skills-governance-11` Machine-required authority references must preserve a
  strict metadata shape and resolve to the declared authority namespace. For
  repo-owned authority, require every item to be a non-empty string whose
  anchor-free repo-relative path resolves to a regular non-symlink file. Human review still owns
  whether that file is the correct semantic owner. Global admission may reject
  any invalid ref, but per-entry recovery must not let an
  unrelated entry's invalid ref mask a valid completed claim. Keep current
  ownership and historical provenance distinct: a process-memory promotion
  must retain both validated `authority_refs` for the current owner and a
  `source_refs` commit SHA for the evidence state that formed the decision
  (severity: medium, lastSeen: 2026-08-10, validation: project/process positive
  cases plus missing-path, missing-evidence-commit, and mixed-type negative
  cases).

### story-chain — Story Chain or Evidence Ledger docs

- `story-chain-01` Keep the Promise, Aspect, Evidence Ledger
  `acceptanceChecks[]` assertion, referenced structured executions, and test
  names aligned.
- `story-chain-02` Review architecture-shaped Promise, Acceptance Check, and
  Aspect clauses with
  `shared-skills/mission-control/references/product-architecture-content-ownership.md`.
  Classify each hit as `KEEP`, `SPLIT`, `MOVE`, or `EVIDENCE`; require a
  reason, canonical destination, and stable ref. Do not treat technical tokens
  as automatic violations: user-visible URLs/routes, declared operator
  commands, observable timing, lifetime, replay, recovery, degraded behavior,
  access, privacy, and source authority can be contract meaning. Exact
  schedulers, caches, gateways, components, functions, endpoints, tables,
  environment variables, tests, and commands normally belong to
  runtime/engineering owners or the Evidence Ledger. When meaning is
  unchanged, require Promise, AC, and Aspect ids to stay stable and reject
  replacement of one internal identifier with another in Human-authority
  prose.
- `story-chain-03` Check moved mechanisms for exactly one canonical owner and
  stable anchor. Contract Maps may navigate to the owner but must not restate
  the rule as map authority. Architecture Fitness policy must project approved
  CAIR/engineering structure; observations must remain exact-revision facts
  and must not be used to generate desired policy.
- `story-chain-04` `status: covered` — current-authority negative and retired
  shape classification is owned once by `root-cause-09`. Story Chain-specific
  compatibility disposition and implementation cleanup remain with
  `story-chain-07` through `story-chain-12`.
- `story-chain-05` For merge/rebase conflicts touching Story Chain, Evidence
  Ledger, or agent-skill contract paths, verify the author did
  not pick one side wholesale. Reconstruct base/current/incoming intent,
  preserve compatible approved propagation, stop for Human authority when
  Promise/Aspect/AC/Intent meaning conflicts, and re-check that
  Promise/Acceptance Check/Evidence Ledger/review/test refs remain aligned.
- `story-chain-06` Do not let a ledger's Sufficiency Review directly review
  Acceptance Checks outside its `Source Promises` or let its executable
  evidence claim them.
  Cross-ledger Aspect reviews may reference related ledgers, but the owning
  ledger should keep the actual AC coverage, run commands, and reviewed
  revisions. `mc:validate-story-chain` blocks new Sufficiency Review YAML entries
  at or after the owner-boundary cutoff when their AC/IC refs belong to foreign
  Promise owners; older dated review history remains immutable
  (severity: high, lastSeen: 2026-07-22, validation: review-parser owner-boundary
  fixtures plus `npm run mc:validate-story-chain`).
- `story-chain-07` For retirements, require an explicit backward-compatibility
  stance before accepting the diff: `preserve`, `migrate-read-only`, or
  `remove`. The stance should say what happens to old stored records, URLs,
  public APIs, analytics history, generated artifacts, storage, and tests.
- `story-chain-08` Check that the implementation matches the stance:
  - `preserve`: old inputs/records still work, have deterministic tests, and
    are documented as legacy rather than accidentally active new behavior.
  - `migrate-read-only`: new writes and user entry points are blocked or
    removed, while legacy fixtures still render/read/export as promised.
  - `remove`: dedicated routes, client constants, services, storage buckets,
    migrations, env vars, jobs, analytics emitters, tests, and active docs are
    removed or converted to negative assertions. Preserve current dated
    Sufficiency Review entries under the owner-lifecycle rule in
    `shared-skills/mission-control/references/promise-retirement.md`; do not
    recreate a sibling archive or manifest. Removed historical payloads remain
    recoverable from Git history.
- `story-chain-09` For retirements, verify the previous category did not
  become an empty visible surface. Empty scope pages, nav links, tabs,
  headings, i18n strings, generated list sections, and tests that preserve the
  retired section should usually be removed, not redefined as allowed
  emptiness.
- `story-chain-10` For retirements or surface moves, sweep fixed-copy i18n
  keys, test ids, and helper names for the retired affordance. Message
  registry ownership and tone gates do not prove a string is still reachable;
  reviewers should search the removed surface terms and remove user-facing
  copy for features that no longer exist, while preserving explicitly
  documented legacy/internal protocol terms.
- `story-chain-11` For retirements or renames, scan active Promise, Moment,
  Aspect, analytics, and public prose for retired terminology outside dated
  review/changelog history. Current contract text should name the surviving
  product meaning, even when legacy file slugs remain for compatibility.
- `story-chain-12` For retirements, follow the removed behavior down to
  implementation resources: routes, client constants, service modules, storage
  buckets, migrations, environment variables, scheduled jobs, generated
  configs, and tests. A contract retirement is incomplete if the retired
  behavior no longer has a Promise but its dedicated infrastructure can still
  be created or written.
- `story-chain-13` For analytics findings, compare the event contract timing
  with the actual emit condition. If an event says a surface is viewed, tests
  should cover the first visible state, not only an expanded or interacted
  state; if the event is overlay-only, guard wide/sidecar paths explicitly.
- `story-chain-14` Compare each v2 `acceptanceChecks[].executionRefs` value
  with the declared `executions[].id`. Confirm the referenced execution covers
  the assertion and that no execution is orphaned.
- `story-chain-15` Keep Vitest selectors in the structured
  `testNamePattern` field. Confirm the zero-test guard matches at least one
  declared test title. Raw shell text and Markdown table escaping are invalid.
- `story-chain-16` `status: workflow` — ledger-scoped trace-first validation is
  owned by `SKILL.md` § Review Loop.
- `story-chain-17` `status: workflow` — broad Evidence Ledger validation scope
  is owned by `SKILL.md` § Review Loop.
- `story-chain-18` Read every changed Experience, Moment, Promise, Aspect, and
  Architecture Fitness policy body against
  `shared-skills/mission-control/references/contract-layer-routing.md`
  `## Policy Document Validation`. Record the inspected paths and classify
  questionable clauses as `KEEP`, `SPLIT`, `MOVE`, or `EVIDENCE`; do not infer
  semantic fitness from a valid graph, filename, frontmatter, or green
  Architecture Fitness observation (severity: high, lastSeen: 2026-07-22,
  validation: `npm run quality:contract` for structural invariants plus the
  exact-head Story Chain review record for semantic ownership).
- `story-chain-19` When live generation or an LLM judge returns `not-met` on an
  unchanged content head, do not collapse a later pass into retry-to-green.
  Preserve every generation output and judge verdict, declare a bounded rerun
  count and quorum before the next attempt, execute the full declared sample,
  distinguish generation variance from judge variance, and add a current
  Sufficiency Review stability stamp. The final verdict may claim only the
  observed quorum, not deterministic stability (severity: high, lastSeen:
  2026-08-02, validation: current review entry plus the complete declared live
  run sequence).
