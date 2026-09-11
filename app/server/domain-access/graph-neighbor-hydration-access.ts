import type { GraphNeighborsMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { hasSameInlineAnalysisInput } from "@/app/lib/inline-analysis";
import {
  getEpistemePaperIdentityAliases,
  getReviewedAtForEpistemePaper,
  indexByEpistemePaperIdentity,
  lookupByEpistemePaperIdentity,
} from "@/app/lib/episteme-paper-ref";
import { requireOwnerPrincipalAuth, type AuthContext } from "@/app/server/auth/identity";
import { getReviewedStatus } from "@/app/server/repository/reviewed-papers";
import { hydrateEpistemePapers } from "@/app/server/services/episteme-literature";
import type { MappedPaper } from "@/app/server/services/search-service";

export interface GraphNeighborHydrationInput {
  metadata: GraphNeighborsMetadata;
}

export interface GraphNeighborHydrationResult {
  metadata: GraphNeighborsMetadata;
  updatedAt: string;
}

function toCorpusIds(metadata: GraphNeighborsMetadata): string[] {
  return metadata.papers
    .map((paper) => paper.paperId)
    .filter((paperId) => /^\d+$/.test(paperId) || /^pap_/i.test(paperId));
}

function applyMappedPaper(
  existingPaper: GraphNeighborsMetadata["papers"][number],
  mappedPaper: MappedPaper | undefined,
  reviewedAt?: Date,
): GraphNeighborsMetadata["papers"][number] {
  const reviewed = reviewedAt != null || ("reviewed" in existingPaper && existingPaper.reviewed);
  const existingReviewedAt =
    "reviewedAt" in existingPaper && typeof existingPaper.reviewedAt === "string"
      ? existingPaper.reviewedAt
      : undefined;
  const reviewedAtValue = reviewedAt?.toISOString() ?? existingReviewedAt;
  if (!mappedPaper) {
    return {
      ...existingPaper,
      reviewed,
      ...(reviewedAtValue ? { reviewedAt: reviewedAtValue } : {}),
    };
  }

  const hydratedPaper = {
    ...existingPaper,
    // Relationship entries join this paper by the lightweight snapshot id.
    // Preserve that carrier even when E3 resolves it through another alias.
    paperId: existingPaper.paperId,
    title: mappedPaper.title,
    abstract: mappedPaper.abstract,
    year: mappedPaper.year,
    venue: mappedPaper.venue ?? null,
    fieldsOfStudy: mappedPaper.fieldsOfStudy ?? null,
    citationCount: mappedPaper.citationCount,
    referenceCount: mappedPaper.referenceCount ?? null,
    url: mappedPaper.url,
    authors: mappedPaper.authors.map((name) => ({ name })),
    openAccessPdf: mappedPaper.openAccessPdf ?? null,
    openAccess: mappedPaper.openAccess ?? null,
    source: mappedPaper.source ?? null,
    doi: mappedPaper.doi ?? null,
    externalIds: mappedPaper.externalIds ?? null,
    referenceIds: mappedPaper.referenceIds ?? null,
    citationIds: mappedPaper.citationIds ?? null,
    referenceAvailability: mappedPaper.referenceAvailability ?? null,
    citationAvailability: mappedPaper.citationAvailability ?? null,
    reviewed,
    ...(reviewedAtValue ? { reviewedAt: reviewedAtValue } : {}),
  };
  if (
    hasSameInlineAnalysisInput(existingPaper, hydratedPaper) ||
    !("inlineAnalysis" in hydratedPaper)
  ) {
    return hydratedPaper;
  }

  const paperWithoutInlineAnalysis = { ...hydratedPaper };
  Reflect.deleteProperty(paperWithoutInlineAnalysis, "inlineAnalysis");
  return paperWithoutInlineAnalysis;
}

function buildPaperMap(papers: GraphNeighborsMetadata["papers"]): Map<string, PaperCore> {
  return new Map(papers.map((paper) => [paper.paperId, paper]));
}

export async function hydrateGraphNeighborSnapshot(
  input: GraphNeighborHydrationInput,
  signal?: AbortSignal,
  authContext?: AuthContext,
): Promise<GraphNeighborHydrationResult> {
  const { db, user } = authContext ?? (await requireOwnerPrincipalAuth());
  const metadata = input.metadata;
  if (metadata.cardDataHydration?.status !== "pending") {
    return { metadata, updatedAt: new Date().toISOString() };
  }

  const corpusIds = toCorpusIds(metadata);
  const hydratedPapers = await hydrateEpistemePapers(corpusIds, signal);
  const hydratedById = indexByEpistemePaperIdentity(hydratedPapers);
  const reviewedPaperRefs = Array.from(
    new Set([
      ...metadata.papers.flatMap((paper) => getEpistemePaperIdentityAliases(paper)),
      ...hydratedPapers.flatMap((paper) => getEpistemePaperIdentityAliases(paper)),
    ]),
  );
  const reviewedMap = await getReviewedStatus(db, user.id, reviewedPaperRefs);
  const papers = metadata.papers.map((paper) => {
    const hydrated = lookupByEpistemePaperIdentity(hydratedById, paper.paperId);
    return applyMappedPaper(
      paper,
      hydrated,
      getReviewedAtForEpistemePaper(hydrated ?? paper, reviewedMap),
    );
  });
  const paperById = buildPaperMap(papers);
  const hydrateEntry = (entry: GraphNeighborsMetadata["coCited"][number]) => ({
    ...entry,
    paper: paperById.get(entry.paper.paperId) ?? entry.paper,
  });

  return {
    metadata: {
      ...metadata,
      papers,
      total: papers.length,
      coCited: metadata.coCited.map(hydrateEntry),
      coupled: metadata.coupled.map(hydrateEntry),
      cardDataHydration: { status: "ready" },
    },
    updatedAt: new Date().toISOString(),
  };
}
