# Contract Architecture Impact Review

Use this review after Human authority has made a user- or operator-facing Story
Chain contract change explicit and before the agent propagates that meaning
into child contracts, Evidence Ledger rows, runtime docs, or code. Its purpose
is to decide whether the current system boundaries can honestly support the
contract.

This is a Mission Control pre-implementation review, not a new backlog or a
separate architecture workflow. Record the result in a durable issue/PR plan or
body, owning contract artifact, or runtime-flow document already used by the
work. Do not create a parallel architecture-impact registry.

## Triggers

Open the review when a new or meaning-changed Experience, Moment, Promise,
Acceptance Check, or Aspect changes an expectation along at least one of these
axes:

| Axis                              | Contract signals                                                                                                                                    | Typical system surfaces                                                                                             |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Interaction timing                | immediate acknowledgement, first paint, progress, pending, readiness, latency budget                                                                | URL transition, client state, route bootstrap, dynamic import, provider request                                     |
| Domain and data shape             | new product artifact, payload/schema field, relationship/cardinality, serialization contract                                                        | domain types, schema validation, DB migration, repository mapping, server/client boundary                           |
| Source of truth and authority     | current owner, canonical URL, actor identity, source lineage, single writer                                                                         | route/store ownership, domain-access, repository, auth principal                                                    |
| State lifetime and recovery       | ephemeral/durable state, persistence, restore, history, undo, freshness, invalidation                                                               | client store, cache, DB schema, artifact lifecycle, browser history                                                 |
| Execution semantics               | ordering, concurrency, idempotency, deduplication, cancellation, atomicity                                                                          | queue, scheduler, mutation boundary, background task, effect cleanup                                                |
| Runtime, external, or AI boundary | client/server/background placement, durable execution, provider/tool use, structured response schema, fallback, retry, degraded or partial behavior | route handler, worker/background task, external HTTP gateway, AI generation gateway, runtime-flow, response channel |
| Security and privacy              | authentication, authorization, ownership, retention, sensitive input/output                                                                         | public route, domain-access, sink, cache/log policy                                                                 |
| Resource and capacity             | fan-out, cardinality, payload/window size, cost, timeout, SLO, load shedding                                                                        | provider budget, DB/query shape, concurrency control, load-smoke rail                                               |
| Observability and audit           | stable event identity, emission timing/cardinality, durable evidence, debugging signal                                                              | analytics router, vendor sink, logs, operational dashboards                                                         |
| Compatibility and retirement      | migration, replay, old URL/state/schema compatibility, retired owner                                                                                | route/state/repository/DB/runtime-flow/analytics shapes                                                             |
| Cross-surface invariant ownership | the same behavior or parity is promised on several surfaces                                                                                         | shared builder, Aspect pointcut, host/runtime owner, centralized policy                                             |

Copy, layout, or qualitative output wording alone does not trigger this review.
It does trigger when the visible change also changes one of the axes above.
The deterministic gate is diff-scoped, so a changed Experience, Moment,
Promise, or Aspect still needs the minimum `none` record described in
`## Deterministic validation`, even when the edit affects no architecture
axis.

## Verdict

Choose one verdict before implementation:

| Verdict              | Meaning                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `none`               | The current system boundaries already support the contract and no new structural invariant is required. Record one evidence-backed sentence.          |
| `constrain-existing` | Current owners and topology remain, but the contract adds or strengthens an invariant, lifecycle rule, budget, guard, control rule, or evidence path. |
| `reshape`            | A source owner, topology, runtime boundary, state lifetime, persistence representation, data flow, or separate control-plane ownership must change.   |

Changing a budget, guard, load-shedding rule, or rate limit inside its current
owner is `constrain-existing`. It becomes `reshape` only when the change moves
ownership or requires a new topology, runtime boundary, persistence
representation, or separately owned control plane.

The Agent owns this classification only inside the approved product meaning.
If feasibility, cost, security, or compatibility tradeoffs would weaken or
change that meaning, stop and return the choice to Human authority before
propagation.

`reshape` is not permission to preserve old shapes by default. If the product's
central noun changes or a retired architecture can survive, also run the
Concept Shift Architecture Review and give every affected shape a `preserve`,
`migrate-read-only`, or `remove` verdict.

## Decision Record

Use the exact heading `## Contract Architecture Impact Review` so reviewers can
find the record. Put it in the issue/PR plan or body, owning contract artifact,
or runtime-flow document already used by the work. A transient chat close-out
is not a durable record.

