import type { z } from "zod";
import {
  Episteme3BatchResponseSchema,
  Episteme3CitationPageSchema,
  Episteme3DiscoveryResponseSchema,
  Episteme3PaperCardSchema,
  Episteme3SearchResponseSchema,
} from "@/app/lib/episteme3-schemas";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { parseYearRangeFilter } from "@/app/domain/search-year-range";
import { AppError } from "@/app/lib/app-error";
import {
  isEpisteme3PaperRef,
  matchesEpistemePaperIdentity,
  toEpisteme3PaperRef,
} from "@/app/lib/episteme-paper-ref";
import {
  epistemeFetch,
  epistemePostFetch,
} from "@/app/server/external-http-gateway/literature-provider-fetch";
import { resolvePdfUrl } from "./pdf-url-resolver";
import type { MappedPaper } from "./search-service";
import { getEpistemeApiBaseUrl, getEpistemePublicBaseUrl } from "@/app/lib/episteme-config";
const CITATION_LINEAGE_MAX_PAPERS = 40;
const GRAPH_NEIGHBOR_MAX_PER_AXIS = 20;

type Episteme3Paper = z.infer<typeof Episteme3PaperCardSchema>;
type Episteme3CitationPage = z.infer<typeof Episteme3CitationPageSchema>;

/** E3 native namespace only. The retired unversioned E2 compatibility shim is never used. */
export function getEpistemeBaseUrl(): string {
  return getEpistemeApiBaseUrl();
}

export { getEpistemePublicBaseUrl };

/** Stored numeric S2 ids remain readable; all provider calls use E3 paper references. */
export { isEpisteme3PaperRef, toEpisteme3PaperRef };

function identifierValue(paper: Episteme3Paper, namespace: string): string | null {
  return (
    paper.identifiers.find((identifier) => identifier.namespace.toLowerCase() === namespace)
      ?.value ?? null
  );
}

function identifierMap(paper: Episteme3Paper): Record<string, string | number | null> {
  const names: Record<string, string> = {
    doi: "DOI",
    arxiv: "ArXiv",
    pmid: "PubMed",
    pmcid: "PubMedCentral",
    openalex: "OpenAlex",
    openalex_work_id: "OpenAlex",
    s2_corpus_id: "CorpusId",
  };
  return Object.fromEntries(
    paper.identifiers.map(({ namespace, value }) => [
      names[namespace.toLowerCase()] ?? namespace,
      value,
    ]),
  );
}

function buildPaperExternalUrl(paper: Episteme3Paper): string {
  const landing = paper.best_landing_page?.trim() || paper.access_url?.trim();
  if (landing) return landing;
  const doi = identifierValue(paper, "doi");
  if (doi) return `https://doi.org/${encodeURI(doi)}`;
  const arxiv = identifierValue(paper, "arxiv");
  if (arxiv) return `https://arxiv.org/abs/${encodeURIComponent(arxiv)}`;
  return `${getEpistemePublicBaseUrl()}/papers/${encodeURIComponent(paper.paper_uid)}`;
}

function paperIdForCard(paper: Episteme3Paper): string {
  // Preserve old saved/library joins for S2-backed records. E3-only records use the canonical uid.
  return identifierValue(paper, "s2_corpus_id") ?? paper.paper_uid;
}

export function mapEpisteme3Paper(paper: Episteme3Paper): MappedPaper {
  const externalIds = identifierMap(paper);
  const pdfUrl = paper.best_open_pdf?.trim() || resolvePdfUrl(null, externalIds);
  const limits = [...paper.omitted_fields];
  if (paper.currency.state === "partial") limits.push("partial_projection");
  return {
    paperId: paperIdForCard(paper),
    title: paper.title ?? "Untitled paper",
    abstract: paper.abstract ?? paper.abstract_snippet ?? null,
    year: paper.publication_year ?? null,
    venue: paper.venue?.name ?? paper.publication_venue ?? null,
    fieldsOfStudy: paper.fields_of_study.length > 0 ? paper.fields_of_study : null,
    citationCount: paper.citation_count,
    referenceCount: paper.reference_count,
    url: buildPaperExternalUrl(paper),
    authors: paper.authors
      .map((author) => author.name?.trim())
      .filter((name): name is string => Boolean(name)),
    openAccessPdf: pdfUrl ? { url: pdfUrl } : null,
    openAccess: {
      isOpenAccess: paper.has_open_access_location,
      pdfUrl: paper.best_open_pdf ?? null,
      landingUrl: paper.best_landing_page ?? paper.access_url ?? null,
      source: "episteme3",
    },
    source: {
      provider: "episteme3",
      baseCorpus: "multi_provider",
      sourceFlags: paper.source_memberships,
      freshnessMode: paper.currency.state === "current" ? "exact" : "configured",
      limits,
      canonicalPaperId: paper.paper_uid,
      generation: String(paper.currency.generation),
    },
    doi: identifierValue(paper, "doi"),
    externalIds,
    referenceIds: null,
    citationIds: null,
    referenceAvailability: {
      available: paper.reference_count === 0,
      truncated: paper.reference_count > 0,
      total: paper.reference_count,
      returned: 0,
      reason: paper.reference_count > 0 ? "lazy_fetch_required" : null,
    },
    citationAvailability: {
      available: paper.citation_count === 0,
      truncated: paper.citation_count > 0,
      total: paper.citation_count,
      returned: 0,
      reason: paper.citation_count > 0 ? "lazy_fetch_required" : null,
    },
  };
}

