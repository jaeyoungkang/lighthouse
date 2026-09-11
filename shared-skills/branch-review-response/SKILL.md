---
name: branch-review-response
description: Use when responding to PR or branch review feedback, including CodeRabbit, GitHub review threads, Copilot comments, CI/preview review notes, or human reviewer comments. Guides agents through verifying findings, applying root-cause-sufficient PR-scoped fixes, validating, pushing, replying/resolving review threads, declaring the PR review closeout status (clean / findings remain / stale) at the exact head, and triaging late bot findings as escape records.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Branch Review Response Skill

Use this skill when a user asks to handle review feedback on a branch or PR:
CodeRabbit, GitHub review threads, Copilot/code scanning comments, Vercel preview
review notes, or human reviewer comments. The goal is not only to patch code; the
agent must close the review loop by commenting or resolving threads when possible.

## Review Loop

This workflow is iterative. One pass is not enough unless there are no new
findings after push, remote CI, bot review, thread replies, merge, and issue
reconciliation. Whenever a pushed fix creates new review comments, failed
checks, CodeRabbit/Copilot findings, or issue follow-up, return to step 1 with
the new evidence. Report a loop as complete only when the current PR head has no
unresolved actionable review findings, relevant remote checks are complete, and
related issues have been reconciled. State the closeout as `clean`,
`findings remain`, or `stale` for the exact PR head, backed by a review record
(`review-checklist-steward` `references/default-checklist.md` § Usage Records
and Hit Rate); a new commit makes prior `clean` claims `stale`.

External bot reviews such as CodeRabbit are reference input, not closeout
authority. Findings that exist get verified and processed like any review
input, but do not treat pending bot processing as a completion precondition.
Bot findings that arrive after a `clean` closeout — including after merge — are
triaged as escape records (`valid` / `invalid` / `already-fixed` / `duplicate`
/ `needs-human-decision`); only a `valid` escape reopens the loop. The
canonical closeout-status definition is `docs/agent-skills.md` § Review
Closeout Status; on any wording conflict that document wins.

This workflow is a minimum floor for PR review response, not a ceiling on review
depth. If the PR exposes a risk that is not named below, follow it, classify it,
fix it when valid, and report the additional lens.

1. Identify the target branch/PR.
   - Prefer the explicit PR URL/number from the user.
   - If missing, inspect the current branch and associated PR.
   - Collect PR metadata, changed files, review threads, review comments, and
     conversation comments with GitHub tools or `gh`.
2. Extract actionable findings.
   - Separate actionable review findings from praise, release notes, summaries,
     bot metadata, deployment notices, and already-resolved discussion.
   - Include CodeRabbit findings as normal review findings; do not special-case
     them beyond parsing their generated comment format.
3. Verify each finding against current code.
   - Treat review comments as hypotheses, not truth.
   - Read the relevant current files and PR diff before editing.
   - For code changes, perform code-level review beyond the commented hunk:
     relevant call sites, input-to-output behavior path, owner boundary, error
     and async paths, tests or guards, and dead or duplicated code exposed by the
     change.
   - Declare review lenses for the PR head. Code-level review is required for
     code changes; architecture, Story Chain/contract, runtime-flow,
     database-load, server-load, security/privacy, analytics, UI/loading,
     overengineering, and other specialized lenses are required when the changed
     surface touches that risk. Additional reviewer-chosen lenses are welcome.
   - When the PR touches DB access, check read/write cardinality, owner-shaped
     predicates, history-proportional scans, repository placement, and first
     paint DB independence.
   - When the PR touches server hot paths or external provider fan-out, check
     route `maxDuration`, abort propagation, retry windows, queue/concurrency
     limits, repeated work per request/card/result/retry, and endpoint-specific
     load or abuse evidence.
   - When the PR touches public endpoints, auth, operational evidence, or
     sensitive content, check auth/ownership, input schemas and allowlists,
     rate/source-window limits, server-derived actor identity, secrets/API
     keys/env vars, token/header forwarding, SSRF through user-controlled URLs,
     request body size or payload-amplification DoS, CSRF/origin checks for
     cookie-backed mutations, cache/privacy headers, raw query/PDF/AI-output
     handling, sink durability, and sensitive logs/analytics/errors.
   - Use `docs/operational-readiness.md` §5 for operational boundary rows and
     choose relevant gates from `docs/contract-maps/quality-gates.md`.
   - Classify each finding as `valid`, `invalid`, `already-fixed`,
     `duplicate`, or `needs-human-decision`.
4. Choose root-cause-sufficient, PR-scoped corrections for still-valid issues.
   - Treat PR scope as the current review's workstream, not the smallest
     possible patch. Close the cause that made the finding valid on this PR
     head.
   - Fix at the owner boundary that prevents the same class of defect from
     recurring in the reviewed surface. Do not satisfy review with a local guard
     or single call-site patch when the cause is shared assembly, contract
     drift, data-access shape, runtime-flow order, or gate coverage.
   - When multiple findings share one cause, prefer one structural correction
     over repeated per-finding patches.
   - Do not broaden scope to unrelated refactors after the reviewed cause is
     closed.
   - If Story Chain, runtime-flow, Promise, Aspect, Acceptance Check, or Evidence
     Ledger content changes, use the relevant Mission Control skill and gates.
   - If GitHub reports a merge conflict or a rebase/merge conflict touches Story
     Chain, Evidence Ledger, or agent-skill contract paths, do not
     resolve it with wholesale `ours` / `theirs`. Route the conflict through
     Mission Control and `story-chain-contract-steward`, then preserve only the
     contract edges whose meaning is still valid.
