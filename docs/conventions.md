---
type: design
---

# 코딩 규칙

이 문서는 이 저장소에서 실제로 쓰는 규칙만 남긴다. 프레임워크의 기본 진실은 Next.js 공식 문서를 먼저 따른다.

## 구현 착수 — 실행 가능한 최소 절단

작업 크기나 새 capability 여부만으로 CLI나 harness를 만들지 않는다. 실패하면
구현 방향이 달라지는 미검증 가정이 하나 이상 있을 때만 넓은 구현 전에 최소 실행
절단을 만든다. 이미 실제 경로와 관련 테스트가 그 가정을 충분히 검증했거나, 결과가
편집 방향을 바꾸지 않는 국소 변경이면 새 실행면을 만들지 않는다.

최소 실행 절단은 대표 사례 하나가 가장 큰 불확실성을 통과하고 결과를 기계적으로
판정할 수 있는 가장 작은 경로다. 다음 순서로 범위를 정한다.

1. 정답이나 기대 상태를 아는 대표 입력 하나를 고른다.
2. 실패하면 구현 방향을 바꿔야 하는 가정을 하나 고른다.
3. 그 가정을 직접 통과하는 가장 얇은 기존 실행면을 선택한다.
4. 제품이 사용하는 진입 경계 또는 검증 대상 seam에서 production 후보
   함수·service·adapter를 호출한다.
5. 성공 결과와 주요 실패 상태를 구조화된 출력이나 assertion으로 판정한다.

CLI는 인증·외부 API·파일·데이터 변환처럼 화면 없이 실행할 수 있는 문제의 기본
실행면이다. CLI 자체가 원칙은 아니다. 불확실성이 있는 경계에 따라 다음 실행면을
선택한다.

| 가장 큰 불확실성 | 최초 실행면 |
| --- | --- |
| 외부 API·인증·파일 형식 | read-only-first CLI 실행 |
| 순수 알고리즘·데이터 변환 | 함수 + 대표 fixture test 또는 benchmark |
| DOM·브라우저 이벤트·레이아웃 | 저장소에 이미 있는 브라우저 실행면 |
| OAuth callback·webhook·HTTP 상태 | 실제 route를 통과하는 최소 request + replay |
| 동시성·queue·timeout·provider 제한 | 제한된 workload. SLO·용량은 Operational Readiness의 기존 rail |
| DB migration·대량 mutation·인프라 변경 | plan/diff, dry-run 또는 격리된 test resource |

새 도구는 이 원칙을 근거로 추가하지 않는다. 필요한 도구가 저장소에 없으면
`AGENTS.md`의 Ask first 경계를 따른다. 부하 실행은 임의의 load-smoke를 만들지 않고
`docs/operational-readiness.md`가 소유하는 rail과 수치 기준을 사용한다.

외부 상태나 비결정적 결과가 있는 경계는 가능하면 live 확인과 결정적 replay를
짝지어 둔다. Live 실행은 read-only를 기본값으로 삼고 호출 수·비용·대상 resource를
미리 제한한다. mutation이 검증에 필요하면 dry-run이나 격리된 test resource를 먼저
사용한다. 실제 외부 상태를 바꾸려면 그 변경 권한을 별도로 확인한다. 비밀정보,
원문 개인정보, 인증 토큰은 fixture·로그·CLI 출력에 남기지 않는다. Replay는
익명화한 최소 응답만 사용한다.

최소 실행 절단은 production과 분리된 대체 구현이 아니다. CLI나 harness에 business
logic을 넣지 않는다. 제품과 같은 인증·권한·adapter·service 경계를 통과해야 하며,
편의를 위해 repository나 저수준 provider를 직접 호출해 경계를 우회하지 않는다.
저수준 경계 자체가 검증 대상이라 직접 호출해야 한다면 그 이유와 범위를 명시한다.

실행 절단을 만들었으면 검증한 가정, 대표 실행 방법, 실제 결과, 구현 방향에 미친
판단, 안전 경계의 예외를 작업이 이미 사용하는 plan, PR 본문, runtime-flow 또는
Project Knowledge 중 한 곳에 남긴다. 이 기록을 위해 별도 실행 절단 ledger를
만들지 않는다.

결과가 구조 선택을 지지하면 대표 사례를 production 경로를 보호하는 테스트로
전환하고 임시 CLI나 harness는 기본적으로 삭제한다. 반복 진단이나 운영 가치 때문에
유지할 때만 소유 위치, 실행 명령, 안전한 기본값, 유지 이유를 같은 변경에 남긴다.
결과가 가정을 반박하면 넓은 구현을 중단하고 구조를 다시 선택한다.

