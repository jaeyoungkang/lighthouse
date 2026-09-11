---
id: aspect:progressive-content-spatial-stability
slug: progressive-content-spatial-stability
title: Progressive content spatial stability
appliesTo:
  - promise:route-view-ai-comment-inline-surface
  - promise:inline-analysis-auto-run
  - promise:search-results-fast-window
  - promise:citation-lineage
  - promise:graph-neighbor-papers
coveringLedger: docs/contracts/story-chain/evidence-ledgers/progressive-content-spatial-stability.ledger.yaml
verdict: met
---

CAIR record: https://github.com/jaeyoungkang/lighthouse/issues/553#contract-architecture-impact-review

# Progressive content spatial stability

## Why

사용자가 검색 결과, 인용 관계, 비슷한 논문의 후보를 읽는 동안 상단 AI comment와
논문 카드의 AI 요약은 뒤늦게 도착한다. 이때 자동 생성 결과의 길이만큼 카드가 갑자기
늘어나면 현재 읽던 논문과 문장이 화면에서 밀려나고, 사용자는 새 내용보다 먼저 자신의
읽기 위치를 다시 찾아야 한다.

자동 생성은 내용을 풍부하게 만들 수 있지만 사용자의 시선 위치까지 자동으로 바꾸면
안 된다. 반복 논문 카드는 읽기에 필요한 정보량을 수용하는 공통 접힘 기준을 사용하고,
생성 콘텐츠는 그 카드 안에서 미리 정한 영역을 소유한다. 더 읽기 위한 자연 높이
확장은 사용자가 직접 선택한다.

## Pointcut

이미 보이는 ResearchRoutePayload 안에서 자동으로 대기 상태를 거쳐 내용이 도착하는
상단 AI comment와 반복 논문 카드의 인라인 분석 영역에 적용한다. 검색 결과, 인용
관계의 선행·후속 논문, 비슷한 논문의 두 관계 축이 대상이다.

사용자가 직접 누른 카드 inspection, AI comment 펼치기, 더 보기, 화면 이동은 이
Aspect가 막는 자동 높이 변화가 아니다. AI comment가 예정되지 않은 빈 화면과 생성이
출력 없이 끝난 뒤의 terminal 정책은 각 Promise가 계속 소유한다. 반복 논문 카드는
초록이나 분석 결과가 없더라도 근거 부족 상태를 같은 카드 영역에 남긴다.

## Advice

- 자동 생성이 시작되면 host card 안에 생성 콘텐츠 전용 영역을 둔다. pending과
  settled 상태는 같은 영역 표식과 최소 공간을 사용한다.
- 자동 완료는 그 영역의 내용을 교체하되, 긴 AI 본문은 접힌 상태의 제한된 줄 수를
  넘겨 카드 전체를 자동 확장하지 않는다.
- 반복 논문 카드의 접힌 상태는 공통 기준 높이를 사용한다. 기준 높이는 제목,
  venue·분야 metadata 행, 최대 세 명을 보여 주는 저자 행, 액션, 1차 분석 단서가 답답하지 않게 읽히는 값으로 정하고,
  가장 짧은 카드에 맞추지 않는다.
- 접힌 제목은 분석 결과 유무와 관계없이 한 줄 미리보기로 유지하고, AI 요약은 최대
  두 줄로 제한한다. 실제 렌더 폭에서 제목이 넘치거나 상세 분석이 있으면 카드의
  비조작 영역과 상태 화살표가 같은 inspection을 열고, 사용자가 열면 전체 제목과
  상세 내용을 같은 카드 안에서 자연 높이로 보여 준다. 생성 근거 라벨은 펼친 뒤에만
  표시한다.
- 초록이나 분석 결과가 없으면 분석 영역을 제거하지 않는다. 제목과 분야처럼 현재
  화면에 보이는 metadata만으로 확인할 수 있는 제한된 단서와 판단 한계를 같은
  영역에 보여 준다. 저자명으로 논문 내용이나 품질을 추론하지 않는다.
- venue·분야 또는 저자가 제공되지 않은 자리는 빈 여백처럼 보이지 않게 각 행의
  기준점에 `출처 정보 없음`, `분야 정보 없음`, `저자 정보 미제공`이라는 중립
  상태를 표시한다.
