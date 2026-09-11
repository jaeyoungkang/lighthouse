---
name: skill-governance-steward
description: Use when creating, editing, retiring, consolidating, or reviewing Light House repo-local skills and agent-process governance, including Concept Shift Architecture Review routing, skill routing, Project Knowledge operating rules, AGENTS.md agent-process guidance, workflow ownership taxonomy, deciding whether a distinct workflow should become a skill, whether an existing skill should absorb it, whether Project Knowledge or the shared review checklist is enough, periodic skill audits, trigger/frontmatter quality, generated-copy sync, and overengineering checks.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Skill Governance Steward

Use this skill for the lifecycle of repo-local skills. The goal is to keep
skills useful and scarce: enough procedure for agents to act well, not a new
skill for every recent lesson.

## Dedicated Process Sessions

The separation policy for process workstreams, intended-effect classification,
local-only process insights, and self-unblock checkpoints is owned by
`docs/agent-skills.md#skill-lifecycle`. This skill executes that policy after the
navigation layer routes a process-governance task here; it does not define a
second copy of the policy.

Actual verification-gate semantics, CI wiring, `quality:*` scripts, and
validation documentation still route through `quality-gate-steward`. If that
work also changes agent routing or workflow ownership taxonomy, keep the session
scoped as process governance and use both stewards in sequence.

At entry, follow that owning policy, load Project Knowledge, state the process
surface being changed, name the canonical files that may be edited, and keep
validation focused on process governance plus any affected steward. Determine
scope from the intended effect and the canonical owner; path heuristics do not
replace that judgment.

## Skill Decision

Classify the repeated lesson before editing files:

| Route                 | Use when                                                                         |
| --------------------- | -------------------------------------------------------------------------------- |
| update existing skill | a current skill already owns the workflow                                        |
| new skill             | a distinct workflow recurs, has its own triggers, and changes agent behavior     |
| review checklist      | a repeated implementation or review mistake can be caught by checklist filtering |
| Project Knowledge     | the memory helps future work but does not define a repeatable procedure          |
| docs/conventions      | the rule is broad engineering policy, not a callable workflow                    |
| reject                | the lesson is one-off, too narrow, or already enforced by code/gates             |

Prefer updating an existing skill. Create a new skill only when the trigger,
workflow, and validation are clearly different from current skills.

For retirement lessons, decide whether the lesson belongs in a workflow skill or
the shared review checklist by the point where it should fire:

- If agents must decide compatibility before editing, update the owning workflow
  skill, usually Mission Control or a steward skill.
- If reviewers must catch missed propagation after implementation, update
  `review-checklist-steward`.
- If the lesson is only about one product surface's historical data shape, keep
  it in Project Knowledge or the surface's contract docs unless it recurs.

## Candidate Signals

During implementation or review, consider a skill candidate when at least two
workflow signals appear. A repeated implementation mistake by itself is not a
skill signal; put it in the shared review checklist and update its frequency or
importance.

- a workflow requires a non-obvious read order;
- a task needs a reliable handoff between Codex and Claude;
- a process has specific validation commands;
- a local rule is too operational for Project Knowledge but too procedural for
  `docs/conventions.md`;
- subagent review finds missing trigger terms, drift, or over-sliced skills.

Do not create a skill only because a task was important once.

## Authoring Rules

1. Name the skill in lowercase kebab-case.
2. Keep `SKILL.md` concise. Move long background into `references/` only when it
   will be loaded conditionally.
3. Make frontmatter `description` trigger-rich. Include user phrases, file
   paths, and workflow nouns that should load the skill.
4. Put boundaries near the top: what the skill does not replace, when to route
   to Mission Control, and when to stop.
5. Include the smallest honest validation set.
6. Avoid duplicating large instructions from another skill. Link or defer
   instead.
7. If the skill creates behavior shared by Codex and Claude, edit
   `shared-skills/<name>/` only and sync generated copies.
8. For any skill that governs retirement, include an explicit compatibility
   decision step. Use the vocabulary and meanings owned by
   `docs/agent-skills.md` § Concept Shift Architecture Review by pointer; the
   skill should say where the decision is recorded and which artifacts must
   match it.
9. For an externally owned skill, keep one portable package byte-for-byte aligned
   with an exact source revision. Record package version, source repository,
   revision, package hash, unpacked tree hash, install command, and integrity
   check outside the package. Do not commit a second unpacked source tree or edit
   external core semantics in `shared-skills/`. Rebuild the package from a clean
   exact upstream revision and sync generated runtime copies afterward.

## Review Cadence

Run a skill review when any of these happen:

- three or more repo-local skills change in one workstream;
- a new skill is added;
- subagents or reviewers report missing triggers or overengineering;
- `.claude/skills` or `.agents/skills` contains generated-copy drift;
- the shared review checklist keeps exposing a workflow gap that cannot be
  handled by checklist filtering alone;
- before a large agent-process PR is considered done.

Feed the review with accumulated evidence, not only recollection:

- Read the skill-use lines from the local work-memory log with
  `npm run pk:log -- --tail <N> --all` or
  `rg --glob 'work-memory-log*.jsonl' '스킬 사용:' .project-knowledge-local`.
  The line format is owned by
  `docs/project-knowledge/README.md` § 스킬 사용 기록. They are invocation
  evidence only; absence is not evidence of non-use, and frequency alone does
  not establish effectiveness.
- Record a skill routing miss at the moment it is noticed — wrong skill loaded,
  missing trigger phrase, duplicate or stale registration (including host-level
  copies outside the repo) — as
  `스킬 라우팅 miss: <what loaded / what should have loaded>` in the next
  required `pk:remember` note. Follow the batching rule owned by
  `docs/project-knowledge/README.md` § 스킬 사용 기록. These notes are review
  input, not immediate skill edits.
- Read the review-checklist usage log
  (`shared-skills/review-checklist-steward/references/checklist-usage-log.md`)
  and compute per-group hit rates. Retire or merge low-hit checklist groups and
  entries by that file's rule instead of letting the checklist accumulate.
- Audit every repo-local `references/` tree, not only
  `review-checklist-steward`: inventory file and line counts, confirm every
  reference is reachable from its owning `SKILL.md`, inspect stale owner or
  source pointers, and keep generated copies synchronized. Large reference
  count alone is not a retirement signal.
- Audit repeated exclusions, prohibitions, and retired-shape advice in current
  skills with `docs/principles.md §6` and the common
  `review-checklist-steward` `root-cause-09` classification. Consolidate
  current agent behavior at the owning skill or navigation source. Do not use
  phrase count reduction or zero observed failures as a retirement signal.
- Run the frozen routing corpus at `references/skill-routing-corpus.json` with
  `npm run skill:routing-eval`. Generate blind predictions from
  `--emit-evaluation-prompt`, score them with
  `--score`, and record first-route accuracy, required-route recall,
  allowed-route precision, forbidden selections, unknown routes, model id,
  corpus schema, input/evaluation-spec/routing-source digests, and advisory
  provenance heads.
  Opaque ids use a frozen order that separates overlap pairs. Prediction
  envelopes bind to the three digests and unknown routes are hard failures.
  Commit the exact opaque inputs, canonical model id, prediction envelope, and
  score plus their model/input/prediction seal in
  `references/skill-routing-evaluation.json`; the default gate rescores and
  verifies that artifact. Prompt-emission and supplied-score modes bypass the
  stale stored artifact and use the current committed-source digest so the
  replacement can be produced before the default gate is green. Branch-only
  provenance heads need not survive squash merge.
  Because the corpus test runs in the blocking `test` job, frontmatter or
  First-Route changes require a fresh blind evaluation in the same PR.
  The corpus includes the `about-prose`/`korean-prose`,
  `mission-control`/`runtime-flow-sync`, and
  `contract-map-steward`/`runtime-flow-sync` overlaps. Corpus schema success
  alone is not routing-effect evidence.
- Keep one explicit no-skill negative control for ordinary implementation work.
  It uses `expectedFirstRoute: null`, and blind predictions must return
  `firstRoute: null` with no additional routes. Any selected skill is a hard
  forbidden selection so the harness does not reward unnecessary skill use.
- Join invocation evidence to existing closeout, escape, design-reset, and
  required-output records only by stable `workstream-root`. Report missing
  joins and selection bias. Difficult work is more likely to invoke a steward,
  so a low clean ratio without a comparable unassisted cohort cannot establish
  harm.

For review, use at least three lenses:

1. overlap and consolidation;
2. trigger gaps and missing routes;
3. operational burden and validation drift.

Subagents are appropriate for these lenses when the user authorizes them or the
active workflow already requires role-separated review.

## Maintenance Workflow

1. Inspect current skill inventory:

```bash
find shared-skills -mindepth 1 -maxdepth 2 -name SKILL.md -print | sort
```

2. Search for stale skill names and unmanaged runtime skills:

```bash
rg -n "<old-skill-name>|<candidate-term>" AGENTS.md docs shared-skills .agents/skills .claude/skills scripts package.json -S
for d in .claude/skills/* .agents/skills/*; do if [ -d "$d" ] && [ ! -f "$d/.skill-sync-generated" ]; then echo "$d"; fi; done
```