저장소에 남는 코드나 유지되는 harness는 일반 코드 변경과 같은 Story Chain·검증
절차를 따른다. 저장소 변경 없이 기존 실행면을 호출하는 일회성 read-only 진단은
구현 artifact가 아니다. 최소 실행 절단은 Mission Control, Contract Architecture
Impact Review, Story Chain, Evidence Ledger, 관련 release gate를 대체하지 않는다.
사용자-facing 의미가 바뀌면 필요한 승인과 계약 작업을 먼저 닫는다.

## 1. Next.js / React 기본 규칙

- Next.js 관련 작업 전에는 `node_modules/next/dist/docs/`의 관련 문서를 먼저 확인한다.
- App Router에서는 Server Component를 기본값으로 둔다.
- `"use client"` 파일은 브라우저 API, 이벤트 핸들러, 로컬 상태가 필요한 곳에만 둔다.
- Client Component를 `async`로 만들지 않는다.
- Server -> Client props는 직렬화 가능한 값만 넘긴다.
- Route Handler는 `app/**/route.ts`에 두며, 같은 세그먼트의 `page.tsx`와 함께 두지 않는다.

`async` Client Component 금지는 `eslint-config-next`의
`@next/next/no-async-client-component`가 검사하고, repository `lint`가 warning도
실패로 처리한다. Server → Client 직렬화 가능성은 값의 타입과 실제 boundary를
함께 봐야 하므로 전용 custom lint를 두지 않는 의도적 산문·리뷰 규칙이다.
Next.js·TypeScript가 제공하는 더 정확한 정적 규칙이 생기면 분기 표준 후보
심의에서 교체한다.

## 2. Import 규칙

- 런타임 코드는 가능한 한 직접 경로 import를 우선한다.
- `@/app/domain` barrel은 type-only 공유 계약을 가져올 때에만 제한적으로 허용한다.
- Client Component에서 `app/server/**`를 import하지 않는다.
- repository 계층에는 barrel export를 만들지 않는다.

## 2.1 파생 우선과 중립 계약 owner

하나의 의미는 하나의 canonical 정의가 소유한다. client, API, server,
repository는 그 정의를 소비한다. 여러 계층이 같은 값 집합이나 필드 목록을
각자 다시 선언하지 않는다.

타입과 runtime validator는 canonical 정의에서 파생한다. 값 배열은
`typeof VALUES[number]`로 타입을 만들고, Zod schema는 `z.infer`로 타입을
만든다. 예를 들어 `app/domain/analysis.ts`의
`INLINE_ANALYSIS_RETRY_COMMANDS`가 retry command 값과
`InlineAnalysisRetryCommand`를 함께 결정한다. API parser와 persistence
transition도 이 정의를 소비한다.

공유 어휘의 owner는 effectful 모듈이 아니다. client, route handler, service,
repository가 함께 쓰는 vocabulary는 `app/domain/` 같은 중립 contract 모듈에
둔다. DB 접근, provider 호출, HTTP 처리처럼 effect를 수행하는 모듈은 그
vocabulary를 정의하지 않고 소비한다.

이 규칙이 같은 이름의 모든 shape를 합치라고 요구하지는 않는다. lightweight
projection과 hydrated shape처럼 필드, source, 수명, 소비 목적이 다른 값은
각각의 의미를 가진다. 예를 들어 provider mapping의 `MappedPaper`와
사용자-facing `PaperCore`는 author 표현과 hydration 의미가 다르면 별도
shape로 유지할 수 있다. 이때 각 adapter는 어느 의미를 보존·변환·의도적으로
제외하는지 명시한다. 같은 의미를 중복 정의하는 편의성만으로 별도 shape를
만들지는 않는다.

## 3. 파일 배치

- 타입 계약: `app/domain/`
- UI 컴포넌트: `app/components/`
- route handlers: `app/**/route.ts`
- route-view AI comment generation: `app/server/agent/`
- 작업 맥락 버퍼: `app/server/reference/working-context.ts`
- 비즈니스 로직: `app/server/services/`
- 소유권 검증된 접근 계층: `app/server/domain-access/`
- 저수준 DB 접근: `app/server/repository/`
- `app/lib/`: client·server가 공유하는 순수 모듈을 두는 곳이다.
  `app/server/**`를 런타임 import(repository·service·gateway 호출)하는 모듈은
  `app/server/` 아래 둔다. server 모듈의 타입만 가져오는 type-only import는
  허용하며, production `app/lib/**`의 runtime 역참조는 dependency-cruiser가 차단한다.