Scan every trigger axis, then record only the affected axes. Do not produce a
full table of ceremonial `N/A` rows.

For `none`, use the lightweight record below. It proves that the review ran; it
does not invent a rejected architecture or structural defense when current
boundaries already satisfy the contract.

```text
## Contract Architecture Impact Review

Contract delta:
Verdict: none
Affected axes: <canonical axis>; <canonical axis>
Existing-boundary evidence:
Human decision required: no
```

For a non-semantic Promise/Aspect edit that affects no architecture axis, use
the exact marker `Affected axes: none (non-semantic edit)` instead of inventing
an affected axis.

For `constrain-existing` or `reshape`, record:

```text
## Contract Architecture Impact Review

Contract delta:
Verdict: constrain-existing | reshape
Affected axes and current owners: <canonical axis>; <canonical axis> — <current owners>
Decision:
Rejected alternative:
Evidence and structural defense: <existing repo path, npm script, or Aspect ref>
Human decision required: no | <question that would change product meaning>
```

Use the axis names from `## Triggers` exactly and separate multiple axes with
semicolons. A `none` record names at least one axis or uses the exact
non-semantic marker above, and has no owner clause. For `constrain-existing`
and `reshape`, the owner clause follows exactly one `—` separator, including
the surrounding spaces. A non-`none` record must cite at least one resolvable
structural defense: an existing repo path, an `npm run <script>` command, or an
`aspect:<slug>` ref. A descriptive mechanism name without a resolvable target
is not structural evidence.

For interaction timing, name both the clock start and the first visible
acknowledgement or terminal ready state. For stored or cached state, name
freshness, invalidation, and recovery. For concurrent work, name the stable
identity, idempotency/dedup boundary, cancellation, and stale completion rule.
For provider or AI work, name timeout, retry, fallback/degraded behavior, and
which side owns execution. For capacity changes, name the budget and the rail
that enforces or observes it.

## Deterministic validation

`npm run mc:validate-cair` validates CAIR records added or changed after the
comparison base. `npm run mc:validate-cair -- --staged` reads the Git index
bytes against `HEAD` and is the commit-time path; branch-wide coverage is
closed by default mode in `quality:contract`. The default comparison base is
the merge base with `origin/main`, then `HEAD^`; an `origin/main` base equal to
the current `HEAD` also falls through to `HEAD^` so push validation is not
vacuous outside a push range. Only a local repository without either base may
check its staged, unstaged, and untracked changes alone. CI does not allow that
empty-base fallback. In a GitHub PR, `origin/$GITHUB_BASE_REF` is required. A
push workflow passes the event's before SHA as `CAIR_COMPARISON_BASE` so every
commit in the push remains in scope. Other CI runs require `origin/main`; any
missing required history fails closed instead of shrinking validation scope.

Untouched historical records are not mass-migrated; once a record changes, it
must use the current syntax above. Every changed Experience, Moment, Promise,
or Aspect still needs the durable record link below because the gate uses diff
presence and does not guess whether prose changed product meaning. For a
non-semantic edit, the minimum embedded record is `none` with evidence that
current boundaries remain sufficient.

The validator owns syntax and resolvable cross-references only:

- closed verdict and 11-axis vocabulary;
- the verdict-specific non-empty fields;
- `Human decision required: no` or a question ending in `?`;
- a resolvable structural-defense target for `constrain-existing` and
  `reshape`;
- a Propagation Map for every `reshape`, plus a Concept Shift Architecture
  Review when the affected axes include `Compatibility and retirement`;
- matching `architectureImpact: declared`, `cairVerdict`, and repo-local
  `recordRef` values in changed Architecture Fitness declarations;
- revalidation of an unchanged record's structural-defense citations when the
  same diff deletes or renames a cited path, follow-up record, or linked CAIR
  record, removes a cited npm script or Aspect id, or moves a record that uses
  relative references;
- a durable CAIR record elsewhere in the same change when an Experience,
  Moment, Promise, or Aspect is deleted.

Every changed Experience, Moment, Promise, or Aspect carries either an
embedded record or an exact durable pointer:

