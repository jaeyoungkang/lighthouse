---
type: design
---

# Issue #297 Q4 technical-grain 후보·관측과 Human ratification

이 문서는 Lighthouse의 effect chokepoint와 변경 propagation을 Human review용으로
기록하고 Q4 machine policy의 Human authority를 소유한다. Machine 입력과 판정은 별도
policy, exact-revision observation, protected assessment가 소유한다. 이 문서의 서술이나
Human `keep/remove` 결정을 deterministic verdict나 merge eligibility로 직접 사용하지 않는다.

## 상태와 범위

| 항목 | 값 |
| --- | --- |
| Issue | [#297](https://github.com/corca-ai/lighthouse/issues/297) |
| 초기 Human 조사 revision | `bc1f706828b9f05c9583729381d9f5bd54497605` |
| 실행 가능한 fixture revision | `aaf5d186d3ad29da1a9e88bc1df035dbf3b2f09b` |
| 최신 checked implementation revision | `b9ba8c42b484e933860f591c807f7b6f56f7c543`; Q4 policy `2026-08-12.v17`, collector `20`, observation `complete`, evidence 12개 전부 exit 0 |
| 관측 시각 | 초기 조사 2026-07-14, executable fixture 2026-07-17, Episteme-only 재평가 2026-07-21, definition-integrity 재결속 2026-08-04·2026-08-06·2026-08-11·2026-08-12, Asia/Seoul |
| Q4 activation core | Architecture Fitness `0.8.0` @ `704cf56a0c2f7d48838f48ed698aa8beefee18db`; current consumer pin is v0.9.1 |
| machine coverage | 승인된 네 effect seam과 두 contract propagation trace는 `included`; dynamic effect, 순수 mechanism-only 미래 locality, production background lifetime, process effectiveness는 `unsupported` |
| machine verdict | PR #366 final run `29569113430`, exact target `64eb5ef8c3b527c1f2e4ad25a1b20834e3f65134`: 지원 case와 coverage `verified / healthy`, merge advisory `allow`; 미지원 네 coverage는 `unknown` |
| Human status | `ratified` — four `keep` boundaries and bounded hardening; unsupported runtime lenses remain `evidence-needed` |
| CAIR | `none` |

초기 조사 당시 v0.5 core에는 executable Q4 case가 없었다. 이후 v0.8.0 core가
`technical-grain` case를 지원했고, 2026-07-15 Human ratification에서 독립
`issue-297-q4-technical-grain` policy를 투영했다. Collector는 exact revision을
materialize해 네 seam의 chokepoint·책임·caller·bypass·invariant, 두 contract trace의
propagation, 부정 테스트와 기존 behavior suite를 수집한다. Protected collection은
이미 보호된 main의 exact target workflow·collector를 authority로 사용해 그 collector가
선언한 guard·test·dependency만 실행한다. Target의 first parent는 비교 baseline일 뿐이며,
이전 main collector와의 identity 일치를 bootstrap 선행조건으로 요구하지 않는다. 따라서
collector·policy 변경을 위한 별도 bootstrap PR을 만들지 않고, 비교 revision을
materialize하는 행위도 임의 target package script에 실행 권한을 주지 않는다.

기존 policy의 machine-readable coverage도 그대로 보존한다.

- `docs/architecture-fitness/pilots/issue-276.policy.json`의
  `coverage:issue-276-technical-grain`
- `docs/architecture-fitness/pilots/issue-278.policy.json`의
  `coverage:technical-grain`

두 entry는 계속 `status: unsupported`, `verdicts: ["unknown"]`이다. 독립 Q4 profile이
생겼다고 과거 Q1 policy의 미지원 coverage를 재해석하지 않는다. Q4 collector도 관측 사실만
기록하며 `match`/`mismatch`나 verdict를 공급하지 않는다.

## 2026-08-27 inline-analysis transport owner 재결속

Issue #683은 client background lifetime과 server effect owner를 분리한다는 기존 Human
`keep` 결정을 바꾸지 않고, inline-analysis의 browser-side request와 store mutation을
`search-view.helpers.ts`에서 `background-inline-analysis.ts`로 이동했다. Q4 collector는
현재 revision에서 이 background owner를 effect acquisition point로 관측한다. 기존 checked
fixture revision은 이동 전 helper가 transport를 소유하므로, adapter는 현재 owner를 우선하고
해당 심볼이 없는 과거 revision에서만 legacy helper를 읽는다. 두 owner가 동시에 transport를
획득하면 단일 effect acquisition point가 아니므로 관측을 불완전하게 만들어 fail-closed한다.

정책의 seam, chokepoint, responsibility, invariant, allowed caller, unsupported coverage는
그대로 유지한다. 이 재결속은 새 keep/reshape/remove 결정이나 새 runtime verdict를 만들지
않으며, current collector definition과 checked raw observation의 authority binding만
갱신한다.

## 2026-08-06 collector definition 재결속

Protected-main attestation run `31023341081`은 exact target `02013e90`의 profile matrix를
전부 수집한 뒤 aggregate `collect`에서 fail-closed로 중단됐다. PR #587이 trusted Q4
source-policy test의 owner-auth mutation을 `replace`에서 `replaceAll`로 강화했지만, 해당 test를
포함하는 collector definition digest는 이전 값 `ec9af97f…`에 머물러 있었다. 관측된 digest는
`6b75e593…`였으며, 불일치 때문에 서명 단계는 실행되지 않았다.

복구는 seam·coverage·verdict 의미를 바꾸지 않고 policy `2026-08-06.v11`, collector `14`를
현재 trusted definition에 재결속했다. 기존 fixture revision `b9ba8c42`를 다시 수집한 checked
observation은 네 seam, 두 propagation trace, evidence 12개를 모두 `complete`·exit 0으로
기록한다. 이 파일은 여전히 unsigned local observation이며 authoritative verdict는 후속
protected-main attestation만 소유한다.

같은 무방비 의존성이 다시 merge되지 않도록 Architecture Fitness process unit test가
checked-in Q4 policy digest와 현재 collector definition digest의 일치를 직접 검증한다.
따라서 이후 trusted test·guard·dependency 변경은 `quality:fast`에서 policy 재결속 누락을
차단한다. Dynamic effect, mechanism-only locality, production background lifetime, process
effectiveness는 계속 `unsupported / unknown`이다.

## Authority binding

Desired policy는 아래 authority와 2026-07-15 Human ratification에서만 투영한다. 초기 조사는
exact chokepoint를 승인하지 않았지만, ratification comment가 네 경계와 bounded hardening을
승인했다. 그 comment에 없는 runtime lens는 계속 `evidence-needed`다.

```text
Human-approved review criteria
→ 이 문서의 technical-grain policy candidates와 Human ratification
→ exact-revision import·call·runtime-path inventory
→ Human comparison과 ratification comment
→ bounded implementation과 guard evidence
```

| authority source | revision 또는 identity | SHA-256 | 이 문서가 참조하는 의미 |
| --- | --- | --- | --- |
| [Issue #297 body](https://github.com/corca-ai/lighthouse/issues/297) | 2026-07-13 body snapshot | `7744392e1f3cea410bea6e9ff001222cb2458b2ee3c75031dd48133659954ea5` | Q4 소유 범위, effect record 항목, `unsupported / unknown` 경계 |
| [2026-07-15 Human ratification](https://github.com/corca-ai/lighthouse/issues/297#issuecomment-4971843973) | comment `4971843973` | `9cf091952874c317b5a17fbdff1886df372678a22b704658520d8129420509d4` | 네 `keep` 경계, 다섯 bounded hardening, `unsupported / unknown` 유지 |
| [#307 ownership propagation comment](https://github.com/corca-ai/lighthouse/issues/297#issuecomment-4965901780) | comment `4965901780` | `6d322fa186f7dfda3fbca61050c0368a71da8c1f13cef87c86b3c30ad90a28a6` | 제품 의미와 mechanism authority의 분리, 혼합 조항의 `evidence-needed` 처리 |
| `docs/principles.md` | Lighthouse `bc1f7068` | `fca2bd04104895b3bf01cb3c79ba73f6b7c23a0a134e00da0c7c6b0057efcef8` | route/domain-access/repository 구조와 abstraction reduction 원칙 |
| `docs/conventions.md` | Lighthouse `bc1f7068` | `42b209fe9037eab7ebc7a3682c28a9e2c4d9bd820d05f049d77d3211b2be28f7` | layer responsibility, allowed imports, background lifetime, AI generation boundary |
| `docs/runtime-flows/search-mechanism.md` | Lighthouse `bc1f7068` | `57696bb03531cf3bc4428c057fc94fd447cbcee9213661fa1b8c2f602baf4a9a` | literature provider timeout·retry·breaker와 request cancellation 순서 |
| `docs/runtime-flows/ai-response-generation.md` | Lighthouse `bc1f7068` | `4e334cddcc52512ecdfdb45ee388f3517840286e3f4076db38e06013e14f633b` | structured generation deadline, retry, nullable fallback, usage 기록 순서 |
| `promise:search-results-fast-window` | Lighthouse `bc1f7068` | `54ae4d29a877b7417b7196a2e174efa4cc37f69c0603e5fa85d01988efd697d7` | 검색 결과 timing과 provider 저하 시 사용자-facing 의미 |
| `promise:reaction-from-visible-snapshot` | Lighthouse `bc1f7068` | `8074de63e45075746a3598cee323e9158b065a94e4699f5a9f2ba4cbdcb6d493` | visible snapshot에 묶인 AI comment 의미 |
| `aspect:provider-failure-degraded-mode` | Lighthouse `bc1f7068` | `c6fc95517b1373ac424bbfa791040a3219f4216f2d6f3398cf10dfc97f062e09` | provider 실패를 사용자에게 표시하는 cross-surface 제약 |
| `aspect:route-view-ai-comment-generation-routing` | Lighthouse `bc1f7068` | `8c2a3d312c5397f19d028094494664f71abb32bafa07f00f577190e7c10e3702` | route-view AI comment의 bounded generation 의미 |

Issue body digest는 `gh issue view 297 --json body --jq .body`의 UTF-8 출력에 마지막
줄바꿈을 포함해 계산했다. tracked file digest는 `git show <revision>:<path>` 출력으로
계산했다. Issue body나 comment가 바뀌면 이 projection은 stale이다.

Issue #307은 이 작업의 선행 gate가 아니다. 다만 아직 분리되지 않은 Story Chain 조항만
desired architecture의 근거일 때는 현재 코드에서 policy를 역생성하지 않는다. 그 조항은
`evidence-needed`로 남긴다.

## 2026-07-15 Human ratification과 bounded hardening

Human은 아래 technical-grain 권고를 승인했다.

- literature provider gateway와 provider-specific breaker를 `keep`한다. Episteme breaker는
  instance self-protection으로 유지하며 fleet-wide 중앙화는 production evidence가 생길 때만
  다시 연다.
- structured AI gateway를 `executeJudgment`와 분리한 현재 경계를 `keep`한다. gateway는
  provider acquisition·deadline·retry·usage normalization, judgment는 parsing·fallback·usage
  ledger를 소유한다.
- domain-access와 repository 분리를 `keep`한다. 전자는 principal·product action·service
  composition, 후자는 table/RPC·row mapping을 소유한다. Reviewed-paper 목록은 실행마다
  owner-scoped DB에서 읽으며 framework cache나 mutation invalidation을 두지 않는다.
- client background lifetime과 server effect owner 분리를 `keep`한다. browser cancellation과
  stale completion은 client owner, auth/provider/DB effect는 server owner가 소유한다.
- 연결되지 않은 DOI resolver chain과 빈 `repository/index.ts`는 제거한다. 확인된 caller나
  독립 diagnostic 가치가 없는 abstraction은 보존하지 않는다.
- Moonlight library의 기존 5초 전체-operation deadline을 provider gateway가 소유한다.
  pagination·mapping은 service에 남기고 caller abort와 absolute deadline 합성은 gateway에서
  닫는다.
- Amplitude HTTP sink와 Supabase SDK/auth transport를 literature provider gateway로 합치지
  않는다. 각각 `app/server/services/analytics/amplitude-sink.ts`와 `app/server/auth/supabase.ts`를 explicit
  outbound owner로 두고 scoped raw-transport guard로 sibling bypass를 거부한다.
- AI guard는 `@ai-sdk/openai` provider acquisition도 gateway 밖에서 거부하고 negative
  production-source fixture로 false pass를 막는다.

2026-08-11의 #616은 이 effect seam의 책임과 public export를 유지한 채 server-only
owner를 `app/server/`로 옮겼다. 이 문서의 current path는 새 배치를 사용한다.
Exact historical Q4 observation과 collector는 고정된 과거 revision의 이전 경로를
계속 사용한다. 이 호환은 각 collector definition에 결속된 full commit SHA에서만
명시적으로 여는 고정 revision 전용 경로다.
현재 guard는 이전 Gemini·Supabase owner의 복귀와 current/legacy owner 동시 존재를
거부한다.

이 결정은 consumer-owned architecture policy다. Pinned v0.8.0 core의 executable Q4 case는
이 승인 범위의 구현 준수만 판정한다. Human `keep/remove`와 machine
`healthy/degraded/unknown`, merge eligibility를 합치지 않는다.

## Technical-grain policy candidates

아래 표는 authority-derived review 후보의 의미를 보존하면서, 현재 경로 이름과 behavior
evidence를 `b9ba8c42b484e933860f591c807f7b6f56f7c543`에서 다시 대조한 입력이다. 표 안의
`candidate disposition`은 당시 승인 전 기록이며, 현재 결정은 위 Human ratification
section과 finding decision register가 소유한다.

### Literature provider HTTP effect

| 항목 | 선언 |
| --- | --- |
| policy / effect | Episteme literature HTTP, DOI landing fetch, Moonlight Scholar library page fetch |
| owner | provider/network failure policy는 Operational Readiness와 관련 runtime-flow가 소유한다. 사용자-facing degraded 의미는 Story Chain이 소유한다. |
| intended chokepoint | production literature GET/POST는 Episteme-only `external-http-gateway/literature-provider-fetch.ts`와 `episteme-circuit-breaker.ts`를 지난다. DOI와 Moonlight Scholar는 서로 다른 failure policy이므로 각각 `doi-fetch.ts`, `moonlight-scholar-library-fetch.ts`를 지난다. |
| 선택 근거 | runtime provider를 이해하는 가장 좁은 경계에서 host allowlist, timeout, bounded connect retry, breaker lane, load-shed를 함께 적용한다. unrelated external effect를 파일 수를 줄이기 위해 한 함수로 합치지 않는다. |
| allowed callers / public entrypoints candidate | `episteme-literature.ts`, `episteme-paper-neighborhood.ts`, `library-context-source.ts`가 live path에서 각 gateway export를 호출한다. `pdf-url-resolver.ts`는 DOI gateway를 부르지만 resolver 자체의 production·test caller가 없다. caller는 URL·domain mapping과 사용자 결과 fallback을 소유한다. |
| forbidden edges | `app/api`, `app/server`, `packages`, 모든 `app/**/route.ts`, 루트 `proxy.ts` production code에서 gateway 밖 raw `fetch`를 호출하지 않는다. provider API key, retry, breaker를 service와 route에서 다시 구현하지 않는다. |
| required behavioral invariants candidate | Episteme host만 허용하고 breaker와 core/optional lane capacity를 적용한다. Literature provider path는 caller abort와 내부 timeout을 합성한다. DOI는 현재 caller signal과 내부 timeout 중 하나만 선택하고, Moonlight는 caller signal만 받으므로 두 wrapper의 deadline 의미는 별도 Human decision이 필요하다. 실패는 service가 해석할 `Response-or-null`로 번역한다. |
| 숨기는 책임 | provider host 분류, request metadata, timeout, bounded connect retry, circuit state, concurrency queue, failure normalization |
| mechanism-only propagation | stable `Response-or-null` 계약 안의 timeout·backoff·capacity 조정은 gateway, runtime-flow, gateway behavior test와 관련 operational rail에서 닫는다. public export가 같으면 caller와 Story Chain을 바꾸지 않는다. |
| contract·Promise propagation | 사용자 대기 한도, partial/degraded 의미, source transparency, public result shape가 바뀔 때만 Story Chain·Evidence Ledger·caller를 함께 바꾼다. |
| split / merge counter-cost | Episteme transport를 caller별로 분리하면 공통 retry·abort·breaker 분류가 drift한다. Retired provider compatibility를 보존하면 승인되지 않은 우회 seam이 다시 생긴다. DOI·Moonlight까지 literature retry loop에 합치면 서로 다른 auth와 response 의미가 한 정책으로 잘못 묶인다. |
| candidate disposition | 현재 chokepoint가 후보와 같은 모양으로 관측됐다. 유지·분리·통합 결정은 `evidence-needed`다. |

### Structured AI generation effect

| 항목 | 선언 |
| --- | --- |
| policy / effect | Gemini·OpenAI structured generation과 provider usage/cost normalization |
| owner | provider acquisition과 공통 abort/retry/usage는 `app/server/ai-generation/gateway.ts`가 소유한다. model, caller deadline, output schema, nullable/fallback 의미는 owning agent/service와 runtime-flow가 소유한다. |
| intended chokepoint | provider SDK generation은 `executeStructuredGenerationWithUsage`를 지난다. route-view comment는 gateway를 직접 사용하고, tool-level judgment는 `executeJudgment`를 거친다. |
| 선택 근거 | provider SDK와 usage shape를 이해하는 가장 좁은 경계다. caller-owned output schema와 product fallback까지 gateway로 끌어오지 않는다. |
| allowed callers / public entrypoints | `route-ai-comment-generation.ts`와 `app/server/ai-generation/judgment.ts`가 usage-aware entrypoint를 사용한다. `executeJudgment` caller는 label, Zod schema, fallback, usage ledger를 제공한다. |
| forbidden edges candidate | `app/api`, `app/lib`, `app/server`, `packages`에서 provider acquisition·generation call을 gateway 밖에 추가하지 않는다. `app/server/ai-generation/gemini.ts`는 Gemini client factory만 소유한다. 현재 guard가 이 후보를 전부 증명하지는 않는다. |
| required behavioral invariants | provider retry는 끈다. upstream abort와 absolute deadline을 합성한다. model별 usage를 normalized shape로 만들고 가격표가 있을 때만 cost를 계산한다. provider result가 없으면 usage를 조작하지 않는다. |
| 숨기는 책임 | provider factory와 key, model routing, JSON mode, retry disable, abort/deadline, token usage normalization, price lookup |
| mechanism-only propagation | provider SDK 교체나 usage field normalization은 gateway와 gateway test에서 흡수한다. stable public result와 caller policy가 같으면 Story Chain·caller를 바꾸지 않는다. |
| contract·Promise propagation | model·deadline·fallback 변경이 visible latency, no-output 의미, trust disclosure, response shape를 바꾸면 owning caller, runtime-flow, Story Chain, Evidence Ledger가 함께 바뀐다. |
| split / merge counter-cost | provider별 gateway를 나누면 retry·abort·usage normalization이 중복된다. `executeJudgment`를 gateway로 합치면 Zod parsing, fallback, action label, durable usage ledger 같은 tool policy가 provider acquisition과 결합된다. |
| candidate disposition | 현재 provider gateway와 `executeJudgment` 분리가 관측됐다. 유지·이동 결정은 `evidence-needed`다. |

### Domain access와 repository effect

| 항목 | 선언 |
| --- | --- |
| policy / effect | 인증 principal에 묶인 DB read/write, ownership filter, storage mapping, service와 persistence 조합 |
| owner | domain-access는 auth·ownership과 service/repository 조합을 소유한다. repository는 table/RPC query, row parsing, storage mapping을 소유한다. auth는 raw service-role client를 opaque `RepositoryDbHandle`로 바꾸는 acquisition owner다. |
| intended chokepoint | page/route/server entrypoint → domain-access → service/repository. raw `.from`/`.rpc`는 `app/server/repository/` 안에서만 실행한다. |
| 선택 근거 | domain-access는 principal과 product action을 이해하는 가장 좁은 shared boundary다. repository는 DB primitive와 storage schema를 이해하는 가장 좁은 boundary다. 둘을 합치면 ownership·service composition과 table mechanics가 결합된다. |
| allowed callers / public entrypoints | route/page는 purpose-named domain-access export를 호출한다. domain-access와 bounded auth snapshot exception만 repository runtime을 호출한다. services는 repository runtime을 호출하지 않는다. type-only `RepositoryDbHandle` import는 runtime acquisition이 아니다. |
| forbidden edges | route/page→repository, service→repository, repository barrel import, repository 밖 `.from`/`.rpc`, unregistered raw DB client, owner filter 없는 persisted artifact mutation |
| required behavioral invariants | auth-derived principal만 owner predicate에 참여한다. repository handle은 raw table capability를 노출하지 않는다. Reviewed-paper 목록은 매 실행의 live owner-scoped read를 사용하며 mutation은 framework cache invalidation 성공에 의존하지 않는다. Reviewed-paper access는 citation index·response-tail warm capability를 노출하지 않고, 검색의 library marker와 정렬 근거는 request-owned query-aware graph preflight가 소유한다. gap shared artifact와 viewer preference identity를 섞지 않는다. |
| 숨기는 책임 | domain-access는 auth, service composition, failure boundary를 숨긴다. Reviewed-paper access는 live reviewed-paper 목록만 반환하며 별도 derived citation cache를 소유하지 않는다. repository는 schema name, query builder, owner predicate, row validation을 숨긴다. |
| mechanism-only propagation | query/index/row-parser 변경은 repository와 repository test에서 닫는다. stable domain result가 같으면 route와 Story Chain을 바꾸지 않는다. |
| contract·Promise propagation | persistence lifetime, ownership, recovery, user-visible currentness가 바뀌면 domain-access, runtime-flow, CAIR, Story Chain과 evidence가 함께 바뀐다. |
| split / merge counter-cost | domain-access를 제거하면 auth/service composition이 route에 반복된다. repository를 domain-access에 합치면 DB schema와 product action이 결합되어 storage 교체와 ownership review 범위가 넓어진다. |
| candidate disposition | 현재 두 경계가 관측됐다. 유지·통합 결정과 whole-capability Q4 decision은 `evidence-needed`다. |

### Background effect lifetime

| 항목 | 선언 |
| --- | --- |
| policy / effect | route-lifetime search enrich·term discovery·inline analysis와 renderer-lifetime hydration·viewer sync |
| owner | route-lifetime client work는 `ResearchBackgroundTasks`와 purpose helper가 소유한다. renderer-lifetime work는 owning renderer가 소유한다. 서버 effect는 각 API route 뒤의 domain-access/service/gateway가 소유한다. |
| intended chokepoint | client background scheduler → purpose API route → auth/domain-access 또는 service → external/AI/repository chokepoint |
| 선택 근거 | browser lifecycle과 provider/DB policy를 한 module에 합치지 않는다. client owner는 cancellation과 active execution을 이해하고, server owner는 principal과 external effect policy를 이해한다. |
| allowed callers / public entrypoints | `ResearchBackgroundTasks`와 renderer helper가 `API_ROUTES`의 bounded endpoint를 호출한다. server route는 request signal과 route deadline을 downstream에 전달한다. |
| forbidden edges | client가 `app/server/**`를 import하지 않는다. background helper가 raw provider나 DB client를 얻지 않는다. renderer가 route-lifetime task를 새로 소유하지 않는다. |
| required behavioral invariants | execution/view가 바뀌면 stale completion을 적용하지 않는다. abort는 server request signal까지 전달한다. background failure가 user-facing primary result를 조용히 대체하지 않는다. |
| 숨기는 책임 | client execution lifetime, dedupe, cancellation, retry scheduling과 server auth/effect coordination의 분리 |
| mechanism-only propagation | scheduling delay·coalescing 변경은 helper/runtime test에서 닫는다. endpoint contract와 visible state가 같으면 server policy와 Story Chain을 바꾸지 않는다. |
| contract·Promise propagation | pending/degraded/failed 표시, retry 의미, result lifetime이 바뀔 때 runtime-flow와 Story Chain이 함께 바뀐다. |
| split / merge counter-cost | renderer마다 route task를 나누면 cancellation과 duplicate request policy가 drift한다. 모든 renderer task를 global owner로 올리면 unmount와 viewer-specific lifetime이 불명확해진다. |
| candidate disposition | 현재 ownership rule이 관측됐다. browser/server runtime trace가 없어 유지·변경 decision은 `evidence-needed`다. |

## Exact-revision path inventory

아래 경로는 `b9ba8c42b484e933860f591c807f7b6f56f7c543` source의 import와 call을
재수집한 결과다. desired policy를 선언하지 않으며 `match`/`mismatch`를 기록하지 않는다.

| effect | observed path | static evidence | behavior evidence |
| --- | --- | --- | --- |
| keyword/relationship provider | research route·search service → `episteme-literature.ts` → `epistemeFetch`/`epistemePostFetch` → `performRetriedEpistemeRequest` → Episteme breaker → `fetch` | `rg` import/call inventory, `guard:external-http-gateway`, `deps:boundaries` | `literature-provider-fetch.test.ts`, `episteme-circuit-breaker.test.ts` |
| graph-neighbor provider | `graph-neighbor-hydration-access.ts` → `hydrateEpistemePapers` → `episteme-literature.ts` → literature gateway | domain-access/service import inventory | gateway behavior tests. browser→route lifetime trace는 없음 |
| DOI resolution definition | `resolvePdfUrlAsync` → `resolvePdfUrlFromDoi` → `fetchDoiLandingPage` → raw `fetch`. 그러나 repository-wide reference scan에서 public resolver의 production·test caller가 없어 현재 revision에서는 entrypoint에 연결되지 않은 definition chain이다. | definition 내부 import/call만 존재하며 live effect 증거가 아님 | 별도 DOI wrapper behavior test와 entrypoint call-path test 없음 |
| Moonlight library | `/api/library-context/bootstrap` → `library-context-source.ts` → `fetchMoonlightScholarLibraryPage` → injected/default `fetch` | route/service/gateway import inventory | gateway wrapper 단독 behavior test 없음. caller tests는 별도 product scope |
| route AI comment | client scheduler/transport → `POST /api/route-ai-comments/generate/:viewId` → `generateRouteAiComment` → `executeStructuredGenerationWithUsage` → Gemini/OpenAI SDK → async usage domain-access→repository | served entrypoint와 direct imports | `gateway.test.ts`, route/generation tests는 Story Chain ledger가 별도 소유 |
| term discovery | `ResearchBackgroundTasks` helper → `POST /api/search/term-discovery` → `runSearchTermDiscoveryOnMetadata` → `executeJudgment` → structured gateway; optional usage ledger → `llm-usage-access` → repository | route/service/helper imports | service·route tests. full browser/provider trace 없음 |
| inline analysis | background helper → `POST /api/papers/analyze-inline` → `resolveInlineAnalysis` → `analyzePapersInline`/`executeJudgment` → structured gateway; shared cache RPC는 domain-access→repository | route/domain/service/repository imports | inline-analysis timing/cache suites. multi-instance lifetime은 Q5 scope |
| reviewed papers | `/api/papers/reviewed` 또는 library bootstrap → `reviewed-paper-access` → auth-derived handle/principal → `reviewed-papers` repository → `lighthouse.reviewed_papers` | dependency boundaries, repository seam, least-authority guard | auth-boundary, opaque-handle, repository owner-predicate tests |
| gap report build | `POST /api/gap-reports`가 core build/recovery를, `POST /api/gap-reports/:id/enrichment-retry`가 저장 core 위의 명시적 enrichment retry admission을 소유한다. 두 경로는 `gap-network-view-access` → gap service/repository → `after()` runner → structured generation and persistence를 재사용하고 status route는 저장 상태만 관찰한다. | route/domain/service/repository inventory와 exact-caller least-authority guard | gap runner·retry command·PostgreSQL CAS suites. platform `after()` lifetime과 deployment trace는 없음 |

## Guard coverage matrix

Guard success는 아래 covered 범위만 증명한다.

| gate | covered | unsupported / excluded | base result |
| --- | --- | --- | --- |
| `guard:external-http-gateway` | `app/api`, `app/server`, `packages`, 모든 `app/**/route.ts`, 루트 `proxy.ts`와 retired negative root인 `app/lib/analytics/sinks`, `app/lib/supabase`의 TS/TSX에서 raw `fetch`, `fetchImpl` call과 default fetch fallback을 찾는다. Server gateway directory, 현재 Amplitude sink owner, 현재 Supabase server owner만 허용한다. | dynamic module/callback acquisition, SDK 내부 HTTP, browser transport 전체, runtime callback lifetime은 보지 않는다. | current scoped source, bypass 0, exit 0; current sibling과 retired-path negative fixture pass |
| `guard:ai-generation-gateway` | `app/api`, `app/lib`, `app/server`, `packages`에서 `@ai-sdk/google`·`@ai-sdk/openai`·`@google/genai` static import, `ai`의 알려진 named/namespace generation call과 Google generate-content call을 찾는다. 현재 gateway와 Gemini factory만 허용하며, 이전 Gemini owner는 explicit exact-revision collection에서만 단독 layout으로 허용한다. | tests, dynamic import/alias, 목록에 없는 SDK API와 provider runtime behavior는 보지 않는다. | current production source, 선언된 pattern violation 0, exit 0; default/historical/duplicate owner negative fixture pass |
| `guard:repository-seam` | `app`, `packages`에서 repository 밖 direct/static element/known alias `.from`·`.rpc`와 id-only legacy mutation을 AST policy로 찾는다. | repository 내부 owner predicate의 의미, non-Supabase DB SDK, runtime-generated acquisition, tests는 이 gate가 증명하지 않는다. | current exact-revision guard exit 0 |
| `deps:boundaries` | client→server, server→UI, route/page→repository, service→repository, repository barrel의 static dependency edge | runtime callback, dynamic data-driven call, execution order와 behavior는 보지 않는다. | current exact-revision dependency check exit 0 |
| `guard:least-authority-boundaries` | 활성 My Library owner-access subcase와 bound production acquisition rules | 전체 repository/domain-access technical grain, Q4 locality, deployment/runtime effect는 지원하지 않는다. | current exact-revision guard exit 0 |
| gateway behavior tests | Episteme-only host admission, bounded cold-connect retry, breaker/lane/capacity, AI provider deadline/no-retry/usage와 repository handle/owner path | production network trace, multi-instance state, dynamic callback coverage는 아니다. | Q4 checked observation `complete`; referenced evidence exit 전부 0 |

## Representative change propagation

### External provider timeout·retry·load-shed — commit `358c1269`

PR #184의 actual change를 `git show 358c1269`로 추적했다.

| 단계 | actual propagation | 분류 |
| --- | --- | --- |
| authority/docs | `docs/incident-183-load-baseline.md`, `docs/runtime-flows/search-mechanism.md`에 deadline, retry, breaker, capacity를 기록했다. | mechanism authority와 operational evidence |
| gateway | literature fetch를 `external-http-gateway`로 옮기고 Episteme breaker와 DOI/Moonlight wrapper를 추가했다. | mechanism-only |
| caller | `episteme-literature`, `episteme-paper-neighborhood`, `library-context-source`, `pdf-url-resolver`는 raw fetch 대신 같은 result 의미의 gateway export를 호출했다. | required seam migration. provider policy가 caller에 복제되지 않음 |
| tests | literature retry/throttle와 breaker state/capacity tests를 추가했다. | mechanism evidence |
| guard | `guard:external-http-gateway`를 추가해 새 raw fetch bypass를 막았다. | structural defense |
| Story Chain / evidence | first-result timing, background enrichment, Moonlight auth fallback처럼 사용자 의미도 같은 incident에서 바뀌어 Promise와 Evidence Ledger가 갱신됐다. | contract propagation. gateway 이동만의 필수 propagation은 아님 |

이 trace는 변경 파일 수만으로 high propagation을 선언할 수 없음을 보여 준다. raw fetch
이동과 breaker는 stable caller result 안의 mechanism 변경이었다. 같은 PR에 포함된 사용자
timing·fallback 변경은 별도 contract delta라 Story Chain까지 전파되어야 했다. 이후 timeout
상수만 바꾸고 사용자 의미를 유지한다면 gateway, runtime-flow, test와 operational rail 안에서
끝나는 것이 기대값이다.

### AI model·deadline·fallback — commit `61a1110d`

PR #229의 actual change를 `git show 61a1110d`로 추적했다.

| 단계 | actual propagation | 분류 |
| --- | --- | --- |
| authority/docs | `docs/runtime-flows/ai-response-generation.md`가 trust disclosure와 provider boundary를 기록했다. | runtime/contract authority |
| gateway | OpenAI model routing, key loading, JSON mode, no-retry와 deadline을 기존 structured entrypoint 안에 추가했다. | mechanism-only provider extension |
| caller | route AI generation caller는 visible snapshot의 absence/source-limit rules를 추가했다. gateway public result는 유지됐다. | contract change. provider extension 때문에 바뀐 것이 아님 |
| tests | gateway가 GPT/Gemini routing과 deadline을 검증했고 agent tests가 trust disclosure를 검증했다. | mechanism evidence와 contract evidence 분리 |
| guard | 기존 AI gateway seam을 유지했으므로 guard file은 바뀌지 않았다. 기존 guard가 provider direct call 금지를 계속 소유했다. | no propagation이 expected |
| Story Chain / evidence | `promise:reaction-from-visible-snapshot`, visible explanation Aspect와 snapshot ledger가 source-limit/absence 의미를 함께 갱신했다. | required contract propagation |

OpenAI SDK 교체나 usage field normalization만 일어날 때 caller와 Story Chain까지 바뀌면
mechanism leakage 후보다. 반대로 visible snapshot의 부재 해석이나 nullable failure 의미를
바꾸면서 gateway test만 고치면 required contract propagation이 누락된다.

## Pass-through와 deep-module review

| hop | 숨기는 책임 | 제거·통합 counter-cost | 현재 finding |
| --- | --- | --- | --- |
| `doi-fetch.ts` | DOI request header, redirect, network failure→null과 caller signal이 없을 때만 적용되는 8초 timeout | service로 합치면 raw transport와 PDF parsing이 결합되지만, public resolver 전체가 entrypoint에 연결되지 않아 유지 효용이 없었다. | Human `remove`; disconnected chain 삭제 |
| `moonlight-scholar-library-fetch.ts` | bearer header, no-store, cursor URL, injectable transport와 5초 전체-operation deadline | service로 합치면 pagination/domain mapping에 auth transport가 섞인다. gateway deadline wrapper는 pagination을 가져오지 않고 caller abort와 absolute timeout만 소유한다. | Human `keep`; timeout owner 명시 |
| `literature-provider-fetch.ts` + breaker | Episteme host admission, timeout, bounded cold-connect retry, capacity, failure normalization | 합치면 모든 caller가 policy를 다시 이해해야 한다. transport와 breaker를 완전히 나누면 공통 abort/retry semantics가 drift한다. | deep module candidate, `evidence-needed` |
| `executeStructuredGenerationWithUsage` | provider routing, deadline, retry disable, usage/cost normalization | provider별 분리는 usage/deadline 정책을 복제한다. caller schema/fallback까지 합치면 product policy와 provider acquisition이 결합된다. | deep module candidate, `evidence-needed` |
| `executeJudgment` | prompt execution, JSON/Zod validation, fallback, observations, durable usage hook | gateway로 합치면 tool policy가 provider policy에 붙는다. 각 caller로 펼치면 parsing/fallback/usage가 반복된다. 현재 owner는 `app/server/ai-generation/judgment.ts`이며 shared→server runtime 예외 없이 server zone 안에 닫힌다. | Human `keep`; responsibility-bearing current placement |
| domain-access→repository | auth/service composition과 DB mechanics를 분리한다. Reviewed-paper 목록은 live read만 소유하고, query-aware graph 근거 계산은 search service 경계에 둔다. | domain-access 제거 시 route마다 auth와 service composition이 반복된다. 합치면 product action과 table schema가 결합된다. | deep pair candidate, `evidence-needed` |
| `repository/index.ts` | runtime export와 importer가 없고 direct-path migration 안내만 중복했다. | canonical no-barrel 규칙은 `docs/conventions.md`가 소유한다. | Human `remove`; 빈 안내 파일 삭제 |

## Confirmed facts와 remaining unknown

### Confirmed static·behavior facts

- 선언된 external HTTP scan 범위에서 gateway 밖 raw fetch는 0건이다. Analytics sink와
  Supabase transport scope는 explicit owner 파일만 허용한다.
- 선언된 AI scan pattern에서 gateway 밖 provider generation violation은 0건이다.
  `@ai-sdk/openai` static provider acquisition도 pattern과 negative fixture에 포함된다.
- repository seam 밖 Supabase table/RPC access와 id-only legacy mutation은 0건이다.
- route/page→repository와 service→repository를 포함한 dependency violation은 0건이다.
- gateway와 reviewed-paper owner path의 targeted 47 tests가 통과했다.
- 두 기존 Q1 policy의 technical-grain coverage entry는 `unsupported / unknown`이며,
  독립 Q4 profile이 승인된 네 seam과 두 trace를 수집한다.

이 사실은 Q4 `healthy`를 뜻하지 않는다. 현재 hop이 가장 좋은 grain인지, 모든 dynamic
effect가 같은 경계를 지나는지, process-local breaker가 deployment 전체에서 충분한지는
증명하지 않는다.

`app/server/services/analytics/amplitude-sink.ts`와 `app/server/auth/supabase.ts`는 서로
다른 effect 의미를 소유하므로 literature gateway로 합치지 않는다. External HTTP
guard는 `app/server/` 전체를 스캔하되 이 두 owner 파일과 provider gateway만 raw
transport를 허용한다. 이전 `app/lib` owner 디렉터리도 negative root로 계속 스캔하되
허용 파일은 두지 않는다. 이 static guard는 SDK 내부 HTTP나 runtime callback의 완전성을
증명하지 않으므로 Q4 전체 verdict는 `unknown`이다.

## Finding decision register

Issue #297의 초기 register는 모든 finding을 `evidence-needed`로 시작했다. 2026-07-15 Human
ratification이 닫은 row는 현재 decision과 bounded action으로 갱신했고, 지원되지 않는 runtime
렌즈는 그대로 남겼다. `evidence command`는 현재 사실을 재수집하는 명령이다. Machine
verdict는 독립 Q4 policy와 protected assessment에서만 나온다.

| finding id | confirmed fact / unknown | Human decision | smallest action | re-entry trigger | evidence command |
| --- | --- | --- | --- | --- | --- |
| `q4-literature-gateway-grain` | literature gateway와 provider-specific breaker가 transport policy를 숨기지만 deployment-wide capacity는 증명되지 않았다. | Human `keep` | gateway와 breaker를 유지한다. Fleet 중앙화는 #280 production evidence가 생길 때만 다시 연다. | timeout/retry/breaker/capacity 변경 | `npm run guard:external-http-gateway && npx vitest run app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts` |
| `q4-ai-gateway-grain` | structured gateway가 provider policy를 숨긴다. OpenAI acquisition false pass는 bounded guard gap이었다. | Human `keep` + harden | `@ai-sdk/openai` acquisition detection과 failing production-source fixture를 추가했다. | AI SDK·model·deadline·retry·usage policy 변경 | `npm run guard:ai-generation-gateway && npx vitest run scripts/quality/__tests__/check-effect-owner-guards.test.ts app/server/ai-generation/__tests__/gateway.test.ts` |
| `q4-domain-repository-grain` | domain-access와 repository는 서로 다른 책임을 숨기지만 whole-capability navigation cost는 측정되지 않았다. | Human `keep` | 현재 owner 분리를 유지하고 다음 DB mechanism change에서 touched path와 rejected merge alternative를 기록한다. | DB source, owner filter, persistence lifetime 변경 | `npm run guard:repository-seam && npm run deps:boundaries && npm run guard:least-authority-boundaries` |
| `q4-background-lifetime-grain` | client scheduler와 server effect owner의 분리는 review criteria에 부합하지만 production lifecycle trace는 없다. | Human `keep` | 현재 lifetime 분리를 유지하고 production duplicate/lost-work evidence가 생기면 다시 연다. | background owner 변경 또는 duplicate/lost-work incident | `npx vitest run app/components/research/__tests__/ResearchBackgroundTasks.test.tsx app/components/research/__tests__/ResearchBackgroundTasks.condition-ownership.test.ts` |
| `q4-doi-wrapper-grain` | DOI resolver definition chain은 entrypoint와 test caller가 없었다. | Human `remove` | resolver async branch와 DOI gateway 파일을 삭제했다. | 실제 DOI landing lookup 제품 요구가 승인될 때 | `rg -n "resolvePdfUrlAsync|resolvePdfUrlFromDoi|fetchDoiLandingPage" app packages scripts || true` |
| `q4-moonlight-wrapper-grain` | Moonlight wrapper는 auth transport를 숨겼지만 absolute timeout owner가 service에 있었다. | Human `keep` + harden | 기존 5초 전체-operation deadline을 gateway owner로 이동하고 caller abort 합성·cleanup을 behavior test로 잠갔다. | Moonlight timeout incident 또는 SLO change | `npx vitest run app/server/external-http-gateway/__tests__/moonlight-scholar-library-fetch.test.ts app/server/services/__tests__/library-context-source.test.ts app/api/library-context/bootstrap/__tests__/route.test.ts` |
| `q4-execute-judgment-grain` | `executeJudgment`는 parsing/fallback/usage를 숨기며 gateway와 다른 책임을 갖는다. | Human `keep` | 현재 분리를 유지하고 current/legacy owner의 동시 존재는 Q4 bypass로 거부한다. 새 importer가 생기면 placement cost를 다시 비교한다. | 새 runtime importer 또는 duplicated judgment policy | `rg -n "executeJudgment" app --glob '!**/__tests__/**' && npx vitest run app/server/ai-generation/__tests__/judgment.test.ts` |
| `q4-repository-index-grain` | `repository/index.ts`는 export와 importer가 없는 안내 파일이고 canonical no-barrel 규칙은 `docs/conventions.md`가 소유한다. | Human `remove` | 빈 안내 파일을 삭제했다. | repository navigation 변경 | `rg -n "repository(?:/index)?[\"']" app packages --glob '*.{ts,tsx}' || true` |
| `q4-app-lib-http-scope` | Amplitude와 Supabase transport는 literature provider와 다른 effect owner다. | Human separate owners | 현재 두 owner 파일만 explicit allowlist로 선언하고 current sibling과 retired `app/lib` 경로의 raw transport를 거부한다. | owner 파일 이동, 새 analytics/auth transport, 관련 incident | `npm run guard:external-http-gateway && npx vitest run scripts/quality/__tests__/check-effect-owner-guards.test.ts` |
| `q4-dynamic-effect-coverage` | static guard와 Q4 collector는 dynamic module/callback acquisition을 완전히 증명하지 않는다. | `evidence-needed` | 구체적인 dynamic path나 incident가 생기면 bounded runtime trace를 추가한다. | dynamic provider acquisition 도입 또는 관련 incident | `npm run guard:external-http-gateway && npm run guard:ai-generation-gateway && npm run architecture-fitness:validate` |
| `q4-after-lifetime` | `after()` runner와 usage append의 platform lifetime은 static evidence로 닫히지 않는다. | `evidence-needed` | lost-work와 completion evidence를 deployment identity에 묶는다. | platform lifecycle 변경 또는 lost-work incident | 아래 `q4-after-lifetime` 명령 |
| `q4-whole-capability-locality` | 두 실제 change trace는 mechanism과 contract propagation을 구분하지만 authoring/navigation cost를 대표성 있게 측정하지 않는다. | `evidence-needed` | 다음 실제 provider/repository change에서 authority→implementation→test→guard touched path와 authoring time을 기록한다. | representative mechanism 또는 contract change | `git show --stat --oneline 358c1269 && git show --stat --oneline 61a1110d` |
| `q4-deterministic-comparison` | v0.8.0 core와 Lighthouse evidence authority가 generic executable Q4 case를 지원한다. | bounded activation | 독립 Q4 profile과 protected attestation을 유지하되 unsupported runtime·process lens를 승격하지 않는다. | policy, collector, seam, trace 또는 core semantics 변경 | `npm run architecture-fitness:advisory` |

`q4-after-lifetime` evidence command:

```bash
rg -n "after\\(|after:" app scripts && rg --files app | rg "gap.*(__tests__|test)|llm-usage.*test"
```

## Related-scope separation

- #278은 raw DB capability와 owner principal의 least-authority를 소유한다. 이 문서는 그
  machine result를 다시 계산하지 않고 domain-access/repository hop의 책임과 propagation만 본다.
- #280은 macro topology와 service boundary를 소유한다. 이 문서는 service 배치를 평가하지
  않는다.
- #281은 critical path와 latency budget을 소유한다. 이 문서는 SLO 수치를 새로 정하지 않고
  timeout·retry 정책이 어느 owner에서 바뀌는지만 추적한다.
- #307은 Story Chain 조항의 content placement를 소유한다. 이 문서는 stable ref를 사용하고
  Promise 문장을 복제하지 않는다.

## 2026-07-17 protected verdict

PR #366 run `29568223062`는 Q4 profile이 base main
`34b9616109c03eae609b6fe0c6775893f162cc03`에 존재하는
`pull_request_target` workflow에서 exact target
`56c059985f1de991794274f55a451371c70e8847`을 수집했다. 별도 Q4 raw artifact
`8402004270`의 digest
`aef6c2ed2f9233e452527060d72ba7844c92cffb6b3633a6f002f10e836f0a22`는
provenance와 verification에 결속됐고, raw base·target 파일은 attested bundle 입력과
byte-for-byte 같았다.

검증기는 네 seam, 두 contract trace, 12개 evidence와 command exit 0을 확인했다.
`issue-297:technical-grain-conformance`와 지원 coverage는 `verified / healthy`, merge
advisory는 `allow`, blocker는 0이다. Dynamic effect path, 순수 mechanism-only 미래
locality, production browser·platform background lifetime, process effectiveness는 계속
`unsupported / unknown`이다. 이 결과는 승인된 경계의 구현 준수를 닫지만 전체 runtime
건강이나 Q4 투자 효율을 대신 판정하지 않는다.

## Verification commands

아래 명령은 Human review에서 관측 revision을 검토할 때 실행했다. Protected Q4 machine
collector는 materialized comparison revision의 module이나 임의 package script를 실행하지
않는다. Collector-authority guard·source-policy test가 comparison source를 읽고, 별도 Q4 raw
artifact를 target behavior 단계 전에 봉인한다. 따라서 signed Q4 verdict는 승인된 정적
seam·negative policy와 bounded change trace만 판정하고 production runtime lens는 계속
`unknown`이다.

```bash
npm run guard:external-http-gateway
npm run guard:ai-generation-gateway
npm run guard:repository-seam
npm run deps:boundaries
npm run guard:least-authority-boundaries
npx vitest run app/server/external-http-gateway/__tests__/literature-provider-fetch.test.ts app/server/external-http-gateway/__tests__/episteme-circuit-breaker.test.ts app/server/ai-generation/__tests__/gateway.test.ts
npx vitest run app/server/domain-access/__tests__/reviewed-paper-access.auth-boundary.test.ts app/server/repository/__tests__/db.test.ts app/server/repository/__tests__/reviewed-papers.test.ts
npx vitest run app/components/research/__tests__/ResearchBackgroundTasks.test.tsx app/components/research/__tests__/ResearchBackgroundTasks.condition-ownership.test.ts app/server/services/__tests__/pdf-url-resolver.test.ts app/server/services/__tests__/library-context-source.test.ts app/api/library-context/bootstrap/__tests__/route.test.ts app/server/ai-generation/__tests__/judgment.test.ts
npm run architecture-fitness:advisory
```

Architecture Fitness local review는 unsigned다. Q4 case를 포함한 활성 case는 local
attestation이 없으므로 `unknown`이며, merge advisory는 `block`이다. Protected workflow만
Q4의 authoritative `healthy/degraded/unknown`을 낼 수 있고, 그 판정도 unsupported runtime
렌즈나 전체 시스템 건강을 뜻하지 않는다.

## Contract Architecture Impact Review

Contract delta: Issue #297 조사 기록은 approved Q4 seam과 exact-revision evidence를 분리해 기록하며 사용자-facing contract나 runtime owner를 바꾸지 않는다.
Verdict: none
Affected axes: Source of truth and authority; Observability and audit
Existing-boundary evidence: `docs/architecture-fitness/pilots/issue-297-q4-technical-grain.policy.json`과 `scripts/architecture-fitness/collect-q4-technical-grain.mjs`가 approved seam, collector identity, checked observation을 이미 분리한다.
Human decision required: no

이번 변경은 existing authority와 exact-revision evidence를 분리해 기록한다. 사용자-facing
contract, runtime ordering, provider failure policy, state lifetime, effect owner를 바꾸지 않는다.
현재 경계가 충분하다는 architecture verdict를 새로 만들지도 않는다. 따라서 이 조사 기록의
CAIR는 Issue #297에 승인된 대로 `none`이다.

후속 child fix가 effect owner, runtime 순서, provider failure policy, state lifetime 또는
Promise를 바꾸면 그 변경에서 별도 CAIR를 시작한다. Architecture Fitness `unknown`을 CAIR
`none`이나 merge eligibility로 바꾸지 않는다.
