---
type: design-method
---

# Light House — 디자인 시스템 컨텍스트와 기준

이 문서는 Light House 디자인 시스템의 프로젝트 정본이다. 방향, 의미 역할,
디자인 축의 관계와 값의 판단 기준을 소유하며 값의 좋음은 사람이 판단한다.

제품 정체성과 코드 상수 사이에는 한 층이 더 있다. 작업자가 직관으로 고른
값이 제품에 어울리는 결정인지 판단하는 층이다. 이 층은 그동안 둘 곳이
없었다. 이 문서가 그 자리다.

이 문서는 사람이 참조하며, 검사는 값이 아니라 구조만 잠근다.

## 디자인 시스템 축과 소유권

| 축 | 이 문서가 판단하는 것 | 실행 owner | 함께 바뀌는 축 |
| --- | --- | --- | --- |
| Typography | 의미 역할, 크기·굵기·행간의 관계, 읽기 밀도 | `app/globals.css`, shared component class | rail 폭, 줄바꿈, 카드 높이, control 높이, spacing |
| Color | 미세한 섬유 결의 warm mineral canvas와 깨끗한 흰 paper의 대비 | `app/globals.css` semantic color token | border, surface, hover·selected·disabled, 오류·성공 상태 |
| Spacing | 관련 정보의 묶음, 반복 리듬, 조작 hit area | shared layout/component class | typography, rail 폭, 카드 높이, responsive stack |
| Measure | 읽기 rail과 시각화 rail의 관계 | shared layout constant | typography, line length, responsive layout |
| Shape | action과 state를 구분하는 border·radius·shadow 문법 | token과 shared component | color, affordance, focus state |
| Motion | 진행·완료·disclosure 전환의 설명 | component state와 duration token | spatial stability, reduced motion, interaction feedback |
| Language | label·상태·action이 맡는 한 가지 역할 | i18n registry와 관련 Aspect | component width, hierarchy, state meaning |

## 의미 역할

디자인 토큰은 컴포넌트 이름보다 의미 역할에 연결한다. 같은 역할은 search,
citation, similar, gap route에서 같은 위계를 사용한다. surface 맥락 때문에 역할이
달라질 때만 다른 표현을 쓴다.

| 역할 | 현재 값 | 사용 예 | 판단 기준 |
| --- | --- | --- | --- |
| Route heading | 24/32, 700 | 검색 조건, 출발 논문, gap report 제목 | 현재 작업의 기준점을 가장 먼저 식별한다. |
| Section heading | 20/28, 600 | 결과 묶음, 인용 방향, 리포트 절 | 다음 정보 덩어리의 경계를 드러낸다. |
| Paper title | 16/24, 600 | 반복 논문 카드 제목 | 목록 스캔의 1차 식별자다. 보조 rail보다 먼저 읽힌다. |
| Reading body | 16/28, 400 | AI 코멘트, 설명, 리포트 문단 | 연속해서 읽을 수 있는 크기와 행간을 유지한다. |
| Control label | 15/22, 600 | 검색, 필터, 정렬, 후속 action | 조작 가능성이 상태 label보다 분명해야 한다. |
| Compact control | 13/20, 600 | 반복 카드의 PDF·인용·비슷한 논문, 저자·주제·다른 입장 검색 | 조작 가능성은 유지하되 반복 목록의 제목과 본문을 압도하지 않는다. |
| Metadata and status | 13/20, 400 | 저자, venue, 분야, 진행·부족 상태 | 본문보다 보조적이지만 읽을 필요가 있는 정보다. |
| Micro label | 12/18, 600 | kicker, 관계 signal, 좁은 badge | 공간 제약이 실제로 있을 때만 사용한다. 핵심 정보를 맡기지 않는다. |

현재 값은 `size/line, weight` 순서이며 `lh-type-*`와 `lh-tone-*`을 분리한다.
Paper 15px, body 14px, metadata 12px였던 이전 scale을 실제로 상향했다. 반복
카드 안의 보조 action은 primary control과 같은 15px를 쓰지 않고 13/20의 compact
control을 사용한다. 같은 13px metadata와는 굵기, action color, hover로 구분한다.
상단 검색 입력은 모든 폭에서 16/28 reading body를 사용한다. 그 밖의 640px 이하
primary `.lh-input`은 control role의 16/24 보정을 쓴다.

