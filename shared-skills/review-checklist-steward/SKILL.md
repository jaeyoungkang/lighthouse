---
name: review-checklist-steward
description: Use when gathering advisory opinions or running or responding to local/subagent review on Light House work, especially after "의견 받아보라", "독립 의견", "모델 비교", advisory review, "서브에이전트 리뷰", "review findings", "리뷰 체크리스트", "5회 리뷰", "6차 리뷰", "3회차 설계", "대책회의", design reset, countermeasure stop, semantic drift or semantic cluster findings, Propagation Map or scope checkpoint reviews, Architecture Fitness or least-authority reviews, privileged-capability and merge-advisory reviews, overengineering reviews, architecture guideline checks, database-load review, server-load review, security/privacy review, UI loading-state reviews, Story Chain ledger drift checks, Story Chain architecture-mechanism or implementation-identifier placement reviews, Story Chain absence/retirement guard scans, review record or escape record 기록, PR review closeout status (clean / findings remain / stale) declarations, or repeated reviewer findings that should become an agent checklist. Separates read-only advisory consultation from verification review, then keeps formal findings actionable and validates corrections with targeted commands before broad gates.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Review Checklist Steward

Use this skill when local, subagent, or human review produces findings that are
not PR-thread responses. For GitHub/CodeRabbit/Copilot PR review threads, use
`branch-review-response` instead, even if the thread points out a reusable
finding that belongs in the shared checklist.

This skill turns reusable review findings into a shared, metadata-scored
operational checklist, then drives root-cause-sufficient corrections inside the
reviewed workstream. Scope control means solving the causal path at the right
owner boundary, not making the smallest textual patch. Checklist entries are
cheap and shared by default. This skill is the mechanism that helps
implementation agents apply the checklist; repeated findings stay in the
checklist unless they reveal a genuinely new workflow.

For Architecture Fitness work, `architecture-fitness-review` and the Lighthouse
adapter continue to own the review contract, exact-revision evidence,
`healthy/degraded/unknown`, and advisory merge calculation. This skill runs
after those artifacts exist. It reviews code and artifact consistency, omitted
authority paths, evidence scope, and review-process cost. It must not hand-edit
generated verdicts or turn an `unknown` green by reviewer opinion.

The checklist raises the review floor; it is not a ceiling on reviewer judgment.
Required lenses define the minimum coverage a reviewer must not miss. Reviewers
and subagents may add deeper or more specialized lenses when the diff, runtime
path, or their expertise exposes a risk. Do not reject a valid finding only
because the current checklist did not name that angle.

## Entry Branch

Classify the requested outcome before setting a goal, applying the checklist, or
creating review records. The presence of a concrete diff does not decide the
branch.

- **Advisory consultation** applies when the Human asks for opinions, design
  critique, model comparison, alternatives, or an early read of an idea,
  draft, or diff. The request does not ask the reviewers to certify readiness,
  correct defects, or close a PR.
- **Verification review** applies when the Human asks to find and fix defects,
  re-review corrections, evaluate merge or release readiness, or produce a
  formal closeout. Continue with `## Review Loop`.

When the intent is ambiguous, begin with advisory consultation. It is
read-only and does not infer authority to edit files or declare readiness.

For advisory consultation:

1. Freeze the question, supplied context, reviewer identities, and whether
   independent reviewers should receive the same prompt without seeing each
   other's answers.
2. Keep reviewers read-only unless the Human separately requests changes.
   Preserve the canonical model id reported by each execution surface.
3. Synthesize agreement, disagreement, assumptions, and available next
   decisions. Reviewer concerns remain advice rather than formal
   `valid` / `invalid` finding counts.
4. Do not create a review goal, checklist application, iteration count,
   exact-head certification, usage record, escape record, or
   `clean` / `findings remain` / `stale` closeout.
5. Do not correct the reviewed surface or repeat review until clean. Stop after
   returning the consultation unless the Human asks for another action.

Use Project Knowledge only under its normal checkpoint rules. Advisory
consultation does not create a separate durable review artifact. If the Human
later asks to apply the advice, route the change through its normal
implementation owner. Start a verification review only when the Human asks to
verify corrections, evaluate readiness, or produce a closeout. The earlier
consultation is context, not exact-head evidence.

## Review Loop

