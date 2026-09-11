# Aspect Lifecycle And Case Catalog

이 문서는 Aspect를 새로 만들지 판단하는 순간부터 변경·은퇴·감사하는 절차와
현재 Story Chain에서 검증된 사례를 함께 설명한다. 사례의 정본은 언제나
`docs/contracts/story-chain/`과 코드다. 이 문서는 별도 Aspect registry가 아니며,
경로가 어긋나면 현재 정본을 기준으로 이 reading route를 다시 조사하고 갱신한다.
정본 자체의 결함이 별도로 확인됐을 때만 해당 owner와 Human-authority 경계를
따라 정본을 고친다.

2026-07-23 audit snapshot에는 Aspect 22개와 `appliesTo` edge 135개가 있다. 이
숫자는 기준선이 아니라 조사 시점의 관찰값이다. 추가·변경·은퇴 판단은 현재
Story Chain을 다시 읽어 내린 결과로 한다.

이번 snapshot은 아래 다섯 사례군으로 22개 모두를 조사했다. 이 묶음은 탐색
coverage일 뿐 분류 정본이 아니다.

- 반복 논문 UI: `paper-card-action-loading-feedback`,
  `paper-card-list-windowing`, `paper-card-presentation-consistency`,
  `progressive-content-spatial-stability`
- 사용자 언어와 AI 설명: `ai-comment-research-term-suggestions`,
  `ai-generated-content-feedback`, `reaction-prefers-load-bearing-facts`,
  `route-view-ai-comment-generation-routing`, `route-view-ai-reaction-rules`,
  `user-facing-language-governance`, `ux-writing-voice-and-tone`,
  `visible-explanation-sufficiency`
- runtime 실패와 상태 전환: `context-preserving-transitions`,
  `first-paint-persistence-independence`, `immediate-navigation`,
  `provider-failure-degraded-mode`, `search-first-url-model`
- 연구 맥락과 후속 표면: `knowledge-map-followup-surface`,
  `library-grounded-research`
- 접근·공통 page 표면: `admin-access-control`, `common-page-footer`,
  `document-content-width-governance`

## Layer Classification

| 질문                                                                                | 소유 층                    | 판정 기준                                                                                   |
| ----------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| 이 Promise가 사용자에게 무엇을 보장하는가?                                          | Promise                    | 한 Promise의 고유한 결과·복구·한계다.                                                       |
| 그 보장을 어떤 관찰 가능한 조건으로 판정하는가?                                     | Acceptance Check           | 한 Promise 안에서 독립적으로 참·거짓을 가를 수 있다.                                        |
| 여러 Promise가 같은 사용자·운영자-visible 제약을 지키는가?                          | Aspect                     | 둘 이상의 현재 또는 명시된 인접 Promise에 같은 Advice와 검증 기준이 적용된다.               |
| URL carrier, serializer, repository, scheduler, cache, gateway를 어떻게 구성하는가? | architecture/runtime owner | 교체 가능한 구현 구조다. CAIR, runtime flow, architecture fitness 또는 코드 owner가 맡는다. |
| 선언이 어떤 테스트·명령·fixture로 증명되는가?                                       | Evidence Ledger            | exact evidence와 release verdict를 소유한다.                                                |

다음 순서로 가장 작은 올바른 층을 고른다.

1. 규칙을 한 Promise의 AC 하나로 완전히 닫을 수 있으면 Aspect가 아니다.
2. 같은 visible constraint가 다른 Promise에도 실제로 적용되고, 한쪽만 바꾸면
   사용자 경험이 서로 어긋나면 Aspect 후보로 올린다.
3. 공유되는 것이 carrier나 내부 메커니즘뿐이면 Aspect로 올리지 않는다.
4. Aspect는 Promise의 핵심 결과를 다시 쓰지 않는다. Pointcut을 더 엄격하게
   만드는 shared Advice만 소유한다.
5. 정확한 테스트, 명령, fixture, endpoint 이름은 covering Evidence Ledger나
   기술 owner에 둔다.

## Lifecycle

### 1. Discover And Classify

- 반복되는 AC 문장, 여러 surface의 같은 사용자-visible 제약, 한 surface 수정이
  다른 surface의 drift를 만드는 사례를 수집한다.
- 후보 Promise와 인접 Promise를 모두 읽고 `contract-layer-routing.md`로
  Promise/AC, Aspect, architecture/runtime 경계를 분류한다.
- Aspect로 승격하지 않을 대안도 기록한다. 보통 Promise-local AC 유지 또는
  runtime/architecture owner 이동이다.
- 제품 의미를 새로 만들거나 바꾸면 여기서 멈추고 Human authority를 받는다.

