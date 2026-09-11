---
name: mission-control
description: "Light House Mission Control workflow for current Story Chain work. Use for Mission Control / MC board / Story Chain work; Promise, 약속, contract, 계약, Experience, Moment, 모먼트, Intent Check, 의도, Acceptance Check, AC, Aspect, 횡단, 종단, Evidence Ledger additions, changes, retirements, splits, merges, reviews, duplicate concept work, retrospective Promise/Aspect architecture-shaped clause audits, implementation identifier placement, Propagation Map, propagation budget, scope checkpoint, owner boundary, and Contract Architecture Impact Review when a new or meaning-changed Experience/Moment/Promise/AC/Aspect changes an expectation along responsiveness/latency, domain/data shape, source ownership, state lifetime/persistence/recovery, ordering/concurrency/idempotency, runtime/provider/AI boundaries, security/privacy, capacity/cost/SLO, observability identity/cardinality, or compatibility/retirement; also use for UI intent, intent traceability, rendered DOM evidence, live judge, UI quality tied to a Promise, runtime-flow/runtime ordering/fallback/runtime response policy/AI response boundary changes, analytics/event collection, 이벤트 수집, 이벤트 계약, canonical event, events.yaml, trackCanonicalEvent, mc:event-impact, 제품 원칙, product principles, 독트린, doctrine alignment, and Story Chain validation. Treats docs/contracts/story-chain/concepts.md as concept authority, docs/product-identity.md 제품 원칙 as the product principle authority, and validates with current Story Chain and surface gates."
---

# Mission Control Skill

Mission Control is the operating workflow for Light House's current Story
Chain. It reads and writes only the canonical Story Chain and current product
contract files:

- `docs/contracts/story-chain/experiences/`
- `docs/contracts/story-chain/moments/`
- `docs/contracts/story-chain/promises/`
- `docs/contracts/story-chain/aspects/`
- `docs/contracts/story-chain/evidence-ledgers/` (current path for Evidence Ledgers)
- `docs/contracts/story-chain/concepts.md`
- `docs/contracts/story-chain/traceability-cardinality.json`
- `docs/contracts/story-chain/deferred-verification-triggers.md`
- `docs/contracts/story-chain/scenario-catalog.md`
- `references/service-policy-coverage-review.md` when composing or materially
  restructuring a core-product service bundle
- `docs/mission-control.md`
- `docs/mission-control-review-retention.md` when inspecting live Sufficiency
  Review generation retention, authority exceptions, or mutation checkpoints
- `docs/runtime-flows/` when runtime ordering, fallback order, programmatic
  inspect/AI response boundaries, persistence/sync ownership, or debugging signals
  change

The old history ledgers were retired after the Story Chain reset. Do not create
or update external backlog, judgment, or reality-feedback markdown ledgers.
Snapshot state is derived from Story Chain and Evidence Ledger coverage.

Activate this skill whenever the user message contains Story Chain contract
vocabulary such as "약속", "promise", "계약", "contract", "의도", "모먼트",
"AC", "횡단", or "종단", even if the user does not explicitly say
"Mission Control" or "mc". Also activate it for:

- UI intent/quality terms such as "intent traceability", "rendered DOM",
  "live judge", or UI quality changes tied to a Promise;
- runtime-flow terms such as runtime ordering, fallback order,
  runtime response policy, AI response boundary, persistence, sync ownership, or debugging
  signals;
- analytics/event-collection contract vocabulary such as "이벤트 수집",
  "이벤트 계약", "analytics", "canonical event", "events.yaml",
  "trackCanonicalEvent", "Amplitude", or "event-impact".

Product-facing behavior instrumentation and runtime ordering both close through
Story Chain coverage when they affect user-visible behavior.

## Vocabulary

Use `docs/contracts/story-chain/concepts.md` as the vocabulary authority for
Story Chain concept boundaries, responsibility boundaries, Evidence Ledger
meaning, and review order.
Do not duplicate the full concept model in skill output or new docs; link or
point back to `concepts.md` unless the task is specifically to edit that file.
Use current terms in all new work. The canonical term table (Experience,
Moment, Promise, Intent Check, Acceptance Check, Aspect, Evidence Ledger,
Code/surface tags) lives in `docs/mission-control.md` `## Vocabulary`; do not
restate it here or in new docs.

