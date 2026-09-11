---
id: aspect:paper-card-presentation-consistency
slug: paper-card-presentation-consistency
title: Paper card presentation consistency
appliesTo:
  - promise:search-results-fast-window
  - promise:search-result-library-add
  - promise:citation-lineage
  - promise:graph-neighbor-papers
  - promise:inline-analysis-auto-run
coveringLedger: docs/contracts/story-chain/evidence-ledgers/paper-card-presentation-consistency.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review
CAIR record: `docs/contracts/story-chain/promises/search-results-fast-window.md#contract-architecture-impact-review`
CAIR record: `docs/contracts/story-chain/promises/inline-analysis-auto-run.md#contract-architecture-impact-review`
CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/677#issuecomment-5421013307
Propagation Map: `docs/contracts/story-chain/promises/search-results-fast-window.md#propagation-map`

# Paper card presentation consistency

## Why

검색 결과, 인용 관계, 비슷한 논문에서 반복되는 논문 후보는 같은 종류의 대상이다.
사용자는 surface가 바뀌어도 같은 카드 문법으로 제목을 식별하고, 메타데이터를
훑고·인용 관계·비슷한 논문·인라인 분석의 다른 입장 검색으로 이동해야 한다.

카드 표현이 surface마다 달라지면 사용자는 기능 차이를 데이터 의미 차이로
오해한다. 예를 들어 비슷한 논문 카드에만 인라인 분석이 없거나, 인용 관계 카드만
액션 순서가 다르면 그 surface의 논문이 덜 분석됐거나 다른 종류의 결과처럼
보인다. 따라서 논문 카드의 표현 방식은 기능별 화면 소유가 아니라 shared card
policy가 맡는다.

## Pointcut

반복 논문 후보를 카드로 보여주는 모든 surface. 검색 결과 카드, 인용 관계의
선행/후속 리스트 카드, 비슷한 논문의 함께 인용/같은 토대 리스트 카드가 대상이다.
seed paper, 대표 논문, 문서 출발점 요약처럼 화면 최상위에서 맥락을 설명하는
카드는 반복 논문 리스트 카드가 아니므로 이 Aspect의 직접 대상이 아니다.

## Advice

논문 후보 카드는 같은 정보 계층을 따른다.

- 원문 제목이 가장 강한 첫 줄로 보인다. 출판연도는 제목 옆 배지가 아니라 제목
  아래 metadata 행의 첫 항목으로 보인다. 연도에는 별도 border나 background를
  씌우지 않는다.
- metadata 행은 `연도 → venue → 분야` 순서로 이어 한 서지 묶음을 만든다. `분야`
  라벨과 최대 두 분야는 venue 바로 뒤에 둔다. 연도가 없으면 빈 자리를 만들지 않고
  venue부터 시작한다. venue나 분야가 없으면 같은 순서에서 `출처 정보 없음`,
  `분야 정보 없음`을 낮은 강조도로 표시한다. 저자 행은 metadata 바로 아래에 둔다.
- 제목 행의 선택 정보는 실제 값이나 동작이 있을 때만 나타난다. 결과 marker와
  대표 표시 뒤에 라이브러리 액션을 둔다. 누락된 정보를 위한
  빈 placeholder는 만들지 않는다.
- 저자가 있으면 최대 세 명의 이름을 기본 표시한다. 각 이름은 저자 검색을 시작한다.
  저자가 네 명 이상이면 나머지는 `외 N명 펼치기`로 표시하고, 사용자가 펼치면 같은
  행에 전체 저자를 보여 준다. `접기`를 선택하면 다시 세 명만 표시한다.
- 액션 row는 DOI, PDF, 인용 관계, 비슷한 논문으로 이어지는 shared action grammar를
  유지한다. DOI는 세부 식별자를 노출하지 않는 고정 폭 `DOI` 라벨로 PDF 바로 앞에 둔다.
  DOI가 있으면 링크로 동작하고, 없으면 같은 폭의 비활성 상태를 유지한다. 따라서 PDF와
  인용 정보의 시작 위치는 DOI 값 길이나 유무에 따라 달라지지 않는다. surface가 특정
  액션을 수행할 수 없을 때만 나머지 액션을 생략하거나 비활성화한다.
- 라이브러리 저장 토글이 있는 카드는 제목을 위한 가로 공간을 보존하도록 compact
  북마크 아이콘을 쓴다. 저장 전에는 외곽선과 accent 계열 테두리, 저장 후에는
  채워진 아이콘과 success 계열 배경·테두리로 상태를 구분한다. 화면에서 긴 상태
  문구를 반복하지 않더라도 추가·해제 동작은 접근성 label과 보조 설명에 온전히 남긴다.
- 인라인 분석은 같은 카드 안에서 같은 위치와 상태 표현을 사용한다. 분석이
  없으면 같은 자동 실행/대기/오류/완료 상태 정책을 따른다.
