const commitmentRuntimeExplainerMessages = {
  // ── /about/search (검색 메커니즘 설명) ──
  "commitment.searchMechanism.title": "내 라이브러리를 참고해 원하는 논문을 더 잘 찾는다",
  "commitment.searchMechanism.description":
    "Moonlight Search가 내 라이브러리에 저장한 논문을 참고해 원하는 논문을 찾을 가능성을 어떻게 높이는지 설명한다.",
  "commitment.searchMechanism.kicker": "라이브러리 기반 검색",
  "commitment.searchMechanism.lede":
    "검색어만으로는 원하는 논문을 놓칠 수 있다. 같은 연구라도 다른 용어를 쓰거나, 다른 분야 이름 아래에 있거나, 방법론 이름으로만 드러나는 경우가 있기 때문이다. Moonlight Search는 주요 학술 출처를 모은 Moonlight 논문 DB에서 후보를 찾고, 내 라이브러리에 저장한 논문을 함께 참고해 사용자가 찾으려는 방향과 가까운 후보를 더 잘 드러낸다.",
  "commitment.searchMechanism.summary.title":
    "핵심은 검색어를 바꾸는 것이 아니라 단서를 더하는 것이다",
  "commitment.searchMechanism.summary.body":
    "내 라이브러리는 사용자가 이미 저장해 둔 논문 묶음이다. 이 묶음은 사용자가 관심을 둔 분야, 자주 보는 방법, 이어서 읽을 가능성이 높은 연구 흐름을 보여 주는 단서가 된다. Moonlight Search는 이 단서를 검색 결과에 함께 써서, 검색어만으로는 뒤쪽에 밀리거나 빠질 수 있는 논문 후보를 더 발견하기 쉽게 만든다.",
  "commitment.searchMechanism.keywordLimit.title": "검색어만으로는 표현 차이를 모두 잡기 어렵다",
  "commitment.searchMechanism.keywordLimit.body":
    "사용자가 입력한 말과 논문이 쓰는 말이 항상 같지는 않다. 예를 들어 같은 문제를 다루는 논문도 한쪽은 과제 이름으로, 다른 한쪽은 방법 이름이나 데이터셋 이름으로 설명할 수 있다. 그래서 키워드가 맞는 논문만 보면 읽고 싶었던 논문 일부를 놓칠 수 있다.",
  "commitment.searchMechanism.libraryClues.title":
    "내 라이브러리는 사용자가 찾는 방향의 예시가 된다",
  "commitment.searchMechanism.libraryClues.body":
    "이미 저장한 논문에는 사용자가 관심을 둔 주제와 방법이 들어 있다. Moonlight Search는 그 논문들과 가까운 새 후보를 찾는다. 이미 저장한 논문을 다시 보여 주려는 것이 아니라, 그 논문들을 예시로 삼아 비슷한 문제의식이나 이어지는 연구를 찾는 방식이다.",
  "commitment.searchMechanism.expandedResults.title":
    "기본 검색 결과를 유지하면서 놓칠 만한 후보를 보탠다",
  "commitment.searchMechanism.expandedResults.body":
    "검색은 주요 학술 출처를 모은 Moonlight 논문 DB에서 시작한다. 제목, 초록, 저자, 학회·저널, 인용 수, 공개 PDF 여부 같은 논문 정보를 바탕으로 결과 카드를 만든다. 저장한 논문들과 가까운 후보도 자동으로 함께 살펴 한 결과 목록에 더한다.",
  "commitment.searchMechanism.graphSupport.title":
    "키워드 결과와 내 라이브러리 그래프 이웃을 동시에 찾는다",
  "commitment.searchMechanism.graphSupport.body":
    "예를 들어 `AI for science`를 검색하면 한쪽에서는 검색어에 맞는 논문을 찾고, 다른 한쪽에서는 같은 검색어와 내 라이브러리에 저장한 논문을 함께 참고해 그래프로 가까운 새 후보를 찾는다. 두 탐색은 같은 시점에 시작하고 둘 다 준비된 뒤 하나의 첫 결과로 공개된다. 출판연도와 제목 중복 기준을 통과한 후보는 같은 목록에 들어간다. 내 라이브러리와 가까운 근거가 확인된 논문은 `내 연구와 가까움`으로 표시한다. 검색어 관련도와 라이브러리 근접도는 각각 최종 점수의 최대 절반을 차지한다.",
  "commitment.searchMechanism.similarPapers.title":
    "비슷한 논문은 검색어를 다시 짓지 않고 논문 관계로 연다",
  "commitment.searchMechanism.similarPapers.body":
    "검색 결과에서 한 논문이 좋아 보이면, 같은 검색어를 다시 던지는 대신 그 논문 곁에서 자주 함께 읽히는 논문과 같은 참고문헌 토대를 공유하는 논문을 본다. 관계 근거가 있는 논문에서는 이 두 축으로 비슷한 논문 view를 열고, 관계 근거를 만들 수 없을 때만 제목 기반 검색으로 돌아간다. 그래서 사용자는 인용 계보를 거치지 않아도 검색 결과 카드에서 바로 다음 읽기 후보를 넓힐 수 있다.",
  "commitment.searchMechanism.toggle.title": "결과 기준을 따로 고를 필요가 없다",
  "commitment.searchMechanism.toggle.body":
    "Moonlight Search는 검색어 관련도와 내 라이브러리 근접도를 자동으로 함께 반영해 한 결과 목록을 만든다. 결과 header에서는 라이브러리가 실제로 반영됐는지만 알려 주며, 이해하기 어려운 기준 토글이나 탭을 요구하지 않는다.",
  "commitment.searchMechanism.related.graph.label": "논문 사이 연결을 예시로 보기",
  "commitment.searchMechanism.related.graph.body":
    "검색 결과에 나온 논문들이 서로 어떻게 이어져 있는지 실제 제목이 들어간 샘플로 본다.",
  "commitment.searchMechanism.related.gap.label": "연구 공백 분석으로 이어 보기",
  "commitment.searchMechanism.related.gap.body":
    "논문 묶음 사이의 연결이 약할 때 다음 질문 후보를 어떻게 남기는지 본다.",

  // ── Surface-specific graph explainers ──
  "commitment.graphSurface.step.sample": "결과",
  "commitment.graphSurface.step.call": "연결",
  "commitment.graphSurface.step.intersect": "선별",
  "commitment.graphSurface.step.apply": "화면",
  "commitment.graphSurface.search.title": "키워드 검색과 라이브러리 그래프 탐색을 함께 시작한다",
  "commitment.graphSurface.search.body":
    "Moonlight Search는 검색어에 맞는 논문과 같은 검색어를 반영한 내 라이브러리 그래프 이웃을 서로 기다리지 않고 찾기 시작한다. 두 탐색이 준비되면 제목 중복과 출판연도 기준을 적용해 하나의 첫 결과로 합친다. 검색어 관련도와 라이브러리 근접도는 각각 최종 점수의 최대 절반을 차지한다. 라이브러리 근접도 근거가 있는 논문은 `내 연구와 가까움`으로 표시한다. 먼저 키워드 결과를 보여 준 뒤 그래프 후보를 몰래 덧붙이지 않는다.",
  "commitment.graphSurface.search.step.sample":
    "검색어와 내 라이브러리의 저장 논문이 서로 독립적인 입력이 된다.",
  "commitment.graphSurface.search.step.call":
    "키워드 검색과 라이브러리 그래프 이웃 탐색을 같은 시점에 시작한다.",
  "commitment.graphSurface.search.step.intersect":
    "그래프 이웃은 출판연도와 제목 중복 기준을 거쳐 키워드 결과와 합쳐진다. 라이브러리 근접도 근거가 있는 카드는 `내 연구와 가까움`으로 표시한다.",
  "commitment.graphSurface.search.step.apply":
    "두 결과를 한 번에 공개하고, 출처 근거는 대표 논문·연구 용어·연구 공백 판단에도 이어진다.",
  "commitment.graphSurface.representative.title": "대표 논문은 검색어에 맞는지를 먼저 본다",
  "commitment.graphSurface.representative.body":
    "대표 논문 보기는 내 라이브러리와 그래프로 가깝다는 이유만으로 논문을 고르지 않는다. 먼저 검색어를 직접 다루는지, 분야가 맞는지, 비슷한 제목이 반복되지 않는지 본다. 그 조건을 통과한 논문들 중에서 첫 결과의 라이브러리 그래프 근거를 보조 신호로 쓴다.",
  "commitment.graphSurface.representative.step.sample":
    "대표 논문 후보는 현재 검색 결과 안에서만 고른다. 검색어와 분야에 맞는지가 먼저다.",
  "commitment.graphSurface.representative.step.call":
    "후보 논문이 내 라이브러리의 저장 논문들과 그래프로 얼마나 가까운지 본다.",
  "commitment.graphSurface.representative.step.intersect":
    "검색어와 동떨어진 논문은 연결이 많아도 대표 논문으로 올리지 않는다.",
  "commitment.graphSurface.representative.step.apply":
    "비슷하게 맞는 후보가 여러 편이면, 첫 결과의 라이브러리 그래프 근거를 보조 순서에 쓴다.",
  "commitment.graphSurface.terms.title":
    "연구 용어는 구체적인 방법 표현을 먼저 찾고, 연결된 논문이 받쳐 주는지 본다",
  "commitment.graphSurface.terms.body":
    "용어 목록은 단순히 자주 나온 단어를 모으는 곳이 아니다. 제목과 초록에서 연구자가 실제로 검색어로 써 볼 만한 방법·기여 표현을 찾는다. 그리고 그 표현을 뒷받침하는 논문에 첫 결과의 라이브러리 그래프 근거가 있으면 더 믿을 만한 용어로 앞에 둔다.",
  "commitment.graphSurface.terms.step.sample":
    "제목과 초록에서 `retrieval augmented hypothesis generation`처럼 구체적인 연구 표현을 찾는다.",
  "commitment.graphSurface.terms.step.call":
    "그 표현을 말하는 논문에 라이브러리 그래프 이웃 근거가 있는지 확인한다.",
  "commitment.graphSurface.terms.step.intersect":
    "여러 연결된 논문이 같은 표현을 받쳐 주면, 단순 반복어보다 더 좋은 후보로 본다.",
  "commitment.graphSurface.terms.step.apply":
    "`verification`처럼 넓은 말보다, 실제 다음 검색에 쓸 수 있는 구체적인 표현을 앞에 둔다.",
  "commitment.graphSurface.gap.title": "공백 분석은 약하게 이어진 논문 묶음을 놓치지 않게 돕는다",
  "commitment.graphSurface.gap.body":
    "공백 분석은 먼저 비슷한 논문들을 묶고, 묶음 사이에 연결이 얼마나 있는지 본다. 직접 이어진 논문이 적어도 같은 참고문헌을 공유하는 약한 단서가 있으면, 바로 `공백 후보가 없다`고 닫지 않는다. 대신 사용자가 더 확인해 볼 낮은 근거의 질문 후보로 남긴다.",
  "commitment.graphSurface.gap.step.sample":
    "공백 분석은 지금 보고 있던 검색 결과의 논문 묶음에서 시작한다.",
  "commitment.graphSurface.gap.step.call":
    "묶음 안팎의 논문들이 함께 인용되었거나 같은 참고문헌을 쓰는지 확인한다.",
  "commitment.graphSurface.gap.step.intersect":
    "이 연결은 기존 인용 관계나 제목·초록 해석을 대신하지 않고, 약한 보조 근거로만 붙는다.",
  "commitment.graphSurface.gap.step.apply":
    "근거가 조금이라도 있는 묶음 사이는 낮은 근거의 공백 후보로 리포트에 남길 수 있다.",
  "commitment.graphSurface.visual.common.resultPaper": "결과 논문",
  "commitment.graphSurface.visual.common.currentResultPaper": "현재 결과 안의 논문",
  "commitment.graphSurface.visual.common.currentResultSamplePaper": "현재 결과 표본 안 논문",
  "commitment.graphSurface.visual.common.paperConnections": "논문 사이 연결",
  "commitment.graphSurface.visual.common.cocitationRefs": "함께 인용 · 참고문헌",
  "commitment.graphSurface.visual.common.screen": "화면",
  "commitment.graphSurface.visual.common.edge.connectionCheck": "관계 조회",
  "commitment.graphSurface.visual.common.edge.sharedRefs": "같은 참고문헌",
  "commitment.graphSurface.visual.common.edge.cocitation": "함께 인용",
  "commitment.graphSurface.visual.common.representativeCandidate": "대표 후보",
  "commitment.graphSurface.visual.search.legend.results": "검색 결과",
  "commitment.graphSurface.visual.search.legend.connections": "논문 사이 연결",
  "commitment.graphSurface.visual.search.legend.parallelInputs": "동시에 찾는 두 후보군",
  "commitment.graphSurface.visual.search.legend.screenClues": "화면에 쓰는 단서",
  "commitment.graphSurface.visual.search.query.meta": "검색",
  "commitment.graphSurface.visual.search.query.detail": "검색어 + 내 라이브러리 단서",
  "commitment.graphSurface.visual.search.library.meta": "내 라이브러리",
  "commitment.graphSurface.visual.search.library.detail": "내 라이브러리 관심사",
  "commitment.graphSurface.visual.search.graph.detail": "각 후보군이 준비되면 합류",
  "commitment.graphSurface.visual.search.graph.title": "두 탐색의 합류",
  "commitment.graphSurface.visual.search.graph.meta": "동시 실행",
  "commitment.graphSurface.visual.search.graphCandidate.meta": "그래프 이웃 후보",
  "commitment.graphSurface.visual.search.graphCandidate.detail": "내 라이브러리 저장 논문에서 출발",
  "commitment.graphSurface.visual.search.output.title": "하나의 첫 검색 결과",
  "commitment.graphSurface.visual.search.output.detail": "키워드 · 그래프 후보를 함께 표시",
  "commitment.graphSurface.visual.search.edge.candidates": "키워드 검색",
  "commitment.graphSurface.visual.search.edge.interestClue": "라이브러리 anchor",
  "commitment.graphSurface.visual.search.edge.resultPaper": "그래프 탐색",
  "commitment.graphSurface.visual.search.edge.supportScore": "한 번에 병합",
  "commitment.graphSurface.visual.search.edge.currentSample": "동시 시작",
  "commitment.graphSurface.visual.rep.legend.fitCandidates": "검색어에 맞는 후보",
  "commitment.graphSurface.visual.rep.legend.cards": "대표 논문 카드",
  "commitment.graphSurface.visual.rep.p1.detail": "검색어를 직접 다룸",
  "commitment.graphSurface.visual.rep.p2.detail": "분야가 맞는 후보",
  "commitment.graphSurface.visual.rep.connectedCandidate": "연결된 후보",
  "commitment.graphSurface.visual.rep.p5.detail": "같은 참고문헌 3 · 함께 인용 2",
  "commitment.graphSurface.visual.rep.p3.detail": "검색어 적합성 우선",
  "commitment.graphSurface.visual.rep.card.title": "대표 논문 보기",
  "commitment.graphSurface.visual.rep.card.detail": "맞는 후보 중 연결을 참고",
  "commitment.graphSurface.visual.rep.criteria.meta": "선정 기준",
  "commitment.graphSurface.visual.rep.criteria.title": "제목 중복 제거",
  "commitment.graphSurface.visual.rep.criteria.detail": "검색어와 먼 논문은 제외",
  "commitment.graphSurface.visual.rep.edge.fit": "검색어 적합성",
  "commitment.graphSurface.visual.rep.edge.order": "순서 보강",
  "commitment.graphSurface.visual.rep.edge.criteria": "선정 기준",
  "commitment.graphSurface.visual.terms.legend.expression": "구체적인 연구 표현",
  "commitment.graphSurface.visual.terms.legend.supportPapers": "뒷받침 논문",
  "commitment.graphSurface.visual.terms.legend.connectedEvidence": "서로 연결된 근거",
  "commitment.graphSurface.visual.terms.term.meta": "연구 표현",
  "commitment.graphSurface.visual.terms.term.detail": "방법·기여 명사구",
  "commitment.graphSurface.visual.terms.method.meta": "제목·초록 단서",
  "commitment.graphSurface.visual.terms.method.detail": "제목·초록·방법 단서",
  "commitment.graphSurface.visual.terms.support.meta": "뒷받침 논문",
  "commitment.graphSurface.visual.terms.supportA.detail": "같은 표현을 말하는 논문",
  "commitment.graphSurface.visual.terms.supportB.detail": "흐름을 잇는 논문",
  "commitment.graphSurface.visual.terms.priority.meta": "연결 근거",
  "commitment.graphSurface.visual.terms.priority.title": "연결된 논문 3편",
  "commitment.graphSurface.visual.terms.priority.detail": "더 믿을 만한 용어로 표시",
  "commitment.graphSurface.visual.terms.chip.title": "주요 연구 용어",
  "commitment.graphSurface.visual.terms.chip.detail": "넓은 반복어보다 앞에 표시",
  "commitment.graphSurface.visual.terms.edge.supportExpression": "표현을 뒷받침",
  "commitment.graphSurface.visual.terms.edge.methodCue": "방법 단서",
  "commitment.graphSurface.visual.terms.edge.currentConnection": "현재 결과 내부 연결",
  "commitment.graphSurface.visual.terms.edge.basisCopy": "근거 문구",
  "commitment.graphSurface.visual.terms.edge.priority": "우선순위",
  "commitment.graphSurface.visual.gap.legend.clusters": "논문 묶음",
  "commitment.graphSurface.visual.gap.legend.weakConnection": "약한 연결",
  "commitment.graphSurface.visual.gap.legend.gapCandidate": "공백 후보",
  "commitment.graphSurface.visual.gap.left.meta": "논문 묶음 A",
  "commitment.graphSurface.visual.gap.left.detail": "가설 생성 논문 묶음",
  "commitment.graphSurface.visual.gap.rep.detail": "묶음을 대표할 논문",
  "commitment.graphSurface.visual.gap.right.meta": "논문 묶음 B",
  "commitment.graphSurface.visual.gap.right.detail": "검증 자동화 논문 묶음",
  "commitment.graphSurface.visual.gap.candidate.meta": "공백 후보",
  "commitment.graphSurface.visual.gap.candidate.title": "가설 생성 → 실험 검증",
  "commitment.graphSurface.visual.gap.candidate.detail": "낮은 근거량 후보로 유지",
  "commitment.graphSurface.visual.gap.report.meta": "리포트",
  "commitment.graphSurface.visual.gap.report.title": "연구 공백 리포트",
  "commitment.graphSurface.visual.gap.report.detail": "뚜렷한 공백 없음으로 닫지 않음",
  "commitment.graphSurface.visual.gap.edge.weakConnection": "약한 연결",
  "commitment.graphSurface.visual.gap.edge.representative": "대표 후보",
  "commitment.graphSurface.visual.gap.edge.supportingEvidence": "보조 근거",
  "commitment.graphSurface.visual.gap.edge.evidencePaper": "근거 논문",
  "commitment.graphSurface.visual.gap.edge.report": "리포트 반영",

  // ── /about/gap-network (연구 공백 분석 설명) ──
  "commitment.gapNetworkMechanism.title": "검색 결과 묶음 사이에서 연구 공백을 찾는다",
  "commitment.gapNetworkMechanism.description":
    "Moonlight Search가 검색 결과나 인용 계보의 논문 묶음에서 연구 공백 후보를 어떻게 만드는지 설명한다.",
  "commitment.gapNetworkMechanism.kicker": "연구 공백 분석",
  "commitment.gapNetworkMechanism.lede":
    "검색 결과가 많아지면 좋은 논문을 고르는 것만으로는 부족하다. 서로 비슷한 논문들이 어떤 묶음으로 갈라지는지, 묶음 사이에 아직 약하게 이어진 지점이 있는지 봐야 다음 연구 질문을 좁힐 수 있다. Moonlight Search의 연구 공백 분석은 검색 결과나 인용 계보에서 모은 논문들을 묶고, 그 사이의 약한 연결을 새 질문 후보로 보여 준다.",
  "commitment.gapNetworkMechanism.summary.title":
    "핵심은 정답을 단정하는 것이 아니라 질문 후보를 좁히는 것이다",
  "commitment.gapNetworkMechanism.summary.body":
    "연구 공백 리포트는 분야에 정말 비어 있는 자리를 확정하지 않는다. 대신 지금 화면에서 보고 있던 논문 묶음을 기준으로, 어떤 연구 흐름들이 서로 가까운지와 어디가 덜 이어져 보이는지를 정리한다. 사용자는 그 결과를 다음 검색어, 추가로 읽을 대표 논문, 더 확인할 가설을 고르는 출발점으로 쓴다.",
  "commitment.gapNetworkMechanism.input.title": "지금 보고 있는 논문 묶음을 입력으로 쓴다",
  "commitment.gapNetworkMechanism.input.body":
    "검색 결과에서 연구 공백 찾기를 누르면 검색어와 라이브러리 근거가 자동으로 반영된 현재 정렬·필터 결과 중 앞쪽 논문들이 분석에 들어간다. 인용 계보에서 시작할 때는 그 논문이 인용한 선행 연구와 그 논문을 인용한 후속 연구를 함께 본다.",
  "commitment.gapNetworkMechanism.cluster.title": "논문을 비슷한 흐름끼리 묶는다",
  "commitment.gapNetworkMechanism.cluster.body":
    "Moonlight Search는 제목과 초록, 인용 관계, 논문 사이의 가까움을 바탕으로 결과 논문들을 여러 묶음으로 나눈다. 각 묶음에는 어떤 문제의식이나 방법이 모여 있는지 설명이 붙고, 사용자가 바로 확인할 수 있도록 대표 논문이 함께 보인다.",
  "commitment.gapNetworkMechanism.gap.title": "묶음 사이의 약한 연결을 공백 후보로 보여 준다",
  "commitment.gapNetworkMechanism.gap.body":
    "두 묶음이 비슷한 분야를 다루는데도 서로 직접 이어지는 논문이 적으면, 그 사이가 더 살펴볼 만한 공백 후보가 된다. 리포트는 그 후보를 새 연구 질문처럼 읽을 수 있게 설명하고, 어떤 논문들이 그 판단의 근거가 되었는지 함께 보여 준다.",
  "commitment.gapNetworkMechanism.graphEvidence.title":
    "논문 사이의 약한 연결은 질문 후보를 남기는 데 도움이 된다",
  "commitment.gapNetworkMechanism.graphEvidence.body":
    "예를 들어 한 묶음은 과학 가설을 만드는 AI 연구이고, 다른 묶음은 그 가설을 실험으로 검증하는 자동화 연구일 수 있다. 두 묶음이 서로 직접 많이 인용하지 않았더라도 같은 참고문헌을 공유하거나 다른 논문들에 함께 인용되었다면, 완전히 끊어진 흐름은 아닐 수 있다. Moonlight Search는 이런 약한 연결을 정답처럼 말하지 않는다. 다만 표본이 듬성듬성할 때도 바로 `뚜렷한 공백 후보가 없습니다`로 닫지 않고, 사용자가 더 확인할 질문 후보로 남긴다.",
  "commitment.gapNetworkMechanism.progress.title": "분석이 준비되는 동안 같은 화면에서 기다린다",
  "commitment.gapNetworkMechanism.progress.body":
    "연구 공백 리포트는 결과 논문들의 초록 분석과 묶음 계산을 거쳐 만들어진다. 준비가 덜 된 상태에서는 빈 화면으로 두지 않고 진행 중인 route result를 먼저 렌더한다. 분석이 끝나면 같은 탭에서 완성된 리포트로 바뀐다.",
  "commitment.gapNetworkMechanism.related.graph.label": "논문 사이 관계를 먼저 이해하기",
  "commitment.gapNetworkMechanism.related.graph.body":
    "함께 인용되는 논문과 같은 토대를 공유하는 논문이 어떤 관계인지 구체적인 예시로 설명한다.",
  "commitment.gapNetworkMechanism.related.search.label": "검색 결과에서 그래프 근거가 붙는 방식",
  "commitment.gapNetworkMechanism.related.search.body":
    "검색이 먼저 결과 표본을 만들고, 그 안에서 그래프 신호가 대표 논문과 연구 용어 근거를 보강하는 흐름을 본다.",

  // ── /about/ai-comments (화면별 AI comment 설명) ──
  "commitment.aiComments.title": "연구 화면마다 AI가 설명하는 것이 다르다",
  "commitment.aiComments.description":
    "Moonlight Search의 AI comment가 검색 결과, 인용 계보, 비슷한 논문, 연구 공백 화면에서 각각 어떤 근거와 한계를 설명하는지 정리한다.",
  "commitment.aiComments.kicker": "화면별 AI 설명",
  "commitment.aiComments.lede":
    "Moonlight Search의 AI comment는 모든 페이지에 같은 요약을 붙이지 않는다. 현재 열린 연구 화면이 어떤 판단을 요구하는지에 맞춰, 결과 집합의 지형, 한 논문의 인용 흐름, 그래프 이웃의 관계, 연구 공백 리포트의 근거를 다르게 설명한다.",
  "commitment.aiComments.summary.title": "핵심은 현재 연구 화면의 다음 판단을 짧게 돕는 것이다",
  "commitment.aiComments.summary.body":
    "AI comment는 새 논문을 임의로 추천하거나 화면 밖 내용을 대신 읽었다고 말하지 않는다. 검색 결과나 ResearchRoutePayload metadata, 인용 관계, 현재 결과 안의 그래프 근거처럼 화면이 이미 들고 있는 재료를 기준으로 사용자가 다음에 무엇을 확인할지 정리한다.",
  "commitment.aiComments.search.title": "검색 결과 화면에서는 결과 지형을 설명한다",
  "commitment.aiComments.search.body":
    "검색이 끝나면 AI comment는 검색어를 반복하지 않고, 현재 결과 안에 어떤 세부 영역과 갈라지는 흐름이 있는지 짚는다. 대표 논문과 연구 공백 진입은 연구 화면 본문 UI가 맡고, comment는 결과 목록을 처음 읽을 때 필요한 방향 감각을 준다.",
  "commitment.aiComments.citation.title": "인용 계보 화면에서는 선행과 후속 흐름을 설명한다",
  "commitment.aiComments.citation.body":
    "한 논문의 인용 계보를 열면 AI comment는 그 논문이 어떤 선행 연구 위에 서 있고, 이후 연구가 무엇을 확장하거나 비판했는지 짧게 설명한다. 단순히 인용 수를 세는 것이 아니라, 현재 화면이 모은 선행·후속 논문 범위 안에서 연구 흐름을 읽게 한다.",
  "commitment.aiComments.similar.title": "비슷한 논문 화면에서는 그래프 이웃의 관계를 설명한다",
  "commitment.aiComments.similar.body":
    "비슷한 논문 문서에서는 출발 논문 곁에서 함께 인용되는 논문과 같은 참고문헌 토대를 공유하는 논문을 본다. AI comment는 두 축이 어떤 연구 결을 보여 주는지 설명하고, 관계 근거가 확인된 후보 안에서 다음 읽기 방향을 잡게 한다.",
  "commitment.aiComments.gap.title": "연구 공백 화면에서는 리포트 본문이 설명을 흡수한다",
  "commitment.aiComments.gap.body":
    "연구 공백 화면은 별도 상단 AI comment를 반복하지 않는다. 그래프와 본문 리포트가 분야 흐름, 클러스터 차이, 약한 연결, 공백 추론 방법을 직접 보여 주며, 클러스터를 고를 때도 준비된 설명이 같은 화면 안에서 바뀐다.",
  "commitment.aiComments.inline.title": "논문 카드 안에서는 읽기 전 판단을 돕는다",
  "commitment.aiComments.inline.body":
    "검색 결과 카드의 인라인 분석은 원문 전체를 대신하지 않는다. 화면에 보이는 논문의 초록과 metadata를 바탕으로 주제, 방법, 결과를 짧게 정리해 지금 열어 볼 논문인지, 나중에 돌아올 논문인지 가르는 데 쓴다.",

  // ── /about/graph/sample (ai for science 학술 관계 예시) ──
  "commitment.graphSample.title": "AI for Science 논문 관계 예시를 읽는다",
  "commitment.graphSample.description":
    "함께 인용과 같은 참고문헌 관계를 어떻게 읽는지 보여 주는 고정 예시다. 일반 검색의 후보 수집 과정은 검색 설명 페이지가 따로 다룬다.",
  "commitment.graphSample.kicker": "학술 그래프 읽기 예시",
  "commitment.graphSample.lede":
    "아래 그래프는 `ai for science` 분야 논문 6편을 놓고 함께 인용과 같은 참고문헌 관계를 읽는 방법을 보여 주는 고정 예시다. 일반 검색 결과를 만드는 과정을 재현한 그림은 아니다. 일반 검색에서는 키워드 검색과 내 라이브러리 논문 곁의 그래프 이웃 탐색을 함께 시작하고, 둘 다 준비된 뒤 한 결과로 공개한다.",
  "commitment.graphSample.figure.title": "함께 인용과 참고문헌 관계를 읽는 고정 예시",
  "commitment.graphSample.figure.description":
    "AI scientist 논문 묶음, robotic lab 논문 묶음, retrieval/benchmark 다리 논문 사이의 함께 인용과 같은 참고문헌 관계를 그린 예시다.",
  "commitment.graphSample.figure.caption":
    "굵은 선은 이 예시 안에서 관계 근거가 강한 논문 쌍이고, 흐린 선은 두 묶음을 희미하게 잇는 약한 근거다. 이 관계도는 학술 그래프를 읽는 법을 설명하며 일반 검색의 결과 후보나 순서를 약속하지 않는다.",
  "commitment.graphSample.metric.papers": "예시 논문",
  "commitment.graphSample.metric.relations": "논문 연결",
  "commitment.graphSample.node.connection": "연결",
  "commitment.graphSample.relation.coCitation": "함께 인용",
  "commitment.graphSample.relation.sharedRefs": "같은 참고문헌",
  "commitment.graphSample.relation.refsShort": "참고문헌",
  "commitment.graphSample.paper.citations": "인용",
  "commitment.graphSample.paper.connectionScore": "연결 점수",
  "commitment.graphSample.paperTable.title": "표본 논문",
  "commitment.graphSample.edgeTable.title": "논문 쌍 사이에 확인된 연결 근거",
  "commitment.graphSample.edgeTable.pair": "논문 쌍",
  "commitment.graphSample.edgeTable.relation": "관계",
  "commitment.graphSample.edgeTable.basis": "근거",
  "commitment.graphSample.edgeTable.role": "쓰임",
  "commitment.graphSample.edgeTable.role.strong": "대표/용어 근거 강화",
  "commitment.graphSample.edgeTable.role.weak": "공백 후보를 남기는 약한 연결",
  "commitment.graphSample.output.representative.label": "대표 논문",
  "commitment.graphSample.output.representative.title":
    "검색어에 맞는 후보 안에서 더 잘 이어진 논문을 앞에 둔다",
  "commitment.graphSample.output.representative.body":
    "P1과 P5는 hypothesis generation 흐름에서 서로 이어지고, P3는 laboratory automation 흐름을 대표한다. 연결이 많다는 이유만으로 대표 논문이 되는 것은 아니다. 먼저 검색어와 분야에 맞는 논문을 고르고, 그 안에서 더 잘 이어진 논문을 앞에 둔다.",
  "commitment.graphSample.output.terms.label": "연구 용어",
  "commitment.graphSample.output.terms.title":
    "용어는 구체적인 연구 표현을 찾고, 연결된 논문이 받쳐 주는지 본다",
  "commitment.graphSample.output.connectedEvidence": "연결된 근거",
  "commitment.graphSample.output.paperCountSuffix": "편",
  "commitment.graphSample.output.gap.label": "연구 공백",
  "commitment.graphSample.output.gap.title": "약하게 이어진 두 묶음은 질문 후보로 남길 수 있다",
  "commitment.graphSample.output.gap.body":
    "AI scientist 묶음과 robotic lab 묶음은 각 묶음 안에서는 잘 이어져 있지만, 두 묶음 사이는 아직 약하게 이어져 있다. 그래서 `AI scientist가 만든 가설을 closed-loop robotic lab 검증으로 잇는 연구`처럼 사용자가 더 확인해 볼 질문 후보를 리포트에 남길 수 있다.",
  "commitment.graphSample.mechanism.title": "검색했을 때 실제로 일어나는 순서",
  "commitment.graphSample.mechanism.step1":
    "검색 결과가 먼저 만들어지고, 그중 관계를 확인할 수 있는 논문만 고른다.",
  "commitment.graphSample.mechanism.step2":
    "그 논문들이 함께 인용되었는지, 같은 참고문헌을 쓰는지 확인한다.",
  "commitment.graphSample.mechanism.step3":
    "확인된 연결 중 현재 검색 결과 안에 있는 논문끼리의 연결만 남긴다. 결과 밖 이웃은 화면에 추가하지 않는다.",
  "commitment.graphSample.mechanism.step4":
    "남은 연결 근거가 대표 논문 순서, 연구 용어 근거, 공백 분석의 약한 연결 판단에 쓰인다.",
  "commitment.graphSample.related.graph.label": "검색 설명으로 돌아가기",

  "commitment.mechanism.relatedLinks.title": "함께 읽기",
} as const;

export default commitmentRuntimeExplainerMessages;