When writing or reviewing Story Chain prose, prefer registered terminology
before inventing a local phrase. Story Chain concept terms come from
`concepts.md` and `docs/mission-control.md`. Repeated product-surface vocabulary
comes from its owning Promise, Evidence Ledger, runtime-flow doc, or code
surface. If a contract needs a new
repeated product-surface term, route through `glossary-steward`; if the term
creates or changes product meaning, stop for Human authority before treating it
as current contract language. Do not let two names describe the same owner,
source state, surface, or user-visible behavior unless the source contract
explicitly records an alias/migration.

In agent contract conversations, use the active context, the glossary, and the
owning contract to understand non-canonical wording, Korean/English variants,
and abbreviations. Use the canonical term in summaries and contract drafts, and
preserve the user's original wording only in direct quotations. Contextual
interpretation does not register a new alias in Story Chain.

Ambiguity remains whenever more than one meaning is plausible, including a
canonical term versus an unregistered meaning. In that case:

1. Stop every contract interpretation, draft, propagation, and implementation
   step that depends on the term.
2. Name up to three plausible meanings, using canonical terms where available,
   and state the shortest useful difference between them. Mark an unregistered
   meaning as such rather than inventing a canonical name.
3. Ask one direct question that lets the human identify the intended meaning or
   provide the intended definition. Do not proceed on an assumption while
   waiting.
4. Resume only after the human confirms the intended canonical term or
   definition. Restate it once, then use it as the active referent for the rest
   of the discussion and in contract output.

If later context conflicts with the confirmed meaning, stop dependent contract
work and confirm again.

Current storage and tooling names are canonical: `Evidence Ledger`,
`docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml`, and
`npm run evidence-ledger`. Do not add migration records for completed naming
changes to current Story Chain contracts.

Responsibility model summary:

- Human owns Experience, Moment, Promise existence/meaning, and new Aspect
  meaning.
- Agent may draft wording, but only propagates and implements after Human
  meaning is explicit.
- Agent owns Evidence Ledger propagation, code/tests, and surface tags for
  approved Promises under applied Aspect constraints.
- Evaluator owns deterministic check and live-judge execution.
- System owns CI and release blocking gates.

When reviewing Story Chain content, use this order:

0. 제품 원칙 — does the change conflict with a statement in the
   `docs/product-identity.md` `## 제품 원칙` section, or with its surface
   application rule (same user-visible surface, same principle verdict)?
1. Experience — is the durable experience boundary correct?
2. Moment — is the workflow moment narrower than the Experience and broader
   than one Promise?
3. Aspect — is the cross-cutting rule strict enough and backed by a covering
   Evidence Ledger?
4. Promise — is the vertical promise and its Acceptance Check set correct?
5. Evidence Ledger — does the executable evidence close the declaration?

Dated audit entries may quote older `historical` refs when preserving past
decisions. New Story Chain prose and guidance should use canonical refs.

## Boundaries

- **Always** run `npm run mc:status` or `npm run mc:next -- --authority A/E`
  before choosing Mission Control work.
- **Use** `npm run mc:review-retention` for a read-only report over live
  Sufficiency Review sidecar generations. The approved default is `N=3`; current
  AC/IC/Aspect authority carriers, current-reader compatibility, foundational
  exemptions, and unmapped owners remain outside the raw N window. The command
  does not authorize deletion, rewrite, or a CI gate. Follow
  `docs/mission-control-review-retention.md` and stop for new Human authority
  before adding mutation.
- **Always** after Human authority makes a new or meaning-changed user- or
  operator-facing Story Chain contract explicit and before propagation or
  implementation, run the Contract Architecture Impact Review when the change
  affects any trigger axis in
  `references/contract-architecture-impact-review.md`. Record `none`,
  `constrain-existing`, or `reshape` in the work's existing plan, contract,
  runtime-flow, or PR surface using the exact
  `## Contract Architecture Impact Review` heading. Do not use a transient chat
  close-out or create a parallel register.
- **Always** before implementation, write a durable Propagation Map when CAIR
  returns `reshape`, Concept Shift includes `remove`, the cross-impact scan
  finds multiple owning contract bundles, a cache/state lifecycle is added, or
  the forecast reaches a scope checkpoint. Use
  `references/propagation-scope-control.md`. Chain closure applies to the
  minimum owning boundary; downstream inspection does not transfer ownership
  or authorize unrelated cleanup.
