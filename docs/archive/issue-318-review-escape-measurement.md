# Issue #318 review escape 측정 closeout

이 문서는 issue #318의 마지막 완료 기준인 before/after review escape 측정을
보존한다. CodeRabbit은 내부 review closeout의 권위가 아니다. 이 측정에서는
내부 리뷰가 놓친 finding을 사후에 발견하는 외부 escape source로만 사용한다.

측정일은 2026-07-19이다. GitHub pull request와 review thread의 상태를 이 날짜에
다시 읽고, 각 initial CodeRabbit thread를 `valid`, `invalid`,
`already-fixed`, `duplicate`, `needs-human-decision` 중 하나로 분류했다.

## Corpus

Before corpus는 issue #318 조사에 적힌 `22 PR / 9 affected / 51 threads`를
GitHub merge 이력으로 재구성했다. 시간 경계와 PR 집합을 함께 고정했으며,
GraphQL 전수 결과가 원래 집계와 정확히 일치했다.

- 시간 경계: `2026-07-13T04:13:36Z` 이상,
  `2026-07-15T01:00:15Z` 이하
- PR 22개:
  `#288, #289, #290, #291, #292, #293, #296, #299, #300, #301, #302, #303, #308, #310, #309, #312, #313, #314, #315, #316, #317, #311`

After corpus는 branch protection 활성화 시각인
`2026-07-15T03:17:17Z` 이후 merge된 첫 30개 PR이다. 임시 workflow가
이슈 #318에 게시한 집합을 그대로 사용했다.

- PR 30개:
  `#331, #332, #328, #333, #334, #335, #336, #337, #339, #340, #341, #360, #361, #363, #362, #365, #364, #366, #367, #369, #368, #370, #371, #372, #373, #374, #377, #378, #376, #375`

## 분류 결과

| 항목                         | Before                  | After                   | 변화       |
| ---------------------------- | ----------------------- | ----------------------- | ---------- |
| PR                           | 22                      | 30                      | —          |
| Initial thread               | 51                      | 70                      | —          |
| Thread가 있는 PR             | 9/22 (40.91%)           | 14/30 (46.67%)          | +5.76%p    |
| Valid                        | 44                      | 44                      | 동일       |
| Invalid                      | 5                       | 9                       | —          |
| Already-fixed                | 1                       | 4                       | —          |
| Duplicate                    | 0                       | 5                       | —          |
| Needs-human-decision         | 1                       | 8                       | —          |
| Raw-thread valid escape rate | 44/51 (86.27%)          | 44/70 (62.86%)          | -23.41%p   |
| 판정 완료 thread valid rate  | 44/50 (88.00%)          | 44/62 (70.97%)          | -17.03%p   |
| False-positive + duplicate   | 5/51 (9.80%)            | 14/70 (20.00%)          | +10.20%p   |
| Valid escape가 있는 PR       | 9/22 (40.91%)           | 9/30 (30.00%)           | -10.91%p   |
| Valid escape/PR              | 44/22 (2.000)           | 44/30 (1.467)           | -26.67%    |
| Valid severity               | C0 / Major32 / Minor12  | C4 / Major24 / Minor16  | —          |

`raw-thread valid escape rate`는 확정된 valid thread를 전체 initial thread로
나눈 값이다. `판정 완료 thread valid rate`는 `needs-human-decision`을
분모에서도 제외한다. `false-positive + duplicate`는 invalid와 duplicate를
합쳐 전체 initial thread로 나눈 값이다.

내부 review의 valid escape 밀도는 감소했다. 반면 false-positive와 duplicate의
비율은 증가했다. After corpus에서는 시간대 해석 오류와 생성된 skill 복사본
중복이 이 증가에 영향을 줬다. Raw thread 수를 defect 수로 해석하면 안 된다.

## Severity와 recall

Issue #318과 checklist 정본에는 severity weight가 정의돼 있지 않다. 내부
review가 merge 전에 잡은 finding도 severity가 일관되게 기록되지 않았다.
따라서 `severity-weighted recall`을 정본성 있는 값으로 계산할 수 없다.

비교를 돕는 비권위 보조값으로 `Critical=3`, `Major=2`, `Minor=1`을 적용하면
valid escape burden은 before와 after가 모두 76이다. Corpus 크기가 다르므로
PR당 burden은 `3.455`에서 `2.533`으로 26.67% 감소했다. 이 값은 recall이
아니며 quality gate나 merge 판정에 사용하지 않는다.

## Exact-head와 false-clean

Before corpus는 `review-closeout` required check 도입 전이다. 당시 exact-head
검증 결과를 사후에 복원할 수 없으므로 before를 `stale`로 판정하지 않는다.
검증 가능한 사실은 exact-head check가 `0/22` PR에만 존재했다는 점이다.

After corpus는 최종 head에서 `review-closeout` check가 `30/30` 성공했다.
따라서 merge-time exact-head check의 missing rate는 `22/22`에서 `0/30`으로
감소했다. 이 값은 자유 산문의 stale-clean 비율이 아니라 gate 적용 범위다.

내부 review 이후 external valid escape가 발견된 PR 비율은 별도로 본다.
Before에는 exact-head check가 없으므로 이 값은 check 이후 escape를 뜻하지
않는다. 이 false-clean proxy는 `9/22 (40.91%)`에서 `9/30 (30.00%)`으로
감소했다. After의 required check는 stale head 병합을 막았지만, 모든 일반 코드
finding을 증명하지는 않는다.

