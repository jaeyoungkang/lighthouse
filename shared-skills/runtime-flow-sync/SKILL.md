---
name: runtime-flow-sync
description: Use when changing, reviewing, or explaining Light House runtime processing flows, especially `docs/runtime-flows/**`, search mechanism, 검색 메커니즘, follow-up actions like `비슷한 논문` / `다른 입장`, provider/API boundaries, entrypoints, fallback order, persistence/sync ownership, or when a code/product change should keep runtime-flow docs aligned.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Runtime Flow Sync Skill

Use this skill when a task changes or investigates how Light House executes a
runtime flow. The purpose is to keep implementation, Story Chain, Evidence
Ledger, and `docs/runtime-flows/**` from drifting apart.

This skill does not replace Mission Control. If the work changes
user-facing behavior, Promise meaning, Aspect advice, Acceptance Checks, or
Evidence Ledger coverage, load the relevant Mission Control steward first.

## Read First

- `docs/runtime-flows/README.md`
- the relevant runtime-flow document under `docs/runtime-flows/**`
- the implementation entrypoints named by that runtime-flow document
- the related Story Chain Promise, Aspect, and Evidence Ledger files when
  user-facing behavior or executable coverage changes
- `shared-skills/mission-control/references/product-architecture-content-ownership.md`
  when Story Chain is moving or linking an architecture-shaped clause

For search work, also search the current code for the named surface:

```bash
rg -n "search|seedPaper|differentPositionSeed|비슷한 논문|다른 입장|paper-neighborhood|co-cited|coupled" app docs/contracts/story-chain docs/runtime-flows
```

## Sync Triggers

Update or verify runtime-flow docs when any of these change:

- entrypoint, route handler, hook, store, or service order
- provider/API boundary, request/response shape, hydration path, graph endpoint,
  or fallback behavior
- client/server ownership of persistence, metadata, availability seed, or
  background-task sync
- visible follow-up action flow, including `비슷한 논문`, `다른 입장`, citation
  lineage, gap-network handoff, or AI response input
- public explanation of a runtime mechanism, when that explanation relies on a
  concrete flow in `docs/runtime-flows/**`
- Story Chain or Evidence Ledger text that describes runtime sequencing

Do not update a runtime-flow doc only to echo marketing copy. The doc should
state how the system runs.

## Workflow

1. Identify the relevant runtime-flow document. If none exists, decide whether
   the change is large enough to ask before adding a new one.
2. Read the current implementation before editing prose. Prefer `rg` and
   narrow file reads over memory.
3. Classify the state:
   - stable ref to approved desired structure in the durable CAIR or canonical
     engineering owner;
   - current implemented behavior, verified from code;
   - stable ref to an exact-revision Architecture Fitness observation, when one
     exists;
   - documented fallback or degrade path;
   - future issue or planned provider/API improvement.
     Do not infer desired structure from current code or an Architecture Fitness
     observation. Compare all three during review, but keep desired-structure
     facts and observation facts in their canonical owners. If current behavior
     differs from the approved structure, keep the difference explicit and
     route the implementation or Human decision rather than silently rewriting
     the desired rule.
4. Update the runtime-flow doc with current behavior and future follow-up work.
   When a divergence exists, name it and link the canonical desired-structure
   and observation records without restating their facts as runtime-flow prose.
   When changed prose contains negative or retired-shape rules, state the
   allowed flow and current owner first. Use `docs/principles.md §6` for the
   authoring decision and `review-checklist-steward` `root-cause-09` for the
   changed semantic cluster; keep mechanism/history and executable evidence
   with their existing runtime/evidence owners.
5. If public prose changed, state the boundary between internal runtime terms
   and user-facing terms.
6. If user-facing behavior changed, update Story Chain and Evidence Ledger in
   the same workstream.
7. Record durable follow-up issues by link or stable identifier when runtime
   docs mention planned external API work.

## Story Chain Mechanism Handoff

When a Story Chain clause moves an exact runtime mechanism here:

- reuse the existing relevant runtime-flow document whenever possible;
- add or select a stable section heading for the moved owner/order/fallback/
  persistence rule;
- let Story Chain link that anchor only when it helps readers find the
  implementation path;
- do not copy the visible Promise or Aspect guarantee into runtime-flow as a
  second product authority;
- keep exact test and command refs in the covering Evidence Ledger;
- keep Architecture Fitness policy as the minimum projection of approved
  desired structure and observation as exact-revision facts only.

Ask before adding a new runtime-flow document. A missing document is not
permission to create a parallel mechanism registry or to leave the mechanism
authoritative in Promise or Aspect prose.

## Search-Specific Checks

For `비슷한 논문`, confirm whether the implementation is:

- keyword-prefill search via `buildSimilarPaperQuery`;
- graph-neighbor retrieval via Episteme or citation-lineage helpers;
- a hybrid of both.

For `다른 입장`, confirm whether candidates come from:

- inline analysis `stanceProfile.counterSearchQueries`;
- provider/API-returned stance/debate candidates;
- a future issue only.

Do not imply graph or stance APIs are already used when the code still opens a
regular search route with seeded metadata.

## Detached Follow-Up Window Checks

When changing search follow-up actions (`비슷한 논문`, `인용`, graph neighbors,
공백 분석, keyword click, or generated term search), decide whether the action
is in-place or detached before editing code.

- Detached follow-up actions open a browser research route or source route in a
  new window and must not mutate the current window's route-owned `currentView`,
  visible-window state, reaction snapshot, or query route condition.
- Do not enqueue or merge a detached follow-up result into the current window's
  active ResearchRoutePayload. Detached results belong to the destination route or new
  window; the origin route may only keep explicitly scoped pending/analytics
  state.
- If a background or reaction persistence response updates route-owned state, use
  a freshness-checked, scope-preserving path and add/keep a test that proves the
  origin `currentView` and route condition are unchanged.
- For empty `/search` without a `q` URL param, the centered initial
  search input is the single commit input. Once content exists, the
  route-level command field owns query commit and ResearchRoutePayload bodies must not
  repeat the query input.

## Validation

For docs-only runtime-flow sync, run:

```bash
npm run format:check
```

When Story Chain or Evidence Ledger changed, close with the canonical contract
closeout alias — its gate list is owned by the `package.json` definition
(issue #193):

```bash
npm run quality:contract
```

If the runtime-flow change also changes a Promise, Acceptance Check, or
Evidence Ledger row, run the impacted ledger evidence for real:

```bash
npm run evidence-ledger -- --ledger <ledger>
```

When code changed, run the smallest tests that cover the edited runtime path,
plus `npm run typecheck` when TypeScript contracts moved.