- **Always** when a forward change or retrospective audit finds
  architecture-shaped clauses in Promise, Acceptance Check, or Aspect content,
  select its owner with `references/contract-layer-routing.md`, then classify
  each clause with the `## Clause Classification` section of
  `references/product-architecture-content-ownership.md` before editing it.
  Preserve visible product meaning and stable Story Chain ids when meaning is
  unchanged. Route replaceable mechanism, exact evidence, and Architecture
  Fitness projection to their canonical owners instead of replacing one
  implementation identifier with another in Human-authority prose.
- **Always** keep the approved Promise, applied Aspect constraints, covering
  Evidence Ledger, code/tests, and surface tags synchronized in the same change.
- **Always** before creating or materially restructuring a `core-product`
  Experience or service-level Moment/Promise bundle, run the Service Policy
  Coverage Review in `references/service-policy-coverage-review.md`. Research
  minimum user-facing and non-user-facing service policies, assign each an
  `owned`, `rejected`, or `unresolved` disposition and canonical owner, and stop
  composition while any row is unresolved. Do not force security, data
  lifetime, runtime, SLO, or rollout policy into user-facing Promise prose.
  Record the aggregate and durable review pointer on the `core-product`
  Experience so `unresolved` remains visible as a blocked `mc:status` release
  dimension instead of disappearing outside the Story Chain denominator.
- **Always** when user-facing behavior, `// @promise` surfaces, Promise meaning,
  or Acceptance Checks change, run `npm run mc:event-impact` and update
  analytics coverage with `npm run mc:event-impact -- --sync` when missing,
  stale, or moved event contract entries need to be added, removed, or updated.
  Use `npm run mc:event-impact -- --update` only when the generated coverage
  inventory is stale but `events.yaml` itself is already correct. If the changed
  behavior creates or changes a user action, committed document state, failure
  state, or operator-observable reality signal, refine `docs/analytics/events.yaml`
  and the emitting `track(...)` / canonical analytics bridge in the same change.
  Name product events by observable behavior, not Promise names or implementation
  states. `docs/analytics/README.md` owns the current naming and compatibility
  convention; do not restate or invent a competing format here. Keep the Promise
  relationship machine-verifiable in the event's declared Story Chain refs; do
  not encode it only in the event name. Route implementation, migration, privacy,
  identity, and cardinality work to `analytics-event-steward` after Mission
  Control scopes the contract impact.
- **Always** when a change alters runtime ordering, fallback order,
  programmatic inspect/AI response boundaries, persistence/sync ownership, or
  debugging signals, inspect `docs/runtime-flows/README.md` and update the
  relevant `docs/runtime-flows/*` document in the same change.
- **Always** write Evidence Ledger Acceptance Checks in strict v2 YAML under
  `acceptanceChecks`. Each entry has one canonical `key`, an `assertion`, and
  one or more `executionRefs`. Do not add Markdown tables or raw shell fields.
- **Always** name newly created or meaning-changed Acceptance Checks with a
  semantic kebab-case slug, not a positional `ac1` / `ac2` suffix. Follow
  `promise:alignment-coherence-gate#acceptance-check:alignment-coherence-gate-ac-slug-rule`:
  the slug should name the assertion axis, be unique within the Promise, stay
  short (≤ 4 words / ≤ 30 chars after the Promise prefix), and avoid encoding
  brittle values (`cap-block` is acceptable; `initial-ten` is not). Existing
  numeric AC ids may remain only when their meaning is unchanged.
- **Always** when adding scenario catalog entries, choose a semantic
  kebab-case `scenario:<slug>` that names the user/runtime situation or
  transition, for example `scenario:search-provider-failure-degraded`.
  Existing numeric journey-style ids such as `scenario:presence-01-01-03` may
  remain as historical refs; new entries should read like stable concept names,
  not coordinates in a sequence.
- **Always** decompose an Acceptance Check into the runtime invariants needed to
  make the user-visible behavior true. If a rendered state depends on generated
  payload, persisted snapshot shape, branch selection, or another upstream key,
  add evidence for that dependency; fixture-only UI evidence does not close the
  contract by itself.
