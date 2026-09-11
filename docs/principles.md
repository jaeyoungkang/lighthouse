---
type: design
---

# Light House — 구현 원리

이 문서는 현재 Light House 런타임을 설명하는 설계 원칙만 남긴다. 더 이상 쓰지 않는 아키텍처 슬로건이나 폐기된 추상화는 포함하지 않는다.

Light House가 닫는 의도는 연구자가 논문을 찾고, 읽고, 비교하고, 연구 질문을
좁히는 일을 돕는 의도다. Release verdict는 그 의도가 실제 제품 동작으로
증명됐는지 검증한다. Augment Layer는 그 의도가 어떤 사용자 기대와 외부 연구
세계 위에서 의미를 갖는지 설명한다. 두 차원은 서로를 대체하지 않는다. 이
문서의 §0~§6은 release verdict의 정합성을 다루며, Augment Layer의 정합성은
`docs/augment-layer.md`가 정본이다.

## 0. 핵심 철학 — 검증되지 않은 의도는 출시하지 않는다

Light House는 "기능이 동작한다"가 아니라 **"선언한 사용자 의도가 실제로 달성된다"**를 제품의 완료 기준으로 삼는다. Intent Check verdict가 `met`으로 닫히지 않은 UI는 production에 나가지 않는다 — `not-met`과 `unknown`은 둘 다 blocking이다. evaluator가 돌지 않거나 production-equivalent evidence가 부족하면 verdict는 `unknown`이며, 이는 중립이 아닌 blocking verdict다.

검증 대상은 실제 runtime 출력이다. 허용 경로는 둘뿐 — (a) active response channel이나 route-view structured generation 경로가 만든 실제 AI response output, 또는 (b) 실 UI 컴포넌트가 렌더한 DOM. simulation 래퍼·meta-persona(`"너는 시뮬레이션이다"` 류)로 LLM을 직접 찌른 결과나 production 경로 밖에서 프롬프트 조각을 재조합해 얻은 LLM 반응은 검증으로 인정하지 않는다 — 사용자가 보는 것과 다른 산출물이기 때문이다. "real runtime과 동등한 출력 검증은 out-of-scope" 같은 Reject도 사유로 인정하지 않는다.

**Intent Check는 Acceptance Check 위에 형성된 review layer다. cascade는 Acceptance Check → Intent Check 방향이다.** Acceptance Check가 의도를 닫는지 묻는 질문이 Intent Check이지 Intent Check가 Acceptance Check를 만드는 게 아니다. 그래서 Acceptance Check를 수정·삭제하면 그 Acceptance Check에 흡수되었거나 linked로 가리키는 Intent Check가 stale로 깨질 수 있다. 모든 변경(추가·수정·철회)은 시작 전에 sibling Promise·Aspect appliesTo·Evidence Ledger 공유·코드 surface·live judge 공유까지 함께 검토해야 한다.

이 게이트는 타협 대상이 아니다. 형식과 템플릿(Intent Check 필드, Sufficiency Review, Boundary Failure / Capacity Adequacy)은 `docs/intent-traceability.md`, 운영 절차(4-authority, verdict trichotomy, retirement)는 `docs/mission-control.md` + Mission Control 스킬이 정본이다.

## 0.1 Release semantics — Intent · Acceptance Check trace · Service Policy Coverage · Aspect의 합

§0의 "검증되지 않은 의도는 출시하지 않는다"는 한 차원이 아니라 **네 차원의 합**이다. Promise 축 2차원, 서비스 구성 축 1차원, Aspect 축 1차원이다.

- **Intent verdict** — Intent Check Sufficiency Review의 met / not-met / unknown. "약속이 실제 runtime에서 달성되는가."
- **Acceptance Check trace** — 한 Acceptance Check가 다음 4-edge chain으로 모두 닫혀 있는가:
  1. Promise Acceptance Check (`docs/contracts/story-chain/promises/<slug>.md`의 `### acceptance-check:` 블록)
  2. ↔ YAML Evidence Ledger의 완전한 `acceptanceChecks[].key` (cross-reference 양방향 — `missing_ac_ledger` / `stale_ac_reference` finding이 깨짐을 잡는다)
  3. ↔ 같은 entry의 `executionRefs[]`와 동일 원장의 구조화 execution
  4. ↔ 실재하는 test/contract-check/guard target과 테스트·헬퍼가 실제 `app/` import까지 닿는지

