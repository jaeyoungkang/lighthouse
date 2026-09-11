---
foundational: true
---

# Intent Traceability Aspect Enforcement

This is a foundational cross-cutting contract. It locks the process rules for the Intent Traceability aspect (`docs/principles.md` §8, `docs/intent-traceability.md`, `docs/conventions.md` §10) so that no UI spec can silently skip the Sufficiency Review gate.

No UI intent — backend only.

## Traceability

- Source promises: none directly
- Source aspects: none directly
- Nature: foundational cross-cutting aspect enforcement — guards the aspect's process rules against drift

## Scope ownership

이 문서는 특정 Promise Acceptance Check를 직접 cover하지 않는다. 모든 UI
Promise가 따라야 하는 Intent Traceability 절차를 설명한다. 실제 강제는 v2
원장의 `intent` 구조, Sufficiency Review parser, Story Chain validator가
소유한다.

- **Sufficiency Review 강제**: 원장과 같은 slug를 가진 `reviews/*.reviews.md`의 dated entry와 per-gap decision을 검사한다.
- **Promise 형식 강제**: 모든 UI Promise가 Promise + Intent Check + Acceptance Check 형식을 쓰는지 audit한다.
- **Promise → Evidence Ledger 전파**: `intent.mode`가 `explicit`, `absorbed`, `delegated` 중 하나이며 해당 mode의 구조 조건을 만족하는지 검사한다.

## Contracts

- each v2 ledger declares one `intent.mode`; `explicit` owns evidence, `absorbed` is valid only when Source Promises declare no formal Intent Checks, and `delegated` names an explicit owner for every formal Intent Check
- each Sufficiency Review stays in the sibling `reviews/<ledger-slug>.reviews.md` file and is resolved through the ledger slug
- every Sufficiency Review entry must record `Input:` (what data drove the review), `Evidence:` (screenshot path or DOM dump reference), and at least one `Adopt` / `Defer` / `Reject` decision for an observed gap
- every UI Promise must use the current Promise + Intent Check + Acceptance Check form
- every UI Promise that declares UI intent must resolve to explicit evidence directly or through a checked delegation
- evaluator verdict is `met | not-met | unknown`; `not-met` and `unknown` are both blocking
- the audit runs as a standalone vitest check and blocks CI if violated

## Intent Verification

> The Story Chain validator (`mc:validate-story-chain`) is the canonical
> alignment gate. Intent Sufficiency and Sufficiency Review structural checks
> use the Promise schema, strict Evidence Ledger v2 graph, and sibling review
> files.