For substantial local or subagent review, set a `/goal` or host-equivalent goal
before starting the loop. The goal should name the reviewed surface and the exit
condition: repeat review, fix, and re-review until reviewers find no new valid
defects. Do not close the loop after the first clean-looking pass if a later fix
changed the reviewed surface.

Subagent review coverage is declared, not universal by default. A review pass
can prove only the lenses it actually ran. For code changes, code-level review is
always required before specialized checklist review. Architecture, Story Chain,
database-load, server-load, security/privacy, analytics, loading-state,
runtime-flow, overengineering, and other specialized lenses are required only
when the changed surface touches that risk. Treat relevant required lenses as
the review floor, then add any extra lens the changed surface warrants. Do not
claim "all angles", "full coverage", or equivalent universal review. If a
relevant lens was skipped, report declared coverage with an explicit exclusion,
not full coverage.

Before the first phase, read every changed file and the relevant call sites,
not only the triggering diff hunk. Any intentional architecture
exception must name its current owner and validation route in the frozen scope.

Run substantial review in four explicit phases:

1. `discovery review`: inspect every relevant declared lens and collect
   findings broadly inside the workstream.
2. `findings classification and correction`: classify each finding, close its
   cause, and add the smallest structural defense that proves the correction.
3. `scope freeze`: record the affected invariants, paths, reviewer roles, and
   validation commands that the closeout will cover.
4. `bounded exact-head closeout`: re-check only the frozen invariants and paths
   at the exact content head. Classify every new valid finding. When one reopens
   scope, record its severity and why the frozen scope could not have caught
   it; scope freeze never exempts a valid finding.

### Five-Iteration Design Reset

Treat one coordinated review of the same implementation state as one review
iteration. Role-separated code, contract, architecture, or other reviewers who
inspect that state share the same iteration number; they do not consume one
iteration each. A record-only append, evidence-only rebind, reviewer swap,
branch rename, commit split, or repeated command at an unchanged implementation
state does not start a new iteration or reset the count. Record the
stable `workstream`, `design-cycle`, `iteration`, and `reset-from` identity in
every new usage record so the sequence stays auditable.

One implementation design may receive at most five substantive review
iterations. If iteration five reports any new `valid` finding, do not patch the
same design and start iteration six. Record `findings remain`, stop the
implementation loop, and open a design-reset checkpoint:

1. Preserve the approved requirements, Human decisions, stable contract ids,
   and implementation-independent counterexamples or acceptance fixtures.
   Discard tests that merely encode the retired implementation shape.
2. Record which original design assumptions caused the repeated escapes and
   why the earlier review phases did not expose them.
3. Inventory compatibility before removing anything and record one verdict for
   each protected, deployed, persisted, or public artifact:
   `preserve`, `migrate-read-only`, or `remove`. Name the canonical location
   that owns each verdict. Unprotected branch-only code normally uses
   `remove`; a design reset never authorizes deleting a required compatibility
   reader, migration, stored shape, public API, or historical evidence.
4. Give the retired implementation an exact identity that every reviewer can
   resolve from shared repository history. Use a commit reachable from the
   published workstream branch or PR, or first anchor a local stash commit to a
   durable shared forensic ref. Record both the commit and ref in the
   `design-reset` record defined in `references/default-checklist.md`; a
   local-only stash, reflog, or object id is not evidence. The next cycle must
   name that commit in `reset-from`; changing only the cycle number is not a
   reset.
5. Quarantine or remove the implementation diff according to the compatibility
   verdicts. Do not copy its helpers, abstractions, parsers, validators, or
   ownership seams into the replacement merely to save work. A named
   compatibility artifact may remain only as a constraint owned by its verdict,
   not as an implicit template for the replacement.
6. Re-derive the owner boundary and dependency choices from the canonical
   product/engineering sources. Run a fresh early scope review before writing
   replacement code.
7. Unless `Three-Cycle Countermeasure Stop` applies, start a new
   `design-cycle` at iteration one. Prior findings become adversarial
   acceptance inputs, not a template for the new implementation.

The reset is mandatory for continued implementation. Human authority may
change or abandon the requested outcome, but a scope audit or approval to
continue a large migration does not waive the five-iteration ceiling for the
same design.

