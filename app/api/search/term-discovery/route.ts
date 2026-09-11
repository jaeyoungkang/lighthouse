// @promise promise:search-results-suggest-english-terms
// @check acceptance-check:search-results-suggest-english-terms-background-llm-primary

import { NextResponse } from "next/server";
import { z } from "zod";
import { searchMetadataIngressSchema } from "@/app/domain/search-metadata-ingress";
import { hydrateSearchMetadataWithCachedInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import {
  isVersionedSearchBackgroundCommand,
  SEARCH_BACKGROUND_COMMAND_VERSION,
  SEARCH_BACKGROUND_QUERY_MAX_CHARS,
  searchTermDiscoveryDeltaResponseV1Schema,
  searchTermDiscoveryCommandV1Schema,
} from "@/app/domain/search-background-transport";
import { requireOwnerPrincipalAuth } from "@/app/server/auth/identity";
import { withRouteGuard } from "@/app/server/guards/route-guard";
import { readRouteJsonBody } from "@/app/server/guards/route-json-body";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";
import {
  applyGraphSupportToEnglishTermCandidates,
  projectSearchTermDiscoveryPapersFromCachedMetadata,
  runSearchTermDiscoveryOnProjection,
  runSearchTermDiscoveryOnMetadata,
  shouldRunSearchTermDiscovery,
} from "@/app/server/services/search-term-discovery";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { createLlmJudgmentUsageLedgerForTrustedAgent } from "@/app/server/domain-access/llm-usage-access";
import { apiErrorResponse } from "@/app/server/http/api-error-response";
import { observeSearchBackgroundTransport } from "@/app/server/operational/search-background-transport-observation";

export const maxDuration = 60;

const searchTermDiscoveryRequestSchema = z
  .object({
    query: z.string().trim().min(1).max(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    metadata: searchMetadataIngressSchema,
    phase: z
      .enum(["initial", "analysis_upgrade"])
      .default("initial")
      .transform(() => "initial" as const),
  })
  .strict();

/**
 * POST /api/search/term-discovery — 검색 응답을 막지 않는 background
 * 연구 용어 추출. 검색 커밋 시 `pending`으로 남은 문서를 LLM 추출로 닫는다.
 */
export const POST = withRouteGuard(async (req: Request) => {
  const { db, user } = await requireOwnerPrincipalAuth();
  const body = await readRouteJsonBody(
    req,
    getRouteBodyLimit("app/api/search/term-discovery/route.ts"),
  );
  if (!body.ok) return body.response;

  if (isVersionedSearchBackgroundCommand(body.body)) {
    const command = searchTermDiscoveryCommandV1Schema.safeParse(body.body);
    if (!command.success) {
      return apiErrorResponse({
        status: 400,
        code: "SEARCH_TERM_DISCOVERY_INVALID",
        message: "invalid term discovery payload",
      });
    }
    observeSearchBackgroundTransport("term_discovery", "v1");
    const cacheInputFingerprintByPaperId = new Map(
      command.data.promptPapers.flatMap((paper) =>
        paper.inputFingerprint ? [[paper.paperId, paper.inputFingerprint] as const] : [],
      ),
    );
    const cachedPromptMetadata = await hydrateSearchMetadataWithCachedInlineAnalysis({
      db,
      metadata: {
        type: "search",
        query: command.data.target.query,
        total: command.data.promptPapers.length,
        papers: command.data.promptPapers.map((paper) => ({
          ...paper,
          citationCount: 0,
          url: "",
          authors: [],
        })),
      },
      signal: req.signal,
      cacheInputFingerprintByPaperId,
    });
    const promptPapers = projectSearchTermDiscoveryPapersFromCachedMetadata(cachedPromptMetadata);
    const delta = await runSearchTermDiscoveryOnProjection({
      query: command.data.target.query,
      papers: promptPapers,
      queryClauses: command.data.queryClauses,
      graphSupportedPaperIds: command.data.graphSupportedPaperIds,
      signal: req.signal,
      usageLedger: createLlmJudgmentUsageLedgerForTrustedAgent({
        db,
        ownerPrincipalId: user.id,
      }),
    });
    return NextResponse.json(
      searchTermDiscoveryDeltaResponseV1Schema.parse({
        schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
        target: command.data.target,
        delta,
        updatedAt: new Date().toISOString(),
      }),
    );
  }

  const parsed = searchTermDiscoveryRequestSchema.safeParse(body.body);
  if (!parsed.success) {
    return apiErrorResponse({
      status: 400,
      code: "SEARCH_TERM_DISCOVERY_INVALID",
      message: "invalid term discovery payload",
    });
  }

  observeSearchBackgroundTransport("term_discovery", "legacy");
  const metadata: SearchMetadata = {
    ...parsed.data.metadata,
    query: parsed.data.query,
  };
  if (!shouldRunSearchTermDiscovery(metadata, parsed.data.phase)) {
    return NextResponse.json({ metadata, updatedAt: new Date().toISOString() });
  }

  const hydratedMetadata = await hydrateSearchMetadataWithCachedInlineAnalysis({
    db,
    metadata,
  });
  const computedMetadata = await runSearchTermDiscoveryOnMetadata({
    metadata: hydratedMetadata,
    phase: parsed.data.phase,
    usageLedger: createLlmJudgmentUsageLedgerForTrustedAgent({
      db,
      ownerPrincipalId: user.id,
    }),
  });

  const computedCandidates = computedMetadata.englishTermCandidates ?? [];
  const englishTermCandidates =
    metadata.graphSupport?.status === "ready" && computedCandidates.length > 0
      ? applyGraphSupportToEnglishTermCandidates({
          candidates: computedCandidates,
          papers: metadata.papers,
          graphSupport: metadata.graphSupport,
        })
      : computedCandidates;

  const updatedMetadata: SearchMetadata = {
    ...metadata,
    englishTermCandidates,
    englishTermDiscovery: computedMetadata.englishTermDiscovery,
  };

  return NextResponse.json({ metadata: updatedMetadata, updatedAt: new Date().toISOString() });
});
