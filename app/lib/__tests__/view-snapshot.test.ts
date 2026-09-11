import { describe, expect, it } from "vitest";
import { buildViewSnapshot } from "@/app/lib/view-snapshot";
import {
  buildViewSnapshotProjectionKey,
  buildViewSnapshotPromptContext,
} from "@/app/domain/view-snapshot";
import { researchRoutePayloadSchema } from "@/app/domain/research-route-payload-schema";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";

function paper(index: number): PaperCore {
  const suffix = String(index);
  return {
    paperId: `paper-${suffix}`,
    title: `Paper ${suffix}`,
    abstract: null,
    url: `https://example.test/paper-${suffix}`,
    authors: [{ name: `Author ${suffix}` }],
    year: 2020 + index,
    citationCount: index,
  };
}

function requireSnapshot(
  view: ResearchRoutePayload,
): NonNullable<ReturnType<typeof buildViewSnapshot>> {
  const snapshot = buildViewSnapshot(view);
  if (!snapshot) throw new Error("expected view snapshot");
  return snapshot;
}

function searchView(
  metadata: Partial<SearchMetadata> = {},
): Extract<ResearchRoutePayload, { type: "search" }> {
  const papers = Array.from({ length: 21 }, (_, index) => paper(index + 1));

  return {
    id: "search-view",
    type: "search",
    status: "ready",
    title: "Search results",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "user-1",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "graph retrieval",
      sortOption: "relevance",
      papers,
      total: 100,
      totalMode: "candidate_window",
      ...metadata,
    },
  };
}

function oversizedGraphView(): ResearchRoutePayload {
  const relationshipPapers = Array.from({ length: 40 }, (_, index) => {
    const id = `paper-${String(index)}-${"i".repeat(140)}`;
    return {
      paperId: id,
      title: "T".repeat(300),
      abstract: null,
      url: `https://example.test/${String(index)}`,
      authors: Array.from({ length: 6 }, (_, authorIndex) => ({
        name: `${String(authorIndex)}${"A".repeat(79)}`,
      })),
      year: 2024,
      citationCount: index,
    } satisfies PaperCore;
  });

  return {
    id: "oversized-graph-view",
    type: "graph_neighbors",
    status: "ready",
    title: "Citation lineage",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "user-1",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:00.000Z",
    metadata: {
      type: "graph_neighbors",
      seedPaper: paper(1),
      papers: relationshipPapers,
      total: relationshipPapers.length,
      coCited: relationshipPapers.slice(0, 20).map((item) => ({ paper: item, shared: 4 })),
      coupled: relationshipPapers.slice(20).map((item) => ({ paper: item, shared: 2 })),
    },
  };
}