// Public adapter name retained for call-site stability; its input is the E3 PaperCard contract.
export const mapEpistemePaper = mapEpisteme3Paper;

export async function hydrateEpistemePapers(
  paperIds: Array<string | number>,
  signal?: AbortSignal,
): Promise<MappedPaper[]> {
  const refs = Array.from(new Set(paperIds.map(toEpisteme3PaperRef).filter(Boolean)));
  if (refs.length === 0) return [];
  const papers: MappedPaper[] = [];
  for (let index = 0; index < refs.length; index += 100) {
    const batch = refs.slice(index, index + 100);
    const res = await epistemePostFetch(
      `${getEpistemeBaseUrl()}/papers/batch`,
      { papers: batch, projection: "rich" },
      signal,
    );
    if (!res) throw new AppError("SEARCH_CONNECTION_FAILED");
    if (!res.ok) {
      if (res.status === 429) throw new AppError("SEARCH_RATE_LIMITED");
      throw new AppError("SEARCH_SERVER_ERROR", { status: res.status });
    }
    const parsed = Episteme3BatchResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.error("[Episteme3 Batch] Zod parse error:", parsed.error.issues);
      throw new AppError("SEARCH_PARSE_FAILED");
    }
    papers.push(...parsed.data.items.map(({ paper }) => mapEpisteme3Paper(paper)));
  }
  return papers;
}

function totalModeForRelation(
  relation: "exact" | "estimated" | "bounded" | "unavailable" | undefined,
): "exact" | "candidate_window" | "estimated" | "not_computed" {
  if (relation === "exact") return "exact";
  if (relation === "estimated") return "estimated";
  if (relation === "bounded") return "candidate_window";
  return "not_computed";
}

