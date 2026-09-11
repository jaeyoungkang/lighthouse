import { z } from "zod";
import { executeJudgment } from "@/app/server/ai-generation/judgment";

// Live-test-only evaluator helper.
// reason: qualitative Intent suites execute this through *.live.test.* entrypoints; product
// runtime must not import a judge that evaluates rendered output.
// owner: Mission Control Intent qualitative evaluation.
// reviewWhen: the last intent-qualitative live suite is retired or moves to another evaluator.

const judgeBooleanSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "1", "예", "네", "맞음", "answered"].includes(normalized)) {
      return true;
    }
    if (
      ["false", "no", "n", "0", "아니오", "아니요", "미달성", "not answered"].includes(normalized)
    ) {
      return false;
    }
  }
  return value;
}, z.boolean());

const perQuestionSchema = z.object({
  questionId: z.string(),
  answered: judgeBooleanSchema,
  evidence: z.string(),
  confidence: z.enum(["high", "medium", "low"]).default("medium"),
});

const judgeOutputSchema = z.object({
  results: z.array(perQuestionSchema),
});

export interface IntentQuestion {
  id: string;
  severity: "critical" | "important";
  question: string;
  answerCriteria: string;
}

export interface IntentJudgeResult {
  questionId: string;
  answered: boolean;
  evidence: string;
  confidence: "high" | "medium" | "low";
}

export interface IntentJudgeReport {
  results: IntentJudgeResult[];
  verdict: "met" | "not-met";
  unansweredCritical: IntentJudgeResult[];
}

function buildJudgePrompt(params: {
  surfaceName: string;
  renderedContent: string;
  questions: readonly IntentQuestion[];
}): string {
  const questionsJson = params.questions.map((q) => ({
    questionId: q.id,
    severity: q.severity,
    question: q.question,
    answerCriteria: q.answerCriteria,
  }));

  return [
    "당신은 UI 렌더 결과가 사용자 의도(Intent Questions)를 충족하는지 채점하는 평가자다.",
    `평가 대상 surface: ${params.surfaceName}`,
    "",
    "평가 규칙:",
    "- 각 질문별로 렌더된 내용이 답을 **의미적으로** 담고 있는지 판단한다.",
    "- 라벨·키워드 단순 반복은 답으로 인정하지 않는다 — answerCriteria를 엄격히 적용한다.",
    "- evidence에는 렌더 내용에서 답 근거가 되는 구체 문장/구문을 짧게 인용한다(답이 없으면 '해당 내용 없음').",
    "- confidence는 판단 확실성(high/medium/low).",
    "- 반드시 입력 questions 순서로 results 배열을 반환한다.",
    "",
    "입력 렌더 내용 (카드 전체 텍스트, 슬롯 구분은 줄바꿈):",
    "<<<",
    params.renderedContent.trim(),
    ">>>",
    "",
    "Intent Questions (JSON):",
    JSON.stringify(questionsJson, null, 2),
    "",
    '출력 JSON 형식: {"results": [{"questionId": "질문 ID", "answered": true, "evidence": "근거", "confidence": "high"}, ...]}',
    "answered는 반드시 JSON boolean true 또는 false로 반환한다.",
  ].join("\n");
}

export async function judgeIntentQuestions(params: {
  surfaceName: string;
  renderedContent: string;
  questions: readonly IntentQuestion[];
}): Promise<IntentJudgeReport> {
  const judgement = await executeJudgment({
    prompt: buildJudgePrompt(params),
    outputSchema: judgeOutputSchema,
    label: "intent-qualitative-judge",
    onError: "throw",
  });

  const byId = new Map(judgement.results.map((r) => [r.questionId, r] as const));
  const results: IntentJudgeResult[] = params.questions.map((q) => {
    const match = byId.get(q.id);
    if (!match) {
      return {
        questionId: q.id,
        answered: false,
        evidence: "judge did not return a result for this question",
        confidence: "low" as const,
      };
    }
    return {
      questionId: match.questionId,
      answered: match.answered,
      evidence: match.evidence,
      confidence: match.confidence,
    };
  });

  const questionById = new Map(params.questions.map((q) => [q.id, q] as const));
  const unansweredCritical = results.filter((result) => {
    const question = questionById.get(result.questionId);
    return question !== undefined && question.severity === "critical" && !result.answered;
  });

  return {
    results,
    verdict: unansweredCritical.length === 0 ? "met" : "not-met",
    unansweredCritical,
  };
}
