import { createHash } from "node:crypto";
import {
  buildCanonicalGapNetworkSourceSnapshot,
  type GapNetworkSourceSnapshotInput,
} from "@/app/server/domain-access/gap-network-view-input";

// v2 projects every active graph source to the share-safe gap snapshot basis.
// Existing v1 digests remain addressable by report id but are not reused by a
// new reservation whose canonical graph bytes use this version.
const GAP_REPORT_SOURCE_IDENTITY_VERSION = 2;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

/**
 * Global gap-report reuse is content-addressed. The ephemeral source view id is
 * provenance only; it is a compact route-condition hash and cannot own durable
 * artifact identity.
 */
export function buildGapReportSourceInputDigest(input: GapNetworkSourceSnapshotInput): string {
  const canonical = buildCanonicalGapNetworkSourceSnapshot(input);
  const canonicalInput = {
    version: GAP_REPORT_SOURCE_IDENTITY_VERSION,
    sourceQuery: canonical.sourceQuery,
    sourcePaperIds: canonical.sourcePaperIds,
    papers: canonical.papers,
    graphSupport: canonical.graphSupport
      ? { ...canonical.graphSupport, generatedAt: undefined }
      : null,
    createdBy: canonical.createdBy,
  };
  return createHash("sha256").update(stableJson(canonicalInput)).digest("hex");
}
