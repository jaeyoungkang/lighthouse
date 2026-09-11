# Gap Network E2 — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [gap-network-e2.ledger.yaml](../gap-network-e2.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.


## Reviews

### Sufficiency Review

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-08-12 — 저장된 core 위의 명시적 enrichment 재시도

```yaml
date: 2026-08-12
acs:
  - acceptance-check:gap-report-prepared-reaction-explicit-enrichment-retry
acReviewedRevision:
  - 2
fixtureRef: app/server/domain-access/__tests__/gap-network-enrichment-retry.test.ts; app/server/domain-access/__tests__/gap-network-view-access.runner.test.ts; app/api/gap-reports/[id]/enrichment-retry/__tests__/route.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.retry-response.test.tsx; app/server/repository/__tests__/gap-reports.postgres.integration.ts; app/lib/__tests__/track.test.ts; app/lib/analytics/__tests__/event-router.gap-enrichment-retry.test.ts; docs/runtime-flows/gap-network-analysis.md
runCommitSha: a0d7293d2fca
observedOutput: Enrichment이 failed인 저장 report에서 인증된 명시적 command만 version CAS로 failed에서 pending을 얻는다. 승자는 기존 core graph와 artifact identity를 그대로 보존한 채 기존 runner의 enrichment 단계만 시작하고, concurrent loser는 pending을 관찰해 중복 작업을 만들지 않는다. 첫 retry는 즉시 허용되며 그 retry가 실패한 뒤에는 persisted retry count와 failed updatedAt으로 같은 report의 60초 cooldown을 계산한다. API Retry-After와 UI countdown은 같은 규칙을 쓰고, retry-pending 화면은 core graph를 계속 노출한다. 재방문과 상태 조회는 failed enrichment를 자동 재실행하지 않는다. 클릭 analytics에는 report id와 retry count만 남고 query, prompt, output은 기록하지 않으며, LLM usage ledger는 같은 report와 initial/retry attempt를 bounded metadata로 구분한다.
gaps:
  - adopt: 기존 shared artifact state, version CAS, runner, polling을 그대로 사용하고 enrichmentRetryCount만 report metadata에 추가한다.
  - adopt: 재시도 허용 범위는 report 단위이며 첫 retry 직후가 아니라 그 retry의 재실패 시점부터 60초다.
  - reject: 새 queue, cache, control plane, 자동 재방문 retry, per-user admission은 만들지 않는다. per-user 동시 build 제한은 issue #417이 소유한다.
verdict: met
```

#### 2026-07-14 — first-payload graph evidence only

```yaml
date: 2026-07-14
acs:
  - acceptance-check:gap-network-detection-from-search-cluster-gap-pipeline
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
acReviewedRevision:
  - 3
  - 9
fixtureRef: app/server/domain-access/__tests__/gap-network-view-access.runner.test.ts; app/server/services/__tests__/analyze-gap-network.graph-support.test.ts; app/server/services/__tests__/gap-network-builder.test.ts; docs/runtime-flows/gap-network-analysis.md
runCommitSha: 7f2ddb90bcb3
observedOutput: Gap runner evidence confirms that the reserved share-safe snapshot is the complete graph-evidence boundary. Reservation projects search graph metadata to build-effective selected paper scores under `gap_source_snapshot`; anchor count and candidate diagnostics do not persist or affect the version-2 content digest. Existing version-1 reports remain readable by id but are not reused by new reservations. A stored first-payload graph score can remain an auxiliary edge and representative-paper tie-breaker, while a snapshot without graph support enters deterministic core-build directly and degrades to citation/semantic evidence without starting PaperNeighborhood or a graph-support phase. The runner persists core-build/persist/enrichment durations, and historical graph-support phase values remain read-compatible only.
gaps:
  - adopt: source-input identity advances to v2 with the share-safe graph projection; v1 artifacts remain direct-read history rather than dual-lookup reuse candidates.
  - adopt: ordinary search owns graph retrieval before first reveal; gap generation consumes the frozen snapshot and never repairs missing graph evidence.
  - adopt: active gap attempts start at core-build, removing the misleading provider-stage marker after the provider call was retired.
  - adopt: missing graph support is an honest citation/semantic degrade, not a reason to mutate the source result or delay the report with a new provider call.
  - reject: carrying private library anchor corpus ids into the share-safe gap snapshot; search graph metadata exposes only anchor count and candidate evidence.
verdict: met
```

#### 2026-07-12 — shared artifact runner and viewer preference