- **Service Policy Coverage** — core-product Experience가 사용자 경험 문장에 드러나지 않는 서비스 최소 정책까지 조사하고 canonical owner를 정했는가. `unresolved` row가 하나라도 남으면 이 차원은 blocked다.
- **Aspect** — 모든 `kind: aspect`의 own verdict가 covering spec Sufficiency Review의 aspectRef 명시 최신 dated entry에서 met인가. Aspect는 횡단관심사라 Promise와 같은 chain으로 표현되지 않으며 별도 차원이 필요하다. `aspect_verdict_unverified` / `aspect_verdict_not_met` / `aspect_verdict_unknown` finding이 깨짐을 잡는다.

네 차원은 서로를 대체하지 않는다. Intent Check가 `met`이어도 Acceptance Check trace가 missing이면 "약속의 표현 자체가 stale"이고, run evidence가 실제 `app/` import까지 닿지 못하면 trace의 마지막 edge가 끊긴 것이다. Promise 차원이 모두 green이어도 Service Policy Coverage가 unresolved이거나 Aspect가 not-met이면 release하지 않는다.

### Release verdict — zero-critical semantics

**Release verdict := Intent verdict (met) ∧ Acceptance Check trace (zero critical) ∧ Service Policy Coverage (complete) ∧ Aspect (met).**

Acceptance Check trace는 현재 alignment snapshot의 critical finding이 0개일 때만 green이다.
기존 baseline debt와 신규 critical을 구분하지 않는다. baseline 채무가 0으로 청산된 뒤에는
critical finding 하나가 곧 release blocking이다. warning은 운영 신호로 표시하지만 release를
막지 않는다.

이전 baseline 파일은 더 이상 release semantics의 일부가 아니다. 정식 게이트 이름은
`mc:check-critical-findings`다.

### 항상 분리 표시 — 결합된 한 줄로 환원하지 않는다

`mc:status` · 내부 admin surface · CI 출력은 결합된 release verdict 한 줄만 노출하지 않는다. 디버깅 가능성을 위해 **네 차원 + 결합 verdict를 항상 분리**한다.

```
Intent verdict: met
AC trace:      blocked  (3 critical)
Policy coverage: blocked (0/1 complete · 1 unresolved)
Aspect:        12/12 met
Release:       blocked
```

"release blocked" 답만 남기면 어느 차원이 깨졌는지 알 수 없다. 내부 모델은 분리, 게이트는 통합.

## 0.2 신뢰성 기준 — 데이터 소스와 근거가 사용자에게 보여야 한다

Light House의 신뢰성은 기능이 맞는 답을 내는 것만으로 닫히지 않는다. 사용자가
그 답이나 검색 결과가 어떤 데이터 소스에서 왔고, 왜 그 소스를 신뢰할 수 있으며,
어디까지가 소스의 한계인지 이해할 수 있어야 한다.

특히 검색과 AI 반응 surface는 다음 질문에 답해야 한다.

- 이 결과는 어떤 provider, 문서, metadata, citation graph, loaded result set에
  근거하는가.
- 현재 query, sort, filter, 선택 문서, visible metadata 중 무엇이 판단에
  반영됐는가.
- 사용자가 모를 수 있는 provider 이름을 설명 없이 신뢰 근거처럼 쓰고 있지 않은가.
- AI가 새 논문을 추천하거나 생성한 것처럼 보이지 않고, 지금 화면에 보이는 결과
  문맥과 데이터 소스에 반응한다는 점이 드러나는가.
- source가 부족하거나 abstract, reference, citation, PDF 접근에 한계가 있을 때
  그 한계를 짧게 드러내는가.

이 기준은 새로운 guard를 계속 추가하라는 뜻이 아니다. 이미 갖춘
결과-grounded 작동 방식이 사용자에게 읽히는지 확인하는 제품 개발 기준이다.
구현자는 UI copy, 정보 구조, Evidence Ledger, 테스트를 통해 사용자가 데이터 소스와
근거를 이해할 수 있는지 검증해야 한다.

