import { beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { hasGeminiApiKey } from "@/app/server/ai-generation/gemini";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import {
  applyGraphSupportToEnglishTermCandidates,
  buildEnglishTermCandidatesWithLLM,
  projectSearchTermDiscoveryPapersFromCachedMetadata,
} from "@/app/server/services/search-term-discovery";
import { TERM_CANDIDATE_PROMPT_FIELD_CHARS } from "@/app/server/services/search-term-discovery-prompt";

vi.mock("@/app/server/ai-generation/gemini", async () => {
  const actual = await vi.importActual("@/app/server/ai-generation/gemini");
  return {
    ...(actual as Record<string, unknown>),
    hasGeminiApiKey: vi.fn(() => false),
  };
});

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
}));

const mockedHasGeminiApiKey = vi.mocked(hasGeminiApiKey);
const mockedExecuteJudgment = vi.mocked(executeJudgment);

function paper(params: {
  paperId: string;
  title: string;
  abstract?: string | null;
  citationCount?: number;
  method?: string;
  inlineAnalysisVersion?: number;
}): SearchMetadata["papers"][number] {
  return {
    paperId: params.paperId,
    title: params.title,
    abstract: params.abstract ?? null,
    year: 2025,
    citationCount: params.citationCount ?? 12,
    url: `https://example.com/${params.paperId}`,
    authors: [{ name: "Researcher" }],
    openAccessPdf: null,
    doi: null,
    referenceIds: null,
    citationIds: null,
    ...(params.method
      ? {
          inlineAnalysis: {
            version: params.inlineAnalysisVersion ?? INLINE_ANALYSIS_VERSION,
            inputFingerprint: "a".repeat(64),
            source: "abstract" as const,
            analysis: {
              summary: "summary",
              objective: "objective",
              methodology: params.method,
              results: `findings from ${params.method} workflows`,
              keywords: [params.method],
              semanticProfile: {
                claim: `${params.method} improves research workflows`,
                topics: [params.method],
                method: params.method,
                finding: `${params.method} exposes research workflow gaps`,
                conclusion: null,
                quotedBasis: {
                  claim: null,
                  topics: [],
                  method: null,
                  finding: null,
                  conclusion: null,
                },
              },
              stanceProfile: {
                mainPosition: null,
                debateAxis: null,
                limitations: null,
                counterSearchQueries: [],
              },
              confidence: "medium" as const,
              evidenceMap: {},
            },
          },
        }
      : {}),
  };
}

beforeEach(() => {
  mockedHasGeminiApiKey.mockReturnValue(false);
  mockedExecuteJudgment.mockReset();
});

describe("term discovery cached metadata projection", () => {
  it("projects an exact-cache semantic profile without full card authority", () => {
    const projected = projectSearchTermDiscoveryPapersFromCachedMetadata({
      type: "search",
      query: "research workflow",
      total: 1,
      papers: [
        paper({
          paperId: "101",
          title: "Research Workflow",
          abstract: "A workflow evaluation.",
          method: "workflow evaluation",
        }),
      ],
    });

    expect(projected[0]).toMatchObject({
      paperId: "101",
      title: "Research Workflow",
      semanticProfile: {
        topics: "workflow evaluation",
        method: "workflow evaluation",
      },
    });
    expect(projected[0]).not.toHaveProperty("citationCount");
    expect(projected[0]).not.toHaveProperty("inlineAnalysis");
  });
});