## 경계 규칙 — 무엇이 어디로 가는가

UI 관심사 하나를 세 종류로 가른다. 각 종류는 집이 다르다.

| 종류 | 답하는 질문 | 집 | 판정 |
| --- | --- | --- | --- |
| 행동·구조·규칙 | 깨지면 가리킬 수 있나 | Story Chain 계약 | 결정론적 검사 |
| 값 | 지금 고른 숫자인가 | 코드 상수 + 이 문서의 기준 | 사람 (검사는 구조만) |
| 느낌 | 게이트가 볼 수 있나 | 디자인 시스템 파일 + 사람 눈 | Sufficiency Review |

핵심은 한 줄이다. **계약은 값을 잡지 않고, 값이 떠받치는 행동을 잡는다.**
"본문이 overlay가 아니라 inline으로 뜬다"는 행동이라 계약이 잡는다. "본문 폭
1080"은 값이라 코드 상수로 내리고, 좋음은 이 문서의 기준이 잡는다.

<a id="research-surface-contrast"></a>

## 연구 결과 작업면 — 카드와 배경의 대비

반복 논문 카드는 외곽선으로 항목 경계를 드러내므로 작업면과 큰 명도 차이를
동시에 만들 필요가 없다. 배경은 카드보다 조금 어둡되, 흰 카드가 별도 대시보드
위젯처럼 떠 보이지 않을 만큼 가까워야 한다.

- **현재 값.** 카드의 `surface-panel`은 `oklch(1 0 0)`, 연구 route 작업면의
  `surface-research`는 미세한 섬유 결을 포함한 `oklch(0.982 0.006 85)`이다. 일반
  앱 영역의 `surface-app`은 그대로 유지해 연구 결과가 없는 다른 surface까지
  warm paper 질감이 퍼지지 않게 한다.
- **적용 범위.** 검색, 인용 관계, 비슷한 논문을 포함한 research route의 본문과
  공통 renderer가 같은 작업면 토큰을 쓴다. 기본 카드 외곽선은
  `sidebar-border/60`으로 작업면에 부드럽게 섞고, hover의 강한 외곽선과 선택된
  카드의 accent 외곽선은 유지한다.
- **판정.** 카드 경계는 외곽선만으로도 연속 목록에서 식별되어야 하고, 배경은
  카드보다 명확히 어두워야 한다. 다만 배경 자체가 별도 영역으로 먼저 읽힐 정도의
  대비는 피한다. 값의 좋음은 실제 연속 카드 화면에서 사람이 판단한다.

## 사용법 — 디자인 값이 계약에 들어올 때

질문 세 개로 가른다.

1. 깨지면 가리킬 수 있나. 문장으로 적으면 규칙이 되나. → Story Chain 계약.
   상태 전이, inline-not-overlay, 액션 순서, 토큰 무유출, 말투가 여기다.
2. 약속이 아니라 지금 고른 숫자인가. 바꿔도 약속이 깨지는 게 아니라 다시
   맞추는 건가. → 값이다. 코드 상수로 내리고 좋음은 이 문서의 기준에 잇는다.
   계약에는 숫자 대신 그 값이 떠받치는 행동을 적는다.
3. 게이트가 이걸 볼 수 있나. jsdom이 렌더하나, 판정자가 픽셀을 보나. →
   아니면 느낌이다. 디자인 시스템 파일이 정본, 사람 눈이 판정한다. 계약이
   잡는 척하지 않는다.

## Typography — family, scale, density

Family·크기·굵기·행간은 역할과 비교 밀도의 한 묶음이다. `app/layout.tsx`가 Noto
변수를 선언하지만 `app/globals.css`가 Inter 중심 stack으로 다시 선언해 실제
computed style도 Inter다. 이번 scale은 delivery를 유지하며 12–24px를 쓴다.
Family·token이 바뀌면 rail, clamp, card, control과 두 viewport를 다시 확인한다.

## 상단 navigation — 역할 분리

