---
name: mission-control-product-architecture-content-ownership
description: Classifies architecture-shaped Story Chain clauses and places product meaning, desired structure, runtime mechanism, executable evidence, and exact-revision observations with their canonical owners.
---

# Product and Architecture Content Ownership

Use this reference after Human-approved product meaning is explicit. It applies
both to forward contract work and to retrospective Promise or Aspect audits. Its
purpose is to keep user- or operator-visible meaning in Story Chain without
making Story Chain the source of truth for replaceable implementation details.

The authority order is:

```text
Human-approved product meaning
  -> Contract Architecture Impact Review (when triggered)
    -> content placement
      -> canonical owner documents and executable evidence
        -> Architecture Fitness policy projection and exact-revision observation
```

Architecture Fitness observations never run this order in reverse. Current
code or an observation cannot silently become desired architecture or product
meaning.

## Canonical Owners

| Content                                                                                                                             | Canonical owner                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| User- or operator-visible result, lifetime, restore/replay, recovery, degraded/failure, access, privacy, or latency meaning         | Promise                                                                                                   |
| A user- or operator-visible constraint shared by several Promise surfaces                                                           | Aspect                                                                                                    |
| An abstract, executable invariant that proves Promise meaning without requiring one replaceable implementation                      | Acceptance Check                                                                                          |
| Architecture impact classification, affected/current owners, selected structural rule, rejected alternative, and structural defense | Durable CAIR record plus the affected canonical engineering owner                                         |
| Layering, authority, carrier, chokepoint, data-access, or other stable engineering rule                                             | `docs/principles.md`, `docs/conventions.md`, `docs/infrastructure.md`, or another named engineering owner |
| Runtime entrypoint, execution order, fallback, retry, scheduler, cache, lease, persistence, or synchronization mechanism            | The relevant `docs/runtime-flows/**` document and implementation owner                                    |
| Exact test, command, target, fixture, artifact, and run reference                                                                   | Covering Evidence Ledger; guard implementation stays with the quality-gate or engineering owner           |
| Minimal machine-comparable projection of an approved structural decision                                                            | Architecture Fitness policy                                                                               |
| Facts collected from one exact revision and run                                                                                     | Architecture Fitness observation                                                                          |
| Reading order and links across canonical owners                                                                                     | Contract Map; it remains derived navigation                                                               |

An exact function, component, endpoint, table, environment variable, cache tag,
or test name is normally implementation or evidence content. Move it out of
Promise and Aspect prose unless the identifier is itself part of the visible
contract. Legitimate exceptions include a user-visible URL or route whose
identity carries restore/share meaning and an operator command that is the
declared operator surface.

Technical vocabulary is a triage signal, not a violation by itself. Timing,
persistence, replay, recovery, provider limits, and URL authority can be
product meaning even though they constrain architecture.

## Contract Layer Routing

Before classifying architecture-shaped clauses, use
[`contract-layer-routing.md`](./contract-layer-routing.md). It owns the combined
Experience, Moment, Promise, Aspect, and Architecture Fitness routing criterion,
including the public-URL versus replaceable-route distinction. This document
then owns content placement after the correct layer has been selected.

## Clause Classification

Classify each reviewed clause before editing it:

- **KEEP** — the clause states user- or operator-visible meaning and stays in
  its current Story Chain owner.
- **SPLIT** — the clause mixes visible meaning with a replaceable mechanism.
  Keep the meaning in Story Chain and move the mechanism to its canonical
  owner.
- **MOVE** — the clause is only an internal mechanism. Move it to the canonical
  engineering or runtime owner and leave a stable reference only when a reader
  needs that path to understand the contract.
- **EVIDENCE** — the clause names how truth is checked. Put the exact
  test/command/target/artifact reference in the covering Evidence Ledger.

For a retrospective audit, keep one working inventory row per clause or
Acceptance Check:

```text
story ref | clause/section | KEEP/SPLIT/MOVE/EVIDENCE | reason | destination |
stable ref | product meaning changed? | CAIR rerun required?
```

The inventory is a bounded work artifact, not a new source-of-truth registry.
Store it in the issue, PR, or other durable plan already used by the work.

## Meaning and Identity

First decide whether user- or operator-visible meaning changes.

- When meaning stays the same, preserve Promise, Acceptance Check, and Aspect
  identities. Do not rewrite their prose merely because an internal
  scheduler, cache, gateway, function, endpoint, table, or test name changed.
- When a mixed clause is normalized, preserve its visible guarantee while
  moving exact mechanism and evidence content to their owners.
- When removing or moving text would weaken lifetime, replay, recovery,
  degraded behavior, access, latency, or another visible guarantee, stop for
  Human authority. Rerun CAIR after the new meaning is approved.
- When an Acceptance Check changes truth criteria, use the normal semantic-id
  and revision rules. Content placement is not permission to reuse an id for a
  different assertion.

An Acceptance Check should state an executable invariant at the product
boundary. Evidence Ledger rows may then cite exact tests, paths, commands, and
fixtures. An AC may name a URL, route, or operator command only when that
surface identity is part of the guarantee rather than a convenient current
implementation.

## Stable References Without Duplicate Authority

Every `SPLIT` or `MOVE` row records a stable destination document and section
anchor. The covering Story Chain or Evidence Ledger path keeps a concise
pointer to that destination. Prefer an existing canonical document. Add a
focused heading to the owning runtime-flow or engineering document when
needed. Ask before adding a new runtime-flow document, as required by Mission
Control.

Place the pointer outside Human-authority prose when the identifier is not
visible meaning. The pointer must not restate the moved rule as a second
authority. Contract Maps may link both sides but must not copy either rule into
map-owned prose.

If code and desired architecture differ, preserve the approved desired rule in
the CAIR or engineering owner and record current behavior separately. Do not
overwrite desired structure with the current implementation. Route the
divergence to implementation or Human decision according to whether product
meaning changes.

## Architecture Fitness Handoff

CAIR remains the architecture-impact authority. Content placement identifies
which approved structural rules are eligible for a machine-comparable policy.
`docs/agent-skills.md` `### Architecture Fitness execution` owns the current
pinned case-kind and Lighthouse profile routing. The executable profile
registry is `scripts/architecture-fitness/lighthouse-profiles.mjs`. Core support
is not Lighthouse profile activation. A supported case without an active,
consumer-owned Lighthouse profile remains `unknown` until that profile and its
trusted collection path are approved. Every inactive or unsupported lens stays
machine-readable `unsupported`/`unknown` and returns to the named Human or
workflow owner.

Create Architecture Fitness policy from the approved CAIR and canonical
engineering owner, not from current code or a checked-in observation. Policy
owns the desired comparison values. The adapter and observation own current,
exact-revision facts. A deterministic assessment compares them without
replacing CAIR, Story Chain verdicts, Human decisions, or merge eligibility.

## Closeout Questions

Before considering placement complete, answer:

1. Does Story Chain still state every visible result, lifetime, restore,
   failure/degraded, access, and latency guarantee?
2. Does every moved mechanism have one canonical owner and a stable anchor?
3. Are exact tests and commands in the Evidence Ledger rather than duplicated
   in Promise or Aspect prose?
4. Does any Contract Map remain derived navigation only?
5. Does Architecture Fitness policy come from approved desired structure, and
   does every observation remain exact-revision evidence only?
6. Did unchanged meaning preserve Promise, Acceptance Check, and Aspect ids?