클라이언트 background 작업의 소유 위치:

- **route-수명 작업** — research route가 살아 있는 동안 어느 렌더러가 보이든 진행되어야
  하는 작업(검색 enrich, 연구 용어 추출, inline analysis, gap 문서 생성·polling)은
  `app/components/research/ResearchBackgroundTasks.tsx`가 소유한다.
- **renderer-수명 작업** — 특정 문서 렌더러가 열려 있을 때만 의미 있는 작업
  (gap enrichment, graph-neighbors 카드 hydration, gap prepared reaction sync)은
  해당 렌더러 내부가 소유한다.
- 새 background 작업은 위 두 위치 중 하나를 고른다. view 내부 hook 소유는 맞춤법
  교정(`search-view-content.tsx`, module-level dedup 상태 동반)의 기존 예외 하나뿐이며
  새 작업의 기준이 아니다.

## 4. 데이터 접근 경계

| 경계 | 규칙 |
|------|------|
| page / route / server entrypoint | repository를 직접 import하지 않는다 |
| domain-access | 소유권 검증과 저장 경로 조합의 진입점이다 |
| service | 외부 API 호출, payload 변환, 순수 로직을 맡고 DB를 직접 건드리지 않는다 |
| repository | 저수준 DB 연산만 담당한다 |
| server/auth | 인증 resolver는 write-free다(`guard:auth-resolver-write-free`). service-role client는 생성 즉시 registry-backed opaque handle로 바꾸고 raw client를 반환하거나 저장하지 않으며 repository runtime을 import하지 않는다. 예외로 `app-user-snapshot.ts`만 저빈도 snapshot write를 위해 repository를 직접 쓴다 |

domain-access는 선형 pass-through가 아니라 조합 허브다. 소유권 검증 뒤 같은 경로 안에서
service 호출과 repository 접근을 직접 조합한다. entrypoint가 repository를 import하지
않는 규칙과 service가 DB를 건드리지 않는 규칙은 그대로다.

DB 접근을 새로 넣거나 위치를 바꿀 때는 구현 전에 구조 판단을 먼저 한다.
`docs/principles.md`, 이 문서, `docs/infrastructure.md`, 관련 runtime-flow를 기준으로
implementation author가 local technical choice를 소유한다. 실행 순서·persistence·sync
ownership이 바뀌면 `runtime-flow-sync`, gate 의미가 바뀌면 `quality-gate-steward`, 제품
계약이 바뀌면 Mission Control, SLO·용량이 바뀌면 Operational Readiness mandate로
escalate한다. `jaeyoung-think`는 사용하지 않는다. 다음 결정을 작업 기록, PR 설명,
계약 문서, 또는 runtime-flow 문서 중 해당 작업이 이미 쓰는 close-out 위치에 남긴다.

- source owner: live DB, preloaded snapshot, route metadata, cache, 외부 source 중 무엇이
  현재 값을 소유하는가.
- timing: 앱 진입, route bootstrap, 사용자 mutation 직후, request hot path,
  background sync 중 어디서 읽거나 쓸 것인가.
- freshness와 invalidation: snapshot/cache가 언제 stale이 되며, 어떤 mutation이나
  refresh가 갱신을 소유하는가.
- fallback: source가 없거나 stale이거나 timeout일 때 keyword-only, cached result,
  degraded state, retry 중 어디로 내려가는가.
- rejected alternative: live DB read, preload, cache, background sync, defer 중 최소
  하나를 왜 거부했는가.

route/runtime hot path에 live DB read/write를 남기는 것은 기본값이 아니다. 먼저
preloaded snapshot, request 전 bootstrap, 사용자 mutation 직후 client/server cache 갱신,
background sync로 같은 사용자 결과를 만들 수 있는지 검토한다. currentness가 제품
계약의 일부라 snapshot으로 표현할 수 없을 때만 hot path DB 접근을 선택하고, 그 선택을
위 항목으로 기록한다.

이름 규칙:

- `Owned*`: ownership-bearing domain variant를 다른 projection과 구분하는 타입
  이름이다. 현재 `OwnedResearchRoutePayload`와
  `OwnedCreateResearchRoutePayloadParams`가 owner identity를 가진 route와
  viewer projection을 구분한다. 모든 domain-access 함수에 강제하는 접두어가
  아니다.
