import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentPanel } from "@/app/components/research/AgentPanel";
import type {
  CitationLineageMetadata,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import {
  judgeIntentQuestions,
  type IntentQuestion,
} from "@/app/server/ai-generation/intent-qualitative-judge";
import { buildViewSnapshot } from "@/app/lib/view-snapshot";
import { generateRouteAiComment } from "@/app/server/agent/route-ai-comment-generation";
import type { RepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const SEED_TITLE = "Attention Is All You Need";

const seedPaper = {
  paperId: "seed-attention",
  title: SEED_TITLE,
  abstract:
    "We propose the Transformer, a new simple network architecture based solely on attention mechanisms, dispensing with recurrence and convolutions entirely, and show state-of-the-art machine translation quality with significantly reduced training time.",
  year: 2017,
  citationCount: 120_000,
  url: "https://example.com/attention",
  authors: [{ name: "Vaswani" }, { name: "Shazeer" }, { name: "Parmar" }],
};

const referencePapers = [
  {
    paperId: "ref-seq2seq",
    title: "Sequence to Sequence Learning with Neural Networks",
    abstract:
      "We present a general end-to-end approach to sequence learning that makes minimal assumptions on the sequence structure, using multilayered LSTM to map the input sequence to a vector of a fixed dimensionality.",
    year: 2014,
    citationCount: 25_000,
    url: "https://example.com/seq2seq",
    authors: [{ name: "Sutskever" }, { name: "Vinyals" }, { name: "Le" }],
  },
  {
    paperId: "ref-bahdanau",
    title: "Neural Machine Translation by Jointly Learning to Align and Translate",
    abstract:
      "We introduce an attention mechanism that allows a model to automatically soft-search for parts of a source sentence relevant for predicting a target word, improving translation quality especially for long sentences.",
    year: 2015,
    citationCount: 28_000,
    url: "https://example.com/bahdanau",
    authors: [{ name: "Bahdanau" }, { name: "Cho" }, { name: "Bengio" }],
  },
  {
    paperId: "ref-bytenet",
    title: "Neural Machine Translation in Linear Time",
    abstract:
      "ByteNet uses stacked dilated convolutions to build fixed-depth translation models that operate in linear time with respect to sequence length, achieving strong translation quality without recurrence.",
    year: 2017,
    citationCount: 1_400,
    url: "https://example.com/bytenet",
    authors: [{ name: "Kalchbrenner" }, { name: "Espeholt" }, { name: "Simonyan" }],
  },
];

const citationPapers = [
  {
    paperId: "cite-bert",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    abstract:
      "BERT pretrains deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context, achieving state-of-the-art on eleven natural language processing tasks.",
    year: 2019,
    citationCount: 80_000,
    url: "https://example.com/bert",
    authors: [{ name: "Devlin" }, { name: "Chang" }, { name: "Lee" }, { name: "Toutanova" }],
  },
  {
    paperId: "cite-gpt3",
    title: "Language Models are Few-Shot Learners",
    abstract:
      "GPT-3 is a 175-billion parameter autoregressive language model that performs new tasks from only a few examples in its context, demonstrating that scale enables strong few-shot generalization.",
    year: 2020,
    citationCount: 30_000,
    url: "https://example.com/gpt3",
    authors: [{ name: "Brown" }, { name: "Mann" }, { name: "Ryder" }],
  },
  {
    paperId: "cite-vit",
    title: "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
    abstract:
      "Vision Transformer treats image patches as tokens and applies a standard Transformer encoder to achieve strong image classification results when pretrained on large datasets, transferring attention beyond language.",
    year: 2021,
    citationCount: 22_000,
    url: "https://example.com/vit",
    authors: [{ name: "Dosovitskiy" }, { name: "Beyer" }, { name: "Kolesnikov" }],
  },
];

function createCitationLineageView(): ResearchRoutePayload {
  const metadata: CitationLineageMetadata = {
    type: "citation_lineage",
    seedPaper,
    referenceIds: referencePapers.map((p) => p.paperId),
    citationIds: citationPapers.map((p) => p.paperId),
    papers: [...referencePapers, ...citationPapers],
    total: referencePapers.length + citationPapers.length,
  };
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-live-1",
    type: "citation_lineage",
    title: `인용 계보: ${SEED_TITLE}`,
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "ws-citation-live",
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    metadata,
    reaction: null,
  } as unknown as ResearchRoutePayload;
}

// Phase 2.5 3-layer form: layout placement (AC4) and direction split (AC4/AC6)
// are deterministic and absorbed into AC. Only intent-check:citation-lineage-card-sufficiency — body being a
// relationship-nature summary rather than number enumeration — remains at the
// emergent LLM quality layer.
const intentQuestions: IntentQuestion[] = [
  {
    id: "intent-check:citation-lineage-card-sufficiency",
    severity: "critical",
    question:
      "body가 seed 논문을 중심으로 선행·후속 사이의 관계 성격(어떤 흐름에서 파생되어 어디로 이어지는가)을 충분히 설명하는가?",
    answerCriteria:
      "body가 seed 논문을 중심으로 선행 연구(references)가 어떤 흐름·방법에서 왔고 후속 연구(citations)가 어떤 방향·주제로 이어지는지를 두 방향 모두 서술해야 한다. 'references N편 · citations M편' 같은 숫자 나열, '인용이 많다/관련 연구가 여럿 있다' 같은 얕은 형용, seed 제목 단순 반복, 또는 한쪽 방향만 언급하고 다른 쪽 결을 누락한 경우는 답으로 인정하지 않는다. 한쪽이 실제 0편이면 그 사실을 명시하고, provider 제한·미추출·잘림 상태를 실제 0편처럼 단정하지 않아야 한다.",
  },
];

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function resetStores() {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  useBackgroundTaskStore.setState({
    inlineAnalysisTasks: {},
  });
}

describe("citation_lineage route AI comment first-card intent qualitative verification (live runtime DOM)", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    resetStores();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.innerHTML = "";
    root = null;
    resetStores();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("citation_lineage route AI comment first card DOM answers intent-check:citation-lineage-card-sufficiency via real Gemini runtime path", async () => {
    if (!process.env["GEMINI_API_KEY"]) {
      throw new Error(
        "GEMINI_API_KEY is required for Intent Sufficiency LLM judge. Per docs/principles.md §0 핵심 철학, an unverified Intent cannot be declared met.",
      );
    }

    const fixtureDocument = createCitationLineageView();
    const viewSnapshot = buildViewSnapshot(fixtureDocument);
    if (!viewSnapshot) {
      throw new Error("runtime path did not produce a view snapshot");
    }
    if (fixtureDocument.type !== "citation_lineage") {
      throw new Error("expected a citation lineage fixture");
    }

    const generatedReaction = await generateRouteAiComment({
      db: {} as RepositoryDbHandle,
      ownerPrincipalId: fixtureDocument.ownerPrincipalId,
      viewSnapshot,
      trigger: "citation_lineage_opened",
    });

    if (!generatedReaction) {
      throw new Error("runtime path did not produce a route AI comment");
    }

    process.stdout.write(
      `\n===== RUNTIME AI COMMENT =====\n[title] ${generatedReaction.title}\n[body] ${generatedReaction.body}\n=====================================\n\n`,
    );

    // Real UI component render — AgentPanel is what the user sees in the
    // citation_lineage AI comment area. Judge target is the rendered DOM text
    // per `docs/principles.md §0 핵심 철학`.
    useResearchRouteStore.getState().setCurrentView(fixtureDocument, "test-execution:200");
    const reaction: RouteAiComment = generatedReaction;
    useResearchRouteStore
      .getState()
      .setRouteAiComment(
        fixtureDocument.id,
        reaction,
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );

    const container = globalThis.document.createElement("div");
    globalThis.document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(<AgentPanel documentId={fixtureDocument.id} isLoading={false} />);
    });

    const rendered = container.textContent.trim();
    process.stdout.write(
      `\n===== RUNTIME DOM OUTPUT =====\n${rendered}\n==============================\n\n`,
    );

    expect(rendered.length).toBeGreaterThan(0);
    // Structural floor: the generated title identifies the seed, while the
    // production inline surface renders the body below the route-owned sticky
    // seed context. The judge enforces relationship-nature quality on that
    // actual inline DOM instead of a retired compact AgentPanel branch.
    expect(generatedReaction.title).toMatch(/Attention|Transformer|트랜스포머/);

    const judgement = await judgeIntentQuestions({
      surfaceName: "citation_lineage route AI comment first card (runtime AgentPanel DOM)",
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
