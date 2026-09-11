# Architecture Fitness review bundle

This reference defines the required review passes after
`architecture-fitness-review` and the Lighthouse adapter have produced the
supported profile policies, exact-revision observations, and bounded candidates.
It applies to the active least-authority and state-boundary profiles. It does not
calculate verdicts or replace CAIR.

## Role-separated passes

Run three role-separated passes for substantial work.

### Code and authority/state-graph reviewer

- Trace each privileged capability from acquisition through allowed callers,
  principal creation, domain-access composition, repository predicate, cache
  identity/invalidation, and effect sink.
- Search the complete production graph, not only changed files, for named,
  namespace, dynamic, `require`, re-export, environment-key, and parallel
  factory bypasses that apply to the changed capability.
- Resolve constant-concatenated, template, and const-aliased dynamic module
  specifiers before authorization. If a production dynamic import or `require`
  cannot be resolved statically, do not silently omit it from the graph.
- Treat a privileged method as an acquired capability across direct property
  calls, statically computed element access, extracted aliases,
  `call`/`apply`/`bind`, reflection, and wrapper/value escape. Inventory the
  protected symbol's acquisition, not only call syntax; string-literal-only
  guards do not prove the seam.
- Pair positive behavior tests with negative fixtures that prove an unauthorized
  caller or stronger raw helper fails.
- For state-boundary cases, trace each declared authority, carrier, and canonical
  identity through the production path. Mutate authority precedence, forbidden
  identity inputs, and carrier lifetime independently. A source-text match without
  those negative executions does not prove the state boundary.
- Follow the value returned by a state normalizer through newly introduced local
  helpers and fail closed on undeclared runtime authority. A fixed list of known
  helper names does not prove that a new helper cannot replace URL-owned input.
- When symbol evidence analyzes a materialized revision, bind the TypeScript
  compiler host/current directory and module resolution to that materialized
  root. Resolving protected symbols against the reviewer's checkout is not
  exact-revision evidence.
- If a raw privileged client crosses a function or layer boundary, lexical
  acquisition guards cannot claim complete interprocedural coverage. Replace it
  with an opaque registered capability whose creation and unwrap owners are
  enforced, or keep observation completeness `partial`.
- Repository residency alone does not make a wrapper safe: a wrapper can return
  or callback with an unwrapped client. Declare cross-layer repository runtime
  APIs by module, symbol, and caller so a new laundering wrapper is rejected at
  acquisition.
- Run the relevant architecture, database-load, server-load, and
  security/privacy checks. Passing current-caller tests does not prove that
  future callers cannot acquire stronger authority.

### Review-contract and evidence reviewer

- Confirm baseline, fix, and target revisions are exact and that baseline
  artifacts remain unchanged. Re-run the same Fitness Case identities before
  and after repair rather than substituting a new green case.
- Treat policy as the editable declaration and checked-in observations as
  reproducible unsigned fixtures. Require the collector to execute every
  declared test or guard at the exact target revision; file existence and a
  hard-coded exit code are not evidence. Reject fixture drift.
- Keep executable case verdicts separate from unsupported product outcome,
  decision fitness, and process effectiveness. The unsupported lenses remain
  `unknown` and Human-owned. Compare policy, observation, README summary, and
  advisory merge eligibility for the same required-case scope.
- Check every `match` or `mismatch` has exact observed evidence at the declared
  revision. Human evidence must record owner, date, and scope, and may close only
  the check it explicitly classifies.
- Verify an approval of API clarity or local guard cost does not implicitly
  approve mandatory CI promotion, process cost, new authority, or a different
  product contract.
- Do not treat an arbitrary local attestation-key environment variable as a
  trusted gate. Require a protected runner identity and an immutable,
  invocation-specific run ref; before/after collections must use different run
  refs.
- Keep collection completeness independent from attestation authority. A
  consumer with no protected verifier may record complete collection while its
  official evaluation strips caller-provided keys, rejects cryptographically
  verified-but-non-authoritative assessments, and remains `unknown`.

### Overengineering and process reviewer

- Compare each new wrapper, allowlist, guard, exception, and artifact field with
  existing repository patterns. Prefer removing or reshaping a raw capability
  before accumulating enforcement around it.
- Require every retained layer to own auth, authority selection, caching, effect
  coordination, or meaningful complexity. Flag responsibility-free hops and
  speculative extension points.
- Check guard cost against the concrete bypass class, production scan scope,
  false positives, legitimate-caller update path, and negative-test value.
- Keep local conformance distinct from trusted or `quality:*` promotion. When no
  authoritative verifier and durable run provenance exist, every adapter run
  remains unsigned `unknown`. Trusted or mandatory promotion remains a separate
  process and `quality-gate-steward` decision.
- Preserve process-effectiveness `unknown` when authoring or execution-cost
  proportionality lacks Human evidence, even when merge-critical cases are
  healthy.

## Finding shape

Each reviewer returns only evidence-backed findings.

```text
severity:
path_or_symbol:
invariant:
bypass_or_failure:
evidence:
smallest_owner_fix:
validation:
```

The root reviewer classifies findings with the normal review loop, applies
root-cause-sufficient fixes, and re-runs every affected role after a fix changes
its review surface. A clean first pass is not completion if another role finds a
valid defect that changes code or artifacts.

## Minimum validation

Always run the affected boundary guard and its representative negative bypass
and positive false-positive cases:

```bash
npm run guard:least-authority-boundaries
```

Run `npm run architecture-fitness:advisory` only when the reviewed change
modifies Architecture Fitness policy, collector, adapter, profile, checked
observation, pinned core, trust, or evaluation semantics. It recollects every
active profile, so one named execution owner runs it and other reviewers consume
the artifact. Do not precede it with `architecture-fitness:validate`; that
would repeat the same fixed exact-revision collection. When the full local
quality path is also required, one execution owner runs `quality:fast` and the
justified advisory serially. Ordinary product changes use the blocking
boundary guards and affected tests; they do not run protected attestation.

An operator-requested workflow on protected `main` owns authoritative
attestation. The exact target workflow·collectors are the authority; the first
parent is a comparison baseline, not a collector-identity bootstrap condition.
Product PRs use blocking boundary guards and exact-head review. Local and
synthetic-key runs remain unsigned or test-only. Do not report a profile as
live-authoritative until an exact-main run has produced and independently
verified its signed bundle.