- `*ForTrustedAgent`: 에이전트 런타임 같은 신뢰 경로 전용
- `*Unchecked`: 저수준 DB 접근

## 5. ResearchRoutePayload 타입 추가 규칙

1. `app/domain/research-route-payload.ts`에 타입과 metadata를 추가한다.
2. `app/domain/research-route-payload-schema.ts`에 Zod 스키마를 추가한다.
3. `app/domain/view-snapshot.ts`와 `app/lib/view-snapshot.ts`의 route-kind snapshot 경계를 갱신한다.
4. `app/components/research-route-renderers/`에 렌더러를 추가하고 `app/components/research/ResearchRouteLayout.tsx`에 연결한다.
5. 필요하면 `app/server/domain-access/gap-report-access.ts`, `app/server/domain-access/gap-network-view-access.ts`, 목적별 repository(`gap-reports`, `reviewed-papers`, `inline-analysis-cache` 등), 관련 service를 갱신한다.
6. type별 snapshot/prompt context와 테스트까지 함께 갱신한다.

## 6. AI 생성 경계 추가 규칙

1. 현재 route-view AI comment는 `POST /api/route-ai-comments/generate/:viewId`와
   `executeStructuredGeneration` 경계가 소유한다.
2. 새 AI 생성 경계를 추가할 때는 전용 route/service, structured schema, timeout,
   nullable/failure behavior를 함께 정의한다.
3. visible behavior가 바뀌면 runtime-flow, Story Chain, Evidence Ledger, 테스트를 함께
   갱신한다.

## 7. 기억 / 작업 맥락 규칙

- 자동 장기 기억 저장은 없다.
- 에이전트 응답 중간 결과는 세션 수명의 working context에만 남긴다.
- working context 동작을 바꾸면 `app/server/reference/working-context.ts`와
  해당 feature service/route의 저장·정리 경계를 같이 본다.

## 8. 성능 규칙

- 서로 독립적인 fetch, DB 조회, 외부 API 호출은 병렬화 가능성을 먼저 본다.
- 초기 번들에 큰 영향을 주는 브라우저 전용 기능은 lazy load 또는 동적 import를 우선 검토한다.
- research route, 검색 결과, gap network처럼 무거운 화면은 파생 계산과 불필요한 리렌더를 먼저 줄인다.
- 클라이언트로 끌어내릴 필요가 없는 데이터 읽기는 서버에서 끝낸다.

이 네 항목은 입력 독립성, 번들 영향, 화면 비용, serialization boundary를 함께
판단하는 의도적 리뷰 휴리스틱이다. 개별 작업의 `code`,
`load-security`, `architecture` 렌즈에서 적용하고 blanket lint로 바꾸지 않는다.
반복 가능한 false-pass가 실측되면 분기 표준 후보 심의에서 기존 owner나 guard
family로의 편입을 다시 판정한다.

## 9. 관심사 중앙화 (Cross-Cutting Concern Centralization)

여러 파일에 반복되는 값(API 경로, 에러 메시지, UI 문자열)은 한 곳에 선언하고, 사용 지점에서 참조하고, 직접 값 사용을 기계적으로 차단한다. 일반 원칙은 mirror-mind의 `agentic-engineering-principles.md` "관심사 중앙화" 섹션을 참조한다.

### 선언-매핑-강제 적용 현황

| 관심사 | 선언 | 매핑 패턴 | 강제 |
|--------|------|----------|------|
| API 경로 | `app/lib/api-routes.ts` | `import { API_ROUTES, researchRoutePageRoute, routeAiCommentGenerateRoute } from "@/app/lib/api-routes"` | ESLint `no-restricted-syntax` (`eslint.config.mjs`) — `"/api/..."` 리터럴/템플릿 차단 |
| 에러 메시지 | `app/domain/error-catalog.ts` + `app/lib/app-error.ts` | `throw new AppError("CODE", { ... })` | ESLint `no-restricted-syntax` — `throw new Error("한글...")` 차단 |
| UI 문자열 | `app/i18n/messages.ts` (+ `messages/*.ts` 도메인 partials) | `import { t } from "@/app/i18n/message-access"` → `t("key", { param })` | `scripts/quality/check-hardcoded-korean.mjs` (`guard:korean` → `quality:guards`) — JSX/TS의 한글 리터럴 탐지 |

### 새 값을 추가할 때

