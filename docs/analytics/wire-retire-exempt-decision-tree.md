# Analytics Event Decision Tree — wire / retire / exempt

`mc:event-impact --sync` scaffolds a stub event in
`docs/analytics/events.yaml` whenever a Story Chain promise is changed but no
canonical event yet covers it. The scaffold is intentional — it forces the
author to decide what to do, not to silence the gate. The three options below
are mutually exclusive for any given stub.

This document is the canonical decision tree. When an agent or a human is
choosing what to do with a `(draft)` event in
`event-coverage.generated.md`, they pick exactly one path.

## Decision tree

```
Stub event for promise:X exists. The promise body claims a behavior.
│
├─ Is there a user / operator action that triggers the behavior on a real surface?
│   ├─ YES → WIRE
│   └─ NO  → continue
│
├─ Is the promise lane `product` or any user-facing surface (search / pdf /
│   research route / about)?
│   ├─ YES → re-read the promise. If you cannot find the user action that
│   │        produces the surface event, the promise itself is probably
│   │        miswritten. Open an issue rather than exempt.
│   └─ NO  → continue
│
└─ Promise lane is `admin` / `governance` / internal-only AND the reality
    signal is captured elsewhere (alignment audit, mc:status, etc.)
    └─ EXEMPT (with rationale)

If none of the above apply → RETIRE (delete the stub).
```

## Three paths

### WIRE

Add a `trackCanonicalEvent(...)` call site at the action that triggers the
behavior. Update the event entry in `events.yaml` so:

- `sinks` is non-empty (currently `amplitude`).
- `trigger.timing` describes the concrete UI / runtime trigger.
- `observability.signalMeaning` describes what the signal tells the reader.
- `observability.requiredForPromiseCoverage` is `true` when the event is
  the canonical evidence for the promise being kept.

Drop the `(draft)` rendering by populating `sinks` and rerun
`mc:event-impact -- --update`.

### RETIRE

Delete the event entry from `events.yaml` entirely. Rerun
`mc:event-impact -- --update` to refresh `event-coverage.generated.md`. The
promise must then either gain a different event entry, or be marked
`analyticsExempt` (next section). A retired stub is only valid if the
promise's behavior is genuinely **not** instrumentable as a user behavior
signal in the current product.

### EXEMPT

Reserved for `lane: admin` / `lane: governance` / `lane: other` promises
that do not have user-facing surfaces. Mark the Promise frontmatter:

```yaml
analyticsExempt: <one-line rationale referencing where the reality signal
  actually lives — e.g., "alignment audit emits finding"; "mc:status
  read-only">
```

Then remove the stub event from `events.yaml`. `mc:event-impact` treats a
promise with `analyticsExempt` as not requiring canonical event coverage.

**Never** set `analyticsExempt` on `lane: product` / `search` / `pdf` /
research route promises. The product surface always has a user trigger; if you
cannot find it, the promise body is likely too vague — fix the promise body
first.

**Exception — retired, deleted surfaces.** A promise with `status: retired`
whose user-facing surface and emit site were *deleted* (not merely hidden) may
carry `analyticsExempt` regardless of its original lane: there is no longer a
runtime trigger to wire, so RETIRE + `analyticsExempt` is the honest closure.
State the deletion in the rationale (e.g. "retired remove-stance surface
deleted; no runtime event surface to emit"). This is the only lane exception,
and only for genuinely removed surfaces — an active research route surface
still follows the WIRE rule above.

## Anti-pattern

The 2026-05-14 experiment surfaced a model run where Opus-4-7 invented an
`analyticsExempt` mechanism and applied it to product-facing click events
(`product.similar_papers_discovery.clicked`,
`product.gap_view_margin.viewed`, etc.) that obviously had click
surfaces. The exempt path is intentionally narrow precisely to avoid this
shortcut.

If you find yourself reaching for EXEMPT on a `lane: product` row, stop and
re-read the promise body. The right answer is almost always WIRE.

## Validator hint

`mc:event-impact` flags an uncovered impact for any changed promise whose
events have `sinks: {}` (or no events at all). The flag rendering in
`event-coverage.generated.md` shows the event name with `(draft)`. A
`(draft)` row on `lane: product` is a WIRE work item. A `(draft)` row on
`lane: admin` / `governance` is an EXEMPT-or-RETIRE work item.
