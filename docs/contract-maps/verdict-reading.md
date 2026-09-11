# Verdict Reading Contract Map

This map explains how to read current Light House contract status.

It exists because a single file's frontmatter can be misleading when read alone.
Mission Control computes release readiness from Story Chain, Evidence Ledgers,
review evidence, alignment findings, baseline policy, and surface audits.

## Current Rule

For current release state, prefer computed status over isolated file metadata.

Read in this order:

1. `npm run mc:status`
2. [`scripts/mission-control/lib/release-verdict.ts`](../../scripts/mission-control/lib/release-verdict.ts)
3. [`scripts/mission-control/lib/snapshot.ts`](../../scripts/mission-control/lib/snapshot.ts)
4. affected Promise, Aspect, and Evidence Ledger files
5. Sufficiency Review files under `docs/contracts/story-chain/evidence-ledgers/reviews/`

## Release Verdict Source

`npm run mc:status` builds the Mission Control snapshot and passes it to
`computeReleaseVerdict`.

The canonical calculation and CLI formatter live in:

- [`scripts/mission-control/lib/release-verdict.ts`](../../scripts/mission-control/lib/release-verdict.ts)

The compute result has three dimensions:

| Dimension | Meaning | Blocking signal |
| --- | --- | --- |
| Intent verdict | whether Intent Check rows are met | not-met or unknown rows |
| AC trace | whether Acceptance Check evidence trace is clean | new or escalated critical alignment findings |
| Aspect | whether Aspect verdicts are met | not-met, unknown, or unverified Aspect verdict rows |

Release is `ready` only when all dimensions are green.

## Snapshot Source

`scripts/mission-control/lib/snapshot.ts` builds the CLI-owned Intent
Traceability snapshot.

Sources:

- [`scripts/mission-control/lib/snapshot.ts`](../../scripts/mission-control/lib/snapshot.ts)
- [`scripts/mission-control/lib/intent-traceability-snapshot.ts`](../../scripts/mission-control/lib/intent-traceability-snapshot.ts)
- [`scripts/mission-control/lib/alignment-audit.ts`](../../scripts/mission-control/lib/alignment-audit.ts)

## Promise Verdict

Promise frontmatter is still important. The Story Chain parser and validator read
Promise declarations and verify graph structure, parent refs, Aspect weaving,
Acceptance Check coverage, and cardinality.

But release readiness does not come from visually scanning one Promise file. It
comes from the Intent Traceability snapshot and Mission Control release verdict.

Sources:

- [`docs/contracts/story-chain/concepts.md`](../contracts/story-chain/concepts.md)
- [`docs/mission-control.md`](../mission-control.md)
- [`app/server/services/story-chain/validator.ts`](../../app/server/services/story-chain/validator.ts)

## Aspect Verdict

Aspect files declare the Aspect and its pointcut. They can also carry a
frontmatter `verdict` value, but current release status is computed through the
Aspect verdict report.

`scripts/mission-control/lib/release-verdict.ts` calls `buildAspectVerdictReport()` and
blocks release when that report has not-met, unknown, or unverified rows.

This distinction matters for `aspect:reaction-prefers-load-bearing-facts`.
Its Aspect file says `verdict: met`, and Mission Control currently reports the
Aspect dimension as `21/21 met`. The current state is backed by the current
route-view AI comment ledgers and search reaction evidence, not by the retired
`respond` tool contract.

Sources:

- [`docs/contracts/story-chain/aspects/reaction-prefers-load-bearing-facts.md`](../contracts/story-chain/aspects/reaction-prefers-load-bearing-facts.md)
- [`docs/contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md`](../contracts/story-chain/evidence-ledgers/foundational/runtime-contract.md)
- [`docs/contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml`](../contracts/story-chain/evidence-ledgers/route-view-ai-comment-generation-routing.ledger.yaml)
- [`docs/contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml`](../contracts/story-chain/evidence-ledgers/search-reaction.ledger.yaml)

## Evidence Ledger Verdict

Evidence Ledger files own executable evidence and verdict sections. They are not
planning documents. A ledger's `## Verdict` section and Sufficiency Review entries
explain why a Promise or Aspect is currently considered met, unknown, or not-met.

The status reader should distinguish:

- ledger verdict sections;
- external review entries under `evidence-ledgers/reviews/`;
- Mission Control's computed release dimension;
- old frontmatter that may not be the final computed status.

Sources:

- [`docs/contracts/story-chain/README.md`](../contracts/story-chain/README.md)
- [`docs/contracts/story-chain/concepts.md`](../contracts/story-chain/concepts.md)
- [`app/server/services/story-chain/review-parser.ts`](../../app/server/services/story-chain/review-parser.ts)

## AC Trace Verdict

AC trace is not a count of visible `verdict:` values. It is computed from
current alignment findings. Any current critical finding blocks release; warning
findings remain visible but non-blocking.

Sources:

- [`scripts/mission-control/lib/release-verdict.ts`](../../scripts/mission-control/lib/release-verdict.ts)
- [`scripts/mission-control/lib/alignment-audit.ts`](../../scripts/mission-control/lib/alignment-audit.ts)

## Practical Reading Path

When checking whether a contract is currently safe:

1. Run `npm run mc:status`.
2. If a dimension is blocked, run the targeted command shown by Mission Control
   or inspect the relevant source file listed in this map.
3. If one file's frontmatter conflicts with the board, inspect the covering
   Evidence Ledger and review file before making a claim.
4. If the computed board is wrong, fix the source contract or Mission Control
   calculation. Do not patch a Contract Map to make the status look better.

## Map Boundary

This map does not define release policy. It only tells readers where current
release status comes from.