If the fifth-iteration finding is semantic drift, `Semantic Cluster Sweep`
still owns the inventory, current-authority search, classification, and history
exclusions. Preserve that sweep in the `design-reset` record, but do not apply
its correction to the retired design. Correction, scope freeze, and
certification resume only in the new design cycle. This reset rule takes
precedence over the general instructions below to correct a cluster as one
causal batch and continue until a clean pass.

### Three-Cycle Countermeasure Stop

Use one canonical `workstream-root` for the whole sequence. When a GitHub issue
owns the outcome, use `repo:<owner/name>#issue:<number>` even if branches, PRs,
task labels, or reviewers change. An alias does not create a new count.
Splitting work creates an independent root only when the Human
countermeasure decision names a non-overlapping outcome and scope delta for
each child; relabeling the same outcome inherits the stopped root.

A qualifying reset has all of these properties:

1. it is the only counted reset for one distinct `retired-cycle`;
2. its `retired-state` has a matching iteration-five review record under the
   same root with a new valid finding and `closeout: findings remain`;
3. its published `retired-ref` resolves to that state; and
4. its `retired-state` differs from every other counted cycle, and each cycle
   after the first began with `reset-from` equal to the preceding cycle's
   retired state.

Count the unique, chained qualifying resets for retired cycles one, two, and
three. Duplicate, corrected, evidence-rebind, alias, or record-only lines do not
increase the count. When cycle three qualifies, append the
`countermeasure-stop` record and stop implementation. Do not write a
replacement implementation, start cycle four, or create its iteration-one
review records.

Open a Human countermeasure meeting instead. The meeting is a process
checkpoint, not a sixth review iteration, design-reset waiver, or permission to
patch the retired design. The meeting must examine every retired state named by
the stop record together and append the `countermeasure-decision` record defined in
`references/default-checklist.md`. It records:

1. the repeated invalid assumptions, owner-boundary errors, and review gaps;
2. why the fresh designs did not converge despite carrying forward approved
   requirements and implementation-independent counterexamples;
3. whether to abandon or split the work, change the requirements, change the
   implementation or review ownership, obtain missing evidence or
   dependencies, or attempt a new design;
4. the selected recovery plan, cause-to-action owners, restart conditions, and
   durable Human approval.

Every meeting outcome is recorded, including abandon, split, changed
requirements or ownership, and a decision to gather more evidence. Only a
decision that explicitly allows another attempt can lead to restart. After
every restart condition is satisfied, append a separate
`countermeasure-restart` activation record with condition evidence and Human
activation approval. The next numbered cycle begins at iteration one only after
that record exists. Its review records name the latest `retired-state` in
`reset-from` and the activation record in `countermeasure-from`. The earlier
compatibility verdicts remain in force; the meeting does not authorize removing
a protected, deployed, persisted, or public artifact.

The policy-effective revision is the first protected-main commit containing the
`three-cycle-countermeasure-stop-v1` transition record defined in
`references/default-checklist.md`. Only grandfather records already present in
that revision are valid. A grandfathered workstream may complete the one
already-started cycle named by its record without retroactive stop or restart
records. If that cycle retires at iteration five with a new valid finding, stop
before any further cycle and run the countermeasure meeting. A later approved
restart begins the next numbered cycle from that newly retired state.
Qualifying resets recorded before the effective revision remain part of the
count.

After the first countermeasure restart, every later iteration-five retirement
with a new valid finding triggers another stop before the following cycle.
Append fresh stop, decision, and activation records. A previous decision or
activation cannot authorize another attempt.

This stop is Human-owned procedural enforcement. Reviewers and implementation
owners must reject an unauthorized next-cycle record. The merge-path closeout
parser does not yet calculate the reset chain or replace the Human decision;
adding such enforcement requires a separate `quality-gate-steward` decision.

### Early Propagation Scope Review

Before implementation, run an early review when a Story Chain Propagation Map
is required by
`shared-skills/mission-control/references/propagation-scope-control.md`.
This pass is separate from discovery review and exact-head closeout. Apply the
`overengineering`, `story-chain`, and affected architecture groups to the
forecast rather than a completed diff.

Check whether the smallest existing owner closes the approved invariant,
downstream impact was mistaken for downstream ownership, cleanup/history can be
split, a new cache/state lifecycle needs a separate technical decision, and the
file/churn budget matches the named paths. Stop and report the scope checkpoint
instead of approving an expanded implementation when a threshold fires.