- 접힌 반복 논문 카드는 제목, metadata, 저자, 액션, 1차 분석 단서를 읽을 수
  있는 공통 기준 높이를 사용한다. 가장 짧은 카드를 목표로 삼지 않는다. 화면
  폭에 맞는 기준 높이 안에서 제목은 한 줄, AI 요약은 최대 두 줄 미리보기로
  보이고, 더 긴 내용은 사용자가 카드 inspection을 열었을 때 같은 카드 안에서
  자연 높이로 확장된다. 생성 근거 라벨은 펼친 inspection에서만 보인다.
- 초록이나 분석 결과가 없는 카드도 분석 영역 자체를 없애지 않는다. 같은
  위치에서 근거 부족을 밝히고, 화면에 보이는 제목과 분야로 확인할 수 있는
  제한된 단서만 보여 준다. 초록이 없을 때는 별도의 `메타데이터 단서` 제목을
  반복하지 않고 근거 한계 본문부터 보여 준다. 저자명은 논문 내용의 추론 근거로
  사용하지 않는다.
- venue·분야 또는 저자가 제공되지 않은 자리는 빈 여백으로 두지 않는다. metadata
  행에는 `출처 정보 없음`, `분야 정보 없음`을 표시하고, 저자 행에는
  `저자 정보 미제공`이라는 중립 상태를 표시한다.
- 반복 논문 카드의 링크·버튼이 아닌 넓은 영역은 같은 inspection toggle로 동작한다.
  닫힌 카드를 누르면 열리고 열린 카드를 다시 누르면 닫힌다. 제목은 별도 버튼이나
  외부 링크로 만들지 않는다. DOI·PDF·인용 관계·비슷한 논문·저자 이름과 저자 펼침·
  라이브러리·분석 상세의 명시적 링크와 버튼은 카드 toggle로 전파되지 않고 고유 동작만
  수행한다. 화면에는
  `논문 정보 펼치기` 같은 command 문구를 반복하지 않고 상태 화살표만 보인다.
  화살표는 키보드와 보조 기술을 위한 실제 버튼으로 남아 expanded/collapsed 상태와
  접근성 이름을 제공한다.
- 인라인 분석 안의 후속 액션도 카드 문법의 일부다. `다른 입장 탐색`은 별도
  disclosure나 후보별 frame을 만들지 않는다. 이 논문의 한계·반박 지점 요약과
  최대 3개의 영어 검색 후보를 각각 한 줄 설명과 함께 바로 보여 주고, query
  자체를 누르면 검색 결과 카드와 인용 관계·비슷한
  논문 카드 모두 같은 search-term handler로 query-only 검색 route를 연다. 출발
  논문·입장·쟁점은 목적지 URL이나 검색 상태로 운반하지 않는다.
- AI 생성 인라인 분석의 피드백 affordance는 분석 상세가 펼쳐진 같은 자리에서
  제공한다.

그래프 근접도 chip, 선행/후속 섹션 제목, 비슷한 논문 축 설명처럼 “왜 이 목록에
왔는가”를 설명하는 surface-specific context는 카드 바깥이나 카드 위의 보조
신호로 둘 수 있다. 하지만 그 신호가 카드 내부의 shared hierarchy를 대체하거나
카드 액션/인라인 분석 위치를 바꾸면 안 된다.

출발 논문(seed paper)이나 대표 논문처럼 화면 최상위에서 현재 view의 기준점을
설명하는 카드는 surface별 맥락 표현으로 둘 수 있다. 다만 선행/후속, 함께 인용,
같은 토대처럼 반복 목록에 들어가는 논문 항목은 모두 검색 결과 리스트 카드와 같은
`SearchResultItem` 표현을 써야 한다.

## Verification

검색 결과 카드 계층은 `search-result-window.ledger.yaml`의
`search-results-fast-window-card-triage-metadata` evidence가 닫는다. 인용 관계와
비슷한 논문 리스트 카드는 `paper-card-presentation-consistency.ledger.yaml`와
각 Promise ledger가 검색 결과 카드 fixture와 panel class, title class,
연도·venue·분야 metadata 행, 최대 세 명을 기본 표시하는 저자 행, 인라인 펼침·접기와 개별 저자
검색, 고정 DOI 슬롯과 DOI/PDF action 순서, action row,
카드 전체 toggle, icon-only disclosure,
interactive descendant 격리, inline-analysis 위치와 후속 검색 동작을 직접 비교해
닫는다. 단순 컴포넌트 재사용이나 action text 존재만으로는 이 Aspect를 닫지 않는다.
AI 생성 분석 피드백은 `ai-generated-content-feedback.ledger.yaml`의 shared inline
paper-card analysis row가 닫는다.
