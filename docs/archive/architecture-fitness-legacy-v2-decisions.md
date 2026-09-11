# Architecture Fitness legacy-v2 결정 요약

이 문서는 Architecture Fitness v0.4 이전 파일럿의 Human decision만 보존하는
읽기 전용 요약이다. 현재 policy, observation, evaluator, merge eligibility의
정본이 아니며 현재 판정을 만들 때 입력으로 사용하지 않는다.

## 이관 결정

Issue #353은 `docs/architecture-fitness/pilots/legacy-v2/`의 26개 파일 6,646행을
이 요약으로 압축하고 원본을 현재 트리에서 제거하기로 결정했다. 원본은 실행
경로와 검증 게이트에서 참조되지 않았고, 현재 Architecture Fitness 문서의 읽기
표면만 키우고 있었다.

전체 원본이 마지막으로 존재한 revision은
`04ced5e421f9994ae1db3f6511326dc9d1062969`다. 당시 파일 목록과 내용을 확인하려면
다음 명령을 사용한다.

```bash
git ls-tree -r 04ced5e421f9994ae1db3f6511326dc9d1062969 \
  docs/architecture-fitness/pilots/legacy-v2
git show 04ced5e421f9994ae1db3f6511326dc9d1062969:\
docs/architecture-fitness/pilots/legacy-v2/issue-276.report.md
```

## 보존한 결정

| Issue | 당시 대상 revision | Capability | CAIR | Human decision | 당시 판정의 한계 |
| --- | --- | --- | --- | --- | --- |
| #276 | `92b8658286bcd30a53e18d7f313ba1e013ac02a5` | URL-owned search | `constrain-existing` | `evidence-needed` | 구현 정합성은 `healthy`였지만 decision fitness와 process effectiveness는 `unknown`이었다. |
| #278 | `c7fb125b3039138c2a720bdddf76b8076c27d7b0` | least-authority policy boundaries | `constrain-existing` | `reshape` | 구조 수정 뒤 conformance와 decision fitness는 `healthy`였고 process effectiveness는 `unknown`이었다. |
| #283 | `4c2f63abf5357c07386e385598ddcd73f2eb3b65` | Gap shared-artifact authority | `reshape` | `reshape` | 구현 정합성은 `healthy`였지만 운영 규모·retention·cache/lease와 process effectiveness는 `unknown`이었다. |
| #285 | `92b8658286bcd30a53e18d7f313ba1e013ac02a5` | route AI comment snapshot exact match | `constrain-existing` | `keep` | 구현 정합성은 `healthy`였지만 비용·지연·재생성 빈도와 process effectiveness는 `unknown`이었다. |

### Issue #278 baseline

Issue #278의 별도 baseline revision은
`2066f24671d2f24d89c59359888df19f8befb89d`다. 당시 CAIR는
`constrain-existing`, Human decision은 `evidence-needed`였으며, 수정 뒤의 최종
Human decision `reshape`와 구분해 보존한다.

| Case | Baseline | 수정 후 |
| --- | --- | --- |
| Current behavior | `healthy` | `healthy` |
| Least-authority | `degraded + unknown` | `healthy` |
| Decision fitness | `degraded + unknown` | `healthy` |
| Process effectiveness | `unknown` | `unknown` |

이 before/after는 당시 구조 수정의 결과이며 현재 코드 revision의 conformance를
보증하지 않는다.

## 현재 해석 경계

- `evidence-needed`, `reshape`, `keep`은 당시 Human decision으로만 보존한다.
- 당시 report의 재실행 명령과 v2 assessment·merge verdict는 은퇴했으며 실행하지
  않는다.
- 현재 지원되는 lens와 판정은 `docs/architecture-fitness/README.md`가 가리키는
  v0.9.1 policy, observation, collector와 protected attestation이 소유한다.
- 현재 실행 계약이 제공하지 않는 coverage를 과거 파일로 다시 `healthy`라고
  주장하지 않는다. 관측되지 않은 범위는 계속 `unknown`과 Human 판단으로 남긴다.
