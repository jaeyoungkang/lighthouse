---
name: structural-audit
description: Use when running or interpreting a Light House whole-repository structural audit, 구조 감사, 정적 import 그래프, static import graph, dependency graph survey, 도달 불가 파일/dead code sweep, SCC·순환 import 점검, cross-boundary type-only import 점검, "머메이드 그래프로 코드 구조를 그려라", periodic architecture drift check from the process tracker, or triaging discrepancies between the source-derived graph and canonical tools (dependency-cruiser, knip). Produces revision-pinned findings routed to issues; it is not a release gate and does not replace deps:boundaries.
compatibility: Claude Code, Codex, Cursor-style agents in the Light House repository.
---

# Structural Audit Skill

Revision 전체의 정적 import 구조를 소스에서 직접 유도해 감사한다. diff 단위
게이트가 못 보는 전역 속성(도달 불가능한 선언, 역방향 엣지, 허브 과적, 연결
없는 평행 구조, canonical 도구 사각지대)을 찾는다.

## Boundaries

- 이 감사는 advisory다. release gate, merge 조건, CI blocking 검증을 만들지
  않는다. enforcement는 canonical 도구(`deps:boundaries`, `deps:unused`,
  `quality:guards`)가 소유하고, 게이트 의미 변경은 `quality-gate-steward`로
  라우팅한다.
- `structural-audit:check`는 committed base와 `HEAD`의 normalized graph,
  structural policy, tooling fingerprint를 비교한다. 비교 ref 부재와 extractor
  실패는 `quality:static`을 차단한다. fingerprint·SCC·unreachable·cross-zone
  변화는 snapshot과 전체 감사의 trigger이며 merge 차단 verdict가 아니다.
- 감사 그래프는 의도적인 독립 재측정이다. canonical 도구 출력에서 그래프를
  생성하지 않고, 도구와의 불일치를 기대 산출물로 triage한다. 감사 그래프를
  두 번째 enforcement 권위로 만들지 않는다.
- 은퇴 shape 발견은 Concept Shift Architecture Review로, 사용자-facing 의미가
  걸린 발견은 Mission Control로 라우팅한다. 발견을 이 skill 안에서 직접
  구현하지 않는다.
- 발견 이슈화 전에 현재 main 기준 재대조로 stale 여부를 확인한다.

## 실행 절차