describe("buildViewSnapshot", () => {
  it("uses the prompt-relevant ViewSnapshot projection as the exact reaction basis", () => {
    const initialView = searchView();
    const initialSnapshot = requireSnapshot(initialView);
    const uiOnlySnapshot = requireSnapshot({
      ...initialView,
      version: 1,
      updatedAt: "2026-07-07T00:01:00.000Z",
      metadata: {
        ...initialView.metadata,
        papers: initialView.metadata.papers.map((result) => ({
          ...result,
          analysis: {
            method: "method",
            result: "result",
            limitation: "limitation",
            quote: "quote",
          },
        })),
      },
    });
    const changedBasisSnapshot = requireSnapshot(
      searchView({
        sortOption: "interest",
      }),
    );

    expect(buildViewSnapshotProjectionKey(uiOnlySnapshot)).toBe(
      buildViewSnapshotProjectionKey(initialSnapshot),
    );
    expect(buildViewSnapshotProjectionKey(changedBasisSnapshot)).not.toBe(
      buildViewSnapshotProjectionKey(initialSnapshot),
    );
  });

  it("keeps background-hydrated card details outside the search reaction basis", () => {
    const initialView = searchView({
      papers: [
        {
          ...paper(1),
          abstract: null,
          authors: [],
          venue: null,
          fieldsOfStudy: null,
          openAccessPdf: null,
        },
      ],
      total: 1,
    });
    const hydratedView = searchView({
      papers: [
        {
          ...paper(1),
          abstract: "Hydrated abstract",
          authors: [{ name: "Hydrated Author" }],
          venue: "Hydrated Venue",
          fieldsOfStudy: ["Computer Science"],
          openAccessPdf: { url: "https://example.test/paper-1.pdf" },
        },
      ],
      total: 1,
      abstractHydration: { status: "ready" },
    });

    const initialSnapshot = requireSnapshot(initialView);
    const hydratedSnapshot = requireSnapshot(hydratedView);

    expect(buildViewSnapshotProjectionKey(hydratedSnapshot)).toBe(
      buildViewSnapshotProjectionKey(initialSnapshot),
    );
    const prompt = buildViewSnapshotPromptContext(hydratedSnapshot);
    expect(prompt).toContain("Paper 1 | 2021 | citations=1");
    expect(prompt).not.toContain("Hydrated Author");
  });

  it("uses the canonical transport projection as the reaction basis", () => {
    const paddedSnapshot = requireSnapshot(searchView({ query: "  graph retrieval  " }));
    const canonicalSnapshot = requireSnapshot(searchView({ query: "graph retrieval" }));

    expect(buildViewSnapshotProjectionKey(paddedSnapshot)).toBe(
      buildViewSnapshotProjectionKey(canonicalSnapshot),
    );
  });

  it("fails closed without throwing when a valid route payload exceeds snapshot bounds", () => {
    const view = oversizedGraphView();

    expect(researchRoutePayloadSchema.safeParse(view).success).toBe(true);
    expect(() => buildViewSnapshot(view)).not.toThrow();
    expect(buildViewSnapshot(view)).toBeNull();
  });

  it("fails closed when a search snapshot contains a negative citation count", () => {
    const view = searchView({
      papers: [
        {
          ...paper(1),
          citationCount: -1,
        },
      ],
    });

    expect(researchRoutePayloadSchema.safeParse(view).success).toBe(true);
    expect(() => buildViewSnapshot(view)).not.toThrow();
    expect(buildViewSnapshot(view)).toBeNull();
  });

  it("sorts search snapshot results by interest before the reaction input cap", () => {
    const view = searchView({
      sortOption: "interest",
      libraryContext: {
        signalPresent: true,
        folders: [{ name: "Retrieval" }],
        interestWeights: { "paper-21": 100, "paper-20": 90 },
        rankingMode: "combined_score",
        libraryOnlyPaperIds: ["paper-21"],
      },
    });

    const snapshot = buildViewSnapshot(view);

    expect(snapshot?.snapshotKind).toBe("search");
    expect(snapshot?.content.kind).toBe("search");
    if (snapshot?.content.kind !== "search") throw new Error("expected search snapshot");
    expect(snapshot.content.results).toHaveLength(20);
    expect(snapshot.content.results[0]?.id).toBe("paper-21");
    expect(snapshot.content.results[1]?.id).toBe("paper-20");
    expect(snapshot.content.results.map((result) => result.id)).not.toContain("paper-19");
  });

  it("builds the search reaction snapshot from the loaded facet projection", () => {
    const papers = [
      { ...paper(1), fieldsOfStudy: ["Computer Science"] },
      { ...paper(2), fieldsOfStudy: ["Medicine"] },
      { ...paper(3), fieldsOfStudy: ["Computer Science"] },
    ];
    const snapshot = requireSnapshot(
      searchView({
        papers,
        total: papers.length,
        facetFilters: {
          fieldsOfStudy: ["Computer Science"],
          authors: [],
          venues: [],
          hasPdf: false,
        },
      }),
    );

    if (snapshot.content.kind !== "search") throw new Error("expected search snapshot");
    expect(snapshot.content.total).toBe(2);
    expect(snapshot.content.results.map((result) => result.id)).toEqual(["paper-1", "paper-3"]);
  });

  it("includes library-grounded context in the search snapshot prompt only when a signal is present", () => {
    const groundedSnapshot = requireSnapshot(
      searchView({
        sortOption: "interest",
        libraryContext: {
          signalPresent: true,
          folders: [{ name: "Graph Reading" }, { name: "Search Notes" }],
          interestWeights: { "paper-2": 2 },
          libraryOnlyPaperIds: ["paper-2"],
          anchorPaperCount: 7,
        },
      }),
    );
    const ungroundedSnapshot = requireSnapshot(searchView());

    const groundedPrompt = buildViewSnapshotPromptContext(groundedSnapshot);
    const ungroundedPrompt = buildViewSnapshotPromptContext(ungroundedSnapshot);

    expect(groundedPrompt).toContain("library_context: collections=Graph Reading, Search Notes");
    expect(groundedPrompt).toContain("anchorPaperCount=7");
    expect(groundedPrompt).toContain("libraryOnlyPaperCount=1");
    expect(ungroundedPrompt).not.toContain("library_context:");
  });

  it("formats search snapshot result counts without provider totals", () => {
    const snapshot = requireSnapshot(
      searchView({
        total: 100,
        totalMode: "estimated",
      }),
    );

    const prompt = buildViewSnapshotPromptContext(snapshot);

    expect(prompt).toContain("loaded_results_in_snapshot: 20");
    expect(prompt).not.toContain("total: 100");
    expect(prompt).not.toContain("100 (estimated)");
  });

  it("includes seed paper context for similar-paper search snapshots", () => {
    const snapshot = requireSnapshot(
      searchView({
        seedPaper: {
          paperId: "seed-1",
          title: "Seed Paper",
          abstract: null,
          url: "https://example.test/seed-1",
          authors: [{ name: "Seed Author" }],
          year: 2024,
          citationCount: 12,
        },
      }),
    );

    const prompt = buildViewSnapshotPromptContext(snapshot);

    expect(prompt).toContain("seed: Seed Paper | 2024 | Seed Author");
    expect(prompt).not.toContain("seed: seed-1 |");
  });
});

