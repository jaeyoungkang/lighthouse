const INTENT_TRACEABILITY_MESSAGES = {
  "intentTraceability.lane.search": "검색 흐름",
  "intentTraceability.lane.pdf": "PDF 읽기 흐름",
  "intentTraceability.lane.research-route": "연구 route view",
  "intentTraceability.lane.admin": "어드민",
  "intentTraceability.lane.other": "기타",
  "intentTraceability.nextAction.declare":
    "{targetEvidenceLedger}에 {promiseRef}의 Intent Check / Acceptance Check evidence를 전파한다.",
  "intentTraceability.nextAction.propagate":
    "{ledger}의 Intent Verification에 실데이터 렌더 기반 Sufficiency Review 첫 dated entry를 추가한다.",
  "intentTraceability.nextAction.verify":
    "{ledger}의 Sufficiency Review 남은 Adopt-open/Defer gap을 Adopt-resolved 또는 Reject로 닫아 Verdict를 met으로 만든다.",
  "intentTraceability.nextAction.met":
    "유지: Intent·Critical Questions·한도 변경 시 Sufficiency Review 신규 entry를 추가한다.",
  "intentTraceability.blocker.alignmentCritical":
    "alignment finding {count}건이 implementation 신호를 차단하고 있다. AC trace 실행 증거 또는 contract 동기화를 먼저 닫는다.",
  "intentTraceability.blocker.alignmentWarning":
    "alignment finding {count}건이 회귀 보호를 약하게 만들고 있다. 정합성 finding을 정리한 뒤 verification으로 넘어간다.",
  "intentTraceability.blocker.verifyFallback":
    "verify 단계에서 미해결 gap이 남아 있다. Sufficiency Review의 Adopt-open 항목을 닫는 것이 가장 빠른 unblocking 경로다.",
  "intentTraceability.blocker.propagate":
    "{ledger}의 Intent Verification에 dated Sufficiency Review entry가 아직 없다. live judge 1회 실행 후 entry를 append한다.",
  "intentTraceability.blocker.unpropagated":
    "covering ledger에 Intent Verification 근거가 없다. propagation 단계로 돌아가 intent checks와 구조화 execution reference를 추가한다.",
} as const;

type IntentTraceabilityMessageKey = keyof typeof INTENT_TRACEABILITY_MESSAGES;

export function formatIntentTraceabilityMessage(
  key: IntentTraceabilityMessageKey,
  params?: Record<string, string | number>,
): string {
  let text: string = INTENT_TRACEABILITY_MESSAGES[key];
  for (const [placeholder, value] of Object.entries(params ?? {})) {
    text = text.replaceAll(`{${placeholder}}`, String(value));
  }
  return text;
}
