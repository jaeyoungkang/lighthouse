---
name: quality-gate-steward
description: Use when adding, editing, reviewing, or debugging Light House verification gates, quality gates, CI gate wiring, `quality:*` scripts, mutation testing, negative-test markers, hardening-tier policy, evidence-ledger dry/full gate behavior, or validation documentation. Keeps gate changes scoped, non-bypassable, and aligned with Story Chain release semantics.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Quality Gate Steward Skill

Use this skill when the work changes how Light House proves a contract, blocks a
release, or validates agent output. This includes package scripts, CI workflow
gate order, mutation configs, negative-test markers, hardening
policy, and verification documentation.

## Read First

- `docs/ci-structure.md` — where a validation runs and where a new one goes
- `docs/verification-gates.md` — Sufficiency Review hardening gate semantics
- `docs/contract-maps/quality-gates.md`
- `docs/contract-maps/quality-gate-records.md` — dated reclamation evidence
- `docs/principles.md` §0 and §0.1
- `package.json` scripts
- relevant files under `scripts/mission-control/`, `scripts/quality/`,
  `.github/workflows/`, or mutation config files

When the gate claims coverage of Experience, Moment, Promise, Aspect, or
Architecture Fitness policy documents, also read
`shared-skills/mission-control/references/contract-layer-routing.md`. Keep
deterministic graph/schema checks separate from the required semantic
policy-body review in its `## Policy Document Validation` section.

If the gate changes Story Chain meaning, use Mission Control first.

## Workflow

1. Classify the gate:
   - formatting/static code;
   - Story Chain graph;
   - Evidence Ledger dry/full runner;
   - surface/event audit;
   - static/live judge;
   - mutation or negative test;
   - Project Knowledge or skill sync guard.
2. Identify what false pass the gate prevents.
3. Decide whether this is a new gate, a stricter existing gate, a docs-only
   explanation, or a repair to stale wiring.
4. Prefer strengthening the canonical gate over adding an ad hoc script.
5. Keep PR-local, full, and nightly gate costs explicit.
6. Update docs and contract maps when gate relationships change.
7. Run the smallest command set that proves the changed gate path.

## Quarterly Reclamation Audit

Once per quarter, audit the current `guard:*` and `mc:*` inventory instead of
letting verification rules grow without measured cost or recovery evidence.
Append the dated result to
`docs/contract-maps/quality-gate-records.md`; do not create another registry or
append dated inventory snapshots back to the active navigation map.

1. Freeze the exact inventory and content head from `package.json`.
2. Use the interval after the previous audit. For the first audit, record the
   bounded GitHub Actions sample and its exact start/end timestamps.
3. Attribute a CI failure only to the last failing command in its responsible
   job. Do not charge every command that ran earlier in a composite step.
4. For each command, record its unique release or operator value, one
   reproducible execution-cost snapshot, attributed CI failure count, follow-up
   diff direction, verdict, and representative links.
5. Use `회수` when the follow-up fixes a product defect or adds a test that
   reproduces that defect. Use `헛경보` when it only repairs gate logic,
   allowlists, or execution support and any added test pins only that gate
   execution contract. Use `회색` when recovery and recurring noise coexist,
   and `증거 부족` when the evidence does not support a verdict.
6. Keep operator queries, maintenance writes, and process checkpoints whose
   expected state is failure in separate lanes. Their raw failure count is not
   product-defect recovery.
7. List consolidation or retirement candidates and count rules consolidated or
   removed during the same interval. Zero observed failures alone is never a
   retirement verdict.

Local commit-time failures that never reach CI are unobservable. State that
undercount explicitly. When a command was added or retired during the interval,
also state that exposure counts differ.

### Standards Candidate Intake

Use the same quarterly interval and output envelope for framework and
architecture standard candidates. This is intake into existing owners, not a
second gate registry.

- Framework track: diff the installed React/Next.js/TypeScript documentation,
  ESLint presets, and enabled rule set against the prior audit. Evaluate one
  new or materially changed rule at a time with its exact source/version,
  repository violations, positive and negative fixtures, reproducible cost,
  overlap, and false-positive evidence. A preset upgrade does not bulk-promote
  every new rule.
- Architecture track: route a candidate to the existing CAIR, Architecture
  Fitness, dependency-cruiser, or review-architecture owner. Do not create a
  parallel classifier or guard. Unsupported Architecture Fitness lenses remain
  `unknown` and Human-owned.
- Coverage track: read the exact `coverage.include` inventory and thresholds
  from the active Vitest config. Record files added, removed, or renamed and
  decide `maintain`, `expand`, or `retire` per cohort. Never describe a
  whitelist threshold as repository-global coverage.
- Prose-rule track: for each convention without a dedicated checker, record
  whether an imported rule already enforces it, an honest deterministic guard
  is proportional, the rule remains an intentional review heuristic, or the
  convention should retire. For negative and retired-shape rules, use
  `docs/principles.md §6` and `review-checklist-steward` `root-cause-09`.
  Record phrase-presence or phrase-absence tests separately from behavior,
  capability, or state-transition evidence. Do not add an AST
  guard for a type- or context-dependent judgment merely to turn prose into a
  count.

## Cost and orchestration

- Treat `test:unit`, build/typecheck, and Architecture Fitness recollection as
  heavy commands. Run them serially in one local closeout instead of launching
  competing top-level processes.
- `npm run architecture-fitness:advisory` recollects and validates every active
  profile before its unsigned evaluation. Do not run
  `architecture-fitness:validate` immediately before it; both commands repeat
  the same exact-revision collection.
- Neither full command is a default closeout step. Run one only when the change
  modifies Architecture Fitness policy, checked observation fixtures,
  collector/adapter/profile/core/trust semantics, or must diagnose their
  deterministic recollection. General product changes use the blocking
  least-authority·state-boundary guards in `quality:guards` and affected tests;
  they do not run protected attestation.
- When both the normal fast gate and a justified local Architecture Fitness
  advisory are required, one execution owner runs `quality:fast` and then the
  advisory. Heavy attestation is an operator-requested protected-main exact
  rebind whose target workflow and collectors are authoritative without a
  previous-main collector-identity bootstrap. Do not add a composite quality
  profile for that one-off pairing.
- `architecture-fitness:validate` is a validation-only alternative, not a
  cheaper prerequisite: it recollects the same fixed observation set. Do not
  run it merely because a PR has ordinary code or record changes.
- One named execution owner runs each heavy command. Other reviewers consume
  its artifact; duplication requires a different stated failure hypothesis or
  environment.

## Boundaries

- Do not disable, narrow, or skip a gate to make a change pass.
- Do not mark a gate green from simulated output when the contract requires
  real runtime output, rendered DOM, or executable evidence.
- Do not silently move a blocking gate from `quality:fast` to a non-blocking
  path.
- Do not update baselines except through the documented explicit baseline
  command.

## Validation

Always run the gate you changed. Also run:

```bash
npm run format:check
npm run mc:validate-story-chain
```

When package quality scripts or skill sync are touched, include:

```bash
npm run quality:guards
```
