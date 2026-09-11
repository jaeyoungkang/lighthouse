# Commitment Pages — Sufficiency Reviews

This file stores the dated Sufficiency Review log for [commitment-pages.ledger.yaml](../commitment-pages.ledger.yaml). The ledger keeps executable coverage and the review pointer; release and Mission Control readers treat this file as part of the same Evidence Ledger review source.

## Reviews

### Sufficiency Review

#### 2026-09-03 — 공개 검색 설명의 provider-neutral Moonlight DB 정렬

```yaml
date: 2026-09-03
acs:
  - acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
acReviewedRevision:
  - 10
fixtureRef: app/about/__tests__/search-mechanism-page.test.tsx; app/i18n/messages/commitment-runtime-explainers.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 2d9709f952ce+worktree
observedOutput: 공개 검색 설명은 특정 provider를 자체 검색 엔진으로 오인시키지 않고, 주요 학술 출처를 모은 Moonlight 논문 DB에서 keyword 검색과 query-aware 라이브러리 그래프 탐색을 한 첫 결과로 합친다고 설명한다. 내부 corpus id, API, provider 이름은 노출하지 않는다.
gaps:
  - adopt: 현재 공개 copy와 같은 provider-neutral Moonlight 논문 DB 설명을 정본 Promise에 사용한다.
  - reject: retired Semantic Scholar 단일-provider 설명과 E3 endpoint 또는 field 이름을 public Promise에 고정하지 않는다.
verdict: met
```

#### 2026-08-21 — 공개 검색 설명의 단일 결과 모델과 연구 근접 표식

```yaml
date: 2026-08-21
acs:
  - acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
acReviewedRevision:
  - 9
fixtureRef: app/about/__tests__/search-mechanism-page.test.tsx; app/i18n/messages/commitment-runtime-explainers.ts; app/i18n/messages/commitment.ts; docs/runtime-flows/search-retrieval-ranking.md
runCommitSha: 07b49a1ff4d0+worktree
observedOutput: 공개 검색 설명은 keyword 검색과 query-aware 라이브러리 그래프 탐색이 첫 결과부터 한 목록에 합쳐진다고 설명한다. 양수의 라이브러리 근접도 근거가 있는 논문은 keyword 결과 포함 여부와 관계없이 `내 연구와 가까움`으로 표시하며, 별도의 keyword 또는 출처 marker는 만들지 않는다. 표식은 관련성을 확정하거나 필터로 동작하지 않고, 사용자가 두 기준을 고르는 토글이나 탭도 없다.
gaps:
  - adopt: 내부 근거 조합 대신 사용자가 해석할 수 있는 연구 근접 의미를 공개 문구와 카드 문구에서 동일하게 사용한다.
  - reject: 내부 corpus id, API, provider 명칭과 compatibility field는 공개 설명에 노출하지 않는다.
verdict: met
```

#### 2026-07-23 — public search explanation uses the library-proximity term

```yaml
date: 2026-07-23
acs:
  - acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
acReviewedRevision:
  - 7
fixtureRef: app/about/__tests__/search-mechanism-page.test.tsx; app/i18n/messages/commitment-runtime-explainers.ts; app/server/services/__tests__/paper-neighborhood.test.ts
runCommitSha: b36c53d5c625
observedOutput: The rendered public search explanation says that keyword search and the library graph both receive the same query. A candidate absent from the keyword result window uses 라이브러리 인접 without implying query irrelevance, while equal-max query and library-proximity scoring remains unchanged.
gaps:
  - adopt: Public prose and provider-boundary evidence distinguish keyword-window membership from query relevance.
  - reject: Internal provider names and compatibility field names remain outside the public explanation.
verdict: met
```

#### 2026-07-21 — public commitment surface remains after internal inventory retirement

```yaml
date: 2026-07-21
acs:
  - acceptance-check:researcher-prose-promises-page-public-page-with-core-promise-paragraphs
  - acceptance-check:researcher-prose-promises-page-hidden-footnoted-references
  - acceptance-check:researcher-prose-promises-page-user-centered-identity-prose
  - acceptance-check:researcher-prose-promises-page-footnote-section-with-promise-keys
  - acceptance-check:researcher-prose-promises-page-user-text-via-i18n
  - acceptance-check:researcher-prose-promises-page-required-value-facets-covered
  - acceptance-check:researcher-prose-promises-page-search-mechanism-explainer
  - acceptance-check:researcher-prose-promises-page-gap-network-explainer
  - acceptance-check:researcher-prose-promises-page-graph-explainer
  - acceptance-check:researcher-prose-promises-page-ai-comment-type-explainer
acReviewedRevision:
  - 1
  - 1
  - 1
  - 1
  - 1
  - 1
  - 2
  - 1
  - 1
  - 1
fixtureRef: app/about/__tests__/promises-page.test.tsx; app/about/__tests__/search-mechanism-page.test.tsx; app/about/__tests__/gap-network-mechanism-page.test.tsx; app/about/__tests__/graph-sample-page.test.tsx; app/about/__tests__/ai-comments-page.test.tsx
runCommitSha: 27bd7a64d150+worktree
observedOutput: The public commitment and mechanism pages retain researcher-centered prose, i18n ownership, footnoted traceability, and rendered mechanism boundaries; the retired internal inventory no longer shares this ledger.
gaps:
  - adopt: The product-commitment experience now describes the public researcher surface only.
  - reject: Internal process status belongs to Story Chain documents and mc:status rather than a duplicate web projection.
verdict: met
```

- Verdict: met