Repeat this early checkpoint when a review correction adds five unplanned
files, changes the owner set, introduces a lifecycle, or grows scope after the
second round. A Human-approved large migration may continue; file and line
counts are advisory and must not become semantic CI gates.

### Semantic Cluster Sweep

The first valid semantic-drift finding is a signal to stop per-file correction
and sweep the whole causal cluster before scope freeze. This applies whether
the finding appears during discovery or during bounded exact-head closeout.

1. Inventory the cluster before editing again:
   - the approved current decision and canonical expression;
   - the canonical owner;
   - adjacent canonical docs, runtime-flow, Evidence Ledger, and tests;
   - current operational or PR prose that claims the active state;
   - derived docs and validation fixtures; and
   - historical or archived records that must remain unchanged.
2. Search the current-authority surface for stale phrases, synonyms,
   identifiers, and meaning variants. Record the search terms, inspected
   owners/paths, and excluded history boundaries so another reviewer can
   reproduce the sweep. `repo-wide` means repository-wide discovery bounded by
   this inventory, not indiscriminate editing of every match.
3. Correct valid findings as one causal batch unless the fifth-iteration
   ceiling retired the design. In that case, carry the completed inventory and
   classifications into the `design-reset` record and correct only in the new
   cycle. `cluster sweep complete` means
   the current decision and owner are identified, every inventoried
   current-authority surface was checked, each valid drift was corrected or
   classified as `needs-human-decision`; when the five-iteration ceiling
   applies, an uncorrected drift may instead be bound to the immutable
   `design-reset` record for correction in the next cycle. Every history
   exclusion must have a recorded reason.
4. Freeze scope only after the cluster sweep is complete. Do not start or
   resume exact-head certification before that new freeze.
5. A new valid semantic drift during exact-head closeout invalidates the
   current freeze and returns the work to discovery, sweep, and correction.
   The earlier certification is not a clean closeout basis. If the finding
   appears before a record is written, record `findings remain` and do not emit
   `clean`. If a clean record already exists for that head, append the required
   escape record and a later same-head `findings remain` review record so the
   canonical parser cannot keep accepting the earlier clean record. Certify the
   corrected content head only after a new sweep and freeze.

Dated reviews, Sufficiency Reviews, escape records, changelog or repository
history, governed `docs/archive/**` payloads, and immutable rollback evidence
are excluded from current-meaning correction by default. A historical-looking
file is not excluded when it claims current policy, current ownership, current
execution conditions, or current closeout authority. Current operational and
PR prose is not history merely because it was written earlier.

Use deterministic drift guards only for stable, mechanically distinguishable
expressions. Do not reduce semantic judgment to a string lint. Making cluster
metadata a machine-required merge condition or changing
`scripts/quality/check-review-closeout.mjs` verdict semantics belongs to
`quality-gate-steward`, not this workflow.

An observation refresh, revision/runRef rebind, deterministic evidence ordering
change, or usage-record append does not reopen the full discovery review unless
it also changes product/contract meaning, collector definition, authority
binding, or a frozen invariant. Review those evidence-only changes with a
bounded check of revision, runRef, definition digest, completeness, evidence
exit, and byte identity.

1. Classify each finding.
   - `valid`: current code/docs still have the issue.
   - `invalid`: reviewer assumption does not match current code.
   - `already-fixed`: current diff already covers it.
   - `needs-human-decision`: fixing it changes product/contract meaning.
2. Choose a root-cause-sufficient correction for each valid finding.
   - Trace what made the defect possible: missing propagation, wrong owner
     boundary, stale contract text, inadequate validation, false abstraction,
     unsafe fallback, or another concrete cause.
   - Fix at the owner boundary that prevents the same class of defect from
     recurring. Do not satisfy review by adding a local guard, one-off literal,
     or single call-site patch when the cause is shared assembly, contract
     drift, data-access shape, runtime-flow order, or gate coverage.
   - When multiple findings share one cause, prefer one structural correction
     over repeated per-finding patches.
   - Keep changes inside the reviewed workstream unless the finding proves the
     boundary itself is wrong. If the correct fix crosses that boundary, name
     the expanded owner, validation path, and affected artifacts before editing.
   - If a finding changes Promise, Aspect, Acceptance Check, Evidence Ledger, or
     runtime-flow meaning, route through Mission Control before editing.