3. Edit only `shared-skills/<name>/` for canonical skill content.
4. Update `docs/agent-skills.md` and `AGENTS.md` routing when triggers or
   taxonomy change.
5. Sync generated copies:

```bash
python3 scripts/sync-agent-skills.py --prune
```

6. Validate:

```bash
npm run format:check
npm run guard:skills
npm run pk:validate
```

If the skill affects Story Chain, Contract Maps, or quality gates, also run the
relevant steward's validation commands.

## Periodic Audit Output

Run this audit on the same quarterly cadence as
`quality-gate-steward` § Quarterly Reclamation Audit. Keep one shared evidence
envelope while preserving each owner's verdict vocabulary:

```text
Inventory and exact head:
Interval and sample:
Unique value / expected effect:
Observed use and outcome evidence:
Reproducible cost:
Follow-up diff direction:
Owner verdict:
Consolidate / add / retire candidates:
Rules or references added / removed:
Limitations:
Representative links:
Next action and recheck trigger:
```

### Sampled workstream evidence

Process-effectiveness evidence is collected only for a workstream that the
Human or the current `skill-governance-steward` process session names before
implementation begins. Ordinary work remains unchanged when it is not selected.
Put the sampled evidence in the workstream's existing durable issue or PR using
[references/process-effectiveness-evidence.md](references/process-effectiveness-evidence.md).
Do not create a parallel registry, require a new file in every PR, or turn an
unrecorded field into a merge failure.

The selection comment is separate from the evolving evidence block and is not
edited after selection. It names the sampling-frame candidates and inclusion
rule, exact workstream, eligibility basis, sample class, and actual Human or
process-session identity. Its evidence references are exact commits or unedited
comments, not mutable pages. An edited or unprovable selection is retained but
excluded from the prospective cohort, as are retrospective dry replays. Keep
abandoned and cancelled preselected workstreams in the sampling frame so the
audit cannot silently select only completed outcomes.

The implementation owner maintains active-authoring segments and repeated
authoring overlap. The execution owner maintains local command intervals, CI
run ids, and repeated heavy-command overlap. The review owner keeps canonical
aggregate verdicts in the existing review usage record and adds only the
per-defect audit supplement to the issue or PR block. Unknown, not-applicable,
measured-zero, and nonzero observations remain distinct; they are not
reconstructed from PR wall time, empty arrays, or final aggregate counts.

At the periodic audit, join sampled blocks, exact-head review records, and CI
runs by `workstream-root`. Count qualifying route-miss occurrences separately
from affected distinct PRs. Compare multi-owner samples with ordinary/no-skill
samples before making an effectiveness claim. Use the bounded decision protocol
below. It supports a repository-local Human operating decision; it does not
support a statistical or independent causal-effect claim.

### Bounded effectiveness decision

The adopted verification set has four prospective samples:

- two `ordinary-no-skill` samples;
- two `multi-owner` samples with materially different owner shapes: one must
  propagate a contract decision into UI, API, or runtime owners, and one must
  cross database or repository ownership together with an operational owner.

If the four samples disagree or leave cost proportionality unresolved, select
one prospective tie-breaker before implementation. Stop after that fifth
sample. Do not expand this decision into a 20–30 PR cohort.

The Human can declare the installed implementation method effective for current
repository use only when all of the following hold:

- both ordinary samples have zero unnecessary specialist-process entries;
- both multi-owner samples identify every core owner before implementation;
- no sample has a late qualifying route miss that causes material redesign or
  rework during exact-head review or CI;
- no sampled change has a linked post-merge escape;
- the Human judges measured process cost proportional to the implementation and
  containment value.

One severe route miss or design reset immediately yields `reconfigure`; do not
wait for the remaining samples. After the bounded decision closes, two
qualifying route-miss occurrences trigger a new Human review of routing and the
minimal machine router, regardless of how many PRs have elapsed. Report the
occurrence count and affected distinct PR count separately. Do not reactivate a
router automatically.

For skills, the owner verdict uses the usage × effect matrix (`maintain`,
`reconfigure`, `maintain-niche`, `retire`, or `insufficient-evidence`). For
review lenses, keep `candidate` / `active` / `covered` / `retired`. For gates,
keep the Korean reclamation verdicts owned by `quality-gate-steward`. Do not
collapse these vocabularies into one status.

Record durable conclusions with `npm run pk:remember`. Promote only stable,
repo-wide operating lessons to `docs/project-knowledge/shared-memory.md`.
