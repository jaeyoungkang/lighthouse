# Search Ephemeral Execution — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [search-ephemeral-execution.ledger.yaml](../search-ephemeral-execution.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

### Retired Acceptance Check history

`acceptance-check:reaction-from-visible-snapshot-artifact-persists`는 2026-07-12에
`historical:acceptance-check:reaction-from-visible-snapshot-artifact-persists`로
철회했다. 아래 index는 mixed review에서 분리한 날짜와 revision을 보존한다. 기존
observedOutput과 gaps는 해당 dated review에 그대로 남긴다. 현재 계약 판정에는
viewer-preference review와 실행 가능한 ledger를 사용한다.

- 2026-07-04 `ledger 신설: query-canonical 실행 모델 선언` — revision 1
- 2026-07-05 `promise:reaction-from-visible-snapshot verdict close` — revision 1
- 2026-07-05 `Search-first reset close-out 최종 재실행` — revision 1

#### 2026-07-14 — canonical search state boundary regression evidence

```yaml
date: 2026-07-14
acs:
  - acceptance-check:search-url-restores-search-url-carries-state
  - acceptance-check:search-url-restores-search-executes-in-place
  - acceptance-check:search-query-route-transition-url-owned
acReviewedRevision:
  - 1
  - 1
  - 2
fixtureRef: scripts/architecture-fitness/check-search-state-boundaries.mjs; scripts/architecture-fitness/__tests__/search-state-boundaries.test.ts; app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/ephemeral-view-id.test.ts; scripts/architecture-fitness/collect-search-state-boundary.mjs; docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.md
runCommitSha: 3a99a40407a6+worktree
observedOutput: The materialized-revision TypeScript and JavaScript symbol/AST guard verified that query, sort, year, and facet conditions are read from `/search?...` into one server execution input, direct URL entry executes and renders on that route without a reserved result id, explicit navigation owns URL changes, and the client store does not synchronize runtime state back into the URL. The same normalized URL conditions preserve canonical execution identity while a changed sort, year, or facet condition changes it. The guard accepted one URL-to-server-execution authority path, standard Array and Set dependencies, deterministic facet normalization, one literal-prefix node:crypto SHA-256 canonical-condition ephemeral view identity owner, and the active route currentView lifecycle. It rejected aliases to parallel identity owners in TypeScript or JavaScript, production acquisition of inventory-excluded `__tests__` or `.test` modules, non-static module acquisition and CommonJS loader capability escape across all three inventory facts, direct and helper-hidden runtime normalization, reassigned or shadowed normalizer dependencies, runtime authority in the facet or prefix owner, a substituted hash provider, computed or destructured store writers, setState capability escape, dynamic or symbol-aliased reflective action access, and Object.assign writes carried by inline, identifier, or spread patches. The collector-owned hostile-environment identity fixture binds the expected SHA-256 output independently of target tests, while the production execution test exercises snapshot invariance, condition change, and the previous 32-bit collision pair. The covering ledger run passed 14 files and 113 tests.
gaps:
  - adopt: Canonical search view identity now uses a SHA-256 digest of the normalized execution condition and has both collector-owned expected-output evidence and production execution metamorphic evidence.
  - adopt: State-boundary completeness resolves production call and writer symbols and rejects direct state writes instead of treating required source snippets or method names as complete coverage.
  - adopt: Exact-revision symbol evidence binds the compiler current directory to the materialized tree and rejects protected store capability escape, not only direct method syntax.
  - adopt: Imported facet normalization and the identity prefix are explicit exact-revision owners; reflection and Object.assign cannot create a parallel currentView writer.
  - reject: This review does not evaluate Q4 technical grain or Q5 instance-movement resilience; both are unstarted follow-up scopes outside these Acceptance Checks.
verdict: met
```

#### 2026-07-12 — condition URL owns meaning, not result identity

