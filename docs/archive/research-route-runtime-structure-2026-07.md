# Research route runtime 구조 개선 검토

- 상태: issue #265 구현 반영. `main@6835982d`(PR #268 병합) 후속 보강 worktree 검증 중
- 작성일: 2026-07-10
- 마지막 재검증: 2026-07-11 (`PR #268` 병합 이후 후속 보강)
- 범위: Research route의 클라이언트 상태, 비동기 실행 수명, payload와 서비스 경계
- 성격: 구현 전 구조 검토와 구현 결과 기록. Promise 의미나 제품 동작은 변경하지 않는다.

## 결론

현재 구조에는 순환 의존이나 계층 위반 같은 정적 붕괴가 없다. 복잡성의 중심은 파일 수나
개별 함수 크기보다 **한 번에 하나만 활성화되는 route를 여러 view가 동시에 살아 있는 것처럼
관리하는 상태 모델**에 있다.

대규모 재작성이나 새 상태 관리 도구 없이 사용되지 않는 상태를 제거했다. Gap reaction write와
active-session 전환은 구현 책임 경계를 분리했지만, PR #268의 Git slice와 실제 구현 순서는
최초 판정을 지키지 못했다. 후속 보강에서 client coalescing, artifact `version` CAS,
`reactionVersion` 기반 선택 순서로 역순 저장 위험을 닫았다. 동일 id·동일 `updatedAt`을 재사용하는
새 runtime이 이전 completion과 cleanup을 받을 수 있는 실패를 재현했고, mount별 execution id를
결과 적용 권한으로 도입했다.

이 execution id를 AI comment, inline analysis, search enrichment, graph hydration, term discovery,
spelling correction, status/metadata patch에 전파했다. 이후 reaction/history/generation/visible-window의
`*ByViewId` 맵을 active route execution의 scalar state로 바꿨다. `updatedAt`, generation,
`resultKey`, `cycleKey`, attempt key, phase는 각자의 freshness와 operation identity로 유지한다.
공통 task registry, 새 상태 machine, payload/DB 분리는 현재 문제를 닫는 데 필요하지 않아
도입하지 않았다.

이 변경은 다음 전제를 유지한다.

- URL이 search, citation, similar route의 정본이다.
- gap만 영속 artifact이며 나머지 route는 일시적 view다.
- gap의 `reaction`과 `reactionHistory`는 artifact가 소유하며 client session은 projection만 가진다.
- 화면에는 한 번에 하나의 route만 활성화된다.
- 현재의 Zustand, React, Next.js 경계는 0단계에서 유지한다.
- DB schema와 repository 경계는 0단계에서 바꾸지 않는다.

## 구현 결과

```yaml
decision: active-route-execution-scalar
because:
  - 화면에는 한 번에 하나의 route만 활성화되지만 client state는 view-id map으로 남아 있었다.
  - 같은 id와 updatedAt을 재사용한 새 runtime에서 기존 freshness 값만으로 execution을 구분할 수 없었다.
  - gap prepared reaction의 client sequence guard는 서버의 역순 commit을 막지 못했다.
tradeoffs:
  - process-local execution id는 analytics identity나 persistence key로 사용하지 않는다.
  - task별 controller와 retry policy는 유지해 서로 다른 fallback 의미를 평준화하지 않는다.
outcomes:
  - gap reaction 선택은 즉시 보이고, queued 선택은 최신 pending 하나로 coalesce된다.
  - stale reactionVersion 응답은 같은 payload를 bounded rebase하고, 최신 pending 선택은 관찰한 server version에서 CAS를 이어간다.
  - definite 실패는 마지막 confirmed reaction으로 되돌리고, ambiguous read-back은 관찰한 최신 canonical reaction으로 화해한다.
  - active-session store writer와 async helper는 expected execution id를 필수로 받으며 view id와 updatedAt fallback을 두지 않는다.
evidence:
  - ResearchRouteRuntime.execution-lifecycle.test.tsx
  - ResearchRouteRuntime.reaction-generation-queue.test.tsx
  - ResearchBackgroundTasks.hydration.test.tsx
  - ResearchBackgroundTasks.graph-neighbor-hydration.test.tsx
  - ResearchBackgroundTasks.inline-analysis-canonical.test.tsx
  - ResearchBackgroundTasks.term-discovery.test.tsx
  - search-view-content.spelling-correction.test.tsx
  - GapNetworkView.persistence.test.tsx
  - app/server/domain-access/__tests__/gap-network-view-access.test.ts
  - app/api/gap-reports/[id]/reaction/__tests__/route.test.ts
verdict: adopted
```

단계별 판정은 다음과 같다.

| 단계 | 결과 |
| --- | --- |
| 0 dead state | unused store, prompt/overlay state, test-only AgentPanel layout과 파생 config/evidence를 제거했다. |
| 1 gap write ordering | prepared reaction PUT을 active 1개와 latest pending 1개로 coalesce하고 owner-scoped artifact version CAS + monotonic reactionVersion + bounded stale rebase를 적용했다. |
| 2 execution characterization | 동일 id·timestamp 재진입과 늦은 cleanup/completion 실패를 재현해 mount별 execution id 필요성을 확정했다. |
| 3 scalarization | reaction/history/generation/visible-window를 active execution scalar state로 전환했다. |
| 4 producer guard | route-scoped producer가 execution id를 캡처하고 completion에서 검증하게 했다. |
| 5 AI comment transition | scalar reaction lifecycle과 execution/generation guard를 같은 전환에서 닫았다. |
| 6 task lifetime | term error state를 execution별로 격리하고 기존 task별 controller를 유지했다. 공통 registry는 불필요했다. |
| 7 pure/effect 분리 | 반복 변경 근거가 없어 열지 않았다. |
| 8 payload/repository 분리 | 현재 correctness와 전파 범위가 요구하지 않아 열지 않았다. |

## 검토 질문

이번 검토는 다음 질문에 답한다.

1. 현재 복잡성은 어디에서 생기는가?
2. 이전 Search-first 전환의 의도와 현재 구현 사이에 어떤 잔여 구조가 있는가?
3. 어떤 구조를 보존하고, 단계적으로 이동하고, 제거해야 하는가?
4. 사용자 동작을 바꾸지 않으면서 가장 작은 순서로 개선하려면 어떻게 해야 하는가?