describe("buildViewSnapshot edge projections", () => {
  it("normalizes sparse paper, source, paging, and collection fields", () => {
    const sparsePaper = {
      ...paper(1),
      paperId: "   ",
      title: "   ",
      authors: [{ name: "" }, { name: "Named Author" }],
      year: null,
    };
    const snapshot = requireSnapshot(
      searchView({
        papers: [sparsePaper],
        total: 1,
        source: {
          provider: "  Episteme  ",
          baseCorpus: "  OpenAlex  ",
          limits: ["  first limit  ", "   "],
        },
        paging: {
          limit: 20,
          offset: 0,
          returned: 1,
          totalMode: "exact",
          total: 1,
          hasMore: false,
        },
        libraryContext: {
          signalPresent: true,
          folders: [{ name: "   " }],
          interestWeights: {},
        },
      }),
    );

    if (snapshot.content.kind !== "search") throw new Error("expected search snapshot");
    expect(snapshot.content.results[0]).toMatchObject({
      id: "unknown-paper",
      title: "(untitled)",
      year: null,
    });
    expect(snapshot.content.libraryContext?.folders).toEqual([{ name: "untitled collection" }]);
    expect(snapshot.content.source).toEqual({
      provider: "Episteme",
      baseCorpus: "OpenAlex",
      limits: ["first limit"],
      paging: { limit: 20, offset: 0, returned: 1, totalMode: "exact" },
    });
  });

  it("returns null for absent and unsupported route documents", () => {
    expect(buildViewSnapshot(null)).toBeNull();
    expect(buildViewSnapshot(undefined)).toBeNull();
    expect(
      buildViewSnapshot({
        ...searchView(),
        type: "unsupported",
      } as unknown as ResearchRoutePayload),
    ).toBeNull();
  });
});

