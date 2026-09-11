import type {
  ResearchRoutePayload,
  ResearchRouteKind,
  EnglishTermCandidateType,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { t } from "@/app/i18n/message-access";
import { getCurrentUsableInlineAnalysisRecord } from "@/app/lib/inline-analysis";

type SearchPresentationMetadata = Extract<ResearchRoutePayload["metadata"], { type: "search" }>;

export interface SearchResultsOverviewYearBucket {
  year: number;
  count: number;
}

export interface SearchResultsOverviewTerm {
  term: string;
  candidateType: EnglishTermCandidateType;
  supportCount: number;
  methodSupportCount?: number;
  graphSupportCount?: number;
}

export interface SearchResultsOverviewSection {
  id: string;
  label: string;
  kind?: "generic" | "year_distribution" | "research_terms";
  summary?: string;
  buckets?: SearchResultsOverviewYearBucket[];
  terms?: SearchResultsOverviewTerm[];
  /** background 추출이 아직 닫히지 않아 목록 대신 추출 중 안내를 보여줄 때. */
  pendingText?: string;
}

export interface SearchResultsOverviewBlock {
  documentType: ResearchRouteKind;
  title: string;
  sections: SearchResultsOverviewSection[];
}

interface SearchResultsOverviewStrategy {
  buildLeadBlock: (document: ResearchRoutePayload) => SearchResultsOverviewBlock | null;
}

const NULL_SEARCH_RESULTS_OVERVIEW: SearchResultsOverviewStrategy = {
  buildLeadBlock: () => null,
};

function isSearchMetadata(
  metadata: ResearchRoutePayload["metadata"],
): metadata is SearchPresentationMetadata {
  return metadata.type === "search";
}

function buildYearDistribution(
  metadata: SearchPresentationMetadata,
): SearchResultsOverviewYearBucket[] {
  const counts = metadata.papers.reduce((yearCounts, paper) => {
    if (typeof paper.year !== "number") return yearCounts;
    yearCounts.set(paper.year, (yearCounts.get(paper.year) ?? 0) + 1);
    return yearCounts;
  }, new Map<number, number>());

  if (counts.size === 0) return [];

  // Render a continuous year axis so the distribution always fills the available
  // width and the time spacing stays honest: years between the earliest and latest
  // result with no papers are kept as zero-count buckets instead of being skipped.
  const years = Array.from(counts.keys());
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const buckets: SearchResultsOverviewYearBucket[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    buckets.push({ year, count: counts.get(year) ?? 0 });
  }
  return buckets;
}

export function buildSearchResultsOverviewBlockFromMetadata(
  metadata: SearchPresentationMetadata,
): SearchResultsOverviewBlock | null {
  const yearDistribution = buildYearDistribution(metadata);
  const terms = (metadata.englishTermCandidates ?? []).slice(0, 6).map((candidate) => ({
    term: candidate.term,
    candidateType: candidate.type,
    supportCount: candidate.supportCount,
    methodSupportCount: candidate.methodSupportCount,
    graphSupportCount: candidate.graphSupportCount,
  }));
  const termDiscovery = metadata.englishTermDiscovery;
  const termsPending = termDiscovery?.status === "pending";

  if (yearDistribution.length === 0 && terms.length === 0 && !termsPending) {
    return null;
  }

  return {
    documentType: "search",
    title: t("surface.label.agent-panel.searchOverview.title"),
    sections: [
      ...(yearDistribution.length > 0
        ? [
            {
              id: "year-distribution",
              kind: "year_distribution" as const,
              label: t("surface.label.agent-panel.searchOverview.yearDistribution.title"),
              summary: t("surface.label.agent-panel.searchOverview.yearDistribution.summary", {
                count: metadata.papers.length,
              }),
              buckets: yearDistribution,
            },
          ]
        : []),
      {
        id: "research-terms",
        kind: "research_terms" as const,
        label: t("surface.label.agent-panel.searchOverview.researchTerms.title"),
        ...(termsPending
          ? {
              pendingText: t("surface.label.agent-panel.searchOverview.researchTerms.extracting"),
            }
          : {}),
        terms,
      },
    ],
  };
}

const SEARCH_RESULTS_OVERVIEW: SearchResultsOverviewStrategy = {
  buildLeadBlock: (document) => {
    if (document.type !== "search" || !isSearchMetadata(document.metadata)) return null;
    return buildSearchResultsOverviewBlockFromMetadata(document.metadata);
  },
};

function normalizeRelationshipTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

const BROAD_RELATIONSHIP_RESEARCH_TERM_BLOCKLIST = new Set([
  "artificial intelligence",
  "large language models",
  "research",
  "scientific research",
  "science",
  "study",
  "studies",
  "methods",
  "models",
  "systems",
  "learning",
  "discovery",
  "evaluation",
]);

function tokenizeRelationshipTerm(term: string): string[] {
  return normalizeRelationshipTerm(term)
    .split(/[^a-z0-9+.-]+/g)
    .filter((token) => token.length > 0);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function hasQuotedBasis(candidate: string, basis: string | readonly string[] | null): boolean {
  const bases: readonly string[] = isStringArray(basis) ? basis : basis ? [basis] : [];
  const normalizedCandidate = normalizeRelationshipTerm(candidate);
  return bases.some((entry) => normalizeRelationshipTerm(entry).includes(normalizedCandidate));
}

function isGroundedRelationshipResearchTerm(term: string, sourceTitleTokens: Set<string>): boolean {
  const normalized = normalizeRelationshipTerm(term);
  if (!/^[a-z0-9][a-z0-9 /+.-]*[a-z0-9]$/i.test(normalized)) return false;
  if (BROAD_RELATIONSHIP_RESEARCH_TERM_BLOCKLIST.has(normalized)) return false;
  const wordCount = normalized.split(/\s+/g).filter(Boolean).length;
  if (wordCount < 2 || wordCount > 5 || normalized.length > 48) return false;
  const tokens = tokenizeRelationshipTerm(normalized);
  return !tokens.every((token) => sourceTitleTokens.has(token));
}

export function buildRelationshipResearchTermsBlock(params: {
  documentType: Extract<ResearchRouteKind, "citation_lineage" | "graph_neighbors">;
  papers: readonly PaperCore[];
}): SearchResultsOverviewBlock | null {
  const supportByTerm = new Map<string, { term: string; paperIds: Set<string> }>();
  const sourceTitleTokens = new Set(tokenizeRelationshipTerm(params.papers[0]?.title ?? ""));

  for (const paper of params.papers) {
    const semanticProfile = getCurrentUsableInlineAnalysisRecord(paper)?.analysis.semanticProfile;
    if (!semanticProfile) continue;
    const candidates = [
      ...semanticProfile.topics.filter((topic) =>
        hasQuotedBasis(topic, semanticProfile.quotedBasis.topics),
      ),
      hasQuotedBasis(semanticProfile.method ?? "", semanticProfile.quotedBasis.method)
        ? semanticProfile.method
        : null,
      hasQuotedBasis(semanticProfile.finding ?? "", semanticProfile.quotedBasis.finding)
        ? semanticProfile.finding
        : null,
    ].filter((term): term is string => typeof term === "string" && term.trim().length > 0);

    for (const candidate of candidates) {
      const normalized = normalizeRelationshipTerm(candidate);
      if (!isGroundedRelationshipResearchTerm(normalized, sourceTitleTokens)) continue;
      const existing = supportByTerm.get(normalized) ?? {
        term: normalized,
        paperIds: new Set<string>(),
      };
      existing.paperIds.add(paper.paperId);
      supportByTerm.set(normalized, existing);
    }
  }

  const terms = [...supportByTerm.values()]
    .map((entry) => ({
      term: entry.term,
      candidateType: "direct" as const,
      supportCount: entry.paperIds.size,
    }))
    .sort((left, right) => {
      if (left.supportCount !== right.supportCount) return right.supportCount - left.supportCount;
      return left.term.localeCompare(right.term);
    })
    .slice(0, 6);

  if (terms.length === 0) return null;

  return {
    documentType: params.documentType,
    title: t("surface.label.agent-panel.searchOverview.title"),
    sections: [
      {
        id: "research-terms",
        kind: "research_terms",
        label: t("surface.label.agent-panel.searchOverview.researchTerms.title"),
        terms,
      },
    ],
  };
}

export const SEARCH_RESULTS_OVERVIEW_REGISTRY = {
  search: SEARCH_RESULTS_OVERVIEW,
  gap_network: NULL_SEARCH_RESULTS_OVERVIEW,
  citation_lineage: NULL_SEARCH_RESULTS_OVERVIEW,
  graph_neighbors: NULL_SEARCH_RESULTS_OVERVIEW,
} satisfies Record<ResearchRouteKind, SearchResultsOverviewStrategy>;

export function buildSearchResultsOverviewBlock(
  document: ResearchRoutePayload | undefined,
): SearchResultsOverviewBlock | null {
  if (!document) {
    return null;
  }

  return SEARCH_RESULTS_OVERVIEW_REGISTRY[document.type].buildLeadBlock(document);
}