describe("buildEnglishTermCandidates graph and LLM support", () => {
  it("extracts LLM method/contribution phrase families and uses graph support for term priority", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "verification",
          supportPaperIds: ["101", "202"],
          rationale: "too broad",
        },
        {
          term: "multi touch interaction",
          supportPaperIds: ["303"],
          rationale: "interaction method family",
        },
        {
          term: "highlighting visualization",
          supportPaperIds: ["101", "202"],
          rationale: "graph-supported visual method family",
        },
      ],
    });

    const { candidates, source } = await buildEnglishTermCandidatesWithLLM({
      query: "slide accessibility",
      papers: [
        paper({
          paperId: "101",
          title: "Highlighting Visualization for Slide Accessibility",
          abstract: "The paper uses highlighting visualization to expose inaccessible slides.",
          citationCount: 12,
          method: "highlighting visualization for slide accessibility review",
        }),
        paper({
          paperId: "202",
          title: "Visual Slide Repair Through Highlighting Visualization",
          abstract: "A highlighting visualization supports accessibility repair workflows.",
          citationCount: 10,
          method: "highlighting visualization for slide accessibility repair",
        }),
        paper({
          paperId: "303",
          title: "Multi Touch Interaction for Presentation Review",
          abstract: "Multi touch interaction helps reviewers inspect deck structure.",
          citationCount: 9,
          method: "multi touch interaction for presentation review",
        }),
      ],
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "ready",
        samplePaperIds: ["101", "202", "303"],
        generatedAt: "2026-06-01T00:00:00.000Z",
        paperScores: {
          "101": {
            defaultScore: 0.9,
            graphScore: 0.8,
            semanticScore: 0.2,
            sharedCiters: 4,
            sharedRefs: 2,
            seedCount: 2,
            sources: ["co_cited"],
          },
          "202": {
            defaultScore: 0.8,
            graphScore: 0.7,
            semanticScore: 0.1,
            sharedCiters: 3,
            sharedRefs: 1,
            seedCount: 2,
            sources: ["co_cited"],
          },
        },
      },
    });

    expect(mockedExecuteJudgment).toHaveBeenCalledTimes(1);
    const judgmentSpec = mockedExecuteJudgment.mock.calls[0][0];
    expect(judgmentSpec.prompt).toContain("method/contribution noun-phrase families");
    expect(judgmentSpec).toMatchObject({
      maxOutputTokens: 512,
      timeoutMs: 12_000,
      usageMetadata: {
        mode: "llm_compact",
        paperCount: 3,
        promptPaperLimit: 12,
        promptAbstractChars: 300,
      },
    });
    expect(judgmentSpec.usageMetadata?.promptChars).toBe(judgmentSpec.prompt.length);
    expect(candidates.map((candidate) => candidate.term)).not.toContain("verification");
    expect(candidates[0]).toMatchObject({
      term: "highlighting visualization",
      methodSupportCount: 2,
      graphSupportCount: 2,
    });
    expect(candidates[0]?.basis).toContain("첫 검색 결과의 라이브러리 그래프 근거");
    expect(candidates.map((candidate) => candidate.term)).toContain("multi touch interaction");
    expect(source).toBe("llm");
  });

  it("caps title and semantic profile fields in the compact prompt", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({ candidates: [] });

    const longTitle = `Title ${"T".repeat(420)}`;
    const longMethod = `method ${"M".repeat(420)}`;

    await buildEnglishTermCandidatesWithLLM({
      query: "prompt caps",
      papers: [
        paper({
          paperId: "long-1",
          title: longTitle,
          abstract: "compact abstract",
          method: longMethod,
        }),
      ],
    });

    const prompt = mockedExecuteJudgment.mock.calls[0][0].prompt;
    expect(prompt).toContain(`title: ${longTitle.slice(0, TERM_CANDIDATE_PROMPT_FIELD_CHARS)}`);
    expect(prompt).not.toContain(longTitle);
    expect(prompt).not.toContain("M".repeat(TERM_CANDIDATE_PROMPT_FIELD_CHARS + 1));
  });

  it("excludes legacy and whitespace-only inline analyses from prompts and method support", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "signal protocol",
          supportPaperIds: ["current", "legacy", "blank"],
          rationale: "supported protocol family",
        },
      ],
    });

    const { candidates } = await buildEnglishTermCandidatesWithLLM({
      query: "protocol discovery",
      papers: [
        paper({
          paperId: "current",
          title: "Current Signal Protocol",
          abstract: "A current abstract supports the method.",
          method: "current signal protocol",
        }),
        paper({
          paperId: "legacy",
          title: "Legacy Signal Protocol",
          abstract: "A legacy abstract must be reanalyzed.",
          method: "legacy signal protocol",
          inlineAnalysisVersion: INLINE_ANALYSIS_VERSION - 1,
        }),
        paper({
          paperId: "blank",
          title: "Blank Signal Protocol",
          abstract: " \n\t ",
          method: "blank signal protocol",
        }),
      ],
    });

    const prompt = mockedExecuteJudgment.mock.calls[0][0].prompt;
    expect(prompt).toContain("current signal protocol");
    expect(prompt).not.toContain("legacy signal protocol");
    expect(prompt).not.toContain("blank signal protocol");
    expect(candidates).toContainEqual(
      expect.objectContaining({ term: "signal protocol", methodSupportCount: 1 }),
    );
  });
});

