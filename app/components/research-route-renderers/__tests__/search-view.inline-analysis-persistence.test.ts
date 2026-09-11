import { afterEach, describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { persistInlineAnalysis } from "@/app/components/research/background-inline-analysis";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const analysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["one", "two"],
  semanticProfile: {
    claim: "objective",
    topics: ["one", "two"],
    method: "methodology",
    finding: "results",
    quotedBasis: {
      claim: "objective evidence",
      topics: ["one", "two"],
      method: "method evidence",
      finding: "result evidence",
    },
  },
  confidence: "high",
  evidenceMap: {},
};
const inputFingerprint = "a".repeat(64);

function buildCurrentMetadata(): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: 1,
    papers: [
      {
        paperId: "paper-current",
        title: "Current Paper",
        abstract: "current abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/current",
        authors: [{ name: "Current Author" }],
      },
    ],
  };
}

function setCurrentSearchView(
  metadata: SearchMetadata = buildCurrentMetadata(),
  executionId = "test-execution:51",
): void {
  useResearchRouteStore.getState().setCurrentView(
    {
      status: "ready",
      version: 0,
      reactionVersion: 0,
      id: "doc-1",
      type: "search",
      title: "검색: agent memory",
      content: "",
      createdBy: "user",
      metadata,
      reaction: null,
      refs: [],
      ownerPrincipalId: "principal-1",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:10:00.000Z",
    },
    executionId,
  );
}

function analyzedPapers(metadata: SearchMetadata): SearchMetadata["papers"] {
  return metadata.papers.map((paper) => ({
    ...paper,
    inlineAnalysis: {
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint,
      analysis,
      source: "abstract" as const,
    },
  }));
}

afterEach(() => {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
});

describe("search-view inline analysis persistence", () => {
  it("does not persist inline analysis when the expected cycle no longer matches", async () => {
    setCurrentSearchView();
    const staleTaskPapers: SearchMetadata["papers"] = [
      {
        paperId: "paper-current",
        title: "Stale Current Paper",
        abstract: "stale abstract",
        year: 2020,
        citationCount: 1,
        url: "https://example.com/stale-current",
        authors: [{ name: "Stale Author" }],
        inlineAnalysis: {
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint,
          analysis,
          source: "abstract",
        },
      },
    ];

    await expect(
      persistInlineAnalysis(
        "doc-1",
        staleTaskPapers,
        "doc-1:stale-cycle:paper-current",
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      ),
    ).resolves.toBeNull();

    const metadata = useResearchRouteStore.getState().currentView?.metadata;
    expect(metadata?.type).toBe("search");
    if (metadata?.type !== "search") {
      throw new Error("expected search metadata");
    }
    const firstPaper = metadata.papers[0];
    expect("inlineAnalysis" in firstPaper).toBe(false);
  });

  it("does not persist without the expected active document and execution", async () => {
    const metadata = buildCurrentMetadata();
    const papers = analyzedPapers(metadata);

    await expect(
      persistInlineAnalysis("doc-1", papers, undefined, "test-execution:51"),
    ).resolves.toBeNull();

    setCurrentSearchView(metadata);
    await expect(
      persistInlineAnalysis("other-doc", papers, undefined, "test-execution:51"),
    ).resolves.toBeNull();
    await expect(
      persistInlineAnalysis("doc-1", papers, undefined, "stale-execution"),
    ).resolves.toBeNull();
  });

  it("persists only a matching cycle and matching paper input", async () => {
    const metadata = buildCurrentMetadata();
    setCurrentSearchView(metadata);
    const cycleKey = buildInlineAnalysisCycleKey("doc-1", metadata);

    const updated = await persistInlineAnalysis(
      "doc-1",
      analyzedPapers(metadata),
      cycleKey,
      "test-execution:51",
    );

    expect(updated?.metadata.type).toBe("search");
    if (updated?.metadata.type !== "search") {
      throw new Error("expected persisted search metadata");
    }
    expect(updated.updatedAt).toBe("2026-07-04T00:10:00.001Z");
    expect(updated.metadata).toMatchObject({
      query: metadata.query,
      total: metadata.total,
    });
    const persistedPaper = updated.metadata.papers[0];
    expect("inlineAnalysis" in persistedPaper ? persistedPaper.inlineAnalysis : undefined).toEqual({
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint,
      analysis,
      source: "abstract",
    });
    expect(useResearchRouteStore.getState().currentView).toEqual(updated);
  });

  it("drops analysis produced from a changed paper input", async () => {
    const metadata = buildCurrentMetadata();
    setCurrentSearchView(metadata);
    const changedPapers = analyzedPapers({
      ...metadata,
      papers: metadata.papers.map((paper) => ({ ...paper, abstract: "changed abstract" })),
    });

    const updated = await persistInlineAnalysis(
      "doc-1",
      changedPapers,
      buildInlineAnalysisCycleKey("doc-1", metadata),
      "test-execution:51",
    );

    expect(updated?.metadata.type).toBe("search");
    if (updated?.metadata.type !== "search") {
      throw new Error("expected persisted search metadata");
    }
    expect(updated.metadata.papers[0]).not.toHaveProperty("inlineAnalysis");
  });
});
