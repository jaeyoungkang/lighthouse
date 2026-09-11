// Public commitment-page messages.
// 산문은 한 키에 긴 본문을 둔다 — 단락별 분리는 surface 컴포넌트가 한다.

import commitmentRuntimeExplainerMessages from "./commitment-runtime-explainers";

const commitmentMessages = {
  ...commitmentRuntimeExplainerMessages,
  // ── /about (랜딩) ──
  "commitment.about.title": "Moonlight Search — 약속과 의도",
  "commitment.about.lede":
    "Moonlight Search가 논문 검색 결과를 어떻게 그래프로 읽고, 그 그래프를 대표 논문·연구 용어·연구 공백 판단에 어떻게 쓰는지 공개 설명으로 묶어 보여 준다.",
  "commitment.about.nav.label": "Moonlight Search 소개 페이지",
  "commitment.about.nav.overview": "소개",
  "commitment.about.nav.search": "검색 설명",
  "commitment.about.nav.gapNetwork": "연구 공백 설명",
  "commitment.about.nav.graph": "논문 관계 샘플",
  "commitment.about.nav.aiComments": "AI 설명",
  "commitment.about.nav.promises": "연구자 약속",
  "commitment.about.card.promises.title": "연구자에게 약속하는 경험",
  "commitment.about.card.promises.body":
    "검색 결과의 초록 분석, 선행·후속 연구 조회, Moonlight 정독 연결, 연구 공백, route-view AI 반응까지 연구자가 실제로 쓰는 흐름을 기준으로 Moonlight Search의 약속을 읽는다.",
  "commitment.about.card.promises.cta": "연구자 약속 페이지로",
  "commitment.about.card.search.title": "내 라이브러리는 검색에 어떻게 반영되나",
  "commitment.about.card.search.body":
    "내 라이브러리에 저장한 논문을 참고해 원하는 논문을 찾을 가능성을 어떻게 높이는지 설명한다.",
  "commitment.about.card.search.cta": "검색 설명으로",
  "commitment.about.card.gapNetwork.title": "연구 공백 분석은 어떻게 만들어지나",
  "commitment.about.card.gapNetwork.body":
    "검색 결과나 인용 계보의 논문 묶음에서 연구 공백 후보를 어떻게 찾는지 설명한다.",
  "commitment.about.card.gapNetwork.cta": "연구 공백 설명으로",
  "commitment.about.card.graph.title": "AI for Science 결과를 그래프로 읽기",
  "commitment.about.card.graph.body":
    "현재 결과 표본 안의 논문 제목, 키워드, 함께 인용, 공유 참고문헌이 대표 논문·연구 용어·공백 후보에 어떻게 반영되는지 샘플 그래프로 본다.",
  "commitment.about.card.graph.cta": "샘플 그래프로",
  "commitment.about.card.aiComments.title": "연구 화면마다 AI는 무엇을 설명하나",
  "commitment.about.card.aiComments.body":
    "검색 결과, 인용 계보, 비슷한 논문, 연구 공백 화면에서 AI comment가 어떤 근거와 한계를 짚는지 페이지 형태별로 정리한다.",
  "commitment.about.card.aiComments.cta": "AI 설명 방식으로",
  "commitment.about.card.intent.title": "의도 인벤토리 (audit)",
  "commitment.about.card.intent.body":
    "내부 작업자가 약속과 검증 상태를 읽는 audit 인벤토리다. 모든 사용자 Promise와 횡단 Aspect를 Story Chain 정본 그대로 자동 렌더하고, 각 약속의 verdict와 Acceptance Check별 검증 근거를 함께 보여준다.",
  "commitment.about.card.intent.cta": "의도 인벤토리로",

  // ── /about/promises (연구자용 산문) ──
  "commitment.promises.title": "Moonlight Search는 논문 검토 흐름을 끊지 않게 돕는다",
  "commitment.promises.description":
    "낯선 검색 결과를 좁히고, 한 논문의 선행·후속 흐름을 따라가며, 논문 관계 그래프와 연구 공백 화면까지 이어지는 연구 판단 장면을 설명한다.",
  "commitment.promises.identity":
    "당신은 새 연구를 시작하거나 진행 중인 연구의 다음 방향을 잡기 위해 논문을 찾고 읽는 사람이다. 처음 보는 검색 결과 앞에서는 어떤 논문이 질문에 가까운지, 어떤 논문을 더 읽어야 하는지, 어디서 새 질문을 좁혀야 하는지 계속 판단한다. Moonlight Search는 Moonlight 검색 기능으로 통합될 논문 탐색 경험이다. 검색 결과 목록, 인용 계보, 연구 공백 화면을 한 흐름 안에 두고 그 판단에 필요한 근거를 붙인다.",
  "commitment.promises.search.title": "낯선 검색 결과에서 먼저 읽을 후보를 좁힌다",
  "commitment.promises.search.body":
    "검색어가 아직 정확하지 않을 때도 결과 창은 작은 문헌 지도처럼 열린다. 제목은 첫 단서이고, 초록은 그 논문이 실제 질문에 가까운지 확인하는 최소한의 근거다. 키워드 검색과 내 라이브러리 논문 곁의 그래프 이웃 탐색을 동시에 시작하고, 두 결과를 한 번에 합쳐 보여 준다. 라이브러리 근접도 근거가 있는 논문은 `내 연구와 가까움`으로 표시한다. Moonlight Search는 먼저 보이는 결과 10편을 기준으로 세부 영역, 갈라지는 흐름, 다음에 볼 후보를 설명하며 대표 논문 보기와 연구 공백 찾기로 이어 준다.",
  "commitment.promises.inlineAnalysis.title": "논문을 열기 전에 초록으로 읽을 가치부터 판단한다",
  "commitment.promises.inlineAnalysis.body":
    "목록을 훑는 동안 모든 논문을 PDF로 열 수는 없다. 화면에 보이는 논문부터 초록 기반 요약과 주제·방법·결과를 먼저 정리해, 지금 읽을 논문인지 나중에 돌아올 논문인지 가르게 한다. 이 판단은 원문 전체를 대신하지 않고, 읽기 전 우선순위를 잡는 데 쓰인다.",
  "commitment.promises.citation.title": "한 논문이 이어받고 남긴 흐름을 따라간다",
  "commitment.promises.citation.body":
    "괜찮아 보이는 논문을 고르면 다음 질문은 그 논문이 무엇 위에 서 있고 이후 어디로 이어졌는지다. 선행 연구는 문제의식과 방법의 기반을 보여 주고, 후속 연구는 그 기반이 어떻게 확장되거나 비판되었는지 보여 준다. Moonlight Search는 두 방향을 함께 놓아 더 읽을 논문을 인용 수만이 아니라 연구 흐름으로 고르게 한다.",
  "commitment.promises.pdf.title": "더 읽을 논문은 Moonlight 정독으로 넘긴다",
  "commitment.promises.pdf.body":
    "검색 결과나 인용 흐름에서 더 읽을 논문을 고르면 다음 단계는 본문 정독이다. Moonlight Search는 PDF를 내부 view로 다시 만들지 않고 Moonlight 읽기 화면으로 바로 이어 준다. 탐색 맥락은 Moonlight Search에 남고, 긴 본문 읽기는 Moonlight에서 계속한다.",
  "commitment.promises.gap.title": "결과 묶음 사이에서 아직 약한 연결을 살핀다",
  "commitment.promises.gap.body":
    "검색 결과가 여러 갈래로 나뉘면 연구자는 어디에 새 질문이 남아 있는지 보고 싶어진다. Moonlight Search는 결과 논문들을 클러스터로 묶고, 클러스터 사이 연결이 약한 지점을 보여 준다. 인용 관계와 제목·초록의 가까움에 더해 첫 검색 결과에 함께 온 라이브러리 그래프 근거가 있으면 이를 보조 신호로 써서, 근거가 적어도 읽어 볼 만한 공백 후보를 놓치지 않게 한다. 각 묶음에는 연구 작업 설명과 대표 논문이 붙어, 새 연구 질문 후보를 어디서 좁힐지 판단하게 한다.",
  "commitment.promises.research-route.title": "탐색 화면을 오가며 같은 판단 흐름을 유지한다",
  "commitment.promises.research-route.body":
    "검색 결과, 인용 계보, 비슷한 논문, 연구 공백 리포트는 따로 떨어진 화면이 아니라 같은 검토 과정의 다른 장면이다. 각 탐색 화면은 현재 논문 묶음과 그 근거에 집중하고, AI 반응은 해당 화면의 내용 흐름 안에 함께 보인다. 다른 탐색 화면으로 이동해도 방금 본 근거를 이어서 판단할 수 있다.",
  "commitment.promises.footnotes.heading": "각주",
} as const;

export default commitmentMessages;
