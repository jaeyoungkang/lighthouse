# Agent Skills

Light House keeps repo-local skills only for workflows that must stay aligned
with Story Chain or Light House-specific operating practice.

## Canonical Skills

| Skill | Source | Generated targets |
| --- | --- | --- |
| `aspect-steward` | `shared-skills/aspect-steward/` | `.agents/skills/aspect-steward/`, `.claude/skills/aspect-steward/` |
| `about-prose` | `shared-skills/about-prose/` | `.agents/skills/about-prose/`, `.claude/skills/about-prose/` |
| `analytics-event-steward` | `shared-skills/analytics-event-steward/` | `.agents/skills/analytics-event-steward/`, `.claude/skills/analytics-event-steward/` |
| `architecture-fitness-review` | external-managed portable archive `shared-skills/architecture-fitness-review.skill` | `.agents/skills/architecture-fitness-review/`, `.claude/skills/architecture-fitness-review/` |
| `branch-review-response` | `shared-skills/branch-review-response/` | `.agents/skills/branch-review-response/`, `.claude/skills/branch-review-response/` |
| `contract-map-steward` | `shared-skills/contract-map-steward/` | `.agents/skills/contract-map-steward/`, `.claude/skills/contract-map-steward/` |
| `external-research` | `shared-skills/external-research/` | `.agents/skills/external-research/`, `.claude/skills/external-research/` |
| `glossary-steward` | `shared-skills/glossary-steward/` | `.agents/skills/glossary-steward/`, `.claude/skills/glossary-steward/` |
| `jaeyoung-think` | `shared-skills/jaeyoung-think/` | `.agents/skills/jaeyoung-think/`, `.claude/skills/jaeyoung-think/` |
| `korean-prose` | `shared-skills/korean-prose/` | `.agents/skills/korean-prose/`, `.claude/skills/korean-prose/` |
| `mission-control` | `shared-skills/mission-control/` | `.agents/skills/mission-control/`, `.claude/skills/mission-control/` |
| `product-discovery-steward` | `shared-skills/product-discovery-steward/` | `.agents/skills/product-discovery-steward/`, `.claude/skills/product-discovery-steward/` |
| `project-knowledge` | `shared-skills/project-knowledge/` | `.agents/skills/project-knowledge/`, `.claude/skills/project-knowledge/` |
| `quality-gate-steward` | `shared-skills/quality-gate-steward/` | `.agents/skills/quality-gate-steward/`, `.claude/skills/quality-gate-steward/` |
| `review-checklist-steward` | `shared-skills/review-checklist-steward/` | `.agents/skills/review-checklist-steward/`, `.claude/skills/review-checklist-steward/` |
| `runtime-flow-sync` | `shared-skills/runtime-flow-sync/` | `.agents/skills/runtime-flow-sync/`, `.claude/skills/runtime-flow-sync/` |
| `skill-governance-steward` | `shared-skills/skill-governance-steward/` | `.agents/skills/skill-governance-steward/`, `.claude/skills/skill-governance-steward/` |
| `story-chain-contract-steward` | `shared-skills/story-chain-contract-steward/` | `.agents/skills/story-chain-contract-steward/`, `.claude/skills/story-chain-contract-steward/` |
| `structural-audit` | `shared-skills/structural-audit/` | `.agents/skills/structural-audit/`, `.claude/skills/structural-audit/` |
| `vignelli-command-ui` | `shared-skills/vignelli-command-ui/` | `.agents/skills/vignelli-command-ui/`, `.claude/skills/vignelli-command-ui/` |

`shared-skills/` is the editable source for Light House-owned skills. The
generated runtime directories are ignored by Git and recreated by the
`postinstall` lifecycle during `npm install` or `npm ci`; they must not be edited
directly. `architecture-fitness-review` is the external-managed exception. The
repository commits the upstream portable `.skill` archive and provenance file,
not its unpacked source tree. `scripts/sync-agent-skills.py` verifies the archive,
extracts it into both runtime directories, and checks the generated files.
`shared-skills/architecture-fitness-review.provenance.json` records the package
version, source revision, archive digest, unpacked tree digest, and per-file
hashes.

## Sync

```bash
python3 scripts/sync-agent-skills.py --prune
npm run guard:skills
npm run pk:validate
```

