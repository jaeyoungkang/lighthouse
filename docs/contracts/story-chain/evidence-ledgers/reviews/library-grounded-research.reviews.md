
# Library-grounded Research — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [library-grounded-research.ledger.yaml](../library-grounded-research.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

#### 2026-08-21 — legacy basis 입력과 현재 snapshot writer 분리

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-unified-result-projection
acReviewedRevision:
  - 20
  - 2
fixtureRef: app/server/services/__tests__/search-execution.test.ts; app/lib/__tests__/api-routes.test.ts; app/domain/research-route-payload.ts; app/domain/search-followup-criteria.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 0a24696b4263+worktree
observedOutput: personalize=false와 sort=relevance|interest legacy 입력은 현재 결과 identity와 projection을 바꾸지 않는다. 현재 검색의 pending hydration snapshot은 personalize preference를 기록하지 않고, optional field와 reader만 과거 저장 snapshot 읽기 호환으로 남는다. 새 URL writer는 personalize와 두 basis sort 값을 모두 생략한다.
gaps:
  - adopt: 과거 입력과 snapshot은 읽을 수 있지만 현재 state writer의 authority가 되지 않는다.
  - reject: 현재 검색 hydration metadata에 항상 true인 retired preference를 계속 기록하지 않는다.
verdict: met
```

#### 2026-08-21 — `aspect:library-grounded-research` 자연어 근접 표식

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-library-proximity-marker
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
acReviewedRevision:
  - 1
  - 5
  - 5
fixtureRef: app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; app/components/research-route-renderers/search-view.helpers.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 07b49a1ff4d0+worktree
observedOutput: DOI 정확 일치가 아닌 결과에서 양수의 query-aware library interestWeight가 있는 모든 카드는 keyword 결과 포함 여부와 무관하게 `내 연구와 가까움` 표식 하나를 표시한다. Keyword-only, 0 이하 근접도, 근접도 값이 없는 결과에는 표식이 없다. `libraryOnlyPaperIds`는 결과 출처 호환 정보로 남지만 표식 의미를 결정하지 않으며, 정렬용 combinedRankWeights와 표시용 interestWeights의 기존 소유권도 유지된다. aspect:library-grounded-research verdict는 met이다.
gaps:
  - adopt: 출처 조합을 해석해야 하는 `관련성 높은 후보` 대신 사용자가 바로 이해할 수 있는 연구 근접 의미를 표시한다.
  - reject: `키워드 일치`, graph-only 같은 출처 분류를 카드 표식으로 다시 노출하지 않는다.
  - reject: 근접 표식을 관련성 확정, 필터, 액션으로 확장하지 않는다.
verdict: met
```

#### 2026-08-21 — 단일 결과 projection과 중첩 근거 marker

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-library-interest-default
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-balanced-basis-order
  - acceptance-check:search-results-fast-window-library-first-response
  - acceptance-check:search-results-fast-window-library-grounding-unavailable
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-unified-result-projection
  - acceptance-check:search-results-fast-window-library-source-sync
acReviewedRevision:
  - 14
  - 17
  - 4
  - 3
  - 3
  - 2
  - 4
  - 19
  - 1
  - 9
fixtureRef: app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/search-execution.library-grounding-outcome.test.ts; app/server/services/__tests__/library-neighborhood-discovery.test.ts; app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/components/research-route-renderers/__tests__/search-view-followup-handlers.test.tsx; app/components/research-route-renderers/__tests__/SearchView.similar-paper.test.tsx; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/components/research/__tests__/SearchResultsOverviewPanel.test.tsx; app/lib/__tests__/api-routes.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 9c14bfd2ec62+worktree
observedOutput: 새 검색과 모든 후속 검색은 basis 선택이나 preference를 쓰지 않고 현재 라이브러리 source를 검색어 관련도와 자동으로 함께 반영한다. 기존 personalize=false 주소는 검증 뒤 같은 단일 projection으로 정규화된다. 카드 marker는 keyword 결과이면서 양수의 query-aware 라이브러리 근접도 근거가 있는 논문에만 관련성 높은 후보로 나타나며 keyword-only와 graph-only 논문에는 나타나지 않는다. 라이브러리 신호가 없거나 일시 unavailable이면 keyword 결과와 안정된 provider 순서를 유지하고 header가 실제 반영 결과를 구분한다.
gaps:
  - adopt: 결과의 출처를 세 종류로 설명하는 marker 대신 두 근거가 겹친 검토 후보만 하나의 보조 표시로 드러낸다.
  - adopt: 과거 조건 주소는 깨뜨리지 않되 현재 writer와 UI에는 basis 선택을 남기지 않는다.
  - reject: 관련성 높은 후보 표시를 관련성 확정, 필터, 별도 순위 축으로 해석하지 않는다.