```yaml
date: 2026-07-12
acs:
  - acceptance-check:search-url-restores-search-current-conditions-preserved
acReviewedRevision:
  - 1
fixtureRef: app/components/research/__tests__/ResearchBackgroundTasks.hydration.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.condition-ownership.test.ts; docs/contracts/story-chain/promises/search-url-restores-search.md; docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.md
runCommitSha: 8b364d422235+worktree
observedOutput: Search enrichment may attach hydrated details or a compatibility supplement pool, while the base/current/incoming merge preserves the current sort, year, and facet conditions. A response whose query differs from the execution URL query, a completion after the current query changes, and a response from a prior active execution are all rejected even when view and paper identities are reused.
gaps:
  - adopt: The condition URL and the user's current refinements own search meaning across re-entry and background completion.
  - adopt: Query mismatch and active-execution replacement are negative-tested independently so removing either stale-completion guard breaks deterministic evidence.
  - reject: The same URL does not promise the same paper identities, ordering, or content across executions because each entry runs against current provider data.
verdict: met
```

#### 2026-07-06 — aspect:search-first-url-model multi-ledger coverage repair (#210/#212)

```yaml
date: 2026-07-06
acs:
  - acceptance-check:search-url-restores-search-url-carries-state
  - acceptance-check:search-url-restores-search-executes-in-place
  - acceptance-check:search-url-restores-search-share-reload
  - acceptance-check:search-query-route-transition-url-owned
  - acceptance-check:similar-papers-discovery-fallback-query-opens-route
  - acceptance-check:similar-papers-discovery-same-basis-reuse
  - acceptance-check:similar-papers-discovery-seed-paper-in-reaction-context
  - acceptance-check:graph-neighbor-papers-search-first-seed
  - acceptance-check:graph-neighbor-papers-immediate-navigation
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
  - acceptance-check:gap-overlay-decision-evidence-gap-card-bounds
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 4
  - 3
  - 1
  - 1
  - 1
  - 5
  - 3
  - 3
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.md; docs/contracts/story-chain/evidence-ledgers/similar-papers.ledger.md; docs/contracts/story-chain/evidence-ledgers/graph-neighbor-papers.ledger.md; docs/contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.md
runCommitSha: 0d460022b035+worktree
observedOutput: aspect:search-first-url-model now records its multi-ledger coverage path explicitly. The search-ephemeral ledger names executable evidence for query/sort/year/facet state carried by `/search?q=...`, refine controls updating that URL, direct `/search?q=` entry starting provider execution without reserve/pending ids, share/reload/re-entry re-running the same URL conditions, and route command submit navigating immediately before fetch. It also cites the URL-owned state guard and store tests showing the client store owns one currentView plus view-id keyed reaction/overlay/visible-window maps, with no store-to-URL push/replace sync path. The similar-papers ledger now lists the Aspect and names the legacy/non-corpus fallback evidence: title-first-5-words plus top inline topics build the fallback query, activation opens `/search?q=` immediately, the fallback/slim seed identity is carried only as transient URL parameters on that query route rather than as a durable route id, legacy selected library ids are not carried in the entry or failure fallback URL, `personalize:false` can be preserved, same-seed reuse still enters through the query URL, seed metadata is retained, the seed paper is excluded, and focused reaction context includes the seed title/paper id line. The graph-neighbor ledger covers corpus seed route behavior: search/card activation immediately opens `/similar?seedPaperId=...`, detached clicks open that same seed URL without mutating the current route, the destination route owns provider execution and lightweight graph_neighbors rendering, source route payload ids are not carried, same-seed persisted graph_neighbors resources are not redirect targets, the destination id remains client-only/ephemeral, route bootstrap is the single source for the destination reaction target, card detail hydration follows first paint through the background hydration path, and destination provider failure stays on the same seed URL with the unified degraded notice and retry action. The saved `/gap/:id` side is covered by the gap E2 source ledgers as the model's id-addressed artifact exception. POST/status operate on a pending `gap_reports` artifact for the visible snapshot; core-ready reports record `metadata.gapNetworkBuild { core: "ready", enrichment: "pending" }`; relationship or meaningful-gap pending core remains on progress/loading until enrichment closes as ready or failed; terminal empty-state closes without enrichment; and only display-ready reports render the vertical stack. The prepared reaction evidence names `domainLabel`, `contentNarrative` overview/cluster/gap fields, title generation from the E2 lens, totalEdgeCount==0 insufficient-edge handling, failed/missing enrichment prose handling, and cluster/gap prepared payload sync. GapContent is the React-owned rendered report body: it renders the concrete `## 분석된 분야`, `## 클러스터 배경과 차이`, and `## 공백 추론 방법` sections instead of treating those narrative fields as an opaque markdown blob. The overlay evidence names the gap card side-panel outside the SVG, qualitative `meta`, 1-3 `proposals` with grounding, fallback facts, active gap node/link, and focused viewBox behavior. Thus gap artifacts stay under `/gap/:id` with their own readiness rules rather than becoming ephemeral condition URLs. The covering ledger also runs the research-routes test that its AC rows cite.
gaps:
  - adopt: Similar fallback and saved gap artifact coverage stay in their owning ledgers, but the Aspect review now names those ledgers as first-class coverage instead of relying on prose delegation.
  - reject: This review does not make gap_network ephemeral. `/gap/:id` remains the saved artifact exception required by the Search-first URL model.