Fresh checkouts normally receive the generated roots through `npm ci`. Run the
same sync command directly after changing a shared skill when the current
runtime must see the edit before the next package install:

```bash
python3 scripts/sync-agent-skills.py --prune
npm run guard:skills
npm run pk:validate
```

## Product-Level Judgment

Use `jaeyoung-think` only when a Human wants to form a scoped product-level
choice or explicitly reopens a product decision. Raw feedback, unclear requests,
ideation, and local UX observations go through `product-discovery-steward` first.
The `jaeyoung-think` output is a proposal with pending Human approval, not an
approved decision. Its scope includes product direction, user-facing behavior,
product policy, AI product autonomy and relationship design, positioning, and
product-level prioritization.

It does not own architecture, data flow, DB access, repository boundaries,
runtime placement, cache strategy, refactoring, debugging, quality gates, or
other technical implementation decisions. The implementation author owns the
local technical choice under the canonical engineering documents and must route
runtime, gate, analytics, security/privacy, operational, or contract effects to
the affected workflow owner.

Do not use `jaeyoung-think` to recall, locate, summarize, or explain an existing
product decision or its rationale. Retrieve that context from Project Knowledge,
canonical docs, `rg`, `git log`/`git show`, or issue/PR history. If new evidence
may invalidate the decision, report the evidence and ask whether the Human wants
to reopen it. Do not reopen it autonomously.

## Contract Architecture Impact Review

Open a Contract Architecture Impact Review after Human authority makes a new or
meaning-changed user- or operator-facing Story Chain contract explicit and
before the agent propagates child contracts, Evidence Ledger rows, runtime docs,
or code. The review is required when an Experience, Moment, Promise, Acceptance
Check, or Aspect changes an expectation along interaction timing; domain/data
shape; source of truth or authority; state lifetime, persistence, recovery, or
history; ordering, concurrency, idempotency, or cancellation; runtime placement,
provider/tool/AI boundaries and failure policy; security/privacy; fan-out,
capacity, cost, or SLO; observability identity/cardinality;
compatibility/retirement; or a shared invariant across several product
surfaces.

Choose one verdict: `none`, `constrain-existing`, or `reshape`. Every record uses
the exact `## Contract Architecture Impact Review` heading in a durable issue/PR
plan or body, contract artifact, or runtime-flow doc. A `none` record needs the
contract delta, affected axes, and evidence that current boundaries already
support it. `constrain-existing` and `reshape` also require current owners,
chosen structural rules, a rejected alternative, and the evidence/structural
defense plan. Do not create a parallel architecture-impact registry. The full
trigger, verdict, and routing procedure lives in
`shared-skills/mission-control/references/contract-architecture-impact-review.md`.

Copy, layout, or qualitative output wording alone does not trigger the review.
If a `reshape` verdict can preserve a retired product model, also run the
Concept Shift Architecture Review below. The Agent may classify structural
impact only inside approved product meaning. If a tradeoff would change that
meaning, stop and return the choice to Human authority.

After CAIR or Concept Shift, use Mission Control's propagation scope control
before implementation when the verdict is `reshape`, a shape is marked
`remove`, multiple owning contract bundles are involved, a cache/state
lifecycle appears, or the forecast reaches a checkpoint. The durable
Propagation Map distinguishes owning edits from inspect-only downstream impact,
compatibility, and split cleanup. Its size thresholds trigger a Human scope
choice; they are advisory and must not become semantic CI gates. The existing
Story Chain validator may block stable owner invariants such as a new
Sufficiency Review citing AC/IC refs outside its ledger's `Source Promises`.

Every triggered review, including `none`, receives a role-separated
`architecture-impact reviewer` before closeout. That reviewer owns record
presence/completeness and, for `constrain-existing` or `reshape`, traces the
evidence and structural defense into the affected owner.

### Product and architecture content placement

After Human meaning and any required CAIR are explicit, classify
architecture-shaped Promise, Acceptance Check, and Aspect clauses with
`shared-skills/mission-control/references/product-architecture-content-ownership.md`.
Use `KEEP`, `SPLIT`, `MOVE`, or `EVIDENCE`. Keep visible result, lifetime,
restore/replay, recovery, degraded/failure, access, privacy, source-authority,
and latency meaning in Story Chain. Move replaceable runtime/engineering
mechanism and exact evidence references to their canonical owners. Preserve
Promise, Acceptance Check, and Aspect ids when meaning is unchanged.

