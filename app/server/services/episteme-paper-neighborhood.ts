/** E3 provider-neutral multi-seed discovery adapter for library grounding. */
import { Episteme3DiscoveryResponseSchema } from "@/app/lib/episteme3-schemas";
import {
  isEpisteme3PaperRef,
  matchesEpistemePaperIdentity,
  toEpisteme3PaperRef,
} from "@/app/lib/episteme-paper-ref";
import { epistemePostFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import { getEpistemeBaseUrl, mapEpisteme3Paper } from "./episteme-literature";

export const PAPER_NEIGHBORHOOD_MAX_SEED_IDS = 25;
export const PAPER_NEIGHBORHOOD_MAX_EXCLUDE_IDS = 1_000;
export const PAPER_NEIGHBORHOOD_MAX_QUERY_CHARACTERS = 500;

function boundedDiscoveryQuery(query: string | undefined): string | undefined {
  if (!query) return undefined;
  return Array.from(query).slice(0, PAPER_NEIGHBORHOOD_MAX_QUERY_CHARACTERS).join("");
}

export interface LibraryNeighborhoodCandidate {
  corpusId: string;
  defaultScore: number;
  graphScore: number | null;
  semanticScore: number | null;
  sharedCiters: number | null;
  sharedRefs: number | null;
  seedCount: number | null;
  sources: string[];
  providerMetadata?: {
    graphGeneration: string;
    paperGeneration: string;
    fusionVersion: string;
    quality: "fast" | "balanced" | "thorough";
    completenessStatus: "complete" | "bounded" | "estimated" | "unavailable";
    incompleteReasons: string[];
    elapsedMs: number;
  };
}

export async function lookupPaperNeighborhood(params: {
  corpusIds: Array<string | number>;
  excludeCorpusIds?: Array<string | number>;
  excludeSeeds?: boolean;
  query?: string;
  limit: number;
  perSeedLimit?: number;
  signal?: AbortSignal;
}): Promise<LibraryNeighborhoodCandidate[] | null> {
  const seeds = normalizeRefs(params.corpusIds).slice(0, PAPER_NEIGHBORHOOD_MAX_SEED_IDS);
  if (seeds.length === 0) return null;
  const exclude = normalizeRefs(params.excludeCorpusIds ?? []);
  const query = boundedDiscoveryQuery(params.query);
  try {
    const res = await epistemePostFetch(
      `${getEpistemeBaseUrl()}/papers/discover`,
      {
        seeds,
        ...(exclude.length > 0
          ? {
              exclude: exclude.slice(0, PAPER_NEIGHBORHOOD_MAX_EXCLUDE_IDS),
            }
          : {}),
        ...(query ? { query } : {}),
        retrievers: ["co_citation", "bibliographic_coupling", "semantic"],
        quality: "balanced",
        limit: Math.min(100, params.limit),
        projection: "standard",
      },
      params.signal,
    );
    if (!res?.ok) return null;
    const parsed = Episteme3DiscoveryResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      console.error("[Episteme3 Discovery] Zod parse error:", parsed.error.issues);
      return null;
    }
    if (parsed.data.completeness.status === "unavailable") return null;
    return parsed.data.items.flatMap((item) => {
      const paper = mapEpisteme3Paper(item.paper);
      const paperId = paper.paperId;
      // The provider accepts at most 1,000 exclusions. Keep the full bounded
      // active-source set as a final privacy boundary for every library paper
      // that participated in this discovery request.
      if (exclude.some((paperRef) => matchesEpistemePaperIdentity(paper, paperRef))) return [];
      const coCitation = item.evidence.filter((e) => e.retriever === "co_citation");
      const coupling = item.evidence.filter((e) => e.retriever === "bibliographic_coupling");
      const semantic = item.evidence.filter((e) => e.retriever === "semantic");
      const max = (values: Array<number | null | undefined>) =>
        values.length > 0 ? Math.max(...values.map((value) => value ?? 0)) : null;
      return [
        {
          corpusId: paperId,
          defaultScore: item.fusion_score,
          graphScore: max([...coCitation, ...coupling].map((e) => e.normalized_signal)),
          semanticScore: max(semantic.map((e) => e.normalized_signal)),
          sharedCiters: max(coCitation.map((e) => e.raw_signal)),
          sharedRefs: max(coupling.map((e) => e.raw_signal)),
          seedCount: new Set(item.evidence.map((e) => e.seed_paper_uid).filter(Boolean)).size,
          sources: Array.from(new Set(item.evidence.map((e) => e.retriever))),
          providerMetadata: {
            graphGeneration: parsed.data.coverage.graph_generation,
            paperGeneration: parsed.data.coverage.paper_generation,
            fusionVersion: parsed.data.fusion.version,
            quality: parsed.data.fusion.quality,
            completenessStatus: parsed.data.completeness.status,
            incompleteReasons: Array.from(
              new Set([
                ...parsed.data.completeness.incomplete_reasons,
                ...(parsed.data.coverage.incomplete_reasons ?? []),
              ]),
            ),
            elapsedMs: parsed.data.elapsed_ms,
          },
        },
      ];
    });
  } catch (error) {
    console.error("[Episteme3 Discovery] request failed:", error);
    return null;
  }
}

function normalizeRefs(ids: Array<string | number>): string[] {
  return Array.from(
    new Set(
      ids
        .map(toEpisteme3PaperRef)
        .filter((paperRef) => isEpisteme3PaperRef(paperRef) && !/^s2:0+$/u.test(paperRef)),
    ),
  );
}
