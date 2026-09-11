# Hardening Tier 발동 정책

이 문서는 Light House의 Evidence Ledger가 mutation testing, co-located
negative test, property-based fixture 중 어느 것을 추가해야 하는지에 대한
발동 정책을 담는다. `promise:hardening-tier-policy`의 정본이다.

## 1. Critical-path AC 정의

Critical-path Acceptance Check는 다음 조건을 *모두* 만족하는 AC다.

- invariant가 한 줄에 박혀 있다 — assertion이 단일 boolean/숫자/존재 여부로
  표현되며, 주변 산문 없이 그 줄만 보고도 무엇이 깨지는지 안다.
- 깨지면 사용자가 즉시 다친다 — 데이터 손실, 보안 경계 침범, 정량적
  사용자 약속 (예: "정확히 N편") 위반, 또는 결제·인증 등 한 번 잘못 나가면
  되돌리기 어려운 결과가 나온다.

AC가 *기능 동작*에 가까우면 critical-path가 아니다. 예를 들어 "버튼을
누르면 카드가 추가된다"는 critical-path가 아니지만, "초기 DOM에 정확히
10편이 렌더된다"는 critical-path다. 후자는 N에 대한 정량 약속이므로
값을 직접 고정하는 결정적 evidence가 필요하다.

## 2. Mutation testing 발동 (#1)

Mutation testing은 *critical-path AC가 모인 ledger* 한 곳에 pilot으로
시작한 뒤, 안정화된 slice를 같은 수동 실행 lane에서 넓힌다.

- 적용 pilot: runtime contract slices. 현재 pilot의 wiring과 작동 검증은
  `respond-contract-mutation-pilot.ledger.yaml`가 소유한다. 첫 pilot은
  2026-05-09 GitHub nightly에서 92.31%로 안정성이 확인되었고, 당시 같은
  nightly lane은 route-view AI comment generation + deterministic runtime guard +
  analytics contract / domain-access / research route payload store slice로
  확장되었다. 첫 pilot의 퇴역 artifact identity와 baseline은 현재 동작 owner가
  아니라 mutation pilot ledger가 보존하는 historical evidence다.
- 수동 실행 workflow로 분리한다. 실제 workflow는
  `.github/workflows/mutation.yml`이며 `workflow_dispatch`만 받는다. 예약·PR·push
  실행은 두지 않는다. 이로써 PR 게이트 시간 예산과 mutation 비용을 섞지 않는다.
- ledger row에 `mutationScore: ≥ N%` 표기가 있을 때 그 AC는 mutation tier
  적용 상태로 본다. 첫 baseline marker의 N은 **50%** (2026-05-07 박음 —
  baseline 57.14%에서 7%p 버퍼)였다. expanded runtime slice도 새 baseline이
  안정화될 때까지 **50%**를 유지한다. 2026-05-09 후속 hardening baseline은
  61.87%였고, 2026-05-11 agent slice hardening 후 로컬 score는 72.99%다.
  `ignoreStatic: true`로 runtime-executed mutation에 집중해 실행 비용을
  제어한다. 점수 안정화되면 N을 점진 상향한다 — 매번 ledger와 본 §2를 함께
  갱신한다.
- pilot 안정 후 ledger 단위로 확대한다. 모든 ledger에 일괄 적용하지 않는다.

## 3. Co-located negative test 발동 (#2)

Co-located negative test는 *critical-path 숫자 boundary* AC에 우선 적용한다.

- 적용 (2026-05-07~): `promise:search-results-fast-window` AC1
  ("정확히 10편"), 잠금 위치 `search-result-window` ledger —
  `app/lib/__tests__/constants.contract.test.ts`가 literal `10`과
  `@check-removes-fails: <ac-slug>` 마커 위치를 잠근다. 추가 후보:
  document cap, payload size limit 같이 *N 자체가 약속에 들어가는* AC.
- 형태: 구현 코드의 invariant 라인 위에 `// @check-removes-fails: <ac-slug>`
  주석을 붙이고, sibling vitest 파일에서 (a) literal value를 직접 `toBe`로
  잠그고 (b) 같은 주석이 그 라인 위에 존재함을 추가로 검증한다. 사이드케이스
  로 `describe.failing` 블록도 허용한다.
- 핵심: sibling 테스트가 *심볼 이름*만 참조하면 (`expect(...).toBe(CONST)`)
  상수와 테스트가 함께 움직여 거짓 통과한다. negative test는 *literal*을
  박아서 그 함정을 차단한다.
- AC slug는 assertion의 축만 나타내므로, 값에 대한 잠금은 negative test가
  담당한다.

## 4. Property-based fixture 발동 (#6)

Property-based fixture는 *deterministic helper 또는 route 레벨* ledger에
우선 적용한다.

- 적용 후보: `citation-lineage.helpers`, route handler vitest 같은
  순수 함수 / 입출력 변환 layer.
- 도입 비용이 낮고, 단일 fixture에 의존하지 않아도 되는 영역이다.
- live LLM judge에는 도입하지 않는다 — 비용 사유. live judge fixture는
  worst-case 1개를 동결하고 dated Sufficiency Review로 회귀를 추적한다.