3. Update the shared checklist when a finding is reusable.
   - Checklist entries live in
     [references/default-checklist.md](references/default-checklist.md); edit
     that file, not this one.
   - Do not wait for several local repeats before sharing a useful checklist
     entry. Add or merge it into the shared checklist immediately when it names
     a class of mistake another review could catch.
   - If an entry already exists, update its `frequency`, `importance`,
     `lastSeen`, or surface tags instead of adding a near-duplicate.
   - Keep local Project Knowledge for narrative handoff and one-off context, not
     as a promotion gate for checklist items. Use
     `npm run pk:remember -- --note "<korean_narrative>"` when the review
     reveals a durable process lesson.
4. Validate the cause path before broad gates.
   - Run the targeted test or command that exercises the original failure mode
     and the owner boundary changed by the correction.
   - For Story Chain ledger drift, run `npm run mc:trace-ledger -- --ledger <slug>`
     before broad `evidence-ledger:dry`. Run the broad command only when the
     change affects multiple ledgers, validator structure, or final closeout
     needs a full parse check.
   - Then choose the smallest honest repo gates from
     `docs/contract-maps/quality-gates.md` for the actual owner and risk path.
     A first-session load rail does not prove an unrelated endpoint's load or
     abuse boundary.
   - Assign each expensive command to one execution owner. Other reviewers
     inspect that result and artifact instead of repeating it. Repeat an
     expensive command at the same head only for a named different failure
     hypothesis or environment, and record that reason.
5. Re-run review after fixes when subagents or separated local reviewer roles
   are part of the task.
   - Continue until the latest review pass reports no new `valid` defects,
     subject to the Five-Iteration Design Reset ceiling.
   - If a pass returns only `invalid`, `already-fixed`, or
     `needs-human-decision` findings, record that classification instead of
     silently treating the loop as green.
   - Stop for user input when the remaining finding needs Human authority.
   - Before continuing after more than three review rounds, a repeated
     expensive gate at the same head, an evidence-only refresh that reopened
     discovery, or a large unplanned validation-cost increase, record a scope
     audit. The audit may narrow duplicate work but cannot override a finding,
     verdict, or required gate.
   - Apply `Five-Iteration Design Reset` before any sixth substantive review of
     the same implementation design. A fifth-iteration `valid` finding makes
     the current closeout `findings remain`; it cannot be converted to `clean`
     by another local patch cycle.
6. Report findings and fixes.
   - Lead with reviewer findings by severity.
   - Say which findings were root-cause fixed, rejected, already fixed, or left
     for human decision.
   - For fixed findings, name the cause that was closed and the validation that
     exercised it.
   - Include review coverage: code-level, architecture, database-load,
     server-load, security/privacy, contract/Story Chain, runtime-flow,
     UI/loading, analytics, overengineering, or other lenses that were relevant;
     mark each required lens as run, skipped with reason, or not applicable, and
     list any additional reviewer-chosen lenses separately.
   - Append one review record to
     [references/checklist-usage-log.md](references/checklist-usage-log.md) as
     `default-checklist.md` § Usage Records and Hit Rate instructs: the exact
     reviewed head, reviewer role, frozen closeout surface, applied groups,
     excluded lenses, per-entry hits, finding classification counts, validation
     commands and owner, closeout state, and any gap the checklist missed.
   - For PR, branch, or remote review loops, verify the latest pushed head
     before saying done, and state the closeout as `clean`, `findings remain`,
     or `stale` for that exact head. For local-only review loops, mark remote
     checks and thread resolution as not applicable instead of importing PR
     closeout work:
     - relevant remote checks have completed successfully, or expected skips are
       named;
     - unresolved, non-outdated review threads are zero after replies/resolves;
     - external bot review state (e.g. CodeRabbit) is recorded as reference
       input; late bot findings are triaged as escape records, not treated as a
       closeout precondition;
     - any dirty worktree changes are unrelated or intentionally left out.
   - Include only the validation commands that actually ran.

## Architecture Fitness and Least-Authority Review Bundle