verdict: met
```

Dated log of judging the declared Intent against real rendered output, per `principles.md` §8 Intent Sufficiency and the guide in `docs/intent-traceability.md`.

#### 2026-08-06 — graph-only library marker and source

```yaml
date: 2026-08-06
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-library-source-sync
  - acceptance-check:search-nonascii-library-relevance-korean-overlap
acReviewedRevision:
  - 13
  - 8
  - 4
fixtureRef: app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts; app/server/services/__tests__/library-neighborhood-discovery.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/episteme-literature.test.ts; app/server/services/__tests__/paper-neighborhood.test.ts; app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 02013e909697ee4a0f6b7ab77102eb20524e0225+worktree
observedOutput: 현재 owner의 reviewed_papers source는 논문 목록만 반환하고 response-tail citation warm이나 process cache를 만들지 않는다. Query-aware PaperNeighborhood의 양수 관계만 interestWeights를 만들어 카드 marker를 결정하며, 같은 graph 관계의 default_score와 안정된 순위가 combinedRankWeights의 library 축을 만든다. Keyword 축과 library 축은 각각 최대 0.5를 유지하고 overlap 논문은 두 기여를 함께 받는다. Renderer는 keyword-only를 검색어 일치, graph overlap을 검색어 일치 · 라이브러리 인접, graph 합류 후보를 라이브러리 인접으로 계속 표시한다. 새 비ASCII 검색도 같은 graph-only writer를 사용하고, 저장 snapshot의 Hangul/CJK 호환 reader와 legacy visibility event만 유지한다. Targeted 11개 파일의 126개 테스트와 TypeScript typecheck가 통과했다. 사용자-facing /citation lineage는 별도 citation page 테스트와 runtime path로 유지된다.
gaps:
  - reject: 검색과 무관한 /citation lineage를 이 retirement에 포함하지 않는다.
verdict: met
```
#### 2026-07-31 — requested library grounding unavailable

```yaml
date: 2026-07-31
acs:
  - acceptance-check:search-results-fast-window-library-grounding-unavailable
acReviewedRevision:
  - 1
fixtureRef: app/server/services/__tests__/library-anchor-blend.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/server/services/__tests__/search-hydration.provider-outcome.test.ts; app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/search-execution.library-grounding-outcome.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 9a347468+worktree
observedOutput: 사용자가 내 연구 기준을 요청했고 적용할 라이브러리 source가 있지만 source read 또는 graph preflight를 사용할 수 없을 때 첫 payload는 unavailable을 기록한다. 결과는 검색어 기준과 keyword 논문 카드를 유지한다. 결과 header는 내 연구 기준을 지금 적용하지 못했다는 안내를 role=status로 표시한다. 개인화를 끈 검색은 not_requested, 라이브러리가 없거나 provider가 정상 응답했지만 신호가 없는 검색은 no_signal, 실제 라이브러리 신호가 반영된 검색은 applied로 기록하며 이 세 상태에는 실패 안내가 없다. Client schema는 provider reason과 HTTP status를 제거한다. Gateway telemetry는 provider failure, circuit, load-shed를 server-only outcome으로 구분한다. Background hydration은 첫 payload 뒤 graph 후보를 조회하거나 주입하지 않는다.
gaps:
  - adopt: 요청과 실제 적용 결과의 차이를 첫 search payload의 tagged state로 보존한다.
  - adopt: unavailable 안내는 keyword 결과와 후속 읽기 동작을 가리지 않는 결과 header 보조 문장으로 표시한다.
  - reject: raw provider 오류, HTTP status, circuit·queue 상태를 client metadata나 사용자 문구에 포함하지 않는다.
verdict: met
```

#### 2026-07-23 — aspect:library-grounded-research equal-max combined score

```yaml
date: 2026-07-23
acs:
  - acceptance-check:search-results-fast-window-library-interest-default
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-title-family-dedup
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-balanced-basis-order
  - acceptance-check:search-results-fast-window-library-first-response
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-library-source-sync
  - acceptance-check:search-results-fast-window-reviewed-papers-context-source
  - acceptance-check:search-nonascii-library-relevance-korean-overlap
acReviewedRevision:
  - 16
  - 10
  - 4
  - 2
  - 2
  - 2
  - 2
  - 18
  - 7
  - 9
  - 3
