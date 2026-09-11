---
name: human-authority-prose
description: Korean prose style rules for Story Chain Human-authority docs (Experience, Moment, Promise, Aspect), plus the post-hoc authoring exception currently active at Experience level.
---

# Human-Authority Prose — Korean Style

이 reference는 Mission Control이 Human-authority prose를 작성하거나 다듬을
때 따르는 한국어 문체 규칙을 모은다. 적용 범위는 `docs/contracts/story-chain/`
의 Experience, Moment, Promise, Aspect 정본 문서 prose다. 의미와 존재
자체는 Human이 승인하고, 그 의미를 한국어 문장으로 옮기는 산문 작업에 이
규칙이 걸린다.

문서별 본문 작성 기준(Subject & situation, What happens, Boundary 등)은
`docs/contracts/story-chain/concepts.md`가 정본이다. 이 파일은 그 위에서
한국어 산문이 자연스럽게 읽히도록 하는 문체 규칙과, 현재 진행 중인 사후
작성 예외를 담는다.

이 reference는 문체만 소유한다. 제품 의미와 아키텍처 메커니즘의 배치는
`product-architecture-content-ownership.md`가 소유한다. 기술 식별자가 보인다는
이유만으로 문장을 삭제하지 않는다. 사용자에게 보이는 URL 권위, 수명, 복원,
실패·저하, 접근 의미는 Story Chain에 남기고, 교체 가능한 내부 메커니즘과 정확한
evidence ref는 해당 정본으로 이동한다.

## Direction of authority — normal vs. post-hoc

정상 흐름은 위에서 아래다. Human이 Experience 의미를 승인하고, 그것이
Moment·Promise·Aspect로 전파된다. Experience prose가 정본이고, 하위 노드는
그에 맞춰 좁혀진다. Moment의 prose도 같은 방식으로 그 아래 Promise를
좁힌다.

지금(2026-05) Light House는 그 반대 단계에 있다. Experience prose가 얕게만
적혀 있고 Moment·Promise가 먼저 두텁게 선언된 상태에서 상위 prose를 사후로
다듬고 있다. 이 단계에서만 적용되는 예외가 있다 — 사후 prose는 하위 정본에
적힌 동작·약속만 끌어오고, 새 commitment를 prose에서 만들지 않는다. 사후
작업이 끝나면 이 예외는 풀린다. 이후의 변경은 다시 위에서 아래로 흐른다.

이 예외는 어느 레벨에서든 같은 모양으로 쓰일 수 있다. 새 노드 타입의
prose가 사후로 채워지는 일이 또 생기면, 그 노드 레벨에 한해 이 예외를
적용한다. 현재는 Experience 레벨에서만 활성이다.

이 문서의 "Faithfulness to lower nodes" 섹션은 사후 단계 한정 규칙이다.
나머지 문체 규칙은 단계와 무관하게 항상 적용한다.

## Sentence shape

- **단문 중심**으로 쓴다. 한 문장에 한 동작 또는 한 사실. 복문이 길어지면
  끊는다.
- "X하는 순간." 같은 명사구 도입부 — "연구자가 ... 마주한 순간",
  "운영자가 ... 점검 중인 순간" — 은 영어 번역체다. 상황을 평이한 한국어
  문장으로 풀어 쓴다.
- "사용자에게 남아야 할 것은 ... 감각이다", "... 라는 결이다" 같이 felt
  outcome을 명사구로 굳혀 끝맺는 구성도 영어 번역체다. 사용하지 않는다.
  그 노드에서 제품이 어떻게 작동하는지를 직접 서술한다.
- "X가 목적이 아니다", "Y만 하려는 것이 아니다" 같은 부정형으로 Experience
  맥락을 세우지 않는다. 사용자가 실제로 무엇을 하는 중인지, 제품이 어떤
  판단을 돕는지 긍정문으로 쓴다.

## Vocabulary

- 정본 Promise·Moment 문장에 이미 쓰인 비유 표현(예: "지형")은 살린다.
  그 위에 다시 metaphor를 쌓지 않는다 ("지형 위에서 한 걸음" 같은 표현
  금지).