이 문서 자체는 구현 상세나 제품 동작을 변경하지 않는다. 다만 후속 구현이 AI comment source
owner, runtime 처리 순서, Story Chain의 live source 설명을 바꾸면 문서 변경이 아니라 contract
변경으로 취급한다. 구현 전에 Mission Control과 Ask-first 범위를 다시 확인하고 같은 변경에서
정본과 Evidence Ledger를 동기화한다.

## 근거와 해석의 경계

아래의 관찰·문제·단계별 개선안은 `main@e531e3f5`에서 구현 전에 남긴 decision record다.
**관찰**은 당시 코드, 의존성 검사, Git history에서 직접 확인한 사실이다. **해석**은
그 사실을 설명하는 구조적 판단이다. 현재 결과는 앞의 `구현 결과` 절을 정본으로 읽는다.

### 관찰

- production code는 약 417개 module과 767개 local dependency edge로 구성된다.
- 현재 dependency 검사에서는 순환 의존과 계층 위반이 발견되지 않았다.
- `app/stores/research-route-store.ts`는 단일 `currentView`와 함께 reaction, generation,
  overlay, visible window, consumed prompt를 `viewId`별 맵으로 보관한다.
- `app/components/research/ResearchBackgroundTasks.tsx`는 inline analysis, search enrichment,
  graph hydration마다 별도 `AbortController` 맵과 완료 집합을 관리한다.
- `app/components/research/background-term-discovery.ts`도 별도 controller 맵과 task 상태를
  소유한다. route children보다 오래 사는 shell에서 실행되며 component unmount 때 controller를
  정리한다.
- `app/components/research-route-renderers/search-view-content.tsx`의 spelling correction은
  module-scope `inFlight`와 `resolved` 집합을 사용한다. 요청은 abort하지 않고 완료 시 현재
  id와 query를 다시 확인해 view를 patch한다.
- `app/components/research/route-ai-comment-generation-runtime.ts`는 pending queue, timer,
  bootstrapped key, active generation, active command, active request, reaction sequence를 별도
  ref와 맵으로 관리한다.
- `app/domain/research-route-payload.ts`는 search, citation, graph, gap payload를 하나의 union으로
  묶는다. 일시적 view와 영속 artifact가 같은 상위 lifecycle field를 공유한다.
- `app/server/repository/gap-reports.ts`는 DB row를 renderer-facing `ResearchRoutePayload`로 직접
  변환한다. `docs/runtime-flows/gap-network-analysis.md`는 이 adapter를 domain-access 경계의
  책임으로 설명하므로 코드와 문서 사이에 ownership drift가 있다.
- `reactionVersion`은 domain type과 DB column에 남아 있지만 production에서 단조 증가 invariant를
  집행하는 caller가 확인되지 않았다.
- `app/components/research/search-view.helpers.ts`는 순수 view model 계산과 request, persistence,
  external URL 생성 같은 effect를 함께 소유한다.
- `app/stores/agent-store.ts`와 `app/stores/library-anchor-selection-store.ts`에는 production
  call site가 없다.
- `consumedPromptsByViewId`의 action에는 store 외부 production call site가 없고, history에서
  consumed prompt를 복원하는 함수는 항상 빈 배열을 반환한다.
- `prefillQuery`는 production에서 읽고 `null`로 지우는 흐름만 있으며 non-null setter call
  site가 없다.
- production route의 `AgentPanel` caller는 모두 inline layout을 사용한다. overlay layout은
  component 내부에서도 test-only variant로 표시되어 있으며 collapse와 last-seen store state에는
  production writer가 없다.

### Git history에서 확인한 맥락

Search-first reset commit `70dd2960`은 document-first persisted model을 URL 소유의 일시적
search, citation, similar route로 전환했다. gap만 영속 대상으로 남기고 화면의 route view를
하나로 줄였다. 다만 reaction, overlay, visible window, consumed prompt의 `viewId`별 맵은
명시적으로 보존했다.

이후 `723e84b5`, `8c0923cf`, `9f82dea5`에서 hydration, AI comment generation, background task
안전장치가 추가되며 맵과 실행 guard가 늘어났다. 각 변경은 당시 비동기 결과가 잘못된 view에
적용되는 문제를 국소적으로 막았다.

이 문서의 첫 검토가 끝난 뒤 `PR #266`이 병합됐다. 이 변경은 search enrichment와 term
discovery가 공유하는 `mergeSearchBackgroundMetadata`를 추가했다. stale response가 현재
graph support, hydrated paper detail, inline analysis, reviewed state를 덮지 않게 한다.
term discovery completion은 현재 route view를 patch한 뒤
`product.research_terms.viewed`를 `once_per_identity`로 기록한다. 실행 identity 전환은 이
freshness merge를 대체하지 않는다. 이전 실행의 completion이 거부되면 analytics도 발화하지
않아야 한다.

### 해석

Search-first reset은 제품의 중심 단위를 바꿨지만 실행 상태의 소유권을 완전히 바꾸지는 않았다.
그 결과 화면에는 하나의 active route만 있는데 store와 runtime은 여러 view가 동시에 활성화될
수 있는 것처럼 동작한다.

새 비동기 기능은 이 모델 위에서 안전해야 했으므로 기능마다 queue, controller, generation,
timestamp guard를 추가했다. 현재 복잡성은 무계획한 중복이라기보다 **이전 lifetime model을
보존한 상태에서 새 비동기 책임을 세로로 누적한 결과**다.

## 현재 구조의 문제

### 1. 상태의 cardinality가 실제 UI와 다르다

화면의 cardinality는 active route 하나다. 그러나 store의 cardinality는 `viewId`별 N개다.
이 차이 때문에 route 전환 시 이전 key 제거, 새 key 초기화, stale key 정리, history 복원,
generation 비교가 모두 필요하다.

맵이 반드시 잘못된 것은 아니다. 탭이나 병렬 pane처럼 여러 view가 실제로 동시에 활성화된다면
맵이 맞다. 현재 제품에는 그 요구가 없다.

### 2. 데이터 freshness와 실행 identity가 섞인다

`updatedAt`과 generation은 stale result 차단에 사용된다. 그러나 `updatedAt`은 hydration이나
patch로 바뀌는 데이터 freshness 값이다. route에 진입한 실행 자체의 identity와 같지 않다.

