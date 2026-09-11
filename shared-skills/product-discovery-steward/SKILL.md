---
name: product-discovery-steward
description: Use when triaging Light House product feedback, user interview notes, dogfooding observations, product requests, ideation prompts, surface comparisons, or local UX decisions that may reveal a reusable policy, Aspect candidate, or implementation plan. Combines feedback triage, product ideation, and policy discovery into one workflow before Mission Control or issue creation.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Product Discovery Steward Skill

Use this skill before implementation when the work starts from feedback,
requests, product review notes, or an unclear product idea. The goal is to
choose the right delivery layer before creating issues, contracts, or code.

Use this skill before Mission Control when the input is raw feedback, an unclear
product request, or a local UX decision, even if the feedback mentions
analytics, runtime, or Story Chain vocabulary. Switch to Mission Control only
after discovery shows that user-facing meaning, Promise scope, Acceptance
Checks, Aspects, or Evidence Ledger coverage must change.

Discovery frames the product problem, evidence, options, and delivery layer. If
a Human then wants to choose among scoped product directions, user-facing
behaviors, or policies, hand that framed question to `jaeyoung-think`. Its output
remains a proposal until the Human explicitly approves it.

## Modes

- `feedback triage`: turn raw feedback into product problems, candidate issues,
  and Story Chain impact.
- `ideation`: compare possible surfaces or product options before implementation.
- `policy candidate`: detect when a local UX decision reveals a reusable rule,
  Aspect candidate, or agent behavior policy.

Do not run all modes by default. Pick the smallest mode that answers the user.

## Workflow

1. Name the input source.
   - Use neutral source labels such as user feedback, beta feedback, dogfooding,
     product review, design review, or issue.
   - Do not name individual users, beta testers, reviewers, or handles in public
     prose.
2. Separate observation from product interpretation.
   - Observation: what happened or what the user asked for.
   - Product problem: what expectation, trust gap, or workflow friction it
     reveals.
   - Current contract surface: matching Promise, Aspect, Evidence Ledger, UI
     surface, runtime-flow doc, or no match.
   - Architecture-impact signals: interaction timing, domain/data shape, source
     ownership, state lifetime/recovery, execution semantics, runtime/provider/AI
     boundaries, security/privacy, capacity/cost, observability, compatibility,
     or a shared invariant across surfaces.
   - If the input can create or restructure a core-product service bundle,
     research the minimum service-policy lenses requested by Mission Control's
     `service-policy-coverage-review.md`. Discovery supplies exact-revision
     evidence and open questions; it does not finalize owner dispositions or
     keep a duplicate checklist.
3. Name the user's decision anchor before choosing a surface.
   - Use one of: whole search result, one paper card, one PDF passage, one gap
     cluster, one citation direction, workspace state, or no stable anchor yet.
   - Attach the action to that anchor when the user's question is about a
     specific claim, document, passage, cluster, direction, or selection.
   - Reject global surfaces such as search-result header sections or AI comment
     bodies when the follow-up question would become ambiguous across many
     papers. Use global surfaces only when the question is genuinely about the
     whole result set.
   - For follow-up search ideas, prefer existing structured signals such as
     inline semantic profiles, selected passage context, citation direction, or
     gap cluster metadata over naive string recipes like `{title} critique`.
     If an LLM is used, ask it to extract the debate axis and query candidates
     at the same point where the anchored context is already being analyzed.
4. Choose the delivery layer:
   - `copy/UI only`: existing Promise covers the intent and wording/layout is
     stale.
   - `implementation`: behavior changes under an existing Promise.
   - `Story Chain`: new or changed user-facing meaning, Acceptance Check,
     Aspect, or Evidence Ledger coverage is needed.
   - `policy/process`: the decision should become a reusable rule, skill,
     guard, or Project Knowledge entry.
   - `defer/reject`: the idea conflicts with Light House product identity or
     needs Human authority first.
5. For ideation, produce two or three concrete options.
   - Each option names the surface, user value, cost, and risk.
   - Prefer the smallest option that closes the product problem honestly.
   - Do not create a landing-page or dashboard-shaped solution when the product
     need is a workspace/document workflow.
   - When choosing among the options would establish product direction,
     user-facing behavior, or policy, stop at the framed options and hand the
     decision to `jaeyoung-think` only when the Human wants to make that choice.
6. When an option would create or preserve state, a result, history, or a
   shareable artifact, and its lifetime, sharing, or feasibility can change the
   product choice, return product-relevant feasibility before Human approval.
   - Compare latest-state meaning with point-in-time meaning, and sharing the
     conditions with sharing the exact result. Include only comparisons that
     can change the product choice.
   - Name the simplest viable state shape and the specific user value it cannot
     preserve.
   - Include operational facts only when owner, freshness, retention, recovery,
     access, or reversibility can change the option. Runtime and data owners
     supply these facts but do not choose product meaning.
   - If feasibility changes user-facing lifetime, sharing, or failure meaning,
     return revised options to the Human product choice before implementation,
     Mission Control, or CAIR. Do not use CAIR to choose among product options.
   - After Human approval, route user-facing meaning to Story Chain, structural
     impact and rejected alternatives to CAIR, mechanisms to runtime and data
     owners, and evidence to the Evidence Ledger or supported Architecture
     Fitness cases. Discovery does not keep a duplicate verdict.
7. For policy candidates, preserve the user's wording.
   - Quote or paraphrase the local rule that emerged.
   - Decide whether it belongs in an Aspect, Promise clarification, Evidence
     Ledger check, Project Knowledge, conventions, or a skill.
   - If it would constrain multiple product surfaces, route to Mission Control.
8. When the choice becomes user-facing implementation, stop discovery and use
   Mission Control before editing code. Carry any architecture-impact signals
   into the Contract Architecture Impact Review; discovery identifies the
   signals but does not choose the system structure.

## Output Shape

Keep discovery output compact:

```text
Input:
Product problem:
Current contract:
[Architecture signals: include only when present]
Options:
[Feasibility return: include only when state, result, history, or sharing can change the choice]
Decision anchor:
Recommended route:
Rejected route:
Next action:
```

For issue triage, include acceptance hints and affected surfaces. For policy
candidates, include the proposed owner file or skill.

When rejecting a route, name the ambiguity it would create. Example: "global AI
comment rejected because 'opposing paper' has no single referent across 40
results; paper-card action keeps the referent explicit."

## Boundaries

- Do not file generic backlog items outside Story Chain when the feedback
  changes a user-facing promise.
- Do not bury a reusable policy inside one Promise or one code comment.
- Do not use Project Knowledge as a substitute for a contract when the rule
  changes product behavior.
- Do not turn feedback into literal copy-only fixes when the underlying product
  expectation is broader.
- Do not make the feasibility return a mandatory decision block, common intake
  artifact, registry, or substitute for Human product choice, Story Chain,
  CAIR, runtime/data ownership, or evidence owners.
- Do not broaden scope into a generic chat/dashboard/productivity feature unless
  Light House product identity supports it.

## Validation

For discovery-only notes, no code gate is needed. If the work creates or edits
issues/docs, run `npm run format:check` for the touched files. If the route
changes Story Chain, use Mission Control and the relevant contract gates.