describe("applyGraphSupportToEnglishTermCandidates", () => {
  it("does not describe whitespace-only abstracts as term evidence", () => {
    const candidates = applyGraphSupportToEnglishTermCandidates({
      papers: [
        paper({
          paperId: "blank-abstract",
          title: "Title Grounded Protocol",
          abstract: " \n\t ",
        }),
      ],
      candidates: [
        {
          term: "title grounded protocol",
          type: "narrower",
          confidence: "low",
          supportCount: 1,
          supportPaperIds: ["blank-abstract"],
          samplePaperIds: ["blank-abstract"],
          basis: "stale basis",
        },
      ],
    });

    expect(candidates[0]?.basis).toBe("제목에서 1편이 뒷받침합니다. 예: Title Grounded Protocol");
  });

  it("keeps graph evidence without inventing abstract or method evidence", () => {
    const candidates = applyGraphSupportToEnglishTermCandidates({
      papers: [
        paper({
          paperId: "blank-with-graph",
          title: "Graph Grounded Protocol",
          abstract: " \n\t ",
        }),
      ],
      candidates: [
        {
          term: "graph grounded protocol",
          type: "narrower",
          confidence: "low",
          supportCount: 1,
          supportPaperIds: ["blank-with-graph"],
          samplePaperIds: ["blank-with-graph"],
          basis: "stale basis",
        },
      ],
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "ready",
        samplePaperIds: ["blank-with-graph"],
        generatedAt: "2026-07-17T00:00:00.000Z",
        paperScores: {
          "blank-with-graph": {
            defaultScore: 0.9,
            graphScore: 0.8,
            semanticScore: 0.1,
            sharedCiters: 2,
            sharedRefs: 1,
            seedCount: 1,
            sources: ["co_cited"],
          },
        },
      },
    });

    expect(candidates[0]?.basis).toBe(
      "제목 + 첫 검색 결과의 라이브러리 그래프 근거에서 1편이 뒷받침합니다. 예: Graph Grounded Protocol",
    );
  });

  it("reorders existing LLM candidates with fixed first-payload graph support", () => {
    const candidates = applyGraphSupportToEnglishTermCandidates({
      papers: [
        paper({ paperId: "101", title: "Local Evaluation Protocol" }),
        paper({ paperId: "202", title: "Graph Backed Hypothesis Generation" }),
        paper({ paperId: "303", title: "Graph Backed Hypothesis Testing" }),
      ],
      candidates: [
        {
          term: "local evaluation protocol",
          type: "narrower",
          confidence: "medium",
          supportCount: 3,
          supportPaperIds: ["101"],
          samplePaperIds: ["101"],
          basis: "LLM candidate",
        },
        {
          term: "hypothesis generation workflows",
          type: "narrower",
          confidence: "medium",
          supportCount: 2,
          supportPaperIds: ["202", "303"],
          samplePaperIds: ["202", "303"],
          basis: "LLM candidate",
        },
      ],
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "ready",
        samplePaperIds: ["101", "202", "303"],
        generatedAt: "2026-06-01T00:00:00.000Z",
        paperScores: {
          "202": {
            defaultScore: 0.8,
            graphScore: 0.7,
            semanticScore: 0.1,
            sharedCiters: 3,
            sharedRefs: 1,
            seedCount: 2,
            sources: ["co_cited"],
          },
          "303": {
            defaultScore: 0.7,
            graphScore: 0.6,
            semanticScore: 0.1,
            sharedCiters: 2,
            sharedRefs: 1,
            seedCount: 2,
            sources: ["co_cited"],
          },
        },
      },
    });

    expect(candidates[0]).toMatchObject({
      term: "hypothesis generation workflows",
      graphSupportCount: 2,
    });
  });

  it("counts graph support from full support ids beyond the visible sample ids", () => {
    const candidates = applyGraphSupportToEnglishTermCandidates({
      papers: [101, 202, 303, 404].map((paperId) =>
        paper({ paperId: String(paperId), title: `Paper ${String(paperId)}` }),
      ),
      candidates: [
        {
          term: "graph supported workflows",
          type: "narrower",
          confidence: "medium",
          supportCount: 4,
          supportPaperIds: ["101", "202", "303", "404"],
          samplePaperIds: ["101", "202", "303"],
          basis: "LLM candidate",
        },
      ],
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "ready",
        samplePaperIds: ["101", "202", "303", "404"],
        generatedAt: "2026-06-01T00:00:00.000Z",
        paperScores: {
          "404": {
            defaultScore: 0.9,
            graphScore: 0.8,
            semanticScore: 0.1,
            sharedCiters: 4,
            sharedRefs: 1,
            seedCount: 2,
            sources: ["co_cited"],
          },
        },
      },
    });

    expect(candidates[0]).toMatchObject({
      term: "graph supported workflows",
      graphSupportCount: 1,
    });
  });
});