describe("buildViewSnapshot relationship prompts", () => {
  it("includes citation availability limits in the route-view snapshot prompt", () => {
    const citationView = {
      id: "citation-view",
      type: "citation_lineage",
      status: "ready",
      title: "Citation lineage",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "user-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
      metadata: {
        type: "citation_lineage",
        seedPaper: {
          ...paper(1),
          abstract: "  Seed method combines\nattention with translation.  ",
        },
        papers: [
          { ...paper(2), abstract: "A recurrent baseline for translation." },
          { ...paper(3), abstract: "Attention is extended to vision tasks." },
        ],
        referenceIds: ["paper-2"],
        citationIds: ["paper-3"],
        total: 2,
        referenceAvailability: {
          available: false,
          truncated: true,
          returned: 1,
          total: 25,
          reason: "provider_page_limit",
        },
        citationAvailability: {
          available: true,
          truncated: false,
          returned: 0,
          total: 0,
        },
      },
    } satisfies ResearchRoutePayload;

    const snapshot = requireSnapshot(citationView);

    const prompt = buildViewSnapshotPromptContext(snapshot);
    expect(prompt).toContain(
      "referenceAvailability: available=false, truncated=true, returned=1, total=25, reason=provider_page_limit",
    );
    expect(prompt).toContain(
      "citationAvailability: available=true, truncated=false, returned=0, total=0",
    );
    expect(prompt).toContain("reference | Paper 2 | 2022 | Author 2");
    expect(prompt).toContain("seed_evidence: Seed method combines attention with translation.");
    expect(prompt).toContain("evidence=A recurrent baseline for translation.");
    expect(prompt).toContain("evidence=Attention is extended to vision tasks.");
  });

  it("marks missing citation evidence as unavailable instead of inferring from metadata", () => {
    const citationView = {
      id: "citation-view-without-evidence",
      type: "citation_lineage",
      status: "ready",
      title: "Citation lineage",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "user-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      metadata: {
        type: "citation_lineage",
        seedPaper: paper(1),
        papers: [paper(2), paper(3)],
        referenceIds: ["paper-2"],
        citationIds: ["paper-3"],
        total: 2,
      },
    } satisfies ResearchRoutePayload;

    const prompt = buildViewSnapshotPromptContext(requireSnapshot(citationView));

    expect(prompt).toContain("seed_evidence: unavailable");
    expect(prompt.match(/evidence=unavailable/g)).toHaveLength(2);
  });

  it("keeps hydrated graph-neighbor authors in the relationship prompt", () => {
    const graphPaper = paper(2);
    const graphView = {
      id: "graph-view",
      type: "graph_neighbors",
      status: "ready",
      title: "Similar papers",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "user-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
      metadata: {
        type: "graph_neighbors",
        seedPaper: paper(1),
        papers: [graphPaper],
        total: 1,
        coCited: [{ paper: graphPaper, shared: 4 }],
        coupled: [],
        cardDataHydration: { status: "ready" },
      },
    } satisfies ResearchRoutePayload;

    const prompt = buildViewSnapshotPromptContext(requireSnapshot(graphView));

    expect(prompt).toContain("co_cited | Paper 2 | 2022 | Author 2 | shared=4");
  });

  it("projects coupled graph neighbors", () => {
    const graphPaper = paper(2);
    const graphView = {
      id: "graph-coupled",
      type: "graph_neighbors",
      status: "ready",
      title: "Similar papers",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "user-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
      metadata: {
        type: "graph_neighbors",
        seedPaper: paper(1),
        papers: [graphPaper],
        total: 1,
        coCited: [],
        coupled: [{ paper: graphPaper, shared: 2 }],
      },
    } satisfies ResearchRoutePayload;

    const snapshot = requireSnapshot(graphView);
    const prompt = buildViewSnapshotPromptContext(snapshot);

    expect(prompt).toContain("coupled | Paper 2 | 2022 | Author 2 | shared=2");
  });

  it("projects gap pairs and hypotheses from a gap-network route", () => {
    const gapView = {
      id: "gap-view",
      type: "gap_network",
      status: "ready",
      title: "Research gaps",
      content: "  Stored overview  ",
      createdBy: "user",
      refs: ["search-view"],
      viewerPrincipalId: "user-1",
      version: 1,
      reactionVersion: 0,
      reaction: null,
      reactionHistory: [],
      createdAt: "2026-07-07T00:00:00.000Z",
      updatedAt: "2026-07-07T00:00:00.000Z",
      metadata: {
        type: "gap_network",
        version: 1,
        sourceSnapshotId: "search-view",
        query: "research agents",
        papers: [paper(1)],
        gapNetworkReport: {
          clusters: [],
          conceptEdges: [],
          gapPairs: [
            {
              id: "gap-1",
              leftClusterId: "cluster-1",
              rightClusterId: "cluster-2",
              leftLabel: "Agents",
              rightLabel: "Evaluation",
              displayLabel: "Agents ↔ Evaluation",
              observed: 1,
              expected: 4,
              gapScore: 0.75,
              rank: 1,
              bridgeConcepts: [],
              leftConcepts: [],
              rightConcepts: [],
            },
          ],
          metrics: { clusterCount: 2, totalPaperCount: 1, totalEdgeCount: 1, gapPairCount: 1 },
          insight: {
            hypotheses: [
              {
                id: "hypothesis-1",
                gapPairId: "gap-1",
                title: "Longitudinal agent evaluation",
                description: "description",
                sourceConcept: "agents",
                targetConcept: "evaluation",
                confidence: "medium",
              },
            ],
          },
        },
      },
    } satisfies ResearchRoutePayload;

    const snapshot = requireSnapshot(gapView);

    expect(snapshot.content).toMatchObject({
      kind: "gap_network",
      query: "research agents",
      summary: "Stored overview",
      topGapPairs: [{ id: "gap-1", label: "Agents ↔ Evaluation", rank: 1, gapScore: 0.75 }],
      hypotheses: [
        { id: "hypothesis-1", title: "Longitudinal agent evaluation", confidence: "medium" },
      ],
    });
  });
});