상단 navigation은 브랜드, 현재 검색 조건, primary submit, 라이브러리, 계정 상태를
한 줄에 모은다. 검색어 입력은 16/28 reading body로 현재 조건을 분명히 보여 준다.
검색 submit과 라이브러리는 15/22 primary control을 유지한다. 계정 이메일과 로그아웃은
13/20 compact control로 묶어 검색 동작과 경쟁하지 않으면서도 흐리지 않게 표시한다.
좁은 화면에서 줄이 바뀌어도 이 역할 순서를 유지한다.

<a id="reading-measure"></a>

## 읽기 measure — 본문 폭의 기준

본문 한 줄 길이를 지속 읽기에 편한 범위로 묶는다. 한 줄이 너무 길면 다음
줄의 시작을 놓치고, 너무 좁으면 같은 문단을 자주 끊어 읽는다.

- **유도.** Light House는 search-first 연구 탐색 제품이다
  (`docs/product-identity.md`). 연구자가 검색 결과, 인용 계보, 비슷한 논문,
  연구 공백 리포트를 오가며 근거를 비교할 때 본문 폭이 화면마다 흔들리면
  읽는 힘이 흩어진다. 그래서 연구 route 본문 rail에 최대 폭을 둔다.
- **현재 값.** 읽기 rail은 `1080px`이다. `research-route-layout.shared.ts`의
  `RESEARCH_ROUTE_BODY_RAIL_CLASS`, `RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS`,
  `DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS`가 같은 폭을 쓴다. gap network
  시각화 rail은 본문보다 넓은 `1500px`이다.
- **검사가 잠그는 것.** 값이 아니라 구조다. 읽기 rail이 단일 출처 상수에서
  오는지, 시각화 rail이 읽기 rail보다 충분히 넓은지(1px 우위가 아니라 구조
  floor, 현재 ≥1.2배)를 `research-route-layout.shared.test.ts`가 잠근다.
  `1080`/`1500`이라는 숫자 자체는 잠그지 않는다.
- **revisit trigger.** 본문 글꼴이나 글자 크기가 바뀌면 같은 폭에서 줄
  길이가 달라진다. 타이포 스케일을 바꿀 때는 이 폭을 다시 유도한다.
- **판정.** 이 폭이 좋은지는 검사가 아니라 디자인 리뷰에서 사람이 이 기준에
  비춰 본다.

## disclosure affordance — 펼침 화살표

- **기준.** 무언가를 펼치거나 여는 모든 affordance(논문 카드 inspection, facet
  드롭다운, 계정 메뉴 등)는 같은 chevron 하나를 쓰고, 열리면 `rotate-180`으로
  뒤집힌다. surface마다 다른 화살표(리터럴 `v` 텍스트, 다른 path)를 만들지 않는다.
- **단일 출처.** `app/components/DisclosureChevron.tsx`가 그 chevron의 유일한
  정의다(`viewBox 0 0 20 20`, `path M5 7.5 10 12.5 15 7.5`, strokeWidth 1.8).
  회전은 caller가 className으로 건다 — state 기반 `rotate-180` 또는 `<details>`의
  `group-open:rotate-180`.
- **revisit trigger.** 새 disclosure/드롭다운 affordance를 만들 때 자기 화살표를
  그리지 말고 이 컴포넌트를 쓴다. path·viewBox 자체 값은 게이트가 잠그지 않는다.
- **판정.** 화살표 모양·정렬의 좋음은 검사가 아니라 디자인 리뷰에서 사람이
  판정한다. 중복 정의가 다시 생기면 `dup:check`이 드러낸다.

<a id="paper-card-scan-coordinates"></a>

## 반복 논문 카드 — 고정 스캔 기준점

검색 결과, 인용 관계, 비슷한 논문의 반복 카드는 같은 정보를 같은 위치에서
찾을 수 있어야 한다. 사용자는 모든 문장을 처음부터 읽기보다 연도, venue,
분야가 이어지는 서지 묶음을 기준으로 목록을 먼저 훑고 필요한 카드만 자세히 읽는다.

