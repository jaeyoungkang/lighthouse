# Analytics Event Contracts

Light House 이벤트 계약은 Story Chain 아래에 있는 관측 계약이다. 제품 약속의
의미는 `docs/contracts/story-chain/`에 있고, 이 디렉터리는 그 약속이 실제
사용과 운영 과정에서 어떻게 관측되는지 선언한다.

`events.yaml`은 canonical event 목록과 재사용하는 semantic property schema를
담는다. 각 event는 Story Chain ref, trigger timing, payload policy, external sink
이름을 함께 가진다.
앱과 CLI는 vendor SDK를 직접 의미 계층으로 쓰지 않고 canonical event name과
runtime payload만 발행한다. 서버 router가 `events.yaml`을 기준으로 event를
검증하고 내부 store와 외부 sink를 분리한다.

`events.yaml`은 `yaml` package로 읽고, TypeScript validator가 event shape과 Story
Chain refs를 검증한다.

## Taxonomy

Light House event는 세 가지 의미를 섞지 않는다.

- Experience Journey는 사용자가 검색하고 결과를 보고 다음 논문 행동으로 이어 간
  흐름을 관측한다.
- Product Outcome은 저장 성공이나 실제 handoff처럼 제품 상태가 확정된 결과를
  관측한다.
- System Delivery Trace는 provider 호출, 전송 실패, latency처럼 시스템 전달 상태를
  관측한다. 이를 사용자 outcome으로 세지 않는다.

새 event는 canonical name과 Amplitude `event_type`에 같은 소문자
`snake_case` 이름을 쓴다. 형식은 `<object>_<past_tense_action>`이다. 예를 들면
`search_submitted`, `search_results_viewed`, `paper_saved`이다. `pdf_opened`처럼
약어도 소문자로 쓴다. 이름에 `product.` prefix를 붙이지 않는다.

Analytics subject와 property key, enum taxonomy token도 소문자 `snake_case`로 선언하고 전송한다.
예를 들면 `search_context_id`, `result_rank`, `has_pdf`이다. TypeScript 함수 인자와
도메인 객체 및 URL parameter는 저장소 코드 규칙에 따라 `camelCase`나 kebab-case를 쓸 수 있다. emitter가
analytics payload를 만들 때 계약 이름으로 변환한다.