같은 canonical URL을 다시 실행하거나 동일 view가 단계적으로 hydrate될 때 이 구분이 중요하다.
현재 guard가 실제로 놓치는 경우가 있는지는 아직 입증되지 않았다. 특히 search Suspense
fallback과 resolved runtime은 서로 다른 subtree와 owner로 mount되므로 같은 실행으로 간주하지
않는다.

### 3. 비동기 작업의 소유권이 기능별로 흩어져 있다

AI comment, inline analysis, search enrichment, graph hydration은 모두 다음 수명 규칙을 가진다.

- route 진입 후 시작한다.
- route가 바뀌면 취소하거나 결과를 버린다.
- 동일 실행에서 중복 시작하지 않는다.
- 성공 결과는 현재 실행에만 반영한다.

하지만 각 기능이 controller, 완료 집합, generation, retry 상태를 별도로 구현한다. 공통 규칙을
바꿀 때 여러 runtime을 함께 추적해야 한다.

### 4. 영속성과 표현 책임이 payload에 함께 모인다

search와 citation은 URL에서 다시 만들 수 있는 일시적 view다. gap은 DB에 저장되는 artifact다.
현재 union은 이들을 편리하게 render하지만, status, version, timestamp, enrichment metadata의
의미가 route kind마다 달라진다.

0단계에서 union을 분리할 이유는 충분하지 않다. 다만 active session 정리 후에도 persist와
render 변경이 항상 함께 번진다면 물리적 분리를 다시 검토한다.

### 5. 사용되지 않는 상태가 현재 모델을 더 크게 보이게 한다

call site가 없는 store와 setter, 항상 빈 결과를 내는 복원 로직은 유지보수자가 실제 invariant를
파악하기 어렵게 한다. 이 부분은 구조 전환과 분리해 먼저 제거할 수 있다.

## 목표 구조

첫 구조 목표는 기존 Zustand store를 active route session의 명시적 owner로 만드는 것이다.
실행 guard 교체는 별도 검증을 통과해야 한다.

```ts
interface ResearchRouteSessionState {
  view: ResearchRoutePayload | null;
  aiComment: RouteAiCommentState;
  ui: {
    visibleWindow: {
      resultKey: string;
      visibleCount: number;
    } | null;
  };
}
```

이 모양은 최종 API가 아니라 소유권 원칙을 설명한다. 실제 field 이름은 기존 domain type과
call site를 따라 정한다.

scalar화는 `viewId` 차원만 제거한다. 같은 route 안에서 result batch를 구분하는 `resultKey`, AI
comment generation, background operation key 같은 내부 identity는 유지한다.

### 명령 경계 후보

store는 다음 명령을 구분하는 방향을 검토한다.

- `enterRoute(view)`: route-owned input의 새 실행을 수용할 때 active state를 초기화한다.
- `leaveRoute(expectedExecution)`: 자신이 진입시킨 session일 때만 종료한다.
- `patchView(expectedExecution, patch)`: 시작 시점의 실행 identity와 맞는 결과만 반영한다.
- `dispatchAiComment(expectedExecution, event)`: 현재 실행의 AI comment transition만 반영한다.

새 실행은 새 owner runtime instance가 route input을 수용하거나, 살아 있는 동일 instance가 새로운
`ownerPrincipalId + route-owned initial viewKey`를 수용한 경우다. 동일 instance에서 동일 initial
payload를 단순 rerender하는 것은 재진입이 아니다. 새 runtime instance는 id와 `updatedAt`이
같아도 per-entry token으로 이전 instance와 구분해야 한다. Suspense fallback과 resolved subtree도
owner와 mount가 다른 별도 실행이다.

`setCurrentView` 하나로 route 진입과 hydration patch를 모두 표현하지 않는다. 다만 동일 id와
동일 `updatedAt` 재진입까지 구분하는 안정적인 per-entry token을 선택하기 전에는
`leaveRoute(expectedExecution)`을 구현안으로 확정하지 않는다. 먼저 현재 cleanup interleaving을
characterization test로 잠근다.

`expectedExecution`은 먼저 현재 composite identity로 표현한다. 모든 caller가 원자적으로 이동할
수 있는지 확인한 뒤 필요한 최소 모양을 정한다.

### 실행 identity 도입 gate

`executionEpoch` 후보는 route 진입마다 증가하는 process-local token이다. 다음 실패를 현재
composite guard로 막지 못하는 test가 먼저 있어야 한다.

- 같은 id와 같은 `updatedAt`을 가진 route를 떠났다가 다시 진입한다.
- 이전 `leaveRoute`가 나중에 열린 session을 지우려 한다.
- 이전 search enrichment, term discovery, graph hydration이 새 session에 완료된다.
- 이전 gap reaction PUT이나 status polling이 같은 gap id의 새 session에 완료된다.

실패가 재현되고 기존 composite identity를 단순하게 보강할 수 없을 때만 epoch를 도입한다.
network request와 background task는 시작할 때 epoch를 캡처하고 완료 시 현재 epoch와 operation
key를 함께 비교한다.

- `viewId`: 데이터 identity다.
- `updatedAt`: 데이터 freshness다.
- `generation`: 한 기능 내부의 재생성 순서다.
- `executionEpoch`: 도입 gate를 통과한 경우에만 현재 화면 실행에 결과를 적용할 권한이다.

서로 다른 의미를 한 값으로 대체하지 않는다. epoch를 도입해도 generation, `resultKey`,
`cycleKey`, attempt key, term discovery phase는 해당 기능의 input identity로 유지한다.

## Concept Shift 판정