```yaml
date: 2026-07-12
acs:
  - acceptance-check:gap-report-prepared-reaction-payload-sync-on-click
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
acReviewedRevision:
  - 3
  - 8
fixtureRef: app/api/gap-reports/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-network-view-access.runner.test.ts; app/server/domain-access/__tests__/gap-network-view-access.test.ts; app/server/repository/__tests__/gap-reports.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/lib/__tests__/track.test.ts; docs/runtime-flows/gap-network-analysis.md
runCommitSha: 31b0d177+worktree
observedOutput: Lifecycle review confirmed that persisted share-safe snapshot data alone feeds the runner, artifact id/version/attempt own build coordination, and status/direct routes remain observer-only for authenticated members. Prepared selections still update the active view immediately but persist only to the current viewer preference. The display-ready renderer emits product.gap_report.viewed once per viewer/report identity without writing an artifact-global marker or attributing the artifact's first source snapshot to a later viewer.
gaps:
  - adopt: source snapshot provenance remains metadata, while the versioned content digest owns reuse identity.
  - adopt: artifact sourceSnapshotId is creation provenance, not the current viewer's entry origin, so the viewed event omits it until an entry-scoped origin exists.
  - adopt: the public enrichment endpoints are retired so authenticated readers cannot mutate shared build state.
  - adopt: LSP diagnostics, targeted tests, full ledgers, contract quality, lint, typecheck, and duplicate checks are green.
  - reject: live viewer cache hydration would make shared artifact content depend on whichever member won the build lease.
verdict: met
```

#### 2026-07-06 — gap graph nodes stay on research terms

```yaml
date: 2026-07-06
acs:
  - acceptance-check:gap-network-detection-from-search-research-term-nodes
acReviewedRevision:
  - 1
fixtureRef: app/server/services/__tests__/analyze-gap-network.test.ts; app/server/services/__tests__/knowledge-map-cluster.test.ts
runCommitSha: a196cb9cffed+worktree
observedOutput: analyze-gap-network.test.ts는 ai-for-science 입력에서 concept node가 hypothesis generation, agentic literature search, closed loop experiments, laboratory automation 같은 구체 연구 용어로 남고 artificial intelligence, agents, large language models, science, scientific discovery, verification 같은 broad/query-equivalent label로 채워지지 않음을 잠근다. knowledge-map-cluster.test.ts는 cluster label도 scientific discovery, benchmarks, automation 같은 넓은 라벨보다 hypothesis generation, LLM agents, research automation, verification benchmark 같은 구체 연구 지형 용어를 우선함을 잠근다.
gaps:
  - adopt: gap graph의 node/cluster label 품질 기준을 검색 연구용어 제안과 같은 방향으로 끌어와, 연구자가 연구 지형을 읽을 때 일반 분야어 대신 방법·기여·연구 작업 단위로 스캔하게 한다.
  - reject: LLM 기반 용어 추출 결과와 gap graph node 목록을 byte-for-byte 동일하게 맞추지는 않는다. gap graph는 deterministic core 경로이므로 같은 broad/query-equivalent exclusion과 구체 명사구 우선순위를 공유하는 것으로 닫는다.
verdict: met
```

#### 2026-07-10 — prepared reaction artifact write ordering (historical; superseded above)

```yaml
date: 2026-07-10
acs:
  - acceptance-check:gap-report-prepared-reaction-payload-sync-on-click
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
acReviewedRevision:
  - 2
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.test.tsx; app/api/gap-reports/[id]/reaction/__tests__/route.test.ts
runCommitSha: e531e3f5+worktree
observedOutput: Overview, cluster, and gap selections remain immediately visible in the active client execution without changing the display-ready vertical graph/report composition or settled edge fallback. Their artifact PUTs now run in selection order. The reaction route rereads the owner-scoped gap artifact, merges persisted and supplied history, and commits against the current artifact version; a conflict rereads and rebases before retrying, then returns 409 if four attempts cannot commit.
gaps:
  - adopt: Client sequence checks protect projection order, while artifact version CAS protects durable commit order.
  - adopt: reactionVersion remains a compatibility field; artifact version owns the monotonic write condition.
  - reject: Last-write-wins PUT without reread cannot preserve durable reaction history under overlapping selections.
verdict: met
```

#### 2026-07-08 — gap independent runner + observer-only status/page

