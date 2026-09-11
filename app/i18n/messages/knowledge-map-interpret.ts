const knowledgeMapInterpretMessages = {
  "knowledgeMap.label.interpret-gap-hypothesis":
    "{leftLabel}와 {rightLabel}는 관련 키워드를 공유하지만 직접 연결은 아직 약하다. {bridgeConcept}를 매개로 한 비교 연구가 새로운 교차축을 만들 가능성이 있다.",
  "knowledgeMap.label.interpret-gap-hypothesis.2":
    "{leftLabel}와 {rightLabel}는 기대 연결에 비해 실제 연결이 적다. 대표 개념을 직접 결합한 탐색적 연구가 공백을 메우는 출발점이 될 수 있다.",
} as const satisfies Record<string, string>;

export default knowledgeMapInterpretMessages;
