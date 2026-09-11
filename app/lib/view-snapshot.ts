// @promise promise:reaction-from-visible-snapshot
// @promise promise:citation-lineage
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:citation-lineage-ai-reaction-with-followup-gap-surface

import type {
  CitationLineageMetadata,
  ResearchRoutePayload,
  GraphNeighborPaperEntry,
  GraphNeighborsMetadata,
  PaperWithReviewStatus,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import {
  buildViewSnapshotProjectionKey,
  CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION,
  MAX_CITATION_LINEAGE_EVIDENCE_SNIPPET_CHARS,
  viewSnapshotSchema,
  type ViewSnapshot,
} from "@/app/domain/view-snapshot";
import { SEARCH_REACTION_INPUT_PAPER_LIMIT } from "@/app/lib/constants";
import { buildSearchResultPapers } from "@/app/lib/search-result-projection";

const MAX_SNAPSHOT_PAPERS = 20;

function truncate(value: string | undefined | null, maxLength: number): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength).trimEnd();
}

function paperSnapshot(paper: PaperCore | PaperWithReviewStatus) {
  return {
    id: truncate(paper.paperId, 160) ?? "unknown-paper",
    title: truncate(paper.title, 300) ?? "(untitled)",
    year: paper.year,
    authors: paper.authors
      .map((author) => author.name)
      .filter(Boolean)
      .slice(0, 6),
  };
}

function evidenceSnippet(value: string | undefined | null): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.slice(0, MAX_CITATION_LINEAGE_EVIDENCE_SNIPPET_CHARS).trimEnd();
}

function citationEvidencePaperSnapshot(paper: PaperCore | PaperWithReviewStatus) {
  return {
    ...paperSnapshot(paper),
    evidenceSnippet: evidenceSnippet(paper.abstract),
  };
}

function searchPaperSnapshot(paper: PaperCore | PaperWithReviewStatus) {
  return {
    id: truncate(paper.paperId, 160) ?? "unknown-paper",
    title: truncate(paper.title, 300) ?? "(untitled)",
    year: paper.year,
    citationCount: paper.citationCount,
  };
}

function sourceSnapshot(
  metadata: SearchMetadata | CitationLineageMetadata | GraphNeighborsMetadata,
) {
  const source = "source" in metadata ? metadata.source : undefined;
  const paging = "paging" in metadata ? metadata.paging : undefined;
  const limits = source?.limits?.map((limit) => truncate(limit, 240)).filter(Boolean) as
    | string[]
    | undefined;

  if (!source && !paging) {
    return undefined;
  }

  return {
    provider: truncate(source?.provider, 120),
    baseCorpus: truncate(source?.baseCorpus, 160),
    limits,
    paging: paging
      ? {
          limit: paging.limit,
          offset: paging.offset,
          returned: paging.returned,
          totalMode: paging.totalMode,
        }
      : undefined,
  };
}

function libraryContextSnapshot(metadata: SearchMetadata) {
  const libraryContext = metadata.libraryContext;
  if (!libraryContext) return undefined;

  return {
    signalPresent: libraryContext.signalPresent,
    folders: libraryContext.folders
      .map((folder) => ({ name: truncate(folder.name, 80) ?? "untitled collection" }))
      .slice(0, 8),
    anchorPaperCount: libraryContext.anchorPaperCount,
    libraryOnlyPaperCount: libraryContext.libraryOnlyPaperIds?.length,
  };
}

function buildSearchViewSnapshot(document: ResearchRoutePayload): ViewSnapshot | null {
  if (document.type !== "search") return null;
  const metadata = document.metadata;
  const resultPapers = buildSearchResultPapers({ metadata });

  return {
    snapshotId: document.id,
    snapshotKind: "search",
    title: document.title,
    content: {
      kind: "search",
      query: metadata.query,
      sort: metadata.sortOption,
      yearFilter: metadata.yearFilter,
      total: resultPapers.length,
      totalMode: "candidate_window",
      seedPaper: metadata.seedPaper ? paperSnapshot(metadata.seedPaper) : undefined,
      libraryContext: libraryContextSnapshot(metadata),
      results: resultPapers.slice(0, SEARCH_REACTION_INPUT_PAPER_LIMIT).map(searchPaperSnapshot),
      source: sourceSnapshot(metadata),
    },
  };
}

function relationshipPaperSnapshot(
  entry: PaperCore | PaperWithReviewStatus | GraphNeighborPaperEntry,
  relation: "reference" | "citation" | "co_cited" | "coupled",
) {
  if ("paper" in entry) {
    return {
      ...paperSnapshot(entry.paper),
      relation,
      shared: entry.shared,
    };
  }

  return {
    ...paperSnapshot(entry),
    relation,
  };
}