export async function fetchEpistemeSearchWindow(
  params: {
    query: string;
    limit: number;
    offset?: number;
    year?: string;
    sort?: string;
    hydrate?: boolean;
  },
  signal?: AbortSignal,
): Promise<{
  papers: MappedPaper[];
  total: number;
  paging?: SearchMetadata["paging"];
  source?: SearchMetadata["source"];
  totalMode?: SearchMetadata["totalMode"];
}> {
  const { query, limit, offset = 0, year, sort = "relevance", hydrate = true } = params;
  const { from, to } = parseYearRangeFilter(year);
  const filters =
    from != null || to != null
      ? {
          publication_year: {
            ...(from != null ? { gte: from } : {}),
            ...(to != null ? { lte: to } : {}),
          },
        }
      : {};
  const secondarySort =
    sort === "citationCount" ? "citations" : sort === "year" ? "year_desc" : "year_asc";
  const usesSecondarySort = sort === "citationCount" || sort === "year" || sort === "yearAsc";
  // E3 semantic/hybrid retrieval supports relevance only. Secondary sorts use
  // lexical membership so their order applies to the provider result set, not
  // merely the relevance window returned to Light House.
  const retrieval = usesSecondarySort ? "lexical" : "hybrid_rerank";
  const providerSort = usesSecondarySort ? secondarySort : "relevance";
  const res = await epistemePostFetch(
    `${getEpistemeBaseUrl()}/search/papers`,
    {
      query: { text: query, retrieval, text_membership: "adaptive" },
      filters,
      measurements: { total: { accuracy: "fast" } },
      page: { size: Math.min(100, Math.max(1, offset + limit)) },
      projection: hydrate ? "rich" : "standard",
      sort: providerSort,
    },
    signal,
  );
  if (!res) throw new AppError("SEARCH_CONNECTION_FAILED");
  if (!res.ok) {
    if (res.status === 429) throw new AppError("SEARCH_RATE_LIMITED");
    throw new AppError("SEARCH_SERVER_ERROR", { status: res.status });
  }
  const parsed = Episteme3SearchResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    console.error("[Episteme3 Search] Zod parse error:", parsed.error.issues);
    throw new AppError("SEARCH_PARSE_FAILED");
  }
  const items = parsed.data.items.slice(offset, offset + limit);
  let papers = items.map(mapEpisteme3Paper);
  if (hydrate && papers.length > 0 && items.some((item) => item.projection !== "rich")) {
    papers = await hydrateEpistemePapers(
      papers.map((paper) => paper.paperId),
      signal,
    );
  }
  const totalMode = totalModeForRelation(parsed.data.total?.relation);
  const total = parsed.data.total?.value ?? papers.length;
  const nextCursor = parsed.data.next_cursor ?? parsed.data.page.next_cursor ?? null;
  const limits = Array.from(
    new Set([
      ...parsed.data.completeness.incomplete_reasons,
      ...(parsed.data.total?.incomplete_reasons ?? []),
    ]),
  );
  return {
    papers,
    total,
    totalMode,
    paging: {
      limit,
      offset,
      returned: papers.length,
      total,
      totalMode,
      hasMore: nextCursor != null,
      nextOffset: nextCursor ? offset + papers.length : null,
      nextCursor,
    },
    source: {
      provider: "episteme3",
      baseCorpus: "multi_provider",
      freshnessMode:
        parsed.data.currency.state === "current"
          ? "exact"
          : parsed.data.currency.state === "missing"
            ? "unknown"
            : "configured",
      searchBasis: [retrieval],
      limits,
      generation: parsed.data.page.generation,
      completenessStatus: parsed.data.completeness.status,
      coverage: parsed.data.coverage.paper,
      totalCoverage: parsed.data.total?.coverage,
      currencyState: parsed.data.currency.state,
      retrievalGeneration: parsed.data.currency.retrieval_generation,
      projectionGenerations: parsed.data.currency.projection_generations,
      elapsedMs: parsed.data.elapsed_ms,
    },
  };
}

export async function lookupEpistemePaperByIdentifier(
  identifier: { doi?: string; arxivId?: string },
  signal?: AbortSignal,
): Promise<MappedPaper | null> {
  const ref = identifier.arxivId
    ? `arxiv:${identifier.arxivId}`
    : identifier.doi
      ? `doi:${identifier.doi}`
      : null;
  if (!ref) return null;
  const url = new URL(`${getEpistemeBaseUrl()}/papers/by-ref`);
  url.searchParams.set("ref", ref);
  url.searchParams.set("projection", "rich");
  const res = await epistemeFetch(url.toString(), signal);
  if (!res) throw new AppError("SEARCH_CONNECTION_FAILED");
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) {
    if (res.status === 429) throw new AppError("SEARCH_RATE_LIMITED");
    throw new AppError("SEARCH_SERVER_ERROR", { status: res.status });
  }
  const parsed = Episteme3PaperCardSchema.safeParse(await res.json());
  if (!parsed.success) throw new AppError("SEARCH_PARSE_FAILED");
  return mapEpisteme3Paper(parsed.data);
}

async function fetchCitationPage(params: {
  paperId: string;
  direction: "cites" | "cited_by";
  limit?: number;
  signal?: AbortSignal;
}): Promise<Episteme3CitationPage> {
  const url = new URL(`${getEpistemeBaseUrl()}/graph/citations`);
  url.searchParams.set("paper", toEpisteme3PaperRef(params.paperId));
  url.searchParams.set("direction", params.direction);
  url.searchParams.set("limit", String(params.limit ?? 20));
  url.searchParams.set("projection", "rich");
  const res = await epistemeFetch(url.toString(), params.signal);
  if (!res) throw new AppError("SEARCH_CONNECTION_FAILED");
  if (!res.ok) {
    if (res.status === 429) throw new AppError("SEARCH_RATE_LIMITED");
    throw new AppError("SEARCH_SERVER_ERROR", { status: res.status });
  }
  const parsed = Episteme3CitationPageSchema.safeParse(await res.json());
  if (!parsed.success) throw new AppError("SEARCH_PARSE_FAILED");
  return parsed.data;
}