Use this bundle when the reviewed branch changes `docs/architecture-fitness/**`,
privileged APIs, auth or principal creation, repository/domain-access
boundaries, service-role acquisition, trusted background/admin helpers, or a
guard that claims to prevent stronger-capability acquisition. Run it only after
the Architecture Fitness input and generated artifacts exist. Before delegating,
read [references/architecture-fitness-least-authority-review.md](references/architecture-fitness-least-authority-review.md)
completely. It defines the required code/authority, review-contract/evidence,
and overengineering/process roles, their finding shape, and their minimum
validation. A host with fewer review slots may combine roles, but the final
coverage report must keep all three lenses visible.

The root reviewer still classifies findings with the normal review loop and
re-runs every affected role after a fix changes its review surface. Do not claim
the bundle passed when a declared role or relevant lens was skipped.

## Default Checklist

Before applying the checklist, read
[references/default-checklist.md](references/default-checklist.md) completely.
It owns the entry shape, the lens groups (`root-cause`, `code`,
`load-security`, `overengineering`, `architecture`, `loading-ui`,
`async-client`, `observability`, `analytics`, `pagination`,
`layout-constants`, `skills-governance`, `story-chain`), and the usage-log /
hit-rate rule. Filter it by the files and contracts touched in the current
review; skip entries marked `covered` or `retired` unless the current diff
reopens the risk.

After each loop, append the usage-log line so hit rates accumulate. The
periodic skill review (`skill-governance-steward`) uses those hit rates to
retire or merge low-value groups and entries instead of letting the checklist
grow without pruning.

## Quarterly Lens Reclamation

Run lens reclamation with the shared quarterly audit envelope owned by
`skill-governance-steward` and the evidence attribution discipline in
`quality-gate-steward` § Quarterly Reclamation Audit.

1. Freeze the canonical usage log, checklist revision, and the
   `author-model` / `review-model` / `verdict-model` cohort. Historical labels
   that are not current checklist groups remain separate; do not guess a
   mapping to improve a hit rate.
2. Compute current-group applications and hit records from compacted counts
   plus the active tail. Entry-level retirement requires an entry-level
   application denominator that can be reconstructed honestly; a hit count
   alone is insufficient.
3. Apply the `applied >= 8`, zero-hit rule from
   `references/default-checklist.md`, then inspect severity, owner coverage,
   and whether another active entry or gate already covers the risk. Record
   `active`, `covered`, or `retired`; zero hits alone never forces retirement.
4. Reopen a `covered` or `retired` lens when its covering owner disappears,
   the retired surface returns, or any model role changes generation in a way
   that can change defect production, discovery, or verdict classification.
   Model-specific hit rates require at least one full quarterly cohort.
5. Admit external standards as named `candidate` entries, not bulk checklist
   imports. After the candidate reaches the same exposure threshold, use
   observed hits, severity, review cost, and overlap to activate, cover, or
   retire it.

## Review Closeout Status

The canonical definition of the three statuses is
`docs/agent-skills.md` § Review Closeout Status; on any wording conflict that
document wins. Operationally:

PR review closeout has exactly three states, derived from review records at the
exact reviewed head — never asserted as free prose:

- `clean`: every relevant reviewer role has a review record at exactly the
  current head and no valid findings or valid escapes remain unaddressed.
- `findings remain`: valid findings or valid escapes are open at the current
  head.
- `stale`: the head moved past the recorded reviews; every earlier `clean`
  claim is void until re-review.

Do not use a supported Architecture Fitness profile `healthy` as a synonym for
PR `clean` or "system healthy", and do not promote unsupported lenses
(`unknown`, Human-owned) through either. "findings 0" or "final clean" wording
without a matching review record at the exact head is not a valid closeout
claim. External bot reviews such as CodeRabbit are reference signals and escape
measurement input (issue #318), not closeout authority. Machine enforcement of
the closeout status on the merge path is owned by `quality-gate-steward`.

## Validation

Pick the smallest set that proves the causal path is closed:

```bash
npx vitest run <targeted-test> -t "<case>"
npm run format:check
npm run lint
npm run typecheck
npm run mc:trace-ledger -- --ledger <ledger-slug>
npm run mc:validate-story-chain
```

Do not run every command by habit. Explain when a broad gate is chosen over a
targeted one.
