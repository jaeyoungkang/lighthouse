# Checklist Usage Log Continuation through PR #394 head `1066e927b49d`

이 문서는 checklist usage log의 열두 번째 비정본 역사 archive다. 앞선
296건 archive 뒤 canonical에서 가장 오래된 closed PR #391·#394 whole
cohort 10건을 원래 순서대로 보존한다. 현재 review-closeout 판정과 hit-rate
운영 입력은
`shared-skills/review-checklist-steward/references/checklist-usage-log.md`만
읽는다. 이 파일을 현재 exact-head review authority로 사용하지 않는다.

## Manifest

- compaction source: `a875d562a0ea3a39e246cd44b286aff1c41d70a6`
- previous archive:
  `docs/archive/checklist-usage-log-continuation-through-2026-07-19-pr384-f3b53e5e.md`
- selection: canonical에서 가장 오래된 closed whole cohort인 PR #391의
  reviewer·escape 3건과 PR #394의 reviewer·escape 7건
- open-PR content-head audit: #418 `fd9c8a5a92c2`, #380
  `4165ec105ee8`, #197 `57bdd9b9cabb`; pinned record 0건
- first record:
  `2026-07-19 | escape | pr: #391 | head: a087843729dd`
- last record:
  `2026-07-19T09:05 | repo: jaeyoungkang/lighthouse | pr: #394 | head: 1066e927b49d`
- archived records: 10
- normalized LF payload bytes: 4,680
- archived payload SHA-256:
  `49999d4423c4d902ef24b4a7aa957a6d99089aeeadcf1382caf38a0fdfff9969`
- cumulative archive records: 306
- retained canonical records before the process-review append: 39
- retained canonical payload bytes: 47,493
- retained canonical payload SHA-256:
  `334f2133558ed725164e8b63e2737d4a90f87dfc2a2f703656f5c5fd28e9dbfd`
- original 49-record payload bytes: 52,173
- original 49-record payload SHA-256:
  `af43aa22b631e19d8789b5f0266a2e1532b7f8ba739ba4210af655427467760a`

Payload hash는 아래 `## Entries`의 record만 각 한 줄과 마지막 LF로
직렬화해 계산한다. header와 manifest는 payload hash에 포함하지 않는다.

## Rollback

1. 앞선 archive chain 전체의 payload hash와 누적 306-record count를
   검증한다. 현재 archive 10건/4,680 bytes/hash와 retained canonical
   39건/47,493 bytes/hash도 각각 검증하고 하나라도 다르면 rollback을
   중단한다.
2. retained canonical에서 head `b2f9449a44a5` record 뒤이자 head
   `292cc288eb78` record 앞에 이 archive의 PR #391 첫 3건을 삽입한다.
3. head `292cc288eb78` record 뒤이자 head `2fde3bc7a72d` record 앞에 이
   archive의 PR #394 다음 7건을 삽입한다.
4. 복원한 49건이 52,173 bytes와
   `af43aa22b631e19d8789b5f0266a2e1532b7f8ba739ba4210af655427467760a`
   해시와 일치하지 않으면 rollback을 중단한다.
5. 복원 후 exact-head review와 canonical record-only closeout을 다시
   수행한다.

## Entries

2026-07-19 | escape | pr: #391 | head: a087843729dd | source: coderabbit | classification: valid | finding: a line-leading `#318에` inside the archived measurement report triggered Markdownlint MD018; fixed by keeping the issue reference inside an ordinary Korean sentence without changing the corpus or metrics | entry: none
2026-07-19 | escape | pr: #391 | head: a087843729dd | source: coderabbit | classification: invalid | finding: the archive, report, and usage-log dates are 2026-07-19 KST; the bot compared them with the 2026-07-18 UTC calendar date even though its own 20:31Z review time was 2026-07-19T05:31 KST | entry: none
2026-07-19T05:35 | repo: jaeyoungkang/lighthouse | pr: #391 | head: d76d83392df89a18d52b931300958b9086a63ae3 | role: branch-review-response | surface: CodeRabbit Markdown and date threads, exact KST provenance, report wording, frozen 121-thread disposition integrity, latest-main integration, and exact-head review closeout | applied: root-cause, code, overengineering, skills-governance | excluded: database-load, production server-load, security/privacy runtime, architecture, analytics, UI/loading, runtime-flow, Story Chain meaning: process measurement archive only | hit: none | findings: valid 2, invalid 1, already-fixed 0, duplicate 2, needs-human 0 | validation: one-line report diff; before 44/5/1 and after 44/9/4/5 recount; Human queue 9; targeted Prettier; pk:validate; diff check; independent exact-head rereview clean | closeout: clean | gap: protected remote checks must rerun on the pushed head
2026-07-19 | escape | pr: #394 | head: 2331e39958dc | source: coderabbit | classification: valid | finding: the canonical log called itself absolutely append-only even though governed compaction moves complete historical cohorts; clarified that append-only applies between governed compactions | entry: architecture-15
2026-07-19 | escape | pr: #394 | head: 2331e39958dc | source: coderabbit | classification: valid | finding: the compaction policy did not fail closed when pinned open-PR cohorts alone exceeded 50 records; added unchanged-state and explicit Human-decision requirements with a prose regression | entry: architecture-15
2026-07-19 | escape | pr: #394 | head: 2331e39958dc | source: coderabbit | classification: valid | finding: rollback verified the archive and retained payloads separately but not their ordered reconstruction before later records; added the intermediate 303-record hash gate | entry: architecture-16
2026-07-19 | escape | pr: #394 | head: 2331e39958dc | source: coderabbit | classification: valid | finding: the canonical-only authority regression depended on Git trace implementation details; replaced it with a diagnostic policy contract and a fail-closed combined-argument case | entry: code-04
2026-07-19 | escape | pr: #394 | head: 668a2dd159a4 | source: subagent | classification: valid | finding: the diagnostic policy assertion did not prove that archive records were excluded from the actual parsed-head set; added an archive-only rejection asserting that no parseable canonical records exist | entry: code-04
2026-07-19 | escape | pr: #394 | head: 668a2dd159a4 | source: subagent | classification: valid | finding: combining a real closeout base with diagnostic policy output could exit successfully and bypass the gate; the CLI now rejects the combination and the regression fixes that error path | entry: code-03
2026-07-19T09:05 | repo: jaeyoungkang/lighthouse | pr: #394 | head: 1066e927b49d1b9a60e425d36ce37689f8d7b470 | role: branch-review-response | surface: governed 261-record archive, 42-record retained compaction payload, exact 303-record reconstruction, canonical-only closeout authority, open-PR derived content-head pinning, over-limit fail-closed policy, CodeRabbit and subagent finding corrections, and exact-head capacity closeout | applied: root-cause, code, overengineering, architecture, skills-governance | excluded: database-load, production server-load, security/privacy runtime, analytics, UI/loading, runtime-flow, Story Chain meaning: process archive and quality-gate boundary only | hit: code-03, code-04, architecture-15, architecture-16, skills-governance-03 | findings: valid 0, invalid 0, already-fixed 7, duplicate 0, needs-human 0 | validation: archive 261 records and SHA-256 e8787bbd; retained 42 records and SHA-256 34c897c2; reconstructed 303 records and SHA-256 3f8ca6d1; targeted review-closeout 8/8; typecheck; guard:skills; format; Mission Control; quality:fast with 295 files and 2061 tests; two independent exact-head reviews clean; diff and worktree checks | closeout: clean | gap: protected CI and remote review threads must confirm the pushed head
