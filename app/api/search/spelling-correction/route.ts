import { NextResponse } from "next/server";
import { z } from "zod";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { searchMetadataIngressSchema } from "@/app/domain/search-metadata-ingress";
import {
  isVersionedSearchBackgroundCommand,
  SEARCH_BACKGROUND_COMMAND_VERSION,
  SEARCH_BACKGROUND_QUERY_MAX_CHARS,
  searchSpellingCorrectionDeltaResponseV1Schema,
  searchSpellingCorrectionCommandV1Schema,
  type SearchSpellingCorrectionCommandV1,
} from "@/app/domain/search-background-transport";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { consumeRouteIngressAdmission } from "@/app/server/operational/route-ingress-admission";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import { resolveSearchSpellingCorrection } from "@/app/server/services/search-spelling-correction-service";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { observeSearchBackgroundTransport } from "@/app/server/operational/search-background-transport-observation";

export const maxDuration = 30;

const spellingCorrectionRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    metadata: searchMetadataIngressSchema,
  })
  .strict();

export const POST = withRouteGuard(async (req: Request) => {
  const { user } = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(
    req,
    getRouteBodyLimit("app/api/search/spelling-correction/route.ts"),
  );
  if (!body.ok) return body.response;
  let command: SearchSpellingCorrectionCommandV1 | null = null;
  let metadata: SearchMetadata | null = null;
  let query: string;

  if (isVersionedSearchBackgroundCommand(body.body)) {
    const parsed = searchSpellingCorrectionCommandV1Schema.safeParse(body.body);
    if (!parsed.success) {
      return apiErrorResponse({
        status: 400,
        code: "SEARCH_SPELLING_CORRECTION_INVALID",
        message: "invalid spelling correction payload",
      });
    }
    command = parsed.data;
    query = command.target.query;
    observeSearchBackgroundTransport("spelling_correction", "v1");
  } else {
    const parsed = spellingCorrectionRequestSchema.safeParse(body.body);
    if (!parsed.success) {
      return apiErrorResponse({
        status: 400,
        code: "SEARCH_SPELLING_CORRECTION_INVALID",
        message: "invalid spelling correction payload",
      });
    }
    query = parsed.data.query;
    metadata = parsed.data.metadata;
    observeSearchBackgroundTransport("spelling_correction", "legacy");
    if (metadata.query.trim() !== query.trim()) {
      return NextResponse.json({ correctedQuery: null });
    }
  }

  // Already resolved on a prior request. The client may have missed that
  // response (the search view view remounts on every background enrichment,
  // which can drop an in-flight request), so return the snapshot correction
  // instead of `null`; the client re-requests after a remount and must be able
  // to recover a correction already present on the current metadata.
  if (metadata?.spellingCorrection) {
    return NextResponse.json({
      correctedQuery: metadata.spellingCorrection.correctedQuery,
      metadata,
      updatedAt: new Date().toISOString(),
    });
  }

  const admission = consumeRouteIngressAdmission("spelling-correction-principal", user.id);
  if (!admission.allowed) {
    return apiErrorResponse({
      status: 429,
      code: "SEARCH_SPELLING_CORRECTION_RATE_LIMITED",
      message: "spelling correction request limit exceeded",
      retryAfterSeconds: admission.retryAfterSeconds,
    });
  }

  const resolvedCorrection = await resolveSearchSpellingCorrection(query, req.signal);
  const correctedQuery =
    resolvedCorrection && resolvedCorrection.length <= SEARCH_BACKGROUND_QUERY_MAX_CHARS
      ? resolvedCorrection
      : null;
  if (!correctedQuery) {
    return command
      ? NextResponse.json(
          searchSpellingCorrectionDeltaResponseV1Schema.parse({
            schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
            target: command.target,
            delta: { spellingCorrection: null },
            updatedAt: new Date().toISOString(),
          }),
        )
      : NextResponse.json({ correctedQuery: null });
  }

  if (command) {
    return NextResponse.json(
      searchSpellingCorrectionDeltaResponseV1Schema.parse({
        schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
        target: command.target,
        delta: {
          spellingCorrection: {
            originalQuery: query,
            correctedQuery,
          },
        },
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  if (!metadata) throw new Error("legacy spelling metadata is missing");
  const updatedMetadata: SearchMetadata = {
    ...metadata,
    spellingCorrection: {
      originalQuery: query,
      correctedQuery,
    },
  };

  return NextResponse.json({
    correctedQuery,
    metadata: updatedMetadata,
    updatedAt: new Date().toISOString(),
  });
});
