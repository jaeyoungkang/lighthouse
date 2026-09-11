import { describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import {
  judgeIntentQuestions,
  type IntentQuestion,
} from "@/app/server/ai-generation/intent-qualitative-judge";
import { buildViewSnapshot } from "@/app/lib/view-snapshot";
import { generateRouteAiComment } from "@/app/server/agent/route-ai-comment-generation";
import type { RepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";

const papers = [
  {
    paperId: "p1",
    title: "Toolformer: language models can teach themselves to use tools",
    abstract:
      "We introduce Toolformer, a model trained to decide which APIs to call, when to call them, what arguments to pass, and how to best incorporate results into future token prediction.",
    year: 2023,
    citationCount: 820,
    url: "https://example.com/p1",
    authors: [{ name: "Schick" }],
  },
  {
    paperId: "p2",
    title: "ReAct: synergizing reasoning and acting in language models",
    abstract:
      "LLMs generate both reasoning traces and task-specific actions in an interleaved manner, enabling synergy between deliberate reasoning and environment interaction.",
    year: 2023,
    citationCount: 1900,
    url: "https://example.com/p2",
    authors: [{ name: "Yao" }],
  },
  {
    paperId: "p3",
    title: "Voyager: an open-ended embodied agent with large language models",
    abstract:
      "Voyager continuously explores, acquires diverse skills, and makes novel discoveries in Minecraft using an LLM-powered lifelong learning agent.",
    year: 2023,
    citationCount: 650,
    url: "https://example.com/p3",
    authors: [{ name: "Wang" }],
  },
  {
    paperId: "p4",
    title: "MemGPT: towards LLMs as operating systems",
    abstract:
      "MemGPT manages memory tiers so LLMs can handle contexts that far exceed their native window, enabling long-running conversations.",
    year: 2023,
    citationCount: 400,
    url: "https://example.com/p4",
    authors: [{ name: "Packer" }],
  },
  {
    paperId: "p5",
    title: "Reflexion: language agents with verbal reinforcement learning",
    abstract:
      "Reflexion agents verbally reflect on task feedback signals, then maintain their own reflective text in memory to induce better decision-making.",
    year: 2023,
    citationCount: 520,
    url: "https://example.com/p5",
    authors: [{ name: "Shinn" }],
  },
];

function createSearchView(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "doc-search-1",
    type: "search",
    title: "large language model agents",
    content: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: "user-1",
    ownerPrincipalId: "ws-live-judge",
    reaction: null,
    metadata: {
      type: "search",
      query: "large language model agents lifelong learning",
      total: 180,
      totalMode: "exact",
      papers,
      queryClauses: [
        {
          rawClause: "large language model agents",
          normalizedClause: "large language model agents",
          role: "anchor",
          isExtractive: true,
          derivedExpansions: [],
        },
        {
          rawClause: "lifelong learning",
          normalizedClause: "lifelong learning",
          role: "theme",
          isExtractive: true,
          derivedExpansions: [],
        },
      ],
      clauseStats: [
        { clause: "large language model agents", role: "anchor", fetched: 5, total: 180 },
        { clause: "lifelong learning", role: "theme", fetched: 0, total: 0 },
      ],
    },
  } as unknown as ResearchRoutePayload;
}

const intentQuestions: IntentQuestion[] = [
  {
    id: "scale",
    severity: "critical",
    question: "결과 집합의 규모가 body에서 정량(N편)으로 드러나는가.",
    answerCriteria:
      "body에 숫자 기반 편수(N편)가 존재해야 함. '여러/다수/많은/일부' 같은 완충 표현만으로 편수를 대체하면 답으로 인정하지 않음.",
  },
  {
    id: "shape",
    severity: "critical",
    question: "이 결과 집합의 지형(어떤 하위 주제·흐름으로 구성되는가)이 body에서 감지되는가.",
    answerCriteria:
      "body가 쿼리 단순 반복이 아닌 실제 결과 논문들의 공통 방향·하위 영역을 서술해야 함. 구체적 접근·주제를 담은 문장이 필요. 단순 편수만 있고 지형이 비어 있으면 답으로 인정하지 않음.",
  },
];

interface CardOutput {
  title: string;
  body: string;
  surface?: {
    kind?: string;
    groups?: Array<Record<string, unknown>>;
  } | null;
}

function buildRenderedCardText(card: CardOutput): string {
  const lines = [`[title] ${card.title}`, `[body] ${card.body}`];
  const groups = card.surface?.groups ?? [];
  if (groups.length > 0) {
    const labels = groups.map((g) => {
      const title = typeof g["title"] === "string" ? g["title"] : undefined;
      const id = typeof g["id"] === "string" ? g["id"] : "";
      const nodeLines = Array.isArray(g["nodes"])
        ? g["nodes"]
            .map((node) => {
              if (!node || typeof node !== "object") return null;
              const record = node as Record<string, unknown>;
              const label = typeof record["label"] === "string" ? record["label"] : "";
              const summary = typeof record["summary"] === "string" ? record["summary"] : "";
              return summary ? `${label}: ${summary}` : label;
            })
            .filter((line): line is string => Boolean(line))
        : [];
      return [title ?? id, ...nodeLines].join(" / ");
    });
    lines.push(`[surface] ${card.surface?.kind ?? "none"}: ${labels.join(" · ")}`);
  }
  return lines.join("\n");
}

// Run the exact runtime search-view-reaction generation boundary and return the
// rendered card text, per docs/principles.md §0 핵심 철학.
async function runSearchRouteAiCommentRenderedCard(): Promise<string> {
  const document = createSearchView();
  const viewSnapshot = buildViewSnapshot(document);
  if (!viewSnapshot) {
    throw new Error("runtime path did not produce a view snapshot");
  }
  if (document.type !== "search") {
    throw new Error("expected a search fixture");
  }

  const reaction = await generateRouteAiComment({
    db: {} as RepositoryDbHandle,
    ownerPrincipalId: document.ownerPrincipalId,
    viewSnapshot,
    trigger: "user_search",
  });

  if (!reaction) {
    throw new Error("runtime path did not produce a route AI comment");
  }
  return buildRenderedCardText(reaction);
}

let renderedSearchRouteAiCommentCardPromise: Promise<string> | null = null;

function getRenderedSearchRouteAiCommentCard(): Promise<string> {
  renderedSearchRouteAiCommentCardPromise ??= runSearchRouteAiCommentRenderedCard();
  return renderedSearchRouteAiCommentCardPromise;
}

describe("search route AI comment card intent qualitative verification (live runtime)", () => {
  it("search completion route AI comment generation answers the terrain Critical Intent Questions", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    const rendered = await getRenderedSearchRouteAiCommentCard();
    expect(rendered).not.toContain("검색 결과 5편을 분석해 연구 공백을 찾는다.");
    expect(rendered).not.toContain("연구 공백 탐색");
    expect(rendered).not.toContain("search-gap");
    process.stdout.write(
      `\n===== RUNTIME AI COMMENT =====\n${rendered}\n=====================================\n\n`,
    );

    const judgement = await judgeIntentQuestions({
      surfaceName: "search completion route AI comment card (runtime generation output)",
      renderedContent: rendered,
      questions: intentQuestions,
    });

    process.stdout.write(
      `\n===== JUDGE RESULT =====\n${JSON.stringify(judgement, null, 2)}\n========================\n\n`,
    );

    expect(judgement.unansweredCritical).toEqual([]);
    expect(judgement.verdict).toBe("met");
  }, 120_000);

  // aspect:ux-writing-voice-and-tone qualitative track.
  // Source: promise:search-reaction-summarizes-terrain#intent-check:search-reaction-ux-writing-voice.
  // Judges the SAME real route AI comment generation payload against the UX-writing voice·tone
  // craft principles the deterministic registry contract cannot express.
  it("search completion route AI comment generation answers the UX-writing voice·tone Critical Intent Questions", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for the UX-writing voice·tone LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    const uxWritingQuestions: IntentQuestion[] = [
      {
        id: "ux-writing-concise-active-positive",
        severity: "critical",
        question:
          "반응 title/body가 군더더기 없이 간결하고, 제약을 먼저 방어하기보다 결과 지형과 가능한 다음 경로를 능동·긍정형으로 말하는가.",
        answerCriteria:
          "생략해도 뜻이 통하는 군더더기 단어를 덜어내고, 가능한 행동·방향을 능동·긍정형으로 제시하면 충족. 같은 의미를 다른 문장으로 반복하거나 제약/금지만 나열하면 인정하지 않음.",
      },
      {
        id: "ux-writing-universal-suggestion",
        severity: "critical",
        question:
          "반응이 누구나 아는 보편적 단어로 읽히고, 개발 용어·에러 코드 노출이나 강요·공포 어조 없이 다음 행동을 권유형으로 안내하는가.",
        answerCriteria:
          "보편적 단어로 결과를 설명하고 다음 경로를 권유하면 충족. 개발 용어·에러 코드 노출, 전문 용어 남발, 강요·공포 조성이면 인정하지 않음.",
      },
    ];

    const rendered = await getRenderedSearchRouteAiCommentCard();
    process.stdout.write(
      `\n===== AI COMMENT OUTPUT (ux-writing) =====\n${rendered}\n=================================================\n\n`,
    );

    const judgement = await judgeIntentQuestions({
      surfaceName: "search completion route AI comment card — UX-writing voice·tone",
      renderedContent: rendered,
      questions: uxWritingQuestions,
    });

    process.stdout.write(
      `\n===== JUDGE RESULT (ux-writing) =====\n${JSON.stringify(judgement, null, 2)}\n=====================================\n\n`,
    );

    expect(judgement.unansweredCritical).toEqual([]);
    expect(judgement.verdict).toBe("met");
  }, 120_000);
});