```yaml
date: 2026-07-08
acs:
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
acReviewedRevision:
  - 7
  - 3
fixtureRef: app/server/services/__tests__/gap-network-builder.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/api/gap-reports/__tests__/route.test.ts; app/api/gap-reports/enrich/__tests__/route.test.ts; app/api/gap-reports/enrich/failure/__tests__/route.test.ts; app/server/repository/__tests__/gap-reports.test.ts; app/server/domain-access/__tests__/gap-network-view-access.test.ts; app/server/domain-access/__tests__/gap-network-view-access.runner.test.ts; app/server/domain-access/__tests__/gap-network-view-access.analytics.test.ts; app/server/domain-access/__tests__/search-backed-knowledge-map-persistence.test.ts; app/components/research-route-renderers/__tests__/gap-network-view.helpers.test.ts; app/(research)/__tests__/gap-view-route-stale-core.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; docs/runtime-flows/gap-network-analysis.md
runCommitSha: feade21fad37+worktree
observedOutput: Targeted gap-network ledger vitest run passed 86 tests across 14 files covering route/status, domain-access, direct /gap page, GapNetworkView enrichment polling, source-paper ids, schema, repository, persistence, and gap-network helper readiness. route.test.ts now locks that POST schedules and anchors the independent runner Promise with `after()` after reserving a pending gap report, queues failed-core retry rows as durable pending before scheduling the runner, observes reserved pending reports without starting core/enrichment, reports failed build markers as terminal `failed`, treats core-ready enrichment-failed reports as completed degraded reports, and completes only after a runner-persisted ready document. gap-network-view-access.test.ts locks cached inline-analysis hydration, graph-support preparation, stored-core enrichment reuse without rebuilding the core, real runner phase/lease/duration persistence through core+enrichment, active-lease duplicate-runner exit, failed-core retry queuing and acquisition, stale complete no-gap rebuild acquisition, stale failed-attempt protection, core-build failure terminal marking, and stale/direct enrichment guard behavior. search-backed-knowledge-map-persistence.test.ts locks that runner-owned success persist does not retry over a row now owned by another attempt. GapNetworkView.enrichment.test.ts locks status polling for runner-persisted enrichment, no client POST to /api/gap-reports/enrich, and no polling restart after a terminal failed marker. gap-view-route-stale-core.test.ts locks /gap/:id as observer-only for stale core evidence.
gaps:
  - adopt: gap build execution now belongs to the POST-started independent runner. Status polling and direct /gap pages are read-only observers and must not start provider, LLM, graph-support, or deterministic core work.
  - adopt: active build ownership is represented by the report metadata lease; non-owning runner attempts exit, and core/build failures close the same report with `core: "failed"`, `enrichment: "failed"`, and `phase: "failed"` so observer-only status does not poll forever.
  - adopt: enrichment reuses the stored core payload; missing cached inline analysis cannot block deterministic core, and LLM inline analysis is an upgrade/enrichment input only.
  - reject: adding a new queue table is out of scope for this close-out. Durable job state is represented on the existing gap_reports artifact metadata via phase, attempt, lease, phaseDurationsMs, and terminal failed markers.
verdict: met
```

#### 2026-07-08 — gap progress staged pacing (no initial-stage flash)

```yaml
date: 2026-07-08
acs:
  - acceptance-check:gap-network-detection-from-search-progress-staged-pacing
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/gap-network-view.helpers.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.progress-pacing.test.tsx; app/components/research-route-renderers/GapNetworkView.tsx; app/components/research-route-renderers/gap-network-view.helpers.ts; app/components/research-route-renderers/gap-network-report-status-polling.ts; docs/runtime-flows/gap-network-analysis.md
runCommitSha: d6e7053da665+worktree
observedOutput: Targeted vitest run passed 14 tests across the progress-pacing component fixture and the gap-network view helpers fixture. gap-network-view.helpers.test.ts locks that the visible progress stage advances one step per `GAP_NETWORK_PROGRESS_STAGE_DWELL_MS` (collect→enrich→cluster→analyze→interpret) and holds on interpret however long enrichment takes, and that the reveal floor spans at least two stages. GapNetworkView.progress-pacing.test.tsx (4 cases) mounts a reserved core-pending report, applies a settled terminal empty-state report via re-render (as patchCurrentView does), and asserts the graph report stays hidden below the shorter `GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS` empty-state floor, then reveals past it while still below the meaningful-gap `GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS` floor; a second case mounts an already-display-ready report and confirms it reveals immediately with no minimum-visible hold; a third mounts an enrichment-pending core-settled report and asserts the clock seeds at the interpretation stage (83%) instead of replaying collect (17%); a fourth mounts a terminal-failed report, advances past the full animation window, and asserts the bar stays frozen at the first stage (17%) rather than animating toward interpret. Removing the old split loading screens: the pinned interpret enrichment screen and the elapsedMs-server-driven core-pending screen are unified into one client-timer-driven progress surface, and the status polling hook no longer owns the progress label.
gaps:
  - adopt: the visible progress pacing is client-owned min-dwell animation, not the raw build phase. The observable phase stream is coarse (inline-analysis → ~1-2s in-memory core → persist/enrichment → complete) and the deterministic core settles faster than a readable stage, so binding each stage to the phase would reintroduce the flash. Phase governs only the terminal region (enrichment holds interpret, failed surfaces the error, reveal gating).
  - adopt: a freshly built report is held on the animated screen until a minimum visible time so fast and terminal-empty-state builds show staged progress instead of flashing the first stage and jumping to completed. Reopening an already-ready report is never delayed.
  - adopt: a terminal empty-state (insufficient edges / no meaningful gap) reveals a short "not enough evidence" message rather than a graph, so it uses a shorter minimum-visible floor (`GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS`) than a meaningful-gap report while still showing brief staged progress.
  - reject: persisting finer intermediate build phases (graph-support, core-build, persist) to the gap_reports row to feed the progress bar is out of scope — it would add DB writes on the runner hot path for cosmetic resolution that the min-dwell animation already provides, and those phases still stream by faster than a readable stage.
verdict: met
```

