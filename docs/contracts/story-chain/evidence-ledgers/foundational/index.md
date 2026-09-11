---
foundational: true
---

# Light House Contract Index

This suite keeps only contracts that would break live user paths in the reduced Light House runtime.
It is organized by product boundary, search exploration, reaction lifecycle, runtime behavior, visible response shape, document handling, and the E2 gap-analysis flow.

This is the executable layer of the contract chain:
`docs/contracts/story-chain/promises/` and `aspects/` declare expectation, each
Evidence Ledger v2의 `acceptanceChecks[].executionRefs`는 Promise Acceptance
Check를 구조화 실행에 연결한다. 실행 가능한 원장은
`docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml`에 둔다. 이
`foundational/` 디렉터리의 Markdown은 설명과 탐색만 소유한다.

Fixed user-facing copy is part of that executable layer. The canonical fixed-copy
registry is `app/i18n/messages.ts` plus `app/i18n/messages/*`; ledgers may cite a
registry contract script before rendered DOM tests. That registry contract may
check both ownership and semantic policy, including tone consistency for
surfaces governed by `aspect:user-facing-language-governance`. Generated copy is
not part of that registry and must stay under structured generation prompt /
schema / fixture / live-judge evidence.

각 실행 원장은 YAML의 `sourcePromises`, `appliedAspects`, `scenarios`로 보호
범위를 선언한다. 이 디렉터리의 문서는 자신이 설명하는 foundational 경계를
명시한다.

## Intent Verification (aspect)

사용자-visible surface를 보호하는 실행 원장은 `intent.mode`와 그 mode에 맞는
evidence 또는 delegation을 선언한다. 이 구조는 Promise의 UI intent를 실행
검증으로 전달한다.

`explicit` intent evidence와 sibling Sufficiency Review는 다음을 확인한다.
- the US-level `Intent:` line it inherits,
- the semantic constituents (required fields, keywords, meta, relations, etc.) that must appear in the rendered output or response payload for the intent to count as met,
- the boundary-failure guards: assertions that the UI box does not truncate, clip, or hide any required constituent via `truncate`, `line-clamp-*`, `text-ellipsis`, `overflow-hidden` on the content element, `max-h-*`, `whitespace-nowrap`, fixed viewports, or off-container positioning — because per `principles.md` §8, a working feature that is visually cut off has **not** met its intent,
- the capacity adequacy claim: the minimum capacity (chars, lines, cards, area) needed to carry the intent constituents, the applied limit from the relevant policy, and an executable assertion that a realistic worst-case input fits the limit while retaining every constituent — a bare `length <= N` check does **not** satisfy this,
- a `Sufficiency Review` subsection that either carries the dated review log or links to a sibling `reviews/<ledger-slug>.reviews.md` file. The review log records each time the surface's declared Intent was judged against real rendered output — per `principles.md` §8 Intent Sufficiency. Each dated entry records: `Input:`, `Evidence:`, one or more `Gaps observed:` lines each classified as `Adopt-resolved` (with resolution link), `Adopt-open`, `Defer` (with reason + re-check trigger), or `Reject` (with reason), and a mandatory `Verdict:` line reading either `met` or `not-met`. `met` is only valid when every gap is `Adopt-resolved` or `Reject`; any remaining `Adopt-open` or `Defer` forces `not-met`. The audit blocks CI on `not-met` — an intent-unmet UI cannot merge. A surface without a dated review after its first real render is stale even if semantic/boundary/capacity checks pass,
- 해당 조건을 검증하는 `executionRefs`와 구조화 실행. 길이·존재·타입 확인만으로는 충분하지 않다.

A ledger without Intent evidence for a surface it covers is stale even when all structured executions pass. A ledger whose Intent evidence lacks boundary guards, capacity adequacy, or a current Sufficiency Review is also stale. Implementation workflow, templates, and examples live in `docs/intent-traceability.md`.

## Spec Map

- [Product Boundary](product-boundary.md)
- [Search Result Window](../search-result-window.ledger.yaml)
- [Search Reaction](../search-reaction.ledger.yaml)
- [Inline Analysis](../inline-analysis.ledger.yaml)
- [Search Query Route Transition](../search-query-route-transition.ledger.yaml)
- [Similar Papers](../similar-papers.ledger.yaml)
- [Search Gap Handoff](../search-gap-handoff.ledger.yaml)
- [Reaction Lifecycle](../reaction-lifecycle.ledger.yaml)
- [Runtime Contract](runtime-contract.md)
- [Retired Respond Contract](../respond-contract.ledger.yaml)
- [Moonlight Handoff](../moonlight-handoff.ledger.yaml)
- [Gap View Surface](../gap-report-surface.ledger.yaml)
- [Gap Network E2](../gap-network-e2.ledger.yaml)
- [Citation Lineage](../citation-lineage.ledger.yaml)
- [Research Route Content Width Governance](../document-content-width-governance.ledger.yaml)
- [Research Route and Shared Gap Access](../research-route-cap-feedback.ledger.yaml)
- [Alignment Audit](../alignment-audit.ledger.yaml)
- [Admin Access Control](../admin-access-control.ledger.yaml)
- [Story Chain Concepts](../../concepts.md)
- [Intent Traceability](intent-traceability.md)
- [Commitment Pages](../commitment-pages.ledger.yaml)
- [Common Page Footer](../common-page-footer.ledger.yaml)

