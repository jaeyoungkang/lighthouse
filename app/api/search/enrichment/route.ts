// @promise promise:search-results-fast-window
// @aspect aspect:library-grounded-research
// @check acceptance-check:search-results-fast-window-library-interest-default

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchMetadataIngressSchema } from "@/app/domain/search-metadata-ingress";
import {
  isVersionedSearchBackgroundCommand,
  SEARCH_BACKGROUND_QUERY_MAX_CHARS,
  searchEnrichmentCommandV1Schema,
} from "@/app/domain/search-background-transport";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import {
  enrichSearchCommand,
  enrichSearchSnapshot,
} from "@/app/server/domain-access/search-enrichment-access";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { observeSearchBackgroundTransport } from "@/app/server/operational/search-background-transport-observation";

export const maxDuration = 60;

const searchEnrichmentRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    metadata: searchMetadataIngressSchema,
  })
  .strict();

export const POST = withRouteGuard(async (req: Request) => {
  const auth = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(
    req,
    getRouteBodyLimit("app/api/search/enrichment/route.ts"),
  );
  if (!body.ok) return body.response;

  if (isVersionedSearchBackgroundCommand(body.body)) {
    const command = searchEnrichmentCommandV1Schema.safeParse(body.body);
    if (!command.success) {
      return apiErrorResponse({
        status: 400,
        code: "SEARCH_ENRICHMENT_INVALID",
        message: "invalid search enrichment payload",
      });
    }
    observeSearchBackgroundTransport("enrichment", "v1");
    return NextResponse.json(await enrichSearchCommand(command.data, req.signal, auth));
  }

  const parsed = searchEnrichmentRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "SEARCH_ENRICHMENT_INVALID",
      message: "invalid search enrichment payload",
    });
  }

  observeSearchBackgroundTransport("enrichment", "legacy");
  const result = await enrichSearchSnapshot(parsed.data, req.signal, auth);

  return NextResponse.json(result);
});