| 현재 shape | 판정 | 목표와 전환 방식 |
| --- | --- | --- |
| URL 소유 search/citation-lineage/graph-neighbor route | `preserve` | 일시적 route의 정본으로 유지한다. |
| gap report DB와 repository | `preserve` | 영속 artifact 경계를 유지한다. 0단계에서 DB 접근을 바꾸지 않는다. |
| 단일 `currentView` | `preserve` | active session의 `view`로 이름과 명령 경계를 명확히 한다. |
| 일시적 route의 reaction/history 의미 | `preserve` | payload hydration input과 active session의 scalar AI comment projection으로 유지한다. |
| gap의 reaction/history ownership | `preserve` | `gap_reports` artifact가 정본이다. session은 hydrate하고 write-through 결과를 반영하는 projection이다. |
| reaction과 generation의 `*ByViewId` 맵 | `remove` | 동시 active view가 없으므로 현재 session의 scalar state로 바꾼다. |
| overlay collapse/last-seen의 `*ByViewId` 맵 | `remove` | production caller가 없는 test-only shape다. store와 overlay-only fixture에서 제거하고 필요하면 component-local test fixture로 격리한다. |
| visible window의 `*ByViewId` 맵 | `remove` | `resultKey + visibleCount`를 유지한 active session scalar로 옮긴다. |
| `consumedPromptsByViewId` | `remove` | production 동작을 확인한 뒤 store, action, 복원 코드를 함께 제거한다. |
| `prefillQuery` | `remove` | non-null producer가 없음을 테스트로 확인한 뒤 제거한다. |
| `agent-store.ts` | `remove` | production import가 없음을 gate로 확인한 뒤 제거한다. |
| `library-anchor-selection-store.ts` | `remove` | production import가 없음을 gate로 확인한 뒤 제거한다. |
| `updatedAt` 기반 실행 guard | `preserve` | 현재 active guard로 유지한다. 실패 재현과 대체 guard의 원자적 전파가 끝날 때만 제거 판정을 다시 연다. |
| 기능별 background controller 맵 | `preserve` | 현재 task 실행을 소유한다. 중복 수명 코드가 실제 변경을 반복시킬 때 후속 Concept Shift에서 제거를 재판정한다. |
| `ResearchRoutePayload` union | `preserve` | 초기 단계의 wire/render contract로 유지한다. 변경 전파가 계속 크면 후속 판정을 연다. |
| payload의 status/version/timestamp | `preserve` | 현재 API와 persistence compatibility를 유지한다. `updatedAt`은 현재 guard 역할도 유지한다. |
| `reactionVersion` field와 DB column | `preserve` | gap reaction 선택의 단조 순서를 소유한다. artifact `version` CAS는 row 전체의 충돌을 막고, `reactionVersion`은 이전 execution의 늦은 선택을 구분한다. |
| repository의 gap row→renderer payload adapter ownership | `preserve` | 현재 active 변환 경계로 유지하되 ownership drift 후보로 기록한다. 후속 Concept Shift에서 domain-access 이전 여부를 판정하며, 그전에는 renderer field를 더 추가하지 않는다. |
| `search-service.ts`와 `gap-network-view-access.ts` 경계 | `preserve` | 0단계에서 서비스 경계를 바꾸지 않는다. 후속 측정 대상으로만 둔다. |
| `search-view.helpers.ts`의 effect 함수 | `preserve` | 현재 active caller가 있다. pure/effect 동시 변경이 반복될 때 후속 Concept Shift에서 제거를 재판정한다. |

## 단계별 개선안

각 단계는 독립적으로 merge하고 되돌릴 수 있어야 한다. 앞 단계가 완료되지 않아도 다음 단계의
새 추상화를 먼저 넣지 않는다.

### 0단계. 죽은 상태 제거

대상은 `agent-store`, `library-anchor-selection-store`, `consumedPromptsByViewId`, `prefillQuery`,
overlay collapse/last-seen state다. 각 항목은 production import, setter, render caller를 다시
확인한 뒤 관련 test와 fixture까지 함께 제거한다.

`AgentPanel`의 production caller는 inline layout만 사용한다. `compact`, `wide`, `overlay`
분기와 `agent-panel-shell` 의존성이 계속 production에 필요하다는 근거가 없으면 함께 제거한다.
test와 live evidence는 실제 inline surface를 렌더한다. 테스트 전용 layout이 필요하다는 이유로
production branch나 component-local state를 남기지 않는다. 순수 fixture가 필요하면 test 경계로
옮긴다.

삭제는 direct import에서 끝내지 않는다. `stryker.research-route.config.mjs`, mutation config
assertion, Mission Control surface allowlist, `docs/infrastructure.md`를 함께 갱신한다.
`library-anchor-selection-store` 값을 바꾸기만 하던 test는 setup 줄만 삭제하지 않는다. 각 test가
현재 route-owned input, library availability, personalize preference 중 실제 owner를 통해 같은
행동을 검증하는지 다시 확인한다.

완료 조건:

- 해당 symbol의 production reference가 없다.
- 삭제된 module을 가리키는 mutation config, allowlist, infrastructure entry가 없다.
- test와 live evidence가 test-only production layout이나 죽은 store setup에 의존하지 않는다.
- store hydration과 reset test가 더 단순해진다.
- 사용자 동작과 network request 수가 바뀌지 않는다.

### 1단계. gap reaction write ordering correctness

이 단계는 active-session refactor와 분리한다. 현재 client sequence guard는 늦은 응답을 화면에
반영하지 않을 뿐이다. 두 PUT이 같은 history를 읽고 역순으로 commit하면 DB의 최신 reaction과
history가 이전 사용자 선택으로 돌아갈 수 있다. 이 문제는 현재 artifact correctness 결함이다.

구조 판단은 다음과 같다.

- source owner: `gap_reports` artifact가 reaction과 history의 정본을 소유한다.
- timing: 사용자가 prepared overview, cluster, gap 설명을 선택한 직후 mutation을 시작한다.
- freshness와 invalidation: 선택은 마지막 확인 `reactionVersion`을 싣는다. 서버는
  `reactionVersion`을 단조 증가시키고 artifact `version`도 CAS한다. 다른 종류의 artifact
  write는 row version만 바꿀 수 있으므로 conflict가 나면 최신 artifact를 다시 읽는다.
- fallback: optimistic reaction은 active write 동안 현재 session에 남는다. definite failure나
  canonical 관찰값 없는 ambiguous failure는 마지막 server-confirmed reaction을 복원한다.
  더 최신 artifact를 관찰했다면 그 persisted projection으로 화해한다.
- rejected alternative: client late-response discard와 무조건 last-write-wins update만으로는 서버
  역순 commit과 history 유실을 막지 못하므로 거부한다.