- 전체 내용을 자연 높이로 읽는 전환은 사용자가 명시적으로 disclosure를 열었을 때만
  일어난다. disclosure는 키보드와 보조 기술에서 expanded/collapsed 상태를 읽을 수
  있어야 한다.
- queued, running, error, hydration 같은 상태 문구는 서로 구분한다. 오류 상태도 해당
  논문 카드의 생성 영역을 유지해 다음 카드의 위치를 갑자기 당기지 않는다.
- 전체 논문 카드를 고정 높이로 만들거나, 모든 생성이 끝날 때까지 목록을 숨기지 않는다.
  안정화 범위는 자동 생성 콘텐츠 subregion에 한정한다.
- 높이 변화 애니메이션으로 이동을 장식하지 않는다. 사용자가 연 disclosure만 자연
  높이로 바뀐다.

## Verification

`progressive-content-spatial-stability.ledger.yaml`는 상단 AI comment의 pending/settled
상태와 논문 카드의 hydration/analysis 상태가 같은 생성 영역 계약을 쓰는지 확인한다.
긴 comment와 인라인 분석 요약은 접힌 상태에서 제한되고, 사용자가 disclosure를 열면
제한이 풀리는지 deterministic component test로 닫는다. 검색 결과와 인용·비슷한 논문은
같은 `SearchResultItem` evidence를 사용하고, surface별 hydration evidence가 이 공용
영역을 보존하는지 함께 확인한다.

## Contract Architecture Impact Review

Contract delta: 반복 논문 카드가 공통 접힘 기준 높이와 제한된 metadata 단서를 유지하고, AI 생성 콘텐츠가 도착할 때 현재 읽기 위치를 자동으로 밀지 않는 interaction-timing invariant를 추가한다. 접힌 제목 한 줄과 AI 요약 최대 두 줄, 펼친 뒤에만 보이는 생성 근거 라벨, 카드 전체 비조작 영역의 open/close toggle을 shared card invariant로 둔다. 기존 route AI comment의 자연 높이 기본 동작은 명시적 펼치기 기반의 제한된 미리보기로 교체한다. 공백뿐인 초록은 모든 client·domain-access·shared-cache 경계에서 초록 없음으로 정규화한다.

Verdict: constrain-existing

Affected axes and current owners: Interaction timing; State lifetime and recovery; Observability and audit; Compatibility and retirement; Cross-surface invariant ownership — 상단 AI comment 표현은 `app/components/research/AgentPanel.tsx`와 inline AI comment frame이 소유한다. 반복 논문 카드의 접힘 기준과 hydration·analysis 표현은 `app/components/research-route-renderers/search-result-item.tsx`와 `app/lib/inline-analysis.ts`가 소유한다. 공통 높이의 숫자는 코드 상수와 `docs/design-standards.md`가 소유한다.

Decision: 반복 논문 카드는 화면 폭별 공통 최소 높이와 내부 정보 예산을 사용한다. 접힌 제목은 한 줄, 분석 요약은 최대 두 줄로 두고 생성 근거 라벨은 펼친 상태에서만 표시한다. 각 기존 host 안에 공용 생성 콘텐츠 영역을 두고 hydration, queued, running, error, 근거 부족, settled 상태를 그 영역에서 교체한다. 자동 완료는 접힌 영역을 확장하지 않는다. 카드의 링크·버튼이 아닌 넓은 영역과 icon-only 화살표가 하나의 card-local inspection state를 열고 닫으며, 명시적 링크·버튼은 이 toggle과 분리한다. AI comment disclosure 같은 명시적 사용자 행동만 자연 높이를 연다. 초록이 없는 카드의 단서는 화면에 보이는 제목과 분야로 제한하고, 제공되지 않은 metadata·저자 행은 중립 상태 문구로 채운다.

Cache compatibility: 공백뿐인 초록을 더 이상 분석 입력으로 보내지 않는 eligibility 변경은 shared-cache 계약 변경이다. `INLINE_ANALYSIS_VERSION`을 8로 올려 v7 결과와 섞이지 않게 하고, v7을 명시적 rollback version으로 보존한다. 배포 뒤 정상 초록을 가진 visible card도 v8 결과를 처음 만들 때 한 번 cache miss가 날 수 있으므로 provider 비용과 shared row 증가는 `inline-analysis-shared-cache` 운영 경계가 관측한다. v7을 현재 버전처럼 계속 읽어 공백 초록의 이전 결과를 재사용하는 대안은 새 evidence-limit 계약과 충돌해 거부한다.

