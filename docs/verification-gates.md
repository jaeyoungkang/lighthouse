---
type: design
---

# 검증 게이트 — Sufficiency Review가 근거 없이 met으로 통과되지 않게 만드는 6개 도구

이 문서는 2026-04~05월 sufficiency-review-hardening 시리즈에서 도입한 6개
게이트의 의미 정본이다. 각 게이트가 무엇을 잡는지, 왜 필요한지, 어떻게 쓰는지를
한 페이지에서 본다.

이 문서의 범위는 이 6개 게이트다. 현재 운영 중인 게이트 전체 스택 — 정적
guard family, seam guard, 부하 스모크 레일, release dimension — 의 인덱스는
`docs/contract-maps/quality-gates.md`가 담당한다. `quality:*` alias의 필수
게이트 목록 단일 원본은 `package.json` alias 정의다 (이슈 #193). 이 문서는 그
목록을 다시 열거하지 않는다.

## 한 줄 요약

Light House의 Story Chain은 6개 게이트를 통과시킨다. Review entry가
verdict는 met이라 적었지만 실제 근거가 빈 상태로 통과하지 못하게 막는다.
형식, 슬러그, revision, review schema는 결정적 parser와 snapshot 검사가
잡는다. Vitest는 통과하지만 invariant를 보호하지 않는 본문은 mutation과
negative test가 잡는다. 각 도구는 서로 다른 종류의 부적합을 닫는다.

## 한 눈에 — 6 게이트 매트릭스

| # | 게이트 | 어떤 부적합을 잡나 | 도구 / 위치 | 트리거 |
|---|---|---|---|---|
| 1 | AC `revision` + `acRulesEnforced` | AC body 의미가 바뀌었지만 review entry가 따라오지 않은 stale 상태 | parser (`mc:validate-story-chain`) | PR gate |
| 2 | AC slug rule | `ac1` 같은 의미 없는 순번 슬러그, `initial-ten` 같이 값이 박힌 슬러그 | parser | PR gate |
| 3 | SR yaml schema + review ownership cutoffs | review entry가 형식 미달이거나 새 entry가 owning ledger의 Source Promise 밖 AC/IC를 직접 review하는 상태 | review-parser | PR gate |
| 4 | Revision drift signal → snapshot → Mission Control CLI | AC 수정 후 review가 stale인데 운영자에게 표시되지 않는 상태 | `detectRevisionDrift` + snapshot + `mc:status` | local runtime + PR gate |
| 5 | Mutation testing (Stryker) | vitest는 통과하지만 본문이 invariant를 검증하지 않는 경우 | `npm run mutation:all` | manual CI |
| 6 | Co-located negative test | symbol name 참조 테스트가 상수와 함께 움직여 false-pass되는 경우 | `// @check-removes-fails:` + literal `toBe()` | PR gate |

> 7번째 후보인 **Property-based fuzz**는 deterministic helper와 route
> 수준에서만 우선순위를 검토한다 (`hardening-tier-policy.md` §4 참고).

---

## 기존 시스템과의 연결

이 6개 게이트는 새 시스템이 아니다. 기존 Story Chain · Mission Control · CI ·
Evidence Ledger 위에 얹은 검증 layer다. 어디에 어떻게 끼워졌는지를 본다.

### Story Chain 흐름 위에서 본 위치

기존 chain: Experience → Moment → **Promise** → **Acceptance Check / Intent
Check** → **Evidence Ledger** → **structured execution** → **vitest / live judge** →
**Sufficiency Review**.

각 게이트가 잡는 layer는 다음과 같다.

| chain 단계 | 새 게이트 |
|---|---|
| Promise · AC 정의 | 1 (revision), 2 (slug rule) |
| structured execution · vitest 본문 | 5 (mutation), 6 (negative test) |
| Sufficiency Review entry | 3 (yaml schema) |
| review 시간 축 | 1 (revision 숫자), 4 (drift signal) |

기존 chain의 *각 노드*가 이미 met이라 적혀 있는 상태에서, 그 met 선언이 진짜
근거를 갖는지를 새 게이트가 추가로 검사한다.

### Mission Control authority model 위에서

Mission Control의 4-authority chip(H/A/E/S)에 변화는 없다. 게이트는 주로
*A(Agent) lane*과 *E(Evaluator) lane*에서 돈다. H(Human)이 승인할 부분은
그대로 남고, S(System)는 CI와 release gate를 강제한다.

| authority | 새 게이트가 어떻게 도와주나 |
|---|---|
| H — Promise 의미·존재 승인 | 게이트는 H 의미를 *바꾸지* 않는다. H가 의미를 바꿨다고 선언(revision +1)할 때 그 신호를 자동화에 연결한다. |
| A — propagation, 구현, 검증 | 1, 2, 3, 6이 PR gate에서 A 작업의 형식과 실행 근거를 검사한다. 통과 못 하면 A는 진행 못 한다. |
| E — deterministic/live judge 실행 | Intent Check의 실제 runtime·rendered DOM evidence를 평가한다. 이 문서의 정적 gate와는 별도다. |
| S — CI/release gate | `quality.yml`, `mutation.yml`, release verdict가 PR·수동·release 차단을 담당한다. |

### Evidence Ledger 흐름 위에서

기존 Evidence Ledger는 다음 4-edge chain을 닫는다 (`docs/principles.md` §0.1
참고).

1. Promise Acceptance Check
2. YAML Evidence Ledger의 완전한 `acceptanceChecks[].key`
3. 같은 entry의 `executionRefs[]`
4. 구조화 execution과 실재하는 검증 target

새 게이트가 각 edge에 추가로 박힌 contract:

- **Edge 1**: AC가 revision을 갖고 슬러그 규칙을 따른다 (게이트 1, 2)
- **Edge 4 위**: run evidence의 vitest 본문이 진짜로 invariant를 잡는다
  (게이트 5, 6)
- **Sufficiency Review**: yaml schema와 시간 축이 박힌다 (게이트 3, 4)

기존 chain 자체는 그대로다. *그 chain이 실제로 닫혀 있는지*를 검사하는 새 층이
얹혔다.

#### Acceptance Check assertion/execution 정합성

모든 YAML v2 원장은 같은 규칙을 적용한다. 각 `acceptanceChecks` entry는 한 개
이상의 `executionRefs`를 가져야 하고, ref는 같은 원장의 구조화 execution을
가리켜야 한다. 존재하지 않는 ref, 참조되지 않은 execution, zero-test selector,
미등록 target은 `evidence-ledger:dry`와 full runner가 실패시킨다. 따라서 assertion
prose만으로 met를 선언하거나 실제 runner가 실행하지 않는 테스트를 인용하는
false pass를 opt-in 없이 전 원장에서 차단한다.

### CI 흐름 위에서

CI job 구성, 검증 책임 단위, 새 검증을 어디에 붙일지의 판단 기준, 로컬
closeout 게이트(`quality:contract`·`quality:commit`)는 `docs/ci-structure.md`가
정본이다. 여기서는 6개 게이트가 그 구조의 어디에 끼워졌는지만 본다.

새 게이트가 끼어든 자리:

| 위치 | 게이트 | 비고 |
|---|---|---|
| `mc:validate-story-chain` 안 | 1, 2 (parser) | 기존 도구 안에 추가 검사 |
| `mc:validate-story-chain` 안 | 3 (review-parser) | 같은 도구에 추가 |
| `evidence-ledger:dry` / `evidence-ledger` 안 | 6 (negative test), 전 원장 assertion/execution 정합성 | PR은 strict YAML graph, assertion이 인용한 test와 AC별 `executionRefs`, selector·등록 target 무결성을 dry-run으로 보고, 수동 full은 구조화 execution을 실제로 실행한다. |
| `test:unit` 안 | 6 (직접) | 일반 vitest test |
| 별도 workflow (`mutation.yml`) | 5 | manual dispatch 분리. PR gate 시간 예산 보호 |
| Mission Control CLI | 4 | `mc:status`와 `mc:next`에서 운영자가 본다 |

quality.yml의 PR 시간 예산은 `quality:fast`에 build를 더한 병렬 fast-path job들로
지킨다. 무거운 mutation은 수동 workflow로 분리한다. PR `static` job은 외부 provider
secret 없이 결정적으로 실행한다.

### 정책 문서 정본 위치

새 게이트의 정책은 두 정본에 박혀 있다.

- `docs/contracts/story-chain/hardening-tier-policy.md` — 발동 정책
  (mutation 어디에, negative test 어디에, fuzz 정책상 보류)
- 각 Promise 파일 — AC 단위 contract
  (`promises/alignment-coherence-gate.md`, `respond-contract-mutation-pilot.md` 등)

정책 문서 자체는 vitest로 검증된다 (`hardening-tier-policy.test.ts`가 §1~§4
heading과 키워드 존재를 검사). 정책이 사라지면 vitest fail이다. 정책도 회귀
방지 대상이다.

### 새 게이트가 *대체하지 않는* 것

다음은 그대로 둔다. 게이트와 별개의 기존 도구들이다.

- `mc:audit-surface` / `mc:audit-story-surface` — surface tag (`@promise`,
  `@aspect`, `@check`) 무결성 검사
- `mc:check-critical-findings` — alignment audit critical finding 0건 유지
- `aspect-verdict` — Aspect own verdict (α Coverage ∧ β Wovenness)
- live LLM judge (intent-qualitative tests) — Intent Check 단위 의미 검증

새 게이트는 *Sufficiency Review가 근거 없는 met 선언으로 통과하지 않게*
막는 좁은 목적에 한정한다. 다른 검증 도구의 책임 영역을 침범하지 않는다.

---

## 1. AC `revision` + `acRulesEnforced` opt-in

### 무엇을 잡나

Acceptance Check 의미가 바뀌었지만 review entry가 옛 의미 기준으로 met이라
적혀 있는 상태를 잡는다. 예: AC 본문이 "정확히 10편"에서 "정확히 12편"으로
바뀌었는데 review는 그대로다. revision 숫자가 시간 축이 되어 review의
`acReviewedRevision`과 비교 가능해진다.

### 왜 필요한가

revision이 없으면 AC body 텍스트만 비교해야 한다. 그러면 사람이 의미를
바꿨는지 오타를 고쳤는지를 git history만으로 정확히 알기 어렵다.
`revision: N`은 의미 변경을 명시적으로 선언하는 도구다.

### 사용법

새로 만드는 Promise는 frontmatter에 `acRulesEnforced: true`를 박는다. 그러면
모든 AC가 `revision: N` 필드를 *반드시* 가져야 한다. 도입 당시의 기존 AC는
의도적으로 grandfather (overhead 없이 옵트인 가능).

```yaml
---
id: promise:foo
slug: foo
acRulesEnforced: true
acceptanceChecks:
  - acceptance-check:foo-cap-block
---

### acceptance-check:foo-cap-block

- description: ...
- evidence: covered by the covering Evidence Ledger ...
- revision: 1   # 의미 처음 박힐 때 1, body가 의미적으로 바뀌면 +1
```

revision을 올리는 기준은 의미 변경이다. 첫 적용 사례(2026-05-07,
`revision-drift-soft` 1→2)는 AC body가 의미적으로 확장된 경우였다 — 단순 오타
수정이었다면 revision은 그대로 둔다.

### 검증

`mc:validate-story-chain`이 PR gate에서 acRulesEnforced 옵트인 promise의
모든 AC에 revision이 박혀있는지 검사한다. 누락이면 fail.

---

## 2. AC slug rule

### 무엇을 잡나

- `acceptance-check:foo-ac1` 같은 의미 없는 순번 슬러그를 거부한다.
- `acceptance-check:foo-initial-ten`처럼 값이 슬러그에 박혀 있는 경우를
  거부한다. 정책이 N으로 바뀌면 슬러그와 실제 값이 어긋난다.
- 같은 promise 안에서 중복된 슬러그를 거부한다.

### 왜 필요한가

슬러그는 body가 검증하는 assertion의 축을 사람이 바로 찾게 한다. `ac1`은
의미가 없고, `initial-ten`은 N이 변하는 순간 슬러그와 실제 값이 어긋난다.

### 사용법

revision을 박은 AC는 슬러그가:
- `^ac\d+$` 패턴 거부 (`ac1`, `ac2` ❌)
- kebab-case
- 30자 이하, 4단어 이하
- 같은 promise 내에서 unique
- *값*을 인코딩하지 말고 *축*을 가리킬 것 (`cap-block` ✓, `initial-ten` ❌)

### 사례

```
✓ acceptance-check:respond-contract-mutation-pilot-stryker-wired
✓ acceptance-check:alignment-coherence-gate-revision-drift-soft
✗ acceptance-check:foo-ac1                 # 순번
✗ acceptance-check:bar-initial-ten         # 값 인코딩
✗ acceptance-check:baz-this-is-a-very-long-slug-with-too-many-words  # 30자/4단어 초과
```

### 검증

parser 자체가 거부. `npm run mc:validate-story-chain`에서 빨강.

---

## 3. Sufficiency Review yaml schema + 2026-05-06 cutoff

### 무엇을 잡나

review entry가 형식을 못 맞춘 경우를 잡는다. 본문이 너무 짧은 경우, gap
형식 위반, 필드 누락, multi-line yaml scalar 등이다.

### 왜 필요한가

산문만 적힌 review는 후행 자동화가 파싱하지 못한다. drift detection도 judge도
yaml block에서 메타데이터를 읽는다. yaml block은 review의 메타데이터를 기계가
읽을 수 있는 형태로 박는다. cutoff(2026-05-06) 이전 entry는 grandfather하고,
이후 신규는 yaml을 강제한다. cutoff 이후 신규 review는 이 schema로 작성되어
왔고, drift detection과 judge가 그 메타데이터를 소비한다.

### 사용법

```markdown
#### 2026-05-07 mutation pilot first run

- date: 2026-05-07
- acs:
  - acceptance-check:respond-contract-mutation-pilot-stryker-wired
- acReviewedRevision: [1]
- fixtureRef: reports/mutation/mutation.json
- runCommitSha: 5a0f79c
- observedOutput: |
  Stryker 9.6.1로 91 mutants 생성. 52개 killed, 39 survived. ... (≥80자)
- gaps:
  - adopt: describe 문자열 mutants는 의도적 비검증
- verdict: met
```

필수 필드:
- `date` — heading date와 일치
- `acs[]`, `acReviewedRevision[]` — acceptance-check refs와 평행 배열
- `observedOutput` — 80자 이상
- `gaps[]` — 각 항목은 `adopt: <reason>` 또는 `reject: <reason>` 단일 라인
  string
- `verdict` — met / not-met / unknown 중 하나

산문 형식이 꼭 필요한 review(예: 시각적 회귀 메모)는 yaml에
`legacy: true`로 escape한다. 형식 검사 회피 수단으로 쓰지 않는다.

### 검증

`mc:validate-story-chain`이 review-parser를 호출. 형식 위반이면 fail.

### Source Promise owner boundary

2026-07-22부터 작성한 새 review entry는 해당 Evidence Ledger의
`Source Promises`가 소유한 Acceptance Check와 Intent Check만 YAML `acs`에
넣는다. 다른 owner의 영향은 prose에서 관련 ledger를 가리킬 수 있지만, 그
owner의 AC revision과 verdict는 owning ledger가 검토한다.

이 검사는 ref와 Source Promise 관계를 결정적으로 판정할 수 있으므로 blocking
Story Chain graph gate다. 기존 cutoff 이전의 dated review는 당시 evidence를
보존하는 history이므로 다시 작성하지 않는다. 파일 수, 변경 줄 수, cleanup
분리처럼 맥락 판단이 필요한 propagation budget은 이 gate에 넣지 않는다.

---

## 4. Revision drift signal — detection + snapshot + admin board

### 무엇을 잡나

AC `revision`은 2로 올라갔지만 마지막 review entry의 `acReviewedRevision`은
1인 상태를 잡는다. AC 의미가 review를 추월했다는 뜻이다. review가 stale 상태다.
PR gate는 차단하지 않는다 (soft signal). 운영자가 Mission Control CLI에서 본다.

### 왜 필요한가

revision을 올려도 review가 자동으로 따라오지 않는다. 사람이 review를 추가하거나
갱신해야 한다. 이걸 잊으면 stale 상태가 누적된다. drift detection이 자동으로
신호를 만들어 운영자에게 보여 준다.

### 작동 방식 (3 layer)

1. **Detection (helper)** — `app/server/services/story-chain/revision-drift.ts`의
   `detectRevisionDrift`가 promise의 ACs와 review entries를 받아 stale 신호를
   배열로 반환. 순수 함수, 단위 테스트.
2. **Snapshot (classify)** — `intent-traceability-revision-drift.ts`의
   `buildRevisionDriftIndex`가 promise 단위로 그루핑 → `classifyStage`가 drift
   있으면 stage를 `verify`로 강제 (review verdict가 met이어도 우선).
3. **CLI (read)** — `mc:status`와 `mc:next`가 stale revision을 가진 row를
   `verify` 대상으로 표시한다.

### 사례

```
[verify · review verdict: met · stale 1건]
revision drift 1건 — review 이후 AC 갱신
acceptance-check:foo-bar-ac1 (rev 2 vs review 1 @ 2026-04-22)
```

운영자는 CLI 출력으로 AC 의미가 바뀌었음을 인지하고 새 review entry를 yaml
schema로 작성한다.

### 검증

- `revision-drift.test.ts` (helper 단위)
- `intent-traceability-snapshot-drift.test.ts` (snapshot 그루핑)
- `intent-traceability-snapshot.test.ts` (chain-with-no-drift wiring pin)

---

## 5. Mutation testing — Stryker

### 무엇을 잡나

vitest는 통과하지만 본문 자체가 tautology인 경우를 잡는다. 가장 흔한 함정은
아래와 같다.

```ts
// ❌ tautological — 통과하지만 아무것도 검증하지 않음
expect(true).toBe(true);

// ❌ 거의 tautological — 같은 schema를 테스트 안에서 재구성
const testSchema = z.object({ title: z.string().max(30) });
expect(testSchema.safeParse({ title: "a".repeat(31) }).success).toBe(false);
// 진짜 schema가 max(30)에서 max(40)로 바뀌어도 이 테스트는 알지 못한다.

// ✅ 진짜 schema를 직접 테스트
expect(respondToolInputSchema.safeParse({ title: "a".repeat(31) }).success).toBe(false);
```

mutation testing은 source code를 조금씩 변형한 다음 테스트가 fail하는지를
확인한다. 변형 예: `max(30)` → `min(30)`, `return true` → `return false`, regex
한 글자 변경. fail하면 mutant *killed*다. 통과하면 *survived*다. survived가
많으면 테스트가 코드 변경에 둔감하다는 신호다. 그 자리에 tautology가 숨어 있을
가능성이 높다.

### 작동 방식

- 도구: Stryker (`@stryker-mutator/core` + `@stryker-mutator/vitest-runner`).
- 첫 pilot ledger: retired `respond-contract` marker였다. 현재 agent slice는
  route-view AI comment generation 파일들을 대상으로 한다. 이후
  agent / contracts / domain / research-route slice로 확대됐다.
- threshold: slice별 `stryker.*.config.mjs`의 `thresholds.break`에 박혀 있다.
  ledger의 §"Hardening Tier"와 어긋나지 않도록 drift 방지 테스트가 강제한다.
- 실행: `npm run mutation:all`이 slice를 순서대로 실행한다. 좁은 로컬 확인은
  `npm run mutation:agent` 같은 slice별 명령을 쓴다.
- CI: `.github/workflows/mutation.yml`은 `workflow_dispatch`만 받는다. 예약, PR,
  push 트리거는 없다. mutation 비용이 PR 시간 예산을 잠식하지 않게 분리했다.
- vitest config: 별도 `vitest.config.mutation.mts`를 만들어 `*.live.test.*`를
  제외한다. 이걸 안 하면 workflow가 `GEMINI_API_KEY`에 의존하고 mutant마다 live
  call 비용이 발생한다. codex review가 첫 commit 직후 이 함정을 잡았다.

### 사례 — pilot이 보여준 것 (2026-05)

첫 full run 점수는 34.07%였다. 살아남은 mutant를 분석하니 기존 테스트가 테스트
안에서 schema를 재구성해 검증하고 있었고, 진짜 `respondToolInputSchema`
export의 boundary는 검증되지 않은 채였다. 진짜 export에 boundary 테스트와
markdown 거부 case를 추가해 57.14%로 올렸다. 남은 survived는 세 종류 —
`.describe()` LLM-prompt 문자열, equivalent regex 변형, cosmetic zod error
path — 로 전부 의도적 비검증이라 거기서 stop했다. 점수 극대화가 아니라 실제
hole 제거가 목적이다.

### Threshold 박는 법

baseline을 먼저 측정한다. 그 점수에서 5~10% 버퍼를 빼서 N을 결정한다. ledger의
§"Hardening Tier"와 slice config의 `thresholds.break`에 같은 N을 동시에
박는다. 두 값이 어긋나지 않도록 drift 방지 테스트가 강제한다.

### 검증

- `respond-contract-mutation-pilot.test.ts` (config wiring + ledger 일치)
- manual CI report: `reports/mutation/<slice>/index.html` (slice별 artifact)

---

## 6. Co-located negative test

### 무엇을 잡나

값 자체가 약속에 들어가는 AC를 잡는다 (예: "정확히 10편"). sibling 테스트가
symbol name만 참조하면 상수 값이 바뀔 때 양쪽이 함께 움직여 false-pass가
발생한다.

```ts
// ❌ tautology
expect(visiblePapers.length).toBe(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT);
// 상수가 10에서 9로 바뀌면 양쪽 다 9가 된다. 테스트는 통과한다. 사용자는
// 9편만 본다.
```

mutation이 커버하지 않는 곳의 이런 구멍은 negative test가 막는다.

### 작동 방식

1. 구현 코드 invariant 라인 위에 마커 주석:
   ```ts
   // @check-removes-fails: acceptance-check:search-results-fast-window-initial-dom-window
   export const SEARCH_RESULTS_INITIAL_VISIBLE_COUNT = 10;
   ```
2. 별도 vitest 파일에서 (a) literal value 직접 잠금, (b) 마커 위치 검증:
   ```ts
   it("SEARCH_RESULTS_INITIAL_VISIBLE_COUNT is literally 10", () => {
     expect(SEARCH_RESULTS_INITIAL_VISIBLE_COUNT).toBe(10);  // literal
   });
   it("constants.ts carries the @check-removes-fails comment above the declaration", () => {
     const source = readFileSync(/* constants.ts */, "utf8");
     const markerIdx = source.indexOf("@check-removes-fails: acceptance-check:search-results-fast-window-initial-dom-window");
     const declarationIdx = source.indexOf("export const SEARCH_RESULTS_INITIAL_VISIBLE_COUNT");
     expect(markerIdx).toBeGreaterThan(-1);
     expect(declarationIdx).toBeGreaterThan(markerIdx);
   });
   ```

이렇게 박으면 다음 셋 중 하나라도 깨질 때 vitest가 fail한다.
- 상수 값 변경 (10 → 9)
- 마커 주석 제거
- 마커가 declaration 아래로 이동

### 적용 상태

첫 적용(2026-05)은 `search-results-fast-window-ac1`("정확히 10편",
`app/lib/__tests__/constants.contract.test.ts`)이었고, 이후 같은 marker 방식이
`app/lib/constants.ts`의 다른 값 약속 상수들로 확산됐다(현재 5개 marker).
적용 ledger의 정본은 정책 문서 `hardening-tier-policy.md` §3이다.

### 검증

- 각 co-located contract test 자체가 검증
- `hardening-tier-policy.md` §3가 적용 ledger 명시 (정책 자체에 대한 vitest)

---

## 어떻게 합쳐서 작동하나

Parser, revision, review schema, negative test는 PR fast path에서 결정적으로
실행한다. Mutation은 비용이 크므로 운영자가 수동으로 선택된 runtime slice를
검증한다.

| 게이트 | 비용 | 잡는 깊이 |
|---|---|---|
| 1, 2, 3 (parser) | <1초 | 형식과 선언 일관성 |
| 4 (drift signal) | <1초 | 메타정보 신선도 |
| 6 (negative test) | <1초 | 값 약속의 함정 |
| 5 (mutation) | 분 단위 | 코드 본문 tautology |

PR gate는 빠르고 재현 가능한 검증만 실행한다. Mutation은 느리지만 실제 코드
변형에 대한 테스트 반응을 확인한다. 두 경로는 같은 결정적 evidence 체계 안에서
서로 다른 깊이를 담당한다.

---

## 일반적인 PR에서 어떻게 흐르나

새 promise를 추가하거나 기존 AC body를 의미적으로 바꾸는 PR을 가정한다.
아래 트리는 흐름 이해용 요약이고, 각 alias의 정확한 구성은 `package.json`이
정본이다.

```
[로컬 작업]
1. Promise / Ledger / Review 파일 수정
2. 코드 변경

[PR push 직전 — 로컬 검증]
3. npm run quality:fast
   ├─ 정적 게이트 (format·lint·type·guards 등)
   ├─ mc:validate-story-chain   ← 게이트 1, 2, 3
   ├─ test:unit                  ← 게이트 6 (값 약속 testfile)
   ├─ evidence-ledger:dry        ← strict YAML graph 및 전 원장 assertion/execution 정합성
   └─ mc:audit-* (surface tags)

[GitHub PR open]
4. .github/workflows/quality.yml CI 시작 (`quality:fast` + build를 책임별 병렬 실행)
   ├─ static job: quality:static
   ├─ test job: test:unit (vitest --shard 1/2, 2/2)
   ├─ build job: build
   ├─ audit job: quality:audit (deps:audit)
   └─ admin board에서 게이트 4 (stale flag)는 운영자 시각 검증

[수동 hardening]
5. .github/workflows/mutation.yml (`workflow_dispatch`)
   └─ Stryker 4개 slice를 matrix로 병렬 실행 ← 게이트 5
   └─ threshold 미달이면 수동 run fail → PR로 보강 작업 트리거
```

### 게이트가 잡지 못한 사례 — codex review (2026-05, mutation pilot 도입 직후)

mutation pilot 첫 commit(85f1a50) 직후 codex review가 Stryker-vitest의
`related` 모드 때문에 live LLM 테스트가 transitive import되어 CI에서 dry run이
fail하는 함정을 발견했다. 이런 config 설정의 운영 함정은 6개 게이트로 잡지
못한다. codex review와 human judgment의 영역이다. 핵심 PR에는 codex review를
추가로 받는다.

---

## 무엇을 잡지 못하나 — 알려진 한계

- **Config·운영 함정**: CI 환경 변수, 도구 설정, workflow wiring의 함정은
  게이트 밖이다. codex review와 human judgment가 담당한다 (위 사례 참고).
- **Property-based fuzz 제한**: deterministic helper와 route level에서만
  우선순위를 검토한다.
- **Mutation·negative test의 적용 범위**: 둘 다 slice/ledger 단위로 옵트인
  확대한다. 적용되지 않은 ledger의 tautology는 여전히 열려 있다. 적용 현황
  정본은 `hardening-tier-policy.md`와 slice config다.

---

## 코드와 정본 위치

| 영역 | 파일 |
|---|---|
| 정책 정본 | `docs/contracts/story-chain/hardening-tier-policy.md` |
| Promise A (schema/parser) | `docs/contracts/story-chain/promises/alignment-coherence-gate.md` |
| Promise B (정책) | `docs/contracts/story-chain/promises/hardening-tier-policy.md` |
| Mutation pilot | `docs/contracts/story-chain/promises/respond-contract-mutation-pilot.md` |
| Drift helper | `app/server/services/story-chain/revision-drift.ts` |
| Snapshot wiring | `scripts/mission-control/lib/intent-traceability-revision-drift.ts` |
| CLI projection | `scripts/mission-control/mc-status.ts`, `scripts/mission-control/mc-next.ts` |
| Stryker config | `stryker.base.mjs`, `stryker.*.config.mjs`, `vitest.config.mutation.mts` |
| Negative test pilot | `app/lib/__tests__/constants.contract.test.ts` |
| Mutation CI | `.github/workflows/mutation.yml` |
| Quality CI | `.github/workflows/quality.yml` |

---

## 새 게이트를 추가하려면

1. `hardening-tier-policy.md`에 발동 정책을 먼저 박는다.
2. 새 Promise를 만들거나 기존 Promise에 AC를 추가한다.
3. Evidence Ledger의 `acceptanceChecks` entry와 구조화 execution에 vitest 경로를 명시한다.
4. 테스트를 작성한다. PR에서 `mc:validate-story-chain`과 `evidence-ledger:dry`가
   통과해야 한다.
5. 본 문서에 새 섹션을 추가하고 한 눈에 표를 업데이트한다.

새 게이트는 작은 ledger부터 시작한다. 모든 ledger에 일괄 적용하지 않는다.
mutation pilot이 `respond.ts` 한 파일에서 시작한 좁은 scope 정신과 같다.
