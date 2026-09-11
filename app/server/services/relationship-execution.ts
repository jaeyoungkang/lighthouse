// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:first-paint-persistence-independence
// @aspect aspect:search-first-url-model

import type {
  CitationLineageResearchRoutePayload,
  CitationLineageMetadata,
  CreateResearchRoutePayloadParams,
  GraphNeighborsResearchRoutePayload,
  GraphNeighborsMetadata,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { isEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import {
  buildEphemeralCitationLineageViewId,
  buildEphemeralGraphNeighborsViewId,
} from "@/app/server/services/ephemeral-view-id";
import {
  buildCitationLineageViewPayload,
  buildGraphNeighborPayloadFromLookup,
  buildGraphNeighborsViewPayload,
  lookupCitationLineageForPaper,
  lookupGraphNeighborsForPaper,
} from "@/app/server/services/search-service";
import {
  searchParamsFromRecord,
  validateSearchConditionUrl,
  type SearchConditionRouteKind,
  type SearchConditionUrlValidation,
} from "@/app/lib/search-condition-url-budget";

export interface RelationshipSeedUrlParams {
  seed?: string | string[];
  seedPaperId?: string | string[];
  seedPaperTitle?: string | string[];
  seedPaperYear?: string | string[];
  seedPaperUrl?: string | string[];
  seedPaperCitations?: string | string[];
}

export interface RelationshipSeedInput {
  canonicalKey: string;
  seedPaper: PaperCore;
}

export interface RelationshipExecutionResult {
  view: ResearchRoutePayload;
  executed: boolean;
  failed: boolean;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildCanonicalRelationshipKey(seedPaper: PaperCore): string {
  const params = new URLSearchParams();
  params.set("seedPaperId", seedPaper.paperId);
  params.set("seedPaperTitle", seedPaper.title);
  if (seedPaper.year != null) params.set("seedPaperYear", String(seedPaper.year));
  if (seedPaper.url) params.set("seedPaperUrl", seedPaper.url);
  params.set("seedPaperCitations", String(seedPaper.citationCount));
  return params.toString();
}

export function buildRelationshipSeedFromUrlParams(
  routeKind: Exclude<SearchConditionRouteKind, "search">,
  params: RelationshipSeedUrlParams,
): RelationshipSeedInput | null {
  if (!validateRelationshipSeedUrlParams(routeKind, params).ok) return null;
  const seedPaperId = (firstParam(params.seedPaperId) ?? firstParam(params.seed) ?? "").trim();
  if (!seedPaperId) return null;

  const seedPaperTitle = (firstParam(params.seedPaperTitle) ?? seedPaperId).trim();
  const seedPaperYear = parseOptionalNumber(firstParam(params.seedPaperYear));
  const seedPaperCitations = parseOptionalNumber(firstParam(params.seedPaperCitations));
  const seedPaper: PaperCore = {
    paperId: seedPaperId,
    title: seedPaperTitle || seedPaperId,
    abstract: null,
    year: seedPaperYear,
    citationCount: seedPaperCitations ?? 0,
    url: firstParam(params.seedPaperUrl) ?? "",
    authors: [],
  };
  return {
    seedPaper,
    canonicalKey: buildCanonicalRelationshipKey(seedPaper),
  };
}

export function validateRelationshipSeedUrlParams(
  routeKind: Exclude<SearchConditionRouteKind, "search">,
  params: RelationshipSeedUrlParams,
): SearchConditionUrlValidation {
  return validateSearchConditionUrl(routeKind, searchParamsFromRecord(routeKind, params));
}

type RelationshipRouteKind = "citation_lineage" | "graph_neighbors";

type RelationshipCreatePayload<Kind extends RelationshipRouteKind> = Extract<
  CreateResearchRoutePayloadParams,
  { type: Kind }
>;

type RelationshipViewPayload<Kind extends RelationshipRouteKind> = Extract<
  ResearchRoutePayload,
  { type: Kind }
>;

export type RelationshipViewBuildParams<
  Kind extends RelationshipRouteKind = RelationshipRouteKind,
> = Kind extends RelationshipRouteKind
  ? {
      id: string;
      payload: RelationshipCreatePayload<Kind>;
      status: ResearchRoutePayload["status"];
    }
  : never;

export function buildRelationshipViewFromPayload(
  params: RelationshipViewBuildParams<"citation_lineage">,
): CitationLineageResearchRoutePayload;
export function buildRelationshipViewFromPayload(
  params: RelationshipViewBuildParams<"graph_neighbors">,
): GraphNeighborsResearchRoutePayload;
export function buildRelationshipViewFromPayload(
  params: RelationshipViewBuildParams,
): RelationshipViewPayload<RelationshipRouteKind> {
  const now = new Date().toISOString();
  const common = {
    id: params.id,
    title: params.payload.title,
    content: params.payload.content,
    createdBy: params.payload.createdBy,
    reaction: null,
    refs: [],
    status: params.status,
    version: 0,
    reactionVersion: 0,
    createdAt: now,
    updatedAt: now,
  };
  if (params.payload.type === "citation_lineage") {
    return {
      ...common,
      type: "citation_lineage",
      metadata: params.payload.metadata,
      ownerPrincipalId: params.payload.ownerPrincipalId,
    };
  }
  return {
    ...common,
    type: "graph_neighbors",
    metadata: params.payload.metadata,
    ownerPrincipalId: params.payload.ownerPrincipalId,
  };
}

function buildDocumentFromPayload(params: {
  id: string;
  payload: RelationshipCreatePayload<RelationshipRouteKind>;
  status: ResearchRoutePayload["status"];
}): RelationshipViewPayload<RelationshipRouteKind> {
  return params.payload.type === "citation_lineage"
    ? buildRelationshipViewFromPayload({ ...params, payload: params.payload })
    : buildRelationshipViewFromPayload({ ...params, payload: params.payload });
}

function buildFailedCitationLineageView(params: {
  ownerPrincipalId: string;
  input: RelationshipSeedInput;
}): ResearchRoutePayload {
  const metadata: CitationLineageMetadata = {
    type: "citation_lineage",
    seedPaper: params.input.seedPaper,
    referenceIds: params.input.seedPaper.referenceIds ?? [],
    citationIds: params.input.seedPaper.citationIds ?? [],
    papers: [],
    total: 0,
    referenceAvailability: null,
    citationAvailability: null,
  };
  return buildDocumentFromPayload({
    id: buildEphemeralCitationLineageViewId(params.input.canonicalKey),
    status: "failed",
    payload: {
      ownerPrincipalId: params.ownerPrincipalId,
      type: "citation_lineage",
      title: params.input.seedPaper.title,
      content: "",
      createdBy: "user",
      metadata,
    },
  });
}

function buildFailedGraphNeighborsView(params: {
  ownerPrincipalId: string;
  input: RelationshipSeedInput;
}): ResearchRoutePayload {
  const metadata: GraphNeighborsMetadata = {
    type: "graph_neighbors",
    seedPaper: params.input.seedPaper,
    papers: [],
    total: 0,
    coCited: [],
    coupled: [],
    graphLoadFailed: true,
  };
  return buildDocumentFromPayload({
    id: buildEphemeralGraphNeighborsViewId(params.input.canonicalKey),
    status: "failed",
    payload: {
      ownerPrincipalId: params.ownerPrincipalId,
      type: "graph_neighbors",
      title: params.input.seedPaper.title,
      content: "",
      createdBy: "user",
      metadata,
    },
  });
}

export async function executeCitationLineageFromUrl(params: {
  ownerPrincipalId: string;
  input: RelationshipSeedInput;
  signal?: AbortSignal;
}): Promise<RelationshipExecutionResult> {
  const { ownerPrincipalId, input } = params;
  try {
    const lineage = isEpisteme3PaperRef(input.seedPaper.paperId)
      ? await lookupCitationLineageForPaper(input.seedPaper, params.signal)
      : {
          seedPaper: input.seedPaper,
          papers: [],
          referenceIds: input.seedPaper.referenceIds ?? [],
          citationIds: input.seedPaper.citationIds ?? [],
          referenceAvailability: {
            available: false,
            truncated: false,
            total: input.seedPaper.referenceCount ?? null,
            returned: 0,
            reason: "citation_page_unavailable_for_non_corpus_id",
          },
          citationAvailability: {
            available: false,
            truncated: false,
            total: input.seedPaper.citationCount,
            returned: 0,
            reason: "citation_page_unavailable_for_non_corpus_id",
          },
        };
    const payload = buildCitationLineageViewPayload(
      ownerPrincipalId,
      lineage.seedPaper,
      lineage.papers,
      undefined,
      lineage.referenceIds,
      lineage.citationIds,
      {
        referenceAvailability: lineage.referenceAvailability,
        citationAvailability: lineage.citationAvailability,
      },
    );
    return {
      view: buildDocumentFromPayload({
        id: buildEphemeralCitationLineageViewId(input.canonicalKey),
        status: "ready",
        payload,
      }),
      executed: true,
      failed: false,
    };
  } catch {
    return {
      view: buildFailedCitationLineageView({ ownerPrincipalId, input }),
      executed: false,
      failed: true,
    };
  }
}

export async function executeGraphNeighborsFromUrl(params: {
  ownerPrincipalId: string;
  input: RelationshipSeedInput;
  signal?: AbortSignal;
}): Promise<RelationshipExecutionResult> {
  const { ownerPrincipalId, input } = params;
  try {
    const lookup = isEpisteme3PaperRef(input.seedPaper.paperId)
      ? await lookupGraphNeighborsForPaper(input.seedPaper, params.signal, { hydrate: false })
      : {
          papers: [],
          coCited: [],
          coupled: [],
          coCitedAvailability: {
            available: false,
            truncated: false,
            total: null,
            returned: 0,
            reason: "graph_neighbors_unavailable_for_non_corpus_id",
          },
          coupledAvailability: {
            available: false,
            truncated: false,
            total: null,
            returned: 0,
            reason: "graph_neighbors_unavailable_for_non_corpus_id",
          },
        };
    const { graphNeighbors, graphNeighborPapers } = buildGraphNeighborPayloadFromLookup(lookup);
    const payload = buildGraphNeighborsViewPayload(
      ownerPrincipalId,
      input.seedPaper,
      graphNeighborPapers,
      undefined,
      graphNeighbors,
      false,
      {
        cardDataHydration: {
          status: graphNeighborPapers.length > 0 ? "pending" : "ready",
        },
      },
    );
    return {
      view: buildDocumentFromPayload({
        id: buildEphemeralGraphNeighborsViewId(input.canonicalKey),
        status: "ready",
        payload,
      }),
      executed: true,
      failed: false,
    };
  } catch {
    return {
      view: buildFailedGraphNeighborsView({ ownerPrincipalId, input }),
      executed: false,
      failed: true,
    };
  }
}
