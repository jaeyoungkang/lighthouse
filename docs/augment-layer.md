# Augment Layer — 연구 활동을 증강하는 배경 층

**진입점**: 본 문서는 mirror-mind
`projects/ai-agent-product-design/subject-world-augment-verdict.md` 보편 원리의
라이트하우스 implementation이다.

Light House는 연구자가 논문을 찾고, 읽고, 비교하고, 연구 질문을 좁히는 일을
돕는다. 제품은 그 일을 대신하지 않는다. 검색 결과를 구조화하고, 논문 사이
지형을 요약하고, gap network와 citation lineage를 보여 주어 연구자가 자기
연구 활동을 더 잘 이어 가게 한다.

Story Chain은 이 제품 활동 안의 약속을 검증한다. Augment Layer는 그 약속이 왜
연구자에게 필요한지 설명하는 배경 층이다. 사용자가 어떤 연구 상황에 있는지,
Light House 바깥에서 어떤 문헌·도구·사람과 함께 움직이는지, 그 배경에서
Experience와 Promise가 왜 타당한지를 드러낸다.

`activity-A`와 `activity-B`는 이 관계를 설명할 때만 쓰는 보조어다.
사용자의 연구 활동은 `activity-A`이고, Light House가 제공하는 제품 활동은
`activity-B`다. 정본 문서의 주된 언어는 연구자, 논문 탐색, Experience,
Moment, Promise, Evidence Ledger다.

## Story Chain과의 관계

Augment Layer는 Story Chain을 대체하지 않는다. Story Chain은 제품이 실제로
지키는 약속을 닫는다. Augment Layer는 그 약속이 어떤 연구자와 어떤 외부 연구
세계에서 의미를 갖는지 설명한다.

```text
Story Chain
Experience -> Moment -> Promise -> Acceptance Check / Intent Check
                                   -> Evidence Ledger
                                   -> release verdict

Augment reading lens
Experience prose includes Subject / World / Expectations.
```

분리 원칙은 다음과 같다.

1. Promise, Aspect, Evidence Ledger의 기존 의미는 바꾸지 않는다.
2. Subject와 World는 별도 계층을 만들기보다 Experience prose 안에서 설명한다.
3. 사용자 기대는 Promise의 의미를 자동으로 만들지 않는다. Human이 승인한
   Promise만 Story Chain 정본이 된다.
4. Augment Layer는 도입 단계에서 release를 막지 않는다.

## 구조

Augment Layer의 1차 형태는 새 디렉토리나 새 노드가 아니다. 기존 Experience
본문을 읽고 쓰는 규칙이다. Experience는 이미 누가 어떤 상황에서 Light House를
쓰는지, 제품이 무엇을 돕는지, 어디까지가 경계인지 설명한다. Augment Layer는
그 본문이 사용자의 연구 배경과 기대를 충분히 품도록 만든다.

후속 작업에서 같은 연구자 유형, 같은 외부 연구 환경, 같은 사용자 기대가 여러
Experience에서 반복되면 별도 문서로 올릴 수 있다. 이 도입 단계에서는 Subject,
World, Expectation을 schema로 강제하지 않는다.

Story Chain validator는 이 구조를 다루지 않는다. Experience 본문이 Subject,
World, Expectation을 설명하더라도 Promise의 의미, Acceptance Check,
Intent Check, release verdict 조건을 닫지 않는다. 그 설명은 Experience가 어떤
연구 배경 위에 서 있는지 밝히기 위한 것이다.

## Experience Context

Augment Layer의 1차 용도는 Experience의 배경을 선명하게 하는 것이다. 별도
`Context` 섹션을 반드시 만들 필요는 없다. 기존 Experience prose 안에서 다음
질문에 답한다.

- 이 Experience의 주 사용자는 누구인가.
- 사용자는 Light House 바깥에서 어떤 문헌, 도구, 사람, 인용 네트워크와 함께
  움직이는가.
- 사용자는 그 연구 세계 안에서 무엇을 더 잘하고 싶어 하는가.
- Light House의 제품 활동은 그 기대 중 어디를 돕는가.
- 이 Experience가 닫지 않는 기대는 무엇인가.

예를 들어 `experience:research-and-discovery`는 단순히 검색 UI의 묶음이
아니다. 연구자가 논문 목록을 읽고, 논문 사이 관계를 비교하고, 다음 연구 질문
후보를 좁히는 상황을 배경으로 갖는다. Light House의 Promise는 그 배경 안에서
제품이 실제로 보장할 수 있는 일부를 닫는다.

## 관찰 차원

Augment Layer는 네 가지 질문으로 Experience 배경을 읽는다.

| 질문 | Light House에서 보는 것 |
| --- | --- |
| Who | 개인 연구자, 연구실, 분야 공동체 같은 Subject 단위 |
| Where | 외부 인용 네트워크, 연구 도구, 협업자, 비디지털 활동 같은 World 단위 |
| When | 한 세션, 주 단위, 월 단위, 논문 작성 사이클 같은 연구 시간 단위 |
| What | 논문 지형 이해, gap finding, 연구 질문 형성, 인용 네트워크 탐색, 외부 정리 도구와의 연결 같은 기대 |

처음부터 모든 차원을 schema로 강제하지 않는다. 먼저 Experience 문서에서
필요한 배경만 짧게 쓴다. Subject와 World가 실제로 반복해서 쓰일 때 별도
문서와 schema로 올린다.

## Promise와의 관계

Promise는 Subject 기대 전체를 닫지 않는다. Promise는 제품이 해당
Experience와 Moment 안에서 실제로 보장할 수 있는 한 조각을 닫는다.

예를 들어 연구자는 새 연구 질문이 선명해지기를 기대할 수 있다. Light House는
그 기대 전체를 보장하지 않는다. 대신 `gap-network-detection` 같은 Promise는
논문 군집 사이의 공백을 보여 주고, 그 근거를 설명하는 제품 동작을 보장한다.

그래서 Promise를 검토할 때는 두 질문을 분리한다.

- 이 Promise는 제품 안에서 무엇을 검증 가능하게 보장하는가.
- 그 보장은 상위 Experience의 어떤 사용자 기대에 기여하는가.

두 번째 질문은 non-blocking context다. Acceptance Check나 Intent Check를
대체하지 않는다.

## 후속 작업

이번 도입은 문서 정본을 추가하는 단계다. 다음 작업은 별도 세션에서 다룬다.

- Experience context 작성 기준 정의
- 기존 Experience prose 점검
- 반복되는 사용자 기대와 외부 연구 배경이 있는지 확인
- 반복 배경이 충분할 때만 Subject / World / Expectation 문서화 검토

## 출처

- mirror-mind 보편 원리:
  `projects/ai-agent-product-design/subject-world-augment-verdict.md`
- Engelbart 통합 명제: `projects/research/engelbart/README.md`
- Story Chain 빈자리 통찰:
  `projects/research/engelbart/05-subject-world-axis.md`
- Light House 정합성 시스템: `docs/principles.md`,
  `docs/contracts/story-chain/concepts.md`, `docs/verification-gates.md`,
  `docs/mission-control.md`