먼저 겹친 PUT 두 개가 같은 history를 읽고 역순으로 commit하는 실패 test를 추가한다. 같은
active session에서는 active write 하나만 두고 중간 선택을 최신 pending 값으로 coalesce한다.
각 PUT은 새 reaction과 선택 시점의 `baseReactionVersion`만 보낸다. 서버는 owner-scoped
artifact를 다시 읽어 현재 `version`, `reactionVersion`, server-owned history를 얻는다.
domain-access는 version 조건부 repository update로 row를 CAS하고 `reactionVersion`을 함께
증가시킨다. 오래된 reaction version에서 시작한 요청은 현재 artifact를 반환한다. browser
timestamp는 ordering token으로 사용하지 않는다. conflict면 최신 artifact를 다시 읽어
history를 rebase한다. stale reactionVersion 응답은 현재 선택 payload를 bounded retry하고,
그 사이 최신 pending 선택이 생기면 오래된 intent는 더 보존하지 않고 pending 선택이 관찰된
server version에서 기존 CAS 경로를 이어간다. 이 단계가
닫히기 전에는 visible-window나 AI comment state scalar화를 시작하지 않는다.

완료 조건:

- 겹친 gap PUT가 역순으로 완료되어도 최종 DB reaction이 최신 사용자 선택이다.
- 두 요청이 같은 history에서 시작해도 성공한 선택의 history가 유실되지 않는다.
- conflict와 실패가 optimistic session을 artifact-confirmed 성공으로 승격하지 않는다.
- definite 4xx 실패는 마지막 server-confirmed reaction을 복원한다. ambiguous write는 bounded
  read-back에서 관찰한 최신 canonical artifact로 화해하고, 관찰값이 없을 때만 마지막 confirmed
  reaction을 복원한다.
- stale active payload는 bounded rebase하며, 최신 pending 선택은 관찰한 reactionVersion에서
  CAS를 이어간다. 확인되지 않은 오래된 intent를 별도 상태로 보존하거나 replay하지 않는다.
- `gap_reports` owner predicate와 artifact ownership을 유지한다.
- `reactionVersion`은 새 ordering 책임을 계속 소유한다. 제거하려면 같은 단조 ordering을
  제공하는 대체 protocol과 deterministic evidence가 먼저 필요하다.

### 2단계. 실행 identity characterization

scalar writer의 인자를 정하기 전에 동일 id·동일 `updatedAt` 재진입과 stale completion test를
추가한다. Suspense fallback runtime과 resolved runtime은 서로 다른 mount와 owner를 가진 별도
실행으로 검증한다. 이전 mount의 cleanup이 새 session을 지우지 않아야 한다.

다음 producer와 completion을 같은 failure table에서 확인한다.

- search enrichment와 term discovery
- spelling correction
- graph neighbor hydration과 inline analysis
- gap reaction PUT과 status polling
- AI comment queue, request, completion
- route entry와 unmount cleanup

`PR #266`이 추가한 `mergeSearchBackgroundMetadata`는 data freshness merge로 유지한다. execution
identity를 대신하지 않는다. 이전 term discovery completion이 새 session에서 거부되면
`product.research_terms.viewed`도 발화하지 않는다. accepted completion은 current route view가
closed extraction result를 받은 뒤 기존 `once_per_identity` cardinality로 한 번만 기록한다.

현재 composite identity와 기존 guard 보강으로 실패를 닫을 수 있으면 `executionEpoch`를 도입하지
않는다. 그렇지 않을 때만 안정적인 per-entry token을 선택한다. 이 단계가 끝날 때 scalar writer가
받을 `expectedExecution`의 최소 모양을 확정한다.

### 3단계. visible window를 scalar화

AI comment와 background runtime을 그대로 둔 채 `searchVisibleWindowByViewId`와 모든 caller/test를
같은 PR에서 원자적으로 바꾼다. 2단계에서 확정한 `expectedExecution`과 `resultKey`를 writer가
검증한다. `expectedViewId + resultKey`만으로 같은 id·같은 result batch의 새 runtime instance를
구분할 수 있다고 미리 가정하지 않는다.

compatibility selector나 scalar/map dual write는 두지 않는다. visible window는
`resultKey + visibleCount` invariant를 그대로 유지한다.

완료 조건:

- 옮긴 field의 map, action, direct `getState()` caller가 같은 변경에서 사라진다.
- 이전 route의 늦은 effect나 callback이 새 route의 scalar UI state를 바꾸지 못한다.
- 같은 result batch의 동일 실행 remount에서는 visible window가 유지된다.
- 새 실행 또는 새 result batch에서는 visible window가 초기값으로 돌아간다.
- analytics의 payload id, reaction key, viewed event cardinality가 바뀌지 않는다.

### 4단계. 조건부 실행 guard 전환

2단계에서 per-entry token이 필요하다고 판정했을 때만 producer군 하나와 그 completion consumer를
같은 변경에서 옮긴다. 새 guard와 기존 snapshot/freshness guard를 함께 적용한다. 아직 옮기지
않은 producer는 기존 action을 사용한다. scalar/map dual state는 만들지 않는다.

spelling correction은 같은 URL 재진입에서 이전 module-scope `resolved` entry가 새 실행의 평가를
막지 않아야 한다. 이전 request completion도 새 session을 patch하지 않아야 한다. term discovery는
이전 실행의 queued, running, error entry를 종료 시 제거하거나 execution identity로 격리한다.
같은 실행 안의 error dedupe는 유지한다.

모든 route-scoped producer와 direct `patchCurrentView` caller가 새 guard를 제출하는지 `rg`와
targeted test로 확인한 뒤 대체된 실행 guard를 제거한다. `updatedAt` freshness, generation,
`cycleKey`, attempt key, phase는 해당 의미가 남는 한 유지한다.

완료 조건:

- 옮긴 producer군은 시작 시 execution identity를 캡처하고 완료 시 제출한다.
- 이전 실행의 completion과 cleanup이 새 session에 영향을 주지 않는다.
- spelling correction이 같은 URL 재진입에서 다시 평가되고 이전 결과를 거부한다.
- term discovery의 이전 `error`가 새 실행 queue를 막지 않는다.
- 전체 caller 확인 뒤에만 대체된 실행 guard를 제거하고 freshness 비교를 유지한다.
- generation, `cycleKey`, attempt key, phase 같은 operation identity를 유지한다.

### 5단계. AI comment state를 원자적으로 scalar화

reaction, pending, started, history append, generation map과 모든 direct `getState()` caller를
`RouteAiCommentState`와 event transition으로 함께 옮긴다. 일시적 route에서 session은 현재
projection을 소유한다. gap에서는 `gap_reports` artifact가 정본이고 session은 hydrate와
write-through 결과를 반영한다.

