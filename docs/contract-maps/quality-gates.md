# Quality Gates Contract Map

This map explains how Light House validation gates fit together.

It does not replace `docs/verification-gates.md` or package scripts. It is a
reading map for choosing the right gate.

## Zone × obligation 빠른 색인

이 표는 구현 위치에서 관련 검증을 찾는 파생 색인이다. zone을 배타적인 작업
profile로 쓰지 않으며, 한 변경이 여러 zone과 obligation에 걸치면 해당 셀의
검증을 합쳐서 적용한다. 표면 이름으로 계약 영향 없음, CAIR verdict, Architecture
Fitness verdict, merge 가능 여부를 판정하지 않는다.

코드 변경의 기본 closeout은 관련 targeted test와 `quality:fast`이고, Story
Chain·Evidence Ledger 의미가 바뀌면
`quality:contract`를 사용한다. staged diff는 `quality:commit`, exact-head
review record는 merge 전 `quality:pr`로 확인한다. 각 alias의 정확한 구성은
`package.json`만 소유한다.

| Runtime zone | Product contract | Runtime flow·동작 | Analytics·observability | Auth·security·capacity | Process·quality |
| --- | --- | --- | --- | --- | --- |
| UI — `app/components/**`, `app/stores/**`, route renderer | 의미·surface 변경 시 `mc:audit-surface`, `mc:audit-story-surface`, Evidence Ledger, `quality:contract` | 관련 component/store test, `guard:state-boundaries`, `guard:interactive-hot-path`, `guard:product-owned-navigation` | event 추가·변경 시 `mc:event-impact`, `mc:validate-events` | 공개 진입·auth dependency가 바뀌면 `guard:landing-auth-source-boundary`, `guard:auth-hot-path` | `guard:korean`, lint, typecheck, `quality:fast` |
| HTTP entrypoint — 모든 `app/**/route.ts`, `proxy.ts` | 사용자-facing request/response 의미가 바뀌면 Story Chain과 covering evidence | 관련 route test, `guard:route-deadline`, `guard:route-ingress`, `guard:api-response-contract` | event·telemetry ingress 변경 시 event gates와 `guard:operational-boundaries` | `guard:auth-hot-path`, `guard:search-first-paint-no-db`, `guard:external-http-gateway`, body budget·admission test | `quality:fast`; inventory나 gate 의미 변경은 `quality-gate-steward` |
| Server application — `app/server/**` | 생성·fallback·degraded 행동이 바뀌면 Mission Control과 `quality:contract` | 관련 service/domain-access test, `deps:boundaries`, `guard:ai-generation-gateway`, `guard:external-http-gateway`, `guard:inline-analysis-cache-contract` | canonical event router·sink 변경 시 event gates와 analytics owner test | `guard:least-authority-boundaries`, `guard:auth-resolver-write-free`, `guard:auth-hot-path`, `guard:operational-boundaries` | lint, typecheck, `quality:fast` |
| Data/persistence — `app/server/repository/**`, `supabase/**` | 영속 결과가 사용자 약속을 바꾸면 Story Chain과 Evidence Ledger | repository test, 관련 DB integration, runtime-flow owner | canonical event 저장 schema는 event gates; internal usage·cost 원장은 analytics-exempt이므로 owning ledger·repository/observability test·operational-readiness | `guard:repository-seam`, `guard:least-authority-boundaries`, `guard:supabase-migration-transaction-safety`, operational-readiness | migration·package 변화에 맞는 targeted gate와 `quality:fast` |
| Shared contracts — `app/domain/**`, server runtime import가 없는 `app/lib/**`, schema·message·event 정본 | 사용자-facing·Story Chain 의미가 바뀔 때만 `quality:contract`, `mc:validate-story-chain`, Evidence Ledger | 기본은 consumer test와 typecheck; runtime 순서가 바뀌면 runtime-flow sync | canonical event·message 정본이 바뀔 때 `mc:validate-events`, `mc:event-impact`, `mc:check-message-registry` | capability·principal·serialized input 경계가 바뀌면 `guard:least-authority-boundaries`, `guard:search-condition-url-budget` | `guard:glossary`, `guard:ledger-citations`, `guard:skills`, `contract-maps:check`, review closeout |

표의 leaf guard는 아래 Gate Stack이 설명하는 실제 scan scope와 capability·seam이
변경 범위와 겹칠 때 선택한다. zone에 이름이 보인다는 이유만으로 모든 leaf guard를
항상 직접 실행하거나, 반대로 빈칸과 표면 이름만으로 “검증 없음”을 추론하지 않는다.

Sources:

- [`docs/implementation.md`](../implementation.md) — runtime zone, obligation, lifecycle
- [`package.json`](../../package.json) — alias와 command 구성의 단일 원본
- [`docs/ci-structure.md`](../ci-structure.md) — CI 책임 단위
- [`docs/runtime-flows/README.md`](../runtime-flows/README.md) — 처리 순서 owner
- [`docs/operational-readiness.md`](../operational-readiness.md) — capacity·rollout 판단 owner

## Quality Profiles