- **Always** when an Acceptance Check body promises parity between two
  surfaces — two sources feeding the same builder, a fallback that mirrors a
  primary path, a refactor that should keep output shape — name the parity
  invariant in the AC body and lock it with fixture-based evidence (a single
  test that runs both surfaces against the same logical scenario and asserts
  a comparable output metric) or with an Intent Check (live judge) when the
  parity claim is qualitative. Per-path deterministic helper tests passing
  individually do not lock parity; they each test a single context, not the
  shared output. Follow `references/quality-parity-evidence.md`. Extend the
  existing simulation surface (`s2-fetch` mock, inline-analysis fixture,
  gap-network test seam) when the parity test needs a mock provider response,
  instead of inventing a one-off mocking style.
- **Always** before closeout, run a role-separated review for Story Chain work
  that changes context preservation, recovery, history, previous-state
  snapshots, workspace/document lifecycle, analytics event contracts, AC
  rename/retire, Sufficiency Review entries, any Contract Architecture Impact
  Review verdict, or new Aspect/Skill policy. When
  the active host and user authorization allow subagents, delegate the review to
  non-writing reviewers with explicit roles. Otherwise perform the same review
  locally and report the role names. Use at least:
  - `lifecycle reviewer` for store, hydration, workspace switch, id reuse,
    deletion, stale snapshot, invalid restore, and post-restore cleanup.
  - `contract-history reviewer` for Promise/Aspect/AC weaving, Evidence Ledger
    coverage, analytics refs, and dated Sufficiency Review integrity.
  - `architecture-impact reviewer` for durable record presence, verdict
    completeness, Human/Agent authority, and evidence/structural-defense
    propagation into the affected owner.
  - For analytics event contract changes, include the runtime reviewer question:
    do all user-visible emit paths preserve the same analytics context, pass
    through the canonical/legacy bridge expected by the contract, and fire
    before navigation, focus, early return, or other lifecycle exits can skip
    tracking?
- **Always** read `docs/contracts/story-chain/concepts.md` before reviewing or
  changing Experience, Moment, Promise, Aspect, or Evidence Ledger meaning.
- **Always** check user-facing meaning work (new or changed Promise, Aspect
  advice, runtime response policy, AI response boundary, degraded/failure
  visibility) against the `## 제품 원칙` section of
  `docs/product-identity.md` before propagation. A contract that conflicts
  with a product-principle statement is misaligned even when every gate
  passes. When an existing contract conflicts with the product principles, do
  not silently rewrite either side: product-principle changes and
  Promise/Aspect meaning changes are both Human decisions, so record the
  conflict as a principle-misalignment finding and stop for Human authority.
- **Always** when authoring or editing Human-authority prose (Experience,
  Moment, Promise, Aspect) under `docs/contracts/story-chain/`, follow the
  per-node 본문 작성 기준 in `concepts.md` where defined (e.g. Subject &
  situation, What happens, Boundary for Experience). Prose must describe what
  the node actually means and how the product behaves there, not act as a
  scope tag or routing label. For Korean prose style rules across all
  Human-authority docs, plus the current post-hoc authoring exception (active
  at Experience level — upper prose is faithfully reconstructed from
  already-declared lower nodes rather than driving them), follow
  `references/human-authority-prose.md`.
- **Always** validate with `npm run quality:contract` before closeout — the
  alias owns the required contract gate list; hand-picking a subset is how
  `mc:check-critical-findings` was skipped in issue #193.
- **Always** review every changed Experience, Moment, Promise, Aspect, or
  Architecture Fitness policy body with
  `references/contract-layer-routing.md` `## Policy Document Validation` and
  the `review-checklist-steward` `story-chain` group. `quality:contract`
  verifies structural invariants; it does not replace this semantic ownership
  review.
- **Ask first** before changing `docs/mission-control.md`, contract policy,
  runtime response policy, tool surface, AI response format, or adding a new
  runtime-flow document.
- **Never** bypass gates, add disable comments to hide validation, or validate
  Intent Check behavior through simulation wrappers. Live judges must evaluate
  actual runtime AI response output or actual rendered DOM.

## 4 Authority Model

