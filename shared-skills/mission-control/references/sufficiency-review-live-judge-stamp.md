---
name: mission-control-sufficiency-review-live-judge-stamp
description: Stamp format for Evidence Ledger review entries that claim a qualitative Intent Check verdict.
---

# Sufficiency Review Live Judge Stamp

Use this stamp when a Evidence Ledger review entry claims `Verdict: met` for one or
more Intent Checks that require live judge evidence.

```markdown
- Judge evidence: `npx vitest run <path> -t "<test name>"`
- Runtime surface: actual runtime AI response output or rendered DOM
- Result: `met`
- Attempt policy: <declared before rerun: N runs and required quorum>
- Observations: <preserve every met/not-met result and distinguish generation output from judge result>
- Stability: <single run | met N/N | met Q/N; do not report retry-to-green as a single clean run>
```

If an unchanged content head first returns `not-met`, a later `met` does not erase
that observation. Before rerunning, declare a bounded sample count and quorum,
run every sample, and record the whole sequence in the current review entry. A
review may claim only the stability proven by that declared sample; it must not
upgrade a stochastic sample to deterministic fulfillment.

Deterministic Acceptance Check-only ledgers do not need this stamp. They must
instead cite the concrete structured execution or guard that proves each Acceptance
Check.