- **기준.** 연도, venue, 분야처럼 반복해서 찾는 서지 정보는 한 metadata 행에서
  순서대로 이어 둔다.
  제목 행의 선택 정보는 값이 없을 때 공간을 예약하지 않는다. 반면 venue와 분야는
  데이터 유무 자체가 스캔 정보이므로 각 기준점에 명시적인 없음 상태를 표시한다.
- **현재 값.** `search-result-item.shared.tsx`의
  `PAPER_CARD_TITLE_SCAN_ROW_CLASS`가 제목과 우측 보조 rail을 나눈다. 실제로
  존재하는 보조 정보만 `내 연구와 가까움 marker → 대표 표시 → 라이브러리 액션`
  순서로 렌더한다. 연도는 border와 background가 없는 metadata text로 내려간다.
  `PAPER_CARD_METADATA_SCAN_ROW_CLASS`는 `연도 → venue → 분야`를 가운데점으로 이어
  한 서지 묶음으로 보여 준다. `분야` 라벨과 최대 두 분야는 venue 바로 뒤에 둔다.
  저자 행은 그 아래에서 최대
  세 명의 이름을 직접 보여 준다. 나머지는 `외 N명 펼치기`와 `접기`로 같은 행에서
  열고 닫는다. 각 저자 이름은 저자 검색을 시작한다. venue가 없으면 `출처 정보 없음`,
  분야가 없으면 `분야 정보 없음`, 저자가 없으면 `저자 정보 미제공`을 낮은 강조도로
  표시한다. 긴 venue와 분야 값은 한 줄로 줄이고 전체 값은 `title`로 보존한다. 액션 행은 실제 식별자를 노출하지 않는 고정 폭 `DOI` 슬롯을
  PDF 바로 앞에 표시한다. DOI가 있으면 링크로 동작하고, 없으면 같은 폭의 비활성
  상태로 남아 PDF와 인용 정보의 시작 위치를 유지한다. 카드의 읽기 계층은 제목
  `16/24`, metadata와 저자 행 `13/20`, 분석 본문 `16/28`을 사용한다. 버튼은
  `13/20` compact control, 좁은 배지는 `12/18` micro 역할을 사용해 제목과 본문보다
  한 단계 낮은 위계를 유지한다.
- **누락 정보.** 관련성 marker, 대표 표시, 연도, 라이브러리 액션은 값이나 동작이
  없으면 DOM과 레이아웃 공간을 만들지 않는다. venue와 분야는 빈 placeholder가
  아니라 `출처 정보 없음`, `분야 정보 없음`이라는 의미 있는 상태를 metadata 행의
  기준점에 표시해, 데이터 누락과 레이아웃 오류를 사용자가 구분할 수 있게 한다.
- **검사가 잠그는 것.** 숫자나 열 비율의 좋음이 아니라 모든 반복 카드가 같은
  공통 행 class를 쓰는지, 우측 보조 정보가 정해진 순서를 유지하는지, metadata가
  연도를 박스 없이 먼저 두고 venue와 분야를 인접한 순서로 유지하는지, 실제 값과
  없음 상태가 같은 metadata 순서를 유지하는지, 저자 행이 최대 세 명을
  기본 표시하고 펼침·접기 뒤에도 개별 저자 검색을 유지하는지, DOI가 PDF 앞의 같은 폭에서 실제 식별자 없이
  링크/비활성 상태만 바꾸는지를 잠근다.
- **revisit trigger.** 제목 행의 보조 정보가 추가되거나 marker 문구 길이,
  타이포 크기, 카드 rail 폭이 바뀌면 제목 가독성과 고정 좌표를 실제 데스크톱·
  좁은 화면에서 함께 다시 판단한다. 서지 줄의 정보 종류나 저자 기본 노출 수를 바꿀
  때는 metadata 판독성과 저자 식별성을 다시 판단한다.
- **판정.** 연도·venue·분야를 한 묶음에서 빠르게 찾을 수 있는지는 실제
  검색 결과를 여러 카드로 이어 놓고 사람이 판단한다.

<a id="paper-card-collapsed-height"></a>

## 반복 논문 카드 — 접힘 기준 높이

