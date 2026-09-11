import { describe, expect, it } from "vitest";
import type { ViewSnapshot } from "@/app/domain/view-snapshot";
import {
  buildViewSnapshotProjectionKey,
  buildViewSnapshotPromptContext,
} from "@/app/domain/view-snapshot";

describe("buildViewSnapshotProjectionKey", () => {
  it("is stable regardless of object insertion order", () => {
    const result = {
      id: "paper-1",
      title: "Paper 1",
      year: 2024,
      citationCount: 12,
    };
    const canonicalOrder = {
      snapshotId: "search-view",
      snapshotKind: "search",
      title: "Search results",
      content: {
        kind: "search",
        query: "graph retrieval",
        total: 1,
        results: [result],
      },
    } satisfies ViewSnapshot;
    const reverseOrder = {
      content: {
        results: [{ citationCount: 12, year: 2024, title: "Paper 1", id: "paper-1" }],
        total: 1,
        query: "graph retrieval",
        kind: "search",
      },
      title: "Search results",
      snapshotKind: "search",
      snapshotId: "search-view",
    } satisfies ViewSnapshot;

    expect(buildViewSnapshotProjectionKey(reverseOrder)).toBe(
      buildViewSnapshotProjectionKey(canonicalOrder),
    );
  });
});

describe("buildViewSnapshotPromptContext", () => {
  it("renders explicit fallbacks for sparse search and source metadata", () => {
    const snapshot: ViewSnapshot = {
      snapshotId: "search-sparse",
      snapshotKind: "search",
      title: "Sparse search",
      content: {
        kind: "search",
        query: "sparse metadata",
        total: 1,
        seedPaper: { id: "seed", title: "Seed", year: null, authors: [] },
        libraryContext: {
          signalPresent: true,
          folders: [],
        },
        results: [{ id: "paper-1", title: "Result", year: null, citationCount: 0 }],
        source: {
          paging: {},
        },
      },
    };

    const context = buildViewSnapshotPromptContext(snapshot);

    expect(context).toContain("sort: default");
    expect(context).toContain("yearFilter: none");
    expect(context).toContain("seed: Seed | year unknown | unknown authors");
    expect(context).toContain(
      "library_context: collections=unknown; anchorPaperCount=unknown; libraryOnlyPaperCount=unknown",
    );
    expect(context).toContain(
      "paging: limit=unknown, offset=unknown, returned=unknown, totalMode=unknown",
    );
    expect(context).toContain("Result | year unknown | citations=0");
  });

  it("preserves citation availability so missing provider lists are not prompt-level absence", () => {
    const snapshot: ViewSnapshot = {
      snapshotId: "citation-1",
      snapshotKind: "citation_lineage",
      title: "Citation lineage",
      content: {
        kind: "citation_lineage",
        seedPaper: { id: "seed", title: "Seed Paper", year: 2024, authors: ["Ada"] },
        total: 0,
        referenceCount: 0,
        citationCount: 0,
        references: [],
        citations: [],
        referenceAvailability: {
          available: false,
          truncated: false,
          returned: 0,
          total: null,
          reason: "provider did not return references",
        },
        citationAvailability: {
          available: true,
          truncated: false,
          returned: 0,
          total: 0,
          reason: "",
        },
        source: {
          provider: "Moonlight Search",
          limits: ["references may be unavailable for this provider result"],
        },
      },
    };

    const context = buildViewSnapshotPromptContext(snapshot);

    expect(context).toContain("references: 0");
    expect(context).toContain(
      "referenceAvailability: available=false, truncated=false, returned=0, reason=provider did not return references",
    );
    expect(context).toContain(
      "citationAvailability: available=true, truncated=false, returned=0, total=0, reason=",
    );
    expect(context).toContain("limit: references may be unavailable for this provider result");
  });

  it("preserves graph-neighbor availability and relation types separately from direct citation lineage", () => {
    const snapshot: ViewSnapshot = {
      snapshotId: "graph-1",
      snapshotKind: "graph_neighbors",
      title: "Similar papers",
      content: {
        kind: "graph_neighbors",
        seedPaper: { id: "seed", title: "Seed Paper", year: 2024, authors: ["Ada"] },
        total: 1,
        coCitedCount: 1,
        coupledCount: 0,
        coCited: [
          {
            id: "co-1",
            title: "Co-cited Paper",
            year: 2025,
            authors: ["Grace"],
            relation: "co_cited",
            shared: 3,
          },
        ],
        coupled: [],
        coCitedAvailability: {
          available: true,
          truncated: true,
          returned: 1,
          total: 12,
          reason: "page limited",
        },
        coupledAvailability: null,
      },
    };

    const context = buildViewSnapshotPromptContext(snapshot);

    expect(context).toContain(
      "coCitedAvailability: available=true, truncated=true, returned=1, total=12, reason=page limited",
    );
    expect(context).toContain("coupledAvailability: unknown");
    expect(context).toContain("co_cited | Co-cited Paper");
    expect(context).toContain("shared=3");
    expect(context).not.toContain("reference | co-1");
    expect(context).not.toContain("citation | co-1");
  });

  it("renders the complete gap-network basis", () => {
    const snapshot: ViewSnapshot = {
      snapshotId: "gap-1",
      snapshotKind: "gap_network",
      title: "Research gaps",
      content: {
        kind: "gap_network",
        query: "research agents",
        summary: "Two clusters have weak cross-citation.",
        metrics: {
          clusterCount: 2,
          totalPaperCount: 12,
          totalEdgeCount: 4,
          gapPairCount: 1,
        },
        topGapPairs: [{ id: "gap-1", label: "Agents ↔ Evaluation", rank: 1, gapScore: 0.8 }],
        hypotheses: [
          { id: "hypothesis-1", title: "Evaluate agents longitudinally", confidence: "high" },
        ],
      },
    };

    const context = buildViewSnapshotPromptContext(snapshot);

    expect(context).toContain("query: research agents");
    expect(context).toContain("metrics: clusters=2, papers=12, edges=4, gaps=1");
    expect(context).toContain("summary: Two clusters have weak cross-citation.");
    expect(context).toContain("- gap-1 | Agents ↔ Evaluation | rank=1 | score=0.8");
    expect(context).toContain("- hypothesis-1 | Evaluate agents longitudinally | high");
  });

  it("renders stable gap-network fallbacks when optional analysis is absent", () => {
    const snapshot: ViewSnapshot = {
      snapshotId: "gap-empty",
      snapshotKind: "gap_network",
      title: "Research gaps",
      content: { kind: "gap_network" },
    };

    expect(buildViewSnapshotPromptContext(snapshot)).toContain(
      "query: unknown\nmetrics: unknown\nsummary: none\ntop_gap_pairs:\nhypotheses:",
    );
  });
});
