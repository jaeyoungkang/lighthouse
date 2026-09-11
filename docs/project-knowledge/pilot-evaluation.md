# Project Knowledge v2 Bounded Pilot

Issue [#627](https://github.com/jaeyoungkang/lighthouse/issues/627)의 첫 paired slice를
평가한다. 이 기록은 구조 확장을 승인하는 verdict가 아니다. 다음 관련 작업의 실제
사용 기록이 쌓이기 전에는 10-task recall 판정을 닫지 않는다.

## Envelope

- 기준선: `0a4ee4fae9f4dcdcd66f8eaebbabe11772080179`의 `pk:recall`
- 기준선 실행: 위 commit의 detached 임시 worktree, local episodic memory 제외
- 신규 실행: 같은 base 위 #627 working tree의 record-level recall
- 날짜: 2026-08-13
- clock: `/usr/bin/time -p`의 process elapsed, cold CLI process 1회씩
- 정확도 rubric: 첫 semantic 결과가 사전에 고정한 expected object를 가리키고,
  temporal status와 current authority를 다른 파일을 열지 않고 확인할 수 있으면 pass
- 재구성 비용 proxy: 첫 결과에서 설명 identity와 authority를 얻기까지 필요한 추가
  파일 open/search 횟수. 사람의 독해 wall time으로 과장하지 않는다.

## 고정 질의 비교

| # | 고정 질의 | legacy 첫 결과 | v2 첫 객체 | 상태 | old/new elapsed | 판정 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Research Route gap artifact 왜 이런 모습인가 | `shared-memory.md` 전체 | `product.research-route-lifetime-model` | current | 0.60s / 0.36s | pass |
| 2 | 조건 URL 영속 gap artifact 긴장 기각 대안 | `shared-memory.md` 전체 | `product.condition-owned-research-route` | current | 0.57s / 0.26s | pass |
| 3 | 비슷한 route-state 구조를 예전에 시도 무엇이 달라졌는가 | `README.md` | `product.search-first-runtime-observation` | historical | 0.48s / 0.26s | pass |
| 4 | Concept Shift Architecture Review 왜 존재하는가 | `shared-memory.md` 전체 | `product-making.concept-shift-review` | current | 0.54s / 0.26s | pass |
| 5 | rollout 관행이 막은 false pass | `shared-memory.md` 전체 | `product-making.evidence-governed-rollout` | current | 0.51s / 0.26s | pass |
| 6 | source basis 바꾸면 provider 계약 가정 재검토 | `shared-memory.md` 전체 | `product.source-basis` | current | 0.42s / 0.25s | pass |
| 7 | 현재 rollout에서 무엇을 해야 하는가 | `shared-memory.md` 전체 | `product-making.evidence-governed-rollout` | current | 0.44s / 0.25s | pass; authority 우선 안내 |

legacy 첫 결과의 title은 `Shared Memory` 또는 `Project Knowledge`였고 Q1~Q7 모두
object identity, temporal status, authority를 제공하지 않았다. v2는 7/7에서 고정
expected object를 첫 semantic 결과로 반환했다. elapsed median은 0.51s에서 0.26s로
줄었다. 이 수치는 작은 fixture의 CLI latency이며 장기 규모 성능을 뜻하지 않는다.

legacy는 답을 만들려면 결과 파일을 열고 793줄 안에서 narrative를 다시 찾은 다음
현재 authority를 재구성해야 했다. v2는 첫 출력에서 object id, plane, kind, status,
matched facet, authority와 typed relation을 반환하므로 추가 open/search proxy가
`2+`에서 `0`으로 줄었다. 실제 사람·agent 독해 시간은 다음 관련 작업에서 별도로
기록한다.

## 객체 비용과 drift

- paired slice: 12개 객체, 3개 주제, 두 plane의 concept/model/case를 모두 포함
- authoring + 첫 validation/recall pass: 10:22:23Z~10:44:19Z, 21분 56초
- 단순 평균: 객체당 약 1분 50초. 공통 schema·relation 설계를 포함한 pilot
  평균이며 이후 작성 비용의 대표값으로 간주하지 않는다.
- object content consolidation review: 1 round
- serializer/revision test correction: 1 round
- recall ranking correction: 4 rounds. generic Korean terms, 한영 particle boundary,
  facet weight, temporal intent를 각각 교정했다.
- authority drift: 24개 current authority ref 중 invalid 0개
- grounding drift: 12개 exact commit/path pair 중 invalid 0개

## 관계와 shadow-canon 사례

Q1은 current lifetime model에서 historical runtime case와 product-making concept-shift
case로 이동할 relation을 반환한다. Q6은 source-basis concept에서 provider omission
case와 provider-contract propagation case를 함께 찾는다. Q5는 current rollout
model과 `superseded` deployment-sufficiency model을 구분한다. 따라서 첫 다섯 relation
type은 fixture 장식이 아니라 고정 질의의 다음 읽기 경로에 쓰인다.

shadow canon 사례는 “현재 route는 반드시 특정 구현 shape를 써야 한다”는 문장을
객체 statement로 두지 않고 `authority_refs`와 `non_scope`로 보냈다. shadow process
canon 사례는 “release 전에 이 명령을 실행하라”를 product-making 설명에서 제거하고
현재 command와 verdict를 owning skill·quality gate·dated record에 남겼다. structured
candidate는 여섯 check가 모두 `pass`가 아니면 승인되지 않는 negative test를 가진다.

## 다음 관련 작업 10건

`valid recall`은 작업 중 object가 실제로 다시 호출되어 설명 재유도, historical/current
혼동, 끝난 논의 재개 중 하나를 줄이고 current authority로 올바르게 연결한 경우다.
단순히 `pk:recall`을 실행한 횟수는 세지 않는다.

작업별 표본 판단과 기록은 agent가 소유한다. Agent는 Human에게 적격성이나
`valid recall` 판정을 요청하지 않는다. 다음 authorized workstream이 기존 12개
객체의 `answers`, aliases, authority 또는 relation이 설명하는 제품·제작 배경을
실제로 다시 묻는다면 결과를 보기 전에 적격 표본으로 고정한다. 단순 기계 변경이나
해당 설명을 필요로 하지 않는 작업은 세지 않는다.

적격 작업에서는 정본·git history·issue를 다시 조립하기 전에 실제 질문으로
`pk:recall`을 실행한다. 작업 종료 시 agent가 시간순 다음 pending 행에 질의와 객체,
`yes | no`, 보수적인 절약 시간 또는 `unknown`, drift/misread와 근거를 기록한다.
도움이 없거나 stale/misread가 있던 `no` 표본도 그대로 포함한다. Human은 10건이
쌓인 뒤 실패 신호를 바탕으로 유지·축소·폐기를 선택할 때만 개입한다.

| task | date | query/object | valid recall | saved reconstruction time | drift/misread | note |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-08-29 | issue 722 search quality fixture go no go Service Policy Coverage / structured object 없음 | no | unknown | 기존 12개 객체를 찾지 못함 | #702 episodic 기록은 관련됐지만 bounded pilot 객체 recall이 아니므로 세지 않음 |
| 2 | 2026-09-02 | 품질 evaluator / `product.provider-omission-limitation`, `product-making.deployment-success-sufficiency` | no | unknown | `품질` lexical match로 무관한 두 객체가 먼저 나왔고 실제로 답이 되는 `product-making.evidence-governed-rollout`은 상위에 없었다 | PK 구축 검토 작업. 검색 품질 evidence 줄기가 왜 authority 없이 끝났는지 물었으나 8월 초 객체 집합에 subject가 없었다. 같은 변경에서 `product-making.evidence-capability-authority-separation`과 case 1개를 승격했다 |
| 3 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 4 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 5 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 6 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 7 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 8 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 9 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |
| 10 | pending | pending | pending | pending | pending | 실제 후속 작업에서 기록 |

## 독립 실패 신호

- 10건 중 valid recall이 2회 미만이면 작성 시간이 낮아도 구조 축소 후보이다.
- 객체당 작성 시간이 30분을 넘으면 recall 빈도가 높아도 consolidation 축소 후보이다.
- 명령·현재값·verdict 반려율 30%, plane 분리 실패율 1/3, legacy 대비 고정 질의
  비개선, relation 미사용, authority drift 반복은 각각 독립 중단 신호다.

이번 bounded run에서는 고정 질의 비개선, 30분 초과, relation 미사용, 초기 authority
drift가 관찰되지 않았다. 10-task 활용도와 제출 반려율은 아직 `unknown`이다. 이 둘을
성공으로 간주하거나 graph·ontology 확대 근거로 쓰지 않는다.
