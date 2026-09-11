---
name: mission-control-propagation-scope-control
description: Bounds Story Chain propagation before implementation with an owner map, an explicit budget, and Human scope checkpoints.
---

# Propagation Scope Control

Use this reference after Human meaning and any required Contract Architecture
Impact Review or Concept Shift Architecture Review are explicit. Run it before
editing Story Chain, runtime, code, or tests when at least one condition holds:

- CAIR returns `reshape`;
- Concept Shift assigns `remove` to an active shape;
- the cross-impact scan finds more than one owning Promise, Aspect, or Evidence
  Ledger bundle;
- the work introduces a cache or state lifecycle; or
- the forecast reaches a scope checkpoint below.

This procedure does not weaken chain closure. It defines the smallest owner
boundary where chain closure must happen and separates that boundary from
downstream inspection and cleanup.

## Minimum Owner Closure

`same workstream` means that an approved user invariant and every artifact that
directly owns or proves it move together. This normally includes the owning
Promise or Aspect, its Evidence Ledger, the runtime owner, the required
implementation path, focused tests, and surface tags.

It does not mean that every downstream mention, sibling contract, historical
review, or newly visible cleanup must change in the same diff. Inspecting a
downstream owner does not transfer its contract ownership. When that owner needs
new meaning or new evidence, record a separate change decision and leave its
Sufficiency Review with its owning ledger.

## Propagation Map

Record one `## Propagation Map` in the durable issue, PR plan/body, contract
artifact, or runtime-flow document that already owns the work. A transient chat
note is not sufficient. Do not create a registry or backlog just for these
maps.

The map contains:

1. the approved user or operator invariant;
2. the owning Promise, Aspect, and Evidence Ledger bundle;
3. the runtime or engineering owner;
4. the minimum code and test paths required to make the invariant true;
5. downstream owners that will be inspected but not edited;
6. compatibility-only shapes and their `preserve`, `migrate-read-only`, or
   `remove` stance;
7. cleanup that will be split out; and
8. a forecast file range and authored churn range with generated copies and
   lockfiles reported separately.

Use the following compact shape:

```text
## Propagation Map

Invariant:
Owning contract bundle:
Runtime/engineering owner:
Required code/test paths:
Inspected, not edited:
Compatibility-only shapes:
Split cleanup:
Budget: <min>..<max> authored files; <min>..<max> authored changed lines
```

## Scope Checkpoints

Stop implementation and report to the Human when any condition occurs:

- the forecast or actual scope exceeds the map's maximum file count, or no map
  exists and the change reaches 30 authored files;
- more than three owning Promise/Aspect/Evidence Ledger bundles need edits;
- an unplanned cache, persistence, or state lifecycle appears;
- authored additions plus deletions exceed 1,000 lines;
- one review correction requires five or more previously unplanned files; or
- scope grows after the second review round.

Count canonical source, contract, test, and process files as authored files.
Report generated skill copies, generated documents, and lockfiles separately so
mechanical output does not hide authored scope or inflate it into a false stop.

The checkpoint report contains:

```text
Trigger:
Original budget:
Current forecast or actual scope:
New owners or lifecycle:
Required closure:
Cleanup or foreign-owner work:
Options: continue expanded scope | split follow-up | stop and rescope
```

Do not select an option on the Human's behalf. A large migration may continue
after explicit approval; the threshold is not a size prohibition.

## Concept Shift `remove`

Classify every removed shape before editing:

- **active runtime removal** blocks the retired writer, route, or state owner
  needed to make the approved model true now;
- **compatibility** preserves or limits old records, URLs, schema, and reads
  according to `preserve`, `migrate-read-only`, or `remove`;
- **cleanup** removes dead helpers, names, tests, analytics, and documentation
  that are not required to close the active owner; and
- **history** preserves dated review and governed archive evidence unless that
  material falsely claims current authority.

Active removal and required compatibility stay with the approved change.
Cleanup and history compaction are separate unless leaving them would keep an
active writer, a false current contract, or an unsafe compatibility path.

## Early Scope Review

Run `review-checklist-steward` with the `overengineering`, `story-chain`, and
affected architecture groups immediately after every required Propagation Map.
This includes maps triggered by multiple owning bundles, a cache/state
lifecycle, or a scope checkpoint as well as CAIR `reshape` and Concept Shift
`remove`. The reviewer checks:

- whether a smaller existing owner can close the invariant;
- whether downstream impact was mistaken for downstream ownership;
- whether cleanup or history work can be split;
- whether a new cache/state mechanism needs its own technical decision; and
- whether the budget is credible for the named paths.

Repeat the checkpoint after a review finding changes the owner set, introduces
a lifecycle, adds five previously unplanned files, or grows scope after the
second review round. Normal owner-specific review and exact-head closeout still
happen after implementation.

## Advisory And Blocking Boundary

Propagation budgets and checkpoint thresholds are advisory process controls.
They require context and must not become a file-count or line-count CI failure.

Stable graph ownership remains blocking. A new Sufficiency Review entry may
name Acceptance Checks and Intent Checks only from that Evidence Ledger's
`Source Promises`. Related ledgers may be referenced in prose, but the owning
ledger keeps the actual AC/IC refs, reviewed revisions, and executable evidence.
Historical review entries before the validator's owner-boundary cutoff remain
immutable compatibility evidence.

## Issue #479 Case Classification

The 84-file search worktree mixed four classes:

| Class                       | Classification                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product direction           | Keyword results own membership, direct-citation proximity orders members inside that set, and query-absent candidates use a separate discovery section.                                                          |
| Minimum required change     | The owning search/discovery contracts, their runtime owners, direct implementation paths, and focused tests needed for those three axes.                                                                         |
| Cleanup                     | Broad retirement of interleave, CJK-floor, supplement analytics, graph-support shapes, ranking tests, historical compaction, and naming after the active writer is already closed.                               |
| Foreign-owner propagation   | Reaction, term-discovery, and other downstream AC revisions or Sufficiency Reviews outside the owning ledger. These require their own owner decision.                                                            |
| Separate technical decision | Response-tail warming, process LRU/TTL, anchor revision, coalescing, deadlines, concurrency, partial-failure caching, and privacy-safe observation form a cache/provider lifecycle rather than a sorting detail. |

This table is a worked case, not a current product decision or a new history
registry.