Rejected alternative: 가장 짧은 카드에 맞춘 절대 고정 높이는 제목·저자·metadata의 정상적인 길이 차이와 좁은 화면 접근성을 해친다. 반대로 모든 내용을 기본 자연 높이로 두면 자동 생성 완료 때 카드가 다시 크게 이동한다. 제목만 button으로 만들고 tooltip이나 `논문 정보 펼치기` 문구로 설명하는 방식은 클릭 가능한 범위를 좁히고 제목 식별성과 command를 섞으므로 제거한다. 모든 AI 생성이 끝날 때까지 목록을 막는 방식도 Search-first의 빠른 첫 검토 약속을 훼손한다. 별도 layout store나 생성 runtime topology는 이 UI invariant에 필요하지 않다.

Interaction clock and terminal states: route AI comment의 시계는 route-owned generation이 scheduled/pending이 되는 순간, 논문 카드의 시계는 card hydration 또는 inline analysis가 시작되는 순간 열린다. 같은 생성 영역의 pending frame이 첫 visible acknowledgement이고, settled body, error, evidence-limit, not-started가 각각 terminal 표현이다. terminal에 도달해도 생성 영역을 제거하지 않는다.

Observability owner: `docs/analytics/events.yaml`과 canonical event router가 펼치기 관측을 소유한다. `search_result_inspected`는 카드 inspection이 닫힘에서 열림으로 전환될 때 기존 journey, search, paper, rank, surface context로 발행한다. trigger가 제목 button에서 카드 비조작 영역으로 바뀌어도 event identity와 payload shape는 유지한다. `product.ai_comment_card_expand.clicked`는 command handler에서 every-action으로 발행하고 `ownerPrincipalId + documentId + reactionKey`만 stable identity로 사용한다. AI comment 제목, 본문, AI 출력은 payload에서 금지하며 실제 router contract test가 이를 거부한다.

Evidence and structural defense: `app/components/research-route-renderers/search-result-item.tsx`의 공통 카드 기준 class와 생성 영역 marker, 전체 카드 비조작 영역 toggle, `aria-expanded` button, interactive descendant 전파 차단을 component test로 검증한다. `app/lib/inline-analysis.ts`의 공백 초록 fixture와 cache-contract digest가 바뀌면 version 증가를 강제하는 guard가 UI 표현과 cache eligibility의 재분리를 막는다. `aspect:progressive-content-spatial-stability`와 `npm run quality:contract`가 계약 전파를 검증한다.

Human decision required: no

## Concept Shift Architecture Review

Shift: 자동 생성 결과를 기본 자연 높이로 모두 노출하던 표현에서, 공통 접힘 정보
예산과 사용자 주도 disclosure를 사용하는 반복 카드 표현으로 전환한다.

- `remove`: retired `route-view-ai-comment-inline-surface-inline-content-flow`가
  소유하던 기본 자연 높이 presentation과 그 전용 테스트 기대. 저장 데이터, URL,
  API, repository, domain shape, runtime generation 순서, legacy analytics 호환 자원은 없다.
- `remove`: 제목 자체가 disclosure button이고 app-rendered tooltip과 제목 옆 command
  affordance가 펼침을 설명하던 이전 카드 interaction shape. 역사 review는 보존하되
  현재 Promise·Aspect·Evidence row와 테스트에서는 활성 계약으로 사용하지 않는다.
- `preserve`: ResearchRoutePayload 안의 inline rail, 읽기 폭, route/view reaction
  identity, generation pending/terminal 정책, `SearchResultItem`의 surface 공유 구조.
- `preserve`: 접근성 때문에 실제 콘텐츠가 공통 최소 높이를 넘는 경우의 자연 성장.
  공통 기준은 절대 최대 높이나 clipping 계약이 아니다.
- `migrate-read-only`: 해당 없음. 이전 표시 상태는 영속·복원되지 않으므로 읽기 호환
  경로를 만들지 않는다.

구조적 방어는 retired AC를 현재 구조화 review에서 제거하되 원본 dated review를
historical text로 보존하고, 새 AC·Aspect·원장과 실제 overflow/component test가
현재 표현만 검증하도록 하는 것이다.
