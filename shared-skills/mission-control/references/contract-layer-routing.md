---
name: mission-control-contract-layer-routing
description: Routes product meaning, cross-cutting constraints, architecture decisions, and executable verification across Experience, Moment, Promise, Aspect, and Architecture Fitness.
---

# Contract Layer Routing

Use this reference when deciding where a statement belongs. The layers are not
a single ladder of increasing detail. Experience, Moment, and Promise declare
the vertical product meaning; Aspect constrains several Promises across that
vertical chain; Architecture Fitness checks a machine-comparable projection of
an already approved structural decision.

`docs/contracts/story-chain/concepts.md` remains the concept-definition
authority. This reference owns the routing test that connects those concepts to
CAIR, engineering/runtime owners, and Architecture Fitness.

## Routing Criterion

Route a statement by the change that would make it false, not by whether its
words sound technical.

| Owner                | Use when the statement becomes false because...                                                                 | Must not own                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Experience           | the durable user/operator situation, expected outcome, or product value changed                                 | one screen, route grammar, component, or test                                         |
| Moment               | the observable workflow situation in which expectations begin changed                                           | one implementation step or one Promise's truth criterion                              |
| Promise              | one user/operator-facing end-to-end guarantee changed                                                           | a rule whose meaning exists only as a shared constraint across several Promises       |
| Aspect               | the same visible constraint across two or more Promises changed                                                 | a single Promise detail or a rule promoted only because it sounds technical           |
| Architecture Fitness | a supported machine-comparable projection of an approved structural decision no longer matches current evidence | product meaning, CAIR classification, unsupported-lens judgment, or release authority |

Supporting owners keep exact detail out of the wrong layer:

| Owner                               | Responsibility                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Acceptance Check                    | executable truth criterion at one Promise's product boundary                                                                            |
| CAIR plus engineering/runtime owner | desired authority, carrier, canonical identity, layering, runtime order, persistence, serialization, or other structural/mechanism rule |
| Evidence Ledger                     | exact test, command, fixture, target, artifact, and run reference                                                                       |

## Decision Order

1. State the user/operator meaning without relying on current implementation
   identifiers.
2. Place the durable area in Experience, the triggering situation in Moment,
   and each vertical guarantee in Promise.
3. Add an Aspect only when the same visible constraint has a real pointcut
   across two or more Promises.
4. Run CAIR when the approved meaning constrains architecture. Record the
   selected structure with its engineering or runtime owner.
5. Use Architecture Fitness only after CAIR, and only when an active Lighthouse
   profile supports a minimal machine-comparable projection of that structure.
   Unsupported coverage remains `unknown`.
6. Put Promise-local executable truth in Acceptance Checks and exact evidence
   in the covering Evidence Ledger.

Architecture Fitness does not replace any Story Chain layer. A healthy fitness
case means the checked structure matches its policy at the observed revision;
it does not prove that the Experience, Moment, Promise, or Aspect is the right
product decision.

## URL Example

URL clauses demonstrate why technical vocabulary alone is not a routing rule.

| Statement                                                                                             | Owner                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A researcher can start a new search from any screen.                                                  | Moment                                                                                                  |
| A shared or reopened search address restores and reruns its conditions.                               | Promise                                                                                                 |
| Search and derived exploration use condition addresses while stored artifacts use artifact addresses. | Aspect, when the rule applies across the relevant Promises                                              |
| `/search?q=...` is the intentional public restore/share/bookmark or compatibility identity.           | Promise or Acceptance Check                                                                             |
| `/search?q=...` is only the current router spelling and may change without changing user meaning.     | Route/runtime owner; exact checks stay in the Evidence Ledger                                           |
| The URL is the canonical condition authority and client state cannot replace it.                      | CAIR plus engineering/runtime owner; supported state-boundary projection may go to Architecture Fitness |
| Serialized condition URLs must remain within an approved byte envelope.                               | Engineering policy plus a supported serialized-input-budget Architecture Fitness profile                |

## Review Questions

Before moving or accepting a statement, answer:

1. Would changing it alter the user's situation, expectation, or observed
   result?
2. Does it describe one vertical guarantee or constrain multiple Promises?
3. Is an exact identifier intentionally public and compatibility-bearing, or
   merely the current mechanism?
4. Has a structural rule been approved through CAIR and assigned a canonical
   engineering/runtime owner before Architecture Fitness projects it?
5. Are exact tests and commands kept in the Evidence Ledger?

## Policy Document Validation

Every changed policy document must be reviewed from its body, not inferred from
its filename, frontmatter, or graph position.

| Changed document            | Required body review                                                                                                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Experience                  | Identify the subject and situation, what the product does, the expected outcome or value, and the boundary against adjacent experience areas. The boundary may be expressed by the approved content itself; a separate heading is not required. |
| Moment                      | Identify the observable workflow situation that starts the expectation. Confirm it is narrower than the Experience, broader than one implementation step, and able to own every attached Promise.                                               |
| Promise                     | Identify one end-to-end user/operator guarantee. Confirm its Acceptance Checks test Promise-local truth and that shared constraints were not copied into it.                                                                                    |
| Aspect                      | Identify a real pointcut across at least two Promises, clear advice, reciprocal weaving, and covering evidence. A technical-sounding rule is not enough.                                                                                        |
| Architecture Fitness policy | Trace the desired values to an approved CAIR and canonical engineering owner, confirm an active supported profile owns the projection, and keep exact-revision facts in observations rather than policy.                                        |

For each changed document, classify questionable clauses as `KEEP`, `SPLIT`,
`MOVE`, or `EVIDENCE` using
[`product-architecture-content-ownership.md`](./product-architecture-content-ownership.md).
Record inspected paths and unresolved Human decisions in the Story Chain review
record.

`npm run mc:validate-story-chain` verifies graph and schema invariants. It does
not decide whether prose expresses the right product meaning or owner. Contract
closeout therefore requires both `npm run quality:contract` and a
`review-checklist-steward` review applying the `story-chain` group to every
changed policy document. Neither may be reported as a substitute for the other.
