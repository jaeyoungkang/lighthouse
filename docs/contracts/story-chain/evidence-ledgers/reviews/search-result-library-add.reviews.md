# Search Result Library Add — Sufficiency Reviews

This file stores the dated Sufficiency Review log for
[search-result-library-add.ledger.yaml](../search-result-library-add.ledger.yaml).

## Reviews

### Sufficiency Review

#### 2026-09-03 — E3 paper reference 기반 reviewed source 재검토

```yaml
date: 2026-09-03
acs:
  - acceptance-check:search-result-library-add-reviewed-papers-basis
acReviewedRevision:
  - 9
fixtureRef: app/lib/__tests__/episteme-paper-ref.test.ts; app/server/domain-access/__tests__/graph-neighbor-hydration-access.test.ts; app/server/services/__tests__/search-hydration.test.ts; app/server/services/__tests__/library-anchor-display.test.ts
runCommitSha: 8a2b1b9a862851fdf65079f8dff41f4264e98443+worktree
observedOutput: reviewed_papers source는 numeric corpus id에 한정되지 않고 E3 canonical uid, S2 corpus id 및 provider-supported external ref를 anchor로 유지한다. 검색·graph hydration은 한 논문의 canonical/S2 alias를 함께 조회해 저장 carrier가 달라도 reviewed 상태를 복원하고, E3-only anchor도 title과 library availability를 유지한다.
gaps:
  - adopt: E3 paper reference 전체를 기존 reviewed_papers source와 동일한 사용자 저장 의미로 취급한다.
  - reject: 별도 E3 전용 library source나 새 사용자 preference를 만들지 않는다.
verdict: met
```

#### 2026-08-21 — 저장 논문 source의 자동 반영

```yaml
date: 2026-08-21
acs:
  - acceptance-check:search-result-library-add-reviewed-papers-basis
acReviewedRevision:
  - 8
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.library-action.test.tsx; app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts; app/server/services/__tests__/search-execution.test.ts; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx
runCommitSha: 9c14bfd2ec62+worktree
observedOutput: 검색 결과에서 저장하거나 해제한 reviewed_papers는 다음 검색의 현재 라이브러리 근접도 source가 된다. 새 검색과 follow-up은 이 source를 검색어 관련도와 자동으로 함께 반영하고, 별도 personalize preference나 basis 선택을 읽거나 기록하지 않는다. 기존 저장·해제 mutation, 실패 rollback, 목록 store 동기화는 유지된다.
gaps:
  - adopt: 라이브러리 저장 상태는 검색 source를 바꾸지만 사용자가 매 검색마다 결과 기준을 선택하게 하지 않는다.
  - reject: reviewed_papers 정본과 저장·해제 동작은 변경하지 않는다.
verdict: met
```

#### 2026-07-05 — reviewed-papers basis AC 본문을 조건 URL 실행 모델로 정합 (rev 7 재검토)

```yaml
date: 2026-07-05
acs:
  - acceptance-check:search-result-library-add-reviewed-papers-basis
acReviewedRevision:
  - 7
fixtureRef: docs/contracts/story-chain/evidence-ledgers/search-result-library-add.ledger.md
runCommitSha: 73ffe3f45b3a
observedOutput: Revision bump is a wording catch-up, not a behavior change — the AC body's reserve-era sentences (server document reserve, canonical /search/:id redirect) were replaced with the Search-first condition-URL execution wording that the search-ephemeral-execution ledger already locks. The behavior the AC asserts is unchanged and its executable evidence rows keep passing. New search executions and follow-ups still derive the library basis from the current reviewed_papers source and personalize state.
gaps:
  - adopt: AC prose now matches the executed condition-URL model, clearing the revision drift signal.
  - reject: No library add/remove behavior change is claimed.
verdict: met
```

#### 2026-07-15 — library-add의 search result identity 연결

```yaml
date: 2026-07-15
acs:
  - acceptance-check:search-result-library-add-analytics
acReviewedRevision:
  - 4
fixtureRef: app/components/research-route-renderers/use-search-view-controller.shared.ts; app/lib/__tests__/track.test.ts; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; docs/analytics/events.yaml
runCommitSha: fedb6597+worktree
observedOutput: 검색 결과 카드의 library-add interaction은 owner와 paper id에 더해 출발 search documentId를 canonical event v2의 subject와 properties에 전달한다. 따라서 같은 documentId의 first usable search-results view 이후 행동으로 별도 상관관계를 만들 수 있다. 내부 목록 remove는 기존 remove event 계열을 유지하고 제목·검색어·토큰을 수집하지 않는다.
gaps:
  - adopt: library-add는 PDF-open과 합치지 않는 별도 outcome proxy다. 분석은 다음 검색 또는 세션 경계 전까지 같은 documentId에서만 연결한다.
  - reject: event 발생 자체를 사용자 성과로 간주하지 않는다. 비교 가능한 baseline이나 cohort가 없으면 속도·품질 인과 주장을 만들지 않는다.
verdict: met
```

