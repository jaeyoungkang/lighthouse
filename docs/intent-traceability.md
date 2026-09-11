---
type: design-method
---

# Intent Traceability

Intent Traceability is the UI quality aspect for Light House. It keeps
user-facing intent connected from Promise declaration to Evidence Ledger evidence
to rendered code.

Layout values and visual design criteria are out of scope here. `docs/design-standards.md`
holds them: the goodness of a tuned value (such as the reading rail width) and the
standard for visual feel. Intent Traceability covers behavior and intent contracts;
design-standards covers whether a value is good and the standard for feel.

## Contract Architecture Impact Review — Issue #449

- Verdict: `reshape`.
- Previous owner: application-server services plus three internal admin routes.
- Selected owner: `scripts/mission-control/` owns snapshot, alignment, Aspect,
  and release-verdict calculation; Story Chain files and `mc:status` remain the
  operator reading surface.
- Removed boundary: `/admin/intent`, `/admin/story-chain`, and
  `/admin/llm-usage`, including their application-server read services and
  global usage-report capability.
- Preserved boundaries: `/about/*`, `/admin/analytics`, Story Chain parsers, and
  best-effort trusted LLM usage inserts.
- Rejected alternative: retaining web projections for a single operator would
  duplicate the CLI and keep global read authority in the application server.
- Structural defense: no retirement-specific absence guard remains. Any future
  governance surface must enter through its current product and process owner.

## Concept Shift Architecture Review — Issue #449

- Admin governance dashboards: `remove`; no redirect or compatibility page.
- CLI/gate calculations imported by Mission Control: `preserve` by moving them
  to `scripts/mission-control/lib`.
- Story Chain parser used by gates and analytics: `preserve` in its current
  application path until a separate ownership migration is approved.
- LLM usage collection: `preserve` write-only; admin aggregation and report:
  `remove`.
- Historical issue, PR, and archived review prose: `preserve` as dated history;
  current contracts and reading maps must not cite the retired surface.

## Current Vocabulary

Use current Story Chain terms:

- Promise
- Intent Check
- Acceptance Check
- Aspect
- Evidence Ledger

Current prose should use canonical Story Chain refs. Dated audit entries may
still quote older `historical` refs when preserving past decisions, but new
Promise, Aspect, and Evidence Ledger guidance should not introduce them.

## Three Layers

### 1. Promise

The Promise is the user-facing intent declaration. It should state what the
user gets and why it matters.

### 2. Intent Check

An Intent Check asks whether the intended user-facing meaning is actually
perceived. It is qualitative and is judged against real runtime output or real
rendered DOM.

Each block must include:

```markdown
### intent-check:<slug>

- question: ...
- evidence: live judge @ `app/.../*.live.test.tsx`
- why live judge: ...
- linked acceptance checks:
  - acceptance-check:<slug>
- answer criteria: ...
```

Use 1 to 3 Intent Checks per UI Promise. If a question can be answered by one
deterministic test, make it an Acceptance Check instead.

### 3. Acceptance Check

An Acceptance Check is deterministic. It is closed by a concrete test, script,
or guard.

```markdown
### acceptance-check:<slug>

- description: ...
- evidence: vitest @ `app/.../*.test.tsx`
```

## Evidence Ledger Propagation

The covering Evidence Ledger must reference, not duplicate, Promise checks.
Acceptance Checks are recorded as strict YAML v2 `acceptanceChecks` entries:

```yaml
schemaVersion: 2
slug: <slug>
sourcePromises:
  - promise:<slug>
appliedAspects:
  - aspect:<slug>
intent:
  mode: explicit
  checks:
    - key: promise:<slug>#intent-check:<slug>
      evidence: live judge @ `app/.../*.live.test.tsx`
  delegations: []
acceptanceChecks:
  - key: promise:<slug>#acceptance-check:<slug>
    assertion: vitest @ `app/.../*.test.tsx` ("exact test name")
    executionRefs:
      - execution:<slug>
    scenarios:
      - scenario:<slug>
executions:
  - id: execution:<slug>
    kind: vitest
    files:
      - app/.../*.test.tsx
    testNamePattern: exact test name
implementationContracts: []
verdict: met
```

모든 YAML v2 원장은 실제 evidence와 구조화 execution을 가져야 한다. `absorbed`
mode는 모든 source Promise에 Intent Check가 없고 각 Promise가 그 원장에
Acceptance Check entry를 가질 때만 허용한다. `delegated` mode는 모든 정본 Intent
Check를 다른 `explicit` 원장에 완전한 key로 위임해야 한다.

`npm run mc:validate-story-chain`은 strict YAML v2 schema와 intent ownership,
execution ref 무결성을 검사하고
`docs/contracts/story-chain/traceability-cardinality.json` 정책도 적용한다.

## Evidence Rules

- Live judge evidence must inspect actual runtime AI response output or actual
  rendered DOM.
- Simulation wrappers and idealized prompt outputs are invalid evidence.
- Acceptance Check evidence must name an executable test, script, or explicit
  global guard.
- `unknown` verdict is blocking, not neutral.

## UI Change Checklist

1. Read the Promise and covering Evidence Ledger before editing UI.
2. Confirm whether the change affects Intent Checks, Acceptance Checks, or
   Aspect pointcuts.
3. Update the Promise and Evidence Ledger in the same change when intent or
   evidence changes.
4. Implement the UI with current surface tags.
5. Run targeted tests, live judges where applicable, `mc:validate-story-chain`,
   `mc:audit-surface`, and `mc:audit-story-surface`.

## Anti-Patterns

- Adding UI behavior without a Promise and Evidence Ledger edge.
- Treating a deterministic check as an Intent Check.
- Letting an Intent Check pass on text that never appears to the user.
- Weakening the judge instead of fixing the surface.
- Recording state in prior signal records instead of current Story Chain
  files.
