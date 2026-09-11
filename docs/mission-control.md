---
type: operations
---

# Mission Control

Mission Control is the operating model for keeping Light House's current Story
Chain honest. It governs Promise-driven work: adding, changing, verifying, or
retiring a user Promise.

## Canonical State

Mission Control state is derived from current files only:

- `docs/contracts/story-chain/experiences/`
- `docs/contracts/story-chain/moments/`
- `docs/contracts/story-chain/promises/`
- `docs/contracts/story-chain/aspects/`
- `docs/contracts/story-chain/evidence-ledgers/`
- `docs/contracts/story-chain/traceability-cardinality.json`
- `docs/contracts/story-chain/scenario-catalog.md`
- `docs/runtime-flows/` when runtime ordering, fallback, programmatic inspect/AI
  response boundaries, persistence, or sync ownership changes
- user-facing code and tests under `app/`

There is no external markdown backlog, judgment ledger, or reality-feedback
ledger after the Story Chain reset. Current status is computed from Story Chain
and Evidence Ledger coverage.

## Vocabulary

| Term | Role |
| --- | --- |
| Experience | Product direction node |
| Moment | Workflow moment node |
| Promise | User-facing intent declaration |
| Intent Check | Qualitative live-judge question |
| Acceptance Check | Deterministic contract |
| Aspect | Cross-cutting rule |
| Evidence Ledger | Machine-verifiable weaving ledger |
| Code | Implementation, tests, and surface tags |

Dated audit entries may quote older `historical` refs when preserving past
decisions. Current workflow guidance and new Story Chain entries should use
canonical refs and current vocabulary.

## 4 Authority Model

| Chip | Authority | Agent advance? | Owns |
| --- | --- | --- | --- |
| H | Human | No | Product meaning, Promise existence, normative approval |
| A | Agent | Yes | Propagation, implementation, contract synchronization |
| E | Evaluator | Yes | Running deterministic checks and live judges |
| S | System | No | CI, release gates, typecheck, surface audits |

Agents may advance A/E rows when the next step is determined by current
contracts. Agents stop on H/S rows.

## Chain Closure

Every Promise-driven change must close:

1. Experience and Moment parent refs.
2. Promise declaration.
3. Aspect pointcuts when cross-cutting behavior applies.
4. Contract Architecture Impact Review when the approved contract changes an
   expectation along an architecture-impact axis. Record `none`,
   `constrain-existing`, or `reshape` before implementation, following
   `docs/agent-skills.md` and the Mission Control reference procedure.
5. Evidence Ledger `sourcePromises`, `appliedAspects`, `intent`,
   `acceptanceChecks`, `executions`, implementation contracts, and verdict.
   실행 원장은 strict YAML v2이며 Acceptance Check는 완전한 key와 하나 이상의
   execution ref를 가진다.
   When an Acceptance Check depends on generated payload, persisted state,
   runtime branch selection, or another upstream invariant, the Evidence Ledger
   must name evidence for that dependency as well as the final rendered state.
   A fixture that already satisfies the invariant is not enough unless another
   row or test proves the real path creates that fixture shape.
6. Code and tests.
7. Runtime-flow docs when the change alters runtime ordering, fallback order,
   programmatic inspect/AI response boundaries, persistence/sync ownership, or
   debugging signals.
8. Surface tags: `// @promise`, plus `// @aspect` and `// @check` when relevant.
9. Role-separated review for risky changes: context preservation, recovery,
   history, previous-state snapshots, research route/view lifecycle, analytics
   event contracts, any Contract Architecture Impact Review verdict, AC
   rename/retire, Sufficiency Review edits, or new Aspect/Skill policy.

Leaving any step stale means the change is incomplete.

## Service Policy Coverage Review

새 `core-product` Experience나 서비스 단위 Moment·Promise bundle을 구성·재구성할
때는 Promise 초안보다 먼저 Service Policy Coverage Review를 연다. 서비스에는
사용자 경험으로 직접 기술되지 않아도 반드시 정해야 하는 입력·품질·출처·결과
범위·실패와 복구·상태 수명·접근과 보호·운영 가능성·호환과 종료 정책이 있다.

