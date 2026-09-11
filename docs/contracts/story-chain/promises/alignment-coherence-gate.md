---
id: promise:alignment-coherence-gate
slug: alignment-coherence-gate
title: Story Chain alignment 정합성 게이트 (revision drift + review schema + 슬러그 규칙)
moment: moment:alignment-relation-observability
lane: admin
status: propagated
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:alignment-coherence-gate-ac-revision-field
  - acceptance-check:alignment-coherence-gate-revision-drift-soft
  - acceptance-check:alignment-coherence-gate-review-yaml-schema
  - acceptance-check:alignment-coherence-gate-review-cutoff-migration
  - acceptance-check:alignment-coherence-gate-ac-slug-rule
  - acceptance-check:alignment-coherence-gate-review-section-promise-match
  - acceptance-check:alignment-coherence-gate-review-observed-count-match
analyticsExempt: internal coherence gate is observed by deterministic Story Chain validation, not product analytics
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Story Chain alignment 정합성 게이트

## Promise

운영자는 alignment 결과를 신뢰할 수 있다 — Promise·Evidence Ledger·Sufficiency
Review 사이의 의미 일치를 자동 게이트가 PR마다 확인하고, AC가 의미적으로
바뀌었는데 review가 따라오지 않은 stale 상태를 즉시 표시한다.

이 Promise는 deterministic schema/parser 검증과 review revision 신선도만
다룬다.

## Intent Checks

명시적 Intent Check는 없다. 모든 의미 일치 판정은 deterministic schema gate가
수행한다.

## Acceptance Checks

### acceptance-check:alignment-coherence-gate-ac-revision-field

- description: Promise frontmatter 안 각 Acceptance Check는 양의 정수
  `revision` 필드를 가진다. Promise가 `acRulesEnforced: true`를 선언하면
  모든 AC가 revision을 가져야 하고, 선언하지 않으면 grandfathered. AC의
  *의미*가 바뀔 때만 사람이 revision을 +1 bump한다. 오타/줄바꿈 정리는
  bump하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:alignment-coherence-gate-revision-drift-soft

- description: review 엔트리의 `acReviewedRevision`이 현재 AC의 `revision`보다
  작은 경우, `detectRevisionDrift` helper는 그 AC를 stale signal로 보고한다 —
  intent-check refs interleave, same-day 동률 (file order 후순위 우선),
  grandfathered entry 무시, revision 미선언 AC 무시 모두 포함. signal은 snapshot
  consumer(`buildRevisionDriftIndex`)가 promise 단위로 그루핑해 (a) `classifyStage`가
  해당 row의 stage를 `verify`로 떨어뜨리고 (b) `IntentTraceabilityRow.staleRevisions`로
  surface해서 `mc:status`와 `mc:next`가 검토 대상을 읽게 한다 — *PR gate는
  차단하지 않는 soft signal*. helper는 detection만, snapshot은 classify,
  CLI는 read-only projection을 맡는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 3

### acceptance-check:alignment-coherence-gate-review-yaml-schema

- description: Sufficiency Review 엔트리는 yaml 블록을 가진다 — `date`,
  `acs[]`, `acReviewedRevision[]`, `fixtureRef`, `runCommitSha`,
  `observedOutput` (≥ 80자), `gaps[]` (각 항목 `adopt: <reason>` 또는
  `reject: <reason>` 형식의 단일 스트링), `verdict`. validator는 누락·빈·짧은
  필드, 비-YYYY-MM-DD date, heading-yaml date 불일치, multi-line/quoted
  스칼라(파서 subset 외)를 차단한다. acReviewedRevision은 acceptance-check
  refs 수와 매칭하고 intent-check refs는 revision 페어를 요구하지 않는다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:alignment-coherence-gate-review-cutoff-migration

- description: 2026-05-06 이전 prose-only review 엔트리는 자동
  grandfathered하되, yaml 블록이 있으면 날짜와 무관하게 parser가 읽는다.
  같은 날짜 이후 신규 review는 yaml schema를 강제한다. historical refs는 현재
  Acceptance Check로 위조하지 않고 해당 historical entry를 제거하거나 현재
  Story Chain ref로 재작성한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 2

### acceptance-check:alignment-coherence-gate-ac-slug-rule

- description: 새 AC ID는 의미 슬러그를 쓴다. `acRulesEnforced: true` 선언
  promise에 한해 validator는 모든 AC에 대해 `^ac\d+$` 패턴을 거부하고
  슬러그는 kebab-case, promise 내 unique, ≤ 4 단어, ≤ 30자
  (promise prefix를 제외한 AC 슬러그 부분만 카운트)임을 강제한다.
  assertion의 *축*을 가리키며 *값*을 인코딩하지 않는다 (`cap-block` ✓,
  `initial-ten` ✗).
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:alignment-coherence-gate-review-section-promise-match

- description: Sufficiency Review 섹션 header가 정확히 한 `promise:X` ref를
  포함하면, 같은 섹션의 `yaml.acs` 각 acceptance-check 항목은
  `acceptance-check:X-...` 접두사를 만족해야 한다. validator는 header가
  지정한 단일 promise와 acs의 접두사 promise가 다른 historical
  copy-paste drift를 차단한다. 2개 이상 promise를 명시한 cross-promise
  absorption header는 다중 출처 acs를 허용하므로 본 체크에서 제외된다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1

### acceptance-check:alignment-coherence-gate-review-observed-count-match

- description: `yaml.observedOutput` 산문에 "all N Acceptance Checks" 또는
  "all N ACs" 형태의 강한 quantifier 주장이 들어 있으면 validator는 N과
  `yaml.acs`의 acceptance-check 항목 수가 같음을 강제한다 (intent-check 항목은
  카운트에서 제외해 "all N Acceptance Checks and all M Intent Checks" 형태의
  혼합 acs 리스트도 정상 통과한다). "N ACs" 단독(전체/upstream 참조)은 허용한다.
  presence-bot 등 historical drift에서 "all 9 Acceptance Checks" 주장이 12개
  acceptance-check 리스트와 어긋난 사례를 deterministic하게 차단한다.
- evidence: covered by the covering Evidence Ledger `acceptanceChecks` row for this Acceptance Check.
- revision: 1