5. Validate before responding.
   - Run the smallest honest targeted tests for the changed surface.
   - Run repo gates appropriate to the change. For code changes, prefer at least
     targeted test, `npm run format:check`, `npm run lint`, and
     `npm run typecheck`. For Story Chain docs, run `npm run quality:contract`
     (the canonical contract closeout alias — its gate list is owned by the
     `package.json` definition, issue #193).
     When a Promise, AC, Evidence Ledger, or user-facing contract changes, also
     run the impacted ledger evidence for real with
     `npm run evidence-ledger -- --ledger <ledger>`.
6. Commit and push when the user asked for a complete review response flow or
   when the branch/PR response requires remote reviewers to see the fix.
   - Let existing git hooks run; do not bypass them.
   - Record the pushed commit SHA for review replies.
7. Monitor remote CI until completion. Local gates passing is not the same as
   GitHub Actions / required status checks passing — the PR is not actually
   ready until the remote checks finish.
   - After pushing, list the PR's status checks with
     `gh pr view <pr> --repo <repo> --json statusCheckRollup` and identify
     in-flight checks (status `IN_PROGRESS` / `QUEUED`).
   - Poll until every relevant check reaches `status = COMPLETED`. A simple
     `bash` polling loop with `gh pr view ... --jq` every 30s is enough; run
     it in the background and wait for the notification so the conversation
     stays responsive. Do not declare the review-response workflow closed
     while a required check is still running.
   - If a check finishes with `conclusion = FAILURE`, treat the failure as a
     new finding: read the failing job log
     (`gh run view <run-id> --repo <repo> --log-failed`), classify the cause
     against the just-pushed change, fix or roll back, and loop back to
     step 5. Do not move to step 8 with a red CI on the head commit.
   - If a check is unrelated to the change (e.g., a flaky job the team
     already acknowledged), say so explicitly in the final reply and link
     the prior decision; do not silently ignore red checks.
8. Reply and resolve review threads.
   - For fixed valid findings, reply with a short note: what changed, commit
     SHA if pushed, and key validation.
   - For invalid or already-fixed findings, reply with the concrete reason and
     file/line evidence.
   - Resolve the GitHub review thread when the finding is fixed or conclusively
     answered. If the available tools cannot resolve the thread, leave the reply
     and state the blocker in the final answer.
   - Do not resolve threads needing a human product/API/policy decision.
9. Add a concise PR conversation summary when multiple findings were handled.
   Include:
   - fixed findings
   - skipped/invalid findings with reasons
   - review lenses run, skipped with reason, or not applicable
   - validation run
   - pushed commit SHA, if any
   - closeout status (`clean` / `findings remain` / `stale`) for that head

   Then append one review record with role `branch-review-response` to the
   checklist usage log
   (`shared-skills/review-checklist-steward/references/checklist-usage-log.md`)
   binding this response loop to the exact reviewed head.

10. Reconcile related issues before declaring the PR workflow done.
    - Inspect linked/closing issues, issue references in PR body/comments, and
      upstream/downstream follow-up issues mentioned during the work.
    - Close only issues whose acceptance is fully handled by the merged PR.
    - If an issue is only partially handled, leave it open and comment with:
      what the PR completed, what remains, and any linked follow-up/upstream
      tracker.
    - If the PR creates a new follow-up obligation, ensure an issue exists or
      add the follow-up to the appropriate existing issue before final reply.
    - Mention issue outcomes in the final response: closed, kept open with
      reason, or moved upstream.
11. Decide whether another loop is required.
    - Loop again when new commits, review comments, CI failures, bot summaries,
      unresolved review threads, or issue follow-ups appear after the previous
      pass.
    - Stop only when no actionable findings remain for the current PR head.
    - If follow-up issues remain open by design, report the review-response loop
      as closed for this PR but not the product work as fully complete.

## Response Policy

- Findings lead the work. Summaries come after the review issues are classified.
- Treat the numbered workflow as a loop, not a one-shot checklist.
- Treat the workflow as required minimum coverage, not a cap on reviewer
  judgment.
- Do not ask the user whether to resolve/comment after a successful fix; do it
  as part of the review response flow unless the user asked for local-only work.
- Keep public replies factual and compact. Avoid defensive language.
- Do not claim a thread was resolved unless the GitHub thread was actually
  resolved through tooling.
- Do not declare the review-response workflow closed while a required remote
  CI check is still `IN_PROGRESS` / `QUEUED` on the pushed head commit.
  Local gates green is necessary but not sufficient; the user's reviewers
  judge by the GitHub status checks. Poll to completion (step 7) and report
  the final conclusion.
- If a bot posted one large aggregate comment with no inline thread, add a
  top-level PR comment summarizing the response instead of trying to resolve a
  nonexistent thread.
- Do not say a merged PR is fully handled until related issues are reconciled.
  A clean merge with green checks is not enough when product or provider
  follow-up issues remain open.
- State PR closeout only in the three-state vocabulary (`clean` /
  `findings remain` / `stale`) bound to the exact head. Do not use an
  Architecture Fitness profile `healthy` as a synonym for PR `clean`, and do
  not write "findings 0" / "final clean" prose without a matching review
  record at that head.

## Compact Reply Templates

Fixed:

```md
Fixed in `<sha>`. The failure path now [specific change]. Validation: `<command>`.
```

Invalid:

```md
I checked current `<file>` and this no longer applies: [specific reason]. No code change.
```

Needs human decision:

```md
Leaving this unresolved because it changes [contract/API/product behavior]. Needs human decision before implementation.
```