### Generated artifact 정책

- `docs/contracts/story-chain/evidence-ledgers/*.ledger.yaml`은 정본이다.
  HTML/JSON report는 현재 검증 체계의 일부가 아니다. 사람은 `mc:status`에서
  상태를 읽고, agent와 CI는 Evidence Ledger 파일과 runner exit code를 직접
  읽는다. alignment audit은 checked-in report freshness에 의존하지 않는다 —
  검증을 돌릴수록 worktree가 dirty해지는 역방향 운영을 차단하기 위함이다.
  PR 기본 CI는 `evidence-ledger:dry`로 모든 structured execution evidence가 안전한
  allowlist 안에서 파싱 가능한지 검증한다. schedule 또는
  `workflow_dispatch(full=true)`의 full CI는 `evidence-ledger`를 실행해 같은
  evidence를 실제로 돌린다.

### 정본

- 운영 절차: `docs/mission-control.md` (verdict trichotomy + Release verdict)
- 검증 코드: `scripts/mission-control/mc-check-critical-findings.ts` · `scripts/mission-control/lib/alignment-audit.ts` · `scripts/mission-control/lib/release-verdict.ts` (4-component compute) · `scripts/mission-control/lib/aspect-verdict.ts` (Aspect 차원)
- critical-zero Promise group: `experience:operator-alignment-audit`
- Aspect 차원 1급 시민 통합: `promise:release-verdict-aspect-integration`
- 품질 게이트 profile: `package.json`의 `quality:commit`, `quality:fast`,
  `quality:contract`, `quality:full`

## 0.3 화면 설계 계약 — 관계와 조작 가능성이 먼저 읽혀야 한다

사용자-facing 화면은 정보 구조와 조작 가능성이 먼저 읽혀야 한다. 이 절은
개별 컴포넌트 스타일 가이드가 아니라 Promise와 Aspect가 UI evidence를
판정할 때 참조하는 상위 설계 계약이다.

- **관련된 것은 시각적으로 묶는다.** 같은 데이터를 제어하거나 설명하는
  요소는 그 데이터의 컨테이너 안에 둔다. 예를 들어 어떤 분포를 설명하는
  상태 라벨은 분포 박스의 바깥 장식이 아니라 그 박스의 헤더나 본문에
  속해야 한다.
- **떠올리게 하지 말고 보여준다.** 선택지가 정해진 값이면 자유 입력보다
  선택 UI를 우선한다. 검색 결과에 이미 존재하는 연도, 정렬 기준, 성향처럼
  유한한 값은 사용자가 직접 기억해 입력하게 하지 않는다.
- **액션과 상태는 시각 언어가 달라야 한다.** 사용자가 조작하는 것은
  버튼·탭·드롭다운처럼 조작 가능하게 보이고, 시스템이 보여주는 상태나
  라벨은 평평한 칩·배지처럼 보인다. 상태 라벨을 세그먼티드 컨트롤처럼
  보이게 만들지 않는다.
- **같은 역할은 같은 패턴으로 표현한다.** 필터·정렬·전환처럼 같은 역할의
  요소는 같은 컴포넌트 패턴을 쓴다. 같은 줄에서 하나는 드롭다운, 하나는
  텍스트 입력처럼 섞는 방식은 피한다.

## 1. 현재 route view가 우선이다

Light House는 자유 대화형 챗봇보다 Search-first research route에 가깝다.

- 에이전트는 현재 route view와 visible snapshot을 기준으로 행동한다.
- `[system]` 이벤트는 "무슨 일이 방금 일어났는가"를 알려주는 입력이다.
- 응답은 추상적인 잡담보다 현재 연구 view에서 바로 이어지는 다음 행동을 우선한다.

## 2. 영속 산출물은 명시된 artifact로만 만든다

검색·인용 계보·비슷한 논문은 URL 조건의 route view로 실행되고 저장 문서를 만들지 않는다. 현재 저장 artifact는 연구 공백 리포트(`gap_reports`)와 내부 라이브러리 상태(`reviewed_papers`)처럼 명시된 도메인 계약으로만 만든다. 현재 운영 중인 타입과 새 artifact 추가 절차는 `docs/product-identity.md`의 제품 모델 + conventions.md §5가 정본으로 관리한다.