검토 계획과 Human checkpoint는 작업이 이미 쓰는 issue나 PR plan에 정확한
`## Service Policy Coverage Review` heading으로 남긴다. 현재 관찰과 판정은
`docs/contracts/story-chain/service-policy-coverage/*.matrix.yaml`에 versioned
Matrix로 기록한다. 조사 원문은 Moonlight Project Knowledge의 commit 고정 자료를
사용한다.
각 row는 관찰 상태와 정책 판정을 독립된 필드로 보존한다.

Matrix는 정책 영역과 기대 서비스 능력, 하나의 원자적 현재 사실, exact-revision
근거, 실제 책임 surface, `owned | rejected | unresolved` 판정, canonical owner,
다음 행동이나 reopening condition을 가진다. 감사 snapshot의 관찰도 별도 필드로
남겨 현재 head와 `unchanged | changed-since-audit | current-unknown`으로 대조한다.
provider 기능의 존재는 Moonlight 서비스 충족을 뜻하지 않는다. 현재 미충족이라는
관찰도 지원 결정을 뜻하지 않는다.

- `owned`: 사용자-facing 의미는 Story Chain, 실행 순서는 runtime-flow,
  권한·데이터 수명은 security/data/infrastructure 정본, SLO·용량·rollout은
  Operational Readiness, 검증은 Evidence Ledger/quality gate로 전달한다.
- `rejected`: Human 근거와 다시 검토할 조건을 남긴다.
- `unresolved`: Story Chain bundle의 확정·전파·구현을 멈춘다.

`core-product` Experience는 frontmatter에 `servicePolicyCoverage: complete |
unresolved`와 local Matrix를 가리키는 `servicePolicyCoverageReview`를 선언한다. 검토 row의
`unresolved`가 하나라도 남으면 aggregate도 `unresolved`다. 이 상태는 구조 복구와
미결 기록의 병합을 막지 않지만 `mc:status`의 release verdict를 blocked로 유지한다.
모든 row가 `owned` 또는 근거 있는 `rejected`일 때만 `complete`로 바꾼다.

다음 변화는 전체 review 또는 영향 family의 delta review를 연다.

- 새 핵심 제품·서비스 contract bundle을 만든다.
- 기존 bundle의 사용자 의미나 서비스 책임을 크게 재구성한다.
- incident, 감사, 사용자 연구에서 누락된 최소 정책이 드러난다.
- 정책 정본이나 owner 경계가 바뀐다.

의미를 보존하는 코드 수정, 기존 계약의 evidence 보강, 단순 기록 정정은 자동으로
review를 다시 열지 않는다. 다만 exact revision과 관찰 사실이 바뀌면 Matrix의 해당
row를 갱신하고 aggregate를 다시 계산한다.

모든 최소 정책을 Promise나 scenario로 바꾸지 않는다. 활성 scenario는
사용자-facing `owned` 정책의 전파 경로이고, validator는 각 활성 scenario가
Evidence Ledger entry에 도달하는지만 역방향으로 검사한다. 전체 절차와 검색
서비스의 추가 렌즈는
`shared-skills/mission-control/references/service-policy-coverage-review.md`가
소유한다. CAIR는 확정된 계약의 구조 영향을 검토하며 이 completeness review를
대체하지 않는다.

## Minimum Owner Closure

Chain closure keeps the approved invariant, its owning Promise or Aspect,
Evidence Ledger, runtime owner, implementation, tests, and surface tags in the
same workstream. It does not require every downstream mention, sibling
contract, historical review, or cleanup candidate to change together.
Downstream impact discovery does not transfer ownership. A downstream contract
that needs new meaning or evidence receives its own owner decision and keeps
its Sufficiency Review in its owning ledger.

Before implementation, record a `## Propagation Map` when CAIR returns
`reshape`, Concept Shift includes `remove`, the cross-impact scan finds multiple
owning bundles, the work adds a cache/state lifecycle, or the forecast reaches
a scope checkpoint. Store the map in the durable issue/PR plan, contract, or
runtime-flow already used by the work. Do not create a separate registry.

The map names the approved invariant, owning contract bundle, runtime owner,
minimum code/test paths, inspect-only downstream owners, compatibility shapes,
split cleanup, and forecast file/churn range. Stop and report scope when the
forecast exceeds its maximum, reaches 30 files without a map, touches more than
three owning bundles, adds an unplanned lifecycle, exceeds 1,000 authored
changed lines, gains five unplanned files through one review correction, or
grows after the second review round.

