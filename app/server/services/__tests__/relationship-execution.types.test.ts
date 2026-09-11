import { expectTypeOf, it } from "vitest";
import type {
  ResearchRoutePayload,
  ResearchRoutePayloadPatch,
} from "@/app/domain/research-route-payload";
import type { RelationshipViewBuildParams } from "@/app/server/services/relationship-execution";

type SearchPatch = Extract<ResearchRoutePayloadPatch, { type: "search" }>;
type GraphMetadata = Extract<ResearchRoutePayload, { type: "graph_neighbors" }>["metadata"];

type SearchPatchWithGraphMetadata = Omit<SearchPatch, "metadata"> & {
  metadata: GraphMetadata;
};

type CitationBuildParams = RelationshipViewBuildParams<"citation_lineage">;
type CitationPayload = CitationBuildParams["payload"];
type CitationMetadataWithoutIds = Omit<CitationPayload["metadata"], "citationIds">;
type CitationBuildWithoutIds = Omit<CitationBuildParams, "payload"> & {
  payload: Omit<CitationPayload, "metadata"> & {
    metadata: CitationMetadataWithoutIds;
  };
};

type GraphBuildParams = RelationshipViewBuildParams<"graph_neighbors">;
type GraphPayload = GraphBuildParams["payload"];
type GraphMetadataWithoutCoupled = Omit<GraphPayload["metadata"], "coupled">;
type GraphBuildWithoutCoupled = Omit<GraphBuildParams, "payload"> & {
  payload: Omit<GraphPayload, "metadata"> & {
    metadata: GraphMetadataWithoutCoupled;
  };
};

it("keeps current-view patches paired with their route metadata", () => {
  expectTypeOf<SearchPatch>().toExtend<ResearchRoutePayloadPatch>();
  expectTypeOf<SearchPatchWithGraphMetadata>().not.toExtend<ResearchRoutePayloadPatch>();
});

it("requires citation-lineage builder metadata", () => {
  expectTypeOf<CitationBuildParams>().toExtend<RelationshipViewBuildParams>();
  expectTypeOf<CitationBuildWithoutIds>().not.toExtend<RelationshipViewBuildParams>();
});

it("requires graph-neighbor builder metadata", () => {
  expectTypeOf<GraphBuildParams>().toExtend<RelationshipViewBuildParams>();
  expectTypeOf<GraphBuildWithoutCoupled>().not.toExtend<RelationshipViewBuildParams>();
});
