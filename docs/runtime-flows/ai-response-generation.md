# AI Response Generation Runtime Flow

이 문서는 Light House가 route-owned ResearchRoutePayload AI comment를 만드는 현재 런타임
경계를 고정한다. 현재 제품 표면은 사용자 자유 입력을 받는 chat assistant가 아니라,
ResearchRoutePayload가 열렸을 때 현재 화면 `viewSnapshot`으로 짧은 AI comment를 생성하는 구조다.
Served entrypoint는 `POST /api/route-ai-comments/generate/:viewId` 하나이며, route-view AI comment는
structured JSON generation으로 `RouteAiComment-or-null`을 만든다.

## Scope

포함한다.

- `POST /api/route-ai-comments/generate/:viewId`가 route-view AI comment를 생성하는 경계
- nullable no-output handling, route failure cleanup, route AI comment persistence ownership
- route bootstrap, regenerate, query transition이 generation command를 큐잉하는 방식
- retired interactive reaction stream helper와 현재 served entrypoint의 분리

포함하지 않는다.

- Promise / Aspect 의미
- Evidence Ledger row와 run command
- prompt 문장 품질 판단
- ResearchRoutePayload persistence schema 자체

## Entrypoints

| 영역 | 파일 |
| --- | --- |
| Route-view AI comment route | `app/api/route-ai-comments/generate/[id]/route.ts` |
| Route-view AI comment generation | `app/server/agent/route-ai-comment-generation.ts` |
| AI provider gateway | `app/server/ai-generation/gateway.ts` |
| Client generation queue | `app/components/research/route-ai-comment-generation-scheduler.ts` |
| Client generation transport | `app/components/research/route-ai-comment-generation-client.ts` |
| Client AI comment runtime | `app/components/research/ResearchRouteRuntime.tsx` |

## Trust Disclosure Boundary

Route-view 자동 comment prompt는 현재 탐색 화면 `viewSnapshot`, 현재 loaded result
window, provider가 제공한 metadata/source limit, 저장 gap report 본문 범위 안에서만
말한다. 전체 분야, 전체 corpus, 실제 scholarly absence처럼 입력 바깥의 전체성이나
부재를 단정하지 말라고 제한한다.

`buildViewSnapshotPromptContext`는 source/paging/limit뿐 아니라 citation lineage와
graph-neighbor availability를 prompt context에 싣는다. 그래서 `references: 0`이나
`coCited: 0` 같은 count가 있어도, availability가 provider 제한·미추출·잘림·unknown을
말하면 prompt/input contract는 이를 실제 선행 연구 부재나 직접 관계 부재처럼
말하지 않도록 제한한다.
co-cited/coupled graph-neighbor 축은 직접 선행/후속 인용이 아니라 그래프 이웃 근거다.
저장 gap report는 prompt에 들어온 저장 리포트 summary/metrics/gap pair/hypothesis
field 범위 안에서만 말한다. 원본 gap 입력 provenance는 gap-network ledger가 별도로
닫는다.

## Contract Architecture Impact Review

Contract delta: route-view AI comment는 생성 요청이 캡처한 `ViewSnapshot`
projection과 commit 시점의 현재 projection이 일치할 때만 반영한다. projection이
바뀌면 기존 comment를 비우고 현재 projection에서 새로 생성한다.

Verdict: constrain-existing

Affected axes and current owners: Source of truth and authority; State lifetime and recovery; Execution semantics; Runtime, external, or AI boundary — 검색 terrain 값의 authority는 첫 search route
execution이 commit한 metadata다. `search-hydration`은 그 terrain을 보존하면서
card detail만 합치는 enrichment merger다. `buildViewSnapshot`은 AI comment basis
projection을 소유하고, route payload/store는 carrier와 state lifetime을 소유한다.
invalidation은 `research-route-store`, queue·single-flight·hydration gate·stale
completion은 route AI comment generation runtime과 scheduler가 소유한다. 서버
in-flight dedup은 generation route가 소유한다.