- 한국어 서술에서 어색한 추상어(예: "긴장")는 정본 Promise에 그대로
  적혀 있더라도 상위 prose에서는 풀어 쓴다. Promise 정본은 Promise대로
  두고, 산문 가독성을 위한 풀어쓰기는 prose 쪽에서 한다.
- 따옴표로 감싼 가상 인용("이 제품이 나에게 무엇을 해주겠다고 말하는가")
  같은 인용형 수사를 쓰지 않는다.
- 화면 이름·컴포넌트·API·기술 단어를 본문에 끌어오지 않는다. URL이
  사용자에게 직접 노출되는 commitment surface처럼 그 자체가 약속의 일부일
  때만 예외로 둔다.

## Faithfulness to lower nodes (post-hoc only)

사후 단계에서만 적용한다. 정상 흐름이 회복된 뒤에는 반대 방향이 정상이다.

- 사후 prose는 하위 노드의 정본에 명시된 동작과 약속만 끌어온다. 새
  약속을 prose에서 만들지 않는다.
- 사용자에게 실제로 제공되지 않는 경험을 prose에 넣지 않는다 — 정본 하위
  노드에 약속으로 적혀 있어도, 그 약속의 실제 외연이 prose가 묘사하려는
  것보다 좁다면 가져오지 않는다.
- "결과 위에 갭 분석을 얹으면" 같은 모호한 비유로 동작을 가리지 않는다.
  사용자가 실제로 누르는 버튼·이동하는 화면이 정본에 명시되어 있으면 그
  동작을 직접 서술한다 (예: "`갭 분석 보기`를 선택하면").

## Experience background lens

Experience prose는 별도 `Context` 섹션 없이도 사용자의 배경을 품어야 한다.
특히 core product Experience를 다룰 때는 사용자가 논문을 찾는 장면만 쓰지
말고, 그 앞의 연구 맥락을 쓴다.

- 연구자가 새 연구를 시작하는지, 진행 중인 연구의 다음 방향을 잡는지 먼저
  잡는다.
- 논문 검색, PDF 읽기, 인용 계보 확인, gap network, 외부 메모 정리, 동료나
  지도교수와의 논의처럼 함께 움직이는 외부 연구 환경을 구체적으로 적는다.
- 사용자가 무엇을 더 잘하려는지 직접 쓴다. 예: 다음에 읽을 논문을 고른다,
  근거를 비교한다, 연구 질문 후보를 좁힌다, 정독할 논문을 가린다.
- 제품이 그 연구 흐름 중 어디를 돕는지 쓴다. 제품이 보장하지 않는 장기 연구
  성과를 새 commitment처럼 쓰지 않는다.

작성할 때는 부정형으로 경계를 세우기보다, 사용자가 지금 무엇을 하려는지
먼저 쓴다. 검색 화면 안에 머물지 않는다는 말 대신 후속 탐색 방향을 잡는다고
쓴다. 논문 전체를 소유하지 않는다는 말 대신 자기 연구 흐름에 들어올지 먼저
판단한다고 쓴다. 문서를 많이 여는 것이 목적이 아니라는 말 대신 근거를 잃지
않고 다음 판단으로 넘어간다고 쓴다.

선호하는 문장 예:

- "연구자는 새 연구를 시작하거나 진행 중인 연구의 다음 방향을 잡기 위해
  논문을 찾는다."
- "연구자는 이 논문이 자기 연구 흐름에 들어올 만한지 먼저 판단한다."
- "연구자는 열린 문서들을 오가며 방금 본 근거를 잃지 않고 다음 판단으로
  넘어간다."

## Authoring loop

- 노드 단위로 draft를 텍스트로 먼저 보여 주고 컨펌받은 뒤 파일에 쓴다.
- 일괄 작성은 사용자가 "검토해서 피드백 주겠다"는 명시적 일괄 승인을 준
  경우에만 한다. 기준 컨펌은 본문 컨펌과 다르다.
- 피드백이 와서 같은 원칙을 다른 파일에도 적용해야 할 때는, 적용 범위를
  먼저 사용자에게 확인한다.