function citationRelationshipPaperSnapshot(
  paper: PaperCore | PaperWithReviewStatus,
  relation: "reference" | "citation",
) {
  return {
    ...citationEvidencePaperSnapshot(paper),
    relation,
  };
}

function buildCitationLineageViewSnapshot(document: ResearchRoutePayload): ViewSnapshot | null {
  if (document.type !== "citation_lineage") {
    return null;
  }
  const metadata = document.metadata;
  const referenceIds = new Set(metadata.referenceIds);
  const citationIds = new Set(metadata.citationIds);
  const references = metadata.papers.filter((paper) => referenceIds.has(paper.paperId));
  const citations = metadata.papers.filter((paper) => citationIds.has(paper.paperId));

  return {
    snapshotId: document.id,
    snapshotKind: "citation_lineage",
    title: document.title,
    content: {
      kind: "citation_lineage",
      seedPaper: citationEvidencePaperSnapshot(metadata.seedPaper),
      total: metadata.total,
      referenceCount: metadata.referenceIds.length,
      citationCount: metadata.citationIds.length,
      references: references
        .slice(0, CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION)
        .map((paper) => citationRelationshipPaperSnapshot(paper, "reference")),
      citations: citations
        .slice(0, CITATION_LINEAGE_EVIDENCE_PAPERS_PER_DIRECTION)
        .map((paper) => citationRelationshipPaperSnapshot(paper, "citation")),
      referenceAvailability: metadata.referenceAvailability,
      citationAvailability: metadata.citationAvailability,
      source: sourceSnapshot(metadata),
    },
  };
}

function buildGraphNeighborsViewSnapshot(document: ResearchRoutePayload): ViewSnapshot | null {
  if (document.type !== "graph_neighbors") {
    return null;
  }
  const metadata = document.metadata;
  return {
    snapshotId: document.id,
    snapshotKind: "graph_neighbors",
    title: document.title,
    content: {
      kind: "graph_neighbors",
      seedPaper: paperSnapshot(metadata.seedPaper),
      total: metadata.total,
      coCitedCount: metadata.coCited.length,
      coupledCount: metadata.coupled.length,
      coCited: metadata.coCited
        .slice(0, MAX_SNAPSHOT_PAPERS)
        .map((entry) => relationshipPaperSnapshot(entry, "co_cited")),
      coupled: metadata.coupled
        .slice(0, MAX_SNAPSHOT_PAPERS)
        .map((entry) => relationshipPaperSnapshot(entry, "coupled")),
      coCitedAvailability: metadata.coCitedAvailability,
      coupledAvailability: metadata.coupledAvailability,
      source: sourceSnapshot(metadata),
    },
  };
}

function buildGapNetworkViewSnapshot(document: ResearchRoutePayload): ViewSnapshot | null {
  if (document.type !== "gap_network") return null;
  const metadata = document.metadata;
  const report = metadata.gapNetworkReport;

  return {
    snapshotId: document.id,
    snapshotKind: "gap_network",
    title: document.title,
    content: {
      kind: "gap_network",
      query: metadata.query,
      summary: truncate(document.content, 4000) ?? report.contentNarrative?.overview,
      metrics: report.metrics,
      topGapPairs: report.gapPairs.slice(0, 10).map((gapPair) => ({
        id: gapPair.id,
        label: gapPair.displayLabel,
        rank: gapPair.rank,
        gapScore: gapPair.gapScore,
      })),
      hypotheses: report.insight.hypotheses.slice(0, 10).map((hypothesis) => ({
        id: hypothesis.id,
        title: hypothesis.title,
        confidence: hypothesis.confidence,
      })),
    },
  };
}

export function buildViewSnapshot(
  document: ResearchRoutePayload | null | undefined,
): ViewSnapshot | null {
  if (!document) return null;
  const snapshot =
    document.type === "search"
      ? buildSearchViewSnapshot(document)
      : document.type === "citation_lineage"
        ? buildCitationLineageViewSnapshot(document)
        : document.type === "graph_neighbors"
          ? buildGraphNeighborsViewSnapshot(document)
          : buildGapNetworkViewSnapshot(document);
  if (!snapshot) return null;
  const parsed = viewSnapshotSchema.safeParse(snapshot);
  return parsed.success ? parsed.data : null;
}

export function buildEphemeralRouteAiCommentProjectionKey(
  document: ResearchRoutePayload | null | undefined,
): string | null {
  const snapshot = buildViewSnapshot(document);
  if (!snapshot || snapshot.snapshotKind === "gap_network") return null;
  return buildViewSnapshotProjectionKey(snapshot);
}