`enterRoute`만 payload의 persisted history를 strict hydrate한다. 일반 view patch는 현재
optimistic AI state를 덮지 않는다. gap reaction PUT은 성공 응답이나 bounded read-back에서
관찰한 canonical artifact만 projection에 반영하고 실패를 영속 성공으로 취급하지 않는다.
active write 동안 현재 session의 optimistic projection을 유지한다. definite failure 또는 canonical
관찰값 없는 ambiguous failure는 마지막 server-confirmed reaction을 복원한다. 다른 writer의 최신
canonical artifact를 관찰했다면 그 projection으로 화해하고, 최신 pending 선택이 있으면 관찰한
reactionVersion에서 CAS를 이어간다. 별도 사용자-facing 실패 표시가 필요해지면 구현 전에 Mission
Control에서 Acceptance Check를 연다.

1단계가 닫은 gap write ordering과 artifact `version` CAS를 그대로 사용한다. AI comment state
scalar화는 persistence ordering을 다시 정의하지 않는다.

AI request의 논리적 discard와 transport cancel을 구분한다. route leave에서는 active request를
abort한다. generation supersede는 abort하거나 완료를 허용한 뒤 discard하는 정책 중 하나를
현재 runtime contract와 함께 명시한다.

새 상태 machine library는 도입하지 않는다. 현재 transition 수와 실패 mode가 reducer로 표현하기
어려워질 때만 별도 제안을 연다.

완료 조건:

- store의 reaction 관련 `*ByViewId` 맵과 direct caller가 없다.
- stale execution 또는 stale generation 결과가 deterministic하게 거부된다.
- cancel, retry, append, route leave, transport abort가 transition test 표로 검증된다.
- gap 재진입 history 복원과 이전 PUT/poll completion 거부가 검증된다.
- PUT conflict와 실패가 optimistic session을 artifact-confirmed 성공으로 승격하지 않는다.
- detached navigation 이후 이전 route의 comment가 노출되지 않는다.

### 6단계. background task 수명 재판정

먼저 term discovery도 route 변경 시 abort하고 같은 URL 재진입에서 이전 completion을 거부하게
한다. controller가 없는 `error` entry도 이전 execution 종료 시 제거하거나 execution identity로
격리해 새 실행의 queue를 막지 않게 한다. 같은 실행 안의 error dedupe는 유지한다. 여러
controller cleanup의 반복이 이후 변경에서도 계속 문제를 만들 때만 공통 helper나 task registry를
제안한다.

단순 cleanup helper로 충분하면 registry를 만들지 않는다. registry가 필요하면 identity는
`taskKind + execution identity + operationKey`다. `operationKey`는 task에 따라 `cycleKey`,
attempt key, phase를 사용한다. completion과 retry state는 각 task owner에 남긴다.

완료 조건:

- inline analysis, search enrichment, graph hydration, term discovery의 route leave와 같은 URL
  re-entry test가 통과한다.
- 이전 term discovery가 error여도 같은 URL의 새 실행은 다시 queue된다.
- task별 request 순서, retry, completion, fallback policy가 바뀌지 않는다.
- 공통화가 실제 중복 수명 코드만 줄이고 task input identity를 숨기지 않는다.

### 7단계. pure/effect 분리 재판정

다음 관련 변경에서 `search-view.helpers.ts`의 순수 계산과 request/persistence가 다시 함께
수정되는지 기록한다. 반복이 확인될 때만 I/O adapter 분리를 연다. 파일 크기 자체는 entry
condition이 아니다.

분리할 경우 순수 view model 함수는 domain input을 받아 render model을 반환하고 React, store,
fetch를 import하지 않는다.

### 8단계. payload lifetime과 repository adapter 재판정

앞 단계를 마친 뒤에도 search/citation/graph/gap 변경이 서로의 schema와 service를 계속 건드리는지
측정한다. repository가 renderer payload를 직접 만드는 현재 drift는 별도로 추적하되, 0단계에서
DB와 API contract를 바꾸지 않는다. 전환 전까지 repository에 새 renderer field를 추가하지 않는다.

전파가 확인되면 다음 분리를 검토한다.

- `EphemeralResearchView`: URL에서 재구성할 수 있는 search, citation, graph view
- `PersistedGapArtifact`: DB identity와 enrichment lifecycle을 가진 gap artifact
- renderer가 함께 쓰는 최소 `ResearchRouteRenderable` projection

adapter 변환을 repository에서 domain-access로 옮길지도 함께 판정한다. 이 단계는 API contract와
repository 경계에 영향을 줄 수 있으므로 별도 Concept Shift review와 Mission Control 범위 판정,
관련 engineering 정본 검토 뒤에 진행한다.

## 위험과 검증 초점

| 위험 | 필요한 검증 |
| --- | --- |
| 같은 URL 재실행이 이전 실행으로 오인된다 | 동일 id·동일 `updatedAt` 재진입에서 이전 completion과 cleanup 거부 test |
| fallback cleanup이 resolved runtime을 지운다 | 서로 다른 owner/session의 Suspense fallback→resolved interleaving test |
| gap reaction history가 session 정본으로 바뀐다 | artifact 재진입 복원, PUT 성공/실패, 이전 PUT/poll completion test |
| 겹친 gap reaction PUT가 서버에서 역순 commit된다 | 직렬화, artifact `version` CAS, conflict rebase test |
| hydration 결과가 새 route를 덮는다 | route leave 뒤 search enrichment, spelling correction, term discovery, graph hydration completion test |
| 이전 term discovery error가 새 실행을 막는다 | 같은 실행 dedupe와 같은 URL 새 실행 requeue test |
| AI comment retry가 최신 generation을 잃는다 | retry, cancel, append, transport abort 순서 table test |
| visible window reset이 pagination을 깨뜨린다 | 같은 `resultKey` 보존과 새 `resultKey` 초기화 test |
| 이전 route의 UI writer가 scalar state를 바꾼다 | 2단계에서 정한 `expectedExecution + resultKey`가 다른 visible-window write 거부 test |
| 이전 term discovery completion이 새 session analytics를 발화한다 | 새 session patch 거부와 `product.research_terms.viewed` 미발화 test |
| 공통 task helper가 task별 정책을 평준화한다 | 각 task의 operation key, request, retry, fallback contract test |
| remount가 analytics를 중복 발화한다 | payload id·reaction key 기반 `once_per_identity` cardinality test |