Issue #450에서 quality pipeline을 네 profile로 줄였고, 일반 문서·스킬 산문에는
`quality:docs`를 추가했다. 정확한 구성은
`package.json`만 소유하며 이 표는 실행 시점과 분리 이유만 설명한다.
`quality:guards`, `quality:static`, `quality:audit`, `quality:pr`은 각각 guard
묶음, CI static job, dependency audit job, review closeout 책임을 드러내는
component command이므로 profile 수에 포함하지 않는다. 이 네 component와
아래 표의 profile이 canonical 실행 경로다. 문서·스킬 산문에는
`quality:docs`를 추가하고 `quality:hook`이 로컬 push 범위에 따라 기존 profile과
문서 profile을 선택한다. 분류 경계는
[`docs/ci-structure.md`](../ci-structure.md#문서스킬-산문의-검증-범위)와
[`quality-change-scope.mjs`](../../scripts/quality/quality-change-scope.mjs)가 소유한다.
공유 Story Chain·Evidence Ledger 계약 게이트 목록은 `quality:contract`만
소유하며 `quality:static`과 `quality:full`은 해당 alias를 호출한다.

| Profile | 실행 시점 | 별도로 남기는 이유 |
| --- | --- | --- |
| `quality:commit` | staged commit hook | staged surface 판정과 `lint-staged`가 필요하다. 전체 worktree용 profile로 대체할 수 없다. |
| `quality:fast` | pre-push 전체 경로와 일반 PR 로컬 closeout | PR fast path를 로컬에서 가장 짧게 재현한다. |
| `quality:contract` | Story Chain·Evidence Ledger 계약 closeout | docs-only 계약 변경도 실행해야 하며 제품 unit/build와 실패 의미가 다르다. |
| `quality:docs` | 일반 문서·스킬 산문만 바뀐 CI static과 pre-push | 문서가 소비되는 guard·계약·라우팅 검증을 유지하고 전체 제품 unit/build/DB 실행 비용을 줄인다. |
| `quality:full` | 수동 full dispatch | coverage, executable Evidence Ledger, build를 한 번에 실행하는 장시간 경로다. |

## Gate Stack

| Layer | Main command or artifact | Catches |
| --- | --- | --- |
| Formatting | `npm run format:check` | document/code format drift |
| Static code | `npm run lint`, `npm run typecheck` | TypeScript and lint violations |
| Structural topology change detector | `npm run structural-audit:check` (`quality:static`; 로컬 pre-push 전체 경로는 `quality:fast`, PR·main push 전체 경로는 CI `static`) | declared comparison ref 부재나 source-derived extractor 실패 때문에 구조 비교가 조용히 생략되는 상태. normalized graph·structural policy·tooling fingerprint와 SCC·unreachable·cross-zone delta는 advisory trigger로 출력하고 차단 verdict로 바꾸지 않는다. Dependency boundary enforcement는 기존 `deps:boundaries`가 소유한다. |
| Static-gate escapes | `npm run guard:escapes` (in `quality:guards`) | `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, or `.skip()` escapes added to app/script code, which would silently weaken the static gates |
| Hardcoded Korean UI strings | `npm run guard:korean` (in `quality:guards`) | Korean string literals in app TS/TSX outside the i18n registry (`t()`), bypassing message centralization — canonical message catalogs and generated-language prompt owners are declared with reason/accountable-owner/review-trigger metadata, and an exclusion with no remaining matching Korean literal fails as stale; tests remain outside the production scan |
| Route deadline budget | `npm run guard:route-deadline` (in `quality:guards`) | an `app/**/route.ts` Route Handler missing a top-level `export const maxDuration` (or a value outside 1..120s), which would silently inherit Vercel's 300s default and let one stuck route hold its pooled DB connection — the first layer of the multi-layer deadline budget |
| Route ingress policy | `npm run guard:route-ingress` (in `quality:guards`) | a Route Handler missing from the 19-route ingress inventory, inventory deadline drift, an incomplete body byte/field/cardinality budget, a body route without a bounded reader, or direct `request.json()` bypass; the shared discovery owner scans all `app/**/route.ts`, and focused negative route tests separately prove outside-`app/api` coverage plus auth/admission ordering and `400`·`401`·`413`·`429` behavior |
| API response and retry contract | `npm run guard:api-response-contract` (in `quality:guards`) | a Route Handler missing from the 18-route response inventory or the one explicit redirect-only auth-callback exemption, incomplete success/degraded/error categories, message-only route errors, status-to-action/retryability drift, `400` retry-storm mappings, `429` without `Retry-After`, or a stable unexpected-failure route without an envelope owner; the exemption is code-owned with reason, accountable owner, and review trigger metadata |
| Operational boundary register and controls | `npm run guard:operational-boundaries` (in `quality:guards`) | registered shared-cache, public ingress, external provider fan-out, or LLM provider cost observability boundary rows disappearing from `docs/operational-readiness.md`; row status drifting outside the operational vocabulary; or public telemetry or Episteme route wiring bypassing the runtime control points |
| Inline-analysis cache contract | `npm run guard:inline-analysis-cache-contract` (in `quality:guards`) | inline-analysis prompt/output/normalization/model/generation-setting/input-identity AST changing without an `INLINE_ANALYSIS_VERSION` increase; a digest-neutral version bump without a new compatibility reason; or a formatting-only/unrelated-import edit causing an unnecessary version bump |
| External HTTP gateway and explicit outbound owners | `npm run guard:external-http-gateway` (in `quality:guards`) | a new server-side `fetch(...)` in any Route Handler, root `proxy.ts`, scoped server/package source, or retired owner root outside `app/server/external-http-gateway/` and the explicit `app/server/services/analytics/amplitude-sink.ts` and `app/server/auth/supabase.ts` owners; all Route Handlers come from the shared `app/**/route.ts` discovery owner |
| Auth resolver write-free | `npm run guard:auth-resolver-write-free` (in `quality:guards`) | `app/server/auth/identity.ts` reintroducing `after()`, the removed app-user snapshot scheduler/repository, or owner-principal backfill helpers, which would put retired identity projection writes back on the request-hot Supabase Auth path |
| Auth hot path | `npm run guard:auth-hot-path` (in `quality:guards`) | root `/` server render importing the auth resolver, `proxy.ts` calling Supabase `auth.getUser()` before the verified Moonlight session-cookie bypass, before the public root/auth/telemetry bypass, or without first requiring a Supabase auth-token cookie, using clear-only stale/future cookie names as auth-bypass signals, importing heavy Moonlight token/session modules into the proxy, or browser analytics calling `auth.getUser()`, which would reintroduce `/auth/v1/user` reads per matched request or page load |
| Static dependency boundary | `npm run deps:boundaries` (through `guard:landing-auth-source-boundary` in `quality:guards`) | dependency-cruiser collects TypeScript pre-compilation edges, including `import type`. Client-to-server, route-to-repository, service-to-repository, server-to-UI, public-auth registry, and retired repository-barrel boundaries reject type-only edges unless a rule declares `dependencyTypesNot: ["type-only"]`. The admin analytics catalog and one research-shell test may consume only their named server contract types; a value import from the same paths still fails. A negative fixture proves that a new `app/stores/**` type-only import of `app/server/**` is blocking. |
| Landing auth source boundary | `npm run guard:landing-auth-source-boundary` (runs `deps:boundaries` plus a minimal custom fallback in `quality:guards`) | dependency-cruiser declaratively rejects public auth/landing imports of the global i18n registry; the custom fallback only rejects eager or non-helper `@amplitude/unified` imports because the current dependency graph omits that external dynamic edge |
| Interactive hot path | `npm run guard:interactive-hot-path` (in `quality:guards`) | the search entry hot path (`search-route-page.tsx`, search follow-up URL builders) referencing live Moonlight library resolvers (external HTTP that a callee change can smuggle in, the #175→#179 latency regression) or history-proportional document list scans instead of URL-derived execution input — keeps click→transition latency flat (aspect:immediate-navigation) |
| Product-owned navigation | `npm run guard:product-owned-navigation` (in `quality:guards`) | literal `window.open("about:blank")` detached handoffs that hold a blank browser document behind async work instead of opening a product-owned route such as `/gap?opening=1`; route composition tests and Evidence Ledger rows separately prove the product route itself avoids auth/provider first-paint blockers (aspect:immediate-navigation) |
| Bilingual glossary registry | `npm run guard:glossary` (in `quality:guards`), existing `typecheck` | duplicate or colliding term identities, non-canonical Korean/English/alias characters, broken or retired authority anchors, unknown term ids in i18n edges, i18n values that drift from canonical Korean, stale readable/domain/i18n projections, and compiler-invalid MessageKey refs |
| AI generation gateway | `npm run guard:ai-generation-gateway` (in `quality:guards`) | direct server-side Google/OpenAI provider acquisition or AI SDK generation helpers added outside `app/server/ai-generation/`, escaping the shared model/gateway boundary that keeps chat generation, route AI comment generation, and future provider policy in one place |
| Search first paint DB independence | `npm run guard:search-first-paint-no-db` (in `quality:guards`) | the query-canonical search first-result path (`search-route-page.tsx`, `relationship-route-page.tsx`, their execution services, and static or dynamic local imports) importing `app/server/repository/**` outside bounded side-channels, which would put unowned repository reads/writes back before first paint and break ephemeral search execution; the identity-owned exact-email access membership read, fire-and-forget analytics mirror, and owner-shaped live My Library read are declared exceptions with reason/accountable-owner/review-trigger metadata, while another importer, another repository, malformed metadata, or an unmatched stale declaration fails the guard (aspect:first-paint-persistence-independence; aspect:library-grounded-research; aspect:admin-access-control) |
| Supabase migration transaction safety | `npm run guard:supabase-migration-transaction-safety` (in `quality:guards`) | checked-in `supabase/migrations/*.sql` using `CREATE/DROP/REINDEX INDEX CONCURRENTLY`, which fails in the transaction-wrapped production migration apply path with SQLSTATE 25001 |
| Repository DB seam | `npm run guard:repository-seam` (in `quality:guards`) | a new Supabase table access (`.from("<table>")`) added outside `app/server/repository/`, or production code using id-only document write/delete helpers instead of the `owner_principal_id`-scoped variants, escaping the single seam where deadline budgets, ownership filters, and role `statement_timeout` wrappers live — the #183 structural defense that keeps DB cost/ownership/pool-occupancy bounded in one place |
| PostgreSQL integration contracts | `npm run db:start:ci`, `npm run test:db:gap-report-concurrency`, `npm run db:stop:ci` (PR/push `db-integration` job) | current migration revision과 실행 DB revision이 다른 상태, migration reset 직후 PostgREST schema cache가 준비되기 전에 test가 시작되는 상태, readiness와 무관한 인증·schema 계약 오류가 retry에 가려지는 상태, gap report의 version/CAS/lease 경쟁 회귀, reviewed_papers의 동일 timestamp owner 정렬·matching index 회귀, mock과 실제 PostgreSQL/PostgREST 의미의 불일치. CI startup은 Docker host-port bind 충돌 signature만 project-scoped cleanup 뒤 한 번 재시도하고 다른 오류는 즉시 실패한다. job 종료 cleanup은 성공·실패와 무관하게 실행되어 잔류 stack이 다음 rail을 오염시키지 않게 한다. Unit mock만으로 MVCC·unique constraint·실제 query ordering/index 의미를 확인했다고 오인하는 false pass를 막는다. |
| Dependency audit | `npm run deps:audit` (`quality:audit` in CI) | lockfile drift, invalid dependency tree, runtime high/critical advisories, dead dependencies, Next.js 규약·test·script entry에서 도달할 수 없는 source file. Knip은 unused export를 이 책임에 섞지 않는다. 동적 실행·생성 projection·별도 Vitest include·미결정 Concept Shift 파일은 exact entry와 reason/owner/reviewWhen 선언으로 남기며, 넓은 `app/**`·`scripts/**` entry와 경로가 사라진 stale 선언은 허용하지 않는다. dependency topology는 blocking static work인 `deps:boundaries`가 소유한다. |
| Story Chain graph | `npm run mc:validate-story-chain` | parent refs, weaving, cardinality, ledger shape; required local Service Policy Coverage Matrix on every core-product Experience; Matrix schema, required family/reference coverage, exact-revision source, disposition aggregate, and Story Chain-owned row handoff refs; the canonical four-dimension release contract staying synchronized with `docs/mission-control.md`; every active scenario's reverse coverage by at least one Evidence Ledger row; rejection of ledger refs outside the active scenario catalog; required current `evidence-ledgers/reviews` owner directory; and new Sufficiency Review AC/IC ownership within the ledger's Source Promises; pre-cutoff dated review history remains preserved |
| CAIR change contract | `npm run mc:validate-cair` (`quality:contract`), staged `npm run mc:validate-cair -- --staged` (`quality:commit`) | new or changed CAIR records with an unknown verdict or axis, empty verdict-specific fields, informal Human-decision state, unresolved structural defense, missing Propagation Map for `reshape`, missing Concept Shift Architecture Review when `reshape` affects Compatibility and retirement, changed or deleted Promise/Aspect/Experience/Moment without a durable CAIR record pointer, an unchanged record or contract pointer whose cited path is deleted or renamed or whose npm script or Aspect is removed in the same diff, or a changed Architecture Fitness declaration whose `architectureImpact`, `cairVerdict`, and `recordRef` do not agree; the gate is diff-scoped and does not judge verdict truth or defense sufficiency |
| Story Chain policy-layer review | `review-checklist-steward` `story-chain` group at the exact reviewed head | changed Experience, Moment, Promise, Aspect, and Architecture Fitness policy bodies placed against the shared layer-routing criteria; this Human/agent semantic review complements but is not implied by a green graph gate |
| Evidence Ledger dry run | `npm run evidence-ledger:dry` | non-canonical or malformed YAML v2, unknown fields, duplicate/unsupported YAML features, dangling or orphaned execution refs, stale test files, zero-test selectors, unregistered contract-check/guard/script targets; execution is argv-based with `shell: false` |
| Evidence Ledger migration parity | `npm run evidence-ledger:parity` (in `quality:contract`) | Git-history cutover 기준선의 41개 원장·306개 Acceptance Check에서 source Promise, Aspect, Intent ref/evidence, AC key/assertion/scenario, verdict, implementation contract, review pointer 또는 legacy execution coverage가 유실되거나, 등록되지 않은 migration delta가 생기는 상태 |
| Story Chain test citations | `npm run guard:ledger-citations` (in `quality:guards`), `npm run evidence-ledger:dry` | Markdown contract prose와 YAML v2 Evidence Ledger assertion이 인용한 test file/title의 존재, YAML AC의 `executionRefs`가 인용한 exact file/title selector와 executable target을 실제로 포함하는지, renamed·removed·wrong-file·wrong-selector·per-AC underbinding이 없는지 |
| Surface tags | `npm run mc:audit-surface`, `npm run mc:audit-story-surface` | untagged or stale user-facing surfaces |
| Event contract | `npm run mc:validate-events`, `npm run mc:event-impact` | analytics event contract drift |
| Message registry | `npm run mc:check-message-registry` | i18n message namespaces without an owning Promise/Aspect group, tone-policy drift |
| Review closeout | `npm run review-closeout:check -- --base origin/main` (PR-only `review-closeout` CI job; local pre-merge preview `npm run quality:pr`) | a PR whose exact content head has no latest matching non-dirty review record with `closeout: clean` and `findings: valid 0`; a newly added canonical review record that omits or mis-values `author-model`, `review-model`, or `verdict-model`, names a non-current `applied:` group, or names a non-current/unknown `hit:` entry; a newly added `classification: valid` escape that does not map to an active/workflow entry or explicit HEAD candidate — stale, explicitly non-clean, unattributed, historically mislabeled, feedback-unbound, or unreviewed closeout merging as if clean; trailing record-only usage-log commits and empty trailer commits do not advance the content head (issues #318, #411, #504) |
| Mutation | `npm run mutation:*` | tests that pass without protecting invariants |
| Skill runtime copy and external package sync | `npm run guard:skills` (in `quality:guards`) | `postinstall`이 만든 ignored runtime skill copies (`.claude/skills`, `.agents/skills`)가 `shared-skills/` source와 어긋나거나 누락된 상태, canonical `shared-skills/` 아래에 nested `.git` metadata가 생긴 상태, 또는 external-managed Architecture Fitness portable archive의 package version·source revision·archive/tree/per-file hash가 provenance와 어긋난 상태 |
| Skill routing evaluation | `npm run skill:routing-eval`; 같은 검증을 `check-skill-routing-corpus.test.ts`가 `test` job에서 실행 | committed local frontmatter·external package provenance로 만든 frozen corpus/input·evaluation-spec·routing-source digest, 저장된 opaque inputs/prediction/score와 model/input/prediction seal, overlap negative control, no-skill helper의 명시적 `firstRoute: null` negative control, threshold shape, 또는 blind prediction의 first-route·required recall·allowed precision·forbidden/unknown route 기준이 어긋난 상태. no-skill case에서 skill을 고르면 hard forbidden selection이며, Skill frontmatter나 First-Route Rules 변경은 같은 PR에서 blind 재평가와 artifact 갱신을 요구하는 blocking failure다 |
| Architecture Fitness v0.9.1 advisory | `npm run architecture-fitness:advisory` (recollection + validation + unsigned evaluation assertion), `npm run architecture-fitness:verdict` (same assertion + core verdict exit `0/1/2/3`), `npm run architecture-fitness:validate` (fixed-set recollection/validation), `npm run architecture-fitness:check-publication`, `npm run architecture-fitness:impact`, `npm run quality:guards`, `.github/workflows/architecture-fitness-attestation.yml` | profile policy/raw-observation/collector-and-guard definition drift, partial or failed evidence publication, exact revision·fixture run·artifact identity loss, unsupported coverage의 오승격, unsigned·tampered evidence, replayed binding, bounded LLM candidate 혼입, architecture-impact declaration 누락; 제품 PR은 `quality:guards`의 least-authority·state-boundary 정적 방어로 막고 heavy attestation을 실행하지 않는다. Operator-requested protected-main rebind만 exact target workflow·collector를 authority로 사용하며 workflow SHA와 target SHA, PR 번호 `0`, first-parent baseline을 검증한다. 이전 main collector identity 일치는 bootstrap 선행조건이 아니고 별도 bootstrap PR·classifier·force label도 없다. Profile runner의 complete·exit-zero·reproducible·canonical-schema 검증, secretless collection, Q4/Q5 격리, signed bundle의 invocation·artifact binding은 유지한다. |
| Architecture Fitness rebind window | `.github/workflows/architecture-fitness-rebind-window.yml` (manual notifier) | retained signed target을 newer `currentHead` verdict로 오인하는 상태; retained artifact를 paginate하고 successful protected-main `workflow_dispatch` 중 main run SHA·target SHA 일치와 PR 번호 `0`을 만족한 bundle만 허용한다. Exact-current bundle을 우선하고 signed-target freshness를 `fresh / stale / absent`로 보고하며 policy compatibility와 checked-fixture freshness는 분리한다. |
| Search-quality local synthetic candidate | `.github/workflows/search-quality-evidence.yml` (manual, synthetic evidence-only) | protected-main exact target·actual `/search` one-shot·exact loopback request path/final URL·synthetic fixture·raw byte digest·run identity self-check가 빠진 aggregate false pass, raw identity publication, local candidate를 attestation으로 오인하는 상태; attestation·execution·currentness·release authority와 bounded-live readiness는 증명하지 않는다. |
| Least-authority local conformance | `npm run guard:least-authority-boundaries` (in `quality:guards`; Issue #278 v0.9.1 collector evidence) | legacy admin/service-role factory use, a new direct server-session `createClient` caller outside the canonical identity owner and the two declared Supabase login-bootstrap exceptions, Moonlight request identity or session bootstrap symbols, request-scoped DB handles created outside Supabase session authority, trusted-operation handle creation outside `trusted-operation-db.ts`, a named trusted operation acquiring an undeclared table/RPC or being imported by an undeclared caller, raw DB unwrap outside repository DB ownership, auth의 repository runtime import, environment-key duplication, repository wrapper laundering, direct/property/element/alias table/RPC acquisition outside declared repository owners, raw-principal reviewed-paper exports, unresolved production dynamic import/`require`, or restricted helper re-export paths; the bootstrap exceptions carry reason/accountable-owner/review-trigger metadata and malformed or unmatched stale declarations fail, while type-only auth and route-AI repository imports are not runtime bypasses. Blocking guard가 product PR의 정적 경계를 지키고 collector는 batch rebind에서 exact-revision evidence를 수집한다. |
| Search and relationship state-boundary conformance | `npm run guard:state-boundaries` (in `quality:guards`), `npm run architecture-fitness:advisory` (Issue #276 v0.9.1 state-boundary collector evidence) | Keyword 또는 citation/similar URL condition이 stale client state나 runtime 값에 authority를 넘기는 경로, server execution input이 URL condition을 재작성하는 경로, ephemeral search/citation/graph-neighbor identity가 가변 result snapshot에 의존하는 경로, route-owned current-result carrier가 active route 수명을 넘기는 경로; 단일 parameterized blocking gate가 TypeScript inventory와 capability-owner engine을 한 번 만들고 route별 policy를 평가한다. Batch rebind collector는 exact-revision evidence를 별도로 수집하며 Q1 제품 outcome과 process coverage는 `unknown`으로 유지한다. |
| Search-first condition URL byte budget | `npm run guard:search-condition-url-budget` (in `quality:guards`), `npm run architecture-fitness:advisory`, `.github/workflows/architecture-fitness-attestation.yml` (Issue #399 serialized-input-budget evidence) | `/search` keyword·term·seed fallback과 `/citation`·`/similar` production builder가 shared `URLSearchParams`/UTF-8 request-target owner를 우회하는 경로, raw dimension·8,192-byte budget·reject-only overflow drift, parser/provider/canonical-identity 이전 검사 순서 상실, strict builder 직접 import. Exact-revision collector는 collector-authority checkout이 소유한 명시적 Vitest config·setup·dependency로 emoji·percent-expansion maximum과 one-byte overflow를 독립 boundary별로 측정한다. Target root config와 lock drift는 source identity로 보존하며 실행 authority나 수집 완료 조건으로 사용하지 않는다. Platform pre-app raw request-target와 throughput·다른 architecture lens는 `unsupported / unknown`으로 남긴다. |
| Q2 process topology and first-ready critical path | `npm run architecture-fitness:advisory`, `.github/workflows/architecture-fitness-attestation.yml` (Issue #280/#281 v0.9.1 collector evidence) | Episteme breaker state·slot coordination이 process self-protection 범위를 벗어나는 변경, 독립 process 간 상태 누수, first-ready search payload에서 승인된 await 누락, reviewed-library/library-preflight failure isolation 상실, keyword failure가 ready 결과로 오인되는 변경; exact target collector는 base와 target에서 TypeScript lexical symbol로 `search-service` named import에 직접 결속된 호출과 await 결과 shape를 확인해 keyword-search 역할을 하나만 찾고 revision별 export로 collector-authority behavior harness를 실행한다. Local shadow는 거부한다. 특정 provider export 이름과 이전 collector identity는 bootstrap 선행조건이 아니다. 역할이 없거나 둘 이상이면 실패한다. Target lock drift는 수집을 차단하지 않는다. fleet/provider-account hard cap과 production latency는 이 gate가 증명하지 않고 `unsupported / unknown`으로 보존한다. |
| Q3 launch workload envelope | `npm run architecture-fitness:advisory`, `.github/workflows/architecture-fitness-attestation.yml` (Issue #286 v0.9.1 collector evidence) | 승인된 cold u20·sustained 1/s·controlled provider 시나리오의 profile·completion·ready result·error·shed·p95·provider amplification drift, report attribution·counter-window·관련 제품 경로 변조. Raw guarded-tree digest는 계속 보존한다. 2/s 탐색 실패는 `excluded`, production fleet·p99/5xx·DB pool·real-provider amplification은 `unsupported / unknown`으로 보존한다. |
| Q4 technical grain | `npm run architecture-fitness:advisory`, `.github/workflows/architecture-fitness-attestation.yml` (Issue #297 v0.9.1 collector evidence) | 승인된 literature provider, structured AI, reviewed-paper domain/repository, client-background/server-effect seam의 chokepoint·책임·caller·bypass·invariant drift와 두 bounded contract trace의 필수 propagation 누락. Dynamic effect acquisition, 순수 mechanism-only 미래 locality, production background lifetime, process effectiveness는 `unsupported / unknown`으로 보존한다. |
| Q5 cache lifecycle | `npm run architecture-fitness:advisory`, `.github/workflows/architecture-fitness-attestation.yml` (Issue #298 v0.9.1 collector evidence) | Preset-title cache의 source owner, public paper-id key, positive·negative freshness, TTL·LRU invalidation, provider deadline, failure non-caching, process single-flight, same-id shared fill과 caller-abort isolation drift. Base observation은 collector-authority runner에서 봉인하고, target behavior는 별도 no-secret job의 allowlist 환경에서 실행해 독립 artifact로 봉인한다. Protected job은 target code를 실행하지 않고 정확히 두 observation만 새 Q5 input으로 결합·바인딩한다. Reviewed-papers live DB source·inline-analysis fleet, cleanup 효과, production cache 관측, process effectiveness는 `unsupported / unknown`으로 보존한다. |
| Gate enforcement parity | `npm run guard:gate-parity` (`node scripts/quality/check-gate-parity.mjs`, in `quality:guards`) | 게이트 강제 지위 선언(`scripts/quality/gate-status.json`)과 workflow 트리거, branch protection 스냅샷(`scripts/quality/branch-protection.snapshot.json`) 사이의 parity 드리프트, checked-in workflow의 schedule 트리거 부재 invariant 위반 (issue #652) |
| Lane freshness budget declaration | `npm run guard:lane-freshness` (`node scripts/quality/check-lane-freshness.mjs`, in `quality:guards`); 선언 무결성과 budget 초과 모두 blocking (2026-08-15 Human 결정, budget 100커밋) | 수동 authoritative lane(Architecture Fitness attestation)의 선언된 신선도 budget(`scripts/quality/lane-freshness.json`) 누락·기형과 budget 초과 — 초과 시 운영자의 attestation 수동 실행·`lastTargetSha` 갱신 전까지 merge 차단 (issue #652) |
| CAIR record full inventory | `npm run mc:cair-inventory` (`tsx scripts/mission-control/mc-validate-cair.ts --all`); advisory — `static` job이 전체 검증 경로의 PR·push에서 비차단 notice annotation으로 집계를 출력한다 | 전체 docs에 걸친 CAIR 레코드의 현행 문법 준수 인벤토리, diff-scoped `mc:validate-cair` 게이트가 보지 못하는 잠복 비준수 가시화 (issue #652) |
| Project Knowledge | `npm run pk:validate` | local/shared memory structure drift |
| Contract Maps | `npm run contract-maps:check` | missing local map links and README index drift |

`project-status-checkpoint.yml`은 Gate Stack 밖의 workflow다. `main` push 후
자동 실행되고 수동 dispatch도 지원하며(gate-parity `automatedWorkflows`
카테고리), `npm run project-status -- check`가 활성 tracker 설정을 검증한 뒤
GitHub의 기계적 checkpoint만 동기화한다. tracker period 밖(check exit 2)에서만
push 실행이 skip되고, 다른 check 실패는 push에서도 표면화된다. 이 workflow의 실패는 release verdict나 PR merge
eligibility가 아니라 status tracker 운영 실패로 해석한다. 정본 절차는
`docs/project-status.md`가 소유한다.

Architecture Fitness definition·fixture authoring 중에는 로컬 unsigned advisory 또는
validation-only alternative 중 하나를 사용한다. 일반 제품 변경은 관련 guard/test와 protected
exact-target run을 사용하고, 기록 전용 cohort는 heavy protected collection을 생략할 수 있다.
Protected advisory는 non-draft/ready exact head에서만 실행하고 같은 PR의 이전 실행은 취소한다.
Cadence와 authority의
정본은 [`docs/ci-structure.md`](../ci-structure.md)다. 이 map은 해당 관계만 요약하며 새 blocking
의무를 만들지 않는다.

Sources:

- [`package.json`](../../package.json)
- [`docs/ci-structure.md`](../ci-structure.md) — CI job 책임 단위와 새 검증 배치 기준
- [`docs/verification-gates.md`](../verification-gates.md)
- [`docs/mission-control.md`](../mission-control.md)
- [`docs/runtime-flows/search-mechanism.md`](../runtime-flows/search-mechanism.md) — 데드라인·커넥션 예산 (route-deadline budget mechanism owning the `guard:route-deadline` gate)
- [`docs/operational-readiness.md`](../operational-readiness.md) — 운영 boundary 등록부와 go/no-go 판정 권한 (operational boundary register owning the `guard:operational-boundaries` gate)
- [`docs/operational-readiness-records.md`](../operational-readiness-records.md) — dated 운영 실행·verdict 기록

## Dated review records

분기별 회수 감사와 과거 inventory snapshot은
[`quality-gate-records.md`](quality-gate-records.md)로 분리했다. 그 문서는
현재 gate 명령이나 release obligation을 소유하지 않는다. 현재 선택은 위 색인과
Gate Stack에서 시작하고, 과거 유지·통합·은퇴 판단의 증거가 필요할 때만 records를
읽는다.

## Gate Stack Extension Decision

Issue #189 uses this map's Gate Stack as the first location for seam provenance
and retire records. This stays in `quality-gates.md` because the Gate Stack
already answers the reader question "which guard protects which seam?" and
because adding a separate map for two pilot seams would create a second index
over the same commands.

Boundary:

- The Gate Stack table still owns only the command/artifact and what false pass
  it catches.
- The seam records below add source-backed provenance, rejected alternatives,
  review triggers, and retire conditions for the same rows.
- This section does not create a Promise, Aspect, release gate, or new blocking
  obligation. If an advisory audit becomes blocking, the owning source must move
  to `docs/verification-gates.md`, package scripts, and CI wiring first; this map
  may then link to that source.
- Gaps are recorded as `unknown — 기록 부재` instead of inferred. The absence of a
  recorded decision is part of the #189 pilot evidence.

Sources:

- [Issue #189](https://github.com/jaeyoungkang/lighthouse/issues/189)
- [`docs/contract-maps/README.md`](README.md)

## Seam Provenance And Retire Records

These records are derived reading aids for Gate Stack seam guards. They preserve
why a seam exists and when to revisit or remove it without turning this map into
a new authority layer.

### `ai-generation-gateway`

- Gate Stack row: `AI generation gateway` /
  `npm run guard:ai-generation-gateway`.
- Why this seam: issue #185 recorded that AI provider calls were split across
  reaction streaming, LLM judgment, and structured/background generation, so timeout,
  abort, model selection, degraded fallback, telemetry, and cost/latency policy
  could drift by call site. PR #188 merged `app/server/ai-generation/` as the
  shared provider boundary, separated automatic route AI comments from
  the reaction stream path, and wired `guard:ai-generation-gateway` into `quality:guards`.
- Rejected or unchosen alternatives:
  - Keep automatic route AI comments on the reaction stream path: rejected by PR #188's
    PR record because automatic reactions and user reactions shared one response
    path and could create `409` contention.
  - Keep provider SDK calls at individual service call sites and rely on the
    `respond` contract or code review: rejected by issue #185's problem
    statement because direct provider calls would not be deterministically
    guarded.
  - Name the seam `app/server/llm-gateway/`: issue #185 listed it as a candidate,
    but PR #188 implemented `app/server/ai-generation/`; the path-choice
    rationale is `unknown — 기록 부재`.
- Review triggers:
  - A new production AI provider, model family, generation helper, retry policy,
    timeout, cost/telemetry policy, or fallback path is added.
  - `guard:ai-generation-gateway` allowlists a new directory/file, fails on a
    direct provider call, or stops matching a provider SDK used by production
    code.
  - route AI comment generation failure, provider outage, or legacy stream
    rewiring shows a split between current structured generation behavior and
    retired interactive helpers.
- Retire conditions:
  - Retire only when production AI generation is removed, or when a replacement
    canonical AI gateway has equivalent guard coverage, runtime-flow docs, and
    evidence proving no production provider calls bypass it.
  - If gateway APIs split by generation family, keep this guard until the new
    split has source-owned guard rows and the old path has no production calls.
  - Retiring because "current callers are few" is not sufficient; the original
    defect was direct-call drift, not call count.

Sources:

- [Issue #185](https://github.com/jaeyoungkang/lighthouse/issues/185)
- [PR #188 merge commit `edacd201`](https://github.com/jaeyoungkang/lighthouse/commit/edacd201)
- [`scripts/quality/check-ai-generation-gateway.mjs`](../../scripts/quality/check-ai-generation-gateway.mjs)
- [`docs/runtime-flows/ai-response-generation.md`](../runtime-flows/ai-response-generation.md)

### `repository-seam`

- Gate Stack row: `Repository DB seam` /
  `npm run guard:repository-seam`.
- Why this seam: issue #183 showed that auth/DB hot-path writes, route deadlines,
  owner filtering, and PostgREST pool occupancy could combine into 500/504 and
  timeout failures. The #183 remediation found that real Supabase table access
  was already concentrated in `app/server/repository/`, making it the narrow
  seam where ownership filters, deadline budget, and role `statement_timeout`
  wrappers could be held together. `guard:repository-seam` prevents new
  `.from(...)` / `.rpc(...)` table access and id-only document writes outside
  that seam.
- Rejected or unchosen alternatives:
  - Make AWS/server split a prerequisite for the fix: rejected in issue #183's
    2026-06-30 decision update; the remediation was required to close on the
    current Vercel + Supabase stack and remain portable to later server split
    work.
  - Search fan-out consolidation as the main structural defense: skipped after
    K1/K2/K5 because the original re-auth write multiplier was removed, remaining
    enrichment was off the critical path, and a clean durable implementation was
    high-complexity/low-value for the current viewer.
  - Allow repository-outside DB access by convention/code review: the guard and
    K6 plan reject this shape because it would bypass the single wrapper point;
    a separate debate record is `unknown — 기록 부재`.
  - Use a dedicated `auth resolver no-write` or retired telemetry static guard:
    unchosen in the K6 plan; the current evidence uses identity tests and events
    route tests. A separate retire rationale for those non-guards is
    `unknown — 기록 부재`.
- Review triggers:
  - `guard:repository-seam` allowlists a new data-access directory, fails on a
    production `.from(...)` / `.rpc(...)`, or reports id-only document
    write/delete usage.
  - The repository layer moves into `packages/`, changes DB client
    (`pg`/Prisma/RDS/etc.), or changes the `owner_principal_id` ownership model.
  - `npm run load-smoke` or production logs show DB pool, ownership, p99, 5xx, or
    statement-timeout regressions.
  - Route deadline, statement timeout, or ownership filtering is moved out of
    repository helpers.
- Retire conditions:
  - Retire only when Supabase table access is removed, or when a replacement
    repository/data-access seam has equivalent guard coverage for table access,
    ownership predicates, and id-scoped writes.
  - If `owner_principal_id` is replaced, keep the guard until the new ownership
    predicate has tests and a seam guard that catches writes without that
    predicate.
  - If the app moves to a package-level repository or server split, update the
    allowlist rather than retiring the guard unless the old `app/server/repository`
    seam has no production data access left.

Sources:

- [Issue #183](https://github.com/jaeyoungkang/lighthouse/issues/183)
- [PR #184 merge commit `358c1269`](https://github.com/jaeyoungkang/lighthouse/commit/358c1269)
- [`scripts/quality/check-repository-db-seam.mjs`](../../scripts/quality/check-repository-db-seam.mjs)
- [`docs/runtime-flows/search-mechanism.md`](../runtime-flows/search-mechanism.md)

## Seam-Internal Semantic Audit Record Format

Static seam guards catch escapes outside the seam. They do not prove that code
inside the seam is not duplicated, over-centralized, or split into parallel
policy paths. Before running an advisory audit, record the audit as a
Sufficiency Review-style YAML note with concrete findings. This fixes the
observation tier without inventing a new release gate.

Rubric for "seam-internal duplication / excess":

- Multiple code paths inside the seam own the same provider/model/DB/client
  policy, timeout, retry, auth, ownership, or degraded fallback behavior without
  a shared helper or an explicit reason.
- The same capability can be invoked through more than one public seam API and
  those APIs can drift in reliability, ownership, or telemetry behavior.
- Repeated code is not excess when the repeated table/provider operation is
  table-specific, test-only, or intentionally separated by runtime family and
  the reason is recorded next to the call path.
- A guard pass is not a clean audit result. The guard only proves "no outside
  bypass"; the semantic audit must inspect inside-seam files and callers.

Required input evidence:

- Seam id, Gate Stack row, guard command, and current guard output.
- Repo-relative file list for the seam root and its production callers.
- `git show` or issue/PR source refs that explain why the seam exists.
- Search evidence used to bound the review, such as `rg` results for provider
  calls, `.from(` / `.rpc(`, ownership helpers, timeout/retry helpers, and
  gateway exports.
- Review method and, when an LLM is used, model, prompt/checklist ref, base ref,
  and run commit SHA.

Record template (markdown heading plus Sufficiency Review field names):

```markdown
#### YYYY-MM-DD — seam-internal semantic audit: <seam-id>

- date: YYYY-MM-DD
- acs:
  - acceptance-check:<owning-ac>
- acReviewedRevision:
  - <revision>
- fixtureRef: <repo-relative evidence bundle or command transcript path>
- runCommitSha: <git sha>
- observedOutput: |
    Rubric: <which duplication/excess conditions were checked>
    Input evidence: <repo-relative files, commands, issue/PR/commit refs>
    Review log: method=<human|tool|model>; model=<model-or-none>;
      baseRef=<ref>; promptRef=<prompt/checklist-or-none>;
      cases=<n>; accepted=<n>; rejected=<n>;
      findings=<stable ids with file refs>
- gaps:
  - adopt: <confirmed excess, missing record, or follow-up>
  - reject: <false positive or intentionally duplicated path with reason>
- verdict: met | not-met | unknown
```

If no owning Acceptance Check exists, do not mint or fake one in this map. Keep
the same record shape in the advisory transcript, set `verdict: unknown`, and
write `unknown — 기록 부재` in `observedOutput` and `gaps`. That gap decides
whether the format needs a canonical source outside Contract Maps after the
pilot.

Every finding needs a stable id, a concrete file ref, the rubric clause it
matched, and either `adopt` or `reject` treatment. Free-form "this feels
overengineered" prose is not an acceptable audit result.

## Release Dimensions

Release readiness is not one gate. It combines:

- Intent verdict;
- Acceptance Check trace;
- core-product Service Policy Coverage Review status;
- Aspect verdict.

For status reading, use [`verdict-reading.md`](verdict-reading.md).

Source:

- [`docs/principles.md`](../principles.md)

## Sufficiency Review Hardening

The hardening gates prevent a review entry from claiming `met` without enough
evidence. The main tools are:

- AC revision and stale review detection;
- AC slug rules;
- Sufficiency Review YAML schema;
- revision drift signals;
- deterministic critical-finding and revision gates;
- mutation testing;
- co-located negative tests;
- exact-head review closeout.

Source:

- [`docs/verification-gates.md`](../verification-gates.md)

## Normal Local Gate

For PR-shaped local code work, use `npm run quality:fast` unless a narrower targeted
gate is justified. The pre-push hook uses `quality:hook` to select `quality:docs` only
for the prose scope owned by `docs/ci-structure.md`; unknown or mixed changes
retain the full path. PR review closeout still runs for prose changes.
`quality:fast`는 `quality:static`을 통해 committed base와 `HEAD`의 structural
fingerprint를 비교한다. 변화가 없으면 추가 조치가 없고, 변화가 있으면 merge 후
exact `main` snapshot trigger를 출력한다. 이 출력은 `deps:boundaries`나 release
verdict를 대체하지 않는다.
For contract-affecting Story Chain closeout (docs-only edits included), the
canonical alias is `npm run quality:contract` — its gate list is owned by the
`package.json` alias definition, so documents reference the alias by name
instead of enumerating gates (issue #193). The commit-time
`npm run quality:commit` path runs staged Story Chain/surface checks plus the
full `npm run mc:validate-events` event contract gate, because runtime-emitted
canonical event names are scanned across the app rather than only in staged
contract files. Use
`npm run deps:boundaries` when dependency topology changes. Use
`npm run deps:audit` when package manifests, lockfiles, dependency security, or
CI audit wiring changes. For docs-only
contract-map work, the minimum honest set is:

```bash
npm run contract-maps:check
npm run format:check -- docs/contract-maps
npm run mc:validate-story-chain
npm run pk:validate
```

If a map claims current release status, also run:

```bash
npm run mc:status
```

## Change Rule

If a new contract map documents a gate relationship, link to the command and the
owning source. Do not invent a new product validation obligation in this
directory; map hygiene belongs to `contract-maps:check`.