## Human 판정 큐

다음 9개 thread는 제품 의미나 범위 판단이 필요하거나, 답변만으로 분류를
확정할 수 없어 `needs-human-decision`으로 유지한다. 이들을 임의로 valid나
invalid에 포함하지 않았다.

- Before:
  [#311 r3583251592](https://github.com/jaeyoungkang/lighthouse/pull/311#discussion_r3583251592)
- After:
  [#334 r3595244666](https://github.com/jaeyoungkang/lighthouse/pull/334#discussion_r3595244666),
  [#334 r3595244675](https://github.com/jaeyoungkang/lighthouse/pull/334#discussion_r3595244675),
  [#335 r3596553527](https://github.com/jaeyoungkang/lighthouse/pull/335#discussion_r3596553527),
  [#335 r3596553536](https://github.com/jaeyoungkang/lighthouse/pull/335#discussion_r3596553536),
  [#335 r3596553541](https://github.com/jaeyoungkang/lighthouse/pull/335#discussion_r3596553541),
  [#337 r3597532880](https://github.com/jaeyoungkang/lighthouse/pull/337#discussion_r3597532880),
  [#365 r3601450145](https://github.com/jaeyoungkang/lighthouse/pull/365#discussion_r3601450145),
  [#365 r3601450148](https://github.com/jaeyoungkang/lighthouse/pull/365#discussion_r3601450148)

## Thread disposition

Before valid 44개:

- #296: `r3570695477`, `r3570695487`
- #299: `r3574906026`
- #300: `r3575285016`, `r3575285021`, `r3575285036`, `r3575285039`
- #303: `r3575788107`, `r3575788110`, `r3575788117`, `r3575788118`
- #308: `r3576698108`, `r3576698135`, `r3576698146`, `r3576698149`,
  `r3576698153`, `r3576698164`, `r3576698171`, `r3576698176`,
  `r3576698181`, `r3576698183`, `r3576698189`, `r3576698200`,
  `r3576698210`, `r3576698215`, `r3576698221`, `r3576698233`,
  `r3576698242`, `r3576698246`, `r3577487341`
- #309: `r3578187326`
- #313: `r3580302416`, `r3580302435`, `r3580302438`, `r3580302443`
- #316: `r3581422112`
- #311: `r3579478897`, `r3579478910`, `r3579478922`, `r3579478927`,
  `r3579478933`, `r3583251588`, `r3583251596`, `r3583251608`

Before invalid 5개:

- #299: `r3571933995`
- #303: `r3575788114`
- #308: `r3576698159`
- #309: `r3578187319`
- #311: `r3579478917`

Before already-fixed 1개:

- #299: `r3571933976`

After valid 44개:

- #328: `r3584138873`, `r3584138880`, `r3584138884`
- #334: `r3595141392`
- #336: `r3597211054`, `r3597211078`, `r3597211094`, `r3597211101`,
  `r3597211104`
- #339: `r3598121664`, `r3598121678`, `r3598121681`, `r3598121685`,
  `r3598121695`, `r3598121699`, `r3598121702`, `r3598121708`,
  `r3598121714`, `r3598552118`, `r3598552121`, `r3598552128`
- #340: `r3598795814`
- #341: `r3599698213`, `r3599698228`, `r3599698236`, `r3599698238`,
  `r3599698244`, `r3599698248`, `r3599698250`, `r3599698254`,
  `r3599698256`, `r3599740711`
- #364: `r3601028795`, `r3601028799`, `r3601028825`, `r3601028836`
- #368: `r3602487911`, `r3602487927`, `r3602487944`, `r3602487952`,
  `r3602487958`, `r3602487966`, `r3602487981`
- #375: `r3607565562`

After invalid 9개:

- #334: `r3595141371`
- #336: `r3597211049`
- #339: `r3598121689`, `r3598552140`
- #341: `r3599698222`, `r3599698233`
- #361: `r3600334809`
- #375: `r3607565558`, `r3607565560`

After already-fixed 4개:

- #361: `r3600334811`
- #368: `r3602487976`
- #374: `r3604139741`
- #375: `r3607565559`

After duplicate 5개:

- #336: `r3597241434`, `r3597241439`, `r3597241446`
- #339: `r3598121711`
- #368: `r3602487932`

## 재현 경계

GitHub GraphQL의 pull request `reviewThreads(first: 100)`를 전수 조회했다.
CodeRabbit이 작성한 각 thread의 첫 inline comment만 initial thread로 셌다.
Thread 답변, bot의 withdrawn/addressed 표시, 현재 코드, checklist usage log와
branch review 기록을 함께 읽어 disposition을 정했다.

After exact-head check는 각 frozen PR의 `head.sha`를 읽은 다음
`GET /repos/jaeyoungkang/lighthouse/commits/{head.sha}/check-runs`를 조회해
`name == "review-closeout"`이고 `conclusion == "success"`인 run이 있는지
확인했다. Before PR에는 이 check가 아직 없으므로 같은 결과를 소급하지 않았다.

Corpus, thread ID, 분모와 분자를 이 문서에 고정했다. GitHub의 현재 표시가
나중에 바뀌더라도 이 측정의 입력 집합은 바뀌지 않는다. Human 큐의 후속
판정은 별도 escape record로 남기며 이 closeout의 기존 분모를 다시 쓰지
않는다.