### 2. Approve And Author

- Human이 새 Advice와 pointcut을 승인한 뒤에만 `aspect:<slug>`를 만든다.
- `Why`, `Pointcut`, `Advice`, `Verification` 네 절을 작성하고 frontmatter에는
  `appliesTo`, `coveringLedger`, `verdict`를 둔다.
- Advice는 shared visible constraint를 한 번만 선언한다. 현재 Promise AC가
  같은 수치나 임계치를 복제하고 있으면 의미를 임의로 합치지 말고 authority
  drift로 표시한 뒤 Human이 승인한 의미 변경에서 정리한다.

### 3. Survey The Pointcut

- 이름이나 component 검색만으로 pointcut을 확정하지 않는다. 사용자 행동,
  route, 고정 문구와 생성 문구, 성공·실패·복구 경로를 각각 조사한다.
- 모든 pointcut Promise는 global reciprocal `promise.aspects` 선언과 맞아야
  한다. 지정 `coveringLedger`는 자신이 직접 소유하는 Source Promise와 Applied
  Aspect, AC/IC evidence를 맞춘다.
- pointcut의 나머지 evidence가 target-owning ledger에 분산돼 있으면 그 위임을
  따라가 검증한다. 모든 target을 지정 ledger 하나의 Source Promise나 중복
  evidence row로 모으지 않는다.
- 후보였지만 제외한 Promise와 이유를 작업 기록에 남긴다. 제외 이유가
  "아직 구현하지 않았다"뿐이면 pointcut 누락일 수 있다.

### 4. Propagate And Verify

- Advice clause마다 Promise, surface와 현재 evidence route를 연결한 matrix를
  만든다. owning ledger가 직접 소유하는 경로는 ledger row와 deterministic 또는
  live-judge evidence를 적고, parsed ledger pair가 없는 기존 경로는 그 부재를
  semantic advisory로 남긴다.
- `// @aspect` tag는 실제 Advice가 도달하는 user-facing 또는 operator-facing
  surface에 둔다. tag 자체를 구현 증거로 보지 않는다.
- covering ledger가 exact evidence와 Sufficiency Review를 소유한다. 변경된
  Advice의 일부만 증명되면 verdict는 `unknown` 또는 `not-met`이다.
- targeted evidence를 먼저 실행하고 마지막에 `npm run quality:contract`로
  전체 weave를 닫는다.

### 5. Change, Split, Or Merge

- Advice 의미, pointcut의 적용 범위, 임계치, 예외, visible 실패 정책이 바뀌면
  제품 의미 변경으로 취급하고 Human authority를 다시 받는다.
- 의미와 stable id를 보존하는 문구 명료화, evidence owner/path 갱신, 이미
  승인된 pointcut의 기계적 전파는 Agent가 수행할 수 있다. 의미 보존 여부가
  불분명하면 제품 변경으로 간주하기 전에 Human에게 확인한다.
- clause마다 `KEEP`, `SPLIT`, `MOVE`, `EVIDENCE`를 먼저 판정한다. 독립된
  pointcut과 evidence owner가 생겼을 때만 Aspect를 split한다.
- merge는 두 Aspect가 같은 pointcut과 하나의 shared invariant를 가질 때만
  한다. 단지 같은 파일이나 테스트를 쓰는 것은 merge 근거가 아니다.
- 적용 대상을 더하거나 빼면 Aspect, reciprocal Promise, ledger, surface tag,
  Sufficiency Review를 같은 변경에서 맞춘다.

### 6. Retire

- Advice가 더 이상 제품 규칙이 아닌지, 한 Promise의 AC로 내려가는지, 다른
  Aspect에 흡수되는지를 Human이 먼저 결정한다.
- retired architecture shape가 남을 수 있으면 Concept Shift Architecture
  Review에서 `preserve`, `migrate-read-only`, `remove`를 결정한다. 이 verdict를
  Aspect의 제품 의미 판단과 합치지 않는다.
- replacement가 있으면 old-to-new pointcut과 evidence 이동을 먼저 닫는다.
- Aspect 선언만 지워 zombie weaving을 남기지 않는다. reciprocal Promise refs,
  ledger의 Applied Aspect와 verdict evidence, surface tags, process reference를
  같은 변경에서 제거하거나 replacement로 옮긴다.
- retired behavior의 부재를 새 current contract로 만들지 않는다. 필요한
  호환·제거 판단은 해당 Promise retirement와 architecture owner가 맡는다.

### 7. Periodic Audit

Aspect 또는 covering ledger를 의미 있게 만질 때와 인접 Promise가 추가·은퇴할
때 아래를 다시 조사한다. process audit issue가 현재 Aspect 체계를 검토할 때도
같은 순서를 쓴다.

