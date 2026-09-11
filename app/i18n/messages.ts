// Auto-collected Korean UI strings from the Light House codebase.
// Key convention: {domain}.{element}.{component.seq}
// Template placeholders use {name} syntax.
// Split by domain when file exceeds 600 lines.

import agentMessages from "./messages/agent";
import commitmentMessages from "./messages/commitment";
import communityMapMessages from "./messages/community-map";
import documentRenderingMessages from "./messages/research-route-rendering";
import gapNetworkBuilderMessages from "./messages/gap-network-builder";
import knowledgeMapInterpretMessages from "./messages/knowledge-map-interpret";
import onboardingMessages from "./messages/onboarding";
import searchMessages from "./messages/search";

const messages = {
  ...agentMessages,
  ...commitmentMessages,
  ...communityMapMessages,
  ...documentRenderingMessages,
  ...gapNetworkBuilderMessages,
  ...knowledgeMapInterpretMessages,
  ...onboardingMessages,
  ...searchMessages,

  // ── auth ──
  "auth.label.email-gate": "이메일을 입력하면 연구를 시작할 수 있어요",
  "auth.label.email-gate.sourceCoverage":
    "PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB에서 찾습니다.",
  "auth.label.email-gate.2": "{email}로 보낸 로그인 링크를 눌러주세요",
  "auth.label.email-gate.3": "링크 받기",
  "auth.label.email-gate.inboxPrompt.prefix": "메일함에서 ",
  "auth.label.email-gate.inboxPrompt.strong": "로그인 링크",
  "auth.label.email-gate.inboxPrompt.suffix": " 메일을 열고, 링크를 눌러 다시 돌아오세요.",
  "auth.label.email-gate.localHelper.prefix":
    "로컬 개발에서는 아무 이메일이나 사용할 수 있고, 인증 메일은 ",
  "auth.label.email-gate.localHelper.link": "개발 메일함(Mailpit)",
  "auth.label.email-gate.localHelper.suffix": "에서 수동으로 확인합니다.",
  "auth.label.email-gate.loading": "확인 중...",
  "auth.label.email-gate.resend": "링크 다시 보내기",
  "auth.label.email-gate.reenter": "이메일 다시 입력",
  "auth.error.request-magic-link": "네트워크 오류가 발생했습니다",
  "auth.error.request-magic-link.2": "인증 메일 전송 중 오류가 발생했습니다",
  "auth.label.auth-helpers": "로컬 개발에서는 아무 이메일이나 사용할 수 있습니다.",
  "auth.label.auth-helpers.2":
    "현재 사내 테스트 기간입니다. @corca.ai 또는 초대된 이메일만 사용할 수 있습니다.",
  "auth.label.auth-errors": "인증이 필요합니다",
  "auth.error.auth-errors": "접근 권한이 없습니다",
  "auth.error.auth-errors.2": "리소스를 찾을 수 없습니다",
  "auth.error.unauthenticated": "인증이 필요합니다",
  "auth.error.forbidden": "접근 권한이 없습니다",
  "auth.error.notFound": "리소스를 찾을 수 없습니다",
  "auth.error.emailInvalid": "유효한 이메일을 입력해주세요",
  "auth.error.emailRestricted":
    "현재 사내 테스트 기간입니다. @corca.ai 또는 초대된 이메일만 사용할 수 있습니다.",
  "invitedAccess.error.accessDecisionUnavailable":
    "접속 권한을 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
  "auth.error.magicLinkFailed": "인증 메일 전송 중 오류가 발생했습니다",
  "auth.error.networkError": "네트워크 오류가 발생했습니다",
  "auth.error.signoutFailed": "로그아웃에 실패했습니다. 다시 시도해주세요.",

  // ── admin ──
  "admin.access.eyebrow": "내부 운영 도구",
  "admin.access.title": "초대 사용자 접속 관리",
  "admin.access.description":
    "제품에 접속할 외부 이메일을 관리합니다. 변경은 다음 로그인 링크 요청과 다음 인증 요청부터 적용됩니다.",
  "admin.access.nav.label": "관리 도구",
  "admin.access.nav.access": "접속 관리",
  "admin.access.nav.analytics": "이벤트 카탈로그",
  "admin.access.add.heading": "외부 이메일 추가",
  "admin.access.add.description":
    "외부 사용자의 이메일을 입력하세요. 사내 이메일은 별도 정책으로 관리됩니다.",
  "admin.access.add.label": "초대 이메일",
  "admin.access.add.placeholder": "researcher@example.com",
  "admin.access.add.submit": "접속 허용",
  "admin.access.list.heading": "현재 접속 가능 이메일",
  "admin.access.list.pageCount": "현재 페이지 {count}개",
  "admin.access.list.empty": "현재 접속 가능한 외부 이메일이 없습니다.",
  "admin.access.list.pageEmpty":
    "현재 페이지에 표시할 외부 이메일이 없습니다. 페이지 이동으로 목록을 계속 확인하세요.",
  "admin.access.list.source.admin": "관리 화면에서 설정",
  "admin.access.list.updated": "{date} · {email}",
  "admin.access.pagination.label": "초대 이메일 목록 페이지",
  "admin.access.pagination.first": "처음",
  "admin.access.pagination.previous": "이전",
  "admin.access.pagination.next": "다음",
  "admin.access.pagination.last": "마지막",
  "admin.access.remove.submit": "접속 삭제",
  "admin.access.status.added": "외부 이메일의 접속을 허용했습니다.",
  "admin.access.status.removed": "외부 이메일의 접속을 삭제했습니다.",
  "admin.access.error.invalid": "유효한 외부 이메일을 입력해주세요.",
  "admin.access.error.saveFailed":
    "변경을 저장하지 못했습니다. 기존 접속 상태는 그대로 유지됩니다.",
  "admin.access.error.loadFailed":
    "현재 접속 이메일을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",

  // ── common ──
  "common.label.route": "conversationId, url 필수",
  "common.label.route.2": "conversationId 필수",
  "common.label.route.3": "query, conversationId 필수",
  "common.label.route.4": "paperId 필수",
  "common.error.request-body-too-large": "요청 내용이 너무 큽니다",
  "common.label.route.source-snapshot-required": "sourceSnapshotId 필수",
  "common.label.route.query-required": "query 필수",
  "common.label.route.seed-paper-required": "출발 논문이 필요합니다",
  "common.label.current-account": "현재 계정",
  "common.label.conversation-navigation-helpers": "오늘",
  "common.label.conversation-navigation-helpers.2": "어제",
  "common.label.conversation-navigation-helpers.3": "이번 주",
  "common.label.conversation-navigation-helpers.4": "이전",
  "common.progress.conversation-document-helpers": "검색 결과를 읽는 중…",
  "common.progress.conversation-document-helpers.2": "논문을 읽는 중…",
  "common.label.conversation-document-helpers": "웹 페이지 열기",
  "common.progress.conversation-document-helpers.3": "웹 페이지를 읽는 중…",
  "common.progress.conversation-document-helpers.4": "검토 내용을 읽는 중…",
  "common.progress.conversation-document-helpers.5": "상황을 파악하는 중…",
  "common.progress.conversation-document-helpers.6": "확인하는 중…",
  "common.label.session-dropdown": "연구 노트 목록 열기",
  "common.label.session-dropdown.2": "새 연구 노트",
  "common.error.sidebar": "로그아웃에 실패했습니다. 다시 시도해주세요.",
  "common.label.sidebar": "새 연구 노트 만들기",
  "common.label.sidebar.2": "사이드바 접기",
  "common.label.sidebar.3": "{title} 삭제",
  "common.label.sidebar.4": "연구 노트 삭제",
  "common.label.sidebar.5": "프로필 열기",
  "common.label.sidebar.6": "로그아웃",
  "common.label.global-chat-input-helpers": "메시지를 입력해",
  "common.progress.global-chat-input-helpers": "작성 중…",
  "common.label.global-chat-input-helpers.2": "제안에 대해 자유롭게 의견을 말해 줘",
  "common.label.two-panel-layout": "채팅창 펼치기",
  "common.label.two-panel-layout.2": "채팅창 접기",
  "common.label.two-panel-layout.3": "대화나 문서 작업을 시작해보세요",
  "common.label.two-panel-layout.4": "새 탭",
  "common.label.two-panel-layout.5": "{title} 닫기",
  "common.label.layout": "검색은 사용자가, 이해는 AI가, 방향은 함께.",
  "common.label.brand.logoAlt": "Moonlight Search",
  "common.label.research-route-search-bar.accountMenu": "계정 메뉴",
  "search.label.research-route-search-bar.libraryList.label": "내 라이브러리",
  "search.label.research-route-search-bar.libraryList.title": "내 라이브러리 목록",
  "search.label.research-route-search-bar.libraryList.preset": "미리 설정됨",
  "search.label.research-route-search-bar.libraryList.folder": "내 라이브러리",
  "search.label.research-route-search-bar.libraryList.empty": "설정된 논문이 없다.",
  "search.label.research-route-search-bar.libraryList.close": "닫기",
  "search.label.research-route-search-bar.libraryList.unfiledFolder": "폴더 없음",
  "search.label.research-route-search-bar.libraryList.loading": "불러오는 중",
  "search.label.research-route-search-bar.libraryList.remove": "해제",
  "search.label.research-route-search-bar.libraryList.removeLabel": "{title} 라이브러리에서 해제",
  "search.label.research-route-search-bar.libraryList.loadFailed":
    "라이브러리 목록을 불러오지 못했다.",
  "search.label.research-route-search-bar.libraryList.removeFailed":
    "라이브러리에서 해제하지 못했다.",
  "search.label.research-route-search-bar.libraryList.unknownPaperTitle":
    "제목을 불러오지 못한 논문",
  "common.label.app-users": "연구 동료",
  "common.label.documents": "대화",
  "common.label.error-logs": "[error-logs] db 없음:",
  "common.label.error-logs.2": "[error-logs] error_logs 테이블이 없어 로그 저장을 건너뜁니다.",
  "common.error.error-logs": "[error-logs] 저장 실패:",
  "common.label.error-logs.dbMissing": "db 없음",
  "common.label.error-logs.tableMissing": "error_logs 테이블이 없어 로그 저장을 건너뜁니다.",
  "common.error.error-logs.saveFailed": "저장 실패",
  "common.error.response-decisions": "[response-decisions] 저장 실패:",
  "common.label.user-action-recorder":
    '[사용자가 직접 {actionLabel}] query: "{query}" — 결과: {resultCount}편',

  // ── document ──
  "document.error.citation-link": "연구 화면을 찾을 수 없음: {docId}",
  "document.label.collection-document": "제목",
  "document.label.collection-document.2": "리서치 관련 메모를 자유롭게 작성하세요...",
  "document.label.paper-list-block": "{authors} 외 {count}명",
  "document.label.paper-list-block.sourceLink": "원문 보기",
  "document.label.paper-list-block.reason": "선정 이유",
  "document.label.paper-list-block.citation": "인용 {count}",
  "document.label.research-route-access": "연구 화면 없음",
  "document.label.research-route-access.2": "검색 ResearchRoutePayload가 필요합니다",
  "document.label.research-route-access.3": "연구자 프로필",
  "document.error.onboarding-access": "[onboarding] 프로필 문서 저장 실패:",
  "document.error.inline-analysis-service":
    "근거가 충분하지 않아 이 논문의 semantic profile을 확정하지 못했다.",
  "document.label.url-import-service": "http/https URL만 가져올 수 있습니다.",
  "document.error.url-import-service": "인증 정보가 포함된 URL은 허용하지 않습니다.",
  "document.error.url-import-service.2": "로컬 또는 내부 네트워크 URL은 가져올 수 없습니다.",
  "document.error.url-import-service.3": "비공개 IP 주소는 가져올 수 없습니다.",
  "document.error.url-import-service.4": "대상 호스트의 주소를 확인할 수 없습니다.",
  "document.error.url-import-service.5": "비공개 네트워크로 연결되는 호스트는 가져올 수 없습니다.",
  "document.error.url-import-service.6": "리다이렉트 위치를 확인할 수 없습니다.",
  "document.label.url-import-service.2": "리다이렉트가 너무 많습니다.",
  "document.error.url-import-service.7": "이 페이지의 본문을 충분히 추출하지 못했다.",
  "document.label.url-import-service.3": "원문: {param}",
  "document.label.url-import-service.4": "## 요약",
  "document.label.url-import-service.5": "## 핵심 내용",
  "document.label.url-import-service.6": "## 메모",
  "document.label.url-import-service.7": "- 원문을 자동으로 정리한 초안이다.",
  "document.label.url-import-service.8": "# 제목",
  "document.label.url-import-service.9": "원문: URL",
  "document.label.url-import-service.10": "(없음)",
  "document.error.url-import-service.8": "가져오기 실패: HTTP {status}",
  "document.label.url-import-service.11": "PDF 문서",
  "document.label.url-import-service.12": "웹 문서",
  // ── gapNetwork ──
  "gapNetwork.progress.gap-network-view-helpers": "논문 정리 중...",
  "gapNetwork.label.gap-network-view-helpers": "입력 논문 표본과 분석 입력 상태를 확인하고 있어요.",
  "gapNetwork.progress.gap-network-view-helpers.2": "네트워크 구축 중...",
  "gapNetwork.label.gap-network-view-helpers.2": "논문 사이 인용·의미 연결을 계산하고 있어요.",
  "gapNetwork.progress.gap-network-view-helpers.3": "군집 분석 중...",
  "gapNetwork.label.gap-network-view-helpers.3": "군집과 개념 후보를 다시 구성하고 있어요.",
  "gapNetwork.progress.gap-network-view-helpers.4": "공백 후보 정리 중...",
  "gapNetwork.label.gap-network-view-helpers.4":
    "기대 대비 실제 연결이 부족한 군집 쌍을 계산하고 있어요.",
  "gapNetwork.progress.gap-network-view-helpers.5": "해석 리포트 정리 중...",
  "gapNetwork.label.gap-network-view-helpers.5":
    "LLM 해석 결과를 같은 공백 리포트 화면에 반영하고 있어요.",
  "gapNetwork.label.gap-network-view-helpers.6":
    "{lensTitle} 그래프와 본문 해석이 반영된 리포트를 열 수 있어요.",
  "gapNetwork.label.gap-network-view-helpers.7": "완료",
  "gapNetwork.error.gap-network-view.3":
    "{displayName} 상태 응답이 올바르지 않습니다. 다시 시도해주세요.",
  "gapNetwork.label.gap-network-view.4":
    "{lensTitle}에 필요한 군집, 공백 후보, LLM 해석을 준비한 뒤 리포트 페이지로 전환합니다.",
  "gapNetwork.label.gap-network-view.contentPendingTitle": "본문 해석 보강 중",
  "gapNetwork.label.gap-network-view.contentPendingBody":
    "그래프는 먼저 확인할 수 있고, 보강이 끝나면 분석된 분야와 클러스터 배경, 공백 추론 본문이 채워집니다.",
  "gapNetwork.label.gap-network-view.contentDegradedTitle": "본문 해석 보강 실패",
  "gapNetwork.label.gap-network-view.contentDegradedBody":
    "그래프와 선택 설명은 유지했지만, 클러스터 배경과 공백 추론 본문은 신뢰 가능한 리포트로 표시하지 않습니다.",
  "gapNetwork.label.gap-network-view.contentRetry": "분석 다시 시도",
  "gapNetwork.label.gap-network-view.contentRetrying": "분석 다시 시도 중",
  "gapNetwork.label.gap-network-view.contentRetryCooldown": "{seconds}초 뒤 다시 시도",
  "gapNetwork.label.gap-network-view.principalAdmissionTitle":
    "다른 리포트의 계산은 시작하지 않았습니다.",
  "gapNetwork.label.gap-network-view.principalAdmissionBody":
    "대신 기존 계산 리포트로 이동했습니다. 진행 상태와 저장된 결과를 확인한 뒤, 계산이 끝나거나 중단되면 원래 검색 결과에서 다시 시도해 주세요.",
  "gapNetwork.error.gap-network-view.principalAdmission":
    "다른 연구 공백 계산이 진행 중입니다. 현재 계산이 끝난 뒤 다시 시도해 주세요.",
  "gapNetwork.error.gap-network-view.contentRetry":
    "분석 재시도를 시작하지 못했습니다. 잠시 뒤 다시 시도해주세요.",
  "gapNetwork.error.gap-network-report-helpers": "군집이 1개여서 공백 분석 불가",
  "gapNetwork.label.gap-network-report-helpers": "연결 데이터 부족",
  "gapNetwork.label.gap-network-report.insufficientEdges.title": "연결 근거 부족",
  "gapNetwork.label.gap-network-report.insufficientEdges.body":
    "검색 결과 {paperCount}편 전체에서 공백 계산에 쓸 관계 근거가 {edgeCount}건입니다. 군집과 갭 후보를 신뢰할 수 없어 시각화와 세부 리포트를 표시하지 않습니다.",
  "gapNetwork.label.gap-network-report.insufficientEdges.abstractCoverage":
    "그중 초록이 있는 논문은 {abstractPaperCount}편뿐이라, 나머지 {paperCount}편 전체를 같은 밀도로 비교했다고 보기 어렵습니다.",
  "gapNetwork.label.gap-network-report.insufficientEdges.next":
    "따라서 이 검색 결과에서는 군집 수나 군집별 논문 수를 확정적인 공백 구조로 해석하지 않습니다.",
  "gapNetwork.label.gap-network-report.noMeaningfulGap.title": "뚜렷한 공백 후보가 없습니다",
  "gapNetwork.label.gap-network-report.noMeaningfulGap.body":
    "검색 결과 {paperCount}편 전체를 군집으로 나누고 관계 근거 {edgeCount}건을 비교했지만, 군집 사이 공백을 주장할 만큼 기대 연결이 충분히 형성되지 않았습니다. 사용자가 결을 잡기 어려운 군집·키워드만 남으므로 시각화와 세부 리포트를 표시하지 않습니다.",
  "gapNetwork.label.gap-network-report.noMeaningfulGap.next":
    "검색어 범위를 좁히거나 결과 편수를 늘리면 다른 공백 단서가 드러날 수 있습니다.",
  "gapNetwork.label.gap-network-report.sourceBreakdown.citationLineage":
    "이 입력은 인용 계보 화면의 선행 연구 {references}편과 후속 연구 {citations}편을 합한 것입니다.",
  "gapNetwork.label.gap-network-report.analysisInput.summary":
    "분석 기반: 검색 결과 {paperCount}편을 {clusterCount}개 군집으로 나눴습니다",
  "gapNetwork.label.gap-network-report.seedAsSearch": "[{seedTerm}] 으로 논문 검색",
  "gapNetwork.label.gap-network-report.selectedConcept.supportingPapersHeading":
    "선택한 단서 [{label}] 뒷받침 논문",
  "gapNetwork.label.gap-network-report-helpers.2":
    "현재 검색 결과에서는 기대보다 부족한 연결이 뚜렷하게 드러나지 않았다.",
  "gapNetwork.label.gap-network-report-helpers.3": "직접 연결 단서 없음",
  "gapNetwork.label.gap-network-report-helpers.4":
    "{displayLabel}은 {leftLabel}과 {rightLabel} 사이에서 관련성은 높지만 연결이 아직 성숙하지 않은 구간이다. 공통 실마리는 {param} 수준에 머물러 있다.",
  "gapNetwork.label.gap-network-report-helpers.5":
    "{displayLabel}에서 {thesis}와 {thesis2}을 직접 연결하는 실험 설계를 먼저 검토하는 편이 가장 실용적이다.",
  "gapNetwork.label.gap-network-report-helpers.6":
    "{displayLabel} 주변의 개념 단서를 함께 읽으며 아직 연결되지 않은 문제 정의를 먼저 정리하는 것이 좋다.",
  "gapNetwork.label.gap-network-report-helpers.7":
    "공백 쌍이 없으면 개별 군집 내부의 대표 단서를 먼저 읽고, 이후 검색어를 더 좁혀 재탐색하는 편이 낫다.",
  "gapNetwork.label.gap-network-builder": "- 전체 논문 수: {count}",
  "gapNetwork.label.gap-network-builder.2": "- 전체 연결 수: {count}",
  "gapNetwork.label.gap-network-builder.3": "- gap 수: {count}",
  "gapNetwork.label.gap-network-builder.4": "- 대표 gap: {topGap}",
  "gapNetwork.label.gap-network-report.clusterBody":
    "{clusterLabel}은 논문 {paperCount}편이 모인 군집이다.",
  "gapNetwork.label.gap-network-report.clusterConcepts": "핵심 개념은 {concepts}다.",
  "gapNetwork.label.gap-network-report.focusedGapMetaFallback":
    "{leftLabel}과 {rightLabel} 사이의 미탐색 교차 영역",
  "gapNetwork.label.gap-network-report.focusedGapFallbackHypothesis":
    "{leftLabel} 결과 {rightLabel} 결을 잇는 연구 작업이 비어 있다.",
  "gapNetwork.label.gap-network-report.focusedGapFallbackGroundingWithBridge":
    '매개 개념 "{bridge}"이 두 군집을 잇는 단서로 식별된다.',
  "gapNetwork.label.gap-network-report.focusedGapFallbackGroundingNoBridge":
    "{leftLabel}과 {rightLabel}의 핵심 개념이 직접 만나는 논문이 부족하다.",
  "gapNetwork.label.gap-network-reaction-preparation.gapBodyFallbackTemplated":
    "{leftLabel}과 {rightLabel} 사이의 미탐색 교차 영역",
  "gapNetwork.label.gap-network-report.focusedSelectionPendingMeta": "해석 보강 중",
  "gapNetwork.label.gap-network-report.focusedSelectionDegradedMeta": "해석 보강 실패",
  "gapNetwork.label.gap-network-report.focusedClusterPendingBody":
    "클러스터 설명은 해석 보강이 끝나면 표시됩니다.",
  "gapNetwork.label.gap-network-report.focusedClusterDegradedBody":
    "이 클러스터의 클릭 설명은 신뢰 가능한 보강 설명으로 표시하지 않습니다.",
  "gapNetwork.label.gap-network-report.focusedGapPendingBody":
    "공백 가설은 해석 보강이 끝나면 표시됩니다.",
  "gapNetwork.label.gap-network-report.focusedGapDegradedBody":
    "이 공백의 클릭 설명은 신뢰 가능한 보강 설명으로 표시하지 않습니다.",
  "gapNetwork.label.gap-network-report.focusedClusterKicker": "선택한 클러스터",
  "gapNetwork.label.gap-network-report.focusedClusterMeta": "논문 {paperCount}편",
  "gapNetwork.label.gap-network-report.focusedClusterRepresentativePapers": "대표 논문",
  "gapNetwork.label.gap-network-report.focusedClusterBodyWithConceptsAndPapers":
    "{body} 핵심 개념은 {concepts}다. 이 조합은 단일 키워드보다, 논문들이 어떤 문제 조건과 방법 흐름을 공유하는지 보라는 신호다. 대표 논문 {papers}부터 확인하면 군집의 실제 문제 설정을 빠르게 잡을 수 있다.",
  "gapNetwork.label.gap-network-report.focusedClusterBodyWithConcepts":
    "{body} 핵심 개념은 {concepts}다. 이 조합은 단어 목록이 아니라, 논문들이 공통으로 다루는 문제 조건과 방법 흐름을 좁혀 보는 독해 단서다.",
  "gapNetwork.label.gap-network-report.focusedClusterBodyWithPapers":
    "{body} 대표 논문 {papers}부터 보면 이 군집이 어떤 데이터, 방법, 평가 맥락으로 실제 연구화됐는지 빠르게 확인할 수 있다.",
  "gapNetwork.label.gap-network-reaction-preparation.overviewTitle": "연구 공백 리포트 요약",
  "gapNetwork.label.gap-network-reaction-preparation.overviewBody":
    "{query}에서 가장 큰 공백은 {topGap}다. 군집 {clusterCount}개와 공백 {gapPairCount}개가 정리됐다.",
  "gapNetwork.label.gap-network-reaction-preparation.overviewBodyEmpty":
    "{query} 연구 공백 리포트를 만들었다. 군집 {clusterCount}개가 정리됐고 뚜렷한 대표 공백은 아직 계산되지 않았다.",
  "gapNetwork.label.gap-network-reaction-preparation.clusterBody":
    "{clusterLabel}은 논문 {paperCount}편이 모인 군집이다.",
  "gapNetwork.label.gap-network-reaction-preparation.clusterConcepts": "핵심 개념은 {concepts}다.",
  "gapNetwork.label.gap-network-reaction-preparation.clusterTitle": "{clusterLabel} 클러스터",
  "gapNetwork.label.gap-network-reaction-preparation.gapTitle": "{leftLabel}-{rightLabel} 가설",

  // ── knowledgeMap ──
  "knowledgeMap.label.knowledge-map-view-shared.2": "현재 검색 결과",
  "knowledgeMap.progress.knowledge-map-view-shared": "다시 생성 중...",
  "knowledgeMap.label.knowledge-map-view-shared.3": "다시 시도",
  "knowledgeMap.label.knowledge-map-view-shared.preparing": "{query} 리포트를 준비하고 있어요.",
  "knowledgeMap.progress.graph-progress.collect": "검색 분석 정리 중...",
  "knowledgeMap.label.graph-progress.collect":
    "search ResearchRoutePayload의 논문 분석 결과와 내부 인용 관계를 정리한다.",
  "knowledgeMap.progress.graph-progress.enrich": "네트워크 구축 중...",
  "knowledgeMap.label.graph-progress.enrich":
    "저장된 semantic profile과 heuristic을 이용해 semantic/method 연결을 보강한다.",
  "knowledgeMap.progress.graph-progress.cluster": "군집 분석 중...",
  "knowledgeMap.label.graph-progress.cluster": "군집을 분리하고 고립 노드를 배치한다.",
  "knowledgeMap.progress.graph-progress.analyze": "메트릭 계산 중...",
  "knowledgeMap.label.graph-progress.analyze": "degree, density, gamma, isolated ratio를 계산한다.",
  "knowledgeMap.progress.graph-progress.interpret": "해설 생성 중...",
  "knowledgeMap.label.graph-progress.interpret":
    "허브와 클러스터 구조를 바탕으로 연구 지형도 해설을 생성한다.",
  "knowledgeMap.progress.graph-progress.completed": "완료",
  "knowledgeMap.label.graph-progress.completed": "연구 지형도 리포트를 열 수 있다.",
  "knowledgeMap.label.knowledge-map-lens": "{displayName} 생성 중",
  "knowledgeMap.error.knowledge-map-lens": "{displayName} 생성 실패",
  // ── narrative ──
  "narrative.error.narrative-trace-document": "내러티브 추적 정보를 불러오지 못했습니다.",
  "narrative.error.narrative-trace-document.2": "내러티브 추적 응답 형식이 올바르지 않습니다.",
  "narrative.label.narrative-trace-document": "stage 없음",
  "narrative.label.narrative-trace-document.2": "trigger 없음",
  "narrative.label.narrative-memory-helpers": "관련 논문을 찾았다: {titles}",
  "narrative.label.narrative-memory-helpers.2": "관련 논문 검색을 진행했다: {param}",
  "narrative.label.narrative-memory-helpers.3": "자료를 확인했다: {title}",
  "narrative.label.narrative-memory-helpers.4": "{paperTitle}의 {section} 섹션을 확인했다.",
  "narrative.label.narrative-memory-helpers.5": "{paperTitle} 본문을 확인했다.",
  "narrative.label.narrative-memory-helpers.6": "{paperTitle}의 {goal} 맥락을 추적했다.",
  "narrative.label.narrative-memory-helpers.7": "{paperTitle}의 배경 맥락을 추적했다.",
  "narrative.label.narrative-memory-helpers.8": "근거를 검증했다: {matches}",
  "narrative.label.narrative-memory-helpers.9": "논문을 비교했다: {items}",
  "narrative.label.narrative-memory-helpers.10": "연구 초점을 {thesis}로 전환했다.",
  "narrative.label.narrative-memory-helpers.11": "작업 가설을 {thesis}로 정교화했다.",
  "narrative.label.narrative-memory-helpers.12": "진행 방향을 {responseThesis}로 확정했다.",
  "narrative.label.narrative-memory-helpers.13": "대화 내러티브",
  "narrative.label.narrative-memory-helpers.14": "현재 초점: {responseThesis}",
  "narrative.label.narrative-memory-helpers.15": "즉시 필요: {immediateNeed}",
  "narrative.label.narrative-memory-helpers.16": "열린 질문: {openQuestions}",
  "narrative.label.narrative-memory-helpers.17": "사용자 요청: {userMessage}",
  "narrative.label.narrative-memory-helpers.18": "최근 응답: {assistantText}",
  "narrative.label.narrative-memory-helpers.19": "대화 흐름을 요약할 정보가 아직 충분하지 않다.",
  "narrative.label.narrative-memory-helpers.20": "주제: {thesis}",
  "narrative.label.narrative-memory-helpers.21": "남은 질문: {list}",
  "narrative.label.narrative-memory-helpers.22": "핵심 포인트: {events}",
  "narrative.label.narrative-memory": "현재 내러티브: {title}",
  "narrative.label.narrative-memory.2": "현재 연구노트의 active narrative",
  "narrative.label.narrative-memory.3": "과거 내러티브: {title}",
  "narrative.label.narrative-memory.4": "과거 narrative 회상 (semantic {score})",
  "narrative.label.narrative-memory.5": "과거 narrative 회상 (lexical {score})",

  "search.error.search-view-helpers.publisherBlocked":
    '[system] "{title}" PDF를 가져올 수 없다 — 출판사 사이트에서 직접 열기: {publisherUrl}',
  "search.error.search-view-helpers.requestFailedWithLink":
    '[system] "{title}" PDF 요청이 실패했다 — 원본 페이지에서 직접 열기: {publisherUrl}',
  "search.error.search-view-helpers.invalidResponseWithLink":
    '[system] "{title}" PDF 응답을 해석할 수 없다 — 원본 페이지에서 직접 열기: {publisherUrl}',
  // ── search ──
  "search.label.search-view-content": "허브 논문과 군집 구조로 전체 연구 지형을 본다.",
  "search.label.search-view-content.2": "연도별 흐름과 급증 연결로 최근 변화 방향을 본다.",
  "search.label.search-view-content.3": "대표 논문과 군집 간 연결을 행렬로 비교한다.",
  "search.label.search-view-content.4": "덜 연결된 주제 조합을 찾아 연구 공백 가설을 본다.",
  "search.label.search-view-content.5": "주장 사이의 지지와 반박 관계로 논쟁 축을 본다.",
  "search.label.search-view-content.6": "Moonlight Search · 현재 {count}편 적재",
  "search.label.search-view-content.7": " · {count}개 조건",
  "search.label.search-view-content.8": "Moonlight Search · 멀티 검색 병합 {count}편{param}",
  "search.label.search-view-content.9": "예: agent memory, retrieval, diffusion",
  "search.label.search-view-content.10": "논문 검색어",
  "search.label.search-view-content.11": "지식맵 선택",
  "search.label.search-view-content.12": "생성 중",
  "search.label.search-view-content.13": "열기",
  "search.label.search-view-content.14": "키워드로 논문 검색…",
  "search.label.search-view-content.15": "정렬 기준",
  "search.label.search-view-content.16": "연도",
  "search.label.search-view-content.heroSubtitle":
    "PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처의 논문 2억 편 이상을 담은 Moonlight 논문 DB에서 찾습니다.",
  "search.label.search-view-content.heroButton": "논문검색",
  "search.label.search-view-content.applyConditions": "조건 적용",
  "search.label.search-view-content.facets.groupLabel": "필터",
  "search.label.search-view-content.facets.fields": "분야",
  "search.label.search-view-content.facets.dateRange": "출판연도",
  "search.label.search-view-content.facets.hasPdf": "PDF 있음",
  "search.label.search-view-content.facets.representative": "대표 논문",
  "search.label.search-view-content.facets.authors": "저자",
  "search.label.search-view-content.facets.venues": "저널·컨퍼런스",
  "search.label.search-view-content.facets.empty": "현재 결과에 표시할 항목이 없습니다.",
  "search.label.search-view-content.resultsKicker": "검색 결과",
  "search.label.search-view-content.sortDefault": "기본순",
  "search.label.search-view-content.sortCitation": "인용순",
  "search.label.search-view-content.sortYear": "최신순",
  "search.label.search-view-content.sortYearAsc": "오래된순",
  "search.label.search-view-content.loadingTitle": "검색 결과를 불러오는 중",
  "search.label.search-view-content.processingKicker": "검색 처리 중",
  "search.label.search-view-content.processingTitle": "검색 결과 처리 중",
  "search.label.followupActivation.pending": "‘{query}’ 검색으로 이동 중",
  "search.label.search-view-content.processingBody":
    '"{query}" 검색을 실행하고 있습니다. 저장된 결과가 있으면 바로 불러오고, 없으면 새 결과를 만든 뒤 이 화면에 표시합니다.',
  "search.label.search-view-content.analyzing": "인라인 분석 진행 중 {analyzed}/{total}",
  "search.label.search-view-content.creatingGapNetwork":
    "왼쪽 패널에서 연구 공백 리포트를 만들고 있어요.",
  "search.label.search-view-content.loadMore": "더보기 ({visible}/{total})",
  "search.label.search-view-content.libraryDiscovery.kicker": "라이브러리 발견",
  "search.label.search-view-content.libraryDiscovery.title": "내 라이브러리와 가까운 논문",
  "search.label.search-view-content.libraryDiscovery.description":
    "검색 결과에는 포함되지 않지만, 내 라이브러리의 인용 관계와 가까워 따로 살펴볼 만한 논문입니다.",
  "search.label.search-view-content.footerAboutTitle": "Scholar란?",
  "search.label.search-view-content.footerAboutBody":
    "Scholar는 PubMed·arXiv·IEEE·Crossref 등 주요 학술 출처를 담은 Moonlight 논문 DB에서 검색하고, 현재 결과를 기준으로 AI 코멘트·인용 관계·비슷한 논문·연구 공백 탐색을 이어 줍니다.",
  "search.label.search-view-content.footerAboutNavLabel": "Scholar 설명 링크",
  "search.label.search-view-content.footerAboutMoreNavLabel": "Scholar 자세히 보기",
  "search.label.search-view-content.footerAboutSearchLink": "검색 설명",
  "search.label.search-view-content.footerAboutGraphLink": "그래프 예시",
  "search.label.search-view-content.footerAboutPromiseLink": "제품 약속",
  "search.label.search-view-content.footerBusinessLine1":
    "주식회사 코르카 / 대표이사 정영현 / 사업자 등록번호 271-86-02206",
  "search.label.search-view-content.footerBusinessLine2":
    "서울특별시 강남구 테헤란로 77길 11-8 6층",
  "search.label.search-view-content.footerBusinessLine3":
    "연락처 02-6925-6978 E-mail: moonlight@corca.ai",
  "search.label.search-view-content.footerCopyright": "© 2026 Corca, Inc. All rights reserved.",
  "search.label.document-renderer.loading": "연구 화면을 불러오는 중",
  "search.label.search-view-content.resultBasis.facets": " · 필터 {count}개",
  "search.error.search-view-content.requestFailed": "검색에 실패했습니다. 다시 시도해주세요",
  "search.label.search-result-item.summary": "요약",
  "search.label.search-result-item.localizedTitle": "한국어 제목",
  "search.label.search-result-item.claim": "주장",
  "search.label.search-result-item.topics": "주제",
  "search.label.search-result-item.method": "방법",
  "search.label.search-result-item.finding": "발견",
  "search.label.search-result-item.topicsUnknown": "근거 부족으로 주제를 확정하지 않음",
  "search.label.search-result-item.evidence": "근거: {value}",
  "search.label.search-result-item.5": "초록 기반 AI 분석",
  "search.label.search-result-item.6": "초록 기반 AI 분석",
  "search.label.search-result-item.7": "논문 정보 접기",
  "search.label.search-result-item.8": "논문 정보 펼치기",
  "search.label.search-result-item.9": "근거 부족으로 확정하지 않음",
  "search.label.search-result-item.checkingPdf": "PDF 확인 중",
  "search.label.search-result-item.preparingDetails": "논문 정보 보강 중",
  "search.label.search-result-item.loadingContent": "저자·초록 보강",
  "search.label.search-result-item.loadingAnalysis": "분석 입력 보강",
  "search.label.search-result-item.analysisPendingDescription":
    "제목과 초록을 바탕으로 핵심 내용을 정리하고 있습니다.",
  "search.label.search-result-item.analysisUnavailableDescription":
    "AI 요약을 표시하지 못했습니다. 논문 정보와 후속 탐색은 계속 사용할 수 있습니다.",
  "search.label.search-result-item.analysisRetryAvailableAt":
    "{time} 이후 직접 다시 시도할 수 있습니다.",
  "search.label.search-result-item.retryAnalysis": "분석 다시 시도",
  "search.label.search-result-item.analysisNotStarted": "분석 준비 전",
  "search.label.search-result-item.analysisNotStartedDescription":
    "초록은 확인되었지만 AI 분석은 아직 시작되지 않았습니다.",
  "search.label.search-result-item.metadataClueWithFields":
    "초록이 없어 분석하지 못했습니다. 제목과 분야 정보로는 {fields} 관련 후보로만 볼 수 있습니다.",
  "search.label.search-result-item.metadataClueWithoutFields":
    "초록이 없어 분석하지 못했습니다. 제목만으로는 방법과 결과를 판단할 수 없습니다.",
  "search.label.search-result-item.authorsUnavailable": "저자 정보 미제공",
  "search.label.search-results-view": "{sourceLabel} ({count}편)",
  "search.label.search-results-view.2":
    "## {title}\n\n검색일: {today} | 출처: Moonlight Search 기반\n\n```papers\n{papersJson}\n```",
  "search.error.search-service": "검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
  "search.label.search-service": "검색 서버 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
  "search.error.search-service.2": "검색 서버 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
  "search.label.search-service.2":
    "검색 서버가 일시적으로 응답하지 않습니다 ({status}). 잠시 후 다시 시도해주세요.",
  "search.error.search-service.3": "검색 결과를 처리하지 못했습니다. 다른 키워드로 시도해보세요.",
  "search.label.search-service.3": "검색: {query}",
  "search.error.connectionFailed": "검색 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
  "search.error.rateLimited": "검색 서버 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
  "search.error.serverError":
    "검색 서버가 일시적으로 응답하지 않습니다 ({status}). 잠시 후 다시 시도해주세요.",
  "search.error.parseFailed": "검색 결과를 처리하지 못했습니다. 다른 키워드로 시도해보세요.",
  "search.error.requestFailed": "검색 요청이 실패했습니다. 잠시 후 다시 시도해주세요.",

  // ── surface ──
  "surface.label.agent-panel.groupBadge.explore": "탐색",
  "surface.label.agent-panel.groupBadge.navigate": "이동",
  "surface.label.agent-panel.groupBadge.recover": "복구",
  "surface.fallbackConsumedPrompt.representativePaper": "대표 논문 보기",
  "surface.label.agent-panel.fallbackTitle": "안내",
  "surface.label.agent-panel.searchOverview.title": "검색 결과 개요",
  "surface.label.agent-panel.searchOverview.yearDistribution.title": "출판연도 분포",
  "surface.label.agent-panel.searchOverview.yearDistribution.summary": "현재 결과 {count}편 기준",
  "surface.label.agent-panel.searchOverview.yearPeak": "최다 {year}년 {count}편",
  "surface.label.agent-panel.searchOverview.yearBucket": "{year}년 {count}편",
  "surface.label.agent-panel.searchOverview.researchTerms.title": "주요 연구 용어",
  "surface.label.agent-panel.searchOverview.researchTerms.sentencePrefix": "주요 연구 용어",
  "surface.label.agent-panel.searchOverview.researchTerms.extracting":
    "현재 결과의 제목·초록에서 방법·기여 표현을 추출하고 있다. 잠시 뒤 이 자리에 용어가 나타난다.",
  "surface.label.agent-panel.searchOverview.researchTerms.degraded":
    "방법·기여 추출이 닫히지 않아 결과 안에서 반복된 표현 기준의 임시 용어다.",
  "surface.label.agent-panel.reactionCard.collapse": "접기",
  "surface.label.agent-panel.reactionCard.expand": "펼치기",
  "surface.label.ai-content-feedback.prompt": "평가",
  "surface.label.ai-content-feedback.helpful": "도움 됨",
  "surface.label.ai-content-feedback.notHelpful": "도움 안 됨",
  "surface.label.ai-content-feedback.savedHelpful": "도움 됨으로 저장됨",
  "surface.label.ai-content-feedback.savedNotHelpful": "도움 안 됨으로 저장됨",
  "surface.label.ai-content-feedback.failed": "평가 저장 실패",
  "search.label.search-results-content-rail.gapMapAction":
    "상위 논문 40개의 관계를 분석하여 연구 공백 찾아보기 >",
  "search.label.search-results-content-rail.relationshipGapMapAction":
    "현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >",
  "search.label.search-results-content-rail.gapMapPending": "관계 분석을 여는 중",
} as const satisfies Record<string, string>;

export type MessageKey = keyof typeof messages;
export default messages;