These thresholds are advisory scope checkpoints. They do not prohibit a large
migration and do not become file-count or line-count CI failures. Stable graph
ownership remains blocking: a new Sufficiency Review may name AC/IC refs only
from its Evidence Ledger's `Source Promises`. The full procedure and report
format live in
`shared-skills/mission-control/references/propagation-scope-control.md`.

## Contract Architecture Impact Review

This review asks whether current system boundaries can support an approved
user- or operator-facing Story Chain contract before implementation begins.
Open it when a new or meaning-changed Experience, Moment, Promise, Acceptance
Check, or Aspect changes an expectation along interaction timing; domain/data
shape; source of truth or authority; state lifetime, persistence, recovery, or
history; ordering, concurrency, idempotency, or cancellation; runtime placement
or external/AI boundaries and failure policy; security/privacy; resource
capacity or cost; observability identity/cardinality;
compatibility/retirement; or a shared invariant across several surfaces.

The verdict is `none`, `constrain-existing`, or `reshape`. Every record uses the
exact `## Contract Architecture Impact Review` heading in an existing durable
issue/PR plan or body, contract artifact, or runtime-flow document. `none`
records the contract delta, affected axes, and evidence that current boundaries
already support it. `constrain-existing` and `reshape` also name current owners,
chosen structural rules, a rejected alternative, and the evidence/structural
defense plan. Copy, layout, or qualitative wording alone does not trigger the
review. The complete procedure is
`shared-skills/mission-control/references/contract-architecture-impact-review.md`.

The Agent owns the impact verdict only inside approved product meaning. If an
architecture tradeoff would change that meaning, stop and return the choice to
Human authority.

If `reshape` can leave a retired product model active, also run the Concept
Shift Architecture Review. If the review changes runtime ordering, persistence,
fallback, response boundaries, or sync ownership, the relevant runtime-flow
document is part of chain closure.

## Role-Separated Review

Some Story Chain changes require a reviewer who is not in implementation mode.
Run this review before closeout when the change touches context preservation,
recovery, history, previous-state snapshots, research route/view lifecycle,
analytics event contracts, any Contract Architecture Impact Review verdict, AC
rename/retire, Sufficiency Review entries, or new Aspect/Skill policy.

When the active host and user authorization allow subagents, use read-only
reviewers with explicit roles. Keep implementation in the main agent unless
write scopes are disjoint.

- `lifecycle reviewer`: store ownership, hydration, research route switch, id reuse,
  deletion, stale snapshot, invalid restore, and post-restore cleanup.
- `contract-history reviewer`: Promise/Aspect/AC weaving, Evidence Ledger
  coverage, analytics refs, and dated Sufficiency Review integrity.
- `architecture-impact reviewer`: durable record marker, verdict completeness,
  Human/Agent authority boundary, and evidence/structural-defense propagation
  into the affected runtime, gate, analytics, or operational owner.

If subagents are unavailable or not authorized, perform the same review locally
as a separate pass and report the reviewer roles in closeout. A green validator
does not replace this review; validators check current structure, while this
review checks state lifecycle and historical honesty.

## Evidence Ledger Intent Ownership

YAML v2 원장은 `intent.mode`로 Intent 소유권을 명시한다. `explicit`은 정본
Promise의 Intent Check를 직접 증명하고, `absorbed`는 Intent Check가 없는 각
source Promise를 deterministic Acceptance Check로 닫는다. `delegated`는 모든
Intent Check key와 이를 직접 소유한 `explicit` 원장 slug를 선언한다. validator는
세 모드의 조건과 위임 대상을 전체 Story Chain 그래프에서 검증한다. 외부
judgment-anchor 파일은 필요하지 않다.

## Traceability Cardinality

`mc:validate-story-chain` also reads
`docs/contracts/story-chain/traceability-cardinality.json`. The policy requires
that every active scenario appears in at least one Evidence Ledger
`acceptanceChecks` entry, every Experience has a Moment, every Moment has a
Promise, every Promise has Acceptance Checks, every Promise appears in at least
one Evidence Ledger, and every Promise Acceptance Check appears in at least one
Evidence Ledger `acceptanceChecks` entry. A ledger ref to a scenario outside the
active catalog is also rejected.

