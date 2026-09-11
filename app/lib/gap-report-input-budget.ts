import { utf8ByteLength } from "@/app/lib/utf8";

export { truncateUtf8, utf8ByteLength } from "@/app/lib/utf8";

/**
 * Shared gap-report ingress and production-serializer limits.
 *
 * The route remains the untrusted-input guard. The smaller snapshot limits keep
 * the production serializer's maximum envelope below the route byte budget.
 */
export const GAP_REPORT_REQUEST_MAX_BYTES = 1_000_000;

export const GAP_REPORT_INGRESS_LIMITS = {
  sourceSnapshotIdChars: 256,
  sourceQueryChars: 1_000,
  paperIdChars: 256,
  paperTitleChars: 4_000,
  paperAbstractChars: 30_000,
  paperUrlChars: 4_096,
  paperAuthors: 100,
  authorNameChars: 500,
  paperRelationIds: 1_000,
  graphScoreSources: 100,
} as const;

export const GAP_REPORT_SNAPSHOT_LIMITS = {
  sourceSnapshotIdBytes: 256,
  sourceQueryBytes: 1_000,
  preservedPaperIdBytes: 128,
  paperTitleBytes: 4_000,
  paperAbstractBytes: 10_000,
  paperUrlBytes: 2_048,
  paperRelationIds: 100,
  graphScoreSources: GAP_REPORT_INGRESS_LIMITS.graphScoreSources,
  generatedAtBytes: 64,
} as const;

export class GapReportRequestBudgetError extends Error {
  readonly actualBytes: number;

  constructor(actualBytes: number) {
    super("gap report request exceeds the serialized byte budget");
    this.name = "GapReportRequestBudgetError";
    this.actualBytes = actualBytes;
  }
}

export function serializeGapReportRequest(value: unknown): string {
  const serialized = JSON.stringify(value);
  const actualBytes = utf8ByteLength(serialized);
  if (actualBytes > GAP_REPORT_REQUEST_MAX_BYTES) {
    throw new GapReportRequestBudgetError(actualBytes);
  }
  return serialized;
}