Decision: route id와 `updatedAt`을 prompt basis identity로 확장하지 않는다.
`buildViewSnapshot`은 `viewSnapshotSchema.safeParse`로 bounded canonical
projection을 한 번 만든다. schema 범위를 넘는 route payload는 AI comment
입력에서 `null`로 fail closed하고 route render나 store mutation을 중단하지
않는다. Command는 이 `ViewSnapshot` 하나만 캡처한다. 비교 key는 canonical
projection을 직렬화해 파생한다. Store mutation,
active completion, 최종 store commit은 같은 canonical projection key를
비교한다. 서버 in-flight dedup도 request의 canonical `ViewSnapshot`
projection으로 구분한다. projection에 포함되지 않는 UI-only metadata 변경은
같은 basis로 유지한다. 검색 결과 paper projection은 첫 commit의
`id/title/year/citationCount`만 사용한다. background hydration이 채우는
abstract/authors/PDF/venue/field와 inline analysis는 paper별 search reaction
projection에 들어가지 않는다. 다만 이 필드를 사용하는 loaded-result facet은
현재 visible result membership을 결정하므로 hydration pending 또는 one-shot compatibility
repair가 남은 동안 provider generation을 보류하고 pending UI만 유지한 뒤 최종 projection에서
한 번 생성한다. `shouldRepairSearchHydrationMetadata`가 background repair queue와 route AI
comment readiness의 공통 판정을 소유하므로, `status:"ready"`인 legacy payload도 repair가
예정돼 있으면 terminal ready로 취급하지 않는다.
검색 enrichment 서버는 hydrated batch가 다른 값을 돌려주더라도 첫 commit의
title/year/citationCount를 보존한다. 인용 계보와 graph-neighbor projection은 관계
맥락에 필요한 authors를 계속 포함하고, lightweight graph-neighbor는 author 보강
시도가 terminal ready가 된 뒤 사용 가능한 관계 근거로 한 번 생성한다. Active transport는 projection이 바뀌거나 현재 view가 hydration gate로 되돌아가면
AbortController로 취소해 비용과 대기 시간을 줄인다.

Rejected alternative: `updatedAt`이나 route payload id만 비교하면 같은 URL과
같은 route id에서 결과·정렬·facet·source basis가 바뀌는 경우를 구분하지
못한다. 반대로 모든 freshness 변경을 무효화하면 prompt에 들어가지 않는
UI-only metadata까지 provider generation을 반복한다. Hydration-dependent facet을
pending 상태에서 바로 생성하면 hydration 전·후 두 comment가 생기고, facet이나
관계 authors를 projection에서 제거하면 현재 visible result/relationship 근거와
AI comment 입력이 어긋난다.

Evidence and structural defense:
`app/components/research/__tests__/ResearchRouteRuntime.reaction-generation-queue.test.tsx`가 active stale response
폐기와 current projection 재생성을 검증한다.
`app/stores/__tests__/research-route-store.ai-comment-generation.test.ts`가 basis 변경 시 기존
comment 삭제와 최종 store commit guard, search card hydration의 comment 보존을
검증한다. `app/domain/__tests__/view-snapshot.test.ts`가 검색 hydration detail 제외, 관계 화면 author
보존, prompt basis 변경, transport 정규화, snapshot bounds 초과의 fail-closed
경계를 검증한다. `app/server/services/__tests__/search-hydration.test.ts`는 서버가 첫 commit의
title/year/citationCount를 보존하면서 카드 상세만 보강하는 경계를 잠근다.
`app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts`,
`app/components/research/__tests__/ResearchRouteRuntime.bootstrap.test.tsx`,
`app/components/research/__tests__/ResearchRouteRuntime.hydration-gating.test.tsx`는 unfaceted pending search의 즉시
생성, hydration-dependent facet과 graph-neighbor의 pending-to-ready 단일 생성,
`status:"ready"` legacy facet payload의 one-shot repair 완료 뒤 단일 생성,
system-event·queued flush의 readiness 재검사, terminal empty facet projection의
no-request·pending clear 경계를 잠근다. `app/server/domain-access/__tests__/search-enrichment-access.test.ts`와
`app/components/research/__tests__/research-route-runtime.bootstrap-events.test.ts`는 repair가 usable detail 없이 성공해도
canonical `repairAttempted`가 남아 같은 terminal-empty 경계를 닫는 것을 잠근다.
Generation route test가 server in-flight dedup을 projection 단위로 검증한다.