describe("buildViewSnapshot citation evidence projection", () => {
  it("bounds and balances citation evidence while keeping it in the canonical projection", () => {
    const referencePapers = Array.from({ length: 5 }, (_, index) => ({
      ...paper(index + 2),
      abstract:
        index === 0 ? `  ${"R".repeat(650)}\n trailing  ` : `reference evidence ${String(index)}`,
    }));
    const citationPapers = Array.from({ length: 5 }, (_, index) => ({
      ...paper(index + 10),
      abstract: `citation evidence ${String(index)}`,
    }));
    const view = {
      id: "citation-evidence-view",
      type: "citation_lineage",
      status: "ready",
      title: "Citation evidence",
      content: "",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "user-1",
      version: 0,
      reactionVersion: 0,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      metadata: {
        type: "citation_lineage",
        seedPaper: { ...paper(1), abstract: "seed evidence" },
        papers: [...referencePapers, ...citationPapers],
        referenceIds: referencePapers.map((item) => item.paperId),
        citationIds: citationPapers.map((item) => item.paperId),
        total: 10,
      },
    } satisfies ResearchRoutePayload;

    const snapshot = requireSnapshot(view);
    if (snapshot.content.kind !== "citation_lineage") {
      throw new Error("expected citation lineage snapshot");
    }

    expect(snapshot.content.references).toHaveLength(3);
    expect(snapshot.content.citations).toHaveLength(3);
    expect(snapshot.content.references[0]?.evidenceSnippet).toHaveLength(600);
    expect(snapshot.content.references.map((item) => item.id)).not.toContain("paper-5");
    expect(snapshot.content.citations.map((item) => item.id)).not.toContain("paper-13");

    const changedView = {
      ...view,
      metadata: {
        ...view.metadata,
        papers: view.metadata.papers.map((item) =>
          item.paperId === "paper-2" ? { ...item, abstract: "changed reference evidence" } : item,
        ),
      },
    } satisfies ResearchRoutePayload;

    expect(buildViewSnapshotProjectionKey(requireSnapshot(changedView))).not.toBe(
      buildViewSnapshotProjectionKey(snapshot),
    );
  });
});