```text
CAIR record: `docs/<owner>.md#contract-architecture-impact-review`
```

A link to a Lighthouse GitHub issue or PR record is also durable, but the local
validator can check only its URL shape. Review closeout remains responsible for
the remote record content. A repo-local link resolves the target record and
validates it when the pointer is introduced or changed. An unchanged pointer on
an edited Experience, Moment, Promise, or Aspect proves exact resolution
without mass-migrating an untouched historical target; changing the target
record itself activates the current syntax rules. For follow-up records kept elsewhere, use
`Propagation Map:` or `Concept Shift Architecture Review:` with the same
durable-reference form.

When a changed Architecture Fitness declaration points to an unchanged
historical CAIR record, the validator resolves the exact heading and compares a
deterministically readable legacy verdict without mass-migrating the target
syntax. Changing the target record itself activates the current syntax rules.

This gate does not decide whether the verdict is correct, whether an axis was
honestly omitted, or whether the cited defense is sufficient. Those judgments
remain with the architecture-impact reviewer and Human authority. Do not add an
LLM judge or infer semantic truth from a green parser.

## Architecture Fitness handoff

CAIR is the only impact-classification authority. When a change or retrospective
audit also needs current-structure evidence, hand the selected decision to the
repo-local `architecture-fitness-review` skill and the consumer adapter in
`docs/architecture-fitness/`. Do not add another impact verdict or registry.

Before creating or updating a policy, classify the affected clauses with
`product-architecture-content-ownership.md`. Keep product meaning in Story
Chain, place desired structure with the CAIR and canonical engineering owner,
and place exact runtime mechanism and evidence with their respective owners.
Architecture Fitness receives a minimal projection of that approved structure;
it does not decide where content belongs.

The lightweight entry declaration keeps two axes separate:

- `architectureImpact: none | declared`
- `decisionRoot: promise | architectureNeed | mixed | uncertain`

`none` requires existing-boundary rationale. `declared` links to this durable
CAIR record and preserves the CAIR verdict as `none`, `constrain-existing`, or
`reshape`. Sensitive paths are detection hints, not the only architecture-impact
signal. Code-only architecture changes use the same entry declaration.

`docs/agent-skills.md` `### Architecture Fitness execution` owns the current
pinned v0.5 case-kind and active Lighthouse profile routing. The executable
profile registry is `scripts/architecture-fitness/lighthouse-profiles.mjs`.
Core support does not activate a Lighthouse profile. Supported-but-inactive and
unsupported lenses remain `unknown` and require the named Human or workflow
owner. Architecture Fitness verdicts do not replace Story Chain
`met/not-met/unknown`, Human `keep/reshape/retire/evidence-needed`, or merge
`allow/block/defer-with-owner`. Missing policy or observed evidence remains
`unknown`.

## Routing

- Route structural judgment and rejected alternatives through the affected
  canonical engineering documents. The implementation author owns the local
  technical choice and routes runtime, gate, analytics, security/privacy, and
  operational effects to their workflow owners.
- If the review exposes an unresolved product-level choice, mark the review
  paused and stop propagation. Use `jaeyoung-think` to draft a proposal only
  after the Human opens the choice. Obtain explicit Human approval, update the
  approved contract meaning, and rerun this review from the start.
- Use `runtime-flow-sync` when ordering, fallback, response boundaries,
  persistence/sync ownership, or debugging signals change.
- Use `quality-gate-steward` when a new or changed guard/gate is required.
- Use `architecture-fitness-review` after this classification when a selected
  structure maps to an active Lighthouse profile and needs exact-revision
  executable evidence. Keep inactive and unsupported lenses `unknown`; do not
  emulate them with handwritten checks or observations.
- Use `analytics-event-steward` when event identity, timing, cardinality,
  privacy, or sink behavior changes.
- Use the Operational Readiness mandate when SLO, capacity, load, cost, or
  rollout evidence changes.
- Use the Concept Shift Architecture Review for compatibility/retirement
  verdicts when an old product model can remain active.

The review does not replace Promise, Aspect, or Evidence Ledger propagation.
It selects the structural decision. The content-ownership reference then keeps
visible meaning in Story Chain and routes replaceable mechanism, evidence, and
Architecture Fitness projections to their canonical owners.

## Validation Owner

Every triggered review, including `none`, receives a role-separated
`architecture-impact reviewer` before closeout. The reviewer checks that the
exact heading exists in a durable work record, the verdict matches the contract
delta, and the required fields for that verdict are complete. For
`constrain-existing` and `reshape`, the reviewer also traces the planned
evidence and structural defense into the affected contract/runtime/gate owner.
A `none` record produced only for the diff-scoped gate on a non-semantic edit
does not require a separate architecture-impact reviewer; role separation
applies to axis-triggered reviews.
If subagents are unavailable, perform the same role as a separate local pass
and name it in closeout.