fixtureRef: app/server/services/__tests__/library-neighborhood-discovery.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 77e1d58f4133
observedOutput: aspect:library-grounded-research의 새 검색은 keyword 결과 최대 40편과 graph 결과 최대 40편을 모두 한 pool에 넣고 paper-id와 title-family 중복을 한 번만 남긴다. Keyword 순위 점수 Q와 library relation 점수 R은 각각 0..1로 정규화되고 최종 점수에 최대 0.5씩 기여한다. R은 graph `default_score`의 P05/P95 robust magnitude 70%와 graph 후보의 안정된 상대 순위 30%를 합친다. 같은 논문이 양쪽에 있으면 두 기여를 모두 받고, 같은 최종 점수에서는 keyword provider와 기존 후보 순서를 보존하므로 고정 교차 슬롯이나 출처 quota를 만들지 않는다. 직접 인용은 카드의 라이브러리 근거 marker와 저장 snapshot 호환에는 남지만 query-aware Episteme relation score를 덮어쓰지 않는다. `jaeyoung@corca.ai` 라이브러리와 `ai for science`의 live pilot은 keyword 40편과 graph 40편, overlap 0인 production 결과가 사전 계산한 equal-max 순서와 정확히 같았고 상위 20편은 keyword 13편과 library 7편이었다. 이 변경은 provider·DB 호출, 후보 수, payload shape, downstream cap을 늘리지 않는다.
gaps:
  - adopt: 검색어 관련도와 내 연구 인접도는 각자 최대 0.5를 기여하고 overlap 논문은 두 점수를 모두 받는다.
  - adopt: library relation은 현재 graph 분포의 robust magnitude와 상대 순위를 함께 사용하며 실제 library×query 표본의 nDCG와 유용 논문 첫 순위로 지속 튜닝한다.
  - reject: source mix를 목표 quota로 삼거나 1개씩 교차 배치하는 고정 슬롯을 사용하지 않는다.
verdict: met
```

#### 2026-07-23 — aspect:library-grounded-research graph 40편 rank fusion

```yaml
date: 2026-07-23
acs:
  - acceptance-check:search-results-fast-window-library-interest-default
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-title-family-dedup
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-balanced-basis-order
  - acceptance-check:search-results-fast-window-library-first-response
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-library-source-sync
  - acceptance-check:search-results-fast-window-reviewed-papers-context-source
  - acceptance-check:search-nonascii-library-relevance-korean-overlap
acReviewedRevision:
  - 16
  - 10
  - 4
  - 2
  - 1
  - 2
  - 2
  - 18
  - 7
  - 9
  - 3
fixtureRef: app/server/services/__tests__/dedupe-papers-by-title-family.test.ts; app/server/services/__tests__/library-neighborhood-discovery.test.ts; app/server/services/__tests__/library-citation-proximity.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/server/services/__tests__/search-execution.test.ts; app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts; app/api/library-context/bootstrap/__tests__/route.test.ts; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; app/components/research-route-renderers/__tests__/search-view-facet-projection.test.ts; app/components/research-route-renderers/__tests__/search-view-content.analytics.test.tsx; app/components/research-route-renderers/__tests__/search-view-knowledge-map.test.ts; app/lib/__tests__/view-snapshot.test.ts; app/lib/__tests__/track.test.ts; app/lib/analytics/__tests__/event-router.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 811a1abfcb24
observedOutput: aspect:library-grounded-research의 새 검색은 keyword 결과 최대 40편과 graph 결과 최대 40편을 모두 한 result pool에 넣고 paper-id와 title-family 중복을 한 번만 남긴다. Keyword provider 순위와 direct-citation 연결 수·graph proximity로 만든 내 연구 인접 순위는 offset 60 reciprocal-rank fusion으로 결합된다. 같은 논문이 양쪽에 걸리면 두 순위 기여도를 받아 올라가고, 어느 한 출처도 출처라는 이유만으로 상단 전체를 선점하지 않는다. 정확한 keyword-only·library-only·overlap contribution과 schema·later-hydration 보존을 검증했다. 실제 라이브러리 근거는 `interestWeights`, 정렬 key는 `combinedRankWeights`로 분리되어 keyword-only 논문이 라이브러리 인접 marker를 받지 않고, 직접 인용 또는 graph proximity 근거가 있는 keyword 논문은 `검색어 일치 · 내 연구 인접` marker를 받는다. 합류한 graph 결과는 결과 수·더보기·facet·후속 AI·연구 공백 입력에 참여하고, 각 downstream은 자신의 기존 20편·40편 cap을 유지한다. personalize:false와 검색어 기준은 library-only 후보를 제외한다. 새 검색의 source는 현재 reviewed_papers와 bootstrap 결과를 사용하고, 저장된 과거 non-ASCII snapshot의 admission reader와 visibility event만 호환 범위에서 유지하며 active combined pool은 legacy event를 발화하지 않는다.
gaps:
  - adopt: 이미 first-payload preflight에서 hydrate한 graph 상위 40편은 별도 5편 cap 없이 모두 combined pool에 참여한다.
  - adopt: graph 후보 전체가 상단을 선점하던 source bias는 두 retrieval의 ordinal을 결합하고 dual-basis 논문에 두 contribution을 주는 rank fusion으로 닫는다.
  - reject: 첫 공개 뒤 graph pagination이나 새 provider 호출로 후보를 추가하거나 고정 교차 슬롯을 배급하지 않는다.