#### 2026-07-02 — cluster paper count node and hull scale

```yaml
date: 2026-07-02
acs:
  - acceptance-check:gap-network-detection-from-search-cluster-size-encoding
acReviewedRevision:
  - 2
fixtureRef: app/server/services/__tests__/analyze-gap-network.test.ts; app/components/research-route-renderers/knowledge-map/__tests__/gap-network.presentation.test.ts
runCommitSha: 1045a758e063+worktree
observedOutput: analyze-gap-network.test.ts는 4편 cluster가 표시 concept node를 4개로 제한하고 20편 cluster가 더 많은 node를 갖는 것을 잠근다. gap-network.presentation.test.ts는 이 sparse-node 차이와 paperCount hull scale이 합쳐져 sparse cluster footprint가 더 작게 계산됨을 잠근다.
gaps:
  - adopt: base graph의 cluster node count와 hull footprint가 입력 표본 안에서 더 많은 논문을 품은 묶음을 더 크게 표시하도록 잠근다.
  - reject: concept node radius를 논문 수에 연동하지 않는다. node radius는 기존처럼 concept score를 표현하고, 논문 수 인코딩은 node 개수와 cluster hull에 둔다.
verdict: met
```

#### 2026-06-01 — gap 입력이 현재 정렬 pool 상위 40편을 사용

```yaml
date: 2026-06-01
acs:
  - acceptance-check:gap-network-detection-from-search-analysis-input-cap
acReviewedRevision:
  - 1
fixtureRef: app/components/research-route-renderers/__tests__/search-view-knowledge-map.test.ts; app/lib/__tests__/graph-paper-snapshots.test.ts
runCommitSha: 8aa45b61822a
observedOutput: graph-paper-snapshots.test.ts는 MAX_GRAPH_SOURCE_PAPERS 40과 supplied result order의 앞 40편 cap을 잠근다. search-view-knowledge-map.test.ts는 gap-network metadata가 현재 sort/year filter가 적용된 result pool에서 만들어짐을 잠근다. 따라서 interest 정렬 상태에서는 library-near 보강 후보가 포함된 정렬 pool 상위 40편이, relevance 상태에서는 보강 후보가 제외된 provider keyword pool 상위 40편이 gap 분석 입력으로 들어간다.
gaps:
  - adopt: "relevance order"라는 과거 표현은 현재 정렬 pool 기준으로 supersede한다. 사용자가 관련순으로 바꾼 경우에만 provider relevance 상위 40편이 된다.
verdict: met
```

#### 2026-07-01 — gap pending progress와 transient blank report 경계

