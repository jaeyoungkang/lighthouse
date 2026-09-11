// Generated from docs/glossary/terms.json. Do not edit.

import type { GlossaryTermId } from "@/app/domain/glossary-terms.generated";
import type { MessageKey } from "@/app/i18n/messages";

export const GLOSSARY_I18N_REFS = [
  {
    termId: "my-library",
    key: "search.label.research-route-search-bar.libraryList.label",
  },
  {
    termId: "my-library",
    key: "search.label.library-context-source.internalReviewedFolder",
  },
  {
    termId: "my-research-proximity",
    key: "search.label.search-result-item.myResearchProximity",
  },
  {
    termId: "similar-papers",
    key: "search.label.search-result-item.findSimilar",
  },
  {
    termId: "similar-papers",
    key: "search.label.search-result-item.graphNeighbors",
  },
  {
    termId: "similar-papers",
    key: "search.label.graph-neighbors.kicker",
  },
  {
    termId: "similar-papers",
    key: "document.label.rendering.graphNeighbors",
  },
  {
    termId: "citation-lineage",
    key: "search.label.search-result-item.citationLineage.lineage",
  },
  {
    termId: "citation-lineage",
    key: "document.label.rendering.citationLineage",
  },
  {
    termId: "research-gap",
    key: "commitment.graphSample.output.gap.label",
  },
  {
    termId: "representative-paper",
    key: "gapNetwork.label.gap-network-report.focusedClusterRepresentativePapers",
  },
  {
    termId: "representative-paper",
    key: "search.label.search-view-content.facets.representative",
  },
  {
    termId: "representative-paper",
    key: "commitment.graphSample.output.representative.label",
  },
  {
    termId: "research-term",
    key: "commitment.graphSample.output.terms.label",
  },
] as const satisfies readonly {
  termId: GlossaryTermId;
  key: MessageKey;
}[];