### Contract와 analytics 동기화

이 설계 문서는 Story Chain을 직접 바꾸지 않는다. 그러나 map을 scalar state로 바꾸거나 AI
comment owner와 처리 순서를 바꾸는 구현은 현재 정본 설명에 영향을 준다. 최소한 다음 정본을
같은 변경에서 확인하고 필요한 내용을 동기화한다.

- `docs/contracts/story-chain/evidence-ledgers/reaction-lifecycle.ledger.md`
- `docs/contracts/story-chain/evidence-ledgers/gap-network-e2.ledger.md`
- `docs/contracts/story-chain/aspects/route-view-ai-reaction-rules.md`
- `docs/runtime-flows/ai-response-generation.md`
- `docs/runtime-flows/search-mechanism.md`
- `docs/runtime-flows/gap-network-analysis.md`

AI response channel owner나 runtime response policy가 바뀌는지 구현 전에 Ask-first와 Mission Control
범위를 확인한다. contract-affecting 변경은 `quality:contract`로 닫는다.

gap reaction write ordering, `reactionVersion`, repository adapter ownership을 바꾸는 구현은
`gap-network-e2.ledger.md`의 purpose table, version 조건부 update, repository evidence도 함께
확인한다.

execution identity는 async 결과 적용 권한에만 사용한다. analytics event의 subject, property,
dedupe key에는 epoch를 넣지 않는다. 현재 `ownerPrincipalId`, payload id, reaction key 기반 identity와
`once_per_identity` cardinality를 보존한다. `product.research_terms.viewed`는 current route view에
accepted completion이 merge된 뒤에만 발화한다. 이전 실행의 rejected completion은 event를 만들지
않는다.

그 밖의 검증은 변경 단계에 맞는 targeted test부터 실행한다. 코드 변경 단계에서는
`quality:fast`와 관련 Story Chain/Evidence Ledger gate를 함께 닫는다.

## 측정 가능한 완료 기준

구조 개선이 완료되었다고 판단하려면 다음 조건을 확인한다.

- 각 field 전환이 끝날 때 해당 `*ByViewId` map과 direct caller가 함께 없다.
- dead state를 삭제한 뒤 mutation config, surface allowlist, infrastructure map, test fixture에 stale ref가 없다.
- gap reaction write ordering correctness가 active-session scalar화 전에 deterministic test로 닫힌다.
- route 진입과 같은 route patch가 서로 다른 command다.
- 실행 identity 실패가 재현된 경우 모든 route-scoped completion이 선택한 대체 guard를 검증한다.
- `PR #266`의 background metadata merge와 accepted-completion analytics timing을 유지한다.
- 공통 task owner를 도입했다면 모든 task가 execution identity와 operation key를 함께 검증한다.
- pure/effect 분리를 열었다면 순수 search view model이 fetch, persistence, store를 import하지 않는다.
- gap reaction/history의 정본은 계속 `gap_reports` artifact다.
- analytics viewed event의 canonical identity와 cardinality가 바뀌지 않는다.
- dependency 검사에서 순환 의존과 계층 위반이 계속 0이다.
- search, citation, graph, gap의 핵심 route transition test가 유지된다.
- 기능 변경 하나가 store, runtime, component의 동일 guard를 반복 수정하는 빈도가 줄어든다.

마지막 항목은 단일 LOC 목표로 판정하지 않는다. 후속 3개 기능 또는 수정 PR에서 함께 바뀐
module과 중복 guard 변경을 기록해 전파 범위를 비교한다.

## 채택하지 않는 대안

### 전면 재작성

현재 의존성 계층과 사용자 동작은 작동한다. 전면 재작성은 regression 범위를 키우고 어떤 구조가
실제로 필요했는지 확인하기 어렵게 한다.

### XState 같은 새 상태 machine 도입

문제는 도구 부족보다 state cardinality와 lifetime 불일치다. slice별 scalar 전환과 명시적
transition을 적용하고도 복잡성이 남을 때 도입 근거를 다시 만든다.

### 큰 파일만 분할

파일을 나눠도 실행 identity와 상태 소유권이 그대로면 복잡성은 import 사이로 이동할 뿐이다.
분할은 책임 경계가 확정된 뒤의 결과여야 한다.

### payload와 DB schema부터 분리

가장 넓은 영향 범위를 먼저 건드리는 순서다. 작은 state 정리를 마친 뒤 실제 변경 전파와 현재
repository adapter drift를 함께 판정하고 진행한다.

## 초기 구현 순서 판정과 실제 이력

초기 판정은 첫 slice를 **0단계 dead state 제거만**으로 제한했다. `agent-store`,
`library-anchor-selection-store`, `consumedPromptsByViewId`, `prefillQuery`, overlay collapse/last-seen
state와 production에 도달하지 않는 AgentPanel layout branch를 production reference 확인과 함께
제거한다. mutation config, allowlist, infrastructure map, 실제 owner를 쓰지 않던 test fixture도
같이 정리한다. 서로 독립된 항목이면 항목별 commit으로 나눌 수 있다.

실제 PR #268 이력은 이 판정을 지키지 못했다. 구현 commit `e79d6013` 하나에 dead state 제거,
gap write protocol, execution identity, visible-window와 AI comment scalar화를 함께 담았다. 따라서
각 단계의 characterization test와 최종 구조는 남아 있지만, 단계별로 독립 review·rollback할 수
있는 Git slice였다는 완료 주장은 철회한다. 이는 후속 worktree에서 이력을 다시 써서 해결하지
않으며, issue #265의 최초 구현 순서 기준이 충족되지 않은 historical process exception으로
기록한다. Task registry와 payload 분리는 entry condition이 성립하지 않아 열지 않았고, Promise
의미나 runtime response policy는 바꾸지 않았다.

## 리뷰 기록

| 역할 | 상태 | 확인 범위 | 결과 |
| --- | --- | --- | --- |
| 비동기 lifecycle·상태 정확성 | 검토 완료 | route 진입, hydration, AI comment, abort, stale result | 1차 7건, 2차 2건, 3차 2건 `valid` 반영, 4차 새 finding 없음 |
| 마이그레이션·과설계 | 검토 완료 | 단계 크기, 호환 경계, 불필요한 추상화, rollback | 1차 6건, 2차 4건, 3차 1건, 4차 1건 `valid` 반영, 5차 새 finding 없음 |
| domain·persistence 경계 | 검토 완료 | URL/DB ownership, payload, repository, runtime 영향 | 1차 6건, 2차 3건 `valid` 반영, 3·4차 새 finding 없음 |
| 최신 main 통합 재검토 | 보완 반영 | `PR #266` 이후 lifecycle·analytics, gap ordering, dead-state 파생 정리 | F-29~F-32 `valid` 반영 |