## 3. 가시 응답은 현재 맥락에 묶인 구조화된 반응이다

사용자에게 보이는 AI response channel은 active runtime 경계가 소유하며, 현재 route-view 자동 반응 생성은 `POST /api/route-ai-comments/generate/:viewId` structured generation으로 새 탐색을 벌이지 않고 현재 맥락에 묶인 반응을 만든다. 현재 route view는 최신 AI 반응 snapshot 한 개를 소유한다. 응답 포맷의 한도(글자 수·surface 종류·깊이)와 route view당 반응 수의 정확한 의미는 Story Chain, Evidence Ledger, `docs/product-identity.md`의 AI response channel 설명, `docs/runtime-flows/ai-response-generation.md`의 처리 순서가 함께 잠근다.

## 4. Next.js 경계를 존중한다

웹 프레임워크가 제공하는 경계는 우회하지 않는다.

- App Router의 파일 규칙을 따른다
- Server Component를 기본값으로 둔다
- Client Component는 상호작용, 브라우저 API, 로컬 상태가 필요한 곳에만 둔다
- 서버에서 클라이언트로 넘기는 값은 직렬화 가능해야 한다

구체적인 Route Handler 배치와 import 규칙은 `docs/conventions.md` §1~§3이
소유한다.

## 5. 데이터 접근 경계는 명시적으로 유지한다

소유권 검증, 저장 형식, 예외 처리 위치가 분명해지도록 page/route/server entrypoint → domain-access → service/repository의 계층화된 경계를 유지한다. 구체 layer 이름·디렉토리·`Owned*`/`*ForTrustedAgent`/`*Unchecked` naming 규칙은 conventions.md §3-§4가 정본이다.

DB 접근 경계는 import 위치만의 문제가 아니다. 구현자는 DB read/write를 새로 넣거나
route/runtime hot path로 옮기기 전에 그 데이터의 source owner와 읽는 시점을 결정해야
한다. live DB read가 필요한지, 미리 준비한 snapshot이나 cache를 써야 하는지, background
sync로 미룰 수 있는지 먼저 비교한다. hot path에 DB 접근을 남길 때는 freshness,
invalidation, fallback, 거부한 대안을 작업 기록이나 해당 계약 문서에 남긴다.

## 6. Abstraction reduction over guard accumulation

abstraction 모양 위반이 발견되면 회귀 case와 금지 advice를 추가하기 전에
abstraction 자체를 줄일 수 있는지 검토한다. 잘못된 경계를 test, Aspect, spec의
부정형 규칙으로 둘러싸면 현재 의미보다 퇴역한 모양이 더 오래 남는다. layer가 왜
존재하는지 먼저 확인한다. 존재 이유가 약하면 layer를 제거하고 guard를 추가하지
않는다. 구조를 정합하게 만들어 금지하려던 상태를 표현할 수 없게 하는 것이
우선이다.

부정형 규칙이 필요할 때는 허용하는 행동과 current owner를 먼저 쓴다. 그 뒤에
absence 자체가 safety, privacy, security, source-of-truth, compatibility, 비간섭,
증명 한계를 구성하는지 확인한다. 그렇지 않으면 구현 메커니즘과 퇴역 이력은 해당
runtime, evidence, history owner로 이동하고, 정확한 옛 이름의 부재만 확인하는
assertion은 현재 behavior, capability, state transition 증거로 바꾸거나 제거한다.
구체적인 counterexample과 위반 피해를 설명하지 못하는 새 부정형은 추가하지 않는다.

누적 경로인 forward 회귀 lock, 타입 invariant, property test는 abstraction
reduction이 불가능하거나 충분하지 않다는 판단 뒤의 fallback이다. 계약 작업의
분류·결정 트리는
`shared-skills/mission-control/references/abstraction-reduction-triage.md`가
소유한다. 변경된 current-authority 부정형의 공통 review 분류는
`review-checklist-steward`의 `root-cause-09`가 소유한다.