Human decision required: no

Human decision context: 2026-07-18 Human이 계약 재검토 뒤 중복 생성 수정을
지시했고, 선택한 readiness gate는 기존 visible facet/relationship author 계약을
보존하면서 그 지시를 구현한다.

Architecture Fitness applicability: active
`issue-276-search-state-boundary`는 route-owned current result snapshot의 authority,
carrier, ephemeral identity 경계에 적용된다. 이 변경은 그 authority/carrier/identity를
옮기지 않고, 같은 route payload 안에서 AI comment에 전달할 검색 projection만
제약한다. 따라서 해당 profile의 search-state guard로 기존 경계 준수를 다시
확인한다. 현재 worktree에서 `npm run guard:state-boundaries`는 통과했다.
다만 hydration detail과 provider prompt projection 사이의 field-level 포함·대기
규칙은 이 profile의 coverage entry가 아니므로 이 profile로 supported verdict를
내리지 않는다. 위 Story Chain evidence와 route/store/server 회귀 테스트가 이
변경의 구조적 방어를 소유한다.

### 2026-08-02 citation-lineage evidence constraint

[Issue #554](https://github.com/jaeyoungkang/lighthouse/issues/554)에 기록된 Human 승인과
`constrain-existing` CAIR에 따라 citation-lineage만 이미 hydration된 abstract를
AI comment 근거 projection에 포함한다. Seed는 1개, references와 citations는 방향별
동일한 3개 quota, evidence snippet은 항목별 600자로 제한한다. 새 provider fetch나
tool call은 추가하지 않는다. Evidence snippet은 canonical `ViewSnapshot` projection
identity의 일부이므로 이 근거가 바뀌면 기존 comment를 지우고 stale completion을
거부한다. Search snapshot은 기존처럼 card hydration abstract를 projection에서 제외한다.

## Route-View Reaction Generation Flow

1. `ResearchRouteRuntime`은 mount마다 active execution id를 발급한다. 이 id는
   `ownerPrincipalId + initial view id + initial updatedAt`에 runtime mount token을 더해,
   같은 id와 timestamp로 다시 열린 새 runtime도 이전 실행과 구분한다. 완료된 search,
   citation_lineage, graph_neighbors ResearchRoutePayload가 reaction block 없이 열리면
   `buildRouteAiCommentGenerationCommand`로 generation command를 만든다. Regenerate
   action도 같은 command builder를 사용하고 command가 현재 execution id를 캡처한다.
2. Queue layer는 같은 `(trigger, targetRoutePayloadId)` command를 최신 1건으로
   coalesce하되 서로 다른 target route payload는 분리한다. 각 command는
   `executionId`와 `reactionGeneration` stamp를 가진다. query transition이나 regenerate가
   stamp를 앞당기면 flush 시점의 오래된 command는 버린다. 같은 view id를 재사용해도
   이전 execution의 flush, transport completion, cleanup은 현재 scalar reaction/history/
   pending state를 바꾸지 못한다. Route execution이 바뀌거나 runtime이 unmount되면 현재
   generation의 AbortController가 client transport를 즉시 끊고, 이 정상 취소는 generation
   failure로 기록하지 않는다. 같은 React instance에서 execution만 교체되어도 queue, timer,
   bootstrap key, active command를 새 execution bootstrap 전에 초기화한다. 서로 다른
   canonical `ViewSnapshot` projection의 command가 추가로 들어와도 client generation은 single-flight로
   실행한다. 따라서 scalar
   command와 AbortController가 동시에 둘 이상의 transport를 가리키지 않는다. Flush 전에
   같은 view의 `ViewSnapshot` projection이 바뀌면 queued command를 현재 projection으로
   재기반한다. System-event ingress, enqueue, flush는 모두
   `buildRouteAiCommentGenerationCommand`로 현재 hydration readiness를 다시 확인한다.
   Queue 대기 중 현재 view가 hydration gate로 돌아가면 pre-ready command를 버리고
   bootstrap key를 다시 열어 terminal ready snapshot만 재큐잉한다. Active request 중
   projection이 바뀌면 store가 기존 comment를 비우고 reaction generation을 전진시킨다.
   Projection은 같아도 hydration gate가 다시 닫히면 runtime이 bootstrap key를 다시 열고
   이전 transport를 abort하되 settled comment와 generation은 그대로 둔다. 두 경우 모두
   current terminal-ready projection command를 single-flight 경계에서 이어서 실행한다.
   기존 settled comment를 재생성하던 요청도 같은 경계를 따라 card를 보존하고 terminal
   ready에서 재생성을 이어간다.
   Abort를 무시하고 늦게 도착한 이전 completion도 abort signal과 current readiness를
   다시 확인해 적용하지 않는다. `ViewSnapshot` projection에 포함되지 않는 UI-only
   metadata freshness만 바뀌면 같은 execution/reactionGeneration의 completion을 적용하고
   provider call을 다시 발화하지 않는다. Active request가 끝난 뒤 같은 generation의
   queued 후속 command가 실제 transport를 시작하면 pending과 started를 함께 다시 세워, 후속
   요청이 진행 중인데 loading 표시만 먼저 사라지지 않게 한다. settled comment의 regenerate도
   terminal completion 뒤 pending에 남지 않는다.
3. Facet이 없는 pending search는 commit terrain(제목·연도·인용) 기준으로 바로
   generation을 요청한다. Personalized search의 library grounding도 첫 payload에
   이미 고정되어 있다. 이후 card hydration은 abstract·authors·PDF·venue·field를
   보강하지만 paper별 search `ViewSnapshot` projection과 reaction generation을
   바꾸지 않는다. 이 hydration 필드를 사용하는 loaded-result facet이 활성화됐으면
   pending UI를 먼저 표시하고 card detail 보강과 one-shot compatibility repair가 끝난 뒤
   현재 facet result pool에서 한 번 생성한다. `status:"ready"`여도
   `shouldRepairSearchHydrationMetadata`가 true이면 같은 gate를 유지한다. Terminal ready
   result pool이 비어 있으면 provider request 없이 pending을
   닫는다. Lightweight graph-neighbor도 관계 author 보강 시도가 terminal ready가 된
   뒤 사용 가능한 관계 근거로 한 번 생성하는 같은 pending-to-ready 경계를 사용한다.
   Citation-lineage는 관계 route가 batch hydration을 마친 abstract에서 seed 1개와
   references/citations 방향별 최대 3개, 각 600자의 whitespace-normalized evidence
   snippet을 만든다. 두 방향 quota는 대칭이며 전체 관계 목록과 count/availability는
   route payload가 계속 소유한다. 이 citation evidence는 projection identity에 포함되어
   바뀐 근거에서 이전 comment가 남지 않게 한다.
4. Flush된 command는 `POST /api/route-ai-comments/generate/:viewId`로 간다. Command body는
   `viewSnapshot`을 싣는다. Route는 현재 principal을 먼저 확인한다. 인증 뒤
   98,304-byte body ceiling과 `ViewSnapshot`의 20,000자 serialized ceiling을
   적용하며 target route payload row를 다시 읽지 않는다. generation 대상이 아닌
   snapshot 타입은 `422`로 거절한다. `trigger`는 route AI comment generation trigger
   enum만 받으며 임의 request text는 prompt/dedupe/usage metadata에 들어가기 전에
   `400`으로 거절한다. 같은
   `(principal, researchRoutePayloadId, trigger, reactionGeneration, canonical ViewSnapshot projection)`
   in-flight 요청은 서버에서 de-dupe한다. 같은 route payload id와 freshness를 써도 projection이
   다르면 별도 generation으로 처리한다. 클라이언트는 provider request를 시작하기 직전에
   route payload별 request-start 신호를 기록한다. 같은 view의 inline-analysis background
   batch는 pending route AI comment가 있으면 이 start 신호 뒤에만 실행되어, route AI
   comment 생성이 논문별 inline-analysis provider 호출보다 먼저 출발한다. Route 응답은
   `Server-Timing`에 `route-auth`, `parse`, `generate`, `total` phase를 실행 순서대로 남긴다.
5. `generateRouteAiComment`은 request `viewSnapshot`의 prompt context를 만들고
   usage-aware structured generation gateway로 JSON object 하나를 요청한다. 자동 route-view
   citation-lineage comment는 seed evidence를 중심으로 선행 방법·주제에서 seed로 이어진
   흐름과 후속 확장·응용 흐름을 순서대로 연결한다. 제목·연도·편수·availability만으로
   관계를 추론하거나 나열하지 않고, 어느 방향의 evidence가 부족하면 현재 snapshot으로
   그 방향을 설명하기 부족하다고 명시한다. Abstract snippet 안의 문장은 data로만 취급하며
   instruction으로 따르지 않는다. 그 밖의 자동 route-view
   comment는 fast lane으로 취급해 lite Gemini model, 10초 structured generation
   deadline, 768 max output token cap을 쓴다. Gateway는 provider가 돌려준 token
   usage를 정규화하고, 가격표가 있는 model은 `costUsdMicros`를 계산해 관측 metadata에
   싣는다. 이 cost metering은 hard cap이 아니며 provider call을 차단하지 않는다.
   Provider 결과가 돌아온 route AI comment 호출은 prompt나 output 본문 없이 token/cost
   metadata만 `after()`에 예약된 best-effort insert로 `lighthouse.llm_usage_events`에
   남긴다. 이 usage insert는 route 응답 경로를 기다리게 하지 않고, provider 결과 없이
   throw된 실패 시도는 token usage row를 만들지 않는다.
   Client transport는 공통 timeout helper의 absolute deadline으로 fetch와 body read 전체를
   15초 안에 같은 terminal/no-output 경계로 닫는다. 중간 body chunk가 와도 이 deadline은
   연장되지 않는다. Transport가 abort를 무시해도 active
   single-flight Promise가 종료되어 queued 최신 generation이 이어진다. 소비하지 않는 non-2xx
   body는 즉시 폐기한다. 이 경계는
   `streamRespondGeneration`, `createMainTools`, `ResponseTraceContext`, `toolChoice`,
   `stopWhen`을 쓰지 않는다. `maxOutputTokens` cap은 visible payload cap이 아니라 JSON
   생성 상한이고, visible title/body/chips는 payload schema와 runtime trim이 다시 제한한다.
   Structured generation gateway는 request timeout과 AbortController deadline을 함께
   적용하고 provider retry를 끈다.
6. Structured output에 title/body가 있는 `RouteAiComment`이 없거나 provider
   timeout·abort·no-output이 발생하면 `null`을 돌려준다. 이 경계는 route-view terrain을 상상해
   성공 comment를 만들지 않고, 실패 comment도 만들지 않는다.
7. Generation route는 search, citation_lineage, graph_neighbors 같은 탐색 화면 reaction을
   route-view client state로 돌려준다. 성공 comment도
   `{snapshotId, snapshotKind, reaction}`으로만 돌아오며, 클라이언트 상태에 적용된다.
   `null`은 empty generation completion으로 처리된다.
   저장되는 gap report reaction은 `PUT /api/gap-reports/:id/reaction` 경로가
   shared artifact와 분리된 현재 viewer preference row에 쓴다.
8. Client가 generation transport error, route failure, response의 `snapshotId`/`snapshotKind`
   coherence mismatch, 또는 `reaction: null`을 받으면
   첫 생성은 화면에 아무 AI comment도 만들지 않고 pending만 정리한다. Regenerate 중이면
   기존 settled comment를 보존한 채 regeneration pending만 내린다. Completion 처리 전에는
   request 시작 시점의 `executionId`, `reactionGeneration`, 현재 route payload id를 다시 비교해
   stale completion이 최신 reaction/pending을 바꾸지 않게 한다. 같은 실행 안에서도 현재
   `ViewSnapshot` projection이 request-time projection과 다르면 이전 응답을 적용하지 않는다.
   Store mutation은 기존 comment를 비우고 reaction generation을 전진시킨다. Queue는 current
   projection command를 single-flight 뒤에 실행한다. 최종 store commit도 expected projection
   key를 다시 검사한다. Coherence mismatch는
   schema-valid 응답이어도 현재 generation의 terminal failure로 닫아 pending을 남기지 않는다.
   Unmount cleanup도 자신이 시작한 execution id가 아직 active일 때만 store를 비운다.

## Debugging Signals

- `ECONNRESET` 또는 `aborted` 로그는 route transition, pending placeholder cleanup,
  StrictMode replay, browser navigation 때문에 이미 끊긴 client connection에서 Next가
  기록할 수 있다. 뒤따르는 follow-up POST가 `201`/`200`으로 성공했다면 provider
  generation 실패와 구분해 읽는다.
- `POST /api/route-ai-comments/generate/:viewId 422`는 target route payload가 reaction generation
  대상이 아니라는 입력 신호다.
- `POST /api/route-ai-comments/generate/:viewId`의 `Server-Timing`에서 `generate`가 길고
  앞 phase가 짧으면 provider 단계 병목이다. 자동 route-view AI comment의 정상 fast-lane
  budget은 10초 server structured generation deadline과 15초 client transport timeout이다.
  이 route에는 `load-document` phase가 없다.
- `LIGHTHOUSE_OBSERVE_CONSOLE=1` 또는 `NEXT_PUBLIC_LIGHTHOUSE_OBSERVE_CONSOLE=1`일 때
  route AI comment generation은 `ai-call` observation에 token usage와 `costUsdMicros`를
  남긴다. 가격표가 없는 model은 비용을 `null`로 남기고 missing pricing warning을 한 번
  기록한다.
- `lighthouse.llm_usage_events`는 trusted generation usage의 durable append
  source이며 analytics event pipeline이나 Amplitude sink가 아니다. 웹 앱은 이
  원장의 전역 집계 read capability나 admin report를 제공하지 않는다.
- Route AI comment처럼 structured gateway를 직접 쓰는 trusted 호출과 인라인 분석,
  연구 용어 추출, gap network narrative enrichment처럼 `executeJudgment` 공통 실행기를
  지나는 trusted 호출은 같은 `llm_usage_events` 원장 schema를 사용한다. DB와 owner
  principal을 가진 route/domain-access 경계가 optional usage ledger를 주입하고,
  provider 결과가 돌아온 호출만 action(label), model, token usage, cost, duration,
  status(success/empty/aborted)를 `after()`에 예약된 best-effort insert로 남긴다.
  Provider 결과 없이 throw된 실패 시도는 token usage row를 만들지 않는다. Prompt
  본문과 generated output 본문은 원장 metadata에 넣지 않는다.
- 중복 in-flight generation은 caller-aware abort controller를 공유한다. 한 caller의
  route transition이나 browser abort만으로 공유 provider call을 끊지 않고, 활성 caller가
  모두 끊겼을 때만 provider signal을 abort한다. Provider가 abort를 무시하고 뒤늦게
  성공 output을 돌려도 persisted reaction 경로는 현재 viewer가 선택한 prepared reaction만 받는다.

Result-card PDF actions do not enter route AI comment generation. They render an
external Moonlight handoff link and leave the Light House route payload state unchanged.

## Retired Interactive Stream

The legacy interactive reaction stream has no served route and no client transport in
the current product path. `ResearchRouteRuntime` does not install `useChat` or
`DefaultChatTransport`, `reaction-action-store` does not expose `sendUserMessage`, and
`API_ROUTES` has no `/api/reaction` entry. System events are generation triggers only:
they target the current route-owned ResearchRoutePayload and enqueue
`POST /api/route-ai-comments/generate/:viewId`.

The legacy `respond`/stream helper files have been removed from the current product
path and must not be wired back into route-view generation.

## Update Rule

다음 중 하나가 바뀌면 이 문서를 같은 변경에서 갱신한다.

- `POST /api/route-ai-comments/generate/:viewId` request/response shape
- route AI comment generation structured prompt, nullable no-output handling, model 선택
- retired interactive stream helper를 다시 served route/client transport에 연결하는 변경
- client generation transport/no-output handling
- active execution identity, scalar reaction/history ownership, stale completion cleanup
- route AI comment persistence ownership