This is the current replacement for generic traceability tooling. Adapter and
Alloy-style verification remain deferred until the thresholds in
`docs/contracts/story-chain/deferred-verification-triggers.md` are reached.

## Evidence Runner

`evidence-ledger` is the local audit runner for Evidence Ledger files. It is not
a human-facing HTML/JSON report generator. Humans, agents, and CI read the Story
Chain files, `mc:status` output, and runner exit codes directly.

runner는 raw shell wrapper가 아니다. YAML v2 execution 객체를 binary와
`args[]`로 변환해 `shell: false`로 실행한다.

- 원장 또는 구조화 execution이 없으면 실패한다.
- `vitest`, 등록된 `contract-check`, `guard:*`, `registered-script`만 허용한다.
- stale file, 미등록 target/subcase/script, dangling execution ref를 거부한다.
- it runs the zero-test guard so stale `vitest -t` filters cannot pass while
  matching zero tests.
- it can run only impacted ledgers with `--ledger <name-or-path>` when a change
  affects a narrow Promise, Aspect, or user-facing contract surface.

## Verdict Semantics

`met`, `not-met`, and `unknown` are release-significant. `unknown` is not
neutral; it means evidence is missing or unresolved.

For UI-facing Promises, Intent Check evidence must evaluate one of:

- actual runtime AI response output;
- actual rendered DOM.

Simulation wrappers, idealized prompt outputs, or hand-authored judge inputs do
not count as evidence.

## Release Verdict

Release verdict is the conjunction of:

<!-- release-verdict-dimensions:start -->
- Intent verdict;
- Acceptance Check trace;
- Service Policy Coverage;
- Aspect verdict;
<!-- release-verdict-dimensions:end -->

`mc:status` keeps those dimensions visible separately so a blocked release can
be debugged by dimension. 이 목록의 순서와 label은
`app/domain/story-chain.ts`가 소유한다. `mc:validate-story-chain`은
이 문서 block이 CLI 계약과 달라지면 실패한다.

## Commands

```bash
npm run mc:status
npm run mc:review-retention
npm run mc:next -- --authority A
npm run mc:next -- --authority E
npm run evidence-ledger:dry
npm run evidence-ledger
npm run mc:validate-story-chain
npm run mc:audit-surface
npm run mc:audit-story-surface
npm run mc:check-critical-findings
npm run quality:contract
npm run quality:fast
npm run quality:full
```

`mc:status` is the read-only operator view over the current chain. It derives
from Story Chain files and does not own separate state.

`mc:review-retention`은 살아 있는 Sufficiency Review sidecar의 세대 수와
보존 후보를 읽기 전용으로 계산한다. 승인된 기본값은 `N=3`이다. 현재
AC·IC·Aspect 권한 운반자, 현행 reader 호환 세대, foundational 예외를 별도로
보존한다. 명령은 삭제나 rewrite를 실행하지 않으며 CI gate에도 연결되지
않는다. 정책과 현재 기준선은
`docs/mission-control-review-retention.md`가 소유한다.

`quality:contract` is the canonical local closeout gate for contract-affecting
Story Chain work, docs-only edits included. Its gate list is owned by the
`package.json` alias definition — run the alias instead of hand-picking a
subset, which is how the docs-only minimum once dropped
`mc:check-critical-findings` (issue #193). `quality:fast` is the normal
PR-shaped local gate. It runs `evidence-ledger:dry`, Story Chain validation,
surface audits, typecheck, unit tests, and static quality guards.
`quality:full` is the fuller local gate with coverage and executable Evidence
Ledger runs.

## Done Criteria

Before closeout:

1. `npm run quality:contract` passes — the canonical contract closeout alias;
   its member list is owned by the `package.json` definition.
2. Targeted deterministic tests or live judges pass.
3. Runtime-flow docs are current when runtime procedure ordering or fallback
   behavior changed.
4. Required Contract Architecture Impact Review records are complete for their
   verdict; `constrain-existing` and `reshape` evidence/structural defenses are
   present.
5. Required role-separated reviews are completed and concrete findings are
   applied before the final gate pass.
6. `npm run typecheck` and `npm run test:unit` pass when the change touches
   code.