- **API 경로**: `app/lib/api-routes.ts`의 `API_ROUTES` 객체에 추가하거나 동적이면 헬퍼 함수(`researchRoutePageRoute`, `routeAiCommentGenerateRoute` 등)를 만든다. route handler(`app/api/**/route.ts`)는 경로를 정의하는 곳이라 차단 대상에서 제외된다.
- **에러 메시지**: 사용자 대면 에러는 `error-catalog.ts`에 `ErrorCatalogEntry`로 추가하고 `messageKey`는 i18n 메시지 키를 가리키게 한다. `route-guard.ts`가 `AppError`를 잡아 `t(messageKey)`로 응답을 생성한다. 내부/디버그 에러는 `Error`를 그대로 써도 된다(영어 메시지면 차단되지 않는다).
- **UI 문자열**: `app/i18n/messages.ts`나 적절한 `messages/<domain>.ts` partial에 키를 추가하고 `t("key")`로 참조한다. 템플릿 변수는 `{name}` 자리표시자를 쓰고 `t("key", { name: value })`로 전달한다.

### 예외 처리

| 상황 | 처리 |
|------|------|
| LLM 시스템 프롬프트 (`app/server/agent/**`) | 한글 검사에서 디렉토리 전체 제외. 사용자에게 보이지 않는 LLM 지시문이다. |
| 한글 데이터(stopwords, regex 패턴) | `// i18n-ignore` 줄 주석으로 단건 제외. UI 문자열이 아니라 처리 데이터다. |
| 테스트 파일(`__tests__/`, `*.test.*`) | 양쪽 규칙 모두에서 제외. fixture와 어설션은 자유롭게 쓴다. |

### 메시지 파일 분할

`app/i18n/messages.ts`는 `max-lines: 700` 룰을 받는다. 600줄을 넘기면 새 파일을 `app/i18n/messages/<domain>.ts`로 만들고 `messages.ts`에서 import + spread한다. 현재 분할 현황은 `app/i18n/messages.ts`의 domain partial import가 정본이다.

## 10. UI 구현 규칙 — Intent Traceability aspect

UI(카드, 섹션, 오버레이, 응답 surface, 시각화 등)를 새로 구현하거나 수정할 때는 Intent Traceability aspect를 **구현 과정의 규칙**으로 따른다. 코드 변경만 하고 aspect 단계를 건너뛰면 얼라인 체인을 stale로 본다.

- 철학(왜 검증되지 않은 의도는 출시하지 않는가)은 `docs/principles.md §0` 정본.
- 형식(Intent Check 필드 · Sufficiency Review 템플릿 · Verdict trichotomy · live judge 규칙 — API 키 누락 시 skip 금지 · fail)은 `docs/intent-traceability.md` 정본.
- 운영 절차(추가·수정·철회 워크플로 + cross-impact pre-check)는 `docs/mission-control.md` + Mission Control 스킬 정본.

구조적 가드: `docs/contracts/story-chain/evidence-ledgers/foundational/intent-traceability.md`가 설명하는 구조화 execution과 Mission Control 검증이 모든 UI spec의 `Sufficiency Review` 섹션·필수 필드·Verdict를 매 CI에서 감사한다. `not-met`/`unknown`이 하나라도 있으면 merge 차단.

## 11. 검증

문서 변경이 아니라 코드 변경일 때는 영향을 받는 검증을 실제 스크립트로 실행한다.
일반 PR 경로와 full evidence 실행은 분리되어 있다.

```bash
npm run quality:fast     # 일반 PR 전 로컬 게이트
npm run quality:full     # coverage + executable Evidence Ledger까지 보는 전체 로컬 게이트
npm run evidence-ledger  # 실행 계약에 영향이 있을 때 실제 structured execution evidence 실행
npm run build            # 릴리스 경로에 영향이 있을 때
```

## 12. 기술 처리절차 문서

Promise나 원리 문서만으로 부족한 runtime 처리 순서는 `docs/runtime-flows/*`에 둔다.

구분:

- `docs/contracts/story-chain/`: Promise / Aspect / Evidence Ledger 정본 + executable invariant
- Evidence Ledger YAML v2 `acceptanceChecks` · `scenario-catalog.md`: AC 원장 + 시나리오
- `docs/runtime-flows/*`: entrypoint, 단계 순서, fallback, sync ownership

현재 reaction response generation 순서는
`docs/runtime-flows/ai-response-generation.md`가 정본이다.

다음 변경은 같은 PR에서 runtime flow 문서도 같이 갱신한다.

- event routing
- structured generation / route-view AI comment 경계
- fallback 순서
- persistence / sync 절차
- 디버깅 체크리스트가 달라지는 처리 변경