Technical identifiers are triage signals rather than automatic violations.
User-visible URLs/routes and declared operator commands can be contract
surfaces. Contract Maps remain derived navigation. Architecture Fitness policy
is a minimal projection of approved desired structure, and observations contain
exact-revision facts only.

### Architecture Fitness execution

This subsection owns the current pinned case-kind and active Lighthouse profile
routing. CAIR remains the only impact-classification authority. Use
`architecture-fitness-review` after CAIR when the task must verify an executable
policy against current code. Before deciding whether a statement belongs to
Story Chain, an engineering/runtime owner, or an Architecture Fitness policy,
follow
`shared-skills/mission-control/references/contract-layer-routing.md`. The pinned
v0.9.1 core supports `least-authority`,
`state-boundary`, `serialized-input-budget`, `topology-scope`, `critical-path`,
`workload-envelope`, `technical-grain`, and `cache-lifecycle`, but core support
does not activate a Lighthouse profile. The active registry is
`scripts/architecture-fitness/lighthouse-profiles.mjs`; it currently contains
`issue-278-least-authority`, `issue-276-search-state-boundary`, and
`issue-276-relationship-state-boundary`, `issue-280-281-q2-macro`, and
`issue-286-q3-workload`, `issue-297-q4-technical-grain`, and
`issue-298-q5-cache-lifecycle`, and `issue-399-serialized-input-budget`,
`issue-401-gap-shared-state-boundary`, and
`issue-401-inline-analysis-cache-lifecycle`. Issue #399
profile은 Search-first 조건 URL의 애플리케이션 내부 직렬화 경계만 지원한다. Platform pre-app
request-target, capacity·throughput, 다른 architecture lens는 `unknown`이다. Unsupported cache
fleet·production, product-outcome, decision-fitness, and process-effectiveness coverage also
remains `unknown`.
Verdict/evidence semantics and attestation authority are owned by the installed
`.agents/skills/architecture-fitness-review/SKILL.md`, its `references/`, and
`docs/architecture-fitness/README.md`; this document only routes into them.
Full local recollection is not a default closeout step. Policy, collector,
adapter, profile, checked observation, core, trust, or evaluation-semantics
changes use one justified `architecture-fitness:advisory` or
`architecture-fitness:validate` run. Ordinary product changes use the
least-authority·state-boundary guards already inside `quality:guards` and
affected negative tests. Heavy authoritative attestation runs only as an
operator-requested protected-main exact rebind; it uses the protected target
workflow·collector and does not require previous-main collector identity as a
bootstrap prerequisite. Record-only changes use neither full local recollection
nor a carried-forward machine verdict.

## Review Closeout Status

This section applies to verification review that evaluates defects or
merge/release readiness. Advisory consultation that gathers opinions, compares
models, or critiques an early idea, draft, or diff does not create exact-head
review records and does not use `clean`, `findings remain`, or `stale`.