```yaml
date: 2026-07-01
acs:
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
  - acceptance-check:gap-network-detection-from-search-cluster-gap-pipeline
  - acceptance-check:gap-network-detection-from-search-cluster-detail-zoom-render
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
acReviewedRevision:
  - 2
  - 2
  - 2
  - 2
  - 2
fixtureRef: app/api/gap-reports/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-network-view-access.enrichment.test.ts; app/server/domain-access/__tests__/gap-network-view-access.enrichment.test.ts; app/components/research/__tests__/ResearchBackgroundTasks.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/gap-network-view.helpers.test.ts; app/components/research-route-renderers/knowledge-map/__tests__/GapNetworkReport.insufficient-edge.test.tsx
runCommitSha: ce536fad+worktree
observedOutput: gap-network-view-access.enrichment.test.ts는 domain access가 입력 snapshot/metrics가 비어 있는 blank gap document를 기존 완료 문서로 반환하지 않고 core payload를 다시 작성함을 잠근다. route.test.ts는 snapshot POST가 source route payload row 없이 report를 만들고, status route가 같은 blank document를 completed로 선언하지 않고 pending view로 돌려보냄을 잠근다. GapNetworkView.test.tsx는 unresolved blank report가 `GapNetworkReport`나 "연결 근거 부족" copy 대신 "공백 관계 계산 중" 상태를 렌더하고 viewed analytics를 emit하지 않음을 잠그며, pending progress가 "리포트 저장 중"을 쓰고 "가설 생성 중" / "연구 가설을 정리"를 쓰지 않음을 잠근다. gap-network-view.helpers.test.ts는 settled core 판정과 completed progress copy를 고정한다. GapNetworkReport.insufficient-edge.test.tsx는 정착된 edge-insufficient report가 여전히 전체 논문 수, 초록 보유 논문 수, 관계 근거 0건을 terminal insufficient state로 설명함을 유지한다.
gaps:
  - adopt: "연결 근거 부족"은 core report가 정착된 뒤의 terminal 부족 상태로 제한한다. transient blank report는 사용자에게 실패/근거부족으로 오해되지 않도록 pending/core-calculation 상태로 유지한다.
  - adopt: pending progress는 deterministic core 작업까지만 말한다. route completion 뒤 같은 문서에서 진행되는 LLM narrative enrichment는 별도 보강 상태로 노출한다.
  - reject: durable server queue나 새 생성 phase API를 이 변경에 포함하지 않는다. 현재 결함은 route/status/background runner와 문서 화면의 완료 판정 싱크 문제로 닫는다.
verdict: met
```

#### 2026-07-01 — gap loading 대기 범위 LLM enrichment까지 확장

```yaml
date: 2026-07-01
acs:
  - acceptance-check:gap-network-detection-from-search-result-saved-gap-view
  - acceptance-check:gap-report-prepared-reaction-payload-sync-on-click
  - acceptance-check:gap-report-prepared-reaction-metadata-content-narrative
  - acceptance-check:gap-report-prepared-reaction-vertical-stack-edge-fallback
acReviewedRevision:
  - 5
  - 2
  - 3
  - 3
fixtureRef: app/api/gap-reports/__tests__/route.test.ts; app/server/domain-access/__tests__/gap-network-view-access.enrichment.test.ts; app/components/research-route-renderers/__tests__/gap-network-view.helpers.test.ts; app/components/research-route-renderers/__tests__/GapNetworkView.test.tsx; app/components/research-route-renderers/__tests__/GapNetworkView.enrichment.test.tsx; app/components/research/__tests__/ResearchBackgroundTasks.progress.test.tsx; app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts
runCommitSha: fcdfaab75af4+worktree
observedOutput: route.test.ts는 POST가 snapshot 기반 report id를 즉시 반환하고, status route가 관계 근거와 gapPairs가 있는 core-ready/enrichment-pending report를 enrichment로 닫은 뒤 completed를 반환하되 polling read에서 viewed analytics를 반복 발화하지 않음을 잠근다. gap-network-view.helpers.test.ts는 display-ready 판정이 core 정착만이 아니라 terminal empty-state 또는 enrichment terminal marker를 요구함을 잠근다. GapNetworkView.test.tsx는 narrative enrichment pending 문서가 viewed analytics를 만들지 않음을 잠근다. GapNetworkView.enrichment.test.tsx는 core-ready 문서에 아직 enrichment prose가 없으면 graph/report UI 대신 loading 화면을 유지하고 enrichment fallback 요청을 화면 뒤에서만 진행함을 잠근다. research-route-runtime.bootstrap-events.test.ts는 gap_network 문서가 agent panel slot의 route AI comment generation command를 만들지 않음을 잠근다.
gaps:
  - adopt: normal gap 생성의 사용자 대기 범위는 deterministic core가 아니라 display-ready다. display-ready는 core settled + terminal empty-state 또는 enrichment ready/failed marker로 정의한다.
  - adopt: LLM enrichment는 status route가 먼저 닫고, direct persisted 문서 진입에서만 `GapNetworkView` effect가 fallback으로 닫는다. loading copy는 LLM 해석 결과를 같은 문서에 반영하는 단계를 포함한다.
  - reject: terminal empty-state를 enrichment 대기 상태로 되돌리지 않는다. 관계 근거 0건 또는 no-meaningful-gap은 여전히 core terminal result다.
verdict: met
```
