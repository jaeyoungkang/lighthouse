# knowledge-map-followup-surface — Sufficiency Reviews

This sidecar byte-preserves the dated history moved from the former operational
Markdown ledger. The current owner is
[knowledge-map-followup-surface.ledger.yaml](../knowledge-map-followup-surface.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-08-02 — aspect:knowledge-map-followup-surface YAML v2 migration re-verification

```yaml
date: 2026-08-02
acs:
  - acceptance-check:search-reaction-summarizes-terrain-host-gap-action
  - acceptance-check:gap-network-detection-from-search-entry-from-ai-comment
  - acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface
  - acceptance-check:graph-neighbor-papers-gap-surface
acReviewedRevision:
  - 4
  - 6
  - 1
  - 1
fixtureRef: app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/components/research-route-renderers/__tests__/search-view-states.test.tsx; app/components/research-route-renderers/__tests__/relationship-view-ai-comment-actions.test.tsx; app/api/gap-reports/__tests__/route.test.ts; app/api/route-ai-comments/generate/[id]/__tests__/route.test.ts
runCommitSha: 87ed95cc47a4
observedOutput: aspect:knowledge-map-followup-surface의 YAML v2 원장이 지정한 9개 test file, 74개 test가 모두 통과했다. Search, citation-lineage, graph-neighbor host는 각자 소유한 gap action을 표시하고, source view가 unmount된 뒤에도 shared detached-window handoff가 같은 target을 `/gap/:id`로 이동한다. Route AI comment는 title과 body만 소유하며 graph-neighbor snapshot도 gap report source로 수용된다.
gaps:
  - adopt: YAML v2의 AC별 executionRefs가 세 host의 gap entry와 source-lifetime-independent detached handoff를 실제 실행 증거에 연결한다.
  - reject: 브라우저 종료나 새로고침 뒤 detached target 복구는 이 Aspect의 source-surface lifetime 보장에 포함하지 않는다.
verdict: met
```

#### 2026-07-19 — aspect:knowledge-map-followup-surface keeps detached handoff beyond source lifetime

- Input: 세 host가 같은 공유 gap handoff를 사용하지만 기존 evidence는 응답이 도착할 때까지
  출발 화면이 남아 있는 경우만 검증했다. 사용자가 생성 중 다른 route로 이동하면 새 창 target과
  이미 시작된 생성이 source component 수명에 묶이는지 정본에서 판정하지 않았다.
- Evidence: 실제 검색 host에서 gap 요청을 지연시킨 뒤 source view를 unmount하고 예약 성공
  응답을 완료한다. `search-view-states.test.tsx`는 shared handoff가 같은 detached target을
  `/gap/:id`로 이동하고 target을 닫거나 source router를 교체하지 않음을 검증한다. 검색·인용
  관계·비슷한 논문 host는 이 shared handoff를 사용하며, 출발 pending state는 화면 표시만
  소유한다.
- Gaps observed:
  - Adopt-resolved — source route 이탈 뒤에도 이미 시작된 생성과 detached target handoff가
    계속되는 횡단 수명 규칙을 Aspect와 실제 host 회귀 evidence로 닫았다.
  - Reject — 브라우저 창 종료·새로고침·네트워크 실패 뒤 복구는 이 Aspect의 source-surface
    수명 보장이 아니다.
- Verdict: met

#### 2026-07-06 — aspect:knowledge-map-followup-surface current host-owned detached gap entry

- Input: Aspect Advice/Verification and the citation-lineage / graph-neighbor AC bodies all require the host-owned 연구 공백 entry to open the gap-network document in a new window, and the 2026-06-23 review claimed `relationship-view-ai-comment-actions.test.tsx` locked that new-window navigation. The test actually asserted `router.push`, and `CitationLineageView` / `GraphNeighborsView` called `router.push`, so both relationship ResearchRoutePayloads opened the gap map in the same tab — diverging from the search result-basis action (forced new window) and from the contract for several releases.
- Evidence: `CitationLineageView` and `GraphNeighborsView` now prepare a detached `/gap?opening=1` product-owned window target during user activation and route the gap action through the shared gap source creation helper. The helper reserves a pending gap report id, moves that target to `/gap/:id`, and lets that route own the single report-generation progress screen. `relationship-view-ai-comment-actions.test.tsx` now asserts both relationship surfaces pre-open the detached target, navigate that target after creation, and do not call `router.push`, locking detached new-window parity across all three host surfaces. The `gap_network_open` analytics event still fires before navigation in `openGapNetworkFromSearchSource`.
- Gaps observed:
  - Adopt-resolved — code and the locking test now enforce the detached new-window navigation the Aspect/AC bodies already required; the earlier review's new-window claim is now true rather than aspirational.
  - Reject — the gap entry does not fall back to same-tab on any surface; uniform detached behavior is the contract.
- Verdict: met

#### 2026-06-23 — Host-owned gap entry replaces AgentPanel-reinforced synthesis

> 정정(2026-06-25 엔트리 참조): 아래 Evidence의 "new-window gap-network navigation" 단언은 당시 사실이 아니었다 — `relationship-view-ai-comment-actions.test.tsx`는 same-tab `router.push`를 단언했고 citation/graph host도 same-tab으로 열었다. 2026-06-25 엔트리에서 코드·테스트를 detached 새 창으로 바로잡았다.

- Input: The 2026-06-08 design reinforced the citation-lineage / graph-neighbor gap entry by synthesizing a gap-only `guided_tree` surface inside the AI reaction (rendered by AgentPanel, persisted by sync). The unified inline AI comment treatment moved the gap entry to a host-owned `연구 공백 지도 만들기` action in the top comment frame, and AgentPanel started hiding the gap-only surface — but the Aspect Advice/Verification, this ledger, and the citation/graph AC bodies still described the AgentPanel-reinforced `연구 공백 찾기`, so the contract drifted from the shipped behavior for two releases.
- Evidence: `relationship-view-ai-comment-actions.test.tsx` locks the host-owned action and its new-window gap-network navigation for both relationship ResearchRoutePayloads; `AgentPanel.citation-lineage.test.tsx` asserts AgentPanel defers the gap action to the host; `ResearchRouteRuntime.bootstrap.test.tsx` asserts route bootstrap targets body-only relationship reactions without reintroducing an AI-owned follow-up surface.
- Gaps observed:
  - Adopt-resolved — Aspect Advice/Verification, AC bodies, and ledger coverage now describe the host-owned entry; the dead synthesis path is deleted so render and sync cannot diverge from the host action.
  - Watch — the defensive `shouldHideOwnedGapOnlySurface` hide stays as the safety net for historical persisted reactions that still carry a synthesized gap-only surface.
- Verdict: met

#### 2026-06-08 — `aspect:knowledge-map-followup-surface` deterministic gap follow-up surface

- Input: Search, citation-lineage, and graph-neighbor documents can all supply paper sets to `gap_network`, but the previous enforcement relied on prompt compliance or pre-existing surface payloads for citation-lineage and graph-neighbor AI reactions.
- Evidence: AgentPanel and sync tests now render/persist body-only citation-lineage and graph-neighbor reactions with `open_gap_network` actions when input exists. Route and domain-access tests cover graph-neighbor source restoration into the gap-network pipeline.
- Gaps observed:
  - Adopt-resolved — the common helper centralizes input detection and surface creation, so the same policy applies at render and sync time.
  - Adopt-resolved — graph-neighbor source ids no longer fail the server route or build path.
- Verdict: met