#### 2026-07-16 — compact 북마크 상태 토글

```yaml
date: 2026-07-16
acs:
  - acceptance-check:search-result-library-add-card-action
acReviewedRevision:
  - 7
fixtureRef: app/components/research-route-renderers/__tests__/search-result-item-library-action.test.tsx; app/components/research-route-renderers/__tests__/SearchView.library-action.test.tsx; app/components/research-route-renderers/search-result-item-actions.tsx
runCommitSha: 29e123c6019b+worktree
observedOutput: 검색 결과 카드의 라이브러리 토글은 제목 행의 1.75rem 정사각형 북마크 아이콘으로 바뀌었다. 저장 전에는 외곽선 북마크와 accent 테두리, 저장 후에는 채워진 북마크와 success 배경·테두리를 사용한다. 긴 `라이브러리에 추가`·`라이브러리에 있음` 문구는 화면에서 제거됐지만, 저장 전 `라이브러리에 추가`와 저장 후 실제 동작인 `라이브러리에서 해제`는 aria-label, title, screen-reader text에 남는다. reviewed_papers POST/DELETE, pending 중복 클릭 방지, 실패 rollback, stale metadata 보호, 목록 store 동기화는 그대로 유지된다.
gaps:
  - adopt: 제목 폭과 카드 비교 리듬을 보존하기 위해 라이브러리 상태를 compact 아이콘과 색·채움으로 표현한다.
  - reject: 저장 상태를 색만으로 전달하지 않는다. 외곽선/채움 차이와 접근성 label을 함께 유지한다.
  - reject: reviewed_papers 정본, mutation 경계, analytics payload, route search 동작은 바꾸지 않는다.
verdict: met
```

##### Contract Architecture Impact Review

- **result:** `none`
- 기존 `reviewed_papers` owner, current reviewed-id carrier, mutation 실패 rollback,
  canonical event identity와 payload가 그대로다. 바뀐 것은 같은 title-row toggle의
  표현과 접근성 copy뿐이며 새 상태, 저장, provider, fan-out, 관측 경계를 만들지 않는다.

##### Concept Shift Architecture Review

- **remove:** 제목 폭을 차지하던 visible `라이브러리에 추가` / `라이브러리에 있음`
  text-button presentation과 사용하지 않는 saved-state message key.
- **preserve:** 단일 title-row toggle, add/remove accessibility label/title,
  `reviewed_papers` 저장·해제, pending guard, rollback, list-store 동기화, analytics.
- **migrate-read-only:** 없음. 저장 데이터나 URL/API/event compatibility shape는 바뀌지 않는다.

#### 2026-08-04 — 검색 여정 저장·해제 event 재검토

```yaml
date: 2026-08-04
acs:
  - acceptance-check:search-result-library-add-analytics
acReviewedRevision:
  - 5
fixtureRef: app/components/research-route-renderers/__tests__/SearchView.library-action.test.tsx; app/components/research/__tests__/ResearchRouteSearchBar.test.tsx; app/lib/__tests__/track.test.ts; app/lib/analytics/__tests__/event-router.test.ts; docs/analytics/events.yaml
runCommitSha: 96fa282b+worktree
observedOutput: 검색 결과 카드의 저장·해제는 reviewed_papers POST 또는 DELETE가 성공한 뒤에만 paper_saved 또는 paper_unsaved를 발행한다. 두 event는 같은 journey_context_id와 search_context_id, paper_id·순위·출발 surface·PDF·근거 가용성을 전달한다. 실패한 mutation과 검색 맥락이 없는 전역 목록 해제는 검색 여정 event를 만들지 않는다. event router는 raw query, query hash, 논문 제목, 인증 token을 거절하며 구형 product.search_result_library_add.clicked writer와 이중 발행하지 않는다.
gaps:
  - adopt: 저장·해제 event를 클릭 시점이 아니라 서버 mutation 성공 시점의 outcome proxy로 고정한다.
  - reject: event 수신을 사용자 성과로 해석하지 않는다. 외부 사용자 cohort가 없으므로 제품 효과는 unknown이다.
  - reject: 안정된 paper_id로 대체할 수 있는 논문 제목과 검색어·PDF URL·AI 출력·인증 정보를 수집하지 않는다.
verdict: met
```