The canonical H/A/E/S authority table lives in `docs/mission-control.md`
`## 4 Authority Model`; do not restate it here. Operationally: agents stop on
H (Human) and S (System) work, and may advance A (Agent) / E (Evaluator) work
when the next action is fully determined by current contracts.

## Workflow

1. Inspect status:
   - `npm run mc:status`
   - `npm run mc:review-retention` when the work concerns live Sufficiency
     Review generation retention
   - `npm run mc:next -- --authority A --json`
   - `npm run mc:next -- --authority E --json`
2. Pick one A/E item and inspect its Promise, covering Evidence Ledger, tests, and
   tagged surface files.
   - Use `npm run mc:trace-ledger -- --ledger <name-or-path>` to follow the
     covering Evidence Ledger into structured executions, execution targets, and
     imported `app/` code before manual searching.
3. When composing or materially restructuring a core-product service bundle,
   complete the Service Policy Coverage Review before choosing the Promise set.
   Keep research evidence in Moonlight Project Knowledge, record
   dispositions in the work's existing durable plan, and route each owned policy to its canonical
   Story Chain, runtime, security/data, operational, or evidence owner.
4. Before propagation, run the Contract Architecture Impact Review when the
   approved contract touches a trigger axis. Route structural decisions to the
   implementation author under the affected canonical engineering documents and
   route runtime, gate, analytics, security/privacy, and operational effects to
   their workflow owners. If the review exposes an unresolved product-level
   choice, pause the review and propagation. Use `jaeyoung-think` to draft a
   proposal, obtain explicit Human approval, update the approved meaning, and
   rerun the review from the start.
5. When a trigger in `references/propagation-scope-control.md` applies, record
   the Propagation Map in the work's existing durable issue/PR plan, contract,
   or runtime-flow. Run the early overengineering/scope review before editing,
   and stop for Human scope choice at a checkpoint.
6. Classify architecture-shaped clauses with
   `references/product-architecture-content-ownership.md` after any required
   CAIR; when no CAIR trigger applies, proceed directly from approved Human
   meaning. Record `KEEP`, `SPLIT`, `MOVE`, or `EVIDENCE`, the destination, and
   the stable ref in the work's existing durable plan. Do not create a parallel
   placement registry.
7. Apply the smallest chain-closing change:
   - Promise declaration or cleanup under `docs/contracts/story-chain/promises/`
   - Evidence Ledger propagation under
     `docs/contracts/story-chain/evidence-ledgers/`, including
     v2 `acceptanceChecks` entries for Acceptance Checks
   - deterministic test / live judge / implementation updates under `app/`
   - analytics event contract updates under `docs/analytics/events.yaml`,
     `track(...)` emission updates, and `npm run mc:event-impact -- --sync`
     when user-facing behavior changes observable product actions or states
   - runtime procedure docs under `docs/runtime-flows/` when ordering,
     fallback, programmatic inspect/AI response, or sync ownership changes
   - surface tags with `// @promise`, plus `// @aspect` or `// @check` when
     relevant
8. Run targeted tests for the touched contract.
9. Run the role-separated review when a trigger from Boundaries applies.
   - Keep review agents read-only unless the work has been explicitly split
     into disjoint write scopes.
   - Apply concrete findings before the final gate pass.
   - If no subagent can be used, record the local reviewer roles in the final
     response.