function citationAvailability(
  page: Episteme3CitationPage,
  resolvedCount: number,
): NonNullable<PaperCore["citationAvailability"]> {
  const hasUnresolvedEdges = resolvedCount < page.items.length;
  return {
    available: page.completeness.status !== "unavailable",
    truncated:
      hasUnresolvedEdges || Boolean(page.next_cursor) || page.completeness.status !== "complete",
    total: page.total,
    returned: resolvedCount,
    reason:
      page.completeness.incomplete_reasons[0] ??
      (hasUnresolvedEdges ? "unresolved_paper_projection" : null),
  };
}

export async function lookupCitationLineageForPaper(seedPaper: PaperCore, signal?: AbortSignal) {
  const [referencesPage, citationsPage] = await Promise.all([
    fetchCitationPage({ paperId: seedPaper.paperId, direction: "cites", signal }),
    fetchCitationPage({ paperId: seedPaper.paperId, direction: "cited_by", signal }),
  ]);
  const references = referencesPage.items.flatMap(({ paper }) =>
    paper ? [mapEpisteme3Paper(paper)] : [],
  );
  const citations = citationsPage.items.flatMap(({ paper }) =>
    paper ? [mapEpisteme3Paper(paper)] : [],
  );
  const byId = new Map([...references, ...citations].map((paper) => [paper.paperId, paper]));
  return {
    seedPaper,
    papers: [...byId.values()].slice(0, CITATION_LINEAGE_MAX_PAPERS),
    referenceIds: references.map((paper) => paper.paperId),
    citationIds: citations.map((paper) => paper.paperId),
    referenceAvailability: citationAvailability(referencesPage, references.length),
    citationAvailability: citationAvailability(citationsPage, citations.length),
  };
}

export interface GraphNeighborEntry {
  paperId: string;
  shared: number;
}

export async function lookupGraphNeighborsForPaper(
  seedPaper: PaperCore,
  signal?: AbortSignal,
  options: { hydrate?: boolean } = {},
) {
  const res = await epistemePostFetch(
    `${getEpistemeBaseUrl()}/papers/discover`,
    {
      seeds: [toEpisteme3PaperRef(seedPaper.paperId)],
      exclude: [toEpisteme3PaperRef(seedPaper.paperId)],
      retrievers: ["co_citation", "bibliographic_coupling"],
      quality: "balanced",
      limit: GRAPH_NEIGHBOR_MAX_PER_AXIS * 2,
      projection: options.hydrate === false ? "standard" : "rich",
    },
    signal,
  );
  if (!res) throw new AppError("SEARCH_CONNECTION_FAILED");
  if (res.status === 429) throw new AppError("SEARCH_RATE_LIMITED");
  if (!res.ok) throw new AppError("SEARCH_SERVER_ERROR", { status: res.status });
  const parsed = Episteme3DiscoveryResponseSchema.safeParse(await res.json());
  if (!parsed.success) throw new AppError("SEARCH_PARSE_FAILED");
  if (parsed.data.completeness.status === "unavailable") {
    throw new AppError("SEARCH_SERVER_ERROR");
  }
  const mappedItems = parsed.data.items.map((item) => ({
    item,
    paper: mapEpisteme3Paper(item.paper),
  }));
  const papers = mappedItems
    .map(({ paper }) => paper)
    .filter((paper) => !matchesEpistemePaperIdentity(paper, seedPaper.paperId));
  const coCited: GraphNeighborEntry[] = [];
  const coupled: GraphNeighborEntry[] = [];
  mappedItems.forEach(({ item, paper }) => {
    const paperId = paper.paperId;
    if (!paperId || matchesEpistemePaperIdentity(paper, seedPaper.paperId)) return;
    for (const evidence of item.evidence) {
      const entry = { paperId, shared: evidence.raw_signal };
      if (evidence.retriever === "co_citation" && coCited.length < GRAPH_NEIGHBOR_MAX_PER_AXIS)
        coCited.push(entry);
      if (
        evidence.retriever === "bibliographic_coupling" &&
        coupled.length < GRAPH_NEIGHBOR_MAX_PER_AXIS
      )
        coupled.push(entry);
    }
  });
  const availability = (entries: GraphNeighborEntry[]) => ({
    available: entries.length > 0,
    truncated:
      entries.length >= GRAPH_NEIGHBOR_MAX_PER_AXIS ||
      parsed.data.completeness.status !== "complete",
    total: null,
    returned: entries.length,
    reason:
      entries.length === 0
        ? "no_graph_neighbors"
        : (parsed.data.completeness.incomplete_reasons[0] ?? null),
  });
  return {
    papers,
    coCited,
    coupled,
    coCitedAvailability: availability(coCited),
    coupledAvailability: availability(coupled),
  };
}
