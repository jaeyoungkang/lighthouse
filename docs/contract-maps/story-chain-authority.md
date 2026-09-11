# Story Chain Authority Contract Map

This map explains who owns each kind of contract decision.

It does not define the authority model. It points readers to the files that do.

## Authority Split

| Authority | Owns | Agent may advance? | Main sources |
| --- | --- | --- | --- |
| Human | Product meaning, Promise existence, normative approval | No | Story Chain concepts, Mission Control |
| Agent | Contract architecture-impact classification, propagation, implementation, contract synchronization | Yes | Mission Control, agent-skill routing, Promise/Aspect/Evidence Ledger files |
| Evaluator | Deterministic checks and live judges | Yes | Evidence Ledger, tests, live judge fixtures |
| System | CI, release gates, typecheck, surface audits | No | package scripts, Mission Control, release verdict |

Sources:

- [`docs/contracts/story-chain/concepts.md`](../contracts/story-chain/concepts.md)
- [`docs/mission-control.md`](../mission-control.md)

## Product Meaning

Product meaning starts in Experience, Moment, Promise, and Aspect documents.
Agents can draft text, but approval of a new Promise or new Aspect meaning is
Human authority.

When the question is "should the product promise this?", stop at Human authority.
When the question is "how do we propagate an approved promise?", Agent authority
can continue.

Before propagation, the Agent classifies whether the approved meaning has no
structural impact, constrains existing boundaries, or requires a reshape. If
the structural tradeoff would change the approved product meaning, the Agent
stops and returns that decision to Human authority.

Sources:

- [`docs/contracts/story-chain/README.md`](../contracts/story-chain/README.md)
- [`docs/contracts/story-chain/concepts.md`](../contracts/story-chain/concepts.md)

## Propagation

Approved meaning must propagate through:

1. Promise declaration.
2. Aspect pointcuts when cross-cutting behavior applies.
3. Contract Architecture Impact Review when the meaning changes an expectation
   along an architecture-impact axis.
4. Evidence Ledger source promises, applied aspects, checks, evidence, and verdict.
5. Code, tests, and surface tags.
6. Runtime-flow docs when runtime ordering changes.

Leaving any step stale means the change is incomplete.

Sources:

- [`docs/mission-control.md`](../mission-control.md)
- [`docs/agent-skills.md`](../agent-skills.md)
- [`docs/intent-traceability.md`](../intent-traceability.md)

## Evidence

Evidence Ledger is the machine-verifiable weaving ledger. It is not a future
feature spec. It answers what currently proves a Promise or Aspect.

Acceptance Checks must map into `acceptanceChecks` rows. UI-facing Intent
Checks must inspect actual runtime generated output or actual rendered DOM.

Sources:

- [`docs/contracts/story-chain/concepts.md`](../contracts/story-chain/concepts.md)
- [`docs/intent-traceability.md`](../intent-traceability.md)

## Review Retention

살아 있는 Sufficiency Review sidecar의 세대 보존 dry-run은 별도 운영 정본을
읽는다. 이 절차는 현재 Evidence Ledger와 sidecar 소유권을 계산할 뿐,
Promise나 Evidence Ledger 의미를 만들지 않는다. 실제 삭제와 CI 차단은
별도 승인 전까지 비활성 상태다.

Sources:

- [`docs/mission-control-review-retention.md`](../mission-control-review-retention.md)
- [`docs/mission-control.md`](../mission-control.md)

## Runtime Flow Boundary

Runtime-flow docs explain how the system processes a runtime flow. They do not own user
value or acceptance criteria. If runtime ordering changes, update runtime-flow
docs and the relevant Story Chain/Evidence Ledger sources together.

Sources:

- [`docs/runtime-flows/README.md`](../runtime-flows/README.md)
- [`docs/runtime-flows/ai-response-generation.md`](../runtime-flows/ai-response-generation.md)

## Read Path

For a new product-facing commitment:

1. Product Identity.
2. Story Chain concepts.
3. Mission Control.
4. Affected Experience/Moment/Promise/Aspect.
5. Agent-skill routing for the Contract Architecture Impact Review.
6. Covering Evidence Ledger.
7. Runtime-flow docs only if procedure changes.

Do not use this map as the approval artifact.