검색 결과, 인용 관계, 비슷한 논문의 반복 카드는 사용자가 위아래 항목을 같은
리듬으로 비교할 수 있어야 한다. 접힌 카드마다 분석 유무에 따라 높이가 크게
달라지면 논문 자체의 중요도 차이처럼 보이고, 생성 완료 때 읽던 위치도 움직인다.

- **유도.** 기준 높이는 가장 짧은 카드가 아니라 접힌 제목 한 줄, metadata 한 행, 저자 한 행,
  기본 액션, 1차 분석 단서 최대 두 줄이 답답하지 않게 들어가는 정보 예산에서
  정한다. 긴 제목·분석과 상세 triage는 사용자가 펼친 뒤 자연 높이로 읽는다.
- **현재 값.** `search-result-generated-content.tsx`의
  `PAPER_CARD_COLLAPSED_MIN_HEIGHT_CLASS`가 좁은 화면 `15rem`, `sm` 이상
  `14rem`의 공통 최소 높이를 소유한다. 생성 콘텐츠 영역은 같은 파일의
  `PAPER_GENERATED_CONTENT_REGION_CLASS`가 `4rem`의 별도 최소 공간을 소유한다.
  2026-07-16 실제 데스크톱 렌더에서 첫 `20rem`/`18rem` 기준은 빈 공간이
  과하고 긴 제목 두 줄이 카드 높이를 다시 바꾸는 것으로 확인되어 폐기했다.
  이어진 실제 렌더에서 `16rem`/`15rem`과 `5rem` 영역도 짧은 한 줄 요약 아래에
  잔여 공간을 몰아 두는 것이 확인되어 한 단계 더 압축했다. venue·분야와 저자를 한
  서지 줄로 합쳤을 때는 데스크톱 기준을 `13rem`으로 줄였지만, 저자 행을 다시 분리하면서
  그 한 행을 수용하도록 공통 최소 높이를 `14rem`으로 복원했다. 좁은 화면은 metadata가
  두 줄로 쌓일 수 있어 `15rem`을 사용한다. 시각적으로 하단 여백이 더 넓어 보이지 않도록 카드 상단
  padding은 `1rem`, 하단은 `0.75rem`으로 두며, 기본 액션 위 간격은 바꾸지 않는다.
  hydration 상태는 제목과 두 보강 단계의 두 행으로 유지한다. 완료된
  인라인 분석은 접힌 상태에서 최대 두 줄 요약을 쓰고, 짧은 한 줄 요약은 그 영역의
  세로 중심에 둔다. source badge는 펼친 뒤에만 보여 접힌 요약 폭을 소비하지 않는다.
- **카드 펼침.** 제목 자체는 버튼이 아니다. 카드의 링크·버튼이 아닌 영역을 누르면
  열리고 다시 누르면 닫힌다. PDF·인용·비슷한 논문·저자·라이브러리와 펼친 상세의
  링크/버튼은 카드 toggle로 전파하지 않는다. 시각 affordance는 `1.75rem × 1.75rem`
  원형 chevron 버튼 하나이며, `논문 정보 펼치기`/`접기` 문구는 화면에 반복하지 않고
  접근성 label에만 둔다.
- **제목 행 보조 액션.** 라이브러리 토글은 `1.75rem × 1.75rem` 정사각형 북마크
  아이콘을 쓴다. 저장 전은 외곽선 북마크와 accent 테두리, 저장 후는 채워진 북마크와
  success 배경·테두리로 구분한다. 긴 상태 문구는 시각적으로 반복하지 않고 접근성
  label/title에 보존한다.
- **카드 action 밀도.** PDF·인용·비슷한 논문과 저자·주제 검색은 13/20 compact
  control을 사용한다. command-board button의 대문자·굵은 하단 테두리를 반복 카드에
  적용하지 않는다. 얇은 경계와 보통 casing으로 논문 제목과 분석 본문보다 한 단계
  낮은 위계를 유지한다.
- **카드 경계.** 반복 카드는 사방 외곽선과 독립 배경을 겹치지 않고 행 사이 divider로
  구분한다. 선택되거나 강조된 카드만 accent 배경과 ring을 사용한다. 제목과 본문의
  타이포 계층이 카드 경계를 대신해 스캔 순서를 만든다.