verdict: met
```

#### 2026-07-05 — aspect:first-paint-persistence-independence / aspect:search-first-url-model / aspect:immediate-navigation Search-first 실행 증거 확정

```yaml
date: 2026-07-05
acs:
  - acceptance-check:search-url-restores-search-url-carries-state
  - acceptance-check:search-url-restores-search-executes-in-place
  - acceptance-check:search-url-restores-search-share-reload
  - acceptance-check:search-failure-degraded-at-url-degraded-surface
  - acceptance-check:search-failure-degraded-at-url-retry-reruns
  - acceptance-check:search-query-route-transition-immediate-submit
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.md
runCommitSha: e0fc414dd032
observedOutput: Search route execution now runs from URL conditions without pre-created navigation ids. The run covers query, sort, year, and facet state parsed from `/search?q=...`; refine operations changing the URL; direct `/search?q=` entry starting provider execution and rendering results in place; share/reload/re-entry interpreting the same URL as the same search conditions; command submit navigating to `/search?q=` before fetch; provider failure staying as an explicit degraded surface at the same URL; retry re-running the same URL conditions; and URL sync not promoting ephemeral ResearchRoutePayloads to id routes. The result-basis evidence treats loaded window as current-execution display state: after a share/reload/re-entry, the same URL conditions execute again and the visible result basis/loaded-window copy describes that current run, while hidden server state does not own the search conditions. The same run also exercises citation-lineage, graph-neighbor, and legacy similar fallback route paths as Aspect-level regression evidence, while their Promise AC ownership stays in their dedicated ledgers. The #205 false-pass audit is recorded in the ledger: first-paint routes avoid repository imports, remaining client route payload state is preserved only for per-route AI comment/overlay/visible-window keying, search submit analytics no longer identify by documentId, URL-less route-group names are not user-facing route contracts, and broader DB/docs cleanup is linked to #206/#208.
gaps:
  - adopt: The covering ledger now runs route-page, service, degraded-state, follow-up handler, command-bar, URL-sync, route-condition, analytics submit-identity, and first-paint repository guard checks for the Search-first execution path.
  - adopt: Similar fallback and graph-neighbor seed AC coverage moved back to their owning ledgers, avoiding duplicate AC declarations while preserving Aspect-level regression execution in this ledger run block.
  - reject: This review does not claim gap_network is ephemeral; saved gap reports remain id-addressed artifacts under their own ledgers.
