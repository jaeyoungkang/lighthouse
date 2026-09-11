// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-top-result-input-set

import { MAX_GRAPH_SOURCE_PAPERS } from "@/app/lib/constants";

export function normalizeGraphSourcePaperIds(
  sourcePaperIds?: readonly string[],
): string[] | undefined {
  if (!sourcePaperIds || sourcePaperIds.length === 0) {
    return undefined;
  }

  return sourcePaperIds.slice(0, MAX_GRAPH_SOURCE_PAPERS);
}
