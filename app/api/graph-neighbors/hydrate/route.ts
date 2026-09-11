// @promise promise:graph-neighbor-papers
// @check acceptance-check:graph-neighbor-papers-card-data-hydration

import { NextResponse } from "next/server";
import { z } from "zod";
import { graphNeighborsMetadataSchema } from "@/app/domain/research-route-payload-schema";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { hydrateGraphNeighborSnapshot } from "@/app/server/domain-access/graph-neighbor-hydration-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { apiErrorResponse } from "@/app/server/http/api-error-response";

export const maxDuration = 60;

const graphNeighborHydrationRequestSchema = z
  .object({
    metadata: graphNeighborsMetadataSchema.extend({
      papers: graphNeighborsMetadataSchema.shape.papers.max(200),
      coCited: graphNeighborsMetadataSchema.shape.coCited.max(200),
      coupled: graphNeighborsMetadataSchema.shape.coupled.max(200),
    }),
  })
  .strict();

export const POST = withRouteGuard(async (req: Request) => {
  const auth = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(
    req,
    getRouteBodyLimit("app/api/graph-neighbors/hydrate/route.ts"),
  );
  if (!body.ok) return body.response;
  const parsed = graphNeighborHydrationRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "GRAPH_NEIGHBOR_HYDRATION_INVALID",
      message: "invalid graph-neighbor hydration payload",
    });
  }

  const result = await hydrateGraphNeighborSnapshot(parsed.data, req.signal, auth);

  return NextResponse.json(result);
});
