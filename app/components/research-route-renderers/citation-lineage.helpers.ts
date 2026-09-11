// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source

import type { CitationLineageMetadata } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
export {
  getCitationLineageGapInputPapers,
  splitPapersByCitationDirection,
  type CitationDirectionSplit,
} from "@/app/lib/citation-lineage-papers";

export function buildCitationLineageCitationsGapQuery(metadata: CitationLineageMetadata): string {
  return t("search.label.citation-lineage.citationsGapQuery", {
    title: metadata.seedPaper.title,
  });
}