describe("buildEnglishTermCandidatesWithLLM filtering", () => {
  it("allows specific LLM phrases that contain broad ai-for-science tokens", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "retrieval augmented hypothesis generation",
          supportPaperIds: ["101", "202"],
          rationale: "specific method phrase",
        },
      ],
    });

    const { candidates } = await buildEnglishTermCandidatesWithLLM({
      query: "ai for science",
      papers: [
        paper({
          paperId: "101",
          title: "Retrieval Augmented Hypothesis Generation",
          abstract: "Retrieval augmented hypothesis generation supports scientific workflows.",
        }),
        paper({
          paperId: "202",
          title: "Hypothesis Generation with Retrieval",
          abstract: "The method uses retrieval augmented hypothesis generation.",
        }),
      ],
    });

    expect(candidates.map((candidate) => candidate.term)).toContain(
      "retrieval augmented hypothesis generation",
    );
  });

  it("returns no candidates when the loaded result set does not expose stable English terms", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "artificial intelligence",
          supportPaperIds: ["101", "202"],
          rationale: "too broad",
        },
        {
          term: "science",
          supportPaperIds: ["101", "202"],
          rationale: "too broad",
        },
      ],
    });

    const { candidates, source } = await buildEnglishTermCandidatesWithLLM({
      query: "ai for science",
      papers: [
        paper({
          paperId: "101",
          title: "AI for Science Agenda",
          abstract: "Artificial intelligence supports broad scientific research.",
        }),
        paper({
          paperId: "202",
          title: "Science and AI",
          abstract: "Science workflows use artificial intelligence.",
        }),
      ],
    });

    expect(source).toBe("llm");
    expect(candidates).toEqual([]);
  });

  it("rejects support ids outside the compact prompt window", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "out of window method",
          supportPaperIds: ["p13"],
          rationale: "not actually in prompt",
        },
      ],
    });

    const papers = Array.from({ length: 13 }, (_, index) =>
      paper({
        paperId: `p${String(index + 1)}`,
        title: `Prompt Window Paper ${String(index + 1)}`,
        abstract: "A compact prompt window should bound support ids.",
        method: "out of window method",
      }),
    );

    const { candidates } = await buildEnglishTermCandidatesWithLLM({
      query: "prompt window",
      papers,
    });

    expect(candidates).toEqual([]);
  });

  it("returns an empty llm result on timeout instead of building fallback terms", async () => {
    vi.useFakeTimers();
    mockedHasGeminiApiKey.mockReturnValue(true);
    // Real executeJudgment throws on an aborted signal; the bounded timeout aborts.
    mockedExecuteJudgment.mockImplementationOnce(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Judgment cancelled", "AbortError"));
          });
        }),
    );

    const candidatesPromise = buildEnglishTermCandidatesWithLLM({
      query: "에이전트 기억 논문",
      papers: [
        paper({
          paperId: "p1",
          title: "Workflow Memory for Large Language Models",
          abstract: "Long-term workflow memory improves retrieval for LLM agents.",
        }),
        paper({
          paperId: "p2",
          title: "Retrieval Augmented Generation with Workflow Memory",
          abstract: "Workflow memory supports retrieval decisions.",
        }),
      ],
    });
    await vi.runAllTimersAsync();
    const result = await candidatesPromise;
    vi.useRealTimers();

    expect(result.source).toBe("llm");
    expect(result.candidates).toEqual([]);
  });
});
