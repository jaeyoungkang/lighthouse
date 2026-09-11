import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { hasGeminiApiKey } from "@/app/server/ai-generation/gemini";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import {
  buildEnglishTermCandidatesWithLLM,
  runSearchTermDiscoveryOnMetadata,
  shouldRunSearchTermDiscovery,
} from "@/app/server/services/search-term-discovery";

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
  };
}

function searchMetadata(overrides: Partial<SearchMetadata>): SearchMetadata {
  return {
    type: "search",
    query: "slide accessibility",
    papers: [],
    total: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockedHasGeminiApiKey.mockReturnValue(false);
  mockedExecuteJudgment.mockReset();
});

describe("buildEnglishTermCandidatesWithLLM source reporting", () => {
  it("returns an empty llm result when no Gemini key is available", async () => {
    mockedHasGeminiApiKey.mockReturnValue(false);
    const result = await buildEnglishTermCandidatesWithLLM({
      query: "slide accessibility",
      papers: [
        paper({
          paperId: "101",
          title: "Highlighting Visualization for Slide Accessibility",
          abstract: "The paper uses highlighting visualization to expose inaccessible slides.",
        }),
        paper({
          paperId: "202",
          title: "Multi Touch Interaction for Slide Accessibility",
          abstract: "Multi touch interaction supports non-visual slide access.",
        }),
      ],
    });
    expect(result.source).toBe("llm");
    expect(result.candidates).toEqual([]);
    expect(mockedExecuteJudgment).not.toHaveBeenCalled();
  });

  it("repairs bracket-number support references back to the enumerated paperId", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    // The prompt enumerates samples as [1], [2]… and the model sometimes
    // echoes those numbers instead of copying the printed paperId values.
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "non-visual slide access",
          supportPaperIds: ["1", "2"],
          rationale: "method family",
        },
        {
          term: "multi touch interaction",
          // 3-digit value above the prompt-window length stays unresolvable.
          supportPaperIds: ["999"],
          rationale: "method family",
        },
      ],
    });

    const result = await buildEnglishTermCandidatesWithLLM({
      query: "slide accessibility",
      papers: [
        paper({
          paperId: "254854882",
          title: "Non-Visual Slide Access for Blind Readers",
          abstract: "Non-visual slide access supports blind readers.",
        }),
        paper({
          paperId: "204009154",
          title: "Improving Non-Visual Slide Access",
          abstract: "The method improves non-visual slide access.",
        }),
      ],
    });

    expect(result.source).toBe("llm");
    expect(result.candidates.map((candidate) => candidate.term)).toEqual([
      "non-visual slide access",
    ]);
    expect(result.candidates[0]?.supportPaperIds).toEqual(["254854882", "204009154"]);
  });

  it("reports the llm source with an empty list as an honest no-answer rather than degrading", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({ candidates: [] });
    const result = await buildEnglishTermCandidatesWithLLM({
      query: "slide accessibility",
      papers: [
        paper({
          paperId: "101",
          title: "Highlighting Visualization for Slide Accessibility",
          abstract: "The paper uses highlighting visualization to expose inaccessible slides.",
        }),
      ],
    });
    expect(result.source).toBe("llm");
    expect(result.candidates).toHaveLength(0);
  });
});

describe("shouldRunSearchTermDiscovery", () => {
  it("runs the initial phase only while discovery is pending", () => {
    expect(
      shouldRunSearchTermDiscovery(
        searchMetadata({ englishTermDiscovery: { status: "pending" } }),
        "initial",
      ),
    ).toBe(true);
    expect(
      shouldRunSearchTermDiscovery(
        searchMetadata({ englishTermDiscovery: { status: "ready", source: "llm" } }),
        "initial",
      ),
    ).toBe(false);
  });

  it("never runs for documents without discovery state", () => {
    expect(shouldRunSearchTermDiscovery(searchMetadata({}), "initial")).toBe(false);
  });
});

describe("runSearchTermDiscoveryOnMetadata", () => {
  it("closes discovery to a ready llm state when extraction succeeds", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({
      candidates: [
        {
          term: "non-visual slide access",
          supportPaperIds: ["101", "202"],
          rationale: "method family",
        },
      ],
    });

    const next = await runSearchTermDiscoveryOnMetadata({
      phase: "initial",
      metadata: searchMetadata({
        englishTermDiscovery: { status: "pending" },
        papers: [
          paper({
            paperId: "101",
            title: "Non-Visual Slide Access for Blind Readers",
            abstract: "Non-visual slide access supports blind readers.",
          }),
          paper({
            paperId: "202",
            title: "Improving Non-Visual Slide Access",
            abstract: "The method improves non-visual slide access.",
          }),
        ],
      }),
    });

    expect(next.englishTermDiscovery).toMatchObject({ status: "ready", source: "llm" });
    expect(next.englishTermCandidates?.map((candidate) => candidate.term)).toContain(
      "non-visual slide access",
    );
  });

  it("closes to an empty llm result when extraction fails", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockRejectedValueOnce(new Error("llm extraction failed"));

    const next = await runSearchTermDiscoveryOnMetadata({
      phase: "initial",
      metadata: searchMetadata({
        englishTermDiscovery: { status: "pending" },
        papers: [
          paper({
            paperId: "101",
            title: "Multi Touch Interaction for Slide Access",
            abstract: "Multi touch interaction supports slide access.",
          }),
        ],
      }),
    });

    expect(next.englishTermDiscovery).toMatchObject({
      status: "ready",
      source: "llm",
    });
    expect(next.englishTermCandidates).toEqual([]);
  });

  it("keeps the initial-phase honest no-answer when extraction surfaces nothing", async () => {
    mockedHasGeminiApiKey.mockReturnValue(true);
    mockedExecuteJudgment.mockResolvedValueOnce({ candidates: [] });

    const next = await runSearchTermDiscoveryOnMetadata({
      phase: "initial",
      metadata: searchMetadata({
        englishTermDiscovery: { status: "pending" },
        papers: [
          paper({
            paperId: "101",
            title: "Multi Touch Interaction for Slide Access",
            abstract: "Multi touch interaction supports slide access.",
          }),
        ],
      }),
    });

    expect(next.englishTermDiscovery).toMatchObject({ status: "ready", source: "llm" });
    expect(next.englishTermCandidates).toEqual([]);
  });
});