이 규칙은 특정 분석 도구의 표기법을 그대로 복사한 것이 아니다. Amplitude는
일관된 capitalization과 actor/action 구문을 권고하고, Segment는 object-action
구조를 권고한다. Snowplow는 event와 property schema에 일관된 action tense와
`snake_case`를 권고한다. Light House는 여러 sink와 내부 계약이 같은 이름을
보도록 소문자 `snake_case` 하나로 좁혔다.
[Amplitude data planning playbook](https://amplitude.com/docs/data/data-planning-playbook),
[Twilio Segment data modeling guide](https://www.twilio.com/en-us/blog/insights/data/data-modeling),
[Snowplow tracking design best practice](https://docs.snowplow.io/docs/fundamentals/tracking-design-best-practice/)

기존 `product.*` event는 아직 전환 범위에 들지 않은 호환 계약으로 남을 수 있다.
신규 event에 이 예외를 적용하지 않는다. 검색 여정에서 교체된 writer는 새 event와
이중 발행하지 않는다. 주 소유 Promise는 `storyRefs.promiseRef`, 같은 행동을 공유하는
다른 현재 Promise는 `storyRefs.relatedPromiseRefs`에 두고, 분석 맥락 차이는 property로
표현한다.

## 검색 여정 context

앱 안에서 검색 실행이 수락되면 opaque `search_context_id`를 만든다.
첫 검색은 같은 값을 journey root로 사용한다. 재검색은 `journey_context_id`를
유지하고 직전 검색을 `parent_search_context_id`로 연결한다. 같은 탭의 인용 관계와
비슷한 논문 branch는 출발 `journey_context_id`와 `search_context_id`를 이어받는다. 직접
URL을 열거나 새 탭에서 복원한 화면은 destination 문서 identity로 로컬 fallback
context를 만들며, in-app 제출로 가장하지 않는다.

`search_submitted`는 transition owner에서 한 번 발행한다. `search_results_viewed`는
destination의 첫 usable result window에서 같은 search context로 한 번 발행한다.
`paper_saved`와 `paper_unsaved`는 mutation 성공 뒤에만 발행한다.

## Property schema와 privacy

활성 검색 여정 property는 `propertySchemas`에 먼저 선언한다. 각 schema는 설명,
type, 예시, 민감도, context group, lifetime, source owner를 가진다. 값이 제한될 때는
enum이나 숫자 범위도 선언한다. Router는 실제 payload를 이 schema와 대조한다.

검색 여정 event에는 raw query와 query hash를 싣지 않는다. 제출 event는
`query_length`만 사용할 수 있다. PDF URL, PDF 원문, AI 응답 전문, 인증 token도
수집하지 않는다. 논문 행동은 `paper_id`로 연결하고, 이미 안정된 identity가 있는
곳에 고카디널리티 논문 제목을 중복 수집하지 않는다. 원문 수집이나 새 외부 export
client가 필요하면 별도 Human 승인과 privacy 계약을 먼저 연다.

전환 전 `product.*` 호환 event 일부의 `queryHash`, `correctedQueryHash`, `termHash`는
`fnv1a32:` 형식의 unkeyed 32-bit FNV-1a 값이다. 이 값은 같은 event 안에서 반복
행동을 대략 그룹화하는 compatibility key일 뿐이다. 충돌할 수 있고 자주 쓰는 문구는
사전 대입으로 추정할 수 있으므로 익명화, 사용자 identity, 민감정보 보호 경계로
간주하지 않는다. 검색 여정 funnel이나 서로 다른 event를 join하는 key로도 쓰지
않는다. 해당 event는 raw query·term을 계속 금지하고, 활성 검색 여정은 이 hash를
수집하지 않는다. 현재 알고리즘과 property 이름은 historical dashboard 호환을 위해
유지한다. 알고리즘을 바꾸면 기존 row를 재해석하지 않고 새 event version 또는 새
property로 cutover와 비교 기간을 선언한다.

## 운영 규칙

새 event를 추가하거나 기존 event를 개편할 때는 다음 순서로 닫는다.

1. 관측하려는 사용자 행동이나 제품 outcome을 먼저 정하고 `measurement`와 Story
   Chain ref를 선언한다.
2. canonical name을 `<object>_<past_tense_action>`으로 정한다. 저장소와 Amplitude
   taxonomy에서 같은 의미의 기존 이름을 확인한다.
3. subject, property, enum taxonomy token을 소문자 `snake_case`로 선언한다. 각 property의 측정 목적,
   type, 민감도, 수명과 source owner를 `propertySchemas`에 기록한다.
4. `sinks.amplitude`에는 canonical name과 같은 값을 쓴다. emitter와 emission
   cardinality를 한 곳에 지정한다.
5. 실제 제품 경계에서 payload를 만들고 targeted test를 추가한다. 테스트는 이름,
   발행 시점, 중복 방지, property allowlist와 privacy를 함께 확인한다.
6. `npm run mc:validate-events`와 관련 Story Chain gate를 실행한다. 배포 환경을 열 수
   있을 때는 Amplitude 수신 여부를 별도 collection evidence로 확인한다.

- Story Chain ref가 깨진 event contract는 `npm run mc:validate-events`에서
  실패한다.
- 활성 product event의 canonical name이 소문자 `snake_case`가 아니거나
  `sinks.amplitude`와 다르면 `npm run mc:validate-events`에서 실패한다. 공유
  property schema 이름이 `snake_case`가 아닐 때도 실패한다.
- 활성 product event의 `emission.emitter`는 export된 production 함수 하나로
  연결되어야 한다. 이 함수가 선언한 canonical event를 직접 발행하고 실제 호출부를
  가져야 한다. 다른 production 경로가 emitter를 우회해 같은 event를 직접 발행하면
  `npm run mc:validate-events`에서 실패한다.
- 사용자-facing Promise 또는 `// @promise` surface가 바뀌면
  `npm run mc:event-impact`가 변경된 Promise와 canonical event coverage를
  출력한다. 변경된 Promise에 연결 event가 없고 같은 변경에서
  `docs/analytics/events.yaml`도 갱신되지 않았으면 실패한다.
- `npm run mc:event-impact -- --sync`는 변경된 Promise 중 event coverage가 없는
  항목에 `AUTO-DRAFT` canonical event를 추가하고, 삭제된 Promise를 가리키는
  event를 제거하며, 기존 event의 Experience/Moment parent ref와 사라진
  Acceptance Check ref를 현재 Story Chain 기준으로 갱신한다.
- `docs/analytics/event-coverage.generated.md`는 `npm run mc:event-impact -- --update`
  로 갱신한다. 이 파일은 Story Chain Promise별 canonical event coverage를
  재계산한 inventory이며 수동 편집하지 않는다.
- `npm run quality:fast`는 `mc:validate-events`와 `mc:event-impact`를 포함한다.
- 이벤트 관측은 reality signal 후보일 뿐 Promise verdict를 자동 변경하지 않는다.
- 외부 sink는 Amplitude 같은 분석 UI로 보내는 사본이다. 정본 저장소가
  아니다.
- Runtime payload property는 `required` 또는 `optional`에 선언된 key만 받을 수
  있다. 활성 검색 여정 property는 공유 schema의 type, enum, 범위도 통과해야 한다.
- Governance event는 내부 store에 먼저 쌓고, 별도 승인 전에는 외부 sink로
  보내지 않는다.

## 현재 범위

현재 event set은 작은 canonical layer로 둔다.

- Search journey — 검색 실행, 결과 노출, 카드 inspection, PDF handoff, 인용 관계,
  비슷한 논문, 라이브러리 저장·해제.
- 기존 event set — 아직 검색 여정 전환 범위에 들지 않은 AI comment, gap report,
  governance 계약.

2026-08-06 legacy reachability review에서는 production 호출부가 없는
`product.inline_analysis.queued`, `product.gap_report_margin.clicked`,
`product.gap_report_prepared_reaction.clicked`를 retire했다. 자동 queue를 사용자 행동으로
집계하지 않으며, 현재 inline-analysis 관측은 `search_result_inspected`, gap surface 관측은
각각 `product.gap_view_margin.viewed`와
`product.gap_view_prepared_reaction.viewed`가 소유한다. 과거 local·Amplitude row는
historical read-only이고 새 event와 합산하거나 새 이름으로 재해석하지 않는다.

Admin event catalog는 `/admin/analytics`에서 확인한다. 이 화면은
`docs/analytics/events.yaml`로 선언된 canonical event 계약을 읽고, 각 event의
trigger timing, Story Chain refs, subject/properties allowlist, privacy,
Amplitude sink policy를 보여 준다. 런타임 발생 로그와 vendor delivery log의
정본은 아니다.

## Follow-up

- `.local/analytics-events.jsonl`은 MVP용 local 개발 관측 store다. serverless
  runtime에서는 배포 번들 경로가 쓰기 가능하다고 가정하지 않고 OS temp directory
  아래의 `lighthouse/analytics-events.jsonl`을 쓴다.
  `LOCAL_ANALYTICS_EVENT_STORE_PATH`가 있으면 이 경로를 우선한다. 장시간 dev
  server에서 파일이 커지면 rotation 또는 최근 N건 read window를 도입한다.
- 새 local JSONL row는 canonical event 필드를 그대로 유지하면서
  `localProvenance`에 record schema version, environment, build revision, 실행 출처를
  기록한다. Environment는 `VERCEL_ENV` 또는 `NODE_ENV`의
  `production | preview | development | test`만 허용하고 그 밖은 `unknown`이다.
  Revision은 `VERCEL_GIT_COMMIT_SHA`, `GIT_COMMIT_SHA`, `COMMIT_SHA` 중 첫 값이
  영문·숫자·점·밑줄·하이픈으로 된 128자 이하 식별자일 때만 사용하고 그 밖은 `null`이다. 실행
  출처는 `runtime | manual | test`이고, 테스트 환경은 기본 `test`, 그 밖은 기본
  `runtime`이다. 수동 실행은 `LOCAL_ANALYTICS_EVENT_RUN_SOURCE=manual`로 명시한다.
  임의 환경 변수와 credential은 record에 복사하지 않는다.
- `localProvenance`가 없는 기존 row는 legacy record다. Environment, revision, 실행
  출처를 사후 추정하거나 기존 파일을 제자리 rewrite하지 않고 `unknown`으로 취급한다.
  운영·수동 관측 집계에서는 `runSource: test`와 legacy/unknown row를 제외할 수 있어야
  한다. 이 파일은 개발 진단용이며 Amplitude 운영 수신이나 제품 사용량의 정본이 아니다.