10. Run gates:
    - `npm run quality:contract` — the canonical contract closeout alias; its
      gate list (including the event contract gates) is owned by the
      `package.json` definition, so do not hand-pick a subset of its members
      (issue #193)
    - plus `npm run typecheck`, `npm run test:unit`, and `npm run lint` when
      code changed.

## Companion Skills

Mission Control remains the parent workflow. Load these repo-local companion
skills only after Mission Control has established the Story Chain scope:

- `story-chain-contract-steward` — when adding, changing, splitting, merging,
  retiring, or reviewing a `promise:*` declaration, `acceptance-check:*` ref,
  Evidence Ledger coverage entry, AC revision, structured execution evidence, Sufficiency
  Review entry, scenario ref, or `// @promise` / `// @check` tag.
- `aspect-steward` — when adding, changing, reviewing, retiring, or repairing
  an `aspect:*` declaration, pointcut, covering ledger weaving, or Aspect
  verdict.

Do not use companion skills as an alternate route around Mission Control gates;
they narrow a subtask after the Promise/Aspect/Authority boundary is known.

## Work Modes

- **Forward work**: after Human approval of Promise meaning, propagate the
  Promise under applied Aspect constraints into Evidence Ledger evidence,
  code/tests, and surface tags.
- **Modification work**: keep an existing Promise alive while changing prose,
  Intent Checks, Acceptance Checks, parent refs, or split/merge shape. Use
  `references/promise-modification.md`.
- **Concept adjustment work**: when alignment audit surfaces
  `duplicate_high_level_concept` or a human reports overlapping Experience /
  Moment concepts, first decide the semantic operation (merge, split, rename,
  or retire) under Human authority, then propagate parent refs, Evidence Ledger
  coverage, and surface tags. Use `references/concept-adjustment.md`.
- **Retirement work**: remove a Promise or user-facing feature after Human
  approval. Use `references/promise-retirement.md`.
- **Cross-impact pre-check**: before changing any existing Promise, inspect
  sibling Promises, shared Evidence Ledgers, Aspect pointcuts, feature specs, code
  surfaces, and shared tests. Use `references/cross-impact-check.md`.
- **Contract architecture impact work**: after Human meaning is explicit,
  classify structural impact as `none`, `constrain-existing`, or `reshape`
  before implementation. Use
  `references/contract-architecture-impact-review.md`.
- **Product/architecture content placement work**: after Human meaning and any
  required CAIR are explicit, classify architecture-shaped Story Chain clauses
  as `KEEP`, `SPLIT`, `MOVE`, or `EVIDENCE`. Preserve unchanged contract ids and
  route mechanisms, evidence refs, and Architecture Fitness projections to
  their canonical owners. Use
  `references/product-architecture-content-ownership.md`.
- **Content review work**: when a human reviews Experiences, Moments, Aspects,
  or Promises by meaning, keep `docs/contracts/story-chain/concepts.md` open
  and apply the review order above. Use
  `references/contract-layer-routing.md` before moving statements between
  Experience, Moment, Promise, Aspect, and Architecture Fitness. Agents may
  propose wording, but may only propagate wording and evidence after the human
  decision is explicit.
- **Role-separated review work**: before finalizing risky Story Chain changes,
  separate implementation from review. Ask lifecycle reviewers to find
  cross-workspace, hydration, stale-state, and cleanup failures. Ask
  contract-history reviewers to find stale refs, false dated verdicts, missing
  reciprocal weaving, and analytics coverage drift.
- **Deferred verification work**: adapter protocol and Alloy-style model
  checking stay deferred until the thresholds in
  `docs/contracts/story-chain/deferred-verification-triggers.md` are reached.

## References

- `references/workflows.md` — current A/E workflow details.
- `references/cross-impact-check.md` — current Story Chain impact scan before
  changing existing Promises.
- `references/propagation-scope-control.md` — minimum owner closure,
  pre-implementation propagation maps, scope checkpoints, and the advisory
  versus blocking boundary.
- `references/contract-architecture-impact-review.md` — pre-implementation
  review for contract changes that constrain system structure.
- `references/contract-layer-routing.md` — combined ownership criteria for
  Experience, Moment, Promise, Aspect, and Architecture Fitness.
- `references/product-architecture-content-ownership.md` — placement rules for
  product meaning, architecture decisions, runtime mechanisms, executable
  evidence, and exact-revision observations.
- `references/concept-adjustment.md` — Experience/Moment duplicate concept
  adjustment workflow.
- `references/promise-modification.md` — live Promise modification workflow.
- `references/promise-retirement.md` — Promise/feature retirement workflow.
- `references/live-judge-authoring.md` — live judge authoring contract.
- `references/sufficiency-review-live-judge-stamp.md` — Sufficiency Review stamp.
- `references/aspect-graduation.md` — current Aspect authoring rules.
- `references/abstraction-reduction-triage.md` — abstraction-first fix triage.
- `references/human-authority-prose.md` — Korean prose style rules for
  Human-authority docs (Experience/Moment/Promise/Aspect) plus the current
  post-hoc authoring exception.
- `references/quality-parity-evidence.md` — locking quality parity between
  two surfaces that share a builder, fallback, or refactor — with fixture or
  Intent Check evidence, plus simulation/fixture extension guidance.