Every review report, PR body, and closeout keeps three statuses separate
(issue #318):

| Status | Values | Owner |
| --- | --- | --- |
| Supported profile verdict | `healthy` / `degraded` / `unknown` | `architecture-fitness-review`, `docs/architecture-fitness/README.md` |
| Unsupported lenses | `unknown`, Human-owned | Human decision |
| PR review closeout | `clean` / `findings remain` / `stale` | review records in `shared-skills/review-checklist-steward/references/checklist-usage-log.md` |

A supported profile `healthy` is not "system healthy" and is not PR `clean`.
`clean` may be declared only when every relevant reviewer role has a review
record at exactly the current content head and no valid findings or valid
escapes remain; a new content commit makes prior `clean` claims `stale`.
Trailing usage-record commits do not advance the content head. A target-base
update merge is likewise skipped so long as it adds no branch-owned content;
conflict-resolution content remains a documented gate limitation and requires
bounded evidence review. "findings 0" or "final clean" prose without a matching
review record at the exact content head is not a valid closeout claim. External
bot reviews such as CodeRabbit are reference signals and escape measurement
input, not closeout authority; merge-path enforcement of the closeout status
is owned by `quality-gate-steward`.

Substantial review moves through `discovery review → findings classification
and correction → scope freeze → bounded exact-head closeout`. After scope
freeze, evidence-only rebinds and usage-record appends receive bounded evidence
review unless they change meaning, collector definition, authority binding, or
a frozen invariant. Each expensive command has one execution owner. More than
three review rounds, duplicate same-head heavy commands, or an evidence-only
change reopening discovery requires a scope audit; the audit cannot suppress a
finding or change a verdict. Review records track a shared `design-cycle` and
`iteration` under a stable `workstream` for every role that inspects the same
implementation state. One design receives at most five substantive iterations:
if iteration five finds a new valid defect, the closeout stays
`findings remain`, the implementation approach is retired, and no sixth review
of that design is allowed. A new cycle requires an immutable `design-reset`
record, an exact retired-state commit reachable through a shared workstream,
PR, or forensic ref, and explicit `preserve` / `migrate-read-only` / `remove`
compatibility verdicts. A local-only stash or reflog is not reset evidence. The
next cycle references that retired state, preserves approved requirements,
Human decisions, and implementation-independent counterexamples, but
re-derives owners, dependencies, abstractions, and validation from the
canonical sources. When iteration five exposes semantic drift, the old cycle
completes the cluster inventory but applies corrections only in the new design.

If one canonical workstream root retires three distinct, chained design cycles
because each cycle's fifth iteration found a new valid defect, implementation
stops before cycle four. A Human countermeasure meeting examines the three
retired states, recurring assumptions, owner-boundary errors, and review gaps.
Every outcome is recorded in `countermeasure-decision`, including abandon or
split. A new design requires a later `countermeasure-restart` activation that
proves every restart condition, carries Human activation approval, and links
cycle four to the third retired state. Branch, PR, task-label, reviewer, or
workstream aliases do not reset the count. A split receives a new root only
when the Human decision records non-overlapping outcomes and scope deltas.

The prospective boundary is the first protected-main commit containing the
`three-cycle-countermeasure-stop-v1` transition record. Only grandfather
records already present in that revision are valid. A grandfathered workstream
may finish its named already-started cycle, but must stop before another cycle
if that cycle also retires at iteration five. Pre-effective qualifying resets
remain part of the count. A later approved restart begins the next numbered
cycle from the latest retired state. Record formats, Human-owned enforcement,
and exact restart rules are owned by `review-checklist-steward`; merge-path
chain enforcement remains a separate `quality-gate-steward` decision.
If a restarted cycle also retires at iteration five with a new valid finding,
the workstream stops again and requires fresh decision and activation records.

The first valid semantic-drift finding triggers a current-authority semantic
cluster inventory and sweep before scope freeze. If a new valid drift appears
during exact-head closeout, the freeze is invalid and the work returns to
discovery/correction; historical and archived records stay excluded unless they
claim current policy, ownership, execution conditions, or closeout authority.
The operational inventory, record metadata, and exclusion rules are owned by
`review-checklist-steward`.

## Concept Shift Architecture Review

Open a Concept Shift Architecture Review when the product model's central noun
changes, or when an existing route group, client store, repository boundary, DB
shape, runtime-flow owner, or analytics subject can preserve a retired product
model. The review happens before implementation work that would otherwise build
on the old shape by default.

Record each affected shape with one verdict:

| Verdict | Meaning |
| --- | --- |
| `preserve` | The shape has a present-tense role in the current product model. |
| `migrate-read-only` | The shape remains only for migration, compatibility, or historical reads. |
| `remove` | The shape belongs to the retired product model and should leave active runtime ownership. |

The record belongs in the owning close-out note, issue/PR plan, contract
artifact, or architecture map that the work already uses. Do not create a new
parallel backlog for the review. If the concept shift changes user-facing
meaning, enter Mission Control first and keep Story Chain, Evidence Ledger, and
code/test propagation in the same workstream. If the work changes the agent
process or routing rules for this review, use `skill-governance-steward` in a
dedicated process session. After implementation, use `review-checklist-steward`
to catch hidden renamed shapes or stale retired terminology.

## First-Route Rules

Use these rules when a task could match more than one skill:

| Input shape | First skill |
| --- | --- |
| Ordinary code or test refactor that does not change product meaning, DB/repository boundaries, runtime order, analytics, quality gates, or another owned workflow | No repo-local skill is required; the implementation author starts at `docs/implementation.md` and follows the owners it points to. If discovery crosses an owned boundary, reroute to that owner before continuing. |
| Existing product decision or rationale recall, provenance lookup, historical explanation, or “why was this decided?” | Project Knowledge and canonical docs first, then `rg`, `git log`/`git show`, and issue/PR history as needed; if new evidence appears, ask whether the Human wants to reopen the choice before using `jaeyoung-think` |
| Explicitly scoped new product direction, user-facing behavior, product policy, AI product autonomy or relationship model, positioning, or product-level prioritization after discovery | `jaeyoung-think` drafts a proposal → Human explicitly approves or rejects it → enter `mission-control` when approved meaning requires contract propagation |
| Raw product feedback, unclear product request, ideation, surface comparison, or local UX observation | `product-discovery-steward`; route to `jaeyoung-think` only after discovery frames a product decision that a Human wants to make |
| 외부 자료 조사 실행 — 웹 문서·논문·표준·오픈소스 저장소·경쟁 제품의 근거 수집, 소스 고정, 산출물 배치 분기 | `external-research`가 조사 절차와 인용 규율을 소유한다. 피드백·ideation 입력은 `product-discovery-steward`, coverage-review disposition과 계약 의미는 `mission-control`, 제품 선택 proposal은 `jaeyoung-think`, 리포트 보관 구조는 moonlight-project-knowledge `README.md`가 소유한다. 기존 내부 결정 회상은 Project Knowledge와 repo history로 간다. |
| New core-product Experience, service surface, or materially restructured Moment/Promise bundle | `mission-control` opens the Service Policy Coverage Review before choosing the Promise set; `product-discovery-steward` may supply exact-revision research collected with the `external-research` procedure, but Mission Control owns `owned` / `rejected` / `unresolved` disposition and cross-owner handoff |
| New or meaning-changed Experience/Moment/Promise/AC/Aspect that affects timing, domain/data shape, ownership, state lifetime, execution semantics, runtime/provider/AI boundaries, security/privacy, capacity/cost, observability, compatibility, or cross-surface invariant ownership | `mission-control` for the Contract Architecture Impact Review and any triggered Propagation Map, then the affected workflow owner; if the review exposes an unresolved product choice, pause the review, draft a `jaeyoung-think` proposal, obtain Human approval, update the approved meaning, and rerun the review |
| Retrospective Promise/Aspect audit, architecture-shaped clause, implementation identifier placement, or product meaning mixed with runtime mechanism/evidence | `mission-control` keeps Human meaning explicit, then applies `references/product-architecture-content-ownership.md`; use `story-chain-contract-steward`, `aspect-steward`, `runtime-flow-sync`, and `review-checklist-steward` only for their affected owners |
| Architecture Fitness, supported executable Fitness Case, `healthy/degraded/unknown`, or advisory merge eligibility | CAIR remains the impact source; use `architecture-fitness-review` with the Light House adapter and `quality-gate-steward` when gate semantics change; inactive or unsupported decision/process lenses remain `unknown` and Human-owned |
| Local or subagent review of Architecture Fitness artifacts, least-authority boundaries, privileged capabilities, structural guards, or advisory merge evidence | Produce or refresh the cases with `architecture-fitness-review` first, then use the Architecture Fitness review bundle in `review-checklist-steward`; neither review layer replaces CAIR or recalculates the other's verdicts |
| Adding or moving DB access, repository/domain-access boundary changes, route/runtime hot-path DB reads or writes, or preload/cache/defer tradeoffs | The implementation author starts at `docs/implementation.md` and follows its Data/persistence zone to the named technical and runtime-flow owners. Add `runtime-flow-sync` for execution/persistence changes, `quality-gate-steward` for gate changes, Mission Control for contract effects, and the Operational Readiness mandate for SLO/capacity effects; do not use `jaeyoung-think` |
| Promise, user-visible response policy, or contract meaning changes together with runtime order, provider, fallback, or persistence behavior | `mission-control` owns the meaning and impact classification first; after scope is fixed, `runtime-flow-sync` owns the mechanism propagation. A mechanism-only correction with unchanged user-facing meaning starts at `runtime-flow-sync`. |
| Runtime-flow source and a derived Contract Map both need updates | `runtime-flow-sync` owns the source edit first, then `contract-map-steward` updates the derived reading map. When the source is already correct and only map links or reading order drifted, start with `contract-map-steward`. |
| Product-concept shift, Concept Shift Architecture Review, retired architecture shape, or compatibility verdict across route/state/repository/runtime-flow/analytics/DB shape | `mission-control` when user-facing meaning changes; otherwise `skill-governance-steward` for process routing or `review-checklist-steward` for post-implementation review |
| Engineering process/session governance, skill routing, Project Knowledge operating rules, `AGENTS.md` agent-process guidance, or workflow ownership taxonomy. Reverting the proposed change would alter future-agent routing, triggers, capture, workflow ownership, or gate meaning, and the final authority is a process owner. | `skill-governance-steward` in a dedicated process session; if product/implementation and process effects or authorities are both present, keep the current work with its implementation owner and split the process part into a separate session. |
| 살아 있는 Sufficiency Review sidecar의 N세대 보존, retention dry-run, 최신 세대 순서, 권한 예외, 또는 `mc:review-retention` | `mission-control`로 현재 Story Chain 소유자를 읽은 뒤 `skill-governance-steward`가 읽기 전용 보존 절차를 검토한다. 실제 mutation은 별도 Human 승인이 필요하고 gate 제안은 `quality-gate-steward`로 보낸다. |
| Third design retirement, countermeasure stop, Human countermeasure meeting, decision record, or restart activation inside an existing workstream | `review-checklist-steward`; use `skill-governance-steward` in a dedicated process session only when changing this policy or its routing |
| Explicit Promise, Acceptance Check, Evidence Ledger, Aspect, or Story Chain change | `mission-control` |
| New or conflicting repeated contract terminology, product surface vocabulary, glossary term, or synonym-like wording inside Story Chain prose | `mission-control` for meaning, then `glossary-steward` for canonical naming and glossary registration |
| 제품 원칙(`docs/product-identity.md`) 변경, or a discovered conflict between an existing contract and a product-principle statement | Human decision first (product principles and contract meaning are both Human authority); `mission-control` records the misalignment and propagates only after the decision |
| PR review thread handling, CodeRabbit findings, GitHub review comments, CI/preview review notes | `branch-review-response` |
| PR merge/rebase conflict touching Story Chain, Evidence Ledger, or agent-skill contract paths | `branch-review-response`, then `mission-control` and `story-chain-contract-steward` for the contract resolution |
| 아이디어·초안·diff에 대해 의견을 받아보거나 독립 모델의 관점을 비교하며 readiness·수정·closeout을 요구하지 않는 자문 | `review-checklist-steward`의 Advisory consultation branch; read-only 의견을 종합하고 checklist·usage record·closeout은 만들지 않는다 |
| Local/subagent/human review findings, semantic drift or semantic cluster findings, overengineering or architecture guideline review requests, database-load/server-load/security/privacy review requests, repeated review misses, or a review checklist request, excluding PR review threads | `review-checklist-steward` |
| Review closeout status (`clean` / `findings remain` / `stale`), review record or escape record 기록, stale-clean 판정 | `review-checklist-steward` references own the record shape; `branch-review-response` for PR loops; `quality-gate-steward` for merge-path enforcement |
| Story Chain concept terms, product surface vocabulary, glossary registry entries, or glossary-linked refs | `glossary-steward`; use `docs/glossary/terms.json` and `npm run glossary -- lookup` |
| `/about` or `/about/promises` commitment prose, including Korean commitment prose | `about-prose` owns commitment meaning, template, and evidence; add `korean-prose` for Korean prose quality without creating a second meaning owner. A Korean technical or operating document outside the commitment surface starts at `korean-prose`. |
| Visual command-board treatment without changing workflow meaning | `vignelli-command-ui` |
| Revision 전체의 구조 감사, 정적 import 그래프 survey, 도달 불가 파일·dead code sweep, 순환 import·SCC 점검, source-derived 그래프와 canonical 도구(dependency-cruiser·knip)의 불일치 triage | `structural-audit`는 advisory 감사와 발견 이관까지만 소유한다. 게이트 의미 변경은 `quality-gate-steward`, 은퇴 shape 판정은 Concept Shift Architecture Review 경로, 사용자-facing 의미는 `mission-control`로 보낸다. 특정 경계 하나의 위반 확인은 skill 없이 `deps:boundaries`와 해당 owner로 충분하다. |

When discovery shows that user-facing meaning, Promise scope, Acceptance Checks,
Aspects, or Evidence Ledger coverage must change, switch to Mission Control
before editing code or contract files. When a style skill changes action
priority, workflow meaning, or contract behavior, route through
`product-discovery-steward` or `mission-control` first.

## Skill Lifecycle

Use `skill-governance-steward` when adding, updating, retiring, consolidating,
or reviewing repo-local skills. Before following a workflow's steps, state the
purpose that the workflow serves, the product or product-making subject whose
outcome it should improve, and the current authority that owns that outcome.
Read the owning purpose and boundary before commands, checklists, or file
layouts. If the procedure can be followed without explaining that purpose,
pause and recover it from the owning authority instead of treating procedural
completion as success.

The default decision order is:

1. update an existing skill;
2. create a new skill only when trigger, workflow, and validation are distinct;
3. record in Project Knowledge when the lesson is useful memory but not a
   repeatable procedure;
4. reject one-off lessons.

Process-governance changes need a dedicated process session. If the work changes
repo-local skills, skill routing, Project Knowledge rules, agent
validation/routing policy, agent-process guidance in `AGENTS.md`, or the taxonomy that assigns
workflow ownership, open or switch to a session whose only goal is that process
change. Do not attach these edits to feature implementation, bug fixing,
PR-review response, or Story Chain propagation unless the user explicitly scopes
the current session as process-governance work.

Classify the work on two axes before editing: the behavior that would regress if
the change were reverted, and the owner with final authority. A regression in
future-agent routing, triggers, capture, workflow ownership, or gate meaning is a
process effect. A regression in product behavior, contract meaning, or local
implementation is owned by that product or implementation workflow. Do not use
the current session type to resolve ambiguity.

During feature, bug-fix, PR-review, or Story Chain work, record a process insight
only as a local observation with its evidence and recheck condition. It does not
authorize editing `AGENTS.md`, skill routing, Project Knowledge operating rules,
hooks, or validation ownership in that workstream. When implementation and
process effects or authorities are both present, split the process change into a
dedicated session. If an active process rule blocks the current work, do not
change that rule in the same session to self-unblock. Stop at a Human checkpoint
that names the blocking rule, current owner, and proposed follow-up process work.
This separation is a scope decision owned by the process policy. A staged-diff
heuristic does not confirm or waive it.

Actual verification-gate semantics, CI wiring, `quality:*` scripts, and
validation documentation still route through `quality-gate-steward`. If a gate
change also changes agent routing or workflow ownership taxonomy, keep the
session scoped as process governance and use both stewards in sequence.

At entry, load Project Knowledge, use `skill-governance-steward`, name the
process surface being changed, and list the canonical files that may be edited.
Keep validation focused on `npm run format:check`, `npm run guard:skills`,
`npm run pk:validate`, and any steward-specific gate affected by the process
change.

In every session, record each repo-local skill use in the next required
`pk:remember` note. The line format and batching rule are owned only by
`docs/project-knowledge/README.md` § 스킬 사용 기록.

SkillOpt-style skill optimization is allowed only as a methodology reference
unless an explicit evaluation harness exists. Do not claim a repo-local skill
edit is optimized or validation-gated merely because process gates pass. The
first lightweight routing harness is
`shared-skills/skill-governance-steward/references/skill-routing-corpus.json`;
`npm run skill:routing-eval` validates its frozen 10–20 case shape and scores
blind predictions supplied with `--score`. It measures frontmatter discovery
and First-Route arbitration, not workflow compliance or causal product effect.
The corpus represents the intentional unowned-helper default with
`expectedFirstRoute: null`; predictions use `firstRoute: null` with no
additional routes. Selecting any skill for that case is a hard forbidden
selection rather than a tolerated precision miss.
Evaluation prompts expose opaque case ids in a frozen non-adjacent order.
Prediction envelopes bind to the input, evaluation-spec, and routing-source
digests; unknown skill names are hard failures. The stored evaluation artifact
contains the exact opaque inputs, canonical model id, prediction envelope, and
score plus one seal over the model, date, inputs, and predictions; the default
gate rescores and verifies the seal on every run. `--emit-evaluation-prompt`
and `--score` intentionally bypass the stale stored artifact and use the
current committed-source digest so a source-changing PR can produce its
replacement artifact before the default gate turns green. Branch provenance heads are
informational because squash merge may make them unreachable; SHA-256 digests
are the merge-stable identity. The same gate runs in the unit-test job, so
frontmatter or First-Route changes require a fresh blind evaluation in the same
PR.
A broader SkillOpt-inspired claim still needs a frozen held-out corpus separate
from design findings, expected findings/severity, expected validation commands,
negative controls, acceptance thresholds for recall/precision/scope/cost, and
an edit budget with rollback or promotion criteria. Without that evidence,
treat the change as an ordinary process-governance edit.

During ordinary work, repeated implementation mistakes should normally become
shared review-checklist entries, not new skills. Consider skillization only when
a distinct workflow has a non-obvious read order, a Codex/Claude handoff needs
consistent procedure, or a process has specific validation commands. Run a skill
review when three or more skills changed in one workstream, a new skill is
added, subagents report overengineering or trigger gaps, or generated runtime-copy drift
appears. Skill reviews consume accumulated evidence, not only recollection:
routing-miss notes recorded with `npm run pk:remember` at the moment a wrong,
missing, duplicate, or stale skill route is noticed, and the review-checklist
usage log's per-group and per-entry hit rates
(`shared-skills/review-checklist-steward/references/checklist-usage-log.md`),
which decide retirement or merging of low-hit checklist groups and entries.

For advisory opinion gathering and local/subagent review findings that are not
PR thread responses, use `review-checklist-steward`. Its entry branch separates
read-only consultation from verification review by requested outcome, not by
whether a diff exists. Advisory consultation returns agreements, disagreements,
assumptions, and next decisions without checklist records or closeout status.
Verification review keeps reusable findings in a shared, metadata-scored
operational checklist, declares which review lenses ran, drives
root-cause-sufficient corrections, and starts validation with targeted tests
and ledger-scoped traces before broad gates. For Architecture Fitness and
least-authority work, first refresh the
executable policy, exact-revision observations, and bounded candidates with
`architecture-fitness-review`, then run the
role-separated code/authority, review-contract/evidence, and
overengineering/process bundle from `review-checklist-steward`. The checklist
sets a review floor, not a ceiling on reviewer judgment.

For Story Chain concept terms, product surface vocabulary, glossary-linked
Promise/Evidence Ledger refs, or repeated contract terminology that may
duplicate an existing term, use `glossary-steward`. For public commitment
prose, use `about-prose`.

For Story Chain Promise, Acceptance Check, Evidence Ledger, run evidence,
Sufficiency Review, scenario refs, or surface-tag propagation, use
`story-chain-contract-steward` after Mission Control scopes the work. Use
`aspect-steward` separately for Aspect pointcuts and Aspect verdicts. When a
merge/rebase conflict touches these paths, resolve the conflict by preserving
approved contract meaning and coherent edges, not by choosing one side of the
diff wholesale.

For analytics/event implementation and real collection checks after Mission
Control scopes the Story Chain impact, use `analytics-event-steward`.

For product feedback, product ideation, or local UX decisions that may reveal a
policy candidate, use `product-discovery-steward` before implementation.

For verification gate or quality gate changes, use `quality-gate-steward`. For
derived `docs/contract-maps/**` work, use `contract-map-steward`.

For runtime processing flow changes or reviews, including `docs/runtime-flows/**`,
search mechanism, provider/API boundaries, fallback order, persistence/sync
ownership, and follow-up actions such as `비슷한 논문` or `다른 입장`, use
`runtime-flow-sync`.

This repository no longer keeps local sub-agent prompt templates. Delegation
rules come from the active host/plugin instructions plus the project `AGENTS.md`.
