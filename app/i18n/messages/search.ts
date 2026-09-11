// Search domain messages — citation lineage & similar paper UI strings.

const searchMessages = {
  "search.label.search-view-content.yearRange.label": "출판연도",
  "search.label.search-view-content.yearRange.from": "출판연도 시작",
  "search.label.search-view-content.yearRange.to": "출판연도 끝",
  "search.label.search-view-content.yearRange.fromPlaceholder": "시작",
  "search.label.search-view-content.yearRange.toPlaceholder": "끝",
  "search.label.search-view-content.yearRange.separator": "~",
  "search.label.search-view-content.yearRange.clear": "초기화",
  "search.label.search-view-content.yearRange.clearLabel": "출판연도 범위 초기화",
  "search.label.search-result-item.citationCount": "인용 {count}",
  "search.label.search-result-item.citationLineage": "인용 관계",
  "search.label.search-result-item.citationLineage.references": "선행 {count}",
  "search.label.search-result-item.citationLineage.referencesLimited": "선행 목록 제한",
  "search.label.search-result-item.citationLineage.referencesLimitedCount": "선행 {count}+",
  "search.label.search-result-item.citationLineage.referencesLimitedTitle":
    "Moonlight 논문 DB에 선행 연구 수가 있지만 목록을 가져올 수 없습니다.",
  "search.label.search-result-item.citationLineage.lineage": "인용 계보",
  "search.label.search-result-item.citationLineage.lineageWithReferences":
    "인용 계보 열기. 선행 연구 {count}편은 계보 문서에서 함께 확인한다.",
  "search.label.search-result-item.citationLineage.citations": "인용 {count}",
  "search.label.search-result-item.citationLineage.disabled": "인용 정보 없음",
  "search.label.search-result-item.findSimilar": "비슷한 논문",
  "search.label.search-result-item.graphNeighbors": "비슷한 논문",
  "search.label.search-result-item.expandAuthors": "외 {count}명 펼치기",
  "search.label.search-result-item.collapseAuthors": "접기",
  "search.label.search-result-item.searchAuthor": "{name} 검색",
  "search.label.search-result-item.searchTopic": "{topic} 검색",
  "search.label.search-result-item.sourceLinks": "원문/식별자",
  "search.label.search-result-item.openSource": "원문 정보 열기",
  "search.label.search-result-item.differentPosition.toggle": "다른 입장 탐색",
  "search.label.search-result-item.differentPosition.title": "이 논문 기준 다른 입장 탐색",
  "search.label.search-result-item.differentPosition.noPosition":
    "제목·초록만으로 입장을 확정하지 않았다.",
  "search.label.search-result-item.differentPosition.axis": "쟁점 축: {axis}",
  "search.label.search-result-item.differentPosition.action": "검색어로 열기",
  "search.label.search-result-item.citationLineage.loading": "불러오는 중…",
  "search.label.search-result-item.doi": "DOI {doi}",
  "search.label.search-result-item.myResearchProximity": "내 연구와 가까움",
  "search.label.search-result-item.fields": "분야",
  "search.label.search-result-item.venueUnavailable": "출처 정보 없음",
  "search.label.search-result-item.fieldsUnavailable": "정보 없음",
  "search.label.search-service.citationLineage": "인용 관계: {title}",
  "search.label.search-service.graphNeighbors": "비슷한 논문: {title}",
  "search.error.search-service.batchFailed":
    "논문 메타데이터를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
  "search.label.search-view-helpers.citationLineageOpened": '[system] "{title}" 인용 계보를 열었다',
  "search.error.search-view-helpers.citationLineageFailed":
    '[system] "{title}" 인용 계보를 열지 못했다',
  "search.label.search-view-helpers.graphNeighborsOpened":
    '[system] "{title}" 비슷한 논문을 열었다',
  "search.error.search-view-helpers.graphNeighborsFailed":
    '[system] "{title}" 비슷한 논문을 열지 못했다',
  "search.label.search-result-item": "라이브러리에서 제거",
  "search.label.search-result-item.2": "PDF 없음",
  "search.label.search-result-item.3": "{title} PDF 열기",
  "search.label.search-result-item.4": "{title} PDF 없음",
  "search.label.search-result-item.reviewed": "라이브러리에 있음",
  "search.label.search-result-item.libraryAdd": "라이브러리에 추가",
  "search.label.search-result-item.libraryRemove": "라이브러리에서 해제",
  "search.label.library-context-source.internalReviewedFolder": "내 라이브러리",
  "search.label.search-result-item.openPdf": "PDF 열기",
  "search.label.search-result-item.opening": "여는 중…",
  "search.label.search-view-helpers": "병합 {count}편",
  "search.label.search-view-helpers.2": "{value}편",
  "search.label.search-view-helpers.3": '[system] "{param}" 검색 완료 — {param2}',
  "search.label.search-view-helpers.analysisCompleted":
    '[system] "{query}" 검색 분석 업데이트 — {count}편 핵심 포인트 반영',
  "search.error.search-view-helpers": '[system] "{param}" 검색 응답을 처리하지 못했다',
  "search.error.search-view-helpers.2":
    '[system] "{param}" 검색이 실패했다 — 잠시 후 다시 시도해보자',
  "search.label.search-view-helpers.4": '[system] "{title}" PDF 열기',
  "search.error.search-view-helpers.3": '[system] "{title}" PDF 응답을 처리하지 못했다',
  "search.error.search-view-helpers.4":
    '[system] "{title}" PDF를 열 수 없다 — 직접 확인이 필요하다',
  "search.label.search-view-helpers.5": '[system] "{title}" 라이브러리에 추가',
  "search.label.search-view-helpers.6": "{authors} 외 {count}명",
  "search.label.search-view-helpers.7": "분석 대기",
  "search.label.search-view-helpers.8": "분석 중",
  "search.label.search-view-helpers.9": "분석 완료",
  "search.error.search-view-helpers.5": "분석 실패",
  "search.label.search-view-content.spellingCorrection":
    '검색어 맞춤법·표기를 확인했다. "{original}" 대신 "{corrected}"로 다시 검색할 수 있다.',
  "search.label.search-view-content.spellingCorrection.action": "교정 검색어로 검색",
  "search.label.search-term-discovery.titleAbstractSource": "제목·초록",
  "search.label.search-term-discovery.titleAbstractGraphSource":
    "제목·초록/방법 단서 + 첫 검색 결과의 라이브러리 그래프 근거",
  "search.label.search-term-discovery.titleGraphSource":
    "제목 + 첫 검색 결과의 라이브러리 그래프 근거",
  "search.label.search-term-discovery.titleSource": "제목",
  "search.label.search-term-discovery.basis": "{source}에서 {count}편이 뒷받침합니다.",
  "search.label.search-term-discovery.basisWithExample":
    "{source}에서 {count}편이 뒷받침합니다. 예: {title}",
  "search.label.search-view-content.resultBasis":
    "Moonlight Search 기반 · 현재 {count}편 적재 · {sort}{library}{year}{facets}",
  "search.label.search-view-content.resultBasis.merged":
    "Moonlight Search 기반 · {clauseCount}개 조건 병합 · 현재 {count}편 적재 · {sort}{library}{year}{facets}",
  "search.label.search-view-content.resultBasis.libraryApplied": " · 내 라이브러리 반영",
  "search.label.search-view-content.resultBasis.libraryNotApplied": " · 내 라이브러리 반영 없음",
  "search.label.search-view-content.resultBasis.year": " · {year}년",
  "search.label.search-view-content.resultBasis.doi": "DOI {doi} 정확 일치 · Moonlight Search 기반",
  "search.label.search-view-content.libraryGroundingUnavailable":
    "내 라이브러리를 이번 결과에 반영하지 못했어요. 검색 결과는 계속 볼 수 있어요.",
  "search.notice.moonlight-library-access-denied":
    "Moonlight Search 라이브러리 접근이 아직 허용되지 않았다. Moonlight admin에서 이 계정을 Scholar allowlist에 추가해야 내 라이브러리 기준 검색을 쓸 수 있다.",
  "search.label.search-view-content.libraryPreview.kicker": "내 라이브러리",
  "search.label.search-view-content.libraryPreview.count": "{selected}/{total}편 선택",
  "search.label.search-view-content.libraryPreview.empty": "선택된 논문 없음",
  "search.label.search-view-content.noResults.title": "검색 결과가 없습니다",
  "search.label.search-view-content.noResults.body":
    "현재 검색 조건과 일치하는 논문을 찾지 못했습니다. 검색어나 필터를 바꾸고 다시 검색해보세요.",
  "search.label.search-view-content.libraryPreview.more": "외 {count}편",
  "search.label.citation-lineage.kicker": "인용 관계",
  "search.label.citation-lineage.seedGuide": "이 논문의 인용 관계를 탐색하고 있다",
  "search.label.citation-lineage.references": "선행 {count}편",
  "search.label.citation-lineage.citations": "인용한 논문 {count}편",
  "search.label.citation-lineage.noReferences": "이 논문의 선행 연구는 아직 등록되어 있지 않다.",
  "search.label.citation-lineage.referencesElided":
    "선행 연구 {count}편이 보고됐지만 목록은 아직 제공되거나 추출되지 않았다. 실제 선행 연구가 없다는 뜻은 아니다.",
  "search.label.citation-lineage.referencesLimited":
    "선행 연구 목록은 아직 제공되거나 추출되지 않았다. 실제 선행 연구가 없다는 뜻은 아니다.",
  "search.label.citation-lineage.openPaperPage": "논문 페이지에서 보기",
  "search.label.citation-lineage.openDoi": "DOI 페이지로 이동",
  "search.label.citation-lineage.noCitations": "이 논문을 인용한 논문이 아직 없다.",
  "search.label.citation-lineage.citationsLimited":
    "후속 인용 목록은 아직 제공되지 않았다. 실제 후속 연구가 없다는 뜻은 아니다.",
  "search.label.graph-neighbors.coCited": "함께 인용되는 논문 {count}편",
  "search.label.graph-neighbors.coupled": "같은 토대를 공유하는 논문 {count}편",
  "search.label.graph-neighbors.coCitedGuide":
    "이 논문과 자주 함께 인용되는 논문이다. 분야가 곁에서 무엇을 함께 읽는지 보여 준다.",
  "search.label.graph-neighbors.coupledGuide":
    "이 논문과 같은 참고문헌 토대를 공유하는 논문이다. 같은 토대 위에 선 연구를 끌어온다.",
  "search.label.graph-neighbors.coCitedSignal": "함께 인용 {count}회",
  "search.label.graph-neighbors.coupledSignal": "참고문헌 {count}개 공유",
  "search.label.graph-neighbors.empty": "이 논문과 비슷한 논문을 찾지 못했다.",
  "search.label.graph-neighbors.kicker": "비슷한 논문",
  "search.label.graph-neighbors.seedGuide":
    "이 논문과 인용·참고문헌 관계로 묶인 논문을 두 축으로 보여 준다.",
  "search.label.graph-neighbors.loading": "불러오는 중…",
  "search.label.graph-neighbors.loadFailed":
    "지금 비슷한 논문을 불러오지 못했다. 잠시 후 다시 시도해보자.",
  "search.label.graph-neighbors.retry": "다시 시도",
  "search.label.graph-neighbors.gapQuery": "비슷한 논문: {title}",
  "search.label.citation-lineage.citationsGapQuery": "인용 관계: {title}",
  "search.label.reserved-search.pending.status": "검색 결과를 불러오는 중",
  "search.label.reserved-search.failed.title": "검색 결과를 불러오지 못했습니다",
  "search.label.reserved-search.failed.body": "잠시 후 다시 시도해 주세요.",
  "search.label.reserved-search.failed.retry": "다시 시도",
  "search.label.conditionUrl.rejected.title": "검색 조건을 실행할 수 없습니다",
  "search.label.conditionUrl.rejected.body":
    "검색 조건을 확인한 뒤 다시 시도해 주세요. 조건이 너무 길다면 일부 조건을 줄여 주세요.",
} as const;

export default searchMessages;