verdict: met
```

#### 2026-07-23 — equal-max ranking evidence scope corrected

```yaml
date: 2026-07-23
acs:
  - acceptance-check:search-results-fast-window-library-interest-default
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-balanced-basis-order
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
acReviewedRevision:
  - 16
  - 10
  - 2
  - 2
  - 2
fixtureRef: app/server/services/__tests__/library-neighborhood-discovery.test.ts; app/domain/__tests__/research-route-payload-schema.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/components/research-route-renderers/__tests__/search-view-interest-sort.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 77e1d58f4133
observedOutput: Equal-max 변경에서 다시 판단한 범위는 keyword 최대 40편과 graph 최대 40편의 한 combined pool, 두 축의 같은 최대 기여도, overlap의 양쪽 점수 합산, 직접 인용 marker와 graph relation 점수의 분리, stable tie, fixed-slot 부재다. P05/P95와 relation 내부 비중의 정확한 값은 ranking runtime-flow가 단독 소유하고, 독립된 outlier fixture가 그 현재 값을 검증한다. 첫 응답 시점, personalize opt-out, library source sync, reviewed-papers source, title-family 전체 계약, non-ASCII compatibility는 이 항목에서 새로 met을 선언하지 않고 앞선 owning evidence와 dated review에 남긴다.
gaps:
  - adopt: 이번 Sufficiency Review는 equal-max 변경이 실제로 다시 판단한 다섯 AC만 소유한다.
  - reject: 이전 RRF review의 넓은 evidence 범위를 새 점수식 review가 암묵적으로 상속하지 않는다.
verdict: met
```

#### 2026-07-23 — aspect:library-grounded-research uses one proximity term

```yaml
date: 2026-07-23
acs:
  - acceptance-check:search-results-fast-window-card-triage-metadata
  - acceptance-check:search-results-fast-window-combined-result-membership
  - acceptance-check:search-results-fast-window-library-neighbor-combined-pool
acReviewedRevision:
  - 12
  - 3
  - 3
fixtureRef: app/components/research-route-renderers/__tests__/search-result-basis-badge.test.tsx; app/components/research-route-renderers/__tests__/search-view-content.result-basis.test.tsx; app/server/services/__tests__/paper-neighborhood.test.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: b36c53d5c625
observedOutput: Keyword-only cards render 검색어 일치, overlap cards render 검색어 일치 · 라이브러리 인접, and graph-only cards render 라이브러리 인접. The current query reaches PaperNeighborhood, so absence from the keyword result window is not described as query irrelevance. Equal-max scoring, the 40+40 candidate pool, payload schema, and fallback policy are unchanged.
gaps:
  - adopt: Card copy, Story Chain prose, public explanation, and current runtime guidance distinguish result-window membership from query relevance.
  - reject: Internal compatibility identifiers such as libraryOnlyPaperIds and keywordLibrary do not need a schema rename.
verdict: met
```

#### 2026-08-21 — legacy basis carrier와 현재 writer exact-commit 재검토

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-results-fast-window-personalization-opt-out
  - acceptance-check:search-results-fast-window-unified-result-projection
acReviewedRevision:
  - 20
  - 2
fixtureRef: app/server/services/__tests__/search-execution.test.ts; app/server/services/__tests__/search-execution-legacy-position.test.ts; app/lib/__tests__/api-routes.test.ts; app/domain/research-route-payload.ts; app/domain/search-followup-criteria.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: d3365127e26aec3aa1f856926fb7e22b4b501baf
observedOutput: exact 기능 커밋에서 personalize=false와 sort=relevance|interest는 읽기 호환 입력으로만 남고 현재 결과 identity와 projection을 바꾸지 않는다. 현재 pending hydration snapshot은 personalize preference를 쓰지 않으며, optional field와 follow-up reader만 과거 저장 snapshot 호환을 유지한다.
gaps:
  - adopt: legacy carrier의 수명과 현재 writer authority를 분리한다.
  - reject: 항상 true로 정규화된 retired preference를 현재 snapshot에 다시 기록하지 않는다.
verdict: met
```