한 실행은 다섯 단계다. 방법의 정본은 moonlight-project-knowledge의
[`2026-08-28-static-import-graph-audit.md`](https://github.com/corca-ai/moonlight-project-knowledge/blob/1bfb1456ccd9fa67182f7c7c84822e2ac856f8b8/research/lighthouse-structural-audit/2026-08-28-static-import-graph-audit.md)가
소유하고, 실행 이력은 같은 `research/lighthouse-structural-audit/` 디렉터리에
쌓인다.

1. **Revision 고정** — 감사 대상 commit을 하나로 고정한다. 모든 발견·링크는 그
   revision을 가리킨다.
2. **소스 직접 유도 그래프** —
   `node shared-skills/structural-audit/references/import-graph-extractor.mjs . <out.json>`을
   repo root에서 실행한다. 스크립트는 `app/**`와 root `proxy.ts`,
   `instrumentation-client.ts`의 프로덕션 import(static·export-from·literal
   dynamic, type-only 구분)를 직접 파싱하며 dependency-cruiser에 의존하지
   않는다.
3. **가독성 예산 투영** — 출력의 degree·SCC·reachability·cross-zone 후보에서
   다이어그램 하나에 들어갈 노드를 고른다. 모든 노드를 runtime zone
   subgraph에 배정하고 횡단 infrastructure는 분리한다. 표시 엣지는 전부 실측
   import여야 하며 type-only는 점선으로 구분한다. 렌더링은 Mermaid ELK
   top-to-bottom을 사용한다.
4. **지목 파일 정독** — 투영이 고른 파일을 정독한다. 발견의 다수는 이 단계에서
   나온다. degree 수치 자체를 결함으로 취급하지 않는다 — fan-in이 높은 coherent
   contract 허브는 정상이다.
5. **불일치 triage** — 그래프가 보여준 실재와 canonical 도구·계약 지도·boundary
   규칙의 차이를 발견 후보로 기록한다. 도구가 보지 못하는 엣지 종류(예:
   type-only)와 검출 불가 설정(예: 전체 entry 선언)은 그 자체가 발견이다.
   추출기의 "도달 불가"는 production entrypoint 기준이며 dead code 판정이
   아니다. scripts·테스트 소비자를 확인해 파일별로 분류한 뒤에만 제거 후보로
   다룬다. 추출기의 cross-zone 후보 검출은 `.dependency-cruiser.cjs` 규칙의
   재구현이 아니라 type-only 엣지까지 보는 확장 검사이므로, 두 결과의 차이는
   오류가 아니라 triage 대상이다.

## 산출과 기록

- 실행 기록은 moonlight-project-knowledge
  `research/lighthouse-structural-audit/`에 dated 파일로 남긴다. 분석 JSON·투영
  Mermaid·snapshot manifest는 `dataset/`에, HTML과 dated record는 topic
  디렉터리에 두고, 기록에는 감사 대상 revision과 extractor 실행 방법을 적는다.
- 감사 기록 블록은 `docs/contract-maps/quality-gates.md`의 seam-internal
  semantic audit 형식을 따른다. owning Acceptance Check가 없으면 mint하지 않고
  `verdict: unknown`으로 남긴다.
- 발견은 안정된 id(예: `SA<run>-<n>`)와 파일 ref를 갖고, `adopt`/`reject`를
  구분한다. adopt된 발견은 Lighthouse 이슈로 이관하며 이슈 본문에 구조적
  원인·완료 조건·비목표·CAIR 초기 판정을 적고 기록의 commit 고정 링크를
  남긴다.
- 이슈화가 끝나면 기록의 `제품 반영 기록`에 이슈 번호를 추가하고, 제품 PR이
  merge되면 그 PR도 추가한다.

## 기계적 Snapshot

변화 기반 snapshot capture와 판단형 structural audit을 구분한다. snapshot은 exact
revision의 전체 그래프 지표와 고정 투영을 보존하는 기계적 evidence이며, 위
5단계 감사·결함 판정·architecture health verdict가 아니다. snapshot 수치가
변했거나 trigger가 발생해도 자동으로 issue를 만들지 않는다.

목적·보존 경계·비교 가능성의 최초 채택 기록은 Moonlight Project Knowledge의
[`2026-08-29-periodic-snapshot-contract.md`](https://github.com/corca-ai/moonlight-project-knowledge/blob/30c637e200a6fd50c16feaac0b196783826bfa20/research/lighthouse-structural-audit/2026-08-29-periodic-snapshot-contract.md)에
고정한다. 현재 변화 기반 cadence의 Human 결정은
[`2026-09-01-change-triggered-snapshot-contract.md`](https://github.com/corca-ai/moonlight-project-knowledge/blob/b3a172f6ce61d5ba2ad7193d9ed7baf9dafde54e/research/lighthouse-structural-audit/2026-09-01-change-triggered-snapshot-contract.md)가
소유한다.

clean worktree의 exact `main`을 대상으로 아래 명령을 실행한다. 먼저
`git fetch origin main`으로 remote ref를 갱신한다. fetch에 실패하면 기존
`origin/main`을 사용해 계속하지 않는다.

```bash
npm run structural-audit:snapshot -- \
  <lighthouse-worktree> \
  <moonlight-project-knowledge>/research/lighthouse-structural-audit \
  --date YYYY-MM-DD \
  --baseline <previous-graph-analysis.json> \
  --require-ref origin/main \
  --issue-url <owning-process-issue>
```

생성기는 production graph·policy·tooling input이 HEAD와 다르면 중단하고 기존
dated artifact를 덮어쓰지 않는다. 한 snapshot bundle은 다음을 포함한다.

- 전체 source-derived analysis JSON
- checked-in projection manifest로 생성한 Mermaid source
- Mermaiden ELK HTML
- revision·baseline delta·graph/policy/tooling fingerprint·artifact hash를 가진
  snapshot manifest
- snapshot과 전체 감사의 경계를 적은 dated record

`references/projection-manifest.json`은 장기 비교의 고정 표본이다. 표시 엣지는
manifest에 선택된 두 파일 사이의 실측 import를 전부 포함한다. 선택된 파일이
사라지면 삭제하지 않고 tombstone으로 표시한다. manifest의 node set·edge
policy·layout을 바꿀 때는 `id`를 올리고 새 baseline을 시작한다. 서로 다른
manifest version의 visual density를 직접 전후 비교하지 않는다.

HTML은 사용자 제공 Mermaiden zero-install contract를 따른다. public CDN의
`mermaiden.js`가 bundled Mermaid와 ELK loader를 소유하며 별도 Mermaid runtime
또는 ELK loader를 넣지 않는다. `mermaiden-toolkit.js`의 relationship
highlighting을 연결하고 SVG를 교체하거나 페이지가 끝나기 전에 handle을
`dispose()`한다. `latest` 채널은 mutable이므로 재현 정본은 analysis JSON,
Mermaid source, snapshot manifest다.

## Cadence와 트리거

- `npm run structural-audit:check`는 committed base와 `HEAD`를 비교한다. 로컬
  pre-push에서는 `quality:fast`, PR·main push CI에서는 `quality:static`이 같은
  명령을 실행한다. 로컬 hook은 빠른 피드백이고 CI static job이 authoritative다.
- normalized graph, structural policy(`tsconfig*`, dependency-cruiser, Knip),
  structural tooling 중 하나가 바뀌면 merge 뒤 exact `main`에서 fingerprint당 한
  번 기계적 snapshot을 남긴다. PR branch revision은 durable snapshot으로
  보존하지 않는다.
- 대규모 수정 wave 직후(여러 구조 이슈가 한 번에 닫힌 시점)는 우선 실행
  시점이다. 수정의 부산물(#709의 value 순환 같은)과 잔존(#710의 cast 같은)을
  이때 잡는다.
- 한 분기에 변화 기반 snapshot이 하나도 없으면 exact `main`의 기계적 baseline을
  한 번 남긴다. 한 분기 동안 전체 감사가 없으면 같은 시점에 지목 파일 정독과
  불일치 triage를 포함한 5단계 전체 감사를 실행한다.
- 저장소는 GitHub Actions schedule trigger를 금지한다. 정기 확인과 실행은
  tracker assignee가 수동으로 구동한다. CI는 change trigger만 계산하며 external
  Project Knowledge에 snapshot을 쓰지 않는다.
- 수정 검증만 하는 실행은 이 skill의 산출이 아니다. 전역 스캔을 먼저 수행하고
  수정 검증은 기록의 한 섹션으로 둔다.

## Validation

```bash
node shared-skills/structural-audit/references/import-graph-extractor.mjs . /tmp/graph.json
npm run structural-audit:check
npx vitest run scripts/structural-audit/__tests__/topology-check.test.ts scripts/structural-audit/__tests__/snapshot.test.ts
npm run guard:skills
npm run format:check
```

기록·이슈만 만드는 실행은 위로 충분하다. 감사가 Lighthouse 문서를 수정하면
해당 문서 owner의 검증을 추가한다.
