---
name: mission-control-promise-retirement
description: Current Story Chain workflow for retiring a Promise or removing a user-facing feature.
---

# Promise Retirement

Retirement removes a Promise because the product no longer intends to provide
that behavior. It is not a bug fix and not a temporary feature flag.

## Entry Conditions

Proceed only when all are true:

- Human authority has approved the retirement.
- The target Promise or feature is not merely broken; it is no longer intended.
- Cross-impact has identified sibling Promises, Aspects, surfaces, and tests.
- A backward-compatibility stance is explicit before edits begin.

If any condition is uncertain, stop and ask.

## Backward Compatibility Stance

Before removing files or rewriting contracts, choose and record one stance:

| Stance              | Use when                                                                                                      | Required propagation                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `preserve`          | Existing user data, public APIs, external integrations, analytics history, or durable URLs must keep working. | Keep a compatibility path, mark it legacy/read-only where possible, add tests for old input, and document what still works.              |
| `migrate-read-only` | New creation/use is retired, but stored legacy objects must still render, export, or be readable.             | Block new writes, keep read adapters or migrations, add tests for legacy fixtures, and name the eventual deletion trigger if one exists. |
| `remove`            | The behavior is internal-only, has no required stored-data path, or Human authority approved a hard break.    | Delete routes, storage, env, jobs, tests, and docs; add negative assertions or scans where recurrence is likely.                         |

Do not infer compatibility from implementation convenience. Decide from product
ownership: user-owned data and public contracts bias toward `preserve` or
`migrate-read-only`; internal caches, generated artifacts, dead routes, and
cost/security liabilities bias toward `remove`. If the chosen stance changes
during implementation, stop and update the contract/readme evidence before
continuing.

## Current Contract Prose

After removing or renaming a behavior, do not leave the active Promise, Aspect,
Evidence Ledger, scenario, or runtime-flow centered on "the retired thing is not
rendered" unless that negative is itself the product invariant. Classify each
negative sentence:

- Current invariant: safety, privacy, security, source-of-truth, or compatibility
  rules may remain, but phrase them around the active source or owner. Example:
  "hydration applies only anchors still present in the current Moonlight
  context", not "do not revive deleted anchors".
- Compatibility stance: if old data, URLs, APIs, or analytics survive, name
  `preserve`, `migrate-read-only`, or `remove` and the exact boundary.
- Historical evidence: dated Sufficiency Reviews, decision logs, and PR notes
  may mention the old affordance as history.
- Stale prohibition: remove it or replace it with the current workflow owner.

The closeout scan should look for both the retired slug and old product nouns
such as control labels, route names, component names, test titles, and scenario
ids. Explain remaining hits as current invariant, compatibility history, or
unrelated dated record.

## Git-native Sufficiency Review History

Git history is the sole historical record store. Issue #521 removed the legacy
physical archive, manifest, notices, and compaction writer after preserving the
pre-migration tree in repository history. Do not recreate a sibling archive,
manifest, or archive link.

Until #519 replaces the owner-lifecycle rule, inspect the current Sufficiency
Review before mutating its owner:

- When the current review path is present, stop the retirement and preserve both
  the covering Evidence Ledger and sidecar. #519 owns their lifecycle transition.
- When the current review path is absent, remove the covering Evidence Ledger; no
  review-record mutation remains.

Recover removed historical payloads with Git, not a checked-in duplicate store:
use `git log --diff-filter=D -- <removed-path>` to find the deletion commit and
`git show <deletion-commit>^:<removed-path>` to read the exact pre-deletion
payload.

## Steps

1. Run `references/cross-impact-check.md`.
2. Record the compatibility stance in the Promise diff, Evidence Ledger review,
   PR/body notes, or closeout summary.
3. Remove or update user-facing code paths and tests that only served the
   retired Promise.
4. Remove or retag affected `// @promise`, `// @aspect`, and `// @check`
   surface markers.
5. Update covering Evidence Ledgers:
   - `sourcePromises`
   - `appliedAspects`
   - `intent.checks` or `intent.delegations`
   - `acceptanceChecks`
   - `executions` and `executionRefs`
   - review/verdict sections when they mention the retired ref
6. Update Aspect `appliesTo` lists and reciprocal weaving.
7. Remove the Promise file only after references are gone, or keep a deliberate
   historical identifier only when current validators allow it.
8. Re-anchor any surviving evidence that moved from the removed surface:
   - If an Acceptance Check or Evidence Ledger still says UI/admin surface,
     verify the replacement route actually renders the component or state.
   - Component-only tests are not enough when the Promise says a page or route
     shows the behavior. Add or update a route/page render test that asserts
     the replacement surface contains the relevant `data-testid`, text, or
     state.
   - Search for retired component names, route names, test titles, and surface
     nouns in Promise prose, Evidence Ledger rows, Sufficiency Review entries,
     i18n keys, and structured execution filters.
9. Run validation and targeted tests.

## Closeout

Run:

```bash
npm run mc:validate-story-chain
npm run mc:audit-surface
npm run mc:audit-story-surface
npm run mc:status
```

Confirm the retired Promise no longer appears as an actionable row or stale
surface tag.
