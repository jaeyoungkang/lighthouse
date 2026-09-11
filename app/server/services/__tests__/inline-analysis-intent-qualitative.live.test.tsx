import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";
import {
  judgeIntentQuestions,
  type IntentQuestion,
} from "@/app/server/ai-generation/intent-qualitative-judge";
import {
  analyzePapersInline,
  type PaperInput,
} from "@/app/server/services/inline-analysis-service";

// Worst-case fixture: a single paper with a rich ~300자 영문 abstract that
// carries distinct topics (embodied skill acquisition), a concrete method
// (curriculum + automatic skill library with an LLM planner), and an explicit
// claim (lifelong learning outperforms baselines on Minecraft tasks). If the
// pipeline degrades to keyword-only topics or drops summary/method/finding to
// fallback text, the judge must flag intent-check:inline-analysis-content-specificity as not answered.
const fixturePaper: PaperInput = {
  paperId: "voyager-fixture",
  title: "Voyager: An Open-Ended Embodied Agent with Large Language Models",
  abstract:
    "We introduce Voyager, the first LLM-powered embodied lifelong learning agent in Minecraft that continuously explores the world, acquires diverse skills, and makes novel discoveries without human intervention. Voyager consists of three key components: (1) an automatic curriculum that maximizes exploration, (2) an ever-growing skill library of executable code for storing and retrieving complex behaviors, and (3) a new iterative prompting mechanism that incorporates environment feedback, execution errors, and self-verification for program improvement. Voyager interacts with GPT-4 via blackbox queries, which bypasses the need for model parameter fine-tuning. The skills developed by Voyager are temporally extended, interpretable, and compositional, which compounds the agent's abilities rapidly and alleviates catastrophic forgetting. Empirically, Voyager shows strong in-context lifelong learning capability and exhibits exceptional proficiency in playing Minecraft.",
  year: 2023,
  citationCount: 650,
  url: "https://example.com/voyager",
  authors: ["Wang"],
};

const intentQuestions: IntentQuestion[] = [
  {
    id: "intent-check:inline-analysis-content-specificity",
    severity: "critical",
    question:
      "인라인 분석 카드가 abstract를 열지 않고도 이 논문의 요약(주장 서술)·주제·방법·결과 중 최소 2종을 구체 구절 수준(키워드 나열 금지)으로 전달하는가?",
    answerCriteria:
      "요약(주장 서술)/주제(topics)/방법(method)/결과(finding) 중 최소 2종이 구체 구절(명사구·동사구 수준의 서술적 표현)로 카드에 보여야 함. 'X, Y, Z' 형태의 짧은 키워드 라벨 나열이나 abstract raw truncate, 또는 '근거 부족으로 주제를 확정하지 않음' fallback 문구가 2종 이상 필드에 동시에 나타나면 얕은 답으로 배제.",
  },
];

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("inline analysis intent qualitative verification (live runtime DOM)", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("inline analysis card DOM answers intent-check:inline-analysis-content-specificity with concrete phrase-level summary/topic/method/finding from real Gemini semantic profile", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    // Real runtime: call the actual inline analysis service that search
    // results use. This routes through `analyzePaperBatch` → Gemini → the
    // same `buildAnalysisFromSemanticProfile` path a production search uses.
    const results = await analyzePapersInline([fixturePaper]);
    expect(results).toHaveLength(1);
    const [analysisResult] = results;
    expect(analysisResult.paperId).toBe(fixturePaper.paperId);

    process.stdout.write(
      `\n===== RUNTIME INLINE ANALYSIS OUTPUT =====\n${JSON.stringify(analysisResult.analysis, null, 2)}\n==========================================\n\n`,
    );

    // Real component render — SearchResultItem mounts InlineAnalysis which
    // is the user-visible per-paper card. The judge target is this component's
    // real DOM textContent after the detail toggle is expanded (docs/principles.md §0).
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(
        <SearchResultItem
          paper={{
            paperId: fixturePaper.paperId,
            title: fixturePaper.title,
            abstract: fixturePaper.abstract,
            year: fixturePaper.year ?? null,
            citationCount: fixturePaper.citationCount ?? 0,
            url: fixturePaper.url ?? "",
            authors: (fixturePaper.authors ?? []).map((name) => ({ name })),
            openAccessPdf: null,
            doi: null,
            referenceIds: null,
            citationIds: null,
          }}
          isLast
          analysisState="done"
          analysisResult={{ analysis: analysisResult.analysis, source: analysisResult.source }}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={() => {}}
        />,
      );
    });

    // Expand from the card-owned non-interactive surface so the judge sees
    // method/topics/results, not just the summary preview.
    const cardSurface = container.querySelector<HTMLElement>('[data-testid="search-result-card"]');
    if (!cardSurface) {
      throw new Error("paper card inspection surface not rendered — card layout changed");
    }
    act(() => {
      cardSurface.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    const rendered = container.textContent.trim();
    process.stdout.write(
      `\n===== RUNTIME DOM OUTPUT =====\n${rendered}\n==============================\n\n`,
    );

    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).toContain("요약");
    expect(rendered).toContain("주제");
    expect(rendered).toContain("방법");
    expect(rendered).toContain("결과");

    const judgement = await judgeIntentQuestions({
      surfaceName: "per-paper inline analysis card (runtime component DOM, detail expanded)",
      renderedContent: rendered,
      questions: intentQuestions,
    });

    process.stdout.write(
      `\n===== JUDGE RESULT =====\n${JSON.stringify(judgement, null, 2)}\n========================\n\n`,
    );

    expect(judgement.unansweredCritical).toEqual([]);
    expect(judgement.verdict).toBe("met");
  }, 120_000);
});