1. 현재 Aspect 수와 `appliesTo` edge를 Story Chain loader에서 다시 계산한다.
2. pointcut이 두 개 이상의 실제 Promise를 계속 가리키는지 본다.
3. 한 대상만 남은 Aspect는 아래 one-target review를 다시 연다.
4. Advice 수치·임계치가 Promise AC에 복제됐는지 검색한다.
5. covering ledger, reciprocal weaving, `// @aspect` surface tag, 최신 Sufficiency
   Review를 확인한다.
6. semantic finding은 자동 수정하지 않고 blocking, advisory, Human review로
   분류한다.

현재 inventory는 다음처럼 canonical loader에서 파생한다. 출력의 id, edge 수,
ledger path가 audit 대상이며 이 문서에 별도 registry로 복제하지 않는다.

```bash
npx tsx -e "import { loadStoryChain } from './app/server/services/story-chain/loader'; const chain = loadStoryChain(process.cwd()); console.log({ aspects: chain.aspects.length, appliesToEdges: chain.aspects.reduce((sum, aspect) => sum + aspect.appliesTo.length, 0) }); for (const aspect of chain.aspects) console.log(aspect.id, aspect.appliesTo.length, aspect.coveringLedger);"
```

## One-Target Aspect Review

Aspect의 기본 pointcut은 둘 이상의 현재 Promise다. 한 Promise만 가리키는
Aspect는 validator가 허용하더라도 다음 조건을 모두 만족할 때만 임시로 유지한다.

- Advice가 본질적으로 재사용 가능한 shared constraint다.
- 다음 적용 후보나 과거 sibling을 `## Pointcut`에서 구체적으로 설명한다.
- Promise-local AC로 내리지 않는 이유가 있다.
- covering ledger가 현재 한 대상의 Advice 전체를 검증한다.
- 재검토 trigger를 작업 기록에 둔다.

재검토 trigger는 인접 Promise의 추가·은퇴, Advice나 pointcut의 의미 변경,
covering ledger 개편, periodic process audit다. 두 번째 실제 대상이 계속
나타나지 않고 Promise-local AC가 규칙을 완전히 소유할 수 있으면 Human에게
demotion을 제안한다. 자동으로 삭제하거나 pointcut을 부풀리지 않는다.

## Validator Boundary

### Deterministic Blocking

현재 canonical gate는 다음 구조적 사실을 deterministic하게 막는다.

- frontmatter의 필수 scalar인 `id`, `slug`, `title`, 선언된 `appliesTo` ref와
  `verdict` 값 형식, unique Aspect id와 slug
- `appliesTo`가 존재하는 Promise를 가리키는지와
  `aspect.appliesTo` ↔ `promise.aspects` reciprocal weaving
- 각 parsed Evidence Ledger가 선언한 Source Promise, Applied Aspect, AC/IC
  evidence ref의 해석과 reciprocal pair, strict YAML v2 원장의 필수 evidence shape
- `// @aspect` tag가 존재하는 ref를 가리키는지, 같은 파일에 Promise tag도
  있으면 적어도 한 Promise와 reciprocal하게 woven됐는지
- latest Sufficiency Review로 계산한 `met`, `not-met`, `unknown`, `unverified`
  release 상태
- `coveringLedger`나 exact Aspect review가 없을 때 alignment critical이 만드는
  `unverified` 상태

이 구조가 깨지면 `quality:contract` 또는 그 하위 gate 실패를 고쳐야 한다.

### Advisory Or Human Review

현재 validator는 다음 의미 판단을 보장하지 않는다.

- Advice가 정말 둘 이상의 Promise에 필요한 횡단 규칙인지
- pointcut이 빠짐없이 넓고 과도하게 넓지 않은지
- Promise AC와 Aspect에 복제된 수치 중 어느 쪽이 authority인지
- Advice가 제품 원칙과 맞는지, 구현 mechanism이 섞였는지
- `// @aspect` tag가 실제 행동을 증명하는지
- deterministic test가 생성 문구의 tone이나 설명 충분성을 증명하는지
- 지정 `coveringLedger` 하나가 전체 pointcut의 Source Promise와 evidence를
  빠짐없이 직접 소유하는지
- 모든 pointcut edge에 target-owning parsed ledger pair나 direct AC/IC row가
  존재하는지

명백한 reciprocal/ref/evidence 파손은 blocking이다. 잠재 pointcut 누락,
수치 authority drift, one-target 장기 유지, mechanism 혼입은 advisory finding으로
기록하고, 제품 의미를 바꿔야 닫히면 Human review로 올린다. semantic string lint나
새 registry로 이 판단을 자동화하지 않는다.

