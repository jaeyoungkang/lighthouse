import type { RefinementCtx } from "zod";
import { searchMetadataSchema } from "@/app/domain/research-route-payload-schema";
import { SEARCH_RESULT_POOL_PAPER_LIMIT } from "@/app/lib/constants";

export const SEARCH_INGRESS_QUERY_MAX_CHARS = 500;

function addCardinalityIssue(
  context: RefinementCtx,
  path: PropertyKey[],
  label: string,
  actual: number,
  maximum: number,
): void {
  if (actual <= maximum) return;
  context.addIssue({
    code: "custom",
    path,
    message: `${label} must contain at most ${String(maximum)} items`,
  });
}

/**
 * Runtime/domain payloads remain backward-compatible. API ingress applies this
 * narrower projection before accepting client-carried search snapshots.
 */
export const searchMetadataIngressSchema = searchMetadataSchema.superRefine((metadata, context) => {
  if (metadata.query.length > SEARCH_INGRESS_QUERY_MAX_CHARS) {
    context.addIssue({
      code: "custom",
      path: ["query"],
      message: `query must contain at most ${String(SEARCH_INGRESS_QUERY_MAX_CHARS)} characters`,
    });
  }

  addCardinalityIssue(
    context,
    ["papers"],
    "papers",
    metadata.papers.length,
    SEARCH_RESULT_POOL_PAPER_LIMIT,
  );
  addCardinalityIssue(
    context,
    ["queryClauses"],
    "queryClauses",
    metadata.queryClauses?.length ?? 0,
    40,
  );
  addCardinalityIssue(
    context,
    ["clauseStats"],
    "clauseStats",
    metadata.clauseStats?.length ?? 0,
    40,
  );
  addCardinalityIssue(
    context,
    ["englishTermCandidates"],
    "englishTermCandidates",
    metadata.englishTermCandidates?.length ?? 0,
    20,
  );
  addCardinalityIssue(
    context,
    ["libraryContext", "folders"],
    "libraryContext.folders",
    metadata.libraryContext?.folders.length ?? 0,
    100,
  );
  addCardinalityIssue(
    context,
    ["libraryContext", "libraryOnlyPaperIds"],
    "libraryContext.libraryOnlyPaperIds",
    metadata.libraryContext?.libraryOnlyPaperIds?.length ?? 0,
    200,
  );
  addCardinalityIssue(
    context,
    ["abstractHydration", "libraryPaperIds"],
    "abstractHydration.libraryPaperIds",
    metadata.abstractHydration?.libraryPaperIds?.length ?? 0,
    200,
  );

  for (const [key, values] of Object.entries(metadata.facetFilters ?? {})) {
    if (Array.isArray(values)) {
      addCardinalityIssue(
        context,
        ["facetFilters", key],
        `facetFilters.${key}`,
        values.length,
        100,
      );
    }
  }
});
