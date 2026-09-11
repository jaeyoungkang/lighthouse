# Search-first Reset Close-out — Evidence Matrix (#205)

2026-07-05. 이 문서는 이슈 #205가 요구하는 close-out evidence bundle의 매트릭스다.
#202(제품/런타임 모델), #203(서버 pruning), #204(클라이언트 상태), #206(DB 물리
모델)을 함께 판정하고, 각 legacy shape에 #189의 `preserve / migrate-read-only /
remove` verdict를 기록한다. 검증 명령과 세부 증거는 Story Chain Evidence
Ledger가 정본이고, 이 문서는 그 인덱스다.

## 1. Legacy shape verdict matrix (#189 Concept Shift Architecture Review — 첫 실증)

| Legacy shape | Verdict | 처리 | 증거/근거 |
| --- | --- | --- | --- |
| `Document` 중심 제품 모델 (document-first) | remove | 제품 단위를 route-owned 연구 뷰로 교체. 탐색 뷰(/search·/citation·/similar)는 URL 조건의 ephemeral 실행, 저장 산출물은 gap 리포트뿐 | `docs/product-identity.md`, aspect:search-first-url-model, search-ephemeral-execution.ledger |
| 내부 `/read` route · PDF reader · `pdf` DocumentType | remove | Phase 1(PR #207)에서 삭제, 00013 마이그레이션이 legacy 행 제거. 결과 카드 PDF는 Moonlight 외부 handoff | contract-check(`pdf` 부재·`app/(research)/read` 부재 정적 체크), 00013 |
| 검색 reserve + `/search/:id` canonical | remove | `/search?q=` 같은 주소 ephemeral 실행으로 대체. reserve promise 2개 철회(stance remove) | search-ephemeral-execution.ledger §retire 기록, promise:search-url-restores-search (met) |
| `/citation/:id` · `/similar/:id` 저장 id 탐색 route | remove | seedPaperId 조건 주소로 대체, 라우트 삭제(404) | S2 커밋, acceptance-check:research-route-cap-feedback-canonical-url |
| `documents` / `tabs` / `activeTab` 클라이언트 컬렉션 | remove | `research-route-store`의 단일 `currentView`로 교체. 개명 보존 아님 — 컬렉션·탭 상태 자체가 없음 | S2 커밋, research-route-store 테스트 |
| active-document URL sync (`DocumentUrlSync`) | remove | 삭제. URL이 유일한 내비게이션 소유자. 정적 계약 체크 `no-store-url-sync`가 재진입 차단 | `scripts/evidence-ledger/helpers/contract-check.ts` |
| 중앙 document-type renderer dispatch | remove | route별 renderer 직결. layout은 shell만 담당 | S2 커밋 |
| reaction runtime의 focused-document/collection context (`/api/reaction`) | remove | legacy interactive `/api/reaction` stream/respond 경로를 삭제하고, 현재 route-view 반응은 `POST /api/route-ai-comments/generate/:viewId`가 bounded `viewSnapshot`으로 `RouteAiComment-or-null` structured output을 생성한다. 서버 DB 재조회(chat-focused-document-access) 삭제 | promise:reaction-from-visible-snapshot (met), snapshot-reaction.ledger |
| reaction의 persisted-row 앵커 | remove | 탐색 뷰 reaction은 화면 스냅샷 입력·무영속. gap 리포트 reaction만 아티팩트 영속 | snapshot-reaction.ledger (met) |
| pending placeholder 문서 (citation/graph/gap) + `swapDocument` | remove | ephemeral 실행·`/gap/:id` building 폴링으로 대체 | S2·S3 커밋 |
| persisted citation/graph 생성 API (legacy documents/search namespace) | removed | 탐색 실행은 문서 생성 API를 호출하지 않으며 search snapshot background routes는 `/api/search/*` 아래에만 남는다 | acceptance-check:research-route-cap-feedback-rest-collection, S4 커밋, issue #221 후속 정리 |
| 검색 enrichment/hydration의 persisted doc PATCH | remove | stateless `/api/search/enrichment` + 클라이언트 최신성 보호 merge로 대체 | S3 커밋, freshness-guarded patchCurrentView |
| `documents` 테이블 (catch-all 물리 모델) | remove | gap 행은 00014로 `gap_reports` 이관, 00015가 FK 해제 후 DROP. legacy 탐색 행은 제품 의미 소멸 | 00014·00015 마이그레이션 |
| `document_collections` 테이블 · `documentCollectionId` | remove | 소유권은 `owner_principal_id`(인증 principal). 00015 DROP | S4 커밋, gap_reports 스키마 |
| analytics `documentCollectionId` identity · `surface: document-collection` | remove | 이벤트 이름은 유지(관측 행동 불변), identity/surface만 현재 어휘로 재앵커 | `docs/analytics/events.yaml`, mc:validate-events·mc:event-impact green |
| `interaction_events.document_id` · `error_logs.document_id` 컬럼 | migrate-read-only | FK만 해제, 컬럼은 역사 데이터 읽기용으로 유지. 새 쓰기 경로 없음 | 00015 마이그레이션 주석 |
| legacy route group names | remove(rename) | `app/(research)` / `app/(landing)`으로 개명. URL 불변(그룹은 URL-invisible) | S5 커밋 |
| route 횡단 `currentView` 수명 (active-document 잔재) | remove | 뷰 수명을 route에 귀속: route 전환 첫 프레임에도 이전 route 문서가 renderer/reaction 앵커에 도달하지 않고, route unmount가 store 뷰를 비우며, 떠난 뷰의 background 작업(inline analysis·enrichment)은 중단·폐기 | acceptance-check:search-query-route-transition-route-owned-render, ResearchRouteRuntime.route-owned-render.test |
| reaction tool-output document swap (`extractDocumentsFromToolOutput`) | remove | retired interactive respond 출력에서 문서를 추출해 현재 view를 교체하던 chat 앵커 잔재 삭제. 현재 route-view generation은 reaction body만 반영하고 문서 swap 경로를 갖지 않는다 | snapshot-reaction.ledger, reaction-lifecycle.ledger, route-view-ai-comment-generation-routing.ledger |
| legacy `knowledgeMapTasks` background runner (`background-task.helpers`, knowledge-map shared hooks) | remove | enqueue 경로 0인 dead lane 삭제 (#208 survivor 정리). background task가 현재 view로 화면을 교체하던 마지막 경로 제거. /gap building UI는 `PendingKnowledgeMapViewState` + `/gap/:id` 폴링이 담당 | background-task-store 축소, gap-network-analysis.md §9 |
| `reviewed_papers` · `paper_inline_analysis_cache` | preserve | paper 단위 키(문서 아님). 라이브러리·인라인 분석이라는 현재 Search-first 기능이 직접 정당화 | inline-analysis.ledger, library 계열 ledger |
| `gap_reports` 영속 | preserve | 저장 산출물은 gap 리포트뿐이라는 제품 결정의 구현. owner 스코핑·status·version CAS | 00014, gap 계열 ledger |
| 문서 id 키 클라이언트 보조 맵 (reaction/overlay/visible-window/consumed-prompts) | preserve | 현재 뷰의 reaction·표시 상태 — Search-first 기능이 직접 사용. 컬렉션 개념 아님 | research-route-store |
| Experience/Moment 이름의 `document-collection-*` 슬러그 | preserve(역사적 id) | Story Chain node id는 안정 식별자. 본문 의미는 Search-first로 갱신됨. rename은 concept-adjustment(Human authority)로 별도 판단 | concepts.md 원칙 |
| decision-log·리뷰 기록의 과거 어휘 | preserve(historical) | 불변 역사 기록. 현재 진리 서술 아님 | #208 분류 기준 |

## 2. 이슈별 완료 판정

### #202 — Search-first architecture reset
- 탐색 실행 모델: `/search?q=`·`/citation|similar?seedPaperId=` ephemeral 실행, 저장 id 탐색 route 부재. 첫 결과 경로는 bounded analytics/cached My Library graph preflight side-channel 외 repository import를 막는다(`guard:search-first-paint-no-db`).
- reaction: 화면 스냅샷 앵커 (promise:reaction-from-visible-snapshot met).
- gap: 별도 리포트 surface 유지, 스냅샷 입력 생성, `/gap/:id` uuid 검증.
- read/pdf: 활성 런타임 부재를 정적 계약 체크가 잠금.

### #203 — 서버/런타임 pruning
- 삭제(개명 아님): reserve access, chat-access, chat-focused-document-access, document-collection-access, search-hydration-access, followup/gap pending access, persisted citation/graph 생성 access, documents repository, `/api/documents` CRUD, legacy `/api/chat`.
- 보존(현재 역할): provider/AI gateway seam, auth resolver, gap-reports access, analytics/event/error access, route deadline·guard 레일 전체.

### #204 — 클라이언트 상태 리셋
- `documents/tabs/activeTab`·URL sync·중앙 renderer dispatch·pending placeholder·store 재사용 경로 제거. 단일 `currentView`.
- 잔여 참조는 불변 decision-log 역사 기록뿐.

### #206 — DB 물리 모델
- 00014: gap 행 `gap_reports` 이관(owner 스코핑·인덱스·CAS). 00015: FK 해제 + `documents`·`document_collections` DROP.
- hot path: per-request auth/user write 없음(`guard:auth-resolver-write-free`), history 비례 스캔 없음, owner 스코핑 인덱스.

### #205 횡단 항목
- analytics 정렬: search submit의 documentId 주체 제거(Phase 2), documentCollectionId identity 제거(S4). 이벤트 이름 불변.
- route group rename: `app/(research)`/`app/(landing)` 개명으로 마감.
- hydration/enrichment: 첫 결과를 막지 않고(post-paint), 최신성 보호 merge로 덮어쓰기 방지.
- provider 누락: source limit으로 표현(false zero 금지) — citation-lineage.ledger.

## 3. 검증 스택 (close-out 시점 실행 기록)

- `npm run quality:contract` — green (각 슬라이스 커밋마다)
- `npm run quality:fast` — green (각 슬라이스 커밋마다)
- `npm run evidence-ledger -- --ledger snapshot-reaction|search-ephemeral-execution` — green
- Story Chain: promises 39/39 met · ledgers 43/43 met (S1 이후 유지)
- 아키텍처 맵: close-out 당시 현재 코드 상세 지도와 4축 근거 보고로
  대체했다. 해당 일회성 `exploration/architecture-map/` 자료는 #343에서
  저장소 재고를 정리했고 원본은 git history에 남아 있다.
- role-separated review (2026-07-05, read-only codex 2종):
  - lifecycle reviewer — blocking 3건 발견·수정: ① 같은 canonical URL 재실행에서 이전 reaction/메시지 재생(실행 인스턴스 키를 `updatedAt`으로 구분해 keyed 상태 초기화), ② inline-analysis 완료 병합의 최신성 보호 우회(현재 metadata 기준 per-paper 병합으로 교체), ③ 00015가 미이관 gap 행을 검증 없이 DROP(gap_network 잔존 row assert 추가). non-blocking 1건(늦은 gap 생성 응답의 stale navigation)은 §4 후속.
  - contract-history reviewer — blocking 3건 발견·수정: 잘못된 runCommitSha 스탬프 교정(96a45984→3ae05bf8), route-view-ai-comment-generation-routing·provider-failure-degraded-mode·runtime-contract ledger의 삭제된 경로 인용 갱신.
- load-smoke: ephemeral 앵커 재측정은 `docs/operational-readiness.md` §1의 "재측정 필요" 항목. 실행이 실제 Episteme 부하를 만들므로(§3 체크리스트의 사전 확인 조건) 자율 실행하지 않고 코호트 go/no-go 시점의 운영 판단으로 남긴다.

## 4. 후속 (이 close-out의 범위 밖)

- #208/#221: 문서·보조 파일 전수 감사의 잔여는 route/snapshot naming으로 닫았다. `POST /api/search/term-discovery`와 `POST /api/search/spelling-correction`만 search snapshot background routes로 남고, legacy documents/search enrich 410 stub는 제거됐다. background-task-store의 legacy knowledgeMapTasks runner는 route-owned 뷰 수명 작업에서 삭제된 상태를 유지한다.
- lifecycle non-blocking: gap 생성 fetch의 scope guard(사용자 이탈 후 늦은 응답의 `/gap/:id` navigation 차단) — #208 또는 다음 UX 슬라이스.
- #189: 이 매트릭스가 Concept Shift Architecture Review의 첫 evidence case. 프로세스 정본화(AGENTS/agent-skills 라우팅)는 별도 process session에서.
- Experience/Moment 슬러그 rename 여부는 concept-adjustment 워크플로로 Human 판단.