verdict: met
```

#### 2026-07-05 — Search-first reset close-out 최종 재실행 (#205)

```yaml
date: 2026-07-05
acs:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
  - acceptance-check:reaction-from-visible-snapshot-ephemeral-lifetime
  - acceptance-check:search-url-restores-search-url-carries-state
  - acceptance-check:search-url-restores-search-executes-in-place
  - acceptance-check:search-url-restores-search-share-reload
  - acceptance-check:search-failure-degraded-at-url-degraded-surface
  - acceptance-check:search-failure-degraded-at-url-retry-reruns
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-ephemeral-execution.ledger.md
runCommitSha: b6de7d7e7521
observedOutput: Close-out re-run after the full reset landed (S1~S6, role-separated review fixes included). npm run evidence-ledger -- --ledger snapshot-reaction (2 files / 13 tests green) and -- --ledger search-ephemeral-execution (10 files / 62 tests green) executed at b6de7d7e7521, alongside quality:fast and quality:contract green. The snapshot-reaction run covers bounded request viewSnapshot prompt input, source/paging/limit preservation in prompt context, ephemeral search/citation/similar reactions that do not call the persistence PATCH, and artifact-owned gap report reactions that restore with `/gap/:id`. The lifecycle reviewer's blocking finding on same-URL re-execution reaction replay is fixed and locked by the new execution-lifecycle test, so the ephemeral-lifetime AC now holds under re-entry as well. The search-ephemeral run covers `/search?q=...` carrying query/sort/year/facet state, refine actions updating the URL, in-place provider execution without reserve ids, share/reload re-execution, degraded same-URL failure copy, and retry re-running the same conditions.
gaps:
  - adopt: Earlier same-day stamps in this file were made pre-commit; this entry is the authoritative close-out run at the landed sha.
  - reject: Load-smoke re-measurement stays a cohort go/no-go operational step (docs/operational-readiness.md §1) and is not claimed here.
verdict: met
```

#### 2026-07-07 — promise:reaction-from-visible-snapshot trust disclosure revision (#222)

```yaml
date: 2026-07-07
acs:
  - acceptance-check:reaction-from-visible-snapshot-snapshot-input
acReviewedRevision:
  - 2
fixtureRef: docs/contracts/story-chain/evidence-ledgers/snapshot-reaction.ledger.md
runCommitSha: 6fa46b02+worktree
observedOutput: npm run evidence-ledger -- --ledger snapshot-reaction executed both run:shell blocks after the #222 trust-disclosure revision on the worktree based on 6fa46b02: the snapshot prompt/request block passed 12 files / 65 tests and the artifact reaction block passed 2 files / 14 tests. The added app/domain/__tests__/view-snapshot.test.ts assertions verify that buildViewSnapshotPromptContext renders source limits plus referenceAvailability/citationAvailability fields, preserving returned=0, total=0, empty reason values, provider-unavailable reference reasons, coCitedAvailability returned/total/reason, coupledAvailability: unknown, and co_cited relation text without rewriting graph neighbors as reference/citation lineage. app/server/agent/__tests__/route-ai-comment-generation.test.ts verifies automatic search/citation_lineage/graph_neighbors prompts include trust_scope_rule, trust_absence_rule, and trust_evidence_type_rule, while app/server/agent/__tests__/reaction-system-prompt.test.ts verifies the shared respond trustBoundary carries promise:reaction-from-visible-snapshot and acceptance-check:reaction-from-visible-snapshot-snapshot-input refs. npm run mc:validate-story-chain stayed green after applying aspect:visible-explanation-sufficiency to the snapshot reaction input boundary.
gaps:
  - adopt: Snapshot prompt context now preserves source limits plus citation/graph availability, and both automatic route-view generation and user respond prompts carry trust-boundary clauses against global field/corpus claims, false absence claims, and graph-neighbor/direct-citation conflation.
  - reject: This review does not claim live LLM prose quality for every future generated output; it locks the prompt/input contract that constrains the model and leaves semantic terrain quality to the existing live judges.
verdict: met
```
