# Alignment Coherence Gate — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[alignment-coherence-gate.ledger.yaml](../alignment-coherence-gate.ledger.yaml).

### Sufficiency Review

#### 2026-07-21 — revision drift projection follows Mission Control CLI

```yaml
date: 2026-07-21
acs:
  - acceptance-check:alignment-coherence-gate-revision-drift-soft
acReviewedRevision:
  - 3
fixtureRef: app/server/services/story-chain/__tests__/revision-drift.test.ts; scripts/mission-control/lib/__tests__/intent-traceability-snapshot-drift.test.ts; scripts/mission-control/lib/__tests__/intent-traceability-snapshot.test.ts
runCommitSha: 27bd7a64d150+worktree
observedOutput: Revision drift remains a non-blocking signal that lowers the Mission Control snapshot row to verify; mc:status and mc:next now own the operator projection after the retired admin inventory and StaleRevisionFlag component were removed.
gaps:
  - adopt: Detection, snapshot classification, and CLI reading remain separate responsibilities.
  - reject: Keeping a web route solely to render a soft signal would duplicate the existing operator CLI.
verdict: met
```

- Verdict: met

#### 2026-05-08 — pre-cutoff YAML reviews are parsed

```yaml
date: 2026-05-08
acs:
  - acceptance-check:alignment-coherence-gate-ac-revision-field
  - acceptance-check:alignment-coherence-gate-revision-drift-soft
  - acceptance-check:alignment-coherence-gate-review-yaml-schema
  - acceptance-check:alignment-coherence-gate-review-cutoff-migration
acReviewedRevision:
  - 1
  - 2
  - 1
  - 2
fixtureRef: docs/contracts/story-chain/evidence-ledgers/reviews/alignment-coherence-gate.reviews.md
runCommitSha: 5d113ca57ff5
observedOutput: α Coverage — `review-parser.test.ts` now covers a pre-cutoff prose entry, a post-cutoff missing YAML rejection, a post-cutoff explicit current-ref override, and an explicit pre-cutoff YAML entry whose parsed YAML fields are visible to callers. β Wovenness — this ledger's coverage row, the Promise AC revision, and parser behavior now use the same rule: prose-only pre-cutoff is grandfathered, YAML is parsed whenever present.
gaps:
  - adopt: This review uses current Story Chain Acceptance Check refs.
  - reject: This review uses current Story Chain refs only.
verdict: met
```

- Input: Human clarified that the cutoff migration AC governs the product-facing
  schema contract, not Mission Control's need to read converted review metadata.
- Evidence: α Coverage — `review-parser.test.ts` now covers a pre-cutoff prose
  entry, a post-cutoff missing YAML rejection, a post-cutoff explicit current-ref
  override, and an explicit pre-cutoff YAML entry whose parsed YAML fields
  are visible to callers. β Wovenness — this ledger's coverage row, the Promise
  AC revision, and parser behavior now use the same rule: prose-only pre-cutoff
  is grandfathered, YAML is parsed whenever present.
- Gaps observed:
  - Adopt-resolved — current review entries are now available to
    parser consumers as YAML metadata.
  - Adopt-resolved — old prose-only entries remain supported by the cutoff
    grandfather.
  - Reject — forcing older review refs into current `acs[]` would
    create false traceability, so those entries stay outside current review YAML.
- Verdict: met