- **펼친 세부.** `주제`, `방법`, `결과` label은 metadata 역할을 쓰고 실제 설명은
  16/28 reading body와 primary tone으로 보여 준다. 항목마다 생성 근거 구절을 반복하지
  않는다. 원문·DOI, `초록 기반 AI 분석`, metadata와 근거 한계 표면은 유지한다.
- **다른 입장 탐색.** 별도 disclosure나 검색어별 card를 만들지 않는다. 이 논문의
  한계·반박 지점 요약(reading body)과 최대 3개의 영어 검색 후보를 바로 보여 주며,
  query 자체를 compact text action으로 쓰고 그 아래 한 줄 한국어 설명을 secondary
  tone metadata로 붙인다.
- **검사가 잠그는 것.** 숫자 자체가 아니라 검색 결과·인용 관계·비슷한 논문이
  같은 `SearchResultItem`과 공통 class를 쓰는지, 분석 없음·진행·완료가 같은
  생성 영역을 유지하는지, 펼치기 전후가 구분되는지를 잠근다.
- **revisit trigger.** 제목 크기, metadata 행 수, 기본 액션 수, AI 요약
  미리보기 줄 수, 카드 padding이 바뀌거나 실제 카드에서 큰 빈 공간·overflow가
  반복되면 이 값을 다시 유도한다.
- **판정.** 기준 높이의 좋음은 데스크톱과 좁은 화면의 실제 렌더를 함께 놓고
  사람이 판단한다. 테스트는 특정 `rem` 값을 좋은 디자인으로 선언하지 않는다.

## route AI comment — 생성 영역 높이

- **유도.** pending과 settled comment는 같은 생성 영역을 사용하되, 짧은 comment의
  `다시 생성` 아래에 빈 공간이 몰리지 않아야 한다. 세 줄 본문과 한 줄 후속 콘텐츠,
  action이 들어갈 정보 예산을 기준으로 삼고 더 긴 본문은 disclosure가 연다.
- **현재 값.** `inline-ai-comment-treatment.ts`의
  `INLINE_AI_COMMENT_GENERATED_REGION_CLASS`가 `9rem` 최소 높이를 소유한다.
  2026-07-16 실제 렌더에서 이전 `10rem`은 짧은 완료 comment의 action 아래에
  과도한 잔여 공간을 만들었으므로 폐기했다. 세 줄 본문·연구 용어·두 action이
  함께 있을 때도 이 예산 안에 들도록 `펼치기`와 `다시 생성`은 같은 footer 행을 쓴다.
- **검사가 잠그는 것.** pending과 settled가 같은 class와 생성 영역 marker를 쓰고,
  실제 overflow가 있을 때만 disclosure가 나타나는 구조다. `9rem` 자체는 잠그지 않는다.
- **revisit trigger.** 본문 미리보기 줄 수, 연구 용어 행, action grammar, frame
  padding이 바뀌거나 action 아래의 잔여 공간이 반복되면 다시 유도한다.

## 검증 경계

- 이 문서는 사람이 참조하는 기준이다. 자동 검증 대상이 아니다.
- 결정론적 검사는 구조만 잠근다. 단일 출처와 관계 불변식이 그 대상이다. 값의
  좋음은 잠그지 않는다.
- 값의 좋음은 Sufficiency Review와 디자인 리뷰에서 사람이 이 문서의 기준에
  비춰 판정한다.

## 기준 확장

Typography, spacing, color처럼 값으로 굳는 결정을 추가할 때는 기준, 유도,
현재 값, revisit trigger와 판정 주체를 함께 적는다. 위의 시스템 축 표에 이름이
있다는 사실만으로 구체 값이 승인된 것은 아니다.

지금 rail 상수에 폭과 함께 묶여 있는 spacing utility(`pt-2 pb-5`, `pt-1 pb-4
sm:pt-2` 등)는 아직 공통 리듬으로 유도되지 않았다. 게이트는 폭의 단일 출처와
관계만 잠그고 spacing 값의 좋음은 잠그지 않는다. Issue #677에서 typography와
결속된 spacing 리듬을 검토한 뒤, 채택한 값과 예외를 이 문서의 세부 기준 아래로
내린다.
