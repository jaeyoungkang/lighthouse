# 살아 있는 Sufficiency Review 보존 리포트

이 문서는 현재
`docs/contracts/story-chain/evidence-ledgers/reviews/*.reviews.md`에 있는
Sufficiency Review 세대의 보존 후보를 읽기 전용으로 계산하는 기준을 정한다.
Issue #520의 Human 결정은 `N=3`을 선택했다. 이 결정은 삭제나 CI 차단을
승인하지 않는다.

## 대상과 세대 단위

리포트는 현재 sidecar 경로의 `*.reviews.md` 파일을 모두 읽는다. 기존
`parseReviewFile`이 인식하는 `#### YYYY-MM-DD` 항목 하나를 물리적 세대
하나로 센다. 날짜가 없는 역사 설명과 문서 머리말은 세대 수에 포함하지 않는다.

세대의 최신 순서는 날짜 내림차순으로 정한다. 같은 날짜에 여러 항목이 있으면
파일에서 뒤에 있는 항목을 더 최신으로 본다. 파일의 마지막 항목과 이 순서의
최신 항목이 다르면 `orderingHazard`로 보고한다.

## 승인된 보존 시나리오

기본 시나리오는 stream마다 최신 세대 3개를 보존한다. 다음 권한 운반자는
3세대 창 밖에 있어도 별도로 보존한다.

- 현재 Evidence Ledger가 소유하고 sidecar가 실제로 인용한 AC와 IC의 최신
  세대
- 현재 Evidence Ledger에 적용된 Aspect를 언급한 최신 세대
- 물리적 마지막 항목을 읽는 현행 consumer가 참조하는 세대
- `product-boundary`와 `runtime-contract`의 모든 세대

과거 `unknown` 또는 `not-met` verdict만으로 세대를 추가 보존하지 않는다.
다만 그 세대가 위 권한 운반자에 해당하면 보존한다. Evidence Ledger와 연결되지
않은 새 sidecar가 나타나면 리포트는 `unmapped`로 표시하고 모든 세대를
보존한다. 소유자가 확인되기 전에는 삭제 후보로 내리지 않는다.

`current-reader-compatibility` 예외는 현행 consumer가 물리적 마지막 항목을
읽는 동안만 유지한다. 현재 해당 reader는
`scripts/mission-control/lib/intent-traceability-snapshot.ts`의
Sufficiency Review 선택 경로다. 이 리포트는 consumer의 선택 방식을 바꾸지
않는다.

## Contract Architecture Impact Review

Contract delta: 살아 있는 Sufficiency Review sidecar의 세대 보존 후보를 날짜
순서와 현재 권한 운반자 기준으로 계산하는 읽기 전용 운영 명령을 추가한다.

Verdict: constrain-existing

Affected axes and current owners: Source of truth and authority; State lifetime
and recovery; Execution semantics; Compatibility and retirement — 기존
sidecar와 Story Chain loader가 정본과 소유권을 유지한다. 기존 review parser가
물리적 세대를 정의한다. 현행 consumer는 각자 현재 선택 방식을 유지한다.

Decision: 새 명령은 기존 parser와 loader를 읽고 계산 결과만 stdout으로 낸다.
기본 보존 창은 `N=3`이다. 현재 AC·IC·Aspect 권한 운반자, 현행 reader 호환
세대, foundational 예외, unmapped owner는 기본 창과 독립적으로 보존한다.

Rejected alternative: 새 archive, manifest, 별도 journal, 보존 상태 파일을
만들지 않는다. Promise retirement와 sidecar owner lifecycle도 바꾸지 않는다.
실제 삭제, sidecar rewrite, consumer 변경, CI 게이트 추가를 이 변경에
포함하지 않는다.

Evidence and structural defense:
`scripts/mission-control/lib/review-retention-report.ts`가 read-only
filesystem import만 사용한다. 단위 테스트는 날짜·동일 날짜 tie·현재 권한
운반자·foundational·unmapped·미해결 역사·입력 불변을 검증한다. CLI는
`policy.mutation`과 `policy.gate`를 `disabled`로 출력하고 알 수 없는 인자를
거부한다.

Human decision required: no

Human이 Issue #520에서 `N=3`, 권한 예외, foundational 예외, 날짜 우선 순서,
report-only 경계를 승인했다. 실제 mutation 또는 gate는 새 Human 결정이
필요하다.

## 2026-07-29 기준선

기준 revision은
`bb8a59a7be7bfb2b7f91e7973e7ad6a1304cc930`이다. sidecar 36개에서 세대
129개를 읽었다. 전체 크기는 3,385줄, 281,863바이트다. 날짜 순서의 최신
항목과 물리적 마지막 항목이 다른 stream은 28개다.

날짜 간격 표본은 84개다. 중앙값은 5일, p75는 12일, p90은 34일, 최댓값은
88일이다. 같은 날 추가된 세대 전환은 9개다.

`unknown` 또는 `not-met` 세대는 1개다. 이 세대는
`ux-writing-voice-and-tone`의 물리적 마지막 항목이므로
`current-reader-compatibility` 예외에 포함된다. 날짜 순서로 선택한 최신
세대의 verdict는 `met`이다.

| N | 기본 보존 | 권한 예외 | 최종 보존 | `would dispose` |
| -: | -: | -: | -: | -: |
| 1 | 36 | 90 | 126 | 3 |
| 2 | 67 | 59 | 126 | 3 |
| **3** | **84** | **42** | **126** | **3** |
| 5 | 105 | 23 | 128 | 1 |
| 10 | 124 | 5 | 129 | 0 |

승인된 `N=3` 시나리오의 `would dispose` 후보는 다음 세 항목이다.

- `ai-comment-research-term-suggestions`의 `2026-06-25#4`
- `inline-analysis`의 `2026-06-09#5`
- `library-grounded-research`의 `2026-07-23#1`

이 목록은 삭제 안전성을 판정하지 않는다. 현재 corpus에서 보존 창과 권한
예외에 들지 않았다는 계산 결과만 나타낸다.

## 실행

사람이 읽는 요약은 다음 명령으로 출력한다.

```bash
npm run mc:review-retention
```

기계가 읽는 전체 stream·세대·예외 정보는 JSON으로 출력한다.

```bash
npm run mc:review-retention -- --json
```

명령은 파일을 수정하지 않는다. `policy.mutation`과 `policy.gate`는 모두
`disabled`이다. revision과 dirty 상태를 함께 출력하므로 결과를 인용할 때는
두 값을 같이 기록한다.

## 다음 checkpoint

실제 삭제 또는 rewrite를 제안하려면 이 리포트로 후보를 다시 계산하고
`orderingHazard`, `current-reader-compatibility`, `unmapped`, 현재 미해결
권한을 먼저 해소해야 한다. 그 뒤 Human이 mutation 범위와 복구 경로를 별도로
승인해야 한다. CI 차단을 제안할 때는 `quality-gate-steward`가 게이트 의미와
비용을 검토한다.