중복 finding을 합친 반영 기록은 다음과 같다.

| ID | 분류 | 반영 내용 |
| --- | --- | --- |
| F-01 | `valid` | active-session 전환을 transition slice별 atomic migration으로 분리하고 첫 구현에서 제외했다. |
| F-02 | `valid` | compatibility selector와 dual write 제안을 제거했다. |
| F-03 | `valid` | epoch를 실패 재현 뒤 선택하는 후보로 낮추고 producer군별 원자적 전파 조건을 추가했다. |
| F-04 | `valid` | Suspense fallback과 resolved runtime을 서로 다른 실행으로 규정했다. |
| F-05 | `valid` | term discovery와 gap PUT/polling을 stale completion 검증 범위에 넣었다. |
| F-06 | `valid` | task identity에 `operationKey`를 유지하고 registry를 조건부 후속안으로 낮췄다. |
| F-07 | `valid` | visible window의 `resultKey + visibleCount` invariant를 복원했다. |
| F-08 | `valid` | AI transport abort와 논리적 discard 정책을 분리했다. |
| F-09 | `valid` | 일시적 route와 gap artifact의 reaction/history ownership을 분리했다. |
| F-10 | `valid` | Story Chain, runtime-flow, `quality:contract`, Ask-first 동기화 의무를 추가했다. |
| F-11 | `valid` | `migrate-read-only` 오용을 제거하고 현재 active shape는 `preserve`로 판정했다. |
| F-12 | `valid` | gap row→renderer payload의 repository ownership drift와 interim rule을 기록했다. |
| F-13 | `valid` | epoch를 analytics identity에 사용하지 않고 기존 event cardinality를 보존하게 했다. |
| F-14 | `valid` | `reactionVersion`을 write-order 감사와 artifact `version` CAS 전환 전까지 보존하게 했다. |
| F-15 | `valid` | pure/effect 분리를 반복 변경이 관찰될 때만 여는 후속 재판정으로 낮췄다. |
| F-16 | `valid` | spelling correction의 module-scope request state를 실행 guard와 재진입 검증 범위에 넣었다. |
| F-17 | `valid` | term discovery의 이전 `error` entry가 새 실행을 막지 않도록 cleanup/isolation 조건을 추가했다. |
| F-18 | `valid` | scalar UI writer에 active view/operation guard와 stale writer test를 추가했다. |
| F-19 | `valid`, F-27로 대체 | overlay의 collapse/last-seen을 atomic slice로 묶었으나 production 미도달 근거 확인 후 제거 판정으로 대체했다. |
| F-20 | `valid` | route entry를 mount가 아닌 route-owned input 수용 변화로 정의하고 `leaveRoute`를 token 선택 뒤로 미뤘다. |
| F-21 | `valid` | 실행 guard 전환을 characterization, producer군별 이동, legacy guard 제거로 나눴다. |
| F-22 | `valid` | gap PUT를 직렬화하고 artifact `version` CAS와 conflict rebase로 서버 역순 commit을 막게 했다. |
| F-23 | `valid` | repository adapter verdict를 현재 `preserve`, 후속 Concept Shift 재판정으로 고쳤다. |
| F-24 | `valid` | gap schema/repository 변경의 covering ledger로 `gap-network-e2.ledger.md`를 추가했다. |
| F-25 | `valid` | 같은 payload를 수용하는 새 runtime instance도 per-entry token으로 구분되는 새 실행으로 정의했다. |
| F-26 | `valid` | 결론의 원자적 전환 설명을 producer군별 이동 후 legacy guard 제거 순서와 맞췄다. |
| F-27 | `valid` | production caller가 없는 overlay state를 scalar 전환이 아니라 0단계 제거 대상으로 옮겼다. |
| F-28 | `valid` | overlay 제거 뒤 남은 scalar writer 위험표 항목을 visible-window 범위로 고쳤다. |
| F-29 | `valid` | gap reaction 역순 commit을 현행 correctness 결함으로 분류했다. AI comment scalar화와 분리한 1단계에서 직렬화, artifact `version` CAS, conflict rebase를 먼저 닫게 했다. |
| F-30 | `valid` | 동일 id·동일 `updatedAt` characterization을 visible-window scalar화보다 앞으로 옮겼다. scalar writer는 characterization에서 정한 최소 `expectedExecution`을 받게 했다. |
| F-31 | `valid` | `PR #266`의 background metadata merge와 `product.research_terms.viewed` timing을 lifecycle 검증에 추가했다. rejected stale completion은 analytics를 발화하지 않게 했다. |
| F-32 | `valid` | dead-state 삭제 범위에 mutation config, config assertion, surface allowlist, infrastructure map, 죽은 test setup과 test-only AgentPanel layout 정리를 추가했다. |

1·2·3·4차 리뷰에는 `invalid`, `already-fixed`, `needs-human-decision` finding이 없었다. lifecycle과
domain 관점은 4차, migration 관점은 5차에서 새 finding 없이 닫혔다.
`PR #266` 병합 뒤 통합 재검토에서는 F-29~F-32를 `valid`로 분류해 반영했다.

## 최종 검토 verdict

- 비동기 lifecycle·상태 정확성: 최신 main 재검토에서 F-30·F-31 반영
- 마이그레이션·과설계: 최신 main 재검토에서 F-32 반영
- domain·persistence 경계: 최신 main 재검토에서 F-29 반영
- 누적 반영: F-01부터 F-32까지 반영. F-19는 추가 근거에 따라 F-27로 대체
- 미결 분류: `invalid` 0건, `already-fixed` 0건, `needs-human-decision` 0건

per-entry token 모양, gap CAS request/response, conflict status처럼 구현 중 정할 세부는 각 단계의
entry gate와 contract sync 조건에 남겼다. runtime response policy나 repository boundary 의미가
바뀌는 구현은 Ask-first와 Mission Control을 다시 통과한다. 이는 현재 구조 검토의 미반영 결함이
아니라 후속 구현 결정이다.
