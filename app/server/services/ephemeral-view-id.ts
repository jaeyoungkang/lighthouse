import { createHash } from "node:crypto";
import {
  EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX,
  EPHEMERAL_GRAPH_NEIGHBORS_DOCUMENT_ID_PREFIX,
  EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX,
} from "@/app/lib/ephemeral-search-view";

function canonicalIdentityDigest(canonicalKey: string): string {
  return createHash("sha256").update(canonicalKey, "utf8").digest("hex");
}

export function buildEphemeralSearchViewId(canonicalKey: string): string {
  return `${EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`;
}

export function buildEphemeralCitationLineageViewId(canonicalKey: string): string {
  return `${EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`;
}

export function buildEphemeralGraphNeighborsViewId(canonicalKey: string): string {
  return `${EPHEMERAL_GRAPH_NEIGHBORS_DOCUMENT_ID_PREFIX}${canonicalIdentityDigest(canonicalKey)}`;
}
