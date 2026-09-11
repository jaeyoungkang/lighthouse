// @promise promise:researcher-prose-promises-page
// @aspect aspect:user-facing-language-governance
export const REQUIRED_PROMISE_VALUE_FACETS = [
  "ai-search-explanation",
  "automatic-inline-analysis",
  "citation-context",
  "deep-reading-handoff",
  "gap-discovery",
  "route-view-continuity",
] as const;

export type PromiseValueFacetId = (typeof REQUIRED_PROMISE_VALUE_FACETS)[number];

export const PROMISE_PARAGRAPHS = [
  {
    id: "search",
    titleKey: "commitment.promises.search.title",
    bodyKey: "commitment.promises.search.body",
    footnoteRef: "promise:search-reaction-summarizes-terrain",
    valueFacetIds: ["ai-search-explanation"],
  },
  {
    id: "inline-analysis",
    titleKey: "commitment.promises.inlineAnalysis.title",
    bodyKey: "commitment.promises.inlineAnalysis.body",
    footnoteRef: "promise:inline-analysis-auto-run",
    valueFacetIds: ["automatic-inline-analysis"],
  },
  {
    id: "citation",
    titleKey: "commitment.promises.citation.title",
    bodyKey: "commitment.promises.citation.body",
    footnoteRef: "promise:citation-lineage",
    valueFacetIds: ["citation-context"],
  },
  {
    id: "pdf",
    titleKey: "commitment.promises.pdf.title",
    bodyKey: "commitment.promises.pdf.body",
    footnoteRef: "promise:delegate-deep-read-to-moonlight",
    valueFacetIds: ["deep-reading-handoff"],
  },
  {
    id: "gap",
    titleKey: "commitment.promises.gap.title",
    bodyKey: "commitment.promises.gap.body",
    footnoteRef: "promise:gap-network-detection-from-search",
    valueFacetIds: ["gap-discovery"],
  },
  {
    id: "research-route",
    titleKey: "commitment.promises.research-route.title",
    bodyKey: "commitment.promises.research-route.body",
    footnoteRef: "promise:route-view-ai-comment-inline-surface",
    valueFacetIds: ["route-view-continuity"],
  },
] as const satisfies readonly {
  id: string;
  titleKey: string;
  bodyKey: string;
  footnoteRef: string;
  valueFacetIds: readonly PromiseValueFacetId[];
}[];
