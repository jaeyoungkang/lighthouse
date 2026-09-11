import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SEARCH_BACKGROUND_COMMAND_VERSION,
  projectSearchEnrichmentPaperDelta,
  searchEnrichmentDeltaResponseV1Schema,
  type SearchEnrichmentCommandV1,
  type SearchEnrichmentDeltaResponseV1,
} from "@/app/domain/search-background-transport";
import { requireOwnerPrincipalAuth, type AuthContext } from "@/app/server/auth/identity";
import { getEpistemePaperIdentityAliases } from "@/app/lib/episteme-paper-ref";
import { hydrateSearchMetadataWithCachedInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import { getReviewedStatus } from "@/app/server/repository/reviewed-papers";
import {
  computeSearchHydrationPaperDelta,
  computeSearchHydration,
  shouldRepairSearchHydration,
} from "@/app/server/services/search-hydration";
import { buildDocumentPaper, buildSearchViewPayload } from "@/app/server/services/search-service";

export interface StatelessSearchEnrichmentInput {
  query: string;
  metadata: SearchMetadata;
}

export interface StatelessSearchEnrichmentResult {
  metadata: SearchMetadata;
  updatedAt: string;
  hadSignal: boolean;
}

export async function enrichSearchCommand(
  command: SearchEnrichmentCommandV1,
  signal?: AbortSignal,
  authContext?: AuthContext,
): Promise<SearchEnrichmentDeltaResponseV1> {
  if (!authContext) await requireOwnerPrincipalAuth();
  const hydratedPapers = await computeSearchHydrationPaperDelta(command, signal);
  const projectedMetadata: SearchMetadata = {
    type: "search",
    query: command.target.query,
    papers: hydratedPapers.map((paper) => buildDocumentPaper(paper)),
    total: hydratedPapers.length,
  };
  const repairAttempted =
    command.hydration.status === "ready" ||
    command.hydration.repairAttempted === true ||
    hydratedPapers.length === 0;

  return searchEnrichmentDeltaResponseV1Schema.parse({
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: command.target,
    delta: {
      papers: projectedMetadata.papers.map(projectSearchEnrichmentPaperDelta),
      abstractHydration: {
        status: "ready",
        ...(repairAttempted ? { repairAttempted: true } : {}),
      },
    },
    updatedAt: new Date().toISOString(),
  });
}

async function hydrateSearchMetadataSnapshot(
  metadata: SearchMetadata,
  auth: AuthContext,
  signal?: AbortSignal,
): Promise<{ metadata: SearchMetadata; hadSignal: boolean }> {
  const { db, user } = auth;
  const hydrationPending = metadata.abstractHydration?.status === "pending";
  const repairingReadySnapshot = !hydrationPending && shouldRepairSearchHydration(metadata);
  if (!hydrationPending && !repairingReadySnapshot) {
    return { metadata, hadSignal: false };
  }

  const hydrated = await computeSearchHydration(metadata, user.email, signal, {
    repairReady: true,
  });
  if (!hydrated) {
    return {
      metadata: {
        ...metadata,
        abstractHydration: {
          ...metadata.abstractHydration,
          status: "ready",
          repairAttempted: true,
        },
      },
      hadSignal: false,
    };
  }

  const paperRefs = Array.from(
    new Set(hydrated.papers.flatMap((paper) => getEpistemePaperIdentityAliases(paper))),
  );
  const reviewedMap = await getReviewedStatus(db, user.id, paperRefs);
  const payload = buildSearchViewPayload(
    user.id,
    metadata.query,
    hydrated.papers,
    hydrated.total,
    "user",
    metadata.queryClauses,
    metadata.totalMode,
    metadata.clauseStats,
    user.id,
    reviewedMap,
    metadata.seedPaper,
    metadata.termSeed,
    metadata.spellingCorrection,
    hydrated.resolvedSort,
    metadata.yearFilter ?? "",
    metadata.facetFilters,
    metadata.exactLookup,
    metadata.paging,
    metadata.source,
    {
      context: hydrated.librarySummary,
      available: metadata.libraryContextAvailable || hydrated.libraryContextAvailable,
    },
    {
      ...metadata.abstractHydration,
      status: "ready",
      ...(repairingReadySnapshot ? { repairAttempted: true } : {}),
    },
  );
  const hydratedMetadata = await hydrateSearchMetadataWithCachedInlineAnalysis({
    db,
    metadata: {
      ...(payload.metadata as SearchMetadata),
      ...(metadata.graphSupport ? { graphSupport: metadata.graphSupport } : {}),
      ...(metadata.englishTermDiscovery
        ? { englishTermDiscovery: metadata.englishTermDiscovery }
        : {}),
    },
  });
  return { metadata: hydratedMetadata, hadSignal: hydrated.librarySummary?.signalPresent === true };
}

export async function enrichSearchSnapshot(
  input: StatelessSearchEnrichmentInput,
  signal?: AbortSignal,
  authContext?: AuthContext,
): Promise<StatelessSearchEnrichmentResult> {
  const auth = authContext ?? (await requireOwnerPrincipalAuth());
  const baseMetadata: SearchMetadata = {
    ...input.metadata,
    query: input.query,
  };
  const hydrated = await hydrateSearchMetadataSnapshot(baseMetadata, auth, signal);
  return {
    metadata: hydrated.metadata,
    updatedAt: new Date().toISOString(),
    hadSignal: hydrated.hadSignal,
  };
}
