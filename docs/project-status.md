# Project Status 운영

이 문서는 GitHub Issue에서 작업 프로세스와 검색 서비스 현황을 반복해서 갱신하는
절차를 소유한다. 현황 tracker는 정본의 최신 상태를 연결하는 projection이다.
Story Chain, Evidence Ledger, runtime-flow, Operational Readiness, child issue의
판정과 완료 기준을 대신하지 않는다.

## 활성 파일럿

| 구분 | Tracker | 기간 | 담당자 |
| --- | --- | --- | --- |
| 작업 프로세스 | [#688](https://github.com/jaeyoungkang/lighthouse/issues/688) | 2026-08-25~2026-09-22 | GitHub assignee |
| 검색 서비스 | [#689](https://github.com/jaeyoungkang/lighthouse/issues/689) | 2026-08-25~2026-09-22 | GitHub assignee |

자동화 설정은 `scripts/project-status/config.json`이 소유한다. 이 파일에는 활성
tracker, 기간, 연결된 child issue, 기계적 수집이 확인할 정본 경로만 둔다. 의미
판정과 현재 상태를 복사해 넣지 않는다.

## 진입 조건

다음 중 하나가 발생하면 이 절차로 진입한다.

- 사용자가 프로젝트 현황, 작업 프로세스 현황, 검색 서비스 현황을 요청한다.
- tracker가 연결한 child issue가 열리거나 닫힌다.
- 관련 PR이 tracker 행의 근거, owner, verdict, 다음 행동을 바꾼다.
- Story Chain release projection, runtime-flow, Operational Readiness 기록 또는
  rollout 판단이 바뀐다.
- tracker의 다음 정기 확인일이 도래한다.

단순 코드 변경이 tracker 행을 바꾸지 않으면 현황 sync를 실행하지 않는다. 관련
여부를 issue 번호나 파일 경로만으로 추정하지 않고, tracker가 설명하는 현재 사실과
다음 행동이 달라지는지 확인한다.

## 갱신 절차

1. 현재 기본 branch head와 작업 중인 exact revision을 확인한다.
2. `npm run project-status -- check`로 활성 tracker 설정과 정본 경로를 검증한다.
   파일럿 기간 전이나 종료일 다음 날에는 이 명령이 실패하므로 먼저 rollover 또는
   종료 처리를 한다.
3. lane별 정본을 읽는다.
   - 작업 프로세스: `docs/agent-skills.md`, Story Chain status, 연결된 process issue
   - 검색 서비스: `docs/product-identity.md`, `docs/runtime-flows/search-mechanism.md`,
     `docs/operational-readiness.md`, `docs/operational-readiness-records.md`, 연결된
     search·provider issue
4. tracker 본문의 의미 행을 현재 정본과 비교한다. 바뀐 행만 수정한다.
5. `npm run project-status -- sync --lane <process|search|all>`을 실행한다. 이 명령은
   GitHub 이슈 본문의 기계적 checkpoint block만 갱신한다. 본문을 쓰기 직전에
   tracker를 다시 읽고 최신 의미 행 위에 기계적 block을 적용한다. main merge
   이후에는 이 sync가 `project-status-checkpoint.yml`로 자동으로 돌므로, 수동
   실행은 의미 행을 고쳤거나 특정 lane만 갱신해야 할 때만 필요하다.
6. 최신 사실과 근거는 본문에 갱신한다. 유지·축소·중단 결정, owner 이관, 실제
   blocker처럼 중요한 의미 변화가 있을 때만 댓글에 바뀐 판단, 근거, 기준 SHA를
   남긴다. SHA·개수·open/closed 동기화만으로는 댓글을 추가하지 않는다.
7. 새 실행이 필요하면 별도 child issue를 만든다. tracker 체크박스나 댓글을 독립
   backlog로 사용하지 않는다.

`sync`는 `GITHUB_TOKEN` 또는 `GH_TOKEN`이 필요하다. 외부 mutation 권한이 없는
읽기 전용 작업에서는 `npm run project-status -- dry-run --lane <lane>`으로 차이를
확인하고, 적용하지 못한 이유와 다음 owner를 handoff에 남긴다.

## 자동화 경계

`scripts/project-status/checkpoint.mjs`는 다음 사실만 계산한다.

- 기본 branch exact SHA
- 열린 issue 수와 process tracker용 분류 개수
- 설정에 등록된 child issue의 open/closed 상태와 갱신 시각
- tracker label, assignee, milestone, marker 구조

스크립트는 Promise, Architecture Fitness, Operational Readiness, review closeout의
verdict를 계산하거나 번역하지 않는다. tracker의 의미 행도 자동으로 고치지 않는다.
근거가 없으면 기존 `unknown` 또는 `evidence-needed`를 유지한다.

자동 sync는 댓글을 조회하거나 생성하지 않는다. 기계적 실행 결과는 CLI 출력과
Actions 실행 기록에서 확인하고, 기준 revision의 변경 이력은 Git에서 찾는다. 기존
checkpoint 댓글과 의미 판단 댓글은 과거 기록으로 보존한다.

`.github/workflows/project-status-checkpoint.yml`은 `main` push 후 자동으로 기계적
checkpoint block을 sync하며, 수동 `workflow_dispatch`도 그대로 지원한다. tracker
period 밖이면 `project-status -- check`가 exit 2를 내고 push 실행은 그 경우에만 skip한다.
설정 오류 같은 다른 check 실패는 push에서도 job 실패로 표면화한다. 저장소는 GitHub Actions `schedule` trigger를 여전히 금지하므로
정기 실행을 암묵적으로 추가하지 않는다. 정기 확인은 tracker assignee가 실행한다. schedule 정책을 바꾸려면
`docs/ci-structure.md`의 기존 Human 결정과 blocking gate를 별도 process-governance
작업에서 다시 연다.

## 변화 기반 구조 Snapshot

작업 프로세스 tracker는 `structural-audit`의 실행 시점을 투영한다.
`quality:fast`와 CI `quality:static`은 committed base와 `HEAD`의 normalized import
graph, structural policy, tooling fingerprint를 비교한다. 변화가 확인되면 tracker는
merge된 exact `main`의 snapshot 보존을 다음 행동으로 투영한다. 주간 checkpoint와
무조건적인 월간 snapshot은 실행하지 않는다.

snapshot 실행 직전에 `git fetch origin main`으로 기준 ref를 갱신한다. fetch에
실패하면 오래된 ref로 계속하지 않는다. PR branch가 아니라 exact `main`에서
fingerprint당 한 번 보존한다. 한 분기에 변화 기반 snapshot이 하나도 없으면
기계적 baseline을 한 번 남긴다. 여러 구조 변경이 한꺼번에 닫힌 wave 직후에는
5단계 전체 감사를 우선한다. 한 분기 동안 전체 감사가 없으면 baseline과 함께 지목
파일 정독과 불일치 triage를 실행한다.

snapshot bundle의 생성·비교·보존 계약은 `structural-audit` skill이 소유하고,
dated record와 dataset은 Moonlight Project Knowledge
[`research/lighthouse-structural-audit/`](https://github.com/corca-ai/moonlight-project-knowledge/blob/b3a172f6ce61d5ba2ad7193d9ed7baf9dafde54e/research/lighthouse-structural-audit/2026-09-01-change-triggered-snapshot-contract.md)가
소유한다. 2026-09-01 변화 기반 cadence 결정은 이 commit 고정 record를 기준으로
읽는다. tracker는 latest revision, record 링크, 다음 trigger만 투영하며
SCC·unreachable·cross-zone 수치를 verdict나 health score로 번역하지 않는다.
CI detector는 trigger만 계산한다. snapshot 보존은 수동 operator command이며
GitHub Actions schedule이나 release gate가 아니다.

## 파일럿 종료와 rollover

종료일에는 두 tracker에 마지막 의미 projection, 누락된 갱신, 주간 수동 비용,
drift, child issue 연결 완전성을 기록한다. Human이 `유지`, `축소`, `중단` 중 하나를
결정한다.

유지할 때는 다음 기간 tracker를 먼저 만든다. 그 뒤 `config.json`의 issue 번호와
기간을 바꾸고 `npm run project-status -- check`와 dry-run을 실행한다. 이전 tracker는
마지막 댓글에서 다음 tracker를 연결한 뒤 닫는다. 열린 tracker가 없는 기간을 만들거나
두 기간의 tracker를 동시에 활성화하지 않는다.

## 검증

```bash
npm run project-status -- check
npx vitest run scripts/project-status/__tests__/checkpoint.test.ts
npm run guard:gate-parity
npm run format:check
```

GitHub에 적용할 때는 먼저 읽기 전용 결과를 확인한다.

```bash
npm run project-status -- dry-run --lane all
npm run project-status -- sync --lane all
```