## Positive End-To-End Cases

아래 사례는 2026-07-23 현재 정본에서 파생했다. 각 행은 패턴을 보여 주는 reading
route이며 전체 inventory가 아니다.

| Promise → Aspect                                                                       | 공유 규칙과 pointcut                                                                                                                                 | Ledger → Code/Test evidence                                                                                                                                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `promise:search-results-fast-window` → `aspect:paper-card-list-windowing`              | 검색 결과, 인용 선행·후속, graph-neighbor 축이 초기 10편과 +10 확장 문법을 공유한다. fetch limit가 아니라 열린 문서의 반복 카드 표시가 pointcut이다. | `docs/contracts/story-chain/evidence-ledgers/paper-card-list-windowing.ledger.yaml` → `app/components/research-route-renderers/search-view-content.tsx`, citation/graph renderers, visible-window tests |
| `promise:search-result-library-add` → `aspect:user-facing-language-governance`         | 11개 Promise의 고정 문구와 생성 문구를 registry/DOM track과 prompt/schema/judge track으로 나눈다.                                                    | `docs/contracts/story-chain/evidence-ledgers/user-facing-language.ledger.yaml` → `app/i18n/messages*`, library action renderer/test, message-registry contract과 생성 문구 evidence                     |
| `promise:search-reaction-summarizes-terrain` → `aspect:provider-failure-degraded-mode` | 9개 Promise에서 provider 실패가 deterministic surface를 무너뜨리거나 근거 없는 fallback을 만들지 않게 한다.                                          | `docs/contracts/story-chain/evidence-ledgers/provider-failure-degraded-mode.ledger.yaml` → `app/api/route-ai-comments/generate/[id]/route.ts`, degraded-notice persistence boundary, failure-path tests |
| `promise:search-query-route-transition` → `aspect:immediate-navigation`                | 검색 제출과 후속 탐색, detached gap handoff가 전환 전 서버 왕복을 기다리지 않게 한다.                                                                | `docs/contracts/story-chain/evidence-ledgers/immediate-navigation.ledger.yaml` → research route shell, navigation activation, hot-path/product-owned-navigation guards와 route tests                    |
| `promise:story-chain-event-contract` → `aspect:common-page-footer`                     | research, result, public about, admin page family가 공통 footer를 한 번만 렌더한다. API·redirect와 반복 component는 제외한다.                        | `docs/contracts/story-chain/evidence-ledgers/common-page-footer.ledger.yaml` → `app/components/SiteFooter.tsx`, route shell, result/about/admin renderers와 rendered-DOM tests                          |

각 사례를 적용할 때는 표의 파일명을 복사하는 대신 현재 Aspect의
`coveringLedger`와 그 ledger의 executable checks를 다시 읽는다.

## Boundary And Negative Cases

### One Current Target

`aspect:context-preserving-transitions`는 현재
`promise:search-query-route-transition` 하나만 가리키고, Pointcut에서 gap report와
citation lineage를 미래 검토 후보로 이름 붙인다. 이는 one-target review 대상이지
자동 오류도, 둘로 보이게 pointcut을 늘릴 이유도 아니다. 다음 인접 Promise 변경
또는 process audit에서 실제 두 번째 적용이 없으면 Promise-local demotion을
Human에게 제안한다.

### Duplicated Threshold Authority

`aspect:paper-card-list-windowing`의 10편/+10 Advice는
`search-results-fast-window`, `citation-lineage`, `graph-neighbor-papers` AC에도
숫자로 반복되어 있다. 구조 validator는 이를 찾지 못한다. shared threshold의
authority는 Aspect와 covering ledger에 두고, Promise AC는 각 surface의 고유한
결과만 남기는 것이 목표다. 그러나 기존 문장의 의미를 process PR에서 일괄
변경하지 않는다. 다음 제품 의미 변경에서 Human authority 아래 정리한다.

### Shared Mechanism Is Not An Aspect

검색·인용·비슷한 논문 route가 함께 쓰는 8,192-byte serialized input budget은
여러 Promise에 닿지만 user-visible shared Advice가 아니라 URL carrier와
reject-before-provider 구조다. 이 규칙은
`docs/architecture-fitness/pilots/issue-399-serialized-input-budget.policy.json`과
`guard:search-condition-url-budget`가 소유한다. 같은 serializer나 test를 공유한다는
이유만으로 Aspect를 만들지 않는다. 반대로 overflow 때 사용자가 받는 고정 안내의
제품 의미는 해당 Promise AC가 소유할 수 있다.
